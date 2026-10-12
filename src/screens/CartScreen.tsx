import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AppHeader } from '../components/common/AppHeader';
import { useCart } from '../context/CartContext';
import { getImageUrl } from '../config/api';
import api from '../services/api';

export function CartScreen() {
  const navigation = useNavigation();
  const { items: cartItems, totalItems, totalAmount, updateQuantity, removeFromCart } = useCart();
  const [gstSettings, setGstSettings] = useState<any>(null);
  const [platformConfig, setPlatformConfig] = useState<any>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const [gstRes, platRes] = await Promise.all([
        api.user.getGSTSettings(),
        api.user.getPlatformConfig(),
      ]);
      if (gstRes?.data) setGstSettings(gstRes.data);
      if (platRes?.data) setPlatformConfig(platRes.data);
    } catch (e) {
      console.log('Error fetching settings in CartScreen:', e);
    }
  };

  const foodGstEnabled = gstSettings?.foodGSTEnabled ?? false;
  const foodGstRate = foodGstEnabled
    ? ((Number(gstSettings?.foodCGSTRate) || 0) + (Number(gstSettings?.foodSGSTRate) || 0))
    : 0;

  const deliveryFee = platformConfig?.deliveryFee != null ? Number(platformConfig.deliveryFee) : 0;
  const platformFee = platformConfig?.platformFee != null ? Number(platformConfig.platformFee) : 0;
  const gst = foodGstEnabled ? Math.round(totalAmount * (foodGstRate / 100)) : 0;

  // Delivery & Platform fees are added to total when configured by admin, but hidden from the itemized UI breakdown list
  const total = totalAmount + deliveryFee + platformFee + gst;

  const handleQuantityChange = (id: string, change: number) => {
    const item = cartItems.find(item => item.id === id);
    if (item) {
      updateQuantity(id, item.quantity + change);
    }
  };

  const handleRemoveItem = (id: string) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeFromCart(id) }
      ]
    );
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to cart before checkout');
      return;
    }
    navigation.navigate('Checkout' as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showSearch={false} />
      
      <View style={styles.headerSection}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>My Cart</Text>
        <Text style={styles.itemCount}>{totalItems} items</Text>
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.emptyCart}>
          <Ionicons name="cart-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Add some delicious food to get started</Text>
          <TouchableOpacity style={styles.browseButton} onPress={() => navigation.navigate('Home' as never)}>
            <Text style={styles.browseButtonText}>Browse Food</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {cartItems.map(item => (
              <View key={item.id} style={styles.cartItem}>
                <Image 
                  source={{ uri: getImageUrl(item.image) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&fit=crop' }} 
                  style={styles.itemImage} 
                  contentFit="cover"
                />
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSeller}>{item.sellerName}</Text>
                  <View style={styles.priceContainer}>
                    {item.discountPrice ? (
                      <>
                        <Text style={styles.itemPrice}>₹{item.discountPrice}</Text>
                        <Text style={styles.originalPrice}>₹{item.price}</Text>
                      </>
                    ) : (
                      <Text style={styles.itemPrice}>₹{item.price}</Text>
                    )}
                  </View>
                  {item.isVeg !== undefined && (
                    <View style={[styles.vegBadge, item.isVeg ? styles.vegBadgeGreen : styles.vegBadgeRed]}>
                      <View style={[styles.vegDot, item.isVeg ? styles.vegDotGreen : styles.vegDotRed]} />
                    </View>
                  )}
                </View>
                <View style={styles.quantityControls}>
                  <TouchableOpacity 
                    style={styles.quantityButton} 
                    onPress={() => handleQuantityChange(item.id, -1)}
                  >
                    <Ionicons name="remove" size={16} color="#FF6B00" />
                  </TouchableOpacity>
                  <Text style={styles.quantity}>{item.quantity}</Text>
                  <TouchableOpacity 
                    style={styles.quantityButton} 
                    onPress={() => handleQuantityChange(item.id, 1)}
                  >
                    <Ionicons name="add" size={16} color="#FF6B00" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity 
                  style={styles.removeButton} 
                  onPress={() => handleRemoveItem(item.id)}
                >
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={styles.checkoutSection}>
            <View style={styles.billDetails}>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Subtotal</Text>
                <Text style={styles.billValue}>₹{totalAmount}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>GST ({foodGstRate}%)</Text>
                <Text style={styles.billValue}>₹{gst}</Text>
              </View>
              <View style={[styles.billRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₹{total}</Text>
              </View>
            </View>
            
            <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
              <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2E8',
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    flex: 1,
  },
  itemCount: {
    fontSize: 14,
    color: '#666',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 80,
  },
  itemImage: {
    width: 68,
    height: 68,
    borderRadius: 8,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  itemSeller: {
    fontSize: 11,
    color: '#888',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  vegBadge: {
    width: 16,
    height: 16,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  vegBadgeGreen: {
    borderColor: '#4CAF50',
  },
  vegBadgeRed: {
    borderColor: '#F44336',
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  vegDotGreen: {
    backgroundColor: '#4CAF50',
  },
  vegDotRed: {
    backgroundColor: '#F44336',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 4,
    marginRight: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2,
  },
  quantity: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    paddingHorizontal: 12,
  },
  removeButton: {
    padding: 8,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
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
  browseButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  checkoutSection: {
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  billDetails: {
    marginBottom: 20,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  billLabel: {
    fontSize: 14,
    color: '#666',
  },
  billValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  checkoutButton: {
    backgroundColor: '#FF6B00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  checkoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});