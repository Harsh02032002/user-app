import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { AppHeader } from '../components/common/AppHeader';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
// WebView is only available on native platforms
const WebViewComponent = Platform.OS !== 'web' ? require('react-native-webview').WebView : null;

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  type: 'razorpay' | 'wallet' | 'cod' | 'subscription';
}

interface Address {
  id: string;
  name: string;
  phone: string;
  address: string;
  landmark?: string;
  city: string;
  pincode: string;
  isDefault: boolean;
}

export function CheckoutScreen() {
  const navigation = useNavigation();
  const { items: cartItems, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [razorpayModal, setRazorpayModal] = useState(false);
  const [razorpayHtml, setRazorpayHtml] = useState('');
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  
  // Delivery address form - directly entered, not saved separately
  const [deliveryAddress, setDeliveryAddress] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    street: '',
    city: '',
    state: '',
    pincode: '',
  });

  const deliveryFee = 30;
  const platformFee = 5;
  const gst = Math.round((totalAmount + deliveryFee + platformFee) * 0.05);
  const total = totalAmount + deliveryFee + platformFee + gst;
  const walletAmount = useWallet ? Math.min(walletBalance, total) : 0;
  const payableAmount = total - walletAmount;

  const paymentMethods: PaymentMethod[] = [
    { id: 'razorpay', name: 'Pay Online (Cards, UPI, NetBanking)', icon: 'card-outline', type: 'razorpay' },
    { id: 'wallet', name: `Wallet (₹${walletBalance})`, icon: 'wallet-outline', type: 'wallet' },
    { id: 'cod', name: 'Cash on Delivery', icon: 'cash-outline', type: 'cod' },
  ];

  useEffect(() => {
    fetchWalletBalance();
  }, []);

  const fetchWalletBalance = async () => {
    try {
      const response = await api.user.getWalletTransactions();
      setWalletBalance(response.data?.balance || 0);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }
  };

  const validateAddress = () => {
    if (!deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.pincode) {
      Alert.alert('Address Required', 'Please fill in all address fields');
      return false;
    }
    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateAddress()) return;

    if (!selectedPayment) {
      Alert.alert('Payment Method Required', 'Please select a payment method');
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty');
      return;
    }

    setLoading(true);

    try {
      // Create order with delivery address correctly mapped for backend
      const orderData = {
        items: cartItems.map(item => ({
          menuItemId: item.id,
          name: item.name,
          sellingPrice: item.discountPrice || item.price,
          quantity: item.quantity,
          image: item.image,
        })),
        sellerId: cartItems.length > 0 ? cartItems[0].sellerId : '',
        deliveryAddress: {
          name: deliveryAddress.name,
          phone: deliveryAddress.phone,
          street: deliveryAddress.street,
          city: deliveryAddress.city,
          state: deliveryAddress.state,
          pincode: deliveryAddress.pincode,
        },
        paymentMethod: selectedPayment.type,
        totalAmount: total,
        subtotal: totalAmount,
        deliveryFee: deliveryFee,
        platformFee: platformFee,
      };

      const orderResponse = await api.user.placeOrder(orderData);
      
      if (selectedPayment.type === 'razorpay' && payableAmount > 0) {
        // Initialize Razorpay payment
        await handleRazorpayPayment(orderResponse.order, payableAmount);
      } else if (selectedPayment.type === 'wallet' && walletBalance >= total) {
        // Wallet payment
        await processWalletPayment(orderResponse.order._id);
      } else {
        // COD placed successfully - show success directly
        clearCart();
        Alert.alert(
          '🎉 Order Placed!',
          `Your order #${orderResponse.order?.orderNumber || ''} has been placed successfully! You will pay ₹${total} on delivery.`,
          [{ text: 'View Orders', onPress: () => navigation.navigate('Orders' as never) }]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const handleRazorpayPayment = async (order: any, amount: number) => {
    try {
      setLoading(true);
      
      // Create Razorpay order on backend - send rupees, backend handles paise conversion
      const razorpayResponse = await api.payment.createRazorpayOrder({
        amount: amount, // Send in rupees - backend multiplies by 100
        orderId: order._id,
      });

      setLoading(false);
      setPendingOrderId(order._id);

      // Build Razorpay checkout HTML to embed in WebView
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
    description: 'Order #${order.orderNumber || ''}',
    prefill: {
      name: '${user?.name || ''}',
      email: '${user?.email || ''}',
      contact: '${user?.phone || ''}'
    },
    theme: { color: '#FF6B00' },
    handler: function(response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ success: true, paymentId: response.razorpay_payment_id }));
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
    } catch (error: any) {
      setLoading(false);
      Alert.alert('Payment Error', error.message || 'Payment initialization failed');
    }
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      setRazorpayModal(false);
      setRazorpayHtml('');
      if (data.success && data.paymentId && pendingOrderId) {
        await processPaymentSuccess(pendingOrderId, data.paymentId);
      } else if (data.cancelled) {
        Alert.alert('Cancelled', 'Payment was cancelled. Your order has been saved.');
      } else {
        Alert.alert('Payment Failed', data.error || 'Payment failed. Please try again.');
      }
    } catch (e) {
      console.error('WebView message error:', e);
    } finally {
      setPendingOrderId(null);
    }
  };

  const processWalletPayment = async (orderId: string) => {
    try {
      await api.payment.processWalletPayment({
        orderId,
        amount: total,
      });
      
      clearCart();
      Alert.alert('Success', 'Order placed successfully using wallet!', [
        { text: 'OK', onPress: () => navigation.navigate('Orders' as never) }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Wallet payment failed');
    }
  };

  const processPaymentSuccess = async (orderId: string, paymentId: string) => {
    try {
      await api.payment.verifyPayment({
        orderId,
        paymentId,
        razorpaySignature: 'simulated_signature',
      });
      
      clearCart();
      Alert.alert('Success', 'Order placed successfully!', [
        { text: 'OK', onPress: () => navigation.navigate('Orders' as never) }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Payment verification failed');
    }
  };

  const processPaymentFailure = (orderId: string) => {
    Alert.alert('Payment Failed', 'Your payment was not successful. Please try again.');
  };

  const confirmOrder = async (orderId: string) => {
    // This function is kept for backward compatibility but COD now shows success directly
    clearCart();
    Alert.alert('Order Placed!', 'Your order has been placed successfully!', [
      { text: 'View Orders', onPress: () => navigation.navigate('Orders' as never) }
    ]);
  };

  // Handle location detection
  const handleDetectLocation = async () => {
    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow location access to use this feature.');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );
      const data = await response.json();

      if (data && data.address) {
        setDeliveryAddress(prev => ({
          ...prev,
          street: data.address.road || data.address.house_number || '',
          city: data.address.city || data.address.town || data.address.village || '',
          state: data.address.state || '',
          pincode: data.address.postcode || '',
        }));
        Alert.alert('📍 Location Detected', `Address auto-filled: ${data.address.city || 'Unknown'}`);
      }
    } catch (error) {
      console.error('Location detection failed:', error);
      Alert.alert('Error', 'Could not detect location. Please enter manually.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showSearch={false} />
      
      <View style={styles.headerSection}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Checkout</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Delivery Address Section */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="location-outline" size={20} color="#FF6B00" />
            <Text style={styles.sectionTitle}>Delivery Address</Text>
          </View>
          
          {/* Location Detection Button */}
          <TouchableOpacity style={styles.locationButton} onPress={handleDetectLocation}>
            <Ionicons name="location" size={16} color="#FF6B00" />
            <Text style={styles.locationButtonText}>📍 Detect My Current Location</Text>
          </TouchableOpacity>
          <Text style={styles.locationHint}>Click to auto-fill your address using GPS location</Text>
          
          {/* Address Form Inputs - Direct entry like website */}
          <View style={styles.addressForm}>
            <Text style={styles.formLabel}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              value={deliveryAddress.name}
              onChangeText={(text) => setDeliveryAddress({...deliveryAddress, name: text})}
            />
            
            <Text style={styles.formLabel}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
              value={deliveryAddress.phone}
              onChangeText={(text) => setDeliveryAddress({...deliveryAddress, phone: text})}
            />
            
            <Text style={styles.formLabel}>Street Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="House no., Building, Street"
              value={deliveryAddress.street}
              onChangeText={(text) => setDeliveryAddress({...deliveryAddress, street: text})}
            />
            
            <Text style={styles.formLabel}>City *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter city"
              value={deliveryAddress.city}
              onChangeText={(text) => setDeliveryAddress({...deliveryAddress, city: text})}
            />
            
            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Text style={styles.formLabel}>State</Text>
                <TextInput
                  style={styles.input}
                  placeholder="State"
                  value={deliveryAddress.state}
                  onChangeText={(text) => setDeliveryAddress({...deliveryAddress, state: text})}
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.formLabel}>Pincode *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Pincode"
                  keyboardType="number-pad"
                  value={deliveryAddress.pincode}
                  onChangeText={(text) => setDeliveryAddress({...deliveryAddress, pincode: text})}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Payment Methods Section */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="card-outline" size={20} color="#FF6B00" />
            <Text style={styles.sectionTitle}>Payment Method</Text>
          </View>
          
          {/* Subscription - Show first if available */}
          {walletBalance > 0 && (
            <TouchableOpacity
              style={[styles.paymentMethod, selectedPayment?.type === 'subscription' && styles.selectedPayment]}
              onPress={() => setSelectedPayment({ id: 'subscription', name: 'Pay from My Plan', icon: 'star', type: 'subscription' })}
            >
              <View style={styles.paymentIconContainer}>
                <Ionicons name="star" size={20} color="#fff" />
              </View>
              <View style={styles.paymentDetails}>
                <Text style={styles.paymentName}>Pay from My Plan</Text>
                <Text style={styles.paymentDescription}>Using subscription balance</Text>
              </View>
              {selectedPayment?.type === 'subscription' && (
                <Ionicons name="checkmark-circle" size={20} color="#FF6B00" />
              )}
            </TouchableOpacity>
          )}
          
          {/* Wallet */}
          <TouchableOpacity
            style={[styles.paymentMethod, selectedPayment?.type === 'wallet' && styles.selectedPayment, walletBalance === 0 && styles.disabledPayment]}
            onPress={() => walletBalance > 0 && setSelectedPayment({ id: 'wallet', name: 'Wallet', icon: 'wallet', type: 'wallet' })}
            disabled={walletBalance === 0}
          >
            <View style={[styles.paymentIconContainer, { backgroundColor: '#22c55e' }]}>
              <Ionicons name="wallet" size={20} color="#fff" />
            </View>
            <View style={styles.paymentDetails}>
              <View style={styles.paymentNameRow}>
                <Text style={styles.paymentName}>Wallet</Text>
                <Text style={[styles.walletBalance, walletBalance === 0 && styles.insufficientBalance]}>
                  ₹{walletBalance.toLocaleString()}
                </Text>
              </View>
              <Text style={styles.paymentDescription}>
                {walletBalance === 0 ? 'Insufficient balance' : 'Pay instantly from your wallet balance'}
              </Text>
            </View>
            {selectedPayment?.type === 'wallet' && (
              <Ionicons name="checkmark-circle" size={20} color="#FF6B00" />
            )}
          </TouchableOpacity>
          
          {/* Razorpay */}
          <TouchableOpacity
            style={[styles.paymentMethod, selectedPayment?.type === 'razorpay' && styles.selectedPayment]}
            onPress={() => setSelectedPayment({ id: 'razorpay', name: 'Razorpay', icon: 'card', type: 'razorpay' })}
          >
            <View style={[styles.paymentIconContainer, { backgroundColor: '#FF6B00' }]}>
              <Ionicons name="card" size={20} color="#fff" />
            </View>
            <View style={styles.paymentDetails}>
              <Text style={styles.paymentName}>Razorpay</Text>
              <Text style={styles.paymentDescription}>UPI • Cards • Netbanking • Wallets</Text>
            </View>
            {selectedPayment?.type === 'razorpay' && (
              <Ionicons name="checkmark-circle" size={20} color="#FF6B00" />
            )}
          </TouchableOpacity>
          
          {/* COD */}
          <TouchableOpacity
            style={[styles.paymentMethod, selectedPayment?.type === 'cod' && styles.selectedPayment]}
            onPress={() => setSelectedPayment({ id: 'cod', name: 'Cash on Delivery', icon: 'cash', type: 'cod' })}
          >
            <View style={[styles.paymentIconContainer, { backgroundColor: '#22c55e' }]}>
              <Ionicons name="cash" size={20} color="#fff" />
            </View>
            <View style={styles.paymentDetails}>
              <Text style={styles.paymentName}>Cash on Delivery</Text>
              <Text style={styles.paymentDescription}>Pay when your order arrives</Text>
            </View>
            {selectedPayment?.type === 'cod' && (
              <Ionicons name="checkmark-circle" size={20} color="#FF6B00" />
            )}
          </TouchableOpacity>
        </View>

        {/* Order Summary Section */}
        <View style={[styles.section, styles.orderSummarySection]}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          
          {/* Cart Items */}
          <View style={styles.cartItemsContainer}>
            {cartItems.map(item => (
              <View key={item.id} style={styles.orderItem}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>₹{(item.discountPrice || item.price) * item.quantity}</Text>
              </View>
            ))}
          </View>
          
          <View style={styles.divider} />
          
          {/* Bill Breakdown */}
          <View style={styles.billBreakdown}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Subtotal</Text>
              <Text style={styles.billValue}>₹{totalAmount}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>GST (5%)</Text>
              <Text style={styles.billValue}>₹{gst}</Text>
            </View>
            <View style={[styles.billRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>You pay</Text>
              <Text style={styles.totalValue}>₹{payableAmount}</Text>
            </View>
          </View>
          
          {/* Wallet Info */}
          {selectedPayment?.type === 'wallet' && (
            <View style={styles.walletInfoCard}>
              <View style={styles.walletInfoRow}>
                <Text style={styles.walletInfoLabel}>Wallet Balance</Text>
                <Text style={styles.walletInfoValue}>₹{walletBalance.toLocaleString()}</Text>
              </View>
              <View style={styles.walletInfoRow}>
                <Text style={styles.walletInfoLabel}>After Payment</Text>
                <Text style={styles.walletInfoValue}>₹{(walletBalance - payableAmount).toFixed(0)}</Text>
              </View>
            </View>
          )}
          
          {/* Pay Button */}
          <TouchableOpacity 
            style={[styles.payButton, loading && styles.buttonDisabled]} 
            onPress={handlePlaceOrder}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.payButtonText}>
                  {selectedPayment?.type === 'subscription' ? 'Pay from My Plan' :
                   selectedPayment?.type === 'wallet' ? `Pay ₹${payableAmount} from Wallet` :
                   selectedPayment?.type === 'cod' ? 'Place Order (COD)' :
                   `Pay ₹${payableAmount}`}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
          
          {/* Payment Note */}
          <Text style={styles.paymentNote}>
            {selectedPayment?.type === 'subscription' ? 'Using your subscription balance. Days will be deducted.' :
             selectedPayment?.type === 'wallet' ? 'Instant payment from your wallet' :
             selectedPayment?.type === 'cod' ? 'Pay cash when your order is delivered' :
             'Secure online payment via Razorpay'}
          </Text>
        </View>
      </ScrollView>

      {/* Razorpay WebView Modal */}
      <Modal
        visible={razorpayModal}
        animationType="slide"
        onRequestClose={() => {
          setRazorpayModal(false);
          Alert.alert('Cancelled', 'Payment was cancelled. Your order has been saved.');
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
            <TouchableOpacity onPress={() => { setRazorpayModal(false); Alert.alert('Cancelled', 'Payment was cancelled.'); }} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '600', marginLeft: 8 }}>Secure Payment</Text>
          </View>
          {Platform.OS === 'web' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Ionicons name="phone-portrait-outline" size={64} color="#FF6B00" />
              <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>Open on Mobile App</Text>
              <Text style={{ fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' }}>
                Razorpay payment works on the mobile app. Please scan the QR code in Expo Go on your phone to test payments.
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2E8',
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  orderSummarySection: {
    marginBottom: 24,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    gap: 8,
    backgroundColor: '#fafafa',
  },
  locationButtonText: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  locationHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  addressCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B00',
  },
  addressName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  addressPhone: {
    fontSize: 14,
    color: '#666',
    marginVertical: 2,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#FF6B00',
    borderRadius: 8,
    borderStyle: 'dashed',
    gap: 8,
  },
  addAddressText: {
    fontSize: 16,
    color: '#FF6B00',
    fontWeight: '600',
  },
  changeAddressButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff5f0',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  changeAddressText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '500',
  },
  addressForm: {
    marginTop: 8,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  saveAddressButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveAddressText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  selectedPayment: {
    borderColor: '#FF6B00',
    backgroundColor: '#fff5f0',
  },
  disabledPayment: {
    opacity: 0.6,
  },
  paymentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentDetails: {
    flex: 1,
  },
  paymentNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  walletBalance: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  insufficientBalance: {
    color: '#ef4444',
  },
  paymentDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  cartItemsContainer: {
    marginBottom: 12,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    fontSize: 14,
    color: '#666',
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e5e5',
    marginVertical: 12,
  },
  billBreakdown: {
    marginBottom: 12,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  billLabel: {
    fontSize: 14,
    color: '#666',
  },
  billValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  walletInfoCard: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  walletInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  walletInfoLabel: {
    fontSize: 14,
    color: '#666',
  },
  walletInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  payButton: {
    backgroundColor: '#FF6B00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  buttonDisabled: {
    backgroundColor: '#FFB380',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  paymentNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
});