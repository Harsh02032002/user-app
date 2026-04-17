// User Types
export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  role: 'user' | 'seller' | 'admin';
  addresses: Address[];
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  _id: string;
  type: 'home' | 'work' | 'other';
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
}

// Restaurant/Seller Types
export interface Restaurant {
  _id: string;
  name: string;
  email: string;
  phone: string;
  description?: string;
  image?: string;
  coverImage?: string;
  logo?: string;
  cuisines: string[];
  address: {
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
    latitude?: number;
    longitude?: number;
  };
  rating: number;
  totalRatings: number;
  avgDeliveryTime: number; // in minutes
  minOrder: number;
  deliveryFee: number;
  isOpen: boolean;
  openingTime: string;
  closingTime: string;
  isVeg: boolean;
  isPureVeg: boolean;
  isHomeChef: boolean;
  isFeatured: boolean;
  discount?: {
    type: 'percentage' | 'flat';
    value: number;
    maxDiscount?: number;
  };
  menu: MenuItem[];
  createdAt: string;
}

export interface HomeChef extends Restaurant {
  isHomeChef: true;
  specialities: string[];
  subscriptionPlans?: SubscriptionPlan[];
}

// Menu Item Types
export interface MenuItem {
  _id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category: string;
  subCategory?: string;
  isVeg: boolean;
  isAvailable: boolean;
  isBestSeller?: boolean;
  isRecommended?: boolean;
  variants?: Variant[];
  addons?: Addon[];
  preparationTime?: number; // in minutes
  discount?: number;
  rating?: number;
  totalRatings?: number;
}

export interface Variant {
  _id: string;
  name: string;
  price: number;
  isDefault?: boolean;
}

export interface Addon {
  _id: string;
  name: string;
  price: number;
  isVeg: boolean;
}

// Cart Types
export interface CartItem {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  isVeg: boolean;
  restaurantId: string;
  restaurantName: string;
  variant?: string;
  addons?: string[];
  specialInstructions?: string;
}

// Order Types
export interface Order {
  _id: string;
  orderNumber: string;
  user: string | User;
  seller: string | Restaurant;
  items: OrderItem[];
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  
  // Amounts
  itemTotal: number;
  deliveryFee: number;
  platformFee: number;
  gst: number;
  discount: number;
  totalAmount: number;
  
  // Hybrid Payment
  subscriptionAmountUsed: number;
  razorpayAmountPaid: number;
  
  // Delivery
  deliveryAddress: Address;
  deliveryInstructions?: string;
  estimatedDeliveryTime?: string;
  actualDeliveryTime?: string;
  
  // Tracking
  statusHistory: StatusHistory[];
  
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  menuItem: string | MenuItem;
  name: string;
  price: number;
  quantity: number;
  variant?: string;
  addons?: string[];
  specialInstructions?: string;
}

export type OrderStatus = 
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentMethod = 
  | 'cod'
  | 'razorpay'
  | 'subscription'
  | 'hybrid';

export type PaymentStatus = 
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded';

export interface StatusHistory {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

// Subscription Types
export interface SubscriptionPlan {
  _id: string;
  name: string;
  description?: string;
  amount: number;
  durationDays: number;
  features?: string[];
  isActive: boolean;
  createdAt: string;
}

export interface UserSubscription {
  _id: string;
  user: string | User;
  plan: string | SubscriptionPlan;
  homeChef: string | HomeChef;
  
  // Payment
  amountPaid: number;
  paymentId?: string;
  paymentMethod: 'razorpay' | 'cod';
  paymentStatus: PaymentStatus;
  
  // Status
  status: 'pending' | 'active' | 'paused' | 'expired' | 'cancelled';
  
  // Dates
  startDate?: string;
  endDate?: string;
  activatedAt?: string;
  
  // Balance
  remainingAmount: number;
  remainingDays: number;
  totalUsed: number;
  
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionUsage {
  _id: string;
  subscription: string | UserSubscription;
  order?: string | Order;
  amountUsed: number;
  daysDeducted: number;
  type: 'order' | 'adjustment' | 'refund';
  note?: string;
  createdAt: string;
}

// Category Types
export interface Category {
  _id: string;
  name: string;
  image?: string;
  icon?: string;
  isActive: boolean;
  order: number;
}

// Review Types
export interface Review {
  _id: string;
  user: string | User;
  restaurant?: string | Restaurant;
  order?: string | Order;
  rating: number;
  comment?: string;
  images?: string[];
  reply?: {
    text: string;
    repliedAt: string;
  };
  createdAt: string;
}

// Notification Types
export interface Notification {
  _id: string;
  user: string;
  title: string;
  body: string;
  type: 'order' | 'promo' | 'subscription' | 'general';
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Navigation Types
export type RootStackParamList = {
  // Auth
  Login: undefined;
  Otp: { phone: string; isRegister?: boolean };
  Register: { phone: string };
  
  // Main
  MainTabs: undefined;
  Home: undefined;
  Search: { query?: string };
  Cart: undefined;
  Profile: undefined;
  
  // Restaurant
  Restaurant: { id: string };
  MenuItem: { restaurantId: string; itemId: string };
  
  // Order
  Checkout: undefined;
  Payment: {
    orderId: string;
    amount: number;
    subscriptionAmount?: number;
    razorpayAmount?: number;
  };
  OrderSuccess: { orderId: string };
  OrderDetails: { orderId: string };
  Orders: undefined;
  
  // Subscription
  SubscriptionPlans: undefined;
  SelectHomeChef: { planId: string };
  SubscriptionPayment: { planId: string; homeChefId: string };
  Subscriptions: undefined;
  
  // Profile
  EditProfile: undefined;
  Addresses: undefined;
  AddAddress: { address?: Address };
  Notifications: undefined;
  Help: undefined;
  About: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Orders: undefined;
  Subscriptions: undefined;
  Profile: undefined;
};
