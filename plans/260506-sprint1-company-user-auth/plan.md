---
title: "Sprint 1 — Company & User Management + Authentication"
description: "Multi-tenant foundation: companies, users, JWT auth, data isolation, vendor admin UI."
status: in-progress
priority: P0
effort: 22h
branch: main
tags: [nestjs, nextjs, mssql, jwt, multi-tenant, sprint-1, foundation]
created: 2026-05-06
updated: 2026-05-06
---

# Sprint 1 — Company & User Management + Authentication

## Goal
Build the multi-tenant foundation that all future camera features sit on.
Two tickets:
1. Vendor Admin can create companies and users
2. User logs in and sees only their company's view

Brainstorm report: [reports/brainstorm-report.md](./reports/brainstorm-report.md)

## Current State (as of 2026-05-06)

### What is built and working (mock backend)
- **Authentication (mock)**: Login validates credentials against `INITIAL_USERS` in `lib/mock-auth-data.ts`; session stored in `localStorage` + `ip-session` cookie (base64-encoded, not JWT) for middleware
- **Company ownership validation**: Login step 1 selects company context; step 2 validates that user email belongs to selected company before allowing login (`app/login/page.tsx` lines 75–87)
- **Route protection**: `middleware.ts` checks `ip-session` cookie, redirects missing/invalid to `/login`; grants access to `/admin/` only if role === 'vendor_admin'; excludes `/api/`, `/image/`, static assets
- **Vendor admin CRUD (mock data)**: 
  - Companies: add/edit/delete with slug auto-generation; prevents delete if users assigned; switches selected company on delete
  - Users: add/edit/delete with validation (email uniqueness, password min 6 chars, operators must have company assigned)
  - Self-edit: user cannot delete own account; cannot change own role/company; cannot change own status
- **Company switcher**: Vendor admin sidebar shows company list; clicking switches `selectedCompanyId`; affects `/cameras` view (company-scoped camera list)
- **Operator view**: Operator sees cameras for their assigned company only; no access to `/admin/` routes; cannot create/edit/delete cameras (no buttons for operator role)

### What is NOT yet built
- No NestJS backend (`apps/api/` does not exist)
- No real JWT (base64 encoding only, no signature verification)
- No `lib/api-client.ts` (no HTTP layer for API calls)
- `lib/auth-context.tsx` uses `INITIAL_USERS` from mock data — not from API
- All CRUD operations use `lib/data-store.tsx` (in-memory React Context) — not API endpoints
- No database (MSSQL/PostgreSQL) — all data lost on page refresh
- No email/password reset
- No user invitation flow
- No audit logs or soft deletes
- No session invalidation/refresh token logic

### UI / Design (completed 2026-05-06)
- **Light theme**: Full migration from dark to light — brand palette `#93D500` (primary), `#007BFF` (secondary), `#009D4F` (text accent), `#E8F5E9` (light bg), `#2E7D32` (hover dark)
- **Login page**: Background photo (`login-background.jpg`), glassmorphism card (`backdrop-blur-sm bg-white/60`), company logo (`eCamLogoTest.jpg`), favicon (`logo-head-html.png`)
- **Button behavior**: Primary button — black text on `#93D500`, white text on hover (`#2E7D32`)

## Architecture

```
apps/api/           NestJS (new — Sprint 1 delivers this)
  src/
    modules/
      auth/         POST /api/auth/login → JWT
      companies/    CRUD companies (vendor_admin only)
      users/        CRUD users (vendor_admin only)
    common/
      guards/       JwtAuthGuard, RolesGuard, TenantGuard
      interceptors/ RequestContextInterceptor (company_id from JWT)

app/ (root)         Next.js (existing, modified)
  (dashboard)/
    admin/
      companies/    NEW — vendor admin pages
    cameras/        existing (modified to use real API)
  login/            existing (wired to real API)
  middleware.ts     NEW — JWT route protection

lib/
  auth-context.tsx  MODIFIED — real JWT, not mock
  api-client.ts     NEW — fetch wrapper with auth headers
```

**JWT Payload:** `{ userId, email, name, role, companyId }` — companyId null for vendor_admin

**Company Switcher:** vendor_admin stores `selectedCompanyId` in auth context; all API calls send `X-Company-Id: {id}` header; backend uses that header when role=vendor_admin

## Phases

| # | Phase | Status | Note |
|---|-------|--------|------|
| 01 | [NestJS Backend Bootstrap](./phase-01-nestjs-backend-bootstrap.md) | pending | Not started; blocks all other phases |
| 02 | [Database Schema & Seed](./phase-02-database-schema-seed.md) | pending | Blocked by Phase 01; needs MSSQL tables (companies, users) + seed data |
| 03 | [Auth + Companies + Users API](./phase-03-auth-companies-users-api.md) | pending | Blocked by Phase 02; must implement JWT, /auth/login, CRUD endpoints |
| 04 | [Frontend Auth Wiring](./phase-04-frontend-auth-wiring.md) | mock-complete | UI done with mock data; login validated; routes protected; ready to swap for real JWT when Phase 03 ships |
| 05 | [Vendor Admin UI](./phase-05-vendor-admin-ui.md) | mock-complete | All pages built (companies, users, CRUD); all reads/writes use in-memory store via `useData()`; swap to API calls in Phase 03 |

## Dependencies
- Phase 01 blocks all
- Phase 02 requires Phase 01
- Phase 03 requires Phase 02
- Phase 04 requires Phase 03 (needs real API endpoints)
- Phase 05 requires Phase 04 (needs real auth context)

## Key Decisions
- NestJS added as `apps/api/` — Next.js stays at root (no monorepo restructure yet)
- No email service — vendor admin sets password manually
- Slug auto-generated from company name (kebab-case, unique suffix if collision)
- Inactive company status stored in DB; no behavioral logic Sprint 1
- Vendor admin in company context = full access (not read-only)
- Operator dashboard = empty state / placeholder in Sprint 1

## Out of Scope (Sprint 1)
- Email invite links
- Inactive company behavioral logic
- Vendor admin audit trail in company context
- Company Admin role
- Session invalidation on operator reassign
