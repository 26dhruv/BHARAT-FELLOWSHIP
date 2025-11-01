const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getRedis } = require('../config/redis');

/**
 * GET /api/v1/health
 * Simple health check endpoint
 */
router.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
    },
  };

  // Check MongoDB
  try {
    if (mongoose.connection.readyState === 1) {
      health.services.database = 'connected';
    } else {
      health.services.database = 'disconnected';
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.database = 'error';
    health.status = 'degraded';
  }

  // Check Redis
  try {
    const redis = getRedis();
    if (redis && redis.isOpen) {
      health.services.redis = 'connected';
    } else {
      health.services.redis = 'disconnected';
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.redis = 'error';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;

