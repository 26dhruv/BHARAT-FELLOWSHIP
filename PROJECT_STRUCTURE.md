# Project Structure

## Overview

This MERN stack application is structured as a monorepo with separate `server` and `client` directories.

## Directory Structure

```
.
├── README.md                    # Main documentation
├── CONTRIBUTING.md              # Contribution guidelines
├── .gitignore                   # Git ignore rules
│
├── server/                      # Backend Express application
│   ├── package.json
│   ├── .env.example            # Environment variables template
│   ├── ecosystem.config.js     # PM2 configuration
│   │
│   ├── src/                    # Source code
│   │   ├── index.js           # Express app entry point
│   │   │
│   │   ├── config/            # Configuration
│   │   │   ├── database.js    # MongoDB connection
│   │   │   └── redis.js       # Redis connection
│   │   │
│   │   ├── models/            # Mongoose schemas
│   │   │   ├── MgnregaRecord.js
│   │   │   ├── DistrictAggregate.js
│   │   │   └── Subscription.js
│   │   │
│   │   ├── routes/            # API routes
│   │   │   ├── district.js    # /api/v1/district/*
│   │   │   ├── state.js       # /api/v1/state/*
│   │   │   ├── search.js      # /api/v1/search
│   │   │   ├── geo.js         # /api/v1/geo/*
│   │   │   └── health.js      # /api/v1/health
│   │   │
│   │   ├── middleware/       # Express middleware
│   │   │   ├── errorHandler.js
│   │   │   └── rateLimiter.js
│   │   │
│   │   └── utils/            # Utility functions
│   │       ├── cache.js      # Redis cache helpers
│   │       └── geospatial.js # Turf.js geospatial functions
│   │
│   ├── worker/                # ETL worker scripts
│   │   ├── etl.js            # Main ETL script
│   │   └── queue-worker.js   # Bull queue worker
│   │
│   ├── scripts/               # Utility scripts
│   │   └── load-geojson.js   # GeoJSON validation script
│   │
│   └── data/                  # Data files
│       ├── geojson/          # GeoJSON district boundaries
│       └── snapshots/        # Daily data snapshots
│
└── client/                     # Frontend React application
    ├── package.json
    ├── vite.config.js         # Vite + PWA configuration
    ├── tailwind.config.js     # Tailwind CSS configuration
    ├── index.html
    │
    ├── src/
    │   ├── main.jsx           # React entry point
    │   ├── App.jsx             # Router setup
    │   ├── index.css          # Global styles
    │   │
    │   ├── pages/             # Page components
    │   │   ├── Landing.jsx    # Landing/search page
    │   │   └── DistrictDashboard.jsx  # District metrics page
    │   │
    │   ├── components/        # Reusable components
    │   │   ├── DistrictCard.jsx    # Metric display card
    │   │   ├── Sparkline.jsx       # Trend chart
    │   │   ├── LanguageToggle.jsx  # EN/HI toggle
    │   │   └── GeoDetect.jsx       # Geolocation detection
    │   │
    │   └── utils/             # Frontend utilities
    │       └── api.js         # Axios API client
    │
    └── public/                # Static assets
        ├── pwa-192x192.png    # PWA icon (192px)
        └── pwa-512x512.png    # PWA icon (512px)

├── docs/                       # Documentation
    ├── QUICKSTART.md          # Quick start guide
    └── deployment.md          # Deployment details
```

## Key Files

### Backend

- **`server/src/index.js`**: Express app setup, middleware, routes
- **`server/worker/etl.js`**: ETL script for data.gov.in API
- **`server/src/routes/*`**: API endpoint handlers
- **`server/src/models/*`**: MongoDB schemas
- **`server/src/utils/cache.js`**: Redis caching logic
- **`server/src/utils/geospatial.js`**: Turf.js point-in-polygon

### Frontend

- **`client/src/pages/Landing.jsx`**: District search/selection
- **`client/src/pages/DistrictDashboard.jsx`**: Main dashboard
- **`client/src/components/DistrictCard.jsx`**: Metric card with audio
- **`client/src/components/Sparkline.jsx`**: Mini trend chart
- **`client/vite.config.js`**: Vite + PWA configuration

## API Endpoints

- `GET /api/v1/health` - Health check
- `GET /api/v1/district/:state/:district/current` - Current month data
- `GET /api/v1/district/:state/:district/history?months=12` - Historical data
- `GET /api/v1/state/:state/compare?district=:district` - State comparison
- `GET /api/v1/search?query=` - District search
- `GET /api/v1/geo/district?lat=&lon=` - Geospatial lookup

## Data Flow

1. **ETL Worker** → Fetches from data.gov.in API
2. **MongoDB** → Stores normalized records
3. **Redis** → Caches API responses
4. **Express API** → Serves cached/fresh data
5. **React Frontend** → Displays data with PWA offline support

## Technology Stack

- **Backend**: Node.js, Express, MongoDB (Mongoose), Redis, Bull
- **Frontend**: React, Vite, Tailwind CSS, React Router
- **Geospatial**: Turf.js
- **Deployment**: PM2, Nginx, Certbot

