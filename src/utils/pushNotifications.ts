import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Local backend port (override with EXPO_PUBLIC_API_PORT, e.g. to point at a demo backend)
const API_PORT = process.env.EXPO_PUBLIC_API_PORT || '5000';

// Show notifications as banners even when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const getApiBaseUrl = () => {
  if (Platform.OS === 'web') return `http://localhost:${API_PORT}/api`;
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri.split(':')[0]}:${API_PORT}/api`;
  return 'https://dabbanation.in/api';
};

/**
 * Asks permission, gets the Expo push token for this phone and saves it on the backend
 * (POST /api/user/push-token). Safe to call on every login / app start.
 */
export async function registerForPushNotifications(authToken: string | null): Promise<string | null> {
  try {
    if (!authToken || Platform.OS === 'web') return null;
    if (!Device.isDevice) {
      console.log('[Push] Emulator detected - push notifications need a real phone');
      return null;
    }

    if (Platform.OS === 'android') {
      // Must match channelId used by the backend (pushNotification.service.js)
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Orders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') {
      console.log('[Push] Notification permission denied');
      return null;
    }

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;

    let pushToken: string | null = null;
    try {
      const { data } = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      pushToken = data;
    } catch (expoErr: any) {
      console.log('[Push] Expo token fallback to native FCM device token:', expoErr?.message);
      try {
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        pushToken = typeof deviceToken?.data === 'string' ? deviceToken.data : null;
      } catch {}
    }

    if (!pushToken) {
      console.log('[Push] Could not obtain push token');
      return null;
    }

    await fetch(`${getApiBaseUrl()}/user/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ pushToken, fcmToken: pushToken }),
    });

    console.log('[Push] Customer push token registered:', pushToken);
    return pushToken;
  } catch (err: any) {
    console.log('[Push] Registration failed:', err?.message || err);
    return null;
  }
}

/**
 * Displays a native OS push notification banner immediately (with sound & vibration on 'orders' channel).
 * Used when real-time Socket.IO notification events arrive so phone banners always fire reliably.
 */
export async function showLocalPushNotification(
  title: string,
  body: string,
  data: Record<string, any> = {}
) {
  try {
    if (Platform.OS === 'web') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Orders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'orders' } : {}),
      } as any,
      trigger: null,
    });
  } catch (err: any) {
    console.log('[Push] Local notification error:', err?.message || err);
  }
}

