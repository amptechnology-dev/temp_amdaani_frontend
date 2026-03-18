import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Pressable, Image } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FAB, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import CustomTabBar from './CustomTabBar';
import HomeScreen from '../screens/home/HomeScreen';
import AppHeader from '../components/AppHeader';
import Item from '../screens/item/Item';
import Dashboard from '../screens/dashboard/Dashboard';
import Menu from '../screens/menu/Menu';
import SubscriptionMessageBottomSheet from '../components/BottomSheet/SubscriptionMessegeBottomSheet';
import { useAuth, permissions } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import api from '../utils/api';
import Toast from 'react-native-toast-message';

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const navigation = useNavigation();
  const theme = useTheme();
  const { authState, hasPermission, isPurchaseOrderEnabled } = useAuth();
  const user = authState?.user;
  const store = authState?.user?.store;
  const [fabOpen, setFabOpen] = useState(false);

  // Subscription related states
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [showSubscriptionSheet, setShowSubscriptionSheet] = useState(false);
  const subscriptionSheetRef = useRef(null);

  const [subscriptionMessage, setSubscriptionMessage] = useState(
    "You don't have any active plan. Choose one of the options below to continue using the app.",
  );

  // Overlay animation
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Action buttons animations (array for staggered effects)
  const actionAnimations = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  // Check subscription status
  // Check subscription status
  const checkSubscriptionStatus = async () => {
    try {
      // console.log('🔍 Checking subscription status...');

      const response = await api.get('/subscription/get-active-subscriptions');
      // console.log('Subscription API Response:', response);

      // If API succeeded but no active subscription found
      if (response.success && !response.data) {
        // console.log('⚠️ No active subscription found for this store');
        setCurrentSubscription(null);
        setSubscriptionMessage(
          "You don't have any active plan. Choose one of the options below to continue using the app.",
        );
        try {
          const lastResponse = await api.get(
            '/subscription/get-last-subscription',
          );
          // console.log('Last Subscription API Response:', lastResponse);
          if (lastResponse.success && lastResponse.data) {
            setCurrentSubscription(lastResponse.data);
          }
        } catch (err) {
          // console.log('❌ Error fetching last subscription:', err.message);
        }
        // Toast.show({
        //   type: 'info',
        //   text1: 'No Active Subscription',
        //   text2: 'Please choose a plan to continue using the app.',
        // });
        navigation.navigate('Pricings');
        setShowSubscriptionSheet(true);

        setTimeout(() => {
          if (subscriptionSheetRef.current) {
            requestAnimationFrame(() => {
              subscriptionSheetRef.current?.present?.();
            });
          } else {
            console.warn('Bottom sheet ref not ready yet');
          }
        }, 300);
        return;
      }

      // Extract subscription info if available
      const sub = response.data?.subscription;
      if (response.success && sub) {
        const now = new Date();
        const endDate = new Date(sub.endDate);
        const isExpired =
          !sub.status || sub.status !== 'active' || endDate < now;

        if (isExpired) {
          // console.log('⚠️ Subscription expired or inactive');
          setCurrentSubscription(null);
          setSubscriptionMessage(
            'Your plan has expired. Please renew to continue Invoice generation.',
          );

          try {
            const lastResponse = await api.get(
              '/subscription/get-last-subscription',
            );
            // console.log('Last Subscription API Response:', lastResponse);
            if (lastResponse.success && lastResponse.data) {
              setCurrentSubscription(lastResponse.data);
            }
          } catch (err) {
            // console.log('❌ Error fetching last subscription:', err.message);
          }
          setShowSubscriptionSheet(true);

          setTimeout(() => {
            if (subscriptionSheetRef.current) {
              requestAnimationFrame(() => {
                subscriptionSheetRef.current?.present?.();
              });
            } else {
              console.warn('Bottom sheet ref not ready yet');
            }
          }, 300);
        } else {
          // console.log('✅ Active subscription found:', sub);
          setCurrentSubscription(sub);
          setShowSubscriptionSheet(false);
          subscriptionSheetRef.current?.close?.();
        }
        return;
      }

      // If success but response structure unexpected
      // console.log('⚠️ Unexpected subscription response structure');
      setCurrentSubscription(null);
      setSubscriptionMessage(
        'Unable to verify your subscription. Please check again or view plans.',
      );
      setShowSubscriptionSheet(true);
      navigation.navigate('Pricings');
      setTimeout(() => {
        if (subscriptionSheetRef.current) {
          requestAnimationFrame(() => {
            subscriptionSheetRef.current?.present?.();
          });
        } else {
          console.warn('Bottom sheet ref not ready yet');
        }
      }, 300);
    } catch (error) {
      // console.log('❌ Error checking subscription status:', error.message);

      // Do NOT show subscription sheet for network errors
      if (
        error.message.includes('Network Error') ||
        error.message.includes('timeout') ||
        error.response === undefined
      ) {
        // console.log('🌐 Network issue — not showing subscription sheet');
        return;
      }

      // For server errors (non-network)
      // console.log('⚠️ Server error — showing subscription sheet fallback');
      setCurrentSubscription(null);
      setSubscriptionMessage(
        'Unable to verify your plan at the moment. Please check again later.',
      );
      setShowSubscriptionSheet(true);
      setTimeout(() => {
        if (subscriptionSheetRef.current) {
          requestAnimationFrame(() => {
            subscriptionSheetRef.current?.present?.();
          });
        } else {
          console.warn('Bottom sheet ref not ready yet');
        }
      }, 300);
    }
  };

  // Check subscription when tab navigator comes into focus
  // useFocusEffect(
  //   React.useCallback(() => {
  //     checkSubscriptionStatus();
  //   }, []),
  // );
  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  // Handle successful subscription actions
  const handleSubscriptionSuccess = () => {
    setShowSubscriptionSheet(false);
    // Recheck subscription status after successful action
    setTimeout(() => {
      checkSubscriptionStatus();
    }, 1000);
  };

  useEffect(() => {
    if (fabOpen) {
      // Show overlay
      Animated.timing(overlayOpacity, {
        toValue: 0.5,
        duration: 100,
        useNativeDriver: true,
      }).start();

      // Animate buttons one by one
      Animated.stagger(
        50,
        actionAnimations.map(anim =>
          Animated.spring(anim, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
          }),
        ),
      ).start();
    } else {
      // Hide overlay
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();

      // Hide all buttons together
      actionAnimations.forEach(anim =>
        Animated.timing(anim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }).start(),
      );
    }
  }, [fabOpen]);

  // Coordinates for circular spread (semi-circle above main FAB)
  // Angles: top, left-up, right-up
  const angles = [270, 220, 320];

  // Individual radii (top = far, sides = closer)
  const radii = [130, 110, 110];
  // index 0 = top (Sales Invoice), index 1 = left, index 2 = right

  const ActionButton = ({ index, icon, label, onPress }) => {
    const anim = actionAnimations[index];
    const angle = (angles[index] * Math.PI) / 180;

    // Pre-calculate final positions (no animation delay for layout)
    const finalX = radii[index] * Math.cos(angle);
    const finalY = radii[index] * Math.sin(angle);

    // Animate only scale + opacity
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 1],
    });
    const opacity = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    const handleActionPress = () => {
      if (!currentSubscription && showSubscriptionSheet) {
        if (subscriptionSheetRef.current) {
          requestAnimationFrame(() => {
            subscriptionSheetRef.current?.present?.();
          });
        } else {
          console.warn('Bottom sheet ref not ready yet');
        }
      }
      onPress();
      setFabOpen(false);
    };

    return (
      <Animated.View
        style={[
          styles.fabActionWrapper,
          {
            // Buttons are always at their final location
            transform: [
              { translateX: finalX },
              { translateY: finalY },
              { scale },
            ],
            opacity,
          },
        ]}
        pointerEvents={fabOpen ? 'auto' : 'none'}
      >
        <FAB
          variant="primary"
          customSize={48}
          icon={icon}
          label={label}
          color={'white'}
          style={[styles.fabAction, { backgroundColor: theme.colors.primary }]}
          onPress={handleActionPress}
        />
      </Animated.View>
    );
  };

  const handleRenewPlan = async transformedPlan => {
    // Custom navigation logic
    navigation.navigate('ReviewOrder', {
      plan: transformedPlan,
    });
    setShowSubscriptionSheet(false);
    // Or any other custom logic
  };

  console.log('-->', user);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          header: () => (
            <AppHeader
              showSettings
              showAvataronRight
              logoUrl={user?.store?.logoUrl}
              avatarUri={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                store?.name || 'User',
              )}&background=random`}
              onSettingsPress={() => {
                navigation.navigate('Settings');
              }}
              customLeftContent={
                <View style={styles.brandingContent}>
                  <View style={styles.appNameContainer}>
                    <Text
                      variant="titleLarge"
                      style={[
                        styles.appName,
                        { color: theme.colors.onSurface },
                      ]}
                    >
                      AMDAANI
                    </Text>
                  </View>
                </View>
              }
            />
          ),
        })}
        tabBar={props => (
          <CustomTabBar {...props} fabOpen={fabOpen} setFabOpen={setFabOpen} />
        )}
      >
        <Tab.Screen name="Dashboard" component={Dashboard} />
        <Tab.Screen name="Invoice" component={HomeScreen} />
        <Tab.Screen
          name="Add"
          component={() => <View />}
          options={{ tabBarLabel: '' }}
          listeners={{
            tabPress: e => e.preventDefault(),
          }}
        />
        <Tab.Screen name="Item" component={Item} />
        <Tab.Screen
          name="Menu"
          component={Menu}
          options={{
            header: () => (
              <AppHeader
                title={`${user?.store?.name}`}
                tagline={`${user?.store?.tagline}`}
                logoUrl={user?.store?.logoUrl}
                avatarUri={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                  store?.name || 'User',
                )}&background=random`}
                showAvatar
                // showBell
                // showSettings
                onBellPress={() => {}}
                onSettingsPress={() => {
                  navigation.navigate('Settings');
                }}
              />
            ),
          }}
        />
      </Tab.Navigator>

      {/* Overlay */}
      {fabOpen && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setFabOpen(false)}
          pointerEvents="box-only"
          android_ripple={{ color: 'transparent' }}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: '#000', opacity: overlayOpacity },
            ]}
          />
        </Pressable>
      )}

      {/* Animated FAB Actions */}
      <View style={styles.fabGroupActionsContainer} pointerEvents="box-none">
        <View style={styles.fabGroupActions}>
          <ActionButton
            index={1}
            icon="package-variant-plus"
            label="Create Item"
            onPress={() => {
              console.log('ta');
              if (hasPermission(permissions.CAN_MANAGE_PRODUCTS)) {
                navigation.navigate('AddItem');
              } else {
                Toast.show({
                  type: 'error',
                  text1: 'Permission Denied',
                  text2: 'You do not have permission to create items.',
                });
              }
            }}
          />
          <ActionButton
            index={0}
            icon="invoice-plus"
            label="Create Invoice"
            onPress={() => {
              if (hasPermission(permissions.CAN_CREATE_INVOICES)) {
                navigation.navigate('NewSale');
              } else {
                Toast.show({
                  type: 'error',
                  text1: 'Permission Denied',
                  text2: 'You do not have permission to create invoices.',
                });
              }
            }}
          />
          {isPurchaseOrderEnabled ? (
            <ActionButton
              index={2}
              icon="cart-plus"
              label="Create Purchase"
              onPress={() => {
                if (hasPermission(permissions.CAN_CREATE_PURCHASES)) {
                  navigation.navigate('Purchase');
                } else {
                  Toast.show({
                    type: 'error',
                    text1: 'Permission Denied',
                    text2:
                      'You do not have permission to create purchase orders.',
                  });
                }
              }}
            />
          ) : (
            <ActionButton
              index={2}
              icon="account-plus"
              label="Create Customer"
              onPress={() => navigation.navigate('AddParty')}
            />
          )}
        </View>
      </View>
      {/* {showSubscriptionSheet ? (
        <SubscriptionMessageBottomSheet
          ref={subscriptionSheetRef}
          title="Subscription"
          message={subscriptionMessage}
          checkoutPlansText="View Plans"
          continueWithFreeText="Continue with Free"
         
          onCheckoutPlans={async () => {
          
            navigation.navigate('Pricings');
            setShowSubscriptionSheet(false);
          }}
          onContinueWithFree={async () => {
            try {
              const response = await api.post('/subscription/get-free');
              if (response.success) {
              
                handleSubscriptionSuccess();
              }
            } catch (error) {
              console.error('Error activating free subscription:', error);
             
            }
          }}
          onRenewPlan={handleRenewPlan}
          renewCardData={currentSubscription}
         
        />
      ) : null} */}
    </View>
  );
};

const styles = StyleSheet.create({
  fabGroupActionsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    pointerEvents: 'box-none',
  },
  fabGroupActions: {
    position: 'relative',
    width: 100, // ensure space for arc spread
    height: 100,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  fabActionWrapper: {
    position: 'absolute',
  },
  fabAction: {
    minWidth: 120,
    borderRadius: 50,
    elevation: 8,
  },
  brandingHeader: {
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  brandingContent: {
    flexShrink: 1,
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
});

export default TabNavigator;
