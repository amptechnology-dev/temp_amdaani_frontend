// screens/PurchaseDetail.jsx

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import {
  useTheme,
  Text,
  Surface,
  Divider,
  Chip,
  IconButton,
  ActivityIndicator,
  Menu,
  Button,
} from 'react-native-paper';
import Animated, {
  SlideInUp,
  SlideInDown,
  SlideInRight,
  SlideInLeft,
  ZoomIn,
  ZoomOut,
  Layout,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Navbar from '../components/Navbar';
import api from '../utils/api';
import { format } from 'date-fns';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';
import FileViewer from 'react-native-file-viewer';
import { FAB } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import Share from 'react-native-share';

// Smooth animation preset — reuse everywhere
const smoothEnter = (delay = 0, duration = 650) =>
  SlideInDown.duration(duration)
    .delay(delay)
    .easing(Easing.bezier(0.22, 1, 0.36, 1)); // smooth, natural curve

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Import your invoice template function
import { generateInvoiceHTML } from '../utils/invoiceTemplate';
import { useAuth } from '../context/AuthContext';
import { generatePurchaseHTML } from '../utils/purchaseTemplate';
import CustomAlert from '../components/CustomAlert';

const PurchaseDetail = ({ route, navigation }) => {
  const theme = useTheme();
  const purchaseId = route.params?.purchaseId;

  if (!purchaseId) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <Navbar title="Purchase Details" onBack={() => navigation.goBack()} />
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text>Invalid Purchase ID</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { authState } = useAuth();
  const storedata = authState?.user?.store;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchase, setPurchase] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);

  const [cancelAlertVisible, setCancelAlertVisible] = useState(false);

  const [alertData, setAlertData] = useState({
    title: '',
    message: '',
    type: 'info',
    actions: [],
  });

  const showAlert = (title, message, type = 'info', actions = []) => {
    setAlertData({ title, message, type, actions });
    setAlertVisible(true);
  };

  const fetchPurchase = async () => {
    console.log('Fetching purchase details for ID:', purchaseId);
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/purchase/id/${purchaseId}`);
      // console.log('Purchase Data', res);
      if (res?.success) {
        setPurchase(res.data);
      } else {
        setError('Failed to load purchase details');
      }
    } catch (err) {
      console.error('Error fetching purchase:', err);
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // console.log('Store Data in PurchaseDetail:', storedata);
    setTimeout(() => {
      fetchPurchase();
    }, 100);
  }, [purchaseId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPurchase().finally(() => setRefreshing(false));
  }, [purchaseId]);

  const handleShare = async () => {
    try {
      if (!purchase) return;
      await Share.share({
        message: `Purchase Invoice #${purchase.invoiceNumber}\nVendor: ${
          purchase.vendorName
        }\nAmount: ₹${purchase.grandTotal?.toFixed(2)}\nDate: ${format(
          new Date(purchase.date),
          'dd MMM yyyy',
        )}`,
        title: `Purchase #${purchase.invoiceNumber}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleEdit = () => {
    setMenuVisible(false);
    navigation.navigate('Purchase', {
      mode: 'edit',
      purchaseData: purchase, // 👈 STATE WALA PURCHASE
    });
  };

  const cancelPurchase = async () => {
    try {
      setLoading(true);

      // 👇 NEW API CALL
      const res = await api.put(`/purchase/status/${purchase._id}`, {
        status: 'cancelled',
      });

      if (res?.success) {
        // best practice → fresh data refetch
        await fetchPurchase();

        showAlert(
          'Purchase Cancelled',
          'This Purchase has been cancelled successfully.',
          'success',
          [{ label: 'OK', onPress: () => setAlertVisible(false) }],
        );
      } else {
        throw new Error('Cancel failed');
      }
    } catch (error) {
      console.error('Cancel Purchase error:', error);
      showAlert(
        'Error',
        error?.message || 'Failed to cancel Purchase. Please try again.',
        'error',
        [{ label: 'OK', onPress: () => setAlertVisible(false) }],
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert(
      'Delete Purchase',
      'Are you sure you want to delete this purchase? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/purchase/${purchase._id}`);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete purchase');
            }
          },
        },
      ],
    );
  };

  // Request storage permission for Android
  const requestStoragePermission = async () => {
    if (Platform.OS === 'android' && Platform.Version < 29) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission Required',
          message: 'This app needs access to your storage to save files.',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true; // Android 10+ doesn't need permission
  };

  // Transform purchase data to match invoice template format
  // Replace entire transformPurchaseToInvoiceData() with this:
  const transformPurchaseToInvoiceData = () => {
    if (!purchase) return null;

    // Destructure from purchase payload
    const {
      vendorName,
      vendorMobile,
      vendorAddress,
      vendorGstNumber,
      vendorState,
      vendorPostalCode,
      invoiceNumber,
      date,
      items = [],
      subTotal = 0,
      gstTotal = 0,
      isIgst = false,
      discountTotal = 0,
      roundOff = 0,
      grandTotal = 0,
      paymentStatus,
      paymentMethod,
      amountPaid = 0,
      amountDue = 0,
      paymentNote,
      status,
    } = purchase;

    // Business rule: if vendor has no GSTIN -> treat whole purchase as non-GST
    const vendorHasGst = !!(
      vendorGstNumber && String(vendorGstNumber).trim().length > 0
    );

    // Build cartItems array that the template expects
    // Contract:
    //  - baseRate = exclusive per-unit price
    //  - discount = per-unit discount (raw value as stored)
    //  - gstAmount = calculated only if vendorHasGst === true
    const cartItems = items.map(item => {
      const qty = Number(item.quantity || 0);
      const rawRate = Number(item.rate || 0); // rate as stored (may be tax-inclusive)
      const gstRateRaw = Number(item.gstRate || 0);
      const isInc = !!item.isTaxInclusive;

      // If vendor has no GST, force gstRate to 0 for calculations and display
      const gstRate = vendorHasGst ? gstRateRaw : 0;

      // Convert provided rate to exclusive baseRate if rate is tax-inclusive
      const baseRate =
        isInc && gstRate > 0 ? rawRate / (1 + gstRate / 100) : rawRate;

      // per-unit discount (raw). We convert it to exclusive-equivalent if the rate was inclusive
      const perUnitDiscountRaw = Number(item.discount || 0);
      const perUnitDiscountExclusive =
        isInc && gstRate > 0
          ? perUnitDiscountRaw / (1 + gstRate / 100)
          : perUnitDiscountRaw;

      // taxable value (exclusive) for this line
      const taxableValue = baseRate * qty - perUnitDiscountExclusive * qty;

      // IMPORTANT: only compute GST if vendor has GST
      const gstAmount =
        vendorHasGst && gstRate > 0 ? taxableValue * (gstRate / 100) : 0;

      const total = taxableValue + gstAmount;

      return {
        // keep both raw and normalized fields so template or debug can use either
        name: item.name,
        hsn: item.hsn,
        qty,
        quantity: qty,
        unit: item.unit,
        price: rawRate, // display rate as stored
        baseRate, // exclusive rate used for taxable calculations
        gstRate, // zero if vendorHasGst === false
        gstAmount,
        discount: perUnitDiscountRaw, // raw per-unit discount (for display)
        discountExclusivePerUnit: perUnitDiscountExclusive, // converted exclusive discount
        taxableValue,
        total,
        isTaxInclusive: isInc,
      };
    });

    // Recompute totals from cartItems (so template uses the same numbers)
    const sums = cartItems.reduce(
      (acc, it) => {
        acc.subtotal += Number(it.baseRate || 0) * Number(it.qty || 0);
        acc.discountTotal +=
          Number(it.discountExclusivePerUnit || 0) * Number(it.qty || 0);
        acc.gstTotal += Number(it.gstAmount || 0);
        acc.totalAmount += Number(it.total || 0);
        acc.totalQty += Number(it.qty || 0);
        acc.totalTaxable += Number(it.taxableValue || 0);
        return acc;
      },
      {
        subtotal: 0,
        discountTotal: 0,
        gstTotal: 0,
        totalAmount: 0,
        totalQty: 0,
        totalTaxable: 0,
      },
    );

    // Keep roundOff from purchase if provided; otherwise compute difference between rounded and raw (optional)
    const effectiveRoundOff = Number(roundOff || 0);
    // If explicit roundOff exists, obey it. If not, compute small round-off to nearest integer rupee if you prefer:
    // const computedRoundOff = effectiveRoundOff || Math.round(sums.totalAmount) - sums.totalAmount;
    const computedGrand = Number(
      (sums.totalAmount + effectiveRoundOff).toFixed(2),
    );

    // Build invoiceCalculations for template
    const invoiceCalculations = {
      subtotal: Number(sums.subtotal.toFixed(2)),
      discountTotal: Number(sums.discountTotal.toFixed(2)),
      gstTotal: vendorHasGst ? Number(sums.gstTotal.toFixed(2)) : 0,
      grandTotal: Number(computedGrand.toFixed(2)),
      gstBreakdown: vendorHasGst
        ? calculateGSTBreakdown(cartItems, isIgst)
        : {},
      totals: {
        totalQty: sums.totalQty,
        totalTaxable: Number(sums.totalTaxable.toFixed(2)),
        totalGST: vendorHasGst ? Number(sums.gstTotal.toFixed(2)) : 0,
        totalAmount: Number(sums.totalAmount.toFixed(2)),
      },
    };

    const formValues = {
      customerName: vendorName,
      contactNumber: vendorMobile,
      customerAddress: vendorAddress,
      customerGstNumber: vendorGstNumber,
      customerState: vendorState,
      customerPostalCode: vendorPostalCode,
    };

    const payment = {
      paid: Number(amountPaid || 0),
      due: Number(amountDue || 0),
      status: paymentStatus || 'unpaid',
    };

    return {
      preview: false,
      createdInvoice: true,

      invoiceData: {
        ...purchase,
        isIgst,
        subTotal: invoiceCalculations.subtotal,
        discountTotal: invoiceCalculations.discountTotal,
        roundOff: effectiveRoundOff,
        grandTotal: invoiceCalculations.grandTotal,
        paymentMethod,
        paymentNote,
        // include vendorHasGst for template convenience
        vendorHasGst,
      },

      formValues,
      cartItems,
      invoiceCalculations,

      invoiceNumber,
      currentDate: new Date(),
      currentTime: format(new Date(), 'HH:mm:ss'),
      invoiceDate: new Date(date),
      isGstInvoice: vendorHasGst,
      isFreePlan: true,
      appBrand: { name: 'AMDAANI', logoUrl: '' },
      payment,
      storedata: storedata || {},
    };
  };

  const calculateGSTBreakdown = (cartItems, isIgst) => {
    const breakdown = {};

    cartItems.forEach(item => {
      const rate = Number(item.gstRate || 0);
      if (rate === 0) return;

      if (!breakdown[rate]) {
        breakdown[rate] = {
          taxableAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
        };
      }

      const taxable = Number(item.taxableValue || 0);
      const gstAmount = Number(item.gstAmount || 0);

      breakdown[rate].taxableAmount += taxable;

      if (isIgst) {
        breakdown[rate].igstAmount += gstAmount;
      } else {
        breakdown[rate].cgstAmount += gstAmount / 2;
        breakdown[rate].sgstAmount += gstAmount / 2;
      }
    });

    // Round values to 2 decimals for stability
    Object.keys(breakdown).forEach(r => {
      breakdown[r].taxableAmount = Number(
        breakdown[r].taxableAmount.toFixed(2),
      );
      breakdown[r].cgstAmount = Number(
        (breakdown[r].cgstAmount || 0).toFixed(2),
      );
      breakdown[r].sgstAmount = Number(
        (breakdown[r].sgstAmount || 0).toFixed(2),
      );
      breakdown[r].igstAmount = Number(
        (breakdown[r].igstAmount || 0).toFixed(2),
      );
    });

    return breakdown;
  };

  // Generate PDF using your invoice template
  const generatePDFContent = () => {
    const purchaseData = transformPurchaseToInvoiceData();
    if (!purchaseData) return '';

    // FORCE GST OFF FOR PURCHASE PREVIEW
    purchaseData.isGstInvoice = false;
    purchaseData.invoiceData.vendorHasGst = false;

    const htmlContent = generatePurchaseHTML(purchaseData, storedata);

    // Replace "Invoice" with "Purchase Invoice" in the template
    return htmlContent
      .replace(/Tax Invoice/g, 'Purchase Invoice')
      .replace(/Bill To:/g, 'Vendor Details:')
      .replace(/Invoice No:/g, 'Purchase No:')
      .replace(/Invoice Date:/g, 'Purchase Date:')
      .replace(/Invoice Time:/g, 'Purchase Time:');
  };

  // Download PDF function
  const downloadPDF = async () => {
    if (!purchase) return;

    try {
      setDownloading(true);

      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        showAlert(
          'Permission Denied',
          'Storage permission is required to download PDF files',
          'warning',
          [{ label: 'OK', onPress: () => setAlertVisible(false) }],
        );
        return;
      }

      const pdf = await RNHTMLtoPDF.convert({
        html: generatePDFContent(),
        fileName: `Purchase_Invoice_${purchase.invoiceNumber}_${Date.now()}`,
        base64: false,
      });

      const downloadsDir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;

      const finalPath = `${downloadsDir}/Purchase_Invoice_${purchase.invoiceNumber}.pdf`;

      await RNFS.copyFile(pdf.filePath, finalPath);

      // ✅ SAME BEHAVIOR AS PRODUCT REPORT
      try {
        await FileViewer.open(finalPath, { showOpenWithDialog: true });
      } catch (openErr) {
        console.warn('No PDF viewer:', openErr?.message);
        Alert.alert(
          'PDF Saved',
          'Invoice saved in Downloads folder, but no app is available to open it.',
        );
      }
    } catch (error) {
      console.error('PDF error:', error);
      Alert.alert('Error', 'Failed to generate or open PDF.');
    } finally {
      setDownloading(false);
    }
  };

  // Share PDF function
  const sharePDF = async () => {
    if (!purchase) return;

    try {
      setSharing(true);

      const pdf = await RNHTMLtoPDF.convert({
        html: generatePDFContent(),
        fileName: `Purchase_Invoice_${purchase.invoiceNumber}_${Date.now()}`,
        base64: false,
      });

      if (!pdf?.filePath) {
        Alert.alert('Error', 'Failed to generate PDF for sharing.');
        return;
      }

      await Share.open({
        url:
          Platform.OS === 'android' ? `file://${pdf.filePath}` : pdf.filePath,
        title: `Purchase Invoice #${purchase.invoiceNumber}`,
        message: `Purchase Invoice #${purchase.invoiceNumber}`,
        failOnCancel: false,
        type: 'application/pdf',
      });
    } catch (error) {
      console.error('Share PDF error:', error);
      Alert.alert('Error', 'Unable to share PDF.');
    } finally {
      setSharing(false);
    }
  };

  // Loading state
  if (loading && !purchase) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <Navbar title="Purchase Details" onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text
            variant="bodyMedium"
            style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}
          >
            Loading purchase details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <Navbar title="Purchase Details" onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <Icon
            name="alert-circle-outline"
            size={64}
            color={theme.colors.error}
          />
          <Text
            variant="bodyLarge"
            style={[styles.errorText, { color: theme.colors.error }]}
          >
            {error}
          </Text>
          <Button
            mode="contained"
            onPress={fetchPurchase}
            style={styles.retryButton}
          >
            Try Again
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state
  if (!purchase) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <Navbar title="Purchase Details" onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <Icon
            name="file-document-outline"
            size={64}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant="bodyLarge"
            style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}
          >
            No purchase data found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const {
    vendorName,
    vendorMobile,
    vendorAddress,
    vendorGstNumber,
    vendorPanNumber,
    vendorState,
    invoiceNumber,
    date,
    items = [],
    subTotal = 0,
    gstTotal = 0,
    isIgst = false,
    discountTotal = 0,
    roundOff = 0,
    grandTotal = 0,
    paymentStatus,
    paymentMethod,
    amountPaid = 0,
    amountDue = 0,
    paymentNote,
    status,
    edited,
  } = purchase;

  // Calculate totals
  const totalQuantity = items.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0,
  );

  const getStatusConfig = status => {
    const configs = {
      paid: { color: '#10B981', bgColor: '#D1FAE5', icon: 'check-circle' },
      partial: { color: '#F59E0B', bgColor: '#FEF3C7', icon: 'clock-alert' },
      pending: { color: '#EF4444', bgColor: '#FEE2E2', icon: 'alert-circle' },
    };
    return configs[status?.toLowerCase()] || configs.pending;
  };

  const statusConfig = getStatusConfig(paymentStatus);

  const baseBottom = 120;
  const fabSpacing = 56;

  const editFabBottom = baseBottom;
  const cancelFabBottom = editFabBottom + fabSpacing;

  const purchaseHTML = generatePDFContent();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <Navbar title="Purchase Details" onBack={() => navigation.goBack()} />

      <View style={{ flex: 1 }}>
        <WebView
          originWhitelist={['*']}
          source={{ html: purchaseHTML }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          scalesPageToFit
          style={{ flex: 1 }}
        />
      </View>

      {/* EDIT PURCHASE FAB */}
      {purchase?.status !== 'cancelled' && (
        <FAB
          size="small"
          icon="pencil"
          style={[
            styles.fab,
            { bottom: editFabBottom, backgroundColor: theme.colors.primary },
          ]}
          onPress={() => handleEdit(purchase)}
          color="white"
        />
      )}

      {/* CANCEL PURCHASE FAB */}
      {purchase?.status !== 'cancelled' && (
        <FAB
          size="small"
          icon="cancel"
          style={[
            styles.fab,
            { bottom: cancelFabBottom, backgroundColor: '#EF4444' },
          ]}
          onPress={() => setCancelAlertVisible(true)}
          color="white"
        />
      )}

      {/* FLOATING ACTION BUTTONS */}
      <Animated.View
        entering={smoothEnter(500, 700)}
        style={[
          styles.floatingButtons,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        {/* SHARE BUTTON - LEFT SIDE */}
        <Button
          mode="contained-tonal"
          icon={sharing ? '' : 'share-variant'}
          loading={sharing}
          onPress={sharePDF}
          disabled={sharing}
          style={styles.paperButton}
          contentStyle={styles.paperContent}
          labelStyle={styles.paperLabel}
        >
          {sharing ? 'Sharing...' : 'Share PDF'}
        </Button>

        {/* DOWNLOAD BUTTON - ALWAYS ON RIGHT SIDE */}
        <Button
          mode="contained"
          icon={downloading ? '' : 'download'}
          loading={downloading}
          onPress={downloadPDF}
          disabled={downloading}
          style={[
            styles.paperButton,
            { backgroundColor: theme.colors.primary },
          ]}
          contentStyle={styles.paperContent}
          labelStyle={[styles.paperLabel, { color: theme.colors.onPrimary }]}
        >
          {downloading ? 'Downloading...' : 'Download PDF'}
        </Button>
      </Animated.View>
      <CustomAlert
        visible={alertVisible}
        onDismiss={() => setAlertVisible(false)}
        title={alertData.title}
        message={alertData.message}
        type={alertData.type}
        icons={alertData.actions}
      />
      <CustomAlert
        visible={cancelAlertVisible}
        onDismiss={() => setCancelAlertVisible(false)}
        title="Cancel Purchase?"
        message="Are you sure you want to cancel this purchase?"
        type="warning"
        actions={[
          {
            label: 'No',
            mode: 'outlined',
            onPress: () => setCancelAlertVisible(false),
          },
          {
            label: 'Yes',
            mode: 'contained',
            onPress: () => {
              setCancelAlertVisible(false);
              cancelPurchase();
            },
          },
        ]}
      />
    </SafeAreaView>
  );
};

// ========== REUSABLE COMPONENTS ==========

const CompactRow = ({ icon, label, theme }) => (
  <View style={styles.compactRow}>
    <Icon name={icon} size={16} color={theme.colors.onSurfaceVariant} />
    <Text
      variant="bodyMedium"
      style={[styles.compactRowText, { color: theme.colors.onSurface }]}
      numberOfLines={2}
    >
      {label}
    </Text>
  </View>
);

const SummaryLine = ({
  label,
  value,
  theme,
  isNegative,
  showSign,
  signValue,
  iconName,
  iconColor,
}) => {
  const displayValue = signValue !== undefined ? signValue : value;
  const prefix =
    showSign && displayValue !== 0 ? (displayValue > 0 ? '+' : '') : '';

  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryRowLeft}>
        {iconName && (
          <Icon
            name={iconName}
            size={16}
            color={iconColor || theme.colors.onSurfaceVariant}
          />
        )}
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {label}
        </Text>
      </View>
      <Text
        variant="bodyMedium"
        style={[styles.summaryValue, { color: theme.colors.onSurface }]}
      >
        {prefix}
        {isNegative ? '-' : ''}₹{Math.abs(value)?.toFixed(2)}
      </Text>
    </View>
  );
};

