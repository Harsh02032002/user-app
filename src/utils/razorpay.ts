import { NativeModules } from 'react-native';

/**
 * Lazy wrapper around react-native-razorpay.
 * The library creates a NativeEventEmitter at import time, which crashes the whole app when its
 * native module is missing (Expo Go, web). Load it only when a payment is actually started.
 */
export const isRazorpayAvailable = () =>
  !!NativeModules.RNRazorpayCheckout && !!NativeModules.RazorpayEventEmitter;

const RazorpayCheckout = {
  open: async (options: Record<string, unknown>): Promise<any> => {
    if (!isRazorpayAvailable()) {
      const error: any = new Error(
        'Online payment is not available in this build. Use the installed Dabba Nation app, or pay with wallet or cash on delivery.'
      );
      error.code = 'RAZORPAY_UNAVAILABLE';
      error.description = error.message;
      throw error;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-razorpay');
    return (mod.default || mod).open(options);
  },
};

export default RazorpayCheckout;
