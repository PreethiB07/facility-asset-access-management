# Access Request Workflow

Backend workflow for users to request access to facilities, areas, and assets.

## Lifecycle

```
User creates request
        ↓
Target validation (exists, active, exactly one target)
        ↓
Access type validation (TEMPORARY / PERMANENT)
        ↓
Approval decision based on target.requiresApproval
        ↓
   ┌────┴────┐
   │         │
auto       pending
APPROVED   (manager action in next stage)
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/access-requests` | Yes | Create access request |
| GET | `/api/access-requests` | Yes | List own requests (`?status=` optional) |
| GET | `/api/access-requests/:id` | Yes | View own request details |
| GET | `/api/my-access` | Yes | Currently valid approved access |

The requester is always taken from the authenticated JWT user. Clients cannot specify another requester.

## Target Validation

Exactly **one** target must be provided:

| Target | FK set | Validations |
|--------|--------|-------------|
| Facility | `facilityId` only | Exists, `isActive = true` |
| Area | `areaId` only | Exists, active, parent facility active |
| Asset | `assetId` only | Exists, active, parent facility active; if asset has area, area must be active |

Invalid: multiple targets, no target, inactive resources.

## Temporary Access

```text
accessType = TEMPORARY
startAt    = required (valid ISO datetime)
endAt      = required (valid ISO datetime, must be after startAt)
```

Expired temporary requests remain in the database. Expiration is evaluated at query time.

## Permanent Access

```text
accessType = PERMANENT
startAt    = required
endAt      = must be null (reject if client sends endAt)
```

## Reason

- Required, trimmed before storage
- Rejects null, empty, or whitespace-only values
- Maximum 500 characters

## Automatic Approval

Uses `requiresApproval` on the **direct target** (facility, area, or asset):

| `requiresApproval` | Initial status | `approvedAt` | `approvedById` |
|--------------------|----------------|--------------|----------------|
| `false` | `APPROVED` | Current timestamp | `null` |
| `true` | `PENDING` | `null` | `null` |

Manager approval/rejection is implemented in the next stage.

## Current Access (`GET /api/my-access`)

Returns approved access that is **currently valid**:

| Type | Valid when |
|------|------------|
| TEMPORARY | `startAt <= now` AND `endAt > now` |
| PERMANENT | `startAt <= now` AND `endAt IS NULL` |

Excluded:

- Pending requests
- Rejected requests
- Expired temporary access
- Future access (not yet started)
- Access whose target resource is inactive

## Inactive Resource Behavior

### New requests

Inactive facilities, areas, or assets **reject** new access requests.

### Historical records

Approved, pending, and rejected requests are **never deleted** when a resource becomes inactive.

### Current access after deactivation

When a facility, area, or asset is deactivated **after** approval:

- The access request record remains in history (`GET /api/access-requests`)
- The access **no longer appears** in `GET /api/my-access`

This treats inactive resources as temporarily unavailable for active use while preserving audit history.

## User Status

Inactive users cannot create requests. The existing `authenticate` middleware blocks inactive users before controllers run.

## Ownership & Privacy

- Users can only list and view their own requests
- Attempting to view another user's request returns `404` (does not reveal existence)

## Assumptions

- `startAt` may be in the past or future; no requirement that it equals "now"
- Equal `startAt` and `endAt` is invalid for temporary access
- Automatic approval sets `approvedById = null` (no manager involved)
- Status filter on list endpoint: `PENDING`, `APPROVED`, or `REJECTED`
- No pagination in this stage

## Response Format

```json
{
  "data": {
    "id": "...",
    "accessType": "TEMPORARY",
    "startAt": "...",
    "endAt": "...",
    "reason": "...",
    "status": "PENDING",
    "approvedAt": null,
    "approvedById": null,
    "rejectionReason": null,
    "createdAt": "...",
    "updatedAt": "...",
    "target": {
      "type": "AREA",
      "id": "...",
      "name": "Server Room",
      "facilityId": "...",
      "facilityName": "Main Campus"
    }
  }
}
```
