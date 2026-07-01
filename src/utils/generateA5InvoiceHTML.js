import { format } from 'date-fns';
import numberToWords from 'number-to-words';

const CONTENT_W_MM = 210;
const CONTENT_H_MM = 148;

const ITEMS_PER_FIRST_PAGE_BASE = 7;
const ITEMS_PER_CONT_PAGE = 13;
const FIRST_PAGE_MAX_CAPACITY = 13; // never exceed a continuation page's row capacity

function paginateItems(items, firstPageCapacity = ITEMS_PER_FIRST_PAGE_BASE) {
  const pages = [];
  let remaining = [...items];
  pages.push(remaining.splice(0, firstPageCapacity));
  while (remaining.length > 0) {
    pages.push(remaining.splice(0, ITEMS_PER_CONT_PAGE));
  }
  return pages;
}

// ── Figures out how many extra item rows can fit on page 1 by checking which
//    optional bottom sections (bank strip / remarks / terms / payment note)
//    will actually render. Fewer optional blocks → more leftover space →
//    more items fit before spilling to a continuation page. ─────────────────
function getFirstPageCapacity({
  hasBank,
  hasRemarks,
  hasTerms,
  hasPaymentNote,
}) {
  let capacity = ITEMS_PER_FIRST_PAGE_BASE;
  if (!hasBank) capacity += 1;
  if (!hasRemarks) capacity += 1;
  if (!hasTerms) capacity += 1;
  if (!hasPaymentNote) capacity += 1;
  return Math.min(capacity, FIRST_PAGE_MAX_CAPACITY);
}

// ── Safe date parser (fixes Hermes engine Invalid Date crash) ─────────────────
function parseSafeDate(value) {
  if (!value) return new Date();
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
}

