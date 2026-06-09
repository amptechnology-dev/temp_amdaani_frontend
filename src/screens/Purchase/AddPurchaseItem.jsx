// AddPurchaseItem.jsx - Add + Update unified

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
  BackHandler,
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
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import api from '../../utils/api';
import HsnCodeSelectorBottomSheet from '../../components/BottomSheet/HsnCodeSelectorBottomSheet';
import AddHsnCodeBottomSheet from '../../components/BottomSheet/HsnCodeCreateBottomSheet';
import { useAuth, permissions } from '../../context/AuthContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import CustomAlert from '../../components/CustomAlert';

// ─── Validation Schema ────────────────────────────────────────────────────────
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
  selectedPurchaseTaxRate: Yup.object()
    .nullable()
    .when('selectedPurchaseTaxOption', {
      is: taxOption => taxOption && taxOption.id !== 'without_tax',
      then: schema =>
        schema.required('Tax rate is required when tax is applicable'),
      otherwise: schema => schema.nullable(),
    }),
  // ✅ FIX: match DB schema fields — same as AddItem
  discountPrice: Yup.number()
    .nullable()
    .min(0, 'Discount price cannot be negative')
    .typeError('Discount must be a valid number'),
  selectedDiscountType: Yup.object().nullable(),
  discountType: Yup.string().oneOf(['percentage', 'amount']),
  discountPercentage: Yup.number()
    .typeError('Discount percentage must be a number')
    .min(0, 'Discount percentage cannot be negative')
    .max(100, 'Discount percentage cannot be more than 100'),
  purchaseDiscountType: Yup.string().oneOf(['percentage', 'amount']),
  purchaseDiscountPercentage: Yup.number()
    .typeError('Purchase discount percentage must be a number')
    .min(0, 'Purchase discount percentage cannot be negative')
    .max(100, 'Purchase discount percentage cannot be more than 100'),
  mrp: Yup.number()
    .typeError('MRP must be a number')
    .min(0, 'MRP cannot be negative'),
  selectedTaxOption: Yup.object().nullable(),
  selectedPurchaseTaxOption: Yup.object().nullable(),
});

