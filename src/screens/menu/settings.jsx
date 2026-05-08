// src/screens/menu/settings.jsx
import React, { useState, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  List,
  Divider,
  Text,
  useTheme,
  Button,
  Portal,
  TouchableRipple,
  Icon,
  Switch,
  Modal,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Navbar from '../../components/Navbar';
import { useThemeContext } from '../../context/ThemeContext';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppLock } from '../../context/AppLockContext';
import DeviceInfo from 'react-native-device-info';
import { useNavigation } from '@react-navigation/native';
import { useAuth, permissions } from '../../context/AuthContext';
import api from '../../utils/api';
import Toast from 'react-native-toast-message';
import TermsBottomSheet from '../../components/BottomSheet/TermsBottomSheet';

const { width: screenWidth } = Dimensions.get('window');

const Settings = () => {
  const { themeMode, setThemeMode } = useThemeContext();
  const theme = useTheme();
  const { isEnabled, enable, disable } = useAppLock();
  const [visible, setVisible] = useState(false);
  const [buttonLayout, setButtonLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const buttonRef = useRef(null);
  const termsSheetRef = useRef(null);

  const navigation = useNavigation();
  const appVersion = DeviceInfo.getVersion();
  const {
    authState,
    isStockEnabled,
    fetchUserProfile,
    hasPermission,
    isPurchaseOrderEnabled,
  } = useAuth();

  // ── Helpers ──────────────────────────────────────────────────
  const getCurrentEmail = () =>
    authState?.user?.email ||
    authState?.user?.store?.email ||
    authState?.user?.store?.contact?.email ||
    '';

  const getCurrentPhone = () => authState?.user?.phone || '';

  const [loading, setLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [poLoading, setPoLoading] = useState(false);

  // ── Change Email Modal ───────────────────────────────────────
  // Flow: VERIFY_EMAIL (send OTP to current email) → VERIFY_OTP → NEW_EMAIL (enter + submit)
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailStep, setEmailStep] = useState('VERIFY_EMAIL');
  const [currentEmailOtp, setCurrentEmailOtp] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeToken, setEmailChangeToken] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const resetEmailFlow = () => {
    setEmailStep('VERIFY_EMAIL');
    setCurrentEmailOtp('');
    setNewEmail('');
    setEmailChangeToken(null);
    setEmailLoading(false);
  };

  const openEmailModal = () => {
    resetEmailFlow();
    setEmailModalVisible(true);
  };

  const closeEmailModal = () => {
    setEmailModalVisible(false);
    resetEmailFlow();
  };

  // ── Change Phone Modal ───────────────────────────────────────
  // Flow: VERIFY_EMAIL (send OTP to current email) → VERIFY_OTP → NEW_PHONE (enter + submit)
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [phoneStep, setPhoneStep] = useState('VERIFY_EMAIL');
  const [phoneVerifyOtp, setPhoneVerifyOtp] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [phoneChangeToken, setPhoneChangeToken] = useState(null);
  const [phoneLoading, setPhoneLoading] = useState(false);

  const resetPhoneFlow = () => {
    setPhoneStep('VERIFY_EMAIL');
    setPhoneVerifyOtp('');
    setNewPhone('');
    setPhoneChangeToken(null);
    setPhoneLoading(false);
  };

  const openPhoneModal = () => {
    resetPhoneFlow();
    setPhoneModalVisible(true);
  };

  const closePhoneModal = () => {
    setPhoneModalVisible(false);
    resetPhoneFlow();
  };

  const openTermsBottomSheet = () => {
    termsSheetRef.current?.expand();
  };

  // ── Change Email Handlers ────────────────────────────────────

  // Step 1: Send OTP to current email
  const handleSendCurrentEmailOtp = async () => {
    const current = getCurrentEmail();
    if (!current) {
      Toast.show({ type: 'error', text1: 'No email found on account' });
      return;
    }
    try {
      setEmailLoading(true);
      const res = await api.post('/auth/phone-change-email/send-otp', {
        email: current,
      });
      if (!res?.success) {
        throw new Error(res?.message || 'Failed to send OTP');
      }
      setEmailChangeToken(res?.data?.token || null);
      Toast.show({ type: 'success', text1: `OTP sent to ${current}` });
      setEmailStep('VERIFY_OTP');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'Failed to send OTP',
      });
    } finally {
      setEmailLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyCurrentEmailOtp = async () => {
    if (!currentEmailOtp || currentEmailOtp.length < 4) {
      Toast.show({ type: 'error', text1: 'Enter valid OTP' });
      return;
    }
    try {
      setEmailLoading(true);
      const res = await api.post('/auth/phone-change-email/verify-otp', {
        email: getCurrentEmail(),
        otp: currentEmailOtp.trim(),
      });
      if (!res?.success) {
        throw new Error(res?.message || 'Invalid OTP');
      }
      setEmailChangeToken(res?.data?.token || null);
      Toast.show({ type: 'success', text1: 'OTP verified' });
      setEmailStep('NEW_EMAIL');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Verification failed',
        text2: error?.message || 'Invalid OTP',
      });
    } finally {
      setEmailLoading(false);
    }
  };

  // Step 3: Submit new email
  const handleUpdateEmail = async () => {
    if (!newEmail?.trim()) {
      Toast.show({ type: 'error', text1: 'New email is required' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      Toast.show({ type: 'error', text1: 'Enter a valid email address' });
      return;
    }
    try {
      setEmailLoading(true);
      const res = await api.post('/auth/phone-change-email/update-email', {
        email: newEmail.trim(),
      });
      if (!res?.success) {
        throw new Error(res?.message || 'Failed to update email');
      }
      await fetchUserProfile();
      Toast.show({ type: 'success', text1: 'Email updated successfully' });
      closeEmailModal();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: error?.message || 'Could not update email',
      });
    } finally {
      setEmailLoading(false);
    }
  };

  // ── Change Phone Handlers ────────────────────────────────────

  // Step 1: Send OTP to current email to verify identity
  const handleSendPhoneVerifyEmailOtp = async () => {
    const current = getCurrentEmail();
    if (!current) {
      Toast.show({ type: 'error', text1: 'No email found on account' });
      return;
    }
    try {
      setPhoneLoading(true);
      const res = await api.post('/auth/phone-change-phone/send-otp', {
        email: current,
      });
      if (!res?.success) {
        throw new Error(res?.message || 'Failed to send OTP');
      }
      setPhoneChangeToken(res?.data?.token || null);
      Toast.show({ type: 'success', text1: `OTP sent to ${current}` });
      setPhoneStep('VERIFY_OTP');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'Failed to send OTP',
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyPhoneEmailOtp = async () => {
    if (!phoneVerifyOtp || phoneVerifyOtp.length < 4) {
      Toast.show({ type: 'error', text1: 'Enter valid OTP' });
      return;
    }
    try {
      setPhoneLoading(true);
      const res = await api.post(
        '/auth/phone-change-phone/verify-otp',
        { email: getCurrentEmail(), otp: phoneVerifyOtp.trim() },
        {
          headers: phoneChangeToken
            ? { Authorization: `Bearer ${phoneChangeToken}` }
            : {},
          _skipRefresh: true,
        },
      );
      if (!res?.success) {
        throw new Error(res?.message || 'Invalid OTP');
      }
      setPhoneChangeToken(res?.data?.token || null);
      Toast.show({ type: 'success', text1: 'Identity verified' });
      setPhoneStep('NEW_PHONE');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Verification failed',
        text2: error?.message || 'Invalid OTP',
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  // Step 3: Submit new phone
  const handleUpdatePhone = async () => {
    if (!newPhone?.trim()) {
      Toast.show({ type: 'error', text1: 'New phone number is required' });
      return;
    }
    try {
      setPhoneLoading(true);
      const res = await api.post(
        '/auth/phone-change-phone/update-phone',
        { newPhone: newPhone.trim() },
        {
          headers: phoneChangeToken
            ? { Authorization: `Bearer ${phoneChangeToken}` }
            : {},
          _skipRefresh: true,
        },
      );
      if (!res?.success) {
        throw new Error(res?.message || 'Failed to update phone');
      }
      await fetchUserProfile();
      Toast.show({
        type: 'success',
        text1: 'Phone number updated successfully',
      });
      closePhoneModal();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: error?.message || 'Could not update phone number',
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  // ── Stock & PO Toggles ───────────────────────────────────────
  const handleStockToggle = async () => {
    try {
      setStockLoading(true);
      const newValue = !isStockEnabled;
      const response = await api.put('/store/update-my-store', {
        settings: {
          stockManagement: newValue,
          purchaseOrderManagement: isPurchaseOrderEnabled,
        },
      });
      if (response?.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Stock management ${newValue ? 'enabled' : 'disabled'}`,
        });
        await fetchUserProfile();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response?.message || 'Failed to update settings',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Something went wrong',
      });
    } finally {
      setStockLoading(false);
    }
  };

  const handlePurchaseOrderToggle = async () => {
    try {
      setPoLoading(true);
      const newValue = !isPurchaseOrderEnabled;
      const response = await api.put('/store/update-my-store', {
        settings: {
          purchaseOrderManagement: newValue,
          stockManagement: isStockEnabled,
        },
      });
      if (response?.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Purchase management ${newValue ? 'enabled' : 'disabled'}`,
        });
        await fetchUserProfile();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response?.message || 'Failed to update settings',
        });
      }
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Something went wrong',
      });
    } finally {
      setPoLoading(false);
    }
  };

  // ── Theme Dropdown ───────────────────────────────────────────
  const themeOptions = {
    system: { label: 'System', icon: 'monitor' },
    light: { label: 'Light', icon: 'white-balance-sunny' },
    dark: { label: 'Dark', icon: 'moon-waning-crescent' },
  };
  const current = themeOptions[themeMode];

  const handleDropdownPress = () => {
    if (buttonRef.current) {
      buttonRef.current.measureInWindow((x, y, width, height) => {
        setButtonLayout({ x, y, width, height });
        setVisible(true);
      });
    }
  };

  const ThemeDropdown = () => {
    if (!visible) return null;
    const dropdownStyle = {
      position: 'absolute',
      top: buttonLayout.y + buttonLayout.height + 8,
      right: 16,
      width: buttonLayout.width + 20,
      zIndex: 1000,
      elevation: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: theme.colors.outline,
    };
    return (
      <Portal>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={dropdownStyle}>
            {Object.entries(themeOptions).map(([key, opt]) => {
              const isSelected = key === themeMode;
              return (
                <TouchableRipple
                  key={key}
                  onPress={() => {
                    setThemeMode(key);
                    setVisible(false);
                  }}
                  style={[
                    styles.dropdownItem,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primaryContainer + '30'
                        : 'transparent',
                    },
                  ]}
                  rippleColor={theme.colors.primary + '20'}
                >
                  <View style={styles.dropdownItemContent}>
                    <View style={styles.leftContent}>
                      <MaterialCommunityIcons
                        name={opt.icon}
                        size={20}
                        color={
                          isSelected
                            ? theme.colors.primary
                            : theme.colors.onSurfaceVariant
                        }
                        style={styles.leftIcon}
                      />
                      <Text
                        variant="bodyMedium"
                        style={[
                          styles.dropdownText,
                          {
                            color: isSelected
                              ? theme.colors.primary
                              : theme.colors.onSurface,
                            fontWeight: isSelected ? '600' : '500',
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color={theme.colors.primary}
                        style={styles.checkIcon}
                      />
                    )}
                  </View>
                </TouchableRipple>
              );
            })}
          </View>
        </Pressable>
      </Portal>
    );
  };

  // ── Settings Sections ────────────────────────────────────────
  const settingsSections = [
    ...(hasPermission(permissions.CAN_MANAGE_SETTINGS)
      ? [
          {
            title: 'Business Preferences',
            icon: 'briefcase-outline',
            data: [
              {
                title: 'Stock Management',
                description: 'Enable inventory tracking and stock adjustments',
                icon: 'package-variant',
                type: 'switch',
                value: isStockEnabled,
                onToggle: handleStockToggle,
                disabled: stockLoading,
              },
              {
                title: 'Purchase Management',
                description: 'Enable purchase order features',
                icon: 'cart-arrow-down',
                type: 'switch',
                value: isPurchaseOrderEnabled,
                onToggle: handlePurchaseOrderToggle,
                disabled: poLoading,
              },
            ],
          },
        ]
      : []),
    {
      title: 'App Preferences',
      icon: 'cog-outline',
      data: [
        {
          title: 'Theme Mode',
          description: `Current: ${current.label}`,
          icon: current.icon,
          type: 'dropdown',
        },
        {
          title: 'App Lock',
          description: 'Require biometric/PIN to open the app',
          icon: 'lock-outline',
          type: 'switch',
          value: isEnabled,
          onToggle: () => (isEnabled ? disable() : enable()),
        },
        {
          title: 'Notifications',
          description: 'Receive important updates',
          icon: 'bell-outline',
          type: 'switch',
          value: true,
          onToggle: () => {},
        },
      ],
    },
    {
      title: 'Account',
      icon: 'account-edit-outline',
      data: [
        {
          title: 'Change Email',
          description: getCurrentEmail() || 'Update your email address',
          icon: 'email-edit-outline',
          type: 'navigate',
          onPress: openEmailModal,
        },
        {
          title: 'Change Phone Number',
          description: getCurrentPhone() || 'Update your phone number',
          icon: 'phone-edit-outline',
          type: 'navigate',
          onPress: openPhoneModal,
        },
      ],
    },
    {
      title: 'About & Support',
      icon: 'information-outline',
      data: [
        {
          title: 'Help & Support',
          description: 'Get assistance anytime',
          icon: 'help-circle-outline',
          onPress: () => navigation.navigate('Help'),
        },
        {
          title: 'Privacy Policy',
          description: 'View app privacy practices',
          icon: 'shield-account-outline',
          onPress: openTermsBottomSheet,
        },
      ],
    },
  ];

  const renderMenuItem = ({ item, index, section }) => (
    <View>
      <List.Item
        title={item.title}
        description={item.description}
        left={() => (
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name={item.icon}
              size={24}
              color={theme.colors.primary}
            />
          </View>
        )}
        right={() => {
          if (item.type === 'dropdown') {
            return (
              <View ref={buttonRef}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleDropdownPress}
                  style={[
                    styles.dropdownBtn,
                    {
                      borderColor: visible
                        ? theme.colors.primary
                        : theme.colors.outline,
                      backgroundColor: visible
                        ? theme.colors.primaryContainer + '20'
                        : theme.colors.surface,
                    },
                  ]}
                >
                  <Icon
                    source={current.icon}
                    size={16}
                    color={theme.colors.onSurfaceVariant}
                    style={styles.buttonIcon}
                  />
                  <Text
                    style={[
                      styles.buttonText,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    {current.label}
                  </Text>
                  <MaterialCommunityIcons
                    name={visible ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.colors.onSurfaceVariant}
                    style={styles.chevronIcon}
                  />
                </TouchableOpacity>
              </View>
            );
          }
          if (item.type === 'switch') {
            return (
              <View style={styles.switchContainer}>
                {item.disabled ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                  />
                ) : (
                  <Switch
                    value={item.value}
                    onValueChange={item.onToggle}
                    disabled={item.disabled}
                    color={theme.colors.primary}
                  />
                )}
              </View>
            );
          }
          return (
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
          );
        }}
        onPress={item.onPress}
        disabled={item.disabled}
        titleStyle={[
          styles.itemTitle,
          { color: theme.colors.onSurface, opacity: item.disabled ? 0.5 : 1 },
        ]}
        descriptionStyle={[
          styles.itemDescription,
          { color: theme.colors.onSurfaceVariant },
        ]}
        style={[
          styles.listItem,
          { opacity: item.disabled && loading ? 0.6 : 1 },
        ]}
      />
      {index < section.data.length - 1 && <Divider style={styles.divider} />}
    </View>
  );

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeaderContainer}>
      <View style={styles.sectionHeaderContent}>
        <MaterialCommunityIcons
          name={section.icon}
          size={18}
          color={theme.colors.primary}
          style={styles.sectionIcon}
        />
        <Text
          variant="titleSmall"
          style={[styles.sectionTitle, { color: theme.colors.primary }]}
        >
          {section.title}
        </Text>
      </View>
    </View>
  );

  const renderSection = ({ item: section }) => (
    <View style={styles.section}>
      {renderSectionHeader({ section })}
      <View
        style={[
          styles.sectionContent,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline + '30',
          },
        ]}
      >
        <FlatList
          data={section.data}
          renderItem={({ item, index }) =>
            renderMenuItem({ item, index, section })
          }
          keyExtractor={(item, index) => `${section.title}-${index}`}
          scrollEnabled={false}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar title="Settings" />
      <FlatList
        data={settingsSections}
        renderItem={renderSection}
        keyExtractor={(item, index) => `section-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        ListFooterComponent={() => (
          <View style={styles.footerContainer}>
            <Text
              variant="bodySmall"
              style={[
                styles.versionText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              App Version {appVersion}
            </Text>
          </View>
        )}
      />

      <ThemeDropdown />

      {/* ── Change Email Modal ── */}
      <Portal>
        <Modal
          visible={emailModalVisible}
          onDismiss={closeEmailModal}
          contentContainerStyle={[
            styles.modalContainer,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            Change Email
          </Text>

          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            {['VERIFY_EMAIL', 'VERIFY_OTP', 'NEW_EMAIL'].map((step, i) => (
              <View key={step} style={styles.stepRow}>
                <View
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor:
                        emailStep === step
                          ? theme.colors.primary
                          : ['VERIFY_OTP', 'NEW_EMAIL'].indexOf(emailStep) >
                              i - 1 && emailStep !== step
                          ? theme.colors.primary + '60'
                          : theme.colors.outline,
                    },
                  ]}
                />
                {i < 2 && (
                  <View
                    style={[
                      styles.stepLine,
                      { backgroundColor: theme.colors.outline },
                    ]}
                  />
                )}
              </View>
            ))}
          </View>

          {emailStep === 'VERIFY_EMAIL' && (
            <>
              <Text
                variant="bodySmall"
                style={[
                  styles.stepHint,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                We'll send a verification OTP to your current email:
              </Text>
              <TextInput
                label="Current Email"
                mode="outlined"
                value={getCurrentEmail()}
                editable={false}
                style={[styles.modalInput, { opacity: 0.7 }]}
              />
            </>
          )}

          {emailStep === 'VERIFY_OTP' && (
            <>
              <Text
                variant="bodySmall"
                style={[
                  styles.stepHint,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Enter the OTP sent to {getCurrentEmail()}
              </Text>
              <TextInput
                label="Enter OTP"
                mode="outlined"
                value={currentEmailOtp}
                onChangeText={setCurrentEmailOtp}
                keyboardType="number-pad"
                style={styles.modalInput}
                disabled={emailLoading}
                maxLength={6}
              />
            </>
          )}

          {emailStep === 'NEW_EMAIL' && (
            <>
              <Text
                variant="bodySmall"
                style={[
                  styles.stepHint,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Enter your new email address
              </Text>
              <TextInput
                label="New Email"
                mode="outlined"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.modalInput}
                disabled={emailLoading}
              />
            </>
          )}

          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={closeEmailModal}
              disabled={emailLoading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              loading={emailLoading}
              disabled={emailLoading}
              onPress={() => {
                if (emailStep === 'VERIFY_EMAIL')
                  return handleSendCurrentEmailOtp();
                if (emailStep === 'VERIFY_OTP')
                  return handleVerifyCurrentEmailOtp();
                return handleUpdateEmail();
              }}
            >
              {emailStep === 'VERIFY_EMAIL' && 'Send OTP'}
              {emailStep === 'VERIFY_OTP' && 'Verify OTP'}
              {emailStep === 'NEW_EMAIL' && 'Update Email'}
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* ── Change Phone Modal ── */}
      <Portal>
        <Modal
          visible={phoneModalVisible}
          onDismiss={closePhoneModal}
          contentContainerStyle={[
            styles.modalContainer,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            Change Phone Number
          </Text>

          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            {['VERIFY_EMAIL', 'VERIFY_OTP', 'NEW_PHONE'].map((step, i) => (
              <View key={step} style={styles.stepRow}>
                <View
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor:
                        phoneStep === step
                          ? theme.colors.primary
                          : ['VERIFY_OTP', 'NEW_PHONE'].indexOf(phoneStep) >
                              i - 1 && phoneStep !== step
                          ? theme.colors.primary + '60'
                          : theme.colors.outline,
                    },
                  ]}
                />
                {i < 2 && (
                  <View
                    style={[
                      styles.stepLine,
                      { backgroundColor: theme.colors.outline },
                    ]}
                  />
                )}
              </View>
            ))}
          </View>

          {phoneStep === 'VERIFY_EMAIL' && (
            <>
              <Text
                variant="bodySmall"
                style={[
                  styles.stepHint,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                We'll send a verification OTP to your email:
              </Text>
              <TextInput
                label="Email"
                mode="outlined"
                value={getCurrentEmail()}
                editable={false}
                style={[styles.modalInput, { opacity: 0.7 }]}
              />
            </>
          )}

          {phoneStep === 'VERIFY_OTP' && (
            <>
              <Text
                variant="bodySmall"
                style={[
                  styles.stepHint,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Enter the OTP sent to {getCurrentEmail()}
              </Text>
              <TextInput
                label="Enter OTP"
                mode="outlined"
                value={phoneVerifyOtp}
                onChangeText={setPhoneVerifyOtp}
                keyboardType="number-pad"
                style={styles.modalInput}
                disabled={phoneLoading}
                maxLength={6}
              />
            </>
          )}

          {phoneStep === 'NEW_PHONE' && (
            <>
              <Text
                variant="bodySmall"
                style={[
                  styles.stepHint,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Enter your new phone number
              </Text>
              <TextInput
                label="New Phone Number"
                mode="outlined"
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
                style={styles.modalInput}
                disabled={phoneLoading}
              />
            </>
          )}

          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={closePhoneModal}
              disabled={phoneLoading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              loading={phoneLoading}
              disabled={phoneLoading}
              onPress={() => {
                if (phoneStep === 'VERIFY_EMAIL')
                  return handleSendPhoneVerifyEmailOtp();
                if (phoneStep === 'VERIFY_OTP')
                  return handleVerifyPhoneEmailOtp();
                return handleUpdatePhone();
              }}
            >
              {phoneStep === 'VERIFY_EMAIL' && 'Send OTP'}
              {phoneStep === 'VERIFY_OTP' && 'Verify OTP'}
              {phoneStep === 'NEW_PHONE' && 'Update Number'}
            </Button>
          </View>
        </Modal>
      </Portal>

      <TermsBottomSheet ref={termsSheetRef} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 24, paddingTop: 8 },
  section: { marginBottom: 24 },
  sectionHeaderContainer: { marginBottom: 12, marginHorizontal: 20 },
  sectionHeaderContent: { flexDirection: 'row', alignItems: 'center' },
  sectionIcon: { marginRight: 8 },
  sectionTitle: { fontWeight: '600', letterSpacing: 0.5 },
  sectionContent: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
  },
  listItem: { paddingVertical: 14, paddingHorizontal: 16 },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  itemTitle: { fontSize: 15, fontWeight: '500' },
  itemDescription: { fontSize: 13, marginTop: 2 },
  divider: { marginLeft: 72, marginRight: 16 },
  switchContainer: {
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerContainer: { alignItems: 'center', paddingTop: 16, paddingBottom: 8 },
  versionText: { textAlign: 'center', opacity: 0.6, marginBottom: 4 },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    minWidth: 140,
    height: 38,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  buttonText: { fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'center' },
  buttonIcon: { marginHorizontal: 4 },
  chevronIcon: { marginLeft: 4 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  dropdownItem: { marginHorizontal: 6, marginVertical: 2, borderRadius: 8 },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  leftContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  leftIcon: { marginRight: 14, width: 20, textAlign: 'center' },
  dropdownText: { fontSize: 14, flex: 1 },
  checkIcon: { marginLeft: 8 },
  // Modal styles
  modalContainer: { marginHorizontal: 18, borderRadius: 14, padding: 16 },
  modalTitle: { fontWeight: '600', marginBottom: 8 },
  modalInput: { marginBottom: 10 },
  modalActions: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  stepHint: { marginBottom: 10, fontSize: 13 },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 10, height: 10, borderRadius: 5 },
  stepLine: { width: 24, height: 2, marginHorizontal: 4 },
});

export default Settings;
