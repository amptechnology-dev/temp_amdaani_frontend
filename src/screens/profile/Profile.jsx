import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  useTheme,
  SegmentedButtons,
  Divider,
  Surface,
  IconButton,
  Icon,
  Modal,
  Portal,
  List,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Navbar from '../../components/Navbar';
import StateSelectorBottomSheet from '../../components/BottomSheet/SelectStateBottomSheet';
import ImagePickerBottomSheet from '../../components/BottomSheet/ImagePickerBottomSheet';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import SignaturePadModal from '../../components/SignaturePadModal';
import api from '../../utils/api';
import ImageCropPicker from 'react-native-image-crop-picker';
import {
  ensureCameraPermission,
  ensurePhotoPermission,
} from '../../utils/permissions';
import Toast from 'react-native-toast-message';
import CustomAlert from '../../components/CustomAlert';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useAuth, permissions } from '../../context/AuthContext';
import * as ImagePicker from 'react-native-image-picker';
import BusinessTypeSelectorBottomSheet from '../../components/BottomSheet/BusinessTypeSelectorBottomSheet';
import { ProfileSkeleton } from '../../components/Skeletons';
import {
  actions,
  RichEditor,
  RichToolbar,
} from 'react-native-pell-rich-editor';

const bankFields = ['bankName', 'accountNo', 'holderName', 'ifsc', 'branch'];

const validationSchema = Yup.object()
  .shape({
    businessName: Yup.string().required('Business Name is required'),

    gstin: Yup.string()
      .nullable()
      .test(
        'valid-gstin',
        'Invalid GSTIN format',
        value =>
          !value ||
          /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
            value,
          ),
      )
      .uppercase(),

    phoneNumber: Yup.string().matches(
      /^[0-9]{10}$/,
      'Phone Number must be 10 digits',
    ),

    emailId: Yup.string().email('Invalid email'),

    businessType: Yup.string().required('Business Type is required'),

    businessTagline: Yup.string().nullable(),
    registrationNo: Yup.string().nullable(),

    street: Yup.string().required('Street is required'),
    city: Yup.string().required('City is required'),
    state: Yup.string().required('State is required'),
    country: Yup.string().nullable(),

    pincode: Yup.string()
      .required('Pincode is required')
      .matches(/^[0-9]{6}$/, 'Pincode must be 6 digits'),

    // Bank fields (initially optional, handled in test below)
    bankName: Yup.string().nullable(),
    accountNo: Yup.string()
      .nullable()
      .matches(/^[0-9]{9,18}$/, 'Account number must be 9–18 digits'),
    holderName: Yup.string().nullable(),
    ifsc: Yup.string()
      .nullable()
      .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code'),
    branch: Yup.string().nullable(),

    upiId: Yup.string()
      .matches(/^\w+@\w+$/, 'Invalid UPI ID')
      .nullable(),

    invoicePrefix: Yup.string()
      .trim()
      .required('Invoice prefix is required')
      .test(
        'valid-chars',
        'Prefix can only contain uppercase letters, /, or -',
        value => /^[A-Z/-]+$/.test(value || ''),
      )
      .test(
        'length',
        'Prefix must be 2–6 characters long. e.g- INV, A2Z, CAFE24',
        value => (value ? value.length >= 2 && value.length <= 6 : false),
      )
      .uppercase(),

    invoiceStartNumber: Yup.string()
      .matches(/^[0-9]+$/, 'Must be a number')
      .nullable(),

    userName: Yup.string().required('User Name is required'),
    userEmail: Yup.string().email('Invalid email'),
    userPhone: Yup.string().matches(/^[0-9]{10}$/, 'Must be 10 digits'),

    // logo and signature optional
    logo: Yup.mixed().nullable(),
    signature: Yup.mixed().nullable(),
  })
  .test(
    'bank-fields-required',
    'If any bank detail is filled, all fields are required',
    function (values) {
      if (!values) return true;

      const { bankName, accountNo, holderName, ifsc, branch } = values;

      const anyFilled = [bankName, accountNo, holderName, ifsc, branch].some(
        v => v && v.trim() !== '',
      );

      if (!anyFilled) return true; // ✅ all empty → pass

      // ❌ if something is missing
      const missing = [];
      if (!bankName) missing.push('Bank Name');
      if (!accountNo) missing.push('Account Number');
      if (!holderName) missing.push('Account Holder Name');
      if (!ifsc) missing.push('IFSC Code');
      if (!branch) missing.push('Branch');

      return missing.length === 0
        ? true
        : this.createError({
            path: 'bankName',
            message: `${missing.join(', ')} required`,
          });
    },
  );

