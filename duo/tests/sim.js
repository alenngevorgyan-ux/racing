// Headless runner for "Двое": loads the real levels.js + game.js in a Node vm (DOM, canvas and
// network are inert stubs, rendering is skipped), then drives both characters with real key events,
// frame by frame. A solution is a generator that yields one frame of input at a time.
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const KEYS = {
  ember: { left: 'KeyA', right: 'KeyD', jump: 'KeyW', act: 'KeyS', hand: 'KeyQ' },
  tide: { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', act: 'ArrowDown', hand: 'Enter' },
};

function inert(overrides = {}) {
  let p;
  const f = function () {};
  p = new Proxy(f, {
    get(t, k) {
      if (k in overrides) return overrides[k];
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'then') return undefined;
      if (k === 'length') return 0;
      return p;
    },
    set() { return true; },
    apply() { return p; },
    construct() { return p; },
  });
  return p;
}

function boot() {
  const dir = path.join(__dirname, '..', 'js');
  let src = fs.readFileSync(path.join(dir, 'levels.js'), 'utf8') + '\n;\n' + fs.readFileSync(path.join(dir, 'game.js'), 'utf8');
  src = src.replace('function render(', 'function render() {}\n  function __unusedRender(');
  src += '\n;globalThis.__LEVELS = LEVELS;';
  const listeners = {};
  let now = 1000, raf = null;
  const sandbox = {
    console, Math, JSON, Map, Set, Array, Object, Number, String, Promise, URLSearchParams, Symbol, Error,
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    location: { search: '', origin: 'http://x', pathname: '/' },
    localStorage: { getItem: () => null, setItem() {} },
    performance: { now: () => now },
    requestAnimationFrame: (cb) => { raf = cb; },
    setTimeout: () => 0, clearTimeout() {},
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    document: inert({ activeElement: { tagName: 'BODY' }, querySelectorAll: () => [] }),
    navigator: inert(), Path2D: inert(), Image: inert(),
    Rig: inert({ load: () => ({ then() {} }) }),
    Net: inert({ connected: () => false }),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'duo.js' });
  const fire = (type, code) => (listeners[type] || []).forEach((fn) => fn({ code, preventDefault() {} }));
  return {
    duo: sandbox.__duo, LEVELS: sandbox.__LEVELS,
    frame(ms) { now += ms; raf(now); },
    keyDown: (c) => fire('keydown', c), keyUp: (c) => fire('keyup', c),
  };
}

