// import React, { useState, useEffect, useMemo, useRef } from 'react';
// import {
//   View,
//   FlatList,
//   StyleSheet,
//   RefreshControl,
//   Alert,
// } from 'react-native';
// import {
//   Text,
//   Card,
//   FAB,
//   ActivityIndicator,
//   Avatar,
//   IconButton,
//   Searchbar,
//   useTheme,
//   Button,
//   Snackbar,
//   Chip,
// } from 'react-native-paper';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import api from '../../utils/api';
// import Navbar from '../../components/Navbar';
// import AddExpenseHeadBottomSheet from '../../components/BottomSheet/AddExpenseHeadBottomSheet';
// import Toast from 'react-native-toast-message';
// import CustomAlert from '../../components/CustomAlert';

// const ExpenseHead = () => {
//   const theme = useTheme();
//   const [expenseHeads, setExpenseHeads] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [snackbarVisible, setSnackbarVisible] = useState(false);
//   const [snackbarMessage, setSnackbarMessage] = useState('');
//   const [searchQuery, setSearchQuery] = useState('');

//   const ExpenseHeadSheetRef = useRef(null);
//   const [editData, setEditData] = useState(null);

//   const handleEdit = item => {
//     setEditData(item);
//     ExpenseHeadSheetRef.current?.expand();
//   };

//   // Fetch expense heads
//   const fetchExpenseHeads = async () => {
//     try {
//       const response = await api.get('/expense-head');
//       // console.log('Expense heads fetched:', response);

//       if (response.success) {
//         const heads = Array.isArray(response.data) ? response.data : [];
//         const validatedHeads = heads.map(head => ({
//           _id: head?._id || `temp-${Date.now()}-${Math.random()}`,
//           name: head?.name || 'Unnamed Expense Head',
//           isActive: head?.isActive ?? true,
//           createdAt: head?.createdAt || new Date().toISOString(),
//           ...head,
//         }));
//         setExpenseHeads(validatedHeads);
//       } else {
//         setExpenseHeads([]);
//       }
//     } catch (err) {
//       console.error('Error fetching expense heads:', err);
//       setExpenseHeads([]);
//     } finally {
//       setLoading(false);
//       setRefreshing(false);
//     }
//   };

//   useEffect(() => {
//     fetchExpenseHeads();
//   }, []);

//   const handleAddExpenseHead = () => {
//     setEditData(null);
//     ExpenseHeadSheetRef.current?.expand();
//   };

//   const onRefresh = async () => {
//     setRefreshing(true);
//     await fetchExpenseHeads();
//   };

//   const handleDelete = (id, name) => {
//     Alert.alert(
//       'Delete Expense Head',
//       `Are you sure you want to delete "${name}"? This action cannot be undone.`,
//       [
//         {
//           text: 'Cancel',
//           style: 'cancel',
//         },
//         {
//           text: 'Delete',
//           style: 'destructive',
//           onPress: () => deleteExpenseHead(id),
//         },
//       ],
//     );
//   };

//   const deleteExpenseHead = async id => {
//     try {
//       const response = await api.delete(`/expense-head/id/${id}`);
//       if (response.success) {
//         setExpenseHeads(prev => prev.filter(head => head._id !== id));
//         showSnackbar('Expense head deleted successfully');
//       } else {
//         showSnackbar('Failed to delete expense head');
//       }
//     } catch (err) {
//       console.error('Error deleting expense head:', err);
//       showSnackbar('Error deleting expense head');
//     }
//   };

//   const showSnackbar = message => {
//     setSnackbarMessage(message);
//     setSnackbarVisible(true);
//   };

//   const filteredHeads = useMemo(() => {
//     return expenseHeads.filter(head =>
//       head.name.toLowerCase().includes(searchQuery.toLowerCase()),
//     );
//   }, [expenseHeads, searchQuery]);

//   const stats = useMemo(() => {
//     const total = expenseHeads.length;
//     const active = expenseHeads.filter(head => head.isActive).length;
//     const inactive = total - active;
//     return { total, active, inactive };
//   }, [expenseHeads]);

//   const getStatusColor = isActive => {
//     return isActive ? theme.colors.primary : theme.colors.error;
//   };

//   const getStatusText = isActive => {
//     return isActive ? 'Active' : 'Inactive';
//   };

//   const formatDate = dateString => {
//     return dateString
//       ? new Date(dateString).toLocaleDateString('en-US', {
//           year: 'numeric',
//           month: 'short',
//           day: 'numeric',
//         })
//       : 'N/A';
//   };

