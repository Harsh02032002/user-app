import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import api, { API_ENDPOINTS } from '../config/api';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Badge, Button, Card, Divider, EmptyState, IconButton, ScreenHeader, SkeletonList } from '../components/common';
import { colors, formatPrice, radius, spacing, type } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Subscription {
  _id: string;
  plan_id?: {
    _id: string;
    plan_name: string;
    description?: string;
  };
  seller_id?: {
    _id: string;
    businessName: string;
    type: string;
    logo?: string;
  };
  total_amount: number;
  remaining_amount: number;
  total_days: number;
  remaining_days: number;
  per_day_value: number;
  status: "active" | "expired";
  createdAt: string;
  updatedAt: string;
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
      // Exact same API as web app: /subscriptions/active
      const activeRes = await api.get('/subscriptions/active');
      console.log('[Subscriptions] Response from /subscriptions/active:', activeRes.data);
      const subscription = activeRes.data?.subscription || activeRes.data?.data?.subscription;
      
      if (subscription) {
        console.log('[Subscriptions] Active subscription found:', subscription._id);
        // Convert single subscription to array format for UI
        setSubscriptions([subscription]);
        setTotalBalance(subscription.remaining_amount || 0);
      } else {
        console.log('[Subscriptions] No active subscription found in response');
        // If /active returns nothing, try /my-subscriptions (the history one)
        const allRes = await api.get('/subscriptions/my-subscriptions');
        const allSubs = allRes.data?.subscriptions || allRes.data?.data?.subscriptions || [];
        console.log('[Subscriptions] All subscriptions found:', allSubs.length);
        setSubscriptions(allSubs);
        
        // Calculate total balance from all active subs if needed
        const activeSubs = allSubs.filter((s: any) => s.status === 'active');
        const balance = activeSubs.reduce((sum: number, s: any) => sum + (s.remaining_amount || 0), 0);
        setTotalBalance(balance);
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      setSubscriptions([]);
      setTotalBalance(0);
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
        return colors.success;
      case 'expired':
        return colors.danger;
      case 'exhausted':
        return colors.warning;
      default:
        return colors.textTertiary;
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

  const active = subscriptions.filter((s) => s.status === 'active');
  const past = subscriptions.filter((s) => s.status !== 'active');

  const header = (
    <ScreenHeader
      title="My subscriptions"
      right={<IconButton icon="add" accessibilityLabel="Browse plans" color={colors.primary} onPress={() => navigation.navigate('SubscriptionPlans')} />}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {header}
        <View style={{ padding: spacing.screen }}><SkeletonList count={2} imageSize={48} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {header}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <View style={styles.balanceCard}>
          <Text style={[type.overline, { color: 'rgba(255,255,255,0.85)' }]}>Total plan balance</Text>
          <Text style={styles.balanceAmount}>{formatPrice(totalBalance)}</Text>
          <Text style={[type.caption, { color: 'rgba(255,255,255,0.85)' }]}>Used automatically when you order from your home chef</Text>
        </View>

        {subscriptions.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No subscriptions yet"
            subtitle="Subscribe to a home chef and get daily homemade meals."
            actionText="Browse plans"
            onAction={() => navigation.navigate('SubscriptionPlans')}
          />
        ) : null}

        {active.length > 0 ? (
          <>
            <Text style={[type.overline, styles.label]}>Active</Text>
            {active.map((subscription) => {
              const pct = subscription.total_amount ? Math.max(0, Math.min(1, subscription.remaining_amount / subscription.total_amount)) : 0;
              return (
                <Card key={subscription._id}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={type.subheading} numberOfLines={1}>{subscription.plan_id?.plan_name || 'Subscription plan'}</Text>
                      <Text style={type.caption} numberOfLines={1}>{subscription.seller_id?.businessName || 'Home chef'}</Text>
                    </View>
                    <Badge text="Active" variant="success" />
                  </View>
                  <View style={styles.stats}>
                    <View style={styles.stat}>
                      <Text style={type.caption}>Balance left</Text>
                      <Text style={[type.price, { fontSize: 18 }]}>{formatPrice(subscription.remaining_amount)}</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={type.caption}>Days left</Text>
                      <Text style={[type.price, { fontSize: 18 }]}>{subscription.remaining_days}<Text style={type.caption}> / {subscription.total_days}</Text></Text>
                    </View>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.trackFill, { width: `${pct * 100}%` }]} />
                  </View>
                  <View style={styles.cardFooter}>
                    <Text style={type.caption}>{Math.round(pct * 100)}% balance remaining · started {formatDate(subscription.createdAt)}</Text>
                  </View>
                  <Button
                    title="View plan items"
                    variant="secondary"
                    size="sm"
                    iconRight="chevron-forward"
                    onPress={() => navigation.navigate('SubscriptionItems', { subscriptionId: subscription._id })}
                    style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
                  />
                </Card>
              );
            })}
          </>
        ) : null}

        {past.length > 0 ? (
          <>
            <Text style={[type.overline, styles.label]}>Past</Text>
            <Card padded={false}>
              {past.map((subscription, index) => (
                <View key={subscription._id}>
                  {index > 0 ? <Divider style={{ marginHorizontal: spacing.lg }} /> : null}
                  <View style={styles.pastRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={type.subheading} numberOfLines={1}>{subscription.plan_id?.plan_name || 'Subscription plan'}</Text>
                      <Text style={type.caption} numberOfLines={1}>
                        {subscription.seller_id?.businessName || 'Home chef'} · {formatDate(subscription.createdAt)}
                      </Text>
                    </View>
                    <Badge text={String(subscription.status)} variant={subscription.status === 'expired' ? 'danger' : 'warning'} />
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxxl },
  balanceCard: { borderRadius: radius.lg, padding: spacing.xl, backgroundColor: colors.primary, gap: 2 },
  balanceAmount: { ...type.display, fontSize: 30, lineHeight: 38, color: colors.textInverse, fontVariant: ['tabular-nums'] },
  label: { marginTop: spacing.md, marginLeft: spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  stat: { flex: 1, gap: 2, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, marginTop: spacing.md, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  cardFooter: { marginTop: spacing.sm },
  pastRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
});
