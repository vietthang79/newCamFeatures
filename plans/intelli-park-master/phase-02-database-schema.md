# Phase 02 — Database Schema & Seed

## Context Links
- [Master Plan Overview](./plan.md)
- [Phase 01 — NestJS Bootstrap](./phase-01-nestjs-bootstrap.md)

## Overview
- **Status:** pending
- **Effort:** 3h
- **Blocked by:** Phase 01
- Define TypeORM entities for `companies` and `users` tables; auto-create schema on first boot; seed default vendor_admin

## Key Insights
- TypeORM `synchronize: true` in dev — entities define schema, no migration files needed for Sprint 1
- `companyId` is nullable on `User` — vendor_admin users have no company assignment
- Slug auto-generated in entity `@BeforeInsert()` hook
- Seed runs once on bootstrap via `OnApplicationBootstrap` lifecycle hook
- Idempotent seed: skips if users already exist (count > 0)
- bcrypt cost=10 (~100ms, acceptable for POC)

## Requirements

**Functional**
- MSSQL tables auto-created on first boot: `companies`, `users`
- Company entity with UUID PK, name, slug (auto-generated, unique), status (active/inactive), created_at
- User entity with UUID PK, email (unique), name, password_hash (bcrypt), role (vendor_admin/operator), company_id (FK, nullable), created_at
- Seed creates 1 vendor_admin if no users exist: `admin@intellipark.io` / `Admin@123` (hashed)
- Slug generation: name → lowercase → kebab-case → check uniqueness (append -2, -3 if collision)

**Non-functional**
- Entities < 50 lines each
- UUIDs for all primary keys
- Relation defined: Company → Users (one-to-many)

## Schema

```sql
-- MSSQL
CREATE TABLE companies (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  name NVARCHAR(255) NOT NULL,
  slug NVARCHAR(255) NOT NULL UNIQUE,
  status NVARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active' | 'inactive'
  created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

CREATE TABLE users (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  email NVARCHAR(255) NOT NULL UNIQUE,
  name NVARCHAR(255) NOT NULL,
  password_hash NVARCHAR(255) NOT NULL,
  role NVARCHAR(50) NOT NULL,  -- 'vendor_admin' | 'operator'
  company_id UNIQUEIDENTIFIER FOREIGN KEY REFERENCES companies(id) NULLABLE,
  created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);
```

## Related Code Files

**Create**
- `apps/api/src/modules/companies/company.entity.ts`
- `apps/api/src/modules/users/user.entity.ts`
- `apps/api/src/database/seed.service.ts`

**Modify**
- `apps/api/src/app.module.ts` — register entities + import SeedService

## Implementation Steps

1. **Create `modules/companies/company.entity.ts`:**
   ```typescript
   import { Entity, PrimaryGeneratedColumn, Column, OneToMany, BeforeInsert } from 'typeorm';
   import { User } from '../users/user.entity';
   
   @Entity('companies')
   export class Company {
     @PrimaryGeneratedColumn('uuid')
     id: string;
   
     @Column()
     name: string;
   
     @Column({ unique: true })
     slug: string;
   
     @Column({ default: 'active' })
     status: string;  // 'active' | 'inactive'
   
     @CreateDateColumn({ name: 'created_at' })
     createdAt: Date;
   
     @OneToMany(() => User, (user) => user.company)
     users: User[];
   
     @BeforeInsert()
     generateSlug() {
       this.slug = this.name
         .toLowerCase()
         .replace(/\s+/g, '-')
         .replace(/[^a-z0-9-]/g, '');
     }
   }
   ```

2. **Create `modules/users/user.entity.ts`:**
   ```typescript
   import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
   import { Company } from '../companies/company.entity';
   
   @Entity('users')
   export class User {
     @PrimaryGeneratedColumn('uuid')
     id: string;
   
     @Column({ unique: true })
     email: string;
   
     @Column()
     name: string;
   
     @Column({ name: 'password_hash' })
     passwordHash: string;
   
     @Column()
     role: string;  // 'vendor_admin' | 'operator'
   
     @Column({ name: 'company_id', nullable: true })
     companyId: string | null;
   
     @ManyToOne(() => Company, (company) => company.users, { nullable: true })
     @JoinColumn({ name: 'company_id' })
     company: Company | null;
   
     @CreateDateColumn({ name: 'created_at' })
     createdAt: Date;
   }
   ```

