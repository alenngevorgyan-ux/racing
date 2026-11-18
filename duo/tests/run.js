// node tests/run.js [level name filter]
// Plays every scripted level at 60, 30 and 144 fps, and at 60 fps with late, uneven key presses.
// A level passes only if both reach their doors with every gem and the secret, without a single fall.
'use strict';
const { boot, play } = require('./sim');
const S = require('./solutions');

const filter = (process.argv[2] || '').toLowerCase();
const LEVELS = boot().LEVELS;
const VARIANTS = [
  { fps: 60 }, { fps: 30 }, { fps: 144 },
  ...[1, 2, 3, 4, 5, 6].map((seed) => ({ fps: 60, jitter: 4, seed })),
];
let bad = 0, count = 0;
LEVELS.forEach((lv, i) => {
  if (!S[lv.name] || (filter && !lv.name.toLowerCase().includes(filter))) return;
  count++;
  const rows = VARIANTS.map((v) => Object.assign({ v }, play(i, S[lv.name], v)));
  const ok = (r) => r.won && r.allGems && r.secret !== false && !r.error && r.deaths === 0;
  const pass = rows.every(ok);
  if (!pass) bad++;
  const ref = rows[0];
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${String(i + 1).padStart(2)} ${lv.name.padEnd(18)} bot ${ref.t.toFixed(1)}s  par ${lv.par}s`);
  for (const r of rows) if (!ok(r)) {
    console.log(`      fps ${r.v.fps}${r.v.jitter ? ` jitter ${r.v.jitter} seed ${r.v.seed}` : ''}: ${r.error || (r.won ? '' : 'not at the doors')} gems ${r.gems} secret ${r.secret} missing [${r.missing.join(' ')}]  t=${r.t.toFixed(2)}  ${r.pos}`);
  }
});
console.log(`\n${count - bad}/${count} levels pass`);
process.exit(bad ? 1 : 0);
