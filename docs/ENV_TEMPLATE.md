# Environment Variables Template

## Server (.env)

Create `server/.env` with the following:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173

# MongoDB
MONGO_URI=mongodb://localhost:27017/mgnrega_db
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/mgnrega_db

# Redis
REDIS_URL=redis://localhost:6379
# For Redis Cloud: redis://username:password@host:port

# data.gov.in API
MGNREGA_API_KEY=579b464db66ec23bdd00000104002ad973e2489a5a9ebc4c15f5f9c2
MGNREGA_API_BASE=https://data.gov.in/api/resource/ee03643a-ee4c-48c2-ac30-9f2ff26ab722

# Geospatial Data
GEOJSON_PATH=./data/geojson/india-districts.geojson

# Caching
CACHE_TTL=3600
DISTRICT_CACHE_TTL=1800

# ETL Scheduler
ENABLE_ETL_SCHEDULER=true  # Set to true to enable monthly cron job
ETL_CRON_SCHEDULE=0 2 1 * *  # Monthly: 1st day of month at 2 AM (default)
ETL_LIMIT=100  # Limit records for development (optional)
TZ=Asia/Kolkata  # Timezone for cron jobs (optional, defaults to IST)
```

## Client (.env)

Create `client/.env` with the following:

```bash
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

For production, update to your production API URL:
```bash
VITE_API_BASE_URL=https://yourdomain.com/api/v1
```

## Notes

- Never commit `.env` files to git
- Replace sample API key with production key from data.gov.in
- Update MongoDB URI for production (Atlas recommended)
- Update Redis URL for production (managed Redis recommended)
- Download GeoJSON file from: https://github.com/datameet/maps

