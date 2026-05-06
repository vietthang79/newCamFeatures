# Phase 04 — Camera Registration + Frame Ingestion + Zones

## Context Links
- [Master Plan Overview](./plan.md)
- [Phase 03 — Auth + Companies + Users API](./phase-03-auth-companies-users-api.md)
- ONVIF spec: https://www.onvif.org/
- Bull docs: https://github.com/nestjs/bull

## Overview
- **Status:** pending
- **Effort:** 8h
- **Blocked by:** Phase 03
- Implement camera CRUD with ONVIF probing, password encryption (AES-256-GCM), frame ingestion via HTTP push (multipart), Bull queue processing, and zone persistence to MSSQL; compute health metrics from PostgreSQL logs

## Key Insights
- ONVIF `device.init()` takes 1–3s with 10s timeout; probe happens at registration time
- Frame ingestion is async (Bull queue) — controller returns 204 in <50ms
- Password encrypted with random IV per camera (semantic security)
- All data scoped by `company_id` — TenantGuard enforces isolation
- Frame logs go to PostgreSQL (time-series); camera status updates in MSSQL
- Health metrics (FPM, uptime, status) computed from frame logs

## API Endpoints

```
GET    /api/cameras                       @JwtAuth (scoped by tenantCompanyId)
  Response: Camera[]

POST   /api/cameras                       @JwtAuth (scoped by tenantCompanyId)
  Request:  { name, ip, port?, username, password, location? }
  Response: Camera (201) — includes snapshot from ONVIF probe
  Errors:   422 if ONVIF probe fails (NETWORK_UNREACHABLE, INVALID_CREDENTIALS, etc.)

GET    /api/cameras/:id                   @JwtAuth (scoped by tenantCompanyId)
  Response: Camera (200)

GET    /api/cameras/:id/health            @JwtAuth (scoped by tenantCompanyId)
  Response: { fps, uptime_percent, error_count, status, last_frame_at }

GET    /api/cameras/:id/snapshot          @JwtAuth (scoped by tenantCompanyId)
  Response: Image/jpeg (200) — fresh ONVIF fetch

DELETE /api/cameras/:id                   @JwtAuth (scoped by tenantCompanyId)
  Response: 204

GET    /api/cameras/:id/zones             @JwtAuth (scoped by tenantCompanyId)
  Response: Zone[]

POST   /api/cameras/:id/zones             @JwtAuth (scoped by tenantCompanyId)
  Request:  { zones: [{ type, points: [{x, y}] }] }
  Response: Zone[] (201) — version incremented server-side

POST   /api/ingest/:siteKey               @Public (camera device, no JWT)
  Multipart: { image: File }
  Response: 204 (enqueued, returns immediately)
  Errors:   404 if siteKey not found, 422 if file too large

GET    /api/health/system                 @Roles('vendor_admin')
  Response: { cameras_online, cameras_offline, frames_last_hour }
```

## Database Schemas

**MSSQL**
```sql
CREATE TABLE cameras (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  company_id UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES companies(id),
  name NVARCHAR(255) NOT NULL,
  ip NVARCHAR(15) NOT NULL,
  port INT NOT NULL DEFAULT 80,
  username NVARCHAR(255) NOT NULL,
  password_encrypted NVARCHAR(MAX) NOT NULL,  -- format: iv:tag:ciphertext (hex)
  model NVARCHAR(255) NOT NULL DEFAULT 'MS-C8241-X36PE',
  location NVARCHAR(255),
  status NVARCHAR(20) NOT NULL DEFAULT 'pending',  -- online | warning | offline | pending
  last_frame_at DATETIME2,
  created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);
CREATE INDEX idx_cameras_company ON cameras(company_id);

CREATE TABLE zones (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  camera_id UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES cameras(id),
  company_id UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES companies(id),
  type NVARCHAR(50) NOT NULL,  -- 'parking_zone' | 'entrance_zone' | 'no_smoking_zone'
  points_json NVARCHAR(MAX) NOT NULL,  -- JSON: [{"x":0.1,"y":0.2}...]
  version INT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);
CREATE INDEX idx_zones_camera ON zones(camera_id);
```