//   const styles = createStyles(theme);

//   if (loading) {
//     return (
//       <SafeAreaView style={styles.container}>
//         <Navbar />
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color={theme.colors.primary} />
//           <Text variant="bodyMedium" style={styles.loadingText}>
//             Loading expense heads...
//           </Text>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   const EmptyState = () => (
//     <View style={styles.emptyState}>
//       <Avatar.Icon
//         size={80}
//         icon="format-list-bulleted"
//         style={[
//           styles.emptyIcon,
//           { backgroundColor: theme.colors.surfaceVariant },
//         ]}
//         color={theme.colors.onSurfaceVariant}
//       />
//       <Text variant="titleMedium" style={styles.emptyTitle}>
//         No Expense Heads Found
//       </Text>
//       <Text variant="bodyMedium" style={styles.emptySubtitle}>
//         {searchQuery
//           ? 'Try adjusting your search terms'
//           : 'Get started by creating your first expense head'}
//       </Text>
//       {!searchQuery && (
//         <Button
//           mode="contained"
//           icon="plus"
//           onPress={handleAddExpenseHead}
//           style={styles.emptyButton}
//         >
//           Create Expense Head
//         </Button>
//       )}
//     </View>
//   );

//   return (
//     <SafeAreaView style={styles.container}>
//       <Navbar />

//       {/* Header Section */}
//       <View style={styles.header}>
//         <View style={styles.headerContent}>
//           <Text variant="headlineSmall" style={styles.headerTitle}>
//             Expense Heads
//           </Text>
//           <Text variant="bodyMedium" style={styles.headerSubtitle}>
//             Manage your expense categories and organization
//           </Text>
//         </View>

//         <Button
//           mode="contained"
//           icon="plus"
//           onPress={handleAddExpenseHead}
//           style={styles.addButton}
//           contentStyle={styles.addButtonContent}
//         >
//           Add New
//         </Button>
//       </View>

//       {/* Stats Cards */}
//       <View style={styles.statsContainer}>
//         <Card mode="contained" style={styles.statCard}>
//           <Card.Content style={styles.statContent}>
//             <Text
//               variant="titleLarge"
//               style={[styles.statNumber, { color: theme.colors.primary }]}
//             >
//               {stats.total}
//             </Text>
//             <Text variant="bodyMedium" style={styles.statLabel}>
//               Total
//             </Text>
//           </Card.Content>
//         </Card>

//         <Card mode="contained" style={styles.statCard}>
//           <Card.Content style={styles.statContent}>
//             <Text
//               variant="titleLarge"
//               style={[styles.statNumber, { color: theme.colors.primary }]}
//             >
//               {stats.active}
//             </Text>
//             <Text variant="bodyMedium" style={styles.statLabel}>
//               Active
//             </Text>
//           </Card.Content>
//         </Card>

//         <Card mode="contained" style={styles.statCard}>
//           <Card.Content style={styles.statContent}>
//             <Text
//               variant="titleLarge"
//               style={[styles.statNumber, { color: theme.colors.error }]}
//             >
//               {stats.inactive}
//             </Text>
//             <Text variant="bodyMedium" style={styles.statLabel}>
//               Inactive
//             </Text>
//           </Card.Content>
//         </Card>
//       </View>

//       {/* Search Section */}
//       <Searchbar
//         placeholder="Search expense heads..."
//         value={searchQuery}
//         onChangeText={setSearchQuery}
//         style={styles.search}
//         iconColor={theme.colors.primary}
//         inputStyle={styles.searchInput}
//       />

//       {/* Results Info */}
//       {filteredHeads.length > 0 && (
//         <View style={styles.resultsInfo}>
//           <Text variant="bodySmall" style={styles.resultsText}>
//             Showing {filteredHeads.length} of {expenseHeads.length} expense
//             heads
//           </Text>
//         </View>
//       )}

