# Phase 03 — CI/CD GitHub Actions

**Status:** ⏳ Pending  
**Priority:** 🔴 Critical  
**Effort:** ~3 hours  
**Depends on:** Phase 01, Phase 02

## Overview

Thiết lập GitHub Actions pipelines và branch protection để automate test, build, và deploy.

## Acceptance Criteria

- On push → run tests → build images → push to registry
- On merge to main → auto-deploy staging
- Branch protection on main (1 reviewer required)

## Files to Create

- `.github/workflows/ci.yml` — test + build + push trên mọi push
- `.github/workflows/deploy-staging.yml` — auto-deploy khi merge vào main
- `.github/workflows/cost-alert.yml` — cloud cost check hàng ngày

## GitHub Secrets Required

| Secret | Value |
|--------|-------|
| `REGISTRY_URL` | Container registry URL (e.g., `ghcr.io/your-org`) |
| `REGISTRY_USERNAME` | Registry username |
| `REGISTRY_PASSWORD` | Registry token/password |
| `STAGING_SSH_KEY` | SSH private key tới staging server |
| `STAGING_HOST` | Staging server IP/hostname |
| `STAGING_USER` | SSH user trên staging server |
| `MSSQL_PASSWORD` | Dùng trong test DB |
| `POSTGRES_PASSWORD` | Dùng trong test DB |
| `JWT_SECRET` | Dùng trong integration tests |

## Implementation

### .github/workflows/ci.yml

```yaml
name: CI — Test, Build, Push

on:
  push:
    branches: ['*']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io/${{ github.repository_owner }}

jobs:
  test-frontend:
    name: Test Frontend
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run build

  test-gateway:
    name: Test Gateway (NestJS)
    runs-on: ubuntu-latest
    services:
      mssql:
        image: mcr.microsoft.com/mssql/server:2022-latest
        env:
          ACCEPT_EULA: Y
          SA_PASSWORD: ${{ secrets.MSSQL_PASSWORD }}
        ports:
          - 1433:1433
        options: >-
          --health-cmd "/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P '${{ secrets.MSSQL_PASSWORD }}' -Q 'SELECT 1'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 10
          --health-start-period 30s
    defaults:
      run:
        working-directory: gateway-nest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: gateway-nest/package-lock.json
      - run: npm ci
      - run: npm run build
      - run: npm test
        env:
          MSSQL_HOST: localhost
          MSSQL_PORT: 1433
          MSSQL_USER: sa
          MSSQL_PASSWORD: ${{ secrets.MSSQL_PASSWORD }}
          MSSQL_DATABASE: intellipark_test
          JWT_SECRET: ${{ secrets.JWT_SECRET }}

  build-push:
    name: Build & Push Images
    runs-on: ubuntu-latest
    needs: [test-frontend, test-gateway]
    if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/heads/release/')
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build & push frontend
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: ${{ env.REGISTRY }}/intellipark-frontend:${{ github.sha }},${{ env.REGISTRY }}/intellipark-frontend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build & push gateway
        uses: docker/build-push-action@v5
        with:
          context: ./gateway-nest
          push: true
          tags: ${{ env.REGISTRY }}/intellipark-gateway:${{ github.sha }},${{ env.REGISTRY }}/intellipark-gateway:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build & push ai-worker
        uses: docker/build-push-action@v5
        with:
          context: ./ai-workers
          push: true
          tags: ${{ env.REGISTRY }}/intellipark-ai-worker:${{ github.sha }},${{ env.REGISTRY }}/intellipark-ai-worker:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### .github/workflows/deploy-staging.yml

```yaml
name: Deploy — Staging

on:
  push:
    branches: [main]

jobs:
  deploy:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: []  # ci.yml phải pass trước — dùng branch protection rules
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/intelli-park
            git pull origin main
            docker-compose pull
            docker-compose up -d --no-build
            docker-compose run --rm gateway npm run migrate
            echo "Deploy complete: $(date)"
```

### .github/workflows/cost-alert.yml

```yaml
name: Cloud Cost Alert

on:
  schedule:
    - cron: '0 9 * * *'  # 9 AM UTC hàng ngày
  workflow_dispatch:

jobs:
  check-cost:
    runs-on: ubuntu-latest
    steps:
      - name: Check cloud cost
        run: |
          echo "TODO: Query cloud provider billing API"
          echo "Alert if monthly projected cost > $400"
          # Implementation depends on cloud provider (AWS/GCP/Azure)
          # Example for AWS:
          # aws ce get-cost-and-usage --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) ...
```

## Branch Protection Rules

Cấu hình trực tiếp trong GitHub repository settings:

```
Settings → Branches → Add rule → Branch name pattern: main

☑ Require a pull request before merging
  ☑ Require approvals: 1
☑ Require status checks to pass before merging
  Required checks:
    - test-frontend
    - test-gateway
☑ Require branches to be up to date before merging
☑ Do not allow bypassing the above settings
```

## Todo List

- [ ] Tạo `.github/workflows/ci.yml`
- [ ] Tạo `.github/workflows/deploy-staging.yml`
- [ ] Tạo `.github/workflows/cost-alert.yml`
- [ ] Thêm tất cả GitHub Secrets vào repository settings
- [ ] Cấu hình branch protection rules cho `main`
- [ ] Test CI pipeline trên một test PR
- [ ] Xác nhận deploy staging workflow chạy khi merge vào main
- [ ] Tạo staging server với Docker Compose sẵn sàng

## Success Criteria

- Push lên bất kỳ branch nào → CI pipeline chạy test + build
- PR vào main: cần 1 approval + CI green trước khi merge
- Merge vào main → auto deploy lên staging trong vòng 5 phút
- Images được push lên registry với tag `sha` và `latest`
- Branch protection ngăn direct push vào main

## Security Considerations

- Dùng `GITHUB_TOKEN` cho registry authentication (không cần tạo secret riêng)
- SSH key cho staging deploy phải là dedicated deploy key, không phải personal key
- Secrets không bao giờ được log ra trong workflow output
- `environment: staging` cho phép thêm approval gate nếu cần
