import React, {
  useState,
  useEffect,
  forwardRef,
  useCallback,
  useRef,
} from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Switch,
  useTheme,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import Toast from 'react-native-toast-message';
import BaseBottomSheet from './BaseBottomSheet';
import api from '../../utils/api';

const AddExpenseHeadBottomSheet = forwardRef(
  (
    {
      editData = null,
      onCreateExpenseHead,
      onUpdateExpenseHead,
      onOpenAddExpense,
    },
    ref,
  ) => {
    const theme = useTheme();

    const [name, setName] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [loading, setLoading] = useState(false);

    const addExpenseBottomSheetRef = useRef(null);

    // Set form data when editing
    useEffect(() => {
      if (editData) {
        setName(editData.name || '');
        setIsActive(editData.isActive ?? true);
      } else {
        setName('');
        setIsActive(true);
      }
    }, [editData]);

    // Reset fields
    const resetForm = useCallback(() => {
      setName('');
      setIsActive(true);
    }, []);

    const handleSave = async () => {
      if (!name.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Validation Error',
          text2: 'Expense head name is required',
        });
        return;
      }

      try {
        setLoading(true);
        let response;

        if (editData?._id) {
          response = await api.put(`/expense-head/id/${editData._id}`, {
            name,
            isActive,
          });
        } else {
          response = await api.post('/expense-head', { name, isActive });
        }

        if (response.success) {
          Toast.show({
            type: 'success',
            text1: response.message || 'Operation successful',
          });

          ref.current?.close();
          resetForm();

          if (editData?._id) {
            onUpdateExpenseHead?.(response);
          } else {
            onCreateExpenseHead?.(response);
          }

          // ✅ Open AddExpenseBottomSheet
          setTimeout(() => {
            onOpenAddExpense?.();
          }, 400);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: response.message || 'Something went wrong',
          });
        }
      } catch (error) {
        console.error('Error saving expense head:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to save expense head',
        });
      } finally {
        setLoading(false);
      }
    };

    const renderContent = () => (
      <View style={styles.container}>
        <TextInput
          label="Expense Head Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={styles.input}
          theme={{ roundness: 12 }}
        />

        {/* <View style={styles.switchRow}>
          <Text style={{ color: theme.colors.onSurface, fontSize: 16 }}>
            Status
          </Text>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            color={theme.colors.primary}
          />
        </View> */}

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
            {editData ? 'Update Expense Head' : 'Add Expense Head'}
          </Button>
        )}
      </View>
    );

    return (
      <>
        <BaseBottomSheet
          ref={ref}
          initialSnapIndex={-1}
          title={editData ? 'Edit Expense Head' : 'Add Expense Head'}
          contentType="custom"
        >
          {renderContent()}
        </BaseBottomSheet>
      </>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  input: {
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
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

export default AddExpenseHeadBottomSheet;
