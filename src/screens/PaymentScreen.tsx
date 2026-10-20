import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import RazorpayCheckout from '../utils/razorpay';
import api, { API_ENDPOINTS } from '../config/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Button, Card, IconButton, Notice, StickyFooter } from '../components/common';
import { colors, formatPrice, radius, spacing, type as typo, fonts } from '../theme';

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
      name: 'Dabba Nation',
      order_id: razorpayOrderId,
      prefill: {
        email: user?.email || '',
        contact: user?.phone || '',
        name: user?.name || '',
      },
      theme: { color: colors.primary },
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton icon="close" accessibilityLabel="Close payment" onPress={() => navigation.goBack()} style={{ marginLeft: -spacing.sm }} />
        <Text style={[typo.heading, { flex: 1, textAlign: 'center' }]}>Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Card style={styles.amountCard}>
          <Text style={typo.overline}>Amount to pay</Text>
          <Text style={styles.amountValue}>{formatPrice(amount)}</Text>
          <Text style={typo.caption}>{type === 'subscription' ? 'Subscription plan purchase' : 'Payment for your order'}</Text>
        </Card>

        <Text style={[typo.overline, styles.label]}>Pay using</Text>
        <TouchableOpacity style={styles.method} onPress={handlePayment} disabled={processing} activeOpacity={0.8} accessibilityRole="button">
          <View style={styles.methodIcon}>
            <Ionicons name="card" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={typo.subheading}>Razorpay</Text>
            <Text style={typo.caption}>UPI, cards, netbanking and more</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        <Notice tone="success" icon="shield-checkmark" message="Payments are processed securely by Razorpay." style={{ marginTop: spacing.lg }} />
      </View>

      <StickyFooter>
        <Button title={`Pay ${formatPrice(amount)}`} iconRight="arrow-forward" onPress={handlePayment} loading={processing} fullWidth />
      </StickyFooter>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screen, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  content: { flex: 1, padding: spacing.screen },
  amountCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  amountValue: { ...typo.display, fontSize: 32, lineHeight: 40, color: colors.text, marginVertical: spacing.xs, fontVariant: ['tabular-nums'], fontFamily: fonts.regular,
  },
  label: { marginTop: spacing.xxl, marginBottom: spacing.sm, marginLeft: spacing.xs },
  method: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  methodIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
