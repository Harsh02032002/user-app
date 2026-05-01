import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import api, { API_ENDPOINTS } from '../config/api';
import { RootStackParamList } from '../navigation/RootNavigator';
import { getCurrentCoordinates, getReadableLocation } from '../utils/location';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

interface Restaurant {
  _id: string;
  name: string;
  shopName: string;
  image?: string;
  rating: number;
  cuisine: string;
  deliveryTime: string;
  distance?: string;
  isOpen: boolean;
  sellerType: string;
}

interface Category {
  _id: string;
  name: string;
  image: string;
}

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { totalItems, totalAmount, sellerId } = useCart();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [homeChefs, setHomeChefs] = useState<Restaurant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subscriptionBalance, setSubscriptionBalance] = useState(0);
  const [locationName, setLocationName] = useState('Detecting location...');
  const [coords, setCoords] = useState<{ latitude: number, longitude: number } | null>(null);

  useEffect(() => {
    fetchHomeData();
    fetchLocation();
  }, []);

  const fetchLocation = async () => {
    try {
      const name = await getReadableLocation();
      setLocationName(name);
      const position = await getCurrentCoordinates();
      setCoords(position);
    } catch (error) {
      console.error('Error fetching location:', error);
      setLocationName('Mumbai, Maharashtra');
    }
  };

  const fetchHomeData = async () => {
    try {
      const [restaurantsRes, homeChefRes, balanceRes] = await Promise.all([
        api.get(API_ENDPOINTS.RESTAURANTS),
        api.get(API_ENDPOINTS.HOME_CHEFS),
        api.get(API_ENDPOINTS.SUBSCRIPTION_BALANCE),
      ]);

      setRestaurants(restaurantsRes.data.data || []);
      setHomeChefs(homeChefRes.data.data || []);
      
      // Backend returns { success: true, subscription: { ... } }
      const subscription = balanceRes.data?.subscription || balanceRes.data?.data?.subscription;
      setSubscriptionBalance(subscription?.remaining_amount || 0);
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchHomeData();
  };

  const renderRestaurantCard = ({ item }: { item: Restaurant }) => (
    <TouchableOpacity
      style={styles.restaurantCard}
      onPress={() => navigation.navigate('Restaurant', { 
        sellerId: item._id, 
        sellerName: item.shopName || item.name 
      })}
    >
      <View style={styles.restaurantImage}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.restaurantImg} />
        ) : (
          <View style={[styles.restaurantImg, styles.placeholderImg]}>
            <Ionicons name="restaurant" size={32} color="#ccc" />
          </View>
        )}
        {item.sellerType === 'homeChef' && (
          <View style={styles.homeChefBadge}>
            <Text style={styles.homeChefText}>Home Chef</Text>
          </View>
        )}
      </View>
      <View style={styles.restaurantInfo}>
        <Text style={styles.restaurantName} numberOfLines={1}>
          {item.shopName || item.name}
        </Text>
        <Text style={styles.restaurantCuisine} numberOfLines={1}>
          {item.cuisine || 'Multi Cuisine'}
        </Text>
        <View style={styles.restaurantMeta}>
          <View style={styles.rating}>
            <Ionicons name="star" size={14} color="#FFB800" />
            <Text style={styles.ratingText}>{item.rating || '4.0'}</Text>
          </View>
          <Text style={styles.dot}>-</Text>
          <Text style={styles.deliveryTime}>{item.deliveryTime || '30-40 min'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B00']} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.locationContainer}
            onPress={fetchLocation}
          >
            <View style={styles.locationHeaderRow}>
              <Ionicons name="location" size={18} color="#FF6B00" />
              <Text style={styles.locationLabel}>DELIVER TO</Text>
              <Ionicons name="chevron-down" size={14} color="#FF6B00" />
            </View>
            <Text style={styles.locationName} numberOfLines={1}>{locationName}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.profileBtn}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' } as any)}
          >
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity 
          style={styles.searchBar}
          onPress={() => navigation.navigate('Search')}
        >
          <Ionicons name="search" size={20} color="#888" />
          <Text style={styles.searchPlaceholder}>Search for restaurants or dishes...</Text>
        </TouchableOpacity>

        {/* Subscription Balance Card */}
        {subscriptionBalance > 0 && (
          <View style={styles.balanceCard}>
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>Subscription Balance</Text>
              <Text style={styles.balanceAmount}>Rs. {subscriptionBalance}</Text>
            </View>
            <TouchableOpacity 
              style={styles.balanceBtn}
              onPress={() => navigation.navigate('SubscriptionPlans')}
            >
              <Text style={styles.balanceBtnText}>View</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('SubscriptionPlans')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FFF0E6' }]}>
              <Ionicons name="card" size={24} color="#FF6B00" />
            </View>
            <Text style={styles.actionTitle}>Subscribe</Text>
            <Text style={styles.actionSubtitle}>Home Chef Plans</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="gift" size={24} color="#4CAF50" />
            </View>
            <Text style={styles.actionTitle}>Offers</Text>
            <Text style={styles.actionSubtitle}>Best Deals</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="time" size={24} color="#2196F3" />
            </View>
            <Text style={styles.actionTitle}>Express</Text>
            <Text style={styles.actionSubtitle}>Fast Delivery</Text>
          </TouchableOpacity>
        </View>

        {/* Home Chefs Section */}
        {homeChefs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Home Chefs</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={homeChefs}
              renderItem={renderRestaurantCard}
              keyExtractor={(item) => item._id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}

        {/* Restaurants Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular Restaurants</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {restaurants.map((restaurant) => (
            <TouchableOpacity
              key={restaurant._id}
              style={styles.restaurantListCard}
              onPress={() => navigation.navigate('Restaurant', { 
                sellerId: restaurant._id, 
                sellerName: restaurant.shopName || restaurant.name 
              })}
            >
              <View style={styles.listCardImage}>
                {restaurant.image ? (
                  <Image source={{ uri: restaurant.image }} style={styles.listImg} />
                ) : (
                  <View style={[styles.listImg, styles.placeholderImg]}>
                    <Ionicons name="restaurant" size={24} color="#ccc" />
                  </View>
                )}
              </View>
              <View style={styles.listCardInfo}>
                <Text style={styles.listCardName} numberOfLines={1}>
                  {restaurant.shopName || restaurant.name}
                </Text>
                <Text style={styles.listCardCuisine} numberOfLines={1}>
                  {restaurant.cuisine || 'Multi Cuisine'}
                </Text>
                <View style={styles.listCardMeta}>
                  <View style={styles.rating}>
                    <Ionicons name="star" size={12} color="#FFB800" />
                    <Text style={styles.ratingText}>{restaurant.rating || '4.0'}</Text>
                  </View>
                  <Text style={styles.dot}>-</Text>
                  <Text style={styles.deliveryTime}>{restaurant.deliveryTime || '30-40 min'}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Cart Button */}
      {totalItems > 0 && (
        <TouchableOpacity 
          style={styles.cartButton}
          onPress={() => navigation.navigate('Checkout')}
        >
          <View style={styles.cartInfo}>
            <Text style={styles.cartItems}>{totalItems} Items</Text>
            <Text style={styles.cartTotal}>Rs. {totalAmount}</Text>
          </View>
          <View style={styles.cartAction}>
            <Text style={styles.cartActionText}>View Cart</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  locationContainer: {
    flex: 1,
    marginRight: 16,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: 0.5,
  },
  locationName: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginLeft: 22,
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 16,
  },
  searchPlaceholder: {
    marginLeft: 12,
    fontSize: 14,
    color: '#888',
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF5F0',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE5D6',
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#FF6B00',
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF6B00',
    marginTop: 2,
  },
  balanceBtn: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  balanceBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  actionSubtitle: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  seeAll: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '500',
  },
  horizontalList: {
    paddingHorizontal: 20,
  },
  restaurantCard: {
    width: width * 0.45,
    marginRight: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
  },
  restaurantImage: {
    height: 120,
    position: 'relative',
  },
  restaurantImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImg: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeChefBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  homeChefText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  restaurantInfo: {
    padding: 12,
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  restaurantCuisine: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
  },
  restaurantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#1a1a1a',
    fontWeight: '500',
    marginLeft: 4,
  },
  dot: {
    marginHorizontal: 6,
    color: '#ccc',
  },
  deliveryTime: {
    fontSize: 12,
    color: '#888',
  },
  restaurantListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  listCardImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    overflow: 'hidden',
  },
  listImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  listCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  listCardCuisine: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  listCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FF6B00',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  cartInfo: {},
  cartItems: {
    color: '#fff',
    fontSize: 12,
  },
  cartTotal: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cartAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartActionText: {
    color: '#fff',
    fontWeight: '600',
    marginRight: 4,
  },
});