// ---------------------------------------------------------------- bot primitives
// Every primitive is a generator that yields { ember?: input, tide?: input } once per frame.
// An input is { left, right, jump, act, hand } booleans (held this frame).
function makeBot(world, FPS = 60) {
  const P = (role) => world.duo.players[role];
  const L = () => world.duo.L;
  const one = (role, inp) => ({ [role]: inp });

  // run toward x and stop there (closed loop, like a careful player)
  function* walk(role, x, tol = 0.1, extra = {}) {
    let stuck = 0, hop = 0, flips = 0, lastDir = 0;
    for (let n = 0; n < FPS * 20; n++) {
      const p = P(role), d = x - p.x;
      if (Math.abs(d) < tol && Math.abs(p.vx) < 0.6 && (p.onGround || extra.air)) return;
      if (Math.abs(d) < 0.2 && flips > 10 && p.onGround) return;   // dithering over a hair: close enough
      const stop = (p.vx * p.vx) / (2 * (p.onGround ? 70 : 42)) + 0.03;
      const dir = Math.sign(d);
      let inp = {};
      if (Math.abs(d) > stop) inp = dir > 0 ? { right: true } : { left: true };
      else if (Math.sign(p.vx) === dir && Math.abs(p.vx) > 1) inp = dir > 0 ? { left: true } : { right: true };
      const nd = inp.right ? 1 : inp.left ? -1 : 0;
      if (nd && lastDir && nd !== lastDir) flips++;
      if (nd) lastDir = nd;
      // a small step (the lip of a pool, a crate): hop over it, like anyone would
      stuck = (inp.left || inp.right) && p.onGround && Math.abs(p.vx) < 0.2 ? stuck + 1 : 0;
      if (stuck > 8 * FPS / 60 && !extra.noHop) { hop = Math.round(6 * FPS / 60); stuck = 0; }
      if (hop > 0) { hop--; inp.jump = true; }
      yield one(role, Object.assign(inp, extra));
    }
    throw new Error(`${role} could not reach x=${x} (at ${P(role).x.toFixed(2)},${P(role).y.toFixed(2)})`);
  }
  // run in a direction (no stopping) until cond() is true
  function* run(role, dir, cond, extra = {}) {
    for (let n = 0; n < FPS * 20; n++) {
      if (cond(P(role))) return;
      yield one(role, Object.assign(dir > 0 ? { right: true } : dir < 0 ? { left: true } : {}, extra));
    }
    throw new Error(`${role} run: condition never met`);
  }
  // jump now; steer to land at tx (or just hold dir); hold the jump key for holdS seconds (Infinity = full)
  // opts.until(p) ends the move early (default: landed again)
  function* jump(role, opts = {}) {
    const { dir = 0, hold = 9, until = null, maxS = 6, air = false, via = null } = opts;
    let tx = opts.tx == null ? null : opts.tx;
    let t = 0, left = false;
    // a jump starts from the ground: wait to land first (unless this is a move made in the air)
    if (!air) for (let n = 0; n < 2 * FPS && !P(role).onGround; n++) yield {};
    for (let n = 0; n < FPS * maxS; n++) {
      const p = P(role);
      if (n > 2 * FPS / 60 && !p.onGround) left = true;
      if (until ? until(p, t) : left && p.onGround) return;
      const inp = { jump: n > 0 && t < hold };   // frame 0 lets go of the key, so the press is a new one
      // via: aim the top of the jump at this x (a gem), then go for the landing
      if (via != null) tx = left && p.vy * p.g >= 0 ? opts.tx : via;
      if (tx != null) {
        const d = tx - p.x, a = p.onGround ? 70 : 42;
        const stop = (p.vx * p.vx) / (2 * a) + 0.03;
        if (Math.abs(d) > stop) inp[d > 0 ? 'right' : 'left'] = true;
        else if (Math.abs(p.vx) > 0.5 && tx !== via) inp[p.vx > 0 ? 'left' : 'right'] = true;   // no braking on the way to a gem
      } else if (dir) inp[dir > 0 ? 'right' : 'left'] = true;
      yield one(role, inp);
      t += 1 / FPS;
    }
    throw new Error(`${role} jump never finished (at ${P(role).x.toFixed(2)},${P(role).y.toFixed(2)})`);
  }
  function* hold(role, inp, cond, maxS = 30) {
    for (let n = 0; n < FPS * maxS; n++) { if (cond()) return; yield one(role, Object.assign({}, inp)); }
    throw new Error(`${role} hold: condition never met`);
  }
  function* wait(s) { for (let n = 0; n < Math.round(s * FPS); n++) yield {}; }
  function* until(cond, maxS = 30, what = 'condition') {
    for (let n = 0; n < FPS * maxS; n++) { if (cond()) return; yield {}; }
    throw new Error('until: ' + what + ' never met');
  }
  function* tap(role, key) { const n = Math.max(1, Math.round(FPS / 30)); for (let i = 0; i < n; i++) yield one(role, { [key]: true }); for (let i = 0; i < n; i++) yield {}; }
  // run several generators side by side; finishes when all of them are done
  function* par(...gens) {
    let live = gens.slice();
    while (live.length) {
      const out = {};
      const next = [];
      for (const g of live) {
        const r = g.next();
        if (r.done) continue;
        next.push(g);
        for (const role of ['ember', 'tide']) if (r.value[role]) out[role] = Object.assign(out[role] || {}, r.value[role]);
      }
      live = next;
      if (live.length) yield out;
    }
  }
  // like par, but ends as soon as the first generator ends
  function* race(main, ...side) {
    const gens = [main, ...side];
    for (;;) {
      const out = {};
      for (let i = 0; i < gens.length; i++) {
        const r = gens[i].next();
        if (r.done) { if (i === 0) return; gens[i] = (function* () { for (;;) yield {}; })(); continue; }
        for (const role of ['ember', 'tide']) if (r.value[role]) out[role] = Object.assign(out[role] || {}, r.value[role]);
      }
      yield out;
    }
  }
  return { P, L, walk, run, jump, hold, wait, until, tap, par, race, FPS };
}

