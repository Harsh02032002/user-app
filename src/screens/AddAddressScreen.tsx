import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Button, Card, Input, ScreenHeader, SkeletonList, StickyFooter } from '../components/common';
import { colors, radius, spacing, type } from '../theme';
import type { SavedAddress } from './AddressesScreen';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'AddAddress'>;
type Label = 'home' | 'work' | 'other';
type Field = 'contactName' | 'phone' | 'fullAddress' | 'city' | 'state' | 'pincode';

const LABELS: { key: Label; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'work', label: 'Work', icon: 'briefcase-outline' },
  { key: 'other', label: 'Other', icon: 'location-outline' },
];

export default function AddAddressScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { user } = useAuth();
  const editId = route.params?.edit ? route.params?.addressId : undefined;

  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!!editId);
  const [label, setLabel] = useState<Label>('home');
  const [form, setForm] = useState({
    contactName: user?.name || '',
    phone: user?.phone || '',
    fullAddress: '',
    street: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  // Edit mode: prefill from the saved address
  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const res = await api.user.getAddresses();
        const existing: SavedAddress | undefined = (res?.addresses || []).find((a: SavedAddress) => a._id === editId);
        if (existing) {
          setLabel((existing.label as Label) || 'home');
          setForm({
            contactName: existing.contactName || '',
            phone: existing.phone || '',
            fullAddress: existing.fullAddress || '',
            street: existing.street || '',
            landmark: existing.landmark || '',
            city: existing.city || '',
            state: existing.state || '',
            pincode: existing.pincode || '',
          });
          setIsDefault(!!existing.isDefault);
        }
      } catch (e) {
        console.log('[AddAddress] load error', e);
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [editId]);

  const setField = (field: keyof typeof form) => (text: string) => {
    setForm((f) => ({ ...f, [field]: text }));
    if ((errors as any)[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleSave = async () => {
    const next: Partial<Record<Field, string>> = {};
    if (!form.fullAddress.trim()) next.fullAddress = 'Enter house no. and building';
    if (!form.city.trim()) next.city = 'Enter city';
    if (!form.state.trim()) next.state = 'Enter state';
    if (!/^\d{6}$/.test(form.pincode.trim())) next.pincode = 'Enter a 6-digit pincode';
    if (form.phone && !/^\d{10}$/.test(form.phone.replace(/\D/g, '').slice(-10))) next.phone = 'Enter a 10-digit number';
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload = {
      label,
      fullAddress: form.fullAddress.trim(),
      street: form.street.trim() || undefined,
      landmark: form.landmark.trim() || undefined,
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      contactName: form.contactName.trim() || undefined,
      phone: form.phone.trim() || undefined,
      isDefault,
    };

    setLoading(true);
    try {
      if (editId) {
        await api.user.updateAddress(editId, payload);
      } else {
        await api.user.addAddress(payload);
      }
      Toast.show({ type: 'success', text1: editId ? 'Address updated' : 'Address saved' });
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Could not save address', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title={editId ? 'Edit address' : 'Add address'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loadingExisting ? (
          <View style={{ padding: spacing.screen }}><SkeletonList count={2} imageSize={36} /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[type.overline, styles.label]}>Save as</Text>
            <View style={styles.labels}>
              {LABELS.map((l) => {
                const active = label === l.key;
                return (
                  <TouchableOpacity
                    key={l.key}
                    style={[styles.labelChip, active && styles.labelChipActive]}
                    onPress={() => setLabel(l.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Ionicons name={l.icon} size={16} color={active ? colors.textInverse : colors.textSecondary} />
                    <Text style={[type.label, { color: active ? colors.textInverse : colors.textSecondary }]}>{l.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Card style={{ marginTop: spacing.lg }}>
              <Input label="Contact name" icon="person-outline" placeholder="Who receives deliveries here?" value={form.contactName} onChangeText={setField('contactName')} />
              <Input label="Phone number" icon="call-outline" placeholder="10-digit mobile number" keyboardType="phone-pad" maxLength={10} value={form.phone} onChangeText={setField('phone')} error={errors.phone} />
              <Input label="House / flat and building" required placeholder="e.g. House 12, Green Apartments" value={form.fullAddress} onChangeText={setField('fullAddress')} error={errors.fullAddress} />
              <Input label="Street / area" placeholder="Street, sector or locality" value={form.street} onChangeText={setField('street')} />
              <Input label="Landmark" placeholder="Nearby landmark (optional)" value={form.landmark} onChangeText={setField('landmark')} />
              <View style={styles.row}>
                <Input label="City" required placeholder="City" value={form.city} onChangeText={setField('city')} error={errors.city} style={{ flex: 1 }} />
                <Input label="State" required placeholder="State" value={form.state} onChangeText={setField('state')} error={errors.state} style={{ flex: 1 }} />
              </View>
              <Input label="Pincode" required placeholder="6 digits" keyboardType="number-pad" maxLength={6} value={form.pincode} onChangeText={setField('pincode')} error={errors.pincode} style={{ marginBottom: 0 }} />
            </Card>

            <Card style={styles.defaultRow}>
              <View style={{ flex: 1 }}>
                <Text style={type.subheading}>Set as default address</Text>
                <Text style={type.caption}>Use this address first at checkout</Text>
              </View>
              <Switch
                value={isDefault}
                onValueChange={setIsDefault}
                trackColor={{ false: colors.border, true: colors.primaryBorder }}
                thumbColor={isDefault ? colors.primary : colors.surface}
                accessibilityLabel="Set as default address"
              />
            </Card>
          </ScrollView>
        )}
        <StickyFooter>
          <Button title={editId ? 'Save changes' : 'Save address'} onPress={handleSave} loading={loading} disabled={loadingExisting} fullWidth />
        </StickyFooter>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing.screen, paddingBottom: spacing.xxl },
  label: { marginLeft: spacing.xs, marginBottom: spacing.sm },
  labels: { flexDirection: 'row', gap: spacing.sm },
  labelChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  labelChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  row: { flexDirection: 'row', gap: spacing.md },
  defaultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
});
