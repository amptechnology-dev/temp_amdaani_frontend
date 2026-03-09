// src/screens/menu/settings.jsx
import React, { useState, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Linking,
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
    updateAuthState,
    isStockEnabled,
    fetchUserProfile,
    hasPermission,
    isPurchaseOrderEnabled,
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [poLoading, setPoLoading] = useState(false);

  const openTermsBottomSheet = () => {
    termsSheetRef.current?.expand();
  };

  const handleStockToggle = async () => {
    try {
      setStockLoading(true);
      const newValue = !isStockEnabled;

      const formData = new FormData();
      formData.append('settings[stockManagement]', newValue);

      const response = await api.put('/store/update-my-store', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Stock management ${newValue ? 'enabled' : 'disabled'}`,
        });

        // Refresh profile to update context
        await fetchUserProfile();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.message || 'Failed to update settings',
        });
      }
    } catch (error) {
      console.error('Error updating stock settings:', error);
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
    console.log('TOGGLE PURCHASE ORDER');
    try {
      setPoLoading(true);
      const newValue = !isPurchaseOrderEnabled;

      const response = await api.put('/store/update-my-store', {
        settings: {
          purchaseOrderManagement: newValue,
        },
      });

      console.log('PURCHASE ORDER RESPONSE', response);

      if (response?.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Purchase management ${newValue ? 'enabled' : 'disabled'}`,
        });

        await fetchUserProfile();
      }
    } catch (e) {
      console.log('PURCHASE ORDER ERROR', e?.response?.data || e.message);
    } finally {
      setPoLoading(false);
    }
  };

  // labels + icons mapping
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

  // Perfect Dropdown Component
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
      shadowOffset: {
        width: 0,
        height: 4,
      },
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
        left={props => (
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
          {
            color: theme.colors.onSurface,
            opacity: item.disabled ? 0.5 : 1,
          },
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
      <TermsBottomSheet ref={termsSheetRef} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
    paddingTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderContainer: {
    marginBottom: 12,
    marginHorizontal: 20,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  sectionContent: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
  },
  listItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  itemDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    marginLeft: 72,
    marginRight: 16,
  },
  switchContainer: {
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerContainer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  versionText: {
    textAlign: 'center',
    opacity: 0.6,
    marginBottom: 4,
  },
  copyrightText: {
    textAlign: 'center',
    opacity: 0.5,
    fontSize: 12,
  },
  // Dropdown Button Styles
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
  buttonText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  buttonIcon: {
    marginHorizontal: 4,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  // Dropdown Styles
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  dropdownItem: {
    marginHorizontal: 6,
    marginVertical: 2,
    borderRadius: 8,
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  leftIcon: {
    marginRight: 14,
    width: 20,
    textAlign: 'center',
  },
  dropdownText: {
    fontSize: 14,
    flex: 1,
  },
  checkIcon: {
    marginLeft: 8,
  },
});

export default Settings;
