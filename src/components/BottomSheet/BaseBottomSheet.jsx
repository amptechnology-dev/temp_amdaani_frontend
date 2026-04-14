import React, {
  forwardRef,
  useCallback,
  useMemo,
  useImperativeHandle,
} from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTheme, Text, IconButton, Divider } from 'react-native-paper';
import {
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetFlatList,
  BottomSheetSectionList,
  BottomSheetBackdrop,
  BottomSheetHandle,
  BottomSheetFooter,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '@gorhom/bottom-sheet';

const BaseBottomSheet = forwardRef(
  (
    {
      // Core Props
      snapPoints = ['50%', '85%'],
      initialSnapIndex = 0,

      // Header Props
      title,
      subtitle,
      showHeader = true,
      showCloseButton = true,
      headerComponent,

      showHandle = true,

      // Content Props
      children,
      contentType = 'view',

      // FlatList Props
      data = [],
      renderItem,
      keyExtractor,

      // SectionList Props
      sections = [],
      renderSectionHeader,

      // Footer Props
      footerComponent,
      showFooter = false,

      // Behavior Props
      enablePanDownToClose = true,
      enableDynamicSizing = false,
      enableDismissOnClose = true,
      backdropbehavior = 'close',
      keyboardBehavior = 'interactive',
      keyboardBlurBehavior = 'restore',

      enableHandlePanningGesture = true,
      enableContentPanningGesture = false,

      // Style Props
      backgroundStyle,
      handleStyle,
      containerStyle,
      contentContainerStyle,

      // Callback Props
      onDismiss,
      onPresent,
      onChange,
      onAnimate,

      ...restProps
    },
    ref,
  ) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const bottomSheetRef = React.useRef(null);

    // Expose methods through ref - FIXED to match BottomSheetModal API
    useImperativeHandle(ref, () => ({
      // BottomSheetModal methods
      present: () => bottomSheetRef.current?.snapToIndex(0),
      dismiss: () => bottomSheetRef.current?.dismiss(),
      close: () => bottomSheetRef.current?.close(), // dismiss is the correct method for BottomSheetModal
      // Regular BottomSheet methods (these might not work with BottomSheetModal)
      expand: () => bottomSheetRef.current?.expand?.(),
      collapse: () => bottomSheetRef.current?.collapse?.(),
      snapToIndex: index => bottomSheetRef.current?.snapToIndex?.(index),
      snapToPosition: position =>
        bottomSheetRef.current?.snapToPosition?.(position),

      // Additional utility methods
      forceClose: () => bottomSheetRef.current?.forceClose?.(),
    }));

    // Memoized snap points
    const memoizedSnapPoints = useMemo(() => snapPoints, [snapPoints]);

    // Custom backdrop component
    const renderBackdrop = useCallback(
      props => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          enableTouchThrough={false}
          opacity={0.5}
          pressBehavior={backdropbehavior}
          style={[props.style, styles.backdrop]}
        />
      ),
      [],
    );

    // Custom handle component
    const renderHandle = useCallback(
      props => {
        if (!showHandle) return null;

        return (
          <BottomSheetHandle
            {...props}
            style={[
              styles.handle,
              { backgroundColor: theme.colors.surface },
              handleStyle,
            ]}
            indicatorStyle={[
              styles.handleIndicator,
              { backgroundColor: theme.colors.onSurface },
            ]}
          />
        );
      },
      [theme, handleStyle, showHandle],
    );

    // Custom header component
    const renderHeader = useCallback(() => {
      if (!showHeader && !headerComponent) return null;

      if (headerComponent) return headerComponent;

      return (
        <View
          style={[styles.header, { borderBottomColor: theme.colors.outline }]}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerText}>
              {title && (
                <Text
                  variant="headlineSmall"
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={[
                    styles.title,
                    {
                      color: theme.colors.onSurface,
                      flexShrink: 1,
                      flexGrow: 1,
                    },
                  ]}
                >
                  {title}
                </Text>
              )}
              {subtitle && (
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.subtitle,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {subtitle}
                </Text>
              )}
            </View>
            {showCloseButton && (
              <IconButton
                icon="close"
                size={24}
                onPress={() => bottomSheetRef.current?.close()}
                style={styles.closeButton}
              />
            )}
          </View>
        </View>
      );
    }, [showHeader, headerComponent, title, subtitle, showCloseButton, theme]);

    // Custom footer component
    const renderFooter = useCallback(
      props => {
        if (!showFooter && !footerComponent) return null;

        return (
          <BottomSheetFooter {...props} bottomInset={0}>
            <View
              style={[
                styles.footer,
                {
                  backgroundColor: theme.colors.surface,
                  borderTopColor: theme.colors.outline,
                },
              ]}
            >
              {footerComponent}
            </View>
          </BottomSheetFooter>
        );
      },
      [showFooter, footerComponent, theme, insets.bottom],
    );

    // Render content based on type
    const renderContent = useCallback(() => {
      const baseStyle = [
        styles.content,
        { backgroundColor: theme.colors.surface },
        contentContainerStyle,
      ];

      switch (contentType) {
        case 'scroll':
          return (
            <BottomSheetScrollView
              style={baseStyle}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 120 }}
            >
              {children}
            </BottomSheetScrollView>
          );

        case 'flatlist':
          return (
            <BottomSheetFlatList
              data={data}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              // ListHeaderComponent={showHeader ? renderHeader() : null}
              ListFooterComponent={showFooter ? footerComponent : null}
              contentContainerStyle={[
                { paddingBottom: 24 },
                contentContainerStyle,
              ]}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            />
          );

        case 'sectionlist':
          return (
            <BottomSheetSectionList
              sections={sections}
              renderItem={renderItem}
              renderSectionHeader={renderSectionHeader}
              keyExtractor={keyExtractor}
              style={baseStyle}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          );

        default:
          return (
            <BottomSheetView
              style={[
                {
                  flex: 1,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  overflow: 'hidden', // <- keeps corners rounded
                  backgroundColor: theme.colors.surface,
                },
                contentContainerStyle,
              ]}
            >
              {renderHeader()}
              {children}
            </BottomSheetView>
          );
      }
    }, [
      contentType,
      children,
      data,
      renderItem,
      keyExtractor,
      sections,
      renderSectionHeader,
      theme,
      contentContainerStyle,
    ]);

    // Handle sheet changes
    const handleSheetChanges = useCallback(
      index => {
        onChange?.(index);

        // Add haptic feedback on iOS
        if (Platform.OS === 'ios' && index >= 0) {
          try {
            const { HapticFeedback } = require('react-native');
            HapticFeedback?.trigger('impactLight');
          } catch (error) {
            // Haptic feedback not available
          }
        }
      },
      [onChange],
    );

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={initialSnapIndex}
        snapPoints={memoizedSnapPoints}
        enablePanDownToClose={enablePanDownToClose}
        enableDynamicSizing={enableDynamicSizing}
        enableDismissOnClose={enableDismissOnClose}
        enableBlurKeyboardOnGesture={true}
        keyboardBehavior={keyboardBehavior}
        keyboardBlurBehavior={keyboardBlurBehavior}
        android_keyboardInputMode="adjustResize"
        enableHandlePanningGesture={enableHandlePanningGesture}
        enableContentPanningGesture={enableContentPanningGesture}
        backgroundStyle={[
          styles.background,
          { backgroundColor: theme.colors.surface },
          backgroundStyle,
        ]}
        handleComponent={renderHandle}
        backdropComponent={renderBackdrop}
        footerComponent={renderFooter}
        onChange={handleSheetChanges}
        onDismiss={onDismiss}
        onAnimate={onAnimate}
        style={[styles.container, containerStyle]}
        {...restProps}
      >
        {renderHeader()}
        {renderContent()}
      </BottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  handle: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: 'transparent',
  },
  handleIndicator: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  closeButton: {
    margin: 0,
  },
  content: {
    flex: 1,
    zIndex: 9999,
  },
  footer: {
    borderTopWidth: 1,
  },
});

BaseBottomSheet.displayName = 'BaseBottomSheet';

export default BaseBottomSheet;
