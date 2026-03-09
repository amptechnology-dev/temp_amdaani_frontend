// components/InvoiceItemCard.jsx
import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  StyleSheet,
} from "react-native";
import { Surface, Text, Divider, useTheme, Icon } from "react-native-paper";
import Animated, { FadeInDown, FadeOutUp, Layout } from "react-native-reanimated";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const f = v => Number(v || 0).toFixed(2);

const InvoiceItemCard = ({ item }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const hasGst = item.gstRate > 0;

  const toggleExpand = () => {
    if (!hasGst) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  };

  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutUp}
      layout={Layout.springify()}
      style={styles.wrapper}
    >
      <Surface
        elevation={0}
        style={[
          styles.card,
          { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.elevation.level1 },
        ]}
      >
        {/* Header - COMPRESSED */}
        <TouchableOpacity style={styles.header} activeOpacity={0.8} onPress={toggleExpand}>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.title, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>

            <Text style={styles.sub}>
              ₹{f(item.price - item.discount)} × {item.qty}
            </Text>
          </View>

          <View style={styles.endSection}>
            <Text style={[styles.total, { color: theme.colors.primary }]}>
              ₹{f(item.total)}
            </Text>

            {hasGst && (
              <Icon
                source={expanded ? "chevron-up" : "chevron-down"}
                size={18}
                color={theme.colors.outline}
              />
            )}
          </View>
        </TouchableOpacity>

        {/* EXPANDED GST SECTION - compact */}
        {expanded && (
          <Animated.View entering={FadeInDown} exiting={FadeOutUp} style={styles.expandBox}>
            <Divider style={{ marginVertical: 4 }} />

            <Row label="GST Rate" value={`${item.gstRate}%`} />
            <Row label="Taxable Value" value={`₹${f(item.taxableValue)}`} />
            <Row label="GST Amount" value={`₹${f(item.gstAmount)}`} />

            <Divider style={{ marginVertical: 4 }} />

            <Row
              label="Total"
              value={`₹${f(item.total)}`}
              bold
              color={theme.colors.primary}
            />
          </Animated.View>
        )}
      </Surface>
    </Animated.View>
  );
};

const Row = ({ label, value, bold, color }) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel]}>{label}</Text>
    <Text
      style={[
        styles.rowValue,
        bold && { fontWeight: "700" },
        color && { color },
      ]}
    >
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 10,
    marginBottom: 6,
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 13.5,
    fontWeight: "600",
  },
  sub: {
    fontSize: 11,
    color: "#777",
    marginTop: 2,
  },
  endSection: {
    alignItems: "flex-end",
    minWidth: 70,
  },
  total: {
    fontSize: 14,
    fontWeight: "700",
  },
  expandBox: {
    marginTop: 6,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  rowLabel: { fontSize: 11, color: "#666" },
  rowValue: { fontSize: 11, fontWeight: "500" },
});

export default InvoiceItemCard;
