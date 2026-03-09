import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Platform, Linking, Dimensions, TouchableOpacity } from 'react-native';
import { Button, FAB, Icon, IconButton, Surface, useTheme } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import RNPrint from 'react-native-print';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import { generateInvoiceHTML } from '../utils/invoiceTemplate';
import { generateThermalInvoiceHTML } from '../utils/generateThermalInvoiceHTML';
import { Printer } from '../native/Printer';
import { printThermalInvoice } from '../utils/printThermal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Navbar from '../components/Navbar';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Toast from 'react-native-toast-message';
import Sound from 'react-native-sound';
import CustomAlert from '../components/CustomAlert';

export default function InvoiceDetail() {
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useTheme();
  const { authState, subscription } = useAuth();
  const storedata = authState?.user?.store;
  // console.log('Store data:', storedata);

  // // console.log('Store data: ', storedata);
  // console.log('Subcription data: ', subscription);

  const { invoice: passedInvoice, invoiceId } = route.params || {};

  const [invoice, setInvoice] = useState(passedInvoice || null);
  const [loading, setLoading] = useState(!passedInvoice);
  const [printing, setPrinting] = useState(false);
  const [printMode, setPrintMode] = useState(route.params?.printMode || null);
  const [printSound, setPrintSound] = useState(null);

  const [cancelAlertVisible, setCancelAlertVisible] = useState(false);

  const webViewRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const planName = subscription?.planName || subscription?.plan?.name || ''; // robust lookup [3]
  const isFreePlan =
    planName?.toLowerCase() === 'free' && subscription?.status === 'active'; // strict check [3]

  const insets = useSafeAreaInsets();
  const { height } = Dimensions.get('window');

  // base offset depending on screen size
  const baseBottom = height < 700 ? 50 : 70;

  // respect safe area padding (for notched devices)
  const bottomSafe = insets.bottom + 10;

  // spacing between FABs
  const fabSpacing = 50;

  // if WhatsApp FAB is visible, push Share FAB above it
  const isWhatsAppVisible = !!invoice?.customerMobile;

  const whatsappFabBottom = baseBottom + bottomSafe;
  const shareFabBottom = isWhatsAppVisible
    ? whatsappFabBottom + fabSpacing
    : whatsappFabBottom;
  const cancelFabBottom = shareFabBottom + fabSpacing;
  useEffect(() => {
    const loadPreference = async () => {
      if (!printMode) {
        const savedMode = await AsyncStorage.getItem('printMode');
        setPrintMode(savedMode || 'a4'); // fallback default
      }
    };
    loadPreference();
  }, []);

  // useEffect(() => {
  //     Sound.setCategory('Playback');

  //     const sound = new Sound('print.mp3', Sound.MAIN_BUNDLE, (error) => {
  //         if (error) {
  //             // console.log('Failed to load sound', error);
  //             return;
  //         }
  //     });

  //     setPrintSound(sound);

  //     return () => {
  //         if (sound) {
  //             sound.release();
  //         }
  //     };
  // }, []);

  const fetchInvoice = useCallback(async () => {
    if (!invoiceId && !invoice?._id) return;
    try {
      setLoading(true);
      const idToFetch = invoiceId || invoice._id;
      const res = await api.get(`/invoice/id/${idToFetch}`);
      // console.log('Invoice response:', res);
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

  // call it on mount if needed
  useEffect(() => {
    if (!invoice && invoiceId) {
      fetchInvoice();
    }
  }, [invoice, invoiceId, fetchInvoice]);

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Navbar title="Invoice Detail" />
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Button loading={true}>
            {!invoice ? 'Loading Invoice...' : 'Invoice not found'}
          </Button>
        </View>
      </SafeAreaView>
    );
  }
  const isGstInvoice = (invoice?.type || 'gst') !== 'non-gst';
  let subtotal = 0;
  let totalTax = 0;
  const enrichedItems = invoice?.items?.map(item => {
    const gstRate = Number(item.gstRate || 0);
    const qty = Number(item.quantity || 0);
    const sellingPriceRaw = Number(item.sellingPrice || 0);
    const discount = Number(item.discountPrice ?? item.discount ?? 0);

    // 🧮 Apply discount before GST (and prevent negative price)
    const sellingPrice = Math.max(0, sellingPriceRaw - discount);

    let baseRate = 0;
    let taxableValue = 0;
    let gstAmount = 0;
    let totalAmount = 0;

    if (isGstInvoice) {
      if (item.isTaxInclusive) {
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
    } else {
      // Non-GST invoice: just apply discount, no tax
      baseRate = sellingPriceRaw;
      taxableValue = sellingPrice * qty;
      gstAmount = 0;
      totalAmount = taxableValue;
    }

    // if (item.isTaxInclusive) {
    //   subtotal += totalAmount - gstAmount; // extract taxable part
    // } else {
    //   subtotal += taxableValue;
    // }
    subtotal += totalAmount;
    totalTax += gstAmount;
    return {
      ...item,
      baseRate,
      subtotal,
      taxableValue,
      gstAmount,
      total: totalAmount,
      discountApplied: discount, // ✅ helpful for PDF preview
    };
  });

  // Recalculate grand total with discounts included
  const grandTotalRaw = enrichedItems.reduce((sum, i) => sum + i.total, 0);
  const roundedTotal = Math.round(grandTotalRaw);
  const discountTotal = invoice?.discountTotal || 0;
  const netTotal = Math.round(grandTotalRaw - discountTotal);
  // ✅ Build GST breakdown from enriched items
  const gstBreakdown = {};

  if (isGstInvoice) {
    enrichedItems.forEach(item => {
      const gstRate = Number(item.gstRate || 0);
      const taxableValue = item.taxableValue;
      const gstAmount = item.gstAmount;
      const cgstAmount = gstAmount / 2;
      const sgstAmount = gstAmount / 2;
      const igstAmount = 0;

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
    });
  }
  const paidAmount = Number(invoice.amountPaid || 0);
  const grandTotal = Number(Math.round(invoice.grandTotal || 0));
  const dueAmount = Number(invoice.amountDue || 0);
  // const dueAmount = Math.max(0, grandTotal - paidAmount);
  const paymentStatus = invoice?.paymentStatus || 0;

  const html =
    printMode === 'thermal'
      ? generateThermalInvoiceHTML({
        createdInvoice: true,
        invoiceData: invoice,
        formValues: {
          customerName: invoice.customerName,
          contactNumber: invoice.customerMobile,
          customerAddress: invoice.customerAddress || '',
          customerGstNumber: invoice.customerGstNumber || '',
        },
        cartItems: enrichedItems,
        invoiceCalculations: {
          subtotal: subtotal,
          totalTax: invoice.gstTotal,
          discountTotal: invoice.discountTotal || 0,
          grandTotal: grandTotalRaw,
          netTotal,
          grandTotalRaw,
          gstBreakdown: isGstInvoice ? gstBreakdown : {},
        },
        invoiceNumber: invoice.invoiceNumber,
        currentDate: new Date(invoice.invoiceDate).toLocaleDateString(
          'en-IN',
        ),
        currentTime: new Date(invoice.invoiceDate).toLocaleTimeString(
          'en-IN',
          { hour12: false },
        ),
        invoiceDate: invoice.invoiceDate,
        storedata: storedata || {},
        isGstInvoice,
        isFreePlan,
        payment: {
          paid: paidAmount,
          due: dueAmount,
          status: invoice.paymentStatus || 'unpaid',
        },
      })
      : generateInvoiceHTML({
        createdInvoice: true,
        invoiceData: invoice,
        formValues: {
          customerName: invoice.customerName,
          contactNumber: invoice.customerMobile,
          customerAddress: invoice.customerAddress || '',
          customerGstNumber: invoice.customerGstNumber || '',
        },
        cartItems: enrichedItems, // ✅ fixed
        invoiceCalculations: {
          subtotal: subtotal,
          totalTax: invoice.gstTotal,
          discountTotal: invoice.discountTotal || 0,
          grandTotal: grandTotalRaw,
          netTotal,
          grandTotalRaw,
          totalQuantity: invoice.items.reduce(
            (sum, i) => sum + i.quantity,
            0,
          ),
          itemCount: invoice.items.length,
          gstBreakdown: isGstInvoice ? gstBreakdown : {},
        },
        invoiceNumber: invoice.invoiceNumber,
        currentDate: new Date(invoice.invoiceDate).toLocaleDateString(
          'en-IN',
        ),
        currentTime: new Date(invoice.invoiceDate).toLocaleTimeString(
          'en-IN',
          { hour12: false },
        ),
        invoiceDate: invoice.invoiceDate,
        storedata: storedata || {},
        isGstInvoice,
        isFreePlan,
        payment: {
          paid: paidAmount,
          due: dueAmount,
          status: invoice.paymentStatus || 'unpaid',
        },
      });

  const cancelInvoice = async () => {
    try {
      const res = await api.put(`/invoice/status/${invoice._id}`, {
        status: 'cancelled',
      });
      if (res.success) {
        setInvoice(res.data); // update invoice with cancelled status
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

  // ✅ Print function (can be manual or auto)
  const handlePrint = async () => {
    if (printMode === 'thermal') {
      try {
        setPrinting(true);

        // ✅ Step 1: Verify printer truly connected
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
            store: storedata || {},
          });
          return;
        }

        // ✅ Step 2: Proceed to print only if verified
        await printThermalInvoice(
          invoice,
          paidAmount,
          dueAmount,
          paymentStatus,
          gstBreakdown,
          enrichedItems,
          isFreePlan,
          storedata || {},
        );
        Toast.show({ type: 'success', text1: 'Print successful' });
      } catch (err) {
        console.error('Thermal print error:', err);
        Toast.show({
          type: 'error',
          text1: 'Print failed',
          text2: err.message || 'Unknown error',
        });

        // Go to Print Preference if print failed
        navigation.navigate('PrintPreference', {
          invoice,
          store: storedata || {},
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

  // ✅ Share
  const handleShare = async () => {
    try {
      const file = await RNHTMLtoPDF.convert({
        html,
        fileName: `invoice-${invoice.invoiceNumber}`,
        base64: false,
      });

      await Share.open({
        url: `file://${file.filePath}`,
        type: 'application/pdf',
        failOnCancel: false,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleWhatsAppShare = async () => {
    try {
      // 1. Generate the PDF invoice
      const file = await RNHTMLtoPDF.convert({
        html,
        fileName: `invoice-${invoice.invoiceNumber}`,
        base64: false,
      });
      const pdfPath = file.filePath;

      // 2. Check if WhatsApp is installed
      let isInstalled = false;
      let wpBusiness = false;

      if (Platform.OS === 'android') {
        // Check both WhatsApp and WhatsApp Business
        const wp = await Share.isPackageInstalled('com.whatsapp');
        const wpB = await Share.isPackageInstalled('com.whatsapp.w4b');

        isInstalled = wp.isInstalled || wpB.isInstalled;
        wpBusiness = wpB.isInstalled;
      } else if (Platform.OS === 'ios') {
        // iOS bundle ID for WhatsApp
        const wpIOS = await Share.isPackageInstalled('whatsapp');
        isInstalled = wpIOS.isInstalled;
      }

      if (!isInstalled) {
        Toast.show({
          type: 'error',
          text1: 'WhatsApp not installed',
          text2: 'Please install WhatsApp to share the invoice.',
        });
        return false;
      }

      // 3. Format the phone number properly (add country code if missing)
      let phoneNumber = invoice?.customerMobile?.trim() || '';

      // 4. Create a personalized message
      const message = `Hello ${invoice.customerName || 'Customer'}, 
        Here is your invoice #${invoice.invoiceNumber}.
        Thank you for your business!
        Total Amount: ₹${invoice?.grandTotal || '0'}`;

      // 5. Send directly to customer number with message and PDF
      await Share.shareSingle({
        url: `file://${pdfPath}`,
        type: 'application/pdf',
        social: wpBusiness
          ? Share.Social.WHATSAPPBUSINESS
          : Share.Social.WHATSAPP,
        whatsAppNumber: `91${phoneNumber}`, // must be in full international format (no +)
        message, // text message
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



  const smoothZoom = (newZoom) => {
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
              icon="receipt-text-check-outline" // or "receipt" or "file-document-outline"
              size={24}
              onPress={() =>
                navigation.navigate('InvoiceTransactions', {
                  invoice,
                  onInvoiceUpdated: fetchInvoice, // pass the refresh callback
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
        />

        {/* 🔍 Minimal Transparent Outline Zoom Buttons */}
        <View style={styles.zoomControls}>
          <TouchableOpacity
            onPress={handleZoomIn}
            activeOpacity={0.8}
            style={styles.zoomButton}
          >
            <Icon source="magnify-plus-outline" size={26} color={theme.colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleZoomOut}
            activeOpacity={0.8}
            style={styles.zoomButton}
          >
            <Icon source="magnify-minus-outline" size={26} color={theme.colors.primary} />
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
                // payload can be: { mode: 'a4' } OR { mode: 'thermal' } OR { mode: 'thermal', selectedPrinter: {...} }
                try {
                  if (payload?.mode === 'a4') {
                    setPrintMode('a4');
                    await AsyncStorage.setItem('printMode', 'a4');
                    await AsyncStorage.removeItem('selectedPrinter');
                  } else if (payload?.mode === 'thermal') {
                    setPrintMode('thermal');
                    await AsyncStorage.setItem('printMode', 'thermal');

                    if (payload?.selectedPrinter) {
                      await AsyncStorage.setItem(
                        'selectedPrinter',
                        JSON.stringify(payload.selectedPrinter),
                      );
                    } else {
                      // optional: clear saved printer if you want strictness when user saved without connecting
                      // await AsyncStorage.removeItem('selectedPrinter');
                    }
                  }
                } catch (e) {
                  // optional toast
                }
              },
            })
          }
          style={styles.actionButton}
        >
          {invoice?.status === 'active' && invoice?.paymentStatus === 'partial' && 'Print Preference'}
        </Button>
        {invoice?.status === 'active' && invoice?.paymentStatus !== 'partial' && (
          <Button
            mode="outlined"
            icon={'pencil'}
            onPress={() =>
              navigation.replace('NewSale', {
                mode: 'edit',
                invoiceData: invoice,
              })
            }
            style={styles.actionButton}
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
          onPress={() => handlePrint()}
          style={styles.actionButton}
        >
          {printing ? 'Printing...' : 'Print'}
        </Button>

        {/* <Button
                    mode="contained"
                    icon={'share'}
                    onPress={handleShare}
                    style={styles.actionButton}
                >
                    Share
                </Button> */}
      </Surface>
      {invoice?.status === 'active' && (
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
            {
              backgroundColor: '#25D366',
              bottom: shareFabBottom, // dynamic
            },
          ]}
          onPress={handleWhatsAppShare}
          color="white"
        />
      )}
      <FAB
        size="small"
        variant="primary"
        icon="share-variant"
        style={[
          styles.fab,
          {
            backgroundColor: theme.colors.surface,
            bottom: whatsappFabBottom, // dynamic
          },
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
    justifyContent: 'space-around',
    padding: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  fab: {
    position: 'absolute',
    marginHorizontal: 16,
    right: 0,
  },
  fabWhatsApp: {
    position: 'absolute',
    marginHorizontal: 16,
    right: 0,
  },
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
