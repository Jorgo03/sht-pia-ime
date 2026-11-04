// The listing assistant answers only from one listing's data. When the answer
// is not in that data the model ends its reply with CONTACT_MARKER; the server
// removes the marker and tells the app to show the owner's or agent's contact
// under the reply (`contact: true`). Pure, so it is tested under Node
// (tests/listingAssistantReply.test.mjs).

export const CONTACT_MARKER = '[[CONTACT]]'

export const CONTACT_RULE =
  `- If the answer is not in the listing data, say in one short sentence that the listing does not ` +
  `say, and end your reply with ${CONTACT_MARKER}. The app then shows the seller's contact, so do not ` +
  `write phone numbers or tell the person how to reach the seller yourself.\n` +
  `- Use ${CONTACT_MARKER} also when the person asks to visit, negotiate, or talk to the seller.`

/**
 * Splits a model reply into the text to show and whether to show the contact.
 * @param {string} text
 * @returns {{ reply: string, contact: boolean }}
 */
export function parseReply(text) {
  const raw = typeof text === 'string' ? text : ''
  const contact = raw.includes(CONTACT_MARKER)
  const reply = raw.split(CONTACT_MARKER).join('').replace(/[ \t]+\n/g, '\n').trim()
  return { reply, contact }
}
