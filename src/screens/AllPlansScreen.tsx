import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { api } from '../services/api';
import { getImageUrl } from '../config/api';
import { AppHeader } from '../components/common/AppHeader';
import { AppFooter } from '../components/common/AppFooter';

const { width } = Dimensions.get('window');

export default function AllPlansScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await api.user.getSubscriptionPlans();
      const planData = Array.isArray(res) ? res : res.plans || res.data || [];
      setPlans(planData);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSelectPlan = (plan: any) => {
    navigation.navigate('SelectHomeChef', { 
      planId: plan._id, 
      planName: plan.plan_name,
      amount: plan.total_amount,
      durationDays: plan.total_days,
      perDayValue: plan.per_day_value
    });
  };

  const renderPlan = (plan: any) => {
    const perDay = plan.per_day_value || Math.round(plan.total_amount / plan.total_days);
    
    // Priority: 1. banner_image, 2. image, 3. plan_image (per user request), 4. Hardcoded fallback
    let imgPath = plan.banner_image || plan.image || plan.plan_image;
    
    if (!imgPath) {
      // Hardcoded fallback based on days if no image is provided by API
      let path = 'weekly.png';
      if (plan.total_days <= 7) path = 'weekly.png';
      else if (plan.total_days <= 14) path = 'fortnightly.png';
      else path = 'monthly.png';
      imgPath = `/uploads/subscriptions/${path}`;
    }

    const bannerSource = { uri: getImageUrl(imgPath) };

    return (
      <View key={plan._id} style={styles.planCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          {bannerSource ? (
            <Image source={bannerSource} style={styles.headerImage} />
          ) : (
            <LinearGradient
              colors={['#4a4a4a', '#2d2d2d']}
              style={styles.headerGradient}
            >
              <MaterialCommunityIcons name="chef-hat" size={40} color="#cd853f" />
              <Text style={styles.planNameTitle}>{plan.plan_name}</Text>
            </LinearGradient>
          )}

          {/* Overlay for text legibility if image is present */}
          {bannerSource && (
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.imageOverlay}
            >
              <Text style={styles.planNameTitle}>{plan.plan_name}</Text>
            </LinearGradient>
          )}
          
          {plan.badge && (
            <LinearGradient
              colors={['#6366f1', '#a855f7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.badgeContainer}
            >
              <Text style={styles.badgeText}>{plan.badge.toUpperCase()}</Text>
            </LinearGradient>
          )}
        </View>

        {/* Price Section */}
        <View style={styles.priceSection}>
          <View style={styles.priceRow}>
            <Text style={styles.currencySymbol}>₹</Text>
            <Text style={styles.mainPrice}>{plan.total_amount}</Text>
          </View>
          <Text style={styles.priceForDays}>for {plan.total_days} days</Text>
          
          <View style={styles.perDayBadge}>
            <Text style={styles.perDayText}>₹ {perDay.toFixed(0)} per day</Text>
          </View>
        </View>

        {/* Features List */}
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Ionicons name="calendar-outline" size={18} color="#6366f1" />
            <Text style={styles.featureText}>{plan.total_days} Days Validity</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="cube-outline" size={18} color="#22c55e" />
            <Text style={styles.featureText}>Free Delivery on Monthly Plan</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="restaurant-outline" size={18} color="#a855f7" />
            <Text style={styles.featureText}>Daily Homemade Food (Lunch + Dinner)</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="star-outline" size={18} color="#eab308" />
            <Text style={styles.featureText}>Dabba Delights Priority Support</Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={18} color="#64748b" />
            <Text style={styles.featureText}>Daily menu items included</Text>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={() => handleSelectPlan(plan)}>
            <LinearGradient
              colors={['#6366f1', '#a855f7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.subscribeButton}
            >
              <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.detailsButton} onPress={() => {/* Show Details Modal */}}>
            <Text style={styles.detailsButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader showSearch={true} showBack={true} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPlans(); }} />
        }
      >
        <View style={styles.promoBanner}>
          <Ionicons name="gift-outline" size={24} color="#FF6B00" />
          <Text style={styles.promoText}>Save up to 30% with monthly subscription plans</Text>
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
        ) : (
          plans.map(renderPlan)
        )}
        <View style={{ height: 40 }} />
        <AppFooter />
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdf8f1', // Light cream background from screenshot
  },
  scrollContent: {
    paddingBottom: 20,
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffe5d6',
    gap: 10,
  },
  promoText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '600',
    flex: 1,
  },
  planCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardHeader: {
    height: 140,
    position: 'relative',
  },
  headerGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  headerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    justifyContent: 'flex-end',
    padding: 16,
  },
  planNameTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  badgeContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  priceSection: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#fff',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 4,
  },
  mainPrice: {
    fontSize: 44,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  priceForDays: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  perDayBadge: {
    backgroundColor: '#eefdf5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  perDayText: {
    color: '#16a34a',
    fontSize: 14,
    fontWeight: '600',
  },
  featuresList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#475569',
    flex: 1,
    lineHeight: 20,
  },
  buttonContainer: {
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  subscribeButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailsButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fdf8f1',
    borderWidth: 1,
    borderColor: '#ffe5d6',
  },
  detailsButtonText: {
    color: '#1a1a1a',
    fontSize: 15,
    fontWeight: '600',
  },
});
