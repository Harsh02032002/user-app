import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { colors, fonts } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Wishlist'>;

interface WishlistItem {
  _id: string;
  name: string;
  price: number;
  image: string;
  sellerName: string;
}

export default function WishlistScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { token } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${API_URL}/wishlist`, {
      //   headers: { Authorization: `Bearer ${token}` },
      // });
      // const data = await response.json();
      
      // Mock data for now
      setItems([
        {
          _id: '1',
          name: 'Butter Chicken',
          price: 280,
          image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400',
          sellerName: 'Maa da Dhaba',
        },
        {
          _id: '2',
          name: 'Paneer Tikka',
          price: 220,
          image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400',
          sellerName: 'Home Kitchen',
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch wishlist');
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (itemId: string) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from your wishlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setItems(items.filter(item => item._id !== itemId));
          },
        },
      ]
    );
  };

  const moveToCart = (item: WishlistItem) => {
    Alert.alert('Success', `${item.name} added to cart`);
    // TODO: Implement cart functionality
  };

  const renderWishlistItem = ({ item }: { item: WishlistItem }) => (
    <View style={styles.itemCard}>
      <Image source={{ uri: item.image }} style={styles.itemImage} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.sellerName}>{item.sellerName}</Text>
        <Text style={styles.itemPrice}>₹{item.price}</Text>
        <View style={styles.itemActions}>
          <TouchableOpacity
            style={styles.moveToCartButton}
            onPress={() => moveToCart(item)}
          >
            <Text style={styles.moveToCartText}>Move to Cart</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeFromWishlist(item._id)}
          >
            <Ionicons name="heart-dislike" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Wishlist</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wishlist</Text>
        <View style={{ width: 40 }} />
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyText}>Your wishlist is empty</Text>
          <Text style={styles.emptySubtext}>
            Save items you love to buy them later
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => navigation.navigate('MainTabs')}
          >
            <Text style={styles.browseButtonText}>Browse Food</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderWishlistItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 20,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14, fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginTop: 8,
    textAlign: 'center',
  },
  browseButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  browseButtonText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#403126',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  sellerName: {
    fontSize: 13, fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.primary,
    marginTop: 8,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  moveToCartButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  moveToCartText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },
  removeButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.dangerSoft,
  },
});
