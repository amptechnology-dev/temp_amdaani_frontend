import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  RefreshControl,
  BackHandler,
  ToastAndroid,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import {
  Text,
  Card,
  useTheme,
  ActivityIndicator,
  Divider,
  Surface,
  IconButton,
  Chip,
  Icon as PeperIcon,
} from 'react-native-paper';
import {
  format,
  startOfMonth,
  subMonths,
  isSameMonth,
  formatDistanceToNow,
} from 'date-fns';
import { BarChart, PieChart, LineChart } from 'react-native-gifted-charts';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../utils/api';
import currency from 'currency.js';
import { ListSkeleton, MetricCardSkeleton } from '../../components/Skeletons';
import { ensureNotificationPermission } from '../../utils/permissions';
import { OneSignal } from 'react-native-onesignal';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import CarouselSlider from '../../components/CarouselSlider';
import Config from 'react-native-config';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const chartWidth = screenWidth - 80; // Increased padding for better containment
const chartPadding = 40; // Internal padding for charts

// Helper function to calculate amount after discount
const getNetAmount = inv => Number(inv.grandTotal || 0);

const Dashboard = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const [invoicesData, setInvoicesData] = useState([]);
  const [products, setProducts] = useState([]);
  const [dueSummary, setDueSummary] = useState({
    totalDue: 0,
    totalCustomers: 0,
    totalPendingInvoices: 0,
  });
  const [receivedSummary, setReceivedSummary] = useState({ totalReceived: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exitApp, setExitApp] = useState(false); // 👈 for double back to exit

  // useFocusEffect(
  //   React.useCallback(() => {

  //     askNotificationPermission();
  //   }, [])
  // );

  const BASE_URL = Config.API_BASE_URL;

  //'https://pos-dev.amptechnology.in/api'
  console.log('BASE_URL:', BASE_URL);

  // Replace your current useEffect with useFocusEffect
  useFocusEffect(
    useCallback(() => {
      const backAction = () => {
        if (exitApp) {
          BackHandler.exitApp();
        } else {
          setExitApp(true);
          ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);

          setTimeout(() => {
            setExitApp(false);
          }, 2000);
        }
        return true;
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction,
      );

      return () => backHandler.remove();
    }, [exitApp]),
  );

  useEffect(() => {
    askNotificationPermission();
    // fetchDashboardData();
  }, []);

  const askNotificationPermission = async () => {
    OneSignal.Notifications.requestPermission(true);
  };

  const fetchDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const startDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');

      const [invoiceRes, productRes, dueRes, transactionRes] =
        await Promise.all([
          api.get('/invoice?limit=50000&status=active'),
          api.get('/product?limit=50000'),
          api.get('/customer/due?limit=20000'),
          api.get('/invoice/transactions', { params: { startDate } }),
        ]);

      // console.log('dashboard res invoice:', dueRes);
      // Handle invoices
      if (invoiceRes?.success && invoiceRes.data?.docs) {
        setInvoicesData(invoiceRes.data.docs);
      }

      // Handle products
      if (productRes?.success && productRes.data?.docs) {
        setProducts(productRes.data.docs);
      }

      // Handle Due Summary
      if (dueRes?.success && dueRes.data?.docs?.length) {
        const docs = dueRes.data.docs;
        const totalDue = docs.reduce((sum, c) => sum + (c.totalDue || 0), 0);
        const totalCustomers = docs.length;
        const totalPendingInvoices = docs.reduce(
          (sum, c) => sum + (c.pendingInvoiceCount || 0),
          0,
        );
        setDueSummary({ totalDue, totalCustomers, totalPendingInvoices });
      } else {
        setDueSummary({
          totalDue: 0,
          totalCustomers: 0,
          totalPendingInvoices: 0,
        });
      }

      // Handle Received Summary
      if (transactionRes?.success && Array.isArray(transactionRes.data)) {
        const completedTxns = transactionRes.data.filter(
          t => t.status === 'completed',
        );
        const totalReceived = completedTxns.reduce(
          (sum, t) => sum + (Number(t.amount) || 0),
          0,
        );
        setReceivedSummary({ totalReceived });
      } else {
        setReceivedSummary({ totalReceived: 0 });
      }
    } catch (e) {
      console.error('Dashboard API Error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  console.log();

  const onRefresh = () => {
    fetchDashboardData(true);
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData(false);
    }, []),
  );

  const abbreviateNumber = value => {
    if (value >= 1e7) {
      return (value / 1e7).toFixed(2).replace(/\.00$/, '') + ' Cr'; // Crores
    } else if (value >= 1e5) {
      return (value / 1e5).toFixed(2).replace(/\.00$/, '') + ' L'; // Lakhs
    } else {
      // For values below 1 Lakh, format with Indian commas
      return new Intl.NumberFormat('en-IN').format(value);
    }
  };

  // Utility: Format with currency
  const formatCurrency = (value, { withSymbol = true } = {}) => {
    const formattedValue = abbreviateNumber(value);
    if (typeof formattedValue === 'string' && /[LCr]/.test(formattedValue)) {
      return withSymbol ? `₹ ${formattedValue}` : formattedValue;
    }
    return withSymbol
      ? currency(value, { symbol: '₹', precision: 2, separator: ',' }).format()
      : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(
          value,
        );
  };

  const calculateMetrics = () => {
    const today = new Date();

    // ✅ Indian Financial Year: April 1 to March 31
    const currentMonth = today.getMonth() + 1; // 1-based
    const fyStartYear =
      currentMonth >= 4 ? today.getFullYear() : today.getFullYear() - 1;
    const fyStart = new Date(fyStartYear, 3, 1); // April 1
    const fyEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999); // March 31

    const annualInvoices = invoicesData.filter(inv => {
      const d = new Date(inv.invoiceDate);
      return d >= fyStart && d <= fyEnd;
    });
    const annualSale = annualInvoices.reduce(
      (s, inv) => s + getNetAmount(inv),
      0,
    );

    // ✅ Last financial year for growth comparison
    const lastFyStart = new Date(fyStartYear - 1, 3, 1);
    const lastFyEnd = new Date(fyStartYear, 2, 31, 23, 59, 59, 999);
    const lastYearInvoices = invoicesData.filter(inv => {
      const d = new Date(inv.invoiceDate);
      return d >= lastFyStart && d <= lastFyEnd;
    });
    const lastYearSale = lastYearInvoices.reduce(
      (s, inv) => s + getNetAmount(inv),
      0,
    );

    const annualGrowth =
      lastYearSale > 0 ? ((annualSale - lastYearSale) / lastYearSale) * 100 : 0;

    // Monthly (unchanged)
    const monthlyInvoices = invoicesData.filter(inv =>
      isSameMonth(new Date(inv.invoiceDate), today),
    );
    const monthlySale = monthlyInvoices.reduce(
      (s, inv) => s + getNetAmount(inv),
      0,
    );

    const lastMonth = subMonths(today, 1);
    const lastMonthInvoices = invoicesData.filter(inv =>
      isSameMonth(new Date(inv.invoiceDate), lastMonth),
    );
    const lastMonthSale = lastMonthInvoices.reduce(
      (s, inv) => s + getNetAmount(inv),
      0,
    );

    const monthlyGrowth =
      lastMonthSale > 0
        ? ((monthlySale - lastMonthSale) / lastMonthSale) * 100
        : 0;

    // Weekly (unchanged)
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weeklyInvoices = invoicesData.filter(inv => {
      const invDate = new Date(inv.invoiceDate);
      return invDate >= weekStart && invDate <= today;
    });
    const weeklySale = weeklyInvoices.reduce(
      (s, inv) => s + getNetAmount(inv),
      0,
    );
    const weeklyAvg =
      weeklyInvoices.length > 0 ? weeklySale / weeklyInvoices.length : 0;

    // Today (unchanged)
    const todayInvoices = invoicesData.filter(
      inv =>
        format(new Date(inv.invoiceDate), 'yyyy-MM-dd') ===
        format(today, 'yyyy-MM-dd'),
    );
    const todaySale = todayInvoices.reduce(
      (s, inv) => s + getNetAmount(inv),
      0,
    );
    const todayMax =
      todayInvoices.length > 0
        ? Math.max(...todayInvoices.map(inv => getNetAmount(inv)))
        : 0;

    return {
      annualSale,
      monthlySale,
      weeklySale,
      todaySale,
      annualInvoices: annualInvoices.length,
      monthlyInvoices: monthlyInvoices.length,
      weeklyInvoices: weeklyInvoices.length,
      todayInvoices: todayInvoices.length,
      lastYearSale,
      lastMonthSale,
      annualGrowth,
      monthlyGrowth,
      weeklyAvg,
      todayMax,
    };
  };

  // Monthly revenue chart with proper containment
  const getMonthlyRevenueData = () => {
    const monthlyData = {};
    const months = [];

    for (let i = 5; i >= 0; i--) {
      const month = subMonths(new Date(), i);
      const monthKey = format(month, 'MMM');
      months.push(monthKey);
      monthlyData[monthKey] = 0;
    }

    invoicesData.forEach(inv => {
      const monthKey = format(new Date(inv.invoiceDate), 'MMM');
      if (monthlyData.hasOwnProperty(monthKey)) {
        monthlyData[monthKey] += getNetAmount(inv);
      }
    });

    const maxValue = Math.max(...Object.values(monthlyData));

    return {
      data: months.map((month, index) => ({
        value: monthlyData[month], // ✅ use actual value, no scale
        actual: monthlyData[month],
        label: month,
        frontColor:
          index % 2 === 0 ? theme.colors.primary : theme.colors.secondary,
        spacing: 2,
        labelTextStyle: { color: theme.colors.onSurfaceVariant, fontSize: 10 },
        topLabelComponent: () => (
          <Text
            variant="labelSmall"
            style={{ fontSize: 8, color: theme.colors.primary }}
          >
            {formatCurrency(monthlyData[month], { withSymbol: false })}
          </Text>
        ),
      })),
      maxValue,
    };
  };

  // Payment status with better visibility
  const getPaymentStatusData = () => {
    const metrics = calculateMetrics();
    const total = metrics.paidInvoices + metrics.unpaidInvoices;

    if (total === 0) {
      return [];
    }

    return [
      {
        value: metrics.paidInvoices,
        color: '#4CAF50',
        gradientCenterColor: '#66BB6A',
        focused: true,
        text: `${metrics.paidInvoices}`,
        label: 'Paid',
      },
      {
        value: metrics.unpaidInvoices,
        color: '#FF5722',
        gradientCenterColor: '#FF7043',
        text: `${metrics.unpaidInvoices}`,
        label: 'Unpaid',
      },
      {
        value: metrics.partialInvoices,
        color: '#FF9800',
        gradientCenterColor: '#FFA726',
        text: `${metrics.partialInvoices}`,
        label: 'Partial',
      },
    ];
  };

  // Weekly trend with proper containment
  const getWeeklyTrendData = () => {
    const weeklyData = {};

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const dayKey = format(day, 'EEE');
      weeklyData[dayKey] = 0;
    }

    invoicesData
      .filter(inv => {
        const invDate = new Date(inv.invoiceDate);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        return invDate >= sevenDaysAgo;
      })
      .forEach(inv => {
        const dayKey = format(new Date(inv.invoiceDate), 'EEE');
        if (weeklyData.hasOwnProperty(dayKey)) {
          weeklyData[dayKey] += getNetAmount(inv);
        }
      });

    const maxValue = Math.max(...Object.values(weeklyData), 0);

    return {
      data: Object.keys(weeklyData).map(day => ({
        value: weeklyData[day], // ✅ use actual value
        label: day,
        dataPointText: abbreviateNumber(weeklyData[day]),
        textShiftY: -10,
        textColor: theme.colors.primary,
        textFontSize: 10,
        textAlign: 'center', // ✅ Center align data point text
      })),
      maxValue,
    };
  };

  const getTopCustomers = () => {
    if (!invoicesData.length) return { sorted: [], percentage: 0 };

    const customerMap = {};
    invoicesData.forEach(inv => {
      const name = inv.customerName;
      const mobile = inv.customerMobile || '';
      const key = `${name}|${mobile}`; // Create a unique key using both name and mobile

      if (!customerMap[key]) {
        customerMap[key] = {
          name: name,
          mobile: mobile,
          count: 0,
          total: 0,
        };
      }
      customerMap[key].count += 1;
      customerMap[key].total += getNetAmount(inv);
    });

    const sorted = Object.values(customerMap)
      .map(({ name, mobile, count, total }) => ({
        customer: name,
        mobile: mobile,
        count,
        total,
      }))
      .sort((a, b) => {
        // Primary: sort by invoice count (desc)
        if (b.count !== a.count) return b.count - a.count;
        // Secondary: when counts equal, sort by total revenue (desc)
        return b.total - a.total;
      }) // rank by invoice count then amount
      .slice(0, 5);

    const totalInvoices = invoicesData.length;
    const top5Count = sorted.reduce((s, c) => s + c.count, 0);
    const percentage =
      totalInvoices > 0 ? (top5Count / totalInvoices) * 100 : 0;

    return { sorted, percentage };
  };

  // 🔹 Top 5 Products/Services
  const getTopProducts = () => {
    if (!products.length) return [];

    return products
      .map(p => ({
        name: p.name,
        qty: p.sellCount || 0,
        revenue: (p.sellCount || 0) * (p.sellingPrice || 0),
        category: p.category?.name || 'Uncategorized',
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  };

  // Get recent invoices for activity
  const getRecentActivity = () => {
    return invoicesData
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
  };

  const metrics = calculateMetrics();
  const monthlyRevenue = getMonthlyRevenueData();
  const paymentStatusData = getPaymentStatusData();
  const weeklyTrend = getWeeklyTrendData();
  const recentActivity = getRecentActivity();
  const topCustomers = getTopCustomers();
  const topProducts = getTopProducts();

  if (loading) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Key Metrics Skeleton */}
        <View style={styles.metricsGrid}>
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </View>

        {/* Top Customers Skeleton */}
        <View
          style={[
            styles.fullChart,
            { backgroundColor: theme.colors.surface, padding: 16 },
          ]}
        >
          <ListSkeleton rows={5} />
        </View>

        {/* Top Products Skeleton */}
        <View
          style={[
            styles.fullChart,
            { backgroundColor: theme.colors.surface, padding: 16 },
          ]}
        >
          <ListSkeleton rows={5} />
        </View>
      </ScrollView>
    );
  }

  //console.log('annul data ===>', metrics.annualSale);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{}}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[theme.colors.primary]}
        />
      }
    >
      {/* Key Metrics Grid */}
      <View style={styles.metricsGrid}>
        {/* Annual Sale */}
        <Card
          style={[
            styles.metricCard,
            { backgroundColor: theme.colors.surface, marginTop: 12 },
          ]}
          onPress={() =>
            navigation.navigate('SalesReport', { dashboardFlag: true })
          }
        >
          <Card.Content style={styles.metricContent}>
            <View style={styles.metricHeader}>
              <Icon
                name="calendar-multiselect"
                size={20}
                color={theme.colors.primary}
              />
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Annual Sales
              </Text>
            </View>
            <Text
              variant="headlineMedium"
              style={[styles.metricValue, { color: theme.colors.onSurface }]}
            >
              {formatCurrency(metrics.annualSale)}
            </Text>
            <Text
              variant="labelSmall"
              style={{
                color:
                  metrics.annualGrowth >= 0
                    ? theme.colors.primary
                    : theme.colors.error,
              }}
            >
              {metrics.annualGrowth >= 0 ? '↑' : '↓'}{' '}
              {Math.abs(metrics.annualGrowth).toFixed(1)}% vs last year •{' '}
              {metrics.annualInvoices} invoices
            </Text>
          </Card.Content>
        </Card>

        {/* Monthly Sale */}
        <Card
          style={[
            styles.metricCard,
            { backgroundColor: theme.colors.surface, marginTop: 12 },
          ]}
          onPress={() => {
            navigation.navigate('SalesReport', { dashboardMonthlyFlag: true });
          }}
        >
          <Card.Content style={styles.metricContent}>
            <View style={styles.metricHeader}>
              <Icon
                name="calendar-month"
                size={20}
                color={theme.colors.secondary}
              />
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Monthly Sales
              </Text>
            </View>
            <Text
              variant="headlineMedium"
              style={[styles.metricValue, { color: theme.colors.onSurface }]}
            >
              {formatCurrency(metrics.monthlySale)}
            </Text>
            <Text
              variant="labelSmall"
              style={{
                color:
                  metrics.monthlyGrowth >= 0
                    ? theme.colors.secondary
                    : theme.colors.error,
              }}
            >
              {metrics.monthlyGrowth >= 0 ? '↑' : '↓'}{' '}
              {Math.abs(metrics.monthlyGrowth).toFixed(1)}% vs last month •{' '}
              {metrics.monthlyInvoices} invoices
            </Text>
          </Card.Content>
        </Card>

        {/* Weekly Sale */}
        <Card
          style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}
          onPress={() => {
            navigation.navigate('SalesReport', { dashboardWeeklyFlag: true });
          }}
        >
          <Card.Content style={styles.metricContent}>
            <View style={styles.metricHeader}>
              <Icon
                name="calendar-week"
                size={20}
                color={theme.colors.tertiary}
              />
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Weekly Sales
              </Text>
            </View>
            <Text
              variant="headlineMedium"
              style={[styles.metricValue, { color: theme.colors.onSurface }]}
            >
              {formatCurrency(metrics.weeklySale)}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.tertiary }}>
              Across {metrics.weeklyInvoices} invoices • Avg{' '}
              {formatCurrency(metrics.weeklyAvg)}
            </Text>
          </Card.Content>
        </Card>

        {/* Today’s Sale */}
        <Card
          style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}
          onPress={() => {
            navigation.navigate('SalesReport', { dashboardTodayFlag: true });
          }}
        >
          <Card.Content style={styles.metricContent}>
            <View style={styles.metricHeader}>
              <Icon
                name="calendar-today"
                size={20}
                color={theme.colors.error}
              />
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Today’s Sales
              </Text>
            </View>
            <Text
              variant="headlineMedium"
              style={[styles.metricValue, { color: theme.colors.onSurface }]}
            >
              {formatCurrency(metrics.todaySale)}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.error }}>
              {metrics.todayInvoices} invoices • Max{' '}
              {formatCurrency(metrics.todayMax)}
            </Text>
          </Card.Content>
        </Card>
      </View>

      <CarouselSlider />

      <Card
        mode="elevated"
        style={[
          styles.chartCard,
          {
            backgroundColor: theme.colors.surface,
            marginTop: 8,
            borderRadius: 16,
            elevation: 4,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 6,
          },
        ]}
      >
        <Card.Content style={{ paddingVertical: 12, paddingHorizontal: 20 }}>
          {/* HEADER */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flexShrink: 1 }}>
              <Text
                variant="titleMedium"
                style={{ fontWeight: '700', color: theme.colors.onSurface }}
              >
                Customer Due & Received Summary
              </Text>
              <Text
                variant="bodySmall"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  opacity: 0.8,
                  marginTop: 2,
                }}
              >
                Current Month Overview • {format(new Date(), 'MMMM yyyy')}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: `${theme.colors.primary}15`,
                borderRadius: 50,
                padding: 8,
              }}
            >
              <Icon
                name="account-cash"
                size={26}
                color={theme.colors.primary}
              />
            </View>
          </View>

          {/* Divider with subtle gradient */}
          <View
            style={{
              height: 1,
              backgroundColor: theme.colors.outlineVariant,
              opacity: 0.4,
              marginVertical: 12,
            }}
          />

          {/* METRIC ROW */}
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            {/* DUE SECTION */}
            <TouchableOpacity
              onPress={() => {
                navigation.navigate('PartyList', { defaultTab: 'due' });
              }}
              activeOpacity={0.8}
              style={{ flex: 1, alignItems: 'center' }}
            >
              <Chip
                icon="alert-circle"
                style={{
                  backgroundColor: `${theme.colors.error}15`,
                  borderColor: `${theme.colors.error}40`,
                  borderWidth: 1,
                  marginBottom: 4,
                }}
                textStyle={{
                  color: theme.colors.error,
                  fontWeight: '600',
                  fontSize: 12,
                }}
              >
                Total Outstanding
              </Chip>
              <Text
                variant="headlineSmall"
                style={{
                  fontSize: 20,
                  fontWeight: '800',
                  color: theme.colors.error,
                }}
              >
                {formatCurrency(dueSummary.totalDue)}
              </Text>
              <View style={{ alignSelf: 'flex-start' }}>
                {dueSummary.totalCustomers > 0 && (
                  <Text
                    variant="bodySmall"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      opacity: 0.8,
                    }}
                  >
                    {dueSummary.totalCustomers} customers
                  </Text>
                )}
                {dueSummary.totalPendingInvoices > 0 && (
                  <Text
                    variant="bodySmall"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      opacity: 0.8,
                      textAlign: 'left',
                    }}
                  >
                    {dueSummary.totalPendingInvoices} invoices
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Center divider line */}
            <View
              style={{
                width: 1,
                backgroundColor: theme.colors.outlineVariant,
                marginHorizontal: 8,
                opacity: 0.3,
              }}
            />

            {/* RECEIVED SECTION */}
            <TouchableOpacity
              onPress={() => {
                navigation.navigate('AllTransactions');
              }}
              activeOpacity={0.8}
              style={{ flex: 1, alignItems: 'center' }}
            >
              <Chip
                icon="cash"
                style={{
                  backgroundColor: `${theme.colors.primary}15`,
                  borderColor: `${theme.colors.primary}40`,
                  borderWidth: 1,
                  marginBottom: 4,
                }}
                textStyle={{
                  color: theme.colors.primary,
                  fontWeight: '600',
                  fontSize: 12,
                }}
              >
                Received
              </Chip>
              <Text
                variant="headlineSmall"
                style={{
                  fontSize: 20,
                  fontWeight: '800',
                  color: theme.colors.primary,
                }}
              >
                {formatCurrency(receivedSummary.totalReceived)}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, opacity: 0.8 }}
              >
                Received this month
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bottom subtle footer bar */}
          {/* <View
            style={{
              height: 4,
              marginTop: 16,
              borderRadius: 100,
              backgroundColor:
                dueSummary.totalDue > 0
                  ? `linear-gradient(90deg, ${theme.colors.error}40, ${theme.colors.primary}40)`
                  : `${theme.colors.primary}30`,
              opacity: 0.,
            }}
          /> */}
        </Card.Content>
      </Card>

      {/* Monthly Revenue Chart */}
      <Card
        style={[
          styles.chartCard,
          { backgroundColor: theme.colors.surface, marginTop: 8 },
        ]}
      >
        <Card.Content style={styles.chartCardContent}>
          <View style={styles.chartHeader}>
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}
            >
              Monthly Revenue Trend
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Last 6 months
            </Text>
          </View>

          <View style={styles.chartContainer}>
            <BarChart
              data={monthlyRevenue.data}
              width={chartWidth}
              height={240}
              barWidth={28}
              spacing={20}
              cappedBars
              capColor={theme.colors.primary}
              capThickness={6}
              capRadius={3}
              showGradient
              initialSpacing={15}
              endSpacing={15}
              noOfSections={5}
              maxValue={monthlyRevenue.maxValue * 1.2}
              yAxisLabelWidth={50}
              yAxisTextStyle={{
                color: theme.colors.onSurfaceVariant,
                fontSize: 10,
                fontWeight: '500',
              }}
              xAxisLabelTextStyle={{
                color: theme.colors.onSurfaceVariant,
                fontSize: 10,
                fontWeight: '500',
              }}
              rulesColor={theme.colors.outline}
              rulesType="solid"
              xAxisColor={theme.colors.outline}
              yAxisColor={theme.colors.outline}
              yAxisLabelTexts={Array.from({ length: 6 }, (_, i) => {
                const value = ((monthlyRevenue.maxValue * 1.2) / 5) * i;
                return formatCurrency(value);
              })}
              // ✅ Show tooltip on press
              showTooltipOnPress
              renderTooltip={item => (
                <View
                  style={{
                    padding: 6,
                    backgroundColor: theme.colors.surfaceVariant,
                    borderRadius: 6,
                    elevation: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: 'bold',
                      color: theme.colors.onSurface,
                    }}
                  >
                    {item.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.colors.primary }}>
                    {formatCurrency(item.actual)}{' '}
                    {/* 👈 Proper formatted currency */}
                  </Text>
                </View>
              )}
              // ✅ Show formatted value above each bar

              // ✅ Animation
              isAnimated
              scrollAnimation
              animateOnRender
              animationDuration={1200}
            />
          </View>
          {/* <Text variant="bodySmall" style={[styles.chartNote, { color: theme.colors.onSurfaceVariant }]}>
            {monthlyRevenue.scaleFactor === 1000 ? 'Values shown in thousands (₹K)' : 'Values in actual amounts'}
          </Text> */}
        </Card.Content>
      </Card>

      {/* Payment Status Chart - Full Width */}
      {/* <Card style={[styles.fullChart, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.chartCardContent}>
          <Text variant="titleLarge" style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
            Payment Status Overview
          </Text>

          {paymentStatusData.length > 0 ? (
            <View style={styles.pieChartWrapper}>
              <PieChart
                data={paymentStatusData}
                radius={100}
                innerRadius={65}
                centerLabelComponent={() => (
                  <View style={styles.centerLabel}>
                    <Text variant="headlineLarge" style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>
                      {metrics.totalInvoices}
                    </Text>
                    <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      Total Invoices
                    </Text>
                  </View>
                )}
                showGradient
                labelsPosition="outward"
                showText
                textColor={theme.colors.onSurface}
                textSize={14}
                strokeWidth={2}
                strokeColor={theme.colors.surface}
              />

              <View style={styles.legendContainer}>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                  <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>
                    Paid: {metrics.paidInvoices} invoices
                  </Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#FF5722' }]} />
                  <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>
                    Unpaid: {metrics.unpaidInvoices} invoices
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                No payment data available
              </Text>
            </View>
          )}
        </Card.Content>
      </Card> */}

      {/* Weekly Trend Chart - Full Width */}
      <Card
        style={[styles.fullChart, { backgroundColor: theme.colors.surface }]}
      >
        <Card.Content style={styles.chartCardContent}>
          <Text
            variant="titleMedium"
            style={[styles.chartTitle, { color: theme.colors.onSurface }]}
          >
            Weekly Sales Trend
          </Text>

          <View style={styles.lineChartContainer}>
            <LineChart
              data={weeklyTrend.data}
              width={chartWidth}
              height={180}
              color={theme.colors.primary}
              thickness={4}
              curved
              showDataPointLabelText
              scrollAnimation
              // Axis styles
              noOfSections={4}
              maxValue={weeklyTrend.maxValue * 1.2}
              yAxisLabelWidth={50}
              yAxisLabelTexts={Array.from({ length: 5 }, (_, i) => {
                const v = ((weeklyTrend.maxValue * 1.2) / 4) * i;

                if (v >= 1e7)
                  return (v / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr';
                if (v >= 1e5)
                  return (v / 1e5).toFixed(1).replace(/\.0$/, '') + 'L';
                if (v >= 1e3)
                  return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
                return Math.round(v).toString(); // small numbers → whole number
              })}
              yAxisTextStyle={{
                color: theme.colors.onSurfaceVariant,
                fontSize: 10,
                fontWeight: '500',
              }}
              xAxisLabelTextStyle={{
                color: theme.colors.onSurfaceVariant,
                fontSize: 10,
                fontWeight: '500',
                textAlign: 'center',
              }}
              rulesColor={theme.colors.outline}
              xAxisColor={theme.colors.outline}
              yAxisColor={theme.colors.outline}
              xAxisThickness={1}
              yAxisThickness={1}
              // Fill area
              lineGradient
              startFillColor={theme.colors.primaryContainer}
              endFillColor={theme.colors.surface}
              startOpacity={0.8}
              endOpacity={0.1}
              dataPointsColor={theme.colors.primary}
              initialSpacing={20}
              endSpacing={40}
              showScrollIndicator={false}
              scrollToIndex={weeklyTrend.data.length - 1}
              // scrollAnimation
              scrollAnimationDuration={800}
              // Animation
              isAnimated
              animateOnRender
              animationDuration={1000}
            />
          </View>
          {/* <Text variant="bodySmall" style={[styles.chartNote, { color: theme.colors.onSurfaceVariant }]}>
            {weeklyTrend.scaleFactor === 1000 ? 'Daily sales shown in thousands (₹K)' : 'Daily sales in actual amounts'}
          </Text> */}
        </Card.Content>
      </Card>

      {/* Top 5 Customers Section */}
      <Card
        onPress={() => navigation.navigate('PartyList')}
        style={[styles.fullChart, { backgroundColor: theme.colors.surface }]}
      >
        <Card.Content>
          <Text
            variant="titleMedium"
            style={[styles.activityTitle, { color: theme.colors.onSurface }]}
          >
            Top 5 Customers
          </Text>
          <Divider
            style={[styles.divider, { backgroundColor: theme.colors.outline }]}
          />

          {topCustomers.sorted.length > 0 ? (
            <>
              {topCustomers.sorted.map((c, i) => (
                <View key={i} style={styles.rankRow}>
                  <Text
                    style={{
                      color: theme.colors.onSurface,
                      fontSize: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 8,
                    }}
                  >
                    {i + 1}.
                  </Text>
                  {c.customer !== '' ? (
                    <View style={{ flexDirection: 'column', flex: 1 }}>
                      <Text
                        variant="bodyMedium"
                        style={{ color: theme.colors.onSurface, flex: 1 }}
                      >
                        {c.customer}
                      </Text>
                      <Text
                        variant="bodyMedium"
                        style={{ color: theme.colors.onSurface, flex: 1 }}
                      >
                        {c.mobile}
                      </Text>
                    </View>
                  ) : (
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurface, flex: 1 }}
                    >
                      {c.mobile || 'Unknown Customer'}
                    </Text>
                  )}
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      variant="bodyMedium"
                      style={{
                        color: theme.colors.primary,
                        fontWeight: 'bold',
                      }}
                    >
                      {c.count} invoices
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {formatCurrency(c.total)}
                    </Text>
                  </View>
                </View>
              ))}
              <Text
                variant="bodySmall"
                style={{
                  marginTop: 8,
                  textAlign: 'center',
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                Top 5 customers = {topCustomers.percentage.toFixed(1)}% of
                invoices
              </Text>
            </>
          ) : (
            <View style={styles.noActivityContainer}>
              <PeperIcon
                source="account-outline"
                size={48}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="bodyLarge"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                No customer data available
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      <Card
        onPress={() => navigation.navigate('Itemlist', { fromMenu: true })}
        style={[styles.fullChart, { backgroundColor: theme.colors.surface }]}
      >
        <Card.Content>
          <Text
            variant="titleMedium"
            style={[styles.activityTitle, { color: theme.colors.onSurface }]}
          >
            Top 5 Products / Items
          </Text>
          <Divider
            style={[styles.divider, { backgroundColor: theme.colors.outline }]}
          />

          {topProducts.filter(p => p.revenue > 0).length > 0 ? (
            topProducts
              .filter(p => p.revenue > 0)
              .map((p, i) => (
                <View key={i} style={styles.rankRow}>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurface, flex: 1 }}
                  >
                    {i + 1}. {p.name}
                  </Text>
                  <View style={{ justifyContent: 'flex-end' }}>
                    <Text
                      variant="bodyMedium"
                      style={{
                        color: theme.colors.secondary,
                        fontWeight: 'bold',
                      }}
                    >
                      {formatCurrency(p.revenue)}
                    </Text>
                    <Text variant="labelMedium" style={{ textAlign: 'right' }}>
                      {p.qty} sold
                    </Text>
                  </View>
                </View>
              ))
          ) : (
            <View style={styles.noActivityContainer}>
              <PeperIcon
                source="package-variant"
                size={48}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="bodyLarge"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                No product data available
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Recent Activity */}
      <Card
        style={[styles.activityCard, { backgroundColor: theme.colors.surface }]}
      >
        <Card.Content>
          <Text
            variant="titleMedium"
            style={[styles.activityTitle, { color: theme.colors.onSurface }]}
          >
            Recent Invoice Activity
          </Text>
          <Divider
            style={[styles.divider, { backgroundColor: theme.colors.outline }]}
          />

          {recentActivity.length > 0 ? (
            recentActivity.map((invoice, index) => (
              <TouchableOpacity
                activeOpacity={0.8}
                key={invoice._id}
                style={styles.activityItem}
                onPress={() =>
                  navigation.navigate('InvoiceDetail', {
                    invoiceId: invoice?._id,
                  })
                }
              >
                <View style={styles.activityLeft}>
                  <View
                    style={[
                      styles.activityIcon,
                      {
                        backgroundColor:
                          invoice.paymentStatus === 'paid'
                            ? '#4CAF50'
                            : '#FF5722',
                      },
                    ]}
                  >
                    <Icon
                      name={
                        invoice.paymentStatus === 'paid'
                          ? 'check'
                          : 'clock-outline'
                      }
                      size={16}
                      color="white"
                    />
                  </View>
                  <View style={styles.activityContent}>
                    <Text
                      variant="titleMedium"
                      style={{
                        color: theme.colors.onSurface,
                        fontWeight: 'bold',
                      }}
                    >
                      {invoice.invoiceNumber}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {invoice.customerName || 'Unknown Customer'}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {formatDistanceToNow(new Date(invoice.createdAt), {
                        addSuffix: true,
                      })}
                    </Text>
                  </View>
                </View>
                <View style={styles.activityRight}>
                  <Text
                    variant="titleMedium"
                    style={{ color: theme.colors.primary, fontWeight: 'bold' }}
                  >
                    ₹{Number(invoice.grandTotal).toLocaleString()}
                  </Text>
                  <Chip
                    mode="outlined"
                    compact
                    style={{
                      backgroundColor:
                        invoice.paymentStatus === 'paid'
                          ? '#E8F5E8'
                          : '#FFEBEE',
                      borderColor:
                        invoice.paymentStatus === 'paid'
                          ? '#4CAF50'
                          : '#FF5722',
                    }}
                    textStyle={{
                      color:
                        invoice.paymentStatus === 'paid'
                          ? '#4CAF50'
                          : '#FF5722',
                      fontSize: 10,
                    }}
                  >
                    {invoice.paymentStatus.toUpperCase()}
                  </Chip>
                </View>
                {index < recentActivity.length - 1 && (
                  <Divider
                    style={[
                      styles.activityDivider,
                      { backgroundColor: theme.colors.outline },
                    ]}
                  />
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.noActivityContainer}>
              <PeperIcon
                source="invoice-outline"
                size={48}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="bodyLarge"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
              >
                No recent activity
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Bottom padding for better scrolling */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  headerSurface: {
    marginBottom: 16,
    borderRadius: 0,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    marginBottom: 12,
    elevation: 3,
    borderRadius: 12,
  },
  metricContent: {
    paddingVertical: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  metricValue: {
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 4,
    fontSize: 20,
  },
  chartCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    elevation: 3,
    borderRadius: 12,
    overflow: 'hidden', // Prevent overflow
  },
  fullChart: {
    marginHorizontal: 16,
    marginBottom: 20,
    elevation: 3,
    borderRadius: 12,
    overflow: 'hidden', // Prevent overflow
  },
  chartCardContent: {
    // paddingHorizontal: 20, // Increased horizontal padding
    paddingVertical: 16,
  },
  chartHeader: {
    marginBottom: 12,
    alignItems: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    paddingVertical: 6,
    // paddingHorizontal: 10, // Additional padding around chart
    overflow: 'hidden', // Prevent chart overflow
  },
  lineChartContainer: {
    alignItems: 'center',
    paddingVertical: 6,
    // paddingHorizontal: 10, // Additional padding around line chart
    overflow: 'hidden', // Prevent chart overflow
  },
  chartNote: {
    textAlign: 'center',
    marginTop: 15,
    fontStyle: 'italic',
  },
  chartTitle: {
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  pieChartWrapper: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  centerLabel: {
    alignItems: 'center',
  },
  legendContainer: {
    marginTop: 24,
    alignSelf: 'stretch',
    paddingHorizontal: 20,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  noDataContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },

  activityCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    elevation: 3,
    borderRadius: 12,
  },
  activityTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  divider: {
    marginBottom: 16,
  },
  activityItem: {
    paddingVertical: 12,
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityRight: {
    alignItems: 'flex-end',
    position: 'absolute',
    right: 0,
    top: 12,
  },
  activityDivider: {
    marginTop: 12,
  },
  noActivityContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  bottomPadding: {
    height: 20,
  },
});

export default Dashboard;
