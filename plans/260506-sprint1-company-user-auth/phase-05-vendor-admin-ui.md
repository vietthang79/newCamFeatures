# Phase 05 — Vendor Admin UI

## Context Links
- [Plan overview](./plan.md)
- [Phase 04 — Frontend Auth Wiring](./phase-04-frontend-auth-wiring.md)
- [Brainstorm report](./reports/brainstorm-report.md)

## Overview
- **Priority:** P1
- **Status:** mock-complete — pending backend integration (Phase 03)
- **Effort:** 5h
- Build vendor admin pages: company list/create, user management per company, company switcher in topbar, operator dashboard placeholder.

## What Is Currently Built (mock)
> All pages and UI are complete. All data reads/writes go through `lib/data-store.tsx` (in-memory React Context). When Phase 03 ships, replace `useData()` calls with real API calls via `lib/api-client.ts`.

| Item | Current state |
|------|--------------|
| `app/(dashboard)/admin/companies/page.tsx` | Built — reads from `useData().companies` |
| `app/(dashboard)/admin/companies/new/page.tsx` | Built — writes via `useData().addCompany()` |
| `app/(dashboard)/admin/companies/[id]/page.tsx` | Built — reads/writes via `useData()` |
| `app/(dashboard)/admin/users/page.tsx` | Built — reads from `useData().users` |
| `app/(dashboard)/admin/users/new/page.tsx` | Built — writes via `useData().addUser()` |
| `app/(dashboard)/admin/users/[id]/page.tsx` | Built — reads/writes via `useData()` |
| Company switcher (topbar + sidebar) | Built — `selectedCompanyId` in auth context |
| `components/admin/*` | **Not created** — logic is inline in page files |
| Data persistence | **None** — in-memory only; refreshing the page resets to `INITIAL_COMPANIES` / `INITIAL_USERS` |

## Key Insights
- All vendor admin pages must be guarded: redirect to `/cameras` if role=operator
- Company switcher lives in Topbar (visible to vendor_admin only when in dashboard)
- When vendor admin switches to a company context, the `selectedCompanyId` in auth context drives all subsequent API calls via `X-Company-Id` header
- Operator dashboard placeholder: just a "Coming soon" card with company name — Sprint 2 fills it
- Data table component already exists: `components/ui/data-table.tsx`
- Reuse existing form patterns from `app/(dashboard)/cameras/new/page.tsx`
- Files must stay < 200 lines — split large forms into sub-components if needed

## New Pages

```
app/(dashboard)/admin/companies/
  page.tsx                  — Company list (vendor_admin overview)
  new/
    page.tsx                — Create company form
  [id]/
    page.tsx                — Company detail: info + user list
    users/
      new/
        page.tsx            — Create user form

app/(dashboard)/page.tsx    — Root dashboard redirect
  → vendor_admin: redirect to /admin/companies
  → operator: show operator dashboard placeholder
```

## Components to Create/Modify

```
components/
  admin/
    company-table.tsx        — DataTable of companies (name, slug, status, created_at, actions)
    company-form.tsx         — Create company form (name input only; slug shown as preview)
    user-table.tsx           — DataTable of users per company (email, name, actions)
    user-form.tsx            — Create user form (email, name, password, company pre-filled)
    reassign-dialog.tsx      — Reassign user: select different company dropdown
  layout/
    topbar.tsx               — MODIFIED: add company switcher for vendor_admin
    sidebar.tsx              — MODIFIED: add Companies nav link for vendor_admin
```

## Topbar — Company Switcher

When `user.role === 'vendor_admin'`:
- Show a dropdown in topbar: "All Companies" (overview) or "[Company Name]" (in context)
- Dropdown lists all companies (from API) — click to switch context
- "Back to overview" option at top of dropdown
- While in company context: show badge/chip "Viewing: [Name]" in topbar
- Store `selectedCompanyId` + `selectedCompanyName` via `auth.switchCompany(id, name)`

Topbar UI sketch:
```
[Breadcrumb: Admin / Companies]    [Viewing: UK Parking Control ▼]   [🔔 3]
                                    ↑ dropdown toggle (vendor_admin only)
```

## Sidebar — New Nav Item

Add to `NAV_ITEMS` for vendor_admin:
```ts
{ href: '/admin/companies', label: 'Companies', icon: Building2, adminOnly: true }
```

## Related Code Files

**Create**
- `app/(dashboard)/page.tsx`
- `app/(dashboard)/admin/companies/page.tsx`
- `app/(dashboard)/admin/companies/new/page.tsx`
- `app/(dashboard)/admin/companies/[id]/page.tsx`
- `app/(dashboard)/admin/companies/[id]/users/new/page.tsx`
- `components/admin/company-table.tsx`
- `components/admin/company-form.tsx`
- `components/admin/user-table.tsx`
- `components/admin/user-form.tsx`
- `components/admin/reassign-dialog.tsx`

**Modify**
- `components/layout/topbar.tsx` — add company switcher
- `components/layout/sidebar.tsx` — add Companies nav link

## Implementation Steps

