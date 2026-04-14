import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import React, { useState } from 'react';
import {
  Text,
  TextInput,
  Button,
  useTheme,
  HelperText,
  IconButton,
  Surface,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import DeviceInfo from 'react-native-device-info';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AudioRecord from 'react-native-audio-record';
import Sound from 'react-native-sound';
import RNFS from 'react-native-fs';
import api from '../../utils/api';
import Navbar from '../../components/Navbar';

// ✅ Enable playback in silence mode (iOS)
Sound.setCategory('Playback');

const Feedback = () => {
  const theme = useTheme();
  const [type, setType] = useState('general');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isFocus, setIsFocus] = useState(false);
  const [activeTab, setActiveTab] = useState('text');

  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedPath, setRecordedPath] = useState(null);
  const [recordDuration, setRecordDuration] = useState('00:00');
  const [playDuration, setPlayDuration] = useState('00:00');
  const [soundInstance, setSoundInstance] = useState(null);
  const timerRef = React.useRef(null);
  const secondsRef = React.useRef(0);

  const feedbackTypes = [
    { label: 'General', value: 'general' },
    { label: 'Bug Report', value: 'bug' },
    { label: 'Feature Request', value: 'feature' },
    { label: 'Other', value: 'other' },
  ];

  const formatTime = secs => {
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const requestMicPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'App needs microphone access to record voice feedback.',
          buttonPositive: 'Allow',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const startRecording = async () => {
    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      Toast.show({ type: 'error', text1: 'Microphone permission denied' });
      return;
    }
    try {
      const path = `${
        RNFS.CachesDirectoryPath
      }/voice_feedback_${Date.now()}.aac`;

      // ✅ Init AudioRecord
      AudioRecord.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        wavFile: path,
      });

      AudioRecord.start();
      setIsRecording(true);
      setRecordedPath(null);
      secondsRef.current = 0;
      setRecordDuration('00:00');

      // ✅ Manual timer since AudioRecord doesn't have progress callback
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setRecordDuration(formatTime(secondsRef.current));
      }, 1000);
    } catch (err) {
      console.error('Recording error:', err);
      Toast.show({ type: 'error', text1: 'Failed to start recording' });
    }
  };

  const stopRecording = async () => {
    try {
      clearInterval(timerRef.current);
      const path = await AudioRecord.stop();
      setIsRecording(false);
      setRecordedPath(path);
      console.log('Recording saved at:', path);
    } catch (err) {
      console.error('Stop recording error:', err);
    }
  };

  const startPlaying = async () => {
    if (!recordedPath) return;
    try {
      // ✅ Load and play using react-native-sound
      const sound = new Sound(recordedPath, '', err => {
        if (err) {
          console.error('Sound load error:', err);
          return;
        }
        setSoundInstance(sound);
        setIsPlaying(true);

        sound.play(success => {
          setIsPlaying(false);
          setPlayDuration('00:00');
          sound.release();
          setSoundInstance(null);
          if (!success) console.error('Playback failed');
        });
      });
    } catch (err) {
      console.error('Playback error:', err);
    }
  };

  const stopPlaying = () => {
    if (soundInstance) {
      soundInstance.stop(() => {
        soundInstance.release();
        setSoundInstance(null);
      });
    }
    setIsPlaying(false);
    setPlayDuration('00:00');
  };

  const deleteRecording = () => {
    if (isPlaying) stopPlaying();
    setRecordedPath(null);
    setRecordDuration('00:00');
    setPlayDuration('00:00');
    secondsRef.current = 0;
  };

  const handleSubmit = async () => {
    if (activeTab === 'text') {
      const newErrors = {};
      if (!message.trim()) newErrors.message = 'Message is required';
      if (message.trim().length > 1000)
        newErrors.message = 'Message must be less than 1000 characters';
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
    } else {
      if (!recordedPath) {
        Toast.show({
          type: 'error',
          text1: 'Please record a voice message first',
        });
        return;
      }
    }

    setLoading(true);
    setErrors({});

    try {
      const appVersion = DeviceInfo.getVersion();
      const deviceInfo = `${DeviceInfo.getBrand()} ${DeviceInfo.getModel()}`;
      const osVersion = `${Platform.OS} ${DeviceInfo.getSystemVersion()}`;

      const payload = {
        message:
          activeTab === 'text'
            ? message.trim()
            : `[Voice Feedback - ${recordDuration}]`,
        type,
        feedbackMode: activeTab,
        metadata: { appVersion, deviceInfo, os: osVersion },
      };

      const response = await api.post('/feedback', payload);

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Feedback Submitted',
          text2: 'Thank you for your feedback!',
        });
        setMessage('');
        setType('general');
        setRecordedPath(null);
        setRecordDuration('00:00');
        secondsRef.current = 0;
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Submission Failed',
        text2: error.response?.data?.message || 'Failed to submit feedback',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar title="Feedback" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Feedback Type */}
        <View style={styles.inputGroup}>
          <Text variant="labelLarge" style={styles.label}>
            Feedback Type
          </Text>
          <Dropdown
            style={[
              styles.dropdown,
              {
                borderColor: isFocus
                  ? theme.colors.primary
                  : theme.colors.outline,
                backgroundColor: theme.colors.surface,
              },
            ]}
            placeholderStyle={[
              styles.placeholderStyle,
              { color: theme.colors.onSurfaceVariant },
            ]}
            selectedTextStyle={[
              styles.selectedTextStyle,
              { color: theme.colors.onSurface },
            ]}
            inputSearchStyle={[
              styles.inputSearchStyle,
              {
                borderColor: theme.colors.outline,
                color: theme.colors.onSurface,
              },
            ]}
            iconStyle={styles.iconStyle}
            iconColor={
              isFocus ? theme.colors.primary : theme.colors.onSurfaceVariant
            }
            containerStyle={[
              styles.containerStyle,
              { backgroundColor: theme.colors.surface },
            ]}
            itemContainerStyle={[
              styles.itemContainerStyle,
              { backgroundColor: theme.colors.surface },
            ]}
            itemTextStyle={[
              styles.itemTextStyle,
              { color: theme.colors.onSurface },
            ]}
            activeColor={theme.colors.primaryContainer}
            data={feedbackTypes}
            maxHeight={300}
            labelField="label"
            valueField="value"
            placeholder="Select feedback type"
            value={type}
            onFocus={() => setIsFocus(true)}
            onBlur={() => setIsFocus(false)}
            onChange={item => {
              setType(item.value);
              setIsFocus(false);
            }}
            renderRightIcon={() => (
              <Icon
                name={isFocus ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={
                  isFocus ? theme.colors.primary : theme.colors.onSurfaceVariant
                }
              />
            )}
          />
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          <Button
            mode={activeTab === 'text' ? 'contained' : 'outlined'}
            onPress={() => setActiveTab('text')}
            style={styles.tabBtn}
            icon="text"
          >
            Text
          </Button>
          <Button
            mode={activeTab === 'voice' ? 'contained' : 'outlined'}
            onPress={() => setActiveTab('voice')}
            style={styles.tabBtn}
            icon="microphone"
          >
            Voice
          </Button>
        </View>

        {/* Text Feedback */}
        {activeTab === 'text' && (
          <View style={styles.inputGroup}>
            <Text variant="labelLarge" style={styles.label}>
              Message
            </Text>
            <TextInput
              mode="outlined"
              value={message}
              onChangeText={text => {
                setMessage(text);
                setErrors(prev => ({ ...prev, message: null }));
              }}
              multiline
              numberOfLines={6}
              maxLength={1000}
              placeholder="Tell us what you think..."
              style={styles.textArea}
              error={!!errors.message}
              theme={{ roundness: 12 }}
            />
            <View style={styles.helperRow}>
              {errors.message && (
                <HelperText type="error" visible={!!errors.message}>
                  {errors.message}
                </HelperText>
              )}
              <Text
                variant="bodySmall"
                style={[
                  styles.characterCount,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {message.length}/1000
              </Text>
            </View>
          </View>
        )}

        {/* Voice Feedback */}
        {activeTab === 'voice' && (
          <Surface
            style={[
              styles.voiceBox,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
            elevation={0}
          >
            <Text
              variant="labelLarge"
              style={[styles.label, { textAlign: 'center' }]}
            >
              Voice Feedback
            </Text>

            <Text
              style={[
                styles.timer,
                {
                  color: isRecording
                    ? theme.colors.error
                    : theme.colors.onSurface,
                },
              ]}
            >
              {isRecording
                ? recordDuration
                : recordedPath
                ? recordDuration
                : '00:00'}
            </Text>

            <Text
              variant="bodySmall"
              style={{
                color: theme.colors.onSurfaceVariant,
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              {isRecording
                ? '🔴 Recording...'
                : recordedPath
                ? '✅ Recording saved'
                : 'Tap mic to start recording'}
            </Text>

            {!recordedPath ? (
              <View style={styles.voiceControls}>
                <IconButton
                  icon={isRecording ? 'stop-circle' : 'microphone'}
                  size={56}
                  iconColor={
                    isRecording ? theme.colors.error : theme.colors.primary
                  }
                  style={[
                    styles.micBtn,
                    {
                      backgroundColor: isRecording
                        ? theme.colors.errorContainer
                        : theme.colors.primaryContainer,
                    },
                  ]}
                  onPress={isRecording ? stopRecording : startRecording}
                />
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
                >
                  {isRecording ? 'Tap to stop' : 'Tap to record'}
                </Text>
              </View>
            ) : (
              <View style={styles.voiceControls}>
                <View style={styles.playbackRow}>
                  <IconButton
                    icon={isPlaying ? 'pause-circle' : 'play-circle'}
                    size={48}
                    iconColor={theme.colors.primary}
                    onPress={isPlaying ? stopPlaying : startPlaying}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurface }}
                    >
                      Voice Recording
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Duration: {recordDuration}
                    </Text>
                  </View>
                  <IconButton
                    icon="delete"
                    size={24}
                    iconColor={theme.colors.error}
                    onPress={deleteRecording}
                  />
                </View>
              </View>
            )}
          </Surface>
        )}

        {/* Submit */}
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
        >
          Submit Feedback
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  inputGroup: { marginBottom: 20 },
  label: { marginBottom: 8 },
  dropdown: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  placeholderStyle: { fontSize: 16 },
  selectedTextStyle: { fontSize: 16 },
  iconStyle: { width: 20, height: 20 },
  inputSearchStyle: {
    height: 40,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
  },
  containerStyle: { borderRadius: 12, marginTop: 4 },
  itemContainerStyle: { paddingVertical: 0, borderRadius: 12, margin: 4 },
  itemTextStyle: { fontSize: 16 },
  textArea: { padding: 12, minHeight: 120, textAlignVertical: 'top' },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  characterCount: { marginLeft: 'auto', marginTop: 4 },
  submitButton: { marginTop: 8 },
  submitButtonContent: { paddingVertical: 6 },
  tabRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  tabBtn: { flex: 1 },
  voiceBox: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  timer: {
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 2,
  },
  voiceControls: { alignItems: 'center', width: '100%' },
  micBtn: { borderRadius: 50 },
  playbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
});

export default Feedback;
