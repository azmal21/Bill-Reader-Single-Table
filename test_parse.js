const { parseBillRegex, cleanOcrText } = require('./backend/utils/restaurantParser');
try {
  const parsed = parseBillRegex("fake ocr text\n1 item 10 10");
  console.log("Parsed:", parsed);
} catch (e) {
  console.error("Error:", e);
}
