// AddItem.jsx - Add + Update unified

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  useTheme,
  Icon,
  Button,
  TextInput,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  ToastAndroid,
  TouchableOpacity,
  View,
  Platform,
  Keyboard,
} from 'react-native';
import { Formik } from 'formik';
import * as Yup from 'yup';
import Toast from 'react-native-toast-message';
import Navbar from '../../components/Navbar';
import UnitSelectorBottomSheet from '../../components/BottomSheet/UnitSelectorBottomSheet';
import CategorySelectorBottomSheet from '../../components/BottomSheet/CategorySelectorBottomSheet';
import AddCategoryBottomSheet from '../../components/BottomSheet/AddCategoryBottomSheet';
import TaxSelectorBottomSheet from '../../components/BottomSheet/TaxSelectorBottomSheet';
import { useBottomSheet } from '../../hook/useBottomSheet';
import unitsData from '../../assets/data/units.json';
import categoriesData from '../../assets/data/categories.json';
import DiscountTypeSelectorBottomSheet from '../../components/BottomSheet/DiscountTypeSelectorBottomSheet';
import TaxRateSelectorBottomSheet from '../../components/BottomSheet/TaxRateSelectorBottomSheet';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../../utils/api';
import HsnCodeSelectorBottomSheet from '../../components/BottomSheet/HsnCodeSelectorBottomSheet';
import AddHsnCodeBottomSheet from '../../components/BottomSheet/HsnCodeCreateBottomSheet';
import { useAuth, permissions } from '../../context/AuthContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import CustomAlert from '../../components/CustomAlert';

// Validation Schema
const validationSchema = Yup.object().shape({
  itemName: Yup.string()
    .trim()
    .required('Item name is required')
    .min(2, 'Item name must be at least 2 characters'),
  itemCode: Yup.string().trim(),
  hsnCode: Yup.string().trim(),
  purchasePrice: Yup.number()
    .required('Purchase price is required')
    .positive('Purchase price must be positive')
    .typeError('Purchase price must be a valid number'),

  // ✅ Sales price is now optional
  salesPrice: Yup.number()
    .nullable()
    .positive('Sales price must be positive')
    .typeError('Sales price must be a valid number'),
  selectedUnit: Yup.object().nullable().required('Unit is required'),
  selectedCategory: Yup.object().nullable(),
  selectedTaxRate: Yup.object()
    .nullable()
    .when('selectedTaxOption', {
      is: taxOption => taxOption && taxOption.id !== 'without_tax',
      then: schema =>
        schema.required('Tax rate is required when tax is applicable'),
      otherwise: schema => schema.nullable(),
    }),
  discountPrice: Yup.number()
    .nullable()
    .min(0, 'Discount price cannot be negative')
    .typeError('Discount must be a valid number'),
  selectedDiscountType: Yup.object().nullable(),
  purchaseDiscount: Yup.number()
    .nullable()
    .min(0, 'Discount cannot be negative')
    .typeError('Discount must be a valid number'),
  selectedPurchaseDiscountType: Yup.object().nullable(),
  selectedPurchaseTaxRate: Yup.object()
    .nullable()
    .when('selectedPurchaseTaxOption', {
      is: taxOption => taxOption && taxOption.id !== 'without_tax',
      then: schema =>
        schema.required('Tax rate is required when tax is applicable'),
      otherwise: schema => schema.nullable(),
    }),
  mrp: Yup.number()
    .typeError('GST rate must be a number')
    .min(0, 'GST rate cannot be negative'),
  selectedTaxOption: Yup.object().nullable(),
  selectedPurchaseTaxOption: Yup.object().nullable(),
});

