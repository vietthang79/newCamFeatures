# Phase 06 — Health Dashboards (Tickets 4A + 4B)

## Context Links
- [Plan overview](./plan.md)
- [Phase 03 — frame ingestion](./phase-03-frame-ingestion-endpoint.md)

## Overview
- **Priority:** P1
- **Status:** mock-complete
- **Effort:** 8h
- Operator camera health (per-company) + Vendor admin global dashboard.
- **Current state:** All UI pages built; status badges, health banners, KPI cards, and activity charts fully functional with mock data; no real-time polling or database queries.

## Key Insights
- Status thresholds: green <60s, yellow <5min, red >5min/never.
- 30s client polling (KISS) — no WebSocket Sprint 1.
- FPM (frames per minute) computed via time-bucketed SQL on PG.
- Admin scoped by RBAC role `vendor_admin` (no company filter).

## Requirements
**Functional — 4A Operator**
- Camera list page + detail page Health tab show:
  - Color badge based on `last_frame_at` age.
  - Last frame timestamp (humanized).
  - "Not receiving frames" banner if >5min.
- Polls 30s.

**Functional — 4B Admin**
- Route `/admin/health` (guarded `@Roles('vendor_admin')`).
- Table: company_name, total_cameras, fpm_5min, last_frame, errors_24h.
- Expandable per-company → camera-level rows.
- Header: total_frames_today, total_alerts_today.
- Polls 30s.

**Non-functional**
- Admin queries on PG must use indexes on `(company_id, received_at)`.

## Architecture
```
GET /health/cameras            (operator, company-scoped)
GET /admin/health/summary      (admin)
GET /admin/health/companies    (admin)
GET /admin/health/companies/:id/cameras (admin)
```

## Related Code Files
**Create**
- `apps/api/src/modules/health/health.module.ts`
- `apps/api/src/modules/health/health.controller.ts`
- `apps/api/src/modules/health/health.service.ts`
- `apps/api/src/modules/admin/admin-health.controller.ts`
- `apps/api/src/modules/admin/admin-health.service.ts`
- `apps/web/app/cameras/[id]/health/page.tsx`
- `apps/web/components/health/status-badge.tsx`
- `apps/web/app/admin/health/page.tsx`
- `apps/web/lib/use-poll.ts` (30s polling hook)

## Status Logic
```ts
function statusFor(lastFrameAt: Date | null) {
  if (!lastFrameAt) return 'red';
  const age = Date.now() - lastFrameAt.getTime();
  if (age < 60_000) return 'green';
  if (age < 300_000) return 'yellow';
  return 'red';
}
```

## SQL — FPM (5-min window)
```sql
SELECT camera_id, COUNT(*)::float / 5 AS fpm
FROM frame_ingestion_log
WHERE received_at > NOW() - INTERVAL '5 minutes'
  AND company_id = $1
GROUP BY camera_id;
```

## SQL — Errors 24h per company
```sql
SELECT company_id, COUNT(*) AS error_count
FROM frame_ingestion_log
WHERE received_at > NOW() - INTERVAL '24 hours'
  AND status = 'error'
GROUP BY company_id;
```

## Implementation Steps
1. HealthService methods: `cameraHealth(companyId)`, returns array `{ id, name, last_frame_at, status, fpm }`.
2. HealthController `GET /health/cameras` uses interceptor company_id.
3. AdminHealthService methods: `summary()`, `companies()`, `cameras(companyId)`.
4. AdminController guarded by `@Roles('vendor_admin')` + JwtAuthGuard.
5. `usePoll(fetcher, 30_000)` hook (setInterval + cleanup).
6. StatusBadge component (3 colors + tooltip).
7. Operator page: list cameras with badge; detail Health tab with banner if red.
8. Admin page: table with `<Disclosure>`-style expandable rows.

## Todo List
- [x] StatusBadge component (`components/cameras/status-badge.tsx`) — color-coded badge (online=green, warning=yellow, offline=red, pending=gray)
- [x] Health banner (`components/cameras/health-banner.tsx`) — alerts for offline status with last frame timestamp
- [x] Operator camera health tab (`app/(dashboard)/cameras/[id]/health/page.tsx`) — status card with icon, last frame, metrics (FPM 5m, uptime %, errors 24h), activity bar chart (last 12h), auto-refresh progress bar (30s animation)
- [x] Admin health dashboard (`app/(dashboard)/admin/health/page.tsx`) — KPI cards (total frames, alerts, companies, cameras), company table (sortable), expandable rows with camera sub-table, FPM/errors per company
- [x] RBAC enforcement on `/admin/*` — `middleware.ts` checks role === 'vendor_admin' before allowing `/admin/` routes; `/admin/health` page double-checks via `useAuth()` and shows 403 for non-admin
- [ ] HealthService + Controller (operator) (blocked: no backend)
- [ ] AdminHealthService + Controller (blocked: no backend)
- [ ] usePoll hook (blocked: not needed for mock; static demo data)

## Success Criteria (Current Mock Implementation)
- [x] Operator sees status badges (online, warning, offline, pending) based on `cameraStatus()` logic (checks `last_frame_at` age)
- [x] Operator health tab shows KPI cards (FPM=24.6, uptime=98.2%, errors=3) and activity bar chart
- [x] Admin sees all companies in table with FPM, errors, last frame
- [x] Admin table rows are expandable, showing camera sub-table
- [x] Non-admin user accessing `/admin/health` → shows access denied message + back to cameras button
- [x] Auto-refresh animation (30s loop) on health tab
- [x] Status badge color logic: <60s=green, <5min=yellow, >5min=red, null=gray
- [ ] Pulling network plug → camera status red within 5min (blocked: no real frame ingestion)
- [ ] FPM accurate ±10% under steady push (blocked: no real frame data)
- [ ] Poll updates without full page reload (blocked: not needed for mock)

## Risk Assessment
- N+1 queries in admin view → join FPM aggregate via single query keyed by company_id.
- Clock skew between camera & server → use server-side `received_at` only.

## Security Considerations
- `/admin/*` requires JWT + role check; deny by default.
- Operator endpoint never returns rows from other companies (interceptor enforced + WHERE clause).
- Admin queries cross PG only; no PII leaked.

## Next Steps
- Sprint 2: alerts surface in dashboard, WebSocket push.
