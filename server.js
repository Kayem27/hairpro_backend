require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { generalLimiter } = require('./middleware/rateLimiter');
const { setIO } = require('./services/notificationService');
const logger = require('./services/logger');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['1.1.1.1', '8.8.8.8']);

// Validate required environment variables
const requiredEnvVars = ['MONGO_URL', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`Variables d'environnement manquantes: ${missingVars.join(', ')}`);
  process.exit(1);
}
if (process.env.JWT_SECRET === 'hairpro_secret_key_change_in_production' || process.env.JWT_SECRET.length < 32) {
  console.warn('ATTENTION: JWT_SECRET est faible ou par defaut. Changez-le en production!');
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8001;

const allowedOrigin = process.env.APP_URL || 'http://localhost:5173';

// Security headers
const isProduction = process.env.NODE_ENV === 'production';
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      connectSrc: ["'self'", process.env.APP_URL || 'http://localhost:5173'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'", "https://checkout.stripe.com"],
    }
  } : false,
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// HTTP request logging
app.use(morgan(isProduction ? 'combined' : 'dev'));

// CORS
app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));

// Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.io auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Auth required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user_id = decoded.user_id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  // Join personal room for notifications
  socket.join(`user:${socket.user_id}`);

  // Join conversation rooms
  socket.on('join_conversation', (conversation_id) => {
    socket.join(`conv:${conversation_id}`);
  });

  socket.on('leave_conversation', (conversation_id) => {
    socket.leave(`conv:${conversation_id}`);
  });

  socket.on('disconnect', () => {});
});

// Share io instance with notification service
setIO(io);
// Also make io accessible via app for routes
app.set('io', io);

// Parse JSON for all routes except Stripe webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/api/billing/webhook') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

app.use(generalLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/professionals', require('./routes/professionals'));
app.use('/api/time-slots', require('./routes/timeSlots'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/pro', require('./routes/pro'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/users', require('./routes/users'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    logger.info('MongoDB connecté');
    server.listen(PORT, () => {
      logger.info(`Serveur démarré sur le port ${PORT}`);
    });
  })
  .catch(err => {
    logger.error('Erreur connexion MongoDB', { error: err.message });
    process.exit(1);
  });

module.exports = app;
