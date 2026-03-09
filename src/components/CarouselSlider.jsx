import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import { useTheme } from 'react-native-paper';
import ShimmerPlaceHolder from 'react-native-shimmer-placeholder';
import LinearGradient from 'react-native-linear-gradient';
import api from '../utils/api';
import { CarouselSkeleton } from './Skeletons';

const { width } = Dimensions.get('window');

const CarouselSlider = ({ height = 120, borderRadius = 12 }) => {
  const theme = useTheme();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAds = useCallback(async () => {
    try {
      const res = await api.get('/ads?isActive=true&running=true');
      if (res.success && Array.isArray(res.data)) {
        const mappedAds = res.data.map(ad => ({
          title: ad.title,
          image: ad.imageUrl,
          redirectUrl: ad.redirectUrl,
        }));
        setAds(mappedAds);
      }
    } catch (err) {
      // console.log('Error fetching ads:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const renderItem = useCallback(
    ({ item }) => (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.slide, { borderRadius }]}
        onPress={() => {
          if (item.redirectUrl) Linking.openURL(item.redirectUrl);
        }}
      >
        <Image
          source={{ uri: item.image }}
          style={[styles.image, { borderRadius }]}
          resizeMode="cover"
        />
      </TouchableOpacity>
    ),
    [borderRadius],
  );

  return (
    <View>
      {loading ? (
        <CarouselSkeleton height={height} borderRadius={borderRadius} slides={3} />
      ) : ads.length > 0 ? (
        <Carousel
          loop
          width={width}
          height={height}
          autoPlay
          scrollAnimationDuration={3000}
          data={ads}
          mode="parallax"
          modeConfig={{
            parallaxScrollingScale: 0.9,
            parallaxScrollingOffset: 60,
            parallaxAdjacentItemScale: 0.8,
          }}
          renderItem={renderItem}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  slide: {
    flex: 1,
    marginHorizontal: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default CarouselSlider;