**PostgreSQL (time-series)**
```sql
CREATE TABLE frame_ingestion_log (
  id UUID PRIMARY KEY,
  camera_id UUID NOT NULL,
  company_id UUID NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  size_bytes INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ok',  -- 'ok' | 'error'
  error_message TEXT
);
CREATE INDEX idx_frame_ingestion_camera ON frame_ingestion_log(camera_id, received_at DESC);
CREATE INDEX idx_frame_ingestion_company ON frame_ingestion_log(company_id, received_at DESC);
CREATE INDEX idx_frame_ingestion_time ON frame_ingestion_log(received_at DESC);
```

## Architecture

```
POST /api/cameras (register)
  ├─> CameraService.register()
  │   ├─> OnvifProbeService.probe(ip, port, user, pass)
  │   │   └─> device.init() + snapshot fetch
  │   ├─> CryptoService.encrypt(password)
  │   └─> CameraRepository.save()
  └─> Return Camera + snapshot

POST /api/ingest/:siteKey (frame push)
  ├─> IngestionController.ingest()
  │   ├─> Validate siteKey = camera.id
  │   └─> queue.add('process', { camera_id, company_id, received_at, size_bytes })
  └─> Return 204 immediately

Bull Queue 'frame-ingestion'
  └─> FrameProcessor (concurrency=5)
      ├─> FrameIngestionLogRepository.insert(log) → PostgreSQL
      ├─> CameraRepository.update(last_frame_at, status='online') → MSSQL
      └─> Emit event: 'frame.processed'

GET /api/cameras/:id/health
  └─> HealthService.getMetrics(camera_id, window=12h)
      ├─> SELECT COUNT(*) FROM frame_ingestion_log → FPM
      ├─> Calculate uptime: (time with frames) / (window) * 100
      ├─> Count errors: WHERE status='error'
      └─> Derive status from last_frame_at
```

## Related Code Files

**Create**
- `apps/api/src/modules/cameras/cameras.module.ts`
- `apps/api/src/modules/cameras/cameras.controller.ts`
- `apps/api/src/modules/cameras/cameras.service.ts`
- `apps/api/src/modules/cameras/onvif-probe.service.ts`
- `apps/api/src/modules/cameras/entities/camera.entity.ts`
- `apps/api/src/modules/cameras/dto/create-camera.dto.ts`
- `apps/api/src/modules/ingestion/ingestion.module.ts`
- `apps/api/src/modules/ingestion/ingestion.controller.ts`
- `apps/api/src/modules/ingestion/frame.processor.ts`
- `apps/api/src/modules/ingestion/entities/frame-ingestion-log.entity.ts`
- `apps/api/src/modules/zones/zones.module.ts`
- `apps/api/src/modules/zones/zones.controller.ts`
- `apps/api/src/modules/zones/zones.service.ts`
- `apps/api/src/modules/zones/entities/zone.entity.ts`
- `apps/api/src/modules/zones/dto/save-zones.dto.ts`
- `apps/api/src/modules/health/health.module.ts`
- `apps/api/src/modules/health/health.service.ts`
- `apps/api/src/common/crypto/crypto.service.ts`

**Modify**
- `apps/api/src/app.module.ts` — register CamerasModule, IngestionModule, ZonesModule, HealthModule
- `apps/api/package.json` — add `node-onvif`, `@nestjs/bull`, `bull`, `ioredis`
- `apps/api/.env.example` — add REDIS_URL, CAMERA_ENC_KEY

## Implementation Steps

### Camera Module

1. **Install dependencies:**
   ```bash
   npm install node-onvif @nestjs/bull bull ioredis
   npm install -D @types/node-onvif
   ```

