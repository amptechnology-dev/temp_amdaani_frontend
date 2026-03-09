import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Text,
  Card,
  Icon,
  IconButton,
  useTheme,
  Chip,
  Searchbar,
  FAB,
} from 'react-native-paper';
import {
  format,
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
} from 'date-fns';
import api from '../../utils/api';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Navbar from '../../components/Navbar';
import debounce from 'lodash/debounce';
import Fuse from 'fuse.js';
import AddExpenseBottomSheet from '../../components/BottomSheet/AddExpenseBottomSheet';
import AddExpenseHeadBottomSheet from '../../components/BottomSheet/AddExpenseHeadBottomSheet';

const sortByDateDesc = (expenses = []) => {
  return [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
};

const appendUniqueById = (prev, next) => {
  const seen = new Set(prev.map(i => i._id));
  const filtered = next.filter(i => !seen.has(i._id));
  return [...prev, ...filtered];
};

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'thisWeek' },
  { label: 'This Month', value: 'thisMonth' },
];

const PAYMENT_METHOD_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Cash', value: 'cash' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Card', value: 'card' },
  { label: 'Bank Transfer', value: 'bank transfer' },
];

// Date filtering function
const filterExpensesByDate = (expenses, filter) => {
  if (filter === 'all') return expenses;

  return expenses.filter(expense => {
    const expenseDate = new Date(expense.date);

    switch (filter) {
      case 'today':
        return isToday(expenseDate);
      case 'yesterday':
        return isYesterday(expenseDate);
      case 'thisWeek':
        return isThisWeek(expenseDate);
      case 'thisMonth':
        return isThisMonth(expenseDate);
      default:
        return true;
    }
  });
};

// Payment method filtering function
const filterExpensesByPaymentMethod = (expenses, paymentMethodFilter) => {
  if (paymentMethodFilter === 'all') return expenses;

  return expenses.filter(expense => {
    return (
      expense.paymentMethod?.toLowerCase() === paymentMethodFilter.toLowerCase()
    );
  });
};

// Search filtering function
const filterExpensesBySearch = (expenses, searchQuery) => {
  if (!searchQuery.trim()) return expenses;

  const query = searchQuery.toLowerCase().trim();
  return expenses.filter(expense => {
    const headName = (expense.head?.[0]?.name || '').toLowerCase();
    const paidTo = (expense.paidTo || '').toLowerCase();
    const notes = (expense.notes || '').toLowerCase();
    const invoiceRef = (expense.invoiceRef || '').toLowerCase();

    return (
      headName.includes(query) ||
      paidTo.includes(query) ||
      notes.includes(query) ||
      invoiceRef.includes(query)
    );
  });
};

