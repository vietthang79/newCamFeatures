# Intelli-Park — Tóm Tắt Tất Cả Plans

> Cập nhật: 2026-05-07 | Trạng thái: Tất cả ⏳ Pending

---

## Dependency Order

```
Sprint 0 (Infrastructure)
    └─► EP-1 (Multi-Tenant Foundation)
            └─► EP-2 (Camera & Zone Setup)
```

---

## Master Plan

**Mục tiêu:** Hệ thống monitoring bãi đỗ xe thông minh đa tenant.

- Camera Milesight push ảnh → AI worker phân tích → Dashboard real-time
- 2 roles: `vendor_admin` (quản lý tất cả) và `operator` (chỉ thấy company mình)
- FE đã implement UI hoàn chỉnh với mock data — cần BE để thay thế

---

## Sprint 0 — Infrastructure (5 phases)

**Mục tiêu:** Monorepo + Docker + CI/CD + HTTPS + DB migrations sẵn sàng trước khi code business logic.

| Phase | Làm gì |
|-------|--------|
| **01 — Monorepo Restructure** | Chuyển Next.js hiện tại (ở root) vào `frontend/`, tạo skeleton cho `gateway-nest/` (NestJS), `ai-workers/` (Python), `infra/` (Nginx). Root `package.json` với npm workspaces + Makefile. |
| **02 — Docker Compose** | File `docker-compose.yml` khởi động 6 services: frontend (3000), gateway (4000), ai-worker (8000), MSSQL (1433), PostgreSQL+TimescaleDB (5432), Redis (6379). Multi-stage Dockerfile cho FE và BE. |
| **03 — CI/CD GitHub Actions** | 3 workflows: `ci.yml` (test+build mọi push), `deploy-staging.yml` (auto-deploy khi merge vào main), `cost-alert.yml` (check billing hàng ngày). Branch protection: 1 reviewer required. |
| **04 — HTTPS Let's Encrypt** | Nginx reverse proxy SSL termination cho 2 domain: `app.intelli-park.com` → FE, `api.intelli-park.com` → BE. Certbot auto-renew. Rate limiting API. |
| **05 — Database Migrations** | Setup TypeORM cho MSSQL (`make migrate-mssql`) và Alembic cho PostgreSQL (`make migrate-postgres`). `make migrate` chạy cả 2. |

---

## EP-1 — Multi-Tenant Foundation (5 phases)

**Mục tiêu:** Auth system + company/user management + tenant isolation. Sau EP-1, operator đăng nhập và chỉ thấy data của company mình.

| Phase | Làm gì |
|-------|--------|
| **01 — NestJS Bootstrap** | Setup NestJS app skeleton: module structure, TypeORM kết nối MSSQL, config module cho env vars, global exception filter, CORS. |
| **02 — Database Schema & Seed** | Tạo 3 MSSQL tables: `companies`, `users` (với `company_id` FK), `audit_logs`. Seed tài khoản admin mặc định. TypeORM entities + migration files. |
| **03 — Auth, Companies & Users API** | JWT auth (httpOnly cookie), `TenantGuard` tự động filter `WHERE company_id = jwt.companyId`, CRUD APIs cho `/api/companies` và `/api/users`, audit log mỗi lần login. |
| **04 — Frontend Auth Wiring** | Thay mock auth trong FE bằng real API calls. Update `auth-context.tsx`, `login/page.tsx`, tạo `api-client.ts`. Xóa `mock-auth-data.ts`. |
| **05 — Vendor Admin UI** | Wire admin pages (companies list/create/edit, users list/create/edit, company switcher) tới real API. Thay `data-store.tsx` mock state bằng API calls. |

---

## EP-2 — Camera & Zone Setup (5 phases)

**Mục tiêu:** Đăng ký camera Milesight, vẽ geo-zones, nhận frames từ camera, monitor health. Sau EP-2, hệ thống có thể nhận dữ liệu thật từ camera.

| Phase | Làm gì |
|-------|--------|
| **01 — Camera Registration** | MSSQL table `cameras`. NestJS CRUD endpoint. Test ONVIF connection (10s timeout). Credentials encrypted AES-256 at rest. `site_key` UUID ngẫu nhiên per camera. Wire FE camera form tới real API. |
| **02 — Camera Setup Instructions** | Tạo mới page `/cameras/[id]/setup-instructions` (chưa có trong FE). Hướng dẫn step-by-step cấu hình Milesight HTTP Push với site key, URL, screenshots. Copy button 1 click. Polling detect frame đến. |
| **03 — Zone Drawing API** | MSSQL table `zones` (points normalized 0–1). NestJS CRUD `/api/cameras/:id/zones`. Wire `ZoneEditor` Konva component (đã functional với mock) tới real API. Load latest snapshot làm background. |
| **04 — Frame Ingestion Endpoint** | NestJS `POST /api/ingestion/frames` nhận HTTP push từ Milesight (multipart/form-data + site_key auth). Lưu metadata vào PostgreSQL TimescaleDB hypertable. Update Redis `last_frame_at`. ~2 FPS per camera. |
| **05 — Admin Health Dashboard** | API `GET /api/admin/health` (vendor_admin only). Query PostgreSQL frames + Redis last_frame_at. Wire `/admin/health` FE (đã có UI). Health badge: 🟢 <60s, 🟡 <5min, 🔴 never. Auto-refresh 30s. |

---

## Trạng Thái Tổng Thể

| Epics | Phases | Trạng thái |
|-------|--------|-----------|
| Sprint 0 | 5 phases | ⏳ Tất cả Pending |
| EP-1 | 5 phases | ⏳ Tất cả Pending |
| EP-2 | 5 phases | ⏳ Tất cả Pending |
| **Tổng** | **15 phases** | **0 / 15 hoàn thành** |

> FE đã implement UI hoàn chỉnh với mock data. Cần implement BE (Sprint 0 → EP-1 → EP-2) rồi wire FE.
