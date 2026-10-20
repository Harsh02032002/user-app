/**
 * Payment methods — the app has no saved-card / saved-UPI backend, so this screen explains the
 * payment options that actually exist at checkout instead of showing placeholder cards.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';
import { Card, Divider, ListRow, Notice, ScreenHeader } from '../components/common';
import { colors, formatPrice, spacing, type, fonts } from '../theme';

export default function PaymentMethodsScreen() {
  const navigation = useNavigation<any>();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    api.user.getWalletTransactions()
      .then((res: any) => setWalletBalance(res?.data?.balance ?? res?.balance ?? 0))
      .catch(() => setWalletBalance(null));
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Payment methods" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[type.small, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
          You choose how to pay each time you check out. These options are available:
        </Text>
        <Card padded={false} style={{ paddingVertical: spacing.xs }}>
          <ListRow
            icon="wallet-outline"
            title="Dabba Nation wallet"
            subtitle={walletBalance != null ? `Balance ${formatPrice(walletBalance)} · refunds and cashback land here` : 'Refunds and cashback land here'}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Wallet' })}
            style={styles.row}
          />
          <Divider inset={spacing.lg + 48} />
          <ListRow icon="qr-code-outline" title="UPI" subtitle="PhonePe, GPay, Paytm or any UPI app" style={styles.row} />
          <Divider inset={spacing.lg + 48} />
          <ListRow
            icon="calendar-outline"
            title="Subscription balance"
            subtitle="For orders from your subscribed home chef"
            onPress={() => navigation.navigate('Subscriptions')}
            style={styles.row}
          />
          <Divider inset={spacing.lg + 48} />
          <ListRow icon="cash-outline" title="Cash on delivery" subtitle="Pay the delivery partner when your food arrives" style={styles.row} />
        </Card>
        <Notice
          tone="info"
          message="Saving cards or UPI IDs to your account isn't available yet. Your payment details are never stored in the app."
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing.screen, paddingBottom: spacing.xxxl },
  row: { paddingHorizontal: spacing.lg },
});
