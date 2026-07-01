import { format } from 'date-fns';
import { Printer } from '../native/Printer';

type Align = 'left' | 'center' | 'right';
type FontType = 'a' | 'b';

// ---- helpers (mirrors printThermal.ts so KOT and bill output stay in sync) ----

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

function getLineCapacity(printerWidthPx = 384, font: 'a' | 'b' = 'a', sizeW = 1): number {
  const charWidth = font === 'a' ? 12 : 9;
  return Math.floor(printerWidthPx / (charWidth * sizeW));
}

// Sl.No / Item Name / Qty — narrower side columns, item name gets the rest.
function getKotColumnWidths(
  font: 'a' | 'b' = 'b',
  sizeW = 1,
  printerWidthPx = 384
): number[] {
  const total = getLineCapacity(printerWidthPx, font, sizeW);
  const ratios = [0.12, 0.63, 0.25]; // Sl.No, Item, Qty
  const widths = ratios.map(r => Math.floor(total * r));
  const diff = total - widths.reduce((a, b) => a + b, 0);
  widths[1] += diff; // give leftover space to the item-name column
  return widths;
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

// ✅ Safe wrapper — same as printThermal.ts, so one missing field (e.g. no
// logo, no customer name) never aborts the whole ticket.
async function safePrint(action: () => Promise<void>) {
  try {
    await action();
  } catch (err) {
    console.warn('[ThermalKOT] Skipped section due to error:', err);
  }
}

/**
 * Prints a Kitchen Order Ticket (KOT) on the connected Bluetooth thermal
 * printer. Shares the exact store header used by printThermalInvoice (logo,
 * name, tagline, address, GSTIN, contact, email) so KOT and bill printouts
 * look like they came from the same till — but carries no pricing/GST,
 * just a large "KOT" banner, the invoice number as the ticket number, and
 * the item list the kitchen needs to prepare.
 */
export async function printThermalKOT(invoice: any, items: any[], store: any) {
  const isGstInvoice = (invoice?.type || 'gst') !== 'non-gst';
  const cartItems = items?.length ? items : invoice?.items || [];

  const totalItems = cartItems.reduce(
    (sum: number, item: any) => sum + Number(item.quantity ?? item.qty ?? 0),
    0
  );

  try {
    // 1) Logo
    // await safePrint(async () => {
    //   if (store?.logoUrl) {
    //     const logoData = await urlToDataURL(store.logoUrl);
    //     await Printer.printImageBase64(logoData, 200, 'threshold');
    //   }
    // });

    // // 2) Store header — identical to printThermalInvoice
    // await safePrint(async () => {
    //   await printWrappedText(store?.name || 'STORE', {
    //     align: 'center',
    //     bold: true,
    //     font: 'a',
    //     sizeW: 1,
    //     sizeH: 1,
    //   });
    // });

    // await safePrint(async () => {
    //   if (store?.tagline) {
    //     await printWrappedText(store.tagline, { align: 'center', font: 'b' });
    //   }
    // });

    // await printDivider('b', 1, 1);

    // await safePrint(async () => {
    //   if (
    //     store?.address?.street ||
    //     store?.address?.city ||
    //     store?.address?.state ||
    //     store?.address?.postalCode
    //   ) {
    //     await printWrappedText(
    //       `${store?.address?.street || ''}, ${store?.address?.city || ''}, ${store?.address?.state || ''} ${store?.address?.postalCode || ''} `,
    //       { align: 'center', font: 'b' }
    //     );
    //   }
    // });

    // await safePrint(async () => {
    //   if (isGstInvoice && store?.gstNumber) {
    //     await printWrappedText(`GSTIN: ${store?.gstNumber || ''}`, {
    //       align: 'center',
    //       font: 'b',
    //     });
    //   }
    // });

    // await safePrint(async () => {
    //   if (store?.contactNo) {
    //     await printWrappedText(`Ph.No.: +91 - ${store.contactNo} `, {
    //       align: 'center',
    //       font: 'b',
    //     });
    //   }
    // });

    // await safePrint(async () => {
    //   if (store?.email) {
    //     await printWrappedText(`Email: ${store.email} `, {
    //       align: 'center',
    //       font: 'b',
    //     });
    //   }
    // });

    // await printDivider('b', 1, 1);

    // 3) "KOT" banner — large & bold so it reads instantly in the kitchen
    await Printer.printText('KOT', {
      align: 'center',
      bold: true,
      font: 'a',
      sizeW: 2,
      sizeH: 2,
    });

    await printDivider('b', 1, 1);

    // 4) Ticket details — the invoice number IS the ticket number, no
    // separate KOT numbering scheme
    await safePrint(async () => {
      await printWrappedText(`Invoice: ${invoice.invoiceNumber} `, { font: 'b' });
    });

    await safePrint(async () => {
      const formattedDate = format(new Date(invoice.invoiceDate), 'dd-MMM-yyyy hh:mm a');
      await printWrappedText(`Date: ${formattedDate} `, { font: 'b' });
    });

    await safePrint(async () => {
      if (invoice?.customerName) {
        await printWrappedText(`Customer: ${invoice.customerName} `, { font: 'b' });
      }
    });

    await printDivider('b', 1, 1);

    // 5) Items header — Sl.No / Item Name / Qty only, no rate/amount
    const colWidths = getKotColumnWidths('b');
    await Printer.printColumns(
      colWidths,
      ['center', 'left', 'right'],
      ['Sl.No', 'Item Name', 'Qty'],
      { bold: true, font: 'b' }
    );
    await printDivider('b', 1, 1);

    // 6) Items
    let slNo = 0;
    for (const item of cartItems) {
      slNo += 1;
      const qty = Number(item.quantity ?? item.qty ?? 0);
      const wrappedName = wrapTextForPrinter(item.name || '', 1, colWidths[1]);

      for (let i = 0; i < wrappedName.length; i++) {
        if (i === 0) {
          await Printer.printColumns(
            colWidths,
            ['center', 'left', 'right'],
            [String(slNo), wrappedName[i], String(qty)],
            { font: 'b' }
          );
        } else {
          await Printer.printColumns(
            colWidths,
            ['center', 'left', 'right'],
            ['', wrappedName[i], ''],
            { font: 'b' }
          );
        }
      }
    }

    await printDivider('b', 1, 1);

    // 7) Total items — sum of quantities, not just the row count
  await printDivider('b', 1, 1);

await Printer.printColumns(
  colWidths,                          // [slNo_width, itemName_width, qty_width]
  ['left', 'right', 'right'],         // same alignment structure as item rows
  ['', 'Total Qty:', String(totalItems)],
  { font: 'b', bold: true }           // same font as item rows (font 'b')
);

    // 8) Footer
    await printDivider('a', 1, 1);
    await printWrappedText('** KITCHEN ORDER COPY **', {
      align: 'center',
      bold: true,
      font: 'b',
    });

    await Printer.feed(2);

    // Not every printer model exposes a cut command — guard so a missing
    // method doesn't fail a ticket that already printed fine.
    await safePrint(async () => {
      if (typeof (Printer as any).cutPaper === 'function') {
        await (Printer as any).cutPaper();
      }
    });
  } catch (err) {
    console.error('[ThermalKOT] Print failed:', err);
    throw err;
  }
}