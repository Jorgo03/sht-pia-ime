import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ComparisonTable } from '@/components/assistant/comparison-table';
import { PropertyRow } from '@/components/property/property-row';
import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { KeyboardDoneBar } from '@/components/ui/keyboard-done-bar';
import { Fonts, Radii, Spacing, type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import type { Property } from '@/data/types';
import { useReadableColumn } from '@/hooks/use-responsive';
import {
  askAssistant,
  type AssistantCard,
  type AssistantError,
  type AssistantState,
  type Comparison,
  type ScreenKey,
} from '@/lib/assistant';
import type { LangCode } from '@/lib/translate';
import { MAX_QUESTION_CHARS, fromStored, storageKey, toStored } from '@/src/features/assistant/lib/conversation';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  cards?: AssistantCard[];
  comparison?: Comparison | null;
  screens?: { key: ScreenKey; route: string }[];
  /** An answer that did not come: shown with a retry, never sent back. */
  failed?: AssistantError;
}

const STARTERS = ['findApartment', 'byBudget', 'compare', 'howItWorks', 'publish'] as const;

let counter = 0;
const nextId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

/**
 * The Shtëpia.ime assistant (docs/AI_ASSISTANT.md): ask for homes in plain
 * words, get real listings back as cards, compare them, or ask how the app
 * works. Listings, prices and comparisons come from the database on the
 * server; this screen only renders them. The conversation stays on this
 * device (30 days), per account.
 */
