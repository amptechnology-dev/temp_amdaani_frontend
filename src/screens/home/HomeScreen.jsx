import * as React from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text, useTheme, Button } from 'react-native-paper';
import { TabView, TabBar } from 'react-native-tab-view';
import PartyList from '../party/PartyList';
import InvoiceList from '../sales/InvoiceList';
import Transactions from '../menu/Transactions';

const initialLayout = { width: Dimensions.get('window').width };

export default function HomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [index, setIndex] = React.useState(0);
  const [routes] = React.useState([
    { key: 'transactions', title: 'Recent Transactions' },
    { key: 'party', title: 'Customers' },
  ]);

  const renderTransactions = () => <Transactions isNavbar={false} />;
  const renderParties = () => <PartyList isNavbar={false} />;

  const renderScene = ({ route }) => {
    switch (route.key) {
      case 'transactions':
        return renderTransactions();
      case 'party':
        return renderParties();
      default:
        return null;
    }
  };

  const renderTabBar = props => (
    <TabBar
      {...props}
      indicatorStyle={{
        height: 32,
        width: '45%',
        borderRadius: 16,
        top: 8,
        bottom: 8,
        left: '27.5%',
        right: '27.5%',
        marginHorizontal: '2.5%',
        backgroundColor: theme.colors.primary,
      }}
      activeColor={theme.colors.onPrimary}
      inactiveColor={theme.colors.onSurface}
      style={{
        height: 48,
        backgroundColor: theme.colors.surface,
        elevation: 0,
        borderColor: theme.colors.outline,
        borderBottomWidth: 1,
      }}
      renderLabel={({ route, focused }) => (
        <Text
          style={{
            fontSize: 14,
            fontWeight: focused ? '600' : '500',
            letterSpacing: 0.1,
            textTransform: 'capitalize',
            color: focused ? theme.colors.primary : theme.colors.onSurface,
          }}
        >
          {route.title}
        </Text>
      )}
      tabStyle={{ height: 48, marginHorizontal: 8 }}
      pressColor={theme.colors.primaryContainer}
      pressOpacity={0.8}
    />
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {renderTransactions()}
      {/* <TabView
        swipeEnabled={false}
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={initialLayout}
        renderTabBar={renderTabBar}
      /> */}

      {/* <Button
        mode="contained"
        icon={index === 0 ? 'currency-rupee' : 'account-plus'}
        onPress={() => {
          if (index === 0) {
            navigation.navigate('NewSale');
          } else {
            navigation.navigate('AddParty');
          }
        }}
        style={styles.addButton}
        contentStyle={{ height: 48 }}
        labelStyle={{ fontSize: 16, letterSpacing: 0.15 }}
      >
        {index === 0 ? 'Add New Sale' : 'Add New Party'}
      </Button> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  partyCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  partyLeftContent: {
    flex: 1,
  },
  partyRightContent: {
    alignItems: 'flex-end',
  },
  content: {
    flex: 1,
  },
  transactionsList: {
    paddingBottom: 10,
    padding: 12,
  },
  transactionCard: {
    marginBottom: 8,
    borderRadius: 12,
    ...Platform.select({
      android: {
        elevation: 1,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
    }),
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  transactionDatesale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  tagText: {
    letterSpacing: 0.1,
    fontWeight: '500',
  },
  transactionId: {
    letterSpacing: 0.4,
  },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  transactionAmount: {
    flex: 1,
  },
  label: {
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  date: {
    letterSpacing: 0.4,
  },
  transactionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  addButton: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    borderRadius: 30,
    elevation: 8,
    zIndex: 1,
  },
  divider: {
    marginTop: 8,
    marginBottom: 6,
  },
});
