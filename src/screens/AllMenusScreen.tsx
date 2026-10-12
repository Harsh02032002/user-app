import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { LOCATION_COORDS_KEY, LOCATION_NAME_KEY } from '../utils/location';
import { useCart } from '../context/CartContext';
import { AppFooter } from '../components/common/AppFooter';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

export default function AllMenusScreen() {
  const navigation = useNavigation<any>();
  const { addToCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState('');
  const [locationReady, setLocationReady] = useState(false);

  // Get user's location on mount
  useEffect(() => {
    getUserLocation();
  }, []);

  // Fetch items when search or location changes (only after location is resolved,
  // otherwise we'd briefly show menus from every city)
  useEffect(() => {
    if (!locationReady) return;
    fetchItems();
  }, [search, userLocation, locationReady]);

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
        console.log('Location permission denied');
        // Still fetch items without location filter
        return;
      }

      // Try last known location first (faster)
      let location = await Location.getLastKnownPositionAsync({});
      
      // If no last known location, get current position
      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      if (location) {
        setUserLocation({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    } finally {
      setLocationReady(true);
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      if (!userLocation?.lat || !userLocation?.lng) {
        console.log('[AllMenusScreen] Location not ready yet, skipping fetch');
        return;
      }
      const params: any = {
        lat: userLocation.lat,
        lng: userLocation.lng,
        radius: 12000,
      };
      if (search) params.search = search;
      if (locationName) params.city = locationName;
      
      const res = await api.user.getMenuItems(params);
      if (res.success) {
        setItems(res.products || []);
      }
    } catch (error) {
      console.error('Error fetching menu items:', error);
    } finally {
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

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.image }} style={styles.cardImage} />
      {item.isVeg && (
        <View style={styles.vegBadge}>
          <View style={styles.vegDot} />
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.price}>₹{item.discountPrice || item.sellingPrice}</Text>
            {item.discountPrice && (
              <Text style={styles.originalPrice}>₹{item.sellingPrice}</Text>
            )}
          </View>
          <TouchableOpacity 
            style={styles.addBtn}
            onPress={() => handleAddToCart(item)}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Menus</Text>
        <TouchableOpacity 
          onPress={getUserLocation}
          style={styles.locationBtn}
          disabled={loading}
        >
          <Ionicons 
            name={userLocation ? "location" : "location-outline"} 
            size={20} 
            color={userLocation ? "#FF6B00" : "#666"} 
          />
        </TouchableOpacity>
      </View>

      {userLocation && (
        <View style={styles.locationBadge}>
          <Ionicons name="location" size={14} color="#fff" />
          <Text style={styles.locationText}>
            Location-based results • {(userLocation.lat).toFixed(4)}, {(userLocation.lng).toFixed(4)}
          </Text>
        </View>
      )}

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for dishes..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF6B00" />
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          onRefresh={() => {
            setRefreshing(true);
            fetchItems();
          }}
          refreshing={refreshing}
          ListFooterComponent={() => (
            <>
              <View style={{ height: 20 }} />
              <AppFooter />
              <View style={{ height: 120 }} />
            </>
          )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  backBtn: {
    padding: 4,
  },
  locationBtn: {
    padding: 8,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  locationText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  listContent: {
    padding: 16,
  },
  card: {
    width: COLUMN_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f9f9f9',
  },
  vegBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
    padding: 2,
    backgroundColor: '#fff',
  },
  vegDot: {
    width: '100%',
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 10,
  },
  cardContent: {
    padding: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  itemDesc: {
    fontSize: 11,
    color: '#888',
    marginBottom: 8,
    height: 28,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  originalPrice: {
    fontSize: 11,
    color: '#888',
    textDecorationLine: 'line-through',
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
});
