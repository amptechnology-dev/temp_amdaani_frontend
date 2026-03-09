import { format } from 'date-fns';
import numberToWords from 'number-to-words';

export const generateInvoiceHTML = ({
  preview,
  createdInvoice,
  invoiceData,
  formValues,
  cartItems,
  invoiceCalculations,
  invoiceNumber,
  currentDate,
  currentTime,
  storedata,
  invoiceDate,
  isGstInvoice,
  isFreePlan = true,
  appBrand = { name: 'AMDAANI', logoUrl: '' },
  payment = { paid: 0, due: 0, status: 'unpaid' },
}) => {
  // Compute total values across all items
  // console.log('Generating invoice HTML with data:', { invoiceData, storedata });
  let totalQty = 0;
  let totalDiscount = 0;
  let totalTaxable = 0;
  let totalGST = 0;
  let totalAmount = 0;

  cartItems.forEach(item => {
    const qty = item.qty || item.quantity || 0;
    const baseRate = item.baseRate || 0;
    const gstRate = item.gstRate || 0;
    const gstAmount = item.gstAmount || 0;
    const isTaxInclusive = item.isTaxInclusive || false;
    const total = item.total || 0;
    let discount = item.discount * qty || 0;

    if (isTaxInclusive && gstRate > 0) {
      discount = discount / (1 + gstRate / 100);
    }

    totalQty += qty;
    totalDiscount += discount;
    totalTaxable += item.taxableValue || 0;
    totalGST += gstAmount;
    totalAmount += total;
  });

  const itemsHTML = cartItems
    .map((item, index) => {
      const qty = item.qty || item.quantity || 0;
      const price = item.price || 0;
      const baseRate = item.baseRate || 0;
      const taxableValue = item.taxableValue || 0;
      let discount = item.discount * qty || 0;
      const gstRate = item.gstRate || 0;
      const gstAmount = item.gstAmount || 0;
      const totalAmount = item.total || 0;
      const isTaxInclusive = item.isTaxInclusive || false;

      let perItemDiscount = Number(item.discount || 0);
      if (isTaxInclusive && gstRate > 0) {
        // Convert inclusive discount to base equivalent
        perItemDiscount = perItemDiscount / (1 + gstRate / 100);
      }

      // Total discount for quantity
      const totalDiscount = perItemDiscount * qty;

      // ✅ Calculate percentage using per-item base rate
      const discountPercent =
        baseRate > 0 && perItemDiscount > 0
          ? ((perItemDiscount / baseRate) * 100).toFixed(2)
          : null;
      return `
      <tr class="item-row">
        <td class="sr-no">${index + 1}</td>
        <td class="description">
          <div class="item-name">${item.name}</div>
          ${item.hsn ? `<div class="item-code">HSN: ${item.hsn}</div>` : ''}
        </td>
        <td class="qty">${qty}</td>
        <td class="unit">${item.unit || 'PCS'}</td>
        <td class="rate">₹${baseRate.toFixed(2)}</td>
      <td class="discount">
        ${
          totalDiscount > 0
            ? `₹${totalDiscount.toFixed(2)}${
                discountPercent ? ` (${discountPercent}%)` : ''
              }`
            : '₹0.00 (0.00%)'
        }
      </td>
      ${
        isGstInvoice
          ? `
        <td>₹${taxableValue.toFixed(2)}</td>
          <td class="gst-amount">₹${gstAmount.toFixed(2)} (${gstRate}%)</td>
        `
          : ''
      }
        <td class="total-amount">₹${totalAmount.toFixed(2)}</td>
      </tr>
    `;
    })
    .join('');

  let gstTotals = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
  let gstBreakdownHTML = '';

  // ✅ Detect IGST condition from payload
  const isIgst = invoiceData?.isIgst === true;

  for (const [rate, breakdown] of Object.entries(
    invoiceCalculations.gstBreakdown,
  )) {
    if (parseFloat(rate) === 0) continue;

    const taxable = breakdown.taxableAmount || 0;
    const cgst = isIgst ? 0 : breakdown.cgstAmount || 0;
    const sgst = isIgst ? 0 : breakdown.sgstAmount || 0;
    const igst = isIgst
      ? breakdown.igstAmount ||
        (breakdown.cgstAmount || 0) + (breakdown.sgstAmount || 0)
      : 0;

    gstBreakdownHTML += `
      <tr>
        <td>${rate}%</td>
        <td>₹${taxable.toFixed(2)}</td>
        <td>₹${cgst.toFixed(2)}</td>
        <td>₹${sgst.toFixed(2)}</td>
        <td>₹${igst.toFixed(2)}</td>
      </tr>
    `;

    gstTotals.taxableValue += taxable;
    gstTotals.cgst += cgst;
    gstTotals.sgst += sgst;
    gstTotals.igst += igst;
  }

  gstBreakdownHTML += `
    <tr style="font-weight:bold; background:#f8f8f8;">
      <td>Total</td>
      <td>₹${gstTotals.taxableValue.toFixed(2)}</td>
      <td>₹${gstTotals.cgst.toFixed(2)}</td>
      <td>₹${gstTotals.sgst.toFixed(2)}</td>
      <td>₹${gstTotals.igst.toFixed(2)}</td>
    </tr>
  `;

  // const gstTotalsRow = `
  //   <tr style="font-weight:bold; background:#f8f8f8;">
  //     <td>Total</td>
  //     <td>₹${gstTotals.taxableValue.toFixed(2)}</td>
  //     <td>₹${gstTotals.cgst.toFixed(2)}</td>
  //     <td>₹${gstTotals.sgst.toFixed(2)}</td>
  //     <td>₹${gstTotals.igst.toFixed(2)}</td>
  //   </tr>
  // `;

  const amountInWords =
    numberToWords
      .toWords(
        Math.round(
          invoiceCalculations.grandTotal -
            (invoiceCalculations?.discountTotal || 0),
        ).toFixed(2),
      )
      .replace(/\b\w/g, c => c.toUpperCase()) + ' Rupees Only';

  const hasCustomerDetails =
    formValues.contactNumber ||
    formValues.customerName ||
    formValues.customerAddress ||
    formValues.customerGstNumber;

  const hasBankDetails =
    storedata?.bankDetails &&
    (storedata.bankDetails.bankName ||
      storedata.bankDetails.accountNo ||
      storedata.bankDetails.ifsc ||
      storedata.bankDetails.branch ||
      storedata.bankDetails.upiId);

  // ✅ Calculate round-off (difference between raw total and rounded total)
  const roundedGrandTotal = Math.round(
    invoiceCalculations.grandTotal - (invoiceCalculations?.discountTotal || 0),
  );
  const rawGrandTotal =
    invoiceCalculations.grandTotal - (invoiceCalculations?.discountTotal || 0);
  const roundOffValue = (roundedGrandTotal - rawGrandTotal).toFixed(2);

  const upiString = `upi://pay?pa=${
    storedata.bankDetails.upiId
  }&pn=${encodeURIComponent(
    storedata?.name || 'Merchant',
  )}&am=${roundedGrandTotal}&cu=INR`;

  const qrURL = `https://quickchart.io/qr?text=${encodeURIComponent(
    upiString,
  )}`;

  // console.log('QR Code URL:', qrURL);

  const totalsRowCount =
    2 +
    (isGstInvoice ? 2 : 1) +
    ((invoiceCalculations?.discountTotal ?? 0) > 0 ? 1 : 0) +
    (roundOffValue ?? 0 > 0 ? 1 : 0);

  return /*html*/ `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=0.8, user-scalable=yes">
    <title>GST Invoice</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; font-size: 11px; line-height: 1.3; color: #000; background: #fff; padding: 8px; }
        .invoice-container { max-width: 800px; margin: 0 auto; border: 1px solid #000; background: #fff; }
        .invoice-header { text-align: center; padding: 12px; border-bottom: 1px solid #000; background: #f8f8f8; }
        .invoice-title { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
        .company-name { font-size: 16px; font-weight: bold; color: #2c5aa0; margin-bottom: 2px; }
        .company-details { font-size: 10px; color: #666; }
        .invoice-info { display: flex; border-bottom: 1px solid #000; }
        .invoice-info-left, .invoice-info-right { flex: 1; padding: 10px; }
        .invoice-info-left { border-right: 1px solid #000; }
        .info-row { display: flex; margin-bottom: 4px; }
        .info-label { min-width: 80px; font-weight: bold; }
        .customer-section { border-bottom: 1px solid #000; padding: 10px; }
        .customer-title { font-weight: bold; font-size: 12px; margin-bottom: 2px; color: #2c5aa0; }
        .items-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .items-table th { background: #2c5aa0; color: white; padding: 8px 4px; border: 1px solid #000; font-size: 9px; }
        .items-table td { padding: 6px 4px; border: 1px solid #000; text-align: center; }
        .totals-section { border-top: 2px solid #000; display: flex; }
        .amount-words { flex: 1; padding: 10px; border-right: 1px solid #000; }
        .words-text { font-size: 12px; font-weight: bold; color: #2c5aa0; }
        .totals-table-container { width: 300px; }
        .totals-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .totals-table td { padding: 6px 8px; border: 1px solid #000; }
        .totals-table .center-row td {
  text-align: center;
}
        .grand-total { background: #2c5aa0; color: white; font-size: 12px; font-weight: bold; text-align: center;  }
        .gst-breakdown { margin-top: 10px; border-top: 1px solid #000; }
        .gst-breakdown-title { padding: 8px; background: #f0f0f0; font-weight: bold; text-align: center; }
        .gst-table { width: 100%; border-collapse: collapse; font-size: 9px; }
        .gst-table th, .gst-table td { padding: 6px 8px; border: 1px solid #000; text-align: center; }
        .gst-table th { background: #2c5aa0; color: white; }
        .description {
  text-align: left !important;
  white-space: normal;       /* allow line breaks */
  word-break: break-word;    /* break long words if needed */
  overflow-wrap: anywhere;   /* modern fallback for wrapping */
}

.description .item-name,
.description .item-code,
.description .tax-type {
  text-align: left;
  display: block;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}
        .footer-section {
  display: flex;
  border-top: 1px solid #000;
  margin-top: 10px;
  min-height: 80px;
  justify-content: flex-end; /* pushes signature section to the right */
}

.terms-section {
  flex: 1;
  padding: 10px;
  border-right: 1px solid #000;
}

.signature-section {
  width: 220px;
  padding: 10px;
  text-align: center;
}

.signature-image {
  max-height: 40px;
  max-width: 100%;
  object-fit: contain; 
}
        .section-title { font-weight: bold; margin-bottom: 6px; font-size: 11px; color: #2c5aa0; }
        .signature-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 4px; font-size: 10px; font-weight: bold; }
        .tax-type { font-size: 9px; color: #666; }
        @media print { body { margin: 0; padding: 4px; } .invoice-container { border: 1px solid #000; } }
      </style>
      <style>
      :root {
  --brand: #2c5aa0;
  --ink: #000;
  --muted: #666;
}

/* Top brand strip (app branding) */
.brand-strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid #000;
  background: #f9fafc;
}
.brand-left {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #555;
}
.brand-app-logo {
  height: 14px;
  width: auto;
}

.header-grid {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 14px 16px;
  border-bottom: 1.5px solid #000;
  background: #ffffff;
  flex-wrap: wrap; /* makes it adapt on smaller widths */
  gap: 12px;
}

/* Left Section (Logo + Info) */
.header-left {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
  min-width: 220px;
}

.logo-wrap {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  flex-shrink: 0;
}
.company-logo {
  height: 60px;
  width: auto;
  max-width: 100px;
  object-fit: contain;
  margin-right: 8px;
}

/* Company text */
.company-block {
  display: flex;
  flex-direction: column;
  text-align: left;
  align-items: flex-start;
  flex: 1;
}
.company-name {
  font-size: 18px;
  font-weight: 800;
  color: var(--brand);
  margin-bottom: 2px;
  text-transform: uppercase;
}
.company-tagline {
  font-size: 10.5px;
  color: #555;
  margin-bottom: 4px;
  font-style: italic;
}
.company-details {
  font-size: 10px;
  color: #444;
  line-height: 1.4;
  white-space: normal !important;
  overflow-wrap: anywhere;
  word-break: break-word;
  text-align: left;
}

/* Right Section (Invoice Meta) */
.meta-block {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  justify-content: center;
  min-width: 180px;
}
.invoice-badge {
  font-weight: 700;
  font-size: 14px;
  padding: 6px 12px;
  border-radius: 6px;
  text-transform: uppercase;
  background: var(--brand);
  color: #fff;
  border: 1px solid #000;
  letter-spacing: 0.4px;
  text-align: center;
  margin-bottom: 4px;
}


.items-table td.rate,
.items-table td.discount,
.items-table td:nth-child(7), /* Taxable Value */
.items-table td.gst-amount,
.items-table td.total-amount {
  text-align: right !important;
}
.totals-table td.amount,
.items-table .totals-row .amount,
.items-table .grand-total-row .amount,
.items-table .summary-total-row td:not(.description):not(.sr-no) {
  text-align: right;
}
/* status shown below the main invoice badge when invoice is cancelled */
.invoice-status-badge {
  font-weight: 800;
  font-size: 12px;
  color: #e53935; /* red to indicate cancellation */
  background: transparent;
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.gst-breakdown-title {
  padding: 4px 0;
  font-size: 12px;
  text-align: center;
  color: #2c5aa0;
  background: #f0f4ff;
  border: 1px solid #000;
  border-bottom: none;
}

/* ===== Payment Status Badge (Bottom Section) ===== */
.payment-status-container {
  text-align: right;
  margin-top: 4px;
   margin-right: 8px;
}

.payment-status {
  display: inline-block;
  padding: 2px 14px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 8px;
  text-transform: capitalize;
   font-style: italic;
  letter-spacing: 0.5px;
  color: #fff;
}

.payment-status.paid {
  background-color: #43a047; /* green */
}

.payment-status.partial {
  background-color: #fb8c00; /* orange */
}

.payment-status.unpaid {
  background-color: #e53935; /* red */
}


.meta-table {
  border-collapse: collapse;
  font-size: 9.5px;
}
.meta-table td {
  padding: 3px 6px;
}
.meta-table td:first-child {
  font-weight: 600;
  color: #333;
}

@media (max-width: 600px) {
  .header-grid {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: nowrap;
    gap: 8px;
  }

  .header-left {
    flex-direction: row;
    align-items: center;
    flex: 1;
    min-width: 0;
  }

  .company-block {
    align-items: flex-start;
    text-align: left;
  }

  .meta-block {
    align-items: flex-end;
    text-align: right;
    justify-content: flex-start;
    min-width: fit-content;
  }

  .invoice-badge {
    font-size: 12px;
    padding: 4px 8px;
  }
  .terms-section{
    flex-direction: column;
    align-items: center;
  }
}


@media print {
        body { margin: 0; padding: 0; }

        /* Repeat header/footer for each page */
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }

        /* Avoid cutting important sections */
        .page-break { page-break-before: always; }
        .no-break { page-break-inside: avoid; }

        /* Optional: keep background color for header/footer */
        .brand-strip, .header-grid, .footer-section {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }

      /* ====== Page Number (Print Mode) ====== */
@media print {
  body {
    counter-reset: pageTotal;
  }

  @page {
    size: A4;
    margin: 6mm;
    counter-increment: page;
    @bottom-right {
      content: "Page " counter(page) " of " counter(pages);
      font-size: 10px;
      color: #444;
      font-family: Arial, sans-serif;
    }
  }

  /* ✅ Fallback for browsers that don't support @bottom-right (like Chrome) */
  .page-number {
    position: fixed;
    bottom: 8mm;
    right: 20mm;
    font-size: 10px;
    color: #444;
    font-family: Arial, sans-serif;
  }

  /* Only visible in print */
  .page-number::after {
    content: "Page " counter(page);
  }
}

/* ====== Final Totals Alignment (Professional Layout) ====== */
.items-table .totals-row td,
.items-table .grand-total-row td {
  border: 1px solid #000;
  font-size: 10px;
  padding: 6px 8px;
}

.amount-words-cell {
  font-size: 10px;
  background: #fafafa;
  color: #000;
}

.items-table .label {
  text-align: left;       /* ✅ label text left */
  font-weight: 600;
  background: #f8f8f8;
}

.items-table .amount {
  text-align: center;     /* ✅ values center */
  font-weight: 600;
}

.grand-total-row .label,
.grand-total-row .amount {
  background: #2c5aa0;
  color: #fff;
  font-weight: bold;
}

.no-break {
  page-break-inside: avoid;
}
.payment-row .label {
  font-weight: 600;
  background: #f8f8f8;
  text-align: left;
}

.payment-row .amount {
  text-align: right !important;
  font-weight: 600;
}


/* Anchor overlay to the table area */
.items-table-wrap {
  position: relative;
}

/* Overlay centered over table content */
.items-table-watermark {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 2;
}

/* Responsive diagonal text with clamped size */
.items-table-watermark .text {
  font-family: Arial, sans-serif;
  font-weight: 800;
  /* Scales with table width: min 36px, ideal 10vw, max 96px */
  font-size: clamp(36px, 10vw, 96px);
  letter-spacing: 0.5em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.08);   /* low opacity watermark */
  transform: rotate(-28deg);
  user-select: none;
  white-space: nowrap;
}

/* Fine-tune for very small phones */
@media (max-width: 380px) {
  .items-table-watermark .text {
    font-size: clamp(28px, 12vw, 72px);
    letter-spacing: 0.35em;
  }
}

/* Print-safe colors preserved */
@media print {
  .items-table-watermark .text {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}


    </style>
  </head>

  <body>
    <div class="invoice-container">
      <!-- ✅ Header and brand (repeats on every page) -->
      <table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr>
            <td>
              ${
                isFreePlan
                  ? `
              <div class="brand-strip">
                <div class="brand-left">
                  ${
                    appBrand?.logoUrl
                      ? `<img class="brand-app-logo" src="${
                          appBrand.logoUrl
                        }" alt="${
                          appBrand?.name || 'Brand'
                        }" onerror="this.style.display='none'">`
                      : ''
                  }
                  <span>Powered by ${appBrand?.name || 'AMDAANI'}</span>
                </div>
                <div></div>
              </div>`
                  : ''
              }
${
  preview
    ? ''
    : `
              <header class="header-grid">
                <div class="header-left">
                  ${
                    storedata?.logoUrl
                      ? `<div class="logo-wrap">
                    <img class="company-logo" src="${storedata.logoUrl}" alt="Logo" onerror="this.style.display='none'">
                  </div>`
                      : ''
                  }
                  <div class="company-block">
                    <div class="company-name">${
                      storedata?.name || 'YOUR COMPANY NAME'
                    }</div>
                    ${
                      storedata?.tagline
                        ? `<div class="company-tagline">${storedata.tagline}</div>`
                        : ''
                    }
                    <div class="company-details">
                      ${storedata?.address?.street || ''}<br>
                      ${storedata?.address?.city || ''} - ${
        storedata?.address?.postalCode || ''
      }<br>
                      ${storedata?.address?.state || ''}<br>
                      ${
                        isGstInvoice
                          ? `<strong>GSTIN:</strong> ${
                              storedata?.gstNumber || 'N/A'
                            }`
                          : ''
                      }
                    </div>
                  </div>
                </div>
                <div class="meta-block">
                  <div class="invoice-badge">${
                    isGstInvoice ? 'Tax Invoice' : 'Invoice'
                  }</div>
                </div>
              </header>`
} 

              <div class="invoice-info">
                ${
                  hasCustomerDetails
                    ? `
                <div class="invoice-info-right">
                  <div class="customer-title">Bill To:</div>
                  <div>Mobile: ${formValues.contactNumber || ''}</div>
                  ${
                    formValues.customerName || formValues.partyName
                      ? `<div>Name: ${
                          formValues.customerName || formValues.partyName
                        }</div>`
                      : ''
                  }
                  ${
                    formValues.customerAddress || formValues.address
                      ? `<div>Address: ${
                          formValues.customerAddress || formValues.address
                        }</div>`
                      : ''
                  }
                  ${
                    formValues.customerState || formValues.state
                      ? `<div>State: ${
                          formValues.customerState || formValues.state
                        }${
                          formValues.customerPostalCode ||
                          (formValues.postalCode &&
                            `, Pin: ${
                              formValues?.customerPostalCode ||
                              formValues?.postalCode
                            }`)
                        }</div>`
                      : ''
                  }
                  ${
                    formValues.customerGstNumber || formValues.gstNumber
                      ? `<div>GSTIN: ${
                          formValues.customerGstNumber || formValues.gstNumber
                        }</div>`
                      : ''
                  }
                </div>`
                    : ''
                }
                <div class="invoice-info-left">
                  <div class="info-row"><span class="info-label">Invoice No:</span><span>${invoiceNumber}</span></div>
                  <div class="info-row"><span class="info-label">Invoice Date:</span><span>${format(
                    invoiceDate,
                    'dd-MMM-yyyy',
                  )}</span></div>
                  <div class="info-row"><span class="info-label">Invoice Time:</span><span>${format(
                    invoiceDate,
                    'hh:mm a',
                  )}</span></div>
                </div>
              </div>
            </td>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>
            <div class="items-table-wrap">
  ${
    invoiceData?.status?.toLowerCase() === 'cancelled'
      ? `
    <div class="items-table-watermark">
      <div class="text">CANCELLED</div>
    </div>
  `
      : ''
  }
              <!-- ✅ Main content -->
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Sl. No.</th>
                    <th>Item Description</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Price/ Unit(₹)</th>
                    <th>Discount(₹)</th>
                    
                    ${
                      isGstInvoice
                        ? `<th>Taxable Value(₹)</th><th>GST(₹)</th>`
                        : ''
                    }
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>${itemsHTML}
                      <!-- ✅ Summary Totals Row -->
        <tr class="summary-total-row" style="font-weight:bold; background:#f8f8f8;">
    <td class="sr-no"></td>
    <td class="description" style="text-align:left;">Total</td>
    <td class="qty" style="text-align:center;">${totalQty}</td>
    <td class="unit"></td>
    <td class="rate"></td>
    <td class="discount">₹${totalDiscount.toFixed(2)}</td>
    
    ${
      isGstInvoice
        ? `<td>₹${totalTaxable.toFixed(
            2,
          )}</td><td class="gst-amount">₹${totalGST.toFixed(2)}</td>`
        : ''
    }
    <td class="total-amount">₹${totalAmount.toFixed(2)}</td>
  </tr>

      <tr class="totals-row no-break">
      <td colspan="${
        isGstInvoice ? 7 : 5
      }" rowspan="${totalsRowCount}" class="amount-words-cell" style="text-align:left; vertical-align:top; border-right:1px solid #000; padding:10px;">
        <div class="amount-words-title" style="font-weight:bold; color:#2c5aa0;">Amount in Words:</div>
        <div class="words-text" style="font-size:11px;">${amountInWords}</div>

        ${
          invoiceData?.transactions && invoiceData.transactions.length > 0
            ? `
  <div style="margin-top:15px;">
    <div style="font-weight:bold; color:#2c5aa0; padding: 4px 0; font-size: 12px; text-align: center; background: #f0f4ff;">Payment Summary</div>
    <table style="width:100%; border-collapse:collapse; font-size:10px;">
      <thead>
        <tr style="background-color:#f5f5f5;">
          <th style="border:1px solid #ddd; padding:6px; text-align:left;">Date</th>
          <th style="border:1px solid #ddd; padding:6px; text-align:right;">Amount</th>
          <th style="border:1px solid #ddd; padding:6px; text-align:center;">Payment Method</th>
        </tr>
      </thead>
      <tbody>
        ${invoiceData.transactions
          .map(
            transaction => `
          <tr>
            <td style="border:1px solid #ddd; padding:6px; text-align:left;">${format(
              new Date(transaction.createdAt),
              'dd-MMM-yyyy hh:mm a',
            )}</td>
            <td style="border:1px solid #ddd; padding:6px; text-align:right;">₹${transaction.amount.toFixed(
              2,
            )}</td>
            <td style="border:1px solid #ddd; padding:6px; text-align:center;">${transaction.paymentMethod.toUpperCase()}</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  </div>
`
            : ''
        }

      </td>

      <td class="label">Subtotal</td>
      <td class="amount">₹${
        createdInvoice
          ? invoiceData?.subTotal.toFixed(2)
          : invoiceCalculations.subtotal.toFixed(2)
      }</td>
      </tr>
      

    ${
      (invoiceCalculations?.discountTotal ?? 0) > 0
        ? `
<tr class="totals-row no-break">
  <td class="label">Extra Discount</td>
  <td class="amount" style="color:#e53935;">−₹${
    createdInvoice
      ? Number(invoiceData?.discountTotal).toFixed(2)
      : Number(invoiceCalculations.discountTotal).toFixed(2)
  }</td>
</tr>`
        : ''
    }

<!-- ✅ Round Off Row -->
${
  roundOffValue != 0
    ? `
<tr class="totals-row no-break">
  <td class="label">Round Off</td>
  <td class="amount" style="color:${
    roundOffValue < 0 ? '#e53935' : '#43a047'
  };">
    ${
      createdInvoice
        ? `${Number(invoiceData?.roundOff) >= 0 ? '+' : ''}${Number(
            invoiceData?.roundOff,
          ).toFixed(2)}`
        : `${roundOffValue < 0 ? '−' : '+'}₹${Math.abs(roundOffValue).toFixed(
            2,
          )}`
    }
  </td>
</tr>`
    : ''
}


<tr class="grand-total-row no-break">
  <td class="label">Net Total</td>
  <td class="amount">₹${
    createdInvoice
      ? Math.round(invoiceData?.grandTotal).toFixed(2)
      : Math.round(
          invoiceCalculations.grandTotal -
            (invoiceCalculations?.discountTotal || 0),
        ).toFixed(2)
  }</td>
</tr>

${
  payment.status !== 'paid' || payment.due > 0
    ? `<tr class="payment-row no-break">
  <td class="label">Paid Amount</td>
  <td class="amount">₹${payment.paid.toFixed(2)}</td>
</tr>

<tr class="payment-row no-break">
  <td class="label">Due Amount</td>
  <td class="amount" style="color:${payment.due > 0 ? '#e53935' : '#000'};">
    ₹${Math.round(payment.due).toFixed(2)}
  </td>
</tr>`
    : ''
}

                </tbody>
              </table>
              <!-- ✅ Payment Status Badge -->
<div class="payment-status-container">
  <span class="payment-status ${payment.status?.toLowerCase()}">
    ${
      payment.status === 'paid'
        ? 'Amount is Fully Paid'
        : payment.status === 'partial'
        ? 'Amount is Partially Paid'
        : 'Amount is Unpaid'
    }
  </span>
</div>

<!-- Payment Details -->
${
  invoiceData?.paymentMethod || invoiceData?.paymentNote
    ? `
  <div style="text-align: right; margin-top: 4px; margin-right: 8px; font-size: 9px; line-height: 1.6;">
    ${
      invoiceData.paymentMethod
        ? `
      <div style="margin-bottom: 4px;">
        <span style="color: #666;">Payment Method:</span>
        <span style="color: #000; font-weight: 600; margin-left: 6px;">${invoiceData.paymentMethod.toUpperCase()}</span>
      </div>
    `
        : ''
    }
    ${
      invoiceData.paymentNote
        ? `
      <div>
        <span style="color: #666;">Note:</span>
        <span style="color: #000; margin-left: 6px;">${invoiceData.paymentNote}</span>
      </div>
    `
        : ''
    }
  </div>
`
    : ''
}
            </div>
                           ${
                             !preview &&
                             Object.keys(invoiceCalculations.gstBreakdown).some(
                               r => parseFloat(r) > 0,
                             ) &&
                             isGstInvoice
                               ? `
              <div class="gst-breakdown">
              <div class="gst-breakdown-title">Tax Summary</div>
                <table class="gst-table">
                  <thead><tr><th>GST Rate</th><th>Taxable Value</th><th>CGST</th><th>SGST</th><th>IGST</th></tr></thead>
               <tbody>
  ${gstBreakdownHTML}
</tbody>

                </table>
              </div>`
                               : ''
                           }
            </td>
          </tr>
        </tbody>

        <!-- ✅ Footer repeats automatically -->
        ${
          preview
            ? ''
            : `
        <tfoot>
          <tr>
            <td>
              <div class="footer-section">
                ${
                  hasBankDetails
                    ? `
                    <div class="terms-section" 
                    style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">

                    <!-- LEFT SIDE: BANK DETAILS -->
                    <div>
                      <div class="section-title" style="font-weight:600; margin-bottom:4px;">Bank Details:</div>

                      ${
                        storedata.bankDetails.bankName
                          ? `Bank: ${storedata.bankDetails.bankName}<br>`
                          : ''
                      }
                      ${
                        storedata.bankDetails.accountNo
                          ? `A/C No: ${storedata.bankDetails.accountNo}<br>`
                          : ''
                      }
                      ${
                        storedata.bankDetails.ifsc
                          ? `IFSC: ${storedata.bankDetails.ifsc}<br>`
                          : ''
                      }
                      ${
                        storedata.bankDetails.upiId
                          ? `UPI: ${storedata.bankDetails.upiId}<br>`
                          : ''
                      }
                    </div>


                    <!-- RIGHT SIDE: QR CODE BOX -->
                    ${
                      storedata?.bankDetails?.upiId
                        ? `
                          <div style="text-align:center;">
                            <div style="font-weight:bold; font-size:12px; margin-bottom:4px;">Scan & Pay</div>

                            <img src="${qrURL}" width="70" height="70" />

                            <div style="font-size:10px; margin-top:4px;">
                              UPI ID: ${storedata.bankDetails.upiId}
                            </div>
                            <div style="font-size:10px;">
                              Amount: ₹${roundedGrandTotal}
                            </div>
                          </div>
                        `
                        : ''
                    }

                  </div>`
                    : ''
                }
                <div class="signature-section">
                  <div class="section-title">For ${
                    storedata?.name || 'YOUR COMPANY NAME'
                  }</div>
                  ${
                    storedata?.signatureUrl
                      ? `<img src="${storedata.signatureUrl}" class="signature-image"><br>`
                      : ''
                  }
                  <div class="signature-line">Authorized Signatory</div>
                </div>
              </div>
            </td>
          </tr>
        </tfoot>
        `
        }
      </table>
    </div>
    ${
      invoiceData?.remarks
        ? `
    <pre style="font-size: 8px; color: #666; margin-top: 8px;">Remarks : ${invoiceData.remarks}</pre>
  `
        : ''
    }
    ${
      preview
        ? ''
        : `${
            storedata?.settings?.invoiceTerms
              ? `
    <div style="font-size: 8px; color: #666; margin-top: 8px; padding-left: 10px; padding-right: 10px; text-align: left;">
      <div style="padding-left: 10px; font-size: 8px;">${storedata.settings.invoiceTerms}</div>
    </div>
  `
              : ''
          }`
    }
    </body>
  </html>`;
};
