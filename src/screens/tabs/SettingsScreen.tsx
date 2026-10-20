import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { getImageUrl } from '../../config/api';
import { TAB_BAR_HEIGHT } from '../../components/common/MobileNavBar';
import { colors, fonts, formatPrice, radius, spacing, type } from '../../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Published Dabba Nation support contacts (same as the Contact page)
const SUPPORT_PHONE = '+917303023539';
const SUPPORT_EMAIL = 'support@dabbanation.com';

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [activePlans, setActivePlans] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.user.getWalletTransactions()
        .then((res: any) => setWalletBalance(Number(res?.data?.balance ?? res?.balance ?? 0) || 0))
        .catch(() => setWalletBalance(null));
      api.user.getActiveSubscription()
        .then((res: any) => setActivePlans((res?.subscriptions || []).filter((s: any) => s.status === 'active').length))
        .catch(() => setActivePlans(null));
    }, []),
  );

  const confirmLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Log out of Dabba Nation?')) logout();
      return;
    }
    Alert.alert('Log out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const avatar = (user as any)?.avatar || (user as any)?.profileImage;
  const initials = String(user?.name || 'D').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const version = Constants.expoConfig?.version || '1.0.0';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + spacing.xxxl }]} showsVerticalScrollIndicator={false}>
        <Text style={type.display}>Account</Text>

        <TouchableOpacity style={styles.profile} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Edit profile">
          {avatar ? (
            <Image source={{ uri: getImageUrl(avatar) }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>{user?.name || 'Your profile'}</Text>
            <Text style={type.caption} numberOfLines={1}>{[user?.phone, user?.email].filter(Boolean).join(' · ')}</Text>
            <Text style={styles.editLink}>Edit profile</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        <View style={styles.tiles}>
          <Tile
            icon="wallet-outline"
            label="Wallet"
            value={walletBalance != null ? formatPrice(walletBalance) : '—'}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Wallet' })}
          />
          <Tile icon="receipt-outline" label="Orders" value="History" onPress={() => navigation.navigate('MainTabs', { screen: 'Orders' })} />
          <Tile
            icon="calendar-outline"
            label="Tiffin plans"
            value={activePlans ? `${activePlans} active` : 'Explore'}
            onPress={() => navigation.navigate('MainTabs', { screen: 'MyPlans' })}
          />
        </View>

        <Group title="Your stuff">
          <Row icon="location-outline" title="Saved addresses" onPress={() => navigation.navigate('Addresses')} />
          <Row icon="card-outline" title="Payment methods" onPress={() => navigation.navigate('PaymentMethods')} />
          <Row icon="heart-outline" title="Wishlist" onPress={() => navigation.navigate('Wishlist')} />
          <Row icon="notifications-outline" title="Notifications" onPress={() => navigation.navigate('Notifications')} last />
        </Group>

        <Group title="Help">
          <Row icon="call-outline" title="Call support" subtitle="+91 73030 23539" onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
          <Row icon="mail-outline" title="Email support" subtitle={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
          <Row icon="help-circle-outline" title="Help & FAQs" onPress={() => navigation.navigate('StaticPage', { type: 'help' })} last />
        </Group>

        <Group title="About">
          <Row icon="information-circle-outline" title="About Dabba Nation" onPress={() => navigation.navigate('StaticPage', { type: 'about' })} />
          <Row icon="document-text-outline" title="Terms of service" onPress={() => navigation.navigate('StaticPage', { type: 'terms' })} />
          <Row icon="shield-checkmark-outline" title="Privacy policy" onPress={() => navigation.navigate('StaticPage', { type: 'privacy' })} />
          <Row icon="return-down-back-outline" title="Refund policy" onPress={() => navigation.navigate('StaticPage', { type: 'refund' })} last />
        </Group>

        <TouchableOpacity style={styles.logout} onPress={confirmLogout} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
        <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.md }]}>Dabba Nation · version {version}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const Tile: React.FC<{ icon: IconName; label: string; value: string; onPress: () => void }> = ({ icon, label, value, onPress }) => (
  <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${label}, ${value}`}>
    <Ionicons name={icon} size={20} color={colors.text} />
    <Text style={styles.tileValue} numberOfLines={1}>{value}</Text>
    <Text style={type.caption} numberOfLines={1}>{label}</Text>
  </TouchableOpacity>
);

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={{ marginTop: spacing.xl }}>
    <Text style={[type.overline, { marginBottom: spacing.sm }]}>{title}</Text>
    <View style={styles.group}>{children}</View>
  </View>
);

const Row: React.FC<{ icon: IconName; title: string; subtitle?: string; onPress: () => void; last?: boolean }> = ({ icon, title, subtitle, onPress, last }) => (
  <TouchableOpacity style={[styles.row, !last && styles.rowBorder]} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
    <Ionicons name={icon} size={20} color={colors.text} />
    <View style={{ flex: 1 }}>
      <Text style={type.bodyStrong}>{title}</Text>
      {subtitle ? <Text style={type.caption}>{subtitle}</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingHorizontal: spacing.screen, paddingTop: spacing.md },
  profile: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.lg,
    padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { backgroundColor: colors.inkSurface, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 24, color: colors.textOnInk },
  name: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: colors.text },
  editLink: { fontFamily: fonts.bold, fontSize: 13, color: colors.primaryInk, marginTop: 6 },
  tiles: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tile: { flex: 1, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 },
  tileValue: { fontFamily: fonts.heavy, fontSize: 15, color: colors.text, marginTop: spacing.xs },
  group: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 58, paddingVertical: spacing.sm },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xxl, height: 52,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  logoutText: { fontFamily: fonts.bold, fontSize: 15, color: colors.danger },
});

export default SettingsScreen;
