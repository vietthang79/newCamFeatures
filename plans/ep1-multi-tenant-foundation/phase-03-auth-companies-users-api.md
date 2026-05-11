# Phase 03 — Auth, Companies & Users API

**Status:** ⏳ Pending  
**Priority:** 🔴 Critical  
**Effort:** ~6 hours  
**Depends on:** Phase 02 (entities và tables tồn tại)

## Overview

Implement toàn bộ business logic BE:
1. Auth: login, JWT issuance, httpOnly cookie
2. TenantGuard: auto-filter queries theo company
3. Companies CRUD API
4. Users CRUD API
5. Audit logging cho login events

## API Contract

### Auth

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/auth/login` | None | `{ email, password }` | `{ user: UserDto }` + Set-Cookie |
| POST | `/api/auth/logout` | Cookie | — | `{}` + Clear-Cookie |
| GET | `/api/auth/me` | Cookie | — | `{ user: UserDto }` |

**Login response cookie:**
```
Set-Cookie: accessToken=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400
```

**JWT payload:**
```json
{ "userId": "uuid", "email": "...", "role": "operator", "companyId": "uuid|null" }
```

### Companies

| Method | Path | Auth | Access |
|--------|------|------|--------|
| GET | `/api/companies` | Cookie | vendor_admin only |
| POST | `/api/companies` | Cookie | vendor_admin only |
| GET | `/api/companies/:id` | Cookie | vendor_admin or own company |
| PATCH | `/api/companies/:id` | Cookie | vendor_admin only |
| DELETE | `/api/companies/:id` | Cookie | vendor_admin only |

### Users

| Method | Path | Auth | Access |
|--------|------|------|--------|
| GET | `/api/users` | Cookie | vendor_admin: all; operator: own company |
| POST | `/api/users` | Cookie | vendor_admin only |
| GET | `/api/users/:id` | Cookie | vendor_admin or self |
| PATCH | `/api/users/:id` | Cookie | vendor_admin or self |
| DELETE | `/api/users/:id` | Cookie | vendor_admin only |

## Module Structure

```
gateway-nest/src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── dto/
│   │   ├── login.dto.ts
│   │   └── user-response.dto.ts
│   └── strategies/
│       └── jwt.strategy.ts
├── companies/
│   ├── companies.module.ts
│   ├── companies.controller.ts
│   ├── companies.service.ts
│   └── dto/
│       ├── create-company.dto.ts
│       ├── update-company.dto.ts
│       └── company-response.dto.ts
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── dto/
│       ├── create-user.dto.ts
│       ├── update-user.dto.ts
│       └── user-response.dto.ts
├── audit/
│   ├── audit.module.ts
│   └── audit.service.ts
└── common/
    ├── guards/
    │   ├── jwt-auth.guard.ts
    │   └── tenant.guard.ts
    ├── decorators/
    │   ├── current-user.decorator.ts
    │   └── roles.decorator.ts
    └── interfaces/
        └── jwt-payload.interface.ts
```

## Key Implementations

### JWT Strategy

```typescript
// auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      // Extract JWT từ httpOnly cookie
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request?.cookies?.accessToken ?? null
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt.secret'),
    });
  }

  async validate(payload: { userId: string; email: string; role: string; companyId: string | null }) {
    return { userId: payload.userId, email: payload.email, role: payload.role, companyId: payload.companyId };
  }
}
```

### TenantGuard

```typescript
// common/guards/tenant.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;
    if (user.role === 'vendor_admin') return true; // bypass

    // Nếu request có companyId param — phải match với JWT
    const requestedCompanyId = request.params?.companyId ?? request.query?.companyId;
    if (requestedCompanyId && requestedCompanyId !== user.companyId) {
      throw new ForbiddenException('Access denied: company mismatch');
    }

    return true;
  }
}
```

> **Note:** TenantGuard xử lý **route-level** access. **Data-level** filtering (WHERE company_id = ?) thực hiện trong service layer, không phải guard.

### Auth Service

```typescript
// auth/auth.service.ts
async login(email: string, password: string, ip: string, userAgent: string) {
  const user = await this.usersRepo.findOne({ where: { email, status: 'active' } });

  if (!user) {
    await this.auditService.log(null, 'failed_login', ip, userAgent, { email });
    throw new UnauthorizedException('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await this.auditService.log(user.id, 'failed_login', ip, userAgent);
    throw new UnauthorizedException('Invalid credentials');
  }

  await this.auditService.log(user.id, 'login', ip, userAgent);

  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
  };

  const token = this.jwtService.sign(payload);
  return { token, user: this.toDto(user) };
}

