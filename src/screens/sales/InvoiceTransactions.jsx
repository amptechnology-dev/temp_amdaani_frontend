// InvoiceTransactions.jsx (complete, replace your current file)
import React, { useMemo, useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Card,
  Text,
  useTheme,
  Divider,
  ActivityIndicator,
  Chip,
  Icon,
  IconButton,
} from 'react-native-paper';
import Navbar from '../../components/Navbar';
import CustomAlert from '../../components/CustomAlert';
import api from '../../utils/api';
import Toast from 'react-native-toast-message';

const InvoiceTransactions = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { invoice: initialInvoice, onInvoiceUpdated } = route.params || {};
  const theme = useTheme();

  // Local state for transactions and invoice meta
  const [invoice, setInvoice] = useState(initialInvoice || null);
  const [transactions, setTransactions] = useState(
    initialInvoice?.transactions ? [...initialInvoice.transactions] : []
  );
  const [refreshing, setRefreshing] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null); // transaction object to delete
  const [alertVisible, setAlertVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // keep transactions in sync if parent passed a new invoice later
  useEffect(() => {
    if (initialInvoice) {
      setInvoice(initialInvoice);
      setTransactions(initialInvoice.transactions ? [...initialInvoice.transactions] : []);
    }
  }, [initialInvoice]);

  // summary derived from transactions
  const transactionsSummary = useMemo(() => {
    const totalAmount = transactions.reduce(
      (sum, t) => sum + (parseFloat(t.amount) || 0),
      0
    );
    const successfulCount = transactions.filter(t => t.status === 'success').length;
    const pendingCount = transactions.filter(t => t.status === 'pending').length;
    return { totalAmount, successfulCount, pendingCount };
  }, [transactions]);

  const formatAmount = amount =>
    `₹${(parseFloat(amount) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = dateString =>
    new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  // Refresh handler - prefer parent's callback if provided
  const refresh = async () => {
    setRefreshing(true);
    try {
      if (typeof onInvoiceUpdated === 'function') {
        await onInvoiceUpdated();
        // parent should update route params, but defensively re-fetch here:
        const res = await api.get(`/invoice/id/${invoice?._id || initialInvoice?._id}`);
        if (res?.success && res?.data) {
          setInvoice(res.data);
          setTransactions(res.data.transactions || []);
        }
      } else {
        // fetch invoice ourselves
        if (invoice?._id || initialInvoice?._id) {
          const id = invoice?._id || initialInvoice?._id;
          const res = await api.get(`/invoice/id/${id}`);
          if (res?.success && res?.data) {
            setInvoice(res.data);
            setTransactions(res.data.transactions || []);
          }
        }
      }
    } catch (err) {
      console.error('Refresh invoice error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Show delete icon only on last transaction in the current list
  const handlePressDeleteIcon = (transaction) => {
    setDeleteCandidate(transaction);
    setAlertVisible(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      // Call API endpoint (transaction id expected by your backend)
      await api.delete(`/invoice/remove-payment/${deleteCandidate._id}`);

      Toast.show({
        type: 'success',
        text1: 'Deleted',
        text2: 'Last payment deleted successfully.',
      });

      // After delete: prefer to call parent's fetch if provided
      if (typeof onInvoiceUpdated === 'function') {
        // call it and then fetch latest invoice defensively
        await onInvoiceUpdated();
        try {
          const id = invoice?._id || initialInvoice?._id;
          if (id) {
            setLoadingInvoice(true);
            const res = await api.get(`/invoice/id/${id}`);
            if (res?.success && res?.data) {
              setInvoice(res.data);
              setTransactions(res.data.transactions || []);
            }
          }
        } finally {
          setLoadingInvoice(false);
        }
      } else {
        // No parent callback — fetch invoice ourselves and update local state
        const id = invoice?._id || initialInvoice?._id;
        if (id) {
          setLoadingInvoice(true);
          const res = await api.get(`/invoice/id/${id}`);
          if (res?.success && res?.data) {
            setInvoice(res.data);
            setTransactions(res.data.transactions || []);
          } else {
            // fallback: locally remove last item for immediate UI feedback
            setTransactions(prev => prev.slice(0, prev.length - 1));
          }
          setLoadingInvoice(false);
        } else {
          // fallback: just remove last item locally
          setTransactions(prev => prev.slice(0, prev.length - 1));
        }
      }

      // clear selection & close alert
      setDeleteCandidate(null);
      setAlertVisible(false);
    } catch (err) {
      console.error('Delete payment error:', err);
      Toast.show({
        type: 'error',
        text1: 'Deletion failed',
        text2: err?.response?.data?.message || err.message || 'Could not delete payment',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeleteCandidate(null);
    setAlertVisible(false);
  };

  const renderTransaction = ({ item, index }) => {
    const isLast = index === transactions.length - 1;

    return (
      <Card
        style={[
          styles.transactionCard,
          { backgroundColor: theme.colors.surface, borderLeftColor: theme.colors.outline },
        ]}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.headerRow}>
            <View style={styles.amountContainer}>
              <Icon source="currency-inr" size={16} color={theme.colors.primary} />
              <Text variant="titleMedium" style={styles.amountText}>
                {formatAmount(item.amount)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Chip
                mode="outlined"
                compact
                style={[styles.statusChip, { borderColor: getStatusColor(theme, item.status) }]}
                textStyle={[styles.statusText, { color: getStatusColor(theme, item.status) }]}
                icon={({ size, color }) => {
                  const icon = getStatusIcon(item.status);
                  return (
                    <Icon
                      source={icon.name}
                      size={size}
                      color={getStatusColor(theme, item.status)}
                    />
                  );
                }}
              >
                {item.status?.charAt(0)?.toUpperCase() + item.status?.slice(1)}
              </Chip>

              {/* DELETE ICON - only for the last transaction */}
              {index === 0 && item.status === 'completed' && (
                <IconButton
                  icon="delete-outline"
                  size={20}
                  iconColor={theme.colors.error}
                  accessibilityLabel="Remove last transaction"
                  onPress={() => handlePressDeleteIcon(item)}
                />
              )}
            </View>
          </View>

          <Divider style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Text variant="labelSmall" style={[styles.detailLabel, { color: theme.colors.outline }]}>
                Payment Method
              </Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {item.paymentMethod ? capitalize(item.paymentMethod) : 'N/A'}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Text variant="labelSmall" style={[styles.detailLabel, { color: theme.colors.outline }]}>
                Transaction ID
              </Text>
              <Text variant="bodySmall" style={styles.transactionId}>
                {item.transactionId || item._id?.slice(-8) || 'N/A'}
              </Text>
            </View>
          </View>

          <View style={styles.dateRow}>
            <Icon source="calendar" size={14} color={theme.colors.outline} />
            <Text variant="bodySmall" style={[styles.dateText, { color: theme.colors.outline }]}>
              {formatDate(item.createdAt)}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  // Utility helpers used in render
  function capitalize(s) {
    return s ? s.replace(/\b\w/g, c => c.toUpperCase()) : s;
  }
  function getStatusColor(themeObj, status) {
    const statusColors = {
      completed: themeObj.colors.success,
      success: themeObj.colors.success,
      pending: themeObj.colors.warning,
      failed: themeObj.colors.error,
      cancelled: themeObj.colors.error,
    };
    return statusColors[status] || themeObj.colors.outline;
  }
  function getStatusIcon(status) {
    const icons = {
      completed: { name: 'check-decagram', color: 'success' },
      success: { name: 'check-decagram', color: 'success' },
      pending: { name: 'clock-time-three', color: 'warning' },
      failed: { name: 'close-circle', color: 'error' },
      cancelled: { name: 'cancel', color: 'error' }
    };
    return icons[status] || { name: 'help-circle', color: 'outline' };
  }

  // Header component showing summary + small refresh button
  const renderHeader = () => (
    <Card style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="titleLarge" style={styles.summaryTitle}>Payment Summary</Text>
          <IconButton icon="refresh" size={20} onPress={refresh} />
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text variant="titleMedium" style={styles.summaryValue}>{transactions.length}</Text>
            <Text variant="bodySmall" style={[styles.summaryLabel, { color: theme.colors.outline }]}>Transactions</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <Text variant="titleMedium" style={styles.summaryValue}>{formatAmount(transactionsSummary.totalAmount)}</Text>
            <Text variant="bodySmall" style={[styles.summaryLabel, { color: theme.colors.outline }]}>Total Amount</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <Text variant="titleMedium" style={[styles.summaryValue, { color: theme.colors.success }]}>{transactionsSummary.successfulCount}</Text>
            <Text variant="bodySmall" style={[styles.summaryLabel, { color: theme.colors.outline }]}>Successful</Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  if (!invoice && !initialInvoice) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Navbar />
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text variant="bodyLarge" style={{ marginTop: 12, color: theme.colors.outline }}>Loading transactions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Navbar title="Transaction History" showBackButton />

      <CustomAlert
        visible={alertVisible}
        onDismiss={cancelDelete}
        title="Remove Last Payment"
        message="Are you sure you want to remove the last payment? This action cannot be undone."
        type="warning"
        actions={[
          { label: 'Cancel', onPress: cancelDelete, style: 'cancel' },
          { label: 'Remove', onPress: confirmDelete, color: theme.colors.error, style: 'destructive', loading: isDeleting },
        ]}
      />

      {loadingInvoice ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item, idx) => item._id || `txn-${idx}`}
          renderItem={renderTransaction}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />}
          ListEmptyComponent={
            <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content style={styles.emptyContent}>
                <Icon source="receipt-text-outline" size={64} color={theme.colors.outline} />
                <Text variant="titleMedium" style={[styles.emptyText, { color: theme.colors.outline }]}>No transactions found</Text>
                <Text variant="bodyMedium" style={[styles.emptySubtext, { color: theme.colors.outline }]}>Transactions will appear here once payments are made</Text>
              </Card.Content>
            </Card>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingVertical: 16, paddingHorizontal: 8 },
  summaryCard: {
    marginHorizontal: 8,
    marginBottom: 16,
    borderRadius: 16,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  summaryTitle: { fontWeight: '600', marginBottom: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { fontWeight: '700', marginBottom: 4 },
  summaryLabel: { textAlign: 'center' },
  summaryDivider: { width: 1, height: 40, backgroundColor: '#E5E5E5' },

  transactionCard: {
    marginHorizontal: 8,
    marginVertical: 6,
    borderRadius: 12,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderLeftWidth: 4,
  },
  cardContent: { paddingVertical: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  amountContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountText: { fontWeight: '700' },
  statusChip: { height: 32, backgroundColor: 'transparent' },
  statusText: { fontSize: 12, fontWeight: '600' },
  divider: { marginVertical: 8 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailItem: { flex: 1 },
  detailLabel: { marginBottom: 2 },
  detailValue: { fontWeight: '500' },
  transactionId: { fontFamily: 'monospace', fontWeight: '500' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontWeight: '400' },

  emptyCard: { marginHorizontal: 8, marginTop: 40, borderRadius: 16, elevation: 1 },
  emptyContent: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { marginTop: 16, marginBottom: 8, fontWeight: '600' },
  emptySubtext: { textAlign: 'center', lineHeight: 20 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default InvoiceTransactions;
