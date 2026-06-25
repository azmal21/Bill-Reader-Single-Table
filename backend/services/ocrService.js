/**
 * ocrService.js
 * Centralized OCR service managing a persistent pool of Tesseract workers.
 * Eliminates startup overhead, supports concurrent request handling,
 * provides timeout protection, and logs detailed diagnostics.
 */

const { createWorker } = require('tesseract.js');
const path = require('path');
const sharp = require('sharp');

// Path to the directory containing eng.traineddata (backend root)
const LANG_PATH = path.resolve(__dirname, '..');
const CONCURRENT_WORKERS = parseInt(process.env.CONCURRENT_OCR_WORKERS, 10) || 2;

// Pool state
const pool = [];
let poolReady = null;
let activeOCRJobs = 0;
const pendingJobs = [];

/**
 * Creates and initializes a new Tesseract worker instance.
 */
async function createTesseractWorker(id) {
  const worker = await createWorker('eng', 1, {
    langPath: LANG_PATH,
    cachePath: LANG_PATH,
    gzip: false,
  });
  await worker.setParameters({
    tessedit_pageseg_mode: '6',
    preserve_interword_spaces: '1',
  });
  return worker;
}

/**
 * Initializes the persistent worker pool at startup.
 */
function initWorkerPool() {
  poolReady = (async () => {
    try {
      console.log(`🤖 Initializing persistent Tesseract OCR worker pool with ${CONCURRENT_WORKERS} workers...`);
      const start = Date.now();
      for (let i = 0; i < CONCURRENT_WORKERS; i++) {
        const worker = await createTesseractWorker(i + 1);
        pool.push({
          id: i + 1,
          worker,
          active: false,
          imagePath: null,
          jobsProcessed: 0
        });
      }
      console.log(`✅ OCR Worker Pool ready in ${Date.now() - start}ms`);
    } catch (err) {
      console.error('❌ Failed to initialize OCR worker pool:', err.message);
      throw err;
    }
  })();
}

// Start initialization immediately
initWorkerPool();

/**
 * Gets the count of active OCR jobs.
 */
function getActiveJobsCount() {
  return activeOCRJobs;
}

/**
 * Internal queue processing loop.
 */
