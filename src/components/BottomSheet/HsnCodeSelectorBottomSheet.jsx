// components/BottomSheet/HsnCodeSelectorBottomSheet.jsx
import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
} from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import {
  Searchbar,
  List,
  Divider,
  Icon,
  Text,
  useTheme,
  IconButton,
  Button,
  Chip,
} from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';
import api from '../../utils/api';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

const HsnCodeSelectorBottomSheet = React.forwardRef(
  (
    {
      onHsnCodeSelect,
      onAddNewHsnCode,
      selectedHsnCode = null,
      showSearch = true,
      placeholder = 'Search HSN codes...',
      title = 'Select HSN Code',
      refreshKey = null,
      ...props
    },
    ref,
  ) => {
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const [hsnCodes, setHsnCodes] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      fetchHsnCodes();
      if (refreshKey) {
        fetchHsnCodes();
      }
    }, [refreshKey]);

    const fetchHsnCodes = async () => {
      // console.log('Fetching HSN codes...');
      try {
        setLoading(true);
        const res = await api.get('/hsncode');
        // console.log('HSN codes fetched:', res);
        if (res.success) {
          setHsnCodes(res.data);
        }
      } catch (error) {
        console.error('Error fetching HSN codes:', error);
      } finally {
        setLoading(false);
      }
    };

    // Filter HSN codes based on search
    const filteredHsnCodes = useMemo(() => {
      let filtered = hsnCodes;

      if (searchQuery) {
        filtered = filtered.filter(
          hsnCode =>
            hsnCode.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (hsnCode.description &&
              hsnCode.description
                .toLowerCase()
                .includes(searchQuery.toLowerCase())),
        );
      }

      return filtered.sort((a, b) => a.code.localeCompare(b.code));
    }, [hsnCodes, searchQuery]);

    const handleHsnCodeSelect = useCallback(
      hsnCode => {
        // Check if the clicked HSN code is already selected
        const isCurrentlySelected =
          selectedHsnCode && selectedHsnCode._id === hsnCode._id;

        if (isCurrentlySelected) {
          // If already selected, deselect it by passing null
          onHsnCodeSelect(null);
        } else {
          // If not selected, select it
          onHsnCodeSelect(hsnCode);
        }

        setSearchQuery('');
        // if (ref) {
        //   ref.close();
        // }
      },
      [onHsnCodeSelect, selectedHsnCode, ref],
    );

    const handleClose = useCallback(() => {
      setSearchQuery('');
      if (ref?.current) {
        ref.current.close();
      }
    }, [ref]);

    const handleAddNewHsnCode = useCallback(async () => {
      if (isAddingNew) return; // Prevent multiple calls

      setIsAddingNew(true);

      try {
        setSearchQuery('');
        await onAddNewHsnCode?.();
        fetchHsnCodes();
      } catch (error) {
        console.error('Error in handleAddNewHsnCode:', error);
      } finally {
        setTimeout(() => setIsAddingNew(false), 500);
      }
    }, [onAddNewHsnCode, isAddingNew]);

    const handleUpdateHsnCode = useCallback(
      async hsnCode => {
        if (isUpdating) return;
        setIsUpdating(true);
        try {
          setSearchQuery('');
          await onAddNewHsnCode?.(hsnCode);
          fetchHsnCodes();
        } catch (error) {
          console.error('Error in handleUpdateHsnCode:', error);
        } finally {
          setTimeout(() => setIsUpdating(false), 500);
        }
      },
      [onAddNewHsnCode, isUpdating],
    );

    // Handle Delete
    const handleDelete = useCallback(hsnCode => {
      Alert.alert(
        'Confirm Delete',
        `Are you sure you want to delete HSN code "${hsnCode.code}"?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                setLoading(true);
                await api.delete(`/hsncode/${hsnCode._id}`);
                Toast.show({
                  type: 'success',
                  text1: 'Success',
                  text2: 'HSN code deleted successfully!',
                });
                fetchHsnCodes();
              } catch (error) {
                console.error('Error deleting HSN code:', error);
              } finally {
                setLoading(false);
              }
            },
          },
        ],
        { cancelable: true },
      );
    }, []);

    const isSelected = useCallback(
      hsnCode => {
        if (!selectedHsnCode) return false;
        return selectedHsnCode._id == hsnCode._id;
      },
      [selectedHsnCode],
    );

    const getGstRateColor = useCallback(
      gstRate => {
        if (gstRate === 0) return theme.colors.outline;
        if (gstRate <= 5) return '#4CAF50'; // Green
        if (gstRate <= 12) return '#FF9800'; // Orange
        if (gstRate <= 18) return '#FF5722'; // Red
        return '#9C27B0'; // Purple for higher rates
      },
      [theme],
    );

    const renderHsnCodeItem = useCallback(
      ({ item }) => {
        const selected = isSelected(item);
        return (
          <List.Item
            title={`${item.code}`}
            description={item.description || 'No description'}
            left={props => (
              <List.Icon
                {...props}
                icon={selected ? 'check-circle' : 'barcode-scan'}
                color={
                  selected
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant
                }
              />
            )}
            right={() => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Chip
                  compact
                  textStyle={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: getGstRateColor(item.gstRate),
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: getGstRateColor(item.gstRate),
                    borderWidth: 1,
                    marginRight: 8,
                  }}
                >
                  {item.gstRate}%
                </Chip>
                {/* <IconButton
                  icon="pencil-outline"
                  size={20}
                  onPress={() => {
                    handleUpdateHsnCode(item);
                  }}
                  iconColor={theme.colors.onSurfaceVariant}
                />
                <IconButton
                  icon="delete-outline"
                  size={20}
                  onPress={() => {
                    handleDelete(item);
                  }}
                  iconColor={theme.colors.onSurfaceVariant}
                /> */}
              </View>
            )}
            onPress={() => handleHsnCodeSelect(item)}
            style={[
              styles.hsnCodeItem,
              selected && { backgroundColor: theme.colors.primaryContainer },
            ]}
            titleStyle={[
              { fontWeight: '600', fontSize: 16 },
              selected && { color: theme.colors.primary, fontWeight: '700' },
            ]}
            descriptionStyle={[
              { fontSize: 12, color: theme.colors.outline },
              selected && { color: theme.colors.primary },
            ]}
          />
        );
      },
      [theme, handleHsnCodeSelect, isSelected, getGstRateColor],
    );

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

          <View style={styles.addButtonContainer}>
            <Button
              mode="text"
              onPress={handleAddNewHsnCode}
              disabled={isAddingNew}
              style={[
                styles.addButton,
                isAddingNew && styles.addButtonDisabled,
              ]}
              contentStyle={styles.addButtonContent}
              labelStyle={[
                styles.addButtonLabel,
                {
                  color: isAddingNew
                    ? theme.colors.onSurfaceVariant
                    : theme.colors.primary,
                },
              ]}
              icon={isAddingNew ? 'loading' : 'plus-circle-outline'}
              loading={isAddingNew}
            >
              {isAddingNew ? 'Opening...' : 'Add New HSN Code'}
            </Button>
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
      [
        showSearch,
        searchQuery,
        placeholder,
        theme,
        title,
        handleClose,
        handleAddNewHsnCode,
        isAddingNew,
      ],
    );

    const emptyComponent = useMemo(
      () => (
        <View style={styles.emptyContainer}>
          <Icon source="barcode-scan" size={48} color={theme.colors.outline} />
          <Text style={[styles.emptyText, { color: theme.colors.outline }]}>
            No HSN codes found
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.colors.outline }]}>
            Try different search terms or add a new HSN code
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
        data={filteredHsnCodes}
        renderItem={renderHsnCodeItem}
        keyExtractor={item => item._id.toString()}
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
        {!loading && filteredHsnCodes.length === 0 && emptyComponent}
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
  addButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: 'flex-start',
  },
  addButton: {
    borderRadius: 8,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonContent: {
    height: 40,
    paddingHorizontal: 8,
  },
  addButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
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
  hsnCodeItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 16,
    marginVertical: 8,
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

export default HsnCodeSelectorBottomSheet;
