import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export const lightTheme = {
    ...MD3LightTheme,
    dark: false,
    colors: {
        primary: '#1A73E8',
        onPrimary: '#FFFFFF',
        primaryContainer: '#E8F0FE',
        onPrimaryContainer: '#1967D2',

        secondary: '#03DAC5',
        onSecondary: '#00332A',
        secondaryContainer: '#E6FFFD',
        onSecondaryContainer: '#018786',

        tertiary: '#F9AB00',
        onTertiary: '#442B00',
        tertiaryContainer: '#FFF4E5',
        onTertiaryContainer: '#E09600',

        background: '#F5F7FA',
        onBackground: '#1C1C1E',

        surface: '#FFFFFF',
        onSurface: '#1C1C1E',

        surfaceVariant: '#E0E3E7',
        onSurfaceVariant: '#44474F',

        inverseSurface: '#2D2D30',
        inverseOnSurface: '#F5F5F5',

        error: '#D93025',
        onError: '#FFFFFF',

        outline: '#C5C8CD',
        outlineVariant: '#E5E5E5',

        // Status colors
        success: '#34A853',
        onSuccess: '#FFFFFF',
        successContainer: '#E6F4EA',
        onSuccessContainer: '#1E7E34',

        warning: '#FBBC05',
        onWarning: '#3C3C3C',
        warningContainer: '#FFF4E5',
        onWarningContainer: '#E09600',

        // Interactive states
        disabled: '#DADCE0',
        onDisabled: '#9AA0A6',
        
        // Link color
        link: '#1A73E8',
        visitedLink: '#681DA8',

        // Typography colors
        textPrimary: '#1C1C1E',
        textSecondary: '#5F6368',
        textTertiary: '#80868B',
        textDisabled: '#9AA0A6',
        textPlaceholder: '#9AA0A6',
        textHighlight: '#1A73E8',
        textError: '#D93025',
        textSuccess: '#34A853',
        textWarning: '#FBBC05',
        textOnPrimaryButton: '#FFFFFF',
        textOnSecondaryButton: '#1C1C1E',
        textCaption: '#5F6368',
        textHint: '#80868B',

        // Card and Dialog surfaces
        surfaceContainerLowest: '#FFFFFF',
        surfaceContainerLow: '#F8F9FA',
        surfaceContainer: '#F3F4F6',
        surfaceContainerHigh: '#ECF0F4',
        surfaceContainerHighest: '#E8EAED',

        shadow: '#000000',

        scrim: 'rgba(0, 0, 0, 0.32)',

        elevation: {
            level0: 'transparent',
            level1: '#F9F9F9',
            level2: '#F1F1F1',
            level3: '#E9E9E9',
            level4: '#E0E0E0',
            level5: '#D8D8D8',
        },
    },
};


export const darkTheme = {
    ...MD3DarkTheme,
    dark: true,
    colors: {
        primary: '#8AB4F8',
        onPrimary: '#0D47A1',
        primaryContainer: '#1F1F1F',
        onPrimaryContainer: '#D2E3FC',

        secondary: '#66FFF9',
        onSecondary: '#00332A',
        secondaryContainer: '#1F1F1F',
        onSecondaryContainer: '#CCFFF9',

        tertiary: '#FDD663',
        onTertiary: '#3E2A00',
        tertiaryContainer: '#1F1F1F',
        onTertiaryContainer: '#FFE5B3',

        background: '#0E0F11',
        onBackground: '#E8EAED',

        surface: '#1C1C1E',
        onSurface: '#E8EAED',

        surfaceVariant: '#2C2C2E',
        onSurfaceVariant: '#C7C7CC',

        inverseSurface: '#F5F5F5',
        inverseOnSurface: '#2D2D30',

        error: '#F28B82',
        onError: '#3E2723',

        outline: '#3A3B3C',
        outlineVariant: '#4A4A4A',

        // Status colors
        success: '#81C995',
        onSuccess: '#0D160E',
        successContainer: '#1F1F1F',
        onSuccessContainer: '#E6F4EA',

        warning: '#FDE293',
        onWarning: '#1F1F1F',
        warningContainer: '#1F1F1F',
        onWarningContainer: '#FFF4E5',

        // Interactive states
        disabled: '#3C4043',
        onDisabled: '#9AA0A6',
        
        // Link color
        link: '#8AB4F8',
        visitedLink: '#B69DF8',

        // Typography colors
        textPrimary: '#E8EAED',
        textSecondary: '#9AA0A6',
        textTertiary: '#80868B',
        textDisabled: '#5F6368',
        textPlaceholder: '#5F6368',
        textHighlight: '#8AB4F8',
        textError: '#F28B82',
        textSuccess: '#81C995',
        textWarning: '#FDE293',
        textOnPrimaryButton: '#0D47A1',
        textOnSecondaryButton: '#E8EAED',
        textCaption: '#9AA0A6',
        textHint: '#80868B',

        // Card and Dialog surfaces
        surfaceContainerLowest: '#0E0F11',
        surfaceContainerLow: '#1C1C1E',
        surfaceContainer: '#2C2C2E',
        surfaceContainerHigh: '#3C3C3E',
        surfaceContainerHighest: '#4C4C4E',

        shadow: '#000000',

        scrim: 'rgba(0, 0, 0, 0.32)',

        elevation: {
            level0: 'transparent',
            level1: '#1A1A1A',
            level2: '#232323',
            level3: '#2C2C2C',
            level4: '#333333',
            level5: '#3C3C3C',
        },
    },
};
