import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as sq from '../content/sq'
import * as en from '../content/en'
import { LEGAL_CONTACT_EMAIL } from '../../../lib/legal'

// /privacy and /terms. Public, no sign-in: Google's OAuth brand verification
// and both app stores fetch these URLs, and the home page must link to them.
//
// Albanian is the governing text and English its translation; every other app
// language reads the English one with a note saying so. Legal text is kept out
// of the shared locale JSON on purpose: the mobile bundle imports those files
// whole, and these pages only exist on the web.
const DOCS = { privacy: 'legal.privacyPolicy', terms: 'legal.termsOfService' }

function Section({ section, contact }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 font-fho-serif text-lg font-medium text-fho-text">{section.h}</h2>
      {section.p?.map((text, i) => (
        <p key={i} className="mb-3 text-[15px] leading-relaxed text-fho-text-muted">{text}</p>
      ))}
      {section.ul && (
        <ul className="mb-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-fho-text-muted">
          {section.ul.map((text, i) => <li key={i}>{text}</li>)}
        </ul>
      )}
      {section.p2?.map((text, i) => (
        <p key={i} className="mb-3 text-[15px] leading-relaxed text-fho-text-muted">{text}</p>
      ))}
      {section.contact && (
        <p className="text-[15px] leading-relaxed text-fho-text-muted">
          {LEGAL_CONTACT_EMAIL ? (
            <>
              {contact.withEmail}
              <a className="text-fho-orange-text underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
            </>
          ) : contact.withoutEmail}
        </p>
      )}
    </section>
  )
}

export default function LegalPage({ doc }) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'sq').slice(0, 2)
  const content = lang === 'sq' ? sq : en
  const body = content[doc]
  const title = t(DOCS[doc])
  const other = doc === 'privacy' ? 'terms' : 'privacy'
  // Some browsers ship without Albanian date names and would silently print
  // "October 14, 2026" on the Albanian page; a numeric date reads right anywhere.
  const date = new Date(`${content.UPDATED}T00:00:00Z`)
  const updated = Intl.DateTimeFormat.supportedLocalesOf([lang]).length
    ? new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
    : new Intl.DateTimeFormat('de', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date)

  useEffect(() => {
    const previous = document.title
    document.title = `${title} · Shtëpia.ime`
    return () => { document.title = previous }
  }, [title])

  return (
    <article className="page mx-auto max-w-[720px] px-5 pt-6 pb-16">
      <h1 className="font-fho-serif text-3xl font-medium leading-tight text-fho-text">{title}</h1>
      <p className="mt-2 text-sm text-fho-text-faint">{t('legal.lastUpdated', { date: updated })}</p>
      {lang !== 'sq' && lang !== 'en' && (
        <p className="mt-4 rounded-fho-md border border-fho-border bg-fho-surface px-4 py-3 text-sm text-fho-text-muted">
          {t('legal.languageNote')}
        </p>
      )}
      {body.intro.map((text, i) => (
        <p key={i} className="mt-5 text-[15px] leading-relaxed text-fho-text">{text}</p>
      ))}
      {body.sections.map((section) => (
        <Section key={section.h} section={section} contact={content.contact} />
      ))}
      <p className="mt-10 border-t border-fho-border pt-5 text-sm">
        <Link className="text-fho-orange-text underline" to={`/${other}`}>{t(DOCS[other])}</Link>
      </p>
    </article>
  )
}
