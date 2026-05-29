import { format } from 'date-fns';
import numberToWords from 'number-to-words';

/**
 * Half A4 in landscape — same as cutting A4 (210×297 mm) along the long edge:
 * each half is 210 mm wide × 148.5 mm tall (√2:1 width:height).
 */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A5_WIDTH_MM = A4_WIDTH_MM;
const A5_HEIGHT_MM = A4_HEIGHT_MM / 2; // 148.5 mm

export const generateA5InvoiceHTML = ({
  preview,
  createdInvoice,
  invoiceData,
  formValues,
  cartItems,
  invoiceCalculations,
  invoiceNumber,
  storedata,
  invoiceDate,
  isGstInvoice,
  isFreePlan = true,
  appBrand = { name: 'AMDAANI', logoUrl: '' },
  payment = { paid: 0, due: 0, status: 'unpaid' },
}) => {
  // ── Totals ──────────────────────────────────────────────────────────────────
  let totalQty = 0;
  let totalDiscount = 0;
  let totalTaxable = 0;
  let totalGST = 0;
  let totalAmount = 0;

  cartItems.forEach(item => {
    const qty = item.qty || item.quantity || 0;
    const gstRate = item.gstRate || 0;
    const isTaxInclusive = item.isTaxInclusive || false;
    let discount = (item.discount || 0) * qty;
    if (isTaxInclusive && gstRate > 0)
      discount = discount / (1 + gstRate / 100);

    totalQty += qty;
    totalDiscount += discount;
    totalTaxable += item.taxableValue || 0;
    totalGST += item.gstAmount || 0;
    totalAmount += item.total || 0;
  });

  // ── Items rows ───────────────────────────────────────────────────────────────
  const itemsHTML = cartItems
    .map((item, index) => {
      const qty = item.qty || item.quantity || 0;
      const baseRate = item.baseRate || 0;
      const taxableValue = item.taxableValue || 0;
      const gstRate = item.gstRate || 0;
      const gstAmount = item.gstAmount || 0;
      const itemTotal = item.total || 0;
      const isTaxInclusive = item.isTaxInclusive || false;

      let perItemDiscount = Number(item.discount || 0);
      if (isTaxInclusive && gstRate > 0)
        perItemDiscount = perItemDiscount / (1 + gstRate / 100);
      const totalDiscount = perItemDiscount * qty;
      const discountPercent =
        baseRate > 0 && perItemDiscount > 0
          ? ((perItemDiscount / baseRate) * 100).toFixed(1)
          : null;

      return `
        <tr>
          <td class="c">${index + 1}</td>
          <td class="l">
            <div class="iname">${item.name}</div>
            ${item.hsn ? `<div class="isub">HSN: ${item.hsn}</div>` : ''}
          </td>
          <td class="c">${qty}<br><span class="isub">${
        item.unit || 'PCS'
      }</span></td>
          <td class="r">₹${baseRate.toFixed(2)}</td>
          <td class="r">${
            totalDiscount > 0
              ? `₹${totalDiscount.toFixed(2)}${
                  discountPercent
                    ? `<br><span class="isub">(${discountPercent}%)</span>`
                    : ''
                }`
              : '—'
          }</td>
          ${
            isGstInvoice
              ? `<td class="r">₹${taxableValue.toFixed(2)}</td>
               <td class="r">₹${gstAmount.toFixed(
                 2,
               )}<br><span class="isub">${gstRate}%</span></td>`
              : ''
          }
          <td class="r bold">₹${itemTotal.toFixed(2)}</td>
        </tr>`;
    })
    .join('');

  // ── Derived values ───────────────────────────────────────────────────────────
  const roundedGrandTotal = Math.round(
    invoiceCalculations.grandTotal - (invoiceCalculations?.discountTotal || 0),
  );
  const rawGrandTotal =
    invoiceCalculations.grandTotal - (invoiceCalculations?.discountTotal || 0);
  const roundOffValue = (roundedGrandTotal - rawGrandTotal).toFixed(2);

  const amountInWords =
    numberToWords
      .toWords(roundedGrandTotal)
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
      storedata.bankDetails.upiId);

  const storeAddressLine = [
    storedata?.address?.street,
    storedata?.address?.city,
    storedata?.address?.postalCode ? `– ${storedata.address.postalCode}` : '',
  ]
    .filter(Boolean)
    .join(', ')
    .replace(/,\s*–/, ' –');

  let qrURL = '';
  if (storedata?.bankDetails?.upiId) {
    const upiString = `upi://pay?pa=${
      storedata.bankDetails.upiId
    }&pn=${encodeURIComponent(
      storedata?.name || 'Merchant',
    )}&am=${roundedGrandTotal}&cu=INR`;
    qrURL = `https://quickchart.io/qr?text=${encodeURIComponent(upiString)}`;
  }

  return /*html*/ `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invoice – A5</title>
  <style>
    /* ── Reset ── */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }

    /* ── Half A4 landscape: 210 × 148.5 mm (√2:1) ── */
    body {
      font-family: Arial, sans-serif;
      font-size: 8.5px;
      line-height: 1.3;
      color: #000;
      background: #fff;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }

    .wrap {
      width: ${A5_WIDTH_MM}mm;
      max-width: 100%;
      min-height: ${A5_HEIGHT_MM}mm;
      aspect-ratio: ${A5_WIDTH_MM} / ${A5_HEIGHT_MM};
      margin: 0;
      border: 1px solid #000;
      background: #fff;
      display: flex;
      flex-direction: column;
    }

    /* ── Brand strip ── */
    .brand-strip {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-bottom: 1px solid #ccc;
      background: #f9fafc;
      font-size: 8px;
      color: #666;
      flex-shrink: 0;
    }
    .brand-strip img { height: 11px; width: auto; }

    /* ── Header (company name + badge only) ── */
    .hdr {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 5px 8px 4px;
      border-bottom: 1px solid #000;
      gap: 6px;
      flex-shrink: 0;
    }
    .hdr-left { display: flex; align-items: flex-start; gap: 6px; flex: 1; }
    .logo { height: 32px; width: auto; max-width: 60px; object-fit: contain; }
    .co-name {
      font-size: 11px;
      font-weight: 800;
      color: #2c5aa0;
      text-transform: uppercase;
      margin-bottom: 1px;
    }
    .co-tag { font-size: 8px; color: #555; font-style: italic; }
    .badge {
      background: #2c5aa0;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 4px;
      text-transform: uppercase;
      white-space: nowrap;
      border: 1px solid #000;
    }

    /* ── Store + invoice: one row, left / right ── */
    .info-bar {
      display: flex;
      border-bottom: 1px solid #000;
      font-size: 8.5px;
      flex-shrink: 0;
    }
    .info-split {
      display: flex;
      width: 100%;
    }
    .info-side {
      flex: 1;
      padding: 4px 8px;
      min-width: 0;
    }
    .info-side + .info-side {
      border-left: 1px solid #000;
    }
    .info-side.left { text-align: left; }
    .info-side.right { text-align: right; }
    .info-side .ttl {
      font-weight: 700;
      color: #2c5aa0;
      margin-bottom: 3px;
      font-size: 9px;
    }
    .info-row { margin-bottom: 2px; }
    .info-lbl { font-weight: 600; }

    /* customer row (full width below store/invoice) */
    .info-bar.customer-bar .info-side {
      flex: 1;
      border-left: none;
      text-align: left;
    }

    /* ── Items table ── */
    .tbl-wrap { position: relative; flex: 1 1 auto; }
    .tbl {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5px;
    }
    .tbl th {
      background: #2c5aa0;
      color: #fff;
      padding: 2px 3px;
      border: 1px solid #000;
      font-size: 7.5px;
      text-align: center;
    }
    .tbl td {
      padding: 2px 3px;
      border: 1px solid #000;
      vertical-align: middle;
    }
    .tbl .c { text-align: center; }
    .tbl .r { text-align: right; }
    .tbl .l { text-align: left; }
    .tbl .bold { font-weight: 700; }
    .iname { font-weight: 600; }
    .isub { font-size: 7.5px; color: #555; }

    .sum-row td { font-weight: 700; background: #f0f4ff; }

    /* ── Totals block ── */
    .totals-wrap {
      display: flex;
      border-top: 1.5px solid #000;
      flex-shrink: 0;
    }
    .words-col {
      flex: 1;
      padding: 4px 8px;
      border-right: 1px solid #000;
      font-size: 8px;
    }
    .words-lbl { font-weight: 700; color: #2c5aa0; margin-bottom: 2px; }
    .words-val { font-size: 9px; font-weight: 600; }
    .amt-col { width: 155px; flex-shrink: 0; }
    .amt-tbl { width: 100%; border-collapse: collapse; font-size: 8.5px; }
    .amt-tbl td { padding: 4px 6px; border: 1px solid #000; }
    .amt-tbl .lbl { font-weight: 600; background: #f8f8f8; }
    .amt-tbl .val { text-align: right; font-weight: 600; }
    .grand .lbl, .grand .val {
      background: #2c5aa0;
      color: #fff;
      font-weight: 700;
    }
    .pay-red { color: #e53935; }
    .pay-grn { color: #43a047; }

    .ps-wrap { text-align: right; padding: 3px 6px; flex-shrink: 0; }
    .ps {
      display: inline-block;
      padding: 1px 10px;
      border-radius: 12px;
      font-size: 7px;
      font-weight: 600;
      font-style: italic;
      color: #fff;
      letter-spacing: 0.4px;
    }
    .ps.paid    { background: #43a047; }
    .ps.partial { background: #fb8c00; }
    .ps.unpaid  { background: #e53935; }

    .ftr {
      display: flex;
      border-top: 1px solid #000;
      min-height: 42px;
      flex-shrink: 0;
    }
    .bank-col {
      flex: 1;
      padding: 6px 8px;
      border-right: 1px solid #000;
      font-size: 8px;
    }
    .bank-col .ttl { font-weight: 700; color: #2c5aa0; margin-bottom: 3px; }
    .sig-col {
      width: 130px;
      padding: 6px 8px;
      text-align: center;
      font-size: 8px;
    }
    .sig-line {
      border-top: 1px solid #000;
      margin-top: 18px;
      padding-top: 2px;
      font-weight: 700;
      font-size: 7.5px;
    }
    .sig-img { max-height: 28px; max-width: 100%; object-fit: contain; }

    .tbl-wrap.cancelled::after {
      content: "CANCELLED";
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: clamp(28px, 8vw, 72px);
      font-weight: 900;
      letter-spacing: 0.4em;
      color: rgba(0,0,0,0.07);
      transform: rotate(-28deg);
      pointer-events: none;
      z-index: 2;
      white-space: nowrap;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
        background: #fff;
        display: block;
      }
      @page {
        size: ${A5_WIDTH_MM}mm ${A5_HEIGHT_MM}mm landscape;
        margin: 0;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
      }
      .wrap {
        width: ${A5_WIDTH_MM}mm;
        min-height: ${A5_HEIGHT_MM}mm;
        max-width: none;
        margin: 0 !important;
        aspect-ratio: ${A5_WIDTH_MM} / ${A5_HEIGHT_MM};
        border: 1px solid #000;
      }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      .no-break { page-break-inside: avoid; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }

    .remarks { font-size: 7.5px; color: #555; padding: 4px 8px; flex-shrink: 0; }
  </style>
</head>
<body>
<div class="wrap">

  ${
    isFreePlan
      ? `
  <div class="brand-strip">
    ${
      appBrand?.logoUrl
        ? `<img src="${appBrand.logoUrl}" alt="${
            appBrand?.name || ''
          }" onerror="this.style.display='none'">`
        : ''
    }
    <span>Powered by ${appBrand?.name || 'AMDAANI'}</span>
  </div>`
      : ''
  }

  ${
    preview
      ? ''
      : `
  <div class="hdr">
    <div class="hdr-left">
      ${
        storedata?.logoUrl
          ? `<img class="logo" src="${storedata.logoUrl}" alt="Logo" onerror="this.style.display='none'">`
          : ''
      }
      <div>
        <div class="co-name">${storedata?.name || 'YOUR COMPANY NAME'}</div>
        ${
          storedata?.tagline
            ? `<div class="co-tag">${storedata.tagline}</div>`
            : ''
        }
      </div>
    </div>
    <div class="badge">${isGstInvoice ? 'Tax Invoice' : 'Invoice'}</div>
  </div>`
  }

  <!-- Store address (left) + Invoice details (right) in one row -->
  <div class="info-bar">
    <div class="info-split">
      <div class="info-side left">
        <div class="ttl">Store Address</div>
        ${
          storeAddressLine
            ? `<div class="info-row">${storeAddressLine}</div>`
            : ''
        }
        ${
          storedata?.address?.state
            ? `<div class="info-row">${storedata.address.state}</div>`
            : ''
        }
        ${
          isGstInvoice && storedata?.gstNumber
            ? `<div class="info-row"><span class="info-lbl">GSTIN:</span> ${storedata.gstNumber}</div>`
            : ''
        }
      </div>
      <div class="info-side right">
        <div class="ttl">Invoice Details</div>
        <div class="info-row"><span class="info-lbl">Invoice No:</span> ${invoiceNumber}</div>
        <div class="info-row"><span class="info-lbl">Date:</span> ${format(
          new Date(invoiceDate),
          'dd-MMM-yyyy',
        )}</div>
        <div class="info-row"><span class="info-lbl">Time:</span> ${format(
          new Date(invoiceDate),
          'hh:mm a',
        )}</div>
      </div>
    </div>
  </div>

  ${
    hasCustomerDetails
      ? `
  <div class="info-bar customer-bar">
    <div class="info-side">
      <div class="ttl">Bill To</div>
      ${
        formValues.contactNumber
          ? `<div class="info-row"><span class="info-lbl">Mobile:</span> ${formValues.contactNumber}</div>`
          : ''
      }
      ${
        formValues.customerName || formValues.partyName
          ? `<div class="info-row"><span class="info-lbl">Name:</span> ${
              formValues.customerName || formValues.partyName
            }</div>`
          : ''
      }
      ${
        formValues.customerAddress || formValues.address
          ? `<div class="info-row"><span class="info-lbl">Address:</span> ${
              formValues.customerAddress || formValues.address
            }</div>`
          : ''
      }
      ${
        formValues.customerState || formValues.state
          ? `<div class="info-row"><span class="info-lbl">State:</span> ${
              formValues.customerState || formValues.state
            }${
              formValues.customerPostalCode || formValues.postalCode
                ? `, Pin: ${
                    formValues.customerPostalCode || formValues.postalCode
                  }`
                : ''
            }</div>`
          : ''
      }
      ${
        formValues.customerGstNumber || formValues.gstNumber
          ? `<div class="info-row"><span class="info-lbl">GSTIN:</span> ${
              formValues.customerGstNumber || formValues.gstNumber
            }</div>`
          : ''
      }
    </div>
  </div>`
      : ''
  }

  <div class="tbl-wrap ${
    invoiceData?.status?.toLowerCase() === 'cancelled' ? 'cancelled' : ''
  }">
    <table class="tbl">
      <thead>
        <tr>
          <th style="width:22px">#</th>
          <th style="text-align:left">Item</th>
          <th>Qty</th>
          <th>Rate(₹)</th>
          <th>Disc(₹)</th>
          ${isGstInvoice ? '<th>Taxable(₹)</th><th>GST(₹)</th>' : ''}
          <th>Amt(₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}

        <tr class="sum-row">
          <td></td>
          <td class="l bold">Total</td>
          <td class="c bold">${totalQty}</td>
          <td></td>
          <td class="r bold">₹${totalDiscount.toFixed(2)}</td>
          ${
            isGstInvoice
              ? `<td class="r bold">₹${totalTaxable.toFixed(2)}</td>
               <td class="r bold">₹${totalGST.toFixed(2)}</td>`
              : ''
          }
          <td class="r bold">₹${totalAmount.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="totals-wrap no-break">
    <div class="words-col">
      <div class="words-lbl">Amount in Words:</div>
      <div class="words-val">${amountInWords}</div>
    </div>
    <div class="amt-col">
      <table class="amt-tbl">
        <tr>
          <td class="lbl">Subtotal</td>
          <td class="val">₹${
            createdInvoice
              ? invoiceData?.subTotal?.toFixed(2)
              : invoiceCalculations.subtotal.toFixed(2)
          }</td>
        </tr>
        ${
          (invoiceCalculations?.discountTotal ?? 0) > 0
            ? `
        <tr>
          <td class="lbl">Extra Disc.</td>
          <td class="val pay-red">−₹${
            createdInvoice
              ? Number(invoiceData?.discountTotal).toFixed(2)
              : Number(invoiceCalculations.discountTotal).toFixed(2)
          }</td>
        </tr>`
            : ''
        }
        ${
          roundOffValue != 0
            ? `
        <tr>
          <td class="lbl">Round Off</td>
          <td class="val ${roundOffValue < 0 ? 'pay-red' : 'pay-grn'}">${
                createdInvoice
                  ? `${Number(invoiceData?.roundOff) >= 0 ? '+' : ''}${Number(
                      invoiceData?.roundOff,
                    ).toFixed(2)}`
                  : `${roundOffValue < 0 ? '−' : '+'}₹${Math.abs(
                      roundOffValue,
                    ).toFixed(2)}`
              }</td>
        </tr>`
            : ''
        }
        <tr class="grand">
          <td class="lbl">Net Total</td>
          <td class="val">₹${
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
            ? `
        <tr>
          <td class="lbl">Paid</td>
          <td class="val">₹${payment.paid.toFixed(2)}</td>
        </tr>
        <tr>
          <td class="lbl">Due</td>
          <td class="val ${payment.due > 0 ? 'pay-red' : ''}">₹${Math.round(
                payment.due,
              ).toFixed(2)}</td>
        </tr>`
            : ''
        }
      </table>
    </div>
  </div>

  <div class="ps-wrap">
    <span class="ps ${payment.status?.toLowerCase()}">
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
  <div style="text-align:right; font-size:7.5px; padding: 2px 8px 4px; color:#444;">
    ${
      invoiceData.paymentMethod
        ? `<span style="color:#666;">Method:</span> <strong>${invoiceData.paymentMethod.toUpperCase()}</strong>`
        : ''
    }
    ${
      invoiceData.paymentNote
        ? ` &nbsp;|&nbsp; <span style="color:#666;">Note:</span> ${invoiceData.paymentNote}`
        : ''
    }
  </div>`
      : ''
  }

  ${
    preview
      ? ''
      : `
  <div class="ftr">
    ${
      hasBankDetails
        ? `
    <div class="bank-col">
      <div class="ttl">Bank Details</div>
      ${
        storedata.bankDetails.bankName
          ? `<div>Bank: ${storedata.bankDetails.bankName}</div>`
          : ''
      }
      ${
        storedata.bankDetails.accountNo
          ? `<div>A/C: ${storedata.bankDetails.accountNo}</div>`
          : ''
      }
      ${
        storedata.bankDetails.ifsc
          ? `<div>IFSC: ${storedata.bankDetails.ifsc}</div>`
          : ''
      }
      ${
        storedata.bankDetails.upiId
          ? `<div>UPI: ${storedata.bankDetails.upiId}</div>`
          : ''
      }
      ${
        storedata?.bankDetails?.upiId
          ? `
      <div style="margin-top:5px; text-align:center;">
        <div style="font-size:7.5px; font-weight:700; margin-bottom:2px;">Scan &amp; Pay</div>
        <img src="${qrURL}" width="52" height="52">
        <div style="font-size:7px;">₹${roundedGrandTotal}</div>
      </div>`
          : ''
      }
    </div>`
        : ''
    }
    <div class="sig-col">
      <div style="font-size:8px; font-weight:600; color:#2c5aa0;">For ${
        storedata?.name || 'YOUR COMPANY NAME'
      }</div>
      ${
        storedata?.signatureUrl
          ? `<img class="sig-img" src="${storedata.signatureUrl}"><br>`
          : ''
      }
      <div class="sig-line">Authorized Signatory</div>
    </div>
  </div>`
  }

  ${
    invoiceData?.remarks
      ? `<div class="remarks">Remarks: ${invoiceData.remarks}</div>`
      : ''
  }
  ${
    !preview && storedata?.settings?.invoiceTerms
      ? `<div class="remarks">${storedata.settings.invoiceTerms}</div>`
      : ''
  }

</div>
</body>
</html>`;
};
