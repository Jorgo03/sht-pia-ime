import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/ui/app-header';
import { PropertyCard } from '@/components/property/property-card';
import { GradientBackground } from '@/components/ui/gradient-background';
import { type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { Property } from '@/data/types';
import { useResponsive } from '@/hooks/use-responsive';

interface AgentProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  agency_name: string | null;
}

export default function AgentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { columns } = useResponsive();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Same shape as the web app's AgentProfile.jsx — the profiles select is
  // scoped to the anon SELECT grant (id, full_name, phone, agency_name,
  // avatar_url), so this works for signed-out visitors too.
  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError(false);

    Promise.all([
      // maybeSingle, not single: a removed agent or an id that never existed is
      // a normal "not found", not a failure. single() rejects with PGRST116
      // there, which left `agent` null and rendered a bare word, "Error".
      supabase.from('profiles').select('id, full_name, phone, agency_name').eq('id', id).maybeSingle(),
      supabase.from('properties').select('*').eq('agent_id', id).eq('status', 'active').order('created_at', { ascending: false }),
    ]).then(([profileRes, propsRes]) => {
      if (!active) return;
      // Both errors were previously discarded, so a network failure or an RLS
      // denial was indistinguishable from "this agent does not exist".
      if (profileRes.error) {
        console.error('AgentProfile: profile fetch failed:', profileRes.error.message);
        setError(true);
      } else {
        setAgent(profileRes.data);
      }
      if (propsRes.error) {
        // Non-fatal: the agent still renders, just with no listings. Logged so
        // an empty portfolio caused by a failed query is not read as "no homes".
        console.error('AgentProfile: listings fetch failed:', propsRes.error.message);
      } else {
        setProperties(propsRes.data || []);
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [id]);

  const initials = (agent?.full_name || '?').slice(0, 2).toUpperCase();

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader onBack={() => router.back()} title={t('auth.agent')} />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.description}>{t('errors.generic')}</Text>
          </View>
        ) : !agent ? (
          // A failed fetch and a missing agent are different things and now
          // read differently. AppHeader's back arrow is the way out of both.
          <View style={styles.center}>
            <Text style={styles.description}>{t('notFound.title')}</Text>
          </View>
        ) : (
          <FlatList
            key={`cols-${columns}`}
            data={properties}
            keyExtractor={(item) => item.id}
            numColumns={columns}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.agentHead}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.agentInfo}>
                  <Text style={styles.agentName}>{agent.full_name}</Text>
                  {agent.agency_name ? (
                    <View style={styles.metaRow}>
                      <MaterialIcons name="business" size={13} color={colors.textSecondary} />
                      <Text style={styles.metaText}>{agent.agency_name}</Text>
                    </View>
                  ) : null}
                  {agent.phone ? (
                    <View style={styles.metaRow}>
                      <MaterialIcons name="phone" size={13} color={colors.textSecondary} />
                      <Text style={styles.metaText}>{agent.phone}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            }
            ListHeaderComponentStyle={styles.listHeader}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t('listing.noListings')}</Text>
              </View>
            }
            renderItem={({ item }) => <PropertyCard property={item} />}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  listHeader: {
    marginBottom: 8,
  },
  agentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 6,
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  agentInfo: {
    flex: 1,
    gap: 2,
  },
  agentName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
