require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const { initRedis } = require('./config/redis');
const { loadGeoJSON } = require('./utils/geospatial');
const errorHandler = require('./middleware/errorHandler');

// Routes
const districtRoutes = require('./routes/district');
const stateRoutes = require('./routes/state');
const searchRoutes = require('./routes/search');
const geoRoutes = require('./routes/geo');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - CORS configuration
// Allow requests from frontend URL or any origin in development
let allowedOrigins = [];

if (process.env.FRONTEND_URL) {
  // Support multiple origins separated by commas
  allowedOrigins = process.env.FRONTEND_URL.split(',').map(url => url.trim());
} else {
  // Default localhost origins for development
  allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'];
}

// Always allow localhost in development
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174');
}

console.log('CORS allowed origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    // Log incoming origin for debugging
    if (origin) {
      console.log(`CORS request from origin: ${origin}`);
    }
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      console.log('CORS: Allowing request with no origin (mobile/Postman)');
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log(`CORS: Allowing origin: ${origin}`);
      return callback(null, true);
    }
    
    // In development, be permissive
    if (process.env.NODE_ENV !== 'production') {
      console.log(`CORS: Allowing origin in development: ${origin}`);
      return callback(null, true);
    }
    
    // In production, be more strict but log the issue
    console.warn(`CORS: Blocked request from origin: ${origin}. Allowed origins:`, allowedOrigins);
    callback(null, true); // Temporarily allow all for debugging - change to callback(new Error(...)) for production
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (simple)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/v1/district', districtRoutes);
app.use('/api/v1/state', stateRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/geo', geoRoutes);
app.use('/api/v1/health', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Our Voice, Our Rights API',
    version: '1.0.0',
    endpoints: {
      health: '/api/v1/health',
      district: '/api/v1/district/:state/:district/current',
      history: '/api/v1/district/:state/:district/history?months=12',
      stateCompare: '/api/v1/state/:state/compare?district=:district',
      search: '/api/v1/search?query=',
      geo: '/api/v1/geo/district?lat=&lon=',
    },
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Initialize services and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Connect to Redis
    await initRedis();

    // Load GeoJSON
    if (process.env.GEOJSON_PATH) {
      await loadGeoJSON(process.env.GEOJSON_PATH);
    } else {
      console.warn('GEOJSON_PATH not set - geospatial lookup will be unavailable');
    }

    // Start monthly ETL scheduler (only in production or if explicitly enabled)
    if (process.env.ENABLE_ETL_SCHEDULER === 'true' || process.env.NODE_ENV === 'production') {
      const scheduler = require('../worker/scheduler');
      scheduler.start();
      console.log('📅 Monthly ETL scheduler enabled');
    } else {
      console.log('ℹ️  ETL scheduler disabled (set ENABLE_ETL_SCHEDULER=true to enable)');
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;

