import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Linking,
  Alert,
  Platform,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { EmptyState, ErrorState, Skeleton } from '../../components/common';
import { KitchenMark } from '../../components/cards';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeliveryMap } from '../../components/common/DeliveryMap';
import { trackOrder, untrackOrder, onAnyOrderUpdate } from '../../services/socket';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { colors, fonts, formatPrice, orderStatusColors, radius, spacing, type } from '../../theme';

const ORDERS_CACHE_KEY = 'orders_screen_cache';

const { width } = Dimensions.get('window');

// Order type definition matching website
interface Order {
  _id: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  deliveryStatus?: 'assigned' | 'arrived_at_restaurant' | 'picked_up' | 'delivered' | null;
  total: number;
  items: { name: string; quantity: number; image?: string }[];
  createdAt: string;
  sellerId: any;
  sellerName?: string;
  paymentMethod: string;
  rating?: number;
  subscriptionAmountUsed?: number;
  subscriptionDaysDeducted?: number;
  payableAfterSubscription?: number;
}

const statusTabs = ['all', 'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
const LIST_TABS = [
  { key: 'active', label: 'Active' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];
const LIST_STEPS = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];

/** Orders that are still moving — Track is offered and the tracking view keeps syncing */
const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'];
const TRACKING_POLL_MS = 15000;

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return '#FEF3C7';
    case 'confirmed': return '#DBEAFE';
    case 'preparing': return '#E9D5FF';
    case 'ready': return '#CCFBF1';
    case 'out_for_delivery': return '#FED7AA';
    case 'delivered': return '#D1FAE5';
    case 'cancelled': return '#FEE2E2';
    default: return colors.canvas;
  }
};

const getStatusTextColor = (status: string) => {
  switch (status) {
    case 'pending': return '#92400E';
    case 'confirmed': return '#1E40AF';
    case 'preparing': return '#7C3AED';
    case 'ready': return '#0F766E';
    case 'out_for_delivery': return '#EA580C';
    case 'delivered': return '#065F46';
    case 'cancelled': return colors.danger;
    default: return '#374151';
  }
};

