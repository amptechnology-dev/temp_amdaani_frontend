import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  useTheme,
  Button,
  RadioButton,
  Divider,
} from 'react-native-paper';
import Navbar from '../../components/Navbar';
import { SafeAreaView } from 'react-native-safe-area-context';

const PaymentOptions = ({ navigation, route }) => {
  const theme = useTheme();
  const { plan, totalAmount } = route.params; // from ReviewOrder
  const [selectedMode, setSelectedMode] = useState('');

  const paymentOptions = [
    { label: 'UPI', value: 'upi' },
    { label: 'Credit / Debit Card', value: 'card' },
    { label: 'Netbanking', value: 'netbanking' },
  ];

  const handleProceed = () => {
    if (!selectedMode) return;
    // Here you will hit payment API later
    navigation.navigate('PaymentStatus', {
      plan,
      mode: selectedMode,
      amount: totalAmount,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Navbar title="Payment Options" showBackButton={true} />

      <ScrollView
        style={{ flex: 1, padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          variant="titleMedium"
          style={{ fontWeight: 'bold', marginBottom: 12 }}
        >
          Choose Payment Method
        </Text>

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 8,
            padding: 12,
            elevation: 1,
          }}
        >
          <RadioButton.Group
            onValueChange={value => setSelectedMode(value)}
            value={selectedMode}
          >
            {paymentOptions.map((option, idx) => (
              <View key={option.value}>
                <View style={styles.optionRow}>
                  <RadioButton value={option.value} />
                  <Text variant="bodyLarge">{option.label}</Text>
                </View>
                {idx < paymentOptions.length - 1 && (
                  <Divider style={{ marginVertical: 6 }} />
                )}
              </View>
            ))}
          </RadioButton.Group>
        </View>

        {/* Summary */}
        <View
          style={{
            backgroundColor: theme.colors.elevation.level2,
            borderRadius: 8,
            padding: 16,
            marginTop: 20,
          }}
        >
          <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
            Payment Summary
          </Text>
          <View style={styles.summaryRow}>
            <Text variant="bodyMedium">Plan</Text>
            <Text variant="bodyMedium">{plan.name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text variant="bodyMedium">Amount</Text>
            <Text variant="bodyMedium">₹{totalAmount}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Proceed Button */}
      <View style={{ padding: 16 }}>
        <Button
          mode="contained"
          disabled={!selectedMode}
          onPress={handleProceed}
          style={{ paddingVertical: 6, borderRadius: 8 }}
        >
          Proceed to Pay
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});

export default PaymentOptions;
