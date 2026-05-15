import * as React from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  BackHandler,
  Vibration,
  Keyboard,
  useWindowDimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import {
  Text,
  useTheme,
  TextInput,
  Surface,
  Portal,
  ActivityIndicator,
  TouchableRipple,
  Icon,
  Switch,
  FAB,
  Button,
  Divider,
  Chip,
} from 'react-native-paper';
import { TextSkeleton } from '../../components/Skeletons';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Navbar from '../../components/Navbar';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useState, useEffect, useMemo } from 'react';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useAuth, permissions } from '../../context/AuthContext';
import api from '../../utils/api';
import Toast from 'react-native-toast-message';
import { FlatList, TouchableOpacity, Animated, Pressable } from 'react-native';
import debounce from 'lodash.debounce';
import { format, set, sub } from 'date-fns';
import CustomAlert from '../../components/CustomAlert';
import CustomerDetailBottomSheet from '../../components/BottomSheet/CustomerDetailsSheet';
import Sound from 'react-native-sound';
import BaseBottomSheet from '../../components/BottomSheet/BaseBottomSheet';
import DiscountBottomSheet from '../../components/BottomSheet/DiscountBottomSheet';
import { Dropdown } from 'react-native-element-dropdown';
import PaymentMethodBottomSheet from '../../components/BottomSheet/PaymentMethodBottomSheet';
import { BlurView } from '@react-native-community/blur';
import VendorDetailBottomSheet from '../../components/BottomSheet/VendorDetailsSheet';
import InvoiceItemCard from '../../components/InvoiceItemCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import InvoiceSummaryBox from '../../components/InvoiceSummaryBox';
import PurchaseInviceItemCard from '../../components/purchaseInviceItemCard';
import PurchaseSummaryBox from '../../components/purchaseSummaryBox';

import { generatePurchaseHTML } from '../../utils/purchaseTemplate';

Sound.setCategory('Ambient', true);
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const validationSchema = Yup.object().shape({
  gstin: Yup.string()
    .nullable()
    .test(
      'valid-gstin',
      'Invalid GSTIN format',
      value =>
        !value ||
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value),
    )
    .uppercase(),
  vendorName: Yup.string()
    .min(2, 'Party name must be at least 2 characters')
    .max(30, 'Party name must be less than 30 characters'),
  vendorNumber: Yup.string()
    .matches(/^[0-9+\-\s()]+$/, 'Invalid contact number format')
    .min(10, 'Contact number must be at least 10 digits'),
});

