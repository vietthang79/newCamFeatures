---
title: "Intelli-Park Camera Management System (Sprint 1)"
description: "Multi-tenant SaaS for Milesight camera registration, zone drawing, frame ingestion, and health monitoring."
status: pending
priority: P1
effort: 40h
branch: main
tags: [nestjs, nextjs, multi-tenant, camera, milesight, sprint-1]
created: 2026-05-05
---

# Intelli-Park Camera Management System

## Goal
Sprint 1 internal demo: register Milesight MS-C8241-X36PE cameras, view configuration, draw zones, ingest frames via HTTP push, and monitor camera health (operator + vendor admin).

## Tech Stack
- Backend: NestJS + TypeORM
- Frontend: Next.js (App Router)
- DB: MSSQL (business), PostgreSQL (time-series logs)
- Queue: Redis + Bull
- Drawing: react-konva (SSR disabled)
- Auth: JWT (company_id in claims) — assumed already wired

## Architecture (high-level)
```
Camera (Milesight) ──HTTP push──> NestJS /ingest ──Bull queue──> Worker
                                                                     ├─> PostgreSQL (frame_ingestion_log)
                                                                     └─> MSSQL (camera.last_frame_at)

Next.js UI ──REST──> NestJS API ──> MSSQL (companies, cameras, zones, users)
                                  └─> PostgreSQL (logs, alerts) [for health views]
```

## Current State (as of 2026-05-06)

### What is built

#### Frontend (Next.js) — fully functional with mock data
- **Pages implemented:**
  - `/login` — glassmorphism card, company selector (step 1), credentials form (step 2), demo accounts for selected company
  - `/cameras` — table view with search, status filtering, delete action, mobile card view (company-scoped via effectiveCompanyId)
  - `/cameras/new` — registration form (IP, port, username, password validation, random success), 70% success rate demo
  - `/cameras/[id]/overview` — snapshot placeholder, refresh button, camera details (model, location, registered date, last frame)
  - `/cameras/[id]/configuration` — HTTP push endpoint URL and trigger interval (copy buttons)
  - `/cameras/[id]/health` — status banner, KPI cards (FPM, uptime, errors), activity bar chart (last 12h), auto-refresh animation
  - `/cameras/[id]/zones` — canvas editor (react-konva, SSR disabled), zone toolbar, zone list with delete
  - `/admin/companies` — table with search, new/edit/delete, status badge, shows user count before deletion check
  - `/admin/companies/new` — name input, auto-generated slug display, status select
  - `/admin/companies/[id]` — edit company, shows assigned user count
  - `/admin/users` — table with search, role filter, company filter, new/edit/delete
  - `/admin/users/new` — full form (name, email, password, role, company, status), validation (email uniqueness, password min 6 chars, operators must have company)
  - `/admin/users/[id]` — edit user, optional password update, role/company disabledfor self, prevents self-status-change

#### Authentication & Authorization
- **Login flow:** Company selector → credentials → session stored in localStorage + `ip-session` cookie (base64-encoded, not JWT)
- **Route protection:** `middleware.ts` checks `ip-session` cookie; redirects unauthenticated to `/login`; excludes `/api/` and `/image/` routes
- **Multi-tenancy:** `useAuth()` returns `effectiveCompanyId` (selected company for vendor_admin, company_id for operator)
- **Role-based pages:** Vendor admin sees /admin routes; operator does not (sidebar conditionally renders)
- **Admin access guard:** `/admin/health` returns 403 for non-vendor_admin

#### Data Management (Mock)
- **Auth data:** `lib/mock-auth-data.ts` contains `INITIAL_USERS` (6 users, 4 companies), INITIAL_COMPANIES
- **Camera data:** `lib/mock-data.ts` contains `MOCK_CAMERAS` (8 cameras), `MOCK_ZONES` (2 zones), `MOCK_COMPANIES` (company → camera assignments)
- **Data store:** `lib/data-store.tsx` provides Context API (addCompany, updateCompany, deleteCompany, addUser, updateUser, deleteUser)
- **Camera deletion:** In-memory Set tracked via `deletedIds` state in cameras page

#### UI Components
- **Layout:** Sidebar (company selector for admin, logout), topbar, responsive desktop/mobile
- **Status badge:** Color-coded (online=green, warning=yellow, offline=red, pending=gray)
- **Health banner:** Color-coded alert with last frame timestamp
- **Snapshot placeholder:** Gray placeholder with optional label
- **Data table:** Sortable columns, search, status filters, row actions, expandable rows, mobile card fallback
- **Shared:** Copy button, loading button with spinner, confirm dialog
- **Zone editor:** Canvas with point selection, multiple zone types (parking_zone, entrance_zone, no_smoking_zone), undo/redo via state

#### Styling
- **Theme:** Light mode (white bg, gray text, green accents)
- **Brand colors:** Primary `#93D500` (lime green), secondary `#007BFF` (blue), accent `#009D4F` (dark green), light bg `#E8F5E9`
- **Tailwind:** Configured with custom colors in `tailwind.config.js`

### What is NOT built

- **No NestJS backend** — no `apps/api/` directory exists
- **No real JWT** — authentication uses base64-encoded mock session (not signed/verified)
- **No real databases** — all data in-memory (lost on refresh), no MSSQL or PostgreSQL connection
- **No frame ingestion endpoint** — no HTTP push receiver at `/api/ingest/{camera_id}`
- **No Redis/Bull queue** — frame processing not implemented
- **No API client** — no `lib/api-client.ts`, no HTTP layer for CRUD operations
- **No real camera API** — ONVIF probe in `/cameras/new` is mock (random success, no actual connection test)
- **No password encryption** — no AES-256, camera credentials not stored
- **No zone persistence** — zone edits in memory only
- **No alert system** — health view shows dummy metrics (24.6 FPM, 98.2% uptime, random errors)
- **No operator camera dashboard** — operator landing page is empty

## Phases
| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 01 | [Project Setup](./phase-01-project-setup.md) | mock-complete | 6h |
| 02 | [Camera Registration (T1)](./phase-02-camera-registration.md) | mock-complete | 8h |
| 03 | [Frame Ingestion Endpoint](./phase-03-frame-ingestion-endpoint.md) | pending | 6h |
| 04 | [Configuration Tab (T2)](./phase-04-configuration-tab.md) | mock-complete | 3h |
| 05 | [Zone Drawing (T3)](./phase-05-zone-drawing.md) | mock-complete | 9h |
| 06 | [Health Dashboards (T4A+T4B)](./phase-06-health-dashboard.md) | mock-complete | 8h |

## Dependencies
- Phase 01 blocks all others.
- Phase 03 must complete before Phase 06 (health depends on frame_ingestion_log).
- Phase 02 blocks Phase 04, 05 (need camera record).

## Key Decisions
- **Multi-tenancy:** `company_id` from JWT claims, injected via `RequestContextInterceptor`. All queries auto-scoped.
- **Camera password:** AES-256 encrypted at rest in MSSQL (Node `crypto`, random IV per encrypt).
- **Status:** `camera.status` driven by Phase 03 frame health, not registration.
- **Zones:** Normalized [0-1] coords, stored as JSON in MSSQL with `version` field. Hard delete only.
- **Health polling:** 30s client-side (KISS).

## Out of Scope (Sprint 1)
- AI pipeline (smoking/parking/entry-exit detection)
- Soft delete, audit logs
- Alert UI beyond count
- WebSocket real-time updates

## Open Questions
- Frame ingestion auth: shared secret vs site_key validation? (assumed site_key = camera.id, validated against DB)
- AES-256 key rotation strategy (out of scope Sprint 1)
