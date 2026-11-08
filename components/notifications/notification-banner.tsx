import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Shadows, type AtticoPalette } from '@/constants/theme';
import { useNotifications } from '@/contexts/notifications-context';
import { useTheme } from '@/contexts/theme-context';
import { formatRelativeTime } from '@/lib/format';
import { notificationCopy, notificationRoute } from '@/src/features/notifications/lib/feed';

const VISIBLE_MS = 6000;

/** The banner that drops in when something arrives while the app is open. */
export function NotificationBanner() {
  const { banner, dismissBanner, markRead } = useNotifications();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(dismissBanner, VISIBLE_MS);
    return () => clearTimeout(timer);
    // Each new notification restarts the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner?.id, banner?.created_at]);

  if (!banner) return null;
  const { title, body } = notificationCopy(banner, t);

  const open = () => {
    dismissBanner();
    void markRead(banner.id);
    router.push((notificationRoute(banner) ?? '/notifications') as Href);
  };

  return (
    <Animated.View
      key={banner.id}
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(160)}
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + 8 }]}>
      <View style={styles.card} accessibilityLiveRegion="polite">
        <Pressable style={styles.main} onPress={open} accessibilityRole="button" accessibilityLabel={`${title}. ${body}`}>
          <View style={styles.icon}>
            <MaterialIcons name="notifications" size={20} color={colors.accent} />
          </View>
          <View style={styles.text}>
            <View style={styles.row}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <Text style={styles.time}>{formatRelativeTime(banner.created_at, i18n.language)}</Text>
            </View>
            <Text style={styles.body} numberOfLines={2}>{body}</Text>
          </View>
        </Pressable>
        <Pressable style={styles.close} onPress={dismissBanner} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <MaterialIcons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 12,
      right: 12,
      alignItems: 'center',
      zIndex: 1000,
      elevation: 1000,
    },
    card: {
      width: '100%',
      maxWidth: 456,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...Shadows.nav,
    },
    main: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      minHeight: 64,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.glass,
    },
    text: {
      flex: 1,
      gap: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
    },
    title: {
      flexShrink: 1,
      fontSize: 14,
      fontFamily: Fonts.sansBold,
      color: colors.textPrimary,
    },
    time: {
      fontSize: 12,
      fontFamily: Fonts.sans,
      color: colors.textSecondary,
    },
    body: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: Fonts.sans,
      color: colors.textSecondary,
    },
    close: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
