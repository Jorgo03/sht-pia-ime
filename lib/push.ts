// Push notifications on the phone (docs/LAUNCH_TASKS.md F14).
//
// The person turns notifications on from Profile -> Notifications; only then
// does the app ask the OS for permission and register this device's Expo push
// token with register_push_token(). Signing out forgets the device first, so a
// shared phone stops receiving the previous person's messages.
//
// What can be verified where: Expo Go on Android cannot receive remote pushes,
// and a token needs the EAS project id (app.json extra.eas.projectId). Real
// delivery needs a development or production build with push credentials.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { DevicePermission } from '@/src/features/notifications/lib/deviceState';

const TOKEN_KEY = 'fho_push_token';

export type PushStatus = 'enabled' | 'denied' | 'unsupported' | 'unavailable' | 'failed';

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

/** Show pushes that arrive while the app is open, quietly. */
export function configureForegroundNotifications() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Whether this build can receive remote pushes at all. Not on the web; not in
 * Expo Go on Android (removed in SDK 53); not without an EAS project id. A
 * yes here is not proof of delivery: that needs a store or development build
 * with push credentials.
 */
export function remotePushSupported(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return projectId() !== null;
}

/**
 * The OS permission with whether the app may still ask. iOS provisional
 * (quiet) authorisation counts as granted. Never asks.
 */
export async function readPermission(): Promise<DevicePermission | null> {
  if (Platform.OS === 'web') return null;
  try {
    const p = await Notifications.getPermissionsAsync();
    const iosStatus = p.ios?.status;
    const quietlyAllowed =
      iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL;
    return { status: quietlyAllowed ? 'granted' : p.status, canAskAgain: p.canAskAgain };
  } catch {
    return { status: 'undetermined', canAskAgain: true };
  }
}

/** Shows the OS prompt (from a button press only) and returns the result. */
export async function requestPermission(): Promise<DevicePermission | null> {
  if (Platform.OS === 'web') return null;
  if (Platform.OS === 'android') {
    // Android 13+ shows the prompt only once a channel exists.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Shtëpia.ime',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
  try {
    await Notifications.requestPermissionsAsync();
  } catch {
    // Falls through to reading the state again.
  }
  return readPermission();
}

/** Registers this device's token for the signed-in person. */
export async function registerDevice(): Promise<'registered' | 'failed'> {
  return (await registerToken()) === 'enabled' ? 'registered' : 'failed';
}

async function registerToken(): Promise<PushStatus> {
  const id = projectId();
  if (!id) return 'unavailable';
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    if (error) return 'failed';
    await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
    return 'enabled';
  } catch {
    // Expo Go on Android, a simulator, or no network.
    return 'failed';
  }
}

/**
 * On start-up, if permission was already given, re-register: tokens can
 * change, and a device may have been moved to another account.
 * Never asks for permission.
 */
export async function refreshPushRegistration(): Promise<void> {
  if (Platform.OS === 'web') return;
  const { status } = await Notifications.getPermissionsAsync().catch(() => ({ status: 'undetermined' as const }));
  if (status === 'granted') await registerToken();
}

/** Forget this device for the signed-in person. Call before signing out. */
export async function forgetDevice(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await supabase.from('push_tokens').delete().eq('token', token).then(
    () => undefined,
    () => undefined,
  );
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}

/**
 * The in-app route a tapped notification asks for, if it is one the app knows.
 * Mirrors safeRoute() in supabase/functions/push-dispatch/logic.js.
 */
export function routeFromNotification(response: Notifications.NotificationResponse | null): string | null {
  const url = response?.notification.request.content.data?.url;
  return typeof url === 'string' && /^\/(messages\/[0-9a-f-]{36}|viewings)$/.test(url) ? url : null;
}
