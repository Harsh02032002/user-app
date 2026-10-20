/**
 * Commerce cards shared across Home, All Menus, Search, Restaurant, Wishlist and plan screens.
 *
 * Image policy: show the seller's own photos only. Stock photos the backend substitutes for
 * missing images are treated as "no image" and replaced by a designed placeholder, so a
 * Rajma Chawal never shows up as a salad bowl.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl } from '../config/api';
import { colors, fonts, formatPrice, radius, spacing, type } from '../theme';
import { AddToCartButton, VegIndicator } from './common';

const isHomeChef = (t?: string) => t === 'home_chef' || t === 'home-chef';

/** Generic stock/clip-art images the backend uses as defaults are not the seller's food */
export const isStockPlaceholder = (url?: string | null) =>
  !url || /images\.unsplash\.com|cdn-icons-png\.flaticon\.com|placeholder\.svg/i.test(url);

/** Absolute URL for a seller/dish image, or null when it's missing or a stock default */
export const realImageUrl = (path?: string | null) => {
  if (!path || isStockPlaceholder(path)) return null;
  const url = getImageUrl(path);
  return url && !isStockPlaceholder(url) ? url : null;
};

// ─── Placeholders ─────────────────────────────────────────────────────

const TINTS = [
  { bg: '#F6E3C6', fg: '#8A5A0B' }, // saffron
  { bg: '#DCEBD8', fg: '#2F6B3A' }, // curry leaf
  { bg: '#F3D9D2', fg: '#9B3A2C' }, // chilli
  { bg: '#F5EBC8', fg: '#7A6512' }, // turmeric
  { bg: '#E9DCCD', fg: '#6E4B2E' }, // clay
  { bg: '#E3E4EF', fg: '#3E4677' }, // indigo
];
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};
export const tintFor = (key?: string) => TINTS[hash(key || 'dabba') % TINTS.length];

