import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { Card, Text, Chip, useTheme, Surface, IconButton, Menu, Divider, Icon } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, parseISO, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import Navbar from '../../components/Navbar';
import api from '../../utils/api';
import Toast from 'react-native-toast-message';

const PlanTransactions = () => {
    const [transactions, setTransactions] = useState([]);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [menuVisible, setMenuVisible] = useState(false);
    const theme = useTheme();

    // Fetch transactions from API
    const fetchTransactions = async (isRefreshing = false) => {
        try {
            if (!isRefreshing) setLoading(true);

            const response = await api.get('/subscription/get-payments');

            if (response.success && response.data) {
                const sortedTransactions = response.data.sort(
                    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
                );
                setTransactions(sortedTransactions);
                setFilteredTransactions(sortedTransactions);
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Failed to fetch transactions',
                });
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Something went wrong',
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    // Filter transactions based on status
    useEffect(() => {
        if (statusFilter === 'all') {
            setFilteredTransactions(transactions);
        } else {
            setFilteredTransactions(
                transactions.filter(t => t.status.toLowerCase() === statusFilter)
            );
        }
    }, [statusFilter, transactions]);

    // Pull to refresh handler
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchTransactions(true);
    }, []);

    // Format date using date-fns
    const formatTransactionDate = (dateString) => {
        const date = parseISO(dateString);

        if (isToday(date)) {
            return `Today, ${format(date, 'h:mm a')}`;
        } else if (isYesterday(date)) {
            return `Yesterday, ${format(date, 'h:mm a')}`;
        } else if (isThisWeek(date)) {
            return format(date, 'EEEE, h:mm a');
        } else if (isThisMonth(date)) {
            return format(date, 'MMM d, h:mm a');
        } else {
            return format(date, 'MMM d, yyyy');
        }
    };

    // Extract transaction ID number (remove 'txn_' prefix)
    const formatTransactionId = (transactionId) => {
        return transactionId.replace('txn_', '');
    };

    // Get status configuration
    const getStatusConfig = (status) => {
        switch (status.toLowerCase()) {
            case 'success':
                return {
                    color: '#10B981',
                    bgColor: '#D1FAE5',
                    icon: 'check-circle',
                    label: 'Completed',
                };
            case 'pending':
                return {
                    color: '#F59E0B',
                    bgColor: '#FEF3C7',
                    icon: 'clock-outline',
                    label: 'Pending',
                };
            case 'failed':
                return {
                    color: '#EF4444',
                    bgColor: '#FEE2E2',
                    icon: 'close-circle',
                    label: 'Failed',
                };
            default:
                return {
                    color: '#6B7280',
                    bgColor: '#F3F4F6',
                    icon: 'help-circle',
                    label: status,
                };
        }
    };

    // Get filter counts
    const getFilterCounts = () => {
        return {
            all: transactions.length,
            success: transactions.filter(t => t.status === 'success').length,
            pending: transactions.filter(t => t.status === 'pending').length,
            failed: transactions.filter(t => t.status === 'failed').length,
        };
    };

    const filterCounts = getFilterCounts();

    // Compact Transaction Card Component
    const TransactionCard = ({ transaction }) => {
        const statusConfig = getStatusConfig(transaction.status);
        const isPaid = transaction.status.toLowerCase() === 'success';
        const isFailed = transaction.status.toLowerCase() === 'failed';

        return (
            <Pressable>
                <Surface style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline, overflow: "hidden" }]} elevation={0}>
                    <View style={styles.cardContent}>
                        {/* Left Section: Status Icon & Details */}
                        <View style={styles.leftSection}>
                            <View
                                style={[
                                    styles.iconContainer,
                                    { backgroundColor: statusConfig.bgColor }
                                ]}
                            >
                                <Icon
                                    source={statusConfig.icon}
                                    color={statusConfig.color}
                                    size={28}
                                    style={styles.statusIcon}
                                />
                            </View>

                            <View style={styles.detailsSection}>
                                <Text variant="bodyLarge" style={styles.paymentMethod}>
                                    {transaction?.subscription?.planName ||transaction.method}
                                </Text>
                                <Text variant="bodySmall" style={styles.transactionId}>
                                    #{formatTransactionId(transaction.transactionId)}
                                </Text>
                                <Text variant="bodySmall" style={styles.dateText}>
                                    {formatTransactionDate(isPaid ? transaction.paidAt : transaction.createdAt)}
                                </Text>
                            </View>
                        </View>

                        {/* Right Section: Amount & Status */}
                        <View style={styles.rightSection}>
                            <Text variant="titleMedium" style={styles.amount}>
                                ₹{transaction.amount}
                            </Text>
                            <Chip
                                compact
                                style={[
                                    styles.statusChip,
                                    { backgroundColor: statusConfig.bgColor }
                                ]}
                                textStyle={{
                                    color: statusConfig.color,
                                    fontWeight: '600',
                                    fontSize: 11
                                }}
                            >
                                {statusConfig.label}
                            </Chip>
                        </View>
                    </View>

                    {/* Failed Reason */}
                    {isFailed && transaction.notes && (
                        <>
                            <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
                            <View style={styles.failedNote}>
                                <Icon
                                    source="alert-circle-outline"
                                    size={18}
                                    color={statusConfig.color}
                                    style={styles.alertIcon}
                                />
                                <Text variant="bodySmall" style={[styles.noteText, { color: statusConfig.color }]}>
                                    {transaction.notes}
                                </Text>
                            </View>
                        </>
                    )}
                </Surface>
            </Pressable>
        );
    };

    // Loading State
    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <Navbar title="Transactions" />
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text variant="bodyLarge" style={styles.loadingText}>
                        Loading transactions...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // Empty State
    if (!loading && transactions.length === 0) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <Navbar title="Transactions" />
                <View style={styles.centerContainer}>
                    <IconButton
                        icon="receipt-text-outline"
                        size={64}
                        iconColor={theme.colors.surfaceDisabled}
                    />
                    <Text variant="headlineSmall" style={styles.emptyTitle}>
                        No Transactions
                    </Text>
                    <Text variant="bodyMedium" style={styles.emptySubtitle}>
                        Your payment history will appear here
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // Main View
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Navbar title="Transactions" />

            {/* Filter Section */}
            <View style={styles.filterContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterScrollContent}
                >
                    <Chip
                        compact
                        selected={statusFilter === 'all'}
                        onPress={() => setStatusFilter('all')}
                        selectedColor='#FFFFFF'
                        style={[
                            styles.filterChip,
                            { backgroundColor: statusFilter === 'all' ? '#3B82F6' : theme.colors.surface }
                        ]}
                        textStyle={[
                            styles.filterChipText,
                            { color: statusFilter === 'all' ? '#FFFFFF' : '#6B7280' }
                        ]}
                    >
                        All ({filterCounts.all})
                    </Chip>

                    <Chip
                        compact
                        selected={statusFilter === 'success'}
                        onPress={() => setStatusFilter('success')}
                        selectedColor='#10B981'
                        style={[
                            styles.filterChip,
                            { backgroundColor: statusFilter === 'success' ? '#D1FAE5' : theme.colors.surface }
                        ]}
                        textStyle={[
                            styles.filterChipText,
                            { color: statusFilter === 'success' ? '#10B981' : '#6B7280' }
                        ]}
                    >
                        Completed ({filterCounts.success})
                    </Chip>

                    <Chip
                        compact
                        selected={statusFilter === 'pending'}
                        onPress={() => setStatusFilter('pending')}
                        selectedColor='#F59E0B'
                        style={[
                            styles.filterChip,
                            { backgroundColor: statusFilter === 'pending' ? '#FEF3C7' : theme.colors.surface }
                        ]}
                        textStyle={[
                            styles.filterChipText,
                            { color: statusFilter === 'pending' ? '#F59E0B' : '#6B7280' }]}
                    >
                        Pending ({filterCounts.pending})
                    </Chip>

                    <Chip
                        compact
                        selected={statusFilter === 'failed'}
                        onPress={() => setStatusFilter('failed')}
                        selectedColor='#EF4444'
                        style={[
                            styles.filterChip,
                            { backgroundColor: statusFilter === 'failed' ? '#FEE2E2' : theme.colors.surface }
                        ]}
                        textStyle={[
                            styles.filterChipText,
                            { color: statusFilter === 'failed' ? '#EF4444' : '#6B7280' }]}
                    >
                        Failed ({filterCounts.failed})
                    </Chip>
                </ScrollView>
            </View>

            {/* Transactions List */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.contentContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[theme.colors.primary]}
                    />
                }
            >
                {filteredTransactions.length === 0 ? (
                    <View style={styles.emptyFilterContainer}>
                        <IconButton
                            icon="filter-remove-outline"
                            size={48}
                            iconColor={theme.colors.surfaceDisabled}
                        />
                        <Text variant="titleMedium" style={styles.emptyFilterTitle}>
                            No {statusFilter} transactions
                        </Text>
                        <Text variant="bodyMedium" style={styles.emptyFilterSubtitle}>
                            Try adjusting your filters
                        </Text>
                    </View>
                ) : (
                    filteredTransactions.map((transaction) => (
                        <TransactionCard
                            key={transaction._id}
                            transaction={transaction}
                        />
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingTop: 8,
        paddingBottom: 32,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 16,
    },
    emptyTitle: {
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        textAlign: 'center',
    },

    // Filter Section
    filterContainer: {
        paddingVertical: 8,
    },
    filterScrollContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    filterChip: {
        height: 32,
        borderRadius: 20,
    },
    filterChipActive: {
        backgroundColor: '#3B82F6',
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '500',
    },
    filterChipTextActive: {
        fontWeight: '600',
    },

    // Transaction Card
    card: {
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,

    },
    cardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusIcon: {
        margin: 0,
    },
    detailsSection: {
        flex: 1,
        gap: 2,
    },
    paymentMethod: {
        fontWeight: '600',
        fontSize: 15,
    },
    transactionId: {
        fontSize: 12,
        fontFamily: 'monospace',
        letterSpacing: 0.3,
    },
    dateText: {
        fontSize: 12,
        marginTop: 2,
    },
    rightSection: {
        alignItems: 'flex-end',
        gap: 6,
    },
    amount: {
        fontWeight: '700',
        fontSize: 16,
        letterSpacing: -0.3,
    },
    statusChip: {
        height: 32,
        paddingHorizontal: 0,
    },

    // Failed Note Section
    divider: {
        height: 1,
    },
    failedNote: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: '#FEF2F2',
        overflow: 'hidden',
        gap: 6,
    },
    alertIcon: {
        margin: 0,
        marginRight: 4,
    },
    noteText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 16,
    },

    // Empty Filter State
    emptyFilterContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyFilterTitle: {
        fontWeight: '600',
        marginTop: 12,
    },
    emptyFilterSubtitle: {
        marginTop: 4,
    },
});

export default PlanTransactions;
