import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  Platform,
  PermissionsAndroid,
  useWindowDimensions,
} from 'react-native';
import {
  Text,
  Button,
  useTheme,
  ActivityIndicator,
  Card,
  Portal,
  Dialog,
  IconButton,
  Divider,
} from 'react-native-paper';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';
import XLSX from 'xlsx';
import api from '../../utils/api';
import { ensureStoragePermission } from '../../utils/permissions';
import { SafeAreaView } from 'react-native-safe-area-context';
import Navbar from '../../components/Navbar';
import FileViewer from 'react-native-file-viewer';
import { useAuth } from '../../context/AuthContext';

/*
  API response shape  →  /expense/ledger
  {
    summary: { totalPurchaseExpense, totalTaxableValue, totalCGST, totalSGST,
               totalOtherExpense, grandTotalExpense },
    data: [{ _id, date, invoiceNo, purchaseVendor, totalQuantity, rate,
             taxableValue, cgst, sgst, totalExpense }],
    otherExpenses: [
      {
        expenseHead: "Vbj",
        totalAmount: 2000,
        expenses: [{ _id, date, amount, paymentMethod, paidTo, notes }]
      }
    ]
  }
*/

// ─── helpers ──────────────────────────────────────────────────────────────────

const currency = v => `₹${Number(v || 0).toFixed(2)}`;
const safe = v => (v === undefined || v === null || v === '' ? '-' : String(v));
const num = v => Number(v || 0);

const formatDDMMYY = dateStr => {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(
    d.getMonth() + 1,
  ).padStart(2, '0')}/${d.getFullYear()}`;
};

const formatShort = date => {
  if (!date) return 'All';
  return `${String(date.getDate()).padStart(2, '0')}/${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
};

// ─── presentational atoms ─────────────────────────────────────────────────────

const StatCol = ({ label, value, color }) => (
  <View style={styles.statCol}>
    <Text variant="labelSmall" style={styles.mutedText}>
      {label}
    </Text>
    <Text
      variant="labelLarge"
      style={[{ fontWeight: '700' }, color ? { color } : {}]}
    >
      {value}
    </Text>
  </View>
);

const SummaryCol = ({ label, value, green, red, theme }) => {
  const color = green ? '#16a34a' : red ? theme.colors.error : undefined;
  return (
    <View style={styles.summaryCol}>
      <Text variant="labelSmall" style={styles.mutedText}>
        {label}
      </Text>
      <Text
        variant="titleSmall"
        style={[{ fontWeight: '700' }, color ? { color } : {}]}
      >
        {value}
      </Text>
    </View>
  );
};

const SummaryDivider = ({ theme }) => (
  <View style={[styles.vDivider, { backgroundColor: theme.colors.outline }]} />
);

// ─── component ────────────────────────────────────────────────────────────────

