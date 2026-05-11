# Phase 01 — Monorepo Restructure

**Status:** ⏳ Pending  
**Priority:** 🔴 Critical  
**Effort:** ~4 hours  
**Depends on:** Nothing

## Overview

Chuyển codebase hiện tại (Next.js ở root) thành monorepo với npm workspaces. Tạo skeleton cho 3 workspace mới. Cập nhật tất cả paths và configs.

## Target Structure

```
/ (root)
├── package.json              ← workspace root với npm workspaces
├── docker-compose.yml        ← (Phase 02)
├── Makefile                  ← make migrate, make dev, make build
├── .github/                  ← (Phase 03)
├── .gitignore
├── README.md                 ← root README
│
├── frontend/                 ← MOVE từ root
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── types/
│   ├── package.json
│   ├── next.config.js        ← đổi từ static export → server mode
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── README.md
│
├── gateway-nest/             ← NestJS skeleton (mới)
│   ├── src/
│   │   └── main.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   └── README.md
│
├── ai-workers/               ← Python skeleton (mới)
│   ├── src/
│   │   └── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
│
└── infra/                    ← Nginx + certs config (mới)
    ├── nginx/
    │   └── nginx.conf
    ├── certbot/
    └── README.md
```

## Related Code Files

**Files to move (root → frontend/):**
- `app/` → `frontend/app/`
- `components/` → `frontend/components/`
- `lib/` → `frontend/lib/`
- `public/` → `frontend/public/`
- `types/` → `frontend/types/`
- `package.json` → `frontend/package.json` (adjust scripts)
- `next.config.js` → `frontend/next.config.js`
- `tailwind.config.js` → `frontend/tailwind.config.js`
- `tsconfig.json` → `frontend/tsconfig.json`
- `postcss.config.js` → `frontend/postcss.config.js`

**Files to modify:**
- Root `next.config.js` → delete (không còn tồn tại ở root)
- `firebase.json` → có thể giữ ở root hoặc delete nếu không deploy Firebase nữa

**Files to create:**
- `/package.json` (workspace root)
- `/Makefile`
- `/README.md`
- `/frontend/README.md`
- `/gateway-nest/package.json`
- `/gateway-nest/src/main.ts`
- `/gateway-nest/tsconfig.json`
- `/gateway-nest/nest-cli.json`
- `/gateway-nest/README.md`
- `/ai-workers/src/main.py`
- `/ai-workers/requirements.txt`
- `/ai-workers/Dockerfile`
- `/ai-workers/README.md`
- `/infra/nginx/nginx.conf`
- `/infra/README.md`

## Implementation Steps

### Step 1: Tạo thư mục và move frontend

```bash
# Từ project root
mkdir -p frontend gateway-nest/src ai-workers/src infra/nginx infra/certbot

# Move FE files
mv app frontend/
mv components frontend/
mv lib frontend/
mv public frontend/
mv types frontend/
mv package.json frontend/
mv next.config.js frontend/
mv tailwind.config.js frontend/
mv tsconfig.json frontend/
mv postcss.config.js frontend/
```

### Step 2: Root package.json với npm workspaces

```json
{
  "name": "intelli-park",
  "private": true,
  "workspaces": [
    "frontend",
    "gateway-nest",
    "ai-workers"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace=frontend\" \"npm run dev --workspace=gateway-nest\"",
    "build": "npm run build --workspace=frontend && npm run build --workspace=gateway-nest",
    "migrate": "npm run migrate --workspace=gateway-nest"
  },
  "devDependencies": {
    "concurrently": "^8.0.0"
  }
}
```

### Step 3: Cập nhật frontend/next.config.js

**TRƯỚC (static export):**
```js
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  trailingSlash: true,
  images: { unoptimized: true }
}
```

**SAU (server mode):**
```js
const nextConfig = {
  // remove output: 'export'
  // remove distDir: 'dist'
  trailingSlash: true,
}
module.exports = nextConfig
```

> **Lý do:** FE cần server mode để:
> (1) Dùng httpOnly cookies cho JWT auth
> (2) Chạy trong Docker container cùng với BE
> (3) Server-side rendering cho SEO và performance

