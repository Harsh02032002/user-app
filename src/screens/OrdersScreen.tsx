import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import api, { API_ENDPOINTS } from '../config/api';
import { RootStackParamList } from '../navigation/RootNavigator';
import { DeliveryMap } from '../components/common/DeliveryMap';
import { extractCoordinates } from '../utils/location';
import { colors, fonts } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Order {
  _id: string;
  orderNumber: string;
  sellerId: {
    name: string;
    businessName: string;
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
  grandTotal: number;
  subscriptionAmountUsed: number;
  onlineAmountPaid: number;
  status: string;
  paymentStatus: string;
  deliveryAddress: any;
  createdAt: string;
}

export default function OrdersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.MY_ORDERS);
      const ordersData = response.data.orders || response.data.data || [];
      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
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
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const activeOrders = orders.filter((o) =>
    ['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(o.status)
  );
  const pastOrders = orders.filter((o) => ['delivered', 'cancelled'].includes(o.status));

  const displayOrders = activeTab === 'active' ? activeOrders : pastOrders;

  const renderOrderItem = ({ item }: { item: Order }) => {
    const seller = item.sellerId;
    const sellerName = seller?.businessName || seller?.name || 'Seller';
    const sellerCoords = seller?.address?.location?.coordinates;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => navigation.navigate('OrderDetails', { orderId: item._id })}
      >
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
            <Text style={styles.sellerName}>{sellerName}</Text>
          </View>
          <View
            style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}
          >
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.itemsList}>
          {item.items.slice(0, 2).map((orderItem, index) => (
            <Text key={index} style={styles.itemText}>
              {orderItem.quantity}x {orderItem.name}
            </Text>
          ))}
          {item.items.length > 2 && (
            <Text style={styles.moreItems}>+{item.items.length - 2} more items</Text>
          )}
        </View>

        {/* Live Map for Active Orders */}
        {['confirmed', 'preparing', 'out_for_delivery'].includes(item.status) && (
          <View style={styles.mapPreviewContainer}>
            <Text style={styles.mapTitle}>
              <Ionicons name="location" size={12} color="#FF6B00" /> Live Tracking
            </Text>
            <DeliveryMap
              pickupCoords={
                sellerCoords ? [sellerCoords[0], sellerCoords[1]] : undefined
              }
              dropCoords={(() => {
                const coords = extractCoordinates(item.deliveryAddress);
                return coords ? [coords.longitude, coords.latitude] : undefined;
              })()}
              height={130}
            />
          </View>
        )}

      <View style={styles.orderFooter}>
        <View style={styles.paymentInfo}>
          <Text style={styles.totalAmount}>Rs. {item.grandTotal}</Text>
          {item.subscriptionAmountUsed > 0 && (
            <View style={styles.hybridBadge}>
              <Ionicons name="card" size={12} color="#FF6B00" />
              <Text style={styles.hybridText}>Rs. {item.subscriptionAmountUsed} from subscription</Text>
            </View>
          )}
        </View>
        <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active ({activeOrders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            Past ({pastOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      <FlatList
        data={displayOrders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={48} color="#ccc" />
            </View>
            <Text style={styles.emptyTitle}>No {activeTab} orders</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'active'
                ? 'Your active orders will appear here'
                : 'Your past orders will appear here'}
            </Text>
          </View>
        }
      />
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: colors.canvas,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textTertiary,
  },
  activeTabText: {
    color: colors.surface,
  },
  listContent: {
    padding: 20,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  sellerName: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 2, fontFamily: fonts.regular,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  itemsList: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4, fontFamily: fonts.regular,
  },
  moreItems: {
    fontSize: 13,
    color: colors.primary,
    marginTop: 4, fontFamily: fonts.regular,
  },
  mapPreviewContainer: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapTitle: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.primary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  paymentInfo: {},
  totalAmount: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  hybridBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  hybridText: {
    fontSize: 11,
    color: colors.primary,
    marginLeft: 4, fontFamily: fonts.regular,
  },
  orderDate: {
    fontSize: 12,
    color: colors.textTertiary, fontFamily: fonts.regular,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center', fontFamily: fonts.regular,
  },
});
}