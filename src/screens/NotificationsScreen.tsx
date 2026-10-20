import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { Divider, EmptyState, ErrorState, ScreenHeader, SkeletonList } from '../components/common';
import { colors, spacing, type, fonts } from '../theme';

const ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  order: 'receipt-outline',
  delivery: 'bicycle-outline',
  delivery_update: 'bicycle-outline',
  wallet: 'wallet-outline',
  system: 'information-circle-outline',
};

const timeAgo = (iso: string) => {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const response = await api.user.getNotifications();
      setNotifications(Array.isArray(response) ? response : response.notifications || []);
    } catch (e: any) {
      console.error('Error fetching notifications:', e);
      setError(e?.message || 'We could not load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    try {
      await api.user.markNotificationRead(id);
    } catch (e) {
      console.error('Error marking as read:', e);
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await api.user.markAllNotificationsRead();
    } catch (e) {
      console.error('Error marking all as read:', e);
    }
  };

  const deleteNotification = async (id: string) => {
    const previous = notifications;
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    try {
      await api.user.deleteNotification(id);
    } catch (e) {
      console.error('Error deleting notification:', e);
      setNotifications(previous);
    }
  };

  const openNotification = (item: any) => {
    if (!item.isRead) markAsRead(item._id);
    const orderId = item.orderId || item.data?.orderId;
    if (orderId && (item.type === 'order' || item.type === 'delivery')) {
      navigation.navigate('OrderDetails', { orderId: String(orderId) });
    }
  };

  const unread = notifications.filter((n) => !n.isRead).length;

  const renderNotification = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.row} onPress={() => openNotification(item)} activeOpacity={0.7} accessibilityRole="button">
      <View style={[styles.icon, !item.isRead && styles.iconUnread]}>
        <Ionicons name={ICONS[item.type] || 'notifications-outline'} size={18} color={item.isRead ? colors.textSecondary : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={[type.subheading, { flex: 1 }, item.isRead && { fontWeight: '400' }]} numberOfLines={1}>{item.title}</Text>
          <Text style={type.caption}>{timeAgo(item.createdAt)}</Text>
        </View>
        <Text style={[type.small, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={3}>{item.message}</Text>
      </View>
      {!item.isRead ? <View style={styles.unreadDot} /> : null}
      <TouchableOpacity onPress={() => deleteNotification(item._id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Delete notification">
        <Ionicons name="close" size={16} color={colors.textTertiary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : undefined}
        right={
          unread ? (
            <TouchableOpacity onPress={markAllAsRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[type.label, { color: colors.primary }]}>Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
      {loading ? (
        <View style={{ padding: spacing.screen }}><SkeletonList count={4} imageSize={36} /></View>
      ) : error && notifications.length === 0 ? (
        <ErrorState message={error} onRetry={() => { setLoading(true); fetchNotifications(); }} />
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item._id}
          contentContainerStyle={notifications.length ? styles.list : { flexGrow: 1 }}
          ItemSeparatorComponent={() => <Divider inset={spacing.screen + 36 + spacing.md} />}
          onRefresh={() => { setRefreshing(true); fetchNotifications(); }}
          refreshing={refreshing}
          ListEmptyComponent={
            <EmptyState icon="notifications-outline" title="You're all caught up" subtitle="Order updates, refunds and offers will show up here." />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  list: { paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.screen, paddingVertical: spacing.lg },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  iconUnread: { backgroundColor: colors.primarySoft },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
});