async function processQueue() {
  if (pendingJobs.length === 0) return;

  // Find a free worker
  const workerObj = pool.find(w => !w.active);
  if (!workerObj) {
    console.log(`[QUEUE MONITOR] OCR Queue length: ${pendingJobs.length}. Active OCR Jobs: ${activeOCRJobs}. Waiting for a free worker...`);
    return;
  }

  const job = pendingJobs.shift();
  workerObj.active = true;
  workerObj.imagePath = job.imagePath;
  activeOCRJobs++;

  console.log("Active OCR Jobs:", activeOCRJobs);
  console.log(`[QUEUE MONITOR] Queue length: ${pendingJobs.length}. Running tasks:`, pool.filter(w => w.active).map(w => `Worker #${w.id} processing ${path.basename(w.imagePath)}`));

  let completed = false;
  let timeoutId = null;

  // 120-second Timeout Protection
  timeoutId = setTimeout(async () => {
    if (completed) return;
    completed = true;

    console.error(`[TIMEOUT] OCR job exceeded 120s timeout limit for image: ${job.imagePath}`);
    console.log(`[TIMEOUT] Current active OCR jobs before recovery: ${activeOCRJobs}`);

    // Decrement active counter and set worker active status to false
    activeOCRJobs--;
    workerObj.active = false;
    workerObj.imagePath = null;

    // Hard termination of the stuck worker to release CPU/Memory
    try {
      console.log(`[RECOVERY] Terminating stuck Tesseract Worker #${workerObj.id}...`);
      await workerObj.worker.terminate();
    } catch (err) {
      console.error(`[RECOVERY] Error during termination of Worker #${workerObj.id}:`, err.message);
    }

    // Recreate the terminated worker to restore capacity
    try {
      console.log(`[RECOVERY] Re-creating Tesseract Worker #${workerObj.id}...`);
      const newWorker = await createTesseractWorker(workerObj.id);
      workerObj.worker = newWorker;
      workerObj.jobsProcessed = 0;
      console.log(`[RECOVERY] Tesseract Worker #${workerObj.id} is recreated and healthy.`);
    } catch (err) {
      console.error(`[RECOVERY] Failed to recreate Worker #${workerObj.id}:`, err.message);
    }

    job.reject(new Error("OCR request timed out after 120 seconds."));
    processQueue(); // Process the next job in queue
  }, 120000);

  try {
    console.log("OCR START:", job.imagePath);
    console.time("OCR");
    const startTime = Date.now();

    // Read image dimensions before OCR for diagnostics
    let imgWidth = 0;
    let imgHeight = 0;
    try {
      const metadata = await sharp(job.imagePath).metadata();
      imgWidth = metadata.width || 0;
      imgHeight = metadata.height || 0;
      console.log(`Image Dimensions: ${imgWidth}x${imgHeight}`);
    } catch (metaErr) {
      console.warn(`[DIAGNOSTIC] Could not read metadata for ${job.imagePath}:`, metaErr.message);
    }

    // Run Tesseract recognition
    const { data } = await workerObj.worker.recognize(job.imagePath);

    completed = true;
    clearTimeout(timeoutId);
    console.timeEnd("OCR");

    activeOCRJobs--;
    workerObj.active = false;
    workerObj.imagePath = null;
    workerObj.jobsProcessed++;

    const duration = Date.now() - startTime;
    const confidence = data.confidence || 0;
    const text = data.text || '';

    console.log("OCR END:", job.imagePath);
    console.log(`OCR confidence: ${confidence}%`);
    console.log(`Extracted text length: ${text.length}`);
    console.log(`Image dimensions: ${imgWidth}x${imgHeight}`);
    console.log(`Processing duration: ${duration}ms`);

    // Recycle worker after 30 jobs to clear cumulative memory leak
    if (workerObj.jobsProcessed >= 30) {
      console.log(`[MAINTENANCE] Worker #${workerObj.id} processed ${workerObj.jobsProcessed} jobs. Recycling worker...`);
      try {
        await workerObj.worker.terminate();
        const newWorker = await createTesseractWorker(workerObj.id);
        workerObj.worker = newWorker;
        workerObj.jobsProcessed = 0;
        console.log(`[MAINTENANCE] Worker #${workerObj.id} successfully recycled.`);
      } catch (err) {
        console.error(`[MAINTENANCE] Failed to recycle worker #${workerObj.id}:`, err.message);
      }
    }

    job.resolve({ text, confidence, duration, imageWidth: imgWidth, imageHeight: imgHeight, tsv: data.tsv, words: data.words });
  } catch (err) {
    if (completed) return;
    completed = true;
    clearTimeout(timeoutId);
    console.timeEnd("OCR");

    activeOCRJobs--;
    workerObj.active = false;
    workerObj.imagePath = null;

    console.error(`❌ OCR Error on Worker #${workerObj.id}:`, err.message);

    // Recreate crashed worker
    try {
      console.log(`[RECOVERY] Recycling crashed Worker #${workerObj.id}...`);
      await workerObj.worker.terminate();
      const newWorker = await createTesseractWorker(workerObj.id);
      workerObj.worker = newWorker;
      workerObj.jobsProcessed = 0;
    } catch (recycleErr) {
      console.error(`[RECOVERY] Failed to recreate Worker #${workerObj.id} after crash:`, recycleErr.message);
    }

    job.reject(err);
  } finally {
    processQueue();
  }
}

/**
 * Perform OCR on a given image file using the persistent worker pool.
 * @param {string} imagePath - Path to the preprocessed image file.
 * @returns {Promise<object>} - Object containing extracted text and confidence score.
 */
async function performOCR(imagePath) {
  await poolReady;
  return new Promise((resolve, reject) => {
    pendingJobs.push({ imagePath, resolve, reject });
    processQueue();
  });
}

module.exports = {
  performOCR,
  getActiveJobsCount
};
