import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Text,
  Card,
  Icon,
  useTheme,
  ActivityIndicator,
  Chip,
  Button,
} from 'react-native-paper';
import Navbar from '../../components/Navbar';
import api from '../../utils/api';
import CustomAlert from '../../components/CustomAlert';
import Toast from 'react-native-toast-message';

const UserActivity = () => {
  const bottom = useSafeAreaInsets().bottom;
  const theme = useTheme();
  const [loginHistory, setLoginHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoutAllAlertVisible, setLogoutAllAlertVisible] = useState(false);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);

  const fetchLoginHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/login-activity/login-history');
      if (res?.success && res?.data) {
        setLoginHistory(res.data);
      }
    } catch (error) {
      console.log('Fetch Login History Error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoginHistory();
  }, []);

  const handleLogoutAllDevices = async () => {
    try {
      setLogoutAllLoading(true);
      const res = await api.post('/auth/logout-all-other-devices');
      if (res?.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: res.message || 'Logged out from all other devices',
        });
        fetchLoginHistory();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: res?.message || 'Failed to logout from other devices',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'Something went wrong',
      });
    } finally {
      setLogoutAllLoading(false);
      setLogoutAllAlertVisible(false);
    }
  };

  const formatDate = dateStr => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = dateStr => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getDeviceIcon = device => {
    if (!device) return 'devices';
    const d = device.toLowerCase();
    if (d.includes('mobile') || d.includes('phone')) return 'cellphone';
    if (d.includes('tablet')) return 'tablet';
    if (d.includes('desktop') || d.includes('pc')) return 'monitor';
    return 'devices';
  };

  // ── Red banner at top of list ────────────────────────────────────────────
  const ListHeaderComponent = () => (
    <View
      style={[
        styles.logoutBanner,
        {
          borderColor: theme.colors.errorContainer,
          backgroundColor: theme.colors.errorContainer,
        },
      ]}
    >
      <View style={styles.bannerRow}>
        <Icon
          source="shield-alert-outline"
          size={18}
          color={theme.colors.error}
        />
        <Text style={[styles.bannerTitle, { color: theme.colors.error }]}>
          Suspicious activity?
        </Text>
      </View>
      <Text
        style={[
          styles.bannerSubtitle,
          { color: theme.colors.onErrorContainer },
        ]}
      >
        Logout from all other devices to keep your account secure.
      </Text>
      <Button
        mode="contained"
        icon="logout-variant"
        loading={logoutAllLoading}
        disabled={logoutAllLoading}
        onPress={() => setLogoutAllAlertVisible(true)}
        buttonColor={theme.colors.error}
        textColor="#fff"
        style={styles.logoutAllButton}
        contentStyle={styles.logoutAllButtonContent}
        labelStyle={styles.logoutAllButtonLabel}
      >
        Logout From All Devices
      </Button>
    </View>
  );

  const renderActivityCard = ({ item }) => (
    <Card mode="outlined" style={styles.card} contentStyle={styles.cardContent}>
      {/* Top Row: Device + Date */}
      <View style={styles.cardHeader}>
        <View style={styles.deviceRow}>
          <Icon
            source={getDeviceIcon(item.device)}
            size={20}
            color={theme.colors.primary}
          />
          <Text style={[styles.deviceText, { color: theme.colors.onSurface }]}>
            {item.device || 'Unknown Device'}
          </Text>
        </View>
        <Text
          style={[styles.dateText, { color: theme.colors.onSurfaceVariant }]}
        >
          {formatDate(item.loginAt)}
        </Text>
      </View>

      {/* Divider */}
      <View
        style={[
          styles.divider,
          { backgroundColor: theme.colors.outlineVariant },
        ]}
      />

      {/* Bottom Row: IP + Location + Time */}
      <View style={styles.cardFooter}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Icon
              source="ip-network"
              size={13}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.infoText,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              {item.ipAddress || '—'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Icon
              source="map-marker-outline"
              size={13}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.infoText,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              {item.location?.city && item.location.city !== 'Unknown'
                ? `${item.location.city}, ${item.location.country}`
                : 'Unknown Location'}
            </Text>
          </View>
        </View>

        <Chip
          icon="clock-outline"
          compact
          style={[
            styles.timeChip,
            { backgroundColor: theme.colors.secondaryContainer },
          ]}
          textStyle={[
            styles.timeChipText,
            { color: theme.colors.onSecondaryContainer },
          ]}
        >
          {formatTime(item.loginAt)}
        </Chip>
      </View>
    </Card>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon source="history" size={48} color={theme.colors.onSurfaceVariant} />
      <Text
        style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
      >
        No login history found
      </Text>
    </View>
  );

  return (
    <>
      <SafeAreaView
        edges={['top']}
        style={{ backgroundColor: theme.colors.background }}
      />
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Navbar title="User Activity" />

        {loading ? (
          <View style={{ marginTop: 40 }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            data={loginHistory}
            keyExtractor={item => item._id}
            renderItem={renderActivityCard}
            ListHeaderComponent={ListHeaderComponent}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={[
              styles.listContainer,
              { paddingBottom: 20 + bottom },
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Confirmation Alert */}
      <CustomAlert
        visible={logoutAllAlertVisible}
        onDismiss={() => setLogoutAllAlertVisible(false)}
        title="Logout All Devices?"
        message="This will log you out from all other active sessions. You will remain logged in on this device only."
        type="warning"
        actions={[
          {
            label: 'Cancel',
            mode: 'outlined',
            color: theme.colors.primary,
            onPress: () => setLogoutAllAlertVisible(false),
          },
          {
            label: 'Logout All',
            mode: 'contained',
            color: theme.colors.error,
            onPress: handleLogoutAllDevices,
          },
        ]}
      />
    </>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    padding: 12,
    paddingBottom: 100,
  },

  // ── Logout Banner ──────────────────────────────────────────────────────────
  logoutBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    marginHorizontal: 4,
    gap: 6,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  bannerSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  logoutAllButton: {
    borderRadius: 10,
    marginTop: 4,
  },
  logoutAllButtonContent: {
    height: 42,
  },
  logoutAllButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Card ───────────────────────────────────────────────────────────────────
  card: {
    borderRadius: 12,
    marginBottom: 10,
    marginHorizontal: 4,
  },
  cardContent: {
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRow: {
    flex: 1,
    flexShrink: 1,
    gap: 4,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 11,
    flexShrink: 1,
  }, 
  timeChip: {
    marginLeft: 8,
    height: 28,
  },
  timeChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
});

export default UserActivity;
