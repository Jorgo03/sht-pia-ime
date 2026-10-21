import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryCTA } from '@/components/ui/buttons';
import { Fonts, Radii, Spacing, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { enablePush, pushPermission, type PushStatus } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type NotificationPreferences,
} from '@/src/features/notifications/lib/preferences';
import { webColumn } from '@/constants/web-frame';

type Shown = PushStatus | 'checking' | 'off';

/**
 * Profile -> Notifications (docs/LAUNCH_TASKS.md F14). Permission is asked
 * only when the person presses "Turn on", never on launch. The two switches
 * are stored server-side, so they also hold on a new phone.
 * The parent mounts this only while it is open.
 */
export function NotificationsSheet({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [status, setStatus] = useState<Shown>('checking');
  const [prefs, setPrefs] = useState<NotificationPreferences>({ ...DEFAULT_PREFERENCES });
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([pushPermission(), loadPreferences(supabase, userId)]).then(([permission, saved]) => {
      if (!active) return;
      setStatus(permission === 'granted' ? 'enabled' : permission === 'denied' ? 'denied' : permission === 'unsupported' ? 'unsupported' : 'off');
      setPrefs(saved);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const turnOn = async () => {
    setBusy(true);
    setStatus(await enablePush());
    setBusy(false);
  };

  const toggle = async (key: keyof NotificationPreferences, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaveFailed(false);
    if (!(await savePreferences(supabase, next))) {
      setPrefs(prefs);
      setSaveFailed(true);
    }
  };

  const statusText: Record<Shown, string> = {
    checking: t('common.loading'),
    off: t('notifications.off'),
    enabled: t('notifications.enabled'),
    denied: t('notifications.denied'),
    unsupported: t('notifications.unavailable'),
    unavailable: t('notifications.unavailable'),
    failed: t('notifications.unavailable'),
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <SafeAreaView edges={['bottom']} style={[styles.sheet, webColumn]}>
          <View style={styles.grip} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {t('notifications.title')}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <MaterialIcons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.body}>
            <Text style={styles.status} accessibilityLiveRegion="polite">
              {statusText[status]}
            </Text>
            {status === 'off' || status === 'failed' ? (
              <PrimaryCTA label={busy ? t('common.loading') : t('notifications.turnOn')} icon="notifications-active" loading={busy} disabled={busy} onPress={turnOn} />
            ) : null}
            {status === 'denied' ? (
              <PrimaryCTA label={t('notifications.openSettings')} icon="settings" onPress={() => void Linking.openSettings()} />
            ) : null}

            <View style={styles.row}>
              <Text style={styles.rowText}>{t('notifications.messages')}</Text>
              <Switch
                value={prefs.messages}
                onValueChange={(v) => void toggle('messages', v)}
                accessibilityLabel={t('notifications.messages')}
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.rowText}>{t('notifications.viewings')}</Text>
              <Switch
                value={prefs.viewings}
                onValueChange={(v) => void toggle('viewings', v)}
                accessibilityLabel={t('notifications.viewings')}
              />
            </View>
            {saveFailed ? <Text style={styles.error}>{t('notifications.saveFailed')}</Text> : null}
            <Text style={styles.hint}>{t('notifications.privacy')}</Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheetWrap: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.primaryLight,
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
    },
    grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 10 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
    },
    title: { fontFamily: Fonts.serifSemiBold, fontSize: 22, color: colors.textPrimary },
    body: { padding: Spacing.xl, gap: Spacing.md },
    status: { fontFamily: Fonts.sans, fontSize: 15, color: colors.textPrimary },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 48,
      paddingHorizontal: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
    },
    rowText: { fontFamily: Fonts.sans, fontSize: 15, color: colors.textPrimary, flex: 1 },
    hint: { fontFamily: Fonts.sans, fontSize: 12, color: colors.textSecondary },
    error: { fontFamily: Fonts.sans, fontSize: 13, color: colors.error },
  });
