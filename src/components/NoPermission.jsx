import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, useTheme, Surface } from 'react-native-paper';
import LottieView from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const NoPermission = ({
    title = "Access Denied",
    message = "You don't have permission to view this page.",
    onGoBack
}) => {
    const theme = useTheme();
    const navigation = useNavigation();

    const handleGoBack = () => {
        if (onGoBack) {
            onGoBack();
        } else if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate('Home'); // Fallback to Home if can't go back
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
                <View style={styles.animationContainer}>
                    <LottieView
                        source={require('../assets/animations/Security.json')}
                        style={styles.animation}
                        autoPlay
                        loop />
                </View>

                <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.error }]}>
                    {title}
                </Text>

                <Text variant="bodyMedium" style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
                    {message}
                </Text>

                <Button
                    mode="contained"
                    onPress={handleGoBack}
                    style={styles.button}
                    icon="arrow-left"
                >
                    Go Back
                </Button>
            </Surface>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        padding: 32,
        borderRadius: 24,
        alignItems: 'center',
    },
    animationContainer: {
        width: 120,
        height: 120,
        marginBottom: 24,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 0, 0, 0.05)',
        borderRadius: 60,
    },
    animation: {
        width: 80,
        height: 80,
    },
    title: {
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    button: {
        width: '100%',
        borderRadius: 12,
    },
});

export default NoPermission;
