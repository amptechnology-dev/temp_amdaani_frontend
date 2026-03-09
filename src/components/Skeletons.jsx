import React from "react";
import { View, StyleSheet, Dimensions, ScrollView } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { createShimmerPlaceholder } from "react-native-shimmer-placeholder";
import { useTheme } from "react-native-paper";

const ShimmerPlaceHolder = createShimmerPlaceholder(LinearGradient);

export const MetricCardSkeleton = () => {
  const theme = useTheme();

  const shimmerColors = theme.dark
    ? [theme.colors.surfaceVariant, theme.colors.outlineVariant, theme.colors.surfaceVariant]
    : ["#f5f5f5", "#e0e0e0", "#f5f5f5"];

  return (
    <View style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}>
      <ShimmerPlaceHolder shimmerColors={shimmerColors} style={styles.metricIcon} />
      <ShimmerPlaceHolder shimmerColors={shimmerColors} style={styles.metricTitle} />
      <ShimmerPlaceHolder shimmerColors={shimmerColors} style={styles.metricValue} />
      <ShimmerPlaceHolder shimmerColors={shimmerColors} style={styles.metricFooter} />
    </View>
  );
};

export const ListSkeleton = ({ rows = 5 }) => {
  const theme = useTheme();

  const shimmerColors = theme.dark
    ? [theme.colors.surfaceVariant, theme.colors.outlineVariant, theme.colors.surfaceVariant]
    : ["#f5f5f5", "#e0e0e0", "#f5f5f5"];

  return (
    <View>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.listRow}>
          <ShimmerPlaceHolder shimmerColors={shimmerColors} style={styles.listText} />
          <ShimmerPlaceHolder shimmerColors={shimmerColors} style={styles.listValue} />
        </View>
      ))}
    </View>
  );
};

export const ChartSkeleton = ({ height = 180 }) => {
  const theme = useTheme();

  const shimmerColors = theme.dark
    ? [theme.colors.surfaceVariant, theme.colors.outlineVariant, theme.colors.surfaceVariant]
    : ["#f5f5f5", "#e0e0e0", "#f5f5f5"];

  return (
    <View style={[styles.chartCard, { backgroundColor: theme.colors.surface }]}>
      <ShimmerPlaceHolder shimmerColors={shimmerColors} style={[styles.chart, { height }]} />
    </View>
  );
};

export const CarouselSkeleton = ({ height = 90, borderRadius = 12, slides = 3 }) => {
  const theme = useTheme();

  const shimmerColors = theme.dark
    ? [theme.colors.surfaceVariant, theme.colors.outlineVariant, theme.colors.surfaceVariant]
    : ["#f5f5f5", "#e0e0e0", "#f5f5f5"];

  return (
    <View style={{ flexDirection: "row", justifyContent: "center" }}>
      {Array.from({ length: slides }).map((_, index) => (
        <ShimmerPlaceHolder
          key={index}
          shimmerColors={shimmerColors}
          style={{
            width: Dimensions.get("window").width - 40,
            height,
            borderRadius,
            marginHorizontal: 10,
          }}
        />
      ))}
    </View>
  );
};


export const TextSkeleton = ({ width = 60, height = 16, style }) => {
  const theme = useTheme();

  const shimmerColors = theme.dark
    ? [theme.colors.surfaceVariant, theme.colors.outlineVariant, theme.colors.surfaceVariant]
    : ["#f5f5f5", "#e0e0e0", "#f5f5f5"];

  return (
    <ShimmerPlaceHolder 
      shimmerColors={shimmerColors} 
      style={[{
        width,
        height,
        borderRadius: 4,
      }, style]}
    />
  );
};

export const TransactionsSkeleton = ({ count = 5 }) => {
  const theme = useTheme();
  const shimmerColors = theme.dark
    ? [theme.colors.surfaceVariant, theme.colors.outlineVariant, theme.colors.surfaceVariant]
    : ["#f5f5f5", "#e0e0e0", "#f5f5f5"];

  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.transactionSkeleton, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.transactionHeaderSkeleton}>
            <ShimmerPlaceHolder 
              shimmerColors={shimmerColors} 
              style={styles.transactionCustomerSkeleton} 
            />
            <ShimmerPlaceHolder 
              shimmerColors={shimmerColors} 
              style={styles.transactionIdSkeleton} 
            />
          </View>
          <View style={styles.transactionDetailsSkeleton}>
            <View style={styles.transactionDetailRow}>
              <ShimmerPlaceHolder 
                shimmerColors={shimmerColors} 
                style={styles.transactionDetailLabelSkeleton} 
              />
              <ShimmerPlaceHolder 
                shimmerColors={shimmerColors} 
                style={styles.transactionDetailValueSkeleton} 
              />
            </View>
            <View style={styles.transactionDetailRow}>
              <ShimmerPlaceHolder 
                shimmerColors={shimmerColors} 
                style={styles.transactionDetailLabelSkeleton} 
              />
              <ShimmerPlaceHolder 
                shimmerColors={shimmerColors} 
                style={styles.transactionDetailValueSkeleton} 
              />
            </View>
          </View>
          <View style={styles.transactionFooterSkeleton}>
            <ShimmerPlaceHolder 
              shimmerColors={shimmerColors} 
              style={styles.transactionStatusSkeleton} 
            />
            <ShimmerPlaceHolder 
              shimmerColors={shimmerColors} 
              style={styles.transactionAmountSkeleton} 
            />
          </View>
        </View>
      ))}
    </View>
  );
};

