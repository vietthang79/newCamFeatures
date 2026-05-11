# Phase 03 — Zone Drawing API

**Status:** ⏳ Pending  
**Priority:** 🟡 High  
**Effort:** ~3 hours  
**Depends on:** Phase 01 (cameras table + camera_id exists)

## Overview

Implement zones backend (MSSQL) và wire FE `ZoneEditor` component tới real API. Zone editor đã functional với mock — chỉ cần swap data layer.

## Acceptance Criteria

- "Draw Zones" từ camera detail page
- Xem latest snapshot làm background
- Vẽ multiple polygons (click points, double-click để close)
- Label: parking zone, entrance zone, no-smoking zone
- Edit hoặc delete existing polygons
- Refresh snapshot nếu camera đã move
- Saved geo-zones → apply ngay cho AI processing (không cần restart)

## Database Schema (MSSQL)

```sql
CREATE TABLE zones (
  id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  camera_id   UNIQUEIDENTIFIER NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  company_id  UNIQUEIDENTIFIER NOT NULL REFERENCES companies(id),  -- denormalized for fast tenant filtering
  name        NVARCHAR(255) NOT NULL,
  zone_type   NVARCHAR(50) NOT NULL
              CHECK (zone_type IN ('parking_zone', 'entrance_zone', 'no_smoking_zone')),
  points_json NVARCHAR(MAX) NOT NULL,  -- JSON: [{x: 0.1, y: 0.2}, ...]
  version     INT NOT NULL DEFAULT 1,
  created_at  DATETIME2 NOT NULL DEFAULT GETDATE(),
  updated_at  DATETIME2 NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_zones_camera_id ON zones(camera_id);
CREATE INDEX IX_zones_company_id ON zones(company_id);
```

**points_json format** (normalized coordinates 0–1):
```json
[{"x": 0.12, "y": 0.34}, {"x": 0.56, "y": 0.34}, {"x": 0.56, "y": 0.78}]
```

> **Note:** FE đã dùng normalized coords — align hoàn toàn với current ZoneEditor implementation.

## TypeORM Entity

**gateway-nest/src/zones/zone.entity.ts:**
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
         UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Camera } from '../cameras/camera.entity';
import { Company } from '../companies/company.entity';

export type ZoneType = 'parking_zone' | 'entrance_zone' | 'no_smoking_zone';

@Entity('zones')
export class Zone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'camera_id' })
  cameraId: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'zone_type', length: 50 })
  zoneType: ZoneType;

  @Column({ name: 'points_json', type: 'nvarchar', length: 'max' })
  pointsJson: string; // stored as JSON string, parse on read

  @Column({ default: 1 })
  version: number;

  @ManyToOne(() => Camera, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'camera_id' })
  camera: Camera;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

## API Contract

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cameras/:cameraId/zones` | Cookie | Lấy tất cả zones của camera |
| PUT | `/api/cameras/:cameraId/zones` | Cookie | Replace all zones (atomic save) |
| DELETE | `/api/cameras/:cameraId/zones/:zoneId` | Cookie | Xóa 1 zone |

> **Tại sao dùng PUT thay POST?** Zone editor save toàn bộ state cùng lúc — PUT (replace all) đơn giản hơn POST/PATCH từng zone.

**PUT /api/cameras/:cameraId/zones body:**
```json
{
  "zones": [
    {
      "id": "existing-uuid-or-null",
      "name": "Main Parking Area",
      "zoneType": "parking_zone",
      "points": [{"x": 0.1, "y": 0.2}, {"x": 0.5, "y": 0.2}, {"x": 0.5, "y": 0.8}]
    }
  ]
}
```

## NestJS Zones Module

**gateway-nest/src/zones/zones.service.ts:**
```typescript
async replaceAll(cameraId: string, dto: SaveZonesDto, user: JwtPayload): Promise<Zone[]> {
  // Verify camera belongs to user's company
  const camera = await this.camerasRepo.findOne({ where: { id: cameraId } });
  if (!camera) throw new NotFoundException();
  if (user.role !== 'vendor_admin' && camera.companyId !== user.companyId) {
    throw new ForbiddenException();
  }

  // Atomic replace: delete all existing zones, insert new ones
  await this.dataSource.transaction(async manager => {
    await manager.delete(Zone, { cameraId });

    const newZones = dto.zones.map(z => manager.create(Zone, {
      cameraId,
      companyId: camera.companyId,
      name: z.name,
      zoneType: z.zoneType,
      pointsJson: JSON.stringify(z.points),
      version: 1,
    }));

    await manager.save(Zone, newZones);
  });

  return this.findAll(cameraId, user);
}

