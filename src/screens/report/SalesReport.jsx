import React, { useState, useMemo, useEffect } from 'react';
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
  Divider,
  IconButton,
  SegmentedButtons,
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
import { useRoute } from '@react-navigation/native';

const SalesReport = () => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [pickerMode, setPickerMode] = useState(null);

  const [dialogVisible, setDialogVisible] = useState(false);
  const [lastSavedPath, setLastSavedPath] = useState(null);

  // const { authData } = useAuth();   <-- remove this
  const { authState } = useAuth();

  // derive store with fallbacks
  const store = authState?.user?.store || authState?.store || null;
  const route = useRoute();
  const dashboardFlag = route?.params?.dashboardFlag || false;
  const dashboardWeeklyFlag = route?.params?.dashboardWeeklyFlag || false;
  const dashboardMonthlyFlag = route?.params?.dashboardMonthlyFlag || false;
  const dashboardTodayFlag = route?.params?.dashboardTodayFlag || false;
  const storeName = store?.name || store?.storeName || 'N/A';
  const address = (() => {
    if (!store?.address) return 'N/A';
    // if address object exists, format it, else if string use it directly
    if (typeof store.address === 'object') {
      const a = store.address;
      return [a.street, a.city, a.state, a.postalCode]
        .filter(Boolean)
        .join(', ');
    }
    return String(store.address);
  })();
  const contactNo = store?.contactNo || store?.contactNumber || 'N/A';
  const gstin = store?.gstNumber || store?.gstin || 'N/A';

  const formatDate = date => {
    if (!date) return 'All';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const formattedRange = useMemo(() => {
    const s = startDate ? formatDate(startDate) : 'All';
    const e = endDate ? formatDate(endDate) : 'All';
    return `${s} - ${e}`;
  }, [startDate, endDate]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await api.get('/invoice?limit=50000&status=active');
      // console.log('Sales Report Response:', res);
      let rows = res?.data?.docs || [];
      if (startDate && endDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        rows = rows.filter(inv => {
          const invDate = new Date(inv.invoiceDate);
          return invDate >= sDate && invDate <= eDate;
        });
      }
      setInvoices(rows);
    } catch (e) {
      console.error('Report fetch error:', e?.message);
      Alert.alert('Error', 'Failed to fetch report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchInvoices();
    }
  }, [startDate, endDate]);

  useEffect(() => {
    const today = new Date();
    if (dashboardFlag) {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      let fyStart =
        currentMonth >= 4
          ? new Date(currentYear, 3, 1)
          : new Date(currentYear - 1, 3, 1);

      setStartDate(fyStart);
      setEndDate(today);
    } else if (dashboardWeeklyFlag) {
      // Week start from Sunday
      const weekStart = new Date(today);
      const dayOfWeek = weekStart.getDay(); // 0 = Sunday
      weekStart.setDate(weekStart.getDate() - dayOfWeek);

      setStartDate(weekStart);
      setEndDate(today);
    } else if (dashboardMonthlyFlag) {
      // Month start (1st date)
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      setStartDate(monthStart);
      setEndDate(today);
    } else if (dashboardTodayFlag) {
      const today = new Date();

      setStartDate(today);
      setEndDate(today);
    }
  }, [
    dashboardFlag,
    dashboardWeeklyFlag,
    dashboardMonthlyFlag,
    dashboardTodayFlag,
  ]);

  const totals = useMemo(() => {
    const toNum = v => Number(v || 0);
    return {
      count: invoices.length,
      subTotal: invoices.reduce((s, r) => s + toNum(r.subTotal), 0),
      gstTotal: invoices.reduce((s, r) => s + toNum(r.gstTotal), 0),
      discountTotal: invoices.reduce((s, r) => s + toNum(r.discountTotal), 0),
      grandTotal: invoices.reduce((s, r) => s + toNum(r.grandTotal), 0),
    };
  }, [invoices]);

  const ensureAndroidDownloadPermission = async () => {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version < 29) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'Allow saving reports to Downloads folder',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const buildHTML = () => {
    const currency = n => `₹${Number(n || 0).toFixed(2)}`;
    const safe = v =>
      v === undefined || v === null || v === '' ? '-' : String(v);

    // Sort invoices by date ascending
    const sortedInvoices = [...invoices].sort(
      (a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate),
    );

    const headRow = `
  <tr>
    <th align="left">Date</th>
    <th align="left">Invoice No</th>
    <th align="left">Customer</th>
    <th align="left">Mobile</th>
    <th align="left">Address</th>
    <th align="right">Taxable Value</th>
    <th align="right">GST (Amt %)</th>
    <th align="right">CGST (Amt %)</th>
    <th align="right">SGST (Amt %)</th>
    <th align="right">Discount</th>
    <th align="right">Grand Total</th>
  </tr>`;

    const bodyRows = sortedInvoices
      .map(inv => {
        const date = inv.invoiceDate
          ? new Date(inv.invoiceDate).toLocaleDateString()
          : '-';

        // GST calculation logic
        const gstTotal = Number(inv.gstTotal || 0);
        const cgstAmt = gstTotal / 2;
        const sgstAmt = gstTotal / 2;

        const gstPercent = 18; // default if missing
        const halfPercent = gstPercent / 2;

        return `
    <tr>
      <td>${date}</td>
      <td>${safe(inv.invoiceNumber || inv._id)}</td>
      <td>${safe(inv.customerName)}</td>
      <td>${safe(inv.customerMobile)}</td>
      <td>${safe(inv.customerAddress)}</td>
      <td align="right">${currency(inv.subTotal)}</td>
      <td align="right">${currency(gstTotal)} (${gstPercent}%)</td>
      <td align="right">${currency(cgstAmt)} (${halfPercent}%)</td>
      <td align="right">${currency(sgstAmt)} (${halfPercent}%)</td>
      <td align="right">${currency(inv.discountTotal)}</td>
      <td align="right">${currency(inv.grandTotal)}</td>
    </tr>`;
      })
      .join('');

    return `
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4 landscape;  margin: 30px 24px; }

      body {
        font-family: -apple-system, Roboto, Segoe UI, Arial;
        padding: 0;
        color: #111;
      }

      h1 { font-size: 20px; margin: 0 0 4px; }
      .muted { color: #666; margin-bottom: 16px; }

      .summary {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
      }
      .chip {
        border-radius: 16px;
        padding: 6px 12px;
        background: #f2f2f2;
        font-size: 12px;
        color: #333;
        border: 1px solid #ddd;
      }

      table {
        border-collapse: collapse;
        width: 100%;
        table-layout: fixed;
        page-break-inside: auto;
      }

      tr { page-break-inside: avoid; page-break-after: auto; }

      th, td {
        border-bottom: 1px solid #eee;
        padding: 8px 6px;
        font-size: 11px;
        word-wrap: break-word;
      }

      th {
        background: #fafafa;
        font-weight: 700;
      }

      th:nth-child(6), td:nth-child(6),
      th:nth-child(7), td:nth-child(7),
      th:nth-child(8), td:nth-child(8),
      th:nth-child(9), td:nth-child(9),
      th:nth-child(10), td:nth-child(10),
      th:nth-child(11), td:nth-child(11) {
        text-align: right;
      }

      .grand-total {
        font-weight: bold;
        margin-top: 16px;
        border-top: 2px solid #333;
        padding-top: 8px;
        display: flex;
        justify-content: flex-end;
        font-size: 12px;
      }

      .grand-total span {
        min-width: 120px;
        text-align: right;
      }

      .footer {
        margin-top: 14px;
        color: #666;
        font-size: 10px;
      }
    </style>
  </head>
  <body>
      <h2 style="text-align:center;">${storeName}</h2>
        <p style="text-align:center;"><b>Address:</b> ${address}</p>
        <p style="text-align:center;"><b>Contact No:</b> ${contactNo}</p>
        ${gstin
        ? `<p style="text-align:center;"><b>GSTIN:</b> ${gstin}</p>`
        : ''
      }
    <h1>Sales Register</h1>
    <div class="muted">Period From : ${formattedRange}</div>

    <div class="summary">
      <div class="chip">Invoices: ${totals.count}</div>
      <div class="chip">Subtotal: ${currency(totals.subTotal)}</div>
      <div class="chip">GST: ${currency(totals.gstTotal)}</div>
      <div class="chip">Discount: ${currency(totals.discountTotal)}</div>
      <div class="chip">Grand Total: ${currency(totals.grandTotal)}</div>
    </div>

    <table>
      <thead>${headRow}</thead>
      <tbody>${bodyRows || `<tr><td colspan="11" align="center">No records</td></tr>`
      }</tbody>
    </table>

    <div class="grand-total">
      <div>
        <div>Subtotal: ${currency(totals.subTotal)}</div>
        <div>GST Total: ${currency(totals.gstTotal)}</div>
        <div>Discount Total: ${currency(totals.discountTotal)}</div>
        <div>Grand Total: <span>${currency(totals.grandTotal)}</span></div>
      </div>
    </div>

    <div class="footer">Powered by AMDAANI | ${new Date().toLocaleString()}</div>
  </body>
  </html>
  `;
  };

  const exportPDF = async () => {
    if (!invoices.length) {
      Alert.alert('No Data', 'Generate a report first.');
      return;
    }
    try {
      const storageOk = await ensureStoragePermission();
      const downloadsOk = await ensureAndroidDownloadPermission();
      if (!storageOk || !downloadsOk) return;

      const html = buildHTML();
      const pdfOptions = {
        html,
        fileName: `Sales_Register_${Date.now()}`,
        base64: false,
        orientation: 'landscape',
      };
      const pdfRes = await RNHTMLtoPDF.convert(pdfOptions);

      const downloadsDir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const suggested = `Sales_Register_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;
      let finalPath = `${downloadsDir}/${suggested}`;
      if (await RNFS.exists(finalPath)) {
        finalPath = `${downloadsDir}/Sales_Register_${new Date()
          .toISOString()
          .replace(/[:.]/g, '-')}.pdf`;
      }
      await RNFS.copyFile(pdfRes.filePath, finalPath);

      // ✅ Try to open PDF with FileViewer, handle missing app gracefully
      try {
        await FileViewer.open(finalPath, { showOpenWithDialog: true });
      } catch (openErr) {
        console.warn('No PDF viewer available:', openErr?.message);
        Alert.alert(
          'PDF Saved',
          'File saved to Downloads, but no PDF viewer is available.',
        );
      }

      setLastSavedPath(finalPath);
      setDialogVisible(true);
    } catch (e) {
      console.error('PDF export error:', e?.message);
      Alert.alert('Export Failed', 'Could not generate PDF. Please try again.');
    }
  };

  const exportExcel = async () => {
    const storageOk = await ensureStoragePermission();
    const downloadsOk = await ensureAndroidDownloadPermission();
    if (!storageOk || !downloadsOk) return;
    if (!invoices.length) {
      Alert.alert('No Data', 'No records to export.');
      return;
    }

    try {
      const sortedInvoices = [...invoices].sort(
        (a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate),
      );

      const data = sortedInvoices.map(inv => {
        const date = inv.invoiceDate
          ? new Date(inv.invoiceDate).toLocaleDateString()
          : '-';
        const gstTotal = Number(inv.gstTotal || 0);
        const cgstAmt = gstTotal / 2;
        const sgstAmt = gstTotal / 2;
        const gstPercent = 18;
        const halfPercent = gstPercent / 2;

        return {
          Date: date,
          'Invoice No': inv.invoiceNumber || inv._id || '-',
          Customer: inv.customerName || '-',
          Mobile: inv.customerMobile || '-',
          Address: inv.customerAddress || '-',
          'Taxable Value': Number(inv.subTotal || 0),
          'GST (Amt %)': `${gstTotal.toFixed(2)} (${gstPercent}%)`,
          'CGST (Amt %)': `${cgstAmt.toFixed(2)} (${halfPercent}%)`,
          'SGST (Amt %)': `${sgstAmt.toFixed(2)} (${halfPercent}%)`,
          Discount: Number(inv.discountTotal || 0),
          'Grand Total': Number(inv.grandTotal || 0),
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const colWidths = Object.keys(data[0]).map(key => ({
        wch: Math.max(12, key.length + 2),
      }));
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      const downloadsDir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const baseName = `Sales_Register_${new Date()
        .toISOString()
        .slice(0, 10)}`;
      let finalPath = `${downloadsDir}/${baseName}.xlsx`;

      if (await RNFS.exists(finalPath)) {
        finalPath = `${downloadsDir}/${baseName}_${Date.now()}.xlsx`;
      }

      await RNFS.writeFile(finalPath, wbout, 'base64');

      // ✅ Try to open Excel with FileViewer, handle missing app gracefully
      try {
        await FileViewer.open(finalPath, { showOpenWithDialog: true });
      } catch (openErr) {
        console.warn('No Excel viewer available:', openErr?.message);
        Alert.alert(
          'Excel Saved',
          'File saved to Downloads, but no Excel viewer is available.',
        );
      }

      setLastSavedPath(finalPath);
      setDialogVisible(true);
    } catch (e) {
      console.error('Excel export error:', e?.message);
      Alert.alert(
        'Export Failed',
        'Could not generate Excel file. Please try again.',
      );
    }
  };

  const renderItem = ({ item }) => {
    const date = item.invoiceDate
      ? new Date(item.invoiceDate).toLocaleDateString()
      : '-';
    return (
      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title={item.invoiceNumber || item._id || 'Invoice'}
          subtitle={date}
          titleVariant="titleMedium"
        />
        <Card.Content style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text variant="bodyMedium" numberOfLines={1}>
              {item.customerName || '-'}
            </Text>
            <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
              {item.customerMobile || '-'}
            </Text>
            <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
              {item.customerAddress || '-'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="titleMedium">
              ₹{Number(item.grandTotal || 0).toFixed(2)}
            </Text>
            <Text variant="bodySmall" style={styles.muted}>
              {item.type?.toUpperCase() || '-'}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar
        showBackButton
        title={'Sales Report'}
        rightComponent={
          <>
            <IconButton
              icon="file-pdf-box" // PDF icon
              iconColor="red"
              onPress={exportPDF}
              disabled={!invoices.length || loading}
              accessibilityLabel="Export PDF"
            />
            <IconButton
              icon="file-excel" // Excel icon
              iconColor="green"
              onPress={exportExcel}
              disabled={!invoices.length || loading}
              accessibilityLabel="Export Excel"
            />
          </>
        }
      />
      <View style={[styles.header, compact && { paddingHorizontal: 12 }]}>
        {/* First row: Date range selectors */}
        <View style={[styles.row, compact && { gap: 6 }]}>
          <Button
            mode="outlined"
            onPress={() => setPickerMode('start')}
            style={[styles.dateBtn, compact && { paddingHorizontal: 0 }]}
            icon="calendar-start"
            contentStyle={{ flexDirection: 'row-reverse' }}
          >
            {startDate ? formatDate(startDate) : 'Start Date'}
          </Button>
          <Button
            mode="outlined"
            onPress={() => setPickerMode('end')}
            style={[styles.dateBtn, compact && { paddingHorizontal: 0 }]}
            icon="calendar-end"
            contentStyle={{ flexDirection: 'row-reverse' }}
          >
            {endDate ? formatDate(endDate) : 'End Date'}
          </Button>
          <IconButton
            icon="calendar-remove"
            mode="contained-tonal"
            size={20}
            onPress={() => {
              setStartDate(null);
              setEndDate(null);
            }}
            style={styles.iconBtn}
            disabled={loading || (!startDate && !endDate)}
            accessibilityLabel="Clear date range"
          />
        </View>

        {/* Second row: Actions */}
        <View style={[styles.row, compact && { gap: 6 }]}>
          <Button
            mode="contained"
            onPress={fetchInvoices}
            disabled={!startDate || !endDate}
            style={{ flex: 1 }}
            labelStyle={[
              styles.submitButtonLabel,
              {
                color:
                  !startDate || !endDate
                    ? theme.colors.onBackground
                    : theme.colors.onSurface,
              },
            ]}
            icon={loading ? 'progress-clock' : 'refresh'}
          >
            {loading ? 'Loading...' : 'Generate'}
          </Button>
          {/* <Button
                        mode="contained-tonal"
                        onPress={exportPDF}
                        disabled={!invoices.length || loading}
                        style={styles.ml8}
                        icon="file-export-outline"
                    >
                        Export PDF
                    </Button>
                    <Button
                        mode="contained-tonal"
                        onPress={exportExcel}
                        disabled={!invoices.length || loading}
                        style={styles.ml8}
                        icon="file-excel"
                    >
                        Export Excel
                    </Button> */}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.mt8}>Loading...</Text>
        </View>
      ) : invoices.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>
            No records. Select a date range and Generate.
          </Text>
        </View>
      ) : (
        <>
          <View style={[styles.summaryWrap]}>
            <Card mode="elevated" style={styles.summaryCard}>
              <Card.Content style={styles.summaryContent}>
                {/* Range Section */}
                <View style={styles.summaryHeader}>
                  <Text variant="labelSmall" style={styles.summaryLabel}>
                    Range
                  </Text>
                  <Text
                    variant="titleSmall"
                    numberOfLines={1}
                    style={styles.summaryValue}
                  >
                    {formattedRange}
                  </Text>
                </View>

                <View
                  style={[styles.hr, { backgroundColor: theme.colors.outline }]}
                />

                {/* Totals Section */}
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCol}>
                    <Text variant="labelSmall" style={styles.summaryLabel}>
                      Total
                    </Text>
                    <Text variant="titleMedium" style={styles.summaryValue}>
                      ₹{totals.grandTotal.toFixed(2)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.vDivider,
                      { backgroundColor: theme.colors.outline },
                    ]}
                  />

                  <View style={styles.summaryCol}>
                    <Text variant="labelSmall" style={styles.summaryLabel}>
                      Count
                    </Text>
                    <Text variant="titleMedium" style={styles.summaryValue}>
                      {totals.count}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          </View>

          <FlatList
            data={invoices}
            keyExtractor={(item, idx) =>
              String(item._id || item.invoiceNumber || idx)
            }
            renderItem={renderItem}
            contentContainerStyle={styles.list}
          />
        </>
      )}

      <DateTimePickerModal
        isVisible={!!pickerMode}
        mode="date"
        maximumDate={new Date()}
        onConfirm={date => {
          if (pickerMode === 'start') setStartDate(date);
          if (pickerMode === 'end') setEndDate(date);
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
            <Text>PDF saved to Downloads.</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dateBtn: { flex: 1 },
  ml8: { marginLeft: 8 },
  iconBtn: {
    margin: 0,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  summaryWrap: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  summaryCard: {
    borderRadius: 10,
  },
  summaryContent: {
    paddingVertical: 6,
  },
  summaryHeader: {
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
  },
  summaryValue: {
    fontWeight: '600',
  },
  hr: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  vDivider: {
    width: StyleSheet.hairlineWidth,
    height: '100%',
    marginHorizontal: 8,
  },
  list: { padding: 12 },
  card: { marginBottom: 10, borderRadius: 12 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  muted: { color: '#6b7280' },
  mt8: { marginTop: 8 },
});

export default SalesReport;
