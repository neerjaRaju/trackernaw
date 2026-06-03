const { Server } = require('socket.io');
const { verifyAccess } = require('../utils/jwt');
const logger = require('../utils/logger');

let io = null;
let pubClient = null;
let subClient = null;

async function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN || '*', credentials: true },
  });

  // Redis adapter — enables horizontal scaling. Without this, events emitted on
  // one node only reach clients connected to that same node, so the live map
  // breaks the moment we have more than one API replica.
  if (process.env.REDIS_URL && process.env.NODE_ENV !== 'test') {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { createClient } = require('redis');
      pubClient = createClient({ url: process.env.REDIS_URL });
      subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.IO Redis adapter active — multi-node fan-out enabled');
    } catch (e) {
      logger.warn('Could not enable Socket.IO Redis adapter: ' + e.message);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Socket.IO Redis adapter is required in production but failed to initialize');
      }
    }
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('No token'));
    try {
      const decoded = verifyAccess(token);
      socket.user = decoded;
      next();
    } catch (e) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const room = `company:${socket.user.companyId}`;
    socket.join(room);
    socket.join(`user:${socket.user.sub}`);
    logger.info(`Socket connected: ${socket.user.sub} → ${room}`);
    socket.on('disconnect', () => logger.info(`Socket disconnected: ${socket.user.sub}`));
  });

  return io;
}

function emitToCompany(companyId, event, payload) {
  if (!io) return;
  io.to(`company:${companyId}`).emit(event, payload);
}

function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

async function closeSocket() {
  if (!io) return;
  await new Promise((resolve) => io.close(resolve));
  try { await pubClient?.quit(); } catch {}
  try { await subClient?.quit(); } catch {}
  io = null;
}

module.exports = { initSocket, emitToCompany, emitToUser, closeSocket };
