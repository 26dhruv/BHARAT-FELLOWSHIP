const redis = require('redis');

let redisClient = null;

/**
 * Initialize Redis client
 */
const initRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    console.log('Redis Connected');
    return redisClient;
  } catch (error) {
    console.error('Redis connection error:', error.message);
    // Continue without Redis in development
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

