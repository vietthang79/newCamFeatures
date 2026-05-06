# Phase 03 — Auth + Companies + Users API

## Context Links
- [Plan overview](./plan.md)
- [Phase 02 — Database Schema](./phase-02-database-schema-seed.md)

## Overview
- **Priority:** P0
- **Status:** pending
- **Effort:** 6h
- Implement all backend endpoints: login/JWT, companies CRUD, users CRUD, tenant isolation.

## Key Insights
- `vendor_admin` has `companyId: null` in JWT — TenantGuard must skip for this role
- Company switcher: vendor_admin sends `X-Company-Id` header → backend reads it for data scoping
- All company/user endpoints: `@Roles('vendor_admin')` — operators cannot access
- Password reset by vendor_admin: direct PATCH (no email token needed in Sprint 1)
- `POST /auth/login` is `@Public()` (no JWT required)

## API Endpoints

```
POST   /api/auth/login                    @Public — email+password → JWT + user info
GET    /api/auth/me                       @JwtAuth — returns current user from token

GET    /api/companies                     @Roles(vendor_admin) — list all
POST   /api/companies                     @Roles(vendor_admin) — create
PATCH  /api/companies/:id/status          @Roles(vendor_admin) — toggle active/inactive

GET    /api/users?companyId=:id           @Roles(vendor_admin) — list operators by company
POST   /api/users                         @Roles(vendor_admin) — create operator
PATCH  /api/users/:id/company             @Roles(vendor_admin) — reassign to different company
PATCH  /api/users/:id/password            @Roles(vendor_admin) — reset password
```

## JWT Payload

```ts
interface JwtPayload {
  sub: string;          // userId
  email: string;
  name: string;
  role: 'vendor_admin' | 'operator';
  companyId: string | null;
}
```

Token expiry: `7d` for Sprint 1 (simplicity — no refresh token).

## Request Context & Tenant Guard

```
Operator request:
  JWT companyId = "co-123"  → TenantGuard sets req.tenantCompanyId = "co-123"

Vendor Admin request (overview mode):
  JWT companyId = null, no X-Company-Id header → req.tenantCompanyId = null (bypass)

Vendor Admin in company context:
  JWT companyId = null, header X-Company-Id: "co-123" → req.tenantCompanyId = "co-123"
```

## Architecture

```
apps/api/src/modules/
  auth/
    auth.module.ts
    auth.controller.ts    POST /auth/login, GET /auth/me
    auth.service.ts       validateUser(), login(), buildJwt()
    jwt.strategy.ts       PassportStrategy(Strategy) — validates JWT
    dto/
      login.dto.ts        { email: string, password: string }

  companies/
    companies.module.ts
    companies.controller.ts
    companies.service.ts
    dto/
      create-company.dto.ts   { name: string }
      update-status.dto.ts    { status: 'active' | 'inactive' }

  users/
    users.module.ts
    users.controller.ts
    users.service.ts
    dto/
      create-user.dto.ts    { email, name, password, companyId }
      reassign-company.dto.ts { companyId: string }
      reset-password.dto.ts   { password: string }

common/guards/
  tenant.guard.ts   (full impl — was stub in Phase 01)
```

## Related Code Files

