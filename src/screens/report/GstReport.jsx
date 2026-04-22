import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import api from '../../utils/api';
import Navbar from '../../components/Navbar'

const GstReport = () => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const [salesGst, setSalesGst] = useState([]);
  const [purchaseGst, setPurchaseGst] = useState([]);
  const [isLoadingSalesGst, setIsLoadingSalesGst] = useState(false);

  useEffect(() => {
    fetchGstSales();
    fetchGstPurchase();
  }, []);

  const fetchGstSales = async () => {
    try {
      setIsLoadingSalesGst(true);
      const response = await api('/invoice/gst-sales-report');
      console.log('sales response', response);
      setSalesGst(response?.data || []);
    } catch (error) {
      console.log('sales error', error);
    } finally {
      setIsLoadingSalesGst(false);
    }
  };

  const fetchGstPurchase = async () => {
    try {
      const response = await api('/invoice/gst-purchase');
      console.log('purchase response', response);
      setPurchaseGst(response?.data || []);
    } catch (error) {
      console.log('purchase error', error);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar
      showBackButton
      title={"Gst Report"}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default GstReport;
