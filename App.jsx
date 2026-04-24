import React, { useEffect, useState } from 'react';
import { AppState, BackHandler, StatusBar } from 'react-native';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AuthNavigator from './src/navigation/AuthNavigator';
import TabNavigator from './src/navigation/TabNavigator';
import AddItem from './src/screens/item/AddItem';
import AddItems from './src/screens/sales/AddItems';
import ItemDetails from './src/screens/item/ItemDetails';
import NewSale from './src/screens/sales/NewSale';
import AddNewParty from './src/screens/party/AddNewParty';
import PartyList from './src/screens/party/PartyList';
import InvoiceDetail from './src/screens/InvoiceDetail';
import PrintPreference from './src/screens/print/PrintPreference';
import Profile from './src/screens/profile/Profile';
import PricingCard from './src/screens/plans/pricings';
import ReviewOrder from './src/screens/plans/revieworder';
import PaymentOptions from './src/screens/plans/paymentoptions';
import Settings from './src/screens/menu/settings';
import HelpSupport from './src/screens/menu/help';
import SplashScreen from './src/screens/SplashScreen';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useThemeContext } from './src/context/ThemeContext';
import { navigationRef } from './src/navigation/navigation';
import { toastConfig } from './src/utils/toastConfig';
import PaymentScreen from './src/screens/plans/paymentscreen';
import PaymentSuccess from './src/screens/payments/PaymentSuccess';
import PaymentFailure from './src/screens/payments/PaymentFailure';
import Transactions from './src/screens/menu/Transactions';
import { AppLockProvider } from './src/context/AppLockContext';
import AppLockGate from './src/components/AppLockGate';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import SalesReport from './src/screens/report/SalesReport';
import ReportScreen from './src/screens/report/ReportScreen';
import ProductReport from './src/screens/report/ProductReport';

import { OneSignal, LogLevel } from 'react-native-onesignal';
import NetworkBanner from './src/components/NetworkBanner';
import { PermissionAlertProvider } from './src/context/PermissionAlertProvider';
import PlanTransactions from './src/screens/plans/PlanTransactions';
import OnboardingScreen from './src/components/OnboardingScreen';
import { Printer } from './src/native/Printer';
import Feedback from './src/screens/menu/Feedback';
import DueInvoiceDetails from './src/screens/party/DueInvoiceDetails';
import InvoiceTransactions from './src/screens/sales/InvoiceTransactions';
import ProductWiseSalesReport from './src/screens/report/ProductWiseSales';
import ExpenseHead from './src/screens/menu/ExpenseHead';
import Expenses from './src/screens/menu/Expenses';
import Tutorial from './src/screens/menu/Tutorial';
import ExpenseHeadReport from './src/screens/report/ExpenseHeadReport';
import TagTutorial from './src/screens/menu/TagTutorial';
import OurProduct from './src/screens/OurProduct/OurProduct';
import VendorList from './src/screens/vendor/VendorList';
import AddNewVendor from './src/screens/vendor/AddNewVendor';
import Purchase from './src/screens/Purchase/Purchase';
import AdjustStock from './src/screens/item/Stocks';
import StockTransactionScreen from './src/screens/item/StocksTransactions';
import PurchaseDetail from './src/screens/PurchaseDetail';
import AllTransactions from './src/screens/menu/AllTransactions';
import VendorDueDetails from './src/screens/vendor/VendorDueDetails';
import Item from './src/screens/item/Item';
import UsersList from './src/screens/menu/UserList';
import GstReport from './src/screens/report/GstReport';
import AddPurchaseItems from './src/screens/Purchase/AddPurchaseItems';
import AddPurchaseItem from './src/screens/Purchase/AddPurchaseItem';
import ProfitLossReport from './src/screens/report/ProfitLossReport';
import StockReport from './src/screens/report/StockReport';

const Stack = createStackNavigator();