### Step 4: frontend/tsconfig.json — cập nhật paths

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```
*(Paths đã đúng — `@/` map tới root của `frontend/`, không cần thay đổi)*

### Step 5: gateway-nest/ skeleton

**gateway-nest/package.json:**
```json
{
  "name": "gateway-nest",
  "version": "0.0.1",
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main",
    "test": "jest",
    "migrate": "typeorm migration:run -d src/database/data-source.ts"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/typeorm": "^10.0.0",
    "typeorm": "^0.3.0",
    "mssql": "^10.0.0",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "typescript": "^5.0.0",
    "jest": "^29.0.0"
  }
}
```

**gateway-nest/src/main.ts:**
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 4000);
  console.log(`Gateway running on port ${process.env.PORT ?? 4000}`);
}
bootstrap();
```

**gateway-nest/nest-cli.json:**
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

### Step 6: ai-workers/ skeleton

**ai-workers/requirements.txt:**
```
fastapi==0.111.0
uvicorn[standard]==0.30.0
httpx==0.27.0
python-dotenv==1.0.1
psycopg2-binary==2.9.9
alembic==1.13.1
sqlalchemy==2.0.30
```

**ai-workers/src/main.py:**
```python
from fastapi import FastAPI

app = FastAPI(title="Intelli-Park AI Worker", version="0.1.0")

@app.get("/health")
def health():
    return {"status": "ok"}
```

**ai-workers/Dockerfile:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 7: Root Makefile

```makefile
.PHONY: dev build migrate test

dev:
	docker-compose up --build

build:
	npm run build

migrate:
	npm run migrate --workspace=gateway-nest
	cd ai-workers && alembic upgrade head

test:
	npm run test --workspace=gateway-nest
	npm run test --workspace=frontend
```

### Step 8: README.md files

**Root README.md** — giải thích project overview, cách chạy local, links tới workspace READMEs

**frontend/README.md:**
```markdown
# Frontend (Next.js)

## Local dev
cd frontend
npm install
npm run dev        # http://localhost:3000

## Env vars
NEXT_PUBLIC_API_URL=http://localhost:4000
```

**gateway-nest/README.md:**
```markdown
# Gateway (NestJS)

## Local dev
cd gateway-nest
npm install
npm run dev        # http://localhost:4000

## Env vars
DATABASE_URL=mssql://sa:password@localhost:1433/intellipark
JWT_SECRET=change-me
CAMERA_ENCRYPTION_KEY=32-char-hex-key
```

**ai-workers/README.md:**
```markdown
# AI Workers (Python)

## Local dev
cd ai-workers
pip install -r requirements.txt
uvicorn src.main:app --reload   # http://localhost:8000
```

## Todo List

- [ ] Tạo thư mục frontend/, gateway-nest/, ai-workers/, infra/
- [ ] Move tất cả FE files vào frontend/
- [ ] Cập nhật frontend/next.config.js (bỏ static export)
- [ ] Tạo root package.json với workspaces
- [ ] Tạo gateway-nest/ skeleton (package.json, main.ts, nest-cli.json)
- [ ] Tạo ai-workers/ skeleton (main.py, requirements.txt, Dockerfile)
- [ ] Tạo infra/ directory với nginx.conf placeholder
- [ ] Tạo Makefile ở root
- [ ] Tạo README.md cho mỗi workspace
- [ ] Xác nhận `npm install` từ root hoạt động

## Success Criteria

- `npm install` từ root cài đúng dependencies cho tất cả workspaces
- `cd frontend && npm run dev` khởi động FE trên port 3000
- `cd gateway-nest && npm run dev` khởi động NestJS trên port 4000
- Không có broken imports trong FE sau khi move
- Mỗi workspace có README.md giải thích cách chạy local

## Security Considerations

- `.env` files **không** commit vào git — thêm vào `.gitignore`
- `CAMERA_ENCRYPTION_KEY` phải là 32-byte random hex
- `JWT_SECRET` phải đủ mạnh (minimum 32 chars)
