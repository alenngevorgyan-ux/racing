// Scripted runs through the new levels: both characters, every gem, the secret, no falls.
// Each solution is closed loop (it reads positions like a player watching the screen),
// so the same script also has to survive other frame rates and late key presses.
'use strict';

const E = 'ember', T = 'tide';   // she = Ember (amber), he = Tide (blue)
const S = {};

// he crouches, she jumps off his hands; o = jump options for her
function* boost(b, o) {
  const crouch = () => b.hold(T, { act: true }, () => false, 60);
  yield* b.race((function* () {
    for (let attempt = 0; attempt < 4; attempt++) {
      let steady = 0;   // he has to be visibly crouched for a moment
      yield* b.until(() => (steady = b.P(T).crouch ? steady + 1 : 0) > 6, 4, 'he crouches');
      if (Math.abs(b.P(E).x - b.P(T).x) > 0.4) { yield* b.walk(E, b.P(T).x, 0.2); continue; }
      let boosted = false;
      yield* b.jump(E, Object.assign({}, o, { until: (p, t) => { if (p.vy * p.g < -18) boosted = true; return (t > 0.2 && !boosted) || (o.until ? o.until(p, t) : (t > 0.1 && p.onGround)); } }));
      if (boosted) {   // finish the move if it was cut short above
        if (!b.P(E).onGround) yield* b.jump(E, Object.assign({}, o, { air: true }));
        return;
      }
      yield* b.until(() => b.P(E).onGround, 2, 'she lands');
    }
    throw new Error('boost never worked');
  })(), crouch());
}
// press act once
function* act(b, role) { yield* b.tap(role, 'act'); }
// walk there and pull the lever / press act
function* use(b, role, x) { yield* b.walk(role, x); yield* act(b, role); }

S['Piggyback'] = function* (b) {
  yield* b.wait(0.3);
  yield* b.par(
    (function* () { yield* b.walk(E, 3.5); yield* b.jump(E, {}); })(),
    (function* () { yield* b.walk(T, 5.5); yield* b.jump(T, {}); })(),
  );
  yield* b.par(b.walk(T, 7.6), b.walk(E, 7.6));
  yield* boost(b, { tx: 9.5 });
  yield* act(b, E);                                         // lever k: his lift
  yield* b.until(() => b.L().movers[0].t >= 1, 5, 'lift up');
  yield* b.par(
    (function* () { yield* b.walk(E, 12.5); yield* b.walk(E, 15); yield* b.jump(E, { tx: 19.6 }); yield* b.walk(E, 20.3); })(),
    (function* () { yield* b.walk(T, 10.4); yield* b.jump(T, { tx: 14.6 }); yield* b.walk(T, 20.3); })(),
  );
  yield* boost(b, { tx: 22.5 });
  yield* act(b, E);                                         // lever m: his fan
  yield* b.hold(T, { jump: true }, () => b.P(T).y < 3, 5);   // hold jump to rise in the wind
  yield* b.jump(T, { tx: 25.5, hold: 0, air: true, until: (p) => p.onGround && p.y < 7 });
  yield* b.par(b.walk(E, 24.8), b.walk(T, 25.5));
  yield* b.jump(E, { tx: 25.5 });                           // secret, with him beside her
  yield* b.par(b.walk(E, 28.5), b.walk(T, 30.5));
};

// where saw i is right now (same formula as the game)
function sawAt(b, i, dt = 0) {
  const L = b.L(), sw = L.saws[i];
  const k = (1 - Math.cos(((L.t + dt) / sw.period + sw.phase) * Math.PI * 2)) / 2;
  return { x: sw.x + sw.dx * k, y: sw.y + sw.dy * k };
}
// wait until saw i will stay clear of (x, y) by `gap` for the next `s` seconds
function* sawGap(b, i, ok, s, maxS = 10) {
  yield* b.until(() => { for (let d = 0; d <= s; d += 0.05) if (!ok(sawAt(b, i, d))) return false; return true; }, maxS, 'a gap in saw ' + i);
}

S['Thin Ice'] = function* (b) {
  yield* b.wait(0.3);
  yield* use(b, T, 6.3);                                   // first freeze
  yield* b.par(b.walk(E, 6.5), b.walk(T, 9.6));
  yield* b.par(b.walk(E, 8.5), b.walk(T, 10.4));            // secret between them
  yield* use(b, T, 11.2);                                  // second freeze
  yield* b.par(b.walk(E, 11.5), b.walk(T, 13.5));
  yield* b.par(b.walk(E, 15.5), b.walk(T, 14.6));
  yield* b.walk(E, 17.4);                                  // melts the ice on the way
  yield* b.par(b.walk(T, 16.5), b.walk(E, 19.6));
  yield* sawGap(b, 0, (q) => q.y < 13.6, 1.1);
  yield* b.walk(E, 22.5);
  yield* b.jump(E, {});
  yield* b.walk(E, 27.5);                                  // plate: the bridge comes down
  yield* b.until(() => b.L().movers[0].t >= 1, 4, 'bridge down');
  yield* b.walk(T, 19.6);
  yield* sawGap(b, 0, (q) => q.y < 13.6, 0.9);
  yield* b.walk(T, 30.5);
  yield* b.walk(E, 29.5);
};

const crate = (b, i) => b.L().crates[i];
// push crate i (to the right) until its left edge is at x; the pusher follows it
function* pushTo(b, role, i, x) {
  yield* b.run(role, 1, () => crate(b, i).x >= x, { noHop: true });
  yield* b.until(() => Math.abs(crate(b, i).vx) < 0.05 && Math.abs(crate(b, i).vy) < 0.05, 3, 'crate settles');
}

