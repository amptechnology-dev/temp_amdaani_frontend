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
  const theme = useTheme();

  console.log('itms--->', item);

  const initialSellingPrice = purchase
    ? Number(item?.productOriginalPrice ?? item?.sellingPrice ?? 0)
    : Number(item?.sellingPrice ?? item?.price ?? 0);

  const [sellingPrice, setSellingPrice] = useState(initialSellingPrice);
  const [isDiscountChanged, setIsDiscountChanged] = useState(false);

  const [purchasePrice, setPurchasePrice] = useState(
    purchase
      ? Number(item?.price ?? item?.lastPurchasePrice ?? item?.costPrice ?? 0)
      : 0,
  );

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

  const [qtyInput, setQtyInput] = useState(String(item?.qty || 1));
  const qtyNumber = Number(qtyInput) || 0;

  const [price, setPrice] = useState(() => {
    const base = purchase
      ? Number(item?.price ?? item?.lastPurchasePrice ?? item?.costPrice ?? 0)
      : Number(item?.sellingPrice ?? item?.price ?? 0);
    const flat = Number(item?.discountPrice ?? item?.discount ?? 0);
    // FIX: read discountPercentage first (API field), fallback to discountPercent
    const pct = Number(item?.discountPercentage ?? item?.discountPercent ?? 0);
    const type = item?.discountType ?? 'amount';

    if (type === 'percentage' || type === 'percent') {
      return Math.max(0, base - (base * pct) / 100);
    }
    return Math.max(0, base - flat);
  });

  const normaliseDiscountType = raw => {
    if (raw === 'percentage' || raw === 'percent') return 'percent';
    return 'amount';
  };

  const [discountType, setDiscountType] = useState(
    normaliseDiscountType(item?.discountType),
  );

  const [discountValue, setDiscountValue] = useState(() => {
    if (!item) return '0';
    // API sends 'percentage', UI toggle uses 'percent' — normalise both
    const type = item?.discountType ?? 'amount';
    if (type === 'percentage' || type === 'percent') {
      return String(item?.discountPercentage ?? item?.discountPercent ?? 0);
    }
    return String(item?.discountPrice ?? item?.discount ?? 0);
  });

  useEffect(() => {
    if (!item) return;

    setIsDiscountChanged(false);

    if (purchase) {
      setSellingPrice(
        Number(item?.productOriginalPrice ?? item?.sellingPrice ?? 0),
      );
    } else {
      setSellingPrice(Number(item?.sellingPrice ?? item?.price ?? 0));
    }

    if (purchase) {
      setPurchasePrice(
        Number(item?.price ?? item?.lastPurchasePrice ?? item?.costPrice ?? 0),
      );
    }

    const base = Number(item?.sellingPrice ?? item?.price ?? 0);
    const flat = Number(item?.discountPrice ?? item?.discount ?? 0);

    // FIX: read discountPercentage (API field) not discountPercent
    const pct = Number(item?.discountPercentage ?? item?.discountPercent ?? 0);

    setQtyInput(String(item.qty || 1));

    if (purchase) {
      setDiscountType('amount');
      setDiscountValue('0');
      setPrice(base);
    } else {
      // FIX: normalise 'percentage' → 'percent' for ToggleButton
      const normType = normaliseDiscountType(item?.discountType);
      setDiscountType(normType);

      // FIX: if percentage, show the % number; if amount, show the ₹ number
      if (normType === 'percent') {
        setDiscountValue(String(pct));
        setPrice(Math.max(0, base - (base * pct) / 100));
      } else {
        setDiscountValue(String(flat));
        setPrice(Math.max(0, base - flat));
      }
    }
  }, [item]);

  useEffect(() => {
    const base = purchase
      ? Number(purchasePrice || 0)
      : Number(sellingPrice || 0);
    const value = Number(discountValue) || 0;

    const discountAmount =
      discountType === 'percent' ? (base * value) / 100 : value;

    setPrice(Math.max(0, base - discountAmount));
  }, [discountValue, discountType, purchase ? purchasePrice : sellingPrice]);

  const discountNumeric = Number(discountValue) || 0;
  const isDiscountApplied = discountNumeric > 0;

  return (
    <BaseBottomSheet
      ref={ref}
      initialSnapIndex={-1}
      contentType="scroll"
      snapPoints={['50%', '95%']}
      enablePanDownToClose
      title={`Edit ${item?.name || ''}`}
    >
      <View style={styles.container}>
        {/* SELLING PRICE */}
        {!purchase && (
          <TextInput
            label="Selling Price"
            value={String(sellingPrice)}
            onChangeText={val => setSellingPrice(Number(val) || 0)}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
          />
        )}

        {/* DISCOUNT */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ToggleButton.Row
            value={discountType}
            onValueChange={val => {
              setDiscountType(val);
              setIsDiscountChanged(true); // ✅ FIX
            }}
          >
            <ToggleButton icon="currency-inr" value="amount" />
            <ToggleButton icon="percent" value="percent" />
          </ToggleButton.Row>

          <TextInput
            label={discountType === 'percent' ? 'Discount (%)' : 'Discount (₹)'}
            value={String(discountValue)}
            onChangeText={val => {
              setDiscountValue(val);
              setIsDiscountChanged(true); // ✅ FIX
            }}
            mode="outlined"
            keyboardType="numeric"
            style={{ flex: 1 }}
            outlineColor={isDiscountApplied ? theme.colors.primary : undefined}
          />
        </View>

        {/* PRICE AFTER DISCOUNT */}
        <View style={[styles.readonlyBlock]}>
          <Text>Selling Price (after discount)</Text>
          <Text>₹ {price}</Text>
        </View>

        {/* QUANTITY */}
        <TextInput
          label="Quantity"
          value={qtyInput}
          onChangeText={val => {
            const sanitized = val.replace(/[^0-9]/g, '');
            setQtyInput(sanitized);
          }}
          mode="outlined"
          keyboardType="numeric"
          style={styles.input}
        />

        {/* UPDATE BUTTON */}
        <Button
          mode="contained"
          disabled={qtyNumber <= 0}
          onPress={() => {
            const isPercent = discountType === 'percent';
            onUpdate({
              ...item,
              price: Number(price),
              sellingPrice: Number(sellingPrice),
              qty: qtyNumber,
              discountPrice: isPercent
                ? (sellingPrice * discountNumeric) / 100 // computed flat ₹
                : discountNumeric,
              discountPercent: isPercent ? discountNumeric : 0,
              discountPercentage: isPercent ? discountNumeric : 0, // ← ADD: matches API field name
              discountType: isPercent ? 'percentage' : 'amount', // ← normalise back to API format
            });
          }}
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
