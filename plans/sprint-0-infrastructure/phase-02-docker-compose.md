# Phase 02 — Docker Compose

**Status:** ⏳ Pending  
**Priority:** 🔴 Critical  
**Effort:** ~3 hours  
**Depends on:** Phase 01 (monorepo structure)

## Overview

Tạo `docker-compose.yml` tại root để khởi động toàn bộ stack với một lệnh: `docker-compose up`.

## Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `frontend` | build `frontend/` | 3000 | Next.js server |
| `gateway` | build `gateway-nest/` | 4000 | NestJS API |
| `ai-worker` | build `ai-workers/` | 8000 | Python AI worker |
| `mssql` | `mcr.microsoft.com/mssql/server:2022-latest` | 1433 | Main database |
| `postgres` | `timescale/timescaledb:latest-pg15` | 5432 | Analytics DB |
| `redis` | `redis:7-alpine` | 6379 | Cache/real-time state |

## Files to Create

- `/docker-compose.yml`
- `/docker-compose.override.yml` (local dev overrides)
- `/.env.example`
- `/frontend/Dockerfile`
- `/gateway-nest/Dockerfile`
- `/infra/nginx/nginx.conf` (placeholder — full config trong Phase 04)

## Implementation

### docker-compose.yml

```yaml
version: '3.9'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:4000
    depends_on:
      - gateway
    restart: unless-stopped

  gateway:
    build:
      context: ./gateway-nest
      dockerfile: Dockerfile
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - PORT=4000
      - MSSQL_HOST=mssql
      - MSSQL_PORT=1433
      - MSSQL_USER=${MSSQL_USER}
      - MSSQL_PASSWORD=${MSSQL_PASSWORD}
      - MSSQL_DATABASE=${MSSQL_DATABASE}
      - POSTGRES_HOST=postgres
      - POSTGRES_PORT=5432
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DATABASE=${POSTGRES_DATABASE}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - CAMERA_ENCRYPTION_KEY=${CAMERA_ENCRYPTION_KEY}
    depends_on:
      mssql:
        condition: service_healthy
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped

  ai-worker:
    build:
      context: ./ai-workers
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - POSTGRES_HOST=postgres
      - POSTGRES_PORT=5432
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DATABASE=${POSTGRES_DATABASE}
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped
    # GPU: uncomment khi deploy trên GPU instance
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]

  mssql:
    image: mcr.microsoft.com/mssql/server:2022-latest
    ports:
      - "1433:1433"
    environment:
      - ACCEPT_EULA=Y
      - SA_PASSWORD=${MSSQL_PASSWORD}
      - MSSQL_PID=Developer
    volumes:
      - mssql_data:/var/opt/mssql
    healthcheck:
      test: /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "${MSSQL_PASSWORD}" -Q "SELECT 1" || exit 1
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
    restart: unless-stopped

  postgres:
    image: timescale/timescaledb:latest-pg15
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DATABASE}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DATABASE}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped

volumes:
  mssql_data:
  postgres_data:
  redis_data:
```

### docker-compose.override.yml (local dev)

```yaml
# Override for local development — hot reload, no restart policy
version: '3.9'

services:
  frontend:
    build:
      target: dev
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    environment:
      - NODE_ENV=development
    command: npm run dev
    restart: "no"

  gateway:
    volumes:
      - ./gateway-nest:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: npm run dev
    restart: "no"

  ai-worker:
    volumes:
      - ./ai-workers:/app
    environment:
      - PYTHONPATH=/app
    command: uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
    restart: "no"
```

### .env.example

```env
# MSSQL
MSSQL_USER=sa
MSSQL_PASSWORD=YourStrong@Password123
MSSQL_DATABASE=intellipark

# PostgreSQL + TimescaleDB
POSTGRES_USER=intellipark
POSTGRES_PASSWORD=YourStrong@Password456
POSTGRES_DATABASE=intellipark_analytics

# NestJS
JWT_SECRET=change-me-to-a-very-long-random-string-minimum-32-chars
CAMERA_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

# Cloud cost alert
CLOUD_COST_ALERT_THRESHOLD=400
```

### frontend/Dockerfile

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS dev
RUN npm ci
COPY . .
CMD ["npm", "run", "dev"]

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

> **Note:** Next.js standalone output cần thêm `output: 'standalone'` vào `next.config.js` khi build production Docker image.

### gateway-nest/Dockerfile

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS dev
RUN npm ci
COPY . .
CMD ["npm", "run", "dev"]

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/main"]
```

## Todo List

- [ ] Tạo `/docker-compose.yml`
- [ ] Tạo `/docker-compose.override.yml`
- [ ] Tạo `/.env.example`
- [ ] Tạo `frontend/Dockerfile` (multi-stage: dev + production)
- [ ] Tạo `gateway-nest/Dockerfile` (multi-stage: dev + production)
- [ ] Thêm `output: 'standalone'` vào `frontend/next.config.js` (cho production build)
- [ ] Test: `docker-compose up` khởi động tất cả 6 services
- [ ] Xác nhận healthcheck MSSQL hoạt động (có thể mất 30-60s lần đầu)
- [ ] Thêm `.env` vào `.gitignore`

## Success Criteria

- `docker-compose up --build` khởi động tất cả 6 services thành công
- Frontend accessible tại `http://localhost:3000`
- Gateway accessible tại `http://localhost:4000/api`
- MSSQL healthcheck pass (sqlcmd `SELECT 1`)
- PostgreSQL healthcheck pass (`pg_isready`)
- Redis running (`redis-cli ping` → `PONG`)

## Security Considerations

- `.env` file không commit — dùng `.env.example` làm template
- MSSQL SA password phải strong (uppercase + lowercase + number + special char)
- Production: dùng Docker Secrets hoặc cloud secret manager thay vì env vars