S['Ferry'] = function* (b) {
  yield* b.wait(0.3);
  yield* b.walk(T, 2.2);
  yield* b.walk(E, 4.4);
  yield* pushTo(b, E, 0, 10.5);                             // raft into the amber
  yield* b.walk(E, 9.5);                                   // gem, then step back
  yield* b.walk(E, 8.4);
  yield* b.walk(T, 6.6);
  yield* b.jump(T, { tx: 11.0 });                          // hop on the raft
  yield* b.jump(T, {});                                    // gem above it
  yield* b.jump(T, { tx: 15.7 });
  yield* b.walk(E, 14.4);
  yield* b.jump(E, { tx: 16.4 });
  yield* b.par(b.walk(E, 17.5), b.walk(T, 16.6));
  yield* b.jump(E, {});                                    // secret, he is right there
  yield* b.walk(E, 15.6);
  yield* b.walk(T, 17.9);
  yield* pushTo(b, T, 1, 22.6);                             // raft into the blue
  yield* b.walk(T, 22.0);
  yield* b.walk(T, 21.0);
  yield* b.walk(E, 19.6);
  yield* b.jump(E, { tx: 23.5 });
  yield* b.jump(E, {});                                    // gem above the raft
  yield* b.jump(E, { tx: 28.5 });
  yield* b.walk(T, 23.5);
  yield* b.walk(T, 26.4);
  yield* b.walk(T, 30.5);
};

S['Mirror Hall'] = function* (b) {
  // slab: blue 7-12, amber 17-18, shadow 21; his gates at 6 and 15; her levers at 4 and 15
  yield* b.wait(0.3);
  yield* b.walk(E, 3.5);                                   // the pad flips her up to the slab
  yield* b.until(() => b.P(E).g < 0 && b.P(E).onGround, 3, 'she lands on the underside');
  yield* use(b, E, 4.5);                                   // lever k: his first gate
  yield* b.until(() => b.L().gates[0].open > 0.95, 3, 'gate 1');
  yield* b.par(b.walk(T, 10.0), b.walk(E, 6.0));
  yield* act(b, T);                                        // frost over the slab water
  yield* b.walk(E, 14.0);
  yield* use(b, E, 15.5);                                  // lever m: his second gate
  yield* b.until(() => b.L().gates[1].open > 0.95, 3, 'gate 2');
  yield* b.walk(T, 16.4);
  yield* b.jump(T, { tx: 20.0, via: 18.5 });               // over the amber, gem on top
  yield* b.walk(T, 21.0);
  yield* b.jump(T, { tx: 24.0, via: 22.5 });               // over the shadow
  yield* b.walk(E, 17.5);
  yield* b.walk(E, 21.0);
  yield* b.jump(E, { tx: 24.0, via: 22.5 });               // under the shadow
  yield* b.walk(E, 25.5);                                  // pad: back on her feet
  yield* b.until(() => b.P(E).g > 0 && b.P(E).onGround, 3, 'she lands on the floor');
  yield* b.walk(T, 27.5);
  yield* b.until(() => b.P(T).onGround && b.P(T).y > 15, 3, 'he lands');
  yield* b.par(b.walk(E, 29.5), b.walk(T, 30.3));
  yield* b.jump(E, {});                                    // secret between the doors
  yield* b.par(b.walk(E, 28.5), b.walk(T, 30.5));
};

S['Post Office'] = function* (b) {
  yield* b.wait(0.3);
  yield* b.jump(E, {});                                    // gem over her head
  yield* b.walk(T, 6.5);                                   // through the blue, gem
  yield* b.race(b.until(() => b.P(T).x > 20, 6, 'he went through O'), b.walk(T, 1.2));   // ring O, out of Q upstairs
  yield* b.until(() => b.P(T).onGround, 2, 'he lands upstairs');
  yield* b.walk(T, 27.5);
  yield* b.walk(T, 24.8);
  yield* b.jump(T, { tx: 20.0, via: 22.5 });               // over the shadow, gem on top
  yield* b.jump(T, { tx: 17.5 });                          // onto the lever ledge
  yield* act(b, T);                                        // lever k: the lower gate
  yield* b.until(() => b.L().gates[0].open > 0.95, 3, 'lower gate');
  yield* b.walk(E, 20.5);                                  // amber, gem
  yield* b.walk(E, 24.5);                                  // island plate q: the upper gate
  yield* b.until(() => b.L().gates[1].open > 0.95, 3, 'upper gate');
  yield* b.walk(T, 9.5);                                   // home through the blue
  yield* b.walk(T, 8.5);
  yield* b.jump(T, { tx: 5.4 });                           // over the amber
  yield* b.walk(T, 4.5);
  yield* b.walk(E, 27.5);
  yield* b.race(b.until(() => b.P(E).x < 20, 6, 'she went through P'), b.walk(E, 30.8));  // ring P, out of R upstairs
  yield* b.until(() => b.P(E).onGround, 2, 'she lands upstairs');
  yield* b.walk(E, 11.4);
  yield* b.jump(E, { tx: 7.0 });                           // over the blue into the amber
  yield* b.walk(E, 6.5);
  yield* b.walk(E, 3.5);
  yield* b.jump(E, {});                                    // secret between the doors
  yield* b.walk(E, 2.5);
};

