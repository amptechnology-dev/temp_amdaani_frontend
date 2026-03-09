import React, { forwardRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, Text, Badge, Icon } from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';
import gstRatesData from '../../assets/data/gstRates.json';

const TaxRateSelectorBottomSheet = forwardRef(({
  selectedTaxRate,
  onTaxRateSelect,
  title = "Select Tax Rate",
  initialSnapIndex = -1,
  ...restProps
}, ref) => {
  const theme = useTheme();

  // Get tax rates from JSON data
  const { taxRates } = gstRatesData;

  const handleTaxRateSelect = useCallback((taxRate) => {
    onTaxRateSelect?.(taxRate);
  }, [onTaxRateSelect]);

  // Helper function to check if tax rate is selected
  const isTaxRateSelected = useCallback((taxRateId) => {
    return selectedTaxRate?.id === taxRateId;
  }, [selectedTaxRate]);

  const renderTaxRateItem = useCallback(({ item: taxRate }) => {
    const isSelected = isTaxRateSelected(taxRate.id);

    return (
      <TouchableOpacity
        onPress={() => handleTaxRateSelect(taxRate)}
        style={[
          styles.taxRateItem,
          {
            backgroundColor: isSelected ? theme.colors.primaryContainer : theme.colors.surface,
            borderColor: isSelected ? theme.colors.primary : theme.colors.outline,
          }
        ]}
        activeOpacity={0.7}
      >
        <View style={styles.taxRateLeft}>
          <Icon
            source={taxRate.category === 'Interstate' ? 'swap-horizontal' : 'percent'}
            size={20}
            color={isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant}
          />
          <View style={styles.taxRateText}>
            <Text style={[
              styles.taxRateLabel,
              {
                color: isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurface,
                fontWeight: isSelected ? '600' : '400'
              }
            ]}>
              {taxRate.label}
            </Text>
            <Text style={[
              styles.taxRateDescription,
              {
                color: isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant
              }
            ]}>
              {taxRate.description}
            </Text>
          </View>
        </View>

        <Badge
          style={[
            styles.rateBadge,
            {
              backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceVariant,
              color: isSelected ? theme.colors.onPrimary : theme.colors.onSecondaryContainer
            }
          ]}
          textColor={isSelected ? theme.colors.onPrimary : theme.colors.onSecondaryContainer}
        >
          {taxRate.rate}%
        </Badge>
      </TouchableOpacity>
    );
  }, [isTaxRateSelected, handleTaxRateSelect, theme]);

  const headerComponent = (
    <View style={[styles.header, { borderBottomColor: theme.colors.outline }]}>
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          <Icon
            source="percent"
            size={24}
            color={theme.colors.primary}
          />
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {title}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
              Current: {selectedTaxRate?.label || 'None selected'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <BaseBottomSheet
      ref={ref}
      snapPoints={['70%', '90%']}
      initialSnapIndex={initialSnapIndex}
      headerComponent={headerComponent}
      contentType="flatlist"
      data={taxRates}
      renderItem={renderTaxRateItem}
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
    paddingBottom: 40
  },
  taxRateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  taxRateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  taxRateText: {
    marginLeft: 12,
    flex: 1,
  },
  taxRateLabel: {
    fontSize: 16,
    marginBottom: 2,
  },
  taxRateDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  rateBadge: {
    paddingHorizontal: 8,
    // paddingVertical: 2,
    // marginLeft: 12,
    textAlign: 'center'
  },
});

TaxRateSelectorBottomSheet.displayName = 'TaxRateSelectorBottomSheet';

export default TaxRateSelectorBottomSheet;
