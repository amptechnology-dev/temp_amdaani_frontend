// components/BottomSheet/UnitSelectorBottomSheet.jsx
import React, { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Searchbar,
  List,
  Divider,
  Icon,
  Text,
  useTheme,
  IconButton,
} from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';

const UnitSelectorBottomSheet = React.forwardRef(
  (
    {
      units,
      onUnitSelect,
      selectedUnit = null,
      showSearch = true,
      placeholder = 'Search units...',
      title = 'Select Unit',
      ...props
    },
    ref,
  ) => {
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const searchRef = React.useRef(null);

    const handleSheetChange = useCallback(
      index => {
        if (index >= 0 && showSearch) {
          // sheet open ho gayi
          setTimeout(() => {
            searchRef.current?.focus();
          }, 300); // thoda delay dena zaroori hai animation ke liye
        }
      },
      [showSearch],
    );

    // Filter units based on search only and show selected item first
    const filteredUnits = useMemo(() => {
      let filtered = [...units];

      if (searchQuery) {
        filtered = filtered.filter(
          unit =>
            unit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            unit.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (unit.description &&
              unit.description
                .toLowerCase()
                .includes(searchQuery.toLowerCase())),
        );
      }

      // Sort by name, but put selected unit first
      return filtered.sort((a, b) => {
        if (selectedUnit) {
          if (a.id === selectedUnit.id) return -1;
          if (b.id === selectedUnit.id) return 1;
        }
        return a.name.localeCompare(b.name);
      });
    }, [units, searchQuery]);

    const handleUnitSelect = useCallback(
      unit => {
        onUnitSelect(unit);
        setSearchQuery('');
      },
      [onUnitSelect],
    );

    const handleClose = useCallback(() => {
      // if (onClose) {
      //   onClose();
      // }
      // If ref is available, close the bottom sheet
      if (ref?.current) {
        ref.current.close();
      }
    }, [ref]);

    const isSelected = useCallback(
      unit => {
        if (!selectedUnit) return false;
        return selectedUnit.id === unit.id;
      },
      [selectedUnit],
    );

    const renderUnitItem = useCallback(
      ({ item }) => {
        const selected = isSelected(item);
        return (
          <List.Item
            title={item.name}
            description={`Symbol: ${item.symbol}${
              item.description ? ` • ${item.description}` : ''
            }`}
            left={props => (
              <List.Icon
                {...props}
                icon={selected ? 'check-circle' : 'format-list-bulleted'}
                color={
                  selected
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant
                }
              />
            )}
            onPress={() => handleUnitSelect(item)}
            style={[
              styles.unitItem,
              selected && {
                backgroundColor: theme.colors.primaryContainer,
              },
            ]}
            titleStyle={[
              { fontWeight: '500' },
              selected && { color: theme.colors.primary, fontWeight: '600' },
            ]}
            descriptionStyle={[
              { fontSize: 12, color: theme.colors.outline },
              selected && { color: theme.colors.primary },
            ]}
          />
        );
      },
      [theme, handleUnitSelect, isSelected],
    );

    const renderHeader = useMemo(
      () => (
        <View style={styles.customHeader}>
          {/* Title and Close Button Header */}
          <View style={styles.titleHeader}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {title}
            </Text>
            <IconButton
              icon="close"
              size={24}
              iconColor={theme.colors.onSurface}
              onPress={handleClose}
              style={styles.closeButton}
            />
          </View>
          <Divider bold />

          {showSearch && (
            <Searchbar
              ref={searchRef}
              placeholder={placeholder}
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={[
                styles.searchBar,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
              inputStyle={styles.searchInput}
              iconColor={theme.colors.primary}
            />
          )}
        </View>
      ),
      [showSearch, searchQuery, placeholder, theme, title, handleClose],
    );

    const emptyComponent = useMemo(
      () => (
        <View style={styles.emptyContainer}>
          <Icon source="magnify" size={48} color={theme.colors.outline} />
          <Text style={[styles.emptyText, { color: theme.colors.outline }]}>
            No units found
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.colors.outline }]}>
            Try different search terms
          </Text>
        </View>
      ),
      [theme],
    );

    // Prevent auto-open: set initialSnapIndex to -1 unless overridden
    return (
      <BaseBottomSheet
        ref={ref}
        title={title}
        contentType="flatlist"
        data={filteredUnits}
        renderItem={renderUnitItem}
        keyExtractor={item => item.id.toString()}
        headerComponent={renderHeader}
        onChange={handleSheetChange} // 👈 yeh add karo
        initialSnapIndex={
          props.initialSnapIndex !== undefined ? props.initialSnapIndex : -1
        }
        {...props}
      >
        {filteredUnits.length === 0 && emptyComponent}
      </BaseBottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  customHeader: {
    // paddingHorizontal: 20,
  },
  titleHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingTop: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    margin: 0,
  },
  searchBar: {
    marginHorizontal: 20,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    marginTop: 8,
  },
  searchInput: {
    fontSize: 16,
  },
  unitItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 2,
    borderRadius: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default UnitSelectorBottomSheet;
