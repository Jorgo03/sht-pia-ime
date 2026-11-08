import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/ui/action-button';
import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { readPermission, registerDevice, remotePushSupported, requestPermission } from '@/lib/push';

const ANSWERED_KEY = 'fho_push_invite_answered';

/**
 * Says why notifications help, once, before the phone asks. The system prompt
 * appears only after "Turn on", and never again once answered: Profile ->
 * Notifications is the place to change it later.
 */
export function NotificationInvite() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user || !remotePushSupported()) {
      setVisible(false);
      return;
    }
    (async () => {
      const [answered, permission] = await Promise.all([
        AsyncStorage.getItem(ANSWERED_KEY).catch(() => null),
        readPermission(),
      ]);
      if (active) setVisible(!answered && permission?.status === 'undetermined' && permission.canAskAgain);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (!visible) return null;

  const close = () => {
    setVisible(false);
    AsyncStorage.setItem(ANSWERED_KEY, '1').catch(() => {});
  };

  const turnOn = async () => {
    setBusy(true);
    const result = await requestPermission();
    if (result?.status === 'granted') await registerDevice();
    setBusy(false);
    close();
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <MaterialIcons name="notifications-active" size={22} color={colors.accent} />
        <Text style={styles.title}>{t('notifications.inviteTitle')}</Text>
      </View>
      <Text style={styles.body}>{t('notifications.inviteBody')}</Text>
      <ActionButton title={busy ? t('common.loading') : t('notifications.turnOn')} onPress={turnOn} disabled={busy} />
      <Pressable style={styles.later} onPress={close} accessibilityRole="button">
        <Text style={styles.laterText}>{t('notifications.inviteLater')}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    card: {
      marginHorizontal: 20,
      marginTop: 12,
      padding: 16,
      gap: 10,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.primaryLight,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      flex: 1,
      fontSize: 16,
      fontFamily: Fonts.sansBold,
      color: colors.textPrimary,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.sans,
      color: colors.textSecondary,
    },
    later: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    laterText: {
      fontSize: 14,
      fontFamily: Fonts.sansSemiBold,
      color: colors.textSecondary,
    },
  });
