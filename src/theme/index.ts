/**
 * Dabba Nation design tokens — customer app.
 *
 * Visual language: a home-kitchen brand, not a generic delivery template.
 * - Warm paper background and deep ink text; brand orange is an accent, not wallpaper.
 * - Fraunces (warm serif) for headlines, Manrope for everything else.
 * - Flat surfaces separated by hairlines; elevation only for things that float.
 *
 * The Rider app keeps its own tokens (Dabba-Rider-App/src/theme) and is intentionally unchanged.
 */
import { Platform, TextStyle, ViewStyle } from 'react-native';

export const colors = {
  // Brand
  primary: '#FF6B00',
  primaryPressed: '#E25E00',
  primaryDisabled: '#FFC499',
  primarySoft: '#FFF1E5',
  primaryBorder: '#FFD5B5',
  primaryInk: '#B34700', // orange text on light backgrounds (AA contrast)
  brandGreen: '#2F7A3E',

  // Surfaces
  canvas: '#FBF7F1', // paper
  surface: '#FFFFFF',
  surfaceMuted: '#F4EEE5',
  surfaceSunken: '#EFE7DB',
  inkSurface: '#1F1A15', // dark feature panels (plans, order status)
  overlay: 'rgba(20, 16, 12, 0.5)',

  // Text
  text: '#1F1A15',
  textSecondary: '#62584E',
  textTertiary: '#998E82',
  textInverse: '#FFFFFF',
  textOnInk: '#F6EFE6',
  textOnInkMuted: '#BDB2A5',

  // Lines
  border: '#E7DED1',
  divider: '#EFE8DD',

  // Semantic
  success: '#2F9E4F',
  successStrong: '#1F6B35',
  successSoft: '#EAF5EC',
  warning: '#E9A23B',
  warningStrong: '#8A5A0B',
  warningSoft: '#FCF3E2',
  danger: '#C8372D',
  dangerSoft: '#FBECEA',
  info: '#2F5F9E',
  infoSoft: '#EAF0F8',
  rating: '#E9A23B',
  veg: '#2F9E4F',
  nonVeg: '#C8372D',
} as const;

/** Order status palette */
export const orderStatusColors: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#FCF3E2', fg: '#8A5A0B', label: 'Waiting for kitchen' },
  confirmed: { bg: '#EAF0F8', fg: '#2F5F9E', label: 'Confirmed' },
  preparing: { bg: '#FFF1E5', fg: '#B34700', label: 'Being cooked' },
  ready: { bg: '#E8F4F1', fg: '#21685A', label: 'Ready for pickup' },
  out_for_delivery: { bg: '#FFF1E5', fg: '#B34700', label: 'On the way' },
  delivered: { bg: '#EAF5EC', fg: '#1F6B35', label: 'Delivered' },
  cancelled: { bg: '#FBECEA', fg: '#C8372D', label: 'Cancelled' },
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  screen: 20, // horizontal screen padding
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const sizes = {
  buttonHeight: 52,
  buttonHeightSm: 38,
  inputHeight: 52,
  iconButton: 42,
  icon: 20,
  iconSm: 16,
  iconLg: 24,
  listRow: 60,
  headerHeight: 56,
  tabBarHeight: 62,
} as const;

/** Font family names registered in App.tsx (useFonts) */
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  displayItalic: 'Fraunces_500Medium_Italic',
  regular: 'Manrope_500Medium',
  medium: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  heavy: 'Manrope_800ExtraBold',
} as const;

const font = (family: string, size: number, lineHeight: number, extra: TextStyle = {}): TextStyle => ({
  fontFamily: family,
  fontSize: size,
  lineHeight,
  color: colors.text,
  ...extra,
});

/**
 * Type scale. Headlines use the serif; UI text uses Manrope.
 * Weights come from the font family (custom fonts ignore fontWeight on Android).
 */
export const type = {
  hero: font(fonts.display, 32, 38, { letterSpacing: -0.6 }),
  display: font(fonts.display, 26, 32, { letterSpacing: -0.4 }),
  title: font(fonts.display, 21, 27, { letterSpacing: -0.2 }),
  heading: font(fonts.bold, 17, 23),
  subheading: font(fonts.bold, 15, 20),
  body: font(fonts.regular, 15, 22),
  bodyStrong: font(fonts.bold, 15, 22),
  label: font(fonts.bold, 13, 18),
  small: font(fonts.regular, 13, 18),
  caption: font(fonts.regular, 12, 16, { color: colors.textSecondary }),
  overline: font(fonts.bold, 11, 14, { letterSpacing: 1, textTransform: 'uppercase', color: colors.textSecondary }),
  price: font(fonts.heavy, 15, 20, { fontVariant: ['tabular-nums'] }),
  button: font(fonts.bold, 15, 20),
};

const shadow = (elevation: number, opacity: number, radiusPx: number, offsetY: number): ViewStyle =>
  Platform.select({
    android: { elevation },
    default: {
      shadowColor: '#3A2A1A',
      shadowOpacity: opacity,
      shadowRadius: radiusPx,
      shadowOffset: { width: 0, height: offsetY },
    },
  }) as ViewStyle;

export const elevation = {
  none: {} as ViewStyle,
  card: shadow(1, 0.06, 8, 2),
  raised: shadow(4, 0.1, 16, 6),
  sticky: shadow(10, 0.08, 18, -4),
};

/** Shared hairline border for flat cards */
export const hairline: ViewStyle = { borderWidth: 1, borderColor: colors.border };

export const formatPrice = (amount: number | string | undefined | null) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₹0';
  return `₹${n % 1 === 0 ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Friendly time-of-day context for the home screen (no fabricated data) */
export const mealOfTheDay = (date = new Date()) => {
  const h = date.getHours();
  if (h < 11) return { key: 'breakfast', greeting: 'Good morning', prompt: 'Breakfast from kitchens near you' };
  if (h < 16) return { key: 'lunch', greeting: 'Good afternoon', prompt: 'Lunch, cooked fresh near you' };
  if (h < 19) return { key: 'snacks', greeting: 'Good evening', prompt: 'Evening snacks and early dinner' };
  return { key: 'dinner', greeting: 'Good evening', prompt: 'Dinner from home kitchens near you' };
};

export const theme = { colors, spacing, radius, sizes, type, fonts, elevation, orderStatusColors };
export default theme;
