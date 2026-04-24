// import React, { useState, useMemo, useEffect } from 'react';
// import {
//   View,
//   StyleSheet,
//   FlatList,
//   Alert,
//   Platform,
//   PermissionsAndroid,
//   useWindowDimensions,
// } from 'react-native';
// import {
//   Text,
//   Button,
//   useTheme,
//   ActivityIndicator,
//   Card,
//   Portal,
//   Dialog,
//   IconButton,
// } from 'react-native-paper';
// import DateTimePickerModal from 'react-native-modal-datetime-picker';
// import RNHTMLtoPDF from 'react-native-html-to-pdf';
// import RNFS from 'react-native-fs';
// import XLSX from 'xlsx';
// import api from '../../utils/api';
// import { ensureStoragePermission } from '../../utils/permissions';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import Navbar from '../../components/Navbar';
// import FileViewer from 'react-native-file-viewer';
// import { useAuth } from '../../context/AuthContext';
// import { useRoute } from '@react-navigation/native';

// const StockReport = () => {
//   const theme = useTheme();
//   const { width } = useWindowDimensions();
//   const compact = width < 380;

//   const [records, setRecords] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [startDate, setStartDate] = useState(null);
//   const [endDate, setEndDate] = useState(null);
//   const [pickerMode, setPickerMode] = useState(null);
//   const [dialogVisible, setDialogVisible] = useState(false);
//   const [lastSavedPath, setLastSavedPath] = useState(null);

//   const { authState } = useAuth();
//   const store = authState?.user?.store || authState?.store || null;
//   const route = useRoute();
//   const dashboardFlag = route?.params?.dashboardFlag || false;
//   const dashboardWeeklyFlag = route?.params?.dashboardWeeklyFlag || false;
//   const dashboardMonthlyFlag = route?.params?.dashboardMonthlyFlag || false;
//   const dashboardTodayFlag = route?.params?.dashboardTodayFlag || false;

//   const storeName = store?.name || store?.storeName || 'N/A';
//   const address = (() => {
//     if (!store?.address) return 'N/A';
//     if (typeof store.address === 'object') {
//       const a = store.address;
//       return [a.street, a.city, a.state, a.postalCode]
//         .filter(Boolean)
//         .join(', ');
//     }
//     return String(store.address);
//   })();
//   const contactNo = store?.contactNo || store?.contactNumber || 'N/A';
//   const gstin = store?.gstNumber || store?.gstin || 'N/A';

//   const formatDate = date => {
//     if (!date) return 'All';
//     const day = String(date.getDate()).padStart(2, '0');
//     const month = String(date.getMonth() + 1).padStart(2, '0');
//     const year = String(date.getFullYear()).slice(-2);
//     return `${day}/${month}/${year}`;
//   };

//   const formattedRange = useMemo(() => {
//     const s = startDate ? formatDate(startDate) : 'All';
//     const e = endDate ? formatDate(endDate) : 'All';
//     return `${s} - ${e}`;
//   }, [startDate, endDate]);

//   const getRecordDate = record => {
//     const dateKeys = ['stockDate', 'date', 'createdAt', 'updatedAt'];
//     const raw = dateKeys.reduce((found, key) => found || record?.[key], null);
//     return raw ? new Date(raw) : null;
//   };

//   const fetchRecords = async () => {
//     try {
//       setLoading(true);
//       const res = await api.get('/invoice/stock-report');
//       let rows = res?.data || [];
//       if (startDate && endDate) {
//         const sDate = new Date(startDate);
//         sDate.setHours(0, 0, 0, 0);
//         const eDate = new Date(endDate);
//         eDate.setHours(23, 59, 59, 999);
//         rows = rows.filter(record => {
//           const recordDate = getRecordDate(record);
//           return recordDate ? recordDate >= sDate && recordDate <= eDate : true;
//         });
//       }
//       setRecords(rows);
//     } catch (e) {
//       console.error('Stock report fetch error:', e?.message);
//       Alert.alert('Error', 'Failed to fetch stock report data.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (startDate && endDate) {
//       fetchRecords();
//     }
//   }, [startDate, endDate]);

