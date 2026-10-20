import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Local backend port (override with EXPO_PUBLIC_API_PORT, e.g. to point at a demo backend)
const API_PORT = process.env.EXPO_PUBLIC_API_PORT || '5000';

// Standalone, zero-dependency Socket.IO v4 client (UMD build copied from socket.io-client/dist).
// Using this avoids needing engine.io-client & friends in node_modules.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ioModule = require('./socket.io.js');
const io: (url: string, opts?: Record<string, any>) => any = ioModule.io || ioModule.default || ioModule;
type Socket = any;

const getSocketConfig = () => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const proto = window.location.protocol || 'http:';
      return {
        url: `${proto}//${window.location.hostname}:${API_PORT}`,
        path: '/socket.io',
      };
    }
    return {
      url: `http://localhost:${API_PORT}`,
      path: '/socket.io',
    };
  }
  if (process.env.EXPO_PUBLIC_API_URL) {
    const raw = process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/?$/, '');
    return {
      url: raw,
      path: '/socket.io',
    };
  }
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return {
      url: `http://${ip}:${API_PORT}`,
      path: '/socket.io',
    };
  }
  return {
    url: `http://172.20.10.3:${API_PORT}`,
    path: '/socket.io',
  };
};

let socket: Socket | null = null;
const orderListeners: Map<string, Set<(data: any) => void>> = new Map();
const statusListeners: Map<string, Set<(data: any) => void>> = new Map();
const anyOrderListeners: Set<(data: any) => void> = new Set();
const trackedOrders: Set<string> = new Set();
let connectingPromise: Promise<Socket> | null = null;

let socketToken = '';

const readToken = async () =>
  (await AsyncStorage.getItem('token')) ||
  (await AsyncStorage.getItem('user_token')) ||
  (await AsyncStorage.getItem('dabba_token')) || '';

export const initSocket = async (): Promise<Socket> => {
  if (connectingPromise) return connectingPromise;
  const token = await readToken();
  // Reuse the connection unless the logged-in user changed (rooms are tied to the token)
  if (socket && token === socketToken) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  connectingPromise = createSocket(token).finally(() => { connectingPromise = null; });
  return connectingPromise;
};

const createSocket = async (token: string): Promise<Socket> => {
  socketToken = token;

  const config = getSocketConfig();
  console.log(`[UserSocket] Connecting to ${config.url} (path: ${config.path})`);

  socket = io(config.url, {
    path: config.path,
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[UserSocket] Connected:', socket?.id);
    // Rooms are per-connection: re-subscribe to tracked orders after a reconnect
    trackedOrders.forEach((orderId) => socket?.emit('trackOrder', { orderId }));
    anyOrderListeners.forEach((cb) => cb({ type: 'reconnected' }));
  });

  socket.on('disconnect', (reason: any) => {
    console.log('[UserSocket] Disconnected:', reason);
  });

  socket.on('connect_error', (err: any) => {
    console.warn('[UserSocket] Connect error:', err.message);
  });

  // Handle initial order tracking snapshot from backend
  socket.on('track_order_init', (data: any) => {
    console.log('[UserSocket] track_order_init:', data);
    const orderId = data?.orderId ? String(data.orderId) : '';
    if (orderId) {
      if (data?.riderLocation && orderListeners.has(orderId)) {
        orderListeners.get(orderId)?.forEach((cb) =>
          cb({
            orderId,
            lat: data.riderLocation.lat,
            lng: data.riderLocation.lng,
            pickupCoords: data.pickupCoords,
            dropCoords: data.dropCoords,
            riderInfo: data.riderInfo,
            status: data.status,
            deliveryStatus: data.deliveryStatus,
          }),
        );
      }
      if (statusListeners.has(orderId)) {
        statusListeners.get(orderId)?.forEach((cb) => cb(data));
      }
    }
  });

  // Handle live rider location updates
  socket.on('delivery_location_update', (data: any) => {
    console.log('[UserSocket] delivery_location_update:', data);
    const orderId = data?.orderId ? String(data.orderId) : '';
    if (orderId && orderListeners.has(orderId)) {
      orderListeners.get(orderId)?.forEach((cb) => cb(data));
    }
  });

  // Handle live status updates
  const handleStatus = (data: any) => {
    console.log('[UserSocket] status update:', data);
    const orderId = data?.orderId ? String(data.orderId) : '';
    if (orderId && statusListeners.has(orderId)) {
      statusListeners.get(orderId)?.forEach((cb) => cb(data));
    }
    anyOrderListeners.forEach((cb) => cb(data));
  };

  socket.on('delivery_status_update', handleStatus);
  socket.on('order_status_update', handleStatus);
  socket.on('order_delivered', handleStatus);

  // Listen for all 12-step order lifecycle notifications from backend and trigger OS push banner
  socket.on('notification', (notif: any) => {
    console.log('[UserSocket] notification received:', notif);
    if (notif?.title && notif?.message) {
      const { showLocalPushNotification } = require('../utils/pushNotifications');
      showLocalPushNotification(notif.title, notif.message, {
        orderId: notif.orderId,
        type: notif.type,
        ...(notif.data || {}),
      });
      try {
        const Toast = require('react-native-toast-message').default;
        Toast?.show?.({
          type: notif.data?.status === 'cancelled' ? 'error' : 'success',
          text1: notif.title,
          text2: notif.message,
          visibilityTime: 4500,
        });
      } catch {}
    }
    anyOrderListeners.forEach((cb) => cb({ type: 'notification', ...notif }));
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const trackOrder = async (
  orderId: string,
  onLocationUpdate?: (data: {
    lat: number;
    lng: number;
    heading?: number | null;
    speed?: number | null;
    status?: string;
    deliveryStatus?: string | null;
    pickupCoords?: { lat: number; lng: number };
    dropCoords?: { lat: number; lng: number };
    riderInfo?: any;
  }) => void,
  onStatusUpdate?: (data: any) => void
) => {
  const s = await initSocket();

  if (onLocationUpdate) {
    if (!orderListeners.has(orderId)) orderListeners.set(orderId, new Set());
    orderListeners.get(orderId)!.add(onLocationUpdate);
  }

  if (onStatusUpdate) {
    if (!statusListeners.has(orderId)) statusListeners.set(orderId, new Set());
    statusListeners.get(orderId)!.add(onStatusUpdate);
  }

  trackedOrders.add(orderId);
  s.emit('trackOrder', { orderId });
};

/** Subscribe to status updates for any of the user's orders (and reconnects). Returns unsubscribe. */
export const onAnyOrderUpdate = (cb: (data: any) => void) => {
  anyOrderListeners.add(cb);
  initSocket().catch(() => {});
  return () => { anyOrderListeners.delete(cb); };
};

export const untrackOrder = (
  orderId: string,
  onLocationUpdate?: (data: any) => void,
  onStatusUpdate?: (data: any) => void
) => {
  if (onLocationUpdate && orderListeners.has(orderId)) {
    orderListeners.get(orderId)!.delete(onLocationUpdate);
  }
  if (onStatusUpdate && statusListeners.has(orderId)) {
    statusListeners.get(orderId)!.delete(onStatusUpdate);
  }

  const stillWatched = (orderListeners.get(orderId)?.size || 0) + (statusListeners.get(orderId)?.size || 0) > 0;
  if (!stillWatched) {
    trackedOrders.delete(orderId);
    if (socket) {
      socket.emit('untrackOrder', { orderId });
    }
  }
};
