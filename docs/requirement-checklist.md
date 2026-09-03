# Requirement Checklist

Final QA audit for the Facility & Asset Access Management Platform.  
Status values: **PASS**, **PARTIAL**, **NOT IMPLEMENTED**

---

## Core Domain

| Requirement | Implementation | Status | Evidence | Notes |
|-------------|----------------|--------|----------|-------|
| Facility management | CRUD via REST (ADMIN mutate); list/detail for all authenticated roles; admin UI | PASS | `server/src/routes/facility.routes.ts`, `client/src/components/admin/FacilityAdminPanel.tsx`, `server/tests/resources.test.ts` | Deactivation via `isActive`, no DELETE |
| Areas within facilities | Areas belong to `facilityId`; nested under facility APIs and UI | PASS | `server/prisma/schema.prisma` (Area.facilityId), `GET /api/facilities/:id`, area admin panel | |
| Assets within areas | Assets with optional `areaId`; list by area endpoint | PASS | `GET /api/areas/:areaId/assets`, facility/area detail pages | |
| Independent facility assets | Assets with `areaId = null` | PASS | `server/src/validators/resource.validators.ts`, `AssetDetailPage`, seed data | Backend validates area belongs to facility when set |
| User authentication | Register, login, JWT, bcrypt | PASS | `server/src/routes/auth.routes.ts`, `server/tests/auth.test.ts` | Registration always creates USER |
| Facility access requests | POST with `facilityId` XOR target | PASS | `access-request.service.ts`, `access-requests.test.ts` | |
| Area access requests | POST with `areaId` | PASS | Same as above | |
| Asset access requests | POST with `assetId` | PASS | Same as above | |
| Temporary access | Requires `startAt` + `endAt`, `endAt > startAt` | PASS | Validators + service + frontend form | UTC stored, ISO in API |
| Permanent access | Requires `startAt`, `endAt = null` | PASS | `mapCreateBodyToInput`, frontend hides end date | |
| Access period expiration | `/api/my-access` filters by time window | PASS | `isCurrentlyValid()`, tests for expired/future | |
| Reasons required | Non-empty trimmed reason | PASS | Zod validators + frontend validation | |
| Request status | PENDING, APPROVED, REJECTED | PASS | Prisma enum, StatusBadge component | |
| Approval information | `approvedAt`, `approvedById` stored; manager response includes approver | PASS | Schema + manager service | Auto-approve sets `approvedById = null` |
| Automatic approval | `requiresApproval = false` → APPROVED immediately | PASS | `createAccessRequest`, auto-approve tests | |
| Manager approval | PATCH approve, MANAGER/ADMIN only | PASS | `access-request-manager.test.ts` | Confirmation modal in UI |
| Manager rejection | PATCH reject with required reason | PASS | Reject modal + backend validator | |
| Current access | GET `/api/my-access` | PASS | `getCurrentAccess`, My Access page | |
| Relevant user requests | Users see own requests only | PASS | `listMyAccessRequests`, ownership tests | Other users' IDs return 404 |
| Inactive facilities | Block new requests; hidden from USER/MANAGER lists | PASS | `resolveAndValidateTarget`, resource filters | |
| Inactive areas | Block new requests; parent checks | PASS | Inactive resource tests | |
| Inactive assets | Block new requests; parent facility/area checks | PASS | Inactive resource tests | |
| Existing approved access when resource deactivated | Excluded from `/api/my-access` | PASS | `isTargetResourceActive` filter, test at `access-requests.test.ts` | History preserved in DB |

---

## Technical Stack

