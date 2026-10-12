import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { api } from '../../services/api';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  wallet: number;
  totalOrders: number;
  memberSince: string;
  avatar: string;
  bio?: string;
  address?: string;
}

// Menu items configuration
const getMenuItems = (user: UserProfile | null) => [
  {
    icon: 'person-outline',
    title: 'Settings',
    subtitle: 'Update your profile details',
    action: 'personal'
  },
  {
    icon: 'location-outline',
    title: 'Delivery Addresses',
    subtitle: 'Manage your delivery locations',
    action: 'addresses'
  },
  {
    icon: 'card-outline',
    title: 'Payment Methods',
    subtitle: 'Add or remove payment options',
    action: 'payment'
  },
  {
    icon: 'wallet-outline',
    title: 'My Wallet',
    subtitle: `Balance: ₹${user?.wallet || 0}`,
    action: 'wallet',
    badge: `₹${user?.wallet || 0}`
  },
  {
    icon: 'notifications-outline',
    title: 'Notifications',
    subtitle: 'Configure notification preferences',
    action: 'notifications',
    toggle: true
  },
  {
    icon: 'document-text-outline',
    title: 'Order History',
    subtitle: `Total orders: ${user?.totalOrders || 0}`,
    action: 'orders'
  },
  {
    icon: 'heart-outline',
    title: 'Wishlist',
    subtitle: 'View your saved items',
    action: 'wishlist'
  },
  {
    icon: 'help-circle-outline',
    title: 'Help & Support',
    subtitle: 'Get help with your orders',
    action: 'help'
  },
  {
    icon: 'document-outline',
    title: 'Terms & Privacy',
    subtitle: 'Read our policies',
    action: 'terms'
  },
  {
    icon: 'star-outline',
    title: 'Rate Us',
    subtitle: 'Share your feedback',
    action: 'rate'
  },
  {
    icon: 'log-out-outline',
    title: 'Logout',
    subtitle: 'Sign out of your account',
    action: 'logout',
    danger: true
  }
];

export function ProfileScreen() {
  const { user: authUser, logout } = useAuth();
  const navigation = useNavigation<any>();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      if (authUser) {
        try {
          const [walletRes, ordersRes] = await Promise.all([
            api.user.getWalletTransactions().catch(() => ({ data: { balance: 0 } })),
            api.user.getOrders().catch(() => ({ orders: [] }))
          ]);
          
          setUser({
            name: authUser.name || 'User',
            email: authUser.email || '',
            phone: authUser.phone || '',
            wallet: walletRes?.data?.balance || 0,
            totalOrders: (ordersRes?.orders || []).length,
            memberSince: (authUser as any).createdAt || '2024-01-01',
            avatar: authUser.profileImage || authUser.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
            bio: (authUser as any).bio || '',
            address: (authUser as any).address || ''
          });
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
      setLoading(false);
    };
    
    fetchUserData();
  }, [authUser]);

  const menuItems = getMenuItems(user);

  const handleMenuAction = (action: string) => {
    if (action === 'logout') {
      logout();
    } else if (action === 'personal') {
      navigation.navigate('Settings');
    }
  };

  const renderMenuItem = (item: any, index: number) => (
    <TouchableOpacity 
      key={index} 
      style={styles.menuItem}
      onPress={() => handleMenuAction(item.action)}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.iconContainer, item.danger && styles.dangerIcon]}>
          <Ionicons 
            name={item.icon as any} 
            size={20} 
            color={item.danger ? '#FF4444' : '#FF6B00'} 
          />
        </View>
        <View style={styles.menuItemContent}>
          <Text style={[styles.menuItemTitle, item.danger && styles.dangerText]}>
            {item.title}
          </Text>
          <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
        </View>
      </View>
      
      <View style={styles.menuItemRight}>
        {item.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        )}
        {item.toggle ? (
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#e5e5e5', true: '#FFB380' }}
            thumbColor={notificationsEnabled ? '#FF6B00' : '#fff'}
          />
        ) : (
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150' }} style={styles.avatar} />
            <TouchableOpacity style={styles.editAvatarButton}>
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{user?.name || 'Guest'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'No email'}</Text>
          <Text style={styles.userPhone}>{user?.phone || 'No phone'}</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.totalOrders || 0}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{user?.wallet || 0}</Text>
              <Text style={styles.statLabel}>Wallet</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.memberSince ? new Date(user.memberSince).getFullYear() : '2024'}</Text>
              <Text style={styles.statLabel}>Member</Text>
            </View>
          </View>
        </View>
        
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <Ionicons name="wallet-outline" size={24} color="#FF6B00" />
            <Text style={styles.quickActionText}>Add Money</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Ionicons name="gift-outline" size={24} color="#FF6B00" />
            <Text style={styles.quickActionText}>Rewards</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Ionicons name="people-outline" size={24} color="#FF6B00" />
            <Text style={styles.quickActionText}>Refer</Text>
          </TouchableOpacity>
        </View>
        
        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map(renderMenuItem)}
        </View>
        
        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Dabba Delights v1.0.0</Text>
          <Text style={styles.versionSubtext}>Made with ❤️ in India</Text>
        </View>
        
        <View style={{ height: 96 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2E8',
  },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  editButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
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
  profileHeader: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FF6B00',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B00',
    marginBottom: 4,
  },
  profileCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  profileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B00',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#f0f0f0',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: 24,
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B00',
    marginTop: 8,
  },
  menuSection: {
    marginHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dangerIcon: {
    backgroundColor: '#FFF5F5',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  dangerText: {
    color: '#FF4444',
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  versionSubtext: {
    fontSize: 10,
    color: '#ccc',
  },
});
