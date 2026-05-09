import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import {
  addFavorite,
  getFavorites,
  isFavorite,
  removeFavorite,
} from '@/data/favorites';
import { Property } from '@/data/types';

const listeners = new Set<() => void>();

function notifyAll() {
  listeners.forEach((fn) => fn());
}

export function useFavoriteIds() {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!user) {
      setIds(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    getFavorites(user.id)
      .then((props) => setIds(new Set(props.map((p) => p.id))))
      .catch(() => setIds(new Set()))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    refresh();
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [refresh]);

  const toggle = useCallback(
    async (propertyId: string) => {
      if (!user) return false;
      const wasFav = ids.has(propertyId);
      try {
        if (wasFav) {
          await removeFavorite(user.id, propertyId);
        } else {
          await addFavorite(user.id, propertyId);
        }
        notifyAll();
        return !wasFav;
      } catch {
        return wasFav;
      }
    },
    [user, ids],
  );

  return { ids, loading, toggle, refresh };
}

export function useIsFavorite(propertyId: string) {
  const { user } = useAuth();
  const [favorited, setFavorited] = useState(false);

  const refresh = useCallback(() => {
    if (!user || !propertyId) {
      setFavorited(false);
      return;
    }
    isFavorite(user.id, propertyId).then(setFavorited).catch(() => {});
  }, [user, propertyId]);

  useEffect(() => {
    refresh();
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [refresh]);

  const toggle = useCallback(async () => {
    const newState = !favorited;
    setFavorited(newState);
    if (!user) return;
    try {
      if (!newState) {
        await removeFavorite(user.id, propertyId);
      } else {
        await addFavorite(user.id, propertyId);
      }
      notifyAll();
    } catch {
      setFavorited(favorited);
    }
  }, [user, propertyId, favorited]);

  return { favorited, toggle };
}

export function useFavoriteProperties() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!user) {
      setProperties([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getFavorites(user.id)
      .then(setProperties)
      .catch(() => setProperties([]))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    refresh();
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [refresh]);

  return { properties, loading };
}
