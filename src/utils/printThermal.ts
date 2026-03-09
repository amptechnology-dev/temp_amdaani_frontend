import { format } from 'date-fns';
import { Printer } from '../native/Printer';

type Align = 'left' | 'center' | 'right';
type FontType = 'a' | 'b';

// Utility: fetch image as dataURL
async function urlToDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Utility: wrap text based on printer line width
function wrapTextForPrinter(
  text: string,
  sizeW: number = 1,
  lineCapacityBase: number = 32
): string[] {
  const lineCapacity = Math.floor(lineCapacityBase / sizeW);
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if ((current + ' ' + word).trim().length <= lineCapacity) {
      current = (current + ' ' + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);

  return lines;
}

async function printWrappedText(
  text: string,
  opts: { align?: Align; bold?: boolean; sizeW?: number; sizeH?: number; font?: FontType } = {}
) {
  const { sizeW = 1 } = opts;
  const lines = wrapTextForPrinter(text, sizeW);
  for (const line of lines) {
    await Printer.printText(line, opts);
  }
}

function getColumnWidths(
  font: 'a' | 'b',
  sizeW = 1,
  printerWidthPx = 384
): number[] {
  const total = getLineCapacity(printerWidthPx, font, sizeW);
  const ratios = [0.40, 0.10, 0.25, 0.25];
  const widths = ratios.map(r => Math.floor(total * r));
  const diff = total - widths.reduce((a, b) => a + b, 0);
  widths[widths.length - 1] += diff;
  return widths;
}

function getLineCapacity(printerWidthPx = 384, font: 'a' | 'b' = 'a', sizeW = 1): number {
  const charWidth = font === 'a' ? 12 : 9;
  return Math.floor(printerWidthPx / (charWidth * sizeW));
}

async function printDivider(
  font: 'a' | 'b' = 'a',
  sizeW = 1,
  sizeH = 1,
  printerWidthPx = 384
) {
  const capacity = getLineCapacity(printerWidthPx, font, sizeW);
  const line = '-'.repeat(capacity);
  await Printer.printText(line, { font, sizeW, sizeH });
}

// ✅ Safe wrapper
async function safePrint(action: () => Promise<void>) {
  try {
    await action();
  } catch (err) {
    console.warn("[ThermalPrint] Skipped section due to error:", err);
  }
}

// Main Invoice Printer
export async function printThermalInvoice(
  invoice: any,
  paidAmount: any,
  dueAmount: any,
  paymentStatus: any,
  gstBreakdown: any,
  enrichedItems: any,
  isFreePlan: boolean,
  store: any
) {
  const isGstInvoice = (invoice?.type || 'gst') !== 'non-gst';
  const discountTotal = Number(invoice.discountTotal || 0);
  const grandTotalRaw = invoice.grandTotal;
  // console.log('[ThermalPrint] Grand Total:', grandTotalRaw);
  const roundedTotal = Math.round(grandTotalRaw);

  const roundedGrandTotal = Math.round(
    invoice.grandTotal
  );

  const upiString = `upi://pay?pa=${store?.bankDetails?.upiId
    }&pn=${encodeURIComponent(store?.name || "Merchant")}&am=${roundedGrandTotal}&cu=INR`;

  const qrURL = `https://quickchart.io/qr?text=${encodeURIComponent(upiString)}`;

  try {
    // 1) Logo
    await safePrint(async () => {
      if (store?.logoUrl) {
        const logoData = await urlToDataURL(store?.logoUrl);
        await Printer.printImageBase64(logoData, 200, "threshold");
      }
    });

    // 2) Store header
    await safePrint(async () => {
      await printWrappedText(store?.name || 'STORE', {
        align: 'center',
        bold: true,
        font: 'a',
        sizeW: 1,
        sizeH: 1,
      });
    });

    await safePrint(async () => {
      if (store?.tagline) {
        await printWrappedText(store.tagline, { align: 'center', font: 'b' });
      }
    });

    await printDivider('b', 1, 1);

    await safePrint(async () => {
      if (store?.address?.street || store?.address?.city || store?.address?.state || store?.address?.postalCode) {
        await printWrappedText(
          `${store?.address?.street || ''}, ${store?.address?.city || ''}, ${store?.address?.state || ''} ${store?.address?.postalCode || ''} `,
          { align: 'center', font: 'b' }
        );
      }
    });

    await safePrint(async () => {
      if (isGstInvoice && store?.gstNumber) {
        await printWrappedText(`GSTIN: ${store?.gstNumber || ''}`, {
          align: 'center',
          font: 'b',
        });
      }
    });

    await safePrint(async () => {
      if (store?.contactNo) {
        await printWrappedText(`Ph.No.: +91 - ${store.contactNo} `, { align: 'center', font: 'b' });
      }
    });

    await safePrint(async () => {
      if (store?.email) {
        await printWrappedText(`Email: ${store.email} `, { align: 'center', font: 'b' });
      }
    });

    await printDivider('b', 1, 1);

    // 3) Invoice details
    await safePrint(async () => {
      await printWrappedText(`Invoice: ${invoice.invoiceNumber} `, { font: 'b' });
    });

    await safePrint(async () => {
      const formattedDate = format(new Date(invoice.invoiceDate), "dd-MMM-yyyy hh:mm a");
      await printWrappedText(`Date: ${formattedDate} `, { font: 'b' });
    });

    await safePrint(async () => {
      if (invoice.customerMobile) {
        await printWrappedText(`Customer Mobile: ${invoice.customerMobile} `, { font: 'b' });
      }
    });

    await safePrint(async () => {
      if (invoice?.customerName) {
        await printWrappedText(`Customer Name: ${invoice.customerName || ''} `, { font: 'b' });
      }
    });



    await printDivider('b', 1, 1);
    await safePrint(async () => {
      if (invoice?.status?.toLowerCase?.() === 'cancelled') {
        await Printer.printText('CANCELLED', {
          align: 'center',
          bold: true,
          font: 'a',
          sizeW: 2,
          sizeH: 2,
        });
        await printDivider('a', 1, 1);
      }
    });

    // 4) Items header
    const colWidths = getColumnWidths('b');
    await Printer.printColumns(
      colWidths,
      ['left', 'center', 'right', 'right'],
      ['Item', 'Qty', 'Rate', 'Amt'],
      { bold: true, font: 'b' }
    );
    await printDivider('b', 1, 1);

    // 5) Items
    const items = enrichedItems.length ? enrichedItems : invoice.items || [];

    for (const item of items) {
      const qty = Number(item.qty || item.quantity || 0);
      const baseRate = Number(item.baseRate || item.effectiveRate || item.price || 0);
      const discount = Number(item.discount || 0);
      const gstRate = Number(item.gstRate || 0);
      const isTaxInclusive = !!item.isTaxInclusive;
      const totalAmount = Number(item.total || baseRate * qty);

      let perItemDiscount = discount;
      if (isTaxInclusive && gstRate > 0) {
        perItemDiscount = perItemDiscount / (1 + gstRate / 100);
      }

      const totalDiscount = perItemDiscount * qty;

      const discountPercent =
        baseRate > 0 && perItemDiscount > 0
          ? ((perItemDiscount / baseRate) * 100).toFixed(2)
          : null;

      const wrappedName = wrapTextForPrinter(item.name || '', 1, colWidths[0]);

      for (let i = 0; i < wrappedName.length; i++) {
        if (i === 0) {
          await Printer.printColumns(
            colWidths,
            ['left', 'center', 'right', 'right'],
            [
              wrappedName[i],
              String(qty),
              baseRate.toFixed(2),
              totalAmount.toFixed(2),
            ],
            { font: 'b' }
          );
        } else {
          await Printer.printColumns(
            colWidths,
            ['left', 'center', 'right', 'right'],
            [wrappedName[i], '', '', ''],
            { font: 'b' }
          );
        }
      }

      // ✅ Show discount line (same logic as HTML)
      if (totalDiscount > 0) {
        await Printer.printColumns(
          colWidths,
          ['left', 'center', 'right', 'right'],
          [
            `${item.hsn ? `HSN: ${item.hsn} ` : ''}`,
            '',
            `Dis ${discountPercent ? `${discountPercent}%` : ''}`,
            '',
          ],
          { font: 'b' }
        );
      }

      await printDivider('b', 1, 1);
    }


    // 6) GST totals
    // await printDivider('a', 1, 1);
    // if (isGstInvoice && Number(invoice.gstTotal || 0) > 0) {

    //   await Printer.printColumns([20, 12], ['left', 'right'], [
    //     'GST Amount',
    //     Number(invoice.gstTotal || 0).toFixed(2),
    //   ]);
    // }

    await Printer.printColumns([20, 12], ['left', 'right'], [
      'Sub Total',
      Number(invoice.subTotal || 0).toFixed(2),
    ]);

    if (discountTotal > 0) {
      await Printer.printColumns([20, 12], ['left', 'right'], [
        'Extra discount',
        `-${discountTotal.toFixed(2)}`,
      ]);
    }

    // ✅ Round off calculation
    const roundOffValue = Number((invoice?.roundOff || 0).toFixed(2));

    // ✅ Round Off line (only if non-zero)
    if (roundOffValue != 0) {
      const sign = roundOffValue > 0 ? '+' : '';
      await Printer.printColumns(
        [20, 12],
        ['left', 'right'],
        ['Round Off', `${sign}${roundOffValue.toFixed(2)}`],
        { font: 'a' }
      );
    }

    // 7) Grand total
    await printDivider('b', 1, 1);



    // ✅ Net Total
    await Printer.printColumns(
      [20, 12],
      ['left', 'right'],
      ['Net Total', roundedTotal.toFixed(2)],
      { font: 'a', bold: true, sizeW: 1, sizeH: 1 }
    );



    // ✅ Paid and Due amounts (if applicable)


    if (paidAmount > 0 || dueAmount > 0) {
      await Printer.printColumns(
        [20, 12],
        ['left', 'right'],
        ['Paid Amount', paidAmount.toFixed(2)],
        { font: 'a' }
      );

      await Printer.printColumns(
        [20, 12],
        ['left', 'right'],
        ['Due Amount', Math.round(dueAmount).toFixed(2)],
        { font: 'a' }
      );
    }

    // ✅ Payment Status badge (centered)
    await Printer.feed(1);
    let statusText = '';
    switch ((paymentStatus || '').toLowerCase()) {
      case 'paid':
        statusText = 'Amount Fully Paid';
        break;
      case 'partial':
        statusText = 'Amount Partially Paid';
        break;
      default:
        statusText = 'Amount Unpaid';
    }

    await printWrappedText(statusText, {
      align: 'center',
      bold: true,
      font: 'b',
    });

    // ✅ Payment Details (Method & Note)
    await safePrint(async () => {
      const paymentMethod = invoice?.paymentMethod;
      const paymentNote = invoice?.paymentNote;

      if (!paymentMethod && !paymentNote) return;

      if (paymentMethod) {
        await printWrappedText(`Payment: ${paymentMethod.toUpperCase()} ${paymentNote ? `(Ref:${paymentNote})` : ''}`, {
          align: 'center',
          bold: true,
          font: 'b',
        });
      }

      // if (paymentNote) {
      //   await printWrappedText(`Note: ${paymentNote}`, {
      //     align: 'center',
      //     bold: false,
      //     font: 'b',
      //   });
      // }
    });

    await safePrint(async () => {
      if (!invoice?.transactions || invoice.transactions.length === 0) return;

      // 🖨️ Printer width auto-detect (58mm = 384px, 80mm = 576px)
      const printerWidthPx =
        store?.printerWidthPx ||
        (/80/.test(store?.printerModel || '') ? 576 : 384);

      await printDivider('a', 1, 1);

      await printWrappedText('PAYMENT SUMMARY', {
        align: 'center',
        bold: true,
        font: 'b',
      });

      await printDivider('b', 1, 1);

      // ✅ Perfect ratios for Date, Amount, Method columns
      const ratios = [0.50, 0.25, 0.25]; // Date (50%), Amount (25%), Method (25%)

      const totalCapacity = getLineCapacity(printerWidthPx, 'b', 1);
      const widths = ratios.map(r => Math.floor(totalCapacity * r));
      const diff = totalCapacity - widths.reduce((a, b) => a + b, 0);
      widths[widths.length - 1] += diff; // Add remaining space to last column

      const aligns: Align[] = ['left', 'right', 'center'];

      // Header
      await Printer.printColumns(
        widths,
        aligns,
        ['Date', 'Amount', 'Method'],
        { font: 'b', bold: true }
      );

      await printDivider('b', 1, 1);

      // Transaction rows
      for (const transaction of invoice.transactions) {
        const dateStr = format(new Date(transaction.createdAt), 'dd/MM hh:mm a');
        const amountStr = `${Number(transaction.amount || 0).toFixed(2)}`;
        const methodStr = (transaction.paymentMethod || '').toUpperCase();

        await Printer.printColumns(
          widths,
          aligns,
          [dateStr, amountStr, methodStr],
          { font: 'b' }
        );
      }

    });

    await safePrint(async () => {
      const gstRates = Object.keys(gstBreakdown).filter(r => parseFloat(r) > 0);
      if (!isGstInvoice || gstRates.length === 0) return;

      const isIgst = invoice?.isIgst === true;

      // 🖨️ Printer width auto-detect (58mm = 384px, 80mm = 576px)
      const printerWidthPx =
        store?.printerWidthPx ||
        (/80/.test(store?.printerModel || '') ? 576 : 384);

      await printDivider('a', 1, 1);
      await printWrappedText('TAX SUMMARY', {
        align: 'center',
        bold: true,
        font: 'b',
      });
      await printDivider('b', 1, 1);

      // ✅ Define layout dynamically
      const ratios = isIgst
        ? [0.25, 0.35, 0.40] // GST%, Taxable, IGST
        : [0.25, 0.25, 0.25, 0.25]; // GST%, Taxable, CGST, SGST

      const totalCapacity = getLineCapacity(printerWidthPx, 'b', 1);
      const widths = ratios.map(r => Math.floor(totalCapacity * r));
      const diff = totalCapacity - widths.reduce((a, b) => a + b, 0);
      widths[widths.length - 1] += diff;

      const aligns: Align[] = ['left', 'right', 'right', 'right'];
      const headers = isIgst
        ? ['GST%', 'Tax Value', 'IGST']
        : ['GST%', 'Tax Value', 'CGST', 'SGST'];

      await Printer.printColumns(widths, aligns.slice(0, headers.length), headers, {
        font: 'b',
        bold: true,
      });
      await printDivider('b', 1, 1);

      let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;

      for (const rate of gstRates) {
        const b = gstBreakdown[rate];
        const taxable = Number(b.taxableAmount || 0);
        const cgst = Number(b.cgstAmount || 0);
        const sgst = Number(b.sgstAmount || 0);
        const igst = Number(b.igstAmount || (cgst + sgst));

        totalTaxable += taxable;
        totalCGST += cgst;
        totalSGST += sgst;
        totalIGST += igst;

        const row = isIgst
          ? [
            `${parseFloat(rate).toFixed(2)}%`,
            taxable.toFixed(2),
            igst.toFixed(2),
          ]
          : [
            `${parseFloat(rate).toFixed(2)}%`,
            taxable.toFixed(2),
            cgst.toFixed(2),
            sgst.toFixed(2),
          ];

        await Printer.printColumns(widths, aligns.slice(0, row.length), row, {
          font: 'b',
        });
      }

      await printDivider('b', 1, 1);

      const totalRow = isIgst
        ? ['Total', totalTaxable.toFixed(2), totalIGST.toFixed(2)]
        : ['Total', totalTaxable.toFixed(2), totalCGST.toFixed(2), totalSGST.toFixed(2)];

      await Printer.printColumns(widths, aligns.slice(0, totalRow.length), totalRow, {
        font: 'b',
        bold: true,
        sizeW: 1,
        sizeH: 1,
      });
    });



    // Convert QR image into bitmap (ESC/POS needs base64 image)
    await safePrint(async () => {
      if (store?.bankDetails?.upiId) {
        // Title
        await printWrappedText("Scan & Pay", {
          align: "center",
          bold: true,
          font: "b",
        });

        // Load & print QR
        const qrBase64 = await urlToDataURL(qrURL);
        await Printer.printImageBase64(qrBase64, 180, "threshold"); // 180px good for 80mm printers

        // UPI ID
        await printWrappedText(`UPI: ${store.bankDetails.upiId}`, {
          align: "center",
          font: "a",
        });

        // Amount
        await printWrappedText(`Amount: Rs.${roundedGrandTotal}`, {
          align: "center",
          font: "a",
        });
      }
    });

    // 8) Footer
    await printDivider('a', 1, 1);
    await printWrappedText('Thank you for your purchase!', { align: 'center', font: 'b' });
    await printWrappedText('Visit Again', { align: 'center', font: 'b' });

    await safePrint(async () => {
      if (store?.signatureUrl) {
        const sigData = await urlToDataURL(store.signatureUrl);
        await Printer.printImageBase64(sigData, 150, "threshold");
      }
    });
    if (isFreePlan) {
      await printWrappedText('"Power by AMDAANI"', { align: 'center', font: 'a', bold: true });
    }
    await Printer.feed(2);
    try {
      await Printer.cut();
    } catch { }

  } catch (err) {
    console.error('[ThermalPrint] ERROR:', err);
  }
}
