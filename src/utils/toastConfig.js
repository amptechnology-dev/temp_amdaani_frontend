import React from 'react';
import { View, Text } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const CustomToast = ({ type, text1, text2 }) => {
  let iconName;
  let iconColor;
  let backgroundColor;

  switch (type) {
    case 'success':
      iconName = 'check-circle';
      iconColor = '#22c55e'; // Tailwind green-500
      backgroundColor = '#ecfdf5'; // light green background
      break;
    case 'error':
      iconName = 'error-outline';
      iconColor = '#ef4444'; // red-500
      backgroundColor = '#fef2f2'; // light red background
      break;
    case 'warning':
      iconName = 'warning';
      iconColor = '#f59e0b'; // amber-500
      backgroundColor = '#fffbeb'; // light amber background
      break;
    case 'info':
      iconName = 'info';
      iconColor = '#3b82f6'; // blue-500
      backgroundColor = '#eff6ff'; // light blue background
      break;
    default:
      iconName = 'info';
      iconColor = '#6b7280'; // gray-500
      backgroundColor = '#f3f4f6'; // gray-100
  }

  return (
    <View
      style={{
        width: '90%',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      <MaterialIcons
        name={iconName}
        size={22}
        color={iconColor}
        style={{ marginRight: 10 }}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: '#111827', // gray-900
            fontWeight: '600',
            fontSize: 14,
          }}
          numberOfLines={1}
        >
          {text1}
        </Text>
        {text2 && (
          <Text
            style={{
              color: '#374151', // gray-700
              fontSize: 12,
              marginTop: 2,
            }}
            numberOfLines={2}
          >
            {text2}
          </Text>
        )}
      </View>
    </View>
  );
};

export const toastConfig = {
  success: props => <CustomToast {...props} type="success" />,
  error: props => <CustomToast {...props} type="error" />,
  warning: props => <CustomToast {...props} type="warning" />,
  info: props => <CustomToast {...props} type="info" />,
};
