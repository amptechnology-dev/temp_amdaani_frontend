import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Text,
  Card,
  ActivityIndicator,
  useTheme,
  Divider,
  FAB,
  Chip,
  Icon,
} from 'react-native-paper';
import {
  format,
  startOfToday,
  startOfWeek,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { useRoute, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import api from '../../utils/api';
import { useAuth, permissions } from '../../context/AuthContext';
import AdjustStockBottomSheet from '../../components/BottomSheet/AdjustStocksBottmSheet';
import Navbar from '../../components/Navbar';
import NoPermission from '../../components/NoPermission';
import SelectStockReasonBottomSheet from '../../components/BottomSheet/SelectStockReasonBottomSheet';

/*
  API response shape  →  /product/stock-transaction/:id
  {
    data: {
      data: [{
        openingStock, purchaseQty, saleQty,
        returnInQty,     ← Purchase Return
        returnOutQty,    ← Sales Return
        damageQty, expiredQty, adjustmentQty,
        closingStock, avgRate, itemDescription, currentStockValue
      }]
    }
  }
*/

const DATE_FILTERS = [
  { label: 'Today', value: 'today' },
  { label: 'Week', value: 'this_week' },
  { label: 'Month', value: 'this_month' },
];

// ─── small stat tile ──────────────────────────────────────────────────────────
const StatTile = ({ label, value, valueColor, icon, theme, highlight }) => (
  <View
    style={[
      statStyles.tile,
      highlight && {
        backgroundColor: theme.colors.primaryContainer,
        borderColor: theme.colors.primary,
        borderWidth: 1,
      },
      !highlight && { backgroundColor: theme.colors.surfaceVariant },
    ]}
  >
    {icon && (
      <Icon
        source={icon}
        size={14}
        color={valueColor || theme.colors.onSurfaceVariant}
      />
    )}
    <Text
      variant="labelSmall"
      style={[statStyles.label, { color: theme.colors.onSurfaceVariant }]}
      numberOfLines={1}
    >
      {label}
    </Text>
    <Text
      variant="titleSmall"
      style={[
        statStyles.value,
        valueColor ? { color: valueColor } : { color: theme.colors.onSurface },
      ]}
      numberOfLines={1}
    >
      {value}
    </Text>
  </View>
);

const statStyles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: '28%',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    margin: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 4,
    textAlign: 'center',
  },
  value: { fontWeight: '700', fontSize: 13, marginTop: 2, textAlign: 'center' },
});

// ─── component ────────────────────────────────────────────────────────────────

const StockTransactionScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const { isStockEnabled } = useAuth();
  const route = useRoute();
  const { id, costPrice, name, currentStock } = route.params;
  const bottom = useSafeAreaInsets().bottom;
  const { hasPermission } = useAuth();

  if (!hasPermission(permissions.CAN_MANAGE_STOCKS)) {
    return <NoPermission />;
  }

  const adjustSheetRef = useRef(null);
  const reasonSheetRef = useRef(null);
  const [selectedReason, setSelectedReason] = useState(null);
  const [actionType, setActionType] = useState('add');

  useEffect(() => {
    if (!isStockEnabled) {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Stock management is disabled',
      });
      navigation.goBack();
    }
  }, [isStockEnabled, navigation]);

  // summary row from API (single object, not a list)
  const [stockSummary, setStockSummary] = useState(null);
  const [activeDateFilter, setActiveDateFilter] = useState('this_month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const totalStockValue = currentStock * costPrice;

  const getStartDateFromFilter = filter => {
    switch (filter) {
      case 'today':
        return startOfToday();
      case 'this_week':
        return startOfWeek(new Date());
      case 'this_month':
        return startOfMonth(new Date());
      case 'last_month':
        return startOfMonth(subMonths(new Date(), 1));
      default:
        return subMonths(new Date(), 1);
    }
  };

  const fetchTransactions = useCallback(async () => {
    if (!hasPermission(permissions.CAN_MANAGE_STOCKS)) return;
    try {
      setLoading(true);
      const startDate = getStartDateFromFilter(activeDateFilter);
      const params = startDate
        ? { startDate: startDate.toISOString().split('T')[0] }
        : {};
      const res = await api.get(`/product/stock-transaction/${id}`, { params });
      if (res?.success) {
        // API returns data.data as array; take first element as summary
        const rows = res?.data?.data;
        setStockSummary(
          Array.isArray(rows) && rows.length > 0 ? rows[0] : null,
        );
      } else {
        setStockSummary(null);
      }
    } catch (error) {
      console.error('Fetch Error:', error?.message);
      setStockSummary(null);
    } finally {
      setLoading(false);
    }
  }, [id, activeDateFilter, hasPermission]);

  useEffect(() => {
    if (!hasPermission(permissions.CAN_MANAGE_STOCKS)) {
      setLoading(false);
      return;
    }
    fetchTransactions();
  }, [fetchTransactions, hasPermission]);

  const onRefresh = async () => {
    if (!hasPermission(permissions.CAN_MANAGE_STOCKS)) {
      Toast.show({ type: 'error', text1: 'Permission denied' });
      return;
    }
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  // ── Overview card ───────────────────────────────────────────────────────────
  const renderOverviewCard = () => (
    <Card
      style={[
        styles.compactOverviewCard,
        { backgroundColor: theme.colors.surface },
      ]}
      mode="contained"
    >
      <Card.Content style={styles.compactContent}>
        <View style={styles.compactRow}>
          <View style={styles.compactProductSection}>
            <Icon
              source="package-variant"
              size={18}
              color={theme.colors.primary}
            />
            <Text
              variant="titleMedium"
              style={styles.compactProductName}
              numberOfLines={1}
            >
              {name}
            </Text>
          </View>
          <View style={styles.compactCalculation}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="titleMedium" style={styles.currentStock}>
                {currentStock}
              </Text>
              <Text style={styles.operator}>×</Text>
              <Text variant="titleMedium" style={styles.compactUnitCost}>
                ₹{costPrice.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.operator}>=</Text>
              <Text variant="headlineSmall" style={styles.compactStockValue}>
                ₹{totalStockValue.toLocaleString('en-IN')}
              </Text>
            </View>
            <Text style={styles.calculationFormula}>
              Stock × Unit Cost = Stock Value
            </Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  // ── Summary grid ────────────────────────────────────────────────────────────
  const renderSummaryGrid = () => {
    if (!stockSummary) return null;
    const s = stockSummary;

    /*
      Field mapping:
        returnInQty   → Purchase Return  (stock comes IN from vendor return)
        returnOutQty  → Sales Return     (stock goes OUT back to customer — actually
                                          sales return means stock comes back IN;
                                          use the label the user requested)
        adjustmentQty → Adjustment
    */
    const rows = [
      // Row 1 — opening / closing / value
      [
        {
          label: 'Opening Stock',
          value: s.openingStock ?? 0,
          icon: 'package-variant-closed',
          highlight: false,
        },
        {
          label: 'Closing Stock',
          value: s.closingStock ?? 0,
          icon: 'package-variant',
          highlight: true,
          color: theme.colors.primary,
        },
        {
          label: 'Stock Value',
          value: `₹${(s.currentStockValue ?? 0).toLocaleString('en-IN')}`,
          icon: 'currency-inr',
          color: '#059669',
        },
      ],
      // Row 2 — inbound flows
      [
        {
          label: 'Purchase',
          value: s.purchaseQty ?? 0,
          icon: 'arrow-down-bold',
          color: '#10b981',
        },
        {
          label: 'Purchase Return',
          value: s.returnInQty ?? 0,
          icon: 'arrow-u-left-top',
          color: '#10b981',
        },
        {
          label: 'Sales Return',
          value: s.returnOutQty ?? 0,
          icon: 'arrow-u-right-top',
          color: '#f59e0b',
        },
      ],
      // Row 3 — outbound / misc
      [
        {
          label: 'Sales',
          value: s.saleQty ?? 0,
          icon: 'arrow-up-bold',
          color: '#ef4444',
        },
        {
          label: 'Damage',
          value: s.damageQty ?? 0,
          icon: 'alert-circle-outline',
          color: '#ef4444',
        },
        {
          label: 'Expired',
          value: s.expiredQty ?? 0,
          icon: 'clock-alert-outline',
          color: '#ef4444',
        },
      ],
      // Row 4 — adjustment + avg rate + description
      [
        {
          label: 'Adjustment',
          value: s.adjustmentQty ?? 0,
          icon: 'tune',
          color: '#8b5cf6',
        },
        {
          label: 'Avg Rate',
          value: `₹${(s.avgRate ?? 0).toLocaleString('en-IN')}`,
          icon: 'calculator-variant-outline',
          color: '#6366f1',
        },
        {
          label: 'Description',
          value: s.itemDescription ?? '—',
          icon: 'information-outline',
        },
      ],
    ];

    return (
      <Card mode="outlined" style={styles.summaryCard}>
        <Card.Content style={styles.summaryCardContent}>
          <Text
            variant="labelMedium"
            style={[
              styles.sectionLabel,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            STOCK SUMMARY
          </Text>
          {rows.map((row, ri) => (
            <View key={ri} style={styles.tileRow}>
              {row.map((tile, ti) => (
                <StatTile
                  key={ti}
                  label={tile.label}
                  value={String(tile.value)}
                  valueColor={tile.color}
                  icon={tile.icon}
                  theme={theme}
                  highlight={tile.highlight}
                />
              ))}
            </View>
          ))}
        </Card.Content>
      </Card>
    );
  };

  // ── Empty state ─────────────────────────────────────────────────────────────
  const renderEmptyState = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Icon
          source="package-variant-closed"
          size={48}
          color={theme.colors.outline}
        />
        <Text variant="titleMedium" style={styles.emptyTitle}>
          No Data
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.emptySubtitle, { color: theme.colors.outline }]}
        >
          No stock summary found for this period
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar title="Stock Transactions" />

      {renderOverviewCard()}

      {/* Date Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={DATE_FILTERS}
          keyExtractor={item => item.value}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          renderItem={({ item: filter }) => (
            <Chip
              mode={activeDateFilter === filter.value ? 'flat' : 'outlined'}
              selected={activeDateFilter === filter.value}
              style={styles.filterChip}
              textStyle={styles.filterChipText}
              onPress={() => setActiveDateFilter(filter.value)}
            >
              {filter.label}
            </Chip>
          )}
        />
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            animating
            color={theme.colors.primary}
          />
          <Text variant="bodyMedium" style={{ marginTop: 10 }}>
            Loading...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottom + 100 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {stockSummary ? renderSummaryGrid() : renderEmptyState()}
        </ScrollView>
      )}

      {/* FAB */}
      <FAB
        icon="database-plus"
        style={[
          styles.fab,
          { backgroundColor: theme.colors.primary, marginBottom: bottom + 20 },
        ]}
        color="white"
        onPress={() => adjustSheetRef.current?.present()}
        size="medium"
      />

      <AdjustStockBottomSheet
        ref={adjustSheetRef}
        productId={id}
        costPrice={costPrice}
        selectedReason={selectedReason}
        onActionTypeChange={setActionType}
        onOpenReason={() => {
          adjustSheetRef.current?.close();
          setTimeout(() => {
            reasonSheetRef.current?.present();
          }, 250);
        }}
        onStockAdjusted={fetchTransactions}
      />
      <SelectStockReasonBottomSheet
        ref={reasonSheetRef}
        actionType={actionType}
        selectedReason={selectedReason}
        onSelect={item => {
          setSelectedReason(item);
          reasonSheetRef.current?.close();
          setTimeout(() => {
            adjustSheetRef.current?.present();
          }, 250);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Overview card
  compactOverviewCard: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    elevation: 1,
  },
  compactContent: { paddingVertical: 10, paddingHorizontal: 14 },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactProductSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  compactProductName: {
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },
  compactCalculation: { alignItems: 'center', marginLeft: 8, minWidth: 80 },
  currentStock: { fontWeight: '700', fontSize: 14, color: '#FFCE1B' },
  compactUnitCost: { fontWeight: '600', fontSize: 12, color: '#9ca3af' },
  compactStockValue: { fontWeight: '700', fontSize: 14, color: '#059669' },
  calculationFormula: {
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 2,
  },
  operator: { fontSize: 10, color: '#9ca3af', marginHorizontal: 4 },

  // Filters
  filtersContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  filters: { paddingHorizontal: 16, paddingVertical: 12 },
  filterChip: { marginRight: 8, height: 32 },
  filterChipText: { fontSize: 13, fontWeight: '500' },

  // Summary card
  scrollContent: { padding: 12 },
  summaryCard: { borderRadius: 14, marginBottom: 12 },
  summaryCardContent: { paddingHorizontal: 12, paddingVertical: 14 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  tileRow: { flexDirection: 'row', marginBottom: 4 },

  // States
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  emptyTitle: {
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: { textAlign: 'center', lineHeight: 20, fontSize: 14 },

  // FAB
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
});

export default StockTransactionScreen;
