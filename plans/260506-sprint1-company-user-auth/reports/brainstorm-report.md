# Brainstorm Report — Sprint 1: Company & User Management + Authentication

**Date:** 2026-05-06
**Tickets:** "A vendor admin can create companies and users" + "A user can log in and see only their company's view"

---

## Context

IntelliPark = SaaS platform for parking violation monitoring via cameras.
Vendor (IntelliPark/distributor) sells the system to companies (city councils, parking operators, etc.).
Sprint 1 establishes the multi-tenant foundation before any camera features.

---

## Actors & Roles (MVP — 2 roles only)

| Role | Scope | Capabilities |
|---|---|---|
| `vendor_admin` | Entire system | Create/manage companies & users. Full access inside any company context. |
| `operator` | Single company | Dashboard, cameras, reports, alerts — scoped to own company only. |

**Hard constraint:** 1 Operator = 1 Company. No cross-company user sharing in MVP.

---

## Ticket 1 — Vendor Admin Creates Companies & Users

### Company Management
- Create company: `name`, `slug` (auto-generated from name, internal identifier, not editable, not in URL), `status` (active/inactive — field stored, behavioral logic deferred), `created_at` (auto)
- List all companies
- View all users per company
- Toggle company status (stored in DB only, no behavioral logic in Sprint 1)

### User Management
- Create Operator: email, display name, password (Vendor Admin sets manually, shares via external channel — no email service in Sprint 1)
- Assign Operator to 1 Company at creation
- Reassign Operator to different Company after creation (session invalidation impact deferred)
- 1 Operator = 1 Company — hard constraint

### System Bootstrap
- Seed 1 default Vendor Admin account on first system launch

---

## Ticket 2 — Login & Company-Scoped View

### Authentication
- Login: email + password at `app.intelli-park.com`
- Post-login routing:
  - Operator → Company dashboard (Sprint 1: empty state / placeholder)
  - Vendor Admin → Company Overview page

### Operator — Data Isolation
- Sees ONLY own company's data
- URL manipulation to another company → **403 Forbidden**
- No mechanism to view cross-company data

### Vendor Admin — Company Switcher
- Overview page: list of all companies
- Click into any company → switch to that company's context
- In company context: **full access** (same as Operator + Vendor Admin menu retained)
- Clear visual indicator: *"Viewing: [Company Name]"*
- Switch between companies or back to Overview without logging out

---

## Deferred to Sprint 2+

| Item | Reason |
|---|---|
| Email invite link for new users | Overkill for 1-3 company POC |
| Inactive company behavioral logic | Field stored, logic deferred |
| Vendor Admin audit trail in company context | Not needed for POC |
| Company Admin role (self-service user management) | MVP keeps it simple |
| Session invalidation on Operator reassign | Edge case for POC scale |

---

## Key Decisions Made

1. No email service in Sprint 1 — Vendor Admin sets password manually
2. Slug is auto-generated, internal only, never exposed in URLs
3. Company inactive status: store field only, zero logic attached in Sprint 1
4. Vendor Admin in company context = full access (not read-only)
5. Operator dashboard in Sprint 1 = empty state (placeholder for Sprint 2+ content)
6. Scale: 1-3 companies (proof of concept)