const getStatusText = (status: string) => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const statusSteps = [
  { key: 'pending', label: 'Order Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready for Pickup' },
  { key: 'rider_assigned', label: 'Rider Assigned' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

const KITCHEN_ORDER = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];

/**
 * Index of the furthest step reached. Kitchen and rider progress run in parallel
 * (a rider can be assigned while food is still cooking), so each step is "reached"
 * from the persisted status, deliveryStatus and statusHistory.
 */
const getReachedSteps = (status: string, deliveryStatus?: string | null, history?: { status: string }[]) => {
  const reached = new Set<string>();
  const kitchenIdx = KITCHEN_ORDER.indexOf(status);
  KITCHEN_ORDER.forEach((k, i) => { if (kitchenIdx >= 0 && i <= kitchenIdx) reached.add(k); });
  (history || []).forEach((h) => { if (h?.status) reached.add(h.status); });
  if (deliveryStatus || reached.has('out_for_delivery')) reached.add('rider_assigned');
  // Rider picked up before the kitchen pressed "ready" — food was obviously ready
  if (reached.has('out_for_delivery')) { reached.add('ready'); reached.add('preparing'); reached.add('confirmed'); }
  let currentIdx = 0;
  statusSteps.forEach((s, i) => { if (reached.has(s.key)) currentIdx = i; });
  return { reached, currentIdx };
};

const STEP_SUBLABELS: Record<string, string> = {
  pending: 'Waiting for restaurant confirmation...',
  confirmed: 'Restaurant accepted your order',
  preparing: 'Kitchen is cooking your food',
  ready: 'Food is ready, waiting for pickup',
  rider_assigned: 'Delivery partner is heading to the restaurant',
  out_for_delivery: 'Rider is heading to your location',
  delivered: 'Enjoy your meal!',
};

export function OrdersScreen() {
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('active');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const trackingOrderIdRef = useRef<string | null>(null);
  const trackingCallbacks = useRef<{ onLocation: (d: any) => void; onStatus: (d: any) => void } | null>(null);
  const trackingPoll = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFocused = useIsFocused();

  useEffect(() => {
    loadCachedData().then(() => {
      fetchOrders();
      loadUserLocation();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the list in sync: refresh when coming back to the tab and on live status pushes
  useEffect(() => {
    if (!isFocused) return;
    fetchOrders(true);
    const unsubscribe = onAnyOrderUpdate((data: any) => {
      if (data?.type === 'reconnected' || data?.orderId) fetchOrders(true);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  // Stop tracking listeners/polling if the screen unmounts with the modal open
  useEffect(() => () => stopTracking(), []);

  const loadCachedData = async () => {
    try {
      const cached = await AsyncStorage.getItem(ORDERS_CACHE_KEY + 'all');
      if (cached) {
        setOrders(JSON.parse(cached));
        setLoading(false);
      }
    } catch (e) {
      console.error('Error loading orders cache:', e);
    }
  };

  const loadUserLocation = async () => {}; // Location tracking removed

  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      // Tabs (Active / Delivered / Cancelled / All) filter on the device, so always load every order
      const response = await api.user.getOrders(undefined);
      const ordersData = Array.isArray(response) ? response : response.orders || response.data || [];
      setOrders(ordersData);
      await AsyncStorage.setItem(ORDERS_CACHE_KEY + 'all', JSON.stringify(ordersData));
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      if (!silent) setError(err.message || 'Failed to load orders');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  /** Load the latest persisted tracking state (source of truth for the modal) */
  const loadTracking = async (orderId: string, showSpinner = false) => {
    if (showSpinner) setTrackingLoading(true);
    try {
      const res = await api.user.getOrderTracking(orderId);
      if (trackingOrderIdRef.current !== orderId) return; // modal moved on
      if (res?.success && res.order) {
        setTrackingData((prev: any) => ({
          ...res.order,
          // keep a fresher socket location if the stored one is older
          riderLocation: prev?.riderLocation && prev?._id === res.order._id ? prev.riderLocation : res.order.riderLocation,
        }));
        setSelectedOrder((prev: any) => prev ? { ...prev, status: res.order.status, deliveryStatus: res.order.deliveryStatus } : prev);
        setTrackingError(null);
        if (['delivered', 'cancelled'].includes(res.order.status)) {
          stopPolling();
          fetchOrders(true);
        }
      } else {
        setTrackingError(res?.message || 'Could not load tracking details.');
      }
    } catch (e: any) {
      console.warn('getOrderTracking error:', e);
      if (trackingOrderIdRef.current === orderId) {
        setTrackingError(e?.message?.includes('not found') ? 'This order could not be found.' : 'Could not reach the server. Retrying...');
      }
    } finally {
      if (showSpinner) setTrackingLoading(false);
    }
  };

  const stopPolling = () => {
    if (trackingPoll.current) {
      clearInterval(trackingPoll.current);
      trackingPoll.current = null;
    }
  };

  const stopTracking = () => {
    stopPolling();
    const orderId = trackingOrderIdRef.current;
    if (orderId && trackingCallbacks.current) {
      untrackOrder(orderId, trackingCallbacks.current.onLocation, trackingCallbacks.current.onStatus);
    }
    trackingCallbacks.current = null;
    trackingOrderIdRef.current = null;
    pulseLoop.current?.stop();
    pulseLoop.current = null;
  };

  const showOrderTracking = async (order: Order) => {
    stopTracking();
    trackingOrderIdRef.current = order._id;
    setSelectedOrder(order);
    setShowTrackingModal(true);
    setTrackingData(null);
    setTrackingError(null);

    await loadTracking(order._id, true);

    const onLocation = (loc: any) => {
      if (loc?.lat == null || loc?.lng == null) return;
      setTrackingData((prev: any) => prev ? { ...prev, riderLocation: { lat: Number(loc.lat), lng: Number(loc.lng) } } : prev);
    };
    const onStatus = (statusData: any) => {
      if (!statusData?.status && statusData?.deliveryStatus === undefined) return;
      setSelectedOrder((prev: any) => prev ? {
        ...prev,
        status: statusData.status || prev.status,
        deliveryStatus: statusData.deliveryStatus !== undefined ? statusData.deliveryStatus : prev.deliveryStatus,
      } : prev);
      setTrackingData((prev: any) => prev ? {
        ...prev,
        status: statusData.status || prev.status,
        deliveryStatus: statusData.deliveryStatus !== undefined ? statusData.deliveryStatus : prev.deliveryStatus,
      } : prev);
      // Re-read persisted state for rider details, timeline history and final states
      loadTracking(order._id);
    };
    trackingCallbacks.current = { onLocation, onStatus };
    trackOrder(order._id, onLocation, onStatus);

    // Fallback when socket events are missed (background, flaky network)
    if (ACTIVE_STATUSES.includes(order.status)) {
      trackingPoll.current = setInterval(() => loadTracking(order._id), TRACKING_POLL_MS);
    }

    // Start pulse animation for active step
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  };

  const closeTrackingModal = () => {
    stopTracking();
    setShowTrackingModal(false);
  };

  const handleCancelOrder = async (order: Order) => {
    console.log(`[UI Debug] handleCancelOrder called for order: ${order._id}`);
    
    const cancelAction = async () => {
      console.log(`[UI Debug] Cancel confirmed for order: ${order._id}`);
      try {
        await api.user.cancelOrder(order._id);
        Toast.show({
          type: 'success',
          text1: 'Order Cancelled',
          text2: 'Your order has been cancelled successfully.',
        });
        fetchOrders();
      } catch (error: any) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error.message || 'Failed to cancel order',
        });
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to cancel this order?')) {
        cancelAction();
      }
    } else {
      Alert.alert(
        'Cancel Order',
        'Are you sure you want to cancel this order?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes',
            style: 'destructive',
            onPress: cancelAction
          }
        ]
      );
    }
  };

  const handleRateOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowRatingModal(true);
  };

  const submitRating = async () => {
    if (!selectedOrder || rating === 0) return;
    
    try {
      await api.user.rateOrder(selectedOrder._id, rating);
      Alert.alert('Success', 'Rating submitted successfully');
      setShowRatingModal(false);
      setRating(0);
      fetchOrders();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit rating');
    }
  };

  const downloadInvoice = async (orderId: string) => {
    try {
      const url = await api.user.downloadInvoice(orderId);
      if (!url) {
        Alert.alert('Error', 'Could not generate invoice link');
        return;
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
          return;
        }
      } catch (_) {}

      await WebBrowser.openBrowserAsync(url);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to download invoice');
    }
  };

  const renderStatusBadge = (status: string) => (
    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
      <Text style={[styles.statusText, { color: getStatusTextColor(status) }]}>
        {getStatusText(status)}
      </Text>
    </View>
  );

  const renderOrderTracker = (order: Order) => {
    const status = order.status;
    const { reached } = getReachedSteps(status, order.deliveryStatus, (order as any).statusHistory);
    const currentIdx = statusSteps.reduce((acc, s, i) => (reached.has(s.key) ? i : acc), 0);

    if (status === 'cancelled') {
      return (
        <View style={styles.cancelledTracker}>
          <View style={styles.cancelledDot} />
          <Text style={styles.cancelledText}>Order Cancelled</Text>
        </View>
      );
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trackerContainer}>
        <View style={styles.tracker}>
          {statusSteps.map((step, idx) => (
            <View key={step.key} style={styles.trackerStep}>
              <View style={styles.stepContainer}>
                <View style={[
                  styles.stepDot,
                  idx <= currentIdx ? styles.stepDotActive : styles.stepDotInactive
                ]}>
                  <Text style={[
                    styles.stepDotText,
                    idx <= currentIdx ? styles.stepDotTextActive : styles.stepDotTextInactive
                  ]}>
                    {idx <= currentIdx ? '✓' : idx + 1}
                  </Text>
                </View>
                <Text style={[
                  styles.stepLabel,
                  idx <= currentIdx ? styles.stepLabelActive : styles.stepLabelInactive
                ]}>
                  {step.label}
                </Text>
              </View>
              {idx < statusSteps.length - 1 && (
                <View style={[
                  styles.stepLine,
                  idx < currentIdx ? styles.stepLineActive : styles.stepLineInactive
                ]} />
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderOrderCard = (order: Order) => {
    const sellerObj: any = typeof order.sellerId === 'object' ? order.sellerId : null;
    const sellerName = sellerObj?.businessName || order.sellerName || 'Kitchen';
    const status = orderStatusColors[order.status] || { bg: colors.surfaceMuted, fg: colors.textSecondary, label: order.status };
    const isActive = ACTIVE_STATUSES.includes(order.status);
    const step = LIST_STEPS.indexOf(order.status === 'ready' ? 'preparing' : order.status);
    const summary = (order.items || []).map((i: any) => `${i.quantity} × ${i.name}`).join(', ');
    const placed = new Date(order.createdAt);
    const when = placed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + placed.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

    return (
      <TouchableOpacity
        key={order._id}
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('OrderDetails', { orderId: order._id })}
        accessibilityRole="button"
        accessibilityLabel={`Order from ${sellerName}, ${status.label}, ${formatPrice(order.total)}`}
      >
        <View style={styles.cardTop}>
          <KitchenMark name={sellerName} logo={sellerObj?.logo} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardKitchen} numberOfLines={1}>{sellerName}</Text>
            <Text style={type.caption} numberOfLines={1}>{when} · #{order.orderNumber}</Text>
          </View>
          <Text style={styles.cardTotal}>{formatPrice(order.total)}</Text>
        </View>

        <Text style={[type.small, styles.cardItems]} numberOfLines={2}>{summary}</Text>

        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: status.fg }]} />
          <Text style={[styles.statusLabel, { color: status.fg }]}>{status.label}</Text>
          {(order as any).paymentStatus === 'pending' && order.paymentMethod !== 'cod' && order.status !== 'cancelled' ? (
            <Text style={type.caption}>· payment being confirmed</Text>
          ) : null}
        </View>
        {isActive && step >= 0 ? (
          <View style={styles.miniProgress}>
            {LIST_STEPS.map((k, i) => (
              <View key={k} style={[styles.miniBar, i <= step && styles.miniBarDone]} />
            ))}
          </View>
        ) : null}

        <View style={styles.actions}>
          {isActive ? (
            <TouchableOpacity style={styles.primaryAction} onPress={() => showOrderTracking(order)} accessibilityRole="button">
              <Ionicons name="navigate" size={14} color={colors.textInverse} />
              <Text style={styles.primaryActionText}>Track</Text>
            </TouchableOpacity>
          ) : null}
          {order.status === 'delivered' && !order.rating ? (
            <TouchableOpacity style={styles.primaryAction} onPress={() => handleRateOrder(order)} accessibilityRole="button">
              <Ionicons name="star" size={14} color={colors.textInverse} />
              <Text style={styles.primaryActionText}>Rate</Text>
            </TouchableOpacity>
          ) : null}
          {order.rating ? (
            <View style={styles.ratedPill}>
              <Ionicons name="star" size={12} color={colors.rating} />
              <Text style={styles.ratedText}>You rated {order.rating}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => downloadInvoice(order._id)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.textAction}>Invoice</Text>
          </TouchableOpacity>
          {['pending', 'confirmed', 'preparing'].includes(order.status) ? (
            <TouchableOpacity onPress={() => handleCancelOrder(order)} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.textAction, { color: colors.danger }]}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return ACTIVE_STATUSES.includes(order.status);
    return order.status === activeTab;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.pageHeader}>
        <Text style={type.display}>Orders</Text>
        <Text style={type.caption}>{orders.length ? `${orders.length} in total` : ''}</Text>
      </View>

      <View style={styles.tabs}>
        {LIST_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = orders.filter((o) => (tab.key === 'all' ? true : tab.key === 'active' ? ACTIVE_STATUSES.includes(o.status) : o.status === tab.key)).length;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}{count ? ` ${count}` : ''}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {loading ? (
          <View style={{ gap: spacing.md }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={150} radius={radius.xl} />)}
          </View>
        ) : error ? (
          <ErrorState title="Couldn't load your orders" message={error} onRetry={() => fetchOrders()} />
        ) : filteredOrders.length > 0 ? (
          filteredOrders.map(renderOrderCard)
        ) : (
          <EmptyState
            icon="receipt-outline"
            title={activeTab === 'active' ? 'Nothing cooking right now' : 'No orders here yet'}
            subtitle={activeTab === 'active' ? 'Orders you place show up here while they’re being cooked and delivered.' : 'Your past orders will appear here.'}
            actionText="Find something to eat"
            onAction={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          />
        )}
      </ScrollView>

      {/* ─── Swiggy-Style Order Tracking Modal ─── */}
      <Modal
        visible={showTrackingModal}
        transparent
        animationType="slide"
        onRequestClose={closeTrackingModal}
      >
        <View style={styles.trackingModalOverlay}>
          <View style={styles.trackingModalContainer}>
            {/* Header */}
            <View style={styles.trackingModalHeader}>
              <View>
                <Text style={styles.trackingModalTitle}>Order Tracking</Text>
                {selectedOrder && (
                  <Text style={styles.trackingModalOrderNum}>#{selectedOrder.orderNumber}</Text>
                )}
              </View>
              <TouchableOpacity onPress={closeTrackingModal} style={styles.trackingCloseBtn}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Live Delivery Map */}
            {selectedOrder && (
              <DeliveryMap
                pickupCoords={trackingData?.pickupCoords}
                dropCoords={trackingData?.dropCoords}
                riderCoords={trackingData?.riderLocation}
                restaurantName={trackingData?.restaurantName || selectedOrder.sellerName || 'Restaurant'}
                height={200}
              />
            )}

            {/* Rider Info Card (when rider is assigned) */}
            {trackingData?.riderInfo && (
              <View style={styles.trackingRiderCard}>
                <View style={styles.trackingRiderAvatar}>
                  <Ionicons name="bicycle" size={20} color="#166534" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trackingRiderName}>{trackingData.riderInfo.name}</Text>
                  <Text style={styles.trackingRiderVehicle}>
                    {trackingData.riderInfo.vehicleType ? String(trackingData.riderInfo.vehicleType).toUpperCase() : 'BIKE'}
                    {trackingData.riderInfo.vehicleNumber ? ` • ${trackingData.riderInfo.vehicleNumber}` : ''}
                    {' '}| Rating: {trackingData.riderInfo.rating || '5.0'}
                  </Text>
                </View>
                {trackingData.riderInfo.phone ? (
                  <TouchableOpacity
                    style={styles.trackingCallBtn}
                    onPress={() => Linking.openURL(`tel:${trackingData.riderInfo.phone}`)}
                  >
                    <Ionicons name="call" size={18} color="#fff" />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {/* Seller Info */}
            {selectedOrder && (() => {
              const sellerObj = typeof selectedOrder.sellerId === 'object' ? selectedOrder.sellerId : null;
              const sellerName = sellerObj?.businessName || selectedOrder.sellerName || 'Seller';
              return (
                <View style={styles.trackingSellerRow}>
                  <View style={styles.trackingSellerIcon}>
                    <Ionicons name="restaurant" size={20} color="#FF6B00" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trackingSellerName}>{sellerName}</Text>
                    <Text style={styles.trackingItemsText}>
                      {selectedOrder.items.map(i => `${i.name} x${i.quantity}`).join(', ')}
                    </Text>
                  </View>
                  <Text style={styles.trackingTotalBadge}>₹{selectedOrder.total}</Text>
                </View>
              );
            })()}

            {trackingLoading && (
              <View style={styles.trackingInfoRow}>
                <ActivityIndicator size="small" color="#FF6B00" />
                <Text style={styles.trackingInfoText}>Loading latest status...</Text>
              </View>
            )}
            {!!trackingError && !trackingLoading && (
              <TouchableOpacity
                style={[styles.trackingInfoRow, styles.trackingErrorRow]}
                onPress={() => selectedOrder && loadTracking(selectedOrder._id, true)}
              >
                <Ionicons name="cloud-offline-outline" size={16} color="#B91C1C" />
                <Text style={[styles.trackingInfoText, { color: '#B91C1C' }]}>{trackingError} Tap to retry.</Text>
              </TouchableOpacity>
            )}

            {/* Status Steps */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {(() => {
                const currentStatus = trackingData?.status || selectedOrder?.status || 'pending';
                const { reached, currentIdx } = getReachedSteps(
                  currentStatus,
                  trackingData?.deliveryStatus ?? selectedOrder?.deliveryStatus,
                  trackingData?.statusHistory,
                );
                const isCancelled = currentStatus === 'cancelled';

                if (isCancelled) {
                  return (
                    <View style={styles.cancelledState}>
                      <View style={styles.cancelledIconCircle}>
                        <Ionicons name="close-circle" size={48} color="#DC2626" />
                      </View>
                      <Text style={styles.cancelledStateTitle}>Order Cancelled</Text>
                      <Text style={styles.cancelledStateSubtitle}>Your order has been cancelled</Text>
                    </View>
                  );
                }

                return (
                  <View style={styles.stepsContainer}>
                    {statusSteps.map((step, idx) => {
                      const isActive = idx === currentIdx && currentStatus !== 'delivered';
                      const isCompleted = !isActive && (idx < currentIdx || reached.has(step.key));
                      const isPending = !isActive && !isCompleted;
                      return (
                        <View key={step.key} style={styles.stepRow}>
                          {/* Left column: dot + line */}
                          <View style={styles.stepLeftCol}>
                            {isActive ? (
                              <Animated.View style={[styles.stepDotActive, { transform: [{ scale: pulseAnim }] }]}>
                                <Ionicons name="ellipse" size={12} color="#fff" />
                              </Animated.View>
                            ) : isCompleted ? (
                              <View style={styles.stepDotDone}>
                                <Ionicons name="checkmark" size={12} color="#fff" />
                              </View>
                            ) : (
                              <View style={styles.stepDotPending} />
                            )}
                            {idx < statusSteps.length - 1 && (
                              <View style={[styles.stepConnector, isCompleted && styles.stepConnectorDone]} />
                            )}
                          </View>

                          {/* Right column: label + sublabel */}
                          <View style={styles.stepRightCol}>
                            <Text style={[
                              styles.stepName,
                              isActive && styles.stepNameActive,
                              isCompleted && styles.stepNameDone,
                              isPending && styles.stepNamePending,
                            ]}>
                              {step.label}
                            </Text>
                            {isActive && (
                              <Text style={styles.stepActiveSubLabel}>
                                {step.key === 'rider_assigned' && trackingData?.deliveryStatus === 'arrived_at_restaurant'
                                  ? 'Delivery partner is at the restaurant'
                                  : STEP_SUBLABELS[step.key]}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}
            </ScrollView>

            {/* Bottom status message */}
            {(trackingData?.status === 'delivered' || selectedOrder?.status === 'delivered') && (
              <View style={styles.trackingInfoRow}>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text style={[styles.trackingInfoText, { color: colors.success }]}>
                  Delivered{trackingData?.actualDelivery ? ` at ${new Date(trackingData.actualDelivery).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </Text>
              </View>
            )}

            {selectedOrder && !['cancelled', 'delivered'].includes(trackingData?.status || selectedOrder.status) && (
              <View style={styles.trackingStatusBar}>
                <View style={styles.trackingStatusDot} />
                <Text style={styles.trackingStatusBarText}>Tracking your order in real-time</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Rating Modal */}

      <Modal
        visible={showRatingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModal}>
            <Text style={styles.ratingModalTitle}>Rate Your Order</Text>
            <Text style={styles.ratingModalSubtitle}>
              How was your experience with {selectedOrder?.sellerName || 'this seller'}?
            </Text>
            
            <View style={styles.starsContainer}>
              {[1,2,3,4,5].map(star => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Ionicons 
                    name={star <= rating ? 'star' : 'star-outline'} 
                    size={32} 
                    color={star <= rating ? '#FFD700' : colors.textTertiary} 
                  />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.ratingModalButtons}>
              <TouchableOpacity 
                style={styles.ratingCancelButton} 
                onPress={() => setShowRatingModal(false)}
              >
                <Text style={styles.ratingCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.ratingSubmitButton, rating === 0 && styles.ratingSubmitDisabled]} 
                onPress={submitRating}
                disabled={rating === 0}
              >
                <Text style={styles.ratingSubmitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: spacing.screen, paddingTop: spacing.md },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.screen, paddingVertical: spacing.lg },
  tab: { height: 36, paddingHorizontal: spacing.md + 2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  tabActive: { backgroundColor: colors.text, borderColor: colors.text },
  tabText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  tabTextActive: { color: colors.textInverse },
  list: { paddingHorizontal: spacing.screen, paddingBottom: 120, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardKitchen: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  cardTotal: { fontFamily: fonts.heavy, fontSize: 16, color: colors.text },
  cardItems: { color: colors.textSecondary, marginTop: spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontFamily: fonts.bold, fontSize: 13 },
  miniProgress: { flexDirection: 'row', gap: 4, marginTop: spacing.sm },
  miniBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.surfaceSunken },
  miniBarDone: { backgroundColor: colors.primary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  primaryAction: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: spacing.lg, borderRadius: 10, backgroundColor: colors.text },
  primaryActionText: { fontFamily: fonts.bold, fontSize: 13, color: colors.textInverse },
  ratedPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratedText: { ...type.caption },
  textAction: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },

  container: {
    flex: 1,
    backgroundColor: '#F5F2E8',
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 4,
  },
  orderCount: {
    fontSize: 14,
    color: colors.textSecondary, fontFamily: fonts.regular,
  },
  tabsSection: {
    backgroundColor: colors.canvas,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  tabsScrollContainer: {
    paddingHorizontal: 4,
    gap: 4,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    minHeight: 36,
  },
  activeFilterTab: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: '#6b7280',
  },
  activeFilterTabText: {
    color: '#1f2937',
    fontFamily: fonts.bold,
  },
  tabBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  activeTabBadge: {
    backgroundColor: colors.primary,
  },
  tabBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: '#6b7280',
  },
  activeTabBadgeText: {
    color: colors.surface,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary, fontFamily: fonts.regular,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  orderNumber: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
    flexShrink: 1,
  },
  orderPrice: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  sellerInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12, fontFamily: fonts.regular,
  },
  itemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: 8,
    padding: 8,
    gap: 8,
  },
  itemImage: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
  itemText: {
    fontSize: 14,
    color: colors.text, fontFamily: fonts.regular,
  },
  trackerContainer: {
    marginVertical: 16,
  },
  tracker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  trackerStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepContainer: {
    alignItems: 'center',
    minWidth: 60,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepDotInactive: {
    backgroundColor: colors.border,
  },
  stepDotText: {
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  stepDotTextActive: {
    color: colors.surface,
  },
  stepDotTextInactive: {
    color: colors.textTertiary,
  },
  stepLabel: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 12, fontFamily: fonts.regular,
  },
  stepLabelActive: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  stepLabelInactive: {
    color: colors.textTertiary,
  },
  stepLine: {
    width: 24,
    height: 2,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },
  stepLineInactive: {
    backgroundColor: colors.border,
  },
  cancelledTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  cancelledDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.danger,
  },
  cancelledText: {
    fontSize: 14,
    color: colors.danger,
    fontFamily: fonts.bold,
  },
  trackingSection: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  trackingTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#0369a1',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
    alignSelf: 'flex-start',
  },
  mapButtonText: {
    fontSize: 12,
    color: colors.surface,
    fontFamily: fonts.bold,
  },
  subscriptionInfo: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  subscriptionTitle: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: '#166534',
  },
  subscriptionAmount: {
    fontSize: 12,
    color: '#16a34a', fontFamily: fonts.regular,
  },
  subscriptionDays: {
    fontSize: 12,
    color: '#16a34a', fontFamily: fonts.regular,
  },
  subscriptionPaid: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: '#166534',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#bbf7d0',
  },
  paymentMethod: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 16, fontFamily: fonts.regular,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f0',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  rateButtonText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  ratingDisplay: {
    flexDirection: 'row',
    gap: 2,
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  invoiceButtonText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  cancelButtonText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.danger,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  trackButtonText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.surface,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24, fontFamily: fonts.regular,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.surface,
  },
  browseButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  browseButtonText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.surface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingModal: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    alignItems: 'center',
  },
  ratingModalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 8,
  },
  ratingModalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24, fontFamily: fonts.regular,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  ratingModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingCancelText: {
    fontSize: 14,
    color: colors.textSecondary, fontFamily: fonts.regular,
  },
  ratingSubmitButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  ratingSubmitDisabled: {
    backgroundColor: '#FFB380',
  },
  ratingSubmitText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.surface,
  },

  // ─── Swiggy-Style Tracking Modal ───────────────
  trackingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  trackingModalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '92%',
  },
  trackingModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  trackingModalTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  trackingModalOrderNum: {
    fontSize: 13,
    color: colors.primary,
    fontFamily: fonts.bold,
    marginTop: 2,
  },
  trackingCloseBtn: {
    backgroundColor: colors.canvas,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingRiderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 10,
  },
  trackingRiderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingRiderName: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#166534',
  },
  trackingRiderVehicle: {
    fontSize: 12,
    color: '#15803D',
    marginTop: 1, fontFamily: fonts.regular,
  },
  trackingCallBtn: {
    backgroundColor: colors.success,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F3',
    borderRadius: 14,
    padding: 12,
    marginVertical: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FFE4CC',
  },
  trackingSellerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF0E5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFD5AE',
  },
  trackingSellerName: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  trackingItemsText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2, fontFamily: fonts.regular,
  },
  trackingTotalBadge: {
    fontSize: 16,
    fontFamily: fonts.heavy,
    color: colors.primary,
  },
  stepsContainer: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    minHeight: 64,
  },
  stepLeftCol: {
    width: 32,
    alignItems: 'center',
  },
  stepDotDone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  stepDotPending: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  stepConnector: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  stepConnectorDone: {
    backgroundColor: colors.success,
  },
  stepRightCol: {
    flex: 1,
    paddingLeft: 14,
    paddingBottom: 16,
  },
  stepName: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.text,
    paddingTop: 4,
  },
  stepNameActive: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  stepNameDone: {
    color: colors.success,
  },
  stepNamePending: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
  },
  stepActiveSubLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
    lineHeight: 18, fontFamily: fonts.regular,
  },
  cancelledState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  cancelledIconCircle: {
    marginBottom: 12,
  },
  cancelledStateTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.danger,
    marginBottom: 6,
  },
  cancelledStateSubtitle: {
    fontSize: 13,
    color: colors.textTertiary, fontFamily: fonts.regular,
  },
  trackingInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.canvas,
  },
  trackingErrorRow: {
    backgroundColor: '#FEF2F2',
  },
  trackingInfoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  trackingStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFF4',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  trackingStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  trackingStatusBarText: {
    fontSize: 12,
    color: '#15803D',
    fontFamily: fonts.bold,
  },
});