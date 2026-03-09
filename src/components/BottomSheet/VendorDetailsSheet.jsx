// components/BottomSheet/VendorDetailBottomSheet.jsx
import React, { forwardRef, useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, useTheme } from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';
import StateSelectorBottomSheet from './SelectStateBottomSheet';
import * as Yup from 'yup';

const VendorDetailBottomSheet = forwardRef(({ customerData = {}, onSave }, ref) => {
  const theme = useTheme();
  const stateSheetRef = useRef(null);

  const [form, setForm] = useState({
    name: customerData?.name || '',
    mobile: customerData?.mobile || '',
    gstNumber: customerData?.gstNumber || '',
    address: customerData?.address || '',
    city: customerData?.city || '',
    state: customerData?.state || '',
    country: customerData?.country || 'India',
    postalCode: customerData?.postalCode || '',
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [selectedStateObj, setSelectedStateObj] = useState(
    customerData?.state ? { name: customerData.state } : null,
  );

  // ✅ Validation: Only mobile required
  const validationSchema = Yup.object().shape({
    mobile: Yup.string()
      .trim()
      .nullable()
      .matches(/^[6-9]\d{9}$/, 'Enter valid 10-digit Indian mobile number'),
    name: Yup.string()
      .trim()
      .nullable()
      .max(50, 'Name must be less than 50 characters'),
    gstNumber: Yup.string()
      .trim()
      .nullable()
      .uppercase()
      .max(15, 'GSTIN must be 15 characters')
      .test(
        'valid-format',
        'Invalid GSTIN format (e.g. 22AAAAA0000A1Z5)',
        value =>
          !value ||
          /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value),
      ),
    address: Yup.string().trim().nullable().max(150, 'Max 150 chars'),
    city: Yup.string().trim().nullable().max(50, 'Max 50 chars'),
    state: Yup.string().trim().nullable().max(100, 'Max 100 chars'),
    country: Yup.string().trim().nullable().max(100, 'Max 100 chars'),
    postalCode: Yup.string()
      .trim()
      .nullable()
      .test('postalCode', 'Enter valid 6-digit pincode', value => {
        if (!value) return true; // Allow empty
        return /^[1-9][0-9]{5}$/.test(value);
      }),
  });

  useEffect(() => {
    if (customerData && Object.keys(customerData).length > 0) {
      setForm(prev => {
        // Only update fields if different from previous to avoid resetting while typing
        const updated = { ...prev };
        let hasChange = false;

        Object.keys(customerData).forEach(key => {
          const newVal = customerData[key] ?? '';
          if (prev[key] !== newVal) {
            updated[key] = newVal;
            hasChange = true;
          }
        });

        return hasChange ? updated : prev;
      });
    }
  }, [customerData?.name, customerData?.mobile]);


  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleBlur = field => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, form[field]);
  };

  const validateField = async (field, value) => {
    try {
      await validationSchema.validateAt(field, { [field]: value });
      setErrors(prev => ({ ...prev, [field]: '' }));
    } catch (err) {
      setErrors(prev => ({ ...prev, [field]: err.message }));
    }
  };

  const validateForm = async () => {
    try {
      await validationSchema.validate(form, { abortEarly: false });
      setErrors({});
      return true;
    } catch (error) {
      const newErrors = {};
      error.inner.forEach(err => (newErrors[err.path] = err.message));
      setErrors(newErrors);
      setTouched(Object.keys(newErrors).reduce((a, k) => ({ ...a, [k]: true }), {}));
      return false;
    }
  };

  const handleSave = async () => {
    try {
      // Run validation
      const isValid = await validationSchema.isValid(form, { abortEarly: false });

      if (!isValid) {
        await validateForm(); // Show inline error messages if any
        return;
      }

      // Call onSave and wait for it to complete
      await Promise.resolve(onSave?.(form));

      // Close the bottom sheet after successful save
      if (ref.current) {
        if (typeof ref.current.close === 'function') {
          ref.current.close();
        } else if (typeof ref.current.dismiss === 'function') {
          ref.current.dismiss();
        }
      }
    } catch (err) {
      console.error('Error saving:', err);
    }
  };

  // ✅ Open state selector in collapsed mode
  const openStateSelector = () => {
    // ref.current?.collapse?.();
    setTimeout(() => {
      stateSheetRef.current?.expand?.();
    }, 200);
  };

  const handleStateSelect = state => {
    setSelectedStateObj(state);
    setForm(prev => ({ ...prev, state: state.name }));
    stateSheetRef.current?.close();
    setTimeout(() => {
      ref.current?.expand?.();
    }, 200);
  };

  return (
    <>
      <BaseBottomSheet
        initialSnapIndex={-1}
        ref={ref}
        title="Vendor Details"
        snapPoints={['60%', '80%']}
        enablePanDownToClose
        showHandle
        showHeader
        contentType="scroll"
        contentContainerStyle={{
          paddingTop: 10,
          backgroundColor: theme.colors.surface,
        }}
        footerComponent={
          <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
            <Button mode="text" onPress={() => ref.current?.close()}>
              Cancel
            </Button>
            <Button
              mode="contained"
              icon="check"
              onPress={handleSave}
              style={styles.saveButton}
            >
              Save
            </Button>
          </View>
        }
      >
        <View style={{ padding: 16 }}>
          <TextInput
            label="Vendor Name"
            mode="outlined"
            value={form.name}
            onChangeText={t => handleChange('name', t)}
            onBlur={() => handleBlur('name')}
            left={<TextInput.Icon icon="account" />}
            theme={{ roundness: 12 }}
            style={styles.input}
          />
          {touched.name && errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

          <TextInput
            label="Vendor Number"
            mode="outlined"
            value={form.mobile}
            onChangeText={t => handleChange('mobile', t)}
            onBlur={() => handleBlur('mobile')}
            keyboardType="phone-pad"
            maxLength={10}
            left={<TextInput.Icon icon="phone" />}
            theme={{ roundness: 12 }}
            style={styles.input}
            error={!!errors.mobile}
          />
          {touched.mobile && errors.mobile && <Text style={styles.errorText}>{errors.mobile}</Text>}

          <TextInput
            label="GST Number"
            mode="outlined"
            autoCapitalize="characters"
            value={form.gstNumber}
            onChangeText={t => handleChange('gstNumber', t)}
            onBlur={() => handleBlur('gstNumber')}
            left={<TextInput.Icon icon="file-document" />}
            theme={{ roundness: 12 }}
            style={styles.input}
            maxLength={15}
          />
          {touched.gstNumber && errors.gstNumber && (
            <Text style={styles.errorText}>{errors.gstNumber}</Text>
          )}

          <TextInput
            label="Address"
            mode="outlined"
            multiline
            value={form.address}
            onChangeText={t => handleChange('address', t)}
            onBlur={() => handleBlur('address')}
            left={<TextInput.Icon icon="map-marker" />}
            theme={{ roundness: 12 }}
            style={styles.input}
          />

          <TextInput
            label="City"
            mode="outlined"
            value={form.city}
            onChangeText={t => handleChange('city', t)}
            onBlur={() => handleBlur('city')}
            left={<TextInput.Icon icon="city" />}
            theme={{ roundness: 12 }}
            style={styles.input}
          />

          {/* ✅ Collapsible State Selector */}
          <TouchableOpacity activeOpacity={0.8} onPress={openStateSelector}>
            <TextInput
              label="State"
              mode="outlined"
              value={form.state}
              editable={false}
              left={<TextInput.Icon icon="map" />}
              right={<TextInput.Icon icon="chevron-down" />}
              theme={{ roundness: 12 }}
              style={styles.input}
            />
          </TouchableOpacity>
          {/* 
          <TextInput
            label="Country"
            mode="outlined"
            value={form.country}
            onChangeText={t => handleChange('country', t)}
            onBlur={() => handleBlur('country')}
            left={<TextInput.Icon icon="earth" />}
            theme={{ roundness: 12 }}
            style={styles.input}
          /> */}

          <TextInput
            label="Postal Code"
            mode="outlined"
            value={form.postalCode}
            onChangeText={t => handleChange('postalCode', t)}
            onBlur={() => handleBlur('postalCode')}
            keyboardType="number-pad"
            maxLength={6}
            left={<TextInput.Icon icon="mailbox" />}
            theme={{ roundness: 12 }}
            style={styles.input}
          />
        </View>
      </BaseBottomSheet>

      {/* ✅ State Selector Bottom Sheet */}
      <StateSelectorBottomSheet
        ref={stateSheetRef}
        onStateSelect={handleStateSelect}
        selectedState={selectedStateObj}
        title="Select State"
        showSearch
        snapPoints={['60%', '80%']}
        enablePanDownToClose
      />
    </>
  );
});

const styles = StyleSheet.create({
  input: { marginBottom: 6 },
  errorText: { color: '#B00020', fontSize: 12, marginLeft: 4, marginBottom: 4 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
  },
  saveButton: { borderRadius: 8 },
});

export default VendorDetailBottomSheet;
