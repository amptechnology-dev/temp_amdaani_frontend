import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Pressable } from 'react-native';
import { Portal, Text, Button, useTheme, Icon } from 'react-native-paper';

const CustomAlert = ({
    visible,
    onDismiss,
    title,
    message,
    type = "info",
    actions = []
}) => {
    const theme = useTheme();
    const scaleAnim = useRef(new Animated.Value(0.95)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 65,
                    friction: 8,
                    useNativeDriver: true
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(scaleAnim, {
                    toValue: 0.95,
                    duration: 150,
                    useNativeDriver: true
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true
                })
            ]).start();
        }
    }, [visible]);

    const getIcon = () => {
        switch (type) {
            case "success": return "check-circle";
            case "error": return "close-circle";
            case "warning": return "alert-circle";
            default: return "information";
        }
    };

    const getColor = () => {
        switch (type) {
            case "success": return "#10b981";
            case "error": return "#ef4444";
            case "warning": return "#f59e0b";
            default: return theme.colors.primary;
        }
    };

    const iconColor = getColor();
    const isDark = theme.dark;

    return (
        <Portal>
            {visible && (
                <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                    // onPress={onDismiss} // Disabled backdrop dismiss
                    />
                    <Animated.View
                        style={{
                            transform: [{ scale: scaleAnim }],
                            width: "90%",
                            maxWidth: 380,
                        }}
                    >
                        <View style={[
                            styles.dialog,
                            {
                                backgroundColor: isDark ? "#1f1f1f" : "#ffffff",
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 10 },
                                shadowOpacity: isDark ? 0.5 : 0.15,
                                shadowRadius: 20,
                                elevation: 10,
                            }
                        ]}>
                            {/* Icon Container */}
                            <View style={styles.iconContainer}>
                                <View style={[
                                    styles.iconCircle,
                                    { backgroundColor: `${iconColor}12` }
                                ]}>
                                    <Icon
                                        source={getIcon()}
                                        size={32}
                                        color={iconColor}
                                    />
                                </View>
                            </View>

                            {/* Title */}
                            {title && (
                                <Text
                                    variant="headlineSmall"
                                    style={[
                                        styles.title,
                                        { color: theme.colors.onSurface }
                                    ]}
                                >
                                    {title}
                                </Text>
                            )}

                            {/* Message */}
                            {message && (
                                <Text
                                    variant="bodyMedium"
                                    style={[
                                        styles.message,
                                        {
                                            color: isDark
                                                ? "rgba(255,255,255,0.7)"
                                                : "rgba(0,0,0,0.6)"
                                        }
                                    ]}
                                >
                                    {message}
                                </Text>
                            )}

                            {/* Divider */}
                            <View style={[
                                styles.divider,
                                {
                                    backgroundColor: isDark
                                        ? "rgba(255,255,255,0.08)"
                                        : "rgba(0,0,0,0.06)"
                                }
                            ]} />

                            {/* Actions */}
                            <View style={[
                                styles.actions,
                                actions.length > 2 && styles.actionsColumn
                            ]}>
                                {actions.length > 0 ? (
                                    actions.map((action, idx) => {
                                        const isContained = action.mode === "contained" || (!action.mode && idx === actions.length - 1);
                                        return (
                                            <Button
                                                key={idx}
                                                mode={isContained ? "contained" : "outlined"}
                                                onPress={action.onPress}
                                                style={[
                                                    styles.actionButton,
                                                    actions.length > 2 && styles.actionButtonFull
                                                ]}
                                                buttonColor={isContained ? (action.color || iconColor) : "transparent"}
                                                textColor={isContained ? "#ffffff" : (action.color || iconColor)}
                                                contentStyle={styles.buttonContent}
                                                labelStyle={styles.buttonLabel}
                                            >
                                                {action.label}
                                            </Button>
                                        );
                                    })
                                ) : (
                                    <Button
                                        onPress={onDismiss}
                                        mode="contained"
                                        style={styles.actionButton}
                                        buttonColor={iconColor}
                                        textColor="#ffffff"
                                        contentStyle={styles.buttonContent}
                                        labelStyle={styles.buttonLabel}
                                    >
                                        OK
                                    </Button>
                                )}
                            </View>
                        </View>
                    </Animated.View>
                </Animated.View>
            )}
        </Portal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
    },
    dialog: {
        borderRadius: 20,
        paddingTop: 28,
        paddingBottom: 20,
        paddingHorizontal: 24,
    },
    iconContainer: {
        alignItems: "center",
        marginBottom: 16,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        fontWeight: "600",
        textAlign: "center",
        marginBottom: 8,
        letterSpacing: 0.15,
    },
    message: {
        textAlign: "center",
        lineHeight: 20,
        letterSpacing: 0.25,
        paddingHorizontal: 4,
    },
    divider: {
        height: 1,
        marginVertical: 20,
        marginHorizontal: -8,
    },
    actions: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
    },
    actionsColumn: {
        flexDirection: "column",
        gap: 10,
    },
    actionButton: {
        borderRadius: 12,
        minWidth: 100,
    },
    actionButtonFull: {
        width: "100%",
    },
    buttonContent: {
        height: 42,
    },
    buttonLabel: {
        fontSize: 14,
        fontWeight: "600",
        letterSpacing: 0.4,
    },
});

export default CustomAlert;