//       {/* Expense Heads List */}
//       <FlatList
//         data={filteredHeads}
//         keyExtractor={item => item._id}
//         refreshControl={
//           <RefreshControl
//             refreshing={refreshing}
//             onRefresh={onRefresh}
//             colors={[theme.colors.primary]}
//             tintColor={theme.colors.primary}
//           />
//         }
//         showsVerticalScrollIndicator={false}
//         contentContainerStyle={styles.listContent}
//         ListEmptyComponent={EmptyState}
//         renderItem={({ item }) => (
//           <Card mode="elevated" style={styles.expenseCard}>
//             <Card.Content style={styles.cardContent}>
//               <View style={styles.cardMain}>
//                 <View style={styles.avatarContainer}>
//                   <Avatar.Text
//                     size={44}
//                     label={item.name.charAt(0).toUpperCase()}
//                     style={[
//                       styles.avatar,
//                       {
//                         backgroundColor: item.isActive
//                           ? theme.colors.primaryContainer
//                           : theme.colors.errorContainer,
//                       },
//                     ]}
//                     color={
//                       item.isActive
//                         ? theme.colors.onPrimaryContainer
//                         : theme.colors.onErrorContainer
//                     }
//                   />
//                 </View>

//                 <View style={styles.detailsContainer}>
//                   <View style={styles.detailsHeader}>
//                     <View style={styles.titleRow}>
//                       <Text
//                         variant="titleMedium"
//                         numberOfLines={1}
//                         style={styles.headName}
//                       >
//                         {item.name}
//                       </Text>
//                       <View style={styles.chipContainer}>
//                         <Chip
//                           mode="flat"
//                           compact
//                           style={[
//                             styles.statusChip,
//                             {
//                               backgroundColor: getStatusColor(item.isActive),
//                             },
//                           ]}
//                         >
//                           <Text
//                             variant="labelSmall"
//                             style={[
//                               styles.chipText,
//                               { color: theme.colors.onPrimary },
//                             ]}
//                           >
//                             {getStatusText(item.isActive)}
//                           </Text>
//                         </Chip>
//                       </View>
//                     </View>
//                   </View>

//                   <Text variant="bodySmall" style={styles.createdDate}>
//                     Created {formatDate(item.createdAt)}
//                   </Text>
//                 </View>
//               </View>

//               {/* Action Buttons */}
//               <View style={styles.actionButtons}>
//                 <IconButton
//                   icon="pencil-outline"
//                   size={18}
//                   mode="contained"
//                   containerColor={theme.colors.surfaceVariant}
//                   iconColor={theme.colors.onSurfaceVariant}
//                   onPress={() => handleEdit(item)}
//                   style={styles.actionButton}
//                 />
//                 <IconButton
//                   icon="delete-outline"
//                   size={18}
//                   mode="contained"
//                   containerColor={`${theme.colors.error}15`}
//                   iconColor={theme.colors.error}
//                   onPress={() => handleDelete(item._id, item.name)}
//                   style={styles.actionButton}
//                 />
//               </View>
//             </Card.Content>
//           </Card>
//         )}
//       />

//       {/* Add Expense Head Bottom Sheet */}
//       <AddExpenseHeadBottomSheet
//         ref={ExpenseHeadSheetRef}
//         editData={editData}
//       />

//       {/* Snackbar for notifications */}
//       <Snackbar
//         visible={snackbarVisible}
//         onDismiss={() => setSnackbarVisible(false)}
//         duration={3000}
//         action={{
//           label: 'OK',
//           onPress: () => setSnackbarVisible(false),
//           textColor: theme.colors.onPrimary,
//         }}
//         style={styles.snackbar}
//       >
//         {snackbarMessage}
//       </Snackbar>
//     </SafeAreaView>
//   );
// };

