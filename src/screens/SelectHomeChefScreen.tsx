import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppHeader } from '../components/common/AppHeader';
import api, { API_ENDPOINTS, getImageUrl } from '../config/api';
import { api as userServicesApi } from '../services/api';
import { LOCATION_COORDS_KEY, LOCATION_NAME_KEY } from '../utils/location';
import { RootStackParamList } from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'SelectHomeChef'>;

interface HomeChef {
  _id: string;
  businessName: string;
  logo?: string;
  coverImage?: string;
  rating: number;
  phone: string;
  address?: {
    area?: string;
    city?: string;
  };
  speciality?: string;
}

export default function SelectHomeChefScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { planId, planName, amount, durationDays, perDayValue } = route.params;

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [homeChefs, setHomeChefs] = useState<HomeChef[]>([]);
  const [selectedChef, setSelectedChef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [locationName, setLocationName] = useState<string>('');

  // Prevent blank screen - ensure component is mounted before fetching
  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => {
      fetchHomeChefs();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchHomeChefs = async () => {
    try {
      setError(null);
      let chefsData: HomeChef[] = [];
      let locationSet = false;

      // Try fetching location-based nearby home chefs
      try {
        const savedCoords = await AsyncStorage.getItem(LOCATION_COORDS_KEY);
        const savedName = await AsyncStorage.getItem(LOCATION_NAME_KEY);
        if (savedName) setLocationName(savedName);

        if (savedCoords) {
          const parsed = JSON.parse(savedCoords);
          if (parsed?.lat && parsed?.lng) {
            locationSet = true;
            const res = await userServicesApi.user.getNearbySellers({
              lat: parsed.lat,
              lng: parsed.lng,
              radius: 12000,
              type: 'home_chef',
            });
            chefsData = res.sellers || [];
          }
        }
      } catch (locErr) {
        console.log('[SelectHomeChef] Error getting location-based sellers:', locErr);
      }

      // ONLY fallback to all home chefs IF the user has never selected/saved any location
      if ((!chefsData || chefsData.length === 0) && !locationSet) {
        const response = await api.get(API_ENDPOINTS.HOME_CHEFS);
        const rawChefs = response.data?.sellers || response.data?.data || response.data?.homeChefs || [];
        chefsData = rawChefs.filter((c: any) => c.type === 'home_chef' || c.type === 'home-chef' || !c.type);
      }

      setHomeChefs(chefsData);
    } catch (error: any) {
      console.error('Error fetching home chefs:', error);
      setError(error?.response?.data?.message || 'Failed to load home chefs');
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = () => {
    if (!selectedChef) {
      Alert.alert('Select Home Chef', 'Please select a home chef to continue');
      return;
    }

    const selectedChefData = homeChefs.find(chef => chef._id === selectedChef);
    
    // Navigate to subscription checkout with hybrid payment
    navigation.navigate('SubscriptionCheckout', {
      planId,
      planName,
      amount,
      durationDays: durationDays || 30,
      perDayValue: perDayValue || Math.round(amount / 30),
      homeChefId: selectedChef,
      homeChefName: selectedChefData?.businessName || 'Home Chef',
    });
  };

  // Show loading state with UI skeleton to prevent blank screen
  if (loading && !mounted) {
    return (
      <View style={styles.container}>
        <AppHeader 
          showSearch={false} 
          showBack={true}
          sellerInfo={{ name: "Home Chefs Near You", type: 'home_chef', rating: 4.8 }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Loading home chefs...</Text>
        </View>
      </View>
    );
  }

  // Error state with retry button
  if (error && homeChefs.length === 0) {
    return (
      <View style={styles.container}>
        <AppHeader 
          showSearch={false} 
          showBack={true}
          sellerInfo={{ name: "Home Chefs Near You", type: 'home_chef', rating: 4.8 }}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF6B00" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchHomeChefs}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader 
        showSearch={false} 
        showBack={true}
      />

      {/* Plan Info */}
      <View style={styles.planInfo}>
        <Text style={styles.planLabel}>Selected Plan</Text>
        <Text style={styles.planName}>{planName}</Text>
        <Text style={styles.planAmount}>Rs. {amount}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Choose Your Home Chef</Text>
        <Text style={styles.sectionSubtitle}>
          Select a home chef from whom you want to order meals
        </Text>

        {homeChefs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={56} color="#FF6B00" />
            <Text style={styles.emptyTitle}>No Home Chefs Available</Text>
            <Text style={styles.emptySubtitle}>
              {locationName 
                ? `Currently no home chefs are available near ${locationName}. Please try selecting a different delivery location.` 
                : 'No home chefs available near your current location.'}
            </Text>
          </View>
        ) : (
          homeChefs.map((chef) => (
            <TouchableOpacity
              key={chef._id}
              style={[
                styles.chefCard,
                selectedChef === chef._id && styles.selectedCard,
              ]}
              onPress={() => setSelectedChef(chef._id)}
            >
              <View style={styles.chefImageContainer}>
                {chef.logo ? (
                  <Image 
                    source={{ uri: getImageUrl(chef.logo) || 'https://images.unsplash.com/photo-1495195129352-aec325b55b65?w=200&h=200&fit=crop&q=80' }} 
                    style={styles.chefImage} 
                    contentFit="cover"
                  />
                ) : chef.coverImage ? (
                  <Image 
                    source={{ uri: getImageUrl(chef.coverImage) || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1000&h=400&fit=crop&q=80' }} 
                    style={styles.chefImage} 
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.chefImage, styles.placeholderImage]}>
                    <Ionicons name="person" size={32} color="#ccc" />
                  </View>
                )}
              </View>

              <View style={styles.chefInfo}>
                <Text style={styles.chefName}>{chef.businessName}</Text>
                {chef.speciality && (
                  <Text style={styles.chefSpeciality}>{chef.speciality}</Text>
                )}
                <View style={styles.chefMeta}>
                  <View style={styles.rating}>
                    <Ionicons name="star" size={14} color="#FFB800" />
                    <Text style={styles.ratingText}>{chef.rating || '4.0'}</Text>
                  </View>
                  {(chef.address?.city || chef.address?.area) && (
                    <>
                      <Text style={styles.dot}>-</Text>
                      <Text style={styles.chefLocation}>{chef.address?.city || chef.address?.area}</Text>
                    </>
                  )}
                </View>
              </View>

              <View style={styles.radioContainer}>
                <View
                  style={[
                    styles.radioOuter,
                    selectedChef === chef._id && styles.radioOuterSelected,
                  ]}
                >
                  {selectedChef === chef._id && <View style={styles.radioInner} />}
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Button */}
      <View style={styles.bottomContainer}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalAmount}>Rs. {amount}</Text>
        </View>
        <TouchableOpacity
          style={[styles.proceedBtn, !selectedChef && styles.proceedBtnDisabled]}
          onPress={handleProceed}
          disabled={!selectedChef || processing}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.proceedBtnText}>Proceed to Pay</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
    backgroundColor: '#fff',
  },

  planInfo: {
    backgroundColor: '#FFF5F0',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE5D6',
  },
  planLabel: {
    fontSize: 12,
    color: '#FF6B00',
    fontWeight: '500',
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 2,
  },
  planAmount: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  chefCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  selectedCard: {
    borderColor: '#FF6B00',
    backgroundColor: '#FFF5F0',
  },
  chefImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  chefImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chefInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chefName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  chefSpeciality: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  chefMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '500',
    marginLeft: 4,
  },
  dot: {
    marginHorizontal: 6,
    color: '#ccc',
  },
  chefLocation: {
    fontSize: 13,
    color: '#888',
  },
  radioContainer: {
    marginLeft: 8,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#FF6B00',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B00',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  totalContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
    color: '#888',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  proceedBtnDisabled: {
    backgroundColor: '#FFB380',
  },
  proceedBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
