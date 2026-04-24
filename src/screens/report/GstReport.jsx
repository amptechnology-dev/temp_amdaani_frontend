import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  IconButton,
  SegmentedButtons,
} from 'react-native-paper';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import RNFS from 'react-native-fs';
import FileViewer from 'react-native-file-viewer';
import api from '../../utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { useRoute } from '@react-navigation/native';
import Config from 'react-native-config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GstReport = () => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const [gstData, setGstData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [gstType, setGstType] = useState('sales');

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [pickerMode, setPickerMode] = useState(null);

  const { authState } = useAuth();
  const route = useRoute();

  const dashboardFlag = route?.params?.dashboardFlag || false;
  const dashboardWeeklyFlag = route?.params?.dashboardWeeklyFlag || false;
  const dashboardMonthlyFlag = route?.params?.dashboardMonthlyFlag || false;
  const dashboardTodayFlag = route?.params?.dashboardTodayFlag || false;

  // ✅ Derive endpoints directly from gstType — no ref needed
  const endpoint =
    gstType === 'sales' ? '/invoice/gst-sales-report' : '/invoice/gst-purchase';
  const excelEndpoint =
    gstType === 'sales'
      ? '/invoice/gst-sales-report/excel'
      : '/invoice/gst-purchase/excel';

  const toLocalISODate = d => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const toSafeDate = d => (d instanceof Date ? d : new Date(d));

  const formatDate = date => {
    if (!date) return 'All';
    const d = toSafeDate(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const formattedRange = useMemo(() => {
    const s = startDate ? formatDate(startDate) : 'All';
    const e = endDate ? formatDate(endDate) : 'All';
    return `${s} - ${e}`;
  }, [startDate, endDate]);

  // ─── Data fetch ─────────────────────────────────────────────────────────────

  // ✅ Accept endpoint as a parameter so the caller always passes the correct one
  const fetchByDates = useCallback(async (sDate, eDate, ep) => {
    if (!sDate || !eDate) {
      Alert.alert('Select Dates', 'Please select both start and end date.');
      return;
    }
    const safeStart = toSafeDate(sDate);
    const safeEnd = toSafeDate(eDate);
    if (safeEnd < safeStart) {
      Alert.alert('Invalid Range', 'End date cannot be before start date.');
      return;
    }
    try {
      setLoading(true);
      const params = {
        startDate: toLocalISODate(safeStart),
        endDate: toLocalISODate(safeEnd),
      };
      console.log('fetchByDates →', ep, params);
      const response = await api.get(ep, { params });
      let rows = [];
      if (Array.isArray(response?.data)) {
        rows = response.data;
      } else if (Array.isArray(response?.data?.data)) {
        rows = response.data.data;
      }
      setGstData(rows);
    } catch (error) {
      console.error('GST date fetch error:', error?.message);
      Alert.alert('Error', error?.message || 'Failed to fetch GST data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchByRange = useCallback(async (range, ep) => {
    try {
      setLoading(true);
      console.log('fetchByRange →', ep, range);
      const response = await api.get(ep, { params: { range } });
      let rows = [];
      if (Array.isArray(response?.data)) {
        rows = response.data;
      } else if (Array.isArray(response?.data?.data)) {
        rows = response.data.data;
      }
      setGstData(rows);
    } catch (error) {
      console.error('GST range fetch error:', error?.message);
      Alert.alert('Error', error?.message || 'Failed to fetch GST data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Re-fetch when gstType changes (if dates already selected) ───────────────

  useEffect(() => {
    if (startDate && endDate) {
      fetchByDates(startDate, endDate, endpoint);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gstType]);

  // ─── Dashboard flags ─────────────────────────────────────────────────────────

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
      fetchByRange('year', endpoint);
    } else if (dashboardWeeklyFlag) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      setStartDate(weekStart);
      setEndDate(today);
      fetchByDates(weekStart, today, endpoint);
    } else if (dashboardMonthlyFlag) {
      setStartDate(new Date(today.getFullYear(), today.getMonth(), 1));
      setEndDate(today);
      fetchByRange('thisMonth', endpoint);
    } else if (dashboardTodayFlag) {
      setStartDate(today);
      setEndDate(today);
      fetchByDates(today, today, endpoint);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dashboardFlag,
    dashboardWeeklyFlag,
    dashboardMonthlyFlag,
    dashboardTodayFlag,
  ]);

  // ─── Quick range buttons ─────────────────────────────────────────────────────

  const applyThisYear = () => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const fyStart =
      currentMonth >= 4
        ? new Date(today.getFullYear(), 3, 1)
        : new Date(today.getFullYear() - 1, 3, 1);
    setStartDate(fyStart);
    setEndDate(today);
    fetchByRange('year', endpoint);
  };

  const applyThisMonth = () => {
    const today = new Date();
    setStartDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setEndDate(today);
    fetchByRange('thisMonth', endpoint);
  };

  const applyPreviousMonth = () => {
    const today = new Date();
    const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    setStartDate(prevStart);
    setEndDate(prevEnd);
    fetchByRange('previousMonth', endpoint);
  };

  // ─── Excel export ─────────────────────────────────────────────────────────────

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

  const exportExcel = async () => {
    if (!gstData.length) {
      Alert.alert('No Data', 'Generate a report first.');
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert('No Date Range', 'Please select a date range first.');
      return;
    }

    const hasPermission = await ensureAndroidDownloadPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Denied',
        'Cannot save file without storage permission.',
      );
      return;
    }

    try {
      setExcelLoading(true);

      const params = new URLSearchParams({
        startDate: toLocalISODate(toSafeDate(startDate)),
        endDate: toLocalISODate(toSafeDate(endDate)),
      }).toString();

      const storedAuth = await AsyncStorage.getItem('auth');
      const token = storedAuth ? JSON.parse(storedAuth).accessToken : null;

      const baseURL =
        Config.API_BASE_URL || 'https://amdaani.v1.amptechnology.in/api';

      // ✅ Use excelEndpoint derived from current gstType state
      const downloadUrl = `${baseURL}${excelEndpoint}?${params}`;

      const fileName =
        gstType === 'sales'
          ? `GST_Sales_${toLocalISODate(
              toSafeDate(startDate),
            )}_to_${toLocalISODate(toSafeDate(endDate))}.xlsx`
          : `GST_Purchase_${toLocalISODate(
              toSafeDate(startDate),
            )}_to_${toLocalISODate(toSafeDate(endDate))}.xlsx`;

      const downloadsDir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;

      const destPath = `${downloadsDir}/${fileName}`;

      console.log('Excel download URL:', downloadUrl);

      const result = await RNFS.downloadFile({
        fromUrl: downloadUrl,
        toFile: destPath,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        background: false,
        discretionary: false,
      }).promise;

      if (result.statusCode === 200) {
        try {
          await FileViewer.open(destPath, { showOpenWithDialog: true });
        } catch (openErr) {
          Alert.alert(
            'File Saved',
            `Excel file saved to Downloads:\n${fileName}`,
          );
        }
      } else {
        Alert.alert(
          'Download Failed',
          `Server returned status ${result.statusCode}`,
        );
      }
    } catch (error) {
      console.error('Excel export error:', error?.message);
      Alert.alert(
        'Export Failed',
        error?.message || 'Could not download Excel file.',
      );
    } finally {
      setExcelLoading(false);
    }
  };

  // ─── Totals ──────────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    const toNum = v => Number(v || 0);
    return {
      count: gstData.length,
      taxableValue: gstData.reduce((s, r) => s + toNum(r.taxableValue), 0),
      cgst: gstData.reduce((s, r) => s + toNum(r.cgstAmount), 0),
      sgst: gstData.reduce((s, r) => s + toNum(r.sgstAmount), 0),
      totalGst: gstData.reduce(
        (s, r) => s + toNum(r.cgstAmount) + toNum(r.sgstAmount),
        0,
      ),
      totalAmount: gstData.reduce(
        (s, r) => s + toNum(r.invoiceAmount || r.billAmount),
        0,
      ),
    };
  }, [gstData]);

  // ─── Render item ──────────────────────────────────────────────────────────────

  const renderItem = ({ item }) => {
    const isSales = gstType === 'sales';
    const invoiceNo = isSales ? item.invoiceNumber : item.billNumber;
    const date = isSales ? item.invoiceDate : item.purchaseDate;
    const partyName = isSales ? item.customerName : item.vendorName;
    const partyGst = isSales ? item.customerGst : item.vendorGst;
    const amount = isSales ? item.invoiceAmount : item.billAmount;
    const cgst = Number(item.cgstAmount || 0);
    const sgst = Number(item.sgstAmount || 0);
    const totalGst = cgst + sgst;
    const taxable = Number(item.taxableValue || 0);
    const cgstPct = Number(item.cgstPercent || 0);
    const sgstPct = Number(item.sgstPercent || 0);

    return (
      <Card style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardRow}>
            <Text variant="titleSmall" style={styles.cardTitle}>
              {invoiceNo || '-'}
            </Text>
            <Text variant="titleSmall" style={styles.cardTitle}>
              ₹{Number(amount || 0).toFixed(2)}
            </Text>
          </View>
          <View style={[styles.cardRow, { marginTop: 3 }]}>
            <Text variant="bodySmall" style={styles.muted}>
              {partyName || '-'}
            </Text>
            {!!partyGst && (
              <Text variant="bodySmall" style={styles.muted}>
                {partyGst}
              </Text>
            )}
          </View>
          <View style={[styles.cardRow, { marginTop: 3 }]}>
            <Text variant="bodySmall" style={styles.muted}>
              {date ? new Date(date).toLocaleDateString() : '-'}
            </Text>
            {!!item.hsn && (
              <Text variant="bodySmall" style={styles.muted}>
                HSN: {item.hsn}
              </Text>
            )}
          </View>
          <View style={[styles.cardRow, { marginTop: 3 }]}>
            <Text variant="bodySmall" style={styles.muted}>
              {item.item || '-'}
              {item.unit ? ` (${item.unit})` : ''}
            </Text>
            <Text variant="bodySmall" style={styles.muted}>
              Qty: {item.quantity || 0}
            </Text>
          </View>
          <View
            style={[
              styles.hr,
              { backgroundColor: theme.colors.outline, marginVertical: 8 },
            ]}
          />
          <View style={styles.taxRow}>
            <View style={styles.taxCol}>
              <Text variant="labelSmall" style={styles.muted}>
                Taxable
              </Text>
              <Text variant="bodySmall" style={styles.taxValue}>
                ₹{taxable.toFixed(2)}
              </Text>
            </View>
            <View
              style={[
                styles.vDivider,
                { backgroundColor: theme.colors.outline },
              ]}
            />
            <View style={styles.taxCol}>
              <Text variant="labelSmall" style={styles.muted}>
                CGST {cgstPct}%
              </Text>
              <Text variant="bodySmall" style={styles.taxValue}>
                ₹{cgst.toFixed(2)}
              </Text>
            </View>
            <View
              style={[
                styles.vDivider,
                { backgroundColor: theme.colors.outline },
              ]}
            />
            <View style={styles.taxCol}>
              <Text variant="labelSmall" style={styles.muted}>
                SGST {sgstPct}%
              </Text>
              <Text variant="bodySmall" style={styles.taxValue}>
                ₹{sgst.toFixed(2)}
              </Text>
            </View>
            <View
              style={[
                styles.vDivider,
                { backgroundColor: theme.colors.outline },
              ]}
            />
            <View style={styles.taxCol}>
              <Text variant="labelSmall" style={styles.muted}>
                Total GST
              </Text>
              <Text
                variant="bodySmall"
                style={[styles.taxValue, { fontWeight: '700' }]}
              >
                ₹{totalGst.toFixed(2)}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  // ─── UI ───────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar
        showBackButton
        title="GST Report"
        rightComponent={
          excelLoading ? (
            <ActivityIndicator size="small" style={{ marginRight: 12 }} />
          ) : (
            <IconButton
              icon="file-excel"
              iconColor="green"
              onPress={exportExcel}
              disabled={!gstData.length || loading || excelLoading}
              accessibilityLabel="Export Excel"
            />
          )
        }
      />

      <View style={[styles.header, compact && { paddingHorizontal: 12 }]}>
        <SegmentedButtons
          value={gstType}
          onValueChange={value => {
            setGstType(value);
            setStartDate(null);
            setEndDate(null);
            setGstData([]);
          }}
          buttons={[
            { value: 'sales', label: 'Sales GST' },
            { value: 'purchase', label: 'Purchase GST' },
          ]}
          style={styles.segmented}
        />

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
              setGstData([]);
            }}
            style={styles.iconBtn}
            disabled={loading || (!startDate && !endDate)}
            accessibilityLabel="Clear date range"
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
            onPress={() => fetchByDates(startDate, endDate, endpoint)}
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
      ) : gstData.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>
            No records. Select a date range and Generate.
          </Text>
        </View>
      ) : (
        <>
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
                      Total Amount
                    </Text>
                    <Text variant="titleSmall" style={styles.summaryValue}>
                      ₹{totals.totalAmount.toFixed(2)}
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
                      Taxable
                    </Text>
                    <Text variant="titleSmall" style={styles.summaryValue}>
                      ₹{totals.taxableValue.toFixed(2)}
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
                    <Text variant="titleSmall" style={styles.summaryValue}>
                      {totals.count}
                    </Text>
                  </View>
                </View>
                <View
                  style={[styles.hr, { backgroundColor: theme.colors.outline }]}
                />
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCol}>
                    <Text variant="labelSmall" style={styles.summaryLabel}>
                      CGST
                    </Text>
                    <Text variant="titleSmall" style={styles.summaryValue}>
                      ₹{totals.cgst.toFixed(2)}
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
                      SGST
                    </Text>
                    <Text variant="titleSmall" style={styles.summaryValue}>
                      ₹{totals.sgst.toFixed(2)}
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
                      Total GST
                    </Text>
                    <Text
                      variant="titleSmall"
                      style={[
                        styles.summaryValue,
                        { color: theme.colors.primary },
                      ]}
                    >
                      ₹{totals.totalGst.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          </View>

          <FlatList
            data={gstData}
            keyExtractor={(item, idx) =>
              `${
                item._id || item.billNumber || item.invoiceNumber || 'row'
              }-${idx}`
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
        onConfirm={pickedDate => {
          const safeDate =
            pickedDate instanceof Date ? pickedDate : new Date(pickedDate);
          const mode = pickerMode;
          setPickerMode(null);
          if (mode === 'start') {
            setStartDate(safeDate);
            if (endDate) fetchByDates(safeDate, endDate, endpoint);
          } else if (mode === 'end') {
            setEndDate(safeDate);
            if (startDate) fetchByDates(startDate, safeDate, endpoint);
          }
        }}
        onCancel={() => setPickerMode(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  segmented: { marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBtn: { flex: 1 },
  iconBtn: { margin: 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  muted: { opacity: 0.6 },
  mt8: { marginTop: 8 },
  list: { padding: 16, gap: 10 },
  card: { borderRadius: 10 },
  cardContent: { paddingVertical: 10 },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { fontWeight: '600' },
  taxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taxCol: { flex: 1, alignItems: 'center', gap: 2 },
  taxValue: { fontWeight: '500' },
  summaryWrap: { paddingHorizontal: 16, paddingTop: 12 },
  summaryCard: { borderRadius: 12 },
  summaryContent: { gap: 10 },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: { fontWeight: '700' },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryCol: { flex: 1, alignItems: 'center', gap: 2 },
  hr: { height: 1, opacity: 0.2 },
  vDivider: { width: 1, height: 36, opacity: 0.2 },
  submitButtonLabel: { fontWeight: '600' },
});

export default GstReport;
