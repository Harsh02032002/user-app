import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { RootStackParamList } from '../navigation/RootNavigator';
import api from '../services/api';
import { Badge, Button, Card, EmptyState, ErrorState, ScreenHeader, SkeletonList, StickyFooter } from '../components/common';
import { colors, radius, spacing, type, fonts } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Addresses'>;

/** Backend Address document (models/Others.js) */
export interface SavedAddress {
  _id: string;
  label?: 'home' | 'work' | 'other';
  fullAddress: string;
  street?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  phone?: string;
  contactName?: string;
  isDefault: boolean;
}

const LABEL_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  home: 'home-outline',
  work: 'briefcase-outline',
  other: 'location-outline',
};

export default function AddressesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchAddresses = useCallback(async () => {
    try {
      setError(null);
      const res = await api.user.getAddresses();
      setAddresses(res?.addresses || []);
    } catch (e: any) {
      setError(e?.message || 'We could not load your addresses.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever we come back from Add / Edit
  useFocusEffect(useCallback(() => { fetchAddresses(); }, [fetchAddresses]));

  const deleteAddress = (address: SavedAddress) => {
    const run = async () => {
      setBusyId(address._id);
      try {
        await api.user.deleteAddress(address._id);
        setAddresses((prev) => prev.filter((a) => a._id !== address._id));
        Toast.show({ type: 'success', text1: 'Address deleted' });
      } catch (e: any) {
        Alert.alert('Could not delete address', e?.message || 'Please try again.');
      } finally {
        setBusyId(null);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this address?')) run();
      return;
    }
    Alert.alert('Delete this address?', address.fullAddress, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  };

  const setDefault = async (address: SavedAddress) => {
    setBusyId(address._id);
    try {
      await api.user.setDefaultAddress(address._id);
      setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a._id === address._id })));
    } catch (e: any) {
      Alert.alert('Could not update default', e?.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const renderAddressItem = ({ item }: { item: SavedAddress }) => {
    const label = item.label || 'other';
    return (
      <Card>
        <View style={styles.cardTop}>
          <View style={styles.labelIcon}>
            <Ionicons name={LABEL_ICON[label] || 'location-outline'} size={18} color={colors.primary} />
          </View>
          <Text style={[type.subheading, { flex: 1, textTransform: 'capitalize' }]}>{label}</Text>
          {item.isDefault ? <Badge text="Default" variant="success" /> : null}
        </View>
        {item.contactName || item.phone ? (
          <Text style={[type.label, { marginTop: spacing.md }]}>{[item.contactName, item.phone].filter(Boolean).join(' · ')}</Text>
        ) : null}
        <Text style={[type.small, { color: colors.textSecondary, marginTop: spacing.xs }]}>{item.fullAddress}</Text>
        {item.street || item.landmark ? <Text style={type.caption}>{[item.street, item.landmark].filter(Boolean).join(', ')}</Text> : null}
        <Text style={type.caption}>{item.city}, {item.state} {item.pincode}</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={() => navigation.navigate('AddAddress', { edit: true, addressId: item._id })} disabled={busyId === item._id}>
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={[type.label, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>
          {!item.isDefault ? (
            <TouchableOpacity style={styles.action} onPress={() => setDefault(item)} disabled={busyId === item._id}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.textSecondary} />
              <Text style={[type.label, { color: colors.textSecondary }]}>Set as default</Text>
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.action} onPress={() => deleteAddress(item)} disabled={busyId === item._id} accessibilityLabel="Delete address">
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Saved addresses" />
      {loading ? (
        <View style={{ padding: spacing.screen }}><SkeletonList count={2} imageSize={36} /></View>
      ) : error && addresses.length === 0 ? (
        <ErrorState message={error} onRetry={() => { setLoading(true); fetchAddresses(); }} />
      ) : (
        <FlatList
          data={addresses}
          renderItem={renderAddressItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState icon="location-outline" title="No saved addresses" subtitle="Save your home or work address for faster checkout." />
          }
        />
      )}
      <StickyFooter>
        <Button title="Add new address" icon="add" onPress={() => navigation.navigate('AddAddress', {})} fullWidth />
      </StickyFooter>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  list: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  labelIcon: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
});
