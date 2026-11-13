// Where the phone app opens (src/features/auth/lib/startScreen.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { openedAtLaunch, shouldStartOnSignIn } from '../src/features/auth/lib/startScreen.js'

test('signed out, a plain launch on a phone opens the sign-in screen', () => {
  for (const platform of ['ios', 'android']) {
    for (const pathname of ['/', '', null, undefined]) {
      assert.equal(shouldStartOnSignIn({ platform, signedIn: false, pathname }), true, `${platform} ${pathname}`)
    }
  }
})

test('signed in, on the website, or opened by a link or notification: no redirect', () => {
  assert.equal(shouldStartOnSignIn({ platform: 'ios', signedIn: true, pathname: '/' }), false)
  assert.equal(shouldStartOnSignIn({ platform: 'web', signedIn: false, pathname: '/' }), false)
  for (const pathname of ['/property/abc', '/messages/abc', '/explore', '/user/abc', '/profile']) {
    assert.equal(shouldStartOnSignIn({ platform: 'android', signedIn: false, pathname }), false, pathname)
  }
})

test('the sign-in screen knows it was the first screen only from its own parameter', () => {
  assert.equal(openedAtLaunch('1'), true)
  assert.equal(openedAtLaunch(['1']), true)
  for (const v of [undefined, null, '', '0', 'true', ['0']]) assert.equal(openedAtLaunch(v), false, String(v))
})

test('the redirect runs once per launch, behind a one-shot guard', () => {
  // CLAUDE.md: never router.replace() inside useEffect without a useRef guard.
  const src = fs.readFileSync(new URL('../components/auth/signed-out-start.tsx', import.meta.url), 'utf8')
  assert.match(src, /useRef\(false\)/)
  assert.match(src, /if \(done\.current\) return;/)
})
