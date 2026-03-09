import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Button,
  TextInput,
  HelperText,
  Divider,
  useTheme,
  SegmentedButtons,
  IconButton,
} from 'react-native-paper';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import BaseBottomSheet from './BaseBottomSheet';
import ExpenseHeadSelectorBottomSheet from './ExpenseHeadSelectorBottomSheet';
import api from '../../utils/api';
import Toast from 'react-native-toast-message';

const AddExpenseBottomSheet = React.forwardRef(
  (
    {
      onExpenseCreated,
      onExpenseUpdated,
      expenseToEdit = null,
      title = 'Add Expense',
      snapPoints = ['70%', '90%'],
      ...props
    },
    ref,
  ) => {
    const theme = useTheme();
    const headSelectorRef = useRef(null);

    // Form states
    const [date, setDate] = useState(new Date());
    const [head, setHead] = useState(null);
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [paidTo, setPaidTo] = useState('');
    const [notes, setNotes] = useState('');
    const [invoiceRef, setInvoiceRef] = useState('');
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDatePickerVisible, setDatePickerVisible] = useState(false);

    // Payment method options
    const paymentMethods = [
      {
        value: 'cash',
        label: 'Cash',
        icon: 'cash',
      },
      {
        value: 'UPI',
        label: 'UPI',
        icon: 'cellphone',
      },
      {
        value: 'card',
        label: 'Card',
        icon: 'credit-card',
      },
      {
        value: 'bank transfer',
        label: 'Bank Transfer',
        icon: 'bank-transfer',
      },
    ];

    // Check if we're in edit mode
    const isEditMode = useMemo(() => Boolean(expenseToEdit), [expenseToEdit]);

    // Populate form when expenseToEdit changes
    useEffect(() => {
      if (expenseToEdit) {
        setDate(new Date(expenseToEdit.date));
        setHead(expenseToEdit.head?.[0] || expenseToEdit.head || null);
        setAmount(expenseToEdit.amount?.toString() || '');
        setPaymentMethod(expenseToEdit.paymentMethod || '');
        setPaidTo(expenseToEdit.paidTo || '');
        setNotes(expenseToEdit.notes || '');
        setInvoiceRef(expenseToEdit.invoiceRef || '');
      }
    }, [expenseToEdit]);

    // Reset when closed
    const resetForm = useCallback(() => {
      setDate(new Date());
      setHead(null);
      setAmount('');
      setPaymentMethod('');
      setPaidTo('');
      setNotes('');
      setInvoiceRef('');
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
    }, []);

    const handleClose = useCallback(() => {
      resetForm();
      ref?.current?.close();
    }, [ref, resetForm]);

    useEffect(() => {
      if (!expenseToEdit) {
        resetForm(); // only reset if not editing
      }
    }, [expenseToEdit]);

    // Handle field blur
    const handleBlur = useCallback(fieldName => {
      setTouched(prev => ({
        ...prev,
        [fieldName]: true,
      }));
    }, []);

    // Validation
    const validateForm = useCallback(() => {
      const newErrors = {};
      if (!date) newErrors.date = 'Date is required';
      if (!head) newErrors.head = 'Expense head is required';
      if (!amount || isNaN(amount) || Number(amount) <= 0)
        newErrors.amount = 'Valid amount is required';
      if (!paymentMethod.trim())
        newErrors.paymentMethod = 'Payment method is required';
      if (!paidTo.trim()) newErrors.paidTo = 'Paid To is required';

      // Mark all fields as touched when submitting
      setTouched({
        date: true,
        head: true,
        amount: true,
        paymentMethod: true,
        paidTo: true,
      });

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }, [date, head, amount, paymentMethod, paidTo]);

    // Field-specific validation
    const validateField = useCallback(
      (fieldName, value) => {
        const newErrors = { ...errors };

        switch (fieldName) {
          case 'date':
            if (!value) newErrors.date = 'Date is required';
            else delete newErrors.date;
            break;
          case 'head':
            if (!value) newErrors.head = 'Expense head is required';
            else delete newErrors.head;
            break;
          case 'amount':
            if (!value || isNaN(value) || Number(value) <= 0)
              newErrors.amount = 'Valid amount is required';
            else delete newErrors.amount;
            break;
          case 'paymentMethod':
            if (!value.trim())
              newErrors.paymentMethod = 'Payment method is required';
            else delete newErrors.paymentMethod;
            break;
          case 'paidTo':
            if (!value.trim()) newErrors.paidTo = 'Paid To is required';
            else delete newErrors.paidTo;
            break;
          default:
            break;
        }

        setErrors(newErrors);
      },
      [errors],
    );

    // Handle amount change with validation
    const handleAmountChange = useCallback(
      text => {
        setAmount(text);
        if (touched.amount) {
          validateField('amount', text);
        }
      },
      [touched.amount, validateField],
    );

    // Handle paidTo change with validation
    const handlePaidToChange = useCallback(
      text => {
        setPaidTo(text);
        if (touched.paidTo) {
          validateField('paidTo', text);
        }
      },
      [touched.paidTo, validateField],
    );

    // Handle date selection with validation
    const handleDateSelect = useCallback(
      newDate => {
        setDate(newDate);
        setDatePickerVisible(false);
        if (touched.date) {
          validateField('date', newDate);
        }
      },
      [touched.date, validateField],
    );

    // Handle head selection with validation
    const handleHeadSelect = useCallback(
      selected => {
        setHead(selected);
        headSelectorRef.current?.close();
        if (touched.head) {
          validateField('head', selected);
        }
      },
      [touched.head, validateField, headSelectorRef],
    );

    // Handle payment method change with validation
    const handlePaymentMethodChange = useCallback(
      method => {
        setPaymentMethod(method);
        if (touched.paymentMethod) {
          validateField('paymentMethod', method);
        }
      },
      [touched.paymentMethod, validateField],
    );

    // Submit for both add and update
    const handleSubmit = useCallback(async () => {
      if (!validateForm()) return;

      setIsSubmitting(true);
      try {
        // ✅ Normalize date
        const normalizedDate = new Date(date);
        if (isNaN(normalizedDate)) throw new Error('Invalid Date selected');

        const body = {
          date: new Date(
            normalizedDate.getTime() -
            normalizedDate.getTimezoneOffset() * 60000,
          )
            .toISOString()
            .split('T')[0],
          head: head._id,
          amount: Number(amount),
          paymentMethod: paymentMethod.trim(),
          paidTo: paidTo.trim(),
          notes: notes.trim(),
          invoiceRef: invoiceRef.trim(),
        };

        // console.log(`${isEditMode ? 'Update' : 'Create'} Expense Body:`, body);

        let res;
        if (isEditMode) {
          // Update existing expense
          res = await api.put(`/expense/id/${expenseToEdit._id}`, body);
          // console.log('Update Expense Response:', res);
        } else {
          // Create new expense
          res = await api.post('/expense', body);
          // console.log('Create Expense Response:', res);
        }

        if (res.success) {
          Toast.show({
            type: 'success',
            text1: isEditMode ? 'Expense Updated' : 'Expense Added',
            text2:
              res.message ||
              `Expense ${isEditMode ? 'updated' : 'created'} successfully!`,
          });

          if (isEditMode) {
            onExpenseUpdated?.(res);
          } else {
            onExpenseCreated?.(res);
          }

          handleClose();
        } else {
          Alert.alert(
            'Error',
            res.message ||
            `Failed to ${isEditMode ? 'update' : 'create'} expense.`,
          );
        }
      } catch (error) {
        console.error(
          `Error ${isEditMode ? 'updating' : 'creating'} expense:`,
          error,
        );
        Alert.alert(
          'Error',
          `Failed to ${isEditMode ? 'update' : 'create'
          } expense. Please try again.`,
        );
      } finally {
        setIsSubmitting(false);
      }
    }, [
      date,
      head,
      amount,
      paymentMethod,
      paidTo,
      notes,
      invoiceRef,
      validateForm,
      handleClose,
      onExpenseCreated,
      onExpenseUpdated,
      isEditMode,
      expenseToEdit,
    ]);

    // Open expense head selector
    const openExpenseHeadSelector = useCallback(() => {
      ref?.current?.close();
      headSelectorRef.current?.expand();
    }, []);

    const renderHeader = useMemo(
      () => (
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {isEditMode ? 'Edit Expense' : title}
            </Text>
            <IconButton
              icon="close"
              size={24}
              onPress={handleClose}
              iconColor={theme.colors.onSurface}
            />
          </View>
          <Divider style={styles.divider} />
        </View>
      ),
      [theme, title, handleClose, isEditMode],
    );

    const formattedDate = useMemo(
      () => date.toISOString().split('T')[0],
      [date],
    );

    // Get error state for TextInput
    const getErrorState = useCallback(
      fieldName => {
        return touched[fieldName] && errors[fieldName];
      },
      [touched, errors],
    );

    return (
      <>
        {/* Expense Head Selector */}
        <ExpenseHeadSelectorBottomSheet
          ref={headSelectorRef}
          onExpenseHeadSelect={handleHeadSelect}
          selectedExpenseHead={head}
          addExpenseSheetRef={ref}
        />

        {/* Main Bottom Sheet */}
        <BaseBottomSheet
          ref={ref}
          initialSnapIndex={-1}
          title={isEditMode ? 'Edit Expense' : title}
          headerComponent={renderHeader}
          contentType="scroll"
          snapPoints={snapPoints}
          enablePanDownToClose
          enableDismissOnClose
          {...props}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.formContainer}
          >
            <View style={styles.form}>
              {/* Date Picker */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setDatePickerVisible(true);
                  handleBlur('date');
                }}
              >
                <TextInput
                  label="Date *"
                  value={formattedDate}
                  mode="outlined"
                  style={styles.input}
                  editable={false}
                  left={<TextInput.Icon icon="calendar" />}
                  right={<TextInput.Icon icon="chevron-down" />}
                  pointerEvents="none"
                  theme={{ roundness: 12 }}
                  error={getErrorState('date')}
                />
              </TouchableOpacity>
              {getErrorState('date') && (
                <HelperText type="error" visible={!!errors.date}>
                  {errors.date}
                </HelperText>
              )}

              <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                date={date}
                onConfirm={handleDateSelect}
                onCancel={() => setDatePickerVisible(false)}
              />

              {/* Expense Head */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  openExpenseHeadSelector();
                  handleBlur('head');
                }}
              >
                <TextInput
                  label="Expense Head *"
                  value={head?.name || ''}
                  mode="outlined"
                  style={styles.input}
                  editable={false}
                  left={<TextInput.Icon icon="file-document-outline" />}
                  right={<TextInput.Icon icon="chevron-down" />}
                  pointerEvents="none"
                  theme={{ roundness: 12 }}
                  error={getErrorState('head')}
                />
              </TouchableOpacity>
              {getErrorState('head') && (
                <HelperText type="error" visible={!!errors.head}>
                  {errors.head}
                </HelperText>
              )}

              {/* Amount */}
              <TextInput
                label="Amount *"
                mode="outlined"
                keyboardType="numeric"
                value={amount}
                onChangeText={handleAmountChange}
                onBlur={() => handleBlur('amount')}
                style={styles.input}
                left={<TextInput.Icon icon="currency-inr" />}
                theme={{ roundness: 12 }}
                error={getErrorState('amount')}
              />
              {getErrorState('amount') && (
                <HelperText type="error" visible={!!errors.amount}>
                  {errors.amount}
                </HelperText>
              )}

              {/* Payment Method - Segmented Buttons */}
              <View style={styles.paymentMethodContainer}>
                <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                  Payment Method *
                </Text>
                <SegmentedButtons
                  value={paymentMethod}
                  onValueChange={handlePaymentMethodChange}
                  buttons={paymentMethods}
                  style={styles.segmentedButtons}
                  theme={{
                    roundness: 8,
                    colors: {
                      secondaryContainer: theme.colors.primaryContainer,
                    },
                  }}
                />
                {getErrorState('paymentMethod') && (
                  <HelperText type="error" visible={!!errors.paymentMethod}>
                    {errors.paymentMethod}
                  </HelperText>
                )}
              </View>

              {/* Paid To */}
              <TextInput
                label="Paid To *"
                mode="outlined"
                value={paidTo}
                onChangeText={handlePaidToChange}
                onBlur={() => handleBlur('paidTo')}
                style={styles.input}
                left={<TextInput.Icon icon="account-outline" />}
                theme={{ roundness: 12 }}
                error={getErrorState('paidTo')}
              />
              {getErrorState('paidTo') && (
                <HelperText type="error" visible={!!errors.paidTo}>
                  {errors.paidTo}
                </HelperText>
              )}

              {/* Notes */}
              <TextInput
                label="Notes"
                mode="outlined"
                value={notes}
                onChangeText={setNotes}
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
                left={<TextInput.Icon icon="note-outline" />}
                theme={{ roundness: 12 }}
              />

              {/* Invoice Ref */}
              <TextInput
                label="Invoice Reference"
                mode="outlined"
                value={invoiceRef}
                onChangeText={setInvoiceRef}
                style={styles.input}
                left={<TextInput.Icon icon="file-document" />}
                theme={{ roundness: 12 }}
              />

              {/* Submit Button */}
              <View style={styles.actions}>
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  style={styles.submitButton}
                  labelStyle={styles.submitButtonLabel}
                  theme={{ roundness: 12 }}
                >
                  {isSubmitting
                    ? isEditMode
                      ? 'Updating...'
                      : 'Saving...'
                    : isEditMode
                      ? 'Update Expense'
                      : 'Save Expense'}
                </Button>
              </View>
            </View>
          </KeyboardAvoidingView>
        </BaseBottomSheet>
      </>
    );
  },
);

const styles = StyleSheet.create({
  header: {
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
  },
  divider: {
    marginHorizontal: 20,
  },
  formContainer: {
    flex: 1,
  },
  form: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    paddingTop: 4,
  },
  input: {
    marginBottom: 2,
  },
  textArea: {
    minHeight: 80,
  },
  paymentMethodContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 6,
    marginLeft: 4,
  },
  segmentedButtons: {
    marginBottom: 2,
  },
  actions: {
    marginTop: 16,
    marginBottom: 8,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 2,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  submitButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 4,
  },
});

AddExpenseBottomSheet.displayName = 'AddExpenseBottomSheet';

export default AddExpenseBottomSheet;
