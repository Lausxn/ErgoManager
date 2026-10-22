import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

/**
 * Official colors of the MGS brand book (Libro de Marca 2026, page 13).
 */
export const MGS_COLORS = {
    black: '#0B0B0D',
    graphite: '#2E3035',
    gray: '#6E737A',
    wine: '#7A1022',
    darkWine: '#4C0815',
    paper: '#F7F5F2'
} as const;

/**
 * Wine scale built around the official "Rojo vino" (600) and "Vino oscuro" (800).
 * It is the only accent of the brand: emphasis, alerts and calls to action.
 */
const WINE_PALETTE = {
    50: '#FBF2F3',
    100: '#F5DFE2',
    200: '#EABDC4',
    300: '#D98F9B',
    400: '#C4586B',
    500: '#9E2A3F',
    600: MGS_COLORS.wine,
    700: '#63101E',
    800: MGS_COLORS.darkWine,
    900: '#360510',
    950: '#210309'
};

/**
 * Neutral scale that goes from "Papel" (50) to "Negro" (950), going through
 * "Gris" (500) and "Grafito" (800).
 */
export const MGS_SURFACE_PALETTE = {
    0: '#FFFFFF',
    50: MGS_COLORS.paper,
    100: '#EEEBE7',
    200: '#E0DDD8',
    300: '#C8C6C3',
    400: '#9A9EA4',
    500: MGS_COLORS.gray,
    600: '#52565C',
    700: '#3D4045',
    800: MGS_COLORS.graphite,
    900: '#1B1C20',
    950: MGS_COLORS.black
};

/**
 * Tokens of one toast severity, drawn only from the brand palette.
 *
 * @param accent  color of the title and the border
 * @param surface background of the toast
 * @param detail  color of the detail text
 * @returns the toast tokens of the severity
 */
function toastSeverity(accent: string, surface: string, detail: string) {
    return {
        background: surface,
        borderColor: accent,
        color: accent,
        detailColor: detail,
        shadow: '0px 4px 12px 0px rgba(11, 11, 13, 0.18)',
        closeButton: {
            hoverBackground: 'color-mix(in srgb, ' + accent + ', transparent 88%)',
            focusRing: { color: accent, shadow: 'none' }
        }
    };
}

/**
 * PrimeNG preset of ErgoManager, based on Aura and adjusted to the MGS brand book.
 */
export const MGS_PRESET = definePreset(Aura, {
    semantic: {
        primary: WINE_PALETTE,
        colorScheme: {
            light: {
                surface: MGS_SURFACE_PALETTE,
                primary: {
                    color: '{primary.600}',
                    contrastColor: '#ffffff',
                    hoverColor: '{primary.700}',
                    activeColor: '{primary.800}'
                },
                highlight: {
                    background: '{primary.50}',
                    focusBackground: '{primary.100}',
                    color: '{primary.700}',
                    focusColor: '{primary.800}'
                },
                text: {
                    color: '{surface.800}',
                    hoverColor: '{surface.950}',
                    mutedColor: '{surface.500}',
                    hoverMutedColor: '{surface.700}'
                },
                content: {
                    background: '{surface.0}',
                    borderColor: '{surface.200}'
                },
                formField: {
                    invalidBorderColor: '{primary.500}',
                    invalidPlaceholderColor: '{primary.600}'
                }
            },
            dark: {
                surface: MGS_SURFACE_PALETTE,
                primary: {
                    color: '{primary.400}',
                    contrastColor: '#ffffff',
                    hoverColor: '{primary.300}',
                    activeColor: '{primary.200}'
                },
                highlight: {
                    background: 'color-mix(in srgb, {primary.400}, transparent 80%)',
                    focusBackground: 'color-mix(in srgb, {primary.400}, transparent 70%)',
                    color: 'rgba(255,255,255,.9)',
                    focusColor: 'rgba(255,255,255,.9)'
                },
                text: {
                    color: '{surface.50}',
                    hoverColor: '{surface.0}',
                    mutedColor: '{surface.400}',
                    hoverMutedColor: '{surface.300}'
                },
                content: {
                    background: '{surface.900}',
                    borderColor: '{surface.800}'
                },
                formField: {
                    invalidBorderColor: '{primary.400}',
                    invalidPlaceholderColor: '{primary.300}'
                }
            }
        }
    },
    components: {
        // Notifications: wine for errors and warnings, graphite for the rest.
        toast: {
            colorScheme: {
                light: {
                    success: toastSeverity('{surface.800}', '{surface.0}', '{surface.600}'),
                    info: toastSeverity('{surface.800}', '{surface.0}', '{surface.600}'),
                    warn: toastSeverity('{primary.500}', '{surface.0}', '{surface.600}'),
                    error: toastSeverity('{primary.600}', '{surface.0}', '{surface.600}')
                },
                dark: {
                    success: toastSeverity('{surface.0}', '{surface.800}', '{surface.300}'),
                    info: toastSeverity('{surface.0}', '{surface.800}', '{surface.300}'),
                    warn: toastSeverity('{primary.300}', '{surface.800}', '{surface.300}'),
                    error: toastSeverity('{primary.300}', '{surface.800}', '{surface.300}')
                }
            }
        },
        // Calls to action keep the official wine in both themes (page 3).
        button: {
            colorScheme: {
                dark: {
                    root: {
                        primary: {
                            background: '{primary.600}',
                            hoverBackground: '{primary.500}',
                            activeBackground: '{primary.700}',
                            borderColor: '{primary.600}',
                            hoverBorderColor: '{primary.500}',
                            activeBorderColor: '{primary.700}',
                            color: '#ffffff',
                            hoverColor: '#ffffff',
                            activeColor: '#ffffff'
                        }
                    }
                }
            }
        },
        // The brand book asks for tables with dark headers (page 18).
        datatable: {
            colorScheme: {
                light: {
                    headerCell: {
                        background: '{surface.800}',
                        hoverBackground: '{surface.700}',
                        color: '{surface.0}',
                        hoverColor: '{surface.0}',
                        selectedBackground: '{surface.700}',
                        selectedColor: '{surface.0}',
                        borderColor: '{surface.800}'
                    },
                    sortIcon: {
                        color: '{surface.300}',
                        hoverColor: '{surface.0}'
                    }
                },
                dark: {
                    headerCell: {
                        background: '{surface.950}',
                        hoverBackground: '{surface.800}',
                        color: '{surface.0}',
                        hoverColor: '{surface.0}',
                        selectedBackground: '{surface.800}',
                        selectedColor: '{surface.0}',
                        borderColor: '{surface.800}'
                    },
                    sortIcon: {
                        color: '{surface.400}',
                        hoverColor: '{surface.0}'
                    }
                }
            }
        }
    }
});
