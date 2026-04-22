import { format } from 'date-fns';
import numberToWords from 'number-to-words';

const safe = v => Number(v || 0).toFixed(2);

export const generatePurchaseHTML = ({
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
  let totalQty = 0;
  let totalDiscount = 0;
  let totalTaxable = 0;
  let totalGST = 0;
  let totalAmount = 0;

  cartItems.forEach(item => {
    const qty = item.qty || item.quantity || 0;
    const gstRate = item.gstRate || 0;
    const gstAmount = item.gstAmount || 0;
    const isTaxInclusive =
      item.isPurchaseTaxInclusive || item.isTaxInclusive || false;
    const total = item.total || 0;
    let discount = item.discount * qty || 0;

    if (isTaxInclusive && gstRate > 0) {
      discount = discount / (1 + gstRate / 100);
    }

    totalQty += qty;
    totalDiscount += discount;
    totalTaxable += item.taxableValue || 0;
    totalGST += isTaxInclusive ? 0 : gstAmount;
    totalAmount += total;
  });

  const itemsHTML = cartItems
    .map((item, index) => {
      const qty = item.qty || item.quantity || 0;
      const price = item.price || 0;
      const baseRate = item.baseRate || 0;
      const taxableValue = item.taxableValue || 0;
      const gstRate = item.gstRate || 0;
      const gstAmount = item.gstAmount || 0;
      const totalAmount = item.total || 0;
      const isTaxInclusive =
        item.isPurchaseTaxInclusive || item.isTaxInclusive || false;

      const mrp = isTaxInclusive
        ? price
        : baseRate + baseRate * (gstRate / 100);

      let perItemDiscount = Number(item.discount || 0);
      if (isTaxInclusive && gstRate > 0) {
        perItemDiscount = perItemDiscount / (1 + gstRate / 100);
      }
      const totalDiscountAmt = perItemDiscount * qty;
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
          ${
            isTaxInclusive && gstRate > 0
              ? `<div class="tax-type">(Tax Incl.)</div>`
              : gstRate > 0
              ? `<div class="tax-type">(Tax Excl.)</div>`
              : ''
          }
        </td>
        <td class="qty">${qty}</td>
        <td class="unit">${item.unit || 'PCS'}</td>
        <td class="rate">₹${baseRate.toFixed(2)}</td>
        <td class="mrp">₹${mrp.toFixed(2)}</td>
        <td class="discount">
          ${
            totalDiscountAmt > 0
              ? `₹${totalDiscountAmt.toFixed(2)}${
                  discountPercent ? ` (${discountPercent}%)` : ''
                }`
              : '₹0.00 (0.00%)'
          }
        </td>
        <td style="text-align:right;">₹${taxableValue.toFixed(2)}</td>
        <td class="gst-amount" style="text-align:right;">
          ${
            gstRate > 0
              ? isTaxInclusive
                ? `<span style="color:#888;">₹${gstAmount.toFixed(
                    2,
                  )} (${gstRate}%)<br><small>[Incl.]</small></span>`
                : `₹${gstAmount.toFixed(
                    2,
                  )} (${gstRate}%)<br><small>[Added]</small>`
              : `—`
          }
        </td>
        <td class="total-amount">₹${totalAmount.toFixed(2)}</td>
      </tr>
    `;
    })
    .join('');

  let gstTotals = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
  let gstBreakdownHTML = '';
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

  const rawGrandTotal =
    invoiceCalculations.grandTotal - (invoiceCalculations?.discountTotal || 0);
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOffValue = (roundedGrandTotal - rawGrandTotal).toFixed(2);

  // sr + desc + qty + unit + rate + mrp + discount + taxable + gst = 9 cols, last 2 are label+amount
  const colspanCount = 8;

  const totalsRowCount =
    2 + // subtotal + total tax
    1 + // net total
    ((invoiceCalculations?.discountTotal ?? 0) > 0 ? 1 : 0) +
    (Number(roundOffValue) !== 0 ? 1 : 0) +
    (payment.status !== 'paid' || payment.due > 0 ? 2 : 0);

  return /*html*/ `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=0.8, user-scalable=yes">
    <title>Purchase Invoice</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Arial', sans-serif; font-size: 11px; line-height: 1.3; color: #000; background: #fff; padding: 8px; }
      .invoice-container { max-width: 800px; margin: 0 auto; border: 1px solid #000; background: #fff; }
      .invoice-info { display: flex; border-bottom: 1px solid #000; }
      .invoice-info-left, .invoice-info-right { flex: 1; padding: 10px; }
      .invoice-info-left { border-right: 1px solid #000; }
      .info-row { display: flex; margin-bottom: 4px; }
      .info-label { min-width: 80px; font-weight: bold; }
      .customer-title { font-weight: bold; font-size: 12px; margin-bottom: 2px; color: #2c5aa0; }
      .items-table { width: 100%; border-collapse: collapse; font-size: 10px; }
      .items-table th { background: #2c5aa0; color: white; padding: 8px 4px; border: 1px solid #000; font-size: 9px; }
      .items-table td { padding: 6px 4px; border: 1px solid #000; text-align: center; }
      .gst-breakdown { margin-top: 10px; border-top: 1px solid #000; }
      .gst-table { width: 100%; border-collapse: collapse; font-size: 9px; }
      .gst-table th, .gst-table td { padding: 6px 8px; border: 1px solid #000; text-align: center; }
      .gst-table th { background: #2c5aa0; color: white; }
      .description { text-align: left !important; white-space: normal; word-break: break-word; overflow-wrap: anywhere; }
      .description .item-name, .description .item-code, .description .tax-type { text-align: left; display: block; white-space: normal; word-break: break-word; }
      .tax-type { font-size: 9px; color: #666; }
      .footer-section { display: flex; border-top: 1px solid #000; margin-top: 10px; min-height: 80px; justify-content: flex-end; }
      .terms-section { flex: 1; padding: 10px; border-right: 1px solid #000; }
      .signature-section { width: 220px; padding: 10px; text-align: center; }
      .signature-image { max-height: 40px; max-width: 100%; object-fit: contain; }
      .section-title { font-weight: bold; margin-bottom: 6px; font-size: 11px; color: #2c5aa0; }
      .signature-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 4px; font-size: 10px; font-weight: bold; }
      .items-table td.rate, .items-table td.mrp, .items-table td.discount,
      .items-table td.gst-amount, .items-table td.total-amount { text-align: right !important; }
      :root { --brand: #2c5aa0; }
      .brand-strip { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-bottom: 1px solid #000; background: #f9fafc; }
      .brand-left { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #555; }
      .brand-app-logo { height: 14px; width: auto; }
      .header-grid { display: flex; justify-content: space-between; align-items: flex-start; padding: 14px 16px; border-bottom: 1.5px solid #000; background: #ffffff; flex-wrap: wrap; gap: 12px; }
      .header-left { display: flex; flex-direction: row; align-items: flex-start; gap: 10px; flex: 1; min-width: 220px; }
      .logo-wrap { display: flex; align-items: flex-start; justify-content: center; flex-shrink: 0; }
      .company-logo { height: 60px; width: auto; max-width: 100px; object-fit: contain; margin-right: 8px; }
      .company-block { display: flex; flex-direction: column; text-align: left; align-items: flex-start; flex: 1; }
      .company-name { font-size: 18px; font-weight: 800; color: var(--brand); margin-bottom: 2px; text-transform: uppercase; }
      .company-tagline { font-size: 10.5px; color: #555; margin-bottom: 4px; font-style: italic; }
      .company-details { font-size: 10px; color: #444; line-height: 1.4; white-space: normal !important; overflow-wrap: anywhere; word-break: break-word; text-align: left; }
      .meta-block { display: flex; flex-direction: column; align-items: flex-end; text-align: right; justify-content: center; min-width: 180px; }
      .invoice-badge { font-weight: 700; font-size: 14px; padding: 6px 12px; border-radius: 6px; text-transform: uppercase; background: var(--brand); color: #fff; border: 1px solid #000; letter-spacing: 0.4px; text-align: center; margin-bottom: 4px; }
      .gst-breakdown-title { padding: 4px 0; font-size: 12px; text-align: center; color: #2c5aa0; background: #f0f4ff; border: 1px solid #000; border-bottom: none; }
      .payment-status-container { text-align: right; margin-top: 4px; margin-right: 8px; }
      .payment-status { display: inline-block; padding: 2px 14px; border-radius: 20px; font-weight: 600; font-size: 8px; text-transform: capitalize; font-style: italic; letter-spacing: 0.5px; color: #fff; }
      .payment-status.paid { background-color: #43a047; }
      .payment-status.partial { background-color: #fb8c00; }
      .payment-status.unpaid { background-color: #e53935; }
      .items-table .totals-row td, .items-table .grand-total-row td { border: 1px solid #000; font-size: 10px; padding: 6px 8px; }
      .amount-words-cell { font-size: 10px; background: #fafafa; color: #000; }
      .items-table .label { text-align: left; font-weight: 600; background: #f8f8f8; }
      .items-table .amount { text-align: right; font-weight: 600; }
      .grand-total-row .label, .grand-total-row .amount { background: #2c5aa0; color: #fff; font-weight: bold; }
      .no-break { page-break-inside: avoid; }
      .payment-row .label { font-weight: 600; background: #f8f8f8; text-align: left; }
      .payment-row .amount { text-align: right !important; font-weight: 600; }
      .items-table-wrap { position: relative; }
      .items-table-watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 2; }
      .items-table-watermark .text { font-family: Arial, sans-serif; font-weight: 800; font-size: clamp(36px, 10vw, 96px); letter-spacing: 0.5em; text-transform: uppercase; color: rgba(0,0,0,0.08); transform: rotate(-28deg); user-select: none; white-space: nowrap; }
      @media (max-width: 380px) { .items-table-watermark .text { font-size: clamp(28px, 12vw, 72px); letter-spacing: 0.35em; } }
      @media print {
        body { margin: 0; padding: 0; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        .page-break { page-break-before: always; }
        .no-break { page-break-inside: avoid; }
        .brand-strip, .header-grid, .footer-section { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        @page { size: A4; margin: 6mm; }
      }
    </style>
  </head>
  <body>
    <div class="invoice-container">
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

              
              <div class="invoice-info">
                ${
                  hasCustomerDetails
                    ? `
                <div class="invoice-info-right">
                  <div class="customer-title">Vendor Details:</div>
                  ${
                    formValues.contactNumber
                      ? `<div>Mobile: ${formValues.contactNumber}</div>`
                      : ''
                  }
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
                          formValues.customerPostalCode
                            ? `, Pin: ${formValues.customerPostalCode}`
                            : ''
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
                  <div class="info-row"><span class="info-label">Purchase No:</span><span>${invoiceNumber}</span></div>
                  <div class="info-row"><span class="info-label">Purchase Date:</span><span>${format(
                    invoiceDate,
                    'dd-MMM-yyyy',
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
                <div class="items-table-watermark"><div class="text">CANCELLED</div></div>`
                    : ''
                }

                <table class="items-table">
                  <thead>
                    <tr>
                      <th>Sl. No.</th>
                      <th>Item Description</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Price/Unit(₹)</th>
                      <th>MRP(₹)</th>
                      <th>Discount(₹)</th>
                      <th>Taxable Value(₹)</th>
                      <th>GST Amt.(%)</th>
                      <th>Amount(₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHTML}

                    <!-- Summary Totals Row -->
                    <tr class="summary-total-row" style="font-weight:bold; background:#f8f8f8;">
                      <td></td>
                      <td style="text-align:left;">Total</td>
                      <td>${totalQty}</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td class="discount">₹${totalDiscount.toFixed(2)}</td>
                      <td>₹${totalTaxable.toFixed(2)}</td>
                      <td class="gst-amount">₹${totalGST.toFixed(2)}</td>
                      <td class="total-amount">₹${totalAmount.toFixed(2)}</td>
                    </tr>

                    <!-- Amount in Words + Totals -->
                    <tr class="totals-row no-break">
                      <td colspan="${colspanCount}" rowspan="${totalsRowCount}"
                        class="amount-words-cell"
                        style="text-align:left; vertical-align:top; border-right:1px solid #000; padding:10px;">
                        <div style="font-weight:bold; color:#2c5aa0;">Amount in Words:</div>
                        <div style="font-size:11px; font-weight:bold; color:#2c5aa0; margin-top:2px;">${amountInWords}</div>

                        ${
                          invoiceData?.transactions &&
                          invoiceData.transactions.length > 0
                            ? `
                        <div style="margin-top:15px;">
                          <div style="font-weight:bold; color:#2c5aa0; padding:4px 0; font-size:12px; text-align:center; background:#f0f4ff;">Payment Summary</div>
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
                              </tr>`,
                                )
                                .join('')}
                            </tbody>
                          </table>
                        </div>`
                            : ''
                        }
                      </td>
                      <td class="label">Subtotal</td>
                      <td class="amount">₹${
                        createdInvoice
                          ? Number(invoiceData?.subTotal).toFixed(2)
                          : invoiceCalculations.subtotal.toFixed(2)
                      }</td>
                    </tr>

                    <!-- Total Tax — always shown -->
                    <tr class="totals-row no-break">
                      <td class="label">Total Tax</td>
                      <td class="amount">₹${Number(totalGST).toFixed(2)}</td>
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

                    ${
                      Number(roundOffValue) !== 0
                        ? `
                    <tr class="totals-row no-break">
                      <td class="label">Round Off</td>
                      <td class="amount" style="color:${
                        Number(roundOffValue) < 0 ? '#e53935' : '#43a047'
                      };">
                        ${
                          createdInvoice
                            ? `${
                                Number(invoiceData?.roundOff) >= 0 ? '+' : ''
                              }${Number(invoiceData?.roundOff).toFixed(2)}`
                            : `${
                                Number(roundOffValue) < 0 ? '−' : '+'
                              }₹${Math.abs(Number(roundOffValue)).toFixed(2)}`
                        }
                      </td>
                    </tr>`
                        : ''
                    }

                    <tr class="grand-total-row no-break">
                      <td class="label">Net Total</td>
                      <td class="amount">₹${
                        createdInvoice
                          ? Number(invoiceData?.grandTotal).toFixed(2)
                          : Number(rawGrandTotal).toFixed(2)
                      }</td>
                    </tr>

                    ${
                      payment.status !== 'paid' || payment.due > 0
                        ? `
                    <tr class="payment-row no-break">
                      <td class="label">Paid Amount</td>
                      <td class="amount">₹${payment.paid.toFixed(2)}</td>
                    </tr>
                    <tr class="payment-row no-break">
                      <td class="label">Due Amount</td>
                      <td class="amount" style="color:${
                        payment.due > 0 ? '#e53935' : '#000'
                      };">₹${payment.due.toFixed(2)}</td>
                    </tr>`
                        : ''
                    }
                  </tbody>
                </table>

                <!-- Payment Status Badge -->
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

                ${
                  invoiceData?.paymentMethod || invoiceData?.paymentNote
                    ? `
                <div style="text-align:right; margin-top:4px; margin-right:8px; font-size:9px; line-height:1.6;">
                  ${
                    invoiceData.paymentMethod
                      ? `
                  <div style="margin-bottom:4px;">
                    <span style="color:#666;">Payment Method:</span>
                    <span style="color:#000; font-weight:600; margin-left:6px;">${invoiceData.paymentMethod.toUpperCase()}</span>
                  </div>`
                      : ''
                  }
                  ${
                    invoiceData.paymentNote
                      ? `
                  <div>
                    <span style="color:#666;">Note:</span>
                    <span style="color:#000; margin-left:6px;">${invoiceData.paymentNote}</span>
                  </div>`
                      : ''
                  }
                </div>`
                    : ''
                }
              </div>

              <!-- GST breakdown — always shown if any item has GST -->
              ${
                !preview &&
                Object.keys(invoiceCalculations.gstBreakdown).some(
                  r => parseFloat(r) > 0,
                )
                  ? `
              <div class="gst-breakdown">
                <div class="gst-breakdown-title">Tax Summary</div>
                <table class="gst-table">
                  <thead>
                    <tr>
                      <th>GST Rate</th>
                      <th>Taxable Value</th>
                      <th>CGST</th>
                      <th>SGST</th>
                      <th>IGST</th>
                    </tr>
                  </thead>
                  <tbody>${gstBreakdownHTML}</tbody>
                </table>
              </div>`
                  : ''
              }
            </td>
          </tr>
        </tbody>

        
      </table>
    </div>

   
  </body>
  </html>`;
};
