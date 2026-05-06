# UI Generation Prompt — Intelli-Park Camera Management System

> **Target:** v0.dev / Lovable / Bolt / any AI UI generator  
> **Scope:** Frontend only — no backend, no database, all data is mock/static  
> **Stack:** Next.js 14 App Router · React · TypeScript · Tailwind CSS · shadcn/ui · react-konva (canvas zone drawing)

---

## PROMPT (copy everything below this line)

---

Build a complete **multi-tenant SaaS frontend** for **Intelli-Park** — a parking lot camera management system for Milesight IP cameras. This is a frontend-only prototype; use realistic mock data everywhere instead of real API calls.

---

## Design System

**Style:** Professional dark-mode security/surveillance SaaS dashboard. Clean, data-dense, industrial-modern.

**Color palette:**
- Background: `#0B0F1A` (deep navy-black)
- Surface cards: `#111827` (gray-900), elevated: `#1F2937` (gray-800)
- Primary accent: `#3B82F6` (blue-500)
- Success / Camera online: `#22C55E` (green-500)
- Warning / Degraded: `#EAB308` (yellow-500)
- Danger / Offline: `#EF4444` (red-500)
- Border: `#374151` (gray-700)
- Body text: `#F9FAFB` (gray-50)
- Muted text: `#9CA3AF` (gray-400)

**Typography:** Inter (headings + body), JetBrains Mono (UUIDs, IP addresses, code values)

**Component library:** shadcn/ui (dark theme). Use `Card`, `Badge`, `Button`, `Input`, `Select`, `Tabs`, `Table`, `Dialog`, `Tooltip`, `Toast`.

**Icons:** Lucide React only — no emojis as icons.

**All interactive elements:** `cursor-pointer` + hover feedback (color shift or shadow) + `transition-colors duration-200`.

**Touch targets:** minimum 44×44px.

**Responsive breakpoints:** 375px (mobile), 768px (tablet), 1280px (desktop).

---

## Application Structure

```
/login                          Login page
/cameras                        Camera list (operator view)
/cameras/new                    Register new camera
/cameras/[id]/overview          Camera detail — Overview tab
/cameras/[id]/configuration     Camera detail — Configuration tab
/cameras/[id]/zones             Camera detail — Zones tab (canvas drawing)
/cameras/[id]/health            Camera detail — Health tab
/admin/health                   Vendor admin global health dashboard
```

---

## Global Layout

**Sidebar navigation** (collapsible on mobile, persistent on desktop):
- Logo: "Intelli-Park" with a small camera icon
- Nav items: Cameras, Admin Health (visible only for `vendor_admin` role)
- Bottom: current user avatar + name + company name + logout button

**Top bar:** breadcrumb path + notification bell (badge count) + theme toggle (dark/light).

**Mock auth state:** provide a role toggle in the sidebar footer — switch between `operator` and `vendor_admin` roles to preview both views without a login flow.

---

## Screen 1 — Login Page `/login`

A centered card on dark background:
- Logo + product name
- Email + password inputs with labels
- "Sign In" button (loading state on click, then redirects)
- Show/hide password toggle
- Below the form, two quick-login pills: **"Login as Operator"** and **"Login as Admin"** — clicking either fills credentials and logs in instantly (demo shortcut)

---

## Screen 2 — Camera List `/cameras`

**Header row:**
- Page title "Cameras" + camera count badge
- Search input (filters by name or IP in real-time)
- Status filter dropdown: All / Online / Warning / Offline / Pending
- "+ Add Camera" primary button → navigates to `/cameras/new`

**Camera table** (responsive: card grid on mobile, table on desktop):

Columns: Name | IP Address | Model | Location | Status | Last Frame | Actions

- **Status badge** component with 4 states:
  - `online` → green dot + "Online" (last frame < 60s ago)
  - `warning` → yellow dot + "Warning" (last frame 60s–5min ago)
  - `offline` → red dot + "Offline" (last frame > 5min or never)
  - `pending` → gray dot + "Pending" (just registered, no frame yet)
- **Last Frame** column: humanized time (e.g., "12 seconds ago", "3 minutes ago", "Never")
- **Actions** column: "View" button → `/cameras/[id]/overview`, and a "..." overflow menu with Delete option
- Row click → navigates to camera detail

**Mock data:** include at least 8 cameras across all 4 status states and 2–3 different locations.

**Auto-refresh indicator:** a subtle "Last updated X seconds ago" label at the top right that counts up. Every 30s, a spinner flashes briefly and the timestamp resets (simulating polling).

