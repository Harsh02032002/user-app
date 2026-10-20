import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCart, getCartUnitPrice } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { LOCATION_COORDS_KEY, LOCATION_NAME_KEY } from '../utils/location';
import { OnlinePaymentModal } from '../components/OnlinePaymentModal';
import { SERVICE_RADIUS_KM } from '../config/serviceArea';
import { Button, EmptyState, Input, Notice, ScreenHeader, StickyFooter, VegIndicator } from '../components/common';
import { formatDistance } from '../components/cards';
import { colors, fonts, formatPrice, radius, spacing, type } from '../theme';

type PayMethod = 'cod' | 'online' | 'wallet' | 'subscription';

interface Quote {
  subtotal: number;
  deliveryFee: number;
  taxTotal: number;
  grandTotal: number;
  distanceKm: number;
}

interface AddressForm {
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
}

const newCheckoutKey = () => `co_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export function CheckoutScreen() {
  const navigation = useNavigation<any>();
  const { items: cartItems, totalAmount, clearCart } = useCart();
  const { user, refreshProfile } = useAuth();

  const [address, setAddress] = useState<AddressForm>({
    name: user?.name || '',
    phone: user?.phone ? String(user.phone).replace(/\D/g, '').slice(-10) : '',
    street: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof AddressForm | 'location', string>>>({});
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationName, setLocationName] = useState('');
  const [detecting, setDetecting] = useState(false);

  const [method, setMethod] = useState<PayMethod>('cod');
  const [walletBalance, setWalletBalance] = useState(0);
  const [planBalance, setPlanBalance] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteProblem, setQuoteProblem] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [placing, setPlacing] = useState(false);
  const [upiOpen, setUpiOpen] = useState(false);
  const [success, setSuccess] = useState<{ orderId?: string; orderNumber: string; total: number; paymentLabel: string; pending: boolean } | null>(null);
  // One key per checkout attempt: retries / double taps return the same order
  const checkoutKey = useRef(newCheckoutKey());

  const sellerId = useMemo(() => {
    const s: any = cartItems.find((i) => !!i.sellerId)?.sellerId;
    return typeof s === 'object' ? s?._id : s;
  }, [cartItems]);
  const kitchenName = cartItems[0]?.sellerName || '';

  // ── Initial data ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [coords, name] = await Promise.all([AsyncStorage.getItem(LOCATION_COORDS_KEY), AsyncStorage.getItem(LOCATION_NAME_KEY)]);
        const parsed = coords ? JSON.parse(coords) : null;
        if (Number.isFinite(parsed?.lat) && Number.isFinite(parsed?.lng)) setUserLocation([parsed.lng, parsed.lat]);
        if (name) setLocationName(name);
      } catch { /* no saved location */ }
    })();
    api.user.getWalletTransactions()
      .then((res: any) => setWalletBalance(Number(res?.data?.balance ?? res?.balance ?? 0) || 0))
      .catch(() => {});
    api.user.getActiveSubscription()
      .then((res: any) => {
        const subs = (res?.subscriptions || []).filter((s: any) => s.status === 'active' && s.remaining_amount > 0);
        const forKitchen = subs.filter((s: any) => String(s.seller_id?._id || s.seller_id) === String(sellerId));
        setPlanBalance(forKitchen.reduce((sum: number, s: any) => sum + (Number(s.remaining_amount) || 0), 0));
      })
      .catch(() => {});
  }, [sellerId]);

  // ── Server quote: the exact amount the order will be created with ──
  const cartKey = JSON.stringify(cartItems.map((i) => [i.id, i.quantity]));
  useEffect(() => {
    if (!sellerId || !userLocation || !cartItems.length) return;
    let alive = true;
    setQuoting(true);
    api.user.quoteOrder({
      sellerId,
      items: cartItems.map((i) => ({ menuItemId: i.id, quantity: i.quantity })),
      deliveryAddress: { state: address.state, location: { type: 'Point', coordinates: userLocation } },
    })
      .then((res: any) => { if (alive) { setQuote(res?.quote || null); setQuoteProblem(null); } })
      .catch((e: any) => { if (alive) { setQuote(null); setQuoteProblem(e?.message || 'We could not price this order.'); } })
      .finally(() => alive && setQuoting(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId, cartKey, userLocation?.[0], userLocation?.[1], address.state]);

  const total = quote?.grandTotal ?? null;
  const walletShort = total != null && walletBalance < total;
  const planCovers = total != null && planBalance >= total;

  // ── Location ────────────────────────────────────────────────────────
  const detectLocation = async () => {
    try {
      setDetecting(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission needed', 'Allow location access, or type your address below.');
        return;
      }
      const pos = (await Location.getLastKnownPositionAsync({})) || (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const { latitude, longitude } = pos.coords;
      setUserLocation([longitude, latitude]);
      await AsyncStorage.setItem(LOCATION_COORDS_KEY, JSON.stringify({ lat: latitude, lng: longitude }));
      const geo = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
      const g = geo[0];
      if (g) {
        let street = g.name || g.street || g.district || '';
        if (street.includes('+') && street.length <= 8) street = g.street || g.district || '';
        setAddress((a) => ({
          ...a,
          street: a.street || street,
          city: g.city || g.subregion || a.city,
          state: g.region || a.state,
          pincode: g.postalCode || a.pincode,
        }));
        const name = [g.district || g.subregion, g.city].filter(Boolean).join(', ');
        if (name) {
          setLocationName(name);
          AsyncStorage.setItem(LOCATION_NAME_KEY, name).catch(() => {});
        }
      }
      setErrors((e) => ({ ...e, location: undefined }));
    } catch {
      Alert.alert('Could not get your location', 'Please type your address below.');
    } finally {
      setDetecting(false);
    }
  };

  // ── Validation ──────────────────────────────────────────────────────
  const validate = () => {
    const e: typeof errors = {};
    if (!address.name.trim()) e.name = 'Enter the receiver’s name';
    if (!/^[6-9]\d{9}$/.test(address.phone.replace(/\D/g, '').slice(-10))) e.phone = 'Enter a 10-digit mobile number';
    if (!address.street.trim()) e.street = 'Enter house no. and street';
    if (!address.city.trim()) e.city = 'Enter city';
    if (!/^\d{6}$/.test(address.pincode.trim())) e.pincode = '6-digit pincode';
    if (!userLocation) e.location = 'Set your delivery location so we can check the kitchen delivers to you';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const set = (k: keyof AddressForm) => (v: string) => {
    setAddress((a) => ({ ...a, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  // ── Place order ─────────────────────────────────────────────────────
  const orderPayload = (paymentMethod: string, extra: Record<string, unknown> = {}) => ({
    items: cartItems.map((i) => ({ menuItemId: i.id, name: i.name, sellingPrice: getCartUnitPrice(i), quantity: i.quantity, image: i.image })),
    sellerId,
    deliveryAddress: {
      name: address.name.trim(),
      phone: address.phone.replace(/\D/g, '').slice(-10),
      street: address.street.trim(),
      city: address.city.trim(),
      state: address.state.trim(),
      pincode: address.pincode.trim(),
      location: userLocation ? { type: 'Point', coordinates: userLocation } : undefined,
    },
    paymentMethod,
    subtotal: totalAmount,
    idempotencyKey: checkoutKey.current,
    ...extra,
  });

  const finish = (order: any, paymentLabel: string) => {
    clearCart();
    refreshProfile?.().catch?.(() => {});
    setSuccess({
      orderId: order?._id,
      orderNumber: order?.orderNumber || '',
      total: Number(order?.total ?? total ?? 0),
      paymentLabel,
      pending: order?.paymentStatus !== 'paid',
    });
  };

  const placeOrder = async (paymentMethod: PayMethod, extra: Record<string, unknown> = {}) => {
    setPlacing(true);
    try {
      const res: any = await api.user.placeOrder(orderPayload(paymentMethod, extra));
      const labels: Record<PayMethod, string> = { cod: 'Cash on delivery', online: 'UPI', wallet: 'Wallet', subscription: 'Tiffin plan balance' };
      finish(res?.order, labels[paymentMethod]);
    } catch (e: any) {
      Alert.alert('Order not placed', e?.message || 'Please try again.');
      // Prices or availability may have changed — refresh the quote
      setQuote(null);
    } finally {
      setPlacing(false);
    }
  };

  const onPlaceOrder = () => {
    if (placing) return;
    if (!validate()) return;
    if (quoteProblem) {
      Alert.alert('Can’t place this order', quoteProblem);
      return;
    }
    if (total == null) {
      Alert.alert('One moment', 'We’re still calculating your total.');
      return;
    }
    if (method === 'wallet' && walletShort) {
      Alert.alert('Not enough wallet balance', `Your wallet has ${formatPrice(walletBalance)}. Add money or choose another way to pay.`);
      return;
    }
    if (method === 'online') {
      setUpiOpen(true);
      return;
    }
    placeOrder(method);
  };

  if (!cartItems.length && !success) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Checkout" />
        <EmptyState icon="bag-handle-outline" title="Your cart is empty" actionText="Browse kitchens" onAction={() => navigation.navigate('MainTabs', { screen: 'Home' })} />
      </SafeAreaView>
    );
  }

  const payOptions: { key: PayMethod; title: string; subtitle: string; icon: React.ComponentProps<typeof Ionicons>['name']; disabled?: boolean }[] = [
    { key: 'cod', title: 'Cash on delivery', subtitle: 'Pay the delivery partner when your food arrives', icon: 'cash-outline' },
    { key: 'online', title: 'UPI', subtitle: 'Scan and pay; we confirm your payment shortly after', icon: 'qr-code-outline' },
    {
      key: 'wallet',
      title: 'Dabba wallet',
      subtitle: walletShort ? `Balance ${formatPrice(walletBalance)} — not enough for this order` : `Balance ${formatPrice(walletBalance)}`,
      icon: 'wallet-outline',
      disabled: walletShort,
    },
  ];
  if (planBalance > 0) {
    payOptions.push({
      key: 'subscription',
      title: 'Tiffin plan balance',
      subtitle: planCovers ? `${formatPrice(planBalance)} left on your plan with this kitchen` : `${formatPrice(planBalance)} left — it’s applied automatically; pick another option for the rest`,
      icon: 'calendar-outline',
      disabled: !planCovers,
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Checkout" subtitle={kitchenName ? `From ${kitchenName}` : undefined} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Delivery */}
          <Text style={styles.sectionLabel}>Deliver to</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.locationRow} onPress={detectLocation} disabled={detecting} accessibilityRole="button" accessibilityLabel="Use my current location">
              <View style={styles.pin}>
                <Ionicons name="location-sharp" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.subheading} numberOfLines={1}>{userLocation ? locationName || 'Pinned location' : 'Set delivery location'}</Text>
                <Text style={type.caption} numberOfLines={1}>
                  {quote?.distanceKm != null ? `${formatDistance(quote.distanceKm)} from the kitchen` : detecting ? 'Finding you…' : 'Tap to use your current location'}
                </Text>
              </View>
              <Text style={styles.link}>{detecting ? '…' : userLocation ? 'Update' : 'Locate'}</Text>
            </TouchableOpacity>
            {errors.location ? <Text style={styles.fieldError}>{errors.location}</Text> : null}

            <View style={styles.formDivider} />
            <View style={styles.twoCol}>
              <Input label="Name" value={address.name} onChangeText={set('name')} error={errors.name} style={{ flex: 1, marginBottom: spacing.md }} autoComplete="name" />
              <Input label="Mobile" value={address.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" maxLength={10} style={{ flex: 1, marginBottom: spacing.md }} autoComplete="tel" />
            </View>
            <Input label="House no., building, street" value={address.street} onChangeText={set('street')} error={errors.street} style={{ marginBottom: spacing.md }} autoComplete="street-address" />
            <View style={styles.twoCol}>
              <Input label="City" value={address.city} onChangeText={set('city')} error={errors.city} style={{ flex: 1, marginBottom: 0 }} />
              <Input label="Pincode" value={address.pincode} onChangeText={set('pincode')} error={errors.pincode} keyboardType="number-pad" maxLength={6} style={{ width: 120, marginBottom: 0 }} autoComplete="postal-code" />
            </View>
          </View>

          {/* Order */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>Your order</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Cart')} hitSlop={10}><Text style={styles.link}>Edit</Text></TouchableOpacity>
          </View>
          <View style={styles.card}>
            {cartItems.map((i) => (
              <View key={i.id} style={styles.orderRow}>
                <VegIndicator isVeg={i.isVeg} size={12} />
                <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                  <Text style={{ fontFamily: fonts.heavy }}>{i.quantity} × </Text>{i.name}
                </Text>
                <Text style={styles.amount}>{formatPrice(getCartUnitPrice(i) * i.quantity)}</Text>
              </View>
            ))}
          </View>

          {/* Payment */}
          <Text style={styles.sectionLabel}>Pay with</Text>
          <View style={[styles.card, { paddingVertical: spacing.xs }]}>
            {payOptions.map((o, idx) => {
              const active = method === o.key;
              return (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.payRow, idx > 0 && styles.payRowBorder, o.disabled && { opacity: 0.5 }]}
                  onPress={() => !o.disabled && setMethod(o.key)}
                  disabled={o.disabled}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active, disabled: o.disabled }}
                >
                  <Ionicons name={o.icon} size={22} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={type.subheading}>{o.title}</Text>
                    <Text style={type.caption}>{o.subtitle}</Text>
                  </View>
                  <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bill */}
          <Text style={styles.sectionLabel}>Bill</Text>
          <View style={styles.card}>
            <BillRow label="Item total" value={formatPrice(quote?.subtotal ?? totalAmount)} />
            <BillRow
              label="Delivery"
              hint={quote ? `${formatDistance(quote.distanceKm)} · within ${SERVICE_RADIUS_KM} km` : undefined}
              value={quote ? formatPrice(quote.deliveryFee) : quoting ? 'Calculating…' : userLocation ? '—' : 'Set location'}
            />
            {quote && quote.taxTotal > 0 ? <BillRow label="GST" value={formatPrice(quote.taxTotal)} /> : null}
            <View style={styles.billDivider} />
            <BillRow label="To pay" value={total != null ? formatPrice(total) : '—'} strong />
            {quoteProblem ? <Notice tone="danger" message={quoteProblem} style={{ marginTop: spacing.md }} /> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <StickyFooter>
        <View style={styles.footerRow}>
          <View>
            <Text style={type.caption}>To pay</Text>
            <Text style={styles.footerTotal}>{total != null ? formatPrice(total) : '—'}</Text>
          </View>
          <Button
            title={method === 'online' ? 'Pay with UPI' : 'Place order'}
            onPress={onPlaceOrder}
            loading={placing}
            disabled={!!quoteProblem}
            style={{ flex: 1, marginLeft: spacing.lg }}
          />
        </View>
      </StickyFooter>

      <OnlinePaymentModal
        visible={upiOpen}
        onClose={() => setUpiOpen(false)}
        amount={total ?? 0}
        onPaymentSuccess={async (txnId?: string) => {
          setUpiOpen(false);
          await placeOrder('online', { transactionId: txnId || undefined });
        }}
      />

      <Modal visible={!!success} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.successBackdrop}>
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={34} color={colors.textInverse} />
            </View>
            <Text style={[type.display, { textAlign: 'center', marginTop: spacing.lg }]}>Order placed</Text>
            <Text style={[type.body, { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xs }]}>
              {kitchenName ? `${kitchenName} has your order.` : 'The kitchen has your order.'} You’ll get updates as it’s cooked and picked up.
            </Text>
            <View style={styles.successSummary}>
              {success?.orderNumber ? <BillRow label="Order" value={`#${success.orderNumber}`} /> : null}
              <BillRow label="Amount" value={formatPrice(success?.total ?? 0)} />
              <BillRow label="Payment" value={success ? `${success.paymentLabel}${success.pending && success.paymentLabel === 'UPI' ? ' · confirming' : ''}` : ''} />
            </View>
            <Button
              title="Track order"
              icon="navigate-outline"
              fullWidth
              onPress={() => {
                const id = success?.orderId;
                setSuccess(null);
                // Replace checkout so "back" from tracking doesn't return to a finished checkout
                if (id) navigation.replace('OrderDetails', { orderId: id });
                else navigation.navigate('MainTabs', { screen: 'Orders' });
              }}
            />
            <Button
              title="Back to home"
              variant="tertiary"
              fullWidth
              style={{ marginTop: spacing.xs }}
              onPress={() => {
                setSuccess(null);
                navigation.navigate('MainTabs', { screen: 'Home' });
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const BillRow: React.FC<{ label: string; value: string; hint?: string; strong?: boolean }> = ({ label, value, hint, strong }) => (
  <View style={styles.billRow}>
    <View style={{ flex: 1 }}>
      <Text style={strong ? type.bodyStrong : [type.body, { color: colors.textSecondary }]}>{label}</Text>
      {hint ? <Text style={type.caption}>{hint}</Text> : null}
    </View>
    <Text style={strong ? styles.billStrong : styles.amount}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  sectionLabel: { ...type.overline, marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  link: { fontFamily: fonts.bold, fontSize: 14, color: colors.primaryInk, marginBottom: spacing.sm },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pin: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  fieldError: { ...type.caption, color: colors.danger, marginTop: spacing.sm },
  formDivider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
  twoCol: { flexDirection: 'row', gap: spacing.md },

  orderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  amount: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },

  payRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  payRowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.text },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.text },

  billRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 5 },
  billDivider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  billStrong: { fontFamily: fonts.heavy, fontSize: 18, color: colors.text, fontVariant: ['tabular-nums'] },

  footerRow: { flexDirection: 'row', alignItems: 'center' },
  footerTotal: { fontFamily: fonts.heavy, fontSize: 19, color: colors.text },

  successBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  successCard: { backgroundColor: colors.canvas, borderRadius: 28, padding: spacing.xxl, alignItems: 'stretch' },
  successIcon: { alignSelf: 'center', width: 68, height: 68, borderRadius: 34, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  successSummary: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginVertical: spacing.xl },
});

export default CheckoutScreen;
