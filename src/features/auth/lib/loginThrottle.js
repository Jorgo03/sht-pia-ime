// Slows down password guessing from this device (AUDIT.md Pass 35). Both apps'
// signIn() asks before every password attempt:
//   - 5 failed tries per account in a minute, then that account waits until
//     the minute is over;
//   - 10 failed tries on this device in a minute, across all accounts;
//   - after each failure the next try waits longer: 1, 2, 4, 8 s, up to 30 s.
// A success clears the account. Only wrong passwords count, not network errors.
// This runs in the app; a bot calling Supabase directly is limited by Supabase
// Auth's own per-IP limit (Dashboard → Authentication → Rate Limits).
// Pure: the clock and the optional storage are passed in, so tests drive it.

const WINDOW_MS = 60_000

export function createLoginThrottle({
  now = () => Date.now(),
  perAccount = 5,
  perDevice = 10,
  windowMs = WINDOW_MS,
  maxDelayMs = 30_000,
  load = () => null,
  save = () => {},
} = {}) {
  // { accounts: { [email]: number[] }, device: number[] } of failure times.
  let state = read()

  function read() {
    try {
      const raw = load()
      const parsed = raw ? JSON.parse(raw) : null
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.device)) return parsed
    } catch {
      // A damaged entry starts fresh.
    }
    return { accounts: {}, device: [] }
  }

  function write() {
    try {
      save(JSON.stringify(state))
    } catch {
      // Storage full or blocked: the limits still hold for this session.
    }
  }

  const keyOf = (email) => String(email ?? '').trim().toLowerCase()
  const recent = (times, t) => (times ?? []).filter((x) => t - x < windowMs)

  function prune(t) {
    state.device = recent(state.device, t)
    for (const k of Object.keys(state.accounts)) {
      state.accounts[k] = recent(state.accounts[k], t)
      if (state.accounts[k].length === 0) delete state.accounts[k]
    }
  }

  /** May this account try a password now? waitMs is how long until it may. */
  function check(email) {
    const t = now()
    prune(t)
    const mine = state.accounts[keyOf(email)] ?? []
    let until = 0
    if (mine.length >= perAccount) until = Math.max(until, mine[mine.length - perAccount] + windowMs)
    if (state.device.length >= perDevice) until = Math.max(until, state.device[state.device.length - perDevice] + windowMs)
    if (mine.length > 0) {
      const delay = Math.min(1000 * 2 ** (mine.length - 1), maxDelayMs)
      until = Math.max(until, mine[mine.length - 1] + delay)
    }
    const waitMs = Math.max(0, until - t)
    return { allowed: waitMs === 0, waitMs }
  }

  /** A wrong password for this account. */
  function fail(email) {
    const t = now()
    prune(t)
    const k = keyOf(email)
    state.accounts[k] = [...(state.accounts[k] ?? []), t]
    state.device = [...state.device, t]
    write()
  }

  /** Signed in: this account starts clean. */
  function succeed(email) {
    delete state.accounts[keyOf(email)]
    write()
  }

  return { check, fail, succeed }
}

/** The error signIn() returns while an account has to wait. */
export function tooManyAttemptsError(waitMs) {
  const err = new Error('Too many sign-in attempts')
  err.name = 'AuthThrottleError'
  err.code = 'too_many_attempts'
  err.waitSeconds = Math.max(1, Math.ceil(waitMs / 1000))
  return err
}

/** True for the answer Supabase gives a wrong email or password. */
export function isWrongPassword(error) {
  return error?.code === 'invalid_credentials' || /Invalid login credentials/i.test(error?.message ?? '')
}

/** Storage for the website and the app's web build; the phone apps keep it in memory. */
export const THROTTLE_STORAGE_KEY = 'fho_login_throttle_v1'
