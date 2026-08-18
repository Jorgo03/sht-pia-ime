import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'fho_recently_viewed';
const MAX_ITEMS = 10;

async function getStored(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** AsyncStorage counterpart to web's addRecentlyViewed() — same key shape,
 *  same 10-item cap, most-recent-first. Call from the property detail screen
 *  the same way PropertyDetail.jsx does, right after logActivity(id, 'view'). */
export async function addRecentlyViewed(id: string | null | undefined): Promise<void> {
  if (!id) return;
  const list = (await getStored()).filter((i) => i !== id);
  list.unshift(id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
}

/**
 * Mirrors web's useRecentlyViewed() (src/features/properties/hooks/useRecentlyViewed.js),
 * adapted for AsyncStorage's async read: ids arrive after one microtask
 * instead of synchronously on mount. Re-reads on focus so returning to the
 * Home tab after viewing a property reflects the new visit — the RN tab
 * navigator keeps Home mounted underneath, unlike a web page nav which
 * always remounts and re-reads localStorage for free.
 */
export function useRecentlyViewed() {
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const reload = useCallback(() => {
    getStored().then(setRecentIds);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const clear = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setRecentIds([]);
  }, []);

  return { recentIds, reload, clear };
}
