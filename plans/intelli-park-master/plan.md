---
title: "Intelli-Park Camera Management System — Master Plan"
description: "Multi-tenant SaaS platform for Milesight camera registration, zone drawing, frame ingestion, and health monitoring with company and user management."
status: in-progress
version: 1.0
updated: 2026-05-06
tags: [nextjs, nestjs, mssql, postgresql, multi-tenant, camera, milesight, sprint-1]
---

# Intelli-Park Camera Management System — Master Plan

## Executive Summary

Intelli-Park is a multi-tenant SaaS camera management platform that allows parking facility operators (via vendor admins) to register Milesight IP cameras, draw detection zones (parking spots, entrances, no-smoking areas), ingest live video frames via HTTP push, and monitor camera health in real-time. Current status: **Next.js frontend 100% functional with mock data**; **NestJS backend not started**. Sprint 1 goal: build backend foundation (auth, companies, users, camera registration, frame ingestion, zone persistence) to replace mock data and enable live camera operations.

## Product Overview

### Goal

Build a scalable, multi-tenant camera management system where:
- **Vendor admins** (Intelli-Park staff) create companies, manage operators, and oversee all camera operations
- **Operators** (parking facility staff) register cameras, configure zones, view live snapshots, and monitor camera health per their assigned company
- Cameras push live frames via HTTP, which are logged and processed for downstream AI (parking detection, entry/exit counting, etc.)

### Users

| Role | Description | Permissions |
|------|-------------|-----------|
| **vendor_admin** | Intelli-Park staff | Create/edit/delete companies; create/edit/delete operators; view any company's cameras and zones; upload/manage multi-company configs |
| **operator** | Parking facility staff | Register/configure cameras (their company only); draw/edit zones; view snapshots; monitor camera health; cannot create users or manage other companies |

### Tech Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| **Frontend** | Next.js 14 (App Router), React 18, TailwindCSS, react-konva, react-hook-form | ✓ Mock-complete (14 pages, all UI done) |
| **Backend** | NestJS, TypeORM, Passport JWT, class-validator, bcrypt | ✗ Not started |
| **Business DB** | MSSQL (companies, users, cameras, zones) | ✗ Schema designed, not created |
| **Time-series DB** | PostgreSQL (frame_ingestion_log, alerts, metrics) | ✗ Not started |
| **Queue/Worker** | Redis + Bull (frame ingestion processing) | ✗ Not started |
| **Crypto** | Node `crypto` (AES-256-GCM for camera passwords) | ✗ Not started |
| **ONVIF** | node-onvif library (camera probing, snapshot fetch) | ✗ Not started |

---

## Current State (as of 2026-05-06)

### Frontend — Mock-Complete ✓

**All 14 pages built and fully functional with mock data:**

| Route | Component | Data Source | What Works |
|-------|-----------|------------|-----------|
| `/login` | Glassmorphism card, 2-step (company → credentials) | `INITIAL_USERS`, `INITIAL_COMPANIES` | Login validates creds, stores mock JWT (base64) in localStorage + cookie, redirects to dashboard |
| `/cameras` | Table/card view, search, status filter, delete | `MOCK_CAMERAS` via `useData()` | Lists company-scoped cameras, sort by status, delete removes from state |
| `/cameras/new` | Registration form (IP, port, user, pass) | Mock 70% success rate | Form validates inputs, simulates ONVIF probe, returns success/failure |
| `/cameras/[id]/overview` | Snapshot placeholder, details, refresh | `MOCK_CAMERAS` | Shows camera model, location, created date, last frame time, refresh button |
| `/cameras/[id]/configuration` | HTTP push endpoint URL, trigger interval | Mock constants | Copy-to-clipboard for endpoint and interval config |
| `/cameras/[id]/health` | Status banner, KPI cards (FPM, uptime, errors), 12h activity bar chart, auto-refresh | Mock metrics | Shows color-coded health, activity over time, 30s polling animation |
| `/cameras/[id]/zones` | React-Konva canvas editor, zone list, toolbar | `MOCK_ZONES` in state | Draw polygons by clicking points, drag points, delete zones, save (in-memory only) |
| `/admin/companies` | Table with search, new/edit/delete, status badge, user count | `DataProvider` (in-memory) | Create company with auto-slug; show assigned users before deletion confirm |
| `/admin/companies/new` | Name input, auto slug display, status select | Form state | Generate slug in real-time as user types |
| `/admin/companies/[id]` | Edit company name, slug preview, status | Form state | Save updates to in-memory store via `updateCompany()` |
| `/admin/users` | Table with search, role filter, company filter, new/edit/delete | `DataProvider` (in-memory) | Create/edit operator with validation (email unique, password ≥6 chars, operator must have company) |
| `/admin/users/new` | Full form (name, email, password, role, company, status) | Form state | Validate on submit, prevent self-deletion, prevent self-role/company change |
| `/admin/users/[id]` | Edit user, optional password update | Form state | Disabled role/company fields for self-edit, status change forbidden for self |
| `/` (root) | Redirect to `/cameras` | Route rule | Authenticated users land on cameras dashboard |

