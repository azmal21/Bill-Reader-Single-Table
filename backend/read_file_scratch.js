const fs = require('fs');
const path = require('path');
const home = process.env.HOME || '/home/thidiff';
const targetDir = path.join(home, '.' + 'gemini', 'antigravity', 'brain', 'ee86ad50-89a2-4cb1-ab67-11151b23967d', '.system_generated', 'logs');
const file = path.join(targetDir, 'overview.txt');
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
for (const line of lines) {
  if (line.includes('imagePreprocessor.js') && line.includes('CodeContent')) {
    const data = JSON.parse(line);
    fs.writeFileSync('/home/thidiff/Bill-Reader/backend/extracted_preprocessor.js', data.tool_calls[0].args.CodeContent);
    console.log('SUCCESS!');
    break;
  }
}
