import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import {
  Text,
  Card,
  Divider,
  Icon,
  IconButton,
  useTheme,
} from 'react-native-paper';
import CarouselSlider from '../../components/CarouselSlider';
import api from '../../utils/api';
import { format } from 'date-fns';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

// Helper to dedupe by _id
const appendUniqueById = (prev, next) => {
  const seen = new Set(prev.map(i => i._id));
  const filtered = next.filter(i => !seen.has(i._id));
  return [...prev, ...filtered];
};

const InvoiceList = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const [invoices, setInvoices] = useState([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const pageRef = useRef(1);
  const isFetchingRef = useRef(false);
  const momentumLockRef = useRef(true); // locked until user scrolls
  const mountedRef = useRef(false);

  const fetchPage = useCallback(
    async (pageToLoad = 1, { reset = false } = {}) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const res = await api.get(`/invoice?page=${pageToLoad}`); // only page param
        // api instance returns response.data directly; structure: { success, data, ... }

        if (res?.success && res.data?.docs) {
          setInvoices(prev =>
            reset ? res.data.docs : appendUniqueById(prev, res.data.docs),
          );
          setHasNextPage(Boolean(res.data?.hasNextPage));
          pageRef.current = Number(res.data?.page) || pageToLoad; // keep in sync with backend

          // console.log(`Fetched page ${pageToLoad}`, res.data);
        }
      } catch (e) {
        setError(e?.message || 'Failed to load invoices');
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  // Initial load: run ONCE
  useFocusEffect(
    useCallback(() => {
      pageRef.current = 1;
      fetchPage(1, { reset: true });
    }, [fetchPage, navigation]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    // Hard reset to page 1
    pageRef.current = 1;
    fetchPage(1, { reset: true });
  };

  const onEndReached = () => {
    // One call per momentum & only if we truly have more
    if (momentumLockRef.current) return;
    if (!hasNextPage || isFetchingRef.current) return;

    momentumLockRef.current = true; // lock until next momentum begins
    const nextPage = pageRef.current + 1;
    fetchPage(nextPage, { reset: false });
  };

  const renderInvoiceCard = ({ item: t }) => (
    <Card
      style={styles.transactionCard}
      contentStyle={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
      }}
      mode="outlined"
      onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: t._id })}
    >
      {/* Header with Customer + Invoice Number */}
      <View style={styles.transactionHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {!t?.customerName && (
              <Icon
                source="phone"
                size={16}
                color={theme.colors.onSurfaceVariant}
              />
            )}
            <Text
              variant="titleMedium"
              style={{ marginLeft: !t?.customerName ? 4 : 0 }}
            >
              {t.customerName?.trim() || t.customerMobile}
            </Text>
          </View>

          {/* Show mobile under name if name exists */}
          {t.customerName?.trim() ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 2,
              }}
            >
              <Icon
                source="phone"
                size={14}
                color={theme.colors.onSurfaceVariant}
              />
              <Text variant="labelSmall" style={{ marginLeft: 4 }}>
                {t.customerMobile}
              </Text>
            </View>
          ) : null}
        </View>

        <Text variant="titleSmall" style={[styles.transactionId]}>
          {'#'}
          {t.invoiceNumber}
        </Text>
      </View>

      {/* Date + Type */}
      <View style={styles.transactionDatesale}>
        <View
          style={[
            styles.tag,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <Text
            style={[
              styles.tagText,
              { color: theme.colors.primary, fontSize: 12 },
            ]}
          >
            {String(t.type || '').toUpperCase()}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon
            source="calendar"
            size={12}
            color={theme.colors.onSurfaceVariant}
          />
          <Text variant="labelSmall" style={[styles.date]}>
            {format(new Date(t.invoiceDate), 'dd MMM yyyy')}
          </Text>
        </View>
      </View>

      {/* Totals and Status */}
      <View style={styles.transactionDetails}>
        <View style={styles.transactionAmount}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon
              source="currency-inr"
              size={16}
              color={theme.colors.onSurfaceVariant}
            />
            <Text variant="labelLarge">Total</Text>
          </View>
          <Text variant="labelLarge">
            {Number(t.grandTotal || 0).toFixed(2)}
          </Text>
        </View>

        <View style={styles.transactionAmount}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon
              source="credit-card-outline"
              size={16}
              color={theme.colors.onSurfaceVariant}
            />
            <Text variant="labelLarge" style={{ marginLeft: 4 }}>
              Status
            </Text>
          </View>
          <Text
            variant="labelLarge"
            style={{
              color: t.paymentStatus === 'paid' ? 'green' : theme.colors.error,
              textTransform: 'capitalize',
            }}
          >
            {t.paymentStatus}
          </Text>
        </View>
      </View>

      {/* <Divider style={styles.divider} />

      <View style={styles.transactionActions}>
        <IconButton icon="printer" size={20} iconColor={theme.colors.primary} />
        <IconButton icon="share-variant" size={20} iconColor={theme.colors.primary} />
        <IconButton icon="dots-vertical" size={20} iconColor={theme.colors.primary} />
      </View> */}
    </Card>
  );

  const EmptyInvoiceList = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon source="receipt-outline" size={80} color={theme.colors.outline} />
      </View>
      <Text
        variant="headlineSmall"
        style={[styles.emptyTitle, { color: theme.colors.onSurface }]}
      >
        No Invoices Found
      </Text>
      <Text
        variant="bodyLarge"
        style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}
      >
        Your invoices will appear here once you create them
      </Text>
      {/* <View style={styles.emptyActions}>
        <IconButton
          icon="plus-circle"
          size={48}
          iconColor={theme.colors.primary}
          onPress={() => navigation.navigate('NewSale')} // Adjust navigation route as needed
        />
        <Text variant="labelLarge" style={[styles.createInvoiceText, { color: theme.colors.primary }]}>
          Create Your First Invoice
        </Text>
      </View> */}
    </View>
  );

  return (
    <View style={styles.container}>
      <CarouselSlider />

      <FlatList
        data={invoices}
        keyExtractor={item => item._id}
        renderItem={renderInvoiceCard}
        contentContainerStyle={styles.transactionsList}
        showsVerticalScrollIndicator={false}
        // Pagination
        onEndReached={onEndReached}
        onEndReachedThreshold={0.25}
        onMomentumScrollBegin={() => {
          momentumLockRef.current = false; // unlock on new user scroll
        }}
        ListEmptyComponent={!loading && !refreshing ? EmptyInvoiceList : null}
        // Refresh
        refreshing={refreshing}
        onRefresh={onRefresh}
        // Footer
        ListFooterComponent={
          loading &&
          !refreshing && (
            <ActivityIndicator
              size="small"
              color={theme.colors.primary}
              style={{ marginVertical: 16 }}
            />
          )
        }
        // ListFooterComponentStyle={{ paddingBottom: 20 }}

        // Performance
        removeClippedSubviews
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        updateCellsBatchingPeriod={50}
        windowSize={20}
      />

      {error ? (
        <Text
          style={{
            textAlign: 'center',
            color: theme.colors.error,
            paddingVertical: 8,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  transactionsList: { padding: 12 },
  transactionCard: { marginBottom: 8, borderRadius: 12 },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  transactionDatesale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  tagText: { fontWeight: '500' },
  transactionId: { letterSpacing: 0.4 },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  transactionAmount: { flex: 1 },
  date: { letterSpacing: 0.4, marginLeft: 4 },
  transactionActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  divider: { marginTop: 8, marginBottom: 6 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
    minHeight: 400,
  },
  emptyIconContainer: {
    marginBottom: 24,
    opacity: 0.6,
  },
  emptyTitle: {
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyActions: {
    alignItems: 'center',
  },
  createInvoiceText: {
    fontWeight: '500',
    marginTop: 8,
  },
});

export default InvoiceList;
