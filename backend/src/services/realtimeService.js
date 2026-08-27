const WebSocket = require('ws');

let wss = null;

function initializeRealtimeServer(server) {
  if (wss) return wss;

  wss = new WebSocket.Server({ server });
  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'connected', message: 'Realtime channel opened' }));
  });

  return wss;
}

function broadcastRealtime(event) {
  if (!wss) return;
  const payload = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

module.exports = { initializeRealtimeServer, broadcastRealtime };