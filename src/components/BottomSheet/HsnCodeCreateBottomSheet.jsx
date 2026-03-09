// components/BottomSheet/AddHsnCodeBottomSheet.jsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  useTheme,
  Button,
  TextInput,
  HelperText,
  IconButton,
  Divider,
  Chip,
} from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';
import api from '../../utils/api';
import Toast from 'react-native-toast-message';

const AddHsnCodeBottomSheet = React.forwardRef(
  (
    {
      onCreateHsnCode,
      onUpdateHsnCode,
      hsnCode = null,
      title = 'Add HSN Code',
      snapPoints = ['60%', '80%'],
      initialSnapIndex = -1,
      ...props
    },
    ref,
  ) => {
    const theme = useTheme();

    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [gstRate, setGstRate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    // Common GST rates for quick selection
    const commonGstRates = [0, 5, 12, 18, 28];

    //  If hsnCode is passed (Update mode), pre-fill fields
    useEffect(() => {
      if (hsnCode) {
        setCode(hsnCode.code || '');
        setDescription(hsnCode.description || '');
        setGstRate(hsnCode.gstRate?.toString() || '');
      } else {
        setCode('');
        setDescription('');
        setGstRate('');
      }
      setErrors({});
    }, [hsnCode]);

    // Handle close with form reset
    const handleClose = useCallback(() => {
      setCode('');
      setDescription('');
      setGstRate('');
      setErrors({});
      setIsSubmitting(false);

      if (ref?.current) {
        ref.current.close();
      }
    }, [ref]);

    // Validation
    const validateForm = useCallback(() => {
      const newErrors = {};

      // Code validation
      if (!code.trim()) {
        newErrors.code = 'HSN code is required';
      } else if (!/^\d+$/.test(code.trim())) {
        newErrors.code = 'HSN code must contain only numbers';
      }

      // // Description validation
      // if (!description.trim()) {
      //   newErrors.description = 'Description is required';
      // } else if (description.trim().length < 3) {
      //   newErrors.description = 'Description must be at least 3 characters';
      // } else if (description.trim().length > 200) {
      //   newErrors.description = 'Description must be less than 200 characters';
      // }

      // GST Rate validation
      if (gstRate.trim() === '') {
        newErrors.gstRate = 'GST rate is required';
      } else {
        const rate = parseFloat(gstRate);
        if (isNaN(rate)) {
          newErrors.gstRate = 'GST rate must be a valid number';
        } else if (rate < 0 || rate > 100) {
          newErrors.gstRate = 'GST rate must be between 0 and 100';
        }
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }, [code, description, gstRate]);

    //  Handle Submit (Add or Update)
    const handleSubmit = useCallback(async () => {
      if (!validateForm()) {
        return;
      }

      setIsSubmitting(true);

      try {
        const payload = {
          code: code.trim(),
          description: description.trim(),
          gstRate: parseFloat(gstRate),
        };

        let res;
        if (hsnCode) {
          // console.log('Updating HSN code...', hsnCode);
          res = await api.put(`/hsncode/${hsnCode._id}`, payload);
          // console.log('Update HSN Code Response:', res);
          await onUpdateHsnCode?.(res.data);
        } else {
          // console.log('Creating new HSN code...');
          res = await api.post('/hsncode', payload);
          // console.log('Create HSN Code Response:', res);
          await onCreateHsnCode?.(res.data);
          // console.log(res);
          // Toast.show({
          //   type: 'error',
          //   text1: 'Error',
          //   text2: res.errors[0].message,
          // });
        }

        handleClose();
      } catch (error) {
        // console.log("Backend Res" , res);
        // console.log('Error submitting HSN code:', error);
      } finally {
        setIsSubmitting(false);
      }
    }, [
      hsnCode,
      code,
      description,
      gstRate,
      validateForm,
      onCreateHsnCode,
      onUpdateHsnCode,
      handleClose,
    ]);

    // Handle GST rate chip selection
    const handleGstRateSelect = useCallback(rate => {
      setGstRate(rate.toString());
    }, []);

    // Form validation state
    const isFormValid =
      code.trim().length >= 4 &&
      gstRate.trim() !== '' &&
      Object.keys(errors).length === 0;

    // Header component
    const renderHeader = useMemo(
      () => (
        <View style={styles.customHeader}>
          <View style={styles.titleHeader}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {hsnCode ? 'Update HSN Code' : title}
            </Text>
            <IconButton
              icon="close"
              size={24}
              iconColor={theme.colors.onSurface}
              onPress={handleClose}
              style={styles.closeButton}
            />
          </View>

          <Divider bold />
        </View>
      ),
      [theme, title, handleClose, hsnCode],
    );

    // Form content component
    const FormContent = useMemo(
      () => (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.formContainer}
        >
          <View style={styles.form}>
            <TextInput
              label="HSN Code *"
              mode="outlined"
              value={code}
              onChangeText={setCode}
              maxLength={30}
              style={styles.input}
              theme={{ roundness: 12 }}
              contentStyle={styles.inputContent}
              left={
                <TextInput.Icon
                  icon="barcode-scan"
                  color={theme.colors.primary}
                />
              }
              placeholder="Enter HSN code"
              keyboardType="numeric"
              error={!!errors.code}
              disabled={isSubmitting}
            />
            <HelperText
              type="error"
              visible={!!errors.code}
              style={styles.helperText}
            >
              {errors.code}
            </HelperText>

            <TextInput
              label="Description"
              mode="outlined"
              value={description}
              onChangeText={setDescription}
              style={[styles.input, styles.textArea]}
              theme={{ roundness: 12 }}
              contentStyle={styles.inputContent}
              left={<TextInput.Icon icon="text" color={theme.colors.primary} />}
              placeholder="Enter product description"
              multiline
              numberOfLines={3}
              maxLength={200}
              error={!!errors.description}
              disabled={isSubmitting}
            />
            <HelperText
              type="error"
              visible={!!errors.description}
              style={styles.helperText}
            >
              {errors.description}
            </HelperText>

            {description && (
              <HelperText type="info" style={styles.characterCount}>
                {description.length}/200 characters
              </HelperText>
            )}

            <TextInput
              label="GST Rate (%) *"
              mode="outlined"
              value={gstRate}
              onChangeText={setGstRate}
              style={styles.input}
              theme={{ roundness: 12 }}
              contentStyle={styles.inputContent}
              left={
                <TextInput.Icon icon="percent" color={theme.colors.primary} />
              }
              placeholder="Enter GST rate"
              keyboardType="decimal-pad"
              error={!!errors.gstRate}
              disabled={isSubmitting}
            />
            <HelperText
              type="error"
              visible={!!errors.gstRate}
              style={styles.helperText}
            >
              {errors.gstRate}
            </HelperText>

            <View style={styles.gstRateChipsContainer}>
              <Text
                style={[styles.chipLabel, { color: theme.colors.onSurface }]}
              >
                Common GST Rates:
              </Text>
              <View style={styles.chipsRow}>
                {commonGstRates.map(rate => (
                  <Chip
                    key={rate}
                    mode={gstRate === rate.toString() ? 'flat' : 'outlined'}
                    selected={gstRate === rate.toString()}
                    onPress={() => handleGstRateSelect(rate)}
                    style={[
                      styles.gstRateChip,
                      gstRate === rate.toString() && {
                        backgroundColor: theme.colors.primaryContainer,
                      },
                    ]}
                    textStyle={[
                      styles.chipText,
                      gstRate === rate.toString() && {
                        color: theme.colors.primary,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {rate}%
                  </Chip>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              loading={isSubmitting}
              style={[
                styles.createButton,
                {
                  backgroundColor: isFormValid
                    ? theme.colors.primary
                    : theme.colors.outline,
                },
              ]}
              contentStyle={styles.buttonContent}
              labelStyle={[
                styles.buttonLabel,
                {
                  color: isFormValid
                    ? theme.colors.onPrimary
                    : theme.colors.onSurface,
                },
              ]}
            >
              {isSubmitting
                ? hsnCode
                  ? 'Updating...'
                  : 'Creating...'
                : hsnCode
                  ? 'Update HSN Code'
                  : 'Create HSN Code'}
            </Button>
          </View>
        </KeyboardAvoidingView>
      ),
      [
        hsnCode,
        code,
        description,
        gstRate,
        errors,
        isSubmitting,
        isFormValid,
        handleSubmit,
        theme,
        commonGstRates,
        handleGstRateSelect,
      ],
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
        keyboardBlurBehavior="restore"
        enablePanDownToClose={true}
        enableDismissOnClose={true}
        {...props}
      >
        {FormContent}
      </BaseBottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  customHeader: {},
  titleHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingTop: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    margin: 0,
  },
  formContainer: {
    flex: 1,
    paddingTop: 8,
  },
  form: {
    flex: 1,
    paddingHorizontal: 20,
  },
  input: {
    marginBottom: 0,
    backgroundColor: 'transparent',
  },
  inputContent: {
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
  },
  helperText: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  characterCount: {
    textAlign: 'right',
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  gstRateChipsContainer: {
    marginTop: 2,
    marginBottom: 8,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  gstRateChip: {
    marginRight: 0,
    marginBottom: 0,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  createButton: {
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 8,
  },
  buttonContent: {
    height: 50,
    paddingHorizontal: 24,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});

AddHsnCodeBottomSheet.displayName = 'AddHsnCodeBottomSheet';

export default AddHsnCodeBottomSheet;
