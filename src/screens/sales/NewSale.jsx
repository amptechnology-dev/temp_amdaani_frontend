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
import { generateInvoiceHTML } from '../../utils/invoiceTemplate';
import api from '../../utils/api';
import Toast from 'react-native-toast-message';
import { FlatList, TouchableOpacity, Animated, Pressable } from 'react-native';
import debounce from 'lodash.debounce';
import { format, sub } from 'date-fns';
import CustomAlert from '../../components/CustomAlert';
import CustomerDetailBottomSheet from '../../components/BottomSheet/CustomerDetailsSheet';
import Sound from 'react-native-sound';
import BaseBottomSheet from '../../components/BottomSheet/BaseBottomSheet';
import DiscountBottomSheet from '../../components/BottomSheet/DiscountBottomSheet';
import { Dropdown } from 'react-native-element-dropdown';
import PaymentMethodBottomSheet from '../../components/BottomSheet/PaymentMethodBottomSheet';
import { BlurView } from '@react-native-community/blur';
import AddInvoiceRemarksBottomSheet from '../../components/BottomSheet/AddInvoiceRemarksBottomSheet';

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
  partyName: Yup.string()
    .min(2, 'Party name must be at least 2 characters')
    .max(30, 'Party name must be less than 30 characters'),
  contactNumber: Yup.string()
    .matches(/^[0-9+\-\s()]+$/, 'Invalid contact number format')
    .min(10, 'Contact number must be at least 10 digits'),
});

