import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Radii, Shadows, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { askListingAssistant, type AssistantMessage } from '@/lib/ai';
import { type LangCode } from '@/lib/translate';
import { type Property } from '@/data/types';

/**
 * Feature C — per-listing buyer chat. Port of web's
 * src/features/properties/components/ListingAssistant.jsx, which is the
 * design source of truth here: same flow (FAB -> floating panel, canned
 * intro bubble, "thinking" placeholder, failed replies rendered inline
 * rather than as a separate error banner), same i18n keys
 * (`assistant.*`, already translated in all 8 locales), same Edge Function
 * (ai-listing-assistant — grounded server-side in this one listing, anon
 * allowed, 30/hr rate limit).
 *
 * Web gates this behind `isEnabled('aiAssistant')` (lib/flags.js); mobile has
 * no equivalent flags module — AiTitleButton and AutoTranslateButton already
 * ship unconditionally here, so this follows the same convention rather than
 * inventing a mobile-only flag system for one component.
 *
 * Unlike web, this screen is a top-level Stack route, not a Tabs screen, so
 * the floating LiquidTabBar is never mounted underneath it — the FAB only
 * needs to clear the safe-area inset, not a nav pill.
 */
export function ListingAssistant({ property }: { property: Property | null }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { width: screenWidth, height: screenHeight } = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(colors, screenWidth, screenHeight, insets.bottom),
    [colors, screenWidth, screenHeight, insets.bottom],
  );

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<(AssistantMessage & { failed?: boolean })[]>([]);
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, thinking, open]);

  // Reset the conversation when the listing changes — same as web.
  useEffect(() => {
    setMessages([]);
    setOpen(false);
  }, [property?.id]);

  if (!property) return null;

  const send = async () => {
    const content = text.trim();
    if (!content || thinking) return;
    const history: AssistantMessage[] = [
      ...messages.map(({ role, content: c }) => ({ role, content: c })),
      { role: 'user', content },
    ];
    setMessages(history);
    setText('');
    setThinking(true);
    // i18n.language is a plain string at the type level, but this app only
    // ever sets it to one of the 8 supported codes via changeLanguage — same
    // assumption AiTitleButton's `language` prop already relies on.
    const reply = await askListingAssistant(property.id, history, i18n.language as LangCode);
    setThinking(false);
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: reply ?? t('assistant.unavailable'), failed: reply == null },
    ]);
  };

  if (!open) {
    return (
      <Pressable
        style={styles.fab}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('assistant.title')}>
        <LinearGradient
          colors={[colors.accent, colors.accentEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <MaterialIcons name="auto-awesome" size={18} color="#fff" />
        <Text style={styles.fabLabel}>{t('assistant.fabLabel')}</Text>
      </Pressable>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.panelWrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      pointerEvents="box-none">
      <View style={styles.panel}>
        <View style={styles.head}>
          <MaterialIcons name="auto-awesome" size={16} color={colors.accent} />
          <View style={styles.headText}>
            <Text style={styles.title}>{t('assistant.title')}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {t('assistant.subtitle')}
            </Text>
          </View>
          <Pressable
            onPress={() => setOpen(false)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}>
            <MaterialIcons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{t('assistant.intro')}</Text>
          </View>
          {messages.map((m, i) => (
            <View key={i} style={[styles.bubble, m.role === 'user' && styles.bubbleMine]}>
              <Text style={[styles.bubbleText, m.role === 'user' && styles.bubbleTextMine]}>
                {m.content}
              </Text>
            </View>
          ))}
          {thinking && (
            <View style={styles.bubble}>
              <Text style={[styles.bubbleText, styles.thinkingText]}>
                {t('assistant.thinking')}
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={t('assistant.placeholder')}
            placeholderTextColor={colors.textSecondary}
            onSubmitEditing={send}
            returnKeyType="send"
            editable={!thinking}
          />
          <Pressable
            style={[styles.sendBtn, (thinking || !text.trim()) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={thinking || !text.trim()}
            accessibilityRole="button"
            accessibilityLabel={t('common.send')}>
            <LinearGradient
              colors={[colors.accent, colors.accentEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <MaterialIcons name="send" size={14} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.disclaimer}>{t('assistant.disclaimer')}</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (
  colors: AtticoPalette,
  screenWidth: number,
  screenHeight: number,
  insetBottom: number,
) => {
  // Same min()-style clamp web's CSS uses, just computed in JS: a compact
  // floating card, not a full-screen sheet — this is a quick-question widget
  // that sits over the page, not a primary destination.
  const panelWidth = Math.min(340, screenWidth - 32);
  const panelHeight = Math.min(460, screenHeight - 180);
  const bottomOffset = insetBottom + 16;

  return StyleSheet.create({
    fab: {
      position: 'absolute',
      right: 16,
      bottom: bottomOffset,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: Radii.pill,
      overflow: 'hidden',
      ...Shadows.cta,
    },
    fabLabel: {
      fontFamily: Fonts?.sansSemiBold,
      fontSize: 13,
      color: '#fff',
    },
    panelWrap: {
      position: 'absolute',
      right: 16,
      bottom: bottomOffset,
    },
    panel: {
      width: panelWidth,
      height: panelHeight,
      borderRadius: Radii.lg,
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...Shadows.nav,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headText: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontFamily: Fonts?.sansSemiBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    subtitle: {
      fontFamily: Fonts?.sans,
      fontSize: 11,
      color: colors.textSecondary,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      gap: 8,
      padding: 12,
    },
    // Matches web's .assistant-msg: 85% max width, left/right aligned by
    // role via the bubbleMine override below — the same convention the
    // message-thread bubbles already use elsewhere in the app.
    bubble: {
      maxWidth: '85%',
      alignSelf: 'flex-start',
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 11,
      paddingVertical: 8,
    },
    bubbleMine: {
      alignSelf: 'flex-end',
      backgroundColor: colors.accent,
      borderWidth: 0,
      borderRadius: 12,
      borderBottomRightRadius: 4,
    },
    bubbleText: {
      fontFamily: Fonts?.sans,
      fontSize: 13,
      lineHeight: 18,
      color: colors.textPrimary,
    },
    bubbleTextMine: {
      color: '#fff',
    },
    thinkingText: {
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    input: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: Radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
      fontFamily: Fonts?.sans,
      fontSize: 13,
      color: colors.textPrimary,
    },
    sendBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    sendBtnDisabled: {
      opacity: 0.5,
    },
    disclaimer: {
      paddingHorizontal: 14,
      paddingBottom: 10,
      paddingTop: 2,
      fontFamily: Fonts?.sans,
      fontSize: 10,
      color: colors.textFaint,
      textAlign: 'center',
    },
  });
};
