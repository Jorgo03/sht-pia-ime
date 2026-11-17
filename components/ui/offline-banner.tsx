import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';

const subscribe = (onChange: () => void) => onlineManager.subscribe(onChange);
const getOnline = () => onlineManager.isOnline();
// The pre-rendered website page is always drawn online, so the browser's first
// draw matches it (React #418); a real offline state shows right after.
const getServerOnline = () => true;

/**
 * A thin bar at the top while the device is offline (AUDIT-009). It reads the
 * same online state React Query uses (lib/online-manager.ts), so the banner and
 * the paused queries always agree. Screens keep what they last loaded; this
 * explains why nothing new arrives, and it goes away when the connection is back.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, getOnline, getServerOnline);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (online) return null;
  return (
    <View
      style={[styles.bar, { paddingTop: insets.top + 6 }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID="offline-banner">
      <MaterialIcons name="wifi-off" size={16} color="#fff" />
      <Text style={styles.text} numberOfLines={2}>
        {t('errors.offline')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    // Information only: taps go through to the screen below.
    pointerEvents: 'none',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    // The same dark bar in both themes, so white text always reads.
    backgroundColor: '#1a1714',
  },
  text: {
    flexShrink: 1,
    color: '#fff',
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
  },
});
