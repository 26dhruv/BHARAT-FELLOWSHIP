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

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
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

