import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ReportSheet } from '@/components/safety/report-sheet';
import { AppHeader } from '@/components/ui/app-header';
import { SignInPrompt } from '@/components/ui/sign-in-prompt';
import { type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { KeyboardDoneBar } from '@/components/ui/keyboard-done-bar';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { formatRelativeTime, getLocalizedText } from '@/lib/format';
import {
  blockUser,
  isBlockedSendError,
  loadBlockedIds,
  unblockUser,
} from '@/src/features/safety/lib/safety';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

interface ConversationInfo {
  id: string;
  client_id: string;
  agent_id: string;
  property_id: string | null;
}

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // The conversation could not be read: not this account's (an old
  // notification after switching accounts), or gone.
  const [unavailable, setUnavailable] = useState(false);
  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [otherName, setOtherName] = useState('?');
  const [propertyTitle, setPropertyTitle] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // null, or the reason the last send failed.
  const [sendError, setSendError] = useState<null | 'failed' | 'blockedByThem'>(null);
  const [loading, setLoading] = useState(true);
  const [otherId, setOtherId] = useState<string | null>(null);
  // Whether *I* blocked the other person (only the blocker can see a block).
  const [blocked, setBlocked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [safetyError, setSafetyError] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  // The postgres_changes handler below is created once when the effect
  // mounts (conversation is still null at that point) and never recreated,
  // so it can't read state updates directly — it reads this ref instead,
  // kept fresh by the effect underneath.
  const conversationRef = useRef<ConversationInfo | null>(null);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  const markRead = useCallback(
    (convo: ConversationInfo, isClient: boolean) => {
      const patch = isClient ? { unread_for_client: 0 } : { unread_for_agent: 0 };
      supabase.from('conversations').update(patch).eq('id', convo.id).then(() => {});
    },
    [],
  );

  // Loads the conversation header info (other party + property) once, then
  // the message history, then subscribes for new INSERTs — same shape as
  // the web app's Thread component.
  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;

    (async () => {
      const { data: convo } = await supabase
        .from('conversations')
        .select('id, client_id, agent_id, property_id')
        .eq('id', id)
        .single();
      if (cancelled) return;
      if (!convo) {
        setUnavailable(true);
        setLoading(false);
        return;
      }
      setConversation(convo);

      const otherId = convo.client_id === user.id ? convo.agent_id : convo.client_id;
      setOtherId(otherId);
      const [profRes, propRes, blockedIds] = await Promise.all([
        supabase.from('profiles').select('full_name, agency_name').eq('id', otherId).single(),
        convo.property_id
          ? supabase.from('properties').select('id, title, title_i18n').eq('id', convo.property_id).single()
          : Promise.resolve({ data: null }),
        loadBlockedIds(supabase),
      ]);
      if (cancelled) return;
      setBlocked(blockedIds.has(otherId));
      setOtherName(profRes.data?.full_name || profRes.data?.agency_name || '?');
      if (propRes.data) {
        setPropertyId(propRes.data.id);
        setPropertyTitle(getLocalizedText(propRes.data.title_i18n, i18n.language) || propRes.data.title);
      }

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      setMessages(msgs ?? []);
      setLoading(false);
      markRead(convo, convo.client_id === user.id);
    })();

    const channel = supabase
      .channel(`thread-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        ({ new: msg }: { new: Message }) => {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          const convo = conversationRef.current;
          if (msg.sender_id !== user.id && convo) markRead(convo, convo.client_id === user.id);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // conversation is intentionally excluded — the realtime handler reads
    // conversationRef instead, so this effect doesn't need to restart (and
    // resubscribe the channel) every time conversation state loads/changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, markRead]);

  useEffect(() => {
    if (messages.length > 0) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending || !user || !id) return;
    setSending(true);
    setSendError(null);
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: id, sender_id: user.id, body })
      .select('*')
      .single();
    setSending(false);
    if (!error && data) {
      setText('');
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    } else {
      // Refused by the database because the other person blocked you.
      setSendError(isBlockedSendError(error) ? 'blockedByThem' : 'failed');
    }
  };

  const toggleBlock = async () => {
    if (!otherId) return;
    setSafetyError(false);
    if (blocked) {
      if (await unblockUser(supabase, otherId)) setBlocked(false);
      else setSafetyError(true);
      return;
    }
    Alert.alert(t('safety.blockUser'), t('safety.blockConfirm', { name: otherName }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('safety.blockUser'),
        style: 'destructive',
        onPress: async () => {
          if (await blockUser(supabase, otherId)) setBlocked(true);
          else setSafetyError(true);
        },
      },
    ]);
  };

  // A native action sheet would need a new library; an Alert with options is
  // the built-in equivalent on both platforms.
  const openMenu = () =>
    Alert.alert(otherName, undefined, [
      { text: t('safety.reportUser'), onPress: () => setReportOpen(true) },
      {
        text: blocked ? t('safety.unblockUser') : t('safety.blockUser'),
        style: blocked ? 'default' : 'destructive',
        onPress: () => void toggleBlock(),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);

  // Signed out (a notification left in the tray, a link) the load never
  // starts, so this used to be a spinner forever.
  if (!user) return authLoading ? null : <SignInPrompt message={t('messages.loginPrompt')} />;

  if (unavailable) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader onBack={() => router.back()} showControls={false} />
        <View style={styles.center}>
          <Text style={styles.unavailableText}>{t('messages.unavailable')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* The correspondent's name and avatar stay — they're the only cue as
            to who you're talking to — so they take the header's title/avatar
            slots rather than being displaced by the wordmark. Language and
            theme are off for room; both are a tap away on Profile. */}
        <AppHeader
          onBack={() => router.back()}
          showControls={false}
          title={otherName}
          titleIsHeading
          trailing={
            <TouchableOpacity
              onPress={openMenu}
              style={styles.menuButton}
              accessibilityRole="button"
              accessibilityLabel={t('safety.menu')}
              hitSlop={8}>
              <MaterialIcons name="more-vert" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          }
          avatar={
            <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>{otherName[0]?.toUpperCase() || '?'}</Text>
            </LinearGradient>
          }
          subtitle={
            propertyTitle ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => propertyId && router.push(`/property/${propertyId}` as Href)}>
                <Text style={styles.headerProperty} numberOfLines={1}>
                  {propertyTitle}
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('messages.noMessages')}</Text>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.id;
            const body = (
              <>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
                <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                  {formatRelativeTime(item.created_at, i18n.language)}
                </Text>
              </>
            );
            return mine ? (
              <LinearGradient colors={[colors.accent, colors.accentEnd]} style={[styles.bubble, styles.bubbleMine]}>
                {body}
              </LinearGradient>
            ) : (
              <View style={[styles.bubble, styles.bubbleTheirs]}>{body}</View>
            );
          }}
        />

        {sendError || safetyError ? (
          <Text style={styles.sendError} accessibilityLiveRegion="polite">
            {safetyError
              ? t('errors.generic')
              : sendError === 'blockedByThem'
                ? t('safety.cannotMessage')
                : t('messages.sendFailed')}
          </Text>
        ) : null}

        {blocked ? (
          <View style={styles.blockedRow} accessibilityLiveRegion="polite">
            <Text style={styles.blockedText}>{t('safety.blocked')}</Text>
            <TouchableOpacity onPress={toggleBlock} style={styles.unblockButton} accessibilityRole="button">
              <Text style={styles.unblockText}>{t('safety.unblockUser')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={t('messages.inputPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <TouchableOpacity
            accessibilityRole="button" accessibilityLabel={t('common.send')}
            onPress={send}
            disabled={sending || !text.trim()}
            activeOpacity={0.8}
            style={(!text.trim() || sending) && styles.sendButtonDisabled}>
            <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.sendButton}>
              <MaterialIcons name="send" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
        )}
        <ReportSheet visible={reportOpen} userId={otherId} onClose={() => setReportOpen(false)} />
        <KeyboardDoneBar />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  unavailableText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  headerProperty: {
    fontSize: 12,
    color: colors.accentText,
  },
  messageList: {
    padding: 16,
    gap: 10,
    flexGrow: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 40,
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  // Matches web's .msg-bubble tail corners (14 14 14 4) / .mine (14 14 4 14)
  // rather than a uniform radius on both sides.
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  bubbleTextMine: {
    color: '#fff',
  },
  bubbleTime: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.75)',
  },
  sendError: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.error,
    paddingVertical: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  blockedText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  unblockButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unblockText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
