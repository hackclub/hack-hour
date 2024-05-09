// WebSockets client for the server
const WebSocket = require('ws');

// WebSockets client
var ws = new WebSocket(`ws://manitej.hackclub.app:44329`);

// When the connection is open
ws.onopen = function () {
  console.log('Connected');

  // Send a message to the server
  ws.send(JSON.stringify({
    type: 'subscribe',
    slackId: 'U04QD71QWS0'
  }));
};

// When the connection is closed
ws.onclose = function () {
  console.log('Disconnected');
};

// When a message is received
ws.onmessage = function (event) {
  console.log('Received:', event.data);
};

// When an error occurs
ws.onerror = function (error) {
  console.error('Error:', error);
};