const Expenses = ({ isNavbar = true }) => {
  const theme = useTheme();
  const navigation = useNavigation();
  const bottom = useSafeAreaInsets().bottom;

  const [allExpenses, setAllExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activePaymentMethodFilter, setActivePaymentMethodFilter] =
    useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  const pageRef = useRef(1);
  const isFetchingRef = useRef(false);
  const addExpenseBottomSheetRef = useRef(null);
  const AddExpenseHeadSheetRef = useRef(null);

  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    addExpenseBottomSheetRef.current?.expand();
  };

  // Calculate overview statistics
  const calculateOverview = useCallback(() => {
    const totalExpenses = filteredExpenses.length;
    const totalAmount = filteredExpenses.reduce(
      (sum, expense) => sum + (expense.amount || 0),
      0,
    );
    const averageExpense = totalExpenses > 0 ? totalAmount / totalExpenses : 0;

    // Calculate payment method breakdown
    const paymentMethodBreakdown = filteredExpenses.reduce((acc, expense) => {
      const method = expense.paymentMethod?.toLowerCase() || 'other';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {});

    // Find most used payment method
    const mostUsedPaymentMethod = Object.keys(paymentMethodBreakdown).reduce(
      (a, b) => (paymentMethodBreakdown[a] > paymentMethodBreakdown[b] ? a : b),
      'N/A',
    );

    return {
      totalExpenses,
      totalAmount,
      averageExpense,
      mostUsedPaymentMethod:
        mostUsedPaymentMethod !== 'N/A' ? mostUsedPaymentMethod : 'N/A',
    };
  }, [filteredExpenses]);

  const overview = calculateOverview();

  // Fuse options for better search
  const fuseOptions = {
    includeScore: true,
    includeMatches: true,
    threshold: 0.4,
    minMatchCharLength: 1,
    keys: [
      { name: 'head.0.name', weight: 0.5 },
      { name: 'paidTo', weight: 0.4 },
      { name: 'notes', weight: 0.3 },
      { name: 'invoiceRef', weight: 0.3 },
      { name: 'paymentMethod', weight: 0.2 },
    ],
  };

  const fetchExpenses = useCallback(
    async (pageToLoad = 1, { reset = false } = {}) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const res = await api.get('/expense');
        // console.log('Expenses fetched:', res);

        if (res?.success && res.data?.docs) {
          const newExpenses = reset
            ? sortByDateDesc(res.data.docs)
            : sortByDateDesc(appendUniqueById(allExpenses, res.data.docs));

          setAllExpenses(newExpenses);

          setHasNextPage(Boolean(res.data?.hasNextPage));
          pageRef.current = Number(res.data?.page) || pageToLoad;
        }
      } catch (e) {
        setError(e?.message || 'Failed to load expenses');
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [allExpenses],
  );

  // Helper to build highlighted parts for matched text
  const renderHighlightedText = (text, key, matches = []) => {
    if (!text) return null;
    const matchObj = (matches || []).find(m => m.key === key);
    if (
      !matchObj ||
      !Array.isArray(matchObj.indices) ||
      matchObj.indices.length === 0
    ) {
      return text;
    }

    const parts = [];
    let lastIndex = 0;
    matchObj.indices.forEach((range, idx) => {
      const [start, end] = range;
      if (lastIndex < start) {
        parts.push(text.slice(lastIndex, start));
      }
      const matchedText = text.slice(start, end + 1);
      parts.push(
        <Text key={`${key}-hl-${idx}`} style={{ color: theme.colors.primary }}>
          {matchedText}
        </Text>,
      );
      lastIndex = end + 1;
    });
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts;
  };

  // Debounced filter application
  const applyFilters = useCallback(() => {
    const dateFiltered = filterExpensesByDate(allExpenses, activeFilter) || [];
    const paymentMethodFiltered =
      filterExpensesByPaymentMethod(dateFiltered, activePaymentMethodFilter) ||
      [];

    const rawQuery = (searchQuery || '').trim();
    if (!rawQuery) {
      const plain = paymentMethodFiltered.map(item => ({
        ...item,
        _matches: [],
      }));
      setFilteredExpenses(plain);
      return;
    }

    // Use Fuse fuzzy search
    const fuse = new Fuse(paymentMethodFiltered, fuseOptions);
    const results = fuse.search(rawQuery);
    const mapped = results.map(r => ({ ...r.item, _matches: r.matches || [] }));
    setFilteredExpenses(sortByDateDesc(mapped));
  }, [allExpenses, activeFilter, activePaymentMethodFilter, searchQuery]);

  useEffect(() => {
    const handler = debounce(applyFilters, 250);
    handler();
    return () => handler.cancel();
  }, [applyFilters]);

  useFocusEffect(
    useCallback(() => {
      pageRef.current = 1;
      fetchExpenses(1, { reset: true });
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    pageRef.current = 1;
    fetchExpenses(1, { reset: true });
  };

  const onEndReached = () => {
    if (!hasNextPage || isFetchingRef.current) return;
    fetchExpenses(pageRef.current + 1, { reset: false });
  };

  const deleteExpense = async id => {
    try {
      const response = await api.delete(`/expense/id/${id}`);
      if (response.success) {
        setAllExpenses(prev => prev.filter(exp => exp._id !== id));
        // console.log('Expense deleted successfully');
      } else {
        // console.log('Failed to delete expense');
      }
    } catch (err) {
      console.error('Error deleting expense:', err);
    }
  };

  const handleDeletePress = expense => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete this ${expense.head?.[0]?.name} expense?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteExpense(expense._id),
        },
      ],
    );
  };

  const handleEditPress = expense => {
    setEditingExpense(expense);
    addExpenseBottomSheetRef.current?.expand();
  };

  const formatCurrency = amount => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPaymentMethodIcon = method => {
    switch (method?.toLowerCase()) {
      case 'cash':
        return 'cash';
      case 'upi':
        return 'cellphone';
      case 'card':
        return 'credit-card';
      case 'bank transfer':
        return 'bank';
      default:
        return 'wallet';
    }
  };

  // Render Overview Card
  const renderOverviewCard = () => {
    if (filteredExpenses.length === 0) return null;

    return (
      <Card style={styles.overviewCard} mode="contained">
        <Card.Content>
          <View style={styles.overviewHeader}>
            <Icon source="chart-box" size={20} color={theme.colors.primary} />
            <Text variant="titleSmall" style={styles.overviewTitle}>
              Overview
            </Text>
          </View>

          <View style={styles.overviewStats}>
            <View style={styles.overviewStat}>
              <Text variant="bodySmall" style={styles.overviewLabel}>
                Total Expenses :
              </Text>
              <Text variant="titleMedium" style={styles.overviewValue}>
                {overview.totalExpenses}
              </Text>
            </View>

            <View style={styles.overviewStat}>
              <Text variant="bodySmall" style={styles.overviewLabel}>
                Total Amount :
              </Text>
              <Text
                variant="titleMedium"
                style={[styles.overviewValue, { color: theme.colors.error }]}
              >
                {formatCurrency(overview.totalAmount)}
              </Text>
            </View>

            {/* <View style={styles.overviewStat}>
              <Text variant="bodySmall" style={styles.overviewLabel}>
                Average
              </Text>
              <Text variant="titleMedium" style={styles.overviewValue}>
                {formatCurrency(overview.averageExpense)}
              </Text>
            </View>

            <View style={styles.overviewStat}>
              <Text variant="bodySmall" style={styles.overviewLabel}>
                Most Used Method
              </Text>
              <View style={styles.paymentMethodRow}>
                <Icon
                  source={getPaymentMethodIcon(overview.mostUsedPaymentMethod)}
                  size={14}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text variant="titleMedium" style={styles.overviewValue}>
                  {overview.mostUsedPaymentMethod.charAt(0).toUpperCase() +
                    overview.mostUsedPaymentMethod.slice(1)}
                </Text>
              </View>
            </View> */}
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderExpenseCard = ({ item: expense }) => {
    const headName = expense.head?.[0]?.name || 'Uncategorized';
    const enteredByName = expense.enteredBy?.[0]?.name || 'Unknown';

    return (
      <Card
        style={styles.card}
        contentStyle={{
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
        mode="outlined"
      >
        {/* Main Content Row */}
        <View style={styles.mainRow}>
          {/* Left Section - Expense Details */}
          <View style={styles.detailsSection}>
            <View style={styles.headerRow}>
              <Icon
                source="file-document-outline"
                size={14}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="titleMedium"
                style={styles.headName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {renderHighlightedText(
                  headName,
                  'head.0.name',
                  expense._matches,
                )}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Icon
                  source="account-outline"
                  size={12}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="labelSmall"
                  style={styles.metaText}
                  numberOfLines={1}
                >
                  {renderHighlightedText(
                    expense.paidTo,
                    'paidTo',
                    expense._matches,
                  )}
                </Text>
              </View>

              <View style={styles.metaItem}>
                <Icon
                  source={getPaymentMethodIcon(expense.paymentMethod)}
                  size={12}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text variant="labelSmall" style={styles.metaText}>
                  {expense.paymentMethod}
                </Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Icon
                  source="calendar"
                  size={12}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text variant="labelSmall" style={styles.metaText}>
                  {format(new Date(expense.date), 'dd MMM')}
                </Text>
              </View>

              <View style={styles.metaItem}>
                <Icon
                  source="account-edit"
                  size={12}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="labelSmall"
                  style={styles.metaText}
                  numberOfLines={1}
                >
                  {enteredByName}
                </Text>
              </View>
            </View>

            {/* Notes and Invoice Reference */}
            {(expense.notes || expense.invoiceRef) && (
              <View style={styles.notesRow}>
                {expense.notes && (
                  <View style={styles.metaItem}>
                    <Icon
                      source="note-outline"
                      size={12}
                      color={theme.colors.onSurfaceVariant}
                    />
                    <Text
                      variant="labelSmall"
                      style={[styles.metaText, styles.notesText]}
                      numberOfLines={1}
                    >
                      {renderHighlightedText(
                        expense.notes,
                        'notes',
                        expense._matches,
                      )}
                    </Text>
                  </View>
                )}
                {expense.invoiceRef && (
                  <View style={styles.metaItem}>
                    <Icon
                      source="file-document"
                      size={12}
                      color={theme.colors.onSurfaceVariant}
                    />
                    <Text
                      variant="labelSmall"
                      style={styles.metaText}
                      numberOfLines={1}
                    >
                      Ref:{' '}
                      {renderHighlightedText(
                        expense.invoiceRef,
                        'invoiceRef',
                        expense._matches,
                      )}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Right Section - Amount and Actions */}
          <View style={styles.actionsSection}>
            <Text
              variant="titleLarge"
              style={[styles.amount, { color: theme.colors.error }]}
            >
              {formatCurrency(expense.amount)}
            </Text>

            <View style={styles.actionButtons}>
              <IconButton
                icon="pencil"
                size={16}
                mode="contained"
                containerColor={theme.colors.primaryContainer}
                iconColor={theme.colors.primary}
                onPress={() => handleEditPress(expense)}
                style={styles.actionButton}
              />
              <IconButton
                icon="delete"
                size={16}
                mode="contained"
                containerColor={theme.colors.errorContainer}
                iconColor={theme.colors.error}
                onPress={() => handleDeletePress(expense)}
                style={styles.actionButton}
              />
            </View>
          </View>
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => {
    if (loading || refreshing) return null;

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Icon source="cash-remove" size={64} color={theme.colors.outline} />
        </View>
        <Text variant="headlineSmall" style={styles.emptyTitle}>
          No Expenses Found
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.emptySubtitle, { color: theme.colors.outline }]}
        >
          {searchQuery.trim()
            ? `No expenses found for "${searchQuery}"`
            : (activeFilter === 'today' && 'No expenses made today') ||
            (activeFilter === 'yesterday' && 'No expenses made yesterday') ||
            (activeFilter === 'thisWeek' && 'No expenses made this week') ||
            (activeFilter === 'thisMonth' && 'No expenses made this month') ||
            'Get started by adding your first expense'}
        </Text>
      </View>
    );
  };

  const handleExpenseCreated = () => {
    fetchExpenses(1, { reset: true });
  };

  return (
    <>
      {isNavbar && (
        <SafeAreaView
          edges={['top']}
          style={{ backgroundColor: theme.colors.background }}
        />
      )}
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {isNavbar && <Navbar title="Expenses" />}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search expenses..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
            inputStyle={{ fontSize: 14 }}
            iconColor={theme.colors.onSurfaceVariant}
          />
        </View>

        {/* Filters Container */}
        <View style={styles.filtersContainer}>
          {/* Date Filters */}
          <FlatList
            data={FILTERS}
            keyExtractor={item => item.value}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
            renderItem={({ item: f }) => (
              <Chip
                mode={activeFilter === f.value ? 'flat' : 'outlined'}
                selected={activeFilter === f.value}
                style={styles.filterChip}
                textStyle={styles.filterChipText}
                onPress={() => setActiveFilter(f.value)}
              >
                {f.label}
              </Chip>
            )}
          />

          {/* Payment Method Filters */}
          <FlatList
            data={PAYMENT_METHOD_FILTERS}
            keyExtractor={item => item.value}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
            renderItem={({ item: f }) => (
              <Chip
                mode={
                  activePaymentMethodFilter === f.value ? 'flat' : 'outlined'
                }
                selected={activePaymentMethodFilter === f.value}
                style={styles.filterChip}
                textStyle={styles.filterChipText}
                onPress={() => setActivePaymentMethodFilter(f.value)}
              >
                {f.label}
              </Chip>
            )}
          />
        </View>

        {/* Overview Card */}
        {renderOverviewCard()}

        {/* Expenses List */}
        <FlatList
          data={filteredExpenses}
          keyExtractor={item => item._id}
          renderItem={renderExpenseCard}
          contentContainerStyle={
            filteredExpenses.length === 0
              ? styles.emptyListContainer
              : styles.list
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.25}
          refreshing={refreshing}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={
            loading && !refreshing ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.primary}
                style={{ marginVertical: 16 }}
              />
            ) : null
          }
        />

        {error ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {error}
          </Text>
        ) : null}

        {/* Add Expense FAB */}
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary, marginBottom: bottom + 16 }]}
          onPress={handleOpenAddExpense}
          color={theme.colors.onPrimary}
        />

        {/* Add Expense Bottom Sheet */}
        <AddExpenseBottomSheet
          ref={addExpenseBottomSheetRef}
          expenseToEdit={editingExpense}
          onExpenseCreated={handleExpenseCreated}
          onExpenseUpdated={handleExpenseCreated}
        />

        <AddExpenseHeadBottomSheet
          ref={AddExpenseHeadSheetRef}
          onOpenAddExpense={handleOpenAddExpense}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  searchBar: {
    elevation: 0,
    borderRadius: 12,
  },
  filtersContainer: {},
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  filterChip: {
    marginRight: 6,
    height: 32,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Overview Card Styles
  overviewCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewTitle: {
    marginLeft: 8,
    fontWeight: '400',
  },
  overviewStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  overviewStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '48%',
  },
  overviewValue: {
    fontWeight: '400',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 80,
    paddingTop: 4,
  },
  emptyListContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  card: {
    marginBottom: 6,
    borderRadius: 12,
  },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailsSection: {
    flex: 1,
    marginRight: 12,
  },
  actionsSection: {
    alignItems: 'flex-end',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  headName: {
    marginLeft: 6,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notesRow: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metaText: {
    marginLeft: 4,
    fontSize: 11,
    flex: 1,
  },
  notesText: {
    fontStyle: 'italic',
  },
  amount: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    margin: 0,
    width: 28,
    height: 28,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
    minHeight: 400,
  },
  emptyIconContainer: {
    marginBottom: 24,
    opacity: 0.6,
  },
  emptyTitle: {
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  errorText: {
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default Expenses;