---

## Screen 3 — Register Camera `/cameras/new`

**Two-column layout** (form left, preview right on desktop; stacked on mobile):

**Left — Registration form:**

| Field | Input | Notes |
|-------|-------|-------|
| Camera Name | Text input | required |
| IP Address | Text input | placeholder `192.168.1.100` |
| Port | Number input | default `80` |
| Username | Text input | default `admin` |
| Password | Password input with show/hide toggle | |
| Location | Text input | optional, e.g., "Gate A", "Lot B" |
| Model | Read-only badge | always `MS-C8241-X36PE` |

- Real-time validation: red border + error message under field on blur
- "Register Camera" submit button with 3 states:
  1. **Default** — enabled
  2. **Loading** — disabled, spinner + "Probing ONVIF connection…" text (simulate 2s delay)
  3. **Error** — toast notification + inline error banner below form with one of:
     - `NETWORK_UNREACHABLE` → "Cannot reach camera at this IP/port. Check network."
     - `INVALID_CREDENTIALS` → "Wrong username or password."
     - `ONVIF_PROTOCOL_ERROR` → "Camera responded but ONVIF negotiation failed."
  4. **Success** → show snapshot preview on the right panel + "Camera registered!" toast + "View Camera" button

**Right — Snapshot preview panel:**
- Before registration: placeholder card with dashed border, camera icon, text "Snapshot will appear after successful registration"
- After mock success: shows a gray placeholder image (use a dark gradient rectangle as fake snapshot) + camera name label below

---

## Screen 4 — Camera Detail Layout `/cameras/[id]/*`

**Sticky tab bar** below the breadcrumb with 4 tabs:
`Overview` · `Configuration` · `Zones` · `Health`

Active tab: blue underline + bold text.

---

### Tab 4A — Overview `/cameras/[id]/overview`

Two-column layout:

**Left — Snapshot panel:**
- Large snapshot image placeholder (16:9, dark gradient with a camera icon overlay)
- "Refresh Snapshot" button below (loading state 1.5s then flashes)
- Last snapshot timestamp beneath

**Right — Camera details card:**
- Name (large, bold)
- Status badge (same component from list)
- IP Address + Port (monospace font)
- Model
- Location
- Created date
- "Last frame received" with humanized time

---

### Tab 4B — Configuration `/cameras/[id]/configuration`

**Title:** "HTTP Push Configuration"

**Subtitle:** "Copy these values into your Milesight camera's HTTP notification settings."

Three configuration rows, each as a card:

```
┌─────────────────────────────────────────────────────────┐
│  Site Key                                               │
│  ┌─────────────────────────────────────────────┐  📋   │
│  │  a3f7c2d1-8b4e-4f9a-bc23-1d5e7f8a9b0c      │       │
│  └─────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Endpoint URL                                           │
│  ┌─────────────────────────────────────────────┐  📋   │
│  │  https://api.intellipark.io/ingest/a3f7c2   │       │
│  └─────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Trigger Interval                                       │
│  ┌─────────────────────────────────────────────┐  📋   │
│  │  500ms                                      │       │
│  └─────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

- Copy button (clipboard icon from Lucide) on the right of each row
- On click: icon changes to a checkmark for 2s, toast "Copied to clipboard"
- Values displayed in `font-mono` (JetBrains Mono)

---

### Tab 4C — Zone Drawing `/cameras/[id]/zones`

This is the most complex screen. Implement it with **react-konva** (`dynamic import` with `ssr: false`).

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOOLBAR                                                             │
│  Zone Type: [Parking Zone ▼]   [Draw Polygon]  [Save Zones]         │
│                                [Refresh Snapshot]                   │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   CANVAS AREA (react-konva Stage)                                    │
│   Background: camera snapshot image (placeholder dark gradient)      │
│                                                                      │
│   Drawn zones + in-progress polygon overlay                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│  ZONE LIST (below canvas)                                            │
│  Each saved zone: type badge + point count + [Delete] button         │
└──────────────────────────────────────────────────────────────────────┘
```

#### Toolbar

- **Zone Type dropdown:** `Parking Zone` | `Entrance Zone` | `No Smoking Zone`
  - Colors: Parking = blue-400/30%, Entrance = green-400/30%, No Smoking = red-400/30%
- **"Draw Polygon" toggle button:** activates drawing mode (highlighted when active)
- **"Refresh Snapshot" button:** loading state 1.5s
- **"Save Zones" primary button:** disabled until at least one completed polygon exists; loading state on click with success toast

