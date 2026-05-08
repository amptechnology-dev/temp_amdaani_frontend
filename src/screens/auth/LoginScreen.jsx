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
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { TextInput, Text, useTheme, Button, Icon } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OtpInput } from 'react-native-otp-entry';
import { useAuth } from '../../context/AuthContext';
import Toast from 'react-native-toast-message';
import LottieView from 'lottie-react-native';
import LinearGradient from 'react-native-linear-gradient';
import TermsBottomSheet from '../../components/BottomSheet/TermsBottomSheet';

const { width, height } = Dimensions.get('window');

// flow steps
const STEP_PHONE = 'PHONE'; // enter phone → send OTP
const STEP_OTP = 'OTP'; // verify phone OTP
const STEP_EMAIL = 'EMAIL'; // enter email (change-number flow)
const STEP_EMAIL_OTP = 'EMAIL_OTP'; // verify email OTP
const STEP_NEW_PHONE = 'NEW_PHONE'; // enter new phone number

const LoginScreen = ({ navigation }) => {
  const {
    sendOtp,
    verifyOtp,
    sendEmailOtp,
    verifyEmailOtp,
    changePhoneNumber,
  } = useAuth();

  const [step, setStep] = useState(STEP_PHONE);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const [timer, setTimer] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [newPhoneError, setNewPhoneError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const theme = useTheme();
  const otpRef = useRef(null);
  const emailOtpRef = useRef(null);
  const lottieRef = useRef(null);
  const termsSheetRef = useRef(null);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showAcceptButton, setShowAcceptButton] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const lottieHeight = useRef(new Animated.Value(height * 0.25)).current;

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

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        Animated.timing(lottieHeight, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start();
      },
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        Animated.timing(lottieHeight, {
          toValue: height * 0.25,
          duration: 200,
          useNativeDriver: false,
        }).start();
      },
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    let interval;
    if (timerActive && timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    } else if (timer === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timer, timerActive]);

  // ─── Validators ──────────────────────────────────────────────────────────────
  const validatePhone = p => {
    if (!p || p.trim() === '') return 'Phone number is required';
    if (!/^[6-9][0-9]{9}$/.test(p)) return 'Invalid phone number';
    return null;
  };

  const validateEmail = e => {
    if (!e || e.trim() === '') return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Invalid email address';
    return null;
  };

  // ─── Input handlers ───────────────────────────────────────────────────────────
  const handlePhoneChange = text => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length <= 10) setPhone(cleaned);
    if (phoneError) setPhoneError('');
  };

  const handleNewPhoneChange = text => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length <= 10) setNewPhone(cleaned);
    if (newPhoneError) setNewPhoneError('');
  };

  const handleEmailChange = text => {
    setEmail(text);
    if (emailError) setEmailError('');
  };

  // ─── Primary Continue button handler (adapts per step) ───────────────────────
  const handleContinue = async () => {
    Keyboard.dismiss();

    if (step === STEP_PHONE) {
      const error = validatePhone(phone);
      if (error) return setPhoneError(error);
      setLoading(true);
      const res = await sendOtp(phone);
      setLoading(false);
      if (res.success) {
        setStep(STEP_OTP);
        setTimerActive(true);
        setTimer(60);
      }
    } else if (step === STEP_OTP) {
      await handleVerifyOtp(otp);
    } else if (step === STEP_EMAIL) {
      const error = validateEmail(email);
      if (error) return setEmailError(error);
      setLoading(true);
      const res = await sendEmailOtp(email); // call your API
      setLoading(false);
      if (res.success) {
        setStep(STEP_EMAIL_OTP);
        setTimerActive(true);
        setTimer(60);
      }
    } else if (step === STEP_EMAIL_OTP) {
      setLoading(true);
      const res = await verifyEmailOtp(email, emailOtp); // call your API
      setLoading(false);
      if (res.success) {
        setStep(STEP_NEW_PHONE);
      } else {
        setEmailOtp('');
        if (emailOtpRef.current) emailOtpRef.current.setValue('');
        Toast.show({
          type: 'error',
          text1: 'Invalid OTP',
          text2: 'Please enter the correct OTP sent to your email.',
          position: 'top',
          visibilityTime: 2000,
        });
      }
    } else if (step === STEP_NEW_PHONE) {
      const error = validatePhone(newPhone);
      if (error) return setNewPhoneError(error);
      setLoading(true);

      const res = await changePhoneNumber(newPhone);
      setLoading(false);

      if (res.success) {
        // ✅ Reset entire flow state
        setPhone('');
        setOtp('');
        setEmail('');
        setEmailOtp('');
        setNewPhone('');
        setNewPhoneError('');
        setPhoneError('');
        setEmailError('');
        setTimerActive(false);
        setTimer(60);
        if (otpRef.current) otpRef.current.setValue('');
        if (emailOtpRef.current) emailOtpRef.current.setValue('');

        Toast.show({
          type: 'success',
          text1: 'Number Changed!',
          text2: `Your phone number has been updated to ${newPhone}`,
          position: 'top',
          visibilityTime: 2500,
        });

        // ✅ Navigate to first step (clean login screen)
        setStep(STEP_PHONE);
      }
    }
  };

  const handleVerifyOtp = async enteredOtp => {
    setLoading(true);
    const res = await verifyOtp(phone, enteredOtp);
    setLoading(false);
    if (res.success) {
      Toast.show({
        type: 'success',
        text1: 'OTP Verified!',
        text2: 'You have successfully logged in.',
        position: 'top',
        visibilityTime: 2000,
      });
      if (res.data?.tempToken) {
        navigation.navigate('RegisterSimple', {
          tempToken: res.data.tempToken,
          phone,
        });
      }
    } else {
      setOtp('');
      if (otpRef.current) otpRef.current.setValue('');
      Toast.show({
        type: 'error',
        text1: 'Invalid OTP',
        text2: 'Please enter the correct OTP.',
        position: 'top',
        visibilityTime: 2000,
      });
    }
  };

  const handleAcceptTerms = () => {
    setTermsAccepted(true);
    setShowAcceptButton(false);
    termsSheetRef.current?.close();
    handleVerifyOtp(otp);
  };

  const handleBackToPhone = () => {
    setStep(STEP_PHONE);
    setOtp('');
    setTimerActive(false);
    setPhoneError('');
  };

  // "Change Number?" pressed — start email verify flow
  const handleChangeNumberPress = () => {
    setEmail('');
    setEmailOtp('');
    setEmailError('');
    setStep(STEP_EMAIL);
  };

  // Back from email step → back to phone entry
  const handleBackFromEmail = () => {
    setStep(STEP_PHONE);
    setEmail('');
    setEmailError('');
  };

  // Back from email OTP step → back to email entry
  const handleBackFromEmailOtp = () => {
    setStep(STEP_EMAIL);
    setEmailOtp('');
    if (emailOtpRef.current) emailOtpRef.current.setValue('');
  };

  // Back from new phone step → back to email OTP (already verified, or restart)
  const handleBackFromNewPhone = () => {
    setStep(STEP_EMAIL_OTP);
    setNewPhone('');
    setNewPhoneError('');
  };

  const handleResendOTP = async () => {
    const res = await sendOtp(phone);
    setTimer(60);
    setTimerActive(true);
    setOtp('');
    if (otpRef.current) otpRef.current.setValue('');
  };

  const handleResendEmailOTP = async () => {
    const res = await sendEmailOtp(email);
    setTimer(60);
    setTimerActive(true);
    setEmailOtp('');
    if (emailOtpRef.current) emailOtpRef.current.setValue('');
  };

  const formatTime = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const getMaskedPhone = p => {
    if (!p || p.length < 4) return p;
    return p.replace(/.(?=.{4})/g, '*');
  };

  const getMaskedEmail = e => {
    if (!e || !e.includes('@')) return e;
    const [local, domain] = e.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  };

  // ─── Subtitle per step ────────────────────────────────────────────────────────
  const getSubtitle = () => {
    switch (step) {
      case STEP_PHONE:
        return 'Sign in to continue';
      case STEP_OTP:
        return `Verify OTP sent to ${getMaskedPhone(phone)}`;
      case STEP_EMAIL:
        return 'Verify your email to change number';
      case STEP_EMAIL_OTP:
        return `Enter OTP sent to ${getMaskedEmail(email)}`;
      case STEP_NEW_PHONE:
        return 'Enter your new phone number';
      default:
        return '';
    }
  };

  // ─── Continue button label per step ──────────────────────────────────────────
  const getButtonLabel = () => {
    if (loading) return 'Please wait...';
    switch (step) {
      case STEP_PHONE:
        return 'Send OTP';
      case STEP_OTP:
        return 'Verify & Continue';
      case STEP_EMAIL:
        return 'Send OTP to Email';
      case STEP_EMAIL_OTP:
        return 'Verify & Continue';
      case STEP_NEW_PHONE:
        return 'Update Number';
      default:
        return 'Continue';
    }
  };

  // ─── Continue button disabled logic ──────────────────────────────────────────
  const isContinueDisabled = () => {
    if (loading) return true;
    switch (step) {
      case STEP_PHONE:
        return phone.length !== 10;
      case STEP_OTP:
        return otp.length !== 6;
      case STEP_EMAIL:
        return email.trim() === '';
      case STEP_EMAIL_OTP:
        return emailOtp.length !== 6;
      case STEP_NEW_PHONE:
        return newPhone.length !== 10;
      default:
        return false;
    }
  };

  // ─── Render form body per step ────────────────────────────────────────────────
  const renderForm = () => {
    // ── PHONE entry ──────────────────────────────────────────────────────────
    if (step === STEP_PHONE)
      return (
        <>
          <View style={styles.inputWrapper}>
            <Text variant="labelLarge" style={styles.label}>
              Phone Number
            </Text>
            <TextInput
              mode="outlined"
              placeholder="Enter 10-digit number"
              keyboardType="number-pad"
              returnKeyType="done"
              value={phone}
              onChangeText={handlePhoneChange}
              onSubmitEditing={handleContinue}
              maxLength={10}
              error={!!phoneError}
              style={[styles.input, { backgroundColor: theme.colors.surface }]}
              outlineStyle={styles.inputOutline}
              activeOutlineColor={theme.colors.primary}
              left={
                <TextInput.Icon icon="phone" color={theme.colors.primary} />
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

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              marginBottom: 12,
            }}
            activeOpacity={0.8}
            onPress={handleChangeNumberPress}
          >
            <Icon source="chevron-left" size={22} />
            <Text style={styles.linkText}>Change Number ?</Text>
          </TouchableOpacity>
        </>
      );

    // ── PHONE OTP verify ─────────────────────────────────────────────────────
    if (step === STEP_OTP)
      return (
        <>
          <Text variant="labelLarge" style={styles.label}>
            Enter OTP
          </Text>
          <OtpInput
            ref={otpRef}
            numberOfDigits={6}
            onTextChange={text => setOtp(text.replace(/[^0-9]/g, ''))}
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
              focusStickStyle: { backgroundColor: theme.colors.primary },
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
                <Text style={styles.timerText}>{formatTime(timer)}</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={handleResendOTP}>
                <Text style={styles.linkText}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      );

    // ── EMAIL entry (change-number flow) ─────────────────────────────────────
    if (step === STEP_EMAIL)
      return (
        <>
          <View style={styles.inputWrapper}>
            <Text variant="labelLarge" style={styles.label}>
              Email Address
            </Text>
            <TextInput
              mode="outlined"
              placeholder="Enter your registered email"
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="done"
              value={email}
              onChangeText={handleEmailChange}
              onSubmitEditing={handleContinue}
              error={!!emailError}
              style={[styles.input, { backgroundColor: theme.colors.surface }]}
              outlineStyle={styles.inputOutline}
              activeOutlineColor={theme.colors.primary}
              left={
                <TextInput.Icon icon="email" color={theme.colors.primary} />
              }
              theme={{ roundness: 12 }}
              right={
                email ? (
                  <TextInput.Icon
                    icon="close-circle"
                    onPress={() => {
                      setEmail('');
                      setEmailError('');
                    }}
                  />
                ) : null
              }
            />
            {emailError ? (
              <Text variant="bodySmall" style={styles.errorText}>
                {emailError}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              marginBottom: 12,
            }}
            activeOpacity={0.8}
            onPress={handleBackFromEmail}
          >
            <Icon source="chevron-left" size={22} />
            <Text style={styles.linkText}>Back to login</Text>
          </TouchableOpacity>
        </>
      );

    // ── EMAIL OTP verify ─────────────────────────────────────────────────────
    if (step === STEP_EMAIL_OTP)
      return (
        <>
          <Text variant="labelLarge" style={styles.label}>
            Enter Email OTP
          </Text>
          <OtpInput
            ref={emailOtpRef}
            numberOfDigits={6}
            onTextChange={text => setEmailOtp(text.replace(/[^0-9]/g, ''))}
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
              focusStickStyle: { backgroundColor: theme.colors.primary },
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
              onPress={handleBackFromEmailOtp}
            >
              <Icon source="chevron-left" size={22} />
              <Text style={styles.linkText}>Wrong email?</Text>
            </TouchableOpacity>
            {timerActive ? (
              <View
                style={[
                  styles.timerBadge,
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
              >
                <Text style={styles.timerText}>{formatTime(timer)}</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={handleResendEmailOTP}>
                <Text style={styles.linkText}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      );

    // ── NEW PHONE entry ──────────────────────────────────────────────────────
    if (step === STEP_NEW_PHONE)
      return (
        <>
          <View style={styles.inputWrapper}>
            <Text variant="labelLarge" style={styles.label}>
              New Phone Number
            </Text>
            <TextInput
              mode="outlined"
              placeholder="Enter new 10-digit number"
              keyboardType="number-pad"
              returnKeyType="done"
              value={newPhone}
              onChangeText={handleNewPhoneChange}
              onSubmitEditing={handleContinue}
              maxLength={10}
              error={!!newPhoneError}
              style={[styles.input, { backgroundColor: theme.colors.surface }]}
              outlineStyle={styles.inputOutline}
              activeOutlineColor={theme.colors.primary}
              left={
                <TextInput.Icon icon="phone" color={theme.colors.primary} />
              }
              theme={{ roundness: 12 }}
              right={
                newPhone ? (
                  <TextInput.Icon
                    icon="close-circle"
                    onPress={() => {
                      setNewPhone('');
                      setNewPhoneError('');
                    }}
                  />
                ) : null
              }
            />
            {newPhoneError ? (
              <Text variant="bodySmall" style={styles.errorText}>
                {newPhoneError}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              marginBottom: 12,
            }}
            activeOpacity={0.8}
            onPress={handleBackFromNewPhone}
          >
            <Icon source="chevron-left" size={22} />
            <Text style={styles.linkText}>Back</Text>
          </TouchableOpacity>
        </>
      );
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
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
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
              style={styles.container}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
            >
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                bounces={false}
              >
                <View style={styles.appHeader}>
                  <Image
                    source={require('../../assets/images/Tapplogo.png')}
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

                <Animated.View
                  style={[
                    styles.lottieContainer,
                    {
                      height: lottieHeight,
                      opacity: keyboardVisible ? 0 : 1,
                      overflow: 'hidden',
                    },
                  ]}
                >
                  <LottieView
                    ref={lottieRef}
                    source={require('../../assets/animations/billpayment.json')}
                    autoPlay
                    loop
                    style={styles.lottie}
                  />
                </Animated.View>

                {/* Card */}
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
                      {getSubtitle()}
                    </Text>
                  </View>

                  {/* Form */}
                  <View style={styles.formContainer}>
                    {renderForm()}

                    {/* Continue Button */}
                    <TouchableOpacity
                      onPress={handleContinue}
                      disabled={isContinueDisabled()}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={[theme.colors.secondary, theme.colors.primary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.gradientButton,
                          isContinueDisabled() && styles.gradientButtonDisabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.buttonText,
                            { color: theme.colors.onPrimary },
                          ]}
                        >
                          {getButtonLabel()}
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
                          setShowAcceptButton(false);
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
                          setShowAcceptButton(false);
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
          </TouchableWithoutFeedback>
        </SafeAreaView>
      </LinearGradient>

      <TermsBottomSheet
        ref={termsSheetRef}
        showAcceptButton={showAcceptButton}
        onAccept={handleAcceptTerms}
      />
    </>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  lottieContainer: {
    height: height * 0.35,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  lottie: { width: width * 0.6, height: width * 0.6 },

  card: {
    flex: 1,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 20,
    marginTop: 5,
    minHeight: height * 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 25,
    elevation: 20,
  },

  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 12,
  },
  appLogo: { width: 50, height: 50 },
  appName: {
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: 'BagelFatOne-Regular',
  },

  header: { marginBottom: 18, alignItems: 'center' },
  title: { fontWeight: '800', marginBottom: 8, letterSpacing: 0.3 },
  subtitle: { textAlign: 'center', lineHeight: 24 },

  formContainer: { marginBottom: 12 },
  inputWrapper: { marginBottom: 8 },
  label: { marginBottom: 10, fontWeight: '600' },
  input: { fontSize: 16 },
  inputOutline: { borderRadius: 16, borderWidth: 2 },
  errorText: { color: '#ef4444', marginTop: 6, marginLeft: 4 },

  otpContainer: { marginTop: 8, marginBottom: 12, gap: 4 },
  otpBox: { borderRadius: 16, borderWidth: 2.5, width: 45, height: 55 },
  otpText: { fontSize: 24, fontWeight: '700' },

  otpActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  linkText: { fontSize: 15, fontWeight: '600' },
  timerBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  timerText: { fontWeight: '600', fontSize: 14 },

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
  gradientButtonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },

  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 12,
    marginBottom: 40,
  },
  footerText: { fontSize: 13 },
  footerLinks: { flexDirection: 'row', marginTop: 4 },
  footerLink: { fontSize: 13, fontWeight: '600' },
});

export default LoginScreen;
