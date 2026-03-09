// src/components/NetworkBanner.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NetworkBanner() {
    const [visible, setVisible] = useState(false);
    const translateY = useRef(new Animated.Value(-80)).current;
    const insets = useSafeAreaInsets(); // 👈 get safe area values

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            if (!state.isConnected) {
                setVisible(true);
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                }).start();
            } else {
                Animated.timing(translateY, {
                    toValue: -80,
                    duration: 300,
                    useNativeDriver: true,
                }).start(() => setVisible(false));
            }
        });
        return () => unsubscribe();
    }, [translateY]);

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.banner,
                { transform: [{ translateY }], paddingTop: insets.top }, // 👈 push below status bar
            ]}
        >
            <View style={styles.content}>
                <Icon name="wifi-off" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.text}>No Internet Connection</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    banner: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#d32f2f',
        paddingBottom: 12,
        paddingHorizontal: 16,
        zIndex: 9999,
        elevation: 10,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    text: {
        color: '#fff',
        fontWeight: '600',
    },
});
