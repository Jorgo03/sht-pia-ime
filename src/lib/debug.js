// Development-only diagnostics for the website, the twin of lib/debug.ts:
// nothing is printed in a production build, so a visitor's console never
// shows internal error text (table names, query details). Messages are
// redacted (emails, phone numbers, tokens, ids). Errors users need to know
// about are shown as short translated messages; crashes are reported,
// redacted, to client_errors (lib/errorReport.js).
import { redact } from './errorReport.js'

export function debugWarn(label, error) {
  if (!import.meta.env?.DEV) return
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error?.message ?? error)
  console.warn(`[${label}]`, redact(text))
}
