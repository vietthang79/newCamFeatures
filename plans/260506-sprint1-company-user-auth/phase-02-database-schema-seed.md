# Phase 02 — Database Schema & Seed

## Context Links
- [Plan overview](./plan.md)
- [Phase 01 — NestJS Bootstrap](./phase-01-nestjs-backend-bootstrap.md)

## Overview
- **Priority:** P0
- **Status:** pending
- **Effort:** 3h
- Define TypeORM entities for `companies` and `users` tables; seed default vendor_admin.

## Key Insights
- TypeORM `synchronize: true` in dev — entities define the schema, no separate migration file needed for Sprint 1
- `companyId` is nullable on `User` — vendor_admin has no company
- `slug` is auto-generated in entity `BeforeInsert` hook, not in the DB default
- Seed runs once on bootstrap via NestJS `OnApplicationBootstrap` lifecycle hook
- bcrypt cost factor: 10 (fast enough for POC, secure enough)

## Requirements

**Functional**
- MSSQL tables auto-created on first boot: `companies`, `users`
- Seed creates 1 vendor_admin if no users exist
- Slug generation: `name → lowercase → kebab → ensure unique (append -2, -3 if collision)`

**Non-functional**
- Entities < 50 lines each
- UUIDs for all primary keys (`NEWID()` MSSQL default)

## Schema

```sql
-- companies
id           UNIQUEIDENTIFIER  PK, default NEWID()
name         NVARCHAR(255)     NOT NULL
slug         NVARCHAR(255)     NOT NULL UNIQUE
status       NVARCHAR(20)      NOT NULL default 'active'  -- 'active' | 'inactive'
created_at   DATETIME2         NOT NULL default GETDATE()

-- users
id           UNIQUEIDENTIFIER  PK, default NEWID()
email        NVARCHAR(255)     NOT NULL UNIQUE
name         NVARCHAR(255)     NOT NULL
password_hash NVARCHAR(255)    NOT NULL
role         NVARCHAR(50)      NOT NULL  -- 'vendor_admin' | 'operator'
company_id   UNIQUEIDENTIFIER  FK → companies.id, NULLABLE (null for vendor_admin)
created_at   DATETIME2         NOT NULL default GETDATE()
```

## Related Code Files

**Create**
- `apps/api/src/modules/companies/company.entity.ts`
- `apps/api/src/modules/users/user.entity.ts`
- `apps/api/src/database/seed.service.ts`

**Modify**
- `apps/api/src/app.module.ts` — register SeedService

## Implementation Steps

1. Create `company.entity.ts`:
   ```ts
   @Entity('companies')
   export class Company {
     @PrimaryGeneratedColumn('uuid') id: string;
     @Column() name: string;
     @Column({ unique: true }) slug: string;
     @Column({ default: 'active' }) status: string;
     @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
     @OneToMany(() => User, (u) => u.company) users: User[];

     @BeforeInsert()
     generateSlug() {
       this.slug = this.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
     }
   }
   ```

2. Create `user.entity.ts`:
   ```ts
   @Entity('users')
   export class User {
     @PrimaryGeneratedColumn('uuid') id: string;
     @Column({ unique: true }) email: string;
     @Column() name: string;
     @Column({ name: 'password_hash' }) passwordHash: string;
     @Column() role: string;
     @Column({ name: 'company_id', nullable: true }) companyId: string | null;
     @ManyToOne(() => Company, (c) => c.users, { nullable: true })
     @JoinColumn({ name: 'company_id' }) company: Company;
     @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
   }
   ```

3. Register entities in TypeORM config (`app.module.ts` or `mssql.datasource.ts`): `entities: [Company, User]`

4. Create `SeedService` implementing `OnApplicationBootstrap`:
   ```ts
   async onApplicationBootstrap() {
     const count = await this.userRepo.count();
     if (count > 0) return;  // already seeded
     const hash = await bcrypt.hash('Admin@123', 10);
     await this.userRepo.save({
       email: 'admin@intellipark.io',
       name: 'Intelli-Park Admin',
       passwordHash: hash,
       role: 'vendor_admin',
       companyId: null,
     });
   }
   ```

5. Handle slug uniqueness in `CompaniesService.create()` (not in entity):
   ```ts
   private async uniqueSlug(base: string): Promise<string> {
     let slug = base;
     let i = 2;
     while (await this.companyRepo.findOneBy({ slug })) {
       slug = `${base}-${i++}`;
     }
     return slug;
   }
   ```

## Todo List
- [ ] `company.entity.ts` with BeforeInsert slug hook
- [ ] `user.entity.ts` with nullable companyId FK
- [ ] Register entities in TypeORM config
- [ ] `seed.service.ts` with OnApplicationBootstrap
- [ ] Register SeedService in AppModule
- [ ] Verify: tables created on boot, vendor_admin seeded
- [ ] Verify: second boot does NOT re-seed (idempotent)

## Success Criteria
- `companies` and `users` tables exist in MSSQL after first boot
- One row in `users` with role=vendor_admin, email=admin@intellipark.io
- Second boot: seed skipped (count > 0 check works)
- Slug uniqueness: creating two companies named "Test Corp" → slugs: `test-corp`, `test-corp-2`

## Risk Assessment
- **Slug collision at scale:** Append counter is fine for 1-3 POC companies
- **bcrypt slow on first boot:** cost=10 ≈ 100ms — acceptable

## Security Considerations
- Default seed password: `Admin@123` — document in README that this MUST be changed before any real deployment
- Never log password or hash

## Next Steps
- Phase 03: Build API endpoints on top of these entities
