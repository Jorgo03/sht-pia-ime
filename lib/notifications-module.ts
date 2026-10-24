// expo-notifications, or null where the package cannot be loaded.
//
// Expo Go on Android has shipped without expo-notifications' native modules
// since SDK 53. In SDK 58, importing the package there throws at load time
// ("Cannot find native module 'ExpoTopicSubscriptionModule'"), and because the
// auth context imports lib/push, that one throw stopped the whole app from
// opening on Android. The decision and its three guards are in
// src/features/notifications/lib/loadNotifications.js. Store and development
// builds load the package; push never worked in Expo Go on Android anyway.
import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { debugWarn } from '@/lib/debug';
import { loadNotifications } from '@/src/features/notifications/lib/loadNotifications';

type NotificationsModule = typeof import('expo-notifications');

/** Running inside the Expo Go app on Android. */
export const isExpoGoAndroid = Platform.OS === 'android' && isRunningInExpoGo();

export const Notifications: NotificationsModule | null = loadNotifications<NotificationsModule>({
  platform: Platform.OS,
  inExpoGo: isRunningInExpoGo(),
  hasNativeModule: (name) => requireOptionalNativeModule(name) != null,
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a static import would load the package where its native code is missing, which is the crash this file exists to avoid.
  load: () => require('expo-notifications') as NotificationsModule,
  onError: (error) => debugWarn('expo-notifications unavailable', error),
});
