import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BadgeCheck, Megaphone, RotateCcw } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { formatPrice } from '../../../lib/format'
import { useAuth } from '../../auth/AuthContext'
import { groupPlans, perMonth, planName } from '../lib/plans'

// Website pricing page (docs/LAUNCH_TASKS.md F15). Website only: the phone
// apps never link here (App Store 3.1.1 / Google Play billing rules).
// Buying stays off until VITE_CHECKOUT_ENABLED=true and the payment backend is
// live; until then the page shows prices (or "coming soon") and says so.
// Returning from the payment page never claims the plan is active: only the
// provider's verified callback activates it, server-side.
const CHECKOUT_ENABLED = import.meta.env.VITE_CHECKOUT_ENABLED === 'true'

export default function Pricing() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const [cards, setCards] = useState([])
  const [state, setState] = useState('loading') // 'loading' | 'ready' | 'error'
  const [selected, setSelected] = useState({})
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(false)

  const load = useCallback(() => {
    setState('loading')
    supabase.from('plans').select('*').order('sort_order', { ascending: true }).then(({ data, error }) => {
      if (error) { setState('error'); return }
      setCards(groupPlans(data))
      setState('ready')
    })
  }, [])

  useEffect(() => { load() }, [load])

  const checkout = async (optionId) => {
    if (!CHECKOUT_ENABLED || starting) return
    setStarting(true)
    setStartError(false)
    const { data, error } = await supabase.functions.invoke('checkout-start', { body: { plan_id: optionId, lang: i18n.language } })
    setStarting(false)
    if (error || !data?.url) { setStartError(true); return }
    window.location.assign(data.url)
  }

  const returned = params.get('checkout')
  const price = (cents, currency) => formatPrice(cents / 100, i18n.language, currency)

  return (
    <div className="page mx-auto max-w-3xl">
      <h1 className="page-title">{t('pricing.title')}</h1>
      <p className="page-subtitle">{t('pricing.subtitle')}</p>

      {returned === 'done' && <div className="placeholder-card mt-4 text-left" role="status">{t('pricing.returnedDone')}</div>}
      {returned === 'cancelled' && <div className="placeholder-card mt-4 text-left" role="status">{t('pricing.returnedCancelled')}</div>}

      {state === 'loading' ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2" aria-busy="true">
          {[0, 1].map((i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-fho-surface-2" />)}
        </div>
      ) : state === 'error' ? (
        <div className="placeholder-card mt-6" role="alert">
          <div>{t('pricing.loadFailed')}</div>
          <button className="pill-btn" onClick={load}><RotateCcw size={14} /> {t('common.retry')}</button>
        </div>
      ) : cards.length === 0 ? (
        <div className="placeholder-card mt-6">
          <div className="icon"><BadgeCheck size={24} /></div>
          <div className="font-medium">{t('pricing.comingSoon')}</div>
          <div className="text-[13px] text-fho-text-muted">{t('pricing.comingSoonHint')}</div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {cards.map((card) => {
            const option = card.options.find((o) => o.id === selected[card.key]) ?? card.options[0]
            const monthly = perMonth(option)
            return (
              <section key={card.key} className="placeholder-card items-stretch text-left" aria-labelledby={`plan-${card.key}`}>
                <div className="flex items-center gap-2 text-fho-text-muted">
                  {card.kind === 'promotion' ? <Megaphone size={16} aria-hidden="true" /> : <BadgeCheck size={16} aria-hidden="true" />}
                  <span className="text-[12px] uppercase tracking-wide">{card.kind === 'promotion' ? t('pricing.kindPromotion') : t('pricing.kindPlan')}</span>
                </div>
                <h2 id={`plan-${card.key}`} className="m-0 font-fho-serif text-xl text-fho-text">{planName(card, i18n.language)}</h2>
                {card.options.length > 1 && (
                  <div className="segment-control" role="radiogroup" aria-label={t('pricing.period')}>
                    {card.options.map((o) => (
                      <button
                        key={o.id}
                        role="radio"
                        aria-checked={o.id === option.id}
                        className={`segment ${o.id === option.id ? 'active' : ''}`}
                        onClick={() => setSelected((s) => ({ ...s, [card.key]: o.id }))}
                      >
                        {t('pricing.months', { n: o.months })}
                      </button>
                    ))}
                  </div>
                )}
                <div className="text-2xl font-semibold text-fho-text">{price(option.priceCents, option.currency)}</div>
                {monthly !== null && option.months > 1 && (
                  <div className="text-[13px] text-fho-text-muted">{t('pricing.perMonth', { price: price(monthly, option.currency) })}</div>
                )}
                <ul className="m-0 list-disc pl-5 text-[14px] text-fho-text-muted">
                  {card.listingCap ? <li>{t('pricing.listingCap', { n: card.listingCap })}</li> : null}
                  {card.credits ? <li>{t('pricing.credits', { n: card.credits })}</li> : null}
                  <li>{t('pricing.prepaid')}</li>
                </ul>
                {CHECKOUT_ENABLED && user ? (
                  <button className="cta-pill" disabled={starting} onClick={() => checkout(option.id)}>
                    {starting ? t('common.loading') : t('pricing.buy')}
                  </button>
                ) : (
                  <p className="m-0 text-[13px] text-fho-text-muted">{CHECKOUT_ENABLED ? t('pricing.signInToBuy') : t('pricing.notYet')}</p>
                )}
              </section>
            )
          })}
        </div>
      )}
      {startError && <div className="nl-error mt-3" role="alert">{t('pricing.startFailed')}</div>}
    </div>
  )
}
