// Трассы: геометрия (повороты/холмы), тема (небо, фон, палитра), декорации.
const Tracks = (() => {
  const SEG = 200, RUMBLE = 3, ROAD = 2000;
  const S = Art.S;

  const DEFS = [
    {
      id: 'canyon', name: 'Красный каньон',
      sky: ['#e8823e', '#f6b26b', '#ffe2b0'], sun: { x: 0.72, y: 0.55, r: 16, c: '#fff4cf' },
      far: { type: 'mesa', c: '#a8492f', seed: 3 }, near: { type: 'dunes', c: '#cf7f45', seed: 5 },
      ground: '#d99a5b', road: '#6f625c', rumble: ['#b33b2a', '#e6d2b0'], lane: '#efe0bd', edge: '#e6d2b0', fog: '#f4c58e',
      side: [['cactus', 4], ['rockRed', 3], ['deadTree', 1]], chance: 0.5, walls: S.pillar, cones: true,
      layout: [[10, 20, 10, 0, 0], [30, 40, 30, 4, 6], [20, 30, 20, -5, -6], [25, 40, 25, 3, 0], [30, 60, 30, 0, 15],
        [20, 30, 20, 6, -10], [20, 20, 20, -4, -5], [25, 50, 25, 5, 8], [25, 40, 25, 0, -8], [20, 30, 20, -6, 0],
        [30, 40, 30, 4, 10], [30, 30, 30, 3, -10], [25, 50, 25, 0, 0], [20, 30, 20, 5, 0]],
    },
    {
      id: 'coast', name: 'Солнечный берег',
      sky: ['#2f7fd6', '#7fbdf0', '#d6eeff'], sun: { x: 0.25, y: 0.3, r: 14, c: '#fffbe6' }, clouds: true,
      far: { type: 'sea', c: '#2f78c4', seed: 7 }, near: { type: 'dunes', c: '#e9cf8e', seed: 9 },
      ground: '#e8cf8a', road: '#85858f', rumble: ['#f2f2f2', '#d94a3f'], lane: '#ffffff', edge: '#ffffff', fog: '#cfe6fb',
      side: [['palm', 6], ['umbrella', 1], ['rockGrey', 2], ['bush', 1]], chance: 0.5,
      layout: [[10, 20, 10, 0, 0], [50, 100, 50, 2, 4], [40, 80, 40, -2, -4], [50, 100, 50, 3, 0], [40, 60, 40, 0, 8],
        [50, 80, 50, -3, -8], [50, 100, 50, 4, 0], [40, 60, 40, 1, 5], [40, 80, 40, 2, -5]],
    },
    {
      id: 'forest', name: 'Лес на закате',
      sky: ['#2e2350', '#9a4f73', '#f0a165'], sun: { x: 0.6, y: 0.8, r: 18, c: '#ffd59a' },
      far: { type: 'mountains', c: '#5a3f6e', seed: 11 }, near: { type: 'treeline', c: '#2c4a36', seed: 13 },
      ground: '#4f8a3c', road: '#5d5d66', rumble: ['#d8d8d8', '#7a4b2a'], lane: '#e8e2d0', edge: '#d8d8d8', fog: '#b9817f',
      side: [['pine', 5], ['tree', 3], ['treeAutumn', 2], ['log', 1], ['mushroom', 1], ['bush', 2]], chance: 0.75, cones: true,
      layout: [[10, 20, 10, 0, 0], [25, 25, 25, -4, 10], [25, 25, 25, 4, -10], [25, 25, 25, -5, 0], [25, 25, 25, 5, 12],
        [30, 30, 30, 3, -12], [25, 50, 25, 0, 10], [25, 25, 25, 6, -6], [25, 25, 25, -6, -4], [30, 40, 30, 4, 0],
        [25, 25, 25, -3, 8], [25, 25, 25, 5, -8], [30, 30, 30, 4, 0]],
    },
    {
      id: 'snow', name: 'Ночной перевал',
      sky: ['#070b24', '#1f2b5e', '#4d5c94'], moon: { x: 0.78, y: 0.3, r: 12 }, stars: true,
      far: { type: 'snowpeaks', c: '#38406e', seed: 17 }, near: { type: 'snowhills', c: '#c9d6ea', seed: 19 },
      ground: '#dde6f2', road: '#474b58', rumble: ['#b83030', '#eeeeee'], lane: '#f0f0f0', edge: '#eeeeee', fog: '#56628f',
      side: [['snowPine', 7], ['rockIce', 2], ['snowman', 1]], chance: 0.6, lamps: true,
      layout: [[10, 20, 10, 0, 0], [40, 60, 40, 0, 25], [30, 30, 30, 6, -10], [30, 30, 30, 6, -15], [40, 60, 40, -3, 20],
        [30, 40, 30, -6, -20], [40, 40, 40, 4, 0], [30, 40, 30, 6, 15], [40, 60, 40, 0, -15], [30, 30, 30, -5, 10], [30, 30, 30, 5, -10]],
    },
  ];

  // ---------- Фоновые панорамы (бесшовные по ширине 1024) ----------
  const PW = 1024, PH = 150;
  function periodic(seed, x, harmonics) {
    let v = 0;
    for (const [k, a, p] of harmonics) v += a * Math.sin((x / PW) * Math.PI * 2 * k + p + seed);
    return v;
  }
  function panorama(layer, theme) {
    const c = layer.c, sd = layer.seed;
    return Art.mk(PW, PH, (g) => {
      const top = (x) => {
        switch (layer.type) {
          case 'mesa': { const v = periodic(sd, x, [[3, 1, 0], [7, 0.6, 1], [13, 0.3, 2]]); return PH - (Math.max(0, Math.floor((v + 0.6) * 2.2)) * 18 + 6); }
          case 'mountains': case 'snowpeaks': { const v = Math.abs(periodic(sd, x, [[4, 1, 0], [9, 0.5, 1], [21, 0.18, 2], [37, 0.08, 3]])); return PH - 18 - v * 62; }
          case 'dunes': { const v = periodic(sd, x, [[5, 1, 0], [11, 0.4, 1]]); return PH - 14 - (v + 1.4) * 9; }
          case 'treeline': { const v = periodic(sd, x, [[6, 1, 0]]); const t = (x * 0.37) % 9; return PH - 16 - (v + 1) * 6 - (t < 4.5 ? t : 9 - t) * 3; }
          case 'snowhills': { const v = periodic(sd, x, [[4, 1, 0], [9, 0.5, 1]]); return PH - 12 - (v + 1.5) * 8; }
          case 'sea': return PH - 10;
        }
        return PH;
      };
      const pts = [];
      for (let x = 0; x <= PW; x += 2) pts.push([x, top(x)]);
      const shape = () => { g.beginPath(); g.moveTo(0, PH); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(PW, PH); g.closePath(); };

      if (layer.type === 'sea') {
        // далёкие острова и море
        g.fillStyle = Art.shade(c, -0.1);
        for (const [ix, iw, ih] of [[120, 90, 14], [520, 140, 20], [830, 70, 10]]) { g.beginPath(); g.ellipse(ix, PH - 10, iw, ih, 0, Math.PI, 0); g.fill(); }
        const gr = g.createLinearGradient(0, PH - 12, 0, PH); gr.addColorStop(0, '#5aa6e6'); gr.addColorStop(1, c);
        g.fillStyle = gr; g.fillRect(0, PH - 12, PW, 12);
        g.fillStyle = 'rgba(255,255,255,.7)';
        for (let i = 0; i < 70; i++) g.fillRect((i * 149) % PW, PH - 10 + ((i * 7) % 9), 4 + (i % 3) * 2, 1);
        return;
      }
      shape();
      const gr = g.createLinearGradient(0, 30, 0, PH);
      gr.addColorStop(0, Art.shade(c, 0.12)); gr.addColorStop(1, Art.shade(c, -0.18));
      g.fillStyle = gr; g.fill();
      g.save(); shape(); g.clip();
      if (layer.type === 'mesa') {
        for (let y = 0; y < PH; y += 6) { g.fillStyle = (y / 6) % 2 ? 'rgba(255,200,150,.12)' : 'rgba(80,20,10,.12)'; g.fillRect(0, y, PW, 3); }
      }
      if (layer.type === 'mountains' || layer.type === 'snowpeaks') {
        // освещённые грани
        g.fillStyle = layer.type === 'snowpeaks' ? 'rgba(235,242,255,.9)' : 'rgba(255,190,150,.18)';
        for (let i = 1; i < pts.length - 1; i++) {
          const [x, y] = pts[i];
          if (pts[i - 1][1] > y && pts[i + 1][1] >= y && y < PH - 60) {
            g.beginPath(); g.moveTo(x, y); g.lineTo(x - 26, y + 34); g.lineTo(x - 6, y + 26); g.lineTo(x + 8, y + 36); g.lineTo(x + 20, y + 22); g.closePath(); g.fill();
          }
        }
      }
      if (layer.type === 'treeline') {
        g.fillStyle = 'rgba(0,0,0,.25)';
        for (let x = 0; x < PW; x += 9) { g.beginPath(); g.moveTo(x, PH); g.lineTo(x + 4, top(x + 4) + 2); g.lineTo(x + 8, PH); g.fill(); }
      }
      g.restore();
    });
  }

  // ---------- Сборка трассы ----------
  const cache = {};
  function build(def) {
    const segs = [];
    let seed = def.layout.length * 7919 + def.id.length * 131;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const lastY = () => (segs.length ? segs[segs.length - 1].p2.world.y : 0);
    const easeIn = (a, b, p) => a + (b - a) * p * p;
    const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
    function add(curve, y) {
      const n = segs.length;
      segs.push({ index: n, curve, sprites: [], dark: Math.floor(n / RUMBLE) % 2 === 1,
        p1: { world: { y: lastY(), z: n * SEG }, camera: {}, screen: {} },
        p2: { world: { y, z: (n + 1) * SEG }, camera: {}, screen: {} } });
    }
    function addRoad(enter, hold, leave, curve, height) {
      const sy = lastY(), ey = sy + height * SEG, total = enter + hold + leave;
      for (let n = 0; n < enter; n++) add(easeIn(0, curve, n / enter), easeInOut(sy, ey, n / total));
      for (let n = 0; n < hold; n++) add(curve, easeInOut(sy, ey, (enter + n) / total));
      for (let n = 0; n < leave; n++) add(easeInOut(curve, 0, n / leave), easeInOut(sy, ey, (enter + hold + n) / total));
    }
    for (const l of def.layout) addRoad(...l);
    addRoad(40, 40, 40, 0, -lastY() / SEG);

    const N = segs.length, LENGTH = N * SEG, START_SEG = 4;
    segs[START_SEG].start = 1; segs[START_SEG + 1].start = 2;

    // цвета сегментов с лёгкой "фактурой" — каждый сегмент чуть отличается
    for (const s of segs) {
      const t = (rnd() - 0.5) * 0.07;
      const d = s.dark ? -0.06 : 0;
      s.c = {
        grass: Art.shade(def.ground, d + t),
        road: Art.shade(def.road, (s.dark ? -0.04 : 0) + t * 0.6),
        rumble: s.dark ? def.rumble[1] : def.rumble[0],
        lane: s.dark ? null : def.lane,
        edge: def.edge,
      };
    }

    // декорации
    const put = (i, spr, o, extra) => segs[i % N].sprites.push(Object.assign({ def: spr, o }, extra));
    const pool = def.side.flatMap(([k, w]) => Array(w).fill(S[k]));
    put(START_SEG, Art.banner, 0);
    for (let i = 10; i < N; i++) {
      if (i % 3 === 0) for (const side of [-1, 1]) if (rnd() < def.chance) put(i, pool[Math.floor(rnd() * pool.length)], side * (1.55 + rnd() * 2.8));
      if (def.walls && Math.abs(segs[i].curve) >= 3 && i % 2 === 0 && rnd() < 0.85) {
        const side = rnd() < 0.5 ? -1 : 1;
        put(i, def.walls, side * (2.15 + rnd() * 0.5));
      }
      if (def.lamps && i % 14 === 0) put(i, S.lamp, (i % 28 ? 1 : -1) * 1.3);
    }
    // щиты с надписями — 3 на круг
    [0.12, 0.45, 0.77].forEach((f, k) => { const i = Math.floor(N * f); put(i, Art.signs[(k + def.id.length) % Art.signs.length], (k % 2 ? 1 : -1) * 1.8); });
    // нитро — редко: 3 на круг
    [0.22, 0.52, 0.84].forEach((f, k) => put(Math.floor(N * f), S.nitro, [-0.5, 0, 0.5][Math.floor(rnd() * 3)], { nitro: k }));
    if (def.cones) for (let i = 90; i < N - 20; i += 230) {
      const gap = rnd() < 0.5 ? -0.5 : 0.5;
      put(i, S.cone, -gap); put(i + 1, S.cone, -gap * 0.3);
    }

    // мини-карта: интегрируем повороты в 2D и замыкаем контур
    let sum = 0;
    for (const s of segs) sum += s.curve;
    const k = Math.abs(sum) > 50 ? (Math.PI * 2) / sum : 0.004;
    let a = 0, x = 0, y = 0;
    const pts = [];
    for (let i = 0; i < N; i++) { pts.push([x, y]); a += segs[i].curve * k; x += Math.cos(a); y += Math.sin(a); }
    const ex = x, ey = y;
    for (let i = 0; i < N; i++) { pts[i][0] -= (ex * i) / N; pts[i][1] -= (ey * i) / N; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of pts) { minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py); }
    const map = { pts, minX, minY, maxX, maxY };

    const findSeg = (z) => segs[Math.floor((((z % LENGTH) + LENGTH) % LENGTH) / SEG) % N];
    return { def, segs, N, LENGTH, START_Z: START_SEG * SEG, findSeg, map,
      farImg: panorama(def.far, def), nearImg: panorama(def.near, def) };
  }

  function get(id) {
    const def = DEFS.find((d) => d.id === id) || DEFS[0];
    return cache[def.id] || (cache[def.id] = build(def));
  }

  return { SEG, ROAD, list: DEFS, get, PW, PH };
})();
