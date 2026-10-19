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
import { SafeAreaView } from 'react-native-safe-area-context';
import { SegmentedControl, Skeleton, EmptyState } from '../components/common';
import { PlanCard } from '../components/cards';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import api, { API_ENDPOINTS, getImageUrl, getSubscriptionPlanImage } from '../config/api';
import { RootStackParamList } from '../navigation/RootNavigator';
import { AppHeader } from '../components/common/AppHeader';
import { colors, fonts, radius, spacing, type } from '../theme';

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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ padding: spacing.screen, gap: spacing.md }}>
          <Skeleton width="50%" height={30} />
          <Skeleton height={44} radius={14} />
          <Skeleton height={220} radius={radius.xl} />
          <Skeleton height={220} radius={radius.xl} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.pageHeader}>
        <Text style={type.display}>Tiffin plans</Text>
        <Text style={[type.body, { color: colors.textSecondary }]}>Prepaid daily meals from one home kitchen.</Text>
      </View>
      <SegmentedControl
        style={{ marginHorizontal: spacing.screen, marginBottom: spacing.md }}
        value={activeTab as any}
        onChange={(k: any) => setActiveTab(k)}
        options={[
          { key: 'plans', label: 'Plans' },
          { key: 'my-plan', label: 'My plan' },
          { key: 'history', label: 'History' },
        ] as any}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAllData(); }} colors={[colors.primary]} tintColor={colors.primary} />
        }
      >
        {activeTab === 'plans' && (
          <View style={{ gap: spacing.md }}>
            {plans.length === 0 ? (
              <EmptyState icon="calendar-outline" title="No plans right now" subtitle="New tiffin plans will show up here." />
            ) : (
              plans.map((plan) => (
                <PlanCard
                  key={plan._id}
                  plan={{ ...plan, per_day_value: plan.per_day_value ? Math.round(plan.per_day_value) : undefined } as any}
                  onPress={() => setSelectedPlan(plan)}
                  onSubscribe={() => handleSelectPlan(plan)}
                />
              ))
            )}

            <View style={styles.howItWorks}>
              <Text style={[type.overline, { marginBottom: spacing.sm }]}>How plans work</Text>
              {[
                ['wallet-outline', 'Pay once for the whole plan.'],
                ['home-outline', 'Pick the home kitchen that will cook for you.'],
                ['restaurant-outline', 'Order from that kitchen as usual — your plan balance is used automatically.'],
              ].map(([icon, text]) => (
                <View key={text} style={styles.howRow}>
                  <Ionicons name={icon as any} size={18} color={colors.text} />
                  <Text style={[type.small, { flex: 1 }]}>{text}</Text>
                </View>
              ))}
            </View>
          </View>
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
                            <Ionicons name="home" size={14} color="#FF6B00" />
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
                     <Ionicons name="chevron-forward" size={16} color="#fff" />
                   </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={64} color="#ccc" />
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
                    { backgroundColor: sub.status === 'active' ? '#dcfce7' : '#f1f5f9' }
                  ]}>
                    <Text style={[
                      styles.historyStatusText,
                      { color: sub.status === 'active' ? '#16a34a' : '#64748b' }
                    ]}>
                      {sub.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={64} color="#ccc" />
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
                <Ionicons name="close" size={28} color="#666" />
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
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    <Text style={styles.modalFeatureText}>{feature}</Text>
                  </View>
                )) || (
                  <View style={styles.modalFeatureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageHeader: { paddingHorizontal: spacing.screen, paddingTop: spacing.md, paddingBottom: spacing.lg },
  howItWorks: { marginTop: spacing.sm, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },

  container: {
    flex: 1,
    backgroundColor: colors.canvas, // Light cream background from screenshot
  },
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: spacing.screen,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.text,
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
    borderColor: colors.border,
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
    shadowColor: '#000',
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
    backgroundColor: colors.canvas,
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
    color: colors.surface,
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
    color: colors.surface,
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
    fontFamily: fonts.bold,
    color: colors.text,
    marginTop: 4,
  },
  mainPrice: {
    fontSize: 44,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  priceForDays: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 12, fontFamily: fonts.regular,
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
    fontFamily: fonts.bold,
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
    lineHeight: 20, fontFamily: fonts.regular,
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
    color: colors.surface,
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  detailsButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailsButtonText: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.bold,
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
    fontFamily: fonts.bold,
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
    fontSize: 14,
    color: colors.textSecondary, fontFamily: fonts.regular,
  },
  modalDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24, fontFamily: fonts.regular,
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
    fontSize: 14,
    color: '#475569', fontFamily: fonts.regular,
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
    color: colors.surface,
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
    backgroundColor: colors.canvas,
  },
  activeTab: {
    backgroundColor: colors.text,
  },
  tabText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.surface,
  },
  tabContent: {
    paddingVertical: spacing.xs,
  },
  activePlanCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
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
    fontFamily: fonts.bold,
    color: colors.text,
  },
  activeBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: colors.surface,
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  activePlanChef: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    marginLeft: 32, // Offset for logo, fontFamily: fonts.regular,
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
    backgroundColor: colors.canvas,
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
    backgroundColor: colors.canvas,
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
    fontSize: 11,
    color: '#8b7355',
    marginTop: 2, fontFamily: fonts.regular,
  },
  usageBtn: {
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  usageBtnText: {
    color: colors.surface,
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
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4, fontFamily: fonts.regular,
  },
  historyStatus: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.border,
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
    fontSize: 16,
    color: colors.textTertiary,
    marginTop: 16,
    textAlign: 'center', fontFamily: fonts.regular,
  },
  browseBtn: {
    marginTop: 20,
    backgroundColor: colors.canvas,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  browseBtnText: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
});
