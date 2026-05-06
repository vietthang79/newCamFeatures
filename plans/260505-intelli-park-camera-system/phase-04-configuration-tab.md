# Phase 04 — Configuration Tab (Ticket 2)

## Context Links
- [Plan overview](./plan.md)
- [Phase 02](./phase-02-camera-registration.md)
- [Phase 03](./phase-03-frame-ingestion-endpoint.md)

## Overview
- **Priority:** P2
- **Status:** mock-complete
- **Effort:** 3h
- Camera detail page with Configuration tab showing the 3 values needed to configure Milesight HTTP push.
- **Current state:** All pages, tabs, and UI fully built with mock data; copy-to-clipboard functional.

## Key Insights
- Pure read-only display; no business logic.
- Endpoint URL must reflect actual deployed API base.
- Trigger Interval is fixed (500ms) per spec.

## Requirements
**Functional**
- Route: `/cameras/[id]` with tabs: `Overview | Configuration | Zones | Health`.
- Configuration tab shows:
  - **Site Key** = `camera.id` (UUID)
  - **Endpoint URL** = `${API_BASE}/ingest/${camera.id}`
  - **Trigger Interval** = `500ms`
- Each value has a copy-to-clipboard button.

**Non-functional**
- Mobile-friendly layout.

## Architecture
```
/cameras/[id]
  └─ <CameraDetailLayout> (tabs)
       ├─ OverviewTab
       ├─ ConfigurationTab   ← this phase
       ├─ ZonesTab           (Phase 05)
       └─ HealthTab          (Phase 06)
```

## Related Code Files
**Create**
- `apps/web/app/cameras/[id]/layout.tsx`
- `apps/web/app/cameras/[id]/page.tsx` (Overview)
- `apps/web/app/cameras/[id]/configuration/page.tsx`
- `apps/web/components/copy-button.tsx`

**Modify**
- `apps/api/src/modules/cameras/cameras.controller.ts` — ensure `GET /cameras/:id` returns id + name.

## Implementation Steps
1. Layout component with tab nav (Next.js segment-based).
2. Server component fetches camera by id (scoped to company).
3. ConfigurationTab renders 3 rows:
   ```tsx
   <Row label="Site Key" value={camera.id} />
   <Row label="Endpoint URL" value={`${process.env.NEXT_PUBLIC_API_BASE}/ingest/${camera.id}`} />
   <Row label="Trigger Interval" value="500ms" />
   ```
4. CopyButton uses `navigator.clipboard.writeText`, shows toast.
5. Add `NEXT_PUBLIC_API_BASE` to env.

## Todo List
- [x] Detail layout with tabs (`app/(dashboard)/cameras/[id]/layout.tsx`) — tab nav with active state, color-coded underline, responsive
- [x] ConfigurationTab page (`app/(dashboard)/cameras/[id]/configuration/page.tsx`) — 3 config rows (Site Key, Endpoint URL, Trigger Interval), copy buttons
- [x] CopyButton component (`components/shared/copy-button.tsx`) — clicks to copy, shows toast
- [x] Env var (`NEXT_PUBLIC_API_BASE` in layout.tsx, defaults to `https://api.intellipark.io`)

## Success Criteria (Current Mock Implementation)
- [x] Visiting `/cameras/<id>/configuration` shows 3 config rows (Site Key = camera.id, Endpoint URL, Trigger Interval = 500ms)
- [x] Copy button copies text to clipboard, shows success toast
- [x] Tab nav shows active Configuration tab with green underline
- [x] Back button returns to camera list
- [ ] Different company's camera id → 404 (blocked: no backend; current: always shows MOCK_CAMERAS[0] if id not found)

## Risk Assessment
- `navigator.clipboard` requires HTTPS in some browsers; dev on `localhost` OK.

## Security Considerations
- 404 on cross-company access (handled by API service).
- No secret values shown.

## Next Steps
- Phase 05 reuses same tab layout.
