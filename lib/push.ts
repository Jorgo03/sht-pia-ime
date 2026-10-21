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
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

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

/** Current OS permission, without asking. */
export async function pushPermission(): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  if (Platform.OS === 'web') return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
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

/** Ask for permission (once, from a button press) and register this device. */
export async function enablePush(): Promise<PushStatus> {
  if (Platform.OS === 'web') return 'unsupported';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Shtëpia.ime',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';
  return registerToken();
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
