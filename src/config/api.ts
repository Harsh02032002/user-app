import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Live API Base URL
export const BASE_URL = 'https://dabbanation.in/api';

// Bundled subscription plan images for 7 Days, 14/15 Days, and 30 Days plans
export const SUBSCRIPTION_PLAN_IMAGES = {
  weekly: require('../../assets/images/weekly.png'),
  fortnightly: require('../../assets/images/fortnightly.png'),
  monthly: require('../../assets/images/monthly.png'),
};

/**
 * Returns the image source for any subscription plan (7 Days, 14 Days, 30 Days).
 * Uses bundled high-res assets so the 3 subscription cards always display their images
 * on Web, Android APK, and iOS without broken URLs.
 */
export const getSubscriptionPlanImage = (plan: any): any => {
  if (!plan) return SUBSCRIPTION_PLAN_IMAGES.weekly;
  const name = String(plan.plan_name || plan.name || '').toLowerCase();
  const days = Number(plan.total_days || plan.durationDays || 0);
  const rawImg = String(plan.banner_image || plan.image || plan.plan_image || '').toLowerCase();

  if (
    rawImg.includes('monthly') ||
    name.includes('monthly') ||
    name.includes('30 day') ||
    days > 15
  ) {
    return SUBSCRIPTION_PLAN_IMAGES.monthly;
  }
  if (
    rawImg.includes('fortnightly') ||
    name.includes('fortnightly') ||
    name.includes('14 day') ||
    name.includes('15 day') ||
    (days > 7 && days <= 15)
  ) {
    return SUBSCRIPTION_PLAN_IMAGES.fortnightly;
  }
  return SUBSCRIPTION_PLAN_IMAGES.weekly;
};

const getBackendOrigin = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) return `http://${ip}:5000`;
  }
  return 'https://dabbanation.in';
};

// Helper to get full image URL
export const getImageUrl = (path: string | undefined): string => {
  if (!path) return '';
  
  const backendBaseUrl = getBackendOrigin();
  
  // Clean the path
  let cleanPath = path.trim();
  
  // If it's already a full URL, return it
  if (cleanPath.startsWith('http')) return cleanPath;
  
  // If it's a data URI, return it
  if (cleanPath.startsWith('data:')) return cleanPath;
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }
  
  // Ensure extension for subscription images if missing
  if (cleanPath.startsWith('/uploads/subscriptions/') && !cleanPath.includes('.')) {
    cleanPath = cleanPath + '.png';
  }

  // FORCE prepend the domain if it's a backend path
  if (cleanPath.startsWith('/uploads/') || cleanPath.startsWith('/api/')) {
    return `${backendBaseUrl}${cleanPath}`;
  }

  // For other paths, try to prepend domain if they look like backend paths
  if (!cleanPath.startsWith('/assets') && !cleanPath.startsWith('/src')) {
     return `${backendBaseUrl}${cleanPath}`;
  }
  
  return cleanPath;
};

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
  RAZORPAY_KEY: 'rzp_test_TnuGwHi19zjhSx',
};
