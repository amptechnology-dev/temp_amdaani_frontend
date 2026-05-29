import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  Platform,
  PermissionsAndroid,
  useWindowDimensions,
  ScrollView,
  TouchableOpacity,
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
  Menu,
  TextInput,
} from 'react-native-paper';
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

/*
  API response shape (per record) — current:
  {
    openingQty         : 0,
    purchaseQty        : 1,
    returnInQty        : 0,
    saleQty            : 0,
    returnOutQty       : 1,
    damageQty          : 0,
    closingStock       : 0,
    currentStockValue  : 0,
    avgStockValue      : 0,
    adjustmentQty      : 0,
    itemDescription    : "Pen",
    lastPurchaseRate   : 80,
    avgPurchaseRate    : 80,
  }
*/

// ─── transaction type config ───────────────────────────────────────────────────

const AS_ON_DATE_TYPES = new Set([
  'DAMAGE',
  'SALE',
  'SALE_RETURN',
  'PURCHASE_RETURN',
  'PURCHASE_REVERSE',
  'STOCK_REDUCE',
  'RETURN_TO_VENDOR',
  'TRANSFER',
]);

const TRANSACTION_TYPES = [
  { key: null, label: 'All', icon: '📦' },
  { key: 'DAMAGE', label: 'Damage', icon: '🔴' },
  { key: 'PURCHASE_RETURN', label: 'Purch. Return', icon: '↩️' },
  { key: 'SALE_RETURN', label: 'Sale Return', icon: '↪️' },
  { key: 'EXPIRED', label: 'Expired', icon: '📅' },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

// Total inward = purchase + returnIn (fallback to older fields)
const totalIn = r =>
  (r.purchaseQty || 0) +
  (r.returnInQty || 0) +
  (r.saleReturnQty || 0) +
  (r.adjustmentInQty || 0);

// Total outward = sale + returnOut + damage (fallback to older fields)
const totalOut = r =>
  (r.saleQty || 0) +
  (r.returnOutQty || 0) +
  (r.damageQty || 0) +
  (r.purchaseReturnQty || 0) +
  (r.purchaseReverseQty || 0) +
  (r.stockReduceQty || 0) +
  (r.returnToVendorQty || 0) +
  (r.transferQty || 0) +
  (r.adjustmentOutQty || 0);

const currency = v => `₹${Number(v || 0).toFixed(2)}`;
const safe = v => (v === undefined || v === null || v === '' ? '-' : String(v));
const num = v => Number(v || 0);

const fmtDisplay = date => {
  if (!date) return 'All';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear()).slice(-2);
  return `${d}/${m}/${y}`;
};

