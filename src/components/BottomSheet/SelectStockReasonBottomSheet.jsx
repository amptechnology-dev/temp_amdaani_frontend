// components/BottomSheet/SelectStockReasonBottomSheet.jsx
import React, { useState, useMemo, useCallback, forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, List, Divider, IconButton, useTheme } from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';

const ADD_REASONS = [
  { id: 'NEW_PURCHASE', name: 'New Purchase' },
  { id: 'STOCK_CORRECTION', name: 'Stock Correction (Increase)' },
  { id: 'SALE_RETURN', name: 'Sale Return' },
  { id: 'FREE_STOCK', name: 'Free Stock / Bonus' },
];

const REMOVE_REASONS = [
  { id: 'DAMAGE', name: 'Damaged Stock' },
  { id: 'EXPIRED', name: 'Expired Stock' },
  { id: 'STOCK_CORRECTION', name: 'Stock Correction (Decrease)' },
  { id: 'INTERNAL_USE', name: 'Internal Usage' },
  { id: 'PURCHASE_RETURN', name: 'Purchase Return' },
];

const SelectStockReasonBottomSheet = forwardRef(
  (
    {
      title = 'Select Stock Reason',
      onSelect,
      actionType = 'add',
      selectedReason = null,
      snapPoints = ['60%'],
      initialSnapIndex = -1,
    },
    ref,
  ) => {
    const theme = useTheme();

    const reasons = useMemo(
      () => (actionType === 'add' ? ADD_REASONS : REMOVE_REASONS),
      [actionType],
    );

    const handleClose = useCallback(() => {
      ref?.current?.close();
    }, [ref]);

    const handleSelect = useCallback(
      item => {
        onSelect?.({ ...item, actionType });
        handleClose();
      },
      [onSelect, actionType, handleClose],
    );

    const renderHeader = useMemo(
      () => (
        <View>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <IconButton icon="close" onPress={() => ref.current?.close()} />
          </View>
          <Divider />
        </View>
      ),
      [title],
    );

    const renderItem = ({ item }) => {
      const isSelected = selectedReason?.id === item.id;

      return (
        <>
          <List.Item
            title={item.name}
            onPress={() => handleSelect(item)}
            left={props => (
              <List.Icon
                {...props}
                icon={isSelected ? 'check-circle' : 'file-document-outline'}
                color={
                  isSelected
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant
                }
              />
            )}
            style={[
              styles.item,
              isSelected && {
                backgroundColor: theme.colors.primaryContainer,
              },
            ]}
            titleStyle={isSelected && { color: theme.colors.primary }}
          />
        </>
      );
    };

    return (
      <BaseBottomSheet
        ref={ref}
        title={title}
        contentType="flatlist"
        data={reasons}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        headerComponent={renderHeader}
        snapPoints={snapPoints}
        initialSnapIndex={initialSnapIndex}
      />
    );
  },
);

SelectStockReasonBottomSheet.displayName = 'SelectStockReasonBottomSheet';

export default SelectStockReasonBottomSheet;

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  segmentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  item: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
  },
});
