// hooks/useBottomSheet.js
import { useRef, useCallback } from 'react';

export const useBottomSheet = () => {
  const bottomSheetRef = useRef(null);

  const present = useCallback(() => {
    try {
      bottomSheetRef.current?.present();
    } catch (error) {
      console.error('Error presenting bottom sheet:', error);
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      bottomSheetRef.current?.dismiss();
    } catch (error) {
      console.error('Error dismissing bottom sheet:', error);
    }
  }, []);

  const close = useCallback(() => {
    try {
      bottomSheetRef.current?.close();
    } catch (error) {
      console.error('Error closing bottom sheet:', error);
    }
  }, []);

  const expand = useCallback(() => {
    try {
      bottomSheetRef.current?.expand();
    } catch (error) {
      console.error('Error expanding bottom sheet:', error);
    }
  }, []);

  const collapse = useCallback(() => {
    try {
      bottomSheetRef.current?.collapse();
    } catch (error) {
      console.error('Error collapsing bottom sheet:', error);
    }
  }, []);

  const snapToIndex = useCallback((index) => {
    try {
      bottomSheetRef.current?.snapToIndex(index);
    } catch (error) {
      console.error('Error snapping to index:', error);
    }
  }, []);

  const snapToPosition = useCallback((position) => {
    try {
      bottomSheetRef.current?.snapToPosition(position);
    } catch (error) {
      console.error('Error snapping to position:', error);
    }
  }, []);

  return {
    bottomSheetRef,
    present,
    dismiss,
    close,
    expand,
    collapse,
    snapToIndex,
    snapToPosition,
  };
};
