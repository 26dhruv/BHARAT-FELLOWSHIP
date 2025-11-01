# Quick Start Guide

## Local Development Setup

### 1. Prerequisites Check
```bash
node --version  # Should be 18+
npm --version
mongod --version  # If running MongoDB locally
redis-cli ping  # Should return PONG
```

### 2. Backend Setup

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and Redis URL
npm run dev
```

The server should start on `http://localhost:3000`

### 3. Frontend Setup

```bash
cd client
npm install
cp .env.example .env
# Edit .env with your API base URL (default should work)
npm run dev
```

The frontend should start on `http://localhost:5173`

### 4. Populate Sample Data

```bash
cd server
npm run etl
```

This will fetch a limited set of data from data.gov.in API. For production, remove the `ETL_LIMIT` check in `worker/etl.js`.

### 5. Test the API

```bash
# Health check
curl http://localhost:3000/api/v1/health

# Get district data (example)
curl http://localhost:3000/api/v1/district/Maharashtra/Pune/current
```

### 6. Access the App

Open `http://localhost:5173` in your browser.

## Common Issues

### MongoDB Connection Failed
- Check if MongoDB is running: `mongod --version`
- Verify connection string in `.env`
- For Atlas, ensure IP whitelist includes your IP

### Redis Connection Failed
- Check if Redis is running: `redis-cli ping`
- Verify Redis URL in `.env`
- The app will continue without Redis (with degraded caching)

### ETL Worker Fails
- Check API key in `.env`
- Verify network connectivity
- Check API response format (may need to adjust field mappings in `worker/etl.js`)

### Frontend Can't Connect to API
- Verify `VITE_API_BASE_URL` in `client/.env`
- Check CORS settings in server
- Ensure backend is running

## Next Steps

1. Load GeoJSON data for geospatial lookup
2. Run full ETL to populate database
3. Test all endpoints
4. Deploy to production following README deployment guide