const sharedCSS = (CONTENT_W_MM, CONTENT_H_MM) => `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    margin: 0; padding: 0; background: #eee;
  }

  @media screen {
    html, body { width: ${CONTENT_W_MM}mm; height: auto; overflow-x: auto; }
    .page {
      width: ${CONTENT_W_MM}mm;
      min-height: ${CONTENT_H_MM}mm;
      background: #fff;
      margin-bottom: 8mm;
    }
    .wrap {
      width: ${CONTENT_W_MM}mm;
      min-height: ${CONTENT_H_MM}mm;
      background: #fff;
      display: flex;
      flex-direction: column;
      font-family: Arial, sans-serif;
      font-size: 8.5px;
      line-height: 1.3;
      color: #000;
      border: 1px solid #000;
      overflow: hidden;
    }
  }

  @media print {
    html, body {
      margin: 0 !important; padding: 0 !important;
      background: #fff !important;
    }
    @page {
      size: ${CONTENT_W_MM}mm ${CONTENT_H_MM}mm landscape;
      margin: 0;
    }
    .page {
      width: ${CONTENT_W_MM}mm !important;
      height: ${CONTENT_H_MM}mm !important;
      page-break-after: always;
      overflow: hidden !important;
      background: #fff !important;
    }
    .page:last-child { page-break-after: avoid; }
    .wrap {
      width: ${CONTENT_W_MM}mm !important;
      height: ${CONTENT_H_MM}mm !important;
      background: #fff !important;
      display: flex !important;
      flex-direction: column !important;
      font-family: Arial, sans-serif !important;
      font-size: 8.5px !important;
      line-height: 1.3 !important;
      color: #000 !important;
      border: none !important;
      overflow: hidden !important;
    }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }

  .brand-strip {
    display: flex; align-items: center; gap: 5px;
    padding: 1.5px 8px; border-bottom: 1px solid #ccc;
    background: #f9fafc; font-size: 7px; color: #666; flex-shrink: 0; line-height: 1.2;
  }
  .brand-strip img { height: 9px; width: auto; }

  /* ─────────────────────────────────────────────────────────────────────────
     HEADER — restyled to match the A5_Sample.pdf layout:
     Row 1: logo (left) | TAX INVOICE / CASH-CREDIT MEMO (center) | QR (right)
     Row 2: From <store> (left)  |  To <customer> (right)
     Row 3: Invoice No  |  Invoice Date  |  Page info
     ───────────────────────────────────────────────────────────────────────── */
  .hdr-title-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 4px 8px; border-bottom: 1px solid #000; flex-shrink: 0; gap: 6px;
  }
  .hdr-logo-block { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
  .hdr-logo-block .logo { height: 28px; width: auto; max-width: 50px; object-fit: contain; }
  .hdr-logo-block .co-name { font-size: 10px; font-weight: 800; color: #2c5aa0; text-transform: uppercase; line-height: 1.15; }
  .hdr-logo-block .co-tag { font-size: 7px; color: #555; font-style: italic; line-height: 1.1; }

  .hdr-title-center { flex: 1.4; text-align: center; flex-shrink: 0; }
  .hdr-title-center .main-title {
    font-size: 13px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;
  }
  .hdr-title-center .sub-title {
    font-size: 7.5px; font-weight: 700; text-transform: uppercase;
    border-top: 1px solid #000; margin-top: 1px; padding-top: 1px; letter-spacing: 0.4px;
  }

  .hdr-qr-block {
    flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end;
    gap: 1px; font-size: 6px; color: #555; text-align: right;
  }
  .hdr-qr-block .pay-addr { line-height: 1.1; max-width: 95px; }
  .hdr-qr-block .pay-addr .lbl { font-weight: 700; color: #333; }
  .hdr-qr-block img { width: 58px; height: 58px; margin-top: 1px; }
  .hdr-qr-block .badge {
    background: #2c5aa0; color: #fff; font-size: 7.5px; font-weight: 700;
    padding: 1.5px 8px; border-radius: 3px; text-transform: uppercase; margin-bottom: 1px;
  }
  .hdr-qr-block .ps-inline {
    padding: 0px 7px; border-radius: 8px; font-size: 6.5px;
    font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.3px;
  }
  .hdr-qr-block .ps-inline.paid    { background: #43a047; }
  .hdr-qr-block .ps-inline.partial { background: #fb8c00; }
  .hdr-qr-block .ps-inline.unpaid  { background: #e53935; }

  .hdr-parties-row { display: flex; border-bottom: 1px solid #000; font-size: 8px; flex-shrink: 0; }
  .hdr-party { flex: 1; padding: 3px 8px; min-width: 0; }
  .hdr-party + .hdr-party { border-left: 1px solid #000; }
  .hdr-party .ttl { font-weight: 700; margin-bottom: 1px; }
  .hdr-party .p-row { line-height: 1.3; }
  .hdr-party .p-lbl { font-weight: 600; }

  .hdr-meta-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 2px 8px; border-bottom: 1px solid #000; font-size: 8px;
    font-weight: 700; flex-shrink: 0; gap: 8px;
  }
  .hdr-meta-row span { white-space: nowrap; }

  .cont-hdr {
    display: flex; justify-content: space-between; align-items: center;
    padding: 2px 8px; border-bottom: 1px solid #000;
    background: #f0f4ff; flex-shrink: 0;
  }
  .cont-hdr .co-name { font-size: 9.5px; margin: 0; font-weight: 800; color: #2c5aa0; text-transform: uppercase; }
  .cont-hdr .page-info { font-size: 7.5px; color: #555; }

  .tbl-wrap { position: relative; flex: 1; overflow: hidden; }
  .tbl { width: 100%; border-collapse: collapse; font-size: 8.5px; }
  .tbl th {
    background: #2c5aa0; color: #fff; padding: 2px 3px;
    border: 1px solid #000; font-size: 7.5px; text-align: center;
  }
  .tbl td { padding: 2px 3px; border: 1px solid #000; vertical-align: middle; }
  .tbl .c { text-align: center; }
  .tbl .r { text-align: right; }
  .tbl .l { text-align: left; }
  .tbl .bold { font-weight: 700; }
  .iname { font-weight: 600; }
  .isub { font-size: 7.5px; color: #555; }
  .sum-row td { font-weight: 700; background: #f0f4ff; }

  .totals-wrap { display: flex; border-top: 1.5px solid #000; flex-shrink: 0; }
  .words-col { flex: 1; padding: 4px 8px; border-right: 1px solid #000; font-size: 8px; }
  .words-lbl { font-weight: 700; color: #2c5aa0; margin-bottom: 2px; }
  .words-val { font-size: 9px; font-weight: 600; }
  .amt-col { width: 160px; flex-shrink: 0; }
  .amt-tbl { width: 100%; border-collapse: collapse; font-size: 8.5px; }
  .amt-tbl td { padding: 3px 6px; border: 1px solid #000; }
  .amt-tbl .lbl { font-weight: 600; background: #f8f8f8; }
  .amt-tbl .val { text-align: right; font-weight: 600; }
  .grand .lbl, .grand .val { background: #2c5aa0; color: #fff; font-weight: 700; }
  .pay-red { color: #e53935; }
  .pay-grn { color: #43a047; }

  /* ── Bank details now sit just below the totals block (kept off the header,
       same as the sample where the header stays clean and minimal). ────────── */
  .bank-strip {
    display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
    padding: 2px 8px; border-top: 1px solid #ccc; font-size: 7px; color: #444; flex-shrink: 0;
  }
  .bank-strip .ttl { font-weight: 700; color: #2c5aa0; }
  .bank-strip .sep { color: #bbb; }

  .ftr { display: flex; justify-content: flex-end; border-top: 1px solid #000; min-height: 40px; flex-shrink: 0; }
  .sig-col { width: 130px; padding: 5px 8px; text-align: center; font-size: 8px; }
  .sig-line {
    border-top: 1px solid #000; margin-top: 16px; padding-top: 2px;
    font-weight: 700; font-size: 7.5px;
  }
  .sig-img { max-height: 26px; max-width: 100%; object-fit: contain; }
  .remarks { font-size: 7.5px; color: #555; padding: 3px 8px; flex-shrink: 0; }

  .continued-note {
    text-align: center; font-size: 7.5px; color: #888;
    font-style: italic; padding: 2px 8px; border-top: 1px solid #eee; flex-shrink: 0;
  }

  .tbl-wrap.cancelled::after {
    content: "CANCELLED";
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: clamp(28px, 6vw, 60px); font-weight: 900;
    letter-spacing: 0.4em; color: rgba(0,0,0,0.07);
    transform: rotate(-28deg); pointer-events: none; z-index: 2; white-space: nowrap;
  }
`;

