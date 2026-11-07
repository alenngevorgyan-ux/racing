// Сеть: прямое соединение двух браузеров через WebRTC (PeerJS).
// Сервер нужен только для "знакомства" — используется бесплатный публичный сервер PeerJS.
const Net = (() => {
  const PREFIX = 'love-race-2p-';
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const PEER_OPTS = {
    debug: 1,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ],
    },
  };

  let peer = null, conn = null;
  const handlers = { message: () => {}, connected: () => {}, closed: () => {}, error: () => {} };

  function on(evt, fn) { handlers[evt] = fn; }

  function makeCode() {
    let s = '';
    for (let i = 0; i < 4; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return s;
  }

  function setupConn(c) {
    conn = c;
    c.on('open', () => handlers.connected());
    c.on('data', (d) => handlers.message(d));
    c.on('close', () => { if (conn === c) { conn = null; handlers.closed(); } });
    c.on('error', (e) => handlers.error(e));
  }

  function host(onReady) {
    destroy();
    const code = makeCode();
    peer = new Peer(PREFIX + code, PEER_OPTS);
    peer.on('open', () => onReady(code));
    peer.on('connection', (c) => {
      if (conn && conn.open) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; }
      setupConn(c);
    });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id') host(onReady); // код занят — пробуем другой
      else handlers.error(e);
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (_) {} });
  }

  function join(code) {
    destroy();
    peer = new Peer(PEER_OPTS);
    peer.on('open', () => setupConn(peer.connect(PREFIX + code.toUpperCase(), { reliable: true })));
    peer.on('error', (e) => handlers.error(e));
  }

  function send(obj) { if (conn && conn.open) conn.send(obj); }
  function connected() { return !!(conn && conn.open); }

  function destroy() {
    const c = conn; conn = null;
    if (c) try { c.close(); } catch (_) {}
    if (peer) try { peer.destroy(); } catch (_) {}
    peer = null;
  }

  return { on, host, join, send, connected, destroy };
})();