**Authentication & Authorization:**
- **Login flow:** Step 1 selects company (filters users by that company); Step 2 enters email/password; credentials validated against `INITIAL_USERS`; on success, session stored in `localStorage` + `ip-session` cookie (base64-encoded)
- **Route protection:** `middleware.ts` checks `ip-session` cookie; redirects missing/invalid to `/login`; excludes `/api/`, `/image/`, static asset routes
- **Multi-tenancy:** `useAuth()` hook provides `effectiveCompanyId` (selected company for vendor_admin; assigned company for operator)
- **Role-based rendering:** Sidebar conditionally shows `/admin` links for vendor_admin only; `/admin/*` pages return 403 for non-vendor_admin
- **Company scoping:** All camera/user lists filtered by `effectiveCompanyId`

**Data Management (Mock):**
- **Auth data:** `lib/mock-auth-data.ts` — 4 companies, 6 users (1 vendor_admin, 5 operators)
- **Camera data:** `lib/mock-data.ts` — 8 mock cameras, 2 mock zones, distributed across 4 companies
- **Data store:** `lib/data-store.tsx` — React Context provides in-memory CRUD (survives component re-renders, lost on page refresh)
- **Auth context:** `lib/auth-context.tsx` — login/logout, session storage, company switcher for vendor_admin

