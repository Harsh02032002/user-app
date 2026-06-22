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
import { DeliveryMap } from '../components/common/DeliveryMap';
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
  const { user, refreshProfile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [razorpayModal, setRazorpayModal] = useState(false);
  const [razorpayHtml, setRazorpayHtml] = useState('');
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [activeSubs, setActiveSubs] = useState<any[]>([]);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Combined subscription balance from all active subscriptions
  const totalSubBalance = activeSubs.reduce((sum, s) => sum + (s.remainingBalance || 0), 0);
  
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
    fetchActiveSubs();
  }, []);

  const fetchActiveSubs = async () => {
    try {
      console.log('[Checkout] Fetching active subscriptions...');
      const response = await api.user.getActiveSubscription();
      console.log('[Checkout] Raw subscription response:', JSON.stringify(response));
      
      // Backend returns { success: true, subscriptions: [...] }
      const subs = response.subscriptions || [];
      
      console.log('[Checkout] Parsed subs count:', subs.length);
      
      const normalizedSubs = subs
        .filter((s: any) => s.status === 'active' && s.remaining_amount > 0)
        .map((s: any) => ({
          ...s,
          remainingBalance: s.remaining_amount || 0,
          remainingDays: s.remaining_days || 0,
          homeChef: s.seller_id ? {
            _id: s.seller_id._id || s.seller_id,
            shopName: s.seller_id.businessName || s.seller_name || 'Unknown',
          } : { shopName: s.seller_name || 'Unknown' }
        }));
      
      console.log('[Checkout] Normalized subs:', normalizedSubs.length, normalizedSubs.map((s: any) => ({ balance: s.remainingBalance, name: s.homeChef?.shopName })));
      setActiveSubs(normalizedSubs);
    } catch (error) {
      console.error('[Checkout] Error fetching active subs:', error);
    }
  };

  const fetchWalletBalance = React.useCallback(async () => {
    try {
      const response = await api.user.getWalletTransactions();
      setWalletBalance(response.data?.balance || 0);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }
  }, []);

  const validateAddress = () => {
    if (!deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.pincode) {
      Alert.alert('Address Required', 'Please fill in all address fields');
      return false;
    }
    return true;
  };

  const processWalletPayment = React.useCallback(async (orderId: string) => {
    try {
      await api.payment.processWalletPayment({
        orderId,
        amount: total,
      });
      
      await refreshProfile();
      clearCart();
      Alert.alert('Success', 'Order placed successfully using wallet!', [
        { text: 'OK', onPress: () => navigation.navigate('MainTabs' as any, { screen: 'Orders' }) }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Wallet payment failed');
    }
  }, [total, clearCart, navigation]);

  const processPaymentSuccess = React.useCallback(async (orderId: string, paymentId: string, razorpayOrderId?: string, razorpaySignature?: string) => {
    try {
      await api.payment.verifyPayment({
        orderId, // This is our system's orderId
        razorpayPaymentId: paymentId,
        razorpayOrderId, // Real razorpay order id from response
        razorpaySignature, // Real signature from response
      });
      
      await refreshProfile();
      clearCart();
      Alert.alert('Success', 'Order placed successfully!', [
        { text: 'OK', onPress: () => navigation.navigate('MainTabs' as any, { screen: 'Orders' }) }
      ]);
    } catch (error: any) {
      Alert.alert('Error', 'Payment verification failed: ' + (error.message || 'Unknown error'));
    }
  }, [clearCart, navigation]);

  const handleRazorpayPayment = React.useCallback(async (order: any, amount: number) => {
    try {
      if (Platform.OS === 'web') {
        setRazorpayModal(true);
        return;
      }

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
    } catch (error: any) {
      setLoading(false);
      Alert.alert('Payment Error', error.message || 'Payment initialization failed');
    }
  }, [user]);

  const handleWebViewMessage = React.useCallback(async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      setRazorpayModal(false);
      setRazorpayHtml('');
      if (data.success && data.paymentId && pendingOrderId) {
        await processPaymentSuccess(pendingOrderId, data.paymentId, data.orderId, data.signature);
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
  }, [pendingOrderId, processPaymentSuccess]);

  const handlePlaceOrder = React.useCallback(async () => {
    if (!validateAddress()) return;

    if (!selectedPayment) {
      Alert.alert('Payment Method Required', 'Please select a payment method');
      return;
    }

    if (selectedPayment.type === 'subscription') {
      const currentSub = activeSubs.find(s => s.homeChef?._id === cartItems[0]?.sellerId || s.homeChef === cartItems[0]?.sellerId);
      if (!currentSub || currentSub.remainingBalance <= 0) {
        Alert.alert('Insufficient Plan Balance', 'You do not have enough meals left in your plan with this chef.');
        return;
      }
    }

    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty');
      return;
    }

    setLoading(true);

    try {
      // Handle subscription payment
      if (selectedPayment.type === 'subscription') {
        if (totalSubBalance <= 0) {
          throw new Error('No subscription balance available');
        }

        const subAmount = Math.min(totalSubBalance, total);
        const extraAmount = total - subAmount;

        if (extraAmount > 0) {
          // Hybrid: subscription + razorpay
          const orderData = {
            items: cartItems.map(item => ({
              menuItemId: item.id,
              name: item.name,
              sellingPrice: item.discountPrice || item.price,
              quantity: item.quantity,
              image: item.image,
            })),
            sellerId: cartItems[0].sellerId,
            deliveryAddress: {
              name: deliveryAddress.name,
              phone: deliveryAddress.phone,
              street: deliveryAddress.street,
              city: deliveryAddress.city,
              state: deliveryAddress.state,
              pincode: deliveryAddress.pincode,
            },
            paymentMethod: 'hybrid',
            totalAmount: total,
            subtotal: totalAmount,
            deliveryFee,
            platformFee,
            subscriptionAmountUsed: subAmount,
            subscriptionIds: activeSubs.map(s => s._id),
          };

          const orderResponse = await api.user.placeOrder(orderData);
          await handleRazorpayPayment(orderResponse.order, extraAmount);
        } else {
          // Full subscription payment
          const subscriptionOrderData = {
            items: cartItems.map(item => ({
              menuItemId: item.id,
              name: item.name,
              price: item.discountPrice || item.price,
              quantity: item.quantity,
              image: item.image,
            })),
            deliveryAddress: {
              street: deliveryAddress.street,
              city: deliveryAddress.city,
              state: deliveryAddress.state,
              pincode: deliveryAddress.pincode,
            },
            subscriptionIds: activeSubs.map(s => s._id),
            totalAmount: total,
          };

          await api.subscriptions.placeOrderFromSubscription(subscriptionOrderData);
          await fetchActiveSubs();
          await refreshProfile();
          clearCart();
          Alert.alert(
            '🎉 Order Placed!',
            `Order placed! ₹${total} deducted from your subscription balance.`,
            [{ text: 'View Orders', onPress: () => navigation.navigate('MainTabs' as any, { screen: 'Orders' }) }]
          );
        }
        return;
      }

      // For non-subscription payments, create order normally
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
          [{ text: 'View Orders', onPress: () => navigation.navigate('MainTabs' as any, { screen: 'Orders' }) }]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  }, [cartItems, deliveryAddress, selectedPayment, total, totalAmount, payableAmount, walletBalance, clearCart, navigation, handleRazorpayPayment, processWalletPayment]);

  const processPaymentFailure = (orderId: string) => {
    Alert.alert('Payment Failed', 'Your payment was not successful. Please try again.');
  };

  const confirmOrder = async (orderId: string) => {
    // This function is kept for backward compatibility but COD now shows success directly
    clearCart();
    Alert.alert('Order Placed!', 'Your order has been placed successfully!', [
      { text: 'View Orders', onPress: () => navigation.navigate('MainTabs' as any, { screen: 'Orders' }) }
    ]);
  };

  // Handle location detection
  const handleDetectLocation = async () => {
    try {
      setIsDetectingLocation(true);
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsDetectingLocation(false);
        Alert.alert('Permission Denied', 'Please allow location access to use this feature.');
        return;
      }

      // Get current location - Try last known first for speed
      let location = await Location.getLastKnownPositionAsync({});
      
      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }
      
      const { latitude, longitude } = location.coords;
      setUserLocation([longitude, latitude]);

      // Use expo-location's built-in reverse geocoding (faster and more reliable)
      const addressResult = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });

      if (addressResult && addressResult.length > 0) {
        const addr = addressResult[0];
        
        // Filter out Plus Codes (like FXHR+Q3) from street address
        let streetName = addr.name || addr.street || addr.district || '';
        if (streetName.includes('+') && streetName.length <= 8) {
          streetName = addr.street || addr.district || addr.subregion || '';
        }

        setDeliveryAddress(prev => ({
          ...prev,
          street: streetName,
          city: addr.city || addr.subregion || '',
          state: addr.region || '',
          pincode: addr.postalCode || '',
        }));
        Alert.alert('📍 Location Detected', `Address auto-filled successfully!`);
      } else {
        // Fallback to nominatim if expo fails
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
        );
        const data = await response.json();
        if (data && data.address) {
          let streetName = data.address.road || data.address.house_number || data.address.suburb || '';
          // Avoid plus codes or very short codes
          if (streetName.includes('+') && streetName.length <= 8) {
            streetName = data.address.suburb || data.address.neighbourhood || '';
          }

          setDeliveryAddress(prev => ({
            ...prev,
            street: streetName,
            city: data.address.city || data.address.town || data.address.village || '',
            state: data.address.state || '',
            pincode: data.address.postcode || '',
          }));
          Alert.alert('📍 Location Detected', `Address auto-filled successfully!`);
        }
      }
    } catch (error) {
      console.error('Location detection failed:', error);
      Alert.alert('Error', 'Could not detect location. Please enter manually.');
    } finally {
      setIsDetectingLocation(false);
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

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Delivery Address Section */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="location-outline" size={20} color="#FF6B00" />
            <Text style={styles.sectionTitle}>Delivery Address</Text>
          </View>
          
          {/* Location Detection Button */}
          <TouchableOpacity 
            style={[styles.locationButton, isDetectingLocation && styles.locationButtonDisabled]} 
            onPress={handleDetectLocation}
            disabled={isDetectingLocation}
          >
            {isDetectingLocation ? (
              <ActivityIndicator size={16} color="#FF6B00" />
            ) : (
              <Ionicons name="location" size={16} color="#FF6B00" />
            )}
            <Text style={styles.locationButtonText}>
              {isDetectingLocation ? '📍 Detecting location...' : '📍 Detect My Current Location'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.locationHint}>Click to auto-fill your address using GPS location</Text>
          
          {userLocation && (
            <DeliveryMap userCoords={userLocation} height={180} />
          )}
          
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
          
          {/* Subscription Balance - Show if user has ANY active subscription */}
          {activeSubs.length > 0 && totalSubBalance > 0 && (
            <TouchableOpacity
              style={[styles.paymentMethod, selectedPayment?.type === 'subscription' && styles.selectedPayment]}
              onPress={() => setSelectedPayment({ id: 'subscription', name: 'Pay from Subscription Balance', icon: 'star', type: 'subscription' })}
            >
              <View style={[styles.paymentIconContainer, { backgroundColor: '#6366f1' }]}>
                <Ionicons name="star" size={20} color="#fff" />
              </View>
              <View style={styles.paymentDetails}>
                <Text style={styles.paymentName}>Subscription Balance</Text>
                <Text style={styles.paymentDescription}>
                  Total Available: ₹{totalSubBalance.toLocaleString('en-IN')}
                  {activeSubs.length > 1 ? ` (${activeSubs.length} plans combined)` : ''}
                </Text>
                {totalSubBalance < total && (
                  <Text style={[styles.paymentDescription, { color: '#FF6B00' }]}>
                    ₹{(total - totalSubBalance).toLocaleString('en-IN')} extra will be charged online
                  </Text>
                )}
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

          {/* Subscription Info */}
          {selectedPayment?.type === 'subscription' && (
            <View style={styles.walletInfoCard}>
              {activeSubs.length > 1 && (
                <View style={styles.subBreakdownHeader}>
                  <Text style={styles.subBreakdownTitle}>Your Subscription Plans</Text>
                  {activeSubs.map((s, i) => (
                    <View key={i} style={styles.subBreakdownRow}>
                      <Text style={styles.subBreakdownName}>
                        {s.homeChef?.shopName || s.homeChef?.businessName || `Plan ${i + 1}`}
                      </Text>
                      <Text style={styles.subBreakdownAmount}>
                        ₹{(s.remainingBalance || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.subDivider} />
                </View>
              )}
              <View style={styles.walletInfoRow}>
                <Text style={styles.walletInfoLabel}>Total Sub Balance</Text>
                <Text style={[styles.walletInfoValue, { color: '#6366f1' }]}>₹{totalSubBalance.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.walletInfoRow}>
                <Text style={styles.walletInfoLabel}>Order Total</Text>
                <Text style={styles.walletInfoValue}>₹{total.toLocaleString('en-IN')}</Text>
              </View>
              {totalSubBalance >= total ? (
                <View style={styles.walletInfoRow}>
                  <Text style={styles.walletInfoLabel}>Remaining After Order</Text>
                  <Text style={[styles.walletInfoValue, { color: '#22c55e' }]}>₹{(totalSubBalance - total).toLocaleString('en-IN')}</Text>
                </View>
              ) : (
                <View style={[styles.walletInfoRow, { backgroundColor: '#fff5f0', padding: 8, borderRadius: 8, marginTop: 4 }]}>
                  <Text style={[styles.walletInfoLabel, { color: '#FF6B00' }]}>Extra to Pay Online</Text>
                  <Text style={[styles.walletInfoValue, { color: '#FF6B00' }]}>₹{(total - totalSubBalance).toLocaleString('en-IN')}</Text>
                </View>
              )}
              <Text style={styles.subscriptionNote}>
                {totalSubBalance >= total 
                  ? '✅ Full amount covered by subscription balance'
                  : `⚡ ₹${totalSubBalance} from subscription + ₹${total - totalSubBalance} via Razorpay`
                }
              </Text>
            </View>
          )}
          
        </View>
      </ScrollView>

      {/* Fixed Bottom Payment Bar */}
      <View style={styles.fixedBottomContainer}>
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
                  {selectedPayment?.type === 'subscription'
                    ? totalSubBalance >= total
                      ? `Pay ₹${total} from Subscription`
                      : `Pay ₹${totalSubBalance} Sub + ₹${total - totalSubBalance} Online`
                    : selectedPayment?.type === 'wallet' ? `Pay ₹${payableAmount} from Wallet`
                    : selectedPayment?.type === 'cod' ? 'Place Order (COD)'
                    : `Pay ₹${payableAmount}`}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
          
          <Text style={styles.paymentNote}>
            {selectedPayment?.type === 'subscription' ? 'Using your subscription balance. Days will be deducted.' :
             selectedPayment?.type === 'wallet' ? 'Instant payment from your wallet' :
             selectedPayment?.type === 'cod' ? 'Pay cash when your order is delivered' :
             'Secure online payment via Razorpay'}
          </Text>
      </View>

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
  subscriptionNote: {
    fontSize: 12,
    color: '#FF6B00',
    marginTop: 8,
    fontStyle: 'italic',
  },
  subBreakdownHeader: {
    marginBottom: 8,
  },
  subBreakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 6,
  },
  subBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  subBreakdownName: {
    fontSize: 12,
    color: '#666',
  },
  subBreakdownAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },
  subDivider: {
    height: 1,
    backgroundColor: '#e5e5e5',
    marginVertical: 8,
  },
  payButton: {
    backgroundColor: '#FF6B00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 10,
    gap: 10,
  },
  locationButtonDisabled: {
    opacity: 0.7,
    backgroundColor: '#f0f0f0',
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
  fixedBottomContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 8 },
      web: { boxShadow: '0px -4px 8px rgba(0,0,0,0.08)' },
    }),
  },
});