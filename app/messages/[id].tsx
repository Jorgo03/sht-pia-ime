import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ReportSheet } from '@/components/safety/report-sheet';
import { confirmAction } from '@/lib/confirm';
import { AppHeader } from '@/components/ui/app-header';
import { SignInPrompt } from '@/components/ui/sign-in-prompt';
import { type AtticoPalette, Fonts } from '@/constants/theme';
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
import { isNotFound, loadThreadMessages } from '@/src/features/messaging/lib/thread';
import { createCatchUp, mergeMessages } from '@/src/features/messaging/lib/catchUp';
import { fetchPublicProfile, otherParticipant } from '@/src/features/profiles/lib/publicProfile';
import { MessageAttachment } from '@/components/messaging/message-attachment';
import {
  AttachmentTooLarge,
  pickChatDocument,
  pickChatPhoto,
  removeChatFile,
  uploadChatFile,
  type PickedFile,
  type PickResult,
} from '@/lib/message-attachments';
import {
  MAX_ATTACHMENT_MB,
  formatBytes,
  readAttachment,
  type Attachment,
} from '@/src/features/messaging/lib/attachments';
import { FORM_LIMITS } from '@/src/lib/formLimits';
import { useReadableColumn } from '@/hooks/use-responsive';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  /** A photo or document (src/features/messaging/lib/attachments.js). */
  attachment?: unknown;
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
  // A centred column on an unfolded Fold or a spanned Duo (hooks/use-responsive).
  const readable = useReadableColumn();
  // The composer pads itself clear of the home indicator / Android nav bar
  // (SafeAreaView edges below); the KAV offset takes that inset back off so
  // the row still sits flush on the iOS keyboard.
  const insets = useSafeAreaInsets();
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
  // The load failed for a reason other than "not yours / gone" (offline,
  // timeout): shown with a retry, which bumps reloadKey.
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [otherId, setOtherId] = useState<string | null>(null);
  // Whether *I* blocked the other person (only the blocker can see a block).
  const [blocked, setBlocked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // The web's Report / Block menu (phones use the native Alert sheet).
  const [menuOpen, setMenuOpen] = useState(false);
  const [safetyError, setSafetyError] = useState(false);
  // A photo or document chosen to go with the next message, and why one could
  // not be chosen or sent.
  const [pendingFile, setPendingFile] = useState<PickedFile | null>(null);
  const [attachError, setAttachError] = useState<null | 'type' | 'size' | 'permission' | 'failed'>(null);
  // The web's Photo / Document menu (phones use the native Alert sheet).
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  // The postgres_changes handler below is created once when the effect
  // mounts (conversation is still null at that point) and never recreated,
  // so it can't read state updates directly — it reads this ref instead,
  // kept fresh by the effect underneath.
  const conversationRef = useRef<ConversationInfo | null>(null);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // Back to the inbox, whose bottom menu leads anywhere. With no history (a
  // notification cold start, a deep link) there is nothing to pop, so the
  // inbox is opened instead.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/messages' as Href);
  }, [router]);

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
      const { data: convo, error: convoError } = await supabase
        .from('conversations')
        .select('id, client_id, agent_id, property_id')
        .eq('id', id)
        .single();
      if (cancelled) return;
      if (!convo) {
        // Only "no such row" means not yours or gone; a dropped connection
        // used to say the same and offered no way to try again.
        if (convoError && !isNotFound(convoError)) setLoadFailed(true);
        else setUnavailable(true);
        setLoading(false);
        return;
      }
      setConversation(convo);

      const otherId = convo.client_id === user.id ? convo.agent_id : convo.client_id;
      setOtherId(otherId);
      // public_profile() rather than the profiles table: the table hides a
      // client from another client, so writing to a client who published a
      // listing showed "?" as the name. A failure only costs the name.
      const [profile, propRes, blockedIds] = await Promise.all([
        fetchPublicProfile(supabase, otherId).catch(() => null),
        convo.property_id
          ? supabase.from('properties').select('id, title, title_i18n').eq('id', convo.property_id).single()
          : Promise.resolve({ data: null }),
        loadBlockedIds(supabase),
      ]);
      if (cancelled) return;
      setBlocked(blockedIds.has(otherId));
      setOtherName(profile?.full_name?.trim() || profile?.agency_name?.trim() || '?');
      if (propRes.data) {
        setPropertyId(propRes.data.id);
        setPropertyTitle(getLocalizedText(propRes.data.title_i18n, i18n.language) || propRes.data.title);
      }

      const { messages: msgs } = await loadThreadMessages<Message>(supabase, id);
      if (cancelled) return;
      if (!msgs) {
        setLoadFailed(true);
        setLoading(false);
        return;
      }
      // Anything realtime delivered meanwhile stays, without duplicates.
      setMessages((prev) => [...msgs, ...prev.filter((m) => !msgs.some((l) => l.id === m.id))]);
      setLoading(false);
      markRead(convo, convo.client_id === user.id);
    })();

    // Realtime does not replay what was missed while the channel was down or
    // the app was in the background: re-read then, and merge (AUDIT-024).
    const catchUp = createCatchUp(async () => {
      const { messages: fresh } = await loadThreadMessages<Message>(supabase, id);
      if (cancelled || !fresh) return;
      setMessages((prev) => mergeMessages(prev, fresh));
      const convo = conversationRef.current;
      if (convo) markRead(convo, convo.client_id === user.id);
    });
    const appStateSub = AppState.addEventListener('change', catchUp.onAppState);

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
      .subscribe((status) => catchUp.onStatus(status));

    return () => {
      cancelled = true;
      appStateSub.remove();
      supabase.removeChannel(channel);
    };
    // conversation is intentionally excluded — the realtime handler reads
    // conversationRef instead, so this effect doesn't need to restart (and
    // resubscribe the channel) every time conversation state loads/changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, markRead, reloadKey]);

  useEffect(() => {
    if (messages.length > 0) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    const file = pendingFile;
    if ((!body && !file) || sending || !user || !id) return;
    setSending(true);
    setSendError(null);
    setAttachError(null);
    // The file goes up first, into this conversation's private folder; the
    // message then points at it. A refused message removes the file again.
    let attachment: Attachment | null = null;
    if (file) {
      try {
        attachment = await uploadChatFile(id, file);
      } catch (err) {
        setSending(false);
        setAttachError(err instanceof AttachmentTooLarge ? 'size' : 'failed');
        return;
      }
    }
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: id, sender_id: user.id, body, ...(attachment ? { attachment } : {}) })
      .select('*')
      .single();
    setSending(false);
    if (!error && data) {
      setText('');
      setPendingFile(null);
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    } else {
      if (attachment) void removeChatFile(attachment.path);
      // Refused by the database because the other person blocked you.
      setSendError(isBlockedSendError(error) ? 'blockedByThem' : 'failed');
    }
  };

  const takePick = (result: PickResult) => {
    if (!result) return; // cancelled
    if ('problem' in result) {
      setAttachError(result.problem);
      return;
    }
    setAttachError(null);
    setPendingFile(result.file);
  };

  const choose = async (kind: 'photo' | 'document') => {
    setAttachMenuOpen(false);
    try {
      takePick(kind === 'photo' ? await pickChatPhoto() : await pickChatDocument());
    } catch {
      setAttachError('failed');
    }
  };

  // Same pattern as the Report / Block menu: a native sheet on phones, a small
  // menu on the web, where Alert.alert does nothing.
  const openAttachMenu = () => {
    if (Platform.OS === 'web') {
      setAttachMenuOpen(true);
      return;
    }
    Alert.alert(t('messages.attach'), undefined, [
      { text: t('messages.attachPhoto'), onPress: () => void choose('photo') },
      { text: t('messages.attachDocument'), onPress: () => void choose('document') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const toggleBlock = async () => {
    if (!otherId) return;
    setSafetyError(false);
    if (blocked) {
      if (await unblockUser(supabase, otherId)) setBlocked(false);
      else setSafetyError(true);
      return;
    }
    confirmAction({
      title: t('safety.blockUser'),
      message: t('safety.blockConfirm', { name: otherName }),
      confirmText: t('safety.blockUser'),
      cancelText: t('common.cancel'),
      destructive: true,
      onConfirm: async () => {
        if (await blockUser(supabase, otherId)) setBlocked(true);
        else setSafetyError(true);
      },
    });
  };

  // A native action sheet would need a new library; an Alert with options is
  // the built-in equivalent on phones. react-native-web's Alert.alert does
  // nothing, so the web opens the same two choices as a small menu instead.
  const openMenu = () => {
    if (Platform.OS === 'web') {
      setMenuOpen(true);
      return;
    }
    Alert.alert(otherName, undefined, [
      { text: t('safety.reportUser'), onPress: () => setReportOpen(true) },
      {
        text: blocked ? t('safety.unblockUser') : t('safety.blockUser'),
        style: blocked ? 'default' : 'destructive',
        onPress: () => void toggleBlock(),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const profileTarget = otherParticipant(conversation, user?.id);
  const openProfile = () => {
    if (profileTarget) router.push(`/user/${profileTarget}` as Href);
  };

  // Signed out (a notification left in the tray, a link) the load never
  // starts, so this used to be a spinner forever.
  if (!user) return authLoading ? null : <SignInPrompt message={t('messages.loginPrompt')} />;

  if (unavailable) {
    return (
      <SafeAreaView style={[styles.container, readable]} edges={['top']}>
        <AppHeader onBack={goBack} showControls={false} />
        <View style={styles.center}>
          <Text style={styles.unavailableText}>{t('messages.unavailable')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadFailed) {
    return (
      <SafeAreaView style={[styles.container, readable]} edges={['top']}>
        <AppHeader onBack={goBack} showControls={false} />
        <View style={styles.center}>
          <Text style={styles.unavailableText} accessibilityLiveRegion="polite">
            {t('messages.loadFailed')}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              setLoadFailed(false);
              setLoading(true);
              setReloadKey((k) => k + 1);
            }}
            style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, readable]} edges={['top', 'bottom']}>
        {/* The header and the way back render at once; only the bubbles
            wait on the network — never a blank spinner with no chrome. */}
        <AppHeader onBack={goBack} showControls={false} title={otherName} titleIsHeading />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // The KAV is the screen root at y=0 (headerShown: false), so there is
      // no nav header to offset for; the old 90 floated the composer 90pt
      // above the keyboard.
      keyboardVerticalOffset={Platform.OS === 'ios' ? -insets.bottom : 0}>
      <SafeAreaView style={[styles.container, readable]} edges={['top', 'bottom']}>
        {/* The correspondent's name and avatar stay — they're the only cue as
            to who you're talking to — so they take the header's title/avatar
            slots rather than being displaced by the wordmark. Language and
            theme are off for room; both are a tap away on Profile. */}
        <AppHeader
          onBack={goBack}
          showControls={false}
          title={otherName}
          titleIsHeading
          // The other participant's own profile, never the viewer's: the id
          // comes from the conversation row, not from anything shown.
          onIdentityPress={profileTarget ? openProfile : undefined}
          identityLabel={t('publicProfile.open', { name: otherName })}
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
            const attachment = readAttachment(item.attachment);
            const body = (
              <>
                {attachment ? <MessageAttachment attachment={attachment} mine={mine} /> : null}
                {item.body?.trim() ? (
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
                ) : null}
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

        {sendError || safetyError || attachError ? (
          <Text style={styles.sendError} accessibilityLiveRegion="polite">
            {safetyError
              ? t('errors.generic')
              : sendError === 'blockedByThem'
                ? t('safety.cannotMessage')
                : sendError
                  ? t('messages.sendFailed')
                  : attachError === 'size'
                    ? t('messages.attachTooBig', { max: MAX_ATTACHMENT_MB })
                    : attachError === 'type'
                      ? t('messages.attachType')
                      : attachError === 'permission'
                        ? t('messages.attachPermission')
                        : t('messages.attachFailed')}
          </Text>
        ) : null}

        {pendingFile && !blocked ? (
          <View style={styles.pending}>
            <MaterialIcons
              name={pendingFile.kind === 'image' ? 'image' : 'description'}
              size={20}
              color={colors.accent}
            />
            <Text style={styles.pendingName} numberOfLines={1}>
              {sending ? t('messages.sendingFile') : pendingFile.name}
            </Text>
            {pendingFile.size && !sending ? (
              <Text style={styles.pendingSize}>{formatBytes(pendingFile.size, i18n.language)}</Text>
            ) : null}
            {sending ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('messages.removeAttachment')}
                onPress={() => setPendingFile(null)}
                hitSlop={10}>
                <MaterialIcons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
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
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('messages.attach')}
            onPress={openAttachMenu}
            disabled={sending}
            hitSlop={6}
            style={[styles.attachButton, sending && styles.sendButtonDisabled]}>
            <MaterialIcons name="attach-file" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={t('messages.inputPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={text}
            onChangeText={setText}
            maxLength={FORM_LIMITS.message}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <TouchableOpacity
            accessibilityRole="button" accessibilityLabel={t('common.send')}
            onPress={send}
            disabled={sending || (!text.trim() && !pendingFile)}
            activeOpacity={0.8}
            style={((!text.trim() && !pendingFile) || sending) && styles.sendButtonDisabled}>
            <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.sendButton}>
              <MaterialIcons name="send" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
        )}
        <ReportSheet visible={reportOpen} userId={otherId} onClose={() => setReportOpen(false)} />
        {Platform.OS === 'web' && (
          <Modal visible={attachMenuOpen} transparent animationType="fade" onRequestClose={() => setAttachMenuOpen(false)}>
            <Pressable style={styles.menuBackdrop} onPress={() => setAttachMenuOpen(false)} accessibilityLabel={t('common.cancel')}>
              <View style={styles.menuCard} accessibilityRole="menu">
                <Text style={styles.menuTitle}>{t('messages.attach')}</Text>
                <TouchableOpacity accessibilityRole="menuitem" style={styles.menuItem} onPress={() => void choose('photo')}>
                  <Text style={styles.menuItemText}>{t('messages.attachPhoto')}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="menuitem" style={styles.menuItem} onPress={() => void choose('document')}>
                  <Text style={styles.menuItemText}>{t('messages.attachDocument')}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="menuitem" style={styles.menuItem} onPress={() => setAttachMenuOpen(false)}>
                  <Text style={styles.menuItemCancel}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        )}
        {Platform.OS === 'web' && (
          <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
            <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} accessibilityLabel={t('common.cancel')}>
              <View style={styles.menuCard} accessibilityRole="menu">
                <Text style={styles.menuTitle} numberOfLines={1}>{otherName}</Text>
                <TouchableOpacity
                  accessibilityRole="menuitem"
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  }}>
                  <Text style={styles.menuItemText}>{t('safety.reportUser')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="menuitem"
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuOpen(false);
                    void toggleBlock();
                  }}>
                  <Text style={[styles.menuItemText, !blocked && styles.menuItemDanger]}>
                    {blocked ? t('safety.unblockUser') : t('safety.blockUser')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="menuitem" style={styles.menuItem} onPress={() => setMenuOpen(false)}>
                  <Text style={styles.menuItemCancel}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        )}
        <KeyboardDoneBar />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  menuCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    paddingVertical: 8,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuTitle: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
  },
  menuItem: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  menuItemText: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: colors.textPrimary,
  },
  menuItemDanger: {
    color: colors.signOut,
  },
  menuItemCancel: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: colors.textSecondary,
  },
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
  retryButton: {
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 22,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: { fontSize: 14, fontFamily: Fonts.sansSemiBold, color: colors.textPrimary },
  unavailableText: {
    fontFamily: Fonts.sans,
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
    fontFamily: Fonts.sansBold,
    color: '#fff',
  },
  headerProperty: {
    fontFamily: Fonts.sans,
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
    fontFamily: Fonts.sans,
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
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: colors.textPrimary,
  },
  bubbleTextMine: {
    color: '#fff',
  },
  bubbleTime: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.75)',
  },
  sendError: {
    textAlign: 'center',
    fontFamily: Fonts.sans,
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
    fontFamily: Fonts.sans,
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
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // The photo or document waiting to go with the next message.
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primaryLight,
  },
  pendingName: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  pendingSize: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
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
    fontFamily: Fonts.sans,
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
    fontFamily: Fonts.sansSemiBold,
    color: colors.textPrimary,
  },
});
