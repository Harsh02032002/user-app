import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { colors, fonts } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Wallet'>;

interface Transaction {
  _id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
}

export default function WalletScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, token } = useAuth();
  const [balance, setBalance] = useState(0);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topupModalVisible, setTopupModalVisible] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [razorpayModal, setRazorpayModal] = useState(false);
  const [razorpayHtml, setRazorpayHtml] = useState('');
  const [pendingTopupAmount, setPendingTopupAmount] = useState<number | null>(null);

  const WebViewComponent = Platform.OS !== 'web' ? require('react-native-webview').WebView : null;

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${API_URL}/wallet`, {
      //   headers: { Authorization: `Bearer ${token}` },
      // });
      // const data = await response.json();
      
      // Mock data for now
      setBalance(1250);
      setTransactions([
        { _id: '1', type: 'credit', amount: 500, description: 'Wallet Recharge', date: '2024-01-15' },
        { _id: '2', type: 'debit', amount: 200, description: 'Order Payment #1234', date: '2024-01-14' },
        { _id: '3', type: 'credit', amount: 1000, description: 'Welcome Bonus', date: '2024-01-10' },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch wallet data');
    } finally {
      setLoading(false);
    }
  };

  const handleRecharge = async () => {
    const amount = parseInt(rechargeAmount);
    if (!amount || amount < 10) {
      Alert.alert('Error', 'Minimum recharge amount is ₹10');
      return;
    }
    
    // TODO: Navigate to payment screen for wallet recharge
    Alert.alert('Recharge', `Proceeding to recharge ₹${amount}`);
    setRechargeAmount('');
  };

  const presetAmounts = [100, 200, 500, 1000];

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Wallet</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>₹{balance.toFixed(2)}</Text>
          <View style={styles.balanceActions}>
            <TouchableOpacity style={styles.rechargeButton} onPress={() => {}}>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.rechargeButtonText}>Recharge</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Recharge */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Recharge</Text>
          <View style={styles.presetAmounts}>
            {presetAmounts.map((amount) => (
              <TouchableOpacity
                key={amount}
                style={styles.presetButton}
                onPress={() => setRechargeAmount(amount.toString())}
              >
                <Text style={styles.presetText}>₹{amount}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.customAmountContainer}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="Enter amount"
              keyboardType="number-pad"
              value={rechargeAmount}
              onChangeText={setRechargeAmount}
            />
          </View>
          <TouchableOpacity
            style={[styles.rechargeNowButton, !rechargeAmount && styles.disabledButton]}
            onPress={handleRecharge}
            disabled={!rechargeAmount}
          >
            <Text style={styles.rechargeNowText}>Recharge Now</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <View style={styles.transactionsCard}>
            {transactions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No transactions yet</Text>
              </View>
            ) : (
              transactions.map((transaction, index) => (
                <View key={transaction._id}>
                  <View style={styles.transactionItem}>
                    <View style={styles.transactionLeft}>
                      <View style={[
                        styles.transactionIcon,
                        transaction.type === 'credit' ? styles.creditIcon : styles.debitIcon
                      ]}>
                        <Ionicons 
                          name={transaction.type === 'credit' ? 'arrow-down' : 'arrow-up'} 
                          size={16} 
                          color={transaction.type === 'credit' ? '#22c55e' : '#dc2626'} 
                        />
                      </View>
                      <View>
                        <Text style={styles.transactionDescription}>{transaction.description}</Text>
                        <Text style={styles.transactionDate}>{transaction.date}</Text>
                      </View>
                    </View>
                    <Text style={[
                      styles.transactionAmount,
                      transaction.type === 'credit' ? styles.creditText : styles.debitText
                    ]}>
                      {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount}
                    </Text>
                  </View>
                  {index < transactions.length - 1 && <View style={styles.divider} />}
                </View>
              ))
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8, fontFamily: fonts.regular,
  },
  balanceAmount: {
    fontSize: 36,
    fontFamily: fonts.bold,
    color: colors.surface,
    marginBottom: 20,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rechargeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  rechargeButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 16,
  },
  presetAmounts: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  presetButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  customAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencySymbol: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.text,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.text, fontFamily: fonts.regular,
  },
  rechargeNowButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  rechargeNowText: {
    color: colors.surface,
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  transactionsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  creditIcon: {
    backgroundColor: '#dcfce7',
  },
  debitIcon: {
    backgroundColor: '#fee2e2',
  },
  transactionDescription: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2, fontFamily: fonts.regular,
  },
  transactionAmount: {
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  creditText: {
    color: '#22c55e',
  },
  debitText: {
    color: '#dc2626',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 12, fontFamily: fonts.regular,
  },
});
