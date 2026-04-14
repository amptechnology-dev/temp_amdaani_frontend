import React, { useRef, useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Dimensions,
  Image,
  InteractionManager,
} from 'react-native';
import { Appbar, useTheme, Button } from 'react-native-paper';
import SignatureCanvas from 'react-native-signature-canvas';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SignaturePadModal = ({
  visible,
  title = 'Draw your signature',
  onDone,
  onCancel,
}) => {
  const theme = useTheme();
  const ref = useRef(null);
  const [signature, setSignature] = useState(null);
  const [showCanvas, setShowCanvas] = useState(false);

  useEffect(() => {
    if (visible) {
      setSignature(null);
      // Wait for Modal animation to finish completely
      const task = InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          setShowCanvas(true);
        }, 300); // Slightly longer delay for stability
      });
      return () => task.cancel();
    } else {
      setShowCanvas(false);
    }
  }, [visible]);

  const handleOK = sig => {
    if (!sig) return;
    setSignature(sig);
    onDone?.({
      uri: sig,
      type: 'image/png',
      fileName: `signature_${Date.now()}.png`,
    });
  };

  const handleClear = () => {
    ref.current?.clearSignature();
    setSignature(null);
  };

  const canvasHeight = SCREEN_HEIGHT * 0.45;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
      hardwareAccelerated={true}
    >
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Appbar.Header>
          <Appbar.Action icon="close" onPress={onCancel} />
          <Appbar.Content title={title} />
          <Appbar.Action icon="eraser" onPress={handleClear} />
        </Appbar.Header>

        {signature && (
          <View style={styles.preview}>
            <Image
              source={{ uri: signature }}
              style={{ width: 250, height: 100 }}
              resizeMode="contain"
            />
          </View>
        )}

        <View style={{ height: canvasHeight, backgroundColor: '#eee' }}>
          {showCanvas && (
            <SignatureCanvas
              ref={ref}
              onOK={handleOK}
              onEmpty={() => console.log('Empty')}
              autoClear={false}
              descriptionText="Sign here"
              penColor="black"
              backgroundColor="white"
              style={styles.canvas}
              androidLayerType="hardware"
              webviewProps={{
                scrollEnabled: false, // Prevents the page from moving while signing
                javaScriptEnabled: true,
                domStorageEnabled: true,
                androidLayerType: 'hardware',
                mixedContentMode: 'always',
              }}
            />
          )}
        </View>

        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={handleClear}
            style={{ flex: 1, marginRight: 8 }}
          >
            Clear
          </Button>
          <Button
            mode="contained"
            onPress={() => ref.current?.readSignature()}
            style={{ flex: 1, marginLeft: 8 }}
          >
            Save Signature
          </Button>
        </View>
      </View>
    </Modal>
  );
};

export default SignaturePadModal;

const styles = StyleSheet.create({
  container: { flex: 1 },
  preview: { alignItems: 'center', marginVertical: 10 },
  actions: { flexDirection: 'row', padding: 16 },
  canvas: { flex: 1, borderBottomWidth: 1, borderBottomColor: '#ccc' },
});
