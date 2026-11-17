// Sign in with Apple (docs/LAUNCH_TASKS.md F8). Apple sends the person's name
// only the first time they authorise the app, and never inside the identity
// token, so the app has to save it itself or the account stays nameless.

import { PROFILE_LIMITS } from './profileForm.js'

/**
 * The display name from Apple's credential.fullName, or null when Apple sent
 * none (every sign-in after the first). Blank parts are left out; whitespace
 * is collapsed and the result capped like the profile form's name field.
 */
export function appleFullName(fullName) {
  if (!fullName || typeof fullName !== 'object') return null
  const name = [fullName.givenName, fullName.middleName, fullName.familyName]
    .filter((part) => typeof part === 'string')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PROFILE_LIMITS.full_name)
    .trim()
  return name || null
}
