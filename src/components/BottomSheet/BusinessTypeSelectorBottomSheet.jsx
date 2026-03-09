import React, { useMemo, useState, useCallback, forwardRef } from 'react';
import { View, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
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
import businessTypes from '../../assets/data/businessTypes.json';

const BusinessTypeSelectorBottomSheet = forwardRef(
  (
    {
      onBusinessSelect,
      selectedBusiness = null,
      showSearch = true,
      placeholder = 'Search business types...',
      title = 'Select Business Type',
      ...props
    },
    ref,
  ) => {
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    // JSON is already flat
    const flattenedTypes = useMemo(() => businessTypes, []);

    // ✅ fixed filtering logic (no category check)
    const filteredTypes = useMemo(() => {
      let result = [...flattenedTypes];
      
      // Filter by search query if provided
      if (searchQuery.trim()) {
        const lowerQuery = searchQuery.toLowerCase();
        result = result.filter(item => 
          item.label?.toLowerCase().includes(lowerQuery)
        );
      }
      
      // Sort alphabetically by label
      result.sort((a, b) => a.label.localeCompare(b.label));
      
      // If there's a selected business, move it to the top
      if (selectedBusiness) {
        const selectedIndex = result.findIndex(
          item => item.label === selectedBusiness.label
        );
        if (selectedIndex > 0) {
          const [selectedItem] = result.splice(selectedIndex, 1);
          result.unshift(selectedItem);
        }
      }
      
      return result;
    }, [flattenedTypes, searchQuery, selectedBusiness]);

    const handleBusinessSelect = useCallback(
      business => {
        onBusinessSelect(business);
        setSearchQuery('');
        if (ref?.current) ref.current.close();
      },
      [onBusinessSelect],
    );

    const handleClose = useCallback(() => {
      setSearchQuery('');
      if (ref?.current) ref.current.close();
    }, [ref]);

    const renderHeader = useMemo(
      () => (
        <View style={styles.header}>
          <View style={styles.titleHeader}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {title}
            </Text>
            <IconButton
              icon="close"
              size={24}
              iconColor={theme.colors.onSurface}
              onPress={handleClose}
            />
          </View>
          <Divider bold />
          {showSearch && (
            <Searchbar
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
      [theme, title, handleClose, showSearch, searchQuery],
    );

    const renderList = useMemo(() => {
      if (filteredTypes.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Icon
              source="store-search-outline"
              size={48}
              color={theme.colors.outline}
            />
            <Text style={[styles.emptyText, { color: theme.colors.outline }]}>
              No business found
            </Text>
            <Text
              style={[styles.emptySubtext, { color: theme.colors.outline }]}
            >
              Try a different keyword
            </Text>
          </View>
        );
      }

      return (
        <ScrollView>
          {filteredTypes.map(item => {
            const selected = selectedBusiness?.label === item.label;
            return (
              <List.Item
                key={item.label}
                title={item.label}
                onPress={() => handleBusinessSelect(item)}
                left={props => (
                  <List.Icon
                    {...props}
                    icon={selected ? 'check-circle' : 'store-outline'}
                    color={
                      selected
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant
                    }
                  />
                )}
                style={[
                  styles.item,
                  selected && {
                    backgroundColor: theme.colors.primaryContainer,
                  },
                ]}
                titleStyle={[
                  { fontWeight: '500' },
                  selected && {
                    color: theme.colors.primary,
                    fontWeight: '600',
                  },
                ]}
              />
            );
          })}
        </ScrollView>
      );
    }, [filteredTypes, theme, handleBusinessSelect, selectedBusiness]);

    return (
      <BaseBottomSheet
        ref={ref}
        title={title}
        initialSnapIndex={-1}
        snapPoints={['85%']}
        contentType="scroll"
        headerComponent={renderHeader}
        {...props}
      >
        {loading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          renderList
        )}
      </BaseBottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  header: {},
  titleHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingTop: 8,
  },
  title: { fontSize: 20, fontWeight: '600' },
  searchBar: {
    marginHorizontal: 20,
    borderRadius: 12,
    elevation: 1,
    marginTop: 8,
  },
  searchInput: { fontSize: 16 },
  item: {
    paddingVertical: 8,
    paddingHorizontal: 16,
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
  emptySubtext: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

export default BusinessTypeSelectorBottomSheet;
