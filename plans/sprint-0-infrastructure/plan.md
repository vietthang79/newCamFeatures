# Sprint 0 — Infrastructure

**Status:** ⏳ Pending  
**Priority:** 🔴 Critical — must complete before EP-1 and EP-2  
**Depends on:** Nothing (foundation work)

## Overview

Foundation sprint. Thiết lập monorepo, Docker Compose, CI/CD, HTTPS, và database migration tooling để team có thể ship code ngay từ ngày đầu mà không cần setup friction.

Sprint này **không** implement business logic — chỉ infrastructure và scaffolding.

## User Story

> As a developer, I want the codebase, CI/CD, and infrastructure ready on day one so that the team can ship code from day one without setup friction.

## Acceptance Criteria Mapping

| Criterion | Phase |
|-----------|-------|
| Monorepo với workspaces: `gateway-nest/`, `ai-workers/`, `frontend/`, `infra/` | [Phase 01](./phase-01-monorepo-restructure.md) |
| `docker-compose.yml` khởi động: NestJS, Python worker, MSSQL, PostgreSQL+TimescaleDB, Redis, Next.js | [Phase 02](./phase-02-docker-compose.md) |
| GitHub Actions: push→test→build→push registry; merge main→deploy staging | [Phase 03](./phase-03-cicd-github-actions.md) |
| HTTPS via Let's Encrypt cho `app.intelli-park.com` và `api.intelli-park.com` | [Phase 04](./phase-04-https-letsencrypt.md) |
| `make migrate` chạy TypeORM (MSSQL) và Alembic (PostgreSQL) | [Phase 05](./phase-05-database-migrations.md) |
| `README.md` mỗi workspace giải thích cách chạy local | [Phase 01](./phase-01-monorepo-restructure.md) |
| Branch protection on main (1 reviewer required) | [Phase 03](./phase-03-cicd-github-actions.md) |

## Phases

| # | File | Description | Status |
|---|------|-------------|--------|
| 01 | [phase-01-monorepo-restructure.md](./phase-01-monorepo-restructure.md) | Move FE → `frontend/`, tạo workspace skeletons | ⏳ Pending |
| 02 | [phase-02-docker-compose.md](./phase-02-docker-compose.md) | Docker Compose với 6 services | ⏳ Pending |
| 03 | [phase-03-cicd-github-actions.md](./phase-03-cicd-github-actions.md) | GitHub Actions + branch protection | ⏳ Pending |
| 04 | [phase-04-https-letsencrypt.md](./phase-04-https-letsencrypt.md) | Nginx + Let's Encrypt SSL | ⏳ Pending |
| 05 | [phase-05-database-migrations.md](./phase-05-database-migrations.md) | TypeORM + Alembic + Makefile | ⏳ Pending |

## Technical Notes

- Sprint 1 deliberately uses Docker Compose, not Kubernetes
- Single GPU instance for AI workers (T4 or A10g)
- `ai-workers/` chỉ là skeleton trong sprint này — business logic là scope sprint sau
- Cloud cost monitoring alert tại $400/month phải setup cùng với infra

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| MSSQL licensing/setup phức tạp | High | Dùng `mcr.microsoft.com/mssql/server:2022-latest` Docker image |
| TimescaleDB compatibility | Medium | Dùng `timescale/timescaledb:latest-pg15` Docker image |
| SSL cert renewal automation | Medium | Certbot cron job trong infra/ |
| CI/CD secrets management | High | GitHub Secrets, không hardcode |
