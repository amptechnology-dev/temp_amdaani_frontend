// /mnt/data/AddItems.jsx
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import {
  Button,
  Text,
  TextInput,
  useTheme,
  Surface,
  IconButton,
  Card,
  ActivityIndicator,
  Badge,
  TouchableRipple,
  Divider,
  Icon,
  Chip,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Navbar from '../../components/Navbar';
import Toast from 'react-native-toast-message';
import api from '../../utils/api';
import debounce from 'lodash.debounce';
import { useNavigation, useRoute } from '@react-navigation/native';
import CartItemBottomSheet from '../../components/BottomSheet/CartItemBottomSheet';
import { useBottomSheet } from '../../hook/useBottomSheet';
import Fuse from 'fuse.js';
import { TextSkeleton, ProductListSkeleton } from '../../components/Skeletons';
import CartBottomSheet from '../../components/BottomSheet/CartBottomSheet';
import { useAuth, permissions } from '../../context/AuthContext';

const { height: screenHeight } = Dimensions.get('window');

const AddItems = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { hasPermission, isStockEnabled } = useAuth();
  const isPurchase = route?.params?.purchase;
  const { bottomSheetRef, present, close } = useBottomSheet();
  const {
    bottomSheetRef: cartBottomSheetRef,
    expand: presentCartSheet,
    close: closeCartSheet,
  } = useBottomSheet();

  const {
    bottomSheetRef: itemBottomSheetRef,
    expand: presentItemSheet,
    close: closeItemSheet,
  } = useBottomSheet();

  // state
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [cart, setCart] = useState([]); // selected items (qty>0)
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  // UI-visible per-product quantity. Default 0 -> not selected
  const [dropdownQuantities, setDropdownQuantities] = useState({});
  const [selectedCartItem, setSelectedCartItem] = useState(null);

  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cartInitialized, setCartInitialized] = useState(false);

  const limit = 500;

  const searchInputRef = useRef(null);

  // fetch products
  useEffect(() => {
    fetchProducts();
  }, []);

  // Initialize cart from route param (if provided) and normalize keys so they match product IDs when possible
  useEffect(() => {
    if (!route?.params?.existingCart) return;

    const existing = route.params.existingCart || [];
    // console.log(existing)

    const normalized = existing.map(item => {
      const qty = item.qty ?? item.quantity ?? item.qtySold ?? 0;
      const id =
        item._id ??
        item.productId ??
        (item.product && (item.product._id || item.product.id)) ??
        null;
      const price = isPurchase
        ? Number(
            item.costPrice > 0
              ? item.costPrice
              : item.price ?? prod.lastPurchasePrice ?? 0,
          )
        : item.price ?? item.sellingPrice ?? 0;

      return { ...item, _id: id, qty, price };
    });

    setCart(normalized);
    setCartInitialized(true);

    // Build dropdown quantities map using the normalized _id when available, else fallback to name/sku
    const qMap = {};
    normalized.forEach(i => {
      const key = i._id ?? i.name ?? i.sku;
      if (key) qMap[key] = i.qty || 0;
    });
    setDropdownQuantities(prev => ({ ...prev, ...qMap }));
  }, [route?.params?.existingCart]);

  // When products load (or change), reconcile existing cart items to ensure they reference the proper product _id and have product metadata
  useEffect(() => {
    if (!cartInitialized || products.length === 0) return;

    // console.log("🔥 Running merge once:", { cart, products });

    const newQtyMap = { ...dropdownQuantities };

    const newCart = cart.map(item => {
      const prod = products.find(
        p =>
          p._id === item._id ||
          p._id === item.productId ||
          p.name === item.name ||
          (item.sku && p.sku === item.sku),
      );

      if (!prod) return item;

      const qty = item.qty ?? 0;
      const price = item.price ?? item.sellingPrice ?? 0;

      const merged = {
        ...item,
        ...prod,
        price,
        sellingPrice: price,
        productOriginalPrice: prod.sellingPrice,
        qty,

        ...(isPurchase && {
          discountPrice: 0,
          discountPercent: 0,
          discountType: 'amount',
        }),
      };

      const { subtotal } = calculateItemTotals(merged, qty, price);
      merged.subtotal = subtotal;

      newQtyMap[prod._id] = qty;
      return merged;
    });

    setCart(newCart);

    // update UI
    setFilteredProducts(prev =>
      prev.map(p => {
        const c = newCart.find(x => x._id === p._id);
        if (!c) return p;
        return {
          ...p,
          price: c.price,
          sellingPrice: c.price,
        };
      }),
    );

    setCartInitialized(false); // 🔥 Prevent further runs
  }, [products, cartInitialized]); // ✔ NO CART DEPENDENCY

  const fetchProducts = async (pageNumber = 1) => {
    try {
      if (pageNumber === 1) setLoading(true);
      else setLoadingMore(true);

      const response = await api.get(
        `/product?page=${pageNumber}&limit=${limit}`,
      );
      console.log('Fetched products:', response.data);
      if (response.success && response.data?.docs) {
        const newProducts = response.data.docs;

        setProducts(prev =>
          pageNumber === 1 ? newProducts : [...prev, ...newProducts],
        );

        // For Fuse (local search) to always search over all loaded pages
        setFilteredProducts(prev =>
          pageNumber === 1 ? newProducts : [...prev, ...newProducts],
        );

        setPage(pageNumber);
        setHasNextPage(response.data.hasNextPage);

        // initialize dropdown quantities if needed
        const initial = {};
        newProducts.forEach(p => {
          initial[p._id] = dropdownQuantities[p._id] ?? 0;
        });
        setDropdownQuantities(prev => ({ ...initial, ...prev }));
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch products',
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const getPurchaseRate = product => {
    if (isPurchase) {
      return Number(
        product.costPrice > 0
          ? product.costPrice
          : product.lastPurchasePrice > 0
          ? product.lastPurchasePrice // fallback
          : 0,
      );
    }

    return Number(product.price ?? product.sellingPrice ?? 0);
  };

  const calculateItemTotals = (product, qty, overridePrice) => {
    const vendorHasGst = !isPurchase || !!route?.params?.vendorGstNumber;
    const gstRate = vendorHasGst ? product.gstRate || 0 : 0;
    let sellingPrice = overridePrice ?? getPurchaseRate(product);

    if (!isPurchase) {
      if (product._manualDiscountApplied) {
        // ✅ price already has discount baked in — do nothing
      } else if (
        product.discountType === 'percent' &&
        Number(product.discountPercent) > 0
      ) {
        // ✅ percent discount
        sellingPrice = Math.max(
          0,
          sellingPrice - (sellingPrice * Number(product.discountPercent)) / 100,
        );
      } else if (Number(product.discountPrice) > 0) {
        // ✅ flat discount
        sellingPrice = Math.max(
          0,
          sellingPrice - Number(product.discountPrice),
        );
      }
    }

    let basePrice, taxAmount, subtotal;

    if (product.isTaxInclusive) {
      basePrice = sellingPrice / (1 + gstRate / 100);
      taxAmount = basePrice * (gstRate / 100);
      subtotal = qty * sellingPrice;
    } else {
      basePrice = sellingPrice;
      taxAmount = basePrice * (gstRate / 100);
      subtotal = qty * (basePrice + taxAmount);
    }

    return { basePrice, taxAmount, subtotal };
  };

  const fuse = useMemo(() => {
    return new Fuse(products, {
      keys: [
        { name: 'name', weight: 0.6 },
        { name: 'sku', weight: 0.2 },
        { name: 'hsn', weight: 0.1 },
        { name: 'category.name', weight: 0.1 },
      ],
      includeScore: true,
      includeMatches: true, // ✅ required for accurate highlighting
      shouldSort: true,
      threshold: 0.35,
      minMatchCharLength: 2,
      ignoreLocation: true,
      findAllMatches: true,
      distance: 150,
    });
  }, [products]);

  const debouncedSearch = useMemo(() => {
    return debounce(query => {
      const trimmed = query.trim().toLowerCase();
      if (!trimmed) {
        setFilteredProducts(products);
        return;
      }

      // Run fuzzy search with match info
      const fuseResults = fuse.search(trimmed);

      // Map items while keeping match info
      const withMatches = fuseResults.map(r => ({
        ...r.item,
        _matches: r.matches || [],
      }));

      setFilteredProducts(withMatches);
    }, 300);
  }, [fuse, products]);

  // Handle input change
  const handleSearchChange = useCallback(
    text => {
      setSearchQuery(text);
      debouncedSearch(text);
    },
    [debouncedSearch],
  );

  // Derived list: selected products (in cart) first, then others (filtered)
  // const sortedProducts = useMemo(() => {
  //   const inCart = [];
  //   const notInCart = [];
  //   filteredProducts.forEach(p => {
  //     if (cart.some(c => c._id === p._id)) inCart.push(p);
  //     else notInCart.push(p);
  //   });
  //   return [...inCart, ...notInCart];
  // }, [filteredProducts, cart]);
  const sortedProducts = useMemo(() => filteredProducts, [filteredProducts]);

  // Helper: update dropdownQuantities safely
  const setQtyForProduct = useCallback((productId, qty) => {
    setDropdownQuantities(prev => ({ ...prev, [productId]: Math.max(0, qty) }));
  }, []);

  // Select/add item: uses dropdownQuantities[product._id] as requested; default -> 1
  const selectItem = useCallback(
    product => {
      const currentQty = dropdownQuantities[product._id] || 0;
      const finalQty = currentQty > 0 ? currentQty : 1;

      setCart(prevCart => {
        const existingIndex = prevCart.findIndex(
          i => i._id === product._id || i.name === product.name,
        );
        const purchaseRate = getPurchaseRate(product);
        const { subtotal } = calculateItemTotals(
          product,
          finalQty,
          purchaseRate,
        );

        // we'll keep a reference to the item that we actually put in cart
        let cartItemForSheet = null;

        if (existingIndex >= 0) {
          const updated = [...prevCart];

          const updatedItem = {
            ...updated[existingIndex],
            qty: finalQty,
            price: purchaseRate,
            subtotal,
            hsn: product.hsn || updated[existingIndex].hsn || '',

            // 🛑 PURCHASE → reset purchase discount & selling discount
            ...(isPurchase && {
              discountPrice: 0,
              discountPercent: 0,
              discountType: 'amount',
              _manualDiscountApplied: false,
            }),
          };

          updated[existingIndex] = cartItemForSheet = updatedItem;
          setQtyForProduct(product._id, finalQty);

          // ✅ open bottom sheet with the SAME object as in cart
          if (isPurchase) {
            setSelectedCartItem(cartItemForSheet);
            presentItemSheet();
          }

          return updated;
        } else {
          const newItem = {
            ...product,
            qty: finalQty,
            price: purchaseRate,
            subtotal,
            hsn: product.hsn || '',

            // 🛑 PURCHASE → never pass auto discount
            ...(isPurchase && {
              discountPrice: 0,
              discountPercent: 0,
              discountType: 'amount',
              _manualDiscountApplied: false,
            }),
          };

          cartItemForSheet = newItem;

          setQtyForProduct(product._id, finalQty);

          // ✅ open bottom sheet with the NEW cart item
          if (isPurchase) {
            setSelectedCartItem(cartItemForSheet);
            presentItemSheet();
          }

          return [...prevCart, newItem];
        }
      });
    },
    [dropdownQuantities, setQtyForProduct, isPurchase, presentItemSheet],
  );

  const navigationState = navigation.getState();
  console.log(
    '🔍 Navigation stack:',
    JSON.stringify(navigationState.routes, null, 2),
  );

  // Remove from cart
  const removeFromCart = useCallback(identifier => {
    setCart(prev =>
      prev.filter(
        i => String(i._id) !== String(identifier) && i.name !== identifier,
      ),
    );

    setDropdownQuantities(prev => {
      const next = { ...prev };

      // remove direct key matches
      delete next[identifier];
      // remove stringified matches
      Object.keys(next).forEach(k => {
        if (k === String(identifier)) delete next[k];
      });

      // also remove any keys that are equal to a cart item's name (best-effort cleanup)
      Object.keys(next).forEach(k => {
        if (typeof k === 'string' && k === identifier) delete next[k];
      });

      return next;
    });
  }, []);

  // Update cart item quantity (from plus/minus). If newQty <= 0 -> remove.
  // Do calculations in functional update to avoid race conditions.
  const updateCartQuantity = useCallback(
    (productId, newQty) => {
      if (newQty <= 0) {
        removeFromCart(productId);
        return;
      }

      // Update dropdownQuantities immediately so UI reflects the change
      setDropdownQuantities(prev => ({ ...prev, [productId]: newQty }));

      setCart(prev =>
        prev.map(item => {
          if (item._id === productId || item.name === productId) {
            // recompute subtotal (async-friendly microtask)
            const { subtotal } = calculateItemTotals(item, newQty, item.price);
            return { ...item, qty: newQty, subtotal };
          }
          return item;
        }),
      );
    },
    [removeFromCart],
  );

  // When bottom sheet updates item (price/qty), update cart and dropdownQuantities
  const onBottomSheetUpdate = useCallback(
    updatedItem => {
      console.log('===> update items', updatedItem);

      // ✅ FIX: check both discountPrice AND discountPercent
      updatedItem._manualDiscountApplied =
        Number(updatedItem.discountPrice) > 0 ||
        Number(updatedItem.discountPercent) > 0;

      const { subtotal } = calculateItemTotals(
        updatedItem,
        updatedItem.qty,
        updatedItem.price,
      );

      setCart(prev =>
        prev.map(c =>
          c._id === updatedItem._id ? { ...updatedItem, subtotal } : c,
        ),
      );

      setDropdownQuantities(prev => ({
        ...prev,
        [updatedItem._id]: updatedItem.qty,
      }));

      setProducts(prev =>
        prev.map(p =>
          p._id === updatedItem._id
            ? {
                ...p,
                sellingPrice: updatedItem.sellingPrice,
                discountPrice: updatedItem.discountPrice,
                discountPercent: updatedItem.discountPercent,
                discountType: updatedItem.discountType,
              }
            : p,
        ),
      );

      setFilteredProducts(prev =>
        prev.map(p =>
          p._id === updatedItem._id
            ? {
                ...p,
                sellingPrice: updatedItem.sellingPrice,
                discountPrice: updatedItem.discountPrice,
                discountPercent: updatedItem.discountPercent,
                discountType: updatedItem.discountType,
              }
            : p,
        ),
      );

      closeItemSheet();
    },
    [closeItemSheet],
  );

  console.log('-->filer items', filteredProducts);

  // UI renderer for each product in the item list
  const renderProductItem = useCallback(
    ({ item: product }) => {
      console.log('product', product.sellingPrice);
      const visibleQty = dropdownQuantities[product._id] ?? 0;
      const inCart = cart.some(
        c => c._id === product._id || c.name === product.name,
      );
      const cartItem = cart.find(
        c => c._id === product._id || c.name === product.name,
      );
      const displayQty = inCart ? cartItem.qty : visibleQty;
      const price = inCart ? cartItem.price : getPurchaseRate(product);
      const subtotal = inCart
        ? cartItem.subtotal
        : calculateItemTotals(product, displayQty || 0, price).subtotal;

      const highlightMatch = (product, field, query) => {
        if (!query || !product || !product[field])
          return <Text>{product?.[field] || ''}</Text>;

        const matches = product._matches?.find(m => m.key === field);
        const text = product[field];

        if (!matches || !matches.indices?.length) {
          // fallback simple regex highlight
          const regex = new RegExp(`(${query})`, 'gi');
          const parts = text.split(regex);

          return (
            <Text>
              {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase() ? (
                  <Text
                    key={i}
                    style={{ color: theme.colors.primary, fontWeight: 'bold' }}
                  >
                    {part}
                  </Text>
                ) : (
                  part
                ),
              )}
            </Text>
          );
        }

        // Use Fuse's match indices (precise highlighting)
        const nodes = [];
        let lastIndex = 0;

        matches.indices.forEach(([start, end], idx) => {
          // Add text before the match
          if (start > lastIndex) {
            nodes.push(
              <Text key={`t-${idx}-before`}>
                {text.slice(lastIndex, start)}
              </Text>,
            );
          }

          // Add highlighted match
          nodes.push(
            <Text
              key={`t-${idx}-match`}
              style={{
                color: theme.colors.primary,
                fontWeight: 'bold',
                textDecorationLine: 'underline',
              }}
            >
              {text.slice(start, end + 1)}
            </Text>,
          );

          lastIndex = end + 1;
        });

        // Add remaining text
        if (lastIndex < text.length) {
          nodes.push(<Text key="t-end">{text.slice(lastIndex)}</Text>);
        }

        return <Text>{nodes}</Text>;
      };

      const displayPrice = isPurchase
        ? inCart
          ? Number(cartItem.purchasePrice || cartItem.price)
          : 0
        : inCart
        ? cartItem.price
        : getPurchaseRate(product);

      console.log('==>display', displayPrice);
      console.log(' cart items===>', cartItem);

      console.log('cart++', cart);

      return (
        <View
          style={[
            styles.dropdownItemContainer,
            inCart && {
              backgroundColor: theme.colors.primary + '10',
              borderLeftWidth: 4,
              borderLeftColor: theme.colors.primary,
            },
            { borderBottomColor: theme.colors.outline },
          ]}
        >
          {/* Card main touch area */}
          <TouchableRipple
            onPress={() => {
              if (inCart) {
                // open bottom sheet to edit selected item
                setSelectedCartItem(cartItem);
                presentItemSheet();
              } else {
                // select (add) the item with default qty or visibleQty
                selectItem(product);
              }
            }}
            style={[
              styles.dropdownItemMain,
              inCart && { backgroundColor: theme.colors.surface },
            ]}
            rippleColor={theme.colors.primary + '20'}
            borderless={true}
          >
            <View style={styles.productInfo}>
              <View style={styles.productHeader}>
                <Text
                  style={[
                    styles.productName,
                    inCart && {
                      color: theme.colors.primary,
                      fontWeight: '600',
                    },
                  ]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {highlightMatch(product, 'name', searchQuery)}
                </Text>

                {/* {product.sku && <Badge style={styles.skuBadge}>{product.sku}</Badge>} */}
              </View>

              {/* Price section with discount handling */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {isPurchase ? (
                  inCart && displayPrice > 0 ? (
                    <Text
                      style={[
                        styles.productPrice,
                        {
                          marginTop: 6,
                          color: theme.colors.primary,
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {cartItem.discountPrice > 0 ? (
                        <>
                          ₹({displayPrice.toFixed(2)} -{' '}
                          {cartItem.discountPrice.toFixed(2)}) x {displayQty} =
                          ₹{(subtotal || 0).toFixed(2)}
                        </>
                      ) : (
                        <>
                          ₹{displayPrice.toFixed(2)} x {displayQty} = ₹
                          {(subtotal || 0).toFixed(2)}
                        </>
                      )}
                    </Text>
                  ) : null
                ) : (
                  <>
                    {product.discountPrice > 0 ? (
                      <>
                        <Text
                          style={[
                            styles.discountedPrice,
                            { color: theme.colors.primary },
                          ]}
                        >
                          ₹
                          {(
                            product.sellingPrice - product.discountPrice
                          ).toFixed(2)}
                        </Text>
                        <Text style={styles.originalPrice}>
                          ₹{product.sellingPrice.toFixed(2)}
                        </Text>
                        <Text style={styles.perUnitText}>
                          {' '}
                          per {product.unit || 'pcs'}
                        </Text>
                      </>
                    ) : (
                      <Text
                        style={[
                          styles.productPrice,
                          {
                            color: theme.colors.primary,
                            fontWeight: 700,
                            fontSize: 15,
                          },
                        ]}
                      >
                        ₹{displayPrice.toFixed(2)}
                        <Text style={styles.perUnitText}>
                          {' '}
                          per {product.unit || 'pcs'}
                        </Text>
                      </Text>
                    )}
                  </>
                )}
              </View>

              {/* Stock Indicator */}
              {isStockEnabled && product.currentStock !== undefined && (
                <View
                  style={[
                    styles.stockBadge,
                    {
                      backgroundColor:
                        product.currentStock <= 5
                          ? '#ffebee' // Light red background
                          : product.currentStock <= 20
                          ? '#fff3e0' // Light orange background
                          : '#e8f5e9', // Light green background
                      borderWidth: 1,
                      borderColor:
                        product.currentStock <= 5
                          ? '#f44336' // Red border
                          : product.currentStock <= 20
                          ? '#ff9800' // Orange border
                          : '#4caf50', // Green border
                      alignSelf: 'flex-start', // Ensure the badge only takes content width
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '600',
                      color:
                        product.currentStock <= 5
                          ? '#c62828' // Dark red text
                          : product.currentStock <= 20
                          ? '#e65100' // Dark orange text
                          : '#2e7d32', // Dark green text
                    }}
                  >
                    {product.currentStock} in stock
                  </Text>
                </View>
              )}

              {/* {inCart && (
                <Text style={[styles.productPrice, { marginTop: 6, color: theme.colors.primary }]}>
                  Subtotal: ₹{(subtotal || 0).toFixed(2)}
                </Text>
              )} */}
            </View>
          </TouchableRipple>

          {/* Quantity controls + delete icon for selected */}
          <View style={styles.quantitySection}>
            {inCart && (
              <IconButton
                mode="contained"
                icon="close"
                size={14}
                onPress={() => removeFromCart(product._id || product.name)}
                iconColor={theme.colors.error}
                style={styles.deleteButton}
                rippleColor={theme.colors.primary + '20'}
              />
            )}

            <View
              style={[
                styles.quantityControls,
                {
                  backgroundColor: inCart
                    ? theme.colors.primary
                    : theme.colors.surfaceVariant,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.qtyButton,
                  (displayQty || 0) <= 0 && styles.qtyButtonDisabled,
                ]}
                onPress={() => {
                  const targetQty = (displayQty || 0) - 1;
                  if (inCart) {
                    updateCartQuantity(product._id || product.name, targetQty);
                  } else {
                    // if not in cart, decrement visible qty (but keep >=0)
                    setDropdownQuantities(prev => ({
                      ...prev,
                      [product._id]: Math.max(0, (prev[product._id] || 0) - 1),
                    }));
                  }
                }}
                disabled={(displayQty || 0) <= 0}
              >
                <IconButton
                  icon="minus"
                  size={20}
                  iconColor={
                    (displayQty || 0) <= 0
                      ? theme.colors.disabled
                      : inCart
                      ? theme.colors.surface
                      : theme.colors.primary
                  }
                  style={styles.iconButton}
                />
              </TouchableOpacity>

              <View style={styles.quantityDisplay}>
                <Text
                  style={[
                    styles.quantityText,
                    {
                      color: inCart
                        ? theme.colors.surface
                        : theme.colors.primary,
                    },
                  ]}
                >
                  {displayQty || 0}
                </Text>
                {/* <Text style={styles.quantityLabel}>Qty</Text> */}
              </View>

              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => {
                  const targetQty = (displayQty || 0) + 1;
                  if (inCart) {
                    updateCartQuantity(product._id || product.name, targetQty);
                  } else {
                    // First, update visible qty
                    setDropdownQuantities(prev => ({
                      ...prev,
                      [product._id]: targetQty,
                    }));
                    // Then, actually add it to the cart
                    selectItem(product);
                  }
                }}
              >
                <IconButton
                  icon="plus"
                  size={20}
                  iconColor={
                    inCart ? theme.colors.surface : theme.colors.primary
                  }
                  style={styles.iconButton}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    },
    [
      dropdownQuantities,
      cart,
      theme.colors,
      selectItem,
      updateCartQuantity,
      removeFromCart,
      present,
    ],
  );

  // totals
  const totals = useMemo(() => {
    const itemCount = cart.length;
    const totalQuantity = cart.reduce((s, i) => s + i.qty, 0);
    const totalAmount = cart.reduce((s, i) => s + (i.subtotal || 0), 0);
    return { itemCount, totalQuantity, totalAmount };
  }, [cart]);

  const handleSubmit = useCallback(() => {
    if (cart.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'No Items',
        text2: 'Please add items before submitting',
      });
      return;
    }

    console.log('->cart', cart);
    const onItemsSelected = route?.params?.onItemsSelected;
    console.log('-->proam', onItemsSelected);
    if (onItemsSelected) onItemsSelected(cart);
    navigation.pop();
    // Toast.show({ type: 'success', text1: 'Success', text2: 'Items added to invoice!' });
  }, [cart, navigation, route?.params]);

  console.log(' ddsw-->', cart);

  return (
    <>
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Navbar title="Add Items" navigation={navigation} />
        <View style={styles.content}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 8,
              marginBottom: 8,
            }}
          >
            <TextInput
              ref={searchInputRef}
              label="Search Items"
              placeholder="Search by name or SKU..."
              mode="outlined"
              value={searchQuery}
              onChangeText={handleSearchChange}
              style={[styles.searchInput, { flex: 1 }]}
              left={<TextInput.Icon icon="magnify" />}
              right={
                searchQuery ? (
                  <TextInput.Icon
                    icon="close"
                    onPress={() => {
                      setSearchQuery('');
                      setFilteredProducts(products);
                      if (products.length < limit) {
                        fetchProducts(1); // reload full list if not fully loaded yet
                      }
                    }}
                  />
                ) : null
              }
              theme={{
                colors: {
                  primary: theme.colors.primary,
                  background: theme.colors.surface,
                },
                roundness: 12,
              }}
            />

            {hasPermission(permissions.CAN_MANAGE_PRODUCTS) && (
              <IconButton
                icon="plus-circle"
                mode="contained"
                size={28}
                style={{
                  marginBottom: 0,
                  marginLeft: 8,
                  marginRight: 4,
                  alignSelf: 'center', // force center alignment
                  padding: 0, // remove extra IconButton padding
                }}
                onPress={() => {
                  navigation.push('AddItem', {
                    name: searchQuery,
                    onItemCreated: newItem => {
                      const price = isPurchase
                        ? Number(
                            newItem.costPrice || newItem.purchasePrice || 0,
                          )
                        : Number(newItem.sellingPrice || newItem.price || 0);

                      const { subtotal } = calculateItemTotals(
                        newItem,
                        1,
                        price,
                      );

                      const cartItem = {
                        ...newItem,
                        qty: 1,
                        price,
                        subtotal,
                        ...(isPurchase && {
                          discountPrice: 0,
                          discountPercent: 0,
                          discountType: 'amount',
                          _manualDiscountApplied: false,
                        }),
                      };

                      setProducts(prev => [newItem, ...prev]);
                      setFilteredProducts(prev => [newItem, ...prev]);
                      setCart(prev => [...prev, cartItem]);
                      setDropdownQuantities(prev => ({
                        ...prev,
                        [newItem._id]: 1,
                      }));
                    },
                  });
                }}
              />
            )}
          </View>

          {/* Items List (merged catalog + cart) */}
          <View style={styles.cartSection}>
            <View style={styles.cartHeader}>
              <Text variant="labelLarge" style={styles.sectionTitle}>
                Items List
              </Text>

              {cart.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    presentCartSheet(); // ✅ opens only when tapped
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    backgroundColor: theme.colors.surfaceVariant,
                    padding: 6,
                    paddingHorizontal: 12,
                    borderRadius: 16,
                  }}
                >
                  <Icon
                    source="cart"
                    size={22}
                    iconColor={theme.colors.primary}
                    style={{ margin: 0 }}
                  />
                  <Badge style={styles.cartBadge}>{cart.length}</Badge>
                </TouchableOpacity>
              )}
            </View>

            {loading ? (
              <ProductListSkeleton count={5} />
            ) : (
              <FlatList
                data={filteredProducts}
                keyExtractor={item =>
                  item._id?.toString() || item.name || Math.random().toString()
                }
                renderItem={renderProductItem}
                ListEmptyComponent={() => (
                  <View style={styles.emptyState}>
                    <IconButton
                      icon="package-variant-plus"
                      size={48}
                      iconColor={theme.colors.disabled}
                    />
                    <Text style={styles.emptyText}>No Items Found</Text>
                    <Text style={styles.emptySubtext}>
                      Search or add new products
                    </Text>
                  </View>
                )}
                contentContainerStyle={styles.cartList}
                showsVerticalScrollIndicator={false}
                onEndReached={() => {
                  if (!loadingMore && hasNextPage) {
                    fetchProducts(page + 1);
                  }
                }}
                onEndReachedThreshold={0.3}
                ListFooterComponent={() =>
                  loadingMore ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.primary}
                      style={{ marginVertical: 12 }}
                    />
                  ) : null
                }
              />
            )}
          </View>
        </View>

        {/* Footer */}
        <Surface
          style={[styles.footer, { backgroundColor: theme.colors.surface }]}
          elevation={6}
        >
          <View style={styles.footerCompact}>
            {/* Left: Totals */}
            <View style={styles.footerSummary}>
              <Text variant="labelMedium" style={styles.summaryValue}>
                {totals.totalQuantity} items
              </Text>
              <Text
                variant="titleMedium"
                style={[styles.totalValue, { color: theme.colors.primary }]}
              >
                ₹{totals.totalAmount.toFixed(2)}
              </Text>
            </View>

            {/* Right: Actions */}
            <View style={styles.footerActions}>
              <Button
                mode="text"
                onPress={() => navigation.goBack()}
                compact
                style={styles.footerButton}
                labelStyle={styles.footerButtonLabel}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmit}
                compact
                style={styles.footerButton}
                disabled={cart.length === 0}
                labelStyle={[
                  styles.footerButtonLabel,
                  {
                    color:
                      cart.length === 0
                        ? theme.colors.onBackground
                        : theme.colors.surface,
                  },
                ]}
              >
                Add ({totals.itemCount})
              </Button>
            </View>
          </View>
        </Surface>
      </SafeAreaView>
      <CartBottomSheet
        ref={cartBottomSheetRef}
        cart={cart}
        onUpdateQty={updateCartQuantity}
        onRemove={removeFromCart}
        onCheckout={() => {
          closeCartSheet();
          handleSubmit();
        }}
        onCancel={() => closeCartSheet()}
      />

      <CartItemBottomSheet
        ref={itemBottomSheetRef}
        purchase={isPurchase}
        item={selectedCartItem}
        onUpdate={onBottomSheetUpdate}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  searchSection: {
    position: 'relative',
    marginBottom: 4,
    zIndex: 1,
    paddingHorizontal: 16,
  },
  searchInput: { elevation: 1 },
  cartSection: { flex: 1 },
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: { flex: 1, paddingVertical: 6 },
  cartBadge: { backgroundColor: '#4CAF50' },
  cartList: { flexGrow: 1, paddingBottom: 20 },
  cartItem: { borderRadius: 12, marginHorizontal: 16, marginVertical: 4 },
  cartItemContent: {
    paddingVertical: 8,
    padHingHorizontal: 12,
    paddingRight: 2,
  },
  cartItemInfo: { flex: 1 },
  cartItemName: { textAlign: 'left', marginRight: 8 },
  cartItemDetails: { color: '#666', marginBottom: 2 },
  cartItemSubtotal: { fontWeight: '600' },
  cartItemControls: { flexDirection: 'row', alignItems: 'center' },
  cartQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
  },
  cartQtyButton: { margin: 0, width: 32, height: 32 },
  cartQtyText: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    marginTop: 12,
  },
  emptySubtext: { fontSize: 14, color: '#999', textAlign: 'center' },

  dropdownItemContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  dropdownItemMain: { flex: 1, paddingHorizontal: 16, paddingVertical: 6 },
  productInfo: { flex: 1 },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  productName: {
    width: '50%', // fixed 60% width
    flexWrap: 'wrap', // allow wrapping
    lineHeight: 16, // make wrapped lines look clean
    marginRight: 8,
    textTransform: 'capitalize',
  },
  skuBadge: { backgroundColor: '#e3f2fd', color: '#1976d2' },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  productPrice: { color: '#666' },
  discountedPrice: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: 6,
  },

  originalPrice: {
    fontSize: 13,
    color: '#888',
    textDecorationLine: 'line-through',
    marginRight: 4,
  },

  perUnitText: {
    fontSize: 13,
    color: '#666',
  },
  quantitySection: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    flexDirection: 'row',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 2,
  },
  qtyButton: { borderRadius: 20, overflow: 'hidden' },
  qtyButtonDisabled: { opacity: 0.5 },
  iconButton: { margin: 0, width: 28, height: 28 },
  quantityDisplay: { alignItems: 'center', marginHorizontal: 8, minWidth: 32 },
  quantityText: { fontSize: 16, fontWeight: '600' },
  quantityLabel: { fontSize: 10, marginTop: 1 },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16 },
  footer: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  footerCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 12,
    paddingVertical: 8,
  },
  footerSummary: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // works RN 0.71+, else replace with marginRight on first button
  },
  footerButton: {
    // height: 36,
    minWidth: 100,
    marginRight: 8,
  },
  footerButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  totalValue: {
    fontWeight: 'bold',
  },

  buttonSection: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1 },
  submitButton: { flex: 2 },
  deleteButton: { marginLeft: 6 },
});

export default AddItems;
