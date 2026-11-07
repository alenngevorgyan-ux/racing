// Ten levels, 32 x 18 tiles. Row 17 is the bottom wall.
// Map tiles: '#' wall, 'L' lava, 'W' water, 'G' goo (liquids sit in the floor), 'I' ice wall (Ember melts it),
// 'e' Ember gem, 't' Tide gem, 's' secret gem (both must be next to it), '1' '2' starts, 'E' 'T' doors,
// 'C' crate, 'J' spring, 'v' gravity pad, 'X' swap stone, 'O'<->'Q' and 'P'<->'R' portals,
// 'p' 'q' 'r' pressure plates (signal = the letter), 'k' 'm' levers (signal = the letter), 'f' fan (always on).
// Objects: gates (shrink up when their signal is on), movers (slide by dx/dy), fans with a signal.
const LEVELS = (() => {
  const COLS = 32, ROWS = 18;
  function make(name, note, par, fn) {
    const g = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => (r === 0 || r >= 16 || c === 0 || c === COLS - 1 ? '#' : ' ')));
    const objs = [];
    const flags = {};
    const api = {
      solid: (r0, r1, c0, c1, ch = '#') => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ch; },
      clear: (r0, r1, c0, c1) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ' '; },
      set: (r, c, ch) => { g[r][c] = ch; },
      obj: (o) => objs.push(o),
      flag: (k, v) => { flags[k] = v; },
    };
    fn(api);
    return { name, note, par, map: g.map((row) => row.join('')), objs, flags };
  }

  return [
    make('First Steps', 'She walks through amber, he through blue. The shadow takes both. Stand close and press act: high five.', 45, (a) => {
      a.solid(16, 16, 10, 12, 'L'); a.solid(16, 16, 16, 18, 'W'); a.solid(16, 16, 22, 23, 'G');
      a.solid(14, 14, 4, 8); a.solid(12, 12, 11, 20); a.solid(14, 14, 23, 25);
      a.set(15, 2, '1'); a.set(15, 3, '2');
      a.set(13, 24, 'e');
      a.set(15, 11, 'e'); a.set(15, 17, 't'); a.set(13, 5, 'e'); a.set(13, 7, 't');
      a.set(11, 13, 'e'); a.set(11, 18, 't'); a.set(11, 16, 's');
      a.set(15, 27, 'E'); a.set(15, 29, 'T');
    }),

    make('Hold the Door', 'One of you stands on the plate. The other one goes through.', 70, (a) => {
      a.solid(1, 9, 15, 15);
      a.obj({ type: 'gate', x: 15, y: 10, w: 1, h: 6, by: ['p', 'q'] });
      a.set(15, 6, 'p'); a.set(15, 23, 'q');
      a.solid(16, 16, 10, 11, 'W'); a.solid(16, 16, 19, 20, 'L');
      a.solid(10, 10, 17, 26);
      a.obj({ type: 'mover', x: 27, y: 15, w: 3, h: 1, by: ['r'], dx: 0, dy: -6 });
      a.set(15, 21, 'r'); a.set(9, 25, 'r');
      a.set(15, 2, '1'); a.set(15, 3, '2');
      a.set(15, 10, 't'); a.set(15, 19, 'e'); a.set(15, 16, 'e'); a.set(9, 23, 't'); a.set(9, 17, 's'); a.set(13, 8, 'e'); a.set(13, 9, 't');
      a.set(9, 20, 'E'); a.set(9, 22, 'T');
    }),

    make('Crate Bridge', 'Fill the pit with crates. Then the spring, or his hands, throw you up.', 80, (a) => {
      a.solid(15, 15, 1, 30); a.clear(15, 15, 12, 18); a.solid(16, 16, 12, 18, 'G');
      a.set(14, 4, 'C'); a.set(14, 6, 'C'); a.set(14, 8, 'C');
      a.set(14, 1, '1'); a.set(14, 2, '2');
      a.set(14, 19, 'J');
      a.solid(8, 8, 20, 30);
      a.set(7, 24, 'E'); a.set(7, 27, 'T');
      a.set(13, 15, 'e'); a.set(13, 16, 't'); a.set(7, 21, 'e'); a.set(7, 29, 't');
      a.set(7, 22, 's'); a.set(12, 10, 'e'); a.set(12, 11, 't');
    }),

    make('Freeze & Melt', 'She melts the ice. He freezes the blue (press act standing in it).', 90, (a) => {
      a.solid(12, 15, 9, 9, 'I');
      a.solid(16, 16, 11, 20, 'W');
      a.solid(16, 16, 22, 27, 'L');
      a.obj({ type: 'mover', x: 22, y: 12, w: 6, h: 0.5, by: ['p'], dx: 0, dy: 3.5 });
      a.set(15, 28, 'p');
      a.set(15, 2, '1'); a.set(15, 3, '2');
      a.set(15, 29, 'E'); a.set(15, 30, 'T');
      a.set(15, 15, 't'); a.set(15, 24, 'e'); a.set(14, 5, 't'); a.set(14, 6, 'e');
      a.set(14, 16, 's'); a.set(13, 13, 'e');
    }),

    make('Wind Tunnel', 'Fans carry you over the shadow. A lever wakes the middle one.', 90, (a) => {
      a.solid(16, 16, 7, 23, 'G');
      a.solid(14, 16, 10, 10); a.set(13, 10, 'f');
      a.solid(14, 16, 15, 15); a.obj({ type: 'fan', x: 15, y: 13, by: ['k'] });
      a.solid(14, 16, 20, 20); a.set(13, 20, 'f');
      a.set(15, 4, 'k');
      a.solid(6, 6, 23, 30); a.set(5, 28, 'p');
      a.obj({ type: 'gate', x: 25, y: 11, w: 1, h: 5, by: ['p'] });
      a.solid(7, 10, 25, 25);
      a.set(15, 2, '1'); a.set(15, 3, '2');
      a.set(15, 27, 'E'); a.set(15, 29, 'T');
      a.set(6, 12, 'e'); a.set(6, 13, 't'); a.set(4, 18, 'e'); a.set(4, 19, 't'); a.set(5, 26, 's');
    }),

    make('Swap Stones', 'Stand on the stones together and swap places.', 90, (a) => {
      a.solid(1, 15, 15, 16);
      a.set(15, 1, 'T'); a.obj({ type: 'gate', x: 2, y: 12, w: 1, h: 4, by: ['m'] });
      a.set(15, 4, 'k'); a.solid(16, 16, 5, 11, 'W'); a.set(15, 13, 'X');
      a.set(15, 18, 'X'); a.solid(16, 16, 20, 26, 'L'); a.set(15, 27, 'm');
      a.obj({ type: 'gate', x: 28, y: 12, w: 1, h: 4, by: ['k'] }); a.set(15, 30, 'E');
      a.set(14, 12, '1'); a.set(14, 19, '2');
      a.set(15, 8, 't'); a.set(15, 23, 'e'); a.set(13, 6, 't'); a.set(13, 25, 'e');
    }),

    make('Portal Pair', 'Step into one ring, come out of the other.', 80, (a) => {
      a.solid(1, 9, 16, 16);
      a.obj({ type: 'gate', x: 16, y: 10, w: 1, h: 6, by: ['p'] });
      a.solid(6, 6, 19, 30); a.set(5, 28, 'p');
      a.set(14, 7, 'O'); a.set(4, 22, 'Q');
      a.set(14, 25, 'P'); a.set(3, 4, 'R'); a.solid(5, 5, 2, 9); a.set(4, 7, 's');
      a.set(15, 2, '1'); a.set(15, 3, '2');
      a.set(15, 27, 'E'); a.set(15, 29, 'T');
      a.solid(16, 16, 10, 12, 'L'); a.solid(16, 16, 19, 21, 'W');
      a.set(15, 11, 'e'); a.set(15, 20, 't'); a.set(5, 20, 'e'); a.set(5, 24, 't'); a.set(4, 3, 'e'); a.set(4, 9, 't');
    }),

    make('Upside Down', 'Purple pads flip your gravity. The ceiling is a floor too.', 90, (a) => {
      a.solid(16, 16, 9, 22, 'G');
      a.set(15, 6, 'v');
      a.solid(0, 0, 13, 15, 'L');
      a.set(1, 25, 'p');
      a.set(1, 28, 'v');
      a.obj({ type: 'mover', x: 9, y: 11, w: 14, h: 0.5, by: ['p'], dx: 0, dy: 4.5 });
      a.set(15, 2, '1'); a.set(15, 3, '2');
      a.set(15, 27, 'E'); a.set(15, 29, 'T');
      a.set(1, 10, 'e'); a.set(1, 18, 't'); a.set(1, 14, 'e'); a.set(15, 24, 't'); a.set(1, 21, 's');
    }),

    make('Tethered', 'A rope ties you together. Fall, hang on, climb back (hold up).', 100, (a) => {
      a.flag('tether', 5);
      a.solid(10, 16, 1, 30);
      a.clear(10, 15, 7, 14); a.solid(16, 16, 7, 14, 'G'); a.solid(10, 16, 11, 11);
      a.clear(10, 15, 18, 25); a.solid(16, 16, 18, 25, 'G'); a.solid(10, 16, 20, 20); a.solid(10, 16, 23, 23);
      a.set(9, 2, '1'); a.set(9, 3, '2');
      a.set(9, 27, 'E'); a.set(9, 29, 'T');
      a.set(9, 11, 'e'); a.set(9, 20, 't'); a.set(9, 23, 'e'); a.set(9, 16, 't'); a.set(13, 9, 's');
      a.set(8, 5, 'e'); a.set(8, 28, 't');
    }),

    make('Rising Shadow', 'The shadow is rising. Climb together, fast.', 75, (a) => {
      a.flag('rising', { start: 4, speed: 0.3 });
      a.solid(14, 14, 18, 30);
      a.solid(12, 12, 8, 20); a.set(12, 12, 'W'); a.set(12, 13, 'W');
      a.solid(10, 10, 1, 10);
      a.solid(8, 8, 9, 22); a.set(8, 12, 'L'); a.set(8, 13, 'L'); a.solid(6, 7, 17, 17, 'I');
      a.solid(6, 6, 21, 30); a.set(5, 28, 'k');
      a.solid(4, 4, 9, 19);
      a.obj({ type: 'gate', x: 14, y: 1, w: 1, h: 3, by: ['k'] });
      a.set(15, 2, '1'); a.set(15, 3, '2');
      a.set(3, 10, 'E'); a.set(3, 12, 'T');
      a.set(13, 25, 'e'); a.set(13, 27, 't'); a.set(11, 12, 't'); a.set(7, 12, 'e'); a.set(9, 3, 's'); a.set(3, 17, 'e'); a.set(3, 18, 't');
    }),
  ];
})();
