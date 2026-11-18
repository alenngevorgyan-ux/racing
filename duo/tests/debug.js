// node tests/debug.js <level name> [seed] [jitter] [fps] : prints both positions every 1/6 s
const { boot, play } = require('./sim');
const S = require('./solutions');
const [name, seed = 0, jitter = 0, fps = 60] = process.argv.slice(2);
const LEVELS = boot().LEVELS;
const i = LEVELS.findIndex((l) => l.name.toLowerCase().startsWith(name.toLowerCase()));
const sol = S[LEVELS[i].name];
const wrapped = function* (b) {
  const g = sol(b); let n = 0;
  for (const v of { [Symbol.iterator]: () => g }) {
    if (n++ % (+process.env.EVERY || 10) === 0) { const e = b.P('ember'), t = b.P('tide'), L = b.L();
      console.log(`t=${L.t.toFixed(2)} she ${e.x.toFixed(2)},${e.y.toFixed(2)}${e.onGround ? 'G' : ' '} he ${t.x.toFixed(2)},${t.y.toFixed(2)}${t.onGround ? 'G' : ' '} gems ${L.gems.map((g) => (g.taken ? g.kind.toUpperCase() : g.kind)).join('')}`); }
    yield v;
  }
};
console.log(play(i, wrapped, { seed: +seed, jitter: +jitter, fps: +fps }));
