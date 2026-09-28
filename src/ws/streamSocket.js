import { WebSocketServer } from 'ws';
import { streamManager } from '../core/streamManager.js';
import { config } from '../config.js';
import { randomUUID } from 'crypto';

export function attachStreamSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  // ---------- Upgrade manual: valida URL + token ----------
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== '/ws/stream') {
      socket.destroy();
      return;
    }

    const role = url.searchParams.get('role');
    const token = url.searchParams.get('token');
    const user = url.searchParams.get('user') || 'anônimo';

    if (role === 'broadcaster' && token !== config.streamToken) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.role = role;
      ws.user = user;
      ws.id = randomUUID();
      ws.isAlive = true;
      wss.emit('connection', ws, req);
    });
  });

  // ---------- Heartbeat ----------
  const intervaloHeartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(intervaloHeartbeat));

  // ---------- Conexão ----------
  wss.on('connection', (ws) => {
    ws.on('pong', () => { ws.isAlive = true; });

    // ============ BROADCASTER (painel) ============
    if (ws.role === 'broadcaster') {
      const ok = streamManager.setBroadcaster(ws);
      if (!ok) {
        ws.send(JSON.stringify({ type: 'error', message: 'Já existe transmissão ativa' }));
        ws.close();
        return;
      }

      console.log('🎙️  Broadcaster conectado');
      ws.send(JSON.stringify({ type: 'ready', role: 'broadcaster' }));
      streamManager.notifyListenersMeta();
      streamManager.enviarListaOuvintes();
      streamManager.enviarHistoricoChat(ws);

      ws.on('message', (data, isBinary) => {
        if (isBinary) {
          streamManager.broadcastAudio(data);
          return;
        }

        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === 'meta') {
            streamManager.updateMeta(msg);
          }

          if (msg.type === 'chat') {
            streamManager.broadcastChat({
              user: msg.user || 'locutor',
              text: msg.text,
              role: 'broadcaster',
              target: msg.target || null,
            });
          }
        } catch (err) {
          console.warn('Mensagem WS inválida (broadcaster):', err.message);
        }
      });

      ws.on('close', () => {
        console.log('🎙️  Broadcaster desconectado');
        streamManager.clearBroadcaster(ws);
        streamManager.notifyListenersMeta();
      });
    }

    // ============ LISTENER (app ouvinte) ============
    if (ws.role === 'listener') {
      streamManager.addListener(ws.id, ws, ws.user);
      console.log(`👤 Ouvinte conectado: ${ws.user} (total: ${streamManager.getListenerCount()})`);

      ws.send(JSON.stringify({ type: 'meta', ...streamManager.getStatus() }));
      streamManager.enviarHistoricoChat(ws);

      ws.on('message', (data, isBinary) => {
        if (isBinary) return;
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'chat') {
            streamManager.broadcastChat({
              user: ws.user || msg.user || 'ouvinte',
              text: msg.text,
              role: 'listener',
            });
          }
        } catch (err) {
          console.warn('Mensagem WS inválida (listener):', err.message);
        }
      });

      ws.on('close', () => {
        streamManager.removeListener(ws.id);
        console.log(`👤 Ouvinte saiu: ${ws.user} (total: ${streamManager.getListenerCount()})`);
        streamManager.notifyListenersMeta();
      });
    }

    ws.on('error', (err) => console.error('WS erro:', err.message));
  });

  return wss;
}
