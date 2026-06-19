const fs = require('fs');
const log = fs.readFileSync('/home/thidiff/.gemini/antigravity/brain/ee86ad50-89a2-4cb1-ab67-11151b23967d/.system_generated/logs/overview.txt', 'utf8');
const lines = log.split('\n');
for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const data = JSON.parse(line);
    if (data.tool_calls) {
      for (const tc of data.tool_calls) {
        if (tc.name === 'write_to_file' && tc.args.TargetFile.includes('imagePreprocessor.js')) {
          console.log('--- imagePreprocessor.js ---');
          console.log(tc.args.CodeContent);
        }
        if (tc.name === 'write_to_file' && tc.args.TargetFile.includes('ocrService.js')) {
          console.log('--- ocrService.js ---');
          console.log(tc.args.CodeContent);
        }
      }
    }
  } catch (e) {
    // Ignore JSON parsing errors
  }
}
