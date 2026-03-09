import React, { forwardRef, useState, useEffect } from 'react';
import { View } from 'react-native';
import { Text, TextInput, Button, Icon, TouchableRipple, useTheme } from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';

const PaymentMethodBottomSheet = forwardRef(({
    paymentMethod,
    setPaymentMethod,
    paymentNote,
    setPaymentNote,
    onDone,
    onCancel, // optional external callback
}, ref) => {
    const theme = useTheme();

    const paymentOptions = [
        { label: 'Cash', value: 'cash', icon: 'cash' },
        { label: 'UPI', value: 'upi', icon: 'qrcode-scan' },
        { label: 'Card', value: 'card', icon: 'credit-card' },
        { label: 'Bank Transfer', value: 'bank_transfer', icon: 'bank' },
        { label: 'Cheque', value: 'cheque', icon: 'checkbook' },
    ];

    const [localMethod, setLocalMethod] = useState(paymentMethod || 'cash');
    const [localNote, setLocalNote] = useState(paymentNote || '');

    useEffect(() => {
        setLocalMethod(paymentMethod);
        setLocalNote(paymentNote);
    }, [paymentMethod, paymentNote]);

    const getInputLabel = () => {
        switch (localMethod) {
            case 'upi':
                return 'UPI ID / Transaction Reference';
            case 'card':
                return 'Card Last 4 Digits / Transaction ID';
            case 'bank_transfer':
                return 'Bank Transaction / Reference No.';
            case 'cheque':
                return 'Cheque Number';
            default:
                return 'Reference / Transaction ID';
        }
    };

    const getInputPlaceholder = () => {
        switch (localMethod) {
            case 'upi':
                return 'e.g., user@upi or TXN123456';
            case 'card':
                return 'e.g., 9876 or POS1234';
            case 'bank_transfer':
                return 'e.g., NEFT123456 or IMPS987654';
            case 'cheque':
                return 'e.g., CHQ123456';
            default:
                return 'Enter reference number';
        }
    };

    const handleDone = () => {
        setPaymentMethod(localMethod);
        setPaymentNote(localMethod === 'cash' ? '' : localNote.trim());
        onDone?.();
    };

    const handleCancel = () => {
        onCancel?.();
        ref?.current?.close?.();
    };

    return (
        <BaseBottomSheet
            ref={ref}
            title="Select Payment Method"
            initialSnapIndex={-1}
            showHeader
            enablePanDownToClose
            contentType="scroll"
            snapPoints={['40%', '70%']}
            showFooter
            footerComponent={
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'flex-end',
                        padding: 16,
                        gap: 8,
                        backgroundColor: theme.colors.surface,
                    }}
                >
                    <Button
                        mode="outlined"
                        onPress={handleCancel}
                        style={{ flex: 1, borderRadius: 10 }}
                    >
                        Cancel
                    </Button>

                    <Button
                        mode="contained"
                        onPress={handleDone}
                        style={{ flex: 1, borderRadius: 10 }}
                    >
                        Done
                    </Button>
                </View>
            }
        >
            <View style={{ paddingHorizontal: 16, paddingBottom: 120 }}>
                {paymentOptions.map(item => {
                    const selected = localMethod === item.value;
                    return (
                        <TouchableRipple
                            key={item.value}
                            onPress={() => {
                                setLocalMethod(item.value);
                                if (item.value === 'cash') setLocalNote('');
                            }}
                            rippleColor={theme.colors.primary + '20'}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 12,
                                    borderBottomWidth: 0.5,
                                    borderBottomColor: theme.colors.outlineVariant,
                                }}
                            >
                                <Icon
                                    source={item.icon}
                                    size={18}
                                    color={
                                        selected
                                            ? theme.colors.primary
                                            : theme.colors.onSurfaceVariant
                                    }
                                />
                                <Text
                                    style={{
                                        flex: 1,
                                        marginLeft: 12,
                                        color: selected
                                            ? theme.colors.primary
                                            : theme.colors.onSurface,
                                        fontWeight: selected ? '600' : '400',
                                    }}
                                >
                                    {item.label}
                                </Text>
                                {selected && (
                                    <Icon
                                        source="check"
                                        size={18}
                                        color={theme.colors.primary}
                                    />
                                )}
                            </View>
                        </TouchableRipple>
                    );
                })}

                {localMethod !== 'cash' && (
                    <View style={{ marginTop: 20 }}>
                        <TextInput
                            mode="outlined"
                            label={getInputLabel()}
                            placeholder={getInputPlaceholder()}
                            value={localNote}
                            onChangeText={setLocalNote}
                            style={{ backgroundColor: theme.colors.surface }}
                            theme={{ roundness: 12 }}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>
                )}
            </View>
        </BaseBottomSheet>
    );
});

export default PaymentMethodBottomSheet;
