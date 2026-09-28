// Gerencia o estado da transmissão e os ouvintes conectados.
class StreamManager {
  constructor() {
    this.listeners = new Map();
    this.broadcaster = null;
    this.usuariosChat = new Set();

    this.state = {
      live: false,
      startedAt: null,
      title: null,
      bitrate: null,
      codec: 'pcm',
    };
  }

  // ---- Painel (broadcaster) ----
  setBroadcaster(ws) {
    if (this.broadcaster && this.broadcaster !== ws && this.broadcaster.readyState === 1) {
      return false;
    }
    this.broadcaster = ws;
    this.state.live = true;
    this.state.startedAt = Date.now();
    this.notificarOuvintes();
    return true;
  }

  clearBroadcaster(ws) {
    if (this.broadcaster === ws) {
      this.broadcaster = null;
      this.state.live = false;
      this.state.startedAt = null;
      this.notificarOuvintes();
    }
  }

  // ---- Ouvintes ----
  addListener(id, ws) {
    this.listeners.set(id, ws);
    this.notificarOuvintes();
    this.notificarMetaBroadcaster();
  }

  removeListener(id) {
    this.listeners.delete(id);
    this.notificarOuvintes();
    this.notificarMetaBroadcaster();
  }

  getListenerCount() {
    return this.listeners.size;
  }

  // ---- Distribuição de áudio ----
  broadcastAudio(chunk) {
    for (const [id, ws] of this.listeners) {
      if (ws.readyState === 1) {
        ws.send(chunk, { binary: true });
      } else {
        this.listeners.delete(id);
      }
    }
  }

  // ---- Chat ----
  broadcastChat({ user, text, role }) {
    const payload = JSON.stringify({
      type: 'chat',
      user,
      text,
      role,
      time: Date.now(),
    });

    if (user && role === 'listener') {
      this.usuariosChat.add(user);
    }

    for (const [, ws] of this.listeners) {
      if (ws.readyState === 1) ws.send(payload);
    }

    if (this.broadcaster && this.broadcaster.readyState === 1) {
      this.broadcaster.send(payload);
      // envia lista de usuários pro painel
      this.broadcaster.send(JSON.stringify({
        type: 'usuarios',
        lista: ['locutor', ...this.usuariosChat],
      }));
    }
  }

  // ---- Metadados ----
  updateMeta({ title, bitrate, codec, live }) {
    if (title !== undefined) this.state.title = title;
    if (bitrate !== undefined) this.state.bitrate = bitrate;
    if (codec !== undefined) this.state.codec = codec;
    if (live !== undefined) this.state.live = live;
    this.notifyListenersMeta();
  }

  notifyListenersMeta() {
    const payload = JSON.stringify({ type: 'meta', ...this.state, listeners: this.getListenerCount() });
    for (const [, ws] of this.listeners) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }

  // 🔴 Manda contagem de ouvintes pro broadcaster (painel)
  notificarMetaBroadcaster() {
    if (this.broadcaster && this.broadcaster.readyState === 1) {
      this.broadcaster.send(JSON.stringify({
        type: 'meta',
        ...this.state,
        listeners: this.getListenerCount(),
      }));
    }
  }

  // 🔴 Manda pra todos quando muda
  notificarOuvintes() {
    this.notifyListenersMeta();
    this.notificarMetaBroadcaster();
  }

  getStatus() {
    return {
      ...this.state,
      listeners: this.getListenerCount(),
      uptime: this.state.startedAt
        ? Math.floor((Date.now() - this.state.startedAt) / 1000)
        : 0,
    };
  }
}

export const streamManager = new StreamManager();
