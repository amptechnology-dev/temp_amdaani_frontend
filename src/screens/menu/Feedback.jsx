import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import React, { useState } from 'react';
import {
  Text,
  TextInput,
  Button,
  useTheme,
  HelperText,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import DeviceInfo from 'react-native-device-info';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../utils/api';
import Navbar from '../../components/Navbar';

const Feedback = () => {
  const theme = useTheme();
  const [type, setType] = useState('general');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isFocus, setIsFocus] = useState(false);

  const feedbackTypes = [
    { label: 'General', value: 'general' },
    { label: 'Bug Report', value: 'bug' },
    { label: 'Feature Request', value: 'feature' },
    { label: 'Other', value: 'other' },
  ];

  const handleSubmit = async () => {
    // Validation
    const newErrors = {};
    if (!message.trim()) {
      newErrors.message = 'Message is required';
    }
    if (message.trim().length > 1000) {
      newErrors.message = 'Message must be less than 1000 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const appVersion = DeviceInfo.getVersion();
      const deviceInfo = `${DeviceInfo.getBrand()} ${DeviceInfo.getModel()}`;
      const osVersion = `${Platform.OS} ${DeviceInfo.getSystemVersion()}`;

      const payload = {
        message: message.trim(),
        type,
        metadata: {
          appVersion,
          deviceInfo,
          os: osVersion,
        },
      };

      // console.log('Submitting feedback with payload:', payload);

      const response = await api.post('/feedback', payload);

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Feedback Submitted',
          text2: 'Thank you for your feedback!',
        });
        // Reset form
        setMessage('');
        setType('general');
      }
    } catch (error) {
      const errorMsg =
        error.response?.data?.message || 'Failed to submit feedback';
      Toast.show({
        type: 'error',
        text1: 'Submission Failed',
        text2: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Navbar title="Feedback" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">

        {/* Feedback Type Dropdown */}
        <View style={styles.inputGroup}>
          <Text variant="labelLarge" style={styles.label}>
            Feedback Type
          </Text>
          <Dropdown
            style={[
              styles.dropdown,
              {
                borderColor: isFocus
                  ? theme.colors.primary
                  : theme.colors.outline,
                backgroundColor: theme.colors.surface,
              },
            ]}
            placeholderStyle={[
              styles.placeholderStyle,
              { color: theme.colors.onSurfaceVariant },
            ]}
            selectedTextStyle={[
              styles.selectedTextStyle,
              { color: theme.colors.onSurface },
            ]}
            inputSearchStyle={[
              styles.inputSearchStyle,
              {
                borderColor: theme.colors.outline,
                color: theme.colors.onSurface,
              },
            ]}
            iconStyle={styles.iconStyle}
            iconColor={
              isFocus ? theme.colors.primary : theme.colors.onSurfaceVariant
            }
            containerStyle={[
              styles.containerStyle,
              { backgroundColor: theme.colors.surface },
            ]}
            itemContainerStyle={[
              styles.itemContainerStyle,
              { backgroundColor: theme.colors.surface },
            ]}
            itemTextStyle={[
              styles.itemTextStyle,
              { color: theme.colors.onSurface },
            ]}
            activeColor={theme.colors.primaryContainer}
            data={feedbackTypes}
            maxHeight={300}
            labelField="label"
            valueField="value"
            placeholder="Select feedback type"
            value={type}
            onFocus={() => setIsFocus(true)}
            onBlur={() => setIsFocus(false)}
            onChange={item => {
              setType(item.value);
              setIsFocus(false);
            }}
            renderRightIcon={() => (
              <Icon
                name={isFocus ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={
                  isFocus ? theme.colors.primary : theme.colors.onSurfaceVariant
                }
              />
            )}
          />
        </View>

        {/* Message Input */}
        <View style={styles.inputGroup}>
          <Text variant="labelLarge" style={styles.label}>
            Message
          </Text>
          <TextInput
            mode="outlined"
            value={message}
            onChangeText={text => {
              setMessage(text);
              setErrors(prev => ({ ...prev, message: null }));
            }}
            multiline
            numberOfLines={6}
            maxLength={1000}
            placeholder="Tell us what you think..."
            style={styles.textArea}
            error={!!errors.message}
            theme={{ roundness: 12 }}
          />
          <View style={styles.helperRow}>
            {errors.message && (
              <HelperText type="error" visible={!!errors.message}>
                {errors.message}
              </HelperText>
            )}
            <Text
              variant="bodySmall"
              style={[
                styles.characterCount,
                { color: theme.colors.onSurfaceVariant },
              ]}>
              {message.length}/1000
            </Text>
          </View>
        </View>

        {/* Submit Button */}
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}>
          Submit Feedback
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
  },
  dropdown: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  placeholderStyle: {
    fontSize: 16,
  },
  selectedTextStyle: {
    fontSize: 16,
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
  },
  containerStyle: {
    borderRadius: 12,
    marginTop: 4,
  },
  itemContainerStyle: {
    paddingVertical: 0,
    borderRadius: 12,
    margin: 4

  },
  itemTextStyle: {
    fontSize: 16,
  },
  textArea: {
    padding: 12,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  characterCount: {
    marginLeft: 'auto',
    marginTop: 4,
  },
  submitButton: {
    marginTop: 8,
  },
  submitButtonContent: {
    paddingVertical: 6,
  },
});

export default Feedback;
