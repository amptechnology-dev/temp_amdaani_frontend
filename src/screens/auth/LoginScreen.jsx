import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { TextInput, Text, useTheme, Button, Icon } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OtpInput } from 'react-native-otp-entry';
import { useAuth } from '../../context/AuthContext';
import {
  startOtpListener,
  removeListener,
  getHash,
} from 'react-native-otp-verify';
import LottieView from 'lottie-react-native';
import LinearGradient from 'react-native-linear-gradient';
import TermsBottomSheet from '../../components/BottomSheet/TermsBottomSheet';
import { resetToMainTabs } from '../../navigation/navigation';

const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const { sendOtp, verifyOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [timer, setTimer] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const otpRef = useRef(null);
  const lottieRef = useRef(null);
  const termsSheetRef = useRef(null);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showAcceptButton, setShowAcceptButton] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const validatePhone = phone => {
    if (!phone || phone.trim() === '') {
      return 'Phone number is required';
    }
    const phoneRegex = /^[6-9][0-9]{9}$/;
    if (!phoneRegex.test(phone)) {
      return 'Invalid phone number';
    }
    return null;
  };

  // useEffect(() => {
  //   getHash()
  //     .then(hash => {
  //       // console.log('hash', hash);
  //     })
  //     .catch(// console.log);
  //   return;
  // }, []);

  // useEffect(() => {
  //   startOtpListener(async message => {
  //     try {
  //       const extractedOtp = /(\d{6})/g.exec(message)?.[1];
  //       if (extractedOtp) {
  //         setOtp(extractedOtp);
  //         if (otpRef.current) {
  //           otpRef.current.setValue(extractedOtp);
  //         }
  //         const enteredOtp = extractedOtp;
  //         // console.log('get otp : ', enteredOtp);
  //         await handleVerifyOtp(enteredOtp);
  //       }
  //     } catch (e) {
  //       // console.log('OTP extract error:', e);
  //     }
  //   });
  //   return () => removeListener();
  // }, []);

  useEffect(() => {
    let interval;
    if (timerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timer, timerActive]);

  const handlePhoneChange = text => {
    setPhone(text);
    if (phoneError) setPhoneError('');
  };

  const handleContinue = async () => {
    if (!showOtpInput) {
      const error = validatePhone(phone);
      if (error) return setPhoneError(error);

      setLoading(true);
      const res = await sendOtp(phone);
      setLoading(false);

      if (res.success) {
        setShowOtpInput(true);
        setTimerActive(true);
        setTimer(60);
      }
    } else {
      // Check if terms are accepted before verifying
      // if (!termsAccepted) {
      //   // Show terms with accept button
      //   setShowAcceptButton(true);
      //   termsSheetRef.current?.present();
      //   return;
      // }

      // Proceed with OTP verification
      await handleVerifyOtp(otp);
    }
  };

  const handleAcceptTerms = () => {
    setTermsAccepted(true);
    setShowAcceptButton(false);
    termsSheetRef.current?.close();

    // Automatically verify OTP after accepting terms
    handleVerifyOtp(otp);
  };

  const handleVerifyOtp = async enteredOtp => {
    setLoading(true);
    const res = await verifyOtp(phone, enteredOtp);
    setLoading(false);

    if (res.success) {
      if (res.data?.tempToken) {
        navigation.navigate('RegisterSimple', {
          tempToken: res.data.tempToken,
          phone,
        });
      }
    } else {
      setOtp('');
      if (otpRef.current) otpRef.current.setValue('');
    }
  };

  const handleBackToPhone = () => {
    setShowOtpInput(false);
    setOtp('');
    setTimerActive(false);
    setPhoneError('');
  };

  const handleResendOTP = async () => {
    const res = await sendOtp(phone);
    setTimer(60);
    setTimerActive(true);
    setOtp('');
    if (otpRef.current) otpRef.current.setValue('');
  };

  const formatTime = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const getMaskedPhone = phone => {
    if (!phone || phone.length < 4) return phone;
    return phone.replace(/.(?=.{4})/g, '*');
  };

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <LinearGradient
        colors={[
          theme.colors.secondary + 20,
          theme.colors.primary,
          theme.colors.surface,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} // ✅ Change 'height' to undefined for Android
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0} // ✅ Set to 0
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <View style={styles.appHeader}>
                <Image
                  source={require('../../assets/images/Tapplogo.png')} // Change path to your logo
                  style={styles.appLogo}
                  resizeMode="contain"
                />
                <Text
                  variant="titleLarge"
                  style={[styles.appName, { color: 'white' }]}
                >
                  AMDAANI
                </Text>
              </View>

              {/* Lottie Animation */}
              <Animated.View
                style={[
                  styles.lottieContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{ scale: scaleAnim }],
                  },
                ]}
              >
                <LottieView
                  source={require('../../assets/animations/billpayment.json')}
                  autoPlay
                  loop
                  style={styles.lottie}
                />
              </Animated.View>

              {/* Card Container */}
              <Animated.View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.primaryContainer,
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                {/* Header */}
                <View style={styles.header}>
                  <Text variant="headlineLarge" style={styles.title}>
                    Welcome to AMDAANI
                  </Text>
                  <Text variant="bodyLarge" style={styles.subtitle}>
                    {showOtpInput
                      ? `Verify OTP sent to ${getMaskedPhone(phone)}`
                      : 'Sign in to continue'}
                  </Text>
                </View>

                {/* Form */}
                <View style={styles.formContainer}>
                  {!showOtpInput ? (
                    <>
                      <View style={styles.inputWrapper}>
                        <Text variant="labelLarge" style={styles.label}>
                          Phone Number
                        </Text>
                        <TextInput
                          mode="outlined"
                          placeholder="Enter 10-digit number"
                          keyboardType="phone-pad"
                          value={phone}
                          onChangeText={handlePhoneChange}
                          maxLength={10}
                          error={!!phoneError}
                          style={[
                            styles.input,
                            { backgroundColor: theme.colors.surface },
                          ]}
                          outlineStyle={styles.inputOutline}
                          activeOutlineColor={theme.colors.primary}
                          left={
                            <TextInput.Icon
                              icon="phone"
                              color={theme.colors.primary}
                            />
                          }
                          theme={{ roundness: 12 }}
                          right={
                            phone ? (
                              <TextInput.Icon
                                icon="close-circle"
                                onPress={() => {
                                  setPhone('');
                                  setPhoneError('');
                                }}
                              />
                            ) : null
                          }
                        />
                        {phoneError ? (
                          <Text variant="bodySmall" style={styles.errorText}>
                            {phoneError}
                          </Text>
                        ) : null}
                      </View>
                    </>
                  ) : (
                    <>
                      <Text variant="labelLarge" style={styles.label}>
                        Enter OTP
                      </Text>
                      <OtpInput
                        ref={otpRef}
                        numberOfDigits={6}
                        onTextChange={text => setOtp(text)}
                        theme={{
                          containerStyle: styles.otpContainer,
                          pinCodeContainerStyle: [
                            styles.otpBox,
                            {
                              backgroundColor: theme.colors.surface,
                              borderColor: theme.colors.outline,
                            },
                          ],
                          pinCodeTextStyle: [
                            styles.otpText,
                            { color: theme.colors.onSurface },
                          ],
                          focusStickStyle: {
                            backgroundColor: theme.colors.primary,
                          },
                          focusedPinCodeContainerStyle: {
                            borderColor: '#667eea',
                            borderWidth: 2.5,
                          },
                        }}
                      />

                      <View style={styles.otpActions}>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center' }}
                          activeOpacity={0.8}
                          onPress={handleBackToPhone}
                        >
                          <Icon source="chevron-left" size={22} />
                          <Text style={styles.linkText}>Wrong number?</Text>
                        </TouchableOpacity>

                        {timerActive ? (
                          <View
                            style={[
                              styles.timerBadge,
                              { backgroundColor: theme.colors.surfaceVariant },
                            ]}
                          >
                            <Text style={styles.timerText}>
                              {formatTime(timer)}
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity onPress={handleResendOTP}>
                            <Text style={styles.linkText}>Resend OTP</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
                  )}

                  {/* Continue Button with Gradient */}
                  <TouchableOpacity
                    onPress={handleContinue}
                    disabled={
                      loading ||
                      (showOtpInput && otp.length !== 6) ||
                      (!showOtpInput && phone.length !== 10)
                    }
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[theme.colors.secondary, theme.colors.primary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.gradientButton,
                        (loading ||
                          (showOtpInput && otp.length !== 6) ||
                          (!showOtpInput && phone.length !== 10)) &&
                        styles.gradientButtonDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          { color: theme.colors.onPrimary },
                        ]}
                      >
                        {loading
                          ? 'Please wait...'
                          : showOtpInput
                            ? 'Verify & Continue'
                            : 'Send OTP'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                  <Text variant="bodySmall" style={styles.footerText}>
                    By continuing, you agree to our
                  </Text>
                  <View style={styles.footerLinks}>
                    <TouchableOpacity
                      onPress={() => {
                        setShowAcceptButton(false); // View only mode
                        termsSheetRef.current?.present();
                      }}
                    >
                      <Text
                        style={[
                          styles.footerLink,
                          { color: theme.colors.primary },
                        ]}
                      >
                        Terms & Conditions
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.footerText}> & </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowAcceptButton(false); // View only mode
                        termsSheetRef.current?.present();
                      }}
                    >
                      <Text
                        style={[
                          styles.footerLink,
                          { color: theme.colors.primary },
                        ]}
                      >
                        Privacy Policy
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>

          <TermsBottomSheet
            ref={termsSheetRef}
            showAcceptButton={showAcceptButton}
            onAccept={handleAcceptTerms}
          />
        </SafeAreaView>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Lottie
  lottieContainer: {
    height: height * 0.35,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  lottie: {
    width: width * 0.6,
    height: width * 0.6,
  },

  // Card
  card: {
    flex: 1,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 20,
    marginTop: 5,
    minHeight: height * 0.5, // ✅ ADD THIS LINE
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 25,
    elevation: 20,
  },

  // App Header (Logo & Name)
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 12,
  },
  appLogo: {
    width: 50,
    height: 50,
  },
  appName: {
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: 'BagelFatOne-Regular',
  },

  // Header
  header: {
    marginBottom: 18,
    alignItems: 'center',
  },
  title: {
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 24,
  },

  // Form
  formContainer: {
    marginBottom: 12,
  },
  inputWrapper: {
    marginBottom: 8,
  },
  label: {
    marginBottom: 10,
    fontWeight: '600',
  },
  input: {
    fontSize: 16,
  },
  inputOutline: {
    borderRadius: 16,
    borderWidth: 2,
  },
  errorText: {
    color: '#ef4444',
    marginTop: 6,
    marginLeft: 4,
  },

  // OTP
  otpContainer: {
    marginTop: 8,
    marginBottom: 12,
    gap: 4,
  },
  otpBox: {
    borderRadius: 16,
    borderWidth: 2.5,
    width: 45,
    height: 55,
  },
  otpText: {
    fontSize: 24,
    fontWeight: '700',
  },

  // OTP Actions
  otpActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
  },
  timerBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerText: {
    fontWeight: '600',
    fontSize: 14,
  },

  // Gradient Button
  gradientButton: {
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  gradientButtonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Footer
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 12,
  },
  footerText: {
    fontSize: 13,
  },
  footerLinks: {
    flexDirection: 'row',
    marginTop: 4,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default LoginScreen;
