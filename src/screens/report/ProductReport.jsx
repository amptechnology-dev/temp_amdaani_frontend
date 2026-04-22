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

const ProductReport = () => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const [products, setProducts] = useState([]);
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

  const fetchProducts = async () => {
    try {
      if (!startDate || !endDate) {
        Alert.alert(
          'Select Date Range',
          'Please select both start and end dates.',
        );
        return;
      }
      setLoading(true);

      const res = await api.get('/invoice/product-wise', {
        params: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
      });
      // console.log('Product Report Response:', res);
      if (res?.success) {
        setProducts(res?.data || []);
      } else {
        Alert.alert('No Data', res?.data?.message || 'No records found.');
        setProducts([]); // clear old data if API says failed
      }
    } catch (e) {
      console.error('Product report fetch error:', e?.message);
      Alert.alert('Error', 'Failed to fetch product report.');
      setProducts([]); // clear data on error too
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (startDate && endDate) {
      fetchProducts();
    }
  }, [startDate, endDate]);

  const totals = useMemo(() => {
    const toNum = v => Number(v || 0);
    return {
      count: products.length,
      quantity: products.reduce((s, r) => s + toNum(r.quantity), 0),
      gstTotal: products.reduce((s, r) => s + toNum(r.gstAmount), 0),
      lineTotal: products.reduce((s, r) => s + toNum(r.lineTotal), 0),
      grandTotal: products.reduce((s, r) => s + toNum(r.grandTotal), 0),
    };
  }, [products]);


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

    const headRow = `
      <tr>
        <th align="left">Invoice No</th>
        <th align="left">Date</th>
        <th align="left">Product</th>
        <th align="left">HSN Code</th>
        <th align="left">Unit</th>
        <th align="right">Price</th>
        <th align="right">Qty</th>
        <th align="right">GST%</th>
        <th align="right">GST Amt</th>
        <th align="right">Line Total</th>
        <th align="right">Grand Total</th>
      </tr>`;

    const bodyRows = products
      .map(p => {
        const date = p.date ? new Date(p.date).toLocaleDateString() : '-';
        return `
        <tr>
          <td>${safe(p.invoiceNumber || p._id)}</td>
          <td>${date}</td>
          <td>${safe(p.product)}</td>
          <td>${safe(p?.productHsn)}</td>
          <td>${safe(p.unit)}</td>
          <td align="right">${currency(p.price)}</td>
          <td align="right">${safe(p.quantity)}</td>
          <td align="right">${safe(p.gstRate)}%</td>
          <td align="right">${currency(p.gstAmount)}</td>
          <td align="right">${currency(p.lineTotal)}</td>
          <td align="right">${currency(p.grandTotal)}</td>
        </tr>`;
      })
      .join('');

    const totalRow = `
    <tr style="font-weight:700; border-top:2px solid #333;">
      <td style="padding:6px; font-size:11px; border:1px solid #ddd; font-weight:700;">TOTAL</td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd;"></td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd;"></td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd;"></td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd;"></td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd;"></td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd; text-align:right; font-weight:700;">${
        totals.quantity
      }</td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd;"></td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd; text-align:right; font-weight:700;">${currency(
        totals.gstTotal,
      )}</td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd; text-align:right; font-weight:700;">${currency(
        totals.lineTotal,
      )}</td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd; text-align:right; font-weight:700;">${currency(
        totals.grandTotal,
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
      
          body { font-family: -apple-system, Roboto, Segoe UI, Arial; padding: 24px; color: #111; }
          h1 { font-size: 20px; margin: 0 0 4px; }
          .muted { color: #666; margin-bottom: 16px; }
          .summary { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
          .chip { background: #f5f5f5; padding: 8px 10px; border-radius: 8px; font-weight: 600; font-size: 12px; }
          table { border-collapse: collapse; width: 100%; table-layout: fixed; }
          th, td { border-bottom: 1px solid #eee; padding: 8px 6px; font-size: 11px; word-wrap: break-word; }
          th { background: #fafafa; font-weight: 700; }
          tfoot td { font-weight: 700; }
          .right { text-align: right; }
         tfoot { display: table-row-group; }

          .footer { margin-top: 14px; color: #666; font-size: 10px; }

         
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
        <h1>Product Report</h1>
        <div class="muted">Date Range: ${formattedRange}</div>

        <div class="summary">
          <div class="chip">Records: ${totals.count}</div>
          <div class="chip">Quantity: ${totals.quantity}</div>
          <div class="chip">GST: ${currency(totals.gstTotal)}</div>
          <div class="chip">Line Total: ${currency(totals.lineTotal)}</div>
          <div class="chip">Grand Total: ${currency(totals.grandTotal)}</div>
        </div>

        <table>
        <thead>${headRow}</thead>
        <tbody>
          ${
            bodyRows ||
            `<tr><td colspan="11" align="center">No records</td></tr>`
          }
          ${totalRow}
        </tbody>
      </table>

        <div class="footer">Powered by AMDAANI | This is System Generated ${new Date().toLocaleString()}</div>
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
    if (!products.length) {
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
        fileName: `product_sale_report_${Date.now()}`,
        base64: false,
      };
      const pdfRes = await RNHTMLtoPDF.convert(pdfOptions);

      const downloadsDir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const suggested = `Product_Sale_Report_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;
      let finalPath = `${downloadsDir}/${suggested}`;
      if (await RNFS.exists(finalPath)) {
        finalPath = `${downloadsDir}/Product_Sale_Report_${new Date()
          .toISOString()
          .replace(/[:.]/g, '-')}.pdf`;
      }
      await RNFS.copyFile(pdfRes.filePath, finalPath);

      // ✅ Try to open the PDF safely
      try {
        await FileViewer.open(finalPath, { showOpenWithDialog: true });
      } catch (openErr) {
        console.warn('No PDF viewer available:', openErr?.message);
        Alert.alert(
          'PDF Saved',
          'File has been saved to Downloads folder, but no PDF viewer is available to open it.',
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
    if (!products.length) {
      Alert.alert('No Data', 'No records to export.');
      return;
    }

    try {
      const storageOk = await ensureStoragePermission();
      const downloadsOk = await ensureAndroidDownloadPermission();
      if (!storageOk || !downloadsOk) return;

      const data = products.map(p => ({
        'Invoice No': p.invoiceNumber || p._id,
        Date: p.date ? new Date(p.date).toLocaleDateString() : '-',
        Product: p.product,
        Unit: p.unit,
        Price: Number(p.price || 0),
        Quantity: Number(p.quantity || 0),
        'GST%': Number(p.gstRate || 0),
        'GST Amount': Number(p.gstAmount || 0),
        'Line Total': Number(p.lineTotal || 0),
        'Grand Total': Number(p.grandTotal || 0),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Product Sale Report');
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      const downloadsDir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const baseName = `Product_Sale_Report_${new Date()
        .toISOString()
        .slice(0, 10)}`;
      let finalPath = `${downloadsDir}/${baseName}.xlsx`;

      if (await RNFS.exists(finalPath)) {
        finalPath = `${downloadsDir}/${baseName}_${Date.now()}.xlsx`;
      }

      await RNFS.writeFile(finalPath, wbout, 'base64');

      // ✅ Try to open Excel safely
      try {
        await FileViewer.open(finalPath, { showOpenWithDialog: true });
      } catch (openErr) {
        console.warn('No Excel viewer available:', openErr?.message);
        Alert.alert(
          'Excel Saved',
          'File has been saved to Downloads folder, but no Excel viewer is available to open it.',
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
    const date = item.date ? new Date(item.date).toLocaleDateString() : '-';
    return (
      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title={item.product || 'Product'}
          subtitle={date}
          titleVariant="titleMedium"
        />
        <Card.Content style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text variant="bodyMedium" numberOfLines={1}>
              Invoice: {item.invoiceNumber}
            </Text>
            <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
              Unit: {item.unit} | Qty: {item.quantity}
            </Text>
            <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
              Price: ₹{item.price} | GST: {item.gstRate}%
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="titleMedium">
              ₹{Number(item.grandTotal || 0).toFixed(2)}
            </Text>
            <Text variant="bodySmall" style={styles.muted}>
              Line Total: ₹{Number(item.lineTotal || 0).toFixed(2)}
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
        title={'Product Report'}
        rightComponent={
          <>
            <IconButton
              icon="file-pdf-box"
              iconColor="red"
              onPress={exportPDF}
              disabled={!products.length || loading}
              accessibilityLabel="Export PDF"
            />

            <IconButton
              icon="file-excel"
              iconColor="green"
              onPress={exportExcel}
              disabled={!products.length || loading}
              accessibilityLabel="Export Excel"
            />
          </>
        }
      />

      <View style={[styles.header, compact && { paddingHorizontal: 12 }]}>
        {/* Date range selectors */}
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

        {/* Actions */}
        <View style={[styles.row, compact && { gap: 6 }]}>
          <Button
            mode="contained"
            onPress={fetchProducts}
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
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>
            No records. Select a date range and Generate.
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item, idx) => String(idx)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
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
  iconBtn: { margin: 0 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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

export default ProductReport;
