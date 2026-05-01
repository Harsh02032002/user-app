import React, { useState, useEffect } from 'react';
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
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { AppHeader } from '../../components/common/AppHeader';
import { AppFooter } from '../../components/common/AppFooter';
import { DeliveryMap } from '../../components/common/DeliveryMap';
import { getCurrentCoordinates } from '../../utils/location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ORDERS_CACHE_KEY = 'orders_screen_cache';

const { width } = Dimensions.get('window');

// Order type definition matching website
interface Order {
  _id: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
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

const statusTabs = ['all', 'pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return '#FEF3C7';
    case 'confirmed': return '#DBEAFE';
    case 'preparing': return '#E9D5FF';
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
  { key: 'ready', label: 'Ready' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

export function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [userLocation, setUserLocation] = useState<[number, number] | undefined>(undefined);

  useEffect(() => {
    loadCachedData().then(() => {
      fetchOrders();
      loadUserLocation();
    });
  }, [activeTab]);

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

  const loadUserLocation = async () => {
    const coords = await getCurrentCoordinates();
    if (coords) {
      setUserLocation([coords.longitude, coords.latitude]);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.user.getOrders(activeTab === 'all' ? undefined : activeTab);
      const ordersData = Array.isArray(response) ? response : response.orders || response.data || [];
      setOrders(ordersData);
      
      // Cache the results for this tab
      await AsyncStorage.setItem(ORDERS_CACHE_KEY + activeTab, JSON.stringify(ordersData));
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const openMap = (order: Order) => {
    const deliveryLat = 19.0760;
    const deliveryLng = 72.8777;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${deliveryLat},${deliveryLng}`;
    Linking.openURL(url);
  };

  const showOrderTracking = (order: Order) => {
    setSelectedOrder(order);
    setShowTrackingModal(true);
  };

  const handleCancelOrder = async (order: Order) => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.user.cancelOrder(order._id);
              Alert.alert('Success', 'Order cancelled successfully');
              fetchOrders();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel order');
            }
          }
        }
      ]
    );
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
      await api.user.downloadInvoice(orderId);
      Alert.alert('Success', 'Invoice download started');
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

  const renderOrderTracker = (status: string) => {
    const currentIdx = statusSteps.findIndex(s => s.key === status);
    
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
        {renderOrderTracker(order.status)}

        {/* Live Tracking Map for Active Orders */}
        {['confirmed', 'preparing', 'out_for_delivery'].includes(order.status) && (
          <View style={styles.trackingSection}>
            <View style={styles.trackingHeader}>
              <Ionicons name="location" size={16} color="#FF6B00" />
              <Text style={styles.trackingTitle}>Live Order Tracking</Text>
            </View>
            
            <DeliveryMap 
              userCoords={userLocation}
              height={180}
            />

            <TouchableOpacity style={styles.mapButton} onPress={() => openMap(order)}>
              <Ionicons name="map" size={16} color="#fff" />
              <Text style={styles.mapButtonText}>Open in Google Maps</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Subscription Info */}
        {order.subscriptionAmountUsed && order.subscriptionAmountUsed > 0 && (
          <View style={styles.subscriptionInfo}>
            <Text style={styles.subscriptionTitle}>Subscription Used</Text>
            <Text style={styles.subscriptionAmount}>-₹{order.subscriptionAmountUsed}</Text>
            {order.subscriptionDaysDeducted && order.subscriptionDaysDeducted > 0 && (
              <Text style={styles.subscriptionDays}>-{order.subscriptionDaysDeducted} days</Text>
            )}
            {order.payableAfterSubscription && order.payableAfterSubscription > 0 && (
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
          {['confirmed', 'preparing', 'out_for_delivery'].includes(order.status) && (
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

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
            <TouchableOpacity style={styles.retryButton} onPress={fetchOrders}>
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
  stepDotActive: {
    backgroundColor: '#FF6B00',
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
});