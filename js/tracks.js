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
      side: [['cactus', 4], ['rockRed', 3], ['deadTree', 1]], chance: 0.5, walls: S.pillar,
      zones: [{ from: 0.3, to: 0.4, type: 'tunnel', arch: 'rockArch' }],
      obs: { ramps: [0.17, 0.62], pads: [0.08, 0.46, 0.7], slick: 'oil', slicks: [0.26, 0.88], barrels: [0.55, 0.93], mover: 'tumbleweed', movers: [0.2, 0.5, 0.78] },
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
      zones: [{ from: 0.4, to: 0.53, type: 'bridge' }, { from: 0.78, to: 0.84, type: 'bridge' }],
      obs: { ramps: [0.37, 0.75], pads: [0.15, 0.6, 0.9], slick: 'oil', slicks: [0.28], barrels: [0.67], mover: 'crab', movers: [0.1, 0.23, 0.32, 0.88] },
      layout: [[10, 20, 10, 0, 0], [50, 100, 50, 2, 4], [40, 80, 40, -2, -4], [50, 100, 50, 3, 0], [40, 60, 40, 0, 8],
        [50, 80, 50, -3, -8], [50, 100, 50, 4, 0], [40, 60, 40, 1, 5], [40, 80, 40, 2, -5]],
    },
    {
      id: 'forest', name: 'Лес на закате',
      sky: ['#2e2350', '#9a4f73', '#f0a165'], sun: { x: 0.6, y: 0.8, r: 18, c: '#ffd59a' },
      far: { type: 'mountains', c: '#5a3f6e', seed: 11 }, near: { type: 'treeline', c: '#2c4a36', seed: 13 },
      ground: '#4f8a3c', road: '#5d5d66', rumble: ['#d8d8d8', '#7a4b2a'], lane: '#e8e2d0', edge: '#d8d8d8', fog: '#b9817f',
      side: [['pine', 5], ['tree', 3], ['treeAutumn', 2], ['log', 1], ['mushroom', 1], ['mushBounce', 1], ['bush', 2]], chance: 0.75,
      zones: [{ from: 0.18, to: 0.26, type: 'tunnel', arch: 'woodArch' }, { from: 0.58, to: 0.66, type: 'bridge' }],
      obs: { ramps: [0.12, 0.56], pads: [0.32, 0.72, 0.92], slick: 'mud', slicks: [0.4, 0.8, 0.95], barrels: [0.48], mover: 'rollLog', movers: [0.3, 0.7, 0.86] },
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
      zones: [{ from: 0.22, to: 0.38, type: 'ice' }, { from: 0.62, to: 0.7, type: 'tunnel', arch: 'iceArch' }],
      obs: { ramps: [0.15, 0.5, 0.85], pads: [0.08, 0.44, 0.76], barrels: [0.55], mover: 'snowball', movers: [0.12, 0.3, 0.48, 0.9] },
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

  // ---------- Текстуры земли и дороги (бесшовные) ----------
  const GT = 128;          // размер текстуры земли
  const RT_W = 256, RT_H = 64;
  function pixels(w, h, fn) {
    return Art.mk(w, h, (g) => {
      const d = g.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const [r, gg, b] = fn(x, y);
        const i = (y * w + x) * 4;
        d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b; d.data[i + 3] = 255;
      }
      g.putImageData(d, 0, 0);
    });
  }
  // гладкий бесшовный шум
  function tileNoise(rnd, size, cells) {
    const v = Array.from({ length: cells * cells }, () => rnd());
    const at = (i, j) => v[((j % cells) + cells) % cells * cells + (((i % cells) + cells) % cells)];
    return (x, y) => {
      const fx = (x / size) * cells, fy = (y / size) * cells;
      const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      return (at(i, j) * (1 - sx) + at(i + 1, j) * sx) * (1 - sy) + (at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx) * sy;
    };
  }
  function groundTexture(def, rnd) {
    const base = Art.rgb(def.ground);
    const n1 = tileNoise(rnd, GT, 4), n2 = tileNoise(rnd, GT, 16);
    const c = pixels(GT, GT, (x, y) => {
      const k = (n1(x, y) - 0.5) * 0.22 + (n2(x, y) - 0.5) * 0.14 + (rnd() - 0.5) * 0.12;
      return base.map((v) => v * (1 + k));
    });
    const g = c.getContext('2d');
    // детали поверх: травинки, камешки, искорки снега, рябь песка
    for (let i = 0; i < 160; i++) {
      const x = Math.floor(rnd() * GT), y = Math.floor(rnd() * GT);
      if (def.id === 'forest') { g.fillStyle = rnd() < 0.5 ? Art.shade(def.ground, 0.25) : Art.shade(def.ground, -0.3); g.fillRect(x, y, 1, 3); }
      else if (def.id === 'snow') { g.fillStyle = rnd() < 0.7 ? '#ffffff' : '#b8c8e4'; g.fillRect(x, y, 1, 1); }
      else { g.fillStyle = Art.shade(def.ground, rnd() < 0.5 ? -0.25 : 0.18); g.fillRect(x, y, rnd() < 0.3 ? 2 : 1, 1); }
    }
    if (def.id === 'canyon' || def.id === 'coast') {
      g.strokeStyle = Art.shade(def.ground, -0.12); g.lineWidth = 1;
      for (let y = 6; y < GT; y += 14) { g.beginPath(); for (let x = 0; x <= GT; x += 4) g.lineTo(x, y + Math.sin((x / GT) * Math.PI * 4 + y) * 2); g.stroke(); }
    }
    return c;
  }
  // дорога: по ширине — бордюр | асфальт | разметка; по высоте — два "такта" бордюра
  const ROAD_SPAN = 1.18; // текстура покрывает ±1.18 полуширины дороги
  function roadTexture(def, rnd) {
    const asp = Art.rgb(def.road), c0 = Art.rgb(def.rumble[0]), c1 = Art.rgb(def.rumble[1]);
    const edge = Art.rgb(def.edge), lane = Art.rgb(def.lane);
    const n = tileNoise(rnd, RT_H, 4);
    return pixels(RT_W, RT_H, (x, y) => {
      const r = (x / RT_W) * 2 * ROAD_SPAN - ROAD_SPAN, ar = Math.abs(r);
      const half = y < RT_H / 2;
      const grain = (rnd() - 0.5) * 0.12;
      if (ar > 1.0) { const cc = half ? c0 : c1; const lip = ar > 1.15 ? 0.8 : 1; return cc.map((v) => v * (lip + grain * 0.5)); }
      if (ar > 0.955 && ar < 0.99) return edge.map((v) => v * (0.95 + grain * 0.3));
      if (ar < 0.022 && half && y > 4 && y < RT_H / 2 - 4) return lane.map((v) => v * (0.95 + grain * 0.3));
      const wear = Math.abs(ar - 0.5) < 0.12 ? -0.06 : 0; // колея
      const k = 1 + grain + (n(x * 0.25, y) - 0.5) * 0.1 + wear;
      return asp.map((v) => v * k);
    });
  }

  function waterTexture(rnd) {
    const n = tileNoise(rnd, GT, 8);
    return pixels(GT, GT, (x, y) => {
      const k = n(x, y), wave = Math.sin((y / GT) * Math.PI * 8 + n(x, y) * 4);
      if (wave > 0.93) return [200, 235, 255];
      return [30 + k * 30, 110 + k * 50, 190 + k * 40];
    });
  }
  function iceTexture(rnd) {
    const n = tileNoise(rnd, GT, 6);
    const c = pixels(GT, GT, (x, y) => { const k = n(x, y); return [175 + k * 50, 215 + k * 30, 240 + k * 15]; });
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      let x = rnd() * GT, y = rnd() * GT;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.5) * 30; g.lineTo(x, y); }
      g.stroke();
    }
    return c;
  }
  function rockTexture(def, rnd) {
    const n = tileNoise(rnd, GT, 8);
    const base = def.id === 'snow' ? [70, 90, 130] : def.id === 'forest' ? [70, 52, 36] : [110, 58, 40];
    return pixels(GT, GT, (x, y) => { const k = 0.7 + n(x, y) * 0.5 + (rnd() - 0.5) * 0.15; return base.map((v) => v * k); });
  }
  function planksTexture(rnd) {
    return pixels(RT_W, RT_H, (x, y) => {
      const r = (x / RT_W) * 2 * ROAD_SPAN - ROAD_SPAN, ar = Math.abs(r);
      if (ar > 1.0) return [40, 70, 120]; // вода у края моста
      const plank = Math.floor(y / 8), seam = y % 8 === 0;
      const k = (seam ? 0.55 : 1) * (0.85 + ((plank * 37) % 7) * 0.04 + (rnd() - 0.5) * 0.12);
      if (ar < 0.022 && y % 16 < 8) return [240, 230, 200];
      return [150 * k, 100 * k, 60 * k];
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

    // зоны: туннель, мост над водой, ледяное озеро
    for (const z of def.zones || []) {
      const a = Math.floor(N * z.from), b = Math.floor(N * z.to);
      for (let i = a; i < b; i++) { segs[i].zone = z.type; segs[i].arch = z.arch; }
    }
    const zoneAt = (i) => segs[i % N].zone;

    // декорации
    const put = (i, spr, o, extra) => segs[i % N].sprites.push(Object.assign({ def: spr, o }, extra));
    const pool = def.side.flatMap(([k, w]) => Array(w).fill(S[k]));
    put(START_SEG, Art.banner, 0);
    for (let i = 10; i < N; i++) {
      const zone = zoneAt(i);
      if (zone === 'tunnel') { if (i % 3 === 0) put(i, S[segs[i].arch], 0); continue; }
      if (zone === 'bridge') { if (i % 2 === 0) { put(i, S.rail, -1.22); put(i, S.rail, 1.22); } continue; }
      if (i % 3 === 0) for (const side of [-1, 1]) if (rnd() < def.chance * (zone === 'ice' ? 0.4 : 1)) put(i, pool[Math.floor(rnd() * pool.length)], side * (1.55 + rnd() * 2.8));
      if (def.walls && Math.abs(segs[i].curve) >= 3 && i % 2 === 0 && rnd() < 0.85) {
        const side = rnd() < 0.5 ? -1 : 1;
        put(i, def.walls, side * (2.15 + rnd() * 0.5));
      }
      if (def.lamps && i % 14 === 0) put(i, S.lamp, (i % 28 ? 1 : -1) * 1.3);
    }
    // щиты с надписями — 3 на круг (не в туннелях и не на мостах)
    const free = (i) => !zoneAt(i) || zoneAt(i) === 'ice';
    const near = (f) => { let i = Math.floor(N * f); while (!free(i) && i < N - 1) i++; return i; };
    [0.12, 0.45, 0.77].forEach((f, k) => put(near(f), Art.signs[(k + def.id.length) % Art.signs.length], (k % 2 ? 1 : -1) * 1.8));
    // нитро — редко: 3 на круг
    [0.22, 0.52, 0.84].forEach((f, k) => put(Math.floor(N * f), S.nitro, [-0.5, 0, 0.5][Math.floor(rnd() * 3)], { nitro: k }));

    // препятствия и элементы трассы
    const lane = () => [-0.55, 0, 0.55][Math.floor(rnd() * 3)];
    const ob = def.obs || {};
    for (const f of ob.ramps || []) { const i = Math.floor(N * f); put(i, S.ramp, lane() * 0.6); }
    for (const f of ob.pads || []) { const i = Math.floor(N * f); const o = lane(); put(i, S.pad, o, { part: 1 }); put(i + 1, S.pad, o, { part: 0 }); }
    for (const f of ob.slicks || []) { const i = Math.floor(N * f); const o = lane(); put(i, S[ob.slick], o, { part: 1 }); put(i + 1, S[ob.slick], o, { part: 0 }); }
    for (const f of ob.barrels || []) { const i = Math.floor(N * f); const o = lane(); put(i, S.barrels, o); put(i + 6, S.barrels, o > 0 ? -0.6 : 0.6); }
    // движущиеся препятствия: катаются поперёк дороги (по общему времени гонки — одинаково у обоих игроков)
    (ob.movers || []).forEach((f, k) => {
      const i = Math.floor(N * f);
      for (let j = 0; j < 3; j++) put(i + j * 7, S[ob.mover], 0, { move: { amp: 0.75, per: 2600 + k * 400 + j * 300, ph: k * 1.7 + j * 2.1 } });
    });

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
      groundTex: groundTexture(def, rnd), roadTex: roadTexture(def, rnd),
      zoneTex: {
        water: waterTexture(rnd), ice: iceTexture(rnd), tunnel: rockTexture(def, rnd),
        bridgeRoad: planksTexture(rnd), iceRoad: roadTexture(Object.assign({}, def, { road: '#8fb2d4', lane: '#e8f4ff' }), rnd),
      },
      farImg: panorama(def.far, def), nearImg: panorama(def.near, def) };
  }

  function get(id) {
    const def = DEFS.find((d) => d.id === id) || DEFS[0];
    return cache[def.id] || (cache[def.id] = build(def));
  }

  return { SEG, ROAD, RUMBLE, list: DEFS, get, PW, PH, GT, RT_W, RT_H, ROAD_SPAN };
})();
