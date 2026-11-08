// Who published a listing, shared by both apps (the phone app imports it
// through publisher.d.ts). Pure, for `npm test`.
//
// The publisher is the listing's owner_id, never the person looking at it.
// listing_publisher() on the server decides the account type from that
// profile and returns only what a listing shows; a client's profile stays
// private (migration 20261108203236).

const clean = (value) => {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

/** The server's row for a listing, or null when it may not be shown. */
export async function fetchPublisher(client, propertyId) {
  const { data, error } = await client.rpc('listing_publisher', { p_property: propertyId })
  if (error) throw error
  return (Array.isArray(data) ? data[0] : data) ?? null
}

/**
 * What the "Published by" card shows. Falls back to what the listing itself
 * already carries while the server's answer is pending or if it failed, so a
 * lost request cannot empty the card. Absent details are null, never
 * "undefined", and a client never has an office.
 */
export function publisherView(row, property) {
  const agent = property?.agent ?? null
  const kind =
    row?.kind === 'agent' || row?.kind === 'client'
      ? row.kind
      : agent || property?.owner_type === 'agent'
        ? 'agent'
        : 'client'
  return {
    kind,
    name: clean(row?.full_name) ?? clean(agent?.full_name),
    phone: clean(row?.phone) ?? clean(property?.contact_phone) ?? clean(agent?.phone),
    office: kind === 'agent' ? (clean(row?.agency_name) ?? clean(agent?.agency_name)) : null,
  }
}
