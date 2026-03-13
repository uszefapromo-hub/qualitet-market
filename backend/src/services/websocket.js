'use strict';

/**
 * Lightweight WebSocket broadcast manager for Live Commerce.
 *
 * Usage (production/dev):
 *   const wsManager = require('./websocket');
 *   wsManager.attach(wss);          // wss = new WebSocketServer(...)
 *   wsManager.broadcast(streamId, payload);
 *
 * In test environment the attach() is never called, so broadcast() is a no-op.
 */

// streamId → Set<WebSocket>
const rooms = new Map();

let _attached = false;

/**
 * Attach to an existing WebSocketServer instance.
 * Handles client join/leave for stream rooms.
 * @param {import('ws').WebSocketServer} wss
 */
function attach(wss) {
  _attached = true;

  wss.on('connection', (ws, req) => {
    // Expect the client to send { type: 'join', streamId } as the first message
    let streamId = null;

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch (_e) {
        return;
      }

      if (msg.type === 'join' && msg.streamId) {
        // Leave previous room if any
        if (streamId && rooms.has(streamId)) {
          rooms.get(streamId).delete(ws);
        }
        streamId = msg.streamId;
        if (!rooms.has(streamId)) {
          rooms.set(streamId, new Set());
        }
        rooms.get(streamId).add(ws);
      }
    });

    ws.on('close', () => {
      if (streamId && rooms.has(streamId)) {
        rooms.get(streamId).delete(ws);
        if (rooms.get(streamId).size === 0) {
          rooms.delete(streamId);
        }
      }
    });

    ws.on('error', () => {
      if (streamId && rooms.has(streamId)) {
        rooms.get(streamId).delete(ws);
      }
    });
  });
}

/**
 * Broadcast a JSON payload to all clients subscribed to a stream room.
 * @param {string} streamId
 * @param {object} payload
 */
function broadcast(streamId, payload) {
  if (!_attached) return;
  const room = rooms.get(streamId);
  if (!room || room.size === 0) return;
  const data = JSON.stringify(payload);
  for (const ws of room) {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(data);
    }
  }
}

/**
 * Returns the number of connected clients for a stream (viewer count helper).
 * @param {string} streamId
 * @returns {number}
 */
function getViewerCount(streamId) {
  const room = rooms.get(streamId);
  return room ? room.size : 0;
}

module.exports = { attach, broadcast, getViewerCount };