const PaymentAmountLine = ({ icon, label, value, theme, valueColor }) => (
  <View style={styles.paymentRow}>
    <View style={styles.paymentRowLeft}>
      <Icon name={icon} size={18} color={theme.colors.onSurfaceVariant} />
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {label}
      </Text>
    </View>
    <Text
      variant="titleMedium"
      style={[
        styles.paymentValue,
        { color: valueColor || theme.colors.onSurface },
      ]}
    >
      ₹{value?.toFixed(2)}
    </Text>
  </View>
);

// ========== HELPER FUNCTIONS ==========

const getPaymentMethodIcon = method => {
  const icons = {
    cash: 'cash',
    card: 'credit-card',
    upi: 'qrcode-scan',
    bank: 'bank-transfer',
    cheque: 'checkbook',
    online: 'web',
  };
  return icons[method?.toLowerCase()] || 'cash';
};

// ========== STYLES ==========

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Extra padding for floating buttons
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    borderRadius: 8,
  },

  // Floating Action Buttons
  floatingButtons: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    fontWeight: '700',
    fontSize: 14,
  },

  // Header Card Styles
  headerCard: {
    margin: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceLabel: {
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  invoiceNumber: {
    fontWeight: '700',
  },
  statusBadges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  editedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editedText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  headerDivider: {
    marginVertical: 12,
  },
  totalSection: {
    alignItems: 'center',
    gap: 4,
  },
  grandTotalAmount: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  // Card Styles
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontWeight: '700',
    flex: 1,
  },
  itemCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  // Compact Grid
  compactGrid: {
    gap: 10,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactRowText: {
    flex: 1,
    lineHeight: 20,
  },

  // Enhanced Item Card Styles - Responsive
  itemsContainer: {
    gap: 0,
  },
  itemCard: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 12,
  },
  itemNameContainer: {
    flex: 1,
    flexShrink: 1,
    gap: 6,
  },
  itemNameText: {
    fontWeight: '600',
    lineHeight: 20,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  gstBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  gstBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  itemTotalAmount: {
    fontWeight: '800',
    flexShrink: 0,
    minWidth: 80,
    textAlign: 'right',
  },
  itemDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  itemDetailBox: {
    gap: 4,
  },
  itemDetailLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  itemDetailValue: {
    fontWeight: '600',
  },
  itemDetailDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  itemDivider: {
    marginHorizontal: 12,
  },

  // Enhanced Summary Styles
  summaryGrid: {
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  summaryValue: {
    fontWeight: '700',
    flexShrink: 0,
  },
  taxBreakdownContainer: {
    paddingLeft: 24,
    marginTop: -6,
    marginBottom: 4,
  },
  taxBreakdownText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  summaryDivider: {
    marginVertical: 8,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 4,
  },
  grandTotalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  grandTotalLabel: {
    fontWeight: '700',
  },
  grandTotalValue: {
    fontWeight: '800',
    flexShrink: 0,
  },

  // Payment Styles
  paymentGrid: {
    gap: 10,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  paymentRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  methodChip: {
    height: 30,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  paymentDivider: {
    marginVertical: 4,
  },
  paymentValue: {
    fontWeight: '700',
  },
  noteBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  noteText: {
    flex: 1,
    lineHeight: 18,
  },

  footer: {
    height: 16,
  },
  paperButton: {
    flex: 1,
    borderRadius: 12,
  },

  paperContent: {
    flexDirection: 'row-reverse', // icon right side
    height: 42,
  },

  paperLabel: {
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  fab: {
    position: 'absolute',
    right: 16,
    elevation: 6,
  },
});

export default PurchaseDetail;