const fmtQuery = date => {
  if (!date) return undefined;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const currentFinancialYear = () => {
  const today = new Date();
  const year = today.getFullYear();
  const startYear = today.getMonth() + 1 >= 4 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

// ─── ONE unified fetch function ───────────────────────────────────────────────

const fetchStockData = async (financialYear, txType, itemName) => {
  const params = {};
  if (financialYear) params.financialYear = financialYear;
  if (txType) params.transactionType = txType;
  if (itemName) params.itemName = itemName;
  return api.get('/invoice/stock-report', { params });
};

// ─── component ────────────────────────────────────────────────────────────────

const StockReport = () => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [financialYear, setFinancialYear] = useState(currentFinancialYear());
  const [activeType, setActiveType] = useState(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [lastSavedPath, setLastSavedPath] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const fyRef = useRef(financialYear);
  const typeRef = useRef(activeType);
  const searchRef = useRef(productSearch);
  useEffect(() => {
    fyRef.current = financialYear;
  }, [financialYear]);
  useEffect(() => {
    typeRef.current = activeType;
  }, [activeType]);
  useEffect(() => {
    searchRef.current = productSearch;
  }, [productSearch]);

  const fyOptions = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const start = today.getMonth() + 1 >= 4 ? year : year - 1;
    const opts = [];
    for (let i = 0; i < 8; i++) {
      const sy = start - i;
      const ey = sy + 1;
      opts.push(`${sy}-${String(ey).slice(-2)}`);
    }
    return opts;
  }, []);

  const { authState } = useAuth();
  const route = useRoute();

  const dashboardFlag = route?.params?.dashboardFlag || false;
  const dashboardWeeklyFlag = route?.params?.dashboardWeeklyFlag || false;
  const dashboardMonthlyFlag = route?.params?.dashboardMonthlyFlag || false;
  const dashboardTodayFlag = route?.params?.dashboardTodayFlag || false;

  // ── core fetch ───────────────────────────────────────────────────────────────

  const runFetch = async (fy, txType, itemName) => {
    if (!fy) {
      Alert.alert('Missing Filter', 'Please select a financial year.');
      return;
    }
    try {
      setLoading(true);
      const res = await fetchStockData(fy, txType, itemName);

      console.log('Stock report API response:', res);
      // Support both flat array and { data: [...] } shapes
      const rows = Array.isArray(res?.data) ? res.data : res?.data?.data || [];
      setRecords(rows);
      setHasFetched(true);
    } catch (e) {
      console.error('Stock report fetch error:', e?.message);
      Alert.alert('Error', 'Failed to fetch stock report data.');
    } finally {
      setLoading(false);
    }
  };

  // ── dashboard auto-fetch ─────────────────────────────────────────────────────

  useEffect(() => {
    // Dashboard routes may request an immediate fetch — use the current financial year
    if (
      dashboardFlag ||
      dashboardWeeklyFlag ||
      dashboardMonthlyFlag ||
      dashboardTodayFlag
    ) {
      runFetch(financialYear, null);
    }
  }, [
    dashboardFlag,
    dashboardWeeklyFlag,
    dashboardMonthlyFlag,
    dashboardTodayFlag,
    financialYear,
  ]);

  // ── date quick-selects ───────────────────────────────────────────────────────

  const clearAll = () => {
    setFinancialYear(currentFinancialYear());
    setActiveType(null);
    setProductSearch('');
    setRecords([]);
    setHasFetched(false);
  };

  // ── type chip handler ────────────────────────────────────────────────────────

  const handleTypeSelect = type => {
    setActiveType(type);
    setRecords([]);
    setHasFetched(false);
    runFetch(fyRef.current, type, searchRef.current);
  };

  // ── Generate button ──────────────────────────────────────────────────────────

  const handleGenerate = () => {
    runFetch(fyRef.current, typeRef.current, searchRef.current);
  };

  // ── derived ──────────────────────────────────────────────────────────────────

  const formattedRange = `FY ${financialYear}`;
  const isAsOnDate = activeType && AS_ON_DATE_TYPES.has(activeType);
  const activeTypeMeta = TRANSACTION_TYPES.find(t => t.key === activeType);

  const totals = useMemo(
    () => ({
      count: records.length,
      // Use currentStockValue (new field)
      stockValue: records.reduce((s, r) => s + num(r.currentStockValue), 0),
      closingQty: records.reduce((s, r) => s + num(r.closingStock), 0),
      totalIn: records.reduce((s, r) => s + totalIn(r), 0),
      totalOut: records.reduce((s, r) => s + totalOut(r), 0),
    }),
    [records],
  );

  // ── permissions ──────────────────────────────────────────────────────────────

  const ensureAndroidDownloadPermission = async () => {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version < 29) {
      const g = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'Allow saving reports to Downloads',
          buttonPositive: 'OK',
        },
      );
      return g === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  // ── HTML for PDF ─────────────────────────────────────────────────────────────
  // Columns (last 3 updated):
  //   ... Transfer | Closing Stock | Avg Stock Value | Current Stock Value

  const buildHTML = () => {
    const txLabel = activeTypeMeta?.label || 'All';
    const bodyRows = records
      .map(
        (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${safe(r.itemDescription)}</td>
        <td align="right">${num(r.openingStock)}</td>
        <td align="right">${num(r.purchaseQty)}</td>
        <td align="right">${num(r.returnInQty)}</td>
        <td align="right">${num(r.saleQty)}</td>
        <td align="right">${num(r.returnOutQty)}</td>
        <td align="right">${num(r.damageQty)}</td>
        <td align="right">${num(r.adjustmentQty)}</td>
        <td align="right">${num(r.closingStock)}</td>
        <td align="right">${num(r.currentStockValue)}</td>
        <td align="right">${num(r.averageStockValue)}</td>
      </tr>`,
      )
      .join('');

    return `
      <html><head><meta charset="utf-8"/>
      <style>
        body { font-family: Roboto, Arial; margin:0; padding:16px; color:#111; font-size:11px; }
        h1   { font-size:18px; margin-bottom:2px; }
        .sub { color:#666; margin-bottom:14px; }
        .chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }
        .chip  { background:#f0f0f0; border:1px solid #ddd; border-radius:12px; padding:4px 10px; font-size:10px; }
        table  { border-collapse:collapse; width:100%; }
        th, td { border-bottom:1px solid #eee; padding:6px 5px; font-size:10px; }
        th     { background:#fafafa; font-weight:700; }
        .footer{ margin-top:14px; color:#888; font-size:9px; }
      </style></head><body>
        <h1>Stock Report</h1>
        <div class="sub">Period: ${formattedRange} · Type: ${txLabel}</div>
        <div class="chips">
          <div class="chip">Items: ${totals.count}</div>
          <div class="chip">Current Stock Value: ${totals.stockValue}</div>
          <div class="chip">Closing Stock: ${totals.closingQty}</div>
          <div class="chip">Total In: ${totals.totalIn}</div>
          <div class="chip">Total Out: ${totals.totalOut}</div>
        </div>
        <table>
          <thead><tr>
            <th>SL no</th><th>item</th>
            <th>Opening Stock</th><th>Purchase</th><th>Purchase Return</th>
            <th>Sale</th><th>Sales Return</th><th>Damage</th><th>Adjustment</th>
            <th>Closing</th><th>Current Stock </th><th>Average Stock Value</th>
          </tr></thead>
          <tbody>${
            bodyRows ||
            `<tr><td colspan="13" align="center">No records</td></tr>`
          }</tbody>
        </table>
        <div class="footer">Generated ${new Date().toLocaleString()}</div>
      </body></html>`;
  };

  // ── export PDF ───────────────────────────────────────────────────────────────

  const exportPDF = async () => {
    if (!records.length) {
      Alert.alert('No Data', 'Generate a report first.');
      return;
    }
    try {
      const ok1 = await ensureStoragePermission();
      const ok2 = await ensureAndroidDownloadPermission();
      if (!ok1 || !ok2) return;
      const pdfRes = await RNHTMLtoPDF.convert({
        html: buildHTML(),
        fileName: `Stock_Report_${Date.now()}`,
        base64: false,
        orientation: 'landscape',
      });
      const dir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const base = `Stock_Report_${new Date().toISOString().slice(0, 10)}`;
      let path = `${dir}/${base}.pdf`;
      if (await RNFS.exists(path)) path = `${dir}/${base}_${Date.now()}.pdf`;
      await RNFS.copyFile(pdfRes.filePath, path);
      try {
        await FileViewer.open(path, { showOpenWithDialog: true });
      } catch {
        Alert.alert('PDF Saved', 'Saved to Downloads. No PDF viewer found.');
      }
      setLastSavedPath(path);
      setDialogVisible(true);
    } catch (e) {
      console.error('PDF export error:', e?.message);
      Alert.alert('Export Failed', 'Could not generate PDF.');
    }
  };

  // ── export Excel ─────────────────────────────────────────────────────────────
  // Last 3 columns: Closing Stock | Avg Stock Value | Current Stock Value

  const exportExcel = async () => {
    if (!records.length) {
      Alert.alert('No Data', 'No records to export.');
      return;
    }
    const ok1 = await ensureStoragePermission();
    const ok2 = await ensureAndroidDownloadPermission();
    if (!ok1 || !ok2) return;
    try {
      const data = records.map((r, i) => ({
        'SL no': i + 1,
        item: safe(r.itemDescription),
        Opening: num(r.openingQty),
        Purchase: num(r.purchaseQty),
        'Ret. In': num(r.returnInQty),
        Sale: num(r.saleQty),
        'Ret. Out': num(r.returnOutQty),
        Damage: num(r.damageQty),
        'Closing Stock': num(r.closingStock),
        'Currant stck value': num(r.currentStockValue),
        'Avrage stock value': num(r.avgStockValue),
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = Object.keys(data[0]).map(k => ({
        wch: Math.max(12, k.length + 2),
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');
      const out = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const dir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const base = `Stock_Report_${new Date().toISOString().slice(0, 10)}`;
      let path = `${dir}/${base}.xlsx`;
      if (await RNFS.exists(path)) path = `${dir}/${base}_${Date.now()}.xlsx`;
      await RNFS.writeFile(path, out, 'base64');
      try {
        await FileViewer.open(path, { showOpenWithDialog: true });
      } catch {
        Alert.alert(
          'Excel Saved',
          'Saved to Downloads. No Excel viewer found.',
        );
      }
      setLastSavedPath(path);
      setDialogVisible(true);
    } catch (e) {
      console.error('Excel export error:', e?.message);
      Alert.alert('Export Failed', 'Could not generate Excel file.');
    }
  };

  // ── card renderer ─────────────────────────────────────────────────────────────

  const renderItem = ({ item: r, index }) => {
    const tIn = totalIn(r);
    const tOut = totalOut(r);
    return (
      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" style={{ flex: 1 }} numberOfLines={2}>
              {index + 1}. {safe(r.itemDescription)}
            </Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="labelSmall" style={styles.mutedText}>
                Current Stock Value
              </Text>
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.primary, fontWeight: '700' }}
              >
                {num(r.currentStockValue)}
              </Text>
            </View>
          </View>

          <View style={styles.tagRow}>
            <View
              style={[
                styles.tag,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Text style={[styles.tagText, { color: theme.colors.primary }]}>
                Closing Stock: {num(r.closingStock)}
              </Text>
            </View>
            <View
              style={[
                styles.tag,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Avg Stock Value: {num(r.avgStockValue)}
              </Text>
            </View>
            <View
              style={[
                styles.tag,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Opening: {num(r.openingQty)}
              </Text>
            </View>
          </View>

          <Divider style={{ marginVertical: 10 }} />

          <Text
            variant="labelSmall"
            style={[styles.mutedText, { marginBottom: 6 }]}
          >
            INWARD (+{tIn})
          </Text>
          <View style={styles.detailGrid}>
            <StatCol
              label="Purchase"
              value={num(r.purchaseQty)}
              color="#16a34a"
            />
            <StatCol
              label="Ret. In"
              value={num(r.returnInQty)}
              color="#16a34a"
            />
          </View>

          <Divider style={{ marginVertical: 10 }} />

          <Text
            variant="labelSmall"
            style={[styles.mutedText, { marginBottom: 6 }]}
          >
            OUTWARD (−{tOut})
          </Text>
          <View style={styles.detailGrid}>
            <StatCol
              label="Sale"
              value={num(r.saleQty)}
              color={theme.colors.error}
            />
            <StatCol
              label="Ret. Out"
              value={num(r.returnOutQty)}
              color={theme.colors.error}
            />
            <StatCol
              label="Damage"
              value={num(r.damageQty)}
              color={theme.colors.error}
            />
          </View>
        </Card.Content>
      </Card>
    );
  };

  // ── empty state ───────────────────────────────────────────────────────────────

  const emptyMessage = !financialYear
    ? 'Select a financial year and tap Generate.'
    : hasFetched
    ? `No stock records found for ${formattedRange}.`
    : 'Tap Generate to load the report.';

  // ─────────────────────────────────────────────────────────────────────────────

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
            />
            <IconButton
              icon="file-excel"
              iconColor="green"
              onPress={exportExcel}
              disabled={!records.length || loading}
            />
          </>
        }
      />

      {/* ── Controls ── */}
      <View style={[styles.header, compact && { paddingHorizontal: 12 }]}>
        {/* Financial year selector */}
        <View style={[styles.row, compact && { gap: 6 }]}>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setMenuVisible(true)}
                style={[styles.dateBtn, compact && { paddingHorizontal: 0 }]}
                icon="calendar"
              >
                {financialYear || 'Select FY'}
              </Button>
            }
          >
            {fyOptions.map(fy => (
              <Menu.Item
                key={fy}
                onPress={() => {
                  setFinancialYear(fy);
                  setMenuVisible(false);
                }}
                title={fy}
              />
            ))}
          </Menu>
          <IconButton
            icon="calendar-remove"
            mode="contained-tonal"
            size={20}
            onPress={clearAll}
            style={styles.iconBtn}
            disabled={loading || !financialYear}
          />
        </View>

        {/* Product Search Input */}
        <TextInput
          mode="outlined"
          label="Search Product Name"
          placeholder="e.g., Paracetamol, Pen, Medicine..."
          value={productSearch}
          onChangeText={setProductSearch}
          left={<TextInput.Icon icon="magnify" />}
          right={
            productSearch ? (
              <TextInput.Icon
                icon="close"
                onPress={() => setProductSearch('')}
              />
            ) : null
          }
          style={styles.searchInput}
        />

        {/* Transaction Type chips */}
        <View>
          <Text
            variant="labelSmall"
            style={[styles.mutedText, { marginBottom: 6 }]}
          >
            Filter by Type
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeChipsContainer}
          >
            {TRANSACTION_TYPES.map(({ key, label, icon }) => {
              const isActive = activeType === key;
              return (
                <TouchableOpacity
                  key={String(key)}
                  onPress={() => handleTypeSelect(key)}
                  disabled={loading}
                  activeOpacity={0.7}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: isActive
                        ? theme.colors.primary
                        : theme.colors.surfaceVariant,
                      borderColor: isActive
                        ? theme.colors.primary
                        : theme.colors.outline,
                      opacity: loading ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      {
                        color: isActive
                          ? theme.colors.onPrimary
                          : theme.colors.onSurfaceVariant,
                      },
                    ]}
                  >
                    {icon} {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {isAsOnDate && (
            <Text
              variant="labelSmall"
              style={[styles.mutedText, { marginTop: 4, fontStyle: 'italic' }]}
            >
              ℹ️ Using End Date as "As On Date" for this filter
            </Text>
          )}
        </View>

        {/* Generate */}
        <Button
          mode="contained"
          onPress={handleGenerate}
          disabled={!financialYear || loading}
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
      ) : records.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.mutedText}>{emptyMessage}</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryWrap}>
            <Card mode="elevated" style={styles.summaryCard}>
              <Card.Content style={styles.summaryContent}>
                <View style={styles.summaryTopRow}>
                  <Text variant="labelSmall" style={styles.mutedText}>
                    {formattedRange}
                  </Text>
                  {activeType && (
                    <View
                      style={[
                        styles.activeBadge,
                        { backgroundColor: theme.colors.primaryContainer },
                      ]}
                    >
                      <Text
                        style={[
                          styles.activeBadgeText,
                          { color: theme.colors.primary },
                        ]}
                      >
                        {activeTypeMeta?.icon} {activeTypeMeta?.label}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.summaryRow}>
                  <SummaryCol label="Items" value={String(totals.count)} />
                  <SummaryDivider />
                  <SummaryCol
                    label="Stock Value"
                    value={String(totals.stockValue)}
                  />
                  <SummaryDivider />
                  <SummaryCol
                    label="Closing Stock"
                    value={String(totals.closingQty)}
                  />
                  <SummaryDivider />
                  <SummaryCol
                    label="Total In"
                    value={String(totals.totalIn)}
                    green
                  />
                  <SummaryDivider />
                  <SummaryCol
                    label="Total Out"
                    value={String(totals.totalOut)}
                    red
                  />
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

      {/* Date picker removed — using financialYear filter */}

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

// ─── presentational helpers ───────────────────────────────────────────────────

const StatCol = ({ label, value, color }) => (
  <View style={styles.statCol}>
    <Text variant="labelSmall" style={styles.mutedText}>
      {label}
    </Text>
    <Text
      variant="labelLarge"
      style={[{ fontWeight: '700' }, color && { color }]}
    >
      {value}
    </Text>
  </View>
);

const SummaryCol = ({ label, value, green, red }) => {
  const theme = useTheme();
  const color = green ? '#16a34a' : red ? theme.colors.error : undefined;
  return (
    <View style={styles.summaryCol}>
      <Text variant="labelSmall" style={styles.mutedText}>
        {label}
      </Text>
      <Text
        variant="titleSmall"
        style={[{ fontWeight: '700' }, color && { color }]}
      >
        {value}
      </Text>
    </View>
  );
};

const SummaryDivider = () => {
  const theme = useTheme();
  return (
    <View
      style={[styles.vDivider, { backgroundColor: theme.colors.outline }]}
    />
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

  typeChipsContainer: { paddingVertical: 2, gap: 8, flexDirection: 'row' },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeChipText: { fontSize: 12, fontWeight: '600' },

  summaryWrap: { paddingHorizontal: 10, paddingVertical: 6 },
  summaryCard: { borderRadius: 12 },
  summaryContent: { paddingVertical: 8 },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
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
  activeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  activeBadgeText: { fontSize: 11, fontWeight: '700' },

  list: { padding: 12, paddingBottom: 32 },
  card: { marginBottom: 10, borderRadius: 14 },
  cardContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  tagText: { fontWeight: '600', fontSize: 11 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  statCol: { minWidth: '24%', flex: 1, marginBottom: 6 },
  searchInput: {
    marginBottom: 12,
    fontSize: 14,
  },
});

export default StockReport;