//   useEffect(() => {
//     const today = new Date();
//     if (dashboardFlag) {
//       const currentYear = today.getFullYear();
//       const currentMonth = today.getMonth() + 1;
//       const fyStart =
//         currentMonth >= 4
//           ? new Date(currentYear, 3, 1)
//           : new Date(currentYear - 1, 3, 1);
//       setStartDate(fyStart);
//       setEndDate(today);
//     } else if (dashboardWeeklyFlag) {
//       const weekStart = new Date(today);
//       const dayOfWeek = weekStart.getDay();
//       weekStart.setDate(weekStart.getDate() - dayOfWeek);
//       setStartDate(weekStart);
//       setEndDate(today);
//     } else if (dashboardMonthlyFlag) {
//       const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
//       setStartDate(monthStart);
//       setEndDate(today);
//     } else if (dashboardTodayFlag) {
//       setStartDate(today);
//       setEndDate(today);
//     }
//   }, [
//     dashboardFlag,
//     dashboardWeeklyFlag,
//     dashboardMonthlyFlag,
//     dashboardTodayFlag,
//   ]);

//   const applyThisYear = () => {
//     const today = new Date();
//     const currentYear = today.getFullYear();
//     const currentMonth = today.getMonth() + 1;
//     const fyStart =
//       currentMonth >= 4
//         ? new Date(currentYear, 3, 1)
//         : new Date(currentYear - 1, 3, 1);
//     setStartDate(fyStart);
//     setEndDate(today);
//   };

//   const applyThisMonth = () => {
//     const today = new Date();
//     const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
//     setStartDate(monthStart);
//     setEndDate(today);
//   };

//   const applyPreviousMonth = () => {
//     const today = new Date();
//     const prevMonthStart = new Date(
//       today.getFullYear(),
//       today.getMonth() - 1,
//       1,
//     );
//     const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
//     setStartDate(prevMonthStart);
//     setEndDate(prevMonthEnd);
//   };

//   const totals = useMemo(() => {
//     const toNum = value => Number(value || 0);
//     return {
//       count: records.length,
//       itemValue: records.reduce(
//         (sum, rec) => sum + toNum(rec.itemValue || rec.value || rec.stockValue),
//         0,
//       ),
//       quantity: records.reduce(
//         (sum, rec) => sum + toNum(rec.quantity || rec.qty || rec.stockQuantity),
//         0,
//       ),
//     };
//   }, [records]);

//   const ensureAndroidDownloadPermission = async () => {
//     if (Platform.OS !== 'android') return true;
//     if (Platform.Version < 29) {
//       const granted = await PermissionsAndroid.request(
//         PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
//         {
//           title: 'Storage Permission',
//           message: 'Allow saving reports to Downloads folder',
//           buttonPositive: 'OK',
//         },
//       );
//       return granted === PermissionsAndroid.RESULTS.GRANTED;
//     }
//     return true;
//   };

//   const currency = value => `₹${Number(value || 0).toFixed(2)}`;
//   const safe = value =>
//     value === undefined || value === null || value === '' ? '-' : String(value);

//   const buildHTML = () => {
//     const sorted = [...records];
//     const bodyRows = sorted
//       .map((record, index) => {
//         const date = getRecordDate(record)
//           ? new Date(getRecordDate(record)).toLocaleDateString()
//           : '-';
//         return `
//           <tr>
//             <td>${index + 1}</td>
//             <td>${safe(
//               record.itemDescription || record.description || record.name,
//             )}</td>
//             <td align="right">${currency(
//               record.itemValue || record.value || record.stockValue,
//             )}</td>
//             <td align="right">${safe(
//               record.quantity || record.qty || record.stockQuantity,
//             )}</td>
//           </tr>`;
//       })
//       .join('');

//     return `
//       <html>
//       <head>
//         <meta charset="utf-8" />
//         <style>
//           body { font-family: -apple-system, Roboto, Segoe UI, Arial; margin: 0; padding: 16px; color: #111; }
//           h1 { font-size: 20px; margin-bottom: 4px; }
//           .muted { color: #666; margin-bottom: 16px; }
//           .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
//           .chip { border-radius: 16px; padding: 6px 12px; background: #f2f2f2; font-size: 12px; color: #333; border: 1px solid #ddd; }
//           table { border-collapse: collapse; width: 100%; page-break-inside: auto; }
//           tr { page-break-inside: avoid; page-break-after: auto; }
//           th, td { border-bottom: 1px solid #eee; padding: 8px 6px; font-size: 11px; word-wrap: break-word; }
//           th { background: #fafafa; font-weight: 700; }
//           th:nth-child(3), td:nth-child(3), th:nth-child(4), td:nth-child(4) { text-align: right; }
//           .footer { margin-top: 14px; color: #666; font-size: 10px; }
//         </style>
//       </head>
//       <body>
//         <h1>Stock Report</h1>
//         <div class="muted">Period From : ${formattedRange}</div>
//         <div class="summary">
//           <div class="chip">Records: ${totals.count}</div>
//           <div class="chip">Total Value: ${currency(totals.itemValue)}</div>
//           <div class="chip">Total Qty: ${totals.quantity}</div>
//         </div>
//         <table>
//           <thead>
//             <tr>
//               <th align="left">SL NO</th>
//               <th align="left">Item Description</th>
//               <th align="right">Item Value</th>
//               <th align="right">Quantity</th>
//             </tr>
//           </thead>
//           <tbody>${
//             bodyRows ||
//             `<tr><td colspan="4" align="center">No records</td></tr>`
//           }</tbody>
//         </table>
//         <div class="footer">Powered by AMDAANI | ${new Date().toLocaleString()}</div>
//       </body>
//       </html>`;
//   };