export const PartyListSkeleton = ({ count = 5 }) => {
  const theme = useTheme();
  const shimmerColors = theme.dark
    ? [theme.colors.surfaceVariant, theme.colors.outlineVariant, theme.colors.surfaceVariant]
    : ["#f5f5f5", "#e0e0e0", "#f5f5f5"];

  const renderSkeletonItem = (_, index) => (
    <View key={index} style={[styles.partySkeleton, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.partySkeletonLeft}>
        <ShimmerPlaceHolder 
          shimmerColors={shimmerColors} 
          style={styles.partySkeletonAvatar} 
        />
        <View style={styles.partySkeletonInfo}>
          <ShimmerPlaceHolder 
            shimmerColors={shimmerColors} 
            style={styles.partySkeletonName} 
          />
          <ShimmerPlaceHolder 
            shimmerColors={shimmerColors} 
            style={styles.partySkeletonPhone} 
          />
        </View>
      </View>
      <ShimmerPlaceHolder 
        shimmerColors={shimmerColors} 
        style={styles.partySkeletonAmount} 
      />
    </View>
  );

  return (
    <View style={styles.partySkeletonContainer}>
      {Array.from({ length: count }).map(renderSkeletonItem)}
    </View>
  );
};

export const PricingCardSkeleton = ({ count = 3 }) => {
  const theme = useTheme();
  const shimmerColors = theme.dark
    ? [theme.colors.surfaceVariant, theme.colors.outlineVariant, theme.colors.surfaceVariant]
    : ["#f5f5f5", "#e0e0e0", "#f5f5f5"];

  const renderSkeletonCard = (_, index) => (
    <View key={index} style={[styles.pricingCardSkeleton, { backgroundColor: theme.colors.surface }]}>
      {/* Plan Name */}
      <ShimmerPlaceHolder 
        shimmerColors={shimmerColors} 
        style={styles.pricingCardTitleSkeleton} 
      />
      
      {/* Price */}
      <ShimmerPlaceHolder 
        shimmerColors={shimmerColors} 
        style={styles.pricingCardPriceSkeleton} 
      />
      
      {/* Billing Period */}
      <ShimmerPlaceHolder 
        shimmerColors={shimmerColors} 
        style={styles.pricingCardPeriodSkeleton} 
      />
      
      {/* Divider */}
      <View style={styles.pricingCardDividerSkeleton} />
      
      {/* Features */}
      {[1, 2, 3, 4].map((_, i) => (
        <View key={i} style={styles.pricingCardFeatureSkeleton}>
          <ShimmerPlaceHolder 
            shimmerColors={shimmerColors} 
            style={styles.pricingCardFeatureBulletSkeleton} 
          />
          <ShimmerPlaceHolder 
            shimmerColors={shimmerColors} 
            style={styles.pricingCardFeatureTextSkeleton} 
          />
        </View>
      ))}
      
      {/* Button */}
      <ShimmerPlaceHolder 
        shimmerColors={shimmerColors} 
        style={styles.pricingCardButtonSkeleton} 
      />
    </View>
  );

  return (
    <View style={styles.pricingCardSkeletonContainer}>
      {Array.from({ length: count }).map(renderSkeletonCard)}
    </View>
  );
};

export const ReceivedPaymentsSkeleton = ({ count = 5 }) => {
  const theme = useTheme();
  const shimmerColors = theme.dark
    ? [theme.colors.surface, theme.colors.outlineVariant, theme.colors.surface]
    : ["#f5f5f5", "#e0e0e0", "#f5f5f5"];

  const renderSkeletonCard = (_, index) => (
    <View key={index} style={[styles.receivedPaymentsCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.receivedPaymentsRow}>
        <ShimmerPlaceHolder 
          shimmerColors={shimmerColors}
          style={styles.receivedPaymentsAvatarSkeleton}
        />
        <View style={styles.receivedPaymentsDetailsSkeleton}>
          <ShimmerPlaceHolder 
            shimmerColors={shimmerColors}
            style={[styles.receivedPaymentsLine, { width: '60%' }]}
          />
          <ShimmerPlaceHolder 
            shimmerColors={shimmerColors}
            style={[styles.receivedPaymentsLine, { width: '40%', marginTop: 8 }]}
          />
        </View>
        <ShimmerPlaceHolder 
          shimmerColors={shimmerColors}
          style={[styles.receivedPaymentsStatusSkeleton, { marginLeft: 'auto' }]}
        />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Only show payment cards skeleton */}
      {Array.from({ length: count }).map((_, i) => renderSkeletonCard(_, i))}
    </View>
  );
};

export const ProductListSkeleton = ({ count = 5 }) => {
  const theme = useTheme();
  const shimmerColors = theme.dark
    ? [theme.colors.surfaceVariant, theme.colors.outlineVariant, theme.colors.surfaceVariant]
    : ["#f5f5f5", "#e0e0e0", "#f5f5f5"];

  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.productSkeleton, { backgroundColor: theme.colors.surface }]}>
          <ShimmerPlaceHolder 
            shimmerColors={shimmerColors} 
            style={styles.productImageSkeleton} 
          />
          <View style={styles.productInfoSkeleton}>
            <ShimmerPlaceHolder 
              shimmerColors={shimmerColors} 
              style={styles.productTitleSkeleton} 
            />
            <ShimmerPlaceHolder 
              shimmerColors={shimmerColors} 
              style={styles.productPriceSkeleton} 
            />
          </View>
          <ShimmerPlaceHolder 
            shimmerColors={shimmerColors} 
            style={styles.productButtonSkeleton} 
          />
        </View>
      ))}
    </View>
  );
};