export default function NewSale() {
  const navigation = useNavigation();
  const route = useRoute();
  const formikRef = React.useRef(null);

  const isEditMode = route?.params?.mode === 'edit';
  const existingInvoice = route?.params?.invoiceData || null;

  const theme = useTheme();
  const {
    authState,
    updateAuthState,
    subscription,
    canCreateInvoice,
    fetchSubscription,
    hasPermission,
  } = useAuth();

  const [afterStoredata, setAfterStoredata] = useState({});
  //const storedata = authState?.user?.store;
  const storedata = authState?.user?.store;

  useEffect(() => {
    const checkPermission = () => {
      if (isEditMode) {
        if (!hasPermission(permissions.CAN_EDIT_INVOICES)) {
          setPermissionDenied(true);
          setAlertConfig({
            visible: true,
            title: 'Permission Denied',
            message: 'You do not have permission to edit invoices.',
            actions: [{ label: 'Go Back', onPress: () => navigation.goBack() }],
            type: 'error',
          });
        }
      } else {
        if (!hasPermission(permissions.CAN_CREATE_INVOICES)) {
          setPermissionDenied(true);
          setAlertConfig({
            visible: true,
            title: 'Permission Denied',
            message: 'You do not have permission to create invoices.',
            actions: [{ label: 'Go Back', onPress: () => navigation.goBack() }],
            type: 'error',
          });
        }
      }
    };

    checkPermission();
  }, [isEditMode, hasPermission, navigation]);

  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);

  const discountSheetRef = React.useRef(null);
  const [discount, setDiscount] = useState({ type: 'flat', value: 0 });

  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [mobileQuery, setMobileQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [invoiceLoaded, setInvoiceLoaded] = useState(!isEditMode);
  const [nextInvoiceNo, setNextInvoiceNo] = useState(null);

  const [isMobileFocused, setIsMobileFocused] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [invoiceRemarks, setInvoiceRemarks] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Responsive FAB helpers: safe-area, window dimensions and keyboard handling
  const insets = useSafeAreaInsets();
  const windowDims = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const paymentSheetRef = React.useRef(null);

  // At top of NewSale.jsx state section
  const [paidAmount, setPaidAmount] = React.useState(0);

  // Keep paidAmount in sync with computed grand total by default (only when user hasn’t overridden)
  const hasUserEditedPaid = React.useRef(false);

  const webViewRef = React.useRef(null);
  const remarksSheetRef = React.useRef(null);
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

  // Payment method options
  const paymentMethodOptions = [
    { label: 'Cash', value: 'cash', icon: 'cash' },
    { label: 'UPI', value: 'upi', icon: 'qrcode-scan' },
    { label: 'Card', value: 'card', icon: 'credit-card' },
    { label: 'Bank Transfer', value: 'bank_transfer', icon: 'bank' },
    { label: 'Cheque', value: 'cheque', icon: 'checkbook' },
  ];

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

  // Helper to compute FAB bottom position (respects keyboard and safe-area)
  const computeFabBottom = offset =>
    keyboardHeight
      ? keyboardHeight + insets.bottom + offset
      : insets.bottom + offset;

  // Responsive offsets (percentages of screen height)
  const pencilOffset = Math.round(windowDims.height * 0.005); // ~8% from bottom
  const discountOffset = Math.round(windowDims.height * 0.065); // ~16% from bottom
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
      partyName: data.name || '',
      contactNumber: data.mobile || '',
      gstNumber: data.gstNumber || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      country: data.country || '',
      postalCode: data.postalCode || '',
    });
    // Sheet closes itself in its own handleSave after calling onSave
  };

  const shouldShowBackAlert = () => {
    const fv = formikRef.current?.values || {};
    // show alert if invoice is loaded or any customer info entered
    const hasCustomerInfo =
      fv.partyName?.trim()?.length > 0 ||
      fv.contactNumber?.trim()?.length > 0 ||
      fv.address?.trim()?.length > 0 ||
      fv.gstNumber?.trim()?.length > 0;

    return invoiceLoaded || hasCustomerInfo;
  };

  const [cartItems, setCartItems] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [invoiceKind, setInvoiceKind] = useState(
    storedata?.gstNumber ? 'gst' : 'non-gst',
  );
  const isGstInvoice = invoiceKind === 'gst';

  const initialValues =
    isEditMode && existingInvoice
      ? {
          partyName: existingInvoice.customerName || '',
          contactNumber: existingInvoice.customerMobile || '',
          gstNumber: existingInvoice.customerGstNumber || '',
          address: existingInvoice.customerAddress || '',
          city: existingInvoice.customerCity || '',
          state: existingInvoice.customerState || '',
          country: existingInvoice.customerCountry || 'India',
          postalCode: existingInvoice.customerPostalCode || '',
          invoicePrefix: existingInvoice.invoiceNumber.split('-')[0] || 'INV',
          invoiceNumber: existingInvoice.invoiceNumber,
        }
      : {
          partyName: '',
          contactNumber: '',
          gstNumber: '',
          address: '',
          city: '',
          state: '',
          country: 'India',
          postalCode: '',
          invoicePrefix: storedata?.settings?.invoicePrefix || 'INV',
          invoiceNumber: storedata?.settings?.invoiceStartNumber || 1,
        };

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
        // ✅ Use same cancel alert style
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

          return true; // prevent immediate navigation
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
        // 👇 Re-fetch subscription each time user enters NewSale
        await fetchSubscription();
      };

      onFocus();
      fetchLastInvoice();
      fetchCustomers();

      // Optional cleanup
      return () => {};
    }, []),
  );

  const fetchLastInvoice = async () => {
    try {
      const res = await api.get('/invoice/last');
      const prefix = storedata?.settings?.invoicePrefix || 'INV';
      const startNo = storedata?.settings?.invoiceStartNumber || 1;
      const currentFY = getFinancialYear();

      if (res?.success && res?.data?.invoiceNumber) {
        // ✅ Pass the full invoice number, not just the prefix
        const newInvoice = incrementInvoiceNumber(res.data.invoiceNumber);
        setNextInvoiceNo(newInvoice);
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
      } else {
        // No invoice found → start fresh with correct prefix
        setNextInvoiceNo(`${prefix}-${currentFY}-${startNo}`);
      }
    } catch (err) {
      const prefix = storedata?.settings?.invoicePrefix || 'INV';
      const startNo = storedata?.settings?.invoiceStartNumber || 1;
      const currentFY = getFinancialYear();
      setNextInvoiceNo(`${prefix}-${currentFY}-${startNo}`);
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const res = await api.get('/customer?limit=20000');
      if (res.success && res.data.docs) {
        setCustomers(res.data.docs);
        setFilteredCustomers(res.data.docs);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load customers',
      });
    } finally {
      setLoadingCustomers(false);
    }
  };

  function getFinancialYear(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // Jan=0
    if (month >= 4) {
      return `${String(year).slice(-2)}${String(year + 1).slice(-2)}`;
    } else {
      return `${String(year - 1).slice(-2)}${String(year).slice(-2)}`;
    }
  }

  function parseInvoiceNumber(invoiceNo) {
    const parts = invoiceNo.split('-');

    if (parts.length === 3) {
      const [prefix, financialYear, sequentialNo] = parts;
      return {
        prefix,
        financialYear,
        sequentialNo: parseInt(sequentialNo, 10),
      };
    }

    if (parts.length === 2) {
      const [prefix, sequentialNo] = parts;
      return {
        prefix,
        financialYear: getFinancialYear(), // fallback to current FY
        sequentialNo: parseInt(sequentialNo, 10),
      };
    }

    return {
      prefix: 'INV',
      financialYear: getFinancialYear(),
      sequentialNo: 1,
    };
  }

  function incrementInvoiceNumber(currentInvoiceNo) {
    const { financialYear, sequentialNo } =
      parseInvoiceNumber(currentInvoiceNo);

    // ✅ Always use the CURRENT store prefix, not whatever was stored in the old invoice
    const prefix = storedata?.settings?.invoicePrefix || 'INV';
    const currentFY = getFinancialYear();

    // If financial year changed → reset to 1 with new prefix
    if (financialYear !== currentFY) {
      return `${prefix}-${currentFY}-1`;
    }

    return `${prefix}-${currentFY}-${sequentialNo + 1}`;
  }

  // Search filter
  const debouncedSearch = useMemo(
    () =>
      debounce((mobileQ, nameQ) => {
        const m = (mobileQ || '').trim();
        const n = (nameQ || '').trim().toLowerCase();

        if (!m && !n) {
          setFilteredCustomers(customers);
          return;
        }

        setFilteredCustomers(
          customers.filter(c => {
            const nameMatch = n
              ? (c.name || '').toLowerCase().includes(n)
              : true;
            const mobileMatch = m
              ? (c.mobile || '').includes(m) ||
                (c.mobile || '')
                  .replace(/\D/g, '')
                  .includes(m.replace(/\D/g, ''))
              : true;
            // If both queries present, require BOTH to match (AND). If only one present, match that one.
            if (n && m) return nameMatch && mobileMatch;
            if (n) return nameMatch;
            return mobileMatch;
          }),
        );
      }, 200),
    [customers],
  );

  const handleMobileChange = text => {
    setMobileQuery(text);
    // Keep Formik contactNumber in sync
    formikRef.current?.setFieldValue?.('contactNumber', text);
    // If user edits mobile after selecting customer, clear selectedCustomer
    if (selectedCustomer && text !== selectedCustomer.mobile) {
      setSelectedCustomer(null);
    }
    debouncedSearch(text, nameQuery);
  };

  const handleNameChange = text => {
    setNameQuery(text);
    // Keep Formik partyName in sync
    formikRef.current?.setFieldValue?.('partyName', text);
    if (selectedCustomer && text !== selectedCustomer.name) {
      setSelectedCustomer(null);
    }
    debouncedSearch(mobileQuery, text);
  };

  const clearCustomerInputs = () => {
    setMobileQuery('');
    setNameQuery('');
    formikRef.current?.setFieldValue?.('contactNumber', '');
    formikRef.current?.setFieldValue?.('partyName', '');
    setSelectedCustomer(null);
    setFilteredCustomers(customers);

    // ✅ Reset amount to full paid (net total) and lock it
    setPaidAmount(invoiceCalculations?.netTotal || 0);
    hasUserEditedPaid.current = false;
  };

  const handleAnyInputFocus = input => {
    if (input === 'mobile') setIsMobileFocused(true);
    if (input === 'name') setIsNameFocused(true);

    // Show dropdown if not already visible
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

    // Wait briefly to allow switching between inputs
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
          // Only allow toggle if gstNumber exists
          if (storedata?.gstNumber) {
            setInvoiceKind(val ? 'gst' : 'non-gst');
          }
        }}
        disabled={!storedata?.gstNumber} // disable switch if no gstNumber
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
          setFieldValue('contactNumber', item.mobile);
          setFieldValue('partyName', item.name);
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
            {/* Left Icon */}
            <View style={styles.iconContainer}>
              <TextInput.Icon
                icon="account-circle"
                size={28}
                color={theme.colors.primary}
              />
            </View>

            {/* Customer Info */}
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
    if (route?.params?.existingCart) {
      setCartItems(route.params.existingCart);
      // // console.log("Cart data",route.params.existingCart);
    }
  }, [route?.params?.existingCart]);
  // // console.log("Cart data",cartItems);

  useEffect(() => {
    const loadInvoiceDetails = async () => {
      if (isEditMode && existingInvoice?._id) {
        try {
          const res = await api.get(`/invoice/id/${existingInvoice._id}`);
          // console.log('Full invoice details:', res);
          if (res?.success && res?.data) {
            const fullInvoice = res.data;

            console.log('data-->', res.data);

            // Normalize items so UI and calculator see consistent keys + numeric types
            const normalizedItems = (fullInvoice.items || []).map(item => ({
              // keep original fields too but ensure canonical keys exist
              ...item,
              qty: Number(item.quantity ?? item.qty ?? 0),
              price: Number(item.sellingPrice ?? item.price ?? 0),
              gstRate: Number(item.gstRate ?? 0),
              isTaxInclusive: item.isTaxInclusive ?? false,
              discount: Number(item.discount ?? 0),
              hsn: item.hsn ?? '',
              unit: item.unit ?? 'pcs',
              total: Number(item.total ?? 0),
            }));

            setCartItems(normalizedItems);
            setShowPreview(true);
            setSelectedCustomer({
              name: fullInvoice.customerName,
              mobile: fullInvoice.customerMobile,
              address: fullInvoice.customerAddress,
              gstNumber: fullInvoice.customerGstNumber || '',
            });

            // Ensure invoice type reflects saved invoice
            if (fullInvoice.type === 'gst' || fullInvoice.type === 'non-gst') {
              setInvoiceKind(fullInvoice.type);
            }

            setInvoiceLoaded(true);
            // Optionally, store invoice details locally if needed
            // console.log('Loaded full invoice for edit:', fullInvoice);
          } else {
            console.warn('Invoice fetch failed or empty data');
          }
        } catch (err) {
          console.error('Failed to fetch invoice details:', err);
        }
      }
    };

    loadInvoiceDetails();
  }, [isEditMode, existingInvoice]);

  useEffect(() => {
    if (isEditMode && existingInvoice) {
      setMobileQuery(existingInvoice.customerMobile || '');
    }
  }, [isEditMode, existingInvoice]);

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

    // Build a computed items array (pure — do NOT mutate cartItems)
    const computedItems = (cartItems || []).map(item => {
      const gstRate = Number(item.gstRate || 0);
      const qty = Number(item.qty || 0);
      const sellingPriceRaw = Number(item.sellingPrice ?? 0);
      const discount = Number(item.discountPrice ?? item.discount ?? 0);
      const isTaxInclusive = Boolean(item.isTaxInclusive);

      // 🧮 Apply discount safely (before tax)
      const sellingPrice = Math.max(0, sellingPriceRaw - discount);

      let baseRate = 0;
      let taxableValue = 0;
      let gstAmount = 0;
      let totalAmount = 0;

      if (isGstInvoice) {
        if (isTaxInclusive) {
          // Tax inclusive: price already includes GST
          baseRate = sellingPriceRaw / (1 + gstRate / 100);
          taxableValue = (sellingPrice / (1 + gstRate / 100)) * qty;
          gstAmount = taxableValue * (gstRate / 100);
          totalAmount = sellingPrice * qty; // stays inclusive
        } else {
          // Tax exclusive: add GST after discount
          baseRate = sellingPriceRaw;
          taxableValue = sellingPrice * qty;
          gstAmount = taxableValue * (gstRate / 100);
          totalAmount = taxableValue + gstAmount;
        }
        // if (isTaxInclusive) {
        //   subtotal += totalAmount - gstAmount; // extract taxable part
        // } else {
        //   subtotal += taxableValue;
        // }
        subtotal += totalAmount;
        totalTax += gstAmount;

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
      } else {
        // Non-GST: just apply discount
        baseRate = sellingPriceRaw;
        taxableValue = sellingPrice * qty;
        gstAmount = 0;
        totalAmount = taxableValue;
        subtotal += totalAmount;
      }

      return {
        ...item,
        baseRate,
        discount,
        taxableValue,
        gstAmount,
        total: Number(totalAmount), // computed line total
        qty,
        price: sellingPriceRaw,
        gstRate,
        isTaxInclusive,
      };
    });
    // const grandTotalRaw = isGstInvoice ? subtotal + totalTax : subtotal;
    const grandTotalRaw = subtotal;
    let grandTotalAfterDiscount = grandTotalRaw;

    let discountTotal = 0;
    if (discount?.type === 'flat') {
      discountTotal = Number(discount?.value || 0);
    } else if (discount?.type === 'percent') {
      discountTotal = grandTotalRaw * (Number(discount?.value || 0) / 100);
    }

    const roundedTotal = Math.round(grandTotalAfterDiscount);

    const totalQuantity = computedItems.reduce(
      (sum, it) => sum + (it.qty || 0),
      0,
    );

    const netTotal = Math.round(grandTotalAfterDiscount - discountTotal);
    const rawDifference =
      Math.round(grandTotalAfterDiscount - discountTotal) -
      (grandTotalAfterDiscount - discountTotal);

    const roundOff = Number((rawDifference + Number.EPSILON).toFixed(2));

    // console.log('Round off:', roundOff);

    return {
      subtotal,
      netTotal,
      roundOff,
      totalTax: isGstInvoice ? totalTax : 0,
      grandTotal: grandTotalAfterDiscount,
      roundedTotal,
      grandTotalRaw,
      discountTotal: Number(discountTotal.toFixed(2)),
      totalQuantity,
      itemCount: computedItems.length,
      gstBreakdown: isGstInvoice ? gstBreakdown : {},
      computedItems,
    };
  }, [cartItems, isGstInvoice, discount, isIgst]);

  React.useEffect(() => {
    const gt = Number(invoiceCalculations?.netTotal ?? 0);
    // Only auto-update if user hasn’t manually edited paid amount
    if (!hasUserEditedPaid.current) {
      setPaidAmount(gt);
    }
    // Also auto-adjust if discount changes (but only if user didn’t override)
  }, [invoiceCalculations?.netTotal]);

  // Derived payment info
  const payment = React.useMemo(() => {
    const grandTotal = Number(invoiceCalculations?.netTotal ?? 0);
    const paid = Math.max(0, Number.isFinite(paidAmount) ? paidAmount : 0);
    const normPaid = Math.min(paid, grandTotal); // disallow overpay in UI
    const due = Math.max(0, grandTotal - normPaid);

    let status = 'unpaid';
    if (normPaid === 0 && grandTotal > 0) status = 'unpaid';
    else if (due === 0 && grandTotal > 0) status = 'paid';
    else if (normPaid > 0 && normPaid < grandTotal) status = 'partial';

    return {
      grandTotal,
      paid: normPaid,
      due,
      status,
    };
  }, [invoiceCalculations?.netTotal, paidAmount]);

  // Helper chip for status colors
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
      // Step 1: Fetch the last invoice number
      const res = await api.get('/invoice/last');
      const prefix = storedata?.settings?.invoicePrefix || 'INV';
      const startNo = storedata?.settings?.invoiceStartNumber || 1;
      const currentFY = getFinancialYear();

      let newInvoiceNo;
      if (res?.success && res?.data?.invoiceNumber) {
        newInvoiceNo = incrementInvoiceNumber(res.data.invoiceNumber);
      } else {
        // ✅ Use store prefix correctly
        newInvoiceNo = `${prefix}-${currentFY}-${startNo}`;
      }

      setNextInvoiceNo(newInvoiceNo);

      // Step 2: Create the invoice using the new number
      await createInvoice(
        { ...values, invoiceNumber: newInvoiceNo },
        formikHelpers,
      );
    } catch (error) {
      console.error('❌ Error preparing invoice:', error);
      showAlert('Error', 'Failed to prepare invoice number. Please try again.');
      formikHelpers.setSubmitting(false);
    }
  };

  // ✅ Determine whether invoice is IGST or CGST+SGST
  function determineGstType(storeGst, customerGst, storeState, customerState) {
    // console.log('details:', storeGst, customerGst, storeState, customerState);
    const extractStateCode = gst => gst?.substring(0, 2);

    let isIgst = false;

    if (storeGst && customerGst) {
      // Compare first 2 digits of GSTIN (state codes)
      const storeCode = extractStateCode(storeGst);
      const customerCode = extractStateCode(customerGst);
      if (storeCode && customerCode && storeCode !== customerCode) {
        isIgst = true;
      }
    } else if (storeState && customerState) {
      // Compare states when GSTINs are missing
      if (
        storeState.trim().toLowerCase() !== customerState.trim().toLowerCase()
      ) {
        isIgst = true;
      }
    }

    return isIgst;
  }

  console.log('store data ', storedata);

  const createInvoice = async (values, { setSubmitting, resetForm }) => {
    const check = canCreateInvoice();
    if (!check.allowed && !isEditMode) {
      // Only apply subscription limit on new invoice
      showAlert(
        'Subscription Restriction',
        check.message,
        [
          {
            label: 'View Plans',
            mode: 'contained',
            onPress: () => navigation.replace('Pricings'),
          },
        ],
        'error',
      );
      setSubmitting(false);
      return;
    }

    if (cartItems.length === 0) {
      showAlert('Error', 'Please add items to the invoice');
      setSubmitting(false);
      return;
    }

    const paymentStatus =
      payment.paid === 0 && payment.grandTotal > 0
        ? 'unpaid'
        : payment.due === 0 && payment.grandTotal > 0
        ? 'paid'
        : 'partial';

    const customerGstFinal = values?.gstNumber || selectedCustomer?.gstNumber;
    const customerStateFinal = values?.state || selectedCustomer?.state;

    const isIgst = determineGstType(
      storedata?.gstNumber,
      customerGstFinal,
      storedata?.address?.state,
      customerStateFinal,
    );

    // Prepare invoice payload
    const invoiceData = {
      customerName: values.partyName,
      customerMobile: values.contactNumber,
      customerAddress: values.address || '',
      customerGstNumber: values.gstNumber || '',
      customerCity: values.city || '',
      customerState: values.state || '',
      customerCountry: values.country || 'India',
      customerPostalCode: values.postalCode || '',
      invoiceNumber: isEditMode
        ? existingInvoice?.invoiceNumber
        : values.invoiceNumber,
      type: isGstInvoice ? 'gst' : 'non-gst',
      isIgst,
      items: cartItems.map(item => {
        const base = Number(item.sellingPrice ?? 0);
        const discount = Number(item.discountPrice ?? item.discount ?? 0);
        const gstRate = Number(item.gstRate ?? 0);
        const qty = Number(item.qty ?? 0);

        const effectivePrice = Math.max(0, base - discount);
        const effectiveRate = isGstInvoice
          ? effectivePrice
          : effectivePrice * (1 + gstRate / 100);
        const lineTotal = effectiveRate * qty;

        return {
          name: item.name,
          hsn: item.hsn || '',
          unit: item.unit || 'pcs',
          sellingPrice: base, // stored base selling price
          gstRate, // retained for data integrity
          isTaxInclusive: !!item.isTaxInclusive,
          quantity: qty,
          discount,
          total: Number(lineTotal.toFixed(2)),
        };
      }),
      subTotal: Number(invoiceCalculations.subtotal.toFixed(2)),
      gstTotal: Number(
        (isGstInvoice ? invoiceCalculations.totalTax : 0).toFixed(2),
      ),
      // Use the computed discountTotal from invoiceCalculations (handles flat and percent correctly)
      discountTotal: Number(
        (invoiceCalculations.discountTotal || 0).toFixed(2),
      ),
      roundOff: Number(invoiceCalculations.roundOff),
      grandTotal: Number(invoiceCalculations.netTotal.toFixed(2)),
      amountPaid: Number(payment.paid.toFixed(2)),
      amountDue: Number(payment.due.toFixed(2)),
      paymentStatus,
      paymentMethod: paymentMethod,
      paymentNote: paymentNote || '',
      remarks: invoiceRemarks || '',
    };

    // console.log('Invoice Payload:', invoiceData);

    try {
      const res = isEditMode
        ? await api.put(`/invoice/id/${existingInvoice._id}`, invoiceData)
        : await api.post('/invoice', invoiceData);

      // console.log('Invoice API Response:', res);

      if (res?.success) {
        try {
          const successSound = new Sound(
            'success.mp3',
            Sound.MAIN_BUNDLE,
            error => {
              if (error) {
                console.warn('Sound playback error:', error);
                return;
              }
              // Play the sound
              successSound.play(() => {
                successSound.release(); // Release resources when done
              });
            },
          );
        } catch (err) {
          console.warn('Failed to play success sound:', err);
        }

        // small vibration on success (short buzz)
        Vibration.vibrate(150);

        Toast.show({
          type: 'success',
          text1: isEditMode ? 'Invoice Updated!' : 'Invoice Created!',
          text2: `Invoice #${invoiceData.invoiceNumber} has been successfully ${
            isEditMode ? 'updated' : 'created'
          }.`,
        });
        // Only update store invoice counters for NEW invoices. Do not modify invoice numbering on edit.
        if (!isEditMode) {
          const nextNumber = values.invoiceNumber + 1;

          // ✅ Update invoice number inside authState.user.store.settings
          const updatedStore = {
            ...storedata,
            settings: {
              ...storedata.settings,
              invoiceStartNumber: nextNumber - 1, // store last used number
            },
          };

          const updatedAuth = {
            ...authState,
            user: {
              ...authState.user,
              store: updatedStore,
            },
          };

          await updateAuthState(updatedAuth); // persists to AsyncStorage automatically
        }
        // Reset Formik with incremented value for UI (only for new invoices we clear the form)
        // ✅ Full reset after successful invoice
        resetForm({
          values: {
            partyName: '',
            contactNumber: '',
            address: '',
            gstNumber: '',
            invoicePrefix: storedata?.settings?.invoicePrefix || 'INV',
            invoiceNumber: nextInvoiceNo || 1,
          },
        });

        // Reset all related states
        setSelectedCustomer(null);
        setMobileQuery('');
        setNameQuery('');
        setCartItems([]);
        setShowPreview(false);
        setDiscount({ type: 'flat', value: 0 });
        setPaymentMethod('cash');
        setPaidAmount(0);
        hasUserEditedPaid.current = false;

        if (isEditMode) {
          navigation.replace('InvoiceDetail', {
            storedata,
            invoice: res.data,
          });
        } else {
          navigation.push('InvoiceDetail', {
            storedata: authState?.user?.store || storedata,
            invoice: res.data,
          });
        }
      } else {
        Toast.show({
          type: 'error',
          text2: res?.message || 'Failed to create invoice. Please try again.',
        });
      }
    } catch (error) {
      console.error('Invoice creation failed:', error);
      showAlert('Error', 'Failed to create invoice. Please try again.');
    } finally {
      setSubmitting(false);
      await fetchSubscription();
    }
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

  console.log('adterstore dta', afterStoredata);

  const handleAddItems = () => {
    // Ensure each item has a unique identifier (needed for FlatList & AddItems)
    const preparedCart = (cartItems || []).map((item, index) => {
      const editedPrice = Number(item.price ?? item.sellingPrice ?? 0);

      return {
        ...item,
        _id: item._id || item.productId || `${item.name}-${index}`,

        // ALWAYS override product metadata so AddItems UI shows edited price
        sellingPrice: editedPrice,
        price: editedPrice,

        // VERY IMPORTANT — keep product original too
        product: {
          ...item.product,
          sellingPrice: editedPrice, // ← THIS FIXES THE UI (399 instead of 499)
        },

        qty: item.qty ?? item.quantity ?? 0,
        subtotal: item.total ?? item.subtotal ?? 0,
      };
    });

    // console.log("📦 Sending to AddItems:", preparedCart);
    navigation.push('AddItemSales', {
      existingCart: preparedCart,
      onItemsSelected: newCart => {
        setCartItems(newCart);
        setShowPreview(true);
      },
    });
  };

  const customerData = React.useMemo(
    () => ({
      name: formikRef.current?.values?.partyName || '',
      mobile: formikRef.current?.values?.contactNumber || '',
      address: formikRef.current?.values?.address || '',
      gstNumber: formikRef.current?.values?.gstNumber || '',
      city: formikRef.current?.values?.city || '',
      state: formikRef.current?.values?.state || '',
      country: formikRef.current?.values?.country || '',
      postalCode: formikRef.current?.values?.postalCode || '',
    }),
    [formikRef.current?.values],
  );

  console.log('old-->', existingInvoice?.invoiceNumber);
  console.log('new --> ', nextInvoiceNo);

  // Initial form view (when no items added yet)
  return (
    <>
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Navbar
          title="New Invoice"
          showBackButton={true}
          help="Billing"
          onBackPress={() => {
            if (
              invoiceLoaded &&
              showPreview &&
              (invoiceCalculations.computedItems || cartItems).length > 0
            ) {
              showAlert(
                'Exit Invoice',
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
          rightComponent={
            <View
              style={{
                justifyContent: 'flex-end',
                alignContent: 'flex-end',
                alignItems: 'flex-end',
                //paddingHorizontal: 16,
              }}
            >
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.outline }}
              >
                Invoice Number
              </Text>
              {isEditMode ? (
                <Text variant="titleSmall">
                  {'#'}
                  {existingInvoice?.invoiceNumber}
                </Text>
              ) : nextInvoiceNo ? (
                <Text variant="titleSmall">
                  {'#'}
                  {nextInvoiceNo}
                </Text>
              ) : (
                <TextSkeleton width={100} height={16} />
              )}
            </View>
          }
        />

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
            <View style={{ flex: 1 }}>
              {/* <View style={{ paddingHorizontal: 16 }}>
                  <Surface
                    mode="elevated"
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 12,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: theme.colors.surface,
                    }}
                  >
                    <View style={{}}>
                      <Text
                        variant="labelMedium"
                        style={{ color: theme.colors.outline }}
                      >
                        Invoice Number
                      </Text>
                      <Text variant="titleSmall">
                        {'#'}
                        {isEditMode
                          ? existingInvoice?.invoiceNumber
                          : nextInvoiceNo || 'Loading...'}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        variant="labelMedium"
                        style={{ color: theme.colors.outline }}
                      >
                        Date
                      </Text>
                      <Text variant="titleSmall">
                        {format(invoiceDate, 'dd-MMM-yyyy')}
                      </Text>
                    </View>
                  </Surface>
                </View> */}
              {/* Customer Input Section */}
              <View
                style={styles.inputRow}
                onLayout={e => {
                  const { x, y, width, height } = e.nativeEvent.layout;
                  setInputLayout({ x, y: y + height + 60, width, height });
                }}
              >
                {/* Mobile / Phone input */}
                <TextInput
                  ref={mobileInputRef}
                  label="Customer Mobile"
                  value={mobileQuery}
                  onChangeText={text => handleMobileChange(text)}
                  onFocus={() => handleAnyInputFocus('mobile')}
                  onBlur={() => handleAnyInputBlur('mobile')}
                  mode="outlined"
                  style={styles.input}
                  left={<TextInput.Icon icon="phone" />}
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
                    formikRef.current?.touched?.contactNumber &&
                      formikRef.current?.errors?.contactNumber,
                  )}
                />

                {/* name input */}
                <TextInput
                  label="Customer Name"
                  value={
                    nameQuery || formikRef.current?.values?.partyName || ''
                  }
                  onChangeText={text => handleNameChange(text)}
                  onFocus={() => handleAnyInputFocus('name')}
                  onBlur={() => handleAnyInputBlur('name')}
                  mode="outlined"
                  style={[styles.input, { marginTop: 8 }]}
                  left={<TextInput.Icon icon="account" />}
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

              {/* Dropdown */}
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
                          top: inputLayout.y + 0,
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
                              ? 'No customers found'
                              : 'No customers available'}
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

              <View style={{ paddingHorizontal: 16 }}>
                {mobileQuery.trim() || nameQuery.trim() ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={!mobileQuery.trim() && !nameQuery.trim()}
                    onPress={() => {
                      // Optional: keep a UI snapshot if needed
                      const snapshot = {
                        name: values.partyName || '',
                        mobile: values.contactNumber || '',
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
                      marginVertical: 4,
                      paddingHorizontal: 16,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: theme.colors.primary }}>
                      Add More Customer Details
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* <CustomerDetailBottomSheet
                ref={customerSheetRef}
                customerData={{
                  name: values.partyName,
                  mobile: values.contactNumber,
                  address: values.address,
                  gstNumber: values.gstNumber,
                }}
                onSave={handleCustomerSave}
              /> */}
              {invoiceLoaded &&
              showPreview &&
              (invoiceCalculations.computedItems || cartItems).length > 0 ? (
                <View style={{ flex: 1, position: 'relative' }}>
                  {/* <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16 }}>
                        <Button
                          mode="contained"
                          onPress={handleAddItems}
                          style={{ flex: 1 }}
                          icon="pencil"
                        >
                          Edit / Add Items
                        </Button>
                      </View> */}
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
                        html: generateInvoiceHTML({
                          preview: true,
                          formValues: values,
                          cartItems: invoiceCalculations.computedItems?.length
                            ? invoiceCalculations.computedItems
                            : cartItems,
                          invoiceCalculations,
                          invoiceNumber: isEditMode
                            ? existingInvoice?.invoiceNumber
                            : nextInvoiceNo || 'Loading...',
                          invoiceDate: isEditMode
                            ? new Date(existingInvoice?.invoiceDate)
                            : invoiceDate,
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

                    {/* 🔍 Simple Transparent Outline Zoom Buttons */}
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

                    {invoiceLoaded &&
                      showPreview &&
                      (invoiceCalculations.computedItems || cartItems).length >
                        0 && (
                        <>
                          <FAB
                            size="small"
                            animated
                            icon="percent"
                            style={{
                              position: 'absolute',
                              bottom: computeFabBottom(discountOffset),
                              right: fabRight,
                              backgroundColor: theme.colors.secondary, // or theme.colors.primary
                              borderRadius: 30,
                            }}
                            color="white"
                            onPress={() =>
                              discountSheetRef.current?.present?.()
                            }
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
                        </>
                      )}
                  </View>

                  <Surface
                    elevation={6}
                    style={[
                      {
                        paddingHorizontal: 12,
                        paddingBottom: 12,
                        paddingTop: 8,
                        backgroundColor: theme.colors.surfaceVariant,
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        // 👇 iOS-specific shadow for parity with Android elevation
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.15,
                        shadowRadius: 6,

                        // Optional subtle border to help separation on light themes
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
                        {/* Status chip */}
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

                        <Button
                          mode="text"
                          onPress={() => remarksSheetRef.current?.expand?.()}
                        >
                          Add Remarks
                        </Button>
                      </View>

                      {/* <Dropdown
                        style={{
                          width: 120,
                          height: 22,
                          backgroundColor: theme.colors.surface,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: theme.colors.outline,
                          paddingHorizontal: 10,
                        }}
                        placeholderStyle={{
                          fontSize: 12,
                          color: theme.colors.onSurfaceVariant,
                        }}
                        selectedTextStyle={{
                          fontSize: 12,
                          color: theme.colors.onSurface,
                          fontWeight: '500',
                        }}
                        iconStyle={{
                          width: 12,
                          height: 12,
                          tintColor: theme.colors.onSurfaceVariant,
                        }}
                        iconColor={theme.colors.onSurfaceVariant}
                        data={paymentMethodOptions}
                        // maxHeight={220}
                        labelField="label"
                        valueField="value"
                        placeholder="Select"
                        value={paymentMethod}
                        onChange={(item) => {
                          setPaymentMethod(item.value);
                          // Vibration.vibrate(30); // subtle haptic feedback
                        }}
                        // renderLeftIcon={() => (
                        //   <Icon
                        //     source={
                        //       paymentMethodOptions.find((m) => m.value === paymentMethod)
                        //         ?.icon || 'cash'
                        //     }
                        //     size={16}
                        //     color={theme.colors.onSurfaceVariant}
                        //   />
                        // )}
                        renderItem={(item, selected) => (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              backgroundColor: selected
                                ? theme.colors.primaryContainer
                                : 'transparent',
                            }}
                          >
                            <Icon
                              source={item.icon}
                              size={14}
                              color={
                                selected
                                  ? theme.colors.onPrimaryContainer
                                  : theme.colors.onSurface
                              }
                            />
                            <Text
                              style={{
                                marginLeft: 10,
                                fontSize: 12,
                                color: selected
                                  ? theme.colors.onPrimaryContainer
                                  : theme.colors.onSurface,
                                fontWeight: selected ? '600' : '400',
                              }}
                            >
                              {item.label}
                            </Text>
                          </View>
                        )}
                        containerStyle={{
                          borderRadius: 12,
                          elevation: 8,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.15,
                          shadowRadius: 8,
                        }}
                        activeColor={theme.colors.primaryContainer}
                        dropdownPosition='top'
                        showsVerticalScrollIndicator={false}
                      /> */}
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
                      {/* Paid input row (compact) */}
                      <View style={{ flex: 1 }}>
                        <TouchableWithoutFeedback
                          onPress={() => {
                            if (
                              !formikRef.current?.values?.contactNumber?.trim()
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
                              !Boolean(selectedCustomer) &&
                              !Boolean(
                                formikRef.current?.values?.contactNumber?.trim()
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
                                !Boolean(selectedCustomer) &&
                                !Boolean(
                                  formikRef.current?.values?.contactNumber?.trim()
                                    ?.length >= 10,
                                ) && (
                                  <TextInput.Icon
                                    icon="lock"
                                    size={16}
                                    color={theme.colors.onSurfaceDisabled}
                                  />
                                )
                              }
                              value={paidAmount === 0 ? '' : String(paidAmount)}
                              onChangeText={txt => {
                                if (
                                  !Boolean(selectedCustomer) &&
                                  !Boolean(
                                    formikRef.current?.values?.contactNumber?.trim()
                                      ?.length >= 10,
                                  )
                                ) {
                                  return;
                                }

                                // Allow only numbers and one decimal point
                                let cleanValue = txt
                                  .replace(/[^0-9.]/g, '') // Remove non-numeric characters except decimal point
                                  .replace(/^(\d*\.?\d{0,2}).*$/, '$1') // Limit to 2 decimal places
                                  .replace(/^(\d+\.\d*)\./g, '$1'); // Remove extra decimal points

                                // If the value starts with a decimal, add a leading zero
                                if (cleanValue.startsWith('.')) {
                                  cleanValue = '0' + cleanValue;
                                }

                                // Parse to number and validate against max amount
                                const numeric = parseFloat(cleanValue) || 0;
                                const maxAmount = Number(
                                  invoiceCalculations?.netTotal ?? 0,
                                );

                                // Update state with validated and formatted value
                                if (!isNaN(numeric)) {
                                  const validatedValue = Math.min(
                                    Math.max(0, numeric),
                                    maxAmount,
                                  );
                                  setPaidAmount(
                                    validatedValue === 0 ? 0 : validatedValue,
                                  );
                                  hasUserEditedPaid.current = true;
                                }
                              }}
                              onBlur={() => {
                                // Format the value on blur
                                if (paidAmount > 0) {
                                  setPaidAmount(prev => {
                                    const value = parseFloat(prev).toFixed(2);
                                    return value.endsWith('.00')
                                      ? parseInt(value)
                                      : parseFloat(value);
                                  });
                                }
                              }}
                              // editable={Boolean(
                              //   formikRef.current?.values?.contactNumber?.trim(),
                              // )}
                              editable={
                                Boolean(selectedCustomer) ||
                                Boolean(
                                  formikRef.current?.values?.contactNumber?.trim()
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
                            height: 32, // adjust height as needed
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
                        {isEditMode ? 'Update Invoice' : 'Create Invoice'}
                      </Button>
                    </View>
                  </Surface>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  {/* <Text variant="headlineSmall" style={styles.emptyTitle}>
                          Create Invoice
                        </Text> */}
                  <Text variant="bodyMedium" style={styles.emptySubtitle}>
                    Start by adding items to your invoice
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

      <CustomerDetailBottomSheet
        ref={customerSheetRef}
        customerData={customerData}
        onSave={async data => {
          await handleCustomerSave(data);
          // Ensure the sheet is closed after save
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
      <AddInvoiceRemarksBottomSheet
        ref={remarksSheetRef}
        onSaveInvoice={remarks => {
          setInvoiceRemarks(remarks);
          remarksSheetRef.current?.close?.();
        }}
      />
    </>
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
    // marginBottom: 4,
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
    // marginRight: 12,
    marginHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  customerInfo: {
    marginHorizontal: 12,
  },

  customerName: {
    // fontWeight: '600',
  },

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
  dropdownSurface: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownList: {
    // flexGrow: 0,
    maxHeight: Math.min(screenHeight * 0.35, 260),
  },
  errorText: {
    fontSize: 12,
    textAlign: 'left',
  },
  previewContainer: {
    flex: 1,
    margin: 8,
    elevation: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'white',
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
    // flex: 1,
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
    // borderWidth: 1,
    // outline border
    backgroundColor: 'rgba(255,255,255,0.1)', // transparent look
    justifyContent: 'center',
    alignItems: 'center',
  },
});