const initials = (name?: string, max = 2) =>
  String(name || '')
    .replace(/[^A-Za-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !/^(the|and|ki|ka|ke|of|with)$/i.test(w))
    .slice(0, max)
    .map((w) => w[0].toUpperCase())
    .join('') || 'D';

/** Designed stand-in for a missing dish photo: a tinted tile with the dish's initial */
export const DishArt: React.FC<{ name?: string; category?: string; style?: StyleProp<ViewStyle>; compact?: boolean }> = ({ name, category, style, compact }) => {
  const tint = tintFor(category || name);
  return (
    <View style={[styles.dishArt, { backgroundColor: tint.bg }, style]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={[styles.dishArtLetter, { color: tint.fg }, compact && { fontSize: 30, lineHeight: 36 }]}>{initials(name, 1)}</Text>
      {!compact && category ? <Text style={[styles.dishArtCaption, { color: tint.fg }]} numberOfLines={1}>{category}</Text> : null}
    </View>
  );
};

/** Seller logo or a monogram when the kitchen hasn't uploaded one */
export const KitchenMark: React.FC<{ name?: string; logo?: string | null; size?: number; style?: StyleProp<ViewStyle> }> = ({ name, logo, size = 56, style }) => {
  const [failed, setFailed] = React.useState(false);
  const url = realImageUrl(logo);
  const box = { width: size, height: size, borderRadius: size * 0.28 };
  if (url && !failed) {
    return <Image source={{ uri: url }} style={[box, styles.markImage, style as StyleProp<ImageStyle>]} contentFit="cover" onError={() => setFailed(true)} />;
  }
  return (
    <View style={[box, styles.monogram, style]}>
      <Text style={[styles.monogramText, { fontSize: size * 0.36, lineHeight: size * 0.44 }]}>{initials(name)}</Text>
    </View>
  );
};

/** Dish photo with graceful fallback to DishArt */
const DishImage: React.FC<{ item: FoodItemData; style?: StyleProp<ViewStyle>; compact?: boolean }> = ({ item, style, compact }) => {
  const [failed, setFailed] = React.useState(false);
  const url = realImageUrl(item.image);
  React.useEffect(() => setFailed(false), [url]);
  if (!url || failed) return <DishArt name={item.name} category={item.category} style={style} compact={compact} />;
  return <Image source={{ uri: url }} style={style as StyleProp<ImageStyle>} contentFit="cover" transition={150} onError={() => setFailed(true)} />;
};

export const SellerTypeBadge: React.FC<{ sellerType?: string; style?: StyleProp<ViewStyle> }> = ({ sellerType, style }) => (
  <View style={[styles.typeTag, style]}>
    <Ionicons name={isHomeChef(sellerType) ? 'home-outline' : 'restaurant-outline'} size={11} color={colors.textSecondary} />
    <Text style={styles.typeTagText}>{isHomeChef(sellerType) ? 'Home kitchen' : 'Restaurant'}</Text>
  </View>
);

// ─── Seller ───────────────────────────────────────────────────────────

export interface SellerCardData {
  _id: string;
  businessName: string;
  type?: string;
  rating?: number;
  totalOrders?: number;
  cuisines?: string[];
  logo?: string;
  coverImage?: string;
  image?: string;
  description?: string;
  distanceKm?: number | null;
  address?: { city?: string; area?: string; street?: string };
}

/** 0.7 → "700 m", 3.25 → "3.3 km", 0 → "Very close" */
export const formatDistance = (km: number) => {
  const d = Number(km);
  if (!Number.isFinite(d)) return '';
  if (d < 0.1) return 'Very close';
  if (d < 1) return `${Math.round(d * 10) * 100} m`;
  return `${d.toFixed(d < 10 ? 1 : 0)} km`;
};

const sellerMeta = (seller: SellerCardData) =>
  [
    seller.distanceKm != null ? formatDistance(seller.distanceKm) : null,
    seller.address?.city || seller.address?.area || null,
  ].filter(Boolean).join(' · ');

/** Kitchen row: monogram/logo, name, cuisines, rating · distance */
export const SellerCard: React.FC<{
  seller: SellerCardData;
  onPress: () => void;
  width?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ seller, onPress, width, style }) => {
  const meta = sellerMeta(seller);
  const cuisines = seller.cuisines && seller.cuisines.length ? seller.cuisines.slice(0, 3).join(' · ') : seller.description || '';
  return (
    <TouchableOpacity
      style={[styles.sellerCard, width ? { width } : null, style]}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${seller.businessName}, ${isHomeChef(seller.type) ? 'home kitchen' : 'restaurant'}${meta ? `, ${meta}` : ''}`}
    >
      <KitchenMark name={seller.businessName} logo={seller.logo} size={60} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.sellerName} numberOfLines={1}>{seller.businessName}</Text>
        {cuisines ? <Text style={type.caption} numberOfLines={1}>{cuisines}</Text> : null}
        <View style={styles.sellerMetaRow}>
          {seller.rating ? (
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={10} color={colors.textInverse} />
              <Text style={styles.ratingPillText}>{Number(seller.rating).toFixed(1)}</Text>
            </View>
          ) : (
            <Text style={styles.newTag}>New</Text>
          )}
          <SellerTypeBadge sellerType={seller.type} />
          {meta ? <Text style={type.caption} numberOfLines={1}>{meta}</Text> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );
};

// ─── Food ─────────────────────────────────────────────────────────────

export interface FoodItemData {
  _id: string;
  name: string;
  description?: string;
  image?: string;
  price?: number;
  sellingPrice?: number;
  discountPrice?: number;
  mrp?: number;
  isVeg?: boolean;
  rating?: number;
  preparationTime?: number;
  isAvailable?: boolean;
  category?: string;
  sellerId?: any;
}

export const getFoodPricing = (item: FoodItemData) => {
  const base = Number(item.sellingPrice || item.price || 0);
  const discounted = item.discountPrice && item.discountPrice < base ? Number(item.discountPrice) : null;
  const strike = discounted ? base : item.mrp && item.mrp > base ? Number(item.mrp) : null;
  const final = discounted ?? base;
  const discountPercent = strike ? Math.round(((strike - final) / strike) * 100) : 0;
  return { final, strike, discountPercent };
};

/** Vertical dish card for carousels and grids */
export const FoodCard: React.FC<{
  item: FoodItemData;
  quantity: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onPress?: () => void;
  width?: number;
  showSeller?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ item, quantity, onAdd, onIncrement, onDecrement, onPress, width, showSeller = true, style }) => {
  const { final, strike } = getFoodPricing(item);
  const sellerName = typeof item.sellerId === 'object' ? item.sellerId?.businessName : undefined;
  const unavailable = item.isAvailable === false;
  return (
    <TouchableOpacity
      style={[styles.foodCard, width ? { width } : null, style]}
      activeOpacity={0.9}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${formatPrice(final)}${sellerName ? `, from ${sellerName}` : ''}`}
    >
      <DishImage item={item} style={styles.foodImage} />
      <View style={styles.foodBody}>
        <View style={styles.foodTitleRow}>
          <VegIndicator isVeg={!!item.isVeg} size={12} />
          <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
        </View>
        {showSeller && sellerName ? <Text style={type.caption} numberOfLines={1}>by {sellerName}</Text> : null}
        <View style={styles.foodFooter}>
          <View style={{ flexShrink: 1 }}>
            <Text style={type.price}>{formatPrice(final)}</Text>
            {strike ? <Text style={styles.strike}>{formatPrice(strike)}</Text> : null}
          </View>
          <AddToCartButton quantity={quantity} onAdd={onAdd} onIncrement={onIncrement} onDecrement={onDecrement} disabled={unavailable} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

/** Menu row (kitchen menu, wishlist, search): details left, photo + ADD right */
export const FoodRow: React.FC<{
  item: FoodItemData;
  quantity: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  right?: React.ReactNode;
  showSeller?: boolean;
}> = ({ item, quantity, onAdd, onIncrement, onDecrement, right, showSeller }) => {
  const { final, strike, discountPercent } = getFoodPricing(item);
  const unavailable = item.isAvailable === false;
  const sellerName = showSeller && typeof item.sellerId === 'object' ? item.sellerId?.businessName : undefined;
  return (
    <View style={[styles.foodRow, unavailable && { opacity: 0.55 }]}>
      <View style={{ flex: 1, paddingRight: spacing.lg }}>
        <View style={styles.rowTags}>
          <VegIndicator isVeg={!!item.isVeg} size={13} />
          {discountPercent > 0 ? <Text style={styles.offTag}>{discountPercent}% off</Text> : null}
        </View>
        <Text style={styles.rowName} numberOfLines={2}>{item.name}</Text>
        {sellerName ? <Text style={type.caption} numberOfLines={1}>by {sellerName}</Text> : null}
        <View style={styles.rowPrice}>
          <Text style={type.price}>{formatPrice(final)}</Text>
          {strike ? <Text style={styles.strike}>{formatPrice(strike)}</Text> : null}
        </View>
        {item.description ? <Text style={[type.small, { color: colors.textSecondary }]} numberOfLines={2}>{item.description}</Text> : null}
        {unavailable ? <Text style={[type.caption, { color: colors.danger, marginTop: spacing.xs }]}>Not available right now</Text> : null}
        {right}
      </View>
      <View style={styles.rowImageCol}>
        <DishImage item={item} style={styles.rowImage} compact />
        <View style={styles.rowAdd}>
          <AddToCartButton quantity={quantity} onAdd={onAdd} onIncrement={onIncrement} onDecrement={onDecrement} disabled={unavailable} />
        </View>
      </View>
    </View>
  );
};

// ─── Subscription plan ────────────────────────────────────────────────

export interface PlanCardData {
  _id: string;
  plan_name: string;
  description?: string;
  total_amount: number;
  total_days: number;
  per_day_value?: number;
  badge?: string;
  features?: string[];
  banner_image?: string;
  image?: string;
  plan_image?: string;
}

/** Kept for screens that still show the plan banner image */
export const getPlanImage = (plan: PlanCardData) => {
  let imgPath = plan.banner_image || plan.image || plan.plan_image;
  if (!imgPath) {
    const file = plan.total_days <= 7 ? 'weekly.png' : plan.total_days <= 14 ? 'fortnightly.png' : 'monthly.png';
    imgPath = `/uploads/subscriptions/${file}`;
  }
  return getImageUrl(imgPath);
};

/** Tiffin plan as a dark "pass" card: what you pay, for how long, per day */
export const PlanCard: React.FC<{
  plan: PlanCardData;
  onPress: () => void;
  onSubscribe?: () => void;
  width?: number;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ plan, onPress, onSubscribe, width, compact, style }) => {
  const perDay = plan.per_day_value || (plan.total_days ? Math.round(plan.total_amount / plan.total_days) : 0);
  return (
    <TouchableOpacity style={[styles.planCard, width ? { width } : null, style]} activeOpacity={0.9} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${plan.plan_name}, ${formatPrice(plan.total_amount)} for ${plan.total_days} days`}>
      <View style={styles.planTop}>
        <Text style={styles.planDays}>{plan.total_days}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.planDaysLabel}>DAY TIFFIN PLAN</Text>
          {plan.badge ? <Text style={styles.planBadge}>{plan.badge}</Text> : null}
        </View>
      </View>
      <Text style={styles.planName} numberOfLines={1}>{plan.plan_name}</Text>
      {plan.description ? <Text style={styles.planDesc} numberOfLines={compact ? 1 : 2}>{plan.description}</Text> : null}
      <View style={styles.planDivider} />
      <View style={styles.planPriceRow}>
        <View>
          <Text style={styles.planPrice}>{formatPrice(plan.total_amount)}</Text>
          {perDay ? <Text style={styles.planPerDay}>{formatPrice(perDay)} a day</Text> : null}
        </View>
        {onSubscribe ? (
          <TouchableOpacity style={styles.planCta} onPress={onSubscribe} accessibilityRole="button" accessibilityLabel={`Subscribe to ${plan.plan_name}`}>
            <Text style={styles.planCtaText}>Subscribe</Text>
          </TouchableOpacity>
        ) : (
          <Ionicons name="arrow-forward" size={20} color={colors.textOnInk} />
        )}
      </View>
      {!compact && plan.features && plan.features.length ? (
        <View style={styles.planFeatures}>
          {plan.features.slice(0, 3).map((f, i) => (
            <View key={i} style={styles.planFeature}>
              <Ionicons name="checkmark" size={14} color={colors.primary} />
              <Text style={styles.planFeatureText} numberOfLines={1}>{f}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  dishArt: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dishArtLetter: { fontFamily: fonts.display, fontSize: 44, lineHeight: 52 },
  dishArtCaption: { position: 'absolute', bottom: 8, left: 10, right: 10, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.75 },

  markImage: { backgroundColor: colors.surfaceMuted },
  monogram: { backgroundColor: colors.inkSurface, alignItems: 'center', justifyContent: 'center' },
  monogramText: { fontFamily: fonts.display, color: colors.textOnInk },

  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  typeTagText: { ...type.caption, fontFamily: fonts.medium },

  sellerCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  sellerName: { ...type.heading, fontSize: 16 },
  sellerMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: spacing.sm, rowGap: 4, marginTop: 6 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.success, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  ratingPillText: { fontFamily: fonts.heavy, fontSize: 11, color: colors.textInverse },
  newTag: { fontFamily: fonts.heavy, fontSize: 11, color: colors.primaryInk, letterSpacing: 0.4 },

  foodCard: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  foodImage: { width: '100%', aspectRatio: 1.15, backgroundColor: colors.surfaceMuted },
  foodBody: { padding: spacing.md, gap: 4 },
  foodTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  foodName: { ...type.subheading, flex: 1 },
  foodFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm },
  strike: { ...type.caption, color: colors.textTertiary, textDecorationLine: 'line-through' },

  foodRow: { flexDirection: 'row', paddingVertical: spacing.xl },
  rowTags: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  offTag: { fontFamily: fonts.bold, fontSize: 11, color: colors.successStrong },
  rowName: { ...type.heading, marginTop: 6 },
  rowPrice: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: 4, marginBottom: 6 },
  rowImageCol: { width: 120, alignItems: 'center' },
  rowImage: { width: 120, height: 112, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  rowAdd: { marginTop: -18 },

  planCard: { backgroundColor: colors.inkSurface, borderRadius: radius.xl, padding: spacing.xl, gap: 4 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  planDays: { fontFamily: fonts.displayBold, fontSize: 40, lineHeight: 44, color: colors.primary },
  planDaysLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, color: colors.textOnInkMuted },
  planBadge: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary, marginTop: 2 },
  planName: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: colors.textOnInk },
  planDesc: { ...type.small, color: colors.textOnInkMuted },
  planDivider: { height: 1, backgroundColor: 'rgba(246,239,230,0.12)', marginVertical: spacing.md },
  planPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planPrice: { fontFamily: fonts.heavy, fontSize: 22, color: colors.textOnInk },
  planPerDay: { ...type.caption, color: colors.textOnInkMuted },
  planCta: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: spacing.lg, height: 40, alignItems: 'center', justifyContent: 'center' },
  planCtaText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textInverse },
  planFeatures: { gap: 6, marginTop: spacing.md },
  planFeature: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planFeatureText: { ...type.small, color: colors.textOnInk, flex: 1 },
});
