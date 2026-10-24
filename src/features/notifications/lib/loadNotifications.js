// Whether to load expo-notifications, and loading it safely
// (lib/notifications-module.ts). Pure, for `npm test`.
//
// On Android the package's entry point requires the native module
// ExpoTopicSubscriptionModule at load time and throws when it is missing.
// Expo Go on Android ships without it (push was removed there in SDK 53), and
// an uncaught throw there stopped the whole app from opening. Three guards,
// any one of which is enough:
// 1. Expo Go on Android, detected the way expo-notifications itself does;
// 2. on Android, the native module the import needs is missing;
// 3. the load throws anyway: report it and carry on without notifications.
export function loadNotifications({ platform, inExpoGo, hasNativeModule, load, onError }) {
  if (platform === 'android' && (inExpoGo || !hasNativeModule('ExpoTopicSubscriptionModule'))) return null
  try {
    return load()
  } catch (error) {
    onError?.(error)
    return null
  }
}
