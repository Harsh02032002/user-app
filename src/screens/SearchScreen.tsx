import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { API_ENDPOINTS, getImageUrl } from '../config/api';
import { RootStackParamList } from '../navigation/RootNavigator';
import { LOCATION_COORDS_KEY, LOCATION_NAME_KEY } from '../utils/location';
import { useCart } from '../context/CartContext';
import { AddToCartButton, Chip, Divider, EmptyState, ErrorState, IconButton, SkeletonList, VegIndicator } from '../components/common';
import { DishArt, getFoodPricing, realImageUrl } from '../components/cards';
import { colors, formatPrice, radius, spacing, type, fonts } from '../theme';
import { SERVICE_RADIUS_KM } from '../config/serviceArea';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const RECENT_KEY = 'recent_searches';
const MAX_RECENT = 8;
const SUGGESTIONS = ['Thali', 'Paratha', 'Paneer', 'Dal', 'Biryani', 'South Indian', 'Desserts'];

interface SearchResult {
  _id: string;
  name: string;
  description?: string;
  image?: string;
  price?: number;
  sellingPrice?: number;
  discountPrice?: number;
  isVeg?: boolean;
  isAvailable?: boolean;
  sellerId?: { _id: string; businessName?: string; type?: string } | string;
}

const sellerOf = (item: SearchResult) =>
  typeof item.sellerId === 'object' && item.sellerId ? item.sellerId : { _id: (item.sellerId as string) || '', businessName: '' };

export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const inputRef = useRef<TextInput>(null);
  const { addToCart, getItemQuantity, updateQuantity } = useCart();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    AsyncStorage.getItem(LOCATION_COORDS_KEY).then(savedCoords => {
      if (savedCoords) {
        try {
          const parsed = JSON.parse(savedCoords);
          if (parsed?.lat && parsed?.lng) {
            setUserLocation({ lat: Number(parsed.lat), lng: Number(parsed.lng) });
          }
        } catch (_) {}
      }
    });
    AsyncStorage.getItem(LOCATION_NAME_KEY).then(name => {
      if (name) setLocationName(name);
    });
    AsyncStorage.getItem(RECENT_KEY).then(saved => {
      try { if (saved) setRecentSearches(JSON.parse(saved)); } catch (_) {}
    });
    return () => clearTimeout(t);
  }, []);

  const rememberSearch = useCallback((term: string) => {
    const clean = term.trim();
    if (clean.length < 2) return;
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearRecent = () => {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
  };

  const searchItems = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_ENDPOINTS.SEARCH}?q=${encodeURIComponent(term)}`;
      if (userLocation?.lat && userLocation?.lng) {
        url += `&lat=${userLocation.lat}&lng=${userLocation.lng}`;
      }
      if (locationName) {
        url += `&city=${encodeURIComponent(locationName)}`;
      }
      const response = await api.get(url);
      setResults(response.data.data || response.data.products || []);
      setSearched(true);
    } catch (err: any) {
      console.error('Search error:', err);
      setError('We could not search right now. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [userLocation, locationName]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query.trim().length >= 2) {
        searchItems(query.trim());
      } else {
        setResults([]);
        setSearched(false);
        setError(null);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [query, searchItems]);

  const openSeller = (item: SearchResult) => {
    const seller = sellerOf(item);
    if (!seller._id) return;
    rememberSearch(query);
    Keyboard.dismiss();
    navigation.navigate('Restaurant', { sellerId: seller._id, sellerName: seller.businessName || '' });
  };

  const addItem = (item: SearchResult) => {
    const seller = sellerOf(item);
    rememberSearch(query);
    addToCart({
      id: item._id,
      name: item.name,
      price: item.sellingPrice || item.price || 0,
      discountPrice: item.discountPrice,
      image: item.image || '',
      sellerId: seller._id,
      sellerName: seller.businessName || 'Restaurant',
      isVeg: !!item.isVeg,
      description: item.description,
    });
  };

  const renderResultItem = ({ item }: { item: SearchResult }) => {
    const seller = sellerOf(item);
    const { final, strike } = getFoodPricing(item);
    const qty = getItemQuantity(item._id);
    const img = realImageUrl(item.image);
    return (
      <TouchableOpacity style={styles.result} onPress={() => openSeller(item)} activeOpacity={0.8} accessibilityRole="button">
        <View style={styles.resultImage}>
          {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <DishArt name={item.name} category={(item as any).category} compact style={StyleSheet.absoluteFill} />}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.resultTitleRow}>
            <VegIndicator isVeg={!!item.isVeg} size={12} />
            <Text style={[type.subheading, { flex: 1 }]} numberOfLines={1}>{item.name}</Text>
          </View>
          {seller.businessName ? <Text style={type.caption} numberOfLines={1}>from {seller.businessName}</Text> : null}
          <View style={styles.resultPriceRow}>
            <Text style={type.price}>{formatPrice(final)}</Text>
            {strike ? <Text style={styles.strike}>{formatPrice(strike)}</Text> : null}
          </View>
        </View>
        <AddToCartButton
          quantity={qty}
          onAdd={() => addItem(item)}
          onIncrement={() => updateQuantity(item._id, qty + 1)}
          onDecrement={() => updateQuantity(item._id, qty - 1)}
          disabled={item.isAvailable === false}
        />
      </TouchableOpacity>
    );
  };

  const showIdle = query.trim().length < 2;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton icon="arrow-back" accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={{ marginLeft: -spacing.sm }} />
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search dishes or kitchens"
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => rememberSearch(query)}
            autoCorrect={false}
            accessibilityLabel="Search"
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {showIdle ? (
        <View style={styles.idle}>
          {recentSearches.length > 0 ? (
            <>
              <View style={styles.idleHeader}>
                <Text style={type.overline}>Recent searches</Text>
                <TouchableOpacity onPress={clearRecent} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[type.label, { color: colors.primary }]}>Clear</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.tags}>
                {recentSearches.map((s) => (
                  <Chip key={s} label={s} icon="time-outline" onPress={() => setQuery(s)} />
                ))}
              </View>
            </>
          ) : null}
          <Text style={[type.overline, { marginTop: recentSearches.length ? spacing.xxl : 0, marginBottom: spacing.md }]}>Try searching for</Text>
          <View style={styles.tags}>
            {SUGGESTIONS.map((s) => (
              <Chip key={s} label={s} onPress={() => setQuery(s)} />
            ))}
          </View>
        </View>
      ) : loading && results.length === 0 ? (
        <View style={styles.idle}><SkeletonList count={4} imageSize={56} /></View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => searchItems(query.trim())} />
      ) : (
        <FlatList
          data={results}
          renderItem={renderResultItem}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <Divider inset={72} />}
          ListHeaderComponent={searched && results.length ? <Text style={[type.caption, { marginBottom: spacing.sm }]}>{results.length} {results.length === 1 ? 'dish' : 'dishes'} within {SERVICE_RADIUS_KM} km</Text> : null}
          ListEmptyComponent={
            searched ? (
              <EmptyState icon="search-outline" title={`No results for "${query.trim()}"`} subtitle="Try a different dish name or a broader term like thali or paneer." />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, fontFamily: fonts.regular,
  },
  idle: { padding: spacing.screen },
  idleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { padding: spacing.screen, paddingBottom: spacing.xxxl },
  result: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  resultImage: { width: 56, height: 56, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  resultTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: 2 },
  strike: { ...type.caption, color: colors.textTertiary, textDecorationLine: 'line-through' },
});
