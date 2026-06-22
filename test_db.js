const pool = require('./backend/db');
pool.query("SELECT * FROM bills WHERE bill_type = 'restaurant'")
  .then(res => {
    console.log("Restaurant bills:", res.rows);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
