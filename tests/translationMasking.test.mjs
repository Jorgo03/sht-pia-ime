// Tests for the free translation engine's protection layer.
//
// These rules are a straight port of the mask/unmask logic in
// supabase/functions/translate-property/index.ts. They are duplicated here
// rather than imported because that file is Deno and cannot be loaded by
// `node --test`; the point is to pin the *behaviour* that was established by
// measuring the live engine, so a future edit to the regexes has to break a
// test instead of quietly breaking listings.
//
// What made this necessary, all observed against the real API:
//   "Apartament 2+1 modern ne Bllok"
//     unprotected -> "A modern 2-bedroom apartment on the block"
//   ...the layout notation destroyed, and Blloku (a Tirana district) rendered
//   as the common noun "block".
//
// And the trap on the other side — over-masking:
//   "Cmimi 150000 EUR."  masked -> engine returned bare "Price"
//   ...the placeholder dropped, silently deleting the asking price.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const PLACE_NAMES = [
  'Komuna e Parisit', 'Liqeni i Thate', 'Liqeni i Thatë', 'Myslym Shyri',
  'Pazar i Ri', 'Ali Demi', 'Don Bosko', 'Yzberisht', 'Gjirokaster',
  'Gjirokastër', 'Kombinat', 'Pogradec', 'Sarande', 'Sarandë',
  'Gjiri i Lalzit', 'Rruga e Kavajes', 'Rruga e Kavajës', 'Blloku', 'Bllok',
  'Selvia', 'Astir', 'Sauk', 'Tirane', 'Tiranë', 'Durres', 'Durrës', 'Vlore',
  'Vlorë', 'Shkoder', 'Shkodër', 'Elbasan', 'Korce', 'Korçë', 'Lushnje',
  'Lushnjë', 'Kavaje', 'Kavajë', 'Berat', 'Fier',
].sort((a, b) => b.length - a.length)

const PROTECTED_PATTERNS = [
  /https?:\/\/\S+/gi,
  /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g,
  /\b\d+\+\d+(?:\+\d+)*\b/g,
]

function mask(text) {
  const tokens = []
  let masked = text
  const claim = (match) => {
    const i = tokens.indexOf(match)
    if (i !== -1) return `%%${i}%%`
    tokens.push(match)
    return `%%${tokens.length - 1}%%`
  }
  for (const p of PROTECTED_PATTERNS) masked = masked.replace(p, claim)
  for (const place of PLACE_NAMES) {
    const escaped = place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    masked = masked.replace(
      new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu'),
      claim,
    )
  }
  return { masked, tokens }
}

function unmask(text, tokens) {
  let out = text
  let complete = true
  tokens.forEach((token, i) => {
    if (!new RegExp(`%%\\s*${i}\\s*%%`, 'g').test(out)) {
      complete = false
      return
    }
    out = out.replace(new RegExp(`%%\\s*${i}\\s*%%`, 'g'), token)
  })
  return { text: out, complete }
}

/** mask -> (engine leaves placeholders alone) -> unmask */
function roundTrip(text) {
  const { masked, tokens } = mask(text)
  return unmask(masked, tokens)
}

// ---------- what must be protected ----------

test('room notation is protected — the engine turns 2+1 into "2+ 1" or "2-bedroom"', () => {
  const { masked, tokens } = mask('Apartament 2+1 modern')
  assert.ok(!masked.includes('2+1'), 'the notation must not reach the engine')
  assert.ok(tokens.includes('2+1'))
  assert.equal(roundTrip('Apartament 2+1 modern').text, 'Apartament 2+1 modern')
})

test('three-part room notation survives too', () => {
  assert.equal(roundTrip('Apartament 2+1+2 ne Durres').text, 'Apartament 2+1+2 ne Durres')
})

test('Albanian place names are protected — Bllok became "the apartment does not block"', () => {
  const { masked, tokens } = mask('Apartament ne Bllok')
  assert.ok(!/Bllok/i.test(masked))
  assert.ok(tokens.includes('Bllok'))
  assert.equal(roundTrip('Apartament ne Bllok').text, 'Apartament ne Bllok')
})