//   const exportPDF = async () => {
//     if (!records.length) {
//       Alert.alert('No Data', 'Generate a report first.');
//       return;
//     }
//     try {
//       const storageOk = await ensureStoragePermission();
//       const downloadsOk = await ensureAndroidDownloadPermission();
//       if (!storageOk || !downloadsOk) return;

//       const html = buildHTML();
//       const pdfOptions = {
//         html,
//         fileName: `Stock_Report_${Date.now()}`,
//         base64: false,
//         orientation: 'landscape',
//       };
//       const pdfRes = await RNHTMLtoPDF.convert(pdfOptions);
//       const downloadsDir =
//         Platform.OS === 'android'
//           ? RNFS.DownloadDirectoryPath
//           : RNFS.DocumentDirectoryPath;
//       const suggested = `Stock_Report_${new Date()
//         .toISOString()
//         .slice(0, 10)}.pdf`;
//       let finalPath = `${downloadsDir}/${suggested}`;
//       if (await RNFS.exists(finalPath)) {
//         finalPath = `${downloadsDir}/Stock_Report_${new Date()
//           .toISOString()
//           .replace(/[:.]/g, '-')}.pdf`;
//       }
//       await RNFS.copyFile(pdfRes.filePath, finalPath);
//       try {
//         await FileViewer.open(finalPath, { showOpenWithDialog: true });
//       } catch (openErr) {
//         console.warn('No PDF viewer available:', openErr?.message);
//         Alert.alert(
//           'PDF Saved',
//           'File saved to Downloads, but no PDF viewer is available.',
//         );
//       }
//       setLastSavedPath(finalPath);
//       setDialogVisible(true);
//     } catch (e) {
//       console.error('PDF export error:', e?.message);
//       Alert.alert('Export Failed', 'Could not generate PDF. Please try again.');
//     }
//   };

//   const exportExcel = async () => {
//     if (!records.length) {
//       Alert.alert('No Data', 'No records to export.');
//       return;
//     }
//     const storageOk = await ensureStoragePermission();
//     const downloadsOk = await ensureAndroidDownloadPermission();
//     if (!storageOk || !downloadsOk) return;

//     try {
//       const data = records.map((record, index) => ({
//         'SL NO': index + 1,
//         'Item Description':
//           record.itemDescription || record.description || record.name || '-',
//         'Item Value': Number(
//           record.itemValue || record.value || record.stockValue || 0,
//         ),
//         Quantity: Number(
//           record.quantity || record.qty || record.stockQuantity || 0,
//         ),
//       }));

//       const ws = XLSX.utils.json_to_sheet(data);
//       ws['!cols'] = Object.keys(data[0]).map(key => ({
//         wch: Math.max(12, key.length + 2),
//       }));
//       const wb = XLSX.utils.book_new();
//       XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');
//       const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
//       const downloadsDir =
//         Platform.OS === 'android'
//           ? RNFS.DownloadDirectoryPath
//           : RNFS.DocumentDirectoryPath;
//       const baseName = `Stock_Report_${new Date().toISOString().slice(0, 10)}`;
//       let finalPath = `${downloadsDir}/${baseName}.xlsx`;
//       if (await RNFS.exists(finalPath)) {
//         finalPath = `${downloadsDir}/${baseName}_${Date.now()}.xlsx`;
//       }
//       await RNFS.writeFile(finalPath, wbout, 'base64');
//       try {
//         await FileViewer.open(finalPath, { showOpenWithDialog: true });
//       } catch (openErr) {
//         console.warn('No Excel viewer available:', openErr?.message);
//         Alert.alert(
//           'Excel Saved',
//           'File saved to Downloads, but no Excel viewer is available.',
//         );
//       }
//       setLastSavedPath(finalPath);
//       setDialogVisible(true);
//     } catch (e) {
//       console.error('Excel export error:', e?.message);
//       Alert.alert(
//         'Export Failed',
//         'Could not generate Excel file. Please try again.',
//       );
//     }
//   };

