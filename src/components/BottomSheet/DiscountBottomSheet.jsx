// components/BottomSheet/DiscountBottomSheet.jsx
import React, { forwardRef, useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, KeyboardAvoidingView } from 'react-native';
import {
    Text,
    Button,
    TextInput,
    SegmentedButtons,
    Divider,
    useTheme,
} from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';

const DiscountBottomSheet = forwardRef(
    ({ discount, setDiscount, currentTotal = 0 }, ref) => {
        const theme = useTheme();
        const [localDiscount, setLocalDiscount] = useState(discount);

        useEffect(() => {
            setLocalDiscount(discount);
        }, [discount]);

        // 💡 Compute live discounted total
        const calculatedTotal = useMemo(() => {
            const value = Number(localDiscount.value || 0);
            if (localDiscount.type === 'flat') {
                return Math.max(0, currentTotal - value);
            }
            return Math.max(0, currentTotal - (currentTotal * value) / 100);
        }, [localDiscount, currentTotal]);

        // Show discount as user-entered value (₹ for flat, % for percent)
        const discountDisplay = useMemo(() => {
            const value = Number(localDiscount.value || 0);
            if (!localDiscount.value) return '₹0.00';
            if (localDiscount.type === 'flat') {
                return `₹${value.toFixed(2)}`;
            }
            return `${value}%`;
        }, [localDiscount]);

        const handleCancel = () => {
            ref?.current?.close?.();
        };

        const handleSave = () => {
            setDiscount(localDiscount);
            ref?.current?.close?.();
        };

        // Footer buttons for BaseBottomSheet
        const footer = (
            <View style={[styles.footerButtons,
            {
                backgroundColor: theme.colors.surface,
                borderTopColor: theme.colors.outlineVariant,
            },
            ]}>
                <Button
                    mode="text"
                    textColor={theme.colors.onSurfaceVariant}
                    onPress={handleCancel}
                    style={styles.cancelButton}
                >
                    Cancel
                </Button>
                <Button
                    mode="contained"
                    icon="check"
                    onPress={handleSave}
                    style={styles.saveButton}
                >
                    Save
                </Button>
            </View>
        );

        return (
            <BaseBottomSheet
                ref={ref}
                title="Apply Discount"
                snapPoints={['70']}
                initialSnapIndex={-1}
                contentType='scroll'
                showFooter
                enableDismissOnClose={false}
                footerComponent={footer}
            >
                <View
                    style={[styles.container, { backgroundColor: theme.colors.surface }]}
                >
                    <Text variant="labelLarge" style={styles.label}>
                        Discount Type
                    </Text>
                    <SegmentedButtons
                        value={localDiscount.type}
                        onValueChange={(val) =>
                            setLocalDiscount((prev) => ({ ...prev, type: val }))
                        }
                        buttons={[
                            { value: 'flat', label: 'Flat ₹', icon: 'cash' },
                            { value: 'percent', label: 'Percent %', icon: 'percent' },
                        ]}
                        style={styles.segmented}
                    />

                    <Text variant="labelLarge" style={styles.label}>
                        Discount Value
                    </Text>
                    <TextInput
                        mode="outlined"
                        label={localDiscount.type === 'flat' ? 'Amount (₹)' : 'Percentage (%)'}
                        keyboardType="numeric"
                        value={String(localDiscount.value || '')}
                        onChangeText={(text) =>
                            setLocalDiscount({
                                ...localDiscount,
                                value: text.replace(/[^0-9.]/g, ''),
                            })
                        }
                        style={styles.input}
                        left={
                            <TextInput.Icon
                                icon={localDiscount.type === 'flat' ? 'currency-inr' : 'percent'}
                            />
                        }
                        theme={{ roundness: 12 }}
                    />

                    <Divider style={{ marginVertical: 8 }} />

                    <View style={styles.summaryBox}>
                        <Text variant="titleSmall" style={{ color: theme.colors.outline }}>
                            Current Total
                        </Text>
                        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>
                            ₹{currentTotal.toFixed(2)}
                        </Text>
                    </View>

                    <View style={styles.summaryBox}>
                        <Text variant="titleSmall" style={{ color: theme.colors.outline }}>
                            Discount
                        </Text>
                        <Text
                            variant="headlineSmall"
                            style={{ color: theme.colors.error, fontWeight: '600' }}
                        >
                            {discountDisplay}
                        </Text>
                    </View>
                    <Divider style={{ marginVertical: 8 }} />
                    <View style={styles.summaryBox}>
                        <Text variant="titleSmall" style={{ color: theme.colors.primary }}>
                            Grand Total
                        </Text>
                        <Text
                            variant="headlineSmall"
                            style={{ color: theme.colors.primary, fontWeight: '600' }}
                        >
                            ₹{calculatedTotal.toFixed(2)}
                        </Text>
                    </View>
                </View>
            </BaseBottomSheet>
        );
    },
);

const styles = StyleSheet.create({
    container: {
        padding: 16,
        flex: 1,
    },
    label: {
        marginBottom: 6,
    },
    segmented: {
        marginBottom: 16,
    },
    input: {
        marginBottom: 20,
    },
    summaryBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
    },
    footerButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 12,
        borderTopWidth: 1,
    },
    cancelButton: {
        marginRight: 8,
    },
    saveButton: {
        borderRadius: 8,
    },
});

export default DiscountBottomSheet;
