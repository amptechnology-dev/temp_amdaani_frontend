import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Card,
  Divider,
  Chip,
  useTheme,
  Avatar,
  IconButton,
  Button,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../../utils/api';
import Navbar from '../../components/Navbar';
import ReceivePaymentBottomSheet from '../../components/BottomSheet/RecieveDuesBottomSheet';
import PurchaseDuesBottomSheet from '../../components/BottomSheet/PurchaseDuesBottomSheet';

const VendorDueDetails = () => {
  const route = useRoute();
  const { id } = route.params || {};
  const theme = useTheme();
  const navigation = useNavigation();


  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const receivePaymentBottomSheetRef = React.useRef(null);

  const fetchDueDetails = async () => {
    try {
      const res = await api.get(`/vendor/due/${id}`)
      // console.log("Due Response", res)
      if (res.success) {
        setCustomer(res.data.vendor);
        setInvoices(res.data.purchases);
      }
    } catch (err) {
      // console.log('Error fetching due details:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) fetchDueDetails();
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDueDetails();
  };

  const handlePaymentSuccess = updatedInvoice => {
    fetchDueDetails();
  };

  const openReceivePaymentSheet = invoice => {
    setSelectedInvoice(invoice);
    receivePaymentBottomSheetRef.current?.present();
  };

  const getTotalDue = () => {
    return invoices.reduce(
      (sum, inv) => sum + inv.amountDue,
      0,
    );
  };

  const getStatusColor = status => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return theme.colors.primary;
      case 'partial':
        return theme.colors.secondary;
      case 'unpaid':
        return theme.colors.error;
      default:
        return theme.colors.outline;
    }
  };

  const getStatusIcon = status => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'check-circle';
      case 'partial':
        return 'clock-outline';
      case 'unpaid':
        return 'alert-circle';
      default:
        return 'information';
    }
  };

  const formatCurrency = amount => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Navbar title="Vendor Due Details" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text
            variant="bodyLarge"
            style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}
          >
            Loading Due Details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Navbar title="Vendor Due Details" />
        <View style={styles.center}>
          <Avatar.Icon
            size={80}
            icon="account-alert"
            style={{ backgroundColor: theme.colors.errorContainer }}
            color={theme.colors.error}
          />
          <Text
            variant="titleLarge"
            style={{ marginTop: 16, color: theme.colors.onSurface }}
          >
            Customer Not Found
          </Text>
          <Text
            variant="bodyMedium"
            style={{
              marginTop: 8,
              color: theme.colors.onSurfaceVariant,
              textAlign: 'center',
            }}
          >
            Unable to load customer details. Please try again.
          </Text>
          <IconButton
            icon="refresh"
            mode="contained"
            onPress={fetchDueDetails}
            style={{ marginTop: 16 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const totalDue = getTotalDue();
  const unpaidInvoices = invoices.filter(
    inv => inv.paymentStatus === 'unpaid',
  ).length;
  const partialInvoices = invoices.filter(
    inv => inv.paymentStatus === 'partial',
  ).length;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar title={`${customer.name}'s Due Details`} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Header Summary Card */}
        <Card
          style={[styles.headerCard, { backgroundColor: theme.colors.surface }]}
        >
          <Card.Content>
            <View style={styles.headerContent}>
              <Avatar.Icon
                size={60}
                icon="account"
                style={{ backgroundColor: theme.colors.primaryContainer }}
                color={theme.colors.primary}
              />
              <View style={styles.headerText}>
                <Text
                  variant="titleLarge"
                  style={{ color: theme.colors.onSurface, fontWeight: '700' }}
                >
                  {customer.name}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 2,
                  }}
                >
                  <Avatar.Icon
                    size={16}
                    icon="phone"
                    style={{ backgroundColor: 'transparent' }}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {customer.mobile}
                  </Text>
                </View>
                {customer.address &&
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      marginTop: 2,
                    }}
                  >
                    <Avatar.Icon
                      size={16}
                      icon="map-marker"
                      style={{ backgroundColor: 'transparent' }}
                      color={theme.colors.onSurfaceVariant}
                    />
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {customer.address}
                    </Text>
                  </View>
                }
              </View>
            </View>

            <Divider style={{ marginVertical: 16 }} />

            {/* Quick Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Total Due
                </Text>
                <Text
                  variant="titleLarge"
                  style={{
                    color: theme.colors.error,
                    fontWeight: '800',
                    marginTop: 4,
                  }}
                >
                  {formatCurrency(totalDue)}
                </Text>
              </View>
              <View
                style={[
                  styles.statDivider,
                  { backgroundColor: theme.colors.outline },
                ]}
              />
              <View style={styles.statItem}>
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Unpaid
                </Text>
                <Text
                  variant="titleMedium"
                  style={{
                    color: theme.colors.error,
                    fontWeight: '700',
                    marginTop: 4,
                  }}
                >
                  {unpaidInvoices}
                </Text>
              </View>
              <View
                style={[
                  styles.statDivider,
                  { backgroundColor: theme.colors.outline },
                ]}
              />
              <View style={styles.statItem}>
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Partial
                </Text>
                <Text
                  variant="titleMedium"
                  style={{
                    color: theme.colors.secondary,
                    fontWeight: '700',
                    marginTop: 4,
                  }}
                >
                  {partialInvoices}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Invoices Section */}
        <View style={styles.sectionHeaderContainer}>
          <Text
            variant="titleLarge"
            style={{ color: theme.colors.onSurface, fontWeight: '700' }}
          >
            Due Invoices
          </Text>
          <Chip
            icon="file-document-multiple"
            mode="outlined"
            compact
            style={{ backgroundColor: theme.colors.surfaceVariant }}
          >
            {invoices.length} total
          </Chip>
        </View>

        {invoices.map((invoice, index) => {
          const statusColor = getStatusColor(invoice.paymentStatus);

          return (
            <Card
              key={invoice._id}
              style={[
                styles.invoiceCard,
                { backgroundColor: theme.colors.surface },
                index === invoices.length - 1 && { marginBottom: 24 },
              ]}
            >
              <Card.Content>
                {/* Invoice Header */}
                <View style={styles.invoiceHeader}>
                  <View style={styles.invoiceTitle}>
                    <Text
                      onPress={() =>
                        navigation.navigate('PurchaseDetail', {
                          purchaseId: invoice._id, // you can pass invoiceId
                          invoiceNumber: invoice.invoiceNumber, // or invoiceNumber
                        })
                      }
                      variant="titleMedium"
                      style={{
                        color: theme.colors.onSurface,
                        fontWeight: '600',
                      }}
                    >
                      {invoice.invoiceNumber}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        marginTop: 2,
                      }}
                    >
                      {formatDate(invoice.date)}

                    </Text>
                  </View>
                  <Chip
                    icon={getStatusIcon(invoice.paymentStatus)}
                    mode="flat"
                    style={{ backgroundColor: `${statusColor}15` }}
                    textStyle={{
                      color: statusColor,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                    compact
                  >
                    {invoice.paymentStatus.toUpperCase()}
                  </Chip>
                </View>

                <Divider style={{ marginVertical: 12 }} />

                {/* Invoice Amounts */}
                <View style={styles.amountsContainer}>
                  <View style={styles.amountRow}>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Grand Total
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={{
                        color: theme.colors.onSurface,
                        fontWeight: '500',
                      }}
                    >
                      {formatCurrency(invoice.grandTotal)}
                    </Text>
                  </View>

                  <View style={styles.amountRow}>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Amount Paid
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.primary, fontWeight: '500' }}
                    >
                      {formatCurrency(invoice.amountPaid)}
                    </Text>
                  </View>

                  <View style={[styles.amountRow, { marginTop: 8 }]}>
                    <Text
                      variant="titleSmall"
                      style={{
                        color: theme.colors.onSurface,
                        fontWeight: '600',
                      }}
                    >
                      Due Amount
                    </Text>
                    <Text
                      variant="titleMedium"
                      style={{ color: theme.colors.error, fontWeight: '800' }}
                    >
                      {formatCurrency(invoice.amountDue)}
                    </Text>
                  </View>

                  <Button
                    mode="contained"
                    onPress={() => openReceivePaymentSheet(invoice)}
                    style={styles.payButton}
                    disabled={invoice.paymentStatus === 'paid'}
                    icon="cash"
                  >
                    Send Payment
                  </Button>
                </View>

                {/* Progress Bar */}
                {invoice.paymentStatus === 'partial' && (
                  <View style={styles.progressContainer}>
                    <View
                      style={[
                        styles.progressBackground,
                        { backgroundColor: theme.colors.surfaceVariant },
                      ]}
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${(invoice.amountPaid / invoice.grandTotal) * 100
                              }%`,
                            backgroundColor: theme.colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      variant="labelSmall"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        marginTop: 4,
                      }}
                    >
                      {(
                        (invoice.amountPaid / invoice.grandTotal) *
                        100
                      ).toFixed(1)}
                      % Paid
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          );
        })}

        {/* Empty State */}
        {invoices.length === 0 && (
          <Card
            style={[
              styles.emptyCard,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Card.Content style={styles.emptyContent}>
              <Avatar.Icon
                size={64}
                icon="check-circle-outline"
                style={{ backgroundColor: theme.colors.primaryContainer }}
                color={theme.colors.primary}
              />
              <Text
                variant="titleMedium"
                style={{
                  marginTop: 16,
                  color: theme.colors.onSurface,
                  fontWeight: '600',
                }}
              >
                No Due purchases
              </Text>
              <Text
                variant="bodyMedium"
                style={{
                  marginTop: 8,
                  color: theme.colors.onSurfaceVariant,
                  textAlign: 'center',
                }}
              >
                All invoices for this customer are fully paid.
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Bottom Sheet Component */}
      <PurchaseDuesBottomSheet
        ref={receivePaymentBottomSheetRef}
        invoiceData={selectedInvoice}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  headerCard: {
    margin: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerText: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  invoiceCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  invoiceTitle: {
    flex: 1,
  },
  amountsContainer: {
    gap: 6,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBackground: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 12,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  payButton: {
    marginTop: 12,
  },
});

export default VendorDueDetails;
