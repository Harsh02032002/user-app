/**
 * Product cards shared across Home, All Menus, Search, Restaurant, Wishlist and subscription screens.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl } from '../config/api';
import { colors, elevation, formatPrice, radius, spacing, type } from '../theme';
import { AddToCartButton, Badge, Rating, VegIndicator } from './common';

const isHomeChef = (t?: string) => t === 'home_chef' || t === 'home-chef';

/** Neutral image placeholder — never substitute unrelated stock photos for a seller's own images */
const ImageFallback: React.FC<{ icon: React.ComponentProps<typeof Ionicons>['name']; style?: StyleProp<ViewStyle> }> = ({ icon, style }) => (
  <View style={[styles.fallback, style]}>
    <Ionicons name={icon} size={28} color={colors.primaryBorder} />
  </View>
);

/** Remote image that falls back to a neutral placeholder when missing or when it fails to load */
const SmartImage: React.FC<{ uri?: string | null; icon: React.ComponentProps<typeof Ionicons>['name']; style?: StyleProp<ImageStyle | ViewStyle> }> = ({ uri, icon, style }) => {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [uri]);
  if (!uri || failed) return <ImageFallback icon={icon} style={style as StyleProp<ViewStyle>} />;
  return <Image source={{ uri }} style={style as any} contentFit="cover" transition={150} onError={() => setFailed(true)} />;
};

export const SellerTypeBadge: React.FC<{ sellerType?: string; style?: StyleProp<ViewStyle> }> = ({ sellerType, style }) => (
  <Badge
    text={isHomeChef(sellerType) ? 'Home Chef' : 'Restaurant'}
    icon={isHomeChef(sellerType) ? 'home' : 'restaurant'}
    variant={isHomeChef(sellerType) ? 'success' : 'primary'}
    style={style}
  />
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
  distanceKm?: number | null;
  address?: { city?: string; area?: string; street?: string };
}

