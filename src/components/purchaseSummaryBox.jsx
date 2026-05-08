import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text, Divider, useTheme } from 'react-native-paper';

const f = v => {
  const n = Number(v || 0);
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
};

const PurchaseSummaryBox = ({ invoice, onRoundOffChange }) => {
  const theme = useTheme();

  const subtotal = Number(invoice?.subtotal || 0);
  const gross = Number(invoice?.grandTotalRaw || 0);
  const netTotal = Number(invoice?.netTotal || gross);

  // Auto-compute round off: Math.round(netTotal) - netTotal
  const roundOff = Number((Math.round(netTotal) - netTotal).toFixed(2));
  const afterRoundOff = netTotal + roundOff;

  // Notify parent whenever roundOff changes
  useEffect(() => {
    onRoundOffChange?.(roundOff);
  }, [roundOff]);

  const roundOffSign = roundOff >= 0 ? '+' : '';

  return (
    <Surface
      elevation={1}
      style={[
        styles.card,
        {
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Text style={[styles.heading, { color: theme.colors.onSurface }]}>
        Summary
      </Text>

      <Divider style={styles.divider} />

      <Row label="Subtotal" value={`₹${f(subtotal)}`} />

      {Number(invoice?.discountTotal || 0) > 0 && (
        <>
          <Divider style={styles.divider} />
          <Row
            label="Extra Discount"
            value={`-₹${f(invoice?.discountTotal)}`}
            valueColor={theme.colors.error}
          />
        </>
      )}

      <Divider style={styles.divider} />

      {/* Total row */}
      <Row
        label="Total"
        value={`₹${f(netTotal)}`}
        bold
        large
        valueColor={theme.colors.primary}
      />

      {/* Round Off row — auto computed, display only */}
      {roundOff !== 0 && (
        <>
          <Divider style={styles.divider} />
          <Row
            label="Round Off"
            value={`${roundOffSign}₹${Math.abs(roundOff).toFixed(2)}`}
            valueColor={
              roundOff >= 0 ? theme.colors.primary : theme.colors.error
            }
          />
        </>
      )}

      <Divider style={styles.divider} />

      {/* Net Payable — after round off */}
      <Row
        label="Net Payable"
        value={`₹${f(afterRoundOff)}`}
        bold
        large
        valueColor={theme.colors.primary}
      />
    </Surface>
  );
};

const Row = ({ label, value, bold, large, valueColor }) => (
  <View style={styles.row}>
    <Text
      style={[styles.label, bold && styles.boldText, large && styles.largeText]}
    >
      {label}
    </Text>
    <Text
      style={[
        styles.value,
        bold && styles.boldText,
        large && styles.largeValueText,
        valueColor ? { color: valueColor } : {},
      ]}
    >
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 30,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  heading: { fontSize: 13, fontWeight: '700' },
  divider: { marginVertical: 6, opacity: 0.35 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  label: { fontSize: 12, color: '#666' },
  value: { fontSize: 12, color: '#111' },
  boldText: { fontWeight: '600' },
  largeText: { fontSize: 13 },
  largeValueText: { fontSize: 15 },
});

export default PurchaseSummaryBox;
