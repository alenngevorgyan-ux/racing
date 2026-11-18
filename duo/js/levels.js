// Twenty-nine levels, 32 x 18 tiles. Row 17 is the bottom wall.
// Levels 16-29 (the second book) are checked by tests/run.js: a bot plays each one start to finish.
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
      // the whole room as 18 strings of 32 characters ('.' is empty)
      rows: (lines) => {
        if (lines.length !== ROWS || lines.some((ln) => ln.length !== COLS)) throw new Error(`${name}: map must be ${ROWS} x ${COLS}`);
        lines.forEach((ln, r) => [...ln].forEach((ch, c) => { g[r][c] = ch === '.' ? ' ' : ch; }));
      },
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

    make('Wind Tunnel', 'Fans carry you over the shadow. A lever wakes the middle one. Whoever gets in first holds the door from inside.', 90, (a) => {
      a.solid(16, 16, 7, 23, 'G');
      a.solid(14, 16, 10, 10); a.set(13, 10, 'f');
      a.solid(14, 16, 15, 15); a.obj({ type: 'fan', x: 15, y: 13, by: ['k'] });
      a.solid(14, 16, 20, 20); a.set(13, 20, 'f');
      a.set(15, 4, 'k');
      a.solid(6, 6, 23, 30); a.set(5, 28, 'p');
      a.obj({ type: 'gate', x: 25, y: 11, w: 1, h: 5, by: ['p', 'q'] }); a.set(15, 26, 'q');   // inside plate: whoever is in holds the door for the other
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

    make('Saw Alley', 'Spinning saws. Watch the rhythm, then run. Jump the one on the floor.', 60, (a) => {
      a.solid(16, 16, 7, 8, 'L'); a.solid(16, 16, 13, 14, 'W'); a.solid(16, 16, 19, 20, 'G');
      a.obj({ type: 'saw', x: 10.5, y: 9.5, dx: 0, dy: 6, period: 2.4 });
      a.obj({ type: 'saw', x: 16.5, y: 9.5, dx: 0, dy: 6, period: 2.4, phase: 0.5 });
      a.obj({ type: 'saw', x: 22.5, y: 15.5, dx: 5, dy: 0, period: 3.2 });
      a.set(15, 2, '1'); a.set(15, 3, '2');
      a.set(15, 29, 'E'); a.set(15, 30, 'T');
      a.set(15, 7, 'e'); a.set(15, 13, 't'); a.set(13, 10, 'e'); a.set(13, 16, 't'); a.set(15, 12, 's');
      a.set(13, 25, 'e'); a.set(13, 26, 't');
    }),

    make('Elevator Panic', 'The shadow comes fast. Ride the lifts, she melts the ice, the spring throws you home.', 55, (a) => {
      a.flag('rising', { start: 3, speed: 0.42 });
      a.solid(14, 14, 6, 10);
      a.obj({ type: 'mover', x: 11, y: 12, w: 3, h: 0.5, dx: 6, dy: 0, auto: 4 });
      a.solid(11, 11, 20, 25);
      a.obj({ type: 'mover', x: 26, y: 11, w: 3, h: 0.5, dx: 0, dy: -4.5, auto: 4.5 });
      a.solid(7, 7, 16, 24); a.solid(1, 6, 19, 19, 'I');
      a.set(6, 17, 'J');
      a.solid(3, 3, 9, 15);
      a.set(15, 2, '1'); a.set(15, 3, '2');
      a.set(2, 10, 'E'); a.set(2, 12, 'T');
      a.set(13, 8, 'e'); a.set(13, 9, 't'); a.set(10, 22, 'e'); a.set(10, 23, 't'); a.set(6, 21, 's'); a.set(2, 14, 'e'); a.set(2, 15, 't');
    }),

    make('Saw Door', 'Hold the door for each other, with saws in the way. The spring at the end.', 75, (a) => {
      a.solid(1, 9, 16, 16);
      a.obj({ type: 'gate', x: 16, y: 10, w: 1, h: 6, by: ['p', 'q'] });
      a.set(15, 4, 'p'); a.set(15, 27, 'q');
      a.solid(16, 16, 6, 7, 'L'); a.solid(16, 16, 11, 12, 'W');
      a.obj({ type: 'saw', x: 9.5, y: 9.8, dx: 0, dy: 5.7, period: 2.2 });
      a.obj({ type: 'saw', x: 18.5, y: 15.5, dx: 6, dy: 0, period: 2.8 });
      a.solid(11, 11, 20, 28); a.set(15, 29, 'J');
      a.set(15, 2, '1'); a.set(15, 3, '2');
      a.set(10, 22, 'E'); a.set(10, 25, 'T');
      a.set(15, 6, 'e'); a.set(15, 11, 't'); a.set(13, 9, 'e'); a.set(13, 21, 't'); a.set(10, 27, 's'); a.set(10, 20, 'e'); a.set(10, 23, 't');
    }),

    make('Hurricane', 'Fans lift you to the ceiling. Drop to the next one when the saw is low.', 70, (a) => {
      a.solid(16, 16, 7, 26, 'G');
      for (const c of [9, 14, 19, 24]) { a.solid(14, 16, c, c); a.set(13, c, 'f'); }
      a.obj({ type: 'saw', x: 11.5, y: 1.6, dx: 0, dy: 6, period: 2.6 });
      a.obj({ type: 'saw', x: 16.5, y: 1.6, dx: 0, dy: 6, period: 2.6, phase: 0.5 });
      a.obj({ type: 'saw', x: 21.5, y: 1.6, dx: 0, dy: 6, period: 2.6 });
      a.set(15, 2, '1'); a.set(15, 3, '2');
      a.set(15, 28, 'E'); a.set(15, 30, 'T');
      a.set(4, 9, 'e'); a.set(4, 14, 't'); a.set(4, 19, 'e'); a.set(4, 24, 't'); a.set(2, 14, 's'); a.set(14, 29, 'e'); a.set(14, 27, 't');
    }),

    make('Carousel', 'Two lifts ride over the shadow. Hold hands and jump together. The saw only bites if you jump too high.', 50, (a) => {
      a.solid(16, 16, 5, 26, 'G');
      a.obj({ type: 'mover', x: 5, y: 14, w: 3, h: 0.5, dx: 8, dy: 0, auto: 3.5 });
      a.obj({ type: 'mover', x: 15, y: 13, w: 3, h: 0.5, dx: 8, dy: 0, auto: 3.5, phase: 0.5 });
      a.obj({ type: 'saw', x: 19.5, y: 4, dx: 0, dy: 6.8, period: 2.2 });
      a.set(15, 2, '1'); a.set(15, 3, '2');
      a.set(15, 28, 'E'); a.set(15, 30, 'T');
      a.set(11, 9, 'e'); a.set(11, 11, 't'); a.set(9, 19, 's'); a.set(10, 23, 'e'); a.set(10, 24, 't');
    }),
    // ---------------------------------------------------------------- the second book: 14 new rooms
    make('Piggyback', 'He is the ladder: he crouches (hold act), she jumps off his hands. Up there, levers bring him along.', 30, (a) => {
      a.rows([
        '################################',
        '#..............................#',
        '#...................t..........#',
        '#..............................#',
        '#........................s.....#',
        '#.....................m.e.t.E.T#',
        '#....................###########',
        '#....................###########',
        '#....................###########',
        '#....................###########',
        '#........k..e....t...###########',
        '#.......###LLL##WWW#############',
        '#.......########################',
        '#..e....########################',
        '#....t..########################',
        '#.12....########################',
        '################################',
        '################################',
      ]);
      a.obj({ type: 'mover', x: 5, y: 16, w: 3, h: 0.5, dx: 0, dy: -5, by: ['k'] });
      a.obj({ type: 'fan', x: 20, y: 10, by: ['m'] });
    }),

    make('Thin Ice', 'He walks ahead and freezes the blue under her feet (act). It thaws in ten seconds. She melts the ice, then holds the bridge.', 35, (a) => {
      a.rows([
        '################################',
        '#...............#..............#',
        '#...............#..............#',
        '#...............#..............#',
        '#...............#..............#',
        '#...............#..............#',
        '#...............#..............#',
        '#...............#..............#',
        '#...............#..............#',
        '#...............#..............#',
        '#...............#..............#',
        '#...............#..............#',
        '#...............#..............#',
        '#...............#..............#',
        '#...............#.....e........#',
        '#12...e.st.e.t..I.......t..p.ET#',
        '####WWWWWWWWWW###LLLLLLLLLL#####',
        '################################',
      ]);
      a.obj({ type: 'mover', x: 17, y: 11, w: 10, h: 0.5, dx: 0, dy: 5, by: ['p'] });
      a.obj({ type: 'saw', x: 21.5, y: 11.5, dx: 0, dy: 4, period: 2.4 });
    }),

    make('Ferry', 'Crates float. She pushes one through the amber for him to hop on; he does the same in the blue for her.', 45, (a) => {
      a.rows([
        '################################',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#......................e.......#',
        '#..............................#',
        '#12..C...e.........C..t.....E.T#',
        '#######LLLLLLLL#####WWWWWWW#####',
        '################################',
      ]);
      a.set(13, 11, 't'); a.set(14, 17, 's');
    }),

    make('Mirror Hall', 'She walks the underside. Blue in the slab is deadly to her from below too; amber is not. Her levers open his gates, his frost lets her pass.', 35, (a) => {
      a.rows([
        '################################',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#######WWWWWW####LL###G###.....#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '################################',
        '################################',
      ]);
      a.set(7, 2, '2'); a.set(15, 1, '1'); a.set(15, 3, 'v');
      a.set(9, 4, 'k'); a.obj({ type: 'gate', x: 6, y: 1, w: 1, h: 7, by: ['k'] });
      a.set(9, 15, 'm'); a.obj({ type: 'gate', x: 15, y: 1, w: 1, h: 7, by: ['m'] });
      a.set(9, 25, 'v');
      a.set(15, 28, 'E'); a.set(15, 30, 'T');
      a.set(7, 10, 't'); a.set(4, 18, 't'); a.set(4, 22, 't');
      a.set(9, 11, 'e'); a.set(9, 18, 'e'); a.set(12, 22, 'e');
      a.set(14, 29, 's');
    }),

    make('Post Office', 'Four sealed rooms and two rings. Send him upstairs to the lever; she holds the island plate, then mails herself home.', 45, (a) => {
      a.rows([
        '################################',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#...............###............#',
        '#..............................#',
        '######LL#WW##########GGG########',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '###WWWWWWW########LLLLLL#LLLLL##',
        '################################',
      ]);
      // the wall between left and right rooms is just the two gates in col 15
      a.obj({ type: 'gate', x: 15, y: 9, w: 1, h: 7, by: ['k'] });
      a.obj({ type: 'gate', x: 15, y: 1, w: 1, h: 7, by: ['q'] });
      a.set(15, 12, '1'); a.set(15, 11, '2');
      a.set(15, 1, 'O'); a.set(4, 29, 'Q');
      a.set(5, 17, 'k'); a.set(15, 24, 'q');
      a.set(15, 30, 'P'); a.set(4, 12, 'R');
      a.set(7, 2, 'E'); a.set(7, 4, 'T');
      a.set(12, 12, 'e'); a.set(15, 6, 't');
      a.set(4, 22, 't'); a.set(7, 27, 't');
      a.set(15, 20, 'e'); a.set(15, 27, 'e');
      a.set(7, 6, 'e'); a.set(7, 9, 't');
      a.set(6, 3, 's');
    }),

    make('Swap Meet', 'Each of you is boxed in by the other one\'s colour. Three stones, two swaps. Then the ceiling, which drips too.', 40, (a) => {
      a.rows([
        '########################LL#W####',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..........................#####',
        '#..........................#####',
        '#..........................#####',
        '#..........................#####',
        '#..........................#####',
        '#..........................#####',
        '#..........................#####',
        '####WWWWWWW###LLLLLLL###########',
        '################################',
      ]);
      a.set(15, 1, '1'); a.set(15, 13, '2');
      a.set(15, 2, 'X'); a.set(15, 12, 'X'); a.set(15, 21, 'X');
      a.obj({ type: 'saw', x: 17.5, y: 12, dx: 0, dy: 3.5, period: 2.4 });
      a.set(15, 23, 'v'); a.set(1, 29, 'v');
      a.set(8, 28, 'E'); a.set(8, 30, 'T');
      a.set(12, 2, 'e'); a.set(12, 12, 't'); a.set(15, 7, 't'); a.set(15, 17, 'e');
      a.set(1, 24, 'e'); a.set(1, 27, 't'); a.set(12, 22, 't');
      a.set(7, 29, 's');
    }),

    make('Cable Car', 'One car, two plates: it rides while either plate is held. Send each other across, then call it back.', 75, (a) => {
      a.rows([
        '################################',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#######GGGGGGGGGGGGGGG#######..#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '######GGGGGGGGGGGGGGGGGGG#######',
        '################################',
      ]);
      a.set(15, 1, '1'); a.set(15, 2, '2');
      a.set(15, 3, 'p'); a.set(15, 27, 'q');
      a.obj({ type: 'mover', x: 6, y: 16, w: 3, h: 0.5, dx: 16, dy: 0, by: ['p', 'q'] });
      a.set(15, 30, 'J');
      a.set(9, 24, 'r'); a.set(9, 5, 'm');
      a.obj({ type: 'mover', x: 19, y: 10, w: 3, h: 0.5, dx: -12, dy: 0, by: ['r', 'm'] });
      a.set(9, 2, 'E'); a.set(9, 4, 'T');
      a.set(15, 10, 't'); a.set(15, 18, 't'); a.set(15, 13, 'e'); a.set(15, 21, 'e');
      a.set(9, 15, 't'); a.set(9, 11, 'e'); a.set(9, 26, 't'); a.set(12, 28, 'e');
      a.set(8, 3, 's');
    }),

    // ---------------------------------------------------------------- the hard half
    make('Shadow Ladder', 'The shadow climbs. He is the ladder, her levers lift him, the car crosses under a saw: read its rhythm before you board.', 30, (a) => {
      a.flag('rising', { start: 2, speed: 0.6 });
      a.rows([
        '################################',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#......................#########',
        '#......................#########',
        '######.........................#',
        '######..#......................#',
        '######..#......................#',
        '######..#......................#',
        '######..I......................#',
        '#############..................#',
        '#############..................#',
        '#############..................#',
        '#############..................#',
        '#############..................#',
        '################################',
        '################################',
      ]);
      a.set(15, 17, '1'); a.set(15, 18, '2');
      a.obj({ type: 'mover', x: 13, y: 16, w: 3, h: 0.5, dx: 0, dy: -5, by: ['k'] });
      a.set(10, 11, 'k');
      a.obj({ type: 'fan', x: 6, y: 10, by: ['m'] });
      a.set(5, 2, 'm');
      a.obj({ type: 'mover', x: 7, y: 6, w: 3, h: 0.5, dx: 13, dy: 0, auto: 5 });
      a.obj({ type: 'saw', x: 14.5, y: 1.5, dx: 0, dy: 3.7, period: 2, phase: 0.5 });
      a.set(3, 27, 'E'); a.set(3, 29, 'T');
      a.set(12, 13, 't'); a.set(10, 10, 'e'); a.set(10, 7, 't'); a.set(3, 6, 't'); a.set(5, 3, 'e');
      a.set(5, 12, 'e'); a.set(5, 17, 't');
      a.set(2, 28, 's');
    }),

    make('Sawmill', 'Saws over every pool. Wade under yours when its saw is up, jump the other one\'s when the saw is out of your arc. A saw sweeps the door plate. Then upstairs.', 60, (a) => {
      a.rows([
        '################################',
        '################################',
        '################################',
        '################################',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '###########GGGG###WWW##LLL###..#',
        '#############################..#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '######W###L###W###L###G#########',
        '################################',
      ]);
      a.set(15, 1, '1'); a.set(15, 2, '2');
      [6.5, 10.5, 14.5, 18.5, 22.5].forEach((x, i) => a.obj({ type: 'saw', x, y: 11.6, dx: 0, dy: 3.8, period: 1.8, phase: i * 0.2 }));
      a.obj({ type: 'saw', x: 26.5, y: 11.6, dx: 0, dy: 3.8, period: 2.4 });   // right over the door plate
      a.set(15, 26, 'p'); a.set(15, 29, 'q');
      a.obj({ type: 'gate', x: 28, y: 11, w: 1, h: 5, by: ['p', 'q'] });
      a.set(15, 30, 'f');
      a.obj({ type: 'saw', x: 24.5, y: 4.6, dx: 0, dy: 3.8, period: 1.6 });
      a.obj({ type: 'saw', x: 13, y: 4.6, dx: 0, dy: 4.4, period: 2.2 });   // dips into the shadow pit
      a.set(8, 2, 'E'); a.set(8, 4, 'T');
      a.set(15, 6, 't'); a.set(15, 10, 'e'); a.set(15, 14, 't'); a.set(15, 18, 'e');
      a.set(8, 24, 'e'); a.set(8, 19, 't'); a.set(7, 3, 's');
    }),

    make('Crawlspace', 'She crawls a flooded tunnel; he walks the roof above it. His frost only reaches a few cells down there, and it thaws in ten seconds. Keep pace.', 40, (a) => {
      a.rows([
        '################################',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '########LL######G#####LL###....#',
        '#..............................#',
        '####WWWWWWWWWWWWWWWWWWWWWWW#####',
        '################################',
      ]);
      a.set(13, 2, '2'); a.set(15, 1, '1');
      a.set(15, 11, 'I'); a.set(15, 18, 'I');
      a.obj({ type: 'saw', x: 13.5, y: 9.5, dx: 0, dy: 4, period: 2.2 });
      a.obj({ type: 'saw', x: 19.5, y: 9.5, dx: 0, dy: 4, period: 1.9, phase: 0.3 });
      a.obj({ type: 'saw', x: 26, y: 9.5, dx: 0, dy: 4, period: 2.0, phase: 0.6 });
      a.set(15, 28, 'E'); a.set(15, 30, 'T');
      a.set(15, 7, 'e'); a.set(15, 15, 'e'); a.set(15, 24, 'e');
      a.set(10, 9, 't'); a.set(10, 16, 't'); a.set(10, 22, 't');
      a.set(14, 29, 's');
    }),

    make('Gravity Well', 'Shadow above and below. Run across a pad and fall sideways onto the next platform, top or underside. One holds the door from underneath.', 45, (a) => {
      a.rows([
        '##########GGGGGGGGGGGGGGGG######',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#............##L###........#####',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#.....#W###........##L####.....#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '####GGGGGGGGGGGGGGGGGGGGGGGG####',
        '################################',
      ]);
      a.set(15, 1, '1'); a.set(15, 3, '2');
      a.set(15, 2, 'v');                       // floor -> ceiling
      a.set(1, 8, 'v');                        // ceiling -> top of the first platform
      a.set(9, 10, 'v');                       // -> underside of the second
      a.set(6, 18, 'v');                       // -> top of the third
      a.set(9, 25, 'v');                       // -> underside of the fourth
      a.set(6, 29, 'v');                       // -> the floor by the doors
      a.set(6, 13, 'q'); a.set(9, 23, 'r');
      a.obj({ type: 'gate', x: 22, y: 7, w: 1, h: 3, by: ['q', 'r'] });
      a.obj({ type: 'saw', x: 16, y: 8.0, dx: 0, dy: 2.2, period: 1.7 });     // under the second platform: short hop over the amber
      a.set(15, 28, 'E'); a.set(15, 30, 'T');
      a.set(1, 5, 'e'); a.set(9, 7, 't'); a.set(6, 15, 'e'); a.set(9, 21, 'e'); a.set(6, 28, 't'); a.set(1, 4, 't');
      a.set(14, 29, 's');
    }),

    make('Parcel', 'Deliver the crate. She floats it through the amber, the lift takes it up, he floats it through the blue and drops it on the plate. Saws all the way. Then frost her a road.', 55, (a) => {
      a.rows([
        '################################',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '###############..WWWWWWWWW.....#',
        '###############..#########.....#',
        '#................#########.....#',
        '#................#########.....#',
        '#................#########.....#',
        '#................#########.....#',
        '######LLLLLLLLLLL###############',
        '################################',
      ]);
      a.set(15, 1, '1'); a.set(9, 3, '2');
      a.set(15, 4, 'C');
      a.set(9, 10, 'q'); a.obj({ type: 'gate', x: 11, y: 12, w: 1, h: 4, by: ['q'] });
      a.set(15, 15, 'k'); a.obj({ type: 'mover', x: 15, y: 16.35, w: 2, h: 0.5, dx: 0, dy: -6, by: ['k'] });
      a.set(15, 26, 'p'); a.obj({ type: 'gate', x: 28, y: 12, w: 1, h: 4, by: ['p'] });
      a.obj({ type: 'saw', x: 8.5, y: 12.4, dx: 0, dy: 3, period: 2 });
      a.obj({ type: 'saw', x: 13.5, y: 12.4, dx: 0, dy: 3, period: 1.7, phase: 0.5 });
      a.obj({ type: 'saw', x: 20.5, y: 7.2, dx: 0, dy: 2.8, period: 2.2 });
      a.obj({ type: 'saw', x: 23.5, y: 7.2, dx: 0, dy: 2.8, period: 1.8, phase: 0.4 });
      a.set(15, 29, 'E'); a.set(15, 30, 'T');
      a.set(15, 9, 'e'); a.set(15, 14, 'e'); a.set(9, 19, 't'); a.set(9, 24, 't'); a.set(9, 22, 'e'); a.set(9, 6, 't');
      a.set(14, 28, 's');
    }),

    make('Pistons', 'Narrow pistons over the shadow, each with its own beat, and a saw between them. Over the colours, a saw waits at the top of the jump: wade if it is yours.', 60, (a) => {
      a.rows([
        '################################',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '####LLLL##GGGGGG##WWWW##GGGGG###',
        '################################',
      ]);
      a.set(15, 1, '1'); a.set(15, 2, '2');
      // pistons over the shadow: [x, top at rest, travel, period, phase]
      [[10.6, 12.5, 2.5, 1.8, 0], [13.8, 11.5, 3, 2.1, 0.5], [24.6, 12.5, 2.5, 1.9, 0.3], [27.1, 11.8, 2.8, 2.2, 0.8]]
        .forEach(([x, y, dy, auto, phase]) => a.obj({ type: 'mover', x, y, w: 1.4, h: 0.5, dx: 0, dy, auto, phase }));
      a.obj({ type: 'saw', x: 12.9, y: 8.5, dx: 0, dy: 3, period: 1.5 });       // between the first pistons
      a.obj({ type: 'saw', x: 26.35, y: 8.5, dx: 0, dy: 3, period: 1.6, phase: 0.5 });   // between the last ones
      a.obj({ type: 'saw', x: 6, y: 11.5, dx: 0, dy: 2.5, period: 1.7, phase: 0.2 });    // over the amber jump
      a.obj({ type: 'saw', x: 20, y: 11.5, dx: 0, dy: 2.5, period: 1.8, phase: 0.7 });   // over the blue jump
      a.set(15, 29, 'E'); a.set(15, 30, 'T');
      a.set(15, 5, 'e'); a.set(15, 19, 't'); a.set(12, 11, 'e'); a.set(11, 14, 't'); a.set(12, 25, 't'); a.set(11, 27, 'e');
      a.set(14, 29, 's');
    }),

    make('Both of Us', 'Everything at once, and the shadow is coming up behind you. Frost, hands, lever, saws, the ring, the ceiling. Go.', 55, (a) => {
      a.flag('rising', { start: 3, speed: 0.18 });
      a.rows([
        '#########L#W####################',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '########GGGGGG#######..........#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#...........###LLL##WWW#########',
        '#...........####################',
        '#...........####################',
        '#...........####################',
        '#...........####################',
        '####WWWWWW######################',
        '################################',
      ]);
      a.set(15, 1, '1'); a.set(15, 2, '2');
      a.obj({ type: 'mover', x: 10, y: 16, w: 2, h: 0.5, dx: 0, dy: -5, by: ['k'] });
      a.set(10, 13, 'k');
      a.obj({ type: 'saw', x: 16, y: 7.6, dx: 0, dy: 2.8, period: 1.8 });
      a.obj({ type: 'saw', x: 21, y: 7.6, dx: 0, dy: 2.8, period: 2.0, phase: 0.5 });
      a.set(10, 27, 'O'); a.set(4, 2, 'Q');
      a.set(5, 4, 'v'); a.set(1, 15, 'v');
      a.set(5, 18, 'E'); a.set(5, 20, 'T');
      a.set(15, 7, 'e'); a.set(15, 5, 't'); a.set(10, 16, 'e'); a.set(10, 21, 't'); a.set(1, 9, 'e'); a.set(1, 11, 't');
      a.set(4, 19, 's');
    }),

  ];
})();
