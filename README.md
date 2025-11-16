# Express Prisma Boilerplate

A comprehensive Node.js backend boilerplate with Express.js, Prisma, PostgreSQL, JWT authentication, RBAC, session management, rate limiting, and audit logging.

## 🚀 Features

- **Authentication & Authorization**
  - JWT-based authentication with refresh tokens
  - Role-based access control (RBAC) with permissions
  - Multiple user roles: User, Vendor, Mentor, Admin
  - Session management with Redis/Upstash
  - Multi-device session support

- **Security**
  - Rate limiting with Redis
  - Input validation with Zod
  - Password hashing with bcrypt
  - CORS protection
  - Helmet security headers
  - Request logging

- **Database & ORM**
  - PostgreSQL with Prisma ORM
  - Database migrations
  - Seeding scripts
  - Connection pooling

- **Logging & Monitoring**
  - Comprehensive audit logging
  - Winston logging with multiple transports
  - User action tracking
  - Error tracking

- **API Documentation**
  - Swagger/OpenAPI documentation
  - Interactive API explorer
  - Request/response schemas

- **Modular Architecture**
  - Modular design for easy maintenance
  - Separation of concerns
  - Easy to scale to microservices

## 📋 Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 13
- Redis (or Upstash Redis)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd express-prisma-boilerplate
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/express_prisma_boilerplate"
   
   # JWT Secrets
   JWT_SECRET="your-super-secret-jwt-key-here"
   JWT_REFRESH_SECRET="your-super-secret-refresh-key-here"
   
   # Redis/Upstash
   UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
   UPSTASH_REDIS_REST_TOKEN="your-redis-token"
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npm run build
   
   # Run database migrations
   npm run db:push
   
   # Seed the database
   npm run db:seed
   ```

5. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 📚 API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:3000/api-docs
- **API JSON**: http://localhost:3000/api-docs.json

## 🏗️ Project Structure

```
src/
├── app.js                 # Main application entry point
├── config/
│   ├── database.js       # Database configuration
│   ├── redis.js          # Redis configuration
│   └── swagger.js        # Swagger documentation setup
├── middleware/
│   ├── auth.js           # Authentication middleware
│   ├── errorHandler.js   # Error handling middleware
│   └── rateLimit.js      # Rate limiting middleware
├── modules/
│   ├── auth/             # Authentication module
│   │   ├── authService.js
│   │   └── index.js
│   ├── user/             # User management module
│   │   └── index.js
│   ├── admin/            # Admin module
│   │   └── index.js
│   └── logging/          # Logging module
│       ├── logger.js
│       └── auditLogger.js
└── database/
    └── seeders/          # Database seeders
        └── index.js
```

## 🔐 Authentication Flow

### Registration
```bash
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "USER"
}
```

### Login
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Refresh Token
```bash
POST /api/auth/refresh
{
  "refreshToken": "your-refresh-token"
}
```

### Logout
```bash
POST /api/auth/logout
Authorization: Bearer <access-token>
```

## 👥 User Roles & Permissions

### Roles
- **USER**: Regular user with basic permissions
- **VENDOR**: Business user with vendor-specific permissions
- **MENTOR**: Mentor with teaching permissions
- **ADMIN**: Full system access

### Permissions
Permissions are resource-action based:
- `users.create`, `users.read`, `users.update`, `users.delete`
- `products.create`, `products.read`, `products.update`, `products.delete`
- `orders.create`, `orders.read`, `orders.update`, `orders.delete`
- `admin.access`, `audit.read`

## 📊 Audit Logging

All user actions are logged with:
- User ID and session information
- Action type and resource
- IP address and user agent
- Timestamp and metadata
- Success/failure status

## 🚦 Rate Limiting

- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 requests per 15 minutes
- **Password Reset**: 3 requests per hour
- **Role-based limits**: Different limits for different user roles

## 🔧 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm start            # Start production server
npm run build        # Generate Prisma client
npm run db:push      # Push database schema
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio
npm test             # Run tests
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
```

### Database Management
```bash
# View database in Prisma Studio
npm run db:studio

# Reset database
npx prisma db push --force-reset

# Generate new migration
npx prisma migrate dev --name migration-name
```

## 🚀 Deployment

### Environment Variables
Ensure all required environment variables are set:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Production Considerations
- Use strong, unique JWT secrets
- Set up proper CORS origins
- Configure rate limiting for your use case
- Set up proper logging and monitoring
- Use HTTPS in production
- Configure database connection pooling

## 🧪 Testing

Test accounts are created during seeding:
- **Admin**: admin@example.com / admin123
- **User**: user@example.com / user123
- **Vendor**: vendor@example.com / vendor123
- **Mentor**: mentor@example.com / mentor123

## 📈 Monitoring & Logs

- **Application Logs**: `logs/combined.log`
- **Error Logs**: `logs/error.log`
- **Audit Logs**: Stored in database, accessible via admin API

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation at `/api-docs`
- Review the audit logs for debugging

## 🔄 Migration to Microservices

This monolithic architecture is designed to be easily split into microservices:

1. **Authentication Service**: Handle auth, sessions, tokens
2. **User Service**: User management, profiles
3. **Admin Service**: Admin operations, audit logs
4. **Notification Service**: Email, SMS, push notifications
5. **File Service**: File uploads, storage

Each service can be extracted into its own repository and deployed independently.