function buildItemsHTML(pageItems, startIndex, isGstInvoice) {
  return pageItems
    .map((item, i) => {
      const index = startIndex + i;
      const qty = item.qty || item.quantity || 0;
      const unit = item.unit || 'PCS';
      const hsn = item.hsn || '—';
      const baseRate = item.baseRate || 0;
      const taxableValue = item.taxableValue || 0;
      const gstRate = item.gstRate || 0;
      const gstAmount = item.gstAmount || 0;
      const cgstAmount = gstAmount / 2;
      const sgstAmount = gstAmount / 2;
      const itemTotal = item.total || 0;
      const isTaxInclusive = item.isTaxInclusive || false;

      let perItemDiscount = Number(item.discount || 0);
      if (isTaxInclusive && gstRate > 0)
        perItemDiscount = perItemDiscount / (1 + gstRate / 100);
      const totalDiscountAmt = perItemDiscount * qty;
      const discountPercent =
        baseRate > 0 && perItemDiscount > 0
          ? ((perItemDiscount / baseRate) * 100).toFixed(1)
          : null;

      return `
        <tr>
          <td class="c">${index + 1}</td>
          <td class="l">
            <div class="iname">${item.name}</div>
          </td>
          <td class="c">${hsn}</td>
          <td class="c">${qty}</td>
          <td class="c">${unit}</td>
          <td class="r">₹${baseRate.toFixed(2)}</td>
          <td class="r">${
            totalDiscountAmt > 0 ? `₹${totalDiscountAmt.toFixed(2)}` : '—'
          }</td>
          <td class="c">${discountPercent ? `${discountPercent}%` : '—'}</td>
          ${
            isGstInvoice
              ? `<td class="r">₹${taxableValue.toFixed(2)}</td>
               <td class="c">${gstRate}%</td>
               <td class="r">₹${cgstAmount.toFixed(2)}</td>
               <td class="r">₹${sgstAmount.toFixed(2)}</td>`
              : ''
          }
          <td class="r bold">₹${itemTotal.toFixed(2)}</td>
        </tr>`;
    })
    .join('');
}

