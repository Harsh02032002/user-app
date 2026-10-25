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
import { getImageUrl, getSubscriptionPlanImage } from '../config/api';
import { AppHeader } from '../components/common/AppHeader';
import { AppFooter } from '../components/common/AppFooter';
import { colors, fonts } from '../theme';

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
    const bannerSource = getSubscriptionPlanImage(plan);

    return (
      <View key={plan._id} style={styles.planCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          {bannerSource ? (
            <Image source={bannerSource} style={styles.headerImage} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={[colors.textSecondary, colors.text]}
              style={styles.headerGradient}
            >
              <MaterialCommunityIcons name="chef-hat" size={40} color={colors.primary} />
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
              colors={[colors.primary, colors.primaryGradientEnd]}
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
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.featureText}>{plan.total_days} Days Validity</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="cube-outline" size={18} color={colors.success} />
            <Text style={styles.featureText}>Free Delivery on Monthly Plan</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="restaurant-outline" size={18} color={colors.primaryGradientEnd} />
            <Text style={styles.featureText}>Daily Homemade Food (Lunch + Dinner)</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="star-outline" size={18} color={colors.warning} />
            <Text style={styles.featureText}>Dabba Delights Priority Support</Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={18} color={colors.textSecondary} />
            <Text style={styles.featureText}>Daily menu items included</Text>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={() => handleSelectPlan(plan)}>
            <LinearGradient
              colors={[colors.primary, colors.primaryGradientEnd]}
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
          <Ionicons name="gift-outline" size={24} color={colors.primary} />
          <Text style={styles.promoText}>Save up to 30% with monthly subscription plans</Text>
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
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
    backgroundColor: colors.canvas, // Light cream background from screenshot
  },
  scrollContent: {
    paddingBottom: 20,
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    margin: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    gap: 10,
  },
  promoText: {
    fontSize: 14,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    flex: 1,
  },
  planCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#403126',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.white,
    fontSize: 22,
    fontFamily: fonts.displayBold,
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
    color: colors.white,
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  priceSection: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: colors.surface,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  currencySymbol: {
    fontSize: 24,
    fontFamily: fonts.semiBold,
    color: colors.text,
    marginTop: 4,
  },
  mainPrice: {
    fontSize: 44,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  priceForDays: {
    fontSize: 16, fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  perDayBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.successSoft,
  },
  perDayText: {
    color: colors.success,
    fontSize: 14,
    fontFamily: fonts.semiBold,
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
    fontSize: 14, fontFamily: fonts.regular,
    color: colors.textSecondary,
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
    color: colors.white,
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  detailsButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.inputFill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  detailsButtonText: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
});
