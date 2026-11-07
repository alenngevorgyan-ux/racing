// Ember & Tide — a two-player co-op platformer, drawn like a remembered room:
// a pencil drawing on paper, with gouache showing only where attention is.
(() => {
  const $ = (id) => document.getElementById(id);
  const COLS = 32, ROWS = 18;
  const PAPER = '#E4DAC6', GRAPHITE = '#4A4A48';
  const GRAV = 38, RUN = 7.2, JUMP = 15.2, SPRING = 24, WIND = 72, WIND_MAX = 8.5;
  const PW = 0.56, PH = 0.92, COYOTE = 0.1, BUFFER = 0.13;
  const LIQ = 0.35; // liquids sit this far below the tile top
  const SIG_COL = { p: '#A5442E', q: '#4B6A86', r: '#C58A3E', k: '#6E7D3C', m: '#7A5A8A' };
  // She (player 1) and he (player 2) from the sheet "Двое". Amber pools are hers, blue ones are his,
  // the shadow takes both (on the sheet she stumbles in blue, he in amber).
  const ROLE = {
    ember: { name: 'She', c: 1, safe: 'L', gem: 'e', door: 'E', ink: '#A2452F', col: '#C9902F' },
    tide: { name: 'He', c: 2, safe: 'W', gem: 't', door: 'T', ink: '#3E5C7A', col: '#3E5C7A' },
  };
  const LIQ_COL = { L: ['#C9902F', '#E2B866'], W: ['#3E5C7A', '#6F8FAE'], G: ['#2E2C34', '#4C4955'] };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };
  const progress = store.get('duo.progress', { unlocked: 1, stars: {} });
  let myName = store.get('duo.name', '');

  // ---------------------------------------------------------------- state
  let screen = 'menu';          // menu | lobby | play | result
  let net = 'local';            // local | online
  let isHost = true, myRole = 'ember', levelIdx = 0;
  let L = null;                 // running level
  const players = {};
  let other = { name: '', present: false, ready: false, role: 'tide', where: 'lobby' };
  let myReady = false, roomCode = '';

  // ---------------------------------------------------------------- input
  const keys = {}, pressed = {};
  const typing = () => ['INPUT', 'SELECT'].includes(document.activeElement && document.activeElement.tagName);
  addEventListener('keydown', (e) => {
    if (typing()) return;
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    if (screen === 'play' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (screen === 'play' && e.code === 'KeyR') restartLevel(true);
    if (screen === 'play' && e.code === 'Escape') togglePause();
    const emo = { Digit1: '❤️', Digit2: '😘', Digit3: '😂', Digit4: '😤' }[e.code];
    if (emo && screen === 'play') emote(myRole, emo, true);
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const any = (codes) => codes.some((c) => keys[c]);
  const tap = (codes) => codes.some((c) => pressed[c]);
  function inputFor(role) {
    // one keyboard: Ember = WASD, Tide = arrows. Online: either set drives your character.
    const set = net === 'local'
      ? (role === 'ember' ? { l: ['KeyA'], r: ['KeyD'], j: ['KeyW'], a: ['KeyS'] } : { l: ['ArrowLeft'], r: ['ArrowRight'], j: ['ArrowUp'], a: ['ArrowDown'] })
      : { l: ['KeyA', 'ArrowLeft'], r: ['KeyD', 'ArrowRight'], j: ['KeyW', 'ArrowUp', 'Space'], a: ['KeyS', 'ArrowDown', 'KeyE'] };
    return { left: any(set.l), right: any(set.r), jumpHeld: any(set.j), jump: tap(set.j), action: tap(set.a), actHeld: any(set.a), up: any(set.j) };
  }

  // ---------------------------------------------------------------- level
  function loadLevel(i) {
    const def = LEVELS[i];
    const tiles = def.map.map((r) => r.split(''));
    const lv = {
      i, def, tiles, gems: [], crates: [], springs: [], pads: [], stones: [], plates: [], levers: [], fans: [], portals: [],
      gates: [], movers: [], doors: {}, starts: {}, frozen: new Map(), melt: new Map(), sig: {},
      t: 0, deaths: (L && L.i === i ? L.deaths : 0), dead: 0, won: false, fx: [], dirty: true,
      tether: def.flags.tether || 0, rising: def.flags.rising || null, gooY: ROWS + 1, note: def.note, noteT: 6,
    };
    const portalEnds = {};
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ch = tiles[r][c];
      const keep = '#LWGI'.includes(ch);
      if (ch === 'e' || ch === 't' || ch === 's') lv.gems.push({ x: c + 0.5, y: r + 0.5, kind: ch, taken: false });
      else if (ch === '1') lv.starts.ember = { x: c + 0.5, y: r + 1 };
      else if (ch === '2') lv.starts.tide = { x: c + 0.5, y: r + 1 };
      else if (ch === 'E') lv.doors.ember = { c, r };
      else if (ch === 'T') lv.doors.tide = { c, r };
      else if (ch === 'C') lv.crates.push({ x: c, y: r, vx: 0, vy: 0, push: 0 });
      else if (ch === 'J') lv.springs.push({ c, r, t: 0 });
      else if (ch === 'v') lv.pads.push({ c, r, t: 0 });
      else if (ch === 'X') lv.stones.push({ c, r });
      else if ('pqr'.includes(ch)) lv.plates.push({ c, r, id: ch, down: 0 });
      else if ('km'.includes(ch)) lv.levers.push({ c, r, id: ch, on: false });
      else if (ch === 'f') lv.fans.push({ c, r, by: null });
      else if ('OQPR'.includes(ch)) portalEnds[ch] = { x: c + 0.5, y: r + 0.5 };
      if (!keep) tiles[r][c] = ' ';
    }
    if (portalEnds.O && portalEnds.Q) lv.portals.push({ a: portalEnds.O, b: portalEnds.Q, col: '#C58A3E' });
    if (portalEnds.P && portalEnds.R) lv.portals.push({ a: portalEnds.P, b: portalEnds.R, col: '#4E8A8A' });
    for (const o of def.objs) {
      if (o.type === 'gate') lv.gates.push(Object.assign({ open: 0 }, o));
      if (o.type === 'mover') lv.movers.push(Object.assign({ t: 0, px: o.x, py: o.y }, o));
      if (o.type === 'fan') lv.fans.push({ c: o.x, r: o.y, by: o.by });
    }
    // the wind column above each fan reaches up to the first solid tile
    for (const f of lv.fans) { let r = f.r - 1; while (r > 0 && tiles[r][f.c] !== '#') r--; f.top = r + 1; }
    return lv;
  }

  function spawnPlayers() {
    for (const role of ['ember', 'tide']) {
      const s = L.starts[role];
      players[role] = Object.assign(players[role] || {}, {
        role, label: net === 'online' ? (role === myRole ? (myName || ROLE[role].name) : (other.name || ROLE[role].name)) : ROLE[role].name, x: s.x, y: s.y, vx: 0, vy: 0, g: 1, onGround: false, coyote: 0, jumpBuf: 0, face: 1, run: 0,
        portalCd: 0, padCd: 0, inDoor: false, local: net === 'local' || role === myRole, snaps: [], emo: null, alive: true,
      });
    }
  }

  function startLevel(i) {
    levelIdx = i;
    L = loadLevel(i);
    spawnPlayers();
    screen = 'play';
    paused = false;
    showOnly('hud');
    $('lvKicker').textContent = `LEVEL ${i + 1} OF ${LEVELS.length}`;
    $('lvName').textContent = L.def.name;
    $('lvNote').textContent = L.note;
    $('lvNote').classList.remove('fade');
    clearTimeout(noteTimer); noteTimer = setTimeout(() => $('lvNote').classList.add('fade'), 6000);
    $('keysHint').innerHTML = net === 'local'
      ? '<span class="ember-ink">She</span> <kbd>A</kbd><kbd>D</kbd> <kbd>W</kbd> jump <kbd>S</kbd> act · <span class="tide-ink">He</span> <kbd>←</kbd><kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> (hold: crouch, she jumps off his hands) · <kbd>R</kbd>'
      : '<kbd>A</kbd><kbd>D</kbd> move · <kbd>W</kbd> jump · <kbd>S</kbd> act' + (myRole === 'tide' ? ' (hold: crouch for her)' : '') + ' · <kbd>R</kbd> restart · <kbd>1</kbd>–<kbd>4</kbd>';
    if (net === 'online') Net.send({ t: 'where', v: 'play' });
  }
  let noteTimer = 0;

  function restartLevel(announce) {
    if (!L) return;
    const deaths = L.deaths;
    L = loadLevel(levelIdx);
    L.deaths = deaths;
    spawnPlayers();
    if (announce && net === 'online') Net.send({ t: 'restart' });
  }

  // ---------------------------------------------------------------- world queries
  const tileAt = (c, r) => (r < 0 || r >= ROWS || c < 0 || c >= COLS ? '#' : L.tiles[r][c]);
  const isLiquid = (ch) => ch === 'L' || ch === 'W' || ch === 'G';
  const frozen = (c, r) => (L.frozen.get(c + ',' + r) || 0) > L.t;
  function gateRect(g) { return { x: g.x, y: g.y, w: g.w, h: Math.max(0.12, g.h * (1 - 0.94 * g.open)) }; }
  function moverRect(m) { return { x: m.x + m.dx * m.t, y: m.y + m.dy * m.t, w: m.w, h: m.h }; }
  function solids(l, t, r, b, skipCrate) {
    const out = [];
    for (let row = Math.floor(t) - 1; row <= Math.floor(b) + 1; row++) for (let c = Math.floor(l) - 1; c <= Math.floor(r) + 1; c++) {
      const ch = tileAt(c, row);
      if (ch === '#' || ch === 'I') out.push({ x: c, y: row, w: 1, h: 1 });
      else if (isLiquid(ch)) {
        // floor liquids sit low in their tile; ceiling liquids hang from the top
        out.push(row === 0 ? { x: c, y: row, w: 1, h: 1 - LIQ } : { x: c, y: row + LIQ, w: 1, h: 1 - LIQ });
      }
    }
    for (const g of L.gates) out.push(gateRect(g));
    for (const m of L.movers) out.push(Object.assign(moverRect(m), { mover: m }));
    for (const cr of L.crates) if (cr !== skipCrate) out.push({ x: cr.x, y: cr.y, w: 1, h: 1, crate: cr });
    return out;
  }
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const boxOf = (p) => ({ x: p.x - PW / 2, y: p.g > 0 ? p.y - PH : p.y, w: PW, h: PH });
  const center = (p) => ({ x: p.x, y: p.g > 0 ? p.y - PH / 2 : p.y + PH / 2 });

  function sweep(box, dx, dy, rects, onHitX) {
    let hitDown = false, hitUp = false, hitX = 0;
    box.x += dx;
    for (const r of rects) if (overlap(box, r)) {
      if (dx > 0) box.x = r.x - box.w; else if (dx < 0) box.x = r.x + r.w;
      hitX = Math.sign(dx);
      if (onHitX) onHitX(r, hitX);
    }
    box.y += dy;
    let standOn = null;
    for (const r of rects) if (overlap(box, r)) {
      if (dy > 0) { box.y = r.y - box.h; hitDown = true; standOn = r; } else if (dy < 0) { box.y = r.y + r.h; hitUp = true; standOn = r; }
    }
    return { hitDown, hitUp, hitX, standOn };
  }

  // ---------------------------------------------------------------- signals, mechanisms
  function bodiesForPlates() {
    const list = [];
    for (const role of ['ember', 'tide']) { const p = players[role]; if (p && p.alive) list.push({ box: boxOf(p), ground: p.onGround }); }
    for (const cr of L.crates) list.push({ box: { x: cr.x + 0.05, y: cr.y, w: 0.9, h: 1 }, ground: true });
    return list;
  }
  function plateZone(pl) {
    // a plate lies on the floor (or hangs from a ceiling)
    const ceil = tileAt(pl.c, pl.r - 1) === '#' && tileAt(pl.c, pl.r + 1) !== '#';
    return ceil ? { x: pl.c + 0.1, y: pl.r - 0.02, w: 0.8, h: 0.25 } : { x: pl.c + 0.1, y: pl.r + 0.77, w: 0.8, h: 0.25 };
  }
  function updateSignals(dt) {
    const bodies = bodiesForPlates();
    const sig = {};
    for (const pl of L.plates) {
      const z = plateZone(pl);
      const on = bodies.some((b) => b.ground && overlap(b.box, z));
      pl.down = approach(pl.down, on ? 1 : 0, dt * 8);
      if (on) sig[pl.id] = true;
    }
    for (const lv of L.levers) if (lv.on) sig[lv.id] = true;
    L.sig = sig;
    const isOn = (by) => !by || by.some((id) => sig[id]);
    for (const g of L.gates) g.open = approach(g.open, isOn(g.by) ? 1 : 0, dt * 1.6);
    for (const m of L.movers) {
      const before = moverRect(m);
      m.t = approach(m.t, isOn(m.by) ? 1 : 0, dt * (4 / Math.max(1, Math.hypot(m.dx, m.dy))));
      const after = moverRect(m);
      const ddx = after.x - before.x, ddy = after.y - before.y;
      if (ddx || ddy) carry(before, ddx, ddy);
    }
    for (const f of L.fans) f.on = isOn(f.by);
  }
  // things standing on a moving platform ride along
  function carry(r, dx, dy) {
    for (const role of ['ember', 'tide']) {
      const p = players[role];
      if (!p || !p.local || !p.alive) continue;
      const b = boxOf(p);
      const onTop = p.g > 0 ? Math.abs(b.y + b.h - r.y) < 0.08 : Math.abs(b.y - (r.y + r.h)) < 0.08;
      if (onTop && b.x + b.w > r.x && b.x < r.x + r.w) { p.x += dx; p.y += dy; }
    }
    for (const cr of L.crates) if (Math.abs(cr.y + 1 - r.y) < 0.08 && cr.x + 1 > r.x && cr.x < r.x + r.w) { cr.x += dx; cr.y += dy; }
  }
  function inWind(p) {
    const c = center(p);
    for (const f of L.fans) if (f.on && Math.abs(c.x - (f.c + 0.5)) < 0.65 && c.y < f.r + 1 && c.y > f.top) return true;
    return false;
  }

  // ---------------------------------------------------------------- player physics
  function stepPlayer(p, inp, dt) {
    if (!p.alive) return;
    const target = ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * RUN;
    if (target) p.face = Math.sign(target);
    p.vx = approach(p.vx, target, (p.onGround ? 70 : 42) * dt);
    // he crouches (hold act, standing still) so she can jump off his hands
    p.crouch = p.role === 'tide' && p.onGround && inp.actHeld && Math.abs(p.vx) < 0.5;
    if (p.crouch) p.vx = 0;
    if (inp.jump) p.jumpBuf = BUFFER;
    p.jumpBuf -= dt; p.coyote -= dt; p.portalCd -= dt; p.padCd -= dt;
    for (const k of ['landT', 'pushT', 'useT', 'fiveT', 'boostT', 'waveT']) if (p[k] > 0) p[k] -= dt;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      const q = partnerOf(p);
      const boosted = p.role === 'ember' && q && q.alive && q.crouch && Math.abs(q.x - p.x) < 0.8 && Math.abs(q.y - p.y) < 0.6 && q.g === p.g;
      p.vy = -JUMP * p.g * (boosted ? 1.5 : 1); p.jumpBuf = 0; p.coyote = 0; p.onGround = false; puff(p, 4);
      if (boosted) { q.boostT = 0.5; ring(q.x, q.y - 0.4 * q.g, '#A2452F'); }
    }
    p.vy += GRAV * p.g * dt;
    if (!inp.jumpHeld && p.vy * p.g < 0) p.vy += GRAV * p.g * dt * 1.4;   // short hop when jump is released
    if (inWind(p)) { p.vy -= WIND * dt; if (p.vy < -WIND_MAX) p.vy = -WIND_MAX; }
    p.vy = clamp(p.vy, -24, 24);

    const steps = Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy)) * dt / 0.3) || 1;
    let grounded = false;
    for (let s = 0; s < steps; s++) {
      const box = boxOf(p);
      const rects = solids(box.x - 1, box.y - 1, box.x + box.w + 1, box.y + box.h + 1);
      const res = sweep(box, (p.vx * dt) / steps, (p.vy * dt) / steps, rects, (r, dir) => {
        if (r.crate && p.onGround) { r.crate.push = dir; p.pushT = 0.15; }   // pushing a crate
      });
      p.x = box.x + PW / 2; p.y = p.g > 0 ? box.y + PH : box.y;
      if (res.hitX) p.vx = 0;
      const landed = p.g > 0 ? res.hitDown : res.hitUp;
      const bonk = p.g > 0 ? res.hitUp : res.hitDown;
      if (landed) { if (!p.onGround && Math.abs(p.vy) > 10) { puff(p, 3); p.landT = 0.14; } grounded = true; p.vy = 0; }
      if (bonk && p.vy * p.g < 0) p.vy = 0;
    }
    p.onGround = grounded;
    if (grounded) p.coyote = COYOTE;
    p.run = p.onGround ? p.run + Math.abs(p.vx) * dt * 1.6 : p.run;

    // tether: the rope holds you when you fall, and lets you climb back
    if (L.tether) {
      const q = partnerOf(p);
      if (q && q.alive) {
        const a = center(p), b = center(q);
        const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
        const anchored = p.onGround && !q.onGround;
        if (d > L.tether && !anchored) {
          const nx = dx / d, ny = dy / d;
          const box = boxOf(p);
          sweep(box, b.x + nx * L.tether - a.x, 0, solids(box.x - 2, box.y - 2, box.x + 3, box.y + 3));
          sweep(box, 0, b.y + ny * L.tether - a.y, solids(box.x - 2, box.y - 2, box.x + 3, box.y + 3));
          p.x = box.x + PW / 2; p.y = p.g > 0 ? box.y + PH : box.y;
          const vr = p.vx * nx + p.vy * ny;
          if (vr > 0) { p.vx -= nx * vr; p.vy -= ny * vr; }
        }
        if (inp.up && !p.onGround && d > L.tether - 0.3) { p.x -= (dx / d) * 3 * dt; p.y -= (dy / d) * 3 * dt; p.vy = Math.min(p.vy, 0); }
      }
    }
    interact(p, inp, dt);
  }
  const partnerOf = (p) => players[p.role === 'ember' ? 'tide' : 'ember'];

  // touching the world: hazards, gems, springs, pads, portals, levers, ice, swap, doors
  function interact(p, inp, dt) {
    const R = ROLE[p.role];
    const box = boxOf(p), c = center(p);
    // hazards
    const probe = { x: box.x + 0.08, y: box.y - 0.06, w: box.w - 0.16, h: box.h + 0.12 };
    for (let r = Math.floor(probe.y); r <= Math.floor(probe.y + probe.h); r++) for (let col = Math.floor(probe.x); col <= Math.floor(probe.x + probe.w); col++) {
      const ch = tileAt(col, r);
      if (!isLiquid(ch) || ch === R.safe || (ch === 'W' && frozen(col, r))) continue;
      const lr = r === 0 ? { x: col, y: r, w: 1, h: 1 - LIQ } : { x: col, y: r + LIQ, w: 1, h: 1 - LIQ };
      if (overlap(probe, lr)) return die(p, ch);
    }
    if (L.rising && box.y + box.h > L.gooY + 0.2) return die(p, 'G');
    if (p.y > ROWS + 2 || p.y < -3) return die(p, 'G');

    // gems
    L.gems.forEach((gm, i) => {
      if (gm.taken || Math.hypot(gm.x - c.x, gm.y - c.y) > 0.65) return;
      if (gm.kind === 's') {
        const q = partnerOf(p), qc = q && center(q);
        if (!qc || Math.hypot(gm.x - qc.x, gm.y - qc.y) > 2.2) { hint('Bring your partner close — this one needs both of you'); return; }
      } else if (gm.kind !== R.gem) return;
      takeGem(i, true);
    });
    // springs
    for (const s of L.springs) {
      if (p.vy * p.g >= 0 && overlap(box, { x: s.c + 0.15, y: s.r + 0.55, w: 0.7, h: 0.45 })) { p.vy = -SPRING * p.g; s.t = 0.25; p.onGround = false; }
    }
    // gravity pads
    for (const pad of L.pads) {
      if (p.padCd <= 0 && p.onGround && overlap(box, { x: pad.c + 0.15, y: pad.r - 0.1, w: 0.7, h: 1.2 })) flipGravity(p, pad);
    }
    // portals
    if (p.portalCd <= 0) for (const pt of L.portals) for (const [from, to] of [[pt.a, pt.b], [pt.b, pt.a]]) {
      if (Math.hypot(from.x - c.x, from.y - c.y) < 0.55) {
        p.x = to.x; p.y = p.g > 0 ? to.y + PH / 2 : to.y - PH / 2; p.portalCd = 0.6;
        ring(from.x, from.y, pt.col); ring(to.x, to.y, pt.col);
        return;
      }
    }
    // ice walls melt under Ember
    if (p.role === 'ember') {
      const z = { x: box.x - 0.1, y: box.y + 0.05, w: box.w + 0.2, h: box.h - 0.1 };
      for (let r = Math.floor(z.y); r <= Math.floor(z.y + z.h); r++) for (let col = Math.floor(z.x); col <= Math.floor(z.x + z.w); col++) {
        if (tileAt(col, r) !== 'I') continue;
        const k = col + ',' + r, v = (L.melt.get(k) || 0) + dt;
        L.melt.set(k, v);
        if (v > 0.35) { meltIce(col, r, true); }
      }
    }
    if (inp.action) actionBy(p);
    // doors
    const d = L.doors[p.role];
    p.inDoor = !!d && p.g > 0 && p.onGround && Math.abs(p.x - (d.c + 0.5)) < 0.5 && Math.abs(p.y - (d.r + 1)) < 0.2;
  }

  function actionBy(p) {
    const box = boxOf(p), c = center(p);
    // levers
    for (const lv of L.levers) if (overlap(box, { x: lv.c, y: lv.r, w: 1, h: 1 })) { setLever(lv, !lv.on, true); p.useT = 0.4; return; }
    // swap stones: both standing on stones
    const q = partnerOf(p);
    const onStone = (pp) => pp && pp.alive && L.stones.some((s) => Math.abs(pp.x - (s.c + 0.5)) < 0.6 && Math.abs(pp.y - (s.r + 1)) < 0.25);
    if (L.stones.length && onStone(p) && onStone(q)) { doSwap(true); return; }
    if (L.stones.length && onStone(p)) { hint('Both of you need to stand on the stones'); return; }
    // Tide freezes water around her
    if (p.role === 'tide') {
      const cells = [];
      for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
        if (tileAt(col, r) === 'W' && Math.hypot(col + 0.5 - c.x, r + 0.5 - c.y) < 3.4) cells.push([col, r]);
      }
      if (cells.length) { freeze(cells, true); return; }
    }
    if (q && q.alive && Math.abs(q.x - p.x) < 1.3 && Math.abs(center(q).y - c.y) < 0.8) highFive(true);
  }
  function highFive(send) {
    const e = players.ember, t = players.tide;
    if (!L || L.fiveCd > L.t) return;
    L.fiveCd = L.t + 1; L.fives = (L.fives || 0) + 1;
    for (const p of [e, t]) { p.fiveT = 0.8; p.face = Math.sign((partnerOf(p).x - p.x) || 1); }
    ring((e.x + t.x) / 2, Math.min(center(e).y, center(t).y) - 0.4, '#A2452F');
    if (send && net === 'online') Net.send({ t: 'five' });
  }

  function flipGravity(p, pad) {
    const box = boxOf(p);
    p.g = -p.g;
    p.y = p.g > 0 ? box.y + PH : box.y;
    p.vy = -3 * p.g; p.padCd = 0.6; p.onGround = false;
    pad.t = 0.4;
    ring(pad.c + 0.5, pad.r + 0.5, '#7A5A8A');
  }

  // ---------------------------------------------------------------- shared events
  function takeGem(i, send) {
    const gm = L.gems[i];
    if (!gm || gm.taken) return;
    gm.taken = true;
    ring(gm.x, gm.y, gm.kind === 'e' ? ROLE.ember.col : gm.kind === 't' ? ROLE.tide.col : '#A2452F');
    if (send && net === 'online') Net.send({ t: 'gem', i });
  }
  function setLever(lv, on, send) {
    lv.on = on;
    ring(lv.c + 0.5, lv.r + 0.6, SIG_COL[lv.id] || GRAPHITE);
    if (send && net === 'online') Net.send({ t: 'lever', c: lv.c, r: lv.r, on });
  }
  function meltIce(col, r, send) {
    if (tileAt(col, r) !== 'I') return;
    L.tiles[r][col] = ' ';
    L.dirty = true;
    for (let i = 0; i < 6; i++) L.fx.push({ kind: 'drop', x: col + Math.random(), y: r + Math.random(), vy: -2 - Math.random() * 3, t: 0 });
    if (send && net === 'online') Net.send({ t: 'melt', c: col, r });
  }
  function freeze(cells, send) {
    for (const [col, r] of cells) L.frozen.set(col + ',' + r, L.t + 10);
    const mid = cells[Math.floor(cells.length / 2)];
    ring(mid[0] + 0.5, mid[1] + 0.3, '#9FB8C8');
    if (send && net === 'online') Net.send({ t: 'freeze', cells });
  }
  function doSwap(send) {
    const e = players.ember, t = players.tide;
    if (net === 'local') {
      const a = { x: e.x, y: e.y, g: e.g };
      e.x = t.x; e.y = t.y; e.g = t.g; t.x = a.x; t.y = a.y; t.g = a.g;
    } else {
      const me = players[myRole], q = partnerOf(me);
      if (send) Net.send({ t: 'swap', x: me.x, y: me.y, g: me.g });
      me.x = q.x; me.y = q.y; me.g = q.g;
    }
    for (const s of L.stones) ring(s.c + 0.5, s.r + 0.5, '#7A5A8A');
  }
  function die(p, cause) {
    if (L.dead > 0) return;
    p.alive = false;
    L.dead = 1.3; L.deaths++;
    scribble(center(p).x, center(p).y);
    const who = ROLE[p.role].name;
    hint(cause === 'G' ? `${who} stepped into the shadow` : cause === 'L' ? `${who} slipped into the amber` : `${who} slipped into the blue`);
    if (net === 'online' && p.local) Net.send({ t: 'die', role: p.role, cause });
  }
  function emote(role, e, send) {
    const p = players[role];
    if (p) { p.emo = { e, t: 2.2 }; p.waveT = 1.1; }
    if (send && net === 'online') Net.send({ t: 'emo', e });
  }

  // ---------------------------------------------------------------- crates (host simulates)
  function stepCrates(dt) {
    if (net === 'online' && !isHost) { for (const cr of L.crates) cr.push = 0; return; }
    // the remote partner can push too
    if (net === 'online') {
      const q = players[myRole === 'ember' ? 'tide' : 'ember'];
      if (q && q.alive && q.onGround && Math.abs(q.vx) > 0.5) {
        const b = boxOf(q);
        for (const cr of L.crates) {
          const touching = b.y + b.h > cr.y + 0.1 && b.y < cr.y + 1 - 0.1;
          if (touching && q.vx > 0 && Math.abs(b.x + b.w - cr.x) < 0.12) cr.push = 1;
          if (touching && q.vx < 0 && Math.abs(b.x - (cr.x + 1)) < 0.12) cr.push = -1;
        }
      }
    }
    for (const cr of L.crates) {
      cr.vx = cr.push ? cr.push * 3.4 : approach(cr.vx, 0, dt * 30);
      cr.push = 0;
      cr.vy = clamp(cr.vy + GRAV * dt, -20, 20);
      const box = { x: cr.x, y: cr.y, w: 1, h: 1 };
      const rects = solids(cr.x - 1, cr.y - 1, cr.x + 2, cr.y + 2, cr);
      const res = sweep(box, cr.vx * dt, cr.vy * dt, rects);
      cr.x = box.x; cr.y = box.y;
      if (res.hitDown || res.hitUp) cr.vy = 0;
      if (res.hitX) cr.vx = 0;
    }
  }

  // ---------------------------------------------------------------- remote player
  function updateRemote(now) {
    if (net !== 'online') return;
    const q = players[myRole === 'ember' ? 'tide' : 'ember'];
    if (!q || !q.snaps.length) return;
    const s = q.snaps, rt = now - 100;
    while (s.length > 2 && s[1].t <= rt) s.shift();
    const a = s[0], b = s[1];
    if (b && a.t <= rt && rt <= b.t) {
      const k = (rt - a.t) / (b.t - a.t || 1);
      q.x = lerp(a.x, b.x, k); q.y = a.g === b.g ? lerp(a.y, b.y, k) : b.y;
    } else { const l = s[s.length - 1]; q.x = l.x; q.y = l.y; }
    const l = s[s.length - 1];
    q.vx = l.vx; q.vy = l.vy; q.g = l.g; q.face = l.f; q.onGround = l.og; q.run = l.run; q.alive = l.al !== 0;
    q.inDoor = l.d; q.pz = l.pz; q.crouch = l.pz === 'boost|S';
  }

  // ---------------------------------------------------------------- tick
  let last = performance.now(), sendT = 0, paused = false, winT = 0;
  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (screen === 'play' && L && !paused) {
      if (L.won) { L.arriveT = Math.max(0, (L.arriveT || 0) - dt); for (const k in pressed) delete pressed[k]; render(now / 1000); requestAnimationFrame(tick); return; }
      L.t += dt;
      if (L.rising) L.gooY = ROWS + 0.6 - Math.max(0, L.t - L.rising.start) * L.rising.speed;
      updateRemote(now);
      updateSignals(dt);
      for (const role of ['ember', 'tide']) {
        const p = players[role];
        if (p.local && L.dead <= 0) stepPlayer(p, inputFor(role), dt);
        if (p.emo) { p.emo.t -= dt; if (p.emo.t <= 0) p.emo = null; }
      }
      stepCrates(dt);
      for (const s of L.springs) s.t = Math.max(0, s.t - dt);
      for (const pd of L.pads) pd.t = Math.max(0, pd.t - dt);
      if (L.dead > 0) { L.dead -= dt; if (L.dead <= 0) restartLevel(false); }
      // both at their doors
      if (!L.won && L.dead <= 0 && players.ember.inDoor && players.tide.inDoor) {
        if (net === 'local' || isHost) {
          winT += dt;
          if (winT > 0.35) { L.arriveT = 1.2; win(true); }
        }
      } else winT = 0;
      // network
      if (net === 'online' && now - sendT > 50) {
        sendT = now;
        const p = players[myRole];
        Net.send({ t: 'p', pz: poseOf(p).join('|'), x: +p.x.toFixed(3), y: +p.y.toFixed(3), vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2), g: p.g, f: p.face, og: p.onGround, run: +p.run.toFixed(2), al: p.alive ? 1 : 0, d: p.inDoor });
        if (isHost && L.crates.length) Net.send({ t: 'crates', c: L.crates.map((c) => [+c.x.toFixed(3), +c.y.toFixed(3)]) });
      }
      updateHud();
      for (const k in pressed) delete pressed[k];
    } else for (const k in pressed) delete pressed[k];
    render(now / 1000);
    requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- result
  function win(send) {
    if (L.won) return;
    L.won = true;
    L.arriveT = 1.2;
    const gemsE = L.gems.filter((g) => g.kind === 'e'), gemsT = L.gems.filter((g) => g.kind === 't'), sec = L.gems.find((g) => g.kind === 's');
    const allGems = gemsE.every((g) => g.taken) && gemsT.every((g) => g.taken);
    const stars = 1 + (allGems ? 1 : 0) + (L.t <= L.def.par ? 1 : 0);
    const res = { i: levelIdx, time: L.t, deaths: L.deaths, stars, gems: [gemsE.filter((g) => g.taken).length + gemsT.filter((g) => g.taken).length, gemsE.length + gemsT.length], secret: sec ? sec.taken : null };
    if (send && net === 'online') Net.send({ t: 'win', res });
    setTimeout(() => showResult(res), 1300);
  }
  function showResult(res) {
    screen = 'result';
    progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, res.i + 2));
    progress.stars[res.i] = Math.max(progress.stars[res.i] || 0, res.stars);
    store.set('duo.progress', progress);
    $('resKicker').textContent = `LEVEL ${res.i + 1} · ${LEVELS[res.i].name.toUpperCase()}`;
    $('resStars').textContent = '★'.repeat(res.stars) + '☆'.repeat(3 - res.stars);
    $('resTime').textContent = fmt(res.time);
    $('resGems').textContent = `${res.gems[0]} / ${res.gems[1]}` + (res.secret === true ? ' + secret' : '');
    $('resDeaths').textContent = String(res.deaths);
    $('resPar').textContent = `par ${fmt(LEVELS[res.i].par)}`;
    $('nextBtn').classList.toggle('hidden', res.i + 1 >= LEVELS.length);
    showOnly('result');
  }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ---------------------------------------------------------------- HUD
  function updateHud() {
    $('clock').textContent = fmt(L.t);
    const cnt = (k) => `${L.gems.filter((g) => g.kind === k && g.taken).length}/${L.gems.filter((g) => g.kind === k).length}`;
    $('gemE').textContent = cnt('e');
    $('gemT').textContent = cnt('t');
    $('deaths').textContent = L.deaths;
  }
  let hintTimer = 0;
  function hint(text) {
    $('hint').textContent = text;
    $('hint').classList.add('on');
    clearTimeout(hintTimer); hintTimer = setTimeout(() => $('hint').classList.remove('on'), 2600);
  }
  function togglePause() {
    paused = !paused;
    $('pause').classList.toggle('hidden', !paused);
  }

  // ---------------------------------------------------------------- effects
  function ring(x, y, col) { L.fx.push({ kind: 'ring', x, y, col, t: 0 }); }
  function scribble(x, y) { L.fx.push({ kind: 'scribble', x, y, t: 0, seed: Math.random() * 1000 }); }
  function puff(p, n) { for (let i = 0; i < n; i++) L.fx.push({ kind: 'dust', x: p.x + (Math.random() - 0.5) * 0.5, y: p.y, vx: (Math.random() - 0.5) * 2, t: 0 }); }

  // ---------------------------------------------------------------- rendering
  const canvas = $('stage'), ctx = canvas.getContext('2d');
  const overlay = $('overlay'), octx = overlay.getContext('2d');
  let W = 0, H = 0, DPR = 1, K = 30, OX = 0, OY = 0;
  // camera: frames both of you, leans in when you are close (up to ZMAX), shows the whole room when apart
  let K0 = 30, KS = 30, camX = COLS / 2, camY = ROWS / 2, zoom = 1;
  const ZMAX = 1.8;
  function resize() {
    DPR = Math.min(2, devicePixelRatio || 1);
    W = Math.round(innerWidth * DPR); H = Math.round(innerHeight * DPR);
    canvas.width = W; canvas.height = H; overlay.width = W; overlay.height = H;
    K0 = Math.min(W / (COLS + 1), (H - 150 * DPR) / (ROWS + 0.5));
    KS = Math.ceil(K0 * ZMAX);
    K = K0;
    makeOverlay();
    if (L) L.dirty = true;
  }
  addEventListener('resize', resize);

  function mulberry(a) {
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // irregular wash outlines (low harmonics shape the wash, high ones make the dry edge)
  function blob(seed, amp, n = 110) {
    const rnd = mulberry(seed);
    const harm = Array.from({ length: 10 }, (_, i) => ({ k: 2 + i * 2 + Math.floor(rnd() * 2), a: amp * (0.9 / (i + 1)) * (0.55 + rnd() * 0.7), ph: rnd() * Math.PI * 2 }));
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      let r = 1;
      for (const h of harm) r += h.a * Math.sin(h.k * t + h.ph);
      r += (rnd() - 0.5) * amp * 0.35;
      out.push([Math.cos(t) * r, Math.sin(t) * r]);
    }
    return out;
  }
  const ISLANDS = Array.from({ length: 8 }, (_, i) => ({ outer: blob(101 + i * 17, 0.12), core: blob(307 + i * 11, 0.085) }));
  function islandPath(pts, cx, cy, rx, ry) {
    const p = new Path2D();
    pts.forEach((q, i) => (i ? p.lineTo(cx + q[0] * rx, cy + q[1] * ry) : p.moveTo(cx + q[0] * rx, cy + q[1] * ry)));
    p.closePath();
    return p;
  }

  // the level exists twice: a pencil drawing and a gouache painting
  const graphite = document.createElement('canvas'), paint = document.createElement('canvas');
  function buildStatic() {
    const K = KS;   // the room is drawn once at the closest zoom, then scaled
    const w = COLS * K, h = ROWS * K;
    graphite.width = paint.width = w; graphite.height = paint.height = h;
    const g = graphite.getContext('2d'), p = paint.getContext('2d');
    const rnd = mulberry(levelIdx * 97 + 13);
    const S = (v) => v * K;
    const solidAt = (c, r) => tileAt(c, r) === '#';

    // ---- paint
    const bg = p.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#CFC4AF'); bg.addColorStop(1, '#B9AD97');
    p.fillStyle = bg; p.fillRect(0, 0, w, h);
    // a window of light high on the back wall
    p.fillStyle = 'rgba(236,230,214,.55)';
    for (let i = 0; i < 3; i++) p.fillRect(S(5 + i * 9), S(2), S(3), S(4));
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ch = tileAt(c, r);
      if (ch === '#') {
        p.fillStyle = '#7E7A72'; p.fillRect(S(c), S(r), K + 1, K + 1);
        if (!solidAt(c, r - 1) && !isLiquid(tileAt(c, r - 1))) { p.fillStyle = '#A79C88'; p.fillRect(S(c), S(r), K + 1, S(0.18)); }
        if (!solidAt(c, r + 1)) { p.fillStyle = '#5E5A54'; p.fillRect(S(c), S(r + 0.85), K + 1, S(0.15)); }
      } else if (isLiquid(ch)) {
        const col = LIQ_COL[ch];
        p.fillStyle = '#7E7A72'; p.fillRect(S(c), S(r), K + 1, K + 1);
        if (r === 0) { p.fillStyle = col[0]; p.fillRect(S(c), S(r), K + 1, S(1 - LIQ)); p.fillStyle = col[1]; p.fillRect(S(c), S(1 - LIQ - 0.12), K + 1, S(0.12)); }
        else { p.fillStyle = col[0]; p.fillRect(S(c), S(r + LIQ), K + 1, S(1 - LIQ)); p.fillStyle = col[1]; p.fillRect(S(c), S(r + LIQ), K + 1, S(0.12)); }
      }
    }
    for (const role of ['ember', 'tide']) {
      const d = L.doors[role];
      if (!d) continue;
      p.fillStyle = ROLE[role].ink;
      doorPath(p, S(d.c + 0.08), S(d.r - 0.95), S(0.84), S(1.95)); p.fill();
      p.fillStyle = '#2E2925';
      doorPath(p, S(d.c + 0.2), S(d.r - 0.78), S(0.6), S(1.78)); p.fill();
    }
    const fade = p.createLinearGradient(0, 0, 0, S(1.4));
    fade.addColorStop(0, 'rgba(40,36,30,.2)'); fade.addColorStop(1, 'rgba(40,36,30,0)');
    p.fillStyle = fade; p.fillRect(0, S(1), w, S(1.4));

    // ---- graphite
    g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
    g.strokeStyle = GRAPHITE; g.lineCap = 'round';
    const line = (x0, y0, x1, y1, lw, a) => {
      g.globalAlpha = a; g.lineWidth = lw * DPR;
      g.beginPath(); g.moveTo(x0, y0);
      g.quadraticCurveTo((x0 + x1) / 2 + (rnd() - 0.5) * 1.6 * DPR, (y0 + y1) / 2 + (rnd() - 0.5) * 1.6 * DPR, x1, y1);
      g.stroke();
    };
    for (let c = 0; c <= COLS; c += 2) line(S(c), 0, S(c), h, 0.6, 0.1);
    for (let r = 0; r <= ROWS; r += 2) line(0, S(r), w, S(r), 0.6, 0.1);
    for (let i = 0; i < 3; i++) { const x = S(5 + i * 9), y = S(2); line(x, y, x + S(3), y, 0.9, 0.4); line(x + S(3), y, x + S(3), y + S(4), 0.9, 0.4); line(x + S(3), y + S(4), x, y + S(4), 0.9, 0.4); line(x, y + S(4), x, y, 0.9, 0.4); line(x + S(1.5), y, x + S(1.5), y + S(4), 0.7, 0.25); }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ch = tileAt(c, r);
      if (ch !== '#' && !isLiquid(ch)) continue;
      const x = S(c), y = S(r);
      const top = r === 0 || isLiquid(ch) ? false : !solidAt(c, r - 1);
      if (!solidAt(c, r - 1) && !(isLiquid(ch) && r === 0)) line(x, y + (isLiquid(ch) && r > 0 ? S(LIQ) : 0), x + K, y + (isLiquid(ch) && r > 0 ? S(LIQ) : 0), top ? 1.2 : 1, 0.75);
      if (!solidAt(c, r + 1) && !isLiquid(tileAt(c, r + 1))) line(x, y + K, x + K, y + K, 1, 0.6);
      if (!solidAt(c - 1, r) && !isLiquid(tileAt(c - 1, r))) line(x, y, x, y + K, 1, 0.6);
      if (!solidAt(c + 1, r) && !isLiquid(tileAt(c + 1, r))) line(x + K, y, x + K, y + K, 1, 0.6);
      // hatching inside the masses
      for (let k = 0.2; k < 1; k += 0.32) line(x + S(k), y + K - S(0.05), x + S(k) + S(0.18), y + S(0.55), 0.6, 0.18);
      if (isLiquid(ch) && r > 0) {
        for (let k = 0; k < 2; k++) { const yy = y + S(LIQ + 0.18 + k * 0.2); g.globalAlpha = 0.35; g.lineWidth = 0.7 * DPR; g.beginPath(); for (let u = 0; u <= 1.001; u += 0.25) g.lineTo(x + S(u), yy + Math.sin(u * 6 + c) * S(0.04)); g.stroke(); }
      }
    }
    for (const role of ['ember', 'tide']) {
      const d = L.doors[role];
      if (!d) continue;
      g.globalAlpha = 0.75; g.lineWidth = 1.1 * DPR; doorPath(g, S(d.c + 0.08), S(d.r - 0.95), S(0.84), S(1.95)); g.stroke();
      g.globalAlpha = 0.5; doorPath(g, S(d.c + 0.2), S(d.r - 0.78), S(0.6), S(1.78)); g.stroke();
      g.globalAlpha = 0.8; g.fillStyle = ROLE[role].ink;
      g.font = `600 ${Math.round(K * 0.32)}px "IBM Plex Mono", monospace`; g.textAlign = 'center';
      g.fillText(role === 'ember' ? 'SHE' : 'HE', S(d.c + 0.5), S(d.r - 1.1));
    }
    g.globalAlpha = 1;
    L.dirty = false;
  }
  function doorPath(c, x, y, w, h) {
    c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, y + h); c.closePath();
  }

  function makeOverlay() {
    const id = octx.createImageData(W, H);
    for (let i = 0; i < id.data.length; i += 4) { const n = Math.random(); id.data[i] = 60; id.data[i + 1] = 50; id.data[i + 2] = 38; id.data[i + 3] = n < 0.5 ? n * 30 : 0; }
    octx.putImageData(id, 0, 0);
    const vg = octx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(228,218,198,0)'); vg.addColorStop(1, 'rgba(228,218,198,0.85)');
    octx.fillStyle = vg; octx.fillRect(0, 0, W, H);
  }

  const X = (x) => OX + x * K, Y = (y) => OY + y * K;
  let camLast = 0;
  function updateCamera() {
    const now = performance.now(), dt = Math.min(0.05, (now - camLast) / 1000 || 0.016);
    camLast = now;
    const ps = ['ember', 'tide'].map((r) => players[r]).filter(Boolean);
    let x0 = COLS, x1 = 0, y0 = ROWS, y1 = 0;
    for (const p of ps) { const c = center(p); x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y); }
    const viewH = H - 120 * DPR;
    const zFit = Math.min(W / ((x1 - x0 + 14) * K0), viewH / ((y1 - y0 + 8) * K0));
    const zt = clamp(zFit, 1, ZMAX);
    zoom = lerp(zoom, zt, 1 - Math.exp(-2.5 * dt));
    K = K0 * zoom;
    const halfW = W / 2 / K, halfH = viewH / 2 / K;
    const tx = clamp((x0 + x1) / 2, Math.min(halfW, COLS / 2), Math.max(COLS - halfW, COLS / 2));
    const ty = clamp((y0 + y1) / 2, Math.min(halfH - 0.5, ROWS / 2), Math.max(ROWS - halfH + 0.5, ROWS / 2));
    camX = lerp(camX, tx, 1 - Math.exp(-4 * dt)); camY = lerp(camY, ty, 1 - Math.exp(-4 * dt));
    OX = W / 2 - camX * K; OY = 50 * DPR + viewH / 2 - camY * K;
  }
  function render(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    if (!L) return;
    if (L.dirty || graphite.width !== COLS * KS) buildStatic();
    updateCamera();
    ctx.drawImage(graphite, OX, OY, COLS * K, ROWS * K);

    // attention islands: around both of you, your doors, and whatever is working right now
    const isl = [];
    const ce = players.ember && center(players.ember), ct = players.tide && center(players.tide);
    if (ce && ct && Math.hypot(ce.x - ct.x, ce.y - ct.y) < 1.8) isl.push({ x: (ce.x + ct.x) / 2, y: (ce.y + ct.y) / 2, rx: 5.6, ry: 4, seed: 0 });   // together: the light is shared
    else for (const role of ['ember', 'tide']) { const p = players[role]; if (p) { const c = center(p); isl.push({ x: c.x, y: c.y, rx: 4.3, ry: 3.4, seed: role === 'ember' ? 0 : 1 }); } }
    for (const role of ['ember', 'tide']) { const d = L.doors[role]; if (d) isl.push({ x: d.c + 0.5, y: d.r, rx: players[role] && players[role].inDoor ? 2.4 : 1.5, ry: 1.9, seed: role === 'ember' ? 2 : 3 }); }
    for (const pl of L.plates) if (pl.down > 0.5) isl.push({ x: pl.c + 0.5, y: pl.r + 0.6, rx: 1.4, ry: 1.1, seed: 4 });
    for (const g of L.gates) if (g.open > 0.05) isl.push({ x: g.x + g.w / 2, y: g.y + g.h / 2, rx: 1.6, ry: g.h * 0.6 + 0.8, seed: 5 });
    for (const m of L.movers) if (m.t > 0.02 && m.t < 0.98) { const r = moverRect(m); isl.push({ x: r.x + r.w / 2, y: r.y, rx: r.w * 0.6 + 0.8, ry: 1.4, seed: 6 }); }
    for (const lv of L.levers) if (lv.on) isl.push({ x: lv.c + 0.5, y: lv.r + 0.5, rx: 1.3, ry: 1.1, seed: 7 });
    const ell = isl.map((e) => ({ cx: X(e.x), cy: Y(e.y), rx: e.rx * K, ry: e.ry * K, seed: e.seed }));
    const paintClip = (paths, alpha) => {
      ctx.save();
      const u = new Path2D();
      for (const pp of paths) u.addPath(pp);
      ctx.clip(u);
      ctx.globalAlpha = alpha;
      ctx.drawImage(paint, OX, OY, COLS * K, ROWS * K);
      ctx.restore();
    };
    const outers = ell.map((e) => islandPath(ISLANDS[e.seed % 8].outer, e.cx, e.cy, e.rx * 1.08, e.ry * 1.08));
    const cores = ell.map((e) => islandPath(ISLANDS[e.seed % 8].core, e.cx, e.cy, e.rx * 0.94, e.ry * 0.94));
    paintClip(outers, 0.45);
    paintClip(cores, 1);
    ctx.save();
    ctx.strokeStyle = 'rgba(42,36,29,0.12)'; ctx.lineWidth = Math.max(3, K * 0.11); ctx.lineJoin = 'round';
    for (const c of cores) { ctx.save(); ctx.clip(c); ctx.stroke(c); ctx.restore(); }
    ctx.restore();
    const paintAt = (x, y) => {
      const sx = X(x), sy = Y(y);
      let best = 0;
      for (const e of ell) { const d = Math.hypot((sx - e.cx) / e.rx, (sy - e.cy) / e.ry); best = Math.max(best, 1 - Math.min(1, Math.max(0, (d - 0.55) / 0.4))); }
      return best;
    };

    drawLiquids(t);
    drawFrozen(t);
    drawIce(paintAt);
    for (const f of L.fans) drawFan(f, t, paintAt);
    for (const pt of L.portals) { drawPortal(pt.a, pt.col, t); drawPortal(pt.b, pt.col, t); }
    for (const pl of L.plates) drawPlate(pl, paintAt);
    for (const lv of L.levers) drawLever(lv, paintAt);
    for (const s of L.springs) drawSpring(s, paintAt);
    for (const pd of L.pads) drawPad(pd, t);
    for (const s of L.stones) drawStone(s, paintAt);
    for (const g of L.gates) drawSlab(gateRect(g), '#5B5650', paintAt, g.by, true);
    for (const m of L.movers) drawSlab(moverRect(m), '#8A8F94', paintAt, m.by, false);
    for (const cr of L.crates) drawCrate(cr, paintAt);
    L.gems.forEach((gm) => { if (!gm.taken) drawGem(gm, t); });
    if (L.tether) drawRope();
    for (const role of ['tide', 'ember']) if (players[role]) drawFigure(players[role], t);
    if (L.rising) drawGoo(t);
    drawFx(t);
  }

  function pencil(lw = 1, a = 0.7) { ctx.strokeStyle = GRAPHITE; ctx.globalAlpha = a; ctx.lineWidth = lw * DPR; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
  function wash(col, a) { ctx.globalAlpha = a; ctx.fillStyle = col; }

  function drawSlab(r, col, paintAt, by, gate) {
    const x = X(r.x), y = Y(r.y), w = r.w * K, h = r.h * K;
    const pa = 0.25 + 0.75 * paintAt(r.x + r.w / 2, r.y + r.h / 2);
    wash(col, pa); ctx.fillRect(x, y, w, h);
    wash('#A79C88', pa); ctx.fillRect(x, y, w, Math.min(h, K * 0.12));
    pencil(1.1, 0.8); ctx.strokeRect(x, y, w, h);
    if (gate) { pencil(0.8, 0.4); for (let k = 0.3; k < r.w; k += 0.35) { ctx.beginPath(); ctx.moveTo(x + k * K, y + 2); ctx.lineTo(x + k * K, y + h - 2); ctx.stroke(); } }
    if (by) by.forEach((id, i) => { ctx.globalAlpha = 1; ctx.fillStyle = SIG_COL[id] || GRAPHITE; ctx.beginPath(); ctx.arc(x + w / 2 + (i - (by.length - 1) / 2) * K * 0.3, y + Math.min(h, K) * 0.5, K * 0.09, 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1;
  }
  function drawCrate(cr, paintAt) {
    const x = X(cr.x), y = Y(cr.y);
    const pa = 0.3 + 0.7 * paintAt(cr.x + 0.5, cr.y + 0.5);
    wash('#9A6B42', pa); ctx.fillRect(x + 1, y + 1, K - 2, K - 2);
    wash('#B98A5A', pa); ctx.fillRect(x + 1, y + 1, K - 2, K * 0.14);
    pencil(1.1, 0.85); ctx.strokeRect(x + 1, y + 1, K - 2, K - 2);
    pencil(0.9, 0.55); ctx.beginPath(); ctx.moveTo(x + K * 0.12, y + K * 0.12); ctx.lineTo(x + K * 0.88, y + K * 0.88); ctx.moveTo(x + K * 0.88, y + K * 0.12); ctx.lineTo(x + K * 0.12, y + K * 0.88); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function drawPlate(pl, paintAt) {
    const z = plateZone(pl);
    const ceil = z.y < pl.r + 0.5;
    const hh = K * (0.16 - 0.1 * pl.down);
    const x = X(pl.c + 0.12), w = K * 0.76;
    const y = ceil ? Y(pl.r) : Y(pl.r + 1) - hh;
    wash(SIG_COL[pl.id], 0.35 + 0.65 * Math.max(pl.down, paintAt(pl.c + 0.5, pl.r + 0.8)));
    ctx.fillRect(x, y, w, hh);
    pencil(1, 0.8); ctx.strokeRect(x, y, w, hh);
    ctx.globalAlpha = 1;
  }
  function drawLever(lv, paintAt) {
    const bx = X(lv.c + 0.5), by = Y(lv.r + 1);
    const a = (lv.on ? 0.6 : -0.6);
    wash('#5B5650', 0.5 + 0.5 * paintAt(lv.c + 0.5, lv.r + 0.5));
    ctx.beginPath(); ctx.arc(bx, by, K * 0.26, Math.PI, 0); ctx.fill();
    pencil(1.6, 0.85); ctx.beginPath(); ctx.moveTo(bx, by - K * 0.1); ctx.lineTo(bx + Math.sin(a) * K * 0.7, by - Math.cos(a) * K * 0.7); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = SIG_COL[lv.id]; ctx.beginPath(); ctx.arc(bx + Math.sin(a) * K * 0.72, by - Math.cos(a) * K * 0.72, K * 0.12, 0, 7); ctx.fill();
    pencil(1, 0.7); ctx.beginPath(); ctx.arc(bx, by, K * 0.26, Math.PI, 0); ctx.stroke(); ctx.globalAlpha = 1;
  }
  function drawSpring(s, paintAt) {
    const x = X(s.c + 0.5), y = Y(s.r + 1);
    const hh = K * (0.45 - 0.25 * Math.sin((s.t / 0.25) * Math.PI));
    pencil(1.2, 0.8); ctx.beginPath();
    for (let i = 0; i <= 6; i++) ctx.lineTo(x + (i % 2 ? 0.25 : -0.25) * K, y - (i / 6) * hh);
    ctx.stroke();
    wash('#C58A3E', 0.4 + 0.6 * paintAt(s.c + 0.5, s.r + 0.5)); ctx.fillRect(x - K * 0.35, y - hh - K * 0.1, K * 0.7, K * 0.12);
    pencil(1, 0.8); ctx.strokeRect(x - K * 0.35, y - hh - K * 0.1, K * 0.7, K * 0.12); ctx.globalAlpha = 1;
  }
  function drawPad(pd, t) {
    const ceil = tileAt(pd.c, pd.r - 1) === '#' && tileAt(pd.c, pd.r + 1) !== '#';
    const x = X(pd.c + 0.5), y = ceil ? Y(pd.r) : Y(pd.r + 1);
    wash('#7A5A8A', 0.85); ctx.beginPath(); ctx.ellipse(x, y, K * 0.42, K * 0.12, 0, 0, 7); ctx.fill();
    pencil(1, 0.7); ctx.stroke();
    // arrows hint which way you'll fall
    pencil(1.2, 0.55 + 0.3 * Math.sin(t * 4));
    const dir = ceil ? 1 : -1;
    for (const k of [0.4, 0.75]) { ctx.beginPath(); ctx.moveTo(x - K * 0.15, y + dir * K * (k - 0.1)); ctx.lineTo(x, y + dir * K * k); ctx.lineTo(x + K * 0.15, y + dir * K * (k - 0.1)); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  function drawStone(s, paintAt) {
    const x = X(s.c + 0.5), y = Y(s.r + 1);
    wash('#9A93A8', 0.4 + 0.6 * paintAt(s.c + 0.5, s.r + 0.5)); ctx.beginPath(); ctx.ellipse(x, y - K * 0.08, K * 0.45, K * 0.14, 0, 0, 7); ctx.fill();
    pencil(1, 0.75); ctx.stroke();
    pencil(1, 0.6); ctx.beginPath(); ctx.moveTo(x - K * 0.15, y - K * 0.08); ctx.lineTo(x + K * 0.15, y - K * 0.08); ctx.moveTo(x, y - K * 0.16); ctx.lineTo(x, y); ctx.stroke(); ctx.globalAlpha = 1;
  }
  function drawPortal(pt, col, t) {
    const x = X(pt.x), y = Y(pt.y);
    for (let i = 0; i < 3; i++) {
      wash(col, 0.25 + i * 0.12); ctx.beginPath(); ctx.ellipse(x, y, K * (0.5 - i * 0.12), K * (0.75 - i * 0.16), 0, 0, 7); ctx.fill();
    }
    pencil(1, 0.7);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y, K * (0.52 - i * 0.13), K * (0.78 - i * 0.18), 0, t * (1.5 + i) , t * (1.5 + i) + 4.5); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  function drawFan(f, t, paintAt) {
    const x = X(f.c + 0.5), y = Y(f.r + 1);
    wash('#5B5650', 0.5 + 0.5 * paintAt(f.c + 0.5, f.r + 0.5)); ctx.fillRect(x - K * 0.45, y - K * 0.25, K * 0.9, K * 0.25);
    pencil(1, 0.8); ctx.strokeRect(x - K * 0.45, y - K * 0.25, K * 0.9, K * 0.25);
    if (f.by) { ctx.globalAlpha = 1; ctx.fillStyle = SIG_COL[f.by[0]]; ctx.beginPath(); ctx.arc(x, y - K * 0.12, K * 0.08, 0, 7); ctx.fill(); }
    if (!f.on) { ctx.globalAlpha = 1; return; }
    // wind: pencil streaks rising up the column
    for (let i = 0; i < 7; i++) {
      const ph = (t * 1.6 + i / 7) % 1;
      const yy = lerp(f.r + 0.6, f.top, ph), xx = f.c + 0.5 + Math.sin(i * 2.3 + t * 3) * 0.32;
      pencil(0.9, 0.45 * Math.sin(ph * Math.PI));
      ctx.beginPath(); ctx.moveTo(X(xx), Y(yy)); ctx.lineTo(X(xx), Y(yy - 0.6)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function drawIce(paintAt) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (tileAt(c, r) !== 'I') continue;
      const m = L.melt.get(c + ',' + r) || 0;
      const x = X(c), y = Y(r);
      wash('#BCD3DE', (0.55 + 0.45 * paintAt(c + 0.5, r + 0.5)) * (1 - m * 1.5)); ctx.fillRect(x, y, K, K);
      wash('#E4EEF2', 0.6); ctx.fillRect(x + K * 0.1, y + K * 0.1, K * 0.18, K * 0.5);
      pencil(1, 0.7); ctx.strokeRect(x, y, K, K);
      pencil(0.8, 0.45); ctx.beginPath(); ctx.moveTo(x + K * 0.6, y); ctx.lineTo(x + K * 0.45, y + K * 0.45); ctx.lineTo(x + K * 0.75, y + K * 0.7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  // pools are always shown in colour: you must see which one is yours
  function drawLiquids(t) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ch = tileAt(c, r);
      if (!isLiquid(ch) || (ch === 'W' && frozen(c, r))) continue;
      const col = LIQ_COL[ch];
      const top = r === 0 ? r : r + LIQ, h = 1 - LIQ;
      wash(col[0], 0.78); ctx.fillRect(X(c), Y(top), K + 1, h * K);
      wash(col[1], 0.9);
      ctx.beginPath(); ctx.moveTo(X(c), Y(r === 0 ? top + h : top));
      for (let u = 0; u <= 1.001; u += 0.25) ctx.lineTo(X(c + u), Y((r === 0 ? top + h : top) + Math.sin(t * 2.2 + (c + u) * 3) * 0.035));
      ctx.lineTo(X(c + 1), Y(r === 0 ? top + h - 0.1 : top + 0.1)); ctx.lineTo(X(c), Y(r === 0 ? top + h - 0.1 : top + 0.1)); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawFrozen(t) {
    for (const [k, until] of L.frozen) {
      if (until <= L.t) continue;
      const [c, r] = k.split(',').map(Number);
      const left = until - L.t;
      const flick = left < 2 ? 0.5 + 0.5 * Math.sin(t * 20) : 1;
      wash('#D7E6EC', 0.9 * flick); ctx.fillRect(X(c), Y(r + LIQ - 0.05), K + 1, K * 0.3);
      pencil(0.8, 0.6 * flick); ctx.beginPath(); ctx.moveTo(X(c), Y(r + LIQ - 0.05)); ctx.lineTo(X(c + 1), Y(r + LIQ - 0.05)); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  function drawGem(gm, t) {
    const x = X(gm.x), y = Y(gm.y) + Math.sin(t * 2.4 + gm.x) * K * 0.06;
    const col = gm.kind === 'e' ? ROLE.ember.col : gm.kind === 't' ? ROLE.tide.col : '#A2452F';
    const s = K * (gm.kind === 's' ? 0.3 : 0.24);
    wash(col, 0.95); ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.8, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.8, y); ctx.closePath(); ctx.fill();
    wash('#F4EFE5', 0.6); ctx.beginPath(); ctx.moveTo(x - s * 0.2, y - s * 0.55); ctx.lineTo(x + s * 0.15, y - s * 0.1); ctx.lineTo(x - s * 0.35, y); ctx.closePath(); ctx.fill();
    pencil(1, 0.8); ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.8, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.8, y); ctx.closePath(); ctx.stroke();
    if (gm.kind === 's') { pencil(0.8, 0.4 + 0.3 * Math.sin(t * 3)); ctx.beginPath(); ctx.arc(x, y, s * 1.7, 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  function drawRope() {
    const a = center(players.ember), b = center(players.tide);
    const d = Math.hypot(a.x - b.x, a.y - b.y), sag = Math.max(0, L.tether - d) * 0.5;
    ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.quadraticCurveTo(X((a.x + b.x) / 2), Y((a.y + b.y) / 2 + sag), X(b.x), Y(b.y));
    pencil(1.4, 0.7); ctx.stroke();
    ctx.strokeStyle = '#A5442E'; ctx.globalAlpha = 0.6; ctx.lineWidth = 0.8 * DPR; ctx.stroke(); ctx.globalAlpha = 1;
  }
  function drawGoo(t) {
    const y = Y(L.gooY);
    if (y > OY + ROWS * K) return;
    ctx.save(); ctx.beginPath(); ctx.rect(OX, OY, COLS * K, ROWS * K); ctx.clip();
    ctx.beginPath(); ctx.moveTo(OX, OY + ROWS * K);
    for (let u = 0; u <= COLS; u += 0.5) ctx.lineTo(X(u), y + Math.sin(u * 1.3 + t * 2) * K * 0.08);
    ctx.lineTo(OX + COLS * K, OY + ROWS * K); ctx.closePath();
    wash('#2E2C34', 0.92); ctx.fill();
    pencil(1.2, 0.7); ctx.stroke();
    for (let i = 0; i < 8; i++) { const bx = X((i * 4.3 + t * 0.7) % COLS), by = y + K * (0.4 + (i % 3) * 0.3); wash('#4C4955', 0.6); ctx.beginPath(); ctx.arc(bx, by, K * 0.08, 0, 7); ctx.fill(); }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // which frame of the sheet fits what the character is doing right now
  function poseOf(p) {
    if (!p.alive) return ['hurt', 'F'];
    if (L && L.won) return ['arrive', 'F'];
    if (p.fiveT > 0) return ['five', 'S'];
    if (p.crouch || p.boostT > 0) return ['boost', 'S'];
    if (!p.onGround) {
      if (L && L.tether) {
        const q = partnerOf(p), a = center(p), b = q && center(q);
        if (b && Math.hypot(a.x - b.x, a.y - b.y) > L.tether - 0.3 && (a.y - b.y) * p.g > 0.5) return ['reach', 'S'];
      }
      return [p.vy * p.g < 0 ? 'jump' : 'fall', 'S'];
    }
    if (p.landT > 0) return ['land', 'S'];
    if (p.pushT > 0) return ['push', 'S'];
    if (p.useT > 0) return ['use', 'S'];
    if (p.waveT > 0) return ['wave', 'F'];
    const sp = Math.abs(p.vx);
    if (sp > 0.4) return sp > 5.2 ? [Math.floor(p.run * 0.55) % 2 ? 'run2' : 'run1', 'S'] : ['walk' + (1 + (Math.floor(p.run * 1.25) % 4)), 'S'];
    if (p.inDoor) return ['idle', 'B'];
    if (L && L.plates.some((pl) => Math.abs(p.x - (pl.c + 0.5)) < 0.6 && Math.abs(p.y - (pl.r + 1)) < 0.3)) return ['wait', 'F'];
    return ['idle', 'F'];
  }

  // the characters from the sheet, drawn through their own rig
  function drawFigure(p, t) {
    const R = ROLE[p.role];
    const [pose, view] = p.local || !p.pz ? poseOf(p) : p.pz.split('|');
    const fx = X(p.x), fy = Y(p.y);
    const alpha = p.alive ? 1 : Math.max(0, (L.dead || 0) / 1.3);
    if (p.onGround && p.alive) {
      const gr = ctx.createRadialGradient(fx, fy, 0, fx, fy, K * 0.5);
      gr.addColorStop(0, 'rgba(18,14,11,0.3)'); gr.addColorStop(1, 'rgba(18,14,11,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(fx, fy, K * 0.5, K * 0.11, 0, 0, 7); ctx.fill();
    }
    Rig.draw(ctx, R.c, pose, view, fx, fy, K * 0.98, view === 'S' ? p.face : 1, p.g, alpha);
    const top = K * 1.1 * Rig.height(R.c);
    const ny = p.g > 0 ? fy - top - K * 0.12 : fy + top + K * 0.3;
    ctx.globalAlpha = 0.85; ctx.fillStyle = R.ink;
    ctx.font = `600 ${Math.round(K * 0.22)}px "IBM Plex Mono", monospace`; ctx.textAlign = 'center';
    ctx.fillText((p.label || R.name).toUpperCase(), fx, ny);
    if (p.emo) { ctx.globalAlpha = Math.min(1, p.emo.t * 2); ctx.font = `${Math.round(K * 0.6)}px serif`; ctx.fillText(p.emo.e, fx, ny - K * 0.3); }
    if (L.won && (L.arriveT || 0) > 0) { ctx.globalAlpha = Math.min(1, L.arriveT); ctx.fillStyle = '#A2452F'; ctx.font = `${Math.round(K * 0.5)}px serif`; ctx.fillText('♥', (X(players.ember.x) + X(players.tide.x)) / 2, ny - K * 0.4); }
    ctx.globalAlpha = 1;
  }
  function shade(hex, t) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const m = t < 0 ? 0 : 255, k = Math.abs(t);
    return `rgb(${Math.round(r + (m - r) * k)},${Math.round(g + (m - g) * k)},${Math.round(b + (m - b) * k)})`;
  }

  function drawFx(t) {
    for (let i = L.fx.length - 1; i >= 0; i--) {
      const f = L.fx[i];
      f.t += 1 / 60;
      if (f.kind === 'ring') {
        if (f.t > 0.8) { L.fx.splice(i, 1); continue; }
        ctx.strokeStyle = f.col; ctx.globalAlpha = 1 - f.t / 0.8; ctx.lineWidth = 1.5 * DPR;
        ctx.beginPath(); ctx.ellipse(X(f.x), Y(f.y), K * (0.3 + f.t * 1.4), K * (0.22 + f.t), 0, 0, 7); ctx.stroke();
      } else if (f.kind === 'scribble') {
        if (f.t > 1.3) { L.fx.splice(i, 1); continue; }
        const rnd = mulberry(f.seed | 0);
        pencil(1.3, 0.8 * (1 - f.t / 1.3)); ctx.beginPath();
        for (let k = 0; k < 26; k++) ctx.lineTo(X(f.x + (rnd() - 0.5) * 1.2 * Math.min(1, f.t * 4)), Y(f.y + (rnd() - 0.5) * 1.2 * Math.min(1, f.t * 4)));
        ctx.stroke();
      } else if (f.kind === 'dust') {
        if (f.t > 0.4) { L.fx.splice(i, 1); continue; }
        pencil(0.8, 0.5 * (1 - f.t / 0.4)); ctx.beginPath(); ctx.arc(X(f.x + f.vx * f.t), Y(f.y - f.t * 0.4), K * (0.05 + f.t * 0.3), 0, 7); ctx.stroke();
      } else if (f.kind === 'drop') {
        if (f.t > 0.7) { L.fx.splice(i, 1); continue; }
        f.y += f.vy / 60; f.vy += GRAV / 60;
        wash('#9FB8C8', 1 - f.t / 0.7); ctx.beginPath(); ctx.arc(X(f.x), Y(f.y), K * 0.06, 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- UI
  function showOnly(id) {
    for (const s of ['menu', 'lobby', 'hud', 'result']) $(s).classList.toggle('hidden', s !== id);
    $('pause').classList.add('hidden');
  }
  function levelGrid(box, onPick, selected) {
    box.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const b = document.createElement('button');
      const locked = false;   // every level is open
      b.className = 'lv' + (i === selected ? ' sel' : '') + (locked ? ' locked' : '');
      b.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')}</span><span class="nm"></span><span class="st"></span>`;
      b.querySelector('.nm').textContent = lv.name;
      const st = progress.stars[i] || 0;
      b.querySelector('.st').textContent = st ? '★'.repeat(st) + '☆'.repeat(3 - st) : '';
      b.disabled = locked;
      b.onclick = () => onPick(i);
      box.appendChild(b);
    });
  }
  $('nameInput').value = myName;
  $('nameInput').addEventListener('input', () => { myName = $('nameInput').value.trim(); store.set('duo.name', myName); });
  levelGrid($('menuLevels'), (i) => { net = 'local'; isHost = true; myRole = 'ember'; startLevel(i); });

  $('localBtn').onclick = () => { net = 'local'; isHost = true; myRole = 'ember'; startLevel(Math.min(progress.unlocked - 1, LEVELS.length - 1)); };
  $('hostBtn').onclick = () => {
    if (typeof Peer === 'undefined') return hint('Network library did not load. Reload the page.');
    net = 'online'; isHost = true; myRole = 'ember';
    $('hostBtn').disabled = true; $('hostBtn').textContent = 'Opening a room…';
    Net.host((code) => { $('hostBtn').disabled = false; $('hostBtn').textContent = 'Play together online'; enterLobby(code); });
  };
  const joinRoom = (code) => {
    if (!code) return;
    if (typeof Peer === 'undefined') return hint('Network library did not load. Reload the page.');
    net = 'online'; isHost = false; myRole = 'tide';
    enterLobby(code);
    Net.join(code);
  };
  $('joinBtn').onclick = () => joinRoom($('codeInput').value.trim().toUpperCase());
  const invite = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (invite) { $('inviteBlock').classList.remove('hidden'); $('inviteCode').textContent = invite; $('acceptBtn').onclick = () => joinRoom(invite); }

  function enterLobby(code) {
    roomCode = code || roomCode;
    screen = 'lobby'; myReady = false;
    showOnly('lobby');
    $('roomCode').textContent = roomCode;
    $('shareLink').value = location.origin + location.pathname + '?room=' + roomCode;
    $('shareRow').classList.toggle('hidden', !isHost);
    if (net === 'online' && Net.connected()) { Net.send({ t: 'where', v: 'lobby' }); Net.send({ t: 'ready', v: false }); }
    renderLobby();
  }
  function renderLobby() {
    if (screen !== 'lobby') return;
    const slot = (role) => {
      const mine = role === myRole;
            const ready = mine ? myReady : other.ready;
      return `<div class="slot ${role}${ready ? ' ready' : ''}"><span class="kicker">${role === 'ember' ? 'She · player 1' : 'He · player 2'}</span><span class="who"></span><span class="state">${ready ? 'ready' : mine || other.present ? 'choosing' : ''}</span></div>`;
    };
    $('slots').innerHTML = slot('ember') + slot('tide');
    const whos = $('slots').querySelectorAll('.who');
    whos[0].textContent = myRole === 'ember' ? (myName || 'You') + ' (you)' : other.present ? other.name : 'waiting…';
    whos[1].textContent = myRole === 'tide' ? (myName || 'You') + ' (you)' : other.present ? other.name : 'waiting…';
    levelGrid($('lobbyLevels'), (i) => { levelIdx = i; Net.send({ t: 'lvl', i }); resetReady(); renderLobby(); }, levelIdx);
    $('readyBtn').disabled = !other.present;
    $('readyBtn').textContent = myReady ? 'Waiting for your partner…' : 'Ready';
    $('lobbyStatus').textContent = !other.present ? (isHost ? 'Send the link to your partner.' : 'Connecting…')
      : myReady && other.ready ? 'Here we go.' : other.ready ? `${other.name} is ready.` : 'Pick a level together, then both press Ready.';
  }
  function resetReady() { if (myReady) Net.send({ t: 'ready', v: false }); myReady = false; other.ready = false; renderLobby(); }
  $('swapRoles').onclick = () => { myRole = myRole === 'ember' ? 'tide' : 'ember'; Net.send({ t: 'role', v: myRole }); resetReady(); };
  $('readyBtn').onclick = () => { myReady = !myReady; Net.send({ t: 'ready', v: myReady }); renderLobby(); checkGo(); };
  $('copyBtn').onclick = async () => { try { await navigator.clipboard.writeText($('shareLink').value); } catch (_) { $('shareLink').select(); document.execCommand('copy'); } hint('Link copied'); };
  $('leaveBtn').onclick = () => { Net.destroy(); goMenu(); };
  function checkGo() {
    if (isHost && myReady && other.ready && other.where === 'lobby') { Net.send({ t: 'go', i: levelIdx, from: myRole }); startLevel(levelIdx); }
  }
  function goMenu() {
    screen = 'menu'; net = 'local'; L = null; other.present = false;
    levelGrid($('menuLevels'), (i) => { net = 'local'; isHost = true; myRole = 'ember'; startLevel(i); });
    showOnly('menu');
  }

  $('nextBtn').onclick = () => {
    const n = levelIdx + 1;
    if (net === 'online') Net.send({ t: 'go', i: n, from: myRole });
    startLevel(n);
  };
  $('replayBtn').onclick = () => { if (net === 'online') Net.send({ t: 'go', i: levelIdx, from: myRole }); startLevel(levelIdx); };
  $('levelsBtn').onclick = () => { if (net === 'online') enterLobby(); else goMenu(); };
  $('resumeBtn').onclick = togglePause;
  $('quitBtn').onclick = () => { paused = false; if (net === 'online') enterLobby(); else goMenu(); };
  document.querySelectorAll('[data-emo]').forEach((b) => b.addEventListener('click', () => emote(myRole, b.dataset.emo, true)));

  // ---------------------------------------------------------------- network
  Net.on('connected', () => {
    Net.send({ t: 'hello', name: myName || (myRole === 'ember' ? 'Ember' : 'Tide'), role: myRole });
    if (isHost) Net.send({ t: 'lvl', i: levelIdx });
    Net.send({ t: 'where', v: screen === 'lobby' ? 'lobby' : 'play' });
    hint('Connected');
  });
  Net.on('message', (m) => {
    const now = performance.now();
    switch (m.t) {
      case 'hello':
        other.name = String(m.name || 'Partner').slice(0, 16); other.present = true;
        for (const r of ['ember', 'tide']) if (players[r] && r !== myRole) players[r].label = other.name;
        if (m.role === myRole) { myRole = isHost ? myRole : (m.role === 'ember' ? 'tide' : 'ember'); }
        renderLobby(); break;
      case 'role': myRole = m.v === 'ember' ? 'tide' : 'ember'; resetReady(); break;
      case 'lvl': levelIdx = m.i; myReady = false; other.ready = false; renderLobby(); break;
      case 'ready': other.ready = !!m.v; renderLobby(); checkGo(); break;
      case 'where': other.where = m.v; if (m.v !== 'lobby') other.ready = false; renderLobby(); checkGo(); break;
      case 'go': myRole = m.from === 'ember' ? 'tide' : 'ember'; other.where = 'play'; startLevel(m.i); break;
      case 'p': {
        const q = players[myRole === 'ember' ? 'tide' : 'ember'];
        if (!q) break;
        q.snaps.push(Object.assign({ t: now }, m)); if (q.snaps.length > 30) q.snaps.shift();
        break;
      }
      case 'crates': if (L && !isHost) m.c.forEach(([x, y], i) => { if (L.crates[i]) { L.crates[i].x = x; L.crates[i].y = y; } }); break;
      case 'gem': if (L) takeGem(m.i, false); break;
      case 'lever': if (L) { const lv = L.levers.find((l) => l.c === m.c && l.r === m.r); if (lv) setLever(lv, m.on, false); } break;
      case 'melt': if (L) meltIce(m.c, m.r, false); break;
      case 'freeze': if (L) freeze(m.cells, false); break;
      case 'swap': if (L) { const me = players[myRole]; me.x = m.x; me.y = m.y; me.g = m.g; for (const s of L.stones) ring(s.c + 0.5, s.r + 0.5, '#7A5A8A'); } break;
      case 'die': if (L && L.dead <= 0) { const q = players[m.role]; if (q) { q.alive = false; } L.dead = 1.3; L.deaths++; if (q) scribble(center(q).x, center(q).y); hint(`${ROLE[m.role].name} ${m.cause === 'G' ? 'stepped into the shadow' : m.cause === 'L' ? 'slipped into the amber' : 'slipped into the blue'}`); } break;
      case 'restart': if (L) restartLevel(false); break;
      case 'win': if (L) { L.won = true; L.arriveT = 1.2; setTimeout(() => showResult(m.res), 1300); } break;
      case 'emo': emote(myRole === 'ember' ? 'tide' : 'ember', m.e, false); break;
      case 'five': if (L) highFive(false); break;
      case 'full': hint('That room already has two players'); goMenu(); break;
    }
  });
  Net.on('closed', () => { if (screen !== 'menu') { hint('Your partner disconnected'); goMenu(); } });
  Net.on('error', (e) => { hint(e && e.type === 'peer-unavailable' ? 'Room not found. Ask for a new link.' : 'Connection problem: ' + ((e && e.type) || e)); if (screen === 'lobby' && !Net.connected()) goMenu(); });

  resize();
  Rig.load().then(() => { if (L) L.dirty = true; });
  requestAnimationFrame(tick);
  window.__duo = { players, get L() { return L; }, startLevel, keys, win: () => win(true) };
})();
