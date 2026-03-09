import React, { useEffect, useRef } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
  StatusBar,
} from 'react-native';
import { useTheme, Text } from 'react-native-paper';
import Sound from 'react-native-sound';

const { width, height } = Dimensions.get('window');

const SplashScreen = () => {
  const theme = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const logoRotateAnim = useRef(new Animated.Value(0)).current;
  const bottomFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Sequential animations for better visual flow
    Animated.sequence([
      // Logo entrance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(logoRotateAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // App name slide up
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      // Bottom text fade in
      Animated.timing(bottomFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      Sound.setCategory('Ambient', true);
      const splashSound = new Sound('splashsound.mp3', Sound.MAIN_BUNDLE, (error) => {
        if (error) {
          console.warn('Splash sound error:', error);
          return;
        }
        splashSound.play(() => splashSound.release());
      });
    } catch (err) {
      console.warn('Failed to play splash sound:', err);
    }

  }, []);

  const logoRotation = logoRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-10deg', '0deg'],
  });

  return (
    <>
      <StatusBar
        barStyle={theme.dark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
        translucent={false}
      />
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        {/* Main Content */}
        <View style={styles.mainContent}>
          <Animated.View
            style={[
              styles.logoSection,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }, { rotate: logoRotation }],
              },
            ]}
          >
            {/* Logo Container */}
            <View
              style={[
                styles.logoContainer,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.primary,
                },
              ]}
            >
              <Image
                source={require('../assets/images/applogo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            {/* App Name */}
            <Animated.View
              style={[
                styles.appNameContainer,
                {
                  transform: [{ translateY: slideUpAnim }],
                  opacity: fadeAnim,
                },
              ]}
            >
              <Text
                style={[styles.appName, { color: theme.colors.onBackground }]}
              >
                AMDAANI
              </Text>
              <Text
                style={[
                  styles.appSubtitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Smart Business Solutions
              </Text>
            </Animated.View>
          </Animated.View>

          {/* Loading Indicator */}
          <Animated.View
            style={[styles.loadingContainer, { opacity: fadeAnim }]}
          >
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              style={styles.loader}
            />
          </Animated.View>
        </View>

        {/* Bottom Section */}
        <Animated.View
          style={[styles.bottomContainer, { opacity: bottomFadeAnim }]}
        >
          <Text
            style={[
              styles.poweredByText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Powered by
          </Text>
          <Text style={[styles.companyText, { color: theme.colors.primary }]}>
            AMP Technology
          </Text>
        </Animated.View>

        {/* Decorative Elements */}
        <Animated.View
          style={[
            styles.decorativeCircle1,
            {
              backgroundColor: theme.colors.primary,
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.1],
              }),
              transform: [{ scale: scaleAnim }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.decorativeCircle2,
            {
              backgroundColor: theme.colors.secondary,
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.05],
              }),
              transform: [{ scale: scaleAnim }],
            },
          ]}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: width,
    height: height,
    position: 'relative',
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
  },
  logo: {
    width: 120,
    height: 120,
  },
  appNameContainer: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 32,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'BagelFatOne-Regular',
  },
  appSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.5,
    textAlign: 'center',
    opacity: 0.8,
  },
  loadingContainer: {
    marginTop: 40,
  },
  loader: {
    transform: [{ scale: 1.2 }],
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  poweredByText: {
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 4,
    opacity: 0.7,
  },
  companyText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
});

export default SplashScreen;
