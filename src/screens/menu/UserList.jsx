import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Touchable,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Text,
  Card,
  Icon,
  FAB,
  useTheme,
  ActivityIndicator,
  IconButton,
} from 'react-native-paper';
import Navbar from '../../components/Navbar';
import api from '../../utils/api';
import AddUserBottomSheet from '../../components/BottomSheet/AddUserBottomSheet';
import CustomAlert from '../../components/CustomAlert';
import { useAuth } from '../../context/AuthContext';
import Toast from 'react-native-toast-message';

const UsersList = () => {
  const bottom = useSafeAreaInsets().bottom;
  const theme = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertVisible, setAlertVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const { authState } = useAuth();

  const user = authState?.user;

  const addUserSheetRef = useRef(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/store/users');
      // console.log('Fetch Users Response:', res);

      if (res?.success && res?.data) {
        setUsers(res.data);
      }
    } catch (error) {
      // console.log('Fetch Users Error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      // console.log('User ID:', user?._id);
    }, 1000);
    fetchUsers();
  }, []);

  const handleDeletePress = id => {
    setSelectedUserId(id);
    setAlertVisible(true);
  };

  const confirmDelete = async () => {
    // console.log('Delete User ID:', selectedUserId);

    // Delete API commented as requested
    try {
      const res = await api.delete(`/store/users/${selectedUserId}`);
      // console.log('Delete User Result:', res);
      if (res.success) {
        Toast.show({
          type: 'success',
          text1: 'Deleted',
          text2: res.message || 'User deleted successfully',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: res.message || 'Failed to delete user',
        });
      }
      fetchUsers();
    } catch (err) {
      // console.log('Delete User Error:', err.message);
    }

    setAlertVisible(false);
  };

  const renderUserCard = ({ item }) => (
    <Card mode="outlined" style={styles.card} contentStyle={styles.cardContent}>
      <View style={styles.cardHeader}>
        <Text variant="titleMedium" style={styles.userName}>
          {item.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon
            source={item.isVerified ? 'check-decagram' : 'shield-alert'}
            size={22}
            color={item.isVerified ? theme.colors.primary : theme.colors.error}
          />
          {user?._id !== item._id && (
            <TouchableOpacity
              onPress={() => handleDeletePress(item._id)}
              activeOpacity={0.7}
            >
              <Icon source="delete" size={22} color={theme.colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.contactInfo}>
          <Icon
            source="phone"
            size={12}
            color={theme.colors.onSurfaceVariant}
          />
          <Text style={styles.phoneText}>{item.phone}</Text>
          {item.email && (
            <>
              <Icon
                source="email"
                size={12}
                color={theme.colors.onSurfaceVariant}
              />
              <Text style={styles.emailText}>{item.email}</Text>
            </>
          )}
        </View>

        <View style={styles.tagsContainer}>
          <Text
            style={[
              styles.roleTag,
              { backgroundColor: theme.colors.secondaryContainer },
            ]}
          >
            {item.role?.name?.toUpperCase()}
          </Text>
          <Text
            style={[
              styles.statusTag,
              {
                backgroundColor: item.isActive ? '#4CAF50' : theme.colors.error,
              },
            ]}
          >
            {item.isActive ? 'ACTIVE' : 'INACTIVE'}
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <>
      <SafeAreaView
        edges={['top']}
        style={{ backgroundColor: theme.colors.background }}
      />

      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Navbar title={'Users List'} />

        {loading ? (
          <View style={{ marginTop: 40 }}>
            <ActivityIndicator size={'large'} color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={item => item._id}
            renderItem={renderUserCard}
            contentContainerStyle={[styles.listContainer, { paddingBottom: 80 + bottom }]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <FAB
        icon="account-plus"
        color="white"
        style={[styles.fab, { backgroundColor: theme.colors.primary, marginBottom: bottom }]}
        onPress={() => addUserSheetRef.current?.present()}
      />

      <AddUserBottomSheet
        ref={addUserSheetRef}
        onSubmit={data => {
          // console.log('NEW USER DATA:', data);
          fetchUsers(); // (optional) will refresh list when API added
        }}
      />
      <CustomAlert
        visible={alertVisible}
        onDismiss={() => setAlertVisible(false)}
        title="Delete User?"
        message="Are you sure you want to delete this user? This action cannot be undone."
        type="warning"
        actions={[
          {
            label: 'Cancel',
            mode: 'outlined',
            color: theme.colors.error,
            onPress: () => setAlertVisible(false),
          },
          {
            label: 'Delete',
            mode: 'contained',
            color: theme.colors.error,
            onPress: confirmDelete,
          },
        ]}
      />
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginBottom: 8,
    marginHorizontal: 12,
  },
  cardContent: {
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  userInfo: {
    flex: 1,
    marginRight: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneText: {
    fontSize: 11,
    marginLeft: 4,
    color: '#666',
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  roleTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 9,
    fontWeight: '600',
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 9,
    fontWeight: '600',
    color: '#fff',
  },
  listContainer: {
    padding: 8,
    paddingBottom: 100,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});

export default UsersList;
