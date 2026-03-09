import React from 'react';
import { View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Text, Appbar, IconButton, Avatar, useTheme } from 'react-native-paper';
import PropTypes from 'prop-types';
import { useNavigation } from '@react-navigation/native';

const AppHeader = ({
  title,
  tagline,
  logoUrl,
  avatarUri,
  onBellPress,
  onSettingsPress,
  showAvatar = true,
  showBell = true,
  showSettings = false,
  showAvataronRight = false,
  customLeftContent,
  customRightContent,
  style,
}) => {
  const navigation = useNavigation();
  const theme = useTheme();

  const renderLeftContent = () => {
    if (customLeftContent) return customLeftContent;
    if (!showAvatar) return null;

    return (
      <View style={styles.headerLeft}>
        <TouchableOpacity
          onPress={() => {
            navigation.navigate('Profile');
          }}
        >
          {logoUrl ? (
            <Avatar.Image
              size={35}
              source={{ uri: logoUrl }}
              style={styles.logoImage}
            />
          ) : (
            <Avatar.Image
              size={35}
              source={{ uri: avatarUri }}
              style={styles.logoImage}
            />
          )}
        </TouchableOpacity>
        <View>
          <Text variant="titleLarge" style={[styles.headerTitle, { color: theme.colors.primary }]}>
            {title}
          </Text>
          {
            tagline &&
            <Text variant="labelSmall">{tagline}</Text>
          }
        </View>
      </View>
    );
  };

  const renderRightContent = () => {
    if (customRightContent) return customRightContent;

    return (
      <View style={styles.headerRight}>
        {/* {showBell && (
          <IconButton
            icon="bell-outline"
            iconColor={theme.colors.primary}
            style={styles.headerIcon}
            onPress={onBellPress}
          />
        )} */}
        {showSettings && (
          <IconButton
            size={28}
            icon="cog-outline"
            iconColor={theme.colors.primary}
            style={styles.headerIcon}
            onPress={onSettingsPress}
          />
        )}
        {
          showAvataronRight && (
            <TouchableOpacity
              onPress={() => {
                navigation.navigate('Profile');
              }}
            >
              {logoUrl ? (
                <Avatar.Image
                  size={35}
                  source={{ uri: logoUrl }}
                  style={styles.logoImage}
                />
              ) : (
                <Avatar.Image
                  size={35}
                  source={{ uri: avatarUri }}
                  style={styles.logoImage}
                />
              )}
            </TouchableOpacity>
          )
        }
      </View>
    );
  };

  return (
    <Appbar.Header style={[{ backgroundColor: theme.colors.surface, }, style]}>
      <View style={styles.header}>
        {renderLeftContent()}
        {renderRightContent()}
      </View>
    </Appbar.Header>
  );
};

AppHeader.propTypes = {
  title: PropTypes.string,
  logoUrl: PropTypes.string,
  onBellPress: PropTypes.func,
  onSettingsPress: PropTypes.func,
  showAvatar: PropTypes.bool,
  showBell: PropTypes.bool,
  showSettings: PropTypes.bool,
  customLeftContent: PropTypes.node,
  customRightContent: PropTypes.node,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  logoImage: {
    resizeMode: 'contain',
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  headerRight: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerIcon: {
    margin: 0,
  },
});

export default AppHeader;
