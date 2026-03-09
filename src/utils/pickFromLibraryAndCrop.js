import { Platform } from 'react-native';
import ImageCropPicker from 'react-native-image-crop-picker';

// Type can be 'logo' | 'signature'
export const pickFromLibraryAndCrop = async (type) => {
  const isLogo = type === 'logo';
  const options = {
    cropping: true,
    includeBase64: false,
    compressImageQuality: 0.9,
    mediaType: 'photo',
    cropperToolbarTitle: isLogo ? 'Crop Logo' : 'Crop Signature',
    // Logo square; Signature wide (e.g., 4:1)
    width: isLogo ? 800 : 1200,
    height: isLogo ? 800 : 300,
    cropperChooseText: 'Use',
    cropperCancelText: 'Cancel',
    cropperActiveWidgetColor: '#4f46e5',
    cropperStatusBarColor: Platform.OS === 'android' ? '#111827' : undefined,
    cropperToolbarColor: Platform.OS === 'android' ? '#111827' : undefined,
    cropperToolbarWidgetColor: '#fff',
    forceJpg: true,
  };

  const image = await ImageCropPicker.openPicker(options);
  return normalizePickerResult(image);
};

export const takePhotoAndCrop = async (type) => {
  const isLogo = type === 'logo';
  const options = {
    cropping: true,
    includeBase64: false,
    compressImageQuality: 0.9,
    mediaType: 'photo',
    cropperToolbarTitle: isLogo ? 'Crop Logo' : 'Crop Signature',
    width: isLogo ? 800 : 1200,
    height: isLogo ? 800 : 300,
    cropperChooseText: 'Use',
    cropperCancelText: 'Cancel',
    cropperActiveWidgetColor: '#4f46e5',
    forceJpg: true,
  };

  const image = await ImageCropPicker.openCamera(options);
  return normalizePickerResult(image);
};

// Normalize to your expected { uri, type, fileName } object
const normalizePickerResult = (image) => {
  // ImageCropPicker returns path, mime, size, etc.
  const filenameFromPath = image.path?.split('/').pop() || `image_${Date.now()}.jpg`;
  return {
    uri: image.path,
    type: image.mime || 'image/jpeg',
    fileName: filenameFromPath,
    width: image.width,
    height: image.height,
    size: image.size,
  };
};

// Optional cleanup to be called e.g. on unmount
export const cleanupCropper = async () => {
  try {
    await ImageCropPicker.clean();
  } catch {}
};
