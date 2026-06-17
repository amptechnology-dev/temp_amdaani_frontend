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

import { generatePurchaseHTML } from '../utils/purchaseTemplate';
import { useAuth } from '../context/AuthContext';
import CustomAlert from '../components/CustomAlert';

const smoothEnter = (delay = 0, duration = 650) =>
  SlideInDown.duration(duration)
    .delay(delay)
    .easing(Easing.bezier(0.22, 1, 0.36, 1));

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/purchase/id/${purchaseId}`);
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
    setTimeout(() => {
      fetchPurchase();
    }, 100);
  }, [purchaseId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPurchase().finally(() => setRefreshing(false));
  }, [purchaseId]);

  const handleEdit = () => {
    setMenuVisible(false);
    navigation.navigate('Purchase', {
      mode: 'edit',
      purchaseData: purchase,
    });
  };

  const cancelPurchase = async () => {
    try {
      setLoading(true);
      const res = await api.put(`/purchase/status/${purchase._id}`, {
        status: 'cancelled',
      });
      if (res?.success) {
        console.log('re', res);
        await fetchPurchase();
        showAlert(
          'Purchase Cancelled',
          'This Purchase has been cancelled successfully.',
          'success',
          [{ label: 'OK', onPress: () => setAlertVisible(false) }],
        );
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
    return true;
  };

  // ─── Core: transform purchase DB data into generatePurchaseHTML props ───────
  // Mirrors exactly the same calculation logic as Purchase.jsx invoiceCalculations
  const transformPurchaseToInvoiceData = () => {
    if (!purchase) return null;

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
      isIgst = false,
      roundOff = 0,
      paymentStatus,
      paymentMethod,
      amountPaid = 0,
      amountDue = 0,
      paymentNote,
      subTotal = 0,
      gstTotal = 0,
      discountTotal = 0,
      grandTotal = 0,
    } = purchase;

    const vendorHasGst = !!(
      vendorGstNumber && String(vendorGstNumber).trim().length > 0
    );

    // ── Step 1: Build cartItems trusting DB stored computed values ───────────
    // Same field mapping as Purchase.jsx invoiceCalculations useMemo
    let subtotal = 0;
    let totalTax = 0;

    // ✅ gstBreakdown is ALWAYS built when any item has gstRate > 0
    // regardless of vendorHasGst — so Tax Summary always shows in the PDF
    const gstBreakdown = {};

    const cartItems = items.map(item => {
      const qty = Number(item.quantity ?? 0);
      const rawCostPrice = Number(item.costPrice ?? item.rate ?? 0);

      // purchaseDiscount in DB is always stored as flat ₹ amount (fixed in createPurchase)
      const purchaseDiscount = Number(item.purchaseDiscount ?? 0);
      const netRate = Math.max(0, rawCostPrice - purchaseDiscount);
      const gstRate = Number(item.gstRate ?? 0);
      const isPurchaseTaxInclusive = Boolean(
        item.isPurchaseTaxInclusive ?? false,
      );

      // ── Trust DB computed values — same as what was saved by createPurchase ──
      const baseRate = Number(
        item.baseRate ??
          (isPurchaseTaxInclusive && gstRate > 0
            ? netRate / (1 + gstRate / 100)
            : netRate),
      );
      const taxableValue = Number(item.taxableValue ?? baseRate * qty);
      const gstAmount = Number(
        item.gstAmount ?? taxableValue * (gstRate / 100),
      );
      const totalAmount = Number(
        item.total ??
          (isPurchaseTaxInclusive ? netRate * qty : taxableValue + gstAmount),
      );

      subtotal += taxableValue;
      totalTax += gstAmount;

      // ── GST breakdown — built for ALL items with gstRate > 0 ──────────────
      // ✅ KEY FIX: do NOT gate on vendorHasGst here.
      // The tax summary in generatePurchaseHTML checks gstBreakdown keys,
      // so we must populate it whenever any item has a non-zero gstRate.
      if (gstRate > 0) {
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
        // ── Identity ──────────────────────────────────────────────────────────
        name: item.name,
        hsn: item.hsn ?? '',
        unit: item.unit ?? 'Piece',
        mrp: Number(item.mrp ?? 0),

        // ── Price fields — all aliases generatePurchaseHTML reads ─────────────
        costPrice: rawCostPrice,
        price: rawCostPrice,
        rate: rawCostPrice,
        purchaseDiscount: purchaseDiscount,
        discount: purchaseDiscount,

        // ── Tax ───────────────────────────────────────────────────────────────
        gstRate,
        isPurchaseTaxInclusive,
        isTaxInclusive: isPurchaseTaxInclusive,

        // ── Computed values — trusted from DB ─────────────────────────────────
        baseRate,
        taxableValue,
        gstAmount,
        total: Number(totalAmount.toFixed(4)),

        // ── Quantity ──────────────────────────────────────────────────────────
        qty,
        quantity: qty,
      };
    });

    // ── Step 2: invoiceCalculations — same shape as Purchase.jsx useMemo ─────
    const grandTotalRaw = subtotal + totalTax;
    const netTotal = grandTotalRaw - Number(discountTotal);
    const roundedTotal = Math.round(netTotal);
    const computedRoundOff = Number((roundedTotal - netTotal).toFixed(2));

    // ✅ Always pass the full gstBreakdown — Tax Summary visibility is controlled
    // inside generatePurchaseHTML by checking Object.keys(gstBreakdown).some(r > 0)
    const invoiceCalculations = {
      subtotal,
      totalTax,
      grandTotal: grandTotalRaw,
      grandTotalRaw,
      netTotal,
      roundedTotal,
      roundOff: Number(roundOff ?? computedRoundOff),
      discountTotal: Number(discountTotal),
      gstBreakdown, // ✅ always full, never {}
      computedItems: cartItems,
      itemCount: cartItems.length,
      totalQuantity: cartItems.reduce((s, i) => s + i.qty, 0),
    };

    // ── Step 3: formValues — all keys generatePurchaseHTML reads ─────────────
    const formValues = {
      vendorName,
      vendorNumber: vendorMobile,
      contactNumber: vendorMobile,
      customerName: vendorName,
      partyName: vendorName,
      address: vendorAddress,
      customerAddress: vendorAddress,
      state: vendorState,
      customerState: vendorState,
      postalCode: vendorPostalCode,
      customerPostalCode: vendorPostalCode,
      gstNumber: vendorGstNumber,
      customerGstNumber: vendorGstNumber,
    };

    // ── Step 4: payment ───────────────────────────────────────────────────────
    const payment = {
      paid: Number(amountPaid ?? 0),
      due: Number(amountDue ?? 0),
      status: paymentStatus ?? 'unpaid',
    };

    // ── Step 5: invoiceData for createdInvoice=true path ─────────────────────
    const invoiceData = {
      ...purchase,
      isIgst,
      subTotal: Number(subTotal ?? subtotal),
      gstTotal: Number(gstTotal ?? totalTax),
      discountTotal: Number(discountTotal),
      roundOff: Number(roundOff ?? computedRoundOff),
      grandTotal: Number(grandTotal ?? roundedTotal),
      paymentMethod,
      paymentNote,
      vendorHasGst,
      status: purchase.status,
    };

    return {
      preview: false, // ✅ false = Tax Summary will render
      createdInvoice: true,
      invoiceData,
      formValues,
      cartItems,
      invoiceCalculations,
      invoiceNumber,
      invoiceDate: new Date(date),
      currentDate: new Date(),
      currentTime: format(new Date(), 'HH:mm:ss'),
      isGstInvoice: vendorHasGst,
      isFreePlan: true,
      appBrand: { name: 'AMDAANI', logoUrl: '' },
      payment,
      storedata: storedata || {},
    };
  };

  // ─── Generate HTML for WebView / PDF ─────────────────────────────────────
  const generatePDFContent = () => {
    const purchaseData = transformPurchaseToInvoiceData();
    if (!purchaseData) return '';
    // ✅ No overrides — vendorHasGst and gstBreakdown drive everything
    return generatePurchaseHTML(purchaseData);
  };

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

  // ─── Loading state ────────────────────────────────────────────────────────
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

  // ─── Error state ──────────────────────────────────────────────────────────
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

  // ─── Empty state ──────────────────────────────────────────────────────────
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

  const purchaseHTML = generatePDFContent();

  const baseBottom = 120;
  const fabSpacing = 56;
  const editFabBottom = baseBottom;
  const cancelFabBottom = editFabBottom + fabSpacing;

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
          onPress={() => handleEdit()}
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
        actions={alertData.actions}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  paperButton: {
    flex: 1,
    borderRadius: 12,
  },
  paperContent: {
    flexDirection: 'row-reverse',
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
