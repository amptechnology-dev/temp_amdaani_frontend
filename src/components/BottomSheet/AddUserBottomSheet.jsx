import React, { forwardRef, useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  HelperText,
  ActivityIndicator,
} from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';
import Toast from 'react-native-toast-message';
import * as Yup from 'yup';
import { Dropdown } from 'react-native-element-dropdown';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../utils/api';

const AddUserBottomSheet = forwardRef(({ onSubmit }, ref) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);

  const [roles, setRoles] = useState([]);
  const [email, setEmail] = useState('');
  const [isFocus, setIsFocus] = useState(false);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    role: '',
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setRolesLoading(true);
      const res = await api.get('/role');
      if (res?.success) {
        setRoles(res.data.map(r => ({ label: r.name, value: r._id })));
      }
    } catch (err) {
      // console.log('Roles Fetch Error:', err.message);
    } finally {
      setRolesLoading(false);
    }
  };

  const validationSchema = Yup.object().shape({
    phone: Yup.string()
      .required('Phone is required')
      .matches(/^[0-9]{10,12}$/, 'Enter a valid phone number'),
    name: Yup.string().required('Name is required'),
    role: Yup.string().required('Role is required'),
  });

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
    } catch (err) {
      const newErrors = {};
      err.inner.forEach(e => (newErrors[e.path] = e.message));
      setErrors(newErrors);
      setTouched({ name: true, phone: true, role: true });
      return false;
    }
  };

  const handleSubmit = async () => {
    const valid = await validateForm();
    if (!valid) return;

    setLoading(true);

    try {
      const payload = {
        ...form,
        ...(email.trim() && { email: email.trim() }),
      };

      const res = await api.post('/store/users', payload);

      if (res?.success) {
        Toast.show({
          text1: res.message || 'User created successfully!',
          type: 'success',
        });

        onSubmit?.(res.data);

        setTimeout(() => handleClose(), 300);
      }
    } catch (err) {
      Toast.show({
        text1: err.message || 'Something went wrong!',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  console.log('role');

  const handleClose = () => {
    setForm({ name: '', phone: '', role: '' });
    setEmail('');
    setErrors({});
    setTouched({});
    ref.current?.close();
  };

  return (
    <BaseBottomSheet
      ref={ref}
      title="Add User"
      snapPoints={['65%']}
      initialSnapIndex={-1}
      showHeader
      contentType="scroll"
    >
      <View style={styles.wrapper}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <View style={styles.formContent}>
            <TextInput
              label="Full Name"
              mode="outlined"
              value={form.name}
              onChangeText={text => handleChange('name', text)}
              onBlur={() => handleBlur('name')}
              style={styles.input}
              error={touched.name && !!errors.name}
              theme={{ roundness: 12 }}
            />
            {errors.name && <HelperText type="error">{errors.name}</HelperText>}

            <TextInput
              label="Phone Number"
              mode="outlined"
              keyboardType="number-pad"
              maxLength={10}
              value={form.phone}
              onChangeText={text =>
                handleChange('phone', text.replace(/[^0-9]/g, ''))
              }
              onBlur={() => handleBlur('phone')}
              style={styles.input}
              error={touched.phone && !!errors.phone}
              theme={{ roundness: 12 }}
            />
            {errors.phone && (
              <HelperText type="error">{errors.phone}</HelperText>
            )}

            <TextInput
              label="Email (optional)"
              mode="outlined"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              theme={{ roundness: 12 }}
            />

            {rolesLoading ? (
              <ActivityIndicator style={{ alignSelf: 'center' }} />
            ) : (
              <View style={{ zIndex: 9999 }}>
                <Dropdown
                  mode="default"
                  style={[
                    styles.dropdown,
                    {
                      borderColor: isFocus
                        ? theme.colors.primary
                        : theme.colors.outline,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                  containerStyle={[
                    styles.dropdownContainer,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.outline,
                    },
                  ]}
                  itemContainerStyle={styles.itemContainer}
                  activeColor={theme.colors.secondaryContainer}
                  data={roles}
                  labelField="label"
                  valueField="value"
                  placeholder="Select role"
                  value={form.role || null}
                  onFocus={() => setIsFocus(true)}
                  onBlur={() => setIsFocus(false)}
                  placeholderStyle={{
                    color: theme.colors.onSurfaceVariant,
                  }}
                  selectedTextStyle={{
                    color: theme.colors.onSurface,
                    fontSize: 14,
                  }}
                  renderItem={item => {
                    const isSelected = item.value === form.role;

                    return (
                      <View
                        style={[
                          styles.item,
                          isSelected && {
                            backgroundColor: theme.colors.secondaryContainer,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: isSelected
                              ? theme.colors.onSecondaryContainer
                              : theme.colors.onSurface,
                            fontSize: 14,
                          }}
                        >
                          {item.label}
                        </Text>
                      </View>
                    );
                  }}
                  onChange={item => {
                    handleChange('role', item.value);
                    setIsFocus(false);
                  }}
                  renderRightIcon={() => (
                    <Icon
                      name={isFocus ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={theme.colors.onSurfaceVariant}
                    />
                  )}
                />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          <Button
            mode="outlined"
            onPress={handleClose}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.saveButton}
            loading={loading}
          >
            Add User
          </Button>
        </View>
      </View>
    </BaseBottomSheet>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
  container: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  input: { marginBottom: 6 },
  dropdown: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
    gap: 12,
    borderTopWidth: 1,
    //borderTopColor: '#f0f0f0',
    // backgroundColor: 'white',
  },
  cancelButton: { flex: 1 },
  saveButton: { flex: 2 },
  itemContainer: {
    marginHorizontal: 6,
    borderRadius: 20,
  },

  item: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
});

export default AddUserBottomSheet;