#### Canvas / Polygon Drawing Behavior

**CRITICAL — implement all behaviors below exactly:**

**1. Drawing mode activation:**
- User clicks "Draw Polygon" button → cursor changes to `crosshair`

**2. Placing points:**
- Each left-click on the canvas places a new point
- **No limit on number of points** — user may add as many as needed
- Points render as small circles (`Circle`, radius 5px, white fill, `stroke: current zone color`, `strokeWidth: 2`)
- Lines connect each consecutive point (`Line` with `stroke: current zone color`, `strokeWidth: 2`, `opacity: 0.9`)
- A **dashed "rubber-band" line** follows the mouse cursor from the last placed point to current mouse position in real-time — this gives live preview of where the next segment will go

**3. First-point visual distinction (CRITICAL):**
- The **first point** of the in-progress polygon MUST be visually different from all others:
  - Larger radius: `12px` (vs 5px for regular points)
  - Different fill: `white` with a colored ring stroke (`strokeWidth: 3`, zone color)
  - Outer pulsing ring animation (CSS `@keyframes pulse` or Konva `Tween`) — a second circle radiating outward, opacity fading 1→0, repeating every 1.5s
  - `cursor: pointer` when hovering over the first point
  - On hover: show a small tooltip or the circle brightens to indicate "click here to close"

**4. Closing the polygon (CRITICAL):**
- The polygon closes **only** when the user clicks within a **12px radius** of the first point (pixel distance on screen, not normalized)
- Use Euclidean distance: `Math.sqrt((mx - p0x)² + (my - p0y)²) < 12`
- If the click is outside the 12px radius, it places a new regular point — it does NOT close the polygon
- **Minimum 3 points** must exist before the polygon can be closed (if user tries to click first point with only 1–2 points placed, ignore the close attempt and just place a regular point)
- When closed: the in-progress state is cleared, the polygon is pushed to the `zones` array, the rubber-band line disappears, drawing mode deactivates automatically
- The newly completed polygon is immediately auto-selected (highlighted) — no need to switch to a "select mode" first

**5. Coordinate accuracy (CRITICAL):**
- Use `stage.getPointerPosition()` (NOT `event.clientX/Y`) to get mouse coordinates relative to the Konva stage
- Do NOT use `event.offsetX/Y` or DOM-relative coordinates
- The canvas must account for any CSS transforms or DPI scaling: initialize the stage with `pixelRatio: window.devicePixelRatio`
- The stage fills its container div exactly; use a `ResizeObserver` to detect container size changes and call `stage.width(newW); stage.height(newH)` — then recompute the background image scale

**6. Completed polygon behavior — auto-selected state:**
- When a polygon is completed, it enters "selected" state automatically
- Selected polygon: fill color `rgba(zone-color, 0.35)`, stroke `zone-color`, `strokeWidth: 2.5`, stroke-dash `[]` (solid)
- Unselected polygon: fill `rgba(zone-color, 0.15)`, stroke `zone-color`, `strokeWidth: 1.5`, opacity `0.7`
- Clicking a completed polygon selects it (deselects others)
- Clicking empty canvas deselects all

**7. Editing a selected polygon:**
- All points render as draggable `Circle` handles (radius 6px, white fill, zone-color stroke)
- Dragging a handle updates that point in the polygon's point array in real-time
- The entire polygon can be dragged: set `draggable={true}` on the `Group` containing the polygon — all points move together

**8. Deleting a polygon:**
- When a polygon is selected, a "Delete Zone" button appears in the toolbar (red, Trash2 icon)
- Clicking it removes the polygon from the `zones` array after a confirm dialog

**9. Mock initial zones:**
Load 2 pre-existing mock zones when the page mounts:
- One "Parking Zone" (blue) with 4 points forming a quadrilateral
- One "Entrance Zone" (green) with 3 points forming a triangle
Both should load in un-selected state.

**10. Zone list panel (below canvas):**
- Lists all saved zones by type + point count + colored badge
- Each row has a "Delete" icon button
- Clicking a row selects that zone on the canvas

---

### Tab 4D — Health `/cameras/[id]/health`

**Status card (top):**
- Large status badge with icon: Online (green checkmark) / Warning (yellow clock) / Offline (red X)
- "Last frame received: X seconds/minutes ago" or "Never"
- If status is `offline`: full-width red alert banner — "⚠ Not receiving frames — last frame was more than 5 minutes ago"

