const axios = require('axios');

async function testSave() {
  try {
    const res = await axios.post('http://localhost:5000/api/bills/save', {
      billData: {
        bill_type: 'restaurant',
        vendor_name: 'Test Restaurant',
        grand_total: 100,
        item_count: 1,
        metadata: { sgst: 2.5, cgst: 2.5 }
      },
      items: [
        {
          item_name: 'Burger',
          quantity: 1,
          unit_price: 100,
          line_total: 100
        }
      ]
    });
    console.log(res.data);
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}

testSave();
