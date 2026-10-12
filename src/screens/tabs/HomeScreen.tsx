import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getImageUrl } from '../../config/api';
import { api } from '../../services/api';
import { LOCATION_COORDS_KEY, LOCATION_NAME_KEY } from '../../utils/location';
import { AppHeader } from '../../components/common/AppHeader';
import { AppFooter } from '../../components/common/AppFooter';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';

import * as Location from 'expo-location';

const { width } = Dimensions.get('window');
const CACHE_KEY = 'home_screen_data_cache';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Type definitions for API data
interface Seller {
  _id: string;
  businessName: string;
  description: string;
  rating: number;
  image: string;
  type: 'home_chef' | 'restaurant';
}

interface MenuItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  sellingPrice?: number;
  sellerId?: {
    _id: string;
    businessName?: string;
    type?: string;
    rating?: number;
  };
  category?: string;
  isVeg?: boolean;
  rating?: number;
  preparationTime?: number;
  stock?: number;
  totalOrders?: number;
}

interface SubscriptionPlan {
  _id: string;
  plan_name: string;
  description: string;
  total_amount: number;
  total_days: number;
  badge?: string;
  features: string[];
}

interface PromoBanner {
  _id: string;
  title: string;
  subtitle: string;
  image: string;
  color: string;
}

