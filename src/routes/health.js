import { Router } from 'express';
import { streamManager } from '../core/streamManager.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'radio-api',
    timestamp: new Date().toISOString(),
    stream: streamManager.getStatus(),
  });
});

export default router;