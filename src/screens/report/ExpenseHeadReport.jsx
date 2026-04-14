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

const ExpenseHeadReport = () => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [pickerMode, setPickerMode] = useState(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [lastSavedPath, setLastSavedPath] = useState(null);
  const [expandedHeads, setExpandedHeads] = useState({});

  // const { authData } = useAuth();   <-- remove this
  const { authState } = useAuth();

  // derive store with fallbacks
  const store = authState?.user?.store || authState?.store || null;

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

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport();
    }
  }, [startDate, endDate]);

  useEffect(() => {
    setTimeout(() => {
      // console.log('Auth Data:', authState);
    }, 3000);
  }, []);

  const formatDate = date => {
    if (!date) return 'All';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const formatDisplayDate = dateString => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${day}/${month}/${year}`;
  };

  const formattedRange = useMemo(() => {
    const s = startDate ? formatDate(startDate) : 'All';
    const e = endDate ? formatDate(endDate) : 'All';
    return `${s}  To  ${e}`;
  }, [startDate, endDate]);

  const fetchReport = async () => {
    if (!startDate || !endDate) {
      Alert.alert(
        'Select Date Range',
        'Please select both start and end dates.',
      );
      return;
    }
    try {
      console.log('Fetching expense report...');
      setLoading(true);
      const res = await api.get('/expense/grouped-by-head', {
        params: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
      });

      // console.log('Expense Report Response:', res);

      if (res?.success) {
        // Sort by totalAmount (highest first)
        const sorted = (res.data || []).sort(
          (a, b) => Number(b.totalAmount || 0) - Number(a.totalAmount || 0),
        );
        setData(sorted);

        // Initialize expanded state for all heads
        const initialExpanded = {};
        sorted.forEach((head, index) => {
          initialExpanded[head.headId] = index === 0; // Expand first item by default
        });
        setExpandedHeads(initialExpanded);
      } else {
        Alert.alert('No Data', res?.message || 'No expense records found.');
        setData([]);
      }
    } catch (err) {
      console.error('Fetch error:', err?.message);
      Alert.alert('Error', 'Failed to fetch expense report.');
    } finally {
      setLoading(false);
    }
  };

  const toggleHeadExpansion = headId => {
    setExpandedHeads(prev => ({
      ...prev,
      [headId]: !prev[headId],
    }));
  };

  const totals = useMemo(() => {
    const toNum = v => Number(v || 0);
    return {
      count: data.reduce((s, r) => s + toNum(r.count), 0),
      totalAmount: data.reduce((s, r) => s + toNum(r.totalAmount), 0),
      headCount: data.length,
    };
  }, [data]);

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
    const safe = v => (v ? String(v) : '-');
    const formatDDMMYYYY = dateStr => {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const Views = data
      .map(
        head => `
      <div style="margin-bottom: 20px; page-break-inside: avoid;">
        <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 16px;">${safe(
              head.headName,
            )} (${safe(head.totalAmount)})</h3>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr style="background: #fafafa;">
              <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd; font-size: 12px;">Sl. No.</th>
              <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd; font-size: 12px;">Date</th>
              <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd; font-size: 12px;">Payment Method</th>
              <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd; font-size: 12px;">Paid To / Notes</th>
              <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd; font-size: 12px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${head.expenses
              .map(
                (expense, index) => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 11px;">${
                  index + 1
                }</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 11px;">${formatDDMMYYYY(
                  expense.date,
                )}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 11px;">${safe(
                  expense.paymentMethod,
                )}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 11px;">
                  ${safe(expense.paidTo)}
                  ${
                    expense.notes
                      ? `<div style="font-size:10px;color:#666;">${safe(
                          expense.notes,
                        )}</div>`
                      : ''
                  }
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 11px; text-align: right;">${currency(
                  expense.amount,
                )}</td>
              </tr>
            `,
              )
              .join('')}
            <tr>
              <td colspan="4" style="text-align:right; padding:8px; border-top:2px solid #333; font-weight:bold;">Total:</td>
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
    <meta charset="utf-8" />
    <style>
      @page {
        margin: 30px 24px;
        @top-right {
          content: "Page " counter(page) " of " counter(pages);
          font-size: 10px;
          color: #666;
        }
      }

      body {
        font-family: -apple-system, Roboto, Segoe UI, Arial;
        color: #111;
      }

      h1 {
        font-size: 20px;
        margin: 0 0 4px;
      }

      .muted {
        color: #666;
        margin-bottom: 16px;
      }

      .chips {
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

      .grand-total {
        font-weight: bold;
        margin-top: 16px;
        border-top: 2px solid #333;
        padding-top: 8px;
        display: flex;
        justify-content: flex-end;
        font-size: 12px;
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
    ${gstin ? `<p style="text-align:center;"><b>GSTIN:</b> ${gstin}</p>` : ''}
    <h1>Expense Report</h1>
    <div class="muted">Period From: ${formattedRange}</div>

    <div class="chips">
      <div class="chip">Grand Total: <b>${currency(
        totals.totalAmount,
      )}</b></div>
    </div>

    ${
      Views ||
      '<div style="text-align:center; padding: 40px;">No expense records</div>'
    }

    <div class="grand-total">
      Grand Total: ${currency(totals.totalAmount)}
    </div>

    <div class="footer">Powered by AMDAANI | ${new Date().toLocaleString()}</div>
  </body>
  </html>
  `;
  };

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

      const downloadsDir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;

      const finalPath = `${downloadsDir}/ExpenseReport_${Date.now()}.pdf`;

      await RNFS.copyFile(pdfRes.filePath, finalPath);

      try {
        await FileViewer.open(finalPath, { showOpenWithDialog: true });
      } catch (openErr) {
        console.warn('No PDF viewer available:', openErr?.message);
        Alert.alert(
          'PDF Report Saved',
          'File has been saved to Downloads folder, but no app is available to open it.',
        );
      }

      setLastSavedPath(finalPath);
      setDialogVisible(true);
    } catch (e) {
      console.error('PDF export error:', e?.message);
      Alert.alert('Error', 'Could not export or open PDF.');
    }
  };

  const exportExcel = async () => {
    if (!data.length) return Alert.alert('No Data', 'Generate a report first.');
    try {
      const storageOk = await ensureStoragePermission();
      const downloadsOk = await ensureAndroidDownloadPermission();
      if (!storageOk || !downloadsOk) return;

      // Flatten all expenses with head information
      const sheetData = data.flatMap(head =>
        head.expenses.map(expense => ({
          'Expense Head': head.headName,
          Date: formatDisplayDate(expense.date),
          'Payment Method': expense.paymentMethod,
          'Paid To': expense.paidTo || '',
          Amount: expense.amount,
          Notes: expense.notes || '',
        })),
      );

      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      const downloadsDir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const finalPath = `${downloadsDir}/ExpenseReport_${Date.now()}.xlsx`;

      await RNFS.writeFile(finalPath, wbout, 'base64');

      try {
        await FileViewer.open(finalPath, { showOpenWithDialog: true });
      } catch (openErr) {
        console.warn('No Excel viewer available:', openErr?.message);
      }

      setLastSavedPath(finalPath);
      setDialogVisible(true);
    } catch (e) {
      console.error('Excel export error:', e?.message);
      Alert.alert('Error', 'Could not export or open Excel.');
    }
  };

  const applyThisYear = () => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const fyStart =
      currentMonth >= 4
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

  const renderExpenseItem = expense => (
    <List.Item
      title={`₹${expense.amount}`}
      description={expense.paymentMethod}
      left={props => <List.Icon {...props} icon="cash" />}
      right={props => (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 12, color: '#666' }}>
            {formatDisplayDate(expense.date)}
          </Text>
          {expense.paidTo && (
            <Text style={{ fontSize: 12, color: '#666' }}>
              To: {expense.paidTo}
            </Text>
          )}
        </View>
      )}
    />
  );

  const renderHeadItem = ({ item }) => (
    <Card style={styles.card}>
      <Card.Title
        title={item.headName}
        subtitle={`Total: ₹${item.totalAmount} | Transactions: ${item.count}`}
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
          <View>
            {item.expenses.map((expense, index) => (
              <View key={index}>
                {renderExpenseItem(expense)}
                {index < item.expenses.length - 1 && (
                  <View style={{ height: 1, backgroundColor: '#ddd' }} />
                )}
              </View>
            ))}
          </View>
        </Card.Content>
      )}
    </Card>
  );

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
        <View style={styles.row}>
          <Button
            mode="outlined"
            icon="calendar-start"
            onPress={() => setPickerMode('start')}
            style={[styles.dateBtn, compact && { paddingHorizontal: 0 }]}
            contentStyle={{ flexDirection: 'row-reverse' }}
          >
            {startDate ? formatDate(startDate) : 'Start Date'}
          </Button>
          <Button
            mode="outlined"
            icon="calendar-end"
            onPress={() => setPickerMode('end')}
            style={[styles.dateBtn, compact && { paddingHorizontal: 0 }]}
            contentStyle={{ flexDirection: 'row-reverse' }}
          >
            {endDate ? formatDate(endDate) : 'End Date'}
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
          <Text>Loading...</Text>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Text>No expense records found. Select date range and Generate.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.headId}
          renderItem={renderHeadItem}
          contentContainerStyle={styles.list}
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
});

export default ExpenseHeadReport;
