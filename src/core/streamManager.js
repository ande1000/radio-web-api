// Gerencia o estado da transmissão e os ouvintes conectados.
class StreamManager {
  constructor() {
    this.listeners = new Map();
    this.broadcaster = null;

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
    if (this.broadcaster && this.broadcaster !== ws) return false;
    this.broadcaster = ws;
    this.state.live = true;
    this.state.startedAt = Date.now();
    return true;
  }

  clearBroadcaster(ws) {
    if (this.broadcaster === ws) {
      this.broadcaster = null;
      this.state.live = false;
      this.state.startedAt = null;
    }
  }

  // ---- Ouvintes ----
  addListener(id, ws) {
    this.listeners.set(id, ws);
  }

  removeListener(id) {
    this.listeners.delete(id);
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

  // ---- Chat (painel ↔ ouvintes) ----
  broadcastChat({ user, text, role }) {
    const payload = JSON.stringify({
      type: 'chat',
      user,
      text,
      role,
      time: Date.now(),
    });

    for (const [, ws] of this.listeners) {
      if (ws.readyState === 1) ws.send(payload);
    }

    if (this.broadcaster && this.broadcaster.readyState === 1) {
      this.broadcaster.send(payload);
    }
  }

  // ---- Metadados ----
  updateMeta({ title, bitrate, codec }) {
    if (title !== undefined) this.state.title = title;
    if (bitrate !== undefined) this.state.bitrate = bitrate;
    if (codec !== undefined) this.state.codec = codec;
    this.notifyListenersMeta();
  }

  notifyListenersMeta() {
    const payload = JSON.stringify({ type: 'meta', ...this.state });
    for (const [, ws] of this.listeners) {
      if (ws.readyState === 1) ws.send(payload);
    }
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