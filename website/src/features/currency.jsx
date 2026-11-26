import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Coins } from 'lucide-react'
import { convertAmount, DISPLAY_CURRENCIES, isDisplayCurrency, ratesMap, roundConverted } from '@/lib/currency.js'
import { formatPrice } from '@/src/lib/format.js'
import { supabase } from '../lib/supabase'
import Select from '../components/Select'

// "Show prices in", as in the app (contexts/currency-context.tsx): every
// listing price in the visitor's chosen currency at the daily rate from
// exchange_rates, marked "≈"; "As listed" shows each listing's own.
const KEY = 'fho_currency'
const CurrencyContext = createContext(null)

function stored() {
  try {
    const v = localStorage.getItem(KEY)
    return isDisplayCurrency(v) ? v : null
  } catch {
    return null
  }
}

export function CurrencyProvider({ children }) {
  const { i18n } = useTranslation()
  const [currency, setCurrencyState] = useState(stored)
  const setCurrency = useCallback((c) => {
    setCurrencyState(c)
    try {
      if (c) localStorage.setItem(KEY, c)
      else localStorage.removeItem(KEY)
    } catch {
      // Not remembered.
    }
  }, [])
  const { data: rates } = useQuery({
    queryKey: ['exchange-rates'],
    enabled: currency !== null,
    staleTime: 6 * 3600e3,
    queryFn: async () => {
      const { data, error } = await supabase.from('exchange_rates').select('currency, per_eur')
      if (error) throw error
      return ratesMap(data)
    },
  })
  const formatListingPrice = useCallback(
    (amount, from) => {
      const lang = i18n.resolvedLanguage
      const own = (from || 'EUR').toUpperCase()
      if (!currency || currency === own) return formatPrice(amount ?? 0, lang, own)
      const converted = convertAmount(amount, own, currency, rates)
      if (converted == null) return formatPrice(amount ?? 0, lang, own)
      return `≈ ${formatPrice(roundConverted(converted), lang, currency)}`
    },
    [currency, rates, i18n.resolvedLanguage],
  )
  const value = useMemo(() => ({ currency, setCurrency, formatListingPrice }), [currency, setCurrency, formatListingPrice])
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  return useContext(CurrencyContext)
}

/** A listing's price, in the chosen currency. */
export function usePrice() {
  return useCurrency().formatListingPrice
}

export function CurrencySelect({ className = '' }) {
  const { t } = useTranslation()
  const { currency, setCurrency } = useCurrency()
  return (
    <label className={`lang-select ${className}`}>
      <Coins size={16} aria-hidden="true" />
      <Select aria-label={t('currency.title')} value={currency ?? ''} onChange={(e) => setCurrency(e.target.value || null)}>
        <option value="">{t('currency.asListedShort')}</option>
        {DISPLAY_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
    </label>
  )
}
