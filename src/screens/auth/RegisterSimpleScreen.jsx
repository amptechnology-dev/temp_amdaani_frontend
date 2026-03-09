// ENHANCED PROFESSIONAL SIMPLE REGISTER SCREEN
// --------------------------------------------

import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    Platform,
    KeyboardAvoidingView,
    TouchableOpacity,
} from 'react-native';
import {
    TextInput,
    Button,
    Text,
    useTheme,
    Card,
} from 'react-native-paper';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import { useAuth } from '../../context/AuthContext';
import StateSelectorBottomSheet from '../../components/BottomSheet/SelectStateBottomSheet';
import BusinessTypeSelectorBottomSheet from '../../components/BottomSheet/BusinessTypeSelectorBottomSheet';
import TermsBottomSheet from '../../components/BottomSheet/TermsBottomSheet';
import Navbar from '../../components/Navbar';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const FormLabel = ({ children, required }) => (
    <Text style={styles.labelText}>
        {children}
        {required ? <Text style={{ color: '#ff4d4d' }}> *</Text> : null}
    </Text>
);

const RegisterSimpleScreen = () => {
    const route = useRoute();
    const passedPhone = route.params?.phone || '';

    const theme = useTheme();
    const navigation = useNavigation();
    const { completeRegistration } = useAuth();
    const stateSheetRef = useRef(null);
    const businessTypeSheetRef = useRef(null);
    const termsSheetRef = useRef(null);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showAcceptButton, setShowAcceptButton] = useState(false);
    const [selectedStateObj, setSelectedStateObj] = useState(null);
    const [hasGSTIN, setHasGSTIN] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitAttempted, setSubmitAttempted] = useState(false);


    useEffect(() => {
        setShowAcceptButton(true);
        termsSheetRef.current?.present();
    }, []);

    const handleAcceptTerms = () => {
        setTermsAccepted(true);
        setShowAcceptButton(false);
        termsSheetRef.current?.close();
    };

    const handleStateSelect = (state, setFieldValue) => {
        setSelectedStateObj(state);
        setFieldValue('address.state', state.name);
        stateSheetRef.current?.close();
    };
    const initialValues = {
        ownerName: '',
        businessName: '',
        businessType: '',
        contactNumber: '',
        hasGSTIN: false,
        gstin: '',
        address: {
            street: '',
            city: '',
            state: '',
            pincode: '',
            country: 'India',
        },
    };

    const validationSchema = Yup.object({
        ownerName: Yup.string()
            .trim()
            .matches(/^[a-zA-Z\s]+$/, 'Owner name can only contain letters')
            .min(3, 'Owner name must be at least 3 characters')
            .max(100, 'Owner name is too long')
            .required('Owner name is required'),
        contactNumber: Yup.string()
            .matches(/^[6-9]\d{9}$/, 'Contact number must be valid 10 digits')
            .required('Contact number is required'),
        businessName: Yup.string()
            .trim()
            .min(2, 'Business name is too short')
            .max(60, 'Business name is too long')
            .required('Business name is required'),
        businessType: Yup.string().required('Business type is required'),
        address: Yup.object().shape({
            street: Yup.string().trim().required('Street address is required'),
            city: Yup.string().trim().required('City is required'),
            state: Yup.string().trim().required('State is required'),
            pincode: Yup.string()
                .matches(/^\d{6}$/, 'Pincode must be 6 digits')
                .required('Pincode is required'),
            country: Yup.string().trim().required('Country is required'),
        }),
        hasGSTIN: Yup.boolean(),
        gstin: Yup.string().when('hasGSTIN', {
            is: true,
            then: (schema) => schema
                .matches(
                    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
                    'Invalid GSTIN format. Example: 22AAAAA0000A1Z5'
                )
                .required('GSTIN is required when checked'),
            otherwise: (schema) => schema.notRequired(),
        }),
    });

    const handleSubmitRegister = async values => {
        // console.log('Form values:', values); // Debug log
        setIsSubmitting(true);
        try {
            const effectivePhone = passedPhone || values.phoneNumber || '';
            const formData = new FormData();
            formData.append('userData[name]', values.ownerName);
            formData.append('userData[phone]', effectivePhone);
            formData.append('storeData[name]', values.businessName);
            formData.append('storeData[type]', values.businessType);
            formData.append('storeData[address][street]', values.address.street);
            formData.append('storeData[address][city]', values.address.city);
            formData.append('storeData[address][state]', values.address.state);
            formData.append('storeData[address][country]', values.address.country);
            formData.append('storeData[address][postalCode]', values.address.pincode);
            formData.append('storeData[contactNo]', values.contactNumber);

            // Only append GSTIN if the checkbox is checked and GSTIN is provided
            if (values.hasGSTIN && values.gstin) {
                formData.append('storeData[gstNumber]', values.gstin);
            }

            const res = await completeRegistration(formData);

            if (res.success) {
                Toast.show({ type: 'success', text1: 'Registration Successful' });
                // navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Registration Failed',
                    text2: res.message || 'Something went wrong',
                });
            }
        } catch (e) {
            console.error('Registration error:', e);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: e.message || 'An error occurred during registration',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const openBusinessTypeSelector = () => {
        if (businessTypeSheetRef.current) {
            businessTypeSheetRef.current.expand();
        }
    };

    const openStateSelector = () => {
        stateSheetRef.current?.expand();
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <Formik
                    initialValues={initialValues}
                    validationSchema={validationSchema}
                    validateOnChange={submitAttempted}  // Only validate onChange after submit attempt
                    validateOnBlur={submitAttempted}    // Only validate onBlur after submit attempt
                    onSubmit={handleSubmitRegister}
                >
                    {({
                        handleChange,
                        handleBlur,
                        handleSubmit,
                        values,
                        errors,
                        touched,
                        setFieldValue,
                        setFieldTouched,
                    }) => (
                        <>
                            <Navbar title={"Register"} />
                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                style={styles.container}
                            >

                                {/* Header */}
                                <View style={styles.topHeader}>
                                    <Text variant="headlineSmall" style={styles.title}>Create Business Account</Text>
                                    <Text variant="bodyMedium" style={styles.subtitle}>
                                        Set up your business profile — fast, secure and professional.
                                    </Text>
                                </View>

                                {/* Form Card */}
                                <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} mode="contained">
                                    <Card.Content>
                                        {/* Owner Name */}
                                        <TextInput
                                            label={<FormLabel required>Owner Name</FormLabel>}
                                            value={values.ownerName}
                                            onChangeText={handleChange('ownerName')}
                                            onBlur={handleBlur('ownerName')}
                                            mode="outlined"
                                            style={styles.input}
                                            theme={{ roundness: 12 }}
                                            error={touched.ownerName && errors.ownerName}
                                            left={<TextInput.Icon icon="account-circle-outline" />}
                                        />
                                        {touched.ownerName && errors.ownerName && (
                                            <Text style={styles.errorText}>{errors.ownerName}</Text>
                                        )}

                                        {/* Phone */}
                                        <TextInput
                                            label={<FormLabel required>Business Mobile</FormLabel>}
                                            value={values.contactNumber}
                                            onChangeText={handleChange('contactNumber')}
                                            onBlur={handleBlur('contactNumber')}
                                            mode="outlined"
                                            maxLength={10}
                                            keyboardType="number-pad"
                                            style={styles.input}
                                            theme={{ roundness: 12 }}
                                            left={<TextInput.Icon icon="phone" />}
                                            error={touched.contactNumber && errors.contactNumber}
                                        />
                                        {touched.contactNumber && errors.contactNumber && (
                                            <Text style={styles.errorText}>{errors.contactNumber}</Text>
                                        )}

                                        {/* Business Name */}
                                        <TextInput
                                            label={<FormLabel required>Business Name</FormLabel>}
                                            value={values.businessName}
                                            onChangeText={handleChange('businessName')}
                                            onBlur={handleBlur('businessName')}
                                            mode="outlined"
                                            style={styles.input}
                                            theme={{ roundness: 12 }}
                                            left={<TextInput.Icon icon="storefront-outline" />}
                                            error={touched.businessName && errors.businessName}
                                        />

                                        {/* Business Type */}
                                        <TouchableOpacity onPress={openBusinessTypeSelector}>
                                            <TextInput
                                                label={<FormLabel required>Business Type</FormLabel>}
                                                value={values.businessType}
                                                mode="outlined"
                                                editable={false}
                                                style={styles.input}
                                                theme={{ roundness: 12 }}
                                                left={<TextInput.Icon icon="domain" />}
                                                right={<TextInput.Icon icon="chevron-down" />}
                                                error={touched.businessType && errors.businessType}
                                            />
                                        </TouchableOpacity>

                                        {/* Address Section */}
                                        <Text style={styles.sectionTitle}>Business Address</Text>

                                        <TextInput
                                            label={<FormLabel required>Street Address</FormLabel>}
                                            value={values.address.street}
                                            onChangeText={text => setFieldValue('address.street', text)}
                                            onBlur={handleBlur('address.street')}
                                            mode="outlined"
                                            style={styles.input}
                                            theme={{ roundness: 12 }}
                                            // placeholder="123 MG Road"
                                            error={touched.address?.street && errors.address?.street}
                                            left={<TextInput.Icon icon="map-marker" />}
                                        />
                                        {touched.address?.street && errors.address?.street && (
                                            <Text style={styles.errorText}>{errors.address.street}</Text>
                                        )}


                                        <TextInput
                                            label={<FormLabel required>City</FormLabel>}
                                            value={values.address.city}
                                            onChangeText={text => setFieldValue('address.city', text)}
                                            onBlur={handleBlur('address.city')}
                                            mode="outlined"
                                            style={styles.input}
                                            theme={{ roundness: 12 }}
                                            error={touched.address?.city && errors.address?.city}
                                        />
                                        {touched.address?.city && errors.address?.city && (
                                            <Text style={styles.errorText}>{errors.address.city}</Text>
                                        )}

                                        {/* State */}
                                        <TouchableOpacity onPress={openStateSelector}>
                                            <TextInput
                                                label={<FormLabel required>State</FormLabel>}
                                                value={values.address.state}
                                                mode="outlined"
                                                style={styles.input}
                                                left={<TextInput.Icon icon="map" />}
                                                placeholder="Select state"
                                                right={<TextInput.Icon icon="chevron-down" />}
                                                editable={false}
                                                pointerEvents="none"
                                                theme={{ roundness: 12 }}
                                                error={touched.address?.state && !!errors.address?.state}
                                                onBlur={() => setFieldTouched('address.state', true)}
                                            />
                                            {touched.address?.state && errors.address?.state && (
                                                <Text style={styles.errorText}>{errors.address.state}</Text>
                                            )}
                                        </TouchableOpacity>

                                        {/* Pincode */}
                                        <TextInput
                                            label={<FormLabel required>Pincode</FormLabel>}
                                            value={values.address.pincode}
                                            onChangeText={text => setFieldValue('address.pincode', text)}
                                            onBlur={handleBlur('address.pincode')}
                                            mode="outlined"
                                            keyboardType="number-pad"
                                            maxLength={6}
                                            style={styles.input}
                                            theme={{ roundness: 12 }}
                                            error={touched.address?.pincode && errors.address?.pincode}
                                        />

                                        {touched.address?.pincode && errors.address?.pincode && (
                                            <Text style={styles.errorText}>{errors.address.pincode}</Text>
                                        )}

                                        {/* GSTIN Toggle */}
                                        <View style={{ marginTop: 16 }}>
                                            <TouchableOpacity
                                                style={{ flexDirection: 'row', alignItems: 'center' }}
                                                onPress={() => {
                                                    const newValue = !values.hasGSTIN;
                                                    setFieldValue('hasGSTIN', newValue);
                                                    if (!newValue) {
                                                        setFieldValue('gstin', '');
                                                    }
                                                }}
                                            >
                                                <View style={[{
                                                    height: 20,
                                                    width: 20,
                                                    borderRadius: 4,
                                                    borderWidth: 2,
                                                    borderColor: values.hasGSTIN ? theme.colors.primary : '#666',
                                                    backgroundColor: values.hasGSTIN ? theme.colors.primary : 'transparent',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginRight: 10,
                                                }]}>
                                                    {values.hasGSTIN && (
                                                        <MaterialCommunityIcons name="check" size={16} color="white" />
                                                    )}
                                                </View>
                                                <Text style={{ color: theme.colors.onSurface }}>Do you have a GSTIN?</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* GSTIN Input (Conditional) */}
                                        {values.hasGSTIN && (
                                            <View style={{ marginTop: 8 }}>
                                                <TextInput
                                                    label={<FormLabel required>GSTIN</FormLabel>}
                                                    value={values.gstin}
                                                    onChangeText={handleChange('gstin')}
                                                    onBlur={handleBlur('gstin')}
                                                    mode="outlined"
                                                    style={styles.input}
                                                    theme={{ roundness: 12 }}
                                                    error={touched.gstin && errors.gstin}
                                                    placeholder="22AAAAA0000A1Z5"
                                                    maxLength={15}
                                                    autoCapitalize="characters"
                                                />
                                                {touched.gstin && errors.gstin && (
                                                    <Text style={styles.errorText}>{errors.gstin}</Text>
                                                )}
                                            </View>
                                        )}
                                    </Card.Content>
                                </Card>

                                {/* Button */}
                                <Button
                                    mode="contained"
                                    onPress={() => {
                                        setSubmitAttempted(true); // Mark that user attempted to submit
                                        handleSubmit(); // Trigger validation and submission
                                    }}
                                    disabled={isSubmitting || !termsAccepted}
                                    style={styles.submitBtn}
                                    contentStyle={{ paddingVertical: 8 }}
                                    loading={isSubmitting}
                                    labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                                >
                                    {isSubmitting ? 'Registering...' : 'Register Now'}
                                </Button>


                            </ScrollView>

                            {/* Bottom Sheets */}
                            <StateSelectorBottomSheet
                                ref={stateSheetRef}
                                onStateSelect={state => handleStateSelect(state, setFieldValue)}
                                selectedState={selectedStateObj}
                                title="Select State"
                                placeholder="Search states..."
                                showSearch={true}
                                showRegionFilter={true}
                                showCapital={true}
                                snapPoints={['50%', '80%']}
                                enablePanDownToClose={true}
                                enableDynamicSizing={false}
                            />

                            <BusinessTypeSelectorBottomSheet
                                ref={businessTypeSheetRef}
                                onBusinessSelect={item => {
                                    setFieldValue('businessType', item.label); // ✅ only label
                                }}
                                selectedBusiness={
                                    values.businessType ? { label: values.businessType } : null
                                }
                            />


                            <TermsBottomSheet
                                showCloseButton={false}
                                enableDismissOnClose={false}
                                backdropbehavior="none"
                                initialSnapIndex={0}
                                ref={termsSheetRef}
                                showAcceptButton={showAcceptButton}
                                onAccept={handleAcceptTerms}
                            />
                        </>
                    )}
                </Formik>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default RegisterSimpleScreen;

/* ---------------------------------------------------------
   PREMIUM MODERN UI STYLING
----------------------------------------------------------*/
const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 16 },

    topHeader: {
        marginTop: 4,
        marginBottom: 8,
    },
    title: {
        textAlign: 'center',
    },
    subtitle: {
        opacity: 0.6,
        marginTop: 6,
        textAlign: 'center',
    },

    labelText: {
        fontSize: 14,
        fontWeight: '600',
    },

    card: {
        borderRadius: 12,
        elevation: 2,
        marginBottom: 16,
    },

    input: {
        height: 42,
        marginBottom: 16,
        fontSize: 12,
    },

    sectionTitle: {
        fontSize: 17,
        marginTop: 10,
        marginBottom: 12,
        fontWeight: '700',
    },

    errorText: {
        color: '#ff4d4d',
        fontSize: 12,
        marginTop: -10,
        marginBottom: 4,
        marginLeft: 4,
    },

    submitBtn: {
        marginVertical: 20,
        borderRadius: 14,
        elevation: 3,
    },
});
