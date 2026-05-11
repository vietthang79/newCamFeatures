# Phase 01 — Camera Registration

**Status:** ⏳ Pending  
**Priority:** 🔴 Critical  
**Effort:** ~5 hours  
**Depends on:** EP-1 Phase 03 (Auth + TenantGuard working)

## Overview

Implement camera registration backend: MSSQL schema, NestJS CRUD endpoint, ONVIF connection probe, AES-256 credential encryption. Wire FE camera form tới real API.

## Acceptance Criteria

- Form nhập: name, IP address, port, RTSP path, username, password
- System test connection → success/failure trong 10 giây
- Success: camera xuất hiện trong list với status "Online" và snapshot preview
- Failure: clear error message (network unreachable, wrong credentials, etc.)
- Camera tự động tagged với `company_id` của operator
- Camera credentials encrypted at rest (AES-256)

## Database Schema (MSSQL)

```sql
CREATE TABLE cameras (
  id               UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  company_id       UNIQUEIDENTIFIER NOT NULL REFERENCES companies(id),
  name             NVARCHAR(255) NOT NULL,
  ip_address       NVARCHAR(45) NOT NULL,
  port             INT NOT NULL DEFAULT 80,
  rtsp_path        NVARCHAR(255) NOT NULL DEFAULT '/stream1',
  username         NVARCHAR(255) NOT NULL,
  password_encrypted  NVARCHAR(500) NOT NULL,  -- AES-256 encrypted
  model            NVARCHAR(100) NOT NULL DEFAULT 'MS-C8241-X36PE',
  location         NVARCHAR(255),
  site_key         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),  -- Milesight push auth
  status           NVARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('online', 'offline', 'warning', 'pending')),
  created_at       DATETIME2 NOT NULL DEFAULT GETDATE(),
  updated_at       DATETIME2 NOT NULL DEFAULT GETDATE(),
  CONSTRAINT UQ_cameras_site_key UNIQUE (site_key)
);

CREATE INDEX IX_cameras_company_id ON cameras(company_id);
```

## TypeORM Entity

**gateway-nest/src/cameras/camera.entity.ts:**
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
         UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Company } from '../companies/company.entity';

@Entity('cameras')
export class Camera {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'ip_address', length: 45 })
  ipAddress: string;

  @Column({ default: 80 })
  port: number;

  @Column({ name: 'rtsp_path', length: 255, default: '/stream1' })
  rtspPath: string;

  @Column({ length: 255 })
  username: string;

  @Column({ name: 'password_encrypted', length: 500 })
  passwordEncrypted: string;

  @Column({ length: 100, default: 'MS-C8241-X36PE' })
  model: string;

  @Column({ length: 255, nullable: true })
  location: string | null;

  @Column({ name: 'site_key', generated: 'uuid' })
  siteKey: string;

  @Column({ default: 'pending', length: 20 })
  status: 'online' | 'offline' | 'warning' | 'pending';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

## AES-256 Encryption Service

**gateway-nest/src/common/services/encryption.service.ts:**
```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const hexKey = config.get<string>('camera.encryptionKey') ?? '';
    if (hexKey.length !== 64) {
      throw new Error('CAMERA_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Format: iv(12) + authTag(16) + ciphertext — base64 encoded
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decrypt(encoded: string): string {
    const buf = Buffer.from(encoded, 'base64');
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
  }
}
```

## ONVIF Connection Probe

