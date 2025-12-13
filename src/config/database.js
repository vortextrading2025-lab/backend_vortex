const { PrismaClient } = require('@prisma/client');

class Database {
  constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
  }

  async connect() {
    try {
      await this.prisma.$connect();
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      if (error.code === 'P1001') {
        console.error('   → Cannot reach database server. Check DATABASE_URL in your .env file.');
      } else if (error.code === 'P1000') {
        console.error('   → Authentication failed. Check database credentials.');
      } else if (error.code === 'P1003') {
        console.error('   → Database does not exist. Create it first.');
      }
      console.error('   Full error:', error);
      throw error; // Re-throw so caller can handle it
    }
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }

  getClient() {
    return this.prisma;
  }
}

module.exports = new Database();