// run from where you stand to toX once no saw will be near your path (a predicted straight run);
// margin is extra room on top of the real hit distance
function* dash(b, role, toX, margin = 0.35, speed = 6.6, maxS = 12) {
  const p = b.P(role), x0 = p.x, dir = Math.sign(toX - x0), cy = p.g > 0 ? p.y - 0.46 : p.y + 0.46;
  const T = Math.abs(toX - x0) / speed + 0.25;
  const safe = () => {
    for (let d = 0; d <= T; d += 1 / 60) {
      const x = x0 + dir * Math.min(Math.abs(toX - x0), Math.max(0, d - 0.12) * speed);
      for (let i = 0; i < b.L().saws.length; i++) {
        const q = sawAt(b, i, d), sw = b.L().saws[i];
        if (Math.hypot(q.x - x, q.y - cy) < sw.r + 0.3 + margin) return false;
      }
    }
    return true;
  };
  yield* b.until(safe, maxS, `a safe moment to run to ${toX}`);
  yield* b.walk(role, toX);
}
function* underSaw(b, role, i, fromX, toX) { yield* b.walk(role, fromX); yield* dash(b, role, toX); }

S['Swap Meet'] = function* (b) {
  yield* b.wait(0.3);
  yield* b.walk(E, 2.5);
  yield* b.par(b.jump(E, {}), b.walk(T, 12.5));
  yield* b.jump(T, {});
  yield* act(b, E);                                        // swap 1: she is in his pocket, he in hers
  yield* b.until(() => b.P(E).x > 10, 1, 'swap 1');
  yield* b.par(underSaw(b, E, 0, 13.8, 21.5), (function* () { yield* b.walk(T, 7.5); yield* b.walk(T, 12.5); })());
  yield* act(b, T);                                        // swap 2: he jumps to the far stone
  yield* b.until(() => b.P(T).x > 20, 1, 'swap 2');
  yield* b.walk(T, 22.5);
  yield* b.jump(T, {});                                    // gem
  yield* underSaw(b, E, 0, 13.8, 21.0);
  yield* b.walk(T, 23.5);                                  // pad: up to the ceiling
  yield* b.until(() => b.P(T).g < 0 && b.P(T).onGround, 3, 'he is on the ceiling');
  yield* b.walk(T, 23.3);
  yield* b.jump(T, { tx: 27.5 });                          // past the dripping amber
  yield* b.walk(T, 29.5);                                  // pad: down onto the shelf
  yield* b.until(() => b.P(T).g > 0 && b.P(T).onGround, 3, 'he is on the shelf');
  yield* b.walk(E, 23.5);
  yield* b.until(() => b.P(E).g < 0 && b.P(E).onGround, 3, 'she is on the ceiling');
  yield* b.walk(E, 26.5);
  yield* b.jump(E, { tx: 28.6 });                          // past the dripping blue
  yield* b.walk(E, 29.5);
  yield* b.until(() => b.P(E).g > 0 && b.P(E).onGround, 3, 'she is on the shelf');
  yield* b.walk(T, 30.4);
  yield* b.walk(E, 29.3);
  yield* b.jump(E, {});                                    // secret
  yield* b.par(b.walk(E, 28.5), b.walk(T, 30.5));
};

const mover = (b, i) => b.L().movers[i];
// walk onto a spring (no jump on the ground), hold jump once it throws you, steer to tx once above topY
function* spring(b, role, dir, topY, tx) {
  yield* b.run(role, dir, (p) => p.vy * p.g < -15, { noHop: true });
  yield* b.hold(role, { jump: true }, () => b.P(role).y < topY, 3);
  yield* b.jump(role, { tx, air: true, hold: 9, until: (p) => p.onGround });
}
// ride mover i: step onto its middle, then stay on its middle until it reaches t
function* ride(b, role, i, t) {
  const m = mover(b, i), mid = () => m.x + m.dx * m.t + m.w / 2;
  yield* b.walk(role, mid(), 0.25);
  for (const t0 = b.L().t; b.L().t - t0 < 15 && Math.abs(m.t - t) > 0.01;) {
    const d = mid() - b.P(role).x;
    yield { [role]: Math.abs(d) > 0.3 ? (d > 0 ? { right: true } : { left: true }) : {} };
  }
}

S['Cable Car'] = function* (b) {
  yield* b.wait(0.3);
  yield* b.walk(T, 7.5);                                   // he boards
  yield* b.par(b.walk(E, 3.5), ride(b, T, 0, 1));          // she holds p: the car takes him across
  yield* b.walk(T, 28.6);                                  // over plate q and off it: the car goes home
  yield* b.walk(E, 5.2);
  yield* b.until(() => mover(b, 0).t < 0.01, 6, 'car home');
  yield* b.walk(E, 7.5);
  yield* b.par(b.walk(T, 27.5), ride(b, E, 0, 1));         // he calls it with q
  yield* b.walk(E, 26.5);
  yield* b.walk(T, 28.6);
  yield* b.jump(T, {});                                    // nothing up here for him...
  yield* b.walk(E, 28.5);
  yield* b.jump(E, {});                                    // ...her gem over the shore
  for (const role of [T, E]) yield* spring(b, role, 1, 10.6, 26.5);   // up onto the upper shore
  yield* b.walk(T, 20.5);                                  // he boards the upper car
  yield* b.par(b.walk(E, 24.5), ride(b, T, 1, 1));         // she holds r
  yield* b.walk(T, 6.0);
  yield* b.walk(E, 23.0);
  yield* b.until(() => mover(b, 1).t < 0.01, 6, 'upper car home');
  yield* b.walk(E, 20.5);
  yield* b.par(use(b, T, 5.5), ride(b, E, 1, 1));          // lever m calls it for her
  yield* b.walk(E, 5.5);
  yield* b.par(b.walk(E, 3.2), b.walk(T, 4.0));
  yield* b.jump(E, {});                                    // secret
  yield* b.par(b.walk(E, 2.5), b.walk(T, 4.5));
};

