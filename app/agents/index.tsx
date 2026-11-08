import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgentAvatar } from '@/components/home/agent-rail';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { ScreenHero } from '@/components/ui/screen-hero';
import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { PAGE_SIZE } from '@/data/properties';
import { useAgentDirectoryQuery } from '@/hooks/use-property-queries';
import { useReadableColumn } from '@/hooks/use-responsive';
import { filterAgents, type AgentEntry } from '@/src/features/properties/lib/discovery';

const Row = memo(function Row({ agent, onPress, styles, chevron }: {
  agent: AgentEntry;
  onPress: (id: string) => void;
  styles: ReturnType<typeof createStyles>;
  chevron: string;
}) {
  const { t } = useTranslation();
  const homes = t('search.results', { count: agent.listings });
  return (
    <Pressable style={styles.row} onPress={() => onPress(agent.id)} accessibilityRole="button" accessibilityLabel={`${agent.title}, ${homes}`}>
      <AgentAvatar name={agent.title} uri={agent.avatar} size={56} radius={16} />
      <View style={styles.rowText}>
        <Text style={styles.title} numberOfLines={1}>{agent.title}</Text>
        {agent.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{agent.subtitle}</Text> : null}
        <Text style={styles.homes}>{homes}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={chevron} />
    </Pressable>
  );
});

export default function AgentsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const readable = useReadableColumn();
  const insets = useSafeAreaInsets();
  const { data: agents = [], isLoading, isError, refetch } = useAgentDirectoryQuery();
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const matches = useMemo(() => filterAgents(agents, query), [agents, query]);
  const shown = matches.slice(0, visible);
  const openAgent = (id: string) => router.push(`/agent/${id}` as Href);

  return (
    <GradientBackground>
      <SafeAreaView style={[styles.container, readable]} edges={['top']}>
        <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))} />
        <ScreenHero pre={t('agents.headlinePre')} em={t('agents.headlineEm')} />
        {isLoading ? (
          <View style={styles.list}>
            {[0, 1, 2, 3, 4].map((i) => <View key={i} style={styles.skeleton} />)}
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Text style={styles.centerText} accessibilityLiveRegion="polite">{t('common.error')}</Text>
            <ActionButton title={t('common.retry')} onPress={() => void refetch()} />
          </View>
        ) : agents.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="business" size={40} color={colors.textSecondary} />
            <Text style={styles.centerText}>{t('agents.empty')}</Text>
            <Text style={styles.centerHint}>{t('agents.emptyHint')}</Text>
          </View>
        ) : (
          <FlatList
            data={shown}
            keyExtractor={(a) => a.id}
            contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={styles.search}>
                <MaterialIcons name="search" size={20} color={colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={(text) => {
                    setQuery(text);
                    setVisible(PAGE_SIZE);
                  }}
                  placeholder={t('agents.searchPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  accessibilityLabel={t('agents.searchPlaceholder')}
                  autoCorrect={false}
                  returnKeyType="search"
                />
              </View>
            }
            ListEmptyComponent={<Text style={styles.noResults}>{t('agents.noResults')}</Text>}
            ListFooterComponent={
              matches.length > visible ? (
                <ActionButton variant="secondary" title={t('agents.loadMore')} onPress={() => setVisible((v) => v + PAGE_SIZE)} />
              ) : undefined
            }
            renderItem={({ item }) => <Row agent={item} onPress={openAgent} styles={styles} chevron={colors.textSecondary} />}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    container: { flex: 1 },
    list: { paddingHorizontal: 20, gap: 10 },
    skeleton: { height: 88, borderRadius: 18, backgroundColor: colors.glass },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    centerText: { fontSize: 16, fontFamily: Fonts.sansSemiBold, color: colors.textPrimary, textAlign: 'center' },
    centerHint: { fontSize: 14, lineHeight: 20, fontFamily: Fonts.sans, color: colors.textSecondary, textAlign: 'center' },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 50,
      paddingHorizontal: 16,
      marginBottom: 4,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.glass,
    },
    searchInput: { flex: 1, height: '100%', padding: 0, fontFamily: Fonts.sans, fontSize: 15, color: colors.textPrimary },
    noResults: { paddingVertical: 32, fontFamily: Fonts.sans, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.primaryLight,
    },
    rowText: { flex: 1, gap: 2 },
    title: { fontFamily: Fonts?.serif, fontSize: 18, color: colors.textPrimary },
    subtitle: { fontFamily: Fonts.sans, fontSize: 13, color: colors.textSecondary },
    homes: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.accentText, marginTop: 2 },
  });
