import RazorpayCheckout from './razorpay';
import { Alert } from 'react-native';
import api from '../config/api';

const RAZORPAY_KEY = 'rzp_live_YOUR_KEY_HERE'; // Replace with actual key

interface RazorpayOptions {
  description: string;
  image?: string;
  currency: string;
  key: string;
  amount: number; // in paise
  name: string;
  order_id: string;
  prefill: {
    email: string;
    contact: string;
    name: string;
  };
  theme: {
    color: string;
  };
}

interface PaymentResult {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  signature?: string;
  error?: string;
}

// Create Razorpay Order
export const createRazorpayOrder = async (amount: number, receiptId: string): Promise<{ orderId: string; amount: number }> => {
  try {
    const response = await api.post('/payment/create-order', {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: receiptId,
    });
    
    if (response.data.success) {
      return {
        orderId: response.data.data.id,
        amount: response.data.data.amount,
      };
    }
    throw new Error(response.data.message || 'Failed to create order');
  } catch (error: any) {
    console.error('Create Razorpay Order Error:', error);
    throw error;
  }
};

// Open Razorpay Checkout
export const openRazorpayCheckout = async (
  orderId: string,
  amount: number, // in rupees
  user: { name: string; email: string; phone: string },
  description: string = 'Dabba Delight Order'
): Promise<PaymentResult> => {
  const options: RazorpayOptions = {
    description,
    image: 'https://dabbanation.in/logo.png',
    currency: 'INR',
    key: RAZORPAY_KEY,
    amount: Math.round(amount * 100), // Convert to paise
    name: 'Dabba Delight',
    order_id: orderId,
    prefill: {
      email: user.email,
      contact: user.phone,
      name: user.name,
    },
    theme: {
      color: '#FF6B00',
    },
  };

  try {
    const data = await RazorpayCheckout.open(options);
    return {
      success: true,
      paymentId: data.razorpay_payment_id,
      orderId: data.razorpay_order_id,
      signature: data.razorpay_signature,
    };
  } catch (error: any) {
    console.error('Razorpay Checkout Error:', error);
    return {
      success: false,
      error: error.description || error.message || 'Payment failed',
    };
  }
};

// Verify Payment
export const verifyPayment = async (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): Promise<boolean> => {
  try {
    const response = await api.post('/payment/verify', {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    });
    
    return response.data.success;
  } catch (error) {
    console.error('Verify Payment Error:', error);
    return false;
  }
};

// Calculate Hybrid Payment
export interface HybridPaymentCalculation {
  totalAmount: number;
  subscriptionBalance: number;
  subscriptionUsable: number;
  razorpayAmount: number;
  perDayValue: number;
  daysToDeduct: number;
}

export const calculateHybridPayment = (
  totalAmount: number,
  subscriptionBalance: number,
  remainingDays: number,
  durationDays: number,
  originalAmount: number
): HybridPaymentCalculation => {
  // Calculate per day value of subscription
  const perDayValue = originalAmount / durationDays;
  
  // Calculate how much subscription balance can be used
  let subscriptionUsable = 0;
  let daysToDeduct = 0;
  
  if (subscriptionBalance > 0 && remainingDays > 0) {
    if (subscriptionBalance >= totalAmount) {
      // Full amount can be covered by subscription
      subscriptionUsable = totalAmount;
      daysToDeduct = Math.ceil(totalAmount / perDayValue);
      
      // Make sure we don't deduct more days than remaining
      if (daysToDeduct > remainingDays) {
        daysToDeduct = remainingDays;
        subscriptionUsable = daysToDeduct * perDayValue;
      }
    } else {
      // Partial coverage
      subscriptionUsable = subscriptionBalance;
      daysToDeduct = remainingDays; // Use all remaining days
    }
  }
  
  const razorpayAmount = Math.max(0, totalAmount - subscriptionUsable);
  
  return {
    totalAmount,
    subscriptionBalance,
    subscriptionUsable: Math.round(subscriptionUsable),
    razorpayAmount: Math.round(razorpayAmount),
    perDayValue: Math.round(perDayValue),
    daysToDeduct,
  };
};

