# Deployment Guide

## Nginx Configuration

Save this as `/etc/nginx/sites-available/our-voice-our-rights`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend static files
    location / {
        root /var/www/our-voice-our-rights/client/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

## MongoDB Backup Script

Create `/usr/local/bin/backup-mongodb.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup MongoDB
mongodump --out $BACKUP_DIR/$DATE

# Compress
tar -czf $BACKUP_DIR/$DATE.tar.gz $BACKUP_DIR/$DATE
rm -rf $BACKUP_DIR/$DATE

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/$DATE.tar.gz"
```

Make executable:
```bash
chmod +x /usr/local/bin/backup-mongodb.sh
```

Schedule in crontab:
```bash
0 3 * * * /usr/local/bin/backup-mongodb.sh >> /var/log/mongodb-backup.log 2>&1
```

## Monitoring Commands

```bash
# PM2 status
pm2 status
pm2 monit
pm2 logs

# Check services
sudo systemctl status mongod
sudo systemctl status redis-server
sudo systemctl status nginx

# Check disk space
df -h

# Check memory
free -h
```

