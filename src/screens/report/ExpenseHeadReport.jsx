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
  IconButton,
  List,
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
import CustomAlert from '../../components/CustomAlert';
import { useAuth } from '../../context/AuthContext';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Group a flat array of records by a key-extractor fn */
const groupBy = (arr, keyFn) => {
  const map = {};
  arr.forEach(item => {
    const k = keyFn(item);
    if (!map[k]) map[k] = [];
    map[k].push(item);
  });
  return map;
};

const currency = n => `₹${Number(n || 0).toFixed(2)}`;

const formatDDMMYYYY = dateStr => {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatShort = date => {
  if (!date) return 'All';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

// ─── component ───────────────────────────────────────────────────────────────

const ExpenseHeadReport = () => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  // raw flat records from API
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [pickerMode, setPickerMode] = useState(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [lastSavedPath, setLastSavedPath] = useState(null);
  const [expandedHeads, setExpandedHeads] = useState({});

  const { authState } = useAuth();
  const store = authState?.user?.store || authState?.store || null;
  const storeName = store?.name || store?.storeName || 'N/A';
  const address = (() => {
    if (!store?.address) return 'N/A';
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

  // ── Derived grouped data ─────────────────────────────────────────────────
  /**
   * Group flat records by vendorName (or fall back to "Unknown Vendor").
   * Each group becomes one "head" card identical to the old structure:
   *   { headId, headName, totalAmount, count, expenses: [...] }
   */
  const data = useMemo(() => {
    if (!rawData.length) return [];

    const grouped = groupBy(rawData, r => r.vendorName || 'Unknown Vendor');

    const heads = Object.entries(grouped).map(([vendorName, records]) => {
      const totalAmount = records.reduce(
        (s, r) => s + Number(r.grandTotal || r.amount || 0),
        0,
      );
      return {
        headId: vendorName, // unique key
        headName: vendorName,
        totalAmount,
        count: records.length,
        expenses: records.map(r => ({
          _id: r._id,
          date: r.date,
          paymentMethod: r.paymentMethod,
          // "paidTo" ≈ product + invoice for purchase records
          paidTo: r.productName || '',
          // notes shows invoice number, qty, rate, gst etc.
          notes: [
            r.invoiceNumber ? `Inv# ${r.invoiceNumber}` : null,
            r.quantity != null ? `Qty: ${r.quantity}` : null,
            r.rate != null ? `Rate: ${currency(r.rate)}` : null,
            r.gstRate != null ? `GST: ${r.gstRate}%` : null,
            r.discount ? `Disc: ${currency(r.discount)}` : null,
            r.type ? `Type: ${r.type}` : null,
          ]
            .filter(Boolean)
            .join('  |  '),
          amount: r.grandTotal || r.amount || 0,
        })),
      };
    });

    // sort by totalAmount desc
    return heads.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [rawData]);

  // ── auto-fetch when dates change ─────────────────────────────────────────
  useEffect(() => {
    if (startDate && endDate) fetchReport();
  }, [startDate, endDate]);

  const formattedRange = useMemo(() => {
    return `${formatShort(startDate)}  To  ${formatShort(endDate)}`;
  }, [startDate, endDate]);

  // ── API call ─────────────────────────────────────────────────────────────
  const fetchReport = async () => {
    if (!startDate || !endDate) {
      Alert.alert(
        'Select Date Range',
        'Please select both start and end dates.',
      );
      return;
    }
    try {
      setLoading(true);
      const res = await api.get('/expense/ledger', {
        params: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
      });

      if (res?.success) {
        const records = Array.isArray(res.data.data) ? res.data.data : [];
        setRawData(records);

        // expand first vendor by default
        const grouped = groupBy(records, r => r.vendorName || 'Unknown Vendor');
        const keys = Object.keys(grouped);
        const initialExpanded = {};
        keys.forEach((k, i) => {
          initialExpanded[k] = i === 0;
        });
        setExpandedHeads(initialExpanded);
      } else {
        Alert.alert('No Data', res?.message || 'No records found.');
        setRawData([]);
      }
    } catch (err) {
      console.error('Fetch error:', err?.message);
      Alert.alert('Error', 'Failed to fetch report.');
    } finally {
      setLoading(false);
    }
  };

  const toggleHeadExpansion = headId => {
    setExpandedHeads(prev => ({ ...prev, [headId]: !prev[headId] }));
  };

  // ── Totals ───────────────────────────────────────────────────────────────
  const totals = useMemo(
    () => ({
      count: data.reduce((s, r) => s + r.count, 0),
      totalAmount: data.reduce((s, r) => s + Number(r.totalAmount || 0), 0),
      headCount: data.length,
    }),
    [data],
  );

  // ── Permission helpers ───────────────────────────────────────────────────
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

  // ── HTML builder ─────────────────────────────────────────────────────────
  const buildHTML = () => {
    const safe = v => (v ? String(v) : '-');

    const views = data
      .map(
        head => `
      <div style="margin-bottom:20px;">
        <div style="background:#f5f5f5; padding:12px; border-radius:8px; margin-bottom:8px;">
          <h3 style="margin:0; font-size:16px;">${safe(
            head.headName,
          )} — ${currency(head.totalAmount)}</h3>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
          <thead>
            <tr style="background:#fafafa;">
              <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd; font-size:12px;">Sl.</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd; font-size:12px;">Date</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd; font-size:12px;">Product</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd; font-size:12px;">Payment</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd; font-size:12px;">Details</th>
              <th style="text-align:right; padding:8px; border-bottom:1px solid #ddd; font-size:12px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${head.expenses
              .map(
                (exp, idx) => `
              <tr>
                <td style="padding:8px; border-bottom:1px solid #eee; font-size:11px;">${
                  idx + 1
                }</td>
                <td style="padding:8px; border-bottom:1px solid #eee; font-size:11px;">${formatDDMMYYYY(
                  exp.date,
                )}</td>
                <td style="padding:8px; border-bottom:1px solid #eee; font-size:11px;">${safe(
                  exp.paidTo,
                )}</td>
                <td style="padding:8px; border-bottom:1px solid #eee; font-size:11px;">${safe(
                  exp.paymentMethod,
                )}</td>
                <td style="padding:8px; border-bottom:1px solid #eee; font-size:11px; color:#555;">${safe(
                  exp.notes,
                )}</td>
                <td style="padding:8px; border-bottom:1px solid #eee; font-size:11px; text-align:right;">${currency(
                  exp.amount,
                )}</td>
              </tr>
            `,
              )
              .join('')}
            <tr>
              <td colspan="5" style="text-align:right; padding:8px; border-top:2px solid #333; font-weight:bold;">Total:</td>
              <td style="text-align:right; padding:8px; border-top:2px solid #333; font-weight:bold;">${currency(
                head.totalAmount,
              )}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `,
      )
      .join('');

    return `
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    @page { size: A4; margin:20px 20px; }
    html, body { margin:0; padding:0; }
    body { font-family:-apple-system,Roboto,Segoe UI,Arial; color:#111; }
    h1 { font-size:20px; margin:0 0 4px; }
    .muted { color:#666; margin-bottom:16px; }
    .chips { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; }
    .chip { border-radius:16px; padding:6px 12px; background:#f2f2f2; font-size:12px; color:#333; border:1px solid #ddd; }
    .grand-total { font-weight:bold; margin-top:16px; border-top:2px solid #333; padding-top:8px; display:flex; justify-content:flex-end; font-size:12px; }
    .footer { margin-top:14px; color:#666; font-size:10px; }
  </style>
</head>
<body>
  <h2 style="text-align:center;">${storeName}</h2>
  <p style="text-align:center;"><b>Address:</b> ${address}</p>
  <p style="text-align:center;"><b>Contact No:</b> ${contactNo}</p>
  ${gstin ? `<p style="text-align:center;"><b>GSTIN:</b> ${gstin}</p>` : ''}
  <h1>Expense Report</h1>
  <div class="muted">Period From: ${formattedRange}</div>
  <div class="chips">
    <div class="chip">Vendors: <b>${totals.headCount}</b></div>
    <div class="chip">Transactions: <b>${totals.count}</b></div>
    <div class="chip">Grand Total: <b>${currency(totals.totalAmount)}</b></div>
  </div>
  ${
    views ||
    '<div style="text-align:center;padding:40px;">No records found</div>'
  }
  <div class="grand-total">Grand Total Expenses: ${currency(
    totals.totalAmount,
  )}</div>
  <div class="footer">Powered by AMDAANI | ${new Date().toLocaleString()}</div>
</body>
</html>`;
  };

  // ── PDF export ───────────────────────────────────────────────────────────
  const exportPDF = async () => {
    if (!data.length) return Alert.alert('No Data', 'Generate a report first.');
    try {
      const storageOk = await ensureStoragePermission();
      const downloadsOk = await ensureAndroidDownloadPermission();
      if (!storageOk || !downloadsOk) return;

      const html = buildHTML();
      const pdfRes = await RNHTMLtoPDF.convert({
        html,
        fileName: `expense_report_${Date.now()}`,
        base64: false,
      });
      const dir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const finalPath = `${dir}/ExpenseReport_${Date.now()}.pdf`;
      await RNFS.copyFile(pdfRes.filePath, finalPath);
      try {
        await FileViewer.open(finalPath, { showOpenWithDialog: true });
      } catch (e) {
        Alert.alert(
          'PDF Saved',
          'Saved to Downloads. No PDF viewer available.',
        );
      }
      setLastSavedPath(finalPath);
      setDialogVisible(true);
    } catch (e) {
      console.error('PDF export error:', e?.message);
      Alert.alert('Error', 'Could not export PDF.');
    }
  };

  // ── Excel export ─────────────────────────────────────────────────────────
  const exportExcel = async () => {
    if (!data.length) return Alert.alert('No Data', 'Generate a report first.');
    try {
      const storageOk = await ensureStoragePermission();
      const downloadsOk = await ensureAndroidDownloadPermission();
      if (!storageOk || !downloadsOk) return;

      // flatten all records for the sheet
      const sheetData = rawData.map(r => ({
        Vendor: r.vendorName || '',
        Date: formatDDMMYYYY(r.date),
        'Invoice #': r.invoiceNumber || '',
        Product: r.productName || '',
        Qty: r.quantity ?? '',
        Rate: r.rate ?? '',
        Discount: r.discount ?? '',
        'GST Rate (%)': r.gstRate ?? '',
        'GST Amount': r.gstAmount ?? '',
        'Payment Method': r.paymentMethod || '',
        Type: r.type || '',
        'Grand Total': r.grandTotal || r.amount || 0,
      }));

      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      const dir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const finalPath = `${dir}/ExpenseReport_${Date.now()}.xlsx`;
      await RNFS.writeFile(finalPath, wbout, 'base64');
      try {
        await FileViewer.open(finalPath, { showOpenWithDialog: true });
      } catch (e) {
        console.warn('No Excel viewer:', e?.message);
      }
      setLastSavedPath(finalPath);
      setDialogVisible(true);
    } catch (e) {
      console.error('Excel export error:', e?.message);
      Alert.alert('Error', 'Could not export Excel.');
    }
  };

  // ── Quick date range helpers ─────────────────────────────────────────────
  const applyThisYear = () => {
    const today = new Date();
    const fyStart =
      today.getMonth() + 1 >= 4
        ? new Date(today.getFullYear(), 3, 1)
        : new Date(today.getFullYear() - 1, 3, 1);
    setStartDate(fyStart);
    setEndDate(today);
  };
  const applyThisMonth = () => {
    const today = new Date();
    setStartDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setEndDate(today);
  };
  const applyPreviousMonth = () => {
    const today = new Date();
    setStartDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    setEndDate(new Date(today.getFullYear(), today.getMonth(), 0));
  };

  // ── Row renderers ────────────────────────────────────────────────────────
  const renderExpenseItem = expense => (
    <List.Item
      title={`${expense.paidTo || '—'}  •  ${currency(expense.amount)}`}
      description={`${formatDDMMYYYY(expense.date)}  |  ${
        expense.paymentMethod
      }${expense.notes ? `\n${expense.notes}` : ''}`}
      left={props => <List.Icon {...props} icon="cart-outline" />}
      right={() => (
        <View
          style={{
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingRight: 8,
          }}
        >
          <Text style={{ fontWeight: 'bold', fontSize: 13 }}>
            {currency(expense.amount)}
          </Text>
        </View>
      )}
      descriptionNumberOfLines={3}
      descriptionStyle={{ fontSize: 11, color: '#666' }}
    />
  );

  const renderHeadItem = ({ item }) => (
    <Card style={styles.card}>
      <Card.Title
        title={item.headName}
        subtitle={`Total: ${currency(item.totalAmount)}  |  Txns: ${
          item.count
        }`}
        right={props => (
          <IconButton
            {...props}
            icon={expandedHeads[item.headId] ? 'chevron-up' : 'chevron-down'}
            onPress={() => toggleHeadExpansion(item.headId)}
          />
        )}
      />
      {expandedHeads[item.headId] && (
        <Card.Content style={{ padding: 0 }}>
          {item.expenses.map((expense, index) => (
            <View key={`${item.headId}_${expense._id ?? index}_${index}`}>
              {renderExpenseItem(expense)}
              {index < item.expenses.length - 1 && (
                <View style={{ height: 1, backgroundColor: '#ddd' }} />
              )}
            </View>
          ))}
        </Card.Content>
      )}
    </Card>
  );

  // ── Grand-total footer shown at bottom of list ───────────────────────────
  const ListFooter = () =>
    data.length > 0 ? (
      <Card style={[styles.card, { backgroundColor: '#1a1a2e' }]}>
        <Card.Content>
          <View style={styles.rowBetween}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
              Total Vendors
            </Text>
            <Text style={{ color: '#fff', fontSize: 14 }}>
              {totals.headCount}
            </Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
              Total Transactions
            </Text>
            <Text style={{ color: '#fff', fontSize: 14 }}>{totals.count}</Text>
          </View>
          <View
            style={[
              styles.rowBetween,
              {
                marginTop: 8,
                borderTopColor: '#444',
                borderTopWidth: 1,
                paddingTop: 8,
              },
            ]}
          >
            <Text
              style={{ color: '#ffd700', fontSize: 16, fontWeight: 'bold' }}
            >
              Grand Total Expenses
            </Text>
            <Text
              style={{ color: '#ffd700', fontSize: 16, fontWeight: 'bold' }}
            >
              {currency(totals.totalAmount)}
            </Text>
          </View>
        </Card.Content>
      </Card>
    ) : null;

  // ── Render ───────────────────────────────────────────────────────────────
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
              disabled={!data.length || loading}
            />
            <IconButton
              icon="file-excel"
              iconColor="green"
              onPress={exportExcel}
              disabled={!data.length || loading}
            />
          </>
        }
      />

      <View style={[styles.header, compact && { paddingHorizontal: 12 }]}>
        {/* Date pickers */}
        <View style={styles.row}>
          <Button
            mode="outlined"
            icon="calendar-start"
            onPress={() => setPickerMode('start')}
            style={[styles.dateBtn, compact && { paddingHorizontal: 0 }]}
            contentStyle={{ flexDirection: 'row-reverse' }}
          >
            {startDate ? formatShort(startDate) : 'Start Date'}
          </Button>
          <Button
            mode="outlined"
            icon="calendar-end"
            onPress={() => setPickerMode('end')}
            style={[styles.dateBtn, compact && { paddingHorizontal: 0 }]}
            contentStyle={{ flexDirection: 'row-reverse' }}
          >
            {endDate ? formatShort(endDate) : 'End Date'}
          </Button>
          <IconButton
            icon="calendar-remove"
            onPress={() => {
              setStartDate(null);
              setEndDate(null);
            }}
            disabled={!startDate && !endDate}
          />
        </View>

        {/* Quick ranges */}
        <View style={[styles.row, compact && { gap: 4 }]}>
          <Button
            mode="outlined"
            compact
            onPress={applyThisYear}
            style={{ flex: 1 }}
            labelStyle={{ fontSize: 11 }}
          >
            This Year
          </Button>
          <Button
            mode="outlined"
            compact
            onPress={applyThisMonth}
            style={{ flex: 1 }}
            labelStyle={{ fontSize: 11 }}
          >
            This Month
          </Button>
          <Button
            mode="outlined"
            compact
            onPress={applyPreviousMonth}
            style={{ flex: 1 }}
            labelStyle={{ fontSize: 11 }}
          >
            Prev Month
          </Button>
        </View>

        {/* Generate */}
        <View style={[styles.row, compact && { gap: 6 }]}>
          <Button
            mode="contained"
            onPress={fetchReport}
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
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text>Loading...</Text>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Text>No records found. Select date range and Generate.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.headId}
          renderItem={renderHeadItem}
          contentContainerStyle={styles.list}
          ListFooterComponent={<ListFooter />}
        />
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
            <Text>File saved successfully.</Text>
            {lastSavedPath && <Text selectable>{lastSavedPath}</Text>}
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
  header: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', gap: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12 },
  card: { marginBottom: 10, borderRadius: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  dateBtn: { flex: 1 },
  submitButtonLabel: {},
});

export default ExpenseHeadReport;
