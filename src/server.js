import http from 'http';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import healthRoutes from './routes/health.js';
import streamRoutes from './routes/stream.js';
import { attachStreamSocket } from './ws/streamSocket.js';

const app = express();

app.use(cors());
app.use(express.json());

// Rotas REST
app.use('/api', healthRoutes);
app.use('/api', streamRoutes);

// Rota raiz — confirma que a API está no ar
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'radio-api',
    endpoints: {
      health: '/api/health',
      status: '/api/stream/status',
      listenInfo: '/api/stream/listen-info',
      ws: '/ws/stream',
    },
  });
});

// Servidor HTTP + WS no mesmo processo
const server = http.createServer(app);
attachStreamSocket(server);

server.listen(config.port, () => {
  console.log(`🚀 Radio API rodando em http://localhost:${config.port}`);
  console.log(`📡 WebSocket em ws://localhost:${config.port}/ws/stream`);
  console.log(`🌍 Ambiente: ${config.env}`);
});