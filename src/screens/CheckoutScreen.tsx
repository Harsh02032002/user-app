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
import { useCart, getCartUnitPrice } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { DeliveryMap } from '../components/common/DeliveryMap';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCATION_COORDS_KEY, LOCATION_NAME_KEY } from '../utils/location';
import { OnlinePaymentModal } from '../components/OnlinePaymentModal';
import { SERVICE_RADIUS_KM } from '../config/serviceArea';
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
  const navigation = useNavigation<any>();
  const { items: cartItems, totalAmount, clearCart } = useCart();
  const { user, refreshProfile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = React.useRef(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>({
    id: 'cod',
    name: 'Cash on Delivery',
    icon: 'cash',
    type: 'cod',
  });
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [razorpayModal, setRazorpayModal] = useState(false);
  const [razorpayHtml, setRazorpayHtml] = useState('');
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [activeSubs, setActiveSubs] = useState<any[]>([]);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [successOrderData, setSuccessOrderData] = useState<{
    orderNumber: string;
    total: number;
    paymentMethodName: string;
  } | null>(null);

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

  const [gstSettings, setGstSettings] = useState<any>(null);
  const [platformConfig, setPlatformConfig] = useState<any>(null);

  // Distance-based delivery pricing state
  const [deliveryPricing, setDeliveryPricing] = useState<{
    distanceKm: number;
    customerFee: number;
    serviceable: boolean;
  } | null>(null);
  const [isFetchingDeliveryFee, setIsFetchingDeliveryFee] = useState(false);

  useEffect(() => {
    fetchWalletBalance();
    fetchActiveSubs();
    fetchSettings();

    const loadSavedLocation = async () => {
      try {
        const savedCoords = await AsyncStorage.getItem(LOCATION_COORDS_KEY);
        const savedName = await AsyncStorage.getItem(LOCATION_NAME_KEY);
        if (savedCoords) {
          const parsed = JSON.parse(savedCoords);
          if (parsed && !isNaN(parsed.lat) && !isNaN(parsed.lng)) {
            setUserLocation([parsed.lng, parsed.lat]);
            setDeliveryAddress(prev => ({
              ...prev,
              // Only prefill what we actually know; the customer completes the rest
              street: prev.street || '',
              city: prev.city || '',
              state: prev.state || '',
              pincode: prev.pincode || '',
            }));

            const sellerId = cartItems.length > 0 ? (typeof cartItems[0].sellerId === 'object' ? (cartItems[0].sellerId as any)?._id : cartItems[0].sellerId) : null;
            if (sellerId) {
              api.user.calculateDeliveryFee({
                sellerId,
                customerLng: parsed.lng,
                customerLat: parsed.lat,
              }).then(feeRes => {
                if (feeRes?.success) {
                  setDeliveryPricing({
                    distanceKm: feeRes.distanceKm,
                    customerFee: feeRes.customerFee ?? 30,
                    serviceable: feeRes.serviceable,
                  });
                }
              }).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.log('[Checkout] Error loading saved location:', err);
      }
    };
    loadSavedLocation();
  }, []);

  const fetchSettings = async () => {
    try {
      const [gstRes, platRes] = await Promise.all([
        api.user.getGSTSettings(),
        api.user.getPlatformConfig(),
      ]);
      if (gstRes?.data) setGstSettings(gstRes.data);
      if (platRes?.data) setPlatformConfig(platRes.data);
    } catch (e) {
      console.log('[Checkout] Error fetching settings:', e);
    }
  };

  const foodGstEnabled = gstSettings?.foodGSTEnabled ?? false;
  const foodGstRate = foodGstEnabled
    ? ((Number(gstSettings?.foodCGSTRate) || 0) + (Number(gstSettings?.foodSGSTRate) || 0))
    : 0;

  const cgstRate = foodGstEnabled ? (Number(gstSettings?.foodCGSTRate) || 0) : 0;
  const sgstRate = foodGstEnabled ? (Number(gstSettings?.foodSGSTRate) || 0) : 0;

  // Delivery fee: use distance-based pricing if available, else fall back to platform config
  const deliveryFee = deliveryPricing
    ? (deliveryPricing.serviceable ? deliveryPricing.customerFee : 0)
    : (platformConfig?.deliveryFee != null ? Number(platformConfig.deliveryFee) : 30);
  const platformFee = platformConfig?.platformFee != null ? Number(platformConfig.platformFee) : 0;
  
  const totalGst = foodGstEnabled ? (totalAmount * (foodGstRate / 100)) : 0;
  const cgstAmount = foodGstEnabled ? (totalAmount * (cgstRate / 100)) : 0;
  const sgstAmount = foodGstEnabled ? (totalAmount * (sgstRate / 100)) : 0;

  // Authoritative totals from the backend (items, distance-based delivery fee, GST) — the same
  // pricing used when the order is placed. The local figures above are only a loading fallback.
  const [serverQuote, setServerQuote] = useState<{ subtotal: number; deliveryFee: number; taxTotal: number; grandTotal: number; distanceKm: number } | null>(null);
  const [quoteProblem, setQuoteProblem] = useState<string | null>(null);
  const quoteSellerId = cartItems.find(i => !!i.sellerId)?.sellerId;
  const quoteKey = JSON.stringify(cartItems.map(i => [i.id, i.quantity]));
  useEffect(() => {
    if (!quoteSellerId || !userLocation || cartItems.length === 0) return;
    let alive = true;
    api.user.quoteOrder({
      sellerId: typeof quoteSellerId === 'object' ? (quoteSellerId as any)?._id : quoteSellerId,
      items: cartItems.map(i => ({ menuItemId: i.id, quantity: i.quantity })),
      deliveryAddress: { state: deliveryAddress.state, location: { type: 'Point', coordinates: [userLocation[0], userLocation[1]] } },
    })
      .then((res: any) => { if (alive) { setServerQuote(res?.quote || null); setQuoteProblem(null); } })
      .catch((e: any) => { if (alive) { setServerQuote(null); setQuoteProblem(e?.message || null); } });
    return () => { alive = false; };
  }, [quoteSellerId, quoteKey, userLocation?.[0], userLocation?.[1], deliveryAddress.state]);

  // Platform fee is recorded for settlement only and never added to what the customer pays
  const total = serverQuote?.grandTotal ?? (totalAmount + totalGst + deliveryFee);
  const walletAmount = useWallet ? Math.min(walletBalance, total) : 0;
  const payableAmount = total - walletAmount;

  const paymentMethods: PaymentMethod[] = [
    // { id: 'razorpay', name: 'Pay Online (Cards, UPI, NetBanking)', icon: 'card-outline', type: 'razorpay' },
    { id: 'wallet', name: `Wallet (₹${walletBalance})`, icon: 'wallet-outline', type: 'wallet' },
    { id: 'cod', name: 'Cash on Delivery', icon: 'cash-outline', type: 'cod' },
  ];

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
    if (!deliveryAddress.street?.trim() || !deliveryAddress.city?.trim() || !deliveryAddress.pincode?.trim()) {
      Alert.alert('Address Incomplete', 'Please enter your street address, city, and pincode');
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
      setPendingOrderId(order._id);
      setRazorpayModal(true);
    } catch (error: any) {
      Alert.alert('Payment Error', error.message || 'Payment initialization failed');
    }
  }, []);

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
    if (isSubmittingRef.current || loading) {
      return;
    }

    if (!validateAddress()) {
      return;
    }

    if (!selectedPayment) {
      Alert.alert('Payment Method Required', 'Please select a payment method');
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty');
      return;
    }

    // Block if location confirmed not serviceable (>SERVICE_RADIUS_KM)
    if (deliveryPricing && !deliveryPricing.serviceable) {
      Alert.alert(
        'Order Not Serviceable',
        `Your location is ${deliveryPricing.distanceKm} km away. We deliver only up to ${SERVICE_RADIUS_KM} km from the restaurant.`
      );
      return;
    }

    // Direct Online Payment (UPI QR Code Modal)
    if (selectedPayment.type === 'razorpay') {
      setRazorpayModal(true);
      return;
    }

    isSubmittingRef.current = true;
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
          setRazorpayModal(true);
        } else {
          // Full subscription payment
          const subscriptionOrderData = {
            items: cartItems.map(item => ({
              menuItemId: item.id,
              name: item.name,
              price: getCartUnitPrice(item),
              quantity: item.quantity,
              image: item.image,
            })),
            deliveryAddress: {
              street: deliveryAddress.street?.trim() || '',
              city: deliveryAddress.city?.trim() || 'Chandigarh',
              state: deliveryAddress.state?.trim() || 'Chandigarh',
              pincode: deliveryAddress.pincode?.trim() || '',
              fullAddress: `${deliveryAddress.street?.trim() || ''}, ${deliveryAddress.city?.trim() || 'Chandigarh'}, ${deliveryAddress.pincode?.trim() || ''}`.replace(/^, |, $/, ''),
            },
            subscriptionIds: activeSubs.map(s => s._id),
            totalAmount: total,
          };

          await api.subscriptions.placeOrderFromSubscription(subscriptionOrderData);
          await fetchActiveSubs();
          await refreshProfile();
          clearCart();
          Alert.alert(
            'Order Placed',
            `Order placed! ₹${total} deducted from your subscription balance.`,
            [{ text: 'View Orders', onPress: () => navigation.navigate('MainTabs' as any, { screen: 'Orders' }) }]
          );
        }
        return;
      }

      // For non-subscription payments (COD / Wallet), create order normally
      const resolvedSellerId = cartItems.find(i => !!i.sellerId)?.sellerId ||
        (cartItems.length > 0 ? (typeof cartItems[0].sellerId === 'object' ? (cartItems[0].sellerId as any)?._id : cartItems[0].sellerId) : '') || '';

      const orderData = {
        items: cartItems.map(item => ({
          menuItemId: item.id,
          name: item.name,
          sellingPrice: getCartUnitPrice(item),
          quantity: item.quantity,
          image: item.image,
        })),
        sellerId: resolvedSellerId,
        deliveryAddress: {
          name: deliveryAddress.name || user?.name || 'Customer',
          phone: deliveryAddress.phone || user?.phone || '9876543210',
          street: deliveryAddress.street?.trim() || '',
          city: deliveryAddress.city?.trim() || 'Chandigarh',
          state: deliveryAddress.state?.trim() || 'Chandigarh',
          pincode: deliveryAddress.pincode?.trim() || '',
          fullAddress: `${deliveryAddress.street?.trim() || ''}, ${deliveryAddress.city?.trim() || 'Chandigarh'}, ${deliveryAddress.pincode?.trim() || ''}`.replace(/^, |, $/, ''),
          location: userLocation ? { type: 'Point', coordinates: [userLocation[0], userLocation[1]] } : undefined,
        },
        paymentMethod: selectedPayment.type,
        totalAmount: total,
        subtotal: totalAmount,
        deliveryFee: deliveryFee,
        platformFee: platformFee,
      };

      const orderResponse = await api.user.placeOrder(orderData);
      
      if (selectedPayment.type === 'wallet' && walletBalance >= total) {
        await processWalletPayment(orderResponse.order._id);
      } else {
        // COD placed successfully - show success popup modal
        clearCart();
        setSuccessOrderData({
          orderNumber: orderResponse.order?.orderNumber || 'DN-ORDER',
          total: total,
          paymentMethodName: selectedPayment?.name || 'Cash on Delivery',
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to place order');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  }, [cartItems, deliveryAddress, selectedPayment, total, totalAmount, walletBalance, clearCart, navigation, processWalletPayment, user, deliveryPricing, userLocation, loading]);

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

        // ── Calculate distance-based delivery fee ──────────────────────
        const sellerId = cartItems.length > 0 ? cartItems[0].sellerId : null;
        if (sellerId && longitude != null && latitude != null) {
          try {
            setIsFetchingDeliveryFee(true);
            const feeRes = await api.user.calculateDeliveryFee({
              sellerId,
              customerLng: longitude,
              customerLat: latitude,
            });
            if (feeRes?.success) {
              setDeliveryPricing({
                distanceKm: feeRes.distanceKm,
                customerFee: feeRes.customerFee ?? 30,
                serviceable: feeRes.serviceable,
              });
              if (!feeRes.serviceable) {
                Alert.alert(
                  'Not Serviceable',
                  `Your location is ${feeRes.distanceKm} km from the restaurant. We currently deliver only up to ${SERVICE_RADIUS_KM} km.`
                );
              } else {
                Alert.alert('Location Detected', `Address auto-filled! Delivery: ₹${feeRes.customerFee} (${feeRes.distanceKm} km)`);
              }
            } else {
              Alert.alert('Location Detected', `Address auto-filled successfully!`);
            }
          } catch (feeErr) {
            console.log('[Checkout] Fee calc error:', feeErr);
            Alert.alert('Location Detected', `Address auto-filled successfully!`);
          } finally {
            setIsFetchingDeliveryFee(false);
          }
        } else {
          Alert.alert('Location Detected', `Address auto-filled successfully!`);
        }
        // ────────────────────────────────────────────────────────────────
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
          Alert.alert('Location Detected', `Address auto-filled successfully!`);
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
        contentContainerStyle={{ paddingBottom: 24 }}
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
              {isDetectingLocation ? 'Detecting location...' : 'Detect My Current Location'}
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
          
          {/* Online Payment (Razorpay / UPI QR Code) - Commented out for now
          <TouchableOpacity
            style={[styles.paymentMethod, selectedPayment?.type === 'razorpay' && styles.selectedPayment]}
            onPress={() => setSelectedPayment({ id: 'razorpay', name: 'Online Payment', icon: 'qr-code', type: 'razorpay' })}
          >
            <View style={[styles.paymentIconContainer, { backgroundColor: '#059669' }]}>
              <Ionicons name="qr-code" size={20} color="#fff" />
            </View>
            <View style={styles.paymentDetails}>
              <Text style={styles.paymentName}>Online Payment</Text>
              <Text style={styles.paymentDescription}>PhonePe • GPay • Paytm • UPI QR Code</Text>
            </View>
            {selectedPayment?.type === 'razorpay' && (
              <Ionicons name="checkmark-circle" size={20} color="#FF6B00" />
            )}
          </TouchableOpacity>
          */}
          
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
            {cartItems.map(item => {
              const itemTotal = getCartUnitPrice(item) * item.quantity;
              return (
                <View key={item.id} style={{ marginBottom: 10 }}>
                  <View style={styles.orderItem}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                    </View>
                    <Text style={styles.itemPrice}>₹{itemTotal.toFixed(0)}</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#777', marginTop: 2 }}>
                    + GST ({foodGstRate.toFixed(1)}%) ₹{(itemTotal * (foodGstRate / 100)).toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>
          
          <View style={styles.divider} />
          
          {/* Bill Breakdown - Exact website match */}
          <View style={styles.billBreakdown}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Subtotal</Text>
              <Text style={styles.billValue}>₹{totalAmount.toFixed(2)}</Text>
            </View>

            <Text style={{ fontSize: 11, color: '#777', fontStyle: 'italic', marginVertical: 4 }}>
              Food GST(collected on behalf of seller)
            </Text>

            <View style={styles.billRow}>
              <Text style={styles.billLabel}>CGST ({cgstRate.toFixed(1)}%)</Text>
              <Text style={styles.billValue}>₹{cgstAmount.toFixed(2)}</Text>
            </View>

            <View style={styles.billRow}>
              <Text style={styles.billLabel}>SGST ({sgstRate.toFixed(1)}%)</Text>
              <Text style={styles.billValue}>₹{sgstAmount.toFixed(2)}</Text>
            </View>

            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: '#15803d', fontWeight: '600' }]}>Total GST</Text>
              <Text style={[styles.billValue, { color: '#15803d', fontWeight: '600' }]}>₹{(serverQuote?.taxTotal ?? totalGst).toFixed(2)}</Text>
            </View>

            <View style={[styles.billRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>You pay</Text>
              <Text style={styles.totalValue}>₹{payableAmount.toFixed(2)}</Text>
            </View>
            {quoteProblem ? (
              <Text style={{ color: '#DC2626', fontSize: 12, marginTop: 6 }} accessibilityRole="alert">{quoteProblem}</Text>
            ) : null}

            {/* Delivery Fee Breakdown */}
            {isFetchingDeliveryFee ? (
              <View style={styles.billRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="bicycle-outline" size={15} color="#FF6B00" />
                  <Text style={[styles.billLabel, { color: '#FF6B00' }]}>Delivery Fee</Text>
                </View>
                <ActivityIndicator size="small" color="#FF6B00" />
              </View>
            ) : deliveryPricing ? (
              <View style={styles.billRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="bicycle-outline" size={15} color="#FF6B00" />
                  <Text style={[styles.billLabel, { color: '#FF6B00' }]}>
                    Delivery Fee
                    {deliveryPricing.distanceKm > 0 ? ` (${deliveryPricing.distanceKm} km)` : ''}
                  </Text>
                </View>
                {deliveryPricing.serviceable ? (
                  <Text style={[styles.billValue, { color: '#FF6B00', fontWeight: '700' }]}>₹{deliveryPricing.customerFee}</Text>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="ban-outline" size={14} color="#ef4444" />
                    <Text style={[styles.billValue, { color: '#ef4444', fontWeight: '700' }]}>Not Serviceable</Text>
                  </View>
                )}
              </View>
            ) : (serverQuote?.deliveryFee ?? deliveryFee) > 0 ? (
              <View style={styles.billRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="bicycle-outline" size={15} color="#FF6B00" />
                  <Text style={[styles.billLabel, { color: '#FF6B00' }]}>Delivery Fee</Text>
                </View>
                <Text style={[styles.billValue, { color: '#FF6B00', fontWeight: '700' }]}>₹{serverQuote?.deliveryFee ?? deliveryFee}</Text>
              </View>
            ) : null}

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
                  ? 'Full amount covered by subscription balance'
                  : `₹${totalSubBalance} from subscription + ₹${total - totalSubBalance} via Razorpay`
                }
              </Text>
            </View>
          )}
          
        </View>
      </ScrollView>

      {/* Fixed Bottom Payment Bar */}
      <View style={styles.fixedBottomContainer}>
          {deliveryPricing && !deliveryPricing.serviceable && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FEE2E2',
              borderColor: '#EF4444',
              borderWidth: 1,
              borderRadius: 8,
              padding: 10,
              marginBottom: 10,
              gap: 8,
            }}>
              <Ionicons name="warning-outline" size={18} color="#DC2626" />
              <Text style={{ flex: 1, color: '#DC2626', fontSize: 12, fontWeight: '600' }}>
                Delivery unavailable ({deliveryPricing.distanceKm} km away). We deliver strictly within {SERVICE_RADIUS_KM} km.
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={[
              styles.payButton, 
              (loading || (deliveryPricing && !deliveryPricing.serviceable)) && styles.buttonDisabled,
              deliveryPricing && !deliveryPricing.serviceable && { backgroundColor: '#9CA3AF' }
            ]} 
            onPress={handlePlaceOrder}
            disabled={loading || !!(deliveryPricing && !deliveryPricing.serviceable)}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : deliveryPricing && !deliveryPricing.serviceable ? (
              <>
                <Ionicons name="ban" size={20} color="#fff" />
                <Text style={styles.payButtonText}>
                  Not Serviceable ({deliveryPricing.distanceKm} km {'>'} {SERVICE_RADIUS_KM} km)
                </Text>
              </>
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
            {deliveryPricing && !deliveryPricing.serviceable ? 'Please remove items from distant sellers to place an order.' :
             selectedPayment?.type === 'subscription' ? 'Using your subscription balance. Days will be deducted.' :
             selectedPayment?.type === 'wallet' ? 'Instant payment from your wallet' :
             selectedPayment?.type === 'cod' ? 'Pay cash when your order is delivered' :
             'Secure online payment via UPI QR Code'}
          </Text>
      </View>

      {/* Online UPI QR Payment Modal */}
      <OnlinePaymentModal
        visible={razorpayModal}
        onClose={() => setRazorpayModal(false)}
        amount={payableAmount}
        onPaymentSuccess={async (txnId) => {
          try {
            const resolvedSellerId = cartItems.find(i => !!i.sellerId)?.sellerId || 
              (cartItems.length > 0 ? (typeof cartItems[0].sellerId === 'object' ? (cartItems[0].sellerId as any)?._id : cartItems[0].sellerId) : '') || '';

            const orderData = {
              items: cartItems.map(item => ({
                menuItemId: item.id,
                name: item.name,
                sellingPrice: getCartUnitPrice(item),
                quantity: item.quantity,
                image: item.image,
              })),
              sellerId: resolvedSellerId,
              deliveryAddress: {
                name: deliveryAddress.name || user?.name || 'Customer',
                phone: deliveryAddress.phone || user?.phone || '9876543210',
                street: deliveryAddress.street?.trim() || '',
                city: deliveryAddress.city?.trim() || 'Chandigarh',
                state: deliveryAddress.state?.trim() || 'Chandigarh',
                pincode: deliveryAddress.pincode?.trim() || '',
                fullAddress: `${deliveryAddress.street?.trim() || ''}, ${deliveryAddress.city?.trim() || 'Chandigarh'}, ${deliveryAddress.pincode?.trim() || ''}`.replace(/^, |, $/, ''),
                location: userLocation ? { type: 'Point', coordinates: [userLocation[0], userLocation[1]] } : undefined,
              },
              paymentMethod: 'online',
              transactionId: txnId || `UPI_${Date.now()}`,
              totalAmount: total,
              subtotal: totalAmount,
              deliveryFee: deliveryFee,
              platformFee: platformFee,
            };
            const orderResponse = await api.user.placeOrder(orderData);
            clearCart();
            setRazorpayModal(false);
            setSuccessOrderData({
              orderNumber: orderResponse.order?.orderNumber || 'DN-ORDER',
              total: total,
              // Manual UPI payments are confirmed by Dabba Nation, so the order starts as payment-pending
              paymentMethodName: orderResponse.order?.paymentStatus === 'paid' ? 'Online UPI Payment' : 'Online UPI · awaiting confirmation',
            });
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to place order');
          }
        }}
      />

      {/* ─── Order Placed Success Modal ─── */}
      <Modal
        visible={!!successOrderData}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessOrderData(null)}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successIconBadge}>
              <Ionicons name="checkmark-circle" size={68} color="#22C55E" />
            </View>

            <Text style={styles.successModalTitle}>Order Placed!</Text>
            <Text style={styles.successModalSubtitle}>
              Your order has been placed successfully.
            </Text>

            <View style={styles.successOrderBox}>
              <View style={styles.successRow}>
                <Text style={styles.successRowLabel}>Order Number</Text>
                <Text style={styles.successRowValue}>#{successOrderData?.orderNumber}</Text>
              </View>
              <View style={styles.successRow}>
                <Text style={styles.successRowLabel}>Total Amount</Text>
                <Text style={[styles.successRowValue, { color: '#FF6B00', fontWeight: '800' }]}>
                  ₹{successOrderData?.total}
                </Text>
              </View>
              <View style={styles.successRow}>
                <Text style={styles.successRowLabel}>Payment Method</Text>
                <Text style={styles.successRowValue}>{successOrderData?.paymentMethodName}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.successPrimaryBtn}
              onPress={() => {
                setSuccessOrderData(null);
                navigation.navigate('MainTabs' as any, { screen: 'Orders' });
              }}
            >
              <Ionicons name="bag-handle" size={18} color="#fff" />
              <Text style={styles.successPrimaryBtnText}>View & Track Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.successSecondaryBtn}
              onPress={() => {
                setSuccessOrderData(null);
                navigation.navigate('MainTabs' as any, { screen: 'Home' });
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Ionicons name="home-outline" size={16} color="#4B5563" />
                <Text style={styles.successSecondaryBtnText}>Back to Home</Text>
              </View>
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
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 8 },
      web: { boxShadow: '0px -4px 8px rgba(0,0,0,0.08)' },
    }),
  },

  // ─── Order Success Popup Modal ───────────────────
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  successIconBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#DCFCE7',
  },
  successModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
    textAlign: 'center',
  },
  successModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  successOrderBox: {
    backgroundColor: '#FAF8F5',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EFEBE4',
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  successRowLabel: {
    fontSize: 13,
    color: '#666',
  },
  successRowValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  successPrimaryBtn: {
    backgroundColor: '#FF6B00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    width: '100%',
    gap: 8,
    marginBottom: 10,
  },
  successPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  successSecondaryBtn: {
    paddingVertical: 10,
  },
  successSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
});