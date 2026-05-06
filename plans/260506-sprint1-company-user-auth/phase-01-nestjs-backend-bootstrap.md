# Phase 01 — NestJS Backend Bootstrap

## Context Links
- [Plan overview](./plan.md)
- [Brainstorm report](./reports/brainstorm-report.md)
- Camera plan that depends on this: [260505 plan](../260505-intelli-park-camera-system/plan.md)

## Overview
- **Priority:** P0 (blocks all other phases)
- **Status:** pending
- **Effort:** 4h
- Init NestJS project at `apps/api/`, wire MSSQL, JWT skeleton, global middleware.

## Key Insights
- Next.js stays at repo root — no monorepo restructure (KISS for POC scale)
- NestJS runs on port 3001; Next.js on 3000; CORS configured accordingly
- TypeORM `synchronize: true` for dev — no migration runner needed in Sprint 1
- JWT secret in `.env`; never hardcoded

## Requirements

**Functional**
- NestJS boots without errors, connects to MSSQL
- JWT guard wired globally (unprotected routes: POST /api/auth/login)
- `RequestContextInterceptor` extracts `companyId` from JWT and attaches to `request`
- `RolesGuard` reads `@Roles()` decorator, enforces role check
- `TenantGuard` is a stub — full logic in Phase 03

**Non-functional**
- Files < 200 lines, kebab-case
- TypeScript strict mode
- `@nestjs/config` for all env vars
- Validation pipe: `whitelist: true, forbidNonWhitelisted: true`

## Architecture

```
apps/api/
  src/
    common/
      decorators/
        current-user.decorator.ts      — @CurrentUser() param decorator
        roles.decorator.ts             — @Roles('vendor_admin') metadata
      guards/
        jwt-auth.guard.ts              — extends PassportAuthGuard('jwt')
        roles.guard.ts                 — reads @Roles metadata
        tenant.guard.ts                — stub, wired in Phase 03
      interceptors/
        request-context.interceptor.ts — attaches req.currentUser from JWT
    config/
      mssql.datasource.ts              — TypeORM MSSQL DataSource
      jwt.config.ts                    — JWT options from env
    app.module.ts
    main.ts
  .env.example
  package.json
  tsconfig.json
```

## Related Code Files

**Create (new directory)**
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/config/mssql.datasource.ts`
- `apps/api/src/config/jwt.config.ts`
- `apps/api/src/common/decorators/current-user.decorator.ts`
- `apps/api/src/common/decorators/roles.decorator.ts`
- `apps/api/src/common/guards/jwt-auth.guard.ts`
- `apps/api/src/common/guards/roles.guard.ts`
- `apps/api/src/common/guards/tenant.guard.ts` (stub)
- `apps/api/src/common/interceptors/request-context.interceptor.ts`
- `apps/api/.env.example`
- `apps/api/package.json`
- `apps/api/tsconfig.json`

## Implementation Steps

1. `mkdir apps && cd apps && nest new api --skip-git` (skip git — root already has git)
2. Install packages in `apps/api/`:
   ```bash
   npm install @nestjs/typeorm typeorm mssql @nestjs/jwt @nestjs/passport passport passport-jwt @nestjs/config class-validator class-transformer bcrypt
   npm install -D @types/passport-jwt @types/bcrypt
   ```
3. Create `mssql.datasource.ts` — TypeORM DataSource with MSSQL driver, `synchronize: true` for dev, entities from `dist/**/*.entity.js`
4. Register TypeORM in `app.module.ts`:
   ```ts
   TypeOrmModule.forRootAsync({
     imports: [ConfigModule],
     useFactory: (config: ConfigService) => ({
       type: 'mssql',
       host: config.get('DB_HOST'),
       port: +config.get('DB_PORT', 1433),
       username: config.get('DB_USER'),
       password: config.get('DB_PASS'),
       database: config.get('DB_NAME'),
       synchronize: true,
       entities: [__dirname + '/**/*.entity.{js,ts}'],
       options: { encrypt: false, trustServerCertificate: true },
     }),
     inject: [ConfigService],
   })
   ```
5. `ConfigModule.forRoot({ isGlobal: true })` in `app.module.ts`
6. `JwtModule.registerAsync` in `app.module.ts` — secret from `JWT_SECRET` env
7. Implement `JwtAuthGuard` extending `AuthGuard('jwt')` — apply as global guard in `main.ts` via `APP_GUARD`
8. Implement `RolesGuard` — reads `ROLES_KEY` metadata, checks `req.user.role`
9. Implement `RequestContextInterceptor` — copies `req.user` to `req.currentUser`
10. `@CurrentUser()` param decorator returns `req.currentUser`
11. `@Roles('vendor_admin')` metadata decorator
12. Add `@SetMetadata('isPublic', true)` decorator; `JwtAuthGuard` skips if public
13. `main.ts`: global validation pipe, CORS for `http://localhost:3000`, prefix `/api`
14. `.env.example`:
    ```
    DB_HOST=localhost
    DB_PORT=1433
    DB_USER=sa
    DB_PASS=
    DB_NAME=intellipark
    JWT_SECRET=change-me-in-prod
    PORT=3001
    ```

## Todo List
- [ ] Scaffold NestJS project in `apps/api/`
- [ ] Install deps
- [ ] MSSQL TypeORM config
- [ ] JWT module + JwtAuthGuard (global)
- [ ] RolesGuard
- [ ] RequestContextInterceptor + @CurrentUser decorator
- [ ] @Roles decorator + isPublic skip
- [ ] Global validation pipe, CORS, `/api` prefix
- [ ] `.env.example`
- [ ] Verify: `npm run start:dev` boots, MSSQL connects

## Success Criteria
- `npm run start:dev` in `apps/api/` boots without error
- MSSQL connection established (TypeORM logs tables)
- `POST /api/auth/login` (not yet implemented) returns 404 (not 500 or auth error)
- Any unprotected endpoint returns 200; any protected endpoint without JWT returns 401

## Risk Assessment
- **MSSQL on Windows/WSL:** `trustServerCertificate: true` + `encrypt: false` for local dev
- **Port conflict:** Ensure Next.js dev is on 3000, NestJS on 3001

## Security Considerations
- JWT secret from env, never in code
- Validation pipe rejects unknown fields (prevents injection via body)
- bcrypt for password hashing — imported here, used in Phase 03

## Next Steps
- Phase 02: Define TypeORM entities + seed
