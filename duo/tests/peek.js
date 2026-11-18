// node tests/peek.js <level> : trace with crate positions
const { boot, play } = require('./sim'); const S = require('./solutions');
const [name, seed = 0, jitter = 0, fps = 60, every = 6] = process.argv.slice(2);
const LEVELS = boot().LEVELS; const i = LEVELS.findIndex((l) => l.name.toLowerCase().startsWith(name.toLowerCase()));
const sol = S[LEVELS[i].name];
console.log(play(i, function* (b) { const g = sol(b); let n = 0;
  for (const v of { [Symbol.iterator]: () => g }) { if (n++ % every === 0) { const e = b.P('ember'), t = b.P('tide'), L = b.L();
    console.log(`t=${L.t.toFixed(2)} she ${e.x.toFixed(2)},${e.y.toFixed(2)}${e.onGround ? 'G' : ' '} he ${t.x.toFixed(2)},${t.y.toFixed(2)}${t.onGround ? 'G' : ' '} crates ${L.crates.map((c) => c.x.toFixed(2) + ',' + c.y.toFixed(2)).join(' ')} in ${JSON.stringify(v)}`); }
    yield v; } }, { seed: +seed, jitter: +jitter, fps: +fps }).error);
