/**
 * My Subscription Items — dishes included in the user's active plan (mirrors the website's
 * /subscription-items page, backed by GET /api/subscriptions/my-items). Items go into the
 * normal cart; Checkout then offers the subscription balance as the payment method.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../config/api';
import { useCart } from '../context/CartContext';
import { Card, Divider, EmptyState, ErrorState, ScreenHeader, SkeletonList, StickyFooter } from '../components/common';
import { FoodRow } from '../components/cards';
import { colors, formatPrice, radius, spacing, type, fonts } from '../theme';

interface SubscriptionSummary {
  _id: string;
  remaining_amount: number;
  remaining_days: number;
  per_day_value?: number;
  seller?: { _id: string; businessName?: string; type?: string; logo?: string };
}

export default function SubscriptionItemsScreen() {
  const navigation = useNavigation<any>();
  const { addToCart, getItemQuantity, updateQuantity, totalItems, totalAmount } = useCart();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get('/subscriptions/my-items');
      setSubscription(res.data?.subscription || null);
      setItems(res.data?.items || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'We could not load your plan items.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const seller = subscription?.seller;

  const add = (item: any) => {
    addToCart({
      id: item._id,
      name: item.name,
      price: item.sellingPrice || item.discountPrice || 0,
      discountPrice: item.discountPrice && item.discountPrice < item.sellingPrice ? item.discountPrice : undefined,
      image: item.image || '',
      sellerId: seller?._id || '',
      sellerName: seller?.businessName || 'Home Chef',
      isVeg: item.isVeg !== false,
      description: item.description,
    });
  };

  const renderBody = () => {
    if (loading) return <View style={{ padding: spacing.screen }}><SkeletonList count={4} imageSize={72} /></View>;
    if (error) return <ErrorState message={error} onRetry={load} />;
    if (!subscription) {
      return (
        <EmptyState
          icon="calendar-outline"
          title="No active subscription"
          subtitle="Subscribe to a home chef plan to see the dishes it includes."
          actionText="Browse plans"
          onAction={() => navigation.navigate('AllPlans')}
        />
      );
    }
    return (
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: totalItems > 0 ? 120 : spacing.xxxl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <Card style={styles.summary}>
          <Text style={type.overline}>Your plan with</Text>
          <Text style={[type.heading, { marginTop: 2 }]}>{seller?.businessName || 'Home chef'}</Text>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={type.caption}>Balance</Text>
              <Text style={[type.price, { fontSize: 18 }]}>{formatPrice(subscription.remaining_amount)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={type.caption}>Days left</Text>
              <Text style={[type.price, { fontSize: 18 }]}>{subscription.remaining_days}</Text>
            </View>
            {subscription.per_day_value ? (
              <View style={styles.stat}>
                <Text style={type.caption}>Per day</Text>
                <Text style={[type.price, { fontSize: 18 }]}>{formatPrice(subscription.per_day_value)}</Text>
              </View>
            ) : null}
          </View>
        </Card>

        <Text style={[type.overline, styles.label]}>Included dishes</Text>
        {items.length === 0 ? (
          <Card variant="outlined">
            <EmptyState icon="restaurant-outline" title="No dishes listed yet" subtitle="Your home chef hasn't added dishes to this plan yet." style={{ paddingVertical: spacing.xl }} />
          </Card>
        ) : (
          <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
            {items.map((item, index) => {
              const qty = getItemQuantity(item._id);
              return (
                <View key={item._id}>
                  {index > 0 ? <Divider /> : null}
                  <FoodRow
                    item={{ ...item, isVeg: item.isVeg !== false }}
                    quantity={qty}
                    onAdd={() => add(item)}
                    onIncrement={() => updateQuantity(item._id, qty + 1)}
                    onDecrement={() => updateQuantity(item._id, qty - 1)}
                  />
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Plan items" subtitle="Order these using your subscription balance" />
      {renderBody()}
      {totalItems > 0 && subscription ? (
        <StickyFooter>
          <TouchableOpacity style={styles.cartBar} onPress={() => navigation.navigate('Cart')} activeOpacity={0.9} accessibilityRole="button">
            <View>
              <Text style={styles.cartCount}>{totalItems} {totalItems === 1 ? 'item' : 'items'}</Text>
              <Text style={styles.cartTotal}>{formatPrice(totalAmount)}</Text>
            </View>
            <View style={styles.cartAction}>
              <Text style={styles.cartActionText}>View cart</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.textInverse} />
            </View>
          </TouchableOpacity>
        </StickyFooter>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing.screen },
  summary: {},
  stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  stat: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, gap: 2 },
  label: { marginTop: spacing.xxl, marginBottom: spacing.sm, marginLeft: spacing.xs },
  cartBar: { height: 56, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  cartCount: { ...type.caption, color: 'rgba(255,255,255,0.85)' },
  cartTotal: { ...type.price, color: colors.textInverse },
  cartAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cartActionText: { ...type.subheading, color: colors.textInverse },
});
