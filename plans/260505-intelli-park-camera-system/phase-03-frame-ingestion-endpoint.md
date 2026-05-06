# Phase 03 — Frame Ingestion Endpoint

## Context Links
- [Plan overview](./plan.md)
- Bull docs: https://docs.nestjs.com/techniques/queues

## Overview
- **Priority:** P1 (blocks Phase 06)
- **Status:** pending
- **Effort:** 6h
- Receive Milesight HTTP push frames, enqueue, persist log, update camera health.

## Key Insights
- Milesight pushes multipart form-data ~2 FPS, 2–5 MB/s per camera.
- Synchronous DB write would block ingestion → Bull queue.
- Sprint 1: we don't store frame bytes (no AI yet); only metadata logged.

## Requirements
**Functional**
- `POST /ingest/:siteKey` accepts `multipart/form-data` (field: `image`).
- Validate `siteKey` = existing `camera.id`.
- Enqueue job `{ camera_id, company_id, received_at, size_bytes }`.
- Worker writes row to PG `frame_ingestion_log` and updates MSSQL `camera.last_frame_at`.

**Non-functional**
- Endpoint returns 204 in <50ms (just enqueue).
- Queue concurrency = 5 (per worker).
- No JWT on this endpoint (camera devices can't carry JWT) — auth by `siteKey` lookup + optional shared secret header.

## Architecture
```
Camera ──POST /ingest/:siteKey (multipart)──> IngestionController
                                                ↓ enqueue
                                              Bull 'frame-ingestion'
                                                ↓
                                              FrameProcessor
                                                ├─> PG: insert frame_ingestion_log
                                                └─> MSSQL: UPDATE cameras SET last_frame_at, status='online'
```

## Related Code Files
**Create**
- `apps/api/src/modules/ingestion/ingestion.module.ts`
- `apps/api/src/modules/ingestion/ingestion.controller.ts`
- `apps/api/src/modules/ingestion/frame.processor.ts`
- `apps/api/src/modules/ingestion/entities/frame-ingestion-log.entity.ts`

## Entities
**PostgreSQL**
```ts
@Entity('frame_ingestion_log')
class FrameIngestionLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() camera_id: string;
  @Column() company_id: string;
  @Column({ type: 'timestamptz' }) received_at: Date;
  @Column() size_bytes: number;
  @Column({ default: 'ok' }) status: string;  // ok | error
  @Column({ nullable: true }) error_message: string;
}
```
Indexes: `(camera_id, received_at DESC)`, `(company_id, received_at DESC)`.

## Controller
```ts
@Public()  // bypass JWT
@Post('ingest/:siteKey')
@UseInterceptors(FileInterceptor('image'))
async ingest(@Param('siteKey') siteKey, @UploadedFile() file) {
  const cam = await this.cameras.findById(siteKey);  // cached
  if (!cam) throw new NotFoundException();
  await this.queue.add('process', {
    camera_id: cam.id,
    company_id: cam.company_id,
    received_at: new Date(),
    size_bytes: file.size,
  }, { removeOnComplete: true });
  return; // 204
}
```

## Processor
```ts
@Processor('frame-ingestion')
class FrameProcessor {
  @Process('process')
  async handle(job) {
    await this.logRepo.insert(job.data);
    await this.cameraRepo.update(job.data.camera_id, {
      last_frame_at: job.data.received_at,
      status: 'online',
    });
  }
}
```

## Implementation Steps
1. Create PG entity + migration with indexes.
2. Cache `siteKey → camera` lookup (in-memory, 60s TTL — KISS).
3. Use `@nestjs/platform-express` + `multer` (default).
4. Bull queue `frame-ingestion`, concurrency 5.
5. Mark route public (skip JWT guard).
6. Optional: validate `X-Site-Secret` header against env shared secret for Sprint 1 demo.
7. Add log rotation strategy note (out of scope).

## Todo List
- [ ] frame_ingestion_log entity + migration
- [ ] IngestionController with FileInterceptor
- [ ] Bull queue registration
- [ ] FrameProcessor
- [ ] Camera lookup cache
- [ ] Public route decorator
- [ ] e2e smoke test (curl -F image=@x.jpg)

## Success Criteria
- `curl -F image=@frame.jpg http://api/ingest/<cameraId>` → 204.
- Within 1s, row appears in PG, `last_frame_at` updates in MSSQL.
- Queue handles 10 concurrent cameras without backlog growth.

## Risk Assessment
- File buffer in memory may OOM under load → use `multer` `limits.fileSize` 10 MB.
- Camera-not-found floods cache misses → negative cache 30s.

## Security Considerations
- Public endpoint: rate-limit per IP (`@nestjs/throttler`) — e.g., 10/sec.
- `siteKey` is UUID (unguessable), validated against DB.
- Shared secret header recommended for production (Sprint 2).

## Next Steps
- Phase 06 health dashboard reads from these tables.
