// Máy chủ nhỏ cho "Nuôi chung" của game Con nhà mình, chạy bằng Netlify Functions + Netlify Blobs.
// Không cần tài khoản: ai có mã phòng (8 ký tự) thì vào được ghế còn trống.
// Các đường dẫn khớp với phần client trong index.html:
//   GET  /api/health
//   POST /api/room                    tạo phòng  -> { id, token }
//   GET  /api/room/:id[?wait=ver]     đọc phòng (có wait thì chờ tới khi ván đổi)
//   PUT  /api/room/:id                ghi ván { ver, state }
//   POST /api/room/:id/join           vào ghế b -> { token, mode }
//   POST /api/room/:id/pick           gửi lựa chọn kín (cùng vuốt) { v }
//   POST /api/room/:id/reseat         chủ phòng mời người khác thay ghế b khi người kia im > 2 ngày

export const config = { path: ['/api/health', '/api/room', '/api/room/*'] };

const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';      // bỏ i, l, o cho đỡ nhầm; khớp /^[a-z2-9]{8}$/ của client
const MAX_BYTES = 300_000;                            // ván lớn hơn thì báo too_big
const TTL = 30 * 24 * 3600e3;                         // phòng sống 30 ngày kể từ lần ghi cuối
const IDLE = 48 * 3600e3;                             // im hơn 2 ngày mới cho mời người khác thay
const SEEN_EVERY = 5 * 60e3;                          // ghi "lần cuối online" tối đa 5 phút một lần
const MODES = new Set(['ca', 'cung', 'con']);
const ID_RE = /^[a-z2-9]{8}$/;

const json = (o, status = 200) => new Response(JSON.stringify(o), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const fail = (code, status, extra) => json({ error: code, ...(extra || {}) }, status);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), x => ALPHA[x % ALPHA.length]).join('');
const tok = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('');
const key = id => 'room/' + id;

// chống bấm tạo phòng dồn dập (chỉ trong bộ nhớ của một máy chủ, đủ để cản spam đơn giản)
const hits = new Map();
function limited(ip, max, windowMs) {
  const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < windowMs);
  a.push(now); hits.set(ip, a);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  return a.length > max;
}

async function load(store, id) {
  const e = await store.getWithMetadata(key(id), { type: 'json' });
  if (!e || !e.data) return null;
  if (Date.now() - (e.data.updated || 0) > TTL) { await store.delete(key(id)); return null; }
  return e;
}
// đọc – sửa – ghi có kiểm tra phiên bản (etag); đụng nhau thì đọc lại và làm lại
async function mutate(store, id, fn) {
  for (let i = 0; i < 6; i++) {
    const e = await load(store, id);
    if (!e) return { gone: true };
    const room = e.data, out = fn(room);
    if (!out || out.skip) return out || {};
    const w = await store.setJSON(key(id), room, { onlyIfMatch: e.etag });
    if (w && w.modified === false) { await sleep(40 + Math.random() * 60); continue; }
    return out;
  }
  return { busy: true };
}
const seatOf = (room, t) => t && t === room.tokens.a ? 'a' : t && room.tokens.b && t === room.tokens.b ? 'b' : null;
const view = (room, seat) => ({ mode: room.mode, state: room.state, ver: room.ver, open: !room.tokens.b, seat, seen: room.seen });
async function body(req) {
  const text = await req.text();
  if (text.length > MAX_BYTES) return { tooBig: true };
  try { return { data: JSON.parse(text || '{}') }; } catch (e) { return { bad: true }; }
}
const okState = s => s && typeof s === 'object' && !Array.isArray(s) && s.run && typeof s.run === 'object';

