import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  SegmentedButtons,
  useTheme,
} from 'react-native-paper';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { parseISO, format, isValid } from 'date-fns'; // ✅ date-fns
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import Navbar from '../../components/Navbar';
import Toast from 'react-native-toast-message';
import { useRoute } from '@react-navigation/native';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

// ✅ Validation Schema with date-fns
const validationSchema = Yup.object().shape({
  actionType: Yup.string().required('Please select an action'),

  adjustmentDate: Yup.date()
    .transform((value, originalValue) => {
      // If it's already a Date instance, return it
      if (originalValue instanceof Date && isValid(originalValue)) {
        return originalValue;
      }

      // Try parsing ISO string or custom string
      const parsed = parseISO(originalValue);
      return isValid(parsed) ? parsed : undefined;
    })
    .typeError('Invalid date format')
    .required('Date is required'),

  quantity: Yup.number()
    .typeError('Quantity must be a number')
    .positive('Quantity must be greater than 0')
    .integer('Quantity must be an integer')
    .required('Quantity is required'),

  rate: Yup.number()
    .typeError('Rate must be a number')
    .positive('Rate must be greater than 0')
    .required('Rate is required'),

  remarks: Yup.string()
    .max(200, 'Remarks can be up to 200 characters')
    .nullable(),
});

const AdjustStock = ({ navigation }) => {
  const theme = useTheme();
  const { isStockEnabled } = useAuth();
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const route = useRoute();
  const { id, costPrice, name, currentStock } = route.params;

  useEffect(() => {
    if (!isStockEnabled) {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Stock management is disabled',
      });
      navigation.goBack();
    }
  }, [isStockEnabled, navigation]);

  const initialValues = {
    actionType: 'add',
    adjustmentDate: new Date(),
    quantity: '',
    rate: costPrice?.toString() || '',
    remarks: '',
  };

  const handleSubmit = async (values, { resetForm, setSubmitting }) => {
    try {
      // ✅ Use date-fns for formatting ISO date
      // ✅ Format date as YYYY-MM-DD (no time)
      const formattedDate = format(values.adjustmentDate, 'yyyy-MM-dd');

      const finalQuantity =
        values.actionType === 'reduce'
          ? -Math.abs(values.quantity)
          : Math.abs(values.quantity);

      const body = {
        productId: id,
        quantity: finalQuantity,
        rate: Number(values.rate),
        remarks: values.remarks || '',
        date: formattedDate,
      };

      // console.log('📤 Final API Body:', body);

      const res = await api.post('/product/adjust-stock', body);

      // console.log('✅ Adjust Stock Response:', res);

      if (res.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: res.message || 'Stock adjusted successfully!',
        });
        resetForm();
        navigation.goBack();
      } else {
        throw new Error(res.message || 'Failed to adjust stock');
      }
    } catch (error) {
      // console.log('❌ Adjust Stock Error:', error.message);
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: error.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ Safe date formatter
  const formatDate = date => {
    if (!isValid(date)) return '';
    return format(date, 'dd/MM/yyyy');
  };

  useEffect(() => {
    // console.log('Id and Cost Price:', id, costPrice);
  }, [id, costPrice]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({
          values,
          errors,
          touched,
          setFieldValue,
          handleChange,
          handleBlur,
          handleSubmit,
          isSubmitting,
        }) => (
          <>
            <Navbar
              title="Adjust Stock"
              showBackButton={true}
              onBackPress={() => navigation.goBack()}
            />

            <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
              <ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* 🔘 Action Type */}
                <Text style={styles.label}>Select Action</Text>
                <SegmentedButtons
                  value={values.actionType}
                  onValueChange={val => setFieldValue('actionType', val)}
                  buttons={[
                    {
                      value: 'add',
                      label: 'Add Stock',
                      icon: 'plus-circle-outline',
                    },
                    {
                      value: 'reduce',
                      label: 'Reduce Stock',
                      icon: 'minus-circle-outline',
                    },
                  ]}
                  style={{ marginBottom: 10 }}
                />
                {touched.actionType && errors.actionType && (
                  <Text
                    style={[styles.errorText, { color: theme.colors.error }]}
                  >
                    {errors.actionType}
                  </Text>
                )}

                {/* 📅 Date Picker */}
                <TextInput
                  label="Adjustment Date"
                  mode="outlined"
                  value={formatDate(values.adjustmentDate)}
                  style={styles.input}
                  editable={false}
                  right={
                    <TextInput.Icon
                      icon="calendar"
                      onPress={() => setDatePickerVisible(true)}
                    />
                  }
                  theme={{ roundness: 12 }}
                />
                {touched.adjustmentDate && errors.adjustmentDate && (
                  <Text
                    style={[styles.errorText, { color: theme.colors.error }]}
                  >
                    {errors.adjustmentDate}
                  </Text>
                )}

                <DateTimePickerModal
                  isVisible={isDatePickerVisible}
                  mode="date"
                  date={values.adjustmentDate || new Date()}
                  onConfirm={date => {
                    setDatePickerVisible(false);
                    setFieldValue('adjustmentDate', date);
                  }}
                  onCancel={() => setDatePickerVisible(false)}
                />

                {/* 📦 Quantity */}
                <TextInput
                  label="Quantity"
                  mode="outlined"
                  value={values.quantity}
                  onChangeText={handleChange('quantity')}
                  onBlur={handleBlur('quantity')}
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder="Enter quantity"
                  left={<TextInput.Icon icon="cube-outline" />}
                  theme={{ roundness: 12 }}
                />
                {touched.quantity && errors.quantity && (
                  <Text
                    style={[styles.errorText, { color: theme.colors.error }]}
                  >
                    {errors.quantity}
                  </Text>
                )}

                {/* 💰 Rate */}
                <TextInput
                  label="Cost Price"
                  mode="outlined"
                  value={values.rate}
                  onChangeText={handleChange('rate')}
                  onBlur={handleBlur('rate')}
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder="Enter cost price"
                  left={<TextInput.Icon icon="currency-inr" />}
                  theme={{ roundness: 12 }}
                />
                {touched.rate && errors.rate && (
                  <Text
                    style={[styles.errorText, { color: theme.colors.error }]}
                  >
                    {errors.rate}
                  </Text>
                )}

                {/* 📝 Remarks */}
                <TextInput
                  label="Remarks (Optional)"
                  mode="outlined"
                  value={values.remarks}
                  onChangeText={handleChange('remarks')}
                  onBlur={handleBlur('remarks')}
                  style={styles.input}
                  placeholder="Enter remarks"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  theme={{ roundness: 12 }}
                  left={<TextInput.Icon icon="note-text-outline" />}
                />
                {touched.remarks && errors.remarks && (
                  <Text
                    style={[styles.errorText, { color: theme.colors.error }]}
                  >
                    {errors.remarks}
                  </Text>
                )}
              </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}>
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={isSubmitting}
                style={styles.submitButton}
                labelStyle={{ fontSize: 16, fontWeight: '600' }}
              >
                {values.actionType === 'add' ? 'Add Stock' : 'Reduce Stock'}
              </Button>
            </View>
          </>
        )}
      </Formik>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'transparent',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    marginTop: -6,
    marginLeft: 8,
    marginBottom: 6,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  submitButton: {
    borderRadius: 10,
  },
});

export default AdjustStock;
