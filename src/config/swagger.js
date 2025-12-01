const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

// Determine environment and set appropriate server URLs
const getServerConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  const apiUrl = process.env.API_URL;
  
  const servers = [];

  // Always add the current environment's server first
  if (env === 'production') {
    servers.push({
      url: apiUrl || 'https://api.vortexbonus.com',
      description: 'Production server'
    });
  } else if (env === 'development' && apiUrl && apiUrl.includes('api-dev.vortexbonus.com')) {
    // Development server (deployed)
    servers.push({
      url: apiUrl,
      description: 'Development server (Deployed)'
    });
  } else {
    // Local development
    servers.push({
      url: apiUrl || 'http://localhost:3000',
      description: 'Local development server'
    });
  }

  // Add other environments as alternatives (for testing)
  if (env !== 'production') {
    servers.push({
      url: 'http://localhost:3000',
      description: 'Local development'
    });
  }
  
  if (env !== 'development') {
    servers.push({
      url: 'https://api-dev.vortexbonus.com',
      description: 'Development server'
    });
  }
  
  if (env !== 'production') {
    servers.push({
      url: 'https://api.vortexbonus.com',
      description: 'Production server'
    });
  }

  return servers;
};

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'VortexBonus API',
      version: '1.0.0',
      description: 'A comprehensive authentication and user management API with RBAC, session management, and audit logging',
      contact: {
        name: 'API Support',
        email: 'support@vortexbonus.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: getServerConfig(),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: your-token-here'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken',
          description: 'Refresh token stored in HTTP-only cookie'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1234567890abcdef' },
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            phone: { type: 'string', example: '+1234567890' },
            avatar: { type: 'string', format: 'uri', example: 'https://example.com/avatar.jpg' },
            role: { 
              type: 'string', 
              enum: ['USER', 'VENDOR', 'MENTOR', 'ADMIN'],
              example: 'USER'
            },
            status: { 
              type: 'string', 
              enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'],
              example: 'ACTIVE'
            },
            emailVerified: { type: 'boolean', example: true },
            phoneVerified: { type: 'boolean', example: false },
            lastLoginAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' },
            createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00Z' }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', minLength: 8, example: 'SecurePass123!' },
            firstName: { type: 'string', minLength: 1, example: 'John' },
            lastName: { type: 'string', minLength: 1, example: 'Doe' },
            role: { 
              type: 'string', 
              enum: ['USER', 'VENDOR', 'MENTOR'],
              default: 'USER',
              example: 'USER'
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'bhanushaily3@gmail.com' },
            password: { type: 'string', example: '123456' }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Login successful' },
            data: {
              type: 'object',
              properties: {
                user: { $ref: '#/components/schemas/User' },
                accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                sessionId: { type: 'string', example: 'sess_1234567890abcdef' }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    },
    security: [
      { bearerAuth: [] }
    ]
  },
  // CRITICAL: Update these paths to match your actual project structure
  apis: [
    './modules/*/**/*.js',
    './modules/auth/index.js',
    './modules/auth/*.js',
    './modules/user/index.js', 
    './modules/user/*.js',
    './modules/admin/index.js',
    './modules/admin/*.js',
    './server.js',
    './app.js'
  ]
};

const specs = swaggerJsdoc(options);

const setupSwagger = (app) => {
  const env = process.env.NODE_ENV || 'development';
  
  // Custom CSS based on environment
  const customCss = `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title small { 
      background-color: ${env === 'production' ? '#dc3545' : env === 'development' ? '#ffc107' : '#28a745'};
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      margin-left: 10px;
      font-size: 12px;
    }
  `;

  // Add environment badge to title
  specs.info.title = `${specs.info.title} ${
    env === 'production' ? '🔴 PRODUCTION' : 
    env === 'development' ? '🟡 DEVELOPMENT' : 
    '🟢 LOCAL'
  }`;

  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss,
    customSiteTitle: `VortexBonus API - ${env.toUpperCase()}`,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 1,
    }
  }));

  // JSON endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  // Debug endpoint to see what APIs were found
  if (env !== 'production') {
    app.get('/api-docs/debug', (req, res) => {
      res.json({
        apis: options.apis,
        pathsFound: Object.keys(specs.paths || {}),
        tagsFound: specs.tags || [],
        totalEndpoints: Object.keys(specs.paths || {}).length
      });
    });
  }

  // Log swagger URL on startup
  const port = process.env.PORT || 3000;
  console.log(`📚 Swagger Documentation available at:`);
  
  if (env === 'production') {
    console.log(`   Production: https://api.vortexbonus.com/api-docs`);
  } else if (process.env.API_URL && process.env.API_URL.includes('api-dev.vortexbonus.com')) {
    console.log(`   Dev Server: ${process.env.API_URL}/api-docs`);
  } else {
    console.log(`   Local: http://localhost:${port}/api-docs`);
  }
  
  // Log number of endpoints found
  const endpointCount = Object.keys(specs.paths || {}).length;
  console.log(`📍 Total API endpoints documented: ${endpointCount}`);
  
  if (endpointCount === 0) {
    console.log(`⚠️  WARNING: No API endpoints found! Check your Swagger JSDoc comments.`);
  }
};

module.exports = { setupSwagger };