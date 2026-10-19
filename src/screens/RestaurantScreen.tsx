import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCart, getCartUnitPrice } from '../context/CartContext';
import { api } from '../services/api';
import { RootStackParamList } from '../navigation/RootNavigator';
import { LOCATION_COORDS_KEY } from '../utils/location';
import { SERVICE_RADIUS_KM } from '../config/serviceArea';
import { EmptyState, ErrorState, IconButton, Notice, Skeleton } from '../components/common';
import { FoodRow, FoodItemData, KitchenMark, SellerTypeBadge, formatDistance, realImageUrl } from '../components/cards';
import { colors, fonts, formatPrice, radius, spacing, type } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'Restaurant'>;

interface SellerDetails {
  _id: string;
  shopName?: string;
  businessName?: string;
  description?: string;
  logo?: string;
  coverImage?: string;
  image?: string;
  rating?: number;
  totalOrders?: number;
  cuisines?: string[];
  cuisine?: string;
  type?: string;
  address?: { area?: string; city?: string; street?: string; fullAddress?: string } | string;
}

const addressLine = (address?: SellerDetails['address']) => {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return address.city || address.area || '';
};

export default function RestaurantScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const insets = useSafeAreaInsets();
  const { sellerId, sellerName } = route.params as { sellerId: string; sellerName?: string };
  const { items, totalItems, addToCart, updateQuantity } = useCart();

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [seller, setSeller] = useState<SellerDetails | null>(null);
  const [menu, setMenu] = useState<FoodItemData[]>([]);
  const [category, setCategory] = useState('All');
  const [vegOnly, setVegOnly] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [notServiceable, setNotServiceable] = useState(false);
  const [scrolledPastTitle, setScrolledPastTitle] = useState(false);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      const [sellerRes, menuRes]: any[] = await Promise.all([
        api.user.getSellerById(sellerId),
        api.user.getMenuItems(sellerId),
      ]);
      setSeller(sellerRes?.seller || sellerRes);
      setMenu(menuRes?.products || []);

      const savedCoords = await AsyncStorage.getItem(LOCATION_COORDS_KEY);
      const parsed = savedCoords ? JSON.parse(savedCoords) : null;
      if (parsed?.lat && parsed?.lng) {
        const feeRes: any = await api.user.calculateDeliveryFee({ sellerId, customerLng: parsed.lng, customerLat: parsed.lat }).catch(() => null);
        if (feeRes?.success) {
          setDistanceKm(feeRes.distanceKm);
          setNotServiceable(feeRes.serviceable === false || (feeRes.distanceKm != null && feeRes.distanceKm > SERVICE_RADIUS_KM));
        }
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const visibleMenu = useMemo(() => menu.filter((m) => !vegOnly || m.isVeg), [menu, vegOnly]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(visibleMenu.map((m) => m.category || 'Other')))], [visibleMenu]);
  const sections = useMemo(() => {
    const list = category === 'All' ? visibleMenu : visibleMenu.filter((m) => (m.category || 'Other') === category);
    const groups = new Map<string, FoodItemData[]>();
    list.forEach((m) => {
      const key = m.category || 'Other';
      groups.set(key, [...(groups.get(key) || []), m]);
    });
    return Array.from(groups.entries());
  }, [visibleMenu, category]);

  const quantityOf = (id: string) => items.find((i) => i.id === id)?.quantity || 0;
  const cartForThisKitchen = items.filter((i) => String(i.sellerId) === String(sellerId));
  const kitchenTotal = cartForThisKitchen.reduce((sum, i) => sum + getCartUnitPrice(i) * i.quantity, 0);
  const kitchenCount = cartForThisKitchen.reduce((n, i) => n + i.quantity, 0);

  const add = (item: FoodItemData) => {
    if (notServiceable) {
      Alert.alert('Outside delivery range', `This kitchen is ${distanceKm} km away. We deliver within ${SERVICE_RADIUS_KM} km of your location.`);
      return;
    }
    addToCart({
      id: item._id,
      name: item.name,
      price: item.sellingPrice || item.price || 0,
      discountPrice: item.discountPrice,
      image: item.image || '',
      sellerId,
      sellerName: seller?.businessName || seller?.shopName || sellerName,
      isVeg: !!item.isVeg,
      description: item.description,
    } as any);
  };

  const name = seller?.shopName || seller?.businessName || sellerName || 'Kitchen';
  const cover = realImageUrl(seller?.coverImage || seller?.image);
  const cuisines = seller?.cuisines?.length ? seller.cuisines.join(' · ') : seller?.cuisine;

  if (loading && !seller) return <RestaurantSkeleton top={insets.top} />;
  if (failed && !seller) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <IconButton icon="arrow-back" accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={{ margin: spacing.sm }} />
        <ErrorState title="Couldn't open this kitchen" onRetry={fetchData} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top }, scrolledPastTitle && styles.topBarSolid]}>
        <IconButton icon="arrow-back" accessibilityLabel="Go back" variant="filled" size={20} onPress={() => navigation.goBack()} />
        <Text style={[styles.topBarTitle, { opacity: scrolledPastTitle ? 1 : 0 }]} numberOfLines={1}>{name}</Text>
        <IconButton icon="search" accessibilityLabel="Search dishes" variant="filled" size={18} onPress={() => navigation.navigate('Search' as any)} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: kitchenCount ? 120 : 48 }}
        stickyHeaderIndices={[2]}
        scrollEventThrottle={32}
        onScroll={(e) => setScrolledPastTitle(e.nativeEvent.contentOffset.y > (cover ? 260 : 110))}
      >
        {/* 0: kitchen cover photo, when the kitchen uploaded one */}
        {cover ? <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" /> : <View style={{ height: spacing.xs }} />}

        {/* 1: kitchen identity */}
        <View style={[styles.identity, cover && styles.identityOverCover]}>
          <KitchenMark name={name} logo={seller?.logo} size={72} />
          <Text style={[type.display, { marginTop: spacing.md }]} accessibilityRole="header">{name}</Text>
          <View style={styles.identityTags}>
            <SellerTypeBadge sellerType={seller?.type} />
            {cuisines ? <Text style={type.caption} numberOfLines={1}>· {cuisines}</Text> : null}
          </View>
          {seller?.description ? <Text style={[type.body, styles.description]}>{seller.description}</Text> : null}

          <View style={styles.stats}>
            <Stat
              value={seller?.rating ? Number(seller.rating).toFixed(1) : 'New'}
              label={seller?.rating ? (seller.totalOrders ? `${seller.totalOrders}+ orders` : 'Rating') : 'No ratings yet'}
              icon={seller?.rating ? 'star' : undefined}
            />
            <View style={styles.statDivider} />
            <Stat value={distanceKm != null ? formatDistance(distanceKm) : '—'} label="From you" />
            <View style={styles.statDivider} />
            <Stat value={addressLine(seller?.address) || '—'} label="Kitchen in" />
          </View>

          {notServiceable ? (
            <Notice
              tone="danger"
              title="Outside our delivery range"
              message={`This kitchen is ${distanceKm} km from your delivery address. We deliver within ${SERVICE_RADIUS_KM} km.`}
              style={{ marginTop: spacing.lg }}
            />
          ) : null}
        </View>

        {/* 2: sticky category bar */}
        <View style={styles.menuBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuBarContent}>
            <TouchableOpacity
              onPress={() => setVegOnly((v) => !v)}
              style={[styles.pill, vegOnly && styles.vegPillActive]}
              accessibilityRole="switch"
              accessibilityState={{ checked: vegOnly }}
            >
              <View style={styles.vegSquare}><View style={styles.vegDot} /></View>
              <Text style={[styles.pillText, vegOnly && { color: colors.successStrong }]}>Veg</Text>
            </TouchableOpacity>
            {categories.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.pill, category === c && styles.pillActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: category === c }}
              >
                <Text style={[styles.pillText, category === c && { color: colors.textInverse }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 3: menu */}
        <View style={styles.menu}>
          {sections.length === 0 ? (
            <EmptyState
              icon="restaurant-outline"
              title={menu.length ? 'Nothing matches' : 'Menu coming soon'}
              subtitle={menu.length ? 'Try turning off the veg filter.' : 'This kitchen hasn’t published dishes yet.'}
            />
          ) : (
            sections.map(([title, dishes]) => (
              <View key={title}>
                <View style={styles.sectionTitleRow}>
                  <Text style={type.title}>{title}</Text>
                  <Text style={type.caption}>{dishes.length}</Text>
                </View>
                {dishes.map((item, i) => (
                  <View key={item._id}>
                    {i > 0 ? <View style={styles.rowDivider} /> : null}
                    <FoodRow
                      item={item}
                      quantity={quantityOf(item._id)}
                      onAdd={() => add(item)}
                      onIncrement={() => updateQuantity(item._id, quantityOf(item._id) + 1)}
                      onDecrement={() => updateQuantity(item._id, quantityOf(item._id) - 1)}
                    />
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {kitchenCount > 0 ? (
        <View style={[styles.cartBarWrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <TouchableOpacity style={styles.cartBar} activeOpacity={0.9} onPress={() => navigation.navigate('Cart' as any)} accessibilityRole="button" accessibilityLabel={`View cart, ${kitchenCount} items, ${formatPrice(kitchenTotal)}`}>
            <View>
              <Text style={styles.cartBarCount}>{kitchenCount} {kitchenCount === 1 ? 'item' : 'items'}{totalItems > kitchenCount ? ' (+ other kitchen)' : ''}</Text>
              <Text style={styles.cartBarTotal}>{formatPrice(kitchenTotal)}</Text>
            </View>
            <View style={styles.cartBarAction}>
              <Text style={styles.cartBarActionText}>View cart</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.textInverse} />
            </View>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const Stat: React.FC<{ value: string; label: string; icon?: React.ComponentProps<typeof Ionicons>['name'] }> = ({ value, label, icon }) => (
  <View style={styles.stat}>
    <View style={styles.statValueRow}>
      {icon ? <Ionicons name={icon} size={13} color={colors.rating} /> : null}
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
    <Text style={type.caption} numberOfLines={1}>{label}</Text>
  </View>
);

const RestaurantSkeleton = ({ top }: { top: number }) => (
  <View style={[styles.container, { paddingTop: top + 64, paddingHorizontal: spacing.screen, gap: spacing.md }]}>
    <Skeleton width={72} height={72} radius={20} />
    <Skeleton width="70%" height={28} />
    <Skeleton width="45%" height={14} />
    <Skeleton height={64} radius={radius.lg} style={{ marginTop: spacing.md }} />
    <Skeleton height={120} radius={radius.lg} style={{ marginTop: spacing.lg }} />
    <Skeleton height={120} radius={radius.lg} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  cover: { width: '100%', height: 200, backgroundColor: colors.surfaceMuted },
  identity: { paddingHorizontal: spacing.screen, paddingBottom: spacing.lg },
  identityOverCover: { marginTop: -36 },
  identityTags: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  description: { color: colors.textSecondary, marginTop: spacing.md },
  stats: {
    flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, paddingVertical: spacing.md,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { fontFamily: fonts.heavy, fontSize: 15, color: colors.text },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },

  menuBar: { backgroundColor: colors.canvas, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuBarContent: { gap: spacing.sm, paddingHorizontal: spacing.screen, paddingVertical: spacing.md },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: spacing.md,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.text, borderColor: colors.text },
  vegPillActive: { backgroundColor: colors.successSoft, borderColor: colors.success },
  pillText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  vegSquare: { width: 12, height: 12, borderWidth: 1.5, borderColor: colors.veg, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.veg },

  menu: { paddingHorizontal: spacing.screen },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.xs },
  rowDivider: { height: 1, backgroundColor: colors.divider },

  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    backgroundColor: colors.canvas, borderBottomWidth: 1, borderBottomColor: 'transparent',
  },
  topBarSolid: { borderBottomColor: colors.border },
  topBarTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, color: colors.text },

  cartBarWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.screen, paddingTop: spacing.sm },
  cartBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.inkSurface, borderRadius: 18, paddingHorizontal: spacing.lg, height: 64,
  },
  cartBarCount: { ...type.caption, color: colors.textOnInkMuted },
  cartBarTotal: { fontFamily: fonts.heavy, fontSize: 17, color: colors.textOnInk },
  cartBarAction: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: spacing.lg, height: 42 },
  cartBarActionText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textInverse },
});