export async function handle(req, store, opt = {}) {
  const waitMs = opt.waitMs ?? 7000, stepMs = opt.stepMs ?? 500;
  const url = new URL(req.url), m = req.method;
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'health') return json({ ok: true, rooms: true, accounts: false });
  if (parts[0] !== 'room') return fail('not_found', 404);
  const t = req.headers.get('x-seat') || '';

  // ---- tạo phòng ----
  if (parts.length === 1) {
    if (m !== 'POST') return fail('bad_method', 405);
    const ip = (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'x').split(',')[0].trim();
    if (limited(ip, 20, 3600e3)) return fail('rate_limited', 429);
    const b = await body(req);
    if (b.tooBig) return fail('too_big', 413);
    if (b.bad || !b.data) return fail('bad_request', 400);
    const { mode, state, meta } = b.data;
    if (!MODES.has(mode) || !okState(state)) return fail('bad_request', 400);
    const now = Date.now(), token = tok();
    for (let i = 0; i < 5; i++) {
      const id = rid();
      const room = { id, mode, state, ver: 1, tokens: { a: token, b: null }, seen: { a: now, b: 0 }, meta: meta && typeof meta === 'object' ? meta : {}, created: now, updated: now };
      const w = await store.setJSON(key(id), room, { onlyIfNew: true });
      if (w && w.modified === false) continue;
      return json({ id, token });
    }
    return fail('server', 500);
  }

  const id = parts[1];
  if (!ID_RE.test(id)) return fail('no_room', 404);
  const sub = parts[2];

  // ---- đọc phòng (có thể chờ) ----
  if (!sub && m === 'GET') {
    const wait = url.searchParams.get('wait');
    const t0 = Date.now();
    let first = true;
    for (;;) {
      const e = await load(store, id);
      if (!e) return fail('no_room', 404);
      const room = e.data, seat = seatOf(room, t);
      if (first && seat && Date.now() - (room.seen[seat] || 0) > SEEN_EVERY) {
        await mutate(store, id, r => { r.seen[seat] = Date.now(); return { ok: true }; });
        room.seen[seat] = Date.now();
      }
      first = false;
      if (wait === null || Number(wait) !== room.ver || Date.now() - t0 >= waitMs) return json(view(room, seat));
      await sleep(stepMs);
    }
  }

  // ---- ghi ván ----
  if (!sub && m === 'PUT') {
    const b = await body(req);
    if (b.tooBig) return fail('too_big', 413);
    if (b.bad || !b.data || !okState(b.data.state)) return fail('bad_request', 400);
    let stale = null, denied = false;
    const r = await mutate(store, id, room => {
      if (!seatOf(room, t)) { denied = true; return { skip: true }; }
      if (b.data.ver !== room.ver) { stale = { state: room.state, ver: room.ver }; return { skip: true }; }
      const seat = seatOf(room, t);
      room.state = b.data.state; room.ver++; room.updated = Date.now(); room.seen[seat] = Date.now();
      return { ver: room.ver };
    });
    if (r.gone) return fail('no_room', 404);
    if (denied) return fail('forbidden', 403);
    if (stale) return fail('stale', 409, stale);
    if (r.busy) return fail('server', 503);
    return json({ ver: r.ver });
  }

  if (m !== 'POST') return fail('bad_method', 405);

  // ---- vào ghế b ----
  if (sub === 'join') {
    let res = null, full = false;
    const r = await mutate(store, id, room => {
      if (room.tokens.b) { full = true; return { skip: true }; }
      room.tokens.b = tok(); room.ver++; room.updated = Date.now(); room.seen.b = Date.now();
      res = { token: room.tokens.b, mode: room.mode };
      return { ok: true };
    });
    if (r.gone) return fail('no_room', 404);
    if (full) return fail('full', 409);
    if (r.busy) return fail('server', 503);
    return json(res);
  }

  // ---- gửi lựa chọn kín (cùng vuốt) ----
  if (sub === 'pick') {
    const b = await body(req);
    if (b.tooBig) return fail('too_big', 413);
    if (b.bad || !b.data || b.data.v === undefined || JSON.stringify(b.data.v).length > 4000) return fail('bad_request', 400);
    let denied = false;
    const r = await mutate(store, id, room => {
      const seat = seatOf(room, t);
      if (!seat) { denied = true; return { skip: true }; }
      const pk = room.state.pk && typeof room.state.pk === 'object' ? room.state.pk : {};
      pk[seat] = b.data.v; room.state.pk = pk;
      room.ver++; room.updated = Date.now(); room.seen[seat] = Date.now();
      return { ver: room.ver };
    });
    if (r.gone) return fail('no_room', 404);
    if (denied) return fail('forbidden', 403);
    if (r.busy) return fail('server', 503);
    return json({ ver: r.ver });
  }

  // ---- mời người khác thay ghế b ----
  if (sub === 'reseat') {
    let denied = false, notIdle = false;
    const r = await mutate(store, id, room => {
      if (seatOf(room, t) !== 'a') { denied = true; return { skip: true }; }
      if (!room.tokens.b) return { skip: true, ok: true };
      if (Date.now() - (room.seen.b || room.created) <= IDLE) { notIdle = true; return { skip: true }; }
      room.tokens.b = null; room.ver++; room.updated = Date.now();
      return { ok: true };
    });
    if (r.gone) return fail('no_room', 404);
    if (denied) return fail('forbidden', 403);
    if (notIdle) return fail('not_idle', 409);
    if (r.busy) return fail('server', 503);
    return json({ ok: true });
  }

  return fail('not_found', 404);
}

export default async function (req) {
  try {
    const { getStore } = await import('@netlify/blobs');
    return await handle(req, getStore({ name: 'rooms', consistency: 'strong' }));
  } catch (e) {
    console.error(e);
    return fail('server', 500);
  }
}
