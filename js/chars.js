// Characters from the drawn sprite sheet (assets/chars).
// Frames: stand (menu), rear (from behind), turn (turning right; left = mirror), hit, boost.
// Each frame gets a size factor so the kart looks the same size in every frame
// (the sheet draws frames at different scales).
const Chars = (() => {
  const LIST = [
    { id: 'fox', name: 'Fox', frames: ['stand', 'rear', 'hit', 'turn', 'boost'] },
    { id: 'bunny', name: 'Bunny', frames: ['stand', 'rear', 'hit', 'turn', 'boost'] },
    { id: 'bulldog', name: 'Bulldog', frames: ['stand', 'rear', 'hit', 'turn', 'boost'] },
    { id: 'raccoon', name: 'Raccoon', frames: ['stand', 'rear', 'hit'], flame: '#7cff9a' },
  ];
  const img = {}, size = {};
  const byId = (id) => LIST.find((c) => c.id === id) || LIST[0];

  const load = (src) => new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = () => res(null);
    i.src = src;
  });
  function mirror(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
    return c;
  }
  // visible kart area (ignores bright flame pixels so boost frames are not shrunk)
  function area(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const flame = (r > 220 && gg > 150 && b < 120) || (b > 220 && r > 150 && gg > 150 && r + gg + b > 690);
      if (!flame) n++;
    }
    return Math.max(1, n);
  }
  function headOf(stand) {
    const sh = Math.round(stand.height * 0.42);
    const c = document.createElement('canvas');
    c.width = 40; c.height = 40;
    const g = c.getContext('2d');
    const s = Math.min(40 / stand.width, 40 / sh) * 1.25;
    g.drawImage(stand, 0, 0, stand.width, sh, 20 - (stand.width * s) / 2, 2, stand.width * s, sh * s);
    return c;
  }

  async function init() {
    await Promise.all(LIST.flatMap((c) => c.frames.map(async (f) => {
      img[c.id + f] = await load(`assets/chars/${c.id}_${f}.png`);
    })));
    for (const c of LIST) {
      const rear = img[c.id + 'rear'];
      if (!rear) continue;
      const a0 = area(rear);
      for (const f of ['rear', 'hit', 'turn', 'boost']) {
        const im = img[c.id + f];
        if (im) size[c.id + f] = Math.sqrt(a0 / area(im));
      }
      img[c.id + 'rearL'] = mirror(rear); size[c.id + 'rearL'] = 1;
      if (img[c.id + 'turn']) { img[c.id + 'turnL'] = mirror(img[c.id + 'turn']); size[c.id + 'turnL'] = size[c.id + 'turn']; }
      if (img[c.id + 'hit']) { img[c.id + 'hitL'] = mirror(img[c.id + 'hit']); size[c.id + 'hitL'] = size[c.id + 'hit']; }
      if (img[c.id + 'stand']) img[c.id + 'head'] = headOf(img[c.id + 'stand']);
    }
  }

  // yaw: -1..1 (how much the kart is turned), side: last turn side for the near-straight frame
  function frame(id, yaw, side, boost, hit, drift) {
    const pick = (k) => (img[id + k] ? { img: img[id + k], s: size[id + k] || 1 } : null);
    if (hit) return pick(side < 0 ? 'hitL' : 'hit') || pick('rear');
    const a = Math.abs(yaw), left = yaw < 0;
    if (drift || a > 0.6) return pick(left ? 'turnL' : 'turn') || pick(left ? 'rearL' : 'rear');
    if (boost && a < 0.35 && img[id + 'boost']) return pick('boost');
    if (a > 0.18) return pick(left ? 'rearL' : 'rear');
    return pick(side < 0 ? 'rearL' : 'rear');   // straight: keeps the last side, so no flicker
  }
  const hasBoost = (id) => !!img[id + 'boost'];
  const rearWidth = (id) => (img[id + 'rear'] ? img[id + 'rear'].width : 180);

  return { LIST, byId, init, frame, hasBoost, rearWidth,
    stand: (id) => img[id + 'stand'], head: (id) => img[id + 'head'] };
})();
