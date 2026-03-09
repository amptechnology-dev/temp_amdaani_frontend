// DiscountTypeSelectorBottomSheet.jsx
import React, { forwardRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, useTheme, RadioButton, Icon } from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';

const DISCOUNT_TYPE_OPTIONS = [
    {
        id: 'percentage',
        label: 'Percentage',
        description: 'Discount as percentage of sales price',
        icon: 'percent',
        symbol: '%'
    },
    {
        id: 'amount',
        label: 'Amount',
        description: 'Fixed discount amount',
        icon: 'currency-inr',
        symbol: '₹'
    }
];

const DiscountTypeSelectorBottomSheet = forwardRef(({
    selectedDiscountType,
    onDiscountTypeSelect,
    title = "Select Discount Type",
    initialSnapIndex = -1,
    ...restProps
}, ref) => {
    const theme = useTheme();

    const handleOptionSelect = useCallback((option) => {
        onDiscountTypeSelect?.(option);
    }, [onDiscountTypeSelect]);

    // Helper function to check if option is selected
    const isOptionSelected = useCallback((optionId) => {
        return selectedDiscountType?.id === optionId;
    }, [selectedDiscountType]);

    const renderDiscountOption = useCallback(({ item }) => {
        const isSelected = isOptionSelected(item.id);
        
        return (
            <TouchableOpacity
                style={[
                    styles.optionItem,
                    {
                        backgroundColor: isSelected
                            ? theme.colors.primaryContainer
                            : theme.colors.surface,
                        borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.outline,
                    }
                ]}
                onPress={() => handleOptionSelect(item)}
                activeOpacity={0.7}
            >
                <View style={styles.optionLeft}>
                    <Icon
                        source={item.icon}
                        size={24}
                        color={isSelected ? theme.colors.primary : theme.colors.onSurface}
                    />
                    <View style={styles.optionText}>
                        <Text
                            style={[
                                styles.optionLabel,
                                {
                                    color: isSelected
                                        ? theme.colors.primary
                                        : theme.colors.onSurface,
                                    fontWeight: isSelected ? '600' : '400'
                                }
                            ]}
                        >
                            {item.label} ({item.symbol})
                        </Text>
                        <Text
                            style={[
                                styles.optionDescription,
                                {
                                    color: isSelected
                                        ? theme.colors.onPrimaryContainer
                                        : theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            {item.description}
                        </Text>
                    </View>
                </View>
                <RadioButton
                    value={item.id}
                    status={isSelected ? 'checked' : 'unchecked'}
                    onPress={() => handleOptionSelect(item)}
                    color={theme.colors.primary}
                />
            </TouchableOpacity>
        );
    }, [isOptionSelected, handleOptionSelect, theme]);

    const headerComponent = (
        <View style={[styles.header, { borderBottomColor: theme.colors.outline }]}>
            <View style={styles.headerContent}>
                <View style={styles.headerLeft}>
                    <Icon source="sale" size={24} color={theme.colors.primary} />
                    <View style={styles.headerText}>
                        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                            {title}
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                            Current: {selectedDiscountType?.label || 'None selected'}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );

    return (
        <BaseBottomSheet
            ref={ref}
            initialSnapIndex={initialSnapIndex}
            enablePanDownToClose={true}
            enableHandlePanningGesture={true}
            enableContentPanningGesture={true}
            showHandle={true}
            headerComponent={headerComponent}
            showHeader={false}
            contentType="flatlist"
            data={DISCOUNT_TYPE_OPTIONS}
            renderItem={renderDiscountOption}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.contentContainer}
            {...restProps}
        />
    );
});

const styles = StyleSheet.create({
    header: {
        borderBottomWidth: 1,
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    headerText: {
        marginLeft: 12,
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 14,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    optionText: {
        marginLeft: 12,
        flex: 1,
    },
    optionLabel: {
        fontSize: 16,
        marginBottom: 2,
    },
    optionDescription: {
        fontSize: 12,
        lineHeight: 16,
    },
});

DiscountTypeSelectorBottomSheet.displayName = 'DiscountTypeSelectorBottomSheet';

export default DiscountTypeSelectorBottomSheet;