export const SellerCard: React.FC<{
  seller: SellerCardData;
  onPress: () => void;
  width?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ seller, onPress, width, style }) => {
  const cover = getImageUrl(seller.coverImage || seller.image);
  const logo = getImageUrl(seller.logo);
  const meta = [
    seller.distanceKm != null ? `${seller.distanceKm} km` : null,
    seller.address?.city || seller.address?.area || null,
  ].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity
      style={[styles.sellerCard, width ? { width } : null, style]}
      activeOpacity={0.9}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${seller.businessName}, ${isHomeChef(seller.type) ? 'Home Chef' : 'Restaurant'}`}
    >
      <View style={styles.sellerCover}>
        <SmartImage uri={cover} icon="restaurant-outline" style={StyleSheet.absoluteFill} />
        <SellerTypeBadge sellerType={seller.type} style={styles.sellerTypeBadge} />
      </View>
      <View style={styles.sellerBody}>
        <View style={styles.sellerLogoWrap}>
          <SmartImage uri={logo} icon="storefront-outline" style={styles.sellerLogo} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.subheading} numberOfLines={1}>{seller.businessName}</Text>
          <Text style={type.caption} numberOfLines={1}>
            {seller.cuisines && seller.cuisines.length ? seller.cuisines.join(', ') : isHomeChef(seller.type) ? 'Home-cooked meals' : 'Multi-cuisine'}
          </Text>
          <View style={styles.sellerMeta}>
            {seller.rating ? <Rating rating={seller.rating} size={12} /> : <Text style={[type.caption, { color: colors.successStrong }]}>New</Text>}
            {meta ? <Text style={type.caption} numberOfLines={1}>  ·  {meta}</Text> : null}
          </View>
        </View>
      </View>
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

/** Vertical card for carousels and grids */
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
  const { final, strike, discountPercent } = getFoodPricing(item);
  const img = getImageUrl(item.image);
  const sellerName = typeof item.sellerId === 'object' ? item.sellerId?.businessName : undefined;
  const unavailable = item.isAvailable === false;
  return (
    <TouchableOpacity
      style={[styles.foodCard, width ? { width } : null, style]}
      activeOpacity={0.9}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${formatPrice(final)}`}
    >
      <View style={styles.foodImage}>
        <SmartImage uri={img} icon="fast-food-outline" style={StyleSheet.absoluteFill} />
        {discountPercent > 0 ? <Badge text={`${discountPercent}% OFF`} variant="success" style={styles.discountBadge} /> : null}
      </View>
      <View style={styles.foodBody}>
        <View style={styles.foodTitleRow}>
          <VegIndicator isVeg={!!item.isVeg} size={12} />
          <Text style={[type.subheading, { flex: 1 }]} numberOfLines={1}>{item.name}</Text>
        </View>
        {showSeller && sellerName ? <Text style={type.caption} numberOfLines={1}>{sellerName}</Text> : null}
        <View style={styles.foodMeta}>
          {item.rating ? <Rating rating={item.rating} size={12} /> : null}
          {item.preparationTime ? (
            <View style={styles.inlineMeta}>
              <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
              <Text style={type.caption}>{item.preparationTime} min</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.foodFooter}>
          <View>
            <Text style={type.price}>{formatPrice(final)}</Text>
            {strike ? <Text style={styles.strike}>{formatPrice(strike)}</Text> : null}
          </View>
          <AddToCartButton quantity={quantity} onAdd={onAdd} onIncrement={onIncrement} onDecrement={onDecrement} disabled={unavailable} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

/** Horizontal menu row (restaurant menu, wishlist) — image on the right like most food apps */
export const FoodRow: React.FC<{
  item: FoodItemData;
  quantity: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  right?: React.ReactNode;
}> = ({ item, quantity, onAdd, onIncrement, onDecrement, right }) => {
  const { final, strike } = getFoodPricing(item);
  const img = getImageUrl(item.image);
  const unavailable = item.isAvailable === false;
  return (
    <View style={[styles.foodRow, unavailable && { opacity: 0.6 }]}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <VegIndicator isVeg={!!item.isVeg} size={12} />
        <Text style={[type.subheading, { marginTop: spacing.xs }]} numberOfLines={2}>{item.name}</Text>
        <View style={styles.rowPrice}>
          <Text style={type.price}>{formatPrice(final)}</Text>
          {strike ? <Text style={styles.strike}>{formatPrice(strike)}</Text> : null}
        </View>
        {item.rating ? <Rating rating={item.rating} size={12} /> : null}
        {item.description ? <Text style={[type.caption, { marginTop: spacing.xs }]} numberOfLines={2}>{item.description}</Text> : null}
        {right}
      </View>
      <View style={styles.rowImageCol}>
        <View style={styles.rowImage}>
          <SmartImage uri={img} icon="fast-food-outline" style={StyleSheet.absoluteFill} />
        </View>
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

export const getPlanImage = (plan: PlanCardData) => {
  let imgPath = plan.banner_image || plan.image || plan.plan_image;
  if (!imgPath) {
    const file = plan.total_days <= 7 ? 'weekly.png' : plan.total_days <= 14 ? 'fortnightly.png' : 'monthly.png';
    imgPath = `/uploads/subscriptions/${file}`;
  }
  return getImageUrl(imgPath);
};

export const PlanCard: React.FC<{
  plan: PlanCardData;
  onPress: () => void;
  onSubscribe?: () => void;
  width?: number;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ plan, onPress, onSubscribe, width, compact, style }) => {
  const perDay = plan.per_day_value || (plan.total_days ? Math.round(plan.total_amount / plan.total_days) : 0);
  const img = getPlanImage(plan);
  return (
    <TouchableOpacity style={[styles.planCard, width ? { width } : null, style]} activeOpacity={0.9} onPress={onPress} accessibilityRole="button">
      <View style={styles.planImage}>
        <SmartImage uri={img} icon="calendar-outline" style={StyleSheet.absoluteFill} />
        {plan.badge ? <Badge text={plan.badge} variant="primary" style={styles.planBadge} /> : null}
      </View>
      <View style={styles.planBody}>
        <Text style={type.subheading} numberOfLines={1}>{plan.plan_name}</Text>
        {plan.description ? <Text style={type.caption} numberOfLines={compact ? 1 : 2}>{plan.description}</Text> : null}
        <View style={styles.planPriceRow}>
          <Text style={[type.price, { fontSize: 18 }]}>{formatPrice(plan.total_amount)}</Text>
          <Text style={type.caption}>  for {plan.total_days} days</Text>
        </View>
        {perDay ? <Text style={[type.caption, { color: colors.successStrong }]}>{formatPrice(perDay)} per day</Text> : null}
        {!compact && plan.features && plan.features.length ? (
          <View style={styles.planFeatures}>
            {plan.features.slice(0, 3).map((f, i) => (
              <View key={i} style={styles.planFeature}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={[type.caption, { color: colors.text, flex: 1 }]} numberOfLines={1}>{f}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {onSubscribe ? (
          <View style={styles.planActions}>
            <TouchableOpacity style={styles.planSecondary} onPress={onPress}>
              <Text style={[type.label, { color: colors.primary }]}>View details</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.planPrimary} onPress={onSubscribe}>
              <Text style={[type.label, { color: colors.textInverse }]}>Subscribe</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },

  sellerCard: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...elevation.card },
  sellerCover: { aspectRatio: 2, backgroundColor: colors.surfaceMuted },
  sellerTypeBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  sellerBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  sellerLogoWrap: { marginTop: -spacing.xxl, borderRadius: radius.md, borderWidth: 2, borderColor: colors.surface, backgroundColor: colors.surface, ...elevation.card },
  sellerLogo: { width: 48, height: 48, borderRadius: radius.md - 2, overflow: 'hidden' },
  sellerMeta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },

  foodCard: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...elevation.card },
  foodImage: { aspectRatio: 4 / 3, backgroundColor: colors.surfaceMuted },
  discountBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  foodBody: { padding: spacing.md, gap: 4 },
  foodTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  foodMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 16 },
  inlineMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  foodFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  strike: { ...type.caption, color: colors.textTertiary, textDecorationLine: 'line-through' },

  foodRow: { flexDirection: 'row', paddingVertical: spacing.lg },
  rowPrice: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginVertical: spacing.xs },
  rowImageCol: { width: 112, alignItems: 'center' },
  rowImage: { width: 112, height: 104, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  rowAdd: { marginTop: -16, ...elevation.card, borderRadius: radius.sm, backgroundColor: colors.surface },

  planCard: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...elevation.card },
  planImage: { aspectRatio: 2.2, backgroundColor: colors.primarySoft },
  planBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  planBody: { padding: spacing.md, gap: 4 },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xs },
  planFeatures: { gap: 4, marginTop: spacing.sm },
  planFeature: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  planSecondary: { flex: 1, height: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  planPrimary: { flex: 1, height: 40, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
