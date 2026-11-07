// Two-player connection.
// 1) Direct: WebRTC through PeerJS (fast, peer to peer).
// 2) Fallback relay: if the direct link does not open in a few seconds (strict NAT, mobile networks,
//    different providers), both sides switch to relaying messages through public MQTT brokers over
//    WebSocket. No account, no server of our own. Both brokers are used at once; duplicates are dropped.
const Net = (() => {
  const PREFIX = 'ember-tide-duo-';        // PeerJS id prefix for this game
  const TOPIC = 'dvoe-duo-v1';             // relay namespace for this game
  const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
  const P2P_WAIT = 6000;
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const PEER_OPTS = {
    debug: 1,
    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] },
  };
  const handlers = { message: () => {}, connected: () => {}, closed: () => {}, error: () => {}, status: () => {} };
  const on = (evt, fn) => { handlers[evt] = fn; };
  const rid = () => Math.random().toString(36).slice(2, 10);

  let peer = null, conn = null, role = null, code = '', me = rid(), partner = null;
  let mode = null, open = false;
  let clients = [], seq = 0, seen = new Set(), lastHeard = 0, hbTimer = 0, knockTimer = 0, giveUpTimer = 0, readyTimer = 0;

  const makeCode = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

  // ---------------- relay over MQTT
  function relayStart() {
    if (clients.length || typeof mqtt === 'undefined') return;
    const inbox = `${TOPIC}/${code}/${role === 'host' ? 'h' : 'g'}`;
    for (const url of BROKERS) {
      try {
        const c = mqtt.connect(url, { connectTimeout: 8000, reconnectPeriod: 3000, keepalive: 20, clean: true, clientId: 'kd_' + rid() });
        c.on('connect', () => c.subscribe(inbox));
        c.on('message', (_t, buf) => onRelay(buf));
        c.on('error', () => {});
        clients.push(c);
      } catch (_) {}
    }
  }
  function relayPub(obj) {
    const msg = JSON.stringify({ i: me, s: ++seq, d: obj });
    const t = `${TOPIC}/${code}/${role === 'host' ? 'g' : 'h'}`;
    for (const c of clients) if (c.connected) c.publish(t, msg);
  }
  function onRelay(buf) {
    let m;
    try { m = JSON.parse(buf.toString()); } catch (_) { return; }
    if (!m || m.i === me) return;
    const key = m.i + ':' + m.s;
    if (seen.has(key)) return;
    seen.add(key);
    if (seen.size > 800) seen = new Set([...seen].slice(-400));
    if (m.i === partner) lastHeard = Date.now();
    const d = m.d;
    if (d && d.__net) return control(d, m.i);
    if (open && mode === 'relay' && m.i === partner) handlers.message(d);
  }
  function control(d, from) {
    if (d.__net === 'knock' && role === 'host') {
      if (open && (mode === 'p2p' || partner !== from)) return;   // already playing with someone
      partner = from;
      relayPub({ __net: 'welcome', to: from });
      if (!open) { mode = 'relay'; becomeOpen(); }
    } else if (d.__net === 'welcome' && role === 'guest' && d.to === me && !open) {
      partner = from; mode = 'relay';
      becomeOpen();
    } else if (d.__net === 'bye' && from === partner && mode === 'relay') {
      drop();
    }
  }
  function knock() {
    if (open) return;
    handlers.status('relay');
    relayPub({ __net: 'knock' });
    clearInterval(knockTimer);
    knockTimer = setInterval(() => { if (open) clearInterval(knockTimer); else relayPub({ __net: 'knock' }); }, 1200);
    clearTimeout(giveUpTimer);
    giveUpTimer = setTimeout(() => { if (!open) { clearInterval(knockTimer); handlers.error({ type: 'peer-unavailable' }); } }, 20000);
  }

  // ---------------- common
  function becomeOpen() {
    open = true; lastHeard = Date.now();
    clearInterval(knockTimer); clearTimeout(giveUpTimer);
    clearInterval(hbTimer);
    hbTimer = setInterval(() => {
      if (mode !== 'relay') return;
      relayPub({ __net: 'hb' });
      if (Date.now() - lastHeard > 12000) drop();
    }, 2000);
    handlers.status(mode);
    handlers.connected();
  }
  function drop() {
    if (!open) return;
    open = false; mode = null; partner = null;
    clearInterval(hbTimer);
    handlers.closed();
  }

  // ---------------- direct (PeerJS)
  function setupConn(c) {
    c.on('open', () => {
      if (open) { try { c.close(); } catch (_) {} return; }   // relay won the race
      conn = c; mode = 'p2p';
      becomeOpen();
    });
    c.on('data', (d) => { if (mode === 'p2p' && conn === c) handlers.message(d); });
    c.on('close', () => { if (conn === c && mode === 'p2p') { conn = null; drop(); } });
    c.on('error', () => {});
  }

  function host(onReady) {
    destroy();
    role = 'host'; code = makeCode();
    let ready = false;
    const done = () => { if (ready) return; ready = true; clearTimeout(readyTimer); relayStart(); onReady(code); };
    if (typeof Peer !== 'undefined') {
      peer = new Peer(PREFIX + code, PEER_OPTS);
      peer.on('open', done);
      peer.on('connection', (c) => {
        if (open) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; }
        setupConn(c);
      });
      peer.on('error', (e) => { if (e.type === 'unavailable-id' && !ready) { try { peer.destroy(); } catch (_) {} code = makeCode(); peer = new Peer(PREFIX + code, PEER_OPTS); peer.on('open', done); } });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (_) {} });
    }
    readyTimer = setTimeout(done, 4000);   // the PeerJS server is unreachable: run on the relay alone
  }

  function join(c0) {
    destroy();
    role = 'guest'; code = c0.toUpperCase();
    relayStart();
    handlers.status('direct');
    if (typeof Peer !== 'undefined') {
      peer = new Peer(PEER_OPTS);
      peer.on('open', () => setupConn(peer.connect(PREFIX + code, { reliable: true })));
      peer.on('error', () => { if (!open) knock(); });
    }
    clearTimeout(giveUpTimer);
    giveUpTimer = setTimeout(() => { if (!open) knock(); }, P2P_WAIT);
  }

  function send(obj) {
    if (!open) return;
    if (mode === 'p2p' && conn && conn.open) conn.send(obj);
    else if (mode === 'relay') relayPub(obj);
  }
  const connected = () => open;

  function destroy() {
    if (open && mode === 'relay') relayPub({ __net: 'bye' });
    open = false; mode = null; partner = null;
    clearInterval(hbTimer); clearInterval(knockTimer); clearTimeout(giveUpTimer); clearTimeout(readyTimer);
    const c = conn; conn = null;
    if (c) try { c.close(); } catch (_) {}
    if (peer) try { peer.destroy(); } catch (_) {}
    peer = null;
    const cl = clients; clients = [];
    setTimeout(() => { for (const x of cl) try { x.end(true); } catch (_) {} }, 200);
    me = rid(); seen = new Set();
  }

  return { on, host, join, send, connected, destroy, mode: () => mode };
})();
