import React, {
  forwardRef,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { View, StyleSheet, TouchableOpacity, Keyboard } from 'react-native';
import {
  TextInput,
  Button,
  useTheme,
  Divider,
  Text,
  Icon,
  ToggleButton,
} from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';
import HsnCodeSelectorBottomSheet from './HsnCodeSelectorBottomSheet';
import AddHsnCodeBottomSheet from './HsnCodeCreateBottomSheet';
import { useBottomSheet } from '../../hook/useBottomSheet';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Always return a clean 2-decimal string from any number */
const toFixed2 = val => parseFloat(Number(val || 0).toFixed(2)).toString();

/** Clamp input text to max 2 decimal digits, digits + single dot only */
const clampDecimal = txt => {
  const digits = txt.replace(/[^0-9.]/g, '');
  const parts = digits.split('.');
  return parts.length > 1 ? parts[0] + '.' + parts[1].slice(0, 2) : parts[0];
};

/** Section header with icon */
const SectionHeader = ({ icon, title, theme }) => (
  <View style={styles.sectionHeader}>
    <Icon source={icon} size={18} color={theme.colors.primary} />
    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
      {title}
    </Text>
  </View>
);

/** Read-only info row */
const InfoRow = ({ label, value, theme }) => (
  <View
    style={[styles.infoRow, { backgroundColor: theme.colors.surfaceVariant }]}
  >
    <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
      {label}
    </Text>
    <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
      {value}
    </Text>
  </View>
);

// ─── Component ───────────────────────────────────────────────────────────────

const PurchaseCartItemBottomSheet = forwardRef(
  ({ item, onUpdate, purchase }, ref) => {
    const theme = useTheme();

    const defaultTaxOption = { id: 'without_tax', label: 'Exclude Tax' };
    const withTaxOption = { id: 'with_tax', label: 'Include Tax' };

    console.log('upte ', item);

    // ── HSN Code state ─────────────────────────────────────────────────────
    const [selectedHsnCode, setSelectedHsnCode] = useState(null);
    const [hsnCodeText, setHsnCodeText] = useState('');
    const [hsnCodeRefreshKey, setHsnCodeRefreshKey] = useState(0);

    const hsnSelectorSheet = useBottomSheet();
    const hsnCreateSheet = useBottomSheet();

    // ── Selling Price ──────────────────────────────────────────────────────
    const [sellingPrice, setSellingPrice] = useState(0);
    const [sellingPriceText, setSellingPriceText] = useState('0.00');

    // ── Purchase Price (raw costPrice, before discount) ────────────────────
    const [purchasePrice, setPurchasePrice] = useState(0);
    const [purchasePriceText, setPurchasePriceText] = useState('0.00');

    // ── MRP ───────────────────────────────────────────────────────────────
    const [mrp, setMrp] = useState('');

    // ── Tax options ────────────────────────────────────────────────────────
    const [taxOption, setTaxOption] = useState(defaultTaxOption);
    const [taxRate, setTaxRate] = useState(null);
    const [purchaseTaxOption, setPurchaseTaxOption] =
      useState(defaultTaxOption);
    const [purchaseTaxRate, setPurchaseTaxRate] = useState(null);

    // ── Selling discount (purchase mode) ──────────────────────────────────
    // Source field: item.discountPrice (flat ₹ amount on sellingPrice)
    const [sellDiscountType, setSellDiscountType] = useState('amount');
    const [sellDiscountValue, setSellDiscountValue] = useState('0');
    const [finalSellingPrice, setFinalSellingPrice] = useState(0);

    // ── Purchase discount ──────────────────────────────────────────────────
    // Source field: item.purchaseDiscount (flat ₹ per unit, ex-tax)
    const [discountType, setDiscountType] = useState('amount');
    const [discountValue, setDiscountValue] = useState('0');

    // ── Price after purchase discount (display only) ───────────────────────
    const [price, setPrice] = useState(0);

    // ── Quantity ───────────────────────────────────────────────────────────
    const [qtyInput, setQtyInput] = useState('1');
    const qtyNumber = Number(qtyInput) || 0;

    // ── Sync ALL fields when item changes ─────────────────────────────────
    useEffect(() => {
      if (!item) return;

      // ── 1. Purchase price (raw costPrice — field may be costPrice or price) ──
      // costPrice is the canonical field; price is the alias used in cart items
      const pp = parseFloat(
        Number(
          item.costPrice > 0
            ? item.costPrice
            : item.price > 0
            ? item.price
            : item.lastPurchasePrice ?? 0,
        ).toFixed(2),
      );
      setPurchasePrice(pp);
      setPurchasePriceText(toFixed2(pp));

      // ── 2. Selling price ──────────────────────────────────────────────────
      // productOriginalPrice is set when item comes from AddPurchaseItems
      const sp = parseFloat(
        Number(
          item.productOriginalPrice > 0
            ? item.productOriginalPrice
            : item.sellingPrice > 0
            ? item.sellingPrice
            : 0,
        ).toFixed(2),
      );
      setSellingPrice(sp);
      setSellingPriceText(toFixed2(sp));

      // ── 3. MRP ────────────────────────────────────────────────────────────
      setMrp(String(item.mrp || ''));

      // ── 4. Quantity ───────────────────────────────────────────────────────
      setQtyInput(String(item.qty || 1));

      // ── 5. Purchase discount ──────────────────────────────────────────────
      // purchaseDiscount is a flat per-unit ₹ ex-tax amount stored on the item.
      // In purchase mode we always use 'amount' type for purchase discount.
      const rawPurchaseDiscType = item.purchaseDiscountType || 'amount';
      const normPurchaseDiscType =
        rawPurchaseDiscType === 'percentage' ? 'percent' : rawPurchaseDiscType;

      let pdRaw = 0;
      if (normPurchaseDiscType === 'percent') {
        // Use purchaseDiscountPercentage field for the % value
        pdRaw = Number(
          item.purchaseDiscountPercentage ?? item.purchaseDiscountPercent ?? 0,
        );
      } else {
        // Use flat ₹ amount
        pdRaw = Number(
          item.purchaseDiscount ?? item.purchaseDiscountAmount ?? 0,
        );
      }

      setDiscountType(normPurchaseDiscType);
      setDiscountValue(toFixed2(pdRaw));

      const pdAmt =
        normPurchaseDiscType === 'percent' ? (pp * pdRaw) / 100 : pdRaw;
      setPrice(parseFloat(Math.max(0, pp - pdAmt).toFixed(2)));

      // ── 6. Selling discount ───────────────────────────────────────────────
      // discountPrice = flat ₹ discount on sellingPrice (for selling side)
      // discountPercent = percent discount on sellingPrice
      // We read whichever is set — prefer explicit discountType if present.
      const rawSellDiscType =
        item.sellDiscountType || item.discountType || 'amount';
      const normSellDiscType =
        rawSellDiscType === 'percentage' ? 'percent' : rawSellDiscType;

      let sdRaw = 0;
      if (normSellDiscType === 'percent') {
        // Prefer sellDiscountPercent → discountPercentage → discountPercent
        sdRaw = Number(
          item.sellDiscountPercent ??
            item.discountPercentage ??
            item.discountPercent ??
            0,
        );
      } else {
        // Prefer sellDiscount → discountPrice
        sdRaw = Number(
          item.sellDiscount > 0 ? item.sellDiscount : item.discountPrice ?? 0,
        );
      }

      setSellDiscountType(normSellDiscType);
      setSellDiscountValue(toFixed2(sdRaw));

      const sdAmt = normSellDiscType === 'percent' ? (sp * sdRaw) / 100 : sdRaw;
      setFinalSellingPrice(parseFloat(Math.max(0, sp - sdAmt).toFixed(2)));

      // ── 7. HSN / GST ──────────────────────────────────────────────────────
      // GST rate: purchaseGstRate is the purchase-side rate; gstRate is selling-side.
      const purchaseGst = Number(item.purchaseGstRate ?? item.gstRate ?? 0);
      const sellingGst = Number(item.gstRate ?? item.purchaseGstRate ?? 0);

      if (item.hsn) {
        setHsnCodeText(item.hsn);
        setSelectedHsnCode({ code: item.hsn, gstRate: purchaseGst });
      } else {
        setHsnCodeText('');
        setSelectedHsnCode(null);
      }

      // ── 8. Purchase tax inclusive flag ────────────────────────────────────
      // isPurchaseTaxInclusive is the purchase-side flag.
      // Fallback to isTaxInclusive only if isPurchaseTaxInclusive is undefined.
      const purchaseTaxInclusive = Boolean(
        item.isPurchaseTaxInclusive != null
          ? item.isPurchaseTaxInclusive
          : item.isTaxInclusive ?? false,
      );

      if (purchaseGst > 0) {
        setPurchaseTaxRate({ rate: purchaseGst, label: `${purchaseGst}% GST` });
        setPurchaseTaxOption(
          purchaseTaxInclusive ? withTaxOption : defaultTaxOption,
        );
      } else {
        setPurchaseTaxRate(null);
        setPurchaseTaxOption(
          purchaseTaxInclusive ? withTaxOption : defaultTaxOption,
        );
      }

      // ── 9. Selling tax inclusive flag ─────────────────────────────────────
      // isTaxInclusive is the selling-side flag.
      const sellingTaxInclusive = Boolean(item.isTaxInclusive ?? false);

      if (sellingGst > 0) {
        setTaxRate({ rate: sellingGst, label: `${sellingGst}% GST` });
        setTaxOption(sellingTaxInclusive ? withTaxOption : defaultTaxOption);
      } else {
        setTaxRate(null);
        setTaxOption(sellingTaxInclusive ? withTaxOption : defaultTaxOption);
      }
    }, [item]);

    // ── Recompute "price after purchase discount" whenever inputs change ───
    useEffect(() => {
      const base = Number(purchasePrice || 0);
      const value = Number(discountValue) || 0;
      const disc = discountType === 'percent' ? (base * value) / 100 : value;
      setPrice(parseFloat(Math.max(0, base - disc).toFixed(2)));
    }, [discountValue, discountType, purchasePrice]);

    // ── Recompute final selling price ──────────────────────────────────────
    useEffect(() => {
      if (!purchase) return;
      const base = Number(sellingPrice || 0);
      const value = Number(sellDiscountValue) || 0;
      const disc =
        sellDiscountType === 'percent' ? (base * value) / 100 : value;
      setFinalSellingPrice(parseFloat(Math.max(0, base - disc).toFixed(2)));
    }, [sellDiscountValue, sellDiscountType, sellingPrice, purchase]);

    // ── HSN select handler ─────────────────────────────────────────────────
    const handleHsnCodeSelect = useCallback(
      hsnCode => {
        if (!hsnCode) {
          setSelectedHsnCode(null);
          setHsnCodeText('');
          setPurchaseTaxRate(null);
          setTaxRate(null);
          hsnSelectorSheet.close();
          return;
        }

        setSelectedHsnCode(hsnCode);
        setHsnCodeText(hsnCode.code);

        if (hsnCode.gstRate && Number(hsnCode.gstRate) > 0) {
          const rate = {
            rate: Number(hsnCode.gstRate),
            label: `${hsnCode.gstRate}% GST`,
          };
          setPurchaseTaxRate(rate);
          setPurchaseTaxOption(defaultTaxOption);
          setTaxRate(rate);
          setTaxOption(defaultTaxOption);
        } else {
          setPurchaseTaxRate(null);
          setPurchaseTaxOption(defaultTaxOption);
          setTaxRate(null);
          setTaxOption(defaultTaxOption);
        }

        hsnSelectorSheet.close();
      },
      [hsnSelectorSheet, defaultTaxOption],
    );

    // ── HSN create handler ─────────────────────────────────────────────────
    const handleHsnCodeCreated = useCallback(
      newHsn => {
        hsnCreateSheet.close();
        setSelectedHsnCode(newHsn);
        setHsnCodeText(newHsn.code);

        if (newHsn.gstRate && Number(newHsn.gstRate) > 0) {
          const rate = {
            rate: Number(newHsn.gstRate),
            label: `${newHsn.gstRate}% GST`,
          };
          setPurchaseTaxRate(rate);
          setPurchaseTaxOption(defaultTaxOption);
          setTaxRate(rate);
          setTaxOption(defaultTaxOption);
        } else {
          setPurchaseTaxRate(null);
          setPurchaseTaxOption(defaultTaxOption);
          setTaxRate(null);
          setTaxOption(defaultTaxOption);
        }

        setHsnCodeRefreshKey(Date.now());
      },
      [hsnCreateSheet, defaultTaxOption],
    );

    const TAX_RATES = [0, 5, 12, 18, 28];

    const discountNumeric = Number(discountValue) || 0;
    const isDiscountApplied = discountNumeric > 0;

    console.log('++', item);

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
      <>
        <BaseBottomSheet
          ref={ref}
          initialSnapIndex={-1}
          contentType="scroll"
          snapPoints={['60%', '95%']}
          enablePanDownToClose
          title={`Edit — ${item?.name || ''}`}
        >
          <View style={styles.container}>
            {/* ── PRODUCT INFO ─────────────────────────────────────────── */}
            {item?.sku ? (
              <InfoRow label="SKU" value={item.sku} theme={theme} />
            ) : null}

            {/* ── HSN CODE ─────────────────────────────────────────────── */}
            <SectionHeader
              icon="barcode"
              title="HSN / SAC Code"
              theme={theme}
            />
            <View style={styles.hsnRow}>
              <View style={{ flex: 1, position: 'relative' }}>
                <TextInput
                  label="HSN / SAC Code"
                  value={hsnCodeText}
                  onChangeText={text => {
                    setHsnCodeText(text);
                    if (!text) setSelectedHsnCode(null);
                  }}
                  mode="outlined"
                  style={styles.input}
                  right={
                    <TextInput.Icon
                      icon={hsnCodeText ? 'close' : 'chevron-down'}
                      onPress={() => {
                        if (hsnCodeText) {
                          setHsnCodeText('');
                          setSelectedHsnCode(null);
                          setPurchaseTaxRate(null);
                          setPurchaseTaxOption(defaultTaxOption);
                          setTaxRate(null);
                          setTaxOption(defaultTaxOption);
                        } else {
                          Keyboard.dismiss();
                          hsnSelectorSheet.expand();
                        }
                      }}
                    />
                  }
                  placeholder="Search or select HSN"
                />
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={0.7}
                  onPress={() => {
                    Keyboard.dismiss();
                    hsnSelectorSheet.expand();
                  }}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.hsnAddButton,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
                onPress={() => {
                  hsnSelectorSheet.close();
                  setTimeout(() => hsnCreateSheet.expand(), 300);
                }}
                activeOpacity={0.8}
              >
                <Icon
                  source="plus"
                  size={18}
                  color={theme.colors.onPrimaryContainer}
                />
                <Text
                  style={[
                    styles.hsnAddButtonText,
                    { color: theme.colors.onPrimaryContainer },
                  ]}
                >
                  New
                </Text>
              </TouchableOpacity>
            </View>

            {selectedHsnCode && selectedHsnCode.gstRate > 0 && (
              <Text
                style={[
                  styles.hsnHint,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                GST auto-set to {selectedHsnCode.gstRate}% from HSN
              </Text>
            )}

            <Divider
              style={[
                styles.divider,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            />

            {/* ── MRP ───────────────────────────────────────────────────── */}
            <SectionHeader icon="tag-outline" title="MRP" theme={theme} />
            <TextInput
              label="MRP"
              value={mrp}
              onChangeText={val => setMrp(val.replace(/[^0-9.]/g, ''))}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <Divider
              style={[
                styles.divider,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            />

            {/* ── PURCHASE PRICE SECTION ────────────────────────────────── */}
            {purchase && (
              <>
                <SectionHeader
                  icon="currency-inr"
                  title="Purchase Rate"
                  theme={theme}
                />

                {/* Purchase Price + Tax inclusive toggle */}
                <View style={styles.priceRow}>
                  <TextInput
                    label="Purchase Price"
                    value={purchasePriceText}
                    onChangeText={val => {
                      const clean = clampDecimal(val);
                      setPurchasePriceText(clean);
                      setPurchasePrice(parseFloat(clean) || 0);
                    }}
                    onBlur={() => {
                      const clamped = parseFloat(purchasePrice.toFixed(2));
                      setPurchasePrice(clamped);
                      setPurchasePriceText(clamped.toFixed(2));
                    }}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    style={[styles.input, { flex: 1 }]}
                  />
                  {/* isPurchaseTaxInclusive toggle */}
                  <TouchableOpacity
                    style={[
                      styles.taxBadge,
                      {
                        backgroundColor:
                          purchaseTaxOption?.id === 'with_tax'
                            ? theme.colors.primary
                            : theme.colors.surfaceVariant,
                        borderColor:
                          purchaseTaxOption?.id === 'with_tax'
                            ? theme.colors.primary
                            : theme.colors.outline,
                      },
                    ]}
                    onPress={() =>
                      setPurchaseTaxOption(prev =>
                        prev?.id === 'with_tax'
                          ? defaultTaxOption
                          : withTaxOption,
                      )
                    }
                  >
                    <Icon
                      source={
                        purchaseTaxOption?.id === 'with_tax'
                          ? 'check-decagram'
                          : 'minus-circle-outline'
                      }
                      size={13}
                      color={
                        purchaseTaxOption?.id === 'with_tax'
                          ? theme.colors.onPrimary
                          : theme.colors.onSurfaceVariant
                      }
                    />
                    <Text
                      style={[
                        styles.taxBadgeText,
                        {
                          color:
                            purchaseTaxOption?.id === 'with_tax'
                              ? theme.colors.onPrimary
                              : theme.colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      {purchaseTaxOption?.label || 'Exclude Tax'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Purchase Discount — always 'amount' type (₹ per unit, ex-tax) */}
                <View style={styles.discountRow}>
                  <ToggleButton.Row
                    value={discountType}
                    onValueChange={val => {
                      if (!val || val === discountType) return;
                      const base = Number(purchasePrice || 0);
                      const current = Number(discountValue) || 0;
                      let next = current;
                      if (val === 'percent' && discountType === 'amount') {
                        next = base > 0 ? (current / base) * 100 : current;
                      } else if (
                        val === 'amount' &&
                        discountType === 'percent'
                      ) {
                        next = (base * current) / 100;
                      }
                      setDiscountType(val);
                      setDiscountValue(parseFloat(next.toFixed(2)).toString());
                    }}
                  >
                    <ToggleButton icon="currency-inr" value="amount" />
                    <ToggleButton icon="percent" value="percent" />
                  </ToggleButton.Row>

                  <TextInput
                    label={
                      discountType === 'percent'
                        ? 'Purchase Discount (%)'
                        : 'Purchase Discount (₹)'
                    }
                    value={discountValue}
                    onChangeText={val => setDiscountValue(clampDecimal(val))}
                    onBlur={() => {
                      const cleaned = parseFloat(
                        Number(discountValue || 0).toFixed(2),
                      );
                      setDiscountValue(
                        isNaN(cleaned) ? '0' : cleaned.toString(),
                      );
                    }}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    style={{ flex: 1 }}
                    outlineColor={
                      isDiscountApplied ? theme.colors.primary : undefined
                    }
                  />
                </View>

                {/* Purchase Tax Rate picker */}
                <View style={styles.taxRateRow}>
                  <Text
                    style={[
                      styles.taxRateLabel,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    Purchase GST Rate:
                  </Text>
                  <View style={styles.taxRateChips}>
                    {TAX_RATES.map(r => {
                      const isSelected =
                        r === 0
                          ? !purchaseTaxRate
                          : purchaseTaxRate?.rate === r;
                      return (
                        <TouchableOpacity
                          key={r}
                          style={[
                            styles.taxChip,
                            {
                              backgroundColor: isSelected
                                ? theme.colors.primary
                                : theme.colors.surfaceVariant,
                              borderColor: isSelected
                                ? theme.colors.primary
                                : theme.colors.outline,
                            },
                          ]}
                          onPress={() => {
                            if (r === 0) {
                              setPurchaseTaxRate(null);
                            } else {
                              setPurchaseTaxRate({
                                rate: r,
                                label: `${r}% GST`,
                              });
                              if (purchaseTaxOption?.id !== 'with_tax') {
                                setPurchaseTaxOption(withTaxOption);
                              }
                            }
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '600',
                              color: isSelected
                                ? theme.colors.onPrimary
                                : theme.colors.onSurfaceVariant,
                            }}
                          >
                            {r === 0 ? 'None' : `${r}%`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Price after purchase discount */}
                <InfoRow
                  label="Purchase Price (after discount)"
                  value={`₹ ${price.toFixed(2)}`}
                  theme={theme}
                />

                <Divider
                  style={[
                    styles.divider,
                    { backgroundColor: theme.colors.outlineVariant },
                  ]}
                />
              </>
            )}

            {/* ── SELLING PRICE SECTION ─────────────────────────────────── */}
            <SectionHeader
              icon="tag-multiple-outline"
              title="Selling Price"
              theme={theme}
            />

            <View style={styles.priceRow}>
              <TextInput
                label="Selling Price"
                value={sellingPriceText}
                onChangeText={val => {
                  const clean = clampDecimal(val);
                  setSellingPriceText(clean);
                  setSellingPrice(parseFloat(clean) || 0);
                }}
                onBlur={() => {
                  const clamped = parseFloat(sellingPrice.toFixed(2));
                  setSellingPrice(clamped);
                  setSellingPriceText(clamped.toFixed(2));
                }}
                mode="outlined"
                disabled={!purchase}
                keyboardType="decimal-pad"
                style={[styles.input, { flex: 1 }]}
              />
              {/* isTaxInclusive toggle (selling side) */}
              <TouchableOpacity
                style={[
                  styles.taxBadge,
                  {
                    backgroundColor:
                      taxOption?.id === 'with_tax'
                        ? theme.colors.primary
                        : theme.colors.surfaceVariant,
                    borderColor:
                      taxOption?.id === 'with_tax'
                        ? theme.colors.primary
                        : theme.colors.outline,
                  },
                ]}
                onPress={() =>
                  setTaxOption(prev =>
                    prev?.id === 'with_tax' ? defaultTaxOption : withTaxOption,
                  )
                }
              >
                <Icon
                  source={
                    taxOption?.id === 'with_tax'
                      ? 'check-decagram'
                      : 'minus-circle-outline'
                  }
                  size={13}
                  color={
                    taxOption?.id === 'with_tax'
                      ? theme.colors.onPrimary
                      : theme.colors.onSurfaceVariant
                  }
                />
                <Text
                  style={[
                    styles.taxBadgeText,
                    {
                      color:
                        taxOption?.id === 'with_tax'
                          ? theme.colors.onPrimary
                          : theme.colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {taxOption?.label || 'Exclude Tax'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sell-side discount (purchase mode only) */}
            {purchase && (
              <>
                <View style={styles.discountRow}>
                  <ToggleButton.Row
                    value={sellDiscountType}
                    onValueChange={val => {
                      if (!val || val === sellDiscountType) return;
                      const base = Number(sellingPrice || 0);
                      const current = Number(sellDiscountValue) || 0;
                      let next = current;
                      if (val === 'percent' && sellDiscountType === 'amount') {
                        next = base > 0 ? (current / base) * 100 : current;
                      } else if (
                        val === 'amount' &&
                        sellDiscountType === 'percent'
                      ) {
                        next = (base * current) / 100;
                      }
                      setSellDiscountType(val);
                      setSellDiscountValue(
                        parseFloat(next.toFixed(2)).toString(),
                      );
                    }}
                  >
                    <ToggleButton icon="currency-inr" value="amount" />
                    <ToggleButton icon="percent" value="percent" />
                  </ToggleButton.Row>

                  <TextInput
                    label={
                      sellDiscountType === 'percent'
                        ? 'Sell Discount (%)'
                        : 'Sell Discount (₹)'
                    }
                    value={sellDiscountValue}
                    onChangeText={val =>
                      setSellDiscountValue(clampDecimal(val))
                    }
                    onBlur={() => {
                      const cleaned = parseFloat(
                        Number(sellDiscountValue || 0).toFixed(2),
                      );
                      setSellDiscountValue(
                        isNaN(cleaned) ? '0' : cleaned.toString(),
                      );
                    }}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    style={{ flex: 1 }}
                    outlineColor={
                      Number(sellDiscountValue) > 0
                        ? theme.colors.primary
                        : undefined
                    }
                  />
                </View>

                <InfoRow
                  label="Selling Price (after discount)"
                  value={`₹ ${finalSellingPrice.toFixed(2)}`}
                  theme={theme}
                />
              </>
            )}

            {/* Non-purchase mode: discount on selling price */}
            {!purchase && (
              <>
                <View style={styles.discountRow}>
                  <ToggleButton.Row
                    value={discountType}
                    onValueChange={val => {
                      if (!val || val === discountType) return;
                      const base = Number(sellingPrice || 0);
                      const current = Number(discountValue) || 0;
                      let next = current;
                      if (val === 'percent' && discountType === 'amount') {
                        next = base > 0 ? (current / base) * 100 : current;
                      } else if (
                        val === 'amount' &&
                        discountType === 'percent'
                      ) {
                        next = (base * current) / 100;
                      }
                      setDiscountType(val);
                      setDiscountValue(parseFloat(next.toFixed(2)).toString());
                    }}
                  >
                    <ToggleButton icon="currency-inr" value="amount" />
                    <ToggleButton icon="percent" value="percent" />
                  </ToggleButton.Row>

                  <TextInput
                    label={
                      discountType === 'percent'
                        ? 'Discount (%)'
                        : 'Discount (₹)'
                    }
                    value={discountValue}
                    onChangeText={val => setDiscountValue(clampDecimal(val))}
                    onBlur={() => {
                      const cleaned = parseFloat(
                        Number(discountValue || 0).toFixed(2),
                      );
                      setDiscountValue(
                        isNaN(cleaned) ? '0' : cleaned.toString(),
                      );
                    }}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    style={{ flex: 1 }}
                    outlineColor={
                      isDiscountApplied ? theme.colors.primary : undefined
                    }
                  />
                </View>

                <InfoRow
                  label="Selling Price (after discount)"
                  value={`₹ ${price.toFixed(2)}`}
                  theme={theme}
                />
              </>
            )}

            {/* Selling Tax Rate chips (shown in both modes) */}
            <View style={styles.taxRateRow}>
              <Text
                style={[
                  styles.taxRateLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Selling GST Rate:
              </Text>
              <View style={styles.taxRateChips}>
                {TAX_RATES.map(r => {
                  const isSelected = r === 0 ? !taxRate : taxRate?.rate === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.taxChip,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.surfaceVariant,
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.outline,
                        },
                      ]}
                      onPress={() => {
                        if (r === 0) {
                          setTaxRate(null);
                        } else {
                          setTaxRate({ rate: r, label: `${r}% GST` });
                          if (taxOption?.id !== 'with_tax') {
                            setTaxOption(withTaxOption);
                          }
                        }
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: isSelected
                            ? theme.colors.onPrimary
                            : theme.colors.onSurfaceVariant,
                        }}
                      >
                        {r === 0 ? 'None' : `${r}%`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <Divider
              style={[
                styles.divider,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            />

            {/* ── QUANTITY ──────────────────────────────────────────────── */}
            <SectionHeader
              icon="package-variant"
              title="Quantity"
              theme={theme}
            />
            <TextInput
              label="Quantity"
              value={qtyInput}
              onChangeText={val => setQtyInput(val.replace(/[^0-9]/g, ''))}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
            />

            {/* ── UPDATE ────────────────────────────────────────────────── */}
            <Button
              mode="contained"
              disabled={qtyNumber <= 0}
              style={styles.updateButton}
              contentStyle={styles.updateButtonContent}
              onPress={() => {
                // Compute final purchase discount amount
                const baseForDiscount = purchase ? purchasePrice : sellingPrice;
                const discountAmount =
                  discountType === 'percent'
                    ? (baseForDiscount * discountNumeric) / 100
                    : discountNumeric;

                // Compute final sell discount amount
                const sellDiscNum = Number(sellDiscountValue) || 0;
                const sellDiscountAmt =
                  sellDiscountType === 'percent'
                    ? (sellingPrice * sellDiscNum) / 100
                    : sellDiscNum;

                onUpdate({
                  ...item,
                  hsn: hsnCodeText || item?.hsn || '',
                  mrp: Number(mrp) || 0,

                  // Purchase side
                  price: purchase ? Number(purchasePrice) : Number(price),
                  costPrice: purchase ? Number(purchasePrice) : undefined,

                  // Selling side
                  sellingPrice: Number(sellingPrice),
                  productOriginalPrice: Number(sellingPrice),

                  qty: qtyNumber,

                  // Purchase discount (flat ₹ per unit, ex-tax)
                  ...(purchase && {
                    purchaseDiscount: parseFloat(discountAmount.toFixed(2)),
                  }),

                  // Selling discount
                  discountPrice: parseFloat(sellDiscountAmt.toFixed(2)),
                  discountPercent:
                    sellDiscountType === 'percent' ? sellDiscNum : 0,
                  discountType: sellDiscountType,
                  sellDiscount: parseFloat(sellDiscountAmt.toFixed(2)),
                  sellDiscountType,
                  sellDiscountPercent:
                    sellDiscountType === 'percent' ? sellDiscNum : 0,

                  // Selling GST
                  gstRate: taxRate?.rate ?? 0,
                  isTaxInclusive: taxOption?.id === 'with_tax',

                  // Purchase GST
                  purchaseGstRate: purchaseTaxRate?.rate ?? 0,
                  isPurchaseTaxInclusive: purchaseTaxOption?.id === 'with_tax',
                });
              }}
            >
              Update Item
            </Button>
          </View>
        </BaseBottomSheet>

        <HsnCodeSelectorBottomSheet
          ref={hsnSelectorSheet.bottomSheetRef}
          selectedHsnCode={selectedHsnCode}
          onHsnCodeSelect={handleHsnCodeSelect}
          onAddNewHsnCode={() => {
            hsnSelectorSheet.close();
            setTimeout(() => hsnCreateSheet.expand(), 300);
          }}
          refreshKey={hsnCodeRefreshKey}
        />

        <AddHsnCodeBottomSheet
          ref={hsnCreateSheet.bottomSheetRef}
          onCreateHsnCode={handleHsnCodeCreated}
        />
      </>
    );
  },
);

export default PurchaseCartItemBottomSheet;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  divider: {
    marginVertical: 6,
  },
  input: {
    backgroundColor: 'transparent',
  },
  hsnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hsnAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 64,
    justifyContent: 'center',
    marginTop: 4,
  },
  hsnAddButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  hsnHint: {
    fontSize: 11,
    marginTop: -4,
    marginLeft: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 108,
    justifyContent: 'center',
  },
  taxBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taxRateRow: {
    gap: 6,
  },
  taxRateLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  taxRateChips: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  taxChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  infoLabel: {
    fontSize: 13,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  updateButton: {
    marginTop: 6,
    borderRadius: 10,
  },
  updateButtonContent: {
    paddingVertical: 4,
  },
});
