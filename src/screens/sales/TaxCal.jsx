import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, TextInput, useTheme } from 'react-native-paper';

const TaxCal = ({
  subtotal = 0,
  initialDiscountPercent = 0,
  showTaxRow = true,
  taxIncluded = false, // 👈 naya prop
  onTotalChange,
  style,
  taxRateSheet,
  selectedTaxRate,
  onTaxRateSelect,
}) => {
  const theme = useTheme();
  const [discountPercent, setDiscountPercent] = useState(
    initialDiscountPercent.toString(),
  );
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [subtotalExclTax, setSubtotalExclTax] = useState(subtotal);

  useEffect(() => {
    let discount = 0;
    const taxRate = parseFloat(selectedTaxRate) || 0;

    if (taxIncluded) {
      // Agar tax already included hai
      const baseExclTax =
        taxRate > 0 ? subtotal / (1 + taxRate / 100) : subtotal;
      setSubtotalExclTax(baseExclTax);

      // Discount calculate on entered (incl. tax) subtotal
      discount = (subtotal * parseFloat(discountPercent || 0)) / 100;
      setDiscountAmount(discount);

      // Total = entered subtotal - discount
      const total = subtotal - discount;
      setTotalAmount(total);

      // Tax amount from final total
      const taxAmt = taxRate > 0 ? total - total / (1 + taxRate / 100) : 0;
      setTaxAmount(taxAmt);
    } else {
      // Normal flow (tax extra)
      discount = (subtotal * parseFloat(discountPercent || 0)) / 100;
      setDiscountAmount(discount);

      const taxableAmount = subtotal - discount;
      const tax = showTaxRow ? (taxableAmount * taxRate) / 100 : 0;
      setTaxAmount(tax);

      const total = taxableAmount + tax;
      setTotalAmount(total);

      setSubtotalExclTax(subtotal); // same as subtotal
    }

    if (onTotalChange) {
      onTotalChange(totalAmount);
    }
  }, [subtotal, discountPercent, selectedTaxRate, taxIncluded, showTaxRow]);

  const handleDiscountChange = text => {
    const cleanedText = text.replace(/[^0-9.]/g, '');
    const decimalCount = (cleanedText.match(/\./g) || []).length;
    if (decimalCount <= 1) {
      setDiscountPercent(cleanedText);
    }
  };

  const formatCurrency = amount => {
    return `₹${(amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getBreakdownText = () => {
    if (taxIncluded) {
      return (
        `Entered (incl. tax): ${formatCurrency(subtotal)}\n` +
        `= Base: ${formatCurrency(subtotalExclTax)} + Tax: ${formatCurrency(
          taxAmount,
        )}` +
        (parseFloat(discountPercent || 0) > 0
          ? ` - Discount: ${formatCurrency(discountAmount)}`
          : '')
      );
    } else {
      return (
        subtotal > 0 &&
        `Base: ${formatCurrency(subtotal)}` +
          (parseFloat(discountPercent || 0) > 0
            ? ` - ${formatCurrency(discountAmount)} discount`
            : '') +
          (selectedTaxRate > 0 ? ` + ${formatCurrency(taxAmount)} tax` : '')
      );
    }
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 20,
      marginVertical: 8,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
      borderWidth: 1,
      borderColor: theme.colors.outline + '20',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginVertical: 6,
      minHeight: 32,
    },
    label: {
      fontSize: 15,
      color: theme.colors.onSurface,
      fontWeight: '500',
      flex: 1,
    },
    value: {
      fontSize: 15,
      color: theme.colors.onSurface,
      fontWeight: '600',
      textAlign: 'right',
    },
    subtotalValue: {
      fontSize: 16,
      color: theme.colors.onSurface,
      fontWeight: '700',
      textAlign: 'right',
    },
    discountContainer: { alignItems: 'flex-end', minWidth: 100 },
    input: {
      height: 44,
      width: 90,
      textAlign: 'right',
      backgroundColor: theme.colors.surfaceVariant + '40',
      borderRadius: 8,
      fontSize: 14,
      fontWeight: '600',
    },
    discountSavings: {
      fontSize: 11,
      color: theme.colors.error,
      fontWeight: '600',
      marginTop: 4,
      textAlign: 'right',
    },
    taxSection: {
      backgroundColor: theme.colors.surfaceVariant + '20',
      borderRadius: 12,
      padding: 16,
      marginVertical: 8,
    },
    taxSelectBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderWidth: 1.5,
      borderColor: theme.colors.primary,
      borderRadius: 8,
      backgroundColor: theme.colors.primaryContainer + '20',
      minWidth: 120,
    },
    taxSelectText: {
      color: theme.colors.primary,
      fontWeight: '600',
      fontSize: 13,
      textAlign: 'center',
    },
    taxAmountRow: {
      marginTop: 12,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline + '20',
    },
    totalSection: {
      backgroundColor: theme.colors.primaryContainer + '30',
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.colors.primary + '30',
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    totalLabel: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.primary,
      letterSpacing: 0.3,
    },
    totalValue: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.primary,
      letterSpacing: 0.5,
    },
    breakdownContainer: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.primary + '20',
    },
    breakdownText: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      fontWeight: '500',
    },
    highlightCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 12,
      marginVertical: 4,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
    },
  });

  return (
    <View style={[styles.container, style]}>
      {/* Subtotal Section */}
      <View style={styles.highlightCard}>
        <View style={styles.row}>
          <Text style={styles.label}>Subtotal</Text>
          <Text style={styles.subtotalValue}>
            {formatCurrency(taxIncluded ? subtotalExclTax : subtotal)}
          </Text>
        </View>
      </View>

      {/* Discount Section */}
      <View style={styles.row}>
        <Text style={styles.label}>Discount</Text>
        <View style={styles.discountContainer}>
          <TextInput
            style={styles.input}
            value={discountPercent}
            onChangeText={handleDiscountChange}
            keyboardType="numeric"
            dense
            mode="outlined"
            placeholder="0"
            contentStyle={{ textAlign: 'right', fontWeight: '600' }}
            outlineStyle={{ borderRadius: 8 }}
            right={<TextInput.Affix text="%" />}
          />
          {parseFloat(discountPercent || 0) > 0 && (
            <Text style={styles.discountSavings}>
              -{formatCurrency(discountAmount)} saved
            </Text>
          )}
        </View>
      </View>

      {/* Tax Section */}
      {showTaxRow && (
        <View style={styles.taxSection}>
          <View style={styles.row}>
            <Text style={styles.label}>Tax Rate</Text>
            <TouchableOpacity
              style={styles.taxSelectBtn}
              onPress={() => taxRateSheet.expand()}
              activeOpacity={0.7}
            >
              <Text style={styles.taxSelectText}>
                {selectedTaxRate > 0
                  ? `${selectedTaxRate}% GST`
                  : 'Select Tax Rate'}
              </Text>
            </TouchableOpacity>
          </View>

          {(parseFloat(selectedTaxRate) || 0) > 0 && (
            <View style={[styles.row, styles.taxAmountRow]}>
              <Text style={styles.label}>Tax Amount</Text>
              <Text style={styles.value}>{formatCurrency(taxAmount)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Total Section */}
      <View style={styles.totalSection}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
        </View>

        {(parseFloat(discountPercent || 0) > 0 || selectedTaxRate > 0) && (
          <View style={styles.breakdownContainer}>
            <Text style={styles.breakdownText}>{getBreakdownText()}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default TaxCal;
