import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Linking, Modal, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SheetCloseButton } from '@/components/ui/sheet-close-button';
import { GhostBtn, PrimaryCTA } from '@/components/ui/buttons';
import { Fonts, Radii, Spacing, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { readPermission, registerDevice, remotePushSupported, requestPermission } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import {
  canReceive,
  canTurnOn,
  createLatestSaver,
  deviceState,
  type DeviceNotificationState,
  type DevicePermission,
} from '@/src/features/notifications/lib/deviceState';
import {
  readPreferences,
  savePreferences,
  type NotificationPreferences,
} from '@/src/features/notifications/lib/preferences';
import { webColumn } from '@/constants/web-frame';

const PLATFORM = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

type Category = keyof NotificationPreferences;
const WEB_THUMB = (Platform.OS === 'web' ? { activeThumbColor: '#ffffff' } : {}) as object;

/**
 * Profile -> Notifications (docs/LAUNCH_TASKS.md F14). Two separate things:
 * - this phone: the OS permission (asked only from the button, re-read when
 *   the app returns from Settings) and whether its token is registered;
 * - the account: the two category switches, saved server-side, so they hold
 *   on every device and stay editable while this phone's permission is off.
 * The parent mounts this only while it is open.
 */
export function NotificationsSheet({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // ── This phone ──
  const remoteSupported = useMemo(() => remotePushSupported(), []);
  const [permission, setPermission] = useState<DevicePermission | null>(null);
  const [registration, setRegistration] = useState<'registered' | 'failed' | null>(null);
  const registered = useRef(false);
  const [asking, setAsking] = useState(false);
  const state: DeviceNotificationState = deviceState({ platform: PLATFORM, remoteSupported, permission, registration });

  const register = useCallback(async () => {
    const result = await registerDevice();
    if (!mounted.current) return;
    registered.current = result === 'registered';
    setRegistration(result);
  }, []);

  const checkDevice = useCallback(async () => {
    if (PLATFORM === 'web' || !remoteSupported) return;
    const current = await readPermission();
    if (!mounted.current) return;
    setPermission(current);
    if (current?.status === 'granted' && !registered.current) await register();
  }, [remoteSupported, register]);

  useEffect(() => {
    void checkDevice();
    // Back from the phone's Settings (or any return to the app): read again.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void checkDevice();
    });
    return () => sub.remove();
  }, [checkDevice]);

  const turnOn = async () => {
    if (asking) return;
    setAsking(true);
    try {
      const current = permission?.status === 'granted' ? permission : await requestPermission();
      if (!mounted.current) return;
      setPermission(current);
      if (current?.status === 'granted') {
        setRegistration(null);
        await register();
      }
    } finally {
      if (mounted.current) setAsking(false);
    }
  };

  // ── The account's choices ──
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // What the server last confirmed, and the newest choice on screen.
  const confirmed = useRef<NotificationPreferences | null>(null);
  const latest = useRef<NotificationPreferences | null>(null);
  // The parent keys this sheet by account, so a saver never outlives its user.
  const save = useMemo(() => createLatestSaver<NotificationPreferences>((value) => savePreferences(supabase, value)), []);

  const applyLoaded = useCallback(({ ok, prefs: saved }: { ok: boolean; prefs: NotificationPreferences }) => {
    if (!mounted.current) return;
    if (!ok) {
      setLoadState('failed');
      return;
    }
    confirmed.current = saved;
    latest.current = saved;
    setPrefs(saved);
    setLoadState('ready');
  }, []);

  useEffect(() => {
    readPreferences(supabase, userId).then(applyLoaded);
  }, [userId, applyLoaded]);

  const retryLoad = () => {
    setLoadState('loading');
    readPreferences(supabase, userId).then(applyLoaded);
  };

  const toggle = (key: Category) => {
    // Until the saved choices are read, a save would overwrite them with defaults.
    if (loadState !== 'ready' || !latest.current) return;
    const next = { ...latest.current, [key]: !latest.current[key] };
    latest.current = next;
    setPrefs(next);
    setSaveFailed(false);
    setSaving(true);
    void save(next).then(({ ok, value }) => {
      // A newer tap is being saved; its result decides what is shown.
      if (!mounted.current || latest.current !== value) return;
      setSaving(false);
      if (ok) {
        confirmed.current = value;
        return;
      }
      latest.current = confirmed.current;
      setPrefs(confirmed.current);
      setSaveFailed(true);
    });
  };

  const statusText: Record<DeviceNotificationState, string> = {
    web: t('notifications.web'),
    unavailable: t('notifications.unavailable'),
    checking: t('common.loading'),
    off: t('notifications.off'),
    blocked: t('notifications.denied'),
    registering: t('notifications.registering'),
    registerFailed: t('notifications.registerFailed'),
    on: t('notifications.enabled'),
  };
  const receiving = canReceive(state);
  const switchesReady = loadState === 'ready' && prefs !== null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <SafeAreaView edges={['bottom']} style={[styles.sheet, webColumn]}>
          <View style={styles.grip} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {t('notifications.title')}
            </Text>
            <SheetCloseButton onPress={onClose} />
          </View>
          <View style={styles.body}>
            <View style={styles.statusRow}>
              <MaterialIcons
                name={receiving ? 'notifications-active' : 'notifications-off'}
                size={20}
                color={receiving ? colors.accentText : colors.textSecondary}
              />
              <Text style={styles.status} accessibilityLiveRegion="polite">
                {statusText[state]}
              </Text>
            </View>
            {state === 'blocked' ? <Text style={styles.hint}>{t('notifications.settingsHint')}</Text> : null}
            {canTurnOn(state) ? (
              <PrimaryCTA
                label={state === 'registerFailed' ? t('common.retry') : t('notifications.turnOn')}
                icon="notifications-active"
                loading={asking}
                disabled={asking}
                onPress={() => void turnOn()}
              />
            ) : null}
            {state === 'blocked' ? (
              <PrimaryCTA label={t('notifications.openSettings')} icon="settings" onPress={() => void Linking.openSettings()} />
            ) : null}

            {(['messages', 'viewings'] as const).map((key) => {
              const value = prefs?.[key] ?? false;
              return (
                // The row is the one control: the switch inside is drawn only,
                // so a tap on it cannot fire a second, conflicting update.
                <Pressable
                  key={key}
                  style={[styles.row, !switchesReady && styles.rowDisabled]}
                  onPress={() => toggle(key)}
                  disabled={!switchesReady}
                  role="switch"
                  aria-label={t(`notifications.${key}`)}
                  aria-checked={value}
                  aria-disabled={!switchesReady}>
                  <Text style={styles.rowText}>{t(`notifications.${key}`)}</Text>
                  <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    <Switch
                      value={value}
                      disabled={!switchesReady}
                      // Full orange only when this phone can actually receive;
                      // otherwise "on" is a saved choice, drawn muted.
                      trackColor={{ false: colors.border, true: receiving ? colors.accent : colors.textFaint }}
                      thumbColor="#ffffff"
                      ios_backgroundColor={colors.border}
                      // react-native-web draws an "on" thumb in its own teal unless told.
                      {...WEB_THUMB}
                    />
                  </View>
                </Pressable>
              );
            })}
            {switchesReady && !receiving ? <Text style={styles.hint}>{t('notifications.prefsNote')}</Text> : null}
            {saving ? <Text style={styles.hint}>{t('notifications.saving')}</Text> : null}
            {saveFailed ? (
              <Text style={styles.error} accessibilityLiveRegion="assertive">
                {t('notifications.saveFailed')}
              </Text>
            ) : null}
            {loadState === 'failed' ? (
              <View style={styles.loadFailed}>
                <Text style={styles.error} accessibilityLiveRegion="assertive">
                  {t('notifications.loadFailed')}
                </Text>
                <GhostBtn label={t('common.retry')} icon="refresh" onPress={retryLoad} />
              </View>
            ) : null}
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
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    status: { flex: 1, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 21, color: colors.textPrimary },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      minHeight: 56,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
    },
    rowDisabled: { opacity: 0.6 },
    rowText: { flex: 1, flexShrink: 1, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 21, color: colors.textPrimary },
    loadFailed: { gap: Spacing.sm },
    hint: { fontFamily: Fonts.sans, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
    error: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18, color: colors.error },
  });
