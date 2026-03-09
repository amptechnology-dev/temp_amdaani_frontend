import { format } from "date-fns";

export const generateThermalInvoiceHTML = ({
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
  payment = { paid: 0, due: 0, status: 'unpaid' }
}) => {
  // Use precomputed fields from cartItems (like in invoiceTemplate.js)
  const itemsHTML = cartItems
    .map((item) => {
      const qty = item.qty || item.quantity || 0;
      const baseRate = item.baseRate || item.effectiveRate || item.price || 0;
      const discount = item.discount || 0;
      const gstRate = item.gstRate || 0;
      const taxableValue = item.taxableValue || 0;
      const gstAmount = item.gstAmount || 0;
      const totalAmount = item.total || baseRate * qty;
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
        <tr class="line">
          <td>${item.name}<br>${item.hsn ? `HSN: ${item.hsn}` : ""}</br></td>
          <td class="right">${qty}</td>
          <td class="right">${baseRate.toFixed(2)} ${Number(totalDiscount || 0) > 0 ? `<br>Dis @ ${discountPercent}%</br>` : ""
        }</td>
          <td class="right">${totalAmount.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");
  let gstTotals = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
  let gstBreakdownThermalHTML = '';

  for (const [rate, breakdown] of Object.entries(invoiceCalculations.gstBreakdown || {})) {
    if (parseFloat(rate) === 0) continue;

    const taxable = breakdown.taxableAmount || 0;
    const cgst = breakdown.cgstAmount || 0;
    const sgst = breakdown.sgstAmount || 0;
    const igst = breakdown.igstAmount || 0;

    gstBreakdownThermalHTML += `
    <tr>
      <td>${rate}%</td>
      <td>${taxable.toFixed(2)}</td>
      <td>${cgst.toFixed(2)}</td>
      <td>${sgst.toFixed(2)}</td>
      ${igst > 0 ? `<td>${igst.toFixed(2)}</td>` : ''}
    </tr>
  `;

    gstTotals.taxableValue += taxable;
    gstTotals.cgst += cgst;
    gstTotals.sgst += sgst;
    gstTotals.igst += igst;
  }

  if (Object.keys(invoiceCalculations.gstBreakdown || {}).length > 0 && isGstInvoice) {
    gstBreakdownThermalHTML += `
    <tr class="gst-total-row">
      <td>Total</td>
      <td>${gstTotals.taxableValue.toFixed(2)}</td>
      <td>${gstTotals.cgst.toFixed(2)}</td>
      <td>${gstTotals.sgst.toFixed(2)}</td>
      ${gstTotals.igst > 0 ? `<td>${gstTotals.igst.toFixed(2)}</td>` : ''}
    </tr>
  `;
  }
  const roundedGrandTotal = Math.round(invoiceCalculations.grandTotal - (invoiceCalculations?.discountTotal || 0));
  const rawGrandTotal = invoiceCalculations.grandTotal - (invoiceCalculations?.discountTotal || 0);
  const roundOffValue = (roundedGrandTotal - rawGrandTotal).toFixed(2);

  return /*html*/`
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body {
          font-family: monospace, Arial, sans-serif;
          font-size: 12px;
          width: 280px; /* 80mm printer */
          margin: 0 auto;
          color: #000;
          overflow-x: hidden;
        }
        #container {
          width: 280px;
          margin: 0 auto;
          transform-origin: top center;
        }

        /* Mobile (small screen) */
        @media (max-width: 480px) {
          #container {
            transform: scale(1);
          }
        }

        /* Tablet */
        @media (min-width: 481px) and (max-width: 768px) {
          #container {
            transform: scale(1.2);
          }
        }

        .center {
          text-align: center;
        }
        .right {
          text-align: right;
        }
        .bold {
          font-weight: bold;
        }
        .line {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th,
        td {
          padding: 3px 0;
        }
        th {
          border-bottom: 1px solid #000;
          font-size: 12px;
        }
        td {
          font-size: 11px;
        }
        .totals td {
          padding: 2px 0;
        }
        .grand {
          font-size: 13px;
          font-weight: bold;
        }
        .footer {
          margin-top: 10px;
          text-align: center;
          font-size: 11px;
        }
        img.logo {
          max-width: 90px;
          margin: 4px auto;
          display: block;
        }
/* Cancel stamp watermark */
#container.cancelled {
  position: relative;
}

#container.cancelled::after {
  content: "CANCELLED";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-18deg);
  z-index: 0;
  /* Size tuned for 80mm thermal width (~280px) */
  font-family: "Impact", "Arial Black", monospace;
  font-weight: 900;
  letter-spacing: 2px;
  font-size: 48px;            /* Adjust between 42–56 for your printer */
  color: rgba(200, 0, 0, 0.10);/* Very light so text stays readable */
  text-transform: uppercase;
  white-space: nowrap;
  pointer-events: none;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  /* Subtle stamp effects */
  border: 3px solid rgba(200, 0, 0, 0.20);
  padding: 8px 16px;
  border-radius: 6px;
  box-shadow:
    0 0 0 1px rgba(200, 0, 0, 0.15) inset,
    0 2px 6px rgba(0, 0, 0, 0.06);
  /* Slight texture using repeating gradient for a “stamped ink” look */
  background:
    repeating-linear-gradient(
      0deg,
      rgba(200, 0, 0, 0.04) 0px,
      rgba(200, 0, 0, 0.04) 2px,
      transparent 3px,
      transparent 5px
    );
}

/* Ensure main content stays above the watermark */
#container * {
  position: relative;
  z-index: 1;
}

/* Optional: add a small inline badge near the header for clarity */
.badge-cancelled {
  display: inline-block;
  color: #b00020;
  border: 1px solid rgba(176, 0, 32, 0.6);
  padding: 2px 6px;
  margin-left: 8px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
/* ==== GST Breakdown - Thermal ==== */
.gst-breakdown {
  width: 100%;
  margin-top: 4px;
  padding-top: 3px;
}

.gst-title {
  text-align: center;
  font-weight: bold;
  font-size: 11px;
  margin-bottom: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.gst-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
  line-height: 1.2;
}

.gst-table th {
  text-align: center;
  border-bottom: 1px solid #000;
  padding: 2px 0;
}

.gst-table td {
  text-align: center;
  padding: 2px 0;
  border-bottom: 1px dotted #999;
}

.gst-total-row {
  font-weight: bold;
  border-top: 1px solid #000;
}

.gst-total-row td {
  border-bottom: none;
  padding-top: 3px;
}

        .payment-status {
            display: inline-block;
            padding: 3px 12px;
            border-radius: 16px;
            font-weight: 600;
            font-size: 10px;
            text-transform: capitalize;
            font-style: italic;
            letter-spacing: 0.3px;
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
      </style>
    </head>
    <body>
 <div id="container" class="${invoiceData?.status?.toLowerCase() === 'cancelled' ? 'cancelled' : ''}">
        <div class="center">
          ${storedata?.logoUrl
      ? `<img src="${storedata.logoUrl}" class="logo"/>`
      : ""
    }
          <div class="bold" style="font-size:14px;">
            ${storedata?.name || "STORE NAME"}
          </div>
          ${storedata?.tagline ? `<div>${storedata.tagline}</div>` : ""}
          <div>
            ${storedata?.address?.street || ""}, ${storedata?.address?.city || ""}
          </div>
          ${isGstInvoice && storedata?.gstNumber
      ? `<div>GSTIN: ${storedata?.gstNumber || ""}</div>`
      : ""
    }
          <div>
            ${storedata?.address?.state || ""} ${storedata?.address?.postalCode || ""}
          </div>
          <div>Ph. No.: ${storedata?.contactNo || ""}</div>
          ${storedata?.email ? `<div> Email: ${storedata.email}</div>` : ""}
        </div>

        <div class="line"></div>

        <div>
          <div><span class="bold">Invoice:</span> ${invoiceNumber}</div>
          <div>
            <span class="bold">Date:</span> ${format(
      new Date(invoiceDate),
      "dd-MMM-yyyy hh:mm a"
    )}
          </div>
          ${formValues.contactNumber
      ? `<div><span class="bold">Mobile:</span> ${formValues.contactNumber || ""}</div>`
      : ""
    }
          ${formValues.partyName || formValues.customerName
      ? `<div><span class="bold">Customer:</span> ${formValues.partyName || formValues.customerName || ""
      }</div>`
      : ""
    }
        </div>

        <div class="line"></div>

        <table>
          <thead>
            <tr>
              <th style="text-align:left;">Item</th>
              <th class="right">Qty</th>
              <th class="right">Rate</th>
              <th class="right">Amt</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>
        

        <div class="line"></div>

        <table class="totals">
          <tr>
            <td class="bold">Sub Total</td>
            <td class="right">${createdInvoice ? invoiceData?.subTotal.toFixed(2) : invoiceCalculations.subtotal.toFixed(2)}</td>
          </tr>
          ${Number(invoiceCalculations.discountTotal || 0) > 0
      ? `
              <tr>
                <td class="bold">Extra Discount</td>
                <td class="right">-${createdInvoice ? Number(invoiceData?.discountTotal).toFixed(2) : Number(invoiceCalculations.discountTotal).toFixed(2)}</td>
              </tr>
            `
      : ""
    }
          ${roundOffValue != 0 ?
      `   <tr>
                <td class="bold">Round Off</td>
                <td class="right" style="color:${roundOffValue < 0 ? '#e53935' : '#43a047'};"> ${createdInvoice
        ? `${Number(invoiceData?.roundOff) >= 0 ? '+' : ''}${Number(invoiceData?.roundOff).toFixed(2)}`
        : `${roundOffValue < 0 ? '−' : '+'}₹${Math.abs(roundOffValue).toFixed(2)}`
      }</td>
              </tr>
            `
      : ""
    }
         
          <tr>
            <td class="grand">Net Total</td>
            <td class="right grand">
              ${createdInvoice ? Math.round(invoiceData?.grandTotal).toFixed(2) : Math.round(invoiceCalculations.grandTotal - (invoiceCalculations?.discountTotal || 0)).toFixed(2)}
            </td>
          </tr>
${payment.status !== 'paid' || payment.due > 0 ?
      `<tr>
            <td class="grand">Paid Amount</td>
            <td class="right grand">
             ${payment.paid.toFixed(2)}
            </td>
          </tr>

          <tr>
            <td class="grand">Due Amount</td>
            <td class="right grand" style="color:${payment.due > 0 ? '#e53935' : '#000'};">
             ${payment.due.toFixed(2)}
            </td>
          </tr>`: ''}
        </table>
<div class="center" style="margin-top:6px;">
          <span class="payment-status ${payment.status?.toLowerCase()}">
            ${payment.status === 'paid'
      ? 'Amount is Fully Paid'
      : payment.status === 'partial'
        ? 'Amount is Partially Paid'
        : 'Amount is Unpaid'}
          </span>
        </div>
        <!-- Payment Details -->
${invoiceData?.paymentMethod || invoiceData?.paymentNote ? `
  <div style="text-align: center; margin-top: 4px; font-size: 10px; line-height: 1.5;">
    ${invoiceData.paymentMethod || invoiceData.paymentNote ? `
      <div style="margin-bottom: 4px;">
        <span style="color: #666;">Payment:</span>
        <span style="font-weight: 600; margin-left: 4px;">${invoiceData.paymentMethod.toUpperCase()}</span>
        ${invoiceData?.paymentNote ? `(${invoiceData?.paymentNote})` : ''}
      </div>
    ` : ''}
     </div>
` : ''}
        <div class="line"></div>

        <!-- Payment Summary -->
${invoiceData?.transactions && invoiceData.transactions.length > 0 ? `
  <div class="gst-breakdown">
    <div class="gst-title">Payment Summary</div>
    <table class="gst-table">
      <thead>
        <tr>
          <th style="text-align: left;">Date</th>
          <th style="text-align: right;">Amount</th>
          <th style="text-align: center;">Method</th>
        </tr>
      </thead>
      <tbody>
        ${invoiceData.transactions.map(transaction => `
          <tr>
            <td style="text-align: left;">${format(new Date(transaction.createdAt), 'dd/MM hh:mm a')}</td>
            <td style="text-align: right;">₹${transaction.amount.toFixed(2)}</td>
            <td style="text-align: center;">${transaction.paymentMethod.toUpperCase()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
` : ''}


         ${Object.keys(invoiceCalculations.gstBreakdown || {}).some(r => parseFloat(r) > 0) && isGstInvoice ? `
    <div class="gst-breakdown">
     <div class="gst-title">Tax Summary</div>
      <table class="gst-table">
        <thead>
          <tr>
            <th>GST%</th>
            <th>Tax Value</th>
            <th>CGST</th>
            <th>SGST</th>
            ${gstTotals.igst > 0 ? `<th>IGST</th>` : ''}
          </tr>
        </thead>
        <tbody>${gstBreakdownThermalHTML}</tbody>
      </table>
    </div>
  ` : ''}

        <div class="footer">
          Thank you for your purchase!<br/>
          Visit Again

          ${storedata?.signatureUrl
      ? `<div class="center"><img src="${storedata.signatureUrl}" style="max-width:100px;object-fit:contain;margin-top:8px;"/></div>`
      : ""
    }
          ${isFreePlan
      ? `<div style="font-size:18px; text-align:center; margin-top:8px;">
            Powered by AMDAANI
            </div>`
      : ""
    }
        </div>
      </div>
      </div>
    </body>
  </html>
  `;
};
