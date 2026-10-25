/**
 * Dabba Nation design tokens (Customer app).
 *
 * Source of truth: the seller/admin panels of the web app (dabba-delights/src/index.css).
 * Every brand colour below is the hex form of one of those HSL tokens, so the customer
 * app reads as the same product as the panels:
 *   background 45 50% 92%  ·  card 45 45% 96%  ·  primary 0 72% 51%  ·  accent 142 69% 45%
 * Type follows the panels too: Playfair Display for display text, Plus Jakarta Sans for UI.
 */
import { Platform, StyleSheet, TextStyle, ViewStyle } from 'react-native';

export const colors = {
  // Brand — Dabba Nation logo red (--primary)
  primary: '#DC2828',
  primaryPressed: '#C52020',
  primaryDisabled: '#EC9A96',
  primarySoft: '#F6E2DC', // primary/10 on card
  primaryBorder: '#F3CEC8', // primary/20 on card
  primaryInk: '#B81E1E', // red text on light surfaces
  primaryGradientEnd: '#EE4B2B', // --gradient-primary end stop
  brandGreen: '#24C25E', // --accent

  // Surfaces — golden theme
  canvas: '#F5F0E0', // --background
  surface: '#F9F7F0', // --card
  surfaceRaised: '#FEFDFB', // --gradient-card top stop
  surfaceMuted: '#F0E8D1', // --sidebar-background
  surfaceSunken: '#F0E4C2', // --secondary
  inputFill: '#F5EED9', // .input-styled: secondary/50
  muted: '#E8DAB0', // --muted
  inkSurface: '#30251D', // --foreground as a panel
  overlay: 'rgba(48, 37, 29, 0.5)',

  // Text
  text: '#30251D', // --foreground
  textSecondary: '#6B6258', // foreground/70, sidebar link text
  textTertiary: '#A8968A', // --muted-foreground
  textInverse: '#FFFFFF',
  textOnInk: '#F9F7F0',
  textOnInkMuted: '#C9BBA6',

  // Lines
  border: '#ECE2C6', // --border
  borderStrong: '#E6D9B3', // --sidebar-border
  divider: '#F0E8D1',

  // Semantic
  success: '#24C25E', // --success
  successStrong: '#18813E',
  successSoft: '#E4F2E1',
  warning: '#F6AE31', // --warning
  warningStrong: '#9D6607',
  warningSoft: '#F9EED9',
  danger: '#DC2828', // --destructive
  dangerSoft: '#F6E2DC',
  info: '#0DA2E7', // --info
  infoStrong: '#0A73A4',
  infoSoft: '#E1EFEF',
  rating: '#F6AE31',
  veg: '#18813E',
  nonVeg: '#DC2828',
  white: '#FFFFFF',
} as const;

/** Brand gradients (--gradient-primary / --gradient-success / --gradient-hero) */
export const gradients = {
  primary: [colors.primary, colors.primaryGradientEnd] as const,
  success: ['#24C25E', '#1BE48D'] as const,
  hero: ['#DC2828', '#F27436', '#DC2828'] as const,
  card: ['#FEFDFB', '#F9F7F1'] as const,
};

/** Order status palette — shared with the Rider app and seller web */
export const orderStatusColors: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: colors.warningSoft, fg: colors.warningStrong, label: 'Pending' },
  confirmed: { bg: colors.infoSoft, fg: colors.infoStrong, label: 'Confirmed' },
  preparing: { bg: '#EFE3F6', fg: '#7C3AED', label: 'Preparing' },
  ready: { bg: '#DDF1EC', fg: '#0F766E', label: 'Ready' },
  out_for_delivery: { bg: colors.primarySoft, fg: colors.primaryInk, label: 'Out for Delivery' },
  delivered: { bg: colors.successSoft, fg: colors.successStrong, label: 'Delivered' },
  cancelled: { bg: colors.dangerSoft, fg: colors.danger, label: 'Cancelled' },
};

/** 4-pt spacing scale. `screen` is the one horizontal gutter used on every screen. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 28, // vertical gap between page sections
  screen: 16, // horizontal screen padding
} as const;

/** --radius is 0.75rem (12px); cards are rounded-xl / rounded-2xl in the panels */
export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const sizes = {
  buttonHeight: 50,
  buttonHeightSm: 38,
  inputHeight: 50,
  iconButton: 40,
  icon: 20,
  iconSm: 16,
  iconLg: 24,
  listRow: 56,
  headerHeight: 56,
  tabBarHeight: 64,
} as const;

export const hairline: ViewStyle = {
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: colors.border,
};

export const mealOfTheDay = () => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return 'Breakfast';
  if (hour >= 11 && hour < 16) return 'Lunch';
  if (hour >= 16 && hour < 19) return 'Snacks';
  return 'Dinner';
};

/** Font family names registered in App.tsx (useFonts) */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  heavy: 'PlusJakartaSans_800ExtraBold',
  display: 'PlayfairDisplay_600SemiBold',
  displayBold: 'PlayfairDisplay_700Bold',
  displayItalic: 'PlayfairDisplay_500Medium',
} as const;

const font = (family: string, size: number, lineHeight: number, extra: TextStyle = {}): TextStyle => ({
  fontFamily: family,
  fontSize: size,
  lineHeight,
  color: colors.text,
  ...extra,
});

/** Type scale: Playfair for display/title (like the panels' h1–h6), Jakarta for everything else */
export const type = {
  display: font(fonts.displayBold, 28, 34),
  title: font(fonts.displayBold, 22, 28),
  heading: font(fonts.bold, 17, 22),
  subheading: font(fonts.semiBold, 15, 20),
  body: font(fonts.regular, 15, 22),
  bodyStrong: font(fonts.semiBold, 15, 22),
  label: font(fonts.semiBold, 13, 18),
  small: font(fonts.regular, 13, 18),
  caption: font(fonts.regular, 12, 16, { color: colors.textSecondary }),
  overline: font(fonts.bold, 11, 14, { letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textTertiary }),
  price: font(fonts.bold, 15, 20, { fontVariant: ['tabular-nums'] }),
};

const shadow = (elevation: number, opacity: number, radiusPx: number, offsetY: number, color = '#403126'): ViewStyle =>
  Platform.select({
    android: { elevation, shadowColor: color },
    default: {
      shadowColor: color,
      shadowOpacity: opacity,
      shadowRadius: radiusPx,
      shadowOffset: { width: 0, height: offsetY },
    },
  }) as ViewStyle;

/** --shadow-card / --shadow-lg / --shadow-card-hover */
export const elevation = {
  none: {} as ViewStyle,
  card: shadow(2, 0.08, 8, 2),
  raised: shadow(5, 0.1, 15, 6),
  sticky: shadow(10, 0.1, 18, -4),
  brand: shadow(6, 0.22, 14, 6, colors.primary),
};

/** Shared surface recipes so cards look identical everywhere (.stat-card / .food-card) */
export const surfaces = {
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...elevation.card,
  } as ViewStyle,
  flat: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  } as ViewStyle,
  input: {
    backgroundColor: colors.inputFill,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: sizes.inputHeight,
    paddingHorizontal: spacing.lg,
  } as ViewStyle,
};

export const formatPrice = (amount: number | string | undefined | null) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₹0';
  return `₹${n % 1 === 0 ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const theme = { colors, gradients, spacing, radius, sizes, type, elevation, surfaces, orderStatusColors, fonts, hairline, mealOfTheDay };
export default theme;
