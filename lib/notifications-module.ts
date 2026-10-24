// expo-notifications, or null where the package cannot be loaded.
//
// Expo Go on Android has shipped without expo-notifications' native modules
// since SDK 53. In SDK 58, importing the package there throws at load time
// ("Cannot find native module 'ExpoTopicSubscriptionModule'"), and because the
// auth context imports lib/push, that one throw stopped the whole app from
// opening on Android. So the package is required only where it exists. Store
// and development builds always load it; push never worked in Expo Go on
// Android anyway.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

/** Running inside the Expo Go app on Android. */
export const isExpoGoAndroid =
  Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const Notifications: NotificationsModule | null = isExpoGoAndroid
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports -- a static import would load the package in Expo Go on Android, which is the crash this file exists to avoid.
    (require('expo-notifications') as NotificationsModule);
