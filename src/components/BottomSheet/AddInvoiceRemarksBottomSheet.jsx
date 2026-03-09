import React, { useState, useEffect, forwardRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  TextInput,
  Button,
  useTheme,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import Toast from 'react-native-toast-message';
import BaseBottomSheet from './BaseBottomSheet';
import api from '../../utils/api';

const AddInvoiceRemarksBottomSheet = forwardRef(
  ({ editData = null, onSaveInvoice }, ref) => {
    const theme = useTheme();

    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSave = () => {
      if (!description.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Empty Remarks',
          text2: 'Please add some remarks',
        });
        return;
      }
      onSaveInvoice(description); // ← send back to parent
    };

    const renderContent = () => (
      <View style={styles.container}>
        <TextInput
          label="Invoice Remarks"
          value={description}
          onChangeText={setDescription}
          mode="outlined"
          multiline
          numberOfLines={4}
          style={styles.textarea}
          theme={{ roundness: 12 }}
        />

        <Divider style={{ marginVertical: 16 }} />

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : (
          <Button
            mode="contained"
            onPress={handleSave}
            style={styles.button}
            labelStyle={styles.buttonLabel}
          >
            {editData ? 'Update Invoice' : 'Save Invoice'}
          </Button>
        )}
      </View>
    );

    return (
      <BaseBottomSheet
        ref={ref}
        initialSnapIndex={-1}
        title={editData ? 'Edit Invoice' : 'Add Invoice'}
        contentType="custom"
      >
        {renderContent()}
      </BaseBottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  textarea: {
    marginBottom: 16,
    height: 200,
  },
  button: {
    borderRadius: 12,
    marginTop: 12,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AddInvoiceRemarksBottomSheet;
