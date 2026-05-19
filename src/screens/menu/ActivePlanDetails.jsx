import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ScrollView } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Text,
  Card,
  Icon,
  useTheme,
  ActivityIndicator,
  Chip,
  Divider,
} from 'react-native-paper';
import Navbar from '../../components/Navbar';
import api from '../../utils/api';
 
const ActivePlanDetails = () => {
  const bottom = useSafeAreaInsets().bottom;
  const theme = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
 
  const fetchSubscriptionHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/subscription/subscription-history');
      if (res?.success && res?.data) {
        setData(res.data);
      }
    } catch (error) {
      console.log('Fetch Subscription History Error:', error.message);
    } finally {
      setLoading(false);
    }
  };
 
  useEffect(() => {
    fetchSubscriptionHistory();
  }, []);
 
  const formatDate = dateStr => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };
 
  const formatDateTime = dateStr => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return (
      d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }) +
      ' · ' +
      d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    );
  };
 
  const getDaysRemaining = endDate => {
    if (!endDate) return 0;
    const diff = new Date(endDate) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };
 
  const getPlanColor = planName => {
    switch (planName?.toLowerCase()) {
      case 'free':
        return theme.colors.onSurfaceVariant;
      case 'basic':
        return theme.colors.primary;
      case 'premium':
      case 'pro':
        return '#FFD700';
      default:
        return theme.colors.primary;
    }
  };
 
  const getStatusColor = status => {
    switch (status?.toLowerCase()) {
      case 'active':
        return '#4CAF50';
      case 'expired':
        return theme.colors.error;
      case 'pending':
        return '#FF9800';
      default:
        return theme.colors.onSurfaceVariant;
    }
  };
 
  const getPaymentStatusColor = status => {
    switch (status?.toLowerCase()) {
      case 'success':
        return '#4CAF50';
      case 'failed':
        return theme.colors.error;
      case 'pending':
        return '#FF9800';
      default:
        return theme.colors.onSurfaceVariant;
    }
  };
 
  // ── Current Plan Card ─────────────────────────────────────────────────────
  const CurrentPlanCard = ({ plan }) => {
    if (!plan) return null;
    const daysLeft = getDaysRemaining(plan.endDate);
    const planColor = getPlanColor(plan.planName);
    const totalDays = plan.durationDays || 30;
    const progressPercent = Math.min(100, Math.round((daysLeft / totalDays) * 100));
 
    return (
      <Card
        mode="outlined"
        style={[styles.card, { borderColor: planColor, borderWidth: 1.5 }]}
        contentStyle={styles.cardContent}
      >
        {/* Plan Header */}
        <View style={styles.planHeader}>
          <View style={styles.planTitleRow}>
            <Icon source="crown" size={22} color={planColor} />
            <Text style={[styles.planName, { color: planColor }]}>
              {plan.planName} Plan
            </Text>
          </View>
          <Text
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(plan.status) },
            ]}
          >
            {plan.status?.toUpperCase()}
          </Text>
        </View>
 
        <Divider style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
 
        {/* Price + Duration Row */}
        <View style={styles.priceRow}>
          <View style={styles.priceBlock}>
            <Text style={[styles.priceLabel, { color: theme.colors.onSurfaceVariant }]}>
              Plan Price
            </Text>
            <Text style={[styles.priceValue, { color: theme.colors.onSurface }]}>
              ₹{plan.price}
              <Text style={[styles.priceSuffix, { color: theme.colors.onSurfaceVariant }]}>
                /{plan.durationDays}d
              </Text>
            </Text>
          </View>
          <View style={styles.priceBlock}>
            <Text style={[styles.priceLabel, { color: theme.colors.onSurfaceVariant }]}>
              Invoice Limit
            </Text>
            <Text style={[styles.priceValue, { color: theme.colors.onSurface }]}>
              {plan.usageLimits?.unlimited ? '∞ Unlimited' : plan.usageLimits?.invoices}
            </Text>
          </View>
          <View style={styles.priceBlock}>
            <Text style={[styles.priceLabel, { color: theme.colors.onSurfaceVariant }]}>
              Days Left
            </Text>
            <Text
              style={[
                styles.priceValue,
                { color: daysLeft <= 7 ? theme.colors.error : '#4CAF50' },
              ]}
            >
              {daysLeft}d
            </Text>
          </View>
        </View>
 
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: daysLeft <= 7 ? theme.colors.error : planColor,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
            {progressPercent}% remaining
          </Text>
        </View>
 
        {/* Date Row */}
        <View style={styles.dateRow}>
          <View style={styles.dateBlock}>
            <Icon source="calendar-start" size={13} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.dateLabel, { color: theme.colors.onSurfaceVariant }]}>
              Start: {formatDate(plan.startDate)}
            </Text>
          </View>
          <View style={styles.dateBlock}>
            <Icon source="calendar-end" size={13} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.dateLabel, { color: theme.colors.onSurfaceVariant }]}>
              End: {formatDate(plan.endDate)}
            </Text>
          </View>
        </View>
      </Card>
    );
  };
 
  // ── Plan History Card ─────────────────────────────────────────────────────
  const PlanHistoryCard = ({ plan, index }) => {
    const planColor = getPlanColor(plan.planName);
    return (
      <Card
        mode="outlined"
        style={styles.card}
        contentStyle={styles.cardContent}
      >
        <View style={styles.historyHeader}>
          <View style={styles.planTitleRow}>
            <Icon source="crown-outline" size={16} color={planColor} />
            <Text style={[styles.historyPlanName, { color: theme.colors.onSurface }]}>
              {plan.planName} Plan
            </Text>
          </View>
          <Text
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(plan.status) },
            ]}
          >
            {plan.status?.toUpperCase()}
          </Text>
        </View>
 
        <View style={styles.historyDetails}>
          <View style={styles.infoItem}>
            <Icon source="currency-inr" size={12} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
              ₹{plan.price} · {plan.durationDays} days
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Icon source="calendar-range" size={12} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
              {formatDate(plan.startDate)} → {formatDate(plan.endDate)}
            </Text>
          </View>
        </View>
      </Card>
    );
  };
 
  // ── Payment Card ──────────────────────────────────────────────────────────
  const PaymentCard = ({ payment }) => (
    <Card
      mode="outlined"
      style={styles.card}
      contentStyle={styles.cardContent}
    >
      <View style={styles.paymentHeader}>
        <View style={styles.planTitleRow}>
          <Icon
            source="credit-card-outline"
            size={18}
            color={theme.colors.primary}
          />
          <Text style={[styles.paymentMethod, { color: theme.colors.onSurface }]}>
            {payment.method || 'Payment'}
          </Text>
        </View>
        <Text
          style={[
            styles.statusBadge,
            { backgroundColor: getPaymentStatusColor(payment.status) },
          ]}
        >
          {payment.status?.toUpperCase()}
        </Text>
      </View>
 
      <Divider style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
 
      <View style={styles.paymentDetails}>
        <View style={styles.paymentAmountRow}>
          <Text style={[styles.paymentAmountLabel, { color: theme.colors.onSurfaceVariant }]}>
            Amount Paid
          </Text>
          <Text style={[styles.paymentAmount, { color: '#4CAF50' }]}>
            ₹{payment.amount?.toFixed(2)}
          </Text>
        </View>
 
        <View style={styles.infoItem}>
          <Icon source="identifier" size={12} color={theme.colors.onSurfaceVariant} />
          <Text
            style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            {payment.transactionId}
          </Text>
        </View>
 
        <View style={styles.infoItem}>
          <Icon source="clock-outline" size={12} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
            {formatDateTime(payment.paidAt || payment.createdAt)}
          </Text>
        </View>
 
        {payment.walletUsed > 0 && (
          <View style={styles.infoItem}>
            <Icon source="wallet-outline" size={12} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
              Wallet used: ₹{payment.walletUsed}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
 
  // ── Section Header ────────────────────────────────────────────────────────
  const SectionHeader = ({ icon, title }) => (
    <View style={styles.sectionHeader}>
      <Icon source={icon} size={18} color={theme.colors.primary} />
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        {title}
      </Text>
    </View>
  );
 
  if (loading) {
    return (
      <>
        <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.background }} />
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <Navbar title="Plan Details" />
          <View style={{ marginTop: 40 }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        </View>
      </>
    );
  }
 
  return (
    <>
      <SafeAreaView
        edges={['top']}
        style={{ backgroundColor: theme.colors.background }}
      />
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Navbar title="Plan Details" />
 
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 24 + bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Current Plan ── */}
          <SectionHeader icon="crown" title="Current Plan" />
          {data?.currentPlan ? (
            <CurrentPlanCard plan={data.currentPlan} />
          ) : (
            <Card mode="outlined" style={styles.card} contentStyle={styles.cardContent}>
              <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                No active plan found
              </Text>
            </Card>
          )}
 
          {/* ── Payment History ── */}
          {data?.payments?.length > 0 && (
            <>
              <SectionHeader icon="receipt" title="Payment History" />
              {data.payments.map(payment => (
                <PaymentCard key={payment._id} payment={payment} />
              ))}
            </>
          )}
 
          {/* ── Previous Plans ── */}
          {data?.previousPlans?.length > 0 && (
            <>
              <SectionHeader icon="history" title="Previous Plans" />
              {data.previousPlans.map((plan, index) => (
                <PlanHistoryCard key={plan._id} plan={plan} index={index} />
              ))}
            </>
          )}
 
          {/* ── Upcoming Plans ── */}
          {data?.upcomingPlans?.length > 0 && (
            <>
              <SectionHeader icon="calendar-clock" title="Upcoming Plans" />
              {data.upcomingPlans.map((plan, index) => (
                <PlanHistoryCard key={plan._id} plan={plan} index={index} />
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
};
 
const styles = StyleSheet.create({
  scrollContent: {
    padding: 12,
  },
 
  // ── Section Header ────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
 
  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    borderRadius: 12,
    marginBottom: 10,
    marginHorizontal: 4,
  },
  cardContent: {
    padding: 14,
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
 
  // ── Current Plan ──────────────────────────────────────────────────────────
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planName: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceBlock: {
    alignItems: 'center',
    flex: 1,
  },
  priceLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  priceSuffix: {
    fontSize: 11,
    fontWeight: '400',
  },
  progressContainer: {
    marginBottom: 12,
    gap: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    textAlign: 'right',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateLabel: {
    fontSize: 11,
  },
 
  // ── History Card ──────────────────────────────────────────────────────────
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyPlanName: {
    fontSize: 14,
    fontWeight: '600',
  },
  historyDetails: {
    gap: 4,
  },
 
  // ── Payment Card ──────────────────────────────────────────────────────────
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentMethod: {
    fontSize: 14,
    fontWeight: '600',
  },
  paymentDetails: {
    gap: 5,
  },
  paymentAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  paymentAmountLabel: {
    fontSize: 12,
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
 
  // ── Shared ────────────────────────────────────────────────────────────────
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoText: {
    fontSize: 11,
    flexShrink: 1,
  },
});
 
export default ActivePlanDetails;