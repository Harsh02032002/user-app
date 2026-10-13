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
import { AppHeader } from '../../components/common/AppHeader';
import { AppFooter } from '../../components/common/AppFooter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeliveryMap } from '../../components/common/DeliveryMap';
import { trackOrder, untrackOrder, onAnyOrderUpdate } from '../../services/socket';
import { useIsFocused } from '@react-navigation/native';

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
    default: return '#F3F4F6';
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
    case 'cancelled': return '#DC2626';
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
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
  }, [activeTab]);

  // Keep the list in sync: refresh when coming back to the tab and on live status pushes
  useEffect(() => {
    if (!isFocused) return;
    fetchOrders(true);
    const unsubscribe = onAnyOrderUpdate((data: any) => {
      if (data?.type === 'reconnected' || data?.orderId) fetchOrders(true);
    });
    return unsubscribe;
  }, [isFocused, activeTab]);

  // Stop tracking listeners/polling if the screen unmounts with the modal open
  useEffect(() => () => stopTracking(), []);

  const loadCachedData = async () => {
    try {
      const cached = await AsyncStorage.getItem(ORDERS_CACHE_KEY + activeTab);
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
      const response = await api.user.getOrders(activeTab === 'all' ? undefined : activeTab);
      const ordersData = Array.isArray(response) ? response : response.orders || response.data || [];
      setOrders(ordersData);
      await AsyncStorage.setItem(ORDERS_CACHE_KEY + activeTab, JSON.stringify(ordersData));
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
      if (url) {
        Alert.alert(
          '📄 Download Invoice PDF',
          'Invoice download link generated!\nTap "Download PDF" to save the invoice directly to your device.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Download PDF 📥',
              onPress: async () => {
                try {
                  await WebBrowser.openBrowserAsync(url);
                } catch (e) {
                  await Linking.openURL(url);
                }
              },
            },
          ]
        );
      }
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
    const sellerObj = typeof order.sellerId === 'object' ? order.sellerId : null;
    const sellerName = sellerObj?.businessName || order.sellerName || 'Seller';

    return (
      <View key={order._id} style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            {renderStatusBadge(order.status)}
          </View>
          <Text style={styles.orderPrice}>₹{order.total}</Text>
        </View>

        <Text style={styles.sellerInfo}>
          {sellerName} • {new Date(order.createdAt).toLocaleDateString('en-IN', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
          })}
        </Text>

        {/* Order Items */}
        <View style={styles.itemsContainer}>
          {order.items.map((item, idx) => (
            <View key={idx} style={styles.itemCard}>
              {item.image && (
                <Image source={{ uri: item.image }} style={styles.itemImage} />
              )}
              <Text style={styles.itemText}>{item.name} x{item.quantity}</Text>
            </View>
          ))}
        </View>

        {/* Order Tracker */}
        {renderOrderTracker(order)}

        {/* Live status summary */}
        {['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status) && (
          <View style={styles.trackingSection}>
            <View style={styles.trackingHeader}>
              <Ionicons name="bicycle" size={16} color="#FF6B00" />
              <Text style={styles.trackingTitle}>
                {order.status === 'out_for_delivery' ? '🛵 Your order is on the way!' :
                 order.deliveryStatus ? '🛵 Delivery partner assigned' :
                 order.status === 'ready' ? '✅ Food is ready!' :
                 order.status === 'preparing' ? '👨‍🍳 Being prepared...' : '✅ Order confirmed!'}
              </Text>
            </View>
          </View>
        )}

        {/* Subscription Info */}
        {Boolean(order.subscriptionAmountUsed && order.subscriptionAmountUsed > 0) && (
          <View style={styles.subscriptionInfo}>
            <Text style={styles.subscriptionTitle}>Subscription Used</Text>
            <Text style={styles.subscriptionAmount}>-₹{order.subscriptionAmountUsed}</Text>
            {Boolean(order.subscriptionDaysDeducted && order.subscriptionDaysDeducted > 0) && (
              <Text style={styles.subscriptionDays}>-{order.subscriptionDaysDeducted} days</Text>
            )}
            {Boolean(order.payableAfterSubscription && order.payableAfterSubscription > 0) && (
              <Text style={styles.subscriptionPaid}>Paid: ₹{order.payableAfterSubscription}</Text>
            )}
          </View>
        )}

        <Text style={styles.paymentMethod}>
          {order.paymentMethod?.replace('_', ' ').toUpperCase()}
        </Text>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {/* Rating Button */}
          {order.status === 'delivered' && !order.rating && (
            <TouchableOpacity style={styles.rateButton} onPress={() => handleRateOrder(order)}>
              <Ionicons name="star-outline" size={14} color="#FF6B00" />
              <Text style={styles.rateButtonText}>Rate Order</Text>
            </TouchableOpacity>
          )}

          {/* Show Rating */}
          {order.rating && (
            <View style={styles.ratingDisplay}>
              {[1,2,3,4,5].map(s => (
                <Ionicons 
                  key={s} 
                  name={s <= order.rating! ? 'star' : 'star-outline'} 
                  size={14} 
                  color={s <= order.rating! ? '#FFD700' : '#999'} 
                />
              ))}
            </View>
          )}

          {/* Invoice Button */}
          <TouchableOpacity style={styles.invoiceButton} onPress={() => downloadInvoice(order._id)}>
            <Ionicons name="download-outline" size={14} color="#666" />
            <Text style={styles.invoiceButtonText}>Invoice</Text>
          </TouchableOpacity>

          {/* Cancel Button */}
          {['pending', 'confirmed', 'preparing'].includes(order.status) && (
            <TouchableOpacity style={styles.cancelButton} onPress={() => handleCancelOrder(order)}>
              <Ionicons name="close-circle-outline" size={14} color="#DC2626" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}

          {/* Track Button */}
          {ACTIVE_STATUSES.includes(order.status) && (
            <TouchableOpacity style={styles.trackButton} onPress={() => showOrderTracking(order)}>
              <Ionicons name="location-outline" size={14} color="#fff" />
              <Text style={styles.trackButtonText}>Track</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const filteredOrders = orders.filter(order => 
    activeTab === 'all' || order.status === activeTab
  );

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showSearch={false} />
      
      <View style={styles.headerSection}>
        <Text style={styles.pageTitle}>My Orders</Text>
        <Text style={styles.orderCount}>{filteredOrders.length} orders</Text>
      </View>

      {/* Status Tabs */}
      <View style={styles.tabsSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContainer}>
          {statusTabs.map(tab => {
            const isActive = activeTab === tab;
            const tabCount = orders.filter(order => tab === 'all' || order.status === tab).length;
            
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.filterTab, isActive && styles.activeFilterTab]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.filterTabText, isActive && styles.activeFilterTabText]}>
                  {tab.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
                <View style={[styles.tabBadge, isActive && styles.activeTabBadge]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.activeTabBadgeText]}>
                    {tabCount}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6B00" />
            <Text style={styles.loadingText}>Loading orders...</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={64} color="#ff4444" />
            <Text style={styles.emptyTitle}>Error loading orders</Text>
            <Text style={styles.emptySubtitle}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchOrders()}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : filteredOrders.length > 0 ? (
          filteredOrders.map(renderOrderCard)
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="bag-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No orders found</Text>
            <Text style={styles.emptySubtitle}>Start ordering delicious food!</Text>
            <TouchableOpacity style={styles.browseButton}>
              <Text style={styles.browseButtonText}>Browse Food</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 20 }} />
        <AppFooter />
        <View style={{ height: 120 }} />
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
                  <Text style={{ fontSize: 20 }}>🛵</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trackingRiderName}>{trackingData.riderInfo.name}</Text>
                  <Text style={styles.trackingRiderVehicle}>
                    {trackingData.riderInfo.vehicleType ? String(trackingData.riderInfo.vehicleType).toUpperCase() : 'BIKE'}
                    {trackingData.riderInfo.vehicleNumber ? ` • ${trackingData.riderInfo.vehicleNumber}` : ''}
                    {' '}| ⭐ {trackingData.riderInfo.rating || '5.0'}
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
                <Text style={[styles.trackingInfoText, { color: '#16A34A' }]}>
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
                    color={star <= rating ? '#FFD700' : '#999'} 
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
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  orderCount: {
    fontSize: 14,
    color: '#666',
  },
  tabsSection: {
    backgroundColor: '#f8f9fa',
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
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeFilterTabText: {
    color: '#1f2937',
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  activeTabBadge: {
    backgroundColor: '#FF6B00',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTabBadgeText: {
    color: '#fff',
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
    color: '#666',
  },
  orderCard: {
    backgroundColor: '#fff',
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
    fontWeight: '600',
    color: '#1a1a1a',
    flexShrink: 1,
  },
  orderPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  sellerInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
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
    backgroundColor: '#f5f5f5',
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
    color: '#1a1a1a',
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
    backgroundColor: '#e5e5e5',
  },
  stepDotText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  stepDotTextActive: {
    color: '#fff',
  },
  stepDotTextInactive: {
    color: '#999',
  },
  stepLabel: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 12,
  },
  stepLabelActive: {
    color: '#FF6B00',
    fontWeight: '600',
  },
  stepLabelInactive: {
    color: '#999',
  },
  stepLine: {
    width: 24,
    height: 2,
  },
  stepLineActive: {
    backgroundColor: '#FF6B00',
  },
  stepLineInactive: {
    backgroundColor: '#e5e5e5',
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
    backgroundColor: '#DC2626',
  },
  cancelledText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
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
    fontWeight: '600',
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
    color: '#fff',
    fontWeight: '600',
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
    fontWeight: '600',
    color: '#166534',
  },
  subscriptionAmount: {
    fontSize: 12,
    color: '#16a34a',
  },
  subscriptionDays: {
    fontSize: 12,
    color: '#16a34a',
  },
  subscriptionPaid: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#bbf7d0',
  },
  paymentMethod: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
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
    borderColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  rateButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF6B00',
  },
  ratingDisplay: {
    flexDirection: 'row',
    gap: 2,
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  invoiceButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  cancelButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  trackButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  browseButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  browseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    alignItems: 'center',
  },
  ratingModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  ratingModalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
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
    borderColor: '#ddd',
  },
  ratingCancelText: {
    fontSize: 14,
    color: '#666',
  },
  ratingSubmitButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FF6B00',
  },
  ratingSubmitDisabled: {
    backgroundColor: '#FFB380',
  },
  ratingSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // ─── Swiggy-Style Tracking Modal ───────────────
  trackingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  trackingModalContainer: {
    backgroundColor: '#fff',
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
    fontWeight: '700',
    color: '#111',
  },
  trackingModalOrderNum: {
    fontSize: 13,
    color: '#FF6B00',
    fontWeight: '600',
    marginTop: 2,
  },
  trackingCloseBtn: {
    backgroundColor: '#f3f4f6',
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
    fontWeight: '700',
    color: '#166534',
  },
  trackingRiderVehicle: {
    fontSize: 12,
    color: '#15803D',
    marginTop: 1,
  },
  trackingCallBtn: {
    backgroundColor: '#16A34A',
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
    fontWeight: '700',
    color: '#111',
  },
  trackingItemsText: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  trackingTotalBadge: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FF6B00',
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
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  stepDotPending: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  stepConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  stepConnectorDone: {
    backgroundColor: '#22C55E',
  },
  stepRightCol: {
    flex: 1,
    paddingLeft: 14,
    paddingBottom: 16,
  },
  stepName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    paddingTop: 4,
  },
  stepNameActive: {
    color: '#FF6B00',
    fontWeight: '700',
    fontSize: 16,
  },
  stepNameDone: {
    color: '#22C55E',
  },
  stepNamePending: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  stepActiveSubLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    lineHeight: 18,
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
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 6,
  },
  cancelledStateSubtitle: {
    fontSize: 13,
    color: '#888',
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
    backgroundColor: '#F9FAFB',
  },
  trackingErrorRow: {
    backgroundColor: '#FEF2F2',
  },
  trackingInfoText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
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
    backgroundColor: '#22C55E',
  },
  trackingStatusBarText: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '600',
  },
});