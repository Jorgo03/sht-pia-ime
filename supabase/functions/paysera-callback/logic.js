// Paysera "WebToPay" (checkout v1.6) logic for prepaid plans and promotions
// (docs/LAUNCH_TASKS.md F15). Pure apart from node:crypto, which both Node
// (tests/payseraLogic.test.mjs) and Deno (the Edge Functions) provide.
//
// Source of the protocol, checked 2026-10-21: Paysera's checkout developer
// guide (developers.paysera.com, "Processing callback"; read via search
// summaries because the site is unreachable from the build sandbox) and the
// TypeScript port of Paysera's official PHP library (npm paysera-webtopay
// 1.0.1, read directly). Both agree:
//   request:  data = URL-safe base64 of a query string; sign = md5(data + password)
//   callback: data, ss1 = md5(data + password), ss2 = RSA-SHA1(data),
//             ss3 = RSA-SHA256(data), verified with Paysera's public key
//   only status=1 is a completed payment; reply with exactly "OK".
// Verify against the live sandbox before enabling live payments.

import { Buffer } from 'node:buffer'
import { createHash, createVerify } from 'node:crypto'

export const PAY_URL = 'https://bank.paysera.com/pay/'
export const PUBLIC_KEY_URL = 'https://www.paysera.com/download/public.key'

const toSafe = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_')
const fromSafe = (s) => s.replace(/-/g, '+').replace(/_/g, '/')

export const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex')

/** Constant-time string comparison. */
function sameString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** The signed redirect to Paysera's payment page. Amount is in minor units. */
export function buildPaymentRequest({ projectId, password, orderId, amountCents, currency, acceptUrl, cancelUrl, callbackUrl, test = false, lang }) {
  if (!projectId || !password) throw new Error('paysera_not_configured')
  const params = new URLSearchParams({
    projectid: String(projectId),
    orderid: String(orderId),
    amount: String(amountCents),
    currency: String(currency).toUpperCase(),
    accepturl: acceptUrl,
    cancelurl: cancelUrl,
    callbackurl: callbackUrl,
    version: '1.6',
    test: test ? '1' : '0',
  })
  if (lang) params.set('lang', lang)
  const data = toSafe(Buffer.from(params.toString(), 'utf8').toString('base64'))
  const sign = md5(data + password)
  return { data, sign, url: `${PAY_URL}?data=${encodeURIComponent(data)}&sign=${sign}` }
}

/** Decode the callback's data parameter into its fields. */
export function decodeCallbackData(data) {
  const text = Buffer.from(fromSafe(String(data ?? '')), 'base64').toString('utf8')
  return Object.fromEntries(new URLSearchParams(text))
}

/**
 * Is this callback really from Paysera? RSA (ss3, then ss2) whenever a
 * public key is available; ss1 (shared password) only as a fallback.
 */
export function verifyCallback({ data, ss1, ss2, ss3 }, { publicKey, password }) {
  if (typeof data !== 'string' || !data) return false
  try {
    if (publicKey && (ss3 || ss2)) {
      const verifier = createVerify(ss3 ? 'RSA-SHA256' : 'RSA-SHA1')
      verifier.update(data)
      return verifier.verify(publicKey, Buffer.from(fromSafe(ss3 || ss2), 'base64'))
    }
    if (password && ss1) return sameString(md5(data + password), ss1)
  } catch {
    return false
  }
  return false
}

/**
 * What a verified callback may do. Never activates anything unless it is our
 * project, a completed payment (status 1), and not a test payment in live mode.
 * The amount and currency are checked again against the order in the database
 * (activate_paid_order), so a valid signature over the wrong amount grants nothing.
 */
export function evaluateCallback(fields, { projectId, testMode }) {
  if (String(fields.projectid) !== String(projectId)) return { action: 'reject', reason: 'wrong_project' }
  if (!/^[0-9a-f-]{36}$/i.test(String(fields.orderid ?? ''))) return { action: 'reject', reason: 'bad_order_id' }
  if (String(fields.test) === '1' && !testMode) return { action: 'ignore', reason: 'test_payment_in_live_mode' }
  if (String(fields.status) !== '1') return { action: 'ignore', reason: `status_${fields.status ?? 'missing'}` }
  const amountCents = Number(fields.payamount ?? fields.amount)
  const currency = String(fields.paycurrency ?? fields.currency ?? '').toUpperCase()
  if (!Number.isInteger(amountCents) || !/^[A-Z]{3}$/.test(currency)) return { action: 'reject', reason: 'bad_amount' }
  return {
    action: 'activate',
    orderId: fields.orderid,
    amountCents,
    currency,
    eventId: `${fields.orderid}:${fields.requestid ?? 'paid'}`,
  }
}
