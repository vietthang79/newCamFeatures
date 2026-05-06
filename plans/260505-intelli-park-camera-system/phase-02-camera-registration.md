# Phase 02 — Camera Registration (Ticket 1)

## Context Links
- [Plan overview](./plan.md)
- [Phase 01](./phase-01-project-setup.md)
- `node-onvif`: https://github.com/futomi/node-onvif

## Overview
- **Priority:** P1
- **Status:** mock-complete
- **Effort:** 8h
- Register a Milesight camera: validate input, ONVIF probe, encrypt password, persist, return snapshot.
- **Current state:** Frontend form fully built with mock data flow (70% success rate demo); no backend ONVIF probe or database persistence.

## Key Insights
- ONVIF `device.init()` 1–3s; total budget 10s timeout.
- Failure modes: ECONNREFUSED, 401, SOAP fault → map to user-friendly errors.
- `company_id` MUST come from JWT, never request body.
- Password encrypted (AES-256-GCM) with random IV; store `iv:tag:ciphertext`.

## Requirements
**Functional**
- `POST /cameras` body: `{ name, ip, port?, username, password, location? }`.
- Default `model = 'MS-C8241-X36PE'`.
- ONVIF probe on save: success → snapshot returned; failure → 422 with reason.
- `GET /cameras`, `GET /cameras/:id` scoped to company.

**Non-functional**
- 10s timeout on probe.
- DTO validation (class-validator).

## Architecture
```
Client ── POST /cameras ──> CameraController
                             └─> CameraService.register()
                                   ├─> OnvifProbeService.probe()  (timeout 10s)
                                   ├─> CryptoService.encrypt(password)
                                   └─> Repository.save()
```

## Related Code Files
**Create**
- `apps/api/src/modules/cameras/cameras.module.ts`
- `apps/api/src/modules/cameras/cameras.controller.ts`
- `apps/api/src/modules/cameras/cameras.service.ts`
- `apps/api/src/modules/cameras/dto/create-camera.dto.ts`
- `apps/api/src/modules/cameras/entities/camera.entity.ts`
- `apps/api/src/modules/cameras/onvif-probe.service.ts`
- `apps/api/src/common/crypto/crypto.service.ts`
- `apps/web/app/cameras/new/page.tsx`
- `apps/web/app/cameras/page.tsx`

## Camera Entity (MSSQL)
```ts
@Entity('cameras')
class Camera {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() company_id: string;     // indexed
  @Column() name: string;
  @Column() ip: string;
  @Column({ default: 80 }) port: number;
  @Column() username: string;
  @Column() password_encrypted: string; // iv:tag:ciphertext
  @Column({ default: 'MS-C8241-X36PE' }) model: string;
  @Column({ nullable: true }) location: string;
  @Column({ default: 'pending' }) status: string; // updated by Phase 03
  @Column({ type: 'datetime', nullable: true }) last_frame_at: Date;
  @CreateDateColumn() created_at: Date;
}
```

## CryptoService (AES-256-GCM)
```ts
encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc.toString('hex')}`;
}
```
Key from `process.env.CAMERA_ENC_KEY` (32 bytes hex).

## ONVIF Probe
```ts
async probe(ip, port, user, pass): Promise<{ snapshot: Buffer }> {
  const device = new onvif.OnvifDevice({ xaddr: `http://${ip}:${port}/onvif/device_service`, user, pass });
  await Promise.race([device.init(), timeoutReject(10_000)]);
  const snap = await device.fetchSnapshot();
  return { snapshot: snap.body };
}
```
Map errors:
- `ECONNREFUSED` / `ETIMEDOUT` → `NETWORK_UNREACHABLE`
- HTTP 401 → `INVALID_CREDENTIALS`
- SOAP fault → `ONVIF_PROTOCOL_ERROR`

## Implementation Steps
1. Create entity + migration.
2. CryptoService unit-tested (round-trip).
3. OnvifProbeService with timeout wrapper.
4. DTO with `@IsString @IsNotEmpty @IsIP` etc. NO `company_id` field.
5. Controller: `@Post()` → `service.register(dto, companyId)`.
6. Service: probe → encrypt → save → return `{ camera, snapshot: base64 }`.
7. Frontend form (Next.js) `/cameras/new` posts JSON; on success show snapshot preview.
8. List page `/cameras` shows table with name, ip, status.

## Todo List
- [x] Frontend register form (`app/(dashboard)/cameras/new/page.tsx`) — form validation (IP regex, port 1-65535), zod schema, react-hook-form integration, error banner
- [x] Frontend list page (`app/(dashboard)/cameras/page.tsx`) — table with search, status filter, delete button, mobile card view, company-scoped via effectiveCompanyId
- [ ] Camera entity + migration (blocked: no backend)
- [ ] CryptoService + tests (blocked: no backend)
- [ ] OnvifProbeService + error mapping (blocked: no backend)
- [ ] CreateCameraDto (blocked: no backend)
- [ ] CamerasController + Service (blocked: no backend)

## Success Criteria (Current Mock Implementation)
- [x] Frontend form validates IP (regex), port (1-65535), password (required)
- [x] Submit button shows loading state (2s delay)
- [x] 70% random success → shows green checkmark + snapshot placeholder + "View All Cameras" button
- [x] 30% random failure → shows error banner with mapped error message (NETWORK_UNREACHABLE, INVALID_CREDENTIALS, ONVIF_PROTOCOL_ERROR)
- [x] List page shows company-scoped cameras (filters MOCK_COMPANIES for effectiveCompanyId)
- [ ] Valid camera registers, snapshot returned, row in DB with encrypted password (blocked: no backend)
- [ ] Wrong password → 422 `INVALID_CREDENTIALS` (blocked: no backend)
- [ ] Unreachable IP → 422 `NETWORK_UNREACHABLE` within 10s (blocked: no backend)
- [ ] Two companies see only their own cameras (partially: UI scoped, data not persistent)

## Risk Assessment
- `node-onvif` may hang past timeout → use `Promise.race`.
- Snapshot can be large (>1MB) → return as base64 in JSON OK for Sprint 1.

## Security Considerations
- `company_id` from JWT only; reject if body contains it (whitelist DTO handles this).
- Password never returned in any response.
- Enc key in env, not in repo.

## Next Steps
- Phase 03: ingestion endpoint to drive `last_frame_at` and `status`.
