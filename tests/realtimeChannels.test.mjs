import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// supabase.channel(name) returns the existing channel of that name, and
// removeChannel is asynchronous. A screen that re-subscribes under a fixed
// name while it stays open throws "cannot add postgres_changes callbacks
// after subscribe()". Messages stays open since it became a tab.

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

test('the Messages lists subscribe under a new name every time', () => {
  assert.match(read('app/(tabs)/messages.tsx'), /\.channel\(`messages-inbox-\$\{\+\+inboxChannelSeq\}`\)/)
  assert.match(read('src/features/messaging/pages/Messages.jsx'), /\.channel\(`messages-page-\$\{\+\+pageChannelSeq\}`\)/)
})

test('price per m² is for sales only, on both listing pages', () => {
  assert.match(read('app/property/[id].tsx'), /const pricePerSqm = !suffixKey &&/)
  assert.match(read('src/features/properties/pages/PropertyDetail.jsx'), /const pricePerSqm = !suffixKey &&/)
})
