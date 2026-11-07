// Straight-from-behind kart frames drawn in the style of the sprite sheet
// (thick black outlines, flat colours with one shade). yaw -1..1 shifts the layers by depth,
// so the kart turns smoothly through 0°, ~15° and ~30°. The sheet's own turn frame is used past that.
const RearView = (() => {
  const INK = '#151018';
  const LOOK = {
    fox: { kart: '#e0301e', shirt: '#d8321e', shirt2: '#f2f2f2', fur: '#e2661e', fur2: '#b8460e', flame: ['#fff2a0', '#ff7a1a'] },
    bunny: { kart: '#f06ab4', shirt: '#f05aa8', shirt2: '#ffd0e8', fur: '#f2c9a0', fur2: '#d8a478', bow: '#ff3fa8', flame: ['#ffe0ff', '#e04ad8'] },
    bulldog: { kart: '#2f6fe0', shirt: '#23407a', shirt2: '#3a5aa0', fur: '#9a5a2a', fur2: '#6e3c18', flame: ['#e0e8ff', '#6a5aff'] },
    raccoon: { kart: '#49b63a', shirt: '#3f9a3a', shirt2: '#f0c020', fur: '#77777f', fur2: '#3a3a42', cap: '#4fae3a', flame: ['#e8ffd8', '#4ae05a'] },
  };
  const shade = (c, t) => Art.shade(c, t);

  function path(g, fill, lw = 6) { g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(); } }
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function ell(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
  function tri(g, a, b, c) { g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.closePath(); }
  // two-tone fill: base colour + darker lower part, like the sheet's cel shading
  function cel(g, shapeFn, base, dark, splitY) {
    shapeFn(); g.fillStyle = base; g.fill();
    g.save(); shapeFn(); g.clip(); g.fillStyle = dark; g.fillRect(-999, splitY, 9999, 999); g.restore();
    shapeFn(); g.lineWidth = 6; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
  }

  function tire(g, x, y, w, h) {
    rr(g, x - w / 2, y, w, h, 20); path(g, '#26262c');
    g.fillStyle = '#3c3c46';
    for (let k = 1; k < 5; k++) g.fillRect(x - w / 2 + 10, y + (h * k) / 5 - 3, w - 20, 5);
    rr(g, x - w / 2 + 8, y + 6, 10, h - 12, 5); g.fillStyle = 'rgba(255,255,255,.12)'; g.fill();
  }

  function head(g, id, L, hx, hy, yaw) {
    const r = 66;
    if (id === 'fox') {
      for (const s of [-1, 1]) {
        tri(g, [hx + s * 14, hy - 44], [hx + s * 56, hy - 150], [hx + s * 64, hy - 14]); path(g, L.fur);
        tri(g, [hx + s * 46, hy - 112], [hx + s * 56, hy - 150], [hx + s * 60, hy - 108]); path(g, '#3a1e10', 0);
      }
      for (const s of [-1, 1]) { tri(g, [hx + s * 50, hy - 6], [hx + s * 104, hy + 18], [hx + s * 52, hy + 34]); path(g, L.fur); }
      cel(g, () => ell(g, hx, hy, r, r - 4), L.fur, L.fur2, hy + 26);
      g.fillStyle = L.fur2;
      for (const dx of [-30, -6, 18]) { tri(g, [hx + dx, hy + 40], [hx + dx + 14, hy + 72], [hx + dx + 26, hy + 44]); g.fill(); }
      ell(g, hx - 24, hy - 30, 18, 10, -0.5); g.fillStyle = 'rgba(255,255,255,.3)'; g.fill();
    } else if (id === 'bunny') {
      ell(g, hx - 30 + yaw * 6, hy - 124, 26, 74, -0.15); path(g, L.fur);
      ell(g, hx + 64, hy - 70, 24, 70, 1.05); path(g, L.fur);
      cel(g, () => ell(g, hx, hy, r, r - 4), L.fur, L.fur2, hy + 28);
      // bow
      ell(g, hx - 14, hy - 66, 24, 16, -0.4); path(g, L.bow);
      ell(g, hx + 30, hy - 72, 24, 16, 0.4); path(g, L.bow);
      ell(g, hx + 8, hy - 68, 11, 10); path(g, shade(L.bow, -0.2));
      ell(g, hx - 22, hy - 28, 18, 10, -0.5); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
    } else if (id === 'bulldog') {
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(hx + s * 38, hy - 58); g.quadraticCurveTo(hx + s * 92, hy - 72, hx + s * 86, hy - 30); g.lineTo(hx + s * 58, hy - 34); g.closePath();
        path(g, L.fur2);
      }
      cel(g, () => ell(g, hx, hy, r + 14, r - 2), L.fur, L.fur2, hy + 24);
      g.strokeStyle = 'rgba(40,20,8,.6)'; g.lineWidth = 4;
      for (const dy of [30, 44]) { g.beginPath(); g.moveTo(hx - 34, hy + dy); g.quadraticCurveTo(hx, hy + dy + 8, hx + 34, hy + dy); g.stroke(); }
      ell(g, hx - 28, hy - 30, 20, 11, -0.5); g.fillStyle = 'rgba(255,255,255,.25)'; g.fill();
    } else if (id === 'raccoon') {
      for (const s of [-1, 1]) { tri(g, [hx + s * 24, hy - 44], [hx + s * 58, hy - 96], [hx + s * 66, hy - 26]); path(g, L.fur); tri(g, [hx + s * 36, hy - 50], [hx + s * 56, hy - 84], [hx + s * 58, hy - 42]); path(g, '#222', 0); }
      cel(g, () => ell(g, hx, hy, r, r - 4), L.fur, L.fur2, hy + 30);
      // cap worn backwards: dome + bill pointing at the camera
      g.beginPath(); g.ellipse(hx, hy - 16, r + 4, r - 10, 0, Math.PI, 0); g.closePath(); path(g, L.cap);
      ell(g, hx, hy - 18, r + 2, 10); path(g, shade(L.cap, -0.2));
      ell(g, hx, hy - 2, 46, 18); path(g, shade(L.cap, 0.15));
      rr(g, hx - 16, hy - 20, 32, 12, 4); path(g, shade(L.cap, -0.3), 3);
      ell(g, hx - 26, hy - 50, 18, 9, -0.4); g.fillStyle = 'rgba(255,255,255,.3)'; g.fill();
    }
  }

  function draw(g, id, yaw, flame) {
    const L = LOOK[id];
    const cx = 190, by = 462;
    const o = (d) => cx + yaw * d * 46;

    ell(g, cx + yaw * 10, by - 6, 178, 18); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill();
    // front wheels peeking out (deepest layer)
    for (const s of [-1, 1]) tire(g, o(1) + s * 128, by - 150, 50, 62);

    // raccoon tail curls out to the side
    if (id === 'raccoon') {
      const tx = o(0.5) + 110;
      for (let i = 0; i < 6; i++) { ell(g, tx + i * 9, by - 120 - i * 18, 26 - i, 18, -0.7); path(g, i % 2 ? '#2a2a30' : '#8a8a92', 4); }
    }

    // body / side pods
    const bx = o(0.45);
    cel(g, () => { g.beginPath(); g.moveTo(bx - 150, by - 40); g.lineTo(bx - 140, by - 118); g.quadraticCurveTo(bx, by - 150, bx + 140, by - 118); g.lineTo(bx + 150, by - 40); g.closePath(); }, L.kart, shade(L.kart, -0.28), by - 74);
    g.fillStyle = '#ffffff'; g.fillRect(bx - 142, by - 100, 284, 12);
    if (yaw) { rr(g, bx - Math.sign(yaw) * 150 - 14, by - 116, 28, 76, 10); g.fillStyle = 'rgba(0,0,0,.25)'; g.fill(); }

    // driver
    const tx = o(0.62), ty = by - 196;
    const wide = id === 'bulldog' ? 1.25 : 1;
    for (const s of [-1, 1]) { ell(g, tx + s * 78 * wide, ty + 46, 26, 34, -s * 0.5); path(g, id === 'raccoon' ? L.shirt2 : shade(L.shirt, -0.1)); }
    cel(g, () => rr(g, tx - 76 * wide, ty - 10, 152 * wide, 124, 50), L.shirt, shade(L.shirt, -0.25), ty + 60);
    if (id === 'fox') { g.fillStyle = L.shirt2; g.fillRect(tx - 8, ty, 16, 110); }
    if (id === 'bunny') { rr(g, tx - 60, ty - 6, 120, 18, 9); path(g, L.shirt2, 4); }
    if (id === 'bulldog') {
      rr(g, tx - 66, ty - 16, 132, 26, 12); path(g, '#1c1c22');
      g.fillStyle = '#d8dce4';
      for (let i = -2; i <= 2; i++) { tri(g, [tx + i * 26 - 8, ty - 10], [tx + i * 26, ty - 30], [tx + i * 26 + 8, ty - 10]); g.fill(); }
    }
    head(g, id, L, o(0.85), ty - 64, yaw);

    // seat back
    cel(g, () => rr(g, o(0.35) - 92, by - 166, 184, 70, 22), '#5a3424', '#3e2216', by - 128);

    // engine block (ribbed silver, like the sheet)
    cel(g, () => rr(g, cx - 64, by - 136, 128, 40, 10), '#c8ccd6', '#9aa0ae', by - 116);
    g.strokeStyle = '#7a808e'; g.lineWidth = 3;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx + i * 20, by - 132); g.lineTo(cx + i * 20, by - 100); g.stroke(); }

    // rear bumper + plate
    cel(g, () => rr(g, cx - 120, by - 92, 240, 62, 16), L.kart, shade(L.kart, -0.3), by - 60);
    g.fillStyle = '#ffffff'; g.fillRect(cx - 116, by - 84, 232, 8);
    rr(g, cx - 34, by - 82, 68, 24, 5); path(g, '#f2eee0', 4);

    // twin exhausts
    for (const s of [-1, 1]) {
      const ex = cx + s * 64;
      cel(g, () => rr(g, ex - 24, by - 110, 48, 56, 12), '#d4d8e2', '#9ea4b2', by - 80);
      ell(g, ex, by - 52, 26, 22); path(g, '#c4c8d2');
      ell(g, ex, by - 52, 14, 12); g.fillStyle = '#16161c'; g.fill();
    }
    // rear tyres (closest)
    for (const s of [-1, 1]) tire(g, cx + s * 150, by - 118, 84, 118);
    // coloured fenders over the rear tyres
    for (const s of [-1, 1]) {
      const fx = cx + s * 150;
      g.beginPath(); g.moveTo(fx - 50, by - 92); g.quadraticCurveTo(fx, by - 150, fx + 50, by - 92); g.lineTo(fx + 44, by - 80); g.quadraticCurveTo(fx, by - 126, fx - 44, by - 80); g.closePath();
      path(g, L.kart, 5);
    }

    if (flame) {
      for (const s of [-1, 1]) {
        const ex = cx + s * 64, ey = by - 46, len = flame === 1 ? 50 : 70;
        const gl = g.createRadialGradient(ex, ey + 10, 2, ex, ey + 10, 70);
        gl.addColorStop(0, L.flame[0]); gl.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = 0.85; g.fillStyle = gl; g.fillRect(ex - 70, ey - 60, 140, 140); g.globalAlpha = 1;
        ell(g, ex, ey + len * 0.4, 24, len); g.fillStyle = L.flame[1]; g.fill();
        ell(g, ex, ey + len * 0.3, 14, len * 0.65); g.fillStyle = L.flame[0]; g.fill();
      }
    }
  }

  // native size matches the sheet's kart frames (drawn at 2x, then scaled down for crisp outlines)
  function make(id, yaw, flame) {
    const big = Art.mk(380, 490, (g) => draw(g, id, yaw, flame));   // tall enough for long ears
    return Art.mk(190, 245, (g) => { g.imageSmoothingQuality = 'high'; g.drawImage(big, 0, 0, 190, 245); });
  }
  return { make, has: (id) => !!LOOK[id] };
})();
