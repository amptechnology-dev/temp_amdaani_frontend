import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Card,
  Text,
  Button,
  Divider,
  useTheme,
  SegmentedButtons,
  Chip,
  Surface,
  IconButton,
} from 'react-native-paper';
import Navbar from '../../components/Navbar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import api from '../../utils/api';
import Toast from 'react-native-toast-message';
import { differenceInDays, format } from 'date-fns';
import { PricingCardSkeleton } from '../../components/Skeletons';
import { useAuth, permissions } from '../../context/AuthContext';
import NoPermission from '../../components/NoPermission';

// Modern Plan Card Component with Enhanced Design
const PlanCard = ({
  plan,
  selectedPlan,
  isExpiredLastPlan,
  onToggle,
  onGetPlan,
  onRenewPlan,
  onFreePlan,
  usage,
  theme,
  currentSubscription,
}) => {
  const isExpanded = selectedPlan === plan.name;
  const isCurrentPlan = plan.isCurrentPlan;
  const isPremiumPlan = plan.name === 'Standard';

  // Calculate days left for active subscription (if this plan is the current one)
  let daysLeft = null;
  if (isCurrentPlan && currentSubscription) {
    const end =
      currentSubscription.endDate ||
      currentSubscription.expiresAt ||
      currentSubscription.planEndDate;
    if (end) {
      try {
        const endDateObj = new Date(end);
        daysLeft = differenceInDays(endDateObj, new Date());
      } catch (e) {
        daysLeft = null;
      }
    }
  }

  return (
    <Card
      key={plan._id}
      mode="elevated"
      elevation={isCurrentPlan ? 5 : isExpanded ? 3 : 1}
      style={[
        styles.card,
        {
          borderColor: isCurrentPlan ? theme.colors.primary : 'transparent',
          borderWidth: isCurrentPlan ? 2 : 0,
          backgroundColor: isCurrentPlan
            ? theme.colors.primaryContainer
            : theme.colors.surface,
          transform: [{ scale: isExpanded ? 1 : 0.98 }],
        },
      ]}
      onPress={() => !isCurrentPlan && onToggle(plan.name)}
    >
      {/* Premium Badge */}
      {isPremiumPlan && (
        <View
          style={[
            styles.premiumBanner,
            { backgroundColor: theme.colors.primary },
          ]}
        >
          <Text variant="labelSmall" style={styles.premiumBannerText}>
            ⭐ MOST POPULAR
          </Text>
        </View>
      )}

      <Card.Content style={styles.cardContent}>
        {/* Plan Header */}
        <View style={styles.planHeader}>
          <View style={styles.planTitleContainer}>
            <Text
              variant="headlineSmall"
              style={[styles.planName, { color: theme.colors.onSurface }]}
            >
              {plan.name}
            </Text>

            {isCurrentPlan && (
              <Chip
                mode="flat"
                style={[
                  styles.currentChip,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
                textStyle={{
                  color: theme.colors.onPrimaryContainer,
                  fontSize: 11,
                  fontWeight: 'bold',
                }}
                icon="check-circle"
              >
                ACTIVE
              </Chip>
            )}
          </View>

          {plan.description && (
            <Text
              variant="bodyMedium"
              style={[
                styles.planDescription,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {plan.description}
            </Text>
          )}
        </View>

        {/* Pricing Section */}
        <Surface
          style={[
            styles.pricingSurface,
            {
              backgroundColor: isCurrentPlan
                ? theme.colors.surface
                : theme.colors.primaryContainer,
            },
          ]}
          elevation={0}
        >
          <View style={styles.priceRow}>
            <View style={styles.priceMain}>
              <View>
                <Text
                  variant="displaySmall"
                  style={[styles.priceAmount, { color: theme.colors.primary }]}
                >
                  ₹{plan.price}
                </Text>
                <Text
                  style={[
                    { color: theme.colors.onSurfaceVariant, fontSize: 8 },
                  ]}
                >
                  Excluding GST
                </Text>
              </View>
              {plan.durationDays > 0 && (
                <Text
                  variant="bodySmall"
                  style={[
                    styles.pricePeriod,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  /{plan.durationDays} days
                </Text>
              )}
            </View>

            {/* Show days left for active plan on the right */}
            {isCurrentPlan && daysLeft !== null ? (
              <Text
                variant="bodySmall"
                style={[
                  styles.daysLeftText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {daysLeft >= 0
                  ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
                  : 'Expiring soon'}
              </Text>
            ) : /* Fallback: preserve previous per-month display if needed (kept commented) */ null}
          </View>
        </Surface>

        {/* Usage Limits */}
        {plan.usageLimits && (
          <Surface style={styles.usageSurface} elevation={0}>
            <View
              style={[
                styles.usageInner,
                {
                  backgroundColor: theme.colors.secondaryContainer,
                  borderRadius: 12,
                },
              ]}
            >
              <View style={styles.usageRow}>
                <View style={{ flex: 1, padding: 12 }}>
                  <Text
                    variant="labelLarge"
                    style={[
                      styles.usageText,
                      { color: theme.colors.onSecondaryContainer },
                    ]}
                  >
                    📊{' '}
                    {isCurrentPlan &&
                    currentSubscription?.usageLimits?.unlimited
                      ? 'Unlimited invoices'
                      : isCurrentPlan &&
                        currentSubscription?.usageLimits?.invoices !== undefined
                      ? `${currentSubscription.usageLimits.invoices} invoices`
                      : plan.usageLimits.unlimited
                      ? 'Unlimited invoices'
                      : `${plan.usageLimits.invoices} invoices`}
                  </Text>

                  {/* Show top-up info if available */}
                  {isCurrentPlan &&
                    currentSubscription?.topUps &&
                    currentSubscription.topUps.length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        <Text
                          variant="labelSmall"
                          style={[
                            styles.topupText,
                            { color: theme.colors.onSecondaryContainer },
                          ]}
                        >
                          🎁 Top-up: +
                          {currentSubscription.topUps.reduce(
                            (sum, topup) => sum + topup.usageLimits.invoices,
                            0,
                          )}{' '}
                          invoices
                        </Text>
                        <Text
                          variant="labelSmall"
                          style={[
                            styles.totalText,
                            {
                              color: theme.colors.onTertiaryContainer,
                              fontWeight: 'bold',
                            },
                          ]}
                        >
                          Total: {currentSubscription.usageLimits.invoices}{' '}
                          invoices
                        </Text>
                      </View>
                    )}
                </View>

                {isCurrentPlan && plan.usageLimits.unlimited !== true && (
                  <Chip
                    mode="flat"
                    compact
                    style={{ backgroundColor: theme.colors.secondaryContainer }}
                    textStyle={{
                      color: theme.colors.onTertiaryContainer,
                      fontSize: 10,
                      fontWeight: '600',
                    }}
                  >
                    {(currentSubscription?.usageLimits?.invoices ||
                      plan.usageLimits.invoices) -
                      (usage?.invoicesUsed || 0)}{' '}
                    left
                  </Chip>
                )}
              </View>
            </View>
          </Surface>
        )}

        {/* Expandable Features Section */}
        {isExpanded &&
          plan.featuresDetails &&
          plan.featuresDetails.length > 0 && (
            <View style={styles.featuresContainer}>
              <Divider
                style={[
                  styles.featuresDivider,
                  { backgroundColor: theme.colors.outlineVariant },
                ]}
              />

              <Text
                variant="titleMedium"
                style={[
                  styles.featuresTitle,
                  { color: theme.colors.onSurface },
                ]}
              >
                What's included
              </Text>

              <View style={styles.featuresList}>
                {plan.featuresDetails.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <View
                      style={[
                        styles.featureIconContainer,
                        {
                          backgroundColor: feature.available
                            ? theme.colors.primaryContainer
                            : theme.colors.errorContainer,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.featureIcon,
                          {
                            color: feature.available
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.error,
                          },
                        ]}
                      >
                        {feature.available ? '✓' : '✗'}
                      </Text>
                    </View>

                    <View style={styles.featureTextContainer}>
                      <Text
                        variant="bodyMedium"
                        style={[
                          styles.featureText,
                          {
                            color: feature.available
                              ? theme.colors.onSurface
                              : theme.colors.error,
                            opacity: feature.available ? 1 : 0.6,
                          },
                        ]}
                      >
                        {feature.name}
                      </Text>
                      {feature.note && (
                        <Text
                          variant="bodySmall"
                          style={[
                            styles.featureNote,
                            { color: theme.colors.onSurfaceVariant },
                          ]}
                        >
                          {feature.note}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>

              {/* Action Button: always show for Free plan (Continue if free active), otherwise show for non-current paid plans */}
              {(plan.name === 'Free' || !isCurrentPlan) && (
                <View style={styles.actionContainer}>
                  {plan.name === 'Free'
                    ? !isCurrentPlan && (
                        <Button
                          mode="contained"
                          style={styles.actionButton}
                          contentStyle={styles.buttonContent}
                          onPress={onFreePlan}
                          buttonColor={theme.colors.primary}
                        >
                          Activate Free Plan
                        </Button>
                      )
                    : !isCurrentPlan && (
                        <Button
                          mode={isExpanded ? 'contained' : 'outlined'}
                          style={styles.actionButton}
                          contentStyle={[
                            styles.buttonContent,
                            { flexDirection: 'row-reverse' },
                          ]}
                          buttonColor={
                            isPremiumPlan
                              ? theme.colors.primary
                              : theme.colors.secondary
                          }
                          icon="arrow-right"
                          onPress={() => {
                            if (isExpiredLastPlan) {
                              onRenewPlan(plan);
                            } else {
                              onGetPlan(plan);
                            }
                          }}
                        >
                          {isExpiredLastPlan ? 'Renew' : `Get ${plan.name}`}
                        </Button>
                      )}
                </View>
              )}
            </View>
          )}

        {/* Collapsed State - Show expand hint */}
        {!isExpanded && !isCurrentPlan && (
          <View style={styles.expandHint}>
            <Text
              variant="labelSmall"
              style={[styles.expandHintText, { color: theme.colors.primary }]}
            >
              Tap to see details
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

// Compact TopUp Card Component
const TopUpCard = ({ plan, onGetPlan, theme }) => {
  return (
    <Card
      mode="elevated"
      elevation={1}
      style={[
        styles.topupCard,
        { backgroundColor: theme.colors.elevation.level1 },
      ]}
    >
      <Card.Content style={styles.topupCardContent}>
        <View style={styles.topupRow}>
          {/* Left Section - Plan Info */}
          <View style={styles.topupLeft}>
            <View style={styles.topupHeader}>
              <Text
                variant="titleMedium"
                style={[styles.topupName, { color: theme.colors.onSurface }]}
              >
                {plan.name}
              </Text>
              {/* <Chip
                mode="flat"
                compact
                style={[styles.topupBadge, { backgroundColor: theme.colors.tertiaryContainer }]}
                textStyle={{ color: theme.colors.onTertiaryContainer, fontSize: 10, fontWeight: 'bold' }}
                icon="plus-circle"
              >
                TOP-UP
              </Chip> */}
            </View>

            <View style={styles.topupDetails}>
              <Text
                variant="bodyLarge"
                style={[styles.topupInvoices, { color: theme.colors.primary }]}
              >
                +{plan.usageLimits.invoices} invoices
              </Text>
              <Text
                variant="bodySmall"
                style={[
                  styles.topupPrice,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Valid until plan expiry
              </Text>
            </View>
          </View>

          {/* Right Section - Price & Action */}
          <View style={styles.topupRight}>
            <Surface
              style={[
                styles.topupPriceSurface,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
              elevation={0}
            >
              <Text
                variant="headlineSmall"
                style={[
                  styles.topupPriceAmount,
                  { color: theme.colors.onPrimaryContainer },
                ]}
              >
                ₹{plan.price}
              </Text>
            </Surface>

            <Button
              mode="contained"
              compact
              style={styles.topupButton}
              contentStyle={styles.topupButtonContent}
              onPress={() => onGetPlan(plan)}
              buttonColor={theme.colors.tertiary}
              icon="cart-plus"
            >
              Add
            </Button>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};

// New Upcoming Subscription Card Component
const UpcomingCard = ({ upcoming, theme }) => {
  if (!upcoming) return null;

  const plan = upcoming.plan || {};
  const usage =
    upcoming.baseUsageLimits || upcoming.usageLimits || plan.usageLimits || {};
  const startDateObj = upcoming.startDate ? new Date(upcoming.startDate) : null;
  const endDateObj = upcoming.endDate ? new Date(upcoming.endDate) : null;

  const startDate = startDateObj ? format(startDateObj, 'dd MMM yyyy') : '-';
  const endDate = endDateObj ? format(endDateObj, 'dd MMM yyyy') : '-';

  // Calculate time left
  const today = new Date();
  const daysLeftToStart = startDateObj
    ? differenceInDays(startDateObj, today)
    : null;
  const daysLeftToExpire = endDateObj
    ? differenceInDays(endDateObj, today)
    : null;

  // Determine label (starts in X days or expires in X days)
  const statusLabel =
    daysLeftToStart > 0
      ? `Starts in ${daysLeftToStart} days`
      : daysLeftToExpire > 0
      ? `Expires in ${daysLeftToExpire} days`
      : 'Pending activation';

  return (
    <Surface
      mode="elevated"
      style={[
        styles.upcomingCardModern,
        {
          backgroundColor: theme.colors.primaryContainer,
          borderColor: theme.colors.primary,
        },
      ]}
      elevation={2}
    >
      {/* Header Row */}
      <View style={styles.upcomingHeaderModern}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text
            variant="titleMedium"
            style={[styles.upcomingPlanName, { color: theme.colors.onSurface }]}
          >
            {plan.name || upcoming.planName}
          </Text>
          <Chip
            mode="flat"
            compact
            style={[
              styles.upcomingChipModern,
              // { backgroundColor: theme.colors.primaryContainer },
            ]}
            textStyle={{
              color: theme.colors.onPrimaryContainer,
              fontSize: 12,
              fontWeight: '600',
            }}
            icon="clock-outline"
          >
            Upcoming
          </Chip>
        </View>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant, fontWeight: '500' }}
        >
          {statusLabel}
        </Text>
      </View>

      {/* Plan Details */}
      <View style={styles.upcomingDetailsModern}>
        <View style={{ flex: 1 }}>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {usage.unlimited
              ? 'Unlimited invoices'
              : `${usage.invoices || '-'} invoices`}
          </Text>
          {plan.description && (
            <Text
              variant="bodySmall"
              style={{
                color: theme.colors.onSurfaceVariant,
                marginTop: 4,
                opacity: 0.8,
              }}
            >
              {plan.description}
            </Text>
          )}
        </View>

        <Surface
          style={[
            styles.upcomingPriceModern,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
          elevation={0}
        >
          <Text
            variant="titleMedium"
            style={{
              color: theme.colors.onPrimaryContainer,
              fontWeight: '700',
            }}
          >
            ₹{upcoming.price || plan.price}
          </Text>
          {/* <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer, opacity: 0.8 }}>
            {startDate}
          </Text> */}
        </Surface>
      </View>

      {/* Footer Dates */}
      <View style={styles.upcomingFooterModern}>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          Starts: {startDate}
        </Text>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          Ends: {endDate}
        </Text>
      </View>
    </Surface>
  );
};

// Plans List Component
const PlansList = ({
  plans,
  selectedPlan,
  selectedPlanName,
  lastSubscription,
  onToggle,
  onGetPlan,
  onRenewPlan,
  onFreePlan,
  usage,
  theme,
  currentSubscription,
}) => {
  return (
    <>
      {plans.map(plan => {
        // If this is an upcoming placeholder inserted into the list
        if (plan && plan.upcoming) {
          return (
            <UpcomingCard
              key={
                plan._id ||
                'upcoming-' + (plan.upcomingData && plan.upcomingData._id) ||
                'upcoming'
              }
              upcoming={plan.upcomingData}
              theme={theme}
            />
          );
        }

        // Use compact card for top-up plans
        if (plan.planType === 'topup') {
          return (
            <TopUpCard
              key={plan._id}
              plan={plan}
              onGetPlan={onGetPlan}
              theme={theme}
            />
          );
        }

        // Use regular card for subscription plans
        return (
          <PlanCard
            key={plan._id}
            plan={plan}
            selectedPlan={selectedPlan}
            isExpiredLastPlan={
              !currentSubscription &&
              lastSubscription?.planName === plan.name &&
              lastSubscription?.status === 'expired'
            }
            onGetPlan={onGetPlan}
            onRenewPlan={onRenewPlan}
            onToggle={onToggle}
            onFreePlan={onFreePlan}
            usage={usage}
            theme={theme}
            currentSubscription={currentSubscription}
          />
        );
      })}
    </>
  );
};

const PricingCard = ({
  onPlanActivated,
  isNavBar = true,
  topUp = true,
  freePlanActive = false,
}) => {
  const [selectedPlan, setSelectedPlan] = useState('Free');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [usage, setUsage] = useState(null);
  const [activeTab, setActiveTab] = useState('regular');
  const [upcomingSubscription, setUpcomingSubscription] = useState(null);
  const [lastSubscription, setLastSubscription] = useState(null);

  const theme = useTheme();
  const navigation = useNavigation();

  const { hasPermission } = useAuth();

  const activeSub = currentSubscription;
  const lastSub = lastSubscription;

  const selectedPlanName = activeSub ? activeSub.planName : lastSub?.planName;

  const handleRenewPlan = plan => {
    navigation.replace('ReviewOrder', {
      plan,
      isRenew: true,
      fromOnboarding: true,
      onSuccess: () => onPlanActivated?.(),
    });
  };

  if (!hasPermission(permissions.CAN_MANAGE_SUBSCRIPTIONS)) {
    // optional: show navbar if you still want it visible when blocked
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        {isNavBar && <Navbar title="Choose Your Plan" />}
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <NoPermission />
        </View>
      </SafeAreaView>
    );
  }

  // Define colors for different plans
  const planColors = {
    Free: theme.colors.primary,
    Basic: theme.colors.secondary,
    Standard: theme.colors.tertiary,
    Premium: theme.colors.primary,
    Gold: theme.colors.primary,
    Silver: theme.colors.secondary,
    'TopUp Lite': theme.colors.tertiary,
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setSubscriptionLoading(true);

        // First: Fetch active subscription
        const subscriptionResponse = await api.get(
          '/subscription/get-active-subscriptions',
        );
        console.log('subscriptionResponse', subscriptionResponse);

        if (
          subscriptionResponse.success &&
          subscriptionResponse.data &&
          subscriptionResponse.data.subscription
        ) {
          setCurrentSubscription(subscriptionResponse.data.subscription);
          setUsage(subscriptionResponse.data.usage);
          // console.log('Usage : ', usage?.invoicesUsed);
        } else {
          setCurrentSubscription(null);
          // console.log('No active subscription found');
        }

        setSubscriptionLoading(false);

        // Try to fetch last subscription (used to decide whether to show Free plan)
        try {
          const lastResp = await api.get('/subscription/get-last-subscription');
          console.log('lastResp', lastResp);
          if (lastResp.success && lastResp.data) {
            setLastSubscription(lastResp.data);
          }
        } catch (lsErr) {
          console.error('Error fetching last subscription:', lsErr);
          setLastSubscription(null);
        }

        // Add setTimeout before fetching plans
        setTimeout(async () => {
          try {
            // Second: Fetch all available plans
            const plansResponse = await api.get('/plan/active');
            console.log('plansResponse', plansResponse);

            if (plansResponse.success && plansResponse.data) {
              // Transform API data to match component structure
              const transformedPlans = plansResponse.data.map(plan => ({
                _id: plan._id,
                name: plan.name,
                description: plan.description,
                originalPrice: `₹${plan.price}`,
                discountedPrice: `₹${plan.price}`,
                monthlyPrice: `₹${(
                  plan.price /
                  (plan.durationDays / 30)
                ).toFixed(2)} per month`,
                price: plan.price,
                currency: plan.currency,
                durationDays: plan.durationDays,
                features: plan.features.map(feature => feature.name),
                featuresIncluded: plan.features.map(
                  feature => feature.available,
                ),
                featuresDetails: plan.features,
                usageLimits: plan.usageLimits,
                planType: plan.planType,
                color: planColors[plan.name] || theme.colors.primary,
                isCurrentPlan:
                  subscriptionResponse.data?.subscription &&
                  subscriptionResponse.data.subscription.plan &&
                  plan._id === subscriptionResponse.data.subscription.plan._id,
                isActive: plan.isActive,
              }));

              setPlans(transformedPlans);

              // Fetch upcoming subscriptions and set the first upcoming (if any)
              try {
                const upcomingResp = await api.get(
                  '/subscription/get-upcoming-subscriptions',
                );
                if (
                  upcomingResp.success &&
                  upcomingResp.data &&
                  upcomingResp.data.length > 0
                ) {
                  // Take the first upcoming subscription
                  setUpcomingSubscription(upcomingResp.data[0]);
                } else {
                  setUpcomingSubscription(null);
                }
              } catch (uErr) {
                console.error('Error fetching upcoming subscriptions:', uErr);
                setUpcomingSubscription(null);
              }

              // Set default selected plan to current user's plan or first available plan
              const userPlan = transformedPlans.find(
                plan => plan.isCurrentPlan,
              );

              if (userPlan) {
                setSelectedPlan(userPlan.name);
                setActiveTab(userPlan.planType || 'regular');
              } else if (transformedPlans.length > 0) {
                setSelectedPlan(transformedPlans[0].name);
              }
            }
          } catch (error) {
            console.error('Error fetching plans:', error);
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: 'Failed to load plans',
            });
          } finally {
            setLoading(false);
          }
        }, 2000);
      } catch (error) {
        console.error('Error fetching subscription:', error);
        setSubscriptionLoading(false);
        Toast.show({
          type: 'error',
          text1: 'Subscription Required',
          text2: 'No Active Subscription Found',
        });

        setTimeout(async () => {
          try {
            const plansResponse = await api.get('/plan/active');
            if (plansResponse.success && plansResponse.data) {
              const transformedPlans = plansResponse.data.map(plan => ({
                _id: plan._id,
                name: plan.name,
                description: plan.description,
                originalPrice: `₹${plan.price}`,
                discountedPrice: `₹${plan.price}`,
                monthlyPrice: `₹${(
                  plan.price /
                  (plan.durationDays / 30)
                ).toFixed(2)} per month`,
                price: plan.price,
                currency: plan.currency,
                durationDays: plan.durationDays,
                features: plan.features.map(feature => feature.name),
                featuresIncluded: plan.features.map(
                  feature => feature.available,
                ),
                featuresDetails: plan.features,
                usageLimits: plan.usageLimits,
                planType: plan.planType,
                color: planColors[plan.name] || theme.colors.primary,
                isCurrentPlan: false,
                isActive: plan.isActive,
              }));

              setPlans(transformedPlans);

              // Also try to fetch upcoming subscriptions even when no active subscription
              try {
                const upcomingResp = await api.get(
                  '/subscription/get-upcoming-subscriptions',
                );
                if (
                  upcomingResp.success &&
                  upcomingResp.data &&
                  upcomingResp.data.length > 0
                ) {
                  setUpcomingSubscription(upcomingResp.data[0]);
                } else {
                  setUpcomingSubscription(null);
                }
              } catch (uErr) {
                console.error(
                  'Error fetching upcoming subscriptions (no active):',
                  uErr,
                );
                setUpcomingSubscription(null);
              }

              if (transformedPlans.length > 0) {
                setSelectedPlan(transformedPlans[0].name);
              }
            }
          } catch (planError) {
            console.error(
              'Error fetching plans after subscription failure:',
              planError,
            );
          } finally {
            setLoading(false);
          }
        }, 1000);
      }
    };

    fetchData();
  }, []);

  const handleFreePlan = async () => {
    try {
      const response = await api.post('/subscription/get-free');
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: response.message || 'Free plan activated!',
        });
        onPlanActivated?.();
        // Refresh subscription data
        const subscriptionResponse = await api.get(
          '/subscription/get-active-subscriptions',
        );
        console.log('Subscription API Response:', subscriptionResponse);

        if (
          subscriptionResponse.success &&
          subscriptionResponse.data &&
          subscriptionResponse.data.subscription
        ) {
          setCurrentSubscription(subscriptionResponse.data.subscription);

          // Update plans with current subscription info
          setPlans(prevPlans =>
            prevPlans.map(plan => ({
              ...plan,
              isCurrentPlan:
                subscriptionResponse.data.subscription &&
                subscriptionResponse.data.subscription.plan &&
                plan._id === subscriptionResponse.data.subscription.plan._id,
            })),
          );
        }
      }
    } catch (error) {
      console.error('Error creating free subscription:', error);
    }
  };

  const togglePlan = planName => {
    if (selectedPlan === planName) {
      setSelectedPlan(null);
    } else {
      setSelectedPlan(planName);
    }
  };

  const handleGetPlan = plan => {
    navigation.replace('ReviewOrder', {
      plan: plan,
      fromOnboarding: true,
      onSuccess: () => onPlanActivated?.(),
    });
  };

  // Insert new effect to ensure activeTab isn't 'topup' when topUp prop is false
  useEffect(() => {
    if (!topUp && activeTab === 'topup') {
      setActiveTab('regular');
    }
  }, [topUp, activeTab]);

  // Prepare segmented buttons; omit Top-Up when topUp is false
  // 👇 Hide Top-Up tab if user has NO active paid subscription
  const hasActivePaidPlan =
    currentSubscription &&
    currentSubscription.status === 'active' &&
    currentSubscription.planName &&
    currentSubscription.planName.toLowerCase() !== 'free';

  const segmentedOptions = [
    {
      value: 'regular',
      label: 'Subscription',
      icon: 'package-variant',
      style:
        activeTab === 'regular'
          ? { backgroundColor: theme.colors.primaryContainer }
          : {},
    },
    ...(topUp && hasActivePaidPlan
      ? [
          {
            value: 'topup',
            label: 'Top-Up',
            icon: 'plus-circle-outline',
            style:
              activeTab === 'topup'
                ? { backgroundColor: theme.colors.primaryContainer }
                : {},
          },
        ]
      : []),
  ];

  // Filter and sort plans based on active tab
  const filteredPlans = plans
    .filter(plan => {
      // Filter by plan type (regular or topup)
      if (plan.planType !== activeTab) return false;

      // Hide Free plan if user has an active paid subscription
      if (plan.name === 'Free') {
        if (
          currentSubscription &&
          currentSubscription.status === 'active' &&
          currentSubscription.planName &&
          currentSubscription.planName.toLowerCase() !== 'free'
        ) {
          return false;
        }

        // Also hide Free plan if the user's last subscription (historical) is a paid plan
        if (
          lastSubscription &&
          lastSubscription.planName &&
          lastSubscription.planName.toLowerCase() !== 'free'
        ) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      // 1. Active plan always at top
      if (a.isCurrentPlan && !b.isCurrentPlan) return -1;
      if (!a.isCurrentPlan && b.isCurrentPlan) return 1;

      // 2. Sort non-active plans by price (low to high)
      if (!a.isCurrentPlan && !b.isCurrentPlan) {
        return a.price - b.price;
      }

      // 3. If one is active and we get here, the other should come after
      return 0;
    });

  // Insert upcoming subscription placeholder right after the active plan (if any)
  const displayPlans = React.useMemo(() => {
    // Only show upcoming on the regular (subscription) tab
    if (!upcomingSubscription || activeTab !== 'regular') return filteredPlans;

    const idx = filteredPlans.findIndex(p => p.isCurrentPlan);
    const placeholder = {
      upcoming: true,
      upcomingData: upcomingSubscription,
      _id: upcomingSubscription._id || upcomingSubscription.id || 'upcoming',
    };

    if (idx !== -1) {
      const arr = [...filteredPlans];
      arr.splice(idx + 1, 0, placeholder);
      return arr;
    }

    // If there's no active plan in the filtered list, prepend the upcoming subscription
    return [placeholder, ...filteredPlans];
  }, [filteredPlans, upcomingSubscription, activeTab]);

  // Show skeleton loader when loading
  if (loading || subscriptionLoading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        {isNavBar && <Navbar title="Choose Your Plan" />}
        <ScrollView contentContainerStyle={{ paddingVertical: 16 }}>
          <PricingCardSkeleton count={3} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {isNavBar && (
        <Navbar
          title="Choose Your Plan"
          rightComponent={
            <>
              {isNavBar && hasActivePaidPlan && (
                <IconButton
                  icon="history" // or "receipt" or "file-document-outline"
                  size={24}
                  onPress={() => navigation.navigate('PlanTransactions')}
                />
              )}
            </>
          }
        />
      )}
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Segmented Control for Plan Types */}
        <View style={styles.segmentedContainer}>
          <SegmentedButtons
            value={activeTab}
            onValueChange={setActiveTab}
            buttons={segmentedOptions}
            // density="high"
            style={[
              styles.segmentedButtons,
              { display: topUp && hasActivePaidPlan ? 'flex' : 'none' },
            ]}
          />
        </View>

        {/* Plans List */}
        {/* If user is on Top-Up tab and currently has an active Free plan, show explanatory message */}
        {activeTab === 'topup' &&
        currentSubscription &&
        currentSubscription.status === 'active' &&
        currentSubscription.planName &&
        currentSubscription.planName.toLowerCase() === 'free' ? (
          <Surface
            style={[
              styles.emptyContainer,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
            elevation={1}
          >
            <Text
              variant="titleMedium"
              style={[
                styles.emptyText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Top-ups not available for Free plan
            </Text>
            <Text
              variant="bodyMedium"
              style={[
                styles.emptySubtext,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Free plan users cannot purchase top-ups. Upgrade to a paid plan to
              use top-ups.
            </Text>
          </Surface>
        ) : displayPlans.length > 0 ? (
          <PlansList
            plans={displayPlans}
            selectedPlan={selectedPlan}
            selectedPlanName={selectedPlanName}
            lastSubscription={lastSubscription}
            onToggle={togglePlan}
            onGetPlan={handleGetPlan}
            onRenewPlan={handleRenewPlan}
            onFreePlan={handleFreePlan}
            usage={usage}
            theme={theme}
            currentSubscription={currentSubscription}
            onPlanActivated={onPlanActivated}
            freePlanActive={freePlanActive}
          />
        ) : (
          <Surface
            style={[
              styles.emptyContainer,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
            elevation={1}
          >
            <Text
              variant="titleMedium"
              style={[
                styles.emptyText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              No {activeTab === 'regular' ? 'subscription' : 'top-up'} plans
              available
            </Text>
            <Text
              variant="bodyMedium"
              style={[
                styles.emptySubtext,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Check back later for new offerings
            </Text>
          </Surface>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  daysLeftText: {
    fontWeight: '600',
    textAlign: 'right',
  },

  upcomingCardModern: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },

  upcomingHeaderModern: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  upcomingPlanName: {
    fontWeight: '700',
    marginRight: 8,
  },

  upcomingChipModern: {
    height: 32,
    borderRadius: 8,
  },

  upcomingDetailsModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
  },

  upcomingPriceModern: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 90,
  },

  upcomingFooterModern: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },

  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
  },
  headerSurface: {
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    textAlign: 'center',
    opacity: 0.8,
  },
  segmentedContainer: {
    marginBottom: 24,
  },
  segmentedButtons: {
    // marginHorizontal: 4,
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  premiumBanner: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  premiumBannerText: {
    color: 'white',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  cardContent: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  planHeader: {
    marginBottom: 16,
  },
  planTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  planName: {
    fontWeight: '700',
    flex: 1,
  },
  currentChip: {
    height: 32,
    marginLeft: 8,
  },
  planDescription: {
    lineHeight: 20,
  },
  pricingSurface: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontWeight: '800',
    letterSpacing: -1,
  },
  pricePeriod: {
    marginLeft: 6,
    opacity: 0.7,
  },
  pricePerMonth: {
    opacity: 0.7,
  },
  usageSurface: {
    borderRadius: 12,
    marginBottom: 4,
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuresContainer: {
    marginTop: 8,
  },
  featuresDivider: {
    marginVertical: 16,
    height: 2,
  },
  featuresTitle: {
    fontWeight: '700',
    marginBottom: 16,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  featureIcon: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureText: {
    lineHeight: 20,
  },
  featureNote: {
    marginTop: 2,
    opacity: 0.7,
  },
  actionContainer: {
    marginTop: 20,
  },
  actionButton: {
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  expandHint: {
    marginTop: 12,
    alignItems: 'center',
  },
  expandHintText: {
    fontWeight: '600',
  },
  emptyContainer: {
    paddingHorizontal: 40,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    textAlign: 'center',
    opacity: 0.7,
  },
  topupText: {
    opacity: 0.9,
    marginBottom: 2,
  },
  totalText: {
    opacity: 1,
  },
  topupCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  topupCardContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  topupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topupLeft: {
    flex: 1,
    marginRight: 16,
  },
  topupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  topupName: {
    fontWeight: '700',
    marginRight: 8,
  },
  topupBadge: {
    height: 22,
  },
  topupDetails: {
    marginTop: 4,
  },
  topupInvoices: {
    fontWeight: '700',
    marginBottom: 2,
  },
  topupPrice: {
    opacity: 0.7,
  },
  topupRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  topupPriceSurface: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  topupPriceAmount: {
    fontWeight: '800',
  },
  topupButton: {
    borderRadius: 8,
    minWidth: 90,
  },
  topupButtonContent: {
    paddingVertical: 2,
  },
});

export default PricingCard;
