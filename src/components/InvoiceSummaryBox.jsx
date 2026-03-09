// components/InvoiceSummaryBox.jsx
import React from "react";
import { View, StyleSheet } from "react-native";
import { Surface, Text, Divider, useTheme } from "react-native-paper";

const f = v => Number(v || 0).toFixed(2);

const InvoiceSummaryBox = ({ invoice }) => {
    const theme = useTheme();

    const subtotal = invoice?.subtotal || 0;
    const totalDiscount = invoice?.discountTotal || 0; // USER APPLIED DISCOUNT
    const gstTotal = invoice?.totalTax || 0;
    const gross = invoice?.grandTotalRaw || 0;

    const roundOff = invoice?.roundOff || 0;
    const netTotal = invoice?.netTotal || gross;

    return (
        <Surface
            elevation={1}
            style={[
                styles.card,
                { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }
            ]}
        >
            <Text style={[styles.heading, { color: theme.colors.onSurface }]}>
                Summary
            </Text>

            <Divider style={styles.divider} />

            <Row label="Subtotal" value={`₹${f(subtotal)}`} />

            {
                gstTotal !== 0 && (
                    <Row label="GST Total" value={`₹${f(gstTotal)}`} />
                )
            }

            {
                totalDiscount !== 0 && (
                    <Row
                        label="Total Discount"
                        value={`- ₹${f(totalDiscount)}`}
                        valueColor={theme.colors.error}
                    />
                )
            }


            {
                gstTotal !== 0 && totalDiscount !== 0 && (
                    <>
                        <Divider style={styles.divider} />
                        <Row label="Gross Total" value={`₹${f(gross)}`} bold />
                    </>
                )
            }

            {roundOff !== 0 && (
                <Row
                    label="Round Off"
                    value={`${roundOff > 0 ? "+" : ""}₹${f(roundOff)}`}
                    valueColor={theme.colors.outline}
                />
            )}

            <Divider style={styles.divider} />

            <Row
                label="Net Total"
                value={`₹${f(netTotal)}`}
                bold
                large
                valueColor={theme.colors.primary}
            />
        </Surface>
    );
};

const Row = ({ label, value, bold, large, valueColor }) => (
    <View style={styles.row}>
        <Text
            style={[
                styles.label,
                bold && styles.boldText,
                large && styles.largeText,
            ]}
        >
            {label}
        </Text>

        <Text
            style={[
                styles.value,
                bold && styles.boldText,
                large && styles.largeValueText,
                valueColor && { color: valueColor },
            ]}
        >
            {value}
        </Text>
    </View>
);

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 12,
        marginTop: 6,
        marginBottom: 30,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    heading: { fontSize: 13, fontWeight: "700" },
    divider: { marginVertical: 6, opacity: 0.35 },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginVertical: 2,
    },
    label: { fontSize: 12, color: "#666" },
    value: { fontSize: 12, color: "#111" },
    boldText: { fontWeight: "600" },
    largeText: { fontSize: 13 },
    largeValueText: { fontSize: 15 },
});

export default InvoiceSummaryBox;