// ---------------------------------------------------------------- runner
// jitter: each key change reaches the game 0..jitter frames late (a human's uneven hands)
function play(levelIdx, solution, opts = {}) {
  const fps = opts.fps || 60, jitter = opts.jitter || 0;
  let seed = opts.seed || 1;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const world = boot();
  if (typeof levelIdx === 'object') { world.LEVELS.push(levelIdx); levelIdx = world.LEVELS.length - 1; }
  world.duo.startLevel(levelIdx);
  const bot = makeBot(world, fps);
  const gen = solution(bot);
  const down = {};          // what the game currently sees
  const pend = [];          // delayed key changes
  let frame = 0, error = null;
  const trail = [];
  let endAt = null, r = { done: false };
  const ms = 1000 / fps;
  const lim = (opts.maxS || 240) * fps;
  try {
    for (; frame < lim; frame++) {
      const Lv = world.duo.L;
      if (Lv.deaths > 0) {
        const who = ['ember', 'tide'].filter((r) => !world.duo.players[r].alive).map((r) => (r === 'ember' ? 'she' : 'he'));
        throw new Error(`${who.join('+')} died at t=${Lv.t.toFixed(2)}s; last moves: ${trail.slice(-6).join(' | ')}`);
      }
      if (Lv.won) break;
      if (!r.done) r = gen.next();
      const want = {};
      if (!r.done) for (const role of ['ember', 'tide']) {
        const inp = r.value[role] || {};
        for (const k in KEYS[role]) want[KEYS[role][k]] = !!inp[k];
      } else for (const role of ['ember', 'tide']) for (const k in KEYS[role]) want[KEYS[role][k]] = false;
      for (const code in want) {
        const last = pend.filter((q) => q.code === code).pop();
        const planned = last ? last.v : !!down[code];
        if (planned !== want[code]) pend.push({ code, v: want[code], at: frame + (jitter ? Math.floor(rnd() * (jitter + 1)) : 0) });
      }
      pend.sort((a, b) => a.at - b.at);
      while (pend.length && pend[0].at <= frame) {
        const q = pend.shift();
        if (q.v && !down[q.code]) world.keyDown(q.code);
        if (!q.v && down[q.code]) world.keyUp(q.code);
        down[q.code] = q.v;
      }
      world.frame(ms);
      if (frame % Math.round(fps / 6) === 0) { const p = world.duo.players; trail.push(`she ${p.ember.x.toFixed(1)},${p.ember.y.toFixed(1)} he ${p.tide.x.toFixed(1)},${p.tide.y.toFixed(1)}`); }
      if (r.done) { if (endAt == null) endAt = frame + fps; else if (frame > endAt) break; }   // a second for the door check
    }
  } catch (e) { error = e; }
  const Lv = world.duo.L;
  const gems = Lv.gems.filter((g) => g.kind !== 's');
  const sec = Lv.gems.find((g) => g.kind === 's');
  const p = world.duo.players;
  return {
    won: !!Lv.won, t: Lv.t, deaths: Lv.deaths, error: error && error.message,
    gems: `${gems.filter((g) => g.taken).length}/${gems.length}`, allGems: gems.every((g) => g.taken),
    secret: sec ? sec.taken : null, par: Lv.def.par,
    missing: Lv.gems.filter((g) => !g.taken).map((g) => `${g.kind}@${g.x - 0.5},${g.y - 0.5}`),
    pos: `she ${p.ember.x.toFixed(2)},${p.ember.y.toFixed(2)} g${p.ember.g}  he ${p.tide.x.toFixed(2)},${p.tide.y.toFixed(2)} g${p.tide.g}`,
  };
}

// a bare room (walls, floor) for experiments: fn gets the same api as levels.js
function room(fn, flags = {}) {
  const g = Array.from({ length: 18 }, (_, r) => Array.from({ length: 32 }, (_, c) => (r === 0 || r >= 16 || c === 0 || c === 31 ? '#' : ' ')));
  const objs = [];
  fn({ solid: (r0, r1, c0, c1, ch = '#') => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ch; }, set: (r, c, ch) => { g[r][c] = ch; }, obj: (o) => objs.push(o) });
  return { name: 'room', note: '', par: 99, map: g.map((r) => r.join('')), objs, flags };
}

module.exports = { boot, play, makeBot, KEYS, room };
