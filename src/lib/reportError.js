// The website's crash reporter (docs/LAUNCH_TASKS.md F11): the shared rules
// in errorReport.js, bound to this app's Supabase client. Off in development
// (import.meta.env.DEV) and when VITE_ERROR_REPORTING=false.
import { supabase } from './supabase'
import { createReporter } from './errorReport'

export const reportError = createReporter({
  client: supabase,
  platform: 'web',
  appVersion: import.meta.env.VITE_APP_VERSION ?? null,
  enabled: !import.meta.env.DEV && import.meta.env.VITE_ERROR_REPORTING !== 'false',
})

/** Uncaught errors and unhandled promise rejections, page-wide. */
export function installGlobalErrorReporting() {
  window.addEventListener('error', (event) => {
    reportError('uncaught', event.error ?? event.message, window.location.pathname)
  })
  window.addEventListener('unhandledrejection', (event) => {
    reportError('unhandled_rejection', event.reason, window.location.pathname)
  })
}
