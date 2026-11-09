import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';

/** Only a secure link is handed to the player. */
export function isPlayableVideo(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https:\/\//i.test(url);
}

// Mounted only while the sheet is open, so a listing page downloads no video
// until someone asks for it, and closing releases the player.
function Player({ uri, onRetry }: { uri: string; onRetry: () => void }) {
  const { t } = useTranslation();
  const player = useVideoPlayer(uri, (p) => p.play());
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  return (
    <View style={styles.stage}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />
      {status === 'loading' && (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" accessibilityLabel={t('common.loading')} />
        </View>
      )}
      {status === 'error' && (
        <View style={[styles.center, styles.failed]}>
          <MaterialIcons name="videocam-off" size={36} color="rgba(255,255,255,0.8)" />
          <Text style={styles.failedText} accessibilityLiveRegion="polite">{t('detail.videoFailed')}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={onRetry} style={styles.retry} activeOpacity={0.75}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/** The "Video" chip on a listing's photo, and the full-screen player it opens. */
export function ListingVideo({ uri }: { uri: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  return (
    <>
      <Pressable style={styles.chip} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={t('detail.video')}>
        <MaterialIcons name="play-arrow" size={20} color="#fff" />
        <Text style={styles.chipText}>{t('detail.video')}</Text>
      </Pressable>
      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)} supportedOrientations={['portrait', 'landscape']}>
        <SafeAreaView style={styles.screen}>
          {open && <Player key={attempt} uri={uri} onRetry={() => setAttempt((a) => a + 1)} />}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={styles.close}
            onPress={() => setOpen(false)}
            hitSlop={8}
            activeOpacity={0.75}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    left: 16,
    bottom: 12,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(20,17,14,0.72)',
  },
  chipText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: '#fff' },
  screen: { flex: 1, backgroundColor: '#000' },
  stage: { flex: 1 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  failed: { backgroundColor: '#000', gap: 12, padding: 32 },
  failedText: { fontFamily: Fonts.sansMedium, fontSize: 15, lineHeight: 21, color: '#fff', textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  retryText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: '#fff' },
  close: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
