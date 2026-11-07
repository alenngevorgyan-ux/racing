// Персонажи из нарисованного спрайт-листа (assets/chars).
// Кадры: stand — в полный рост для меню, rear — сзади, turn — поворот вправо (влево = зеркало),
// hit — удар, boost — нитро. Если кадра нет, берётся ближайший подходящий.
const Chars = (() => {
  const LIST = [
    { id: 'fox', name: 'Лис', frames: ['stand', 'rear', 'hit', 'turn', 'boost'] },
    { id: 'bunny', name: 'Зайка', frames: ['stand', 'rear', 'hit', 'turn', 'boost'] },
    { id: 'bulldog', name: 'Бульдог', frames: ['stand', 'rear', 'hit', 'turn', 'boost'] },
    { id: 'raccoon', name: 'Енот', frames: ['stand', 'rear', 'hit'], flame: '#7cff9a' },
  ];
  const img = {};
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
  function headOf(stand) {
    // голова — верхняя часть фигуры в полный рост
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
      if (img[c.id + 'turn']) img[c.id + 'turnL'] = mirror(img[c.id + 'turn']);
      if (img[c.id + 'stand']) img[c.id + 'head'] = headOf(img[c.id + 'stand']);
    }
  }

  // pose: 'C' | 'L' | 'R' | 'H'
  function frame(id, pose, boost) {
    const g = (k) => img[id + k];
    if (pose === 'H' && g('hit')) return g('hit');
    if (boost && g('boost')) return g('boost');
    if (pose === 'R' && g('turn')) return g('turn');
    if (pose === 'L' && g('turnL')) return g('turnL');
    return g('rear');
  }
  const hasBoost = (id) => !!img[id + 'boost'];
  const rearWidth = (id) => (img[id + 'rear'] ? img[id + 'rear'].width : 180);

  return { LIST, byId, init, frame, hasBoost, rearWidth,
    stand: (id) => img[id + 'stand'], head: (id) => img[id + 'head'] };
})();
