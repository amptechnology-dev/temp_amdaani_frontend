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
import Sound from 'react-native-sound';

const { width, height } = Dimensions.get('window');

const PaymentSuccess = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { txnid, amount, recipient, date, paymentMethod } = route.params || {};

  const lottieRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Enable playback in silence mode (iOS)
    Sound.setCategory('Playback');

    // Load and play success sound
    const successSound = new Sound('success.mp3', Sound.MAIN_BUNDLE, (error) => {
      if (error) {
        // console.log('Failed to load sound', error);
        return;
      }
      // Play sound with reduced volume
      successSound.setVolume(0.5);
      successSound.play((success) => {
        if (success) {
          // console.log('Sound played successfully');
        }
        successSound.release(); // Release when done
      });
    });

    // Sequential animations
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
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Play Lottie animation
    setTimeout(() => {
      lottieRef.current?.play();
    }, 100);

    return () => {
      successSound.release(); // Cleanup
    };
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

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#25a244" />
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={['#25a244', '#2eb555', '#f8fff9']}
          locations={[0, 0.3, 1]}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Top Section - Success Icon */}
            <Animated.View
              style={[
                styles.topSection,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <View style={styles.iconContainer}>
                <View style={styles.iconCircle}>
                  <LottieView
                    ref={lottieRef}
                    source={require('../../assets/animations/Success.json')}
                    loop
                    style={styles.lottie}
                  />
                </View>
              </View>

              <Text style={styles.successTitle}>Payment Successful!</Text>
              <Text style={styles.successSubtitle}>
                Your transaction has been processed
              </Text>
            </Animated.View>

            {/* Amount Section */}
            <Animated.View
              style={[
                styles.amountSection,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Text style={styles.amountLabel}>Amount Paid</Text>
              <Text variant="displaySmall" style={styles.amountValue}>
                ₹{amount ? Number(amount).toFixed(2) : '0.00'}
              </Text>
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

                {recipient && (
                  <DetailRow
                    icon="account"
                    label="Recipient"
                    value={recipient}
                    iconColor="#25a244"
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
                {
                  paymentMethod && (
                    <DetailRow
                      icon="credit-card"
                      label="Payment Method"
                      value={paymentMethod || 'UPI'}
                      iconColor="#9C27B0"
                    />
                  )}

                <View style={styles.statusRow}>
                  <View style={styles.statusBadge}>
                    <Icon name="check-circle" size={16} color="#25a244" />
                    <Text style={styles.statusText}>Completed</Text>
                  </View>
                </View>
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
              mode="contained"
              icon="download"
              onPress={() => {
                // Download receipt logic
              }}
              style={styles.secondaryButton}
              labelStyle={styles.secondaryButtonLabel}
              contentStyle={styles.buttonContent}
            >
              Download Receipt
            </Button> */}

            <Button
              mode="contained"
              icon="check"
              onPress={() => navigation.replace('Pricings')}
              style={styles.primaryButton}
              labelStyle={styles.primaryButtonLabel}
              contentStyle={styles.buttonContent}
            >
              Done
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
    backgroundColor: '#25a244',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
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
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    textAlign: 'center',
  },
  amountSection: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  amountLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  amountValue: {
    // fontSize: 48,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
  },
  detailsCard: {
    marginHorizontal: 20,
    marginTop: 10,
  },
  surface: {
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 20,
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
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 13,
    color: '#25a244',
    fontWeight: '700',
    marginLeft: 6,
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
    backgroundColor: '#25a244',
    marginTop: 10,
  },
  primaryButtonLabel: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#fff',
  },
  secondaryButton: {
    borderRadius: 14,
    backgroundColor: '#f5f5f5',
  },
  secondaryButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#25a244',
  },
});

export default PaymentSuccess;
