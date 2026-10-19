import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { colors, fonts, radius, spacing, type } from '../theme';
import { RootStackParamList } from '../navigation/RootNavigator';
import { extractCoordinates, getCurrentCoordinates } from '../utils/location';
import { DeliveryMap } from '../components/common/DeliveryMap';
import { trackOrder, untrackOrder } from '../services/socket';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'OrderDetails'>;

interface OrderDetails {
  _id: string;
  orderNumber: string;
  sellerId: {
    name: string;
    businessName: string;
    shopName?: string;
    phone: string;
    address?: {
      location?: {
        coordinates: [number, number];
      };
    };
  };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  deliveryCharges: number;
  grandTotal: number;
  subscriptionAmountUsed: number;
  onlineAmountPaid: number;
  daysDeducted: number;
  paymentMethod: string;
  status: string;
  paymentStatus: string;
  deliveryAddress: {
    address: string;
    area: string;
    city: string;
    pincode: string;
    latitude?: number | string;
    longitude?: number | string;
    lat?: number | string;
    lng?: number | string;
    fullAddress?: string;
    street?: string;
    location?: {
      coordinates?: [number, number] | number[];
    };
  };
  createdAt: string;
}


/** Shape of GET /api/invoice/receipt/:orderId (Dabba_Delight_Backend/services/order-receipt.service.js) */
type OrderReceipt = {
  orderNumber: string | null;
  invoiceNumber: string | null;
  items: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  summary: { itemTotal: number; taxTotal: number; deliveryFee: number; discount: number; grandTotal: number; subscriptionCredit: number; amountDue: number };
  payment: { method: string | null; methodLabel: string | null; status: string; reference: string | null };
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: 'Paid',
  pending: 'Payment pending',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

const formatRupees = (n: number) => `Rs. ${(Number(n) || 0).toFixed(2).replace(/\.00$/, '')}`;

const STAGES = ['Placed', 'Accepted', 'Cooking', 'On the way', 'Delivered'];

/** One sentence per order stage, from the stored order status and the rider leg */
const getStage = (status: string, deliveryStatus: string | null, riderName?: string) => {
  if (status === 'cancelled') return { step: 0, title: 'Order cancelled', subtitle: 'If you paid online, the refund goes back to your original payment method.' };
  if (status === 'delivered' || deliveryStatus === 'delivered') return { step: 4, title: 'Delivered. Enjoy your meal', subtitle: 'Rate the kitchen to help other neighbours choose.' };
  if (status === 'out_for_delivery' || deliveryStatus === 'picked_up') return { step: 3, title: 'On the way to you', subtitle: riderName ? `${riderName} has picked up your food.` : 'Your food has been picked up.' };
  if (status === 'ready') return { step: 2, title: 'Packed and ready', subtitle: deliveryStatus === 'arrived_at_restaurant' ? 'Your delivery partner is at the kitchen.' : 'Waiting for the delivery partner to pick it up.' };
  if (status === 'preparing') return { step: 2, title: 'Being cooked', subtitle: riderName ? `${riderName} will pick it up when it's ready.` : 'The kitchen is cooking your order fresh.' };
  if (status === 'confirmed') return { step: 1, title: 'Kitchen accepted your order', subtitle: 'Cooking starts shortly.' };
  return { step: 0, title: 'Waiting for the kitchen to accept', subtitle: 'Home kitchens usually confirm within a few minutes.' };
};

export default function OrderDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { orderId } = route.params;
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [riderCoords, setRiderCoords] = useState<{ lat: number; lng: number; heading?: number | null } | null>(null);
  const [riderInfo, setRiderInfo] = useState<any>(null);
  const [trackedPickupCoords, setTrackedPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [trackedDropCoords, setTrackedDropCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);

  // Bill figures come from the backend receipt so they always match the invoice and the website
  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    api.user.getOrderReceipt(orderId as string)
      .then((res: any) => { if (alive && res?.receipt) setReceipt(res.receipt); })
      .catch(() => {});
    return () => { alive = false; };
  }, [orderId, order?.paymentStatus]);

  useEffect(() => {
    fetchOrderDetails();
    getCurrentLocation();
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    const onLocation = (loc: any) => {
      if (loc?.lat && loc?.lng) {
        setRiderCoords({
          lat: Number(loc.lat),
          lng: Number(loc.lng),
          heading: loc.heading != null ? Number(loc.heading) : null,
        });
      }
      if (loc?.pickupCoords?.lat && loc?.pickupCoords?.lng) {
        setTrackedPickupCoords(loc.pickupCoords);
      }
      if (loc?.dropCoords?.lat && loc?.dropCoords?.lng) {
        setTrackedDropCoords(loc.dropCoords);
      }
      if (loc?.riderInfo) {
        setRiderInfo((prev: any) => ({ ...prev, ...loc.riderInfo }));
      }
      if (loc?.deliveryStatus !== undefined) {
        setDeliveryStatus(loc.deliveryStatus);
      }
      if (loc?.status) {
        setOrder((prev: any) => (prev ? { ...prev, status: loc.status } : prev));
      }
    };
    const onStatus = (statusData: any) => {
      if (statusData?.status) {
        setOrder((prev: any) => (prev ? { ...prev, status: statusData.status } : prev));
      }
      if (statusData?.deliveryStatus !== undefined) {
        setDeliveryStatus(statusData.deliveryStatus);
      }
      if (statusData?.riderInfo) {
        setRiderInfo((prev: any) => ({ ...prev, ...statusData.riderInfo }));
      }
    };
    trackOrder(orderId as string, onLocation, onStatus);
    return () => {
      untrackOrder(orderId as string, onLocation, onStatus);
    };
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const [orderRes, trackRes] = await Promise.allSettled([
        api.user.getOrderById(orderId as string),
        api.user.getOrderTracking(orderId as string),
      ]);
      if (orderRes.status === 'fulfilled') {
        const d = orderRes.value?.order || orderRes.value?.data || orderRes.value;
        if (d && d._id) {
          setOrder(d);
          if (d.deliveryStatus) setDeliveryStatus(d.deliveryStatus);
        }
      }
      if (trackRes.status === 'fulfilled') {
        const t = trackRes.value?.order || trackRes.value;
        if (t?.riderLocation) setRiderCoords(t.riderLocation);
        if (t?.riderInfo) setRiderInfo(t.riderInfo);
        if (t?.pickupCoords?.lat && t?.pickupCoords?.lng) setTrackedPickupCoords(t.pickupCoords);
        if (t?.dropCoords?.lat && t?.dropCoords?.lng) setTrackedDropCoords(t.dropCoords);
        if (t?.deliveryStatus) setDeliveryStatus(t.deliveryStatus);
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await getCurrentCoordinates();
      setUserLocation(location);
      setLocationPermissionDenied(!location);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationPermissionDenied(true);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'preparing':
        return '#2196F3';
      case 'out_for_delivery':
        return '#FF9800';
      case 'delivered':
        return colors.success;
      case 'cancelled':
        return colors.danger;
      default:
        return colors.textTertiary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmed';
      case 'preparing':
        return 'Preparing';
      case 'out_for_delivery':
        return 'Out for Delivery';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  const deliveryCoordinates = extractCoordinates(order.deliveryAddress);
  const resolvedPickupCoords =
    trackedPickupCoords ||
    (order.sellerId?.address?.location?.coordinates
      ? [order.sellerId.address.location.coordinates[0], order.sellerId.address.location.coordinates[1]] as [number, number]
      : undefined);
  const resolvedDropCoords =
    trackedDropCoords ||
    (deliveryCoordinates ? [deliveryCoordinates.longitude, deliveryCoordinates.latitude] as [number, number] : undefined);

  const currentStage: 'to_restaurant' | 'to_customer' | 'delivered' =
    order.status === 'delivered' || deliveryStatus === 'delivered'
      ? 'delivered'
      : deliveryStatus === 'picked_up' || order.status === 'out_for_delivery'
      ? 'to_customer'
      : 'to_restaurant';

  const getLiveStageBanner = () => {
    if (order.status === 'delivered' || deliveryStatus === 'delivered') {
      return { icon: 'checkmark-circle', title: 'Order Delivered!', subtitle: 'Enjoy your meal from Dabba Nation', bg: '#DCFCE7', color: '#166534' };
    }
    if (currentStage === 'to_customer') {
      return {
        icon: 'bicycle',
        title: 'Order is on the way!',
        subtitle: riderInfo?.name
          ? `${riderInfo.name} has picked up your order and is riding to your location`
          : 'Delivery partner has picked up your order and is riding to your location',
        bg: '#ECFDF5',
        color: '#065F46',
      };
    }
    if (deliveryStatus === 'arrived_at_restaurant') {
      return {
        icon: 'storefront',
        title: 'Rider reached the kitchen',
        subtitle: 'Waiting to pick up your freshly prepared order',
        bg: colors.primarySoft,
        color: '#9A3412',
      };
    }
    if (riderInfo || deliveryStatus === 'assigned') {
      return {
        icon: 'bicycle',
        title: 'Delivery Partner Assigned',
        subtitle: `${riderInfo?.name || 'Rider'} is heading to the kitchen to pick up your order`,
        bg: '#EFF6FF',
        color: '#1E40AF',
      };
    }
    return {
      icon: 'restaurant',
      title: 'Kitchen is preparing your order',
      subtitle: 'A delivery partner near the restaurant will be assigned shortly',
      bg: colors.primarySoft,
      color: '#9A3412',
    };
  };

  const liveBanner = getLiveStageBanner();
  const stage = getStage(order.status, deliveryStatus, riderInfo?.name);
  const itemTotal = order.totalAmount ?? (order as any).subtotal ?? (order as any).total ?? 0;
  const delivCharges = order.deliveryCharges ?? (order as any).deliveryFee ?? 0;
  const totalPaid = order.onlineAmountPaid ?? (order as any).total ?? itemTotal + delivCharges;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Order #{order.orderNumber}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        {/* Status hero */}
        <View style={styles.hero}>
          <Text style={styles.heroOverline}>{formatDate(order.createdAt)}</Text>
          <Text style={styles.heroTitle}>{stage.title}</Text>
          <Text style={styles.heroSubtitle}>{stage.subtitle}</Text>
          {order.status !== 'cancelled' ? (
            <View style={styles.progress} accessibilityLabel={`Step ${stage.step + 1} of ${STAGES.length}: ${STAGES[stage.step]}`}>
              {STAGES.map((label, i) => (
                <View key={label} style={styles.progressItem}>
                  <View style={[styles.progressBar, i <= stage.step && styles.progressBarDone]} />
                  <Text style={[styles.progressLabel, i === stage.step && styles.progressLabelActive]} numberOfLines={1}>{label}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Map & live delivery tracking */}
        {order.status !== 'cancelled' && order.status !== 'delivered' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Live tracking</Text>

            <View style={styles.mapContainer}>
              <DeliveryMap
                pickupCoords={resolvedPickupCoords}
                dropCoords={resolvedDropCoords}
                riderCoords={riderCoords}
                riderHeading={riderCoords?.heading}
                deliveryStage={currentStage}
                restaurantName={order.sellerId?.shopName || order.sellerId?.businessName || 'Restaurant'}
                dropLabel={
                  order.deliveryAddress?.fullAddress ||
                  order.deliveryAddress?.street ||
                  order.deliveryAddress?.address ||
                  'Your Location'
                }
                height={260}
              />
            </View>

            {/* Rider Card if assigned */}
            {riderInfo && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F0FDF4',
                borderRadius: 12,
                padding: 12,
                marginTop: 10,
                borderWidth: 1,
                borderColor: '#BBF7D0',
                gap: 10,
              }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#DCFCE7',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="bicycle" size={20} color="#166534" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#166534' }}>
                    {riderInfo.name || 'Delivery Partner'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#15803D', marginTop: 1 }}>
                    {[riderInfo.vehicleType ? String(riderInfo.vehicleType) : null, riderInfo.vehicleNumber, riderInfo.rating ? `★ ${Number(riderInfo.rating).toFixed(1)}` : null].filter(Boolean).join(' · ') || 'Delivery partner'}
                  </Text>
                </View>
                {riderInfo.phone ? (
                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.success,
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onPress={() => Linking.openURL(`tel:${riderInfo.phone}`)}
                  >
                    <Ionicons name="call" size={18} color="#fff" />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {locationPermissionDenied && !deliveryCoordinates && (
              <Text style={styles.mapHint}>
                Location permission is off, so the map is using the saved delivery address only.
              </Text>
            )}
          </View>
        )}

        {/* Seller Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order From</Text>
          <View style={styles.sellerCard}>
            <View style={styles.sellerIcon}>
              <Ionicons name="restaurant" size={24} color="#FF6B00" />
            </View>
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{order.sellerId?.shopName || order.sellerId?.businessName || order.sellerId?.name}</Text>
              <Text style={styles.sellerPhone}>{order.sellerId?.phone}</Text>
            </View>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => order.sellerId?.phone && Linking.openURL(`tel:${order.sellerId.phone}`)}
            >
              <Ionicons name="call" size={20} color="#FF6B00" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items Ordered</Text>
          <View style={styles.itemsCard}>
            {(receipt?.items || (order.items || []).map((item: any) => ({
              name: item.name,
              quantity: item.quantity,
              lineTotal: (Number(item.sellingPrice ?? item.price) || 0) * (Number(item.quantity) || 0),
            }))).map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQty}>x{item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>{formatRupees(item.lineTotal)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          <View style={styles.billCard}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item Total</Text>
              <Text style={styles.billValue}>{formatRupees(receipt ? receipt.summary.itemTotal : itemTotal)}</Text>
            </View>
            {receipt && receipt.summary.taxTotal > 0 && (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>GST</Text>
                <Text style={styles.billValue}>{formatRupees(receipt.summary.taxTotal)}</Text>
              </View>
            )}
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Charges</Text>
              <Text style={styles.billValue}>{formatRupees(receipt ? receipt.summary.deliveryFee : delivCharges)}</Text>
            </View>

            {order.subscriptionAmountUsed > 0 && (
              <View style={[styles.billRow, styles.subscriptionRow]}>
                <View>
                  <Text style={styles.subscriptionLabel}>Subscription Balance Used</Text>
                  <Text style={styles.daysDeducted}>
                    {order.daysDeducted} days deducted from subscription
                  </Text>
                </View>
                <Text style={styles.subscriptionValue}>- Rs. {order.subscriptionAmountUsed}</Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.billRow}>
              <Text style={styles.totalLabel}>
                {(receipt?.payment.status || order.paymentStatus) === 'paid' ? 'Total Paid' : 'Order Total'}
              </Text>
              <Text style={styles.totalValue}>{formatRupees(receipt ? receipt.summary.grandTotal : totalPaid)}</Text>
            </View>

            <View style={styles.paymentMethod}>
              <Ionicons name="card" size={16} color="#888" />
              <Text style={styles.paymentMethodText}>
                {receipt
                  ? `${receipt.payment.methodLabel || 'Payment'} · ${PAYMENT_STATUS_LABEL[receipt.payment.status] || receipt.payment.status}`
                  : order.paymentMethod === 'subscription'
                  ? 'Paid via Subscription Balance'
                  : order.paymentMethod === 'cod'
                  ? 'Cash on Delivery (COD)'
                  : 'Online Payment'}
                {receipt?.invoiceNumber ? `
Invoice ${receipt.invoiceNumber}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Delivery Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.addressCard}>
            <Ionicons name="location" size={20} color="#FF6B00" />
            <View style={styles.addressInfo}>
              <Text style={styles.addressText}>
                {order.deliveryAddress?.fullAddress || order.deliveryAddress?.street || order.deliveryAddress?.address || 'Delivery Address'}
              </Text>
              <Text style={styles.addressCity}>
                {[order.deliveryAddress?.city, (order.deliveryAddress as any)?.state, order.deliveryAddress?.pincode].filter(Boolean).join(', ')}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.canvas,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.canvas,
  },
  errorText: {
    fontSize: 16,
    color: colors.textTertiary, fontFamily: fonts.regular,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.md,
    backgroundColor: colors.canvas,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  hero: { marginHorizontal: spacing.screen, marginBottom: spacing.lg, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.inkSurface },
  heroOverline: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.textOnInkMuted, textTransform: 'uppercase' },
  heroTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.textOnInk, marginTop: spacing.sm },
  heroSubtitle: { ...type.body, color: colors.textOnInkMuted, marginTop: spacing.xs },
  progress: { flexDirection: 'row', gap: 6, marginTop: spacing.xl },
  progressItem: { flex: 1, gap: 6 },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(246,239,230,0.18)' },
  progressBarDone: { backgroundColor: colors.primary },
  progressLabel: { fontFamily: fonts.medium, fontSize: 10, color: colors.textOnInkMuted },
  progressLabelActive: { fontFamily: fonts.heavy, color: colors.textOnInk },
  statusCard: {
    backgroundColor: colors.surface,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  orderNumber: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 14,
    color: colors.textTertiary, fontFamily: fonts.regular,
  },
  section: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginHorizontal: spacing.screen,
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { ...type.overline, marginBottom: spacing.md },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  sellerPhone: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 2, fontFamily: fonts.regular,
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemsCard: {
    backgroundColor: colors.canvas,
    borderRadius: 12,
    padding: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 14,
    color: colors.text, fontFamily: fonts.regular,
  },
  itemQty: {
    fontSize: 13,
    color: colors.textTertiary,
    marginLeft: 8, fontFamily: fonts.regular,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  billCard: {
    backgroundColor: colors.canvas,
    borderRadius: 12,
    padding: 16,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  billLabel: {
    fontSize: 14,
    color: colors.textSecondary, fontFamily: fonts.regular,
  },
  billValue: {
    fontSize: 14,
    color: colors.text, fontFamily: fonts.regular,
  },
  subscriptionRow: {
    backgroundColor: colors.primarySoft,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  subscriptionLabel: {
    fontSize: 14,
    color: colors.primary,
    fontFamily: fonts.medium,
  },
  daysDeducted: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 2, fontFamily: fonts.regular,
  },
  subscriptionValue: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  paymentMethodText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginLeft: 6, fontFamily: fonts.regular,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.canvas,
    borderRadius: 12,
    padding: 16,
  },
  addressInfo: {
    flex: 1,
    marginLeft: 12,
  },
  addressText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20, fontFamily: fonts.regular,
  },
  addressCity: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 4, fontFamily: fonts.regular,
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  map: {
    flex: 1,
  },
  webMapWrapper: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  webMapButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  webMapButtonText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  mapHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 18, fontFamily: fonts.regular,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.canvas,
  },
  mapFallbackText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary, fontFamily: fonts.regular,
  },
});
