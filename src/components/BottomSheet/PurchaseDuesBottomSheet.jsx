import React, { forwardRef, useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  SegmentedButtons,
  Portal,
  Snackbar,
  Card,
  Divider,
} from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';
import * as Yup from 'yup';
import api from '../../utils/api';
import Toast from 'react-native-toast-message';
import CustomAlert from '../CustomAlert';

const PurchaseDuesBottomSheet = forwardRef(
  ({ invoiceData = {}, onPaymentSuccess }, ref) => {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ visible: false, message: '' });
    const [alert, setAlert] = useState({
      visible: false,
      title: '',
      message: '',
      type: 'error',
    });

    const [form, setForm] = useState({
      amount: '',
      paymentMethod: 'cash',
    });

    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});

    // Calculate due amount
    const dueAmount = invoiceData?.amountDue;

    console.log('amount--->', dueAmount);

    // Auto-fill amount when invoiceData changes
    useEffect(() => {
      if (invoiceData && dueAmount > 0) {
        setForm(prev => ({
          ...prev,
          amount: dueAmount.toFixed(0),
        }));
      }
    }, [invoiceData, dueAmount]);

    // Validation Schema
    const validationSchema = Yup.object().shape({
      amount: Yup.number()
        .typeError('Amount must be a number')
        .positive('Amount must be positive')
        .required('Amount is required')
        .max(dueAmount, `Amount cannot exceed due amount (₹${dueAmount})`)
        .min(1, 'Amount must be at least ₹1'),
      paymentMethod: Yup.string()
        .oneOf(
          ['cash', 'card', 'upi', 'bank_transfer'],
          'Invalid payment method',
        )
        .required('Payment method is required'),

      note: Yup.string().max(100, 'Note cannot exceed 100 characters'),
    });

    const handleChange = (field, value) => {
      setForm(prev => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }));
      }
    };

    const handleBlur = field => {
      setTouched(prev => ({ ...prev, [field]: true }));
      validateField(field, form[field]);
    };

    const validateField = async (field, value) => {
      try {
        await validationSchema.validateAt(field, { [field]: value });
        setErrors(prev => ({ ...prev, [field]: '' }));
        return true;
      } catch (error) {
        setErrors(prev => ({ ...prev, [field]: error.message }));
        return false;
      }
    };

    const validateForm = async () => {
      try {
        await validationSchema.validate(form, { abortEarly: false });
        setErrors({});
        return true;
      } catch (error) {
        const newErrors = {};
        error.inner.forEach(err => {
          newErrors[err.path] = err.message;
        });
        setErrors(newErrors);

        setTouched({
          amount: true,
          paymentMethod: true,
        });

        return false;
      }
    };

    const showAlert = (title, message, type = 'error') => {
      setAlert({
        visible: true,
        title,
        message,
        type,
      });
    };

    const hideAlert = () => {
      setAlert({
        visible: false,
        title: '',
        message: '',
        type: 'error',
      });
    };

    const handlePayment = async () => {
      const isValid = await validateForm();
      if (!isValid) return;

      setLoading(true);

      try {
        // CORRECT VENDOR PAYMENT API
        const response = await api.post(
          `/purchase/add-payment/${invoiceData._id}`,
          {
            amount: parseFloat(form.amount),
            paymentMethod: form.paymentMethod,
            note: form.note,
          },
        );

        // console.log('Payment response:', response);

        if (response.success) {
          Toast.show({
            type: 'success',
            text1: 'Payment sent successfully!',
          });

          onPaymentSuccess?.(response.data);

          setTimeout(() => {
            ref.current?.close();
            resetForm();
          }, 1500);
        }
      } catch (error) {
        // console.log('Payment error:', error);

        if (error.response?.data?.success === false) {
          const errorMessage = error.response.data.message || 'Payment failed';
          const detailedError = error.response.data.errors?.[0]?.message;

          showAlert('Payment Failed', detailedError || errorMessage, 'error');
        } else {
          showAlert(
            'Network Error',
            'Unable to process payment. Please check your connection.',
            'error',
          );
        }
      } finally {
        setLoading(false);
      }
    };

    const resetForm = () => {
      setForm({
        amount: '',
        paymentMethod: 'cash',
      });
      setErrors({});
      setTouched({});
    };

    const handleClose = () => {
      resetForm();
      ref.current?.close();
    };

    const setFullAmount = () => {
      handleChange('amount', dueAmount.toString());
    };

    const paymentMethods = [
      { value: 'cash', label: 'Cash', icon: 'cash' },
      { value: 'card', label: 'Card', icon: 'credit-card' },
      { value: 'upi', label: 'UPI', icon: 'cellphone' },
      { value: 'bank_transfer', label: 'Bank Transfer', icon: 'bank' },
    ];

    const formatCurrency = amount =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
      }).format(amount);

    return (
      <>
        <BaseBottomSheet
          ref={ref}
          title="Send Payment"
          snapPoints={['75%']}
          showHeader
          initialSnapIndex={-1}
          contentType="scroll"
          contentContainerStyle={{
            backgroundColor: theme.colors.surface,
          }}
          footerComponent={
            <View
              style={[
                styles.footer,
                {
                  backgroundColor: theme.colors.surface,
                  borderTopColor: theme.colors.outline,
                },
              ]}
            >
              <Button
                mode="outlined"
                onPress={handleClose}
                style={styles.cancelButton}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                icon="check-circle"
                onPress={handlePayment}
                style={styles.payButton}
                loading={loading}
                disabled={loading || !form.amount || dueAmount <= 0}
              >
                Send Payment
              </Button>
            </View>
          }
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
          >
            {/* Purchase Summary */}
            <Card
              style={[
                styles.summaryCard,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <Card.Content>
                <View style={styles.summaryRow}>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Purchase Number
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurface, fontWeight: '500' }}
                  >
                    {invoiceData?.invoiceNumber || 'N/A'}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Grand Total
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurface, fontWeight: '500' }}
                  >
                    {formatCurrency(Math.round(invoiceData?.grandTotal) || 0)}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Already Paid
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.primary, fontWeight: '500' }}
                  >
                    {formatCurrency(invoiceData?.amountPaid || 0)}
                  </Text>
                </View>

                <Divider style={{ marginVertical: 8 }} />

                <View style={styles.summaryRow}>
                  <Text
                    variant="titleSmall"
                    style={{ color: theme.colors.error, fontWeight: '600' }}
                  >
                    Due Amount
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ color: theme.colors.error, fontWeight: '700' }}
                  >
                    {formatCurrency(dueAmount)}
                  </Text>
                </View>
              </Card.Content>
            </Card>

            {/* Amount Input */}
            <View style={styles.inputContainer}>
              <TextInput
                label="Payment Amount"
                mode="outlined"
                value={form.amount}
                onChangeText={text =>
                  handleChange('amount', text.replace(/[^0-9]/g, ''))
                }
                onBlur={() => handleBlur('amount')}
                style={styles.input}
                left={<TextInput.Icon icon="currency-inr" />}
                right={
                  dueAmount > 0 ? (
                    <TextInput.Icon
                      icon="autorenew"
                      onPress={setFullAmount}
                      forceTextInputFocus={false}
                    />
                  ) : null
                }
                keyboardType="decimal-pad"
                error={touched.amount && !!errors.amount}
                disabled={dueAmount <= 0}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
                theme={{ roundness: 12 }}
              />

              {touched.amount && errors.amount && (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.amount}
                </Text>
              )}

              {dueAmount <= 0 && (
                <Text
                  style={[
                    styles.infoText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  This purchase is already fully paid.
                </Text>
              )}
            </View>

            {/* Payment Method */}
            <View style={styles.paymentMethodSection}>
              <Text
                variant="titleSmall"
                style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
              >
                Payment Method
              </Text>
              <SegmentedButtons
                value={form.paymentMethod}
                onValueChange={value => handleChange('paymentMethod', value)}
                buttons={paymentMethods}
                style={styles.segmentedButtons}
              />

              <TextInput
                label="Payment Reference"
                mode="outlined"
                value={form.reference}
                onChangeText={text => handleChange('note', text)}
                onBlur={() => handleBlur('note')}
                style={styles.input}
                theme={{ roundness: 12 }}
                contentStyle={styles.inputContent}
                error={touched.reference && !!errors.reference}
              />

              {touched.reference && errors.reference && (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.reference}
                </Text>
              )}
            </View>
          </KeyboardAvoidingView>
        </BaseBottomSheet>

        {/* Success Snackbar */}
        <Portal>
          <Snackbar
            visible={snackbar.visible}
            onDismiss={() => setSnackbar({ visible: false, message: '' })}
            duration={3000}
            style={{ backgroundColor: theme.colors.primary }}
            action={{
              label: 'OK',
              onPress: () => setSnackbar({ visible: false, message: '' }),
            }}
          >
            {snackbar.message}
          </Snackbar>
        </Portal>

        {/* Custom Alert */}
        <CustomAlert
          visible={alert.visible}
          onDismiss={hideAlert}
          title={alert.title}
          message={alert.message}
          type={alert.type}
          actions={[
            {
              label: 'OK',
              onPress: hideAlert,
              mode: 'contained',
            },
          ]}
        />
      </>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  summaryCard: { marginBottom: 16, borderRadius: 12 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputContainer: { marginBottom: 16 },
  input: { marginBottom: 4 },
  errorText: { fontSize: 12, marginBottom: 12, marginLeft: 4 },
  infoText: {
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  paymentMethodSection: { marginTop: 8 },
  sectionTitle: { marginBottom: 12, fontWeight: '600' },
  segmentedButtons: { marginBottom: 8 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: { flex: 1 },
  payButton: { flex: 2 },
});

export default PurchaseDuesBottomSheet;