test('place names ending in a diacritic are protected', () => {
  // The reason this uses Unicode lookarounds and not \b: JavaScript's \b is
  // ASCII-only, so \bTiranë\b does not match text that plainly contains it,
  // while \bDurrës\b happens to work only because it ends in "s".
  for (const name of ['Tiranë', 'Korçë', 'Vlorë', 'Shkodër', 'Sarandë']) {
    const source = `Apartament ne ${name} sot`
    const { masked, tokens } = mask(source)
    assert.ok(tokens.includes(name), `${name} must be protected`)
    assert.ok(!masked.includes(name), `${name} must not reach the engine`)
    assert.equal(roundTrip(source).text, source)
  }
})

test('multi-word place names win over their fragments', () => {
  const { tokens } = mask('Apartament ne Ali Demi')
  assert.ok(tokens.includes('Ali Demi'))
  assert.equal(roundTrip('Apartament ne Ali Demi').text, 'Apartament ne Ali Demi')
})

test('URLs and emails are protected', () => {
  const source = 'Shiko https://shtepia.ime/x ose shkruaj agjent@shtepia.ime'
  const { tokens } = mask(source)
  assert.ok(tokens.includes('https://shtepia.ime/x'))
  assert.ok(tokens.includes('agjent@shtepia.ime'))
  assert.equal(roundTrip(source).text, source)
})

// ---------- what must NOT be protected ----------

test('prices are left alone — masking them deleted the asking price', () => {
  // "Cmimi 150000 EUR." masked came back as bare "Price": the engine dropped
  // the placeholder and the number vanished from the listing. Unmasked it
  // round-trips fine ("Price EUR 150000."), so it stays unmasked.
  const { tokens } = mask('Cmimi 150000 EUR.')
  assert.deepEqual(tokens, [], 'no part of a price may be masked')
})

test('measurements and floor numbers are left alone', () => {
  // Verified against the live engine: "85 m2, kati 3" -> "85 m2, 3rd floor".
  assert.deepEqual(mask('Apartament modern 85 m2, kati 3.').tokens, [])
})

test('phone numbers are left alone', () => {
  assert.deepEqual(mask('Kontakt: +355 69 123 4567').tokens, [])
})

test('a plain bedroom count is not mistaken for room notation', () => {
  assert.deepEqual(mask('2 Dhoma gjumi').tokens, [])
})

// ---------- boundaries ----------

test('a place name inside a longer word is not touched', () => {
  // "Fier" must not fire inside "Fieri"; "Bllok" must not fire inside
  // "Blloku", which is its own entry and matches first by length.
  assert.deepEqual(mask('ne Fieri').tokens, [])
  assert.deepEqual(mask('ne Blloku').tokens, ['Blloku'])
})

test('the same protected value repeated reuses one placeholder', () => {
  const { tokens } = mask('Bllok dhe Bllok')
  assert.deepEqual(tokens, ['Bllok'])
  assert.equal(roundTrip('Bllok dhe Bllok').text, 'Bllok dhe Bllok')
})

// ---------- the safety net ----------

test('a dropped placeholder is reported, never silently swallowed', () => {
  // This is the case that deleted a price. The caller retries unmasked rather
  // than publishing a fluent sentence with content missing.
  const { tokens } = mask('Cmimi %%X%% ne Bllok')
  const dropped = unmask('Price in', tokens)
  assert.equal(dropped.complete, false)
})

test('a fully returned placeholder set reports complete', () => {
  const { masked, tokens } = mask('Apartament 2+1 ne Bllok')
  assert.equal(unmask(masked, tokens).complete, true)
})

test('engines that pad the marker with spaces are tolerated', () => {
  const { tokens } = mask('Apartament 2+1')
  const restored = unmask('Apartment %% 0 %%', tokens)
  assert.equal(restored.complete, true)
  assert.equal(restored.text, 'Apartment 2+1')
})
