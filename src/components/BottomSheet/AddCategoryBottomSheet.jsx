import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  useTheme,
  Button,
  TextInput,
  HelperText,
  IconButton,
  Divider,
} from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';
import api from '../../utils/api';

const AddCategoryBottomSheet = React.forwardRef(
  (
    {
      onCreateCategory,
      onUpdateCategory,
      category = null,
      title = 'Add Category',
      snapPoints = ['50%', '70%'],
      initialSnapIndex = -1,
      ...props
    },
    ref,
  ) => {
    const theme = useTheme();

    const [categoryName, setCategoryName] = useState('');
    const [categoryDescription, setCategoryDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    //  If category is passed (Update mode), pre-fill fields
    useEffect(() => {
      if (category) {
        setCategoryName(category.name || '');
        setCategoryDescription(category.description || '');
      } else {
        setCategoryName('');
        setCategoryDescription('');
      }
      setErrors({});
    }, [category]);

    // Handle close with form reset
    const handleClose = useCallback(() => {
      setCategoryName('');
      setCategoryDescription('');
      setErrors({});
      setIsSubmitting(false);

      if (ref?.current) {
        ref.current.close();
      }
    }, [ref]);

    // Validation
    const validateForm = useCallback(() => {
      const newErrors = {};

      if (!categoryName.trim()) {
        newErrors.categoryName = 'Category name is required';
      } else if (categoryName.trim().length < 2) {
        newErrors.categoryName = 'Category name must be at least 2 characters';
      } else if (categoryName.trim().length > 50) {
        newErrors.categoryName =
          'Category name must be less than 50 characters';
      }

      if (
        categoryDescription.trim() &&
        categoryDescription.trim().length > 200
      ) {
        newErrors.categoryDescription =
          'Description must be less than 200 characters';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }, [categoryName, categoryDescription]);

    //  Handle Submit (Add or Update)
    const handleSubmit = useCallback(async () => {
      if (!validateForm()) {
        return;
      }

      setIsSubmitting(true);

      try {
        let res;
        if (category) {
          // console.log('Updating category...', category);
          res = await api.put(`/category/id/${category._id}`, {
            name: categoryName.trim(),
          });
          // console.log('Update Category Response:', res);
          await onUpdateCategory?.(res);
        } else {
          // console.log('Creating new category...');
          res = await api.post('/category', {
            name: categoryName.trim(),
            slug: categoryDescription.trim(),
          });
          // console.log('Create Category Response:', res);
          await onCreateCategory?.(res);
        }

        handleClose();
      } catch (error) {
        // console.log('Error submitting category:', error);
        Alert.alert(
          'Error',
          category
            ? 'Failed to update category. Please try again.'
            : 'Failed to create category. Please try again.',
        );
      } finally {
        setIsSubmitting(false);
      }
    }, [
      category,
      categoryName,
      categoryDescription,
      validateForm,
      onCreateCategory,
      onUpdateCategory,
      handleClose,
    ]);

    // Form validation state
    const isFormValid =
      categoryName.trim().length >= 2 && Object.keys(errors).length === 0;

    // Header component
    const renderHeader = useMemo(
      () => (
        <View style={styles.customHeader}>
          <View style={styles.titleHeader}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {category ? 'Update Category' : title}
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
        </View>
      ),
      [theme, title, handleClose, category],
    );

    // Form content component
    const FormContent = useMemo(
      () => (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.formContainer}
        >
          <View style={styles.form}>
            <TextInput
              label="Category Name *"
              mode="outlined"
              value={categoryName}
              onChangeText={setCategoryName}
              style={styles.input}
              theme={{ roundness: 12 }}
              contentStyle={styles.inputContent}
              left={
                <TextInput.Icon
                  icon="folder-outline"
                  color={theme.colors.primary}
                />
              }
              placeholder="Enter category name"
              autoCapitalize="words"
              maxLength={50}
              error={!!errors.categoryName}
              disabled={isSubmitting}
            />
            <HelperText
              type="error"
              visible={!!errors.categoryName}
              style={styles.helperText}
            >
              {errors.categoryName}
            </HelperText>

            <TextInput
              label="Description (Optional)"
              mode="outlined"
              value={categoryDescription}
              onChangeText={setCategoryDescription}
              style={[styles.input, styles.textArea]}
              theme={{ roundness: 12 }}
              contentStyle={styles.inputContent}
              left={<TextInput.Icon icon="text" color={theme.colors.primary} />}
              placeholder="Enter category description"
              multiline
              numberOfLines={3}
              maxLength={200}
              error={!!errors.categoryDescription}
              disabled={isSubmitting}
            />
            <HelperText
              type="error"
              visible={!!errors.categoryDescription}
              style={styles.helperText}
            >
              {errors.categoryDescription}
            </HelperText>

            {categoryDescription && (
              <HelperText type="info" style={styles.characterCount}>
                {categoryDescription.length}/200 characters
              </HelperText>
            )}
          </View>

          <View style={styles.actions}>
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              loading={isSubmitting}
              style={[
                styles.createButton,
                {
                  backgroundColor: isFormValid
                    ? theme.colors.primary
                    : theme.colors.outline,
                },
              ]}
              contentStyle={styles.buttonContent}
              labelStyle={[
                styles.buttonLabel,
                {
                  color: isFormValid
                    ? theme.colors.onPrimary
                    : theme.colors.onSurface,
                },
              ]}
            >
              {isSubmitting
                ? category
                  ? 'Updating...'
                  : 'Creating...'
                : category
                  ? 'Update Category'
                  : 'Create Category'}
            </Button>
          </View>
        </KeyboardAvoidingView>
      ),
      [
        category,
        categoryName,
        categoryDescription,
        errors,
        isSubmitting,
        isFormValid,
        handleSubmit,
        theme,
      ],
    );

    return (
      <BaseBottomSheet
        ref={ref}
        title={title}
        contentType="scroll"
        headerComponent={renderHeader}
        initialSnapIndex={initialSnapIndex}
        snapPoints={snapPoints}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        enablePanDownToClose={true}
        enableDismissOnClose={true}
        {...props}
      >
        {FormContent}
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
  formContainer: {
    flex: 1,
    paddingTop: 16,
  },
  form: {
    flex: 1,
    paddingHorizontal: 20,
  },
  input: {
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  inputContent: {
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
  },
  helperText: {
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  characterCount: {
    textAlign: 'right',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  createButton: {
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonContent: {
    height: 50,
    paddingHorizontal: 24,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});

AddCategoryBottomSheet.displayName = 'AddCategoryBottomSheet';

export default AddCategoryBottomSheet;
