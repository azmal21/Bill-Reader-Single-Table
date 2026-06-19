const pool = require('./db');
pool.query(`
  ALTER TABLE bills ADD COLUMN IF NOT EXISTS sgst DECIMAL(10, 2) DEFAULT 0;
  ALTER TABLE bills ADD COLUMN IF NOT EXISTS cgst DECIMAL(10, 2) DEFAULT 0;
`).then(() => {
  console.log('Migration successful');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
