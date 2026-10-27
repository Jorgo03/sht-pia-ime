/* Shtëpia.ime simulator: a pretend Supabase that lives inside the page.
 *
 * The app's web build is compiled against https://demo.supabase.co, which is
 * never contacted: window.fetch is wrapped and every request to that host is
 * answered here from demo data (simulator/seed.js), kept in the visitor's own
 * browser (localStorage). Nothing reaches the real Shtëpia.ime database.
 *
 * Plain script, no modules: inlined into the simulator page, and loaded by
 * tests/simulatorBackend.test.mjs through Node's vm. In the page it installs
 * itself (fetch, WebSocket, <img> sources, a small "Simulator" panel); in tests
 * only createBackend() is used. */
(function (root) {
  'use strict';

  let HOST = 'demo.supabase.co';
  let BASE = 'https://' + HOST;
  let DB_KEY = 'shtepia-sim:db:v1';
  let SESSION_KEY = 'sb-demo-auth-token';
  let OTP = '123456';
  let GEOCODER = 'https://nominatim.openstreetmap.org/';

  // ---------------------------------------------------------------- helpers
  let clone = function (v) { return JSON.parse(JSON.stringify(v)); };
  let b64url = function (s) {
    let b = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : root.Buffer.from(s, 'utf8').toString('base64');
    return b.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  };
  let unb64url = function (s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return typeof atob === 'function' ? decodeURIComponent(escape(atob(s))) : root.Buffer.from(s, 'base64').toString('utf8');
  };
  let fold = function (v) {
    return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  };
  let isNum = function (v) { return v !== '' && v !== null && v !== undefined && !isNaN(Number(v)); };

  /** Splits "a,b(c,d),e" at top-level commas. */
  function splitTop(s) {
    let parts = [], depth = 0, cur = '', quoted = false;
    for (let i = 0; i < s.length; i++) {
      let ch = s[i];
      if (ch === '"') quoted = !quoted;
      if (!quoted && ch === '(') depth++;
      if (!quoted && ch === ')') depth--;
      if (!quoted && ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    if (cur) parts.push(cur);
    return parts.map(function (p) { return p.trim(); }).filter(Boolean);
  }

  function compare(a, b) {
    if (isNum(a) && isNum(b)) return Number(a) - Number(b);
    a = String(a); b = String(b);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function likeRegex(pattern, insensitive) {
    let src = String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*').replace(/_/g, '.');
    return new RegExp('^' + src + '$', insensitive ? 'is' : 's');
  }

  function unquote(v) {
    v = String(v);
    return v.length > 1 && v[0] === '"' && v[v.length - 1] === '"' ? v.slice(1, -1) : v;
  }

  /** One PostgREST condition ("price.gte.100", "not.status.eq.sold", "and(...)"). */
  function test(row, op, value, column) {
    let v = row[column];
    switch (op) {
      case 'eq': return v != null && (typeof v === 'boolean' ? String(v) === value : isNum(v) && isNum(value) ? Number(v) === Number(value) : String(v) === unquote(value));
      case 'neq': return v != null && String(v) !== unquote(value);
      case 'gt': return v != null && compare(v, value) > 0;
      case 'gte': return v != null && compare(v, value) >= 0;
      case 'lt': return v != null && compare(v, value) < 0;
      case 'lte': return v != null && compare(v, value) <= 0;
      case 'like': return v != null && likeRegex(value, false).test(String(v));
      case 'ilike': return v != null && likeRegex(value, true).test(String(v));
      case 'is': return value === 'null' ? v == null : value === 'true' ? v === true : value === 'false' ? v === false : false;
      case 'in': {
        let list = splitTop(value.replace(/^\(/, '').replace(/\)$/, '')).map(unquote);
        return v != null && list.indexOf(String(v)) >= 0;
      }
      case 'cs': {
        let want = value.replace(/^[{[]/, '').replace(/[}\]]$/, '').split(',').map(unquote).filter(Boolean);
        return Array.isArray(v) && want.every(function (w) { return v.map(String).indexOf(w) >= 0; });
      }
      default: return true; // an operator the app does not use: never hide rows for it
    }
  }

  function holds(row, cond) {
    if (/^and\(/.test(cond)) return splitTop(cond.slice(4, -1)).every(function (c) { return holds(row, c); });
    if (/^or\(/.test(cond)) return splitTop(cond.slice(3, -1)).some(function (c) { return holds(row, c); });
    if (/^not\.(and|or)\(/.test(cond)) return !holds(row, cond.slice(4));
    let parts = cond.split('.');
    let column = parts.shift();
    let op = parts.shift();
    let negate = false;
    if (op === 'not') { negate = true; op = parts.shift(); }
    let r = test(row, op, parts.join('.'), column);
    return negate ? !r : r;
  }

  let RESERVED = { select: 1, order: 1, limit: 1, offset: 1, on_conflict: 1, columns: 1 };

  function applyFilters(rows, params) {
    let out = rows;
    params.forEach(function (expr, key) {
      if (RESERVED[key]) return;
      if (key === 'or') { out = out.filter(function (r) { return splitTop(expr.slice(1, -1)).some(function (c) { return holds(r, c); }); }); return; }
      if (key === 'and') { out = out.filter(function (r) { return splitTop(expr.slice(1, -1)).every(function (c) { return holds(r, c); }); }); return; }
      let negate = /^not\./.test(expr);
      if (negate) expr = expr.slice(4);
      let dot = expr.indexOf('.');
      let op = expr.slice(0, dot), value = expr.slice(dot + 1);
      out = out.filter(function (r) { let ok = test(r, op, value, key); return negate ? !ok : ok; });
    });
    return out;
  }

  function applyOrder(rows, order) {
    if (!order) return rows;
    let keys = order.split(',').map(function (k) {
      let p = k.split('.');
      return { col: p[0], desc: p.indexOf('desc') > 0, nullsFirst: p.indexOf('nullsfirst') > 0 };
    });
    return rows.slice().sort(function (a, b) {
      for (let i = 0; i < keys.length; i++) {
        let k = keys[i], x = a[k.col], y = b[k.col];
        if (x == null && y == null) continue;
        if (x == null) return k.nullsFirst ? -1 : 1;
        if (y == null) return k.nullsFirst ? 1 : -1;
        let c = compare(x, y);
        if (c) return k.desc ? -c : c;
      }
      return 0;
    });
  }

  // "*, agent:profiles(id, full_name)" -> { columns: ['*'], embeds: [{alias, table, select}] }
  function parseSelect(select) {
    let columns = [], embeds = [];
    splitTop(select || '*').forEach(function (part) {
      let m = /^(?:([a-z_]+):)?([a-z_]+)(?:![a-z_]+)?\((.*)\)$/i.exec(part);
      if (m) embeds.push({ alias: m[1] || m[2], table: m[2], select: m[3] });
      else columns.push(part.replace(/^[a-z_]+:/i, '').replace(/::[a-z]+$/i, ''));
    });
    return { columns: columns, embeds: embeds };
  }

  let SINGULAR = { properties: 'property', profiles: 'profile', conversations: 'conversation', viewings: 'viewing', leads: 'lead' };

  function uuid() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
    let h = '';
    for (let i = 0; i < 32; i++) h += Math.floor(Math.random() * 16).toString(16);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-a' + h.slice(17, 20) + '-' + h.slice(20, 32);
  }

  // ---------------------------------------------------------------- demo AI
  let DICT = {
    en: { 'Apartament': 'Apartment', 'apartament': 'apartment', 'Vilë': 'Villa', 'vilë': 'villa', 'Shtëpi': 'House', 'shtëpi': 'house', 'me pishinë': 'with pool', 'me pamje nga deti': 'with sea view', 'me qira': 'for rent', 'në': 'in', 'me': 'with', 'pranë': 'near', 'Studio': 'Studio', 'Zyrë': 'Office', 'Tokë': 'Land', 'ballkon': 'balcony', 'i ri': 'new', 'i ndritshëm': 'bright', 'i rinovuar': 'renovated', 'parkut': 'the park', 'tarracë': 'terrace', 'oborr': 'yard' },
    it: { 'Apartament': 'Appartamento', 'apartament': 'appartamento', 'Vilë': 'Villa', 'vilë': 'villa', 'Shtëpi': 'Casa', 'shtëpi': 'casa', 'me pishinë': 'con piscina', 'me pamje nga deti': 'vista mare', 'me qira': 'in affitto', 'në': 'a', 'me': 'con', 'pranë': 'vicino a', 'Zyrë': 'Ufficio', 'Tokë': 'Terreno', 'ballkon': 'balcone', 'i ri': 'nuovo', 'i ndritshëm': 'luminoso', 'i rinovuar': 'ristrutturato', 'parkut': 'parco', 'tarracë': 'terrazza', 'oborr': 'cortile' },
    de: { 'Apartament': 'Wohnung', 'apartament': 'Wohnung', 'Vilë': 'Villa', 'vilë': 'Villa', 'Shtëpi': 'Haus', 'shtëpi': 'Haus', 'me pishinë': 'mit Pool', 'me pamje nga deti': 'mit Meerblick', 'me qira': 'zur Miete', 'në': 'in', 'me': 'mit', 'pranë': 'nahe', 'Zyrë': 'Büro', 'Tokë': 'Grundstück', 'ballkon': 'Balkon', 'i ri': 'neu', 'i ndritshëm': 'hell', 'i rinovuar': 'renoviert', 'parkut': 'Park', 'tarracë': 'Terrasse', 'oborr': 'Hof' },
  };
  function demoTranslate(text, lang) {
    if (!text) return '';
    let d = DICT[lang];
    if (!d) return text;
    let keys = Object.keys(d).sort(function (a, b) { return b.length - a.length; });
    let out = text;
    keys.forEach(function (k) {
      out = out.replace(new RegExp('(^|[\\s,.;:!?(])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[\\s,.;:!?)])', 'g'), function (m0, pre) { return pre + d[k]; });
    });
    return out;
  }

  let FEATURE_SQ = { balcony: 'ballkon', parking: 'parkim', elevator: 'ashensor', garden: 'kopsht', pool: 'pishinë', furnished: 'e mobiluar', airConditioning: 'kondicionim', security: 'siguri', storage: 'magazinë' };
  function demoAssistant(p, question) {
    let q = fold(question);
    let feats = (p.features || []);
    let has = function (k) { return feats.indexOf(k) >= 0; };
    let price = Number(p.price).toLocaleString('sq-AL') + ' ' + (p.currency || 'EUR');
    if (/park|garazh|makin/.test(q)) return has('parking') ? 'Po, prona ka parkim.' : 'Në njoftim nuk përmendet parkim. Pyeteni agjentin nëse ka mundësi afër.';
    if (/ballkon|tarrac/.test(q)) return has('balcony') ? 'Po, ka ballkon.' : 'Njoftimi nuk përmend ballkon.';
    if (/ashensor|lift/.test(q)) return has('elevator') ? 'Po, pallati ka ashensor.' : 'Njoftimi nuk përmend ashensor.';
    if (/cmim|kushton|sa eshte|price|euro|lek/.test(q)) return 'Çmimi i shpallur është ' + price + (p.sqft ? ', rreth ' + Math.round(Number(p.price) / Number(p.sqft)) + ' për m².' : '.');
    if (/dhom|gjum|banjo/.test(q)) return 'Ka ' + (p.beds || 0) + ' dhoma gjumi dhe ' + (p.baths || 0) + ' banjo' + (p.sqft ? ', ' + p.sqft + ' m² gjithsej.' : '.');
    if (/ku|zona|lagj|adres/.test(q)) return 'Ndodhet në ' + [p.zone, p.city].filter(Boolean).join(', ') + '. Adresën e saktë e jep agjenti para vizitës.';
    let list = feats.map(function (k) { return FEATURE_SQ[k] || k; });
    return 'Kjo pronë ' + (p.listing_type === 'sale' ? 'shitet' : 'jepet me qira') + ' për ' + price + (list.length ? ' dhe ka ' + list.join(', ') + '.' : '.') + ' Për detaje të tjera, shkruani agjentit.';
  }

  // ---------------------------------------------------------------- backend
  function createBackend(options) {
    let seed = options.seed;
    let storage = options.storage || null;
    let db;
    try { db = storage && JSON.parse(storage.getItem(DB_KEY) || 'null'); } catch { db = null; }
    if (!db || db.version !== seed.version) db = { version: seed.version, users: clone(seed.users), tables: clone(seed.tables) };
    if (!db.blobs) db.blobs = {};
    let blobs = db.blobs;
    let saveTimer = null;
    function save() {
      if (!storage) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { try { storage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* storage full or blocked: the session keeps working */ } }, 50);
    }
    let T = function (name) { return db.tables[name] || (db.tables[name] = []); };
    let nowIso = function () { return new Date().toISOString(); };

    // -------- auth
    function userObject(u) {
      let prof = T('profiles').filter(function (p) { return p.id === u.id; })[0] || {};
      return {
        id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
        email_confirmed_at: u.created_at || nowIso(), phone: '', confirmed_at: u.created_at || nowIso(),
        last_sign_in_at: nowIso(),
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: { full_name: prof.full_name || '', role: prof.role || 'client' },
        identities: [], created_at: u.created_at || nowIso(), updated_at: nowIso(),
      };
    }
    function session(u) {
      let exp = Math.floor(Date.now() / 1000) + 3600 * 24 * 7;
      let token = [b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), b64url(JSON.stringify({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', exp: exp })), 'simulator'].join('.');
      return { access_token: token, token_type: 'bearer', expires_in: 3600 * 24 * 7, expires_at: exp, refresh_token: 'sim.' + u.id, user: userObject(u) };
    }
    function uidFrom(headers) {
      let auth = headers.authorization || '';
      let m = /^Bearer\s+(.+)$/i.exec(auth);
      if (!m) return null;
      let parts = m[1].split('.');
      if (parts.length !== 3) return null;
      try { let sub = JSON.parse(unb64url(parts[1])).sub; return db.users.some(function (u) { return u.id === sub; }) ? sub : null; } catch { return null; }
    }
    function findUser(email) {
      let e = fold(email).trim();
      return db.users.filter(function (u) { return fold(u.email) === e; })[0] || null;
    }
    function createUser(email, password, data) {
      let id = uuid();
      let u = { id: id, email: String(email).trim().toLowerCase(), password: password || null, created_at: nowIso() };
      db.users.push(u);
      let role = data && data.role === 'agent' ? 'agent' : 'client';
      T('profiles').push({ id: id, full_name: (data && data.full_name) || String(email).split('@')[0], role: role, agency_name: (data && data.agency_name) || null, phone: null, avatar_url: null, preferred_language: 'sq', created_at: nowIso() });
      save();
      return u;
    }
    let authError = function (status, code, msg) { return { status: status, body: { code: status, error_code: code, msg: msg, error: code, error_description: msg } }; };

    function auth(method, path, params, body, headers) {
      if (path === '/settings') return { status: 200, body: { external: { email: true, google: false, apple: false }, disable_signup: false, mailer_autoconfirm: true, phone_autoconfirm: false } };
      if (path === '/token') {
        let grant = params.get('grant_type');
        if (grant === 'password') {
          let u = findUser(body.email);
          if (!u || (u.password && u.password !== body.password)) return authError(400, 'invalid_credentials', 'Invalid login credentials');
          return { status: 200, body: session(u) };
        }
        if (grant === 'refresh_token') {
          let id = String(body.refresh_token || '').replace(/^sim\./, '');
          let ru = db.users.filter(function (x) { return x.id === id; })[0];
          return ru ? { status: 200, body: session(ru) } : authError(400, 'refresh_token_not_found', 'Invalid Refresh Token');
        }
        return authError(400, 'unsupported_grant_type', 'Not available in the simulator');
      }
      if (path === '/signup') {
        if (findUser(body.email)) return authError(422, 'user_already_exists', 'User already registered');
        if (!body.password || String(body.password).length < 6) return authError(422, 'weak_password', 'Password should be at least 6 characters.');
        let nu = createUser(body.email, body.password, body.data);
        let s = session(nu);
        return { status: 200, body: Object.assign({}, s, { user: s.user }) };
      }
      if (path === '/otp' || path === '/resend' || path === '/recover') return { status: 200, body: {} };
      if (path === '/verify') {
        if (String(body.token) !== OTP) return authError(403, 'otp_expired', 'Token has expired or is invalid');
        let vu = findUser(body.email) || createUser(body.email, null, {});
        return { status: 200, body: session(vu) };
      }
      let uid = uidFrom(headers);
      let me = db.users.filter(function (x) { return x.id === uid; })[0];
      if (path === '/user') {
        if (!me) return authError(401, 'bad_jwt', 'Invalid token');
        if (method === 'PUT') {
          if (body.password) me.password = body.password;
          if (body.email) me.email = String(body.email).toLowerCase();
          save();
        }
        return { status: 200, body: userObject(me) };
      }
      if (path === '/logout') return { status: 204, body: null };
      return authError(404, 'not_found', 'Not available in the simulator');
    }

    // -------- row-level privacy, like the real RLS rules
    function readable(table, uid) {
      let mine = function (col) { return function (r) { return uid && r[col] === uid; }; };
      let props = T('properties');
      let myProp = function (pid) { return props.some(function (p) { return p.id === pid && uid && (p.owner_id === uid || p.agent_id === uid); }); };
      switch (table) {
        case 'properties': return function (r) { return (r.status === 'active' && !r.moderation_hold) || (uid && (r.owner_id === uid || r.agent_id === uid)); };
        case 'favorites': case 'saved_searches': case 'notification_preferences': case 'push_tokens': return mine('user_id');
        case 'leads': return mine('agent_id');
        case 'user_blocks': return mine('blocker_id');
        case 'conversations': return function (r) { return uid && (r.client_id === uid || r.agent_id === uid); };
        case 'messages': {
          let convs = T('conversations').filter(function (c) { return uid && (c.client_id === uid || c.agent_id === uid); }).map(function (c) { return c.id; });
          return function (r) { return convs.indexOf(r.conversation_id) >= 0; };
        }
        case 'viewings': return function (r) { return uid && (r.client_id === uid || r.agent_id === uid || myProp(r.property_id)); };
        case 'wanted_homes': {
          let isAgent = T('profiles').some(function (p) { return p.id === uid && p.role === 'agent'; });
          return function (r) { return (uid && r.client_id === uid) || (isAgent && r.status === 'open'); };
        }
        case 'property_activity': return function (r) { return myProp(r.property_id); };
        case 'content_reports': return function () { return false; };
        default: return function () { return true; };
      }
    }
    function writable(table, uid) {
      if (!uid) return function () { return false; };
      switch (table) {
        case 'properties': return function (r) { return r.owner_id === uid || r.agent_id === uid; };
        case 'profiles': return function (r) { return r.id === uid; };
        case 'viewings': return readable('viewings', uid);
        case 'conversations': return readable('conversations', uid);
        case 'messages': return function (r) { return readable('messages', uid)(r); };
        case 'wanted_homes': return function (r) { return r.client_id === uid; };
        default: return readable(table, uid);
      }
    }

    // -------- defaults and the database's own side effects (triggers)
    function prepareInsert(table, row, uid) {
      row = Object.assign({}, row);
      if (table !== 'favorites' && table !== 'notification_preferences' && !row.id) row.id = uuid();
      if (!row.created_at) row.created_at = nowIso();
      if (table === 'leads' && !row.agent_id) row.agent_id = uid;
      if ((table === 'favorites' || table === 'saved_searches' || table === 'notification_preferences' || table === 'push_tokens') && !row.user_id) row.user_id = uid;
      if (table === 'user_blocks' && !row.blocker_id) row.blocker_id = uid;
      if (table === 'wanted_homes' && !row.client_id) row.client_id = uid;
      if (table === 'wanted_homes' && !row.status) row.status = 'open';
      if (table === 'leads' && !row.status) row.status = 'new';
      if (table === 'viewings') {
        if (!row.status) row.status = 'requested';
        if (!row.agent_id) {
          let p = T('properties').filter(function (x) { return x.id === row.property_id; })[0];
          row.agent_id = p ? p.agent_id || p.owner_id : null;
        }
      }
      if (table === 'conversations') {
        row.unread_for_agent = row.unread_for_agent || 0;
        row.unread_for_client = row.unread_for_client || 0;
        row.last_message_at = row.last_message_at || row.created_at;
      }
      if (table === 'properties') {
        row = Object.assign({ status: 'active', features: [], image_urls: [], moderation_hold: false, translation_meta: null, promoted_until: null, whatsapp_enabled: true, owner_type: 'agent' }, row);
        if (!row.owner_id) row.owner_id = uid;
        row.ref_code = row.ref_code || 'SH' + String(1000 + T('properties').length + 1);
        row.updated_at = nowIso();
      }
      return row;
    }
    function afterInsert(table, row) {
      if (table === 'messages') {
        let c = T('conversations').filter(function (x) { return x.id === row.conversation_id; })[0];
        if (c) {
          c.last_message_at = row.created_at;
          if (row.sender_id === c.client_id) c.unread_for_agent = (c.unread_for_agent || 0) + 1;
          else c.unread_for_client = (c.unread_for_client || 0) + 1;
        }
      }
    }
    let UNIQUE = { favorites: ['user_id', 'property_id'], notification_preferences: ['user_id'], user_blocks: ['blocker_id', 'blocked_id'], push_tokens: ['token'], conversations: ['property_id', 'client_id', 'agent_id'] };

    // -------- REST
    function embedRows(table, rows, embeds, uid) {
      if (!embeds.length) return rows;
      return rows.map(function (row) {
        let out = Object.assign({}, row);
        embeds.forEach(function (e) {
          let fk = row[e.alias + '_id'] !== undefined ? e.alias + '_id' : (SINGULAR[e.table] || e.table) + '_id';
          let target = T(e.table).filter(function (t) { return t.id === row[fk]; })[0];
          let visible = target && (e.table === 'profiles' || readable(e.table, uid)(target)) ? target : null;
          let sub = parseSelect(e.select);
          out[e.alias] = visible ? project(embedRows(e.table, [visible], sub.embeds, uid)[0], sub) : null;
        });
        return out;
      });
    }
    function project(row, sel) {
      if (!row || sel.columns.indexOf('*') >= 0 || !sel.columns.length) return row;
      let out = {};
      sel.columns.forEach(function (c) { if (c in row) out[c] = row[c]; });
      sel.embeds.forEach(function (e) { out[e.alias] = row[e.alias]; });
      return out;
    }

    function rest(method, table, params, body, headers) {
      let uid = uidFrom(headers);
      let prefer = headers.prefer || '';
      let wantsOne = /vnd\.pgrst\.object/.test(headers.accept || '');
      let wantsRows = /return=representation/.test(prefer);
      let sel = parseSelect(params.get('select'));
      let all = T(table);

      let finish = function (rows, status) {
        let shaped = embedRows(table, rows, sel.embeds, uid).map(function (r) { return project(r, sel); });
        if (wantsOne) {
          if (shaped.length !== 1) return { status: 406, body: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains ' + shaped.length + ' rows' } };
          return { status: status, body: shaped[0] };
        }
        return { status: status, body: shaped };
      };

      if (method === 'GET' || method === 'HEAD') {
        let rows = applyFilters(all.filter(readable(table, uid)), params);
        let total = rows.length;
        rows = applyOrder(rows, params.get('order'));
        let offset = Number(params.get('offset') || 0);
        let limit = params.get('limit');
        let page = limit != null ? rows.slice(offset, offset + Number(limit)) : rows.slice(offset);
        let range = (page.length ? offset + '-' + (offset + page.length - 1) : '*') + '/' + (/count=/.test(prefer) || method === 'HEAD' ? total : '*');
        if (method === 'HEAD') return { status: 200, body: null, headers: { 'content-range': range } };
        let res = finish(page, 200);
        res.headers = { 'content-range': range };
        return res;
      }

      if (method === 'POST') {
        if (!uid && table !== 'property_activity' && table !== 'content_reports') return { status: 401, body: { code: '42501', message: 'new row violates row-level security policy' } };
        let list = Array.isArray(body) ? body : [body];
        let upsert = /resolution=merge-duplicates/.test(prefer);
        let ignore = /resolution=ignore-duplicates/.test(prefer);
        let keys = params.get('on_conflict') ? params.get('on_conflict').split(',') : UNIQUE[table];
        let written = [];
        for (let i = 0; i < list.length; i++) {
          const row = prepareInsert(table, list[i], uid);
          let dup = keys && all.filter(function (r) { return keys.every(function (k) { return String(r[k]) === String(row[k]); }); })[0];
          if (dup) {
            if (upsert) { Object.assign(dup, list[i]); written.push(dup); continue; }
            if (ignore) continue;
            return { status: 409, body: { code: '23505', message: 'duplicate key value violates unique constraint' } };
          }
          all.push(row);
          afterInsert(table, row);
          written.push(row);
        }
        save();
        return wantsRows ? finish(written, 201) : { status: 201, body: null };
      }

      if (method === 'PATCH') {
        let targets = applyFilters(all.filter(writable(table, uid)), params);
        targets.forEach(function (r) {
          Object.assign(r, body);
          if (table === 'properties' || table === 'leads') r.updated_at = nowIso();
        });
        save();
        return wantsRows ? finish(targets, 200) : { status: 204, body: null };
      }

      if (method === 'DELETE') {
        let gone = applyFilters(all.filter(writable(table, uid)), params);
        db.tables[table] = all.filter(function (r) { return gone.indexOf(r) < 0; });
        save();
        return wantsRows ? finish(gone, 200) : { status: 204, body: null };
      }
      return { status: 405, body: { message: 'Method not allowed' } };
    }

    function rpc(name, body, headers) {
      let uid = uidFrom(headers);
      if (name === 'claim_role') {
        let p = T('profiles').filter(function (x) { return x.id === uid; })[0];
        if (!p) return { status: 401, body: { message: 'not signed in' } };
        if (body.new_role === 'agent' || body.new_role === 'client' || body.new_role === 'buyer') p.role = body.new_role === 'agent' ? 'agent' : 'client';
        save();
        return { status: 200, body: p };
      }
      if (name === 'is_moderator') return { status: 200, body: false };
      if (name === 'register_push_token') return { status: 200, body: null };
      return { status: 403, body: { code: '42501', message: 'Not available in the simulator' } };
    }

    function functions(name, body, headers) {
      if (name === 'translate-property') {
        let lang = body.targetLanguage || 'en';
        return { status: 200, body: { title: demoTranslate(body.title, lang), description: demoTranslate(body.description, lang), provider: 'anthropic' } };
      }
      if (name === 'ai-listing-assistant') {
        let p = T('properties').filter(function (x) { return x.id === body.property_id; })[0];
        let last = (body.messages || []).filter(function (m) { return m.role === 'user'; }).pop();
        return p ? { status: 200, body: { reply: demoAssistant(p, last ? last.content : '') } } : { status: 404, body: { error: 'not_found' } };
      }
      if (name === 'delete-account') {
        let uid = uidFrom(headers);
        db.users = db.users.filter(function (u) { return u.id !== uid; });
        save();
        return { status: 200, body: { deleted: true } };
      }
      return { status: 503, body: { error: 'unavailable_in_simulator' } };
    }

    function storageApi(method, path, body) {
      // /object/<bucket>/<path...>; deletes post {prefixes} to /object/<bucket>
      let m = /^\/object\/(?:public\/)?([^/]+)\/?(.*)$/.exec(path);
      if (!m) return { status: 404, body: { message: 'not found' } };
      if (method === 'DELETE') {
        (body && body.prefixes || []).forEach(function (p) { delete blobs[m[1] + '/' + p]; });
        return { status: 200, body: [] };
      }
      if (method === 'POST' || method === 'PUT') {
        blobs[m[1] + '/' + m[2]] = typeof body === 'string' ? body : null;
        save();
        return { status: 200, body: { Key: m[1] + '/' + m[2], Id: uuid() } };
      }
      return { status: 400, body: { message: 'unsupported' } };
    }

    /** One request to the pretend Supabase. headers: lower-case keys. */
    function handle(req) {
      let url = new URL(req.url);
      let path = url.pathname;
      let method = (req.method || 'GET').toUpperCase();
      let headers = req.headers || {};
      let body = req.body;
      if (typeof body === 'string' && /json/.test(headers['content-type'] || 'application/json')) { try { body = JSON.parse(body); } catch { /* not JSON */ } }
      if (body == null) body = {};
      let out;
      if (path.indexOf('/auth/v1') === 0) out = auth(method, path.slice(8), url.searchParams, body, headers);
      else if (path.indexOf('/rest/v1/rpc/') === 0) out = rpc(path.slice(13), body, headers);
      else if (path.indexOf('/rest/v1/') === 0) out = rest(method, path.slice(9), url.searchParams, body, headers);
      else if (path.indexOf('/functions/v1/') === 0) out = functions(path.slice(14), body, headers);
      else if (path.indexOf('/storage/v1') === 0) out = storageApi(method, path.slice(11), req.rawBody != null ? req.rawBody : body);
      else out = { status: 404, body: { message: 'not found' } };
      return out;
    }

    function blobFor(publicUrl) {
      let m = /\/storage\/v1\/object\/public\/(.+)$/.exec(publicUrl);
      return m ? blobs[decodeURIComponent(m[1].split('?')[0])] : undefined;
    }

    return {
      handle: handle,
      blobFor: blobFor,
      session: function (email) { let u = findUser(email); return u ? session(u) : null; },
      reset: function () { db = { version: seed.version, users: clone(seed.users), tables: clone(seed.tables), blobs: {} }; blobs = db.blobs; try { storage && storage.removeItem(DB_KEY); } catch { /* ignore */ } },
      db: function () { return db; },
    };
  }

  // ---------------------------------------------------------------- the page
  function install(win) {
    if (win.__SIM__) return;
    let store;
    try { store = win.localStorage; store.getItem('x'); } catch { store = null; }
    let backend = createBackend({ seed: win.SIM_SEED, storage: store });
    win.__SIM__ = backend;
    try {
      if (store && !store.getItem('fho_lang')) store.setItem('fho_lang', 'sq');
      if (store) store.setItem('fho_cookie_consent', 'accepted');
    } catch { /* storage blocked: the app falls back to its defaults */ }

    // Picked photos are blob: URLs, which a page may be barred from loading.
    // Remember each Blob, so fetch() can hand it back and <img> can show it
    // as a data: URL instead.
    let localBlobs = {};
    let localData = {};
    let realCreate = win.URL.createObjectURL.bind(win.URL);
    win.URL.createObjectURL = function (obj) {
      let u = realCreate(obj);
      if (obj instanceof win.Blob) localBlobs[u] = obj;
      return u;
    };
    function dataUrlFor(u) {
      if (!localData[u]) {
        localData[u] = new Promise(function (done) {
          let reader = new FileReader();
          reader.onload = function () { done(String(reader.result)); };
          reader.onerror = function () { done(null); };
          reader.readAsDataURL(localBlobs[u]);
        });
      }
      return localData[u];
    }

    let realFetch = win.fetch.bind(win);
    win.fetch = function (input, init) {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.indexOf(GEOCODER) === 0) return Promise.resolve(geocode(url));
      if (url.indexOf('blob:') === 0 && localBlobs[url]) return Promise.resolve(new Response(localBlobs[url]));
      if (url.indexOf(BASE) !== 0) return realFetch(input, init);
      init = init || {};
      let headers = {};
      let h = new Headers(init.headers || (typeof input === 'object' && input.headers) || {});
      h.forEach(function (v, k) { headers[k.toLowerCase()] = v; });
      let method = init.method || (typeof input === 'object' && input.method) || 'GET';
      let raw = init.body;
      let isText = typeof raw === 'string' || raw == null;
      let delay = 90 + Math.random() * 160; // a phone on 4G, so loading states show
      // Uploaded photos are kept as data: URLs, so they survive a reload and
      // need no image host.
      let bytes = isText ? Promise.resolve(undefined) : new Promise(function (done) {
        let blob = raw instanceof Blob ? raw : new Blob([raw], { type: headers['content-type'] || 'image/jpeg' });
        let reader = new FileReader();
        reader.onload = function () { done(String(reader.result)); };
        reader.onerror = function () { done(null); };
        reader.readAsDataURL(blob);
      });
      return bytes.then(function (dataUrl) { return new Promise(function (resolve) {
        setTimeout(function () {
          let res = backend.handle({ url: url, method: method, headers: headers, body: isText ? raw : null, rawBody: dataUrl });
          let outHeaders = Object.assign({ 'content-type': 'application/json' }, res.headers || {});
          let text = res.body == null ? null : JSON.stringify(res.body);
          resolve(new Response(res.status === 204 ? null : text, { status: res.status, headers: outHeaders }));
        }, delay);
      }); });
    };

    // The listing form looks up streets and city centres on OpenStreetMap's
    // geocoder, which the page may not call: answer from the demo city
    // centres, offering what was typed as the street.
    function geocode(url) {
      let q = new URL(url).searchParams;
      let geo = win.SIM_SEED.geo || {};
      let city = q.get('city') || '';
      let key = Object.keys(geo).filter(function (c) { return fold(c).slice(0, 5) === fold(city).slice(0, 5); })[0] || 'Tiranë';
      let c = geo[key];
      let street = (q.get('street') || '').trim();
      let rows = street
        ? [{ category: 'highway', type: 'residential', name: street.replace(/^./, function (ch) { return ch.toUpperCase(); }), lat: String(c[0] + 0.004), lon: String(c[1] - 0.003), address: { road: street.replace(/^./, function (ch) { return ch.toUpperCase(); }), city: key } }]
        : [{ category: 'boundary', type: 'administrative', name: key, display_name: key + ', Shqipëri', lat: String(c[0]), lon: String(c[1]) }];
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    // Realtime: a socket that never connects, so the app stays quiet and
    // falls back to what it reads.
    let RealWS = win.WebSocket;
    function QuietSocket(url) {
      this.url = url; this.readyState = 0; this.protocol = ''; this.extensions = ''; this.bufferedAmount = 0; this.binaryType = 'blob';
    }
    QuietSocket.prototype.send = function () {};
    QuietSocket.prototype.close = function () { this.readyState = 3; };
    QuietSocket.prototype.addEventListener = function () {};
    QuietSocket.prototype.removeEventListener = function () {};
    QuietSocket.CONNECTING = 0; QuietSocket.OPEN = 1; QuietSocket.CLOSING = 2; QuietSocket.CLOSED = 3;
    win.WebSocket = function (url, protocols) {
      return String(url).indexOf(HOST) >= 0 ? new QuietSocket(url) : new RealWS(url, protocols);
    };
    win.WebSocket.CONNECTING = 0; win.WebSocket.OPEN = 1; win.WebSocket.CLOSING = 2; win.WebSocket.CLOSED = 3;

    // Images: uploaded photos live in memory; map tiles are drawn as plain
    // paper (the page may not load images from other sites).
    function mapSrc(src) {
      src = String(src);
      if (src.indexOf(BASE + '/storage/v1/object/public/') === 0) {
        let data = backend.blobFor(src);
        return typeof data === 'string' && data.indexOf('data:') === 0 ? data : '/sim/photos/placeholder.svg';
      }
      if (/tile\.openstreetmap\.org|basemaps\.cartocdn\.com|tile\.osm/.test(src)) return '/sim/tile.svg';
      return src;
    }
    let desc = Object.getOwnPropertyDescriptor(win.HTMLImageElement.prototype, 'src');
    function setImg(img, v, set) {
      v = String(v);
      img.__simSrc = v;
      if (v.indexOf('blob:') === 0 && localBlobs[v]) {
        dataUrlFor(v).then(function (d) { if (img.__simSrc === v) set(d || v); });
        return;
      }
      set(mapSrc(v));
    }
    Object.defineProperty(win.HTMLImageElement.prototype, 'src', {
      configurable: true, enumerable: desc.enumerable,
      get: function () { return desc.get.call(this); },
      set: function (v) { let img = this; setImg(img, v, function (x) { desc.set.call(img, x); }); },
    });
    let setAttr = win.Element.prototype.setAttribute;
    win.Element.prototype.setAttribute = function (name, value) {
      if (this instanceof win.HTMLImageElement && String(name).toLowerCase() === 'src') {
        let img = this;
        setImg(img, value, function (x) { setAttr.call(img, 'src', x); });
        return undefined;
      }
      return setAttr.call(this, name, value);
    };

    // Google, Apple and LinkedIn would leave the page for a sign-in site: say so instead.
    let blocked = /^(google|apple|linkedin|microsoft)$/i;
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown'].forEach(function (type) {
      win.document.addEventListener(type, function (e) {
        if (type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        let el = e.target && e.target.closest ? e.target.closest('[role="button"],button') : null;
        if (!el || !blocked.test((el.textContent || el.getAttribute('aria-label') || '').trim())) return;
        e.preventDefault();
        e.stopPropagation();
        if (type === 'click' || type === 'keydown') toast('Në simulator hyni me email: agjent@demo.al ose klient@demo.al, fjalëkalimi demo1234.');
      }, true);
    });

    let toastEl = null;
    function toast(text) {
      if (!toastEl) {
        toastEl = win.document.createElement('div');
        toastEl.className = 'sim-toast';
        toastEl.setAttribute('role', 'status');
        win.document.body.appendChild(toastEl);
      }
      toastEl.textContent = text;
      toastEl.hidden = false;
      clearTimeout(toastEl._t);
      toastEl._t = setTimeout(function () { toastEl.hidden = true; }, 4200);
    }

    // The simulator's own small panel: who you are, one-tap demo accounts,
    // and a reset. It is not part of the app.
    function signInAs(email) {
      let s = backend.session(email);
      try { if (store) store.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* ignore */ }
      win.location.reload();
    }
    function signOut() {
      try { if (store) store.removeItem(SESSION_KEY); } catch { /* ignore */ }
      win.location.reload();
    }
    function currentEmail() {
      try { let s = store && JSON.parse(store.getItem(SESSION_KEY) || 'null'); return s && s.user ? s.user.email : null; } catch { return null; }
    }
    function panel() {
      let d = win.document;
      let wrap = d.createElement('div');
      wrap.className = 'sim-ui';
      let who = currentEmail();
      wrap.innerHTML =
        '<button type="button" class="sim-pill" aria-expanded="false" aria-controls="sim-panel">Simulator</button>' +
        '<div class="sim-panel" id="sim-panel" hidden>' +
        '<p class="sim-title">Shtëpia.ime · simulator</p>' +
        '<p class="sim-text">Të dhëna demo, vetëm në këtë shfletues. Asgjë nuk shkon në aplikacionin e vërtetë.</p>' +
        '<p class="sim-who">' + (who ? 'Je i kyçur si <b></b>' : 'Nuk je i kyçur') + '</p>' +
        '<div class="sim-row"><button type="button" data-sim="agent">Hyr si agjent</button><button type="button" data-sim="client">Hyr si klient</button></div>' +
        '<div class="sim-row">' + (who ? '<button type="button" data-sim="out">Dil</button>' : '') + '<button type="button" data-sim="reset">Rivendos të dhënat</button></div>' +
        '<p class="sim-small">Llogaritë: agjent@demo.al · klient@demo.al, fjalëkalimi <b>demo1234</b>. Kodi nga emaili: <b>' + OTP + '</b>.</p>' +
        '</div>';
      if (who) wrap.querySelector('.sim-who b').textContent = who;
      d.body.appendChild(wrap);
      let pill = wrap.querySelector('.sim-pill');
      let box = wrap.querySelector('.sim-panel');
      pill.addEventListener('click', function () { box.hidden = !box.hidden; pill.setAttribute('aria-expanded', String(!box.hidden)); });
      wrap.addEventListener('click', function (e) {
        let b = e.target.closest('[data-sim]');
        if (!b) return;
        let what = b.getAttribute('data-sim');
        if (what === 'agent') signInAs('agjent@demo.al');
        if (what === 'client') signInAs('klient@demo.al');
        if (what === 'out') signOut();
        if (what === 'reset') { backend.reset(); signOut(); }
      });
    }
    if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', panel);
    else panel();
  }

  root.SimulatorBackend = { createBackend: createBackend, splitTop: splitTop, parseSelect: parseSelect, demoTranslate: demoTranslate, HOST: HOST, SESSION_KEY: SESSION_KEY };
  if (root.document && root.SIM_SEED && !root.__SIM_NO_INSTALL__) install(root);
})(typeof globalThis !== 'undefined' ? globalThis : this);
