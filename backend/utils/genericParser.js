/**
 * genericParser.js
 * Unified parser for multiple bill types supporting right-to-left line parsing.
 */

function parseGenericBill(rawText) {
    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line);
    const lowerRawText = rawText.toLowerCase();

    let vendor_name = '';
    let document_number = '';
    let bill_date = '';
    let items = [];
    let grand_total = 0;
    let sgst = 0;
    let cgst = 0;
    let igst = 0;
    let bill_type = 'retail'; // default

    // Detect bill type
    if (lowerRawText.includes('medical') || lowerRawText.includes('pharmacy') || lowerRawText.includes('medicine') || lowerRawText.includes('dr.')) {
        bill_type = 'medical';
    } else if (lowerRawText.includes('restaurant') || lowerRawText.includes('food') || lowerRawText.includes('menu') || lowerRawText.includes('dine')) {
        bill_type = 'restaurant';
    } else if (lowerRawText.includes('metro') || lowerRawText.includes('ticket')) {
        bill_type = 'metro';
    } else if (lowerRawText.includes('supermarket') || lowerRawText.includes('grocery') || lowerRawText.includes('retail')) {
        bill_type = 'retail';
    } else if (lowerRawText.includes('fuel') || lowerRawText.includes('petrol') || lowerRawText.includes('diesel') || lowerRawText.includes('pump')) {
        bill_type = 'fuel';
    } else if (lowerRawText.includes('hotel') || lowerRawText.includes('room') || lowerRawText.includes('stay')) {
        bill_type = 'hotel';
    }

    let parsingItems = false;
    let foundSubtotal = false;

    const isNumberToken = (token) => {
        const cleaned = token.replace(/[\$€£₹,]/g, '');
        return /^\d+(\.\d+)?$/.test(cleaned);
    };

    const parseAmount = (str) => parseFloat(str.replace(/[^0-9.]/g, '')) || 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lowerLine = line.toLowerCase();

        // 1. Vendor Name
        const vendorMatch = line.match(/(?:Vendor|Store Name|Medical Store Name|Restaurant Name|Pharmacy|Seller|Merchant|Company)\s*:\s*(.+)/i);
        if (vendorMatch && !vendor_name) {
            let vName = vendorMatch[1].trim();
            if (!/(medical store bill format|tax invoice|invoice format|bill format|receipt|sample bill)/i.test(vName)) {
                vendor_name = vName;
            }
        }

        // 2. Document Number
        const docMatch = line.match(/(?:Receipt No|Invoice No|Bill No|Ticket No)\.?\s*[:#-]?\s*(\S+)/i);
        if (docMatch && !document_number) {
            document_number = docMatch[1].trim();
        }

        // 3. Bill Date
        const dateMatch = line.match(/(?:Date|Bill Date|Invoice Date)\s*:\s*(.+)/i);
        if (dateMatch && !bill_date) {
            bill_date = dateMatch[1].trim();
        } else if (!bill_date && (lowerLine.startsWith('date') || lowerLine.includes('date:'))) {
            const dMatch = line.match(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b[A-Za-z]{3}\s\d{1,2},?\s\d{4}\b/);
            if (dMatch) {
                bill_date = dMatch[0];
            }
        }

        // 4. Stopping Condition for Items
        if (/(subtotal|sub total|tax\b|gst\b|cgst|sgst|igst|discount|grand total|total\b|payment|thank you|visit again)/i.test(line)) {
            foundSubtotal = true;
            if (lowerLine.includes('sgst')) {
                const amts = line.match(/\d+\.\d{2}/g);
                if (amts) sgst = parseFloat(amts[amts.length - 1]);
            }
            if (lowerLine.includes('cgst')) {
                const amts = line.match(/\d+\.\d{2}/g);
                if (amts) cgst = parseFloat(amts[amts.length - 1]);
            }
            if (lowerLine.includes('igst')) {
                const amts = line.match(/\d+\.\d{2}/g);
                if (amts) igst = parseFloat(amts[amts.length - 1]);
            }
            if (lowerLine.includes('total') && !lowerLine.includes('subtotal') && !lowerLine.includes('sub total')) {
                const amts = line.match(/\d+\.\d{2}/g);
                if (amts) grand_total = parseFloat(amts[amts.length - 1]);
            }
        }

        // 5. Begin Items Parsing
        if (!foundSubtotal && /(description|item|particular|product|qty|quantity|units|nos|pcs|amount|total|net amount|price|rate|unit price|mrp)/i.test(line)) {
            parsingItems = true;
            continue; // Skip header line
        }

        if (!foundSubtotal && parsingItems) {

            // Ignore obvious non-item lines
            if (/(address|ph:|phone|mob|receipt|customer|date|table|location|gstin|fssai|tin|email|www\.|payment|thank you|visit)/i.test(lowerLine)) {
                continue;
            }

            // A valid item should contain at least TWO decimal amounts
            // Example:
            // Coffee 20.00 40.00
            const moneyMatches = line.match(/\d+\.\d{2}/g);

            if (!moneyMatches || moneyMatches.length < 2) {
                continue;
            }

            const tokens = line.split(/\s+/);
            let numberTokens = [];

            for (let j = tokens.length - 1; j >= 0; j--) {
                if (isNumberToken(tokens[j])) {
                    numberTokens.push({ token: tokens[j], index: j });
                }
            }

            // Treat the first number in an item row as the serial number
            if (numberTokens.length > 0 && numberTokens[numberTokens.length - 1].index === 0) {
                numberTokens.pop(); // Remove the serial number from our number tokens
            }

            if (numberTokens.length >= 3) {
                // Found a valid item line with at least 1 number (price or amount)
                const line_total_str = numberTokens[0].token;
                let unit_price_str = line_total_str;
                let quantity_str = '1';
                let qtyIndex = -1;

                if (numberTokens.length >= 2) {
                    unit_price_str = numberTokens[1].token;
                }

                if (numberTokens.length >= 3) {
                    quantity_str = numberTokens[2].token;
                    qtyIndex = numberTokens[2].index;
                }

                let nameEndIndex = numberTokens.length > 0 ? numberTokens[numberTokens.length - 1].index : tokens.length;
                if (qtyIndex !== -1) nameEndIndex = qtyIndex;

                let nameStartIndex = isNumberToken(tokens[0]) ? 1 : 0;
                let nameTokens = tokens.slice(nameStartIndex, nameEndIndex);

                if (qtyIndex !== -1 && numberTokens.length >= 2 && numberTokens[1].index - qtyIndex > 1) {
                    const middleTokens = tokens.slice(qtyIndex + 1, numberTokens[1].index);
                    nameTokens = nameTokens.concat(middleTokens);
                }

                const item_name = nameTokens.join(' ').trim();

                // Make sure item_name is valid and not just numbers or symbols
                if (item_name && /[a-zA-Z]/.test(item_name) && item_name.length > 1) {
                    items.push({
                        item_name: item_name,
                        quantity: parseAmount(quantity_str),
                        unit_price: parseAmount(unit_price_str),
                        line_total: parseAmount(line_total_str),
                        item_code: "",
                        discount_amount: 0,
                        tax_percent: 0,
                        tax_amount: 0
                    });
                }
            } else if (items.length > 0) {
                // Continuation line logic
                const hasNumbers = /\d/.test(line);
                const continuationWords = /(capsules|tablets|syrup|ml|mg|pack|pcs|size|weight)\b/i.test(line);

                if (continuationWords || (!hasNumbers && tokens.length < 5 && line.length > 1 && /[a-zA-Z]/.test(line))) {
                    items[items.length - 1].item_name += " " + line;
                }
            }
        }
    }

    // Fallback Vendor Name: use the first line that isn't a decorative title or empty
    if (!vendor_name && lines.length > 0) {
        for (let line of lines) {
            if (!/(medical store bill format|tax invoice|invoice format|bill format|receipt|sample bill)/i.test(line)) {
                vendor_name = line.trim();
                break;
            }
        }
    }

    // Fallback Grand Total
    if (!grand_total) {
        const totalMatch = rawText.match(/Total\s*[:$]?\s*(\d+\.\d{2})/i);
        if (totalMatch) grand_total = parseFloat(totalMatch[1]);
    }

    return {
        bill_type,
        vendor_name,
        document_number,
        bill_date,
        items,
        item_count: items.length,
        grand_total,
        sgst,
        cgst,
        igst
    };
}

module.exports = {
    parseGenericBill
};