//   const renderItem = ({ item, index }) => {
//     const date = getRecordDate(item)
//       ? new Date(getRecordDate(item)).toLocaleDateString()
//       : '-';
//     return (
//       <Card mode="elevated" style={styles.card}>
//         <Card.Content style={styles.rowBetween}>
//           <View style={{ flex: 1 }}>
//             <Text variant="titleMedium">
//               {index + 1}.{' '}
//               {safe(item.itemDescription || item.description || item.name)}
//             </Text>
//             <Text variant="bodySmall" style={styles.muted}>
//               Date: {date}
//             </Text>
//           </View>
//           <View style={{ alignItems: 'flex-end' }}>
//             <Text variant="titleMedium">
//               {currency(item.itemValue || item.value || item.stockValue)}
//             </Text>
//             <Text variant="bodySmall" style={styles.muted}>
//               Qty: {safe(item.quantity || item.qty || item.stockQuantity)}
//             </Text>
//           </View>
//         </Card.Content>
//       </Card>
//     );
//   };

//   return (
//     <SafeAreaView
//       style={[styles.container, { backgroundColor: theme.colors.background }]}
//     >
//       <Navbar
//         showBackButton
//         title="Stock Report"
//         rightComponent={
//           <>
//             <IconButton
//               icon="file-pdf-box"
//               iconColor="red"
//               onPress={exportPDF}
//               disabled={!records.length || loading}
//               accessibilityLabel="Export PDF"
//             />
//             <IconButton
//               icon="file-excel"
//               iconColor="green"
//               onPress={exportExcel}
//               disabled={!records.length || loading}
//               accessibilityLabel="Export Excel"
//             />
//           </>
//         }
//       />

//       <View style={[styles.header, compact && { paddingHorizontal: 12 }]}>
//         <View style={[styles.row, compact && { gap: 6 }]}>
//           <Button
//             mode="outlined"
//             onPress={() => setPickerMode('start')}
//             style={[styles.dateBtn, compact && { paddingHorizontal: 0 }]}
//             icon="calendar-start"
//             contentStyle={{ flexDirection: 'row-reverse' }}
//           >
//             {startDate ? formatDate(startDate) : 'Start Date'}
//           </Button>
//           <Button
//             mode="outlined"
//             onPress={() => setPickerMode('end')}
//             style={[styles.dateBtn, compact && { paddingHorizontal: 0 }]}
//             icon="calendar-end"
//             contentStyle={{ flexDirection: 'row-reverse' }}
//           >
//             {endDate ? formatDate(endDate) : 'End Date'}
//           </Button>
//           <IconButton
//             icon="calendar-remove"
//             mode="contained-tonal"
//             size={20}
//             onPress={() => {
//               setStartDate(null);
//               setEndDate(null);
//             }}
//             style={styles.iconBtn}
//             disabled={loading || (!startDate && !endDate)}
//             accessibilityLabel="Clear date range"
//           />
//         </View>

//         <View style={[styles.row, compact && { gap: 4 }]}>
//           <Button
//             mode="outlined"
//             compact
//             onPress={applyThisYear}
//             style={{ flex: 1 }}
//             labelStyle={{ fontSize: 11 }}
//           >
//             This Year
//           </Button>
//           <Button
//             mode="outlined"
//             compact
//             onPress={applyThisMonth}
//             style={{ flex: 1 }}
//             labelStyle={{ fontSize: 11 }}
//           >
//             This Month
//           </Button>
//           <Button
//             mode="outlined"
//             compact
//             onPress={applyPreviousMonth}
//             style={{ flex: 1 }}
//             labelStyle={{ fontSize: 11 }}
//           >
//             Prev Month
//           </Button>
//         </View>

//         <View style={[styles.row, compact && { gap: 6 }]}>
//           <Button
//             mode="contained"
//             onPress={fetchRecords}
//             disabled={!startDate || !endDate}
//             style={{ flex: 1 }}
//             labelStyle={{
//               color:
//                 !startDate || !endDate
//                   ? theme.colors.onBackground
//                   : theme.colors.onSurface,
//             }}
//             icon={loading ? 'progress-clock' : 'refresh'}
//           >
//             {loading ? 'Loading...' : 'Generate'}
//           </Button>
//         </View>
//       </View>

