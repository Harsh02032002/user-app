import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components/common/AppHeader';
import { useCart } from '../context/CartContext';
import api, { API_ENDPOINTS } from '../config/api';
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
        api.get(`${API_ENDPOINTS.SELLER_DETAILS}/${sellerId}`),
        api.get(`${API_ENDPOINTS.SELLER_MENU}/${sellerId}`),
      ]);
      console.log('Seller data:', sellerRes.data.data);
      console.log('Menu data:', menuRes.data.data);
      setSeller(sellerRes.data.data);
      setMenu(menuRes.data.data || []);
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
      <AppHeader 
        showSearch={false} 
        sellerInfo={seller ? {
          name: seller.shopName || sellerName,
          type: seller.type || 'restaurant',
          image: seller.image,
          rating: seller.rating
        } : undefined}
      />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 }}
      >
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

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>Menu ({filteredMenu.length} items)</Text>
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
                    <Image source={{ uri: item.image }} style={styles.menuItemImage} />
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
                          alert('Button clicked: ' + item.name);
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
    backgroundColor: '#F5F2E8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  categoriesContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoriesContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    marginRight: 10,
  },
  categoryChipActive: {
    backgroundColor: '#FF6B00',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#fff',
  },
  menuSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemInfo: {
    flex: 1,
    flexDirection: 'row',
  },
  vegIndicator: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  menuItemDetails: {
    flex: 1,
    paddingRight: 12,
  },
  menuItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  menuItemDesc: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    marginBottom: 6,
  },
  menuItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  menuItemRight: {
    alignItems: 'center',
    width: 100,
  },
  menuItemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  addBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FF6B00',
    fontWeight: '600',
    fontSize: 14,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B00',
  },
  qtyBtn: {
    padding: 8,
  },
  qtyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B00',
    paddingHorizontal: 12,
  },
  unavailableText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  cartButton: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    backgroundColor: '#FF6B00',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  cartInfo: {},
  cartItems: {
    color: '#fff',
    fontSize: 12,
  },
  cartTotal: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cartAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartActionText: {
    color: '#fff',
    fontWeight: '600',
    marginRight: 4,
  },
});
