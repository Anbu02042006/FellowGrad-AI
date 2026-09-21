const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');
const errorMiddleware = require('./middleware/errorMiddleware');

const app = express();

// Parse CORS origins
const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:8081', 'http://10.0.2.2:8081', 'http://localhost:8080'];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) return callback(null, true);
    if (
      configuredOrigins.includes('*') ||
      configuredOrigins.includes(origin) ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://10.0.2.2') ||
      origin.startsWith('http://127.0.0.1')
    ) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-goog-api-key'],
};

app.use(cors(corsOptions));

// Body parsers
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '25mb' }));

// Request logging in development
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// Health Check Endpoint (STEP 16)
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'FellowGrad backend is running',
  });
});

// Central API Routes (STEP 10)
app.use('/api', apiRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Central Error Handling Middleware (STEP 9)
app.use(errorMiddleware);

module.exports = {
  app,
  configuredOrigins,
};
