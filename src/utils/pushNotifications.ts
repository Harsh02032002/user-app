import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Show notifications as banners even when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const getApiBaseUrl = () => {
  if (Platform.OS === 'web') return 'http://localhost:5000/api';
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri.split(':')[0]}:5000/api`;
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
    if (!projectId) {
      console.log('[Push] No EAS projectId in app.json - run `eas init` in DabbaExpoApp');
      return null;
    }

    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

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
