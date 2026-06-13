import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Button,
} from 'react-native';
import {
  Text,
  useTheme,
  Card,
  Chip,
  Searchbar,
  ActivityIndicator,
  FAB,
  Icon,
} from 'react-native-paper';
import LottieView from 'lottie-react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import api from '../../utils/api';
import { useAuth, permissions } from '../../context/AuthContext';
import Toast from 'react-native-toast-message';
import CarouselSlider from '../../components/CarouselSlider';
import { ProductListSkeleton } from '../../components/Skeletons';
import Navbar from '../../components/Navbar';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import AdjustStockBottomSheet from '../../components/BottomSheet/AdjustStocksBottmSheet';
import SelectStockReasonBottomSheet from '../../components/BottomSheet/SelectStockReasonBottomSheet';

const { width } = Dimensions.get('window');

const Item = ({ navigation }) => {
  const theme = useTheme();
  const { isStockEnabled, hasPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const route = useRoute();
  const fromMenu = route.params?.fromMenu;

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Stock bottom sheet state
  const adjustSheetRef = useRef(null);
  const reasonSheetRef = useRef(null);
  const [selectedReason, setSelectedReason] = useState(null);
  const [actionType, setActionType] = useState('add');
  const [selectedProductForStock, setSelectedProductForStock] = useState(null);

  const { bottom } = useSafeAreaInsets();

  const transformItem = useCallback(
    item => ({
      id: item._id,
      name: item.name,
      category: item.category ? item.category : null,
      price: item.sellingPrice,
      sellingPrice: item.sellingPrice,
      discountPrice: item.discountPrice || 0,
      discountType: item.discountType || 'amount',
      discountPercentage: item.discountPercentage || 0,
      purchaseDiscountType: item.purchaseDiscountType || 'amount',
      purchaseDiscountPercentage: item.purchaseDiscountPercentage || 0,
      purchaseDiscountPrice: item.purchaseDiscountPrice || 0,
      isTaxInclusive: item.isTaxInclusive ?? false,
      isPurchaseTaxInclusive: item.isPurchaseTaxInclusive ?? false,
      gstRate: item.gstRate || 0,
      sellCount: item.sellCount || 0,
      currentStock: item.currentStock || 0,
      costPrice: item.costPrice || 0,
      lastPurchasePrice: item.lastPurchasePrice || 0,
      status: item.status,
      unit: item.unit,
      sku: item.sku || '',
      hsn: item.hsn || '',
      brand: item.brand || '',
      weight: item.weight || 0,
      tags: item.tags || [],
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      sales: 0,
      revenue: 0,
    }),
    [],
  );

  const fetchItems = useCallback(
    async (page = 1, isLoadMore = false) => {
      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const response = await api.get(`/product?page=${page}&limit=20000`);

        if (response && response.data) {
          const { docs, hasNextPage, page: currentPage } = response.data;
          const transformedItems = docs.map(transformItem);

          transformedItems.sort(
            (a, b) => (b.sellCount || 0) - (a.sellCount || 0),
          );

          if (isLoadMore) {
            setItems(prevItems => [...prevItems, ...transformedItems]);
          } else {
            setItems(transformedItems);
          }

          setCurrentPage(currentPage);
          setHasNextPage(hasNextPage);
        }
      } catch (error) {
        console.error('Error fetching items:', error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [transformItem],
  );

  const loadMoreItems = useCallback(() => {
    if (hasNextPage && !loadingMore && !loading) {
      fetchItems(currentPage + 1, true);
    }
  }, [hasNextPage, loadingMore, loading, currentPage, fetchItems]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchItems(1, false);
    setRefreshing(false);
  }, [fetchItems]);

  useFocusEffect(
    useCallback(() => {
      fetchItems(1, false);
    }, [fetchItems]),
  );

  const filteredItems = useMemo(() => {
    let filtered = items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(
        item => (item.category?.name || 'Uncategorised') === selectedCategory,
      );
    }
    return filtered;
  }, [items, searchQuery, selectedCategory]);

  const topSellingProduct = useMemo(() => {
    if (items.length === 0) return null;
    return items.reduce((top, current) => {
      const topSell = top.sellCount || 0;
      const currentSell = current.sellCount || 0;
      if (currentSell > topSell) return current;
      else if (currentSell === topSell)
        return current.price > top.price ? current : top;
      else return top;
    });
  }, [items]);

  const orderedItems = useMemo(() => {
    if (!topSellingProduct) return filteredItems;
    if (searchQuery.trim() !== '' || selectedCategory !== 'all')
      return filteredItems;
    const rest = filteredItems.filter(item => item.id !== topSellingProduct.id);
    return [topSellingProduct, ...rest];
  }, [filteredItems, topSellingProduct, searchQuery, selectedCategory]);

  const categories = useMemo(() => {
    return [
      'all',
      ...new Set(items.map(item => item.category?.name || 'Uncategorised')),
    ];
  }, [items]);

  const formatCurrency = amount => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  // Handler to open bottom sheet with correct action type (set state only)
  const openStockSheet = useCallback((item, type) => {
    setSelectedProductForStock(item);
    setActionType(type);
    setSelectedReason(null);
  }, []);

  // Present bottom sheet when selectedProductForStock changes (ensures ref is mounted)
  useEffect(() => {
    if (selectedProductForStock) {
      // small delay to allow AdjustStockBottomSheet to mount and set ref
      const t = setTimeout(() => {
        adjustSheetRef.current?.present();
      }, 60);
      return () => clearTimeout(t);
    }
  }, [selectedProductForStock, actionType]);

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" />
        <Text
          style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}
        >
          Loading more items...
        </Text>
      </View>
    );
  };

  const renderItemCard = ({ item }) => {
    const isTopSelling =
      topSellingProduct &&
      item.id === topSellingProduct.id &&
      (item.sellCount || 0) > 0;

    return (
      <Card
        mode="outlined"
        style={[styles.itemCard, { backgroundColor: theme.colors.surface }]}
        onPress={() => navigation.navigate('AddItem', { item: item })}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardRow}>
            <View style={styles.itemInfo}>
              <Text
                variant="titleSmall"
                style={styles.itemName}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                variant="bodySmall"
                style={[
                  styles.category,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {`${item.category?.name || 'No Category'} • ${item.unit}`}
              </Text>
              {item.hsn ? (
                <Text
                  variant="bodySmall"
                  style={[
                    styles.brand,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  HSN : {item.hsn}
                </Text>
              ) : null}

              {isStockEnabled && (
                <View style={styles.stockRow}>
                  {/* Stock Count Badge */}
                  <View
                    style={[
                      styles.stockBadge,
                      { backgroundColor: theme.colors.primaryContainer },
                    ]}
                  >
                    <Text
                      style={[
                        styles.stockActionText,
                        {
                          color:
                            Number(item.currentStock) < 5
                              ? theme.colors.error
                              : theme.colors.onPrimaryContainer,
                        },
                      ]}
                    >
                      {item.currentStock}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.rightSection}>
              {/* Price row */}
              {item.discountPrice > 0 ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    variant="titleMedium"
                    style={[
                      styles.price,
                      { color: theme.colors.primary, fontSize: 15 },
                    ]}
                  >
                    {formatCurrency(item.price - item.discountPrice)}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{
                      textDecorationLine: 'line-through',
                      color: theme.colors.onSurfaceVariant,
                      fontSize: 11,
                    }}
                  >
                    {formatCurrency(item.price)}
                  </Text>
                </View>
              ) : (
                <Text
                  variant="titleMedium"
                  style={[
                    styles.price,
                    { color: theme.colors.primary, fontSize: 15 },
                  ]}
                >
                  {formatCurrency(item.price)}
                </Text>
              )}

              {/* Sales count */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  marginTop: 4,
                }}
              >
                <Icon
                  source="cart-outline"
                  size={12}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}
                >
                  {item.sellCount} sold
                </Text>
              </View>

              {isTopSelling && (
                <View style={styles.topSellingChipContainer}>
                  <Chip
                    icon="trophy"
                    mode="flat"
                    style={[
                      styles.topSellingChip,
                      { backgroundColor: theme.colors.surfaceVariant },
                    ]}
                    textStyle={[
                      styles.topSellingChipText,
                      { color: theme.colors.onPrimaryContainer },
                    ]}
                    compact
                  >
                    Top Selling
                  </Chip>
                </View>
              )}
            </View>
          </View>
        </Card.Content>
        {isStockEnabled && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => adjustSheetRef.current?.present()}
            style={[
              styles.floatingStockButton,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Icon
              source="database-plus"
              size={20}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        )}
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <LottieView
        source={require('../../assets/animations/Emptybox.json')}
        autoPlay
        loop
        style={styles.animation}
      />
      <Text variant="headlineSmall" style={styles.emptyTitle}>
        No Items Found
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}
      >
        {searchQuery
          ? 'Try adjusting your search or filters'
          : 'Start by adding your first item to track sales'}
      </Text>
    </View>
  );

  const renderFixedHeader = () => (
    <View
      style={[styles.fixedHeader, { backgroundColor: theme.colors.background }]}
    >
      {!fromMenu && <CarouselSlider />}
      <Searchbar
        placeholder="Search items..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
        inputStyle={styles.searchInput}
      />
      {categories.length > 1 && (
        <View style={styles.categoryContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <Chip
                selected={selectedCategory === item}
                onPress={() => setSelectedCategory(item)}
                style={styles.categoryChip}
                mode={selectedCategory === item ? 'flat' : 'outlined'}
                compact
              >
                {item === 'all' ? 'All' : item}
              </Chip>
            )}
          />
        </View>
      )}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        {fromMenu && <Navbar title={'Items'} />}
        <ProductListSkeleton count={6} style={{ paddingTop: 16 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {fromMenu && <Navbar title={'Items'} />}

      {renderFixedHeader()}

      <FlatList
        data={orderedItems}
        renderItem={renderItemCard}
        keyExtractor={item => item.id}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[
          styles.listContainer,
          filteredItems.length === 0 && styles.emptyListContainer,
          { paddingBottom: fromMenu ? 80 + bottom : 50 + bottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        onEndReached={loadMoreItems}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
      />

      {hasPermission(permissions.CAN_MANAGE_PRODUCTS) && (
        <FAB
          variant="primary"
          style={[
            styles.fab,
            {
              backgroundColor: theme.colors.primary,
              marginBottom: fromMenu ? 20 + bottom : bottom + 20,
            },
          ]}
          icon="package-variant-plus"
          color="white"
          onPress={() => {
            if (hasPermission(permissions.CAN_MANAGE_PRODUCTS)) {
              navigation.navigate('AddItem');
            } else {
              Toast.show({
                type: 'error',
                text1: 'Permission Denied',
                text2: 'You do not have permission to create items.',
              });
            }
          }}
        />
      )}

      {/* Stock Bottom Sheets — always mounted, key forces remount on product/type change */}
      {selectedProductForStock && (
        <>
          <AdjustStockBottomSheet
            key={`${selectedProductForStock.id}-${actionType}`}
            ref={adjustSheetRef}
            productId={selectedProductForStock.id}
            costPrice={selectedProductForStock.costPrice || 0}
            selectedReason={selectedReason}
            initialActionType={actionType}
            onActionTypeChange={setActionType}
            onOpenReason={() => {
              adjustSheetRef.current?.close();
              setTimeout(() => {
                reasonSheetRef.current?.present();
              }, 250);
            }}
            onStockAdjusted={() => {
              fetchItems(1, false);
            }}
          />
          <SelectStockReasonBottomSheet
            ref={reasonSheetRef}
            actionType={actionType}
            selectedReason={selectedReason}
            onSelect={reasonItem => {
              setSelectedReason(reasonItem);
              reasonSheetRef.current?.close();
              setTimeout(() => {
                adjustSheetRef.current?.present();
              }, 250);
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  searchbar: {
    marginVertical: 12,
    elevation: 0,
    borderRadius: 12,
  },
  searchInput: {
    fontSize: 14,
  },
  categoryContainer: {
    marginBottom: 12,
  },
  categoryChip: {
    marginRight: 8,
  },
  summaryContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  itemCard: {
    marginBottom: 8,
    position: 'relative',
  },
  cardContent: {
    paddingVertical: 12,
    paddingRight: 64,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  category: {
    fontSize: 12,
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  brand: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  price: {
    fontWeight: '700',
    marginBottom: 4,
  },
  topSellingChipContainer: {
    marginTop: 4,
  },
  topSellingChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  animation: {
    width: 200,
    height: 200,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  footerText: {
    marginLeft: 8,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // gap not widely supported — use margins on children
    marginTop: 6,
  },
  floatingStockButton: {
    position: 'absolute',
    height: 36,
    right: 12,
    bottom: 12,
    borderRadius: 20,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  stockActionButton: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stockBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 36,
    alignItems: 'center',
  },
});

export default Item;
