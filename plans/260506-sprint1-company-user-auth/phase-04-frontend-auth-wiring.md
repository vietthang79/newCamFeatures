# Phase 04 — Frontend Auth Wiring

## Context Links
- [Plan overview](./plan.md)
- [Phase 03 — API](./phase-03-auth-companies-users-api.md)
- Existing: [lib/auth-context.tsx](../../lib/auth-context.tsx) — to be replaced
- Existing: [app/login/page.tsx](../../app/login/page.tsx) — to be wired

## Overview
- **Priority:** P0
- **Status:** mock-complete — pending backend integration (Phase 03)
- **Effort:** 4h
- Replace mock auth with real JWT flow; protect routes; wire login to API.

## What Is Currently Built (mock)
> The frontend auth flow is fully functional with mock data. Real JWT wiring is blocked until Phase 03 delivers the API.

| Item | Current state |
|------|--------------|
| `lib/auth-context.tsx` | Validates credentials against `INITIAL_USERS` in `lib/mock-auth-data.ts`; no JWT |
| `app/login/page.tsx` | 2-step flow (select company → enter credentials); validates account belongs to selected company before login |
| `middleware.ts` | Route protection active; `ip-session` cookie mirror; `/image/` excluded from auth check |
| `lib/api-client.ts` | **Not created** — no HTTP layer yet |
| Session storage | `localStorage` + `ip-session` cookie (mock); real httpOnly JWT cookie deferred to Phase 03 |

## Key Insights
- JWT stored in `localStorage` for Sprint 1 (simpler than httpOnly cookies — POC scale, no XSS risk from user-generated content)
- Auth context persists JWT across reloads via `localStorage` read on init
- Next.js middleware validates JWT expiry client-side (check `exp` claim) — real validation is always server-side
- Remove "Demo role toggle" from sidebar once real auth is wired
- `NEXT_PUBLIC_API_URL=http://localhost:3001` — env var for API base URL

## Architecture

```
lib/
  auth-context.tsx        REPLACED — real JWT, localStorage, login/logout/switchCompany
  api-client.ts           NEW — fetch wrapper with Authorization + X-Company-Id headers

app/
  middleware.ts            NEW — redirects unauthenticated users to /login
  login/page.tsx          MODIFIED — calls real POST /api/auth/login
  (dashboard)/layout.tsx  MODIFIED — reads auth context, no-op (middleware handles redirect)
```

## Auth Context Contract

```ts
interface AuthUser {
  id: string
  email: string
  name: string
  role: 'vendor_admin' | 'operator'
  companyId: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  selectedCompanyId: string | null     // vendor_admin company switcher context
  selectedCompanyName: string | null
  login: (email: string, password: string) => Promise<void>   // throws on failure
  logout: () => void
  switchCompany: (id: string | null, name: string | null) => void
  getAuthHeaders: () => Record<string, string>   // { Authorization, X-Company-Id? }
}
```

## Related Code Files

**Modify**
- `lib/auth-context.tsx` — full replacement
- `app/login/page.tsx` — wire to real API, remove mock
- `components/layout/sidebar.tsx` — remove demo role toggle, add real logout

**Create**
- `lib/api-client.ts`
- `app/middleware.ts`
- `.env.local.example` (root Next.js)

## Implementation Steps

### 1. API Client (`lib/api-client.ts`)
```ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { authHeaders?: Record<string, string> } = {}
): Promise<T> {
  const { authHeaders, ...rest } = options
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...rest.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? 'Request failed')
  }
  return res.json()
}
```

### 2. Auth Context (`lib/auth-context.tsx` — replace entirely)
- On mount: read `intellipark_token` from `localStorage`; decode JWT (`atob` base64 middle section) to get payload; set user state
- `login(email, password)`: call `POST /api/auth/login`; store token; set user state
- `logout()`: clear localStorage; reset state; `router.push('/login')`
- `switchCompany(id, name)`: update `selectedCompanyId` + `selectedCompanyName` state (no API call needed)
- `getAuthHeaders()`: returns `{ Authorization: 'Bearer {token}' }` + `'X-Company-Id': selectedCompanyId` if set

### 3. Login Page (`app/login/page.tsx`)
- Remove the `quickLogin` demo buttons and mock delay
- Call `auth.login(email, password)` on submit
- On success: if `user.role === 'vendor_admin'` → push to `/admin/companies`; else push to `/cameras`
- On error: show error toast (sonner already installed)
- Keep the existing UI design (don't redesign)

### 4. Middleware (`app/middleware.ts`)
```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login']

export function middleware(request: NextRequest) {
  const token = request.cookies.get('intellipark_token')?.value
    ?? request.headers.get('x-token')  // fallback for localStorage-based auth
  // Note: localStorage is not accessible in middleware — use cookie mirror
  // On login success, also set a non-httpOnly cookie for middleware detection
  const isPublic = PUBLIC_PATHS.some(p => request.nextUrl.pathname.startsWith(p))
  if (!token && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next|favicon.ico|api).*)'] }
```
> **Note:** Since we use localStorage for JWT, set a `intellipark_session=1` cookie (non-secure, no value) alongside localStorage on login. Middleware checks this cookie to decide redirect. Real validation still happens at API level.

### 5. Sidebar Cleanup (`components/layout/sidebar.tsx`)
- Remove the "Demo role:" toggle block entirely
- Wire the LogOut button to `auth.logout()`
- User info section reads from `auth.user` (already does via `useAuth`)

### 6. Post-login routing
```
vendor_admin → /admin/companies   (company overview)
operator     → /cameras           (existing page, now uses real data in Phase 05+)
```

### 7. Environment
- Root `.env.local`:
  ```
  NEXT_PUBLIC_API_URL=http://localhost:3001
  ```

## Todo List

### Done (mock implementation)
- [x] `app/login/page.tsx` — 2-step login UI; company ownership validation
- [x] `app/middleware.ts` — route protection; `/image/` static asset exclusion
- [x] `components/layout/sidebar.tsx` — real logout wired; no demo toggle

### Pending (requires Phase 03 backend)
- [ ] `lib/api-client.ts` — HTTP fetch wrapper with auth headers
- [ ] `lib/auth-context.tsx` — full replacement: `POST /api/auth/login` → real JWT
- [ ] `app/login/page.tsx` — remove `INITIAL_USERS` import; call real API; role-based redirect
- [ ] `.env.local.example` — `NEXT_PUBLIC_API_URL=http://localhost:3001`
- [ ] Test: Login as admin@intellipark.io → lands on /admin/companies
- [ ] Test: Unauthenticated visit to /cameras → redirects to /login
- [ ] Test: Logout → clears token, redirects to /login

## Success Criteria
- Real JWT login works end-to-end (frontend → API → JWT → redirect)
- Refresh page: user remains logged in (localStorage persists)
- Logout clears everything
- Unauthenticated users redirected to /login from any protected route
- Sidebar shows real user name + company (not hardcoded)
- No more "Demo role:" toggle in sidebar

## Risk Assessment
- **localStorage vs cookie auth middleware:** The cookie mirror approach is a Sprint 1 workaround — document this clearly; Sprint 2 should move to httpOnly cookies
- **JWT decode client-side:** Only for reading claims, not for security — API still validates signature

## Security Considerations
- Never log JWT token to console
- Clear token from localStorage on logout — do not keep stale tokens
- `NEXT_PUBLIC_API_URL` only exposes localhost URL — safe for POC

## Next Steps
- Phase 05: Build vendor admin UI pages on top of this auth context
