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

// ─── Filter chip types ────────────────────────────────────────────────────────
// Each chip is either a "sort" type or a "category" type.
// Sort chips are fixed; category chips are derived from data.
const SORT_MODES = {
  DEFAULT: 'default',
  RECENT: 'recent',
  TOP_SELLING: 'top_selling',
  RESELLING: 'reselling',
};

// Fixed sort chips that always appear first
const SORT_CHIPS = [
  {
    kind: 'sort',
    mode: SORT_MODES.RECENT,
    label: 'Recent',
    icon: 'clock-outline',
  },
  {
    kind: 'sort',
    mode: SORT_MODES.TOP_SELLING,
    label: 'Top Selling',
    icon: 'fire',
  },
  {
    kind: 'sort',
    mode: SORT_MODES.RESELLING,
    label: 'Re-selling',
    icon: 'refresh',
  },
];

const Item = ({ navigation }) => {
  const theme = useTheme();
  const { isStockEnabled, hasPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortMode, setSortMode] = useState(SORT_MODES.DEFAULT);
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
  const [openToken, setOpenToken] = useState(0);

  const { bottom } = useSafeAreaInsets();

  // ─── Transform ──────────────────────────────────────────────────────────────
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

  // ─── Fetch ───────────────────────────────────────────────────────────────────
  const fetchItems = useCallback(
    async (page = 1, isLoadMore = false) => {
      try {
        isLoadMore ? setLoadingMore(true) : setLoading(true);
        const response = await api.get(`/product?page=${page}&limit=20000`);
        if (response?.data) {
          const { docs, hasNextPage: nextPage, page: pg } = response.data;
          const transformed = docs.map(transformItem);
          setItems(prev =>
            isLoadMore ? [...prev, ...transformed] : transformed,
          );
          setCurrentPage(pg);
          setHasNextPage(nextPage);
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

  // ─── Top-selling product (from ALL items) ────────────────────────────────────
  const topSellingProduct = useMemo(() => {
    if (items.length === 0) return null;
    return items.reduce((top, current) => {
      const topSell = top.sellCount || 0;
      const currentSell = current.sellCount || 0;
      if (currentSell > topSell) return current;
      if (currentSell === topSell)
        return current.price > top.price ? current : top;
      return top;
    });
  }, [items]);

  // ─── Unified chip list: [All] + sort chips + category chips ─────────────────
  // "All" resets both sort and category back to defaults.
  const allChips = useMemo(() => {
    const categoryNames = [
      ...new Set(items.map(item => item.category?.name || 'Uncategorised')),
    ];

    return [
      // "All" — master reset chip
      { kind: 'all', label: 'All' },
      // Fixed sort chips
      ...SORT_CHIPS,
      // Dynamic category chips
      ...categoryNames.map(name => ({ kind: 'category', label: name })),
    ];
  }, [items]);

  // A chip is "active" if:
  // - kind === 'all' → sortMode is DEFAULT AND selectedCategory is 'all'
  // - kind === 'sort' → sortMode === chip.mode
  // - kind === 'category' → selectedCategory === chip.label
  const isChipActive = useCallback(
    chip => {
      if (chip.kind === 'all')
        return sortMode === SORT_MODES.DEFAULT && selectedCategory === 'all';
      if (chip.kind === 'sort') return sortMode === chip.mode;
      if (chip.kind === 'category') return selectedCategory === chip.label;
      return false;
    },
    [sortMode, selectedCategory],
  );

  const handleChipPress = useCallback(chip => {
    if (chip.kind === 'all') {
      setSortMode(SORT_MODES.DEFAULT);
      setSelectedCategory('all');
      return;
    }
    if (chip.kind === 'sort') {
      // Toggle: pressing active sort chip deactivates it (back to DEFAULT)
      setSortMode(prev =>
        prev === chip.mode ? SORT_MODES.DEFAULT : chip.mode,
      );
      return;
    }
    if (chip.kind === 'category') {
      // Toggle: pressing active category chip deactivates it (back to 'all')
      setSelectedCategory(prev => (prev === chip.label ? 'all' : chip.label));
    }
  }, []);

  // ─── Filter + sort pipeline ──────────────────────────────────────────────────
  const searchFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item => item.name.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const categoryFiltered = useMemo(() => {
    if (selectedCategory === 'all') return searchFiltered;
    return searchFiltered.filter(
      item => (item.category?.name || 'Uncategorised') === selectedCategory,
    );
  }, [searchFiltered, selectedCategory]);

  const orderedItems = useMemo(() => {
    let result = [...categoryFiltered];

    switch (sortMode) {
      case SORT_MODES.RECENT:
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case SORT_MODES.TOP_SELLING:
        result.sort((a, b) => (b.sellCount || 0) - (a.sellCount || 0));
        break;
      case SORT_MODES.RESELLING:
        result = result
          .filter(item => (item.sellCount || 0) > 0)
          .sort((a, b) => (b.sellCount || 0) - (a.sellCount || 0));
        break;
      case SORT_MODES.DEFAULT:
      default:
        result.sort((a, b) => (b.sellCount || 0) - (a.sellCount || 0));
        if (
          topSellingProduct &&
          !searchQuery.trim() &&
          selectedCategory === 'all'
        ) {
          const rest = result.filter(i => i.id !== topSellingProduct.id);
          result = [topSellingProduct, ...rest];
        }
        break;
    }

    return result;
  }, [
    categoryFiltered,
    sortMode,
    topSellingProduct,
    searchQuery,
    selectedCategory,
  ]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const formatCurrency = useCallback(
    amount =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
      }).format(amount),
    [],
  );

  const openStockSheet = useCallback((item, type) => {
    setSelectedProductForStock(item);
    setActionType(type);
    setSelectedReason(null);
    setOpenToken(t => t + 1); // forces the effect below to re-run every time
  }, []);

  useEffect(() => {
    if (openToken > 0) {
      adjustSheetRef.current?.present();
    }
  }, [openToken]);

  // ─── Renderers ───────────────────────────────────────────────────────────────
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

  const renderItemCard = useCallback(
    ({ item }) => {
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
          {isTopSelling && (
            <View
              style={[
                styles.topSellingTag,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Icon source="trophy" size={10} color={theme.colors.onPrimary} />
              <Text
                style={[
                  styles.topSellingTagText,
                  { color: theme.colors.onPrimary },
                ]}
              >
                Top selling Product
              </Text>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.72}
            style={[
              styles.cardPressArea,
              isTopSelling && styles.cardPressAreaWithTag,
            ]}
            onPress={() => navigation.navigate('AddItem', { item })}
          >
            <View style={styles.cardMainRow}>
              {/* LEFT */}
              <View style={styles.itemInfo}>
                <Text
                  variant="titleSmall"
                  style={styles.itemName}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
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

              {/* RIGHT */}
              <View style={styles.rightColumn}>
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
    },
    [
      topSellingProduct,
      isStockEnabled,
      hasPermission,
      theme.colors,
      formatCurrency,
      navigation,
      openStockSheet,
    ],
  );

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

      {/* ── Single unified filter row ── */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={allChips}
          keyExtractor={chip =>
            chip.kind === 'category'
              ? `cat-${chip.label}`
              : `${chip.kind}-${chip.label}`
          }
          renderItem={({ item: chip }) => {
            const active = isChipActive(chip);
            const isSortChip = chip.kind === 'sort';
            return (
              <Chip
                selected={active}
                onPress={() => handleChipPress(chip)}
                style={styles.filterChip}
                mode={active ? 'flat' : 'outlined'}
                compact
                icon={isSortChip ? chip.icon : undefined}
              >
                {chip.label}
              </Chip>
            );
          }}
          contentContainerStyle={styles.filterChipList}
        />
      </View>
    </View>
  );

  // ─── Loading state ────────────────────────────────────────────────────────────
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

  // ─── Main render ──────────────────────────────────────────────────────────────
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
          orderedItems.length === 0 && styles.emptyListContainer,
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

      {isStockEnabled && (
        <>
          <AdjustStockBottomSheet
            ref={adjustSheetRef}
            productId={selectedProductForStock?.id}
            costPrice={selectedProductForStock?.costPrice || 0}
            selectedReason={selectedReason}
            initialActionType={actionType}
            openSignal={openToken}
            onActionTypeChange={setActionType}
            onOpenReason={() => {
              adjustSheetRef.current?.close();
              setTimeout(() => reasonSheetRef.current?.present(), 250);
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
              setTimeout(() => adjustSheetRef.current?.present(), 250);
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  fixedHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  searchbar: {
    marginVertical: 12,
    elevation: 0,
    borderRadius: 12,
  },
  searchInput: { fontSize: 14 },

  // ── Unified filter row ──
  filterContainer: {
    marginBottom: 12,
  },
  filterChipList: {
    paddingRight: 8,
  },
  filterChip: {
    marginRight: 8,
  },

  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyListContainer: { flexGrow: 1 },

  // ── Card ──
  itemCard: {
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  topSellingTag: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomRightRadius: 10,
    zIndex: 1,
  },
  topSellingTagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cardPressArea: {
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardPressAreaWithTag: {
    paddingTop: 28,
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
  itemName: {
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 20,
    textTransform: 'capitalize',
    marginBottom: 4,
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
  rightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 88,
    maxWidth: 120,
  },
  priceBlock: {
    alignItems: 'flex-end',
    marginBottom: 10,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  animation: { width: 200, height: 200 },
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
