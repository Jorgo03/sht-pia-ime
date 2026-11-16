import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { convertAmount, isDisplayCurrency, ratesMap, roundConverted, type DisplayCurrency } from '@/lib/currency';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'fho_currency';

interface CurrencyValue {
  /** The currency prices are shown in; null shows each listing's own. */
  currency: DisplayCurrency | null;
  setCurrency: (c: DisplayCurrency | null) => void;
  /**
   * A listing price as text in the chosen currency. Converted prices are
   * rounded and marked "≈"; with no rate yet the listing's own is shown.
   */
  formatListingPrice: (amount: number | string | null | undefined, from: string | null | undefined) => string;
}

const CurrencyContext = createContext<CurrencyValue | null>(null);

/**
 * Display currency (ALL / EUR / USD / GBP) for diaspora visitors, with the
 * daily rates from public.exchange_rates (exchange-rates Edge Function). The
 * choice is kept on the device. Only how prices are shown changes: listings
 * keep the price and currency their lister set.
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [currency, setCurrencyState] = useState<DisplayCurrency | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => { if (isDisplayCurrency(v)) setCurrencyState(v); })
      .catch(() => {});
  }, []);

  const setCurrency = useCallback((c: DisplayCurrency | null) => {
    setCurrencyState(c);
    (c ? AsyncStorage.setItem(STORAGE_KEY, c) : AsyncStorage.removeItem(STORAGE_KEY)).catch(() => {});
  }, []);

  // Fetched only once someone picks a currency; rates change once a day.
  const { data: rates } = useQuery({
    queryKey: ['exchange-rates'],
    enabled: currency !== null,
    staleTime: 6 * 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('exchange_rates').select('currency, per_eur');
      if (error) throw error;
      return ratesMap(data);
    },
  });

  const formatListingPrice = useCallback(
    (amount: number | string | null | undefined, from: string | null | undefined) => {
      const own = (from || 'EUR').toUpperCase();
      if (!currency || currency === own) return formatPrice(amount ?? 0, i18n.language, own);
      const converted = convertAmount(amount, own, currency, rates);
      if (converted == null) return formatPrice(amount ?? 0, i18n.language, own);
      return `≈ ${formatPrice(roundConverted(converted), i18n.language, currency)}`;
    },
    [currency, rates, i18n.language],
  );

  const value = useMemo(() => ({ currency, setCurrency, formatListingPrice }), [currency, setCurrency, formatListingPrice]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

const FALLBACK: CurrencyValue = {
  currency: null,
  setCurrency: () => {},
  formatListingPrice: (amount, from) => formatPrice(amount ?? 0, 'sq', from || 'EUR'),
};

export function useCurrency(): CurrencyValue {
  return useContext(CurrencyContext) ?? FALLBACK;
}