// mover i's rectangle dt seconds from now (auto movers only)
function moverAt(b, i, dt = 0) {
  const L = b.L(), m = L.movers[i];
  const k = (1 - Math.cos(((L.t + dt) / m.auto + (m.phase || 0)) * Math.PI * 2)) / 2;
  return { x: m.x + m.dx * k, y: m.y + m.dy * k, w: m.w, h: m.h };
}
// will someone standing at offset `off` on auto mover i stay clear of every saw for the next `s` seconds?
function rideSafe(b, i, off, s, margin = 0.3) {
  for (let d = 0; d <= s; d += 1 / 60) {
    const m = moverAt(b, i, d), x = m.x + off, cy = m.y - 0.46;
    for (let j = 0; j < b.L().saws.length; j++) {
      const q = sawAt(b, j, d);
      if (Math.hypot(q.x - x, q.y - cy) < b.L().saws[j].r + 0.3 + margin) return false;
    }
  }
  return true;
}
// stand on auto mover i at offset off (from its left edge) until cond()
function* rideAuto(b, role, i, off, cond, maxS = 15) {
  for (const t0 = b.L().t; b.L().t - t0 < maxS;) {
    if (cond()) return;
    const m = moverAt(b, i), d = m.x + off - b.P(role).x;
    const v = b.P(role).vx - (moverAt(b, i, 0.02).x - m.x) / 0.02;
    yield { [role]: Math.abs(d) > 0.25 ? (d > 0 ? { right: true } : { left: true }) : {} };
  }
  throw new Error(role + ' ride never ended');
}

S['Shadow Ladder'] = function* (b) {
  yield* b.wait(0.2);
  yield* b.par(b.walk(T, 13.4), b.walk(E, 13.4));
  yield* boost(b, { tx: 11.5 });                           // she goes up the face of the ledge
  yield* act(b, E);                                        // lever k: his lift
  yield* b.walk(E, 10.5);                                  // gem
  yield* b.walk(E, 7.0);                                   // melts the ice on the way
  yield* b.until(() => mover(b, 0).t >= 1, 4, 'lift up');
  yield* b.par(b.walk(E, 6.5), b.walk(T, 6.5));
  yield* boost(b, { tx: 3.0 });                            // up to the top ledge
  yield* use(b, E, 2.5);                                   // lever m: his fan
  yield* b.hold(T, { jump: true }, () => b.P(T).y < 3.2, 5);
  yield* b.jump(T, { tx: 4.0, hold: 0, air: true, until: (p) => p.onGround });
  yield* b.par(b.walk(E, 4.6), b.walk(T, 5.5));
  // the car: board as it comes home, but only on a trip where the saw is up when you pass under it
  const home = () => { const m = moverAt(b, 1); return m.x < 7.4 && moverAt(b, 1, 0.05).x < m.x; };
  const tripSafe = () => { const L = b.L(), m = L.movers[1];
    const toHome = m.auto - (((L.t / m.auto) % 1 + 1) % 1) * m.auto;   // seconds until the car is home
    for (let d = toHome; d <= toHome + 2.6; d += 1 / 60) for (const off of [1.5, 2.2]) {
      const r = moverAt(b, 1, d), q = sawAt(b, 0, d);
      if (Math.hypot(q.x - (r.x + off), q.y - (r.y - 0.46)) < 0.72 + 0.3) return false;
    }
    return true; };
  if (process.env.SLOW) yield* b.wait(+process.env.SLOW);   // a slower pair misses the first good car
  yield* b.until(() => home() && tripSafe(), 30, 'a safe car');
  yield* b.par(b.jump(T, { tx: 8.6, hold: 0.12 }), b.jump(E, { tx: 9.2, hold: 0.12 }));
  yield* b.par(
    rideAuto(b, T, 1, 1.5, () => moverAt(b, 1).x > 19.6),
    rideAuto(b, E, 1, 2.2, () => moverAt(b, 1).x > 19.6),
  );
  yield* b.par(b.jump(E, { tx: 24.5 }), b.jump(T, { tx: 25.5 }));
  yield* b.par(b.walk(E, 27.7), b.walk(T, 28.9));
  yield* b.jump(E, { tx: 28.4 });                          // secret
  yield* b.par(b.walk(E, 27.5), b.walk(T, 29.5));
};

