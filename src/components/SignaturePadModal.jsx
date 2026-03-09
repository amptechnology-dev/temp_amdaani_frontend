import React, { useRef, useMemo } from 'react';
import { Modal, View, StyleSheet, SafeAreaView } from 'react-native';
import { Appbar, useTheme, Button } from 'react-native-paper';
import Signature from 'react-native-signature-canvas';

/**
 * TWEAKS:
 * - ASPECT_RATIO: Wider = smaller second number for landscape canvas
 * - BOX_MAX_HEIGHT_PCT: Max fraction of screen height the box can occupy
 */
const ASPECT_RATIO = 16 / 9; // Landscape ratio for canvas
const BOX_MAX_HEIGHT_PCT = 0.6; // 60% of the available height

const htmlStyle = `
  .m-signature-pad--footer { display:none; }
  body,html { 
    width:100%; 
    height:100%; 
    margin:0; 
    overflow: hidden;
  }
  .m-signature-pad { 
    box-shadow:none; 
    border:none;
    width: 100%;
    height: 100%;
  }
  .m-signature-pad--body {
    background:#fff;
    border:2px dashed #ddd; 
    border-radius:12px;
    width: 100% !important;
    height: 100% !important;
    position: relative;
  }
  canvas { 
    width:100% !important; 
    height:100% !important;
    display: block !important;
    border-radius: 12px;
  }
  /* Force landscape aspect for the signature area */
  .signature-pad {
    width: 100%;
    height: 100%;
    min-height: 200px;
  }
`;

const SignaturePadModal = ({
  visible,
  title = 'Draw your signature',
  onDone,
  onCancel,
  backgroundColor = '#fff',
  strokeColor = '#000',
  minWidth = 2,
  maxWidth = 4,
}) => {
  const theme = useTheme();
  const sigRef = useRef(null);
  const webStyle = useMemo(() => htmlStyle, []);

  const handleOK = signature => {
    try {
      onDone?.({
        uri: signature, // data:image/png;base64,....
        type: 'image/png',
        fileName: `signature_${Date.now()}.png`,
      });
    } catch {
      onCancel?.();
    }
  };

  const handleClear = () => {
    sigRef.current?.clearSignature();
  };

  const handleSave = () => {
    sigRef.current?.readSignature();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
      transparent={false}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        {/* Header - Portrait orientation */}
        <Appbar.Header
          style={[styles.header, { backgroundColor: theme.colors.surface }]}
          mode="small"
        >
          <Appbar.Action
            icon="close"
            onPress={onCancel}
            iconColor={theme.colors.onSurface}
          />
          <Appbar.Content
            title={title}
            titleStyle={{ color: theme.colors.onSurface }}
          />
          <Appbar.Action
            icon="eraser"
            onPress={handleClear}
            iconColor={theme.colors.primary}
          />
          <Appbar.Action
            icon="check"
            onPress={handleSave}
            iconColor={theme.colors.primary}
          />
        </Appbar.Header>

        <View style={styles.content}>
          {/* Landscape oriented signature canvas */}
          <View style={styles.canvasContainer}>
            <View style={[styles.landscapeBox, { aspectRatio: ASPECT_RATIO }]}>
              <Signature
                ref={sigRef}
                onOK={handleOK}
                onEmpty={onCancel}
                webStyle={webStyle}
                backgroundColor={backgroundColor}
                penColor={strokeColor}
                minWidth={minWidth}
                maxWidth={maxWidth}
                autoClear={false}
                descriptionText=""
                clearText="Clear"
                confirmText="Save"
              />
            </View>
          </View>

          {/* Bottom Action Buttons */}
          <View style={styles.bottomActions}>
            <Button
              mode="outlined"
              onPress={handleClear}
              icon="eraser"
              style={[styles.actionButton, styles.clearButton]}
              textColor={theme.colors.error}
            >
              Clear
            </Button>

            <Button
              mode="contained"
              onPress={handleSave}
              icon="content-save"
              style={[styles.actionButton, styles.saveButton]}
              buttonColor={theme.colors.primary}
            >
              Save Signature
            </Button>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    elevation: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  /**
   * Landscape canvas container:
   * - Wide aspect ratio (16:9) for landscape feel
   * - Full width utilization
   * - Height constraint to prevent overflow
   */
  landscapeBox: {
    width: '100%',
    maxWidth: 500, // Maximum width for very wide screens
    maxHeight: `${Math.round(BOX_MAX_HEIGHT_PCT * 100)}%`,
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    backgroundColor: '#fff',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 8,
    gap: 16,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 6,
  },
  clearButton: {
    borderColor: '#f44336',
  },
  saveButton: {
    elevation: 2,
  },
});

export default SignaturePadModal;
