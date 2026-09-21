require('dotenv').config();
const http = require('http');
const { app, configuredOrigins } = require('./app');
const { connectDatabases } = require('./config/database');
const { setupSockets } = require('./sockets/socketHandler');
const { setupLiveVoiceSocket } = require('./sockets/liveVoiceSocket');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1. Initialize databases (PostgreSQL & MongoDB)
    await connectDatabases();

    // 2. Create HTTP server
    const server = http.createServer(app);

    // 3. Initialize WebSocket & Socket.io
    setupSockets(server, configuredOrigins);
    setupLiveVoiceSocket(server);

    // 4. Start listening
    server.listen(PORT, () => {
      console.log('====================================================');
      console.log(`🚀 FellowGrad AI Backend running on port ${PORT}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      console.log(`📡 WebSocket ready on port ${PORT}`);
      console.log('====================================================');
    });

    // Handle graceful shutdown
    const handleShutdown = () => {
      console.log('\n[Server] Shutting down gracefully...');
      server.close(() => {
        console.log('[Server] Closed remaining connections.');
        process.exit(0);
      });
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
  } catch (err) {
    console.error('[Server] Fatal error starting server:', err);
    process.exit(1);
  }
};

startServer();
