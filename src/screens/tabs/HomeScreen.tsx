import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { api } from '../../services/api';
import { LOCATION_COORDS_KEY, LOCATION_NAME_KEY } from '../../utils/location';
import { AppHeader } from '../../components/common/AppHeader';
import { TAB_BAR_HEIGHT } from '../../components/common/MobileNavBar';
import { Button, EmptyState, ErrorState, Skeleton } from '../../components/common';
import { FoodCard, SellerCard, FoodItemData, SellerCardData } from '../../components/cards';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { SERVICE_RADIUS_KM } from '../../config/serviceArea';
import { colors, fonts, formatPrice, mealOfTheDay, radius, spacing, type } from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type SellerFilter = 'all' | 'home_chef' | 'restaurant';

interface PlanSummary {
  _id: string;
  plan_name: string;
  total_amount: number;
  total_days: number;
  per_day_value?: number;
}

const FILTERS: { key: SellerFilter; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'all', label: 'All', icon: 'grid-outline' },
  { key: 'home_chef', label: 'Home kitchens', icon: 'home-outline' },
  { key: 'restaurant', label: 'Restaurants', icon: 'restaurant-outline' },
];

const isHomeChef = (t?: string) => t === 'home_chef' || t === 'home-chef';
const VEG_ONLY_KEY = 'preferredVegOnly';

