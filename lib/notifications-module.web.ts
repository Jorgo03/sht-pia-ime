// The web build never uses push: every caller in lib/push.ts and
// components/push-bridge.tsx returns early on the web. Resolving this file
// instead of notifications-module.ts keeps expo-notifications (~100KB) out of
// the website's bundle. Same exports, so callers need no web branch of their own.
type NotificationsModule = typeof import('expo-notifications');

export const isExpoGoAndroid = false;

export const Notifications: NotificationsModule | null = null;