// ---------------------------------------------------------------- saw-aware moves
// predicted centre path of a chain of moves from the player's current state (open air, no collisions).
// A move is { kind: 'walk' | 'jump', x, hold, late } (late: frames the jump key lands after the run key)
function predict(b, role, moves) {
  const p = b.P(role), g = p.g, dt = 1 / b.FPS, out = [];
  const floor0 = p.g > 0 ? p.y - 0.46 : p.y + 0.46;
  let x = p.x, vx = p.vx, y = floor0, t = 0;
  for (const mv of moves) {
    let vy = 0, air = false, started = false, base = y;
    const hold = mv.hold == null ? 9 : mv.hold, late = mv.late || 0;
    for (let n = 0, tt = 0; n < 4 * b.FPS; n++, tt += dt, t += dt) {
      if (mv.kind === 'jump' && tt >= late) air = true;
      const via = mv.via != null && !(started && vy * g >= 0);
      const d = (via ? mv.via : mv.x) - x, a = started ? 42 : 70, stop = (vx * vx) / (2 * a) + 0.03;
      const tgt = Math.abs(d) > stop ? Math.sign(d) * 7.2 : via ? vx : 0;
      vx = vx < tgt ? Math.min(tgt, vx + a * dt) : Math.max(tgt, vx - a * dt);
      if (air) {
        if (!started) { vy = -15.2 * g; started = true; }
        vy += 38 * g * dt; if (tt - late > hold && vy * g < 0) vy += 38 * g * dt * 1.4;
        y += vy * dt;
        if (n > 3 && vy * g > 0 && (g > 0 ? y >= base - 0.6 : y <= base + 0.6) && Math.abs(mv.x - x) < 0.3) { out.push({ t, x, y }); y = base - 0.35 * g * 0; break; }
      }
      x += vx * dt;
      out.push({ t, x, y });
      if (!air && Math.abs(mv.x - x) < 0.1 && Math.abs(vx) < 0.6) break;
    }
  }
  return out;
}
// is that path clear of every saw (with room for late hands: also shifted by up to `late` seconds)?
function clear(b, path, margin = 0.15, late = 0.13, skip = []) {
  const L = b.L();
  for (const pt of path) for (let lag = 0; lag <= late + 1e-9; lag += late / 2 || 1)
    for (let i = 0; i < L.saws.length; i++) {
      if (skip.includes(i)) continue;
      const q = sawAt(b, i, pt.t + lag);
      if (Math.hypot(q.x - pt.x, q.y - pt.y) < L.saws[i].r + 0.3 + margin) return false;
    }
  return true;
}
// every way uneven hands could play the moves: the jump key late, the jump key held a bit longer
function variants(moves) {
  const out = [moves];
  if (moves.some((m) => m.kind === 'jump')) for (const late of [2 / 60, 4 / 60]) for (const extra of [0, 4 / 60])
    out.push(moves.map((m) => (m.kind === 'jump' ? Object.assign({}, m, { late, hold: (m.hold == null ? 9 : m.hold) + extra }) : m)));
  return out;
}
// wait for a moment when the moves are safe, then make them. kind 'walk'/'jump', or a chain via o.then
function* safeGo(b, role, kind, toX, o = {}) {
  const moves = [{ kind, x: toX, hold: o.hold, via: o.via }].concat(o.then || []);
  const ok = () => variants(moves).every((mv) => clear(b, predict(b, role, mv), o.margin, o.late, o.skip)) && (!o.also || o.also());
  yield* b.until(ok, o.maxS || 12, `a safe moment for ${role === E ? 'her' : 'him'} to ${kind} to ${toX}`);
  for (const m of moves) {
    if (m.kind === 'walk') yield* b.walk(role, m.x, 0.1, { noHop: true });
    else yield* b.jump(role, { tx: m.x, hold: m.hold == null ? 9 : m.hold, via: m.via });
  }
}

S['Sawmill'] = function* (b) {
  yield* b.wait(0.3);
  // downstairs: a saw over each pool (blue 6, amber 10, blue 14, amber 18, shadow 22); dry pockets at 8.5 12.5 16.5 20.5 24.5
  yield* b.par(b.walk(E, 4.4), b.walk(T, 3.6));
  const wade = (role, inX, outX) => safeGo(b, role, 'walk', inX, { then: [{ kind: 'jump', x: outX, hold: 0.12 }] });
  yield* safeGo(b, E, 'jump', 8.5);                        // over the blue
  yield* wade(T, 6.6, 8.0);                                // he wades under the saw (gem)
  yield* wade(E, 10.6, 12.6);                              // she wades the amber (gem)
  yield* safeGo(b, T, 'jump', 12.0);                       // he jumps it
  yield* safeGo(b, E, 'jump', 16.6);                       // over the blue
  yield* wade(T, 14.6, 16.0);                              // gem
  yield* wade(E, 18.6, 20.6);                              // gem
  yield* safeGo(b, T, 'jump', 20.0);
  yield* safeGo(b, E, 'jump', 24.6);                       // both over the shadow
  yield* safeGo(b, T, 'jump', 24.0);
  // the plate saw is down a quarter of the time. Right after it goes up: she steps on, he runs under the rising gate
  // onto plate q, she follows before it comes back
  yield* b.until(() => { const a = sawAt(b, 5), c = sawAt(b, 5, 0.05); return c.y < a.y && a.y < 14.4 && a.y > 13.6; }, 10, 'the plate saw goes up');
  yield* b.par((function* () {
    yield* b.walk(E, 26.5);
    yield* b.until(() => b.P(T).x > 28.4, 3, 'he is through');
    yield* b.walk(E, 29.0);                                // off the plate before the saw is back
  })(), (function* () {
    yield* b.until(() => b.L().gates[0].open > 0.3, 2, 'gate lifts');
    yield* b.walk(T, 29.5);
  })());
  // the fan: hold jump, drift left over the slab
  for (const role of [E, T]) {
    yield* b.run(role, 1, (p) => p.x > 30.2);
    yield* b.hold(role, { jump: true }, () => b.P(role).y < 6.2, 5);
    yield* b.jump(role, { tx: 27.4, hold: 0, air: true, until: (p) => p.onGround && p.y < 10 });
  }
  // upstairs: amber 23-25 under a saw, blue 18-20, shadow 11-14 under a bobbing saw
  yield* b.par(b.walk(E, 26.6), b.walk(T, 26.4));
  yield* wade(E, 23.3, 21.8);                              // through the amber (gem), hop out
  yield* safeGo(b, T, 'jump', 21.7);                       // over it
  yield* safeGo(b, E, 'jump', 16.8);                       // over the blue
  yield* safeGo(b, T, 'walk', 18.3, { then: [{ kind: 'jump', x: 16.6, hold: 0.12 }] });   // through the blue (gem)
  yield* b.par(b.walk(E, 15.6), b.walk(T, 15.7));
  yield* safeGo(b, E, 'jump', 10.4);                       // over the shadow, under the bobbing saw
  yield* safeGo(b, T, 'jump', 10.4);
  yield* b.par(b.walk(E, 3.4), b.walk(T, 4.2));
  yield* b.jump(E, {});                                    // secret
  yield* b.par(b.walk(E, 2.5), b.walk(T, 4.5));
};

