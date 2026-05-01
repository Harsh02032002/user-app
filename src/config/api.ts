import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Live API Base URL
export const BASE_URL = 'https://dabbanation.in/api';

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, clear storage
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default api;

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  VERIFY_OTP: '/auth/verify-otp',
  SEND_OTP: '/auth/send-otp',
  PROFILE: '/auth/profile',
  UPDATE_PROFILE: '/auth/update-profile',
  
  // Home
  HOME_DATA: '/home',
  BANNERS: '/banners',
  
  // Restaurants & Home Chefs
  RESTAURANTS: '/restaurants',
  HOME_CHEFS: '/user/sellers?type=home_chef',
  SELLER_DETAILS: '/seller',
  SELLER_MENU: '/seller/menu',
  
  // Menu & Products
  CATEGORIES: '/categories',
  PRODUCTS: '/products',
  SEARCH: '/search',
  
  // Cart & Orders
  CART: '/cart',
  ADD_TO_CART: '/cart/add',
  UPDATE_CART: '/cart/update',
  REMOVE_FROM_CART: '/cart/remove',
  
  // Orders
  CREATE_ORDER: '/orders/create',
  VERIFY_PAYMENT: '/orders/verify-payment',
  MY_ORDERS: '/orders/my-orders',
  ORDER_DETAILS: '/orders',
  CANCEL_ORDER: '/orders/cancel',
  
  // Subscription (Same as Dabba Delights Web)
  SUBSCRIPTION_PLANS: '/subscriptions/plans',
  PURCHASE_SUBSCRIPTION: '/subscriptions/purchase',
  VERIFY_SUBSCRIPTION: '/payment/razorpay/verify',
  MY_SUBSCRIPTIONS: '/subscriptions/active',
  SUBSCRIPTION_HISTORY: '/subscriptions/my-subscriptions',
  SUBSCRIPTION_ITEMS: '/subscriptions/my-items',
  HOME_CHEFS_SUBS: '/subscription/home-chefs',
  SUBSCRIPTION_BALANCE: '/subscriptions/active',
  
  // Address
  ADDRESSES: '/address',
  ADD_ADDRESS: '/address/add',
  UPDATE_ADDRESS: '/address/update',
  DELETE_ADDRESS: '/address/delete',
  
  // Razorpay
  CREATE_RAZORPAY_ORDER: '/payment/razorpay/create-order',
  VERIFY_RAZORPAY_PAYMENT: '/payment/razorpay/verify',
  RAZORPAY_KEY: 'rzp_test_RDG5JVvoKELSk0',
};
