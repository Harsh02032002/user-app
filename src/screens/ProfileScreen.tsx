import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { getImageUrl } from '../services/api';
import { colors, fonts } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showArrow?: boolean;
  color?: string;
}

const MenuItem = ({ icon, title, subtitle, onPress, showArrow = true, color = colors.text }: MenuItemProps) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={[styles.menuIcon, { backgroundColor: color === '#FF3B30' ? '#FFE5E5' : colors.canvas }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <View style={styles.menuContent}>
      <Text style={[styles.menuTitle, { color }]}>{title}</Text>
      {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
    </View>
    {showArrow && <Ionicons name="chevron-forward" size={20} color="#ccc" />}
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const [avatarError, setAvatarError] = React.useState(false);

  React.useEffect(() => {
    setAvatarError(false);
  }, [user?.avatar, user?.profileImage]);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  const avatarUri = getImageUrl(user?.avatar || user?.profileImage);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {avatarUri && !avatarError ? (
            <Image 
              source={{ uri: avatarUri }} 
              style={styles.avatarImage}
              onError={() => setAvatarError(true)}
            />
          ) : (
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || 'User'}</Text>
          <Text style={styles.profilePhone}>{user?.phone || ''}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="pencil" size={18} color="#FF6B00" />
        </TouchableOpacity>
      </View>

      {/* Menu Sections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Orders & Subscriptions</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="receipt-outline"
            title="My Orders"
            subtitle="Track and view order history"
            onPress={() => navigation.navigate('Orders')}
          />
          <MenuItem
            icon="card-outline"
            title="My Subscriptions"
            subtitle="View your active subscriptions"
            onPress={() => navigation.navigate('Subscriptions')}
          />
          <MenuItem
            icon="wallet-outline"
            title="My Wallet"
            subtitle="Check balance and recharge"
            onPress={() => navigation.navigate('Wallet')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Account</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="heart-outline"
            title="My Wishlist"
            subtitle="View your saved items"
            onPress={() => navigation.navigate('Wishlist')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="location-outline"
            title="Saved Addresses"
            subtitle="Manage delivery addresses"
            onPress={() => navigation.navigate('Addresses')}
          />
          <MenuItem
            icon="card-outline"
            title="Payment Methods"
            subtitle="Manage your payment options"
            onPress={() => navigation.navigate('PaymentMethods')}
          />
          <MenuItem
            icon="notifications-outline"
            title="Notifications"
            subtitle="Manage notification preferences"
            onPress={() => navigation.navigate('Notifications')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="help-circle-outline"
            title="Help & Support"
            subtitle="FAQs and contact support"
            onPress={() => {}}
          />
          <MenuItem
            icon="document-text-outline"
            title="Terms & Conditions"
            onPress={() => {}}
          />
          <MenuItem
            icon="shield-outline"
            title="Privacy Policy"
            onPress={() => {}}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.menuCard}>
          <MenuItem
            icon="log-out-outline"
            title="Logout"
            onPress={handleLogout}
            showArrow={false}
            color="#FF3B30"
          />
        </View>
      </View>

      <Text style={styles.version}>Version 1.0.0</Text>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 20,
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: colors.surface,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  profilePhone: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2, fontFamily: fonts.regular,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 2, fontFamily: fonts.regular,
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textTertiary,
    marginLeft: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  menuCard: {
    backgroundColor: colors.surface,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
    marginLeft: 12,
  },
  menuTitle: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2, fontFamily: fonts.regular,
  },
  version: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 16, fontFamily: fonts.regular,
  },
});
