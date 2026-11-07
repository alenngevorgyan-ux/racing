// Вся графика рисуется процедурно один раз в офскрин-канвасы ("спрайты"),
// с объёмными градиентами и зерном, а в игре только масштабируется по перспективе.
const Art = (() => {
  const TAU = Math.PI * 2;

  function mk(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    return c;
  }
  function rgb(c) {
    if (c[0] === '#') { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
    return c.match(/\d+/g).slice(0, 3).map(Number);
  }
  function shade(c, t) {
    const [r, g, b] = rgb(c);
    const m = t < 0 ? 0 : 255, k = Math.abs(t);
    return `rgb(${Math.round(r + (m - r) * k)},${Math.round(g + (m - g) * k)},${Math.round(b + (m - b) * k)})`;
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
  function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
  function star(g, x, y, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
    }
    g.closePath();
  }
  // вертикальный объёмный градиент (свет сверху)
  function vg(g, y0, y1, c, hi = 0.28, lo = -0.32) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, shade(c, hi)); gr.addColorStop(0.45, c); gr.addColorStop(1, shade(c, lo));
    return gr;
  }
  // горизонтальный (для цилиндров: стволы, канистры)
  function hg(g, x0, x1, c) {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, shade(c, -0.3)); gr.addColorStop(0.35, shade(c, 0.25)); gr.addColorStop(0.6, c); gr.addColorStop(1, shade(c, -0.45));
    return gr;
  }
  // сферический свет (головы, кроны)
  function sg(g, x, y, r, c) {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
    gr.addColorStop(0, shade(c, 0.35)); gr.addColorStop(0.5, c); gr.addColorStop(1, shade(c, -0.4));
    return gr;
  }
  // заливка + мягкий контур тоном темнее (без "наклеечной" чёрной обводки)
  function paint(g, fill, base, lw = 2.5) {
    g.fillStyle = fill; g.fill();
    if (lw && base) { g.lineWidth = lw; g.strokeStyle = shade(base, -0.55); g.lineJoin = 'round'; g.stroke(); }
  }
  // зерно — убирает "пластик", даёт фактуру
  function grain(c, amt = 18) {
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height);
    const a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      if (!a[i + 3]) continue;
      const n = (Math.random() - 0.5) * amt;
      a[i] += n; a[i + 1] += n; a[i + 2] += n;
    }
    g.putImageData(d, 0, 0);
    return c;
  }
  const art = (w, h, fn, amt) => grain(mk(w, h, fn), amt);
  const shadow = (g, x, y, rx, ry) => { ell(g, x, y, rx, ry); g.fillStyle = 'rgba(0,0,0,.28)'; g.fill(); };

  // ---------- Декорации ----------
  const S = {};

  function roundTree(canopy, fruit) {
    return art(220, 290, (g) => {
      shadow(g, 110, 278, 80, 11);
      rr(g, 94, 170, 32, 112, 10); paint(g, hg(g, 94, 126, '#7a4a2e'), '#7a4a2e');
      const c = [[110, 120, 74], [56, 152, 52], [164, 152, 52], [110, 66, 56]];
      for (const [x, y, r] of c) { ell(g, x, y, r, r); paint(g, sg(g, x, y, r, canopy), canopy, 2); }
      g.fillStyle = shade(canopy, 0.3);
      for (const [x, y, r] of c) { ell(g, x - r * 0.3, y - r * 0.4, r * 0.3, r * 0.18, -0.4); g.fill(); }
      if (fruit) { g.fillStyle = fruit; for (const [x, y] of [[80, 110], [140, 130], [108, 160], [60, 160]]) { ell(g, x, y, 5, 5); g.fill(); } }
    });
  }
  S.tree = { w: 1300, hit: 0.35, img: roundTree('#3f8f3a') };
  S.treeAutumn = { w: 1300, hit: 0.35, img: roundTree('#d9792b') };

  function pine(snow) {
    return art(200, 340, (g) => {
      shadow(g, 100, 328, 66, 10);
      rr(g, 86, 260, 28, 72, 8); paint(g, hg(g, 86, 114, '#6b4129'), '#6b4129');
      const col = snow ? '#2c6b55' : '#2d7a4f';
      const layers = [[130, 92, 150], [66, 74, 130], [8, 54, 112]];
      for (const [y, w, h] of layers) {
        poly(g, [[100, y], [100 + w, y + h], [100 - w, y + h]]);
        const gr = g.createLinearGradient(100 - w, 0, 100 + w, 0);
        gr.addColorStop(0, shade(col, 0.15)); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col, -0.4));
        paint(g, gr, col, 2);
        if (snow) {
          poly(g, [[100, y], [100 + w * 0.55, y + h * 0.5], [100 + w * 0.2, y + h * 0.42], [100, y + h * 0.55], [100 - w * 0.25, y + h * 0.4], [100 - w * 0.55, y + h * 0.5]]);
          g.fillStyle = '#eef4ff'; g.fill();
        }
      }
    });
  }
  S.pine = { w: 1000, hit: 0.3, img: pine(false) };
  S.snowPine = { w: 1050, hit: 0.3, img: pine(true) };

  S.palm = { w: 1500, hit: 0.2, img: art(260, 420, (g) => {
    shadow(g, 120, 408, 70, 10);
    for (let i = 0; i < 9; i++) {
      const t = i / 9, x = 120 + Math.sin(t * 1.6) * 40, y = 400 - t * 300;
      rr(g, x - 15 + t * 3, y - 36, 30 - t * 6, 38, 8); paint(g, hg(g, x - 15, x + 15, '#9c7046'), '#9c7046', 2);
    }
    const tx = 158, ty = 96;
    for (const [a, l] of [[-2.6, 120], [-2.0, 130], [-1.2, 110], [-0.4, 130], [0.2, 120], [-3.0, 100], [0.7, 100]]) {
      const ex = tx + Math.cos(a) * l, ey = ty + Math.sin(a) * l * 0.6 + 40;
      const mx = tx + Math.cos(a) * l * 0.5, my = ty + Math.sin(a) * l * 0.5 - 20;
      g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(mx, my - 14, ex, ey); g.quadraticCurveTo(mx, my + 14, tx, ty);
      paint(g, vg(g, ty - 60, ty + 60, '#3e9a3a'), '#3e9a3a', 2);
    }
    for (const [x, y] of [[150, 100], [166, 104], [158, 112]]) { ell(g, x, y, 9, 9); paint(g, sg(g, x, y, 9, '#7a5230'), '#7a5230', 1.5); }
  }) };

  S.cactus = { w: 900, hit: 0.3, img: art(170, 300, (g) => {
    shadow(g, 85, 290, 55, 9);
    const col = '#4f9a4a';
    const arm = (x, y, w, h, dir) => {
      rr(g, x, y + h - 22, (dir > 0 ? 1 : -1) * 0 + 44, 22, 11);
      g.save(); if (dir < 0) { g.translate(2 * x + 44, 0); g.scale(-1, 1); }
      rr(g, x, y + h - 24, 44, 24, 12); paint(g, vg(g, y + h - 24, y + h, col), col);
      rr(g, x + 22, y, w, h, w / 2); paint(g, hg(g, x + 22, x + 22 + w, col), col);
      g.restore();
    };
    arm(98, 90, 26, 100, 1);
    arm(28, 130, 24, 80, -1);
    rr(g, 60, 20, 50, 270, 25); paint(g, hg(g, 60, 110, col), col);
    g.strokeStyle = shade(col, -0.3); g.lineWidth = 2;
    for (const x of [72, 85, 98]) { g.beginPath(); g.moveTo(x, 34); g.lineTo(x, 282); g.stroke(); }
    ell(g, 85, 24, 10, 7); g.fillStyle = '#ff7aa8'; g.fill();
  }) };

  function rock(col, w = 1100) {
    return { w, hit: 0.6, img: art(220, 160, (g) => {
      shadow(g, 110, 150, 100, 10);
      const pts = [[14, 150], [28, 70], [80, 22], [150, 18], [196, 66], [208, 150]];
      poly(g, pts); paint(g, col, col);
      poly(g, [[28, 70], [80, 22], [150, 18], [120, 70], [60, 90]]); g.fillStyle = shade(col, 0.25); g.fill();
      poly(g, [[150, 18], [196, 66], [208, 150], [150, 150], [120, 70]]); g.fillStyle = shade(col, -0.3); g.fill();
      poly(g, [[14, 150], [28, 70], [60, 90], [70, 150]]); g.fillStyle = shade(col, -0.1); g.fill();
    }, 26) };
  }
  S.rockRed = rock('#b8603f');
  S.rockGrey = rock('#8d8a86');
  S.rockIce = rock('#9fc0dc');

  S.pillar = { w: 2200, hit: 0.65, img: art(240, 560, (g) => {
    const col = '#b5543a';
    const pts = [[10, 560], [18, 300], [8, 200], [30, 90], [70, 40], [150, 30], [200, 70], [222, 180], [212, 330], [232, 560]];
    poly(g, pts); paint(g, col, col);
    g.save(); poly(g, pts); g.clip();
    for (let y = 30; y < 560; y += 26) {
      g.fillStyle = (y / 26) % 2 ? shade(col, 0.12) : shade(col, -0.12);
      g.fillRect(0, y, 240, 13 + ((y * 7) % 9));
    }
    const gr = g.createLinearGradient(0, 0, 240, 0);
    gr.addColorStop(0, 'rgba(255,220,180,.25)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,0,0,.45)');
    g.fillStyle = gr; g.fillRect(0, 0, 240, 560);
    g.restore();
  }, 30) };

  S.deadTree = { w: 1000, hit: 0.2, img: art(200, 300, (g) => {
    shadow(g, 100, 290, 50, 8);
    g.strokeStyle = '#6e4b33'; g.lineCap = 'round';
    const br = (x, y, a, l, w) => {
      if (w < 2) return;
      const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l;
      g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
      br(ex, ey, a - 0.5, l * 0.68, w * 0.62); br(ex, ey, a + 0.45, l * 0.62, w * 0.6);
    };
    br(100, 292, -Math.PI / 2, 110, 18);
  }) };

  S.bush = { w: 900, hit: 0, img: art(220, 140, (g) => {
    shadow(g, 110, 130, 100, 10);
    for (const [x, y, r] of [[60, 92, 42], [170, 94, 40], [114, 74, 54]]) { ell(g, x, y, r, r * 0.85); paint(g, sg(g, x, y, r, '#4c9a3f'), '#4c9a3f', 2); }
  }) };

  S.log = { w: 1000, hit: 0.5, img: art(240, 100, (g) => {
    shadow(g, 120, 90, 110, 8);
    rr(g, 20, 34, 190, 54, 26); paint(g, vg(g, 34, 88, '#8a5a36'), '#8a5a36');
    ell(g, 206, 61, 18, 27); paint(g, '#d9b07a', '#8a5a36');
    g.strokeStyle = '#a77b4c'; g.lineWidth = 2; ell(g, 206, 61, 9, 14); g.stroke();
  }) };

  S.mushroom = { w: 600, hit: 0.3, img: art(180, 170, (g) => {
    shadow(g, 90, 160, 68, 8);
    rr(g, 64, 80, 52, 82, 20); paint(g, hg(g, 64, 116, '#efe0c4'), '#efe0c4');
    g.beginPath(); g.moveTo(12, 96); g.bezierCurveTo(12, 12, 168, 12, 168, 96); g.quadraticCurveTo(90, 116, 12, 96); g.closePath();
    paint(g, vg(g, 20, 110, '#c8392f'), '#c8392f');
    g.fillStyle = '#f4ece0';
    for (const [x, y, r] of [[60, 50, 12], [112, 42, 10], [140, 76, 8], [40, 78, 8], [90, 78, 9]]) { ell(g, x, y, r, r * 0.8); g.fill(); }
  }) };

  S.umbrella = { w: 1000, hit: 0.15, img: art(220, 260, (g) => {
    shadow(g, 110, 250, 60, 8);
    rr(g, 106, 60, 8, 192, 4); paint(g, '#ddd', '#888', 1.5);
    for (let i = 0; i < 8; i++) {
      const a0 = Math.PI + (i / 8) * Math.PI, a1 = Math.PI + ((i + 1) / 8) * Math.PI;
      g.beginPath(); g.moveTo(110, 60); g.lineTo(110 + Math.cos(a0) * 104, 80 + Math.sin(a0) * 60); g.lineTo(110 + Math.cos(a1) * 104, 80 + Math.sin(a1) * 60); g.closePath();
      g.fillStyle = i % 2 ? '#f5f0e6' : '#e0453a'; g.fill();
    }
    const gr = g.createLinearGradient(0, 20, 0, 90); gr.addColorStop(0, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(0,0,0,.25)');
    g.beginPath(); g.ellipse(110, 80, 104, 60, 0, Math.PI, TAU); g.fillStyle = gr; g.fill();
  }) };

  S.snowman = { w: 800, hit: 0.4, img: art(180, 260, (g) => {
    shadow(g, 90, 250, 60, 9);
    for (const [y, r] of [[200, 52], [124, 40], [64, 30]]) { ell(g, 90, y, r, r); paint(g, sg(g, 90, y, r, '#eef3fb'), '#9fb0c8', 2); }
    ell(g, 80, 58, 3.5, 3.5); g.fillStyle = '#222'; g.fill(); ell(g, 100, 58, 3.5, 3.5); g.fill();
    poly(g, [[90, 66], [118, 72], [90, 74]]); g.fillStyle = '#ff8a2a'; g.fill();
    rr(g, 58, 88, 64, 14, 7); paint(g, '#c0392b', '#c0392b', 1.5);
    rr(g, 62, 14, 56, 28, 4); paint(g, '#2a2a33', '#2a2a33', 1); rr(g, 52, 38, 76, 8, 3); paint(g, '#2a2a33', '#2a2a33', 1);
  }) };

  S.lamp = { w: 700, hit: 0.15, img: mk(120, 380, (g) => {
    const gl = g.createRadialGradient(60, 50, 4, 60, 50, 60);
    gl.addColorStop(0, 'rgba(255,230,160,.95)'); gl.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gl; g.fillRect(0, 0, 120, 120);
    rr(g, 54, 60, 12, 316, 4); paint(g, hg(g, 54, 66, '#3a3f4f'), '#3a3f4f', 1.5);
    rr(g, 40, 36, 40, 28, 6); paint(g, '#3a3f4f', '#3a3f4f', 1.5);
    rr(g, 46, 42, 28, 18, 4); g.fillStyle = '#fff3c4'; g.fill();
  }) };

  S.cone = { w: 320, hit: 0.9, img: art(120, 150, (g) => {
    shadow(g, 60, 142, 52, 8);
    rr(g, 10, 126, 100, 18, 5); paint(g, vg(g, 126, 144, '#e8661c'), '#e8661c');
    poly(g, [[52, 8], [68, 8], [96, 128], [24, 128]]); paint(g, hg(g, 24, 96, '#f2782a'), '#f2782a');
    poly(g, [[42, 52], [78, 52], [84, 78], [36, 78]]); g.fillStyle = '#f2efe8'; g.fill();
  }) };

  // нитро-канистра — редкий бустер
  S.nitro = { w: 420, hit: 0, img: mk(160, 190, (g) => {
    const gl = g.createRadialGradient(80, 95, 10, 80, 95, 80);
    gl.addColorStop(0, 'rgba(120,200,255,.7)'); gl.addColorStop(1, 'rgba(120,200,255,0)');
    g.fillStyle = gl; g.fillRect(0, 0, 160, 190);
    rr(g, 44, 40, 72, 120, 18); paint(g, hg(g, 44, 116, '#1e6fd9'), '#1e6fd9', 3);
    rr(g, 64, 22, 32, 24, 6); paint(g, hg(g, 64, 96, '#b8c2d0'), '#8a96a8', 2);
    rr(g, 44, 70, 72, 44, 4); g.fillStyle = '#f2f5fa'; g.fill();
    g.font = '900 40px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#e8332b'; g.fillText('N', 80, 93);
    g.fillStyle = 'rgba(255,255,255,.4)'; rr(g, 54, 46, 10, 106, 5); g.fill();
  }) };

  function makeSign(text) {
    return { w: 1700, hit: 0.5, img: art(400, 280, (g) => {
      shadow(g, 200, 270, 170, 10);
      for (const x of [70, 304]) { rr(g, x, 150, 26, 125, 6); paint(g, hg(g, x, x + 26, '#7a4f31'), '#7a4f31'); }
      rr(g, 14, 18, 372, 160, 10); paint(g, vg(g, 18, 178, '#c99a62', 0.2, -0.25), '#7a4f31', 4);
      g.strokeStyle = 'rgba(90,55,30,.35)'; g.lineWidth = 2;
      for (let y = 46; y < 176; y += 30) { g.beginPath(); g.moveTo(20, y); g.lineTo(380, y); g.stroke(); }
      g.fillStyle = '#fff6e0';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '900 36px Arial Black, Arial, sans-serif';
      const lines = []; let cur = '';
      for (const w of text.split(' ')) {
        const t = cur ? cur + ' ' + w : w;
        if (g.measureText(t).width > 330 && cur) { lines.push(cur); cur = w; } else cur = t;
      }
      lines.push(cur);
      const lh = 42, y0 = 98 - ((lines.length - 1) * lh) / 2;
      lines.forEach((l, i) => { g.fillStyle = 'rgba(60,30,10,.6)'; g.fillText(l, 203, y0 + i * lh + 3); g.fillStyle = '#fff6e0'; g.fillText(l, 200, y0 + i * lh); });
    }) };
  }
  const signs = CONFIG.signs.map(makeSign);

  const banner = { w: 5600, hit: 0, img: art(1000, 460, (g) => {
    for (const x of [30, 932]) {
      rr(g, x, 60, 38, 400, 8); paint(g, hg(g, x, x + 38, '#c8ccd6'), '#8a90a0');
    }
    rr(g, 40, 60, 920, 120, 10); paint(g, vg(g, 60, 180, '#d23b2f'), '#7a1a14', 4);
    for (let i = 0; i < 46; i++) {
      g.fillStyle = i % 2 ? '#f2f2f2' : '#1c1c22';
      g.fillRect(70 + i * 19, 68, 19, 12);
      g.fillStyle = i % 2 ? '#1c1c22' : '#f2f2f2';
      g.fillRect(70 + i * 19, 160, 19, 12);
    }
    g.font = '900 66px Arial Black, Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillText('СТАРТ  /  ФИНИШ', 505, 126);
    const tg = g.createLinearGradient(0, 96, 0, 150); tg.addColorStop(0, '#fff6b0'); tg.addColorStop(1, '#ffb52e');
    g.fillStyle = tg; g.fillText('СТАРТ  /  ФИНИШ', 500, 121);
  }) };

  // ---------- Препятствия и элементы трассы ----------
  S.barrels = { w: 700, hit: 0.85, img: art(220, 200, (g) => {
    shadow(g, 110, 190, 100, 10);
    const barrel = (x, y, c) => {
      rr(g, x - 34, y - 80, 68, 80, 10); paint(g, hg(g, x - 34, x + 34, c), c);
      for (const yy of [y - 64, y - 22]) { g.fillStyle = Art_shadeLocal(c, -0.35); g.fillRect(x - 34, yy, 68, 6); }
      ell(g, x, y - 80, 34, 8); paint(g, shade(c, 0.2), c, 1.5);
      g.fillStyle = '#ffd84a'; g.font = '900 22px Arial Black, Arial'; g.textAlign = 'center'; g.fillText('!', x, y - 34);
    };
    barrel(70, 190, '#c0392b'); barrel(150, 190, '#2d6fb5'); barrel(110, 118, '#d98a1c');
  }) };
  function Art_shadeLocal(c, t) { return shade(c, t); }

  // плоские "наклейки" на дорогу (рисуются в плоскости дороги)
  function puddle(c1, c2, shine) {
    return art(240, 120, (g) => {
      ell(g, 120, 60, 112, 52); g.fillStyle = c1; g.fill();
      ell(g, 110, 56, 80, 34); g.fillStyle = c2; g.fill();
      if (shine) { g.fillStyle = 'rgba(160,120,255,.35)'; ell(g, 90, 46, 34, 10, -0.2); g.fill(); g.fillStyle = 'rgba(120,255,200,.25)'; ell(g, 140, 66, 26, 8, 0.3); g.fill(); }
    }, 10);
  }
  S.oil = { w: 1000, decal: true, slip: true, img: puddle('#141018', '#24202e', true) };
  S.mud = { w: 1100, decal: true, slip: true, img: puddle('#5a3a22', '#6e4a2c', false) };
  S.pad = { w: 900, decal: true, pad: true, img: mk(200, 120, (g) => {
    rr(g, 4, 4, 192, 112, 10); g.fillStyle = '#1b2440'; g.fill();
    for (let i = 0; i < 3; i++) {
      const y = 92 - i * 34;
      g.beginPath(); g.moveTo(30, y + 10); g.lineTo(100, y - 18); g.lineTo(170, y + 10); g.lineTo(150, y + 18); g.lineTo(100, y - 2); g.lineTo(50, y + 18); g.closePath();
      g.fillStyle = ['#ffd84a', '#ff9a2a', '#ff4a6a'][i]; g.fill();
    }
    g.strokeStyle = '#7cc4ff'; g.lineWidth = 4; rr(g, 4, 4, 192, 112, 10); g.stroke();
  }) };
  S.ramp = { w: 1300, ramp: true, img: art(260, 110, (g) => {
    shadow(g, 130, 102, 124, 8);
    poly(g, [[10, 104], [40, 20], [220, 20], [250, 104]]); paint(g, vg(g, 20, 104, '#e8b52a'), '#8a6a10');
    g.save(); poly(g, [[10, 104], [40, 20], [220, 20], [250, 104]]); g.clip();
    g.fillStyle = '#1c1c22';
    for (let x = -60; x < 300; x += 44) { g.beginPath(); g.moveTo(x, 104); g.lineTo(x + 22, 104); g.lineTo(x + 52, 20); g.lineTo(x + 30, 20); g.closePath(); g.fill(); }
    g.restore();
    rr(g, 40, 14, 180, 10, 4); paint(g, '#f2f2f2', '#888', 1.5);
  }) };
  S.tumbleweed = { w: 600, hit: 0.7, img: art(150, 140, (g) => {
    shadow(g, 75, 132, 50, 7);
    g.strokeStyle = '#a07a44'; g.lineWidth = 3;
    for (let i = 0; i < 26; i++) { const a = i * 2.4; g.beginPath(); g.ellipse(75, 70, 58, 54, a, 0, Math.PI * 1.2); g.stroke(); }
    g.strokeStyle = '#7a5a2e'; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const a = i * 1.3; g.beginPath(); g.ellipse(75, 70, 40, 44, a, 0, Math.PI); g.stroke(); }
  }) };
  S.crab = { w: 650, hit: 0.75, img: art(200, 140, (g) => {
    shadow(g, 100, 132, 80, 8);
    g.strokeStyle = '#a8231a'; g.lineWidth = 7; g.lineCap = 'round';
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(100 + s * 30, 92 + i * 8); g.lineTo(100 + s * (64 + i * 6), 120 + i * 4); g.stroke(); }
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(100 + s * 40, 70); g.lineTo(100 + s * 70, 40); g.stroke(); ell(g, 100 + s * 76, 30, 20, 16, s * 0.5); paint(g, sg(g, 100 + s * 76, 30, 20, '#e2412f'), '#e2412f'); }
    ell(g, 100, 86, 50, 34); paint(g, sg(g, 100, 86, 50, '#e2412f'), '#e2412f');
    for (const s of [-1, 1]) { rr(g, 100 + s * 16 - 3, 40, 6, 22, 3); g.fillStyle = '#a8231a'; g.fill(); ell(g, 100 + s * 16, 38, 9, 9); paint(g, '#fff', '#555', 1.5); ell(g, 100 + s * 16 + 2, 38, 4, 5); g.fillStyle = '#111'; g.fill(); }
  }) };
  S.snowball = { w: 750, hit: 0.85, img: art(160, 160, (g) => {
    shadow(g, 80, 150, 64, 8);
    ell(g, 80, 80, 70, 70); paint(g, sg(g, 80, 80, 70, '#f4f8ff'), '#9fb0c8');
    g.fillStyle = 'rgba(150,170,210,.35)';
    for (const [x, y, r] of [[60, 100, 10], [104, 64, 7], [90, 112, 6], [48, 62, 5]]) { ell(g, x, y, r, r); g.fill(); }
  }) };
  S.rollLog = { w: 1500, hit: 0.85, img: art(300, 100, (g) => {
    shadow(g, 150, 92, 140, 8);
    rr(g, 20, 20, 250, 70, 34); paint(g, vg(g, 20, 90, '#7a4a2a'), '#7a4a2a');
    ell(g, 270, 55, 22, 35); paint(g, '#d9b07a', '#7a4a2a');
    g.strokeStyle = '#a77b4c'; g.lineWidth = 2; ell(g, 270, 55, 11, 18); g.stroke();
  }) };
  S.mushBounce = { w: 900, hit: 0.6, img: art(200, 180, (g) => {
    shadow(g, 100, 170, 80, 8);
    rr(g, 76, 90, 48, 82, 18); paint(g, hg(g, 76, 124, '#efe0c4'), '#efe0c4');
    g.beginPath(); g.moveTo(8, 100); g.bezierCurveTo(8, 6, 192, 6, 192, 100); g.quadraticCurveTo(100, 124, 8, 100); g.closePath();
    paint(g, vg(g, 10, 110, '#7a4ad8'), '#7a4ad8');
    g.fillStyle = '#ffe36a';
    for (const [x, y, r] of [[60, 50, 13], [120, 40, 11], [156, 80, 9], [40, 84, 8], [100, 80, 10]]) { ell(g, x, y, r, r * 0.8); g.fill(); }
  }) };

  // своды туннелей и перила мостов
  function arch(col, light) {
    return { w: 7200, img: art(720, 420, (g) => {
      g.beginPath(); g.rect(0, 0, 720, 420);
      g.moveTo(130, 420); g.lineTo(130, 200); g.bezierCurveTo(130, 60, 590, 60, 590, 200); g.lineTo(590, 420); g.closePath();
      const gr = g.createLinearGradient(0, 0, 0, 420); gr.addColorStop(0, shade(col, -0.35)); gr.addColorStop(1, shade(col, 0.05));
      g.fillStyle = gr; g.fill('evenodd');
      g.save(); g.beginPath(); g.rect(0, 0, 720, 420); g.moveTo(130, 420); g.lineTo(130, 200); g.bezierCurveTo(130, 60, 590, 60, 590, 200); g.lineTo(590, 420); g.closePath(); g.clip('evenodd');
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${0.08 + (i % 3) * 0.05})`; g.fillRect((i * 97) % 720, (i * 53) % 420, 40 + (i % 4) * 20, 16); }
      g.restore();
      g.strokeStyle = shade(col, 0.25); g.lineWidth = 8;
      g.beginPath(); g.moveTo(130, 420); g.lineTo(130, 200); g.bezierCurveTo(130, 60, 590, 60, 590, 200); g.lineTo(590, 420); g.stroke();
      for (const x of [170, 550]) {
        const gl = g.createRadialGradient(x, 150, 2, x, 150, 34); gl.addColorStop(0, light); gl.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gl; g.fillRect(x - 34, 116, 68, 68);
        rr(g, x - 8, 142, 16, 14, 3); g.fillStyle = '#fff4c8'; g.fill();
      }
    }, 20) };
  }
  S.rockArch = arch('#7a3a28', 'rgba(255,190,110,.9)');
  S.iceArch = arch('#5a7aa8', 'rgba(170,230,255,.9)');
  S.woodArch = arch('#5a3a22', 'rgba(255,210,130,.9)');
  S.rail = { w: 1400, img: art(240, 120, (g) => {
    for (const x of [16, 216]) { rr(g, x, 20, 16, 100, 4); paint(g, hg(g, x, x + 16, '#8a5a36'), '#5a3a22'); }
    rr(g, 0, 26, 240, 16, 6); paint(g, vg(g, 26, 42, '#c0392b'), '#7a1a14');
    rr(g, 0, 66, 240, 12, 5); paint(g, vg(g, 66, 78, '#f2f2f2'), '#888');
  }) };

  // ---------- Neon City ----------
  function building(h, col, neon, seed) {
    return art(220, h, (g) => {
      rr(g, 10, 10, 200, h - 10, 4); paint(g, vg(g, 10, h, col, 0.15, -0.35), col, 2);
      let s = seed;
      const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let y = 30; y < h - 30; y += 22) for (let x = 24; x < 196; x += 22) {
        if (r() < 0.55) { g.fillStyle = r() < 0.3 ? neon : '#ffe9a8'; g.globalAlpha = 0.6 + r() * 0.4; g.fillRect(x, y, 12, 12); }
      }
      g.globalAlpha = 1;
      g.fillStyle = neon; g.fillRect(10, 10, 200, 6);
      g.shadowColor = neon; g.shadowBlur = 18; g.fillRect(10, 10, 200, 3); g.shadowBlur = 0;
    }, 10);
  }
  S.building = { w: 2600, hit: 0.7, img: building(520, '#241a3a', '#ff2a9a', 7) };
  S.building2 = { w: 2400, hit: 0.7, img: building(420, '#1a2440', '#2af0ff', 13) };
  function neonBoard(text, c) {
    return { w: 1900, hit: 0.4, img: mk(400, 300, (g) => {
      for (const x of [80, 300]) { rr(g, x, 150, 18, 150, 4); paint(g, '#2a2a38', '#111', 1.5); }
      rr(g, 16, 16, 368, 150, 12); g.fillStyle = '#120a20'; g.fill();
      g.shadowColor = c; g.shadowBlur = 24; g.strokeStyle = c; g.lineWidth = 6; rr(g, 26, 26, 348, 130, 10); g.stroke();
      g.font = '900 64px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#fff'; g.fillText(text, 200, 92); g.shadowBlur = 0;
    }) };
  }
  S.neonA = neonBoard('TURBO', '#ff2a9a');
  S.neonB = neonBoard('NITRO', '#2af0ff');
  S.neonC = neonBoard('DRIFT', '#ffe14a');
  S.lampNeon = { w: 700, hit: 0.15, img: mk(120, 380, (g) => {
    const gl = g.createRadialGradient(60, 40, 4, 60, 40, 60); gl.addColorStop(0, 'rgba(42,240,255,.95)'); gl.addColorStop(1, 'rgba(42,240,255,0)');
    g.fillStyle = gl; g.fillRect(0, 0, 120, 110);
    rr(g, 54, 40, 12, 336, 4); paint(g, hg(g, 54, 66, '#2a2a38'), '#111', 1.5);
    rr(g, 30, 30, 60, 12, 6); g.fillStyle = '#bff8ff'; g.fill();
  }) };
  S.hoverBot = { w: 650, hit: 0.8, img: art(160, 170, (g) => {
    ell(g, 80, 160, 46, 7); g.fillStyle = 'rgba(42,240,255,.5)'; g.fill();
    ell(g, 80, 80, 62, 62); paint(g, sg(g, 80, 80, 62, '#5a5a78'), '#222');
    rr(g, 30, 64, 100, 34, 17); g.fillStyle = '#120a20'; g.fill();
    ell(g, 80, 81, 14, 12); g.fillStyle = '#ff2a9a'; g.fill(); ell(g, 76, 77, 5, 4); g.fillStyle = '#fff'; g.fill();
    g.strokeStyle = '#2af0ff'; g.lineWidth = 4; g.beginPath(); g.moveTo(80, 18); g.lineTo(80, 2); g.stroke();
  }) };
  S.neonArch = arch('#1a1030', 'rgba(255,42,154,.95)');

  // ---------- Volcano ----------
  S.lavaRock = { w: 1300, hit: 0.6, img: art(240, 200, (g) => {
    shadow(g, 120, 190, 110, 10);
    const pts = [[12, 192], [30, 90], [90, 30], [160, 24], [214, 80], [228, 192]];
    poly(g, pts); paint(g, '#2c2224', '#2c2224');
    poly(g, [[30, 90], [90, 30], [160, 24], [120, 90], [60, 110]]); g.fillStyle = '#3e3236'; g.fill();
    g.strokeStyle = '#ff7a1a'; g.lineWidth = 4; g.shadowColor = '#ff5a00'; g.shadowBlur = 12;
    for (const line of [[[60, 180], [80, 130], [70, 100]], [[150, 186], [140, 140], [170, 110], [160, 70]], [[110, 120], [120, 80]]]) {
      g.beginPath(); line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    }
    g.shadowBlur = 0;
  }) };
  S.fireball = { w: 600, hit: 0.85, img: mk(160, 180, (g) => {
    const gl = g.createRadialGradient(80, 100, 4, 80, 100, 80); gl.addColorStop(0, 'rgba(255,220,120,1)'); gl.addColorStop(0.5, 'rgba(255,120,20,.9)'); gl.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = gl; g.fillRect(0, 0, 160, 180);
    g.beginPath(); g.moveTo(80, 10); g.quadraticCurveTo(140, 80, 120, 130); g.quadraticCurveTo(80, 170, 40, 130); g.quadraticCurveTo(20, 80, 80, 10); g.fillStyle = '#ff6a1a'; g.fill();
    g.beginPath(); g.moveTo(80, 50); g.quadraticCurveTo(116, 100, 104, 130); g.quadraticCurveTo(80, 152, 56, 130); g.quadraticCurveTo(46, 100, 80, 50); g.fillStyle = '#ffd84a'; g.fill();
    ell(g, 70, 112, 6, 8); g.fillStyle = '#2a0a00'; g.fill(); ell(g, 92, 112, 6, 8); g.fill();
  }) };
  S.lavaArch = arch('#3a1a14', 'rgba(255,120,30,.95)');

  // ---------- Jungle Ruins ----------
  S.jungleTree = { w: 1700, hit: 0.3, img: art(300, 400, (g) => {
    shadow(g, 150, 390, 90, 10);
    rr(g, 132, 160, 36, 236, 12); paint(g, hg(g, 132, 168, '#6a4a2a'), '#4a3018');
    g.strokeStyle = '#3e6a2a'; g.lineWidth = 4;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(140 + i * 6, 180 + i * 40); g.quadraticCurveTo(120 - i * 10, 260, 130, 380); g.stroke(); }
    const leaves = [[150, 120, 110, 70], [80, 160, 70, 46], [222, 160, 70, 46], [150, 70, 80, 50], [100, 100, 60, 40], [200, 100, 60, 40]];
    for (const [x, y, rx, ry] of leaves) { ell(g, x, y, rx, ry); paint(g, sg(g, x, y, rx, '#2e8a3a'), '#1e5a26', 2); }
    g.fillStyle = '#ff5a8a'; for (const [x, y] of [[110, 130], [190, 90], [160, 160]]) { ell(g, x, y, 7, 7); g.fill(); }
  }) };
  S.ruinPillar = { w: 1100, hit: 0.5, img: art(160, 380, (g) => {
    shadow(g, 80, 372, 70, 9);
    rr(g, 20, 330, 120, 46, 4); paint(g, vg(g, 330, 376, '#a8a088'), '#5a5444');
    rr(g, 36, 70, 88, 264, 4); paint(g, hg(g, 36, 124, '#b8b098'), '#5a5444');
    g.strokeStyle = 'rgba(60,50,40,.35)'; g.lineWidth = 3; for (const x of [54, 72, 90, 108]) { g.beginPath(); g.moveTo(x, 76); g.lineTo(x, 328); g.stroke(); }
    poly(g, [[16, 70], [144, 70], [130, 40], [30, 30]]); paint(g, vg(g, 30, 70, '#a8a088'), '#5a5444');
    g.fillStyle = '#4e8a3a'; for (const [x, y, r] of [[40, 64, 16], [120, 60, 12], [60, 200, 10], [110, 300, 14]]) { ell(g, x, y, r, r * 0.7); g.fill(); }
  }) };
  S.boulder = { w: 800, hit: 0.85, img: art(170, 170, (g) => {
    shadow(g, 85, 160, 70, 9);
    ell(g, 85, 85, 76, 74); paint(g, sg(g, 85, 85, 76, '#8a8270'), '#4a4436');
    g.strokeStyle = 'rgba(40,36,28,.5)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(40, 60); g.lineTo(80, 90); g.lineTo(70, 140); g.moveTo(80, 90); g.lineTo(130, 70); g.stroke();
    g.fillStyle = '#4e8a3a'; ell(g, 60, 30, 26, 12); g.fill();
  }) };
  S.stoneArch = arch('#7a7462', 'rgba(255,220,140,.9)');

  // ---------- Sky Road ----------
  S.cloudPuff = { w: 1600, hit: 0, img: art(300, 180, (g) => {
    for (const [x, y, r] of [[80, 110, 60], [160, 80, 76], [230, 112, 56], [140, 130, 60]]) { ell(g, x, y, r, r * 0.8); paint(g, sg(g, x, y, r, '#ffffff'), '#c8d8f0', 0); }
    g.fillStyle = 'rgba(180,200,240,.35)'; ell(g, 150, 150, 120, 20); g.fill();
  }, 6) };
  S.skyPillar = { w: 1100, hit: 0.5, img: art(160, 420, (g) => {
    rr(g, 20, 376, 120, 40, 6); paint(g, vg(g, 376, 416, '#f4f0ff'), '#a8a0c8');
    rr(g, 38, 60, 84, 320, 6); paint(g, hg(g, 38, 122, '#f8f4ff'), '#a8a0c8');
    g.strokeStyle = 'rgba(150,140,190,.4)'; g.lineWidth = 3; for (const x of [56, 74, 92, 108]) { g.beginPath(); g.moveTo(x, 66); g.lineTo(x, 374); g.stroke(); }
    rr(g, 16, 30, 128, 34, 8); paint(g, vg(g, 30, 64, '#ffd84a'), '#a8801a');
    ell(g, 80, 18, 18, 18); paint(g, sg(g, 80, 18, 18, '#ff8ac8'), '#a84a80');
  }) };
  S.thunderCloud = { w: 900, hit: 0.85, img: art(200, 200, (g) => {
    for (const [x, y, r] of [[60, 70, 44], [110, 54, 54], [150, 76, 40], [100, 90, 50]]) { ell(g, x, y, r, r * 0.8); paint(g, sg(g, x, y, r, '#5a5a78'), '#2a2a3a', 0); }
    poly(g, [[100, 110], [80, 160], [100, 156], [86, 200], [130, 140], [108, 144], [122, 110]]); g.fillStyle = '#ffe14a'; g.fill();
    ell(g, 86, 76, 6, 7); g.fillStyle = '#fff'; g.fill(); ell(g, 120, 76, 6, 7); g.fill();
  }) };
  S.skyRail = { w: 1400, img: art(240, 120, (g) => {
    for (const x of [16, 216]) { rr(g, x, 20, 16, 100, 4); paint(g, hg(g, x, x + 16, '#f4f0ff'), '#a8a0c8'); }
    rr(g, 0, 26, 240, 16, 6); paint(g, vg(g, 26, 42, '#ffd84a'), '#a8801a');
    rr(g, 0, 66, 240, 12, 5); paint(g, vg(g, 66, 78, '#ff8ac8'), '#a84a80');
  }) };
  S.rainbowArch = { w: 7200, img: mk(720, 420, (g) => {
    const cols = ['#ff4a4a', '#ff9a2a', '#ffe14a', '#4ad16a', '#4aa8ff', '#9a6aff'];
    cols.forEach((c, i) => { g.strokeStyle = c; g.lineWidth = 22; g.beginPath(); g.ellipse(360, 420, 330 - i * 20, 360 - i * 20, 0, Math.PI, 0); g.stroke(); });
    for (const x of [24, 696]) { ell(g, x, 410, 60, 30); g.fillStyle = '#fff'; g.fill(); }
  }) };

  // ---------- Персонажи ----------
  const CHARS = [
    { id: 'bunny', name: 'Зайка', fur: '#f3eee9', inner: '#f2a7ba', muzzle: '#ffffff', shirt: '#e2557f', scarf: '#f2c14e', kart: '#e04a86', ears: 'bunny', nose: '#e8708f' },
    { id: 'cat', name: 'Котик', fur: '#f09a46', inner: '#ffd2a0', muzzle: '#fbe9d4', shirt: '#3d8fd6', scarf: '#e55050', kart: '#1fa883', ears: 'cat', stripe: '#c9561a' },
    { id: 'bear', name: 'Мишка', fur: '#9a6239', inner: '#ddb58c', muzzle: '#e3c49d', shirt: '#eec33a', scarf: '#c8406c', kart: '#3f5fd8', ears: 'round' },
    { id: 'fox', name: 'Лиса', fur: '#ee6f2a', inner: '#fbeedd', muzzle: '#fbeedd', shirt: '#57b766', scarf: '#7449d6', kart: '#e8a515', ears: 'fox' },
    { id: 'panda', name: 'Панда', fur: '#f4f4f2', inner: '#3a3a3a', muzzle: '#ffffff', shirt: '#b862d0', scarf: '#2fbf96', kart: '#5e3fd0', ears: 'round', earColor: '#2b2b2b', patches: true },
  ];
  const charById = (id) => CHARS.find((c) => c.id === id) || CHARS[0];

  const SW = 260, SH = 330, BY = 318;
  const HEAD_R = 42;

  function ears(g, ch, hx, hy, front) {
    const f = ch.earColor || ch.fur;
    if (ch.ears === 'bunny') {
      for (const s of [-1, 1]) {
        ell(g, hx + s * 18, hy - 66, 14, 40, s * 0.16); paint(g, sg(g, hx + s * 18, hy - 66, 40, f), f);
        if (front) { ell(g, hx + s * 18, hy - 64, 6, 28, s * 0.16); g.fillStyle = ch.inner; g.fill(); }
      }
    } else if (ch.ears === 'cat' || ch.ears === 'fox') {
      const tall = ch.ears === 'fox' ? 1.18 : 1;
      for (const s of [-1, 1]) {
        poly(g, [[hx + s * 6, hy - 34], [hx + s * 34, hy - 34 - 38 * tall], [hx + s * 42, hy - 8]]);
        paint(g, vg(g, hy - 80, hy - 8, f), f);
        if (front) { poly(g, [[hx + s * 14, hy - 32], [hx + s * 32, hy - 30 - 30 * tall], [hx + s * 36, hy - 14]]); g.fillStyle = ch.inner; g.fill(); }
        if (ch.ears === 'fox') { poly(g, [[hx + s * 26, hy - 56], [hx + s * 34, hy - 34 - 38 * tall], [hx + s * 38, hy - 54]]); g.fillStyle = '#3e2416'; g.fill(); }
      }
    } else {
      for (const s of [-1, 1]) {
        ell(g, hx + s * 32, hy - 30, 16, 16); paint(g, sg(g, hx + s * 32, hy - 30, 16, f), f);
        if (front) { ell(g, hx + s * 32, hy - 30, 8, 8); g.fillStyle = ch.patches ? '#555' : ch.inner; g.fill(); }
      }
    }
  }

  function face(g, ch, hx, hy) {
    ell(g, hx, hy + 14, 22, 16); paint(g, sg(g, hx, hy + 14, 22, ch.muzzle), ch.muzzle, 1.5);
    if (ch.patches) for (const s of [-1, 1]) { ell(g, hx + s * 16, hy - 2, 11, 14, s * 0.5); g.fillStyle = '#2b2b2b'; g.fill(); }
    for (const s of [-1, 1]) {
      ell(g, hx + s * 15, hy - 2, 6.5, 8.5); g.fillStyle = ch.patches ? '#fff' : '#1d1630'; g.fill();
      if (ch.patches) { ell(g, hx + s * 15, hy - 1, 4, 5.5); g.fillStyle = '#1d1630'; g.fill(); }
      ell(g, hx + s * 15 + 2, hy - 5, 2.4, 2.4); g.fillStyle = '#fff'; g.fill();
      ell(g, hx + s * 29, hy + 10, 9, 5); g.fillStyle = 'rgba(230,90,120,.4)'; g.fill();
    }
    ell(g, hx, hy + 7, 6, 4.5); g.fillStyle = ch.nose || '#2a1f2d'; g.fill();
    g.beginPath();
    g.moveTo(hx - 9, hy + 14); g.quadraticCurveTo(hx - 4, hy + 21, hx, hy + 14); g.quadraticCurveTo(hx + 4, hy + 21, hx + 9, hy + 14);
    g.lineWidth = 2.5; g.strokeStyle = '#3a2a30'; g.lineCap = 'round'; g.stroke();
    if (ch.id === 'bunny') { rr(g, hx - 4, hy + 17, 8, 7, 2); g.fillStyle = '#fff'; g.fill(); }
    if (ch.ears === 'cat') {
      g.lineWidth = 1.5; g.strokeStyle = 'rgba(60,40,30,.7)';
      for (const s of [-1, 1]) for (const dy of [-3, 4]) { g.beginPath(); g.moveTo(hx + s * 22, hy + 12 + dy * 0.3); g.lineTo(hx + s * 44, hy + 8 + dy); g.stroke(); }
    }
  }

  function scarfTail(g, ch, x, y, side) {
    g.beginPath();
    g.moveTo(x + side * 18, y - 46);
    g.quadraticCurveTo(x + side * 54, y - 44, x + side * 74, y - 62);
    g.lineTo(x + side * 78, y - 46);
    g.quadraticCurveTo(x + side * 52, y - 26, x + side * 12, y - 36);
    g.closePath(); paint(g, vg(g, y - 62, y - 26, ch.scarf), ch.scarf, 1.5);
  }

  function driverBack(g, ch, x, y, yaw, hit) {
    for (const s of [-1, 1]) { ell(g, x + s * 44, y - 10, 17, 24, -s * 0.35); paint(g, sg(g, x + s * 44, y - 10, 24, shade(ch.shirt, -0.12)), ch.shirt); }
    rr(g, x - 42, y - 50, 84, 70, 30); paint(g, vg(g, y - 50, y + 20, ch.shirt), ch.shirt);
    const hx = x + yaw * 8, hy = y - 82 - (hit ? 6 : 0);
    ears(g, ch, hx, hy, false);
    ell(g, hx, hy, HEAD_R, HEAD_R - 2); paint(g, sg(g, hx, hy, HEAD_R, ch.fur), ch.fur);
    if (ch.stripe) {
      g.strokeStyle = ch.stripe; g.lineWidth = 6; g.lineCap = 'round';
      for (const dx of [-14, 0, 14]) { g.beginPath(); g.moveTo(hx + dx, hy - 36); g.lineTo(hx + dx * 1.1, hy - 18); g.stroke(); }
    }
    rr(g, x - 38, y - 56, 76, 18, 9); paint(g, vg(g, y - 56, y - 38, ch.scarf), ch.scarf, 1.5);
    scarfTail(g, ch, x, y, yaw ? -yaw : 1);
  }

  function wheel(g, x, y, w, h, hub) {
    rr(g, x - w / 2, y, w, h, 12); paint(g, hg(g, x - w / 2, x + w / 2, '#2c2c34'), '#2c2c34', 1.5);
    g.fillStyle = 'rgba(0,0,0,.35)';
    for (let k = 1; k < 5; k++) g.fillRect(x - w / 2 + 5, y + (h * k) / 5 - 2, w - 10, 3);
    if (hub) { ell(g, x + hub, y + h / 2, 11, 13); paint(g, sg(g, x + hub, y + h / 2, 12, '#d8dce4'), '#888', 1.5); }
  }

  function flameAt(g, x, y, f) {
    const L = f === 1 ? 28 : 40;
    const gl = g.createRadialGradient(x, y + 8, 2, x, y + 8, 46);
    gl.addColorStop(0, 'rgba(170,220,255,.95)'); gl.addColorStop(1, 'rgba(60,140,255,0)');
    g.fillStyle = gl; g.fillRect(x - 46, y - 38, 92, 92);
    ell(g, x, y + L * 0.45, 15, L); g.fillStyle = '#3d8cff'; g.fill();
    ell(g, x, y + L * 0.35, 9, L * 0.7); g.fillStyle = '#a8dcff'; g.fill();
    ell(g, x, y + 4, 5, 8); g.fillStyle = '#fff'; g.fill();
  }

  function drawKartRear(g, ch, yaw, flame, hit) {
    const cx = SW / 2, by = BY;
    const o = (d) => cx + yaw * d * 20;
    shadow(g, cx + yaw * 6, by - 6, 118, 15);
    for (const s of [-1, 1]) wheel(g, o(1) + s * 82, by - 96, 34, 42, 0);

    rr(g, o(0.5) - 102, by - 116, 204, 76, 26); paint(g, vg(g, by - 116, by - 40, ch.kart), ch.kart);
    if (yaw) { rr(g, o(0.5) - yaw * 84 - 18, by - 108, 36, 60, 14); g.fillStyle = 'rgba(0,0,0,.22)'; g.fill(); }

    // антенна с вымпелом
    const ax = o(0.15) + 86 * (yaw < 0 ? -1 : 1);
    g.strokeStyle = '#333'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(ax, by - 100); g.lineTo(ax + yaw * 6, by - 220); g.stroke();
    const fx = ax + yaw * 6, fd = yaw < 0 ? -1 : 1;
    poly(g, [[fx, by - 222], [fx + fd * 34, by - 210], [fx, by - 198]]); paint(g, vg(g, by - 222, by - 198, ch.scarf), ch.scarf, 1.5);

    driverBack(g, ch, o(0.7), by - 128, yaw, hit);

    rr(g, o(0.35) - 54, by - 158, 108, 58, 22); paint(g, vg(g, by - 158, by - 100, shade(ch.kart, -0.3)), ch.kart);

    rr(g, cx - 74, by - 70, 148, 46, 14); paint(g, vg(g, by - 70, by - 24, '#454a5c'), '#454a5c');
    rr(g, cx - 22, by - 66, 44, 18, 3); paint(g, '#f2eee0', '#888', 1.5);
    g.fillStyle = '#222'; g.font = '900 14px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch.name.slice(0, 3).toUpperCase(), cx, by - 57);
    for (const s of [-1, 1]) {
      ell(g, cx + s * 40, by - 40, 12, 12); paint(g, sg(g, cx + s * 40, by - 40, 12, '#b0b6c6'), '#666', 1.5);
      ell(g, cx + s * 40, by - 40, 6, 6); g.fillStyle = '#16161c'; g.fill();
    }
    for (const s of [-1, 1]) wheel(g, cx + s * 98, by - 74, 54, 70, 0);
    if (flame) for (const s of [-1, 1]) flameAt(g, cx + s * 40, by - 38, flame);

    if (hit) {
      const hy = by - 128 - 88 - 54;
      [[-46, 8], [0, -10], [46, 8]].forEach(([dx, dy]) => { star(g, o(0.7) + dx, hy + dy, 14); paint(g, '#ffd84a', '#b8860b', 1.5); });
    }
  }

  function drawKartFront(g, ch) {
    const cx = SW / 2, by = BY;
    const k = (d) => cx + (0.5 - d) * 26;
    shadow(g, cx, by - 6, 120, 15);
    for (const s of [-1, 1]) wheel(g, k(1) + s * 86, by - 112, 38, 44, 0);
    rr(g, k(0.8) - 52, by - 176, 104, 72, 22); paint(g, vg(g, by - 176, by - 104, shade(ch.kart, -0.3)), ch.kart);

    const x = k(0.6), y = by - 128;
    for (const s of [-1, 1]) { ell(g, x + s * 44, y - 14, 17, 24, s * 0.35); paint(g, sg(g, x + s * 44, y - 14, 24, shade(ch.shirt, -0.12)), ch.shirt); }
    rr(g, x - 42, y - 50, 84, 70, 30); paint(g, vg(g, y - 50, y + 20, ch.shirt), ch.shirt);
    scarfTail(g, ch, x, y, 1);
    const hx = x - 6, hy = y - 82;
    ears(g, ch, hx, hy, true);
    ell(g, hx, hy, HEAD_R, HEAD_R - 2); paint(g, sg(g, hx, hy, HEAD_R, ch.fur), ch.fur);
    if (ch.stripe) {
      g.strokeStyle = ch.stripe; g.lineWidth = 5; g.lineCap = 'round';
      for (const dx of [-10, 2, 14]) { g.beginPath(); g.moveTo(hx + dx, hy - 38); g.lineTo(hx + dx, hy - 26); g.stroke(); }
    }
    face(g, ch, hx - 8, hy + 2);
    rr(g, x - 38, y - 56, 76, 18, 9); paint(g, vg(g, y - 56, y - 38, ch.scarf), ch.scarf, 1.5);

    const wx = k(0.45), wy = by - 116;
    ell(g, wx, wy, 36, 13); g.lineWidth = 9; g.strokeStyle = '#2a2a33'; g.stroke();
    for (const s of [-1, 1]) { ell(g, wx + s * 32, wy - 2, 13, 12); paint(g, sg(g, wx + s * 32, wy - 2, 13, ch.fur), ch.fur, 1.5); }

    rr(g, k(0.3) - 104, by - 118, 208, 72, 28); paint(g, vg(g, by - 118, by - 46, ch.kart), ch.kart);
    rr(g, k(0.3) + 66, by - 110, 34, 56, 14); g.fillStyle = 'rgba(0,0,0,.2)'; g.fill();
    rr(g, k(0.1) - 64, by - 96, 128, 52, 20); paint(g, vg(g, by - 96, by - 44, shade(ch.kart, 0.12)), ch.kart, 1.5);
    for (const s of [-1, 1]) {
      ell(g, k(0.1) + s * 42, by - 66, 13, 11); paint(g, sg(g, k(0.1) + s * 42, by - 66, 13, '#fff3b0'), '#a08a40', 1.5);
    }
    rr(g, k(0) - 82, by - 44, 164, 20, 8); paint(g, vg(g, by - 44, by - 24, '#454a5c'), '#454a5c', 1.5);
    for (const s of [-1, 1]) wheel(g, k(0) + s * 104, by - 76, 56, 70, s * 4);
  }

  const kartCache = new Map();
  function kart(id, pose, flame) {
    const key = id + pose + flame;
    let c = kartCache.get(key);
    if (!c) {
      const ch = charById(id);
      const yaw = pose === 'L' ? -1 : pose === 'R' ? 1 : 0;
      c = grain(mk(SW, SH, (g) => drawKartRear(g, ch, yaw, flame, pose === 'H')), 14);
      kartCache.set(key, c);
    }
    return c;
  }
  const portraitCache = new Map();
  function portrait(id) {
    let c = portraitCache.get(id);
    if (!c) { c = grain(mk(SW, SH, (g) => drawKartFront(g, charById(id))), 14); portraitCache.set(id, c); }
    return c;
  }
  const headCache = new Map();
  function head(id) {
    let c = headCache.get(id);
    if (!c) {
      const ch = charById(id);
      c = mk(120, 140, (g) => { ears(g, ch, 60, 90, true); ell(g, 60, 90, HEAD_R, HEAD_R - 2); paint(g, sg(g, 60, 90, HEAD_R, ch.fur), ch.fur); face(g, ch, 60, 92); });
      headCache.set(id, c);
    }
    return c;
  }

  // мягкое облачко для пыли/дыма, окрашенное в нужный цвет
  const puffCache = new Map();
  function puff(color) {
    let c = puffCache.get(color);
    if (!c) {
      c = mk(32, 32, (g) => {
        const gr = g.createRadialGradient(13, 12, 2, 16, 16, 16);
        gr.addColorStop(0, shade(color, 0.25)); gr.addColorStop(0.6, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
        g.globalCompositeOperation = 'destination-in';
        const m = g.createRadialGradient(16, 16, 4, 16, 16, 16);
        m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = m; g.fillRect(0, 0, 32, 32);
      });
      puffCache.set(color, c);
    }
    return c;
  }

  return { S, signs, banner, CHARS, charById, kart, portrait, head, puff, SW, SH, BY, shade, mk, rgb };
})();
