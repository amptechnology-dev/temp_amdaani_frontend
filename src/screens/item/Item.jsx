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
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  useTheme,
  Chip,
  Searchbar,
  ActivityIndicator,
  FAB,
  Icon,
  Surface,
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

  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

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

  const openStockSheet = useCallback((item, type) => {
    setSelectedProductForStock(item);
    setActionType(type);
    setSelectedReason(null);
  }, []);

  useEffect(() => {
    if (selectedProductForStock) {
      const t = setTimeout(() => {
        adjustSheetRef.current?.present();
      }, 100);
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

    const displayPrice =
      item.discountPrice > 0 ? item.price - item.discountPrice : item.price;

    const showStockButton =
      isStockEnabled && hasPermission(permissions.CAN_MANAGE_STOCKS);

    return (
      <Surface
        style={[
          styles.itemCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: isTopSelling
              ? theme.colors.primary
              : theme.colors.outlineVariant,
          },
        ]}
        elevation={1}
      >
        <TouchableOpacity
          activeOpacity={0.72}
          style={styles.cardPressArea}
          onPress={() => navigation.navigate('AddItem', { item })}
        >
          {/* ── Main row: left info + right column ── */}
          <View style={styles.cardMainRow}>
            {/* LEFT: name / category / meta */}
            <View style={styles.itemInfo}>
              <View style={styles.nameRow}>
                <Text
                  variant="titleSmall"
                  style={styles.itemName}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                {isTopSelling && (
                  <Chip
                    icon="trophy"
                    compact
                    mode="flat"
                    style={[
                      styles.topSellingChip,
                      { backgroundColor: theme.colors.primaryContainer },
                    ]}
                    textStyle={[
                      styles.topSellingChipText,
                      { color: theme.colors.onPrimaryContainer },
                    ]}
                  >
                    Top Selling Product
                  </Chip>
                )}
              </View>

              <Text
                variant="bodySmall"
                style={[
                  styles.category,
                  { color: theme.colors.onSurfaceVariant },
                ]}
                numberOfLines={1}
              >
                {`${item.category?.name || 'No Category'} • ${item.unit}`}
              </Text>

              <View style={styles.metaRow}>
                {item.hsn ? (
                  <Text
                    variant="bodySmall"
                    style={[
                      styles.metaText,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                    numberOfLines={1}
                  >
                    HSN {item.hsn}
                  </Text>
                ) : null}

                {isStockEnabled && item.currentStock !== undefined && (
                  <View
                    style={[
                      styles.stockBadge,
                      {
                        backgroundColor:
                          item.currentStock <= 5
                            ? '#ffebee'
                            : item.currentStock <= 20
                            ? '#fff3e0'
                            : '#e8f5e9',
                        borderWidth: 1,
                        borderColor:
                          item.currentStock <= 5
                            ? '#f44336'
                            : item.currentStock <= 20
                            ? '#ff9800'
                            : '#4caf50',
                        alignSelf: 'flex-start',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '600',
                        color:
                          item.currentStock <= 5
                            ? '#c62828'
                            : item.currentStock <= 20
                            ? '#e65100'
                            : '#2e7d32',
                      }}
                    >
                      {item.currentStock} in stock
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* RIGHT: price / sold + stock button below */}
            <View style={styles.rightColumn}>
              {/* Price block */}
              <View style={styles.priceBlock}>
                {item.discountPrice > 0 ? (
                  <>
                    <Text
                      style={[styles.price, { color: theme.colors.primary }]}
                      numberOfLines={1}
                    >
                      {formatCurrency(displayPrice)}
                    </Text>
                    <Text
                      style={[
                        styles.originalPrice,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                      numberOfLines={1}
                    >
                      {formatCurrency(item.price)}
                    </Text>
                  </>
                ) : (
                  <Text
                    style={[styles.price, { color: theme.colors.primary }]}
                    numberOfLines={1}
                  >
                    {formatCurrency(displayPrice)}
                  </Text>
                )}

                <View style={styles.soldRow}>
                  <Icon
                    source="cart-outline"
                    size={12}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.soldText,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {item.sellCount} sold
                  </Text>
                </View>
              </View>

              {/* Stock button pinned below price block */}
              {showStockButton && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => openStockSheet(item, 'add')}
                  style={[
                    styles.stockButton,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <Icon
                    source="database-plus"
                    size={18}
                    color={theme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.stockButtonLabel,
                      { color: theme.colors.primary },
                    ]}
                  >
                    Stock
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Surface>
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

      {isStockEnabled && selectedProductForStock && (
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
              setSelectedProductForStock(null);
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
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  itemCard: {
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  // ── No extra paddingRight here; right column handles its own space ──
  cardPressArea: {
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  itemName: {
    flex: 1,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 20,
    textTransform: 'capitalize',
  },
  category: {
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
    marginRight: 8,
  },

  // ── RIGHT COLUMN: price block + stock button stacked vertically ──
  rightColumn: {
    alignItems: 'flex-end', // everything right-aligned
    justifyContent: 'flex-start',
    minWidth: 88,
    maxWidth: 120,
  },
  priceBlock: {
    alignItems: 'flex-end',
    marginBottom: 10, // gap between price info and button
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  originalPrice: {
    fontSize: 11,
    textDecorationLine: 'line-through',
    textAlign: 'right',
    marginTop: 2,
  },
  soldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  soldText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 3,
  },

  // ── Stock button: pill shape, right-aligned under price ──
  stockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stockButtonLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },

  topSellingChip: {
    height: 30,
    marginTop: 1,
    marginLeft: 6,
  },
  topSellingChipText: {
    fontSize: 10,
    fontWeight: '700',
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
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});

export default Item;
