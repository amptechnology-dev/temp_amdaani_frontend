import {
  View,
  FlatList,
  StyleSheet,
  Linking,
  TouchableOpacity,
  Image,
} from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  List,
  Divider,
  Text,
  useTheme,
  Avatar,
  Icon,
  ProgressBar,
} from 'react-native-paper';
import { useAuth, permissions } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import CarouselSlider from '../../components/CarouselSlider';
import { SafeAreaView } from 'react-native-safe-area-context';
import DeviceInfo from 'react-native-device-info';
import CustomAlert from '../../components/CustomAlert';
import TermsBottomSheet from '../../components/BottomSheet/TermsBottomSheet';
import api from '../../utils/api';
import { PieChart } from 'react-native-gifted-charts';

const Menu = () => {
  const { logout, loading, authState } = useAuth();
  const {
    subscription,
    subLoading: subscriptionLoading,
    hasPermission,
    isPurchaseOrderEnabled,
  } = useAuth();
  const [alertVisible, setAlertVisible] = useState(false);
  const [logoutAlertVisible, setLogoutAlertVisible] = useState(false); // Add logout alert state
  const [profileProgress, setProfileProgress] = useState(0);

  const theme = useTheme();
  const appVersion = DeviceInfo.getVersion();
  const navigation = useNavigation();
  const termsSheetRef = useRef(null);

  const user = authState?.user;

  const openTermsBottomSheet = () => {
    // console.log('openTermsBottomSheet');
    termsSheetRef.current?.expand();
  };

  // Helper function to get plan display info
  const getPlanDisplayInfo = () => {
    if (subscriptionLoading) {
      return {
        planName: 'Loading...',
        iconColor: theme.colors.onSurfaceVariant,
        textColor: theme.colors.onSurfaceVariant,
        icon: 'crown',
      };
    }

    if (subscription) {
      return {
        planName: `${subscription?.planName} Plan`,
        iconColor:
          subscription?.planName == 'Free'
            ? theme.colors.onSurfaceVariant
            : theme.colors.primary,
        textColor:
          subscription?.planName == 'Free'
            ? theme.colors.onSurfaceVariant
            : theme.colors.primary,
        icon:
          subscription.planName == 'Free' ? 'crown-outline' : 'crown-outline',
      };
    }

    const planName =
      subscription?.planName || subscription?.plan?.name || 'Unknown Plan';

    // Determine colors and icon based on plan type
    switch (planName.toLowerCase()) {
      case 'free':
        return {
          planName: 'Free Plan',
          iconColor: theme.colors.onSurfaceVariant,
          textColor: theme.colors.onSurfaceVariant,
          icon: 'crown-outline',
        };
      case 'basic':
        return {
          planName: 'Basic Plan',
          iconColor: theme.colors.primary,
          textColor: theme.colors.primary,
          icon: 'crown',
        };
      case 'premium':
      case 'pro':
        return {
          planName: 'Premium Plan',
          iconColor: '#FFD700', // Gold color for premium
          textColor: '#FFD700',
          icon: 'crown',
        };
      default:
        return {
          planName: planName,
          iconColor: theme.colors.primary,
          textColor: theme.colors.primary,
          icon: 'crown',
        };
    }
  };

  const planInfo = getPlanDisplayInfo();

  // Handle logout confirmation
  const handleLogout = () => {
    setLogoutAlertVisible(true);
  };

  const confirmLogout = () => {
    setLogoutAlertVisible(false);
    logout();
  };

  const menuSections = [
    {
      data: [
        {
          title: 'Dashboard',
          icon: 'view-dashboard',
          onPress: () => navigation.navigate('Dashboard'),
          description: 'Business snapshot — KPIs and recent activity',
        },
      ],
    },
    {
      title: 'Master',
      data: [
        {
          title: 'Items',
          icon: 'package-variant',
          onPress: () => navigation.navigate('Itemlist', { fromMenu: true }),
          description: 'Manage products and inventory',
        },
        {
          title: 'Vendors',
          icon: 'truck',
          onPress: () => navigation.navigate('VendorList'), // new route for vendors
          description: 'Manage suppliers and purchase sources',
        },
        {
          title: 'Customer',
          icon: 'account-group',
          onPress: () => navigation.navigate('PartyList'),
          description: 'Customer list and contact details',
        },
        hasPermission(permissions.CAN_MANAGE_USERS) &&
          subscription?.planName !== 'Free' && {
            title: 'Users',
            icon: 'account-multiple',
            onPress: () => navigation.navigate('UserList'),
            description: 'Manage application users and roles',
          },
      ],
    },
    {
      title: 'Billing & Other Expenses',
      data: [
        isPurchaseOrderEnabled && {
          title: 'Purchase',
          icon: 'credit-card-multiple',
          onPress: () =>
            navigation.navigate('Transactions', { purchase: true }), // opens the Purchase screen
          description: 'Create and manage purchase invoices',
        },
        {
          title: 'Sales Invoices',
          icon: 'swap-horizontal',
          onPress: () => navigation.navigate('Transactions'),
          description: 'Create, view and manage invoices',
        },
        {
          title: 'Other Expenses',
          icon: 'cash',
          onPress: () => navigation.navigate('Expenses'),
          description: 'Expense heads, bills and payouts',
        },
      ],
    },
    {
      title: 'Reports & Insights',
      data: [
        {
          title: 'Report',
          icon: 'file-chart',
          onPress: () => navigation.navigate('Report'),
          description: 'Sales & performance reports with filters',
        },
        {
          title: 'All Transactions',
          icon: 'currency-inr',
          onPress: () => navigation.navigate('AllTransactions'),
          description: 'All Payments History and details',
        },
      ],
    },
    {
      title: 'Business Setup',
      data: [
        {
          title: 'Business Profile',
          icon: 'account-circle',
          onPress: () => navigation.navigate('Profile'),
          description: 'Company details and contact information',
        },
        {
          title: 'Print Preference',
          icon: 'printer',
          onPress: () => navigation.navigate('PrintPreference'),
          description: 'Select printer, paper size and defaults',
        },
      ],
    },
    {
      title: 'Subscriptions',
      data: [
        hasPermission(permissions.CAN_MANAGE_SUBSCRIPTIONS) && {
          title: 'Plans & Pricing',
          icon: 'currency-usd',
          onPress: () => navigation.navigate('Pricings'),
          description: 'Upgrade or manage subscription plans',
        },
        {
          title: 'Our Products',
          icon: 'package-variant-closed',
          onPress: () => navigation.navigate('OurProduct'),
          description: 'Explore offerings from our team',
        },
      ],
    },
    {
      title: 'App',
      data: [
        {
          title: 'Settings',
          icon: 'cog',
          onPress: () => navigation.navigate('Settings'),
          description: 'App preferences, security and integrations',
        },
        {
          title: 'How to Use',
          icon: 'play-circle',
          onPress: () => navigation.navigate('Tutorial'),
          description: 'Guides and short walkthroughs',
        },
        {
          title: 'Give Feedback',
          icon: 'message-draw',
          onPress: () => navigation.navigate('Feedback'),
          description: 'Report bugs or suggest improvements',
        },
      ],
    },

    {
      title: 'Support',
      data: [
        {
          title: 'Help & Support',
          icon: 'help-circle',
          onPress: () => navigation.navigate('Help'),
          description: 'Contact support and FAQs',
        },
        {
          title: 'Privacy Policy',
          icon: 'shield-account',
          onPress: () => openTermsBottomSheet(),
          description: 'Our data and privacy practices',
        },
      ],
    },

    {
      data: [
        {
          title: 'Logout',
          icon: 'logout',
          onPress: handleLogout, // unchanged (still uses confirmation handler)
          description: 'Sign out of your account',
          color: theme.colors.error,
          disabled: loading,
        },
      ],
    },
  ];

  useEffect(() => {
    if (user) {
      calculateProfileProgress(user);
    }
  }, [user]);

  const calculateProfileProgress = data => {
    try {
      const store = data.store || {};
      const address = store.address || {};
      const bankDetails = store.bankDetails || {};
      const settings = store.settings || {};

      // IMPORTANT → fields to be counted
      const fields = [
        data.name,
        data.email,
        data.phone,

        store.name,
        store.gstNumber,
        store.contactNo,
        store.email,
        store.tagline,

        address.street,
        address.city,
        address.state,
        address.country,
        address.postalCode,

        bankDetails.bankName,
        bankDetails.accountNo,
        bankDetails.holderName,
        bankDetails.ifsc,
        bankDetails.branch,
        bankDetails.upiId,

        settings.invoicePrefix,
        settings.invoiceTerms,
        settings.invoiceStartNumber,
      ];

      const total = fields.length;
      const filled = fields.filter(f => f && f.toString().trim() !== '').length;

      const percent = Math.round((filled / total) * 100);

      setProfileProgress(percent);
    } catch (error) {
      console.error('Error calculating profile progress:', error);
    }
  };

  const getProgressColor = () => {
    if (profileProgress < 30) return theme.colors.error; // Red
    if (profileProgress < 70) return theme.colors.tertiary; // Yellow/Amber type
    return theme.colors.primary; // Green/Blue (your theme primary)
  };

  // Render individual menu item
  const renderMenuItem = ({ item, index, section }) => (
    <View>
      <List.Item
        title={item.title}
        description={item.description}
        left={props => (
          <List.Icon
            {...props}
            icon={item.icon}
            color={item.color || theme.colors.primary}
          />
        )}
        onPress={item.onPress}
        disabled={item.disabled}
        titleStyle={{ color: item.color || theme.colors.onSurface }}
        descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
        style={styles.listItem}
      />
      {index < section.data.length - 1 && (
        <Divider style={{ marginLeft: 16 }} />
      )}
    </View>
  );

  // Render section header
  const renderSectionHeader = ({ section }) => (
    <Text
      variant="titleSmall"
      style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}
    >
      {section.title}
    </Text>
  );

  // Render each section
  const renderSection = ({ item: section }) => (
    <View style={styles.section}>
      {renderSectionHeader({ section })}
      <View
        style={[
          styles.sectionContent,
          {
            backgroundColor: theme.colors.elevation.level1,
            marginHorizontal: 16,
          },
        ]}
      >
        <FlatList
          data={section.data.filter(Boolean)}
          renderItem={({ item, index }) =>
            renderMenuItem({ item, index, section })
          }
          keyExtractor={(item, index) => `${section.title}-${index}`}
          scrollEnabled={false}
        />
      </View>
    </View>
  );

  // Header component
  const ListHeaderComponent = () => (
    <>
      {/* User Profile Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.colors.primaryContainer },
        ]}
        elevation={2}
      >
        <TouchableOpacity
          style={styles.userInfo}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Profile')}
        >
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              // width: '25%',
            }}
          >
            <PieChart
              donut
              radius={35}
              innerRadius={28}
              animationDuration={1000}
              innerCircleColor={theme.colors.primaryContainer}
              isAnimated
              // extraRadius={10}
              data={[
                { value: profileProgress, color: getProgressColor() },
                { value: 100 - profileProgress, color: '#E0E0E0' },
              ]}
              centerLabelComponent={() => (
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: theme.colors.primary,
                  }}
                >
                  {profileProgress}%
                </Text>
              )}
            />
            <Text
              variant="labelSmall"
              style={{ textAlign: 'center', marginTop: 4, fontSize: 10 }}
            >
              Profile Completion
            </Text>
          </View>

          <View style={styles.userDetails}>
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onSurface }}
            >
              {user?.name || 'User Name'}
            </Text>

            {user?.email && (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Icon source={'email'} size={14} />
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {user?.email}
                </Text>
              </View>
            )}

            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Icon source={'phone'} size={14} />
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {user?.phone || '9876543210'}
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                marginTop: 4,
              }}
            >
              <Icon
                source={planInfo.icon}
                size={14}
                color={planInfo.iconColor}
              />
              <TouchableOpacity
                onPress={() => navigation.navigate('Pricings')}
                activeOpacity={0.7}
              >
                <Text
                  variant="bodySmall"
                  style={{
                    color: planInfo.textColor,
                    fontWeight:
                      subscription && subscription.planName !== 'Free'
                        ? '600'
                        : '400',
                  }}
                >
                  {planInfo.planName}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* <CarouselSlider /> */}
    </>
  );

  // Footer component
  const ListFooterComponent = () => (
    <Text
      variant="bodySmall"
      style={[styles.versionText, { color: theme.colors.onSurfaceVariant }]}
    >
      App Version {appVersion}
    </Text>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* <View
        style={[
          styles.brandingHeader,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <View style={styles.brandingContent}>
          <Image
            source={require('../../assets/images/applogo.png')}
            style={styles.appLogo}
            resizeMode="contain"
          />
          <View style={styles.appNameContainer}>
            <Text
              variant="headlineSmall"
              style={[styles.appName, { color: theme.colors.onSurface }]}
            >
              AMDAANI
            </Text>
            <Text
              variant="bodySmall"
              style={[
                styles.appTagline,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Billing Management
            </Text>
          </View>
        </View>
      </View> */}
      <FlatList
        data={menuSections}
        renderItem={renderSection}
        keyExtractor={(item, index) => `section-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
      />

      {/* Existing alert (keep if needed for other purposes) */}
      <CustomAlert
        visible={alertVisible}
        onDismiss={() => setAlertVisible(false)}
        title="Discard changes?"
        message="Are you sure you want to discard all changes and exit?"
        type="warning"
        actions={[
          {
            label: 'No',
            mode: 'outlined',
            color: theme.colors.primary,
            onPress: () => setAlertVisible(false),
          },
          {
            label: 'Yes',
            mode: 'contained',
            color: theme.colors.error,
            onPress: () => {
              setAlertVisible(false);
              // formikRef.current?.resetForm(); // Uncomment if needed
              navigation.goBack();
            },
          },
        ]}
      />

      {/* Logout Confirmation Alert */}
      <CustomAlert
        visible={logoutAlertVisible}
        onDismiss={() => setLogoutAlertVisible(false)}
        title="Confirm Logout"
        message="Are you sure you want to logout from your account?"
        type="warning"
        actions={[
          {
            label: 'No',
            mode: 'outlined',
            color: theme.colors.primary,
            onPress: () => setLogoutAlertVisible(false),
          },
          {
            label: 'Yes',
            mode: 'contained',
            color: theme.colors.error,
            onPress: confirmLogout,
          },
        ]}
      />
      <TermsBottomSheet ref={termsSheetRef} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  brandingHeader: {
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  brandingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appLogo: {
    width: 45,
    height: 45,
    borderRadius: 12,
    marginRight: 12,
    resizeMode: 'contain',
  },
  appNameContainer: {
    flex: 1,
  },
  appName: {
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: 'BagelFatOne-Regular',
  },
  appTagline: {
    opacity: 0.8,
  },
  header: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: '2%',
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userDetails: {
    marginLeft: 16,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 8,
    marginLeft: '5%',
    fontWeight: '500',
    opacity: 0.7,
  },
  sectionContent: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  listItem: {
    paddingVertical: 10,
  },
  versionText: {
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.6,
  },
});

export default Menu;
