# Phase 05 — Admin Health Dashboard

**Status:** ⏳ Pending  
**Priority:** 🟡 High  
**Effort:** ~4 hours  
**Depends on:** Phase 04 (frame_ingestion_log và Redis có data)

## Overview

Wire admin health dashboard (`/admin/health`) tới real data từ PostgreSQL + Redis. FE UI đã có — chỉ cần API backend và replace mock data.

## Acceptance Criteria

- Internal-only page `/admin/health` (vendor_admin role required)
- Bảng mỗi company: total cameras, frames per minute, last frame received, error count (24h)
- Expand company row → per-camera health
- Health badge: 🟢 green (< 60s ago), 🟡 yellow (< 5min), 🔴 red (older/never)
- Summary top: total frames today, total alerts today
- Auto-refresh mỗi 30 giây

## API Contract

**GET `/api/admin/health`** — vendor_admin only

Response:
```json
{
  "summary": {
    "totalFramesToday": 145200,
    "totalAlertsToday": 3
  },
  "companies": [
    {
      "id": "uuid",
      "name": "UK Parking Control",
      "totalCameras": 4,
      "onlineCameras": 3,
      "framesPerMinute": 8.5,
      "lastFrameAt": "2024-01-15T10:30:00Z",
      "errorCount24h": 1,
      "cameras": [
        {
          "id": "uuid",
          "name": "Front Lot Cam",
          "status": "online",
          "framesPerMinute": 2.1,
          "lastFrameAt": "2024-01-15T10:30:05Z",
          "errorCount24h": 0
        }
      ]
    }
  ]
}
```

## Backend Implementation

**gateway-nest/src/admin/admin-health.service.ts:**
```typescript
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';

@Injectable()
export class AdminHealthService {
  constructor(
    private mssqlDataSource: DataSource,          // main DataSource
    @InjectConnection('postgres') private pgDataSource: DataSource,
    @InjectRedis() private redis: Redis,
  ) {}

  async getSystemHealth() {
    const [companies, camerasWithHealth, summary] = await Promise.all([
      this.getCompanies(),
      this.getCamerasWithHealth(),
      this.getSummary(),
    ]);

    // Group cameras by company
    const companiesWithHealth = companies.map(company => {
      const companyCameras = camerasWithHealth.filter(c => c.companyId === company.id);
      return {
        id: company.id,
        name: company.name,
        totalCameras: companyCameras.length,
        onlineCameras: companyCameras.filter(c => c.status === 'online').length,
        framesPerMinute: companyCameras.reduce((sum, c) => sum + c.framesPerMinute, 0),
        lastFrameAt: this.getLatest(companyCameras.map(c => c.lastFrameAt)),
        errorCount24h: companyCameras.reduce((sum, c) => sum + c.errorCount24h, 0),
        cameras: companyCameras,
      };
    });

    return { summary, companies: companiesWithHealth };
  }

  private async getCamerasWithHealth() {
    // 1. Get all cameras from MSSQL
    const cameras = await this.mssqlDataSource.query(`
      SELECT id, company_id as companyId, name, status FROM cameras
    `);

    // 2. Get Redis data for all cameras in batch
    const pipeline = this.redis.pipeline();
    cameras.forEach(cam => pipeline.get(`camera:${cam.id}:last_frame_at`));
    const redisResults = await pipeline.exec();

    // 3. Get error counts from PostgreSQL (single query for all cameras)
    const errorCounts = await this.pgDataSource.query(`
      SELECT camera_id, COUNT(*) as error_count
      FROM frame_ingestion_log
      WHERE processing_status = 'error'
        AND received_at > NOW() - INTERVAL '24 hours'
      GROUP BY camera_id
    `);

    // 4. Get FPS per camera (last 5 minutes)
    const fpsCounts = await this.pgDataSource.query(`
      SELECT camera_id, COUNT(*) / 5.0 as fps
      FROM frame_ingestion_log
      WHERE received_at > NOW() - INTERVAL '5 minutes'
      GROUP BY camera_id
    `);

    const errorMap = Object.fromEntries(errorCounts.map(r => [r.camera_id, parseInt(r.error_count)]));
    const fpsMap = Object.fromEntries(fpsCounts.map(r => [r.camera_id, parseFloat(r.fps)]));

    return cameras.map((cam, i) => {
      const lastFrameAt = redisResults[i]?.[1] as string | null;
      return {
        id: cam.id,
        companyId: cam.companyId,
        name: cam.name,
        status: this.calculateStatus(lastFrameAt),
        lastFrameAt,
        framesPerMinute: fpsMap[cam.id] ?? 0,
        errorCount24h: errorMap[cam.id] ?? 0,
      };
    });
  }

  private async getSummary() {
    const [framesResult, alertsResult] = await Promise.all([
      this.pgDataSource.query(`
        SELECT COUNT(*) as total
        FROM frame_ingestion_log
        WHERE received_at > NOW() - INTERVAL '24 hours'
      `),
      this.pgDataSource.query(`
        SELECT COUNT(*) as total
        FROM alerts
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `),
    ]);

    return {
      totalFramesToday: parseInt(framesResult[0]?.total ?? '0'),
      totalAlertsToday: parseInt(alertsResult[0]?.total ?? '0'),
    };
  }

  private calculateStatus(lastFrameAt: string | null): 'online' | 'warning' | 'offline' {
    if (!lastFrameAt) return 'offline';
    const secondsAgo = (Date.now() - new Date(lastFrameAt).getTime()) / 1000;
    if (secondsAgo < 60) return 'online';
    if (secondsAgo < 300) return 'warning';
    return 'offline';
  }

  private getLatest(timestamps: (string | null)[]): string | null {
    const valid = timestamps.filter(Boolean) as string[];
    if (!valid.length) return null;
    return valid.sort().at(-1) ?? null;
  }
}
```

