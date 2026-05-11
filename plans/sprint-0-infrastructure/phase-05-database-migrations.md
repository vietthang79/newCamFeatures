# Phase 05 — Database Migrations Setup

**Status:** ⏳ Pending  
**Priority:** 🔴 Critical  
**Effort:** ~2 hours  
**Depends on:** Phase 01 (monorepo), Phase 02 (Docker services running)

## Overview

Thiết lập migration tooling cho cả 2 databases:
- **TypeORM** cho MSSQL (main app data)
- **Alembic** cho PostgreSQL + TimescaleDB (analytics data)

`make migrate` phải chạy được cả 2 migrations cùng lúc.

## Files to Create

**gateway-nest/ (TypeORM):**
- `gateway-nest/src/database/data-source.ts` — TypeORM DataSource config
- `gateway-nest/src/database/migrations/` — migration files (rỗng khi setup, điền sau trong EP-1/EP-2)

**ai-workers/ (Alembic):**
- `ai-workers/alembic.ini`
- `ai-workers/alembic/env.py`
- `ai-workers/alembic/versions/` — migration files (rỗng khi setup)

**Root:**
- `Makefile` — cập nhật với migrate target

## Implementation

### TypeORM Setup (MSSQL)

**gateway-nest/src/database/data-source.ts:**
```typescript
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'mssql',
  host: process.env.MSSQL_HOST ?? 'localhost',
  port: parseInt(process.env.MSSQL_PORT ?? '1433'),
  username: process.env.MSSQL_USER ?? 'sa',
  password: process.env.MSSQL_PASSWORD,
  database: process.env.MSSQL_DATABASE ?? 'intellipark',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,  // KHÔNG dùng synchronize=true ở production
  options: {
    encrypt: process.env.NODE_ENV === 'production',
    trustServerCertificate: process.env.NODE_ENV !== 'production',
  },
  logging: process.env.NODE_ENV !== 'production',
});
```

**gateway-nest/package.json scripts — thêm:**
```json
{
  "scripts": {
    "migration:generate": "typeorm-ts-node-commonjs migration:generate -d src/database/data-source.ts",
    "migration:run": "typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts",
    "migration:revert": "typeorm-ts-node-commonjs migration:revert -d src/database/data-source.ts",
    "migrate": "npm run migration:run"
  }
}
```

**Cách tạo migration mới:**
```bash
# Từ gateway-nest/
npm run migration:generate src/database/migrations/CreateCompaniesTable
# TypeORM tự generate SQL từ entity definitions
```

### Alembic Setup (PostgreSQL + TimescaleDB)

**ai-workers/alembic.ini:**
```ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql://%(POSTGRES_USER)s:%(POSTGRES_PASSWORD)s@%(POSTGRES_HOST)s:%(POSTGRES_PORT)s/%(POSTGRES_DATABASE)s

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

**ai-workers/alembic/env.py:**
```python
import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

config = context.config

# Override URL từ environment variables
def get_url():
    user = os.environ.get("POSTGRES_USER", "intellipark")
    password = os.environ.get("POSTGRES_PASSWORD", "")
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = os.environ.get("POSTGRES_PORT", "5432")
    db = os.environ.get("POSTGRES_DATABASE", "intellipark_analytics")
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"

config.set_main_option("sqlalchemy.url", get_url())

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = None

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**Cách tạo migration mới:**
```bash
# Từ ai-workers/
alembic revision --autogenerate -m "create frame ingestion log table"
alembic upgrade head
```

### Root Makefile (hoàn chỉnh)

```makefile
.PHONY: dev build migrate migrate-mssql migrate-postgres test lint help

help:
	@echo "Available commands:"
	@echo "  make dev          - Start all services with hot reload"
	@echo "  make build        - Build all services for production"
	@echo "  make migrate      - Run all database migrations"
	@echo "  make test         - Run all tests"
	@echo "  make lint         - Run linters"

dev:
	docker-compose -f docker-compose.yml -f docker-compose.override.yml up

build:
	docker-compose build

migrate: migrate-mssql migrate-postgres

migrate-mssql:
	@echo "Running MSSQL migrations (TypeORM)..."
	cd gateway-nest && npm run migrate

migrate-postgres:
	@echo "Running PostgreSQL migrations (Alembic)..."
	cd ai-workers && alembic upgrade head

migrate-rollback-mssql:
	cd gateway-nest && npm run migration:revert

test:
	npm run test --workspace=gateway-nest
	npm run test --workspace=frontend

lint:
	npm run lint --workspace=frontend
	npm run lint --workspace=gateway-nest
	cd ai-workers && python -m flake8 src/
```

## Workflow: Khi developer cần thêm DB table mới

### MSSQL (EP-1 và EP-2 sẽ dùng):

```bash
# 1. Tạo entity file trong gateway-nest
# 2. Generate migration
cd gateway-nest
npm run migration:generate src/database/migrations/AddCamerasTable

# 3. Review file migration được generate
# 4. Run migration
make migrate-mssql
```

### PostgreSQL (EP-2 frame ingestion sẽ dùng):

```bash
# 1. Tạo model file trong ai-workers/src/models/
# 2. Generate migration
cd ai-workers
alembic revision --autogenerate -m "add frame ingestion log"

# 3. Review file migration được generate
# 4. Run migration
make migrate-postgres
```

## Todo List

- [ ] Cài thêm TypeORM dependencies vào gateway-nest/package.json
- [ ] Tạo `gateway-nest/src/database/data-source.ts`
- [ ] Thêm migration scripts vào `gateway-nest/package.json`
- [ ] Init Alembic trong `ai-workers/`: `alembic init alembic`
- [ ] Tạo `ai-workers/alembic/env.py` với env var support
- [ ] Cập nhật root `Makefile` với đầy đủ targets
- [ ] Test: `make migrate` với cả 2 databases running (via Docker)
- [ ] Test: `make migrate-rollback-mssql` (revert hoạt động)
- [ ] Document migration workflow trong workspace READMEs

## Success Criteria

- `make migrate` chạy thành công khi cả MSSQL và PostgreSQL đang chạy
- `make migrate` idempotent — chạy 2 lần không lỗi
- Developer tạo migration mới trong < 5 phút từ entity → migration file
- Migration revert hoạt động (`make migrate-rollback-mssql`)
- CI pipeline chạy migrations trong test environment

## Notes

- TypeORM `synchronize: false` bắt buộc ở production — chỉ dùng migrations
- TimescaleDB extension cần enable trước khi tạo hypertables: `CREATE EXTENSION IF NOT EXISTS timescaledb;` — đưa vào migration đầu tiên của PostgreSQL
