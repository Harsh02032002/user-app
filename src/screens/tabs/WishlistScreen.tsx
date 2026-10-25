import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import { colors, fonts } from '../../theme';

// Wishlist item type
interface WishlistItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  sellerName: string;
  sellerType: 'home_chef' | 'restaurant';
  rating: number;
  addedDate: string;
}

export function WishlistScreen() {
  const navigation = useNavigation<any>();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch wishlist from API
  useEffect(() => {
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.user.getWishlist();
      // Normalize response - extract items array
      const itemsData = Array.isArray(response) ? response : response.items || response.data || response.products || [];
      setWishlistItems(itemsData);
    } catch (err: any) {
      console.error('Error fetching wishlist:', err);
      setError(err.message || 'Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  const renderWishlistItem = ({ item }: { item: WishlistItem }) => (
    <TouchableOpacity style={styles.wishlistItem}>
      <Image source={{ uri: item.image }} style={styles.itemImage} />
      
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{item.name}</Text>
          <TouchableOpacity style={styles.removeButton}>
            <Ionicons name="heart" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.itemDescription} numberOfLines={2}>
          {item.description}
        </Text>
        
        <View style={styles.sellerInfo}>
          <View style={styles.sellerTypeContainer}>
            <Text style={styles.sellerType}>
              {item.sellerType === 'home_chef' ? 'Home Chef' : 'Restaurant'}
            </Text>
          </View>
          <Text style={styles.sellerName}>{item.sellerName}</Text>
        </View>
        
        <View style={styles.itemFooter}>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>₹{item.price}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={12} color={colors.warning} />
              <Text style={styles.rating}>{item.rating}</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.addToCartButton}>
            <Ionicons name="cart-outline" size={16} color={colors.white} />
            <Text style={styles.addToCartText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Wishlist</Text>
        <TouchableOpacity style={styles.clearAllButton}>
          <Text style={styles.clearAllText}>Clear All</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading wishlist...</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={64} color={colors.danger} />
            <Text style={styles.emptyTitle}>Error loading wishlist</Text>
            <Text style={styles.emptySubtitle}>{error}</Text>
            <TouchableOpacity style={styles.browseButton} onPress={fetchWishlist}>
              <Text style={styles.browseButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : wishlistItems.length > 0 ? (
          <>
            <View style={styles.wishlistInfo}>
              <Ionicons name="heart" size={20} color={colors.primary} />
              <Text style={styles.wishlistCount}>
                You have {wishlistItems.length} items in your wishlist
              </Text>
            </View>
            
            {wishlistItems.map((item) => (
              <View key={item._id}>
                {renderWishlistItem({ item })}
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
            <Text style={styles.emptySubtitle}>
              Save your favorite dishes and order them later
            </Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => {
                try {
                  navigation.navigate('MainTabs', { screen: 'Home' });
                } catch (_) {
                  navigation.navigate('Home');
                }
              }}
            >
              <Text style={styles.browseButtonText}>Browse Menu</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: fonts.displayBold,
    color: colors.text,
  },
  clearAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearAllText: {
    fontSize: 14,
    color: colors.danger,
    fontFamily: fonts.semiBold,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16, fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  wishlistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  wishlistCount: {
    fontSize: 14, fontFamily: fonts.regular,
    color: colors.primary,
    marginLeft: 8,
  },
  wishlistItem: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#403126',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  itemDescription: {
    fontSize: 12, fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sellerTypeContainer: {
    backgroundColor: colors.inputFill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  sellerType: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
  },
  sellerName: {
    fontSize: 12, fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.primary,
    marginRight: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 12, fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addToCartText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.white,
    marginLeft: 4,
  },
  suggestionsContainer: {
    marginTop: 24,
  },
  suggestionsTitle: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
    color: colors.text,
    marginBottom: 16,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  suggestionItem: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    shadowColor: '#403126',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  suggestionImage: {
    width: '100%',
    height: 80,
    borderRadius: 6,
    marginBottom: 8,
  },
  suggestionName: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.text,
    marginBottom: 4,
  },
  suggestionPrice: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  wishlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#403126',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
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
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
});
