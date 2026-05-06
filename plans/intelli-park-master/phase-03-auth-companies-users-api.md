# Phase 03 — Auth + Companies + Users API

## Context Links
- [Master Plan Overview](./plan.md)
- [Phase 02 — Database Schema](./phase-02-database-schema.md)

## Overview
- **Status:** pending
- **Effort:** 6h
- **Blocked by:** Phase 02
- Implement all backend endpoints: JWT login, companies CRUD, users CRUD, tenant isolation via TenantGuard

## Key Insights
- `vendor_admin` has `companyId: null` in JWT — TenantGuard must allow access to all companies in overview mode OR specific company if `X-Company-Id` header sent
- Company switcher: vendor_admin sends `X-Company-Id` header → backend reads it for data scoping
- All company/user endpoints: `@Roles('vendor_admin')` — operators cannot access admin endpoints
- Password reset by vendor_admin: direct PATCH (no email token needed Sprint 1)
- `POST /api/auth/login` is `@Public()` (no JWT required)
- All user lists filtered by role=operator (vendors cannot be created via users endpoint)

## API Endpoints

```
POST   /api/auth/login                    @Public
  Request:  { email: string, password: string }
  Response: { access_token: string, user: { id, email, name, role, companyId } }

GET    /api/auth/me                       @JwtAuth
  Response: { id, email, name, role, companyId }

GET    /api/companies                     @Roles('vendor_admin')
  Response: Company[]

POST   /api/companies                     @Roles('vendor_admin')
  Request:  { name: string }
  Response: Company (201)

PATCH  /api/companies/:id/status          @Roles('vendor_admin')
  Request:  { status: 'active' | 'inactive' }
  Response: Company (200)

GET    /api/users?companyId=:id           @Roles('vendor_admin')
  Response: User[] (filtered by companyId and role=operator)

POST   /api/users                         @Roles('vendor_admin')
  Request:  { email, name, password, companyId: string | null }
  Response: User (201)

PATCH  /api/users/:id/company             @Roles('vendor_admin')
  Request:  { companyId: string }
  Response: User (200)

PATCH  /api/users/:id/password            @Roles('vendor_admin')
  Request:  { password: string }
  Response: User (200)
```

## JWT Payload

```typescript
interface JwtPayload {
  sub: string;          // userId
  email: string;
  name: string;
  role: 'vendor_admin' | 'operator';
  companyId: string | null;
}
```

Token expiry: `7d` for Sprint 1 (no refresh token).

## Request Context & Tenant Guard

```
Operator request:
  JWT: { role: 'operator', companyId: 'co-123' }
  TenantGuard sets: req.tenantCompanyId = 'co-123'
  All queries scoped: WHERE company_id = 'co-123'

Vendor Admin (overview mode):
  JWT: { role: 'vendor_admin', companyId: null }
  No X-Company-Id header
  TenantGuard sets: req.tenantCompanyId = null
  Queries unscoped: SELECT * FROM companies (see all)

Vendor Admin (in company context):
  JWT: { role: 'vendor_admin', companyId: null }
  Header: X-Company-Id: 'co-123'
  TenantGuard sets: req.tenantCompanyId = 'co-123'
  Queries scoped: WHERE company_id = 'co-123' (for cameras/zones only)
```

## Architecture

