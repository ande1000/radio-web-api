import http from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import healthRoutes from './routes/health.js';
import streamRoutes from './routes/stream.js';
import { attachStreamSocket } from './ws/streamSocket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

// ---------- Rotas REST ----------
app.use('/api', healthRoutes);
app.use('/api', streamRoutes);

// ---------- Rota raiz: confirma que a API está no ar ----------
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'radio-api',
    endpoints: {
      health: '/api/health',
      status: '/api/stream/status',
      listenInfo: '/api/stream/listen-info',
      ws: '/ws/stream',
      painel: '/painel',
      app: '/app',
    },
  });
});

// ---------- Servir arquivos estáticos da pasta public/ ----------
const publicDir = path.join(__dirname, '..', 'public');

app.get('/painel', (req, res) => {
  res.sendFile(path.join(publicDir, 'painel.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Serve qualquer outro arquivo da pasta public/ (css, js, imagens, etc.)
app.use(express.static(publicDir));

// ---------- Servidor HTTP + WebSocket ----------
const server = http.createServer(app);
attachStreamSocket(server);

server.listen(config.port, () => {
  console.log(`🚀 Radio API rodando em http://localhost:${config.port}`);
  console.log(`📡 WebSocket em ws://localhost:${config.port}/ws/stream`);
  console.log(`🎛️  Painel: http://localhost:${config.port}/painel`);
  console.log(`📱 App: http://localhost:${config.port}/app`);
  console.log(`🌍 Ambiente: ${config.env}`);
});
