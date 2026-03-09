// ThemeDropdown.js
import React, { useState } from "react";
import { Button, Menu, useTheme } from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

const themeOptions = {
  system: { label: "System default", icon: "monitor" },
  light: { label: "Light", icon: "white-balance-sunny" },
  dark: { label: "Dark", icon: "moon-waning-crescent" },
};

const ThemeDropdown = ({ themeMode, setThemeMode }) => {
  const [visible, setVisible] = useState(false);
  const theme = useTheme();

  const current = themeOptions[themeMode];

  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchorPosition="bottom"
    >
      {/* 👇 The anchor must be defined INSIDE Menu using Menu.Anchor */}
      <Menu.Anchor>
        <Button
          mode="outlined"
          compact
          onPress={() => setVisible(true)}
          style={{ borderRadius: 8 }}
          labelStyle={{ color: theme.colors.onSurface }}
          icon={() => (
            <MaterialCommunityIcons
              name={current.icon}
              size={18}
              color={theme.colors.onSurfaceVariant}
            />
          )}
        >
          {current.label}
        </Button>
      </Menu.Anchor>

      {/* Menu Items */}
      {Object.entries(themeOptions).map(([key, opt]) => (
        <Menu.Item
          key={key}
          onPress={() => {
            setThemeMode(key);
            setVisible(false);
          }}
          title={opt.label}
          leadingIcon={() => (
            <MaterialCommunityIcons
              name={opt.icon}
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
          )}
        />
      ))}
    </Menu>
  );
};

export default ThemeDropdown;
