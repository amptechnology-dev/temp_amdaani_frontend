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
} from 'react-native';
import {
  Button,
  Text,
  TextInput,
  useTheme,
  Surface,
  IconButton,
  ActivityIndicator,
  Badge,
  TouchableRipple,
  Icon,
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
import { ProductListSkeleton } from '../../components/Skeletons';
import CartBottomSheet from '../../components/BottomSheet/CartBottomSheet';
import { useAuth, permissions } from '../../context/AuthContext';
import PurchaseCartItemBottomSheet from '../../components/BottomSheet/PurchaseCartItemBottomSheet';

const { height: screenHeight } = Dimensions.get('window');

const AddPurchaseItems = () => {
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

  // ─── State ────────────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [dropdownQuantities, setDropdownQuantities] = useState({});
  const [selectedCartItem, setSelectedCartItem] = useState(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cartInitialized, setCartInitialized] = useState(false);

  const limit = 500;
  const searchInputRef = useRef(null);
  const previousQtyMap = useRef({});

  // ─── 1. getPurchaseRate ───────────────────────────────────────────────────
  // Returns the RAW cost price (before discount). Discount is never applied here.
  const getPurchaseRate = useCallback(
    product => {
      if (isPurchase) {
        return Number(
          product.costPrice > 0
            ? product.costPrice
            : product.lastPurchasePrice > 0
            ? product.lastPurchasePrice
            : 0,
        );
      }
      return Number(product.sellingPrice ?? product.price ?? 0);
    },
    [isPurchase],
  );

  console.log('selected istsm', selectedCartItem);

  // ─── 2. calculateItemTotals ───────────────────────────────────────────────
  /**
   * CALCULATION RULES
   *
   * PURCHASE mode:
   *   netRate  = costPrice (overridePrice) - purchaseDiscount
   *   if isTaxInclusive:
   *     basePrice = netRate / (1 + purchaseGstRate/100)
   *     taxAmount = netRate - basePrice
   *     subtotal  = qty × netRate
   *   else:
   *     basePrice = netRate
   *     taxAmount = netRate × purchaseGstRate/100
   *     subtotal  = qty × (netRate + taxAmount)
   *
   * SALES mode:
   *   Uses gstRate + discountPrice/discountPercent — same inclusive/exclusive logic.
   *
   * KEY RULE: overridePrice must always be the RAW costPrice (before discount).
   * purchaseDiscount is always read from product/cartItem — never pre-baked into price.
   */

  console.log('fix it product ', products);
  const calculateItemTotals = useCallback(
    (product, qty, overridePrice) => {
      const vendorHasGst = !isPurchase || !!route?.params?.vendorGstNumber;
      const gstRate = vendorHasGst
        ? Number(
            isPurchase ? product.purchaseGstRate ?? 0 : product.gstRate ?? 0,
          )
        : 0;

      // Raw rate — must be costPrice for purchase, sellingPrice for sales
      let rawRate = Number(overridePrice ?? getPurchaseRate(product) ?? 0);

      // Compute net rate after discount
      let netRate = rawRate;
      if (isPurchase) {
        const purchaseDiscount = Number(product.purchaseDiscount ?? 0);

        if (purchaseDiscount > 0) {
          netRate = Math.max(0, rawRate - purchaseDiscount);
        }
      } else {
        if (product._manualDiscountApplied) {
          // discount already baked in — do nothing
        } else if (
          product.discountType === 'percent' &&
          Number(product.discountPercent) > 0
        ) {
          netRate = Math.max(
            0,
            rawRate - (rawRate * Number(product.discountPercent)) / 100,
          );
        } else if (Number(product.discountPrice) > 0) {
          netRate = Math.max(0, rawRate - Number(product.discountPrice));
        }
      }

      let basePrice, taxAmount, subtotal;

      if (isPurchase) {
        if (product.isPurchaseTaxInclusive) {
          // GST is already inside costPrice — amount does NOT change
          // Just extract base and tax portions for reporting; subtotal = qty × netRate
          basePrice = netRate / (1 + gstRate / 100);
          taxAmount = netRate - basePrice;
          subtotal = qty * netRate;
        } else {
          // GST is added ON TOP of costPrice — amount increases
          basePrice = netRate;
          taxAmount = netRate * (gstRate / 100);
          subtotal = qty * (netRate + taxAmount);
        }
      } else {
        // Sales mode — use isTaxInclusive
        if (product.isTaxInclusive) {
          basePrice = netRate / (1 + gstRate / 100);
          taxAmount = netRate - basePrice;
          subtotal = qty * netRate;
        } else {
          basePrice = netRate;
          taxAmount = netRate * (gstRate / 100);
          subtotal = qty * (netRate + taxAmount);
        }
      }

      return {
        basePrice: Number(basePrice.toFixed(4)),
        taxAmount: Number(taxAmount.toFixed(4)),
        subtotal: Number(subtotal.toFixed(4)),
      };
    },
    [isPurchase, route?.params?.vendorGstNumber, getPurchaseRate],
  );

  // ─── Fetch products ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchProducts();
  }, []);

  const existing = route.params.existingCart;

  console.log('exinsing cart', existing);

  // ─── Initialize cart from route params ───────────────────────────────────
  useEffect(() => {
    if (!route?.params?.existingCart) return;

    const existing = route.params.existingCart || [];

    const now = Date.now(); // ✅ single timestamp for all items

    const normalized = existing.map((item, index) => {
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
              : item.price ?? item.lastPurchasePrice ?? 0,
          )
        : Number(item.sellingPrice ?? item.price ?? 0);

      // ✅ Use stable lineId — prefer existing, else generate once
      const lineId = item._lineId || `${id}-${index}-${now}`;

      return {
        ...item,
        _id: id,
        qty,
        price,
        _lineId: lineId,
        // ✅ Carry forward previousQty if already set (from Purchase.jsx handleAddItems)
        previousQty: item.previousQty ?? qty,
      };
    });

    // ✅ Seed previousQtyMap — use previousQty from item (frozen at Purchase.jsx level)
    normalized.forEach(item => {
      const key = item._lineId ?? item._id;
      if (key && previousQtyMap.current[key] === undefined) {
        previousQtyMap.current[key] = item.previousQty ?? item.qty;
      }
    });

    setCart(normalized);
    setCartInitialized(true);

    const qMap = {};
    normalized.forEach(i => {
      const key = i._id ?? i.name ?? i.sku;
      if (key) qMap[key] = i.qty || 0;
    });
    setDropdownQuantities(prev => ({ ...prev, ...qMap }));
  }, [route?.params?.existingCart]);

  // ─── Reconcile cart with loaded products ─────────────────────────────────
  useEffect(() => {
    if (!cartInitialized || products.length === 0) return;

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

      // ✅ Preserve user-edited price — only fall back to product price if item has no price
      const rawPrice = isPurchase
        ? Number(
            item.costPrice > 0
              ? item.costPrice // ✅ keep edited costPrice
              : item.price > 0
              ? item.price
              : prod.costPrice ?? prod.lastPurchasePrice ?? 0,
          )
        : Number(item.price > 0 ? item.price : prod.sellingPrice ?? 0);

      const merged = {
        ...prod, // base from product catalog
        ...item, // ✅ item on top — preserves all user edits (purchaseDiscount, gstRate, etc.)
        price: rawPrice,
        costPrice: rawPrice,
        qty,
        // ✅ Only reset discount fields if item has no prior edits
        ...(isPurchase &&
          !item._manualDiscountApplied && {
            discountPrice: item.discountPrice ?? 0,

            discountPercent: item.discountPercent ?? 0,

            discountType: item.discountType ?? 'amount',

            discountPercentage: item.discountPercentage ?? 0,

            sellDiscount: item.sellDiscount ?? 0,

            sellDiscountType: item.sellDiscountType ?? 'amount',

            sellDiscountPercent: item.sellDiscountPercent ?? 0,
          }),
      };

      const { subtotal } = calculateItemTotals(merged, qty, rawPrice);
      merged.subtotal = subtotal;

      newQtyMap[prod._id] = qty;
      return merged;
    });

    setCart(newCart);
    setFilteredProducts(prev => prev.map(p => p)); // trigger re-render
    setCartInitialized(false);
  }, [products, cartInitialized]); // ✔ NO CART DEPENDENCY

  const fetchProducts = async (pageNumber = 1) => {
    try {
      if (pageNumber === 1) setLoading(true);
      else setLoadingMore(true);

      const response = await api.get(
        `/product?page=${pageNumber}&limit=${limit}`,
      );

      if (response.success && response.data?.docs) {
        const newProducts = response.data.docs;

        setProducts(prev =>
          pageNumber === 1 ? newProducts : [...prev, ...newProducts],
        );
        setFilteredProducts(prev =>
          pageNumber === 1 ? newProducts : [...prev, ...newProducts],
        );

        setPage(pageNumber);
        setHasNextPage(response.data.hasNextPage);

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

  // ─── Fuse search ──────────────────────────────────────────────────────────
  const fuse = useMemo(() => {
    return new Fuse(products, {
      keys: [
        { name: 'name', weight: 0.6 },
        { name: 'sku', weight: 0.2 },
        { name: 'hsn', weight: 0.1 },
        { name: 'category.name', weight: 0.1 },
      ],
      includeScore: true,
      includeMatches: true,
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
      const fuseResults = fuse.search(trimmed);
      const withMatches = fuseResults.map(r => ({
        ...r.item,
        _matches: r.matches || [],
      }));
      setFilteredProducts(withMatches);
    }, 300);
  }, [fuse, products]);

  const handleSearchChange = useCallback(
    text => {
      setSearchQuery(text);
      debouncedSearch(text);
    },
    [debouncedSearch],
  );

  // ─── 3. setQtyForProduct ──────────────────────────────────────────────────
  const setQtyForProduct = useCallback((productId, qty) => {
    setDropdownQuantities(prev => ({ ...prev, [productId]: Math.max(0, qty) }));
  }, []);

  // ─── 4. selectItem ────────────────────────────────────────────────────────
  const selectItem = useCallback(
    product => {
      // ✅ If already in cart, just increment quantity instead of adding a new line
      const existingItem = cart.find(
        c => c._id === product._id || c.name === product.name,
      );

      if (existingItem) {
        const newQty = (existingItem.qty || 0) + 1;
        updateCartQuantity(existingItem._lineId ?? existingItem._id, newQty);
        return; // ← stop here, don't add a new line
      }

      // Not in cart — original logic below unchanged
      const currentQty = dropdownQuantities[product._id] || 0;
      const finalQty = currentQty > 0 ? currentQty : 1;

      const rawPrice = getPurchaseRate(product);
      const { subtotal } = calculateItemTotals(product, finalQty, rawPrice);
      const lineId = `${product._id}-${Date.now()}`;
      const newItem = {
        ...product,
        qty: finalQty,
        price: rawPrice,
        costPrice: rawPrice,
        previousQty: 0,
        subtotal,
        hsn: product.hsn || '',
        _lineId: `${product._id}-${Date.now()}`,
        // ...(isPurchase && {
        //   purchaseDiscount: 0,
        //   discountPrice: 0,
        //   discountPercent: 0,
        //   discountType: 'amount',
        //   _manualDiscountApplied: false,
        // }),
      };

      previousQtyMap.current[lineId] = 0;

      setCart(prev => [...prev, newItem]);
      setQtyForProduct(product._id, finalQty);

      if (isPurchase) {
        setSelectedCartItem({
          ...newItem,
          previousQty: 0,
        });
        presentItemSheet();
      }
    },
    [
      cart, // ✅ add cart to dependency array
      dropdownQuantities,
      setQtyForProduct,
      isPurchase,
      presentItemSheet,
      getPurchaseRate,
      calculateItemTotals,
      updateCartQuantity, // ✅ add this too
    ],
  );

  // ─── 5. removeFromCart ────────────────────────────────────────────────────
  const removeFromCart = useCallback(identifier => {
    setCart(prev =>
      prev.filter(i => {
        // ✅ If identifier is a _lineId, match by that first
        if (i._lineId && i._lineId === identifier) return false;
        // Fallback: match by _id or name
        return String(i._id) !== String(identifier) && i.name !== identifier;
      }),
    );
    setDropdownQuantities(prev => {
      const next = { ...prev };
      delete next[identifier];
      return next;
    });
  }, []);

  // ─── 6. updateCartQuantity ────────────────────────────────────────────────
  // item.price is always RAW — discount re-applied inside calculateItemTotals
  const updateCartQuantity = useCallback(
    (lineId, newQty) => {
      if (newQty <= 0) {
        removeFromCart(lineId);
        return;
      }
      setCart(prev =>
        prev.map(item => {
          // ✅ Match by _lineId first, fallback to _id/name
          const isMatch =
            (item._lineId && item._lineId === lineId) ||
            item._id === lineId ||
            item.name === lineId;
          if (isMatch) {
            const { subtotal } = calculateItemTotals(item, newQty, item.price);
            return { ...item, qty: newQty, subtotal };
          }
          return item;
        }),
      );
      setDropdownQuantities(prev => ({ ...prev, [lineId]: newQty }));
    },
    [removeFromCart, calculateItemTotals],
  );

  const formatAmount = num => {
    return Number.isInteger(num) ? num : parseFloat(num.toString());
  };

  // ─── 7. onBottomSheetUpdate ───────────────────────────────────────────────
  /**
   * Bottom sheet may update: qty, purchaseDiscount, costPrice (stored as price).
   * item.price from bottom sheet = raw costPrice (it must send raw price, not net).
   * purchaseDiscount on the item is the updated discount value.
   * We recalculate subtotal from scratch using the updated values.
   */
  const onBottomSheetUpdate = useCallback(
    updatedItem => {
      console.log('updated items', updatedItem);
      updatedItem._manualDiscountApplied =
        Number(updatedItem.discountPrice) > 0 ||
        Number(updatedItem.discountPercent) > 0;

      const { subtotal } = calculateItemTotals(
        updatedItem,
        updatedItem.qty,
        updatedItem.price,
      );

      const finalItem = {
        ...updatedItem,
        subtotal,
        previousQty: undefined,
        ...(isPurchase
          ? { costPrice: Number(updatedItem.price ?? updatedItem.costPrice) }
          : {}),
      };

      setCart(prev =>
        prev.map(c => {
          // ✅ Match by _lineId first
          const isMatch =
            (c._lineId && c._lineId === finalItem._lineId) ||
            c._id === finalItem._id;
          return isMatch ? finalItem : c;
        }),
      );
      setDropdownQuantities(prev => ({
        ...prev,
        [finalItem._lineId ?? finalItem._id]: finalItem.qty,
      }));

      if (!isPurchase) {
        const syncFields = {
          sellingPrice: finalItem.sellingPrice,

          discountPrice: finalItem.discountPrice,

          discountPercent: finalItem.discountPercent,

          discountType: finalItem.discountType,
        };

        setProducts(prev =>
          prev.map(p =>
            p._id === finalItem._id ? { ...p, ...syncFields } : p,
          ),
        );

        setFilteredProducts(prev =>
          prev.map(p =>
            p._id === finalItem._id ? { ...p, ...syncFields } : p,
          ),
        );
      } else {
        // Sync purchase-side discount fields back into product list

        // so re-opening the bottom sheet shows the saved values

        const purchaseSyncFields = {
          discountPrice: finalItem.discountPrice,

          discountPercent: finalItem.discountPercent,

          discountPercentage: finalItem.discountPercentage,

          discountType: finalItem.discountType,

          sellDiscountType: finalItem.sellDiscountType,

          sellDiscountPercent: finalItem.sellDiscountPercent,

          sellDiscount: finalItem.sellDiscount,
        };

        setProducts(prev =>
          prev.map(p =>
            p._id === finalItem._id ? { ...p, ...purchaseSyncFields } : p,
          ),
        );

        setFilteredProducts(prev =>
          prev.map(p =>
            p._id === finalItem._id ? { ...p, ...purchaseSyncFields } : p,
          ),
        );
      }

      closeItemSheet();
    },
    [closeItemSheet, calculateItemTotals, isPurchase],
  );
  // ─── 8. renderProductItem ─────────────────────────────────────────────────
  const renderProductItem = useCallback(
    ({ item: product }) => {
      const cartLines = cart.filter(
        c => c._id === product._id || c.name === product.name,
      );
      const visibleQty = dropdownQuantities[product._id] ?? 0;
      const inCart = cart.some(
        c => c._id === product._id || c.name === product.name,
      );
      const cartItem = cart.find(
        c => c._id === product._id || c.name === product.name,
      );
      const displayQty = inCart ? cartItem.qty : visibleQty;

      const displayPrice = isPurchase
        ? inCart
          ? Number(cartItem.costPrice ?? cartItem.price ?? 0)
          : getPurchaseRate(product)
        : inCart
        ? cartItem.price
        : getPurchaseRate(product);

      const subtotal = inCart
        ? cartLines.reduce((s, c) => s + (c.subtotal ?? 0), 0)
        : calculateItemTotals(
            product,
            displayQty || 0,
            getPurchaseRate(product),
          ).subtotal;

      const highlightMatch = (prod, field, query) => {
        if (!query || !prod?.[field]) return <Text>{prod?.[field] || ''}</Text>;

        const matches = prod._matches?.find(m => m.key === field);
        const text = prod[field];

        if (!matches || !matches.indices?.length) {
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

        const nodes = [];
        let lastIndex = 0;
        matches.indices.forEach(([start, end], idx) => {
          if (start > lastIndex) {
            nodes.push(
              <Text key={`t-${idx}-before`}>
                {text.slice(lastIndex, start)}
              </Text>,
            );
          }
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
        if (lastIndex < text.length) {
          nodes.push(<Text key="t-end">{text.slice(lastIndex)}</Text>);
        }
        return <Text>{nodes}</Text>;
      };

      // ─── Purchase price breakdown (inline IIFE) ───────────────────────────
      const renderPurchasePriceRow = () => {
        if (!inCart || displayPrice <= 0) return null;

        const purchaseDiscount = Number(cartItem.purchaseDiscount ?? 0);
        const gstRate = Number(cartItem.purchaseGstRate ?? 0);
        const rawPrice = displayPrice; // raw costPrice (before discount)
        const netRate = Math.max(0, rawPrice - purchaseDiscount);
        const isTaxInclusive = cartItem.isPurchaseTaxInclusive;

        let taxAmount = 0;
        if (gstRate > 0) {
          taxAmount = isTaxInclusive
            ? netRate - netRate / (1 + gstRate / 100) // extract GST already inside
            : netRate * (gstRate / 100); // add GST on top
        }

        const priceLabel =
          purchaseDiscount > 0
            ? `₹(${rawPrice.toFixed(2)} - ${purchaseDiscount.toFixed(2)})`
            : `₹${rawPrice.toFixed(2)}`;

        const gstLabel =
          gstRate > 0
            ? isTaxInclusive
              ? ` (incl. ${gstRate}% GST)`
              : ` + ₹${taxAmount.toFixed(2)} GST (${gstRate}%)`
            : '';

        const baseForBreakdown = isTaxInclusive
          ? netRate / (1 + gstRate / 100)
          : netRate;

        return (
          <View style={{ marginTop: 4 }}>
            <Text
              style={[
                styles.productPrice,
                { color: theme.colors.primary, fontWeight: '600' },
              ]}
            >
              {`${priceLabel}${gstLabel} × ${displayQty} = ₹${
                isTaxInclusive
                  ? subtotal.toFixed(2)
                  : (netRate + taxAmount).toFixed(2)
              }`}
            </Text>
            {gstRate > 0 && (
              <Text
                style={{
                  fontSize: 11,
                  color: theme.colors.onSurfaceVariant,
                  marginTop: 2,
                }}
              >
                {isTaxInclusive
                  ? `Base: ₹${baseForBreakdown.toFixed(
                      2,
                    )} + Tax: ₹${taxAmount.toFixed(2)}`
                  : `Base: ₹${netRate.toFixed(2)} + Tax: ₹${taxAmount.toFixed(
                      2,
                    )} → ₹${(netRate + taxAmount).toFixed(2)}/unit`}
              </Text>
            )}
          </View>
        );
      };

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
          <TouchableRipple
            onPress={() => {
              if (inCart) {
                // ✅ Freeze qty BEFORE any edit into the map
                previousQtyMap.current[cartItem._lineId ?? cartItem._id] =
                  cartItem.qty;
                setSelectedCartItem({ ...cartItem, previousQty: cartItem.qty });
                presentItemSheet();
              } else {
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
              </View>

              {/* ── Price / Subtotal row ── */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {isPurchase ? (
                  renderPurchasePriceRow()
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
                            fontWeight: '700',
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
                          ? '#ffebee'
                          : product.currentStock <= 20
                          ? '#fff3e0'
                          : '#e8f5e9',
                      borderWidth: 1,
                      borderColor:
                        product.currentStock <= 5
                          ? '#f44336'
                          : product.currentStock <= 20
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
                        product.currentStock <= 5
                          ? '#c62828'
                          : product.currentStock <= 20
                          ? '#e65100'
                          : '#2e7d32',
                    }}
                  >
                    {product.currentStock} in stock
                  </Text>
                </View>
              )}
            </View>
          </TouchableRipple>

          {/* Quantity controls */}
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
                    // ✅ Use cartItem._lineId
                    updateCartQuantity(
                      cartItem._lineId ?? cartItem._id,
                      targetQty,
                    );
                  } else {
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

              <TouchableOpacity
                style={styles.quantityDisplay}
                activeOpacity={0.7}
                onPress={() => {
                  if (!inCart) return;
                  previousQtyMap.current[cartItem._lineId ?? cartItem._id] =
                    cartItem.qty;
                  setSelectedCartItem({
                    ...cartItem,
                    previousQty: cartItem.qty,
                  });
                  presentItemSheet();
                }}
              >
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
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => {
                  const targetQty = (displayQty || 0) + 1;
                  if (inCart) {
                    // ✅ Use cartItem._lineId so updateCartQuantity can find the right line
                    updateCartQuantity(
                      cartItem._lineId ?? cartItem._id,
                      targetQty,
                    );
                  } else {
                    setDropdownQuantities(prev => ({
                      ...prev,
                      [product._id]: targetQty,
                    }));
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
      presentItemSheet,
      getPurchaseRate,
      calculateItemTotals,
      isPurchase,
      isStockEnabled,
      searchQuery,
    ],
  );

  console.log('reson', cart);
  // ─── Totals ───────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const itemCount = cart.length;
    const totalQuantity = cart.reduce((s, i) => s + (i.qty || 0), 0);
    const totalAmount = cart.reduce((s, i) => s + (i.subtotal || 0), 0);

    const totalDisplay = isPurchase
      ? cart.reduce((s, i) => {
          const qty = i.qty || 0;
          const purchaseDiscount = Number(i.purchaseDiscount ?? 0);
          const rawPrice = Number(i.costPrice ?? i.price ?? 0);
          const netRate = Math.max(0, rawPrice - purchaseDiscount);
          const gstRate = Number(i.purchaseGstRate ?? 0);

          if (i.isPurchaseTaxInclusive) {
            return s + qty * netRate; // GST inside — no change
          } else {
            const taxAmount = netRate * (gstRate / 100);
            return s + qty * (netRate + taxAmount); // GST on top — exact float
          }
        }, 0)
      : totalAmount;

    return { itemCount, totalQuantity, totalAmount, totalDisplay };
  }, [cart, isPurchase]);

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (cart.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'No Items',
        text2: 'Please add items before submitting',
      });
      return;
    }

    const onItemsSelected = route?.params?.onItemsSelected;

    console.log('final cart', cart);

    if (onItemsSelected) {
      // ✅ Attach frozen previousQty from ref map onto each item
      const cartWithPrevQty = cart.map(item => {
        const key = item._lineId ?? item._id;
        const prevQty = previousQtyMap.current[key] ?? item.qty; // fallback to current if not tracked
        return {
          ...item,
          previousQty: prevQty,
          product: item.product ?? item.productId ?? item._id ?? null,
          productId: item.productId ?? item.product ?? item._id ?? null,
        };
      });
      onItemsSelected(cartWithPrevQty);
    }
    navigation.pop();
  }, [cart, navigation, route?.params]);

  // ─── Render ───────────────────────────────────────────────────────────────
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
                      if (products.length < limit) fetchProducts(1);
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
                  alignSelf: 'center',
                  padding: 0,
                }}
                onPress={() => {
                  navigation.push('AddPurchaseItem', {
                    name: searchQuery,
                    onItemCreated: newItem => {
                      const rawPrice = isPurchase
                        ? Number(
                            newItem.costPrice || newItem.purchasePrice || 0,
                          )
                        : Number(newItem.sellingPrice || newItem.price || 0);

                      const { subtotal } = calculateItemTotals(
                        newItem,
                        1,
                        rawPrice,
                      );

                      const cartItem = {
                        ...newItem,
                        qty: 1,
                        price: rawPrice,
                        costPrice: rawPrice,
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

          {/* Items List */}
          <View style={styles.cartSection}>
            <View style={styles.cartHeader}>
              <Text variant="labelLarge" style={styles.sectionTitle}>
                Items List
              </Text>

              {cart.length > 0 && (
                <TouchableOpacity
                  onPress={() => presentCartSheet()}
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
                  if (!loadingMore && hasNextPage) fetchProducts(page + 1);
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
            <View style={styles.footerSummary}>
              <Text variant="labelMedium" style={styles.summaryValue}>
                {totals.totalQuantity} items
              </Text>
              <Text
                variant="titleMedium"
                style={[styles.totalValue, { color: theme.colors.primary }]}
              >
                ₹{totals.totalDisplay.toFixed(2)}
              </Text>
            </View>

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
      <PurchaseCartItemBottomSheet
        ref={itemBottomSheetRef}
        purchase={isPurchase}
        item={selectedCartItem}
        onUpdate={onBottomSheetUpdate}
      />
    </>
  );
};

export default AddPurchaseItems;

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
  dropdownItemMain: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
    paddingRight: 150,
  },
  productInfo: { flex: 1 },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  productName: {
    flex: 1, // fixed 60% width
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
    gap: 8,
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