const ExpenseHeadReport = () => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const [purchaseData, setPurchaseData] = useState([]);
  const [otherExpenses, setOtherExpenses] = useState([]); // grouped by expenseHead
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [pickerMode, setPickerMode] = useState(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [lastSavedPath, setLastSavedPath] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);
  // track which expenseHead groups are expanded: { [headName]: bool }
  const [expandedHeads, setExpandedHeads] = useState({});

  const { authState } = useAuth();
  const store = authState?.user?.store || authState?.store || null;
  const storeName = store?.name || store?.storeName || 'Store';
  const address = (() => {
    if (!store?.address) return '';
    if (typeof store.address === 'object') {
      const a = store.address;
      return [a.street, a.city, a.state, a.postalCode]
        .filter(Boolean)
        .join(', ');
    }
    return String(store.address);
  })();
  const gstin = store?.gstNumber || store?.gstin || '';

  const formattedRange = useMemo(
    () => `${formatShort(startDate)} – ${formatShort(endDate)}`,
    [startDate, endDate],
  );

  const toggleHead = key =>
    setExpandedHeads(prev => ({ ...prev, [key]: !prev[key] }));

  // ── fetch ─────────────────────────────────────────────────────────────────

  const fetchReport = useCallback(
    async (start = startDate, end = endDate) => {
      if (!start || !end) {
        Alert.alert('Missing Dates', 'Please select both start and end dates.');
        return;
      }
      try {
        setLoading(true);
        const res = await api.get('/expense/ledger', {
          params: {
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
          },
        });

        if (res?.success) {
          const d = res.data;
          const rows = Array.isArray(d.data) ? d.data : [];
          const oth = Array.isArray(d.otherExpenses) ? d.otherExpenses : [];
          setPurchaseData(rows);
          setOtherExpenses(oth);
          setSummary(d.summary || null);
          setHasFetched(true);
          // auto-expand first head
          if (oth.length > 0) {
            setExpandedHeads({ [oth[0].expenseHead]: true });
          }
        } else {
          Alert.alert('No Data', res?.message || 'No records found.');
          setPurchaseData([]);
          setOtherExpenses([]);
          setSummary(null);
        }
      } catch (err) {
        console.error('Fetch error:', err?.message);
        Alert.alert('Error', 'Failed to fetch report.');
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate],
  );

  // ── quick-select helpers ──────────────────────────────────────────────────

  const applyRange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
    fetchReport(start, end);
  };

  const applyThisYear = () => {
    const today = new Date();
    const fy =
      today.getMonth() + 1 >= 4
        ? new Date(today.getFullYear(), 3, 1)
        : new Date(today.getFullYear() - 1, 3, 1);
    applyRange(fy, today);
  };

  const applyThisMonth = () => {
    const today = new Date();
    applyRange(new Date(today.getFullYear(), today.getMonth(), 1), today);
  };

  const applyPreviousMonth = () => {
    const today = new Date();
    applyRange(
      new Date(today.getFullYear(), today.getMonth() - 1, 1),
      new Date(today.getFullYear(), today.getMonth(), 0),
    );
  };

  const clearDates = () => {
    setStartDate(null);
    setEndDate(null);
    setPurchaseData([]);
    setOtherExpenses([]);
    setSummary(null);
    setHasFetched(false);
  };

  // ── permissions ───────────────────────────────────────────────────────────

  const ensureAndroidDownloadPermission = async () => {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version < 29) {
      const g = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'Allow saving reports',
          buttonPositive: 'OK',
        },
      );
      return g === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  // ── HTML builder ──────────────────────────────────────────────────────────

  const buildHTML = () => {
    const purchaseRows = purchaseData
      .map(
        (r, i) => `
      <tr>
        <td style="padding:6px;border-bottom:1px solid #eee;font-size:10px;">${
          i + 1
        }</td>
        <td style="padding:6px;border-bottom:1px solid #eee;font-size:10px;">${formatDDMMYY(
          r.date,
        )}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;font-size:10px;">${safe(
          r.purchaseVendor,
        )}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;font-size:10px;">${safe(
          r.invoiceNo,
        )}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;font-size:10px;text-align:right;">${num(
          r.totalQuantity,
        )}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;font-size:10px;text-align:right;">${currency(
          r.rate,
        )}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;font-size:10px;text-align:right;">${currency(
          r.taxableValue,
        )}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;font-size:10px;text-align:right;">${currency(
          r.cgst,
        )}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;font-size:10px;text-align:right;">${currency(
          r.sgst,
        )}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;font-size:10px;text-align:right;font-weight:700;">${currency(
          r.totalExpense,
        )}</td>
      </tr>`,
      )
      .join('');

    // Other expenses: one sub-table per expenseHead group
    // colgroup ensures header and data columns are identical widths
    const otherSections = otherExpenses
      .map(
        (group, gi) => `
      <div style="margin-top:${gi === 0 ? 24 : 16}px;">
        <div style="background:#fff3e0;padding:8px 14px;border-radius:8px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">
          <b style="font-size:11px;">${safe(group.expenseHead)}</b>
          <span style="font-size:10px;">Total: <b style="color:#e65100;">${currency(
            group.totalAmount,
          )}</b></span>
        </div>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
          <colgroup>
            <col style="width:5%;"/>
            <col style="width:14%;"/>
            <col style="width:22%;"/>
            <col style="width:26%;"/>
            <col style="width:15%;"/>
            <col style="width:18%;"/>
          </colgroup>
          <thead>
            <tr style="background:#fafafa;">
              <th style="padding:5px 6px;border-bottom:1px solid #ddd;font-size:10px;text-align:center;">#</th>
              <th style="padding:5px 6px;border-bottom:1px solid #ddd;font-size:10px;text-align:left;">Date</th>
              <th style="padding:5px 6px;border-bottom:1px solid #ddd;font-size:10px;text-align:left;">Paid To</th>
              <th style="padding:5px 6px;border-bottom:1px solid #ddd;font-size:10px;text-align:left;">Notes</th>
              <th style="padding:5px 6px;border-bottom:1px solid #ddd;font-size:10px;text-align:left;">Payment</th>
              <th style="padding:5px 6px;border-bottom:1px solid #ddd;font-size:10px;text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${group.expenses
              .map(
                (e, i) => `
              <tr>
                <td style="padding:5px 6px;border-bottom:1px solid #eee;font-size:10px;text-align:center;">${
                  i + 1
                }</td>
                <td style="padding:5px 6px;border-bottom:1px solid #eee;font-size:10px;">${formatDDMMYY(
                  e.date,
                )}</td>
                <td style="padding:5px 6px;border-bottom:1px solid #eee;font-size:10px;overflow:hidden;">${safe(
                  e.paidTo,
                )}</td>
                <td style="padding:5px 6px;border-bottom:1px solid #eee;font-size:10px;color:#555;overflow:hidden;">${safe(
                  e.notes,
                )}</td>
                <td style="padding:5px 6px;border-bottom:1px solid #eee;font-size:10px;">${safe(
                  e.paymentMethod,
                )}</td>
                <td style="padding:5px 6px;border-bottom:1px solid #eee;font-size:10px;text-align:right;font-weight:700;color:#e65100;">${currency(
                  e.amount,
                )}</td>
              </tr>`,
              )
              .join('')}
            <tr>
              <td colspan="5" style="padding:6px;text-align:right;font-weight:bold;border-top:1.5px solid #ff9800;font-size:10px;color:#e65100;">Head Total:</td>
              <td style="padding:6px;text-align:right;font-weight:bold;border-top:1.5px solid #ff9800;font-size:11px;color:#e65100;">${currency(
                group.totalAmount,
              )}</td>
            </tr>
          </tbody>
        </table>
      </div>`,
      )
      .join('');

    const grandOtherTotal = otherExpenses.reduce(
      (s, g) => s + num(g.totalAmount),
      0,
    );
    const otherBlock = otherExpenses.length
      ? `
      <div style="margin-top:24px;margin-bottom:24px;">
        <h3 style="margin-bottom:8px;">Other Expenses</h3>
        ${otherSections}
        <div style="margin-top:10px;text-align:right;font-weight:bold;font-size:12px;color:#e65100;">
          Grand Other Total: ${currency(grandOtherTotal)}
        </div>
      </div>`
      : '';

    return `
      <html><head><meta charset="utf-8"/>
      <style>
        body { font-family:Roboto,Arial; margin:0; padding:16px; color:#111; font-size:11px; }
        h1   { font-size:18px; margin-bottom:2px; }
        .sub { color:#666; margin-bottom:14px; }
        .chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }
        .chip  { background:#f0f0f0; border:1px solid #ddd; border-radius:12px; padding:4px 10px; font-size:10px; }
        .footer{ margin-top:14px; color:#888; font-size:9px; }
      </style></head><body>
        <h2 style="text-align:center;">${storeName}</h2>
        ${address ? `<p style="text-align:center;">${address}</p>` : ''}
        ${gstin ? `<p style="text-align:center;">GSTIN: ${gstin}</p>` : ''}
        <h1>Expense Report</h1>
        <div class="sub">Period: ${formattedRange}</div>
        <div class="chips">
          <div class="chip">Entries: ${purchaseData.length}</div>
          <div class="chip">Taxable: ${currency(
            summary?.totalTaxableValue,
          )}</div>
          <div class="chip">CGST: ${currency(summary?.totalCGST)}</div>
          <div class="chip">SGST: ${currency(summary?.totalSGST)}</div>
          <div class="chip">Purchase Total: ${currency(
            summary?.totalPurchaseExpense,
          )}</div>
          <div class="chip">Other Exp: ${currency(
            summary?.totalOtherExpense,
          )}</div>
         <div class="chip" style="background:#e8f0fe;border-color:#3b5bdb;">
  <b>Grand Total (Purchase + Other): ${currency(summary?.grandTotalExpense)}</b>
</div>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f0f4ff;">
              <th style="padding:6px;border-bottom:1px solid #ddd;font-size:11px;text-align:left;">#</th>
              <th style="padding:6px;border-bottom:1px solid #ddd;font-size:11px;text-align:left;">Date</th>
              <th style="padding:6px;border-bottom:1px solid #ddd;font-size:11px;text-align:left;">Vendor</th>
              <th style="padding:6px;border-bottom:1px solid #ddd;font-size:11px;text-align:left;">Invoice</th>
              <th style="padding:6px;border-bottom:1px solid #ddd;font-size:11px;text-align:right;">Qty</th>
              <th style="padding:6px;border-bottom:1px solid #ddd;font-size:11px;text-align:right;">Rate</th>
              <th style="padding:6px;border-bottom:1px solid #ddd;font-size:11px;text-align:right;">Taxable</th>
              <th style="padding:6px;border-bottom:1px solid #ddd;font-size:11px;text-align:right;">CGST</th>
              <th style="padding:6px;border-bottom:1px solid #ddd;font-size:11px;text-align:right;">SGST</th>
              <th style="padding:6px;border-bottom:1px solid #ddd;font-size:11px;text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${purchaseRows}
            <tr>
              <td colspan="9" style="padding:6px;text-align:right;font-weight:bold;border-top:2px solid #333;">Purchase Total:</td>
              <td style="padding:6px;text-align:right;font-weight:bold;border-top:2px solid #333;">${currency(
                summary?.totalPurchaseExpense,
              )}</td>
            </tr>
          </tbody>
        </table>
        ${otherBlock}
        <div class="footer">Generated ${new Date().toLocaleString()}</div>
      </body></html>`;
  };

  // ── PDF export ────────────────────────────────────────────────────────────

  const exportPDF = async () => {
    if (!purchaseData.length && !otherExpenses.length) {
      Alert.alert('No Data', 'Generate a report first.');
      return;
    }
    try {
      const ok1 = await ensureStoragePermission();
      const ok2 = await ensureAndroidDownloadPermission();
      if (!ok1 || !ok2) return;
      const pdfRes = await RNHTMLtoPDF.convert({
        html: buildHTML(),
        fileName: `Expense_Report_${Date.now()}`,
        base64: false,
      });
      const dir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      let path = `${dir}/Expense_Report_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;
      if (await RNFS.exists(path))
        path = `${dir}/Expense_Report_${Date.now()}.pdf`;
      await RNFS.copyFile(pdfRes.filePath, path);
      try {
        await FileViewer.open(path, { showOpenWithDialog: true });
      } catch {
        Alert.alert('PDF Saved', 'Saved to Downloads.');
      }
      setLastSavedPath(path);
      setDialogVisible(true);
    } catch (e) {
      console.error('PDF error:', e?.message);
      Alert.alert('Export Failed', 'Could not generate PDF.');
    }
  };

  // ── Excel export ──────────────────────────────────────────────────────────

  const exportExcel = async () => {
    if (!purchaseData.length && !otherExpenses.length) {
      Alert.alert('No Data', 'Generate a report first.');
      return;
    }
    try {
      const ok1 = await ensureStoragePermission();
      const ok2 = await ensureAndroidDownloadPermission();
      if (!ok1 || !ok2) return;

      const purchaseSheet = purchaseData.map((r, i) => ({
        '#': i + 1,
        Date: formatDDMMYY(r.date),
        Vendor: safe(r.purchaseVendor),
        Invoice: safe(r.invoiceNo),
        Qty: num(r.totalQuantity),
        Rate: num(r.rate),
        'Taxable Value': num(r.taxableValue),
        CGST: num(r.cgst),
        SGST: num(r.sgst),
        'Total Expense': num(r.totalExpense),
      }));

      // Flatten otherExpenses groups for Excel — include expenseHead column
      const otherSheet = otherExpenses.flatMap((group, gi) =>
        group.expenses.map((e, i) => ({
          '#': i + 1,
          'Expense Head': safe(group.expenseHead),
          Date: formatDDMMYY(e.date),
          'Paid To': safe(e.paidTo),
          Notes: safe(e.notes),
          Payment: safe(e.paymentMethod),
          Amount: num(e.amount),
        })),
      );

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(purchaseSheet),
        'Purchases',
      );
      if (otherSheet.length)
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(otherSheet),
          'Other Expenses',
        );

      const out = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const dir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      let path = `${dir}/Expense_Report_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;
      if (await RNFS.exists(path))
        path = `${dir}/Expense_Report_${Date.now()}.xlsx`;
      await RNFS.writeFile(path, out, 'base64');
      try {
        await FileViewer.open(path, { showOpenWithDialog: true });
      } catch {
        Alert.alert('Excel Saved', 'Saved to Downloads.');
      }
      setLastSavedPath(path);
      setDialogVisible(true);
    } catch (e) {
      console.error('Excel error:', e?.message);
      Alert.alert('Export Failed', 'Could not generate Excel.');
    }
  };

  // ── flat purchase item card ───────────────────────────────────────────────

  const renderPurchaseCard = useCallback(
    ({ item: r }) => (
      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text
                variant="titleSmall"
                numberOfLines={1}
                style={{ fontWeight: '700' }}
              >
                {r.purchaseVendor || 'Unknown Vendor'}
              </Text>
              <Text variant="labelSmall" style={styles.mutedText}>
                Inv# {safe(r.invoiceNo)} • {formatDDMMYY(r.date)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="labelSmall" style={styles.mutedText}>
                Total
              </Text>
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.primary, fontWeight: '700' }}
              >
                {currency(r.totalExpense)}
              </Text>
            </View>
          </View>
          <Divider style={{ marginBottom: 10 }} />
          <View style={styles.detailGrid}>
            <StatCol label="Qty" value={String(num(r.totalQuantity))} />
            <StatCol label="Rate" value={currency(r.rate)} />
            <StatCol label="Taxable" value={currency(r.taxableValue)} />
            <StatCol label="CGST" value={currency(r.cgst)} color="#e65100" />
            <StatCol label="SGST" value={currency(r.sgst)} color="#e65100" />
          </View>
        </Card.Content>
      </Card>
    ),
    [theme],
  );

  // ── Other expenses section — one card per expenseHead ─────────────────────

  const OtherExpensesSection = () => {
    if (!otherExpenses.length) return null;
    const grandTotal = otherExpenses.reduce(
      (s, g) => s + num(g.totalAmount),
      0,
    );

    return (
      <>
        {/* Section title row */}
        <View style={styles.sectionTitleRow}>
          <Text variant="titleSmall" style={{ fontWeight: '700' }}>
            Other Expenses
          </Text>
          <Text
            variant="titleSmall"
            style={{ color: '#e65100', fontWeight: '700' }}
          >
            {currency(grandTotal)}
          </Text>
        </View>

        {otherExpenses.map((group, gi) => {
          const expanded = !!expandedHeads[group.expenseHead];
          return (
            <Card
              key={group.expenseHead || gi}
              mode="outlined"
              style={[styles.card, { borderColor: '#ff9800' }]}
            >
              <Card.Content style={styles.cardContent}>
                {/* Head header */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="titleSmall"
                      style={{ fontWeight: '700' }}
                      numberOfLines={1}
                    >
                      {group.expenseHead || 'Other'}
                    </Text>
                    <Text variant="labelSmall" style={styles.mutedText}>
                      {group.expenses.length} entr
                      {group.expenses.length !== 1 ? 'ies' : 'y'}
                    </Text>
                  </View>
                  <View
                    style={{
                      alignItems: 'flex-end',
                      flexDirection: 'row',
                      gap: 8,
                    }}
                  >
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text variant="labelSmall" style={styles.mutedText}>
                        Total
                      </Text>
                      <Text
                        variant="titleMedium"
                        style={{ color: '#e65100', fontWeight: '700' }}
                      >
                        {currency(group.totalAmount)}
                      </Text>
                    </View>
                    <IconButton
                      icon={expanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      onPress={() => toggleHead(group.expenseHead)}
                      style={{ margin: 0 }}
                    />
                  </View>
                </View>

                {/* Expandable entries */}
                {expanded && (
                  <>
                    <Divider style={{ marginBottom: 8 }} />

                    {/* Column headers */}
                    <View style={styles.otherExpHeader}>
                      <Text
                        variant="labelSmall"
                        style={[styles.mutedText, styles.colHead, { flex: 2 }]}
                      >
                        PAID TO
                      </Text>
                      <Text
                        variant="labelSmall"
                        style={[
                          styles.mutedText,
                          styles.colHead,
                          { flex: 1.2 },
                        ]}
                      >
                        DATE
                      </Text>
                      <Text
                        variant="labelSmall"
                        style={[styles.mutedText, styles.colHead, { flex: 1 }]}
                      >
                        PAYMENT
                      </Text>
                      <Text
                        variant="labelSmall"
                        style={[
                          styles.mutedText,
                          styles.colHead,
                          styles.colRight,
                          { flex: 1 },
                        ]}
                      >
                        AMOUNT
                      </Text>
                    </View>
                    <Divider style={{ marginBottom: 4 }} />

                    {group.expenses.map((e, i) => (
                      <View key={e._id || i}>
                        <View style={styles.otherExpRow}>
                          {/* Paid To + Notes */}
                          <View style={{ flex: 2 }}>
                            <Text
                              variant="labelMedium"
                              style={{ fontWeight: '600' }}
                              numberOfLines={1}
                            >
                              {safe(e.paidTo)}
                            </Text>
                            {e.notes ? (
                              <Text
                                variant="labelSmall"
                                style={[
                                  styles.mutedText,
                                  { fontSize: 10, fontStyle: 'italic' },
                                ]}
                                numberOfLines={1}
                              >
                                {e.notes}
                              </Text>
                            ) : null}
                          </View>

                          {/* Date */}
                          <Text
                            variant="labelSmall"
                            style={[styles.mutedText, { flex: 1.2 }]}
                          >
                            {formatDDMMYY(e.date)}
                          </Text>

                          {/* Payment method tag */}
                          <View style={{ flex: 1 }}>
                            <View
                              style={[
                                styles.tag,
                                {
                                  backgroundColor: theme.colors.surfaceVariant,
                                  alignSelf: 'flex-start',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.tagText,
                                  {
                                    color: theme.colors.onSurfaceVariant,
                                    fontSize: 10,
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {e.paymentMethod || '—'}
                              </Text>
                            </View>
                          </View>

                          {/* Amount */}
                          <Text
                            variant="labelLarge"
                            style={{
                              flex: 1,
                              color: '#e65100',
                              fontWeight: '700',
                              textAlign: 'right',
                            }}
                          >
                            {currency(e.amount)}
                          </Text>
                        </View>
                        <Divider style={{ opacity: 0.35 }} />
                      </View>
                    ))}

                    {/* Head subtotal footer */}
                    <View
                      style={[
                        styles.grandTotalRow,
                        { borderTopColor: '#ff9800' },
                      ]}
                    >
                      <View style={styles.grandTotalMeta}>
                        <Text variant="labelSmall" style={styles.mutedText}>
                          {group.expenses.length} entr
                          {group.expenses.length !== 1 ? 'ies' : 'y'}
                        </Text>
                      </View>
                      <View style={styles.grandTotalValue}>
                        <Text variant="labelSmall" style={styles.mutedText}>
                          Head Total
                        </Text>
                        <Text
                          variant="titleMedium"
                          style={{ color: '#e65100', fontWeight: '800' }}
                        >
                          {currency(group.totalAmount)}
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </Card.Content>
            </Card>
          );
        })}
      </>
    );
  };

  // ── empty state ───────────────────────────────────────────────────────────

  const emptyMessage =
    !startDate || !endDate
      ? 'Select a date range and tap Generate.'
      : hasFetched
      ? 'No records found for the selected period.'
      : 'Tap Generate to load the report.';

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar
        showBackButton
        title="Expense Report"
        rightComponent={
          <>
            <IconButton
              icon="file-pdf-box"
              iconColor="red"
              onPress={exportPDF}
              disabled={
                (!purchaseData.length && !otherExpenses.length) || loading
              }
            />
            <IconButton
              icon="file-excel"
              iconColor="green"
              onPress={exportExcel}
              disabled={
                (!purchaseData.length && !otherExpenses.length) || loading
              }
            />
          </>
        }
      />

      {/* ── Controls ── */}
      <View style={[styles.header, compact && { paddingHorizontal: 12 }]}>
        <View style={[styles.row, compact && { gap: 6 }]}>
          <Button
            mode="outlined"
            onPress={() => setPickerMode('start')}
            style={[styles.dateBtn, compact && { paddingHorizontal: 0 }]}
            icon="calendar-start"
            contentStyle={{ flexDirection: 'row-reverse' }}
          >
            {startDate ? formatShort(startDate) : 'Start Date'}
          </Button>
          <Button
            mode="outlined"
            onPress={() => setPickerMode('end')}
            style={[styles.dateBtn, compact && { paddingHorizontal: 0 }]}
            icon="calendar-end"
            contentStyle={{ flexDirection: 'row-reverse' }}
          >
            {endDate ? formatShort(endDate) : 'End Date'}
          </Button>
          <IconButton
            icon="calendar-remove"
            mode="contained-tonal"
            size={20}
            onPress={clearDates}
            style={styles.iconBtn}
            disabled={loading || (!startDate && !endDate)}
          />
        </View>

        <View style={[styles.row, compact && { gap: 4 }]}>
          {[
            { label: 'This Year', fn: applyThisYear },
            { label: 'This Month', fn: applyThisMonth },
            { label: 'Prev Month', fn: applyPreviousMonth },
          ].map(({ label, fn }) => (
            <Button
              key={label}
              mode="outlined"
              compact
              onPress={fn}
              style={{ flex: 1 }}
              labelStyle={{ fontSize: 11 }}
              disabled={loading}
            >
              {label}
            </Button>
          ))}
        </View>

        <Button
          mode="contained"
          onPress={() => fetchReport(startDate, endDate)}
          disabled={!startDate || !endDate || loading}
          style={{ borderRadius: 8 }}
          icon={loading ? 'progress-clock' : 'refresh'}
        >
          {loading ? 'Loading…' : 'Generate'}
        </Button>
      </View>

      {/* ── Body ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.mt8}>Loading…</Text>
        </View>
      ) : !purchaseData.length && !otherExpenses.length ? (
        <View style={styles.center}>
          <Text style={styles.mutedText}>{emptyMessage}</Text>
        </View>
      ) : (
        <>
          {summary && (
            <View style={styles.summaryWrap}>
              <Card mode="elevated" style={styles.summaryCard}>
                <Card.Content style={styles.summaryContent}>
                  <Text variant="labelSmall" style={styles.mutedText}>
                    {formattedRange}
                  </Text>
                  <View style={styles.summaryRow}>
                    <SummaryCol
                      theme={theme}
                      label="Taxable"
                      value={currency(summary.totalTaxableValue)}
                    />
                    <SummaryDivider theme={theme} />
                    <SummaryCol
                      theme={theme}
                      label="CGST"
                      value={currency(summary.totalCGST)}
                      red
                    />
                    <SummaryDivider theme={theme} />
                    <SummaryCol
                      theme={theme}
                      label="SGST"
                      value={currency(summary.totalSGST)}
                      red
                    />
                    <SummaryDivider theme={theme} />
                    <SummaryCol
                      theme={theme}
                      label="Other Exp"
                      value={currency(summary.totalOtherExpense)}
                      red
                    />
                    <SummaryDivider theme={theme} />
                    <SummaryCol
                      theme={theme}
                      label="Grand Total" // already correct — shows purchase + other
                      value={currency(summary.grandTotalExpense)} // = totalPurchaseExpense + totalOtherExpense
                    />
                  </View>
                </Card.Content>
              </Card>
            </View>
          )}

          <FlatList
            data={purchaseData}
            keyExtractor={item => item._id || String(Math.random())}
            renderItem={renderPurchaseCard}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={<OtherExpensesSection />}
          />
        </>
      )}

      <DateTimePickerModal
        isVisible={!!pickerMode}
        mode="date"
        maximumDate={new Date()}
        onConfirm={date => {
          if (pickerMode === 'start') setStartDate(date);
          else setEndDate(date);
          setPickerMode(null);
        }}
        onCancel={() => setPickerMode(null)}
      />

      <Portal>
        <Dialog
          visible={dialogVisible}
          onDismiss={() => setDialogVisible(false)}
        >
          <Dialog.Title>Saved</Dialog.Title>
          <Dialog.Content>
            <Text>File saved to Downloads.</Text>
            {lastSavedPath ? <Text selectable>{lastSavedPath}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 10, paddingTop: 8, paddingBottom: 4 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dateBtn: { flex: 1 },
  iconBtn: { margin: 0 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  mt8: { marginTop: 8 },
  mutedText: { color: '#6b7280' },

  summaryWrap: { paddingHorizontal: 10, paddingVertical: 6 },
  summaryCard: { borderRadius: 12 },
  summaryContent: { paddingVertical: 8 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  summaryCol: { flex: 1, alignItems: 'center' },
  vDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    marginHorizontal: 4,
  },

  list: { padding: 12, paddingBottom: 32 },
  card: { marginBottom: 10, borderRadius: 14 },
  cardContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginBottom: 4,
  },

  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  tagText: { fontWeight: '600', fontSize: 11 },

  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0, marginTop: 4 },
  statCol: { minWidth: '20%', flex: 1, marginBottom: 4 },

  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1.5,
  },
  grandTotalMeta: { flex: 1, gap: 2 },
  grandTotalValue: { alignItems: 'flex-end' },

  otherExpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  otherExpRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  colHead: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  colRight: { textAlign: 'right' },
});

export default ExpenseHeadReport;