**UI Components:**
- **Layout:** Sidebar (nav links + company selector for admin + logout), topbar (responsive)
- **Status badge:** Color-coded (online=green #93D500, warning=yellow #FBC02D, offline=red #D32F2F, pending=gray #9E9E9E)
- **Health banner:** Alerts with timestamp and status color
- **Data table:** Sortable columns, full-text search, status filters, row actions (edit/delete), expandable rows, mobile card fallback
- **Shared components:** Copy button, loading button with spinner, confirm dialog
- **Zone editor:** Canvas stage with point-based polygon drawing, anchor handles for dragging, zone type dropdown, delete button per zone

**Styling & Branding:**
- **Theme:** Light mode (white backgrounds, dark text)
- **Brand colors:** Primary `#93D500` (lime green), secondary `#007BFF` (blue), accent `#009D4F` (dark green), backgrounds `#E8F5E9` (light green), hover `#2E7D32` (dark green)
- **Framework:** Tailwind CSS with custom color config in `tailwind.config.js`
- **Buttons:** Primary = black text on `#93D500`, hover darkens to `#2E7D32` with white text
- **Icons:** Lucide React

### Backend — Not Started ✗

**What does NOT exist:**
- No `apps/api/` directory — no NestJS application scaffolded
- No `apps/api/src/main.ts` or `app.module.ts`
- No TypeORM database connection code
- No JWT strategy or auth guards
- No API endpoints (`/api/auth/login`, `/api/companies/*`, `/api/users/*`, `/api/cameras/*`, etc.)
- No `lib/api-client.ts` in frontend — no HTTP layer to call backend
- No database schema (no `companies`, `users`, `cameras`, `zones` tables in MSSQL or PostgreSQL)
- No frame ingestion processing (no Bull queue, no Redis)
- No ONVIF camera probing or encryption
- No camera status computed from frame logs

**Current auth limitations (will be fixed in Phase 03):**
- Session is base64-encoded (not cryptographically signed) — anyone can forge a session
- Middleware uses `atob()` to decode — no JWT signature verification
- Login credentials hardcoded in frontend mock data
- Company isolation relies on frontend-side filtering only (no server-side enforcement)

### Data Layer (Current Mock)

**Companies (4 total):**
| ID | Name | Slug | Status | Created |
|----|------|------|--------|---------|
| co1 | UK Parking Control | uk-parking-control | active | 2024-01-01 |
| co2 | CityPark Ltd | citypark-ltd | active | 2024-01-15 |
| co3 | SecureSpace Group | securespace-group | active | 2024-02-01 |
| co4 | Metro Parking | metro-parking | inactive | 2024-02-15 |

**Users (6 total):**
| ID | Email | Name | Role | Company | Status |
|----|-------|------|------|---------|--------|
| u1 | admin@intellipark.io | Admin User | vendor_admin | (none) | active |
| u2 | john@ukparkingcontrol.com | John Smith | operator | co1 | active |
| u3 | jane@citypark.com | Jane Cooper | operator | co2 | active |
| u4 | mike@securespace.com | Mike Johnson | operator | co3 | active |
| u5 | sarah@metroparking.com | Sarah Wilson | operator | co4 | active |
| u6 | thang.nguyen@ukparkingcontrol.com | Thang Nguyen | operator | co1 | active |

**Cameras (8 total, assigned to companies):**
- co1: 4 cameras (Gate A, Lot B North, Lot A South, Loading Bay)
- co2: 4 cameras (Lot B North, Roof Level 3, etc.)
- co3: 3 cameras
- co4: Unassigned

All cameras use model `MS-C8241-X36PE` (Milesight IP camera). Statuses: 4 online, 2 warning, 2 offline, pending states mock-updated on demand.

**Zones (2 total, assigned to camera a3f7c2d1):**
- z1: parking_zone with 4 points (normalized [0-1] coords)
- z2: entrance_zone with 3 points

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Milesight Cameras (Vendor Hardware)                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP POST multipart/form-data
                     │ (2 FPS, 2–5 MB/s per camera)
                     ↓
┌─────────────────────────────────────────────────────────┐
│ NestJS Backend (apps/api/)                              │
│                                                          │
│  POST /ingest/:siteKey (Frame Processor)                │
│  ├─ Validate camera exists (siteKey lookup)            │
│  └─ Enqueue job → Bull 'frame-ingestion'               │
│                                                          │
│  Redis + Bull Queue                                      │
│  └─> FrameProcessor (concurrency=5)                     │
│      ├─ Write frame_ingestion_log → PostgreSQL         │
│      └─ Update camera.last_frame_at → MSSQL            │
│                                                          │
│  POST /api/auth/login (JWT generation)                  │
│  GET/POST/PATCH /api/companies/* (CRUD)                │
│  GET/POST/PATCH /api/users/* (CRUD)                    │
│  GET/POST /api/cameras/* (Register, fetch, delete)     │
│  POST /api/cameras/:id/zones (Save zones)              │
└────────────────┬──────────────┬──────────────────────────┘
                 │              │
      (MSSQL)    │              │    (PostgreSQL)
                 ↓              ↓
        ┌─────────────┐  ┌─────────────────────┐
        │ companies   │  │ frame_ingestion_log │
        │ users       │  │ (time-series)       │
        │ cameras     │  │ (indexed by camera, │
        │ zones       │  │  timestamp)         │
        └─────────────┘  └─────────────────────┘
                 ↑              ↑
                 └──────────────┘
           Both accessed by NestJS TypeORM

┌─────────────────────────────────────────────────────────┐
│ Next.js Frontend (root directory)                        │
│                                                          │
│ Pages:                                                   │
│  /login → AuthContext (JWT from /api/auth/login)        │
│  /cameras → list, new, [id]/overview/zones/config/health
│  /admin/companies → CRUD via /api/companies/*           │
│  /admin/users → CRUD via /api/users/*                  │
│                                                          │
│ Components:                                              │
│  <ZoneEditor> (react-konva) → POST /api/cameras/:id/zones
│  <StatusBadge>, <HealthBanner>                          │
│  <DataTable> (universal table for all CRUD pages)       │
└─────────────────────────────────────────────────────────┘
          HTTP REST
```

### Frontend Structure (Current)

```
app/                              Next.js App Router
├── layout.tsx                    Root layout (AuthProvider, DataProvider)
├── login/page.tsx                Login (company selector + credentials)
├── page.tsx                      Redirect to /cameras
└── (dashboard)/                  Protected route group
    ├── layout.tsx                Sidebar + topbar
    ├── cameras/
    │   ├── page.tsx              List cameras
    │   ├── new/page.tsx           Register new camera
    │   └── [id]/
    │       ├── layout.tsx         Camera subnav (tabs: overview, config, health, zones)
    │       ├── overview/page.tsx  Snapshot + details
    │       ├── configuration/page.tsx  HTTP endpoint config
    │       ├── health/page.tsx    KPI dashboard
    │       └── zones/page.tsx     Canvas editor
    └── admin/
        ├── companies/
        │   ├── page.tsx           List companies
        │   ├── new/page.tsx        Create company
        │   └── [id]/page.tsx       Edit company
        ├── users/
        │   ├── page.tsx            List users (by role & company)
        │   ├── new/page.tsx         Create user
        │   └── [id]/page.tsx        Edit user
        └── health/page.tsx          System health (admin-only)

components/
├── layout/
│   ├── sidebar.tsx               Nav + company switcher
│   └── topbar.tsx                Header, responsive menu
├── cameras/
│   ├── status-badge.tsx          Color-coded status
│   ├── health-banner.tsx         Alert banner
│   ├── snapshot-placeholder.tsx  Placeholder image
│   └── refresh-indicator.tsx     Polling spinner
├── zones/
│   ├── zone-editor.tsx           React-Konva canvas (dynamic import, ssr: false)
│   ├── zone-toolbar.tsx          Type picker, save, refresh buttons
│   └── zone-list.tsx             Zone listing with delete
├── shared/
│   ├── copy-button.tsx           Clipboard helper
│   ├── loading-button.tsx        Disabled on loading
│   └── confirm-dialog.tsx        Delete confirmation
└── ui/                            Radix UI + Tailwind primitives
    ├── button.tsx, input.tsx, dialog.tsx, etc.

lib/
├── auth-context.tsx              Session mgmt, login/logout
├── data-store.tsx                In-memory CRUD (companies, users)
├── mock-auth-data.ts             INITIAL_USERS, INITIAL_COMPANIES
├── mock-data.ts                  MOCK_CAMERAS, MOCK_ZONES
├── use-poll.ts                   30s polling hook (health dashboards)
├── utils.ts                       Utility functions (cn, formatDate, etc.)
└── zones/
    └── normalize.ts              Zone coordinate normalization [0-1]

types/
└── css.d.ts                       Tailwind type support

middleware.ts                      Route protection, JWT validation (mock)
tailwind.config.js                 Brand colors + Tailwind config
tsconfig.json                      TypeScript config
```

### Backend Structure (Target)

```
apps/
└── api/                           NestJS application (Phase 01+)
    src/
    ├── main.ts                    Bootstrap, global pipes/interceptors
    ├── app.module.ts              Root module
    ├── modules/
    │   ├── auth/
    │   │   ├── auth.module.ts
    │   │   ├── auth.controller.ts
    │   │   ├── auth.service.ts
    │   │   ├── jwt.strategy.ts
    │   │   └── dto/login.dto.ts
    │   ├── companies/
    │   │   ├── companies.module.ts
    │   │   ├── companies.controller.ts
    │   │   ├── companies.service.ts
    │   │   ├── entities/company.entity.ts
    │   │   └── dto/create-company.dto.ts, update-status.dto.ts
    │   ├── users/
    │   │   ├── users.module.ts
    │   │   ├── users.controller.ts
    │   │   ├── users.service.ts
    │   │   ├── entities/user.entity.ts
    │   │   └── dto/create-user.dto.ts, reassign-company.dto.ts, reset-password.dto.ts
    │   ├── cameras/
    │   │   ├── cameras.module.ts
    │   │   ├── cameras.controller.ts
    │   │   ├── cameras.service.ts
    │   │   ├── onvif-probe.service.ts
    │   │   ├── entities/camera.entity.ts
    │   │   └── dto/create-camera.dto.ts
    │   ├── zones/
    │   │   ├── zones.module.ts
    │   │   ├── zones.controller.ts
    │   │   ├── zones.service.ts
    │   │   ├── entities/zone.entity.ts
    │   │   └── dto/save-zones.dto.ts
    │   ├── ingestion/
    │   │   ├── ingestion.module.ts
    │   │   ├── ingestion.controller.ts
    │   │   ├── frame.processor.ts
    │   │   └── entities/frame-ingestion-log.entity.ts
    │   └── health/
    │       ├── health.module.ts
    │       ├── health.controller.ts
    │       └── health.service.ts
    ├── common/
    │   ├── decorators/
    │   │   ├── current-user.decorator.ts
    │   │   ├── roles.decorator.ts
    │   │   └── public.decorator.ts
    │   ├── guards/
    │   │   ├── jwt-auth.guard.ts
    │   │   ├── roles.guard.ts
    │   │   └── tenant.guard.ts
    │   ├── interceptors/
    │   │   └── request-context.interceptor.ts
    │   └── crypto/
    │       └── crypto.service.ts
    ├── config/
    │   ├── mssql.datasource.ts
    │   └── jwt.config.ts
    └── database/
        └── seed.service.ts

    .env.example                   Environment variables
    package.json                   NestJS + deps
    tsconfig.json                  TypeScript config
```

### Multi-Tenancy Model

**Isolation Pattern:**

1. **JWT Payload contains:** `{ sub: userId, email, name, role, companyId }`
   - `vendor_admin`: `companyId = null` (can see all companies)
   - `operator`: `companyId = "co-123"` (bound to company, cannot switch)

2. **Request Context (TenantGuard):**
   - **Operator request:** `tenantCompanyId = JWT.companyId` (always)
   - **Vendor Admin request:** `tenantCompanyId = X-Company-Id header` OR `null` (if overview mode)

3. **Query Enforcement (TypeORM):**
   - All service methods enforce `WHERE company_id = req.tenantCompanyId`
   - Example: `GET /api/cameras` → `cameras.find({ where: { companyId: req.tenantCompanyId } })`
   - Prevents operators from seeing other companies' cameras via URL manipulation

4. **Frontend Mirroring:**
   - Next.js `effectiveCompanyId` derived from `useAuth()` (same logic as backend)
   - Company switcher in sidebar only for vendor_admin
   - All lists pre-filtered by `effectiveCompanyId` (trust backend for security)

### Auth Flow

**Current Mock (to be replaced in Phase 03):**
```
Login Page
  → User selects company (Step 1)
  → Enters email + password (Step 2)
  → Frontend validates against INITIAL_USERS
  → On success: store in localStorage + ip-session cookie (base64)
  → middleware.ts checks cookie, redirects invalid to /login
  → Routes protected if role !== vendor_admin (for /admin/*)

⚠️ Issues:
  - Cookie is NOT signed (anyone can forge)
  - No server-side validation
  - Credentials hardcoded in frontend
  - Company isolation is client-side only
```

**Target Real Flow (Phase 03):**
```
Login Page
  → User enters email + password
  → POST /api/auth/login
  → NestJS validates against user.passwordHash (bcrypt)
  → On success: sign JWT { sub, email, name, role, companyId }
  → Return access_token + user info
  → Frontend stores access_token in localStorage
  → All subsequent API calls include Authorization: Bearer {token}
  → middleware.ts will verify JWT (not just decode)
  → Backend TenantGuard enforces company_id on all queries

✓ Secure:
  - JWT is signed with RS256 or HS256 secret (backend verifies)
  - Credentials validated server-side
  - Company isolation enforced in database queries
  - Role checks in TenantGuard + @Roles() decorators
```

---

## Brand & Design System

**Colors:**
- **Primary:** `#93D500` (Lime Green) — buttons, accents, badges
- **Secondary:** `#007BFF` (Blue) — links, secondary actions
- **Accent:** `#009D4F` (Dark Green) — hover states
- **Status colors:**
  - Online: `#93D500` (green)
  - Warning: `#FBC02D` (yellow)
  - Offline: `#D32F2F` (red)
  - Pending: `#9E9E9E` (gray)
- **Backgrounds:** `#E8F5E9` (light green), white, `#F5F5F5` (light gray)
- **Hover:** `#2E7D32` (dark green)

**Typography:**
- Sans-serif (Tailwind default)
- Headings: bold, dark text
- Body: regular, medium gray

**Components:**
- Buttons: CTA primary (black text on `#93D500`), ghost secondary
- Cards: white background, subtle shadow
- Forms: light gray inputs, validation red on error
- Tables: zebra striping optional, hover highlight
- Modals: glassmorphism background (on login page only)

---

## Phases

### Overview & Timeline

| # | Phase | Category | Status | Effort | Blocked By | Est. Start |
|---|-------|----------|--------|--------|-----------|-----------|
| 01 | NestJS Bootstrap | backend-infra | pending | 4h | — | Now |
| 02 | Database Schema & Seed | backend-infra | pending | 3h | P01 | After P01 |
| 03 | Auth + Companies + Users API | backend-api | pending | 6h | P02 | After P02 |
| 04 | Camera Registration + Ingestion | backend-api | pending | 8h | P03 | After P03 |
| 05 | Frontend Auth Wiring | frontend-wiring | pending | 4h | P03 | After P03 |
| 06 | Frontend Camera Re-wiring | frontend-wiring | pending | 6h | P04 | After P04 |
| 07 | Zone Drawing Backend | backend-api | pending | 3h | P04 | After P04 |
| 08 | Health Dashboard Backend | backend-api | pending | 3h | P04 | After P04 |

**Total Effort:** ~37 hours (assumes sequential, but P05–P08 can parallelize once P03/P04 ship)

### Phase Details

#### Phase 01 — NestJS Backend Bootstrap

**Status:** pending | **Effort:** 4h | **Blocks:** All other backend phases

**Deliverables:**
- NestJS project scaffolded at `apps/api/`
- MSSQL connection via TypeORM (dev database must exist)
- JWT strategy wired globally (unprotected routes: POST /api/auth/login)
- `@CurrentUser()` decorator + `@Roles()` metadata
- `RequestContextInterceptor` attaches `req.currentUser` from JWT
- Global validation pipe + CORS configured for `http://localhost:3000`
- `.env.example` template with all required vars

**Key files created:** `apps/api/src/main.ts`, `app.module.ts`, `config/mssql.datasource.ts`, guards, decorators, interceptors (details in phase file).

**Completion Criteria:**
- `npm run start:dev` in `apps/api/` boots without errors
- MSSQL connection established (no timeout)
- Any unauthenticated endpoint returns 401 (except `/api/auth/login` which returns 404 — not implemented yet)
- TypeScript compiles with strict mode

#### Phase 02 — Database Schema & Seed

**Status:** pending | **Effort:** 3h | **Blocked by:** Phase 01

**Deliverables:**
- TypeORM entities: `Company`, `User` (with relations)
- MSSQL tables auto-created on first boot: `companies`, `users`
- Slug auto-generation for companies (unique, kebab-case)
- Seed service creates 1 vendor_admin if no users exist: `admin@intellipark.io / Admin@123`
- Idempotent seed (second boot does NOT re-seed)

**Database schema:**
```sql
CREATE TABLE companies (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  name NVARCHAR(255) NOT NULL,
  slug NVARCHAR(255) NOT NULL UNIQUE,
  status NVARCHAR(20) DEFAULT 'active',  -- 'active' | 'inactive'
  created_at DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE users (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  email NVARCHAR(255) NOT NULL UNIQUE,
  name NVARCHAR(255) NOT NULL,
  password_hash NVARCHAR(255) NOT NULL,
  role NVARCHAR(50) NOT NULL,  -- 'vendor_admin' | 'operator'
  company_id UNIQUEIDENTIFIER FOREIGN KEY REFERENCES companies(id) NULLABLE,
  created_at DATETIME2 DEFAULT GETDATE()
);
```

**Completion Criteria:**
- Tables exist in MSSQL after first boot
- Seed creates admin user with bcrypt-hashed password
- Second boot: seed skipped (idempotent check works)
- slug uniqueness: two companies named "Test" → `test`, `test-2`

#### Phase 03 — Auth + Companies + Users API

**Status:** pending | **Effort:** 6h | **Blocked by:** Phase 02

**Deliverables:**
- JWT login endpoint: `POST /api/auth/login` → returns `{ access_token, user }`
- Companies CRUD: GET (list all), POST (create), PATCH (update status) — vendor_admin only
- Users CRUD: GET (list by company), POST (create), PATCH (reassign, reset password) — vendor_admin only
- Tenant isolation via `TenantGuard` (enforces `company_id` scoping)
- Password hashing with bcrypt
- JWT strategy validates tokens (HS256, 7-day expiry)

**API endpoints:**
```
POST   /api/auth/login                    @Public
GET    /api/auth/me                       @JwtAuth
GET    /api/companies                     @Roles('vendor_admin')
POST   /api/companies                     @Roles('vendor_admin')
PATCH  /api/companies/:id/status          @Roles('vendor_admin')
GET    /api/users?companyId=:id           @Roles('vendor_admin')
POST   /api/users                         @Roles('vendor_admin')
PATCH  /api/users/:id/company             @Roles('vendor_admin')
PATCH  /api/users/:id/password            @Roles('vendor_admin')
```

**Completion Criteria:**
- `POST /api/auth/login` with `admin@intellipark.io / Admin@123` returns valid JWT
- `GET /api/companies` with vendor_admin JWT returns company list
- `POST /api/companies` creates company with auto-slug
- Operator JWT on `GET /api/companies` returns 403
- No JWT returns 401

#### Phase 04 — Camera Registration + Frame Ingestion

**Status:** pending | **Effort:** 8h | **Blocked by:** Phase 03

**Deliverables:**
- Camera entity + CRUD: `POST /api/cameras` (register), `GET /api/cameras` (list), `GET /api/cameras/:id` (fetch), `DELETE /api/cameras/:id`
- ONVIF probe on registration: validates IP/port/credentials, fetches snapshot
- Password encryption (AES-256-GCM) with random IV
- Frame ingestion endpoint: `POST /api/ingest/:siteKey` (multipart, no JWT required)
- Bull queue + Redis for frame processing (concurrency=5)
- Frame processor: logs to PostgreSQL `frame_ingestion_log`, updates `camera.last_frame_at` and status in MSSQL
- Zone entity + CRUD: `POST /api/cameras/:id/zones` (save), `GET /api/cameras/:id/zones` (list)

**Database schemas:**
```sql
-- MSSQL
CREATE TABLE cameras (
  id UNIQUEIDENTIFIER PRIMARY KEY,
  company_id UNIQUEIDENTIFIER FK REFERENCES companies(id),
  name NVARCHAR(255),
  ip NVARCHAR(15),
  port INT DEFAULT 80,
  username NVARCHAR(255),
  password_encrypted NVARCHAR(MAX),  -- iv:tag:ciphertext
  model NVARCHAR(255) DEFAULT 'MS-C8241-X36PE',
  location NVARCHAR(255),
  status NVARCHAR(20) DEFAULT 'pending',  -- online | warning | offline | pending
  last_frame_at DATETIME2,
  created_at DATETIME2
);

CREATE TABLE zones (
  id UNIQUEIDENTIFIER PRIMARY KEY,
  camera_id UNIQUEIDENTIFIER FK REFERENCES cameras(id),
  company_id UNIQUEIDENTIFIER FK REFERENCES companies(id),
  type NVARCHAR(50),  -- parking_zone | entrance_zone | no_smoking_zone
  points_json NVARCHAR(MAX),  -- normalized [0-1] coords: [{x,y}...]
  version INT DEFAULT 1,
  created_at DATETIME2
);

-- PostgreSQL (time-series)
CREATE TABLE frame_ingestion_log (
  id UUID PRIMARY KEY,
  camera_id UUID,
  company_id UUID,
  received_at TIMESTAMPTZ,
  size_bytes INT,
  status VARCHAR(20) DEFAULT 'ok',  -- ok | error
  error_message TEXT
);
CREATE INDEX idx_frame_ingestion_camera ON frame_ingestion_log(camera_id, received_at DESC);
CREATE INDEX idx_frame_ingestion_company ON frame_ingestion_log(company_id, received_at DESC);
```

**Completion Criteria:**
- `POST /api/cameras` with valid Milesight credentials probes ONVIF, encrypts password, persists
- `GET /api/cameras` returns company-scoped list (operator sees only their company's cameras)
- `POST /api/ingest/:siteKey` with frame multipart enqueues job (returns 204 in <50ms)
- Frame processor logs to PostgreSQL, updates `camera.last_frame_at` and status to 'online'
- `POST /api/cameras/:id/zones` saves zones with normalized coords, version increments

#### Phase 05 — Frontend Auth Wiring

**Status:** mock-complete | **Effort:** 4h | **Blocked by:** Phase 03

**Changes to existing code:**
- Modify `lib/auth-context.tsx` to replace mock login with `POST /api/auth/login`
- Create `lib/api-client.ts` fetch wrapper that includes `Authorization: Bearer {token}`
- Update `app/login/page.tsx` to call backend login endpoint
- Update `middleware.ts` to verify JWT (not just decode base64)
- Replace `localStorage.getItem(SESSION_KEY)` with JWT decode-only (never trust client-side parsing; backend authorizes)

**Files modified:** `auth-context.tsx`, `middleware.ts`
**Files created:** `lib/api-client.ts`

**Completion Criteria:**
- Login with real backend JWT
- JWT stored in localStorage
- All API calls include `Authorization: Bearer {token}`
- Unauthenticated users redirected to `/login`

#### Phase 06 — Frontend Camera Re-wiring

**Status:** mock-complete | **Effort:** 6h | **Blocked by:** Phase 04

**Changes to existing pages:**
- `/cameras` → replace `MOCK_CAMERAS` with `GET /api/cameras` call via `api-client.ts`
- `/cameras/new` → replace mock 70% success with real `POST /api/cameras` call
- `/cameras/[id]/overview` → fetch real camera details from `GET /api/cameras/:id`
- `/cameras/[id]/configuration` → derive endpoint URL from backend config (not hardcoded)
- `/cameras/[id]/health` → fetch health metrics from `GET /api/cameras/:id/health` (new endpoint)
- `/cameras/[id]/zones` → fetch zones from `GET /api/cameras/:id/zones`, save to `POST /api/cameras/:id/zones`

**Backend endpoint additions** (called by frontend):
- `GET /api/cameras/:id/health` — return FPM, uptime, error count (aggregated from `frame_ingestion_log`)

**Files modified:** All camera-related pages in `app/(dashboard)/cameras/*`

**Completion Criteria:**
- All camera pages fetch real data from backend
- New camera registration tests ONVIF probe on backend (not frontend)
- Zone saves persist to MSSQL

#### Phase 07 — Zone Drawing Backend

**Status:** mock-complete | **Effort:** 3h | **Blocked by:** Phase 04

**Backend completions** (started in Phase 04, finished here):
- `GET /api/cameras/:id/zones` → list zones for camera (operator: filtered by company_id)
- `POST /api/cameras/:id/zones` → save/replace all zones, increment version
- Zone validation: coordinates must be [0-1], ≥3 points per zone

**Snapshot endpoint** (already in Phase 04 but completion here):
- `GET /api/cameras/:id/snapshot` → fetch fresh snapshot from ONVIF device

**Files:** `apps/api/src/modules/zones/*` (complete implementation)

**Completion Criteria:**
- Zones saved to MSSQL
- Zones loaded on page refresh
- Snapshot fetched on demand

#### Phase 08 — Health Dashboard Backend

**Status:** mock-complete | **Effort:** 3h | **Blocked by:** Phase 04

**Backend endpoints:**
- `GET /api/cameras/:id/health` → aggregate `frame_ingestion_log` to compute FPM (frames per minute), uptime %, error count (last 12 hours)
- `GET /api/cameras?health=true` → include health metrics in list view

**Logic:**
```
FPM = count of frames in last 60s / 1
Uptime = (time with frames in last 12h) / (12 hours) * 100%
Errors = count of rows with status='error' in last 12h
Status = if (now - last_frame_at) < 30s: 'online'; 30s-2m: 'warning'; >2m: 'offline'
```

**Files:** `apps/api/src/modules/health/health.service.ts` (query aggregation logic)

**Completion Criteria:**
- Health metrics computed from real frame logs
- Status auto-updated based on last frame timestamp

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Multi-tenancy isolation** | `company_id` in JWT + TenantGuard in backend | Prevents operators from accessing other companies; vendor_admin can switch context via header |
| **Camera password storage** | AES-256-GCM encryption with random IV | Recoverable (not one-way hash) so backend can re-authenticate to camera; IV randomization provides semantic security |
| **Zone coordinates** | Normalized [0-1] instead of pixels | Zones survive snapshot resolution changes; portable across different camera resolutions |
| **Health polling** | 30s client-side interval (KISS) | Simple, doesn't require WebSocket; acceptable for parking use case; can upgrade to WebSocket later |
| **Frame ingestion auth** | `siteKey` = `camera.id` + lookup in DB | No shared secret per camera needed (KISS); validates camera exists and belongs to request context |
| **Backend architecture** | NestJS at `apps/api/`, Next.js at root | Avoids full monorepo restructure during POC; ports 3001 (NestJS) and 3000 (Next.js) |
| **Database sync strategy** | TypeORM `synchronize: true` in dev only | Entities define schema; no separate migration runner needed for Sprint 1; will migrate to Typeorm CLI migrations in Sprint 2 |
| **JWT expiry** | 7 days (Sprint 1) | Simple, no refresh token needed yet; upgrade to 15m + refresh token in Sprint 2 |
| **Frame bytes storage** | Not stored (metadata only) | Avoids massive blob storage cost in Sprint 1; AI pipeline will request frames on-demand later |
| **Frontend mock-first** | Built UI with mock data, now wire to real backend | Fast iteration on design; clear contract between frontend and backend; testing both layers early |

---

## Mock Data Reference

### Companies (Initial Load)

```typescript
// lib/mock-auth-data.ts
INITIAL_COMPANIES = [
  { id: "co1", name: "UK Parking Control", slug: "uk-parking-control", status: "active", createdAt: "2024-01-01" },
  { id: "co2", name: "CityPark Ltd", slug: "citypark-ltd", status: "active", createdAt: "2024-01-15" },
  { id: "co3", name: "SecureSpace Group", slug: "securespace-group", status: "active", createdAt: "2024-02-01" },
  { id: "co4", name: "Metro Parking", slug: "metro-parking", status: "inactive", createdAt: "2024-02-15" },
];
```

### Users (Initial Load)

```typescript
// lib/mock-auth-data.ts
INITIAL_USERS = [
  { id: "u1", email: "admin@intellipark.io", password: "admin123", name: "Admin User", role: "vendor_admin", companyId: null, status: "active", createdAt: "2024-01-01" },
  { id: "u2", email: "john@ukparkingcontrol.com", password: "password123", name: "John Smith", role: "operator", companyId: "co1", status: "active", createdAt: "2024-01-15" },
  { id: "u3", email: "jane@citypark.com", password: "password123", name: "Jane Cooper", role: "operator", companyId: "co2", status: "active", createdAt: "2024-02-01" },
  // ... 3 more operators
];
```

### Cameras (Initial Load)

```typescript
// lib/mock-data.ts
MOCK_CAMERAS = [
  {
    id: "a3f7c2d1-8b4e-4f9a-bc23-1d5e7f8a9b0c",
    name: "Gate A Camera",
    ip: "192.168.1.100",
    port: 80,
    username: "admin",
    model: "MS-C8241-X36PE",
    location: "Gate A",
    status: "online",
    last_frame_at: new Date(Date.now() - 12_000),
    created_at: "2024-01-15",
  },
  // ... 7 more cameras (8 total)
];
```

**Distribution:**
- co1: cameras 0–3 (4 cameras)
- co2: cameras 2–5 (4 cameras, overlap)
- co3: cameras 4–6 (3 cameras, overlap)
- co4: unassigned

**Statuses:**
- 4 online, 2 warning, 2 offline

---

## Out of Scope (Sprint 1)

- AI pipeline (parking detection, entry/exit counting, no-smoking detection)
- WebSocket real-time updates (use 30s polling instead)
- Soft deletes, audit logs
- Alert notification system (email, SMS, push)
- Zone AI triggering (zones drawn, not used for AI yet)
- Role: `company_admin` (only vendor_admin + operator)
- Multi-factor authentication
- Single Sign-On (SAML, OAuth)
- Mobile app
- Zone auto-generation from detected objects
- Custom branding per company (logo, colors)
- API rate limiting
- Refresh token rotation
- Session invalidation on password change
- Operator UI for password reset (vendor_admin sets password only)

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|-----------|
| **MSSQL dev DB not available** | Blocks Phases 01–02 | Medium | Document setup in README; provide Docker Compose config |
| **ONVIF probe timeout (3s per camera)** | Users see slow registration UI | Medium | 10s timeout covers most scenarios; retry on timeout in Phase 04 |
| **Frame ingestion queue backlog** | Health dashboards lag; duplicate frames processed | Medium | Bull max concurrency=5; use PostgreSQL `(camera_id, received_at)` index for fast queries |
| **PostgreSQL time-series bloat** | Query performance degrades after 1M rows | Low | Implement row TTL (keep 30 days) in Sprint 2 |
| **JWT secret leaked** | Any attacker can forge tokens | Critical | Store in `.env` (never commit); rotate in production (plan for Sprint 2) |
| **Zone coordinate precision** | Normalized [0-1] loses sub-pixel accuracy | Low | Acceptable for parking zone detection; upgrade to [0-10000] if needed |
| **Camera password recovery** | Lost password = unreachable camera | Low | Vendor admin can reset via API; document manual reset procedure |
| **Company context leak** | Operator sees another company's data | Critical | TenantGuard unit-tested; code review mandatory before merge |

---

## Glossary

| Term | Definition |
|------|-----------|
| **vendor_admin** | Intelli-Park staff; can create companies, manage operators, view all data |
| **operator** | Parking facility staff; assigned to one company; registers/configures cameras for that company only |
| **effectiveCompanyId** | The company context used for data filtering: `selectedCompanyId` for vendor_admin, `companyId` for operator |
| **selectedCompanyId** | Vendor_admin's currently selected company (stored in localStorage, changed via sidebar switcher); null for operator (always bound to their assigned company) |
| **ip-session** | Cookie name for mock session (base64-encoded); replaced with JWT in Phase 03 |
| **TenantGuard** | NestJS guard that enforces company_id isolation on all requests; attaches `req.tenantCompanyId` |
| **site_key** | URL parameter in `/api/ingest/:siteKey`; maps to `camera.id` for authentication |
| **snapshot** | JPEG image fetched from camera via ONVIF protocol; displayed in `/cameras/[id]/overview` |
| **zone** | Polygon (parking spot, entrance, no-smoking area) defined by normalized [0-1] coordinates; used for AI detection |
| **frame** | Single video frame pushed by camera (multipart form-data) to `/api/ingest/:siteKey` |
| **FPM** | Frames Per Minute; metric in health dashboard |
| **Milesight** | Camera vendor; model `MS-C8241-X36PE` used in this system |
| **ONVIF** | Standard protocol for IP camera communication (device discovery, snapshot fetch, etc.) |
| **AES-256-GCM** | Encryption algorithm for camera passwords; GCM provides authentication (no separate HMAC) |
| **normalization** | Converting pixel-based zone coordinates to [0-1] range (e.g., `(100, 200)` on 1920x1080 → `(0.052, 0.185)`) |

---

## Next Steps (Execution Order)

1. **Phase 01** → Scaffold NestJS, connect MSSQL, wire guards/interceptors
2. **Phase 02** → Create entities, seed admin user, verify schema
3. **Phase 03** → Auth + companies + users endpoints; test with Postman
4. **Phase 04** → Camera CRUD, ONVIF probe, frame ingestion queue, zones API
5. **Phase 05** (parallel with 04) → Wire frontend to real JWT, update `auth-context.tsx`
6. **Phase 06** (parallel with 04) → Update camera pages to use real API calls
7. **Phase 07** → Finish zone backend, test canvas saves to DB
8. **Phase 08** → Health metrics aggregation, verify dashboard reflects real data

**Critical Path:** P01 → P02 → P03 → P04 → P06 (serial)
**Parallel opportunities:** P05, P07, P08 can start after P03/P04 begin (non-blocking on full completion)

---

**Document Version:** 1.0 | **Last Updated:** 2026-05-06 | **Author:** System Architect
