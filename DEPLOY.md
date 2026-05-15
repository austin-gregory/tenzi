# Tenzi Game Deployment to Hostinger VPS

## Prerequisites
- SSH access to VPS (root@187.124.240.199)
- Docker and Docker Compose installed
- Domain `tenzi.darkgamefactory.com` DNS record pointing to 187.124.240.199
- Nginx and Let's Encrypt already configured

## Deployment Steps

### 1. Set up DNS record
Add an A record in your Hostinger DNS:
- **Host**: tenzi
- **Type**: A
- **Value**: 187.124.240.199
- **TTL**: 3600

### 2. Clone to VPS
```bash
ssh root@187.124.240.199
cd /home
git clone https://github.com/yourusername/tenzi-game.git
cd tenzi-game
```

### 3. Build and start containers
```bash
docker-compose up -d --build
```

This will:
- Build the Node.js server (port 3010)
- Build the React client (port 3000)
- Start both services on the tenzi-network

### 4. Configure Nginx reverse proxy
On the VPS, create/edit `/etc/nginx/sites-available/tenzi.darkgamefactory.com`:

```nginx
upstream tenzi_client {
    server localhost:3000;
}

upstream tenzi_server {
    server localhost:3010;
}

server {
    server_name tenzi.darkgamefactory.com;

    location / {
        proxy_pass http://tenzi_client;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://tenzi_server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 80;
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/tenzi.darkgamefactory.com /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 5. Get SSL certificate with Let's Encrypt
```bash
certbot --nginx -d tenzi.darkgamefactory.com
```

### 6. Verify deployment
- Visit `https://tenzi.darkgamefactory.com` in your browser
- Try the game (login, pick avatar/color, roll dice, etc.)
- Check WebSocket connection works (open DevTools → Network → WS)

### 7. Monitor logs
```bash
docker-compose logs -f server
docker-compose logs -f client
```

### 8. Update deployments
When you push new code:
```bash
cd /home/tenzi-game
git pull
docker-compose up -d --build
```

## Troubleshooting

**Containers won't start**:
```bash
docker-compose logs
```

**Nginx not routing to containers**:
- Check containers are running: `docker ps`
- Check network: `docker network inspect tenzi-game_tenzi-network`
- Test connection: `curl http://localhost:3000`

**WebSocket connection fails**:
- Verify `/ws` location in Nginx config
- Check server logs: `docker-compose logs server`

**SSL issues**:
```bash
certbot renew --dry-run
```