export default function Purchase() {
  const navigation = useNavigation();
  const route = useRoute();
  const formikRef = React.useRef(null);

  const isEditMode = route?.params?.mode === 'edit';
  const existingPurchase = route?.params?.purchaseData;

  useEffect(() => {
    setTimeout(() => {
      console.log('isEditMode', isEditMode);
      console.log('existingPurchase', existingPurchase);
    }, 2000);
  }, [isEditMode, existingPurchase]);

  const theme = useTheme();
  const {
    authState,
    updateAuthState,
    subscription,
    canCreateInvoice,
    fetchSubscription,
    hasPermission,
  } = useAuth();
  const storedata = authState?.user?.store;
  const [afterStoredata, setAfterStoredata] = useState({});
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    const checkPermission = () => {
      if (isEditMode) {
        if (!hasPermission(permissions.CAN_EDIT_PURCHASES)) {
          setPermissionDenied(true);
          setAlertConfig({
            visible: true,
            title: 'Permission Denied',
            message: 'You do not have permission to edit purchases.',
            actions: [{ label: 'Go Back', onPress: () => navigation.goBack() }],
            type: 'error',
          });
        }
      } else {
        if (!hasPermission(permissions.CAN_CREATE_PURCHASES)) {
          setPermissionDenied(true);
          setAlertConfig({
            visible: true,
            title: 'Permission Denied',
            message: 'You do not have permission to create purchases.',
            actions: [{ label: 'Go Back', onPress: () => navigation.goBack() }],
            type: 'error',
          });
        }
      }
    };

    checkPermission();
  }, [isEditMode, hasPermission, navigation]);

  const [vendors, setVendors] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);

  const discountSheetRef = React.useRef(null);
  const [discount, setDiscount] = useState({ type: 'flat', value: 0 });

  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [mobileQuery, setMobileQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [invoiceLoaded, setInvoiceLoaded] = useState(!isEditMode);
  const [nextInvoiceNo, setNextInvoiceNo] = useState(null);
  const [nextPurchaseNo, setNextPurchaseNo] = useState(null);
  const [purchaseDate, setPurchaseDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isEditingPurchaseNo, setIsEditingPurchaseNo] = useState(true);
  const [manualPurchaseNo, setManualPurchaseNo] = useState('');
  const [loadingPurchaseNo, setLoadingPurchaseNo] = useState(false);

  const [isMobileFocused, setIsMobileFocused] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);

  const insets = useSafeAreaInsets();
  const windowDims = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const paymentSheetRef = React.useRef(null);

  const [paidAmount, setPaidAmount] = React.useState(0);
  const [paidAmountText, setPaidAmountText] = React.useState('');

  const hasUserEditedPaid = React.useRef(false);

  const webViewRef = React.useRef(null);
  const [zoomLevel, setZoomLevel] = React.useState(1);

  const smoothZoom = newZoom => {
    webViewRef.current?.injectJavaScript(`
    (function() {
      document.body.style.transformOrigin = '0 0';
      document.body.style.transition = 'transform 0.3s ease-out';
      document.body.style.transform = 'scale(${newZoom})';
    })();
    true;
  `);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 0.2, 3);
    setZoomLevel(newZoom);
    smoothZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 0.2, 1);
    setZoomLevel(newZoom);
    smoothZoom(newZoom);
  };

  const paymentMethodOptions = [
    { label: 'Cash', value: 'cash', icon: 'cash' },
    { label: 'UPI', value: 'upi', icon: 'qrcode-scan' },
    { label: 'Card', value: 'card', icon: 'credit-card' },
    { label: 'Bank Transfer', value: 'bank_transfer', icon: 'bank' },
    { label: 'Cheque', value: 'cheque', icon: 'checkbook' },
  ];

  React.useEffect(() => {
    if (!hasUserEditedPaid.current) {
      if (paidAmount === 0) {
        setPaidAmountText('');
      } else {
        setPaidAmountText(parseFloat(paidAmount.toFixed(2)).toString());
      }
    }
  }, [paidAmount]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', e => {
      setKeyboardHeight(e.endCoordinates ? e.endCoordinates.height : 0);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const computeFabBottom = offset =>
    keyboardHeight
      ? keyboardHeight + insets.bottom + offset
      : insets.bottom + offset;

  const pencilOffset = Math.round(windowDims.height * 0.005);
  const discountOffset = Math.round(windowDims.height * 0.065);
  const fabRight = Math.max(12, Math.round(windowDims.width * 0.03));

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownAnim = React.useRef(new Animated.Value(0)).current;
  const [inputLayout, setInputLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const mobileInputRef = React.useRef(null);
  const nameInputRef = React.useRef(null);

  const customerSheetRef = React.useRef(null);

  const handleCustomerSave = data => {
    setSelectedCustomer(data);
    setMobileQuery(data.mobile || '');
    setNameQuery(data.name || '');
    formikRef.current?.setValues({
      ...formikRef.current?.values,
      vendorName: data.name || '',
      vendorNumber: data.mobile || '',
      gstNumber: data.gstNumber || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      country: data.country || '',
      postalCode: data.postalCode || '',
    });
  };

  const shouldShowBackAlert = () => {
    const fv = formikRef.current?.values || {};
    const hasCustomerInfo =
      fv.vendorName?.trim()?.length > 0 ||
      fv.vendorNumber?.trim()?.length > 0 ||
      fv.address?.trim()?.length > 0 ||
      fv.gstNumber?.trim()?.length > 0;

    return invoiceLoaded || hasCustomerInfo;
  };

  const [cartItems, setCartItems] = useState([]);

  const [showPreview, setShowPreview] = useState(false);
  const [invoiceKind, setInvoiceKind] = useState(
    storedata?.gstNumber ? 'gst' : 'non-gst',
  );
  const vendorHasGst = !!(
    formikRef.current?.values?.gstNumber || selectedCustomer?.gstNumber
  );

  const isGstInvoice = vendorHasGst ? invoiceKind === 'gst' : false;

  const initialValues = useMemo(
    () =>
      isEditMode && existingPurchase
        ? {
            vendorName: existingPurchase.vendorName || '',
            vendorNumber: existingPurchase.vendorMobile || '',
            gstNumber: existingPurchase.vendorGstNumber || '',
            address: existingPurchase.vendorAddress || '',
            city: existingPurchase.vendorCity || '',
            state: existingPurchase.vendorState || '',
            country: 'India',
            postalCode: existingPurchase.vendorPostalCode || '',
            purchaseNumber: existingPurchase.invoiceNumber,
          }
        : {
            vendorName: '',
            vendorNumber: '',
            gstNumber: '',
            address: '',
            city: '',
            state: '',
            country: 'India',
            postalCode: '',
            purchaseNumber: '',
          },
    [isEditMode, existingPurchase],
  );

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    actions: [],
  });

  const showAlert = (title, message, actions = [], type = 'info') => {
    setAlertConfig({
      visible: true,
      title,
      message,
      actions,
      type,
    });
  };

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (
          invoiceLoaded &&
          showPreview &&
          (invoiceCalculations.computedItems || cartItems).length > 0
        ) {
          showAlert(
            'Cancel',
            'Are you sure you want to cancel? All changes will be lost.',
            [
              {
                label: 'No',
                mode: 'text',
                onPress: () =>
                  setAlertConfig(prev => ({ ...prev, visible: false })),
              },
              {
                label: 'Yes',
                mode: 'contained',
                color: theme.colors.error,
                onPress: () => navigation.goBack(),
              },
            ],
            'warning',
          );

          return true;
        } else {
          navigation.goBack();
          return true;
        }
      };
      const sub = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );
      return () => sub.remove();
    }, [invoiceLoaded, showPreview, cartItems, navigation, theme.colors.error]),
  );

  useFocusEffect(
    React.useCallback(() => {
      const onFocus = async () => {
        await fetchSubscription();
      };

      onFocus();
      if (isEditMode) {
        setLoadingPurchaseNo(true);

        setTimeout(() => {
          setLoadingPurchaseNo(false);
        }, 600);
      }
      fetchStoreSnapshotForPreview();
      fetchCustomers();

      return () => {};
    }, [isEditMode]),
  );

  const fetchStoreSnapshotForPreview = async () => {
    try {
      const res = await api.get('/invoice/last');
      if (res?.success && res?.data) {
        setAfterStoredata({
          address: res.data?.address,
          bankDetails: res.data?.bankDetails,
          name: res.data?.name,
          settings: res.data?.settings,
          contactNo: res.data?.contactNo,
          logoUrl: res.data?.logoUrl,
          gstNumber: res.data?.gstNumber,
          signatureUrl: res.data?.signatureUrl,
        });
      }
    } catch {
      // Preview falls back to auth `storedata`
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const res = await api.get('/vendor?limit=20000');
      if (res.success && res.data.docs) {
        setVendors(res.data.docs);
        setFilteredCustomers(res.data.docs);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load vendors',
      });
    } finally {
      setLoadingCustomers(false);
    }
  };

  function getFinancialYear(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    if (month >= 4) {
      return `${String(year).slice(-2)}${String(year + 1).slice(-2)}`;
    } else {
      return `${String(year - 1).slice(-2)}${String(year).slice(-2)}`;
    }
  }

  async function getNextPurchaseNumber() {
    try {
      const key = 'LAST_PURCHASE_NUMBER';
      let last = await AsyncStorage.getItem(key);

      if (!last) {
        const base = `PUR-${Date.now()}-1`;
        await AsyncStorage.setItem(key, base);
        return base;
      }

      const parts = last.split('-');
      const prefix = parts[0];
      const timestamp = parts[1];
      let count = parseInt(parts[2], 10);

      count++;

      const newNum = `${prefix}-${timestamp}-${count}`;
      await AsyncStorage.setItem(key, newNum);

      return newNum;
    } catch (e) {
      return `PUR-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    }
  }

  const debouncedSearch = useMemo(
    () =>
      debounce((mobileQ, nameQ) => {
        const m = (mobileQ || '').trim();
        const n = (nameQ || '').trim().toLowerCase();

        if (!m && !n) {
          setFilteredCustomers(vendors);
          return;
        }

        setFilteredCustomers(
          vendors.filter(c => {
            const nameMatch = n
              ? (c.name || '').toLowerCase().includes(n)
              : true;
            const mobileMatch = m
              ? (c.mobile || '').includes(m) ||
                (c.mobile || '')
                  .replace(/\D/g, '')
                  .includes(m.replace(/\D/g, ''))
              : true;
            if (n && m) return nameMatch && mobileMatch;
            if (n) return nameMatch;
            return mobileMatch;
          }),
        );
      }, 200),
    [vendors],
  );

  const handleMobileChange = text => {
    setMobileQuery(text);
    formikRef.current?.setFieldValue?.('vendorNumber', text);
    if (selectedCustomer && text !== selectedCustomer.mobile) {
      setSelectedCustomer(null);
    }
    debouncedSearch(text, nameQuery);
  };

  const handleNameChange = text => {
    setNameQuery(text);
    formikRef.current?.setFieldValue?.('vendorName', text);
    if (selectedCustomer && text !== selectedCustomer.name) {
      setSelectedCustomer(null);
    }
    debouncedSearch(mobileQuery, text);
  };

  const clearCustomerInputs = () => {
    setMobileQuery('');
    setNameQuery('');
    formikRef.current?.setFieldValue?.('vendorNumber', '');
    formikRef.current?.setFieldValue?.('vendorName', '');
    setSelectedCustomer(null);
    setFilteredCustomers(vendors);

    setPaidAmount(invoiceCalculations?.netTotal || 0);
    hasUserEditedPaid.current = false;
  };

  const handleAnyInputFocus = input => {
    if (input === 'mobile') setIsMobileFocused(true);
    if (input === 'name') setIsNameFocused(true);

    if (!showDropdown) {
      setShowDropdown(true);
      Animated.timing(dropdownAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleAnyInputBlur = input => {
    if (input === 'mobile') setIsMobileFocused(false);
    if (input === 'name') setIsNameFocused(false);

    setTimeout(() => {
      if (!isMobileFocused && !isNameFocused) {
        setShowDropdown(false);
        Animated.timing(dropdownAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }, 200);
  };

  const closeDropdown = React.useCallback(() => {
    setShowDropdown(false);
    mobileInputRef.current?.blur();
    nameInputRef.current?.blur();
    Animated.timing(dropdownAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  const renderGstSwitch = (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text variant="labelSmall" style={{ marginRight: 6 }}>
        {isGstInvoice ? 'GST' : 'Non-GST'}
      </Text>
      <Switch
        value={isGstInvoice}
        onValueChange={val => {
          if (storedata?.gstNumber) {
            setInvoiceKind(val ? 'gst' : 'non-gst');
          }
        }}
        disabled={!storedata?.gstNumber}
        thumbColor={isGstInvoice ? theme.colors.primary : theme.colors.outline}
        trackColor={{
          true: theme.colors.primary + '60',
          false: theme.colors.outline + '40',
        }}
      />
    </View>
  );

  const renderCustomerItem = React.useCallback(
    ({ item }, setFieldValue) => (
      <TouchableRipple
        onPress={() => {
          setSelectedCustomer(item);
          setMobileQuery(item.mobile || '');
          setNameQuery(item.name || '');
          setFieldValue('vendorNumber', item.mobile);
          setFieldValue('vendorName', item.name);
          setFieldValue('gstNumber', item.gstNumber || '');
          setFieldValue('address', item.address || '');
          setFieldValue('city', item.city || '');
          setFieldValue('state', item.state || '');
          setFieldValue('country', item.country || '');
          setFieldValue('postalCode', item.postalCode || '');
          closeDropdown();
        }}
        style={styles.dropdownItemMain}
        rippleColor={theme.colors.primary + '20'}
        borderless
      >
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <View style={styles.dropdownItemContent}>
            <View style={styles.iconContainer}>
              <TextInput.Icon
                icon="account-circle"
                size={28}
                color={theme.colors.primary}
              />
            </View>

            <View style={styles.customerInfo}>
              {item.name && (
                <Text variant="titleMedium" style={styles.customerName}>
                  {item.name}
                </Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon source={'phone'} size={12} />
                <Text variant="bodyMedium" style={styles.customerMobile}>
                  {item.mobile}
                </Text>
              </View>
            </View>
          </View>
          {!!item.address && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon source={'map-marker'} size={16} />
              <Text
                variant="bodySmall"
                style={styles.customerAddress}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.address}
              </Text>
            </View>
          )}
        </View>
      </TouchableRipple>
    ),
    [theme.colors],
  );

  useEffect(() => {
    if (isEditMode && existingPurchase?.invoiceNumber) {
      setManualPurchaseNo(existingPurchase.invoiceNumber);
      setIsEditingPurchaseNo(true);
    }
  }, [isEditMode, existingPurchase]);

  useEffect(() => {
    const loadInvoiceDetails = async () => {
      if (isEditMode && existingPurchase?._id) {
        try {
          const res = await api.get(`/purchase/id/${existingPurchase._id}`);

          console.log('Fetched purchase details:', res);
          if (res?.success && res?.data) {
            const fullInvoice = res.data;

            const normalizedItems = (fullInvoice.items || []).map(item => ({
              ...item,
              costPrice: Number(item.costPrice ?? item.rate ?? item.price ?? 0),
              purchaseDiscount: Number(
                item.purchaseDiscount ?? item.discount ?? 0,
              ),
              price: Number(item.costPrice ?? item.rate ?? item.price ?? 0), // ✅ ADD
              sellingPrice: Number(item.sellingPrice ?? 0), // ✅ ADD
              productOriginalPrice: Number(item.sellingPrice ?? 0),
              purchaseGstRate: Number(
                item.purchaseGstRate ?? item.gstRate ?? 0,
              ),
              isPurchaseTaxInclusive: Boolean(
                item.isPurchaseTaxInclusive ?? item.isTaxInclusive ?? false,
              ),
              qty: Number(item.quantity ?? item.qty ?? 0),
              gstRate: Number(item.purchaseGstRate ?? item.gstRate ?? 0),
              isTaxInclusive: Boolean(
                item.isPurchaseTaxInclusive ?? item.isTaxInclusive ?? false,
              ),
              discount: Number(item.purchaseDiscount ?? item.discount ?? 0),
              hsn: item.hsn ?? '',
              unit: item.unit ?? 'Piece',
              total: Number(item.total ?? 0),
              _id: item._id || item.product,
              sellDiscount: Number(
                item.sellDiscount ?? item.sellingDiscount ?? 0,
              ),
              sellDiscountType: item.sellDiscountType || 'amount',
              sellDiscountPercent: Number(item.sellDiscountPercent ?? 0),
              productId: item.product,
            }));

            setCartItems(normalizedItems);
            setShowPreview(true);
            setSelectedCustomer({
              name: fullInvoice.vendorName,
              mobile: fullInvoice.vendorMobile,
              address: fullInvoice.vendorAddress,
              gstNumber: fullInvoice.vendorGstNumber || '',
            });

            setPurchaseDate(new Date(fullInvoice.date));
            const loadedPaid = parseFloat(
              Number(fullInvoice.amountPaid ?? 0).toFixed(2),
            );
            setPaidAmount(loadedPaid);
            setPaidAmountText(loadedPaid === 0 ? '' : loadedPaid.toFixed(2));
            setPaymentMethod(fullInvoice.paymentMethod || 'cash');
            setPaymentNote(fullInvoice.paymentNote || '');
            if (fullInvoice.discountTotal && fullInvoice.discountTotal > 0) {
              setDiscount({
                type: 'flat',
                value: Number(fullInvoice.discountTotal),
              });
            }
            hasUserEditedPaid.current = true;

            setInvoiceLoaded(true);
          } else {
            console.warn('Invoice fetch failed or empty data');
          }
        } catch (err) {
          console.error('Failed to fetch invoice details:', err);
        }
      }
    };

    loadInvoiceDetails();
  }, [isEditMode, existingPurchase]);

  React.useEffect(() => {
    const gt = parseFloat(
      Number(
        invoiceCalculations?.roundedTotal ?? invoiceCalculations?.netTotal ?? 0,
      ).toFixed(2),
    );
    if (!hasUserEditedPaid.current) {
      setPaidAmount(gt);
      setPaidAmountText(gt === 0 ? '' : gt.toFixed(2));
    }
  }, [
    invoiceCalculations?.netTotalExclusiveOnly,
    invoiceCalculations?.netTotal,
    invoiceCalculations?.roundedTotal,
    discount,
  ]);

  const now = new Date();
  const invoiceDate = now;

  const customerGstFinal =
    customerData?.gstNumber || selectedCustomer?.gstNumber;
  const customerStateFinal = customerData?.state || selectedCustomer?.state;

  const isIgst = determineGstType(
    storedata?.gstNumber,
    customerGstFinal,
    storedata?.address?.state,
    customerStateFinal,
  );

  const invoiceCalculations = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    const gstBreakdown = {};

    const computedItems = (cartItems || []).map(item => {
      const qty = Number(item.qty ?? item.quantity ?? 0);

      const rawCostPrice = Number(item.costPrice ?? item.price ?? 0);
      const purchaseDiscount = Number(item.purchaseDiscount ?? 0);
      const netRate = Math.max(0, rawCostPrice - purchaseDiscount);
      const mrp = item.mrp;
      const sellingDiscount = Number(item.sellDiscount ?? 0);
      const gstRate = Number(item.purchaseGstRate || 0);
      const isPurchaseTaxInclusive = Boolean(item.isPurchaseTaxInclusive);
      const isTaxInclusive = Boolean(item.isTaxInclusive);

      let baseRate = 0;
      let taxableValue = 0;
      let gstAmount = 0;
      let totalAmount = 0;

      if (isTaxInclusive) {
        baseRate = gstRate > 0 ? netRate / (1 + gstRate / 100) : netRate;
        taxableValue = baseRate * qty;
        gstAmount = taxableValue * (gstRate / 100);
        totalAmount = netRate * qty;
      } else {
        baseRate = netRate;
        taxableValue = netRate * qty;
        gstAmount = taxableValue * (gstRate / 100);
        totalAmount = taxableValue + gstAmount;
      }

      subtotal += taxableValue;
      totalTax += gstAmount;

      if (isGstInvoice && gstRate > 0) {
        const cgstAmount = isIgst ? 0 : gstAmount / 2;
        const sgstAmount = isIgst ? 0 : gstAmount / 2;
        const igstAmount = isIgst ? gstAmount : 0;

        if (!gstBreakdown[gstRate]) {
          gstBreakdown[gstRate] = {
            taxableAmount: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            totalGst: 0,
          };
        }
        gstBreakdown[gstRate].taxableAmount += taxableValue;
        gstBreakdown[gstRate].cgstAmount += cgstAmount;
        gstBreakdown[gstRate].sgstAmount += sgstAmount;
        gstBreakdown[gstRate].igstAmount += igstAmount;
        gstBreakdown[gstRate].totalGst += gstAmount;
      }

      return {
        ...item,
        price: rawCostPrice,
        costPrice: rawCostPrice,
        purchaseDiscount,
        sellingDiscount,
        gstRate,
        isTaxInclusive,
        isPurchaseTaxInclusive: isPurchaseTaxInclusive,
        baseRate,
        taxableValue,
        gstAmount,
        qty,
        total: Number(totalAmount.toFixed(4)),
        mrp,
        previousQty: item.previousQty ?? qty,
        product: item.product || item.productId,
      };
    });

    const grandTotalRaw = subtotal + totalTax;

    const invoiceDiscountTotal = (() => {
      if (discount?.type === 'flat') {
        return Number(discount?.value || 0);
      }
      if (discount?.type === 'percent') {
        return grandTotalRaw * (Number(discount?.value || 0) / 100);
      }
      return 0;
    })();

    const netTotal = grandTotalRaw - invoiceDiscountTotal;
    const roundedTotal = Math.round(netTotal);
    const roundOff = Number((roundedTotal - netTotal).toFixed(2));
    const netTotalExclusiveOnly = netTotal;

    const totalQuantity = computedItems.reduce(
      (sum, it) => sum + (it.qty || 0),
      0,
    );

    return {
      subtotal,
      netTotal,
      netTotalExclusiveOnly,
      roundOff,
      totalTax,
      grandTotal: grandTotalRaw,
      roundedTotal,
      grandTotalRaw,
      discountTotal: Number(invoiceDiscountTotal.toFixed(2)),
      totalQuantity,
      itemCount: computedItems.length,
      gstBreakdown: isGstInvoice ? gstBreakdown : {},
      computedItems,
    };
  }, [cartItems, isGstInvoice, vendorHasGst, discount, isIgst]);

  React.useEffect(() => {
    const gt = parseFloat(
      Number(
        invoiceCalculations?.roundedTotal ?? invoiceCalculations?.netTotal ?? 0,
      ).toFixed(2),
    );
    if (!hasUserEditedPaid.current) {
      setPaidAmount(gt);
      setPaidAmountText(gt === 0 ? '' : gt.toFixed(2));
    }
  }, [cartItems]);

  const payment = React.useMemo(() => {
    const grandTotal = Number(
      invoiceCalculations?.roundedTotal ?? invoiceCalculations?.netTotal ?? 0,
    );

    const paid = Math.max(0, Number.isFinite(paidAmount) ? paidAmount : 0);
    const normPaid = Math.min(paid, grandTotal);
    const due = Math.max(0, grandTotal - normPaid);

    let status = 'unpaid';
    if (normPaid === 0 && grandTotal > 0) status = 'unpaid';
    else if (due === 0 && grandTotal > 0) status = 'paid';
    else if (normPaid > 0 && normPaid < grandTotal) status = 'partial';

    return { grandTotal, paid: normPaid, due, status };
  }, [
    invoiceCalculations?.netTotalExclusiveOnly,
    invoiceCalculations?.netTotal,
    paidAmount,
  ]);

  const getStatusStyle = (status, theme) => {
    switch (status) {
      case 'paid':
        return {
          bg: theme.colors.primary,
          fg: theme.colors.onPrimary,
          label: 'Paid',
        };
      case 'partial':
        return {
          bg: theme.colors.tertiary ?? theme.colors.secondary,
          fg: theme.colors.onTertiary ?? theme.colors.onSecondary,
          label: 'Partially Paid',
        };
      default:
        return {
          bg: theme.colors.errorContainer ?? '#FFE5E5',
          fg: theme.colors.error ?? '#B00020',
          label: 'Unpaid',
        };
    }
  };

  const handleSubmit = async (values, formikHelpers) => {
    formikHelpers.setSubmitting(true);

    try {
      await createPurchase(
        {
          ...values,
        },
        formikHelpers,
      );
    } catch (error) {
      console.error('❌ Error preparing purchase:', error);
      showAlert(
        'Error',
        'Failed to prepare purchase number. Please try again.',
      );
      formikHelpers.setSubmitting(false);
    }
  };

  function determineGstType(storeGst, customerGst, storeState, customerState) {
    const extractStateCode = gst => gst?.substring(0, 2);

    let isIgst = false;

    if (storeGst && customerGst) {
      const storeCode = extractStateCode(storeGst);
      const customerCode = extractStateCode(customerGst);
      if (storeCode && customerCode && storeCode !== customerCode) {
        isIgst = true;
      }
    } else if (storeState && customerState) {
      if (
        storeState.trim().toLowerCase() !== customerState.trim().toLowerCase()
      ) {
        isIgst = true;
      }
    }

    return isIgst;
  }

  const createPurchase = async (values, { setSubmitting, resetForm }) => {
    console.log('====>purcsj', values);

    if (cartItems.length === 0) {
      showAlert('Error', 'Please add items to the purchase');
      setSubmitting(false);
      return;
    }

    if (!manualPurchaseNo.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Purchase Number Required',
        text2: 'Please enter the purchase invoice number.',
      });
      setSubmitting(false);
      return;
    }

    if (!values.vendorNumber || values.vendorNumber.trim().length < 10) {
      Toast.show({
        type: 'error',
        text1: 'Vendor Mobile Required',
        text2: 'Please enter a valid vendor mobile number.',
      });
      setSubmitting(false);
      return;
    }

    if (!values.vendorName || values.vendorName.trim().length < 2) {
      Toast.show({
        type: 'error',
        text1: 'Vendor Name Required',
        text2: 'Please enter vendor name.',
      });
      setSubmitting(false);
      return;
    }

    const paymentStatus =
      payment.paid === 0 && payment.grandTotal > 0
        ? 'unpaid'
        : payment.due === 0 && payment.grandTotal > 0
        ? 'paid'
        : 'partial';

    const vendorGstFinal = values?.gstNumber || selectedCustomer?.gstNumber;
    const vendorStateFinal = values?.state || selectedCustomer?.state;

    const isIgst = determineGstType(
      storedata?.gstNumber,
      vendorGstFinal,
      storedata?.address?.state,
      vendorStateFinal,
    );

    const purchaseData = {
      vendor: isEditMode
        ? existingPurchase?.vendor
        : selectedCustomer?._id || null,
      vendorName: values.vendorName,
      vendorMobile: values.vendorNumber,
      vendorAddress: values.address || '',
      vendorCity: values.city || '',
      vendorState: values.state || '',
      vendorPostalCode: values.postalCode || '',
      vendorGstNumber: values.gstNumber || '',
      vendorPanNumber: values.panNumber || '',

      invoiceNumber: manualPurchaseNo.trim(),

      date: format(purchaseDate, 'yyyy-MM-dd'),

      items: invoiceCalculations.computedItems.map(item => ({
        product: item.product,
        name: item.name,
        hsn: item.hsn || '',
        unit: item.unit || 'Piece',
        mrp: Number(item.mrp ?? 0),

        rate: Number(item.costPrice ?? item.price ?? 0),
        costPrice: Number(item.costPrice ?? item.price ?? 0),

        sellingPrice: Number(item.sellingPrice ?? item.price ?? 0),
        previousQuantity: Number(item.previousQty ?? item.qty ?? 0),
        sellingDiscount: Number(item.sellingDiscount ?? 0),
        discount: Number(item.purchaseDiscount ?? 0),
        sellingDiscount: Number(item.sellingDiscount ?? 0),

        gstRate: Number(item.gstRate ?? 0),
        //GstRate: Number(item.gstRate ?? 0),
        // purchaseGstRate: Number(item.gstRate ?? 0),
        isPurchaseTaxInclusive: Boolean(item.isPurchaseTaxInclusive),
        isTaxInclusive: Boolean(item.isTaxInclusive),

        quantity: Number(item.qty ?? 0),

        baseRate: Number(item.baseRate ?? 0),
        taxableValue: Number(item.taxableValue ?? 0),
        gstAmount: Number(item.gstAmount ?? 0),

        total: Number(item.total ?? 0),
      })),

      subTotal: Number(invoiceCalculations.subtotal.toFixed(2)),

      gstTotal: Number(invoiceCalculations.totalTax.toFixed(2)),
      isIgst: isIgst,

      discountTotal: Number(invoiceCalculations.discountTotal.toFixed(2)),
      roundOff: Number(invoiceCalculations.roundOff),

      grandTotal: Number(
        (
          invoiceCalculations.roundedTotal ?? invoiceCalculations.netTotal
        ).toFixed(2),
      ),

      paymentStatus,
      amountPaid: Number(payment.paid.toFixed(2)),
      amountDue: Number(payment.due.toFixed(2)),
      paymentMethod: paymentMethod,
      paymentNote: paymentNote || '',
    };

    try {
      let res;

      if (isEditMode && existingPurchase?._id) {
        console.log('Editing existing purchase:', existingPurchase._id);
        res = await api.put(
          `/purchase/id/${existingPurchase._id}`,
          purchaseData,
        );
      } else {
        res = await api.post('/purchase', purchaseData);
      }

      if (res?.success) {
        Toast.show({
          type: 'success',
          text1: isEditMode ? 'Purchase Updated!' : 'Purchase Created!',
          text2: `Purchase #${manualPurchaseNo} ${
            isEditMode ? 'updated' : 'created'
          } successfully.`,
        });

        navigation.replace('PurchaseDetail', {
          purchaseId: res.data._id,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Failed',
          text2: res?.message || 'Something went wrong',
        });
      }
    } catch (err) {
      console.error('Purchase save failed:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message,
      });
    }

    setSubmitting(false);
  };

  const handleCancel = () => {
    showAlert(
      'Cancel',
      'Are you sure you want to cancel? All changes will be lost.',
      [
        {
          label: 'No',
          mode: 'text',
          onPress: () => setAlertConfig({ ...alertConfig, visible: false }),
        },
        {
          label: 'Yes',
          mode: 'contained',
          color: theme.colors.error,
          onPress: () => navigation?.goBack(),
        },
      ],
      'warning',
    );
  };

  const handleAddItems = () => {
    const preparedCart = (cartItems || []).map((item, index) => ({
      ...item,
      _id: item._id || item.productId || `${item.name}-${index}`,
      sellingPrice: item.price ?? item.sellingPrice ?? 0,
      qty: item.qty ?? item.quantity ?? 0,
      subtotal: item.total ?? item.subtotal ?? 0,
      previousQty: item.previousQty ?? item.qty ?? item.quantity ?? 0,
    }));
    navigation.push('AddPurchaseItems', {
      purchase: true,
      existingCart: preparedCart,
      onItemsSelected: newCart => {
        setCartItems(newCart);

        hasUserEditedPaid.current = false;
        setShowPreview(true);
      },
    });
  };

  const customerData = React.useMemo(
    () => ({
      name: formikRef.current?.values?.vendorName || '',
      mobile: formikRef.current?.values?.vendorNumber || '',
      address: formikRef.current?.values?.address || '',
      gstNumber: formikRef.current?.values?.gstNumber || '',
      city: formikRef.current?.values?.city || '',
      state: formikRef.current?.values?.state || '',
      country: formikRef.current?.values?.country || '',
      postalCode: formikRef.current?.values?.postalCode || '',
    }),
    [formikRef.current?.values],
  );

  // ─── Derived boolean: show the preview+footer layout ───────────────────────
  // ✅ FIX: single source of truth for whether to show the invoice preview area.
  //         Both create and edit mode use the same condition so layout is identical.
  const showInvoicePreview =
    invoiceLoaded &&
    showPreview &&
    (invoiceCalculations.computedItems?.length > 0 || cartItems.length > 0);

  console.log('cart item ---> ', cartItems);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Navbar
          title="Purchase Invoice"
          showBackButton={true}
          help="Billing"
          onBackPress={() => {
            if (showInvoicePreview) {
              showAlert(
                'Exit Purchase Invoice',
                'Are you sure you want to Exit? All changes will be lost.',
                [
                  {
                    label: 'No',
                    mode: 'text',
                    onPress: () =>
                      setAlertConfig({ ...alertConfig, visible: false }),
                  },
                  {
                    label: 'Yes',
                    mode: 'contained',
                    color: theme.colors.error,
                    onPress: () => navigation.goBack(),
                  },
                ],
                'warning',
              );
            } else {
              navigation.goBack();
            }
          }}
        />

        {/* --- PURCHASE HEADER BAR --- */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 8,
            marginHorizontal: 16,
            paddingVertical: 4,
            backgroundColor: theme.colors.surface,
            borderRadius: 10,
            elevation: 2,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <View>
            <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
              Purchase Number
            </Text>

            {isEditMode ? (
              loadingPurchaseNo ? (
                <TextSkeleton width={120} height={20} />
              ) : (
                <Text variant="titleSmall">
                  {'#'}
                  {existingPurchase.invoiceNumber || '0000'}
                </Text>
              )
            ) : isEditingPurchaseNo || manualPurchaseNo === '' ? (
              <TextInput
                value={manualPurchaseNo}
                onChangeText={setManualPurchaseNo}
                autoFocus={manualPurchaseNo === ''}
                placeholder="Enter purchase number"
                style={{
                  height: 28,
                  fontSize: 14,
                  fontWeight: '600',
                  paddingVertical: 0,
                  paddingHorizontal: 12,
                  borderBottomWidth: 0.4,
                  borderBottomColor: theme.colors.outlineVariant,
                  backgroundColor: theme.colors.background,
                  minWidth: 150,
                  maxWidth: 200,
                }}
                error={manualPurchaseNo === ''}
                maxLength={25}
                helperText={
                  manualPurchaseNo === '' ? 'Purchase number is required' : ''
                }
              />
            ) : (
              <TouchableOpacity onPress={() => setIsEditingPurchaseNo(true)}>
                <Text variant="titleSmall">
                  {'#'}
                  {manualPurchaseNo}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
              Date
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: theme.colors.primary + 10,
                paddingHorizontal: 8,
                borderRadius: 8,
              }}
              activeOpacity={0.8}
              onPress={() => setShowDatePicker(true)}
            >
              <Text variant="titleSmall">
                {format(purchaseDate, 'dd MMM yyyy')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            mode="date"
            display="calendar"
            value={purchaseDate}
            maximumDate={new Date()}
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                setPurchaseDate(selectedDate);
              }
            }}
          />
        )}

        <Formik
          innerRef={formikRef}
          initialValues={initialValues}
          enableReinitialize={true}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
        >
          {({
            values,
            errors,
            touched,
            handleChange,
            handleBlur,
            handleSubmit,
            isSubmitting,
            setFieldValue,
          }) => (
            // ✅ FIX: outer wrapper is always flex:1 column — same for both modes
            <View style={{ flex: 1, flexDirection: 'column' }}>
              {/* ── Vendor inputs (always visible at top) ── */}
              <View
                style={styles.inputRow}
                onLayout={e => {
                  const { x, y, width, height } = e.nativeEvent.layout;
                  setInputLayout({ x, y: y + height + 60, width, height });
                }}
              >
                <TextInput
                  ref={mobileInputRef}
                  label="Vendor Mobile"
                  value={
                    mobileQuery || formikRef.current?.values?.vendorNumber || ''
                  }
                  onChangeText={text => handleMobileChange(text)}
                  onFocus={() => handleAnyInputFocus('mobile')}
                  onBlur={() => handleAnyInputBlur('mobile')}
                  mode="outlined"
                  style={styles.input}
                  left={<TextInput.Icon icon="phone" size={20} />}
                  right={
                    mobileQuery || nameQuery ? (
                      <TextInput.Icon
                        icon="close"
                        onPress={clearCustomerInputs}
                      />
                    ) : null
                  }
                  placeholder="Search by mobile"
                  theme={{ roundness: 12 }}
                  autoComplete="tel"
                  maxLength={10}
                  keyboardType="phone-pad"
                  error={Boolean(
                    formikRef.current?.touched?.vendorNumber &&
                      formikRef.current?.errors?.vendorNumber,
                  )}
                />

                <TextInput
                  label="Vendor Name"
                  value={
                    nameQuery || formikRef.current?.values?.vendorName || ''
                  }
                  onChangeText={text => handleNameChange(text)}
                  onFocus={() => handleAnyInputFocus('name')}
                  onBlur={() => handleAnyInputBlur('name')}
                  mode="outlined"
                  style={[styles.input, {}]}
                  left={<TextInput.Icon icon="account" size={20} />}
                  right={
                    mobileQuery || nameQuery ? (
                      <TextInput.Icon
                        icon="close"
                        onPress={clearCustomerInputs}
                      />
                    ) : null
                  }
                  placeholder="Search by name"
                  theme={{ roundness: 12 }}
                  maxLength={30}
                  autoComplete="name"
                />
              </View>

              {/* Vendor search dropdown */}
              <Portal>
                {showDropdown && (
                  <View
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="box-none"
                  >
                    <Pressable
                      onPress={closeDropdown}
                      style={StyleSheet.absoluteFill}
                    />
                    <Animated.View
                      pointerEvents="auto"
                      style={[
                        styles.dropdown,
                        {
                          backgroundColor: theme.colors.surface,
                          top: inputLayout.y + 95,
                          left: inputLayout.x + 16,
                          width: inputLayout.width - 32,
                          opacity: dropdownAnim,
                          transform: [
                            {
                              translateY: dropdownAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-10, 0],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <Surface style={styles.dropdownSurface} elevation={8}>
                        {loadingCustomers ? (
                          <ActivityIndicator style={{ margin: 20 }} />
                        ) : filteredCustomers.length === 0 ? (
                          <Text style={{ padding: 16, textAlign: 'center' }}>
                            {nameQuery || mobileQuery
                              ? 'No vendors found'
                              : 'No vendors available'}
                          </Text>
                        ) : (
                          <FlatList
                            data={filteredCustomers}
                            keyExtractor={item => item._id}
                            renderItem={({ item }) =>
                              renderCustomerItem({ item }, setFieldValue)
                            }
                            keyboardShouldPersistTaps="handled"
                            maxToRenderPerBatch={8}
                            windowSize={8}
                            removeClippedSubviews={true}
                            showsVerticalScrollIndicator={false}
                            style={styles.dropdownList}
                            contentContainerStyle={{ paddingBottom: 8 }}
                          />
                        )}
                      </Surface>
                    </Animated.View>
                  </View>
                )}
              </Portal>

              {/* "Add More Vendor Details" link */}
              <View style={{ paddingHorizontal: 16 }}>
                {mobileQuery.trim() || nameQuery.trim() ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={!mobileQuery.trim() && !nameQuery.trim()}
                    onPress={() => {
                      const snapshot = {
                        name: values.vendorName || '',
                        mobile: values.vendorNumber || '',
                        address: values.address || '',
                        gstNumber: values.gstNumber || '',
                      };
                      setSelectedCustomer(snapshot);
                      setMobileQuery(snapshot.mobile);
                      customerSheetRef.current?.expand?.();
                    }}
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.primary + 20,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 4,
                      marginTop: 4,
                      paddingHorizontal: 16,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: theme.colors.primary }}>
                      Add More Vendor Details
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* ── PREVIEW area OR empty state ── */}
              {showInvoicePreview ? (
                // ✅ FIX: This wrapper is identical for both create and edit mode.
                //         flex:1 ensures WebView takes remaining space and the
                //         bottom Surface sits naturally below it — no overlap.
                <View style={styles.previewWrapper}>
                  {/* ── WebView card ── */}
                  <View
                    style={[
                      styles.previewContainer,
                      { backgroundColor: theme.colors.surface },
                    ]}
                  >
                    <WebView
                      ref={webViewRef}
                      showsVerticalScrollIndicator={false}
                      source={{
                        html: generatePurchaseHTML({
                          preview: true,
                          formValues: values,
                          cartItems: invoiceCalculations.computedItems?.length
                            ? invoiceCalculations.computedItems
                            : cartItems,
                          invoiceCalculations,
                          invoiceNumber: isEditMode
                            ? existingPurchase?.invoiceNumber
                            : manualPurchaseNo?.trim() || '—',
                          invoiceDate: isEditMode
                            ? new Date(
                                existingPurchase?.date ||
                                  existingPurchase?.invoiceDate ||
                                  purchaseDate,
                              )
                            : purchaseDate,
                          storedata:
                            Object.keys(afterStoredata).length > 0
                              ? afterStoredata
                              : storedata,
                          isGstInvoice,
                          payment: {
                            paid: payment.paid,
                            due: payment.due,
                            status: payment.status,
                          },
                        }),
                      }}
                      style={styles.webview}
                      scalesPageToFit={true}
                      startInLoadingState={true}
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      mixedContentMode="compatibility"
                      originWhitelist={['*']}
                      onError={syntheticEvent => {
                        const { nativeEvent } = syntheticEvent;
                        console.warn('WebView error: ', nativeEvent);
                      }}
                    />

                    {/* Zoom controls — absolutely positioned inside WebView card */}
                    <View
                      style={[
                        styles.zoomControls,
                        {
                          bottom: computeFabBottom(20),
                          left: 12,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        onPress={handleZoomIn}
                        activeOpacity={0.7}
                        style={[
                          styles.zoomButton,
                          { borderColor: theme.colors.primary },
                        ]}
                      >
                        <Icon
                          source="magnify-plus-outline"
                          size={24}
                          color={theme.colors.primary}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleZoomOut}
                        activeOpacity={0.7}
                        style={[
                          styles.zoomButton,
                          { borderColor: theme.colors.primary },
                        ]}
                      >
                        <Icon
                          source="magnify-minus-outline"
                          size={24}
                          color={theme.colors.primary}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* FABs — absolutely positioned inside WebView card */}
                    <FAB
                      size="small"
                      animated
                      icon="percent"
                      style={{
                        position: 'absolute',
                        bottom: computeFabBottom(discountOffset),
                        right: fabRight,
                        backgroundColor: theme.colors.secondary,
                        borderRadius: 30,
                      }}
                      color="white"
                      onPress={() => discountSheetRef.current?.present?.()}
                    />

                    <FAB
                      size="small"
                      animated
                      icon="pencil"
                      style={{
                        position: 'absolute',
                        bottom: computeFabBottom(pencilOffset),
                        right: fabRight,
                        backgroundColor: theme.colors.primary,
                        borderRadius: 30,
                      }}
                      color={theme.colors.onPrimary}
                      onPress={handleAddItems}
                    />
                  </View>

                  {/* ── Bottom payment / action Surface ── */}
                  {/* ✅ FIX: NOT absolutely positioned — sits in normal flow below
                              the flex:1 previewContainer so it never overlaps */}
                  <Surface
                    elevation={6}
                    style={[
                      styles.bottomSurface,
                      {
                        backgroundColor: theme.colors.surfaceVariant,
                        borderTopWidth: theme.dark
                          ? 0
                          : StyleSheet.hairlineWidth,
                        borderColor: theme.colors.outlineVariant,
                      },
                    ]}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <Text variant="labelSmall" style={{ lineHeight: 10 }}>
                          Amount
                        </Text>
                        {(() => {
                          const s = getStatusStyle(payment.status, theme);
                          return (
                            <View
                              style={{
                                backgroundColor: s.bg,
                                borderRadius: 10,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                minHeight: 14,
                                justifyContent: 'center',
                              }}
                            >
                              <Text
                                variant="labelSmall"
                                style={{ color: s.fg, lineHeight: 10 }}
                              >
                                {s.label}
                              </Text>
                            </View>
                          );
                        })()}
                      </View>

                      <TouchableRipple
                        onPress={() => paymentSheetRef.current?.expand?.()}
                        rippleColor={theme.colors.primary + '20'}
                        style={{
                          borderWidth: 1,
                          borderColor: theme.colors.outline,
                          borderRadius: 10,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          flexDirection: 'row',
                          alignItems: 'center',
                          alignSelf: 'flex-start',
                          backgroundColor: theme.colors.surface,
                          minHeight: 28,
                        }}
                      >
                        <View
                          style={{ flexDirection: 'row', alignItems: 'center' }}
                        >
                          <Icon
                            source={
                              paymentMethodOptions.find(
                                m => m.value === paymentMethod,
                              )?.icon || 'cash'
                            }
                            size={14}
                            color={theme.colors.onSurfaceVariant}
                          />
                          <Text
                            variant="labelSmall"
                            style={{
                              marginLeft: 6,
                              fontSize: 11,
                              color: theme.colors.onSurface,
                              fontWeight: '500',
                            }}
                          >
                            {paymentMethodOptions.find(
                              m => m.value === paymentMethod,
                            )?.label || 'Cash'}
                          </Text>
                          <Icon
                            source="chevron-down"
                            size={14}
                            color={theme.colors.onSurfaceVariant}
                          />
                        </View>
                      </TouchableRipple>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        gap: 8,
                        paddingBottom: 4,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <TouchableWithoutFeedback
                          onPress={() => {
                            if (
                              !isEditMode &&
                              !formikRef.current?.values?.vendorNumber?.trim()
                            ) {
                              Toast.show({
                                type: 'error',
                                text1: 'Customer Required',
                                text2:
                                  'Please add customer mobile number first',
                              });
                            }
                          }}
                        >
                          <View
                            pointerEvents={
                              !isEditMode &&
                              !Boolean(selectedCustomer) &&
                              !Boolean(
                                formikRef.current?.values?.vendorNumber?.trim()
                                  ?.length >= 10,
                              )
                                ? 'box-only'
                                : 'auto'
                            }
                          >
                            <TextInput
                              mode="outlined"
                              dense
                              left={<TextInput.Icon icon="currency-inr" />}
                              right={
                                !isEditMode &&
                                !Boolean(selectedCustomer) &&
                                !Boolean(
                                  formikRef.current?.values?.vendorNumber?.trim()
                                    ?.length >= 10,
                                ) ? (
                                  <TextInput.Icon
                                    icon="lock"
                                    size={16}
                                    color={theme.colors.onSurfaceDisabled}
                                  />
                                ) : null
                              }
                              value={paidAmountText}
                              onChangeText={txt => {
                                if (
                                  !isEditMode &&
                                  !Boolean(selectedCustomer) &&
                                  !Boolean(
                                    formikRef.current?.values?.vendorNumber?.trim()
                                      ?.length >= 10,
                                  )
                                ) {
                                  return;
                                }

                                const digits = txt.replace(/[^0-9.]/g, '');

                                const parts = digits.split('.');
                                let cleanValue =
                                  parts.length > 1
                                    ? parts[0] + '.' + parts[1].slice(0, 2)
                                    : parts[0];

                                if (cleanValue.startsWith('.')) {
                                  cleanValue = '0' + cleanValue;
                                }

                                setPaidAmountText(cleanValue);
                                hasUserEditedPaid.current = true;

                                if (cleanValue === '' || cleanValue === '0.') {
                                  setPaidAmount(0);
                                  return;
                                }

                                const numeric = parseFloat(cleanValue);
                                if (isNaN(numeric)) return;

                                const maxAmount = parseFloat(
                                  Number(
                                    invoiceCalculations?.roundedTotal ??
                                      invoiceCalculations?.netTotal ??
                                      0,
                                  ).toFixed(2),
                                );
                                const clamped = Math.min(
                                  Math.max(0, numeric),
                                  maxAmount,
                                );

                                setPaidAmount(clamped);

                                if (numeric > maxAmount) {
                                  setPaidAmountText(maxAmount.toFixed(2));
                                }
                              }}
                              onBlur={() => {
                                const maxAmount = parseFloat(
                                  Number(
                                    invoiceCalculations?.roundedTotal ??
                                      invoiceCalculations?.netTotal ??
                                      0,
                                  ).toFixed(2),
                                );

                                if (!paidAmount || paidAmount <= 0) {
                                  setPaidAmount(0);
                                  setPaidAmountText('');
                                  return;
                                }

                                const clamped = parseFloat(
                                  Math.min(paidAmount, maxAmount).toFixed(2),
                                );
                                setPaidAmount(clamped);
                                setPaidAmountText(String(clamped));
                              }}
                              editable={
                                isEditMode ||
                                Boolean(selectedCustomer) ||
                                Boolean(
                                  formikRef.current?.values?.vendorNumber?.trim()
                                    ?.length >= 10,
                                )
                              }
                              keyboardType="decimal-pad"
                              returnKeyType="done"
                              blurOnSubmit={true}
                              placeholder="0.00"
                              style={{
                                backgroundColor: theme.colors.surface,
                                height: 38,
                              }}
                              theme={{ roundness: 12 }}
                              contentStyle={{
                                fontSize: 13,
                                paddingVertical: 0,
                              }}
                            />
                          </View>
                        </TouchableWithoutFeedback>
                      </View>

                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          columnGap: 14,
                        }}
                      >
                        <Divider
                          bold
                          style={{
                            width: 1,
                            height: 32,
                            backgroundColor: theme.colors.outline,
                          }}
                        />
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text
                            variant="labelSmall"
                            style={{ opacity: 0.7, lineHeight: 12 }}
                          >
                            Net Total
                          </Text>
                          <Text variant="titleSmall" style={{ lineHeight: 18 }}>
                            ₹{payment.grandTotal.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {payment.due > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          justifyContent: 'flex-start',
                          paddingBottom: 4,
                          marginLeft: 4,
                        }}
                      >
                        <Icon
                          source="clock-outline"
                          size={16}
                          color={
                            payment.due > 0
                              ? theme.colors.error
                              : theme.colors.onSurfaceVariant
                          }
                        />
                        <Text
                          variant="labelSmall"
                          style={{ opacity: 0.7, lineHeight: 12 }}
                        >
                          Due -
                        </Text>
                        <Text
                          variant="titleSmall"
                          style={{
                            color:
                              payment.due > 0
                                ? theme.colors.error
                                : theme.colors.onSurface,
                            lineHeight: 18,
                          }}
                        >
                          ₹{payment.due.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.buttonContainer}>
                      <Button
                        mode="outlined"
                        onPress={handleCancel}
                        style={styles.cancelButton}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>

                      <Button
                        icon={'check'}
                        mode="contained"
                        onPress={handleSubmit}
                        style={styles.createButton}
                        loading={isSubmitting}
                        disabled={isSubmitting}
                        labelStyle={[
                          {
                            color:
                              isSubmitting || !selectedCustomer
                                ? theme.colors.onBackground
                                : theme.colors.onSurface,
                          },
                        ]}
                      >
                        {isEditMode ? 'Update Purchase' : 'Create Purchase'}
                      </Button>
                    </View>
                  </Surface>
                </View>
              ) : (
                /* ── Empty state: no items added yet ── */
                <View style={styles.emptyContainer}>
                  <Text variant="bodyMedium" style={styles.emptySubtitle}>
                    Start by adding items to your purchase invoice
                  </Text>

                  <Button
                    mode="contained"
                    onPress={handleAddItems}
                    style={styles.addItemsButton}
                    icon="plus-circle"
                  >
                    Add Items
                  </Button>
                </View>
              )}
            </View>
          )}
        </Formik>

        <CustomAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          actions={alertConfig.actions}
          onDismiss={() => setAlertConfig({ ...alertConfig, visible: false })}
        />
      </SafeAreaView>

      <DiscountBottomSheet
        ref={discountSheetRef}
        discount={discount}
        setDiscount={setDiscount}
        currentTotal={invoiceCalculations.grandTotalRaw || 0}
      />

      <VendorDetailBottomSheet
        ref={customerSheetRef}
        customerData={customerData}
        onSave={async data => {
          await handleCustomerSave(data);
          if (customerSheetRef.current) {
            if (typeof customerSheetRef.current.close === 'function') {
              customerSheetRef.current.close();
            } else if (typeof customerSheetRef.current.dismiss === 'function') {
              customerSheetRef.current.dismiss();
            }
          }
        }}
      />
      <PaymentMethodBottomSheet
        ref={paymentSheetRef}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        paymentNote={paymentNote}
        setPaymentNote={setPaymentNote}
        onDone={() => paymentSheetRef.current?.close?.()}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputSection: {
    margin: 8,
    padding: 12,
    elevation: 2,
  },
  inputRow: {
    paddingHorizontal: 16,
  },
  input: {
    marginTop: 4,
    height: 42,
  },
  dropdown: {
    position: 'absolute',
    zIndex: 1000,
    elevation: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    maxHeight: Math.min(screenHeight * 0.35, 300),
  },
  dropdownSurface: { borderRadius: 12, overflow: 'hidden' },
  dropdownItemMain: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerInfo: {
    marginHorizontal: 12,
  },
  customerName: {},
  customerMobile: {
    color: '#444',
    marginLeft: 4,
  },
  customerAddress: {
    color: '#777',
    marginLeft: 4,
    fontStyle: 'italic',
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownList: {
    maxHeight: Math.min(screenHeight * 0.35, 260),
  },
  errorText: {
    fontSize: 12,
    textAlign: 'left',
  },

  // ✅ FIX: previewWrapper is the flex:1 column container that holds
  //         previewContainer + bottomSurface in normal document flow.
  //         This is what was missing in create mode — causing overlap.
  previewWrapper: {
    flex: 1,
    flexDirection: 'column',
  },

  previewContainer: {
    flex: 1, // ✅ takes ALL remaining space above the bottom Surface
    margin: 8,
    elevation: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'white',
  },

  // ✅ FIX: bottomSurface is in normal flow — NOT position:absolute.
  //         It naturally sits below the flex:1 previewContainer.
  bottomSurface: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },

  footer: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
  },
  createButton: {
    flex: 2,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptySubtitle: {
    marginBottom: 32,
    textAlign: 'center',
    color: '#666',
  },
  addItemsButton: {
    paddingHorizontal: 32,
  },
  magnifierButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomControls: {
    position: 'absolute',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 10,
  },
  zoomButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