// how long cell (c, r) of the water stays frozen
const frostLeft = (b, c, r) => (b.L().frozen.get(c + ',' + r) || 0) - b.L().t;

S['Crawlspace'] = function* (b) {
  // he walks the roof (y 14), she crawls the flooded row below. From the roof his frost reaches the cells whose
  // centres are within ~1.67 of him: four cells when he stands on a cell boundary. After every jump he settles on one.
  // a post: [his x, how he gets there, her x after his frost (null: she waits), melt?, via]
  const posts = [
    [5.0, 'walk', 6.0], [7.0, 'walk', 8.0],
    [10.6, 'jump', null, false, 9.5], [11.0, 'walk', 10.6, true], [11.0, 'walk', 12.0],
    [15.0, 'walk', 16.0],
    [17.6, 'jump', null, false, 16.5], [18.0, 'walk', 17.6, true], [18.0, 'walk', 19.0],
    [21.0, 'walk', 22.0],
    [24.4, 'jump', null, false, 22.6], [24.5, 'walk', 25.0],
    [27.0, 'walk', null],
  ];
  yield* b.wait(0.3);
  yield* b.walk(E, 3.4);
  for (const [hx, how, ex, melt, via] of posts) {
    if (Math.abs(b.P(T).x - hx) > 0.08) yield* safeGo(b, T, how, hx, { via });
    yield* act(b, T);                                      // frost
    if (ex == null) continue;
    const ok = () => { for (let c = Math.floor(b.P(E).x - 0.3); c <= Math.floor(ex + 0.3); c++) if (b.L().tiles[16][c] === 'W' && frostLeft(b, c, 16) < 6) return false; return true; };
    yield* b.until(ok, 1, 'frost all the way to her next stop');
    if (melt) {
      yield* b.walk(E, ex, 0.1, { noHop: true });
      yield* b.run(E, 1, () => b.L().tiles[15][Math.ceil(ex)] !== 'I', { noHop: true });   // push into the ice till it melts
    } else yield* b.walk(E, ex, 0.1, { noHop: true });
  }
  yield* b.walk(E, 27.6);                                  // hop out of the tunnel
  yield* b.walk(T, 28.6);                                  // off the roof
  yield* b.until(() => b.P(T).onGround && b.P(T).y > 15, 2, 'he lands');
  yield* b.par(b.walk(E, 29.3), b.walk(T, 29.9));
  yield* b.jump(E, {});                                    // secret
  yield* b.par(b.walk(E, 28.5), b.walk(T, 30.5));
};

// run across a gravity pad and keep running till you land on the far surface
function* flipRun(b, role, dir, landX) {
  const g0 = b.P(role).g;
  yield* b.run(role, dir, (p) => p.g !== g0, { noHop: true });
  yield* b.jump(role, { tx: landX, hold: 0, air: true, until: (p) => p.onGround && p.g !== g0 });
}

S['Gravity Well'] = function* (b) {
  yield* b.wait(0.3);
  // floor -> ceiling, along the ceiling (gems), ceiling pad -> top of platform 1
  yield* b.walk(E, 2.5);
  yield* b.until(() => b.P(E).g < 0 && b.P(E).onGround, 3, 'she is on the ceiling');
  yield* b.walk(T, 2.5);
  yield* b.until(() => b.P(T).g < 0 && b.P(T).onGround, 3, 'he is on the ceiling');
  yield* b.par(b.walk(E, 5.5), b.walk(T, 4.5));
  for (const role of [E, T]) {
    yield* b.walk(role, 8.5);
    yield* b.until(() => b.P(role).g > 0 && b.P(role).onGround, 3, 'down on platform 1');
  }
  yield* b.walk(T, 7.5);                                   // his gem in the blue
  yield* b.walk(T, 8.5);
  // platform 1 -> underside of platform 2: he must land short of the amber at 15 (plate q at 14)
  yield* flipRun(b, E, 1, 16.5);
  yield* flipRun(b, T, 1, 13.6);
  yield* b.walk(T, 13.6);                                  // on plate q: the gate on platform 3 opens
  // she drops to platform 3 (safe strip 19-20), wades the amber, hops under the saw and through the gate onto plate r
  yield* b.walk(E, 16.6);
  yield* flipRun(b, E, 1, 20.0);
  yield* b.walk(E, 20.2);
  yield* b.until(() => b.L().gates[0].open > 0.9, 3, 'gate up');
  yield* b.walk(E, 21.5);                                  // amber (gem)
  yield* b.walk(E, 23.5);                                  // plate r
  // he leaves q, jumps the underside amber (away from the slab, towards the saw), drops onto platform 3
  yield* safeGo(b, T, 'jump', 17.0, { hold: 0.1 });        // short hop: the saw is right there
  yield* b.walk(T, 17.0);
  yield* flipRun(b, T, 1, 19.8);
  yield* b.walk(T, 20.3);
  yield* b.until(() => b.L().gates[0].open > 0.9, 3, 'gate up');
  yield* b.jump(T, { tx: 23.3 });                          // over the amber, through the gate
  yield* b.walk(T, 23.5);
  // platform 3 -> underside of platform 4 -> floor
  for (const role of [T, E]) {
    yield* b.walk(role, 23.6);
    yield* flipRun(b, role, 1, 28.4);
  }
  yield* b.walk(T, 28.5);                                  // his gem under platform 4
  for (const role of [T, E]) {
    yield* b.walk(role, 29.5);
    yield* b.until(() => b.P(role).g > 0 && b.P(role).onGround, 3, 'down by the doors');
  }
  yield* b.par(b.walk(E, 29.3), b.walk(T, 30.0));
  yield* b.jump(E, {});                                    // secret
  yield* b.par(b.walk(E, 28.5), b.walk(T, 30.5));
};

