import { Navigate, useSearchParams } from 'react-router-dom'
import { AI_CHAT_ENABLED } from '../lib/features'
import EraChat from '../features/era/EraChat'

// The full-page chat with Era (app/assistant.tsx). `?property=` asks about a
// listing, `?q=` arrives with a question ready, as from a listing page.
export default function Assistant() {
  const [params] = useSearchParams()
  if (!AI_CHAT_ENABLED) return <Navigate to="/" replace />
  return <EraChat variant="page" propertyId={params.get('property')} initialText={params.get('q') ?? ''} />
}