export function HomeScreen() {
  console.log('[HomeScreen] Component rendering');
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedTypeState] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>('');

  
  // Wrapper to save type to storage when changed
  const setSelectedType = async (type: string) => {
    setSelectedTypeState(type);
    try {
      await AsyncStorage.setItem('preferredFoodType', type);
    } catch (error) {
      console.error('Error saving type:', error);
    }
  };
  const [allSellers, setAllSellers] = useState<Seller[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [promoBanners, setPromoBanners] = useState<PromoBanner[]>([]);
  
  // Memoized filtered data
  const sellers = React.useMemo(() => {
    if (selectedType === 'all') return allSellers;
    return allSellers.filter(s => {
      if (selectedType === 'home_chef') return s.type === 'home_chef' || s.type === 'home-chef';
      return s.type === selectedType;
    });
  }, [allSellers, selectedType]);

  const menuItems = React.useMemo(() => {
    if (selectedType === 'all') return allMenuItems;
    return allMenuItems.filter(item => {
      if (!item) return false;
      const sType = typeof item.sellerId === 'object' ? item.sellerId?.type : null;
      if (sType) {
        if (selectedType === 'home_chef') return sType === 'home_chef' || sType === 'home-chef';
        return sType === selectedType;
      }
      const sellerIdStr = typeof item.sellerId === 'object' ? item.sellerId?._id : item.sellerId;
      const matchedSeller = allSellers.find(s => s._id === sellerIdStr);
      if (matchedSeller) {
        if (selectedType === 'home_chef') return matchedSeller.type === 'home_chef' || matchedSeller.type === 'home-chef';
        return matchedSeller.type === selectedType;
      }
      return true;
    });
  }, [allMenuItems, selectedType, allSellers]);

  const fetching = React.useRef(false);

  // Load location independently on mount
  useEffect(() => {
    const loadLocation = async () => {
      try {
        console.log('[Location] Starting loadLocation...');
        const savedCoords = await AsyncStorage.getItem(LOCATION_COORDS_KEY);
        const savedName = await AsyncStorage.getItem(LOCATION_NAME_KEY);
        console.log('[Location] savedCoords:', savedCoords, 'savedName:', savedName);
        if (savedCoords && savedName) {
          const parsed = JSON.parse(savedCoords);
          console.log('[Location] Using saved location:', parsed, savedName);
          setUserLocation({ lat: parsed.lat, lng: parsed.lng });
          setLocationName(savedName);
        } else {
          console.log('[Location] No saved location, trying GPS...');
          const { status } = await Location.requestForegroundPermissionsAsync();
          console.log('[Location] Permission status:', status);
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const lat = loc.coords.latitude;
            const lng = loc.coords.longitude;
            console.log('[Location] GPS coords:', lat, lng);
            setUserLocation({ lat, lng });
            const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (geo[0]) {
              const name = geo[0].city || geo[0].subregion || 'Your Location';
              console.log('[Location] City name:', name);
              setLocationName(name);
              await AsyncStorage.setItem(LOCATION_COORDS_KEY, JSON.stringify({ lat, lng }));
              await AsyncStorage.setItem(LOCATION_NAME_KEY, name);
            }
          }
        }
      } catch (e) {
        console.log('[Location] loadLocation error:', e);
      }
    };
    loadLocation();
  }, []);

  // Reset fetching flag when location changes so fetchData can re-run
  useEffect(() => {
    console.log('[HomeScreen] userLocation changed:', userLocation, 'locationName:', locationName);
    fetching.current = false;
  }, [userLocation]);

  const loadCachedData = async () => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        // Sellers/menu are location-wise -> never restore them from a cache that
        // isn't tied to the current location (it may contain another city's sellers).
        // setSubscriptionPlans(parsed.subscriptionPlans || []); // Skip cache for now to fix image issues
        setPromoBanners(parsed.promoBanners || []);
        await AsyncStorage.removeItem(CACHE_KEY);
      }
    } catch (error) {
      console.error('Error loading cache:', error);
    }
  };

  const loadPreferredType = React.useCallback(async () => {
    console.log('[HomeScreen] loadPreferredType called, current selectedType:', selectedType);
    try {
      const savedType = await AsyncStorage.getItem('preferredFoodType');
      if (savedType && savedType !== selectedType) {
        console.log('[HomeScreen] Updating selectedType from storage:', savedType);
        setSelectedTypeState(savedType);
      }
    } catch (error) {
      console.error('Error loading preferred type:', error);
    }
  }, [selectedType]);



  const fetchData = React.useCallback(async () => {
    try {
      setError(null);

      const lat = userLocation?.lat ?? null;
      const lng = userLocation?.lng ?? null;

      // Strictly location-wise: if location not ready yet, do NOT fetch unconstrained sellers from distant cities
      if (!lat || !lng) {
        console.log('[HomeScreen] Location not resolved yet, waiting for location...');
        return;
      }

      // 1. Fetch sellers - strictly nearby within 12 km
      let sellersResponse: any;
      try {
        sellersResponse = await api.user.getNearbySellers({
          lat,
          lng,
          radius: 12000,
          city: locationName,
          type: selectedType !== 'all' ? selectedType : undefined
        });
      } catch (e) {
        console.log('[HomeScreen] Nearby sellers failed:', e);
        sellersResponse = { sellers: [] };
      }

      const newAllSellers = sellersResponse?.sellers || (Array.isArray(sellersResponse) ? sellersResponse : []);
      setAllSellers(newAllSellers);

      // 2. Fetch menu items location-wise (strictly from nearby sellers within 12 km)
      let menuResponse: any;
      try {
        let fetchedProducts: any[] = [];
        if (newAllSellers.length > 0) {
          const sellerIdsStr = newAllSellers.map((s: Seller) => s._id).join(',');
          menuResponse = await api.user.getMenuItems({ 
            sellerIds: sellerIdsStr,
            lat,
            lng,
            radius: 12000,
            city: locationName,
            type: selectedType !== 'all' ? selectedType : undefined
          }).catch(() => null);
          fetchedProducts = menuResponse?.products || (Array.isArray(menuResponse) ? menuResponse : []);
        } else {
          // No nearby sellers within 12 km -> keep menu strictly empty (never show distant food)
          fetchedProducts = [];
        }

        setAllMenuItems(fetchedProducts || []);
      } catch (e) {
        console.log('Error fetching menu items:', e);
      }

      const [plansData, bannersData] = await Promise.all([
        api.user.getSubscriptionPlans().catch(err => { console.log('Plans error:', err); return []; }),
        api.user.getActiveBanners().catch(err => { console.log('Banners error:', err); return []; })
      ]);

      setSubscriptionPlans(plansData.plans || plansData || []);
      setPromoBanners(bannersData.banners || bannersData || []);

    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedType, userLocation, locationName]);

  useEffect(() => {
    loadCachedData().then(() => loadPreferredType());
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const typeLabel = selectedType === 'home_chef' ? 'Home Chef' : selectedType === 'restaurant' ? 'Restaurant' : 'All Sellers';

  const renderSellerCard = React.useCallback(({ item }: any) => {
    const sellerRating = item.rating || 0;
    const fullStars = Math.floor(sellerRating);
    const emptyStars = 5 - fullStars;
    const displayCity = item.address?.city || item.address?.area || locationName || item.address?.street || '';
    return (
      <TouchableOpacity 
        style={styles.sellerCard} 
        activeOpacity={0.9}
        onPress={() => {
          navigation.navigate('Restaurant', {
            sellerId: item._id,
            sellerName: item.businessName,
          });
        }}
      >
        <View style={styles.sellerCoverContainer}>
          <Image 
            source={{ uri: item.coverImage || item.image || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1000&h=400&fit=crop&q=80' }} 
            style={styles.sellerCoverImage} 
            contentFit="cover"
          />
          <View style={[styles.typeBadge, item.type === 'home_chef' ? styles.homeChefBadge : styles.restaurantBadge]}>
            <Ionicons 
              name={item.type === 'home_chef' ? 'home' : 'restaurant'} 
              size={10} 
              color={item.type === 'home_chef' ? '#059669' : '#C2410C'} 
            />
            <Text style={[styles.typeBadgeText, item.type === 'home_chef' ? styles.typeBadgeTextHome : styles.typeBadgeTextRest]}>
              {item.type === 'home_chef' ? 'Home-Cooked' : 'Restaurant'}
            </Text>
          </View>
        </View>
        
        <View style={styles.sellerContent}>
          <Image 
            source={{ uri: getImageUrl(item.logo || item.image) || 'https://images.unsplash.com/photo-1495195129352-aec325b55b65?w=200&h=200&fit=crop&q=80' }} 
            style={styles.sellerLogo} 
            contentFit="cover"
          />
          <View style={styles.sellerTextInfo}>
            <Text style={styles.sellerName}>{item.businessName}</Text>
            <Text style={styles.sellerCuisines}>{item.cuisines?.length > 0 ? item.cuisines.join(', ') : 'Multi-cuisine'}</Text>
            <View style={styles.sellerMetaRow}>
              <View style={styles.ratingRow}>
                {Array.from({ length: fullStars }).map((_, i) => (
                  <Ionicons key={`f${i}`} name="star" size={12} color="#FFD700" />
                ))}
                {Array.from({ length: emptyStars }).map((_, i) => (
                  <Ionicons key={`e${i}`} name="star" size={12} color="#ccc" />
                ))}
                <Text style={styles.ratingText}>{sellerRating > 0 ? sellerRating.toFixed(1) : ''}</Text>
              </View>
              {displayCity ? <Text style={styles.locationText}>• {displayCity}</Text> : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [navigation, locationName]);

  const renderFoodCard = React.useCallback(({ item }: any) => {
    // sellerId is an object from backend with _id, businessName, type
    const sellerType = item.sellerId?.type;
    const discountPrice = item.discountPrice || null;
    const sellingPrice = item.sellingPrice || item.price;
    const discountPercent = discountPrice ? Math.round(((sellingPrice - discountPrice) / sellingPrice) * 100) : 0;
    
    return (
      <TouchableOpacity style={styles.foodCard} activeOpacity={0.9}>
        {/* Image Container */}
        <View style={styles.foodImageContainer}>
          <Image 
            source={{ uri: getImageUrl(item.image) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&fit=crop' }} 
            style={styles.foodImage} 
            contentFit="cover"
          />
          
          {/* Top Badges */}
          <View style={styles.foodTopBadges}>
            <View style={[styles.typeBadge, sellerType === 'home_chef' ? styles.homeChefBadge : styles.restaurantBadge, { position: 'relative', top: 0, left: 0 }]}>
              <Ionicons 
                name={sellerType === 'home_chef' ? 'home' : 'restaurant'} 
                size={10} 
                color={sellerType === 'home_chef' ? '#059669' : '#C2410C'} 
              />
              <Text style={[styles.typeBadgeText, sellerType === 'home_chef' ? styles.typeBadgeTextHome : styles.typeBadgeTextRest]}>
                {sellerType === 'home_chef' ? 'Home-Cooked' : 'Restaurant'}
              </Text>
            </View>
          </View>
          
          {/* Veg/Non-veg Badge */}
          <View style={styles.vegBadgeContainer}>
            <View style={[styles.vegBadge, item.isVeg ? styles.vegBadgeGreen : styles.vegBadgeRed]}>
              <View style={[styles.vegDot, item.isVeg ? styles.vegDotGreen : styles.vegDotRed]} />
            </View>
          </View>
          
          {/* Discount Badge */}
          {discountPercent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discountPercent}% OFF</Text>
            </View>
          )}
        </View>
        
        {/* Content */}
        <View style={styles.foodCardContent}>
          {/* Title & Time */}
          <View style={styles.foodHeader}>
            <Text style={styles.foodTitle} numberOfLines={1}>{item.name}</Text>
            <View style={styles.timeContainer}>
              <Ionicons name="time-outline" size={12} color="#999" />
              <Text style={styles.timeText}>{item.preparationTime || 30}m</Text>
            </View>
          </View>
          
          {/* Description */}
          <Text style={styles.foodDescription} numberOfLines={2}>{item.description}</Text>
          
          {/* Rating & Orders */}
          <View style={styles.foodMeta}>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>{item.rating?.toFixed(1) || '4.0'}</Text>
            </View>

          </View>
          
          {/* Price & Add Button */}
          <View style={styles.foodFooter}>
            <View style={styles.priceContainer}>
              <Text style={styles.priceText}>₹{discountPrice || sellingPrice}</Text>
              {discountPrice && (
                <Text style={styles.originalPrice}>₹{sellingPrice}</Text>
              )}
            </View>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => {
                const sId = (typeof item.sellerId === 'object' ? item.sellerId?._id : item.sellerId) || '';
                const sName = (typeof item.sellerId === 'object' ? item.sellerId?.businessName : '') || 'Restaurant';
                addToCart({
                  id: item._id,
                  name: item.name,
                  price: item.sellingPrice || item.price || 0,
                  discountPrice: item.discountPrice,
                  image: item.image,
                  sellerId: sId,
                  sellerName: sName,
                  isVeg: item.isVeg || false,
                  description: item.description,
                });
              }}
            >
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [addToCart]);

  const renderPromoBanner = React.useCallback(({ item }: any) => (
    <TouchableOpacity style={[styles.promoBanner, { backgroundColor: item.color }]}>
      <View style={styles.promoContent}>
        <Text style={styles.promoTitle}>{item.title}</Text>
        <Text style={styles.promoSubtitle}>{item.subtitle}</Text>
      </View>
      <Image 
        source={{ uri: getImageUrl(item.image) }} 
        style={styles.promoImage} 
        contentFit="cover"
      />
    </TouchableOpacity>
  ), []);

  const renderSubscriptionPlan = React.useCallback(({ item }: any) => {
    // Resolve banner image
    let imgPath = item.banner_image || item.image || item.plan_image;
    
    if (!imgPath) {
      // Fallback to a default based on days if no image provided by API
      let path = 'weekly.png';
      if (item.total_days <= 7) path = 'weekly.png';
      else if (item.total_days <= 14) path = 'fortnightly.png';
      else path = 'monthly.png';
      imgPath = `/uploads/subscriptions/${path}`;
    }

    const bannerSource = { uri: getImageUrl(imgPath) };

    return (
      <TouchableOpacity 
        style={styles.planCard}
        onPress={() => navigation.navigate('SubscriptionPlans', { planId: item._id })}
      >
        <View style={styles.planImageContainer}>
          <Image source={bannerSource} style={styles.planImage} />
          {item.badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          )}
        </View>
        <View style={styles.planHeader}>
          <Text style={styles.planTitle}>{item.plan_name}</Text>
          <Text style={styles.planDescription} numberOfLines={1}>{item.description}</Text>
        </View>
        <View style={styles.planPricing}>
          <Text style={styles.planPrice}>₹{item.total_amount}</Text>
          <Text style={styles.planDuration}>/ {item.total_days} days</Text>
        </View>
        <View style={styles.viewPlanButton}>
          <Text style={styles.viewPlanText}>View Details</Text>
        </View>
      </TouchableOpacity>
    );
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showSearch={true} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Loading delicious food...</Text>
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B00']} />}
        >
          {/* Type Filter Toggle */}
          <View style={styles.filterSection}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.filterContainer}
            >
              <TouchableOpacity 
                style={[styles.filterButton, selectedType === 'all' && styles.filterButtonActive]}
                onPress={() => setSelectedType('all')}
              >
                <Text style={[styles.filterText, selectedType === 'all' && styles.filterTextActive]}>
                  🌟 All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterButton, selectedType === 'home_chef' && styles.filterButtonActive]}
                onPress={() => setSelectedType('home_chef')}
              >
                <Text style={[styles.filterText, selectedType === 'home_chef' && styles.filterTextActive]}>
                  🏠 Home Chef
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterButton, selectedType === 'restaurant' && styles.filterButtonActive]}
                onPress={() => setSelectedType('restaurant')}
              >
                <Text style={[styles.filterText, selectedType === 'restaurant' && styles.filterTextActive]}>
                  🍽️ Restaurant
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Promo Banners */}
          <View style={styles.section}>
          <FlatList
            data={promoBanners}
            renderItem={renderPromoBanner}
            keyExtractor={(item) => item._id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          />
        </View>

        {/* Sellers Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {locationName ? `📍 Near ${locationName}` :
             selectedType === 'home_chef' ? 'Home Chefs Near You' : 
             selectedType === 'restaurant' ? 'Top Restaurants' : 'All Sellers'}
          </Text>
          <FlatList
            data={sellers}
            renderItem={renderSellerCard}
            keyExtractor={(item) => item._id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </View>

        {/* Menu Items Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>What's on the menu?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AllMenus')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={menuItems}
            renderItem={renderFoodCard}
            keyExtractor={(item) => item._id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </View>

        {/* How It Works */}
        <View style={styles.howItWorks}>
          <Text style={styles.howItWorksTitle}>How It Works</Text>
          <Text style={styles.howItWorksSubtitle}>
            Getting delicious food delivered to your doorstep has never been easier
          </Text>
          
          {[
            { step: '01', title: 'Choose Your Meal', description: 'Browse through home chefs or restaurants. Filter by cuisine, ratings, and dietary preferences.' },
            { step: '02', title: 'Place Your Order', description: 'Add items to cart, apply offers, and choose your preferred payment method.' },
            { step: '03', title: 'Enjoy Fresh Food', description: 'Track your order in real-time and enjoy freshly prepared meals at your doorstep.' }
          ].map((item, index) => (
            <View key={index} style={styles.stepCard}>
              <Text style={styles.stepNumber}>{item.step}</Text>
              <Text style={styles.stepTitle}>{item.title}</Text>
              <Text style={styles.stepDescription}>{item.description}</Text>
            </View>
          ))}
        </View>

        {/* Subscription Plans */}
        <View style={styles.subscriptionSection}>
          <Text style={styles.sectionTitle}>Subscription Plans</Text>
          <Text style={styles.sectionSubtitle}>Save more with our flexible subscription plans</Text>
          
          <FlatList
            data={subscriptionPlans}
            renderItem={renderSubscriptionPlan}
            keyExtractor={(item) => item._id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
          
          <TouchableOpacity 
            style={styles.viewAllPlansButton}
            onPress={() => navigation.navigate('AllPlans')}
          >
            <Text style={styles.viewAllPlansText}>View All Plans</Text>
            <Ionicons name="chevron-forward" size={16} color="#FF6B00" />
          </TouchableOpacity>
        </View>

        <View style={{ height: Platform.OS === 'ios' ? 100 : 80 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2E8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    zIndex: 10,
  },
  homeChefBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#D1FAE5',
  },
  restaurantBadge: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FFEDD5',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  typeBadgeTextHome: {
    color: '#059669',
  },
  typeBadgeTextRest: {
    color: '#C2410C',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 10,
  },
  filterSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  preferenceSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  preferenceContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preferenceInfo: {
    flex: 1,
  },
  preferenceLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  preferenceValue: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 0, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FF6B00',
  },
  changeButtonText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  promoList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  promoBanner: {
    width: width - 32,
    height: 120,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginRight: 12,
  },
  promoContent: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  promoSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  promoImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },

  scrollContent: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  viewAll: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '600',
  },
  horizontalList: {
    paddingHorizontal: 16,
  },
  card: {
    width: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sellerCard: {
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginRight: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sellerCoverContainer: {
    width: '100%',
    height: 150,
    position: 'relative',
  },
  sellerCoverImage: {
    width: '100%',
    height: '100%',
  },
  sellerContent: {
    padding: 12,
    flexDirection: 'row',
  },
  sellerLogo: {
    width: 45,
    height: 45,
    borderRadius: 8,
    marginRight: 12,
    marginTop: -25,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#fff',
  },
  sellerTextInfo: {
    flex: 1,
    marginTop: -5,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  sellerCuisines: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  sellerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginLeft: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
  },
  // Food Card Styles
  foodCard: {
    width: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    marginRight: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  foodImageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    position: 'relative',
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  foodTopBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    gap: 6,
  },
  vegBadgeContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  vegBadge: {
    width: 20,
    height: 20,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  vegBadgeGreen: {
    backgroundColor: '#fff',
    borderColor: '#4CAF50',
  },
  vegBadgeRed: {
    backgroundColor: '#fff',
    borderColor: '#F44336',
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  vegDotGreen: {
    backgroundColor: '#4CAF50',
  },
  vegDotRed: {
    backgroundColor: '#F44336',
  },
  discountBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  foodCardContent: {
    padding: 12,
  },
  foodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  foodTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  timeText: {
    fontSize: 11,
    color: '#999',
  },
  foodDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    marginBottom: 8,
  },
  foodMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ordersText: {
    fontSize: 11,
    color: '#999',
  },
  foodFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  originalPrice: {
    fontSize: 13,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardImage: {
    width: '100%',
    height: 120,
  },
  cardOverlay: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  howItWorks: {
    backgroundColor: '#f9f9f9',
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  howItWorksTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  howItWorksSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  stepCard: {
    alignItems: 'center',
    marginBottom: 24,
  },
  stepNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'rgba(255, 107, 0, 0.1)',
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  subscriptionSection: {
    backgroundColor: '#f9f9f9',
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  planCard: {
    width: 200,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
    position: 'relative',
  },
  planImageContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  planImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planHeader: {
    padding: 12,
    marginBottom: 8,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  planPricing: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  planDuration: {
    fontSize: 12,
    color: '#666',
  },
  planDaily: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
  },
  featuresContainer: {
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  viewPlanButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF6B00',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewPlanText: {
    fontSize: 12,
    color: '#FF6B00',
    fontWeight: '600',
  },
  viewAllPlansButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B00',
    borderRadius: 25,
    paddingVertical: 12,
    marginTop: 20,
  },
  viewAllPlansText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  // Footer Styles
  footer: {
    backgroundColor: '#1F2937',
    marginTop: 40,
  },
  footerContent: {
    paddingHorizontal: 16,
    paddingVertical: 48,
  },
  footerSection: {
    marginBottom: 32,
    alignItems: 'flex-start',
  },
  footerLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 16,
  },
  footerDescription: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 20,
    marginBottom: 20,
  },
  socialLinks: {
    flexDirection: 'row',
    gap: 16,
  },
  socialButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLinksGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  footerLinks: {
    marginBottom: 32,
  },
  linkColumn: {
    marginBottom: 24,
  },
  linkTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  linkText: {
    fontSize: 14,
    color: '#D1D5DB',
    marginBottom: 8,
    lineHeight: 20,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  contactText: {
    fontSize: 14,
    color: '#D1D5DB',
    flex: 1,
    lineHeight: 20,
  },
  footerBottom: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 32,
    alignItems: 'center',
  },
  copyright: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
    textAlign: 'center',
  },
  madeWith: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
