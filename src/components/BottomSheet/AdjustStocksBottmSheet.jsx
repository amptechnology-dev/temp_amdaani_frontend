import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  SegmentedButtons,
  useTheme,
  HelperText,
  Divider,
  IconButton,
} from 'react-native-paper';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { parseISO, format, isValid } from 'date-fns';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import BaseBottomSheet from './BaseBottomSheet';
import api from '../../utils/api';
import Toast from 'react-native-toast-message';

// ✅ Validation Schema
const validationSchema = Yup.object().shape({
  actionType: Yup.string().required('Please select an action'),

  adjustmentDate: Yup.date()
    .transform((value, originalValue) => {
      if (originalValue instanceof Date && isValid(originalValue))
        return originalValue;
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
    .typeError('Cost Price must be a number')
    .positive('Cost Price be greater than 0')
    .required('Cost Price is required'),

  reason: Yup.object().nullable().required('Reason is required'),

  remarks: Yup.string()
    .max(200, 'Remarks can be up to 200 characters')
    .nullable(),
});

const AdjustStockBottomSheet = React.forwardRef(
  (
    {
      productId,
      costPrice,
      onStockAdjusted, // callback after success
      title = 'Adjust Stock',
      snapPoints = ['70%', '90%'],
      selectedReason,
      onOpenReason,
      initialSnapIndex = -1,
      onActionTypeChange,
      ...props
    },
    ref,
  ) => {
    const theme = useTheme();
    const [isDatePickerVisible, setDatePickerVisible] = useState(false);
    const [reason, setReason] = useState(null);

    const initialValues = {
      actionType: 'add',
      adjustmentDate: new Date(),
      quantity: '',
      rate: costPrice?.toString() || '',
      reason: null,
      remarks: '',
    };

    const SyncReasonWithFormik = ({ selectedReason, setFieldValue }) => {
      useEffect(() => {
        if (selectedReason) {
          setFieldValue('reason', selectedReason);
        }
      }, [selectedReason, setFieldValue]);

      return null;
    };

    useEffect(() => {
      setReason(selectedReason);
    }, [selectedReason]);

    const handleClose = useCallback(() => {
      if (ref?.current) ref.current.close();
    }, [ref]);

    // ✅ Safe date formatter
    const formatDate = date =>
      isValid(date) ? format(date, 'dd/MM/yyyy') : '';

    const handleSubmit = async (values, { resetForm, setSubmitting }) => {
      try {
        const formattedDate = format(values.adjustmentDate, 'yyyy-MM-dd');
        const finalQuantity =
          values.actionType === 'reduce'
            ? -Math.abs(values.quantity)
            : Math.abs(values.quantity);

        const body = {
          productId,
          quantity: finalQuantity,
          rate: Number(values.rate),
          remarks: values.remarks || '',
          reason: reason,
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
          await onStockAdjusted?.(res);
          resetForm();
          handleClose();
        } else {
          throw new Error(res.message || 'Failed to adjust stock');
        }
      } catch (error) {
        // console.log('❌ Adjust Stock Error:', error.message);
        Alert.alert('Error', error.message || 'Something went wrong');
      } finally {
        setSubmitting(false);
      }
    };

    // 🧱 Header Component
    const renderHeader = useMemo(
      () => (
        <View style={styles.customHeader}>
          <View style={styles.titleHeader}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {title}
            </Text>
            <IconButton
              icon="close"
              size={24}
              iconColor={theme.colors.onSurface}
              onPress={handleClose}
            />
          </View>
          <Divider bold />
        </View>
      ),
      [theme, title, handleClose],
    );

    // 📄 Form UI
    const FormContent = useMemo(
      () => (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
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
              setFieldTouched,
              handleChange,
              handleBlur,
              handleSubmit,
              isSubmitting,
            }) => (
              <>
                <SyncReasonWithFormik
                  selectedReason={selectedReason}
                  setFieldValue={setFieldValue}
                  setFieldTouched={setFieldTouched}
                />
                <ScrollView
                  style={styles.container}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* 🔘 Action Type */}
                  <Text style={styles.label}>Select Action</Text>
                  <SegmentedButtons
                    value={values.actionType}
                    onValueChange={val => {
                      setFieldValue('actionType', val);
                      onActionTypeChange?.(val);
                    }}
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
                  />
                  <HelperText
                    type="error"
                    visible={!!errors.actionType && touched.actionType}
                  >
                    {errors.actionType}
                  </HelperText>

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
                  {errors.adjustmentDate && touched.adjustmentDate && (
                    <HelperText type="error" visible={true}>
                      {errors.adjustmentDate}
                    </HelperText>
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
                  {errors.quantity && touched.quantity && (
                    <HelperText type="error" visible={true}>
                      {errors.quantity}
                    </HelperText>
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
                  {errors.rate && touched.rate && (
                    <HelperText type="error" visible={true}>
                      {errors.rate}
                    </HelperText>
                  )}

                  <TouchableOpacity activeOpacity={0.7} onPress={onOpenReason}>
                    <TextInput
                      label="Select Reason *"
                      mode="outlined"
                      value={reason?.name || ''}
                      editable={false}
                      left={<TextInput.Icon icon="file-document-outline" />}
                      right={<TextInput.Icon icon="chevron-down" />}
                      pointerEvents="none"
                      style={styles.input}
                      error={touched.reason && !reason}
                      theme={{ roundness: 12 }}
                    />
                  </TouchableOpacity>

                  {touched.reason && !reason && (
                    <HelperText type="error">Reason is required</HelperText>
                  )}

                  {errors.reason && touched.reason && (
                    <HelperText type="error">{errors.reason}</HelperText>
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
                    left={<TextInput.Icon icon="note-text-outline" />}
                    theme={{ roundness: 12 }}
                  />
                  {errors.remarks && touched.remarks && (
                    <HelperText type="error" visible={true}>
                      {errors.remarks}
                    </HelperText>
                  )}

                  {/* 🟩 Submit Button */}
                  <View style={styles.actions}>
                    <Button
                      mode="contained"
                      onPress={handleSubmit}
                      loading={isSubmitting}
                      disabled={isSubmitting}
                      style={styles.submitButton}
                      labelStyle={styles.buttonLabel}
                    >
                      {values.actionType === 'add'
                        ? 'Add Stock'
                        : 'Reduce Stock'}
                    </Button>
                  </View>
                </ScrollView>
              </>
            )}
          </Formik>
        </KeyboardAvoidingView>
      ),
      [isDatePickerVisible, theme, reason, onOpenReason],
    );

    return (
      <BaseBottomSheet
        ref={ref}
        title={title}
        contentType="scroll"
        headerComponent={renderHeader}
        initialSnapIndex={initialSnapIndex}
        snapPoints={snapPoints}
        keyboardBehavior="interactive"
        enablePanDownToClose={true}
        enableDismissOnClose={true}
        {...props}
      >
        {FormContent}
      </BaseBottomSheet>
    );
  },
);

AdjustStockBottomSheet.displayName = 'AdjustStockBottomSheet';

export default AdjustStockBottomSheet;

const styles = StyleSheet.create({
  customHeader: {},
  titleHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
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
    marginBottom: 8,
  },
  actions: {
    paddingVertical: 16,
    marginBottom: 30,
  },
  submitButton: {
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
