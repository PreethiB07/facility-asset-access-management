# Database Design

PostgreSQL database layer for the Facility & Asset Access Management Platform, managed with Prisma ORM.

## Entities

### Company

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | String | Unique company name |
| createdAt / updatedAt | DateTime | Audit timestamps |

### User

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| companyId | UUID | Required FK → Company |
| name | String | Display name |
| email | String | Unique per company (`companyId` + `email`) |
| passwordHash | String | bcrypt hash only; never plaintext |
| role | Role enum | `USER`, `MANAGER`, `ADMIN` |
| isActive | Boolean | Soft-disable without deleting |
| createdAt / updatedAt | DateTime | Audit timestamps |

### Facility

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| companyId | UUID | Required FK → Company |
| name | String | |
| description | String? | Optional |
| isActive | Boolean | Inactive facilities remain in DB |
| requiresApproval | Boolean | Used by approval logic in a later stage |
| createdAt / updatedAt | DateTime | |

### Area

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| companyId | UUID | Required FK → Company |
| facilityId | UUID | Required FK → Facility |
| name | String | |
| description | String? | |
| isActive | Boolean | |
| requiresApproval | Boolean | |
| createdAt / updatedAt | DateTime | |

### Asset

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| companyId | UUID | Required FK → Company |
| facilityId | UUID | Required FK → Facility |
| areaId | UUID? | Optional FK → Area |
| name | String | |
| description | String? | |
| isActive | Boolean | |
| requiresApproval | Boolean | |
| createdAt / updatedAt | DateTime | |

An asset always belongs to a facility. It may optionally belong to an area within that facility (`areaId = null` for facility-level assets).

### AccessRequest

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| companyId | UUID | Required FK → Company |
| requesterId | UUID | FK → User |
| facilityId | UUID? | Exactly one target FK must be set |
| areaId | UUID? | |
| assetId | UUID? | |
| accessType | AccessType | `TEMPORARY` or `PERMANENT` |
| startAt | DateTime | Required for all requests |
| endAt | DateTime? | Required for temporary; null for permanent |
| reason | String | Request justification |
| status | AccessRequestStatus | `PENDING`, `APPROVED`, `REJECTED` |
| approvedById | UUID? | FK → User (approver) |
| approvedAt | DateTime? | |
| rejectionReason | String? | |
| createdAt / updatedAt | DateTime | |

## Relationships

```
Company 1 ──→ many User
Company 1 ──→ many Facility / Area / Asset / AccessRequest
User 1 ──→ many AccessRequest (as requester)
User 1 ──→ many AccessRequest (as approver)
Facility 1 ──→ many Area
Facility 1 ──→ many Asset
Area 1 ──→ many Asset (optional)
Facility / Area / Asset ──→ many AccessRequest (as target)
```

## Enums

| Enum | Values |
|------|--------|
| Role | `USER`, `MANAGER`, `ADMIN` |
| AccessType | `TEMPORARY`, `PERMANENT` |
| AccessRequestStatus | `PENDING`, `APPROVED`, `REJECTED` |

## Access Request Target Rule

An access request must reference **exactly one** target:

- `facilityId`, **or**
- `areaId`, **or**
- `assetId`

Invalid combinations (multiple targets set, or all null) are **not enforced in the Prisma schema or PostgreSQL constraints**. This XOR rule will be validated in the service/API layer in the next development stage.

**Reason:** PostgreSQL check constraints for three-way XOR are verbose and harder to maintain; application-layer validation provides clearer error messages and aligns with upcoming business-logic tests.

## Temporary vs Permanent Access

| Type | startAt | endAt | Notes |
|------|---------|-------|-------|
| TEMPORARY | Required | Required; must be > startAt | Validated in service layer |
| PERMANENT | Required | Must be null | No end date |

Expired temporary access is **not physically deleted**. Expiration is determined at query/validation time by comparing `endAt` to the current timestamp. Historical records remain for audit purposes.

## Approval Design

`requiresApproval` on Facility, Area, and Asset determines whether a new access request should be:

- **Automatically `APPROVED`** when `requiresApproval = false`
- **`PENDING`** until manager action when `requiresApproval = true`

Approval workflow logic is **not implemented in this stage**; only the schema fields are prepared.

## Active / Inactive Behavior

- `isActive` on Facility, Area, and Asset supports soft deactivation.
- Deactivating a resource does **not** delete related access requests.
- Foreign keys use `onDelete: Restrict` for Facility, Area, Asset, and requester relationships to prevent accidental cascade deletion of history.
- Approver FK uses `onDelete: SetNull` so approver user records can be removed without deleting request history.

Inactive resources should be rejected for **new** access requests in a later service layer; existing approved/historical requests remain queryable.

## Indexes

| Index | Rationale |
|-------|-----------|
| `User.companyId, User.email` (unique) | Per-company login lookup |
| `User.companyId` | Tenant-scoped user queries |
| `Facility.companyId` | Tenant-scoped facility queries |
| `Area.companyId` | Tenant-scoped area queries |
| `Asset.companyId` | Tenant-scoped asset queries |
| `AccessRequest.companyId` | Tenant-scoped request queries |
| `AccessRequest.requesterId` | List requests by user |
| `AccessRequest.status` | Filter pending/approved/rejected |
| `AccessRequest.facilityId` | Target-based queries |
| `AccessRequest.areaId` | Target-based queries |
| `AccessRequest.assetId` | Target-based queries |
| `AccessRequest.startAt` | Validity window queries |
| `AccessRequest.endAt` | Expiration queries |

Area and Asset FK columns (`facilityId`, `areaId`) rely on PostgreSQL FK indexes created automatically.

## Seed Data

Development seed (`server/prisma/seed.ts`) creates two companies:

- **Acme Corporation** — `demo.*@example.com` accounts (see `docs/demo-accounts.md`)
- **Globex Industries** — `globex.*@example.com` accounts

Each company receives isolated facilities, areas, assets, and sample access requests.

Run: `npm run db:seed` from `server/` (runs `prisma generate` first when possible).

See [multi-company-design.md](multi-company-design.md) for tenant architecture.

## Assumptions

- UUID primary keys for all entities
- PostgreSQL 14+ with `DATABASE_URL` from environment (never hardcoded)
- Prisma 6.x (stable `url = env("DATABASE_URL")` configuration)
- Multi-company tenancy via `Company` model and `companyId` FKs (Stage 13); API filtering and RLS in later stages
