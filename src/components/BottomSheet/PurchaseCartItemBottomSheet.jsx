import React, { forwardRef, useState, useEffect, useCallback } from 'react';
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

    // ── Selling Price ──────────────────────────────────────────────────────
    const initSellingPrice = parseFloat(
      Number(
        purchase
          ? item?.productOriginalPrice ?? item?.sellingPrice ?? 0
          : item?.sellingPrice ?? item?.price ?? 0,
      ).toFixed(2),
    );
    const [sellingPrice, setSellingPrice] = useState(initSellingPrice);
    const [sellingPriceText, setSellingPriceText] = useState(
      toFixed2(initSellingPrice),
    );

    // ── Purchase Price ─────────────────────────────────────────────────────
    const initPurchasePrice = parseFloat(
      Number(
        item?.price ?? item?.lastPurchasePrice ?? item?.costPrice ?? 0,
      ).toFixed(2),
    );
    const [purchasePrice, setPurchasePrice] = useState(initPurchasePrice);
    const [purchasePriceText, setPurchasePriceText] = useState(
      toFixed2(initPurchasePrice),
    );

    // ── MRP ───────────────────────────────────────────────────────────────
    const [mrp, setMrp] = useState(String(item?.mrp || ''));

    // ── Tax Options ────────────────────────────────────────────────────────
    const defaultTaxOption = { id: 'without_tax', label: 'No Tax' };
    const withTaxOption = { id: 'with_tax', label: 'With Tax' };

    const initTaxOption = item?.isTaxInclusive
      ? withTaxOption
      : defaultTaxOption;
    const initTaxRate =
      item?.gstRate && Number(item.gstRate) > 0
        ? { rate: Number(item.gstRate), label: `${item.gstRate}% GST` }
        : null;
    const initPurchaseTaxOption = item?.isPurchaseTaxInclusive
      ? withTaxOption
      : defaultTaxOption;
    const initPurchaseTaxRate =
      item?.purchaseGstRate && Number(item.purchaseGstRate) > 0
        ? {
            rate: Number(item.purchaseGstRate),
            label: `${item.purchaseGstRate}% GST`,
          }
        : null;

    const [taxOption, setTaxOption] = useState(initTaxOption);
    const [taxRate, setTaxRate] = useState(initTaxRate);
    const [purchaseTaxOption, setPurchaseTaxOption] = useState(
      initPurchaseTaxOption,
    );
    const [purchaseTaxRate, setPurchaseTaxRate] = useState(initPurchaseTaxRate);

    // ── Sell discount (only when purchase=true — for selling price side) ───
    const [sellDiscountType, setSellDiscountType] = useState('amount');
    const [sellDiscountValue, setSellDiscountValue] = useState('0');
    const [finalSellingPrice, setFinalSellingPrice] =
      useState(initSellingPrice);

    // ── Purchase discount ──────────────────────────────────────────────────
    const [discountType, setDiscountType] = useState(
      item?.discountType || (item?.discountPercent ? 'percent' : 'amount'),
    );
    const [discountValue, setDiscountValue] = useState(() => {
      const raw =
        item?.discountType === 'percent'
          ? Number(item?.discountPercent ?? 0)
          : Number(item?.discountPrice ?? item?.discount ?? 0);
      return toFixed2(raw);
    });

    // ── Price after discount ───────────────────────────────────────────────
    const [price, setPrice] = useState(() => {
      const base = parseFloat(
        Number(
          purchase
            ? item?.price ?? item?.lastPurchasePrice ?? item?.costPrice ?? 0
            : item?.sellingPrice ?? item?.price ?? 0,
        ).toFixed(2),
      );
      const flat = Number(item?.discountPrice ?? item?.discount ?? 0);
      const pct = Number(item?.discountPercent ?? 0);
      const result =
        pct > 0
          ? Math.max(0, base - (base * pct) / 100)
          : Math.max(0, base - flat);
      return parseFloat(result.toFixed(2));
    });

    // ── Quantity ───────────────────────────────────────────────────────────
    const [qtyInput, setQtyInput] = useState(String(item?.qty || 1));
    const qtyNumber = Number(qtyInput) || 0;

    // ── Sync when item changes ─────────────────────────────────────────────
    useEffect(() => {
      if (!item) return;

      if (purchase) {
        const sp = parseFloat(
          Number(item?.productOriginalPrice ?? item?.sellingPrice ?? 0).toFixed(
            2,
          ),
        );
        const pp = parseFloat(
          Number(
            item?.price ?? item?.lastPurchasePrice ?? item?.costPrice ?? 0,
          ).toFixed(2),
        );
        setSellingPrice(sp);
        setSellingPriceText(toFixed2(sp));
        setPurchasePrice(pp);
        setPurchasePriceText(toFixed2(pp));
        setDiscountType('amount');
        setDiscountValue(toFixed2(item.purchaseDiscount ?? 0));
        setPrice(
          parseFloat(Math.max(0, pp - (item.purchaseDiscount ?? 0)).toFixed(2)),
        );
      } else {
        const sp = parseFloat(
          Number(item?.sellingPrice ?? item?.price ?? 0).toFixed(2),
        );
        setSellingPrice(sp);
        setSellingPriceText(toFixed2(sp));
        const flat = Number(item?.discountPrice ?? item?.discount ?? 0);
        const pct = Number(item?.discountPercent ?? 0);
        setDiscountType(item?.discountType || (pct > 0 ? 'percent' : 'amount'));
        setDiscountValue(
          item?.discountType === 'percent' ? toFixed2(pct) : toFixed2(flat),
        );
        setPrice(
          parseFloat(
            (pct > 0
              ? Math.max(0, sp - (sp * pct) / 100)
              : Math.max(0, sp - flat)
            ).toFixed(2),
          ),
        );
      }

      setMrp(String(item?.mrp || ''));
      setQtyInput(String(item?.qty || 1));
      setTaxOption(item?.isTaxInclusive ? withTaxOption : defaultTaxOption);
      setTaxRate(
        item?.gstRate && Number(item.gstRate) > 0
          ? { rate: Number(item.gstRate), label: `${item.gstRate}% GST` }
          : null,
      );
      setPurchaseTaxOption(
        item?.isPurchaseTaxInclusive ? withTaxOption : defaultTaxOption,
      );
      setPurchaseTaxRate(
        item?.purchaseGstRate && Number(item.purchaseGstRate) > 0
          ? {
              rate: Number(item.purchaseGstRate),
              label: `${item.purchaseGstRate}% GST`,
            }
          : null,
      );
      setSellDiscountType('amount');
      setSellDiscountValue('0');
      setFinalSellingPrice(
        item?.productOriginalPrice ?? item?.sellingPrice ?? 0,
      );
    }, [item]);

    // ── Recompute price after purchase discount ────────────────────────────
    useEffect(() => {
      const base = purchase
        ? Number(purchasePrice || 0)
        : Number(sellingPrice || 0);
      const value = Number(discountValue) || 0;
      const disc = discountType === 'percent' ? (base * value) / 100 : value;
      setPrice(parseFloat(Math.max(0, base - disc).toFixed(2)));
    }, [discountValue, discountType, purchase ? purchasePrice : sellingPrice]);

    // ── Recompute final selling price (purchase mode) ──────────────────────
    useEffect(() => {
      if (!purchase) return;
      const base = Number(sellingPrice || 0);
      const value = Number(sellDiscountValue) || 0;
      const disc =
        sellDiscountType === 'percent' ? (base * value) / 100 : value;
      setFinalSellingPrice(parseFloat(Math.max(0, base - disc).toFixed(2)));
    }, [sellDiscountValue, sellDiscountType, sellingPrice]);

    // ── Tax rate helpers ───────────────────────────────────────────────────
    const TAX_RATES = [0, 5, 12, 18, 28];
    const getTaxRateText = rate => (rate ? `${rate.rate}%` : 'No Tax');

    const discountNumeric = Number(discountValue) || 0;
    const isDiscountApplied = discountNumeric > 0;

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
      <BaseBottomSheet
        ref={ref}
        initialSnapIndex={-1}
        contentType="scroll"
        snapPoints={['60%', '95%']}
        enablePanDownToClose
        title={`Edit — ${item?.name || ''}`}
      >
        <View style={styles.container}>
          {/* ── PRODUCT INFO ──────────────────────────────────────────────── */}
          {item?.sku ? (
            <InfoRow label="SKU" value={item.sku} theme={theme} />
          ) : null}
          {item?.hsn ? (
            <InfoRow label="HSN/SAC" value={item.hsn} theme={theme} />
          ) : null}

          {/* ── MRP ───────────────────────────────────────────────────────── */}
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

          {/* ── PURCHASE PRICE SECTION ────────────────────────────────────── */}
          {purchase && (
            <>
              <SectionHeader
                icon="currency-inr"
                title="Purchase Rate"
                theme={theme}
              />

              {/* Purchase Price + Tax toggle */}
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
                    {purchaseTaxOption?.label ?? 'No Tax'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Purchase Discount */}
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
                    } else if (val === 'amount' && discountType === 'percent') {
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
                    discountType === 'percent' ? 'Discount (%)' : 'Discount (₹)'
                  }
                  value={discountValue}
                  onChangeText={val => setDiscountValue(clampDecimal(val))}
                  onBlur={() => {
                    const cleaned = parseFloat(
                      Number(discountValue || 0).toFixed(2),
                    );
                    setDiscountValue(isNaN(cleaned) ? '0' : cleaned.toString());
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
                  Purchase Tax Rate:
                </Text>
                <View style={styles.taxRateChips}>
                  {TAX_RATES.map(r => {
                    const isSelected =
                      r === 0 ? !purchaseTaxRate : purchaseTaxRate?.rate === r;
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
                            setPurchaseTaxRate({ rate: r, label: `${r}% GST` });
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

              {/* Price after discount */}
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

          {/* ── SELLING PRICE SECTION ─────────────────────────────────────── */}
          <SectionHeader
            icon="tag-multiple-outline"
            title="Selling Price"
            theme={theme}
          />

          {/* Selling Price + Tax toggle */}
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
              // In non-purchase mode editing selling price changes the discount base
              disabled={!purchase ? true : false}
              keyboardType="decimal-pad"
              style={[styles.input, { flex: 1 }]}
            />
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
                {taxOption?.label ?? 'No Tax'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sell-side discount (purchase mode only — lets you set a customer discount on the selling price) */}
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
                  onChangeText={val => setSellDiscountValue(clampDecimal(val))}
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
                    } else if (val === 'amount' && discountType === 'percent') {
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
                    discountType === 'percent' ? 'Discount (%)' : 'Discount (₹)'
                  }
                  value={discountValue}
                  onChangeText={val => setDiscountValue(clampDecimal(val))}
                  onBlur={() => {
                    const cleaned = parseFloat(
                      Number(discountValue || 0).toFixed(2),
                    );
                    setDiscountValue(isNaN(cleaned) ? '0' : cleaned.toString());
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

          {/* Sales Tax Rate chips */}

          <Divider
            style={[
              styles.divider,
              { backgroundColor: theme.colors.outlineVariant },
            ]}
          />

          {/* ── QUANTITY ─────────────────────────────────────────────────── */}
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

          {/* ── UPDATE ───────────────────────────────────────────────────── */}
          <Button
            mode="contained"
            disabled={qtyNumber <= 0}
            style={styles.updateButton}
            contentStyle={styles.updateButtonContent}
            onPress={() => {
              const baseForDiscount = purchase ? purchasePrice : sellingPrice;
              const discountAmount =
                discountType === 'percent'
                  ? (baseForDiscount * discountNumeric) / 100
                  : discountNumeric;

              const sellDiscNum = Number(sellDiscountValue) || 0;
              const sellDiscountAmt =
                sellDiscountType === 'percent'
                  ? (sellingPrice * sellDiscNum) / 100
                  : sellDiscNum;

              onUpdate({
                ...item,
                mrp: Number(mrp) || 0,
                // Price stored in cart depends on mode
                price: purchase ? Number(purchasePrice) : Number(price),
                sellingPrice: Number(sellingPrice),
                qty: qtyNumber,

                // Purchase-side discount
                ...(purchase && {
                  purchaseDiscount: parseFloat(discountAmount.toFixed(2)),
                }),
                discountPrice: parseFloat(discountAmount.toFixed(2)),
                discountPercent:
                  discountType === 'percent' ? discountNumeric : 0,
                discountType,

                // Selling-side discount (purchase mode)
                ...(purchase && {
                  sellDiscount: parseFloat(sellDiscountAmt.toFixed(2)),
                  sellDiscountType,
                  sellDiscountPercent:
                    sellDiscountType === 'percent' ? sellDiscNum : 0,
                }),

                // Tax
                gstRate: taxRate?.rate ?? 0,
                isTaxInclusive: taxOption?.id === 'with_tax',
                purchaseGstRate: purchaseTaxRate?.rate ?? 0,
                isPurchaseTaxInclusive: purchaseTaxOption?.id === 'with_tax',
              });
            }}
          >
            Update Item
          </Button>
        </View>
      </BaseBottomSheet>
    );
  },
);

export default PurchaseCartItemBottomSheet;

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },

  // Section header
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

  // Divider
  divider: {
    marginVertical: 6,
  },

  // Inputs
  input: {
    backgroundColor: 'transparent',
  },

  // Price row (price input + tax badge side by side)
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Tax option badge/button
  taxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 88,
    justifyContent: 'center',
  },
  taxBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Discount row (toggle + input)
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Tax rate chips
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

  // Info row (read-only summary)
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

  // Update button
  updateButton: {
    marginTop: 6,
    borderRadius: 10,
  },
  updateButtonContent: {
    paddingVertical: 4,
  },
});
