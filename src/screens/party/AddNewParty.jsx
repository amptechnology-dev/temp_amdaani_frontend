import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  BackHandler,
  TouchableOpacity,
} from 'react-native';
import { TextInput, Button, useTheme, Text } from 'react-native-paper';
import { Formik } from 'formik';
import * as Yup from 'yup';
import Navbar from '../../components/Navbar';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../utils/api';
import Toast from 'react-native-toast-message';
import CustomAlert from '../../components/CustomAlert';
import { useEffect, useRef, useState } from 'react';
import { extractErrorMessage } from '../../utils/errorHandler';
import StateSelectorBottomSheet from '../../components/BottomSheet/SelectStateBottomSheet';

const isFormChanged = (initial, current) => {
  const keys = Object.keys(initial);
  return keys.some(key => (initial[key] || '') !== (current[key] || ''));
};

// ✅ Industry-standard validation schema for AddNewParty form
const validationSchema = Yup.object().shape({
  // 🧾 Customer / Party Name
  partyName: Yup.string()
    .trim()
    .matches(
      /^[A-Za-z0-9\s.'-]+$/,
      'Customer name can only contain letters, numbers, spaces, and basic punctuation',
    )
    .min(2, 'Customer name must be at least 2 characters')
    .max(50, 'Customer name must be less than 50 characters'),

  // ☎️ Contact Number
  contactNumber: Yup.string()
    .trim()
    .matches(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
    .required('Contact number is required'),

  // 🏠 Address
  address: Yup.string()
    .trim()
    .min(5, 'Address must be at least 5 characters')
    .max(100, 'Address can be up to 100 characters only')
    .matches(
      /^[a-zA-Z0-9\s,./#'()-]+$/,
      'Address may only include letters, numbers, spaces, and basic symbols',
    ),

  // 🏙 City
  city: Yup.string()
    .trim()
    .min(2, 'City name must be at least 2 characters')
    .max(40, 'City name can be up to 40 characters')
    .matches(/^[A-Za-z\s'.-]+$/, 'City name can only contain alphabets'),

  // 🗺 State
  state: Yup.string()
    .trim()
    .min(2, 'State name must be at least 2 characters')
    .max(40, 'State name can be up to 40 characters')
    .matches(/^[A-Za-z\s'.-]+$/, 'State name can only contain alphabets'),

  // 📮 Postal Code (Pincode)
  postalCode: Yup.string()
    .trim()
    .matches(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit Indian pincode'),

  // 🧾 GSTIN (Optional but strictly validated if entered)
  gstin: Yup.string()
    .trim()
    .nullable()
    .uppercase()
    .max(15, 'GSTIN must be exactly 15 characters')
    .test(
      'valid-format',
      'Invalid GSTIN format (e.g. 22AAAAA0000A1Z5)',
      value =>
        !value ||
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value),
    )
    .test(
      'exact-length',
      'GSTIN must be exactly 15 characters long',
      value => !value || value.length === 15,
    )
    .test('valid-checksum', 'Invalid GSTIN checksum', value => {
      if (!value || value.length !== 15) return true; // Skip if empty or wrong length

      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let factor = 1;
      let sum = 0;

      for (let i = 0; i < 14; i++) {
        const codePoint = chars.indexOf(value[i]);
        if (codePoint === -1) return false;

        const product = factor * codePoint;
        // alternate factor between 1 and 2
        factor = factor === 1 ? 2 : 1;
        sum += Math.floor(product / 36) + (product % 36);
      }

      const checkCodePoint = (36 - (sum % 36)) % 36;
      const expectedChecksum = chars[checkCodePoint];
      return value[14] === expectedChecksum;
    }),

});


const AddNewParty = ({ navigation, route }) => {
  const theme = useTheme();

  // 🟢 If details passed from PartyList
  const existingParty = route?.params?.party || null;
  const isUpdate = !!existingParty;
  // console.log('Existing party data:', existingParty);

  const initialValues = {
    partyName: existingParty?.name || '',
    contactNumber: existingParty?.mobile || '',
    address: existingParty?.address || '',
    city: existingParty?.city || '',
    state: existingParty?.state || '',
    postalCode: existingParty?.postalCode || '',
    gstin: existingParty?.gstNumber || '',
  };

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    actions: [],
  });
  const [formDirty, setFormDirty] = useState(false);
  const showAlert = ({ title, message, type = 'info', actions = [] }) => {
    setAlertConfig({ visible: true, title, message, type, actions });
  };
  const formikRef = useRef(null);


  const stateSheetRef = useRef(null);
  const [selectedStateObj, setSelectedStateObj] = useState(null);

  const openStateSelector = () => {
    stateSheetRef.current?.expand();
  };

  const handleStateSelect = state => {
    setSelectedStateObj(state);
    formikRef.current?.setFieldValue('state', state.name);
    stateSheetRef.current?.close();
  };
  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  const handleCancel = values => {
    if (!formDirty) {
      navigation.goBack();
      return;
    }
    showAlert({
      title: 'Discard Changes?',
      message: 'You have unsaved changes. Do you really want to go back?',
      type: 'warning',
      actions: [
        { label: 'No', mode: 'outlined', onPress: hideAlert },
        {
          label: 'Yes',
          mode: 'contained',
          color: theme.colors.error,
          onPress: () => {
            hideAlert();
            navigation.goBack();
          },
        },
      ],
    });
  };

  // 🟢 Handle hardware back
  useEffect(() => {
    const backAction = () => {
      if (formDirty) {
        showAlert({
          title: 'Discard Changes?',
          message: 'You have unsaved changes. Do you really want to go back?',
          type: 'warning',
          actions: [
            { label: 'No', mode: 'outlined', onPress: hideAlert },
            {
              label: 'Yes',
              mode: 'contained',
              color: theme.colors.error,
              onPress: () => {
                hideAlert();
                navigation.goBack();
              },
            },
          ],
        });
        return true; // block default back
      }
      return false; // allow default
    };

    // ✅ Add listener
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    // ✅ Clean up correctly
    return () => backHandler.remove();
  }, [formDirty, navigation]);

  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      const requestBody = {
        name: values.partyName,
        mobile: values.contactNumber,
        address: values.address || '',
        city: values.city || '',
        state: values.state || '',
        postalCode: values.postalCode || '',
        gstNumber: values.gstin || '',
        country: 'India',
      };

      let response;

      if (isUpdate) {
        // 🟢 Update API
        response = await api.put(
          `/customer/id/${existingParty.id}`,
          requestBody,
        );
        // console.log('Update response:', response);
      } else {
        // 🟢 Create API
        response = await api.post('/customer', requestBody);
      }

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: isUpdate
            ? 'Party updated successfully!'
            : 'Party added successfully!',
        });

        resetForm();
        navigation?.goBack();
      } else {
        throw new Error(response.message || 'Operation failed');
      }
    } catch (error) {
      const messege = extractErrorMessage(error);

      Toast.show({
        type: 'error',
        text1: 'Failed to Save',
        text2: messege || 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // const handleCancel = () => {
  //   showAlert({
  //     title: 'Cancel',
  //     message: 'Are you sure you want to cancel? All changes will be lost.',
  //     type: 'warning',
  //     actions: [
  //       {
  //         label: 'No',
  //         mode: 'outlined',
  //         onPress: hideAlert,
  //       },
  //       {
  //         label: 'Yes',
  //         mode: 'contained',
  //         color: theme.colors.error,
  //         onPress: () => {
  //           hideAlert();
  //           navigation?.goBack();
  //         },
  //       },
  //     ],
  //   });
  // };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Formik
        innerRef={formikRef}
        enableReinitialize
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({
          values,
          errors,
          touched,
          handleChange,
          handleBlur,
          handleSubmit,
          isSubmitting,
        }) => {
          useEffect(() => {
            const changed = isFormChanged(initialValues, values);
            setFormDirty(changed);
          }, [values]);

          return (
            <>
              <Navbar
                title={isUpdate ? 'Update Customer' : 'Add New Customer'}
                onBackPress={() => handleCancel(values)}
              />
              <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
                <ScrollView
                  style={[styles.container]}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.form}>
                    {/* Contact Number */}
                    <TextInput
                      label="Contact Number *"
                      mode="outlined"
                      value={values.contactNumber}
                      onChangeText={handleChange('contactNumber')}
                      onBlur={handleBlur('contactNumber')}
                      error={touched.contactNumber && errors.contactNumber}
                      style={styles.input}
                      placeholder="Enter contact number"
                      keyboardType="phone-pad"
                      maxLength={10}
                      theme={{ roundness: 12 }}
                      left={<TextInput.Icon icon="phone" />}
                    />
                    {touched.contactNumber && errors.contactNumber && (
                      <Text
                        style={[
                          styles.errorText,
                          { color: theme.colors.error },
                        ]}
                      >
                        {errors.contactNumber}
                      </Text>
                    )}

                    {/* Party Name */}
                    <TextInput
                      label="Customer Name"
                      mode="outlined"
                      value={values.partyName}
                      onChangeText={handleChange('partyName')}
                      onBlur={handleBlur('partyName')}
                      error={touched.partyName && errors.partyName}
                      style={styles.input}
                      placeholder="Enter Customer name"
                      autoCapitalize="words"
                      maxLength={50}
                      theme={{ roundness: 12 }}
                      left={<TextInput.Icon icon="account" />}
                    />
                    {touched.partyName && errors.partyName && (
                      <Text
                        style={[
                          styles.errorText,
                          { color: theme.colors.error },
                        ]}
                      >
                        {errors.partyName}
                      </Text>
                    )}

                    <TextInput
                      label="GSTIN"
                      mode="outlined"
                      value={values.gstin}
                      onChangeText={handleChange('gstin')}
                      onBlur={handleBlur('gstin')}
                      //editable={!isUpdate}
                      style={styles.input}
                      placeholder="Enter Customer GSTIN"
                      multiline
                      numberOfLines={6}
                      maxLength={15}
                      textAlignVertical="top"
                      theme={{ roundness: 12 }}
                      left={<TextInput.Icon icon="file-document-outline" />}
                    />
                    {touched.gstin && errors.gstin && (
                      <Text
                        style={[
                          styles.errorText,
                          { color: theme.colors.error },
                        ]}
                      >
                        {errors.gstin}
                      </Text>
                    )}

                    <Text style={{ fontSize: 16, fontWeight: '600', }}>
                      Address Details
                    </Text>

                    <TextInput
                      label="Street / Address"
                      mode="outlined"
                      value={values.address}
                      onChangeText={handleChange('address')}
                      onBlur={handleBlur('address')}
                      style={styles.input}
                      placeholder="Enter street address"
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      left={<TextInput.Icon icon="home-outline" />}
                      theme={{ roundness: 12 }}
                      maxLength={100}
                    />

                    <TextInput
                      label="City"
                      mode="outlined"
                      value={values.city}
                      onChangeText={handleChange('city')}
                      onBlur={handleBlur('city')}
                      style={styles.input}
                      placeholder="Enter city"
                      left={<TextInput.Icon icon="city" />}
                      theme={{ roundness: 12 }}
                      maxLength={25}
                    />

                    <TouchableOpacity onPress={openStateSelector} activeOpacity={0.8}>
                      <TextInput
                        label="State"
                        mode="outlined"
                        value={values.state}
                        style={styles.input}
                        editable={false}
                        left={<TextInput.Icon icon="map-marker-outline" />}
                        right={<TextInput.Icon icon="chevron-down" />}
                        placeholder="Select state"
                        pointerEvents="none"
                        theme={{ roundness: 12 }}
                      />
                    </TouchableOpacity>

                    <TextInput
                      label="Postal Code"
                      mode="outlined"
                      value={values.postalCode}
                      onChangeText={handleChange('postalCode')}
                      onBlur={handleBlur('postalCode')}
                      style={styles.input}
                      placeholder="Enter postal code"
                      keyboardType="numeric"
                      maxLength={6}
                      left={<TextInput.Icon icon="map-marker-radius-outline" />}
                      theme={{ roundness: 12 }}
                    />


                  </View>
                </ScrollView>
              </KeyboardAvoidingView>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <Button
                  mode="outlined"
                  onPress={handleCancel}
                  style={[styles.button, styles.cancelButton]}
                  labelStyle={[
                    styles.buttonLabel,
                    { color: theme.colors.outline },
                  ]}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>

                <Button
                  mode="contained"
                  onPress={handleSubmit}
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
      <StateSelectorBottomSheet
        ref={stateSheetRef}
        onStateSelect={handleStateSelect}
        selectedState={selectedStateObj}
        title="Select State"
        showSearch={true}
        showRegionFilter={true}
        showCapital={true}
        snapPoints={['50%', '80%']}
        enablePanDownToClose={true}
        enableDynamicSizing={false}
      />

      <CustomAlert
        visible={alertConfig.visible}
        onDismiss={hideAlert}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        actions={alertConfig.actions}
      />
    </SafeAreaView>
  );
};
/*******  42ef8bac-1805-4257-b179-5f896fa02cad  *******/

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: 'transparent',
  },
  errorText: {
    fontSize: 12,
    marginTop: -12,
    marginLeft: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginVertical: 16,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
  },
  cancelButton: {
    borderWidth: 1.5,
  },
  saveButton: {
    elevation: 2,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
export default AddNewParty;
