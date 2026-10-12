import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import api, { API_ENDPOINTS } from '../config/api';
import { RootStackParamList } from '../navigation/RootNavigator';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCATION_COORDS_KEY, LOCATION_NAME_KEY } from '../utils/location';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SearchResult {
  _id: string;
  name: string;
  shopName?: string;
  image?: string;
  type: 'restaurant' | 'dish';
  sellerId?: string;
  price?: number;
  rating?: number;
}

export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'Biryani',
    'Pizza',
    'Home Chef',
    'North Indian',
  ]);

  useEffect(() => {
    inputRef.current?.focus();
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
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query.length >= 2) {
        searchItems();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, userLocation]);

  const searchItems = async () => {
    setLoading(true);
    try {
      let url = `${API_ENDPOINTS.SEARCH}?q=${encodeURIComponent(query)}&radius=12000`;
      if (userLocation?.lat && userLocation?.lng) {
        url += `&lat=${userLocation.lat}&lng=${userLocation.lng}`;
      }
      if (locationName) {
        url += `&city=${encodeURIComponent(locationName)}`;
      }
      const response = await api.get(url);
      setResults(response.data.data || response.data.products || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultPress = (item: SearchResult) => {
    if (item.type === 'restaurant' || item.sellerId) {
      navigation.navigate('Restaurant', {
        sellerId: item._id || item.sellerId!,
        sellerName: item.shopName || item.name,
      });
    }
  };

  const handleRecentSearch = (search: string) => {
    setQuery(search);
  };

  const renderResultItem = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity style={styles.resultItem} onPress={() => handleResultPress(item)}>
      <View style={styles.resultImageContainer}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.resultImage} />
        ) : (
          <View style={[styles.resultImage, styles.placeholderImage]}>
            <Ionicons
              name={item.type === 'restaurant' ? 'restaurant' : 'fast-food'}
              size={24}
              color="#ccc"
            />
          </View>
        )}
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{item.shopName || item.name}</Text>
        <View style={styles.resultMeta}>
          {item.type === 'restaurant' ? (
            <>
              <Ionicons name="star" size={12} color="#FFB800" />
              <Text style={styles.resultMetaText}>{item.rating || '4.0'}</Text>
            </>
          ) : (
            <Text style={styles.resultPrice}>Rs. {item.price}</Text>
          )}
        </View>
      </View>
      <View style={styles.resultTypeBadge}>
        <Text style={styles.resultTypeText}>
          {item.type === 'restaurant' ? 'Restaurant' : 'Dish'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#888" />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search restaurants or dishes..."
            placeholderTextColor="#888"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {query.length < 2 ? (
        // Recent Searches
        <View style={styles.recentContainer}>
          <Text style={styles.recentTitle}>Recent Searches</Text>
          <View style={styles.recentTags}>
            {recentSearches.map((search, index) => (
              <TouchableOpacity
                key={index}
                style={styles.recentTag}
                onPress={() => handleRecentSearch(search)}
              >
                <Ionicons name="time-outline" size={16} color="#888" />
                <Text style={styles.recentTagText}>{search}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.recentTitle, { marginTop: 24 }]}>Popular Searches</Text>
          <View style={styles.popularContainer}>
            {['Thali', 'South Indian', 'Chinese', 'Desserts', 'Healthy'].map(
              (item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.popularItem}
                  onPress={() => handleRecentSearch(item)}
                >
                  <Text style={styles.popularText}>{item}</Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </View>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={48} color="#ccc" />
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptyText}>Try searching with different keywords</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderResultItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={[styles.resultsList, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginLeft: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#1a1a1a',
  },
  recentContainer: {
    padding: 20,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  recentTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recentTagText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  popularContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  popularItem: {
    backgroundColor: '#FFF5F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE5D6',
  },
  popularText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  resultsList: {
    padding: 20,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultImageContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
  },
  resultImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultMetaText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 4,
  },
  resultPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FF6B00',
  },
  resultTypeBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  resultTypeText: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
  },
});
