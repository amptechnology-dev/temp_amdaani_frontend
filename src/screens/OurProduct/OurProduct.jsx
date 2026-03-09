import React, { useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  Linking,
  Animated,
  StyleSheet,
  Platform,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Navbar from '../../components/Navbar';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const products = [
  {
    id: '1',
    name: 'AMP Thermal Printer',
    subtitle: '58mm Bluetooth',
    description:
      'High-speed thermal printer compatible with Android, iOS & Windows.',
    price: 1799,
    originalPrice: 1799,
    image:
      'https://cdn.amptechnology.in/0199dcb9-7d78-7000-8be8-56c84c67ba61.webp',
    badge: 'BESTSELLER',
    rating: 4.8,
    reviews: 120,
  },
  {
    id: '2',
    name: 'Thermal Paper Roll',
    subtitle: '58mm × 10m',
    description: 'Premium quality thermal rolls with long-lasting prints.',
    price: 20,
    originalPrice: 20,
    image:
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSDxCrG8KPWXoAf9bFDEVjYJsDUg_iRxQJt4pCd_636p5rHG8nzJvaR-eUumDox0cxnqpc&usqp=CAU',
    badge: 'POPULAR',
    rating: 4.6,
    reviews: 89,
  },
];

const ProductCard = ({ item, index, onBuyPress, theme, highlightedId }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(50)).current; // ← CHANGED: Start 50px below

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, [slideAnim, index]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const discount = Math.round(
    ((item.originalPrice - item.price) / item.originalPrice) * 100,
  );

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          transform: [{ scale: scaleAnim }],
          translateY: slideAnim,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onBuyPress(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor:
                highlightedId === item.id
                  ? theme.colors.primaryContainer // a highlighted background
                  : theme.colors.surface,
              ...generateBoxShadow(),
            },
          ]}
        >
          {/* Image Container - NO PADDING */}
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: item.image }}
              resizeMode="cover"
              style={styles.cardImage}
            />

            {/* Gradient Overlay */}
            {/* <View style={styles.gradientOverlay} /> */}

            {/* Badge */}
            {/* <View style={styles.badgeContainer}>
                            <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                                <Text style={styles.badgeText}>{item.badge}</Text>
                            </View>
                        </View> */}

            {/* Discount Badge */}
            {/* {discount > 0 && (
                            <View style={styles.discountBadge}>
                                <Text style={styles.discountText}>-{discount}%</Text>
                            </View>
                        )} */}
          </View>

          {/* Content Section */}
          <View style={styles.contentSection}>
            {/* Title & Subtitle */}
            <View style={styles.titleRow}>
              <View style={styles.titleContainer}>
                <Text
                  variant="titleMedium"
                  style={[
                    styles.productName,
                    { color: theme.colors.onSurface },
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  variant="bodySmall"
                  style={[
                    styles.subtitle,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                  numberOfLines={1}
                >
                  {item.subtitle}
                </Text>
              </View>
            </View>

            {/* Rating */}
            {/* <View style={styles.ratingContainer}>
                            <Icon name="star" size={14} color="#FFA000" />
                            <Text style={[styles.ratingText, { color: theme.colors.onSurface }]}>
                                {item.rating}
                            </Text>
                            <Text style={[styles.reviewText, { color: theme.colors.onSurfaceVariant }]}>
                                ({item.reviews} reviews)
                            </Text>
                        </View> */}

            {/* Description */}
            <Text
              variant="bodySmall"
              style={[
                styles.description,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={2}
            >
              {item.description}
            </Text>

            {/* Price & Action Row */}
            <View style={styles.bottomRow}>
              <View style={styles.priceContainer}>
                <Text
                  variant="titleLarge"
                  style={[styles.price, { color: theme.colors.primary }]}
                >
                  ₹{item.price.toLocaleString('en-IN')}
                </Text>
                {/* {item.originalPrice && (
                                    <Text
                                        variant="bodySmall"
                                        style={[styles.originalPrice, { color: theme.colors.onSurfaceVariant }]}
                                    >
                                        ₹{item.originalPrice.toLocaleString('en-IN')}
                                    </Text>
                                )} */}
              </View>

              <Button
                mode="contained"
                icon="whatsapp"
                buttonColor={theme.colors.primary}
                textColor="#fff"
                style={styles.buyButton}
                labelStyle={styles.buttonLabel}
                contentStyle={styles.buttonContent}
                onPress={() => onBuyPress(item)}
              >
                Buy Now
              </Button>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const OurProduct = () => {
  const theme = useTheme();
  const route = useRoute();
  const flatListRef = useRef(null);

  const [highlightedId, setHighlightedId] = React.useState(null);

  const openWhatsApp = item => {
    const phoneNumber = '918697972001';
    const message = `Hello! I am interested in buying *${item.name}* (₹${item.price}). Please share more details.`;
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(
      message,
    )}`;
    Linking.openURL(url).catch(err =>
      console.error('Error opening WhatsApp:', err),
    );
  };

  useEffect(() => {
    if (route.params?.id) {
      const productIndex = products.findIndex(p => p.id === route.params.id);
      if (productIndex !== -1 && flatListRef.current) {
        // scroll to product after short delay to ensure list rendered
        setTimeout(() => {
          flatListRef.current.scrollToIndex({
            index: productIndex,
            animated: true,
          });
          setHighlightedId(route.params.id);
          // remove highlight after 2 seconds
          setTimeout(() => setHighlightedId(null), 2000);
        }, 600);
      }
    }
  }, [route.params?.id]);

  const renderItem = ({ item, index }) => (
    <ProductCard
      item={item}
      index={index}
      onBuyPress={openWhatsApp}
      theme={theme}
      highlightedId={highlightedId}
    />
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar title="Our Products" />
      <FlatList
        ref={flatListRef}
        data={products}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

// Cross-Platform Shadow Generator
const generateBoxShadow = () => {
  if (Platform.OS === 'ios') {
    return {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
    };
  } else {
    return {
      elevation: 6,
      shadowColor: '#000',
    };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  cardContainer: {
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    height: 140,
  },
  cardImage: {
    height: '100%',
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  badge: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  discountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#D32F2F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  discountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  contentSection: {
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  titleContainer: {
    flex: 1,
  },
  productName: {
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.7,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  reviewText: {
    fontSize: 12,
    marginLeft: 4,
    opacity: 0.6,
  },
  description: {
    lineHeight: 18,
    marginBottom: 14,
    opacity: 0.85,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  price: {
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: -0.5,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    fontSize: 14,
    opacity: 0.5,
  },
  buyButton: {
    borderRadius: 10,
    elevation: 0,
  },
  buttonContent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default OurProduct;
