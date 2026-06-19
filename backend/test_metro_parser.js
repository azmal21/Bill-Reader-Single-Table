/**
 * test_metro_parser.js
 * Run: node test_metro_parser.js
 */

const { parseMetroInvoice } = require("./utils/metroParser");

// ── Simulated OCR text (30 items) ─────────────────────────────
const sampleOCR = `
METRO Cash and Carry India Private Limited
GSTIN: 29AACCM4826M1ZR   PAN: AACCM4826M
Tax Invoice No: TOSN10826508458   Date: 10/05/2026
Bill To:
INVOICE RETAIL PRIVATE LIMITED
Customer Code: 100001007182416
State: KARNATAKA
Article Code Article Name HSN Code Qty Pack Net Disc. Taxable Tax% Tax Total
8901063032892 SUNFEAST BISCUIT 200G                 19053100   24   24   1440.00  -144.00  1296.00  5.00  64.80   1360.80
581038311     METRO BREAD WHITE 400G                19051000   12   12    576.00   -57.60   518.40  5.00  25.92    544.32
581040661     METRO WHEAT ATTA 5KG                  11010000   10   10   1250.00  -125.00  1125.00  5.00  56.25   1181.25
581040690     METRO MAIDA 1KG                       11010000   20   20    600.00   -60.00   540.00  5.00  27.00    567.00
8901491100017 BRITANNIA TIGER BISCUIT 100G          19053100   48   48    960.00   -96.00   864.00 12.00 103.68    967.68
8901519102018 PARLE-G BISCUITS 200G                 19053100   36   36    720.00   -72.00   648.00 12.00  77.76    725.76
8906002060094 PRIYA CHILLI PICKLE 400G              20019000    6    6    570.00   -57.00   513.00 12.00  61.56    574.56
8901499003092 HALDIRAM BHUJIA 400G                  21069099   12   12    780.00   -78.00   702.00 12.00  84.24    786.24
8902080005150 CORNITOS NACHO CHIPS 150G             19042000   24   24    672.00   -67.20   604.80 12.00  72.58    677.38
8901058851107 KURKURE MASALA MUNCH 90G              19042000   48   48    960.00   -96.00   864.00 12.00 103.68    967.68
8901058026044 LAYS MAGIC MASALA 52G                 19042000   36   36    756.00   -75.60   680.40 12.00  81.65    762.05
8901491500084 BRITANNIA GOOD DAY 200G               19053100   24   24    720.00   -72.00   648.00 12.00  77.76    725.76
8904028300015 AMUL BUTTER UNSALTED 500G             04059000    6    6    930.00   -93.00   837.00 12.00 100.44    937.44
8901233000154 AMUL CHEESE SLICES 200G               04063000   12   12   1320.00  -132.00  1188.00 12.00 142.56   1330.56
8901058007166 TROPICANA APPLE JUICE 1L              20098900   12   12    900.00   -90.00   810.00 12.00  97.20    907.20
8901320065100 REAL FRUIT JUICE MANGO 1L             20098900   12   12    840.00   -84.00   756.00 12.00  90.72    846.72
8901491101601 MARIE BISCUIT 200G                    19053100   36   36    720.00   -72.00   648.00 12.00  77.76    725.76
8904109100025 TOO YUMM MULTIGRAIN CHIPS 35G         19042000   48   48    576.00   -57.60   518.40 12.00  62.21    580.61
8901058022015 QUAKER OATS 500G                      11041900   24   24   1200.00  -120.00  1080.00  5.00  54.00   1134.00
8906006220091 PRIYA TOMATO RICE MIX 50G             21069099   36   36    504.00   -50.40   453.60 12.00  54.43    508.03
8901063023173 SUNFEAST DARK FANTASY 75G             19053100   48   48   1680.00  -168.00  1512.00 12.00 181.44   1693.44
8902080004528 CORNITOS NACHO CHIPS 60G              19042000   48   48    672.00   -67.20   604.80 12.00  72.58    677.38
8904028100022 AMUL GOLD MILK 1L TETRAPACK           04011000   12   12    720.00   -72.00   648.00  5.00  32.40    680.40
8901058017012 DORITOS NACHO CHEESE 73G              19042000   24   24    792.00   -79.20   712.80 18.00 128.30    841.10
8906002020081 PRIYA GONGURA PASTE 200G              21039099   12   12    420.00   -42.00   378.00 12.00  45.36    423.36
8901058001539 FRITOS CORN CHIPS 100G                19042000   36   36    720.00   -72.00   648.00 18.00 116.64    764.64
8904028900002 AMUL LASSI 200ML                      22029900   24   24    480.00   -48.00   432.00 12.00  51.84    483.84
581038115     3 ROSES DUST3.6GPK50 09021010 5 5 416.52
581038115     3 ROSES DUST3.6GPK50 09021010 406.96
581038115     BRIT JIMJAM SNDW13EG 19053100 40 40
`;

// ── Run the parser ────────────────────────────────────────────
const result = parseMetroInvoice(sampleOCR);

console.log("\n=================== PARSE RESULT ===================");
console.log("Invoice Number :", result.invoice.invoice_number);
console.log("Invoice Date   :", result.invoice.invoice_date);
console.log("Customer Name  :", result.invoice.customer_name);
console.log("Grand Total    :", result.invoice.grand_total);
console.log("Items Parsed   :", result.items.length);
console.log("Validation Err :", result.validation_errors);
console.log("=====================================================");

if (result.items.length < 20) {
  console.warn(`\n⚠️  Only ${result.items.length}/30 items parsed. Check logic.\n`);
} else {
  console.log(`\n✅ ${result.items.length}/30 items parsed successfully!\n`);
  console.log("Sample parsed item structure:\n", JSON.stringify(result.items[result.items.length - 3], null, 2));
  console.log("Sample parsed item structure (shifted):\n", JSON.stringify(result.items[result.items.length - 2], null, 2));
  console.log("Sample parsed item structure (no amounts):\n", JSON.stringify(result.items[result.items.length - 1], null, 2));
}
