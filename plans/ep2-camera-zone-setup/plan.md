# EP-2 — Camera & Zone Setup

**Status:** ⏳ Pending  
**Priority:** 🔴 Critical  
**Depends on:** [Sprint 0](../sprint-0-infrastructure/plan.md) + [EP-1](../ep1-multi-tenant-foundation/plan.md)

## Overview

Implement camera registration, configuration instructions, zone drawing, frame ingestion, và health monitoring. Sau EP-2, operator có thể đăng ký camera Milesight, draw geo-zones, và hệ thống nhận frames từ camera.

## User Stories

### EP2-T1: An operator can register a new Milesight camera
### EP2-T2: An operator can configure the camera to send images to Intelli-Park
### EP2-T3: An operator can draw geo-zones on the camera image
### EP2-T4: A vendor admin can monitor the health of all sites

## Acceptance Criteria Summary

| Story | Key Criteria |
|-------|-------------|
| T1 | Form đăng ký camera; test connection via ONVIF; success/failure trong 10s; credentials encrypted |
| T2 | "Setup Instructions" page với site key, destination URL, Milesight screenshots; copy buttons; frame arrival detection |
| T3 | Konva canvas với latest snapshot; vẽ polygons; label (parking/entrance/no-smoking); save tới DB |
| T4 | `/admin/health` — bảng per-company + per-camera; badges green/yellow/red; auto-refresh 30s |

## Phases

| # | File | Description | Status |
|---|------|-------------|--------|
| 01 | [phase-01-camera-registration.md](./phase-01-camera-registration.md) | NestJS camera endpoint, ONVIF probe, AES-256 | ⏳ Pending |
| 02 | [phase-02-camera-setup-instructions.md](./phase-02-camera-setup-instructions.md) | Tạo mới setup instructions page | ⏳ Pending |
| 03 | [phase-03-zone-drawing-api.md](./phase-03-zone-drawing-api.md) | Zones MSSQL entity + wire ZoneEditor FE | ⏳ Pending |
| 04 | [phase-04-frame-ingestion-endpoint.md](./phase-04-frame-ingestion-endpoint.md) | POST /ingestion/frames; TimescaleDB; Redis | ⏳ Pending |
| 05 | [phase-05-health-dashboard.md](./phase-05-health-dashboard.md) | Admin health dashboard với real data | ⏳ Pending |

## Data Flow

```
Milesight Camera
  │  HTTP POST /api/ingestion/frames
  │  Headers: X-Site-Key: <camera_site_key>
  │  Body: multipart/form-data (image + metadata)
  ▼
NestJS IngestionController
  ├── Validate site key → lookup camera_id
  ├── Write to PostgreSQL frame_ingestion_log (TimescaleDB)
  └── UPDATE Redis: camera:<id>:last_frame_at = now()
                    camera:<id>:fps = calculated

Health Dashboard (FE)
  │  GET /api/admin/health
  ▼
NestJS AdminController
  ├── Query PostgreSQL: frames per company/camera (last 24h)
  └── Query Redis: last_frame_at per camera
      → health badge: green (<60s), yellow (<5min), red (older/never)
```

## Camera Model

**Standardised camera:** Milesight MS-C8241-X36PE  
**Push method:** HTTP Notification (native support, no edge bridge needed)  
**Push interval:** 500ms (≈ 2 FPS)  
**Snapshot:** attached to HTTP push

## Technical Notes

- Cameras tagged với `company_id` → invisible tới other companies (TenantGuard)
- Camera credentials encrypted với AES-256 trước khi save vào MSSQL
- `site_key` là UUID ngẫu nhiên, unique per camera — dùng để authenticate Milesight push
- Zones lưu `points_json` (normalized 0–1) + `version` + `camera_id` trong MSSQL
- Zone tab route: FE dùng `geo-zones/` — giữ nguyên

## FE Current State

FE đã có:
- ✅ `app/(dashboard)/cameras/page.tsx` — camera list
- ✅ `app/(dashboard)/cameras/new/page.tsx` — camera form
- ✅ `app/(dashboard)/cameras/[id]/overview/page.tsx` — status, metrics
- ✅ `app/(dashboard)/cameras/[id]/geo-zones/page.tsx` — giữ nguyên
- ✅ `app/(dashboard)/cameras/[id]/configuration/page.tsx`
- ✅ `app/(dashboard)/cameras/[id]/health/page.tsx`
- ✅ `components/zones/zone-editor.tsx` — Konva canvas (functional)
- ✅ `components/shared/copy-button.tsx` — dùng cho setup instructions
- ✅ `lib/use-poll.ts` — polling hook (dùng cho 30s health refresh)
- ❌ Setup instructions page — **chưa có, cần tạo mới**
