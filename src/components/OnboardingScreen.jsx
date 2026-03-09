// src/screens/OnboardingScreen.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    StatusBar,
    Platform,
    ScrollView,
    Image,
} from 'react-native';
import { Text, Button, useTheme, Surface } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue,
    useAnimatedStyle,
    interpolate,
    interpolateColor,
    withSpring,
    withTiming,
    Extrapolation,
    runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext';
import LottieView from 'lottie-react-native';
import api from '../utils/api';
import PricingCard from '../screens/plans/pricings';

const { width, height } = Dimensions.get('window');

const OnboardingScreen = () => {
    const theme = useTheme();
    const { completeOnboarding } = useAuth();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showPricing, setShowPricing] = useState(false);
    const [hasPaidPlan, setHasPaidPlan] = useState(false);
    const [freePlanActive, setFreePlanActive] = useState(false);
    const scrollX = useSharedValue(0);
    const scrollViewRef = useRef(null);


    // ✅ Modern billing app slides
    const slides = [
        {
            id: '1',
            lottie: require('../assets/animations/receipt.json'),
            title: 'GST Invoicing Made Easy',
            description: 'Create GST-compliant invoices instantly with automated tax calculations and professional templates.',
            gradient: ['#6366f1', '#8b5cf6'],
            accentColor: '#6366f1',
            tags: [
                { icon: 'file-check', text: 'GST Ready' },
                { icon: 'calculator', text: 'Auto-Tax' },
            ],
        },
        {
            id: '2',
            lottie: require('../assets/animations/Product.json'),
            title: 'Smart Product Management',
            description: 'Add unlimited items with prices, quantities, and GST rates. Track inventory across all your products.',
            gradient: ['#ec4899', '#f97316'],
            accentColor: '#ec4899',
            tags: [
                { icon: 'flash', text: 'Instant' },
                { icon: 'infinity', text: 'Unlimited Items' },
            ],
        },
        {
            id: '3',
            lottie: require('../assets/animations/Printer.json'),
            title: 'Print & Share Instantly',
            description: 'Connect wireless thermal printers or share professional PDF invoices via WhatsApp, Email, and messaging apps.',
            gradient: ['#14b8a6', '#06b6d4'],
            accentColor: '#14b8a6',
            tags: [
                { icon: 'printer-wireless', text: 'Wireless' },
                { icon: 'share-variant', text: 'Multi-Share' },
            ],
        },
        {
            id: '4',
            lottie: require('../assets/animations/Share.json'),
            title: 'Customer Management',
            description: 'Manage unlimited customers with complete details, payment history,',
            gradient: ['#8b5cf6', '#6366f1'],
            accentColor: '#8b5cf6',
            tags: [
                { icon: 'account-group', text: 'Unlimited' },
                { icon: 'history', text: 'Payment' },
            ],
        },
        {
            id: '5',
            lottie: require('../assets/animations/Security.json'),
            title: 'Fast, Secure & Professional',
            description: 'High security, Join 10,000+ businesses managing their billing professionally.',
            gradient: ['#10b981', '#059669'],
            accentColor: '#10b981',
            tags: [
                { icon: 'shield-lock', text: 'Secure' },
                { icon: 'rocket-launch', text: 'Trusted' },
            ],
        },
    ];

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollX.value = event.contentOffset.x;
        },
        onMomentumEnd: (event) => {
            const index = Math.round(event.contentOffset.x / width);
            runOnJS(setCurrentIndex)(index);
        },
    });

    const handleNext = () => {
        if (showPricing) return;

        if (currentIndex < slides.length - 1) {
            const nextIndex = currentIndex + 1;
            scrollViewRef.current?.scrollTo({ x: nextIndex * width, animated: true });
            setCurrentIndex(nextIndex);
        } else {
            completeOnboarding()
        }
    };
    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar
                barStyle={theme.dark ? 'light-content' : 'dark-content'}
                backgroundColor="transparent"
                translucent
            />

            {/* Animated Gradient Background */}
            <AnimatedGradientBackground scrollX={scrollX} slides={slides} theme={theme} />

            {/* Header */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Image
                        source={require('../assets/images/Tapplogo.png')} // Change path to your logo
                        style={styles.appLogo}
                        resizeMode="contain"
                    />
                    <Text variant='headlineLarge' style={[styles.brandText, { color: theme.colors.primary }]}>
                        Amdaani
                    </Text>
                </View>
                {currentIndex < slides.length - 1 && (
                    <TouchableOpacity
                        onPress={completeOnboarding}
                        style={[
                            styles.skipButton,
                            { backgroundColor: theme.colors.surfaceVariant },
                        ]}>
                        <Text style={[styles.skipText, { color: theme.colors.primary }]}>
                            Skip
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Main Carousel - Fixed ScrollView */}
            <View style={styles.carouselWrapper}>
                <Animated.ScrollView
                    ref={scrollViewRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    bounces={false}
                    scrollEnabled={true}
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                    decelerationRate={0.92}
                    snapToAlignment="center"
                    snapToInterval={width}
                    disableIntervalMomentum={true}
                    contentContainerStyle={styles.scrollContent}>
                    {slides.map((item, index) => (
                        <SlideCard
                            key={item.id}
                            item={item}
                            index={index}
                            scrollX={scrollX}
                            theme={theme}
                        />
                    ))}
                </Animated.ScrollView>
            </View>

            {/* Bottom Section */}
            <View style={styles.bottomContainer}>
                {/* Modern Pagination */}
                <View style={styles.paginationWrapper}>
                    {slides.map((item, index) => (
                        <PaginationDot
                            key={item.id}
                            index={index}
                            scrollX={scrollX}
                            currentIndex={currentIndex}
                            color={item.accentColor}
                            theme={theme}
                        />
                    ))}
                </View>

                {/* Action Button - Fixed */}
                <Button
                    mode="contained"
                    onPress={handleNext}
                    style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                    contentStyle={styles.buttonContent}
                    labelStyle={styles.buttonLabel}
                    icon={currentIndex === slides.length - 1 ? 'check-bold' : 'arrow-right'}>
                    {currentIndex === slides.length - 1 ? 'Get Started' : 'Continue'}
                </Button>

                {/* Progress Indicator */}
                <Text style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
                    {currentIndex + 1} of {slides.length}
                </Text>
            </View>
        </View>
    );
};

// ✅ Animated Gradient Background
const AnimatedGradientBackground = ({ scrollX, slides, theme }) => {
    return (
        <View style={styles.gradientContainer}>
            {slides.map((slide, index) => {
                const animatedStyle = useAnimatedStyle(() => {
                    const inputRange = [
                        (index - 1) * width,
                        index * width,
                        (index + 1) * width,
                    ];

                    const opacity = interpolate(
                        scrollX.value,
                        inputRange,
                        [0, 0.2, 0],
                        Extrapolation.CLAMP
                    );

                    return {
                        opacity: withTiming(opacity, { duration: 400 }),
                    };
                });

                return (
                    <Animated.View
                        key={slide.id}
                        style={[StyleSheet.absoluteFill, animatedStyle]}>
                        <LinearGradient
                            colors={[
                                slide.gradient[0] + '40',
                                slide.gradient[1] + '20',
                                theme.colors.background,
                            ]}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                    </Animated.View>
                );
            })}
        </View>
    );
};

// ✅ Modern Card-based Slide Component
const SlideCard = ({ item, index, scrollX, theme }) => {
    const cardAnimatedStyle = useAnimatedStyle(() => {
        const inputRange = [
            (index - 1) * width,
            index * width,
            (index + 1) * width,
        ];

        const scale = interpolate(
            scrollX.value,
            inputRange,
            [0.85, 1, 0.85],
            Extrapolation.CLAMP
        );

        const opacity = interpolate(
            scrollX.value,
            inputRange,
            [0.5, 1, 0.5],
            Extrapolation.CLAMP
        );

        return {
            opacity: withTiming(opacity, { duration: 300 }),
            transform: [
                {
                    scale: withSpring(scale, {
                        damping: 25,
                        stiffness: 120,
                        mass: 0.6,
                    }),
                },
            ],
        };
    });

    const iconAnimatedStyle = useAnimatedStyle(() => {
        const inputRange = [
            (index - 1) * width,
            index * width,
            (index + 1) * width,
        ];

        const rotate = interpolate(
            scrollX.value,
            inputRange,
            [-15, 0, 15],
            Extrapolation.CLAMP
        );

        const scale = interpolate(
            scrollX.value,
            inputRange,
            [0.6, 1, 0.6],
            Extrapolation.CLAMP
        );

        return {
            transform: [
                { rotate: `${rotate}deg` },
                {
                    scale: withSpring(scale, {
                        damping: 18,
                        stiffness: 90,
                    }),
                },
            ],
        };
    });

    return (
        <View style={styles.slideContainer}>
            <Animated.View style={cardAnimatedStyle}>
                <Surface
                    style={[
                        styles.cardSurface,
                        {
                            backgroundColor: theme.dark
                                ? theme.colors.elevation.level2
                                : theme.colors.surface,
                            // ✅ Manual shadow (no flicker)
                            shadowColor: '#000',
                            shadowOffset: {
                                width: 0,
                                height: 8,
                            },
                            shadowOpacity: theme.dark ? 0.4 : 0.25,
                            shadowRadius: 16,
                            elevation: 8,  // For Android
                        },
                    ]}
                    elevation={0}>
                    {/* Icon Section */}
                    <View style={styles.lottieSection}>
                        <Animated.View style={iconAnimatedStyle}>
                            <LottieView
                                source={item.lottie}
                                autoPlay
                                loop
                                style={styles.lottieAnimation}
                            />
                        </Animated.View>
                    </View>

                    {/* Text Content */}
                    <View style={styles.contentSection}>
                        <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                            {item.title}
                        </Text>

                        <Text
                            style={[styles.cardDescription, { color: theme.colors.onSurfaceVariant }]}>
                            {item.description}
                        </Text>

                        {/* Feature Tags */}
                        <View style={styles.tagsContainer}>
                            {item.tags.map((tag, tagIndex) => (
                                <View
                                    key={tagIndex}
                                    style={[
                                        styles.tag,
                                        {
                                            backgroundColor:
                                                tagIndex === 0
                                                    ? theme.colors.primaryContainer
                                                    : theme.colors.secondaryContainer,
                                        },
                                    ]}>
                                    <MaterialCommunityIcons
                                        name={tag.icon}
                                        size={14}
                                        color={tagIndex === 0 ? theme.colors.primary : theme.colors.secondary}
                                    />
                                    <Text
                                        style={[
                                            styles.tagText,
                                            {
                                                color:
                                                    tagIndex === 0 ? theme.colors.primary : theme.colors.secondary,
                                            },
                                        ]}>
                                        {tag.text}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </Surface>
            </Animated.View>
        </View>
    );
};

// ✅ Modern Pagination Dot
const PaginationDot = ({ index, scrollX, currentIndex, color, theme }) => {
    const animatedStyle = useAnimatedStyle(() => {
        const inputRange = [
            (index - 1) * width,
            index * width,
            (index + 1) * width,
        ];

        const scale = interpolate(
            scrollX.value,
            inputRange,
            [1, 1.3, 1],
            Extrapolation.CLAMP
        );

        const opacity = interpolate(
            scrollX.value,
            inputRange,
            [0.4, 1, 0.4],
            Extrapolation.CLAMP
        );

        return {
            opacity: withTiming(opacity, { duration: 300 }),
            transform: [
                {
                    scale: withSpring(scale, {
                        damping: 15,
                        stiffness: 150,
                    }),
                },
            ],
        };
    });

    const isActive = currentIndex === index;

    return (
        <Animated.View
            style={[
                styles.paginationDot,
                {
                    backgroundColor: isActive ? theme.colors.primary : theme.colors.surfaceVariant,
                    width: isActive ? 32 : 10,
                },
                animatedStyle,
            ]}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradientContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'ios' ? 60 : 45,
        paddingBottom: 20,
        zIndex: 10,
    },
    brandText: {
        fontWeight: '600',
        letterSpacing: 0.5,
        fontFamily: 'BagelFatOne-Regular',
    },
    skipButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    skipText: {
        fontSize: 15,
        fontWeight: '700',
    },
    carouselWrapper: {
        flex: 1,
    },
    scrollContent: {
        alignItems: 'center',
    },
    slideContainer: {
        width,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    cardSurface: {
        flex: 1,
        width: width - 48,
        // height: height * 0.58,
        // marginVertical: 12,
        margin: 12,
        borderRadius: 28,
        overflow: 'hidden',
    },
    iconSection: {
        flex: 0.5,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 40,
    },
    iconGradientCircle: {
        width: 160,
        height: 160,
        borderRadius: 80,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 12,
    },
    contentSection: {
        flex: 0.5,
        paddingHorizontal: 32,
        paddingBottom: 30,
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 30,
        fontWeight: '900',
        marginBottom: 14,
        letterSpacing: 0.3,
    },
    cardDescription: {
        fontSize: 16,
        lineHeight: 24,
        opacity: 0.9,
        marginBottom: 24,
    },
    tagsContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 14,
        gap: 6,
    },
    tagText: {
        fontSize: 13,
        fontWeight: '700',
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 50 : 35,
        alignItems: 'center',
    },
    paginationWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        gap: 12,
    },
    paginationDot: {
        height: 10,
        borderRadius: 5,
    },
    actionButton: {
        width: '100%',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        marginBottom: 6,
    },
    buttonContent: {
        // height: 60,
    },
    buttonLabel: {
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    progressText: {
        fontSize: 14,
        fontWeight: '600',
        opacity: 0.6,
    },
    // ✅ Lottie Animation Styles
    lottieSection: {
        flex: 0.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lottieAnimation: {
        width: 140,
        height: 140,
    },
    appLogo: {
        width: 50,
        height: 50,
    },
});

export default OnboardingScreen;
