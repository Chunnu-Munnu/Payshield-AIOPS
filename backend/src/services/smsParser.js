// FILE: smsParser.js
// ROLE: Parse Indian bank SMS transaction alerts to structured data
// INSPIRED BY: RBI mandate for real-time SMS alerts on all digital transactions
// PERFORMANCE TARGET: < 5ms per SMS

function parseIndianBankSMS(body, sender) {
  if (!body) return { isPaymentSMS: false };

  const isDebit = /debited|debit|sent|paid|withdrawn/i.test(body);
  const isCredit = /credited|credit|received|deposited/i.test(body);
  const hasAmt = /(?:inr|rs\.?|₹)\s*[\d,]+/i.test(body);
  if (!hasAmt) return { isPaymentSMS: false };

  const amtMatch = body.match(/(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, "")) : 0;
  const vpaMatch = body.match(/(?:VPA|UPI ID|to VPA|from VPA)[.\s:]*([a-zA-Z0-9._-]+@[a-zA-Z]+)/i);
  const upiId = vpaMatch ? vpaMatch[1] : null;
  const utrMatch = body.match(/(?:UPI Ref|UTR|Ref No|Reference)[.\s#:]*([A-Z0-9]{10,20})/i);
  const utrNumber = utrMatch ? utrMatch[1] : null;
  const acctMatch = body.match(/(?:A\/c|Acct?|account)\s*(?:XX|x+)?(\d{4,6})/i);
  const accountRef = acctMatch ? `XX${acctMatch[1]}` : null;

  let merchant = "Bank Transfer";
  if (upiId) {
    const name = upiId.split("@")[0].toLowerCase();
    const merchantMap = {
      swiggy: "Swiggy",
      zomato: "Zomato",
      paytm: "Paytm",
      phonepe: "PhonePe",
      amazonpay: "Amazon Pay",
      flipkart: "Flipkart",
      gpay: "Google Pay",
      blinkit: "Blinkit",
      zepto: "Zepto",
      irctc: "IRCTC",
      ola: "Ola Cabs",
      uber: "Uber India",
    };
    for (const [key, value] of Object.entries(merchantMap)) {
      if (name.includes(key)) {
        merchant = value;
        break;
      }
    }
    if (merchant === "Bank Transfer") merchant = name.slice(0, 20);
  }

  let paymentMethod = "Bank Transfer";
  if (/upi/i.test(body)) paymentMethod = "UPI";
  if (/neft/i.test(body)) paymentMethod = "NEFT";
  if (/imps/i.test(body)) paymentMethod = "IMPS";
  if (/rtgs/i.test(body)) paymentMethod = "RTGS";
  if (/card/i.test(body)) paymentMethod = "Card";

  const banks = {
    HDFCBK: "HDFC Bank",
    ICICIB: "ICICI Bank",
    SBIPSG: "SBI",
    AXISBK: "Axis Bank",
    KOTAKB: "Kotak Bank",
    YESBNK: "Yes Bank",
    INDBNK: "Indian Bank",
    PNBSMS: "PNB",
  };

  return {
    isPaymentSMS: true,
    isDebit,
    isCredit,
    amount,
    currency: "INR",
    upiId,
    utrNumber,
    accountRef,
    merchant,
    paymentMethod,
    bankName: banks[sender] || sender || "Your Bank",
    rawSMS: body,
    description: `${isDebit ? "₹" + amount.toLocaleString("en-IN") + " debited" : "₹" + amount.toLocaleString("en-IN") + " credited"} via ${paymentMethod}`,
  };
}

module.exports = { parseIndianBankSMS };