const AddPurchaseItem = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const itemToEdit = route.params?.item || null;
  // console.log('item log:', itemToEdit);

  const isEditMode = Boolean(itemToEdit);
  const { authState, isStockEnabled, hasPermission } = useAuth();
  const storedata = authState?.user?.store;
  // console.log('Store details', storedata);

  const theme = useTheme();
  const formikRef = useRef(null);

  // Bottom Sheet Hooks
  const unitSheet = useBottomSheet();
  const categorySheet = useBottomSheet();
  const hsnBottomSheet = useBottomSheet();
  const addCategorySheet = useBottomSheet();
  const addHsnSheet = useBottomSheet();
  const taxOptionSheet = useBottomSheet();
  const discountTypeSheet = useBottomSheet();
  const taxRateSheet = useBottomSheet();
  const purchaseDiscountTypeSheet = useBottomSheet();
  const purchaseTaxOptionSheet = useBottomSheet();
  const purchaseTaxRateSheet = useBottomSheet();

  const defaultTaxOption = useMemo(
    () => ({
      id: 'without_tax',
      label: 'Without Tax',
      description: 'Price excludes taxes (tax will be added)',
      icon: 'minus-circle-outline',
    }),
    [],
  );

  const defaultDiscountType = useMemo(
    () => ({
      id: 'amount',
      label: 'Amount',
      description: 'Discount as fixed amount off the sales price',
      icon: 'currency-inr',
      symbol: '₹',
    }),
    [],
  );

  const [categories, setCategories] = useState(categoriesData.categories);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [cancelPressedOnce, setCancelPressedOnce] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryRefreshKey, setCategoryRefreshKey] = useState(0);
  // const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [selectedHsnCode, setSelectedHsnCode] = useState(null);
  const [hsnCodeRefreshKey, setHsnCodeRefreshKey] = useState(0);
  const [alertVisible, setAlertVisible] = useState(false);

  const { units } = unitsData;

  const mapUnitFromItem = useCallback(
    unitValue => {
      if (!unitValue) return null;
      if (typeof unitValue === 'object' && unitValue.name) {
        // already structured
        return (
          units.find(
            u => u.name?.toLowerCase() === unitValue.name?.toLowerCase(),
          ) || null
        );
      }
      if (typeof unitValue === 'string') {
        return (
          units.find(u => u.name?.toLowerCase() === unitValue.toLowerCase()) ||
          null
        );
      }
      return null;
    },
    [units],
  );

  const mapCategoryFromItem = useCallback(
    categoryValue => {
      if (!categoryValue) return null;

      // already object with _id + name
      if (typeof categoryValue === 'object' && categoryValue._id) {
        return categoryValue;
      }

      // fallback id lookup
      if (typeof categoryValue === 'string') {
        return categories.find(c => c._id === categoryValue) || null;
      }

      return null;
    },
    [categories],
  );

  const mapTaxFromItem = useCallback(
    gstRate => {
      if (!gstRate || Number(gstRate) <= 0) {
        return {
          taxOption: defaultTaxOption,
          taxRate: null,
        };
      }
      // Consider this as "with tax"
      return {
        taxOption: {
          id: 'with_tax',
          label: 'With Tax',
          description: 'Price includes/applies tax',
          icon: 'check-decagram',
        },
        taxRate: {
          rate: Number(gstRate),
          label: `${gstRate}% GST`,
        },
      };
    },
    [defaultTaxOption],
  );

  // Initial Form Values (Add vs Edit)
  const initialValues = useMemo(() => {
    const unitMapped = mapUnitFromItem(itemToEdit?.unit);
    const categoryMapped = itemToEdit?.category
      ? mapCategoryFromItem(itemToEdit.category)
      : null;

    // Tax option (with/without) comes directly from isTaxInclusive
    const taxOption = itemToEdit?.isTaxInclusive
      ? {
          id: 'with_tax',
          label: 'With Tax',
          description: 'Price includes/applies tax',
          icon: 'check-decagram',
        }
      : defaultTaxOption;

    // Tax rate comes directly from gstRate
    const taxRate =
      itemToEdit?.gstRate && Number(itemToEdit.gstRate) > 0
        ? {
            rate: Number(itemToEdit.gstRate),
            label: `${itemToEdit.gstRate}% GST`,
          }
        : null;

    return {
      itemName: itemToEdit?.name || '',
      itemCode: itemToEdit?.sku || '',
      hsnCode: itemToEdit?.hsn || '',
      salesPrice: itemToEdit?.price ? String(itemToEdit.price) : '',
      purchasePrice: itemToEdit?.costPrice ? String(itemToEdit.costPrice) : '',
      selectedUnit: unitMapped,
      selectedCategory: categoryMapped,
      selectedTaxOption: taxOption, // ✅ directly from isTaxInclusive
      selectedTaxRate: taxRate,
      mrp: itemToEdit?.mrp || '',
      discountPrice:
        itemToEdit?.discountPrice != null && itemToEdit.discountPrice !== ''
          ? String(itemToEdit.discountPrice)
          : '',
      selectedDiscountType: defaultDiscountType,
      purchaseDiscount:
        itemToEdit?.purchaseDiscount != null
          ? String(itemToEdit.purchaseDiscount)
          : '',
      selectedPurchaseDiscountType: defaultDiscountType,
      selectedPurchaseTaxOption: itemToEdit?.isTaxInclusive
        ? {
            id: 'with_tax',
            label: 'With Tax',
            description: 'Price includes/applies tax',
            icon: 'check-decagram',
          }
        : defaultTaxOption,
      selectedPurchaseTaxRate:
        itemToEdit?.purchaseGstRate && Number(itemToEdit.purchaseGstRate) > 0
          ? {
              rate: Number(itemToEdit.purchaseGstRate),
              label: `${itemToEdit.purchaseGstRate}% GST`,
            }
          : null,
    };
  }, [
    itemToEdit,
    mapUnitFromItem,
    mapCategoryFromItem,
    defaultTaxOption,
    defaultDiscountType,
  ]);

  // const generateItemCode = setFieldValue => {
  //   setIsGeneratingCode(true);
  //   setTimeout(() => {
  //     const randomCode = Math.floor(
  //       10000000 + Math.random() * 90000000,
  //     ).toString();
  //     setFieldValue('itemCode', randomCode);
  //     setIsGeneratingCode(false);
  //     Toast.show({
  //       type: 'success',
  //       text1: 'Code Generated',
  //       text2: 'Item code generated successfully',
  //     });
  //   }, 800);
  // };

  // Called by selector when Add New is pressed
  const handleAddNewHsnCode = useCallback(() => {
    // console.log('Opening Add HSN');
    hsnBottomSheet.close();
    addHsnSheet.expand();
  }, []);

  const handleCreateHsnCode = useCallback(newHsn => {
    // close add form
    addHsnSheet.close();

    // ✅ auto select new HSN in Formik
    if (formikRef.current) {
      const { setFieldValue } = formikRef.current;
      setSelectedHsnCode(newHsn);
      setFieldValue('hsnCode', newHsn.code);

      if (newHsn.gstRate && Number(newHsn.gstRate) > 0) {
        setFieldValue('selectedTaxRate', {
          rate: Number(newHsn.gstRate),
          label: `${newHsn.gstRate}% GST`,
        });
        setFieldValue('selectedTaxOption', {
          id: 'with_tax',
          label: 'With Tax',
          description: 'Price includes/applies tax',
          icon: 'check-decagram',
        });
      } else {
        setFieldValue('selectedTaxRate', null);
        setFieldValue('selectedTaxOption', {
          id: 'without_tax',
          label: 'Without Tax',
          description: 'Price excludes taxes (tax will be added)',
          icon: 'minus-circle-outline',
        });
      }
    }

    //  refresh selector list
    setHsnCodeRefreshKey(Date.now());

    //  reopen selector with new data visible
    // setTimeout(() => {
    //   hsnBottomSheet.expand();
    // }, 400);
  }, []);

  const handleSelect = ({ field, value, helpers, closeFn, extra }) => {
    const { setFieldValue, setFieldTouched, setFieldError } = helpers;
    setFieldValue(field, value);
    setTimeout(() => {
      setFieldTouched(field, true);
      setFieldError(field, undefined);
    }, 0);
    if (extra) extra(helpers, value);
    closeFn?.();
  };

  // Create Category Handler
  const handleCreateCategory = (newCategory, setFieldValue) => {
    setCategories(prev => [...prev, newCategory]);
    setSelectedCategory(newCategory);
    setFieldValue('selectedCategory', newCategory.data || newCategory);
    Toast.show({
      type: 'success',
      text1: 'Success',
      text2: 'Category created and selected successfully!',
    });
  };

  const handleUpdateCategory = updatedCategory => {
    setCategories(prev =>
      prev.map(cat =>
        cat._id === updatedCategory._id ? updatedCategory : cat,
      ),
    );
    categorySheet.expand();
    addCategorySheet.close();
    setCategoryToEdit(null);
    Toast.show({ type: 'success', text1: 'Category updated successfully!' });
  };

  // Submit Form (Create or Update)
  const handleSubmitForm = async (values, { resetForm, setSubmitting }) => {
    try {
      setIsTransitioning(true);
      let discountValue = 0;
      const salesPrice = Number(values.salesPrice) || 0;
      const inputDiscount = Number(values.discountPrice) || 0;
      if (values.selectedDiscountType?.id === 'percentage') {
        discountValue = (salesPrice * inputDiscount) / 100;
      } else {
        discountValue = inputDiscount;
      }

      // ✅ Purchase discount calculation (was MISSING — this is why payload crashed)
      let purchaseDiscountValue = 0;
      const purchasePrice = Number(values.purchasePrice) || 0;
      const inputPurchaseDiscount = Number(values.purchaseDiscount) || 0;
      if (values.selectedPurchaseDiscountType?.id === 'percentage') {
        purchaseDiscountValue = (purchasePrice * inputPurchaseDiscount) / 100;
      } else {
        purchaseDiscountValue = inputPurchaseDiscount;
      }
      const payload = {
        name: values.itemName,
        unit: values.selectedUnit?.name || values.selectedUnit || '',
        category:
          values.selectedCategory?._id || values.selectedCategory?.id || '',
        sku: values.itemCode,
        hsn: values.hsnCode,
        mrp: Number(values.mrp) || 0,
        sellingPrice: values.salesPrice ? Number(values.salesPrice) : 0, // ✅ optional, defaults to 0
        costPrice: Number(values.purchasePrice),
        gstRate: Number(values.selectedTaxRate?.rate) || 0,
        isTaxInclusive: values.selectedTaxOption?.id === 'with_tax',
        discountPrice: discountValue,
        purchaseDiscount: Number(purchaseDiscountValue),
        purchaseGstRate: Number(values.selectedPurchaseTaxRate?.rate) || 0,
        isPurchaseTaxInclusive:
          values.selectedPurchaseTaxOption?.id === 'with_tax',
        //selectedPurchaseDiscountType: values.selectedPurchaseDiscountType,
      };

      console.log('payload ===>', payload);

      // console.log('payload', payload);
      if (isEditMode) {
        const id = itemToEdit.id || itemToEdit._id;
        await api.put(`/product/id/${id}`, payload);

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Item updated successfully!',
        });

        // Reset form with latest payload instead of old values
        resetForm({
          values: {
            itemName: payload.name,
            itemCode: payload.sku,
            hsnCode: payload.hsn,
            mrp: String(payload.mrp),
            salesPrice: String(payload.sellingPrice),
            selectedUnit: values.selectedUnit,
            selectedCategory: values.selectedCategory,
            selectedTaxOption: values.selectedTaxOption,
            selectedTaxRate: values.selectedTaxRate,
            discountPrice: String(payload.discountPrice),
            // selectedDiscountType: values.selectedDiscountType,
            selectedPurchaseTaxOption: values.selectedPurchaseTaxOption,
            selectedPurchaseTaxRate: values.selectedPurchaseTaxRate,
          },
        });
      } else {
        const response = await api.post('/product', payload);
        // // console.log("product adding",response)
        const newItem = response.data;

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Item added successfully!',
        });

        if (
          route.params?.onItemCreated &&
          typeof route.params.onItemCreated === 'function'
        ) {
          route.params.onItemCreated(newItem);
          navigation.pop();
        }

        resetForm(); // Add mode can stay as full reset
      }
    } catch (error) {
      // console.log('Error:', error);
      console.log('payload error', err);
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: error.message || 'An error occurred while saving the item.',
      });
    } finally {
      setSubmitting(false);
      setIsTransitioning(false);
    }
  };
  // Display helpers
  const getUnitText = unit => (unit ? `${unit.name} (${unit.symbol})` : '');
  const getCategoryText = cat => (cat ? cat.name : '');
  const getTaxRateText = rate =>
    rate ? `${rate.rate}% ${rate.label.includes('IGST') ? 'IGST' : 'GST'}` : '';

  return (
    <View style={styles.container}>
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Navbar
          title={isEditMode ? 'Edit Item' : 'Add New Item'}
          rightComponent={
            isEditMode &&
            isStockEnabled && (
              <View>
                {hasPermission(permissions.CAN_MANAGE_STOCKS) && (
                  <Button
                    icon={'warehouse'}
                    mode="outlined"
                    onPress={() => {
                      navigation.navigate('StockTransactionScreen', {
                        id: itemToEdit.id,
                        costPrice: itemToEdit?.costPrice || 0,
                        currentStock: itemToEdit?.currentStock || 0,
                        name: itemToEdit?.name || '',
                      });
                    }}
                    style={styles.button}
                    contentStyle={styles.buttonContent}
                  >
                    Stocks
                  </Button>
                )}
              </View>
            )
          }
        />

        <Formik
          innerRef={formikRef}
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={handleSubmitForm}
          validateOnBlur
          validateOnChange
        >
          {({
            values,
            errors,
            touched,
            setFieldValue,
            setFieldTouched,
            setFieldError,
            handleChange,
            handleSubmit,
            isValid,
          }) => {
            const handleHsnCodeSelect = hsnCode => {
              // console.log('HSN Code selected:', hsnCode);

              // Fix: Check if hsnCode is null (deselect case)
              if (!hsnCode) {
                setSelectedHsnCode(null);
                setFieldValue('hsnCode', '');
                setFieldValue('selectedTaxRate', null);
                setFieldValue('selectedTaxOption', defaultTaxOption);
                hsnBottomSheet.close();
                return;
              }

              // Normal selection case
              setSelectedHsnCode(hsnCode);
              setFieldValue('hsnCode', hsnCode.code);

              // Fix: Create the proper tax rate object structure
              if (hsnCode.gstRate && Number(hsnCode.gstRate) > 0) {
                const taxRateObject = {
                  rate: Number(hsnCode.gstRate),
                  label: `${hsnCode.gstRate}% GST`,
                };

                // console.log('Setting tax rate:', taxRateObject);
                setFieldValue('selectedTaxRate', taxRateObject);

                // Also set tax option to 'with_tax' since we have a GST rate
                const withTaxOption = {
                  id: 'with_tax',
                  label: 'With Tax',
                  description: 'Price includes/applies tax',
                  icon: 'check-decagram',
                };
                setFieldValue('selectedTaxOption', withTaxOption);
              } else {
                // If no GST rate, set to without tax
                setFieldValue('selectedTaxRate', null);
                setFieldValue('selectedTaxOption', defaultTaxOption);
              }
              hsnBottomSheet.close();
            };

            return (
              <>
                {/* <KeyboardAvoidingView style={{ flex: 1 }} behavior={'padding'}>
                  <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets
                  > */}
                <KeyboardAwareScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.scrollContent}
                  enableOnAndroid={true}
                  keyboardShouldPersistTaps="always"
                  keyboardDismissMode="on-drag"
                >
                  <View style={styles.content}>
                    {/* Header Section */}
                    <View style={styles.headerSection}>
                      <Icon
                        source="package-variant"
                        size={24}
                        color={theme.colors.primary}
                      />
                      <Text
                        style={[
                          styles.headerTitle,
                          { color: theme.colors.onSurface },
                        ]}
                      >
                        Product Details
                      </Text>
                    </View>

                    <Divider
                      style={[
                        styles.divider,
                        { backgroundColor: theme.colors.outline },
                      ]}
                    />

                    {/* Item Name Input */}
                    <TextInput
                      label="Item Name *"
                      mode="outlined"
                      value={values.itemName}
                      onChangeText={handleChange('itemName')}
                      onBlur={() => setFieldTouched('itemName', true)}
                      style={styles.input}
                      theme={{ roundness: 12 }}
                      contentStyle={styles.inputContent}
                      placeholder="Enter item name"
                      autoCapitalize="words"
                      maxLength={30}
                      error={touched.itemName && !!errors.itemName}
                    />
                    {touched.itemName && errors.itemName && (
                      <Text
                        style={{
                          color: theme.colors.error,
                          fontSize: 12,
                          marginTop: -4,
                          marginBottom: 8,
                        }}
                      >
                        {errors.itemName}
                      </Text>
                    )}

                    {/* Unit Selection */}
                    <View style={styles.inputContainer}>
                      <TextInput
                        label="Unit of Measurement *"
                        value={getUnitText(values.selectedUnit)}
                        mode="outlined"
                        editable={false}
                        style={[
                          styles.input,
                          isTransitioning && styles.inputDisabled,
                        ]}
                        theme={{ roundness: 12 }}
                        contentStyle={styles.inputContent}
                        right={<TextInput.Icon icon="chevron-down" />}
                        placeholder="Select unit"
                        error={touched.selectedUnit && !!errors.selectedUnit}
                      />
                      <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        onPress={() => {
                          unitSheet.expand();
                          Keyboard.dismiss();
                        }}
                        activeOpacity={0.7}
                        disabled={isTransitioning}
                        accessibilityLabel="Select unit of measurement"
                        accessibilityHint="Opens a list of available units"
                      />
                    </View>
                    {touched.selectedUnit && errors.selectedUnit && (
                      <Text
                        style={{
                          color: theme.colors.error,
                          fontSize: 12,
                          marginTop: -4,
                          marginBottom: 8,
                        }}
                      >
                        {errors.selectedUnit}
                      </Text>
                    )}

                    {/* Category Selection */}
                    <View style={styles.inputContainer}>
                      <TextInput
                        label="Item Category"
                        value={getCategoryText(values.selectedCategory)}
                        mode="outlined"
                        editable={false}
                        style={[
                          styles.input,
                          isTransitioning && styles.inputDisabled,
                        ]}
                        theme={{ roundness: 12 }}
                        contentStyle={styles.inputContent}
                        right={<TextInput.Icon icon="chevron-down" />}
                        placeholder="Select category"
                        error={
                          touched.selectedCategory && !!errors.selectedCategory
                        }
                      />
                      <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        onPress={() => {
                          categorySheet.expand();
                          Keyboard.dismiss();
                        }}
                        activeOpacity={0.7}
                        disabled={isTransitioning}
                        accessibilityLabel="Select item category"
                        accessibilityHint="Opens a list of available categories"
                      />
                    </View>
                    {touched.selectedCategory && errors.selectedCategory && (
                      <Text
                        style={{
                          color: theme.colors.error,
                          fontSize: 12,
                          marginTop: -4,
                          marginBottom: 8,
                        }}
                      >
                        {errors.selectedCategory}
                      </Text>
                    )}

                    {/* Item Code Input with Assign Code Button */}
                    {/* <View style={styles.itemCodeInputContainer}>
                      <TextInput
                        label="SKU"
                        mode="outlined"
                        value={values.itemCode}
                        onChangeText={handleChange('itemCode')}
                        style={styles.input}
                        theme={{ roundness: 12 }}
                        contentStyle={
                          values.itemCode
                            ? styles.inputContent
                            : styles.itemCodeInputContent
                        }
                        placeholder="Enter or assign SKU"
                        keyboardType="default"
                        maxLength={20}
                      /> */}

                    {/* {!values.itemCode && (
                          <TouchableOpacity
                            style={[
                              styles.assignCodeButton,
                              {
                                backgroundColor: isGeneratingCode
                                  ? theme.colors.surfaceVariant
                                  : theme.colors.primary,
                                borderColor: theme.colors.primary,
                              },
                            ]}
                            onPress={() => generateItemCode(setFieldValue)}
                            disabled={isGeneratingCode}
                            activeOpacity={0.7}
                          >
                            {isGeneratingCode ? (
                              <ActivityIndicator
                                size={16}
                                color={theme.colors.onPrimary}
                              />
                            ) : (
                              <Text
                                style={[
                                  styles.assignCodeButtonText,
                                  {
                                    color: isGeneratingCode
                                      ? theme.colors.onSurfaceVariant
                                      : theme.colors.onPrimary,
                                  },
                                ]}
                              >
                                Assign Code
                              </Text>
                            )}
                          </TouchableOpacity>
                        )} */}
                    {/* </View> */}

                    {/* HSN/SAC Code Input */}
                    {/* <TextInput
                          label="HSN/SAC Code"
                          mode="outlined"
                          value={values.hsnCode}
                          onChangeText={handleChange('hsnCode')}
                          style={styles.input}
                          theme={{ roundness: 12 }}
                          contentStyle={styles.inputContent}
                          placeholder="Enter HSN/SAC code"
                          keyboardType="numeric"
                          maxLength={10}
                        /> */}
                    {storedata?.gstNumber && (
                      <View style={styles.inputContainer}>
                        <TextInput
                          label="HSN/SAC Code"
                          value={values.hsnCode}
                          onChangeText={handleChange('hsnCode')}
                          mode="outlined"
                          //editable={false}
                          style={[
                            styles.input,
                            isTransitioning && styles.inputDisabled,
                          ]}
                          theme={{ roundness: 12 }}
                          contentStyle={styles.inputContent}
                          right={<TextInput.Icon icon="chevron-down" />}
                          placeholder="Select HSN"
                        />
                        <TouchableOpacity
                          style={StyleSheet.absoluteFill}
                          onPress={() => {
                            hsnBottomSheet.expand();
                            // setTimeout(() => {
                            //   hsnBottomSheet.close();
                            // }, 1000);
                          }}
                          activeOpacity={0.7}
                          disabled={isTransitioning}
                          accessibilityLabel="Select HSN Code"
                          accessibilityHint="Opens a list of available HSN Codes"
                        />
                      </View>
                    )}

                    <TextInput
                      label="MRP"
                      mode="outlined"
                      value={values.mrp}
                      onChangeText={handleChange('mrp')}
                      onBlur={() => setFieldTouched('mrp', true)}
                      style={[styles.input]}
                      theme={{ roundness: 12 }}
                      contentStyle={styles.salesPriceInputContent}
                      placeholder="Enter mrp rate"
                      keyboardType="numeric"
                      maxLength={15}
                      error={touched.mrp && !!errors.mrp}
                    />

                    {/* Purchase Price Input */}
                    <View style={styles.PurchasePriceSection}>
                      <View style={styles.headerSection}>
                        <Icon
                          source="currency-inr"
                          size={24}
                          color={theme.colors.primary}
                        />
                        <Text
                          style={[
                            styles.headerTitle,
                            { color: theme.colors.onSurface },
                          ]}
                        >
                          Purchase Rate
                        </Text>
                      </View>

                      <View style={styles.salesPriceInputContainer}>
                        <TextInput
                          label="Purchase Rate *"
                          mode="outlined"
                          value={values.purchasePrice}
                          onChangeText={handleChange('purchasePrice')}
                          onBlur={() => setFieldTouched('purchasePrice', true)}
                          style={[styles.input]}
                          theme={{ roundness: 12 }}
                          contentStyle={styles.salesPriceInputContent}
                          placeholder="Enter purchase Rate"
                          keyboardType="numeric"
                          maxLength={15}
                          error={
                            touched.purchasePrice && !!errors.purchasePrice
                          }
                        />
                        {storedata?.gstNumber && (
                          <TouchableOpacity
                            style={[
                              styles.taxOptionButton,
                              {
                                backgroundColor:
                                  values.selectedPurchaseTaxOption?.id ===
                                  'with_tax'
                                    ? theme.colors.primary
                                    : theme.colors.surfaceVariant,
                                borderColor:
                                  values.selectedPurchaseTaxOption?.id ===
                                  'with_tax'
                                    ? theme.colors.primary
                                    : theme.colors.outline,
                              },
                            ]}
                            onPress={() => {
                              purchaseTaxOptionSheet.present();
                              Keyboard.dismiss();
                            }}
                            disabled={isTransitioning}
                            activeOpacity={0.7}
                          >
                            <Icon
                              source={
                                values.selectedPurchaseTaxOption?.icon ||
                                'minus-circle-outline'
                              }
                              size={14}
                              color={
                                values.selectedPurchaseTaxOption?.id ===
                                'with_tax'
                                  ? theme.colors.onPrimary
                                  : theme.colors.onSurfaceVariant
                              }
                            />
                            <Text
                              style={[
                                styles.taxOptionButtonText,
                                {
                                  color:
                                    values.selectedPurchaseTaxOption?.id ===
                                    'with_tax'
                                      ? theme.colors.onPrimary
                                      : theme.colors.onSurfaceVariant,
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {values.selectedPurchaseTaxOption?.label ||
                                'Without Tax'}{' '}
                            </Text>
                            <Icon
                              source="chevron-down"
                              size={14}
                              color={
                                values.selectedPurchaseTaxOption?.id ===
                                'with_tax'
                                  ? theme.colors.onPrimary
                                  : theme.colors.onSurfaceVariant
                              }
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                      {touched.purchasePrice && errors.purchasePrice && (
                        <Text
                          style={{
                            color: theme.colors.error,
                            fontSize: 12,
                            marginTop: -4,
                            marginBottom: 8,
                          }}
                        >
                          {errors.purchasePrice}
                        </Text>
                      )}

                      <View style={styles.discountPriceInputContainer}>
                        <TextInput
                          label="Purchase Discount"
                          mode="outlined"
                          value={values.purchaseDiscount} // ✅ separate field
                          onChangeText={handleChange('purchaseDiscount')}
                          onBlur={() =>
                            setFieldTouched('purchaseDiscount', true)
                          }
                          style={styles.input}
                          theme={{ roundness: 12 }}
                          contentStyle={styles.discountPriceInputContent}
                          placeholder="Enter discount"
                          keyboardType="numeric"
                          maxLength={10}
                          error={
                            touched.purchaseDiscount &&
                            !!errors.purchaseDiscount
                          }
                        />

                        <TouchableOpacity
                          style={[
                            styles.discountTypeButton,
                            {
                              backgroundColor:
                                values.selectedPurchaseDiscountType?.id ===
                                'amount'
                                  ? theme.colors.primary
                                  : theme.colors.surfaceVariant,
                              borderColor:
                                values.selectedPurchaseDiscountType?.id ===
                                'amount'
                                  ? theme.colors.primary
                                  : theme.colors.outline,
                            },
                          ]}
                          onPress={() => {
                            purchaseDiscountTypeSheet.present(); // ✅ separate sheet
                            Keyboard.dismiss();
                          }}
                          disabled={isTransitioning}
                          activeOpacity={0.7}
                        >
                          <Icon
                            source={
                              values.selectedPurchaseDiscountType?.icon ||
                              'percent'
                            }
                            size={14}
                            color={
                              values.selectedPurchaseDiscountType?.id ===
                              'amount'
                                ? theme.colors.onPrimary
                                : theme.colors.onSurfaceVariant
                            }
                          />
                          <Text
                            style={[
                              styles.discountTypeButtonText,
                              {
                                color:
                                  values.selectedPurchaseDiscountType?.id ===
                                  'amount'
                                    ? theme.colors.onPrimary
                                    : theme.colors.onSurfaceVariant,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {values.selectedPurchaseDiscountType?.label ||
                              'Amount'}
                          </Text>
                          <Icon
                            source="chevron-down"
                            size={14}
                            color={
                              values.selectedPurchaseDiscountType?.id ===
                              'amount'
                                ? theme.colors.onPrimary
                                : theme.colors.onSurfaceVariant
                            }
                          />
                        </TouchableOpacity>
                      </View>

                      {/* Purchase Price after discount preview */}
                      {values.purchasePrice && values.purchaseDiscount && (
                        <View style={{ marginBottom: 10 }}>
                          <Text
                            style={{
                              fontSize: 14,
                              color: theme.colors.onSurfaceVariant,
                              fontWeight: '500',
                            }}
                          >
                            {(() => {
                              const purchase =
                                Number(values.purchasePrice) || 0;
                              const discount =
                                Number(values.purchaseDiscount) || 0;
                              let finalPrice = purchase;

                              if (
                                values.selectedPurchaseDiscountType?.id ===
                                'percentage'
                              ) {
                                finalPrice =
                                  purchase - (purchase * discount) / 100;
                              } else {
                                finalPrice = purchase - discount;
                              }

                              if (finalPrice < 0) finalPrice = 0;
                              return `Purchase Price (After Discount): ₹${finalPrice.toFixed(
                                2,
                              )}`;
                            })()}
                          </Text>
                        </View>
                      )}

                      {touched.purchaseDiscount && errors.purchaseDiscount && (
                        <Text
                          style={{
                            color: theme.colors.error,
                            fontSize: 12,
                            marginBottom: 8,
                          }}
                        >
                          {errors.purchaseDiscount}
                        </Text>
                      )}

                      {storedata?.gstNumber && (
                        <>
                          <View style={styles.inputContainer}>
                            <TextInput
                              label="Purchase Tax Rate"
                              value={getTaxRateText(
                                values.selectedPurchaseTaxRate,
                              )}
                              mode="outlined"
                              editable={false}
                              style={[
                                styles.input,
                                isTransitioning && styles.inputDisabled,
                              ]}
                              theme={{ roundness: 12 }}
                              contentStyle={styles.inputContent}
                              right={<TextInput.Icon icon="chevron-down" />}
                              placeholder="Select purchase tax rate"
                              error={
                                touched.selectedPurchaseTaxRate &&
                                !!errors.selectedPurchaseTaxRate
                              }
                            />
                            <TouchableOpacity
                              style={StyleSheet.absoluteFill}
                              onPress={() => purchaseTaxRateSheet.present()} // ✅ separate sheet
                              activeOpacity={0.7}
                              disabled={isTransitioning}
                            />
                          </View>
                          {touched.selectedPurchaseTaxRate &&
                            errors.selectedPurchaseTaxRate && (
                              <Text
                                style={{
                                  color: theme.colors.error,
                                  fontSize: 12,
                                  marginTop: -4,
                                  marginBottom: 8,
                                }}
                              >
                                {errors.selectedPurchaseTaxRate}
                              </Text>
                            )}
                        </>
                      )}
                    </View>

                    {/* Sales Price Section */}
                    <View style={styles.salesPriceSection}>
                      <View style={styles.headerSection}>
                        <Icon
                          source="currency-inr"
                          size={24}
                          color={theme.colors.primary}
                        />
                        <Text
                          style={[
                            styles.headerTitle,
                            { color: theme.colors.onSurface },
                          ]}
                        >
                          Seling Price
                        </Text>
                      </View>

                      <Divider
                        style={[
                          styles.divider,
                          { backgroundColor: theme.colors.outline },
                        ]}
                      />

                      {/* Sales Price Input with inline Tax Option Button */}
                      <View style={styles.salesPriceInputContainer}>
                        <TextInput
                          label="Sales Price"
                          mode="outlined"
                          value={values.salesPrice}
                          onChangeText={handleChange('salesPrice')}
                          onBlur={() => setFieldTouched('salesPrice', true)}
                          style={styles.input}
                          theme={{ roundness: 12 }}
                          contentStyle={styles.salesPriceInputContent}
                          placeholder="Enter sales price"
                          keyboardType="numeric"
                          maxLength={15}
                          error={touched.salesPrice && !!errors.salesPrice}
                        />
                        {storedata?.gstNumber && (
                          <TouchableOpacity
                            style={[
                              styles.taxOptionButton,
                              {
                                backgroundColor:
                                  values.selectedTaxOption?.id === 'with_tax'
                                    ? theme.colors.primary
                                    : theme.colors.surfaceVariant,
                                borderColor:
                                  values.selectedTaxOption?.id === 'with_tax'
                                    ? theme.colors.primary
                                    : theme.colors.outline,
                              },
                            ]}
                            onPress={() => {
                              taxOptionSheet.present();
                              Keyboard.dismiss();
                            }}
                            disabled={isTransitioning}
                            activeOpacity={0.7}
                          >
                            <Icon
                              source={
                                values.selectedTaxOption?.icon ||
                                'minus-circle-outline'
                              }
                              size={14}
                              color={
                                values.selectedTaxOption?.id === 'with_tax'
                                  ? theme.colors.onPrimary
                                  : theme.colors.onSurfaceVariant
                              }
                            />
                            <Text
                              style={[
                                styles.taxOptionButtonText,
                                {
                                  color:
                                    values.selectedTaxOption?.id === 'with_tax'
                                      ? theme.colors.onPrimary
                                      : theme.colors.onSurfaceVariant,
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {values.selectedTaxOption?.label || 'Without Tax'}
                            </Text>
                            <Icon
                              source="chevron-down"
                              size={14}
                              color={
                                values.selectedTaxOption?.id === 'with_tax'
                                  ? theme.colors.onPrimary
                                  : theme.colors.onSurfaceVariant
                              }
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                      {touched.salesPrice && errors.salesPrice && (
                        <Text
                          style={{
                            color: theme.colors.error,
                            fontSize: 12,
                            marginTop: -4,
                            marginBottom: 8,
                          }}
                        >
                          {errors.salesPrice}
                        </Text>
                      )}
                      {/* Discount Price Input with inline Discount Type Button */}
                      <View style={styles.discountPriceInputContainer}>
                        <TextInput
                          label="Discount"
                          mode="outlined"
                          value={values.discountPrice}
                          onChangeText={handleChange('discountPrice')}
                          onBlur={() => setFieldTouched('discountPrice', true)}
                          style={styles.input}
                          theme={{ roundness: 12 }}
                          contentStyle={styles.discountPriceInputContent}
                          placeholder="Enter discount"
                          keyboardType="numeric"
                          maxLength={10}
                          error={
                            touched.discountPrice && !!errors.discountPrice
                          }
                        />

                        {/* Inline Discount Type Button */}
                        <TouchableOpacity
                          style={[
                            styles.discountTypeButton,
                            {
                              backgroundColor:
                                values.selectedDiscountType?.id === 'amount'
                                  ? theme.colors.primary
                                  : theme.colors.surfaceVariant,
                              borderColor:
                                values.selectedDiscountType?.id === 'amount'
                                  ? theme.colors.primary
                                  : theme.colors.outline,
                            },
                          ]}
                          onPress={() => {
                            discountTypeSheet.present();
                            Keyboard.dismiss();
                          }}
                          disabled={isTransitioning}
                          activeOpacity={0.7}
                        >
                          <Icon
                            source={
                              values.selectedDiscountType?.icon || 'percent'
                            }
                            size={14}
                            color={
                              values.selectedDiscountType?.id === 'amount'
                                ? theme.colors.onPrimary
                                : theme.colors.onSurfaceVariant
                            }
                          />
                          <Text
                            style={[
                              styles.discountTypeButtonText,
                              {
                                color:
                                  values.selectedDiscountType?.id === 'amount'
                                    ? theme.colors.onPrimary
                                    : theme.colors.onSurfaceVariant,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {values.selectedDiscountType?.label || 'Percentage'}
                          </Text>
                          <Icon
                            source="chevron-down"
                            size={14}
                            color={
                              values.selectedDiscountType?.id === 'amount'
                                ? theme.colors.onPrimary
                                : theme.colors.onSurfaceVariant
                            }
                          />
                        </TouchableOpacity>
                      </View>
                      {values.salesPrice && values.discountPrice && (
                        <View style={{ marginBottom: 10 }}>
                          <Text
                            style={{
                              fontSize: 14,
                              color: theme.colors.onSurfaceVariant,
                              fontWeight: '500',
                            }}
                          >
                            {(() => {
                              const sale = Number(values.salesPrice) || 0;
                              const discount =
                                Number(values.discountPrice) || 0;
                              let finalPrice = sale;

                              if (
                                values.selectedDiscountType?.id === 'percentage'
                              ) {
                                finalPrice = sale - (sale * discount) / 100;
                              } else {
                                finalPrice = sale - discount;
                              }

                              if (finalPrice < 0) finalPrice = 0;

                              return `Sales Price (After Discount): ₹${finalPrice.toFixed(
                                2,
                              )}`;
                            })()}
                          </Text>
                        </View>
                      )}
                      {touched.discountPrice && errors.discountPrice && (
                        <Text
                          style={{
                            color: theme.colors.error,
                            fontSize: 12,
                            // marginTop: -4,
                            marginBottom: 8,
                          }}
                        >
                          {errors.discountPrice}
                        </Text>
                      )}
                    </View>

                    {/* Tax Rate Section - Conditionally Rendered */}
                    {storedata?.gstNumber && (
                      <>
                        {/* <View style={styles.headerSection}>
                          <Icon
                            source="percent"
                            size={24}
                            color={theme.colors.primary}
                          />
                          <Text
                            style={[
                              styles.headerTitle,
                              { color: theme.colors.onSurface },
                            ]}
                          >
                            Tax Rate
                          </Text>
                        </View>

                        <Divider
                          style={[
                            styles.divider,
                            { backgroundColor: theme.colors.outline },
                          ]}
                        /> */}

                        <View style={styles.inputContainer}>
                          <TextInput
                            label="Tax Rate"
                            value={getTaxRateText(values.selectedTaxRate)}
                            mode="outlined"
                            editable={false}
                            style={[
                              styles.input,
                              isTransitioning && styles.inputDisabled,
                            ]}
                            theme={{ roundness: 12 }}
                            contentStyle={styles.inputContent}
                            right={<TextInput.Icon icon="chevron-down" />}
                            placeholder="Select tax rate"
                            error={
                              touched.selectedTaxRate &&
                              !!errors.selectedTaxRate
                            }
                          />
                          <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            onPress={() => taxRateSheet.present()}
                            activeOpacity={0.7}
                            disabled={isTransitioning}
                            accessibilityLabel="Select tax rate"
                            accessibilityHint="Opens a list of available GST tax rates"
                          />
                        </View>
                        {touched.selectedTaxRate && errors.selectedTaxRate && (
                          <Text
                            style={{
                              color: theme.colors.error,
                              fontSize: 12,
                              marginTop: -4,
                              marginBottom: 8,
                            }}
                          >
                            {errors.selectedTaxRate}
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                  {/* </ScrollView>
                </KeyboardAvoidingView> */}
                </KeyboardAwareScrollView>

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  {/* Cancel Button */}
                  {/* Cancel Button */}
                  <Button
                    mode="outlined"
                    onPress={() => setAlertVisible(true)} // just show alert
                    disabled={isTransitioning}
                    style={[
                      styles.submitButton,
                      {
                        flex: 1,
                        marginRight: 8,
                        backgroundColor: 'transparent',
                        borderColor: theme.colors.outline,
                        borderWidth: 1,
                      },
                    ]}
                    contentStyle={styles.submitButtonContent}
                    labelStyle={[
                      styles.submitButtonLabel,
                      { color: theme.colors.primary },
                    ]}
                  >
                    Cancel
                  </Button>

                  {/* Add Item Button - unchanged design */}

                  <Button
                    mode="contained"
                    onPress={handleSubmit}
                    disabled={
                      isTransitioning ||
                      !isValid ||
                      !hasPermission(permissions.CAN_MANAGE_PRODUCTS)
                    }
                    style={[styles.submitButton, { flex: 1 }]}
                    contentStyle={styles.submitButtonContent}
                    labelStyle={[
                      styles.submitButtonLabel,
                      {
                        color:
                          isTransitioning || !isValid
                            ? theme.colors.onBackground
                            : theme.colors.onSurface,
                      },
                    ]}
                  >
                    {isTransitioning ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.primary}
                      />
                    ) : isEditMode ? (
                      'Update Item'
                    ) : (
                      'Add Item'
                    )}
                  </Button>
                </View>

                {/* Bottom Sheets */}
                <UnitSelectorBottomSheet
                  ref={unitSheet.bottomSheetRef}
                  units={units}
                  selectedUnit={values.selectedUnit}
                  onUnitSelect={unit =>
                    handleSelect({
                      field: 'selectedUnit',
                      value: unit,
                      helpers: {
                        setFieldValue,
                        setFieldTouched,
                        setFieldError,
                      },
                      closeFn: unitSheet.close,
                    })
                  }
                />
                <CategorySelectorBottomSheet
                  ref={categorySheet.bottomSheetRef}
                  //categories={categories}
                  selectedCategory={values.selectedCategory}
                  onCategorySelect={cat =>
                    handleSelect({
                      field: 'selectedCategory',
                      value: cat,
                      helpers: {
                        setFieldValue,
                        setFieldTouched,
                        setFieldError,
                      },
                      closeFn: categorySheet.close,
                    })
                  }
                  onAddNewCategory={async (category = null) => {
                    categorySheet.close();
                    setTimeout(() => {
                      if (category) {
                        setCategoryToEdit(category); // Set category to edit
                        addCategorySheet.expand(category);
                      } else {
                        setCategoryToEdit(null); // Clear on create
                        addCategorySheet.expand();
                      }
                    }, 300);
                  }}
                  refreshKey={categoryRefreshKey}
                />
                <AddCategoryBottomSheet
                  ref={addCategorySheet.bottomSheetRef}
                  onCreateCategory={async res => {
                    const newCategory = res.data; // ✅ API se jo category object aaya
                    handleCreateCategory(newCategory, setFieldValue);
                    setCategoryRefreshKey(prev => prev + 1);

                    handleSelect({
                      field: 'selectedCategory',
                      value: newCategory,
                      helpers: {
                        setFieldValue,
                        setFieldTouched,
                        setFieldError,
                      },
                      closeFn: addCategorySheet.close,
                    });

                    categorySheet.expand(); // wapas open karo
                  }}
                  onUpdateCategory={handleUpdateCategory}
                  category={categoryToEdit}
                />
                <HsnCodeSelectorBottomSheet
                  ref={hsnBottomSheet.bottomSheetRef}
                  selectedHsnCode={selectedHsnCode}
                  onHsnCodeSelect={handleHsnCodeSelect}
                  onAddNewHsnCode={handleAddNewHsnCode}
                  refreshKey={hsnCodeRefreshKey}
                />
                <AddHsnCodeBottomSheet
                  ref={addHsnSheet.bottomSheetRef}
                  onCreateHsnCode={handleCreateHsnCode}
                  // Optionally support update/actions as well
                />
                <TaxRateSelectorBottomSheet
                  ref={taxRateSheet.bottomSheetRef}
                  selectedTaxRate={values.selectedTaxRate}
                  onTaxRateSelect={rate =>
                    handleSelect({
                      field: 'selectedTaxRate',
                      value: rate,
                      helpers: {
                        setFieldValue,
                        setFieldTouched,
                        setFieldError,
                      },
                      closeFn: taxRateSheet.close,
                    })
                  }
                />
                <TaxSelectorBottomSheet
                  ref={taxOptionSheet.bottomSheetRef}
                  selectedTaxOption={values.selectedTaxOption}
                  onTaxOptionSelect={option =>
                    handleSelect({
                      field: 'selectedTaxOption',
                      value: option,
                      helpers: {
                        setFieldValue,
                        setFieldTouched,
                        setFieldError,
                      },
                      closeFn: taxOptionSheet.close,
                      extra: (
                        { setFieldValue, setFieldTouched, setFieldError },
                        val,
                      ) => {
                        if (val.id === 'without_tax') {
                          setFieldValue('selectedTaxRate', null);
                          setFieldTouched('selectedTaxRate', false);
                          setFieldError('selectedTaxRate', undefined);
                        }
                      },
                    })
                  }
                />

                <TaxSelectorBottomSheet
                  ref={purchaseTaxOptionSheet.bottomSheetRef}
                  selectedTaxOption={values.selectedPurchaseTaxOption}
                  onTaxOptionSelect={option =>
                    handleSelect({
                      field: 'selectedPurchaseTaxOption',
                      value: option,
                      helpers: {
                        setFieldValue,
                        setFieldTouched,
                        setFieldError,
                      },
                      closeFn: purchaseTaxOptionSheet.close,
                      extra: (
                        { setFieldValue, setFieldTouched, setFieldError },
                        val,
                      ) => {
                        if (val.id === 'without_tax') {
                          setFieldValue('selectedPurchaseTaxRate', null);
                          setFieldTouched('selectedPurchaseTaxRate', false);
                          setFieldError('selectedPurchaseTaxRate', undefined);
                        }
                      },
                    })
                  }
                />

                {/* ✅ Purchase Tax Rate Sheet */}
                <TaxRateSelectorBottomSheet
                  ref={purchaseTaxRateSheet.bottomSheetRef}
                  selectedTaxRate={values.selectedPurchaseTaxRate}
                  onTaxRateSelect={rate =>
                    handleSelect({
                      field: 'selectedPurchaseTaxRate',
                      value: rate,
                      helpers: {
                        setFieldValue,
                        setFieldTouched,
                        setFieldError,
                      },
                      closeFn: purchaseTaxRateSheet.close,
                    })
                  }
                />
                <DiscountTypeSelectorBottomSheet
                  ref={discountTypeSheet.bottomSheetRef}
                  selectedDiscountType={values.selectedDiscountType}
                  onDiscountTypeSelect={type =>
                    handleSelect({
                      field: 'selectedDiscountType',
                      value: type,
                      helpers: {
                        setFieldValue,
                        setFieldTouched,
                        setFieldError,
                      },
                      closeFn: discountTypeSheet.close,
                    })
                  }
                />
                <DiscountTypeSelectorBottomSheet
                  ref={purchaseDiscountTypeSheet.bottomSheetRef}
                  selectedDiscountType={values.selectedPurchaseDiscountType}
                  onDiscountTypeSelect={type =>
                    handleSelect({
                      field: 'selectedPurchaseDiscountType',
                      value: type,
                      helpers: {
                        setFieldValue,
                        setFieldTouched,
                        setFieldError,
                      },
                      closeFn: purchaseDiscountTypeSheet.close,
                    })
                  }
                />
              </>
            );
          }}
        </Formik>
        <CustomAlert
          visible={alertVisible}
          onDismiss={() => setAlertVisible(false)}
          title="Discard changes?"
          message="Are you sure you want to discard all changes and exit?"
          type="warning"
          actions={[
            {
              label: 'No',
              mode: 'outlined',
              color: theme.colors.primary,
              onPress: () => setAlertVisible(false),
            },
            {
              label: 'Yes',
              mode: 'contained',
              color: theme.colors.error,
              onPress: () => {
                setAlertVisible(false);
                formikRef.current?.resetForm();
                navigation.goBack();
              },
            },
          ]}
        />

        {/* // </KeyboardAvoidingView> */}
      </SafeAreaView>
    </View>
  );
};

// Your exact styles - unchanged
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  content: {
    paddingHorizontal: 20,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  divider: {
    marginBottom: 8,
    height: 1,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  input: {
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  inputDisabled: {
    opacity: 0.6,
  },
  inputContent: {
    fontSize: 16,
  },
  itemCodeInputContainer: {
    position: 'relative',
  },
  itemCodeInputContent: {
    fontSize: 16,
    paddingRight: 110,
  },
  assignCodeButton: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -16 }],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    minWidth: 90,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    zIndex: 10,
  },
  assignCodeButtonText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  salesPriceSection: {
    marginTop: 8,
  },
  PurchasePriceSection: {
    marginTop: 8,
  },
  salesPriceInputContainer: {
    position: 'relative',
  },
  salesPriceInputContent: {
    fontSize: 16,
    paddingRight: 130,
  },
  taxOptionButton: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -18 }],
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 120,
    height: 32,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    zIndex: 10,
  },
  taxOptionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 4,
    flex: 1,
  },
  submitButton: {
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginVertical: 8,
    marginHorizontal: 20,
  },
  submitButtonContent: {},
  submitButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  discountPriceSection: {
    marginTop: 8,
  },
  discountPriceInputContainer: {
    position: 'relative',
  },
  discountPriceInputContent: {
    fontSize: 16,
    paddingRight: 130,
  },
  discountTypeButton: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -18 }],
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 120,
    height: 32,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    zIndex: 10,
  },
  discountTypeButtonText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 4,
    flex: 1,
  },
  taxRateSection: {
    marginTop: 8,
  },
});

export default AddPurchaseItem;