**Metrics row (3 cards):**
- Frames Per Minute (last 5 min): e.g., `24.6 FPM`
- Uptime Today: e.g., `98.2%`
- Errors (24h): e.g., `3`

**Activity timeline (last 12 hours):**
- A simple bar chart (use a mock chart component or CSS bars) showing frames received per 30-min bucket
- Bars colored green/yellow/red based on FPM thresholds

**Auto-refresh note:** "Auto-refreshes every 30 seconds" with a subtle progress bar cycling below the status card.

---

## Screen 5 — Admin Health Dashboard `/admin/health`

**Access:** only visible when role = `vendor_admin`. If an `operator` visits this URL, show a 403 card: "Access Denied — This page requires vendor admin privileges."

**Header stats row (4 KPI cards):**
- Total Frames Today: `1,284,032`
- Total Alerts Today: `7`
- Companies Active: `4`
- Cameras Total: `23`

**Main table — per-company summary:**

Columns: Company | Cameras | FPM (5min) | Last Frame | Errors (24h) | Expand

- Each row is expandable (click chevron or row) to reveal a sub-table of that company's cameras
- Sub-table columns: Camera Name | IP | Status badge | FPM | Last Frame | Link

**Mock data:** 4 companies, each with 4–8 cameras, varying health states.

**Status badges:** same component used on the operator screens.

**Auto-refresh indicator:** same pattern as camera list (counts up, flashes every 30s).

**Export button** (top right): "Export CSV" — shows a toast "Exported to CSV" (no actual file, just UX demo).

---

## Shared Components to Build

| Component | Description |
|-----------|-------------|
| `StatusBadge` | Colored dot + label, 4 states: online/warning/offline/pending |
| `CopyButton` | Clipboard icon → checkmark on click + toast |
| `CameraSnapshotPlaceholder` | Dark gradient 16:9 placeholder with camera icon |
| `RefreshIndicator` | "Last updated X sec ago" with auto-counting |
| `HealthBanner` | Full-width red alert banner for offline cameras |
| `ZoneTypeBadge` | Colored badge: parking/entrance/no-smoking |
| `LoadingButton` | Button with spinner + disabled state during async ops |
| `ConfirmDialog` | shadcn/ui AlertDialog for destructive actions |

---

## Mock Data Specification

```typescript
// Cameras
const MOCK_CAMERAS = [
  { id: 'a3f7c2d1-...', name: 'Gate A Camera', ip: '192.168.1.100', port: 80,
    model: 'MS-C8241-X36PE', location: 'Gate A', status: 'online',
    last_frame_at: new Date(Date.now() - 12_000), created_at: '2024-01-15' },
  { id: 'b8e1d4f2-...', name: 'Lot B North', ip: '192.168.1.101', port: 80,
    model: 'MS-C8241-X36PE', location: 'Lot B', status: 'warning',
    last_frame_at: new Date(Date.now() - 90_000), created_at: '2024-01-16' },
  { id: 'c2a9e5g3-...', name: 'Exit Lane 1', ip: '192.168.1.102', port: 80,
    model: 'MS-C8241-X36PE', location: 'Exit', status: 'offline',
    last_frame_at: new Date(Date.now() - 480_000), created_at: '2024-01-17' },
  { id: 'd5f3b7h4-...', name: 'Entrance South', ip: '192.168.1.103', port: 80,
    model: 'MS-C8241-X36PE', location: 'Entrance', status: 'pending',
    last_frame_at: null, created_at: '2024-05-05' },
  // ... 4 more cameras
]

// Zones (normalized 0-1 coordinates)
const MOCK_ZONES = [
  { id: 'z1', camera_id: 'a3f7c2d1-...', type: 'parking_zone',
    points: [{x:0.1,y:0.1},{x:0.4,y:0.1},{x:0.4,y:0.5},{x:0.1,y:0.5}], version: 2 },
  { id: 'z2', camera_id: 'a3f7c2d1-...', type: 'entrance_zone',
    points: [{x:0.6,y:0.2},{x:0.9,y:0.2},{x:0.75,y:0.6}], version: 1 },
]
```

---

## Polygon Drawing — Technical Implementation Notes

> These notes are for the AI code generator to implement correctly. Do not skip any.

