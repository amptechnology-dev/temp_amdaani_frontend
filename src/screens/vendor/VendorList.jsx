// src/screens/Party/VendorList.jsx
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
    View,
    StyleSheet,
    Platform,
    RefreshControl,
    FlatList,
    TouchableOpacity,
    Linking,
    useWindowDimensions,
    AccessibilityInfo,
} from 'react-native';
import {
    Card,
    useTheme,
    Text,
    Icon,
    Searchbar,
    ActivityIndicator,
    FAB,
    IconButton,
} from 'react-native-paper';
import api from '../../utils/api';
import Toast from 'react-native-toast-message';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import CustomAlert from '../../components/CustomAlert';
import Navbar from '../../components/Navbar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PartyListSkeleton } from '../../components/Skeletons';
import { SceneMap, TabView } from 'react-native-tab-view';

const LIMIT = 50;

const VendorList = ({ isNavbar = true }) => {
    const theme = useTheme();
    const navigation = useNavigation();
    const layout = useWindowDimensions();
    const bottom = useSafeAreaInsets().bottom;

    const [vendors, setVendors] = useState([]);
    const [filteredVendors, setFilteredVendors] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);

    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', actions: [] });

    const [dueVendors, setDueVendors] = useState([]);
    const [filteredDueVendors, setFilteredDueVendors] = useState([]);

    const [dueLoading, setDueLoading] = useState(false);
    const [dueRefreshing, setDueRefreshing] = useState(false);
    const [dueLoadingMore, setDueLoadingMore] = useState(false);
    const [dueCurrentPage, setDueCurrentPage] = useState(1);
    const [dueHasNextPage, setDueHasNextPage] = useState(false);

    const isDueFetchingRef = useRef(false);

    const isFetchingRef = useRef(false);
    const searchDebounceRef = useRef(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        };
    }, []);

    const showAlert = cfg => setAlertConfig({ visible: true, ...cfg });
    const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

    const [tabIndex, setTabIndex] = useState(0);

    const [routes] = useState([
        { key: 'all', title: 'All Vendors' },
        { key: 'due', title: 'Due Vendors' }
    ]);


    const transformVendor = v => ({
        id: v._id || v.id,
        name: v.name || '',
        mobile: v.mobile || '',
        state: v.state || '',
        country: v.country || '',
        isActive: !!v.isActive,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
    });

    const transformVendorWithDue = v => ({
        id: v._id,
        name: v.name,
        mobile: v.mobile,
        state: v.state,
        country: v.country,
        totalDue: v.totalDue,
        pendingPurchaseCount: v.pendingPurchaseCount,
    });


    const fetchVendors = useCallback(
        async (page = 1, append = false) => {
            if (isFetchingRef.current) return;
            isFetchingRef.current = true;
            try {
                if (append) setLoadingMore(true);
                else setLoading(true);

                setError(null);

                // Use smaller limit by default (pagination-friendly)
                const res = await api.get(`/vendor?page=${page}&limit=${LIMIT}`);
                if (!res || !res.success) throw new Error(res?.message || 'Failed to fetch vendors');

                const { docs = [], hasNextPage: nextHasNextPage = false, page: responsePage = page } = res.data || {};
                const list = docs.map(transformVendor);

                // Keep alphabetical order
                list.sort((a, b) => a.name.localeCompare(b.name));

                if (append) {
                    setVendors(prev => {
                        // avoid duplicates by id
                        const map = new Map(prev.map(p => [p.id, p]));
                        list.forEach(it => map.set(it.id, it));
                        return Array.from(map.values()).sort((x, y) => x.name.localeCompare(y.name));
                    });
                } else {
                    setVendors(list);
                }

                setCurrentPage(responsePage);
                setHasNextPage(!!nextHasNextPage);
            } catch (err) {
                console.error('fetchVendors', err);
                if (mountedRef.current) {
                    setError(err.message || 'Something went wrong');
                    Toast.show({ type: 'error', text1: 'Vendors', text2: err.message || 'Failed to load vendors' });
                }
            } finally {
                isFetchingRef.current = false;
                if (mountedRef.current) {
                    setLoading(false);
                    setLoadingMore(false);
                }
            }
        },
        []
    );

    const fetchDueVendors = useCallback(async () => {
        if (isDueFetchingRef.current) return;

        isDueFetchingRef.current = true;
        setDueLoading(true);

        try {
            const res = await api.get('/vendor/due');
            if (res.success) {
                const list = res.data.docs.map(transformVendorWithDue);

                // sort by due desc
                list.sort((a, b) => (b.totalDue || 0) - (a.totalDue || 0));

                setDueVendors(list);
                setFilteredDueVendors(list);
            }
        } catch (err) {
            // console.log("Vendor due error:", err);
        } finally {
            isDueFetchingRef.current = false;
            setDueLoading(false);
        }
    }, []);


    // initial + refresh on focus
    useFocusEffect(
        useCallback(() => {
            fetchVendors(1, false);
            fetchDueVendors(); // ADD THIS
        }, [fetchVendors, fetchDueVendors])
    );

    // pull-to-refresh
    const onRefresh = useCallback(() => {
        if (isFetchingRef.current) return;
        setRefreshing(true);
        fetchVendors(1, false).finally(() => {
            if (mountedRef.current) setRefreshing(false);
        });
    }, [fetchVendors]);

    // load more pagination
    const loadMore = useCallback(() => {
        if (!hasNextPage || isFetchingRef.current || loadingMore) return;
        fetchVendors(currentPage + 1, true);
    }, [hasNextPage, currentPage, loadingMore, fetchVendors]);

    // debounced search
    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            const q = (searchQuery || '').trim().toLowerCase();
            if (!q) {
                setFilteredVendors(vendors);
                AccessibilityInfo.announceForAccessibility('Showing all vendors');
                return;
            }
            const filtered = vendors.filter(
                v =>
                    (v.name || '').toLowerCase().includes(q) ||
                    (v.mobile || '').toString().includes(q) ||
                    (v.state || '').toLowerCase().includes(q)
            );
            setFilteredVendors(filtered);
            AccessibilityInfo.announceForAccessibility(`${filtered.length} results for ${searchQuery}`);
        }, 250);
        return () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        };
    }, [searchQuery, vendors]);

    // keep filtered in sync with vendor list (when vendors change)
    useEffect(() => {
        setFilteredVendors(vendors);
    }, [vendors]);

    const loadMoreItems = useCallback(() => {
        if (
            hasNextPage &&
            !loadingMore &&
            !loading &&
            !refreshing &&
            !isFetchingRef.current
        ) {
            // console.log('Loading more items, next page:', currentPage + 1);
            const nextPage = currentPage + 1;
            fetchVendors(nextPage, true);
        }
    }, [
        hasNextPage,
        loadingMore,
        loading,
        refreshing,
        currentPage,
        fetchVendors,
    ]);

    const handleDelete = useCallback(
        id => {
            showAlert({
                title: 'Delete vendor',
                message: 'Are you sure you want to delete this vendor? This action cannot be undone.',
                type: 'warning',
                actions: [
                    { label: 'Cancel', mode: 'outlined', onPress: hideAlert },
                    {
                        label: 'Delete',
                        mode: 'contained',
                        color: theme.colors.error,
                        onPress: async () => {
                            hideAlert();
                            try {
                                const res = await api.delete(`/vendor/id/${id}`);
                                if (res && res.success) {
                                    setVendors(prev => prev.filter(p => p.id !== id));
                                    setFilteredVendors(prev => prev.filter(p => p.id !== id));
                                    Toast.show({ type: 'success', text1: 'Vendor deleted' });
                                } else {
                                    throw new Error(res?.message || 'Failed to delete');
                                }
                            } catch (err) {
                                console.error('delete vendor', err);
                                Toast.show({ type: 'error', text1: 'Delete failed', text2: err?.message || 'Unable to delete vendor' });
                            }
                        },
                    },
                ],
            });
        },
        [theme.colors.error]
    );



    const AllVendorsRoute = () => (
        <FlatList
            data={filteredVendors}
            renderItem={renderVendorCard}
            keyExtractor={keyExtractor}
            contentContainerStyle={[styles.listContainer, filteredVendors.length === 0 && styles.emptyListContainer]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={<EmptyVendorList isDue={false} />}
            ListFooterComponent={
                renderFooter(loadingMore)
            }
            showsVerticalScrollIndicator={false}
        />
    );

    const DueVendorsRoute = () => {
        if (dueLoading && !dueRefreshing && dueVendors.length === 0) {
            return <PartyListSkeleton count={4} />;
        }

        return (
            <FlatList
                data={filteredDueVendors}
                renderItem={({ item }) => renderVendorDueCard(item)}
                keyExtractor={item => item.id}
                ListEmptyComponent={<EmptyVendorList isDue={true} />}
                ListFooterComponent={renderFooter(dueLoadingMore)}
                ListHeaderComponent={dueVendors.length > 0 && <DueSummaryCard />}
                contentContainerStyle={[
                    styles.listContainer,
                    filteredDueVendors.length === 0 && styles.emptyListContainer,
                ]}
                refreshControl={
                    <RefreshControl refreshing={dueRefreshing} onRefresh={onRefresh} />
                }
                onEndReached={loadMoreItems}
                onEndReachedThreshold={0.3}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={10}
            />
        );
    };

    const renderFooter = isLoading => {
        if (!isLoading) return null;
        return (
            <View style={styles.footerContainer}>
                <ActivityIndicator size="small" />
                <Text style={styles.footerText}>Loading more...</Text>
            </View>
        );
    };

    const renderScene = SceneMap({
        all: AllVendorsRoute,
        due: DueVendorsRoute,
    });

    const EmptyVendorList = ({ isDue = false }) => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
                <Icon
                    source={isDue ? 'check-circle-outline' : 'account-group-outline'}
                    size={72}
                    color={isDue ? theme.colors.primary : theme.colors.outline}
                />
            </View>
            <Text variant="headlineMedium" style={styles.emptyTitle}>
                {searchQuery
                    ? 'No Vendors Found'
                    : isDue
                        ? 'All Clear! 🎉'
                        : 'No Vendors Yet'}
            </Text>
            <Text variant="bodyLarge" style={styles.emptySubtitle}>
                {searchQuery
                    ? `No vendors match "${searchQuery}". Try searching by name or mobile number.`
                    : isDue
                        ? 'Great job! All your vendors have cleared their outstanding payments.'
                        : 'Start by adding your first vendor to begin tracking sales and payments.'}
            </Text>
            {!searchQuery && !isDue && (
                <TouchableOpacity
                    onPress={() => navigation.navigate('AddParty')}
                    style={styles.emptyActionButton}
                >
                    <Icon source="plus" size={24} color="#fff" />
                    <Text
                        variant="labelLarge"
                        style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}
                    >
                        Add Vendor
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );


    const handleOpenCall = useCallback(number => {
        if (!number) return;
        Linking.openURL(`tel:${number}`).catch(err => {
            Toast.show({ type: 'error', text1: 'Call failed', text2: 'Unable to open dialer' });
        });
    }, []);

    const handleNavigateToEdit = useCallback(vendor => navigation.navigate('AddVendor', { vendor }), [navigation]);

    const calculateTotalDue = vendorList => {
        return vendorList.reduce(
            (total, vendor) => total + vendor.totalDue,
            0,
        );
    };

    const DueSummaryCard = () => {
        const totalDue = calculateTotalDue(dueVendors);
        const dueCount = dueVendors.length;

        return (
            <Card
                style={{
                    marginBottom: 8,
                    borderRadius: 12,
                    backgroundColor: theme.colors.surface,
                }}
                mode="contained"
            >
                <Card.Content style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        {/* Total Due */}
                        <View
                            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                        >
                            <View
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: theme.colors.background,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: 12,
                                }}
                            >
                                <Icon source="currency-inr" size={18} color="#d32f2f" />
                            </View>
                            <View>
                                <Text
                                    variant="labelSmall"
                                    style={{
                                        color: theme.colors.onBackground,
                                        fontSize: 11,
                                        fontWeight: '500',
                                    }}
                                >
                                    Total Due
                                </Text>
                                <Text
                                    variant="titleMedium"
                                    style={{ fontWeight: '700', color: '#d32f2f', fontSize: 16 }}
                                >
                                    ₹{totalDue.toLocaleString('en-IN')}
                                </Text>
                            </View>
                        </View>

                        {/* Customer Count */}
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                flex: 1,
                                justifyContent: 'flex-end',
                            }}
                        >
                            <View>
                                <Text
                                    variant="labelSmall"
                                    style={{
                                        color: theme.colors.onBackground,
                                        fontSize: 11,
                                        fontWeight: '500',
                                        textAlign: 'right',
                                    }}
                                >
                                    Due Accounts
                                </Text>
                                <Text
                                    variant="titleMedium"
                                    style={{
                                        fontWeight: '700',
                                        color: theme.colors.primary,
                                        fontSize: 16,
                                        textAlign: 'right',
                                    }}
                                >
                                    {dueCount}
                                </Text>
                            </View>
                            <View
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: theme.colors.background,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginLeft: 12,
                                }}
                            >
                                <Icon source="account" size={18} color="#1976d2" />
                            </View>
                        </View>
                    </View>
                </Card.Content>
            </Card>
        );
    };

    const renderVendorDueCard = vendor => {
        const getDueSeverity = amount => {
            if (amount >= 10000)
                return { level: 'critical', color: theme.colors.error };
            if (amount >= 5000) return { level: 'warning', color: '#F57C00' };
            return { level: 'normal', color: theme.colors.primary };
        };

        const showDueBadge = vendor.totalDue > 0;
        const dueSeverity = showDueBadge ? getDueSeverity(vendor.totalDue) : null;
        return (
            <Card
                theme={{ roundness: 12 }}
                accessibilityRole="button"
                onPress={() => navigation.navigate("VendorDueDetails", { id: vendor.id })}
                style={[styles.card, { borderLeftWidth: 4, borderLeftColor: theme.colors.error }]}
            >
                <Card.Content>
                    <View style={styles.topRow}>
                        <View style={{ flex: 1 }}>
                            <Text variant="titleMedium" numberOfLines={1} style={styles.name}>
                                {vendor.name || '—'}
                            </Text>
                            {/* <Text variant="bodySmall" style={styles.subText}>
                            {vendor.state ? `${vendor.state}${vendor.country ? ', ' + vendor.country : ''}` : vendor.country || '—'}
                        </Text> */}
                        </View>

                        {/* <View style={styles.actions}>
              <IconButton accessibilityLabel={`Edit ${item.name}`} icon="pencil" size={18} onPress={() => handleNavigateToEdit(item)} />
              <IconButton accessibilityLabel={`Delete ${item.name}`} icon="delete-outline" size={18} onPress={() => handleDelete(item.id)} />
            </View> */}
                    </View>

                    <View style={styles.contactRow}>
                        <View style={styles.mobileSection}>
                            <Icon source="phone-outline" size={16} color={theme.colors.onSurfaceVariant} />
                            <Text variant="bodyMedium" style={styles.mobileText}>
                                {vendor.mobile || '—'}
                            </Text>
                        </View>

                        {vendor.mobile ? (
                            <IconButton
                                icon="phone"
                                size={18}
                                iconColor="#fff"
                                onPress={() => handleOpenCall(vendor.mobile)}
                                accessibilityLabel={`Call ${vendor.name}`}
                                accessibilityRole="button"
                                style={styles.callBtn}
                            />
                        ) : null}
                    </View>
                    {showDueBadge && dueSeverity && (
                        <View
                            style={[styles.dueSection, { borderColor: dueSeverity.color }]}
                        >
                            <View style={styles.dueLeft}>
                                <Text variant="labelSmall" style={styles.dueLabel}>
                                    OUTSTANDING
                                </Text>
                                <Text
                                    variant="headlineSmall"
                                    style={[styles.dueAmount, { color: dueSeverity.color }]}
                                >
                                    ₹{vendor.totalDue.toLocaleString('en-IN')}
                                </Text>
                            </View>
                            <View style={styles.dueRight}>
                                <View
                                    style={[
                                        styles.dueBadge,
                                        { backgroundColor: `${dueSeverity.color}15` },
                                    ]}
                                >
                                    <Icon
                                        source="file-document"
                                        size={14}
                                        color={dueSeverity.color}
                                    />
                                    <Text
                                        style={[
                                            styles.dueBadgeText,
                                            { color: dueSeverity.color },
                                        ]}
                                    >
                                        {vendor.pendingInvoiceCount} Pending
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}
                </Card.Content>
            </Card>
        )
    }


    const renderVendorCard = useCallback(
        ({ item }) => (
            <Card theme={{ roundness: 12 }} accessibilityRole="button" style={styles.card} mode="elevated" onPress={() => handleNavigateToEdit(item)}>
                <Card.Content style={styles.cardContent}>
                    <View style={styles.topRow}>
                        <View style={{ flex: 1 }}>
                            <Text variant="titleMedium" numberOfLines={1} style={styles.name}>
                                {item.name || '—'}
                            </Text>
                            <Text variant="bodySmall" style={styles.subText}>
                                {item.state ? `${item.state}${item.country ? ', ' + item.country : ''}` : item.country || '—'}
                            </Text>
                        </View>

                        {/* <View style={styles.actions}>
              <IconButton accessibilityLabel={`Edit ${item.name}`} icon="pencil" size={18} onPress={() => handleNavigateToEdit(item)} />
              <IconButton accessibilityLabel={`Delete ${item.name}`} icon="delete-outline" size={18} onPress={() => handleDelete(item.id)} />
            </View> */}
                    </View>

                    <View style={styles.contactRow}>
                        <View style={styles.mobileSection}>
                            <Icon source="phone-outline" size={16} color={theme.colors.onSurfaceVariant} />
                            <Text variant="bodyMedium" style={styles.mobileText}>
                                {item.mobile || '—'}
                            </Text>
                        </View>

                        {item.mobile ? (
                            <IconButton
                                icon="phone"
                                size={18}
                                iconColor="#fff"
                                onPress={() => handleOpenCall(item.mobile)}
                                accessibilityLabel={`Call ${item.name}`}
                                accessibilityRole="button"
                                style={styles.callBtn}
                            />
                        ) : null}
                    </View>
                </Card.Content>
            </Card>
        ),
        [handleDelete, handleNavigateToEdit, handleOpenCall, theme.colors.onSurfaceVariant]
    );

    const keyExtractor = useCallback(item => item.id, []);

    const ListEmptyComponent = useMemo(
        () =>
            loading ? (
                <PartyListSkeleton count={6} />
            ) : (
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconContainer}>
                        <Icon source="store-outline" size={72} color={theme.colors.onSurfaceVariant} />
                    </View>
                    <Text variant="headlineMedium" style={styles.emptyTitle}>
                        No Vendors
                    </Text>
                    <Text variant="bodyLarge" style={styles.emptySubtitle}>
                        Add your vendors to manage purchases & balances.
                    </Text>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('AddVendor')}
                        style={[styles.emptyActionButton, { backgroundColor: theme.colors.primary }]}
                        accessibilityRole="button"
                    >
                        <Icon source="plus" size={20} color="#fff" />
                        <Text variant="labelLarge" style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                            Add Vendor
                        </Text>
                    </TouchableOpacity>
                </View>
            ),
        [loading, navigation, theme.colors.onSurfaceVariant, theme.colors.primary]
    );

    const renderTabBar = props => {
        const { navigationState } = props;

        return (
            <View
                style={[
                    styles.tabBarContainer,
                    { backgroundColor: theme.colors.background },
                ]}
            >
                <View
                    style={[
                        styles.segmentedControl,
                        { backgroundColor: theme.colors.background },
                    ]}
                >
                    {props.navigationState.routes.map((route, index) => {
                        const isActive = index === navigationState.index;
                        const isDueTab = route.key === 'due';
                        const dueCount = isDueTab ? dueVendors.length : 0;

                        return (
                            <TouchableOpacity
                                key={route.key}
                                style={[
                                    styles.segment,
                                    {
                                        backgroundColor: isActive
                                            ? theme.colors.primary
                                            : theme.colors.primaryContainer,
                                        position: 'relative'
                                    },
                                ]}
                                onPress={() => props.jumpTo(route.key)}
                                activeOpacity={0.8}
                            >
                                <View style={styles.segmentContent}>
                                    <Icon
                                        source={isDueTab ? 'cash-clock' : 'account-group'}
                                        size={18}
                                        color={isActive ? '#fff' : theme.colors.onSurfaceVariant}
                                    />
                                    <Text
                                        variant="labelLarge"
                                        style={[
                                            styles.segmentText,
                                            {
                                                color: isActive
                                                    ? '#fff'
                                                    : theme.colors.onSurfaceVariant,
                                            },
                                        ]}
                                    >
                                        {route.title}
                                    </Text>
                                    {isDueTab && dueCount > 0 && (
                                        <View
                                            style={[
                                                styles.countBadge,
                                                {
                                                    backgroundColor: theme.colors.error,
                                                    position: 'absolute',
                                                    right: -20,
                                                    top: -15,
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.countText,

                                                    {
                                                        color: 'white',
                                                        fontWeight: 'bold'
                                                    },
                                                ]}
                                            >
                                                {dueCount}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );
    };


    return (
        <>
            {isNavbar && <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.background }} />}
            <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
                {isNavbar && <Navbar title="Vendors" />}

                <View style={styles.searchContainer}>
                    <Searchbar
                        placeholder="Search name, phone or state"
                        onChangeText={q => setSearchQuery(q)}
                        value={searchQuery}
                        style={styles.searchBar}
                        inputStyle={styles.searchInput}
                        iconColor={theme.colors.onSurfaceVariant}
                        accessibilityLabel="Search vendors"
                        placeholderTextColor={theme.colors.onSurfaceVariant}
                    />
                </View>

                <TabView
                    navigationState={{ index: tabIndex, routes }}
                    renderScene={renderScene}
                    onIndexChange={setTabIndex}
                    initialLayout={{ width: layout.width }}
                    renderTabBar={renderTabBar}
                    lazy
                    lazyPreloadDistance={0}
                />

                {/* <FlatList
                    data={filteredVendors}
                    renderItem={renderVendorCard}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={[styles.listContainer, filteredVendors.length === 0 && styles.emptyListContainer]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.4}
                    ListEmptyComponent={ListEmptyComponent}
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={styles.footerContainer}>
                                <ActivityIndicator size="small" />
                                <Text style={styles.footerText}>Loading more...</Text>
                            </View>
                        ) : null
                    }
                    showsVerticalScrollIndicator={false}
                /> */}

                <CustomAlert visible={alertConfig.visible} onDismiss={hideAlert} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} actions={alertConfig.actions} />

                <FAB
                    mode="elevated"
                    color={'white'}
                    accessibilityLabel="Add vendor"
                    icon="store-plus"
                    onPress={() => navigation.navigate('AddVendor')}
                    style={[styles.fab, { backgroundColor: theme.colors.primary, marginBottom: bottom }]}
                    extended
                />
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    searchContainer: { paddingHorizontal: 16, backgroundColor: 'transparent', paddingBottom: 8 },
    searchBar: { elevation: 0, borderRadius: 12 },
    searchInput: { fontSize: 16 },
    listContainer: { paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8 },
    emptyListContainer: { flexGrow: 1 },
    card: {
        marginBottom: 8,
        borderRadius: 12,
        overflow: 'hidden',
        ...Platform.select({
            android: { elevation: 2 },
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
        }),
    },
    cardContent: { paddingVertical: 12, paddingHorizontal: 14 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    name: { fontWeight: '700', fontSize: 16, textTransform: 'capitalize' },
    subText: { marginTop: 4, fontSize: 12, color: '#666' },
    actions: { flexDirection: 'row', alignItems: 'center' },
    contactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', },
    mobileSection: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    mobileText: { fontSize: 15, fontWeight: '500' },
    callBtn: {
        backgroundColor: '#4CAF50',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    statText: { fontSize: 13, color: '#666' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 80, minHeight: 400 },
    emptyIconContainer: { marginBottom: 20, opacity: 0.5 },
    emptyTitle: { fontWeight: '700', textAlign: 'center', marginBottom: 8 },
    emptySubtitle: { textAlign: 'center', lineHeight: 22, opacity: 0.7 },
    emptyActionButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginTop: 12 },
    footerContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16 },
    footerText: { marginLeft: 8, fontSize: 14 },
    fab: { position: 'absolute', margin: 16, right: 16, bottom: 20 },
    tabBarContainer: {
        paddingHorizontal: 16,
        paddingVertical: 4
    },

    segmentedControl: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 4,
        gap: 6,
    },

    segment: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },

    segmentActive: {
        ...Platform.select({
            android: {
                elevation: 2,
            },
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 3,
            },
        }),
    },

    segmentContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },

    segmentText: {
        fontSize: 14,
        fontWeight: '600',
    },

    countBadge: {
        height: 20, width: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
    },

    countBadgeActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },

    countText: {
        fontSize: 9,
        fontWeight: '700',
    },
    dueSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 12,
        padding: 8,
        borderWidth: 1,
        borderStyle: 'dashed',
    },

    dueLeft: {
        gap: 4,
    },

    dueLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        opacity: 0.7,
    },

    dueAmount: {
        fontWeight: '800',
        fontSize: 22,
        letterSpacing: 0.5,
    },

    dueRight: {
        alignItems: 'flex-end',
    },

    dueBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },

    dueBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },

    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 6,
    },

    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },

    statText: {
        fontSize: 13,
        color: '#666',
    },
});

export default VendorList;
