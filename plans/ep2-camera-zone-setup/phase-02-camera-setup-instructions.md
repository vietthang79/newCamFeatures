# Phase 02 — Camera Setup Instructions Page

**Status:** ⏳ Pending  
**Priority:** 🟡 High  
**Effort:** ~3 hours  
**Depends on:** Phase 01 (camera has siteKey in DB)

## Overview

Tạo mới trang "Setup Instructions" cho Milesight camera. Đây là page **chưa có trong FE hiện tại** — cần tạo mới. Nội dung hướng dẫn Milesight HTTP Push configuration, mỗi step tailored theo camera của operator.

## Acceptance Criteria

- Sau khi register camera → thấy "Setup Instructions" page
- Page hiển thị: site key, destination URL, trigger interval, step-by-step Milesight UI screenshots
- Copy mỗi value với 1 click
- Sau khi làm theo hướng dẫn → thấy frame đến trong 60s trên "Camera Health" indicator
- Nếu không có frames sau 5 phút → "Not receiving frames — check setup" warning + troubleshooting tips

## New File to Create

- `frontend/app/(dashboard)/cameras/[id]/setup-instructions/page.tsx`

## Files to Modify

- `frontend/app/(dashboard)/cameras/[id]/layout.tsx` — thêm tab "Setup" vào nav
- `frontend/app/(dashboard)/cameras/[id]/camera-layout-client.tsx` — thêm tab item

## Implementation

### Tab Addition (layout.tsx update)

```typescript
// Trong tab navigation của camera detail layout:
const tabs = [
  { label: 'Overview', href: `/cameras/${id}/overview` },
  { label: 'Geo-Zones', href: `/cameras/${id}/geo-zones` },
  { label: 'Setup', href: `/cameras/${id}/setup-instructions` }, // MỚI
  { label: 'Configuration', href: `/cameras/${id}/configuration` },
  { label: 'Health', href: `/cameras/${id}/health` },
];
```

### frontend/app/(dashboard)/cameras/[id]/setup-instructions/page.tsx

