import { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  RefreshControl,
  FlatList,
  TouchableOpacity,
  Linking,
  useWindowDimensions,
} from 'react-native';
import {
  Card,
  useTheme,
  Text,
  Icon,
  Searchbar,
  ActivityIndicator,
  FAB,
  Badge,
  Chip,
  IconButton,
} from 'react-native-paper';
import api from '../../utils/api';
import Toast from 'react-native-toast-message';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import CustomAlert from '../../components/CustomAlert';
import Navbar from '../../components/Navbar';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { TabView, TabBar, SceneMap } from 'react-native-tab-view';
import { PartyListSkeleton } from '../../components/Skeletons';

const PartyList = ({ isNavbar = true }) => {
  const route = useRoute();
  const defaultTab = route.params?.defaultTab || 'all';
  const bottom = useSafeAreaInsets().bottom;
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const theme = useTheme();
  const navigation = useNavigation();
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [top5CustomerIds, setTop5CustomerIds] = useState([]);
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    actions: [],
  });

  // ===== ADD THESE NEW STATES =====
  const layout = useWindowDimensions(); // For tab view

  // Due customers states
  const [dueCustomers, setDueCustomers] = useState([]);
  const [filteredDueCustomers, setFilteredDueCustomers] = useState([]);
  const [dueLoading, setDueLoading] = useState(false);
  const [dueRefreshing, setDueRefreshing] = useState(false);
  const [dueCurrentPage, setDueCurrentPage] = useState(1);
  const [dueHasNextPage, setDueHasNextPage] = useState(false);
  const [dueLoadingMore, setDueLoadingMore] = useState(false);

  // Tab view states
  const [tabIndex, setTabIndex] = useState(defaultTab === 'due' ? 1 : 0);
  useEffect(() => {
    if (defaultTab === 'due') setTabIndex(1);
  }, [defaultTab]);

  const [routes] = useState([
    { key: 'all', title: 'All Customers' },
    { key: 'due', title: 'Due Customers' },
  ]);

  const showAlert = ({ title, message, type = 'info', actions = [] }) => {
    setAlertConfig({ visible: true, title, message, type, actions });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  const transformCustomer = useCallback(
    customer => ({
      id: customer._id,
      name: customer.name || '',
      mobile: customer.mobile || '',
      address: customer.address || '',
      gstNumber: customer.gstNumber || '',
      city: customer.city || '',
      state: customer.state || '',
      postalCode: customer.postalCode || '',
      isActive: customer.isActive,
      totalInvoices: customer.totalInvoices || 0,
      totalDue: customer.totalDue || 0, // ADD THIS
      pendingInvoiceCount: customer.pendingInvoiceCount || 0, // ADD THIS
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    }),
    [],
  );

  // ADD this after your existing isFetchingRef:
  const isFetchingRef = useRef(false); // EXISTING - Keep this
  const isDueFetchingRef = useRef(false); // ADD THIS NEW ONE

  const customerMap = useRef(new Map());
  // Fetch customers with pagination (memoized to avoid changing identity each render)
  const fetchCustomers = useCallback(
    async (page = 1, isLoadMore = false) => {
      if (isFetchingRef.current) {
        // Already fetching; ignore duplicate requests
        return;
      }

      isFetchingRef.current = true;
      try {
        // Only set loading states if not loading more
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError(null);

        // console.log('Fetching customers page:', page);
        const response = await api.get(`/customer?page=${page}&limit=20000`);

        if (response.success) {
          const {
            docs,
            hasNextPage: nextHasNextPage,
            page: responsePage,
          } = response.data;
          // console.log('API response data:', response.data);

          // Transform the API response
          const transformedCustomers = docs.map(transformCustomer);

          transformedCustomers.forEach(customer => {
            customerMap.current.set(customer.id, customer);
          });
          // Sort customers by totalInvoices in descending order
          transformedCustomers.sort(
            (a, b) => (b.totalInvoices || 0) - (a.totalInvoices || 0),
          );

          if (isLoadMore) {
            // Append new customers for load more using functional update to avoid stale closures
            setCustomers(prevCustomers => {
              const merged = [...prevCustomers, ...transformedCustomers];
              // Update top5 customer IDs from merged list
              const top5 = merged
                .filter(c => (c.totalInvoices || 0) > 0)
                .slice(0, 5)
                .map(c => c.id);
              setTop5CustomerIds(top5);
              return merged;
            });
          } else {
            // Replace customers for initial load/refresh
            setCustomers(transformedCustomers);

            // Update top5 from the new list
            const top5 = transformedCustomers
              .filter(c => (c.totalInvoices || 0) > 0)
              .slice(0, 5)
              .map(c => c.id);

            setTop5CustomerIds(top5);
          }

          // Update pagination states
          setCurrentPage(responsePage);
          setHasNextPage(nextHasNextPage);
        }
      } catch (err) {
        console.error('API Error:', err);
        setError(err.response?.data?.message || 'Failed to fetch customers');

        if (isLoadMore) {
          Toast.show({
            type: 'error',
            text1: 'Load More Failed',
            text2: 'Failed to load more customers',
          });
        }
      } finally {
        // Always reset loading states and fetching flag
        isFetchingRef.current = false;
        setLoadingMore(false);
        setLoading(false);
      }
    },
    [transformCustomer],
  );

  const fetchDueCustomers = useCallback(
    async (page = 1, isLoadMore = false) => {
      if (isDueFetchingRef.current) {
        return;
      }

      isDueFetchingRef.current = true;
      try {
        if (isLoadMore) {
          setDueLoadingMore(true);
        } else {
          setDueLoading(true);
        }

        const response = await api.get(`/customer/due?limit=20000`);
        // console.log('Due Customer:', response);

        if (response.success) {
          const {
            docs,
            hasNextPage: nextHasNextPage,
            page: responsePage,
          } = response.data;
          // const transformedCustomers = docs.map(transformCustomer);

          const transformedCustomers = docs.map(customer => {
            const transformed = transformCustomer(customer);

            // ADD THIS: Get totalInvoices from all customers data
            const fullCustomerData = customerMap.current.get(transformed.id);
            if (fullCustomerData) {
              transformed.totalInvoices = fullCustomerData.totalInvoices;
            }

            return transformed;
          });

          // Sort by totalDue in descending order
          transformedCustomers.sort(
            (a, b) => (b.totalDue || 0) - (a.totalDue || 0),
          );

          if (isLoadMore) {
            setDueCustomers(prev => [...prev, ...transformedCustomers]);
          } else {
            setDueCustomers(transformedCustomers);
          }

          setDueCurrentPage(responsePage);
          setDueHasNextPage(nextHasNextPage);
        }
      } catch (err) {
        console.error('Due Customers API Error:', err);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: err.response?.data?.message || 'Failed to fetch due customers',
        });
      } finally {
        isDueFetchingRef.current = false;
        setDueLoadingMore(false);
        setDueLoading(false);
      }
    },
    [transformCustomer],
  );

  // Load more function
  const loadMoreItems = useCallback(() => {
    if (
      hasNextPage &&
      !loadingMore &&
      !loading &&
      !refreshing &&
      !isFetchingRef.current
    ) {
      // console.log('Loading more items, next page:', currentPage + 1);
      const nextPage = currentPage + 1;
      fetchCustomers(nextPage, true);
    }
  }, [
    hasNextPage,
    loadingMore,
    loading,
    refreshing,
    currentPage,
    fetchCustomers,
  ]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    if (!isFetchingRef.current) {
      setRefreshing(true);
      fetchCustomers(1, false).finally(() => {
        setRefreshing(false);
      });
    }
  }, [fetchCustomers]);

  const loadMoreDueItems = useCallback(() => {
    if (
      dueHasNextPage &&
      !dueLoadingMore &&
      !dueLoading &&
      !dueRefreshing &&
      !isDueFetchingRef.current
    ) {
      const nextPage = dueCurrentPage + 1;
      fetchDueCustomers(nextPage, true);
    }
  }, [
    dueHasNextPage,
    dueLoadingMore,
    dueLoading,
    dueRefreshing,
    dueCurrentPage,
    fetchDueCustomers,
  ]);

  // ADD due refresh handler:
  const onDueRefresh = useCallback(() => {
    if (!isDueFetchingRef.current) {
      setDueRefreshing(true);
      fetchDueCustomers(1, false).finally(() => {
        setDueRefreshing(false);
      });
    }
  }, [fetchDueCustomers]);

  // REPLACE your filterCustomers function with this improved version:
  const filterCustomers = useCallback((query, customerList, setFiltered) => {
    if (!query.trim()) {
      setFiltered(customerList);
      return;
    }

    const filtered = customerList.filter(customer => {
      const name = customer.name?.toLowerCase() || '';
      const mobile = customer.mobile?.toString() || '';
      const searchTerm = query.toLowerCase();
      return name.includes(searchTerm) || mobile.includes(searchTerm);
    });
    setFiltered(filtered);
  }, []);

  // UPDATE onSearchQueryChange to filter both lists:
  const onSearchQueryChange = query => {
    setSearchQuery(query);
    filterCustomers(query, customers, setFilteredCustomers);
    filterCustomers(query, dueCustomers, setFilteredDueCustomers);
  };

  useFocusEffect(
    useCallback(() => {
      fetchCustomers(1, false);
      fetchDueCustomers(1, false); // ADD THIS LINE
    }, [fetchCustomers, fetchDueCustomers]),
  );

  useEffect(() => {
    filterCustomers(searchQuery, customers, setFilteredCustomers);
  }, [customers, searchQuery, filterCustomers]);

  // Existing due customers useEffect (already in your code)
  useEffect(() => {
    filterCustomers(searchQuery, dueCustomers, setFilteredDueCustomers);
  }, [dueCustomers, searchQuery, filterCustomers]);
  // Delete handler
  const handleDelete = id => {
    showAlert({
      title: 'Confirm Delete',
      message: 'Are you sure you want to delete this customer?',
      type: 'warning',
      actions: [
        {
          label: 'Cancel',
          mode: 'outlined',
          onPress: hideAlert,
        },
        {
          label: 'Delete',
          mode: 'contained',
          color: theme.colors.error,
          onPress: async () => {
            hideAlert();
            try {
              const res = await api.delete(`/customer/id/${id}`);
              if (res.success) {
                Toast.show({
                  type: 'success',
                  text1: 'Deleted',
                  text2: res.message || 'Customer deleted successfully',
                });
                setCustomers(prev => prev.filter(c => c.id !== id));
                setDueCustomers(prev => prev.filter(c => c.id !== id));
              }
            } catch (err) {
              console.error('Delete error:', err);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2:
                  err.response?.data?.message || 'Failed to delete customer',
              });
            }
          },
        },
      ],
    });
  };

  const handleNavigate = (party, isDue) => {
    if (isDue) {
      // Navigate to DueInvoiceDetails with ID
      navigation.navigate('DueInvoiceDetails', { id: party.id });
    } else {
      // Normal navigation to Update Customer
      navigation.navigate('AddParty', { party });
    }
  };

  // Get customer rank (1-5 for top 5, 0 for others)
  const getCustomerRank = customerId => {
    const index = top5CustomerIds.indexOf(customerId);
    return index !== -1 ? index + 1 : 0;
  };

  // Render footer with loading indicator
  const renderFooter = isLoading => {
    if (!isLoading) return null;
    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  };

  const calculateTotalDue = customerList => {
    return customerList.reduce(
      (total, customer) => total + customer.totalDue,
      0,
    );
  };

  // REPLACE your EmptyCustomerList with this:
  const EmptyCustomerList = ({ isDue = false }) => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon
          source={isDue ? 'check-circle-outline' : 'account-group-outline'}
          size={72}
          color={isDue ? theme.colors.primary : theme.colors.outline}
        />
      </View>
      <Text variant="headlineMedium" style={styles.emptyTitle}>
        {searchQuery
          ? 'No Customers Found'
          : isDue
          ? 'All Clear! 🎉'
          : 'No Customers Yet'}
      </Text>
      <Text variant="bodyLarge" style={styles.emptySubtitle}>
        {searchQuery
          ? `No customers match "${searchQuery}". Try searching by name or mobile number.`
          : isDue
          ? 'Great job! All your customers have cleared their outstanding payments.'
          : 'Start by adding your first customer to begin tracking sales and payments.'}
      </Text>
      {!searchQuery && !isDue && (
        <TouchableOpacity
          onPress={() => navigation.navigate('AddParty')}
          style={styles.emptyActionButton}
        >
          <Icon source="plus" size={24} color="#fff" />
          <Text
            variant="labelLarge"
            style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}
          >
            Add Customer
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderCustomerCard = ({ item: party, isDue = false }) => {
    const customerRank = getCustomerRank(party.id);
    const showDueBadge = isDue && party.totalDue > 0;

    // Severity levels for due amounts
    const getDueSeverity = amount => {
      if (amount >= 10000)
        return { level: 'critical', color: theme.colors.error };
      if (amount >= 5000) return { level: 'warning', color: '#F57C00' };
      return { level: 'normal', color: theme.colors.primary };
    };

    const dueSeverity = showDueBadge ? getDueSeverity(party.totalDue) : null;

    return (
      <Card
        style={[
          styles.customerCard,
          showDueBadge && {
            borderLeftWidth: 4,
            borderLeftColor: dueSeverity.color,
          },
        ]}
        mode="elevated"
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleNavigate(party, isDue)}
        >
          <Card.Content style={styles.cardContent}>
            {/* Top Row: Name and Badge */}
            <View style={styles.topRow}>
              <View style={styles.nameSection}>
                <Text
                  variant="titleMedium"
                  style={styles.customerName}
                  numberOfLines={1}
                >
                  {party.name || 'No Name'}
                </Text>
                {customerRank > 0 && (
                  <View style={styles.rankBadge}>
                    <Icon source="star" size={12} color="#FFB300" />
                    <Text style={styles.rankText}>#{customerRank}</Text>
                  </View>
                )}
              </View>
              {/* <TouchableOpacity
                onPress={() => handleDelete(party.id)}
                style={styles.deleteBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon source="delete-outline" size={20} color={theme.colors.error} />
              </TouchableOpacity> */}
            </View>

            {/* Contact Row */}
            <View style={styles.contactRow}>
              <View style={styles.mobileSection}>
                <Icon
                  source="phone-outline"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text variant="bodyMedium" style={styles.mobileText}>
                  {party.mobile || 'No mobile'}
                </Text>
              </View>
              {party.mobile && (
                <IconButton
                  icon={'phone'}
                  size={16}
                  iconColor="#fff"
                  onPress={() => Linking.openURL(`tel:${party.mobile}`)}
                  style={styles.callBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                />
              )}
            </View>

            {/* Due Amount Section - Only for Due Tab */}
            {showDueBadge && dueSeverity && (
              <View
                style={[styles.dueSection, { borderColor: dueSeverity.color }]}
              >
                <View style={styles.dueLeft}>
                  <Text variant="labelSmall" style={styles.dueLabel}>
                    OUTSTANDING
                  </Text>
                  <Text
                    variant="headlineSmall"
                    style={[styles.dueAmount, { color: dueSeverity.color }]}
                  >
                    ₹{party.totalDue.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.dueRight}>
                  <View
                    style={[
                      styles.dueBadge,
                      { backgroundColor: `${dueSeverity.color}15` },
                    ]}
                  >
                    <Icon
                      source="file-document"
                      size={14}
                      color={dueSeverity.color}
                    />
                    <Text
                      style={[
                        styles.dueBadgeText,
                        { color: dueSeverity.color },
                      ]}
                    >
                      {party.pendingInvoiceCount} Pending
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Bottom Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Icon
                  source="receipt-text-outline"
                  size={14}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text variant="bodySmall" style={styles.statText}>
                  {party.totalInvoices || 0} Invoice
                  {party.totalInvoices !== 1 ? 's' : ''}
                </Text>
              </View>

              {!showDueBadge && party.totalDue > 0 && (
                <View style={styles.statItem}>
                  <Icon
                    source="alert-circle-outline"
                    size={14}
                    color="#F57C00"
                  />
                  <Text
                    variant="bodySmall"
                    style={[styles.statText, { color: '#F57C00' }]}
                  >
                    ₹{party.totalDue.toLocaleString('en-IN')} due
                  </Text>
                </View>
              )}

              {party.address && (
                <View style={[styles.statItem, { flex: 1 }]}>
                  <Icon
                    source="map-marker-outline"
                    size={14}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text
                    variant="bodySmall"
                    style={styles.statText}
                    numberOfLines={1}
                  >
                    {party.address}
                  </Text>
                </View>
              )}
            </View>
          </Card.Content>
        </TouchableOpacity>
      </Card>
    );
  };

  // Show loading only for initial load, not for refreshes
  // if (loading && !refreshing && customers.length === 0) {
  //   return (
  //     <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
  //       <View style={styles.skeletonContainer}>
  //         <PartyListSkeleton count={6} />
  //       </View>
  //     </SafeAreaView>
  //   );
  // }

  // ADD these COMPLETE NEW COMPONENTS before your main return:

  // All Customers Tab
  const AllCustomersRoute = () => {
    if (loading && !refreshing && customers.length === 0) {
      return <PartyListSkeleton count={6} />;
    }

    return (
      <FlatList
        data={filteredCustomers}
        renderItem={renderCustomerCard}
        keyExtractor={item => item.id}
        ListEmptyComponent={<EmptyCustomerList isDue={false} />}
        ListFooterComponent={renderFooter(loadingMore)}
        contentContainerStyle={[
          styles.listContainer,
          filteredCustomers.length === 0 && styles.emptyListContainer,
          { paddingBottom: 100 + bottom },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMoreItems}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
      />
    );
  };

  const DueSummaryCard = () => {
    const totalDue = calculateTotalDue(dueCustomers);
    const dueCount = dueCustomers.length;

    return (
      <Card
        style={{
          marginBottom: 4,
          borderRadius: 12,
          backgroundColor: theme.colors.surface,
        }}
        mode="contained"
      >
        <Card.Content style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {/* Total Due */}
            <View
              style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: theme.colors.background,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}
              >
                <Icon source="currency-inr" size={18} color="#d32f2f" />
              </View>
              <View>
                <Text
                  variant="labelSmall"
                  style={{
                    color: theme.colors.onBackground,
                    fontSize: 11,
                    fontWeight: '500',
                  }}
                >
                  Total Due
                </Text>
                <Text
                  variant="titleMedium"
                  style={{ fontWeight: '700', color: '#d32f2f', fontSize: 16 }}
                >
                  ₹{totalDue.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {/* Customer Count */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flex: 1,
                justifyContent: 'flex-end',
              }}
            >
              <View>
                <Text
                  variant="labelSmall"
                  style={{
                    color: theme.colors.onBackground,
                    fontSize: 11,
                    fontWeight: '500',
                    textAlign: 'right',
                  }}
                >
                  Due Accounts
                </Text>
                <Text
                  variant="titleMedium"
                  style={{
                    fontWeight: '700',
                    color: theme.colors.primary,
                    fontSize: 16,
                    textAlign: 'right',
                  }}
                >
                  {dueCount}
                </Text>
              </View>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: theme.colors.background,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginLeft: 12,
                }}
              >
                <Icon source="account" size={18} color="#1976d2" />
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  // Due Customers Tab
  const DueCustomersRoute = () => {
    if (dueLoading && !dueRefreshing && dueCustomers.length === 0) {
      return <PartyListSkeleton count={4} />;
    }

    return (
      <>
        {/* {dueCustomers.length > 0 && <DueSummaryCard />} */}

        <FlatList
          data={filteredDueCustomers}
          renderItem={({ item }) => renderCustomerCard({ item, isDue: true })}
          keyExtractor={item => item.id}
          ListHeaderComponent={dueCustomers.length > 0 && <DueSummaryCard />}
          ListEmptyComponent={<EmptyCustomerList isDue={true} />}
          ListFooterComponent={renderFooter(dueLoadingMore)}
          contentContainerStyle={[
            styles.listContainer,
            filteredDueCustomers.length === 0 && styles.emptyListContainer,
            { paddingBottom: 100 + bottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={dueRefreshing}
              onRefresh={onDueRefresh}
            />
          }
          onEndReached={loadMoreDueItems}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      </>
    );
  };

  // ADD scene map:
  const renderScene = SceneMap({
    all: AllCustomersRoute,
    due: DueCustomersRoute,
  });

  // ADD tab bar renderer:
  const renderTabBar = props => {
    const { navigationState } = props;

    return (
      <View
        style={[
          styles.tabBarContainer,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <View
          style={[
            styles.segmentedControl,
            { backgroundColor: theme.colors.background },
          ]}
        >
          {props.navigationState.routes.map((route, index) => {
            const isActive = index === navigationState.index;
            const isDueTab = route.key === 'due';
            const dueCount = isDueTab ? dueCustomers.length : 0;

            return (
              <TouchableOpacity
                key={route.key}
                style={[
                  styles.segment,
                  {
                    backgroundColor: isActive
                      ? theme.colors.primary
                      : theme.colors.primaryContainer,
                    position: 'relative',
                  },
                ]}
                onPress={() => props.jumpTo(route.key)}
                activeOpacity={0.8}
              >
                <View style={styles.segmentContent}>
                  <Icon
                    source={isDueTab ? 'cash-clock' : 'account-group'}
                    size={18}
                    color={isActive ? '#fff' : theme.colors.onSurfaceVariant}
                  />
                  <Text
                    variant="labelLarge"
                    style={[
                      styles.segmentText,
                      {
                        color: isActive
                          ? '#fff'
                          : theme.colors.onSurfaceVariant,
                      },
                    ]}
                  >
                    {route.title}
                  </Text>
                  {isDueTab && dueCount > 0 && (
                    <View
                      style={[
                        styles.countBadge,
                        {
                          backgroundColor: theme.colors.error,
                          position: 'absolute',
                          right: -20,
                          top: -15,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.countText,

                          {
                            color: 'white',
                            fontWeight: 'bold',
                          },
                        ]}
                      >
                        {dueCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <>
      {isNavbar && (
        <SafeAreaView
          edges={['top']}
          style={[{ backgroundColor: theme.colors.background }]}
        />
      )}
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {isNavbar && <Navbar title="My Customers" />}
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search by name or phone number..."
            onChangeText={onSearchQueryChange}
            value={searchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            iconColor={theme.colors.onSurfaceVariant}
            placeholderTextColor={theme.colors.onSurfaceVariant}
          />
        </View>

        <TabView
          navigationState={{ index: tabIndex, routes }}
          renderScene={renderScene}
          onIndexChange={setTabIndex}
          initialLayout={{ width: layout.width }}
          renderTabBar={renderTabBar}
          lazy
          lazyPreloadDistance={0}
        />

        <CustomAlert
          visible={alertConfig.visible}
          onDismiss={hideAlert}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          actions={alertConfig.actions}
        />
        <FAB
          variant="primary"
          style={[
            styles.fab,
            { backgroundColor: theme.colors.primary, marginBottom: bottom },
          ]}
          icon="account-plus"
          color="white"
          onPress={() => navigation.navigate('AddParty')} // Use your actual screen name here
          // label="Create Item"
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    paddingBottom: 8,
  },
  searchBar: {
    elevation: 0,
    borderRadius: 12,
  },
  searchInput: {
    fontSize: 16,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80,
    paddingTop: 8,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyActionButton: {
    flexDirection: 'row',
  },

  // ===== NEW COMPACT CARD STYLES =====
  customerCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      android: {
        elevation: 2,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },

  cardContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 0,
  },

  nameSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },

  customerName: {
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'capitalize',
    letterSpacing: 0.15,
    flex: 1,
  },

  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 8,
    borderRadius: 12,
  },

  rankText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F57F17',
  },

  deleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(211, 47, 47, 0.08)',
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  mobileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },

  mobileText: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  callBtn: {
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      android: {
        elevation: 2,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
    }),
  },

  dueSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },

  dueLeft: {
    gap: 4,
  },

  dueLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.7,
  },

  dueAmount: {
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: 0.5,
  },

  dueRight: {
    alignItems: 'flex-end',
  },

  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  dueBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },

  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  statText: {
    fontSize: 13,
    color: '#666',
  },

  // ===== OTHER STYLES =====
  partyLeftContainer: {
    flex: 1,
  },
  partyRightContent: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
    minHeight: 400,
  },
  emptyIconContainer: {
    marginBottom: 20,
    opacity: 0.5,
  },
  emptyTitle: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  skeletonContainer: {
    padding: 16,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  footerText: {
    marginLeft: 8,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 8,
    bottom: 12,
  },
  sortHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  tabBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },

  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 6,
  },

  segment: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  segmentActive: {
    ...Platform.select({
      android: {
        elevation: 2,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
    }),
  },

  segmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },

  countBadge: {
    height: 20,
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },

  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },

  countText: {
    fontSize: 9,
    fontWeight: '700',
  },
});

export default PartyList;
