import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Card, Text, useTheme, Button, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Navbar from '../../components/Navbar';

const ReportScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation();

  const reportData = [
    {
      id: '1',
      title: 'Sales Report',
      description:
        'Sales performance with totals, discounts, and revenue analysis',
      icon: 'chart-line',
      route: 'SalesReport',
    },
    {
      id: '2',
      title: 'Product Report',
      description: 'Product-wise sales performance and stock movement',
      icon: 'package-variant',
      route: 'ProductReport',
    },
    {
      id: '3',
      title: 'Product Wise Sales',
      description: 'Detailed product-wise sales performance and revenue',
      icon: 'chart-box',
      route: 'ProductWiseSalesReport',
    },
    {
      id: '4',
      title: 'Expense Report',
      description: 'Expense analysis and budget tracking',
      icon: 'cash-multiple',
      route: 'ExpenseHeadReport',
    },
    {
      id: '5',
      title: 'GST Report',
      description:
        'GST summary including tax collected, input credits, and filing details',
      icon: 'money-bill',
      route: 'GstReport',
    },
  ];

  const renderReportCard = ({ item }) => (
    <Card
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderLeftWidth: 4,
          borderLeftColor: theme.colors.primary,
        },
      ]}
      mode="elevated"
      elevation={2}
    >
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Icon name={item.icon} size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                {item.title}
              </Text>
              <Text
                variant="bodySmall"
                style={[
                  styles.cardDesc,
                  { color: theme.colors.onSurfaceVariant },
                ]}
                numberOfLines={2}
              >
                {item.description}
              </Text>
            </View>
          </View>
          <Button
            mode="contained"
            compact
            onPress={() => navigation.navigate(item.route)}
            style={styles.button}
            labelStyle={styles.buttonLabel}
            icon="arrow-right"
          >
            View
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      {/* <View
        style={[
          styles.headerIcon,
          { backgroundColor: theme.colors.primaryContainer },
        ]}
      > 
        <Icon name="chart-donut" size={32} color={theme.colors.primary} />
      </View> */}
      <Text
        variant="headlineSmall"
        style={[styles.title, { color: theme.colors.primary }]}
      >
        Business Reports
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
      >
        Generate and export detailed business analytics
      </Text>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <Navbar showBackButton title={'Reports'} help="Reports" />

      <FlatList
        data={reportData}
        renderItem={renderReportCard}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
      />
    </SafeAreaView>
  );
};

export default ReportScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 14,
    maxWidth: 280,
  },
  card: {
    marginVertical: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontWeight: '600',
    marginBottom: 4,
    fontSize: 16,
  },
  cardDesc: {
    lineHeight: 18,
    fontSize: 13,
  },
  button: {
    minWidth: 80,
    height: 36,
    borderRadius: 8,
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  divider: {
    height: 8,
  },
});