export const ProfileSkeleton = () => {
  const theme = useTheme();
  const shimmerColors = theme.dark
    ? [theme.colors.surface, theme.colors.outlineVariant, theme.colors.surface]
    : ["#f5f5f5", "#e0e0e0", "#f5f5f5"];

  const renderFieldSkeleton = (width = '100%') => (
    <View style={styles.profileFieldContainer}>
      <ShimmerPlaceHolder 
        shimmerColors={shimmerColors} 
        style={[styles.profileFieldLabel, { width: '40%' }]} 
      />
      <ShimmerPlaceHolder 
        shimmerColors={shimmerColors} 
        style={[styles.profileFieldValue, { width }]} 
      />
    </View>
  );

  return (
    <View style={[styles.profileSkeletonContainer,{backgroundColor:theme.colors.background}]}>
      {/* Header with Avatar */}
      <View style={styles.profileHeaderSkeleton}>
        <ShimmerPlaceHolder 
          shimmerColors={shimmerColors}
          style={styles.profileAvatarSkeleton}
        />
        <View style={styles.profileHeaderText}>
          <ShimmerPlaceHolder 
            shimmerColors={shimmerColors}
            style={styles.profileNameSkeleton}
          />
          <ShimmerPlaceHolder 
            shimmerColors={shimmerColors}
            style={styles.profileEmailSkeleton}
          />
        </View>
      </View>

      <View style={styles.profileContent}>
        {/* Basic Info Section */}
        <View style={[styles.profileSection,{backgroundColor:theme.colors.surface}]}>
          <ShimmerPlaceHolder 
            shimmerColors={shimmerColors}
            style={styles.sectionTitleSkeleton}
          />
          {renderFieldSkeleton('90%')}
          {renderFieldSkeleton('70%')}
          {renderFieldSkeleton('80%')}
        </View>

        {/* Business Info Section */}
        <View style={[styles.profileSection,{backgroundColor:theme.colors.surface}]}>
          <ShimmerPlaceHolder 
            shimmerColors={shimmerColors}
            style={styles.sectionTitleSkeleton}
          />
          {renderFieldSkeleton('85%')}
          {renderFieldSkeleton('75%')}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Profile Skeleton Styles
  profileSkeletonContainer: {
    flex: 1,
    padding: 16,
  },
  profileContent: {
    flex: 1,
  },
  profileHeaderSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  profileAvatarSkeleton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  profileHeaderText: {
    flex: 1,
  },
  profileNameSkeleton: {
    width: '70%',
    height: 24,
    borderRadius: 4,
    marginBottom: 8,
  },
  profileEmailSkeleton: {
    width: '90%',
    height: 16,
    borderRadius: 4,
  },
  profileSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitleSkeleton: {
    width: '40%',
    height: 20,
    borderRadius: 4,
    marginBottom: 16,
  },
  profileFieldContainer: {
    marginBottom: 16,
  },
  profileFieldLabel: {
    height: 14,
    borderRadius: 4,
    marginBottom: 4,
  },
  profileFieldValue: {
    height: 18,
    borderRadius: 4,
  },

  // Received Payments Skeleton Styles
  receivedPaymentsHeaderSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 8,
  },
  receivedPaymentsTitleSkeleton: {
    width: 160,
    height: 24,
    borderRadius: 4,
  },
  receivedPaymentsAmountSkeleton: {
    width: 120,
    height: 20,
    borderRadius: 4,
  },
  receivedPaymentsSearchSkeleton: {
    height: 50,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  receivedPaymentsChipContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  receivedPaymentsChip: {
    height: 32,
    width: 80,
    borderRadius: 16,
    marginRight: 8,
  },
  receivedPaymentsCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  receivedPaymentsAvatarSkeleton: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  receivedPaymentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  receivedPaymentsDetailsSkeleton: {
    flex: 1,
    marginLeft: 12,
  },
  receivedPaymentsLine: {
    height: 12,
    borderRadius: 4,
    marginBottom: 6,
  },
  receivedPaymentsStatusSkeleton: {
    width: 80,
    height: 24,
    borderRadius: 12,
  },
  
  // Pricing Card Skeleton Styles
  pricingCardSkeletonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
  },
  pricingCardSkeleton: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignSelf: 'center',
  },
  pricingCardTitleSkeleton: {
    width: '60%',
    height: 28,
    marginBottom: 8,
    borderRadius: 4,
  },
  pricingCardPriceSkeleton: {
    width: '40%',
    height: 32,
    marginBottom: 4,
    borderRadius: 4,
  },
  pricingCardPeriodSkeleton: {
    width: '50%',
    height: 16,
    marginBottom: 16,
    borderRadius: 4,
  },
  pricingCardDividerSkeleton: {
    height: 1,
    marginVertical: 16,
    backgroundColor: '#f0f0f0',
  },
  pricingCardFeatureSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pricingCardFeatureBulletSkeleton: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  pricingCardFeatureTextSkeleton: {
    flex: 1,
    height: 16,
    borderRadius: 4,
  },
  pricingCardButtonSkeleton: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    marginTop: 16,
  },
  transactionSkeleton: {
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
  },
  transactionHeaderSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  transactionCustomerSkeleton: {
    width: 120,
    height: 20,
    borderRadius: 4,
  },
  transactionIdSkeleton: {
    width: 80,
    height: 18,
    borderRadius: 4,
  },
  transactionDetailsSkeleton: {
    marginBottom: 12,
  },
  transactionDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  transactionDetailLabelSkeleton: {
    width: 80,
    height: 16,
    borderRadius: 4,
  },
  transactionDetailValueSkeleton: {
    width: 100,
    height: 16,
    borderRadius: 4,
  },
  transactionFooterSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  transactionStatusSkeleton: {
    width: 80,
    height: 24,
    borderRadius: 12,
  },
  transactionAmountSkeleton: {
    width: 100,
    height: 20,
    borderRadius: 4,
  },
  productSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
  },
  productImageSkeleton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  productInfoSkeleton: {
    flex: 1,
  },
  productTitleSkeleton: {
    width: '70%',
    height: 16,
    borderRadius: 4,
    marginBottom: 6,
  },
  productPriceSkeleton: {
    width: '40%',
    height: 14,
    borderRadius: 4,
  },
  productButtonSkeleton: {
    width: 100,
    height: 36,
    borderRadius: 18,
  },
  partySkeletonContainer: {
    padding: 16,
  },
  partySkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  partySkeletonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  partySkeletonAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  partySkeletonInfo: {
    flex: 1,
  },
  partySkeletonName: {
    width: '60%',
    height: 18,
    borderRadius: 4,
    marginBottom: 6,
  },
  partySkeletonPhone: {
    width: '40%',
    height: 14,
    borderRadius: 4,
  },
  partySkeletonAmount: {
    width: 80,
    height: 20,
    borderRadius: 4,
  },
  metricCard: {
    width: "48%",
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  metricIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 6,
  },
  metricTitle: {
    width: "40%",
    height: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  metricValue: {
    width: "70%",
    height: 20,
    borderRadius: 6,
    marginBottom: 8,
  },
  metricFooter: {
    width: "60%",
    height: 12,
    borderRadius: 6,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  listText: {
    width: "60%",
    height: 14,
    borderRadius: 6,
  },
  listValue: {
    width: 60,
    height: 14,
    borderRadius: 6,
  },
  chartCard: {
    borderRadius: 12,
    marginTop: 16,
    padding: 16,
  },
  chart: {
    width: "100%",
    borderRadius: 12,
  },
});