```tsx
// Zone editor component (react-konva, must be dynamic imported with ssr:false)

// State structure
const [mode, setMode] = useState<'idle' | 'drawing'>('idle')
const [inProgressPoints, setInProgressPoints] = useState<{x:number,y:number}[]>([])
const [mousePos, setMousePos] = useState<{x:number,y:number} | null>(null)
const [zones, setZones] = useState<Zone[]>(MOCK_ZONES_PX) // converted from normalized
const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)

// Stage click handler
const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
  if (mode !== 'drawing') return
  const pos = stageRef.current!.getPointerPosition()! // ALWAYS use this, never e.evt.*
  
  if (inProgressPoints.length >= 3) {
    const first = inProgressPoints[0]
    const dist = Math.sqrt((pos.x - first.x) ** 2 + (pos.y - first.y) ** 2)
    if (dist < 12) {
      // Close polygon
      const newZone = { id: uuid(), type: activeZoneType, points: [...inProgressPoints], selected: true }
      setZones(prev => [...prev.map(z => ({...z, selected: false})), newZone])
      setSelectedZoneId(newZone.id)
      setInProgressPoints([])
      setMode('idle')
      return
    }
  }
  // Place new point
  setInProgressPoints(prev => [...prev, pos])
}

// Mouse move for rubber-band line
const handleMouseMove = () => {
  if (mode !== 'drawing') return
  setMousePos(stageRef.current!.getPointerPosition())
}

// First point component (pulsing ring)
// Render TWO circles at inProgressPoints[0]:
// 1. Static: radius=12, fill='white', stroke=zoneColor, strokeWidth=3
// 2. Animated ring: use Konva.Animation to expand radius 12→24 and fade opacity 0.6→0
//    Reset every 1500ms
```

---

## UX Micro-interactions

- **Page transitions:** fade-in on route change (`animate-in fade-in duration-200`)
- **Table rows:** subtle `hover:bg-gray-800/50` on hover
- **Buttons:** `active:scale-95` press feedback
- **Cards:** `hover:border-gray-600` on interactive cards
- **Toast notifications:** use shadcn/ui `Sonner` or `useToast`, appear bottom-right, auto-dismiss 3s
- **Skeleton loaders:** show on first data load for table rows and snapshot areas
- **Empty states:** when no cameras exist, show a centered illustration card with "No cameras registered yet" + "+ Add Camera" button

---

## Accessibility

- All form inputs have `<label>` elements
- All icon-only buttons have `aria-label`
- Color is never the only status indicator (always paired with text or icon)
- Focus rings visible on all interactive elements
- `prefers-reduced-motion`: disable animations when set
- Tab order matches visual order

---

## File/Folder Structure Suggestion

```
app/
  login/page.tsx
  cameras/page.tsx                    # list
  cameras/new/page.tsx                # registration form
  cameras/[id]/layout.tsx             # tab bar wrapper
  cameras/[id]/overview/page.tsx
  cameras/[id]/configuration/page.tsx
  cameras/[id]/zones/page.tsx
  cameras/[id]/health/page.tsx
  admin/health/page.tsx
components/
  ui/                                 # shadcn/ui components
  cameras/status-badge.tsx
  cameras/camera-snapshot-placeholder.tsx
  cameras/refresh-indicator.tsx
  cameras/health-banner.tsx
  zones/zone-editor.tsx               # react-konva, dynamic import
  zones/zone-toolbar.tsx
  zones/zone-list.tsx
  shared/copy-button.tsx
  shared/loading-button.tsx
  shared/confirm-dialog.tsx
  layout/sidebar.tsx
  layout/top-bar.tsx
lib/
  mock-data.ts
  use-poll.ts                         # 30s polling hook simulation
  zones/normalize.ts                  # toNorm / toPx coordinate helpers
```

---

## Final Notes for the AI Generator

1. Use **react-konva** for the zone canvas — do not use native `<canvas>` or SVG polygon drawing.
2. Wrap the ZoneEditor with `dynamic(() => import(...), { ssr: false })` to prevent Next.js SSR errors.
3. The polygon drawing must use `stage.getPointerPosition()` — never `event.clientX/Y`.
4. The first polygon point MUST be visually and behaviorally distinct — larger, pulsing, snappable.
5. Auto-select completed polygons immediately — there is no separate "select tool" mode.
6. All coordinates stored normalized [0–1]; convert to pixels on render, back to normalized on save.
7. Every async button must show a loading state and be disabled while pending.
8. Role-based visibility: `vendor_admin` sees the Admin nav item; `operator` does not.
9. No real API calls — use `setTimeout` to simulate network latency (800ms–2000ms range).
10. The design must look production-ready: dark theme, consistent spacing (8px grid), no placeholder text like "lorem ipsum".
