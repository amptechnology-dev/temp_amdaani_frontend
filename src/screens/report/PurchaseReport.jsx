import React, { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Icon } from 'react-native-paper';
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
import { useAuth } from '../../context/AuthContext';
import {
  useRoute,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';

const PurchaseReport = () => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [pickerMode, setPickerMode] = useState(null);

  const [dialogVisible, setDialogVisible] = useState(false);
  const [lastSavedPath, setLastSavedPath] = useState(null);
  const navigation = useNavigation();

  const { authState } = useAuth();
  const store = authState?.user?.store || authState?.store || null;
  const route = useRoute();

  const dashboardFlag = route?.params?.dashboardFlag || false;
  const dashboardWeeklyFlag = route?.params?.dashboardWeeklyFlag || false;
  const dashboardMonthlyFlag = route?.params?.dashboardMonthlyFlag || false;
  const dashboardTodayFlag = route?.params?.dashboardTodayFlag || false;

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

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const params = [];
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        params.push(`startDate=${s.getTime()}`); // ✅ plain number, no encoding issues
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        params.push(`endDate=${e.getTime()}`); // ✅ plain number, no encoding issues
      }
      const query = params.length ? `?${params.join('&')}` : '';
      const res = await api.get(`/purchase/report${query}`);
      // api utility may return axios response (res.data) or already-unwrapped ({ success, data })
      let rows = res?.data?.data ?? res?.data ?? [];
      // ensure it's always an array
      if (!Array.isArray(rows)) rows = [];
      // client-side date filter fallback (if API doesn't filter)
      if (startDate && endDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        rows = rows.filter(p => {
          const d = new Date(p.date || p.createdAt);
          return d >= sDate && d <= eDate;
        });
      }
      setPurchases(rows);
    } catch (e) {
      console.error('Purchase report fetch error:', e?.message);
      Alert.alert('Error', 'Failed to fetch purchase report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) fetchPurchases();
  }, [startDate, endDate]);

  // ─── Dashboard flags ──────────────────────────────────────────────────────
  useEffect(() => {
    const today = new Date();
    if (dashboardFlag) {
      const currentMonth = today.getMonth() + 1;
      const fyStart =
        currentMonth >= 4
          ? new Date(today.getFullYear(), 3, 1)
          : new Date(today.getFullYear() - 1, 3, 1);
      setStartDate(fyStart);
      setEndDate(today);
    } else if (dashboardWeeklyFlag) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      setStartDate(weekStart);
      setEndDate(today);
    } else if (dashboardMonthlyFlag) {
      setStartDate(new Date(today.getFullYear(), today.getMonth(), 1));
      setEndDate(today);
    } else if (dashboardTodayFlag) {
      setStartDate(today);
      setEndDate(today);
    }
  }, [
    dashboardFlag,
    dashboardWeeklyFlag,
    dashboardMonthlyFlag,
    dashboardTodayFlag,
  ]);

  // ─── Quick-range helpers ──────────────────────────────────────────────────
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

  // ─── Totals ───────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const toNum = v => Number(v || 0);
    return {
      count: purchases.length,
      subTotal: purchases.reduce((s, r) => s + toNum(r.subTotal), 0),
      gstTotal: purchases.reduce((s, r) => s + toNum(r.gstTotal), 0),
      discountTotal: purchases.reduce((s, r) => s + toNum(r.discountTotal), 0),
      grandTotal: purchases.reduce((s, r) => s + toNum(r.grandTotal), 0),
      totalQty: purchases.reduce(
        (s, r) =>
          s +
          (r.items || []).reduce((qs, it) => qs + Number(it.quantity || 0), 0),
        0,
      ),
    };
  }, [purchases]);

  // ─── Permission helper ────────────────────────────────────────────────────
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

  // ─── Row helpers ──────────────────────────────────────────────────────────
  const getRowData = (purchase, sl) => {
    const currency = n => `₹${Number(n || 0).toFixed(2)}`;
    const totalQty = (purchase.items || []).reduce(
      (s, it) => s + Number(it.quantity || 0),
      0,
    );
    const discountPct =
      purchase.grandTotal > 0
        ? (
            (Number(purchase.discountTotal || 0) / purchase.grandTotal) *
            100
          ).toFixed(1)
        : '0.0';

    // ✅ New fields
    const gstTotal = Number(purchase.gstTotal || 0);
    const cgst = purchase.isIgst ? 0 : gstTotal / 2;
    const sgst = purchase.isIgst ? 0 : gstTotal / 2;
    const taxableValue = Number(purchase.subTotal || 0);

    return {
      sl,
      billDate: purchase.date
        ? new Date(purchase.date).toLocaleDateString('en-IN')
        : '-',
      supplierName: purchase.vendorName || '-',
      supplierMobile: purchase.vendorMobile || '-',
      totalItemsQty: totalQty,
      discountPct: `${discountPct}%`,
      taxableValue: currency(taxableValue),
      cgst: currency(cgst),
      sgst: currency(sgst),
      tax: currency(gstTotal),
      paymentStatus: purchase.paymentStatus || '-',
      netAmount: currency(purchase.grandTotal),
      // raw for Excel
      rawDiscount: Number(purchase.discountTotal || 0),
      rawGst: gstTotal,
      rawCgst: cgst,
      rawSgst: sgst,
      rawTaxableValue: taxableValue,
      rawGrandTotal: Number(purchase.grandTotal || 0),
    };
  };
  // ─── Build HTML ───────────────────────────────────────────────────────────
  const buildHTML = () => {
    const currency = n => `₹${Number(n || 0).toFixed(2)}`;

    const sorted = [...purchases].sort(
      (a, b) =>
        new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt),
    );

    const headRow = `
  <tr>
    <th align="center">SL</th>
    <th align="left">Bill Date</th>
    <th align="left">Supplier Name</th>
    <th align="left">Supplier Mobile</th>
    <th align="center">Total Items Qty</th>
    <th align="right">Discount (%)</th>
    <th align="right">Taxable Value</th>
    <th align="right">CGST</th>
    <th align="right">SGST</th>
    <th align="right">Tax</th>
    <th align="center">Payment Status</th>
    <th align="right">Net Amount</th>
  </tr>`;

    // bodyRows map — add 3 new <td> cells after discount:
    const bodyRows = sorted
      .map((p, idx) => {
        const d = getRowData(p, idx + 1);
        const statusColor =
          d.paymentStatus === 'paid'
            ? '#16a34a'
            : d.paymentStatus === 'partial'
            ? '#d97706'
            : '#dc2626';
        return `
    <tr>
      <td align="center">${d.sl}</td>
      <td>${d.billDate}</td>
      <td>${d.supplierName}</td>
      <td>${d.supplierMobile}</td>
      <td align="center">${d.totalItemsQty}</td>
      <td align="right">${d.discountPct}</td>
      <td align="right">${d.taxableValue}</td>
      <td align="right">${d.cgst}</td>
      <td align="right">${d.sgst}</td>
      <td align="right">${d.tax}</td>
      <td align="center" style="color:${statusColor}; font-weight:600; text-transform:capitalize;">${d.paymentStatus}</td>
      <td align="right">${d.netAmount}</td>
    </tr>`;
      })
      .join('');

    return `
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4 landscape; margin: 20px 20px; }
    body { font-family: -apple-system, Roboto, Segoe UI, Arial; padding: 0; margin: 0; color: #111; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .muted { color: #666; margin-bottom: 16px; }
    .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .chip { border-radius: 16px; padding: 6px 12px; background: #f2f2f2; font-size: 12px; color: #333; border: 1px solid #ddd; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th, td { border-bottom: 1px solid #eee; padding: 8px 6px; font-size: 11px; word-wrap: break-word; }
    th { background: #fafafa; font-weight: 700; }
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
        ${address} &nbsp;|&nbsp; <b>Ph:</b> ${contactNo}
        ${
          gstin && gstin !== 'N/A' ? `&nbsp;|&nbsp; <b>GSTIN:</b> ${gstin}` : ''
        }
      </td>
    </tr>
  </table>
 
  <h1>Purchase Register</h1>
  <div class="muted">Period From: ${formattedRange}</div>
 
  <div class="summary">
    <div class="chip">Purchases: ${totals.count}</div>
    <div class="chip">Total Qty: ${totals.totalQty}</div>
    <div class="chip">Subtotal: ${currency(totals.subTotal)}</div>
    <div class="chip">GST: ${currency(totals.gstTotal)}</div>
    <div class="chip">Discount: ${currency(totals.discountTotal)}</div>
    <div class="chip">Grand Total: ${currency(totals.grandTotal)}</div>
  </div>
 
  <table>
    <thead>${headRow}</thead>
    <tbody>${
      bodyRows || `<tr><td colspan="9" align="center">No records</td></tr>`
    }</tbody>
  </table>
 
  <!-- Totals footer row -->
 <div style="margin-top:0;">
  <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
    <tr style="border-top: 2px solid #333;">
      <td style="padding:6px; font-size:11px; border:1px solid #ddd; font-weight:700;">TOTAL</td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd;"></td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd;"></td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd;"></td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd; text-align:center; font-weight:700;">${
        totals.totalQty
      }</td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd;"></td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd; text-align:right; font-weight:700;">${currency(
        totals.subTotal,
      )}</td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd; text-align:right; font-weight:700;">${currency(
        totals.gstTotal / 2,
      )}</td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd; text-align:right; font-weight:700;">${currency(
        totals.gstTotal / 2,
      )}</td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd; text-align:right; font-weight:700;">${currency(
        totals.gstTotal,
      )}</td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd;"></td>
      <td style="padding:6px; font-size:11px; border:1px solid #ddd; text-align:right; font-weight:700;">${currency(
        totals.grandTotal,
      )}</td>
    </tr>
  </table>
</div>
 
  <div class="footer">Powered by AMDAANI | ${new Date().toLocaleString()}</div>
</body>
</html>`;
  };

  // ─── Export PDF ───────────────────────────────────────────────────────────
  const exportPDF = async () => {
    if (!purchases.length) {
      Alert.alert('No Data', 'Generate a report first.');
      return;
    }
    try {
      const storageOk = await ensureStoragePermission();
      const downloadsOk = await ensureAndroidDownloadPermission();
      if (!storageOk || !downloadsOk) return;

      const html = buildHTML();
      const pdfRes = await RNHTMLtoPDF.convert({
        html,
        fileName: `Purchase_Register_${Date.now()}`,
        base64: false,
        orientation: 'landscape',
      });

      const downloadsDir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const suggested = `Purchase_Register_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;
      let finalPath = `${downloadsDir}/${suggested}`;
      if (await RNFS.exists(finalPath)) {
        finalPath = `${downloadsDir}/Purchase_Register_${new Date()
          .toISOString()
          .replace(/[:.]/g, '-')}.pdf`;
      }
      await RNFS.copyFile(pdfRes.filePath, finalPath);

      try {
        await FileViewer.open(finalPath, { showOpenWithDialog: true });
      } catch (openErr) {
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

  // ─── Export Excel ─────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const storageOk = await ensureStoragePermission();
    const downloadsOk = await ensureAndroidDownloadPermission();
    if (!storageOk || !downloadsOk) return;
    if (!purchases.length) {
      Alert.alert('No Data', 'No records to export.');
      return;
    }

    try {
      const sorted = [...purchases].sort(
        (a, b) =>
          new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt),
      );

      const data = sorted.map((p, idx) => {
        const d = getRowData(p, idx + 1);
        return {
          SL: d.sl,
          'Bill Date': d.billDate,
          'Supplier Name': d.supplierName,
          'Supplier Mobile': d.supplierMobile,
          'Total Items Qty': d.totalItemsQty,
          'Discount (%)': d.discountPct,
          'Taxable Value': d.rawTaxableValue, // ✅ new
          CGST: d.rawCgst, // ✅ new
          SGST: d.rawSgst, // ✅ new
          Tax: d.rawGst,
          'Payment Status': d.paymentStatus,
          'Net Amount': d.rawGrandTotal,
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = Object.keys(data[0]).map(key => ({
        wch: Math.max(14, key.length + 2),
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Purchase Report');
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      const downloadsDir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const baseName = `Purchase_Register_${new Date()
        .toISOString()
        .slice(0, 10)}`;
      let finalPath = `${downloadsDir}/${baseName}.xlsx`;
      if (await RNFS.exists(finalPath)) {
        finalPath = `${downloadsDir}/${baseName}_${Date.now()}.xlsx`;
      }

      await RNFS.writeFile(finalPath, wbout, 'base64');

      try {
        await FileViewer.open(finalPath, { showOpenWithDialog: true });
      } catch (openErr) {
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

  // ─── List item card ───────────────────────────────────────────────────────
  const renderItem = ({ item, index }) => {
    const billDate = item.date
      ? format(new Date(item.date), 'dd MMM yyyy')
      : '-';

    const totalQty = (item.items || []).reduce(
      (s, it) => s + Number(it.quantity || 0),
      0,
    );

    const discountPct =
      item.grandTotal > 0
        ? ((Number(item.discountTotal || 0) / item.grandTotal) * 100).toFixed(1)
        : '0.0';

    return (
      <Card
        style={styles.card}
        contentStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 12,
        }}
        mode="outlined"
        onPress={() =>
          navigation.navigate('PurchaseDetail', { purchaseId: item._id })
        }
      >
        {/* Header: Supplier + Invoice Number */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {!item?.vendorName && (
                <Icon
                  source="phone"
                  size={16}
                  color={theme.colors.onSurfaceVariant}
                />
              )}
              <Text
                variant="titleMedium"
                style={{ marginLeft: !item?.vendorName ? 4 : 0 }}
                numberOfLines={1}
              >
                {item.vendorName?.trim() || item.vendorMobile || '-'}
              </Text>
            </View>
            {item.vendorName?.trim() ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 2,
                }}
              >
                <Icon
                  source="phone"
                  size={14}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text variant="labelSmall" style={{ marginLeft: 4 }}>
                  {item.vendorMobile}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="titleSmall">
            {'#'}
            {item.invoiceNumber || item._id}
          </Text>
        </View>

        {/* Date + SL tag */}
        <View style={styles.cardMeta}>
          <View
            style={[
              styles.tag,
              { backgroundColor: theme.colors.secondaryContainer },
            ]}
          >
            <Text style={[styles.tagText, { color: theme.colors.secondary }]}>
              PURCHASE
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon
              source="calendar"
              size={12}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              variant="labelSmall"
              style={{ marginLeft: 4, letterSpacing: 0.4 }}
            >
              {billDate}
            </Text>
          </View>
        </View>

        {/* Details row */}
        <View style={styles.cardDetails}>
          <View style={styles.detailCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon
                source="currency-inr"
                size={16}
                color={theme.colors.onSurfaceVariant}
              />
              <Text variant="labelLarge">Net Amt</Text>
            </View>
            <Text variant="labelLarge">
              {Number(item.grandTotal || 0).toFixed(2)}
            </Text>
          </View>

          <View style={styles.detailCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon
                source="package-variant"
                size={16}
                color={theme.colors.onSurfaceVariant}
              />
              <Text variant="labelLarge" style={{ marginLeft: 4 }}>
                Qty
              </Text>
            </View>
            <Text variant="labelLarge">{totalQty}</Text>
          </View>

          <View style={styles.detailCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon
                source="credit-card-outline"
                size={16}
                color={theme.colors.onSurfaceVariant}
              />
              <Text variant="labelLarge" style={{ marginLeft: 4 }}>
                Status
              </Text>
            </View>
            <Text
              variant="labelLarge"
              style={{
                color:
                  item.paymentStatus === 'paid'
                    ? 'green'
                    : item.paymentStatus === 'partial'
                    ? theme.colors.tertiary ?? '#d97706'
                    : theme.colors.error,
                textTransform: 'capitalize',
              }}
            >
              {item.paymentStatus || '-'}
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar
        showBackButton
        title="Purchase Report"
        rightComponent={
          <>
            <IconButton
              icon="file-pdf-box"
              iconColor="red"
              onPress={exportPDF}
              disabled={!purchases.length || loading}
              accessibilityLabel="Export PDF"
            />
            <IconButton
              icon="file-excel"
              iconColor="green"
              onPress={exportExcel}
              disabled={!purchases.length || loading}
              accessibilityLabel="Export Excel"
            />
          </>
        }
      />

      {/* ── Filters ── */}
      <View style={[styles.header, compact && { paddingHorizontal: 12 }]}>
        {/* Date range row */}
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

        {/* Quick range row */}
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

        {/* Generate row */}
        <View style={[styles.row, compact && { gap: 6 }]}>
          <Button
            mode="contained"
            onPress={fetchPurchases}
            disabled={!startDate || !endDate}
            style={{ flex: 1 }}
            icon={loading ? 'progress-clock' : 'refresh'}
            labelStyle={{
              color:
                !startDate || !endDate
                  ? theme.colors.onBackground
                  : theme.colors.onSurface,
            }}
          >
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </View>
      </View>

      {/* ── Body ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.mt8}>Loading...</Text>
        </View>
      ) : purchases.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>
            No records. Select a date range and Generate.
          </Text>
        </View>
      ) : (
        <>
          {/* Summary card */}
          <View style={styles.summaryWrap}>
            <Card mode="elevated" style={styles.summaryCard}>
              <Card.Content style={styles.summaryContent}>
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
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCol}>
                    <Text variant="labelSmall" style={styles.summaryLabel}>
                      Grand Total
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
            data={purchases}
            keyExtractor={(item, idx) => String(item._id || idx)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
          />
        </>
      )}

      {/* ── Date picker ── */}
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

      {/* ── Save dialog ── */}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dateBtn: { flex: 1 },
  iconBtn: { margin: 0 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  summaryWrap: { paddingHorizontal: 10, paddingVertical: 6 },
  summaryCard: { borderRadius: 10 },
  summaryContent: { paddingVertical: 6 },
  summaryHeader: { marginBottom: 4 },
  summaryLabel: { fontSize: 11 },
  summaryValue: { fontWeight: '600' },
  hr: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryCol: { flex: 1, alignItems: 'center' },
  vDivider: {
    width: StyleSheet.hairlineWidth,
    height: '100%',
    marginHorizontal: 8,
  },
  list: { padding: 12 },
  card: { marginBottom: 8, borderRadius: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  tagText: { fontWeight: '500', fontSize: 12 },
  cardDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  detailCol: { flex: 1 },
  muted: { color: '#6b7280' },
  mt8: { marginTop: 8 },
});

export default PurchaseReport;
