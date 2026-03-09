// components/BottomSheet/CategorySelectorBottomSheet.jsx
import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
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
} from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';
import api from '../../utils/api';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import CustomAlert from '../CustomAlert';

const CategorySelectorBottomSheet = React.forwardRef(
  (
    {
      onCategorySelect,
      onAddNewCategory,
      selectedCategory = null,
      showSearch = true,
      placeholder = 'Search categories...',
      title = 'Select Category',
      refreshKey = null,
      ...props
    },
    ref,
  ) => {
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [alertVisible, setAlertVisible] = useState(false);
    const [selectedCategoryToDelete, setSelectedCategoryToDelete] =
      useState(null);

    useEffect(() => {
      fetchCategories();
      if (refreshKey) {
        fetchCategories();
      }
    }, [refreshKey]);

    const fetchCategories = async () => {
      // console.log('Fetching categories...');
      try {
        setLoading(true);
        const res = await api.get('/category');
        // console.log('Categories fetched:', res);
        if (res.success) {
          setCategories(res.data);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setLoading(false);
      }
    };

    // Filter categories based on search
    const filteredCategories = useMemo(() => {
      let filtered = categories;

      if (searchQuery) {
        filtered = filtered.filter(
          category =>
            category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (category.description &&
              category.description
                .toLowerCase()
                .includes(searchQuery.toLowerCase())),
        );
      }

      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }, [categories, searchQuery]);

    const handleCategorySelect = useCallback(
      category => {
        if (selectedCategory && selectedCategory._id === category._id) {
          // Deselect if same category tapped again
          onCategorySelect(null);
        } else {
          onCategorySelect(category);
        }
        setSearchQuery('');
      },
      [onCategorySelect, selectedCategory],
    );

    const handleClose = useCallback(() => {
      setSearchQuery('');
      if (ref?.current) {
        ref.current.close();
      }
    }, [ref]);

    const handleAddNewCategory = useCallback(async () => {
      if (isAddingNew) return; // Prevent multiple calls

      setIsAddingNew(true);

      try {
        setSearchQuery('');
        await onAddNewCategory?.();
        fetchCategories();
      } catch (error) {
        console.error('Error in handleAddNewCategory:', error);
      } finally {
        setTimeout(() => setIsAddingNew(false), 500);
      }
    }, [onAddNewCategory, isAddingNew]);

    const handleUpdateCategory = useCallback(
      async category => {
        if (isUpdating) return;
        setIsUpdating(true);
        try {
          setSearchQuery('');
          await onAddNewCategory?.(category);
          fetchCategories();
        } catch (error) {
          console.error('Error in handleUpdateCategory:', error);
        } finally {
          setTimeout(() => setIsUpdating(false), 500);
        }
      },
      [onAddNewCategory, isUpdating],
    );

    // Handle Delete
    // const handleDelete = useCallback(category => {
    //   Alert.alert(
    //     'Confirm Delete',
    //     `Are you sure you want to delete category "${category.name}"?`,
    //     [
    //       {
    //         text: 'Cancel',
    //         style: 'cancel',
    //       },
    //       {
    //         text: 'Delete',
    //         style: 'destructive',
    //         onPress: async () => {
    //           try {
    //             setLoading(true);
    //             res = await api.delete(`/category/id/${category._id}`);
    //             if (res.success) {
    //               Toast.show({
    //                 type: 'success',
    //                 text1: 'Success',
    //                 text2: 'Category deleted successfully!',
    //               });
    //               fetchCategories();
    //             } else {
    //               Toast.show({
    //                 type: 'error',
    //                 text1: 'Failed',
    //                 text2: res.message || 'Failed to delete category.',
    //               });
    //             }
    //           } catch (error) {
    //             console.error('Error deleting category:', error);
    //           } finally {
    //             setLoading(false);
    //           }
    //         },
    //       },
    //     ],
    //     { cancelable: true },
    //   );
    // }, []);
    const handleDelete = useCallback(category => {
      setSelectedCategoryToDelete(category);
      setAlertVisible(true);
    }, []);

    const confirmDelete = async () => {
      if (!selectedCategoryToDelete) return;
      try {
        setLoading(true);
        const res = await api.delete(
          `/category/id/${selectedCategoryToDelete._id}`,
        );
        if (res.success) {
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'Category deleted successfully!',
          });
          fetchCategories();
        } else {
          Toast.show({
            type: 'error',
            text1: 'Failed',
            text2: res.message || 'Failed to delete category.',
          });
        }
      } catch (error) {
        console.error('Error deleting category:', error);
      } finally {
        setLoading(false);
        setAlertVisible(false);
        setSelectedCategoryToDelete(null);
      }
    };

    const isSelected = useCallback(
      category => {
        if (!selectedCategory) return false;
        return selectedCategory._id == category._id;
      },
      [selectedCategory],
    );

    const renderCategoryItem = useCallback(
      ({ item }) => {
        const selected = isSelected(item);
        return (
          <List.Item
            title={item.name}
            description={item?.slug || ''}
            left={props => (
              <List.Icon
                {...props}
                icon={selected ? 'check-circle' : 'folder-outline'}
                color={
                  selected
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant
                }
              />
            )}
            right={() => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconButton
                  icon="pencil-outline"
                  size={20}
                  onPress={() => {
                    handleUpdateCategory(item);
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
                />
              </View>
            )}
            onPress={() => handleCategorySelect(item)}
            style={[
              styles.categoryItem,
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
      [theme, handleCategorySelect, isSelected],
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
              onPress={handleAddNewCategory}
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
              {isAddingNew ? 'Opening...' : 'Add New Category'}
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
        handleAddNewCategory,
        isAddingNew,
      ],
    );

    const emptyComponent = useMemo(
      () => (
        <View style={styles.emptyContainer}>
          <Icon
            source="folder-search-outline"
            size={48}
            color={theme.colors.outline}
          />
          <Text style={[styles.emptyText, { color: theme.colors.outline }]}>
            No categories found
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.colors.outline }]}>
            Try different search terms or add a new category
          </Text>
        </View>
      ),
      [theme],
    );

    return (
      <>
        <CustomAlert
          visible={alertVisible}
          onDismiss={() => {
            setAlertVisible(false);
            setSelectedCategoryToDelete(null);
          }}
          title="Confirm Delete"
          message={`Are you sure you want to delete "${selectedCategoryToDelete?.name}"?`}
          type="warning"
          actions={[
            {
              label: 'Cancel',
              mode: 'outlined',
              color: '#6b7280',
              onPress: () => {
                setAlertVisible(false);
                setSelectedCategoryToDelete(null);
              },
            },
            {
              label: 'Delete',
              mode: 'contained',
              color: '#ef4444',
              onPress: confirmDelete,
            },
          ]}
        />
        <BaseBottomSheet
          ref={ref}
          title={title}
          contentType="flatlist"
          data={filteredCategories}
          renderItem={renderCategoryItem}
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
          {!loading && filteredCategories.length === 0 && emptyComponent}
        </BaseBottomSheet>
      </>
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
  categoryItem: {
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

export default CategorySelectorBottomSheet;
