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
  // The account the latest fetch is for. A slow fetch for an account that
  // has signed out since must not put its hearts back on this phone.
  const fetchingFor = useRef<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    const uid = user?.id ?? null;
    fetchingFor.current = uid;
    if (!uid) {
      setFavoriteIds(new Set());
      setFavoriteProperties([]);
      return;
    }
    setLoading(true);
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

      setFavoriteIds(ids);
      setFavoriteProperties(props);
    } catch {
      if (fetchingFor.current !== uid) return;
      setFavoriteIds(new Set());
      setFavoriteProperties([]);
    } finally {
      if (fetchingFor.current === uid) setLoading(false);
    }
  }, [user]);

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

      const wasFav = favoriteIds.has(propertyId);

      // Optimistic update
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFav) {
          next.delete(propertyId);
        } else {
          next.add(propertyId);
        }
        return next;
      });

      if (wasFav) {
        setFavoriteProperties((prev) =>
          prev.filter((p) => p.id !== propertyId),
        );
      } else {
        // Fetch the property to add it to the list immediately
        const { data } = await supabase
          .from('properties')
          .select('*')
          .eq('id', propertyId)
          .single();
        if (data) {
          setFavoriteProperties((prev) => [...prev, data]);
        }
      }

      // Persist. supabase-js reports a refusal or a lost connection in
      // `error` rather than throwing, so the old catch-only revert never ran
      // and a failed save left the heart filled with nothing stored.
      let failed = false;
      try {
        const { error } = wasFav
          ? await supabase.from('favorites').delete().eq('user_id', user.id).eq('property_id', propertyId)
          : await supabase.from('favorites').insert({ user_id: user.id, property_id: propertyId });
        failed = Boolean(error);
      } catch {
        failed = true;
      }
      if (failed) {
        // Back to what the server holds, and say so.
        void fetchFavorites();
        if (Platform.OS !== 'web') Alert.alert(t('common.error'), t('errors.updateFailed'));
      }
    },
    [user, favoriteIds, fetchFavorites, t],
  );

  return (
    <FavoritesContext.Provider
      value={{
        favoriteIds,
        favoriteProperties,
        loading,
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
