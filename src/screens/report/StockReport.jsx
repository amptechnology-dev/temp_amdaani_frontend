import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { useRoute } from '@react-navigation/native';

const StockReport = () => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [pickerMode, setPickerMode] = useState(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [lastSavedPath, setLastSavedPath] = useState(null);
  const [hasFetched, setHasFetched] = useState(false); // ✅ track if user has generated at least once

  const { authState } = useAuth();
  const store = authState?.user?.store || authState?.store || null;
  const route = useRoute();
  const dashboardFlag = route?.params?.dashboardFlag || false;
  const dashboardWeeklyFlag = route?.params?.dashboardWeeklyFlag || false;
  const dashboardMonthlyFlag = route?.params?.dashboardMonthlyFlag || false;
  const dashboardTodayFlag = route?.params?.dashboardTodayFlag || false;

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

  const formatQueryDate = date => {
    if (!date) return undefined;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // ✅ FIX: Accept explicit date params to avoid stale closure on auto-fetch
  const fetchRecords = useCallback(
    async (start = startDate, end = endDate) => {
      if (!start || !end) {
        Alert.alert('Missing Dates', 'Please select both start and end dates.');
        return;
      }
      try {
        setLoading(true);
        // ✅ FIX: Correct endpoint — matches backend route for stock report
        const res = await api.get('/invoice/stock-report', {
          params: {
            startDate: formatQueryDate(start),
            endDate: formatQueryDate(end),
          },
        });

        const rows = res?.data || [];
        setRecords(rows);
        setHasFetched(true);
      } catch (e) {
        console.error('Stock report fetch error:', e?.message);
        Alert.alert('Error', 'Failed to fetch stock report data.');
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate],
  );

  // ✅ FIX: Dashboard flags set dates AND immediately fetch in one go — no race condition
  useEffect(() => {
    const today = new Date();
    let start = null;
    let end = null;

    if (dashboardFlag) {
      const currentMonth = today.getMonth() + 1;
      const fyStart =
        currentMonth >= 4
          ? new Date(today.getFullYear(), 3, 1)
          : new Date(today.getFullYear() - 1, 3, 1);
      start = fyStart;
      end = today;
    } else if (dashboardWeeklyFlag) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      start = weekStart;
      end = today;
    } else if (dashboardMonthlyFlag) {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = today;
    } else if (dashboardTodayFlag) {
      start = today;
      end = today;
    }

    if (start && end) {
      setStartDate(start);
      setEndDate(end);
      // ✅ FIX: Pass dates directly instead of relying on state update propagating first
      fetchRecords(start, end);
    }
  }, [
    dashboardFlag,
    dashboardWeeklyFlag,
    dashboardMonthlyFlag,
    dashboardTodayFlag,
  ]);

  // ✅ Quick-select helpers — set state AND fetch immediately
  const applyRange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
    fetchRecords(start, end);
  };

  const applyThisYear = () => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const fyStart =
      currentMonth >= 4
        ? new Date(today.getFullYear(), 3, 1)
        : new Date(today.getFullYear() - 1, 3, 1);
    applyRange(fyStart, today);
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

  // ✅ FIX: Clear also resets hasFetched so the empty state message is correct
  const clearDates = () => {
    setStartDate(null);
    setEndDate(null);
    setRecords([]);
    setHasFetched(false);
  };

  const totals = useMemo(() => {
    return {
      count: records.length,
      // ✅ FIX: Only use field names that backend actually returns
      itemValue: records.reduce(
        (sum, rec) => sum + Number(rec.itemValue || 0),
        0,
      ),
      quantity: records.reduce(
        (sum, rec) => sum + Number(rec.quantity || 0),
        0,
      ),
    };
  }, [records]);

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

  const currency = value => `₹${Number(value || 0).toFixed(2)}`;
  // ✅ FIX: safe now only used for strings that might be null/undefined
  const safe = value =>
    value === undefined || value === null || value === '' ? '-' : String(value);

  const buildHTML = () => {
    const bodyRows = records
      .map((record, index) => {
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${safe(record.itemDescription)}</td>
            <td align="right">${currency(record.itemValue)}</td>
            <td align="right">${safe(record.quantity)}</td>
            <td align="right">${safe(record.totalIn)}</td>
            <td align="right">${safe(record.totalOut)}</td>
          </tr>`;
      })
      .join('');

    return `
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Roboto, Segoe UI, Arial; margin: 0; padding: 16px; color: #111; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .muted { color: #666; margin-bottom: 16px; }
          .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
          .chip { border-radius: 16px; padding: 6px 12px; background: #f2f2f2; font-size: 12px; color: #333; border: 1px solid #ddd; }
          table { border-collapse: collapse; width: 100%; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td { border-bottom: 1px solid #eee; padding: 8px 6px; font-size: 11px; word-wrap: break-word; }
          th { background: #fafafa; font-weight: 700; }
          .footer { margin-top: 14px; color: #666; font-size: 10px; }
        </style>
      </head>
      <body>
        <h1>Stock Report</h1>
        <div class="muted">Period: ${formattedRange}</div>
        <div class="summary">
          <div class="chip">Records: ${totals.count}</div>
          <div class="chip">Total Value: ${currency(totals.itemValue)}</div>
          <div class="chip">Total Qty: ${totals.quantity}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>SL NO</th>
              <th>Item Description</th>
              <th align="right">Item Value</th>
              <th align="right">Quantity</th>
              <th align="right">Total In</th>
              <th align="right">Total Out</th>
            </tr>
          </thead>
          <tbody>${
            bodyRows ||
            `<tr><td colspan="6" align="center">No records</td></tr>`
          }</tbody>
        </table>
        <div class="footer">Powered by AMDAANI | ${new Date().toLocaleString()}</div>
      </body>
      </html>`;
  };

  const exportPDF = async () => {
    if (!records.length) {
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
        fileName: `Stock_Report_${Date.now()}`,
        base64: false,
        orientation: 'landscape',
      });
      const downloadsDir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const baseName = `Stock_Report_${new Date().toISOString().slice(0, 10)}`;
      let finalPath = `${downloadsDir}/${baseName}.pdf`;
      if (await RNFS.exists(finalPath)) {
        finalPath = `${downloadsDir}/${baseName}_${Date.now()}.pdf`;
      }
      await RNFS.copyFile(pdfRes.filePath, finalPath);
      try {
        await FileViewer.open(finalPath, { showOpenWithDialog: true });
      } catch {
        Alert.alert(
          'PDF Saved',
          'Saved to Downloads. No PDF viewer available to open it.',
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
    if (!records.length) {
      Alert.alert('No Data', 'No records to export.');
      return;
    }
    const storageOk = await ensureStoragePermission();
    const downloadsOk = await ensureAndroidDownloadPermission();
    if (!storageOk || !downloadsOk) return;

    try {
      // ✅ FIX: Use exact field names returned by backend
      const data = records.map((record, index) => ({
        'SL NO': index + 1,
        'Item Description': safe(record.itemDescription),
        'Item Value': Number(record.itemValue || 0),
        Quantity: Number(record.quantity || 0),
        'Total In': Number(record.totalIn || 0),
        'Total Out': Number(record.totalOut || 0),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = Object.keys(data[0]).map(key => ({
        wch: Math.max(12, key.length + 2),
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const downloadsDir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const baseName = `Stock_Report_${new Date().toISOString().slice(0, 10)}`;
      let finalPath = `${downloadsDir}/${baseName}.xlsx`;
      if (await RNFS.exists(finalPath)) {
        finalPath = `${downloadsDir}/${baseName}_${Date.now()}.xlsx`;
      }
      await RNFS.writeFile(finalPath, wbout, 'base64');
      try {
        await FileViewer.open(finalPath, { showOpenWithDialog: true });
      } catch {
        Alert.alert(
          'Excel Saved',
          'Saved to Downloads. No Excel viewer available to open it.',
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

  // ✅ FIX: renderItem only uses fields the backend actually returns
  const renderItem = ({ item, index }) => (
    <Card
      mode="outlined"
      style={styles.card}
      contentStyle={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
      }}
    >
      {/* Header: Item description + Item value */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" numberOfLines={2}>
            {index + 1}. {safe(item.itemDescription)}
          </Text>
        </View>
        <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
          {currency(item.itemValue)}
        </Text>
      </View>

      {/* Meta: Qty tag + In/Out tags */}
      <View style={styles.cardMeta}>
        <View
          style={[
            styles.tag,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <Text style={[styles.tagText, { color: theme.colors.primary }]}>
            Qty: {safe(item.quantity)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={[styles.tag, { backgroundColor: '#dcfce7' }]}>
            <Text style={[styles.tagText, { color: '#16a34a' }]}>
              ▲ In: {safe(item.totalIn)}
            </Text>
          </View>
          <View
            style={[
              styles.tag,
              { backgroundColor: theme.colors.errorContainer },
            ]}
          >
            <Text style={[styles.tagText, { color: theme.colors.error }]}>
              ▼ Out: {safe(item.totalOut)}
            </Text>
          </View>
        </View>
      </View>

      {/* Details row */}
      <View style={styles.cardDetails}>
        <View style={styles.detailCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon
              source="package-variant"
              size={14}
              color={theme.colors.onSurfaceVariant}
            />
            <Text variant="labelSmall" style={{ marginLeft: 4 }}>
              Quantity
            </Text>
          </View>
          <Text variant="labelLarge">{safe(item.quantity)}</Text>
        </View>

        <View style={styles.detailCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon
              source="arrow-down-circle-outline"
              size={14}
              color="#16a34a"
            />
            <Text variant="labelSmall" style={{ marginLeft: 4 }}>
              Total In
            </Text>
          </View>
          <Text variant="labelLarge" style={{ color: '#16a34a' }}>
            {safe(item.totalIn)}
          </Text>
        </View>

        <View style={styles.detailCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon
              source="arrow-up-circle-outline"
              size={14}
              color={theme.colors.error}
            />
            <Text variant="labelSmall" style={{ marginLeft: 4 }}>
              Total Out
            </Text>
          </View>
          <Text variant="labelLarge" style={{ color: theme.colors.error }}>
            {safe(item.totalOut)}
          </Text>
        </View>

        <View style={styles.detailCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon
              source="currency-inr"
              size={14}
              color={theme.colors.onSurfaceVariant}
            />
            <Text variant="labelSmall">Value</Text>
          </View>
          <Text
            variant="labelLarge"
            style={{ fontWeight: '700', color: theme.colors.primary }}
          >
            {currency(item.itemValue)}
          </Text>
        </View>
      </View>
    </Card>
  );

  // ✅ Determine the right empty state message
  const emptyMessage =
    !startDate || !endDate
      ? 'Select a date range and tap Generate.'
      : hasFetched
      ? 'No stock records found for the selected period.'
      : 'Tap Generate to load the report.';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar
        showBackButton
        title="Stock Report"
        rightComponent={
          <>
            <IconButton
              icon="file-pdf-box"
              iconColor="red"
              onPress={exportPDF}
              disabled={!records.length || loading}
              accessibilityLabel="Export PDF"
            />
            <IconButton
              icon="file-excel"
              iconColor="green"
              onPress={exportExcel}
              disabled={!records.length || loading}
              accessibilityLabel="Export Excel"
            />
          </>
        }
      />

      <View style={[styles.header, compact && { paddingHorizontal: 12 }]}>
        {/* Date pickers */}
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
            onPress={clearDates}
            style={styles.iconBtn}
            disabled={loading || (!startDate && !endDate)}
            accessibilityLabel="Clear date range"
          />
        </View>

        {/* Quick-select buttons */}
        <View style={[styles.row, compact && { gap: 4 }]}>
          <Button
            mode="outlined"
            compact
            onPress={applyThisYear}
            style={{ flex: 1 }}
            labelStyle={{ fontSize: 11 }}
            disabled={loading}
          >
            This Year
          </Button>
          <Button
            mode="outlined"
            compact
            onPress={applyThisMonth}
            style={{ flex: 1 }}
            labelStyle={{ fontSize: 11 }}
            disabled={loading}
          >
            This Month
          </Button>
          <Button
            mode="outlined"
            compact
            onPress={applyPreviousMonth}
            style={{ flex: 1 }}
            labelStyle={{ fontSize: 11 }}
            disabled={loading}
          >
            Prev Month
          </Button>
        </View>

        {/* Generate button */}
        <View style={[styles.row, compact && { gap: 6 }]}>
          <Button
            mode="contained"
            onPress={() => fetchRecords(startDate, endDate)}
            disabled={!startDate || !endDate || loading}
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
          <Text style={styles.mt8}>Loading...</Text>
        </View>
      ) : records.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{emptyMessage}</Text>
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
                      Count
                    </Text>
                    <Text variant="titleMedium" style={styles.summaryValue}>
                      {totals.count}
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
                      Total Value
                    </Text>
                    <Text variant="titleMedium" style={styles.summaryValue}>
                      {currency(totals.itemValue)}
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
                      Total Qty
                    </Text>
                    <Text variant="titleMedium" style={styles.summaryValue}>
                      {totals.quantity}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          </View>

          <FlatList
            data={records}
            keyExtractor={(item, idx) => String(item._id || item.id || idx)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      {/* Date picker modal */}
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

      {/* Save dialog */}
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
  header: { paddingHorizontal: 16, gap: 12, paddingTop: 8 },
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
  list: { padding: 12, paddingBottom: 24 },
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
  tagText: { fontWeight: '600', fontSize: 11 },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailCol: { flex: 1 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  muted: { color: '#6b7280' },
  mt8: { marginTop: 8 },
});

export default StockReport;
