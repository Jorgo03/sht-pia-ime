import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { MAX_COMPARE, parseCompareIds, toggleCompareId } from '@/src/features/properties/lib/compare';

const STORAGE_KEY = 'fho_compare_ids';

interface CompareValue {
  ids: string[];
  full: boolean;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  /** Keeps only these: a listing that has gone off the market drops out. */
  keepOnly: (ids: string[]) => void;
  clear: () => void;
}

const CompareContext = createContext<CompareValue | null>(null);

/** The homes picked for comparison. On this device only, no account needed. */
export function CompareProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  // Nothing is saved until the stored list has been read, or the empty first
  // render would wipe it.
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive) return;
        loaded.current = true;
        if (raw) setIds(parseCompareIds(raw));
      })
      .catch(() => {
        loaded.current = true;
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids)).catch(() => {});
  }, [ids]);

  const toggle = useCallback((id: string) => setIds((prev) => toggleCompareId(prev, id)), []);
  const clear = useCallback(() => setIds([]), []);
  const keepOnly = useCallback((keep: string[]) => {
    setIds((prev) => {
      const next = prev.filter((id) => keep.includes(id));
      return next.length === prev.length ? prev : next;
    });
  }, []);

  const value = useMemo<CompareValue>(
    () => ({ ids, full: ids.length >= MAX_COMPARE, has: (id) => ids.includes(id), toggle, keepOnly, clear }),
    [ids, toggle, keepOnly, clear],
  );
  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const value = useContext(CompareContext);
  if (!value) throw new Error('useCompare must be used inside CompareProvider');
  return value;
}