3. **Register entities in `app.module.ts`:**
   ```typescript
   import { TypeOrmModule } from '@nestjs/typeorm';
   import { Company } from './modules/companies/company.entity';
   import { User } from './modules/users/user.entity';
   
   // In the TypeOrmModule config:
   TypeOrmModule.forRoot({
     // ... other config
     entities: [Company, User],
   })
   ```

4. **Create `database/seed.service.ts`:**
   ```typescript
   import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
   import { InjectRepository } from '@nestjs/typeorm';
   import { Repository } from 'typeorm';
   import * as bcrypt from 'bcrypt';
   import { User } from '../modules/users/user.entity';
   
   @Injectable()
   export class SeedService implements OnApplicationBootstrap {
     constructor(
       @InjectRepository(User)
       private userRepo: Repository<User>,
     ) {}
   
     async onApplicationBootstrap() {
       const count = await this.userRepo.count();
       if (count > 0) {
         console.log('Users already exist, skipping seed');
         return;
       }
       
       const hash = await bcrypt.hash('Admin@123', 10);
       await this.userRepo.save({
         email: 'admin@intellipark.io',
         name: 'Intelli-Park Admin',
         passwordHash: hash,
         role: 'vendor_admin',
         companyId: null,
       });
       
       console.log('Seed completed: vendor_admin created');
     }
   }
   ```

5. **Register SeedService in `app.module.ts`:**
   ```typescript
   import { Module } from '@nestjs/common';
   import { TypeOrmModule } from '@nestjs/typeorm';
   import { SeedService } from './database/seed.service';
   
   @Module({
     imports: [
       TypeOrmModule.forFeature([User]),  // for SeedService injection
     ],
     providers: [SeedService],
   })
   export class AppModule {}
   ```

6. **Implement slug uniqueness check** (will be in `CompaniesService` in Phase 03):
   ```typescript
   private async uniqueSlug(base: string): Promise<string> {
     let slug = base;
     let i = 2;
     while (await this.companyRepo.findOneBy({ slug })) {
       slug = `${base}-${i++}`;
     }
     return slug;
   }
   ```

7. **Verify schema creation** on first boot:
   - Run `npm run start:dev` in `apps/api/`
   - Check MSSQL for `companies` and `users` tables
   - Verify seed: query `SELECT * FROM users` → should have 1 row (admin@intellipark.io)

## Todo List

- [ ] Create `company.entity.ts` with @BeforeInsert slug generation
- [ ] Create `user.entity.ts` with nullable companyId FK + Company relation
- [ ] Register entities in TypeORM config (app.module.ts or datasource)
- [ ] Create `seed.service.ts` with OnApplicationBootstrap
- [ ] Register SeedService in AppModule
- [ ] Verify: `npm run start:dev` creates tables without error
- [ ] Verify: seed creates admin user on first boot
- [ ] Verify: idempotent seed (second boot does NOT re-seed)
- [ ] Test slug uniqueness: create two companies named "Test" → `test`, `test-2`

## Success Criteria

- ✅ Tables exist in MSSQL after first `npm run start:dev`
- ✅ `companies` table has `id, name, slug, status, created_at` columns
- ✅ `users` table has `id, email, name, password_hash, role, company_id, created_at` columns
- ✅ One row in `users`: `admin@intellipark.io`, `vendor_admin`, `company_id = NULL`
- ✅ Password is bcrypt-hashed (not plaintext)
- ✅ Second boot: seed skipped (count check works, no duplicate admin)
- ✅ Slug generation: typing name in frontend generates kebab-case; duplicate names → append -2, -3
- ✅ TypeScript compiles without errors

## Risk Assessment

- **Slug collision at scale:** Append counter (-2, -3, etc.) is fine for POC; if many collisions occur, consider UUID suffix
- **bcrypt slow on first boot:** 100ms acceptable; can optimize with faster hashing (bcrypt-nodejs) if needed
- **TypeORM synchronize=true in prod:** Dangerous if schema changes; switch to migrations in Sprint 2
- **Seed idempotency:** If user count is 0 but seed fails mid-way, manual cleanup needed

## Security Considerations

- Seed password `Admin@123` — **MUST document that this must be changed before any deployment**
- Never log passwords or hashes
- bcrypt cost=10 is secure enough for POC (timing attacks mitigated by always hashing on login)
- FK constraint: nullable company_id allows vendor_admin to exist without company

## Next Steps

→ **Phase 03:** Implement auth, companies, and users API endpoints on top of these entities
