import { useNavigation, useRoute } from '@react-navigation/native';
import React, { use, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import {
  Text,
  useTheme,
  Button,
  Divider,
  TextInput,
  ActivityIndicator,
} from 'react-native-paper';
import Navbar from '../../components/Navbar';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../utils/api';
const ReviewOrder = () => {
  const navigation = useNavigation();
  const theme = useTheme();
  const route = useRoute();
  const { plan } = route.params;

  const [couponCode, setCouponCode] = useState('');
  const [gstin, setGstin] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);

  const [loading, setLoading] = useState(false);

  const initiatePayment = async () => {
    // console.log('Initiating payment for plan:', plan);
    try {
      setLoading(true);
      const res = await api.post('/subscription/initiate-payment', {
        planId: plan._id,
        amount: calculateTotal(),
        coupon: couponApplied ? couponCode : null,
      });

      if (res.success) {
        const { paymentUrl, formData } = res.data;
        navigation.navigate('PaymentScreen', { paymentUrl, formData });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyCoupon = () => {
    if (couponCode.trim()) {
      setCouponApplied(true);
    }
  };

  const calculateDiscount = () => {
    if (couponApplied) {
      // Assuming a 10% discount for demonstration
      const price = parseFloat(
        plan.discountedPrice.replace('₹', '').replace(',', ''),
      );
      return (price * 0.1).toFixed(2);
    }
    return 0;
  };

  const calculateTotal = () => {
    const price = parseFloat(
      plan.discountedPrice.replace('₹', '').replace(',', ''),
    );
    const discount = parseFloat(calculateDiscount());
    const subtotal = price - discount;
    const gst = subtotal * 0.18; // 18% GST
    return (subtotal + gst).toFixed(2);
  };

  const hexToRgba = (hex, alpha = 1) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const calculateGST = () => {
    const price = parseFloat(
      plan.discountedPrice.replace('₹', '').replace(',', ''),
    );
    const discount = calculateDiscount();
    const total = (price - discount).toFixed(2);
    const gst = (total * 0.18).toFixed(2);
    return gst;
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Navbar title="Review Order" />
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          padding: 16,
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Selected Plan Details */}
          <View
            style={{
              //backgroundColor: theme.colors.elevation.level2,
              backgroundColor: hexToRgba(plan.color, 0.15),
              borderRadius: 8,
              borderWidth: 2,
              borderColor: plan.color,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text
              variant="titleMedium"
              style={{ fontWeight: 'bold', marginBottom: 8 }}
            >
              Selected Plan
            </Text>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodyLarge" style={{ fontWeight: 'bold' }}>
                  {plan.name}
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.secondary }}
                >
                  {plan.monthlyPrice}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="bodyLarge" style={{ fontWeight: 'bold' }}>
                  {plan.discountedPrice}
                </Text>
                {plan.originalPrice !== plan.discountedPrice && (
                  <Text
                    variant="bodySmall"
                    style={{
                      textDecorationLine: 'line-through',
                      color: theme.colors.error,
                    }}
                  >
                    {plan.originalPrice}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Coupon Section */}
          <View
            style={{
              backgroundColor: theme.colors.elevation.level2,
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text
              variant="titleMedium"
              style={{ fontWeight: 'bold', marginBottom: 12 }}
            >
              Apply Coupon
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                placeholder="Enter coupon code"
                value={couponCode}
                onChangeText={setCouponCode}
                style={{
                  flex: 1,
                  height: 40,
                  backgroundColor: theme.colors.surface,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 4,
                  marginRight: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.outline,
                }}
              />
              <Button
                mode="contained"
                onPress={applyCoupon}
                disabled={!couponCode.trim() || couponApplied}
                style={{
                  backgroundColor: theme.colors.primary,
                  borderRadius: 4,
                  height: 40,
                }}
                labelStyle={{ color: theme.colors.onPrimary }}
              >
                Apply
              </Button>
            </View>

            {couponApplied && (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.primary, marginTop: 8 }}
              >
                Coupon applied successfully!
              </Text>
            )}
          </View>

          {/* Price Details */}
          <View
            style={{
              backgroundColor: theme.colors.elevation.level2,
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text
              variant="titleMedium"
              style={{ fontWeight: 'bold', marginBottom: 12 }}
            >
              Price Details
            </Text>

            <View style={{ marginBottom: 12 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Text variant="bodyMedium">Plan Price</Text>
                <Text variant="bodyMedium">{plan.discountedPrice}</Text>
              </View>

              {couponApplied && (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <Text variant="bodyMedium">Coupon Discount</Text>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.primary }}
                  >
                    -₹{calculateDiscount()}
                  </Text>
                </View>
              )}
            </View>

            <Divider style={{ marginVertical: 8 }} />

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Text variant="bodyMedium">GST (18%)</Text>
              <Text variant="bodyMedium">+₹{calculateGST()}</Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text variant="bodyLarge" style={{ fontWeight: 'bold' }}>
                Total Amount (incl. GST)
              </Text>
              <Text variant="bodyLarge" style={{ fontWeight: 'bold' }}>
                ₹{calculateTotal()}
              </Text>
            </View>
          </View>

          {/* Features Included */}
          <View
            style={{
              backgroundColor: theme.colors.elevation.level2,
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text
              variant="titleMedium"
              style={{ fontWeight: 'bold', marginBottom: 12 }}
            >
              Features Included
            </Text>

            {plan.features.map((feature, index) => (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: theme.colors.primary,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 12 }}>✓</Text>
                </View>
                <Text variant="bodyMedium" style={{ flex: 1 }}>
                  {feature}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Continue Button */}
        <Button
          mode="contained"
          style={{
            paddingVertical: 6,
            borderRadius: 8,
            marginTop: 16,
          }}
          onPress={initiatePayment}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            'Continue to Payment'
          )}
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default ReviewOrder;
