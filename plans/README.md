# Intelli-Park — Implementation Plans

## Quick Navigation

| Plan | Description | Status |
|------|-------------|--------|
| [Master Plan](./master-plan.md) | Tổng quan dự án, architecture, tech stack | 📋 Reference |
| [Sprint 0: Infrastructure](./sprint-0-infrastructure/plan.md) | Monorepo, Docker, CI/CD, HTTPS, DB migrations | ⏳ Pending |
| [EP-1: Multi-Tenant Foundation](./ep1-multi-tenant-foundation/plan.md) | Auth, Companies, Users, Tenant isolation | ⏳ Pending |
| [EP-2: Camera & Geo-Zones Setup](./ep2-camera-zone-setup/plan.md) | Camera registration, geo-zones, frame ingestion, health | ⏳ Pending |

## Dependency Order

```
Sprint 0 (Infrastructure)
    └─► EP-1 (Multi-Tenant Foundation)
            └─► EP-2 (Camera & Geo-Zones Setup)
```

Sprint 0 phải hoàn thành trước. EP-1 và EP-2 có thể overlap ở một số phases sau khi infra sẵn sàng.

## Current Codebase State

FE hiện tại (`/`) là Next.js 14 App Router với **mock data hoàn toàn** — không có backend, không có database thật. Đây là reference UI cho toàn bộ hệ thống.

Sprint 0 sẽ restructure thành monorepo:
```
/
├── frontend/     ← move từ root vào đây
├── gateway-nest/ ← NestJS API gateway (mới)
├── ai-workers/   ← Python AI worker (skeleton)
├── infra/        ← Nginx, certs, deployment config
└── docker-compose.yml
```

## Conventions

- **Status labels:** ⏳ Pending | 🚧 In Progress | ✅ Done | ❌ Blocked
- **Priority:** 🔴 Critical | 🟡 High | 🟢 Normal
- **Phase file format:** `phase-NN-kebab-name.md`
