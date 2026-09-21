const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const NotificationService = require('../services/notificationService');

const JWT_SECRET = process.env.JWT_SECRET || '404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970';

const setupSockets = (httpServer, allowedOrigins = []) => {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    maxHttpBufferSize: 1e7, // 10MB
  });

  // Optional socket authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
      } catch (err) {
        console.warn(`[Socket] Authentication failed for socket ${socket.id}: ${err.message}`);
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id} (User: ${socket.user?.userId || 'anonymous'})`);

    // Allow user to join personal room for notifications
    if (socket.user?.userId) {
      socket.join(`user:${socket.user.userId}`);
    }

    socket.on('join_user_room', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`[Socket] Socket ${socket.id} joined room user:${userId}`);
      }
    });

    socket.on('join_conversation', (conversationId) => {
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
        console.log(`[Socket] Socket ${socket.id} joined conversation:${conversationId}`);
      }
    });

    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    socket.on('voice_audio_stream', (data) => {
      // Echo or broadcast real-time audio chunk to conversation room
      if (data.conversationId) {
        socket.to(`conversation:${data.conversationId}`).emit('voice_audio_chunk', data);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  // Connect socket emitter to NotificationService
  NotificationService.setSocketEmitter((room, event, data) => {
    io.to(room).emit(event, data);
  });

  return io;
};

module.exports = {
  setupSockets,
};
