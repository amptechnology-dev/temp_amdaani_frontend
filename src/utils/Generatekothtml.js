import { format } from 'date-fns';

/**
 * Generates a Kitchen Order Ticket (KOT) — a thermal print layout.
 *
 * The store header (logo, name, tagline, address, GSTIN, contact, email)
 * is the same block used in generateThermalInvoiceHTML, so a KOT and a
 * bill look like they came from the same printer/brand. Below that it
 * carries no pricing/GST data — just the invoice number (used as the
 * ticket number), date, customer, and the item list the kitchen needs
 * to prepare.
 *
 * @param {object} params
 * @param {object} params.invoiceData     - the raw invoice/order object
 * @param {object} params.formValues      - { customerName }
 * @param {Array}  params.cartItems       - [{ name, quantity, hsn? }]
 * @param {string} params.invoiceNumber   - shown as the KOT's ticket number
 * @param {string|Date} params.invoiceDate
 * @param {object} params.storedata       - store profile (logo, name, address, etc.)
 * @param {boolean} params.isGstInvoice   - whether to show the store's GSTIN
 */
export const generateKOTHTML = ({
  invoiceData,
  formValues = {},
  cartItems = [],
  invoiceNumber,
  invoiceDate,
  storedata,
  isGstInvoice,
}) => {
  const itemsHTML = (cartItems || [])
    .map((item, index) => {
      const qty = item.quantity ?? item.qty ?? 0;
      const note = item.note || item.notes || '';
      return `
        <tr class="line">
          <td class="center">${index + 1}</td>
          <td>${item.name || ''}${
        note ? `<br/><span class="note">${note}</span>` : ''
      }</td>
          <td class="right">${qty}</td>
        </tr>
      `;
    })
    .join('');

  // "Total Items" = sum of quantities across all line items (e.g. 2 Lassi
  // + 1 Naan counts as 3), not just the number of distinct dishes.
  const totalItems = (cartItems || []).reduce(
    (sum, item) => sum + Number(item.quantity ?? item.qty ?? 0),
    0,
  );

  const dateObj = invoiceDate ? new Date(invoiceDate) : new Date();
  const ticketNumber = invoiceNumber || invoiceData?.invoiceNumber || '';
  const customerName = formValues.customerName || invoiceData?.customerName;

  return /*html*/ `
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
          #container { transform: scale(1); }
        }
        /* Tablet */
        @media (min-width: 481px) and (max-width: 768px) {
          #container { transform: scale(1.2); }
        }

        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .line {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 4px 2px;
        }
        th {
          border-bottom: 1px solid #000;
          font-size: 12px;
          text-align: left;
        }
        td {
          font-size: 12px;
        }
        .note {
          font-size: 10px;
          color: #444;
          font-style: italic;
        }
        img.logo {
          max-width: 90px;
          margin: 4px auto;
          display: block;
        }

        .kot-title {
          text-align: center;
          font-weight: 900;
          font-size: 26px;
          letter-spacing: 2px;
          font-family: "Impact", "Arial Black", monospace;
          margin: 4px 0 2px 0;
        }
        .total-row td {
          font-weight: bold;
          font-size: 14px;
          border-top: 1px solid #000;
          padding-top: 6px;
        }
        .footer-cut {
          margin-top: 14px;
          border-top: 1px dashed #000;
        }
      </style>
    </head>
    <body>
      <div id="container">
        <div class="center">
          ${
            storedata?.logoUrl
              ? `<img src="${storedata.logoUrl}" class="logo"/>`
              : ''
          }
          <div class="bold" style="font-size:14px;">
            ${storedata?.name || 'STORE NAME'}
          </div>
          ${storedata?.tagline ? `<div>${storedata.tagline}</div>` : ''}
          <div>
            ${storedata?.address?.street || ''}, ${
    storedata?.address?.city || ''
  }
          </div>
          ${
            isGstInvoice && storedata?.gstNumber
              ? `<div>GSTIN: ${storedata?.gstNumber || ''}</div>`
              : ''
          }
          <div>
            ${storedata?.address?.state || ''} ${
    storedata?.address?.postalCode || ''
  }
          </div>
          <div>Ph. No.: ${storedata?.contactNo || ''}</div>
          ${storedata?.email ? `<div> Email: ${storedata.email}</div>` : ''}
        </div>

        <div class="line"></div>

        <div class="kot-title">KOT</div>

        <div>
          <div><span class="bold">Invoice:</span> ${ticketNumber}</div>
          <div>
            <span class="bold">Date:</span> ${format(
              dateObj,
              'dd-MMM-yyyy hh:mm a',
            )}
          </div>
          ${
            customerName
              ? `<div><span class="bold">Customer:</span> ${customerName}</div>`
              : ''
          }
        </div>

        <div class="line"></div>

        <table>
          <thead>
            <tr>
              <th style="width:15%;">Sl.No</th>
              <th>Item Name</th>
              <th class="right" style="width:20%;">Qty.</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td></td>
              <td class="right">Total Items :</td>
              <td class="right">${totalItems}</td>
            </tr>
          </tfoot>
        </table>

        <div class="footer-cut"></div>
      </div>
    </body>
  </html>
  `;
};
