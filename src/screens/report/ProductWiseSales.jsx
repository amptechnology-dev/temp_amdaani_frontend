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

const ProductWiseSalesReport = () => {
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

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport();
    }
  }, [startDate, endDate]);

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
      const res = await api.get('/product/sales', {
        params: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
      });

      // console.log('Product Wise Sales Report Response:', res);

      if (res?.success) {
        // ✅ Sort by totalSold (highest first)
        const sorted = (res.data || []).sort(
          (a, b) => Number(b.totalSold || 0) - Number(a.totalSold || 0),
        );
        setData(sorted);
      } else {
        Alert.alert('No Data', res?.message || 'No records found.');
        setData([]);
      }
    } catch (err) {
      console.error('Fetch error:', err?.message);
      Alert.alert('Error', 'Failed to fetch report.');
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const toNum = v => Number(v || 0);
    return {
      count: data.length,
      totalSold: data.reduce((s, r) => s + toNum(r.totalSold), 0),
      totalRevenue: data.reduce((s, r) => s + toNum(r.totalRevenue), 0),
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
    const rows = data
      .map(
        p => `
    <tr>
      <td style="text-align:left;">${safe(p.name)}</td>
      <td style="text-align:left;">${safe(p.hsn)}</td>
      <td style="text-align:center; padding-right:6px;">${p.totalSold}</td>
      <td style="text-align:center; padding-left:6px;">${safe(p.unit)}</td>
      <td style="text-align:right;">${currency(p.totalRevenue)}</td>
    </tr>`,
      )
      .join('');

    const totalRow = `
    <tr style="font-weight:700; border-top:2px solid #333;">
      <td style="padding:6px; font-size:11px; border:1px solid #ddd; font-weight:700;">TOTAL</td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd;"></td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd; text-align:center; font-weight:700;">${
        totals.totalSold
      }</td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd;"></td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd; text-align:right; font-weight:700;">${currency(
        totals.totalRevenue,
      )}</td>
    </tr>`;

    return `
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
       @page {
        size: A4 landscape; margin: 20px 20px; 
        @top-right {
          content: "Page " counter(page) " of " counter(pages);
          font-size: 10px;
          color: #666;
    }
    }

      body {
        font-family: -apple-system, Roboto, Segoe UI, Arial;
        padding: 0;
        color: #111;
      }

      h1 {
        font-size: 20px;
        margin: 0 0 2px;
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

      table {
        border-collapse: collapse;
        width: 100%;
        table-layout: fixed;
        page-break-inside: auto;
      }

      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }

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

      th:nth-child(1), td:nth-child(1) { text-align: left; }
      th:nth-child(2), td:nth-child(2) { text-align: left; }
      th:nth-child(3), td:nth-child(3) { text-align: center; padding-right: 6px; }
      th:nth-child(4), td:nth-child(4) { text-align: center; padding-left: 6px; }
      th:nth-child(5), td:nth-child(5) { text-align: right; }

      .footer {
        margin-top: 14px;
        color: #666;
        font-size: 10px;
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
    </style>
  </head>
  <body>
       <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
  <tr>
    <td style="text-align:center; padding:2px 0;">
      <strong style="font-size:14px;">${storeName}</strong>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:1px 0; font-size:10px; color:#444;">
      ${address} &nbsp;|&nbsp; <b>Ph:</b> ${contactNo} ${
      gstin ? `&nbsp;|&nbsp; <b>GSTIN:</b> ${gstin}` : ''
    }
    </td>
  </tr>
</table>
    <h1>Product Wise Sales Report</h1>
    <div class="muted">Period From: ${formattedRange}</div>

    <div class="chips">
      <div class="chip">Total Products: <b>${totals.count}</b></div>
      <div class="chip">Total Sold: <b>${totals.totalSold}</b></div>
      <div class="chip">Grand Total Revenue: <b>${currency(
        totals.totalRevenue,
      )}</b></div>
    </div>

     <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>HSN</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Total Value</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows ||
            `<tr><td colspan="5" style="text-align:center;">No records</td></tr>`
          }
          ${totalRow}
        </tbody>
      </table>

    <!-- Grand Total at LAST PAGE only -->
   

    <div class="footer">Powered by AMDAANI | ${new Date().toLocaleString()}</div>
  </body>
  </html>
  `;
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

  const exportPDF = async () => {
    if (!data.length) return Alert.alert('No Data', 'Generate a report first.');
    try {
      const storageOk = await ensureStoragePermission();
      const downloadsOk = await ensureAndroidDownloadPermission();
      if (!storageOk || !downloadsOk) return;

      const html = buildHTML();
      const pdfRes = await RNHTMLtoPDF.convert({
        html,
        fileName: `product_wise_sales_${Date.now()}`,
        base64: false,
      });

      const downloadsDir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;

      const finalPath = `${downloadsDir}/ProductWiseSales_${Date.now()}.pdf`;

      await RNFS.copyFile(pdfRes.filePath, finalPath);

      // ✅ Try to open with FileViewer — handle if no app found
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

      const sheetData = data.map(p => ({
        Product: p.name,
        HSN: p.hsn,
        Quantity: p.totalSold,
        Unit: p.unit,
        Revenue: p.totalRevenue,
      }));

      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Product Sales');
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      const downloadsDir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const finalPath = `${downloadsDir}/ProductWiseSales_${Date.now()}.xlsx`;

      await RNFS.writeFile(finalPath, wbout, 'base64');

      // ✅ Try to open file — handle missing Excel viewer gracefully
      try {
        await FileViewer.open(finalPath, { showOpenWithDialog: true });
      } catch (openErr) {
        console.warn('No Excel viewer available:', openErr?.message);
        Alert.alert(
          'Excel Report Saved',
          'File has been saved to Downloads folder, but no app is available to open Excel files.',
        );
      }

      setLastSavedPath(finalPath);
      setDialogVisible(true);
    } catch (e) {
      console.error('Excel export error:', e?.message);
      Alert.alert('Error', 'Could not export or open Excel.');
    }
  };

  const renderItem = ({ item }) => (
    <Card style={styles.card}>
      <Card.Title title={item.name} subtitle={`HSN: ${item.hsn || '-'}`} />
      <Card.Content style={styles.rowBetween}>
        <View>
          <Text>Unit: {item.unit}</Text>
          <Text>Price: ₹{item.sellingPrice}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text>Qty: {item.totalSold}</Text>
          <Text>Total Value: ₹{item.totalRevenue}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar
        showBackButton
        title="Product Wise Sales"
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
          <Text>No records found. Select date range and Generate.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item._id + i}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}

      <DateTimePickerModal
        isVisible={!!pickerMode}
        mode="date"
        accentColor={theme.colors.primary}
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

export default ProductWiseSalesReport;
