import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import { BottomSheet, Button, Card, Chip, Divider, EmptyState, ErrorState, ScreenHeader, Skeleton, SkeletonList } from '../../components/common';
import { TAB_BAR_HEIGHT } from '../../components/common/MobileNavBar';
import { colors, formatPrice, radius, spacing, type, fonts } from '../../theme';
import { OnlinePaymentModal } from '../../components/OnlinePaymentModal';

interface Transaction {
  _id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  createdAt: string;
}

interface WalletData {
  balance: number;
  transactions: Transaction[];
}

interface SubscriptionData {
  total_amount?: number;
  remaining_amount?: number;
  total_days?: number;
  remaining_days?: number;
  per_day_value?: number;
  status?: string;
}

export function WalletScreen() {
  const navigation = useNavigation();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topupModalVisible, setTopupModalVisible] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [razorpayModal, setRazorpayModal] = useState(false);
  const [razorpayHtml, setRazorpayHtml] = useState('');
  const [pendingTopupAmount, setPendingTopupAmount] = useState<number | null>(null);

  const WebViewComponent = Platform.OS !== 'web' ? require('react-native-webview').WebView : null;

  const fetchWallet = async () => {
    try {
      setError(null);
      const walletResponse = await api.user.getWalletTransactions();
      
      const data = walletResponse?.data || walletResponse || {};
      setWallet({
        balance: data.balance || 0,
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
      });
    } catch (err: any) {
      console.error('Error fetching wallet:', err);
      setError(err.message || 'Failed to load wallet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWallet();
  };

  const handleTopup = async () => {
    const amount = parseInt(topupAmount);
    if (!amount || amount < 10) {
      Alert.alert('Enter an amount', 'The minimum top-up is ₹10.');
      return;
    }
    setPendingTopupAmount(amount);
    setTopupModalVisible(false);
    setRazorpayModal(true);
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      setRazorpayModal(false);
      setRazorpayHtml('');
      
      if (data.success && data.paymentId && pendingTopupAmount) {
        setLoading(true);
        // Verify and Credit wallet
        await api.user.verifyPayment({
          amount: pendingTopupAmount,
          razorpayPaymentId: data.paymentId,
          razorpayOrderId: data.orderId,
          razorpaySignature: data.signature
        });
        
        Alert.alert('Success', `₹${pendingTopupAmount} added to your wallet successfully!`);
        fetchWallet();
      } else if (data.cancelled) {
        Alert.alert('Cancelled', 'Top-up was cancelled.');
      } else {
        Alert.alert('Failed', data.error || 'Payment failed.');
      }
    } catch (e) {
      console.error('WebView message error:', e);
    } finally {
      setLoading(false);
      setPendingTopupAmount(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const header = <ScreenHeader title="Wallet" subtitle="Faster checkout and instant refunds" showBack={false} />;

  if (loading && !wallet) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {header}
        <View style={{ padding: spacing.screen, gap: spacing.md }}>
          <Skeleton height={140} radius={radius.lg} />
          <SkeletonList count={3} imageSize={40} />
        </View>
      </SafeAreaView>
    );
  }

  const parsedAmount = parseInt(topupAmount, 10);
  const amountError = topupAmount && (!parsedAmount || parsedAmount < 10) ? 'Minimum top-up is ₹10' : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {header}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View>
              <Text style={[type.overline, { color: colors.textOnInkMuted }]}>Available balance</Text>
              <Text style={styles.balanceAmount}>{formatPrice(wallet?.balance || 0)}</Text>
            </View>
            <View style={styles.walletIcon}>
              <Ionicons name="wallet" size={20} color={colors.textInverse} />
            </View>
          </View>
          <TouchableOpacity style={styles.addMoney} onPress={() => { setTopupAmount(''); setTopupModalVisible(true); }} accessibilityRole="button">
            <Ionicons name="add" size={18} color={colors.textInverse} />
            <Text style={[type.subheading, { color: colors.textInverse }]}>Add money</Text>
          </TouchableOpacity>
        </View>

        <Text style={[type.overline, styles.label]}>Quick add</Text>
        <View style={styles.quickRow}>
          {[100, 200, 500, 1000].map((amount) => (
            <TouchableOpacity
              key={amount}
              style={styles.quickChip}
              onPress={() => {
                setTopupAmount(String(amount));
                setTopupModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Add ₹${amount}`}
            >
              <Text style={type.subheading}>+{formatPrice(amount)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[type.overline, styles.label]}>Transactions</Text>
        {error && !wallet?.transactions.length ? (
          <ErrorState message={error} onRetry={onRefresh} />
        ) : wallet?.transactions.length === 0 ? (
          <Card variant="outlined">
            <EmptyState icon="receipt-outline" title="No transactions yet" subtitle="Top-ups, payments, refunds and cashback will appear here." style={{ paddingVertical: spacing.xl }} />
          </Card>
        ) : (
          <Card padded={false}>
            {wallet?.transactions.map((transaction, index) => {
              const credit = transaction.type === 'credit';
              return (
                <View key={transaction._id || index}>
                  {index > 0 ? <Divider inset={spacing.lg + 40 + spacing.md} /> : null}
                  <View style={styles.txRow}>
                    <View style={[styles.txIcon, { backgroundColor: credit ? colors.successSoft : colors.surfaceMuted }]}>
                      <Ionicons name={credit ? 'arrow-down' : 'arrow-up'} size={18} color={credit ? colors.successStrong : colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={type.small} numberOfLines={2}>{transaction.description}</Text>
                      <Text style={type.caption}>{formatDate(transaction.createdAt)} · {formatTime(transaction.createdAt)}</Text>
                    </View>
                    <Text style={[type.price, { color: credit ? colors.successStrong : colors.text }]}>
                      {credit ? '+' : '−'}{formatPrice(transaction.amount)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>

      {/* Online UPI QR Payment Modal */}
      <OnlinePaymentModal
        visible={razorpayModal}
        onClose={() => setRazorpayModal(false)}
        amount={pendingTopupAmount || 0}
        title="Add money with UPI"
        onPaymentSuccess={async (txnId) => {
          if (pendingTopupAmount) {
            setLoading(true);
            // POST /user/wallet/topup expects { amount: number } (the UTR is not stored by the backend)
            await api.user.topupWallet(pendingTopupAmount);
            Toast.show({ type: 'success', text1: 'Money added', text2: `${formatPrice(pendingTopupAmount)} added to your wallet` });
            fetchWallet();
          }
        }}
      />

      {/* Add money */}
      <BottomSheet
        visible={topupModalVisible}
        onClose={() => setTopupModalVisible(false)}
        title="Add money"
        subtitle="Pay by UPI and the amount is added to your wallet"
        scrollable={false}
        footer={<Button title={parsedAmount >= 10 ? `Add ${formatPrice(parsedAmount)}` : 'Add money'} onPress={handleTopup} disabled={!parsedAmount || parsedAmount < 10} fullWidth />}
      >
        <View style={[styles.amountField, !!amountError && { borderColor: colors.danger }]}>
          <Text style={styles.currency}>₹</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            value={topupAmount}
            onChangeText={(v) => setTopupAmount(v.replace(/\D/g, ''))}
            autoFocus
            maxLength={6}
            accessibilityLabel="Amount to add"
          />
        </View>
        {amountError ? <Text style={[type.caption, { color: colors.danger, marginTop: spacing.xs }]}>{amountError}</Text> : null}
        <View style={[styles.quickRow, { marginTop: spacing.lg }]}>
          {[100, 200, 500, 1000].map((amount) => (
            <Chip key={amount} label={`+${formatPrice(amount)}`} selected={parsedAmount === amount} onPress={() => setTopupAmount(String(amount))} />
          ))}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing.screen, paddingBottom: TAB_BAR_HEIGHT + spacing.xxxl },
  balanceCard: { borderRadius: radius.xl, padding: spacing.xl, backgroundColor: colors.inkSurface },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  balanceAmount: { ...type.display, fontSize: 34, lineHeight: 42, color: colors.textOnInk, marginTop: spacing.xs, fontVariant: ['tabular-nums'], },
  walletIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addMoney: { marginTop: spacing.lg, height: 46, borderRadius: 12, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  label: { marginTop: spacing.xxl, marginBottom: spacing.sm, marginLeft: spacing.xs },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickChip: { flexGrow: 1, minWidth: 72, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  amountField: { flexDirection: 'row', alignItems: 'center', height: 64, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, backgroundColor: colors.surface },
  currency: { ...type.title, color: colors.textSecondary, marginRight: spacing.sm },
  amountInput: { flex: 1, fontSize: 28, fontFamily: fonts.bold, color: colors.text },
});
