import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { startAiSearchVisibilityLoop } from './src/server/aiSeoVisibility.ts';
import { getExpressApp } from './src/server/app.ts';
import { startChatWatcherLoop } from './src/server/chatWatcher.ts';
import { startCloudflareAutoSnapshotLoop } from './src/server/cloudflareHistory.ts';
import { startCyberSecurityLoop } from './src/server/cyberSecurity.ts';
import { startQaMonitorLoop } from './src/server/qaMonitor.ts';
import { attachRealtimeHub } from './src/server/realtime.ts';
import { verifyEditorToken } from './src/server/repository.ts';

async function startServer() {
  const app = await getExpressApp();

  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/obama') || req.path.startsWith('/studio')) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  const server = http.createServer(app);
  attachRealtimeHub(server, verifyEditorToken);
  startChatWatcherLoop();
  startCloudflareAutoSnapshotLoop();
  startQaMonitorLoop();
  startAiSearchVisibilityLoop();
  startCyberSecurityLoop();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`GitStack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start GitStack server:', err);
  process.exit(1);
});