// const createStyles = theme =>
//   StyleSheet.create({
//     container: {
//       flex: 1,
//       backgroundColor: theme.colors.background,
//     },
//     header: {
//       flexDirection: 'row',
//       justifyContent: 'space-between',
//       alignItems: 'flex-start',
//       paddingHorizontal: 20,
//       paddingTop: 16,
//       paddingBottom: 8,
//     },
//     headerContent: {
//       flex: 1,
//     },
//     headerTitle: {
//       fontWeight: '700',
//       color: theme.colors.onSurface,
//       marginBottom: 4,
//     },
//     headerSubtitle: {
//       color: theme.colors.onSurfaceVariant,
//       fontSize: 14,
//       lineHeight: 20,
//     },
//     addButton: {
//       borderRadius: 12,
//       marginLeft: 12,
//       elevation: 2,
//       shadowColor: theme.colors.primary,
//       shadowOffset: { width: 0, height: 2 },
//       shadowOpacity: 0.1,
//       shadowRadius: 4,
//     },
//     addButtonContent: {
//       paddingHorizontal: 8,
//     },
//     statsContainer: {
//       flexDirection: 'row',
//       paddingHorizontal: 20,
//       paddingVertical: 16,
//       gap: 12,
//     },
//     statCard: {
//       flex: 1,
//       borderRadius: 12,
//       elevation: 1,
//       shadowColor: '#000',
//       shadowOffset: { width: 0, height: 1 },
//       shadowOpacity: 0.05,
//       shadowRadius: 3,
//     },
//     statContent: {
//       alignItems: 'center',
//       paddingVertical: 16,
//     },
//     statNumber: {
//       fontWeight: '700',
//       marginBottom: 4,
//     },
//     statLabel: {
//       color: theme.colors.onSurfaceVariant,
//       fontSize: 12,
//       fontWeight: '500',
//     },
//     search: {
//       marginHorizontal: 20,
//       marginBottom: 8,
//       borderRadius: 12,
//       elevation: 0,
//       backgroundColor: theme.colors.surface,
//       height: 48,
//     },
//     searchInput: {
//       fontSize: 15,
//       minHeight: 48,
//     },
//     resultsInfo: {
//       paddingHorizontal: 20,
//       paddingVertical: 12,
//     },
//     resultsText: {
//       color: theme.colors.onSurfaceVariant,
//       fontSize: 13,
//     },
//     listContent: {
//       flexGrow: 1,
//       paddingHorizontal: 20,
//       paddingBottom: 20,
//     },
//     loadingContainer: {
//       flex: 1,
//       justifyContent: 'center',
//       alignItems: 'center',
//       gap: 12,
//     },
//     loadingText: {
//       color: theme.colors.onSurfaceVariant,
//     },
//     expenseCard: {
//       marginBottom: 10,
//       borderRadius: 12,
//       elevation: 1,
//       shadowColor: '#000',
//       shadowOffset: { width: 0, height: 1 },
//       shadowOpacity: 0.08,
//       shadowRadius: 3,
//       overflow: 'hidden',
//     },
//     cardContent: {
//       paddingVertical: 14,
//       paddingHorizontal: 16,
//       flexDirection: 'row',
//       justifyContent: 'space-between',
//       alignItems: 'center',
//     },
//     cardMain: {
//       flex: 1,
//       flexDirection: 'row',
//       alignItems: 'center',
//     },
//     avatarContainer: {
//       marginRight: 14,
//     },
//     avatar: {
//       // Avatar styles remain the same
//     },
//     detailsContainer: {
//       flex: 1,
//     },
//     detailsHeader: {
//       marginBottom: 2,
//     },
//     titleRow: {
//       flexDirection: 'row',
//       justifyContent: 'space-between',
//       alignItems: 'flex-start',
//       marginBottom: 4,
//     },
//     headName: {
//       fontWeight: '600',
//       flex: 1,
//       marginRight: 8,
//       fontSize: 15,
//       color: theme.colors.onSurface,
//       lineHeight: 20,
//       flexShrink: 1,
//     },
//     chipContainer: {
//       flexShrink: 0,
//     },
//     statusChip: {
//       height: 24,
//       minHeight: 24,
//       borderRadius: 6,
//       justifyContent: 'center',
//       alignItems: 'center',
//       alignSelf: 'flex-start',
//       paddingHorizontal: 8,
//     },
//     chipText: {
//       fontSize: 11,
//       fontWeight: '600',
//       lineHeight: 12,
//       includeFontPadding: false,
//       textAlignVertical: 'center',
//     },
//     createdDate: {
//       color: theme.colors.outline,
//       fontSize: 12,
//       marginTop: 2,
//     },
//     actionButtons: {
//       flexDirection: 'row',
//       gap: 4,
//       marginLeft: 8,
//     },
//     actionButton: {
//       margin: 0,
//       width: 32,
//       height: 32,
//     },
//     emptyState: {
//       alignItems: 'center',
//       justifyContent: 'center',
//       paddingVertical: 60,
//       paddingHorizontal: 40,
//     },
//     emptyIcon: {
//       marginBottom: 16,
//     },
//     emptyTitle: {
//       color: theme.colors.onSurface,
//       fontWeight: '600',
//       marginBottom: 8,
//       textAlign: 'center',
//     },
//     emptySubtitle: {
//       color: theme.colors.onSurfaceVariant,
//       textAlign: 'center',
//       lineHeight: 20,
//       marginBottom: 24,
//     },
//     emptyButton: {
//       borderRadius: 12,
//     },
//     snackbar: {
//       borderRadius: 12,
//       marginHorizontal: 20,
//       marginBottom: 20,
//     },
//   });

// export default ExpenseHead;