```
modules/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts         POST /auth/login, GET /auth/me
│   ├── auth.service.ts            validateUser(), login(), buildJwt()
│   ├── jwt.strategy.ts            PassportStrategy(Strategy) — validates JWT
│   └── dto/
│       └── login.dto.ts           { email, password }
├── companies/
│   ├── companies.module.ts
│   ├── companies.controller.ts    GET, POST, PATCH /companies/*
│   ├── companies.service.ts       findAll(), create(), updateStatus()
│   └── dto/
│       ├── create-company.dto.ts  { name }
│       └── update-status.dto.ts   { status }
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts        GET, POST, PATCH /users/*
│   ├── users.service.ts           findByCompany(), create(), reassign(), resetPassword()
│   └── dto/
│       ├── create-user.dto.ts     { email, name, password, companyId }
│       ├── reassign-company.dto.ts { companyId }
│       └── reset-password.dto.ts  { password }

common/guards/
└── tenant.guard.ts                Full implementation (was stub in Phase 01)
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

1. **Create `auth/dto/login.dto.ts`:**
   ```typescript
   import { IsEmail, MinLength } from 'class-validator';
   
   export class LoginDto {
     @IsEmail()
     email: string;
   
     @MinLength(6)
     password: string;
   }
   ```

2. **Update `auth/jwt.strategy.ts`:**
   ```typescript
   import { Injectable } from '@nestjs/common';
   import { PassportStrategy } from '@nestjs/passport';
   import { Strategy } from 'passport-jwt';
   import { ConfigService } from '@nestjs/config';
   import { ExtractJwt } from 'passport-jwt';
   
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
       return {
         userId: payload.sub,
         email: payload.email,
         name: payload.name,
         role: payload.role,
         companyId: payload.companyId,
       };
     }
   }
   ```

3. **Create `auth/auth.service.ts`:**
   ```typescript
   import { Injectable, UnauthorizedException } from '@nestjs/common';
   import { InjectRepository } from '@nestjs/typeorm';
   import { Repository } from 'typeorm';
   import { JwtService } from '@nestjs/jwt';
   import * as bcrypt from 'bcrypt';
   import { User } from '../users/user.entity';
   import { LoginDto } from './dto/login.dto';
   
   @Injectable()
   export class AuthService {
     constructor(
       @InjectRepository(User)
       private userRepo: Repository<User>,
       private jwtService: JwtService,
     ) {}
   
     async validateUser(email: string, password: string): Promise<User> {
       const user = await this.userRepo.findOneBy({ email });
       if (!user) throw new UnauthorizedException('Invalid email or password');
       const isValid = await bcrypt.compare(password, user.passwordHash);
       if (!isValid) throw new UnauthorizedException('Invalid email or password');
       return user;
     }
   
     async login(dto: LoginDto) {
       const user = await this.validateUser(dto.email, dto.password);
       const token = this.jwtService.sign({
         sub: user.id,
         email: user.email,
         name: user.name,
         role: user.role,
         companyId: user.companyId,
       });
       return {
         access_token: token,
         user: {
           id: user.id,
           email: user.email,
           name: user.name,
           role: user.role,
           companyId: user.companyId,
         },
       };
     }
   }
   ```

4. **Create `auth/auth.controller.ts`:**
   ```typescript
   import { Controller, Post, Get, Body } from '@nestjs/common';
   import { AuthService } from './auth.service';
   import { LoginDto } from './dto/login.dto';
   import { Public } from '../common/decorators/public.decorator';
   import { CurrentUser } from '../common/decorators/current-user.decorator';
   
   @Controller('auth')
   export class AuthController {
     constructor(private authService: AuthService) {}
   
     @Public()
     @Post('login')
     login(@Body() dto: LoginDto) {
       return this.authService.login(dto);
     }
   
     @Get('me')
     getProfile(@CurrentUser() user: any) {
       return user;
     }
   }
   ```

5. **Create `auth/auth.module.ts`:**
   ```typescript
   import { Module } from '@nestjs/common';
   import { TypeOrmModule } from '@nestjs/typeorm';
   import { PassportModule } from '@nestjs/passport';
   import { User } from '../users/user.entity';
   import { AuthService } from './auth.service';
   import { AuthController } from './auth.controller';
   import { JwtStrategy } from './jwt.strategy';
   
   @Module({
     imports: [TypeOrmModule.forFeature([User]), PassportModule],
     controllers: [AuthController],
     providers: [AuthService, JwtStrategy],
   })
   export class AuthModule {}
   ```

### Companies Module

6. **Create `companies/dto/create-company.dto.ts`:**
   ```typescript
   import { IsString, MinLength } from 'class-validator';
   
   export class CreateCompanyDto {
     @IsString()
     @MinLength(2)
     name: string;
   }
   ```

7. **Create `companies/dto/update-status.dto.ts`:**
   ```typescript
   import { IsIn } from 'class-validator';
   
   export class UpdateStatusDto {
     @IsIn(['active', 'inactive'])
     status: string;
   }
   ```

8. **Create `companies/companies.service.ts`:**
   ```typescript
   import { Injectable } from '@nestjs/common';
   import { InjectRepository } from '@nestjs/typeorm';
   import { Repository } from 'typeorm';
   import { Company } from './company.entity';
   import { CreateCompanyDto } from './dto/create-company.dto';
   import { UpdateStatusDto } from './dto/update-status.dto';
   
   @Injectable()
   export class CompaniesService {
     constructor(
       @InjectRepository(Company)
       private companyRepo: Repository<Company>,
     ) {}
   
     async findAll() {
       return this.companyRepo.find({ order: { createdAt: 'DESC' } });
     }
   
     async create(dto: CreateCompanyDto) {
       const slug = await this.uniqueSlug(
         dto.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
       );
       const company = this.companyRepo.create({ name: dto.name, slug });
       return this.companyRepo.save(company);
     }
   
     async updateStatus(id: string, dto: UpdateStatusDto) {
       await this.companyRepo.update(id, { status: dto.status });
       return this.companyRepo.findOneBy({ id });
     }
   
     private async uniqueSlug(base: string): Promise<string> {
       let slug = base;
       let i = 2;
       while (await this.companyRepo.findOneBy({ slug })) {
         slug = `${base}-${i++}`;
       }
       return slug;
     }
   }
   ```

9. **Create `companies/companies.controller.ts`:**
   ```typescript
   import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
   import { Roles } from '../common/decorators/roles.decorator';
   import { CompaniesService } from './companies.service';
   import { CreateCompanyDto } from './dto/create-company.dto';
   import { UpdateStatusDto } from './dto/update-status.dto';
   
   @Controller('companies')
   @Roles('vendor_admin')
   export class CompaniesController {
     constructor(private companiesService: CompaniesService) {}
   
     @Get()
     findAll() {
       return this.companiesService.findAll();
     }
   
     @Post()
     create(@Body() dto: CreateCompanyDto) {
       return this.companiesService.create(dto);
     }
   
     @Patch(':id/status')
     updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
       return this.companiesService.updateStatus(id, dto);
     }
   }
   ```

10. **Create `companies/companies.module.ts`:**
    ```typescript
    import { Module } from '@nestjs/common';
    import { TypeOrmModule } from '@nestjs/typeorm';
    import { Company } from './company.entity';
    import { CompaniesService } from './companies.service';
    import { CompaniesController } from './companies.controller';
    
    @Module({
      imports: [TypeOrmModule.forFeature([Company])],
      controllers: [CompaniesController],
      providers: [CompaniesService],
    })
    export class CompaniesModule {}
    ```

### Users Module

11. **Create `users/dto/create-user.dto.ts`:**
    ```typescript
    import { IsEmail, MinLength, IsIn, Optional, IsUUID } from 'class-validator';
    
    export class CreateUserDto {
      @IsEmail()
      email: string;
    
      @MinLength(2)
      name: string;
    
      @MinLength(6)
      password: string;
    
      @IsIn(['vendor_admin', 'operator'])
      role: string;
    
      @Optional()
      @IsUUID()
      companyId?: string | null;
    }
    ```

12. **Create `users/dto/reassign-company.dto.ts`:**
    ```typescript
    import { IsUUID } from 'class-validator';
    
    export class ReassignCompanyDto {
      @IsUUID()
      companyId: string;
    }
    ```

13. **Create `users/dto/reset-password.dto.ts`:**
    ```typescript
    import { MinLength } from 'class-validator';
    
    export class ResetPasswordDto {
      @MinLength(6)
      password: string;
    }
    ```

14. **Create `users/users.service.ts`:**
    ```typescript
    import { Injectable, BadRequestException } from '@nestjs/common';
    import { InjectRepository } from '@nestjs/typeorm';
    import { Repository } from 'typeorm';
    import * as bcrypt from 'bcrypt';
    import { User } from './user.entity';
    import { Company } from '../companies/company.entity';
    import { CreateUserDto } from './dto/create-user.dto';
    import { ReassignCompanyDto } from './dto/reassign-company.dto';
    import { ResetPasswordDto } from './dto/reset-password.dto';
    
    @Injectable()
    export class UsersService {
      constructor(
        @InjectRepository(User)
        private userRepo: Repository<User>,
        @InjectRepository(Company)
        private companyRepo: Repository<Company>,
      ) {}
    
      async findByCompany(companyId?: string) {
        const query = this.userRepo.createQueryBuilder('user');
        if (companyId) {
          query.where('user.companyId = :companyId', { companyId });
        }
        query.where('user.role = :role', { role: 'operator' });
        return query.getMany();
      }
    
      async create(dto: CreateUserDto) {
        const exists = await this.userRepo.findOneBy({ email: dto.email });
        if (exists) throw new BadRequestException('Email already exists');
    
        if (dto.role === 'operator' && !dto.companyId) {
          throw new BadRequestException('Operators must have a company assigned');
        }
    
        if (dto.companyId) {
          const company = await this.companyRepo.findOneBy({ id: dto.companyId });
          if (!company) throw new BadRequestException('Company does not exist');
        }
    
        const hash = await bcrypt.hash(dto.password, 10);
        const user = this.userRepo.create({
          email: dto.email,
          name: dto.name,
          passwordHash: hash,
          role: dto.role,
          companyId: dto.companyId || null,
        });
        return this.userRepo.save(user);
      }
    
      async reassignCompany(id: string, dto: ReassignCompanyDto) {
        const company = await this.companyRepo.findOneBy({ id: dto.companyId });
        if (!company) throw new BadRequestException('Company does not exist');
        await this.userRepo.update(id, { companyId: dto.companyId });
        return this.userRepo.findOneBy({ id });
      }
    
      async resetPassword(id: string, dto: ResetPasswordDto) {
        const hash = await bcrypt.hash(dto.password, 10);
        await this.userRepo.update(id, { passwordHash: hash });
        return this.userRepo.findOneBy({ id });
      }
    }
    ```

15. **Create `users/users.controller.ts`:**
    ```typescript
    import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
    import { Roles } from '../common/decorators/roles.decorator';
    import { UsersService } from './users.service';
    import { CreateUserDto } from './dto/create-user.dto';
    import { ReassignCompanyDto } from './dto/reassign-company.dto';
    import { ResetPasswordDto } from './dto/reset-password.dto';
    
    @Controller('users')
    @Roles('vendor_admin')
    export class UsersController {
      constructor(private usersService: UsersService) {}
    
      @Get()
      findByCompany(@Query('companyId') companyId?: string) {
        return this.usersService.findByCompany(companyId);
      }
    
      @Post()
      create(@Body() dto: CreateUserDto) {
        return this.usersService.create(dto);
      }
    
      @Patch(':id/company')
      reassignCompany(
        @Param('id') id: string,
        @Body() dto: ReassignCompanyDto,
      ) {
        return this.usersService.reassignCompany(id, dto);
      }
    
      @Patch(':id/password')
      resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
        return this.usersService.resetPassword(id, dto);
      }
    }
    ```

16. **Create `users/users.module.ts`:**
    ```typescript
    import { Module } from '@nestjs/common';
    import { TypeOrmModule } from '@nestjs/typeorm';
    import { User } from './user.entity';
    import { Company } from '../companies/company.entity';
    import { UsersService } from './users.service';
    import { UsersController } from './users.controller';
    
    @Module({
      imports: [TypeOrmModule.forFeature([User, Company])],
      controllers: [UsersController],
      providers: [UsersService],
    })
    export class UsersModule {}
    ```

### Tenant Guard

17. **Update `common/guards/tenant.guard.ts` (full implementation):**
    ```typescript
    import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
    
    @Injectable()
    export class TenantGuard implements CanActivate {
      canActivate(ctx: ExecutionContext): boolean {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user;
    
        if (!user) return false;
    
        if (user.role === 'vendor_admin') {
          // Vendor admin can access all companies or specific one via header
          const header = request.headers['x-company-id'];
          request.tenantCompanyId = header ?? null;
          return true;
        }
    
        // Operator: always use JWT companyId
        request.tenantCompanyId = user.companyId;
        if (!request.tenantCompanyId) {
          throw new ForbiddenException('Operator must have a company assigned');
        }
        return true;
      }
    }
    ```

18. **Update `app.module.ts`:**
    ```typescript
    import { Module } from '@nestjs/common';
    import { AuthModule } from './modules/auth/auth.module';
    import { CompaniesModule } from './modules/companies/companies.module';
    import { UsersModule } from './modules/users/users.module';
    
    @Module({
      imports: [AuthModule, CompaniesModule, UsersModule],
    })
    export class AppModule {}
    ```

## Todo List

- [ ] Create all DTOs (login, create-company, create-user, etc.)
- [ ] Update JWT strategy to validate and return user object
- [ ] Create AuthService with validateUser() and login()
- [ ] Create AuthController with POST /login and GET /me
- [ ] Create CompaniesService with findAll(), create(), updateStatus()
- [ ] Create CompaniesController with all endpoints
- [ ] Create UsersService with full CRUD logic
- [ ] Create UsersController with all endpoints
- [ ] Implement TenantGuard (full version, not stub)
- [ ] Register all modules in AppModule
- [ ] Test: POST /api/auth/login with `admin@intellipark.io / Admin@123` → valid JWT
- [ ] Test: GET /api/auth/me with JWT → user object
- [ ] Test: GET /api/companies with vendor_admin JWT → company list
- [ ] Test: POST /api/companies → creates company with auto-slug
- [ ] Test: POST /api/users → creates operator assigned to company
- [ ] Test: Operator JWT on GET /api/companies → 403
- [ ] Test: No JWT on any endpoint → 401

## Success Criteria

- ✅ `POST /api/auth/login` with `admin@intellipark.io / Admin@123` returns `{ access_token, user }`
- ✅ `GET /api/auth/me` with valid JWT returns user object
- ✅ `GET /api/companies` with vendor_admin JWT returns company list (initially empty after seed)
- ✅ `POST /api/companies` with vendor_admin JWT creates company, returns it with auto-slug
- ✅ `POST /api/users` with vendor_admin JWT creates operator assigned to company
- ✅ Operator JWT on `GET /api/companies` returns 403 (RolesGuard)
- ✅ No JWT on any endpoint returns 401 (JwtAuthGuard)
- ✅ Vendor_admin can switch company context via `X-Company-Id` header
- ✅ TenantGuard attached to request; `req.tenantCompanyId` set correctly

## Risk Assessment

- **bcrypt timing attack:** All 401 responses must have equal timing — bcrypt.compare always runs (never short-circuit)
- **TenantGuard order:** Must run AFTER JwtAuthGuard so `req.user` is populated
- **Operator without company:** Should not exist in DB; validation prevents creation
- **Email uniqueness race condition:** Validation happens before insert; OK for Sprint 1

## Security Considerations

- Never return `passwordHash` in any response (use DTO mapping or `@Exclude()`)
- Validate `companyId` exists before assigning operator (prevent orphan users)
- Rate limit login endpoint (defer to Sprint 2, note here)
- JWT secret stored in `.env` (never in code)
- All requests validated by `ValidationPipe` (whitelist mode)

## Next Steps

→ **Phase 04:** Implement camera registration, ONVIF probe, frame ingestion, and zones API
