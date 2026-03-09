import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { Linking, Platform } from 'react-native';

const PaymentScreen = ({ route }) => {
  const { paymentUrl, formData } = route.params;
  const navigation = useNavigation();

  // Generate HTML form that auto-submits
  const htmlContent = `
    <html>
      <body onload="document.forms[0].submit()">
        <form action="${paymentUrl}" method="post">
          ${Object.keys(formData)
      .map(
        key =>
          `<input type="hidden" name="${key}" value="${formData[key]}" />`,
      )
      .join('')}
        </form>
      </body>
    </html>
  `;

  // Handle navigation state changes
  const handleNavigationStateChange = navState => {
    // console.log('Navigation URL:', navState.url);

    // Check if URL contains our deep link scheme
    if (navState.url.includes('billing://')) {
      // Extract parameters from URL
      const url = new URL(navState.url);
      const txnid = url.searchParams.get('txnid');
      const amount = url.searchParams.get('amount');
      const status = url.searchParams.get('status');

      // console.log('Deep link detected:', { txnid, amount, status });

      // Navigate to appropriate screen
      if (navState.url.includes('payment-success')) {
        navigation.replace('PaymentSuccess', {
          txnid,
          amount,
          status,
        });
      } else if (navState.url.includes('payment-failure')) {
        navigation.replace('PaymentFailure', {
          txnid,
          amount,
          status,
        });
      }

      // Stop WebView from loading the deep link
      return false;
    }

    return true;
  };

  // Handle URL loading - intercept deep links
  const handleShouldStartLoadWithRequest = request => {
    const url = request.url;
    // console.log('Loading URL:', url);

    // Handle deep link redirects (billing://)
    if (url.includes('billing://')) {
      const parsedUrl = new URL(url);
      const txnid = parsedUrl.searchParams.get('txnid');
      const amount = parsedUrl.searchParams.get('amount');
      const status = parsedUrl.searchParams.get('status');

      if (url.includes('payment-success')) {
        navigation.replace('PaymentSuccess', { txnid, amount, status });
      } else if (url.includes('payment-failure')) {
        navigation.replace('PaymentFailure', { txnid, amount, status });
      }
      return false;
    }

    // 🧩 Handle UPI / Intent URLs
    if (url.startsWith('upi:') || url.startsWith('intent:')) {
      try {
        // Open external app (GPay, PhonePe, etc.)
        Linking.openURL(url).catch(err => {
          // console.log('Error opening UPI intent:', err);
        });
      } catch (e) {
        // console.log('Linking error:', e);
      }
      return false;
    }

    return true;
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        startInLoadingState
        javaScriptEnabled
        setBuiltInZoomControls
        domStorageEnabled
        setSupportMultipleWindows
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        mixedContentMode="always"
        renderLoading={() => (
          <View
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          >
            <ActivityIndicator size="large" color="blue" />
          </View>
        )}
      />
    </SafeAreaView>
  );
};

export default PaymentScreen;