const Profile = ({ navigation }) => {
  const theme = useTheme();
  const { authState, updateAuthState, hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(true);
  const stateSheetRef = useRef(null);
  const businessTypeSheetRef = useRef(null);
  const imagePickerSheetRef = useRef(null);
  const [updating, setUpdating] = useState(false);

  // replace previous formData state
  const [initialValues, setInitialValues] = useState(null);
  const formikRef = useRef(null);

  const richTextRef = useRef(null);
  const insets = useSafeAreaInsets();

  // Track original data from API
  const [originalData, setOriginalData] = useState({});

  // Track which upload type is active (logo or signature)
  const [activeUploadType, setActiveUploadType] = useState(null);

  // Signature modal states
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  // Selected state object
  const [selectedStateObj, setSelectedStateObj] = useState(null);

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    actions: [],
  });

  const ownershipType = [
    'Sole Proprietorship',
    'Partnership',
    'Private Limited Company',
    'LLP',
    'Public Limited Company',
    'OPC',
    'Others',
  ];

  const showAlert = ({ title, message, type = 'info', actions = [] }) => {
    setAlertConfig({ visible: true, title, message, type, actions });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/auth/me');
      // console.log('Profile Data Response:', response);
      if (response.success && response.data) {
        const { data } = response;
        const store = data.store || {};
        const address = store.address || {};
        const bankDetails = store.bankDetails || {};
        const settings = store.settings || {};

        // Map API response to form fields
        const mappedData = {
          // Basic Details
          businessName: store.name || '',
          gstin: store.gstNumber || '',
          phoneNumber: store.contactNo || '',
          emailId: store.email || '',
          businessAddress: `${address.street || ''} ${address.city || ''} ${
            address.state || ''
          }`.trim(),
          pincode: address.postalCode || '',
          businessDescription: store.tagline || '',

          // Additional basic fields
          businessTagline: store.tagline || '',
          registrationNo: store.registrationNo || '',

          // Address details
          street: address.street || '',
          city: address.city || '',
          state: address.state || '',
          country: address.country || '',

          // Business Details
          ownershipType: store.ownershipType || '',
          businessType: store.type || '',
          businessCategory: '',

          // Bank Details
          bankName: bankDetails.bankName || '',
          accountNo: bankDetails.accountNo || '',
          holderName: bankDetails.holderName || '',
          ifsc: bankDetails.ifsc || '',
          branch: bankDetails.branch || '',
          upiId: bankDetails.upiId || '',

          // Invoice Settings
          invoicePrefix: settings.invoicePrefix || '',
          invoiceTerms: settings.invoiceTerms || '',
          invoiceStartNumber: settings.invoiceStartNumber?.toString() || '',

          // User Details
          userName: data.name || '',
          userEmail: data.email || '',
          userPhone: data.phone || '',
        };

        // after building mappedData:
        setInitialValues(mappedData);

        // set originalData including original file objects (keep this to compare later)
        setOriginalData({
          ...mappedData,
          logo: store.logoUrl
            ? {
                uri: store.logoUrl,
                fileName: 'business_logo.jpg',
                isOriginal: true,
              }
            : null,
          signature: store.signatureUrl
            ? {
                uri: store.signatureUrl,
                type: 'upload',
                fileName: 'business_signature.jpg',
                isOriginal: true,
              }
            : null,
        });

        // also set initialValues to include logo/signature if present
        setInitialValues(prev => ({
          ...mappedData,
          logo: store.logoUrl
            ? {
                uri: store.logoUrl,
                fileName: 'business_logo.jpg',
                isOriginal: true,
              }
            : null,
          signature: store.signatureUrl
            ? {
                uri: store.signatureUrl,
                type: 'upload',
                fileName: 'business_signature.jpg',
                isOriginal: true,
              }
            : null,
        }));

        // Set selected state object for state selector
        if (address.state) {
          setSelectedStateObj({ name: address.state });
        }
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to load profile data',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to get only changed fields using Formik values
  const getChangedFields = values => {
    const changes = {};

    // Field mappings - API field name: form field name
    const fieldMappings = {
      tagline: 'businessTagline',
      gstNumber: 'gstin',
      registrationNo: 'registrationNo',
      contactNo: 'phoneNumber',
      email: 'emailId',
      'address[street]': 'street',
      'address[city]': 'city',
      'address[state]': 'state',
      'address[postalCode]': 'pincode',
      'bankDetails[bankName]': 'bankName',
      'bankDetails[accountNo]': 'accountNo',
      'bankDetails[holderName]': 'holderName',
      'bankDetails[ifsc]': 'ifsc',
      'bankDetails[branch]': 'branch',
      'bankDetails[upiId]': 'upiId',
      'settings[invoiceTerms]': 'invoiceTerms',
      ownershipType: 'ownershipType', // ✅ Yeh line add karo
    };

    // Check each field for changes
    Object.entries(fieldMappings).forEach(([apiField, formField]) => {
      const currentValue = values[formField] || '';
      const originalValue = originalData[formField] || '';

      if (currentValue !== originalValue) {
        changes[apiField] = currentValue;
      }
    });

    return changes;
  };

  const handleSave = async values => {
    try {
      // console.log('Form values on save:', values);
      setLoading(true);

      // Get only changed fields using Formik values
      const changedFields = getChangedFields(values);

      // Check for file changes
      const logoChanged = values.logo && !values.logo.isOriginal;
      const signatureChanged = values.signature && !values.signature.isOriginal;

      // If no changes detected, show message
      if (
        Object.keys(changedFields).length === 0 &&
        !logoChanged &&
        !signatureChanged
      ) {
        showAlert({
          title: 'No Changes',
          message: 'No changes detected to save.',
          type: 'info',
        });
        setLoading(false);
        return;
      }

      const formDataToSend = new FormData();

      // Add only changed text fields
      Object.entries(changedFields).forEach(([fieldName, value]) => {
        formDataToSend.append(fieldName, value);
      });

      // Add files only if they're new/changed
      if (logoChanged && values.logo) {
        formDataToSend.append('logo', {
          uri: values.logo.uri,
          type: values.logo.type || 'image/jpeg',
          name: values.logo.fileName || 'logo.jpg',
        });
      }

      if (signatureChanged && values.signature) {
        formDataToSend.append('signature', {
          uri: values.signature.uri,
          type: values.signature.type || 'image/png',
          name: values.signature.fileName || 'signature.png',
        });
      }

      const response = await api.put('/store/update-my-store', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.success) {
        Toast.show({ type: 'success', text1: 'Profile updated successfully' });

        const refreshed = await api.get('/auth/me');
        if (refreshed.success && refreshed.data) {
          const newAuth = {
            ...authState,
            user: refreshed.data,
          };
          await updateAuthState(newAuth);
        }

        fetchProfileData();

        // Update original data to current form values after successful save
        setOriginalData({ ...values });

        // Mark files as original after successful save
        if (values.logo) {
          formikRef.current?.setFieldValue('logo', {
            ...values.logo,
            isOriginal: true,
          });
        }
        if (values.signature) {
          formikRef.current?.setFieldValue('signature', {
            ...values.signature,
            isOriginal: true,
          });
        }
      } else {
        showAlert({
          title: 'Error',
          message: response.message || 'Failed to update profile',
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Save profile error:', error);
      showAlert({
        title: 'Error',
        message: 'Something went wrong try again later',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStateSelect = state => {
    setSelectedStateObj(state);
    formikRef.current?.setFieldValue('state', state.name);
    stateSheetRef.current?.close();
  };

  // const openBusinessTypeSelector = () => {
  // if (businessTypeSheetRef.current) {
  // businessTypeSheetRef.current.expand();
  // }
  // };

  const openStateSelector = () => {
    stateSheetRef.current?.expand();
  };

  const handleCancel = () => {
    showAlert({
      title: 'Cancel',
      message: 'Are you sure you want to cancel? All changes will be lost.',
      type: 'warning',
      actions: [
        { label: 'No', mode: 'outlined', onPress: hideAlert },
        {
          label: 'Yes',
          mode: 'contained',
          color: 'red',
          onPress: () => {
            hideAlert();
            navigation?.goBack();
          },
        },
      ],
    });
  };

  // Handle image picker selection
  const handleImagePickerSelect = async option => {
    imagePickerSheetRef.current?.close();
    if (option.id === 'signature-pad') {
      setShowSignaturePad(true);
      return;
    }

    try {
      const isLogo = activeUploadType === 'logo';
      const cropOptions = {
        cropping: true,
        width: isLogo ? 800 : 1000,
        height: isLogo ? 800 : 400,
        compressImageQuality: 0.9,
        forceJpg: true,
        mediaType: 'photo',
      };

      const hasPermission =
        option.id === 'camera'
          ? await ensureCameraPermission()
          : await ensurePhotoPermission();
      if (!hasPermission) return;

      // 🟢 Android 14+ → use system Photo Picker automatically
      let res;
      if (option.id === 'camera') {
        res = await launchCamera({ mediaType: 'photo', quality: 0.9 });
      } else {
        res = await ImagePicker.launchImageLibrary({
          mediaType: 'photo',
          quality: 0.9,
          selectionLimit: 1,
          includeBase64: false,
          presentationStyle: 'fullScreen', // iOS fix
        });
      }

      if (!res || res.didCancel) return;
      if (res.errorCode) throw new Error(res.errorMessage || res.errorCode);

      const asset = res.assets?.[0];
      if (!asset?.uri) throw new Error('No image selected');

      const cropped = await ImageCropPicker.openCropper({
        path: asset.uri,
        ...cropOptions,
      });

      const fileObj = {
        uri: cropped.path,
        type: 'image/jpeg',
        fileName: `${activeUploadType}_${Date.now()}.jpg`,
        isOriginal: false,
      };
      formikRef.current?.setFieldValue(activeUploadType, fileObj);
    } catch (error) {
      console.error('Image picker error:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to process image.',
        type: 'error',
      });
    } finally {
      setActiveUploadType(null);
    }
  };
  // Handle logo upload with bottom sheet
  const handleLogoUpload = () => {
    setActiveUploadType('logo');
    imagePickerSheetRef.current?.expand();
  };

  // Get options based on upload type
  const getPickerOptions = () => {
    if (activeUploadType === 'signature') {
      return [
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
          label: 'Draw Signature',
          description: 'Use your finger to draw',
          icon: 'draw',
        },
      ];
    }
    return [
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
  };

  // Show signature options using bottom sheet
  const handleSignatureAction = () => {
    setActiveUploadType('signature');
    imagePickerSheetRef.current?.expand();
  };

  // Handle signature from signature pad
  const handleSignatureComplete = signatureData => {
    if (signatureData?.uri) {
      formikRef.current?.setFieldValue('signature', {
        uri: signatureData.uri,
        type: signatureData.type || 'image/png',
        fileName: signatureData.fileName || `signature_${Date.now()}.png`,
        isOriginal: false,
      });
    }
    setShowSignaturePad(false);
  };

  // Remove signature
  const removeSignature = () => {
    showAlert({
      title: 'Remove Signature',
      message: 'Are you sure you want to remove the signature?',
      type: 'warning',
      actions: [
        { label: 'Cancel', mode: 'outlined', onPress: hideAlert },
        {
          label: 'Remove',
          mode: 'contained',
          color: 'red',
          onPress: () => {
            hideAlert();
            formikRef.current?.setFieldValue('signature', null);
          },
        },
      ],
    });
  };

  const renderBasicDetails = ({
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    setFieldValue,
  }) => (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Basic Details</Text>
        {/* <Text style={styles.sectionDescription}>Basic Business Details</Text> */}
      </View>

      {/* Business Name */}
      <TextInput
        label="Business Name *"
        value={values.businessName}
        onChangeText={handleChange('businessName')}
        onBlur={handleBlur('businessName')}
        error={touched.businessName && !!errors.businessName}
        mode="outlined"
        editable={false}
        style={styles.input}
        left={<TextInput.Icon icon="store" />}
        theme={{
          roundness: 12,
          colors: {
            background: theme.colors.surface,
          },
        }}
      />
      {touched.businessName && errors.businessName && (
        <Text style={styles.errorText}>{errors.businessName}</Text>
      )}

      {/* Business Type */}
      <TouchableOpacity activeOpacity={1}>
        <TextInput
          label="Business Type *"
          value={values.businessType}
          mode="outlined"
          style={styles.input}
          editable={false}
          left={<TextInput.Icon icon="domain" />}
          right={<TextInput.Icon icon="chevron-down" />}
          pointerEvents="none"
          theme={{
            roundness: 12,
            colors: {
              background: theme.colors.surface,
            },
          }}
        />
      </TouchableOpacity>
      {touched.businessType && errors.businessType && (
        <Text style={styles.errorText}>{errors.businessType}</Text>
      )}

      {/* Phone Number */}
      <TextInput
        label="Phone Number"
        value={values.phoneNumber}
        onChangeText={handleChange('phoneNumber')}
        onBlur={handleBlur('phoneNumber')}
        error={touched.phoneNumber && !!errors.phoneNumber}
        mode="outlined"
        style={styles.input}
        maxLength={10}
        keyboardType="phone-pad"
        left={<TextInput.Icon icon="phone" />}
        // placeholder="+91 9876543210"
        theme={{ roundness: 12 }}
      />
      {touched.phoneNumber && errors.phoneNumber && (
        <Text style={styles.errorText}>{errors.phoneNumber}</Text>
      )}

      {/* Email ID */}
      <TextInput
        label="Email ID"
        value={values.emailId}
        onChangeText={handleChange('emailId')}
        onBlur={handleBlur('emailId')}
        error={touched.emailId && !!errors.emailId}
        mode="outlined"
        style={styles.input}
        keyboardType="email-address"
        left={<TextInput.Icon icon="email" />}
        // placeholder="business@example.com"
        theme={{ roundness: 12 }}
      />
      {touched.emailId && errors.emailId && (
        <Text style={styles.errorText}>{errors.emailId}</Text>
      )}

      {/* GSTIN */}
      {/* GSTIN */}
      <TextInput
        label="GSTIN"
        value={values.gstin}
        onChangeText={handleChange('gstin')}
        onBlur={handleBlur('gstin')}
        error={touched.gstin && !!errors.gstin}
        mode="outlined"
        style={styles.input}
        editable={!originalData.gstin} // ✅ editable only if GST was empty
        left={<TextInput.Icon icon="file-document-outline" />}
        // placeholder="22AAAAA0000A1Z5"
        theme={{
          roundness: 12,
          colors: {
            background: theme.colors.surface,
          },
        }}
      />
      {touched.gstin && errors.gstin && (
        <Text style={styles.errorText}>{errors.gstin}</Text>
      )}

      {/* Registration Number */}
      <TextInput
        label="Registration Number"
        value={values.registrationNo}
        onChangeText={handleChange('registrationNo')}
        onBlur={handleBlur('registrationNo')}
        error={touched.registrationNo && !!errors.registrationNo}
        mode="outlined"
        editable={!originalData.registrationNo} // editable only if empty
        style={styles.input}
        left={<TextInput.Icon icon="certificate-outline" />}
        // placeholder="Business registration number"
        theme={{
          roundness: 12,
          colors: {
            background: theme.colors.surface,
          },
        }}
      />
      {touched.registrationNo && errors.registrationNo && (
        <Text style={styles.errorText}>{errors.registrationNo}</Text>
      )}

      {/* Registeration Type with Icon */}
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

      {/* Business Tagline */}
      <TextInput
        label="Business Tagline"
        value={values.businessTagline}
        onChangeText={handleChange('businessTagline')}
        onBlur={handleBlur('businessTagline')}
        error={touched.businessTagline && !!errors.businessTagline}
        mode="outlined"
        style={styles.input}
        left={<TextInput.Icon icon="format-quote-close" />}
        // placeholder="Your business tagline"
        theme={{ roundness: 12 }}
      />
      {touched.businessTagline && errors.businessTagline && (
        <Text style={styles.errorText}>{errors.businessTagline}</Text>
      )}

      {/* Address Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Business Address</Text>
        {/* <Text style={styles.sectionDescription}>Business Address Details</Text> */}
      </View>

      {/* Street */}
      <TextInput
        label="Street Address *"
        value={values.street}
        onChangeText={handleChange('street')}
        onBlur={handleBlur('street')}
        error={touched.street && !!errors.street}
        mode="outlined"
        style={styles.input}
        left={<TextInput.Icon icon="road" />}
        // placeholder="Street address"
        theme={{ roundness: 12 }}
      />
      {touched.street && errors.street && (
        <Text style={styles.errorText}>{errors.street}</Text>
      )}

      {/* City */}
      <TextInput
        label="City *"
        value={values.city}
        onChangeText={handleChange('city')}
        onBlur={handleBlur('city')}
        error={touched.city && !!errors.city}
        mode="outlined"
        style={styles.input}
        left={<TextInput.Icon icon="city" />}
        // placeholder="City"
        maxLength={20}
        theme={{ roundness: 12 }}
      />
      {touched.city && errors.city && (
        <Text style={styles.errorText}>{errors.city}</Text>
      )}

      <TouchableOpacity onPress={openStateSelector} activeOpacity={0.7}>
        <TextInput
          label="State *"
          value={values.state}
          mode="outlined"
          style={styles.input}
          left={<TextInput.Icon icon="map" />}
          // placeholder="Select state"
          right={<TextInput.Icon icon="chevron-down" />}
          editable={false}
          pointerEvents="none"
          maxLength={20}
          theme={{ roundness: 12 }}
        />
      </TouchableOpacity>

      {/* Pincode */}
      <TextInput
        label="Pincode *"
        value={values.pincode}
        onChangeText={handleChange('pincode')}
        onBlur={handleBlur('pincode')}
        error={touched.pincode && !!errors.pincode}
        mode="outlined"
        style={styles.input}
        keyboardType="numeric"
        maxLength={6}
        left={<TextInput.Icon icon="map-marker-radius" />}
        // placeholder="400001"
        theme={{ roundness: 12 }}
      />
      {touched.pincode && errors.pincode && (
        <Text style={styles.errorText}>{errors.pincode}</Text>
      )}
    </View>
  );

  const renderBusinessDetails = ({
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    setFieldValue,
  }) => (
    <View style={styles.tabContent}>
      {/* Bank Details Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Bank Details</Text>
        <Text style={styles.sectionDescription}>
          Payment and banking information
        </Text>
      </View>

      {/* Bank Name */}
      <TextInput
        label="Bank Name"
        value={values.bankName}
        onChangeText={handleChange('bankName')}
        onBlur={handleBlur('bankName')}
        error={touched.bankName && !!errors.bankName}
        mode="outlined"
        style={styles.input}
        left={<TextInput.Icon icon="bank" />}
        // placeholder="Bank name"
        theme={{ roundness: 12 }}
      />
      {touched.bankName && errors.bankName && (
        <Text style={styles.errorText}>{errors.bankName}</Text>
      )}

      {/* Account Number */}
      <TextInput
        label="Account Number"
        value={values.accountNo}
        onChangeText={handleChange('accountNo')}
        onBlur={handleBlur('accountNo')}
        error={touched.accountNo && !!errors.accountNo}
        mode="outlined"
        style={styles.input}
        keyboardType="numeric"
        left={<TextInput.Icon icon="credit-card-outline" />}
        // placeholder="Account number"
        theme={{ roundness: 12 }}
      />
      {touched.accountNo && errors.accountNo && (
        <Text style={styles.errorText}>{errors.accountNo}</Text>
      )}

      {/* Account Holder Name */}
      <TextInput
        label="Account Holder Name"
        value={values.holderName}
        onChangeText={handleChange('holderName')}
        onBlur={handleBlur('holderName')}
        error={touched.holderName && !!errors.holderName}
        mode="outlined"
        style={styles.input}
        maxLength={25}
        left={<TextInput.Icon icon="account" />}
        // placeholder="Account holder name"
        theme={{ roundness: 12 }}
      />
      {touched.holderName && errors.holderName && (
        <Text style={styles.errorText}>{errors.holderName}</Text>
      )}

      {/* IFSC Code */}
      <TextInput
        label="IFSC Code"
        value={values.ifsc}
        onChangeText={handleChange('ifsc')}
        onBlur={handleBlur('ifsc')}
        error={touched.ifsc && !!errors.ifsc}
        mode="outlined"
        maxLength={20}
        style={styles.input}
        left={<TextInput.Icon icon="bank-transfer" />}
        // placeholder="IFSC code"
        theme={{ roundness: 12 }}
      />
      {touched.ifsc && errors.ifsc && (
        <Text style={styles.errorText}>{errors.ifsc}</Text>
      )}

      {/* Branch */}
      <TextInput
        label="Branch"
        value={values.branch}
        onChangeText={handleChange('branch')}
        onBlur={handleBlur('branch')}
        error={touched.branch && !!errors.branch}
        mode="outlined"
        maxLength={20}
        style={styles.input}
        left={<TextInput.Icon icon="source-branch" />}
        // placeholder="Branch name"
        theme={{ roundness: 12 }}
      />
      {touched.branch && errors.branch && (
        <Text style={styles.errorText}>{errors.branch}</Text>
      )}

      {/* UPI ID */}
      <TextInput
        label="UPI ID"
        value={values.upiId}
        onChangeText={handleChange('upiId')}
        onBlur={handleBlur('upiId')}
        error={touched.upiId && !!errors.upiId}
        mode="outlined"
        maxLength={20}
        style={styles.input}
        left={<TextInput.Icon icon="qrcode" />}
        // placeholder="UPI ID"
        theme={{ roundness: 12 }}
      />
      {touched.upiId && errors.upiId && (
        <Text style={styles.errorText}>{errors.upiId}</Text>
      )}

      {/* Invoice Settings Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Invoice Settings</Text>
        <Text style={styles.sectionDescription}>
          Configure invoice preferences
        </Text>
      </View>

      {/* Invoice Prefix */}
      <TextInput
        label="Invoice Prefix *"
        value={values.invoicePrefix}
        onChangeText={handleChange('invoicePrefix')}
        onBlur={handleBlur('invoicePrefix')}
        error={touched.invoicePrefix && !!errors.invoicePrefix}
        mode="outlined"
        maxLength={8}
        style={[styles.input, { textTransform: 'uppercase' }]}
        left={<TextInput.Icon icon="file-document" />}
        placeholder="Enter prefix (e.g. INV, A2Z, CAFE24)"
        theme={{ roundness: 12 }}
      />
      {touched.invoicePrefix && errors.invoicePrefix && (
        <Text style={styles.errorText}>{errors.invoicePrefix}</Text>
      )}

      {/* Invoice Terms */}
      <Text style={styles.fieldLabel}>Invoice Terms & Conditions</Text>
      <RichEditor
        ref={richTextRef}
        initialContentHTML={values.invoiceTerms} // Formik value
        placeholder="Enter invoice terms and conditions"
        onChange={html => {
          // yaha pe tum Formik ka setFieldValue use kar sakte ho
          setFieldValue('invoiceTerms', html);
        }}
        editorStyle={{
          backgroundColor: theme.colors.background,
          padding: 10,
          color: theme.colors.onBackground,
          placeholderColor: theme.colors.disabled,
        }}
        style={styles.richeditor}
      />

      {/* Toolbar for Bold / Italic / etc */}
      <RichToolbar
        editor={richTextRef}
        actions={[
          actions.setBold,
          actions.setItalic,
          actions.setUnderline,
          actions.insertBulletsList,
          actions.insertOrderedList,
          actions.undo,
          actions.redo,
        ]}
        style={[styles.toolbar, { backgroundColor: theme.colors.background }]} // Optional stylingstyles.toolbar}
      />

      {/* Business Logo */}
      <View style={styles.uploadSection}>
        <Text style={styles.sectionTitle}>Business Logo</Text>
        <Text style={styles.sectionDescription}>
          Upload your business logo for invoices
        </Text>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handleLogoUpload}
        >
          {values.logo ? (
            <View style={styles.uploadedImageContainer}>
              <Image
                source={{ uri: values.logo.uri }}
                style={styles.uploadedSignature}
                resizeMode="contain"
              />
              {values.logo.uri && !values.logo.uri.includes('http') && (
                <IconButton
                  icon="close-circle"
                  size={24}
                  onPress={() => setFieldValue('logo', null)}
                  style={styles.removeButton}
                  iconColor="white"
                  containerColor="#e74c3c"
                />
              )}
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Icon source="upload" size={40} color={theme.colors.primary} />
              <Text style={styles.uploadText}>Tap to upload logo</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Digital Signature */}
      <View style={styles.uploadSection}>
        <Text style={styles.sectionTitle}>Digital Signature</Text>
        <Text style={styles.sectionDescription}>
          Upload your signature for invoices
        </Text>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handleSignatureAction}
        >
          {values.signature ? (
            <View style={styles.uploadedImageContainer}>
              <Image
                source={{ uri: values.signature.uri }}
                style={styles.uploadedSignature}
                resizeMode="contain"
              />
              <View style={styles.signatureTypeIndicator}>
                <Icon
                  source={values.signature.type === 'drawn' ? 'draw' : 'image'}
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.signatureTypeText}>
                  {values.signature.type === 'drawn' ? 'Drawn' : 'Uploaded'}
                </Text>
              </View>
              {values.signature.uri &&
                !values.signature.uri.includes('http') && (
                  <IconButton
                    icon="close-circle"
                    size={24}
                    onPress={() => setFieldValue('signature', null)}
                    style={styles.removeButton}
                    iconColor="white"
                    containerColor="#e74c3c"
                  />
                )}
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Icon source="draw" size={40} color={theme.colors.primary} />
              <Text style={styles.uploadText}>Tap to add signature</Text>
              <Text style={styles.uploadSubText}>
                Draw or upload from gallery
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // Loading screen
  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Navbar title="Business Profile" help="Business" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Formik
        innerRef={formikRef}
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={values => {
          // console.log('Formik submit triggered with values:', values);
          return handleSave(values); // return the promise so Formik awaits and resets isSubmitting
        }} // handleSave will now receive form values
        enableReinitialize
      >
        {({
          handleChange,
          handleBlur,
          handleSubmit,
          setFieldValue,
          values,
          errors,
          touched,
          isSubmitting,
        }) => (
          <>
            {/* Header */}
            <Navbar title="Business Profile" help="Business" />

            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
              <SegmentedButtons
                value={activeTab}
                onValueChange={setActiveTab}
                buttons={[
                  {
                    value: 'basic',
                    label: 'Business Details',
                    icon: props => (
                      <Icon
                        source="account-details" // 👈 name from MaterialCommunityIcons
                        size={props.size}
                        color={
                          activeTab === 'basic'
                            ? theme.colors.onPrimaryContainer
                            : theme.colors.onSurfaceVariant
                        }
                      />
                    ),
                    style: {
                      backgroundColor:
                        activeTab === 'basic'
                          ? theme.colors.primaryContainer
                          : theme.colors.surfaceVariant,
                    },
                    labelStyle: {
                      color:
                        activeTab === 'basic'
                          ? theme.colors.onPrimaryContainer
                          : theme.colors.onSurfaceVariant,
                      fontWeight: activeTab === 'basic' ? '600' : '400',
                    },
                  },
                  {
                    value: 'business',
                    label: 'Bank and Invoice',
                    icon: props => (
                      <Icon
                        source="briefcase"
                        size={props.size}
                        color={
                          activeTab === 'business'
                            ? theme.colors.onPrimaryContainer
                            : theme.colors.onSurfaceVariant
                        }
                      />
                    ),
                    style: {
                      backgroundColor:
                        activeTab === 'business'
                          ? theme.colors.primaryContainer
                          : theme.colors.surfaceVariant,
                    },
                    labelStyle: {
                      color:
                        activeTab === 'business'
                          ? theme.colors.onPrimaryContainer
                          : theme.colors.onSurfaceVariant,
                      fontWeight: activeTab === 'business' ? '600' : '400',
                    },
                  },
                ]}
              />
            </View>

            {/* Content */}
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={'padding'}>
              <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Surface style={styles.contentContainer} elevation={1}>
                  {activeTab === 'basic'
                    ? renderBasicDetails({
                        values,
                        errors,
                        touched,
                        handleChange,
                        handleBlur,
                        setFieldValue,
                      })
                    : renderBusinessDetails({
                        values,
                        errors,
                        touched,
                        handleChange,
                        handleBlur,
                        setFieldValue,
                      })}
                </Surface>
                {/* Bottom spacing for buttons */}
                <View style={styles.bottomSpacing} />
              </ScrollView>
            </KeyboardAvoidingView>

            {/* Bottom Buttons */}
            <View
              style={[
                styles.buttonContainer,
                {
                  backgroundColor: theme.colors.background,
                  elevation: 3,
                  paddingBottom: insets.bottom,
                },
              ]}
            >
              <Divider />
              <View style={styles.buttonRow}>
                <Button
                  mode="outlined"
                  onPress={handleCancel}
                  style={[styles.button, styles.cancelButton]}
                  labelStyle={styles.cancelButtonText}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  disabled={
                    !hasPermission(permissions.CAN_MANAGE_STORE) ||
                    isSubmitting ||
                    updating
                  }
                  style={[styles.button, styles.saveButton]}
                  labelStyle={[
                    {
                      color:
                        !hasPermission(permissions.CAN_MANAGE_STORE) ||
                        isSubmitting ||
                        updating
                          ? theme.colors.onBackground
                          : theme.colors.onSurface,
                    },
                  ]}
                  icon={
                    updating
                      ? () => (
                          <ActivityIndicator
                            animating={true}
                            size={18}
                            color="white"
                          />
                        )
                      : 'content-save'
                  }
                >
                  {isSubmitting || updating ? 'Saving...' : 'Save Profile'}
                </Button>
              </View>
            </View>

            {/* State Selector Bottom Sheet */}
            <StateSelectorBottomSheet
              ref={stateSheetRef}
              onStateSelect={handleStateSelect}
              selectedState={selectedStateObj}
              title="Select State"
              // placeholder="Search states..."
              showSearch={true}
              showRegionFilter={true}
              showCapital={true}
              snapPoints={['50%', '80%']}
              enablePanDownToClose={true}
              enableDynamicSizing={false}
            />

            {/* Image Picker Bottom Sheet */}
            <ImagePickerBottomSheet
              ref={imagePickerSheetRef}
              title={
                activeUploadType === 'logo' ? 'Upload Logo' : 'Add Signature'
              }
              subtitle={
                activeUploadType === 'logo'
                  ? 'Choose how to upload your business logo'
                  : 'Choose how to add your signature'
              }
              onSelect={handleImagePickerSelect}
              options={getPickerOptions()}
              snapPoints={activeUploadType === 'signature' ? ['65%'] : ['45%']}
              initialSnapIndex={-1}
              enablePanDownToClose={true}
            />

            {/* <BusinessTypeSelectorBottomSheet
 ref={businessTypeSheetRef}
 onBusinessTypeSelect={type => {
 formikRef.current?.setFieldValue('businessType', type.name);
 businessTypeSheetRef.current?.close();
 }
 }
 /> */}

            {/* Signature Pad Modal */}
            <SignaturePadModal
              visible={showSignaturePad}
              title="Draw your signature"
              onDone={handleSignatureComplete}
              onCancel={() => setShowSignaturePad(false)}
            />
            <CustomAlert
              visible={alertConfig.visible}
              onDismiss={hideAlert}
              title={alertConfig.title}
              message={alertConfig.message}
              type={alertConfig.type}
              actions={alertConfig.actions}
            />
          </>
        )}
      </Formik>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  header: {
    paddingVertical: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontWeight: '600',
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  segmentedButtons: {
    marginHorizontal: 0,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    margin: 16,
    borderRadius: 12,
  },
  tabContent: {
    padding: 20,
  },
  input: {
    marginBottom: 8,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 16,
  },
  uploadSection: {
    marginBottom: '32%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 12,
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
    fontWeight: '500',
  },
  uploadSubText: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.6,
  },
  uploadedImageContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  uploadedSignature: {
    width: 150,
    height: 75,
    borderRadius: 8,
  },
  signatureTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 12,
  },
  signatureTypeText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '500',
    color: '#2196F3',
  },
  removeButton: {
    position: 'absolute',
    top: -15,
    right: -15,
  },
  infoCard: {
    marginTop: 16,
    backgroundColor: 'rgba(33, 150, 243, 0.05)',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontWeight: '600',
    color: '#2196F3',
    marginLeft: 4,
  },
  infoText: {
    lineHeight: 20,
    opacity: 0.8,
  },
  bottomSpacing: {
    height: 100,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 4,
  },
  cancelButton: {
    borderColor: '#757575',
  },
  cancelButtonText: {
    color: '#757575',
  },
  saveButton: {
    elevation: 2,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 4,
    marginLeft: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  chipLabel: {
    fontSize: 12,
    marginBottom: 8,
    color: 'rgba(0, 0, 0, 0.54)',
  },
  chipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    margin: 4,
  },
  chipText: {
    fontSize: 12,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 24,
  },
  optionsList: {
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  optionTitle: {
    fontWeight: '500',
    marginBottom: 2,
  },
  optionDescription: {
    opacity: 0.7,
  },
  optionDivider: {
    marginVertical: 4,
  },
  modalCancelButton: {
    marginTop: 8,
  },
  errorText: {
    color: 'red',
    marginBottom: 8,
  },
  toolbar: {
    marginBottom: 16,
    borderRadius: 12,
    borderTopStartRadius: 0,
    borderTopEndRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
  },
  richeditor: {
    marginTop: 8,
    minHeight: 150,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
  },
  richeditorContainer: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    borderRadius: 12,
    marginBottom: 8,
  },
});

export default Profile;
