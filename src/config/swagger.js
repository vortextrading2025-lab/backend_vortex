const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Express Prisma Boilerplate API',
      version: '1.0.0',
      description: 'A comprehensive authentication and user management API with RBAC, session management, and audit logging',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken'
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
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', example: 'SecurePass123!' }
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
                refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                sessionId: { type: 'string', example: 'sess_1234567890abcdef' }
              }
            }
          }
        },
        AvatarUpdateRequest: {
          type: 'object',
          required: ['avatar'],
          properties: {
            avatar: { 
              type: 'string', 
              format: 'uri',
              example: 'https://example.com/new-avatar.jpg',
              description: 'URL of the new avatar image'
            }
          }
        },
        SessionInfo: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', example: 'sess_1234567890abcdef' },
            deviceInfo: {
              type: 'object',
              properties: {
                userAgent: { type: 'string', example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                ip: { type: 'string', example: '192.168.1.1' },
                timestamp: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' }
              }
            },
            ipAddress: { type: 'string', example: '192.168.1.1' },
            userAgent: { type: 'string', example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            location: { type: 'string', example: 'New York, US' },
            lastUsedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' },
            createdAt: { type: 'string', format: 'date-time', example: '2024-01-15T09:00:00Z' }
          }
        },
        ActiveSessionsResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Active sessions retrieved successfully' },
            data: {
              type: 'object',
              properties: {
                sessions: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/SessionInfo' }
                },
                totalSessions: { type: 'integer', example: 3 },
                currentSession: { type: 'string', example: 'sess_1234567890abcdef' }
              }
            }
          }
        },
        Session: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            deviceInfo: { type: 'object' },
            ipAddress: { type: 'string' },
            userAgent: { type: 'string' },
            location: { type: 'string' },
            lastUsedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            action: { 
              type: 'string',
              enum: ['LOGIN', 'LOGOUT', 'REGISTER', 'UPDATE_PROFILE', 'CHANGE_PASSWORD', 'RESET_PASSWORD', 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'ASSIGN_ROLE', 'REVOKE_ROLE', 'CREATE_SESSION', 'REVOKE_SESSION', 'API_CALL', 'SYSTEM_EVENT']
            },
            resource: { type: 'string' },
            resourceId: { type: 'string' },
            details: { type: 'object' },
            ipAddress: { type: 'string' },
            userAgent: { type: 'string' },
            level: { 
              type: 'string',
              enum: ['INFO', 'WARN', 'ERROR', 'DEBUG']
            },
            message: { type: 'string' },
            metadata: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            ...(process.env.NODE_ENV === 'development' && {
              stack: { type: 'string' },
              error: { type: 'object' }
            })
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
      { bearerAuth: [] },
      { cookieAuth: [] }
    ]
  },
  apis: ['./src/modules/*/index.js', './src/app.js']
};

const specs = swaggerJsdoc(options);

const setupSwagger = (app) => {
  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Express Prisma Boilerplate API'
  }));

  // JSON endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};

module.exports = { setupSwagger };
