import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, EmptyState, ErrorState, Rating, ScreenHeader, SkeletonList, StickyFooter } from '../components/common';
import { colors, formatPrice, radius, spacing, type } from '../theme';
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
      Alert.alert('Choose a home chef', 'Select the home chef who will cook your meals.');
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Choose your home chef" subtitle="Step 1 of 2" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.planCard}>
          <Text style={type.overline}>Selected plan</Text>
          <View style={styles.planRow}>
            <Text style={[type.heading, { flex: 1 }]} numberOfLines={1}>{planName}</Text>
            <Text style={[type.price, { fontSize: 18 }]}>{formatPrice(amount)}</Text>
          </View>
          <Text style={type.caption}>
            {durationDays ? `${durationDays} days` : ''}{perDayValue ? ` · ${formatPrice(perDayValue)} per day` : ''}
          </Text>
        </Card>

        <Text style={[type.heading, { marginTop: spacing.xxl }]}>Who should cook for you?</Text>
        <Text style={[type.caption, { marginTop: 2, marginBottom: spacing.md }]}>
          {locationName ? `Home chefs within 12 km of ${locationName}` : 'Home chefs near you'}
        </Text>

        {loading ? (
          <SkeletonList count={3} imageSize={56} />
        ) : error && homeChefs.length === 0 ? (
          <ErrorState title="Couldn't load home chefs" message={error} onRetry={() => { setLoading(true); fetchHomeChefs(); }} />
        ) : homeChefs.length === 0 ? (
          <EmptyState
            icon="location-outline"
            title="No home chefs nearby"
            subtitle={locationName ? `No home chefs deliver to ${locationName} yet. Try a different delivery location.` : 'No home chefs are available near your location yet.'}
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {homeChefs.map((chef) => {
              const selected = selectedChef === chef._id;
              const img = getImageUrl(chef.logo || chef.coverImage);
              return (
                <TouchableOpacity
                  key={chef._id}
                  style={[styles.chefCard, selected && styles.chefCardSelected]}
                  onPress={() => setSelectedChef(chef._id)}
                  activeOpacity={0.85}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                >
                  <View style={styles.chefImage}>
                    {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="person-outline" size={24} color={colors.primary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.subheading} numberOfLines={1}>{chef.businessName}</Text>
                    {chef.speciality ? <Text style={type.caption} numberOfLines={1}>{chef.speciality}</Text> : null}
                    <View style={styles.chefMeta}>
                      {chef.rating ? <Rating rating={chef.rating} size={12} /> : <Text style={[type.caption, { color: colors.successStrong }]}>New</Text>}
                      {chef.address?.city || chef.address?.area ? <Text style={type.caption}>  ·  {chef.address?.city || chef.address?.area}</Text> : null}
                    </View>
                  </View>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <StickyFooter>
        <View style={styles.footerRow}>
          <View>
            <Text style={type.caption}>Plan total</Text>
            <Text style={[type.price, { fontSize: 18 }]}>{formatPrice(amount)}</Text>
          </View>
          <Button title="Continue to payment" iconRight="arrow-forward" onPress={handleProceed} disabled={!selectedChef} loading={processing} style={{ flex: 1 }} />
        </View>
      </StickyFooter>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing.screen, paddingBottom: spacing.xxxl },
  planCard: { backgroundColor: colors.primarySoft },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  chefCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chefCardSelected: { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.primarySoft },
  chefImage: { width: 56, height: 56, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  chefMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.primary },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
