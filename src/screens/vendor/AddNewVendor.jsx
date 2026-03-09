// src/screens/Party/AddNewVendor.jsx
/**
 * AddNewVendor (production-ready)
 * - Strict validation & sanitization
 * - Accessible fields & inline error display
 * - Clear submission flow with server error handling
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    ScrollView,
    StyleSheet,
    KeyboardAvoidingView,
    BackHandler,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { TextInput, Button, useTheme, Text } from 'react-native-paper';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { SafeAreaView } from 'react-native-safe-area-context';
import Navbar from '../../components/Navbar';
import StateSelectorBottomSheet from '../../components/BottomSheet/SelectStateBottomSheet';
import CustomAlert from '../../components/CustomAlert';
import Toast from 'react-native-toast-message';
import api from '../../utils/api';
import { extractErrorMessage } from '../../utils/errorHandler';

/* -------------------------
   Validation: Yup schemas
   ------------------------- */

/**
 * GSTIN (Indian GST) common pattern
 *  - 15 characters: 2 digits (state code) + 10 PAN chars + 1 entity + 1 'Z' + 1 checksum
 *  - This regex covers the common valid structure (case-insensitive)
 */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

/**
 * PAN (Indian) pattern: 5 letters + 4 digits + 1 letter
 */
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i;

