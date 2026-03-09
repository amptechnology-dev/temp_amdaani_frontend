import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  Text,
  useTheme,
  Icon,
  Badge,
  Surface,
  Chip,
  Button,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import BaseBottomSheet from './BaseBottomSheet';
import Toast from 'react-native-toast-message';

const SubscriptionMessageBottomSheet = React.forwardRef(
  (
    {
      title = 'Subscription Required',
      message = "Your plan has expired. Renew to continue using premium features.",
      renewCardData = null,
      onCheckoutPlans = null,
      onRenewPlan = null,
      showCloseButton = true,
      ...props
    },
    ref,
  ) => {
    const theme = useTheme();
    const navigation = useNavigation();
    const [isNavigating, setIsNavigating] = useState(false);
    // // console.log("renewCardData in SubscriptionMessageBottomSheet:", renewCardData);
    const transformPlanData = useCallback((planData) => {
      if (!planData) {
        // console.log("No plan data provided");
        return null;
      }

      // console.log("Transforming plan data:", planData);

      // Handle case where planData is already the plan object (not wrapped in subscription)
      const plan = planData.plan || planData;
      const price = planData.price || plan.price;
      const durationDays = planData.durationDays || plan.durationDays;

      // Validate required fields
      if (!plan._id || !plan.name || !plan.price) {
        console.error("Invalid plan data structure:", plan);
        return null;
      }

      // Transform to match the format from pricings.jsx
      const transformedPlan = {
        _id: plan._id,
        name: plan.name,
        description: plan.description || 'For growing businesses',
        originalPrice: `₹${plan.price}`,
        discountedPrice: `₹${price}`,
        monthlyPrice: `₹${((plan.price / durationDays) * 30).toFixed(0)}/mo`,
        price: plan.price,
        currency: plan.currency || 'INR',
        durationDays: durationDays,
        features: Array.isArray(plan.features) ? plan.features.map(f => f.name || f) : [],
        featuresIncluded: Array.isArray(plan.features) ? plan.features.map(f => f.available !== undefined ? f.available : true) : [],
        featuresDetails: Array.isArray(plan.features) ? plan.features : [],
        usageLimits: plan.usageLimits || { invoices: 0, unlimited: false },
        planType: plan.planType || 'regular',
        color: theme.colors.primary,
        isActive: plan.isActive !== undefined ? plan.isActive : true,
      };

      // console.log("Transformed plan:", transformedPlan);
      return transformedPlan;
    }, [theme]);


    // Navigate to ReviewOrder with the same plan
    const handleRenewSamePlan = useCallback(async () => {
      if (isNavigating || !renewCardData?.plan) return;
      setIsNavigating(true);

      try {
        const transformedPlan = transformPlanData(renewCardData?.plan);

        if (!transformedPlan) {
          throw new Error('Invalid plan data');
        }

        await onRenewPlan(transformedPlan);
      } catch (err) {
        console.error('Error navigating to ReviewOrder:', err);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Unable to open review order',
        });
      } finally {
        setTimeout(() => setIsNavigating(false), 600);
      }
    }, [isNavigating, navigation, renewCardData, transformPlanData]);

    // Navigate to all plans (Pricings page)
    const handleViewAllPlans = useCallback(async () => {
      if (isNavigating) return;
      setIsNavigating(true);

      try {
        if (onCheckoutPlans) {
          await onCheckoutPlans();
        }
      } catch (err) {
        console.error('Error navigating to plans:', err);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Unable to open plans page',
        });
      } finally {
        setTimeout(() => setIsNavigating(false), 600);
      }
    }, [isNavigating, navigation, onCheckoutPlans]);


    // ✅ Compact Renew Card - Tap to Renew
    const renderRenewCard = useMemo(() => {
      if (!renewCardData) return null;

      const {
        planName,
        plan,
        durationDays,
        status,
        usageLimits,
      } = renewCardData;

      const getStatusColor = () => {
        switch (status?.toLowerCase()) {
          case 'expired':
            return '#EF4444';
          case 'active':
            return '#10B981';
          case 'expiring':
            return '#F59E0B';
          default:
            return '#6B7280';
        }
      };

      const statusColor = getStatusColor();
      const isDark = theme.dark;

      return (
        <View style={styles.cardWrapper}>
          <Pressable
            onPress={handleRenewSamePlan}
            android_ripple={{ color: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(99, 102, 241, 0.1)' }}
          >
            <Surface
              style={[
                styles.compactCard,
                {
                  backgroundColor: isDark ? theme.colors.elevation.level2 : '#FFFFFF',
                  shadowColor: isDark ? '#000' : '#000',
                }
              ]}
              elevation={2}
            >
              {/* Premium Gradient Accent */}
              <LinearGradient
                colors={['#6366F1', '#8B5CF6', '#D946EF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.compactAccent}
              />

              {/* Card Content */}
              <View style={styles.compactContent}>
                {/* Header Row */}
                <View style={styles.compactHeader}>
                  {/* Icon & Title */}
                  <View style={styles.compactHeaderLeft}>
                    <LinearGradient
                      colors={isDark ? ['#4C1D95', '#5B21B6'] : ['#EDE9FE', '#DDD6FE']}
                      style={styles.compactIcon}
                    >
                      <Icon
                        source="crown"
                        size={20}
                        color={isDark ? '#C4B5FD' : '#7C3AED'}
                      />
                    </LinearGradient>

                    <View style={styles.compactTitleContainer}>
                      <Text
                        variant="titleSmall"
                        style={[styles.compactTitle, { color: theme.colors.onSurface }]}
                      >
                        {planName || 'Last Subscription'}
                      </Text>
                      <View style={styles.compactStatusRow}>
                        <Badge
                          size={5}
                          style={[styles.compactStatusDot, { backgroundColor: statusColor }]}
                        />
                        <Text
                          variant="labelSmall"
                          style={[styles.compactStatus, { color: statusColor }]}
                        >
                          {status?.toUpperCase() || 'EXPIRED'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Renew Chip */}
                  <Chip
                    mode="flat"
                    icon="refresh"
                    style={[styles.renewChip, { backgroundColor: isDark ? '#5B21B6' : '#EDE9FE' }]}
                    textStyle={[styles.renewChipText, { color: isDark ? '#E9D5FF' : '#6B21A8' }]}
                    compact
                  >
                    Renew
                  </Chip>
                </View>

                {/* Details Row - Compact */}
                <View style={styles.compactDetails}>
                  {/* Invoice Limit */}
                  <View style={styles.compactDetail}>
                    <Icon
                      source="file-document-multiple"
                      size={14}
                      color={theme.colors.primary}
                    />
                    <Text
                      variant="labelSmall"
                      style={[styles.compactDetailText, { color: theme.colors.onSurfaceVariant }]}
                    >
                      {usageLimits?.invoices ?? 0} Invoices
                    </Text>
                  </View>

                  {/* Divider */}
                  <View style={[styles.compactDivider, { backgroundColor: isDark ? '#4B5563' : '#D1D5DB' }]} />

                  {/* Price & Duration */}
                  <View style={styles.compactDetail}>
                    <Icon
                      source="currency-inr"
                      size={14}
                      color={theme.colors.primary}
                    />
                    <Text
                      variant="labelSmall"
                      style={[styles.compactDetailText, { color: theme.colors.onSurfaceVariant }]}
                    >
                      ₹{plan?.price} • {durationDays} days
                    </Text>
                  </View>
                </View>
              </View>

              {/* Tap Indicator */}
              <View style={styles.tapIndicator}>
                <Icon
                  source="chevron-right"
                  size={20}
                  color={theme.colors.onSurfaceVariant}
                />
              </View>
            </Surface>
          </Pressable>
          {/* <Button
            mode="outlined"
            icon="store"
            onPress={handleViewAllPlans}
            style={[
              styles.viewAllButton,
              { borderColor: isDark ? theme.colors.outline : theme.colors.outline }
            ]}
            labelStyle={styles.viewAllButtonLabel}
            contentStyle={styles.viewAllButtonContent}
          >
            View All Plans
          </Button> */}
        </View>
      );
    }, [renewCardData, theme, handleRenewSamePlan]);

    const renderContent = useMemo(
      () => (
        <View style={styles.container}>
          {/* Alert Icon & Message Section */}
          <View style={styles.messageContainer}>
            <LinearGradient
              colors={['#FEF3C7', '#ffd52eff']}
              style={styles.iconContainer}
            >
              <Icon source="crown" size={36} color="#F59E0B" />
            </LinearGradient>
            <Text
              variant="bodyLarge"
              style={[styles.message, { color: theme.colors.onSurfaceVariant }]}
            >
              {message}
            </Text>
          </View>

          {/* Compact Renew Card */}
          {renderRenewCard}

          <Button
            mode="outlined"
            icon="store"
            onPress={handleViewAllPlans}
            style={[
              styles.viewAllButton,
              { borderColor: theme.colors.outline }
            ]}
            labelStyle={styles.viewAllButtonLabel}
            contentStyle={styles.viewAllButtonContent}
          >
            View All Plans
          </Button>
          {/* Bottom CTA */}
          {/* <View style={styles.bottomCTA}>
            <Text
              variant="labelMedium"
              style={[styles.ctaText, { color: theme.colors.onSurfaceVariant }]}
            >
              Tap the card above to explore renewal plans
            </Text>
          </View> */}
        </View>
      ),
      [message, renderRenewCard, theme],
    );

    return (
      <BaseBottomSheet
        ref={ref}
        title={title}
        contentType="view"
        enableDismissOnClose
        showCloseButton={showCloseButton}
        showHeader
        snapPoints={['70%']}
        initialSnapIndex={-1}
        {...props}
      >
        {renderContent}
      </BaseBottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },

  // Message Section
  messageContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginVertical: 20,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
  },

  cardWrapper: {
    marginHorizontal: 16,
    gap: 12,
  },
  // Compact Card
  compactCard: {
    borderRadius: 16,
    // marginHorizontal: 16,  
    overflow: 'hidden',
    elevation: 2,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    position: 'relative',
  },
  compactAccent: {
    height: 3,
    width: '100%',
  },
  compactContent: {
    padding: 16,
  },

  // Header
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  compactHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  compactTitleContainer: {
    flex: 1,
  },
  compactTitle: {
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  compactStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactStatusDot: {
    marginRight: 5,
  },
  compactStatus: {
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 0.5,
  },

  // Renew Chip
  renewChip: {
    height: 30,
    marginLeft: 8,
  },
  renewChipText: {
    fontSize: 12,
    fontWeight: '600',
    marginVertical: 0,
  },

  // Compact Details Row
  compactDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
  },
  compactDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  compactDetailText: {
    fontWeight: '600',
    fontSize: 12,
  },
  compactDivider: {
    width: 1,
    height: 16,
    marginHorizontal: 12,
  },

  // Tap Indicator
  tapIndicator: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -10 }],
  },

  // Bottom CTA
  bottomCTA: {
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 24,
  },
  ctaText: {
    textAlign: 'center',
    fontWeight: '500',
    opacity: 0.7,
  },
  viewAllButton: {
    borderRadius: 12,
    borderWidth: 1.5,
    marginHorizontal: 16,
  },
  viewAllButtonContent: {
    paddingVertical: 6,
  },
  viewAllButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default SubscriptionMessageBottomSheet;
