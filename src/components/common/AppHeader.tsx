import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useNavigation } from '@react-navigation/native';
import { DEFAULT_LOCATION_LABEL, getReadableLocation } from '../../utils/location';
import { getImageUrl } from '../../config/api';

interface AppHeaderProps {
  showSearch?: boolean;
  showBack?: boolean;
  sellerInfo?: {
    name: string;
    type: 'home_chef' | 'restaurant';
    image?: string;
    rating?: number;
  };
  title?: string;
}

export const AppHeader = React.memo(function AppHeader({ showSearch = true, showBack = false, sellerInfo, title }: AppHeaderProps) {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const navigation = useNavigation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState(DEFAULT_LOCATION_LABEL);
  const fetchingLocation = React.useRef(false);

  useEffect(() => {
    let isMounted = true;
    const fetch = async () => {
      if (fetchingLocation.current) return;
      fetchingLocation.current = true;
      try {
        const loc = await getReadableLocation();
        if (isMounted) setLocation(loc);
      } finally {
        fetchingLocation.current = false;
      }
    };
    fetch();
    return () => { isMounted = false; };
  }, []);

  const handleRefreshLocation = async () => {
    if (fetchingLocation.current) return;
    fetchingLocation.current = true;
    try {
      const loc = await getReadableLocation();
      setLocation(loc);
    } finally {
      fetchingLocation.current = false;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {showBack && (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
        )}
        <View style={styles.logoContainer}>
          {sellerInfo ? (
            // Seller/Restaurant Header
            <View style={styles.sellerHeader}>
              {sellerInfo.image ? (
                <Image 
                  source={[
                    { uri: getImageUrl(sellerInfo.image) },
                    require('../../../assets/images/logo.png')
                  ]} 
                  style={styles.sellerImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.sellerImagePlaceholder}>
                  <Ionicons 
                    name={sellerInfo.type === 'home_chef' ? 'home' : 'restaurant'} 
                    size={24} 
                    color="#FF6B00" 
                  />
                </View>
              )}
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>{sellerInfo.name}</Text>
                <View style={styles.sellerMeta}>
                  <Text style={styles.sellerType}>
                    {sellerInfo.type === 'home_chef' ? '🏠 Home Chef' : '🍽️ Restaurant'}
                  </Text>
                  {sellerInfo.rating && (
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={12} color="#FFD700" />
                      <Text style={styles.ratingText}>{sellerInfo.rating}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ) : (
            // Main App Logo
            <TouchableOpacity 
              style={styles.mainLogoContainer}
              onPress={() => navigation.navigate('Landing' as never)}
              activeOpacity={0.7}
            >
              <Image 
                source={require('../../../assets/images/logo.png')} 
                style={styles.logoImage}
                contentFit="cover"
              />
            </TouchableOpacity>
          )}
        </View>
        
        {title && !sellerInfo && (
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          </View>
        )}

        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => navigation.navigate('Search' as never)}
          >
            <Ionicons name="search-outline" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Cart' as never)}>
            <Ionicons name="cart-outline" size={24} color="#1a1a1a" />
            {totalItems > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalItems}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => navigation.navigate('Notifications' as never)}
          >
            <Ionicons name="notifications-outline" size={24} color="#1a1a1a" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
          
          {/* User Profile Dropdown */}
          {user ? (
            <TouchableOpacity style={styles.userProfile} onPress={() => setShowUserMenu(!showUserMenu)}>
              {user.profileImage ? (
                <Image 
                  source={{ uri: getImageUrl(user.profileImage) }} 
                  style={styles.userAvatar}
                />
              ) : (
                <View style={styles.userAvatarPlaceholder}>
                  <Ionicons name="person" size={20} color="#666" />
                </View>
              )}
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.loginButton}>
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for dishes, cuisines, or restaurants..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
        </View>
      )}

      {/* Location Button */}
      <TouchableOpacity style={styles.locationButton} onPress={handleRefreshLocation}>
        <Ionicons name="location" size={18} color="#FF6B00" />
        <View style={styles.locationContent}>
          <Text style={styles.locationLabel}>Deliver to</Text>
          <Text style={styles.locationValue}>{location}</Text>
        </View>
        <Ionicons name="refresh" size={16} color="#999" />
      </TouchableOpacity>

      {/* User Dropdown Menu */}
      <Modal
        visible={showUserMenu && !!user}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowUserMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowUserMenu(false)}
        >
          <View style={styles.userDropdown}>
            <View style={styles.userDropdownHeader}>
              <Text style={styles.dropdownUserEmail}>{user?.email || 'user@example.com'}</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.dropdownMenuItem} 
              onPress={() => {
                setShowUserMenu(false);
                navigation.navigate('MainTabs', { screen: 'Settings' });
              }}
            >
              <Ionicons name="person-outline" size={18} color="#1a1a1a" />
              <Text style={styles.dropdownMenuText}>Profile Settings</Text>
            </TouchableOpacity>

            <View style={styles.dropdownDivider} />
            
            <TouchableOpacity style={styles.dropdownMenuItem} onPress={() => {
              setShowUserMenu(false);
              logout();
            }}>
              <Ionicons name="log-out-outline" size={18} color="#DC2626" />
              <Text style={[styles.dropdownMenuText, { color: '#DC2626' }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  logoContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    elevation: 6,
  },
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sellerImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FF6B00',
  },
  sellerImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 107, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B00',
  },
  sellerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  sellerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  sellerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sellerType: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF6B00',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  notificationDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4444',
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  userAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  locationContent: {
    flex: 1,
    marginLeft: 10,
  },
  locationLabel: {
    fontSize: 10,
    color: '#999',
    fontWeight: '600',
  },
  locationValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  userDropdown: {
    position: 'absolute',
    top: 80,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 0,
    minWidth: 240,
    elevation: 12,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  userDropdownHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  dropdownAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDropdownInfo: {
    flex: 1,
  },
  dropdownUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  dropdownUserEmail: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 0,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  dropdownMenuText: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
});
