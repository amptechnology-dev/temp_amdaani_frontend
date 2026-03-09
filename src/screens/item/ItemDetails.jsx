import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Navbar from '../../components/Navbar';
import { Card, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const ItemDetails = ({ route }) => {
  const { item } = route.params;
  const theme = useTheme();

  useEffect(() => {
    // console.log('Item Details:', item);
  }, [item]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Navbar title="Item Details" showBackButton={true} righticon="pencil" />

      <Card
        style={[styles.container, { backgroundColor: theme.colors.surface }]}
      >
        <Card.Content style={styles.section}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.category}>{item.category}</Text>
          <View style={styles.priceRow}>
            <View style={styles.priceColumn}>
              <Text variant="labelMedium">Price</Text>
              <Text variant="bodyMedium">{item.price.toFixed(2)}</Text>
            </View>

            <View style={styles.priceColumn}>
              <Text variant="labelMedium">Revenue</Text>
              <Text variant="bodyMedium">{item.revenue}</Text>
            </View>

            <View style={styles.priceColumn}>
              <Text variant="labelMedium">Sales</Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.primary }}
              >
                {item.sales}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    elevation: 2,
    marginHorizontal: '5%',
  },
  section: {
    borderRadius: 8,
    padding: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  category: {
    fontSize: 16,
    marginBottom: 16,
  },
});

export default ItemDetails;
