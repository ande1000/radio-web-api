// Gerencia o estado da transmissão, ouvintes e chat privado.
class StreamManager {
  constructor() {
    this.listeners = new Map();        // id -> { ws, user }
    this.broadcaster = null;
    this.usuariosChat = new Set();
    this.historicoChat = [];            // { id, de, para, texto, time, role }

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
  addListener(id, ws, user) {
    this.listeners.set(id, { ws, user: user || 'anônimo' });
    this.notificarOuvintes();
    this.notificarMetaBroadcaster();
    this.enviarListaOuvintes();
  }

  removeListener(id) {
    this.listeners.delete(id);
    this.notificarOuvintes();
    this.notificarMetaBroadcaster();
    this.enviarListaOuvintes();
  }

  getListenerCount() {
    return this.listeners.size;
  }

  getListenerNames() {
    const nomes = [];
    for (const { user } of this.listeners.values()) {
      if (user && !nomes.includes(user)) nomes.push(user);
    }
    return nomes;
  }

  // ---- Distribuição de áudio ----
  broadcastAudio(chunk) {
    for (const [id, { ws }] of this.listeners) {
      if (ws.readyState === 1) {
        ws.send(chunk, { binary: true });
      } else {
        this.listeners.delete(id);
      }
    }
  }

  // ---- Chat privado ----
  broadcastChat({ user, text, role, target }) {
    // target = nome do destinatário (ou null = para todos / broadcaster)
    const msg = {
      type: 'chat',
      user,
      text,
      role,
      target: target || null,
      time: Date.now(),
    };
    this.historicoChat.push(msg);
    if (this.historicoChat.length > 500) this.historicoChat.shift();

    const payload = JSON.stringify(msg);

    if (role === 'listener') {
      this.usuariosChat.add(user);
    }

    // Envia para o broadcaster (painel) SEMPRE
    if (this.broadcaster && this.broadcaster.readyState === 1) {
      this.broadcaster.send(payload);
      this.broadcaster.send(JSON.stringify({
        type: 'usuarios',
        lista: ['locutor', ...this.usuariosChat],
      }));
    }

    // Se for mensagem do broadcaster para um listener específico
    if (role === 'broadcaster' && target) {
      for (const [, { ws, user: u }] of this.listeners) {
        if (u === target && ws.readyState === 1) {
          ws.send(payload);
        }
      }
      return;
    }

    // Se for mensagem do broadcaster sem target (pública) → todos
    if (role === 'broadcaster' && !target) {
      for (const [, { ws }] of this.listeners) {
        if (ws.readyState === 1) ws.send(payload);
      }
      return;
    }

    // Se for mensagem de listener → só broadcaster + o próprio listener
    if (role === 'listener') {
      for (const [, { ws, user: u }] of this.listeners) {
        if (u === user && ws.readyState === 1) {
          ws.send(payload);
        }
      }
    }
  }

  enviarHistoricoChat(ws) {
    ws.send(JSON.stringify({
      type: 'historico',
      mensagens: this.historicoChat,
    }));
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
    const payload = JSON.stringify({
      type: 'meta',
      ...this.state,
      listeners: this.getListenerCount(),
    });
    for (const [, { ws }] of this.listeners) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }

  notificarMetaBroadcaster() {
    if (this.broadcaster && this.broadcaster.readyState === 1) {
      this.broadcaster.send(JSON.stringify({
        type: 'meta',
        ...this.state,
        listeners: this.getListenerCount(),
      }));
    }
  }

  // 🔴 Envia lista de nomes de ouvintes pro painel
  enviarListaOuvintes() {
    if (this.broadcaster && this.broadcaster.readyState === 1) {
      this.broadcaster.send(JSON.stringify({
        type: 'ouvintes',
        nomes: this.getListenerNames(),
        total: this.getListenerCount(),
      }));
    }
  }

  notificarOuvintes() {
    this.notifyListenersMeta();
    this.notificarMetaBroadcaster();
  }

  getStatus() {
    return {
      ...this.state,
      listeners: this.getListenerCount(),
      ouvintes: this.getListenerNames(),
      uptime: this.state.startedAt
        ? Math.floor((Date.now() - this.state.startedAt) / 1000)
        : 0,
    };
  }
}

export const streamManager = new StreamManager();
