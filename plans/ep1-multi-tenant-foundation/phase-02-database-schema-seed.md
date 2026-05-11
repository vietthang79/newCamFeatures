# Phase 02 — Database Schema & Seed

**Status:** ⏳ Pending  
**Priority:** 🔴 Critical  
**Effort:** ~2 hours  
**Depends on:** Phase 01 (NestJS bootstrap, TypeORM connected)

## Overview

Tạo MSSQL tables, TypeORM entities, và migration files. Seed default admin account.

## Database Schema (MSSQL)

```sql
-- companies
CREATE TABLE companies (
  id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  name        NVARCHAR(255) NOT NULL,
  slug        NVARCHAR(100) NOT NULL UNIQUE,
  status      NVARCHAR(20) NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'inactive')),
  created_at  DATETIME2 NOT NULL DEFAULT GETDATE(),
  updated_at  DATETIME2 NOT NULL DEFAULT GETDATE()
);

-- users
CREATE TABLE users (
  id             UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  email          NVARCHAR(255) NOT NULL UNIQUE,
  password_hash  NVARCHAR(255) NOT NULL,
  full_name      NVARCHAR(255),
  role           NVARCHAR(20) NOT NULL DEFAULT 'operator'
                 CHECK (role IN ('vendor_admin', 'operator')),
  status         NVARCHAR(20) NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'inactive')),
  company_id     UNIQUEIDENTIFIER REFERENCES companies(id) ON DELETE SET NULL,
  created_at     DATETIME2 NOT NULL DEFAULT GETDATE(),
  updated_at     DATETIME2 NOT NULL DEFAULT GETDATE()
);

-- audit_logs
CREATE TABLE audit_logs (
  id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  user_id     UNIQUEIDENTIFIER REFERENCES users(id),
  action      NVARCHAR(100) NOT NULL,  -- 'login', 'logout', 'failed_login'
  ip_address  NVARCHAR(45),
  user_agent  NVARCHAR(500),
  metadata    NVARCHAR(MAX),           -- JSON string cho extra context
  created_at  DATETIME2 NOT NULL DEFAULT GETDATE()
);
CREATE INDEX IX_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IX_audit_logs_created_at ON audit_logs(created_at);
```

## TypeORM Entities

**gateway-nest/src/companies/company.entity.ts:**
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
         UpdateDateColumn, OneToMany } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100, unique: true })
  slug: string;

  @Column({ default: 'active', length: 20 })
  status: 'active' | 'inactive';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => User, user => user.company)
  users: User[];
}
```

**gateway-nest/src/users/user.entity.ts:**
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
         UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Company } from '../companies/company.entity';

export type UserRole = 'vendor_admin' | 'operator';
export type UserStatus = 'active' | 'inactive';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ name: 'full_name', length: 255, nullable: true })
  fullName: string | null;

  @Column({ default: 'operator', length: 20 })
  role: UserRole;

  @Column({ default: 'active', length: 20 })
  status: UserStatus;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string | null;

  @ManyToOne(() => Company, company => company.users, { nullable: true })
  @JoinColumn({ name: 'company_id' })
  company: Company | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**gateway-nest/src/audit/audit-log.entity.ts:**
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
         ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ length: 100 })
  action: string;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  metadata: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
```

## TypeORM Migration Files

**gateway-nest/src/database/migrations/1700000001-CreateCompanies.ts:**
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompanies1700000001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE companies (
        id         UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        name       NVARCHAR(255) NOT NULL,
        slug       NVARCHAR(100) NOT NULL,
        status     NVARCHAR(20) NOT NULL DEFAULT 'active',
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_companies_slug UNIQUE (slug),
        CONSTRAINT CK_companies_status CHECK (status IN ('active', 'inactive'))
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE companies`);
  }
}
```

**gateway-nest/src/database/migrations/1700000002-CreateUsers.ts:**
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1700000002 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id             UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        email          NVARCHAR(255) NOT NULL,
        password_hash  NVARCHAR(255) NOT NULL,
        full_name      NVARCHAR(255),
        role           NVARCHAR(20) NOT NULL DEFAULT 'operator',
        status         NVARCHAR(20) NOT NULL DEFAULT 'active',
        company_id     UNIQUEIDENTIFIER,
        created_at     DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at     DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_users_email UNIQUE (email),
        CONSTRAINT CK_users_role CHECK (role IN ('vendor_admin', 'operator')),
        CONSTRAINT CK_users_status CHECK (status IN ('active', 'inactive')),
        CONSTRAINT FK_users_company FOREIGN KEY (company_id)
          REFERENCES companies(id) ON DELETE SET NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE users`);
  }
}
```

**gateway-nest/src/database/migrations/1700000003-CreateAuditLogs.ts:**
*(similar pattern — CREATE TABLE audit_logs với indexes)*

**gateway-nest/src/database/migrations/1700000004-SeedAdminUser.ts:**
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcryptjs';

export class SeedAdminUser1700000004 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const passwordHash = await bcrypt.hash('Admin@Intelli2024!', 12);

    await queryRunner.query(`
      INSERT INTO users (id, email, password_hash, full_name, role, status, company_id)
      VALUES (
        NEWID(),
        'admin@intellipark.io',
        '${passwordHash}',
        'System Admin',
        'vendor_admin',
        'active',
        NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM users WHERE email = 'admin@intellipark.io'
    `);
  }
}
```

> **Note:** Seed password `Admin@Intelli2024!` chỉ là default. Vendor admin phải đổi password sau lần đăng nhập đầu tiên (scope sprint sau).

## Todo List

- [ ] Tạo `src/companies/company.entity.ts`
- [ ] Tạo `src/users/user.entity.ts`
- [ ] Tạo `src/audit/audit-log.entity.ts`
- [ ] Tạo migration `1700000001-CreateCompanies.ts`
- [ ] Tạo migration `1700000002-CreateUsers.ts`
- [ ] Tạo migration `1700000003-CreateAuditLogs.ts`
- [ ] Tạo migration `1700000004-SeedAdminUser.ts`
- [ ] Chạy `make migrate` — xác nhận tables tạo thành công
- [ ] Verify seed: đăng nhập bằng `admin@intellipark.io`

## Success Criteria

- `make migrate` chạy 4 migrations không lỗi
- Tables `companies`, `users`, `audit_logs` tồn tại trong MSSQL
- Default admin account `admin@intellipark.io` có trong DB với bcrypt password hash
- `make migrate` lần 2 → không lỗi (idempotent)
- Rollback: `make migrate-rollback-mssql` hoạt động theo thứ tự ngược

## Security Considerations

- Password hash dùng **bcrypt rounds=12** (không dùng MD5 hay SHA)
- Seed password `Admin@Intelli2024!` phải được đổi ngay sau deploy staging
- `password_hash` field không bao giờ được expose trong API response (dùng DTO exclude)
