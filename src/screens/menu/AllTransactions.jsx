import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  Searchbar,
  Chip,
  Avatar,
  IconButton,
  useTheme,
  Icon,
} from 'react-native-paper';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import api from '../../utils/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { SafeAreaView } from 'react-native-safe-area-context';
import Navbar from '../../components/Navbar';
import { TextSkeleton, TransactionsSkeleton } from '../../components/Skeletons';

dayjs.extend(relativeTime);

const AllTransactions = () => {
  const theme = useTheme();
  const layout = useWindowDimensions();

  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'customers', title: 'Customers' },
    { key: 'vendors', title: 'Vendors' },
  ]);

  // Customer Payments State
  const [customerPayments, setCustomerPayments] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(true);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState('month');
  const [customerRefreshing, setCustomerRefreshing] = useState(false);

  // Vendor Payments State
  const [vendorPayments, setVendorPayments] = useState([]);
  const [vendorLoading, setVendorLoading] = useState(true);
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('month');
  const [vendorRefreshing, setVendorRefreshing] = useState(false);

  // Calculate start date dynamically based on filter
  const getStartDate = filter => {
    const now = dayjs();
    switch (filter) {
      case 'today':
        return now.startOf('day').format('YYYY-MM-DD');
      case 'week':
        return now.subtract(7, 'day').format('YYYY-MM-DD');
      case 'month':
        return now.subtract(30, 'day').format('YYYY-MM-DD');
      case 'all':
        return now.subtract(365, 'day').format('YYYY-MM-DD');
      default:
        return now.subtract(30, 'day').format('YYYY-MM-DD');
    }
  };

  // Fetch customer payments
  const fetchCustomerPayments = async () => {
    try {
      const startDate = getStartDate(customerFilter);
      const res = await api.get('/invoice/transactions', {
        params: { startDate },
      });
      if (res.success) {
        setCustomerPayments(res.data || []);
      } else {
        setCustomerPayments([]);
      }
    } catch (err) {
      console.error(
        'Error fetching customer payments:',
        err?.response?.data || err.message,
      );
    } finally {
      setCustomerLoading(false);
    }
  };

  // Fetch vendor payments
  const fetchVendorPayments = async () => {
    try {
      const startDate = getStartDate(vendorFilter);
      const res = await api.get('/purchase/transactions', {
        params: { startDate },
      });
      if (res.success) {
        setVendorPayments(res.data || []);
      } else {
        setVendorPayments([]);
      }
    } catch (err) {
      console.error(
        'Error fetching vendor payments:',
        err?.response?.data || err.message,
      );
    } finally {
      setVendorLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerPayments();
  }, [customerFilter]);

  useEffect(() => {
    fetchVendorPayments();
  }, [vendorFilter]);

  const onCustomerRefresh = async () => {
    setCustomerRefreshing(true);
    await fetchCustomerPayments();
    setCustomerRefreshing(false);
  };

  const onVendorRefresh = async () => {
    setVendorRefreshing(true);
    await fetchVendorPayments();
    setVendorRefreshing(false);
  };

  // Process payments for customers
  const processCustomerPayments = (payments, searchQuery) => {
    return payments
      .filter(item => {
        const searchText = searchQuery.trim().toLowerCase();
        const invoiceNum = item.invoice?.invoiceNumber || '';
        return invoiceNum.toLowerCase().includes(searchText);
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  // Process payments for vendors
  const processVendorPayments = (payments, searchQuery) => {
    return payments
      .filter(item => {
        const searchText = searchQuery.trim().toLowerCase();
        const purchaseId = item.purchase?._id || '';
        const storeName = item.store?.name || 'Vendor';
        return (
          purchaseId.toLowerCase().includes(searchText) ||
          storeName.toLowerCase().includes(searchText)
        );
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const processedCustomerPayments = useMemo(
    () => processCustomerPayments(customerPayments, customerSearchQuery),
    [customerPayments, customerSearchQuery],
  );

  const processedVendorPayments = useMemo(
    () => processVendorPayments(vendorPayments, vendorSearchQuery),
    [vendorPayments, vendorSearchQuery],
  );

  // Get payment method icon
  const getPaymentMethodIcon = method => {
    switch (method?.toLowerCase()) {
      case 'card':
        return 'credit-card';
      case 'upi':
        return 'cellphone';
      case 'bank transfer':
        return 'bank';
      case 'cash':
        return 'cash';
      default:
        return 'wallet';
    }
  };

  // Get status config
  const getStatusConfig = status => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return {
          color: theme.colors.success,
          backgroundColor: theme.colors.successContainer,
          textColor: theme.colors.onSuccessContainer,
        };
      case 'pending':
        return {
          color: theme.colors.warning,
          backgroundColor: theme.colors.warningContainer,
          textColor: theme.colors.onWarningContainer,
        };
      case 'failed':
        return {
          color: theme.colors.error,
          backgroundColor: theme.colors.errorContainer,
          textColor: theme.colors.onErrorContainer,
        };
      default:
        return {
          color: theme.colors.outline,
          backgroundColor: theme.colors.surfaceVariant,
          textColor: theme.colors.onSurfaceVariant,
        };
    }
  };

  // Format amount
  const formatAmount = amount => {
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  };

  // Calculate totals
  const customerTotal = useMemo(() => {
    return processedCustomerPayments.reduce(
      (sum, item) => sum + (item.amount || 0),
      0,
    );
  }, [processedCustomerPayments]);

  const vendorTotal = useMemo(() => {
    return processedVendorPayments.reduce(
      (sum, item) => sum + (item.amount || 0),
      0,
    );
  }, [processedVendorPayments]);

  // Calculate transaction counts
  const customerCount = processedCustomerPayments.length;
  const vendorCount = processedVendorPayments.length;

  const styles = createStyles(theme);

  // Render Payment Card for Customers
  const renderCustomerPaymentCard = item => {
    const statusConfig = getStatusConfig(item.status);
    return (
      <Card mode="contained" style={styles.paymentCard}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardRow}>
            <Avatar.Icon
              size={32}
              icon={getPaymentMethodIcon(item.paymentMethod)}
              style={[
                styles.avatar,
                {
                  backgroundColor: theme.colors.primaryContainer,
                },
              ]}
              color={theme.colors.onPrimaryContainer}
            />

            <View style={styles.detailsContainer}>
              <View style={styles.detailsRow}>
                <Text
                  variant="bodyMedium"
                  numberOfLines={1}
                  style={[
                    styles.invoiceNumber,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  {item.invoice?.invoiceNumber || 'N/A'}
                </Text>
                <View style={styles.amountContainer}>
                  <IconButton
                    icon="arrow-down"
                    size={14}
                    iconColor={theme.colors.primary}
                    style={styles.arrowIcon}
                  />
                  <Text
                    variant="bodyLarge"
                    style={[styles.amount, { color: theme.colors.primary }]}
                  >
                    {formatAmount(item.amount)}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaLeft}>
                  <Text
                    variant="bodySmall"
                    style={[
                      styles.paymentMethod,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                    numberOfLines={1}
                  >
                    {item.paymentMethod}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={[styles.timeText, { color: theme.colors.outline }]}
                  >
                    {dayjs(item.createdAt).fromNow()}
                  </Text>
                </View>

                {item.status !== 'completed' && (
                  <View
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: statusConfig.backgroundColor,
                        borderColor: statusConfig.color,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: statusConfig.textColor },
                      ]}
                    >
                      {item.status?.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  // Render Payment Card for Vendors
  const renderVendorPaymentCard = item => {
    const statusConfig = getStatusConfig(item.status);
    return (
      <Card mode="contained" style={styles.paymentCard}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardRow}>
            <Avatar.Icon
              size={28}
              icon={getPaymentMethodIcon(item.paymentMethod)}
              style={[styles.avatar]}
              color={theme.colors.onErrorContainer}
            />

            <View style={styles.detailsContainer}>
              <View style={styles.detailsRow}>
                <View style={styles.vendorInfo}>
                  <Text
                    variant="bodyMedium"
                    numberOfLines={1}
                    style={[
                      styles.invoiceNumber,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    {item.purchase?.vendorName || 'N/A'}
                  </Text>
                </View>
                <View style={styles.amountContainer}>
                  <IconButton
                    icon="arrow-up"
                    size={14}
                    iconColor={theme.colors.error}
                    style={styles.arrowIcon}
                  />
                  <Text
                    variant="bodyLarge"
                    style={[styles.amount, { color: theme.colors.error }]}
                  >
                    {formatAmount(item.amount)}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaLeft}>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.primary }}
                  >
                    {item.purchase?.invoiceNumber || 'N/A'}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Text
                      variant="bodySmall"
                      style={[
                        styles.paymentMethod,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                      numberOfLines={1}
                    >
                      {item.paymentMethod}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={[styles.timeText, { color: theme.colors.outline }]}
                    >
                      {dayjs(item.createdAt).fromNow()}
                    </Text>
                  </View>
                </View>

                {item.status !== 'completed' && (
                  <View
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: statusConfig.backgroundColor,
                        borderColor: statusConfig.color,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: statusConfig.textColor },
                      ]}
                    >
                      {item.status?.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  // Render Overview Header Card
  const renderOverviewHeader = (isVendor = false) => {
    const loading = isVendor ? vendorLoading : customerLoading;
    const total = isVendor ? vendorTotal : customerTotal;
    const count = isVendor ? vendorCount : customerCount;
    const title = isVendor ? 'Amount Paid' : 'Amount Received';
    const subtitle = isVendor
      ? 'Total paid to vendors'
      : 'Total received from customers';
    const icon = isVendor ? 'arrow-up' : 'arrow-down';
    const color = isVendor ? theme.colors.error : theme.colors.primary;

    return (
      <Card style={styles.overviewCard}>
        <Card.Content style={styles.overviewContent}>
          <View style={styles.overviewIconContainer}>
            <Avatar.Icon
              size={44}
              icon={icon}
              style={[styles.overviewIcon, { backgroundColor: color }]}
              color={theme.colors.onPrimary}
            />
          </View>

          <View style={styles.overviewTextContainer}>
            <Text variant="titleMedium" style={styles.overviewTitle}>
              {title}
            </Text>
            <Text variant="bodyMedium" style={styles.overviewSubtitle}>
              {subtitle}
            </Text>
          </View>

          <View style={styles.overviewStats}>
            {loading ? (
              <TextSkeleton width={70} />
            ) : (
              <>
                <Text
                  variant="headlineSmall"
                  style={[styles.overviewAmount, { color }]}
                >
                  {formatAmount(total)}
                </Text>
                <Text variant="bodySmall" style={styles.overviewCount}>
                  {count} transaction{count !== 1 ? 's' : ''}
                </Text>
              </>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  // Render Filter Chips
  const renderFilterChips = (filter, setFilter, loading) => (
    <View style={styles.chipContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {[
          { key: 'today', label: 'Today' },
          { key: 'week', label: 'This Week' },
          { key: 'month', label: 'This Month' },
          { key: 'all', label: 'All Time' },
        ].map(({ key, label }) => (
          <Chip
            key={key}
            selected={filter === key}
            onPress={loading ? undefined : () => setFilter(key)}
            mode={filter === key ? 'flat' : 'outlined'}
            style={[styles.chip, loading && { opacity: 0.7 }]}
            textStyle={styles.chipText}
            showSelectedOverlay
            disabled={loading}
          >
            {label}
          </Chip>
        ))}
      </ScrollView>
    </View>
  );

  // Render Loading State
  const renderLoadingState = () => <TransactionsSkeleton count={5} />;

  // Render Empty State
  const renderEmptyState = (searchQuery, filter, isVendor = false) => (
    <View style={styles.emptyContainer}>
      <Avatar.Icon
        icon={isVendor ? 'arrow-up-bold' : 'arrow-down-bold'}
        size={64}
        style={[
          styles.emptyIcon,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
        color={theme.colors.onSurfaceVariant}
      />
      <Text
        variant="titleMedium"
        style={[styles.emptyTitle, { color: theme.colors.onSurfaceVariant }]}
      >
        No {isVendor ? 'payments' : 'receipts'} found
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.emptyText, { color: theme.colors.outline }]}
      >
        {searchQuery
          ? 'Try adjusting your search terms'
          : `No ${
              isVendor ? 'payments made' : 'payments received'
            } in the ${filter} period`}
      </Text>
    </View>
  );

  // Customer Tab
  const CustomersRoute = () => (
    <View style={styles.tabContent}>
      <Searchbar
        placeholder="Search invoices..."
        value={customerSearchQuery}
        onChangeText={setCustomerSearchQuery}
        style={styles.search}
        mode="bar"
        iconColor={theme.colors.onSurfaceVariant}
        inputStyle={{ color: theme.colors.onSurface }}
        placeholderTextColor={theme.colors.onSurfaceVariant}
        right={props =>
          customerSearchQuery ? (
            <IconButton
              {...props}
              icon="close"
              onPress={() => setCustomerSearchQuery('')}
              iconColor={theme.colors.onSurfaceVariant}
            />
          ) : null
        }
        editable={!customerLoading}
      />

      {renderFilterChips(customerFilter, setCustomerFilter, customerLoading)}

      {renderOverviewHeader(false)}

      {customerLoading ? (
        renderLoadingState()
      ) : (
        <FlatList
          data={processedCustomerPayments}
          keyExtractor={item => item._id}
          refreshControl={
            <RefreshControl
              refreshing={customerRefreshing}
              onRefresh={onCustomerRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => renderCustomerPaymentCard(item)}
          ListEmptyComponent={renderEmptyState(
            customerSearchQuery,
            customerFilter,
            false,
          )}
          contentContainerStyle={[
            processedCustomerPayments.length === 0 && styles.emptyList,
            styles.listContent,
          ]}
        />
      )}
    </View>
  );

  // Vendors Tab
  const VendorsRoute = () => (
    <View style={styles.tabContent}>
      <Searchbar
        placeholder="Search purchase transactions..."
        value={vendorSearchQuery}
        onChangeText={setVendorSearchQuery}
        style={styles.search}
        mode="bar"
        iconColor={theme.colors.onSurfaceVariant}
        inputStyle={{ color: theme.colors.onSurface }}
        placeholderTextColor={theme.colors.onSurfaceVariant}
        right={props =>
          vendorSearchQuery ? (
            <IconButton
              {...props}
              icon="close"
              onPress={() => setVendorSearchQuery('')}
              iconColor={theme.colors.onSurfaceVariant}
            />
          ) : null
        }
        editable={!vendorLoading}
      />

      {renderFilterChips(vendorFilter, setVendorFilter, vendorLoading)}

      {renderOverviewHeader(true)}

      {vendorLoading ? (
        renderLoadingState()
      ) : (
        <FlatList
          data={processedVendorPayments}
          keyExtractor={item => item._id}
          refreshControl={
            <RefreshControl
              refreshing={vendorRefreshing}
              onRefresh={onVendorRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => renderVendorPaymentCard(item)}
          ListEmptyComponent={renderEmptyState(
            vendorSearchQuery,
            vendorFilter,
            true,
          )}
          contentContainerStyle={[
            processedVendorPayments.length === 0 && styles.emptyList,
            styles.listContent,
          ]}
        />
      )}
    </View>
  );

  const renderScene = SceneMap({
    customers: CustomersRoute,
    vendors: VendorsRoute,
  });

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
            const isVendorsTab = route.key === 'vendors';
            const count = isVendorsTab ? vendorCount : customerCount;

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
                    source={isVendorsTab ? 'arrow-up-bold' : 'arrow-down-bold'}
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
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Navbar title="All Transactions" />
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        onIndexChange={setIndex}
        initialLayout={{ width: layout.width }}
        style={styles.tabView}
      />
    </SafeAreaView>
  );
};

const createStyles = theme =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    tabView: {
      backgroundColor: theme.colors.background,
    },
    tabContent: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    overviewCard: {
      marginHorizontal: 16,
      marginVertical: 12,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    overviewContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
    },
    overviewIconContainer: {
      marginRight: 16,
    },
    overviewIcon: {
      backgroundColor: theme.colors.primary,
    },
    overviewTextContainer: {
      flex: 1,
    },
    overviewTitle: {
      fontWeight: '700',
      color: theme.colors.onSurface,
      marginBottom: 2,
    },
    overviewSubtitle: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
    },
    overviewStats: {
      alignItems: 'flex-end',
    },
    overviewAmount: {
      fontWeight: '700',
      marginBottom: 2,
    },
    overviewCount: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
    },
    search: {
      marginHorizontal: 16,
      marginVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      elevation: 1,
    },
    chipContainer: {
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    chip: {
      marginRight: 8,
      borderWidth: 1,
      height: 32,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
    },
    paymentCard: {
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      elevation: 1,
    },
    cardContent: {
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    avatar: {
      marginRight: 12,
      alignSelf: 'center',
      backgroundColor: 'transparent',
    },
    detailsContainer: {
      flex: 1,
    },
    detailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 6,
    },
    vendorInfo: {
      flex: 1,
      marginRight: 8,
    },
    vendorLabel: {
      fontSize: 11,
      marginBottom: 2,
    },
    invoiceNumber: {
      fontWeight: '600',
      fontSize: 14,
    },
    amountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    arrowIcon: {
      margin: 0,
      padding: 0,
      marginRight: 2,
    },
    amount: {
      fontWeight: '700',
      fontSize: 15,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    metaLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flex: 1,
      gap: 12,
    },
    paymentMethod: {
      textTransform: 'capitalize',
      fontSize: 12,
    },
    timeText: {
      fontSize: 12,
    },
    statusChip: {
      height: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    statusText: {
      fontSize: 9,
      fontWeight: '700',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      marginTop: 12,
      color: theme.colors.onSurfaceVariant,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      marginBottom: 8,
      fontWeight: '600',
      textAlign: 'center',
    },
    emptyText: {
      textAlign: 'center',
      maxWidth: 300,
      lineHeight: 20,
    },
    emptyList: {
      flexGrow: 1,
    },
    listContent: {
      paddingBottom: 20,
      paddingTop: 4,
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

    countText: {
      fontSize: 9,
      fontWeight: '700',
    },
  });

export default AllTransactions;