| Requirement | Implementation | Status | Evidence | Notes |
|-------------|----------------|--------|----------|-------|
| Authentication (JWT) | jsonwebtoken, Bearer middleware | PASS | `authenticate.middleware.ts`, `jwt.util.ts` | Secret from env only |
| Authorization (roles) | `requireRole` on privileged routes | PASS | Route files, 403 tests for USER | Frontend checks are UX-only |
| REST APIs | Express routers under `/api` | PASS | `server/src/app.ts` | Consistent `{ data }` wrapper for resources |
| PostgreSQL | Prisma datasource | PASS | `schema.prisma` | |
| Prisma | Models, migrations, seed | PASS | `prisma/migrations/20260903053611_init/` | Single init migration |
| Migrations | `prisma migrate dev` / `migrate deploy` | PASS | `npm run db:migrate`, `db:migrate:deploy` | Not run against production in QA |
| Validation | Zod on all mutating endpoints | PASS | `validators/` directory | |
| Error handling | AppError + error middleware | PASS | No stack traces in responses | Server logs unexpected errors only |
| Automated backend tests | Vitest + Supertest | PASS | 123 tests passing | |
| Frontend | React + TypeScript + Vite | PASS | `client/` | |
| Responsive UX | Mobile drawer nav, facility cards, card layouts | PASS | `AppLayout.tsx`, `index.css` | |
| Demo accounts | Seed + docs for USER/MANAGER/ADMIN | PASS | `docs/demo-accounts.md`, `prisma/seed.ts` | DEVELOPMENT / CHALLENGE ONLY |
| Password visibility toggle | `PasswordInput` on all password fields | PASS | Grep: no raw `type="password"`; `password.test.tsx` | |

---

## Security

| Requirement | Implementation | Status | Evidence | Notes |
|-------------|----------------|--------|----------|-------|
| Passwords hashed | bcrypt 12 rounds | PASS | `auth.service.ts` | Never returned in API |
| JWT secret from env | Required at runtime | PASS | `jwt.util.ts` | Test-only default in test setup |
| Inactive user blocked | Login + authenticate via `getUserById` | PASS | `auth.test.ts` inactive JWT test | |
| USER cannot approve/reject | 403 on manager endpoints | PASS | `access-request-manager.test.ts` | |
| USER cannot manage resources | 403 on POST/PATCH facilities/areas/assets | PASS | `resources.test.ts` | |
| IDOR on access requests | Filter by `requesterId`; others get 404 | PASS | Ownership tests | |
| No client-supplied requesterId | Derived from JWT | PASS | Controller uses `req.user.id` | |
| Concurrency on approve/reject | Conditional `updateMany` | PASS | Manager conflict tests | Second action returns 409 |
| State machine | PENDING → APPROVED/REJECTED only | PASS | `assertPendingStatus`, invalid transition tests | |

---

## Frontend Screens

| Screen | Status | Evidence | Notes |
|--------|--------|----------|-------|
| Login | PASS | `LoginPage.tsx`, auth tests | Branding, dev-only demo email shortcuts, eye toggle |
| Registration | PASS | `RegisterPage.tsx`, auth tests | No role selection |
| Dashboard | PASS | `DashboardPage.tsx` | Welcome message, role-aware stats |
| Facilities | PASS | `FacilitiesPage.tsx` | Card grid, status badges, loading/empty/error |
| Facility details | PASS | `FacilityDetailPage.tsx` | Areas + independent/area assets |
| Area details | PASS | `AreaDetailPage.tsx` | Request access form |
| Asset details | PASS | `AssetDetailPage.tsx` | |
| Access request form | PASS | `AccessRequestForm.tsx`, 9 frontend tests | Sections + toast feedback |
| My Requests | PASS | `AccessRequestsPage.tsx` | Status filter |
| My Access | PASS | `MyAccessPage.tsx` | Permanent/temporary display |
| Manager pending | PASS | `ManagerRequestsPage.tsx` | Confirm + reject modals |
| Admin | PASS | Admin panels + `admin.test.tsx` | ADMIN-only route |

---

## Partial / Out of Scope

| Requirement | Status | Notes |
|-------------|--------|-------|
| Admin user management UI | NOT IMPLEMENTED | Users created via register/seed; no CRUD for roles |
| Password reset / email verification | NOT IMPLEMENTED | Out of original stage scope |
| Browser-based E2E automation | NOT IMPLEMENTED | Covered by API + component tests; manual walkthrough recommended |
| Admin reassign area to different facility | PARTIAL | Edit area does not change parent facility (create-only assignment) |
| Dedicated lint script | NOT IMPLEMENTED | TypeScript strict mode + `typecheck` used instead |

---

## QA Verification (Stage 9)

| Check | Result |
|-------|--------|
| Backend tests (123) | PASS |
| Frontend tests (36) | PASS |
| Backend build | PASS |
| Frontend build | PASS |
| Prisma validate | PASS |
| Password fields have eye toggle | PASS |
| No committed `.env` secrets | PASS |
| Incremental git history (8 feature commits) | PASS |

**Audit date:** Stage 9 final QA
