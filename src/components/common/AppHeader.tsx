import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { deleteAccountFlow } from '../../utils/accountDeletion';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LOCATION_LABEL, getReadableLocation, LOCATION_NAME_KEY } from '../../utils/location';
import { getImageUrl } from '../../config/api';
import { colors, elevation, radius, spacing, type } from '../../theme';
import { IconButton } from './index';

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
  const navigation = useNavigation<any>();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [location, setLocation] = useState(DEFAULT_LOCATION_LABEL);
  const [locating, setLocating] = useState(false);
  const fetchingLocation = React.useRef(false);

  const refreshLocation = React.useCallback(async (isMounted: () => boolean = () => true) => {
    if (fetchingLocation.current) return;
    fetchingLocation.current = true;
    setLocating(true);
    try {
      // Show the last saved location immediately; GPS may be slow, denied or unavailable
      const saved = await AsyncStorage.getItem(LOCATION_NAME_KEY);
      if (saved && isMounted()) setLocation(saved);
      const loc = await getReadableLocation();
      if (!isMounted()) return;
      if (loc && loc !== DEFAULT_LOCATION_LABEL) setLocation(loc);
      else setLocation(saved || 'Set your location');
    } finally {
      fetchingLocation.current = false;
      if (isMounted()) setLocating(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    refreshLocation(() => mounted);
    return () => { mounted = false; };
  }, [refreshLocation]);

  const avatar = user?.profileImage || user?.avatar;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {showBack ? (
          <IconButton icon="arrow-back" accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={{ marginLeft: -spacing.sm }} />
        ) : sellerInfo ? null : (
          <TouchableOpacity onPress={() => navigation.navigate('Landing')} activeOpacity={0.7} accessibilityLabel="Dabba Nation home">
            <Image source={require('../../../assets/images/logo.png')} style={styles.logo} contentFit="contain" />
          </TouchableOpacity>
        )}

        {sellerInfo ? (
          <View style={styles.sellerHeader}>
            {sellerInfo.image ? (
              <Image
                source={[{ uri: getImageUrl(sellerInfo.image) }, require('../../../assets/images/logo.png')]}
                style={styles.sellerImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.sellerImage, styles.sellerImagePlaceholder]}>
                <Ionicons name={sellerInfo.type === 'home_chef' ? 'home-outline' : 'restaurant-outline'} size={20} color={colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={type.subheading} numberOfLines={1}>{sellerInfo.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={type.caption} numberOfLines={1}>
                  {sellerInfo.type === 'home_chef' ? 'Home Chef' : 'Restaurant'}
                </Text>
                {sellerInfo.rating ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={type.caption}>·</Text>
                    <Ionicons name="star" size={11} color="#F59E0B" />
                    <Text style={type.caption}>{sellerInfo.rating}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ) : title ? (
          <Text style={[type.heading, styles.title]} numberOfLines={1} accessibilityRole="header">{title}</Text>
        ) : (
          <TouchableOpacity
            style={styles.location}
            onPress={() => refreshLocation()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Deliver to ${location}. Tap to refresh location`}
          >
            <Text style={type.overline}>Deliver to</Text>
            <View style={styles.locationValueRow}>
              <Ionicons name="location" size={14} color={colors.primary} />
              <Text style={styles.locationValue} numberOfLines={1}>{locating && location === DEFAULT_LOCATION_LABEL ? 'Detecting location…' : location}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.actions}>
          <IconButton icon="bag-handle-outline" accessibilityLabel={`Cart, ${totalItems} items`} badge={totalItems} onPress={() => navigation.navigate('Cart')} />
          <IconButton icon="notifications-outline" accessibilityLabel="Notifications" onPress={() => navigation.navigate('Notifications')} />
          {user ? (
            <TouchableOpacity onPress={() => setShowUserMenu(true)} accessibilityLabel="Account menu" style={styles.avatarButton}>
              {avatar ? (
                <Image source={{ uri: getImageUrl(avatar) }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>{(user.name || 'U').charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {showSearch ? (
        <TouchableOpacity
          style={styles.search}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.8}
          accessibilityRole="search"
          accessibilityLabel="Search for dishes, cuisines or restaurants"
        >
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <Text style={styles.searchPlaceholder} numberOfLines={1}>Search for dishes, cuisines or restaurants</Text>
        </TouchableOpacity>
      ) : null}

      <Modal visible={showUserMenu && !!user} transparent animationType="fade" onRequestClose={() => setShowUserMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowUserMenu(false)}>
          <View style={styles.menu}>
            <View style={styles.menuHeader}>
              <Text style={type.subheading} numberOfLines={1}>{user?.name || 'My account'}</Text>
              <Text style={type.caption} numberOfLines={1}>{user?.email}</Text>
            </View>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowUserMenu(false);
                navigation.navigate('MainTabs', { screen: 'Settings' });
              }}
            >
              <Ionicons name="person-outline" size={18} color={colors.text} />
              <Text style={type.body}>Account & Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowUserMenu(false);
                navigation.navigate('MainTabs', { screen: 'Orders' });
              }}
            >
              <Ionicons name="receipt-outline" size={18} color={colors.text} />
              <Text style={type.body}>My Orders</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowUserMenu(false);
                navigation.navigate('StaticPage', { type: 'privacy' });
              }}
            >
              <Ionicons name="document-text-outline" size={18} color={colors.text} />
              <Text style={type.body}>Privacy & Terms</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowUserMenu(false);
                logout();
              }}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              <Text style={[type.body, { color: colors.danger }]}>Log out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowUserMenu(false);
                deleteAccountFlow(logout);
              }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={[type.body, { color: colors.danger }]}>Delete account</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  topRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
  },
  logo: { width: 40, height: 40 },
  title: { flex: 1 },
  location: { flex: 1 },
  locationValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  locationValue: { ...type.subheading, flexShrink: 1 },
  sellerHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sellerImage: { width: 40, height: 40, borderRadius: 20 },
  sellerImagePlaceholder: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', marginRight: -spacing.xs },
  avatarButton: { marginLeft: spacing.xs },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholder: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { ...type.label, color: colors.primary },
  search: {
    height: 44,
    marginHorizontal: spacing.screen,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchPlaceholder: { ...type.small, color: colors.textTertiary, flex: 1 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(17,17,17,0.15)' },
  menu: {
    position: 'absolute',
    top: 64,
    right: spacing.screen,
    minWidth: 240,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    ...elevation.raised,
  },
  menuHeader: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, height: 48 },
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.xs },
});
