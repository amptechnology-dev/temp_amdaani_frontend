import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  ProgressBar,
  Card,
  Divider,
  IconButton,
  Chip,
  Icon,
} from 'react-native-paper';
import { Formik, setIn } from 'formik';
import * as Yup from 'yup';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import Toast from 'react-native-toast-message';
import { useNavigation, useRoute } from '@react-navigation/native';
import ImagePickerBottomSheet from '../../components/BottomSheet/ImagePickerBottomSheet';
import ImageCropPicker from 'react-native-image-crop-picker';
import { useBottomSheet } from '../../hook/useBottomSheet';
import {
  ensureCameraPermission,
  ensurePhotoPermission,
} from '../../utils/permissions';
import SignaturePadModal from '../../components/SignaturePadModal';
import StateSelectorBottomSheet from '../../components/BottomSheet/SelectStateBottomSheet';
import TermsBottomSheet from '../../components/BottomSheet/TermsBottomSheet';
import BusinessTypeSelectorBottomSheet from '../../components/BottomSheet/BusinessTypeSelectorBottomSheet';

// Small helper to render a label with an optional red asterisk
const FormLabel = ({ children, required = false }) => (
  <Text>
    {children}
    {required ? <Text style={{ color: '#e74c3c' }}> *</Text> : null}
  </Text>
);

