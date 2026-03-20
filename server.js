'use strict';

/**
 * Root entry point for Railway deployment.
 *
 * Loads the full application from backend/src/app.js and starts the
 * HTTP + WebSocket server.  All relative requires inside app.js are
 * resolved relative to that file, so no paths need to change.
 */

const http = require('http');
const { WebSocketServer } = require('ws');

const app = require('./backend/src/app');
const wsManager = require('./backend/src/services/websocket');

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
wsManager.attach(wss);

server.listen(PORT, () => {
  console.log(`HurtDetalUszefaQUALITET API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  console.log(`WebSocket server active on ws://localhost:${PORT}`);
});