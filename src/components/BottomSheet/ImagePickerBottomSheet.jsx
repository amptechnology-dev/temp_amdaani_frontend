import React, { forwardRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, useTheme, Icon } from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';

const DEFAULT_OPTIONS = [
    { id: 'camera', label: 'Take Picture', description: 'Open camera to capture', icon: 'camera-outline' },
    { id: 'gallery', label: 'Pick Photo', description: 'Choose from your photos', icon: 'image-multiple-outline' },
];

const ImagePickerBottomSheet = forwardRef(
    (
        {
            title = 'Select Source',
            subtitle = '',
            onSelect, // (option) => void
            snapPoints = ['60%'],
            initialSnapIndex = -1,
            contentContainerStyle,
            options = DEFAULT_OPTIONS, // NEW
            ...restProps
        },
        ref
    ) => {
        const theme = useTheme();

        const headerComponent = useMemo(
            () => (
                <View
                    style={[
                        styles.header,
                        { borderBottomColor: theme.colors.outlineVariant },
                    ]}
                >
                    <View style={styles.headerContent}>
                        <View style={styles.headerLeft}>
                            <View style={styles.headerText}>
                                <Text variant="titleMedium" style={styles.title}>{title}</Text>
                                {!!subtitle && (
                                    <Text variant="bodySmall" style={styles.subtitle}>{subtitle}</Text>
                                )}
                            </View>
                        </View>
                    </View>
                </View>
            ),
            [theme, title, subtitle]
        );

        const renderOption = useCallback(
            ({ item }) => {
                const handlePress = () => onSelect?.(item);
                return (
                    <TouchableOpacity
                        onPress={handlePress}
                        activeOpacity={0.8}
                        style={[
                            styles.optionItem,
                            {
                                borderColor: theme.colors.outlineVariant,
                                backgroundColor:
                                    theme.colors.elevation?.level1 || theme.colors.surface,
                            },
                        ]}
                    >
                        <View style={styles.optionLeft}>
                            <Icon source={item.icon} size={28} color={theme.colors.primary} />
                            <View style={styles.optionText}>
                                <Text variant="titleSmall" style={styles.optionLabel}>
                                    {item.label}
                                </Text>
                                {!!item.description && (
                                    <Text
                                        variant="bodySmall"
                                        style={[styles.optionDescription, { color: theme.colors.onSurfaceVariant }]}
                                    >
                                        {item.description}
                                    </Text>
                                )}
                            </View>
                        </View>
                        <Icon source="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
                    </TouchableOpacity>
                );
            },
            [onSelect, theme]
        );

        return (
            <BaseBottomSheet
                ref={ref}
                contentType="flatlist"
                data={options}
                renderItem={renderOption}
                keyExtractor={(item) => item.id}
                initialSnapIndex={initialSnapIndex}
                headerComponent={headerComponent}
                contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
                snapPoints={snapPoints}
                enablePanDownToClose
                {...restProps}
            />
        );
    }
);

const styles = StyleSheet.create({
    header: { borderBottomWidth: 1, paddingHorizontal: 20, paddingVertical: 16 },
    headerContent: { flexDirection: 'row', alignItems: 'center' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerText: { flex: 1 },
    title: { fontWeight: '600', marginBottom: 2 },
    subtitle: { fontSize: 13, opacity: 0.7 },
    contentContainer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
    optionItem: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 16, paddingHorizontal: 16,
        borderRadius: 12, borderWidth: 1, marginBottom: 12,
        elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 2,
    },
    optionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    optionText: { marginLeft: 12, flex: 1 },
    optionLabel: { fontSize: 16, marginBottom: 2 },
    optionDescription: { fontSize: 12, lineHeight: 16 },
});

ImagePickerBottomSheet.displayName = 'ImagePickerBottomSheet';
export default ImagePickerBottomSheet;