**gateway-nest/src/cameras/onvif-probe.service.ts:**
```typescript
import { Injectable, Logger } from '@nestjs/common';
import * as http from 'http';

@Injectable()
export class OnvifProbeService {
  private readonly logger = new Logger(OnvifProbeService.name);

  async probe(ip: string, port: number, username: string, password: string): Promise<{
    success: boolean;
    errorReason?: 'network_unreachable' | 'wrong_credentials' | 'timeout' | 'unknown';
    snapshotUrl?: string;
  }> {
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        resolve({ success: false, errorReason: 'timeout' });
      }, 9000); // 9s timeout (leave 1s buffer for 10s total)

      // ONVIF GetSystemDateAndTime — lightweight probe
      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
          <s:Body><GetSystemDateAndTime xmlns="http://www.onvif.org/ver10/device/wsdl"/></s:Body>
        </s:Envelope>`;

      const digestAuth = this.buildDigestAuth(username, password);

      const options = {
        hostname: ip,
        port,
        path: '/onvif/device_service',
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml',
          'Content-Length': Buffer.byteLength(soapBody),
          'Authorization': digestAuth,
        },
        timeout: 8000,
      };

      const req = http.request(options, res => {
        clearTimeout(timeout);
        if (res.statusCode === 200) {
          resolve({ success: true, snapshotUrl: `http://${ip}:${port}/cgi-bin/snapshot.cgi` });
        } else if (res.statusCode === 401) {
          resolve({ success: false, errorReason: 'wrong_credentials' });
        } else {
          resolve({ success: false, errorReason: 'unknown' });
        }
        res.resume(); // consume body
      });

      req.on('error', err => {
        clearTimeout(timeout);
        const code = (err as any).code;
        if (code === 'ECONNREFUSED' || code === 'ENETUNREACH') {
          resolve({ success: false, errorReason: 'network_unreachable' });
        } else {
          resolve({ success: false, errorReason: 'unknown' });
        }
      });

      req.write(soapBody);
      req.end();
    });
  }

  private buildDigestAuth(username: string, password: string): string {
    // Simplified — production nên dùng proper Digest auth library
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }
}
```

> **Note:** Milesight MS-C8241-X36PE support cả Basic và Digest auth trên ONVIF endpoint. MVP dùng Basic, upgrade Digest sau nếu cần.

## NestJS Cameras Module

**gateway-nest/src/cameras/cameras.controller.ts:**
```typescript
@Controller('cameras')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CamerasController {
  constructor(private readonly camerasSvc: CamerasService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.camerasSvc.findAll(user);
  }

  @Post()
  async create(@Body() dto: CreateCameraDto, @CurrentUser() user: JwtPayload) {
    // Auto-assign company_id từ JWT — operator không thể chỉ định company khác
    return this.camerasSvc.create({ ...dto, companyId: user.companyId ?? dto.companyId }, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.camerasSvc.findOne(id, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCameraDto, @CurrentUser() user: JwtPayload) {
    return this.camerasSvc.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.camerasSvc.remove(id, user);
  }
}
```

**gateway-nest/src/cameras/cameras.service.ts — create method:**
```typescript
async create(dto: CreateCameraDto & { companyId: string }, user: JwtPayload) {
  // Encrypt password trước khi save
  const passwordEncrypted = this.encryptionSvc.encrypt(dto.password);

  const camera = this.camerasRepo.create({
    ...dto,
    passwordEncrypted,
    status: 'pending',
  });

  const saved = await this.camerasRepo.save(camera);

  // Probe connection async (không block response)
  this.probeAndUpdateStatus(saved.id, dto.ip, dto.port, dto.username, dto.password);

  return this.toDto(saved);
}

private async probeAndUpdateStatus(cameraId: string, ip: string, port: number, username: string, password: string) {
  const result = await this.onvifProbe.probe(ip, port, username, password);
  await this.camerasRepo.update(cameraId, {
    status: result.success ? 'online' : 'offline',
  });
}

private toDto(camera: Camera): CameraResponseDto {
  const { passwordEncrypted, ...rest } = camera as any;
  return rest; // NEVER return passwordEncrypted
}
```

## DTOs

```typescript
// cameras/dto/create-camera.dto.ts
import { IsString, IsNotEmpty, IsIP, IsInt, Min, Max, IsOptional, MaxLength } from 'class-validator';

export class CreateCameraDto {
  @IsString() @IsNotEmpty() @MaxLength(255) name: string;
  @IsIP() ipAddress: string;
  @IsInt() @Min(1) @Max(65535) port: number;
  @IsString() @MaxLength(255) rtspPath: string;
  @IsString() @IsNotEmpty() username: string;
  @IsString() @IsNotEmpty() password: string;
  @IsOptional() @IsString() @MaxLength(255) location?: string;
  @IsOptional() @IsString() companyId?: string; // vendor_admin only
}
```

## Frontend Updates

**Files to update:**
- `frontend/app/(dashboard)/cameras/new/page.tsx` — submit tới `POST /api/cameras`
- `frontend/app/(dashboard)/cameras/page.tsx` — fetch từ `GET /api/cameras`
- `frontend/app/(dashboard)/cameras/[id]/overview/page.tsx` — fetch từ `GET /api/cameras/:id`

**api-client.ts additions:**
```typescript
cameras: {
  list: () => apiFetch<CameraDto[]>('/api/cameras'),
  get: (id: string) => apiFetch<CameraDto>(`/api/cameras/${id}`),
  create: (body: CreateCameraBody) =>
    apiFetch<CameraDto>('/api/cameras', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<CreateCameraBody>) =>
    apiFetch<CameraDto>(`/api/cameras/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) => apiFetch(`/api/cameras/${id}`, { method: 'DELETE' }),
}
```

**Connection probe UX:** Camera tạo với status "pending" ngay lập tức. FE poll `GET /api/cameras/:id` mỗi 2s trong 15s để check status thay đổi từ pending → online/offline.

> FE đã có `lib/use-poll.ts` — dùng hook này.

## Todo List

**Backend:**
- [ ] Tạo migration `1700000005-CreateCameras.ts`
- [ ] Tạo `src/cameras/camera.entity.ts`
- [ ] Tạo `src/common/services/encryption.service.ts` (AES-256-GCM)
- [ ] Tạo `src/cameras/onvif-probe.service.ts`
- [ ] Tạo `src/cameras/cameras.module.ts` + controller + service + DTOs
- [ ] Register EncryptionService trong AppModule
- [ ] Validate `CAMERA_ENCRYPTION_KEY` length khi startup

**Frontend:**
- [ ] Thêm `cameras` vào `api-client.ts`
- [ ] Update `cameras/page.tsx` — fetch from API
- [ ] Update `cameras/new/page.tsx` — submit tới API + show probe status
- [ ] Update `cameras/[id]/overview/page.tsx` — fetch real camera data
- [ ] Implement 15s polling sau create để show probe result

**Testing:**
- [ ] Test: tạo camera với IP không tồn tại → status "offline" sau 10s
- [ ] Test: tạo camera với sai credentials → error `wrong_credentials`
- [ ] Test: operator chỉ thấy cameras của company mình
- [ ] Test: `passwordEncrypted` không xuất hiện trong API response

## Success Criteria

- Tạo camera thành công → xuất hiện trong list với status "pending" → đổi "online/offline" sau probe
- Camera list chỉ trả cameras thuộc company của user
- Camera password không bao giờ xuất hiện trong response (chỉ `passwordEncrypted` trong DB)
- ONVIF probe trả kết quả trong 10 giây

## Security Considerations

- AES-256-GCM với random IV mỗi lần encrypt (không dùng ECB/CBC)
- `passwordEncrypted` không bao giờ return trong DTO (exclude trong transform)
- `siteKey` (UUID) cho Milesight push auth — không phải password nhưng phải treat như secret
- Validate `ipAddress` là IP hợp lệ (không phải hostname, không phải localhost) — prevent SSRF
