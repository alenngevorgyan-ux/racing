// Tracks: geometry (curves/hills/width), theme (sky, backdrop, palette), scenery, obstacles.
// Each track can be built as EASY or HARD (more obstacles, narrow sections, faster movers).
const Tracks = (() => {
  const SEG = 200, RUMBLE = 3, ROAD = 2000;
  const S = Art.S;

  const DEFS = [
    {
      id: 'canyon', name: 'Red Canyon',
      sky: ['#e8823e', '#f6b26b', '#ffe2b0'], sun: { x: 0.72, y: 0.55, r: 16, c: '#fff4cf' },
      far: { type: 'mesa', c: '#a8492f', seed: 3 }, near: { type: 'dunes', c: '#cf7f45', seed: 5 },
      ground: '#d99a5b', road: '#6f625c', rumble: ['#b33b2a', '#e6d2b0'], lane: '#efe0bd', edge: '#e6d2b0', fog: '#f4c58e',
      side: [['cactus', 4], ['rockRed', 3], ['deadTree', 1]], chance: 0.5, walls: S.pillar,
      zones: [{ from: 0.3, to: 0.4, type: 'tunnel', arch: 'rockArch' }],
      narrow: [[0.55, 0.62], [0.85, 0.9]],
      obs: { ramps: [0.17, 0.62], pads: [0.08, 0.46, 0.7], slick: 'oil', slicks: [0.26, 0.88], barrels: [0.55, 0.93], mover: 'tumbleweed', movers: [0.2, 0.5, 0.78] },
      layout: [[10, 20, 10, 0, 0], [20, 20, 20, 7, 4], [15, 10, 15, -7, -4], [25, 40, 25, 3, 0], [30, 60, 30, 0, 18],
        [20, 30, 20, 6, -14], [15, 15, 15, -7, -4], [25, 50, 25, 5, 8], [25, 40, 25, 0, -8], [15, 20, 15, -8, 0],
        [30, 40, 30, 4, 10], [30, 30, 30, 3, -10], [25, 50, 25, 0, 0], [20, 30, 20, 5, 0]],
    },
    {
      id: 'coast', name: 'Sunny Coast',
      sky: ['#2f7fd6', '#7fbdf0', '#d6eeff'], sun: { x: 0.25, y: 0.3, r: 14, c: '#fffbe6' }, clouds: true,
      far: { type: 'sea', c: '#2f78c4', seed: 7 }, near: { type: 'dunes', c: '#e9cf8e', seed: 9 },
      ground: '#e8cf8a', road: '#85858f', rumble: ['#f2f2f2', '#d94a3f'], lane: '#ffffff', edge: '#ffffff', fog: '#cfe6fb',
      side: [['palm', 6], ['umbrella', 1], ['rockGrey', 2], ['bush', 1]], chance: 0.5,
      zones: [{ from: 0.4, to: 0.53, type: 'bridge' }, { from: 0.78, to: 0.84, type: 'bridge' }],
      narrow: [[0.44, 0.5]],
      obs: { ramps: [0.37, 0.75], pads: [0.15, 0.6, 0.9], slick: 'oil', slicks: [0.28], barrels: [0.67], mover: 'crab', movers: [0.1, 0.23, 0.32, 0.88] },
      layout: [[10, 20, 10, 0, 0], [50, 100, 50, 2, 4], [40, 80, 40, -2, -4], [50, 100, 50, 3, 0], [40, 60, 40, 0, 8],
        [50, 80, 50, -3, -8], [50, 100, 50, 4, 0], [40, 60, 40, 1, 5], [40, 80, 40, 2, -5]],
    },
    {
      id: 'forest', name: 'Sunset Forest',
      sky: ['#2e2350', '#9a4f73', '#f0a165'], sun: { x: 0.6, y: 0.8, r: 18, c: '#ffd59a' },
      far: { type: 'mountains', c: '#5a3f6e', seed: 11 }, near: { type: 'treeline', c: '#2c4a36', seed: 13 },
      ground: '#4f8a3c', road: '#5d5d66', rumble: ['#d8d8d8', '#7a4b2a'], lane: '#e8e2d0', edge: '#d8d8d8', fog: '#b9817f',
      side: [['pine', 5], ['tree', 3], ['treeAutumn', 2], ['log', 1], ['mushroom', 1], ['mushBounce', 1], ['bush', 2]], chance: 0.75,
      zones: [{ from: 0.18, to: 0.26, type: 'tunnel', arch: 'woodArch' }, { from: 0.58, to: 0.66, type: 'bridge' }],
      narrow: [[0.4, 0.46]],
      obs: { ramps: [0.12, 0.56], pads: [0.32, 0.72, 0.92], slick: 'mud', slicks: [0.4, 0.8, 0.95], barrels: [0.48], mover: 'rollLog', movers: [0.3, 0.7, 0.86] },
      layout: [[10, 20, 10, 0, 0], [25, 25, 25, -4, 10], [25, 25, 25, 4, -10], [25, 25, 25, -5, 0], [25, 25, 25, 5, 12],
        [30, 30, 30, 3, -12], [25, 50, 25, 0, 10], [25, 25, 25, 6, -6], [25, 25, 25, -6, -4], [30, 40, 30, 4, 0],
        [25, 25, 25, -3, 8], [25, 25, 25, 5, -8], [30, 30, 30, 4, 0]],
    },
    {
      id: 'snow', name: 'Night Pass',
      sky: ['#070b24', '#1f2b5e', '#4d5c94'], moon: { x: 0.78, y: 0.3, r: 12 }, stars: true,
      far: { type: 'snowpeaks', c: '#38406e', seed: 17 }, near: { type: 'snowhills', c: '#c9d6ea', seed: 19 },
      ground: '#dde6f2', road: '#474b58', rumble: ['#b83030', '#eeeeee'], lane: '#f0f0f0', edge: '#eeeeee', fog: '#56628f',
      side: [['snowPine', 7], ['rockIce', 2], ['snowman', 1]], chance: 0.6, lamps: S.lamp,
      zones: [{ from: 0.22, to: 0.38, type: 'ice' }, { from: 0.62, to: 0.7, type: 'tunnel', arch: 'iceArch' }],
      narrow: [[0.45, 0.52], [0.8, 0.86]],
      obs: { ramps: [0.15, 0.5, 0.85], pads: [0.08, 0.44, 0.76], barrels: [0.55], mover: 'snowball', movers: [0.12, 0.3, 0.48, 0.9] },
      layout: [[10, 20, 10, 0, 0], [40, 60, 40, 0, 25], [30, 30, 30, 6, -10], [30, 30, 30, 6, -15], [40, 60, 40, -3, 20],
        [30, 40, 30, -6, -20], [40, 40, 40, 4, 0], [30, 40, 30, 6, 15], [40, 60, 40, 0, -15], [30, 30, 30, -5, 10], [30, 30, 30, 5, -10]],
    },
    {
      id: 'neon', name: 'Neon City',
      sky: ['#05010f', '#2a0a4a', '#8a1a6a'], stars: true,
      far: { type: 'city', c: '#1a1030', seed: 23 }, near: { type: 'city', c: '#2a1650', seed: 29, near: true },
      ground: '#1c1a2a', groundStyle: 'grid', road: '#2c2c3a', rumble: ['#ff2a9a', '#2af0ff'], lane: '#ffe14a', edge: '#2af0ff', fog: '#3a1050',
      side: [['building', 4], ['building2', 4], ['neonA', 1], ['neonB', 1], ['neonC', 1]], chance: 0.85, sideMin: 1.9, lamps: S.lampNeon,
      zones: [{ from: 0.25, to: 0.33, type: 'tunnel', arch: 'neonArch' }, { from: 0.62, to: 0.7, type: 'tunnel', arch: 'neonArch' }],
      narrow: [[0.45, 0.52], [0.75, 0.8]],
      obs: { ramps: [0.2, 0.58, 0.9], pads: [0.06, 0.14, 0.38, 0.55, 0.82], slick: 'oil', slicks: [0.35, 0.74], barrels: [0.42], mover: 'hoverBot', movers: [0.1, 0.4, 0.86] },
      layout: [[10, 20, 10, 0, 0], [20, 40, 20, 0, 0], [10, 10, 10, 8, 0], [20, 40, 20, 0, 0], [10, 10, 10, -8, 0],
        [30, 60, 30, 0, 14], [20, 20, 20, 6, -14], [10, 10, 10, -8, 0], [10, 10, 10, 8, 0], [30, 50, 30, 0, 0],
        [15, 15, 15, 7, 6], [15, 15, 15, -7, -6], [30, 60, 30, 3, 0], [20, 20, 20, 8, 0]],
    },
    {
      id: 'volcano', name: 'Volcano Rush',
      sky: ['#140404', '#5a1408', '#d0461a'], sun: { x: 0.3, y: 0.85, r: 20, c: '#ffb070' },
      far: { type: 'volcano', c: '#2a1410', seed: 31 }, near: { type: 'dunes', c: '#3a1c14', seed: 37 },
      ground: '#3a2c28', groundStyle: 'basalt', road: '#3a3438', rumble: ['#ff6a1a', '#2a2a2a'], lane: '#ffb84a', edge: '#ff8a2a', fog: '#7a2a14',
      side: [['lavaRock', 4], ['deadTree', 2], ['rockRed', 1]], chance: 0.55,
      zones: [{ from: 0.18, to: 0.28, type: 'lava' }, { from: 0.42, to: 0.5, type: 'tunnel', arch: 'lavaArch' }, { from: 0.66, to: 0.78, type: 'lava' }],
      narrow: [[0.2, 0.26], [0.7, 0.76]],
      obs: { ramps: [0.3, 0.62], pads: [0.1, 0.55, 0.85], slick: 'oil', slicks: [0.36, 0.92], barrels: [0.58], mover: 'fireball', movers: [0.12, 0.34, 0.82, 0.94] },
      layout: [[10, 20, 10, 0, 0], [30, 40, 30, 3, 20], [20, 20, 20, -6, -10], [20, 30, 20, 6, -10], [30, 60, 30, 0, 0],
        [15, 15, 15, -8, 12], [15, 15, 15, 8, -12], [40, 60, 40, -2, 25], [30, 30, 30, 5, -25], [30, 60, 30, 0, 0],
        [20, 20, 20, -5, 8], [20, 20, 20, 5, -8]],
    },
    {
      id: 'jungle', name: 'Jungle Ruins',
      sky: ['#2a6a7a', '#8ac8b8', '#e8f4d0'], sun: { x: 0.65, y: 0.35, r: 14, c: '#fffbe0' }, clouds: true,
      far: { type: 'mountains', c: '#3a6a5a', seed: 41 }, near: { type: 'treeline', c: '#1e4a2a', seed: 43 },
      ground: '#3e7a32', road: '#7a6a58', rumble: ['#c8a870', '#6a5a40'], lane: '#e8d8b0', edge: '#c8a870', fog: '#a8d0b8',
      side: [['jungleTree', 5], ['palm', 2], ['ruinPillar', 2], ['bush', 2], ['mushBounce', 1]], chance: 0.8,
      zones: [{ from: 0.28, to: 0.36, type: 'tunnel', arch: 'stoneArch' }, { from: 0.55, to: 0.64, type: 'bridge' }],
      narrow: [[0.58, 0.62], [0.82, 0.88]],
      obs: { ramps: [0.2, 0.52, 0.9], pads: [0.1, 0.42, 0.7], slick: 'mud', slicks: [0.16, 0.46, 0.76], barrels: [0.68], mover: 'boulder', movers: [0.13, 0.4, 0.72, 0.94] },
      layout: [[10, 20, 10, 0, 0], [20, 20, 20, -5, 8], [20, 20, 20, 5, -8], [20, 20, 20, -6, 0], [25, 25, 25, 6, 10],
        [30, 40, 30, 0, -10], [15, 15, 15, 8, 0], [15, 15, 15, -8, 0], [30, 30, 30, 3, 14], [30, 30, 30, -3, -14],
        [20, 20, 20, 6, 0], [25, 40, 25, -4, 6], [25, 25, 25, 5, -6]],
    },
    {
      id: 'sky', name: 'Sky Road',
      sky: ['#5aa0ff', '#b8d8ff', '#ffe8f4'], sun: { x: 0.8, y: 0.25, r: 16, c: '#fffbe6' }, clouds: true,
      far: { type: 'cloudbank', c: '#f4f6ff', seed: 47 }, near: { type: 'cloudbank', c: '#ffffff', seed: 53, near: true },
      ground: '#e8eeff', groundStyle: 'clouds', road: '#ece4f4', rumble: ['#ffd84a', '#ffffff'], lane: '#ff8ac8', edge: '#ffd84a', fog: '#eef2ff',
      side: [['cloudPuff', 5], ['skyPillar', 3]], chance: 0.5, sideMin: 1.5, fallOff: true,
      zones: [{ from: 0.3, to: 0.36, type: 'arches', arch: 'rainbowArch' }, { from: 0.7, to: 0.75, type: 'arches', arch: 'rainbowArch' }],
      narrow: [[0.15, 0.22], [0.5, 0.58], [0.86, 0.92]],
      obs: { ramps: [0.12, 0.4, 0.64, 0.95], pads: [0.05, 0.25, 0.46, 0.68, 0.8], barrels: [], mover: 'thunderCloud', movers: [0.2, 0.55, 0.84] },
      layout: [[10, 20, 10, 0, 0], [30, 50, 30, 3, 20], [30, 50, 30, -3, -20], [15, 15, 15, 7, 0], [15, 15, 15, -7, 0],
        [40, 40, 40, 0, 25], [20, 20, 20, 6, -10], [20, 20, 20, 6, -15], [30, 60, 30, -4, 0], [20, 30, 20, 5, 12], [20, 30, 20, -5, -12]],
    },
  ];

  // ---------- Backdrops (seamless 1024 wide) ----------
  const PW = 1024, PH = 150;
  function periodic(seed, x, harmonics) {
    let v = 0;
    for (const [k, a, p] of harmonics) v += a * Math.sin((x / PW) * Math.PI * 2 * k + p + seed);
    return v;
  }
  function panorama(layer) {
    const c = layer.c, sd = layer.seed;
    return Art.mk(PW, PH, (g) => {
      if (layer.type === 'city') {
        let s = sd;
        const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
        for (let x = 0; x < PW;) {
          const w = 30 + r() * 50, h = (layer.near ? 30 : 60) + r() * (layer.near ? 50 : 80);
          g.fillStyle = Art.shade(c, (r() - 0.5) * 0.2); g.fillRect(x, PH - h, w, h);
          for (let y = PH - h + 6; y < PH - 4; y += 7) for (let xx = x + 4; xx < x + w - 4; xx += 7) {
            if (r() < 0.35) { g.fillStyle = r() < 0.25 ? '#ff2a9a' : r() < 0.4 ? '#2af0ff' : '#ffe9a8'; g.globalAlpha = 0.7; g.fillRect(xx, y, 3, 3); g.globalAlpha = 1; }
          }
          x += w + r() * 6;
        }
        return;
      }
      if (layer.type === 'cloudbank') {
        for (let i = 0; i < 60; i++) {
          const x = (i / 60) * PW, y = PH - (layer.near ? 10 : 30) - Math.abs(periodic(sd, x, [[5, 1, 0], [11, 0.5, 1]])) * 30;
          const r = (layer.near ? 26 : 40) + ((i * 37) % 20);
          for (const dx of [-PW, 0, PW]) {
            const gr = g.createRadialGradient(x + dx - r * 0.3, y - r * 0.3, 2, x + dx, y, r);
            gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, Art.shade(c, -0.12));
            g.fillStyle = gr; g.beginPath(); g.arc(x + dx, y, r, 0, 7); g.fill();
          }
        }
        g.fillStyle = c; g.fillRect(0, PH - 12, PW, 12);
        return;
      }
      if (layer.type === 'volcano') {
        for (const [cx, w, h, glow] of [[260, 260, 120, true], [760, 200, 80, false]]) {
          g.beginPath(); g.moveTo(cx - w, PH); g.lineTo(cx - 26, PH - h); g.lineTo(cx + 26, PH - h); g.lineTo(cx + w, PH); g.closePath();
          const gr = g.createLinearGradient(0, PH - h, 0, PH); gr.addColorStop(0, Art.shade(c, 0.1)); gr.addColorStop(1, Art.shade(c, -0.2));
          g.fillStyle = gr; g.fill();
          if (glow) {
            const gl = g.createRadialGradient(cx, PH - h, 4, cx, PH - h, 60); gl.addColorStop(0, 'rgba(255,140,40,.9)'); gl.addColorStop(1, 'rgba(255,80,0,0)');
            g.fillStyle = gl; g.fillRect(cx - 60, PH - h - 60, 120, 120);
            g.strokeStyle = '#ff6a1a'; g.lineWidth = 3;
            for (const dx of [-14, 4, 16]) { g.beginPath(); g.moveTo(cx + dx, PH - h); g.lineTo(cx + dx * 2.5, PH - h + 50 + Math.abs(dx) * 2); g.stroke(); }
          }
        }
        return;
      }
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
      if (layer.type === 'mesa') for (let y = 0; y < PH; y += 6) { g.fillStyle = (y / 6) % 2 ? 'rgba(255,200,150,.12)' : 'rgba(80,20,10,.12)'; g.fillRect(0, y, PW, 3); }
      if (layer.type === 'mountains' || layer.type === 'snowpeaks') {
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

  // ---------- Textures ----------
  const GT = 128, RT_W = 256, RT_H = 64, ROAD_SPAN = 1.18;
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
    if (def.groundStyle === 'grid') {
      return pixels(GT, GT, (x, y) => {
        if (x % 32 === 0 || y % 32 === 0) return (x + y) % 64 < 32 ? [255, 42, 154] : [42, 240, 255];
        const k = 1 + (n2(x, y) - 0.5) * 0.3;
        return base.map((v) => v * k);
      });
    }
    if (def.groundStyle === 'basalt') {
      return pixels(GT, GT, (x, y) => {
        const crack = Math.abs(n2(x, y) - 0.5) < 0.025;
        if (crack) return [255, 110 + rnd() * 60, 20];
        const k = 0.8 + n1(x, y) * 0.4 + (rnd() - 0.5) * 0.1;
        return base.map((v) => v * k);
      });
    }
    if (def.groundStyle === 'clouds') {
      return pixels(GT, GT, (x, y) => { const k = n1(x, y) * 0.6 + n2(x, y) * 0.4; return [215 + k * 40, 225 + k * 30, 250]; });
    }
    const c = pixels(GT, GT, (x, y) => {
      const k = (n1(x, y) - 0.5) * 0.22 + (n2(x, y) - 0.5) * 0.14 + (rnd() - 0.5) * 0.12;
      return base.map((v) => v * (1 + k));
    });
    const g = c.getContext('2d');
    for (let i = 0; i < 160; i++) {
      const x = Math.floor(rnd() * GT), y = Math.floor(rnd() * GT);
      if (def.id === 'forest' || def.id === 'jungle') { g.fillStyle = rnd() < 0.5 ? Art.shade(def.ground, 0.25) : Art.shade(def.ground, -0.3); g.fillRect(x, y, 1, 3); }
      else if (def.id === 'snow') { g.fillStyle = rnd() < 0.7 ? '#ffffff' : '#b8c8e4'; g.fillRect(x, y, 1, 1); }
      else { g.fillStyle = Art.shade(def.ground, rnd() < 0.5 ? -0.25 : 0.18); g.fillRect(x, y, rnd() < 0.3 ? 2 : 1, 1); }
    }
    if (def.id === 'canyon' || def.id === 'coast') {
      g.strokeStyle = Art.shade(def.ground, -0.12); g.lineWidth = 1;
      for (let y = 6; y < GT; y += 14) { g.beginPath(); for (let x = 0; x <= GT; x += 4) g.lineTo(x, y + Math.sin((x / GT) * Math.PI * 4 + y) * 2); g.stroke(); }
    }
    return c;
  }
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
      const wear = Math.abs(ar - 0.5) < 0.12 ? -0.06 : 0;
      const k = 1 + grain + (n(x * 0.25, y) - 0.5) * 0.1 + wear;
      return asp.map((v) => v * k);
    });
  }
  function waterTexture(rnd) {
    const n = tileNoise(rnd, GT, 8);
    return pixels(GT, GT, (x, y) => {
      const k = n(x, y), wave = Math.sin((y / GT) * Math.PI * 8 + k * 4);
      if (wave > 0.93) return [200, 235, 255];
      return [30 + k * 30, 110 + k * 50, 190 + k * 40];
    });
  }
  function lavaTexture(rnd) {
    const n = tileNoise(rnd, GT, 6), n2 = tileNoise(rnd, GT, 16);
    return pixels(GT, GT, (x, y) => {
      const k = n(x, y) * 0.7 + n2(x, y) * 0.3;
      if (k < 0.35) return [60, 20, 14];
      return [255, 80 + k * 150, 10 + k * 40];
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
    const base = { snow: [70, 90, 130], forest: [70, 52, 36], neon: [30, 20, 50], volcano: [50, 30, 26], jungle: [90, 86, 70] }[def.id] || [110, 58, 40];
    return pixels(GT, GT, (x, y) => { const k = 0.7 + n(x, y) * 0.5 + (rnd() - 0.5) * 0.15; return base.map((v) => v * k); });
  }
  function planksTexture(rnd) {
    return pixels(RT_W, RT_H, (x, y) => {
      const r = (x / RT_W) * 2 * ROAD_SPAN - ROAD_SPAN, ar = Math.abs(r);
      if (ar > 1.0) return [40, 70, 120];
      const plank = Math.floor(y / 8), seam = y % 8 === 0;
      const k = (seam ? 0.55 : 1) * (0.85 + ((plank * 37) % 7) * 0.04 + (rnd() - 0.5) * 0.12);
      if (ar < 0.022 && y % 16 < 8) return [240, 230, 200];
      return [150 * k, 100 * k, 60 * k];
    });
  }

  // ---------- Build ----------
  const cache = {};
  function build(def, diff) {
    const hard = diff === 'hard';
    const segs = [];
    let seed = def.layout.length * 7919 + def.id.length * 131 + (hard ? 17 : 0);
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const lastY = () => (segs.length ? segs[segs.length - 1].p2.world.y : 0);
    const easeIn = (a, b, p) => a + (b - a) * p * p;
    const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
    function add(curve, y) {
      const n = segs.length;
      segs.push({ index: n, curve, sprites: [], wm: 1,
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

    // zones
    for (const z of def.zones || []) {
      const a = Math.floor(N * z.from), b = Math.floor(N * z.to);
      for (let i = a; i < b; i++) { segs[i].zone = z.type; segs[i].arch = z.arch; }
    }
    const zoneAt = (i) => segs[((i % N) + N) % N].zone;
    // narrow sections (HARD only): road smoothly squeezes to 60%
    if (hard) for (const [f0, f1] of def.narrow || []) {
      const a = Math.floor(N * f0), b = Math.floor(N * f1), ramp = 14;
      for (let i = a; i < b; i++) {
        const t = Math.min(1, (i - a) / ramp, (b - i) / ramp);
        segs[i].wm = Math.min(segs[i].wm, 1 - 0.4 * (t * t * (3 - 2 * t)));
      }
    }
    for (let i = 0; i < N; i++) { segs[i].p1.wm = segs[i].wm; segs[i].p2.wm = segs[(i + 1) % N].wm; }

    // scenery
    const put = (i, spr, o, extra) => segs[((i % N) + N) % N].sprites.push(Object.assign({ def: spr, o }, extra));
    const pool = def.side.flatMap(([k, w]) => Array(w).fill(S[k]));
    const sideMin = def.sideMin || 1.55;
    put(START_SEG, Art.banner, 0);
    for (let i = 10; i < N; i++) {
      const zone = zoneAt(i);
      if (zone === 'tunnel' || zone === 'arches') { if (i % 3 === 0) put(i, S[segs[i].arch], 0); if (zone === 'tunnel') continue; }
      if (zone === 'bridge') { if (i % 2 === 0) { put(i, S.rail, -1.22); put(i, S.rail, 1.22); } continue; }
      if (zone === 'lava') { if (i % 2 === 0) { put(i, S.rail, -1.22); put(i, S.rail, 1.22); } if (i % 9 === 0) put(i, S.lavaRock, (rnd() < 0.5 ? -1 : 1) * (2.4 + rnd() * 2)); continue; }
      if (def.fallOff && i % 2 === 0) { put(i, S.skyRail, -1.22); put(i, S.skyRail, 1.22); }
      if (i % 3 === 0) for (const side of [-1, 1]) if (rnd() < def.chance * (zone === 'ice' ? 0.4 : 1)) put(i, pool[Math.floor(rnd() * pool.length)], side * (sideMin + rnd() * 2.8));
      if (def.walls && Math.abs(segs[i].curve) >= 3 && i % 2 === 0 && rnd() < 0.85) put(i, def.walls, (rnd() < 0.5 ? -1 : 1) * (2.15 + rnd() * 0.5));
      if (def.lamps && i % 14 === 0) put(i, def.lamps, (i % 28 ? 1 : -1) * 1.3);
    }
    // nitro cans: rare, 3 per lap
    [0.22, 0.52, 0.84].forEach((f, k) => put(Math.floor(N * f), S.nitro, [-0.5, 0, 0.5][Math.floor(rnd() * 3)], { nitro: k }));

    // obstacles
    const lane = () => [-0.55, 0, 0.55][Math.floor(rnd() * 3)];
    const ob = def.obs || {};
    const extra = (list, n) => (hard ? list.concat(list.map((f) => (f + 0.045 + rnd() * 0.03) % 1)).concat(Array.from({ length: n }, () => 0.1 + rnd() * 0.85)) : list);
    for (const f of ob.ramps || []) put(Math.floor(N * f), S.ramp, lane() * 0.6);
    for (const f of ob.pads || []) { const i = Math.floor(N * f); const o = lane(); put(i, S.pad, o, { part: 1 }); put(i + 1, S.pad, o, { part: 0 }); }
    if (ob.slick) for (const f of extra(ob.slicks || [], 1)) { const i = Math.floor(N * f); const o = lane(); put(i, S[ob.slick], o, { part: 1 }); put(i + 1, S[ob.slick], o, { part: 0 }); }
    for (const f of extra(ob.barrels || [], hard ? 3 : 0)) {
      const i = Math.floor(N * f);
      if (zoneAt(i) === 'bridge') continue;
      const o = lane(); put(i, S.barrels, o); put(i + 6, S.barrels, o > 0 ? -0.6 : 0.6);
      if (hard) put(i + 12, S.barrels, o);
    }
    // moving obstacles roll across the road on the shared race clock (same for both players)
    (ob.movers || []).forEach((f, k) => {
      const i = Math.floor(N * f), count = hard ? 5 : 3;
      for (let j = 0; j < count; j++) put(i + j * (hard ? 5 : 7), S[ob.mover], 0, { move: { amp: 0.75, per: (2600 + k * 400 + j * 300) * (hard ? 0.7 : 1), ph: k * 1.7 + j * 2.1 } });
    });

    // minimap: integrate curves to 2D and close the loop
    let sum = 0;
    for (const s of segs) sum += s.curve;
    // every curve bends the heading a little, plus an even drift so the outline always closes into one loop
    const k0 = 0.0042, bias = (Math.PI * 2 - k0 * sum) / N;
    let a = 0, x = 0, y = 0;
    const pts = [];
    for (let i = 0; i < N; i++) { pts.push([x, y]); a += segs[i].curve * k0 + bias; x += Math.cos(a); y += Math.sin(a); }
    const ex = x, ey = y;
    for (let i = 0; i < N; i++) { pts[i][0] -= (ex * i) / N; pts[i][1] -= (ey * i) / N; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of pts) { minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py); }

    const findSeg = (z) => segs[Math.floor((((z % LENGTH) + LENGTH) % LENGTH) / SEG) % N];
    return { def, diff, segs, N, LENGTH, START_Z: START_SEG * SEG, findSeg, map: { pts, minX, minY, maxX, maxY },
      groundTex: groundTexture(def, rnd), roadTex: roadTexture(def, rnd),
      zoneTex: {
        water: waterTexture(rnd), ice: iceTexture(rnd), tunnel: rockTexture(def, rnd), lava: lavaTexture(rnd),
        bridgeRoad: planksTexture(rnd), iceRoad: roadTexture(Object.assign({}, def, { road: '#8fb2d4', lane: '#e8f4ff' }), rnd),
      },
      farImg: panorama(def.far), nearImg: panorama(def.near) };
  }

  function get(id, diff = 'easy') {
    const def = DEFS.find((d) => d.id === id) || DEFS[0];
    const key = def.id + ':' + diff;
    return cache[key] || (cache[key] = build(def, diff));
  }

  return { SEG, ROAD, RUMBLE, list: DEFS, get, PW, PH, GT, RT_W, RT_H, ROAD_SPAN };
})();