const validationSchema = Yup.object().shape({
    name: Yup.string()
        .trim()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must be at most 50 characters')
        .required('Vendor name is required'),
    mobile: Yup.string()
        .trim()
        .matches(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
        .required('Contact number is required'),
    state: Yup.string().trim().min(2, 'Select a valid state').required('State is required'),
    gstNumber: Yup.string()
        .trim()
        .nullable()
        .test('gst-format', 'Enter a valid GSTIN (15 chars)', value => {
            if (!value) return true;
            return GSTIN_REGEX.test(value.replace(/\s+/g, '').toUpperCase());
        }),
    panNumber: Yup.string()
        .trim()
        .nullable()
        .test('pan-format', 'Enter a valid PAN', value => {
            if (!value) return true;
            return PAN_REGEX.test(value.replace(/\s+/g, '').toUpperCase());
        }),
    postalCode: Yup.string()
        .trim()
        .nullable()
        .test('pincode-format', 'Postal code must be 6 digits', value => {
            if (!value) return true;
            return /^\d{6}$/.test(value);
        }),
    city: Yup.string()
        .trim()
        .nullable()
        .max(50, 'City must be at most 50 characters')
        .matches(/^[a-zA-Z\s\-.]*$/, 'City contains invalid characters'),
});

/* -------------------------
   Helpers: sanitize & format
   ------------------------- */

const sanitizeValues = values => {
    return {
        name: (values.name || '').trim(),
        mobile: (values.mobile || '').replace(/\D/g, '').trim(), // digits only
        address: (values.address || '').trim(),
        city: (values.city || '').trim(),
        state: (values.state || '').trim(),
        postalCode: (values.postalCode || '').replace(/\D/g, '').trim(),
        gstNumber: (values.gstNumber || '').replace(/\s+/g, '').toUpperCase() || '',
        panNumber: (values.panNumber || '').replace(/\s+/g, '').toUpperCase() || '',
        country: values.country || 'IN',
    };
};

/* -------------------------
   Component
   ------------------------- */

const AddNewVendor = ({ navigation, route }) => {
    const theme = useTheme();
    const existingVendor = route?.params?.vendor ?? null;
    const isUpdate = !!existingVendor;

    const initialValues = {
        name: existingVendor?.name ?? '',
        mobile: existingVendor?.mobile ?? '',
        address: existingVendor?.address ?? '',
        city: existingVendor?.city ?? '',
        state: existingVendor?.state ?? '',
        country: existingVendor?.country ?? 'IN',
        postalCode: existingVendor?.postalCode ?? '',
        gstNumber: existingVendor?.gstNumber ?? '',
        panNumber: existingVendor?.panNumber ?? '',
    };

    const formikRef = useRef(null);
    const stateSheetRef = useRef(null);
    const [selectedStateObj, setSelectedStateObj] = useState(null);

    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        actions: [],
    });

    // Unsaved changes guard
    const [formDirty, setFormDirty] = useState(false);
    useEffect(() => {
        const backAction = () => {
            if (!formDirty) return false;
            setAlertConfig({
                visible: true,
                title: 'Discard Changes?',
                message: 'You have unsaved changes. Do you want to discard them and go back?',
                type: 'warning',
                actions: [
                    { label: 'Cancel', mode: 'outlined', onPress: () => setAlertConfig(prev => ({ ...prev, visible: false })) },
                    {
                        label: 'Discard',
                        mode: 'contained',
                        color: theme.colors.error,
                        onPress: () => {
                            setAlertConfig(prev => ({ ...prev, visible: false }));
                            navigation.goBack();
                        },
                    },
                ],
            });
            return true; // prevent default back
        };

        const handler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => handler.remove();
    }, [formDirty, navigation, theme.colors.error]);

    const openStateSelector = () => stateSheetRef.current?.expand();
    const handleStateSelect = stateObj => {
        setSelectedStateObj(stateObj);
        // set the field value inside Formik
        formikRef.current?.setFieldValue('state', stateObj?.name ?? '');
        stateSheetRef.current?.close();
    };

    const handleCancel = values => {
        if (!formDirty) return navigation.goBack();
        setAlertConfig({
            visible: true,
            title: 'Discard Changes?',
            message: 'You have unsaved changes. Do you want to discard them and go back?',
            type: 'warning',
            actions: [
                { label: 'No', mode: 'outlined', onPress: () => setAlertConfig(prev => ({ ...prev, visible: false })) },
                {
                    label: 'Yes',
                    mode: 'contained',
                    color: theme.colors.error,
                    onPress: () => {
                        setAlertConfig(prev => ({ ...prev, visible: false }));
                        navigation.goBack();
                    },
                },
            ],
        });
    };

    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setSubmitting(true);

        const payload = sanitizeValues(values);

        try {
            let response;
            if (isUpdate) {
                // existing vendor may contain either id or _id
                const id = existingVendor?.id ?? existingVendor?._id ?? existingVendor?._Id;
                response = await api.put(`/vendor/id/${id}`, payload);
            } else {
                response = await api.post('/vendor', payload);
            }

            if (response?.success) {
                Toast.show({
                    type: 'success',
                    text1: response.message ?? (isUpdate ? 'Vendor updated successfully' : 'Vendor created successfully'),
                });
                resetForm();
                navigation.goBack();
            } else {
                throw new Error(response?.message ?? 'Server returned an error');
            }
        } catch (err) {
            console.error('AddNewVendor.save error:', err);
            const msg = extractErrorMessage(err) || err?.message || 'Something went wrong while saving vendor';
            Toast.show({ type: 'error', text1: 'Save failed', text2: msg });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <Formik
                innerRef={formikRef}
                enableReinitialize
                initialValues={initialValues}
                validationSchema={validationSchema}
                onSubmit={handleSubmit}
            >
                {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, setFieldValue }) => {
                    // Track dirty state (compare to initial values)
                    useEffect(() => {
                        const changed =
                            Object.keys(initialValues).some(key => {
                                const a = (initialValues[key] ?? '').toString().trim();
                                const b = (values[key] ?? '').toString().trim();
                                return a !== b;
                            }) || false;
                        setFormDirty(changed);
                    }, [values]);

                    // When user selects a state via bottom sheet, keep Formik in sync
                    useEffect(() => {
                        if (selectedStateObj?.name) setFieldValue('state', selectedStateObj.name);
                    }, [selectedStateObj, setFieldValue]);

                    return (
                        <>
                            <Navbar
                                title={isUpdate ? 'Update Vendor' : 'Add New Vendor'}
                                onBackPress={() => handleCancel(values)}
                            />

                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                                style={{ flex: 1 }}
                            >
                                <ScrollView
                                    style={styles.container}
                                    showsVerticalScrollIndicator={false}
                                    keyboardShouldPersistTaps="handled"
                                    contentContainerStyle={{ paddingBottom: 28 }}
                                >
                                    <View style={styles.form}>

                                        {/* Vendor Name */}
                                        <TextInput
                                            label="Vendor Name *"
                                            mode="outlined"
                                            value={values.name}
                                            onChangeText={handleChange('name')}
                                            onBlur={handleBlur('name')}
                                            error={touched.name && !!errors.name}
                                            style={styles.input}
                                            placeholder="Enter vendor name"
                                            autoCapitalize="words"
                                            maxLength={50}
                                            left={<TextInput.Icon icon="store" />}
                                            accessibilityLabel="Vendor name"
                                            theme={{ roundness: 12 }}
                                        />
                                        {touched.name && errors.name && (
                                            <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.name}</Text>
                                        )}

                                        {/* Mobile */}
                                        <TextInput
                                            label="Contact Number *"
                                            mode="outlined"
                                            value={values.mobile}
                                            onChangeText={handleChange('mobile')}
                                            onBlur={handleBlur('mobile')}
                                            error={touched.mobile && !!errors.mobile}
                                            style={styles.input}
                                            placeholder="10-digit mobile number"
                                            keyboardType="phone-pad"
                                            maxLength={10}
                                            left={<TextInput.Icon icon="phone" />}
                                            accessibilityLabel="Contact number"
                                            theme={{ roundness: 12 }}
                                        />
                                        {touched.mobile && errors.mobile && (
                                            <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.mobile}</Text>
                                        )}

                                        {/* State - selector */}
                                        <TouchableOpacity
                                            activeOpacity={0.85}
                                            onPress={openStateSelector}
                                            accessibilityRole="button"
                                            accessibilityLabel="Select state"
                                        >
                                            <TextInput
                                                label="State *"
                                                mode="outlined"
                                                value={values.state}
                                                editable={false}
                                                pointerEvents="none"
                                                style={styles.input}
                                                left={<TextInput.Icon icon="map-marker-outline" />}
                                                right={<TextInput.Icon icon="chevron-down" />}
                                                placeholder="Select state"
                                                theme={{ roundness: 12 }}
                                            />
                                        </TouchableOpacity>
                                        {touched.state && errors.state && (
                                            <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.state}</Text>
                                        )}

                                        {/* GST & PAN - optional but validated if present */}
                                        <TextInput
                                            label="GST Number (GSTIN)"
                                            mode="outlined"
                                            value={values.gstNumber}
                                            onChangeText={text => setFieldValue('gstNumber', text ? text.toUpperCase() : '')}
                                            onBlur={handleBlur('gstNumber')}
                                            error={touched.gstNumber && !!errors.gstNumber}
                                            style={styles.input}
                                            placeholder="15 char GSTIN (optional)"
                                            left={<TextInput.Icon icon="file-document-outline" />}
                                            theme={{ roundness: 12 }}
                                            autoCapitalize="characters"
                                        />
                                        {touched.gstNumber && errors.gstNumber && (
                                            <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.gstNumber}</Text>
                                        )}

                                        <TextInput
                                            label="PAN Number"
                                            mode="outlined"
                                            value={values.panNumber}
                                            onChangeText={text => setFieldValue('panNumber', text ? text.toUpperCase() : '')}
                                            onBlur={handleBlur('panNumber')}
                                            error={touched.panNumber && !!errors.panNumber}
                                            style={styles.input}
                                            placeholder="PAN (optional)"
                                            left={<TextInput.Icon icon="file-document" />}
                                            theme={{ roundness: 12 }}
                                            autoCapitalize="characters"
                                            maxLength={10}
                                        />
                                        {touched.panNumber && errors.panNumber && (
                                            <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.panNumber}</Text>
                                        )}

                                        <Text style={styles.sectionTitle}>Address Details</Text>

                                        <TextInput
                                            label="Street / Address"
                                            mode="outlined"
                                            value={values.address}
                                            onChangeText={handleChange('address')}
                                            onBlur={handleBlur('address')}
                                            style={[styles.input, { minHeight: 80 }]}
                                            placeholder="Street / address (optional)"
                                            multiline
                                            numberOfLines={3}
                                            textAlignVertical="top"
                                            left={<TextInput.Icon icon="home-outline" />}
                                            theme={{ roundness: 12 }}
                                            maxLength={200}
                                        />

                                        <TextInput
                                            label="City"
                                            mode="outlined"
                                            value={values.city}
                                            onChangeText={handleChange('city')}
                                            onBlur={handleBlur('city')}
                                            error={touched.city && !!errors.city}
                                            style={styles.input}
                                            placeholder="City (optional)"
                                            left={<TextInput.Icon icon="city" />}
                                            maxLength={50}
                                            theme={{ roundness: 12 }}
                                        />
                                        {touched.city && errors.city && (
                                            <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.city}</Text>
                                        )}

                                        <TextInput
                                            label="Postal Code"
                                            mode="outlined"
                                            value={values.postalCode}
                                            onChangeText={text => setFieldValue('postalCode', text.replace(/\D/g, ''))}
                                            onBlur={handleBlur('postalCode')}
                                            error={touched.postalCode && !!errors.postalCode}
                                            style={styles.input}
                                            placeholder="Postal code (6 digits)"
                                            keyboardType="numeric"
                                            maxLength={6}
                                            left={<TextInput.Icon icon="map-marker-radius-outline" />}
                                            theme={{ roundness: 12 }}
                                        />
                                        {touched.postalCode && errors.postalCode && (
                                            <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.postalCode}</Text>
                                        )}
                                    </View>
                                </ScrollView>
                            </KeyboardAvoidingView>

                            {/* Footer actions */}
                            <View style={styles.buttonContainer}>
                                <Button
                                    mode="outlined"
                                    onPress={() => handleCancel(values)}
                                    style={[styles.button, styles.cancelButton]}
                                    labelStyle={[styles.buttonLabel, { color: theme.colors.outline }]}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>

                                <Button
                                    mode="contained"
                                    onPress={() => handleSubmit()}
                                    style={[styles.button, styles.saveButton]}
                                    labelStyle={styles.buttonLabel}
                                    loading={isSubmitting}
                                    disabled={isSubmitting}
                                >
                                    {isUpdate ? 'Update' : 'Save'}
                                </Button>
                            </View>
                        </>
                    );
                }}
            </Formik>

            {/* State selector bottom sheet (keeps UI/UX consistent) */}
            <StateSelectorBottomSheet
                ref={stateSheetRef}
                onStateSelect={handleStateSelect}
                selectedState={selectedStateObj}
                title="Select State"
                showSearch
                showRegionFilter
                showCapital
                snapPoints={['50%', '80%']}
                enablePanDownToClose
                enableDynamicSizing={false}
            />

            <CustomAlert
                visible={alertConfig.visible}
                onDismiss={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                actions={alertConfig.actions}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 16 },
    form: { gap: 14, },
    input: { backgroundColor: 'transparent', marginTop: 6 },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 8 },
    errorText: { fontSize: 12, marginTop: 6, marginLeft: 4 },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: 16,
        marginVertical: 8,
    },
    button: { flex: 1, marginHorizontal: 8, minHeight: 36, justifyContent: 'center' },
    cancelButton: { borderWidth: 1.2 },
    saveButton: { elevation: 2 },
    buttonLabel: { fontSize: 16, fontWeight: '600' },
});

export default AddNewVendor;
