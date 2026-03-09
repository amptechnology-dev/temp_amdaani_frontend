import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  forwardRef,
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
  Button,
} from 'react-native-paper';
import Toast from 'react-native-toast-message';
import BaseBottomSheet from './BaseBottomSheet';
import CustomAlert from '../CustomAlert';
import api from '../../utils/api';
import AddExpenseHeadBottomSheet from './AddExpenseHeadBottomSheet';

const ExpenseHeadSelectorBottomSheet = forwardRef(
  (
    {
      onExpenseHeadSelect,
      selectedExpenseHead = null,
      showSearch = true,
      placeholder = 'Search expense heads...',
      title = 'Select Expense Head',
      refreshKey = null,
      addExpenseSheetRef = null,
      ...props
    },
    ref,
  ) => {
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [expenseHeads, setExpenseHeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [alertVisible, setAlertVisible] = useState(false);
    const [selectedHeadToDelete, setSelectedHeadToDelete] = useState(null);
    const [editHead, setEditHead] = useState(null);

    const addExpenseHeadSheetRef = React.useRef(null);

    // Fetch Expense Heads
    const fetchExpenseHeads = async () => {
      try {
        setLoading(true);
        const response = await api.get('/expense-head');
        // console.log('Expense heads fetched:', response);

        if (response.success) {
          const heads = Array.isArray(response.data) ? response.data : [];
          const validatedHeads = heads.map(head => ({
            _id: head?._id || `temp-${Date.now()}-${Math.random()}`,
            name: head?.name || 'Unnamed Expense Head',
            isActive: head?.isActive ?? true,
            createdAt: head?.createdAt || new Date().toISOString(),
            ...head,
          }));
          setExpenseHeads(validatedHeads);
        } else {
          setExpenseHeads([]);
        }
      } catch (err) {
        console.error('Error fetching expense heads:', err);
        setExpenseHeads([]);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchExpenseHeads();
    }, [refreshKey]);

    // Filter expense heads by search
    const filteredExpenseHeads = useMemo(() => {
      let filtered = expenseHeads;
      if (searchQuery) {
        filtered = filtered.filter(head =>
          head.name.toLowerCase().includes(searchQuery.toLowerCase()),
        );
      }
      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }, [expenseHeads, searchQuery]);

    const handleExpenseHeadSelect = useCallback(
      head => {
        if (selectedExpenseHead && selectedExpenseHead._id === head._id) {
          onExpenseHeadSelect(null);
        } else {
          onExpenseHeadSelect(head);
        }

        // Close this bottom sheet
        ref?.current?.close();

        // Open Add Expense Bottom Sheet (after a slight delay for smooth UX)
        setTimeout(() => {
          addExpenseSheetRef?.current?.expand();
        }, 300);

        setSearchQuery('');
      },
      [onExpenseHeadSelect, selectedExpenseHead, ref, addExpenseSheetRef],
    );

    const handleClose = useCallback(() => {
      setSearchQuery('');
      ref?.current?.close();
    }, [ref]);

    const handleAddNewExpenseHead = useCallback(() => {
      setEditHead(null);
      ref?.current?.close();
      addExpenseHeadSheetRef.current?.expand();
    }, []);

    const handleEditExpenseHead = useCallback(head => {
      setEditHead(head);
      ref?.current?.close();
      addExpenseHeadSheetRef.current?.expand();
    }, []);

    const handleDeleteExpenseHead = useCallback(head => {
      setSelectedHeadToDelete(head);
      setAlertVisible(true);
    }, []);

    const confirmDelete = async () => {
      if (!selectedHeadToDelete) return;
      try {
        setLoading(true);
        const res = await api.delete(
          `/expense-head/id/${selectedHeadToDelete._id}`,
        );
        if (res.success) {
          Toast.show({
            type: 'success',
            text1: 'Deleted',
            text2: 'Expense Head deleted successfully!',
          });
          fetchExpenseHeads();
        } else {
          Toast.show({
            type: 'error',
            text1: 'Failed',
            text2: res.message || 'Failed to delete expense head.',
          });
        }
      } catch (error) {
        console.error('Error deleting expense head:', error);
      } finally {
        setLoading(false);
        setAlertVisible(false);
        setSelectedHeadToDelete(null);
      }
    };

    // Auto select newly created/updated head
    const handleCreatedOrUpdated = useCallback(
      res => {
        if (res?.success && res?.data) {
          const newHead = res.data;
          fetchExpenseHeads();
          onExpenseHeadSelect(newHead);
        }
      },
      [onExpenseHeadSelect],
    );

    const isSelected = useCallback(
      head => selectedExpenseHead?._id === head._id,
      [selectedExpenseHead],
    );

    const renderExpenseHeadItem = useCallback(
      ({ item }) => {
        const selected = isSelected(item);
        return (
          <List.Item
            title={item.name}
            description={item.isActive ? 'Active' : 'Inactive'}
            left={props => (
              <List.Icon
                {...props}
                icon={selected ? 'check-circle' : 'file-document-outline'}
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
                  onPress={() => handleEditExpenseHead(item)}
                  iconColor={theme.colors.onSurfaceVariant}
                />
                <IconButton
                  icon="delete-outline"
                  size={20}
                  onPress={() => handleDeleteExpenseHead(item)}
                  iconColor={theme.colors.onSurfaceVariant}
                />
              </View>
            )}
            onPress={() => handleExpenseHeadSelect(item)}
            style={[
              styles.item,
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
      [isSelected, theme, handleExpenseHeadSelect],
    );

    const renderHeader = useMemo(
      () => (
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {title}
            </Text>
            <IconButton
              icon="close"
              size={24}
              onPress={handleClose}
              iconColor={theme.colors.onSurface}
            />
          </View>

          <View style={styles.addButtonContainer}>
            <Button
              mode="text"
              onPress={handleAddNewExpenseHead}
              icon="plus-circle-outline"
              style={styles.addButton}
              labelStyle={[
                styles.addButtonLabel,
                { color: theme.colors.primary },
              ]}
            >
              Add Expense Head
            </Button>
          </View>

          <Divider bold />

          {showSearch && (
            <Searchbar
              placeholder={placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
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
      [title, handleClose, handleAddNewExpenseHead, searchQuery, theme],
    );

    const emptyComponent = useMemo(
      () => (
        <View style={styles.emptyContainer}>
          <Icon
            source="file-search-outline"
            size={48}
            color={theme.colors.outline}
          />
          <Text style={[styles.emptyText, { color: theme.colors.outline }]}>
            No expense heads found
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.colors.outline }]}>
            Try searching or add a new expense head
          </Text>
        </View>
      ),
      [theme],
    );

    return (
      <>
        {/* Confirm Delete Alert */}
        <CustomAlert
          visible={alertVisible}
          onDismiss={() => {
            setAlertVisible(false);
            setSelectedHeadToDelete(null);
          }}
          title="Confirm Delete"
          message={`Are you sure you want to delete "${selectedHeadToDelete?.name}"?`}
          type="warning"
          actions={[
            {
              label: 'Cancel',
              mode: 'outlined',
              color: '#6b7280',
              onPress: () => {
                setAlertVisible(false);
                setSelectedHeadToDelete(null);
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

        {/* Add/Edit Expense Head Sheet */}
        <AddExpenseHeadBottomSheet
          ref={addExpenseHeadSheetRef}
          editData={editHead}
          onCreateExpenseHead={handleCreatedOrUpdated}
          onUpdateExpenseHead={handleCreatedOrUpdated}
          onOpenAddExpense={() => addExpenseSheetRef?.current?.expand()}
        />

        {/* Main Selector Sheet */}
        <BaseBottomSheet
          ref={ref}
          title={title}
          contentType="flatlist"
          data={filteredExpenseHeads}
          renderItem={renderExpenseHeadItem}
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
          {!loading && filteredExpenseHeads.length === 0 && emptyComponent}
        </BaseBottomSheet>
      </>
    );
  },
);

const styles = StyleSheet.create({
  header: {},
  titleRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingTop: 8,
  },
  title: { fontSize: 20, fontWeight: '600' },
  addButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: 'flex-start',
  },
  addButton: { borderRadius: 8 },
  addButtonLabel: { fontSize: 14, fontWeight: '600' },
  searchBar: {
    marginHorizontal: 20,
    borderRadius: 12,
    elevation: 1,
    marginTop: 8,
  },
  searchInput: { fontSize: 16 },
  item: {
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
  emptySubtext: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

export default ExpenseHeadSelectorBottomSheet;
