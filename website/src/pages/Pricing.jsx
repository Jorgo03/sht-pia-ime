import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, Check, Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { groupPlans, perMonth, planName } from '@/src/features/billing/lib/plans.js'
import { formatPrice } from '@/src/lib/format.js'
import { supabase } from '../lib/supabase'
import { CHECKOUT_ENABLED } from '../lib/features'
import { useAuth } from '../auth/AuthContext'
import { ErrorState } from '../components/States'

// The app's website pricing page (app/pricing.web.tsx): agency plans and
// listing promotions from the plans table. Buying stays off until
// EXPO_PUBLIC_CHECKOUT_ENABLED=true and the payment backend is live. Coming
// back from the payment page never claims the plan is active: only the
// provider's verified callback activates it, on the server.
export default function Pricing() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { user } = useAuth()
  const [params] = useSearchParams()
  const returned = params.get('checkout')
  const [selected, setSelected] = useState({})
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(false)

  useEffect(() => {
    document.title = `${t('pricing.title')} | ${t('common.appName')}`
  }, [t])

  const q = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data, error } = await supabase.from('plans').select('*').order('sort_order', { ascending: true })
      if (error) throw error
      return groupPlans(data)
    },
  })

  const buy = async (optionId) => {
    if (!CHECKOUT_ENABLED || starting) return
    setStarting(true)
    setStartError(false)
    const { data, error } = await supabase.functions.invoke('checkout-start', { body: { plan_id: optionId, lang } })
    setStarting(false)
    if (error || !data?.url) return setStartError(true)
    window.location.assign(data.url)
  }

  const price = (cents, currency) => formatPrice(cents / 100, lang, currency)
  const cards = q.data ?? []

  return (
    <div className="page container section pricing">
      <header className="pricing-head">
        <h1 className="page-title">{t('pricing.title')}</h1>
        <p className="muted">{t('pricing.subtitle')}</p>
      </header>

      {returned === 'done' && <p className="form-note" role="status">{t('pricing.returnedDone')}</p>}
      {returned === 'cancelled' && <p className="form-note" role="status">{t('pricing.returnedCancelled')}</p>}

      {q.isPending ? (
        <div className="plan-grid" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="plan is-skeleton" />)}
        </div>
      ) : q.isError ? (
        <>
          <p className="state">{t('pricing.loadFailed')}</p>
          <ErrorState onRetry={() => q.refetch()} />
        </>
      ) : cards.length === 0 ? (
        <div className="state">
          <BadgeCheck size={34} aria-hidden="true" />
          <p className="state-title">{t('pricing.comingSoon')}</p>
          <p>{t('pricing.comingSoonHint')}</p>
        </div>
      ) : (
        <div className="plan-grid">
          {cards.map((card) => {
            const option = card.options.find((o) => o.id === selected[card.key]) ?? card.options[0]
            const monthly = perMonth(option)
            const promo = card.kind === 'promotion'
            const Icon = promo ? Megaphone : BadgeCheck
            return (
              <article key={card.key} className="plan">
                <p className="plan-kind">
                  <Icon size={15} aria-hidden="true" />
                  {promo ? t('pricing.kindPromotion') : t('pricing.kindPlan')}
                </p>
                <h2 className="panel-title">{planName(card, lang)}</h2>
                {card.options.length > 1 && (
                  <div className="tabs" role="radiogroup" aria-label={t('pricing.period')}>
                    {card.options.map((o) => {
                      const on = o.id === option.id
                      return (
                        <button key={o.id} type="button" role="radio" aria-checked={on} className={on ? 'is-on' : ''} onClick={() => setSelected((s) => ({ ...s, [card.key]: o.id }))}>
                          {t('pricing.months', { n: o.months })}
                        </button>
                      )
                    })}
                  </div>
                )}
                <p className="plan-price">{price(option.priceCents, option.currency)}</p>
                {monthly !== null && (option.months ?? 0) > 1 && <p className="muted small">{t('pricing.perMonth', { price: price(monthly, option.currency) })}</p>}
                <ul className="plan-features">
                  {card.listingCap ? <li><Check size={15} aria-hidden="true" />{t('pricing.listingCap', { n: card.listingCap })}</li> : null}
                  {card.credits ? <li><Check size={15} aria-hidden="true" />{t('pricing.credits', { n: card.credits })}</li> : null}
                  <li><Check size={15} aria-hidden="true" />{t('pricing.prepaid')}</li>
                </ul>
                {CHECKOUT_ENABLED && user ? (
                  <button type="button" className="btn btn-primary" onClick={() => buy(option.id)} disabled={starting}>
                    {starting ? t('common.loading') : t('pricing.buy')}
                  </button>
                ) : (
                  <p className="muted small">{CHECKOUT_ENABLED ? t('pricing.signInToBuy') : t('pricing.notYet')}</p>
                )}
              </article>
            )
          })}
        </div>
      )}
      {startError && <p className="form-error" role="alert">{t('pricing.startFailed')}</p>}
    </div>
  )
}
