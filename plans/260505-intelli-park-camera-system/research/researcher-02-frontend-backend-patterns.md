# Research Report: React-Konva Polygon Drawing, Multi-DB TypeORM, Health Monitoring Patterns

**Date**: 2026-05-05  
**Topic**: Frontend + Backend patterns for Intelli-Park camera SaaS  
**Work Context**: `/home/thang79/project/newCamFeatures`

---

## Topic 1: React-Konva Polygon Drawing in Next.js

### SSR Handling
- react-konva **requires dynamic import with SSR disabled** due to DOM/Canvas API dependencies
- Pattern: `const Canvas = dynamic(() => import('./Canvas'), { ssr: false })`
- Use `'use client'` directive in component file for client-only execution

### Polygon Implementation Pattern
- Use Konva **Line component** with `closed={true}` prop to render polygons
- Data structure: **Array of normalized coordinates** `[{x, y}, {x, y}, ...]` where x/y are decimal ratios (0-1) relative to image dimensions
  - Normalized coords preserve polygon on image resize
  - Convert to pixel coords only during render: `{x: point.x * imageWidth, y: point.y * imageHeight}`
- Drawing flow: Click to add points → Show preview line → Double-click or press Enter to close → Store polygon
- Use React hooks to manage drawing state: `points`, `isDrawing`, `selectedPolygon`

### Edit/Delete Workflow
- Render closed polygons as separate Line shapes with `listening: true` for interaction
- Click polygon to select → Show control points as draggable Circles
- Drag circles to edit vertices; delete polygon on button click
- Debounce polygon updates to avoid excessive state changes

### Background Image
- Use Konva Image component; load snapshot via `Image.fromURL()` or canvas element
- Position as first child in Stage to render behind polygons
- Scale image proportionally to stage dimensions; update on window resize

---

## Topic 2: NestJS with Dual Database (MSSQL + PostgreSQL)

### TypeORM Multiple DataSource Configuration
```
TypeOrmModule.forRoot({
  name: 'mssql',
  type: 'mssql',
  host: process.env.MSSQL_HOST,
  database: process.env.MSSQL_DB,
  // ...
})

TypeOrmModule.forRoot({
  name: 'postgres',
  type: 'postgres',
  host: process.env.PG_HOST,
  database: process.env.PG_DB,
  // ...
})
```
- **Critical**: Specify `name` property for each datasource (2nd+ need explicit naming)
- When injecting repositories: `@InjectRepository(Camera, 'mssql')` specifies which DB
- Use `forRootAsync` with `.env` config for credential management

### Multi-Tenant Data Isolation Pattern
- Store `company_id` in JWT claims during authentication
- Create custom **RequestContextInterceptor** to extract `company_id` from JWT and attach to request object
- Create **CompanyIdGuard** that validates user's `company_id` matches requested resource owner
- Auto-scope MSSQL queries via **QueryBuilder interceptor** that appends `.where('camera.company_id = :companyId', { companyId: req.companyId })`
- PostgreSQL logs similarly scoped: `WHERE company_id = $1`
- This prevents data leakage more reliably than query-time additions

### Repository Injection for Multi-Tenant
```typescript
constructor(
  @InjectRepository(Camera, 'mssql') private cameraRepo,
  @InjectRepository(FrameLog, 'postgres') private logRepo
) {}
```

---

## Topic 3: Health Monitoring with Auto-Refresh

### Frame Ingestion Tracking
- **Write pattern**: On each frame ingestion, upsert row in `frame_ingestion_log`:  
  `(camera_id, company_id, ingestion_timestamp, frame_count)`
- Query for "last frame received": `SELECT MAX(ingestion_timestamp) FROM frame_ingestion_log WHERE camera_id = $1 AND company_id = $2`
- Use PostgreSQL **CURRENT_TIMESTAMP** for server-side consistency

### Frames-Per-Minute Calculation
- **Query approach** (stateless, simple):
  ```sql
  SELECT COUNT(*) as frame_count, 
    EXTRACT(EPOCH FROM (MAX(ingestion_timestamp) - MIN(ingestion_timestamp))) / 60 as duration_minutes
  FROM frame_ingestion_log
  WHERE camera_id = $1 AND ingestion_timestamp > NOW() - INTERVAL '5 minutes'
  ```
- **Optimization**: Add **composite index** `(camera_id, company_id, ingestion_timestamp DESC)` for fast lookups
- For high-volume streams, consider TimescaleDB hypertables for automatic time-chunking (but plain PostgreSQL sufficient for < 100K frames/min)

### Polling vs SSE Decision
- **Use polling (30s interval)** for:
  - Health status page (low QPS, eventual consistency acceptable)
  - Simple implementation with client-side fetch in `useEffect` with cleanup
  - Easier error handling and reconnection logic
  - Cost-effective for sparse updates
  
- **Use SSE for**:
  - Real-time alert delivery (fraud detected, camera offline)
  - Sustained open connections acceptable (< 1000 concurrent clients per NestJS process)
  - Use `@nestjs/sse` or manual EventEmitter pattern: emit on frame ingestion, subscribe clients get push
  
- **Hybrid approach (recommended)**: SSE for alerts, polling for dashboard refresh (30s). Keeps frontend simple while delivering urgent notifications.

---

## Key Decisions Implemented

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Canvas Background | Konva Image component | Native integration, proper scaling |
| Polygon Storage | Normalized coords [0-1] | Survives image resize, frontend agnostic |
| Multi-Tenant | Interceptor + Guard + Query scoping | Defense-in-depth, prevents data leaks |
| Frame Log Index | Composite (camera_id, company_id, timestamp DESC) | Supports both last-frame and time-window queries |
| Health Dashboard | Polling 30s + SSE for alerts | Balances simplicity and responsiveness |

---

## Unresolved Questions

1. Should polygon edits trigger immediate DB persist or batch on "save" button?
2. Do we need camera snapshot versioning (multiple polygons per camera over time)?
3. What's the max concurrent health dashboard clients expected? (affects SSE vs polling balance)
4. Should frame_ingestion_log have TTL/archival for compliance retention?
