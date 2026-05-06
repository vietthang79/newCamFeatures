# Phase 01 — NestJS Backend Bootstrap

## Context Links
- [Master Plan Overview](./plan.md)
- Previous plans: [260505](../260505-intelli-park-camera-system/plan.md), [260506](../260506-sprint1-company-user-auth/plan.md)

## Overview
- **Status:** pending
- **Effort:** 4h
- **Blocks:** All other backend phases
- Scaffold NestJS at `apps/api/`, configure MSSQL connection, wire JWT auth guards globally, implement decorators and interceptors

## Key Insights
- Next.js stays at repo root — no monorepo restructure
- NestJS on port 3001, Next.js on 3000; CORS configured
- TypeORM `synchronize: true` in dev only (entities define schema)
- JWT secret from `.env`, never hardcoded
- Validation pipe rejects unknown fields (security)

## Requirements

**Functional**
- NestJS boots without errors, connects to MSSQL (no table creation yet — Phase 02)
- JWT guard wired globally; `POST /api/auth/login` unprotected (returns 404 — not implemented)
- `RequestContextInterceptor` extracts `companyId` from JWT, attaches to `request`
- `RolesGuard` reads `@Roles()` decorator, enforces role check
- `@CurrentUser()` param decorator extracts user from JWT
- `@Public()` decorator marks routes as unprotected (skip JWT guard)
- `@Roles('vendor_admin')` marks routes as vendor-admin-only
- Global validation pipe: `whitelist: true, forbidNonWhitelisted: true` (rejects unknown fields)

**Non-functional**
- Files < 200 lines, kebab-case naming
- TypeScript strict mode
- `@nestjs/config` for all env vars
- All decorators/guards in `common/` (shared across modules)

## Architecture

```
apps/api/
├── src/
│   ├── main.ts                      Bootstrap
│   ├── app.module.ts                Root module
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── public.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── tenant.guard.ts (stub)
│   │   └── interceptors/
│   │       └── request-context.interceptor.ts
│   ├── config/
│   │   ├── jwt.config.ts
│   │   └── mssql.datasource.ts
│   └── modules/ (empty in Phase 01)
├── package.json
├── tsconfig.json
└── .env.example
```

## Related Code Files

**Create (new directory `apps/api/`)**
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/config/jwt.config.ts`
- `apps/api/src/config/mssql.datasource.ts`
- `apps/api/src/common/decorators/current-user.decorator.ts`
- `apps/api/src/common/decorators/public.decorator.ts`
- `apps/api/src/common/decorators/roles.decorator.ts`
- `apps/api/src/common/guards/jwt-auth.guard.ts`
- `apps/api/src/common/guards/roles.guard.ts`
- `apps/api/src/common/guards/tenant.guard.ts` (stub)
- `apps/api/src/common/interceptors/request-context.interceptor.ts`
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/.env.example`

## Implementation Steps

1. **Scaffold NestJS project:**
   ```bash
   cd /home/thang79/project/newCamFeatures
   mkdir apps
   npx @nestjs/cli@latest new api --skip-git
   ```
   Choose: npm, skip git

2. **Install dependencies** (in `apps/api/`):
   ```bash
   npm install @nestjs/typeorm typeorm mssql
   npm install @nestjs/jwt @nestjs/passport passport passport-jwt
   npm install @nestjs/config class-validator class-transformer bcrypt
   npm install -D @types/passport-jwt @types/bcrypt
   ```

3. **Create `config/jwt.config.ts`:**
   ```typescript
   import { JwtModuleOptions } from '@nestjs/jwt';
   import { ConfigService } from '@nestjs/config';
   
   export const jwtConfig = (config: ConfigService): JwtModuleOptions => ({
     secret: config.get('JWT_SECRET'),
     signOptions: { expiresIn: '7d' },
   });
   ```

