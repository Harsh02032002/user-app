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
  Modal,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute, RouteProp, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api, { API_ENDPOINTS, getImageUrl, getSubscriptionPlanImage } from '../config/api';
import { RootStackParamList } from '../navigation/RootNavigator';
import { AppHeader } from '../components/common/AppHeader';
import { colors, fonts } from '../theme';

const { width } = Dimensions.get('window');

const getBannerSource = (item: any) => getSubscriptionPlanImage(item);

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SubscriptionPlan {
  _id: string;
  plan_name: string;
  total_amount: number;
  total_days: number;
  per_day_value: number;
  description?: string;
  banner_image?: string;
  badge?: string;
  features?: string[];
}

type RouteType = RouteProp<RootStackParamList, 'SubscriptionPlans'>;

export default function SubscriptionPlansScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  
  // New States for My Plan and History
  const [activeTab, setActiveTab] = useState<'plans' | 'my-plan' | 'history'>('plans');
  const [activeSubscriptions, setActiveSubscriptions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  const isFocused = useIsFocused();
  const fetching = React.useRef(false);

  const loadAllData = React.useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    console.log('[SubscriptionPlansScreen] Loading all data...');
    try {
      await Promise.all([
        fetchPlans(),
        fetchActiveSubs(),
        fetchHistory()
      ]);
    } catch (err) {
      console.error('[SubscriptionPlansScreen] Error loading data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetching.current = false;
      console.log('[SubscriptionPlansScreen] Data loading complete.');
    }
  }, []);

  const lastFetchedFocus = React.useRef(false);

  useEffect(() => {
    if (isFocused && !lastFetchedFocus.current) {
      loadAllData();
      lastFetchedFocus.current = true;
      setMounted(true);
    } else if (!isFocused) {
      lastFetchedFocus.current = false;
    }
  }, [isFocused, loadAllData]);

  // Set active tab based on route params if provided
  useEffect(() => {
    if (route.params?.activeTab) {
      setActiveTab(route.params.activeTab as any);
    }
  }, [route.params?.activeTab]);

  // Auto-select plan from route params
  useEffect(() => {
    if (route.params?.planId && plans.length > 0 && !hasAutoOpened) {
      const plan = plans.find(p => p._id === route.params?.planId);
      if (plan) {
        setSelectedPlan(plan);
        setHasAutoOpened(true);
        setActiveTab('plans'); // Ensure we are on plans tab
      }
    }
  }, [route.params?.planId, plans, hasAutoOpened]);

  const fetchActiveSubs = async () => {
    try {
      const res = await api.get('/subscriptions/active');
      console.log('[SubscriptionPlansScreen] RAW DATA:', JSON.stringify(res.data));
      
      // Handle all possible response structures (res.data.subscriptions or res.data.data.subscriptions or res.data.subscription)
      let subs = [];
      if (res.data?.subscriptions) {
        subs = res.data.subscriptions;
      } else if (res.data?.data?.subscriptions) {
        subs = res.data.data.subscriptions;
      } else if (res.data?.subscription) {
        // Fallback for single object
        subs = [res.data.subscription];
      } else if (res.data?.data?.subscription) {
        subs = [res.data.data.subscription];
      }

      console.log('[SubscriptionPlansScreen] Final subscriptions array:', subs.length);
      setActiveSubscriptions(Array.isArray(subs) ? subs : []);
    } catch (e) {
      console.error('Error fetching active subs:', e);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/subscriptions/my-subscriptions');
      const subs = res.data?.subscriptions || res.data?.data?.subscriptions || [];
      setHistory(subs);
    } catch (e) {
      console.error('Error fetching history:', e);
    }
  };

  const fetchPlans = async () => {
    try {
      setError(null);
      const response = await api.get(API_ENDPOINTS.SUBSCRIPTION_PLANS + '?active=true');
      const plansData = response.data?.plans || response.data?.data || [];
      setPlans(plansData);
    } catch (error: any) {
      console.error('Error fetching plans:', error);
      setError(error?.response?.data?.message || 'Failed to load plans');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPlans();
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    navigation.navigate('SelectHomeChef', {
      planId: plan._id,
      planName: plan.plan_name,
      amount: plan.total_amount,
      durationDays: plan.total_days,
      perDayValue: plan.per_day_value,
    });
  };

  if (loading && !mounted) {
    return (
      <View style={styles.container}>
        <AppHeader showSearch={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading premium plans...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader showSearch={true} />
      
      {/* Tabs Switcher - Matching Website */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'plans' && styles.activeTab]}
          onPress={() => setActiveTab('plans')}
        >
          <Text style={[styles.tabText, activeTab === 'plans' && styles.activeTabText]}>Plans</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'my-plan' && styles.activeTab]}
          onPress={() => setActiveTab('my-plan')}
        >
          <Text style={[styles.tabText, activeTab === 'my-plan' && styles.activeTabText]}>My Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>History</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAllData(); }} colors={[colors.primary]} />
        }
      >
        {activeTab === 'plans' && (
          <>
            {/* Top Promo Banner */}
            <View style={styles.promoBanner}>
              <Ionicons name="gift-outline" size={20} color={colors.primary} />
              <Text style={styles.promoText}>Save up to 30% with monthly subscription plans</Text>
            </View>

            {plans.map((plan, index) => {
              const perDay = plan.per_day_value || Math.round(plan.total_amount / plan.total_days);
              
              // Resolve banner image reliably using local assets (backend URLs are currently broken)
              const bannerSource = getBannerSource(plan);


              return (
                <View key={plan._id} style={styles.planCard}>
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    {bannerSource ? (
                      <Image 
                        source={bannerSource} 
                        style={styles.headerImage} 
                        contentFit="cover"
                        onLoad={() => console.log(`[SubscriptionPlansScreen] Image loaded successfully: ${plan.plan_name}`)}
                        onError={(err) => console.error(`[SubscriptionPlansScreen] Image load failed for ${plan.plan_name}:`, err)}
                      />
                    ) : (
                      <LinearGradient
                        colors={[colors.textSecondary, colors.text]}
                        style={styles.headerGradient}
                      >
                        <MaterialCommunityIcons name="chef-hat" size={40} color={colors.primary} />
                        <Text style={styles.planNameTitle}>{plan.plan_name}</Text>
                      </LinearGradient>
                    )}
                    
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

                  <View style={styles.priceSection}>
                    <View style={styles.priceRow}>
                      <Text style={styles.currencySymbol}>₹</Text>
                      <Text style={styles.mainPrice}>{plan.total_amount}</Text>
                    </View>
                    <Text style={styles.priceForDays}>for {plan.total_days} days</Text>
                    <View style={styles.perDayBadge}>
                      <Text style={styles.perDayText}>₹{Math.round(Number(perDay))} per day</Text>
                    </View>
                  </View>

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

                    <TouchableOpacity 
                      style={styles.detailsButton} 
                      onPress={() => setSelectedPlan(plan)}
                    >
                      <Text style={styles.detailsButtonText}>View Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {activeTab === 'my-plan' && (
          <View style={styles.tabContent}>
            {activeSubscriptions.length > 0 ? (
              activeSubscriptions.map((sub: any) => (
                <View key={sub._id} style={styles.activePlanCard}>
                   <View style={styles.activePlanHeader}>
                      <View style={styles.activePlanChefInfo}>
                        {sub.seller_id?.logo ? (
                          <Image 
                            source={{ uri: getImageUrl(sub.seller_id.logo) || undefined }} 
                            style={styles.chefSmallLogo} 
                          />
                        ) : (
                          <View style={styles.chefSmallLogoPlaceholder}>
                            <Ionicons name="home" size={14} color={colors.primary} />
                          </View>
                        )}
                        <Text style={styles.activePlanTitle}>{sub.plan_id?.plan_name || 'Active Plan'}</Text>
                      </View>
                      <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>ACTIVE</Text></View>
                   </View>
                   <Text style={styles.activePlanChef}>Chef: {sub.seller_id?.businessName || 'Home Chef'}</Text>
                   
                   <View style={styles.statsRow}>
                      <View style={styles.statBox}>
                        <Text style={styles.statVal}>₹{sub.remaining_amount}</Text>
                        <Text style={styles.statLabel}>Balance</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statVal}>{sub.remaining_days}</Text>
                        <Text style={styles.statLabel}>Days Left</Text>
                      </View>
                   </View>

                   <TouchableOpacity 
                    style={styles.usageBtn}
                    onPress={() => navigation.navigate('SubscriptionItems' as any, { subscriptionId: sub._id })}
                   >
                     <Text style={styles.usageBtnText}>View Usage History</Text>
                     <Ionicons name="chevron-forward" size={16} color={colors.white} />
                   </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={64} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No active subscriptions</Text>
                <TouchableOpacity onPress={() => setActiveTab('plans')} style={styles.browseBtn}>
                  <Text style={styles.browseBtnText}>Browse All Plans</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {activeTab === 'history' && (
          <View style={styles.tabContent}>
            {history.length > 0 ? (
              history.map((sub: any) => (
                <View key={sub._id} style={styles.historyCard}>
                  <Text style={styles.historyPlanName}>{sub.plan_id?.plan_name || 'Past Plan'}</Text>
                  <Text style={styles.historyDate}>Started: {new Date(sub.createdAt).toLocaleDateString()}</Text>
                  <View style={[
                    styles.historyStatus, 
                    { backgroundColor: sub.status === 'active' ? colors.successSoft : colors.inputFill }
                  ]}>
                    <Text style={[
                      styles.historyStatusText,
                      { color: sub.status === 'active' ? colors.success : colors.textSecondary }
                    ]}>
                      {sub.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={64} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No subscription history</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Plan Details Modal */}
      <Modal
        visible={!!selectedPlan}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedPlan(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedPlan?.plan_name}</Text>
              <TouchableOpacity onPress={() => setSelectedPlan(null)}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
              <View style={styles.modalPriceContainer}>
                <Text style={styles.modalPrice}>₹{selectedPlan?.total_amount}</Text>
                <Text style={styles.modalDuration}>for {selectedPlan?.total_days} days</Text>
              </View>

              <Text style={styles.modalDescription}>{selectedPlan?.description}</Text>

              <View style={styles.modalFeatures}>
                <Text style={styles.featuresTitle}>What's Included:</Text>
                {selectedPlan?.features?.map((feature, idx) => (
                  <View key={idx} style={styles.modalFeatureItem}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={styles.modalFeatureText}>{feature}</Text>
                  </View>
                )) || (
                  <View style={styles.modalFeatureItem}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={styles.modalFeatureText}>Daily menu items included</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={styles.modalButton}
              onPress={() => {
                if (selectedPlan) {
                  handleSelectPlan(selectedPlan);
                  setSelectedPlan(null);
                }
              }}
            >
              <Text style={styles.modalButtonText}>Purchase This Plan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.primary,
    fontFamily: fonts.medium,
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
    fontSize: 13,
    color: colors.text,
    fontFamily: fonts.medium,
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
    height: 200,
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
    top: 0,
    left: 0,
    backgroundColor: colors.inputFill,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '35%',
    justifyContent: 'flex-end',
    padding: 16,
  },
  planNameTitle: {
    color: colors.white,
    fontSize: 22,
    fontFamily: fonts.bold,
    ...Platform.select<any>({
      web: { textShadow: '-1px 1px 10px rgba(0, 0, 0, 0.75)' },
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
      },
    }),
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '60%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: fonts.displayBold,
    color: colors.text,
  },
  modalBody: {
    flex: 1,
  },
  modalPriceContainer: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  modalPrice: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  modalDuration: {
    fontSize: 14, fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  modalDescription: {
    fontSize: 15, fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  modalFeatures: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 12,
  },
  modalFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  modalFeatureText: {
    fontSize: 14, fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  modalButton: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  modalButtonText: {
    color: colors.white,
    fontSize: 18,
    fontFamily: fonts.bold,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.inputFill,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.white,
  },
  tabContent: {
    padding: 16,
  },
  activePlanCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#403126',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
  },
  activePlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activePlanTitle: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
    color: colors.text,
  },
  activeBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  activePlanChef: {
    fontSize: 14, fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: 20,
    marginLeft: 32, // Offset for logo
  },
  activePlanChefInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  chefSmallLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.inputFill,
  },
  chefSmallLogoPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.inputFill,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: 11, fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  usageBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  usageBtnText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyPlanName: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  historyDate: {
    fontSize: 12, fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginTop: 4,
  },
  historyStatus: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.inputFill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  historyStatusText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16, fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginTop: 16,
    textAlign: 'center',
  },
  browseBtn: {
    marginTop: 20,
    backgroundColor: colors.inputFill,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  browseBtnText: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
});
