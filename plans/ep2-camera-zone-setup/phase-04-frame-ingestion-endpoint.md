# Phase 04 — Frame Ingestion Endpoint

**Status:** ⏳ Pending  
**Priority:** 🔴 Critical  
**Effort:** ~5 hours  
**Depends on:** Phase 01 (cameras.site_key exists), Sprint 0 Phase 05 (PostgreSQL + TimescaleDB migrations)

## Overview

NestJS endpoint nhận HTTP push từ Milesight camera. Lưu frame metadata vào PostgreSQL + TimescaleDB. Update Redis real-time state. Đây là endpoint camera kết nối, **không phải** FE gọi.

## Data Flow

```
Milesight Camera
  │
  │ POST https://api.intelli-park.com/api/ingestion/frames
  │ Headers:
  │   Authorization: Bearer <site_key>
  │   Content-Type: multipart/form-data
  │ Body:
  │   image=<JPEG binary>
  │   timestamp=2024-01-15T10:30:00Z
  │   camera_id=<site_key>   (Milesight "Trigger Channel" field)
  │
  ▼
NestJS IngestionController
  ├── 1. Validate Bearer token → lookup camera by site_key
  ├── 2. Verify camera.company_id exists (tenant check)
  ├── 3. Write to PostgreSQL frame_ingestion_log (TimescaleDB hypertable)
  ├── 4. Update Redis: SET camera:<id>:last_frame_at = now() (EX 600)
  ├── 5. Return 200 OK immediately (async processing)
  └── 6. (Optional) Emit event to AI worker queue
```

## PostgreSQL Schema (TimescaleDB)

**ai-workers/alembic/versions/0001_create_frame_ingestion_log.py:**
```python
from alembic import op
import sqlalchemy as sa
from datetime import datetime

def upgrade():
    # Enable TimescaleDB extension
    op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE")

    op.create_table(
        'frame_ingestion_log',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('camera_id', sa.String(36), nullable=False),    # UUID string
        sa.Column('company_id', sa.String(36), nullable=False),   # denormalized
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('frame_size_bytes', sa.Integer(), nullable=True),
        sa.Column('processing_status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('error_message', sa.Text(), nullable=True),
    )

    # Primary key
    op.execute("ALTER TABLE frame_ingestion_log ADD PRIMARY KEY (id, received_at)")

    # Convert to TimescaleDB hypertable (partitioned by received_at)
    op.execute("""
        SELECT create_hypertable(
            'frame_ingestion_log',
            'received_at',
            chunk_time_interval => INTERVAL '1 day'
        )
    """)

    # Index for camera queries
    op.create_index('ix_frame_log_camera_id', 'frame_ingestion_log', ['camera_id', 'received_at'])
    op.create_index('ix_frame_log_company_id', 'frame_ingestion_log', ['company_id', 'received_at'])

def downgrade():
    op.drop_table('frame_ingestion_log')
```

**alerts table:**
```python
# 0002_create_alerts.py
def upgrade():
    op.create_table(
        'alerts',
        sa.Column('id', sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column('camera_id', sa.String(36), nullable=False),
        sa.Column('company_id', sa.String(36), nullable=False),
        sa.Column('alert_type', sa.String(50), nullable=False),  # 'no_frame', 'ai_detection', etc.
        sa.Column('severity', sa.String(20), nullable=False, server_default='warning'),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_alerts_camera_id', 'alerts', ['camera_id', 'created_at'])
    op.create_index('ix_alerts_company_id', 'alerts', ['company_id', 'created_at'])
```

## NestJS Ingestion Module

**gateway-nest/src/ingestion/ingestion.module.ts** — new module

**gateway-nest/src/ingestion/ingestion.controller.ts:**
```typescript
import { Controller, Post, Headers, Body, UseInterceptors,
         UploadedFile, HttpCode } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionSvc: IngestionService) {}

  @Post('frames')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per frame
  }))
  async receiveFrame(
    @Headers('authorization') authHeader: string,
    @UploadedFile() image: Express.Multer.File,
    @Body('timestamp') timestamp?: string,
  ) {
    // Extract Bearer token
    const siteKey = authHeader?.replace('Bearer ', '').trim();
    if (!siteKey) return { status: 'error', message: 'Missing authorization' };

    await this.ingestionSvc.processFrame({
      siteKey,
      imageBuffer: image?.buffer,
      imageSizeBytes: image?.size,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    return { status: 'ok' };
  }
}
```