// push crate i to the right until its left edge reaches x, waiting first until the pusher's slow walk behind it
// will stay clear of the saws (crates move at 3.4)
function* pushSafe(b, role, i, x) {
  const p = b.P(role), cr = crate(b, i), cy = p.y - 0.46;
  // pushing really goes at ~2.7 (contact comes and goes); check a slow and a quick version
  const path = (v) => { const out = [], x0 = cr.x - 0.3; for (let t = 0; t <= (x - cr.x) / v + 0.3; t += 1 / 30) out.push({ t, x: Math.min(x0 + v * t, x - 0.3), y: cy }); return out; };
  yield* b.until(() => clear(b, path(2.3), 0.2, 0.13) && clear(b, path(3.2), 0.2, 0.13), 15, 'a safe moment to push');
  yield* pushTo(b, role, i, x);
}

S['Parcel'] = function* (b) {
  yield* b.wait(0.3);
  yield* b.walk(T, 6.5);                                   // his gem
  yield* b.walk(T, 10.5);                                  // plate q: the canal gate opens
  yield* b.walk(E, 3.3);
  yield* pushTo(b, E, 0, 6.2);                             // into the amber
  yield* pushSafe(b, E, 0, 10.0);                          // under the first saw (gem)
  yield* b.until(() => b.L().gates[0].open > 0.9, 3, 'canal gate');
  yield* pushSafe(b, E, 0, 15.95);                         // through the gate, under the second saw, onto the lift
  yield* b.walk(E, 15.6, 0.1, { noHop: true });
  yield* act(b, E);                                        // lever k: up it goes, with her
  yield* b.walk(T, 14.6);
  yield* b.until(() => mover(b, 0).t >= 1, 4, 'lift up');
  yield* b.walk(E, 15.3, 0.1, { noHop: true });
  yield* b.walk(T, 15.7, 0.1, { noHop: true });             // steps down onto the lift behind the crate
  yield* pushSafe(b, T, 0, 19.0);
  yield* pushSafe(b, T, 0, 22.0);
  yield* pushSafe(b, T, 0, 26.1);                          // off the end: onto plate p below
  yield* b.until(() => crate(b, 0).y > 14.5, 3, 'the crate lands');
  // back along the canal, frosting a road for her
  yield* safeGo(b, T, 'walk', 22.5);
  yield* act(b, T);
  yield* safeGo(b, T, 'walk', 18.5);
  yield* act(b, T);
  yield* b.walk(T, 17.6);
  yield* safeGo(b, E, 'walk', 25.6);                       // over the frozen canal (gem)
  yield* b.walk(E, 27.0);                                  // and down
  yield* b.until(() => b.P(E).onGround && b.P(E).y > 14.5, 3, 'she lands');
  yield* safeGo(b, T, 'walk', 25.6);
  yield* b.walk(T, 27.3);
  yield* b.until(() => b.P(T).onGround && b.P(T).y > 14.5, 3, 'he lands');
  yield* b.until(() => b.L().gates[1].open > 0.9, 3, 'exit gate');
  yield* b.par(b.walk(E, 28.4), b.walk(T, 27.6));
  yield* b.jump(E, {});                                    // secret
  yield* b.par(b.walk(E, 29.5), b.walk(T, 30.5));
};

// ---------------------------------------------------------------- pistons
// is the player standing on mover i?
const onMover = (b, role, i) => { const p = b.P(role), m = moverAt(b, i); return p.onGround && Math.abs(p.y - m.y) < 0.1 && p.x > m.x - 0.2 && p.x < m.x + m.w + 0.2; };
// hop from where you stand onto auto mover i: wait until a jump now would come down on its top, clear of saws
function* hop(b, role, i, o = {}) {
  const lands = (moves) => {
    const m = moverAt(b, i), tx = m.x + m.w / 2;
    const path = predict(b, role, moves);
    // find the moment the falling arc meets the piston top
    // the falling feet cross the piston top (feet above it one frame, at or below it the next)
    for (let k = 4; k < path.length; k++) {
      const pt = path[k], prev = path[k - 1];
      if (pt.y <= prev.y) continue;                        // still rising
      const top0 = moverAt(b, i, prev.t).y, top1 = moverAt(b, i, pt.t).y;
      if (prev.y + 0.46 <= top0 + 0.02 && pt.y + 0.46 >= top1 - 0.02) {
        if (Math.abs(pt.x - tx) > 0.45) return false;
        // until then the body must never be beside or under the piston (it would hit its side and slide off)
        for (let j = 0; j < k; j++) {
          const q = path[j], r = moverAt(b, i, q.t);
          if (q.x + 0.28 > r.x - 0.1 && q.x - 0.28 < r.x + r.w + 0.1 && q.y + 0.46 > r.y - 0.05) return false;
        }
        return clear(b, path.slice(0, k + 1), 0.15, 0.13);
      }
    }
    return false;
  };
  const ok = () => { const m = moverAt(b, i); return variants([{ kind: 'jump', x: m.x + m.w / 2, hold: o.hold }]).every(lands); };
  yield* b.until(ok, o.maxS || 15, `${role === E ? 'her' : 'his'} hop onto piston ${i}`);
  const m0 = moverAt(b, i);
  yield* b.jump(role, { tx: m0.x + m0.w / 2, hold: o.hold == null ? 9 : o.hold, until: (p, t) => t > 0.1 && p.onGround });
  if (!onMover(b, role, i)) throw new Error(`${role} missed piston ${i}`);
}
// stand on mover i and keep to its middle until cond()
function* stay(b, role, i, cond, maxS = 10) {
  for (const t0 = b.L().t; b.L().t - t0 < maxS;) {
    if (cond()) return;
    const m = moverAt(b, i), d = m.x + m.w / 2 - b.P(role).x;
    yield { [role]: Math.abs(d) > 0.3 ? (d > 0 ? { right: true } : { left: true }) : {} };
  }
}

