// Вся графика рисуется процедурно один раз в офскрин-канвасы ("спрайты"),
// а потом только масштабируется по перспективе. Ничего не вращается во время игры.
const Art = (() => {
  const INK = '#2a1f3d';
  const TAU = Math.PI * 2;

  function mk(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    return c;
  }
  function shade(hex, t) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const m = t < 0 ? 0 : 255, k = Math.abs(t);
    r = Math.round(r + (m - r) * k); g = Math.round(g + (m - g) * k); b = Math.round(b + (m - b) * k);
    return `rgb(${r},${g},${b})`;
  }
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function ell(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function heart(g, x, y, s) { // x — центр, y — верх, s — высота
    g.beginPath();
    g.moveTo(x, y + s * 0.3);
    g.bezierCurveTo(x, y, x - s * 0.55, y - s * 0.05, x - s * 0.55, y + s * 0.33);
    g.bezierCurveTo(x - s * 0.55, y + s * 0.62, x - s * 0.12, y + s * 0.82, x, y + s);
    g.bezierCurveTo(x + s * 0.12, y + s * 0.82, x + s * 0.55, y + s * 0.62, x + s * 0.55, y + s * 0.33);
    g.bezierCurveTo(x + s * 0.55, y - s * 0.05, x, y, x, y + s * 0.3);
    g.closePath();
  }
  function star(g, x, y, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
    }
    g.closePath();
  }
  function paint(g, fill, lw = 5) {
    g.fillStyle = fill; g.fill();
    if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(); }
  }
  // Силуэт из нескольких кругов с общей обводкой
  function blob(g, circles, fill, lw = 6) {
    g.fillStyle = INK;
    for (const [x, y, r] of circles) { ell(g, x, y, r + lw, r + lw); g.fill(); }
    g.fillStyle = fill;
    for (const [x, y, r] of circles) { ell(g, x, y, r, r); g.fill(); }
  }

  // ---------- Декорации ----------
  const scenery = {};

  scenery.tree = { w: 1300, hit: 0.35, img: mk(280, 360, (g) => {
    ell(g, 140, 344, 95, 14); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill();
    rr(g, 118, 210, 44, 138, 16); paint(g, '#9a6240');
    rr(g, 128, 230, 10, 90, 5); g.fillStyle = 'rgba(255,255,255,.18)'; g.fill();
    const c = [[140, 150, 96], [74, 192, 66], [206, 192, 66], [140, 82, 72]];
    blob(g, c, '#4fb84a');
    g.fillStyle = '#3e9e3c';
    for (const [x, y, r] of c) { ell(g, x, y + r * 0.35, r * 0.75, r * 0.5); g.fill(); }
    g.fillStyle = '#7fd86a';
    for (const [x, y, r] of c) { ell(g, x - r * 0.3, y - r * 0.35, r * 0.42, r * 0.3, -0.4); g.fill(); }
    g.fillStyle = '#ff5c8a';
    for (const [x, y] of [[100, 120], [178, 150], [140, 196], [64, 200], [212, 210], [150, 70]]) { ell(g, x, y, 7, 7); g.fill(); }
  }) };

  scenery.pine = { w: 1000, hit: 0.3, img: mk(220, 380, (g) => {
    ell(g, 110, 364, 70, 12); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill();
    rr(g, 94, 290, 32, 76, 10); paint(g, '#8a5636');
    const tri = (y, w, h) => { g.beginPath(); g.moveTo(110, y); g.lineTo(110 + w, y + h); g.quadraticCurveTo(110, y + h + 18, 110 - w, y + h); g.closePath(); };
    const layers = [[150, 100, 160], [80, 80, 140], [14, 58, 120]];
    for (const [y, w, h] of layers) { tri(y, w, h); g.lineWidth = 12; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(); }
    for (const [y, w, h] of layers) { tri(y, w, h); g.fillStyle = '#2f9e6a'; g.fill(); }
    g.fillStyle = '#4cc48a';
    for (const [y, w, h] of layers) { g.beginPath(); g.moveTo(110, y + 8); g.lineTo(110 - w * 0.6, y + h * 0.8); g.lineTo(110 - w * 0.2, y + h * 0.8); g.closePath(); g.fill(); }
    g.fillStyle = '#ffffff';
    for (const [x, y] of [[90, 100], [140, 170], [80, 240], [150, 260], [110, 50]]) { ell(g, x, y, 5, 5); g.fill(); }
  }) };

  scenery.bush = { w: 900, hit: 0, img: mk(240, 150, (g) => {
    ell(g, 120, 138, 105, 10); g.fillStyle = 'rgba(0,0,0,.15)'; g.fill();
    blob(g, [[70, 95, 46], [125, 78, 58], [180, 98, 44]], '#5cc152');
    g.fillStyle = '#86e070';
    ell(g, 105, 60, 26, 16, -0.3); g.fill();
    const fl = ['#ff6fa3', '#fff', '#ffd43b', '#ff6fa3', '#c084fc', '#fff'];
    [[60, 90], [100, 100], [140, 70], [175, 105], [120, 120], [80, 60]].forEach(([x, y], i) => {
      g.fillStyle = fl[i];
      for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; ell(g, x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 6); g.fill(); }
      g.fillStyle = '#ffb703'; ell(g, x, y, 4, 4); g.fill();
    });
  }) };

  scenery.flowers = { w: 520, hit: 0, img: mk(200, 90, (g) => {
    g.fillStyle = '#4fae45';
    for (let i = 0; i < 14; i++) { const x = 20 + i * 12; g.beginPath(); g.moveTo(x, 86); g.quadraticCurveTo(x + 6, 60, x + (i % 2 ? 10 : -6), 46); g.lineTo(x + 6, 86); g.fill(); }
    const fl = ['#ff5c8a', '#ffffff', '#ffd43b', '#b197fc'];
    [[40, 44], [80, 30], [120, 46], [160, 34], [100, 60], [60, 62], [146, 62]].forEach(([x, y], i) => {
      g.fillStyle = fl[i % 4];
      for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; ell(g, x + Math.cos(a) * 8, y + Math.sin(a) * 8, 7, 7); g.fill(); }
      g.fillStyle = '#ff9f1c'; ell(g, x, y, 5, 5); g.fill();
    });
  }) };

  scenery.balloon = { w: 650, hit: 0.15, img: mk(170, 330, (g) => {
    g.strokeStyle = '#6b5b7b'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(85, 150); g.bezierCurveTo(60, 200, 110, 250, 85, 316); g.stroke();
    rr(g, 70, 306, 30, 18, 6); paint(g, '#ffd43b', 4);
    heart(g, 85, 12, 140); paint(g, '#ff4d8d', 6);
    ell(g, 58, 50, 14, 24, 0.5); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
    ell(g, 64, 84, 5, 5); g.fill();
  }) };

  scenery.mushroom = { w: 600, hit: 0.3, img: mk(180, 170, (g) => {
    ell(g, 90, 160, 70, 9); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill();
    rr(g, 62, 80, 56, 82, 22); paint(g, '#fff1d6');
    g.beginPath(); g.moveTo(10, 96); g.bezierCurveTo(10, 10, 170, 10, 170, 96); g.quadraticCurveTo(90, 118, 10, 96); g.closePath();
    paint(g, '#ff4b5c', 6);
    g.fillStyle = '#fff';
    for (const [x, y, r] of [[60, 50, 14], [112, 42, 11], [140, 78, 9], [38, 80, 9], [90, 80, 10]]) { ell(g, x, y, r, r * 0.85); g.fill(); }
    ell(g, 72, 128, 6, 8); g.fillStyle = INK; g.fill(); ell(g, 108, 128, 6, 8); g.fill();
  }) };

  scenery.cone = { w: 320, hit: 0.9, img: mk(120, 150, (g) => {
    ell(g, 60, 142, 52, 8); g.fillStyle = 'rgba(0,0,0,.25)'; g.fill();
    rr(g, 10, 126, 100, 18, 6); paint(g, '#ff7a1a', 4);
    g.beginPath(); g.moveTo(52, 8); g.lineTo(68, 8); g.lineTo(96, 128); g.lineTo(24, 128); g.closePath(); paint(g, '#ff8c2a', 5);
    g.beginPath(); g.moveTo(42, 52); g.lineTo(78, 52); g.lineTo(84, 78); g.lineTo(36, 78); g.closePath(); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); g.moveTo(56, 12); g.lineTo(62, 12); g.lineTo(48, 120); g.lineTo(38, 120); g.closePath(); g.fillStyle = 'rgba(255,255,255,.3)'; g.fill();
  }) };

  scenery.heartPick = { w: 420, hit: 0, img: mk(170, 170, (g) => {
    const grd = g.createRadialGradient(85, 85, 10, 85, 85, 85);
    grd.addColorStop(0, 'rgba(255,170,210,.8)'); grd.addColorStop(1, 'rgba(255,170,210,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 170, 170);
    heart(g, 85, 30, 110); paint(g, '#ff2e74', 6);
    ell(g, 62, 60, 12, 18, 0.6); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
    g.fillStyle = '#fff59d';
    star(g, 140, 34, 13); g.fill(); star(g, 28, 120, 9); g.fill(); star(g, 148, 130, 7); g.fill();
  }) };

  function makeSign(text) {
    return { w: 1700, hit: 0.5, img: mk(400, 280, (g) => {
      ell(g, 200, 270, 170, 10); g.fillStyle = 'rgba(0,0,0,.15)'; g.fill();
      rr(g, 70, 150, 26, 125, 8); paint(g, '#9a6240');
      rr(g, 304, 150, 26, 125, 8); paint(g, '#9a6240');
      rr(g, 14, 18, 372, 160, 26); paint(g, '#ffe3ef', 7);
      rr(g, 30, 32, 340, 132, 18); g.lineWidth = 4; g.strokeStyle = '#ff8fb8'; g.stroke();
      g.fillStyle = '#e8336f';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '900 38px -apple-system, "Segoe UI", Roboto, sans-serif';
      const words = text.split(' ');
      const lines = [];
      let cur = '';
      for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (g.measureText(t).width > 310 && cur) { lines.push(cur); cur = w; } else cur = t;
      }
      lines.push(cur);
      const lh = 44, y0 = 98 - ((lines.length - 1) * lh) / 2;
      lines.forEach((l, i) => g.fillText(l, 200, y0 + i * lh));
      heart(g, 30, 4, 34); paint(g, '#ff4d8d', 4);
      heart(g, 370, 4, 34); paint(g, '#ff4d8d', 4);
    }) };
  }
  const signs = CONFIG.signs.map(makeSign);

  const banner = { w: 5600, hit: 0, img: mk(1000, 470, (g) => {
    for (const x of [30, 932]) {
      rr(g, x, 70, 38, 400, 12); paint(g, '#ffffff', 6);
      g.fillStyle = '#ff4d8d';
      for (let y = 90; y < 460; y += 60) g.fillRect(x + 3, y, 32, 30);
      heart(g, x + 19, 6, 70); paint(g, '#ff2e74', 6);
    }
    rr(g, 40, 70, 920, 120, 30); paint(g, '#ff4d8d', 8);
    for (let i = 0; i < 46; i++) {
      g.fillStyle = i % 2 ? '#fff' : INK;
      g.fillRect(70 + i * 19, 78, 19, 14);
      g.fillStyle = i % 2 ? INK : '#fff';
      g.fillRect(70 + i * 19, 168, 19, 14);
    }
    g.font = '900 64px -apple-system, "Segoe UI", Roboto, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = INK; g.lineJoin = 'round';
    g.strokeText('СТАРТ ♥ ФИНИШ', 500, 132);
    g.fillStyle = '#fff'; g.fillText('СТАРТ ♥ ФИНИШ', 500, 132);
  }) };

  // ---------- Персонажи ----------
  const CHARS = [
    { id: 'bunny', name: 'Зайка', fur: '#fbf7f5', inner: '#ffb3c7', muzzle: '#ffffff', shirt: '#ff5d8f', scarf: '#ffd43b', kart: '#ff4f9a', ears: 'bunny', nose: '#ff7aa2' },
    { id: 'cat', name: 'Котик', fur: '#ffa94d', inner: '#ffd8a8', muzzle: '#fff1e0', shirt: '#4dabf7', scarf: '#ff6b6b', kart: '#20c997', ears: 'cat', stripe: '#e8590c' },
    { id: 'bear', name: 'Мишка', fur: '#a86a3d', inner: '#e7c39a', muzzle: '#ecd0ad', shirt: '#ffd43b', scarf: '#e64980', kart: '#4c6ef5', ears: 'round' },
    { id: 'fox', name: 'Лиса', fur: '#ff7a2f', inner: '#fff4e6', muzzle: '#fff4e6', shirt: '#69db7c', scarf: '#845ef7', kart: '#fab005', ears: 'fox' },
    { id: 'panda', name: 'Панда', fur: '#ffffff', inner: '#3a3a3a', muzzle: '#ffffff', shirt: '#da77f2', scarf: '#38d9a9', kart: '#7048e8', ears: 'round', earColor: '#2b2b2b', patches: true },
  ];
  const charById = (id) => CHARS.find((c) => c.id === id) || CHARS[0];

  // Пропорции общие для всех персонажей и всех ракурсов
  const SW = 260, SH = 330, BY = 318; // размер спрайта и линия земли
  const HEAD_R = 42;

  function ears(g, ch, hx, hy, front) {
    const f = ch.earColor || ch.fur;
    if (ch.ears === 'bunny') {
      for (const s of [-1, 1]) {
        ell(g, hx + s * 18, hy - 66, 14, 40, s * 0.16); paint(g, f);
        if (front) { ell(g, hx + s * 18, hy - 64, 6, 28, s * 0.16); g.fillStyle = ch.inner; g.fill(); }
      }
    } else if (ch.ears === 'cat' || ch.ears === 'fox') {
      const tall = ch.ears === 'fox' ? 1.18 : 1;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(hx + s * 6, hy - 34);
        g.lineTo(hx + s * 34, hy - 34 - 38 * tall);
        g.lineTo(hx + s * 42, hy - 8);
        g.closePath(); paint(g, f);
        if (front) {
          g.beginPath(); g.moveTo(hx + s * 14, hy - 32); g.lineTo(hx + s * 32, hy - 30 - 30 * tall); g.lineTo(hx + s * 36, hy - 14); g.closePath();
          g.fillStyle = ch.inner; g.fill();
        }
        if (ch.ears === 'fox') {
          g.beginPath(); g.moveTo(hx + s * 26, hy - 56); g.lineTo(hx + s * 34, hy - 34 - 38 * tall); g.lineTo(hx + s * 38, hy - 54); g.closePath();
          g.fillStyle = '#4a2c1a'; g.fill();
        }
      }
    } else {
      for (const s of [-1, 1]) {
        ell(g, hx + s * 32, hy - 30, 16, 16); paint(g, f);
        if (front) { ell(g, hx + s * 32, hy - 30, 8, 8); g.fillStyle = ch.patches ? '#555' : ch.inner; g.fill(); }
      }
    }
  }

  function face(g, ch, hx, hy) {
    ell(g, hx, hy + 14, 22, 16); paint(g, ch.muzzle, 3);
    if (ch.patches) for (const s of [-1, 1]) { ell(g, hx + s * 16, hy - 2, 11, 14, s * 0.5); g.fillStyle = '#2b2b2b'; g.fill(); }
    for (const s of [-1, 1]) {
      ell(g, hx + s * 15, hy - 2, 6.5, 8.5); g.fillStyle = ch.patches ? '#fff' : '#1d1630'; g.fill();
      if (ch.patches) { ell(g, hx + s * 15, hy - 1, 4, 5.5); g.fillStyle = '#1d1630'; g.fill(); }
      ell(g, hx + s * 15 + 2, hy - 5, 2.4, 2.4); g.fillStyle = '#fff'; g.fill();
      ell(g, hx + s * 29, hy + 10, 9, 5); g.fillStyle = 'rgba(255,105,150,.55)'; g.fill();
    }
    ell(g, hx, hy + 7, 6, 4.5); g.fillStyle = ch.nose || INK; g.fill();
    g.beginPath();
    g.moveTo(hx - 9, hy + 14); g.quadraticCurveTo(hx - 4, hy + 21, hx, hy + 14); g.quadraticCurveTo(hx + 4, hy + 21, hx + 9, hy + 14);
    g.lineWidth = 3; g.strokeStyle = INK; g.lineCap = 'round'; g.stroke();
    if (ch.id === 'bunny') { rr(g, hx - 4, hy + 17, 8, 7, 2); paint(g, '#fff', 2); }
    if (ch.ears === 'cat') {
      g.lineWidth = 2.5;
      for (const s of [-1, 1]) for (const dy of [-3, 4]) {
        g.beginPath(); g.moveTo(hx + s * 22, hy + 12 + dy * 0.3); g.lineTo(hx + s * 44, hy + 8 + dy); g.stroke();
      }
    }
  }

  function scarfTail(g, ch, x, y, side) {
    g.beginPath();
    g.moveTo(x + side * 18, y - 46);
    g.quadraticCurveTo(x + side * 54, y - 44, x + side * 74, y - 62);
    g.lineTo(x + side * 78, y - 46);
    g.quadraticCurveTo(x + side * 52, y - 26, x + side * 12, y - 36);
    g.closePath(); paint(g, ch.scarf, 4);
  }

  // Водитель со спины. x,y — середина плеч
  function driverBack(g, ch, x, y, yaw, hit) {
    for (const s of [-1, 1]) { ell(g, x + s * 44, y - 10, 17, 24, -s * 0.35); paint(g, shade(ch.shirt, -0.15)); }
    rr(g, x - 42, y - 50, 84, 70, 30); paint(g, ch.shirt);
    const hx = x + yaw * 8, hy = y - 82 - (hit ? 6 : 0);
    ears(g, ch, hx, hy, false);
    ell(g, hx, hy, HEAD_R, HEAD_R - 2); paint(g, ch.fur);
    if (ch.stripe) {
      g.strokeStyle = ch.stripe; g.lineWidth = 6; g.lineCap = 'round';
      for (const dx of [-14, 0, 14]) { g.beginPath(); g.moveTo(hx + dx, hy - 36); g.lineTo(hx + dx * 1.1, hy - 18); g.stroke(); }
    }
    if (ch.id === 'fox' || ch.id === 'cat') { ell(g, hx, hy + 24, 26, 10); g.fillStyle = shade(ch.fur, -0.1); g.fill(); }
    ell(g, hx - 16, hy - 18, 12, 8, -0.5); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
    rr(g, x - 38, y - 56, 76, 18, 9); paint(g, ch.scarf, 4);
    scarfTail(g, ch, x, y, yaw ? -yaw : 1);
  }

  function wheel(g, x, y, w, h, hub) {
    rr(g, x - w / 2, y, w, h, 14); paint(g, '#272733');
    g.fillStyle = '#3c3c4c';
    for (let k = 1; k < 4; k++) g.fillRect(x - w / 2 + 6, y + (h * k) / 4 - 2, w - 12, 4);
    if (hub) { ell(g, x + hub, y + h / 2, 11, 13); paint(g, '#e9ecef', 3); }
  }

  function flameAt(g, x, y, f) {
    const L = f === 1 ? 26 : 36;
    const grd = g.createRadialGradient(x, y + 8, 2, x, y + 8, 40);
    grd.addColorStop(0, 'rgba(255,220,120,.95)'); grd.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = grd; g.fillRect(x - 40, y - 32, 80, 80);
    ell(g, x, y + L * 0.45, 15, L); g.fillStyle = '#ff8a1f'; g.fill();
    ell(g, x, y + L * 0.35, 9, L * 0.7); g.fillStyle = '#ffe66d'; g.fill();
    ell(g, x, y + 4, 5, 8); g.fillStyle = '#fff'; g.fill();
  }

  // Карт сзади (вид 3/4 сзади). yaw: -1 влево, 0 прямо, 1 вправо
  function drawKartRear(g, ch, yaw, flame, hit) {
    const cx = SW / 2, by = BY;
    const o = (d) => cx + yaw * d * 20; // смещение слоёв по глубине — даёт ракурс 3/4
    ell(g, cx + yaw * 6, by - 6, 118, 15); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill();

    for (const s of [-1, 1]) wheel(g, o(1) + s * 82, by - 96, 34, 42, 0);

    // корпус
    rr(g, o(0.5) - 102, by - 116, 204, 76, 28); paint(g, ch.kart);
    if (yaw) { rr(g, o(0.5) - yaw * 84 - 18, by - 108, 36, 60, 14); g.fillStyle = shade(ch.kart, -0.22); g.fill(); }
    rr(g, o(0.5) - 88, by - 110, 176, 16, 8); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();

    // флажок-сердечко на антенне
    const ax = o(0.15) + 86 * (yaw < 0 ? -1 : 1);
    g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.moveTo(ax, by - 100); g.lineTo(ax + yaw * 6, by - 236); g.stroke();
    heart(g, ax + yaw * 6 + (yaw < 0 ? -18 : 18), by - 250, 34); paint(g, '#ff2e74', 4);

    driverBack(g, ch, o(0.7), by - 128, yaw, hit);

    rr(g, o(0.35) - 54, by - 158, 108, 58, 24); paint(g, shade(ch.kart, -0.28));
    rr(g, o(0.35) - 40, by - 150, 80, 10, 5); g.fillStyle = 'rgba(255,255,255,.2)'; g.fill();

    // задний бампер, мотор, выхлопы
    rr(g, cx - 74, by - 70, 148, 46, 16); paint(g, '#41415a');
    heart(g, cx, by - 66, 24); g.fillStyle = '#fff'; g.fill();
    for (const s of [-1, 1]) {
      ell(g, cx + s * 40, by - 42, 13, 13); paint(g, '#a5abc0', 4);
      ell(g, cx + s * 40, by - 42, 6, 6); g.fillStyle = '#1b1b24'; g.fill();
    }
    for (const s of [-1, 1]) wheel(g, cx + s * 98, by - 74, 54, 70, 0);

    if (flame) for (const s of [-1, 1]) flameAt(g, cx + s * 40, by - 40, flame);

    if (hit) {
      const hy = by - 128 - 88 - 54;
      g.fillStyle = '#ffd43b';
      [[-46, 8], [0, -10], [46, 8]].forEach(([dx, dy]) => { star(g, o(0.7) + dx, hy + dy, 15); paint(g, '#ffe066', 3); });
      g.strokeStyle = '#fff'; g.lineWidth = 4;
      for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 120, by - 140, 14, 0, Math.PI, s < 0); g.stroke(); }
    }
  }

  // Карт спереди (вид 3/4 спереди) — для выбора персонажа
  function drawKartFront(g, ch) {
    const cx = SW / 2, by = BY;
    const k = (d) => cx + (0.5 - d) * 26;
    ell(g, cx, by - 6, 120, 15); g.fillStyle = 'rgba(0,0,0,.28)'; g.fill();
    for (const s of [-1, 1]) wheel(g, k(1) + s * 86, by - 112, 38, 44, 0);
    rr(g, k(0.8) - 52, by - 176, 104, 72, 24); paint(g, shade(ch.kart, -0.28));

    const x = k(0.6), y = by - 128;
    for (const s of [-1, 1]) { ell(g, x + s * 44, y - 14, 17, 24, s * 0.35); paint(g, shade(ch.shirt, -0.15)); }
    rr(g, x - 42, y - 50, 84, 70, 30); paint(g, ch.shirt);
    scarfTail(g, ch, x, y, 1);
    const hx = x - 6, hy = y - 82;
    ears(g, ch, hx, hy, true);
    ell(g, hx, hy, HEAD_R, HEAD_R - 2); paint(g, ch.fur);
    if (ch.stripe) {
      g.strokeStyle = ch.stripe; g.lineWidth = 5; g.lineCap = 'round';
      for (const dx of [-10, 2, 14]) { g.beginPath(); g.moveTo(hx + dx, hy - 38); g.lineTo(hx + dx, hy - 26); g.stroke(); }
    }
    face(g, ch, hx - 8, hy + 2);
    rr(g, x - 38, y - 56, 76, 18, 9); paint(g, ch.scarf, 4);
    ell(g, x - 4, y - 44, 10, 9); paint(g, shade(ch.scarf, -0.1), 3);

    // руль и лапки
    const wx = k(0.45), wy = by - 116;
    ell(g, wx, wy, 36, 13); g.lineWidth = 12; g.strokeStyle = INK; g.stroke();
    g.lineWidth = 7; g.strokeStyle = '#4a4a5e'; g.stroke();
    for (const s of [-1, 1]) { ell(g, wx + s * 32, wy - 2, 13, 12); paint(g, ch.fur, 4); }

    // кузов
    rr(g, k(0.3) - 104, by - 118, 208, 72, 30); paint(g, ch.kart);
    rr(g, k(0.3) + 66, by - 110, 34, 56, 14); g.fillStyle = shade(ch.kart, -0.2); g.fill();
    rr(g, k(0.3) - 90, by - 112, 150, 14, 7); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
    rr(g, k(0.1) - 64, by - 96, 128, 52, 22); paint(g, shade(ch.kart, 0.18), 4);
    heart(g, k(0.1), by - 92, 26); g.fillStyle = '#fff'; g.fill();
    for (const s of [-1, 1]) {
      ell(g, k(0.1) + s * 42, by - 66, 13, 11); paint(g, '#fff6a8', 4);
      ell(g, k(0.1) + s * 42 - 4, by - 69, 4, 3); g.fillStyle = '#fff'; g.fill();
    }
    rr(g, k(0) - 82, by - 44, 164, 20, 10); paint(g, '#41415a', 4);
    for (const s of [-1, 1]) wheel(g, k(0) + s * 104, by - 76, 56, 70, s * 4);
  }

  const kartCache = new Map();
  // pose: 'L' | 'C' | 'R' | 'H' (удар); flame: 0 | 1 | 2
  function kart(id, pose, flame) {
    const key = id + pose + flame;
    let c = kartCache.get(key);
    if (!c) {
      const ch = charById(id);
      const yaw = pose === 'L' ? -1 : pose === 'R' ? 1 : 0;
      c = mk(SW, SH, (g) => drawKartRear(g, ch, yaw, flame, pose === 'H'));
      kartCache.set(key, c);
    }
    return c;
  }
  const portraitCache = new Map();
  function portrait(id) {
    let c = portraitCache.get(id);
    if (!c) { c = mk(SW, SH, (g) => drawKartFront(g, charById(id))); portraitCache.set(id, c); }
    return c;
  }
  // Маленькая иконка-голова для мини-карты
  const headCache = new Map();
  function head(id) {
    let c = headCache.get(id);
    if (!c) {
      const ch = charById(id);
      c = mk(120, 140, (g) => { ears(g, ch, 60, 90, true); ell(g, 60, 90, HEAD_R, HEAD_R - 2); paint(g, ch.fur); face(g, ch, 60, 92); });
      headCache.set(id, c);
    }
    return c;
  }

  return { scenery, signs, banner, CHARS, charById, kart, portrait, head, SW, SH, BY, heart, shade };
})();
