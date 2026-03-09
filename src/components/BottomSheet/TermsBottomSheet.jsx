import React, { forwardRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, useTheme, Divider } from 'react-native-paper';
import { BottomSheetFooter } from '@gorhom/bottom-sheet';
import BaseBottomSheet from './BaseBottomSheet';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TermsBottomSheet = forwardRef(({
    onAccept,
    showAcceptButton = false,
    initialSnapIndex = -1,
    showCloseButton = true,
    enableDismissOnClose = true,
    backdropbehavior = 'close',
}, ref) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    // ✅ Custom Footer Component - Fixed
    const renderFooter = (
        <>
            {showAcceptButton &&
                <View style={[styles.footerContainer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant, }]}>
                    <TouchableOpacity
                        onPress={onAccept}
                        activeOpacity={0.8}
                        style={styles.acceptButtonWrapper}>
                        <LinearGradient
                            colors={[theme.colors.secondary, theme.colors.primary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.acceptButton}>
                            <Text variant='titleLarge' style={[styles.acceptButtonText, { color: theme.colors.onPrimary }]}>
                                ✓ I Accept Terms & Conditions
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            }
        </>
    );

    return (
        <BaseBottomSheet
            ref={ref}
            title="Terms & Conditions"
            subtitle="Please read carefully before using our services"
            snapPoints={['70%', '90%']}
            initialSnapIndex={initialSnapIndex}
            showHeader={true}
            enablePanDownToClose={false}
            showCloseButton={showCloseButton}
            contentType="scroll"
            enableDismissOnClose={enableDismissOnClose}
            backdropbehavior={backdropbehavior}
            footerComponent={renderFooter}  // ✅ Pass the function, not calling it
            showFooter={showAcceptButton}   // ✅ Add this prop to enable footer rendering
            contentContainerStyle={styles.contentContainer}>

            <View style={styles.container}>
                {/* Last Updated */}
                <Text variant="bodySmall" style={styles.updatedText}>
                    Last Updated: October 17, 2025
                </Text>

                <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

                {/* Introduction */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        1. Introduction
                    </Text>
                    <Text variant="bodyMedium" style={styles.paragraph}>
                        Welcome to our billing and invoicing application ("App"). By accessing or using our App, you agree to be bound by these Terms and Conditions. If you disagree with any part of these terms, please do not use our App.
                    </Text>
                </View>

                {/* Account Registration */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        2. Account Registration
                    </Text>
                    <Text variant="bodyMedium" style={styles.paragraph}>
                        To use our App, you must:
                    </Text>
                    <View style={styles.bulletList}>
                        <Text variant="bodyMedium" style={styles.bulletPoint}>
                            • Provide accurate and complete registration information
                        </Text>
                        <Text variant="bodyMedium" style={styles.bulletPoint}>
                            • Maintain the security of your account credentials
                        </Text>
                        <Text variant="bodyMedium" style={styles.bulletPoint}>
                            • Accept responsibility for all activities under your account
                        </Text>
                        <Text variant="bodyMedium" style={styles.bulletPoint}>
                            • Notify us immediately of any unauthorized access
                        </Text>
                    </View>
                </View>

                {/* Use of Services */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        3. Use of Services
                    </Text>
                    <Text variant="bodyMedium" style={styles.paragraph}>
                        Our App provides billing, invoicing, and business management tools. You agree to use these services only for lawful business purposes and in accordance with applicable laws and regulations.
                    </Text>
                </View>

                {/* Data and Privacy */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        4. Data and Privacy
                    </Text>
                    <Text variant="bodyMedium" style={styles.paragraph}>
                        We take your privacy seriously. All data collected through the App is handled in accordance with our Privacy Policy. By using the App, you consent to:
                    </Text>
                    <View style={styles.bulletList}>
                        <Text variant="bodyMedium" style={styles.bulletPoint}>
                            • Collection of business and transaction data
                        </Text>
                        <Text variant="bodyMedium" style={styles.bulletPoint}>
                            • Storage of customer information you input
                        </Text>
                        <Text variant="bodyMedium" style={styles.bulletPoint}>
                            • Use of analytics to improve our services
                        </Text>
                        <Text variant="bodyMedium" style={styles.bulletPoint}>
                            • Secure encryption of sensitive information
                        </Text>
                    </View>
                </View>

                {/* Subscription and Payments */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        5. Subscription and Payments
                    </Text>
                    <Text variant="bodyMedium" style={styles.paragraph}>
                        Some features may require a paid subscription. You agree to provide accurate payment information and authorize us to charge the applicable fees. Subscriptions automatically renew unless cancelled before the renewal date.
                    </Text>
                </View>

                {/* Intellectual Property */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        6. Intellectual Property
                    </Text>
                    <Text variant="bodyMedium" style={styles.paragraph}>
                        All content, features, and functionality of the App are owned by us and protected by international copyright, trademark, and other intellectual property laws. You may not copy, modify, or distribute any part of the App without our written permission.
                    </Text>
                </View>

                {/* User Responsibilities */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        7. User Responsibilities
                    </Text>
                    <Text variant="bodyMedium" style={styles.paragraph}>
                        You are responsible for:
                    </Text>
                    <View style={styles.bulletList}>
                        <Text variant="bodyMedium" style={styles.bulletPoint}>
                            • Accuracy of invoices and bills you create
                        </Text>
                        <Text variant="bodyMedium" style={styles.bulletPoint}>
                            • Compliance with tax laws in your jurisdiction
                        </Text>
                        <Text variant="bodyMedium" style={styles.bulletPoint}>
                            • Backup of your business data
                        </Text>
                        <Text variant="bodyMedium" style={styles.bulletPoint}>
                            • Not using the App for fraudulent activities
                        </Text>
                    </View>
                </View>

                {/* Limitation of Liability */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        8. Limitation of Liability
                    </Text>
                    <Text variant="bodyMedium" style={styles.paragraph}>
                        The App is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, special, or consequential damages arising from your use of the App, including but not limited to loss of data, revenue, or business opportunities.
                    </Text>
                </View>

                {/* Termination */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        9. Termination
                    </Text>
                    <Text variant="bodyMedium" style={styles.paragraph}>
                        We reserve the right to suspend or terminate your account at any time for violation of these terms. You may delete your account at any time through the App settings. Upon termination, your access to the App will cease immediately.
                    </Text>
                </View>

                {/* Changes to Terms */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        10. Changes to Terms
                    </Text>
                    <Text variant="bodyMedium" style={styles.paragraph}>
                        We may update these Terms and Conditions from time to time. We will notify you of significant changes through the App or via email. Continued use of the App after changes constitutes acceptance of the modified terms.
                    </Text>
                </View>

                {/* Governing Law */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        11. Governing Law
                    </Text>
                    <Text variant="bodyMedium" style={styles.paragraph}>
                        These Terms and Conditions are governed by and construed in accordance with the laws of India. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts in India.
                    </Text>
                </View>

                {/* Contact Information */}
                <View style={[styles.section, styles.lastSection]}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        12. Contact Us
                    </Text>
                    <Text variant="bodyMedium" style={styles.paragraph}>
                        If you have any questions about these Terms and Conditions, please contact us at:
                    </Text>
                    <View style={[styles.contactBox, { backgroundColor: theme.colors.surfaceVariant, borderLeftColor: theme.colors.primary }]}>
                        <Text variant="bodyMedium" style={styles.contactText}>
                            📧 Email: amptechnologysolution@gmail.com
                        </Text>
                        <Text variant="bodyMedium" style={styles.contactText}>
                            📞 Phone: +91 8697972001
                        </Text>
                        <Text variant="bodyMedium" style={styles.contactText}>
                            🌐 Website: www.amptechnology.in
                        </Text>
                    </View>
                </View>

                {/* Agreement Notice */}
                {showAcceptButton && (
                    <View style={[styles.agreementNotice, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.primary }]}>
                        <Text variant="bodySmall" style={styles.agreementText}>
                            ✓ By clicking "I Accept", you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
                        </Text>
                    </View>
                )}

                {/* Extra space for footer */}
                {showAcceptButton && <View style={{ height: 100 }} />}
            </View>
        </BaseBottomSheet>
    );
});

const styles = StyleSheet.create({
    contentContainer: {
        paddingBottom: 0,
    },
    container: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
    },
    updatedText: {
        fontStyle: 'italic',
        marginBottom: 12,
    },
    divider: {
        marginBottom: 20,
    },
    section: {
        marginBottom: 24,
    },
    lastSection: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontWeight: '700',
        marginBottom: 12,
        letterSpacing: 0.2,
    },
    paragraph: {
        lineHeight: 22,
        textAlign: 'justify',
    },
    bulletList: {
        marginTop: 8,
        marginLeft: 8,
    },
    bulletPoint: {
        lineHeight: 24,
        marginBottom: 6,
    },
    contactBox: {
        borderRadius: 12,
        padding: 16,
        marginTop: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#667eea',
    },
    contactText: {
        marginBottom: 8,
        fontWeight: '500',
    },
    agreementNotice: {
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#bfdbfe',
        marginTop: 16,
        marginBottom: 16,
    },
    agreementText: {
        textAlign: 'center',
        fontWeight: '600',
        lineHeight: 20,
    },

    // Footer Styles
    footerContainer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
        borderTopWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 10,
    },
    acceptButtonWrapper: {
        width: '100%',
    },
    acceptButton: {
        height: 56,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
    },
    acceptButtonText: {
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});

TermsBottomSheet.displayName = 'TermsBottomSheet';

export default TermsBottomSheet;
