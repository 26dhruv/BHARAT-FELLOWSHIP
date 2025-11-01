/**
 * Simple rate limiter middleware
 * For production, consider using express-rate-limit with Redis store
 */
const rateLimitMap = new Map();

const rateLimiter = (windowMs = 60000, maxRequests = 100) => {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const record = rateLimitMap.get(key);
    
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later',
      });
    }

    record.count++;
    next();
  };
};

module.exports = rateLimiter;