**gateway-nest/src/ingestion/ingestion.service.ts:**
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@liaoliaots/nestjs-redis'; // or ioredis
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectRepository(Camera) private camerasRepo: Repository<Camera>,
    @InjectRedis() private redis: Redis,
    private dataSource: DataSource,
  ) {}

  async processFrame(input: { siteKey: string; imageBuffer?: Buffer; imageSizeBytes?: number; timestamp: Date }) {
    // 1. Lookup camera by site_key (auth)
    const camera = await this.camerasRepo.findOne({
      where: { siteKey: input.siteKey, status: 'online' },  // offline cameras ignored
    });

    if (!camera) {
      this.logger.warn(`Unknown site_key: ${input.siteKey}`);
      return; // silently ignore — don't expose whether key exists
    }

    // 2. Write to PostgreSQL (via raw query — TypeORM doesn't manage TimescaleDB tables)
    await this.dataSource.query(`
      INSERT INTO frame_ingestion_log (camera_id, company_id, received_at, frame_size_bytes, processing_status)
      VALUES ($1, $2, $3, $4, 'pending')
    `, [camera.id, camera.companyId, input.timestamp, input.imageSizeBytes ?? 0]);

    // 3. Update Redis real-time state (TTL 10 minutes)
    const pipe = this.redis.pipeline();
    pipe.set(`camera:${camera.id}:last_frame_at`, input.timestamp.toISOString(), 'EX', 600);
    pipe.incr(`camera:${camera.id}:frames_today`);
    await pipe.exec();

    // 4. Update camera status to 'online' if it was 'offline'
    if (camera.status !== 'online') {
      await this.camerasRepo.update(camera.id, { status: 'online' });
    }

    // 5. TODO: emit to AI worker queue (scope of AI sprint)
  }
}
```

## Redis Key Design

```
camera:<uuid>:last_frame_at    → ISO timestamp string, EX 600s
camera:<uuid>:frames_today     → integer counter (reset daily via cron or check date)
camera:<uuid>:status           → 'online' | 'offline' (optional, can derive from last_frame_at)
```

## Camera Health API (for FE)

**gateway-nest/src/cameras/cameras.controller.ts — add endpoint:**
```typescript
@Get(':id/health')
@UseGuards(JwtAuthGuard, TenantGuard)
async getHealth(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
  return this.camerasSvc.getHealth(id, user);
}
```

**cameras.service.ts — getHealth method:**
```typescript
async getHealth(cameraId: string, user: JwtPayload) {
  // Get last_frame_at from Redis
  const lastFrameAt = await this.redis.get(`camera:${cameraId}:last_frame_at`);

  // Get error count from PostgreSQL (last 24h)
  const [{ count }] = await this.pgDataSource.query(`
    SELECT COUNT(*) as count
    FROM frame_ingestion_log
    WHERE camera_id = $1
      AND processing_status = 'error'
      AND received_at > NOW() - INTERVAL '24 hours'
  `, [cameraId]);

  // Get frames per minute (last 5 min)
  const [{ fps }] = await this.pgDataSource.query(`
    SELECT COUNT(*) / 5.0 as fps
    FROM frame_ingestion_log
    WHERE camera_id = $1
      AND received_at > NOW() - INTERVAL '5 minutes'
  `, [cameraId]);

  return {
    cameraId,
    lastFrameAt,
    framesPerMinute: parseFloat(fps ?? '0'),
    errorCount24h: parseInt(count ?? '0'),
    status: this.calculateStatus(lastFrameAt),
  };
}

private calculateStatus(lastFrameAt: string | null): 'online' | 'warning' | 'offline' {
  if (!lastFrameAt) return 'offline';
  const secondsAgo = (Date.now() - new Date(lastFrameAt).getTime()) / 1000;
  if (secondsAgo < 60) return 'online';
  if (secondsAgo < 300) return 'warning';
  return 'offline';
}
```

## PostgreSQL DataSource in NestJS

NestJS cần kết nối thêm PostgreSQL cho ingestion và health queries:

```typescript
// app.module.ts — thêm second DataSource
TypeOrmModule.forRootAsync({
  name: 'postgres',  // named connection
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    host: config.get('database.postgres.host'),
    port: config.get('database.postgres.port'),
    username: config.get('database.postgres.username'),
    password: config.get('database.postgres.password'),
    database: config.get('database.postgres.database'),
    entities: [], // TimescaleDB tables managed by Alembic, not TypeORM entities
    synchronize: false,
  }),
  inject: [ConfigService],
})
```

## Dependencies to Add

```bash
# gateway-nest/
npm install @nestjs/platform-express multer @liaoliaots/nestjs-redis ioredis pg
npm install @types/multer @types/ioredis --save-dev
```

## Todo List

**Database migrations:**
- [ ] Tạo Alembic migration `0001_create_frame_ingestion_log.py` (TimescaleDB hypertable)
- [ ] Tạo Alembic migration `0002_create_alerts.py`
- [ ] Test: `make migrate-postgres` — tạo tables và hypertable

**Backend:**
- [ ] Cài dependencies: multer, ioredis, pg
- [ ] Thêm PostgreSQL second DataSource vào AppModule
- [ ] Setup Redis module (`@liaoliaots/nestjs-redis`)
- [ ] Tạo `src/ingestion/ingestion.module.ts` + controller + service
- [ ] Implement `POST /api/ingestion/frames` với site_key auth
- [ ] Implement `GET /api/cameras/:id/health` với Redis + PostgreSQL queries

**Testing:**
- [ ] Test: POST /api/ingestion/frames với valid site_key → 200, row in PostgreSQL
- [ ] Test: POST với invalid site_key → silently 200 (không expose key existence)
- [ ] Test: GET /api/cameras/:id/health → trả lastFrameAt từ Redis
- [ ] Test: health status = 'online' khi frame < 60s ago

## Success Criteria

- Milesight camera POST `/api/ingestion/frames` → 200 OK trong < 200ms
- Frame được ghi vào PostgreSQL `frame_ingestion_log`
- Redis `camera:<id>:last_frame_at` được update
- `GET /api/cameras/:id/health` trả đúng status dựa trên `last_frame_at`
- Setup instructions page phát hiện frame arrival sau khi ingestion hoạt động

## Security Considerations

- Ingestion endpoint validate Bearer token = site_key (không phải JWT user token)
- Không expose thông tin về key validity (trả 200 ngay cả khi key không tồn tại — prevent enumeration)
- File size limit 5MB per frame (prevent DoS)
- Rate limiting tại Nginx: riêng `/api/ingestion/` với rate cao hơn normal API (cameras push 2 FPS)
