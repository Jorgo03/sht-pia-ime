import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import * as sq from '@/src/features/legal/content/sq.js'
import * as en from '@/src/features/legal/content/en.js'

// "Buying from abroad", the app's guide (app/guide.tsx), from the same texts:
// Albanian, and English for every other language, as the app shows it.
function Paragraphs({ list }) {
  return (list ?? []).map((p, i) => <p key={i}>{p}</p>)
}

export default function Guide() {
  const { t, i18n } = useTranslation()
  const doc = (i18n.resolvedLanguage === 'sq' ? sq : en).guide
  useEffect(() => {
    document.title = `${t('legal.buyingGuide')} | ${t('common.appName')}`
  }, [t])
  return (
    <div className="page container section narrow prose">
      <h1 className="page-title">{t('legal.buyingGuide')}</h1>
      <p className="muted">{t('legal.buyingGuideHint')}</p>
      <Paragraphs list={doc.intro} />
      {doc.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          <Paragraphs list={s.p} />
          {s.ul?.length > 0 && (
            <ul>
              {s.ul.map((li, i) => <li key={i}>{li}</li>)}
            </ul>
          )}
          <Paragraphs list={s.p2} />
        </section>
      ))}
    </div>
  )
}
