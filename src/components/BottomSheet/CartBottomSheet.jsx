// components/BottomSheet/CartBottomSheet.jsx
import React, { forwardRef } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, IconButton, Button, Divider, useTheme } from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';


const CartBottomSheet = forwardRef(({ cart, onUpdateQty, onRemove, onCheckout }, ref) => {
    const theme = useTheme();

    // Function to close the bottom sheet
    const handleCancel = () => {
        ref.current?.close();
    };

    const renderCartItem = ({ item }) => (
        <View style={[styles.itemContainer, {
            borderBottomColor: theme.colors.outlineVariant,
            backgroundColor: theme.colors.elevation.level1
        }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
                <Text variant="titleSmall" style={{ fontWeight: '600', marginBottom: 4 }}>
                    {item.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        ₹{item.price.toFixed(2)} × {item.qty}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                        •
                    </Text>
                    <Text variant="titleSmall" style={{
                        color: theme.colors.primary,
                        fontWeight: '700'
                    }}>
                        ₹{item.subtotal.toFixed(2)}
                    </Text>
                </View>
            </View>


            <View style={styles.controls}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: theme.colors.surfaceVariant,
                    borderRadius: 8,
                    paddingHorizontal: 2,
                }}>
                    <IconButton
                        icon="minus"
                        size={18}
                        iconColor={theme.colors.onSurfaceVariant}
                        style={{ margin: 0 }}
                        onPress={() => onUpdateQty(item._id, Math.max(0, item.qty - 1))}
                    />
                    <Text style={[styles.qtyText, {
                        color: theme.colors.onSurface,
                        fontWeight: '600',
                        minWidth: 24,
                        textAlign: 'center'
                    }]}>
                        {item.qty}
                    </Text>
                    <IconButton
                        icon="plus"
                        size={18}
                        iconColor={theme.colors.onSurfaceVariant}
                        style={{ margin: 0 }}
                        onPress={() => onUpdateQty(item._id, item.qty + 1)}
                    />
                </View>


                <IconButton
                    icon="delete-outline"
                    size={20}
                    iconColor={theme.colors.error}
                    containerColor={theme.colors.errorContainer}
                    style={{ margin: 0, marginLeft: 4 }}
                    onPress={() => onRemove(item._id)}
                />
            </View>
        </View>
    );



    const total = cart.reduce((s, i) => s + i.subtotal, 0);


    return (
        <BaseBottomSheet
            ref={ref}
            title="Cart"
            snapPoints={['50%', '80%']}
            initialSnapIndex={-1}
            enablePanDownToClose
            contentType="flatlist"
            data={cart}
            contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 12 , paddingTop: 8}}
            renderItem={renderCartItem}
            keyExtractor={item => item._id?.toString() || item.name}
            footerComponent={
                <View style={[styles.footer, {
                    backgroundColor: theme.colors.surface,
                    borderTopColor: theme.colors.outlineVariant
                }]}>
                    <View style={styles.footerContent}>
                        {/* Left side - Total info */}
                        <View style={styles.totalInfo}>
                            <Text variant="labelSmall" style={{
                                color: theme.colors.onSurfaceVariant,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5
                            }}>
                                Total ({cart.length} {cart.length === 1 ? 'item' : 'items'})
                            </Text>
                            <Text variant="titleLarge" style={{
                                color: theme.colors.primary,
                                fontWeight: '600',
                                marginTop: 2
                            }}>
                                ₹{total.toFixed(2)}
                            </Text>
                        </View>

                        {/* Right side - Action buttons */}
                        <View style={styles.actionButtons}>
                            <Button
                                mode='text'
                                onPress={handleCancel}
                                textColor={theme.colors.onSurfaceVariant}
                                style={styles.cancelBtn}
                                labelStyle={{ fontSize: 14, fontWeight: '600' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                mode='contained'
                                onPress={onCheckout}
                                disabled={cart.length === 0}
                                style={styles.checkoutBtn}
                                contentStyle={{ flexDirection: 'row-reverse' }}
                                labelStyle={{ fontSize: 15, fontWeight: '700' }}
                                icon="arrow-right"
                            >
                                Done
                            </Button>
                        </View>
                    </View>
                </View>
            }
        />
    );
});


const styles = StyleSheet.create({
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderRadius: 8,
        marginBottom: 6,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    qtyText: {
        fontSize: 14,
    },
    footer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderTopWidth: 1,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    footerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    totalInfo: {
        flex: 1,
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cancelBtn: {
        borderRadius: 8,
    },
    checkoutBtn: {
        borderRadius: 10,
        elevation: 0,
    },
});


export default CartBottomSheet;
