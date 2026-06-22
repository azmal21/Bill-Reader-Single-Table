const { parseBillRegex } = require('./utils/restaurantParser');

const sampleText = `
VIGNESHWARA BHAVAN
Bangalore
TOTAL X 209.00
VADA 5 15.00 75.00
IDLI 2 20.00 40.00
DOSA 1 60.00 60.00
CGST 17.00
SGST 17.00
GRAND TOTAL 209.00
`;

const result = parseBillRegex(sampleText);
console.log(JSON.stringify(result, null, 2));
