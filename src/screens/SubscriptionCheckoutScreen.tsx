import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import RazorpayCheckout, { isRazorpayAvailable } from '../utils/razorpay';
import api, { API_ENDPOINTS } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'SubscriptionCheckout'>;

interface PaymentBreakdown {
  totalAmount: number;
  walletBalance: number;
  walletAmount: number;
  razorpayAmount: number;
}

export default function SubscriptionCheckoutScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { user, refreshProfile } = useAuth();
  
  const { planId, planName, amount, durationDays, homeChefId, homeChefName, perDayValue } = route.params;

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(true);
  const [breakdown, setBreakdown] = useState<PaymentBreakdown | null>(null);
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);
  const [onlineModalVisible, setOnlineModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Prevent blank screen - ensure component is mounted before fetching
  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => {
      fetchWalletBalance();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const calculateBreakdown = React.useCallback((balance: number, useWalletPay: boolean) => {
    let walletAmount = 0;
    let razorpayAmount = amount;

    if (useWalletPay && balance > 0) {
      if (balance >= amount) {
        walletAmount = amount;
        razorpayAmount = 0;
      } else {
        walletAmount = balance;
        razorpayAmount = amount - balance;
      }
    }

    setBreakdown({
      totalAmount: amount,
      walletBalance: balance,
      walletAmount,
      razorpayAmount,
    });
  }, [amount]);

  const fetchWalletBalance = React.useCallback(async () => {
    try {
      setError(null);
      // Get user wallet balance - same as web app
      const response = await api.get('/user/wallet/transactions');
      const balance = response.data?.balance || response.data?.data?.balance || 0;
      setWalletBalance(balance);
      calculateBreakdown(balance, useWallet);
    } catch (error: any) {
      console.error('Error fetching wallet balance:', error);
      setError(error?.response?.data?.message || 'Failed to load wallet balance');
      calculateBreakdown(0, false);
    } finally {
      setLoading(false);
    }
  }, [useWallet, calculateBreakdown]);

  const toggleWallet = React.useCallback(() => {
    const newUseWallet = !useWallet;
    setUseWallet(newUseWallet);
    calculateBreakdown(walletBalance, newUseWallet);
  }, [useWallet, walletBalance, calculateBreakdown]);

  const verifyHybridPayment = React.useCallback(async (paymentData: any, rzOrderId: string) => {
    try {
      // Step 1: Verify payment with Razorpay
      await api.post(API_ENDPOINTS.VERIFY_RAZORPAY_PAYMENT, {
        razorpayOrderId: rzOrderId,
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpaySignature: paymentData.razorpay_signature,
      });

      // Step 2: Finalize subscription purchase
      await api.post(API_ENDPOINTS.PURCHASE_SUBSCRIPTION, {
        planId,
        sellerId: homeChefId,
        totalAmount: amount,
        totalDays: durationDays,
        usedWallet: useWallet && (breakdown?.walletAmount || 0) > 0,
        walletAmount: breakdown?.walletAmount || 0,
        razorpay_order_id: rzOrderId,
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_signature: paymentData.razorpay_signature,
      });

      await refreshProfile();
      
      Alert.alert(
        'Subscription Activated!',
        `Your ${planName} subscription with ${homeChefName} is now active!`,
        [
          {
            text: 'View Subscriptions',
            onPress: () => navigation.navigate('Subscriptions'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Payment verification failed');
    }
  }, [planId, homeChefId, amount, durationDays, useWallet, breakdown, planName, homeChefName, navigation]);

  const verifyWalletPayment = React.useCallback(async () => {
    try {
      await api.post(API_ENDPOINTS.PURCHASE_SUBSCRIPTION, {
        planId,
        sellerId: homeChefId,
        totalAmount: amount,
        totalDays: durationDays,
        usedWallet: true,
        walletAmount: amount,
      });

      await refreshProfile();
      Alert.alert(
        'Subscription Activated!',
        `Your ${planName} subscription with ${homeChefName} is now active! Paid fully from wallet.`,
        [
          {
            text: 'View Subscriptions',
            onPress: () => navigation.navigate('Subscriptions'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Wallet payment failed');
    }
  }, [planId, homeChefId, amount, durationDays, planName, homeChefName, navigation]);

  const handleOnlineSuccess = React.useCallback(async (txnId?: string) => {
    try {
      setProcessing(true);
      await api.post(API_ENDPOINTS.PURCHASE_SUBSCRIPTION, {
        planId,
        sellerId: homeChefId,
        totalAmount: amount,
        totalDays: durationDays,
        usedWallet: useWallet && (breakdown?.walletAmount || 0) > 0,
        walletAmount: breakdown?.walletAmount || 0,
        razorpay_payment_id: txnId || `UPI_${Date.now()}`,
      });

      await refreshProfile();
      Alert.alert(
        'Subscription Activated!',
        `Your ${planName} subscription with ${homeChefName} is now active!`,
        [
          {
            text: 'View Subscriptions',
            onPress: () => navigation.navigate('Subscriptions'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Subscription payment verification failed');
    } finally {
      setProcessing(false);
    }
  }, [planId, homeChefId, amount, durationDays, useWallet, breakdown, planName, homeChefName, navigation, refreshProfile]);

  const handlePayment = React.useCallback(async () => {
    if (!breakdown) return;
    
    if (breakdown.razorpayAmount === 0) {
      setProcessing(true);
      await verifyWalletPayment();
      setProcessing(false);
      return;
    }

    if (!isRazorpayAvailable()) {
      Alert.alert(
        'Online payment unavailable',
        `Online payment isn't available in this build. Add ₹${breakdown.razorpayAmount} more to your wallet, or buy this plan from the installed Dabba Nation app.`
      );
      return;
    }

    setProcessing(true);
    try {
      const { data } = await api.post(API_ENDPOINTS.CREATE_RAZORPAY_ORDER, { amount: breakdown.razorpayAmount });
      const rzOrderId = data?.orderId;
      if (!rzOrderId) throw new Error(data?.message || 'Could not start the payment');
      const paymentData = await RazorpayCheckout.open({
        description: `${planName} with ${homeChefName}`,
        currency: 'INR',
        key: data.key || API_ENDPOINTS.RAZORPAY_KEY,
        amount: data.amount,
        name: 'Dabba Nation',
        order_id: rzOrderId,
        prefill: { email: user?.email || '', contact: user?.phone || '', name: user?.name || '' },
        theme: { color: '#FF6B00' },
      });
      await verifyHybridPayment(paymentData, rzOrderId);
    } catch (error: any) {
      if (error?.code !== 2) {
        Alert.alert('Payment not completed', error?.response?.data?.message || error?.description || error?.message || 'Please try again');
      }
    } finally {
      setProcessing(false);
    }
  }, [breakdown, verifyWalletPayment, verifyHybridPayment, planName, homeChefName, user]);

  // Show loading state with UI skeleton to prevent blank screen
  if (loading && !mounted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Loading payment details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state with retry button
  if (error && !breakdown) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF6B00" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchWalletBalance}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        {/* Plan Summary */}
        <View style={styles.planCard}>
          <View style={styles.planIcon}>
            <Ionicons name="card" size={32} color="#FF6B00" />
          </View>
          <Text style={styles.planName}>{planName}</Text>
          <Text style={styles.planSubtitle}>Home Chef: {homeChefName}</Text>
          <View style={styles.planMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.metaText}>{durationDays} Days</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="wallet-outline" size={16} color="#666" />
              <Text style={styles.metaText}>₹{perDayValue}/day value</Text>
            </View>
          </View>
        </View>

        {/* Wallet Toggle */}
        {walletBalance > 0 && (
          <TouchableOpacity 
            style={[styles.walletCard, useWallet && styles.walletCardActive]}
            onPress={toggleWallet}
          >
            <View style={styles.walletHeader}>
              <View style={styles.walletIcon}>
                <Ionicons name="wallet" size={24} color={useWallet ? '#FF6B00' : '#666'} />
              </View>
              <View style={styles.walletInfo}>
                <Text style={styles.walletTitle}>Use Wallet Balance</Text>
                <Text style={styles.walletBalance}>Available: ₹{walletBalance.toLocaleString()}</Text>
              </View>
              <View style={[styles.checkbox, useWallet && styles.checkboxActive]}>
                {useWallet && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Payment Breakdown */}
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>Payment Breakdown</Text>
          
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Plan Amount</Text>
            <Text style={styles.breakdownValue}>₹{amount.toLocaleString()}</Text>
          </View>

          {breakdown && breakdown.walletAmount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Wallet Payment</Text>
              <Text style={[styles.breakdownValue, styles.successText]}>
                -₹{breakdown.walletAmount.toLocaleString()}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.breakdownRow}>
            <Text style={styles.totalLabel}>Amount to Pay</Text>
            <Text style={styles.totalValue}>
              ₹{breakdown?.razorpayAmount.toLocaleString() || amount.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.paymentMethodCard}>
          <Text style={styles.paymentMethodTitle}>Payment Method</Text>
          <View style={styles.methodRow}>
            <View style={styles.methodIcon}>
              <Ionicons name="qr-code" size={24} color="#059669" />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodName}>Online Payment (UPI / QR Code)</Text>
              <Text style={styles.methodDesc}>PhonePe, GPay, Paytm & UPI QR Code</Text>
            </View>
          </View>
        </View>

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark" size={20} color="#22C55E" />
          <Text style={styles.securityText}>
            Fast & Secure Instant Payment via UPI QR Code
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Pay Button */}
      <View style={styles.bottomContainer}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalAmountLabel}>Total Amount</Text>
          <Text style={styles.totalAmountValue}>
            ₹{breakdown?.razorpayAmount.toLocaleString() || amount.toLocaleString()}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.payButton, processing && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.payButtonText}>
                {breakdown?.razorpayAmount === 0 ? 'Activate with Wallet' : 'Pay Online (QR Code)'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  planCard: {
    backgroundColor: '#FFF5F0',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  planIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFE5D6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  planSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  planMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#666',
  },
  walletCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  walletCardActive: {
    backgroundColor: '#FFF5F0',
    borderColor: '#FF6B00',
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFE5D6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletInfo: {
    flex: 1,
    marginLeft: 12,
  },
  walletTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  walletBalance: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  breakdownCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#666',
  },
  breakdownValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  successText: {
    color: '#22C55E',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  paymentMethodCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodInfo: {
    marginLeft: 12,
  },
  methodName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  methodDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  securityText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: '#1a1a1a',
    lineHeight: 18,
  },
  bottomContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  totalContainer: {
    marginBottom: 12,
  },
  totalAmountLabel: {
    fontSize: 14,
    color: '#888',
  },
  totalAmountValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B00',
    borderRadius: 12,
    padding: 16,
  },
  payButtonDisabled: {
    backgroundColor: '#FFB380',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
