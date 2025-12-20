const { Redis } = require('@upstash/redis');

class RedisClient {
  constructor() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      console.warn('[Upstash Redis] The \'url\' property is missing or undefined in your Redis config.');
      console.warn('[Upstash Redis] The \'token\' property is missing or undefined in your Redis config.');
      console.warn('[Upstash Redis] Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your .env file');
      this.redis = null;
      return;
    }
    
    this.redis = new Redis({
      url,
      token,
    });
  }

  async get(key) {
    try {
      if (!this.redis) {
        // Redis not configured - return null silently (fallback to database)
        return null;
      }
      const result = await this.redis.get(key);
      // Upstash Redis automatically parses JSON, so result might already be an object
      // Return as-is - caller should handle both string and object cases
      return result;
    } catch (error) {
      // Log warning instead of error since we have database fallback
      console.warn('Redis GET error (falling back to database):', error.message);
      return null;
    }
  }

  async set(key, value, ttl = null) {
    try {
      if (!this.redis) return false;
      if (ttl) {
        return await this.redis.setex(key, ttl, value);
      }
      return await this.redis.set(key, value);
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  }

  async del(key) {
    try {
      if (!this.redis) return false;
      return await this.redis.del(key);
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  }

  async exists(key) {
    try {
      if (!this.redis) return false;
      return await this.redis.exists(key);
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  }

  async incr(key) {
    try {
      if (!this.redis) return 0;
      return await this.redis.incr(key);
    } catch (error) {
      console.error('Redis INCR error:', error);
      return 0;
    }
  }

  async expire(key, seconds) {
    try {
      if (!this.redis) return false;
      return await this.redis.expire(key, seconds);
    } catch (error) {
      console.error('Redis EXPIRE error:', error);
      return false;
    }
  }

  async ttl(key) {
    try {
      if (!this.redis) return -1;
      return await this.redis.ttl(key);
    } catch (error) {
      console.error('Redis TTL error:', error);
      return -1;
    }
  }

  // Session management methods
  async setSession(sessionId, sessionData, ttl = 86400) { // 24 hours default
    const key = `session:${sessionId}`;
    return await this.set(key, JSON.stringify(sessionData), ttl);
  }

  async getSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      const data = await this.get(key);
      if (!data) return null;
      
      // Handle case where data might already be an object (from Upstash)
      if (typeof data === 'object') {
        return data;
      }
      
      // Parse JSON string
      return JSON.parse(data);
    } catch (error) {
      console.error('Redis getSession error:', error);
      // Return null instead of throwing - let caller handle fallback
      return null;
    }
  }

  async deleteSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.del(key);
  }

  // Rate limiting methods
  async checkRateLimit(identifier, endpoint, limit, window) {
    const key = `rate_limit:${identifier}:${endpoint}`;
    const current = await this.incr(key);
    
    if (current === 1) {
      await this.expire(key, window);
    }
    
    return {
      count: current,
      limit,
      remaining: Math.max(0, limit - current),
      resetTime: Date.now() + (window * 1000)
    };
  }
}

module.exports = new RedisClient();
