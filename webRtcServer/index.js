const path = require('path');
const { createServer } = require('http');
const express = require('express');
const { getIO, initIO } = require('./socket');
const os = require('os'); // Import os module to get network details

const app = express();
app.use('/', express.static(path.join(__dirname, 'static')));

const httpServer = createServer(app);
let port = process.env.PORT || 3500;

initIO(httpServer);

// Get local network IP address
const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1'; // Fallback to localhost
};

// Start the server
httpServer.listen(port, () => {
  console.log(`🚀 Server started on:`);
  console.log(`📌 Local:   http://localhost:${port}`);
  console.log(`📡 Network: http://${getLocalIP()}:${port}`);
});

getIO();
