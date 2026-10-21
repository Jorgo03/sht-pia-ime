// What the Notifications sheet says about THIS device (docs/LAUNCH_TASKS.md
// F14). Three separate facts, never merged into one "on":
//   1. the OS permission (asked only from the sheet's button),
//   2. whether this device's push token is registered with the server,
//   3. whether this build can receive remote pushes at all (not on the web,
//      not in Expo Go on Android, not without an EAS project id).
// The account's two category switches are a fourth, separate thing: they are
// saved per account and apply on every device, so they are kept (and still
// editable) when this phone's permission is off.

/**
 * @param {{
 *   platform: 'ios' | 'android' | 'web',
 *   remoteSupported: boolean,
 *   permission: { status: 'granted' | 'denied' | 'undetermined', canAskAgain: boolean } | null,
 *   registration: 'registered' | 'failed' | null,
 * }} input
 * @returns {'web' | 'unavailable' | 'checking' | 'off' | 'blocked' | 'registering' | 'registerFailed' | 'on'}
 */
export function deviceState({ platform, remoteSupported, permission, registration }) {
  if (platform === 'web') return 'web'
  if (!remoteSupported) return 'unavailable'
  if (!permission) return 'checking'
  if (permission.status === 'granted') {
    if (registration === 'registered') return 'on'
    if (registration === 'failed') return 'registerFailed'
    return 'registering'
  }
  // Denied for good (or restricted by parental controls): only Settings can
  // change it. Android 13+ lets an app ask once more after a first "deny".
  if (permission.status === 'denied' && !permission.canAskAgain) return 'blocked'
  return 'off'
}

/** Only this state means a push can arrive on this device. */
export function canReceive(state) {
  return state === 'on'
}

/** States where the sheet's main button asks the OS (or retries registering). */
export function canTurnOn(state) {
  return state === 'off' || state === 'registerFailed'
}

/**
 * Serialises saves and always writes the newest value: the row is replaced
 * as a whole, so two overlapping requests could otherwise land out of order
 * and an older choice would overwrite a newer one. Every caller waiting on
 * the same run gets that run's final outcome.
 *
 * @template T
 * @param {(value: T) => Promise<boolean>} save
 * @returns {(value: T) => Promise<{ ok: boolean, value: T }>}
 */
export function createLatestSaver(save) {
  /** @type {{ value: T } | null} */
  let pending = null
  /** @type {Promise<{ ok: boolean, value: T }> | null} */
  let running = null
  return function request(value) {
    pending = { value }
    if (!running) {
      running = (async () => {
        let ok = false
        let last = value
        while (pending) {
          last = pending.value
          pending = null
          ok = await save(last).catch(() => false)
        }
        running = null
        return { ok, value: last }
      })()
    }
    return running
  }
}
