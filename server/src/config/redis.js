const redis = require('redis');

let redisClient = null;

/**
 * Initialize Redis client
 */
const initRedis = async () => {
  // Skip Redis if no URL is provided (allows app to run without Redis)
  if (!process.env.REDIS_URL) {
    console.warn('⚠️  REDIS_URL not set - running without Redis cache (app will still work but without caching)');
    return null;
  }

  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          // Exponential backoff: 100ms, 200ms, 400ms, etc.
          return Math.min(retries * 100, 3000);
        },
        connectTimeout: 10000,
      },
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err.message);
      // Don't crash the app - just log the error
    });

    redisClient.on('connect', () => {
      console.log('Redis: Connecting...');
    });

    redisClient.on('ready', () => {
      console.log('✓ Redis Connected successfully');
    });

    redisClient.on('reconnecting', () => {
      console.log('Redis: Reconnecting...');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Redis connection failed:', error.message);
    console.warn('⚠️  Continuing without Redis - app will work but without caching');
    redisClient = null;
    return null;
  }
};

/**
 * Get Redis client (returns null if not connected)
 */
const getRedis = () => redisClient;

/**
 * Cache helper: Get from Redis
 */
const getCache = async (key) => {
  if (!redisClient) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis GET error:', error.message);
    return null;
  }
};

/**
 * Cache helper: Set in Redis with TTL
 */
const setCache = async (key, value, ttl = 3600) => {
  if (!redisClient) return false;
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Redis SET error:', error.message);
    return false;
  }
};

/**
 * Cache helper: Delete key
 */
const deleteCache = async (key) => {
  if (!redisClient) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Redis DEL error:', error.message);
    return null;
  }
};

module.exports = {
  initRedis,
  getRedis,
  getCache,
  setCache,
  deleteCache,
};

