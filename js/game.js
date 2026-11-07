(() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const { SEG, ROAD } = Tracks;
  const mod = (a, b) => ((a % b) + b) % b;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const FONT = '"Press Start 2P", monospace';

  // ---------- Настройки ----------
  const RH = 240;                 // внутреннее разрешение по вертикали (как на PS1)
  const DRAW = 200;
  const FOG_DENSITY = 4.2;
  const MAX = SEG * 60;
  const ACCEL = MAX / 4.5, BRAKE = -MAX * 1.1, DECEL = -MAX / 5;
  const OFF_DECEL = -MAX / 1.6, OFF_LIMIT = MAX / 4;
  const CENTRIFUGAL = 0.3;
  const KART_W = 720;
  const KART_U = (KART_W / ROAD) * 0.75;
  const NITRO_MS = 2200, NITRO_MAX = 3, NITRO_RESPAWN = 12000;

  const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };
  let myName = store.get('name', '');
  let myChar = store.get('char', Chars.LIST[0].id);
  if (!Chars.LIST.some((c) => c.id === myChar)) myChar = Chars.LIST[0].id;
  let trackId = store.get('track', Tracks.list[0].id);
  if (!Tracks.list.some((t) => t.id === trackId)) trackId = Tracks.list[0].id;
  let diff = store.get('diff', 'easy') === 'hard' ? 'hard' : 'easy';
  let T = Tracks.get(trackId, diff);

  // ---------- Состояние ----------
  let mode = 'menu';
  let online = false, isHost = false, laps = 3;
  let countdownEnd = 0, raceStart = 0, lapStart = 0, lapTimes = [];
  let skyOff = 0, shake = 0, flash = 0, fovK = 0, camXw = 0, banner = null;
  const pickedN = {};

  const newCar = () => ({ total: 0, x: 0, speed: 0, steer: 0, boostUntil: 0, hitUntil: 0, nitro: 0,
    finished: false, finishTime: 0, emo: null, name: '', char: 'bunny' });
  const me = newCar();
  const other = Object.assign(newCar(), { present: false, snaps: [], boost: false, hit: false });
  let particles = [];

  function placeOnGrid(car, slot) {
    car.total = 0; car.x = slot === 0 ? -0.45 : 0.45;
    car.speed = 0; car.steer = 0; car.boostUntil = 0; car.hitUntil = 0; car.nitro = 0; car.air = 0; car.airH = 0; car.spinUntil = 0; car.sv = 0; car.yaw = 0; car.drift = 0; car.driftT = 0;
    car.finished = false; car.finishTime = 0;
  }

  // ---------- Ввод ----------
  const keys = {};
  const touch = { up: false, down: false, left: false, right: false, drift: false };
  const typing = () => ['INPUT', 'SELECT'].includes(document.activeElement && document.activeElement.tagName);
  addEventListener('keydown', (e) => {
    if (typing()) return;
    if (!keys[e.code] && ['ShiftLeft', 'ShiftRight', 'KeyE', 'KeyN'].includes(e.code)) useNitro(performance.now());
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    const emo = { Digit1: '❤️', Digit2: '😘', Digit3: '😂', Digit4: '😤' }[e.code];
    if (emo && inGame()) sendEmote(emo);
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const input = () => ({
    up: keys.ArrowUp || keys.KeyW || touch.up,
    down: keys.ArrowDown || keys.KeyS || touch.down,
    left: keys.ArrowLeft || keys.KeyA || touch.left,
    right: keys.ArrowRight || keys.KeyD || touch.right,
    drift: keys.Space || keys.KeyZ || touch.drift,
  });
  function bindTouch(id, key) {
    const el = $(id);
    const on = (e) => { e.preventDefault(); touch[key] = true; el.classList.add('on'); };
    const off = (e) => { e.preventDefault(); touch[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on);
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, off);
  }
  bindTouch('tGas', 'up'); bindTouch('tBrake', 'down'); bindTouch('tLeft', 'left'); bindTouch('tRight', 'right'); bindTouch('tDrift', 'drift');
  $('tNitro').addEventListener('pointerdown', (e) => { e.preventDefault(); useNitro(performance.now()); });
  const isTouch = matchMedia('(pointer: coarse)').matches;
  document.querySelectorAll('#emotes button').forEach((b) => b.addEventListener('click', () => sendEmote(b.dataset.emo)));
  function sendEmote(e) {
    me.emo = { e, until: performance.now() + 2200 };
    if (online) Net.send({ t: 'emo', e });
  }
  const inGame = () => mode !== 'menu' && mode !== 'lobby';

  // ---------- Частицы (пыль, дым, искры нитро) ----------
  function spawn(z, x, opts) {
    if (particles.length > 260) return;
    particles.push(Object.assign({ z, x, y: 30, vz: 0, vx: 0, vy: 160, size: 140, grow: 260, life: 0.7, max: 0.7, a: 0.6, color: '#c8b8a0' }, opts));
  }
  function emitFor(car, dt, now, isMe) {
    const sp = (car.speed || 0) / MAX;
    const off = Math.abs(car.x) > 1;
    const boost = isMe ? now < car.boostUntil : car.boost;
    const rate = dt * 60;
    for (const s of [-1, 1]) {
      const wx = car.x + s * 0.13;
      if (off && sp > 0.08 && Math.random() < 0.7 * rate) {
        spawn(car.total - 60, wx, { vz: car.speed * 0.55, vx: s * 0.25 * Math.random(), vy: 220 + Math.random() * 200, size: 120 + sp * 160, grow: 420, life: 0.8, max: 0.8, a: 0.55, color: Art.shade(T.def.ground, -0.15) });
      } else if (sp > 0.5 && Math.random() < 0.08 * rate) {
        spawn(car.total - 60, wx, { vz: car.speed * 0.7, vy: 90, size: 70, grow: 160, life: 0.5, max: 0.5, a: 0.25, color: Art.shade(T.def.road, 0.35) });
      }
      if (boost && Math.random() < 0.9 * rate) {
        spawn(car.total - 20, car.x + s * 0.055, { y: 70, vz: car.speed * 0.6, vx: (Math.random() - 0.5) * 0.3, vy: 40 + Math.random() * 60, size: 60, grow: -40, life: 0.28, max: 0.28, a: 0.95, color: Math.random() < 0.5 ? '#7cc4ff' : '#e4f4ff', add: true });
      }
    }
    if (car.drift && sp > 0.3 && Math.random() < 0.5 * rate) {
      spawn(car.total - 50, car.x + (Math.random() - 0.5) * 0.3, { vz: car.speed * 0.6, vy: 120, size: 90, grow: 260, life: 0.6, max: 0.6, a: 0.35, color: '#d8d8e0' });
    }
    if ((isMe ? now < car.hitUntil : car.hit) && Math.random() < 0.5 * rate) {
      spawn(car.total - 30, car.x + (Math.random() - 0.5) * 0.3, { y: 120, vz: car.speed * 0.5, vy: 160, size: 120, grow: 300, life: 0.9, max: 0.9, a: 0.5, color: '#9a9aa2' });
    }
  }
  function sparkBurst(z, x, color, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      spawn(z, x, { y: 240, vz: me.speed * 0.85 + Math.cos(a) * 900, vx: Math.sin(a) * 0.9, vy: 300 + Math.random() * 500, size: 50, grow: -30, life: 0.5, max: 0.5, a: 1, color, add: true });
    }
  }
  function stepParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.z += p.vz * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.size = Math.max(4, p.size + p.grow * dt);
      p.vz *= Math.exp(-1.2 * dt);
    }
  }

  // ---------- Симуляция ----------
  const overlap = (x1, w1, x2, w2) => Math.abs(x1 - x2) < (w1 + w2) / 2;

  function crash(now, strength) {
    me.speed = Math.min(me.speed, MAX * strength);
    me.hitUntil = now + 650;
    shake = 0.4;
  }

  function useNitro(now) {
    if (mode !== 'race' || me.nitro <= 0 || now < me.boostUntil) return;
    me.nitro--;
    me.boostUntil = now + NITRO_MS;
    flash = 0.5; shake = Math.max(shake, 0.15);
    sparkBurst(me.total + 120, me.x, '#9fd6ff', 14);
    updateNitroBtn();
  }
  function updateNitroBtn() {
    const b = $('tNitro');
    b.textContent = 'N×' + me.nitro;
    b.disabled = me.nitro <= 0;
  }

  // позиция объекта поперёк дороги (движущиеся препятствия ездят по общему времени гонки)
  const raceClock = (now) => (mode === 'race' || mode === 'done' ? now - raceStart : now);
  function spriteO(s, now) {
    return s.move ? s.move.amp * Math.sin((raceClock(now) / s.move.per) * Math.PI * 2 + s.move.ph) : s.o;
  }
  const AIR_H = 750;

  function stepMe(dt, now) {
    const seg = T.findSeg(me.total);
    const zone = seg.zone;
    const sp = me.speed / MAX;
    let inp;
    if (mode === 'race') inp = input();
    else if (mode === 'done') inp = { up: me.speed < MAX * 0.45, down: false, left: me.x > 0.1, right: me.x < -0.1 };
    else inp = { up: false, down: false, left: false, right: false };

    const hitNow = now < me.hitUntil;
    const spinning = now < (me.spinUntil || 0);
    const air = me.air > 0;

    // прыжок
    if (air) {
      me.air -= dt;
      const t = 1 - Math.max(0, me.air) / me.airMax;
      me.airH = 4 * AIR_H * me.airMax * t * (1 - t);
      if (me.air <= 0) {
        me.air = 0; me.airH = 0; shake = Math.max(shake, 0.25);
        for (let i = 0; i < 10; i++) spawn(me.total - 40, me.x + (Math.random() - 0.5) * 0.4, { vz: me.speed * 0.6, vx: (Math.random() - 0.5) * 0.8, vy: 200, size: 140, grow: 380, life: 0.7, max: 0.7, a: 0.5, color: Art.shade(T.def.ground, -0.1) });
      }
    }

    const wm = lerp(seg.p1.wm || 1, seg.p2.wm || 1, mod(me.total, SEG) / SEG);
    const steerIn = inp.left ? -1 : inp.right ? 1 : 0;
    me.steer = steerIn;
    const grip = Math.min(1, sp * 1.2 + 0.1);
    // drift: hold DRIFT + steer at speed -> small hop, then slide; longer drift = bigger mini-turbo
    if (mode === 'race' && !me.drift && inp.drift && steerIn && sp > 0.35 && !air && !spinning) {
      me.drift = steerIn; me.driftT = 0; me.airMax = me.air = 0.16;
    }
    if (me.drift && (!inp.drift || sp < 0.25 || spinning || hitNow)) {
      if (!spinning && !hitNow && me.driftT > 1.5) { me.boostUntil = Math.max(me.boostUntil, now + 1100); flash = Math.max(flash, 0.3); showBanner('SUPER TURBO!', '#ff9a2a', 700); }
      else if (!spinning && !hitNow && me.driftT > 0.7) { me.boostUntil = Math.max(me.boostUntil, now + 600); flash = Math.max(flash, 0.2); showBanner('TURBO!', '#7cc4ff', 600); }
      me.drift = 0; me.driftT = 0;
    }
    // yaw = how much the kart is turned; it builds up over ~0.3s instead of snapping
    let target, rate;
    if (spinning) { target = Math.sin(now / 90); rate = 12; me.x += Math.sin(now / 70) * dt * 0.9; }
    else if (me.drift) { me.driftT += dt; target = me.drift * (0.8 + 0.3 * steerIn * me.drift); rate = 6; }
    else { target = hitNow ? 0 : steerIn * 0.9; rate = zone === 'ice' ? 1.4 : Math.abs(target) > Math.abs(me.yaw || 0) ? 2.6 : 4.5; }
    me.yaw = lerp(me.yaw || 0, target, 1 - Math.exp(-rate * dt));
    if (!air) {
      // sideways movement follows the kart's heading, scaled by speed
      const latTarget = me.drift ? (me.yaw * 0.75 + me.drift * 0.15) * grip : me.yaw * 2.2 * grip;
      me.sv = zone === 'ice' ? lerp(me.sv || 0, latTarget, 1 - Math.exp(-1.5 * dt)) : latTarget;
      me.x += me.sv * dt;
      me.x -= dt * 2.1 * grip * sp * seg.curve * CENTRIFUGAL * (zone === 'ice' ? 1.8 : me.drift ? 0.55 : 1);
      if (me.drift) me.speed *= 1 - 0.12 * dt;
    }

    const boosting = now < me.boostUntil;
    const maxS = MAX * (boosting ? 1.4 : 1);
    if (mode === 'race' || mode === 'done') {
      if (inp.up && !air) me.speed += ACCEL * (boosting ? 2.5 : 1) * dt;
      else if (inp.down && !air) me.speed += BRAKE * dt;
      else if (!air) me.speed += DECEL * dt;
      if (boosting && !inp.down) me.speed += ACCEL * 1.5 * dt;
    } else me.speed = 0;

    if (!air && zone !== 'tunnel' && zone !== 'bridge' && Math.abs(me.x) > wm && me.speed > OFF_LIMIT && !boosting) me.speed += OFF_DECEL * dt;
    if (me.speed > maxS) me.speed += (maxS - me.speed) * Math.min(1, 1.5 * dt);
    me.speed = clamp(me.speed, 0, MAX * 1.4);
    me.x = clamp(me.x, -2.6, 2.6);

    // стены туннеля
    if (zone === 'tunnel' && Math.abs(me.x) > 0.98 * wm) {
      me.x = Math.sign(me.x) * 0.98 * wm;
      me.speed *= 1 - 2.5 * dt;
      shake = Math.max(shake, 0.12);
      if (Math.random() < 0.5) spawn(me.total, me.x, { y: 120, vz: me.speed * 0.7, vx: -Math.sign(me.x) * 0.5, vy: 200, size: 40, grow: -20, life: 0.3, max: 0.3, a: 1, color: '#ffd27a', add: true });
    }
    // fell off the edge: water under a bridge, lava, or the sky road
    const deadly = zone === 'bridge' || zone === 'lava' || (T.def.fallOff && zone !== 'tunnel');
    if (mode === 'race' && deadly && !air && Math.abs(me.x) > 1.08 * wm) {
      const fx = zone === 'lava' ? ['#ffb040', '#ff5a1a', 'TOO HOT!'] : zone === 'bridge' ? ['#ffffff', '#8fd0ff', 'SPLASH!'] : ['#ffffff', '#dfe8ff', 'FELL OFF!'];
      for (let i = 0; i < 24; i++) spawn(me.total, me.x + (Math.random() - 0.5) * 0.4, { y: 0, vz: me.speed * 0.3, vx: (Math.random() - 0.5) * 1.2, vy: 500 + Math.random() * 700, size: 90, grow: 120, life: 0.9, max: 0.9, a: 0.9, color: fx[Math.random() < 0.5 ? 0 : 1], add: zone === 'lava' });
      me.x = 0; me.speed *= 0.3; me.hitUntil = now + 900; me.drift = 0; shake = 0.4;
      showBanner(fx[2], fx[1], 1000);
    }

    if (mode === 'race' && !air) {
      for (const s of [seg, T.findSeg(me.total + SEG)]) for (const sp2 of s.sprites) {
        const d = sp2.def, o = spriteO(sp2, now);
        if (sp2.nitro != null) {
          if ((pickedN[sp2.nitro] || 0) > now || me.nitro >= NITRO_MAX) continue;
          if (overlap(me.x, KART_U, o, (d.w / ROAD) * 0.9)) {
            pickedN[sp2.nitro] = now + NITRO_RESPAWN;
            me.nitro++;
            updateNitroBtn();
            sparkBurst(me.total + 300, o, '#bfe4ff');
            showBanner('+NITRO', '#7cc4ff', 900);
          }
          continue;
        }
        if (d.pad) {
          if (overlap(me.x, KART_U, o, d.w / ROAD) && now > (me.padAt || 0) + 600) {
            me.padAt = now; me.boostUntil = Math.max(me.boostUntil, now + 900); flash = Math.max(flash, 0.2);
          }
          continue;
        }
        if (d.slip) {
          if (!spinning && overlap(me.x, KART_U, o, (d.w / ROAD) * 0.8)) {
            me.spinUntil = now + 950; me.speed *= 0.72; shake = Math.max(shake, 0.2);
            showBanner('SPIN OUT!', d === Art.S.oil ? '#c8a8ff' : '#d9a066', 800);
          }
          continue;
        }
        if (d.ramp) {
          if (overlap(me.x, KART_U, o, (d.w / ROAD) * 0.9) && me.speed > MAX * 0.25) {
            me.airMax = me.air = 0.45 + 0.55 * (me.speed / MAX);
            showBanner('JUMP!', '#ffd84a', 700);
          }
          continue;
        }
        if (!d.hit || hitNow) continue;
        if (overlap(me.x, KART_U, o, (d.w / ROAD) * d.hit)) {
          crash(now, sp2.move ? 0.25 : d === Art.S.barrels ? 0.3 : 0.12);
          me.x += me.x < o ? -0.1 : 0.1;
          me.total -= SEG * 0.5;
        }
      }
      collideWithOther(now);
    }

    me.total += me.speed * dt;

    if (mode === 'race') {
      const lap = Math.floor((me.total - T.START_Z) / T.LENGTH);
      if (lap > lapTimes.length && lap >= 1) {
        lapTimes.push(now - lapStart); lapStart = now;
        if (lap < laps) showBanner(lap === laps - 1 ? 'FINAL LAP' : 'LAP ' + (lap + 1), '#ffd84a', 1600);
      }
      if (me.total - T.START_Z >= laps * T.LENGTH) finish(now);
    }
  }

  function collideWithOther(now) {
    if (!online || !other.present || (other.airH || 0) > 150) return;
    const dz = other.total - me.total;
    if (Math.abs(dz) < 330 && Math.abs(other.x - me.x) < KART_U * 1.1) {
      const push = (KART_U * 1.1 - Math.abs(other.x - me.x)) * 0.6;
      me.x += me.x <= other.x ? -push : push;
      if (dz > 0 && me.speed > other.speed) { me.speed = other.speed * 0.92; me.hitUntil = Math.max(me.hitUntil, now + 300); }
      shake = Math.max(shake, 0.2);
    }
  }

  function updateRemote(now) {
    const s = other.snaps;
    if (!s.length) return;
    const rt = now - 110;
    while (s.length > 2 && s[1].t <= rt) s.shift();
    const a = s[0], b = s[1];
    let cur;
    if (b && a.t <= rt && rt <= b.t) {
      const k = (rt - a.t) / (b.t - a.t || 1);
      other.total = lerp(a.tot, b.tot, k);
      other.x = lerp(a.x, b.x, k);
      other.airH = lerp(a.j, b.j, k);
      cur = k < 0.5 ? a : b;
    } else {
      cur = s[s.length - 1];
      other.total = cur.tot + cur.sp * (clamp(rt - cur.t, 0, 250) / 1000);
      other.x = cur.x; other.airH = cur.j;
    }
    other.speed = cur.sp; other.yaw = cur.st; other.drift = Math.sign(cur.d); other.driftT = [0, 0.4, 1, 2][Math.abs(cur.d)] || 0; other.boost = cur.b; other.hit = cur.h;
  }

  // ---------- Сеть ----------
  let lastSend = 0;
  Net.on('connected', () => {
    online = true;
    Net.send({ t: 'hello', name: myName, char: myChar });
    if (isHost) Net.send({ t: 'room', track: trackId, laps, diff });
    Net.send({ t: 'where', v: mode === 'lobby' ? 'lobby' : 'race' });
    toast('Connected ♥');
  });
  Net.on('message', (m) => {
    const now = performance.now();
    switch (m.t) {
      case 'hello':
        other.name = String(m.name || 'Guest').slice(0, 14);
        other.char = Chars.LIST.some((c) => c.id === m.char) ? m.char : Chars.LIST[1].id;
        other.present = true;
        renderLobby();
        break;
      case 'room': setDiff(m.diff, false); setTrack(m.track, false); setLaps(m.laps); renderLobby(); break;
      case 'diff': setDiff(m.v, false); resetReady(); break;
      case 'track': setTrack(m.id, false); trackBy = other.name; resetReady(); break;
      case 'laps': setLaps(m.n); resetReady(); break;
      case 'char':
        if (Chars.LIST.some((c) => c.id === m.id)) other.char = m.id;
        resetReady(); break;
      case 'ready': other.ready = !!m.v; renderLobby(); checkStart(); break;
      case 'where': other.where = m.v; if (m.v !== 'lobby') other.ready = false; renderLobby(); checkStart(); break;
      case 'go': setLaps(m.laps || 3); setDiff(m.diff, false); setTrack(m.track || trackId, false); other.where = 'race'; startCountdown(); break;
      case 's':
        other.snaps.push({ t: now, tot: m.tot, x: m.x, sp: m.sp, st: m.st, d: m.d || 0, b: m.b, h: m.h, j: m.j || 0 });
        if (other.snaps.length > 40) other.snaps.shift();
        break;
      case 'fin':
        other.finished = true; other.finishTime = m.time;
        if (mode === 'race') toast(other.name + ' has finished!');
        if (mode === 'done') renderResult();
        break;
      case 'emo': other.emo = { e: m.e, until: now + 2200 }; break;
      case 'full': toast('The room is full 😅'); goMenu(); break;
    }
  });
  Net.on('closed', () => { if (mode !== 'menu') { toast('Connection lost 💔'); goMenu(); } });
  Net.on('error', (e) => {
    const msg = {
      'peer-unavailable': 'Room not found. Check the code or ask for a new link.',
      'network': 'No connection to the server. Check your internet.',
      'server-error': 'Connection server is unavailable, try again.',
      'browser-incompatible': 'This browser does not support WebRTC.',
    }[e && e.type] || ('Connection error: ' + ((e && (e.type || e.message)) || e));
    toast(msg);
    if (mode === 'lobby' && !Net.connected()) goMenu();
  });

  // ---------- Интерфейс ----------
  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  let toastTimer = 0;
  function toast(text) {
    $('toast').textContent = text; show('toast', true);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => show('toast', false), 3200);
  }
  function showBanner(text, color, ms) { banner = { text, color, t0: performance.now(), ms }; }

  // портреты в меню — уменьшаем и растягиваем пиксельно (ретро-вид)
  const lowres = (src, w) => {
    const h = Math.round((w * src.height) / src.width);
    return Art.mk(w, h, (g) => { g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h); }).toDataURL();
  };
  const portraitURL = {};
  const portraitSrc = (id) => portraitURL[id] || (portraitURL[id] = Chars.stand(id) ? lowres(Chars.stand(id), 90) : '');

  const nameInput = $('nameInput');
  nameInput.value = myName;
  nameInput.addEventListener('input', () => { myName = nameInput.value.trim(); store.set('name', myName); });

  function renderChars() {
    const box = $('chars');
    box.innerHTML = '';
    for (const c of Chars.LIST) {
      const b = document.createElement('button');
      b.className = 'char' + (c.id === myChar ? ' sel' : '');
      b.innerHTML = '<img alt=""><span></span>';
      b.querySelector('img').src = portraitSrc(c.id);
      b.querySelector('span').textContent = c.name;
      b.onclick = () => { myChar = c.id; store.set('char', c.id); renderChars(); };
      box.appendChild(b);
    }
  }
  // превью трасс
  const thumbURL = {};
  function thumb(id) {
    if (thumbURL[id]) return thumbURL[id];
    const tr = Tracks.get(id), d = tr.def;
    return (thumbURL[id] = Art.mk(96, 54, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 30);
      gr.addColorStop(0, d.sky[0]); gr.addColorStop(0.6, d.sky[1]); gr.addColorStop(1, d.sky[2]);
      g.fillStyle = gr; g.fillRect(0, 0, 96, 30);
      g.drawImage(tr.farImg, 0, 0, 300, Tracks.PH, 0, 6, 96, 24);
      g.drawImage(tr.nearImg, 200, 0, 300, Tracks.PH, 0, 14, 96, 17);
      g.fillStyle = d.ground; g.fillRect(0, 30, 96, 24);
      g.fillStyle = d.road; g.beginPath(); g.moveTo(44, 30); g.lineTo(52, 30); g.lineTo(80, 54); g.lineTo(16, 54); g.fill();
      g.fillStyle = d.rumble[0]; g.fillRect(14, 50, 4, 4); g.fillRect(78, 50, 4, 4);
    }).toDataURL());
  }
  function renderTracks() {
    for (const boxId of ['tracks', 'lobbyTracks']) {
      const box = $(boxId);
      box.innerHTML = '';
      for (const t of Tracks.list) {
        const b = document.createElement('button');
        b.className = 'trk' + (t.id === trackId ? ' sel' : '');
        b.innerHTML = '<img alt=""><span></span>';
        b.querySelector('img').src = thumb(t.id);
        b.querySelector('span').textContent = t.name;
        b.onclick = () => {
          if (t.id === trackId) return;
          setTrack(t.id, true);
          if (boxId === 'lobbyTracks') { trackBy = me.name; if (online) Net.send({ t: 'track', id: t.id }); resetReady(); }
        };
        box.appendChild(b);
      }
    }
  }
  function renderDiffs() {
    for (const boxId of ['diffs', 'lobbyDiffs']) {
      const box = $(boxId);
      box.innerHTML = '';
      for (const [v, label, note] of [['easy', 'EASY', 'relaxed ride'], ['hard', 'HARD', 'more obstacles, narrow roads']]) {
        const b = document.createElement('button');
        b.className = 'diff ' + v + (v === diff ? ' sel' : '');
        b.innerHTML = '<b></b><small></small>';
        b.querySelector('b').textContent = label;
        b.querySelector('small').textContent = note;
        b.onclick = () => {
          if (v === diff) return;
          setDiff(v, true);
          if (boxId === 'lobbyDiffs') { if (online) Net.send({ t: 'diff', v }); resetReady(); }
        };
        box.appendChild(b);
      }
    }
  }
  function setDiff(v, save) {
    diff = v === 'hard' ? 'hard' : 'easy';
    if (save) store.set('diff', diff);
    T = Tracks.get(trackId, diff);
    renderDiffs();
  }
  renderDiffs();

  function setTrack(id, save) {
    if (!Tracks.list.some((t) => t.id === id)) return;
    trackId = id; T = Tracks.get(id, diff);
    if (save) store.set('track', id);
    renderTracks();
  }
  renderTracks();

  function ensureName() {
    if (!myName) myName = Chars.byId(myChar).name;
    me.name = myName; me.char = myChar;
  }

  const params = new URLSearchParams(location.search);
  const inviteCode = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (inviteCode) { show('joinBlock', true); show('hostBlock', false); show('trackBlock', false); $('inviteCode').textContent = inviteCode; }

  const peerReady = () => { if (typeof Peer === 'undefined') { toast('Network library failed to load. Reload the page.'); return false; } return true; };

  function joinRoom(code) {
    if (!code) return toast('Enter a room code');
    if (!peerReady()) return;
    ensureName(); isHost = false; resetOther();
    goLobby(code, false);
    Net.join(code);
  }
  $('joinInviteBtn').onclick = () => joinRoom(inviteCode);
  $('joinBtn').onclick = () => joinRoom($('codeInput').value.trim().toUpperCase());
  $('codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('joinBtn').click(); });
  $('hostBtn').onclick = () => {
    if (!peerReady()) return;
    ensureName(); isHost = true; resetOther();
    $('hostBtn').disabled = true; $('hostBtn').textContent = 'Creating…';
    Net.host((code) => { $('hostBtn').disabled = false; $('hostBtn').textContent = 'Create room'; goLobby(code, true); });
  };
  $('soloBtn').onclick = () => { ensureName(); Net.destroy(); resetOther(); isHost = true; laps = 3; startCountdown(); };

  function resetOther() { other.present = false; other.snaps = []; other.name = ''; other.finished = false; other.ready = false; other.where = ''; online = false; trackBy = ''; }

  let roomCode = '', myReady = false, trackBy = '';
  function setLaps(n) { laps = clamp(parseInt(n, 10) || 3, 1, 9); $('lapsSelect').value = String(laps); }

  function goLobby(code, host) {
    mode = 'lobby';
    roomCode = code || roomCode;
    myReady = false;
    show('menu', false); show('lobby', true); show('result', false);
    for (const id of ['emotes', 'touch']) show(id, false);
    $('roomCode').textContent = roomCode;
    show('shareBlock', host);
    $('shareLink').value = location.origin + location.pathname + '?room=' + roomCode;
    if (online) { Net.send({ t: 'where', v: 'lobby' }); Net.send({ t: 'ready', v: false }); }
    renderTracks();
    renderDiffs();
    renderLobby();
  }

  function playerRow(name, charId, time, big) {
    const row = document.createElement('div');
    row.className = 'player' + (big ? ' big' : '');
    row.innerHTML = '<img alt=""><span class="nm"></span><span class="tm"></span>';
    row.querySelector('img').src = portraitSrc(charId);
    row.querySelector('.nm').textContent = name;
    row.querySelector('.tm').textContent = time;
    return row;
  }

  function pcard(name, charId, ready, note) {
    const c = document.createElement('div');
    c.className = 'pcard' + (ready ? ' ready' : '');
    c.innerHTML = '<img alt=""><div class="nm"></div><div class="badge"></div>';
    if (charId) c.querySelector('img').src = portraitSrc(charId); else c.querySelector('img').remove();
    c.querySelector('.nm').textContent = name;
    c.querySelector('.badge').textContent = ready ? 'READY ✓' : note;
    return c;
  }

  function renderLobbyChars() {
    const box = $('lobbyChars');
    box.innerHTML = '';
    for (const c of Chars.LIST) {
      const b = document.createElement('button');
      b.className = 'char' + (c.id === myChar ? ' sel' : '');
      b.innerHTML = '<img alt=""><span></span>';
      b.querySelector('img').src = portraitSrc(c.id);
      b.querySelector('span').textContent = c.name;
      b.onclick = () => {
        if (c.id === myChar) return;
        myChar = c.id; me.char = c.id; store.set('char', c.id);
        renderChars();
        if (online) Net.send({ t: 'char', id: c.id });
        resetReady();
      };
      box.appendChild(b);
    }
  }

  function resetReady() {
    if (myReady && online) Net.send({ t: 'ready', v: false });
    myReady = false; other.ready = false;
    renderLobby();
  }

  function renderLobby() {
    if (mode !== 'lobby') return;
    const box = $('players');
    box.innerHTML = '';
    box.appendChild(pcard(me.name + ' (you)', me.char, myReady, 'choosing…'));
    if (other.present) box.appendChild(pcard(other.name, other.char, other.ready, other.where && other.where !== 'lobby' ? 'viewing results…' : 'choosing…'));
    else box.appendChild(pcard(isHost ? 'Waiting…' : 'Connecting…', null, false, isHost ? 'send the link ↑' : ''));
    renderLobbyChars();
    $('trackWho').textContent = trackBy ? '· picked by ' + trackBy : '';
    const rb = $('readyBtn');
    rb.disabled = !other.present;
    rb.textContent = myReady ? 'WAITING… (CANCEL)' : 'READY!';
    rb.classList.toggle('waiting', myReady);
    $('lobbyStatus').textContent = !other.present ? (isHost ? 'Send the link to your partner' : 'Connecting to the room…')
      : myReady && other.ready ? 'Let\'s go!'
      : myReady ? 'Waiting for ' + other.name + ' to press READY'
      : other.ready ? other.name + ' is ready! Press READY'
      : 'Pick racers, track and mode, then both press READY';
  }

  function checkStart() {
    if (!isHost || mode !== 'lobby' || !online || !other.present) return;
    if (myReady && other.ready && other.where === 'lobby') {
      Net.send({ t: 'go', laps, track: trackId, diff });
      other.where = 'race';
      startCountdown();
    }
  }

  $('copyBtn').onclick = async () => {
    const v = $('shareLink').value;
    try { await navigator.clipboard.writeText(v); } catch (_) { $('shareLink').select(); document.execCommand('copy'); }
    toast('Link copied');
  };
  $('readyBtn').onclick = () => {
    myReady = !myReady;
    Net.send({ t: 'ready', v: myReady });
    renderLobby();
    checkStart();
  };
  $('lapsSelect').onchange = () => {
    setLaps($('lapsSelect').value);
    if (online) Net.send({ t: 'laps', n: laps });
    resetReady();
  };
  $('leaveBtn').onclick = goMenu;
  $('menuBtn').onclick = goMenu;
  $('againBtn').onclick = () => {
    if (online) {
      if (!Net.connected()) { toast('Connection lost'); return goMenu(); }
      return goLobby(roomCode, isHost);
    }
    startCountdown();
  };

  function goMenu() {
    Net.destroy();
    online = false; other.present = false; mode = 'menu';
    show('menu', true); show('lobby', false); show('result', false);
    for (const id of ['emotes', 'touch']) show(id, false);
    $('hostBtn').disabled = false; $('hostBtn').textContent = 'Create room';
    renderTracks();
  }

  function startCountdown() {
    ensureName();
    mode = 'countdown';
    placeOnGrid(me, isHost ? 0 : 1);
    if (other.present) placeOnGrid(other, isHost ? 1 : 0);
    other.snaps = []; other.finished = false; other.finishTime = 0;
    for (const k in pickedN) delete pickedN[k];
    particles = []; lapTimes = []; banner = null; camXw = me.x;
    countdownEnd = performance.now() + 3000;
    updateNitroBtn();
    show('menu', false); show('lobby', false); show('result', false);
    show('emotes', true); show('touch', isTouch);
  }

  function finish(now) {
    me.finished = true;
    me.finishTime = now - raceStart;
    if (lapTimes.length < laps) lapTimes.push(now - lapStart);
    if (online) { Net.send({ t: 'fin', time: me.finishTime }); Net.send({ t: 'where', v: 'result' }); }
    mode = 'done';
    show('touch', false);
    showBanner('FINISH!', '#ffffff', 1800);
    setTimeout(renderResult, 900);
  }

  function fmt(ms) {
    const s = ms / 1000, m = Math.floor(s / 60), r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
  }

  function renderResult() {
    if (mode !== 'done') return;
    show('result', true);
    $('againBtn').textContent = online ? 'BACK TO ROOM' : 'AGAIN!';
    $('menuBtn').textContent = online ? 'Leave room' : 'Menu';
    const rows = [{ name: me.name + ' (you)', char: me.char, t: me.finishTime, f: true, me: true }];
    if (online) rows.push({ name: other.name, char: other.char, t: other.finishTime, f: other.finished });
    rows.sort((a, b) => (a.f === b.f ? a.t - b.t : a.f ? -1 : 1));
    const box = $('resultTable');
    box.innerHTML = '';
    rows.forEach((r, i) => box.appendChild(playerRow((i === 0 && r.f ? '🏆 ' : '') + r.name, r.char, r.f ? fmt(r.t) : 'racing…', i === 0)));
    $('resultTitle').textContent = !online ? 'FINISH ' + fmt(me.finishTime) : rows[0].me ? 'YOU WIN!' : other.name + ' WINS!';
    const best = Math.min(...lapTimes);
    $('resultNote').textContent = (lapTimes.length ? 'Best lap: ' + fmt(best) + '. ' : '') +
      (online && !other.finished ? other.name + ' is still racing — cheer with an emoji!' : '');
  }

  // ---------- Рендер ----------
  let W = 0, H = RH, HORIZON = 0, PLAYER_Y = 0, SX = 0, CAM_H = 1000, D = 1;
  function resize() {
    const aspect = innerWidth / innerHeight;
    H = RH;
    W = Math.round(clamp(RH * aspect, 200, 580));
    canvas.width = W; canvas.height = H;
    HORIZON = Math.round(H * (W > H ? 0.42 : 0.45));
    PLAYER_Y = Math.round(H * 0.93);
    SX = W / 2;
    D = PLAYER_Y - HORIZON;
    const roadPx = W * (W > H ? 0.9 : 1.15);
    CAM_H = Math.max(900, (2 * ROAD * D) / roadPx);
    show('rotateHint', isTouch && innerHeight > innerWidth);
  }
  addEventListener('resize', resize);
  resize();

  // PS1-дизеринг: упорядоченная решётка Байера 4×4 поверх кадра (дёшево, на видеокарте)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const ditherPat = ctx.createPattern(Art.mk(4, 4, (g) => {
    BAYER.forEach((b, i) => { const v = Math.round((b / 15) * 255); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i % 4, i >> 2, 1, 1); });
  }), 'repeat');
  function ditherOverlay() {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = ditherPat; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // текстуры трассы (аффинное наложение, как на PS1): земля — широкая полоса из повторённых тайлов
  let tex = null, texFor = null;
  const STRIP_TILES = 24;
  function textures() {
    if (texFor !== T) {
      const GTs = Tracks.GT;
      const mkGround = (gt) => {
        const strip = Art.mk(GTs * STRIP_TILES, GTs, (g) => { for (let i = 0; i < STRIP_TILES; i++) g.drawImage(gt, i * GTs, 0); });
        const avg = Art.mk(1, 1, (g) => { g.imageSmoothingEnabled = true; g.drawImage(gt, 0, 0, 1, 1); }).getContext('2d').getImageData(0, 0, 1, 1).data;
        return { strip, avg: `rgb(${avg[0]},${avg[1]},${avg[2]})` };
      };
      const Z = T.zoneTex;
      tex = {
        ground: { default: mkGround(T.groundTex), bridge: mkGround(Z.water), ice: mkGround(Z.ice), tunnel: mkGround(Z.tunnel), lava: mkGround(Z.lava) },
        road: { default: T.roadTex, bridge: Z.bridgeRoad, ice: Z.iceRoad, tunnel: T.roadTex },
      };
      texFor = T;
    }
    return tex;
  }
  const GROUND_WORLD = 1500;                // сколько мира в одном тайле земли
  const ROAD_V = SEG * Tracks.RUMBLE * 2;   // длина одного "такта" бордюра

  let CAM_DEPTH = 1, PLAYER_Z = 1000;
  function project(p, camX, camY, camZ) {
    p.camera.x = -camX; p.camera.y = p.world.y - camY; p.camera.z = p.world.z - camZ;
    const s = (p.screen.scale = CAM_DEPTH / p.camera.z);
    p.screen.x = W / 2 + s * p.camera.x * SX;
    p.screen.y = HORIZON - s * p.camera.y * SX;
    p.screen.w = s * ROAD * SX * (p.wm || 1);
  }
  function quad(x1, y1, x2, y2, x3, y3, x4, y4, c) {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
  }
  // Сегмент рисуется построчно текстурами: земля на всю ширину, дорога поверх.
  function drawSegment(seg) {
    const { x: x1, y: y1, w: w1 } = seg.p1.screen;
    const { x: x2, y: y2, w: w2 } = seg.p2.screen;
    const z1 = seg.p1.world.z, z2 = seg.p2.world.z;
    const X = textures();
    const G = X.ground[seg.zone] || X.ground.default, RD = X.road[seg.zone] || X.road.default;
    const vAnim = seg.zone === 'bridge' ? nowG * 0.012 : seg.zone === 'lava' ? nowG * 0.005 : 0;   // вода течёт
    const GTs = Tracks.GT, stripW = GTs * STRIP_TILES;
    const yTop = Math.max(Math.floor(y2), Math.floor(HORIZON) - 2), yBot = Math.min(Math.ceil(y1), H);
    const span = y1 - y2;
    for (let yy = yTop; yy < yBot; yy++) {
      const t = span > 0 ? clamp((y1 - (yy + 0.5)) / span, 0, 1) : 0;
      const x = lerp(x1, x2, t), w = lerp(w1, w2, t), z = lerp(z1, z2, t);
      // земля: одна строка текстуры, растянутая на ширину экрана
      const kg = (w / ROAD) * (GROUND_WORLD / GTs);       // экранных пикселей на тексель
      const uw = W / kg;
      if (uw > stripW - GTs) { ctx.fillStyle = G.avg; ctx.fillRect(0, yy, W, 1); }
      else {
        const v = Math.floor(mod((z / GROUND_WORLD) * GTs + vAnim, GTs));
        ctx.drawImage(G.strip, mod(-x / kg, GTs), v, uw, 1, 0, yy, W, 1);
      }
      // дорога с бордюрами
      const rw = w * Tracks.ROAD_SPAN;
      const vr = Math.floor(mod((z / ROAD_V) * Tracks.RT_H, Tracks.RT_H));
      ctx.drawImage(RD, 0, vr, Tracks.RT_W, 1, x - rw, yy, 2 * rw, 1);
    }
    if (seg.zone === 'tunnel' && yBot > yTop) { ctx.fillStyle = 'rgba(10,5,20,.38)'; ctx.fillRect(0, yTop, W, yBot - yTop); }
    if (seg.start) {
      const cols = 12;
      for (let i = 0; i < cols; i++) {
        if ((i + seg.start) % 2) continue;
        const a = i / cols, b = (i + 1) / cols;
        quad(x1 - w1 + 2 * w1 * a, y1, x1 - w1 + 2 * w1 * b, y1, x2 - w2 + 2 * w2 * b, y2, x2 - w2 + 2 * w2 * a, y2, '#1c1c22');
      }
    }
    if (seg.fog < 1 && yBot > yTop) {
      ctx.globalAlpha = 1 - seg.fog; ctx.fillStyle = T.def.fog;
      ctx.fillRect(0, yTop, W, yBot - yTop); ctx.globalAlpha = 1;
    }
  }

  function drawSprite(img, worldW, x, y, scale, lift = 0, alpha = 1) {
    const w = worldW * scale * SX;
    if (w < 1 || w > W * 5) return;
    const h = (w * img.height) / img.width;
    const top = y - h - lift * scale * SX;
    if (top > H || x + w / 2 < 0 || x - w / 2 > W) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x - w / 2, top, w, h);
    ctx.globalAlpha = 1;
  }

  // плоский объект на асфальте (лужа, ускоряющая полоса): рисуется построчно в плоскости дороги
  function drawDecal(s, seg, alpha) {
    const p1 = seg.p1.screen, p2 = seg.p2.screen;
    const span = p1.y - p2.y;
    if (span < 0.5) return;
    const img = s.def.img, ih = img.height / 2, sy0 = s.part ? ih : 0;
    const y0 = Math.max(Math.floor(p2.y), 0), y1 = Math.min(Math.ceil(p1.y), H);
    ctx.globalAlpha = alpha;
    for (let yy = y0; yy < y1; yy++) {
      const t = clamp((p1.y - (yy + 0.5)) / span, 0, 1);
      const sc = lerp(p1.scale, p2.scale, t);
      const x = lerp(p1.x, p2.x, t) + sc * s.o * ROAD * SX, w = s.def.w * sc * SX;
      ctx.drawImage(img, 0, Math.min(img.height - 1, sy0 + (1 - t) * ih), img.width, 1, x - w / 2, yy, w, 1);
    }
    ctx.globalAlpha = 1;
  }

  // drift sparks under the rear wheels: white -> blue -> orange as the mini-turbo charges
  function driftSparks(car, x, y, w, now) {
    const col = car.driftT > 1.5 ? ['#ffb040', '#ff6a1a'] : car.driftT > 0.7 ? ['#9fd6ff', '#3d8cff'] : ['#ffffff', '#ffe9a8'];
    ctx.globalCompositeOperation = 'lighter';
    for (const s of [-1, 1]) {
      const wx = x + s * w * 0.33, wy = y - w * 0.04;
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI - Math.PI, r = w * (0.04 + Math.random() * 0.12);
        ctx.fillStyle = col[i % 2];
        ctx.fillRect(wx + Math.cos(a) * r, wy + Math.sin(a) * r * 0.5, Math.max(1, w * 0.02), Math.max(1, w * 0.02));
      }
      const g = ctx.createRadialGradient(wx, wy, 1, wx, wy, w * 0.1);
      g.addColorStop(0, col[0]); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(wx - w * 0.1, wy - w * 0.1, w * 0.2, w * 0.2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawKartAt(car, x, y, scale, now, isMe) {
    const boost = isMe ? now < car.boostUntil : car.boost;
    const hit = isMe ? now < car.hitUntil : car.hit;
    const yaw = car.yaw || 0;
    if (Math.abs(yaw) > 0.3) car.side = Math.sign(yaw);
    const fr = Chars.frame(car.char, yaw, car.side || 1, boost, hit, !!car.drift);
    if (!fr) return;
    const img = fr.img;
    const sp = (car.speed || 0) / MAX;
    const rough = Math.abs(car.x) > 1 ? 1.6 : 0.5;
    const bounce = sp > 0.05 ? Math.sin(now / 95 + (isMe ? 0 : 2)) * rough * sp * scale * SX * 25 : 0;
    const k = ((KART_W * scale * SX) / Chars.rearWidth(car.char)) * fr.s;   // same visual size in every frame
    const w = img.width * k, h = img.height * k;
    if (w < 2) return;
    const airPx = (car.airH || 0) * scale * SX;
    if (airPx > 1) {   // тень на земле во время прыжка
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(x, y - h * 0.04, w * 0.42 / (1 + airPx / (h * 2)), h * 0.08, 0, 0, 7); ctx.fill();
    }
    const top = y - h - bounce - airPx;
    const lean = yaw * w * 0.06;
    ctx.drawImage(img, x - w / 2 + lean, top, w, h);
    if (car.drift && car.driftT > 0.25) driftSparks(car, x, y, w, now);
    if (boost && !Chars.hasBoost(car.char)) {
      // у персонажа нет кадра нитро — рисуем пламя из выхлопа
      const fl = Art.puff(Chars.byId(car.char).flame || '#7cc4ff');
      ctx.globalCompositeOperation = 'lighter';
      for (const [fx, fy] of [[0.12, 0.74], [0.27, 0.8]]) {
        const s = w * (0.22 + 0.06 * Math.sin(now / 40 + fx * 9));
        ctx.drawImage(fl, x - w / 2 + fx * w - s * 1.1, top + fy * h - s * 0.4, s * 1.4, s);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (!isMe) {
      text(car.name, x, Math.round(top + h * 0.02) - 9, 8, '#fff', 'center');
    }
    if (car.emo && now < car.emo.until) {
      const t = 1 - (car.emo.until - now) / 2200;
      ctx.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1;
      ctx.font = `${Math.max(14, Math.round(w * 0.3))}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(car.emo.e, x, top - 10 - t * w * 0.15);
      ctx.globalAlpha = 1;
    }
  }

  function drawParticle(p, x, y, scale) {
    const r = p.size * scale * SX;
    if (r < 0.6) return;
    const a = clamp(p.life / p.max, 0, 1) * p.a;
    if (p.add) ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    ctx.drawImage(Art.puff(p.color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // фон
  const stars = Array.from({ length: 70 }, () => [Math.random(), Math.random() * 0.9, Math.random()]);
  const cloudsArr = Array.from({ length: 7 }, (_, i) => ({ x: i / 7 + Math.random() * 0.05, y: 0.12 + Math.random() * 0.35, s: 0.6 + Math.random() * 0.6 }));
  function drawBackground(now) {
    const d = T.def;
    const gr = ctx.createLinearGradient(0, 0, 0, HORIZON);
    gr.addColorStop(0, d.sky[0]); gr.addColorStop(0.6, d.sky[1]); gr.addColorStop(1, d.sky[2]);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, HORIZON + 2);

    if (d.stars) for (const [sx, sy, tw] of stars) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now / 500 + tw * 20);
      ctx.fillStyle = '#fff';
      ctx.fillRect(Math.round(mod(sx * W * 1.5 - skyOff * 0.05, W * 1.5)), Math.round(sy * HORIZON * 0.8), 1, 1);
    }
    ctx.globalAlpha = 1;
    const body = d.sun || d.moon;
    let sun = null;
    if (body) {
      const bx = mod(body.x * W * 2 - skyOff * 0.08, W * 2) - W * 0.2, by = HORIZON * body.y;
      const rad = body.r * (H / 240);
      const g2 = ctx.createRadialGradient(bx, by, 1, bx, by, rad * 5);
      g2.addColorStop(0, d.sun ? 'rgba(255,240,200,.85)' : 'rgba(200,215,255,.5)'); g2.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g2; ctx.fillRect(bx - rad * 5, by - rad * 5, rad * 10, rad * 10);
      ctx.fillStyle = d.sun ? body.c : '#e8eeff';
      ctx.beginPath(); ctx.arc(bx, by, rad, 0, 7); ctx.fill();
      if (d.moon) { ctx.fillStyle = 'rgba(150,160,200,.5)'; ctx.beginPath(); ctx.arc(bx - rad * 0.3, by - rad * 0.2, rad * 0.25, 0, 7); ctx.arc(bx + rad * 0.35, by + rad * 0.3, rad * 0.18, 0, 7); ctx.fill(); }
      if (d.sun) sun = { x: bx, y: by };
    }
    if (d.clouds) for (const c of cloudsArr) {
      const span = W * 1.8;
      const x = mod(c.x * span - skyOff * 0.12 - now * 0.003, span) - W * 0.4;
      const y = HORIZON * c.y, s = c.s * H * 0.04;
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.ellipse(x, y, s * 2.2, s * 0.7, 0, 0, 7); ctx.ellipse(x + s, y - s * 0.4, s * 1.3, s * 0.8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(170,200,240,.5)'; ctx.beginPath(); ctx.ellipse(x + s * 0.3, y + s * 0.3, s * 2, s * 0.35, 0, 0, 7); ctx.fill();
    }
    layer(T.farImg, skyOff * 0.25, HORIZON * 0.75);
    layer(T.nearImg, skyOff * 0.55, HORIZON * 0.45);
    return sun;
  }
  function layer(img, off, h) {
    const k = h / Tracks.PH, w = Tracks.PW * k;
    const x0 = -mod(off, w);
    for (let x = x0; x < W; x += w) ctx.drawImage(img, x, HORIZON - h + 1, w + 1, h);
  }

  function lensFlare(sun) {
    if (!sun || sun.x < -20 || sun.x > W + 20) return;
    const cx = W / 2, cy = H / 2;
    ctx.globalCompositeOperation = 'lighter';
    const spots = [[0.35, 6, 'rgba(255,200,120,.18)'], [0.6, 3, 'rgba(160,255,200,.15)'], [0.9, 10, 'rgba(255,150,200,.12)'], [1.25, 5, 'rgba(150,200,255,.15)']];
    for (const [t, r, c] of spots) {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(lerp(sun.x, cx * 2 - sun.x, t * 0.6), lerp(sun.y, cy * 2 - sun.y, t * 0.6), r * (H / 240), 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  let nowG = 0;
  function render(now) {
    nowG = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    // плавная тряска (синусоиды вместо случайных скачков)
    const sx = shake > 0 ? Math.sin(now / 31) * 4 * shake : 0;
    const sy = shake > 0 ? Math.cos(now / 43) * 2.5 * shake : 0;
    ctx.translate(sx, sy);

    // поле зрения расширяется на нитро — ощущение скорости
    const fov = 96 + fovK * 16 + (me.speed / MAX) * 4;
    CAM_DEPTH = 1 / Math.tan((fov / 2) * Math.PI / 180);
    PLAYER_Z = (CAM_DEPTH * CAM_H * SX) / D;

    const sun = drawBackground(now);
    ctx.fillStyle = T.def.ground; ctx.fillRect(-4, HORIZON, W + 8, H - HORIZON + 4);

    const camZ = me.total - PLAYER_Z;
    const base = T.findSeg(camZ);
    const basePct = mod(camZ, SEG) / SEG;
    const playerSeg = T.findSeg(me.total);
    const playerY = lerp(playerSeg.p1.world.y, playerSeg.p2.world.y, mod(me.total, SEG) / SEG);
    const camY = playerY + CAM_H;
    const camX = camXw * ROAD;
    const cz = mod(camZ, T.LENGTH);

    let x = 0, dx = -(base.curve * basePct);
    const list = [];
    for (let n = 0; n < DRAW; n++) {
      const seg = T.segs[(base.index + n) % T.N];
      const loop = seg.index < base.index ? T.LENGTH : 0;
      seg.fog = 1 / Math.pow(Math.E, (n / DRAW) * (n / DRAW) * FOG_DENSITY);
      project(seg.p1, camX - x, camY, cz - loop);
      project(seg.p2, camX - x - dx, camY, cz - loop);
      x += dx; dx += seg.curve;
      seg.objs = null;
      list.push(seg);
    }

    // объекты, привязанные к позиции на трассе: машинки и частицы
    const bucket = (z, o) => {
      const d = z - camZ;
      if (d <= 60 || d >= DRAW * SEG - SEG) return false;
      const seg = list[Math.floor((basePct * SEG + d) / SEG)];
      if (!seg) return false;
      (seg.objs || (seg.objs = [])).push(o);
      return true;
    };
    const cars = [];
    if (inGame()) cars.push(me);
    if (inGame() && online && other.present) cars.push(other);
    for (const c of cars) bucket(c.total, { car: c, z: c.total });
    for (const p of particles) bucket(p.z, { p, z: p.z });

    for (let n = DRAW - 1; n >= 0; n--) {
      const seg = list[n];
      const p1 = seg.p1.screen, p2 = seg.p2.screen;
      if (seg.p1.camera.z > CAM_DEPTH) {
        if (p2.y < p1.y) drawSegment(seg);
        const alpha = clamp(seg.fog * 1.6, 0, 1);
        for (const s of seg.sprites) if (s.def.decal) drawDecal(s, seg, alpha);
        const tooClose = seg.p1.camera.z < PLAYER_Z * 0.75;   // objects between camera and kart would block the view
        for (const s of seg.sprites) {
          if (s.def.decal) continue;
          if (tooClose && s.def.w < 5000) continue;
          let lift = 0;
          if (s.nitro != null) {
            if ((pickedN[s.nitro] || 0) > now) continue;
            lift = 220 + Math.sin(now / 260 + s.nitro) * 50;
          }
          if (s.move) lift = Math.abs(Math.sin(now / 160 + s.move.ph)) * 60;   // подпрыгивает на ходу
          drawSprite(s.def.img, s.def.w, p1.x + p1.scale * spriteO(s, now) * ROAD * SX, p1.y, p1.scale, lift, alpha);
        }
      }
      if (seg.objs) {
        seg.objs.sort((a, b) => b.z - a.z);
        for (const o of seg.objs) {
          const d = o.z - camZ;
          if (d < 60) continue;
          const pct = mod(o.z, SEG) / SEG;
          const sc = CAM_DEPTH / d;
          const wy = lerp(seg.p1.world.y, seg.p2.world.y, pct);
          const cxw = lerp(seg.p1.camera.x, seg.p2.camera.x, pct);
          if (o.car) {
            drawKartAt(o.car, W / 2 + sc * (cxw + o.car.x * ROAD) * SX, HORIZON - sc * (wy - camY) * SX, sc, now, o.car === me);
          } else {
            const p = o.p;
            drawParticle(p, W / 2 + sc * (cxw + p.x * ROAD) * SX, HORIZON - sc * (wy + p.y - camY) * SX, sc);
          }
        }
      }
    }

    lensFlare(sun);
    if (inGame() && fovK > 0.05) speedLines(now);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ditherOverlay();
    if (flash > 0) { ctx.fillStyle = `rgba(200,235,255,${flash})`; ctx.fillRect(0, 0, W, H); }
    vignette();
    if (inGame()) drawHud(now, camZ);
  }

  let vigCache = null;
  function vignette() {
    if (!vigCache || vigCache.width !== W) {
      vigCache = Art.mk(W, H, (g) => {
        const gr = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.75);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,0,20,.45)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      });
    }
    ctx.drawImage(vigCache, 0, 0);
  }

  function speedLines(now) {
    ctx.strokeStyle = `rgba(220,240,255,${0.35 * fovK})`;
    ctx.lineWidth = 1;
    const cx = W / 2, cy = HORIZON;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + i * 1.7;
      const ph = ((now / 3 + i * 53) % 100) / 100;
      const r1 = W * (0.3 + ph * 0.5), r2 = r1 + W * 0.1;
      ctx.beginPath();
      ctx.moveTo(Math.round(cx + Math.cos(a) * r1), Math.round(cy + Math.sin(a) * r1 * 0.75));
      ctx.lineTo(Math.round(cx + Math.cos(a) * r2), Math.round(cy + Math.sin(a) * r2 * 0.75));
      ctx.stroke();
    }
  }

  // ---------- HUD (рисуется прямо в низком разрешении — пиксельный вид) ----------
  function text(s, x, y, size, color, align = 'left') {
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,.85)';
    ctx.fillText(s, Math.round(x) + 1, Math.round(y) + 1);
    ctx.fillStyle = color;
    ctx.fillText(s, Math.round(x), Math.round(y));
  }

  const headSmall = {};
  const headImg = (id) => headSmall[id] || (headSmall[id] = Art.mk(20, 20, (g) => { const s = Chars.head(id); if (s) g.drawImage(s, 0, 0, 20, 20); }));

  function drawHud(now, camZ) {
    const done = Math.max(0, me.total - T.START_Z);
    const lap = Math.min(laps, Math.floor(done / T.LENGTH) + 1);
    text('LAP', 6, 6, 8, '#ffd84a');
    text(lap + '/' + laps, 6, 16, 16, '#ffffff');
    const t = mode === 'countdown' ? 0 : me.finished ? me.finishTime : now - raceStart;
    text(fmt(t), 6, 36, 8, '#ffffff');
    lapTimes.forEach((lt, i) => text((i + 1) + ' ' + fmt(lt), 6, 48 + i * 10, 8, '#c8d8ff'));

    // места
    const racers = [{ c: me, tot: me.finished ? Infinity - me.finishTime : me.total }];
    if (online && other.present) racers.push({ c: other, tot: other.finished ? Infinity - other.finishTime : other.total });
    if (online && me.finished && other.finished) racers.forEach((r) => (r.tot = -r.c.finishTime));
    racers.sort((a, b) => b.tot - a.tot);
    if (racers.length > 1) racers.forEach((r, i) => {
      const y = 92 + i * 26;
      ctx.fillStyle = r.c === me ? 'rgba(255,216,74,.35)' : 'rgba(0,0,0,.35)';
      ctx.fillRect(4, y - 2, 44, 24);
      ctx.drawImage(headImg(r.c.char), 6, y);
      text(String(i + 1), 28, y + 4, 16, i === 0 ? '#ffd84a' : '#ffffff');
    });

    drawMinimap();

    // спидометр и нитро
    const kmh = Math.round((me.speed / MAX) * 220);
    text(String(kmh).padStart(3, ' '), W - 8, H - 30, 16, now < me.boostUntil ? '#9fd6ff' : '#ffffff', 'right');
    text('KM/H', W - 8, H - 12, 8, '#ffd84a', 'right');
    for (let i = 0; i < NITRO_MAX; i++) {
      const x = W - 14 - i * 12, y = H - 48;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 1, y - 1, 10, 14);
      ctx.fillStyle = i < me.nitro ? (Math.sin(now / 150 + i) > 0 ? '#5cb4ff' : '#3d8cff') : '#2a2a3a';
      ctx.fillRect(x, y, 8, 12);
      if (i < me.nitro) { ctx.fillStyle = '#e8f4ff'; ctx.fillRect(x + 1, y + 1, 2, 10); }
    }
    if (me.nitro > 0 && !isTouch && mode === 'race') text('SHIFT', W - 8, H - 60, 8, 'rgba(255,255,255,.6)', 'right');

    // соперник вне кадра
    if (online && other.present) {
      const d = other.total - me.total, m = Math.round(d / 40);
      if (other.total - camZ <= 60) text('▼ ' + other.name + ' ' + m + 'm', W / 2, H - 14, 8, '#ffb0c8', 'center');
      else if (other.total - camZ >= DRAW * SEG - SEG) text('▲ ' + other.name + ' +' + m + 'm', W / 2, HORIZON - 14, 8, '#ffb0c8', 'center');
    }

    // отсчёт
    if (mode === 'countdown' || (mode === 'race' && now - raceStart < 900)) {
      const left = countdownEnd - now;
      const label = left > 0 ? String(Math.ceil(left / 1000)) : 'GO!';
      const ph = left > 0 ? 1 - (left % 1000) / 1000 : (now - raceStart) / 900;
      const sc = 1 + (1 - ease(ph * 2)) * 1.5;
      ctx.save();
      ctx.translate(W / 2, H * 0.38);
      ctx.scale(sc, sc);
      ctx.globalAlpha = left > 0 ? 1 : 1 - ph;
      text(label, 0, -16, 32, left > 0 ? '#ffd84a' : '#7cff9a', 'center');
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (banner) {
      const k = (now - banner.t0) / banner.ms;
      if (k > 1) banner = null;
      else {
        ctx.globalAlpha = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
        const y = H * 0.3 - (1 - ease(k * 4)) * 20;
        text(banner.text, W / 2, y, 16, banner.color, 'center');
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawMinimap() {
    const m = T.map, size = Math.min(64, Math.round(W * 0.16));
    const ox = W - size - 6, oy = 6;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(ox - 2, oy - 2, size + 4, size + 4);
    const sc = (size - 6) / Math.max(m.maxX - m.minX, m.maxY - m.minY);
    const offX = ox + 3 + ((size - 6) - (m.maxX - m.minX) * sc) / 2;
    const offY = oy + 3 + ((size - 6) - (m.maxY - m.minY) * sc) / 2;
    const P = (i) => { const p = m.pts[mod(Math.floor(i), T.N)]; return [Math.round(offX + (p[0] - m.minX) * sc), Math.round(offY + (p[1] - m.minY) * sc)]; };
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < T.N; i += 3) { const [x, y] = P(i); ctx.fillRect(x, y, 1, 1); }
    const dot = (car, col) => { const [x, y] = P(car.total / SEG); ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillStyle = col; ctx.fillRect(x - 1, y - 1, 3, 3); };
    if (online && other.present) dot(other, '#ff6fa3');
    dot(me, '#ffd84a');
  }

  // ---------- Главный цикл ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (!inGame()) {
      me.speed = MAX * 0.4; me.x = lerp(me.x, 0, dt); me.total += me.speed * dt;
    } else {
      if (mode === 'countdown' && now >= countdownEnd) { mode = 'race'; raceStart = now; lapStart = now; }
      stepMe(dt, now);
      emitFor(me, dt, now, true);
      if (online && other.present) emitFor(other, dt, now, false);
    }
    stepParticles(dt);

    const pseg = T.findSeg(me.total);
    skyOff += pseg.curve * (me.speed / MAX) * dt * 40;
    shake = Math.max(0, shake - dt);
    flash = Math.max(0, flash - dt * 1.6);
    fovK = lerp(fovK, inGame() && now < me.boostUntil ? 1 : 0, 1 - Math.exp(-4 * dt));
    camXw = lerp(camXw, me.x, 1 - Math.exp(-7 * dt));   // камера мягко догоняет карт

    if (online && inGame() && now - lastSend > 50) {
      lastSend = now;
      Net.send({ t: 's', tot: Math.round(me.total), x: Math.round(me.x * 1000) / 1000, sp: Math.round(me.speed),
        st: Math.round((me.yaw || 0) * 100) / 100, d: me.drift ? me.drift * (me.driftT > 1.5 ? 3 : me.driftT > 0.7 ? 2 : 1) : 0, b: now < me.boostUntil, h: now < me.hitUntil, j: Math.round(me.airH || 0) });
    }
    if (online) updateRemote(now);

    render(now);
    requestAnimationFrame(frame);
  }
  const fontReady = document.fonts && document.fonts.load ? document.fonts.load('8px "Press Start 2P"').catch(() => {}) : Promise.resolve();
  Promise.all([fontReady, Chars.init()]).then(() => {
    renderChars();
    last = performance.now();
    requestAnimationFrame(frame);
  });

  window.__race = { track: () => T, me, other, startSolo: () => $('soloBtn').click(), keys, setTrack: (id) => setTrack(id, false) };
})();
