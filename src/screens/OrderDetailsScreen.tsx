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
import api from '../services/api';
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

export default function OrderDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { orderId } = route.params;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [riderCoords, setRiderCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [riderInfo, setRiderInfo] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
    getCurrentLocation();
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    trackOrder(
      orderId as string,
      (loc: any) => {
        if (loc?.lat && loc?.lng) {
          setRiderCoords({ lat: loc.lat, lng: loc.lng });
        }
      },
      (statusData: any) => {
        if (statusData?.status) {
          setOrder((prev: any) => prev ? { ...prev, status: statusData.status } : prev);
        }
      }
    );
    return () => {
      untrackOrder(orderId as string);
    };
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const [orderRes, trackRes] = await Promise.allSettled([
        api.user.getOrderById(orderId as string),
        api.user.getOrderTracking(orderId as string),
      ]);
      if (orderRes.status === 'fulfilled') {
        const d = orderRes.value?.data || orderRes.value;
        setOrder(d);
      }
      if (trackRes.status === 'fulfilled') {
        const t = trackRes.value?.order || trackRes.value;
        if (t?.riderLocation) setRiderCoords(t.riderLocation);
        if (t?.riderInfo) setRiderInfo(t.riderInfo);
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
        return '#22C55E';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#888';
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
  const mapRegion = deliveryCoordinates || userLocation;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View
            style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}
          >
            <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
              {getStatusText(order.status)}
            </Text>
          </View>
          <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
          <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
        </View>

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
            <TouchableOpacity style={styles.callBtn}>
              <Ionicons name="call" size={20} color="#FF6B00" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items Ordered</Text>
          <View style={styles.itemsCard}>
            {order.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQty}>x{item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>Rs. {item.price * item.quantity}</Text>
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
              <Text style={styles.billValue}>Rs. {order.totalAmount}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Charges</Text>
              <Text style={styles.billValue}>Rs. {order.deliveryCharges}</Text>
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
              <Text style={styles.totalLabel}>Total Paid</Text>
              <Text style={styles.totalValue}>Rs. {order.onlineAmountPaid}</Text>
            </View>

            <View style={styles.paymentMethod}>
              <Ionicons name="card" size={16} color="#888" />
              <Text style={styles.paymentMethodText}>
                {order.paymentMethod === 'subscription'
                  ? 'Paid via Subscription Balance'
                  : order.paymentMethod === 'hybrid'
                  ? 'Hybrid Payment (Subscription + Online)'
                  : 'Online Payment'}
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
                {order.deliveryAddress?.address}, {order.deliveryAddress?.area}
              </Text>
              <Text style={styles.addressCity}>
                {order.deliveryAddress?.city} - {order.deliveryAddress?.pincode}
              </Text>
            </View>
          </View>
        </View>

        {/* Map & Live Delivery Tracking */}
        {mapRegion && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Live Delivery Tracking</Text>
            <View style={styles.mapContainer}>
              <DeliveryMap
                pickupCoords={
                  order.sellerId?.address?.location?.coordinates 
                    ? [order.sellerId.address.location.coordinates[0], order.sellerId.address.location.coordinates[1]] 
                    : undefined
                }
                dropCoords={(() => {
                  const coords = extractCoordinates(order.deliveryAddress);
                  return coords ? [coords.longitude, coords.latitude] : undefined;
                })()}
                riderCoords={riderCoords}
                restaurantName={order.sellerId?.shopName || order.sellerId?.businessName || 'Restaurant'}
                height={250}
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
                  <Text style={{ fontSize: 20 }}>🛵</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#166534' }}>
                    {riderInfo.name || 'Delivery Partner'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#15803D', marginTop: 1 }}>
                    {riderInfo.vehicleType ? String(riderInfo.vehicleType).toUpperCase() : 'BIKE'}
                    {riderInfo.vehicleNumber ? ` • ${riderInfo.vehicleNumber}` : ''}
                    {' '}| ⭐ {riderInfo.rating || '5.0'}
                  </Text>
                </View>
                {riderInfo.phone ? (
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#16A34A',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 16,
    color: '#888',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statusCard: {
    backgroundColor: '#fff',
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
    fontWeight: 'bold',
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 14,
    color: '#888',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  sellerPhone: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemsCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  itemQty: {
    fontSize: 13,
    color: '#888',
    marginLeft: 8,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  billCard: {
    backgroundColor: '#f9f9f9',
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
    color: '#666',
  },
  billValue: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  subscriptionRow: {
    backgroundColor: '#FFF5F0',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  subscriptionLabel: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '500',
  },
  daysDeducted: {
    fontSize: 12,
    color: '#FF6B00',
    marginTop: 2,
  },
  subscriptionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B00',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  paymentMethodText: {
    fontSize: 12,
    color: '#888',
    marginLeft: 6,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
  },
  addressInfo: {
    flex: 1,
    marginLeft: 12,
  },
  addressText: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
  },
  addressCity: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  map: {
    flex: 1,
  },
  webMapWrapper: {
    flex: 1,
    backgroundColor: '#fff',
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
    fontWeight: '600',
    color: '#FF6B00',
  },
  mapHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    lineHeight: 18,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  mapFallbackText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
});
