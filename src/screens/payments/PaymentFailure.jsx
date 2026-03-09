import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Text, Button, Divider, Surface } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import LottieView from 'lottie-react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

const PaymentFailure = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { 
    txnid, 
    amount, 
    recipient, 
    date, 
    paymentMethod,
    errorMessage,
    errorCode 
  } = route.params || {};

  const lottieRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Shake animation for icon
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Play Lottie animation if available
    setTimeout(() => {
      lottieRef.current?.play();
    }, 100);
  }, []);

  const DetailRow = ({ icon, label, value, iconColor = '#666' }) => (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <Icon name={icon} size={20} color={iconColor} />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );

  const getErrorMessage = () => {
    if (errorMessage) return errorMessage;
    if (errorCode) {
      switch (errorCode) {
        case 'insufficient_funds':
          return 'Insufficient balance in your account';
        case 'card_declined':
          return 'Your card was declined by the bank';
        case 'network_error':
          return 'Network connection issue occurred';
        case 'timeout':
          return 'Payment request timed out';
        default:
          return 'Something went wrong with your payment';
      }
    }
    return 'Unable to process your payment';
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#E53935" />
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={['#E53935', '#EF5350', '#fff5f5']}
          locations={[0, 0.3, 1]}
          style={styles.container}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Top Section - Error Icon */}
            <Animated.View
              style={[
                styles.topSection,
                {
                  opacity: fadeAnim,
                  transform: [
                    { scale: scaleAnim },
                    { translateX: shakeAnim }
                  ],
                },
              ]}
            >
              <View style={styles.iconContainer}>
                <View style={styles.iconCircle}>
                  {/* If you have a failure Lottie animation */}
                  {/* <LottieView
                    ref={lottieRef}
                    source={require('../../assets/animations/Failure.json')}
                    loop={false}
                    style={styles.lottie}
                  /> */}
                  
                  {/* Fallback to Icon */}
                  <Icon name="close-circle-outline" size={100} color="#fff" />
                </View>
              </View>

              <Text style={styles.failureTitle}>Payment Failed</Text>
              <Text style={styles.failureSubtitle}>
                Don't worry, no money was deducted
              </Text>
            </Animated.View>

            {/* Error Message Section */}
            <Animated.View
              style={[
                styles.errorMessageSection,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.errorBanner}>
                <Icon name="alert-circle" size={24} color="#D32F2F" />
                <Text style={styles.errorText}>{getErrorMessage()}</Text>
              </View>
            </Animated.View>

            {/* Transaction Details Card */}
            <Animated.View
              style={[
                styles.detailsCard,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Surface style={styles.surface} elevation={2}>
                <Text style={styles.cardTitle}>Transaction Details</Text>
                <Divider style={styles.divider} />

                {amount && (
                  <DetailRow
                    icon="cash"
                    label="Attempted Amount"
                    value={`₹${Number(amount).toFixed(2)}`}
                    iconColor="#E53935"
                  />
                )}

                {recipient && (
                  <DetailRow
                    icon="account"
                    label="Recipient"
                    value={recipient}
                    iconColor="#666"
                  />
                )}

                {txnid && (
                  <DetailRow
                    icon="receipt"
                    label="Transaction ID"
                    value={txnid}
                    iconColor="#2196F3"
                  />
                )}

                <DetailRow
                  icon="calendar"
                  label="Date & Time"
                  value={date || new Date().toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                  iconColor="#FF9800"
                />

                {paymentMethod && (
                  <DetailRow
                    icon="credit-card"
                    label="Payment Method"
                    value={paymentMethod}
                    iconColor="#9C27B0"
                  />
                )}

                <View style={styles.statusRow}>
                  <View style={styles.statusBadge}>
                    <Icon name="close-circle" size={16} color="#E53935" />
                    <Text style={styles.statusText}>Failed</Text>
                  </View>
                </View>
              </Surface>

              {/* Help Section */}
              <Surface style={[styles.surface, styles.helpSection]} elevation={1}>
                <View style={styles.helpHeader}>
                  <Icon name="help-circle" size={22} color="#1976D2" />
                  <Text style={styles.helpTitle}>Need Help?</Text>
                </View>
                <Text style={styles.helpText}>
                  • Check your internet connection{'\n'}
                  • Verify your payment details{'\n'}
                  • Ensure sufficient balance{'\n'}
                  • Contact your bank if issue persists
                </Text>
              </Surface>
            </Animated.View>
          </ScrollView>

          {/* Bottom Actions */}
          <Animated.View
            style={[
              styles.bottomActions,
              { opacity: fadeAnim },
            ]}
          >
            {/* <Button
              mode="outlined"
              icon="phone"
              onPress={() => {
                // Contact support logic
              }}
              style={styles.secondaryButton}
              labelStyle={styles.secondaryButtonLabel}
              contentStyle={styles.buttonContent}
            >
              Contact Support
            </Button> */}

            <Button
              mode="contained"
              icon="refresh"
              onPress={() => navigation.replace('Pricings')}
              style={styles.primaryButton}
              labelStyle={styles.primaryButtonLabel}
              contentStyle={styles.buttonContent}
            >
              Try Again
            </Button>
          </Animated.View>
        </LinearGradient>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E53935',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 140,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: 120,
    height: 120,
  },
  failureTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  failureSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    textAlign: 'center',
  },
  errorMessageSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#D32F2F',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#C62828',
    fontWeight: '600',
    marginLeft: 12,
    lineHeight: 20,
  },
  detailsCard: {
    marginHorizontal: 20,
  },
  surface: {
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  divider: {
    marginBottom: 16,
    backgroundColor: '#e0e0e0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginLeft: 10,
  },
  detailValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  statusRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 13,
    color: '#E53935',
    fontWeight: '700',
    marginLeft: 6,
  },
  helpSection: {
    backgroundColor: '#E3F2FD',
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1976D2',
    marginLeft: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#0D47A1',
    lineHeight: 22,
    fontWeight: '500',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  buttonContent: {
    height: 52,
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: '#E53935',
    marginTop: 10,
  },
  primaryButtonLabel: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    borderRadius: 14,
    borderColor: '#E53935',
    borderWidth: 2,
  },
  secondaryButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E53935',
  },
});

export default PaymentFailure;