4. **Create `config/mssql.datasource.ts`:**
   ```typescript
   import { DataSource } from 'typeorm';
   import { ConfigService } from '@nestjs/config';
   
   const config = new ConfigService();
   export const mssqlDataSource = new DataSource({
     type: 'mssql',
     host: config.get('DB_HOST'),
     port: +config.get('DB_PORT', 1433),
     username: config.get('DB_USER'),
     password: config.get('DB_PASS'),
     database: config.get('DB_NAME'),
     synchronize: true,  // dev only
     entities: [`${__dirname}/**/*.entity.{js,ts}`],
     options: { encrypt: false, trustServerCertificate: true },
   });
   ```

5. **Create decorators** (current-user, public, roles):
   ```typescript
   // current-user.decorator.ts
   import { createParamDecorator, ExecutionContext } from '@nestjs/common';
   export const CurrentUser = createParamDecorator(
     (data: unknown, ctx: ExecutionContext) => {
       const request = ctx.switchToHttp().getRequest();
       return request.currentUser;
     },
   );
   
   // public.decorator.ts
   import { SetMetadata } from '@nestjs/common';
   export const Public = () => SetMetadata('isPublic', true);
   
   // roles.decorator.ts
   import { SetMetadata } from '@nestjs/common';
   export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
   ```

6. **Create `common/guards/jwt-auth.guard.ts`:**
   ```typescript
   import { Injectable, ExecutionContext } from '@nestjs/common';
   import { AuthGuard } from '@nestjs/passport';
   import { Reflector } from '@nestjs/core';
   
   @Injectable()
   export class JwtAuthGuard extends AuthGuard('jwt') {
     constructor(private reflector: Reflector) { super(); }
   
     canActivate(ctx: ExecutionContext) {
       const isPublic = this.reflector.getAllAndOverride('isPublic', [
         ctx.getHandler(),
         ctx.getClass(),
       ]);
       if (isPublic) return true;
       return super.canActivate(ctx);
     }
   }
   ```

7. **Create `common/guards/roles.guard.ts`:**
   ```typescript
   import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
   import { Reflector } from '@nestjs/core';
   
   @Injectable()
   export class RolesGuard implements CanActivate {
     constructor(private reflector: Reflector) {}
   
     canActivate(ctx: ExecutionContext): boolean {
       const roles = this.reflector.get<string[]>('roles', ctx.getHandler());
       if (!roles) return true;
       const request = ctx.switchToHttp().getRequest();
       if (!roles.includes(request.user?.role)) {
         throw new ForbiddenException();
       }
       return true;
     }
   }
   ```

8. **Create `common/guards/tenant.guard.ts` (stub):**
   ```typescript
   import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
   
   @Injectable()
   export class TenantGuard implements CanActivate {
     canActivate(ctx: ExecutionContext): boolean {
       // Implemented fully in Phase 03
       return true;
     }
   }
   ```

9. **Create `common/interceptors/request-context.interceptor.ts`:**
   ```typescript
   import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
   import { Observable } from 'rxjs';
   
   @Injectable()
   export class RequestContextInterceptor implements NestInterceptor {
     intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
       const request = ctx.switchToHttp().getRequest();
       if (request.user) {
         request.currentUser = request.user;
       }
       return next.handle();
     }
   }
   ```

10. **Create JWT strategy** (will be completed in Phase 03):
    ```typescript
    // jwt.strategy.ts (stub)
    import { Injectable } from '@nestjs/common';
    import { PassportStrategy } from '@nestjs/passport';
    import { ExtractJwt, Strategy } from 'passport-jwt';
    import { ConfigService } from '@nestjs/config';
    
    @Injectable()
    export class JwtStrategy extends PassportStrategy(Strategy) {
      constructor(config: ConfigService) {
        super({
          jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
          ignoreExpiration: false,
          secretOrKey: config.get('JWT_SECRET'),
        });
      }
    
      validate(payload: any) {
        // Phase 03: full implementation
        return payload;
      }
    }
    ```

