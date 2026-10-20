// Made-up listings for the end-to-end tests. They have the same shape as rows
// from production, but no real person's name or phone number. The owner phones
// cover the formats people actually type, because those formats caused
// BUG-003, BUG-007 and BUG-011 (replica/bugs.md).

export type Agent = { id: string; full_name: string; phone: string | null; agency_name: string | null; avatar_url: string | null };
export type Listing = Record<string, unknown> & {
  id: string;
  title: string;
  city: string;
  contact_phone: string | null;
  agent: Agent | null;
};

export const AGENT: Agent = {
  id: 'e2e00000-0000-4000-a000-0000000000a1',
  full_name: 'Test Agjenci',
  phone: '+355 69 000 0001',
  agency_name: 'Test Agjenci Sh.p.k.',
  avatar_url: null,
};

const img = (n: number) => `https://images.unsplash.com/photo-e2e-${n}?w=1200`;
const storageImg = (name: string) => `https://e2e.supabase.co/storage/v1/object/public/property-images/${AGENT.id}/${name}`;

function listing(n: number, fields: Partial<Listing>): Listing {
  const id = `e2e00000-0000-4000-b000-${String(n).padStart(12, '0')}`;
  return {
    id,
    title: `Listing ${n}`,
    description: 'Përshkrim prove.',
    price: 100000 + n * 1000,
    address: 'Rruga e Provës 1',
    city: 'Tiranë',
    sqft: 80,
    beds: 2,
    baths: 1,
    property_type: 'apartment',
    listing_type: 'sale',
    image_urls: [img(n), img(n + 100)],
    status: 'active',
    created_at: `2026-10-${String(10 - (n % 9)).padStart(2, '0')}T10:00:00+00:00`,
    updated_at: '2026-10-10T10:00:00+00:00',
    title_i18n: null,
    description_i18n: null,
    owner_id: AGENT.id,
    owner_type: 'agent',
    agent_id: AGENT.id,
    features: ['balcony', 'elevator'],
    currency: 'EUR',
    floor: 3,
    total_floors: 8,
    year_built: 2018,
    video_url: null,
    whatsapp_enabled: true,
    contact_email: null,
    contact_phone: null,
    latitude: 41.3275 + n / 1000,
    longitude: 19.8187,
    floor_plan: null,
    source_language: 'sq',
    translation_meta: null,
    promoted_until: null,
    agent: AGENT,
    ...fields,
  };
}

const owner = (n: number) => ({
  agent: null,
  agent_id: null,
  owner_id: `e2e00000-0000-4000-c000-${String(n).padStart(12, '0')}`,
  owner_type: 'client',
});

export const LISTINGS: Listing[] = [
  // Photos in the agent's own storage folder, as the wizard uploads them, so an
  // edit that removes one can be checked for the storage delete (L07).
  listing(1, {
    title: 'Apartament 2+1 në Bllok',
    contact_phone: '+355 69 000 0001',
    image_urls: [storageImg('photo-1.jpg'), storageImg('photo-2.jpg')],
  }),
  listing(2, { title: 'Vilë me oborr në Sauk', property_type: 'villa', price: 420000 }),
  listing(3, { title: 'Garsoniere me qera', listing_type: 'rent', price: 450, beds: 1 }),
  listing(4, { title: 'Apartament pranë plazhit', city: 'Durrës' }),
  listing(5, { title: 'Apartament 1+1 nga pronari', contact_phone: '0692000005', ...owner(5) }),
  listing(6, { title: 'Apartament me tarracë', contact_phone: '+ 069 20 00 006', ...owner(6) }),
  listing(7, { title: 'Shtëpi për diasporën', contact_phone: '+39 333 000 0007', ...owner(7) }),
];

export const AGENT_LISTING = LISTINGS[0];
export const OWNER_LISTINGS = LISTINGS.filter((l) => !l.agent);
export const MISSING_ID = 'e2e00000-0000-4000-b000-00000000dead';

// One conversation the signed-in agent (AGENT) has with a client about the
// first listing, for the chat tests (report and block).
export const CHAT_CLIENT_ID = 'e2e00000-0000-4000-c000-0000000000c1';
export const CONVERSATIONS = [
  {
    id: 'e2e00000-0000-4000-d000-000000000001',
    client_id: CHAT_CLIENT_ID,
    agent_id: AGENT.id,
    property_id: LISTINGS[0].id,
    last_message_at: '2026-10-10T10:00:00+00:00',
    created_at: '2026-10-10T09:00:00+00:00',
    unread_for_agent: 0,
    unread_for_client: 0,
  },
];

// A saved search of the signed-in agent, last seen when 1 listing matched.
export const SAVED_SEARCHES = [
  {
    id: 'e2e00000-0000-4000-e000-000000000001',
    user_id: AGENT.id,
    name: 'Shitje në Tiranë',
    filters: { city: 'Tiranë', listing_type: 'sale' },
    alerts_enabled: true,
    last_match_count: 1,
    created_at: '2026-10-01T09:00:00+00:00',
  },
];
