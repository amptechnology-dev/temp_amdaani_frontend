import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  StatusBar,
  Linking,
  Image,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Button,
  useTheme,
  Card,
  IconButton,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useRoute } from '@react-navigation/native';
import Navbar from '../../components/Navbar';
import api from '../../utils/api';

const { width: screenWidth } = Dimensions.get('window');

const TagTutorial = () => {
  const route = useRoute();
  const { from } = route.params || {};
  const theme = useTheme();

  const [video, setVideo] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const playerRef = useRef(null);

  // Capitalize the first letter of tag
  const capitalizeFirstLetter = str => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const formattedTag = capitalizeFirstLetter(from);

  // Extract YouTube video ID from URL
  const extractVideoId = url => {
    if (!url || typeof url !== 'string') return '';

    try {
      // Handle short URLs like https://youtu.be/abc123
      if (url.includes('youtu.be/')) {
        return url.split('youtu.be/')[1].split(/[?&]/)[0];
      }

      // Handle standard watch URLs like https://www.youtube.com/watch?v=abc123
      if (url.includes('v=')) {
        const params = new URL(url).searchParams;
        return params.get('v');
      }

      // Handle embed URLs like https://www.youtube.com/embed/abc123
      if (url.includes('/embed/')) {
        return url.split('/embed/')[1].split(/[?&]/)[0];
      }

      // Handle share links or other formats
      const regex = /(?:v=|\/)([0-9A-Za-z_-]{11})(?:[?&]|$)/;
      const match = url.match(regex);
      return match ? match[1] : '';
    } catch (error) {
      console.error('Error parsing video URL:', url, error);
      return '';
    }
  };

  // Fetch how-to video by tag
  const fetchVideoByTag = async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // console.log(`Fetching video for tag: ${from}`);
      const response = await api.get(`/how-to-videos/tag/${from}`);

      // console.log('API Response:', response);

      if (response.success && response.data && response.data.length > 0) {
        const videoData = response.data[0]; // Take first video from array
        const formattedVideo = {
          id: videoData._id,
          title: videoData.title,
          description: videoData.description,
          category:
            videoData.tags && videoData.tags.length > 0
              ? videoData.tags[0]
              : 'demo',
          videoId: extractVideoId(videoData.youtubeUrl),
          thumbnail: `https://img.youtube.com/vi/${extractVideoId(
            videoData.youtubeUrl,
          )}/0.jpg`,
          youtubeUrl: videoData.youtubeUrl,
          order: videoData.order,
          isActive: videoData.isActive,
        };

        setVideo(formattedVideo);
      } else {
        throw new Error('No video found for this tag');
      }
    } catch (err) {
      console.error('Error fetching video:', err);
      setError(err.message || 'Failed to load tutorial video');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (from) {
      fetchVideoByTag();
    }
  }, [from]);

  const onRefresh = React.useCallback(() => {
    fetchVideoByTag(true);
  }, [from]);

  const onStateChange = React.useCallback(state => {
    if (state === 'ended') {
      setPlaying(false);
    }
    if (state === 'playing') {
      setVideoLoading(false);
      setVideoError(false);
    }
    if (state === 'error') {
      setVideoError(true);
      setVideoLoading(false);
    }
  }, []);

  const togglePlaying = React.useCallback(() => {
    setPlaying(prev => !prev);
  }, []);

  const calculatePlayerHeight = () => {
    return ((screenWidth - 32) * 9) / 16;
  };

  // Render loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <StatusBar
          backgroundColor={theme.colors.background}
          barStyle="dark-content"
        />
        <Navbar title={`${formattedTag} Tutorial`} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}
          >
            Loading tutorial video...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error && !video) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <StatusBar
          backgroundColor={theme.colors.background}
          barStyle="dark-content"
        />
        <Navbar title={`${formattedTag} Tutorial`} />
        <View style={styles.errorContainer}>
          <IconButton
            icon="alert-circle"
            size={48}
            iconColor={theme.colors.error}
          />
          <Text
            variant="titleMedium"
            style={{
              color: theme.colors.error,
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            Video Not Found
          </Text>
          <Text
            variant="bodyMedium"
            style={{
              color: theme.colors.onSurfaceVariant,
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            {error}
          </Text>
          <Button mode="contained" onPress={() => fetchVideoByTag()}>
            Try Again
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <StatusBar
        backgroundColor={theme.colors.background}
        barStyle="dark-content"
      />
      <Navbar title={`${formattedTag} Tutorial`} />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Main Video Player Section */}
        <Card
          style={[
            styles.playerCard,
            { backgroundColor: theme.colors.elevation.level2 },
          ]}
        >
          <Card.Content style={styles.playerContent}>
            <View style={styles.videoHeader}>
              <View style={styles.videoTitleContainer}>
                <Text
                  variant="titleLarge"
                  style={[styles.videoTitle, { color: theme.colors.onSurface }]}
                  numberOfLines={2}
                >
                  {video?.title}
                </Text>
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.videoDescription,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                  numberOfLines={3}
                >
                  {video?.description}
                </Text>
              </View>
              <IconButton
                icon={playing ? 'pause' : 'play'}
                mode="contained"
                containerColor={theme.colors.primary}
                iconColor={theme.colors.onPrimary}
                size={20}
                onPress={togglePlaying}
                disabled={!video?.videoId}
              />
            </View>

            <View
              style={[
                styles.videoContainer,
                { height: calculatePlayerHeight() },
              ]}
            >
              {/* Show placeholder if no video */}
              {!video?.videoId ? (
                <View style={styles.placeholderOverlay}>
                  <IconButton
                    icon="video-off"
                    size={48}
                    iconColor={theme.colors.onSurfaceVariant}
                  />
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.placeholderText,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    Video not available
                  </Text>
                </View>
              ) : (
                <>
                  {/* Loader */}
                  {videoLoading && !videoError && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator
                        size="large"
                        color={theme.colors.primary}
                      />
                      <Text
                        variant="bodyMedium"
                        style={[
                          styles.loadingText,
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        Loading video...
                      </Text>
                    </View>
                  )}

                  {/* Error message */}
                  {videoError && (
                    <View style={styles.errorOverlay}>
                      <IconButton
                        icon="alert-circle"
                        size={48}
                        iconColor={theme.colors.error}
                      />
                      <Text
                        variant="bodyMedium"
                        style={[
                          styles.errorText,
                          { color: theme.colors.error },
                        ]}
                      >
                        Failed to load video
                      </Text>
                      <Button
                        mode="contained"
                        onPress={() => {
                          setVideoLoading(true);
                          setVideoError(false);
                        }}
                        style={styles.retryButton}
                      >
                        Retry
                      </Button>
                    </View>
                  )}

                  {/* YouTube Player */}
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      opacity: videoLoading || videoError ? 0 : 1,
                    }}
                  >
                    <YoutubePlayer
                      ref={playerRef}
                      height={calculatePlayerHeight()}
                      play={playing}
                      videoId={video.videoId}
                      onChangeState={onStateChange}
                      onReady={() => setVideoLoading(false)}
                      onError={() => setVideoError(true)}
                      webViewStyle={styles.youtubeWebView}
                    />
                  </View>
                </>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Help Section */}
        <Card
          style={[
            styles.helpCard,
            { backgroundColor: theme.colors.elevation.level1 },
          ]}
        >
          <Card.Content style={styles.helpContent}>
            <Text
              variant="titleMedium"
              style={[styles.helpTitle, { color: theme.colors.onSurface }]}
            >
              Need More Help?
            </Text>
            <Text
              variant="bodyMedium"
              style={[
                styles.helpText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Our support team is ready to assist you with any questions
            </Text>
            <View style={styles.helpButtons}>
              <Button
                mode="contained"
                icon="phone"
                onPress={() => Linking.openURL('tel:8777972001')}
                style={styles.helpButton}
                contentStyle={styles.helpButtonContent}
              >
                Call Support
              </Button>

              <Button
                mode="outlined"
                icon="email"
                onPress={() => Linking.openURL('mailto:support@amdani.com')}
                style={styles.helpButton}
                contentStyle={styles.helpButtonContent}
              >
                Email Support
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  playerCard: {
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  playerContent: {
    padding: 0,
  },
  videoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 16,
  },
  videoTitleContainer: {
    flex: 1,
    marginRight: 16,
  },
  videoTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  videoDescription: {
    opacity: 0.8,
    lineHeight: 20,
  },
  videoContainer: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
  },
  placeholderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    zIndex: 1,
  },
  placeholderText: {
    marginTop: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    zIndex: 2,
  },
  loadingText: {
    marginTop: 12,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    zIndex: 2,
  },
  errorText: {
    marginTop: 8,
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 8,
  },
  youtubeWebView: {
    borderRadius: 0,
  },
  helpCard: {
    borderRadius: 16,
    marginBottom: 8,
  },
  helpContent: {
    alignItems: 'center',
    padding: 24,
  },
  helpTitle: {
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  helpText: {
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.7,
  },
  helpButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  helpButton: {
    flex: 1,
  },
  helpButtonContent: {
    height: 48,
  },
});

export default TagTutorial;
