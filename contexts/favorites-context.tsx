import { router, type Href } from 'expo-router';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Property } from '@/data/types';

interface FavoritesContextValue {
  favoriteIds: Set<string>;
  favoriteProperties: Property[];
  loading: boolean;
  /** The last load failed; what is shown is the last good one (or nothing). */
  error: boolean;
  reload: () => void;
  isFavorite: (propertyId: string) => boolean;
  toggle: (propertyId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteProperties, setFavoriteProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // The account the shown favourites belong to.
  const loadedFor = useRef<string | null>(null);
  // The account the latest fetch is for. A slow fetch for an account that
  // has signed out since must not put its hearts back on this phone.
  const fetchingFor = useRef<string | null>(null);
  // The hearts as they are right now, for toggle(). Reading `favoriteIds` from
  // the render closure let a quick second tap see the state before the first
  // tap and save again instead of unsaving (AUDIT-028).
  const idsRef = useRef<Set<string>>(new Set());
  const applyIds = useCallback((next: Set<string>) => {
    idsRef.current = next;
    setFavoriteIds(next);
  }, []);
  // One write at a time per listing, in tap order: an unsave must not reach
  // the server before the save it undoes.
  const writes = useRef(new Map<string, Promise<boolean>>());

  const fetchFavorites = useCallback(async () => {
    const uid = user?.id ?? null;
    fetchingFor.current = uid;
    if (!uid) {
      loadedFor.current = null;
      applyIds(new Set());
      setFavoriteProperties([]);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('property_id, properties(*)')
        .eq('user_id', uid);

      if (fetchingFor.current !== uid) return;
      if (error) throw error;

      const props = (data ?? [])
        .map((f: any) => f.properties)
        .filter(Boolean) as Property[];
      const ids = new Set(props.map((p) => p.id));

      loadedFor.current = uid;
      applyIds(ids);
      setFavoriteProperties(props);
    } catch {
      if (fetchingFor.current !== uid) return;
      setError(true);
      // A failed reload keeps this account's hearts; another account's never stay.
      if (loadedFor.current !== uid) {
        applyIds(new Set());
        setFavoriteProperties([]);
      }
    } finally {
      if (fetchingFor.current === uid) setLoading(false);
    }
  }, [user, applyIds]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const isFav = useCallback(
    (propertyId: string) => favoriteIds.has(propertyId),
    [favoriteIds],
  );

  const toggle = useCallback(
    async (propertyId: string) => {
      // Signed out there is nowhere to keep a favourite. The heart used to
      // fill anyway and forget it on the next launch; ask to sign in instead
      // (the listing page already did). The web build has no native alert.
      if (!user) {
        const toSignIn = () => router.push('/(tabs)/profile' as Href);
        if (Platform.OS === 'web') {
          toSignIn();
          return;
        }
        Alert.alert(t('favourites.loginPrompt'), '', [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.signIn'), onPress: toSignIn },
        ]);
        return;
      }

      const wasFav = idsRef.current.has(propertyId);

      // Optimistic update
      const next = new Set(idsRef.current);
      if (wasFav) next.delete(propertyId);
      else next.add(propertyId);
      applyIds(next);

      // Persist, queued behind any earlier write for this listing. supabase-js
      // reports a refusal or a lost connection in `error` rather than
      // throwing, so both count as a failure.
      const write = async (): Promise<boolean> => {
        try {
          const { error } = wasFav
            ? await supabase.from('favorites').delete().eq('user_id', user.id).eq('property_id', propertyId)
            : await supabase.from('favorites').insert({ user_id: user.id, property_id: propertyId });
          return Boolean(error);
        } catch {
          return true;
        }
      };
      const run = (writes.current.get(propertyId) ?? Promise.resolve(false)).then(write);
      writes.current.set(propertyId, run);

      if (wasFav) {
        setFavoriteProperties((prev) => prev.filter((p) => p.id !== propertyId));
      } else {
        // Fetch the property to add it to the list immediately
        const { data } = await supabase.from('properties').select('*').eq('id', propertyId).single();
        if (data && idsRef.current.has(propertyId)) {
          setFavoriteProperties((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]));
        }
      }

      const failed = await run;
      if (writes.current.get(propertyId) === run) writes.current.delete(propertyId);
      if (failed) {
        // Back to what the server holds, and say so.
        void fetchFavorites();
        if (Platform.OS !== 'web') Alert.alert(t('common.error'), t('errors.updateFailed'));
      }
    },
    [user, applyIds, fetchFavorites, t],
  );

  return (
    <FavoritesContext.Provider
      value={{
        favoriteIds,
        favoriteProperties,
        loading,
        error,
        reload: fetchFavorites,
        isFavorite: isFav,
        toggle,
      }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