```tsx
// Page hoàn toàn mới — hướng dẫn Milesight HTTP Push setup
'use client';

import { useEffect, useState } from 'react';
import { CopyButton } from '@/components/shared/copy-button';
import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import { usePoll } from '@/lib/use-poll';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface SetupPageProps {
  params: { id: string };
}

export default function SetupInstructionsPage({ params }: SetupPageProps) {
  const [camera, setCamera] = useState<CameraDto | null>(null);
  const [frameStatus, setFrameStatus] = useState<'waiting' | 'receiving' | 'timeout'>('waiting');
  const [setupStartedAt] = useState(() => Date.now());

  useEffect(() => {
    api.cameras.get(params.id).then(setCamera);
  }, [params.id]);

  // Poll camera health để detect khi frames bắt đầu đến
  usePoll(async () => {
    const health = await api.cameras.getHealth(params.id);
    if (health.lastFrameAt) {
      const secondsAgo = (Date.now() - new Date(health.lastFrameAt).getTime()) / 1000;
      if (secondsAgo < 60) setFrameStatus('receiving');
    }
    // Sau 5 phút không có frames → timeout warning
    if (Date.now() - setupStartedAt > 5 * 60 * 1000 && frameStatus === 'waiting') {
      setFrameStatus('timeout');
    }
  }, 10_000); // poll mỗi 10s

  if (!camera) return <div className="p-8">Loading...</div>;

  const DESTINATION_URL = `${process.env.NEXT_PUBLIC_API_URL}/api/ingestion/frames`;
  const TRIGGER_INTERVAL = '500'; // ms

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Camera Setup Instructions</h1>
        <p className="text-gray-500 mt-1">
          Configure your Milesight {camera.model} to send images to Intelli-Park.
          Follow these steps — should take under 30 minutes.
        </p>
      </div>

      {/* Frame arrival status banner */}
      <FrameStatusBanner status={frameStatus} />

      {/* Step 1: Your credentials */}
      <SectionCard title="Step 1 — Your Connection Details" icon={...}>
        <div className="space-y-4">
          <ConfigValue
            label="Site Key"
            value={camera.siteKey}
            description="Unique identifier for this camera. Paste this into the Milesight 'Trigger Channel' field."
          />
          <ConfigValue
            label="Destination URL"
            value={DESTINATION_URL}
            description="The URL Milesight will POST images to."
          />
          <ConfigValue
            label="Trigger Interval"
            value={`${TRIGGER_INTERVAL} ms`}
            description="Set this in Milesight → Event → HTTP Notification → Interval."
          />
        </div>
      </SectionCard>

      {/* Step 2: Milesight Web UI steps */}
      <SectionCard title="Step 2 — Milesight Web UI Configuration">
        <ol className="list-decimal list-inside space-y-4 text-sm">
          <li>Open your browser and navigate to <code>http://{camera.ipAddress}:{camera.port}</code></li>
          <li>Log in with your camera credentials</li>
          <li>Go to <strong>Setup → Event → HTTP Notification</strong></li>
          <li>Click <strong>Add</strong> to create a new notification</li>
          <li>Set <strong>URL</strong> to: <CopyButton value={DESTINATION_URL} label="Copy URL" /></li>
          <li>Set <strong>Authorization</strong> to: <code>Bearer {camera.siteKey}</code></li>
          <li>Set <strong>Trigger Interval</strong> to: <code>{TRIGGER_INTERVAL} ms</code></li>
          <li>Check <strong>Snapshot Attachment</strong> ✓</li>
          <li>Set trigger events: <strong>Scheduled</strong> (always on)</li>
          <li>Click <strong>Save</strong></li>
        </ol>
        <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-800">
          💡 The Milesight MS-C8241-X36PE supports HTTPS Notification natively — no edge bridge required.
        </div>
      </SectionCard>

      {/* Step 3: Verify */}
      <SectionCard title="Step 3 — Verify Connection">
        <p className="text-sm text-gray-600">
          After saving the Milesight configuration, you should see frames arriving within 60 seconds.
          The indicator above will turn green when frames are detected.
        </p>
        {frameStatus === 'timeout' && <TroubleshootingTips camera={camera} />}
      </SectionCard>
    </div>
  );
}

// Sub-component: config value với copy button
function ConfigValue({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 bg-gray-50 rounded-lg">
      <div>
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</div>
        <div className="font-mono text-sm mt-0.5 break-all">{value}</div>
        <div className="text-xs text-gray-400 mt-1">{description}</div>
      </div>
      <CopyButton value={value} />
    </div>
  );
}

// Sub-component: frame status banner
function FrameStatusBanner({ status }: { status: 'waiting' | 'receiving' | 'timeout' }) {
  if (status === 'receiving') return (
    <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
      <CheckCircle className="h-5 w-5" />
      <span className="font-medium">Frames are arriving! Setup complete.</span>
    </div>
  );

  if (status === 'timeout') return (
    <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
      <AlertCircle className="h-5 w-5" />
      <span className="font-medium">Not receiving frames — check setup below.</span>
    </div>
  );

  return (
    <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
      <Clock className="h-5 w-5 animate-pulse" />
      <span>Waiting for first frame... (checking every 10 seconds)</span>
    </div>
  );
}

// Sub-component: troubleshooting tips
function TroubleshootingTips({ camera }: { camera: CameraDto }) {
  return (
    <div className="mt-4 space-y-2 text-sm text-gray-700">
      <p className="font-medium">Troubleshooting:</p>
      <ul className="list-disc list-inside space-y-1 text-gray-600">
        <li>Confirm the camera IP <code>{camera.ipAddress}</code> is reachable from the cloud server</li>
        <li>Check the Destination URL has no typos — it must be exactly: <code>...frames</code></li>
        <li>Ensure "Snapshot Attachment" is enabled in Milesight settings</li>
        <li>Check the Bearer token matches your Site Key exactly</li>
        <li>Milesight logs: go to <strong>Log → System Log</strong> to see if HTTP push is sending</li>
        <li>Contact support if issue persists: <a href="mailto:support@intelli-park.com" className="underline">support@intelli-park.com</a></li>
      </ul>
    </div>
  );
}
```

## api-client.ts additions

```typescript
cameras: {
  // ... existing
  getHealth: (id: string) => apiFetch<CameraHealthDto>(`/api/cameras/${id}/health`),
}

export interface CameraHealthDto {
  cameraId: string;
  status: 'online' | 'offline' | 'warning' | 'pending';
  lastFrameAt: string | null;
  framesPerMinute: number;
  errorCount24h: number;
}
```

## Route: geo-zones (giữ nguyên)

Route `/cameras/[id]/geo-zones` giữ nguyên — không rename.

## Todo List

- [ ] Tạo `frontend/app/(dashboard)/cameras/[id]/setup-instructions/page.tsx`
- [ ] Update `layout.tsx` — thêm "Setup" tab
- [ ] Thêm `cameras.getHealth` vào `api-client.ts`
- [ ] Test: navigate tới setup instructions → hiển thị site key và destination URL
- [ ] Test: copy buttons hoạt động
- [ ] Test: sau khi camera push frame → status banner đổi sang "Frames arriving"
- [ ] Test: sau 5 phút không có frames → troubleshooting tips hiển thị

## Success Criteria

- Setup instructions page accessible sau khi register camera
- Site key, destination URL, interval hiển thị đúng và copyable
- 9-step Milesight guide hiển thị rõ ràng
- Frame arrival detection trong 60s → green banner
- 5min timeout → amber banner + troubleshooting tips
- `CopyButton` component tái sử dụng từ `components/shared/copy-button.tsx`

## Notes

- Không cần screenshot của Milesight UI trong MVP — text steps là đủ
- `docs/onboarding/milesight-http-config.md` mentioned trong ticket là tech runbook riêng — scope của docs team, không phải này
