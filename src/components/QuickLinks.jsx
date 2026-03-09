import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text, Surface, IconButton, useTheme } from 'react-native-paper';
import PropTypes from 'prop-types';

const quickLinks = [
    {
        icon: 'plus',
        label: 'Add Txn'
    },
    {
        icon: 'file-document',
        label: 'Sale Report'
    },
    {
        icon: 'chevron-right',
        label: 'Show All'
    }
];

const QuickLinks = ({
    title = 'Quick Links',
    links = quickLinks,
    containerStyle,
    titleStyle,
    itemWidth = '22%',
    onPressLink,
}) => {
    const theme = useTheme();

    return (
        <Surface
            style={[
                styles.container,
                { backgroundColor: theme.colors.surfaceVariant },
                containerStyle
            ]}
            elevation={0}
        >
            {title && (
                <Text
                    variant="titleMedium"
                    style={[styles.sectionTitle, titleStyle]}
                >
                    {title}
                </Text>
            )}
            <View style={styles.linksContainer}>
                {links.map((link, index) => (
                    <View
                        key={`${link.label}-${index}`}
                        style={[styles.linkItem, { width: itemWidth }]}
                    >
                        <IconButton
                            icon={link.icon}
                            mode="contained"
                            containerColor={theme.colors.primaryContainer}
                            iconColor={theme.colors.primary}
                            size={24}
                            onPress={() => onPressLink && onPressLink(link)}
                            style={styles.linkIcon}
                        />
                        <Text
                            style={[
                                styles.linkLabel,
                                { color: theme.colors.onSurfaceVariant }
                            ]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                        >
                            {link.label}
                        </Text>
                    </View>
                ))}
            </View>
        </Surface>
    );
};

QuickLinks.propTypes = {
    // The title to display above the quick links
    title: PropTypes.string,

    // Array of link objects with icon, label, and optional colors
    links: PropTypes.arrayOf(
        PropTypes.shape({
            icon: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired,
            color: PropTypes.string,
            iconColor: PropTypes.string,
            onPress: PropTypes.func,
        })
    ).isRequired,

    // Style overrides
    containerStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
    titleStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),

    // Width of each quick link item (can be percentage or fixed width)
    itemWidth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

    // Callback when a link is pressed
    onPressLink: PropTypes.func,
};

const styles = StyleSheet.create({
    container: {
        marginTop: 4,
        marginHorizontal: 12,
        padding: 12,
        borderRadius: 16,
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
    sectionTitle: {
        marginBottom: 10,
        fontWeight: 'bold',
    },
    linksContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
    },
    linkItem: {
        alignItems: 'center',
        gap: 6,
    },
    linkIcon: {
        margin: 0,
    },
    linkLabel: {
        fontSize: 12,
        textAlign: 'center',
        letterSpacing: 0.1,
    },
});

export default QuickLinks;
