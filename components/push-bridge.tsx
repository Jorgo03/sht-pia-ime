import type { NotificationResponse } from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { Notifications } from '@/lib/notifications-module';
import { useNotifications } from '@/contexts/notifications-context';
import { notificationIdFromResponse, refreshPushRegistration, routeFromNotification } from '@/lib/push';

/**
 * Wires push notifications into navigation (docs/LAUNCH_TASKS.md F14):
 * re-registers the device whenever someone signs in (only if permission was
 * already given; it never asks), and opens the right screen when a
 * notification is tapped, including one that launched the app.
 */
export function PushBridge() {
  const router = useRouter();
  const { user } = useAuth();
  const { markRead } = useNotifications();
  const handledColdStart = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || !user) return;
    void refreshPushRegistration();
  }, [user]);

  useEffect(() => {
    // Not in Expo Go on Android, where the package is not available.
    if (Platform.OS === 'web' || !Notifications) return;
    const open = (response: NotificationResponse | null) => {
      const id = notificationIdFromResponse(response);
      if (id) void markRead(id);
      const route = routeFromNotification(response);
      if (route) router.push(route as Href);
    };
    // One-shot: the notification that launched the app, if any.
    if (!handledColdStart.current) {
      handledColdStart.current = true;
      void Notifications.getLastNotificationResponseAsync().then(open, () => {});
    }
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [router, markRead]);

  return null;
}
