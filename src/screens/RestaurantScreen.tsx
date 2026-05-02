import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { AppHeader } from '../components/common/AppHeader';
import { useCart } from '../context/CartContext';
import { api } from '../services/api';
import { getImageUrl } from '../config/api';
import { RootStackParamList } from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'Restaurant'>;

interface MenuItem {
  _id: string;
  name: string;
  description?: string;
  price: number;
  sellingPrice?: number;
  image?: string;
  category?: string;
  isVeg: boolean;
  isAvailable?: boolean;
  sellerId?: {
    _id: string;
    businessName: string;
    type: 'home_chef' | 'restaurant';
    rating: number;
  };
}

interface SellerDetails {
  _id: string;
  name: string;
  shopName: string;
  image?: string;
  rating: number;
  cuisine?: string;
  type: 'home_chef' | 'restaurant';
  address?: {
    area?: string;
    city?: string;
  };
}

export default function RestaurantScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { sellerId, sellerName } = route.params;
  const { items, totalItems, totalAmount, addToCart, updateQuantity } = useCart();

  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<SellerDetails | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    console.log('RestaurantScreen mounted with sellerId:', sellerId);
    fetchData();
  }, [sellerId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Fetching data for seller:', sellerId);
      const [sellerRes, menuRes] = await Promise.all([
        api.user.getSellerById(sellerId),
        api.user.getMenuItems(sellerId),
      ]);
      console.log('Seller data:', sellerRes);
      console.log('Menu data:', menuRes);
      
      const sellerData = sellerRes.seller || sellerRes;
      const menuItems = Array.isArray(menuRes) ? menuRes : menuRes.products || menuRes.data || menuRes.menu || [];
      
      setSeller(sellerData);
      setMenu(menuItems);
    } catch (error) {
      console.error('Error fetching restaurant data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategories = () => {
    const categories = ['All', ...new Set(menu.map((item) => item.category || 'Other'))];
    return categories;
  };

  const filteredMenu =
    selectedCategory === 'All'
      ? menu
      : menu.filter((item) => item.category === selectedCategory);

  const getItemQuantity = (itemId: string) => {
    const cartItem = items.find((item) => item.id === itemId);
    return cartItem?.quantity || 0;
  };

  const handleAddToCart = (item: MenuItem) => {
    console.log('Adding to cart:', item._id, item.name);
    const cartItem = {
      id: item._id,
      name: item.name,
      price: item.sellingPrice || item.price,
      image: item.image || '',
      sellerId: typeof item.sellerId === 'object' ? item.sellerId._id : sellerId,
      sellerName: typeof item.sellerId === 'object' ? item.sellerId.businessName : sellerName,
      isVeg: item.isVeg,
      description: item.description,
    };
    console.log('Cart item:', cartItem);
    addToCart(cartItem);
    Toast.show({
      type: 'success',
      text1: 'Added to Cart',
      text2: `${item.name} added successfully!`,
      position: 'bottom',
    });
    console.log('Cart items after add:', items);
  };

  const handleUpdateQuantity = (itemId: string, change: number) => {
    const currentQty = getItemQuantity(itemId);
    updateQuantity(itemId, currentQty + change);
  };

  if (loading && !seller) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header - Transparent overlay on banner */}
      <View style={styles.headerOverlay}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Banner Section */}
        <View style={styles.bannerContainer}>
          <Image 
            source={{ uri: getImageUrl(seller?.image) || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1000&h=400&fit=crop&q=80' }} 
            style={styles.bannerImage} 
            contentFit="cover"
          />
          <View style={styles.bannerGradient} />
        </View>

        {/* Info Section - Overlapping Banner */}
        <View style={styles.infoSection}>
          <View style={styles.profileRow}>
            <View style={styles.logoWrapper}>
              <Image 
                source={{ uri: getImageUrl(seller?.logo || seller?.image) || 'https://images.unsplash.com/photo-1495195129352-aec325b55b65?w=200&h=200&fit=crop&q=80' }} 
                style={styles.profileLogo} 
                contentFit="cover"
              />
            </View>
            <View style={styles.nameBadgeContainer}>
              <Text style={styles.businessName}>{seller?.shopName || seller?.businessName || sellerName}</Text>
              <View style={[styles.typeBadge, seller?.type === 'home_chef' ? styles.homeChefBadge : styles.restaurantBadge]}>
                <Ionicons 
                  name={seller?.type === 'home_chef' ? 'home' : 'restaurant'} 
                  size={14} 
                  color={seller?.type === 'home_chef' ? '#059669' : '#C2410C'} 
                />
                <Text style={[styles.typeBadgeText, seller?.type === 'home_chef' ? styles.typeBadgeTextHome : styles.typeBadgeTextRest]}>
                  {seller?.type === 'home_chef' ? 'Home-Cooked' : 'Restaurant'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.ratingBox}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingValue}>{seller?.rating?.toFixed(1) || '4.0'}</Text>
            </View>
            <View style={styles.locationBox}>
              <Ionicons name="location" size={14} color="#666" />
              <Text style={styles.locationValue}>
                {seller?.address?.city || 'Chandigarh'}
              </Text>
            </View>
          </View>
        </View>
        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
        >
          {getCategories().map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category && styles.categoryTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Menu Title */}
        <View style={styles.menuHeader}>
          <Text style={styles.menuTitle}>Menu</Text>
          <View style={styles.menuUnderline} />
        </View>
        <View style={styles.menuSection}>
          {filteredMenu.length === 0 ? (
            <Text style={styles.emptyText}>No menu items available</Text>
          ) : (
            filteredMenu.map((item) => {
            const qty = getItemQuantity(item._id);
            return (
              <View key={item._id} style={styles.menuItem}>
                <View style={styles.menuItemInfo}>
                  <View style={styles.vegIndicator}>
                    <View
                      style={[
                        styles.vegDot,
                        { backgroundColor: item.isVeg ? '#22C55E' : '#EF4444' },
                      ]}
                    />
                  </View>
                  <View style={styles.menuItemDetails}>
                    <Text style={styles.menuItemName}>{item.name}</Text>
                    {item.description && (
                      <Text style={styles.menuItemDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    )}
                    <Text style={styles.menuItemPrice}>Rs. {item.sellingPrice || item.price}</Text>
                  </View>
                </View>
                <View style={styles.menuItemRight}>
                  {item.image && (
                    <Image 
                      source={{ uri: getImageUrl(item.image) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&fit=crop' }} 
                      style={styles.menuItemImage} 
                      contentFit="cover"
                    />
                  )}
                  {item.isAvailable !== false ? (
                    qty > 0 ? (
                      <View style={styles.qtyControl}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => handleUpdateQuantity(item._id, -1)}
                        >
                          <Ionicons name="remove" size={18} color="#FF6B00" />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{qty}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => handleUpdateQuantity(item._id, 1)}
                        >
                          <Ionicons name="add" size={18} color="#FF6B00" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => {
                          console.log('ADD button clicked for:', item.name);
                          handleAddToCart(item);
                        }}
                      >
                        <Text style={styles.addBtnText}>ADD</Text>
                      </TouchableOpacity>
                    )
                  ) : (
                    <Text style={styles.unavailableText}>Unavailable</Text>
                  )}
                </View>
              </View>
            );
          }))
          }
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Cart Button */}
      {totalItems > 0 && (
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => navigation.navigate('Checkout')}
        >
          <View style={styles.cartInfo}>
            <Text style={styles.cartItems}>{totalItems} Items</Text>
            <Text style={styles.cartTotal}>Rs. {totalAmount}</Text>
          </View>
          <View style={styles.cartAction}>
            <Text style={styles.cartActionText}>View Cart</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF8F0',
  },
  headerOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#ddd',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  infoSection: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    marginTop: -30,
    marginBottom: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  logoWrapper: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  profileLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  nameBadgeContainer: {
    marginLeft: 15,
    paddingBottom: 5,
    flex: 1,
  },
  businessName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
  },
  homeChefBadge: {
    backgroundColor: '#ECFDF5', // Emerald-50
    borderColor: '#D1FAE5', // Emerald-100
  },
  restaurantBadge: {
    backgroundColor: '#FFF7ED', // Orange-50
    borderColor: '#FFEDD5', // Orange-100
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typeBadgeTextHome: {
    color: '#059669', // Emerald-600
  },
  typeBadgeTextRest: {
    color: '#C2410C', // Orange-700
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 15,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationValue: {
    fontSize: 14,
    color: '#666',
  },
  categoriesContainer: {
    marginBottom: 15,
  },
  categoriesContent: {
    paddingHorizontal: 20,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  categoryChipActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  menuHeader: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  menuUnderline: {
    width: 40,
    height: 3,
    backgroundColor: '#FF6B00',
    marginTop: 4,
    borderRadius: 2,
  },
  menuSection: {
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  menuItemInfo: {
    flex: 1,
  },
  vegIndicator: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  menuItemDetails: {},
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  menuItemDesc: {
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
    marginBottom: 10,
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  menuItemRight: {
    alignItems: 'center',
    width: 100,
    marginLeft: 10,
  },
  menuItemImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    marginBottom: -15,
    zIndex: 1,
  },
  addBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF6B00',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 5,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addBtnText: {
    color: '#FF6B00',
    fontWeight: '700',
    fontSize: 12,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B00',
    marginTop: 5,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qtyBtn: {
    padding: 6,
  },
  qtyText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B00',
    paddingHorizontal: 8,
  },
  unavailableText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
    marginTop: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
  },
  cartButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#FF6B00',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  cartInfo: {},
  cartItems: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  cartTotal: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cartAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cartActionText: {
    color: '#fff',
    fontWeight: '700',
    marginRight: 4,
  },
});
