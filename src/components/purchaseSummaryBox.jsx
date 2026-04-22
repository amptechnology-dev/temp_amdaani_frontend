import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text, Divider, useTheme } from 'react-native-paper';

const f = v => {
  const n = Number(v || 0);
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
};

const PurchaseSummaryBox = ({ invoice }) => {
  const theme = useTheme();

  console.log('nettotal', invoice?.netTotal);

  console.log('summry', invoice);

  const subtotal = Number(invoice?.subtotal || 0);
  const gross = Number(invoice?.grandTotalRaw || 0);
  const netTotal = Number(invoice?.netTotal || gross);

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

      <Divider style={styles.divider} />

      <Row
        label="Net Total"
        value={`₹${f(netTotal)}`}
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
