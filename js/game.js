(() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const { SEG, ROAD, N, LENGTH, START_Z } = Road;
  const mod = (a, b) => ((a % b) + b) % b;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Камера и физика ----------
  const CAM_DEPTH = 1 / Math.tan((100 / 2) * Math.PI / 180);
  const DRAW = 260;               // сколько сегментов видно вперёд
  const FOG_DENSITY = 4;
  const MAX = SEG * 60;           // максимальная скорость
  const ACCEL = MAX / 4.5, BRAKE = -MAX * 1.1, DECEL = -MAX / 5;
  const OFF_DECEL = -MAX / 1.6, OFF_LIMIT = MAX / 4;
  const CENTRIFUGAL = 0.3;
  const KART_W = 720;             // ширина карта в мире
  const KART_U = (KART_W / ROAD) * 0.75; // ширина для столкновений в единицах полуширины дороги
  const BOOST_MS = 1600;

  // ---------- Хранилище ----------
  const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };
  let myName = store.get('name', '');
  let myChar = store.get('char', Art.CHARS[0].id);
  if (!Art.CHARS.some((c) => c.id === myChar)) myChar = Art.CHARS[0].id;

  // ---------- Состояние ----------
  let mode = 'menu';   // menu | lobby | countdown | race | done
  let online = false, isHost = false, laps = 3;
  let countdownEnd = 0, raceStart = 0, skyOff = 0, shake = 0;
  const picked = {};   // сердечки, собранные мной: id -> время возрождения

  const newCar = () => ({ total: 0, x: 0, speed: 0, steer: 0, boostUntil: 0, hitUntil: 0,
    finished: false, finishTime: 0, emo: null, name: '', char: 'bunny' });
  const me = newCar();
  const other = Object.assign(newCar(), { present: false, snaps: [], boost: false, hit: false });

  function placeOnGrid(car, slot) {
    car.total = 0; car.x = slot === 0 ? -0.45 : 0.45;
    car.speed = 0; car.steer = 0; car.boostUntil = 0; car.hitUntil = 0;
    car.finished = false; car.finishTime = 0;
  }

  // ---------- Ввод ----------
  const keys = {};
  const touch = { up: false, down: false, left: false, right: false };
  const typing = () => ['INPUT', 'SELECT'].includes(document.activeElement && document.activeElement.tagName);
  addEventListener('keydown', (e) => {
    if (typing()) return;
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    const emo = { Digit1: '❤️', Digit2: '😘', Digit3: '😂', Digit4: '😤' }[e.code];
    if (emo && mode !== 'menu' && mode !== 'lobby') sendEmote(emo);
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const input = () => ({
    up: keys.ArrowUp || keys.KeyW || touch.up,
    down: keys.ArrowDown || keys.KeyS || keys.Space || touch.down,
    left: keys.ArrowLeft || keys.KeyA || touch.left,
    right: keys.ArrowRight || keys.KeyD || touch.right,
  });
  function bindTouch(id, key) {
    const el = $(id);
    const on = (e) => { e.preventDefault(); touch[key] = true; el.classList.add('on'); };
    const off = (e) => { e.preventDefault(); touch[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on);
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, off);
  }
  bindTouch('tGas', 'up'); bindTouch('tBrake', 'down'); bindTouch('tLeft', 'left'); bindTouch('tRight', 'right');
  const isTouch = matchMedia('(pointer: coarse)').matches;
  document.querySelectorAll('#emotes button').forEach((b) => b.addEventListener('click', () => sendEmote(b.dataset.emo)));
  function sendEmote(e) {
    me.emo = { e, until: performance.now() + 2200 };
    if (online) Net.send({ t: 'emo', e });
  }

  // ---------- Симуляция ----------
  function overlap(x1, w1, x2, w2) { return Math.abs(x1 - x2) < (w1 + w2) / 2; }

  function crash(now, strength) {
    me.speed = Math.min(me.speed, MAX * strength);
    me.hitUntil = now + 650;
    shake = 0.35;
  }

  function stepMe(dt, now) {
    const seg = Road.findSeg(me.total);
    const sp = me.speed / MAX;
    let inp;
    if (mode === 'race') inp = input();
    else if (mode === 'done') inp = { up: me.speed < MAX * 0.45, down: false, left: me.x > 0.1, right: me.x < -0.1 };
    else inp = { up: false, down: false, left: false, right: false };

    const hitNow = now < me.hitUntil;
    me.steer = inp.left ? -1 : inp.right ? 1 : 0;
    const dx = dt * 2.1 * Math.min(1, sp * 1.2 + 0.1);
    if (!hitNow) me.x += me.steer * dx;
    me.x -= dx * sp * seg.curve * CENTRIFUGAL;

    const boosting = now < me.boostUntil;
    const maxS = MAX * (boosting ? 1.32 : 1);
    if (mode === 'race' || mode === 'done') {
      if (inp.up) me.speed += ACCEL * (boosting ? 2.2 : 1) * dt;
      else if (inp.down) me.speed += BRAKE * dt;
      else me.speed += DECEL * dt;
      if (boosting && !inp.down) me.speed += ACCEL * dt;
    } else me.speed = 0;

    if ((me.x < -1 || me.x > 1) && me.speed > OFF_LIMIT) me.speed += OFF_DECEL * dt;
    if (me.speed > maxS) me.speed += (maxS - me.speed) * Math.min(1, 2 * dt);
    me.speed = clamp(me.speed, 0, MAX * 1.32);
    me.x = clamp(me.x, -2.6, 2.6);

    // столкновения с декорациями, конусами; сбор сердечек
    if (mode === 'race') {
      const segs = [seg, Road.findSeg(me.total + SEG)];
      for (const s of segs) for (const sp2 of s.sprites) {
        if (sp2.pick != null) {
          if ((picked[sp2.pick] || 0) > now) continue;
          if (overlap(me.x, KART_U, sp2.o, sp2.def.w / ROAD * 0.9)) {
            picked[sp2.pick] = now + 6000;
            me.boostUntil = now + BOOST_MS;
            burst(sp2);
          }
          continue;
        }
        if (!sp2.def.hit || hitNow) continue;
        if (overlap(me.x, KART_U, sp2.o, (sp2.def.w / ROAD) * sp2.def.hit)) {
          crash(now, sp2.def === Art.scenery.cone ? 0.35 : 0.12);
          me.x += me.x < sp2.o ? -0.08 : 0.08;
          me.total -= SEG * 0.5;
        }
      }
      collideWithOther(now);
    }

    me.total += me.speed * dt;
    if (mode === 'race' && me.total - START_Z >= laps * LENGTH) finish(now);
  }

  function collideWithOther(now) {
    if (!online || !other.present) return;
    const dz = other.total - me.total;
    if (Math.abs(dz) < 330 && Math.abs(other.x - me.x) < KART_U * 1.1) {
      const push = (KART_U * 1.1 - Math.abs(other.x - me.x)) * 0.6;
      me.x += me.x <= other.x ? -push : push;
      if (dz > 0 && me.speed > other.speed) { me.speed = other.speed * 0.92; me.hitUntil = Math.max(me.hitUntil, now + 300); }
      shake = Math.max(shake, 0.15);
    }
  }

  const sparks = [];
  function burst(sp) {
    for (let i = 0; i < 12; i++) sparks.push({ a: Math.random() * Math.PI * 2, v: 120 + Math.random() * 220, t: performance.now() });
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
      cur = k < 0.5 ? a : b;
    } else {
      cur = s[s.length - 1];
      const ahead = clamp(rt - cur.t, 0, 250) / 1000;
      other.total = cur.tot + cur.sp * ahead;
      other.x = cur.x;
    }
    other.speed = cur.sp; other.steer = cur.st; other.boost = cur.b; other.hit = cur.h;
  }

  // ---------- Сеть ----------
  let lastSend = 0;
  Net.on('connected', () => {
    online = true;
    Net.send({ t: 'hello', name: myName, char: myChar });
    toast('Соединение есть ♥');
  });
  Net.on('message', (m) => {
    const now = performance.now();
    switch (m.t) {
      case 'hello':
        other.name = String(m.name || 'Гость').slice(0, 14);
        other.char = Art.CHARS.some((c) => c.id === m.char) ? m.char : 'cat';
        other.present = true;
        renderLobby();
        break;
      case 'go': laps = m.laps || 3; startCountdown(); break;
      case 's':
        other.snaps.push({ t: now, tot: m.tot, x: m.x, sp: m.sp, st: m.st, b: m.b, h: m.h });
        if (other.snaps.length > 40) other.snaps.shift();
        break;
      case 'fin':
        other.finished = true; other.finishTime = m.time;
        if (mode === 'race') toast(other.name + ' уже на финише!');
        if (mode === 'done') renderResult();
        break;
      case 'emo': other.emo = { e: m.e, until: now + 2200 }; break;
      case 'full': toast('В комнате уже двое 😅'); goMenu(); break;
    }
  });
  Net.on('closed', () => { if (mode !== 'menu') { toast('Соединение потеряно 💔'); goMenu(); } });
  Net.on('error', (e) => {
    const msg = {
      'peer-unavailable': 'Комната не найдена. Проверь код или попроси новую ссылку.',
      'network': 'Нет связи с сервером. Проверь интернет.',
      'server-error': 'Сервер соединения недоступен, попробуй ещё раз.',
      'browser-incompatible': 'Этот браузер не поддерживает WebRTC.',
    }[e && e.type] || ('Ошибка соединения: ' + ((e && (e.type || e.message)) || e));
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

  const portraitURL = {};
  const portraitSrc = (id) => portraitURL[id] || (portraitURL[id] = Art.portrait(id).toDataURL());
  const headURL = {};
  const headSrc = (id) => headURL[id] || (headURL[id] = Art.head(id).toDataURL());

  const nameInput = $('nameInput');
  nameInput.value = myName;
  nameInput.addEventListener('input', () => { myName = nameInput.value.trim(); store.set('name', myName); });

  function renderChars() {
    const box = $('chars');
    box.innerHTML = '';
    for (const c of Art.CHARS) {
      const b = document.createElement('button');
      b.className = 'char' + (c.id === myChar ? ' sel' : '');
      b.innerHTML = `<img alt=""><span></span>`;
      b.querySelector('img').src = portraitSrc(c.id);
      b.querySelector('span').textContent = c.name;
      b.onclick = () => { myChar = c.id; store.set('char', c.id); renderChars(); };
      box.appendChild(b);
    }
  }
  renderChars();

  function ensureName() {
    if (!myName) myName = Art.charById(myChar).name;
    me.name = myName; me.char = myChar;
  }

  const params = new URLSearchParams(location.search);
  const inviteCode = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (inviteCode) { show('joinBlock', true); show('hostBlock', false); $('inviteCode').textContent = inviteCode; }

  const peerReady = () => { if (typeof Peer === 'undefined') { toast('Не загрузилась библиотека соединения. Обнови страницу.'); return false; } return true; };

  function joinRoom(code) {
    if (!code) return toast('Введи код комнаты');
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
    $('hostBtn').disabled = true; $('hostBtn').textContent = 'Создаём…';
    Net.host((code) => { $('hostBtn').disabled = false; $('hostBtn').textContent = 'Создать комнату'; goLobby(code, true); });
  };
  $('soloBtn').onclick = () => { ensureName(); Net.destroy(); resetOther(); isHost = true; laps = 3; startCountdown(); };

  function resetOther() { other.present = false; other.snaps = []; other.name = ''; other.finished = false; online = false; }

  function goLobby(code, host) {
    mode = 'lobby';
    show('menu', false); show('lobby', true); show('result', false);
    $('roomCode').textContent = code;
    show('shareBlock', host);
    $('shareLink').value = location.origin + location.pathname + '?room=' + code;
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

  function renderLobby() {
    if (mode !== 'lobby') return;
    const box = $('players');
    box.innerHTML = '';
    box.appendChild(playerRow(me.name + ' (ты)', me.char, '', true));
    if (other.present) box.appendChild(playerRow(other.name, other.char, '', true));
    $('startBtn').disabled = !other.present;
    $('lobbyStatus').textContent = other.present ? 'Все на месте! Жми старт ♥' : isHost ? 'Ждём второго игрока…' : 'Подключаемся…';
  }

  $('copyBtn').onclick = async () => {
    const v = $('shareLink').value;
    try { await navigator.clipboard.writeText(v); } catch (_) { $('shareLink').select(); document.execCommand('copy'); }
    toast('Ссылка скопирована');
  };
  $('startBtn').onclick = () => { laps = parseInt($('lapsSelect').value, 10) || 3; Net.send({ t: 'go', laps }); startCountdown(); };
  $('leaveBtn').onclick = goMenu;
  $('menuBtn').onclick = goMenu;
  $('againBtn').onclick = () => {
    if (online) {
      if (!Net.connected()) { toast('Соединение потеряно'); return goMenu(); }
      Net.send({ t: 'go', laps });
    }
    startCountdown();
  };

  function goMenu() {
    Net.destroy();
    online = false; other.present = false; mode = 'menu';
    show('menu', true); show('lobby', false); show('result', false);
    for (const id of ['hud', 'emotes', 'touch', 'countdown', 'progress']) show(id, false);
    $('hostBtn').disabled = false; $('hostBtn').textContent = 'Создать комнату';
  }

  function startCountdown() {
    ensureName();
    mode = 'countdown';
    placeOnGrid(me, isHost ? 0 : 1);
    if (other.present) placeOnGrid(other, isHost ? 1 : 0);
    other.snaps = []; other.finished = false; other.finishTime = 0;
    for (const k in picked) delete picked[k];
    countdownEnd = performance.now() + 3000;
    show('menu', false); show('lobby', false); show('result', false);
    show('hud', true); show('emotes', true); show('touch', isTouch); show('countdown', true);
    show('progress', online);
    if (online) {
      $('pMe').src = headSrc(me.char);
      $('pOther').src = headSrc(other.char);
    }
  }

  function finish(now) {
    me.finished = true;
    me.finishTime = now - raceStart;
    if (online) Net.send({ t: 'fin', time: me.finishTime });
    mode = 'done';
    show('touch', false);
    renderResult();
  }

  function fmt(ms) {
    const s = ms / 1000, m = Math.floor(s / 60), r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
  }

  function renderResult() {
    show('result', true);
    const rows = [{ name: me.name + ' (ты)', char: me.char, t: me.finishTime, f: true, me: true }];
    if (online) rows.push({ name: other.name, char: other.char, t: other.finishTime, f: other.finished });
    rows.sort((a, b) => (a.f === b.f ? a.t - b.t : a.f ? -1 : 1));
    const box = $('resultTable');
    box.innerHTML = '';
    rows.forEach((r, i) => box.appendChild(playerRow((i === 0 && r.f ? '🏆 ' : '') + r.name, r.char, r.f ? fmt(r.t) : 'в пути…', i === 0)));
    $('resultTitle').textContent = !online ? 'Финиш! ' + fmt(me.finishTime) : rows[0].me ? 'Победа! 🏆' : 'Победа за ' + other.name + ' ♥';
    $('resultNote').textContent = online && !other.finished ? other.name + ' ещё едет — подбодри смайликом!' : '';
  }

  // ---------- Рендер ----------
  let W = 0, H = 0, DPR = 1, HORIZON = 0, PLAYER_Y = 0, SX = 0, CAM_H = 1000, PLAYER_Z = 1000;
  let skyGrad = null;
  function resize() {
    DPR = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    HORIZON = Math.round(H * (W > H ? 0.42 : 0.45));
    PLAYER_Y = H * 0.93;
    SX = W / 2;
    const D = PLAYER_Y - HORIZON;
    const roadPx = W * (W > H ? 0.9 : 1.15);       // ширина дороги на уровне игрока
    CAM_H = Math.max(900, (2 * ROAD * D) / roadPx);
    PLAYER_Z = (CAM_DEPTH * CAM_H * SX) / D;      // камера стоит за картом на этом расстоянии
    skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON);
    skyGrad.addColorStop(0, '#4fb8ff'); skyGrad.addColorStop(0.65, '#a8e3ff'); skyGrad.addColorStop(1, '#ffd9ec');
    show('rotateHint', isTouch && H > W);
  }
  addEventListener('resize', resize);
  resize();

  const COL = {
    light: { road: '#a0a0b4', grass: '#8ad86a', rumble: '#ff5c8a', lane: '#ffffff' },
    dark: { road: '#9696aa', grass: '#7acb5b', rumble: '#ffffff', lane: null },
  };
  const FOG = '#eaf6ff';

  function project(p, camX, camY, camZ) {
    p.camera.x = -camX; p.camera.y = p.world.y - camY; p.camera.z = p.world.z - camZ;
    const s = (p.screen.scale = CAM_DEPTH / p.camera.z);
    p.screen.x = Math.round(W / 2 + s * p.camera.x * SX);
    p.screen.y = Math.round(HORIZON - s * p.camera.y * SX);
    p.screen.w = Math.round(s * ROAD * SX);
  }

  function poly(x1, y1, x2, y2, x3, y3, x4, y4, c) {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
  }

  function drawSegment(seg) {
    const c = seg.dark ? COL.dark : COL.light;
    const { x: x1, y: y1, w: w1 } = seg.p1.screen;
    const { x: x2, y: y2, w: w2 } = seg.p2.screen;
    ctx.fillStyle = c.grass; ctx.fillRect(0, y2, W, y1 - y2 + 1);
    const r1 = w1 / 6, r2 = w2 / 6;
    poly(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, c.rumble);
    poly(x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, c.rumble);
    poly(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, c.road);
    const e1 = w1 / 30, e2 = w2 / 30;
    poly(x1 - w1, y1, x1 - w1 + e1, y1, x2 - w2 + e2, y2, x2 - w2, y2, '#fff');
    poly(x1 + w1, y1, x1 + w1 - e1, y1, x2 + w2 - e2, y2, x2 + w2, y2, '#fff');
    if (c.lane) { const l1 = w1 / 36, l2 = w2 / 36; poly(x1 - l1, y1, x1 + l1, y1, x2 + l2, y2, x2 - l2, y2, c.lane); }
    if (seg.start) {
      const cols = 14;
      for (let i = 0; i < cols; i++) {
        if ((i + seg.start) % 2) continue;
        const a = i / cols, b = (i + 1) / cols;
        poly(x1 - w1 + 2 * w1 * a, y1, x1 - w1 + 2 * w1 * b, y1, x2 - w2 + 2 * w2 * b, y2, x2 - w2 + 2 * w2 * a, y2, '#2a1f3d');
      }
    }
    if (seg.fog < 1) {
      ctx.globalAlpha = 1 - seg.fog; ctx.fillStyle = FOG;
      ctx.fillRect(0, y2, W, y1 - y2 + 1); ctx.globalAlpha = 1;
    }
  }

  // Спрайт по перспективе: x,y — точка на земле, scale — масштаб проекции
  function drawSprite(img, worldW, x, y, scale, lift = 0, alpha = 1) {
    const w = worldW * scale * SX;
    if (w < 1.5 || w > W * 5) return null;
    const h = (w * img.height) / img.width;
    const top = y - h - lift * scale * SX;
    if (top > H || x + w / 2 < 0 || x - w / 2 > W) return { w, h, top };
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x - w / 2, top, w, h);
    ctx.globalAlpha = 1;
    return { w, h, top };
  }

  function kartFrame(char, steer, boost, hit, now) {
    const pose = hit ? 'H' : steer < 0 ? 'L' : steer > 0 ? 'R' : 'C';
    const flame = boost ? 1 + (Math.floor(now / 70) % 2) : 0;
    return Art.kart(char, pose, flame);
  }

  function drawKartAt(car, x, y, scale, now, isMe) {
    const boost = isMe ? now < car.boostUntil : car.boost;
    const hit = isMe ? now < car.hitUntil : car.hit;
    const img = kartFrame(car.char, car.steer, boost, hit, now);
    const sp = (isMe ? car.speed : car.speed || 0) / MAX;
    const bounce = sp > 0.05 ? Math.sin(now / 45 + (isMe ? 0 : 2)) * 1.5 * sp + (Math.abs(car.x) > 1 ? Math.random() * 3 : 0) : 0;
    // спрайт карта: линия земли на высоте BY из SH
    const w = KART_W * scale * SX;
    if (w < 2) return;
    const h = (w * Art.SH) / Art.SW;
    const top = y - (h * Art.BY) / Art.SH - bounce;
    ctx.drawImage(img, x - w / 2, top, w, h);
    if (!isMe) {
      const fs = Math.max(11, w * 0.11);
      ctx.font = `800 ${fs}px -apple-system, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = Math.max(3, fs * 0.25); ctx.strokeStyle = '#2a1f3d'; ctx.lineJoin = 'round';
      ctx.strokeText(car.name, x, top + h * 0.06);
      ctx.fillStyle = '#fff'; ctx.fillText(car.name, x, top + h * 0.06);
    }
    if (car.emo && now < car.emo.until) {
      const t = 1 - (car.emo.until - now) / 2200;
      ctx.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1;
      ctx.font = `${Math.max(20, w * 0.3)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(car.emo.e, x, top - w * 0.02 - t * w * 0.15);
      ctx.globalAlpha = 1;
    }
  }

  // фон: небо, солнце, облака, горы и холмы с параллаксом
  const clouds = Array.from({ length: 9 }, (_, i) => ({ x: i / 9 + Math.random() * 0.05, y: 0.08 + Math.random() * 0.22, s: 0.6 + Math.random() * 0.7 }));
  function drawBackground() {
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, HORIZON + 2);
    const sunX = W * 0.78 - (skyOff * 0.05 % W), sunY = HORIZON * 0.3;
    const sg = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, H * 0.2);
    sg.addColorStop(0, 'rgba(255,250,210,.95)'); sg.addColorStop(1, 'rgba(255,250,210,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, HORIZON);
    ctx.fillStyle = '#fff6c4'; ctx.beginPath(); ctx.arc(sunX, sunY, H * 0.05, 0, 7); ctx.fill();

    for (const c of clouds) {
      const span = W * 1.6;
      const x = mod(c.x * span - skyOff * 0.15, span) - W * 0.3;
      const y = HORIZON * c.y, s = c.s * H * 0.045;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, s, 0, 7); ctx.arc(x + s * 1.1, y - s * 0.4, s * 1.2, 0, 7);
      ctx.arc(x + s * 2.3, y, s * 0.95, 0, 7); ctx.rect(x, y, s * 2.3, s * 0.9);
      ctx.fill();
      ctx.fillStyle = 'rgba(160,200,255,.35)';
      ctx.fillRect(x - s * 0.2, y + s * 0.55, s * 2.7, s * 0.35);
    }
    hills(skyOff * 0.3, HORIZON * 0.34, '#c7b4ff', '#b49cf5', 0.004, 0.011);
    hills(skyOff * 0.6, HORIZON * 0.2, '#7fcf86', '#6bbd72', 0.007, 0.017);
  }
  function hills(off, amp, c1, c2, f1, f2) {
    ctx.beginPath(); ctx.moveTo(0, HORIZON + 2);
    for (let x = 0; x <= W + 8; x += 8) {
      const u = x + off;
      const y = HORIZON - amp * (0.55 + 0.3 * Math.sin(u * f1) + 0.15 * Math.sin(u * f2 + 1.7));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, HORIZON + 2); ctx.closePath();
    ctx.fillStyle = c1; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = c2; ctx.stroke();
  }

  function render(now) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 8 * shake);
    drawBackground();
    ctx.fillStyle = COL.light.grass; ctx.fillRect(0, HORIZON, W, H - HORIZON);

    const camZ = me.total - PLAYER_Z;
    const base = Road.findSeg(camZ);
    const basePct = mod(camZ, SEG) / SEG;
    const playerSeg = Road.findSeg(me.total);
    const playerPct = mod(me.total, SEG) / SEG;
    const playerY = lerp(playerSeg.p1.world.y, playerSeg.p2.world.y, playerPct);
    const camY = playerY + CAM_H;
    const camX = me.x * ROAD;
    const cz = mod(camZ, LENGTH);

    let x = 0, dx = -(base.curve * basePct);
    const list = [];
    for (let n = 0; n < DRAW; n++) {
      const seg = Road.segs[(base.index + n) % N];
      const loop = seg.index < base.index ? LENGTH : 0;
      seg.fog = 1 / Math.pow(Math.E, (n / DRAW) * (n / DRAW) * FOG_DENSITY);
      project(seg.p1, camX - x, camY, cz - loop);
      project(seg.p2, camX - x - dx, camY, cz - loop);
      x += dx; dx += seg.curve;
      seg.cars = null;
      list.push(seg);
    }

    // машинки: находим их сегмент относительно камеры
    const cars = [];
    const inGame = mode !== 'menu' && mode !== 'lobby';
    if (inGame) cars.push(me);
    if (inGame && online && other.present) cars.push(other);
    for (const c of cars) {
      const d = c.total - camZ;
      if (d <= 0 || d >= DRAW * SEG - SEG) { c.screen = null; continue; }
      const n = Math.floor((basePct * SEG + d) / SEG);
      const seg = list[n];
      if (!seg) continue;
      const pct = mod(c.total, SEG) / SEG;
      (seg.cars || (seg.cars = [])).push({ c, pct });
    }

    for (let n = DRAW - 1; n >= 0; n--) {
      const seg = list[n];
      const p1 = seg.p1.screen, p2 = seg.p2.screen;
      if (seg.p1.camera.z > CAM_DEPTH) {
        if (p2.y < p1.y) drawSegment(seg);
        const alpha = clamp(seg.fog * 1.6, 0, 1);
        for (const s of seg.sprites) {
          if (s.pick != null && (picked[s.pick] || 0) > now) continue;
          const lift = s.pick != null ? 260 + Math.sin(now / 220 + s.pick) * 60 : 0;
          drawSprite(s.def.img, s.def.w, p1.x + p1.scale * s.o * ROAD * SX, p1.y, p1.scale, lift, alpha);
        }
      }
      if (seg.cars) {
        seg.cars.sort((a, b) => b.c.total - a.c.total);
        for (const { c, pct } of seg.cars) {
          // точная проекция машинки по её позиции (работает и вплотную к камере)
          const d = c.total - camZ;
          if (d < 120) continue;
          const sc = CAM_DEPTH / d;
          const wy = lerp(seg.p1.world.y, seg.p2.world.y, pct);
          const wx = lerp(seg.p1.camera.x, seg.p2.camera.x, pct) + c.x * ROAD;
          drawKartAt(c, W / 2 + sc * wx * SX, HORIZON - sc * (wy - camY) * SX, sc, now, c === me);
        }
      }
    }

    if (inGame && now < me.boostUntil) speedLines(now);
    drawSparks(now);
    if (inGame && online && other.present) offscreenMarker(camZ);
  }

  function speedLines(now) {
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineCap = 'round';
    const cx = W / 2, cy = HORIZON;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + (now / 900);
      const r1 = W * (0.35 + ((now / 4 + i * 97) % 200) / 600);
      const r2 = r1 + W * 0.12;
      ctx.lineWidth = 3 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.7);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2 * 0.7);
      ctx.stroke();
    }
  }

  function drawSparks(now) {
    const cx = W / 2, cy = PLAYER_Y - H * 0.18;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i], t = (now - s.t) / 1000;
      if (t > 0.7) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - t / 0.7;
      ctx.fillStyle = '#ff5c9a';
      const sz = H * 0.03;
      Art.heart(ctx, cx + Math.cos(s.a) * s.v * t * 2, cy + Math.sin(s.a) * s.v * t * 2 - t * 80, sz);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function offscreenMarker(camZ) {
    const d = other.total - me.total;
    const m = Math.round(d / 40);
    let text = null, y;
    if (other.total - camZ <= 0) { text = '▼ ' + other.name + ' ' + m + ' м'; y = H - 18; }
    else if (other.total - camZ >= DRAW * SEG - SEG) { text = '▲ ' + other.name + ' +' + m + ' м'; y = HORIZON - 18; }
    if (!text) return;
    ctx.font = '800 16px -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 24;
    ctx.fillStyle = 'rgba(42,31,61,.75)';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(W / 2 - w / 2, y - 15, w, 30, 15) : ctx.rect(W / 2 - w / 2, y - 15, w, 30); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(text, W / 2, y);
  }

  function updateHud(now) {
    const done = Math.max(0, me.total - START_Z);
    $('hudLap').textContent = Math.min(laps, Math.floor(done / LENGTH) + 1) + '/' + laps;
    let pos = 1;
    if (online && other.present) {
      if (me.finished && other.finished) pos = other.finishTime < me.finishTime ? 2 : 1;
      else if (other.finished) pos = 2;
      else if (!me.finished && other.total > me.total) pos = 2;
    }
    $('hudPos').textContent = online ? pos + '/2' : '—';
    $('hudTime').textContent = fmt(mode === 'countdown' ? 0 : me.finished ? me.finishTime : now - raceStart);
    $('hudSpeed').textContent = Math.round((me.speed / MAX) * 220);
    if (online) {
      const total = laps * LENGTH;
      const pm = clamp((me.total - START_Z) / total, 0, 1), po = clamp((other.total - START_Z) / total, 0, 1);
      $('pMe').style.left = pm * 100 + '%';
      $('pOther').style.left = po * 100 + '%';
    }
  }

  // ---------- Главный цикл ----------
  let last = performance.now(), lastCount = '';
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (mode === 'menu' || mode === 'lobby') {
      me.speed = MAX * 0.4; me.x = lerp(me.x, 0, dt); me.total += me.speed * dt;
    } else {
      if (mode === 'countdown') {
        const left = countdownEnd - now;
        const txt = left > 0 ? String(Math.ceil(left / 1000)) : 'GO!';
        if (txt !== lastCount) {
          const el = $('countdown');
          el.textContent = txt; lastCount = txt;
          el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
        }
        if (left <= 0) {
          mode = 'race'; raceStart = now;
          setTimeout(() => { if (lastCount === 'GO!') show('countdown', false); }, 800);
        }
      }
      stepMe(dt, now);
    }

    const pseg = Road.findSeg(me.total);
    skyOff += pseg.curve * (me.speed / MAX) * dt * 120;
    shake = Math.max(0, shake - dt);

    if (online && mode !== 'menu' && mode !== 'lobby' && now - lastSend > 50) {
      lastSend = now;
      Net.send({ t: 's', tot: Math.round(me.total), x: Math.round(me.x * 1000) / 1000, sp: Math.round(me.speed),
        st: me.steer, b: now < me.boostUntil, h: now < me.hitUntil });
    }
    if (online) updateRemote(now);

    render(now);
    if (mode !== 'menu' && mode !== 'lobby') updateHud(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // для отладки и проверки
  window.__race = { me, other, startSolo: () => $('soloBtn').click(), keys };
})();
