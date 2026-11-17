import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSign, generateKeyPairSync } from 'node:crypto'
import {
  buildPaymentRequest, decodeCallbackData, evaluateCallback, md5, verifyCallback,
} from '../supabase/functions/paysera-callback/logic.js'

// Paysera callbacks (docs/LAUNCH_TASKS.md F15). A test RSA key stands in for
// Paysera's; nothing here talks to Paysera.

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = publicKey.export({ type: 'spki', format: 'pem' })
const ORDER = '6fcbb91b-7bc2-48f4-8756-658bae9953d5'
const safe = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_')

function callback(fields, { alg = 'RSA-SHA1', password = 'pw' } = {}) {
  const data = safe(Buffer.from(new URLSearchParams(fields).toString()).toString('base64'))
  const sig = createSign(alg).update(data).sign(privateKey).toString('base64')
  return { data, ss1: md5(data + password), [alg === 'RSA-SHA1' ? 'ss2' : 'ss3']: safe(sig) }
}
const paid = { projectid: '123', orderid: ORDER, status: '1', amount: '2490', currency: 'ALL', payamount: '2490', paycurrency: 'ALL', requestid: 'r-1', test: '0' }

test('a payment request is signed, base64url-encoded and round-trips', () => {
  const req = buildPaymentRequest({ projectId: 123, password: 'pw', orderId: ORDER, amountCents: 2490, currency: 'all', acceptUrl: 'https://s/ok', cancelUrl: 'https://s/no', callbackUrl: 'https://f/cb' })
  assert.equal(req.sign, md5(req.data + 'pw'))
  assert.doesNotMatch(req.data, /[+/]/)
  const fields = decodeCallbackData(req.data)
  assert.deepEqual([fields.projectid, fields.orderid, fields.amount, fields.currency, fields.version, fields.test], ['123', ORDER, '2490', 'ALL', '1.6', '0'])
  assert.match(req.url, /^https:\/\/bank\.paysera\.com\/pay\/\?data=/)
  assert.throws(() => buildPaymentRequest({ orderId: ORDER }), /paysera_not_configured/)
})

test('signatures: RSA ss2 and ss3 verify; a tampered body or a wrong key does not', () => {
  const cb = callback(paid)
  assert.equal(verifyCallback(cb, { publicKey: pem }), true)
  assert.equal(verifyCallback(callback(paid, { alg: 'RSA-SHA256' }), { publicKey: pem }), true)
  const tampered = { ...cb, data: callback({ ...paid, amount: '1' }).data }
  assert.equal(verifyCallback(tampered, { publicKey: pem }), false)
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' })
  assert.equal(verifyCallback(cb, { publicKey: other }), false)
})

test('ss1 is only a fallback, and needs the right password', () => {
  const cb = callback(paid)
  assert.equal(verifyCallback({ data: cb.data, ss1: cb.ss1 }, { password: 'pw' }), true)
  assert.equal(verifyCallback({ data: cb.data, ss1: cb.ss1 }, { password: 'nope' }), false)
  assert.equal(verifyCallback({ data: cb.data }, { publicKey: pem, password: 'pw' }), false, 'no signature at all')
  assert.equal(verifyCallback({ data: '', ss1: 'x' }, { password: 'pw' }), false)
})

test('only a completed payment for our project activates', () => {
  const opts = { projectId: '123', testMode: false }
  assert.deepEqual(evaluateCallback(paid, opts), { action: 'activate', orderId: ORDER, amountCents: 2490, currency: 'ALL', eventId: `${ORDER}:r-1` })
  assert.equal(evaluateCallback({ ...paid, projectid: '999' }, opts).action, 'reject')
  assert.equal(evaluateCallback({ ...paid, status: '0' }, opts).action, 'ignore')
  assert.equal(evaluateCallback({ ...paid, status: '2' }, opts).action, 'ignore')
  assert.equal(evaluateCallback({ ...paid, orderid: "1' or 1=1" }, opts).action, 'reject')
  assert.equal(evaluateCallback({ ...paid, payamount: 'x' }, opts).action, 'reject')
})

test('test payments never activate in live mode, only in test mode', () => {
  assert.equal(evaluateCallback({ ...paid, test: '1' }, { projectId: '123', testMode: false }).action, 'ignore')
  assert.equal(evaluateCallback({ ...paid, test: '1' }, { projectId: '123', testMode: true }).action, 'activate')
})
