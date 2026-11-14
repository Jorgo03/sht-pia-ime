import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { LoadError } from '@/components/ui/load-error';
import { SignInPrompt } from '@/components/ui/sign-in-prompt';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { fetchPublicProfile, profileInitials } from '@/src/features/profiles/lib/publicProfile';
import { unblockUser } from '@/src/features/safety/lib/safety';

interface Blocked {
  id: string;
  name: string | null;
}

/** Your blocks, newest first, each with a name where one may be shown. */
async function fetchBlocked(): Promise<Blocked[]> {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const ids = (data ?? []).map((row: { blocked_id: string }) => row.blocked_id);
  // A name where the database lets this person see one (someone they talked
  // to, an agent, a publisher); otherwise a plain "User".
  const rows = await Promise.all(ids.map((id) => fetchPublicProfile(supabase, id).catch(() => null)));
  return ids.map((id, i) => ({ id, name: rows[i]?.full_name?.trim() || null }));
}

/**
 * The people you have blocked, with Unblock. A block stops messages both ways
 * and new conversations (migration 20261114154750_chat_safety); unblocking
 * restores the existing conversation as it was. Only your own blocks are
 * listed: the database never shows anyone who blocked you.
 */
export default function BlockedUsersScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const queryKey = ['blocked-users', user?.id ?? ''];
  const { data: people, isError: failed, refetch } = useQuery({
    queryKey,
    queryFn: fetchBlocked,
    enabled: !!user,
    retry: false,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [unblockFailed, setUnblockFailed] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/profile' as Href);
  };

  const unblock = async (id: string) => {
    setBusy(id);
    setUnblockFailed(false);
    const ok = await unblockUser(supabase, id);
    setBusy(null);
    if (ok) queryClient.setQueryData<Blocked[]>(queryKey, (prev) => (prev ?? []).filter((p) => p.id !== id));
    else setUnblockFailed(true);
  };

  if (!user) return authLoading ? null : <SignInPrompt message={t('messages.loginPrompt')} />;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader onBack={goBack} showControls={false} title={t('safety.blockedUsers')} titleIsHeading />
        {failed ? (
          <View style={styles.center}>
            <LoadError onRetry={() => void refetch()} />
          </View>
        ) : !people ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={people}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}
            ListHeaderComponent={
              unblockFailed ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {t('errors.generic')}
                </Text>
              ) : undefined
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <MaterialIcons name="block" size={28} color={colors.textSecondary} />
                <Text style={styles.emptyText}>{t('safety.noBlocked')}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const name = item.name ?? t('publicProfile.unnamed');
              return (
                <View style={styles.row}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{profileInitials(item.name)}</Text>
                  </View>
                  <Text style={styles.name} numberOfLines={1}>
                    {name}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${t('safety.unblockUser')}: ${name}`}
                    onPress={() => void unblock(item.id)}
                    disabled={busy === item.id}
                    style={[styles.unblock, busy === item.id && styles.unblockBusy]}>
                    <Text style={styles.unblockText}>
                      {busy === item.id ? t('common.loading') : t('safety.unblockUser')}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    list: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.primaryLight,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: { fontFamily: Fonts.sansBold, fontSize: 15, color: '#fff' },
    name: { flex: 1, fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.textPrimary },
    unblock: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.accent,
      justifyContent: 'center',
    },
    unblockBusy: { opacity: 0.6 },
    unblockText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.accent },
    empty: {
      alignItems: 'center',
      gap: 10,
      padding: 24,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.primaryLight,
    },
    emptyText: { fontFamily: Fonts.sans, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    error: { fontFamily: Fonts.sans, fontSize: 13, color: colors.error, textAlign: 'center', marginBottom: 8 },
  });
