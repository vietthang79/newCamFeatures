# Plans Index

This directory contains project plans and implementation guides for the Intelli-Park Camera Management System.

## Active Plan

| Plan | Status | Description |
|------|--------|-------------|
| [**intelli-park-master**](./intelli-park-master/plan.md) | **in-progress** | **← USE THIS** — Unified master plan consolidating all phases (8 total), combining frontend mock-complete state with pending backend implementation. Includes executive summary, current state analysis, architecture diagrams, detailed phase specifications, and risk assessment. |

## Phase Details (Master Plan)

The master plan is organized into 8 phases:

### Infrastructure & Foundation (Phases 01–02)
- **Phase 01** — NestJS Backend Bootstrap (4h) — Scaffold project, configure MSSQL, wire guards/interceptors
- **Phase 02** — Database Schema & Seed (3h) — Create Company/User entities, auto-seed admin user

### Backend APIs (Phases 03–04)
- **Phase 03** — Auth + Companies + Users API (6h) — JWT login, CRUD endpoints, tenant isolation
- **Phase 04** — Camera Registration + Frame Ingestion + Zones (8h) — ONVIF probe, encrypted password storage, Bull queue, zone persistence, health metrics

### Frontend Wiring (Phases 05–08)
- **Phase 05** — Frontend Auth Wiring (4h) — Replace mock JWT with real backend, update middleware
- **Phase 06** — Frontend Camera Re-wiring (6h) — Connect camera pages to real API
- **Phase 07** — Zone Drawing Backend (3h) — Complete zone persistence and snapshot fetching
- **Phase 08** — Health Dashboard Backend (3h) — Health metrics aggregation from frame logs

**Total Effort:** ~37 hours | **Critical Path:** P01→P02→P03→P04→P06 | **Parallel:** P05, P07, P08 (after P03/P04)

---

## Archived Plans (Superseded)

| Plan | Status | Reason |
|------|--------|--------|
| [260505-intelli-park-camera-system](./260505-intelli-park-camera-system/plan.md) | archived | Replaced by unified master plan; contained camera system phases only |
| [260506-sprint1-company-user-auth](./260506-sprint1-company-user-auth/plan.md) | archived | Replaced by unified master plan; contained auth/company/user phases only |

Both old plans are preserved for reference but should not be used for implementation. The master plan consolidates both and provides a single source of truth.

---

## Quick Start

1. **Read first:** [Master Plan Overview](./intelli-park-master/plan.md) — 5 min for executive summary, 10 min for detailed current state and architecture
2. **Phase details:** Start with [Phase 01 (NestJS Bootstrap)](./intelli-park-master/phase-01-nestjs-bootstrap.md) for implementation
3. **Current state:** See [Master Plan > Current State](./intelli-park-master/plan.md#current-state-as-of-2026-05-06) for what's built vs. what's pending

---

## Key Metrics

- **Frontend Status:** 100% complete (14 pages, all UI done, mock data functional)
- **Backend Status:** 0% (not started)
- **Database Schema:** Designed (not created)
- **Mock Data Count:** 4 companies, 6 users, 8 cameras, 2 zones

---

## Glossary

- **vendor_admin** — Intelli-Park staff; full access to all companies, users, cameras
- **operator** — Parking facility staff; access to one assigned company's cameras only
- **effectiveCompanyId** — Company context for data filtering (selectedCompanyId for vendor_admin, assigned companyId for operator)
- **TenantGuard** — NestJS guard enforcing company_id isolation on all backend queries
- **ONVIF** — Standard protocol for IP camera communication (probing, snapshot fetch)
- **AES-256-GCM** — Encryption algorithm for camera passwords; random IV per camera
- **Bull** — Job queue library (NestJS) for async frame processing via Redis
- **Frame** — Single video frame pushed by camera to `/api/ingest/:siteKey` endpoint
- **Zone** — Polygon detection area (parking spot, entrance, no-smoking) drawn on camera canvas; normalized [0-1] coordinates

---

## Contact

For questions or updates to the plan, reach out to the project lead.

**Last Updated:** 2026-05-06
