const GRADIENTS = [
  'linear-gradient(135deg, #a08868 0%, #7a5d3f 50%, #4a3520 100%)',
  'linear-gradient(135deg, #9eb09a, #5f7158)',
  'linear-gradient(135deg, #c2a895, #8a6f5a)',
  'linear-gradient(135deg, #8b9d83, #5d6b56)',
  'linear-gradient(135deg, #b8a89d, #8a7868)',
  'linear-gradient(135deg, #6b7d8a, #485966)',
  'linear-gradient(135deg, #a99580, #756352)',
  'linear-gradient(135deg, #8a9b8e, #5c6b5e)',
]

export function gradientFor(id) {
  if (!id) return GRADIENTS[0]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return GRADIENTS[hash % GRADIENTS.length]
}

export function imageFor(property) {
  if (property?.image_urls?.[0]) return null
  return gradientFor(property?.id)
}

export function formatPrice(n, lang = 'sq') {
  const num = Number(n) || 0
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export function formatDate(dateStr, lang = 'sq') {
  if (!dateStr) return ''
  return new Intl.DateTimeFormat(lang, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateStr))
}
