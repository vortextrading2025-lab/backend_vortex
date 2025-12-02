require('express-async-errors');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

// Import modules
const authModule = require('./modules/auth');
const userModule = require('./modules/user');
const adminModule = require('./modules/admin');
const contractModule = require('./modules/contract');
const loggingModule = require('./modules/logging');
const errorHandler = require('./middleware/errorHandler');
const rateLimitMiddleware = require('./middleware/rateLimit');
const { setupSwagger } = require('./config/swagger');

const app = express();

// Get environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const API_URL = process.env.API_URL;

// Security middleware - Configure helmet with environment-aware CSP
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        "http://localhost:3000",
        "http://localhost:*",
        "https://api-dev.vortexbonus.com",
        "https://api.vortexbonus.com"
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "validator.swagger.io"],
    },
  },
};

// Disable CSP in local development for easier debugging (optional)
if (NODE_ENV === 'local') {
  helmetConfig.contentSecurityPolicy = false;
}

app.use(helmet(helmetConfig));

// CORS configuration - More permissive in development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    
    // In local/development, allow all origins
    if (NODE_ENV === 'local' || NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // In production, check against allowed origins
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

app.use(cors(corsOptions));

// Basic middleware
app.use(compression());

// Use different morgan formats based on environment
if (NODE_ENV === 'production') {
  app.use(morgan('combined')); // Apache combined format for production
} else {
  app.use(morgan('dev')); // Colored, concise output for development
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Serve uploaded files statically
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting (skip in local development)
if (NODE_ENV !== 'local') {
  app.use(rateLimitMiddleware.generalLimiter);
} else {
  console.log('⚠️  Rate limiting disabled in local environment');
}

// Setup Swagger documentation
setupSwagger(app);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check if the API server is running and get basic system information
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                 environment:
 *                   type: string
 *                   example: "development"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                 uptime:
 *                   type: number
 *                   example: 3600.123
 *                   description: "Server uptime in seconds"
 *             example:
 *               status: "OK"
 *               environment: "development"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *               uptime: 3600.123
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authModule.router);
app.use('/api/users', userModule.router);
app.use('/api/admin', adminModule.router);
app.use('/api/admin/pricing', require('./modules/admin/pricing').router);
app.use('/api/contracts', contractModule.router);
app.use('/api/wallet', require('./modules/wallet').router);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  // Environment-specific startup messages
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 VortexBonus API Server - ${NODE_ENV.toUpperCase()}`);
  console.log('='.repeat(60));
  console.log(`📍 Environment: ${NODE_ENV}`);
  console.log(`🌐 Port: ${PORT}`);
  
  if (NODE_ENV === 'local') {
    console.log(`🔗 API URL: http://localhost:${PORT}`);
    console.log(`📚 Swagger: http://localhost:${PORT}/api-docs`);
  } else if (NODE_ENV === 'development') {
    console.log(`🔗 API URL: ${API_URL || `http://localhost:${PORT}`}`);
    console.log(`📚 Swagger: ${API_URL || `http://localhost:${PORT}`}/api-docs`);
  } else if (NODE_ENV === 'production') {
    console.log(`🔗 API URL: ${API_URL}`);
    console.log(`📚 Swagger: ${API_URL}/api-docs`);
  }
  
  console.log(`📊 Log Level: ${process.env.LOG_LEVEL || 'info'}`);
  console.log(`⏱️  Rate Limiting: ${NODE_ENV !== 'local' ? 'Enabled' : 'Disabled'}`);
  console.log(`🔒 CORS: ${NODE_ENV === 'production' ? 'Strict' : 'Permissive'}`);
  console.log('='.repeat(60) + '\n');
  
  // Health check URLs
  console.log('✅ Health Check Endpoints:');
  if (NODE_ENV === 'local') {
    console.log(`   http://localhost:${PORT}/health`);
  } else {
    console.log(`   ${API_URL}/health`);
  }
  console.log('\n' + '='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  process.exit(0);
});

module.exports = app;