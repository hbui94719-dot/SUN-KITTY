// Con nhà mình — luật chơi (không đụng tới giao diện). Dùng chung cho index.html và tools/sim_web.js.
(function(){
const LD = window.LD;
const E = LD.engine = {};
const METERS = ['vui','pin','than'];

E.PULL = 0.2;          // sang giai đoạn mới, mỗi thanh nhích về 50 một phần (con lớn, mọi thứ dịu lại)
E.CHAIN_MAX = 2;       // tối đa số thẻ nối tiếp trong một giai đoạn
E.FAM_MAX = 1;         // tối đa số thẻ riêng của gia cảnh trong một giai đoạn
E.SIGN_MAX = 1;        // tối đa số thẻ riêng của cung trong một giai đoạn
E.SIGN_BONUS = 5;      // cung thích / ghét kiểu phụ huynh: con vui thêm / bớt
E.DUEL_STAGES = [2, 3, 4]; // đấu khẩu ngày Tết rơi vào một trong các giai đoạn này
E.DUEL_ROUNDS = 3;
E.DUEL_SECONDS = 7.5;   // thời gian đáp mỗi câu (owner 04/10/2026: chậm hơn 1,5 s)
E.JOB_MIN = 4;         // 18 tuổi: năng khiếu mạnh nhất từ mức này mới thành nghề, thấp hơn thì con đi gap year
E.TRUMP_OVER = 2;      // đấu khẩu: năng khiếu mạnh nhất từ (giai đoạn + mức này) thì có một vòng "đưa bằng chứng" (6–10 tuổi: 4, cấp 2: 5, cấp 3: 6)
E.RIVAL_MAX = 1;       // số thẻ "con nhà người ta" mỗi giai đoạn
E.HEIR_MAX = 3;        // đời sau mang theo tối đa chừng này nét gia truyền (các đời gần nhất), cộng dồn
E.LIXI_PUSH = [3, 4];  // lì xì kéo co: bác dúi từ 3 tới 4 lần, lần cuối bác dọa giận
E.LIXI_SECONDS = 4;    // thời gian phản ứng mỗi lần bác dúi
E.LIXI_EFFECT = { chuan: [5, 3, 3], vo: [3, -5, 0], cat: [-5, 0, -3] };
E.FAM_END_MIN = 4;     // kết riêng của gia cảnh: chọn đủ chừng này lựa chọn "chất nhà mình" (fs) trên thẻ của nhà (mỗi ván gặp 5 thẻ)
E.EVENT_P = 0.25;      // biến cố gia đình: xác suất xảy ra ở đầu mỗi giai đoạn 1–4 (khi không có biến cố tạm nào đang diễn ra)
E.EVENT_MAX = 2;       // tối đa số biến cố mỗi ván
// Nuôi chung (owner 05/10/2026): 'ca' = chia ca (lần lượt, không cần online cùng lúc), 'cung' = cùng vuốt (cùng lúc), 'con' = một người làm con
E.DUO_N = 1.7;         // chia ca: mỗi giai đoạn nhiều thẻ hơn chơi một mình, hai người chia nhau, nên ván dài hơn
E.DUO_VUI = { ca: 0.65, cung: 0.7 };   // chơi chung: Con vui là thanh chung của cả hai, ván dài hơn, nên mỗi lựa chọn đổi Con vui ít hơn
E.DUO_AGREE = 2;       // quyết định lớn: hai người chọn giống nhau thì Con vui thêm
E.DUO_LOSE = 5;        // quyết định lớn: khác ý thì người thua cãi bị trừ Pin (tức)
E.CUNG_AGREE = 0;      // cùng vuốt: mỗi thẻ hai người chọn giống nhau thì Con vui thêm (để 0: độ hợp nhau chỉ để khoe)
E.CUNG_LOSE = 1;       // cùng vuốt: mỗi thẻ khác ý thì người thua cãi bị trừ Pin
E.NHO_PIN = 3;         // chia ca: "nhờ" người kia làm thay một thẻ thì mình được nghỉ chút Pin
E.rand = Math.random;

E.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(E.rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const roundSym = x => Math.sign(x) * Math.round(Math.abs(x));

// Mã ổn định của thẻ (để đếm "đã gặp"): băm giai đoạn + câu tình huống.
E.cardId = c => { let h = 5381; const s = c.s + '|' + c.t; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

// ---- Cung hoàng đạo ----
E.signById = id => LD.SIGNS.find(x => x.id === id) || null;
E.sign = st => E.signById(st.sign);
// Ngày sinh ngẫu nhiên trong khoảng của cung (dd/mm)
E.birthday = id => {
  const g = E.signById(id), y = 2026;
  const a = new Date(y, g.from[1] - 1, g.from[0]), b = new Date(g.to[1] < g.from[1] ? y + 1 : y, g.to[1] - 1, g.to[0]);
  const d = new Date(a.getTime() + Math.floor(E.rand() * ((b - a) / 864e5 + 1)) * 864e5);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
};
E.randomSign = () => LD.SIGNS[Math.floor(E.rand() * LD.SIGNS.length)].id;

// ---- Năng khiếu (LD.SKILLS) ----
E.skillById = id => (LD.SKILLS || []).find(x => x.id === id) || null;
E.kList = k => [].concat(k || []).filter(id => E.skillById(id));
// +1 cho mỗi năng khiếu; kt nhớ thứ tự lần nuôi gần nhất (để phân thắng thua khi bằng điểm)
E.addSkill = (st, k) => E.kList(k).forEach(id => { st.k[id] = (st.k[id] || 0) + 1; st.kt[id] = ++st.kseq; });
// năng khiếu mạnh nhất { id, n }; bằng nhau thì cái được nuôi gần nhất; chưa có gì thì null
E.topSkill = st => {
  let b = null;
  for (const s of LD.SKILLS || []) {
    const n = (st.k && st.k[s.id]) || 0, t = (st.kt && st.kt[s.id]) || 0;
    if (n > 0 && (!b || n > b.n || (n === b.n && t > b.t))) b = { id: s.id, n, t };
  }
  return b && { id: b.id, n: b.n };
};

// ---- Gia cảnh (LD.FAMS) và biến cố gia đình (LD.EVENTS) ----
E.famById = id => (LD.FAMS || []).find(f => f.id === id) || null;
E.eventById = id => (LD.EVENTS || []).find(e => e.id === id) || null;
// thẻ thuộc gia cảnh / biến cố nào: 'taphoa', 'ev:embe' hoặc null
const famOf = c => { const n = [].concat(c.need || []).find(x => x.startsWith('fam:') || x.startsWith('ev:')); return n ? (n.startsWith('fam:') ? n.slice(4) : n) : null; };
E.famOf = famOf;
// thẻ của gia cảnh / biến cố này có đang được rút không: gia cảnh gốc, biến cố tạm đang diễn ra, biến cố đã thành lâu dài
E.famOn = (st, id) => st.fam.id === id || (!!st.ov && st.ov.pool === id) || (st.perm || []).includes(id);
// năng khiếu nhà hay nuôi: đếm từ thẻ riêng của nhà, lấy 2 cái nhiều nhất
E.famLean = id => {
  const n = {};
  LD.CARDS.forEach(c => { if (famOf(c) === id) [c.L, c.R].forEach(o => E.kList(o.k).forEach(k => { n[k] = (n[k] || 0) + 1; })); });
  return Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, 2);
};
// luật riêng của gia cảnh trên một lựa chọn: nhân phần trừ / phần cộng, cộng theo kiểu phụ huynh, so sánh đau gấp đôi
E.famDelta = (st, o, d) => {
  const f = st.fam;
  d = d.map((v, k) => v < 0 ? roundSym(v * (f.neg ? f.neg[k] : 1)) : roundSym(v * (f.pos ? f.pos[k] : 1)));
  if (f.tag && o.tag && f.tag[o.tag]) d = d.map((v, k) => v + f.tag[o.tag][k]);
  if (f.cmpx && o.cmp && d[0] < 0) d[0] = Math.round(d[0] * f.cmpx);
  return d;
};
// áp một phép biến đổi 3 thanh cho mọi người lớn trong nhà: chơi một mình chỉ có st.m; chơi chung thì st.m là người
// đang chơi, người kia giữ [pin, thân] riêng (Con vui dùng chung nên chỉ đổi một lần)
const allM = (st, fn) => {
  st.m = fn(st.m);
  const d = st.duo;
  if (d && d.seats && d.mode !== 'con') { const o = d.seats[d.cur === 'a' ? 'b' : 'a'], r = fn([st.m[0], o.m[0], o.m[1]]); o.m = [r[1], r[2]]; }
};
E.allM = allM;
// cộng vào 3 thanh lúc sang giai đoạn: không bao giờ tự làm ván kết thúc
const nudge = (st, d) => { if (d) allM(st, m => m.map((v, k) => clamp(v + (d[k] || 0), 3, 97))); };
const evOk = (e, st, si) => e.at.includes(si) && (!e.from || e.from.includes(st.fam.id)) && !(e.not || []).includes(st.fam.id)
  && (!e.two || st.fam.two) && !(e.solo && st.duo) && !st.evs.includes(e.id) && !(e.change && st.fam.id === e.change);
E.rollEvent = (st, si) => {
  if (st.ov || st.evs.length >= E.EVENT_MAX || E.rand() >= E.EVENT_P) return null;
  // tổng độ hay gặp dưới 1 (chỉ còn biến cố hiếm hợp lệ) thì phần còn lại là không có gì xảy ra
  const list = (LD.EVENTS || []).filter(e => evOk(e, st, si)), w = e => e.w == null ? 1 : e.w;
  let r = E.rand() * Math.max(1, list.reduce((a, e) => a + w(e), 0));
  for (const e of list) { r -= w(e); if (r < 0) return e; }
  return null;
};
// biến cố xảy ra: đổi đời thì đổi hẳn gia cảnh gốc; dur từ 9 trở lên là lâu dài (em bé ở luôn); còn lại là biến cố tạm
E.applyEvent = (st, e, si) => {
  st.evs.push(e.id); nudge(st, e.d);
  if (e.change) st.fam = E.famById(e.change) || st.fam;
  else if (e.dur >= 9) st.perm.push(e.pool);
  else st.ov = { id: e.id, pool: e.pool, until: si + e.dur - 1, solo: e.solo ? 1 : 0 };
};

// ---- Gia truyền: đời sau mang theo nét của tối đa E.HEIR_MAX đời gần nhất (mới nhất trước), cộng dồn ----
E.heirs = gen => (gen && Array.isArray(gen.traits) ? gen.traits : gen && gen.trait ? [gen.trait] : [])
  .filter(id => LD.TRAITS[id]).slice(0, E.HEIR_MAX);
E.heirBonus = gen => {
  const s = [0, 0, 0];
  E.heirs(gen).forEach(id => LD.TRAITS[id][1].forEach((v, k) => { s[k] += v; }));
  return s.map(v => clamp(v, -10, 15));
};
// con nhà người ta: tên ngẫu nhiên, không trùng tên con
E.rivalName = name => {
  const pool = (LD.RIVALS || []).filter(r => r.toLowerCase() !== String(name || '').toLowerCase());
  return pool.length ? pool[Math.floor(E.rand() * pool.length)] : 'Bông';
};

// gen = { n: đời thứ mấy, parent: tên phụ huynh (con của ván trước), parentSign, trait: id cái kết ván trước,
//         traits: các nét gia truyền (id cái kết các đời trước, mới nhất trước), job: nghề của phụ huynh }
// sign = id cung của con (LD.SIGNS); lucky = gia cảnh do bốc thăm
E.newRun = (fam, role, name, style, gen, sign, lucky) => {
  gen = gen || { n: 1 };
  const add = E.heirBonus(gen);
  const m = fam.m.map((v, k) => clamp(v + add[k], 5, 95));
  const st = {
    fam, role, name, style, gen, m, tags: {}, flags: {}, used: new Set(), offered: {}, log: [], deck: [], i: 0, stage: -1,
    sign: sign || E.randomSign(), lastReact: null, lastD: [0, 0, 0], whoStage: {},
    minM: m.slice(), moods: new Set(), npcAt: {}, whos: new Set(), seen: new Set(), lastAge: 0,
    duelStage: E.DUEL_STAGES[Math.floor(E.rand() * E.DUEL_STAGES.length)], duel: null,
    k: {}, kt: {}, kseq: 0, lastK: [], cmp: 0, rival: E.rivalName(name), lixi: null, lixiRes: null,
    // gia cảnh lúc chọn (fam có thể đổi khi gặp biến cố đổi đời), số lựa chọn "chất nhà mình" theo từng nhà, biến cố
    famStart: fam.id, fsBy: {}, ov: null, perm: [], evs: [], lucky: lucky ? 1 : 0, note: null
  };
  // năng khiếu bẩm sinh: theo cung, và theo nghề của phụ huynh (con nhà nòi)
  const g = E.sign(st);
  if (g && g.k) E.addSkill(st, g.k);
  if (gen.job && LD.JOBS && LD.JOBS[gen.job] && LD.JOBS[gen.job].k) E.addSkill(st, LD.JOBS[gen.job].k);
  return st;
};

E.ok = (c, st) => {
  const needs = c.need ? [].concat(c.need) : [];
  for (const n of needs) {
    if (n === 'two' && !(st.fam.two && !(st.ov && st.ov.solo))) return false;
    if (n === 'duo' && !(st.duo && st.duo.mode !== 'con')) return false;
    if (n === 'bo' && !(st.fam.two || st.role === 'bố')) return false;
    if (n.startsWith('fam:') && !E.famOn(st, n.slice(4))) return false;
    if (n.startsWith('ev:') && !E.famOn(st, n)) return false;
    if (n.startsWith('role:') && st.role !== n.slice(5)) return false;
    if (n.startsWith('cung:') && st.sign !== n.slice(5)) return false;
  }
  if (c.nreq && st.flags[c.nreq]) return false;
  if (c.cmin != null && (st.cmp || 0) < c.cmin) return false;
  if (c.cmax != null && (st.cmp || 0) > c.cmax) return false;
  return !c.req || !!st.flags[c.req];
};

const isSign = c => [].concat(c.need || []).some(n => n.startsWith('cung:'));
const isRival = c => !!c.rv;

// Rút thẻ cho giai đoạn si: thẻ nối tiếp trước, rồi một thẻ con nhà người ta, một thẻ của gia cảnh gốc, một thẻ của biến cố
// (nếu đang có), một thẻ của cung, rồi thẻ chung. Thẻ cùng nhóm grp (na ná nhau) chỉ gặp một lần mỗi ván.
// Tuổi chia đều theo thứ tự ngẫu nhiên, rồi xếp theo tuổi và ord.
// Trước khi rút: thanh nhích về giữa, biến cố tạm hết hạn thì về như cũ, luật trôi của gia cảnh, có thể xảy ra biến cố mới.
// st.note ghi lại những chuyện đó để màn chào giai đoạn kể cho người chơi.
// chuẩn bị giai đoạn si: thanh nhích về giữa, biến cố hết hạn, luật trôi của gia cảnh, biến cố mới
E.stagePrep = (st, si) => {
  const note = { drift: null, back: null, ev: null };
  if (si > 0) allM(st, m => m.map(v => Math.round(v + (50 - v) * E.PULL)));
  if (st.ov && si > st.ov.until) { const e = E.eventById(st.ov.id); note.back = st.ov.id; st.ov = null; if (e) nudge(st, e.backD); }
  if (si > 0 && st.fam.drift && si >= (st.fam.dfrom || 1)) {
    // chơi chung: gia cảnh có duoDrift thì mỗi người trôi một kiểu (người đi làm xa / người ở nhà)
    if (st.duo && st.fam.duoDrift && st.duo.mode !== 'con') { E.duoUse(st, 'a'); E.duoNudge(st, st.fam.duoDrift); }
    else nudge(st, st.fam.drift);
    note.drift = st.fam.drift; note.df = st.fam.id;
  }
  if (si >= 1 && si <= 4) { const e = E.rollEvent(st, si); if (e) { E.applyEvent(st, e, si); note.ev = e.id; } }
  st.note = note.drift || note.back || note.ev ? note : null;
};
// thẻ ứng viên của giai đoạn si, xếp theo ưu tiên (đã lọc trùng nhóm grp với thẻ đã gặp)
const isDuo = c => [].concat(c.need || []).includes('duo');
E.stageCand = (st, si) => {
  const grps = new Set([...st.used].map(c => c.grp).filter(Boolean));
  const pool = LD.CARDS.filter(c => c.s === si && !st.used.has(c) && E.ok(c, st) && !(c.grp && grps.has(c.grp)));
  const open = c => !c.req && !isRival(c) && !isDuo(c);
  return [
    ...E.shuffle(pool.filter(c => c.req)).slice(0, E.CHAIN_MAX),
    ...E.shuffle(pool.filter(c => !c.req && isRival(c))).slice(0, E.RIVAL_MAX),
    ...E.shuffle(pool.filter(c => open(c) && famOf(c) === st.fam.id)).slice(0, E.FAM_MAX),
    ...E.shuffle(pool.filter(c => open(c) && famOf(c) && famOf(c) !== st.fam.id)).slice(0, 1),
    ...E.shuffle(pool.filter(c => !c.req && isDuo(c))).slice(0, 1),
    ...E.shuffle(pool.filter(c => open(c) && !famOf(c) && isSign(c))).slice(0, E.SIGN_MAX),
    ...E.shuffle(pool.filter(c => open(c) && !famOf(c) && !isSign(c)))
  ];
};
// lấy n thẻ đầu, bỏ thẻ trùng nhóm
const takeN = (cand, n) => {
  const pick = [];
  for (const c of cand) {
    if (pick.length >= n) break;
    if (c.grp && pick.some(x => x.grp === c.grp)) continue;
    if (!pick.includes(c)) pick.push(c);
  }
  return pick;
};
E.stageN = (st, si) => Math.round(LD.STAGES[si].n * (st.duo && st.duo.mode === 'ca' ? E.DUO_N : 1));
E.startStage = (st, si) => {
  E.stagePrep(st, si);
  E.stageDeck(st, si, takeN(E.stageCand(st, si), E.stageN(st, si)));
};
// chốt bộ thẻ của giai đoạn: chia tuổi đều theo thứ tự ngẫu nhiên, xếp theo tuổi và ord, chèn đấu khẩu ngày Tết
E.stageDeck = (st, si, pick) => {
  const S = LD.STAGES[si];
  const free = E.shuffle(pick.filter(c => c.age == null)), span = S.a[1] - S.a[0] + 1;
  st.deck = pick.map(c => ({ c, age: c.age != null ? c.age : S.a[0] + Math.floor(free.indexOf(c) * span / free.length) }))
    .sort((x, y) => x.age - y.age || (x.c.ord || 0) - (y.c.ord || 0));
  pick.forEach(c => st.used.add(c));
  if (si === st.duelStage && st.deck.length >= 2 && LD.DUELS) {
    const pos = 1 + Math.floor(E.rand() * (st.deck.length - 1));
    st.deck.splice(pos, 0, { duel: true, age: st.deck[pos - 1].age });
  }
  st.i = 0; st.stage = si;
};

E.current = st => st.deck[st.i];

E.track = st => {
  st.m.forEach((v, k) => { if (v < st.minM[k]) st.minM[k] = v; });
};

E.choose = (st, side) => {
  const { c, age, av } = st.deck[st.i], o = c[side], g = E.sign(st);
  // cung của con: độ nhạy từng thanh; luật riêng của gia cảnh; cộng/trừ vui khi gặp kiểu phụ huynh con thích/ghét
  const d = E.famDelta(st, o, o.d.map((v, k) => roundSym(v * (g ? g.amp[k] : 1))));
  if (av) d[0] *= 2;   // con ăn vạ: Con vui lên xuống gấp đôi
  if (st.duo && E.DUO_VUI[st.duo.mode]) d[0] = roundSym(d[0] * E.DUO_VUI[st.duo.mode]);
  st.lastReact = null;
  if (g && o.tag === g.like) { d[0] += E.SIGN_BONUS; st.lastReact = 'like'; }
  else if (g && o.tag === g.dislike) { d[0] -= E.SIGN_BONUS; st.lastReact = 'dislike'; }
  st.lastD = d;
  st.m = st.m.map((v, k) => clamp(v + d[k]));
  if (o.tag) st.tags[o.tag] = (st.tags[o.tag] || 0) + 1;
  new Set([c.L.tag, c.R.tag]).forEach(t => { if (t) st.offered[t] = (st.offered[t] || 0) + 1; });
  const ds = st.duo && st.duo.mode !== 'con' && st.duo.seats[st.duo.cur];   // chơi chung: kiểu phụ huynh của từng người
  if (ds) {
    if (o.tag) ds.tags[o.tag] = (ds.tags[o.tag] || 0) + 1;
    new Set([c.L.tag, c.R.tag]).forEach(t => { if (t) ds.offered[t] = (ds.offered[t] || 0) + 1; });
    if (o.xs && st.duo.mode === 'ca') st.duo.q[st.duo.cur === 'a' ? 'b' : 'a'].push({ x: o.xs });   // hậu quả chéo: thẻ tiếp theo về ca người kia
  }
  if (o.m === 'cry') st.cryN = (st.cryN || 0) + 1;
  if (famOf(c) === st.fam.id) st.famN = (st.famN || 0) + 1;   // số tình huống riêng của nhà đã gặp
  if (o.set) st.flags[o.set] = 1;
  st.lastK = E.kList(o.k); E.addSkill(st, o.k);
  if (o.cmp) st.cmp = (st.cmp || 0) + 1;
  if (o.fs) { const f = famOf(c); if (f && !f.startsWith('ev:')) st.fsBy[f] = (st.fsBy[f] || 0) + 1; }
  if (o.m) st.moods.add(o.m);
  if (c.npc) st.npcAt[c.npc] = Math.max(st.npcAt[c.npc] ?? -1, c.s);
  st.whos.add(c.who); st.seen.add(E.cardId(c));
  st.whoStage[c.who] = Math.max(st.whoStage[c.who] ?? -1, c.s);
  st.log.push(st.duo && st.duo.mode !== 'con' ? { age, r: o.r, w: st.duo.cur } : { age, r: o.r });
  st.lastAge = age; st.i++;
  E.track(st);
  return o;
};

// ---- Đấu khẩu ngày Tết ----
// Mỗi trận 3 vòng, xếp ngẫu nhiên: 1 vòng theo cung của con (LD.SIGN_DUELS) hoặc theo gia cảnh (LD.FAM_DUELS, chung một suất, bốc một),
// 1 "vụ tranh cãi" nhiều hiệp (LD.DUEL_CASES:
// đáp khéo thì bác phản pháo tiếp, phải thắng mọi hiệp mới ăn vòng), 1 vòng "bằng chứng" nếu con có năng khiếu mạnh
// (LD.SKILL_DUELS, từ giai đoạn + E.TRUMP_OVER), còn lại là câu hỏi chung (LD.DUELS).
// Gia cảnh có duelX (nhà trúng số) thêm một vụ ở cuối (LD.FAM_CASES), nên trận đó có E.DUEL_ROUNDS + 1 vòng.
// Vòng = { title: tên vụ hoặc null, sign: id cung hoặc null, fam: id gia cảnh hoặc null, skill: id năng khiếu hoặc null, steps: [{ q, ev?, opts: [{ l, win }] }] }
const duelPair = (w, l) => E.rand() < .5 ? [{ l: w, win: 1 }, { l, win: 0 }] : [{ l, win: 0 }, { l: w, win: 1 }];
const duelOk = (d, st) => !d.s || (st && st.stage >= d.s);
E.duelRounds = st => {
  const g = st && E.sign(st), own = (g && LD.SIGN_DUELS && LD.SIGN_DUELS[g.id]) || [];
  const fq = (st && LD.FAM_DUELS && LD.FAM_DUELS[st.fam.id]) || [];
  const cases = (LD.DUEL_CASES || []).filter(c => duelOk(c, st)), special = [];
  if (fq.length && (!own.length || E.rand() < .5)) { const d = fq[Math.floor(E.rand() * fq.length)]; special.push({ fam: st.fam.id, steps: [{ q: d.q, opts: duelPair(d.w, d.l) }] }); }
  else if (own.length) { const d = own[Math.floor(E.rand() * own.length)]; special.push({ sign: g.id, steps: [{ q: d.q, opts: duelPair(d.w, d.l) }] }); }
  if (cases.length) { const c = cases[Math.floor(E.rand() * cases.length)]; special.push({ title: c.title, steps: c.steps.map(x => ({ q: x.q, opts: duelPair(x.w, x.l) })) }); }
  const ks = st && st.k && E.topSkill(st), proof = ks && ks.n >= st.stage + E.TRUMP_OVER && LD.SKILL_DUELS ? (LD.SKILL_DUELS[ks.id] || []).filter(d => duelOk(d, st)) : [];
  if (proof.length) { const d = proof[Math.floor(E.rand() * proof.length)]; special.push({ skill: ks.id, steps: [{ q: d.q, ev: d.ev, opts: duelPair(d.w, d.l) }] }); }
  const plain = E.shuffle(LD.DUELS.filter(d => duelOk(d, st))).slice(0, Math.max(0, E.DUEL_ROUNDS - special.length))
    .map(d => ({ steps: [{ q: d.q, opts: duelPair(d.w, d.l) }] }));
  const rounds = E.shuffle([...special, ...plain]).slice(0, E.DUEL_ROUNDS)
    .map(r => ({ title: r.title || null, sign: r.sign || null, fam: r.fam || null, skill: r.skill || null, steps: r.steps }));
  const x = st && st.fam.duelX && LD.FAM_CASES && LD.FAM_CASES[st.fam.id];
  if (x) rounds.push({ title: x.title, sign: null, fam: st.fam.id, skill: null, steps: x.steps.map(s => ({ q: s.q, opts: duelPair(s.w, s.l) })) });
  return rounds;
};

E.duelEffect = wins => wins >= 3 ? [15, -5, 10] : wins === 2 ? [10, -5, 5] : wins === 1 ? [-5, -10, 0] : [-10, -10, -5];

// proof = đã thắng một vòng bằng cách đưa bằng chứng (tài của con)
E.duelFinish = (st, wins, proof) => {
  const { age } = st.deck[st.i], two = st.duo && st.duo.mode !== 'con' && st.fam.duoDrift;
  // nhà có người đi làm xa: chơi chung thì phần đoàn tụ ngày Tết dành cho người ở xa (ghế a)
  const t = two ? null : st.fam.tet, d = E.duelEffect(wins).map((v, k) => v + (t ? t[k] : 0));
  allM(st, m => m.map((v, k) => clamp(v + d[k])));
  if (two && st.fam.tet) E.duoAdd(st, 'a', st.fam.tet);
  st.duel = { wins, proof: !!proof };
  if (st.fam.tet) st.log.push({ age, r: 'Tết về quê đoàn tụ. Cả mấy ngày Tết, {ten} không rời người đi làm xa về nửa bước.' });
  st.log.push({ age, r: wins >= 2 ? `Đấu khẩu ngày Tết: thắng bác ${wins}/${E.DUEL_ROUNDS} vòng. Con kể với cả lớp.`
    : wins === 1 ? 'Đấu khẩu ngày Tết: thua sát nút. Con vỗ vai bạn: "Năm sau mình luyện tiếp."'
    : 'Đấu khẩu ngày Tết: thua trắng. Con an ủi bạn bằng một miếng mứt dừa.' });
  st.lastAge = age; st.i++;
  E.track(st);
  return d;
};

// ---- Lì xì kéo co (ngay sau đấu khẩu): st.lixi = { n: số lần bác dúi } cho tới khi xong ----
E.lixiStart = st => { const [a, b] = E.LIXI_PUSH; st.lixi = { n: a + Math.floor(E.rand() * (b - a + 1)) }; };
// out: 'chuan' (nhận đúng lúc) | 'vo' (nhận sớm, con giật lấy) | 'cat' (từ chối cả lần cuối, bác cất)
E.lixiFinish = (st, out) => {
  const d = E.LIXI_EFFECT[out] || [0, 0, 0];
  allM(st, m => m.map((v, k) => clamp(v + d[k])));
  st.lixi = null; st.lixiRes = out;
  if (LD.LIXI && LD.LIXI.log[out]) st.log.push({ age: st.lastAge, r: LD.LIXI.log[out] });
  E.track(st);
  return d;
};

// null nếu chưa kết thúc sớm; ngược lại 'vui0', 'pin100', …
E.earlyEnd = st => {
  const k = st.m.findIndex(v => v <= 0 || v >= 100);
  return k < 0 ? null : METERS[k] + (st.m[k] <= 0 ? '0' : '100');
};

E.stageDone = st => st.i >= st.deck.length;
E.lastStage = st => st.stage >= LD.STAGES.length - 1;

// kiểu phụ huynh nổi nhất = tỉ lệ chọn so với số lần được mời chọn (để kiểu ít thẻ vẫn có cơ hội)
E.styleOf = (tags, offered) => {
  const score = t => (tags[t] || 0) / Math.max(3, offered[t] || 0);
  return Object.keys(tags).sort((a, b) => score(b) - score(a))[0] || 'chill';
};
E.styleTop = st => E.styleOf(st.tags, st.offered);
// ---- Nghề lúc 18 tuổi: năng khiếu mạnh nhất × nhóm kiểu phụ huynh (LD.JOBS) ----
E.STYLE_GROUP = { kiluat: 'nghiem', lo: 'nghiem', hai: 'vui', chill: 'vui', song: 'trend', chieu: 'trend' };
E.ALL_JOBS = Object.keys(LD.JOBS || {});
E.job = st => {
  const top = E.topSkill(st);
  if (!top || top.n < E.JOB_MIN) return 'gapyear';
  const g = E.STYLE_GROUP[E.styleTop(st)] || 'vui';
  return E.ALL_JOBS.find(id => LD.JOBS[id].k === top.id && LD.JOBS[id].g === g) || 'gapyear';
};

// kết riêng của gia cảnh: nhà có nhiều lựa chọn "chất nhà mình" nhất mà đủ E.FAM_END_MIN (bằng nhau thì ưu tiên gia cảnh hiện tại)
E.famEnd = st => {
  let best = null;
  for (const [f, n] of Object.entries(st.fsBy || {})) {
    if (n < E.FAM_END_MIN || !LD.TITLES['f_' + f]) continue;
    if (!best || n > best.n || (n === best.n && f === st.fam.id)) best = { f, n };
  }
  return best ? 'f_' + best.f : null;
};
E.result = (st, early) => {
  const g = E.sign(st);
  if (early) return { id: early, early: true, title: LD.ENDS[early][0], sub: LD.ENDS[early][1], quote: '', signLine: '', job: null, famEnd: null };
  const [vui, pin, than] = st.m;
  let id;
  if (pin <= 15) id = 'hetpin';
  else if (than >= 80 && vui >= 70) id = 'banthan';
  else if (st.m.every(v => v >= 44 && v <= 56)) id = 'binhthuong';
  else id = E.styleTop(st);
  const quote = than >= 65 ? 'Đi đâu cũng được, miễn tối vẫn gọi video về nhà.'
    : vui < 35 ? 'Con ổn mà. Chắc vậy.'
    : pin < 30 ? '{P} nghỉ ngơi đi, giờ tới lượt con lo.'
    : 'Cảm ơn vì đã không đăng ảnh con lên mạng quá nhiều. Chỉ hơi nhiều thôi.';
  return { id, early: false, title: LD.TITLES[id][0], sub: LD.TITLES[id][1], quote, signLine: g ? g.final : '', job: E.job(st), famEnd: E.famEnd(st) };
};

E.ALL_ENDS = [...Object.keys(LD.ENDS), ...Object.keys(LD.TITLES)];

// ================= NUÔI CHUNG (owner 05/10/2026) =================
// st.duo = { mode, seats: { a: { role, m: [pin, thân], tags, offered, nho }, b: ... }, cur: ghế đang nạp vào st.m,
//   turn: ghế tới lượt, ph: pha, split: vị trí ca 2 trong bộ thẻ, vote: quyết định lớn đang bỏ phiếu, votes: lịch sử,
//   q: việc chờ mỗi người (thẻ được nhờ, hậu quả chéo), mark: số dòng nhật ký lúc mỗi người hết lượt trước,
//   step: bước (cùng vuốt), agree / n: số lần cùng ý / số lần chọn (cùng vuốt), last: kết quả lật gần nhất, over: kết quả cuối }
// Ghế a là người tạo phòng. Chia ca: mỗi giai đoạn a chơi ca 1 (những năm đầu), b chơi ca 2 rồi bỏ phiếu kín,
// a bỏ phiếu sau (lật kết quả) rồi chơi luôn ca 1 của giai đoạn kế, nên mỗi lượt là một lần ngồi chơi.
// Một người làm con: d.kid = ghế của người làm con, st.m là thanh của phụ huynh (ghế còn lại).
const other = s => s === 'a' ? 'b' : 'a';
E.other = other;
E.newDuo = (fam, roleA, name, style, sign, mode, kidSeat) => {
  const st = E.newRun(fam, roleA, name, style, { n: 1 }, sign), roleB = roleA === 'bố' ? 'mẹ' : 'bố';
  const seat = role => ({ role, m: [st.m[1], st.m[2]], tags: {}, offered: {}, nho: -1 });
  st.duo = { mode, seats: { a: seat(roleA), b: seat(roleB) }, cur: 'a', turn: 'a', ph: '', split: 0, vote: null, votes: [],
    q: { a: [], b: [] }, mark: { a: 0, b: 0 }, step: 0, agree: 0, n: 0, last: null, over: null };
  if (mode === 'con') {
    st.duo.kid = kidSeat === 'a' ? 'a' : 'b';
    // nhiệm vụ bí mật của con: gia cảnh có nhiệm vụ riêng thì 40% bốc nhiệm vụ đó
    const ms = LD.KID_MISSIONS.filter(x => !x.fam || x.fam === fam.id), own = ms.filter(x => x.fam), list = own.length && E.rand() < .4 ? own : ms.filter(x => !x.fam);
    st.duo.mission = list[Math.floor(E.rand() * list.length)].id;
  }
  return st;
};
// nạp thanh của người chơi seat vào st.m (Con vui dùng chung)
E.duoUse = (st, seat) => {
  const d = st.duo;
  if (!d || d.mode === 'con' || d.cur === seat) return;
  d.seats[d.cur].m = [st.m[1], st.m[2]];
  st.m = [st.m[0], ...d.seats[seat].m];
  st.role = d.seats[seat].role; d.cur = seat;
};
E.duoSync = st => { const d = st.duo; if (d && d.mode !== 'con') d.seats[d.cur].m = [st.m[1], st.m[2]]; };
E.duoM = (st, seat) => { const d = st.duo; return d.cur === seat ? [st.m[1], st.m[2]] : d.seats[seat].m; };
// cộng [vui, pin, thân] cho riêng một người (Con vui vẫn là chung)
E.duoAdd = (st, seat, dd) => {
  const d = st.duo;
  st.m[0] = clamp(st.m[0] + (dd[0] || 0));
  const m = E.duoM(st, seat).map((v, k) => clamp(v + (dd[k + 1] || 0)));
  if (d.cur === seat) { st.m[1] = m[0]; st.m[2] = m[1]; } else d.seats[seat].m = m;
};
// luật trôi riêng từng người (gia cảnh có duoDrift): không bao giờ tự làm ván kết thúc
E.duoNudge = (st, dd) => {
  ['a', 'b'].forEach((s, i) => {
    const x = dd[s], m = E.duoM(st, s).map((v, k) => clamp(v + (x[k + 1] || 0), 3, 97));
    if (st.duo.cur === s) { st.m[1] = m[0]; st.m[2] = m[1]; } else st.duo.seats[s].m = m;
    if (i === 0 && x[0]) st.m[0] = clamp(st.m[0] + x[0], 3, 97);
  });
};
// kết thúc sớm khi chơi chung: Con vui (chung) hoặc pin / thân của một trong hai người chạm 0 hay 100
E.duoEarly = st => {
  const d = st.duo, e = E.earlyEnd(st);
  if (d.mode === 'con') return e ? { id: e, seat: null } : null;
  if (e) return { id: e, seat: e.startsWith('vui') ? null : d.cur };
  const s = other(d.cur), m = d.seats[s].m;
  for (let k = 0; k < 2; k++) if (m[k] <= 0 || m[k] >= 100) return { id: ['pin', 'than'][k] + (m[k] <= 0 ? '0' : '100'), seat: s };
  return null;
};

// ---- chia ca ----
// Bộ thẻ của giai đoạn đủ cho hai ca; ca 1 (ghế a) những năm đầu, ca 2 (ghế b) những năm sau.
// Gia cảnh có duoShare (đi làm xa): ca của người ở xa (a) ngắn hơn và thẻ riêng của nhà (gọi video) nằm trong ca đó.
// Đấu khẩu ngày Tết chia hai phần: a đỡ những vòng đầu ở cuối ca 1, b đỡ nốt (rồi lì xì) ở đầu ca 2.
E.duoStage = (st, si) => {
  const d = st.duo;
  E.duoUse(st, 'a');
  E.startStage(st, si);
  let duelAt = st.deck.findIndex(x => x.duel);
  if (duelAt >= 0) st.deck.splice(duelAt, 1);
  if (st.fam.duoShare) {   // đưa thẻ riêng của nhà lên đầu (ca của người ở xa)
    const k = st.deck.findIndex(x => x.c && famOf(x.c) === st.fam.id);
    if (k > 0) st.deck.unshift(...st.deck.splice(k, 1));
  }
  let split = Math.max(1, Math.round(st.deck.length * (st.fam.duoShare || .5)));
  if (duelAt >= 0) {
    const age = st.deck[Math.max(0, split - 1)].age;
    st.deck.splice(split, 0, { duel: 1, part: 1, age }, { duel: 2, part: 2, age });
    split += 1;
  }
  d.split = split; d.ph = 'ca1'; d.turn = 'a'; d.vote = null;
};
// đầu ca của seat: nạp thanh, chèn việc được nhờ và hậu quả chéo vào chỗ đang đứng
E.cardById = id => { if (!E._byId) E._byId = new Map(LD.CARDS.map(c => [E.cardId(c), c])); return E._byId.get(id) || null; };
E.duoBeginCa = (st, seat) => {
  const d = st.duo;
  E.duoUse(st, seat);
  const age = (st.deck[st.i] || st.deck[st.deck.length - 1] || { age: st.lastAge }).age, add = [];
  for (const it of d.q[seat].splice(0)) {
    if (it.x) { const c = LD.CARDS.find(x => x.xr === it.x); if (c) add.push({ c, age, x: 1 }); }
    else { const c = E.cardById(it.id); if (c) add.push({ c, age: it.age, from: it.from }); }
  }
  if (add.length) { st.deck.splice(st.i, 0, ...add); if (seat === 'a') d.split += add.length; }
  return add.length;
};
E.duoCaEnd = st => st.duo.ph === 'ca1' ? st.i >= st.duo.split : st.i >= st.deck.length;
// nhờ người kia làm thay thẻ đang cầm: mỗi người mỗi giai đoạn một lần; người kia phải còn ca phía trước
E.duoCanPass = st => {
  const d = st.duo, it = st.deck[st.i];
  if (!d || d.mode !== 'ca' || !it || !it.c || it.x || it.from || it.c.age != null) return false;
  if (d.seats[d.cur].nho === st.stage) return false;
  return !(d.cur === 'b' && st.stage >= LD.STAGES.length - 1);
};
E.duoPass = st => {
  if (!E.duoCanPass(st)) return false;
  const d = st.duo, it = st.deck[st.i], to = other(d.cur);
  st.deck.splice(st.i, 1);
  if (d.ph === 'ca1') d.split--;
  d.q[to].push({ id: E.cardId(it.c), age: it.age, from: d.cur });
  d.seats[d.cur].nho = st.stage;
  st.m[1] = clamp(st.m[1] + E.NHO_PIN);
  st.used.add(it.c);
  return true;
};
// phần 1 của đấu khẩu xong (a đỡ xong những vòng đầu): bỏ qua ô phần 1, ca 1 kết thúc
E.duoDuelPause = st => { st.i++; };
// quyết định lớn của giai đoạn (LD.DUO_VOTES), mỗi giai đoạn bốc một trong vài câu
E.duoVoteStart = st => {
  const list = LD.DUO_VOTES.map((v, i) => i).filter(i => LD.DUO_VOTES[i].s === st.stage);
  st.duo.vote = { v: list.length ? list[Math.floor(E.rand() * list.length)] : 0, a: null, b: null };
  return st.duo.vote;
};
// phân xử khi khác ý: nhà ở chung ông bà thì ông bà quyết (chọn bên chiều cháu hơn), còn lại con nghe người thân hơn
E.duoJudge = (st, o, sa, sb) => {
  if (st.fam.vote === 'ongba') return { win: 'ongba', side: o[sa].d[0] >= o[sb].d[0] ? sa : sb };
  const ta = E.duoM(st, 'a')[1], tb = E.duoM(st, 'b')[1], w = ta === tb ? (E.rand() < .5 ? 'a' : 'b') : ta > tb ? 'a' : 'b';
  return { win: w, side: w === 'a' ? sa : sb };
};
// bỏ phiếu kín; đủ hai phiếu thì lật: giống nhau thì Con vui thêm, khác nhau thì phân xử và người thua bị trừ Pin
E.duoVote = (st, seat, side) => {
  const d = st.duo, vt = d.vote, q = LD.DUO_VOTES[vt.v];
  vt[seat] = side;
  if (!vt.a || !vt.b) return null;
  const same = vt.a === vt.b, j = same ? { win: 'both', side: vt.a } : E.duoJudge(st, q, vt.a, vt.b), o = q[j.side];
  allM(st, m => m.map((v, k) => clamp(v + o.d[k])));
  if (same) st.m[0] = clamp(st.m[0] + E.DUO_AGREE);
  else ['a', 'b'].filter(s => s !== j.win && vt[s] !== j.side).forEach(s => E.duoAdd(st, s, [0, -E.DUO_LOSE, 0]));
  E.addSkill(st, o.k);
  const res = { v: vt.v, a: vt.a, b: vt.b, win: j.win, side: j.side };
  d.votes.push(res); d.last = res; d.vote = null;
  st.log.push({ age: st.lastAge, r: o.r, w: 'vote' });
  E.track(st);
  return res;
};

// ---- cùng vuốt: cả hai cùng thấy một thẻ, chọn kín rồi lật ----
// Bộ thẻ như chơi một mình, cuối mỗi giai đoạn thêm một quyết định lớn. Mỗi thẻ: giống nhau thì Con vui thêm chút,
// khác nhau thì phân xử như quyết định lớn, người thua bị trừ Pin. Thẻ áp lên cả hai người (cùng làm).
E.cungStage = (st, si) => {
  E.duoUse(st, 'a');
  E.startStage(st, si);
  const v = E.duoVoteStart(st);
  st.deck.push({ vote: 1, v: v.v, age: st.deck.length ? st.deck[st.deck.length - 1].age : LD.STAGES[si].a[0] });
  st.duo.vote = null;
};
E.cungPick = (st, pa, pb) => {
  const d = st.duo, it = st.deck[st.i];
  d.step++; d.n++;
  if (it.vote) {
    d.vote = { v: it.v, a: null, b: null };
    E.duoVote(st, 'a', pa);
    const r = E.duoVote(st, 'b', pb);
    st.i++;
    if (r.a === r.b) d.agree++;
    d.last = { kind: 'vote', ...r, step: d.step };
    return d.last;
  }
  const same = pa === pb, j = same ? { win: 'both', side: pa } : E.duoJudge(st, it.c, pa, pb);
  E.duoUse(st, 'a');
  const o = E.choose(st, j.side), dd = st.lastD;
  E.duoAdd(st, 'b', [0, dd[1], dd[2]]);
  const ds = d.seats.b, c = it.c;   // kiểu phụ huynh: mỗi người tính theo lựa chọn của chính mình
  if (pb && c[pb].tag) ds.tags[c[pb].tag] = (ds.tags[c[pb].tag] || 0) + 1;
  new Set([c.L.tag, c.R.tag]).forEach(t => { if (t) ds.offered[t] = (ds.offered[t] || 0) + 1; });
  const sa = d.seats.a;
  if (pa !== j.side && c[j.side].tag) { sa.tags[c[j.side].tag]--; if (c[pa].tag) sa.tags[c[pa].tag] = (sa.tags[c[pa].tag] || 0) + 1; }
  if (same) { st.m[0] = clamp(st.m[0] + E.CUNG_AGREE); d.agree++; }
  else ['a', 'b'].filter(s => s !== j.win && (s === 'a' ? pa : pb) !== j.side).forEach(s => E.duoAdd(st, s, [0, -E.CUNG_LOSE, 0]));
  E.track(st);
  d.last = { kind: 'card', a: pa, b: pb, win: j.win, side: j.side, id: E.cardId(c), step: d.step };
  return d.last;
};

// ---- một người làm con: con chọn thẻ ném cho phụ huynh ----
// Mỗi giai đoạn: thẻ nối tiếp và thẻ con nhà người ta là bắt buộc, còn lại xếp thành từng cặp, con chọn một thẻ mỗi cặp,
// được "ăn vạ" một thẻ (Con vui lên xuống gấp đôi). Phụ huynh chơi bộ thẻ đó. Con có một nhiệm vụ bí mật (LD.KID_MISSIONS).
E.conOffer = (st, si) => {
  E.stagePrep(st, si);
  const cand = E.stageCand(st, si), n = E.stageN(st, si);
  const forced = takeN(cand.filter(c => c.req || c.rv), n), rest = takeN(cand.filter(c => !c.req && !c.rv && !forced.some(f => f.grp && f.grp === c.grp)), 2 * Math.max(0, n - forced.length));
  const pairs = [];
  for (let i = 0; i + 1 < rest.length; i += 2) pairs.push([E.cardId(rest[i]), E.cardId(rest[i + 1])]);
  st.duo.offer = { si, forced: forced.map(E.cardId), pairs };
  st.duo.ph = 'pick'; st.duo.turn = st.duo.kid;
  return st.duo.offer;
};
// choice[i] = 0 | 1 cho từng cặp, av = mã thẻ con ăn vạ (hoặc null)
E.conCommit = (st, choice, av) => {
  const o = st.duo.offer, ids = [...o.forced, ...o.pairs.map((p, i) => p[choice[i] ? 1 : 0])];
  E.stageDeck(st, o.si, ids.map(E.cardById).filter(Boolean));
  if (av) { const it = st.deck.find(x => x.c && E.cardId(x.c) === av); if (it) it.av = 1; }
  st.duo.offer = null; st.duo.ph = 'play'; st.duo.turn = other(st.duo.kid);
};
E.missionById = id => (LD.KID_MISSIONS || []).find(x => x.id === id) || null;
E.missionDone = (st, res) => {
  const x = E.missionById(st.duo.mission), j = res.job && LD.JOBS[res.job];
  if (!x) return false;
  switch (x.test) {
    case 'minPin': return st.minM[1] <= x.v;
    case 'endVui': return !res.early && st.m[0] >= x.v;
    case 'endThan': return !res.early && st.m[2] >= x.v;
    case 'tagN': return (st.tags[x.tag] || 0) >= x.v;
    case 'jobSkill': return !res.early && !!j && j.k === x.v;
    case 'job': return !res.early && res.job === x.v;
    case 'cries': return (st.cryN || 0) >= x.v;
    case 'duelWins': return !!st.duel && st.duel.wins >= x.v;
    case 'famEnd': return !!res.famEnd;
    case 'famCards': return (st.famN || 0) >= x.v;
    case 'flag': return !!st.flags[x.v];
  }
  return false;
};

// ---- kết quả khi chơi chung ----
// Chia ca / cùng vuốt: combo kiểu phụ huynh của hai người (LD.DUO_COMBOS), độ đồng lòng, con thân ai hơn.
// Một người làm con: như chơi một mình, cộng thêm nhiệm vụ của con.
E.duoResult = (st, early) => {
  const d = st.duo;
  if (d.mode === 'con') { const r = E.result(st, early ? early.id : null); r.mission = E.missionDone(st, r); return r; }
  E.duoSync(st);
  const A = d.seats.a, B = d.seats.b;
  if (early) {
    const t = early.seat ? LD.DUO_ENDS[early.id] : LD.ENDS[early.id];
    return { id: early.id, early: true, seat: early.seat, title: t[0], sub: t[1], job: null, famEnd: null };
  }
  const sa = E.styleOf(A.tags, A.offered), sb = E.styleOf(B.tags, B.offered), combo = LD.DUO_COMBOS[[sa, sb].sort().join('|')] || ['Hai người một con', ''];
  const agree = d.mode === 'cung' ? d.agree : d.votes.filter(v => v.a === v.b).length, total = d.mode === 'cung' ? d.n : d.votes.length;
  return { id: 'duo', early: false, title: combo[0], sub: combo[1], styles: { a: sa, b: sb }, agree, total,
    closer: A.m[1] === B.m[1] ? null : A.m[1] > B.m[1] ? 'a' : 'b', job: E.job(st), famEnd: E.famEnd(st) };
};
// mục tiêu riêng của chơi chung (người chơi ở ghế seat nhận)
E.duoAch = (st, res, seat) => {
  const d = st.duo, out = [];
  if (res.early) return d.mode === 'con' && seat === d.kid && res.mission ? ['con_quay'] : [];
  if (d.mode !== 'con') {
    out.push('nuoi_chung');
    if (res.total >= 5 && res.agree === res.total) out.push('dong_long');
    if (d.mode === 'cung' && res.total >= 20 && res.agree / res.total >= .8) out.push('hop_nhau');
  } else if (seat === d.kid && res.mission) out.push('con_quay');
  else if (seat !== d.kid) out.push('nuoi_chung');
  return out;
};

// ---- Mục tiêu (kiểu Reigns). save = dữ liệu lưu qua các ván, đã cộng ván vừa xong ----
const done = res => !res.early;
E.ACH = [
  { id: 'pin_trau',     name: 'Pin trâu',               desc: 'Nuôi tới 18 tuổi mà pin chưa từng dưới 20.',       test: (st, res) => done(res) && st.minM[1] >= 20 },
  { id: 'khong_khoc',   name: 'Tuổi thơ không nước mắt', desc: 'Nuôi tới 18 tuổi mà con chưa khóc lần nào.',       test: (st, res) => done(res) && !st.moods.has('cry') },
  { id: 'vua_dau_khau', name: 'Vua đấu khẩu ngày Tết',   desc: 'Thắng bác cả 3 vòng đấu khẩu.',                    test: st => !!st.duel && st.duel.wins >= E.DUEL_ROUNDS },
  { id: 'sen',          name: 'Sen chính hiệu',          desc: 'Đi cùng con chó tới lúc nó già.',                  test: st => st.npcAt.cho_gia != null },
  { id: 'ga_gay',       name: 'Gà gáy cả xóm',           desc: 'Nuôi con gà tới khi nó thành gà trống.',           test: st => st.npcAt.ga_trong != null },
  { id: 'khung_long',   name: 'Khủng long bất tử',       desc: 'Giữ con khủng long biết hát tới năm con 18 tuổi.', test: st => st.npcAt.khung_long === 5 },
  { id: 'kol',          name: 'Phụ huynh của KOL',       desc: 'Kênh TikTok của con đạt 10 nghìn follower.',       test: st => st.whos.has('Kênh của con') },
  { id: 'nhanh',        name: 'Nhanh như chớp',          desc: 'Kết thúc sớm khi con chưa tới 5 tuổi.',            test: (st, res) => res.early && st.lastAge < 5 },
  { id: 'du_bo_nha',    name: 'Đủ bộ gia cảnh',          desc: `Nuôi tới 18 tuổi với cả ${LD.FAMS.filter(f => !f.rare).length} gia cảnh thường.`, test: (st, res, save) => LD.FAMS.filter(f => !f.rare).every(f => save.famDone.includes(f.id)) },
  { id: 'ba_doi',       name: 'Tam đại đồng đường',      desc: 'Chơi tới đời thứ 3.',                              test: st => (st.gen.n || 1) >= 3 },
  { id: 'suu_tam',      name: 'Nhà sưu tầm',             desc: 'Mở 10 cái kết khác nhau.',                         test: (st, res, save) => save.endings.filter(id => E.ALL_ENDS.includes(id)).length >= 10 },
  { id: 'thay_boi',     name: 'Thầy bói nghiệp dư',      desc: 'Nuôi tới 18 tuổi với 6 cung hoàng đạo khác nhau.', test: (st, res, save) => (save.signsDone || []).length >= 6 },
  { id: 'nghe_si',      name: 'Nghệ sĩ nhà mình',        desc: 'Nghe con đàn ở buổi chia tay lớp 12.',             test: st => st.whoStage['Cây đàn'] === 5 },
  { id: 'heo_dat',      name: 'Đại gia heo đất',         desc: 'Giữ con heo đất tới năm con 18 tuổi.',             test: st => st.whoStage['Heo đất'] === 5 },
  { id: 'hoi_4',        name: 'Hội 4 đứa mãi đỉnh',      desc: 'Đi cùng Hội 4 đứa tới buổi họp mặt cuối.',         test: st => st.whoStage['Hội 4 đứa'] === 5 },
  { id: 'bang_chung',   name: 'Nhận lấy bằng chứng!',    desc: 'Thắng một vòng đấu khẩu nhờ tài của con.',         test: st => !!st.duel && !!st.duel.proof },
  { id: 'lixi_chuan',   name: 'Lì xì chuẩn bài',         desc: 'Nhận lì xì đúng lúc bác dọa giận.',                 test: st => st.lixiRes === 'chuan' },
  { id: 'khong_so',     name: 'Con nhà mình là nhất',    desc: 'Nuôi tới 18 tuổi mà chưa lần nào đem con ra so với con nhà người ta.', test: (st, res) => done(res) && !st.cmp },
  { id: 'huong_nghiep', name: 'Chuyên gia hướng nghiệp', desc: 'Nuôi con thành 8 nghề khác nhau.',                  test: (st, res, save) => (save.jobs || []).filter(id => E.ALL_JOBS.includes(id) && id !== 'gapyear').length >= 8 },
  { id: 'ngu_dai',      name: 'Ngũ đại đồng đường',      desc: 'Chơi tới đời thứ 5.',                               test: st => (st.gen.n || 1) >= 5 },
  { id: 'so_phan',      name: 'Số phận an bài',          desc: 'Để số phận chọn gia cảnh rồi nuôi tới 18 tuổi.',    test: (st, res) => done(res) && !!st.lucky },
  { id: 'doc_dac',      name: 'Trúng số độc đắc',        desc: 'Gặp gia cảnh hiếm: Nhà vừa trúng số.',             test: st => st.fam.id === 'trungso' || st.famStart === 'trungso' },
  { id: 'bien_co',      name: 'Sóng gió gia đình',       desc: 'Qua 2 biến cố gia đình trong một ván mà vẫn nuôi tới 18 tuổi.', test: (st, res) => done(res) && (st.evs || []).length >= 2 },
  { id: 'ket_rieng',    name: 'Chất nhà mình',           desc: 'Mở 4 cái kết riêng của gia cảnh.',                 test: (st, res, save) => save.endings.filter(id => id.startsWith('f_') && E.ALL_ENDS.includes(id)).length >= 4 },
  // chơi chung: game chấm riêng cho từng người bằng E.duoAch, không chấm ở đây
  { id: 'nuoi_chung',   name: 'Nuôi chung',              desc: 'Nuôi chung với một người khác tới 18 tuổi.',        test: () => false, duo: 1 },
  { id: 'dong_long',    name: 'Đồng lòng',               desc: 'Chia ca nuôi con tới 18 tuổi mà quyết định lớn nào hai người cũng chọn giống nhau.', test: () => false, duo: 1 },
  { id: 'hop_nhau',     name: 'Sinh ra để nuôi chung',   desc: 'Cùng vuốt tới 18 tuổi, hợp nhau từ 80% trở lên.',  test: () => false, duo: 1 },
  { id: 'con_quay',     name: 'Đứa con siêu quậy',       desc: 'Vào vai con và hoàn thành nhiệm vụ bí mật.',       test: () => false, duo: 1 }
];
E.checkAch = (st, res, save) => E.ACH.filter(a => !a.duo && !save.ach.includes(a.id) && a.test(st, res, save)).map(a => a.id);
})();
