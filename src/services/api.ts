import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import Constants from 'expo-constants';

// API Configuration
const getApiBaseUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:5000/api';
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:5000/api`;
  }
  return 'https://dabbanation.in/api';
};

const API_BASE_URL = getApiBaseUrl();

// Helper to normalize image URLs (matching website logic)
export const getImageUrl = (path: string | undefined | null) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('file:')) {
    return path;
  }
  
  // Clean path: remove leading / and handle potential full paths
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = API_BASE_URL.replace('/api', '');
  return `${baseUrl}${cleanPath}`;
};

// Request timeout
const REQUEST_TIMEOUT = 25000;

// Helper to add timeout to fetch
async function fetchWithTimeout(url: string, options: RequestInit, timeout = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw error;
  }
}

// Helper to convert params to query string
function toQuery(params?: Record<string, unknown>) {
  if (!params) return "";
  const entries = Object.entries(params).reduce<Record<string, string>>(
    (acc, [k, v]) => {
      if (v !== undefined && v !== null && v !== "") acc[k] = String(v);
      return acc;
    },
    {},
  );
  const qs = new URLSearchParams(entries).toString();
  return qs ? `?${qs}` : "";
}

// In-memory token cache for performance
let cachedToken: string | null = null;

// Get auth token
export const getAuthToken = async () => {
  if (cachedToken) return cachedToken;
  try {
    const token = await AsyncStorage.getItem('token');
    cachedToken = token;
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

// Clear token cache (call on logout)
export const clearTokenCache = () => {
  cachedToken = null;
};

// Generic API request function with timeout and better error handling
const apiRequest = async (endpoint: string, options: RequestInit = {}, requireAuth = true) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`[API Debug] Full URL: ${url} | Method: ${options.method || 'GET'}`);
    if (endpoint.includes('cancel')) {
      Toast.show({
        type: 'info',
        text1: 'API Debug',
        text2: `Hitting: ${endpoint}`,
        position: 'bottom',
      });
    }
    
    const headers: Record<string, string> = {};
    
    // Don't set Content-Type for FormData (let fetch handle it)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    
    // Only add auth token for protected endpoints
    let token = null;
    if (requireAuth) {
      token = await getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        // Debug: Log token preview (first 20 chars)
        console.log(`[API] Token sent: ${token.substring(0, 20)}...`);
      } else {
        console.warn(`[API] No token found for protected endpoint: ${endpoint}`);
      }
    }
    
    // Merge any additional headers
    if (options.headers) {
      Object.assign(headers, options.headers);
    }
    
    console.log(`[API] ${endpoint}`, requireAuth ? '(with auth)' : '(no auth)', token ? '✓ token' : '✗ no token');
    
    const response = await fetchWithTimeout(url, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error((error as any).message || `API request failed: ${response.status}`);
    }
    
    return response.json();
  } catch (error: any) {
    console.error(`[API Error] ${endpoint} - ${error.message}`);
    throw error;
  }
};

// API Services - Matching Dabba Delights Backend
export const api = {
  // Auth APIs (no auth required)
  auth: {
    // Email/Password login
    login: async (email: string, password: string) => {
      return apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }, false); // No auth required
    },

    // Send Dual Login OTP (SMS + Email)
    sendLoginOtp: async (identifier: string, password?: string) => {
      return apiRequest('/auth/send-login-otp', {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          email: identifier,
          phone: identifier,
          password,
        }),
      }, false);
    },

    // Verify Dual Login OTP
    verifyLoginOtp: async (identifier: string, otp: string) => {
      return apiRequest('/auth/verify-login-otp', {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          email: identifier,
          phone: identifier,
          otp,
        }),
      }, false);
    },
    
    // Phone/OTP login
    loginWithPhone: async (phone: string, otp: string) => {
      return apiRequest('/auth/verify-login-otp', {
        method: 'POST',
        body: JSON.stringify({ identifier: phone, phone, otp }),
      }, false); // No auth required
    },
    
    // Verify Email with code
    verifyEmail: async (email: string, code: string) => {
      return apiRequest('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      }, false);
    },
    
    register: async (userData: any) => {
      return apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      }, false); // No auth required
    },
    
    getProfile: async () => {
      return apiRequest('/auth/me');
    },

    updateProfile: async (data: any) => {
      return apiRequest('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    uploadAvatar: async (formData: FormData) => {
      return apiRequest('/auth/profile/avatar', {
        method: 'POST',
        body: formData,
      });
    },

    uploadBanner: async (formData: FormData) => {
      return apiRequest('/auth/profile/banner', {
        method: 'POST',
        body: formData,
      });
    },

    changePassword: async (currentPassword: string, newPassword: string) => {
      return apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },
  },

  // User APIs (matching Dabba Delights userAPI exactly)
  user: {
    getNearbySellers: async (params: { lat: number; lng: number; radius?: number; type?: string; city?: string }) => {
      const query = new URLSearchParams({
        lat: String(params.lat),
        lng: String(params.lng),
        radius: String(params.radius || 12000),
        ...(params.type ? { type: params.type } : {}),
        ...(params.city ? { city: params.city } : {}),
      }).toString();
      const res = await apiRequest(`/user/sellers/nearby?${query}`);
      const sellers = Array.isArray(res) ? res : Array.isArray(res?.sellers) ? res.sellers : [];
      return { sellers, success: true };
    },

    // Sellers
    getSellers: async (params?: Record<string, unknown>) => {
      const res = await apiRequest(`/user/sellers${toQuery(params)}`);
      const sellers = Array.isArray(res) ? res : Array.isArray(res?.sellers) ? res.sellers : Array.isArray(res?.data) ? res.data : [];
      return { sellers, total: res?.total || sellers.length, success: true };
    },
    
    getSellerById: async (id: string) => {
      return apiRequest(`/user/sellers/${id}`);
    },
    
    getHomeChefs: async (params?: Record<string, unknown>) => {
      const res = await apiRequest(`/user/sellers${toQuery(params)}`);
      const sellers = Array.isArray(res) ? res : Array.isArray(res?.sellers) ? res.sellers : Array.isArray(res?.data) ? res.data : [];
      const homeChefs = sellers.filter((s: any) => s.type === 'home_chef' || s.type === 'home-chef');
      return { sellers: homeChefs, total: homeChefs.length, success: true };
    },
    
    getRestaurants: async (params?: Record<string, unknown>) => {
      const res = await apiRequest(`/user/sellers${toQuery(params)}`);
      const sellers = Array.isArray(res) ? res : Array.isArray(res?.sellers) ? res.sellers : Array.isArray(res?.data) ? res.data : [];
      const restaurants = sellers.filter((s: any) => s.type === 'restaurant');
      return { sellers: restaurants, total: restaurants.length, success: true };
    },
    
    // Menu Items
    getMenuItems: async (params?: Record<string, unknown> | string) => {
      let query = "";
      if (typeof params === 'string') {
        query = `?sellerId=${params}`;
      } else {
        query = toQuery(params);
      }
      const res = await apiRequest(`/user/menu${query}`);
      const products = Array.isArray(res) ? res : Array.isArray(res?.products) ? res.products : Array.isArray(res?.data) ? res.data : Array.isArray(res?.menu) ? res.menu : [];
      return { products, total: res?.total || products.length, page: res?.page, limit: res?.limit, success: true };
    },
    
    getRecommendations: async () => {
      return apiRequest('/user/recommendations');
    },
    
    // Cart
    getCart: async () => {
      return apiRequest('/user/cart');
    },
    
    addToCart: async (data: Record<string, unknown>) => {
      return apiRequest('/user/cart/add', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    updateCartQuantity: async (itemId: string, quantity: number) => {
      return apiRequest('/user/cart/update', {
        method: 'PATCH',
        body: JSON.stringify({ itemId, quantity }),
      });
    },
    
    removeFromCart: async (itemId: string) => {
      return apiRequest(`/user/cart/remove/${itemId}`, {
        method: 'DELETE',
      });
    },
    
    // Orders
    getOrders: async (status?: string) => {
      return apiRequest(`/user/orders${status ? `?status=${status}` : ''}`);
    },
    
    getOrderById: async (id: string) => {
      return apiRequest(`/user/orders/${id}`);
    },

    getOrderTracking: async (id: string) => {
      return apiRequest(`/user/orders/${id}/track`);
    },
    
    placeOrder: async (data: Record<string, unknown>) => {
      return apiRequest('/user/orders/place', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    deleteOrder: async (id: string) => {
      return apiRequest(`/user/orders/${id}/delete`, {
        method: 'DELETE',
      });
    },

    cancelOrder: async (id: string) => {
      console.log(`[API Debug] cancelOrder called with id: ${id}`);
      if (!id) {
        console.error('[API Debug] cancelOrder: id is missing!');
        throw new Error('Order ID is required for cancellation');
      }
      return apiRequest(`/user/orders/${id}/cancel`, {
        method: 'POST',
      });
    },
    
    rateOrder: async (id: string, rating: number, review?: string) => {
      return apiRequest(`/user/orders/${id}/rate`, {
        method: 'POST',
        body: JSON.stringify({ rating, review }),
      });
    },
    
    rateMenuItem: async (menuItemId: string, rating: number) => {
      return apiRequest(`/user/menu/${menuItemId}/rate`, {
        method: 'POST',
        body: JSON.stringify({ rating }),
      });
    },
    
    rateSeller: async (sellerId: string, rating: number) => {
      return apiRequest(`/user/sellers/${sellerId}/rate`, {
        method: 'POST',
        body: JSON.stringify({ rating }),
      });
    },
    
    // Wallet
    getWalletTransactions: async () => {
      return apiRequest('/user/wallet/transactions');
    },
    
    topupWallet: async (amount: number) => {
      return apiRequest('/user/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
    },
    
    verifyPayment: async (data: Record<string, unknown>) => {
      return apiRequest('/user/wallet/verify', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    // Subscriptions
    getActiveSubscription: async () => {
      return apiRequest('/user/subscriptions/active');
    },
    
    getSubscriptionHistory: async () => {
      return apiRequest('/subscriptions/my-subscriptions');
    },
    
    getSubscriptionPlans: async () => {
      return apiRequest('/subscriptions/plans');
    },
    
    purchaseSubscription: async (data: any) => {
      return apiRequest('/subscriptions/purchase', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    verifySubscriptionPayment: async (paymentData: any) => {
      return apiRequest('/payment/razorpay/verify', {
        method: 'POST',
        body: JSON.stringify(paymentData),
      });
    },
    
    // Wishlist
    getWishlist: async () => {
      return apiRequest('/user/wishlist');
    },
    
    addToWishlist: async (productId: string) => {
      return apiRequest('/user/wishlist/add', {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
    },
    
    removeFromWishlist: async (productId: string) => {
      return apiRequest(`/user/wishlist/remove/${productId}`, {
        method: 'DELETE',
      });
    },
    
    // Notifications
    getNotifications: async () => {
      return apiRequest('/user/notifications');
    },
    
    markNotificationRead: async (id: string) => {
      return apiRequest(`/user/notifications/${id}/read`, {
        method: 'PATCH',
      });
    },
    
    markAllNotificationsRead: async () => {
      return apiRequest('/user/notifications/mark-all-read', {
        method: 'PATCH',
      });
    },
    
    deleteNotification: async (id: string) => {
      return apiRequest(`/user/notifications/${id}`, {
        method: 'DELETE',
      });
    },
    
    // GST & Platform Settings
    getGSTSettings: async () => {
      return apiRequest('/public/gst-settings');
    },
    getPlatformConfig: async () => {
      return apiRequest('/public/platform-config');
    },

    // Banners
    getActiveBanners: async () => {
      return apiRequest('/user/banners');
    },
    
    // Invoice
    downloadInvoice: async (orderId: string) => {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No token found for invoice download');
      }
      const encodedToken = encodeURIComponent(token);
      return `${API_BASE_URL}/invoice/download/${orderId}?token=${encodedToken}`;
    },
    
    generateInvoice: async (orderId: string) => {
      return apiRequest(`/invoice/generate/${orderId}`, {
        method: 'POST',
      });
    },
    
    // Addresses
    getAddresses: async () => {
      return apiRequest('/user/addresses');
    },
    
    saveAddress: async (data: Record<string, unknown>) => {
      return apiRequest('/user/addresses', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    updateOrderStatus: async (orderId: string, status: string) => {
      return apiRequest(`/user/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },

    // Delivery fee calculator — distance-based slab pricing
    // Returns: { success, distanceKm, customerFee, riderPayout, serviceable, message }
    calculateDeliveryFee: async (params: {
      sellerId?: string;
      sellerLng?: number;
      sellerLat?: number;
      customerLng: number;
      customerLat: number;
    }) => {
      const query = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)])
      ).toString();
      return apiRequest(`/delivery/calculate-fee?${query}`, {}, false);
    },
  },

  // Payment APIs
  payment: {
    createRazorpayOrder: async (data: Record<string, unknown>) => {
      return apiRequest('/payment/razorpay/create-order', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    processWalletPayment: async (data: Record<string, unknown>) => {
      return apiRequest('/payment/wallet', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    verifyPayment: async (data: Record<string, unknown>) => {
      return apiRequest('/payment/razorpay/verify', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },

  // Legacy endpoints for backward compatibility
  sellers: {
    getAll: async (type?: string) => {
      return api.user.getSellers(type ? { type } : {});
    },
    
    getById: async (id: string) => {
      return api.user.getSellerById(id);
    },
  },

  menuItems: {
    getAll: async (sellerId?: string) => {
      return api.user.getMenuItems(sellerId ? { sellerId } : {});
    },
    
    getBySeller: async (sellerId: string) => {
      return api.user.getMenuItems({ sellerId });
    },
  },

  // Orders APIs
  orders: {
    getUserOrders: async () => {
      return apiRequest('/orders/user');
    },
    
    getById: async (id: string) => {
      return apiRequest(`/orders/${id}`);
    },
    
    create: async (orderData: any) => {
      return apiRequest('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData),
      });
    },
  },

  // Subscriptions APIs
  subscriptions: {
    getPlans: async () => {
      return apiRequest('/subscriptions/plans');
    },
    
    getUserSubscriptions: async () => {
      return apiRequest('/subscriptions/user');
    },
    
    create: async (subscriptionData: any) => {
      return apiRequest('/subscriptions', {
        method: 'POST',
        body: JSON.stringify(subscriptionData),
      });
    },

    placeOrderFromSubscription: async (orderData: any) => {
      return apiRequest('/subscriptions/place-order', {
        method: 'POST',
        body: JSON.stringify(orderData),
      });
    },
  },

  // Wishlist APIs
  wishlist: {
    get: async () => {
      return apiRequest('/wishlist');
    },
    
    add: async (itemId: string) => {
      return apiRequest('/wishlist/add', {
        method: 'POST',
        body: JSON.stringify({ itemId }),
      });
    },
    
    remove: async (itemId: string) => {
      return apiRequest(`/wishlist/remove/${itemId}`, {
        method: 'DELETE',
      });
    },
  },

  // Location APIs
  location: {
    update: async (locationData: any) => {
      return apiRequest('/user/location', {
        method: 'PUT',
        body: JSON.stringify(locationData),
      });
    },
  },

  // Promo Banners APIs
  promos: {
    getActive: async () => {
      return apiRequest('/promos/active');
    },
  },
};

export default api;
