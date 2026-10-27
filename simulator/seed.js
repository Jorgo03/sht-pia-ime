/* Demo data for the Shtëpia.ime simulator (simulator/README.md).
 * Made up: no real person, phone number or listing. Plain script (no modules)
 * so it can be inlined into the simulator page and loaded by Node's vm in
 * tests; it sets globalThis.SIM_SEED. */
(function (root) {
  'use strict';

  let DAY = 86400000;
  let now = Date.now();
  let iso = function (ms) { return new Date(ms).toISOString(); };
  let daysAgo = function (d) { return iso(now - d * DAY); };
  let at = function (dayOffset, hour, minute) {
    let d = new Date(now + dayOffset * DAY);
    d.setHours(hour, minute || 0, 0, 0);
    return d.toISOString();
  };

  let ID = {
    agent: '5e1a0000-0000-4000-a000-000000000001',
    client: '5e1a0000-0000-4000-a000-000000000002',
    agent2: '5e1a0000-0000-4000-a000-000000000003',
    agent3: '5e1a0000-0000-4000-a000-000000000004',
    owner: '5e1a0000-0000-4000-a000-000000000005',
    buyer2: '5e1a0000-0000-4000-a000-000000000006',
  };

  let USERS = [
    { id: ID.agent, email: 'agjent@demo.al', password: 'demo1234' },
    { id: ID.client, email: 'klient@demo.al', password: 'demo1234' },
  ];

  let profiles = [
    { id: ID.agent, full_name: 'Elira Kola', role: 'agent', agency_name: 'Drita Prona', phone: '+355 69 410 2201', avatar_url: null, preferred_language: 'sq', created_at: daysAgo(300) },
    { id: ID.client, full_name: 'Arben Hoxha', role: 'client', agency_name: null, phone: '+355 68 220 1180', avatar_url: null, preferred_language: 'sq', created_at: daysAgo(40) },
    { id: ID.agent2, full_name: 'Besnik Dervishi', role: 'agent', agency_name: 'Tirana Home', phone: '+355 69 777 3104', avatar_url: null, preferred_language: 'sq', created_at: daysAgo(500) },
    { id: ID.agent3, full_name: 'Mira Gjoni', role: 'agent', agency_name: 'Riviera Estates', phone: '+355 67 315 9022', avatar_url: null, preferred_language: 'sq', created_at: daysAgo(420) },
    { id: ID.owner, full_name: 'Gentian Leka', role: 'client', agency_name: null, phone: '+39 333 410 7781', avatar_url: null, preferred_language: 'it', created_at: daysAgo(90) },
    { id: ID.buyer2, full_name: 'Sara Marku', role: 'client', agency_name: null, phone: '+355 69 902 4417', avatar_url: null, preferred_language: 'sq', created_at: daysAgo(12) },
  ];

  // City centres, for map pins (rounded; nothing here is a real address).
  let GEO = {
    'Tiranë': [41.3275, 19.8187], 'Durrës': [41.3233, 19.4565], 'Vlorë': [40.4667, 19.4897],
    'Sarandë': [39.8756, 20.0053], 'Shkodër': [42.0683, 19.5126], 'Korçë': [40.6186, 20.7808],
    'Berat': [40.7058, 19.9522], 'Kavajë': [41.2436, 19.5236], 'Lezhë': [41.7836, 19.6436],
  };

  let photo = function (scene, n) { return '/sim/photos/' + scene + '-' + n + '.svg'; };

  let n = 0;
  let listing = function (f) {
    n++;
    let geo = GEO[f.city] || GEO['Tiranë'];
    let agent = f.agent === undefined ? ID.agent2 : f.agent;
    return Object.assign({
      id: '5e1ab000-0000-4000-b000-' + String(n).padStart(12, '0'),
      description: null, title_i18n: null, description_i18n: null,
      address: null, zone: null, sqft: null, beds: null, baths: null,
      property_type: 'apartment', listing_type: 'sale', currency: 'EUR',
      status: 'active', features: [], floor: null, total_floors: null, year_built: null,
      video_url: null, whatsapp_enabled: true, contact_email: null, contact_phone: null,
      floor_plan: null, source_language: 'sq', translation_meta: null, promoted_until: null,
      moderation_hold: false,
      latitude: geo[0] + ((n * 37) % 19 - 9) / 1000,
      longitude: geo[1] + ((n * 53) % 23 - 11) / 1000,
      owner_id: agent || ID.owner, owner_type: agent ? 'agent' : 'client', agent_id: agent,
      created_at: daysAgo(n % 9 === 0 ? 1 : (n * 3) % 40 + 1), updated_at: daysAgo(1),
      ref_code: 'SH' + String(1000 + n),
    }, f, {
      // Real rows carry the source language inside the i18n maps too.
      title_i18n: f.title_i18n ? Object.assign({ sq: f.title }, f.title_i18n) : null,
      description_i18n: f.description_i18n ? Object.assign({ sq: f.description }, f.description_i18n) : null,
    });
  };

  let properties = [
    listing({ title: 'Apartament 2+1 në Bllok', city: 'Tiranë', zone: 'Blloku', address: 'Rruga Ismail Qemali', price: 185000, sqft: 98, beds: 2, baths: 2, floor: 5, total_floors: 9, year_built: 2019, features: ['balcony', 'elevator', 'airConditioning', 'furnished'], agent: ID.agent, image_urls: [photo('city', 1), photo('living', 1), photo('kitchen', 1)],
      description: 'Apartament i ndritshëm në zemër të Bllokut, i rinovuar plotësisht në 2023. Ballkon me pamje nga parku, ashensor dhe kondicionim në çdo dhomë. Dyqane, kafene dhe shkolla në pak minuta këmbë.',
      title_i18n: { en: '2+1 apartment in Blloku', it: 'Appartamento 2+1 a Blloku', de: '2+1-Wohnung in Blloku' },
      description_i18n: { en: 'Bright apartment in the heart of Blloku, fully renovated in 2023. Balcony overlooking the park, lift and air conditioning in every room. Shops, cafés and schools a few minutes away on foot.', it: 'Appartamento luminoso nel cuore di Blloku, completamente ristrutturato nel 2023. Balcone con vista sul parco, ascensore e aria condizionata in ogni stanza. Negozi, caffè e scuole a pochi minuti a piedi.' },
      promoted_until: iso(now + 6 * DAY) }),
    listing({ title: 'Vilë me pishinë në Sauk', city: 'Tiranë', zone: 'Sauk', address: 'Rruga e Saukut', price: 420000, sqft: 260, beds: 4, baths: 3, year_built: 2016, property_type: 'villa', features: ['pool', 'garden', 'parking', 'security'], agent: ID.agent2, image_urls: [photo('villa', 1), photo('pool', 1), photo('living', 2)],
      description: 'Vilë moderne me pishinë dhe kopsht 600 m², në një zonë të qetë e të gjelbër, 10 minuta nga qendra. Garazh për dy makina dhe sistem sigurie.',
      title_i18n: { en: 'Villa with pool in Sauk', it: 'Villa con piscina a Sauk' } }),
    listing({ title: 'Apartament 1+1 me qira te Liqeni', city: 'Tiranë', zone: 'Liqeni i Thatë', price: 650, listing_type: 'rent', sqft: 62, beds: 1, baths: 1, floor: 3, total_floors: 7, features: ['furnished', 'balcony', 'airConditioning'], agent: ID.agent, image_urls: [photo('living', 3), photo('bedroom', 1)],
      description: 'I mobiluar plotësisht, gati për t’u banuar. Pranë Liqenit Artificial dhe Universitetit. Qiraja përfshin mirëmbajtjen e pallatit.' }),
    listing({ title: 'Apartament me pamje nga deti në Plazh', city: 'Durrës', zone: 'Plazh', price: 139000, sqft: 85, beds: 2, baths: 1, floor: 8, total_floors: 12, year_built: 2021, features: ['balcony', 'elevator', 'parking'], agent: ID.agent3, image_urls: [photo('sea', 1), photo('balcony', 1), photo('living', 4)],
      description: 'Ballkon i madh me pamje të plotë nga deti, 100 metra nga plazhi. Pallat i ri me ashensor dhe parkim nëntokësor.',
      title_i18n: { en: 'Sea-view apartment in Plazh', it: 'Appartamento vista mare a Plazh' } }),
    listing({ title: 'Penthouse me tarracë në Komuna e Parisit', city: 'Tiranë', zone: 'Komuna e Parisit', price: 1400, listing_type: 'rent', sqft: 150, beds: 3, baths: 2, floor: 11, total_floors: 11, features: ['balcony', 'elevator', 'parking', 'airConditioning', 'furnished'], agent: ID.agent, image_urls: [photo('city', 2), photo('balcony', 2)],
      description: 'Penthouse me tarracë 80 m² dhe pamje panoramike nga mali i Dajtit. Dy vende parkimi.' }),
    listing({ title: 'Shtëpi me oborr në Rus', city: 'Shkodër', zone: 'Rus', price: 145000, sqft: 140, beds: 3, baths: 2, property_type: 'house', features: ['garden', 'parking'], agent: null, contact_phone: '+39 333 410 7781', image_urls: [photo('house', 1), photo('garden', 1)],
      description: 'Shtëpi dykatëshe me oborr të rrethuar, e rinovuar. Shitet nga pronari, i cili jeton në Itali.' }),
    listing({ title: 'Apartament i ri në Ali Demi', city: 'Tiranë', zone: 'Ali Demi', price: 15000000, currency: 'ALL', sqft: 80, beds: 2, baths: 1, floor: 2, total_floors: 8, year_built: 2024, features: ['elevator', 'storage'], agent: ID.agent2, image_urls: [photo('city', 3), photo('kitchen', 2)],
      description: 'Apartament i ri, i papërdorur, në një pallat të përfunduar në 2024. Çmimi në lekë.' }),
    listing({ title: 'Studio pranë Lungomares', city: 'Vlorë', zone: 'Lungomare', price: 48, listing_type: 'daily_rent', sqft: 38, beds: 1, baths: 1, features: ['airConditioning', 'furnished', 'balcony'], agent: ID.agent3, image_urls: [photo('sea', 2), photo('bedroom', 2)],
      description: 'Studio e këndshme për pushime, 2 minuta nga deti. Çmimi për natë.' }),
    listing({ title: 'Zyrë në Myslym Shyri', city: 'Tiranë', zone: 'Myslym Shyri', price: 1800, listing_type: 'rent', sqft: 120, baths: 2, property_type: 'office', features: ['elevator', 'airConditioning', 'security'], agent: ID.agent, image_urls: [photo('office', 1)],
      description: 'Ambient zyre open-space në katin e tretë, me dy salla mbledhjesh. Ideale për 10–15 persona.' }),
    listing({ title: 'Vilë në Sarandë me pamje nga Korfuzi', city: 'Sarandë', price: 360000, sqft: 210, beds: 4, baths: 3, property_type: 'villa', features: ['pool', 'garden', 'parking', 'balcony'], agent: ID.agent3, image_urls: [photo('villa', 2), photo('sea', 3)],
      description: 'Vilë në kodër me pamje nga deti dhe ishulli i Korfuzit. Pishinë infinity dhe tarracë me pergolë.',
      title_i18n: { en: 'Villa in Sarandë with a view of Corfu', it: 'Villa a Saranda con vista su Corfù' } }),
    listing({ title: 'Apartament 3+1 te Liqeni i Korçës', city: 'Korçë', zone: 'Liqeni i Korçës', price: 98000, sqft: 125, beds: 3, baths: 2, floor: 4, total_floors: 6, features: ['balcony', 'storage'], agent: ID.agent2, image_urls: [photo('city', 4), photo('living', 5)] }),
    listing({ title: 'Tokë për ndërtim në Golem', city: 'Kavajë', zone: 'Golem', price: 210000, sqft: 1500, property_type: 'land', agent: ID.agent3, image_urls: [photo('land', 1)],
      description: 'Truall 1.500 m² me leje ndërtimi, 300 metra nga plazhi i Golemit.' }),
    listing({ title: 'Apartament 2+1 në Selvia', city: 'Tiranë', zone: 'Selvia', price: 128000, sqft: 92, beds: 2, baths: 1, floor: 6, total_floors: 10, year_built: 2012, features: ['balcony', 'elevator'], agent: ID.agent, image_urls: [photo('city', 5), photo('kitchen', 3)] }),
    listing({ title: 'Garsoniere me qira në Spitallë', city: 'Durrës', zone: 'Spitallë', price: 320, listing_type: 'rent', sqft: 40, beds: 1, baths: 1, features: ['furnished'], agent: null, contact_phone: '+355 69 902 4417', owner_id: ID.buyer2, image_urls: [photo('bedroom', 3)] }),
    listing({ title: 'Shtëpi tradicionale në Mangalem', city: 'Berat', zone: 'Mangalem', price: 175000, sqft: 160, beds: 4, baths: 2, property_type: 'house', year_built: 1890, features: ['garden'], agent: ID.agent2, image_urls: [photo('house', 2)],
      description: 'Shtëpi e restauruar në lagjen historike, nën mbrojtjen e UNESCO-s. Mundësi për bujtinë.' }),
    listing({ title: 'Ambient tregtar në Shëngjin', city: 'Lezhë', zone: 'Shëngjin', price: 2200, listing_type: 'rent', sqft: 95, baths: 1, property_type: 'commercial', agent: ID.agent3, image_urls: [photo('office', 2)] }),
    listing({ title: 'Apartament 1+1 në Uji i Ftohtë', city: 'Vlorë', zone: 'Uji i Ftohtë', price: 89000, sqft: 58, beds: 1, baths: 1, floor: 4, total_floors: 7, year_built: 2020, features: ['balcony', 'elevator'], agent: ID.agent3, image_urls: [photo('sea', 4), photo('living', 6)] }),
    listing({ title: 'Garazh në Blloku', city: 'Tiranë', zone: 'Blloku', price: 28000, sqft: 16, property_type: 'garage', agent: ID.agent, image_urls: [photo('garage', 1)] }),
    listing({ title: 'Apartament 2+1 në Lunder', city: 'Tiranë', zone: 'Lunder', price: 110000, sqft: 95, beds: 2, baths: 2, floor: 1, total_floors: 4, year_built: 2018, features: ['garden', 'parking'], agent: ID.agent, status: 'paused', image_urls: [photo('house', 3)] }),
    listing({ title: 'Apartament 3+1 në Qendër', city: 'Shkodër', zone: 'Qendër', price: 104000, sqft: 118, beds: 3, baths: 2, sold_at: null, agent: ID.agent2, status: 'sold', image_urls: [photo('city', 6)] }),
  ];

  let P = function (i) { return properties[i].id; };

  let conversations = [
    { id: '5e1ac000-0000-4000-c000-000000000001', client_id: ID.client, agent_id: ID.agent, property_id: P(0), last_message_at: at(0, 9, 12), created_at: daysAgo(2), unread_for_agent: 1, unread_for_client: 0 },
    { id: '5e1ac000-0000-4000-c000-000000000002', client_id: ID.buyer2, agent_id: ID.agent, property_id: P(2), last_message_at: daysAgo(1), created_at: daysAgo(3), unread_for_agent: 0, unread_for_client: 0 },
    { id: '5e1ac000-0000-4000-c000-000000000003', client_id: ID.client, agent_id: ID.agent3, property_id: P(3), last_message_at: daysAgo(4), created_at: daysAgo(5), unread_for_agent: 0, unread_for_client: 1 },
  ];
  let m = 0;
  let msg = function (conv, sender, body, when) {
    m++;
    return { id: '5e1ad000-0000-4000-d000-' + String(m).padStart(12, '0'), conversation_id: conversations[conv].id, sender_id: sender, body: body, created_at: when, read_at: null };
  };
  let messages = [
    msg(0, ID.client, 'Përshëndetje! A është ende në shitje apartamenti në Bllok?', daysAgo(2)),
    msg(0, ID.agent, 'Po, është i lirë. Mund ta shihni këtë javë, kur ju përshtatet?', daysAgo(2)),
    msg(0, ID.client, 'Nesër pas orës 17:00 do të ishte mirë.', at(0, 9, 12)),
    msg(1, ID.buyer2, 'Qiraja përfshin edhe parkimin?', daysAgo(1)),
    msg(1, ID.agent, 'Jo, parkimi është 50 € në muaj, opsional.', daysAgo(1)),
    msg(2, ID.client, 'Sa larg është nga plazhi?', daysAgo(5)),
    msg(2, ID.agent3, 'Rreth 100 metra, 2 minuta në këmbë.', daysAgo(4)),
  ];

  let viewings = [
    { id: '5e1ae000-0000-4000-e000-000000000001', property_id: P(0), client_id: ID.client, agent_id: ID.agent, scheduled_at: at(0, 17, 0), notes: 'Vij me bashkëshorten.', status: 'confirmed', created_at: daysAgo(1) },
    { id: '5e1ae000-0000-4000-e000-000000000002', property_id: P(4), client_id: ID.buyer2, agent_id: ID.agent, scheduled_at: at(1, 11, 30), notes: null, status: 'requested', created_at: at(0, 8, 0) },
    { id: '5e1ae000-0000-4000-e000-000000000003', property_id: P(12), client_id: ID.buyer2, agent_id: ID.agent, scheduled_at: at(0, 12, 30), notes: null, status: 'requested', created_at: daysAgo(1) },
    { id: '5e1ae000-0000-4000-e000-000000000004', property_id: P(3), client_id: ID.client, agent_id: ID.agent3, scheduled_at: at(3, 10, 0), notes: null, status: 'requested', created_at: daysAgo(1) },
  ];

  let wanted_homes = [
    { id: '5e1af000-0000-4000-f000-000000000001', client_id: ID.buyer2, city: 'Tirana', listing_type: 'sale', max_price: 150000, min_bedrooms: 2, notes: 'Familje me dy fëmijë, afër shkollës.', status: 'open', created_at: daysAgo(2) },
    { id: '5e1af000-0000-4000-f000-000000000002', client_id: ID.client, city: 'Tiranë', listing_type: 'rent', max_price: 900, min_bedrooms: 1, notes: null, status: 'open', created_at: daysAgo(6) },
    { id: '5e1af000-0000-4000-f000-000000000003', client_id: ID.owner, city: 'Vlorë', listing_type: 'sale', max_price: 120000, min_bedrooms: 1, notes: 'Për pushime verore.', status: 'open', created_at: daysAgo(9) },
  ];

  let leads = [
    { id: '5e1a1000-0000-4000-9000-000000000001', agent_id: ID.agent, name: 'Sara Marku', phone: '+355 69 902 4417', email: 'sara@shembull.al', notes: 'Kërkon 2+1 në Tiranë deri 150.000 €. Ka fëmijë, i duhet afër shkollës.', status: 'qualified', created_at: daysAgo(3) },
    { id: '5e1a1000-0000-4000-9000-000000000002', agent_id: ID.agent, name: 'Marco Rossi', phone: '+39 333 000 1144', email: 'marco@esempio.it', notes: 'Diaspora, Itali. Vjen në dhjetor për të parë prona në Durrës.', status: 'contacted', created_at: daysAgo(8) },
    { id: '5e1a1000-0000-4000-9000-000000000003', agent_id: ID.agent, name: 'Klajdi Brahimi', phone: '068 554 3321', email: null, notes: null, status: 'new', created_at: daysAgo(0) },
    { id: '5e1a1000-0000-4000-9000-000000000004', agent_id: ID.agent, name: 'Ana Leka', phone: '+355 67 100 2030', email: 'ana@shembull.al', notes: 'Bleu apartamentin në Selvia.', status: 'won', created_at: daysAgo(30) },
  ];

  let saved_searches = [
    { id: '5e1a2000-0000-4000-8000-000000000001', user_id: ID.client, name: 'Shitje në Tiranë', filters: { city: 'Tiranë', listing_type: 'sale', beds: 2 }, alerts_enabled: true, last_match_count: 3, created_at: daysAgo(10) },
    { id: '5e1a2000-0000-4000-8000-000000000002', user_id: ID.client, name: 'Plazh, Durrës', filters: { city: 'Durrës', zone: 'Plazh' }, alerts_enabled: false, last_match_count: 1, created_at: daysAgo(20) },
  ];

  let favorites = [
    { user_id: ID.client, property_id: P(1), created_at: daysAgo(3) },
    { user_id: ID.client, property_id: P(3), created_at: daysAgo(2) },
  ];

  let property_activity = [];
  properties.forEach(function (p, i) {
    for (let k = 0; k < (i * 7) % 23 + 4; k++) {
      property_activity.push({ id: '5e1a3000-0000-4000-7000-' + String(property_activity.length + 1).padStart(12, '0'), property_id: p.id, type: k % 9 === 0 ? 'call' : k % 5 === 0 ? 'message' : 'view', created_at: daysAgo(k % 25) });
    }
  });

  root.SIM_SEED = {
    version: 1,
    ids: ID,
    geo: GEO,
    users: USERS,
    tables: {
      profiles: profiles,
      properties: properties,
      conversations: conversations,
      messages: messages,
      viewings: viewings,
      wanted_homes: wanted_homes,
      leads: leads,
      saved_searches: saved_searches,
      favorites: favorites,
      property_activity: property_activity,
      notification_preferences: [],
      user_blocks: [],
      content_reports: [],
      push_tokens: [],
      plans: [],
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
