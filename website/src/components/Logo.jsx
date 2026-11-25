import lockup from '../../../assets/brand/lockup-horizontal-light.svg?raw'

// The approved horizontal lockup, with its two colours made themeable: the
// door keeps the brand orange on white, and the whole mark turns white over
// photos (assets/brand/logo-guide.md: no orange door on busy photos).
const svg = lockup
  .replace('fill="#FF5F1F"', 'fill="var(--logo-door)"')
  .replace('fill="#141414"', 'fill="var(--logo-name)"')
  .replace(/<title>.*?<\/title>/, '')
  .replace('<svg ', '<svg aria-hidden="true" focusable="false" ')

export default function Logo() {
  return <span className="logo" dangerouslySetInnerHTML={{ __html: svg }} />
}
