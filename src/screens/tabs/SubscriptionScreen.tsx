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
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { AppFooter } from '../../components/common/AppFooter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getImageUrl } from '../../config/api';

// Direct imports for reliable bundling
// Local banners removed to fix build issues and support dynamic seeding
const BASE_IMAGE_URL = 'https://dabbanation.in';

const SUB_CACHE_KEY = 'subscription_screen_cache';

interface ActiveSubscription {
  _id: string;
  subscriptionPlan: {
    name: string;
    amount: number;
    durationDays: number;
  };
  homeChef: {
    shopName: string;
    name: string;
  };
  remainingBalance: number;
  remainingDays: number;
  status: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  total_days?: number;
  per_day_value?: number;
  createdAt: string;
}

export function SubscriptionScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptions, setSubscriptions] = useState<ActiveSubscription[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [activeTab, setActiveTab] = useState('my-plan');
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);

  const fetching = React.useRef(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    loadCachedData().then(() => {
      if (isFocused && !fetching.current) {
        loadData();
      }
    });
  }, [isFocused, activeTab]);

  const loadCachedData = async () => {
    try {
      const cached = await AsyncStorage.getItem(SUB_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        setSubscriptions(parsed.subscription || []);
        setHistory(parsed.history || []);
        setLoading(false);
      }
    } catch (e) {
      console.error('Error loading sub cache:', e);
    }
  };

  const loadData = async () => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    
    try {
      await Promise.all([
        fetchSubs(),
        fetchPlans(),
        activeTab === 'history' ? fetchHistory() : Promise.resolve()
      ]);
    } catch (error) {
      console.error('[SubscriptionScreen] Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetching.current = false;
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await api.user.getSubscriptionPlans();
      setPlans(response.plans || response || []);
    } catch (error) {
      console.error('[SubscriptionScreen] Error fetching plans:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await api.user.getSubscriptionHistory();
      const historyData = response.subscriptions || response || [];
      setHistory(historyData);
      
      // Update cache
      const cached = await AsyncStorage.getItem(SUB_CACHE_KEY);
      const parsed = cached ? JSON.parse(cached) : {};
      await AsyncStorage.setItem(SUB_CACHE_KEY, JSON.stringify({
        ...parsed,
        history: historyData,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('[SubscriptionScreen] Error fetching history:', error);
    }
  };

  const fetchSubs = async () => {
    try {
      console.log('[SubscriptionScreen] Fetching active subscriptions from /subscriptions/active...');
      const response = await api.user.getActiveSubscription();
      
      // Backend returns { success: true, subscription: { ... } }
      let subs = [];
      if (!response) {
        subs = [];
      } else if (response.subscription) {
        subs = [response.subscription];
      } else if (Array.isArray(response)) {
        subs = response;
      } else if (response.subscriptions) {
        subs = response.subscriptions;
      } else if (response.data) {
        subs = Array.isArray(response.data) ? response.data : (response.data.subscription ? [response.data.subscription] : []);
      }
      
      // Normalize data
      const normalizedSubs = subs.map((s: any) => ({
        ...s,
        remainingBalance: s.remaining_amount !== undefined ? s.remaining_amount : s.remainingBalance,
        remainingDays: s.remaining_days !== undefined ? s.remaining_days : s.remainingDays,
        totalAmount: s.total_amount !== undefined ? s.total_amount : s.totalAmount,
        endDate: s.endDate || s.updatedAt,
        subscriptionPlan: s.plan_id ? {
          name: s.plan_id.plan_name,
          amount: s.plan_id.total_amount,
          durationDays: s.plan_id.total_days,
          features: s.plan_id.features || []
        } : s.subscriptionPlan,
        homeChef: s.seller_id ? {
          _id: s.seller_id._id || s.seller_id,
          shopName: s.seller_id.businessName || s.seller_name,
          name: s.seller_id.name
        } : s.homeChef
      }));

      setSubscriptions(normalizedSubs);
      
      const total = normalizedSubs.reduce((acc: number, s: any) => 
        s.status === 'active' ? acc + (s.remainingBalance || 0) : acc, 0);
      setTotalBalance(total);

      // Update cache
      const cached = await AsyncStorage.getItem(SUB_CACHE_KEY);
      const parsed = cached ? JSON.parse(cached) : {};
      await AsyncStorage.setItem(SUB_CACHE_KEY, JSON.stringify({
        ...parsed,
        subscriptions: normalizedSubs,
        totalBalance: total,
        timestamp: Date.now()
      }));
    } catch (error: any) {
      console.error('[SubscriptionScreen] Error fetching subs:', error.message);
    }
  };

  const activePlans = subscriptions.filter(s => s.status === 'active');
  const pastPlans = subscriptions.filter(s => s.status !== 'active');

  const getProgress = (remaining: number, total: number) => {
    if (!total || total <= 0) return 0;
    const used = total - remaining;
    return Math.max(0, Math.min(100, (used / total) * 100));
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Subscriptions</Text>
      </View>

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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
        }
      >
        {activeTab === 'my-plan' && (
          <>
            {activePlans.length > 0 ? (
              activePlans.map(plan => (
                <View key={plan._id} style={styles.activePlanCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderMain}>
                      <View style={styles.planTitleRow}>
                        <Ionicons name="ribbon-outline" size={24} color="#4CAF50" />
                        <Text style={styles.activeTitle}>Active Subscription</Text>
                      </View>
                      <View style={styles.chefInfo}>
                        <Ionicons name="home-outline" size={14} color="#666" />
                        <Text style={styles.chefName}>For {plan.homeChef?.shopName || 'Home Chef'} (Home Chef)</Text>
                      </View>
                      <Text style={styles.planName}>{plan.subscriptionPlan?.name || '14 Days Plan'}</Text>
                    </View>
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>ACTIVE</Text>
                    </View>
                  </View>

                  {/* Balance Progress - Matching Website */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressLabelRow}>
                      <Text style={styles.progressLabel}>Remaining Balance</Text>
                      <Text style={styles.progressValue}>₹{plan.remainingBalance.toFixed(2)} / ₹{plan.totalAmount}</Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${100 - getProgress(plan.remainingBalance, plan.totalAmount)}%` }]} />
                    </View>
                    <Text style={styles.progressUsedText}>₹{(plan.totalAmount - plan.remainingBalance).toFixed(2)} used</Text>
                  </View>

                  {/* Days Progress - Matching Website */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressLabelRow}>
                      <Text style={styles.progressLabel}>Remaining Days</Text>
                      <Text style={styles.progressValue}>{plan.remainingDays} / {plan.total_days || plan.subscriptionPlan?.durationDays} days</Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${100 - getProgress(plan.remainingDays, plan.total_days || plan.subscriptionPlan?.durationDays)}%` }]} />
                    </View>
                    <Text style={styles.progressUsedText}>{(plan.total_days || plan.subscriptionPlan?.durationDays || 0) - plan.remainingDays} days used</Text>
                  </View>

                  {/* Stats Grid - Matching Website */}
                  <View style={styles.statsGrid}>
                    <View style={styles.gridBox}>
                      <Text style={styles.gridVal}>₹{plan.per_day_value?.toFixed(0) || '0'}</Text>
                      <Text style={styles.gridLabel}>Per Day Value</Text>
                    </View>
                    <View style={styles.gridBox}>
                      <Text style={styles.gridVal}>{plan.remainingDays}</Text>
                      <Text style={styles.gridLabel}>Days Left</Text>
                    </View>
                    <View style={styles.gridBox}>
                      <Text style={styles.gridVal}>₹{plan.remainingBalance.toFixed(0)}</Text>
                      <Text style={styles.gridLabel}>Balance Left</Text>
                    </View>
                    <View style={styles.gridBox}>
                      <Text style={styles.gridVal}>{Math.round(getProgress(plan.remainingDays, plan.total_days || plan.subscriptionPlan?.durationDays))}%</Text>
                      <Text style={styles.gridLabel}>Used</Text>
                    </View>
                  </View>

                  <View style={styles.activatedRow}>
                    <Ionicons name="time-outline" size={16} color="#888" />
                    <Text style={styles.activatedText}>Activated on {new Date(plan.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                  </View>

                  <TouchableOpacity 
                    style={styles.viewItemsBtn}
                    onPress={() => navigation.navigate('SubscriptionItems', { subscriptionId: plan._id })}
                  >
                    <Ionicons name="wallet-outline" size={20} color="#fff" />
                    <Text style={styles.viewItemsText}>View My Subscription Items</Text>
                    <Text style={styles.viewItemsPrice}>₹{plan.remainingBalance.toFixed(0)} available</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No active subscriptions</Text>
                <TouchableOpacity onPress={() => setActiveTab('plans')}>
                  <Text style={styles.browseText}>View All Plans</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {activeTab === 'plans' && (
          <View style={styles.plansContainer}>
            {plans.map((plan: any) => {
              // Resolve banner image
              // Resolve banner image
              let imgPath = plan.banner_image || plan.image || plan.plan_image;
              
              if (!imgPath) {
                // Fallback to a default based on days if no image provided by API
                let path = 'weekly.png';
                if (plan.total_days <= 7) path = 'weekly.png';
                else if (plan.total_days <= 14) path = 'fortnightly.png';
                else path = 'monthly.png';
                imgPath = `/uploads/subscriptions/${path}`;
              }

              const bannerSource = { uri: getImageUrl(imgPath) };

              const perDay = plan.per_day_value || Math.round(plan.total_amount / plan.total_days);

              return (
                <View key={plan._id} style={styles.premiumPlanCard}>
                  {/* Card Header with Image */}
                  <View style={styles.planImageContainer}>
                    <Image source={bannerSource} style={styles.planImage} resizeMode="cover" />
                    {plan.badge && (
                      <View style={styles.planBadge}>
                        <Text style={styles.planBadgeText}>{plan.badge}</Text>
                      </View>
                    )}
                    <View style={styles.imageOverlay}>
                      <Text style={styles.planNameTitle}>{plan.plan_name}</Text>
                    </View>
                  </View>

                  {/* Price Section */}
                  <View style={styles.premiumPriceSection}>
                    <View style={styles.premiumPriceRow}>
                      <Text style={styles.premiumCurrency}>₹</Text>
                      <Text style={styles.premiumAmount}>{plan.total_amount}</Text>
                    </View>
                    <Text style={styles.premiumDuration}>for {plan.total_days} days</Text>
                    <View style={styles.premiumPerDayBadge}>
                      <Text style={styles.premiumPerDayText}>₹{perDay} per day</Text>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.premiumButtonContainer}>
                    <TouchableOpacity 
                      style={styles.premiumSubscribeBtn}
                      onPress={() => navigation.navigate('SelectHomeChef', { 
                        planId: plan._id, 
                        planName: plan.plan_name,
                        amount: plan.total_amount,
                        durationDays: plan.total_days,
                        perDayValue: perDay
                      })}
                    >
                      <Text style={styles.premiumSubscribeText}>Subscribe Now</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.premiumDetailsBtn}
                      onPress={() => setSelectedPlan(plan)}
                    >
                      <Text style={styles.premiumDetailsText}>View Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

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
                  {Array.isArray(selectedPlan?.features) ? (
                    selectedPlan?.features.map((feature: string, idx: number) => (
                      <View key={idx} style={styles.modalFeatureItem}>
                        <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                        <Text style={styles.modalFeatureText}>{feature}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.modalFeatureItem}>
                      <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                      <Text style={styles.modalFeatureText}>{selectedPlan?.features || 'Daily menu items included'}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => {
                  if (selectedPlan) {
                    const perDay = selectedPlan.per_day_value || Math.round(selectedPlan.total_amount / selectedPlan.total_days);
                    navigation.navigate('SelectHomeChef', { 
                      planId: selectedPlan._id, 
                      planName: selectedPlan.plan_name,
                      amount: selectedPlan.total_amount,
                      durationDays: selectedPlan.total_days,
                      perDayValue: perDay
                    });
                    setSelectedPlan(null);
                  }
                }}
              >
                <Text style={styles.modalButtonText}>Purchase This Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {activeTab === 'history' && (
          <View style={{ gap: 12 }}>
            {history.length > 0 ? (
              history.map(plan => (
                <View key={plan._id} style={styles.historyCard}>
                  <Text style={styles.historyPlanName}>{plan.plan_id?.plan_name || 'Subscription Plan'}</Text>
                  <Text style={styles.historyChefInfo}>@ {plan.seller_id?.businessName || 'Home Chef'} (Home Chef)</Text>
                  <Text style={styles.historyDate}>{new Date(plan.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                  
                  <View style={styles.historyStatsRow}>
                    <View style={styles.historyStatItem}>
                      <Text style={styles.historyStatLabel}>Total</Text>
                      <Text style={styles.historyStatValue}>₹{plan.total_amount}</Text>
                    </View>
                    <View style={styles.historyStatItem}>
                      <Text style={styles.historyStatLabel}>Used</Text>
                      <Text style={styles.historyStatValue}>₹{(plan.total_amount - plan.remaining_amount).toFixed(2)}</Text>
                    </View>
                    <View style={styles.historyStatItem}>
                      <Text style={styles.historyStatLabel}>Days</Text>
                      <Text style={styles.historyStatValue}>{plan.total_days - plan.remaining_days}/{plan.total_days}</Text>
                    </View>
                  </View>

                  <View style={[
                    styles.historyStatusBar, 
                    { backgroundColor: plan.status === 'active' ? '#4CAF50' : '#666' }
                  ]}>
                    <Text style={styles.historyStatusText}>{plan.status}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No subscription history</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
        <AppFooter />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeTab: {
    backgroundColor: '#fff',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
  },
  activePlanCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#4CAF50', // Website's green border
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  cardHeaderMain: {
    flex: 1,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  activeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  chefInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  chefName: {
    fontSize: 14,
    color: '#666',
  },
  planName: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  progressBar: {
    height: 10,
    backgroundColor: '#eee',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#D32F2F', // Website's red progress bars
  },
  progressUsedText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 24,
  },
  gridBox: {
    flex: 1,
    backgroundColor: '#f3e5ab', // Website's cream background
    paddingVertical: 15,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  gridLabel: {
    fontSize: 10,
    color: '#8b7355',
    marginTop: 4,
    textAlign: 'center',
  },
  activatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 15,
  },
  activatedText: {
    fontSize: 13,
    color: '#888',
  },
  viewItemsBtn: {
    backgroundColor: '#00897B', // Website's dark green button
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 10,
  },
  viewItemsText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  viewItemsPrice: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  plansContainer: {
    paddingBottom: 20,
    gap: 16,
  },
  premiumPlanCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 24,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  planImageContainer: {
    height: 200,
    position: 'relative',
  },
  planImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  planNameTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  planBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
  },
  planBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  premiumPriceSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  premiumPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  premiumCurrency: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 4,
  },
  premiumAmount: {
    fontSize: 44,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  premiumDuration: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  premiumPerDayBadge: {
    backgroundColor: '#eefdf5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  premiumPerDayText: {
    color: '#16a34a',
    fontSize: 14,
    fontWeight: '600',
  },
  premiumButtonContainer: {
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  premiumSubscribeBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumSubscribeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  premiumDetailsBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#fdf8f1',
    borderWidth: 1,
    borderColor: '#ffe5d6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumDetailsText: {
    color: '#1a1a1a',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
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
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalBody: {
    flex: 1,
  },
  modalPriceContainer: {
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  modalPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  modalDuration: {
    fontSize: 14,
    color: '#666',
  },
  modalDescription: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalFeatures: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
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
    color: '#475569',
  },
  modalButton: {
    backgroundColor: '#FF6B00',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  historyPlanName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  historyChefInfo: {
    fontSize: 13,
    color: '#888',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
  },
  historyStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  historyStatItem: {
    flex: 1,
  },
  historyStatLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  historyStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  historyStatusBar: {
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  browseText: {
    color: '#FF6B00',
    fontWeight: 'bold',
    marginTop: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
