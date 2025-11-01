`# Our Voice, Our Rights

A civic tech application that helps rural citizens view district-level MGNREGA (Mahatma Gandhi National Rural Employment Guarantee Act) monthly performance data in an accessible, low-literacy-friendly interface.

## Overview

**Our Voice, Our Rights** provides:
- District-level MGNREGA performance metrics (person-days generated, work completion, payments)
- Monthly historical trends with visual comparisons
- State average comparisons with color-coded indicators (Green/Yellow/Red)
- Geospatial district detection via browser geolocation
- Bilingual support (English/Hindi) with audio playback for accessibility
- Progressive Web App (PWA) for offline access to cached data
- Mobile-first design optimized for rural connectivity

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: MongoDB (Mongoose)
- **Cache**: Redis
- **Queue/Worker**: Bull (Redis-backed) for ETL jobs
- **Frontend**: React (Vite) + Tailwind CSS
- **Geospatial**: Turf.js for point-in-polygon queries
- **Deployment**: Ubuntu VPS with PM2 + Nginx + Certbot

## Quickstart - Local Development

### Prerequisites
- Node.js 18+ and npm
- MongoDB (local or Atlas connection string)
- Redis (local or cloud instance)

### Setup Steps

1. **Clone and install dependencies**:
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

2. **Configure environment variables**:
```bash
# Backend
cp server/.env.example server/.env
# Edit server/.env with your MongoDB URI, Redis URL, etc.

# Frontend
cp client/.env.example client/.env
# Edit client/.env with your API base URL
```

3. **Start services**:
```bash
# Terminal 1: Start MongoDB (if local)
# mongod

# Terminal 2: Start Redis (if local)
# redis-server

# Terminal 3: Start backend server
cd server
npm run dev

# Terminal 4: Start frontend dev server
cd client
npm run dev
```

4. **Run ETL worker** (to populate sample data):
```bash
cd server
npm run etl
```

5. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - API Health Check: http://localhost:3000/api/v1/health

## API Endpoints

### Health Check
```bash
GET /api/v1/health
```

### District Current Month
```bash
GET /api/v1/district/:state/:district/current
# Example: GET /api/v1/district/Maharashtra/Pune/current
```

### District History
```bash
GET /api/v1/district/:state/:district/history?months=12
# Returns last N months of data
```

### State Comparison
```bash
GET /api/v1/state/:state/compare?district=:district
# Returns ranking and state average comparison
```

### District Search
```bash
GET /api/v1/search?query=pune
# Fuzzy search for districts
```

### Geospatial District Lookup
```bash
GET /api/v1/geo/district?lat=18.5204&lon=73.8567
# Maps lat/lon to district using GeoJSON + turf.js
```

### Sample API Calls
```bash
# Health check
curl http://localhost:3000/api/v1/health

# Get current month data for a district
curl http://localhost:3000/api/v1/district/Maharashtra/Pune/current

# Get 12 months history
curl http://localhost:3000/api/v1/district/Maharashtra/Pune/history?months=12

# Search districts
curl http://localhost:3000/api/v1/search?query=pune

# Geospatial lookup
curl "http://localhost:3000/api/v1/geo/district?lat=18.5204&lon=73.8567"
```

## ETL Worker

The ETL worker fetches data from data.gov.in API, processes it, and stores it in MongoDB with Redis caching.

### Run ETL manually:
```bash
cd server
npm run etl
```

### Schedule ETL (production):
The worker can be scheduled using:
- Bull queue with cron scheduling (see `worker/etl.js`)
- Or system cron: `0 2 * * * cd /path/to/server && npm run etl`

### ETL Process:
1. Fetches paginated data from data.gov.in API
2. Processes and normalizes district/state names
3. Upserts records into MongoDB (`mgnrega_records` collection)
4. Creates daily aggregates (`district_aggregates` collection)
5. Saves snapshot JSON to `data/snapshots/YYYY-MM-DD.json`
6. Invalidates Redis cache for affected districts

## Project Structure

```
.
├── server/                 # Backend Express application
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── models/        # Mongoose schemas
│   │   ├── middleware/    # Express middleware
│   │   ├── utils/         # Helper functions (geospatial, caching)
│   │   └── config/        # Configuration files
│   ├── worker/            # ETL worker scripts
│   ├── data/             # GeoJSON files and snapshots
│   └── .env.example      # Environment variables template
│
├── client/                # Frontend React application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── utils/        # Frontend utilities
│   │   └── assets/       # Static assets
│   ├── public/           # PWA manifest and icons
│   └── .env.example      # Frontend environment variables
│
├── docs/                 # Additional documentation
└── README.md            # This file
```

## Deployment - Ubuntu VPS

### Prerequisites
- Ubuntu 22.04 LTS VPS
- Domain name pointed to your VPS IP
- Root or sudo access

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-6.0.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable mongod
sudo systemctl start mongod

# Install Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### Step 2: Deploy Application

```bash
# Clone or upload your code to the server
cd /var/www
sudo git clone <your-repo-url> our-voice-our-rights
cd our-voice-our-rights

