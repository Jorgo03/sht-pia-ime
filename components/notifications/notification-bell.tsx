import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useNotifications } from '@/contexts/notifications-context';
import { useTheme } from '@/contexts/theme-context';

/** The header's bell, with the live unread count. Signed-in only. */
export function NotificationBell({ style, iconColor }: { style?: StyleProp<ViewStyle>; iconColor: string }) {
  const { user } = useAuth();
  const { unread } = useNotifications();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  if (!user) return null;

  const label = unread > 0 ? `${t('notifications.title')}, ${unread}` : t('notifications.title');
  return (
    <Pressable
      style={style}
      hitSlop={6}
      onPress={() => router.push('/notifications' as Href)}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <MaterialIcons name="notifications-none" size={20} color={iconColor} />
      {unread > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    minHeight: 18,
    borderRadius: 999,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 14,
    fontFamily: Fonts.sansBold,
    color: '#fff',
  },
});
