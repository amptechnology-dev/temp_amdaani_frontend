import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  StyleSheet,
} from 'react-native';
import { Surface, Text, Divider, useTheme, Icon } from 'react-native-paper';
import Animated, {
  FadeInDown,
  FadeOutUp,
  Layout,
} from 'react-native-reanimated';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Format number — show decimals only when needed
 * e.g. 20 → "20",  20.5 → "20.50",  20.123 → "20.12"
 */
const f = v => {
  const n = Number(v || 0);
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
};

const PurchaseInvoiceItemCard = ({ item }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  // ── Derived values ─────────────────────────────────────────────────────────
  const costPrice = Number(item.costPrice ?? item.price ?? 0);
  const purchaseDiscount = Number(item.purchaseDiscount ?? 0);
  const qty = Number(item.qty || 0);
  const gstRate = Number(item.purchaseGstRate ?? item.gstRate ?? 0);
  const isTaxInclusive = !!item.isPurchaseTaxInclusive;

  // Net rate after discount (this is the face-value per unit)
  const netRate = Math.max(0, costPrice - purchaseDiscount);

  let taxableValue, gstAmount, total;

  if (isTaxInclusive) {
    // GST is ALREADY inside netRate — amount does NOT change
    taxableValue = netRate / (1 + gstRate / 100);
    gstAmount = netRate - taxableValue;
    total = qty * netRate;
  } else {
    // GST is added ON TOP — amount increases
    taxableValue = netRate;
    gstAmount = netRate * (gstRate / 100);
    total = qty * (netRate + gstAmount);
  }

  const hasGst = gstRate > 0;
  const hasDiscount = purchaseDiscount > 0;
  const hasDetails = hasGst || hasDiscount;

  const toggleExpand = () => {
    if (!hasDetails) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  };

  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutUp}
      layout={Layout.springify()}
      style={styles.wrapper}
    >
      <Surface
        elevation={0}
        style={[
          styles.card,
          {
            borderColor: theme.colors.outlineVariant,
            backgroundColor: theme.colors.elevation.level1,
          },
        ]}
      >
        {/* ── Header ── */}
        <TouchableOpacity
          style={styles.header}
          activeOpacity={0.8}
          onPress={toggleExpand}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.title, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>

            {/* Sub line: show discount if any, else just price × qty */}
            <Text style={styles.sub}>
              {hasDiscount ? (
                <>
                  ₹{f(costPrice)} - ₹{f(purchaseDiscount)} = ₹{f(netRate)} ×{' '}
                  {qty}
                </>
              ) : (
                <>
                  ₹{f(netRate)} × {qty}
                </>
              )}
            </Text>
          </View>

          <View style={styles.endSection}>
            <Text style={[styles.total, { color: theme.colors.primary }]}>
              ₹{f(total)}
            </Text>
            {hasDetails && (
              <Icon
                source={expanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.colors.outline}
              />
            )}
          </View>
        </TouchableOpacity>

        {/* ── Expanded detail section ── */}
        {expanded && (
          <Animated.View
            entering={FadeInDown}
            exiting={FadeOutUp}
            style={styles.expandBox}
          >
            <Divider style={{ marginVertical: 4 }} />

            {/* Cost price */}
            <Row label="Cost Price" value={`₹${f(costPrice)} / unit`} />

            {/* Discount row — only if there is one */}
            {hasDiscount && (
              <Row
                label="Purchase Discount"
                value={`- ₹${f(purchaseDiscount)} / unit`}
                color="#e53935"
              />
            )}

            {/* Net rate after discount */}
            {hasDiscount && (
              <Row label="Net Rate" value={`₹${f(netRate)} / unit`} />
            )}

            {/* Qty */}
            <Row label="Qty" value={`${qty}`} />

            {/* GST block — only if there is GST */}
            {hasGst && (
              <>
                <Divider style={{ marginVertical: 4 }} />

                <Row
                  label={`GST Rate (${gstRate}%)`}
                  value={
                    isTaxInclusive
                      ? 'Inclusive' // tax already inside price
                      : 'Exclusive' // tax added on top
                  }
                />
                <Row
                  label="Taxable Value"
                  value={`₹${f(taxableValue * qty)}`}
                />
                <Row
                  label={`GST Amount (${gstRate}%)`}
                  value={
                    isTaxInclusive
                      ? `₹${f(gstAmount * qty)} (included)`
                      : `+ ₹${f(gstAmount * qty)}`
                  }
                  color={isTaxInclusive ? theme.colors.outline : '#e65100'}
                />
              </>
            )}

            <Divider style={{ marginVertical: 4 }} />

            <Row
              label="Total"
              value={`₹${f(total)}`}
              bold
              color={theme.colors.primary}
            />
          </Animated.View>
        )}
      </Surface>
    </Animated.View>
  );
};

const Row = ({ label, value, bold, color }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text
      style={[
        styles.rowValue,
        bold && { fontWeight: '700' },
        color ? { color } : {},
      ]}
    >
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 10,
    marginBottom: 6,
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  sub: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
  },
  endSection: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  total: {
    fontSize: 14,
    fontWeight: '700',
  },
  expandBox: {
    marginTop: 6,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  rowLabel: { fontSize: 11, color: '#666' },
  rowValue: { fontSize: 11, fontWeight: '500' },
});

export default PurchaseInvoiceItemCard;