# Install dependencies
cd server && npm install --production
cd ../client && npm install && npm run build

# Configure environment
cd ../server
cp .env.example .env
nano .env  # Edit with production values

# Start with PM2
cd ../server
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to enable PM2 on boot
```

### Step 3: Configure Nginx

Create `/etc/nginx/sites-available/our-voice-our-rights`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend static files
    location / {
        root /var/www/our-voice-our-rights/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/our-voice-our-rights /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 4: SSL Certificate

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot will automatically configure Nginx for HTTPS and set up auto-renewal.

### Step 5: Schedule ETL

```bash
# Option 1: Use PM2 cron
cd /var/www/our-voice-our-rights/server
pm2 start worker/etl-cron.js --name etl-worker

# Option 2: System cron
crontab -e
# Add: 0 2 * * * cd /var/www/our-voice-our-rights/server && npm run etl >> /var/log/mgnrega-etl.log 2>&1
```

### Step 6: Backup Strategy

```bash
# MongoDB backup script (save as /usr/local/bin/backup-mongodb.sh)
#!/bin/bash
BACKUP_DIR="/var/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --out $BACKUP_DIR/$DATE
# Optional: Upload to S3/object storage
# aws s3 sync $BACKUP_DIR s3://your-bucket/mongodb-backups/

# Schedule daily backup
# crontab -e: 0 3 * * * /usr/local/bin/backup-mongodb.sh
```

### Monitoring

```bash
# PM2 monitoring
pm2 monit

# Check logs
pm2 logs

# View MongoDB status
sudo systemctl status mongod

# View Redis status
sudo systemctl status redis-server

# View Nginx status
sudo systemctl status nginx
```

## Production Readiness Checklist

- [ ] 1. **API Keys**: Obtain production API key from data.gov.in (replace sample key in `.env`)
- [ ] 2. **GeoJSON Data**: Obtain and load accurate GeoJSON file for your target state(s) into `server/data/geojson/`
- [ ] 3. **Database**: Configure MongoDB connection string (Atlas or managed instance recommended)
- [ ] 4. **Redis**: Set up production Redis instance (ElastiCache, Redis Cloud, or managed service)
- [ ] 5. **ETL Scheduling**: Configure daily ETL job schedule (recommended: 2 AM IST)
- [ ] 6. **Backups**: Set up automated MongoDB backups (daily) and snapshot archival to object storage
- [ ] 7. **Monitoring**: Configure application monitoring (PM2, Sentry, or similar) and alerts
- [ ] 8. **Load Testing**: Test API endpoints under expected load and optimize Redis cache TTLs
- [ ] 9. **Security**: Review and harden:
   - API rate limiting
   - CORS configuration
   - Input validation
   - MongoDB user permissions
   - Firewall rules (UFW)
- [ ] 10. **Domain & SSL**: Configure domain DNS and SSL certificate (Certbot auto-renewal verified)

## Development Commands

### Server
```bash
npm run dev          # Start development server with nodemon
npm start            # Start production server
npm run etl          # Run ETL worker manually
npm run worker       # Start Bull queue worker
```

### Client
```bash
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
```

## License

MIT

## Contributing

This is a civic tech project. Contributions welcome!