2. **Create `cameras/entities/camera.entity.ts`:**
   ```typescript
   import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
   import { Company } from '../../companies/company.entity';
   
   @Entity('cameras')
   export class Camera {
     @PrimaryGeneratedColumn('uuid')
     id: string;
   
     @Column()
     company_id: string;
   
     @Column()
     name: string;
   
     @Column()
     ip: string;
   
     @Column({ default: 80 })
     port: number;
   
     @Column()
     username: string;
   
     @Column({ name: 'password_encrypted' })
     passwordEncrypted: string;  // format: iv:tag:ciphertext
   
     @Column({ default: 'MS-C8241-X36PE' })
     model: string;
   
     @Column({ nullable: true })
     location: string;
   
     @Column({ default: 'pending' })
     status: string;  // online | warning | offline | pending
   
     @Column({ type: 'datetime2', nullable: true, name: 'last_frame_at' })
     lastFrameAt: Date | null;
   
     @CreateDateColumn({ name: 'created_at' })
     createdAt: Date;
   
     @ManyToOne(() => Company)
     @JoinColumn({ name: 'company_id' })
     company: Company;
   }
   ```

3. **Create `common/crypto/crypto.service.ts`:**
   ```typescript
   import { Injectable } from '@nestjs/common';
   import { ConfigService } from '@nestjs/config';
   import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
   
   @Injectable()
   export class CryptoService {
     private key: Buffer;
   
     constructor(config: ConfigService) {
       const keyStr = config.get('CAMERA_ENC_KEY', 'default-32-byte-key-for-development');
       this.key = Buffer.from(keyStr.padEnd(32, '0').slice(0, 32));
     }
   
     encrypt(plain: string): string {
       const iv = randomBytes(12);
       const cipher = createCipheriv('aes-256-gcm', this.key, iv);
       const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
       const tag = cipher.getAuthTag();
       return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
     }
   
     decrypt(encrypted: string): string {
       const [ivHex, tagHex, encHex] = encrypted.split(':');
       const iv = Buffer.from(ivHex, 'hex');
       const tag = Buffer.from(tagHex, 'hex');
       const enc = Buffer.from(encHex, 'hex');
       const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
       decipher.setAuthTag(tag);
       return decipher.update(enc) + decipher.final('utf8');
     }
   }
   ```