const AddPurchaseItem = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const itemToEdit = route.params?.item || null;

  const isEditMode = Boolean(itemToEdit);
  const { authState, isStockEnabled, hasPermission } = useAuth();
  const storedata = authState?.user?.store;

  const theme = useTheme();
  const formikRef = useRef(null);

  // ─── Bottom Sheet Hooks ───────────────────────────────────────────────────
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
      label: 'Exclude Tax',
      description: 'Price excludes taxes (tax will be added)',
      icon: 'minus-circle-outline',
    }),
    [],
  );

  const withTaxOption = useMemo(
    () => ({
      id: 'with_tax',
      label: 'Include Tax',
      description: 'Price includes/applies tax',
      icon: 'check-decagram',
    }),
    [],
  );

  const defaultDiscountType = useMemo(
    () => ({
      id: 'amount',
      label: 'Amount',
      description: 'Discount as fixed amount off the price',
      icon: 'currency-inr',
      symbol: '₹',
    }),
    [],
  );

  const percentageDiscountType = useMemo(
    () => ({
      id: 'percentage',
      label: 'Percentage',
      icon: 'percent',
      symbol: '%',
    }),
    [],
  );

  // ─── State ────────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState(categoriesData.categories);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryRefreshKey, setCategoryRefreshKey] = useState(0);
  const [selectedHsnCode, setSelectedHsnCode] = useState(null);
  const [hsnCodeRefreshKey, setHsnCodeRefreshKey] = useState(0);
  const [alertVisible, setAlertVisible] = useState(false);

  const { units } = unitsData;

  // ─── Hardware back press ──────────────────────────────────────────────────
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        const isDirty = formikRef.current?.dirty;
        if (isDirty) {
          setAlertVisible(true);
          return true;
        }
        navigation.goBack();
        return true;
      };
      const sub = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );
      return () => sub.remove();
    }, [navigation]),
  );

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const mapUnitFromItem = useCallback(
    unitValue => {
      if (!unitValue) return null;
      if (typeof unitValue === 'object' && unitValue.name) {
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
      if (typeof categoryValue === 'object' && categoryValue._id) {
        return categoryValue;
      }
      if (typeof categoryValue === 'string') {
        return categories.find(c => c._id === categoryValue) || null;
      }
      return null;
    },
    [categories],
  );

  // ─── Initial Form Values ──────────────────────────────────────────────────
  // ✅ FIX: mirrors AddItem exactly — reads all discount fields from DB schema
  const initialValues = useMemo(() => {
    const unitMapped = mapUnitFromItem(itemToEdit?.unit);
    const categoryMapped = itemToEdit?.category
      ? mapCategoryFromItem(itemToEdit.category)
      : null;

    // Selling side tax
    const taxOption = itemToEdit?.isTaxInclusive
      ? withTaxOption
      : defaultTaxOption;

    const taxRate =
      itemToEdit?.gstRate && Number(itemToEdit.gstRate) > 0
        ? {
            rate: Number(itemToEdit.gstRate),
            label: `${itemToEdit.gstRate}% GST`,
          }
        : null;

    // Purchase side tax
    const purchaseTaxOption = itemToEdit?.isPurchaseTaxInclusive
      ? withTaxOption
      : defaultTaxOption;

    const purchaseTaxRate =
      itemToEdit?.purchaseGstRate && Number(itemToEdit.purchaseGstRate) > 0
        ? {
            rate: Number(itemToEdit.purchaseGstRate),
            label: `${itemToEdit.purchaseGstRate}% GST`,
          }
        : null;

    // ✅ FIX: Selling discount — read discountType + discountPercentage + discountPrice
    //         Same logic as AddItem
    const savedDiscountType = itemToEdit?.discountType ?? 'amount';
    const savedDiscountPercentage = Number(itemToEdit?.discountPercentage ?? 0);
    const savedDiscountPrice = Number(itemToEdit?.discountPrice ?? 0);

    const discountPriceDisplay =
      savedDiscountType === 'percentage'
        ? savedDiscountPercentage > 0
          ? String(savedDiscountPercentage)
          : Number(itemToEdit?.discountPercent ?? 0) > 0
          ? String(Number(itemToEdit.discountPercent))
          : ''
        : savedDiscountPrice > 0
        ? String(savedDiscountPrice)
        : '';

    const selectedDiscountType =
      savedDiscountType === 'percentage'
        ? percentageDiscountType
        : defaultDiscountType;

    // ✅ FIX: Purchase discount — read purchaseDiscountType + purchaseDiscountPercentage
    //         Same logic as AddItem
    const savedPurchaseDiscountType =
      itemToEdit?.purchaseDiscountType ?? 'amount';
    const savedPurchaseDiscountPercentage = Number(
      itemToEdit?.purchaseDiscountPercentage ?? 0,
    );
    const savedPurchaseDiscountFlat = Number(itemToEdit?.purchaseDiscount ?? 0);

    const purchaseDiscountDisplay =
      savedPurchaseDiscountType === 'percentage'
        ? savedPurchaseDiscountPercentage > 0
          ? String(savedPurchaseDiscountPercentage)
          : ''
        : savedPurchaseDiscountFlat > 0
        ? String(savedPurchaseDiscountFlat)
        : '';

    const selectedPurchaseDiscountType =
      savedPurchaseDiscountType === 'percentage'
        ? percentageDiscountType
        : defaultDiscountType;

    return {
      itemName: itemToEdit?.name || '',
      itemCode: itemToEdit?.sku || '',
      hsnCode: itemToEdit?.hsn || '',
      mrp: itemToEdit?.mrp ? String(itemToEdit.mrp) : '',
      salesPrice: itemToEdit?.sellingPrice
        ? String(itemToEdit.sellingPrice)
        : itemToEdit?.price
        ? String(itemToEdit.price)
        : '',
      purchasePrice: itemToEdit?.costPrice ? String(itemToEdit.costPrice) : '',
      selectedUnit: unitMapped,
      selectedCategory: categoryMapped,

      // Selling side tax
      selectedTaxOption: taxOption,
      selectedTaxRate: taxRate,

      // Purchase side tax
      selectedPurchaseTaxOption: purchaseTaxOption,
      selectedPurchaseTaxRate: purchaseTaxRate,

      // ✅ FIX: Selling discount fields — all DB fields populated
      discountPrice: discountPriceDisplay,
      selectedDiscountType,
      discountType: savedDiscountType,
      discountPercentage: savedDiscountPercentage,

      // ✅ FIX: Purchase discount fields — all DB fields populated
      purchaseDiscount: purchaseDiscountDisplay,
      selectedPurchaseDiscountType,
      purchaseDiscountType: savedPurchaseDiscountType,
      purchaseDiscountPercentage: savedPurchaseDiscountPercentage,
    };
  }, [
    itemToEdit,
    mapUnitFromItem,
    mapCategoryFromItem,
    defaultTaxOption,
    withTaxOption,
    defaultDiscountType,
    percentageDiscountType,
  ]);

  // ─── HSN handlers ─────────────────────────────────────────────────────────
  const handleAddNewHsnCode = useCallback(() => {
    hsnBottomSheet.close();
    addHsnSheet.expand();
  }, []);

  const handleCreateHsnCode = useCallback(
    newHsn => {
      addHsnSheet.close();
      if (formikRef.current) {
        const { setFieldValue } = formikRef.current;
        setSelectedHsnCode(newHsn);
        setFieldValue('hsnCode', newHsn.code);
        if (newHsn.gstRate && Number(newHsn.gstRate) > 0) {
          const taxRateObject = {
            rate: Number(newHsn.gstRate),
            label: `${newHsn.gstRate}% GST`,
          };
          setFieldValue('selectedTaxRate', taxRateObject);
          setFieldValue('selectedTaxOption', defaultTaxOption);
          setFieldValue('selectedPurchaseTaxRate', taxRateObject);
          setFieldValue('selectedPurchaseTaxOption', defaultTaxOption);
        } else {
          setFieldValue('selectedTaxRate', null);
          setFieldValue('selectedTaxOption', defaultTaxOption);
          setFieldValue('selectedPurchaseTaxRate', null);
          setFieldValue('selectedPurchaseTaxOption', defaultTaxOption);
        }
      }
      setHsnCodeRefreshKey(Date.now());
    },
    [defaultTaxOption],
  );

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

  // ─── Submit ───────────────────────────────────────────────────────────────
  // ✅ FIX: mirrors AddItem's discount calculation exactly
  const handleSubmitForm = async (values, { resetForm, setSubmitting }) => {
    try {
      setIsTransitioning(true);

      const salesPrice = Number(values.salesPrice) || 0;
      const purchasePrice = Number(values.purchasePrice) || 0;

      // ── Selling discount ──────────────────────────────────────────────────
      const inputDiscount = Number(values.discountPrice) || 0;
      const discountTypeId = values.selectedDiscountType?.id ?? 'amount';

      let discountValue = 0;
      let discountPercentage = 0;

      if (discountTypeId === 'percentage') {
        discountPercentage = inputDiscount;
        discountValue = parseFloat(
          ((salesPrice * inputDiscount) / 100).toFixed(2),
        );
      } else {
        discountValue = inputDiscount;
        discountPercentage =
          salesPrice > 0
            ? parseFloat(((inputDiscount / salesPrice) * 100).toFixed(4))
            : 0;
      }

      // ── Purchase discount ─────────────────────────────────────────────────
      const inputPurchaseDiscount = Number(values.purchaseDiscount) || 0;
      const purchaseDiscountTypeId =
        values.selectedPurchaseDiscountType?.id ?? 'amount';

      let purchaseDiscountValue = 0;
      let purchaseDiscountPercentage = 0;

      if (purchaseDiscountTypeId === 'percentage') {
        purchaseDiscountPercentage = inputPurchaseDiscount;
        purchaseDiscountValue = parseFloat(
          ((purchasePrice * inputPurchaseDiscount) / 100).toFixed(2),
        );
      } else {
        purchaseDiscountValue = inputPurchaseDiscount;
        purchaseDiscountPercentage =
          purchasePrice > 0
            ? parseFloat(
                ((inputPurchaseDiscount / purchasePrice) * 100).toFixed(4),
              )
            : 0;
      }

      // ── Payload ───────────────────────────────────────────────────────────
      // ✅ FIX: all DB schema discount fields sent — matches AddItem exactly
      const payload = {
        name: values.itemName,
        unit: values.selectedUnit?.name || values.selectedUnit || '',
        category:
          values.selectedCategory?._id || values.selectedCategory?.id || '',
        sku: values.itemCode,
        hsn: values.hsnCode,
        mrp: Number(values.mrp) || 0,
        sellingPrice: values.salesPrice ? Number(values.salesPrice) : 0,
        costPrice: Number(values.purchasePrice),

        // Selling side GST
        gstRate: Number(values.selectedTaxRate?.rate) || 0,
        isTaxInclusive: values.selectedTaxOption?.id === 'with_tax',

        // ✅ Selling discount — all 3 DB fields
        discountPrice: discountValue,
        discountType: discountTypeId,
        discountPercentage: discountPercentage,

        // Purchase side GST
        purchaseGstRate: Number(values.selectedPurchaseTaxRate?.rate) || 0,
        isPurchaseTaxInclusive:
          values.selectedPurchaseTaxOption?.id === 'with_tax',

        // ✅ Purchase discount — all 3 DB fields
        purchaseDiscount: purchaseDiscountValue,
        purchaseDiscountType: purchaseDiscountTypeId,
        purchaseDiscountPercentage: purchaseDiscountPercentage,
      };

      console.log('payload ===>', payload);

      if (isEditMode) {
        const id = itemToEdit.id || itemToEdit._id;
        await api.put(`/product/id/${id}`, payload);

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Item updated successfully!',
        });

        // ✅ FIX: resetForm includes all discount fields so isDirty resets correctly
        resetForm({
          values: {
            itemName: payload.name,
            itemCode: payload.sku,
            hsnCode: payload.hsn,
            mrp: String(payload.mrp),
            salesPrice: String(payload.sellingPrice),
            purchasePrice: String(payload.costPrice),
            selectedUnit: values.selectedUnit,
            selectedCategory: values.selectedCategory,

            selectedTaxOption: values.selectedTaxOption,
            selectedTaxRate: values.selectedTaxRate,

            selectedPurchaseTaxOption: values.selectedPurchaseTaxOption,
            selectedPurchaseTaxRate: values.selectedPurchaseTaxRate,

            // ✅ Selling discount reset
            discountPrice: inputDiscount > 0 ? String(inputDiscount) : '',
            selectedDiscountType: values.selectedDiscountType,
            discountType: discountTypeId,
            discountPercentage: discountPercentage,

            // ✅ Purchase discount reset
            purchaseDiscount:
              inputPurchaseDiscount > 0 ? String(inputPurchaseDiscount) : '',
            selectedPurchaseDiscountType: values.selectedPurchaseDiscountType,
            purchaseDiscountType: purchaseDiscountTypeId,
            purchaseDiscountPercentage: purchaseDiscountPercentage,
          },
        });
      } else {
        const response = await api.post('/product', payload);
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
          console.log('New item created:', newItem);
          route.params.onItemCreated(newItem);
          navigation.pop();
        }

        resetForm();
      }
    } catch (error) {
      console.log('Submit error:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: error?.message || 'An error occurred while saving the item.',
      });
    } finally {
      setSubmitting(false);
      setIsTransitioning(false);
    }
  };

  // ─── Display helpers ──────────────────────────────────────────────────────
  const getUnitText = unit => (unit ? `${unit.name} (${unit.symbol})` : '');
  const getCategoryText = cat => (cat ? cat.name : '');
  const getTaxRateText = rate =>
    rate ? `${rate.rate}% ${rate.label.includes('IGST') ? 'IGST' : 'GST'}` : '';

  // ─── Render ───────────────────────────────────────────────────────────────
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
              if (!hsnCode) {
                setSelectedHsnCode(null);
                setFieldValue('hsnCode', '');
                setFieldValue('selectedTaxRate', null);
                setFieldValue('selectedTaxOption', defaultTaxOption);
                setFieldValue('selectedPurchaseTaxRate', null);
                setFieldValue('selectedPurchaseTaxOption', defaultTaxOption);
                hsnBottomSheet.close();
                return;
              }

              setSelectedHsnCode(hsnCode);
              setFieldValue('hsnCode', hsnCode.code);

              if (hsnCode.gstRate && Number(hsnCode.gstRate) > 0) {
                const taxRateObject = {
                  rate: Number(hsnCode.gstRate),
                  label: `${hsnCode.gstRate}% GST`,
                };
                setFieldValue('selectedTaxRate', taxRateObject);
                setFieldValue('selectedTaxOption', defaultTaxOption);
                setFieldValue('selectedPurchaseTaxRate', taxRateObject);
                setFieldValue('selectedPurchaseTaxOption', defaultTaxOption);
              } else {
                setFieldValue('selectedTaxRate', null);
                setFieldValue('selectedTaxOption', defaultTaxOption);
                setFieldValue('selectedPurchaseTaxRate', null);
                setFieldValue('selectedPurchaseTaxOption', defaultTaxOption);
              }
              hsnBottomSheet.close();
            };

            return (
              <>
                <KeyboardAwareScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.scrollContent}
                  enableOnAndroid={true}
                  keyboardShouldPersistTaps="always"
                  keyboardDismissMode="on-drag"
                  extraScrollHeight={120}
                  extraHeight={120}
                  keyboardOpeningTime={0}
                  enableAutomaticScroll={true}
                  scrollToOverflowEnabled={true}
                >
                  <View style={styles.content}>
                    {/* ── Product Details Header ── */}
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

                    {/* Item Name */}
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
                      <Text style={styles.fieldError}>{errors.itemName}</Text>
                    )}

                    {/* Unit */}
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
                      />
                    </View>
                    {touched.selectedUnit && errors.selectedUnit && (
                      <Text style={styles.fieldError}>
                        {errors.selectedUnit}
                      </Text>
                    )}

                    {/* Category */}
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
                      />
                    </View>
                    {touched.selectedCategory && errors.selectedCategory && (
                      <Text style={styles.fieldError}>
                        {errors.selectedCategory}
                      </Text>
                    )}

                    {/* HSN Code */}
                    {storedata?.gstNumber && (
                      <View style={styles.inputContainer}>
                        <TextInput
                          label="HSN/SAC Code"
                          value={values.hsnCode}
                          onChangeText={handleChange('hsnCode')}
                          mode="outlined"
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
                            Keyboard.dismiss();
                            hsnBottomSheet.expand();
                          }}
                          activeOpacity={0.7}
                          disabled={isTransitioning}
                        />
                      </View>
                    )}

                    {/* MRP */}
                    <TextInput
                      label="MRP"
                      mode="outlined"
                      value={values.mrp}
                      onChangeText={handleChange('mrp')}
                      onBlur={() => setFieldTouched('mrp', true)}
                      style={styles.input}
                      theme={{ roundness: 12 }}
                      contentStyle={styles.salesPriceInputContent}
                      placeholder="Enter MRP"
                      keyboardType="numeric"
                      maxLength={15}
                      error={touched.mrp && !!errors.mrp}
                    />

                    {/* ── Purchase Rate Section ── */}
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
                      <Divider
                        style={[
                          styles.divider,
                          { backgroundColor: theme.colors.outline },
                        ]}
                      />

                      {/* Purchase Price + Tax inclusive toggle */}
                      <View style={styles.salesPriceInputContainer}>
                        <TextInput
                          label="Purchase Rate *"
                          mode="outlined"
                          value={values.purchasePrice}
                          onChangeText={handleChange('purchasePrice')}
                          onBlur={() => setFieldTouched('purchasePrice', true)}
                          style={styles.input}
                          theme={{ roundness: 12 }}
                          contentStyle={styles.salesPriceInputContent}
                          placeholder="Enter purchase rate"
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
                                'Exclude Tax'}
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
                        <Text style={styles.fieldError}>
                          {errors.purchasePrice}
                        </Text>
                      )}

                      {/* ✅ FIX: Purchase Discount — mirrors AddItem discount section exactly */}
                      <View style={styles.discountPriceInputContainer}>
                        <TextInput
                          label="Purchase Discount"
                          mode="outlined"
                          value={values.purchaseDiscount}
                          onChangeText={text => {
                            handleChange('purchaseDiscount')(text);
                            // ✅ Keep purchaseDiscountType in sync
                            setFieldValue(
                              'purchaseDiscountType',
                              values.selectedPurchaseDiscountType?.id ??
                                'amount',
                            );
                          }}
                          onBlur={() =>
                            setFieldTouched('purchaseDiscount', true)
                          }
                          style={styles.input}
                          theme={{ roundness: 12 }}
                          contentStyle={styles.discountPriceInputContent}
                          placeholder="Enter purchase discount"
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
                            purchaseDiscountTypeSheet.present();
                            Keyboard.dismiss();
                          }}
                          disabled={isTransitioning}
                          activeOpacity={0.7}
                        >
                          <Icon
                            source={
                              values.selectedPurchaseDiscountType?.icon ||
                              'currency-inr'
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
                      {touched.purchaseDiscount && errors.purchaseDiscount && (
                        <Text style={styles.fieldError}>
                          {errors.purchaseDiscount}
                        </Text>
                      )}

                      {/* Purchase price after discount preview */}
                      {values.purchasePrice && values.purchaseDiscount ? (
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
                      ) : null}

                      {/* Purchase Tax Rate */}
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
                              onPress={() => purchaseTaxRateSheet.present()}
                              activeOpacity={0.7}
                              disabled={isTransitioning}
                            />
                          </View>
                          {touched.selectedPurchaseTaxRate &&
                            errors.selectedPurchaseTaxRate && (
                              <Text style={styles.fieldError}>
                                {errors.selectedPurchaseTaxRate}
                              </Text>
                            )}
                        </>
                      )}
                    </View>

                    {/* ── Selling Price Section ── */}
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
                          Selling Price
                        </Text>
                      </View>
                      <Divider
                        style={[
                          styles.divider,
                          { backgroundColor: theme.colors.outline },
                        ]}
                      />

                      {/* Sales Price + Tax inclusive toggle */}
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
                              {values.selectedTaxOption?.label || 'Exclude Tax'}
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
                        <Text style={styles.fieldError}>
                          {errors.salesPrice}
                        </Text>
                      )}

                      {/* ✅ FIX: Selling Discount — mirrors AddItem discount section exactly */}
                      <View style={styles.discountPriceInputContainer}>
                        <TextInput
                          label="Discount on Sales"
                          mode="outlined"
                          value={values.discountPrice}
                          onChangeText={text => {
                            handleChange('discountPrice')(text);
                            // ✅ Keep discountType in sync
                            setFieldValue(
                              'discountType',
                              values.selectedDiscountType?.id ?? 'amount',
                            );
                          }}
                          onBlur={() => setFieldTouched('discountPrice', true)}
                          style={styles.input}
                          theme={{ roundness: 12 }}
                          contentStyle={styles.discountPriceInputContent}
                          placeholder="Enter discount on sales"
                          keyboardType="numeric"
                          maxLength={10}
                          error={
                            touched.discountPrice && !!errors.discountPrice
                          }
                        />
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
                              values.selectedDiscountType?.icon ||
                              'currency-inr'
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
                            {values.selectedDiscountType?.label || 'Amount'}
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
                      {touched.discountPrice && errors.discountPrice && (
                        <Text style={styles.fieldError}>
                          {errors.discountPrice}
                        </Text>
                      )}

                      {/* Sales price after discount preview */}
                      {values.salesPrice && values.discountPrice ? (
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
                      ) : null}

                      {/* Selling Tax Rate */}
                      {storedata?.gstNumber && (
                        <>
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
                            />
                          </View>
                          {touched.selectedTaxRate &&
                            errors.selectedTaxRate && (
                              <Text style={styles.fieldError}>
                                {errors.selectedTaxRate}
                              </Text>
                            )}
                        </>
                      )}
                    </View>
                  </View>
                </KeyboardAwareScrollView>

                {/* ── Action Buttons ── */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Button
                    mode="outlined"
                    onPress={() => setAlertVisible(true)}
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

                {/* ── Bottom Sheets ── */}
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
                        setCategoryToEdit(category);
                        addCategorySheet.expand(category);
                      } else {
                        setCategoryToEdit(null);
                        addCategorySheet.expand();
                      }
                    }, 300);
                  }}
                  refreshKey={categoryRefreshKey}
                />
                <AddCategoryBottomSheet
                  ref={addCategorySheet.bottomSheetRef}
                  onCreateCategory={async res => {
                    const newCategory = res.data;
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
                    categorySheet.expand();
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
                />

                {/* Selling Tax Rate Sheet */}
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

                {/* Selling Tax Option Sheet */}
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
                        if (val.id === 'without_tax' && !selectedHsnCode) {
                          setFieldValue('selectedTaxRate', null);
                          setFieldTouched('selectedTaxRate', false);
                          setFieldError('selectedTaxRate', undefined);
                        }
                      },
                    })
                  }
                />

                {/* Purchase Tax Option Sheet */}
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
                        if (val.id === 'without_tax' && !selectedHsnCode) {
                          setFieldValue('selectedPurchaseTaxRate', null);
                          setFieldTouched('selectedPurchaseTaxRate', false);
                          setFieldError('selectedPurchaseTaxRate', undefined);
                          setFieldValue('selectedTaxRate', null);
                          setFieldValue('selectedTaxOption', defaultTaxOption);
                        }
                      },
                    })
                  }
                />

                {/* Purchase Tax Rate Sheet */}
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
                      extra: ({ setFieldValue }, selectedRate) => {
                        if (!selectedHsnCode) {
                          setFieldValue('selectedTaxRate', selectedRate);
                          setFieldValue(
                            'selectedTaxOption',
                            selectedRate ? withTaxOption : defaultTaxOption,
                          );
                          setFieldValue(
                            'selectedPurchaseTaxOption',
                            selectedRate ? withTaxOption : defaultTaxOption,
                          );
                        }
                      },
                    })
                  }
                />

                {/* ✅ FIX: Selling Discount Type Sheet — converts value on type change like AddItem */}
                <DiscountTypeSelectorBottomSheet
                  ref={discountTypeSheet.bottomSheetRef}
                  selectedDiscountType={values.selectedDiscountType}
                  onDiscountTypeSelect={type => {
                    const currentInput = Number(values.discountPrice) || 0;
                    const salesPrice = Number(values.salesPrice) || 0;
                    let convertedInput = currentInput;

                    if (
                      type.id === 'percentage' &&
                      values.selectedDiscountType?.id === 'amount'
                    ) {
                      convertedInput =
                        salesPrice > 0
                          ? parseFloat(
                              ((currentInput / salesPrice) * 100).toFixed(2),
                            )
                          : 0;
                    } else if (
                      type.id === 'amount' &&
                      values.selectedDiscountType?.id === 'percentage'
                    ) {
                      convertedInput = parseFloat(
                        ((salesPrice * currentInput) / 100).toFixed(2),
                      );
                    }

                    setFieldValue('selectedDiscountType', type);
                    setFieldValue('discountType', type.id); // ✅ sync DB field
                    setFieldValue(
                      'discountPrice',
                      convertedInput > 0 ? String(convertedInput) : '',
                    );
                    setTimeout(() => {
                      setFieldTouched('selectedDiscountType', true);
                      setFieldError('selectedDiscountType', undefined);
                    }, 0);
                    discountTypeSheet.close();
                  }}
                />

                {/* ✅ FIX: Purchase Discount Type Sheet — converts value on type change like AddItem */}
                <DiscountTypeSelectorBottomSheet
                  ref={purchaseDiscountTypeSheet.bottomSheetRef}
                  selectedDiscountType={values.selectedPurchaseDiscountType}
                  onDiscountTypeSelect={type => {
                    const currentInput = Number(values.purchaseDiscount) || 0;
                    const purchasePrice = Number(values.purchasePrice) || 0;
                    let convertedInput = currentInput;

                    if (
                      type.id === 'percentage' &&
                      values.selectedPurchaseDiscountType?.id === 'amount'
                    ) {
                      convertedInput =
                        purchasePrice > 0
                          ? parseFloat(
                              ((currentInput / purchasePrice) * 100).toFixed(2),
                            )
                          : 0;
                    } else if (
                      type.id === 'amount' &&
                      values.selectedPurchaseDiscountType?.id === 'percentage'
                    ) {
                      convertedInput = parseFloat(
                        ((purchasePrice * currentInput) / 100).toFixed(2),
                      );
                    }

                    setFieldValue('selectedPurchaseDiscountType', type);
                    setFieldValue('purchaseDiscountType', type.id); // ✅ sync DB field
                    setFieldValue(
                      'purchaseDiscount',
                      convertedInput > 0 ? String(convertedInput) : '',
                    );
                    setTimeout(() => {
                      setFieldTouched('selectedPurchaseDiscountType', true);
                      setFieldError('selectedPurchaseDiscountType', undefined);
                    }, 0);
                    purchaseDiscountTypeSheet.close();
                  }}
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
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 20 },
  content: { paddingHorizontal: 20 },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', marginLeft: 8 },
  divider: { marginBottom: 8, height: 1 },
  inputContainer: { position: 'relative', marginBottom: 8 },
  input: { marginBottom: 8, backgroundColor: 'transparent' },
  inputDisabled: { opacity: 0.6 },
  inputContent: { fontSize: 16 },
  salesPriceSection: { marginTop: 8 },
  PurchasePriceSection: { marginTop: 8 },
  salesPriceInputContainer: { position: 'relative' },
  salesPriceInputContent: { fontSize: 16, paddingRight: 130 },
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
  discountPriceInputContainer: { position: 'relative' },
  discountPriceInputContent: { fontSize: 16, paddingRight: 130 },
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
  submitButtonLabel: { fontSize: 16, fontWeight: '600' },
  fieldError: {
    color: '#b00020',
    fontSize: 12,
    marginTop: -4,
    marginBottom: 8,
  },
});

export default AddPurchaseItem;
