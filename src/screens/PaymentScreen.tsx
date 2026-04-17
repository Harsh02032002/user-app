import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import RazorpayCheckout from 'react-native-razorpay';
import api, { API_ENDPOINTS } from '../config/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'Payment'>;

export default function PaymentScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { type, amount, razorpayOrderId, orderId, subscriptionData } = route.params;
  const { user } = useAuth();
  const { clearCart } = useCart();

  const [processing, setProcessing] = useState(false);

  const handlePayment = async () => {
    const options = {
      description: type === 'subscription' ? 'Subscription Payment' : 'Order Payment',
      image: 'https://dabbanation.in/logo.png',
      currency: 'INR',
      key: API_ENDPOINTS.RAZORPAY_KEY,
      amount: Math.round(amount * 100),
      name: 'Dabba Delights',
      order_id: razorpayOrderId,
      prefill: {
        email: user?.email || '',
        contact: user?.phone || '',
        name: user?.name || '',
      },
      theme: { color: '#FF6B00' },
    };

    try {
      const data = await RazorpayCheckout.open(options);
      // Payment successful
      await verifyPayment(data);
    } catch (error: any) {
      if (error.code !== 2) {
        // User cancelled
        Alert.alert('Payment Failed', error.description || 'Payment was not completed');
      }
    }
  };

  const verifyPayment = async (paymentData: any) => {
    setProcessing(true);
    try {
      if (type === 'subscription') {
        // Verify subscription payment
        await api.post(API_ENDPOINTS.VERIFY_SUBSCRIPTION, {
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_signature: paymentData.razorpay_signature,
          planId: subscriptionData?.planId,
          homeChefId: subscriptionData?.homeChefId,
        });

        Alert.alert(
          'Subscription Activated!',
          'Your subscription has been activated successfully. Start ordering now!',
          [
            {
              text: 'View Subscriptions',
              onPress: () => navigation.navigate('MainTabs'),
            },
          ]
        );
      } else {
        // Verify order payment
        await api.post(API_ENDPOINTS.VERIFY_PAYMENT, {
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_signature: paymentData.razorpay_signature,
          orderId,
        });

        clearCart();

        Alert.alert('Order Placed!', 'Your order has been placed successfully.', [
          {
            text: 'View Order',
            onPress: () =>
              navigation.navigate('OrderDetails', { orderId: orderId! }),
          },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Payment verification failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {/* Amount Card */}
        <View style={styles.amountCard}>
          <View style={styles.amountIcon}>
            <Ionicons name="wallet" size={32} color="#FF6B00" />
          </View>
          <Text style={styles.amountLabel}>Amount to Pay</Text>
          <Text style={styles.amountValue}>Rs. {amount}</Text>
          <Text style={styles.amountHint}>
            {type === 'subscription' ? 'For subscription plan' : 'For your order'}
          </Text>
        </View>

        {/* Payment Methods */}
        <View style={styles.methodsSection}>
          <Text style={styles.methodsTitle}>Pay using</Text>

          <TouchableOpacity style={styles.methodCard} onPress={handlePayment}>
            <View style={styles.methodIcon}>
              <Ionicons name="card" size={24} color="#2196F3" />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodName}>Razorpay</Text>
              <Text style={styles.methodDesc}>UPI, Cards, Netbanking & more</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark" size={20} color="#22C55E" />
          <Text style={styles.securityText}>
            Your payment is 100% secure. We use industry-standard encryption.
          </Text>
        </View>
      </View>

      {/* Bottom Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.payBtn}
          onPress={handlePayment}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.payBtnText}>Pay Rs. {amount}</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
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
  amountCard: {
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    borderRadius: 16,
    padding: 32,
    marginBottom: 24,
  },
  amountIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFE5D6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF6B00',
    marginBottom: 4,
  },
  amountHint: {
    fontSize: 13,
    color: '#888',
  },
  methodsSection: {
    marginBottom: 24,
  },
  methodsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  methodDesc: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
  },
  securityText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: '#1a1a1a',
    lineHeight: 18,
  },
  bottomContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B00',
    borderRadius: 12,
    padding: 16,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
});