const RegisterScreen = () => {
  const navigation = useNavigation();
  const theme = useTheme();
  // ensure nested address object exists so assignments like
  // fieldRefs.current.address.street = ref do not throw
  const fieldRefs = useRef({ address: {} });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showAcceptButton, setShowAcceptButton] = useState(false);
  const termsSheetRef = useRef(null);

  const route = useRoute();
  const passedPhone = route.params?.phone || '';

  const { completeRegistration, authState } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const setFieldValueRef = useRef(null);
  const imagePickerRef = useBottomSheet();
  const [imageTarget, setImageTarget] = useState(null);

  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const stateSheetRef = useRef(null);
  const businessTypeSheetRef = useRef(null);
  const [selectedStateObj, setSelectedStateObj] = useState(null);

  const openImagePickerFor = useCallback(target => {
    setImageTarget(target); // 'logo' or 'signature'
    imagePickerRef.present();
  }, []);

  const handleStateSelect = (state, setFieldValue) => {
    setSelectedStateObj(state);
    setFieldValue('address.state', state.name); // update Formik value
    stateSheetRef.current?.close();
  };

  const openBusinessTypeSelector = () => {
    if (businessTypeSheetRef.current) {
      businessTypeSheetRef.current.expand();
    }
  };

  const openStateSelector = () => {
    stateSheetRef.current?.expand();
  };

  useEffect(() => {
    setShowAcceptButton(true);
    termsSheetRef.current?.present();
  }, []);

  const handleAcceptTerms = () => {
    setTermsAccepted(true);
    setShowAcceptButton(false);
    termsSheetRef.current?.close();
  };
  const signatureOptions = [
    {
      id: 'camera',
      label: 'Take Picture',
      description: 'Open camera to capture',
      icon: 'camera-outline',
    },
    {
      id: 'gallery',
      label: 'Pick Photo',
      description: 'Choose from your photos',
      icon: 'image-multiple-outline',
    },
    {
      id: 'signature-pad',
      label: 'Signature Pad',
      description: 'Draw your signature now',
      icon: 'gesture',
    },
  ];

  const logoOptions = [
    {
      id: 'camera',
      label: 'Take Picture',
      description: 'Open camera to capture',
      icon: 'camera-outline',
    },
    {
      id: 'gallery',
      label: 'Pick Photo',
      description: 'Choose from your photos',
      icon: 'image-multiple-outline',
    },
  ];

  const initialValues = {
    fullName: '',
    email: '',
    phoneNumber: passedPhone || '',
    businessName: '',
    businessType: '',
    tagline: '', // NEW
    contactNumber: '', // NEW
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
    },
    gstNumber: '',
    panNumber: '',
    businessRegistrationNumber: '',
    website: '',
    logo: null,
    signature: null,
    bankDetails: {
      accountName: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      branch: '', // NEW
      upiId: '', // NEW
    },
    invoicePrefix: 'INV', // NEW
    invoiceStartNumber: '1', // NEW
  };

  const validationSchema = Yup.object().shape({
    // Basic Details
    fullName: Yup.string()
      .trim()
      .matches(/^[a-zA-Z\s]+$/, 'Full name can only contain letters')
      .min(3, 'Full name must be at least 3 characters')
      .max(100, 'Full name is too long')
      .required('Full name is required'),

    email: Yup.string()
      .trim()
      .email('Invalid email address')
      .max(150, 'Email is too long')
      .nullable(),

    phoneNumber: Yup.string()
      .matches(
        /^[6-9]\d{9}$/,
        'Phone number must be valid 10 digits (start 6-9)',
      )
      .required('Phone number is required'),

    // Business Information
    businessName: Yup.string()
      .trim()
      .min(2, 'Business name is too short')
      .max(60, 'Business name is too long')
      .required('Business name is required'),

    ownershipType: Yup.string(),

    businessType: Yup.string().required('Business type is required'),

    tagline: Yup.string().nullable().max(50, 'Tagline too long'),

    contactNumber: Yup.string()
      .matches(
        /^[6-9]\d{9}$/,
        'Contact number must be valid 10 digits (start 6-9)',
      )
      .nullable(),

    address: Yup.object().shape({
      street: Yup.string().trim().required('Street address is required'),
      city: Yup.string().trim().required('City is required'),
      state: Yup.string().trim().required('State is required'),
      pincode: Yup.string()
        .matches(/^\d{6}$/, 'Pincode must be 6 digits')
        .required('Pincode is required'),
      country: Yup.string().trim().required('Country is required'),
    }),

    // Tax & Legal Information
    gstNumber: Yup.string()
      .nullable()
      .uppercase()
      .matches(
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        'Invalid GST format',
      ),

    panNumber: Yup.string()
      .nullable()
      .uppercase()
      .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'),

    businessRegistrationNumber: Yup.string()
      .nullable()
      .max(50, 'Registration number too long'),

    // Bank Details
    bankDetails: Yup.object().shape({
      accountName: Yup.string().nullable().max(100, 'Account name too long'),
      accountNumber: Yup.string()
        .nullable()
        .matches(/^\d{9,18}$/, 'Account number must be 9-18 digits'),
      ifscCode: Yup.string()
        .nullable()
        .uppercase()
        .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code'),
      bankName: Yup.string().nullable().max(100, 'Bank name too long'),
      branch: Yup.string().nullable().max(100, 'Branch name too long'),
      upiId: Yup.string()
        .nullable()
        .matches(/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/, 'Invalid UPI ID'),
    }),

    // Invoice Settings
    invoicePrefix: Yup.string()
      .trim()
      .required('Invoice prefix is required')
      .test(
        'valid-chars',
        'Prefix can only contain uppercase letters, /, or -',
        value => /^[A-Z/-]+$/.test(value || ''),
      )
      .test('length', 'Prefix must be 2–6 characters long', value =>
        value ? value.length >= 2 && value.length <= 6 : false,
      )
      .uppercase(),

    invoiceStartNumber: Yup.number()
      .typeError('Start number must be a number')
      .integer('Must be an integer')
      .min(1, 'Must be at least 1')
      .max(999999, 'Too large'),

    // Additional Information
    website: Yup.string()
      .nullable()
      .url('Invalid website URL')
      .max(200, 'Website URL too long'),

    logo: Yup.mixed()
      .nullable()
      .test('fileSize', 'Logo size must be less than 2MB', value =>
        value ? value.size <= 2 * 1024 * 1024 : true,
      )
      .test('fileType', 'Unsupported file format', value =>
        value ? ['image/jpeg', 'image/png'].includes(value.type) : true,
      ),

    signature: Yup.mixed()
      .nullable()
      .test('fileSize', 'Signature size must be less than 2MB', value =>
        value ? value.size <= 2 * 1024 * 1024 : true,
      )
      .test('fileType', 'Unsupported file format', value =>
        value ? ['image/jpeg', 'image/png'].includes(value.type) : true,
      ),
  });

  const steps = [
    { title: 'Basic Details', icon: 'account' },
    { title: 'Business Info', icon: 'office-building' },
    { title: 'Tax & Legal', icon: 'file-document' },
    { title: 'Additional Info', icon: 'plus-circle' },
  ];

  const ownershipType = [
    'Sole Proprietorship',
    'Partnership',
    'Private Limited Company',
    'LLP',
    'Public Limited Company',
    'OPC',
    'Others',
  ];

  // helper to resolve nested ref stored as nested objects, e.g. 'address.street'
  const getFieldRef = path => {
    if (!path) return null;
    const segments = path.split('.');
    let curr = fieldRefs.current;
    for (let i = 0; i < segments.length; i++) {
      if (!curr) return null;
      curr = curr[segments[i]];
    }
    return curr || null;
  };

  // helper: flatten nested error object
  const flattenErrors = (errObj, path = '', res = {}) => {
    Object.keys(errObj).forEach(key => {
      const newPath = path ? `${path}.${key}` : key;
      if (typeof errObj[key] === 'string') {
        res[newPath] = errObj[key];
      } else if (typeof errObj[key] === 'object' && errObj[key] !== null) {
        flattenErrors(errObj[key], newPath, res);
      }
    });
    return res;
  };

  const nextStep = async ({ validateForm, setTouched, values }) => {
    try {
      const validationErrors = await validateForm();
      const flatErrors = flattenErrors(validationErrors);

      // which fields belong to this step
      let stepFields = [];
      switch (currentStep) {
        case 0:
          stepFields = ['fullName', 'email', 'phoneNumber'];
          break;
        case 1:
          stepFields = [
            'businessName',
            'ownershipType',
            'businessType',
            'address.street',
            'address.city',
            'address.state',
            'address.pincode',
          ];
          break;
        case 2:
          stepFields = [
            'gstNumber',
            'panNumber',
            'businessRegistrationNumber',
            'bankDetails.accountNumber',
            'bankDetails.ifscCode',
          ];
          break;
        case 3:
          stepFields = [
            'invoicePrefix',
            'invoiceStartNumber',
            'website',
            'logo',
            'signature',
          ];
          break;
      }

      // keep only current step errors
      const currentStepErrors = Object.keys(flatErrors).filter(errKey =>
        stepFields.some(f => errKey.startsWith(f)),
      );

      if (currentStepErrors.length === 0) {
        if (currentStep < steps.length - 1) {
          setCurrentStep(currentStep + 1);
        } else {
          handleSubmitForm(values);
        }
      } else {
        // --- Safely mark fields as touched ---
        let touchedObj = {};
        currentStepErrors.forEach(path => {
          const segments = path.split('.');
          let curr = touchedObj;
          for (let i = 0; i < segments.length; i++) {
            const key = segments[i];
            if (i === segments.length - 1) {
              curr[key] = true;
            } else {
              curr[key] = curr[key] || {};
              curr = curr[key];
            }
          }
        });
        setTouched(touchedObj);

        // --- Focus logic ---
        const firstErrorKey = currentStepErrors[0];
        const field = getFieldRef(firstErrorKey);

        if (field && field.focus) {
          field.focus();
        } else if (firstErrorKey.includes('state')) {
          openStateSelector();
        } else if (firstErrorKey.includes('businessType')) {
          Toast.show({
            type: 'info',
            text1: 'Please select a business type',
          });
        }
      }
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  const pickAndCrop = useCallback(
    async source => {
      const isLogo = imageTarget === 'logo';
      const cropOptions = {
        cropping: true,
        width: isLogo ? 800 : 1000,
        height: isLogo ? 800 : 400,
        includeExif: false,
        compressImageQuality: 0.9,
        forceJpg: true,
        mediaType: 'photo',
      };

      if (source === 'camera') {
        const ok = await ensureCameraPermission();
        if (!ok) throw new Error('Camera permission denied');

        const res = await launchCamera({
          mediaType: 'photo',
          quality: 0.9,
          saveToPhotos: false,
        });
        if (res.didCancel) throw new Error('cancelled');
        if (res.errorCode) throw new Error(res.errorMessage || res.errorCode);
        const a = res.assets?.[0];
        if (!a?.uri) throw new Error('No image captured');

        const cropped = await ImageCropPicker.openCropper({
          path: a.uri,
          ...cropOptions,
        });
        return {
          uri: cropped.path,
          type: 'image/jpeg',
          fileName: `${imageTarget}_${Date.now()}.jpg`,
          width: cropped.width,
          height: cropped.height,
          size: cropped.size,
        };
      }

      // gallery
      const ok = await ensurePhotoPermission();
      if (!ok) throw new Error('Photo permission denied');

      const res = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.9,
        selectionLimit: 1,
      });
      if (res.didCancel) throw new Error('cancelled');
      if (res.errorCode) throw new Error(res.errorMessage || res.errorCode);
      const a = res.assets?.[0];
      if (!a?.uri) throw new Error('No image selected');

      const cropped = await ImageCropPicker.openCropper({
        path: a.uri,
        ...cropOptions,
      });
      return {
        uri: cropped.path,
        type: 'image/jpeg',
        fileName: `${imageTarget}_${Date.now()}.jpg`,
        width: cropped.width,
        height: cropped.height,
        size: cropped.size,
      };
    },
    [imageTarget],
  );

  const handleImagePickerSelect = useCallback(
    async (option, setFieldValue) => {
      try {
        if (option.id === 'signature-pad') {
          // Open the modal; selection will be handled by modal's onDone
          setShowSignaturePad(true);
          return;
        }
        const result = await pickAndCrop(option.id); // 'camera' | 'gallery'
        if (imageTarget) setFieldValue(imageTarget, result);
      } catch (e) {
        if (e?.message !== 'cancelled') {
          Alert.alert('Image Error', e?.message || 'Could not process image');
        }
      } finally {
        imagePickerRef.close();
        // Keep imageTarget when opening pad; close on pad completion/cancel instead
        if (option.id !== 'signature-pad') {
          setImageTarget(null);
        }
      }
    },
    [pickAndCrop, imageTarget],
  );

  const handleSubmitForm = async values => {
    setLoading(true);
    try {
      const effectivePhone = passedPhone || values.phoneNumber || '';
      const formData = new FormData();

      // Store Data
      formData.append('storeData[name]', values.businessName);
      formData.append('storeData[ownershipType]', values.ownershipType || '');
      formData.append('storeData[type]', values.businessType);
      formData.append('storeData[tagline]', values.tagline || '');
      formData.append('storeData[gstNumber]', values.gstNumber);
      formData.append('storeData[panNo]', values.panNumber);
      formData.append(
        'storeData[registrationNo]',
        values.businessRegistrationNumber,
      );
      formData.append('storeData[contactNo]', values.contactNumber);
      formData.append('storeData[email]', values.email);
      formData.append('storeData[address][street]', values.address.street);
      formData.append('storeData[address][city]', values.address.city);
      formData.append('storeData[address][state]', values.address.state);
      formData.append(
        'storeData[address][country]',
        values.address.country || 'IN',
      );
      formData.append('storeData[address][postalCode]', values.address.pincode);
      formData.append(
        'storeData[bankDetails][bankName]',
        values.bankDetails.bankName,
      );
      formData.append(
        'storeData[bankDetails][accountNo]',
        values.bankDetails.accountNumber,
      );
      formData.append(
        'storeData[bankDetails][holderName]',
        values.bankDetails.accountName,
      );
      formData.append(
        'storeData[bankDetails][ifsc]',
        values.bankDetails.ifscCode,
      );
      formData.append(
        'storeData[bankDetails][branch]',
        values.bankDetails.branch || '',
      );
      formData.append(
        'storeData[bankDetails][upiId]',
        values.bankDetails.upiId || '',
      );
      formData.append(
        'storeData[settings][invoicePrefix]',
        values.invoicePrefix || 'INV',
      );
      formData.append(
        'storeData[settings][invoiceStartNumber]',
        values.invoiceStartNumber || '1',
      );

      // User Data
      formData.append('userData[phone]', effectivePhone);
      formData.append('userData[name]', values.fullName);
      formData.append('userData[email]', values.email);

      // Files
      if (values.logo) {
        formData.append('logo', {
          uri: values.logo.uri,
          type: values.logo.type || 'image/jpeg',
          name: values.logo.fileName || `logo_${Date.now()}.jpg`,
        });
      }
      if (values.signature) {
        // console.log('Appending signature to FormData:', values.signature);
        formData.append('signature', {
          uri: values.signature.uri,
          type: values.signature.type || 'image/png',
          name: values.signature.fileName || `signature_${Date.now()}.png`,
        });
      }
      // console.log('Form Data preview', formData);
      // console.log('Signature before submit:', values.signature);


      // Append tempToken from AuthContext
      const res = await completeRegistration(formData);
      // console.log('Registration API Response:', res);
      if (res.success) {
        //await api.post('/subscription/get-free'); free plan hata diya
        // Toast.show({
        //   type: 'success',
        //   text1: 'Registration Successful',
        //   text2: res.message || 'Welcome!',
        // });
        // navigation.reset({
        //   index: 0,
        //   routes: [{ name: 'MainTabs' }],
        // });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Registration Failed',
          text2: res.message || 'Something went wrong',
        });
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Something went wrong!');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = formikProps => {
    switch (currentStep) {
      case 0:
        return renderBasicDetails(formikProps);
      case 1:
        return renderBusinessInfo(formikProps);
      case 2:
        return renderTaxLegal(formikProps);
      case 3:
        return renderAdditionalInfo(formikProps);
      default:
        return null;
    }
  };

  const renderBasicDetails = ({
    values,
    handleChange,
    handleBlur,
    errors,
    touched,
  }) => (
    <View>
      <Text style={styles.stepTitle}>Personal Information</Text>
      <Text style={styles.stepDescription}>
        Let's start with your basic details
      </Text>

      <TextInput
        ref={ref => (fieldRefs.current.fullName = ref)}
        label={<FormLabel required>Full Name</FormLabel>}
        value={values.fullName}
        onChangeText={handleChange('fullName')}
        onBlur={handleBlur('fullName')}
        mode="outlined"
        style={styles.input}
        theme={{ roundness: 12 }}
        // placeholder="e.g. John Doe"
        error={touched.fullName && errors.fullName}
        left={<TextInput.Icon icon="account" />}
      />
      {touched.fullName && errors.fullName && (
        <Text style={styles.errorText}>{errors.fullName}</Text>
      )}

      <TextInput
        label="Email Address"
        value={values.email}
        onChangeText={handleChange('email')}
        onBlur={handleBlur('email')}
        mode="outlined"
        style={styles.input}
        theme={{ roundness: 12 }}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="e.g. johndoe@example.com"
        error={touched.email && errors.email}
        left={<TextInput.Icon icon="email" />}
      />
      {touched.email && errors.email && (
        <Text style={styles.errorText}>{errors.email}</Text>
      )}

      <TextInput
        ref={ref => (fieldRefs.current.phoneNumber = ref)}
        label={<FormLabel required>Phone Number</FormLabel>}
        value={values.phoneNumber}
        onChangeText={handleChange('phoneNumber')}
        onBlur={handleBlur('phoneNumber')}
        mode="outlined"
        editable={!passedPhone} // If phone is passed, make it read-only
        style={styles.input}
        theme={{ roundness: 12 }}
        keyboardType="phone-pad"
        // placeholder="9876543210"
        error={touched.phoneNumber && errors.phoneNumber}
        left={<TextInput.Icon icon="phone" />}
      />
      {touched.phoneNumber && errors.phoneNumber && (
        <Text style={styles.errorText}>{errors.phoneNumber}</Text>
      )}
    </View>
  );

  const renderBusinessInfo = ({
    values,
    handleChange,
    handleBlur,
    errors,
    touched,
    setFieldValue,
  }) => (
    <View>
      <Text style={styles.stepTitle}>Business Information</Text>
      <Text style={styles.stepDescription}>Tell us about your business</Text>

      <TextInput
        ref={ref => (fieldRefs.current.businessName = ref)}
        label={<FormLabel required>Business Name</FormLabel>}
        value={values.businessName}
        onChangeText={handleChange('businessName')}
        onBlur={handleBlur('businessName')}
        mode="outlined"
        style={styles.input}
        theme={{ roundness: 12 }}
        // placeholder="e.g. FreshMart Pvt Ltd"
        error={touched.businessName && errors.businessName}
        left={<TextInput.Icon icon="office-building" />}
      />
      {touched.businessName && errors.businessName && (
        <Text style={styles.errorText}>{errors.businessName}</Text>
      )}

      <TouchableOpacity activeOpacity={1} onPress={openBusinessTypeSelector}>
        <TextInput
          label={<FormLabel required>Business Type</FormLabel>}
          value={values.businessType}
          mode="outlined"
          style={styles.input}
          editable={false}
          left={<TextInput.Icon icon="domain" />}
          right={<TextInput.Icon icon="chevron-down" />}
          pointerEvents="none"
          theme={{
            roundness: 12,
          }}
        />
      </TouchableOpacity>
      {touched.businessType && errors.businessType && (
        <Text style={styles.errorText}>{errors.businessType}</Text>
      )}

      <TextInput
        label="Tagline (optional)"
        value={values.tagline}
        onChangeText={handleChange('tagline')}
        onBlur={handleBlur('tagline')}
        mode="outlined"
        style={styles.input}
        theme={{ roundness: 12 }}
      // placeholder="e.g. Quality groceries at your doorstep"
      />

      <TextInput
        label="Contact Number"
        value={values.contactNumber}
        onChangeText={handleChange('contactNumber')}
        onBlur={handleBlur('contactNumber')}
        mode="outlined"
        style={styles.input}
        theme={{ roundness: 12 }}
        keyboardType="phone-pad"
        // placeholder="9876543210"
        error={touched.contactNumber && errors.contactNumber}
        left={<TextInput.Icon icon="phone" />}
        maxLength={10}
      />
      {touched.contactNumber && errors.contactNumber && (
        <Text style={styles.errorText}>{errors.contactNumber}</Text>
      )}

      <Divider style={styles.divider} />
      <Text style={styles.sectionTitle}>Business Address</Text>

      <TextInput
        ref={ref => (fieldRefs.current.address.street = ref)}
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

      <View style={styles.row}>
        <TextInput
          ref={ref => (fieldRefs.current.address.city = ref)}
          label={<FormLabel required>City</FormLabel>}
          value={values.address.city}
          onChangeText={text => setFieldValue('address.city', text)}
          onBlur={handleBlur('address.city')}
          mode="outlined"
          style={[styles.input, styles.halfInput]}
          theme={{ roundness: 12 }}
          // placeholder="Mumbai"
          error={touched.address?.city && errors.address?.city}
        />

        <TouchableOpacity
          onPress={openStateSelector}
          activeOpacity={0.7}
          style={styles.halfInput}
        >
          <TextInput
            ref={ref => (fieldRefs.current.address.state = ref)}
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
          />
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <View style={styles.halfInput}>
          {touched.address?.city && errors.address?.city ? (
            <Text style={styles.errorText}>{errors.address.city}</Text>
          ) : null}
        </View>
        <View style={styles.halfInput}>
          {touched.address?.state && errors.address?.state ? (
            <Text style={styles.errorText}>{errors.address.state}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.row}>
        <TextInput
          ref={ref => (fieldRefs.current.address.pincode = ref)}
          label={<FormLabel required>Pincode</FormLabel>}
          value={values.address.pincode}
          onChangeText={text => setFieldValue('address.pincode', text)}
          onBlur={handleBlur('address.pincode')}
          mode="outlined"
          style={[styles.input, styles.halfInput]}
          theme={{ roundness: 12 }}
          maxLength={6}
          keyboardType="numeric"
          // placeholder="400001"
          error={touched.address?.pincode && errors.address?.pincode}
        />
        <TextInput
          label="Country"
          value={values.address.country}
          mode="outlined"
          style={[styles.input, styles.halfInput]}
          theme={{ roundness: 12 }}
          editable={false}
        // placeholder="India"
        />
      </View>
      <View style={styles.row}>
        <View style={styles.halfInput}>
          {touched.address?.pincode && errors.address?.pincode ? (
            <Text style={styles.errorText}>{errors.address.pincode}</Text>
          ) : null}
        </View>
        <View style={styles.halfInput} />
      </View>
    </View>
  );

  const renderTaxLegal = ({
    values,
    handleChange,
    handleBlur,
    errors,
    touched,
    setFieldValue,
  }) => (
    <View>
      <Text style={styles.stepTitle}>Tax & Legal Information</Text>
      <Text style={styles.stepDescription}>
        Optional but recommended for business invoicing
      </Text>

      <TextInput
        label="GST Number"
        value={values.gstNumber}
        onChangeText={text => setFieldValue('gstNumber', text.toUpperCase())}
        onBlur={handleBlur('gstNumber')}
        mode="outlined"
        style={styles.input}
        theme={{ roundness: 12 }}
        autoCapitalize="characters"
        // placeholder="22AAAAA0000A1Z5"
        error={touched.gstNumber && errors.gstNumber}
        left={<TextInput.Icon icon="receipt" />}
      />
      {touched.gstNumber && errors.gstNumber && (
        <Text style={styles.errorText}>{errors.gstNumber}</Text>
      )}

      <TextInput
        label="PAN Number"
        value={values.panNumber}
        onChangeText={text => setFieldValue('panNumber', text.toUpperCase())}
        onBlur={handleBlur('panNumber')}
        mode="outlined"
        style={styles.input}
        theme={{ roundness: 12 }}
        autoCapitalize="characters"
        maxLength={10}
        // placeholder="ABCDE1234F"
        error={touched.panNumber && errors.panNumber}
        left={<TextInput.Icon icon="card-account-details" />}
      />
      {touched.panNumber && errors.panNumber && (
        <Text style={styles.errorText}>{errors.panNumber}</Text>
      )}

      <TextInput
        label="Business Registration Number"
        value={values.businessRegistrationNumber}
        onChangeText={handleChange('businessRegistrationNumber')}
        onBlur={handleBlur('businessRegistrationNumber')}
        mode="outlined"
        style={styles.input}
        theme={{ roundness: 12 }}
        // placeholder="BRN12345678"
        left={<TextInput.Icon icon="file-document" />}
      />

      <Text style={styles.fieldLabel}>Registeration Type</Text>
      <View style={styles.chipContainer}>
        {ownershipType.map(type => (
          <Chip
            key={type}
            mode={values.ownershipType === type ? 'flat' : 'outlined'}
            selected={values.ownershipType === type}
            onPress={() => setFieldValue('ownershipType', type)}
            style={styles.chip}
            textStyle={styles.chipText}
          >
            {type}
          </Chip>
        ))}
      </View>
      {errors.ownershipType && (
        <Text style={styles.errorText}>{errors.ownershipType}</Text>
      )}

      <Divider style={styles.divider} />
      <Text style={styles.sectionTitle}>Bank Details (Optional)</Text>
      <Text style={styles.sectionDescription}>
        Add bank details to include in invoices
      </Text>

      <TextInput
        label="Account Holder Name"
        value={values.bankDetails.accountName}
        onChangeText={text => setFieldValue('bankDetails.accountName', text)}
        onBlur={handleBlur('bankDetails.accountName')}
        mode="outlined"
        style={styles.input}
        theme={{ roundness: 12 }}
        // placeholder="John Doe"
        left={<TextInput.Icon icon="account" />}
      />

      <TextInput
        label="Account Number"
        value={values.bankDetails.accountNumber}
        onChangeText={text => setFieldValue('bankDetails.accountNumber', text)}
        onBlur={handleBlur('bankDetails.accountNumber')}
        mode="outlined"
        style={styles.input}
        theme={{ roundness: 12 }}
        keyboardType="numeric"
        // placeholder="1234567890123456"
        left={<TextInput.Icon icon="bank" />}
      />

      <View style={styles.row}>
        <TextInput
          label="IFSC Code"
          value={values.bankDetails.ifscCode}
          onChangeText={text =>
            setFieldValue('bankDetails.ifscCode', text.toUpperCase())
          }
          onBlur={handleBlur('bankDetails.ifscCode')}
          mode="outlined"
          style={[styles.input, styles.halfInput]}
          theme={{ roundness: 12 }}
          autoCapitalize="characters"
          // placeholder="SBIN0001234"
          error={touched.bankDetails?.ifscCode && errors.bankDetails?.ifscCode}
        />
        <TextInput
          label="Bank Name"
          value={values.bankDetails.bankName}
          onChangeText={text => setFieldValue('bankDetails.bankName', text)}
          onBlur={handleBlur('bankDetails.bankName')}
          mode="outlined"
          style={[styles.input, styles.halfInput]}
          theme={{ roundness: 12 }}
          placeholder="State Bank of India"
        />
      </View>

      <TextInput
        label="Branch"
        value={values.bankDetails.branch}
        onChangeText={text => setFieldValue('bankDetails.branch', text)}
        onBlur={handleBlur('bankDetails.branch')}
        mode="outlined"
        style={styles.input}
        theme={{ roundness: 12 }}
      // placeholder="Andheri West, Mumbai"
      />

      <TextInput
        label="UPI ID"
        value={values.bankDetails.upiId}
        onChangeText={text => setFieldValue('bankDetails.upiId', text)}
        onBlur={handleBlur('bankDetails.upiId')}
        mode="outlined"
        style={styles.input}
        theme={{ roundness: 12 }}
        // placeholder="john.doe@okaxis"
        error={touched.bankDetails?.upiId && errors.bankDetails?.upiId}
      />
      {touched.bankDetails?.upiId && errors.bankDetails?.upiId && (
        <Text style={styles.errorText}>{errors.bankDetails.upiId}</Text>
      )}
    </View>
  );

  const renderAdditionalInfo = ({
    values,
    handleChange,
    handleBlur,
    errors,
    touched,
    setFieldValue,
  }) => (
    <View>
      <Text style={styles.stepTitle}>Additional Information</Text>
      <Text style={styles.stepDescription}>
        Customize your business profile
      </Text>

      <TextInput
        label="Invoice Prefix"
        value={values.invoicePrefix}
        onChangeText={text =>
          setFieldValue('invoicePrefix', text.toUpperCase())
        }
        onBlur={handleBlur('invoicePrefix')}
        mode="outlined"
        maxLength={8}
        style={[styles.input, { textTransform: 'uppercase' }]}
        theme={{ roundness: 12 }}
        autoCapitalize="characters"
        placeholder="Enter prefix (e.g. INV, BILL, TAX)"
      />
      {touched.invoicePrefix && errors.invoicePrefix && (
        <Text style={styles.errorText}>{errors.invoicePrefix}</Text>
      )}

      <TextInput
        label="Invoice Start Number"
        value={String(values.invoiceStartNumber)}
        onChangeText={text =>
          setFieldValue(
            'invoiceStartNumber',
            text.replace(/[^0-9]/g, ''), // only digits
          )
        }
        onBlur={handleBlur('invoiceStartNumber')}
        mode="outlined"
        style={styles.input}
        theme={{ roundness: 12 }}
        keyboardType="numeric"
        placeholder="e.g. 1001"
      />
      {touched.invoiceStartNumber && errors.invoiceStartNumber && (
        <Text style={styles.errorText}>{errors.invoiceStartNumber}</Text>
      )}

      <TextInput
        label="Website URL"
        value={values.website}
        onChangeText={text => {
          let url = text.trim();
          if (url && !/^https?:\/\//i.test(url)) {
            url = 'https://' + url; // auto prepend https
          }
          setFieldValue('website', url);
        }}
        onBlur={handleBlur('website')}
        mode="outlined"
        style={styles.input}
        theme={{ roundness: 12 }}
        keyboardType="url"
        autoCapitalize="none"
        placeholder="e.g. yourbusiness.com"
        error={touched.website && errors.website}
        left={<TextInput.Icon icon="web" />}
      />
      {touched.website && errors.website && (
        <Text style={styles.errorText}>{errors.website}</Text>
      )}

      <Divider style={styles.divider} />

      {/* Business Logo Upload */}
      <View style={styles.uploadSection}>
        <Text style={styles.sectionTitle}>Business Logo</Text>
        <Text style={styles.sectionDescription}>
          Upload your business logo for invoices
        </Text>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => openImagePickerFor('logo')}
        >
          {values.logo ? (
            <View style={styles.uploadedImageContainer}>
              <Image
                source={{ uri: values.logo.uri }}
                style={styles.uploadedImage}
              />
              <IconButton
                icon="close-circle"
                size={24}
                onPress={() => setFieldValue('logo', null)}
                style={styles.removeButton}
                iconColor="white"
                containerColor="#e74c3c"
              />
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Icon source="upload" size={40} color={theme.colors.primary} />
              <Text style={styles.uploadText}>Tap to upload logo</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Digital Signature Upload */}
      <View style={styles.uploadSection}>
        <Text style={styles.sectionTitle}>Digital Signature</Text>
        <Text style={styles.sectionDescription}>
          Upload your signature for invoices
        </Text>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => openImagePickerFor('signature')}
        >
          {values.signature ? (
            <View style={styles.uploadedImageContainer}>
              <Image
                source={{ uri: values.signature.uri }}
                style={styles.uploadedSignature}
                resizeMode="contain"
              />
              <IconButton
                icon="close-circle"
                size={24}
                onPress={() => setFieldValue('signature', null)}
                style={styles.removeButton}
                iconColor="white"
                containerColor="#e74c3c"
              />
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Icon source="draw" size={40} color={theme.colors.primary} />
              <Text style={styles.uploadText}>Tap to upload signature</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        validateOnChange={true}
        validateOnBlur={true}
        onSubmit={handleSubmitForm}
      >
        {({
          handleChange,
          handleBlur,
          handleSubmit,
          values,
          errors,
          touched,
          setFieldValue,
          validateForm,
          setTouched,
        }) => {
          setFieldValueRef.current = setFieldValue;
          return (
            <>
              <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              >
                <View
                  style={[
                    styles.container,
                    { backgroundColor: theme.colors.background },
                  ]}
                >
                  <View style={styles.header}>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>
                      Step {currentStep + 1} of {steps.length}
                    </Text>
                    <ProgressBar
                      progress={(currentStep + 1) / steps.length}
                      color={theme.colors.primary}
                      style={styles.progressBar}
                    />
                  </View>

                  <View style={styles.stepIndicators}>
                    {steps.map((step, index) => (
                      <View key={index} style={styles.stepIndicator}>
                        <View
                          style={[
                            styles.stepCircle,
                            {
                              backgroundColor:
                                index <= currentStep
                                  ? theme.colors.primary
                                  : theme.colors.outline,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={step.icon}
                            size={20}
                            color={
                              index <= currentStep
                                ? 'white'
                                : theme.colors.onSurface
                            }
                          />
                        </View>
                        <Text
                          style={[
                            styles.stepText,
                            {
                              color:
                                index <= currentStep
                                  ? theme.colors.primary
                                  : theme.colors.outline,
                              fontWeight:
                                index === currentStep ? 'bold' : 'normal',
                            },
                          ]}
                        >
                          {step.title}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Form Content */}
                  <ScrollView
                    style={styles.formContainer}
                    showsVerticalScrollIndicator={false}
                  >
                    <Card style={styles.formCard}>
                      <Card.Content>
                        {renderStepContent({
                          values,
                          handleChange,
                          handleBlur,
                          errors,
                          touched,
                          setFieldValue,
                          validateForm,
                          setTouched,
                        })}
                      </Card.Content>
                    </Card>
                  </ScrollView>

                  <View style={styles.buttonContainer}>
                    <View style={styles.buttonRow}>
                      {currentStep > 0 && (
                        <Button
                          mode="outlined"
                          onPress={() => setCurrentStep(currentStep - 1)}
                          style={styles.backButton}
                        >
                          Back
                        </Button>
                      )}
                      <View style={styles.nextButtonContainer}>
                        <Button
                          mode="contained"
                          onPress={() =>
                            nextStep({
                              validateForm,
                              setTouched,
                              values,
                              errors,
                            })
                          }
                          loading={loading}
                          disabled={loading}
                          style={styles.nextButton}
                        >
                          {currentStep === steps.length - 1
                            ? 'Register'
                            : 'Next'}
                        </Button>
                      </View>
                    </View>
                  </View>
                </View>
              </KeyboardAvoidingView>
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

              <ImagePickerBottomSheet
                ref={imagePickerRef.bottomSheetRef}
                title="Add Image"
                subtitle={
                  imageTarget === 'logo'
                    ? 'Logo: choose a source'
                    : imageTarget === 'signature'
                      ? 'Signature: choose a source'
                      : ''
                }
                onSelect={option =>
                  handleImagePickerSelect(option, setFieldValue)
                }
                options={
                  imageTarget === 'signature' ? signatureOptions : logoOptions
                }
              />

              <SignaturePadModal
                visible={showSignaturePad}
                title="Draw your signature"
                onDone={signatureData => {
                  // console.log('Raw signatureData from modal:', signatureData);
                  if (imageTarget === 'signature' && signatureData?.uri) {
                    // ✅ Ensure consistent structure
                    const fileObj = {
                      uri: signatureData.uri,
                      type: signatureData.type || 'image/png',
                      fileName: signatureData.fileName || `signature_${Date.now()}.png`,
                      size: signatureData.size || 0, // Add size if available
                      width: signatureData.width,
                      height: signatureData.height,
                    };
                    setFieldValueRef.current?.('signature', fileObj);
                    // console.log('✅ Signature set in Formik:', fileObj);
                  } else {
                    console.warn('⚠️ Signature data missing uri:', signatureData);
                  }
                  setShowSignaturePad(false);
                  imagePickerRef.close();
                  setImageTarget(null);
                }}

                onCancel={() => {
                  setShowSignaturePad(false);
                }}
              />

            </>
          );
        }}
      </Formik>
      <TermsBottomSheet
        showCloseButton={false}
        enableDismissOnClose={false}
        backdropbehavior="none"
        initialSnapIndex={0}
        ref={termsSheetRef}
        showAcceptButton={showAcceptButton}
        onAccept={handleAcceptTerms}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  stepIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  stepIndicator: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepText: {
    fontSize: 10,
    textAlign: 'center',
  },
  formContainer: {
    flex: 1,
    padding: 12,
  },
  formCard: {
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: -12,
    marginBottom: 8,
    marginLeft: 16,
  },
  errorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfError: {
    width: '48%',
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    marginLeft: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  chip: {
    margin: 2,
  },
  chipText: {
    fontSize: 10,
  },
  divider: {
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
  },
  uploadSection: {
    marginBottom: 24,
  },
  uploadButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  uploadPlaceholder: {
    alignItems: 'center',
  },
  uploadText: {
    marginTop: 8,
    fontSize: 16,
    opacity: 0.7,
  },
  uploadedImageContainer: {
    position: 'relative',
  },
  uploadedImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  uploadedSignature: {
    width: 150,
    height: 75,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -15,
    right: -15,
  },
  buttonContainer: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flex: 0,
    minWidth: 100,
  },
  nextButtonContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  nextButton: {
    minWidth: 100,
  },

  linkContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  link: {
    textDecorationLine: 'underline',
    fontSize: 16,
  },
});

export default RegisterScreen;
