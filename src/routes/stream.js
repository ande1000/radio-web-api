import { Router } from 'express';
import { streamManager } from '../core/streamManager.js';
import { config } from '../config.js';

const router = Router();

// Middleware simples para proteger rotas do painel
function requireToken(req, res, next) {
  const token = req.headers['x-stream-token'];
  if (token !== config.streamToken) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  next();
}

// Painel consulta o estado
router.get('/stream/status', (req, res) => {
  res.json(streamManager.getStatus());
});

// Painel pede "permissão" para iniciar (a conexão WS real faz o resto)
router.post('/stream/start', requireToken, (req, res) => {
  if (streamManager.broadcaster) {
    return res.status(409).json({ error: 'Já existe uma transmissão ativa' });
  }
  res.json({
    ok: true,
    message: 'Pronto para conectar via WebSocket em /ws/stream (modo broadcaster)',
  });
});

// Painel encerra
router.post('/stream/stop', requireToken, (req, res) => {
  if (streamManager.broadcaster) {
    streamManager.clearBroadcaster(streamManager.broadcaster);
  }
  res.json({ ok: true });
});

// Ouvinte consulta como escutar
router.get('/stream/listen-info', (req, res) => {
  res.json({
    live: streamManager.state.live,
    title: streamManager.state.title,
    codec: streamManager.state.codec,
    wsPath: '/ws/stream?role=listener',
  });
});

export default router;