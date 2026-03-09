import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import {
  Button,
  Text,
  useTheme,
  Card,
  Chip,
  Searchbar,
  ActivityIndicator,
  FAB,
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

  const { bottom } = useSafeAreaInsets();
  // Transform API response to component format
  const transformItem = useCallback(
    item => ({
      id: item._id,
      name: item.name,
      category: item.category ? item.category : null,
      price: item.sellingPrice,
      discountPrice: item.discountPrice || 0,
      sellCount: item.sellCount,
      sales: 0,
      currentStock: item.currentStock || 0,
      isTaxInclusive: item.isTaxInclusive,
      revenue: 0,
      status: item.status,
      unit: item.unit,
      brand: item.brand || '',
      sku: item.sku || '',
      hsn: item.hsn || '',
      costPrice: item.costPrice || 0,
      lastPurchasePrice: item.lastPurchasePrice || 0,
      gstRate: item.gstRate || 0,
      weight: item.weight || 0,
      tags: item.tags || [],
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }),
    [],
  );

  // Initial API call function
  const fetchItems = useCallback(
    async (page = 1, isLoadMore = false) => {
      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const response = await api.get(`/product?page=${page}&limit=20000`);
        // console.log('Product Response:', response);

        if (response && response.data) {
          const { docs, hasNextPage, page: currentPage } = response.data;

          // Transform the API response
          const transformedItems = docs.map(transformItem);

          // Sort items by sellCount in descending order (highest first)
          transformedItems.sort(
            (a, b) => (b.sellCount || 0) - (a.sellCount || 0),
          );

          if (isLoadMore) {
            // Append new items for load more
            setItems(prevItems => [...prevItems, ...transformedItems]);
          } else {
            // Replace items for initial load/refresh
            setItems(transformedItems);
          }

          // Update pagination states
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

  // Load more function
  const loadMoreItems = useCallback(() => {
    if (hasNextPage && !loadingMore && !loading) {
      const nextPage = currentPage + 1;
      fetchItems(nextPage, true);
    }
  }, [hasNextPage, loadingMore, loading, currentPage, fetchItems]);

  // Refresh function - reset to first page
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchItems(1, false);
    setRefreshing(false);
  }, [fetchItems]);

  // Initial load
  useFocusEffect(
    useCallback(() => {
      fetchItems(1, false);
    }, [fetchItems]),
  );

  // Filter items - client side filtering for loaded items
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

  // Find the top selling product from filtered items
  const topSellingProduct = useMemo(() => {
    if (items.length === 0) return null;

    return items.reduce((top, current) => {
      const topSell = top.sellCount || 0;
      const currentSell = current.sellCount || 0;

      if (currentSell > topSell) {
        return current;
      } else if (currentSell === topSell) {
        return current.price > top.price ? current : top;
      } else {
        return top;
      }
    });
  }, [items]);

  const orderedItems = useMemo(() => {
    if (!topSellingProduct) return filteredItems;

    // Jab user search ya filter kar raha hai, normal order rakho
    if (searchQuery.trim() !== '' || selectedCategory !== 'all') {
      return filteredItems;
    }

    // Sirf default view me top-selling ko top par lao
    const rest = filteredItems.filter(item => item.id !== topSellingProduct.id);
    return [topSellingProduct, ...rest];
  }, [filteredItems, topSellingProduct, searchQuery, selectedCategory]);

  const categories = useMemo(() => {
    const cats = [
      'all',
      ...new Set(items.map(item => item.category?.name || 'Uncategorised')),
    ];
    return cats;
  }, [items]);

  const formatCurrency = amount => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  // Render footer with loading indicator
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
              {item.hsn && (
                <Text
                  variant="bodySmall"
                  style={[
                    styles.brand,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  HSN : {item.hsn}
                </Text>
              )}

              {isStockEnabled && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    navigation.navigate('StockTransactionScreen', {
                      id: item.id,
                      costPrice: item.costPrice || 0,
                      currentStock: item.currentStock,
                      name: item.name,
                    });
                  }}
                  style={[
                    styles.stocksButton,
                    {
                      backgroundColor: theme.colors.primaryContainer,
                      borderColor: theme.colors.primary + 20,
                      width: 120,
                    },
                  ]}
                >
                  <Text variant="bodySmall" style={[styles.brand]}>
                    Stock: {item.currentStock}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.rightSection}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                {item.discountPrice > 0 && (
                  <Text
                    variant="titleMedium"
                    style={[styles.price, { color: theme.colors.primary }]}
                  >
                    {formatCurrency(item.price - item.discountPrice)}
                  </Text>
                )}
                <Text
                  variant="titleMedium"
                  style={[
                    styles.price,
                    {
                      textDecorationLine:
                        item.discountPrice > 0 ? 'line-through' : 'none',
                      color:
                        item.discountPrice > 0
                          ? theme.colors.onSurfaceVariant
                          : theme.colors.primary,
                      fontSize: item.discountPrice > 0 ? 12 : 16,
                    },
                  ]}
                >
                  {formatCurrency(item.price)}
                </Text>
              </View>
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.onSurface, fontSize: 12 }}
              >
                Total Sales : {item.sellCount}
              </Text>
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
                    Top Selling Product
                  </Chip>
                </View>
              )}
            </View>
          </View>
        </Card.Content>
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
      {/* 
      {filteredItems.length > 0 && (
        <View style={styles.summaryContainer}>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
            {loadingMore && ' • Loading more...'}
          </Text>
        </View>
      )} */}
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
      {/* Fixed Header */}
      {renderFixedHeader()}

      {/* FlatList with auto infinite scroll */}
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
        onEndReachedThreshold={0.5} // Load more when 50% from the end
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
      />
      {
        hasPermission(permissions.CAN_MANAGE_PRODUCTS) && (
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
            }} // Use your actual screen name here
          // label="Create Item"
          />
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
  },
  cardContent: {
    paddingVertical: 12,
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
  stocksButton: {
    //width: 85,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginTop: 2,
  },
});

export default Item;
