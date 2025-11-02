# Render.com Deployment Guide

## Quick Setup Steps

### 1. Set Up Redis (Required for Caching)

You have several options:

#### Option A: Upstash Redis (Recommended - Free Tier Available)
1. Go to [Upstash.com](https://upstash.com)
2. Create a free account
3. Create a new Redis database
4. Copy the **Redis URL** (looks like: `redis://default:xxxxx@xxxxx.upstash.io:6379`)

#### Option B: Redis Cloud (Free Tier Available)
1. Go to [Redis Cloud](https://redis.com/cloud)
2. Sign up for free tier
3. Create a database
4. Copy the **Endpoint URL**

#### Option C: Render Redis (Paid)
1. In Render dashboard, create a new **Redis** service
2. Render will provide the `REDIS_URL` automatically

### 2. Set Up MongoDB (Required)

#### MongoDB Atlas (Recommended - Free Tier Available)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Create a database user
4. Whitelist Render's IP (or use `0.0.0.0/0` for all IPs)
5. Copy the **Connection String** (looks like: `mongodb+srv://user:pass@cluster.mongodb.net/dbname`)

### 3. Configure Environment Variables in Render

In your Render service dashboard → **Environment** section, add:

```
# Server
NODE_ENV=production
PORT=10000

# MongoDB (Required)
MONGO_URI=your_mongodb_atlas_connection_string

# Redis (Required for caching - see options above)
REDIS_URL=your_redis_url_from_upstash_or_redis_cloud

# API Keys
MGNREGA_API_KEY=579b464db66ec23bdd00000104002ad973e2489a5a9ebc4c15f5f9c2

# Frontend URL (where your React app is hosted)
FRONTEND_URL=https://your-frontend-url.vercel.app

# Optional: Enable monthly ETL scheduler
ENABLE_ETL_SCHEDULER=true

# Optional: Timezone for cron jobs
TZ=Asia/Kolkata
```

### 4. Render Service Configuration

**Settings to verify:**
- **Root Directory**: `server`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/v1/health`

### 5. Deploy

1. Connect your Git repository
2. Render will automatically deploy on push
3. Check logs to verify:
   - ✅ MongoDB Connected
   - ✅ Redis Connected (or warning if not set)
   - ✅ Server running on port...

## Troubleshooting

### Redis Connection Errors

If you see `ECONNREFUSED` errors:
- **Solution**: Make sure `REDIS_URL` is set in Render environment variables
- The app will continue to work without Redis (just no caching)

### MongoDB Connection Errors

- Verify your MongoDB Atlas connection string is correct
- Make sure you whitelisted Render's IP addresses
- Check that your database user has proper permissions

### Build/Start Command Issues

- Make sure **Root Directory** is set to `server`
- **Start Command** should be: `npm start` (not `npm run dev`)

## Testing Your Deployment

1. **Health Check**: `https://your-app.onrender.com/api/v1/health`
   - Should return status: `ok` or `degraded` (if Redis missing)

2. **API Test**: `https://your-app.onrender.com/api/v1/search?query=mumbai`
   - Should return district search results

## Cost Estimates (Free Tier)

- **Render Web Service**: Free (sleeps after 15 min inactivity)
- **Upstash Redis**: Free (10,000 commands/day)
- **MongoDB Atlas**: Free (512MB storage)
- **Total**: $0/month for development/testing

For production with no sleep, upgrade Render to Starter ($7/month).

