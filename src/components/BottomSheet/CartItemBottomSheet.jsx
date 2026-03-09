// CartItemBottomSheet.jsx
import React, { forwardRef, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  TextInput,
  Button,
  useTheme,
  ToggleButton,
  Divider,
  Text,
} from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';

const CartItemBottomSheet = forwardRef(({ item, onUpdate, purchase }, ref) => {
  // console.log("CartItemBottomSheet item:", item);
  const theme = useTheme();
  // make selling price editable by the user
  const initialSellingPrice = purchase
    ? Number(item?.productOriginalPrice ?? item?.sellingPrice ?? 0) // Use product's original selling price in purchase mode
    : Number(item?.sellingPrice ?? item?.price ?? 0); // Use selling price in sales mode

  const [sellingPrice, setSellingPrice] = useState(initialSellingPrice);

  const [purchasePrice, setPurchasePrice] = useState(
    purchase
      ? Number(item?.price ?? item?.lastPurchasePrice ?? item?.costPrice ?? 0)
      : 0,
  );

  // SELLING PRICE DISCOUNT (ONLY FOR PURCHASE MODE)
  const [sellDiscountType, setSellDiscountType] = useState('amount');
  const [sellDiscountValue, setSellDiscountValue] = useState('0');
  const [finalSellingPrice, setFinalSellingPrice] = useState(sellingPrice);

  useEffect(() => {
    if (!purchase) return;

    const base = Number(sellingPrice || 0);
    const value = Number(sellDiscountValue) || 0;

    const discountAmount =
      sellDiscountType === 'percent' ? (base * value) / 100 : value;

    setFinalSellingPrice(Math.max(0, base - discountAmount));
  }, [sellDiscountValue, sellDiscountType, sellingPrice]);

  // keep quantity as a string while the user types so backspace/partial input is allowed
  const [qtyInput, setQtyInput] = useState(String(item?.qty || 1));

  // derived numeric quantity (0 when empty or invalid)
  const qtyNumber = Number(qtyInput) || 0;

  // price displayed after applying discount (read-only)
  const [price, setPrice] = useState(() => {
    const base = purchase
      ? Number(item?.price ?? item?.lastPurchasePrice ?? item?.costPrice ?? 0)
      : Number(item?.price ?? item?.sellingPrice ?? 0);
    const flat = Number(item?.discountPrice ?? item?.discount ?? 0);
    const pct = Number(item?.discountPercent ?? 0);
    if (item?.discountType === 'percent' || pct > 0) {
      return Math.max(0, base - (base * pct) / 100);
    }
    return Math.max(0, base - flat);
  });

  const [qty, setQty] = useState(item?.qty || 1);

  // discount controls
  const [discountType, setDiscountType] = useState(
    item?.discountType || (item?.discountPercent ? 'percent' : 'amount'),
  );
  const [discountValue, setDiscountValue] = useState(() => {
    if (item?.discountType === 'percent')
      return String(item?.discountPercent ?? 0);
    return String(item?.discountPrice ?? item?.discount ?? 0);
  });

  useEffect(() => {
    if (!item) return;

    if (purchase) {
      // In purchase mode, show the product's original selling price if available
      setSellingPrice(
        Number(item?.productOriginalPrice ?? item?.sellingPrice ?? 0),
      );
      if (purchase && Number(item?.sellingDiscount) > 0) {
        setSellDiscountType('amount');
        setSellDiscountValue(String(item.sellingDiscount));
      }
    } else {
      // In sales mode, show the current selling price
      setSellingPrice(Number(item?.sellingPrice ?? item?.price ?? 0));
    }

    if (purchase) {
      setPurchasePrice(
        Number(item?.price ?? item?.lastPurchasePrice ?? item?.costPrice ?? 0),
      );
    }

    const base = item?.price ?? item?.sellingPrice ?? 0;
    const flat = Number(item?.discountPrice ?? item?.discount ?? 0);
    const pct = Number(item?.discountPercent ?? 0);

    // restore qty input as string when item changes
    setQtyInput(String(item.qty || 1));
    if (purchase) {
      // PURCHASE MODE → no default discount
      setDiscountType('amount');
      setDiscountValue('0'); // user must enter manually
      setPrice(base); // final price = base until user adds discount
    } else {
      setDiscountType(item?.discountType || (pct > 0 ? 'percent' : 'amount'));
      setDiscountValue(
        item?.discountType === 'percent' ? String(pct) : String(flat),
      );

      if (pct > 0) {
        setPrice(Math.max(0, base - (base * pct) / 100));
      } else {
        setPrice(Math.max(0, base - flat));
      }
    }

    // compute effective price - don't override selling price here as it's already set above
    if (item?.discountType === 'percent' || pct > 0) {
      setPrice(Math.max(0, base - (base * pct) / 100));
    } else {
      setPrice(Math.max(0, base - flat));
    }
  }, [item]);

  // recompute price when discount inputs change
  useEffect(() => {
    const base = purchase
      ? Number(purchasePrice || 0)
      : Number(sellingPrice || 0);
    const value = Number(discountValue) || 0;
    let discountAmount = 0;
    if (discountType === 'percent') {
      discountAmount = (base * value) / 100;
    } else {
      discountAmount = value;
    }
    setPrice(Math.max(0, base - discountAmount));
  }, [discountValue, discountType, purchase ? purchasePrice : sellingPrice]);

  // highlight discount input when a non-zero discount is applied
  const discountNumeric = Number(discountValue) || 0;
  const isDiscountApplied = discountNumeric > 0;

  return (
    <BaseBottomSheet
      ref={ref}
      initialSnapIndex={-1}
      contentType="scroll"
      snapPoints={['50%', '95%']}
      enablePanDownToClose={true}
      title={`Edit ${item?.name || ''}`}
    >
      <View style={styles.container}>
        {purchase ? (
          <>
            <TextInput
              label="Purchase Rate"
              value={String(purchasePrice)}
              onChangeText={val => setPurchasePrice(Number(val) || 0)}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              theme={{ roundness: 12 }}
            />
            {item?.lastPurchasePrice > 0 && (
              <Text style={styles.lastPurchaseText}>
                Last Purchase Rate: ₹{item.lastPurchasePrice}
              </Text>
            )}
          </>
        ) : (
          <TextInput
            label="Selling Price"
            value={String(sellingPrice)}
            onChangeText={val => setSellingPrice(Number(val) || 0)}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
            theme={{ roundness: 12 }}
          />
        )}
        {/* Discount controls: type + value */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ToggleButton.Row
            style={{ borderRadius: 12 }}
            onValueChange={val => setDiscountType(val)}
            value={discountType}
          >
            <ToggleButton
              style={{ borderRadius: 12 }}
              icon="currency-inr"
              value="amount"
              accessibilityLabel="Flat discount"
            />
            <ToggleButton
              style={{ borderRadius: 12 }}
              icon="percent"
              value="percent"
              accessibilityLabel="Percentage discount"
            />
          </ToggleButton.Row>

          <TextInput
            label={
              purchase
                ? discountType === 'percent'
                  ? 'Purchase Discount (%)'
                  : 'Purchase Discount (₹)'
                : discountType === 'percent'
                ? 'Discount (%)'
                : 'Discount (₹)'
            }
            value={String(discountValue)}
            onChangeText={val => setDiscountValue(val)}
            mode="outlined"
            keyboardType="numeric"
            style={[styles.input, { flex: 1 }]}
            outlineColor={isDiscountApplied ? theme.colors.primary : undefined}
            activeOutlineColor={
              isDiscountApplied ? theme.colors.primary : undefined
            }
            theme={{ roundness: 12 }}
          />
        </View>
        <View
          style={[
            styles.readonlyBlock,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Text style={styles.readonlyLabel}>
            {purchase
              ? 'Purchase Rate (after discount)'
              : 'Selling Price (after discount)'}
          </Text>
          <Text style={[styles.readonlyValue]}>₹ {price}</Text>
        </View>
        {purchase && (
          <>
            <Divider bold style={styles.divider} />
            <TextInput
              label="Selling Price"
              value={String(sellingPrice)}
              onChangeText={val => setSellingPrice(Number(val) || 0)}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              theme={{ roundness: 12 }}
            />

            {/* SELLING PRICE DISCOUNT */}
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <ToggleButton.Row
                style={{ borderRadius: 12 }}
                value={sellDiscountType}
                onValueChange={val => setSellDiscountType(val)}
              >
                <ToggleButton
                  style={{ borderRadius: 12 }}
                  icon="currency-inr"
                  value="amount"
                />
                <ToggleButton
                  style={{ borderRadius: 12 }}
                  icon="percent"
                  value="percent"
                />
              </ToggleButton.Row>

              <TextInput
                label={
                  sellDiscountType === 'percent'
                    ? 'Selling Discount (%)'
                    : 'Selling Discount (₹)'
                }
                value={sellDiscountValue}
                onChangeText={setSellDiscountValue}
                keyboardType="numeric"
                mode="outlined"
                style={[styles.input, { flex: 1 }]}
                theme={{ roundness: 12 }}
              />
            </View>

            <View
              style={[
                styles.readonlyBlock,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <Text style={styles.readonlyLabel}>
                Selling Price (after discount)
              </Text>
              <Text style={styles.readonlyValue}>₹ {finalSellingPrice}</Text>
            </View>
          </>
        )}

        <Divider bold style={styles.divider} />
        <TextInput
          label="Quantity"
          value={qtyInput}
          onChangeText={val => {
            // allow empty string while typing, strip non-digit chars
            const sanitized = val.replace(/[^0-9]/g, '');
            setQtyInput(sanitized);
          }}
          mode="outlined"
          keyboardType="numeric"
          style={styles.input}
          theme={{ roundness: 12 }}
        />

        <Button
          mode="contained"
          disabled={qtyNumber <= 0}
          onPress={() => {
            try {
              const base = Number(sellingPrice || 0);
              const val = Number(discountValue) || 0;
              const discountAmount =
                discountType === 'percent' ? (base * val) / 100 : val;
              // compute final per-unit price explicitly (use this to send back)
              // const finalPrice = Math.max(0, base - discountAmount);

              // For compatibility with parent calculations, always send the raw selling price
              // as `price` (override price) and `sellingPrice`. Send the computed discount as
              // `discountPrice` (flat amount). If percentage was selected, also include discountPercent.
              // console.log('CartItemBottomSheet: Update pressed', { itemId: item?._id, base, discountType, discountValue: val, discountAmount, qty, onUpdatePresent: typeof onUpdate === 'function' });

              if (typeof onUpdate !== 'function') {
                console.warn(
                  'CartItemBottomSheet: onUpdate is not a function or not provided',
                );
                return;
              }

              onUpdate({
                ...item,

                // In purchase mode, we want to keep the original selling price
                // and only update the purchase price with any discount applied
                ...(purchase
                  ? {
                      // For purchase mode
                      price: Number(purchasePrice), // This is the base purchase price before discount
                      sellingPrice: Number(sellingPrice), // This is the future selling price
                      purchasePrice: Number(purchasePrice), // Explicitly set purchase price
                      lastPurchasePrice: Number(purchasePrice), // Update last purchase price
                      // sellingPrice: sellingPrice,

                      // ✅ REQUIRED PARAMETER
                      sellingDiscount:
                        sellDiscountType === 'percent'
                          ? (sellingPrice * (Number(sellDiscountValue) || 0)) /
                            100
                          : Number(sellDiscountValue) || 0,

                      sellingDiscountType: sellDiscountType,
                    }
                  : {
                      // For sales mode
                      price: Number(price), // This is the final price after discount
                      sellingPrice: Number(sellingPrice), // This is the base price before discount
                    }),

                qty: qtyNumber,

                // DISCOUNT (same for both modes)
                discountPrice: 0,
                discountPercent: 0,
                discountType: 'amount',

                _manualDiscountApplied: true,
              });
            } catch (err) {
              console.error(
                'CartItemBottomSheet: error in Update handler',
                err,
              );
            }
          }}
          style={styles.button}
        >
          Update
        </Button>
      </View>
    </BaseBottomSheet>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  lastPurchaseText: {
    fontSize: 12,
    color: '#777',
    marginTop: -14,
    // marginBottom: 6,
    fontStyle: 'italic',
  },

  input: {
    marginBottom: 6,
    height: 42,
  },
  button: {
    marginTop: 8,
  },
  readonlyBlock: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },

  readonlyLabel: {
    fontSize: 12,
    color: '#666',
  },

  readonlyValue: {
    fontSize: 16,
    fontWeight: '700',
  },

  divider: {},

  sectionDivider: {
    marginVertical: 12,
    height: 1.2,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
});

CartItemBottomSheet.displayName = 'CartItemBottomSheet';
export default CartItemBottomSheet;