async findAll(cameraId: string, user: JwtPayload): Promise<ZoneResponseDto[]> {
  const zones = await this.zonesRepo.find({ where: { cameraId } });
  return zones.map(z => ({
    id: z.id,
    name: z.name,
    zoneType: z.zoneType,
    points: JSON.parse(z.pointsJson),
    version: z.version,
    cameraId: z.cameraId,
  }));
}
```

## Frontend Updates

**Files to update:**
- `frontend/components/zones/zone-editor.tsx` — swap mock save với API call
- `frontend/components/zones/zone-list.tsx` — load từ API, delete qua API
- `frontend/app/(dashboard)/cameras/[id]/geo-zones/page.tsx` — load zones khi mount

**api-client.ts additions:**
```typescript
zones: {
  list: (cameraId: string) => apiFetch<ZoneDto[]>(`/api/cameras/${cameraId}/zones`),
  saveAll: (cameraId: string, zones: SaveZoneBody[]) =>
    apiFetch<ZoneDto[]>(`/api/cameras/${cameraId}/zones`, {
      method: 'PUT',
      body: JSON.stringify({ zones }),
    }),
  delete: (cameraId: string, zoneId: string) =>
    apiFetch(`/api/cameras/${cameraId}/zones/${zoneId}`, { method: 'DELETE' }),
}

export interface ZoneDto {
  id: string;
  name: string;
  zoneType: 'parking_zone' | 'entrance_zone' | 'no_smoking_zone';
  points: Array<{ x: number; y: number }>;
  version: number;
  cameraId: string;
}

export interface SaveZoneBody {
  id?: string;
  name: string;
  zoneType: 'parking_zone' | 'entrance_zone' | 'no_smoking_zone';
  points: Array<{ x: number; y: number }>;
}
```

**zone-editor.tsx — key change (save handler):**
```typescript
// TRƯỚC: update mock local state
const handleSave = () => {
  setZones(currentZones); // mock
  toast.success('Zones saved');
};

// SAU: call API
const handleSave = async () => {
  try {
    const saved = await api.zones.saveAll(cameraId, currentZones.map(z => ({
      id: z.id,
      name: z.name,
      zoneType: z.type,
      points: z.points,
    })));
    setZones(saved);
    toast.success('Zones saved successfully');
  } catch (err) {
    toast.error('Failed to save geo-zones');
  }
};
```

**Snapshot refresh:** FE hiện có `RefreshIndicator` component và `CameraContext` cho refresh state. Wire snapshot URL tới `GET /api/cameras/:id/snapshot` (hoặc trực tiếp từ camera IP nếu network accessible).

## Todo List

**Backend:**
- [ ] Tạo migration `1700000006-CreateZones.ts`
- [ ] Tạo `src/zones/zone.entity.ts`
- [ ] Tạo `src/zones/zones.module.ts` + controller + service + DTOs
- [ ] Implement `PUT /api/cameras/:cameraId/zones` (atomic replace)
- [ ] Implement `GET /api/cameras/:cameraId/zones`
- [ ] Implement `DELETE /api/cameras/:cameraId/zones/:zoneId`

**Frontend:**
- [ ] Thêm `geo-zones` vào `api-client.ts`
- [ ] Update `zone-editor.tsx` — save handler gọi API
- [ ] Update `zone-list.tsx` — delete handler gọi API
- [ ] Update `geo-zones/page.tsx` — load zones khi mount
- [ ] Test: vẽ geo-zone → save → reload page → geo-zones vẫn còn
- [ ] Test: delete zone → reload → zone đã mất
- [ ] Test: operator không thể modify geo-zones của camera công ty khác

## Success Criteria

- Vẽ geo-zones → save → persist trong DB
- Reload page → geo-zones tải lại đúng shapes và labels
- Delete zone → xóa khỏi DB
- Zone coords normalized (0–1) — không lưu pixel coords
- Operator chỉ modify geo-zones của cameras thuộc company mình

## Notes

- Zone editor Konva code không cần thay đổi — chỉ data layer
- `lib/zones/normalize.ts` đã có normalize logic — giữ nguyên
- `PUT` (replace all) đơn giản hơn PATCH từng zone — ít edge cases hơn
