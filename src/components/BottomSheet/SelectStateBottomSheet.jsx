// components/BottomSheet/StateSelectorBottomSheet.jsx
import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
} from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import {
  Searchbar,
  List,
  Divider,
  Icon,
  Text,
  useTheme,
  IconButton,
  Chip,
} from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';
import indianStates from '../../assets/data/states.json';

const StateSelectorBottomSheet = React.forwardRef(
  (
    {
      onStateSelect,
      selectedState = null,
      showSearch = true,
      placeholder = 'Search states...',
      title = 'Select State',
      showRegionFilter = true,
      showCapital = true,
      ...props
    },
    ref,
  ) => {
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRegion, setSelectedRegion] = useState('');
    const [loading, setLoading] = useState(false);

    const states = indianStates?.states || [];
    useEffect(() => {
      // console.log('States:', indianStates);
      // console.log('States:', states);
    });

    // Get unique regions for filter chips
    const regions = useMemo(() => {
      if (!states || states.length === 0) return [];
      const uniqueRegions = [...new Set(states.map(state => state.region))];
      return uniqueRegions.sort();
    }, [states]);

    // Filter states based on search and region
    const filteredStates = useMemo(() => {
      if (!states || states.length === 0) return [];

      let filtered = states;

      // Filter by region if selected
      if (selectedRegion) {
        filtered = filtered.filter(state => state.region === selectedRegion);
      }

      // Filter by search query
      if (searchQuery) {
        filtered = filtered.filter(
          state =>
            state.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            state.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (showCapital &&
              state.capital.toLowerCase().includes(searchQuery.toLowerCase())),
        );
      }

      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }, [states, searchQuery, selectedRegion, showCapital]);

    const handleStateSelect = useCallback(
      state => {
        onStateSelect(state);
        setSearchQuery('');
        setSelectedRegion('');
      },
      [onStateSelect],
    );

    const handleClose = useCallback(() => {
      setSearchQuery('');
      setSelectedRegion('');
      if (ref?.current) {
        ref.current.close();
      }
    }, [ref]);

    const handleRegionFilter = useCallback(
      region => {
        setSelectedRegion(selectedRegion === region ? '' : region);
      },
      [selectedRegion],
    );

    const isSelected = useCallback(
      state => {
        if (!selectedState) return false;
        return (
          selectedState.id === state.id || selectedState.code === state.code
        );
      },
      [selectedState],
    );

    const renderStateItem = useCallback(
      ({ item }) => {
        const selected = isSelected(item);
        const description = showCapital
          ? `${item.code} • ${item.capital}`
          : `${item.code} • ${item.region}`;

        return (
          <List.Item
            title={item.name}
            description={description}
            left={props => (
              <List.Icon
                {...props}
                icon={selected ? 'check-circle' : 'map-marker-outline'}
                color={
                  selected
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant
                }
              />
            )}
            right={() => (
              <View style={styles.stateItemRight}>
                <Text
                  style={[styles.regionText, { color: theme.colors.outline }]}
                >
                  {item.region}
                </Text>
              </View>
            )}
            onPress={() => handleStateSelect(item)}
            style={[
              styles.stateItem,
              selected && { backgroundColor: theme.colors.primaryContainer },
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
      [theme, handleStateSelect, isSelected, showCapital],
    );

    // const renderRegionFilters = useMemo(() => {
    //   if (!showRegionFilter) return null;

    //   return (
    //     <View style={styles.filterContainer}>
    //       <Text
    //         style={[
    //           styles.filterTitle,
    //           { color: theme.colors.onSurfaceVariant },
    //         ]}
    //       >
    //         Filter by Region:
    //       </Text>
    //       <View style={styles.chipContainer}>
    //         {regions.map(region => (
    //           <Chip
    //             key={region}
    //             selected={selectedRegion === region}
    //             onPress={() => handleRegionFilter(region)}
    //             style={[
    //               styles.regionChip,
    //               selectedRegion === region && {
    //                 backgroundColor: theme.colors.primaryContainer,
    //               },
    //             ]}
    //             textStyle={[
    //               styles.chipText,
    //               selectedRegion === region && {
    //                 color: theme.colors.primary,
    //                 fontWeight: '600',
    //               },
    //             ]}
    //             mode={selectedRegion === region ? 'flat' : 'outlined'}
    //           >
    //             {region}
    //           </Chip>
    //         ))}
    //       </View>
    //     </View>
    //   );
    // }, [showRegionFilter, regions, selectedRegion, theme, handleRegionFilter]);

    const renderHeader = useMemo(
      () => (
        <View style={styles.customHeader}>
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

          {selectedRegion && (
            <View style={styles.activeFilterContainer}>
              <Text
                style={[
                  styles.activeFilterText,
                  { color: theme.colors.primary },
                ]}
              >
                Showing {filteredStates.length} states in {selectedRegion}{' '}
                region
              </Text>
            </View>
          )}
        </View>
      ),
      [
        showSearch,
        searchQuery,
        placeholder,
        theme,
        title,
        handleClose,
        //renderRegionFilters,
        selectedRegion,
        filteredStates.length,
      ],
    );

    const emptyComponent = useMemo(
      () => (
        <View style={styles.emptyContainer}>
          <Icon
            source="map-search-outline"
            size={48}
            color={theme.colors.outline}
          />
          <Text style={[styles.emptyText, { color: theme.colors.outline }]}>
            No states found
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.colors.outline }]}>
            Try different search terms or change region filter
          </Text>
        </View>
      ),
      [theme],
    );

    return (
      <BaseBottomSheet
        ref={ref}
        title={title}
        contentType="flatlist"
        data={filteredStates}
        renderItem={renderStateItem}
        keyExtractor={item => item.id.toString()}
        headerComponent={renderHeader}
        initialSnapIndex={
          props.initialSnapIndex !== undefined ? props.initialSnapIndex : -1
        }
        {...props}
      >
        {loading && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}
        {!loading && filteredStates.length === 0 && emptyComponent}
      </BaseBottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  customHeader: {},
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
  filterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  regionChip: {
    marginRight: 4,
    marginBottom: 4,
  },
  chipText: {
    fontSize: 12,
  },
  searchBar: {
    marginHorizontal: 20,
    borderRadius: 12,
    elevation: 1,
    marginTop: 8,
  },
  searchInput: {
    fontSize: 16,
  },
  activeFilterContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  stateItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
  },
  stateItemRight: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  regionText: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

export default StateSelectorBottomSheet;
