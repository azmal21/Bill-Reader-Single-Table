/**
 * test_gst_parser.js
 * Unit test for validating the gstParser extraction logic.
 */

const { parseGSTInvoice } = require('./utils/gstParser');

const mockOcrText = `
ABC RETAIL PRIVATE LIMITED
123, MALL ROAD, SECTOR 5, GURUGRAM, HARYANA - 122001
GSTIN: 06ABCDE1234F1Z5
FSSAI LIC NO: 10019064001234
TAX INVOICE
Invoice No: GST-2026-9874
Order No: ORD-88719
Date: 15/06/2026
Place of Supply: Haryana

Bill To:
Customer: John Doe Enterprise
Address: 456, Business Park, Phase 3, Gurugram, Haryana - 122002
GSTIN: 06XYZDE9876R1Z9

Ship To:
Customer: John Doe Warehouse
Address: Plot 99, Industrial Area, Sector 2, Manesar, Haryana - 122050

--------------------------------------------------------------
Description of Goods  | HSN    | Qty | Rate  | Disc% | Taxable | CGST% | CGST Amt | SGST% | SGST Amt | Total
--------------------------------------------------------------
1 CADBURY DAIRY MILK   | 190190 | 10  | 50.00 | 10.0  | 450.00  | 9.0   | 40.50    | 9.0   | 40.50    | 531.00
2 TATA SALT 1KG        | 250100 | 5   | 20.00 | 0.0   | 100.00  | 2.5   | 2.50     | 2.5   | 2.50     | 105.00
3 FORTUNE MUSTARD OIL  | 150790 | 2   | 150.0 | 5.0   | 285.00  | 2.5   | 7.13     | 2.5   | 7.13     | 299.25
  Refined 1 Litre Pack
--------------------------------------------------------------
Total Quantity: 17
Grand Total: INR 935.25
`;

console.log("Running GST Parser Test...");
const parsed = parseGSTInvoice(mockOcrText);

console.log("\n=== VERIFICATION ===");
console.log("Seller GSTIN:", parsed.seller_information.gstin);
console.log("Invoice No:", parsed.invoice_information.invoice_number);
console.log("Items count:", parsed.items.length);
console.log("Grand Total:", parsed.summary.grand_total);

if (parsed.seller_information.gstin === '06ABCDE1234F1Z5' && 
    parsed.invoice_information.invoice_number === 'GST-2026-9874' && 
    parsed.items.length === 3 &&
    parsed.summary.grand_total === 935.25) {
  console.log("\n✅ ALL PARSER TESTS PASSED SUCCESSFULLY!");
} else {
  console.error("\n❌ PARSER TEST FAILED!");
  process.exit(1);
}