// Process Hybrid Payment
export const processHybridPayment = async (
  orderId: string,
  totalAmount: number,
  subscriptionId: string | null,
  subscriptionAmount: number,
  razorpayAmount: number,
  user: { name: string; email: string; phone: string }
): Promise<{ success: boolean; message: string }> => {
  try {
    // If only subscription payment
    if (razorpayAmount === 0 && subscriptionAmount > 0) {
      const response = await api.post('/orders/pay-with-subscription', {
        orderId,
        subscriptionId,
        subscriptionAmount,
      });
      
      if (response.data.success) {
        return { success: true, message: 'Payment successful using subscription balance' };
      }
      throw new Error(response.data.message || 'Failed to process subscription payment');
    }
    
    // If only Razorpay payment
    if (subscriptionAmount === 0 && razorpayAmount > 0) {
      // Create Razorpay order
      const { orderId: razorpayOrderId } = await createRazorpayOrder(razorpayAmount, orderId);
      
      // Open checkout
      const paymentResult = await openRazorpayCheckout(
        razorpayOrderId,
        razorpayAmount,
        user,
        `Order #${orderId}`
      );
      
      if (!paymentResult.success) {
        return { success: false, message: paymentResult.error || 'Payment failed' };
      }
      
      // Verify and update order
      const verified = await verifyPayment(
        paymentResult.orderId!,
        paymentResult.paymentId!,
        paymentResult.signature!
      );
      
      if (verified) {
        await api.post('/orders/confirm-payment', {
          orderId,
          razorpayPaymentId: paymentResult.paymentId,
          razorpayOrderId: paymentResult.orderId,
          razorpaySignature: paymentResult.signature,
        });
        
        return { success: true, message: 'Payment successful' };
      }
      
      return { success: false, message: 'Payment verification failed' };
    }
    
    // Hybrid payment (both subscription and Razorpay)
    if (subscriptionAmount > 0 && razorpayAmount > 0) {
      // First, create Razorpay order for remaining amount
      const { orderId: razorpayOrderId } = await createRazorpayOrder(razorpayAmount, orderId);
      
      // Open checkout for Razorpay amount
      const paymentResult = await openRazorpayCheckout(
        razorpayOrderId,
        razorpayAmount,
        user,
        `Order #${orderId} (Remaining Amount)`
      );
      
      if (!paymentResult.success) {
        return { success: false, message: paymentResult.error || 'Payment failed' };
      }
      
      // Verify Razorpay payment
      const verified = await verifyPayment(
        paymentResult.orderId!,
        paymentResult.paymentId!,
        paymentResult.signature!
      );
      
      if (!verified) {
        return { success: false, message: 'Payment verification failed' };
      }
      
      // Now process hybrid payment on backend
      const response = await api.post('/orders/pay-hybrid', {
        orderId,
        subscriptionId,
        subscriptionAmount,
        razorpayAmount,
        razorpayPaymentId: paymentResult.paymentId,
        razorpayOrderId: paymentResult.orderId,
        razorpaySignature: paymentResult.signature,
      });
      
      if (response.data.success) {
        return { 
          success: true, 
          message: `Payment successful! Rs.${subscriptionAmount} from subscription, Rs.${razorpayAmount} paid online` 
        };
      }
      
      throw new Error(response.data.message || 'Failed to process hybrid payment');
    }
    
    return { success: false, message: 'Invalid payment configuration' };
  } catch (error: any) {
    console.error('Process Hybrid Payment Error:', error);
    return { 
      success: false, 
      message: error.message || 'Payment processing failed' 
    };
  }
};

// Format Currency
export const formatCurrency = (amount: number): string => {
  return `Rs. ${amount.toLocaleString('en-IN')}`;
};

// Calculate Order Total
export const calculateOrderTotal = (
  itemTotal: number,
  deliveryFee: number = 0,
  platformFee: number = 0,
  discount: number = 0
): { itemTotal: number; deliveryFee: number; platformFee: number; gst: number; discount: number; total: number } => {
  const gst = Math.round(itemTotal * 0.05);
  const total = itemTotal + deliveryFee + gst - discount;
  
  return {
    itemTotal,
    deliveryFee,
    platformFee: 0,
    gst,
    discount,
    total: Math.max(0, total),
  };
};
