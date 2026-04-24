import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Text,
  Card,
  Icon,
  IconButton,
  Divider,
  useTheme,
  Chip,
  Searchbar,
  FAB,
  Button,
} from 'react-native-paper';
import {
  format,
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
} from 'date-fns';
import api from '../../utils/api';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import Navbar from '../../components/Navbar';
import CarouselSlider from '../../components/CarouselSlider';
import { TextSkeleton, TransactionsSkeleton } from '../../components/Skeletons';
import debounce from 'lodash/debounce';
import Fuse from 'fuse.js';
import LottieView from 'lottie-react-native';
import { useAuth, permissions } from '../../context/AuthContext';
import NoPermission from '../../components/NoPermission';

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

const PAYMENT_STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Paid', value: 'paid' },
  { label: 'Partial', value: 'partial' },
  { label: 'Unpaid', value: 'unpaid' },
];

const getLocalDate = d => {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

// Date filtering function
const filterTransactionsByDate = (transactions, filter, purchase) => {
  if (filter === 'all') return transactions;

  return transactions.filter(t => {
    const rawDate = purchase ? t.date : t.invoiceDate;
    if (!rawDate) return false;

    const localDate = getLocalDate(rawDate);

    switch (filter) {
      case 'today':
        return isToday(localDate);
      case 'yesterday':
        return isYesterday(localDate);
      case 'thisWeek':
        return isThisWeek(localDate);
      case 'thisMonth':
        return isThisMonth(localDate);
      default:
        return true;
    }
  });
};

// Payment status filtering function
const filterTransactionsByPaymentStatus = (
  transactions,
  paymentStatusFilter,
) => {
  if (paymentStatusFilter === 'all') return transactions;

  return transactions.filter(transaction => {
    return transaction.paymentStatus === paymentStatusFilter;
  });
};

// Search filtering function
const filterTransactionsBySearch = (transactions, searchQuery) => {
  if (!searchQuery.trim()) return transactions;

  const query = searchQuery.toLowerCase().trim();
  return transactions.filter(transaction => {
    const customerName = (transaction.customerName || '').toLowerCase();
    const customerMobile = (transaction.customerMobile || '').toLowerCase();
    const invoiceNumber = (transaction.invoiceNumber || '').toLowerCase();

    return (
      customerName.includes(query) ||
      customerMobile.includes(query) ||
      invoiceNumber.includes(query)
    );
  });
};

const Transactions = ({ isNavbar = true }) => {
  const route = useRoute();
  const { purchase = false } = route.params || {};
  // console.log(purchase)
  const theme = useTheme();
  const navigation = useNavigation();
  const { hasPermission } = useAuth();
  const { bottom } = useSafeAreaInsets();

  // Permission check
  const canView = hasPermission(permissions.CAN_VIEW_INVOICES);

  if (!canView) {
    // return (
    //   <NoPermission
    //     title="Restricted Access"
    //     message="You do not have permission to view transactions."
    //   />
    // );
  }

  const [allTransactions, setAllTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [activeFilter, setActiveFilter] = useState(isNavbar ? 'all' : 'today');
  const [activePaymentStatusFilter, setActivePaymentStatusFilter] =
    useState('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(true); // Start with true to show skeleton immediately
  const [initialLoad, setInitialLoad] = useState(true); // New state to track initial load
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const pageRef = useRef(1);
  const isFetchingRef = useRef(false);

  // Fuse options
  const fuseOptions = {
    includeScore: true,
    includeMatches: true,
    threshold: 0.45,
    minMatchCharLength: 1,
    keys: purchase
      ? [
          { name: 'vendorName', weight: 0.6 },
          { name: 'vendorMobile', weight: 0.4 },
          { name: 'invoiceNumber', weight: 0.5 },
        ]
      : [
          { name: 'customerName', weight: 0.6 },
          { name: 'customerMobile', weight: 0.4 },
          { name: 'invoiceNumber', weight: 0.5 },
        ],
  };

  const fetchPage = useCallback(
    async (pageToLoad = 1, { reset = false } = {}) => {
      if (!canView) return;
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (!refreshing) {
        setLoading(true);
      }
      setError(null);

      try {
        // Remove filter from API call - we'll filter on frontend
        const res = await api.get(
          `/${purchase ? 'purchase' : 'invoice'}?page=${pageToLoad}&limit=500`,
        );
        // console.log('Response:', res);
        if (res?.success && res.data?.docs) {
          const newTransactions = reset
            ? res.data.docs
            : appendUniqueById(allTransactions, res.data.docs);
          setAllTransactions(newTransactions);

          // Apply current filter to all transactions
          // We now apply search & date filters in a debounced effect below

          setHasNextPage(Boolean(res.data?.hasNextPage));
          pageRef.current = Number(res.data?.page) || pageToLoad;
        }
      } catch (e) {
        setError(e?.message || 'Failed to load transactions');
      } finally {
        isFetchingRef.current = false;
        if (initialLoad) {
          setInitialLoad(false);
        }
        setLoading(false);
        setRefreshing(false);
      }
    },
    [allTransactions],
  );

  console.log('All transactions count:', allTransactions);

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
      const [start, end] = range; // end is inclusive in Fuse
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

  // Debounced filter application (date filter -> payment status filter -> fuse search)
  const applyFilters = useCallback(() => {
    const dateFiltered = filterTransactionsByDate(
      allTransactions,
      activeFilter,
      purchase,
    );

    const paymentStatusFiltered =
      filterTransactionsByPaymentStatus(
        dateFiltered,
        activePaymentStatusFilter,
      ) || [];

    const rawQuery = (searchQuery || '').trim();
    if (!rawQuery) {
      // no search - clear matches
      const plain = paymentStatusFiltered.map(item => ({
        ...item,
        _matches: [],
      }));
      setFilteredTransactions(plain);
      return;
    }

    // If the query is purely numeric, perform strict substring matching against
    // invoiceNumber and customerMobile (so phone searches like "9874" work),
    // and build accurate indices for highlighting.
    const isNumeric = /^\d+$/.test(rawQuery);
    if (isNumeric) {
      const q = rawQuery.toLowerCase();

      const findIndices = (str, qstr) => {
        const indices = [];
        if (!str) return indices;
        const s = String(str).toLowerCase();
        let start = 0;
        while (true) {
          const idx = s.indexOf(qstr, start);
          if (idx === -1) break;
          indices.push([idx, idx + qstr.length - 1]);
          start = idx + qstr.length;
        }
        return indices;
      };

      const matched = paymentStatusFiltered
        .map(item => {
          const inv = String(item.invoiceNumber || '');
          const mob = String(item.customerMobile || '');
          const invIndices = findIndices(inv, q);
          const mobIndices = findIndices(mob, q);

          const matches = [];
          if (invIndices.length)
            matches.push({ key: 'invoiceNumber', indices: invIndices });
          if (mobIndices.length)
            matches.push({ key: 'customerMobile', indices: mobIndices });

          if (matches.length > 0) {
            return { ...item, _matches: matches };
          }
          return null;
        })
        .filter(Boolean);

      setFilteredTransactions(matched);
      return;
    }

    // Otherwise use Fuse fuzzy search across fields
    const fuse = new Fuse(paymentStatusFiltered, fuseOptions);
    const results = fuse.search(rawQuery);
    const mapped = results.map(r => ({ ...r.item, _matches: r.matches || [] }));
    setFilteredTransactions(mapped);
  }, [allTransactions, activeFilter, activePaymentStatusFilter, searchQuery]);

  useEffect(() => {
    const handler = debounce(applyFilters, 250);
    handler();
    return () => handler.cancel();
  }, [applyFilters]);

  useFocusEffect(
    useCallback(() => {
      pageRef.current = 1;
      fetchPage(1, { reset: true });
    }, []), // dependencies go here if needed
  );

  const onRefresh = () => {
    setRefreshing(true);
    pageRef.current = 1;
    fetchPage(1, { reset: true });
  };

  const onEndReached = () => {
    if (!hasNextPage || isFetchingRef.current) return;
    fetchPage(pageRef.current + 1, { reset: false });
  };

  // Helper to format customer display text
  const getCustomerDisplayName = transaction => {
    const name = transaction?.customerName?.trim();
    const mobile = transaction?.customerMobile?.trim();

    if (!name && !mobile) {
      return 'No Customer Found'; // Both empty
    }
    if (name) {
      return name; // Has name
    }
    return mobile; // Has mobile only
  };

  const getCustomerDisplayMobile = transaction => {
    const mobile = transaction?.customerMobile?.trim();
    return mobile || 'No Customer Found';
  };

  // Vendor display helpers for purchases
  const getVendorDisplayName = t => {
    const name = t?.vendorName?.trim();
    const mobile = t?.vendorMobile?.trim();

    if (!name && !mobile) return 'No Vendor Found';
    if (name) return name;
    return mobile;
  };

  const getVendorDisplayMobile = t => {
    const mobile = t?.vendorMobile?.trim();
    return mobile || 'No Vendor Found';
  };

  const renderTransactionCard = ({ item: t }) => {
    // Switch between customer and vendor
    const displayName = purchase
      ? getVendorDisplayName(t)
      : getCustomerDisplayName(t);

    const displayMobile = purchase
      ? getVendorDisplayMobile(t)
      : getCustomerDisplayMobile(t);

    const showPhoneIcon = purchase
      ? !t?.vendorName?.trim()
      : !t?.customerName?.trim();

    return (
      <Card
        style={styles.card}
        contentStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 0,
        }}
        mode="outlined"
        onPress={() => {
          console.log('NAVIGATING WITH PURCHASE ID 👉', t._id);
          navigation.navigate(purchase ? 'PurchaseDetail' : 'InvoiceDetail', {
            [purchase ? 'purchaseId' : 'invoiceId']: t._id,
          });
        }}
      >
        {/* Header with Customer + Invoice Number */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {(purchase ? !t?.vendorName : !t?.customerName) && (
                <Icon
                  source="phone"
                  size={16}
                  color={theme.colors.onSurfaceVariant}
                />
              )}
              <Text
                variant="titleMedium"
                style={{ marginLeft: !t?.customerName ? 4 : 0 }}
              >
                {displayName === 'XXXX'
                  ? // Don't highlight XXXX placeholder
                    'XXXX'
                  : renderHighlightedText(
                      displayName,
                      purchase
                        ? t.vendorName?.trim()
                          ? 'vendorName'
                          : 'vendorMobile'
                        : t.customerName?.trim()
                        ? 'customerName'
                        : 'customerMobile',
                      t._matches,
                    )}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {/* Edited Indicator Tag */}
            {t.edited && (
              <View
                style={[
                  styles.tag,
                  { backgroundColor: theme.colors.secondaryContainer },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {/* <Icon
                  source="pencil-outline"
                  size={10}
                  color={theme.colors.secondary}
                /> */}
                  <Text
                    style={[
                      styles.tagText,
                      {
                        color: theme.colors.secondary,
                        fontSize: 10,
                        fontWeight: '600',
                        letterSpacing: 0.2,
                        marginLeft: 4,
                      },
                    ]}
                  >
                    Edited
                  </Text>
                </View>
              </View>
            )}
            <Text variant="titleSmall" style={styles.invoiceId}>
              #
              {renderHighlightedText(
                String(t.invoiceNumber || ''),
                'invoiceNumber',
                t._matches,
              )}
            </Text>
          </View>
        </View>
        <View style={{ justifyContent: 'space-between', flexDirection: 'row' }}>
          <View>
            {(purchase ? t.vendorMobile : t.customerMobile) && (
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
                  {displayMobile === 'XXXX'
                    ? // Don't highlight XXXX placeholder
                      'XXXX'
                    : renderHighlightedText(
                        displayMobile,
                        purchase ? 'vendorMobile' : 'customerMobile',
                        t._matches,
                      )}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {t.status !== 'active' && (
              <View
                style={[styles.tag, { backgroundColor: theme.colors.error }]}
              >
                <Text
                  style={[
                    styles.tagText,
                    {
                      color: theme.colors.surface,
                      fontSize: 12,
                      fontWeight: '600',
                    },
                  ]}
                >
                  {String(t.status || '').toUpperCase()}
                </Text>
              </View>
            )}
            {!purchase && (
              <View
                style={[
                  styles.tag,
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    { color: theme.colors.onSurface, fontSize: 12 },
                  ]}
                >
                  {String(t.type || '').toUpperCase()}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.tag,
                {
                  backgroundColor:
                    t.paymentStatus === 'paid'
                      ? '#4CAF50'
                      : t.paymentStatus === 'unpaid'
                      ? '#FF5722'
                      : '#8B8000',
                },
              ]}
            >
              <Text
                style={[styles.tagText, { color: '#ffffff', fontSize: 12 }]}
              >
                {String(t.paymentStatus || '').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Date (left) and Amount (right) */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Date (left) */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon
              source="calendar"
              size={12}
              color={theme.colors.onSurfaceVariant}
            />
            <Text variant="labelSmall" style={styles.date}>
              {format(
                new Date(purchase ? t.date : t.invoiceDate),
                'dd MMM yyyy, hh:mm a',
              )}
            </Text>
          </View>

          {/* Amount (right) */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon
              source="currency-inr"
              size={16}
              color={theme.colors.primary}
              style={{ marginRight: 4 }}
            />
            <Text
              variant="labelLarge"
              style={{ fontWeight: 'bold', color: theme.colors.primary }}
            >
              {Number(t.grandTotal || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Address */}
        {/* {t.customerAddress ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <Icon
            source="map-marker"
            size={14}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            style={{
              marginLeft: 4,
              color: theme.colors.onSurfaceVariant,
              fontSize: 13,
              flexShrink: 1,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {t.customerAddress}
          </Text>
        </View>
      ) : null} */}

        {/* Totals and Status */}
        <View style={styles.details}>
          {/* <View style={styles.amount}>
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
              color: t.paymentStatus === 'paid' ? 'green' : theme.colors.error,
              textTransform: 'capitalize',
            }}
          >
            {t.paymentStatus}
          </Text>
        </View> */}
        </View>

        {/* <Divider style={styles.divider} /> */}

        {/* Actions */}
        {/* <View style={styles.actions}>
        <IconButton icon="printer" size={20} iconColor={theme.colors.primary} />
        <IconButton
          icon="share-variant"
          size={20}
          iconColor={theme.colors.primary}
        />
        <IconButton
          icon="dots-vertical"
          size={20}
          iconColor={theme.colors.primary}
        />
      </View> */}
      </Card>
    );
  };

  const renderEmptyState = () => {
    if (loading || refreshing) return null;

    const getEmptyMessage = () => {
      if (searchQuery.trim()) {
        return `No transactions found for "${searchQuery}"`;
      }

      const filterMessages = {
        today: isNavbar
          ? 'No transactions found for today'
          : 'No sales made today.',
        yesterday: isNavbar
          ? 'No transactions found for yesterday'
          : 'No sales made yesterday',
        thisWeek: isNavbar
          ? 'No transactions found this week'
          : 'No sales made this week',
        thisMonth: isNavbar
          ? 'No transactions found this month'
          : 'No sales made this month',
        all: isNavbar ? 'No transactions found' : 'No sales recorded yet.',
      };

      if (activePaymentStatusFilter !== 'all') {
        return `No ${activePaymentStatusFilter} transactions found`;
      }

      return filterMessages[activeFilter] || filterMessages.all;
    };

    const getTitle = () => {
      if (searchQuery.trim()) return 'No Results';
      if (activePaymentStatusFilter !== 'all')
        return `No ${activePaymentStatusFilter} transactions`;

      return isNavbar
        ? 'No Transactions Found'
        : activeFilter === 'today'
        ? 'No Sales Today'
        : 'No Sales Found';
    };

    const renderActionButton = () => {
      if (isNavbar) return null;

      return (
        <View style={styles.emptyActionContainer}>
          <Button
            mode="outlined"
            icon="invoice-plus"
            onPress={() => navigation.navigate('NewSale')}
            iconColor="white"
            theme={{ roundness: 12 }}
            size={24}
          >
            Create Invoice
          </Button>
        </View>
      );
    };

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <LottieView
            source={require('../../assets/animations/noinvoice.json')}
            style={{ width: 160, height: 160 }}
            autoPlay
            loop
          />
        </View>
        <Text variant="headlineSmall" style={styles.emptyTitle}>
          {getTitle()}
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.emptySubtitle, { color: theme.colors.outline }]}
        >
          {getEmptyMessage()}
        </Text>
        {renderActionButton()}
      </View>
    );
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
        {isNavbar && <Navbar title={purchase ? 'Purchases' : 'Invoices'} />}
        {!isNavbar && <CarouselSlider />}
        {!canView ? (
          <View style={{ flex: 1 }}>
            <NoPermission
              title="Restricted Access"
              message="You do not have permission to view transactions."
            />
          </View>
        ) : (
          <>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Searchbar
                placeholder="Search by name, phone, or invoice number..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={styles.searchBar}
                inputStyle={{ fontSize: 14 }}
                iconColor={theme.colors.onSurfaceVariant}
                enablesReturnKeyAutomatically
              />
            </View>

            {/* Date Filters - Only show if there are transactions */}
            {allTransactions.length > 0 && (
              <View style={{}}>
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
                      style={{
                        marginRight: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      textStyle={{ fontSize: 12, fontWeight: '800' }}
                      onPress={() => setActiveFilter(f.value)}
                    >
                      {f.label}
                    </Chip>
                  )}
                />
              </View>
            )}

            {/* Payment Status Filters - Only show if there are transactions */}
            {allTransactions.length > 0 && (
              <View style={{}}>
                <FlatList
                  data={PAYMENT_STATUS_FILTERS}
                  keyExtractor={item => item.value}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filters}
                  renderItem={({ item: f }) => (
                    <Chip
                      mode={
                        activePaymentStatusFilter === f.value
                          ? 'flat'
                          : 'outlined'
                      }
                      selected={activePaymentStatusFilter === f.value}
                      style={{
                        marginRight: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      textStyle={{ fontSize: 12, fontWeight: '800' }}
                      onPress={() => setActivePaymentStatusFilter(f.value)}
                    >
                      {f.label}
                    </Chip>
                  )}
                />
              </View>
            )}

            {/* List */}
            {initialLoad ? (
              <TransactionsSkeleton count={5} />
            ) : (
              <FlatList
                data={filteredTransactions}
                keyExtractor={item => item._id}
                renderItem={renderTransactionCard}
                contentContainerStyle={[
                  filteredTransactions.length === 0
                    ? styles.emptyListContainer
                    : styles.list,
                  { paddingBottom: 100 + bottom },
                ]}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.25}
                refreshing={refreshing}
                onRefresh={onRefresh}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={renderEmptyState}
                ListHeaderComponent={
                  loading ? <View style={{ height: 10 }} /> : null
                }
              />
            )}

            {error ? (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {error}
              </Text>
            ) : null}
          </>
        )}
      </View>
      <FAB
        style={[
          styles.fab,
          {
            backgroundColor: theme.colors.primary,
            bottom: isNavbar ? bottom : 0,
          },
        ]}
        icon={purchase ? 'cart-plus' : 'invoice-plus'}
        color="white"
        onPress={() => navigation.navigate(purchase ? 'Purchase' : 'NewSale')}
      />
    </>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 2,
    backgroundColor: 'transparent',
  },
  searchBar: {
    elevation: 0,
    borderRadius: 12,
  },
  filters: {
    flexDirection: 'row',
    padding: 5,
    paddingHorizontal: 12,
    paddingTop: 2,
  },
  list: {
    paddingHorizontal: 12,
  },
  emptyListContainer: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  card: {
    marginBottom: 8,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateSale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  tagText: {
    fontWeight: '500',
  },
  invoiceId: {
    letterSpacing: 0.4,
    fontStyle: 'italic',
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  amount: {
    flex: 1,
  },
  date: {
    letterSpacing: 0.4,
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  divider: {
    marginTop: 8,
    marginBottom: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
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
    marginBottom: 8,
  },
  emptyActionContainer: {
    alignItems: 'center',
  },
  createButtonText: {
    fontWeight: '500',
    marginTop: 4,
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

export default Transactions;