**gateway-nest/src/admin/admin.controller.ts:**
```typescript
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly healthSvc: AdminHealthService) {}

  @Get('health')
  @Roles('vendor_admin')
  @UseGuards(RolesGuard)
  getHealth() {
    return this.healthSvc.getSystemHealth();
  }
}
```

## Frontend Updates

**Files to update:**
- `frontend/app/(dashboard)/admin/health/page.tsx` — fetch real data từ `/api/admin/health`

**api-client.ts additions:**
```typescript
admin: {
  health: () => apiFetch<AdminHealthDto>('/api/admin/health'),
}

export interface AdminHealthDto {
  summary: { totalFramesToday: number; totalAlertsToday: number };
  companies: CompanyHealthDto[];
}

export interface CompanyHealthDto {
  id: string;
  name: string;
  totalCameras: number;
  onlineCameras: number;
  framesPerMinute: number;
  lastFrameAt: string | null;
  errorCount24h: number;
  cameras: CameraHealthSummaryDto[];
}

export interface CameraHealthSummaryDto {
  id: string;
  name: string;
  status: 'online' | 'warning' | 'offline';
  framesPerMinute: number;
  lastFrameAt: string | null;
  errorCount24h: number;
}
```

**admin/health/page.tsx — UPDATE:**

```typescript
'use client';
import { usePoll } from '@/lib/use-poll'; // đã có, dùng lại!

export default function AdminHealthPage() {
  const [data, setData] = useState<AdminHealthDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Initial load
  useEffect(() => {
    api.admin.health().then(setData).finally(() => setLoading(false));
  }, []);

  // Auto-refresh every 30 seconds — dùng usePoll hook đã có
  usePoll(async () => {
    const fresh = await api.admin.health();
    setData(fresh);
  }, 30_000);

  if (loading) return <LoadingSkeleton />;
  if (!data) return <ErrorState />;

  return (
    <div className="p-6 space-y-6">
      {/* Summary banner */}
      <SummaryBanner
        totalFrames={data.summary.totalFramesToday}
        totalAlerts={data.summary.totalAlertsToday}
      />

      {/* Company health table */}
      <CompanyHealthTable companies={data.companies} />
    </div>
  );
}
```

**Health badge logic (thay mock bằng real status):**
```typescript
// Từ existing StatusBadge component — confirm nó support 'warning' status
// FE đã có: components/cameras/status-badge.tsx
// Đảm bảo hiển thị đúng: green=online, yellow=warning, red=offline
```

**formatTimeAgo** — FE đã có trong `lib/utils.ts`. Dùng để hiển thị "2 minutes ago" cho `lastFrameAt`.

## Performance Notes

- API health query cần complete trong < 2s cho toàn bộ system
- Redis pipeline batch lookup all cameras trong 1 roundtrip
- PostgreSQL queries aggregate per-camera (không scan per-row)
- Cân nhắc cache result trong Redis 30s nếu có nhiều cameras (> 100)

## Todo List

**Backend:**
- [ ] Tạo `src/admin/admin.module.ts` + controller + health service
- [ ] Implement `GET /api/admin/health` với PostgreSQL + Redis aggregation
- [ ] Implement `RolesGuard` (check role từ JWT, throw 403 nếu không phải vendor_admin)
- [ ] Test: vendor_admin gọi `/api/admin/health` → full response
- [ ] Test: operator gọi `/api/admin/health` → 403

**Frontend:**
- [ ] Thêm `admin` vào `api-client.ts`
- [ ] Update `admin/health/page.tsx` — fetch real data
- [ ] Wire `usePoll(30_000)` cho auto-refresh
- [ ] Test: data refresh mỗi 30s không gây flicker
- [ ] Test: health badges hiển thị đúng màu dựa trên `lastFrameAt`

## Success Criteria

- `/admin/health` hiển thị real data từ PostgreSQL + Redis
- Per-company và per-camera health expandable
- Health badge: green (< 60s), yellow (< 5min), red (older/never)
- Auto-refresh 30s hoạt động không cần user action
- Vendor_admin thấy tất cả companies; operator bị 403
- Summary: total frames và alerts hôm nay đúng

## Notes

- `lib/use-poll.ts` đã có trong FE — tái sử dụng trực tiếp
- `lib/utils.ts` đã có `formatTimeAgo` — dùng cho "last frame 2 minutes ago"
- `components/cameras/status-badge.tsx` đã có — confirm support đủ 3 states
- Mock data trong `lib/mock-data.ts` — delete sau khi EP-2 hoàn thành hoàn toàn