export function HomeScreen() {
  const { user } = useAuth();
  const { addToCart, getItemQuantity, updateQuantity } = useCart();
  const navigation = useNavigation<NavigationProp>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedTypeState] = useState<SellerFilter>('all');
  const [vegOnly, setVegOnlyState] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState('');
  const [locationUnavailable, setLocationUnavailable] = useState(false);

  const [allSellers, setAllSellers] = useState<SellerCardData[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<FoodItemData[]>([]);
  const [plans, setPlans] = useState<PlanSummary[]>([]);

  const meal = mealOfTheDay();
  const firstName = (user?.name || '').trim().split(/\s+/)[0];

  // ── Preferences ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [savedType, savedVeg] = await Promise.all([
          AsyncStorage.getItem('preferredFoodType'),
          AsyncStorage.getItem(VEG_ONLY_KEY),
        ]);
        if (savedType === 'home_chef' || savedType === 'restaurant' || savedType === 'all') setSelectedTypeState(savedType);
        if (savedVeg === 'true') setVegOnlyState(true);
      } catch { /* defaults */ }
    })();
  }, []);

  const setSelectedType = (t: SellerFilter) => {
    setSelectedTypeState(t);
    AsyncStorage.setItem('preferredFoodType', t).catch(() => {});
  };
  const toggleVeg = () => {
    setVegOnlyState((v) => {
      AsyncStorage.setItem(VEG_ONLY_KEY, String(!v)).catch(() => {});
      return !v;
    });
  };

  // ── Location ────────────────────────────────────────────────────────
  const loadLocation = React.useCallback(async () => {
    try {
      setLocationUnavailable(false);
      const [savedCoords, savedName] = await Promise.all([
        AsyncStorage.getItem(LOCATION_COORDS_KEY),
        AsyncStorage.getItem(LOCATION_NAME_KEY),
      ]);
      if (savedCoords) {
        const parsed = JSON.parse(savedCoords);
        if (Number.isFinite(parsed?.lat) && Number.isFinite(parsed?.lng)) {
          setUserLocation({ lat: parsed.lat, lng: parsed.lng });
          setLocationName(savedName || '');
          return;
        }
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationUnavailable(true);
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setUserLocation({ lat, lng });
      await AsyncStorage.setItem(LOCATION_COORDS_KEY, JSON.stringify({ lat, lng }));
      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }).catch(() => []);
      const name = geo[0] ? [geo[0].district || geo[0].subregion, geo[0].city].filter(Boolean).join(', ') : '';
      setLocationName(name);
      if (name) await AsyncStorage.setItem(LOCATION_NAME_KEY, name);
    } catch {
      setLocationUnavailable(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLocation(); }, [loadLocation]);

  // ── Data ────────────────────────────────────────────────────────────
  const fetchData = React.useCallback(async () => {
    if (!userLocation) return;
    try {
      setError(null);
      const { lat, lng } = userLocation;
      // The backend applies the seller-approval and 21 km rules; the app never sends its own radius
      const sellersRes: any = await api.user.getNearbySellers({ lat, lng, city: locationName }).catch(() => ({ sellers: [] }));
      const sellers: SellerCardData[] = sellersRes?.sellers || [];
      setAllSellers(sellers);

      if (sellers.length) {
        const menuRes: any = await api.user.getMenuItems({ sellerIds: sellers.map((s) => s._id).join(','), lat, lng, city: locationName }).catch(() => null);
        setAllMenuItems(menuRes?.products || (Array.isArray(menuRes) ? menuRes : []));
      } else {
        setAllMenuItems([]);
      }

      const plansRes: any = await api.user.getSubscriptionPlans().catch(() => []);
      setPlans(plansRes?.plans || (Array.isArray(plansRes) ? plansRes : []));
    } catch (err: any) {
      setError(err?.message || 'Could not load kitchens');
    } finally {
      setLoading(false);
    }
  }, [userLocation, locationName]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ── Derived ─────────────────────────────────────────────────────────
  const sellers = React.useMemo(
    () => (selectedType === 'all' ? allSellers : allSellers.filter((s) => (selectedType === 'home_chef' ? isHomeChef(s.type) : s.type === selectedType))),
    [allSellers, selectedType],
  );
  const sellerIds = React.useMemo(() => new Set(sellers.map((s) => s._id)), [sellers]);
  const dishes = React.useMemo(
    () =>
      allMenuItems.filter((item) => {
        const sid = typeof item.sellerId === 'object' ? item.sellerId?._id : item.sellerId;
        if (sid && !sellerIds.has(sid)) return false;
        if (vegOnly && !item.isVeg) return false;
        return true;
      }),
    [allMenuItems, sellerIds, vegOnly],
  );
  const cheapestPerDay = React.useMemo(() => {
    const values = plans
      .map((p) => p.per_day_value || (p.total_days ? p.total_amount / p.total_days : 0))
      .filter((v) => v > 0);
    return values.length ? Math.round(Math.min(...values)) : null;
  }, [plans]);

  // ── Cart ────────────────────────────────────────────────────────────
  const addDish = (item: FoodItemData) => {
    const seller = typeof item.sellerId === 'object' ? item.sellerId : allSellers.find((s) => s._id === item.sellerId);
    addToCart({
      id: item._id,
      name: item.name,
      price: item.sellingPrice || item.price || 0,
      discountPrice: item.discountPrice,
      image: item.image,
      sellerId: seller?._id || item.sellerId,
      sellerName: seller?.businessName,
      isVeg: !!item.isVeg,
      description: item.description,
    } as any);
  };
  const openSeller = (sellerId: string, sellerName?: string) => navigation.navigate('Restaurant', { sellerId, sellerName } as any);

  // ── Render ──────────────────────────────────────────────────────────
  const renderBody = () => {
    if (locationUnavailable) {
      return (
        <EmptyState
          icon="location-outline"
          title="Where should we deliver?"
          subtitle={`Allow location access so we can show home kitchens within ${SERVICE_RADIUS_KM} km of you.`}
          actionText="Use my location"
          onAction={loadLocation}
        />
      );
    }
    if (loading) return <HomeSkeleton />;
    if (error) return <ErrorState message={error} onRetry={fetchData} />;
    if (!allSellers.length) {
      return (
        <EmptyState
          icon="storefront-outline"
          title="No kitchens deliver here yet"
          subtitle={`We couldn't find an open kitchen within ${SERVICE_RADIUS_KM} km${locationName ? ` of ${locationName}` : ''}. We're adding new cooks every week.`}
          actionText="Change location"
          onAction={() => navigation.navigate('Landing' as any)}
        />
      );
    }

    return (
      <>
        {plans.length ? (
          <TouchableOpacity style={styles.planStrip} activeOpacity={0.9} onPress={() => navigation.navigate('AllPlans' as any)} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={styles.planStripOverline}>DABBA TIFFIN PLANS</Text>
              <Text style={styles.planStripTitle}>
                Ghar ka khana, every day{cheapestPerDay ? ` from ${formatPrice(cheapestPerDay)}/day` : ''}
              </Text>
            </View>
            <View style={styles.planStripArrow}>
              <Ionicons name="arrow-forward" size={18} color={colors.inkSurface} />
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={styles.sectionHead}>
          <View style={{ flex: 1 }}>
            <Text style={type.title}>On the menu</Text>
            <Text style={type.caption}>{dishes.length ? `${dishes.length} dishes${vegOnly ? ' · veg only' : ''}` : 'Nothing matches these filters'}</Text>
          </View>
          {dishes.length ? (
            <TouchableOpacity onPress={() => navigation.navigate('AllMenus' as any)} hitSlop={10} accessibilityRole="button">
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {dishes.length ? (
          <FlatList
            horizontal
            data={dishes.slice(0, 12)}
            keyExtractor={(d) => d._id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
            renderItem={({ item }) => {
              const sid = typeof item.sellerId === 'object' ? item.sellerId?._id : item.sellerId;
              return (
                <FoodCard
                  item={item}
                  width={176}
                  quantity={getItemQuantity(item._id)}
                  onAdd={() => addDish(item)}
                  onIncrement={() => updateQuantity(item._id, getItemQuantity(item._id) + 1)}
                  onDecrement={() => updateQuantity(item._id, getItemQuantity(item._id) - 1)}
                  onPress={sid ? () => openSeller(sid) : undefined}
                />
              );
            }}
          />
        ) : (
          <Text style={[type.small, styles.inlineEmpty]}>
            {vegOnly ? 'No vegetarian dishes from these kitchens right now.' : 'These kitchens haven’t published dishes yet.'}
          </Text>
        )}

        <View style={styles.sectionHead}>
          <View style={{ flex: 1 }}>
            <Text style={type.title}>Kitchens near you</Text>
            <Text style={type.caption}>
              {sellers.length} {sellers.length === 1 ? 'kitchen' : 'kitchens'} within {SERVICE_RADIUS_KM} km{locationName ? ` of ${locationName}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.kitchens}>
          {sellers.length ? (
            sellers.map((s) => <SellerCard key={s._id} seller={s} onPress={() => openSeller(s._id, s.businessName)} />)
          ) : (
            <Text style={[type.small, styles.inlineEmpty, { paddingHorizontal: 0 }]}>No {selectedType === 'home_chef' ? 'home kitchens' : 'restaurants'} nearby yet.</Text>
          )}
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader showSearch={false} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <View style={styles.hero}>
          <Text style={type.display}>
            {meal.greeting}
            {firstName ? `, ${firstName}` : ''}
          </Text>
          <Text style={[type.body, { color: colors.textSecondary, marginTop: 2 }]}>{meal.prompt}</Text>
        </View>

        <TouchableOpacity style={styles.search} activeOpacity={0.85} onPress={() => navigation.navigate('Search' as any)} accessibilityRole="search" accessibilityLabel="Search dishes and kitchens">
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <Text style={styles.searchText}>Search dal, thali, paratha…</Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => {
            const active = f.key === selectedType;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setSelectedType(f.key)}
                style={[styles.filter, active && styles.filterActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={f.icon} size={14} color={active ? colors.textInverse : colors.text} />
                <Text style={[styles.filterText, active && { color: colors.textInverse }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={toggleVeg}
            style={[styles.filter, vegOnly && styles.vegActive]}
            accessibilityRole="switch"
            accessibilityState={{ checked: vegOnly }}
            accessibilityLabel="Veg only"
          >
            <View style={[styles.vegSquare, { borderColor: colors.veg }]}>
              <View style={styles.vegDot} />
            </View>
            <Text style={[styles.filterText, vegOnly && { color: colors.successStrong }]}>Veg only</Text>
          </TouchableOpacity>
        </ScrollView>

        {renderBody()}
      </ScrollView>
    </SafeAreaView>
  );
}

const HomeSkeleton = () => (
  <View style={{ paddingHorizontal: spacing.screen, gap: spacing.lg, marginTop: spacing.lg }}>
    <Skeleton height={76} radius={radius.xl} />
    <Skeleton width="45%" height={22} />
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Skeleton width={176} height={240} radius={radius.xl} />
      <Skeleton width={176} height={240} radius={radius.xl} />
    </View>
    <Skeleton width="55%" height={22} />
    <Skeleton height={86} radius={radius.xl} />
    <Skeleton height={86} radius={radius.xl} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  hero: { paddingHorizontal: spacing.screen, paddingTop: spacing.md },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.screen, marginTop: spacing.lg, height: 50, paddingHorizontal: spacing.lg,
    borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  searchText: { ...type.body, color: colors.textTertiary },
  filters: { gap: spacing.sm, paddingHorizontal: spacing.screen, paddingVertical: spacing.lg },
  filter: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  filterActive: { backgroundColor: colors.text, borderColor: colors.text },
  vegActive: { backgroundColor: colors.successSoft, borderColor: colors.success },
  filterText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  vegSquare: { width: 13, height: 13, borderWidth: 1.5, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.veg },

  planStrip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.screen,
    padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.inkSurface,
  },
  planStripOverline: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.4, color: colors.primary },
  planStripTitle: { fontFamily: fonts.display, fontSize: 17, lineHeight: 23, color: colors.textOnInk, marginTop: 4 },
  planStripArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.screen, marginTop: spacing.xxl, marginBottom: spacing.md },
  seeAll: { ...type.label, color: colors.primaryInk },
  carousel: { gap: spacing.md, paddingHorizontal: spacing.screen },
  kitchens: { gap: spacing.md, paddingHorizontal: spacing.screen },
  inlineEmpty: { color: colors.textSecondary, paddingHorizontal: spacing.screen },
});

export default HomeScreen;