//       {loading ? (
//         <View style={styles.center}>
//           <ActivityIndicator />
//           <Text style={styles.mt8}>Loading...</Text>
//         </View>
//       ) : records.length === 0 ? (
//         <View style={styles.center}>
//           <Text style={styles.muted}>
//             No records. Select a date range and Generate.
//           </Text>
//         </View>
//       ) : (
//         <>
//           <View style={[styles.summaryWrap]}>
//             <Card mode="elevated" style={styles.summaryCard}>
//               <Card.Content style={styles.summaryContent}>
//                 <View style={styles.summaryHeader}>
//                   <Text variant="labelSmall" style={styles.summaryLabel}>
//                     Range
//                   </Text>
//                   <Text
//                     variant="titleSmall"
//                     numberOfLines={1}
//                     style={styles.summaryValue}
//                   >
//                     {' '}
//                     {formattedRange}{' '}
//                   </Text>
//                 </View>
//                 <View
//                   style={[styles.hr, { backgroundColor: theme.colors.outline }]}
//                 />
//                 <View style={styles.summaryRow}>
//                   <View style={styles.summaryCol}>
//                     <Text variant="labelSmall" style={styles.summaryLabel}>
//                       Count
//                     </Text>
//                     <Text variant="titleMedium" style={styles.summaryValue}>
//                       {totals.count}
//                     </Text>
//                   </View>
//                   <View
//                     style={[
//                       styles.vDivider,
//                       { backgroundColor: theme.colors.outline },
//                     ]}
//                   />
//                   <View style={styles.summaryCol}>
//                     <Text variant="labelSmall" style={styles.summaryLabel}>
//                       Total Value
//                     </Text>
//                     <Text variant="titleMedium" style={styles.summaryValue}>
//                       {currency(totals.itemValue)}
//                     </Text>
//                   </View>
//                   <View
//                     style={[
//                       styles.vDivider,
//                       { backgroundColor: theme.colors.outline },
//                     ]}
//                   />
//                   <View style={styles.summaryCol}>
//                     <Text variant="labelSmall" style={styles.summaryLabel}>
//                       Total Qty
//                     </Text>
//                     <Text variant="titleMedium" style={styles.summaryValue}>
//                       {totals.quantity}
//                     </Text>
//                   </View>
//                 </View>
//               </Card.Content>
//             </Card>
//           </View>
//           <FlatList
//             data={records}
//             keyExtractor={(item, idx) => String(item._id || item.id || idx)}
//             renderItem={renderItem}
//             contentContainerStyle={styles.list}
//           />
//         </>
//       )}

//       <DateTimePickerModal
//         isVisible={!!pickerMode}
//         mode="date"
//         maximumDate={new Date()}
//         onConfirm={date => {
//           if (pickerMode === 'start') setStartDate(date);
//           if (pickerMode === 'end') setEndDate(date);
//           setPickerMode(null);
//         }}
//         onCancel={() => setPickerMode(null)}
//       />

//       <Portal>
//         <Dialog
//           visible={dialogVisible}
//           onDismiss={() => setDialogVisible(false)}
//         >
//           <Dialog.Title>Saved</Dialog.Title>
//           <Dialog.Content>
//             <Text>File saved to Downloads.</Text>
//             {lastSavedPath ? <Text selectable>{lastSavedPath}</Text> : null}
//           </Dialog.Content>
//           <Dialog.Actions>
//             <Button onPress={() => setDialogVisible(false)}>OK</Button>
//           </Dialog.Actions>
//         </Dialog>
//       </Portal>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   container: { flex: 1 },
//   header: { paddingHorizontal: 16, gap: 12 },
//   row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
//   dateBtn: { flex: 1 },
//   iconBtn: { margin: 0 },
//   center: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     padding: 24,
//   },
//   summaryWrap: { paddingHorizontal: 10, paddingVertical: 6 },
//   summaryCard: { borderRadius: 10 },
//   summaryContent: { paddingVertical: 6 },
//   summaryHeader: { marginBottom: 4 },
//   summaryLabel: { fontSize: 11 },
//   summaryValue: { fontWeight: '600' },
//   hr: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
//   summaryRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//   },
//   summaryCol: { flex: 1, alignItems: 'center' },
//   vDivider: {
//     width: StyleSheet.hairlineWidth,
//     height: '100%',
//     marginHorizontal: 8,
//   },
//   list: { padding: 12 },
//   card: { marginBottom: 10, borderRadius: 12 },
//   rowBetween: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//   },
//   muted: { color: '#6b7280' },
//   mt8: { marginTop: 8 },
// });

// export default StockReport;
