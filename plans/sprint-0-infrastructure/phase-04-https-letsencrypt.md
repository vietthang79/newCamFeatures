# Phase 04 — HTTPS via Let's Encrypt

**Status:** ⏳ Pending  
**Priority:** 🟡 High  
**Effort:** ~2 hours  
**Depends on:** Phase 02 (Docker Compose)

## Overview

Cấu hình Nginx làm reverse proxy với SSL termination. Let's Encrypt cấp và tự động renew certificates cho:
- `app.intelli-park.com` → Next.js frontend (port 3000)
- `api.intelli-park.com` → NestJS gateway (port 4000)

## Architecture

```
Internet (443/80)
       │
   ┌───▼──────────────────┐
   │      Nginx            │
   │  (reverse proxy +     │
   │   SSL termination)    │
   └───┬──────────────┬────┘
       │              │
  ┌────▼───┐     ┌────▼───┐
  │ Next.js │     │NestJS  │
  │  :3000  │     │  :4000 │
  └─────────┘     └────────┘
```

## Files to Create/Modify

- `infra/nginx/nginx.conf` — Nginx config với upstream và SSL
- `infra/nginx/conf.d/app.conf` — config cho app.intelli-park.com
- `infra/nginx/conf.d/api.conf` — config cho api.intelli-park.com
- `infra/certbot/init-letsencrypt.sh` — script khởi tạo cert lần đầu
- `docker-compose.yml` — thêm nginx và certbot services

## Implementation

### docker-compose.yml — thêm nginx và certbot

```yaml
# Thêm vào services trong docker-compose.yml:

  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./infra/nginx/conf.d:/etc/nginx/conf.d:ro
      - certbot_webroot:/var/www/certbot:ro
      - certbot_certs:/etc/letsencrypt:ro
    depends_on:
      - frontend
      - gateway
    restart: unless-stopped

  certbot:
    image: certbot/certbot:latest
    volumes:
      - certbot_webroot:/var/www/certbot
      - certbot_certs:/etc/letsencrypt
    # Chạy thủ công lần đầu, sau đó cron renewal
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

# Thêm vào volumes:
volumes:
  certbot_webroot:
  certbot_certs:
```

### infra/nginx/nginx.conf

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
  worker_connections 1024;
}

http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;

  log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                  '$status $body_bytes_sent "$http_referer" '
                  '"$http_user_agent"';

  access_log /var/log/nginx/access.log main;
  sendfile on;
  keepalive_timeout 65;

  # Security headers
  add_header X-Frame-Options DENY;
  add_header X-Content-Type-Options nosniff;
  add_header X-XSS-Protection "1; mode=block";
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  include /etc/nginx/conf.d/*.conf;
}
```

### infra/nginx/conf.d/app.conf

```nginx
# HTTP → HTTPS redirect
server {
  listen 80;
  server_name app.intelli-park.com;

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location / {
    return 301 https://$host$request_uri;
  }
}

# HTTPS — Frontend
server {
  listen 443 ssl http2;
  server_name app.intelli-park.com;

  ssl_certificate /etc/letsencrypt/live/app.intelli-park.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.intelli-park.com/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers off;

  location / {
    proxy_pass http://frontend:3000;
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

### infra/nginx/conf.d/api.conf

```nginx
# HTTP → HTTPS redirect
server {
  listen 80;
  server_name api.intelli-park.com;

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location / {
    return 301 https://$host$request_uri;
  }
}

# HTTPS — API Gateway
server {
  listen 443 ssl http2;
  server_name api.intelli-park.com;

  ssl_certificate /etc/letsencrypt/live/api.intelli-park.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.intelli-park.com/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers off;

  # Rate limiting cho API
  limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

  location / {
    limit_req zone=api burst=20 nodelay;

    proxy_pass http://gateway:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # CORS headers (NestJS cũng handle nhưng thêm ở Nginx để chắc)
    add_header Access-Control-Allow-Origin "https://app.intelli-park.com" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
    add_header Access-Control-Allow-Credentials "true" always;

    if ($request_method = OPTIONS) {
      return 204;
    }
  }

  # Frame ingestion endpoint — higher rate limit cho camera push
  location /api/ingestion/ {
    limit_req zone=api burst=200 nodelay;
    proxy_pass http://gateway:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### infra/certbot/init-letsencrypt.sh

```bash
#!/bin/bash
# Script chạy một lần để issue certificate lần đầu
# Cần DNS đã trỏ về server và port 80 đang mở

set -e

DOMAINS=("app.intelli-park.com" "api.intelli-park.com")
EMAIL="admin@intelli-park.com"
STAGING=0  # set 1 để test với Let's Encrypt staging server

if [ $STAGING != "0" ]; then
  STAGING_FLAG="--staging"
fi

# Tạo dummy certs để nginx có thể start
for domain in "${DOMAINS[@]}"; do
  mkdir -p /etc/letsencrypt/live/$domain
  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout /etc/letsencrypt/live/$domain/privkey.pem \
    -out /etc/letsencrypt/live/$domain/fullchain.pem \
    -days 1 -subj "/CN=$domain"
done

# Start nginx với dummy certs
docker-compose up -d nginx

# Xóa dummy certs và issue real ones
for domain in "${DOMAINS[@]}"; do
  docker-compose run --rm certbot certonly \
    --webroot --webroot-path /var/www/certbot \
    $STAGING_FLAG \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $domain
done

# Reload nginx với real certs
docker-compose exec nginx nginx -s reload

echo "SSL setup complete!"
```

## Todo List

- [ ] Cập nhật `docker-compose.yml` — thêm nginx và certbot services
- [ ] Tạo `infra/nginx/nginx.conf`
- [ ] Tạo `infra/nginx/conf.d/app.conf`
- [ ] Tạo `infra/nginx/conf.d/api.conf`
- [ ] Tạo `infra/certbot/init-letsencrypt.sh`
- [ ] DNS: trỏ `app.intelli-park.com` và `api.intelli-park.com` về server IP
- [ ] Chạy `init-letsencrypt.sh` trên staging server
- [ ] Verify HTTPS hoạt động cho cả 2 domains
- [ ] Test cert auto-renewal: `docker-compose run --rm certbot renew --dry-run`
- [ ] Verify security headers (dùng securityheaders.com)

## Success Criteria

- `https://app.intelli-park.com` load Next.js frontend, SSL valid
- `https://api.intelli-park.com/api` respond từ NestJS, SSL valid
- HTTP → HTTPS redirect hoạt động cho cả 2 domains
- Let's Encrypt cert tự động renew qua certbot cron
- Security headers: X-Frame-Options, HSTS, X-Content-Type-Options

## Security Considerations

- HSTS header với `max-age=31536000` — không thể undo dễ dàng, chắc chắn trước khi enable
- Rate limiting tại Nginx level để protect API
- Frame ingestion endpoint có riêng rate limit cao hơn (camera push tần suất cao)
- CORS restrict `Access-Control-Allow-Origin` chỉ `app.intelli-park.com`
