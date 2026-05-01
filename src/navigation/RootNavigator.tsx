import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

// Auth Screens
import SimpleLoginScreen from '../screens/auth/SimpleLoginScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Landing
import LandingScreen from '../screens/LandingScreen';
import StaticPageScreen from '../screens/static/StaticPageScreen';
import AllMenusScreen from '../screens/AllMenusScreen';
import AllPlansScreen from '../screens/AllPlansScreen';

// Main App
import MainTabNavigator from './MainTabNavigator';

// Other Screens
import AddAddressScreen from '../screens/AddAddressScreen';
import AddressesScreen from '../screens/AddressesScreen';
import { CartScreen } from '../screens/CartScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import OrderDetailsScreen from '../screens/OrderDetailsScreen';
import OrdersScreen from '../screens/OrdersScreen';
import PaymentMethodsScreen from '../screens/PaymentMethodsScreen';
import PaymentScreen from '../screens/PaymentScreen';
import RestaurantScreen from '../screens/RestaurantScreen';
import SearchScreen from '../screens/SearchScreen';
import SelectHomeChefScreen from '../screens/SelectHomeChefScreen';
import SubscriptionCheckoutScreen from '../screens/SubscriptionCheckoutScreen';
import SubscriptionPlansScreen from '../screens/SubscriptionPlansScreen';
import SubscriptionsScreen from '../screens/SubscriptionsScreen';
import WalletScreen from '../screens/WalletScreen';
import WishlistScreen from '../screens/WishlistScreen';
import { SettingsScreen } from '../screens/tabs/SettingsScreen';

export type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  SimpleLogin: undefined;
  Otp: { phone: string };
  Register: { phone: string };
  MainTabs: undefined;
  Cart: undefined;
  Restaurant: { sellerId: string; sellerName: string };
  Checkout: undefined;
  OrderDetails: { orderId: string };
  SubscriptionPlans: undefined;
  SelectHomeChef: { planId: string; planName: string; amount: number; durationDays?: number; perDayValue?: number };
  SubscriptionCheckout: { 
    planId: string; 
    planName: string; 
    amount: number;
    durationDays: number;
    perDayValue: number;
    homeChefId: string;
    homeChefName: string;
  };
  Payment: { 
    type: 'order' | 'subscription';
    orderId?: string;
    subscriptionData?: any;
    amount: number;
    razorpayOrderId: string;
  };
  AddAddress: { edit?: boolean; addressId?: string };
  Search: undefined;
  // Profile & Account
  Addresses: undefined;
  PaymentMethods: undefined;
  Notifications: undefined;
  Wishlist: undefined;
  Wallet: undefined;
  // Orders & Subscriptions
  Orders: undefined;
  Subscriptions: undefined;
  StaticPage: { type: 'about' | 'help' | 'privacy' | 'terms' | 'contact' | 'refund' };
  AllMenus: undefined;
  AllPlans: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

import { MobileNavBar } from '../components/common/MobileNavBar';

export default function RootNavigator() {
  const { isLoading, isAuthenticated } = useAuth();
  console.log('RootNavigator - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

  if (isLoading) {
    console.log('Showing loading spinner');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#fff' },
        }}
      >
      {!isAuthenticated ? (
        // Auth Stack with Landing as initial
        <>
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen name="SimpleLogin" component={SimpleLoginScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Otp" component={OtpScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        // App Stack
        <>
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen 
            name="Cart" 
            component={CartScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen 
            name="Restaurant" 
            component={RestaurantScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen 
            name="Checkout" 
            component={CheckoutScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen 
            name="OrderDetails" 
            component={OrderDetailsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen 
            name="SubscriptionPlans" 
            component={SubscriptionPlansScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen 
            name="SelectHomeChef" 
            component={SelectHomeChefScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen 
            name="SubscriptionCheckout" 
            component={SubscriptionCheckoutScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen 
            name="Payment" 
            component={PaymentScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen 
            name="AddAddress" 
            component={AddAddressScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen 
            name="Search" 
            component={SearchScreen}
            options={{ animation: 'fade' }}
          />
          {/* Profile & Account Screens */}
          <Stack.Screen 
            name="Addresses" 
            component={AddressesScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen 
            name="PaymentMethods" 
            component={PaymentMethodsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen 
            name="Notifications" 
            component={NotificationsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen 
            name="Wishlist" 
            component={WishlistScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen 
            name="Wallet" 
            component={WalletScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen 
            name="Orders" 
            component={OrdersScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen 
            name="Subscriptions" 
            component={SubscriptionsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen 
            name="StaticPage" 
            component={StaticPageScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen 
            name="AllMenus" 
            component={AllMenusScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen 
            name="AllPlans" 
            component={AllPlansScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen 
            name="Settings" 
            component={SettingsScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </>
      )}
      </Stack.Navigator>
      {isAuthenticated && <MobileNavBar />}
    </View>
  );
}