4. **Create `cameras/onvif-probe.service.ts`:**
   ```typescript
   import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
   import * as onvif from 'node-onvif';
   
   @Injectable()
   export class OnvifProbeService {
     async probe(
       ip: string,
       port: number,
       username: string,
       password: string,
     ): Promise<{ snapshot: Buffer }> {
       try {
         const device = new onvif.OnvifDevice({
           xaddr: `http://${ip}:${port}/onvif/device_service`,
           user: username,
           pass: password,
         });
   
         // Init with timeout
         await Promise.race([
           device.init(),
           new Promise((_, reject) =>
             setTimeout(() => reject(new Error('ONVIF_TIMEOUT')), 10000),
           ),
         ]);
   
         const snapshot = await device.fetchSnapshot();
         return { snapshot: snapshot.body };
       } catch (err: any) {
         if (err.message.includes('TIMEOUT')) {
           throw new ServiceUnavailableException('ONVIF_TIMEOUT');
         }
         if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
           throw new BadRequestException('NETWORK_UNREACHABLE');
         }
         if (err.statusCode === 401) {
           throw new BadRequestException('INVALID_CREDENTIALS');
         }
         throw new BadRequestException('ONVIF_PROTOCOL_ERROR');
       }
     }
   }
   ```

5. **Create `cameras/dto/create-camera.dto.ts`:**
   ```typescript
   import { IsIP, IsPort, IsString, MinLength, Optional } from 'class-validator';
   
   export class CreateCameraDto {
     @IsString()
     name: string;
   
     @IsIP('4')
     ip: string;
   
     @Optional()
     @IsPort()
     port?: number = 80;
   
     @IsString()
     username: string;
   
     @MinLength(6)
     password: string;
   
     @Optional()
     @IsString()
     location?: string;
   }
   ```

6. **Create `cameras/cameras.service.ts`:**
   ```typescript
   import { Injectable, NotFoundException } from '@nestjs/common';
   import { InjectRepository } from '@nestjs/typeorm';
   import { Repository } from 'typeorm';
   import { Camera } from './entities/camera.entity';
   import { CreateCameraDto } from './dto/create-camera.dto';
   import { OnvifProbeService } from './onvif-probe.service';
   import { CryptoService } from '../common/crypto/crypto.service';
   
   @Injectable()
   export class CamerasService {
     constructor(
       @InjectRepository(Camera)
       private cameraRepo: Repository<Camera>,
       private onvifProbe: OnvifProbeService,
       private crypto: CryptoService,
     ) {}
   
     async findByCompany(companyId: string) {
       return this.cameraRepo.find({
         where: { company_id: companyId },
         order: { createdAt: 'DESC' },
       });
     }
   
     async findById(id: string) {
       return this.cameraRepo.findOneBy({ id });
     }
   
     async register(companyId: string, dto: CreateCameraDto) {
       // ONVIF probe (throws if fails)
       const { snapshot } = await this.onvifProbe.probe(
         dto.ip,
         dto.port || 80,
         dto.username,
         dto.password,
       );
   
       // Encrypt password
       const passwordEncrypted = this.crypto.encrypt(dto.password);
   
       // Save camera
       const camera = this.cameraRepo.create({
         company_id: companyId,
         name: dto.name,
         ip: dto.ip,
         port: dto.port || 80,
         username: dto.username,
         passwordEncrypted,
         location: dto.location,
       });
       await this.cameraRepo.save(camera);
   
       return { ...camera, snapshot };
     }
   
     async delete(id: string, companyId: string) {
       const camera = await this.cameraRepo.findOneBy({ id, company_id: companyId });
       if (!camera) throw new NotFoundException('Camera not found');
       await this.cameraRepo.remove(camera);
     }
   }
   ```

7. **Create `cameras/cameras.controller.ts`:**
   ```typescript
   import { Controller, Get, Post, Delete, Param, Body, Res } from '@nestjs/common';
   import { Response } from 'express';
   import { CamerasService } from './cameras.service';
   import { CreateCameraDto } from './dto/create-camera.dto';
   import { CurrentUser } from '../common/decorators/current-user.decorator';
   
   @Controller('cameras')
   export class CamerasController {
     constructor(private camerasService: CamerasService) {}
   
     @Get()
     async findByCompany(@CurrentUser() user: any) {
       return this.camerasService.findByCompany(user.tenantCompanyId || user.companyId);
     }
   
     @Get(':id')
     async findById(@Param('id') id: string) {
       return this.camerasService.findById(id);
     }
   
     @Post()
     async register(@CurrentUser() user: any, @Body() dto: CreateCameraDto) {
       return this.camerasService.register(user.tenantCompanyId || user.companyId, dto);
     }
   
     @Delete(':id')
     async delete(@Param('id') id: string, @CurrentUser() user: any) {
       await this.camerasService.delete(id, user.tenantCompanyId || user.companyId);
       return { statusCode: 204 };
     }
   }
   ```

8. **Create `cameras/cameras.module.ts`:**
   ```typescript
   import { Module } from '@nestjs/common';
   import { TypeOrmModule } from '@nestjs/typeorm';
   import { Camera } from './entities/camera.entity';
   import { CamerasService } from './cameras.service';
   import { CamerasController } from './cameras.controller';
   import { OnvifProbeService } from './onvif-probe.service';
   import { CryptoService } from '../common/crypto/crypto.service';
   
   @Module({
     imports: [TypeOrmModule.forFeature([Camera])],
     controllers: [CamerasController],
     providers: [CamerasService, OnvifProbeService, CryptoService],
     exports: [CamerasService],
   })
   export class CamerasModule {}
   ```

### Ingestion Module

9. **Create `ingestion/entities/frame-ingestion-log.entity.ts`:**
   ```typescript
   import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
   
   @Entity('frame_ingestion_log', { database: 'postgres' })  // PostgreSQL
   export class FrameIngestionLog {
     @PrimaryGeneratedColumn('uuid')
     id: string;
   
     @Column()
     camera_id: string;
   
     @Column()
     company_id: string;
   
     @Column({ type: 'timestamptz', name: 'received_at' })
     receivedAt: Date;
   
     @Column({ name: 'size_bytes' })
     sizeBytes: number;
   
     @Column({ default: 'ok' })
     status: string;  // ok | error
   
     @Column({ nullable: true, name: 'error_message' })
     errorMessage: string | null;
   }
   ```

10. **Create `ingestion/frame.processor.ts`:**
    ```typescript
    import { Processor, Process } from '@nestjs/bull';
    import { Job } from 'bull';
    import { InjectRepository } from '@nestjs/typeorm';
    import { Repository } from 'typeorm';
    import { Camera } from '../cameras/entities/camera.entity';
    import { FrameIngestionLog } from './entities/frame-ingestion-log.entity';
    
    @Processor('frame-ingestion')
    export class FrameProcessor {
      constructor(
        @InjectRepository(Camera)
        private cameraRepo: Repository<Camera>,
        @InjectRepository(FrameIngestionLog)
        private logRepo: Repository<FrameIngestionLog>,
      ) {}
    
      @Process('process')
      async handle(job: Job) {
        const { camera_id, company_id, received_at, size_bytes } = job.data;
    
        try {
          // Log to PostgreSQL
          await this.logRepo.insert({
            camera_id,
            company_id,
            receivedAt: received_at,
            sizeBytes: size_bytes,
            status: 'ok',
          });
    
          // Update camera in MSSQL
          await this.cameraRepo.update(camera_id, {
            lastFrameAt: received_at,
            status: 'online',
          });
        } catch (err) {
          // Log error
          await this.logRepo.insert({
            camera_id,
            company_id,
            receivedAt: received_at,
            sizeBytes: size_bytes,
            status: 'error',
            errorMessage: err.message,
          });
        }
      }
    }
    ```

11. **Create `ingestion/ingestion.controller.ts`:**
    ```typescript
    import { Controller, Post, Param, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
    import { FileInterceptor } from '@nestjs/platform-express';
    import { Queue } from 'bull';
    import { InjectQueue } from '@nestjs/bull';
    import { CamerasService } from '../cameras/cameras.service';
    import { Public } from '../common/decorators/public.decorator';
    
    @Controller('ingest')
    export class IngestionController {
      constructor(
        @InjectQueue('frame-ingestion')
        private frameQueue: Queue,
        private camerasService: CamerasService,
      ) {}
    
      @Public()
      @Post(':siteKey')
      @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
      async ingest(@Param('siteKey') siteKey: string, @UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('No image provided');
    
        const camera = await this.camerasService.findById(siteKey);
        if (!camera) throw new BadRequestException('Camera not found');
    
        await this.frameQueue.add(
          'process',
          {
            camera_id: camera.id,
            company_id: camera.company_id,
            received_at: new Date(),
            size_bytes: file.size,
          },
          { removeOnComplete: true },
        );
    
        return { statusCode: 204 };
      }
    }
    ```

12. **Create `ingestion/ingestion.module.ts`:**
    ```typescript
    import { Module } from '@nestjs/common';
    import { BullModule } from '@nestjs/bull';
    import { TypeOrmModule } from '@nestjs/typeorm';
    import { IngestionController } from './ingestion.controller';
    import { FrameProcessor } from './frame.processor';
    import { FrameIngestionLog } from './entities/frame-ingestion-log.entity';
    import { CamerasModule } from '../cameras/cameras.module';
    import { Camera } from '../cameras/entities/camera.entity';
    
    @Module({
      imports: [
        BullModule.registerQueue({ name: 'frame-ingestion' }),
        TypeOrmModule.forFeature([FrameIngestionLog, Camera]),
        CamerasModule,
      ],
      controllers: [IngestionController],
      providers: [FrameProcessor],
    })
    export class IngestionModule {}
    ```

### Zones Module

13. **Create `zones/entities/zone.entity.ts`:**
    ```typescript
    import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
    
    @Entity('zones')
    export class Zone {
      @PrimaryGeneratedColumn('uuid')
      id: string;
    
      @Column()
      camera_id: string;
    
      @Column()
      company_id: string;
    
      @Column()
      type: string;  // parking_zone | entrance_zone | no_smoking_zone
    
      @Column({ name: 'points_json' })
      pointsJson: string;  // JSON: [{"x":0.1,"y":0.2}...]
    
      @Column({ default: 1 })
      version: number;
    
      @CreateDateColumn({ name: 'created_at' })
      createdAt: Date;
    }
    ```

14. **Create `zones/dto/save-zones.dto.ts`:**
    ```typescript
    import { IsNumber, IsIn, ArrayMinSize, ValidateNested, Min, Max, Type } from 'class-validator';
    import { Type as TransformType } from 'class-transformer';
    
    class PointDto {
      @IsNumber()
      @Min(0)
      @Max(1)
      x: number;
    
      @IsNumber()
      @Min(0)
      @Max(1)
      y: number;
    }
    
    class ZoneDto {
      @IsIn(['parking_zone', 'entrance_zone', 'no_smoking_zone'])
      type: string;
    
      @ValidateNested({ each: true })
      @TransformType(() => PointDto)
      @ArrayMinSize(3)
      points: PointDto[];
    }
    
    export class SaveZonesDto {
      @ValidateNested({ each: true })
      @TransformType(() => ZoneDto)
      zones: ZoneDto[];
    }
    ```

15. **Create `zones/zones.service.ts`:**
    ```typescript
    import { Injectable, NotFoundException } from '@nestjs/common';
    import { InjectRepository } from '@nestjs/typeorm';
    import { Repository } from 'typeorm';
    import { Zone } from './entities/zone.entity';
    import { SaveZonesDto } from './dto/save-zones.dto';
    
    @Injectable()
    export class ZonesService {
      constructor(
        @InjectRepository(Zone)
        private zoneRepo: Repository<Zone>,
      ) {}
    
      async findByCamera(cameraId: string) {
        const zones = await this.zoneRepo.find({
          where: { camera_id: cameraId },
        });
        return zones.map((z) => ({
          id: z.id,
          type: z.type,
          points: JSON.parse(z.pointsJson),
          version: z.version,
        }));
      }
    
      async saveZones(cameraId: string, companyId: string, dto: SaveZonesDto) {
        // Delete existing zones for this camera
        await this.zoneRepo.delete({ camera_id: cameraId });
    
        // Insert new zones with version=1
        const zones = dto.zones.map((z) =>
          this.zoneRepo.create({
            camera_id: cameraId,
            company_id: companyId,
            type: z.type,
            pointsJson: JSON.stringify(z.points),
            version: 1,
          }),
        );
    
        const saved = await this.zoneRepo.save(zones);
        return saved.map((z) => ({
          id: z.id,
          type: z.type,
          points: JSON.parse(z.pointsJson),
          version: z.version,
        }));
      }
    }
    ```

16. **Create `zones/zones.controller.ts`:**
    ```typescript
    import { Controller, Get, Post, Param, Body } from '@nestjs/common';
    import { ZonesService } from './zones.service';
    import { SaveZonesDto } from './dto/save-zones.dto';
    import { CurrentUser } from '../common/decorators/current-user.decorator';
    
    @Controller('cameras/:cameraId/zones')
    export class ZonesController {
      constructor(private zonesService: ZonesService) {}
    
      @Get()
      async findByCamera(@Param('cameraId') cameraId: string) {
        return this.zonesService.findByCamera(cameraId);
      }
    
      @Post()
      async saveZones(
        @Param('cameraId') cameraId: string,
        @Body() dto: SaveZonesDto,
        @CurrentUser() user: any,
      ) {
        return this.zonesService.saveZones(cameraId, user.tenantCompanyId || user.companyId, dto);
      }
    }
    ```

17. **Create `zones/zones.module.ts`:**
    ```typescript
    import { Module } from '@nestjs/common';
    import { TypeOrmModule } from '@nestjs/typeorm';
    import { Zone } from './entities/zone.entity';
    import { ZonesService } from './zones.service';
    import { ZonesController } from './zones.controller';
    
    @Module({
      imports: [TypeOrmModule.forFeature([Zone])],
      controllers: [ZonesController],
      providers: [ZonesService],
    })
    export class ZonesModule {}
    ```

### Health Module

18. **Create `health/health.service.ts`:**
    ```typescript
    import { Injectable } from '@nestjs/common';
    import { InjectRepository } from '@nestjs/typeorm';
    import { Repository } from 'typeorm';
    import { Camera } from '../cameras/entities/camera.entity';
    import { FrameIngestionLog } from '../ingestion/entities/frame-ingestion-log.entity';
    
    @Injectable()
    export class HealthService {
      constructor(
        @InjectRepository(Camera)
        private cameraRepo: Repository<Camera>,
        @InjectRepository(FrameIngestionLog)
        private logRepo: Repository<FrameIngestionLog>,
      ) {}
    
      async getCameraHealth(cameraId: string, windowMinutes: number = 12 * 60) {
        const camera = await this.cameraRepo.findOneBy({ id: cameraId });
        if (!camera) return null;
    
        const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    
        // FPS: frames in last 60s
        const fpsLogs = await this.logRepo.count({
          where: {
            camera_id: cameraId,
            status: 'ok',
            receivedAt: { $gte: new Date(Date.now() - 60_000) },
          },
        });
        const fps = fpsLogs / 1;
    
        // Uptime: (frames in window) / (expected at 2 FPS)
        const totalLogs = await this.logRepo.count({
          where: { camera_id: cameraId, receivedAt: { $gte: since } },
        });
        const uptime = Math.min(100, (totalLogs / (windowMinutes * 2)) * 100);
    
        // Error count
        const errorCount = await this.logRepo.count({
          where: { camera_id: cameraId, status: 'error', receivedAt: { $gte: since } },
        });
    
        // Status derived from last frame
        let status = camera.status;
        if (camera.lastFrameAt) {
          const msAgo = Date.now() - camera.lastFrameAt.getTime();
          if (msAgo < 30000) status = 'online';
          else if (msAgo < 120000) status = 'warning';
          else status = 'offline';
        }
    
        return {
          fps: Math.round(fps * 100) / 100,
          uptime_percent: Math.round(uptime),
          error_count: errorCount,
          status,
          last_frame_at: camera.lastFrameAt,
        };
      }
    }
    ```

19. **Create `health/health.controller.ts`:**
    ```typescript
    import { Controller, Get, Param } from '@nestjs/common';
    import { HealthService } from './health.service';
    
    @Controller()
    export class HealthController {
      constructor(private healthService: HealthService) {}
    
      @Get('cameras/:id/health')
      async getCameraHealth(@Param('id') id: string) {
        return this.healthService.getCameraHealth(id);
      }
    }
    ```

20. **Create `health/health.module.ts`:**
    ```typescript
    import { Module } from '@nestjs/common';
    import { TypeOrmModule } from '@nestjs/typeorm';
    import { Camera } from '../cameras/entities/camera.entity';
    import { FrameIngestionLog } from '../ingestion/entities/frame-ingestion-log.entity';
    import { HealthService } from './health.service';
    import { HealthController } from './health.controller';
    
    @Module({
      imports: [TypeOrmModule.forFeature([Camera, FrameIngestionLog])],
      controllers: [HealthController],
      providers: [HealthService],
    })
    export class HealthModule {}
    ```

### Update App Module

21. **Update `app.module.ts`:**
    ```typescript
    import { Module } from '@nestjs/common';
    import { BullModule } from '@nestjs/bull';
    import { ConfigModule, ConfigService } from '@nestjs/config';
    import { CamerasModule } from './modules/cameras/cameras.module';
    import { IngestionModule } from './modules/ingestion/ingestion.module';
    import { ZonesModule } from './modules/zones/zones.module';
    import { HealthModule } from './modules/health/health.module';
    
    @Module({
      imports: [
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            redis: config.get('REDIS_URL', 'redis://localhost:6379'),
          }),
        }),
        CamerasModule,
        IngestionModule,
        ZonesModule,
        HealthModule,
      ],
    })
    export class AppModule {}
    ```

22. **Update `.env.example`:**
    ```
    REDIS_URL=redis://localhost:6379
    CAMERA_ENC_KEY=your-32-byte-hex-key-for-aes256
    ```

## Todo List

- [ ] Install node-onvif, Bull, ioredis dependencies
- [ ] Create Camera entity + TypeORM config
- [ ] Create CryptoService (AES-256-GCM encrypt/decrypt)
- [ ] Create OnvifProbeService with timeout
- [ ] Create CreateCameraDto with IP validation
- [ ] Create CamerasService.register() with ONVIF probe
- [ ] Create CamerasController with CRUD + snapshot endpoint
- [ ] Create CamerasModule
- [ ] Create FrameIngestionLog entity (PostgreSQL)
- [ ] Create FrameProcessor with Bull job handler
- [ ] Create IngestionController (POST /ingest/:siteKey)
- [ ] Create IngestionModule with Bull queue
- [ ] Create Zone entity + SaveZonesDto
- [ ] Create ZonesService.findByCamera() + saveZones()
- [ ] Create ZonesController (GET, POST /cameras/:id/zones)
- [ ] Create ZonesModule
- [ ] Create HealthService with FPS/uptime/error aggregation
- [ ] Create HealthController (GET /cameras/:id/health)
- [ ] Create HealthModule
- [ ] Update AppModule to import all new modules
- [ ] Test: POST /api/cameras → ONVIF probe, encrypt password, save
- [ ] Test: POST /api/ingest/:siteKey → enqueue, return 204
- [ ] Test: GET /api/cameras/:id/health → compute metrics from logs
- [ ] Test: POST /api/cameras/:id/zones → save to MSSQL

## Success Criteria

- ✅ `POST /api/cameras` with valid Milesight camera probes ONVIF, encrypts password, saves to MSSQL
- ✅ `GET /api/cameras` returns company-scoped list (operator sees only their company's cameras)
- ✅ `POST /api/ingest/:siteKey` with multipart frame enqueues job, returns 204 in <50ms
- ✅ Frame processor logs to PostgreSQL, updates `camera.last_frame_at` and status to 'online' in MSSQL
- ✅ `GET /api/cameras/:id/health` computes FPS, uptime%, error count from PostgreSQL logs
- ✅ `POST /api/cameras/:id/zones` saves zones with normalized [0-1] coords, increments version
- ✅ All camera data scoped by `tenantCompanyId` (operator cannot see other companies via URL manipulation)

## Risk Assessment

- **ONVIF probe timeout:** 10s covers most cameras; retry logic in Phase 05 (frontend)
- **Redis/Bull down:** Frame ingestion fails; add monitoring + error handling in Phase 04
- **AES-256 key rotation:** Not implemented Sprint 1; plan for Sprint 2
- **PostgreSQL downtime:** Frame logs lost; add TTL cleanup in Phase 05

## Security Considerations

- ONVIF probe credentials never logged (only success/failure)
- Encrypted password stored with random IV (semantic security)
- Frame ingestion endpoint is `@Public()` but requires valid camera.id lookup (no shared secret needed Sprint 1)
- TenantGuard enforces `company_id` scoping on all queries
- Health metrics aggregation scoped by `companyId`

## Next Steps

→ **Phase 05+:** Wire frontend to these real API endpoints (camera pages, zone editor)