**Create**
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/jwt.strategy.ts`
- `apps/api/src/modules/auth/dto/login.dto.ts`
- `apps/api/src/modules/companies/companies.module.ts`
- `apps/api/src/modules/companies/companies.controller.ts`
- `apps/api/src/modules/companies/companies.service.ts`
- `apps/api/src/modules/companies/dto/create-company.dto.ts`
- `apps/api/src/modules/companies/dto/update-status.dto.ts`
- `apps/api/src/modules/users/users.module.ts`
- `apps/api/src/modules/users/users.controller.ts`
- `apps/api/src/modules/users/users.service.ts`
- `apps/api/src/modules/users/dto/create-user.dto.ts`
- `apps/api/src/modules/users/dto/reassign-company.dto.ts`
- `apps/api/src/modules/users/dto/reset-password.dto.ts`

**Modify**
- `apps/api/src/common/guards/tenant.guard.ts` — full implementation
- `apps/api/src/app.module.ts` — import Auth, Companies, Users modules

## Implementation Steps

### Auth Module

1. `JwtStrategy` implementing `PassportStrategy(Strategy)`:
   ```ts
   validate(payload: JwtPayload) {
     return { userId: payload.sub, email: payload.email, name: payload.name,
               role: payload.role, companyId: payload.companyId };
   }
   ```

2. `AuthService.login(dto)`:
   - Find user by email (throw 401 if not found)
   - `bcrypt.compare(dto.password, user.passwordHash)` (throw 401 if mismatch)
   - `jwtService.sign({ sub: user.id, email, name, role, companyId })`
   - Return `{ access_token, user: { id, email, name, role, companyId } }`

3. `AuthController`:
   - `POST /auth/login` → `@Public()`, returns login response
   - `GET /auth/me` → `@UseGuards(JwtAuthGuard)`, returns `@CurrentUser()`

### Companies Module

4. `CompaniesService`:
   - `findAll()` → `companyRepo.find({ order: { createdAt: 'DESC' } })`
   - `create(dto)` → generate unique slug, save
   - `updateStatus(id, status)` → `companyRepo.update(id, { status })`

5. `CompaniesController` — all methods decorated `@Roles('vendor_admin')`:
   - `GET /companies` → `findAll()`
   - `POST /companies` → `create(dto)` → returns 201 with created company
   - `PATCH /companies/:id/status` → `updateStatus()`

### Users Module

6. `UsersService`:
   - `findByCompany(companyId)` → `userRepo.find({ where: { companyId, role: 'operator' } })`
   - `create(dto)` → hash password, save user
   - `reassignCompany(id, companyId)` → verify company exists, update user
   - `resetPassword(id, password)` → hash, update

7. `UsersController` — all `@Roles('vendor_admin')`:
   - `GET /users?companyId=` → `findByCompany()`
   - `POST /users` → `create()` → 201
   - `PATCH /users/:id/company` → `reassignCompany()`
   - `PATCH /users/:id/password` → `resetPassword()`

### Tenant Guard (full impl)

8. `TenantGuard`:
   ```ts
   canActivate(ctx: ExecutionContext): boolean {
     const req = ctx.switchToHttp().getRequest();
     const user = req.user;
     if (!user) return false;
     if (user.role === 'vendor_admin') {
       const header = req.headers['x-company-id'];
       req.tenantCompanyId = header ?? null;
       return true;  // bypass — vendor_admin can see all
     }
     // operator: always use JWT companyId
     req.tenantCompanyId = user.companyId;
     if (!req.tenantCompanyId) return false;  // operator without company — deny
     return true;
   }
   ```

9. Apply `TenantGuard` globally in `main.ts` (after JwtAuthGuard), or per-controller where needed.

### Security: 403 on URL manipulation

10. Any service method that queries by companyId must validate:
    - For operator: `WHERE company_id = req.tenantCompanyId` — TypeORM enforces this
    - Future camera endpoints: `cameras.findAll({ where: { companyId: req.tenantCompanyId } })`

## Todo List
- [ ] `jwt.strategy.ts` — validate JWT payload
- [ ] `auth.service.ts` — validateUser, login, sign JWT
- [ ] `auth.controller.ts` — POST /login, GET /me
- [ ] `companies.service.ts` — findAll, create, updateStatus
- [ ] `companies.controller.ts` — GET, POST, PATCH status
- [ ] `users.service.ts` — findByCompany, create, reassign, resetPassword
- [ ] `users.controller.ts` — GET, POST, PATCH company, PATCH password
- [ ] `tenant.guard.ts` — full implementation
- [ ] DTOs with class-validator decorators
- [ ] Import all modules in app.module.ts
- [ ] Test: POST /api/auth/login with seed credentials → JWT
- [ ] Test: GET /api/companies with JWT → company list
- [ ] Test: GET /api/companies without JWT → 401
- [ ] Test: Operator token accessing /api/companies → 403

## Success Criteria
- `POST /api/auth/login` with `admin@intellipark.io / Admin@123` → valid JWT
- `GET /api/auth/me` with valid JWT → user object
- `GET /api/companies` with vendor_admin JWT → list (empty or seeded)
- `POST /api/companies` → creates company, returns it with auto slug
- `POST /api/users` → creates operator assigned to company
- Operator JWT on `GET /api/companies` → 403
- No JWT on any endpoint → 401

## Risk Assessment
- **bcrypt timing attack:** All 401 responses must have equal timing — use `bcrypt.compare` result, never short-circuit on email not found (still compare a dummy hash)
- **TenantGuard order:** Must run AFTER JwtAuthGuard so `req.user` is populated

## Security Considerations
- Never return `passwordHash` in any response (use `@Exclude()` or manual DTO mapping)
- Validate `companyId` exists before assigning operator (prevent orphan users)
- Rate limit login endpoint (defer to Sprint 2, note here)

## Next Steps
- Phase 04: Wire frontend to these real endpoints
