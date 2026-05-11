#!/usr/bin/env node
// Express proxy — serves /zalo_verifier*.html + /public/* + proxies everything to OpenClaw
// Required to satisfy Zalo Developer domain verification
// while keeping OpenClaw gateway as the main app

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const fs = require('fs');

const FRONT_PORT = parseInt(process.env.PORT || '8080', 10);
const OPENCLAW_PORT = parseInt(process.env.OPENCLAW_INTERNAL_PORT || '8090', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();

// Trust Railway proxy
app.set('trust proxy', true);

// Serve any file under /public at ROOT path
// e.g. /zalo_verifier_xxx.html -> ./public/zalo_verifier_xxx.html
app.use((req, res, next) => {
  const filePath = path.join(PUBLIC_DIR, req.path);
  if (req.method === 'GET' && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  next();
});

// Proxy everything else to OpenClaw on internal port
const ocProxy = createProxyMiddleware({
  target: `http://127.0.0.1:${OPENCLAW_PORT}`,
  changeOrigin: true,
  ws: true,                                  // WebSocket support (Dashboard uses ws)
  xfwd: true,
  logLevel: 'warn',
  onError: (err, req, res) => {
    console.error('[proxy] error:', err.message);
    if (res && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Upstream OpenClaw not ready: ' + err.message);
    }
  },
});

app.use('/', ocProxy);

const server = app.listen(FRONT_PORT, '0.0.0.0', () => {
  console.log(`[proxy] Listening on 0.0.0.0:${FRONT_PORT}, forwarding to OpenClaw at 127.0.0.1:${OPENCLAW_PORT}`);
  console.log(`[proxy] Static files served from: ${PUBLIC_DIR}`);
  // List static files at startup
  if (fs.existsSync(PUBLIC_DIR)) {
    const files = fs.readdirSync(PUBLIC_DIR);
    files.forEach(f => console.log(`[proxy]   - /${f}`));
  }
});

// Upgrade WebSocket connections explicitly
server.on('upgrade', ocProxy.upgrade);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[proxy] SIGTERM received, closing...');
  server.close(() => process.exit(0));
});