export default function AssistantScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const readable = useReadableColumn();
  const params = useLocalSearchParams<{ property?: string; q?: string }>();
  const propertyId = typeof params.property === 'string' ? params.property : null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<AssistantState>(null);
  const [text, setText] = useState(typeof params.q === 'string' ? params.q.slice(0, MAX_QUESTION_CHARS) : '');
  const [sending, setSending] = useState(false);
  // Which account's conversation is loaded; saving waits until it is.
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const key = storageKey(user?.id);
  const restored = restoredKey === key;

  // Restore this account's conversation once; a new account starts empty.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!alive) return;
        const saved = fromStored<ChatMessage, AssistantState>(raw);
        setMessages(saved?.messages ?? []);
        setState(saved?.state ?? null);
      })
      .catch(() => {})
      .finally(() => alive && setRestoredKey(key));
    return () => {
      alive = false;
    };
  }, [key]);

  useEffect(() => {
    if (!restored) return;
    AsyncStorage.setItem(key, JSON.stringify(toStored(messages, state))).catch(() => {});
  }, [key, messages, state, restored]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [messages.length, sending]);

  const ask = useCallback(
    async (question: string, before: ChatMessage[]) => {
      setSending(true);
      const result = await askAssistant({
        messages: before,
        question,
        state,
        language: i18n.language as LangCode,
        propertyId,
      });
      setSending(false);
      if (result.ok) {
        const a = result.answer;
        setState(a.state);
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: 'assistant', content: a.reply, cards: a.cards, comparison: a.comparison, screens: a.screens },
        ]);
      } else {
        setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: '', failed: result.error }]);
      }
    },
    [i18n.language, propertyId, state],
  );

  const send = (raw?: string) => {
    const question = (raw ?? text).trim().slice(0, MAX_QUESTION_CHARS);
    if (!question || sending) return;
    const before = messages;
    setMessages([...before, { id: nextId(), role: 'user', content: question }]);
    setText('');
    void ask(question, before);
  };

  /** Asks the failed question again, in place of the failed answer. */
  const retry = (failedId: string) => {
    if (sending) return;
    const index = messages.findIndex((m) => m.id === failedId);
    const question = messages[index - 1];
    if (index < 1 || question?.role !== 'user') return;
    const before = messages.slice(0, index - 1);
    setMessages(messages.slice(0, index));
    void ask(question.content, before);
  };

  const newChat = () => {
    if (sending) return;
    setMessages([]);
    setState(null);
    setText('');
    AsyncStorage.removeItem(key).catch(() => {});
  };

  const empty = messages.length === 0;

  return (
    <GradientBackground>
      <SafeAreaView style={[styles.container, readable]} edges={['top', 'bottom']}>
        <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={styles.title} accessibilityRole="header">
              {t('aiAssistant.title')}
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {t('aiAssistant.subtitle')}
            </Text>
          </View>
          {!empty && (
            <Pressable
              style={styles.newChat}
              onPress={newChat}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel={t('aiAssistant.newChat')}>
              <MaterialIcons name="add-comment" size={16} color={colors.textPrimary} />
              <Text style={styles.newChatText}>{t('aiAssistant.newChat')}</Text>
            </Pressable>
          )}
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled">
            <Bubble role="assistant" styles={styles}>
              <Text style={styles.bubbleText}>{t('aiAssistant.intro')}</Text>
            </Bubble>

            {empty && restored && (
              <View style={styles.starters}>
                <Text style={styles.startersTitle}>{t('aiAssistant.startersTitle')}</Text>
                {STARTERS.map((s) => (
                  <Pressable
                    key={s}
                    style={styles.starter}
                    onPress={() => send(t(`aiAssistant.starters.${s}`))}
                    disabled={sending}
                    accessibilityRole="button">
                    <MaterialIcons name="auto-awesome" size={14} color={colors.accent} />
                    <Text style={styles.starterText}>{t(`aiAssistant.starters.${s}`)}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {messages.map((m) =>
              m.role === 'user' ? (
                <Bubble key={m.id} role="user" styles={styles}>
                  <Text style={[styles.bubbleText, styles.bubbleTextMine]}>{m.content}</Text>
                </Bubble>
              ) : m.failed ? (
                <Bubble key={m.id} role="assistant" styles={styles}>
                  <Text style={styles.bubbleText} accessibilityLiveRegion="polite">
                    {t(`aiAssistant.error.${m.failed}`)}
                  </Text>
                  <Pressable style={styles.retry} onPress={() => retry(m.id)} disabled={sending} accessibilityRole="button">
                    <MaterialIcons name="refresh" size={15} color={colors.accentText} />
                    <Text style={styles.retryText}>{t('common.retry')}</Text>
                  </Pressable>
                </Bubble>
              ) : (
                <AnswerBlock key={m.id} message={m} styles={styles} />
              ),
            )}

            {sending && (
              <Bubble role="assistant" styles={styles}>
                <View style={styles.thinking}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={[styles.bubbleText, styles.thinkingText]} accessibilityLiveRegion="polite">
                    {t('aiAssistant.thinking')}
                  </Text>
                </View>
              </Bubble>
            )}
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={t('aiAssistant.placeholder')}
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={MAX_QUESTION_CHARS}
              accessibilityLabel={t('aiAssistant.placeholder')}
              onKeyPress={(e) => {
                // Enter sends on the web; Shift+Enter keeps a new line.
                const ev = e.nativeEvent as { key: string; shiftKey?: boolean };
                if (Platform.OS === 'web' && ev.key === 'Enter' && !ev.shiftKey) {
                  (e as unknown as { preventDefault?: () => void }).preventDefault?.();
                  send();
                }
              }}
            />
            <Pressable
              style={[styles.send, (sending || !text.trim()) && styles.sendDisabled]}
              onPress={() => send()}
              disabled={sending || !text.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('common.send')}>
              <LinearGradient colors={[colors.accent, colors.accentEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <MaterialIcons name="send" size={18} color="#fff" />
            </Pressable>
          </View>
          <Text style={styles.disclaimer}>{t('aiAssistant.disclaimer')}</Text>
        </KeyboardAvoidingView>
        <KeyboardDoneBar />
      </SafeAreaView>
    </GradientBackground>
  );
}

type Styles = ReturnType<typeof createStyles>;

function Bubble({ role, styles, children }: { role: 'user' | 'assistant'; styles: Styles; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <View
      style={[styles.bubble, role === 'user' && styles.bubbleMine]}
      accessibilityLabel={role === 'user' ? t('aiAssistant.you') : t('aiAssistant.title')}>
      {children}
    </View>
  );
}

const AnswerBlock = memo(function AnswerBlock({ message, styles }: { message: ChatMessage; styles: Styles }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const cards = message.cards ?? [];
  return (
    <View style={styles.answer}>
      <Bubble role="assistant" styles={styles}>
        <Text style={styles.bubbleText} selectable>
          {message.content}
        </Text>
      </Bubble>
      {cards.length > 0 && (
        <View style={styles.cards} accessibilityLabel={t('aiAssistant.results', { count: cards.length })}>
          <Text style={styles.cardsLabel}>{t('aiAssistant.results', { count: cards.length })}</Text>
          {cards.map((card) => (
            // A card holds the listing columns PropertyRow reads, straight from the database.
            <PropertyRow key={card.id} property={card as unknown as Property} />
          ))}
        </View>
      )}
      {message.comparison && message.comparison.items.length > 1 && <ComparisonTable comparison={message.comparison} />}
      {(message.screens ?? []).length > 0 && (
        <View style={styles.screens}>
          {(message.screens ?? []).map((s) => (
            <Pressable
              key={s.key}
              style={styles.screenButton}
              onPress={() => router.push(s.route as Href)}
              accessibilityRole="button">
              <Text style={styles.screenButtonText}>{t(`aiAssistant.screens.${s.key}`)}</Text>
              <MaterialIcons name="arrow-forward" size={16} color={colors.accentText} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
});

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    container: { flex: 1 },
    flex: { flex: 1 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: 16,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
    },
    titleText: { flex: 1, minWidth: 0 },
    title: { fontFamily: Fonts.serifSemiBold, fontSize: 26, color: colors.textPrimary },
    subtitle: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 2 },
    newChat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 12,
      borderRadius: Radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
    },
    newChatText: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.textPrimary },
    scroll: { paddingHorizontal: 16, paddingBottom: Spacing.lg, gap: Spacing.sm },
    bubble: {
      maxWidth: '88%',
      alignSelf: 'flex-start',
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    bubbleMine: {
      alignSelf: 'flex-end',
      backgroundColor: colors.accent,
      borderWidth: 0,
      borderRadius: 16,
      borderBottomRightRadius: 4,
    },
    bubbleText: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 21, color: colors.textPrimary },
    bubbleTextMine: { color: '#fff' },
    thinking: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    thinkingText: { color: colors.textSecondary },
    retry: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, minHeight: 36, alignSelf: 'flex-start' },
    retryText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.accentText },
    starters: { gap: Spacing.sm, marginTop: Spacing.xs },
    startersTitle: { fontFamily: Fonts.monoMedium, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textSecondary },
    starter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.glass,
    },
    starterText: { flex: 1, fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.textPrimary },
    answer: { gap: Spacing.sm },
    cards: { gap: Spacing.sm },
    cardsLabel: { fontFamily: Fonts.monoMedium, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textSecondary },
    screens: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    screenButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: Radii.pill,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.accentTint,
    },
    screenButtonText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.accentText },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.sm,
      paddingHorizontal: 16,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    input: {
      flex: 1,
      minHeight: 48,
      maxHeight: 140,
      paddingHorizontal: 14,
      paddingTop: 13,
      paddingBottom: 13,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
      fontFamily: Fonts.sans,
      fontSize: 16,
      color: colors.textPrimary,
    },
    send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    sendDisabled: { opacity: 0.45 },
    disclaimer: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 8,
      fontFamily: Fonts.sans,
      fontSize: 11,
      lineHeight: 15,
      color: colors.textFaint,
      textAlign: 'center',
    },
  });
