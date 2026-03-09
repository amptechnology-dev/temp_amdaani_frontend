import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  Chip,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import YoutubePlayer from 'react-native-youtube-iframe';
import Navbar from '../../components/Navbar';
import api from '../../utils/api'; // Import your API utility

const { width: screenWidth } = Dimensions.get('window');

const Tutorial = () => {
  const theme = useTheme();
  const [playing, setPlaying] = useState(false);
  const [currentVideo, setCurrentVideo] = useState('');
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [videos, setVideos] = useState([]);
  const playerRef = useRef(null);

  const tutorialCategories = [
    { id: 'all', label: 'All Videos' },
    { id: 'billing', label: 'Billing' },
    { id: 'business', label: 'Business' },
    { id: 'reports', label: 'Reports' },
  ];

  const [selectedCategory, setSelectedCategory] = useState('all');

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

  // Fetch how-to videos from API
  const fetchVideos = async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // console.log('Fetching how-to videos...');
      const response = await api.get('/how-to-videos/active');

      // console.log('API Response:', response);

      if (response.success && response.data) {
        const formattedVideos = response.data.map((video, index) => ({
          id: video._id,
          title: video.title,
          description: video.description,
          duration: '0:00', // You might want to calculate this or get from API
          category:
            video.tags && video.tags.length > 0 ? video.tags[0] : 'demo',
          videoId: extractVideoId(video.youtubeUrl),
          thumbnail: `https://img.youtube.com/vi/${extractVideoId(
            video.youtubeUrl,
          )}/0.jpg`,
          youtubeUrl: video.youtubeUrl,
          order: video.order,
          isActive: video.isActive,
          // Set the first video as current if none is selected
          ...(index === 0 && !currentVideo && { isFirst: true }),
        }));

        setVideos(formattedVideos);



        // Auto-select first video if no video is currently playing
        if (formattedVideos.length > 0 && !currentVideo) {
          const firstVideo = formattedVideos[0];
          setCurrentVideo(firstVideo.videoId);
        }
      } else {
        throw new Error(response.message || 'Failed to fetch videos');
      }
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError(err.message || 'Failed to load tutorial videos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter videos based on selected category
  const filteredVideos =
    selectedCategory === 'all'
      ? videos
      : videos.filter(
        video =>
          video.category?.toLowerCase() === selectedCategory.toLowerCase(),
      );

  // Initial data fetch
  useEffect(() => {
    fetchVideos();
  }, []);

  // Refresh function
  const onRefresh = useCallback(() => {
    fetchVideos(true);
  }, []);

  const onStateChange = useCallback(state => {
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

  const togglePlaying = useCallback(() => {
    setPlaying(prev => !prev);
  }, []);

  const playVideo = useCallback(videoId => {
    if (videoId) {
      setCurrentVideo(videoId);
      setPlaying(true);
      setVideoLoading(true);
      setVideoError(false);
    }
  }, []);

  const seekTo = useCallback(seconds => {
    playerRef.current?.seekTo(seconds, true);
  }, []);

  const calculatePlayerHeight = () => {
    return ((screenWidth - 32) * 9) / 16;
  };

  const getVideoTitle = () => {
    const video = videos.find(v => v.videoId === currentVideo);
    return video ? video.title : 'Amdaani Tutorial';
  };

  const getVideoDescription = () => {
    const video = videos.find(v => v.videoId === currentVideo);
    return video ? video.description : 'Select a video to get started';
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
        <Navbar title="Video Tutorials" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}
          >
            Loading tutorial videos...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error && videos.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <StatusBar
          backgroundColor={theme.colors.background}
          barStyle="dark-content"
        />
        <Navbar title="Video Tutorials" />
        <View style={styles.errorContainer}>
          <IconButton
            icon="alert-circle"
            size={48}
            iconColor={theme.colors.error}
          />
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.error, marginBottom: 8 }}
          >
            Failed to load videos
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
          <Button mode="contained" onPress={() => fetchVideos()}>
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
      <Navbar title="Video Tutorials" />

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
                  variant="titleMedium"
                  style={[styles.videoTitle, { color: theme.colors.onSurface }]}
                >
                  {getVideoTitle()}
                </Text>
                <Text
                  variant="bodySmall"
                  style={[
                    styles.videoDescription,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {getVideoDescription()}
                </Text>
              </View>
              <IconButton
                icon={playing ? 'pause' : 'play'}
                mode="contained"
                containerColor={theme.colors.primary}
                iconColor={theme.colors.onPrimary}
                size={20}
                onPress={togglePlaying}
                disabled={!currentVideo}
              />
            </View>

            <View
              style={[
                styles.videoContainer,
                { height: calculatePlayerHeight() },
              ]}
            >
              {/* Show placeholder if no video selected */}
              {!currentVideo ? (
                <View style={styles.placeholderOverlay}>
                  <IconButton
                    icon="play-circle"
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
                    Select a video to play
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
                        onPress={() => playVideo(currentVideo)}
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
                      key={currentVideo}
                      ref={playerRef}
                      height={calculatePlayerHeight()}
                      //initialPlayerParams={{ controls: false }}
                      play={playing}
                      videoId={currentVideo}
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

        {/* Categories Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContent}
        >
          {tutorialCategories.map(category => (
            <Chip
              key={category.id}
              selected={selectedCategory === category.id}
              onPress={() => setSelectedCategory(category.id)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor:
                    selectedCategory === category.id
                      ? theme.colors.primary
                      : theme.colors.surfaceVariant,
                },
              ]}
              textStyle={{
                color:
                  selectedCategory === category.id
                    ? theme.colors.onPrimary
                    : theme.colors.onSurfaceVariant,
              }}
            >
              {category.label}
            </Chip>
          ))}
        </ScrollView>

        {/* Video List */}
        <View style={styles.videosSection}>
          <View style={styles.sectionHeader}>
            <Text
              variant="titleLarge"
              style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
            >
              Tutorial Videos
            </Text>
            <Text
              variant="bodyMedium"
              style={[
                styles.sectionSubtitle,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {filteredVideos.length} video
              {filteredVideos.length !== 1 ? 's' : ''} found
            </Text>
          </View>

          {filteredVideos.length === 0 ? (
            <Card
              style={[
                styles.emptyCard,
                { backgroundColor: theme.colors.elevation.level1 },
              ]}
            >
              <Card.Content style={styles.emptyContent}>
                <IconButton
                  icon="video-off"
                  size={48}
                  iconColor={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="bodyMedium"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    textAlign: 'center',
                  }}
                >
                  No videos found in this category
                </Text>
              </Card.Content>
            </Card>
          ) : (
            filteredVideos.map(video => (
              <Card
                key={video.id}
                style={[
                  styles.videoCard,
                  {
                    backgroundColor: theme.colors.elevation.level1,
                    borderColor:
                      currentVideo === video.videoId
                        ? theme.colors.primary
                        : 'transparent',
                    borderWidth: currentVideo === video.videoId ? 2 : 0,
                  },
                ]}
                onPress={() => playVideo(video.videoId)}
              >
                <Card.Content style={styles.videoCardContent}>
                  <View style={styles.videoInfo}>
                    <View style={styles.videoThumbnailContainer}>
                      <Image
                        source={{ uri: `${video.thumbnail}` }}
                        style={[
                          styles.videoThumbnail,
                          { backgroundColor: 'transparent' },
                        ]}
                        resizeMode="cover"
                        resizeMethod="resize"
                      />
                    </View>

                    <View style={styles.videoDetails}>
                      <Text
                        variant="titleMedium"
                        style={[
                          styles.videoItemTitle,
                          {
                            color:
                              currentVideo === video.videoId
                                ? theme.colors.primary
                                : theme.colors.onSurface,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {video.title}
                      </Text>
                      <Text
                        variant="bodyMedium"
                        style={[
                          styles.videoDescription,
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                        numberOfLines={2}
                      >
                        {video.description}
                      </Text>
                      {video.category && (
                        <Chip
                          compact
                          mode="outlined"
                          textStyle={{ fontSize: 10 }}
                          style={{ alignSelf: 'flex-start', marginTop: 4 }}
                        >
                          {video.category}
                        </Chip>
                      )}
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))
          )}
        </View>

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
              Need Personalized Help?
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
                onPress={() => Linking.openURL('tel:8697972001')}
                style={styles.helpButton}
                contentStyle={styles.helpButtonContent}
              >
                Call
              </Button>

              <Button
                mode="outlined"
                icon="email"
                onPress={() => Linking.openURL('mailto:support@amdani.com')}
                style={styles.helpButton}
                contentStyle={styles.helpButtonContent}
              >
                Email
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
    padding: 16,
    paddingBottom: 12,
  },
  videoTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  videoTitle: {
    fontWeight: '600',
    marginBottom: 4,
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
  categoriesScroll: {
    marginBottom: 24,
  },
  categoriesContent: {
    gap: 8,
    paddingRight: 16,
  },
  categoryChip: {
    marginRight: 8,
  },
  videosSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    opacity: 0.7,
  },
  emptyCard: {
    borderRadius: 12,
    marginBottom: 12,
  },
  emptyContent: {
    alignItems: 'center',
    padding: 32,
  },
  videoCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  videoCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  videoInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoThumbnailContainer: {
    position: 'relative',
    width: 80,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  durationOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  durationText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  videoDetails: {
    flex: 1,
  },
  videoItemTitle: {
    fontWeight: '500',
    marginBottom: 4,
  },
  videoDescription: {
    opacity: 0.7,
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

export default Tutorial;
