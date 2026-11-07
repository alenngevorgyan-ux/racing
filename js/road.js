// Трасса из сегментов для псевдо-3D (2.5D) рендера: повороты, холмы, декорации.
const Road = (() => {
  const SEG = 200;      // длина сегмента
  const RUMBLE = 3;     // сегментов на одну полосу бордюра
  const ROAD = 2000;    // половина ширины дороги
  const segs = [];

  const lastY = () => (segs.length ? segs[segs.length - 1].p2.world.y : 0);
  const easeIn = (a, b, p) => a + (b - a) * p * p;
  const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

  function add(curve, y) {
    const n = segs.length;
    segs.push({
      index: n,
      p1: { world: { y: lastY(), z: n * SEG }, camera: {}, screen: {} },
      p2: { world: { y, z: (n + 1) * SEG }, camera: {}, screen: {} },
      curve, sprites: [], dark: Math.floor(n / RUMBLE) % 2 === 1,
    });
  }
  function addRoad(enter, hold, leave, curve, height) {
    const sy = lastY(), ey = sy + height * SEG, total = enter + hold + leave;
    for (let n = 0; n < enter; n++) add(easeIn(0, curve, n / enter), easeInOut(sy, ey, n / total));
    for (let n = 0; n < hold; n++) add(curve, easeInOut(sy, ey, (enter + n) / total));
    for (let n = 0; n < leave; n++) add(easeInOut(curve, 0, n / leave), easeInOut(sy, ey, (enter + hold + n) / total));
  }

  addRoad(10, 20, 10, 0, 0);
  addRoad(25, 50, 25, 0, 0);
  addRoad(50, 50, 50, 3, 12);
  addRoad(25, 50, 25, 0, -12);
  addRoad(25, 25, 25, -4, 0);
  addRoad(25, 25, 25, 4, 0);
  addRoad(25, 25, 25, -3, 8);
  addRoad(50, 80, 50, 0, 18);
  addRoad(50, 50, 50, -5, -18);
  addRoad(25, 50, 25, 2, 10);
  addRoad(25, 50, 25, 0, -10);
  addRoad(50, 75, 50, 5, 0);
  addRoad(25, 25, 25, 0, 12);
  addRoad(25, 25, 25, -4, -12);
  addRoad(25, 50, 25, -2, 0);
  addRoad(50, 50, 50, 0, -lastY() / SEG);

  const N = segs.length;
  const LENGTH = N * SEG;
  const START_SEG = 4;
  const START_Z = START_SEG * SEG; // линия старта/финиша
  segs[START_SEG].start = 1; segs[START_SEG + 1].start = 2;

  // ---------- Декорации ----------
  let seed = 20240214;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const S = Art.scenery;
  const put = (i, def, o, extra) => segs[i % N].sprites.push(Object.assign({ def, o }, extra));

  put(START_SEG, Art.banner, 0);
  let heartId = 0;
  for (let i = 8; i < N; i++) {
    if (i % 3 === 0) {
      for (const side of [-1, 1]) {
        if (rnd() < 0.55) {
          const r = rnd();
          const def = r < 0.45 ? S.tree : r < 0.75 ? S.pine : r < 0.92 ? S.bush : S.mushroom;
          put(i, def, side * (1.55 + rnd() * 2.6));
        }
      }
    }
    if (i % 5 === 0 && rnd() < 0.7) put(i, S.flowers, (rnd() < 0.5 ? -1 : 1) * (1.3 + rnd() * 0.5));
    if (i % 45 === 20) put(i, S.balloon, (i % 90 < 45 ? -1 : 1) * 1.35);
    if (i % 170 === 85) put(i, Art.signs[Math.floor(i / 170) % Art.signs.length], (Math.floor(i / 170) % 2 ? 1 : -1) * 1.75);
    if (i > 60 && i % 130 === 65) {
      const gap = rnd() < 0.5 ? -0.5 : 0.5;
      put(i, S.cone, -gap); put(i + 1, S.cone, -gap * 0.4);
    }
    if (i % 55 === 30) put(i, S.heartPick, [-0.5, 0, 0.5][Math.floor(rnd() * 3)], { pick: heartId++ });
  }

  const findSeg = (z) => segs[Math.floor((((z % LENGTH) + LENGTH) % LENGTH) / SEG) % N];

  return { SEG, ROAD, segs, N, LENGTH, START_Z, findSeg };
})();