### 1. Root Dashboard Page (`app/(dashboard)/page.tsx`)
```ts
// Redirect based on role
'use client'
export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!user) return
    router.replace(user.role === 'vendor_admin' ? '/admin/companies' : '/cameras')
  }, [user])
  return null
}
```

### 2. Company List Page (`/admin/companies`)
- Fetch `GET /api/companies` with auth headers
- Render `<CompanyTable>` with columns: Name, Slug, Status badge, Created date, Actions (View detail)
- "Add Company" button → navigates to `/admin/companies/new`
- Status badge: green for active, gray for inactive

### 3. Company Form (`/admin/companies/new`)
- Single input: Company Name
- Show slug preview below: "Slug: `uk-parking-control`" (computed client-side as user types)
- Submit → `POST /api/companies` → redirect to `/admin/companies`
- Validation: name required, min 2 chars

### 4. Company Detail Page (`/admin/companies/[id]`)
- Show company info: name, slug, status, created date
- Toggle status button: "Set Inactive" / "Set Active" → `PATCH /api/companies/:id/status`
- User table: fetch `GET /api/users?companyId=:id`
- Columns: Name, Email, Created date, Actions (Reset Password, Reassign Company)
- "Add User" button → `/admin/companies/[id]/users/new`

### 5. User Form (`/admin/companies/[id]/users/new`)
- Fields: Name, Email, Password (visible — vendor admin sets it)
- Company is pre-filled from URL param (display only, not editable in form)
- Submit → `POST /api/users` with `{ email, name, password, companyId }`
- Redirect back to `/admin/companies/[id]` on success

### 6. Reassign Dialog (`components/admin/reassign-dialog.tsx`)
- Triggered from user table row action
- Select dropdown: all companies (except current one)
- Confirm → `PATCH /api/users/:id/company` with `{ companyId }`
- Refresh user list

### 7. Reset Password (inline in user table)
- Confirm dialog (uses existing `ConfirmDialog` component)
- Prompt for new password
- `PATCH /api/users/:id/password` with `{ password }`

### 8. Topbar Company Switcher
- `useEffect` fetches `GET /api/companies` once when vendor_admin is logged in (store in local state)
- Dropdown: "All Companies" (clears context) + company list
- `onClick` company → `auth.switchCompany(company.id, company.name)`
- Show "Viewing: [Name]" badge when `selectedCompanyId` is set

### 9. Operator Dashboard Placeholder
In the `/cameras` page (operator lands here): for Sprint 1 the camera list will be empty (no cameras added yet). This is acceptable as-is — the `MOCK_CAMERAS` in `lib/mock-data.ts` will be disconnected (cameras will come from real API in the camera sprint).

> **Action:** Update `/cameras/page.tsx` to show empty state instead of mock data. Placeholder: "No cameras registered yet."

## Todo List

### Done (mock implementation)
- [x] `app/(dashboard)/page.tsx` — role-based redirect
- [x] `app/(dashboard)/admin/companies/page.tsx` — company list (mock data)
- [x] `app/(dashboard)/admin/companies/new/page.tsx` — create company (mock data)
- [x] `app/(dashboard)/admin/companies/[id]/page.tsx` — company detail + users (mock data)
- [x] `app/(dashboard)/admin/users/page.tsx` — user list (mock data)
- [x] `app/(dashboard)/admin/users/new/page.tsx` — create user (mock data)
- [x] `app/(dashboard)/admin/users/[id]/page.tsx` — user detail (mock data)
- [x] `components/layout/topbar.tsx` — company switcher
- [x] `components/layout/sidebar.tsx` — Companies + Users nav links for vendor_admin
- [x] Guard all /admin pages (redirect operator to /cameras)

### Pending (requires Phase 03 backend)
- [ ] Replace all `useData()` calls with `apiFetch()` from `lib/api-client.ts`
- [ ] `components/admin/company-table.tsx` — extract inline table to reusable component
- [ ] `components/admin/user-table.tsx` — extract inline table
- [ ] `components/admin/reassign-dialog.tsx` — reassign user to different company
- [ ] Remove `INITIAL_COMPANIES` / `INITIAL_USERS` seed data once real DB is seeded

## Success Criteria
- Vendor admin can: create company → see it in list → click → view details
- Vendor admin can: create operator user → assign to company → see in user table
- Vendor admin can: reassign user to different company
- Vendor admin can: reset user's password
- Topbar shows company switcher for vendor_admin; not visible for operator
- "Viewing: UK Parking Control" indicator appears when vendor_admin switches context
- Operator visiting `/admin/companies` is redirected to `/cameras`
- No mock data visible anywhere (cameras page shows empty state)

## Risk Assessment
- **Files > 200 lines:** Company detail page has many sections — split: company info component + user section component
- **Infinite re-render from company fetch in topbar:** Use `useRef` to track if fetched, or `useEffect` with empty deps
- **Slug preview:** Compute client-side without API call — match server logic exactly (lowercase, kebab, strip non-alphanum)

## Security Considerations
- Guard pages client-side AND API-side (belt and suspenders)
- Never expose password fields from user objects (API already excludes hash — verify no passwordHash leaks to frontend)

## Next Steps
- Camera sprint (plan 260505): build camera features on top of this foundation
- Sprint 2: email invites, inactive company logic, audit trail
