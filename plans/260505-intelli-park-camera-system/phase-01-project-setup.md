# Phase 01 — Project Setup

## Context Links
- [Plan overview](./plan.md)
- TypeORM dual-DB docs: https://typeorm.io/multiple-data-sources
- NestJS Bull: https://docs.nestjs.com/techniques/queues

## Overview
- **Priority:** P1 (blocks all)
- **Status:** pending
- **Effort:** 6h
- Bootstrap NestJS API + Next.js frontend, dual DB, Redis/Bull, JWT context, RBAC.

## Key Insights
- Two TypeORM DataSources require explicit `name` ('mssql', 'pg') and `@InjectRepository(Entity, 'name')` everywhere.
- Multi-tenancy enforced at interceptor layer (single source of truth for company_id).
- Bull queue decouples HTTP push from DB writes — survives bursts (~2 FPS × 5 MB).

## Requirements
**Functional**
- Two NestJS apps OR monorepo: `apps/api` (NestJS), `apps/web` (Next.js).
- Connect MSSQL + PostgreSQL simultaneously.
- Redis available for Bull.
- JWT middleware extracts `{ user_id, company_id, role }` from token claims.
- RBAC guard: roles = `operator`, `vendor_admin`.

**Non-functional**
- Env-driven config (`@nestjs/config`).
- TypeScript strict mode.
- Files <200 lines; kebab-case.

## Architecture
```
apps/
├── api/                       NestJS
│   ├── src/
│   │   ├── common/
│   │   │   ├── interceptors/request-context.interceptor.ts
│   │   │   ├── guards/jwt-auth.guard.ts
│   │   │   ├── guards/roles.guard.ts
│   │   │   ├── decorators/current-company.decorator.ts
│   │   │   └── decorators/roles.decorator.ts
│   │   ├── config/
│   │   │   ├── mssql.datasource.ts
│   │   │   ├── pg.datasource.ts
│   │   │   └── bull.config.ts
│   │   ├── modules/
│   │   │   ├── cameras/
│   │   │   ├── zones/
│   │   │   ├── ingestion/
│   │   │   ├── health/
│   │   │   └── admin/
│   │   └── main.ts
└── web/                       Next.js App Router
    └── app/
```

## Related Code Files
**Create**
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/config/mssql.datasource.ts`
- `apps/api/src/config/pg.datasource.ts`
- `apps/api/src/common/interceptors/request-context.interceptor.ts`
- `apps/api/src/common/guards/roles.guard.ts`
- `apps/api/src/common/decorators/current-company.decorator.ts`
- `apps/web/app/layout.tsx`
- `.env.example`

## Implementation Steps
1. `nest new apps/api` + `npx create-next-app apps/web` (or monorepo with pnpm workspaces).
2. Install: `@nestjs/typeorm typeorm mssql pg @nestjs/bull bull ioredis @nestjs/jwt @nestjs/config class-validator class-transformer`.
3. Define MSSQL DataSource with `name: 'mssql'`. Entities: `Company`, `Camera`, `Zone`, `User` (stubs OK).
4. Define Postgres DataSource with `name: 'pg'`. Entities: `FrameIngestionLog`, `Alert`.
5. Register both in `AppModule` via `TypeOrmModule.forRootAsync({ name, ... })`.
6. Implement `RequestContextInterceptor`:
   ```ts
   const req = ctx.switchToHttp().getRequest();
   req.companyId = req.user?.company_id;
   ```
7. `@CurrentCompany()` param decorator returns `req.companyId`.
8. `RolesGuard` reads `@Roles('vendor_admin')` metadata, checks `req.user.role`.
9. Bull module: `BullModule.forRoot({ redis: { host, port } })`. Register queue `frame-ingestion`.
10. Setup global validation pipe (`whitelist: true, forbidNonWhitelisted: true`).
11. CORS for Next.js dev origin.

## Todo List
- [ ] Init monorepo / two apps
- [ ] Install deps
- [ ] MSSQL DataSource
- [ ] PostgreSQL DataSource
- [ ] JWT auth assumed; wire request context
- [ ] RolesGuard + decorators
- [ ] Bull/Redis config
- [ ] Global validation pipe
- [ ] `.env.example`

## Success Criteria
- `npm run start:dev` boots without errors, both DBs connected, Redis ping OK.
- Hitting any protected endpoint without JWT returns 401.
- `req.companyId` populated downstream.

## Risk Assessment
- **MSSQL driver on Windows:** `mssql` package may need TLS settings → document `encrypt=true, trustServerCertificate=true` for dev.
- **Redis local missing:** add docker-compose snippet.

## Security Considerations
- Never log JWT or DB passwords.
- Validation pipe rejects unknown fields (prevents company_id injection from body).

## Next Steps
- Phase 02: Camera registration.
