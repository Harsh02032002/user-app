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
import { colors, fonts, radius, spacing, surfaces } from '../theme';

export function CartScreen() {
  const navigation = useNavigation<any>();
  const { items: cartItems, totalItems, totalAmount, updateQuantity, removeFromCart, clearCart } = useCart();
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
    const item = cartItems.find(i => String(i.id || (i as any)._id || i.name) === String(id));
    if (item) {
      updateQuantity(String(id), item.quantity + change);
    }
  };

  const handleRemoveItem = (id: string) => {
    removeFromCart(String(id));
  };

  const handleBrowseFood = () => {
    try {
      navigation.navigate('MainTabs', { screen: 'Home' });
    } catch (_) {
      navigation.navigate('Home');
    }
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
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>My Cart</Text>
        <Text style={styles.itemCount}>{totalItems} {totalItems === 1 ? "item" : "items"}</Text>
        {cartItems.length > 0 && (
          <TouchableOpacity onPress={() => clearCart()} style={{ marginLeft: 8, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: colors.dangerSoft, borderRadius: 6 }}>
            <Text style={{ fontSize: 12, fontFamily: fonts.semiBold, color: colors.danger }}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.emptyCart}>
          <Ionicons name="cart-outline" size={80} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Add some delicious food to get started</Text>
          <TouchableOpacity style={styles.browseButton} onPress={handleBrowseFood}>
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
            {cartItems.map((item, idx) => {
              const itemId = String(item.id || (item as any)._id || (item as any).menuItemId || item.name || idx);
              return (
              <View key={itemId} style={styles.cartItem}>
                <Image 
                  source={{ uri: getImageUrl(item.image) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&fit=crop' }} 
                  style={styles.itemImage} 
                  contentFit="cover"
                />
                <View style={styles.itemDetails}>
                  <View style={styles.itemTopRow}>
                    {item.isVeg !== undefined && (
                      <View style={[styles.vegBadge, item.isVeg ? styles.vegBadgeGreen : styles.vegBadgeRed]}>
                        <View style={[styles.vegDot, item.isVeg ? styles.vegDotGreen : styles.vegDotRed]} />
                      </View>
                    )}
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    <TouchableOpacity 
                      style={styles.removeButton} 
                      onPress={() => handleRemoveItem(itemId)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityLabel={`Remove ${item.name}`}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  {item.sellerName ? <Text style={styles.itemSeller} numberOfLines={1}>{item.sellerName}</Text> : null}
                  <View style={styles.itemBottomRow}>
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
                    <View style={styles.quantityControls}>
                      <TouchableOpacity 
                        style={styles.quantityButton} 
                        onPress={() => handleQuantityChange(itemId, -1)}
                      >
                        <Ionicons name="remove" size={16} color={colors.primary} />
                      </TouchableOpacity>
                      <Text style={styles.quantity}>{item.quantity}</Text>
                      <TouchableOpacity 
                        style={styles.quantityButton} 
                        onPress={() => handleQuantityChange(itemId, 1)}
                      >
                        <Ionicons name="add" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
            })}
          </ScrollView>

          <View style={styles.checkoutSection}>
            <View style={styles.billDetails}>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Subtotal</Text>
                <Text style={styles.billValue}>₹{totalAmount}</Text>
              </View>
              
              <View style={[styles.billRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₹{total}</Text>
              </View>
            </View>
            
            <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
              <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.white} />
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
    backgroundColor: colors.canvas,
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
    fontFamily: fonts.displayBold,
    color: colors.text,
    flex: 1,
  },
  itemCount: {
    fontSize: 14, fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  cartItem: {
    ...surfaces.card,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  itemImage: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  itemDetails: {
    flex: 1,
    marginLeft: spacing.md,
    minHeight: 76,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: spacing.sm,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  itemSeller: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  originalPrice: {
    fontSize: 14, fontFamily: fonts.regular,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  vegBadge: {
    width: 14,
    height: 14,
    marginTop: 3,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  vegBadgeGreen: {
    borderColor: colors.success,
  },
  vegBadgeRed: {
    borderColor: colors.danger,
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  vegDotGreen: {
    backgroundColor: colors.success,
  },
  vegDotRed: {
    backgroundColor: colors.danger,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.surfaceRaised,
    height: 34,
  },
  quantityButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantity: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  removeButton: {
    padding: 2,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.displayBold,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14, fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  browseButtonText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  checkoutSection: {
    backgroundColor: colors.surface,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#403126',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 14, fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  billValue: {
    fontSize: 14,
    color: colors.text,
    fontFamily: fonts.medium,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  checkoutButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  checkoutButtonText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
});