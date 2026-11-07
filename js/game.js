(() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
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
  let myChar = store.get('char', Art.CHARS[0].id);
  if (!Art.CHARS.some((c) => c.id === myChar)) myChar = Art.CHARS[0].id;
  let trackId = store.get('track', Tracks.list[0].id);
  if (!Tracks.list.some((t) => t.id === trackId)) trackId = Tracks.list[0].id;
  let T = Tracks.get(trackId);

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
    car.speed = 0; car.steer = 0; car.boostUntil = 0; car.hitUntil = 0; car.nitro = 0;
    car.finished = false; car.finishTime = 0;
  }

  // ---------- Ввод ----------
  const keys = {};
  const touch = { up: false, down: false, left: false, right: false };
  const typing = () => ['INPUT', 'SELECT'].includes(document.activeElement && document.activeElement.tagName);
  addEventListener('keydown', (e) => {
    if (typing()) return;
    if (!keys[e.code] && ['ShiftLeft', 'ShiftRight', 'KeyE', 'KeyN', 'KeyX'].includes(e.code)) useNitro(performance.now());
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    const emo = { Digit1: '❤️', Digit2: '😘', Digit3: '😂', Digit4: '😤' }[e.code];
    if (emo && inGame()) sendEmote(emo);
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

  function stepMe(dt, now) {
    const seg = T.findSeg(me.total);
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
    const maxS = MAX * (boosting ? 1.4 : 1);
    if (mode === 'race' || mode === 'done') {
      if (inp.up) me.speed += ACCEL * (boosting ? 2.5 : 1) * dt;
      else if (inp.down) me.speed += BRAKE * dt;
      else me.speed += DECEL * dt;
      if (boosting && !inp.down) me.speed += ACCEL * 1.5 * dt;
    } else me.speed = 0;

    if ((me.x < -1 || me.x > 1) && me.speed > OFF_LIMIT && !boosting) me.speed += OFF_DECEL * dt;
    if (me.speed > maxS) me.speed += (maxS - me.speed) * Math.min(1, 1.5 * dt);
    me.speed = clamp(me.speed, 0, MAX * 1.4);
    me.x = clamp(me.x, -2.6, 2.6);

    if (mode === 'race') {
      for (const s of [seg, T.findSeg(me.total + SEG)]) for (const sp2 of s.sprites) {
        if (sp2.nitro != null) {
          if ((pickedN[sp2.nitro] || 0) > now || me.nitro >= NITRO_MAX) continue;
          if (overlap(me.x, KART_U, sp2.o, (sp2.def.w / ROAD) * 0.9)) {
            pickedN[sp2.nitro] = now + NITRO_RESPAWN;
            me.nitro++;
            updateNitroBtn();
            sparkBurst(me.total + 300, sp2.o, '#bfe4ff');
            showBanner('+НИТРО', '#7cc4ff', 900);
          }
          continue;
        }
        if (!sp2.def.hit || hitNow) continue;
        if (overlap(me.x, KART_U, sp2.o, (sp2.def.w / ROAD) * sp2.def.hit)) {
          crash(now, sp2.def === Art.S.cone ? 0.35 : 0.12);
          me.x += me.x < sp2.o ? -0.08 : 0.08;
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
        if (lap < laps) showBanner(lap === laps - 1 ? 'ПОСЛЕДНИЙ КРУГ' : 'КРУГ ' + (lap + 1), '#ffd84a', 1600);
      }
      if (me.total - T.START_Z >= laps * T.LENGTH) finish(now);
    }
  }

  function collideWithOther(now) {
    if (!online || !other.present) return;
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
      cur = k < 0.5 ? a : b;
    } else {
      cur = s[s.length - 1];
      other.total = cur.tot + cur.sp * (clamp(rt - cur.t, 0, 250) / 1000);
      other.x = cur.x;
    }
    other.speed = cur.sp; other.steer = cur.st; other.boost = cur.b; other.hit = cur.h;
  }

  // ---------- Сеть ----------
  let lastSend = 0;
  Net.on('connected', () => {
    online = true;
    Net.send({ t: 'hello', name: myName, char: myChar });
    if (isHost) Net.send({ t: 'track', id: trackId });
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
      case 'track': if (!isHost) { setTrack(m.id, false); renderLobby(); } break;
      case 'go': laps = m.laps || 3; setTrack(m.track || trackId, false); startCountdown(); break;
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
  function showBanner(text, color, ms) { banner = { text, color, t0: performance.now(), ms }; }

  // портреты в меню — уменьшаем и растягиваем пиксельно (ретро-вид)
  const lowres = (src, w) => {
    const h = Math.round((w * src.height) / src.width);
    return Art.mk(w, h, (g) => { g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h); }).toDataURL();
  };
  const portraitURL = {};
  const portraitSrc = (id) => portraitURL[id] || (portraitURL[id] = lowres(Art.portrait(id), 78));

  const nameInput = $('nameInput');
  nameInput.value = myName;
  nameInput.addEventListener('input', () => { myName = nameInput.value.trim(); store.set('name', myName); });

  function renderChars() {
    const box = $('chars');
    box.innerHTML = '';
    for (const c of Art.CHARS) {
      const b = document.createElement('button');
      b.className = 'char' + (c.id === myChar ? ' sel' : '');
      b.innerHTML = '<img alt=""><span></span>';
      b.querySelector('img').src = portraitSrc(c.id);
      b.querySelector('span').textContent = c.name;
      b.onclick = () => { myChar = c.id; store.set('char', c.id); renderChars(); };
      box.appendChild(b);
    }
  }
  renderChars();

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
        b.disabled = boxId === 'lobbyTracks' && !isHost;
        b.onclick = () => { setTrack(t.id, true); if (online && isHost) Net.send({ t: 'track', id: t.id }); };
        box.appendChild(b);
      }
    }
  }
  function setTrack(id, save) {
    if (!Tracks.list.some((t) => t.id === id)) return;
    trackId = id; T = Tracks.get(id);
    if (save) store.set('track', id);
    renderTracks();
  }
  renderTracks();

  function ensureName() {
    if (!myName) myName = Art.charById(myChar).name;
    me.name = myName; me.char = myChar;
  }

  const params = new URLSearchParams(location.search);
  const inviteCode = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (inviteCode) { show('joinBlock', true); show('hostBlock', false); show('trackBlock', false); $('inviteCode').textContent = inviteCode; }

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
    renderTracks();
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
    $('startBtn').disabled = !other.present || !isHost;
    show('startBtn', isHost);
    show('lapsLabel', isHost);
    $('lobbyStatus').textContent = !other.present ? (isHost ? 'Ждём второго игрока…' : 'Подключаемся…')
      : isHost ? 'Все на месте! Выбери трассу и жми старт' : 'Трассу выбирает ' + other.name + '. Ждём старта…';
  }

  $('copyBtn').onclick = async () => {
    const v = $('shareLink').value;
    try { await navigator.clipboard.writeText(v); } catch (_) { $('shareLink').select(); document.execCommand('copy'); }
    toast('Ссылка скопирована');
  };
  $('startBtn').onclick = () => { laps = parseInt($('lapsSelect').value, 10) || 3; Net.send({ t: 'go', laps, track: trackId }); startCountdown(); };
  $('leaveBtn').onclick = goMenu;
  $('menuBtn').onclick = goMenu;
  $('againBtn').onclick = () => {
    if (online) {
      if (!Net.connected()) { toast('Соединение потеряно'); return goMenu(); }
      Net.send({ t: 'go', laps, track: trackId });
    }
    startCountdown();
  };

  function goMenu() {
    Net.destroy();
    online = false; other.present = false; mode = 'menu';
    show('menu', true); show('lobby', false); show('result', false);
    for (const id of ['emotes', 'touch']) show(id, false);
    $('hostBtn').disabled = false; $('hostBtn').textContent = 'Создать комнату';
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
    lapTimes.push(now - lapStart);
    if (online) Net.send({ t: 'fin', time: me.finishTime });
    mode = 'done';
    show('touch', false);
    showBanner('ФИНИШ!', '#ffffff', 1800);
    setTimeout(renderResult, 900);
  }

  function fmt(ms) {
    const s = ms / 1000, m = Math.floor(s / 60), r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
  }

  function renderResult() {
    if (mode !== 'done') return;
    show('result', true);
    const rows = [{ name: me.name + ' (ты)', char: me.char, t: me.finishTime, f: true, me: true }];
    if (online) rows.push({ name: other.name, char: other.char, t: other.finishTime, f: other.finished });
    rows.sort((a, b) => (a.f === b.f ? a.t - b.t : a.f ? -1 : 1));
    const box = $('resultTable');
    box.innerHTML = '';
    rows.forEach((r, i) => box.appendChild(playerRow((i === 0 && r.f ? '🏆 ' : '') + r.name, r.char, r.f ? fmt(r.t) : 'в пути…', i === 0)));
    $('resultTitle').textContent = !online ? 'ФИНИШ ' + fmt(me.finishTime) : rows[0].me ? 'ПОБЕДА!' : 'Победа за ' + other.name;
    const best = Math.min(...lapTimes);
    $('resultNote').textContent = (lapTimes.length ? 'Лучший круг: ' + fmt(best) + '. ' : '') +
      (online && !other.finished ? other.name + ' ещё едет — подбодри смайликом!' : '');
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

  // PS1-постобработка: 15-битный цвет + упорядоченный дизеринг 4×4
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const LUT = BAYER.map((b) => {
    const off = (b / 16 - 0.5) * 8;
    const t = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) t[v] = (Math.min(255, Math.max(0, Math.round(v + off))) & 248) | 4;
    return t;
  });
  function ps1Pass() {
    const img = ctx.getImageData(0, 0, W, H);
    const a = img.data;
    for (let y = 0; y < H; y++) {
      const row = (y & 3) * 4;
      let i = y * W * 4;
      for (let x = 0; x < W; x++, i += 4) {
        const t = LUT[row + (x & 3)];
        a[i] = t[a[i]]; a[i + 1] = t[a[i + 1]]; a[i + 2] = t[a[i + 2]];
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  let CAM_DEPTH = 1, PLAYER_Z = 1000;
  function project(p, camX, camY, camZ) {
    p.camera.x = -camX; p.camera.y = p.world.y - camY; p.camera.z = p.world.z - camZ;
    const s = (p.screen.scale = CAM_DEPTH / p.camera.z);
    p.screen.x = W / 2 + s * p.camera.x * SX;
    p.screen.y = HORIZON - s * p.camera.y * SX;
    p.screen.w = s * ROAD * SX;
  }
  function quad(x1, y1, x2, y2, x3, y3, x4, y4, c) {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
  }
  function drawSegment(seg) {
    const c = seg.c;
    const { x: x1, y: y1, w: w1 } = seg.p1.screen;
    const { x: x2, y: y2, w: w2 } = seg.p2.screen;
    ctx.fillStyle = c.grass; ctx.fillRect(0, y2, W, y1 - y2 + 1);
    const r1 = w1 / 7, r2 = w2 / 7;
    quad(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, c.rumble);
    quad(x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, c.rumble);
    quad(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, c.road);
    const e1 = w1 / 32, e2 = w2 / 32;
    quad(x1 - w1, y1, x1 - w1 + e1, y1, x2 - w2 + e2, y2, x2 - w2, y2, c.edge);
    quad(x1 + w1, y1, x1 + w1 - e1, y1, x2 + w2 - e2, y2, x2 + w2, y2, c.edge);
    if (c.lane) { const l1 = w1 / 40, l2 = w2 / 40; quad(x1 - l1, y1, x1 + l1, y1, x2 + l2, y2, x2 - l2, y2, c.lane); }
    if (seg.start) {
      const cols = 12;
      for (let i = 0; i < cols; i++) {
        if ((i + seg.start) % 2) continue;
        const a = i / cols, b = (i + 1) / cols;
        quad(x1 - w1 + 2 * w1 * a, y1, x1 - w1 + 2 * w1 * b, y1, x2 - w2 + 2 * w2 * b, y2, x2 - w2 + 2 * w2 * a, y2, '#1c1c22');
      }
    }
    if (seg.fog < 1) {
      ctx.globalAlpha = 1 - seg.fog; ctx.fillStyle = T.def.fog;
      ctx.fillRect(0, y2, W, y1 - y2 + 1); ctx.globalAlpha = 1;
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

  function drawKartAt(car, x, y, scale, now, isMe) {
    const boost = isMe ? now < car.boostUntil : car.boost;
    const hit = isMe ? now < car.hitUntil : car.hit;
    const pose = hit ? 'H' : car.steer < 0 ? 'L' : car.steer > 0 ? 'R' : 'C';
    const img = Art.kart(car.char, pose, boost ? 1 + (Math.floor(now / 60) % 2) : 0);
    const sp = (car.speed || 0) / MAX;
    const rough = Math.abs(car.x) > 1 ? 1.2 : 0.4;
    const bounce = sp > 0.05 ? Math.round(Math.sin(now / 38 + (isMe ? 0 : 2)) * rough * sp) : 0;
    const w = KART_W * scale * SX;
    if (w < 2) return;
    const h = (w * Art.SH) / Art.SW;
    const top = y - (h * Art.BY) / Art.SH - bounce;
    ctx.drawImage(img, x - w / 2, top, w, h);
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

  function render(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const sx = shake > 0 ? Math.round((Math.random() - 0.5) * 6 * shake) : 0;
    const sy = shake > 0 ? Math.round((Math.random() - 0.5) * 4 * shake) : 0;
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
        for (const s of seg.sprites) {
          let lift = 0;
          if (s.nitro != null) {
            if ((pickedN[s.nitro] || 0) > now) continue;
            lift = 220 + Math.sin(now / 260 + s.nitro) * 50;
          }
          drawSprite(s.def.img, s.def.w, p1.x + p1.scale * s.o * ROAD * SX, p1.y, p1.scale, lift, alpha);
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
    ps1Pass();
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
  const headImg = (id) => headSmall[id] || (headSmall[id] = (() => { const src = Art.head(id); return Art.mk(18, 21, (g) => g.drawImage(src, 0, 0, 18, 21)); })());

  function drawHud(now, camZ) {
    const done = Math.max(0, me.total - T.START_Z);
    const lap = Math.min(laps, Math.floor(done / T.LENGTH) + 1);
    text('КРУГ', 6, 6, 8, '#ffd84a');
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
    text('КМ/Ч', W - 8, H - 12, 8, '#ffd84a', 'right');
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
      if (other.total - camZ <= 60) text('▼ ' + other.name + ' ' + m + 'м', W / 2, H - 14, 8, '#ffb0c8', 'center');
      else if (other.total - camZ >= DRAW * SEG - SEG) text('▲ ' + other.name + ' +' + m + 'м', W / 2, HORIZON - 14, 8, '#ffb0c8', 'center');
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
        st: me.steer, b: now < me.boostUntil, h: now < me.hitUntil });
    }
    if (online) updateRemote(now);

    render(now);
    requestAnimationFrame(frame);
  }
  const startLoop = () => requestAnimationFrame(frame);
  (document.fonts && document.fonts.load ? document.fonts.load('8px "Press Start 2P"').catch(() => {}) : Promise.resolve()).then(startLoop);

  window.__race = { me, other, startSolo: () => $('soloBtn').click(), keys, setTrack: (id) => setTrack(id, false) };
})();
