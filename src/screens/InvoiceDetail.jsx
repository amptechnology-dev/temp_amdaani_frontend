import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Linking,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import {
  Button,
  FAB,
  Icon,
  IconButton,
  Surface,
  useTheme,
} from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import RNPrint from 'react-native-print';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import { generateInvoiceHTML } from '../utils/invoiceTemplate';
import { generateThermalInvoiceHTML } from '../utils/generateThermalInvoiceHTML';
import { generateA5InvoiceHTML } from '../utils/generateA5InvoiceHTML';
import { Printer } from '../native/Printer';
import { printThermalInvoice } from '../utils/printThermal';
import { printThermalKOT } from '../utils/Printthermalkot';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Navbar from '../components/Navbar';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import api from '../utils/api';
import { useAuth, permissions } from '../context/AuthContext';
import Toast from 'react-native-toast-message';
import Sound from 'react-native-sound';
import CustomAlert from '../components/CustomAlert';

// ── A5 PDF dimensions (landscape) ──
const A5_PDF_WIDTH = 595;
const A5_PDF_HEIGHT = 420;

export default function InvoiceDetail() {
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useTheme();
  const { authState, subscription, hasPermission } = useAuth();
  const prvstoredata = authState?.user?.store;

  const { invoice: passedInvoice, invoiceId } = route.params || {};

  const [invoice, setInvoice] = useState(passedInvoice || null);
  const [loading, setLoading] = useState(!passedInvoice);
  const [printing, setPrinting] = useState(false);
  const [printingKOT, setPrintingKOT] = useState(false);
  const [printMode, setPrintMode] = useState(route.params?.printMode || null);
  const [cancelAlertVisible, setCancelAlertVisible] = useState(false);

  const webViewRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const planName = subscription?.planName || subscription?.plan?.name || '';
  const isFreePlan =
    planName?.toLowerCase() === 'free' && subscription?.status === 'active';

  const insets = useSafeAreaInsets();
  const { height } = Dimensions.get('window');

  const baseBottom = height < 700 ? 50 : 70;
  const bottomSafe = insets.bottom + 10;
  const fabSpacing = 50;
  const isWhatsAppVisible = !!invoice?.customerMobile;

  const whatsappFabBottom = baseBottom + bottomSafe;
  const downloadFabBottom = isWhatsAppVisible
    ? whatsappFabBottom + fabSpacing
    : whatsappFabBottom;
  const shareFabBottom = isWhatsAppVisible
    ? downloadFabBottom + fabSpacing
    : whatsappFabBottom + fabSpacing;
  const cancelFabBottom = shareFabBottom + fabSpacing;

  // ── Load print mode preference ──────────────────────────────────────────────
  useEffect(() => {
    const loadPreference = async () => {
      if (!printMode) {
        const savedMode = await AsyncStorage.getItem('printMode');
        setPrintMode(savedMode || 'a4');
      }
    };
    loadPreference();
  }, []);

  // ── Permission check ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasPermission(permissions.CAN_VIEW_INVOICES)) {
      Toast.show({
        type: 'error',
        text1: 'Permission Denied',
        text2: 'You do not have permission to view invoices.',
      });
      navigation.goBack();
    }
  }, [hasPermission, navigation]);

  // ── Fetch invoice if not passed ─────────────────────────────────────────────
  const fetchInvoice = useCallback(async () => {
    if (!invoiceId && !invoice?._id) return;
    try {
      setLoading(true);
      const idToFetch = invoiceId || invoice._id;
      const res = await api.get(`/invoice/id/${idToFetch}`);
      if (res?.success && res?.data) {
        setInvoice(res.data);
      } else {
        console.warn('Invoice not found or API response invalid');
      }
    } catch (err) {
      console.error('Fetch invoice error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [invoiceId, invoice?._id]);

  useEffect(() => {
    if (!invoice && invoiceId) {
      fetchInvoice();
    }
  }, [invoice, invoiceId, fetchInvoice]);

  // ── Effective store data ────────────────────────────────────────────────────
  const effectiveStoredata = useMemo(() => {
    if (!invoice) return prvstoredata || {};
    const hasEmbeddedStoreData = !!invoice?.name;
    if (hasEmbeddedStoreData) {
      return {
        ...prvstoredata,
        name: invoice.name,
        tagline: invoice.tagline ?? prvstoredata?.tagline,
        ownershipType: invoice.ownershipType ?? prvstoredata?.ownershipType,
        gstNumber: invoice.gstNumber ?? prvstoredata?.gstNumber,
        panNumber: invoice.panNumber ?? prvstoredata?.panNumber,
        registrationNo: invoice.registrationNo ?? prvstoredata?.registrationNo,
        contactNo: invoice.contactNo ?? prvstoredata?.contactNo,
        email: invoice.email ?? prvstoredata?.email,
        address: invoice.address ?? prvstoredata?.address,
        bankDetails: invoice.bankDetails ?? prvstoredata?.bankDetails,
        settings: invoice.settings ?? prvstoredata?.settings,
        logoUrl: invoice.logoUrl ?? prvstoredata?.logoUrl,
        signatureUrl: invoice.signatureUrl ?? prvstoredata?.signatureUrl,
        isActive: invoice.isActive ?? prvstoredata?.isActive,
      };
    }
    return prvstoredata || {};
  }, [invoice, prvstoredata]);

  // ── All computed invoice values in one memo ─────────────────────────────────
  const invoiceComputed = useMemo(() => {
    if (!invoice || !invoice.items) {
      return null;
    }

    const isGstInvoice = (invoice?.type || 'gst') !== 'non-gst';
    let subtotal = 0;
    let totalTax = 0;

    const enrichedItems = invoice.items.map(item => {
      const gstRate = Number(item.gstRate || 0);
      const qty = Number(item.quantity || 0);
      const sellingPriceRaw = Number(item.sellingPrice || 0);
      const discount = Number(item.discountPrice ?? item.discount ?? 0);
      const sellingPrice = Math.max(0, sellingPriceRaw - discount);

      let baseRate = 0;
      let taxableValue = 0;
      let gstAmount = 0;
      let totalAmount = 0;

      if (isGstInvoice) {
        if (item.isTaxInclusive) {
          baseRate = sellingPriceRaw / (1 + gstRate / 100);
          taxableValue = (sellingPrice / (1 + gstRate / 100)) * qty;
          gstAmount = taxableValue * (gstRate / 100);
          totalAmount = sellingPrice * qty;
        } else {
          baseRate = sellingPriceRaw;
          taxableValue = sellingPrice * qty;
          gstAmount = taxableValue * (gstRate / 100);
          totalAmount = taxableValue + gstAmount;
        }
      } else {
        baseRate = sellingPriceRaw;
        taxableValue = sellingPrice * qty;
        gstAmount = 0;
        totalAmount = taxableValue;
      }

      subtotal += totalAmount;
      totalTax += gstAmount;

      return {
        ...item,
        baseRate,
        taxableValue,
        gstAmount,
        total: totalAmount,
        discountApplied: discount,
      };
    });

    const grandTotalRaw = enrichedItems.reduce((sum, i) => sum + i.total, 0);
    const discountTotal = invoice?.discountTotal || 0;
    const netTotal = Math.round(grandTotalRaw - discountTotal);

    const gstBreakdown = {};
    if (isGstInvoice) {
      enrichedItems.forEach(item => {
        const gstRate = Number(item.gstRate || 0);
        const gstAmount = item.gstAmount;
        const cgstAmount = gstAmount / 2;
        const sgstAmount = gstAmount / 2;

        if (!gstBreakdown[gstRate]) {
          gstBreakdown[gstRate] = {
            taxableAmount: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            totalGst: 0,
          };
        }

        gstBreakdown[gstRate].taxableAmount += item.taxableValue;
        gstBreakdown[gstRate].cgstAmount += cgstAmount;
        gstBreakdown[gstRate].sgstAmount += sgstAmount;
        gstBreakdown[gstRate].igstAmount += 0;
        gstBreakdown[gstRate].totalGst += gstAmount;
      });
    }

    const paidAmount = Number(invoice.amountPaid || 0);
    const grandTotal = Number(Math.round(invoice.grandTotal || 0));
    const dueAmount = Number(invoice.amountDue || 0);
    const paymentStatus = invoice?.paymentStatus || 0;

    return {
      isGstInvoice,
      enrichedItems,
      subtotal,
      totalTax,
      grandTotalRaw,
      discountTotal,
      netTotal,
      gstBreakdown,
      paidAmount,
      grandTotal,
      dueAmount,
      paymentStatus,
    };
  }, [invoice]);

  // ── Generate HTML in a memo so WebView re-renders only when needed ──────────
  const html = useMemo(() => {
    if (!invoice || !invoiceComputed || !printMode) return '';

    const {
      isGstInvoice,
      enrichedItems,
      subtotal,
      grandTotalRaw,
      discountTotal,
      netTotal,
      gstBreakdown,
      paidAmount,
      dueAmount,
    } = invoiceComputed;

    const baseArgs = {
      preview: false, // ← add this
      createdInvoice: true,
      invoiceData: invoice,
      appBrand: { name: 'AMDAANI', logoUrl: '' },
      formValues: {
        customerName: invoice.customerName,
        contactNumber: invoice.customerMobile,
        customerAddress: invoice.customerAddress || '',
        customerGstNumber: invoice.customerGstNumber || '',
      },
      cartItems: enrichedItems,
      invoiceCalculations: {
        subtotal,
        totalTax: invoice.gstTotal,
        discountTotal: discountTotal,
        grandTotal: grandTotalRaw,
        netTotal,
        grandTotalRaw,
        gstBreakdown: isGstInvoice ? gstBreakdown : {},
      },
      invoiceNumber: invoice.invoiceNumber,
      currentDate: new Date(invoice.invoiceDate).toLocaleDateString('en-IN'),
      currentTime: new Date(invoice.invoiceDate).toLocaleTimeString('en-IN', {
        hour12: false,
      }),
      invoiceDate: invoice.invoiceDate,
      storedata: effectiveStoredata,
      isGstInvoice,
      isFreePlan,
      payment: {
        paid: paidAmount,
        due: dueAmount,
        status: invoice.paymentStatus || 'unpaid',
      },
    };

    try {
      if (printMode === 'thermal') {
        return generateThermalInvoiceHTML(baseArgs);
      }
      if (printMode === 'a5') {
        return generateA5InvoiceHTML(baseArgs);
      }
      // Default: A4
      return generateInvoiceHTML({
        ...baseArgs,
        invoiceCalculations: {
          ...baseArgs.invoiceCalculations,
          totalQuantity: (invoice.items ?? []).reduce(
            (sum, i) => sum + (i.quantity || 0),
            0,
          ),
          itemCount: (invoice.items ?? []).length,
        },
      });
    } catch (err) {
      console.error('HTML generation error:', err);
      return '';
    }
  }, [invoice, invoiceComputed, printMode, effectiveStoredata, isFreePlan]);

  // ── Helper: PDF convert options ─────────────────────────────────────────────
  const getPdfOptions = fileName => ({
    html,
    fileName,
    base64: false,
    ...(printMode === 'a5' && {
      width: A5_PDF_WIDTH,
      height: A5_PDF_HEIGHT,
    }),
  });

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Navbar title="Invoice Detail" />
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Button loading={true}>Loading Invoice...</Button>
        </View>
      </SafeAreaView>
    );
  }

  // ── No invoice found ────────────────────────────────────────────────────────
  if (!invoice) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Navbar title="Invoice Detail" />
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Button onPress={fetchInvoice}>
            Invoice not found. Tap to retry.
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // ── Invoice data not yet computed (items missing) ───────────────────────────
  if (!invoiceComputed) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Navbar title="Invoice Detail" />
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Button onPress={fetchInvoice}>
            Invalid invoice data. Tap to reload.
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // ── HTML not yet generated (printMode still loading from AsyncStorage) ──────
  if (!html) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Navbar title="Invoice Detail" />
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Button loading={true}>Preparing invoice...</Button>
        </View>
      </SafeAreaView>
    );
  }

  const {
    enrichedItems,
    gstBreakdown,
    isGstInvoice,
    paidAmount,
    dueAmount,
    paymentStatus,
  } = invoiceComputed;

  // ── Actions ─────────────────────────────────────────────────────────────────
  const cancelInvoice = async () => {
    try {
      const res = await api.put(`/invoice/status/${invoice._id}`, {
        status: 'cancelled',
      });
      if (res.success) {
        setInvoice(res.data);
        Toast.show({ type: 'success', text1: res.message });
      } else {
        Toast.show({ type: 'error', text1: 'Failed to cancel invoice' });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error canceling invoice',
        text2: error.message,
      });
    }
  };

  const handlePrint = async () => {
    if (printMode === 'thermal') {
      try {
        setPrinting(true);
        const connected = await Printer.ensureConnected();
        if (!connected) {
          Toast.show({
            type: 'error',
            text1: 'Printer not connected',
            text2:
              'Trying to reconnect failed — please select your printer again',
          });
          navigation.navigate('PrintPreference', {
            invoice,
            store: effectiveStoredata,
          });
          return;
        }
        await printThermalInvoice(
          invoice,
          paidAmount,
          dueAmount,
          paymentStatus,
          gstBreakdown,
          enrichedItems,
          isFreePlan,
          effectiveStoredata,
        );
        Toast.show({ type: 'success', text1: 'Print successful' });
      } catch (err) {
        console.error('Thermal print error:', err);
        Toast.show({
          type: 'error',
          text1: 'Print failed',
          text2: err.message || 'Unknown error',
        });
        navigation.navigate('PrintPreference', {
          invoice,
          store: effectiveStoredata,
        });
      } finally {
        setPrinting(false);
      }
    } else {
      try {
        await RNPrint.print({ html });
      } catch (err) {
        Toast.show({ type: 'error', text1: 'A4 Print error' });
      }
    }
  };

  const handlePrintKOT = async () => {
    try {
      setPrintingKOT(true);
      const connected = await Printer.ensureConnected();
      if (!connected) {
        Toast.show({
          type: 'error',
          text1: 'Printer not connected',
          text2:
            'Trying to reconnect failed — please select your printer again',
        });
        navigation.navigate('PrintPreference', {
          invoice,
          store: effectiveStoredata,
        });
        return;
      }
      await printThermalKOT(invoice, invoice.items, effectiveStoredata);
      Toast.show({ type: 'success', text1: 'KOT printed' });
    } catch (err) {
      console.error('KOT print error:', err);
      Toast.show({
        type: 'error',
        text1: 'KOT print failed',
        text2: err.message || 'Unknown error',
      });
    } finally {
      setPrintingKOT(false);
    }
  };

  const handleShare = async () => {
    try {
      const file = await RNHTMLtoPDF.convert(
        getPdfOptions(`invoice-${invoice.invoiceNumber}`),
      );
      await Share.open({
        url: `file://${file.filePath}`,
        type: 'application/pdf',
        failOnCancel: false,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleDownload = async () => {
    try {
      const file = await RNHTMLtoPDF.convert(
        getPdfOptions(`invoice-${invoice.invoiceNumber}`),
      );
      Toast.show({
        type: 'success',
        text1: 'Invoice downloaded',
        text2: file.filePath,
      });
    } catch (err) {
      console.error('Download error:', err);
      Toast.show({
        type: 'error',
        text1: 'Download failed',
        text2: err.message || 'Unable to save invoice.',
      });
    }
  };

  const handleWhatsAppShare = async () => {
    try {
      const file = await RNHTMLtoPDF.convert(
        getPdfOptions(`invoice-${invoice.invoiceNumber}`),
      );
      const pdfPath = file.filePath;

      let isInstalled = false;
      let wpBusiness = false;

      if (Platform.OS === 'android') {
        const wp = await Share.isPackageInstalled('com.whatsapp');
        const wpB = await Share.isPackageInstalled('com.whatsapp.w4b');
        isInstalled = wp.isInstalled || wpB.isInstalled;
        wpBusiness = wpB.isInstalled;
      } else if (Platform.OS === 'ios') {
        const wpIOS = await Share.isPackageInstalled('whatsapp');
        isInstalled = wpIOS.isInstalled;
      }

      if (!isInstalled) {
        Toast.show({
          type: 'error',
          text1: 'WhatsApp not installed',
          text2: 'Please install WhatsApp to share the invoice.',
        });
        return;
      }

      const phoneNumber = invoice?.customerMobile?.trim() || '';
      const message = `Hello ${
        invoice.customerName || 'Customer'
      }, \nHere is your invoice #${
        invoice.invoiceNumber
      }.\nThank you for your business!\nTotal Amount: ₹${
        invoice?.grandTotal || '0'
      }`;

      await Share.shareSingle({
        url: `file://${pdfPath}`,
        type: 'application/pdf',
        social: wpBusiness
          ? Share.Social.WHATSAPPBUSINESS
          : Share.Social.WHATSAPP,
        whatsAppNumber: `91${phoneNumber}`,
        message,
      });

      Toast.show({
        type: 'success',
        text1: 'Sent successfully',
        text2: 'Invoice shared with customer on WhatsApp',
      });
    } catch (err) {
      console.error('WhatsApp share error:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to send on WhatsApp',
        text2: err.message || 'Something went wrong while sharing.',
      });
    }
  };

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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar
        title="Invoice Detail"
        rightComponent={
          (invoice?.transactions?.length > 0 && (
            <IconButton
              icon="receipt-text-check-outline"
              size={24}
              onPress={() =>
                navigation.navigate('InvoiceTransactions', {
                  invoice,
                  onInvoiceUpdated: fetchInvoice,
                })
              }
            />
          )) ||
          null
        }
      />

      <View
        style={[
          styles.previewContainer,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <WebView
          ref={webViewRef}
          showsVerticalScrollIndicator={false}
          source={{ html }}
          style={styles.webview}
          scalesPageToFit={true}
          startInLoadingState={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="compatibility"
          originWhitelist={['*']}
          injectedJavaScript={
            printMode === 'a5'
              ? `
                (function() {
                  var screenW = window.innerWidth;
                  var contentW = document.body.scrollWidth;
                  if (contentW > screenW) {
                    var scale = screenW / contentW;
                    document.body.style.transformOrigin = '0 0';
                    document.body.style.transform = 'scale(' + scale + ')';
                    document.body.style.width = (100 / scale) + '%';
                  }
                })();
                true;
              `
              : undefined
          }
        />

        <View style={styles.zoomControls}>
          <TouchableOpacity
            onPress={handleZoomIn}
            activeOpacity={0.8}
            style={styles.zoomButton}
          >
            <Icon
              source="magnify-plus-outline"
              size={26}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleZoomOut}
            activeOpacity={0.8}
            style={styles.zoomButton}
          >
            <Icon
              source="magnify-minus-outline"
              size={26}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Surface
        elevation={8}
        style={[styles.footer, { backgroundColor: theme.colors.surface }]}
      >
        <Button
          mode="outlined"
          icon={'tune'}
          onPress={() =>
            navigation.push('PrintPreference', {
              invoice,
              onPrinterSelected: async payload => {
                try {
                  if (payload?.mode === 'a4') {
                    setPrintMode('a4');
                    await AsyncStorage.setItem('printMode', 'a4');
                    await AsyncStorage.removeItem('selectedPrinter');
                  } else if (payload?.mode === 'a5') {
                    setPrintMode('a5');
                    await AsyncStorage.setItem('printMode', 'a5');
                    await AsyncStorage.removeItem('selectedPrinter');
                  } else if (payload?.mode === 'thermal') {
                    setPrintMode('thermal');
                    await AsyncStorage.setItem('printMode', 'thermal');
                    if (payload?.selectedPrinter) {
                      await AsyncStorage.setItem(
                        'selectedPrinter',
                        JSON.stringify(payload.selectedPrinter),
                      );
                    }
                  }
                } catch (e) {
                  console.error('Save print mode error:', e);
                }
              },
            })
          }
          style={[styles.actionButton]}
        >
          Print Preference
        </Button>

        {invoice?.status === 'active' &&
          hasPermission(permissions.CAN_EDIT_INVOICES) && (
            <Button
              mode="outlined"
              icon={'pencil'}
              onPress={() =>
                navigation.replace('NewSale', {
                  mode: 'edit',
                  invoiceData: invoice,
                })
              }
              style={[styles.actionButton]}
            >
              Edit
            </Button>
          )}

        <Button
          elevation={4}
          mode="contained"
          icon={'printer'}
          loading={printing}
          disabled={printing}
          onPress={handlePrint}
          style={[styles.actionButton]}
        >
          {printing ? 'Printing...' : 'Print'}
        </Button>

        {printMode === 'thermal' && (
          <Button
            mode="contained"
            icon={'printer'}
            loading={printingKOT}
            disabled={printingKOT}
            onPress={handlePrintKOT}
            style={[styles.actionButton]}
          >
            {printingKOT ? 'Printing...' : 'Print Order Copy'}
          </Button>
        )}
      </Surface>

      {invoice?.status === 'active' &&
        hasPermission(permissions.CAN_CANCEL_INVOICES) && (
          <FAB
            size="small"
            icon="cancel"
            style={[
              styles.fab,
              { bottom: cancelFabBottom, backgroundColor: 'red' },
            ]}
            onPress={() => setCancelAlertVisible(true)}
            color="white"
          />
        )}

      {invoice?.customerMobile && (
        <FAB
          size="small"
          icon="whatsapp"
          style={[
            styles.fabWhatsApp,
            { backgroundColor: '#25D366', bottom: whatsappFabBottom },
          ]}
          onPress={handleWhatsAppShare}
          color="white"
        />
      )}

      <FAB
        size="small"
        icon="download"
        style={[
          styles.fab,
          { backgroundColor: theme.colors.surface, bottom: downloadFabBottom },
        ]}
        onPress={handleDownload}
        color={theme.colors.onSurface}
      />

      <FAB
        size="small"
        variant="primary"
        icon="share-variant"
        style={[
          styles.fab,
          { backgroundColor: theme.colors.surface, bottom: shareFabBottom },
        ]}
        onPress={handleShare}
        color={theme.colors.onSurface}
      />

      <CustomAlert
        visible={cancelAlertVisible}
        onDismiss={() => setCancelAlertVisible(false)}
        title="Cancel Invoice?"
        message="Are you sure you want to cancel this invoice?"
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
              cancelInvoice();
            },
          },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  previewContainer: {
    flex: 1,
    margin: 8,
    elevation: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  webview: { flex: 1, backgroundColor: 'white' },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 12,
    gap: 8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  actionButton: { flexBasis: '47%', marginHorizontal: 0 },
  fab: { position: 'absolute', marginHorizontal: 16, right: 0 },
  fabWhatsApp: { position: 'absolute', marginHorizontal: 16, right: 0 },
  zoomControls: {
    position: 'absolute',
    bottom: 25,
    left: 20,
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