S['Pistons'] = function* (b) {
  yield* b.wait(0.3);
  // amber 4-7: she wades (gem), he jumps under the saw's reach
  yield* b.walk(E, 5.5);
  yield* b.walk(T, 3.5);
  yield* safeGo(b, T, 'jump', 8.8);
  yield* safeGo(b, E, 'jump', 9.0, { hold: 0.12 });        // hop out of the amber
  // the first shadow pit: island 8-9, pistons 0 and 1, island 16-17
  for (const role of [T, E]) {
    yield* b.walk(role, 9.4);
    yield* hop(b, role, 0);
    if (role === E) yield* stay(b, role, 0, () => moverAt(b, 0).y < 12.9);   // her gem at the top
    yield* hop(b, role, 1);
    if (role === T) yield* stay(b, role, 1, () => moverAt(b, 1).y < 11.9);   // his gem at the top
    yield* safeGo(b, role, 'jump', 16.8);
  }
  // blue 18-21: he wades (gem), she jumps
  yield* b.walk(T, 19.5);
  yield* safeGo(b, T, 'jump', 22.6, { hold: 0.12 });
  yield* b.walk(E, 17.4);
  yield* safeGo(b, E, 'jump', 22.4);
  // the last pit: island 22-23, pistons 2 and 3, the door ledge
  for (const role of [T, E]) {
    yield* b.walk(role, 23.4);
    yield* hop(b, role, 2);
    if (role === T) yield* stay(b, role, 2, () => moverAt(b, 2).y < 12.9);
    yield* hop(b, role, 3);
    if (role === E) yield* stay(b, role, 3, () => moverAt(b, 3).y < 12.2);
    yield* safeGo(b, role, 'jump', role === E ? 29.4 : 30.2);
  }
  yield* b.par(b.walk(E, 29.3), b.walk(T, 30.0));
  yield* b.jump(E, {});                                    // secret
  yield* b.par(b.walk(E, 29.5), b.walk(T, 30.5));
};

S['Both of Us'] = function* (b) {
  yield* b.wait(0.2);
  // 1. frost a road over the blue, he is the ladder, her lever brings his lift
  yield* use(b, T, 5.5);
  yield* b.walk(T, 7.6);
  yield* act(b, T);
  yield* b.walk(E, 7.5);                                   // over the frost (gem)
  yield* b.par(b.walk(E, 11.4), b.walk(T, 11.4));
  yield* boost(b, { tx: 13.5 });
  yield* act(b, E);                                        // lever k
  yield* b.until(() => mover(b, 0).t >= 1, 4, 'lift up');
  // 2. pools under saws on the ledge: amber 15-17, blue 20-22
  yield* b.walk(T, 14.4);
  yield* safeGo(b, T, 'jump', 18.6);                       // over the amber
  yield* safeGo(b, E, 'walk', 17.5, { then: [{ kind: 'jump', x: 18.6, hold: 0.12 }] });   // she wades it (gem)
  yield* safeGo(b, E, 'jump', 23.5);                       // over the blue
  yield* safeGo(b, T, 'walk', 22.5, { then: [{ kind: 'jump', x: 23.6, hold: 0.12 }] });   // he wades it (gem)
  // 3. the ring takes you up
  for (const role of [E, T]) {
    yield* b.race(b.until(() => b.P(role).y < 7, 6, 'through the ring'), b.walk(role, 27.5));
    yield* b.until(() => b.P(role).onGround, 2, 'lands upstairs');
    yield* b.walk(role, role === E ? 1.6 : 2.4);           // out of the ring's reach
  }
  // 4. up to the ceiling, along it past the drips, down onto the far side of the slab
  for (const role of [E, T]) {
    yield* b.walk(role, 4.5);
    yield* b.until(() => b.P(role).g < 0 && b.P(role).onGround, 3, 'on the ceiling');
  }
  yield* b.walk(E, 10.5);                                  // under the amber drip (gem); the blue one next
  yield* b.walk(T, 8.4);
  yield* b.jump(T, { tx: 10.5 });                          // past the amber drip
  yield* b.walk(T, 12.5);                                  // under the blue one (gem)
  yield* b.jump(E, { tx: 12.6 });                          // she jumps the blue
  for (const role of [E, T]) {
    yield* b.walk(role, 15.5);
    yield* b.until(() => b.P(role).g > 0 && b.P(role).onGround, 3, 'down on the slab');
    yield* b.walk(role, role === E ? 16.4 : 17.0);
  }
  yield* b.par(b.walk(E, 19.0), b.walk(T, 19.9));
  yield* b.jump(E, {});                                    // secret
  yield* b.par(b.walk(E, 18.5), b.walk(T, 20.5));
};

module.exports = S;
