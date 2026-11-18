// Runs the real render code (against inert canvas stubs) on every level for 2 seconds, to catch exceptions.
const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'js');
const src = ['levels.js', 'game.js'].map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n;\n') + '\n;globalThis.__LEVELS = LEVELS;';
function inert() { let p; p = new Proxy(function () {}, { get(t, k) { if (k === Symbol.toPrimitive) return () => 1; if (k === 'then') return undefined; if (k === 'length') return 0; return p; }, set() { return true; }, apply() { return p; }, construct() { return p; } }); return p; }
let now = 1000, raf = null;
const sb = { console, Math, JSON, Map, Set, Array, Object, Number, String, Promise, URLSearchParams, Symbol, Error,
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, location: { search: '', origin: 'x', pathname: '/' },
  localStorage: { getItem: () => null, setItem() {} }, performance: { now: () => now }, requestAnimationFrame: (cb) => { raf = cb; },
  setTimeout: () => 0, clearTimeout() {}, addEventListener() {}, document: inert(), navigator: inert(), Path2D: inert(), Image: inert(),
  Rig: new Proxy({}, { get: (t, k) => (k === 'load' ? () => ({ then() {} }) : inert()) }), Net: inert() };
sb.window = sb; vm.createContext(sb); vm.runInContext(src, sb);
let bad = 0;
sb.__LEVELS.forEach((lv, i) => {
  try { sb.__duo.startLevel(i); for (let f = 0; f < 120; f++) { now += 16.7; raf(now); } }
  catch (e) { bad++; console.log('RENDER ERROR level', i + 1, lv.name, e.message); }
});
console.log(bad ? `${bad} levels threw` : `all ${sb.__LEVELS.length} levels render without errors`);
