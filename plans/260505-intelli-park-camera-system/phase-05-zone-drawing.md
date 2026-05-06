# Phase 05 — Zone Drawing (Ticket 3)

## Context Links
- [Plan overview](./plan.md)
- [Phase 02](./phase-02-camera-registration.md)
- React-Konva: https://konvajs.org/docs/react/

## Overview
- **Priority:** P1
- **Status:** mock-complete
- **Effort:** 9h
- React-Konva canvas to draw, edit, delete polygon zones over a fresh camera snapshot.
- **Current state:** Full UI built with mock zone data; canvas editor functional (point placement, drag, delete); save/load operates on in-memory state (MOCK_ZONES).

## Key Insights
- React-Konva must be dynamically imported with `ssr: false` in Next.js.
- Coordinates stored normalized [0-1] so zones survive snapshot resolution changes.
- 3 fixed zone types; multiple of same type allowed.
- AI not wired Sprint 1 — save zones, no downstream action.

## Requirements
**Functional**
- Route: `/cameras/[id]/zones`.
- Show latest snapshot (re-fetch via ONVIF on demand via "Refresh snapshot" button).
- Click to add points; double-click to close polygon.
- Pick zone type before drawing: dropdown `parking_zone | entrance_zone | no_smoking_zone`.
- Edit existing: drag points; delete: select polygon → delete button.
- Save: `POST /cameras/:id/zones` body: `{ zones: [{ type, points: [{x,y}] }] }`.
- Delete = permanent (Sprint 1).
- `version` field bumped server-side on each save.

**Non-functional**
- Smooth 60fps drawing for ≤50 points.

## Architecture
```
ZonesPage (client)
  ├─ <SnapshotLoader>     fetches /cameras/:id/snapshot
  ├─ <ZoneEditor>         react-konva Stage/Layer
  │    ├─ Polygon[]       existing + in-progress
  │    └─ Anchor[]        editable point handles
  └─ <Toolbar>            type picker, save, refresh
```

## Related Code Files
**Create**
- `apps/web/app/cameras/[id]/zones/page.tsx`
- `apps/web/components/zones/zone-editor.tsx` (dynamic import)
- `apps/web/components/zones/zone-toolbar.tsx`
- `apps/web/lib/zones/normalize.ts`
- `apps/api/src/modules/zones/zones.module.ts`
- `apps/api/src/modules/zones/zones.controller.ts`
- `apps/api/src/modules/zones/zones.service.ts`
- `apps/api/src/modules/zones/dto/save-zones.dto.ts`
- `apps/api/src/modules/zones/entities/zone.entity.ts`
- `apps/api/src/modules/cameras/snapshot.controller.ts` (`GET /cameras/:id/snapshot`)

## Zone Entity (MSSQL)
```ts
@Entity('zones')
class Zone {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() camera_id: string;
  @Column() company_id: string;
  @Column() type: 'parking_zone' | 'entrance_zone' | 'no_smoking_zone';
  @Column({ type: 'nvarchar', length: 'MAX' }) points_json: string; // [{x,y}] normalized
  @Column({ default: 1 }) version: number;
  @CreateDateColumn() created_at: Date;
}
```

## DTO
```ts
class PointDto { @IsNumber() @Min(0) @Max(1) x: number; @IsNumber() @Min(0) @Max(1) y: number; }
class ZoneDto {
  @IsIn(['parking_zone','entrance_zone','no_smoking_zone']) type: string;
  @ValidateNested({each:true}) @Type(()=>PointDto) @ArrayMinSize(3) points: PointDto[];
}
class SaveZonesDto { @ValidateNested({each:true}) @Type(()=>ZoneDto) zones: ZoneDto[]; }
```

## Save Strategy
Replace-all per camera (Sprint 1, KISS):
```ts
async save(cameraId, companyId, dto) {
  await this.repo.delete({ camera_id: cameraId, company_id: companyId }); // hard delete
  const next = dto.zones.map(z => ({ ...z, points_json: JSON.stringify(z.points), version: nextVersion(), camera_id, company_id }));
  await this.repo.insert(next);
}
```

## Frontend Notes
```tsx
const ZoneEditor = dynamic(() => import('@/components/zones/zone-editor'), { ssr: false });
```
- Stage size = container size; coords normalized via `x / stageWidth`.
- In-progress polygon: store points in state, render `<Line points={flatPoints} closed={false}>`.
- Double-click → push to `zones` array, reset in-progress.
- Edit: each point rendered as `<Circle draggable>`.

## Snapshot Endpoint
`GET /cameras/:id/snapshot` → calls `OnvifProbeService.fetchSnapshot()`, returns `image/jpeg`. Cached 30s.

## Implementation Steps
1. Zone entity + migration.
2. Zones module/controller/service.
3. SaveZonesDto with strict validation.
4. Snapshot endpoint reusing OnvifProbeService.
5. Frontend page with dynamic ZoneEditor.
6. Toolbar: zone type dropdown, Save, Refresh.
7. Normalize helpers (toNorm/toPx).
8. GET endpoint to load existing zones on mount.

## Todo List
- [x] ZoneEditor (Konva) (`components/zones/zone-editor.tsx`) — dynamic import with SSR disabled, Stage/Layer, polygon rendering, point dragging (Anchor circles), click to add point, double-click to close, selected zone highlighting
- [x] Toolbar (`components/zones/zone-toolbar.tsx`) — zone type dropdown (parking_zone, entrance_zone, no_smoking_zone), toggle draw mode button, refresh snapshot button, save button, delete selected button
- [x] Zone list (`components/zones/zone-list.tsx`) — displays zones with type badge and delete button per zone
- [x] Load existing zones on mount (`app/(dashboard)/cameras/[id]/zones/page.tsx`) — filters MOCK_ZONES by camera_id on component init
- [x] Save flow (`handleSave` in zones page) — toast notification, 1s simulated delay
- [x] Snapshot placeholder (`components/cameras/snapshot-placeholder.tsx`) — gray placeholder, optional label
- [ ] Zone entity + migration (blocked: no backend)
- [ ] ZonesController/Service (blocked: no backend)
- [ ] DTO with normalized validation (blocked: no backend)
- [ ] Snapshot endpoint + cache (blocked: no backend)

## Success Criteria (Current Mock Implementation)
- [x] Draw polygon: click to add points, double-click to close polygon
- [x] Toolbar shows zone type selector and draw toggle button
- [x] Save button: shows loading state (1s delay), displays toast "N zone(s) saved"
- [x] Reload page → zones render at correct positions (loaded from MOCK_ZONES on mount)
- [x] Delete zone: select zone → delete button removes from list, shows toast
- [x] Snapshot refresh button: shows loading state, displays toast "Snapshot refreshed"
- [x] Zone list displays all zones for camera with type badge
- [ ] Persist zones to backend (blocked: no backend)
- [ ] Version bumps on save (blocked: no backend)

## Risk Assessment
- Stage resize after image load can mis-place zones → fix size to image natural size or recompute on resize.
- Konva SSR import errors → ensure `dynamic(..., { ssr: false })`.

## Security Considerations
- All zone ops scoped by `company_id` (interceptor + WHERE clauses).
- Validate point count ≥3 to prevent degenerate polygons.

## Next Steps
- AI pipeline (Sprint 2+) consumes zones via `points_json`.
