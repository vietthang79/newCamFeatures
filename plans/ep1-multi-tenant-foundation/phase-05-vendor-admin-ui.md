# Phase 05 — Vendor Admin UI Wire-up

**Status:** ⏳ Pending  
**Priority:** 🟡 High  
**Effort:** ~3 hours  
**Depends on:** Phase 04 (api-client.ts exists, auth wired)

## Overview

Wire tất cả admin pages (companies, users, company switcher) tới real API. Thay `lib/data-store.tsx` mock state bằng API calls. Không tạo UI mới — chỉ update data layer.

## Files to Modify

| File | Change |
|------|--------|
| `frontend/lib/data-store.tsx` | Replace mock CRUD với api-client calls |
| `frontend/app/(dashboard)/admin/companies/page.tsx` | Use real data |
| `frontend/app/(dashboard)/admin/companies/new/page.tsx` | Submit tới API |
| `frontend/app/(dashboard)/admin/companies/[id]/page.tsx` | Load + edit từ API |
| `frontend/app/(dashboard)/admin/users/page.tsx` | Use real data |
| `frontend/app/(dashboard)/admin/users/new/page.tsx` | Submit tới API |
| `frontend/app/(dashboard)/admin/users/[id]/page.tsx` | Load + edit từ API |
| `frontend/components/layout/topbar.tsx` | Company switcher từ real companies list |
| `frontend/components/layout/sidebar.tsx` | Company info từ real user context |

**File to Delete:**
- `frontend/lib/mock-data.ts` (sau khi EP-2 cũng hoàn thành wire-up)

## Implementation

### frontend/lib/data-store.tsx — UPDATE

Hiện tại `DataProvider` giữ state mock trong memory. Sau update:

```typescript
// TRƯỚC: in-memory mock state
const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);

// SAU: fetch từ API, không cache local (đơn giản nhất)
// Mỗi page tự gọi API khi cần — không cần global company state

// DataProvider giữ role currentViewingCompanyId (vendor_admin company switcher)
// Đây là UI state, không phải data state
const [viewingCompanyId, setViewingCompanyId] = useState<string | null>(null);

// viewingCompanyId: vendor_admin dùng để filter view
// null = vendor_admin xem tất cả
// set = vendor_admin đang xem 1 company cụ thể
```

> **KISS:** Không implement global cache. Pages fetch data khi mount. Server là source of truth.

### admin/companies/page.tsx — UPDATE

```typescript
// Pattern cho tất cả admin pages:
const [companies, setCompanies] = useState<CompanyDto[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  api.companies.list()
    .then(setCompanies)
    .catch(err => setError(err.message))
    .finally(() => setLoading(false));
}, []);

// Delete handler:
const handleDelete = async (id: string) => {
  await api.companies.delete(id);
  setCompanies(prev => prev.filter(c => c.id !== id));
  toast.success('Company đã xóa');
};
```

### admin/companies/new/page.tsx — UPDATE

```typescript
const onSubmit = async (data: CreateCompanyDto) => {
  const company = await api.companies.create(data);
  toast.success('Company đã tạo');
  router.push(`/admin/companies/${company.id}`);
};
```

### admin/companies/[id]/page.tsx — UPDATE

```typescript
// Load company + users của company đó
useEffect(() => {
  Promise.all([
    api.companies.get(id),
    api.users.list({ companyId: id }),
  ]).then(([company, users]) => {
    setCompany(company);
    setUsers(users);
  });
}, [id]);
```

### Company Switcher (topbar.tsx) — UPDATE

Vendor admin cần list tất cả companies để switch:

```typescript
// Trong TopBar component — chỉ load khi user.role === 'vendor_admin'
const { user } = useAuth();
const [companies, setCompanies] = useState<CompanyDto[]>([]);

useEffect(() => {
  if (user?.role === 'vendor_admin') {
    api.companies.list().then(setCompanies);
  }
}, [user?.role]);

// Khi switch company:
const handleSwitchCompany = (companyId: string) => {
  setViewingCompanyId(companyId); // update DataStore context
  // Pages đọc viewingCompanyId để filter data của company đó
};
```

### Error Handling Pattern

```typescript
// Tất cả pages dùng pattern này cho API errors:
try {
  const data = await api.companies.create(body);
  // ...success
} catch (err) {
  if (err instanceof ApiError) {
    if (err.status === 403) toast.error('Bạn không có quyền thực hiện thao tác này');
    else if (err.status === 409) toast.error('Slug đã tồn tại, vui lòng chọn slug khác');
    else toast.error(err.message);
  } else {
    toast.error('Có lỗi xảy ra, vui lòng thử lại');
  }
}
```

## API Response Mapping

**Lưu ý:** FE hiện dùng `id: "co1"` (slug-like) cho companies trong mock. Real API trả UUID. Cần check tất cả places sử dụng company ID để xác nhận không hardcode format cũ.

Mapping fields:
```
Mock Company → API CompanyDto
  id: "co1"  → id: "uuid-string"
  name       → name (same)
  slug       → slug (same)
  status     → status (same)
  (no createdAt in mock) → createdAt: ISO string

Mock User → API UserDto
  id: "u1"   → id: "uuid-string"
  email      → email (same)
  role       → role (same)
  companyId  → companyId (UUID, not "co1")
  password   → KHÔNG có trong response (security)
```

## Todo List

- [ ] Update `frontend/lib/data-store.tsx` — bỏ mock state, giữ `viewingCompanyId`
- [ ] Update `admin/companies/page.tsx` — fetch từ API
- [ ] Update `admin/companies/new/page.tsx` — submit tới API
- [ ] Update `admin/companies/[id]/page.tsx` — load + update qua API
- [ ] Update `admin/users/page.tsx` — fetch từ API
- [ ] Update `admin/users/new/page.tsx` — submit tới API
- [ ] Update `admin/users/[id]/page.tsx` — load + update qua API
- [ ] Update `components/layout/topbar.tsx` — company switcher từ real data
- [ ] Update `components/layout/sidebar.tsx` — user/company info từ auth context
- [ ] Test: vendor_admin thấy tất cả companies trong list
- [ ] Test: vendor_admin tạo company mới → xuất hiện trong list
- [ ] Test: vendor_admin switch company → dashboard scoped theo company mới
- [ ] Test: operator đăng nhập → chỉ thấy company và users của mình

## Success Criteria

- Admin tạo company mới → persist trong DB, xuất hiện sau reload
- Admin tạo user mới với companyId → user có thể đăng nhập
- Vendor admin switch company → tất cả data filter theo company được chọn
- Operator login → chỉ thấy company mình, không thấy admin menu
- Delete company có users → hỏi confirm, thực hiện được (users.company_id SET NULL)

## Notes

- `lib/mock-data.ts` (cameras, zones) chưa delete ở phase này — EP-2 phases sẽ xử lý
- Loading/error states phải consistent trên tất cả pages (skeleton loader hoặc spinner)
- Pagination cho large company/user lists là scope sprint sau — MVP fetch all