function RootNavigator() {
  const { loading, authState } = useAuth();
  const { theme } = useThemeContext();
  //   const [showSplash, setShowSplash] = useState(true);

  //   // Show splash for at least 2 seconds
  //   useEffect(() => {
  //     const timer = setTimeout(() => {
  //       setShowSplash(false);
  //     }, 2000);

  //     return () => clearTimeout(timer);
  //   }, []);

  //   // Show splash if either loading or forced splash duration
  // if (loading) {
  //   return <SplashScreen />;
  // }

  return (
    <>
      <StatusBar
        barStyle={theme.dark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animationEnabled: true,
          animationTypeForReplace: 'push',
          presentation: 'modal',
          cardStyleInterpolator: ({ current, layouts }) => ({
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
          }),
        }}
        initialRouteName={authState.isAuthenticated ? 'MainTabs' : 'Auth'}
      >
        <Stack.Screen name="Auth" component={AuthNavigator} />
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen name="AddItem" component={AddItem} />
        <Stack.Screen name="ItemDetails" component={ItemDetails} />
        <Stack.Screen name="NewSale" component={NewSale} />
        <Stack.Screen name="AddParty" component={AddNewParty} />
        <Stack.Screen name="AddItemSales" component={AddItems} />
        <Stack.Screen name="InvoiceDetail" component={InvoiceDetail} />
        <Stack.Screen name="PrintPreference" component={PrintPreference} />
        <Stack.Screen name="PartyList" component={PartyList} />
        <Stack.Screen name="Itemlist" component={Item} />
        <Stack.Screen name="Pricings" component={PricingCard} />
        <Stack.Screen name="ReviewOrder" component={ReviewOrder} />
        <Stack.Screen name="PaymentOptions" component={PaymentOptions} />
        <Stack.Screen name="Settings" component={Settings} />
        <Stack.Screen name="Help" component={HelpSupport} />
        <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
        <Stack.Screen name="PaymentSuccess" component={PaymentSuccess} />
        <Stack.Screen name="PaymentFailure" component={PaymentFailure} />
        <Stack.Screen name="Transactions" component={Transactions} />
        <Stack.Screen name="PlanTransactions" component={PlanTransactions} />
        <Stack.Screen name="DueInvoiceDetails" component={DueInvoiceDetails} />
        <Stack.Screen name="AllTransactions" component={AllTransactions} />
        <Stack.Screen name="VendorDueDetails" component={VendorDueDetails} />
        <Stack.Screen name="Expenses" component={Expenses} />
        <Stack.Screen name="Tutorial" component={Tutorial} />
        <Stack.Screen name="TagTutorial" component={TagTutorial} />
        <Stack.Screen name="ExpenseHeadReport" component={ExpenseHeadReport} />
        <Stack.Screen name="PurchaseDetail" component={PurchaseDetail} />
        <Stack.Screen name="GstReport" component={GstReport} />
        <Stack.Screen name="UserList" component={UsersList} />
        <Stack.Screen name="AddPurchaseItems" component={AddPurchaseItems} />
        <Stack.Screen name="AddPurchaseItem" component={AddPurchaseItem} />
        <Stack.Screen
          name="InvoiceTransactions"
          component={InvoiceTransactions}
        />
        <Stack.Screen
          name="ProductWiseSalesReport"
          component={ProductWiseSalesReport}
        />
        <Stack.Screen name="Stocks" component={AdjustStock} />
        <Stack.Screen
          name="StockTransactionScreen"
          component={StockTransactionScreen}
        />
        <Stack.Screen name="OurProduct" component={OurProduct} />
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Profile"
          component={Profile}
          options={{
            presentation: 'modal',
            animationTypeForReplace: 'push',
            cardStyleInterpolator: ({ current, layouts }) => ({
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-layouts.screen.width, 0],
                    }),
                  },
                ],
              },
            }),
          }}
        />
        <Stack.Screen name="Report" component={ReportScreen} />
        <Stack.Screen name="SalesReport" component={SalesReport} />
        <Stack.Screen name="ProductReport" component={ProductReport} />
        <Stack.Screen name="ProfitLossReport" component={ProfitLossReport} />
        <Stack.Screen name="Feedback" component={Feedback} />
        <Stack.Screen name="VendorList" component={VendorList} />
        <Stack.Screen name="AddVendor" component={AddNewVendor} />
        <Stack.Screen name="Purchase" component={Purchase} />
        <Stack.Screen name="StockReport" component={StockReport} />
      </Stack.Navigator>
      <Toast config={toastConfig} />
    </>
  );
}

function App() {
  useEffect(() => {
    // Run auto reconnect once when app starts
    Printer.autoReconnectOnStartup();

    // Optionally, recheck when app returns from background
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        Printer.autoReconnectOnStartup();
      }
    });

    return () => subscription.remove();
  }, []);

  // Enable verbose logging for debugging (remove in production)
  // OneSignal.Debug.setLogLevel(LogLevel.Verbose);
  // Initialize with your OneSignal App ID
  OneSignal.initialize('9407f3f6-b54a-492a-a5c1-eb57a77fb330');
  // Use this method to prompt for push notifications.
  return (
    <ThemeProvider>
      <AppWithTheme />
    </ThemeProvider>
  );
}
// const linking = {
//   prefixes: ['billing://'],
//   config: {
//     screens: {
//       PaymentSuccess: 'payment-success',
//       PaymentFailure: 'payment-failure',
//     },
//   },
// };
const linking = {
  prefixes: [
    'billing://',
    'https://amptechnology.in',
    'https://www.amptechnology.in',
  ],
  config: {
    screens: {
      PaymentSuccess: 'payment-success',
      PaymentFailure: 'payment-failure',
      OurProduct: {
        path: 'our-products/:id?', // ← add ":id?" to support optional ID param
        parse: {
          id: id => id ?? null, // safely parse ID
        },
      },
    },
  },
};

// separate wrapper to consume theme context
function AppWithTheme() {
  const { theme } = useThemeContext();
  return (
    <PaperProvider theme={theme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <PermissionAlertProvider>
            <AuthProvider>
              <AuthAwareApp />
              <NetworkBanner />
              <Toast config={toastConfig} />
            </AuthProvider>
          </PermissionAlertProvider>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </PaperProvider>
  );
}

function AuthAwareApp() {
  const { authState } = useAuth();
  const navRef = useNavigationContainerRef();

  useEffect(() => {
    const backAction = () => {
      if (!navRef.isReady()) return false;

      const state = navRef.getRootState();
      const currentRoute = navRef.getCurrentRoute()?.name;

      // 🧠 If app was opened via deep link (cold start) and only 1 route is present
      if (state.routes.length === 1 && currentRoute === 'OurProduct') {
        // Go back to MainTabs instead of exiting or crashing
        navRef.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
        return true;
      }

      return false; // allow normal back
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );
    return () => backHandler.remove();
  }, [navRef]);

  return authState.isAuthenticated ? (
    <AppLockProvider>
      <AppLockGate>
        <NavigationContainer ref={navRef} linking={linking}>
          <RootNavigator />
        </NavigationContainer>
      </AppLockGate>
    </AppLockProvider>
  ) : (
    <NavigationContainer ref={navRef} linking={linking}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default App;
