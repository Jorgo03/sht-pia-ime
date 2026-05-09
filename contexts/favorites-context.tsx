import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

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
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteProperties, setFavoriteProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavoriteIds(new Set());
      setFavoriteProperties([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('property_id, properties(*)')
        .eq('user_id', user.id);

      if (error) throw error;

      const props = (data ?? [])
        .map((f: any) => f.properties)
        .filter(Boolean) as Property[];
      const ids = new Set(props.map((p) => p.id));

      setFavoriteIds(ids);
      setFavoriteProperties(props);
    } catch {
      setFavoriteIds(new Set());
      setFavoriteProperties([]);
    } finally {
      setLoading(false);
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

      if (!user) return;

      // Persist to DB
      try {
        if (wasFav) {
          await supabase
            .from('favorites')
            .delete()
            .eq('user_id', user.id)
            .eq('property_id', propertyId);
        } else {
          await supabase
            .from('favorites')
            .insert({ user_id: user.id, property_id: propertyId });
        }
      } catch {
        // Revert on failure
        fetchFavorites();
      }
    },
    [user, favoriteIds, fetchFavorites],
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
