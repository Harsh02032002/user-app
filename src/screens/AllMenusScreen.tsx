import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { LOCATION_COORDS_KEY, LOCATION_NAME_KEY } from '../utils/location';
import { useCart } from '../context/CartContext';
import { EmptyState, ErrorState, ScreenHeader, Skeleton } from '../components/common';
import { FoodCard } from '../components/cards';
import { colors, radius, spacing } from '../theme';

export default function AllMenusScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const { addToCart, getItemQuantity, updateQuantity } = useCart();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState('');
  const [locationReady, setLocationReady] = useState(false);

  const columnWidth = (Math.min(width, 600) - spacing.screen * 2 - spacing.md) / 2;

  // Get user's location on mount
  useEffect(() => {
    getUserLocation();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch items when search or location changes (only after location is resolved,
  // otherwise we'd briefly show menus from every city)
  useEffect(() => {
    if (!locationReady) return;
    fetchItems();
  }, [debouncedSearch, userLocation, locationReady]);

  const getUserLocation = async () => {
    try {
      // 1. Same "Deliver to" location the Home screen uses
      const savedCoords = await AsyncStorage.getItem(LOCATION_COORDS_KEY);
      const savedName = await AsyncStorage.getItem(LOCATION_NAME_KEY);
      if (savedCoords) {
        const parsed = JSON.parse(savedCoords);
        if (parsed?.lat && parsed?.lng) {
          setUserLocation({ lat: Number(parsed.lat), lng: Number(parsed.lng) });
          if (savedName) setLocationName(savedName);
          return;
        }
      }

      // 2. Fallback: device GPS
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      // Try last known location first (faster)
      let location = await Location.getLastKnownPositionAsync({});
      if (!location) {
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }
      if (location) {
        setUserLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
      }
    } catch (err) {
      console.error('Error getting location:', err);
    } finally {
      setLocationReady(true);
    }
  };

  const fetchItems = async () => {
    try {
      if (!userLocation?.lat || !userLocation?.lng) {
        setLoading(false);
        return;
      }
      setError(null);
      const params: any = {
        lat: userLocation.lat,
        lng: userLocation.lng,
        radius: 12000,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (locationName) params.city = locationName;

      const res = await api.user.getMenuItems(params);
      if (res.success) {
        setItems(res.products || []);
      }
    } catch (err: any) {
      console.error('Error fetching menu items:', err);
      setError('We could not load menus. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAddToCart = (item: any) => {
    const rawSeller = item.sellerId;
    const sellerId = (typeof rawSeller === 'object' ? rawSeller?._id : rawSeller) || '';
    const sellerName = (typeof rawSeller === 'object' ? rawSeller?.businessName : '') || 'Restaurant';
    addToCart({
      id: item._id,
      name: item.name,
      price: item.sellingPrice || item.price || 0,
      discountPrice: item.discountPrice,
      image: item.image,
      sellerId,
      sellerName,
      isVeg: item.isVeg || false,
      description: item.description,
    });
  };

  const openSeller = (item: any) => {
    const seller = typeof item.sellerId === 'object' ? item.sellerId : null;
    const id = seller?._id || item.sellerId;
    if (id) navigation.navigate('Restaurant', { sellerId: id, sellerName: seller?.businessName || '' });
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={{ width: columnWidth, gap: spacing.sm }}>
              <Skeleton height={columnWidth * 0.75} radius={radius.lg} />
              <Skeleton width="80%" />
              <Skeleton width="40%" />
            </View>
          ))}
        </View>
      );
    }
    if (locationReady && !userLocation) {
      return (
        <EmptyState
          icon="location-outline"
          title="Location needed"
          subtitle="Allow location access so we can show dishes from kitchens within 12 km."
          actionText="Use my location"
          onAction={() => { setLoading(true); setLocationReady(false); getUserLocation(); }}
        />
      );
    }
    if (error && items.length === 0) {
      return <ErrorState message={error} onRetry={() => { setLoading(true); fetchItems(); }} />;
    }
    return (
      <FlatList
        data={items}
        renderItem={({ item }) => {
          const qty = getItemQuantity(item._id);
          return (
            <FoodCard
              item={item}
              width={columnWidth}
              quantity={qty}
              onAdd={() => handleAddToCart(item)}
              onIncrement={() => updateQuantity(item._id, qty + 1)}
              onDecrement={() => updateQuantity(item._id, qty - 1)}
              onPress={() => openSeller(item)}
            />
          );
        }}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={styles.listContent}
        onRefresh={() => {
          setRefreshing(true);
          fetchItems();
        }}
        refreshing={refreshing}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            icon="restaurant-outline"
            title={debouncedSearch ? `No dishes match "${debouncedSearch}"` : 'No dishes nearby yet'}
            subtitle={debouncedSearch ? 'Try a different name.' : 'Kitchens within 12 km of you have not published dishes yet.'}
          />
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title="All menus" subtitle={locationName ? `Within 12 km of ${locationName}` : 'Within 12 km of you'} />
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search dishes"
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            accessibilityLabel="Search dishes"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  searchWrap: { paddingHorizontal: spacing.screen, paddingVertical: spacing.md, backgroundColor: colors.surface },
  searchBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  listContent: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxxl },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, padding: spacing.screen },
});
