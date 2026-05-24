# Tenzi Game Deployment Guide

This guide covers deploying the Tenzi game to a Hostinger VPS using Docker.

## Prerequisites

- VPS with Docker and Docker Compose installed
- Domain name (e.g., `tenzi.darkgamefactory.com`)
- SSH access to VPS
- Nginx installed on VPS (for reverse proxy)

## Quick Start

### 1. Basic Deployment

```bash
chmod +x deploy.sh
./deploy.sh <VPS_IP> <SSH_USER> <DEPLOY_PATH>
```

Example:
```bash
./deploy.sh 123.45.67.89 root /opt/tenzi
```

### 2. Configure Nginx Reverse Proxy

SSH into your VPS and create `/etc/nginx/sites-available/tenzi`:

```bash
ssh root@123.45.67.89
```

Create the Nginx config:
```nginx
upstream tenzi_client {
    server localhost:3000;
}

upstream tenzi_server {
    server localhost:3010;
}

server {
    listen 80;
    server_name tenzi.darkgamefactory.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tenzi.darkgamefactory.com;
    
    # SSL certificates (update paths to your cert location)
    ssl_certificate /etc/letsencrypt/live/tenzi.darkgamefactory.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tenzi.darkgamefactory.com/privkey.pem;
    
    # SSL security headers
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Client (React app)
    location / {
        proxy_pass http://tenzi_client;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_redirect off;
    }
    
    # WebSocket server
    location /ws {
        proxy_pass http://tenzi_server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

Save and enable:
```bash
ln -s /etc/nginx/sites-available/tenzi /etc/nginx/sites-enabled/tenzi
nginx -t
systemctl restart nginx
```

### 3. Set Up SSL with Let's Encrypt

```bash
# Install certbot if not already installed
apt-get install -y certbot python3-certbot-nginx

# Generate certificate
certbot certonly --standalone -d tenzi.darkgamefactory.com

# Update Nginx config with certificate paths (see above)
systemctl restart nginx
```

### 4. Verify Deployment

```bash
# Check Docker containers are running
docker ps

# Check logs
docker logs tenzi-server
docker logs tenzi-client

# Test from local machine
curl https://tenzi.darkgamefactory.com
curl https://tenzi.darkgamefactory.com/ws
```

## Updating the Application

When you push new changes to GitHub:

```bash
./deploy.sh <VPS_IP> <SSH_USER> <DEPLOY_PATH>
```

This will:
1. Pull latest code from GitHub
2. Rebuild Docker images
3. Stop old containers
4. Start new containers

## Troubleshooting

### Containers not starting
```bash
ssh root@<VPS_IP>
cd /opt/tenzi
docker-compose logs -f
```

### Port conflicts
```bash
# Check what's using ports
lsof -i :3000
lsof -i :3010
```

### Nginx issues
```bash
# Test config
nginx -t

# View error logs
tail -f /var/log/nginx/error.log
```

## Architecture

```
User Browser
    ↓
HTTPS (port 443)
    ↓
Nginx Reverse Proxy
    ↓
├── / → Docker Client (React, port 3000)
└── /ws → Docker Server (Node.js WebSocket, port 3010)
```

## Environment Variables

The Docker containers use these environment variables (set in `docker-compose.yml`):

- `NODE_ENV=production` - Production mode for server
- `PORT=3010` - Server port
- `HOST=0.0.0.0` - Allow external connections

## Backup and Restore

### Backup game data
```bash
# If you add persistent data storage later
docker volume ls
docker volume inspect tenzi_data
```

### Restore from backup
```bash
# Create volume with backup
docker volume create --name tenzi_data_restored
docker run -v tenzi_data_restored:/data -v /backup/data:/backup alpine cp /backup/. /data
```
