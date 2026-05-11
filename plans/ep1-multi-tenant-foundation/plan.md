# EP-1 — Multi-Tenant Foundation

**Status:** ⏳ Pending  
**Priority:** 🔴 Critical  
**Depends on:** [Sprint 0 Infrastructure](../sprint-0-infrastructure/plan.md)

## Overview

Xây dựng nền tảng multi-tenant: auth system, company/user management, tenant isolation. Sau EP-1, mọi operator có thể đăng nhập và chỉ thấy data của company mình. Vendor admin có thể quản lý tất cả.

## User Stories

### EP1-T1: A vendor admin can create companies and users
> As a vendor admin, I want to create new companies and add users to them so that I can prepare separate environments for different pilot customers.

### EP1-T2: A user can log in and see only their company's view
> As a company operator, I want to log in with my credentials so that I can access my company's data without seeing other companies.

## Acceptance Criteria

### EP1-T1
- [ ] Tạo company mới với name và identifier (slug)
- [ ] Tạo users (operator role) và assign cho company
- [ ] List tất cả companies và users của họ
- [ ] Company fields: name, slug, status (active/inactive), created date
- [ ] Lần đầu mở system: admin account đã tồn tại (seeded)

### EP1-T2
- [ ] Đăng nhập tại `app.intelli-park.com` với email và password
- [ ] Sau login → dashboard scoped theo company
- [ ] Không thể thấy data của company khác
- [ ] URL manipulation → 403 error
- [ ] Vendor admin có "Company switcher" và có thể xem bất kỳ company nào
- [ ] Audit log ghi nhận mỗi lần login

## Phases

| # | File | Description | Status |
|---|------|-------------|--------|
| 01 | [phase-01-nestjs-bootstrap.md](./phase-01-nestjs-bootstrap.md) | NestJS app setup, TypeORM, config module | ⏳ Pending |
| 02 | [phase-02-database-schema-seed.md](./phase-02-database-schema-seed.md) | MSSQL tables: companies, users + admin seed | ⏳ Pending |
| 03 | [phase-03-auth-companies-users-api.md](./phase-03-auth-companies-users-api.md) | JWT auth, TenantGuard, CRUD APIs, audit log | ⏳ Pending |
| 04 | [phase-04-frontend-auth-wiring.md](./phase-04-frontend-auth-wiring.md) | Replace mock auth → real JWT API calls | ⏳ Pending |
| 05 | [phase-05-vendor-admin-ui.md](./phase-05-vendor-admin-ui.md) | Wire admin pages + company switcher to real data | ⏳ Pending |

## Technical Architecture

```
Frontend (Next.js)
    │  POST /api/auth/login → { accessToken, user }
    │  Cookie: Set-Cookie: accessToken=...; HttpOnly; Secure
    │
    ▼
NestJS Gateway
    │
    ├── AuthModule (passport-jwt)
    │     JwtStrategy → extracts userId, roles, companyId from token
    │
    ├── TenantGuard (global)
    │     - Nếu role = 'operator': filter WHERE company_id = jwt.companyId
    │     - Nếu role = 'vendor_admin': bypass (xem tất cả)
    │     - URL company param ≠ jwt.companyId → throw ForbiddenException
    │
    ├── CompaniesModule → CRUD /api/companies
    ├── UsersModule → CRUD /api/users
    └── AuditModule → log every login event
    │
    ▼
MSSQL
    ├── companies (id, name, slug, status, created_at)
    ├── users (id, email, password_hash, role, company_id, created_at)
    └── audit_logs (id, user_id, action, ip_address, created_at)
```

## Technical Notes

- MSSQL tables: `companies`, `users` (với `company_id` FK), `audit_logs`
- Roles chỉ 2 loại: `vendor_admin`, `operator` (MVP)
- JWT payload: `{ userId, roles, companyId, iat, exp }`
- Token lưu trong **httpOnly cookie** (không phải localStorage) để tránh XSS
- Admin UI là plain — no fancy tenant management

## FE Current State

FE đã có:
- ✅ Login page (`app/login/page.tsx`) — 2-step: company selector + credentials
- ✅ `lib/auth-context.tsx` — mock auth provider
- ✅ `lib/mock-auth-data.ts` — hardcoded users/companies
- ✅ Admin pages: companies list/create/edit, users list/create/edit
- ✅ Company switcher trong sidebar và topbar

Phase 04 và 05 sẽ **replace** mock data với real API calls. Không tạo file mới — chỉ update existing.
