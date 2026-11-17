import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { initialsOf, type AgentEntry } from '@/src/features/properties/lib/discovery';

/** A photo, or the initials on the brand gradient when there is none. */
export function AgentAvatar({ name, uri, size, radius }: { name: string; uri: string | null; size: number; radius: number }) {
  const { colors } = useTheme();
  // Keyed on colors, which change with the language too: the headline font
  // differs in Russian (constants/theme.ts).
  const styles = useMemo(() => createAvatarStyles(colors, size, radius), [colors, size, radius]);
  if (uri) return <Image accessibilityLabel={name} source={{ uri }} style={styles.box} contentFit="cover" />;
  return (
    <LinearGradient colors={[colors.accent, colors.accentEnd]} style={[styles.box, styles.center]}>
      <Text style={styles.initials}>{initialsOf(name)}</Text>
    </LinearGradient>
  );
}

const createAvatarStyles = (colors: AtticoPalette, size: number, radius: number) =>
  StyleSheet.create({
    box: { width: size, height: size, borderRadius: radius },
    center: { alignItems: 'center', justifyContent: 'center' },
    initials: { fontFamily: Fonts?.serif, fontSize: Math.round(size * 0.36), color: colors.cream100 },
  });

/** Home's row of agencies: a face or initials, a name and how many homes. */
function AgentRailBase({ agents, onSelect }: { agents: AgentEntry[]; onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {agents.map((agent) => (
        <Pressable
          key={agent.id}
          style={styles.item}
          onPress={() => onSelect(agent.id)}
          accessibilityRole="button"
          accessibilityLabel={`${agent.title}, ${t('search.results', { count: agent.listings })}`}>
          <View style={styles.ring}>
            <AgentAvatar name={agent.title} uri={agent.avatar} size={64} radius={32} />
          </View>
          <Text style={styles.name} numberOfLines={2}>{agent.title}</Text>
          <Text style={styles.count} numberOfLines={1}>{t('search.results', { count: agent.listings })}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export const AgentRail = memo(AgentRailBase);

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    rail: { paddingHorizontal: 20, gap: 14 },
    item: { width: 96, alignItems: 'center' },
    ring: { padding: 3, borderRadius: 37, borderWidth: 1, borderColor: colors.accent, marginBottom: 8 },
    name: { fontFamily: Fonts.sansSemiBold, fontSize: 13, lineHeight: 17, color: colors.textPrimary, textAlign: 'center' },
    count: { fontFamily: Fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  });
