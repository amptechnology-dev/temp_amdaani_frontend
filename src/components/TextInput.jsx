import React from 'react';
import { TextInput as RNTextInput, useTheme } from 'react-native-paper';
import { StyleSheet } from 'react-native';

const TextInput = ({
  label = 'Input',
  placeholder = '',
  value = '',
  onChangeText,
  mode = 'outlined',
  leftIcon,
  rightIcon, // can be string OR JSX element
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  style = {},
  error = false,
  disabled = false,
  ...props
}) => {
  const theme = useTheme();

  const renderRight = () => {
    if (!rightIcon) return null;

    // If it's a string => treat as icon name
    if (typeof rightIcon === 'string') {
      return (
        <RNTextInput.Icon
          icon={rightIcon}
          color={
            error
              ? theme.colors.error
              : disabled
              ? theme.colors.disabled
              : theme.colors.onSurfaceVariant
          }
        />
      );
    }

    // If it's JSX => render directly
    if (React.isValidElement(rightIcon)) {
      return <RNTextInput.Icon icon={() => rightIcon} />;
    }

    return null;
  };

  return (
    <RNTextInput
      label={label}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      mode={mode}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      disabled={disabled}
      error={error}
      style={[styles.input, style]}
      theme={{
        colors: {
          primary: theme.colors.primary,
          background: theme.colors.surface,
          error: theme.colors.error,
          placeholder: theme.colors.onSurfaceVariant,
          text: theme.colors.onSurface,
        },
        roundness: 10,
      }}
      left={
        leftIcon ? (
          <RNTextInput.Icon
            icon={leftIcon}
            color={
              error
                ? theme.colors.error
                : disabled
                ? theme.colors.disabled
                : theme.colors.onSurfaceVariant
            }
          />
        ) : null
      }
      right={renderRight()}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    marginTop: 8,
    marginBottom: 8,
    marginHorizontal: '5%',
    backgroundColor: 'transparent',
  },
});

export default TextInput;
