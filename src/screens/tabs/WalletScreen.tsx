import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import { AppHeader } from '../../components/common/AppHeader';
import { AppFooter } from '../../components/common/AppFooter';

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
      Alert.alert('Invalid Amount', 'Please enter a valid amount (minimum ₹10)');
      return;
    }
    
    try {
      setLoading(true);
      // 1. Create Razorpay order for wallet topup
      // Note: Backend might use same generic order creator or specific one
      const razorpayResponse = await api.payment.createRazorpayOrder({
        amount: amount,
        type: 'wallet_topup'
      });

      setPendingTopupAmount(amount);
      setTopupModalVisible(false);

      // 2. Build HTML for Razorpay
      const html = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body>
<script>
  var options = {
    key: '${razorpayResponse.key}',
    amount: ${razorpayResponse.amount},
    currency: '${razorpayResponse.currency || 'INR'}',
    order_id: '${razorpayResponse.orderId}',
    name: 'Dabba Nation',
    description: 'Wallet Top-up',
    prefill: {
      name: '',
      email: '',
      contact: ''
    },
    theme: { color: '#FF6B00' },
    handler: function(response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ 
        success: true, 
        paymentId: response.razorpay_payment_id,
        orderId: response.razorpay_order_id,
        signature: response.razorpay_signature
      }));
    },
    modal: {
      ondismiss: function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ success: false, cancelled: true }));
      }
    }
  };
  var rzp = new Razorpay(options);
  rzp.on('payment.failed', function(resp) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ success: false, error: resp.error.description }));
  });
  window.onload = function() { rzp.open(); };
</script>
</body>
</html>`;

      setRazorpayHtml(html);
      setRazorpayModal(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to initialize payment');
    } finally {
      setLoading(false);
    }
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

  if (loading && !wallet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Loading wallet...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showSearch={false} />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Ionicons name="wallet-outline" size={24} color="#FF6B00" />
            <Text style={styles.balanceLabel}>Available Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>₹{wallet?.balance || 0}</Text>
          <Text style={styles.balanceSubtext}>Use wallet for faster checkout</Text>
          
          <TouchableOpacity
            style={styles.topupButton}
            onPress={() => setTopupModalVisible(true)}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.topupButtonText}>Add Money</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Add Amounts */}
        <View style={styles.quickAddSection}>
          <Text style={styles.sectionTitle}>Quick Add</Text>
          <View style={styles.quickAddButtons}>
            {[100, 200, 500, 1000].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={styles.quickAddButton}
                onPress={() => {
                  setTopupAmount(String(amount));
                  setTopupModalVisible(true);
                }}
              >
                <Text style={styles.quickAddButtonText}>₹{amount}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Transaction History */}
        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          
          {wallet?.transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>
                Your wallet transactions will appear here
              </Text>
            </View>
          ) : (
            wallet?.transactions.map((transaction, index) => (
              <View key={transaction._id || index} style={styles.transactionItem}>
                <View style={styles.transactionIcon}>
                  <Ionicons
                    name={transaction.type === 'credit' ? 'arrow-down' : 'arrow-up'}
                    size={20}
                    color={transaction.type === 'credit' ? '#4CAF50' : '#FF5722'}
                  />
                </View>
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionDescription}>
                    {transaction.description}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {formatDate(transaction.createdAt)} • {formatTime(transaction.createdAt)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    transaction.type === 'credit' ? styles.creditAmount : styles.debitAmount,
                  ]}
                >
                  {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 20 }} />
        <AppFooter />
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Razorpay WebView Modal */}
      <Modal
        visible={razorpayModal}
        animationType="slide"
        onRequestClose={() => {
          setRazorpayModal(false);
          Alert.alert('Cancelled', 'Top-up was cancelled.');
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
            <TouchableOpacity onPress={() => { setRazorpayModal(false); Alert.alert('Cancelled', 'Top-up was cancelled.'); }} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '600', marginLeft: 8 }}>Secure Payment</Text>
          </View>
          {Platform.OS === 'web' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Ionicons name="phone-portrait-outline" size={64} color="#FF6B00" />
              <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>Use Mobile App</Text>
              <Text style={{ fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' }}>
                Wallet top-up via Razorpay works on the mobile app.
              </Text>
              <TouchableOpacity
                style={{ marginTop: 24, backgroundColor: '#FF6B00', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
                onPress={() => setRazorpayModal(false)}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Go Back</Text>
              </TouchableOpacity>
            </View>
          ) : razorpayHtml && WebViewComponent ? (
            <WebViewComponent
              source={{ html: razorpayHtml }}
              onMessage={handleWebViewMessage}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              renderLoading={() => <ActivityIndicator size="large" color="#FF6B00" style={{ marginTop: 40 }} />}
            />
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* Topup Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={topupModalVisible}
        onRequestClose={() => setTopupModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Money to Wallet</Text>
              <TouchableOpacity onPress={() => setTopupModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Enter Amount</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                keyboardType="numeric"
                value={topupAmount}
                onChangeText={setTopupAmount}
              />
            </View>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleTopup}
            >
              <Text style={styles.confirmButtonText}>Add Money</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2E8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: '#FF6B00',
    margin: 16,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  balanceSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
  },
  topupButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  topupButtonText: {
    color: '#FF6B00',
    fontSize: 16,
    fontWeight: '600',
  },
  quickAddSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  quickAddButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAddButton: {
    backgroundColor: '#FFF5F0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B00',
  },
  quickAddButtonText: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: '600',
  },
  subscriptionCard: {
    backgroundColor: '#E8F5E9',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  subscriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  subscriptionDetails: {
    gap: 8,
  },
  subscriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subscriptionLabel: {
    fontSize: 13,
    color: '#558B2F',
  },
  subscriptionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  transactionsSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    minHeight: 200,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionDetails: {
    flex: 1,
    marginLeft: 12,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  creditAmount: {
    color: '#4CAF50',
  },
  debitAmount: {
    color: '#FF5722',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  confirmButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