11. **Create `app.module.ts`:**
    ```typescript
    import { Module } from '@nestjs/common';
    import { ConfigModule } from '@nestjs/config';
    import { TypeOrmModule } from '@nestjs/typeorm';
    import { JwtModule } from '@nestjs/jwt';
    import { PassportModule } from '@nestjs/passport';
    import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
    import { RolesGuard } from './common/guards/roles.guard';
    import { TenantGuard } from './common/guards/tenant.guard';
    import { jwtConfig } from './config/jwt.config';
    import { mssqlDataSource } from './config/mssql.datasource';
    
    @Module({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot(mssqlDataSource.options),
        JwtModule.registerAsync({ useFactory: jwtConfig, inject: [ConfigService], global: true }),
        PassportModule,
      ],
      providers: [
        { provide: 'APP_GUARD', useClass: JwtAuthGuard },
        { provide: 'APP_GUARD', useClass: RolesGuard },
        { provide: 'APP_GUARD', useClass: TenantGuard },
      ],
    })
    export class AppModule {}
    ```

12. **Create `main.ts`:**
    ```typescript
    import { NestFactory } from '@nestjs/core';
    import { ValidationPipe } from '@nestjs/common';
    import { AppModule } from './app.module';
    
    async function bootstrap() {
      const app = await NestFactory.create(AppModule);
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      app.enableCors({ origin: 'http://localhost:3000' });
      app.setGlobalPrefix('api');
      await app.listen(+process.env.PORT || 3001);
      console.log('NestJS listening on port', process.env.PORT || 3001);
    }
    bootstrap();
    ```

13. **Create `.env.example`:**
    ```
    DB_HOST=localhost
    DB_PORT=1433
    DB_USER=sa
    DB_PASS=YourPassword123!
    DB_NAME=intellipark
    JWT_SECRET=your-secret-key-change-in-prod
    PORT=3001
    ```

14. **Create `package.json`** (already generated by `nest new`, verify):
    ```json
    {
      "name": "intelli-park-api",
      "version": "0.1.0",
      "scripts": {
        "start": "nest start",
        "start:dev": "nest start --watch",
        "start:debug": "nest start --debug --watch",
        "build": "nest build"
      }
    }
    ```

15. **Update root `tsconfig.json`** to exclude `apps/api/` or create project references (optional for Phase 01 — KISS)

## Todo List

- [ ] Scaffold NestJS with `nest new api --skip-git`
- [ ] Install all dependencies
- [ ] Create `config/jwt.config.ts`
- [ ] Create `config/mssql.datasource.ts`
- [ ] Create decorators: `@CurrentUser()`, `@Public()`, `@Roles()`
- [ ] Create `JwtAuthGuard` (extends AuthGuard, respects @Public)
- [ ] Create `RolesGuard`
- [ ] Create `TenantGuard` (stub)
- [ ] Create `RequestContextInterceptor`
- [ ] Create JWT strategy (stub — validate function will be completed in Phase 03)
- [ ] Create `app.module.ts` with all imports/providers
- [ ] Create `main.ts` with global pipes, CORS, prefix
- [ ] Create `.env.example`
- [ ] Test: `npm run start:dev` boots without error
- [ ] Test: MSSQL connection established (check logs)
- [ ] Test: Unauthenticated request returns 401 (for protected routes)
- [ ] Test: `POST /api/auth/login` returns 404 (endpoint not yet implemented)

## Success Criteria

- ✅ `npm run start:dev` in `apps/api/` boots without errors
- ✅ TypeORM logs show successful MSSQL connection (or at least no connection timeout)
- ✅ `POST /api/auth/login` returns 404 (not 500, not 401)
- ✅ Any protected endpoint without JWT returns 401
- ✅ Endpoint decorated `@Public()` returns appropriate response (2xx or 404) without JWT
- ✅ TypeScript compiles with strict mode
- ✅ No console errors or warnings

## Risk Assessment

- **MSSQL connection fails:** Verify connection string, check firewall/port 1433, ensure `trustServerCertificate: true` on Windows/WSL
- **Port 3001 conflict:** Check `netstat -an | grep 3001` on Windows; use different port in `.env` if conflict
- **Module resolution:** If `config/mssql.datasource.ts` import fails, verify path is relative (use `./config/...`)

## Security Considerations

- JWT secret from `.env` (checked in `.gitignore`)
- Validation pipe rejects unknown fields (prevents injection)
- CORS limited to `http://localhost:3000`
- No hardcoded secrets or credentials

## Next Steps

→ **Phase 02:** Create TypeORM entities (Company, User) and seed database
