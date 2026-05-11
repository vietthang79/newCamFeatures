# Intelli-Park — Master Plan

## Project Overview

**Intelli-Park** là hệ thống monitoring bãi đỗ xe thông minh đa tenant. Camera Milesight tại các bãi đẩy frame ảnh lên server, AI worker phân tích hành vi (đỗ xe, ra vào, no-smoking), kết quả hiển thị real-time trên dashboard cho từng công ty khách hàng.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet                                  │
│                                                                  │
│   app.intelli-park.com          api.intelli-park.com            │
│          │                              │                        │
└──────────┼──────────────────────────────┼────────────────────────┘
           │                              │
    ┌──────▼──────┐                ┌──────▼──────┐
    │   Next.js   │                │   Nginx      │
    │  (frontend) │                │  (reverse    │
    │  Port 3000  │                │   proxy)     │
    └─────────────┘                └──────┬───────┘
                                          │
                               ┌──────────▼──────────┐
                               │   NestJS Gateway     │
                               │   (gateway-nest)     │
                               │   Port 4000          │
                               └──┬──────────┬────────┘
                                  │          │
              ┌───────────────────┘          └──────────────┐
              │                                             │
   ┌──────────▼──────────┐                    ┌────────────▼───────┐
   │  MSSQL (main DB)    │                    │  PostgreSQL +       │
   │  - companies        │                    │  TimescaleDB        │
   │  - users            │                    │  - frame_ingestion  │
   │  - cameras          │                    │  - alerts           │
   │  - zones            │                    └────────────┬───────┘
   └─────────────────────┘                                 │
                                              ┌────────────▼───────┐
              ┌────────────────────────────── │   Redis             │
              │                               │  (real-time state)  │
   ┌──────────▼──────────┐                    └────────────────────┘
   │  Python AI Worker   │
   │  (ai-workers)       │◄── Milesight Cameras (HTTP Push)
   │  Single GPU: T4/A10 │
   └─────────────────────┘
```

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript | Switch từ static export → server mode |
| **UI** | Tailwind CSS 4, Radix UI (shadcn), react-konva | Đã implement |
| **Backend** | NestJS (Node.js), TypeScript | gateway-nest/ workspace |
| **AI Worker** | Python FastAPI | ai-workers/ workspace, Sprint 0 skeleton only |
| **Main DB** | Microsoft SQL Server (MSSQL) | TypeORM migrations |
| **Analytics DB** | PostgreSQL + TimescaleDB | Alembic migrations, time-series |
| **Cache/State** | Redis | Real-time camera status |
| **Auth** | JWT (passport-jwt), httpOnly cookies | TenantGuard per-query filtering |
| **Container** | Docker Compose (Sprint 1), Kubernetes (later) | |
| **CI/CD** | GitHub Actions | Push→test→build; merge→deploy staging |
| **HTTPS** | Let's Encrypt + Nginx | 2 domains |
| **Camera** | Milesight MS-C8241-X36PE | ONVIF probe, HTTP Push frames |

## Epics & Sprints

### Sprint 0 — Infrastructure (Week 1, must finish before anything else)
**Goal:** Monorepo, Docker Compose, CI/CD, HTTPS sẵn sàng — team có thể ship code từ ngày đầu.

→ [Sprint 0 Plan](./sprint-0-infrastructure/plan.md)

### EP-1 — Multi-Tenant Foundation
**Tickets:**
- **EP1-T1:** Vendor admin tạo companies và users
- **EP1-T2:** User đăng nhập và chỉ thấy data của company mình

→ [EP-1 Plan](./ep1-multi-tenant-foundation/plan.md)

### EP-2 — Camera & Zone Setup
**Tickets:**
- **EP2-T1:** Operator đăng ký camera Milesight mới
- **EP2-T2:** Operator cấu hình camera gửi ảnh lên Intelli-Park
- **EP2-T3:** Operator vẽ geo-zones trên ảnh camera
- **EP2-T4:** Vendor admin monitor health tất cả sites

→ [EP-2 Plan](./ep2-camera-zone-setup/plan.md)

## Roles

| Role | Access |
|------|--------|
| `vendor_admin` | Xem/quản lý tất cả companies; company switcher; /admin/* |
| `operator` | Chỉ thấy data của company mình; cameras/geo-zones của company |

## Domain URLs

| URL | Service |
|-----|---------|
| `app.intelli-park.com` | Next.js frontend |
| `api.intelli-park.com` | NestJS API gateway |

## Key Design Decisions

1. **TenantGuard**: Mọi query đều tự động filter `WHERE company_id = $jwtCompanyId`. Vendor admin bypass guard. Nếu operator cố truy cập data company khác qua URL → 403.

2. **Camera credential encryption**: AES-256 at rest trong MSSQL. Key lưu trong env var, không commit.

3. **Frame ingestion flow**: Milesight → POST `api.intelli-park.com/ingestion/frames` (với site key) → NestJS lưu vào TimescaleDB + update Redis `last_frame_at`.

4. **Zones**: Lưu dưới dạng normalized coordinates (0–1) trong `points_json` MSSQL field. FE convert sang pixel khi render trên Konva canvas.

5. **Zone route**: FE dùng route `/cameras/[id]/geo-zones` — giữ nguyên tên này.

## Current FE State (Reference)

FE đã implement UI hoàn chỉnh với mock data. Sau khi BE sẵn sàng, FE cần:
- Thay `lib/mock-data.ts` và `lib/mock-auth-data.ts` → real API calls
- Switch `next.config.js` từ `output: 'export'` → server mode
- Move toàn bộ code vào `frontend/` workspace
- Thêm trang `/cameras/[id]/setup-instructions` (chưa có trong FE)

## Cloud Cost Budget

Alert tại **$400/month**. Cấu hình billing alert trên cloud provider trước khi deploy production.
