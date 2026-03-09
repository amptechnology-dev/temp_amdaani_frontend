import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
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

const DATE_FILTERS = [
  { label: 'Today', value: 'today' },
  { label: 'Week', value: 'this_week' },
  { label: 'Month', value: 'this_month' },
];

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

  const [transactions, setTransactions] = useState([]);
  const [activeDateFilter, setActiveDateFilter] = useState('this_month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Calculate total stock value
  const totalStockValue = currentStock * costPrice;

  const bottomSheetRef = useRef(null);

  const getStartDateFromFilter = filter => {
    const now = new Date();

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

  useEffect(() => {
    // guard: don't call fetch at all unless permission present
    if (!hasPermission(permissions.CAN_MANAGE_STOCKS)) {
      console.log('Skipping initial fetch — no permission');
      setLoading(false); // optional: stop loading indicator
      return;
    }

    fetchTransactions();
  }, [fetchTransactions, hasPermission]);

  const fetchTransactions = useCallback(async () => {
    if (!hasPermission(permissions.CAN_MANAGE_STOCKS)) {
      console.log('fetchTransactions skipped — no permission');
      return;
    }
    try {
      setLoading(true);
      const params = {};
      const startDate = getStartDateFromFilter(activeDateFilter);

      if (startDate) {
        params.startDate = startDate.toISOString().split('T')[0];
      }

      const res = await api.get(`/product/stock-transaction/${id}`, { params });

      if (res?.success) {
        setTransactions(res?.data?.docs || []);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error('Fetch Error:', error?.message);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [id, activeDateFilter]);

  const onRefresh = async () => {
    if (!hasPermission(permissions.CAN_MANAGE_STOCKS)) {
      Toast.show({
        type: 'error',
        text1: 'Permission denied',
        text2: 'You do not have permission to refresh transactions.',
      });
      return;
    }

    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const getTransactionTypeConfig = (type, direction) => {
    const configs = {
      PURCHASE: {
        icon: 'arrow-down-bold',
        color: '#10b981',
        label: 'Purchase',
      },
      SALE: {
        icon: 'arrow-up-bold',
        color: '#ef4444',
        label: 'Sale',
      },
      ADJUSTMENT: {
        icon: 'adjust',
        color: '#8b5cf6',
        label: 'Adjustment',
      },
    };

    const baseConfig = configs[type] || {
      icon: 'help-circle',
      color: theme.colors.outline,
      label: type,
    };

    if (type === 'ADJUSTMENT') {
      return {
        ...baseConfig,
        color: direction === 'OUT' ? '#ef4444' : '#10b981',
        label: direction === 'OUT' ? 'Stock Out' : 'Stock In',
      };
    }

    return baseConfig;
  };

  // Format amount function
  const formatAmount = amount => {
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  };

  // Compact Overview Card
  const renderOverviewCard = () => {
    return (
      <Card
        style={[
          styles.compactOverviewCard,
          { backgroundColor: theme.colors.surface },
        ]}
        mode="contained"
      >
        <Card.Content style={styles.compactContent}>
          <View style={styles.compactRow}>
            {/* Product Info */}
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

            {/* Calculation Formula */}
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
                  {formatAmount(totalStockValue)}
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
  };

  const renderItem = ({ item }) => {
    const typeConfig = getTransactionTypeConfig(
      item.transactionType,
      item.direction,
    );

    const isInbound = item.direction === 'IN';

    return (
      <Card style={styles.card} mode="elevated">
        <Card.Content style={styles.cardContent}>
          {/* Compact Header */}
          <View style={styles.header}>
            <View style={styles.typeSection}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: `${typeConfig.color}15` },
                ]}
              >
                <Icon
                  source={typeConfig.icon}
                  size={16}
                  color={typeConfig.color}
                />
              </View>
              <View>
                <Text
                  variant="labelLarge"
                  style={{ fontWeight: '600', fontSize: 14 }}
                >
                  {typeConfig.label}
                </Text>
                <View style={styles.dateRow}>
                  <Icon
                    source="calendar"
                    size={12}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text variant="labelSmall" style={styles.dateText}>
                    {format(new Date(item.date), 'dd MMM yy hh:mm a')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.amountSection}>
              <Text
                variant="titleMedium"
                style={[
                  styles.quantityText,
                  { color: isInbound ? '#10b981' : '#ef4444' },
                ]}
              >
                {isInbound ? '+' : '-'}
                {item.quantity}
              </Text>
              <Text variant="labelMedium" style={styles.totalAmount}>
                ₹{item.totalAmount}
              </Text>
            </View>
          </View>

          {/* Compact Details */}
          <View style={styles.details}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Icon
                  source="currency-inr"
                  size={14}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text variant="labelSmall" style={styles.detailLabel}>
                  Rate: ₹{item.rate}
                </Text>
              </View>

              {/* <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isInbound ? '#dcfce7' : '#fef2f2',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: isInbound ? '#166534' : '#991b1b' },
                  ]}
                >
                  {item.direction}
                </Text>
              </View> */}
            </View>

            {/* Remarks - only show if exists */}
            {item.remarks ? (
              <View style={styles.remarks}>
                <Text
                  variant="labelSmall"
                  style={styles.remarksLabel}
                  numberOfLines={2}
                >
                  {item.remarks}
                </Text>
              </View>
            ) : null}
          </View>
        </Card.Content>
      </Card>
    );
  };

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
          No Transactions
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.emptySubtitle, { color: theme.colors.outline }]}
        >
          {activeDateFilter !== 'all'
            ? `No transactions found for ${
                DATE_FILTERS.find(f => f.value === activeDateFilter)?.label
              }`
            : 'No stock transactions found'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar title="Stock Transactions" />

      {/* Compact Overview Card */}
      {renderOverviewCard()}

      {/* Compact Date Filters */}
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

      {/* Transactions List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            animating
            color={theme.colors.primary}
          />
          <Text variant="bodyMedium" style={{ marginTop: 10 }}>
            Loading transactions...
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={
            transactions.length === 0 ? styles.emptyListContainer : styles.list
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
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
  container: {
    flex: 1,
  },
  // Compact Overview Card Styles
  compactOverviewCard: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    elevation: 1,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    // backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  compactContent: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
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
  compactMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactMetricItem: {
    alignItems: 'center',
    marginLeft: 8,
    minWidth: 70,
  },
  compactCalculation: {
    alignItems: 'center',
    marginLeft: 8,
    minWidth: 80,
  },
  currentStock: {
    fontWeight: '700',
    fontSize: 14,
    color: '#FFCE1B',
  },
  compactUnitCost: {
    fontWeight: '600',
    fontSize: 12,
    color: '#9ca3af',
  },
  compactStockValue: {
    fontWeight: '700',
    fontSize: 14,
    color: '#059669',
  },
  compactLabel: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 1,
  },
  calculationFormula: {
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 11,
  },
  operator: {
    fontSize: 10,
    color: '#9ca3af',
    marginHorizontal: 4,
  },
  // Existing Styles - NO CHANGES
  filtersContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  filters: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterChip: {
    marginRight: 8,
    height: 32,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 80,
  },
  emptyListContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  card: {
    marginVertical: 2,
    borderRadius: 12,
    elevation: 1,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  typeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dateText: {
    marginLeft: 4,
    fontSize: 11,
    color: '#6b7280',
  },
  amountSection: {
    alignItems: 'flex-end',
  },
  quantityText: {
    fontWeight: '700',
    fontSize: 16,
  },
  totalAmount: {
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 2,
    fontSize: 14,
  },
  details: {
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    marginLeft: 6,
    color: '#6b7280',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  remarks: {
    marginTop: 4,
  },
  remarksLabel: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 16,
  },
  separator: {
    height: 8,
  },
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
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
});

export default StockTransactionScreen;
