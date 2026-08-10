import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerPushToken } from './data';

// Show alerts even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Ask for push permission, fetch the Expo push token, and register it for the
 * signed-in user. Best-effort: returns null (never throws) on any failure.
 * Call this AFTER the user is authenticated.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // Push only works on physical devices.

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('dumps', {
        name: 'Dump alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#14F195',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await registerPushToken(token, platform);
    return token;
  } catch {
    return null;
  }
}

/** Subscribe to notification taps (deep-link into the token screen). */
export function addNotificationResponseListener(
  handler: (tokenAddress: string) => void,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { tokenAddress?: string };
    if (data?.tokenAddress) handler(data.tokenAddress);
  });
  return () => sub.remove();
}
