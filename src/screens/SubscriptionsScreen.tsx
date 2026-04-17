import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import api, { API_ENDPOINTS } from '../config/api';
import { RootStackParamList } from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Subscription {
  _id: string;
  subscriptionPlan: {
    name: string;
    amount: number;
    durationDays: number;
  };
  homeChef: {
    name: string;
    shopName: string;
    phone: string;
  };
  remainingBalance: number;
  remainingDays: number;
  status: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
}

export default function SubscriptionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const [subsRes, balanceRes] = await Promise.all([
        api.get(API_ENDPOINTS.MY_SUBSCRIPTIONS),
        api.get(API_ENDPOINTS.SUBSCRIPTION_BALANCE),
      ]);
      setSubscriptions(subsRes.data.data || []);
      setTotalBalance(balanceRes.data.data?.totalBalance || 0);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSubscriptions();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#22C55E';
      case 'expired':
        return '#EF4444';
      case 'exhausted':
        return '#F59E0B';
      default:
        return '#888';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Subscriptions</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('SubscriptionPlans')}
        >
          <Ionicons name="add" size={24} color="#FF6B00" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B00']} />
        }
      >
        {/* Total Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceIcon}>
            <Ionicons name="wallet" size={32} color="#FF6B00" />
          </View>
          <View style={styles.balanceInfo}>
            <Text style={styles.balanceLabel}>Total Available Balance</Text>
            <Text style={styles.balanceAmount}>Rs. {totalBalance}</Text>
            <Text style={styles.balanceHint}>Use this balance for your orders</Text>
          </View>
        </View>

        {/* Active Subscriptions */}
        {subscriptions.filter((s) => s.status === 'active').length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Subscriptions</Text>
            {subscriptions
              .filter((s) => s.status === 'active')
              .map((subscription) => (
                <View key={subscription._id} style={styles.subscriptionCard}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.planName}>
                        {subscription.subscriptionPlan?.name || 'Subscription Plan'}
                      </Text>
                      <Text style={styles.chefName}>
                        {subscription.homeChef?.shopName || subscription.homeChef?.name}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(subscription.status) + '20' },
                      ]}
                    >
                      <Text
                        style={[styles.statusText, { color: getStatusColor(subscription.status) }]}
                      >
                        {subscription.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.balanceRow}>
                    <View style={styles.balanceItem}>
                      <Text style={styles.balanceItemLabel}>Remaining Balance</Text>
                      <Text style={styles.balanceItemValue}>
                        Rs. {subscription.remainingBalance}
                      </Text>
                    </View>
                    <View style={styles.balanceItem}>
                      <Text style={styles.balanceItemLabel}>Days Left</Text>
                      <Text style={styles.balanceItemValue}>{subscription.remainingDays}</Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${
                              (subscription.remainingBalance / subscription.totalAmount) * 100
                            }%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {Math.round(
                        (subscription.remainingBalance / subscription.totalAmount) * 100
                      )}
                      % remaining
                    </Text>
                  </View>

                  <View style={styles.dateRow}>
                    <View style={styles.dateItem}>
                      <Ionicons name="calendar-outline" size={14} color="#888" />
                      <Text style={styles.dateText}>
                        Start: {formatDate(subscription.startDate)}
                      </Text>
                    </View>
                    <View style={styles.dateItem}>
                      <Ionicons name="calendar-outline" size={14} color="#888" />
                      <Text style={styles.dateText}>End: {formatDate(subscription.endDate)}</Text>
                    </View>
                  </View>
                </View>
              ))}
          </View>
        )}

        {/* Past Subscriptions */}
        {subscriptions.filter((s) => s.status !== 'active').length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Past Subscriptions</Text>
            {subscriptions
              .filter((s) => s.status !== 'active')
              .map((subscription) => (
                <View key={subscription._id} style={[styles.subscriptionCard, styles.pastCard]}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.planName}>
                        {subscription.subscriptionPlan?.name || 'Subscription Plan'}
                      </Text>
                      <Text style={styles.chefName}>
                        {subscription.homeChef?.shopName || subscription.homeChef?.name}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(subscription.status) + '20' },
                      ]}
                    >
                      <Text
                        style={[styles.statusText, { color: getStatusColor(subscription.status) }]}
                      >
                        {subscription.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.dateRow}>
                    <Text style={styles.pastDateText}>
                      {formatDate(subscription.startDate)} - {formatDate(subscription.endDate)}
                    </Text>
                    <Text style={styles.pastAmountText}>Rs. {subscription.totalAmount}</Text>
                  </View>
                </View>
              ))}
          </View>
        )}

        {/* Empty State */}
        {subscriptions.length === 0 && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="card-outline" size={48} color="#ccc" />
            </View>
            <Text style={styles.emptyTitle}>No Subscriptions Yet</Text>
            <Text style={styles.emptyText}>
              Subscribe to home chefs and get daily homemade meals
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('SubscriptionPlans')}
            >
              <Text style={styles.emptyBtnText}>Browse Plans</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  balanceIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 2,
  },
  balanceHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  subscriptionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
  },
  pastCard: {
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  chefName: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  balanceRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  balanceItem: {
    flex: 1,
  },
  balanceItemLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  balanceItemValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B00',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: '#888',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#888',
    marginLeft: 4,
  },
  pastDateText: {
    fontSize: 13,
    color: '#888',
  },
  pastAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
