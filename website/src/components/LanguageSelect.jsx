import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, LANGUAGE_NAMES, setLanguage } from '../i18n'
import Select from './Select'

// A native select: keyboard, screen readers and phone pickers work as people
// expect, in every language.
export default function LanguageSelect({ className = '' }) {
  const { t, i18n } = useTranslation()
  return (
    <label className={`lang-select ${className}`}>
      <Globe size={16} aria-hidden="true" />
      <Select aria-label={t('common.language')} value={i18n.resolvedLanguage} onChange={(e) => setLanguage(e.target.value)}>
        {LANGUAGES.map((code) => (
          <option key={code} value={code} lang={code}>
            {LANGUAGE_NAMES[code]}
          </option>
        ))}
      </Select>
    </label>
  )
}
