# Multi-Company Design

Stage 13 introduces **multi-company (tenant) support** at the database schema level. Application-level API filtering and PostgreSQL Row-Level Security (RLS) will be added in subsequent stages.

> **Application-level filtering is NOT the final security boundary.**  
> PostgreSQL RLS will provide database-level isolation in a later stage.

---

## Company Model

```text
Company
├── id          UUID (primary key)
├── name        unique string
├── createdAt
└── updatedAt
```

- Uses the same UUID `@default(uuid())` convention as other models.
- Legacy migration seeds a fixed ID for **Acme Corporation** to preserve existing data.
- Company names are globally unique (`@@unique` on `name`).

---

## Entity Relationships

```text
Company
 ├── Users
 ├── Facilities
 │    ├── Areas
 │    └── Assets
 ├── Areas          (denormalized companyId + facility FK)
 ├── Assets         (denormalized companyId + facility/area FK)
 └── AccessRequests
```

Every user belongs to **exactly one** company via mandatory `User.companyId`.

---

## User → Company

- `User.companyId` is required (NOT NULL).
- Email uniqueness is **per company**: `@@unique([companyId, email])`.
- The same email address may exist in different companies (e.g. demo accounts in Acme and Globex).
- Users cannot select or modify `companyId` through normal registration payloads.
- Self-registration assigns the default company (**Acme Corporation**) until dedicated tenant onboarding is implemented.

---

## Resource Ownership

| Entity | companyId | Parent consistency |
|--------|-----------|-------------------|
| Facility | Required | Root tenant resource |
| Area | Required | Must match parent Facility.companyId |
| Asset | Required | Must match Facility; if areaId set, must match Area |
| AccessRequest | Required | Must match requester; target resource must match |

---

## Company Consistency Rules

The following cross-company combinations are **prevented**:

| Invalid scenario | Enforcement |
|------------------|-------------|
| Company A user + Company B facility in AccessRequest | DB trigger on AccessRequest |
| Company A facility + Company B area | DB trigger on Area |
| Company A area + Company B asset | DB trigger on Asset |
| Asset companyId ≠ facility companyId | DB trigger on Asset |

Triggers live in migration `20260903130000_add_multi_company`. Prisma schema FKs ensure all `companyId` values reference a valid `Company`.

---

## Existing Data Migration

Safe, non-destructive migration strategy (no reset):

1. Create `Company` table.
2. Insert legacy company **Acme Corporation** (`00000000-0000-4000-8000-000000000001`).
3. Add nullable `companyId` to User, Facility, Area, Asset, AccessRequest.
4. Backfill:
   - Users & Facilities → Acme Corporation
   - Areas → parent Facility.companyId
   - Assets → parent Facility.companyId
   - AccessRequests → requester.companyId
5. Set NOT NULL on all `companyId` columns.
6. Replace global `User.email` unique index with `[companyId, email]`.
7. Add foreign keys, indexes, and consistency triggers.

Existing records are preserved and assigned to Acme Corporation.

---

## Authentication & Company Context

### JWT design decision

JWT payload remains:

```text
{ userId, role }
```

**companyId is NOT embedded in the JWT.**

Rationale:

- Company membership can change (future admin tooling); server-side lookup stays authoritative.
- Avoids stale tenant claims in long-lived tokens.
- Matches existing architecture: `authenticate` → `getUserById(userId)` → trusted `req.user`.

### Trusted company context

```text
Bearer token
    ↓
JWT userId
    ↓
getUserById()  (includes companyId)
    ↓
req.user.companyId
    ↓
getCompanyContext(req)   // server/src/utils/company-context.ts
```

**Never trust** `companyId`, `tenantId`, or similar fields from client request bodies for authorization.

---

## API Impact List (Stage 14+)

| Area | Endpoints | Required change |
|------|-----------|-----------------|
| Auth | `POST /register`, `POST /login`, `GET /me` | Return `companyId` in user (done); filter N/A |
| Facilities | `GET/POST/PATCH /facilities`, nested areas | Scope all queries/mutations by `companyId` |
| Areas | `GET/PATCH /areas/:id`, facility nested routes | Scope by `companyId` |
| Assets | `GET/POST/PATCH /assets`, area assets | Scope by `companyId` |
| Access requests | CRUD + approve/reject + my-access | Scope by `companyId`; validate cross-entity |
| Manager pending | `GET /access-requests/pending` | Only same-company requests |

Create operations now set `companyId` from the authenticated user or parent resource (minimal Stage 13 support). **Read/list operations are not yet tenant-filtered** — that is the next stage.

---

## Test Impact Analysis

| Test file | Current assumption | Stage 14 needs |
|-----------|-------------------|----------------|
| `auth.test.ts` | Single tenant; demo Acme users | Add `companyId` assertions on `/me` |
| `resources.test.ts` | Global facility list | Company-scoped creates/lists |
| `access-requests.test.ts` | Shared seed data | Tenant-scoped request visibility |
| `access-request-manager.test.ts` | Manager sees all pending | Manager sees only same-company pending |

### Planned isolation tests (Stage 14+)

- Company A user cannot read Company B facility by ID (404).
- Company A user cannot create access request for Company B resource.
- Company A manager cannot approve Company B pending request.
- Company B admin cannot mutate Company A facilities.

Existing tests are **retained**; demo users remain on Acme Corporation via `tests/demo-users.ts`.

---

## Seed Data (Development)

Two companies are seeded:

| Company | Users | Password pattern |
|---------|-------|------------------|
| **Acme Corporation** (A) | `demo.user@example.com`, `demo.manager@example.com`, `demo.admin@example.com` | `Demo*@123` |
| **Globex Industries** (B) | `globex.user@example.com`, `globex.manager@example.com`, `globex.admin@example.com` | `Globex*@123` |

Each company receives isolated facilities, areas, assets, and sample access requests.

Run: `cd server && npm run db:seed`

---

## RLS Planned Architecture (Future Stage)

PostgreSQL Row-Level Security will:

1. Set session variable `app.current_company_id` per request/connection.
2. Enable RLS policies on tenant tables (`User`, `Facility`, `Area`, `Asset`, `AccessRequest`).
3. Enforce `companyId = current_setting('app.current_company_id')` at the database layer.

Application middleware will set the session variable after authentication. RLS provides defense-in-depth even if application filters are bypassed.

---

## Implementation Plan (Repository Structure)

Based on inspection of the existing codebase:

| Layer | Path | Stage 13 change |
|-------|------|-----------------|
| Schema | `server/prisma/schema.prisma` | Company model + companyId FKs |
| Migration | `server/prisma/migrations/20260903130000_add_multi_company/` | Safe backfill + triggers |
| Constants | `server/src/constants/company.constants.ts` | Legacy company IDs/names |
| Company context | `server/src/utils/company-context.ts` | `getCompanyContext()` helper |
| Company service | `server/src/services/company.service.ts` | Default registration company lookup |
| Auth | `server/src/services/auth.service.ts` | Assign company on register |
| Creates | facility/area/asset/access-request services | Set companyId on insert |
| Seed | `server/prisma/seed.ts` | Two-company demo data |
| Tests | `server/tests/demo-users.ts` | Acme company upsert for demo users |

Frontend (`client/`) is unchanged in Stage 13. Tenant-aware UI comes in later stages.