function tableHeader(isGstInvoice) {
  return `<thead>
    <tr>
      <th style="width:18px">#</th>
      <th style="text-align:left">Item</th>
      <th>HSN</th>
      <th>Qty</th>
      <th>Unit</th>
      <th>Rate(₹)</th>
      <th>Disc(₹)</th>
      <th>Disc(%)</th>
      ${
        isGstInvoice
          ? '<th>Taxable(₹)</th><th>GST%</th><th>CGST(₹)</th><th>SGST(₹)</th>'
          : ''
      }
      <th>Amt(₹)</th>
    </tr>
  </thead>`;
}

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
  // ── FIX: Safe date parse — prevents Hermes engine crash on ISO strings ───────
  const safeDate = parseSafeDate(invoiceDate);

  // ── Aggregate totals ─────────────────────────────────────────────────────────
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

  // ── Grand total / words ──────────────────────────────────────────────────────
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

  // ── Derived flags ────────────────────────────────────────────────────────────
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

  const isCancelled = invoiceData?.status?.toLowerCase() === 'cancelled';

  // ── Paginate items ───────────────────────────────────────────────────────────
  // Compute which optional bottom-of-page blocks will render so we can work
  // out how much spare room is left on page 1 for extra item rows.
  const willShowRemarks = Boolean(invoiceData?.remarks);
  const willShowTerms = Boolean(!preview && storedata?.settings?.invoiceTerms);
  const willShowPaymentNote = Boolean(
    invoiceData?.paymentMethod || invoiceData?.paymentNote,
  );
  const firstPageCapacity = getFirstPageCapacity({
    hasBank: hasBankDetails,
    hasRemarks: willShowRemarks,
    hasTerms: willShowTerms,
    hasPaymentNote: willShowPaymentNote,
  });
  const pages = paginateItems(cartItems, firstPageCapacity);
  const totalPages = pages.length;

  // ── Reusable partials ────────────────────────────────────────────────────────
  const brandStrip = isFreePlan
    ? `<div class="brand-strip">
        ${
          appBrand?.logoUrl
            ? `<img src="${appBrand.logoUrl}" alt="${
                appBrand?.name || ''
              }" onerror="this.style.display='none'">`
            : ''
        }
        <span>Powered by ${appBrand?.name || 'AMDAANI'}</span>
      </div>`
    : '';

  /* ───────────────────────────────────────────────────────────────────────
     HEADER — rebuilt to mirror A5_Sample.pdf:
       Row 1 (hdr-title-row): logo+co name (left) | TAX INVOICE / CASH-CREDIT
                               MEMO (center) | QR + payment status (right)
       Row 2 (hdr-parties-row): "From, <Store>" (left) | "To, <Customer>" (right)
       Row 3 (hdr-meta-row): Invoice No | Invoice Date | Page info
     ─────────────────────────────────────────────────────────────────────── */

  const titleRow = `<div class="hdr-title-row">
    <div class="hdr-logo-block">
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
    <div class="hdr-title-center">
      <div class="main-title">${isGstInvoice ? 'Tax Invoice' : 'Invoice'}</div>
      <div class="sub-title">Cash / Credit Memo</div>
    </div>
    <div class="hdr-qr-block">
      ${
        hasBankDetails && storedata?.bankDetails?.upiId
          ? `<div class="pay-addr"><span class="lbl">Payment Address</span><br>${storedata.bankDetails.upiId}</div>`
          : ''
      }
      <span class="ps-inline ${payment.status?.toLowerCase()}">
        ${
          payment.status === 'paid'
            ? 'Paid'
            : payment.status === 'partial'
            ? 'Partial'
            : 'Unpaid'
        }
      </span>
      ${qrURL ? `<img src="${qrURL}" alt="UPI QR">` : ''}
    </div>
  </div>`;

  const partiesRow = `<div class="hdr-parties-row">
    <div class="hdr-party">
      <div class="ttl">From, ${storedata?.name || 'YOUR COMPANY NAME'}</div>
      ${
        storeAddressLine
          ? `<div class="p-row">Address: ${storeAddressLine}${
              storedata?.address?.state ? `, ${storedata.address.state}` : ''
            }</div>`
          : ''
      }
      ${
        isGstInvoice && storedata?.gstNumber
          ? `<div class="p-row"><span class="p-lbl">GSTIN No:</span> ${storedata.gstNumber}</div>`
          : ''
      }
      ${
        storedata?.phone || storedata?.phoneNumber
          ? `<div class="p-row"><span class="p-lbl">Phone No:</span> ${
              storedata.phone || storedata.phoneNumber
            }</div>`
          : ''
      }
    </div>
    <div class="hdr-party">
      <div class="ttl">To, ${
        hasCustomerDetails
          ? formValues.customerName || formValues.partyName || 'Customer'
          : 'Walk-in Customer'
      }</div>
      ${
        formValues.customerAddress || formValues.address
          ? `<div class="p-row"><span class="p-lbl">Address:</span> ${
              formValues.customerAddress || formValues.address
            }${
              formValues.customerState || formValues.state
                ? `, ${formValues.customerState || formValues.state}`
                : ''
            }</div>`
          : ''
      }
      <div class="p-row"><span class="p-lbl">GSTIN No:</span> ${
        formValues.customerGstNumber || formValues.gstNumber || 'NA'
      }</div>
      ${
        formValues.contactNumber
          ? `<div class="p-row"><span class="p-lbl">Phone No:</span> ${formValues.contactNumber}</div>`
          : ''
      }
    </div>
  </div>`;

  const metaRow = `<div class="hdr-meta-row">
    <span>INV_NO : ${invoiceNumber}</span>
    <span>Invoice Date : ${format(
      safeDate,
      'dd/MM/yyyy',
    )} &nbsp;|&nbsp; ${format(safeDate, 'hh:mm a')}</span>
    <span>Page 1 of ${totalPages}</span>
  </div>`;

  const fullHeader = preview ? '' : `${titleRow}${partiesRow}${metaRow}`;

  const bankStrip =
    !preview && hasBankDetails
      ? `<div class="bank-strip">
          <span class="ttl">Bank Details:</span>
          ${
            storedata.bankDetails.bankName
              ? `<span>${storedata.bankDetails.bankName}</span><span class="sep">|</span>`
              : ''
          }
          ${
            storedata.bankDetails.accountNo
              ? `<span>A/C: ${storedata.bankDetails.accountNo}</span><span class="sep">|</span>`
              : ''
          }
          ${
            storedata.bankDetails.ifsc
              ? `<span>IFSC: ${storedata.bankDetails.ifsc}</span>`
              : ''
          }
        </div>`
      : '';

  const totalsBlock = `<div class="totals-wrap">
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
            ? `<tr>
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
            ? `<tr>
              <td class="lbl">Round Off</td>
              <td class="val ${
                Number(roundOffValue) < 0 ? 'pay-red' : 'pay-grn'
              }">${
                createdInvoice
                  ? `${Number(invoiceData?.roundOff) >= 0 ? '+' : ''}${Number(
                      invoiceData?.roundOff,
                    ).toFixed(2)}`
                  : `${Number(roundOffValue) < 0 ? '−' : '+'}₹${Math.abs(
                      Number(roundOffValue),
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
            ? `<tr>
              <td class="lbl">Paid</td>
              <td class="val">₹${Number(payment.paid || 0).toFixed(2)}</td>
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
  </div>`;

  const paymentMethodRow =
    invoiceData?.paymentMethod || invoiceData?.paymentNote
      ? `<div style="text-align:right; font-size:7.5px; padding: 2px 8px 4px; color:#444;">
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
      : '';

  const footer = preview
    ? ''
    : `<div class="ftr">
        <div class="sig-col" style="margin-left:auto;">
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
      </div>`;

  const remarksRow = invoiceData?.remarks
    ? `<div class="remarks">Remarks: ${invoiceData.remarks}</div>`
    : '';

  const termsRow =
    !preview && storedata?.settings?.invoiceTerms
      ? `<div class="remarks">${storedata.settings.invoiceTerms}</div>`
      : '';

  // ── Build all page HTML blocks ───────────────────────────────────────────────
  let itemOffset = 0;
  const pageBlocks = pages.map((pageItems, pageIndex) => {
    const isFirstPage = pageIndex === 0;
    const isLastPage = pageIndex === totalPages - 1;
    const pageNum = pageIndex + 1;

    const itemsHTML = buildItemsHTML(pageItems, itemOffset, isGstInvoice);
    itemOffset += pageItems.length;

    const pageQty = pageItems.reduce(
      (s, i) => s + (i.qty || i.quantity || 0),
      0,
    );
    const pageDiscount = pageItems.reduce((s, i) => {
      const qty = i.qty || i.quantity || 0;
      const gstRate = i.gstRate || 0;
      const isTI = i.isTaxInclusive || false;
      let d = (i.discount || 0) * qty;
      if (isTI && gstRate > 0) d = d / (1 + gstRate / 100);
      return s + d;
    }, 0);
    const pageTaxable = pageItems.reduce(
      (s, i) => s + (i.taxableValue || 0),
      0,
    );
    const pageGST = pageItems.reduce((s, i) => s + (i.gstAmount || 0), 0);
    const pageAmount = pageItems.reduce((s, i) => s + (i.total || 0), 0);

    const sumGST = isLastPage ? totalGST : pageGST;
    const sumCGST = sumGST / 2;
    const sumSGST = sumGST / 2;

    const sumRow = `<tr class="sum-row">
      <td></td>
      <td class="l bold">${isLastPage ? 'Total' : `Page ${pageNum} Total`}</td>
      <td></td>
      <td class="c bold">${isLastPage ? totalQty : pageQty}</td>
      <td></td>
      <td></td>
      <td class="r bold">₹${(isLastPage ? totalDiscount : pageDiscount).toFixed(
        2,
      )}</td>
      <td></td>
      ${
        isGstInvoice
          ? `<td class="r bold">₹${(isLastPage
              ? totalTaxable
              : pageTaxable
            ).toFixed(2)}</td>
             <td></td>
             <td class="r bold">₹${sumCGST.toFixed(2)}</td>
             <td class="r bold">₹${sumSGST.toFixed(2)}</td>`
          : ''
      }
      <td class="r bold">₹${(isLastPage ? totalAmount : pageAmount).toFixed(
        2,
      )}</td>
    </tr>`;

    return `
<div class="page">
<div class="wrap">

  ${brandStrip}

  ${
    isFirstPage
      ? fullHeader
      : `<div class="cont-hdr">
        <div class="co-name">${storedata?.name || 'YOUR COMPANY NAME'}</div>
        <div class="page-info">
          Invoice #${invoiceNumber} &nbsp;|&nbsp; Page ${pageNum} of ${totalPages}
          &nbsp;|&nbsp; Items ${
            itemOffset - pageItems.length + 1
          }–${itemOffset} of ${cartItems.length}
        </div>
      </div>`
  }

  <div class="tbl-wrap ${isCancelled ? 'cancelled' : ''}">
    <table class="tbl">
      ${tableHeader(isGstInvoice)}
      <tbody>
        ${itemsHTML}
        ${sumRow}
      </tbody>
    </table>
  </div>

  ${
    isLastPage
      ? `${totalsBlock}${paymentMethodRow}${bankStrip}${footer}${remarksRow}${termsRow}`
      : `<div class="continued-note">Continued on next page… (${
          cartItems.length - itemOffset
        } more item${cartItems.length - itemOffset !== 1 ? 's' : ''})</div>`
  }

</div>
</div>`;
  });

  // ── Assemble final HTML document ─────────────────────────────────────────────
  return /*html*/ `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invoice #${invoiceNumber}</title>
  <style>${sharedCSS(CONTENT_W_MM, CONTENT_H_MM)}</style>
</head>
<body>

${pageBlocks.join('\n')}

<script>
  (function() {
    var screenW = window.innerWidth;
    document.querySelectorAll('.page').forEach(function(page) {
      var contentW = page.scrollWidth;
      if (contentW > screenW) {
        var scale = screenW / contentW;
        page.style.transformOrigin = '0 0';
        page.style.transform = 'scale(' + scale + ')';
        page.style.marginBottom = ((${CONTENT_H_MM * 3.7795275591} * scale) - ${
    CONTENT_H_MM * 3.7795275591
  } + 8) + 'px';
      }
    });
  })();
</script>

</body>
</html>`;
};
