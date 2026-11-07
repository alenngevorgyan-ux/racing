// The two characters from the design sheet "Двое": one skeleton, poses are joint angles.
// Ported from the sheet's own pose function (cf): every frame is built from the same SVG parts,
// rendered once into a sprite at load time, then just blitted in the game.
const Rig = (() => {
  const RD = Math.PI / 180, KC = 0.6;
  const CH = {
    1: { cls: 'p1', s: 1, tw: 1, hF: '#h1F', hS: '#h1S', hB: '#h1B', hbF: '#hb1F', hbS: '#hb1S', hfF: '#hf1F', hfS: '#hf1S' },
    2: { cls: 'p2', s: 1.08, tw: 1.12, hF: '#h2F', hS: '#h2S', hB: '#h2B', hbF: '#empty', hbS: '#empty', hfF: '#hf2F', hfS: '#hf2S' },
  };
  const DV = {
    F: { s: 0, t: '#tF', sh: '#shF', lx: [-3.8, 3.8], sx: [-10.5, 10.5], far: '', tw: 1, hd: 'F', back: false },
    S: { s: 1, t: '#tS', sh: '#shS', lx: [-1, 1], sx: [-1, 1.5], far: 'far', tw: 1, hd: 'S', back: false },
    B: { s: 0, t: '#tB', sh: '#shF', lx: [-3.8, 3.8], sx: [-10.5, 10.5], far: '', tw: 1, hd: 'B', back: true },
  };
  const SF = { calm: 'calm', smile: 'smile', wow: 'wow', focus: 'focus', shut: 'kiss', kiss: 'kiss', ouch: 'wow' };

  // poses: the sheet's own frames plus the "together" moments
  const POSES = {
    idle: {},
    walk1: { hip: -76, ll: [25, 5], rl: [-25, 5], la: [-25, -15], ra: [25, -15] },
    walk2: { hip: -82, ll: [-10, 50], rl: [0, 0], la: [5, -15], ra: [-5, -15] },
    walk3: { hip: -76, ll: [-25, 5], rl: [25, 5], la: [25, -15], ra: [-25, -15] },
    walk4: { hip: -82, ll: [0, 0], rl: [-10, 50], la: [-5, -15], ra: [5, -15] },
    run1: { tilt: 12, hip: -62, la: [-55, -70], ra: [50, -75], ll: [40, 60], rl: [-60, 75], e: 'focus' },
    run2: { tilt: 12, hip: -62, la: [50, -75], ra: [-55, -70], ll: [-60, 75], rl: [40, 60], e: 'focus' },
    crouch: { tilt: 20, hip: -58, la: [55, -25], ra: [60, -25], ll: [-45, 85], rl: [-50, 92], head: -8, e: 'focus' },
    jump: { tilt: -5, la: [-160, -10], ra: [-150, -20], ll: [10, 35], rl: [-40, 70], e: 'smile' },
    fall: { la: [-130, 30], ra: [-120, 40], laL: [40, 20], raL: [-40, -20], ll: [8, 10], rl: [-12, 15], e: 'wow' },
    land: { tilt: 12, hip: -69, la: [-30, -30], ra: [-25, -35], ll: [-30, 60], rl: [-35, 65], e: 'focus' },
    push: { tilt: 30, hip: -70, la: [-65, -20], ra: [-60, -25], ll: [-30, 55], rl: [30, 10], e: 'focus' },
    use: { tilt: 10, hip: -79, la: [-50, -30], ra: [-45, -35], ll: [-5, 0], rl: [8, 5], e: 'focus' },
    wave: { ra: [-160, -25], raL: [-30, -20], e: 'smile' },
    wait: { la: [10, -20], ra: [10, -20], laL: [30, -105], raL: [-30, 105] },
    reach: { la: [-175, 0], ra: [-178, 0], laL: [170, 0], raL: [-172, 0], e: 'wow' },
    hurt: { e: 'ouch', la: [-20, -40], ra: [-30, -50], laL: [50, 40], raL: [-50, -40], ll: [5, 0], rl: [-5, 0], sy: 0.92 },
    boost: { tilt: 25, hip: -58, la: [-75, -40], ra: [-70, -45], ll: [-45, 85], rl: [-50, 92], e: 'focus' },
    five: { ra: [-160, -10], e: 'smile' },
    kiss: { tilt: 8, head: -10, la: [-60, -60], ra: [-40, -80], e: 'kiss' },
    arrive: { la: [160, 10], ra: [-160, -10], laL: [20, 0], raL: [-20, 0], e: 'smile' },
  };

  function cf(fr, c, v) {
    const C = CH[c], V = DV[v], k = KC * C.s, s = V.s;
    const pr = (A, L) => {
      const vx = -Math.sin(A * RD) * s - Math.sin(L * RD) * (1 - s);
      const vy = Math.cos(A * RD) * (s + (1 - s) * Math.cos(L * RD));
      return { x: vx, y: vy, a: Math.atan2(-vx, vy) / RD, l: Math.max(0.15, Math.hypot(vx, vy)) };
    };
    const seg = (px, py, p) => `translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${p.a.toFixed(1)}) scale(1 ${p.l.toFixed(3)})`;
    const hp = fr.hip || -82, T = fr.tilt || 0, tw = V.tw * C.tw, e = fr.e || 'calm';
    const ux = Math.sin(T * RD) * s, uy = -Math.cos(T * RD);
    const tang = Math.atan2(ux, -uy) / RD, tlen = Math.hypot(ux, uy);
    const arm = (i, ua, lat) => {
      const shx = ux * 46 + V.sx[i] * tw, shy = hp + uy * 46;
      const A1 = T + ua[0], A2 = A1 + ua[1], L1 = lat[0], L2 = L1 + lat[1];
      const p1 = pr(A1, L1), p2 = pr(A2, L2);
      return [seg(shx, shy, p1), seg(shx + p1.x * 26, shy + p1.y * 26, p2)];
    };
    const leg = (i, l) => {
      const hx = V.lx[i] * tw, p1 = pr(l[0], 0), p2 = pr(l[0] + l[1], 0);
      return [seg(hx, hp, p1), seg(hx + p1.x * 41, hp + p1.y * 41, p2)];
    };
    const a = arm(0, fr.la || [4, -10], fr.laL || [6, -2]);
    const b = arm(1, fr.ra || [-4, -10], fr.raL || [-6, 2]);
    const la = leg(0, fr.ll || [3, 0]), lb = leg(1, fr.rl || [-3, 0]);
    const nx = ux * 52, ny = hp + uy * 52;
    const headT = `translate(${nx.toFixed(2)} ${ny.toFixed(2)}) rotate(${(tang + (fr.head || 0) * s).toFixed(1)}) scale(.62)`;
    const face = V.hd === 'F' ? '#fF' + (e === 'kiss' ? 'shut' : e) : V.hd === 'S' ? '#fS' + SF[e] : '#empty';
    const head = V.hd === 'F' ? C.hF : V.hd === 'S' ? C.hS : C.hB;
    const hb = V.hd === 'F' ? C.hbF : V.hd === 'S' ? C.hbS : '#empty';
    const hf = V.hd === 'F' ? C.hfF : V.hd === 'S' ? C.hfS : '#empty';
    const torsoT = `translate(0 ${hp}) rotate(${tang.toFixed(1)}) scale(${tw} ${tlen.toFixed(3)})`;
    const u = (href, t) => `<use href="${href}" xlink:href="${href}"${t ? ` transform="${t}"` : ''}/>`;
    const armG = (U, F) => `<g transform="${U}">${u('#ua')}</g><g transform="${F}">${u('#fa')}</g>`;
    return `<g transform="scale(${k} ${k * (fr.sy || 1)})" class="${C.cls}">` +
      u(hb, headT) +
      `<g class="${V.far}">${armG(a[0], a[1])}</g>` +
      (V.back ? armG(b[0], b[1]) : '') +
      `<g class="${V.far}"><g transform="${la[0]}">${u('#thigh')}</g><g transform="${la[1]}">${u(V.sh)}</g></g>` +
      `<g transform="${lb[0]}">${u('#thigh')}</g><g transform="${lb[1]}">${u(V.sh)}</g>` +
      u(V.t, torsoT) + u(head, headT) + u(face, headT) + u(hf, headT) +
      (V.back ? '' : armG(b[0], b[1])) +
      `</g>`;
  }

  // sprite canvas: figure origin (feet) at (OX, OY) in viewBox units
  const VB = { x: -60, y: -150, w: 120, h: 162 }, SCALE = 3;
  const sprites = {};
  let unitPerTile = 100;
  function svgFor(fr, c, v) {
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" width="${VB.w * SCALE}" height="${VB.h * SCALE}">` +
      `<style>${RIG_CSS}</style><defs>${RIG_DEFS}</defs>${cf(fr, c, v)}</svg>`;
  }
  function toImage(svg) {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        cv.getContext('2d').drawImage(img, 0, 0);
        res(cv);
      };
      img.onerror = () => res(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  async function load() {
    const jobs = [];
    for (const c of [1, 2]) for (const [name, fr] of Object.entries(POSES)) for (const v of ['S', 'F', 'B']) {
      if (v !== 'S' && !['idle', 'wait', 'arrive', 'wave', 'hurt', 'reach', 'kiss'].includes(name)) continue;
      jobs.push(toImage(svgFor(fr, c, v)).then((cv) => { sprites[`${c}:${name}:${v}`] = cv; }));
    }
    await Promise.all(jobs);
    // measure her standing height so one tile = her height
    const cv = sprites['1:idle:F'];
    if (cv) {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let top = cv.height;
      for (let y = 0; y < cv.height && top === cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 20) { top = y; break; }
      unitPerTile = (-VB.y - top / SCALE) / 1.0;
    }
  }
  // draw a pose with its feet at (x, y) screen px, `tile` px per tile, facing ±1, upside down if g < 0
  function draw(ctx, c, name, v, x, y, tile, face = 1, g = 1, alpha = 1) {
    const cv = sprites[`${c}:${name}:${v}`] || sprites[`${c}:${name}:S`] || sprites[`${c}:idle:S`];
    if (!cv) return false;
    const k = tile / unitPerTile;             // px per viewBox unit
    const w = VB.w * k, h = VB.h * k;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(face, g);
    ctx.drawImage(cv, VB.x * k, VB.y * k, w, h);
    ctx.restore();
    return true;
  }
  return { load, draw, POSES, height: (c) => (c === 2 ? 1.08 : 1) };
})();
