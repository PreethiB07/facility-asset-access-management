# Database Design

PostgreSQL database layer for the Facility & Asset Access Management Platform, managed with Prisma ORM.

## Entities

### User

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | String | Display name |
| email | String | Unique |
| passwordHash | String | bcrypt hash only; never plaintext |
| role | Role enum | `USER`, `MANAGER`, `ADMIN` |
| isActive | Boolean | Soft-disable without deleting |
| createdAt / updatedAt | DateTime | Audit timestamps |

### Facility

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | String | |
| description | String? | Optional |
| isActive | Boolean | Inactive facilities remain in DB |
| requiresApproval | Boolean | Used by approval logic in a later stage |
| createdAt / updatedAt | DateTime | |

### Area

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
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
| `User.email` (unique) | Login lookup |
| `AccessRequest.requesterId` | List requests by user |
| `AccessRequest.status` | Filter pending/approved/rejected |
| `AccessRequest.facilityId` | Target-based queries |
| `AccessRequest.areaId` | Target-based queries |
| `AccessRequest.assetId` | Target-based queries |
| `AccessRequest.startAt` | Validity window queries |
| `AccessRequest.endAt` | Expiration queries |

Area and Asset FK columns (`facilityId`, `areaId`) rely on PostgreSQL FK indexes created automatically.

## Seed Data

Development seed (`server/prisma/seed.ts`) creates:

- **Users:** Admin, Manager, Normal User (passwords hashed from `SEED_*_PASSWORD` env vars)
- **Facilities:** Active (requires approval), auto-approve, inactive
- **Areas:** Area 1, Area 2, inactive area
- **Assets:** Asset 1–3 in areas, independent facility-level asset, inactive asset
- **Sample access requests:** facility, area, and asset targets with mixed statuses

Run: `npm run db:seed` from `server/`.

## Assumptions

- UUID primary keys for all entities
- PostgreSQL 14+ with `DATABASE_URL` from environment (never hardcoded)
- Prisma 6.x (stable `url = env("DATABASE_URL")` configuration)
- Single-database deployment; no multi-tenant schema separation in this stage
