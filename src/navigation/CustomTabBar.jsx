import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import React, { useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const CustomTabBar = ({
  state,
  descriptors,
  navigation,
  fabOpen,
  setFabOpen,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Animated rotation value
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rotation, {
      toValue: fabOpen ? 1 : 0,
      duration: 350,
      easing: Easing.out(Easing.quad), // fast → slow rotation
      useNativeDriver: true,
    }).start();
  }, [fabOpen]);

  // Interpolate rotation for the icon
  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '135deg'], // rotate into "×"
  });
  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outline,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          height: 80 + insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        if (route.name === 'Add') {
          return (
            <View key={route.key} style={styles.fabInlineWrapper}>
              <TouchableOpacity
                style={[
                  styles.fabButton,
                  { backgroundColor: theme.colors.primary, zIndex: 1000 }, // always above overlay
                ]}
                activeOpacity={0.9}
                onPress={() => setFabOpen(!fabOpen)}
              >
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <MaterialCommunityIcons name="plus" size={32} color="#fff" />
                </Animated.View>
              </TouchableOpacity>
            </View>
          );
        }

        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;
        const isFocused = state.index === index;

        let iconName;
        switch (route.name) {
          case 'Dashboard':
            iconName = isFocused ? 'view-dashboard' : 'view-dashboard-outline';
            break;
          case 'Invoice':
            iconName = isFocused ? 'invoice-list' : 'invoice-list-outline';
            break;
          case 'Item':
            iconName = isFocused ? 'cube' : 'cube-outline';
            break;
          case 'Menu':
            iconName = isFocused ? 'menu' : 'menu-open';
            break;
          default:
            iconName = 'circle';
        }

        return (
          <TouchableOpacity
            activeOpacity={0.7}
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={() => {
              if (!isFocused) {
                navigation.navigate(route.name);
              }
            }}
            style={styles.tabButton}
          >
            <MaterialDesignIcons
              name={iconName}
              size={26}
              color={isFocused ? theme.colors.primary : '#888'}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: isFocused ? theme.colors.primary : '#888' },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    height: 80,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    elevation: 10,
    zIndex: 10, // keep tab bar above overlay
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  fabInlineWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
    zIndex: 20, // keep above overlay
  },
  fabButton: {
    width: 55,
    height: 55,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
});

export default CustomTabBar;
