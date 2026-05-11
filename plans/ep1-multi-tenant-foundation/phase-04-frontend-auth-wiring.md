# Phase 04 — Frontend Auth Wiring

**Status:** ⏳ Pending  
**Priority:** 🔴 Critical  
**Effort:** ~4 hours  
**Depends on:** Phase 03 (Auth API hoạt động)

## Overview

Thay thế mock auth trong FE bằng real API calls. Không tạo file mới — chỉ update các files hiện có.

## Files to Modify

| File | Change |
|------|--------|
| `frontend/lib/auth-context.tsx` | Replace mock login/logout với API calls |
| `frontend/app/login/page.tsx` | Gọi real API thay vì mock lookup |
| `frontend/lib/mock-auth-data.ts` | **Delete** file này |
| `frontend/next.config.js` | Thêm `rewrites` để proxy `/api/*` → NestJS |
| `frontend/lib/api-client.ts` | **Tạo mới** — fetch wrapper với cookie support |

> **Note về middleware.ts:** File này đã bị xóa trong codebase hiện tại (git status D). Auth guard FE dùng `lib/auth-guard.tsx` component thay vì middleware.

## Implementation

### frontend/lib/api-client.ts (tạo mới)

```typescript
// Thin wrapper around fetch với base URL và credentials
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',  // gửi httpOnly cookie
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(res.status, error.message ?? 'Request failed');
  }

  if (res.status === 204) return undefined as T;

  const json = await res.json();
  return json.data as T; // unwrap { statusCode, data } envelope
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiFetch<UserDto>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
    me: () => apiFetch<UserDto>('/api/auth/me'),
  },
  companies: {
    list: () => apiFetch<CompanyDto[]>('/api/companies'),
    get: (id: string) => apiFetch<CompanyDto>(`/api/companies/${id}`),
    create: (body: CreateCompanyBody) =>
      apiFetch<CompanyDto>('/api/companies', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<CreateCompanyBody>) =>
      apiFetch<CompanyDto>(`/api/companies/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => apiFetch(`/api/companies/${id}`, { method: 'DELETE' }),
  },
  users: {
    list: (params?: { companyId?: string }) => {
      const qs = params?.companyId ? `?companyId=${params.companyId}` : '';
      return apiFetch<UserDto[]>(`/api/users${qs}`);
    },
    create: (body: CreateUserBody) =>
      apiFetch<UserDto>('/api/users', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<CreateUserBody>) =>
      apiFetch<UserDto>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => apiFetch(`/api/users/${id}`, { method: 'DELETE' }),
  },
};

// Type definitions matching BE response DTOs
export interface UserDto {
  id: string;
  email: string;
  fullName: string | null;
  role: 'vendor_admin' | 'operator';
  status: 'active' | 'inactive';
  companyId: string | null;
  createdAt: string;
}

export interface CompanyDto {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface CreateCompanyBody { name: string; slug: string; status?: 'active' | 'inactive' }
export interface CreateUserBody { email: string; password: string; fullName?: string; role: string; companyId?: string }
```

### frontend/lib/auth-context.tsx — UPDATE

Thay toàn bộ mock logic bằng API calls:

```typescript
// TRƯỚC (mock):
const login = async (email, password, companyId) => {
  const user = INITIAL_USERS.find(u => u.email === email && u.password === password);
  // ...mock logic
};

// SAU (real):
const login = async (email: string, password: string) => {
  try {
    const user = await api.auth.login(email, password);
    setUser(user);
    router.push('/cameras');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      throw new Error('Email hoặc mật khẩu không đúng');
    }
    throw err;
  }
};

const logout = async () => {
  await api.auth.logout();
  setUser(null);
  router.push('/login');
};

// On mount — check if cookie session still valid
useEffect(() => {
  api.auth.me()
    .then(user => setUser(user))
    .catch(() => setUser(null))
    .finally(() => setLoading(false));
}, []);
```

### frontend/app/login/page.tsx — UPDATE

Login page hiện có 2 bước: (1) chọn company, (2) nhập credentials. Sau khi tích hợp real auth:
- **Bước 1 (company selector):** Vẫn giữ nhưng chỉ là UI cosmetic — BE không cần company khi login (companyId trong JWT). Hoặc đơn giản bỏ bước 1, chỉ email + password.
- **Bước 2:** Gọi `api.auth.login(email, password)`

> **Recommendation:** Giữ 2-step UI để UX không thay đổi, nhưng bước chọn company là optional/cosmetic. Thực tế JWT trả về companyId tự động.

```typescript
// Trong submit handler của login form:
const onSubmit = async (data: { email: string; password: string }) => {
  setLoading(true);
  try {
    await login(data.email, data.password); // gọi auth-context
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
  } finally {
    setLoading(false);
  }
};
```

### frontend/next.config.js — UPDATE

Thêm API URL config:

```js
const nextConfig = {
  trailingSlash: true,
  // Proxy /api/* tới NestJS trong development
  async rewrites() {
    return process.env.NODE_ENV === 'development' ? [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/:path*`,
      },
    ] : [];
  },
};
module.exports = nextConfig;
```

> **Note:** Trong production, Nginx handle routing. Rewrites chỉ cần trong dev.

### frontend/.env.local (tạo — không commit)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### frontend/.env.example (tạo — commit)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Login Flow Diagram

```
User → Login Page (email + password)
    │
    ▼
api.auth.login(email, password)
    │  POST /api/auth/login { email, password }
    ▼
NestJS AuthController
    │  bcrypt.compare → valid
    │  jwt.sign({ userId, email, role, companyId })
    │  Set-Cookie: accessToken=<jwt>; HttpOnly
    ▼
Browser saves httpOnly cookie
    │
    ▼
FE: setUser(response.user) → redirect /cameras
    │
    ▼ (subsequent requests)
Browser auto-sends cookie → NestJS validates JWT → user in request
```

## Handling 403 (URL manipulation)

```typescript
// frontend/lib/auth-guard.tsx — UPDATE
// Thêm check khi API trả về 403

useEffect(() => {
  // Nếu có ApiError 403 → redirect về dashboard home
  // Hiện tại auth-guard chỉ check user tồn tại
  // Cần thêm error boundary cho 403 responses
}, []);
```

## Todo List

- [ ] Tạo `frontend/lib/api-client.ts` với fetch wrapper
- [ ] Update `frontend/lib/auth-context.tsx` — replace mock với API calls
- [ ] Update `frontend/app/login/page.tsx` — gọi real API
- [ ] Update `frontend/next.config.js` — thêm rewrites cho dev
- [ ] Tạo `frontend/.env.example`
- [ ] **Delete** `frontend/lib/mock-auth-data.ts`
- [ ] Test: đăng nhập với `admin@intellipark.io` → redirect `/cameras`
- [ ] Test: đăng nhập sai password → hiện error message
- [ ] Test: reload trang sau login → session vẫn giữ (cookie check on mount)
- [ ] Test: logout → cookie clear, redirect `/login`
- [ ] Test: navigate tới protected route khi chưa đăng nhập → redirect `/login`

## Success Criteria

- Login với real credentials từ DB → thành công, redirect dashboard
- Invalid credentials → error message, không redirect
- Reload sau login → session tồn tại (httpOnly cookie)
- Logout → session clear, redirect login
- Direct URL `/cameras` khi chưa login → redirect `/login`
- Zero references tới `mock-auth-data.ts` còn lại trong codebase

## Notes

- `lib/data-store.tsx` hiện quản lý company/user CRUD mock state — phase 05 sẽ update
- Xóa `mock-auth-data.ts` sau khi confirm tất cả references đã thay thế