private toDto(user: User): UserResponseDto {
  const { passwordHash, ...rest } = user as any;
  return rest; // NEVER return passwordHash
}
```

### Companies Service (tenant-aware)

```typescript
// companies/companies.service.ts
async findAll(requestingUser: JwtPayload) {
  if (requestingUser.role === 'vendor_admin') {
    return this.companiesRepo.find({ order: { createdAt: 'DESC' } });
  }
  // Operator chỉ thấy company của mình
  return this.companiesRepo.findBy({ id: requestingUser.companyId });
}

async findOne(id: string, requestingUser: JwtPayload) {
  if (requestingUser.role !== 'vendor_admin' && requestingUser.companyId !== id) {
    throw new ForbiddenException();
  }
  return this.companiesRepo.findOneOrFail({ where: { id } });
}
```

### Login Controller

```typescript
// auth/auth.controller.ts
@Post('login')
async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const userAgent = req.headers['user-agent'] ?? '';

  const { token, user } = await this.authService.login(dto.email, dto.password, ip, userAgent);

  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24h in ms
    path: '/',
  });

  return { user };
}

@Post('logout')
@UseGuards(JwtAuthGuard)
logout(@Res({ passthrough: true }) res: Response) {
  res.clearCookie('accessToken', { path: '/' });
  return {};
}
```

## DTOs (validation)

```typescript
// auth/dto/login.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

// companies/dto/create-company.dto.ts
import { IsString, IsNotEmpty, Matches, MaxLength, IsOptional, IsIn } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug chỉ chứa lowercase letters, numbers, hyphens' })
  @MaxLength(100)
  slug: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
```

## Todo List

- [ ] Tạo `auth/` module (controller, service, jwt.strategy.ts)
- [ ] Tạo `common/guards/jwt-auth.guard.ts`
- [ ] Tạo `common/guards/tenant.guard.ts`
- [ ] Tạo `common/decorators/current-user.decorator.ts`
- [ ] Tạo `auth/dto/login.dto.ts` và `user-response.dto.ts`
- [ ] Tạo `companies/` module với CRUD
- [ ] Tạo `users/` module với CRUD
- [ ] Tạo `audit/` module và service
- [ ] Register JwtModule với secret từ ConfigService
- [ ] Test: POST `/api/auth/login` với admin credentials → nhận JWT cookie
- [ ] Test: GET `/api/auth/me` với valid cookie → trả user info
- [ ] Test: operator gọi `/api/companies` → chỉ thấy company của mình
- [ ] Test: operator gọi `/api/companies/<other-id>` → 403
- [ ] Test: vendor_admin gọi `/api/companies` → thấy tất cả

## Success Criteria

- Login với đúng credentials → JWT cookie được set
- Login với sai credentials → 401, audit log ghi `failed_login`
- Operator GET /api/companies → chỉ 1 company (của mình)
- Vendor_admin GET /api/companies → tất cả companies
- Operator GET /api/companies/<other-company-id> → 403
- Logout → cookie bị clear, subsequent requests → 401

## Security Considerations

- `passwordHash` **không bao giờ** xuất hiện trong response DTO
- Audit log ghi cả failed login attempts (để detect brute force)
- Same error message cho "user not found" và "wrong password" (prevent user enumeration)
- Rate limiting trên `/api/auth/login` — configure tại Nginx level (Phase 04)
- `secure: true` cho cookie **chỉ** khi HTTPS (production)
