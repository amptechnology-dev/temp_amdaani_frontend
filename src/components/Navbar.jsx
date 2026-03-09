import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';

const Navbar = ({
  title,
  containerStyle,
  showBackButton = true,
  rightComponent,
  onBackPress,
  help, // can be boolean or object/string like { tag: 'Home' } or 'Home'
}) => {
  const navigation = useNavigation();
  const theme = useTheme();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
  };

  const handleHelpPress = () => {
    // If help is string or object, pass it as param
    if (typeof help === 'string') {
      navigation.navigate('TagTutorial', { from: help });
    } else if (typeof help === 'object' && help.tag) {
      navigation.navigate('TagTutorial', { from: help.tag });
    } else {
      navigation.navigate('TagTutorial');
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background },
        containerStyle,
      ]}
    >
      {showBackButton && (
        <IconButton
          icon="arrow-left"
          onPress={handleBack}
          style={styles.backButton}
        />
      )}

      <Text style={styles.title}>{title}</Text>

      <View style={styles.rightContainer}>
        {rightComponent}
        {help && (
          <IconButton
            icon={'help-circle-outline'}
            size={22}
            onPress={handleHelpPress}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    width: '100%',
    paddingHorizontal: 8,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});

export default Navbar;
