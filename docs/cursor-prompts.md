# Cursor Prompts

This document records the prompts used to build the Facility & Asset Access Management Platform incrementally.

## Stage 1 — Repository & Initial Project Setup

### Prompt

We are building a Facility & Asset Access Management Platform (SaaS) using:

- React + TypeScript + Vite
- Node.js + Express + TypeScript
- PostgreSQL
- Prisma
- REST APIs
- JWT Authentication
- bcrypt
- Automated API/business-logic tests

**Working rules:** Work incrementally; one stage at a time; commit and push after each stage; never commit secrets; never bulk-commit the entire application.

**This stage (Steps 1–6):**

1. Create the GitHub repository `facility-asset-access-management` (private).
2. Initialize local Git, connect remote, add `.gitignore`.
3. Scaffold `client/` (React + TypeScript + Vite + React Router + Axios) and `server/` (Express + TypeScript + dotenv) directory structure.
4. Add `server/.env.example` with `DATABASE_URL`, `JWT_SECRET`, `PORT` placeholders.
5. Create minimal Express server with `GET /api/health` returning `{ "status": "ok" }`.
6. Create basic React page showing the application is running.
7. Update `README.md` with project overview, stack, structure, and setup instructions.
8. Verify installs, TypeScript, and builds; commit as `chore: initialize full stack project` and push.

**Explicitly out of scope for this stage:** Prisma models, authentication, JWT implementation, facilities, areas, assets, access requests, manager approval, business logic.

### Purpose

Establish the repository, monorepo folder layout, development tooling, and a verified health-check baseline before adding database and business features in subsequent stages.

---

## Stage 2 — PostgreSQL + Prisma Database Implementation

### Prompt

Implement the PostgreSQL database layer using Prisma with models for User, Facility, Area, Asset, and AccessRequest; enums for roles, access types, and request status; indexes; initial migration; seed data; and `docs/database-design.md`.

Key rules: exactly one access-request target (facility OR area OR asset) validated at service layer; temporary vs permanent access periods; `requiresApproval` fields for future workflow; preserve access history when resources become inactive; no auth/API/business logic in this stage.

Commit as: `chore: configure prisma database and seed data`

### What was generated

- `server/prisma/schema.prisma` — five models, three enums, indexes, `onDelete: Restrict` / `SetNull` relations
- `server/prisma/migrations/20260903053611_init/migration.sql` — initial migration
- `server/prisma/seed.ts` — development seed (users, facilities, areas, assets, sample access requests)
- `docs/database-design.md` — entity/relationship/enum documentation
- Updated `server/package.json` with Prisma scripts and seed config
- Updated `server/.env.example` with `SEED_*_PASSWORD` placeholders

### Review notes

- Prisma 7 was initially installed but rejected: it requires `prisma.config.ts` instead of `url = env("DATABASE_URL")`. Downgraded to **Prisma 6.19.x** for compatibility with existing env configuration.
- Access-request XOR target rule documented for service-layer validation (not DB constraint).
- Seed passwords hashed at runtime from env vars; no plaintext passwords in source code.
- `approvedById` used as FK field name (maps to `approvedBy` relation in Prisma).

### Important design decisions

- **Prisma 6 over 7:** Stable `DATABASE_URL` in schema; avoids Prisma 7 breaking config changes.
- **`onDelete: Restrict`** on facility/area/asset/requester FKs to preserve access-request history.
- **`onDelete: SetNull`** on approver FK so approver removal does not cascade-delete requests.
- **No physical deletion** of expired temporary access; expiration checked at query time.

### Rejected suggestions

- Prisma 8 RC / Prisma 7 — engine/version mismatch and new config format; not suitable for this stage.
- Hardcoded seed passwords in source — replaced with env-var-based hashing.

---

## Stage 3 — JWT Authentication & Authorization

### Prompt

Implement secure authentication and role-based authorization: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`; JWT middleware; `requireRole` middleware; Zod validation; consistent error format; Vitest + Supertest API tests; protected test routes.

Commit as: `feat: implement jwt authentication and authorization`

### What was generated

- `server/src/services/auth.service.ts` — register, login, getUserById
- `server/src/middleware/authenticate.middleware.ts` — JWT auth + `requireRole`
- `server/src/middleware/error.middleware.ts` — centralized error handler
- `server/src/controllers/auth.controller.ts` — auth route handlers
- `server/src/routes/auth.routes.ts` — auth and protected-test routes
- `server/src/validators/auth.validators.ts` — Zod schemas
- `server/src/utils/jwt.util.ts` — sign/verify JWT
- `server/tests/auth.test.ts` — 28 automated API tests

### Review notes

- Existing Prisma `User` model reused without schema changes.
- Registration always assigns `USER` role; no client-controlled role escalation.
- Login returns generic "Invalid email or password" to avoid account enumeration.
- Inactive users blocked at login (403) and on authenticated requests (403).
- Test users use `@auth-test.example.com` domain and are cleaned up after tests.

### Important design decisions

- **JWT payload minimal:** only `userId` and `role`; user re-fetched from DB on each request to verify active status.
- **Exact role matching:** `requireRole('MANAGER')` does not grant access to ADMIN users unless both roles are listed.
- **Zod at API boundary:** all request bodies validated before service layer.
- **Protected test routes** under `/api/auth/protected-test/*` for middleware verification only.

### Rejected suggestions

- Trusting role from JWT alone without DB lookup for `isActive` — rejected; middleware re-validates user state.
- Allowing role selection during registration — rejected per security requirements.

---

## Stage 4 — Facility, Area & Asset REST APIs

### Prompt

Implement REST APIs to browse and manage facilities, areas, and assets using existing Prisma models and JWT auth. GET endpoints for authenticated users; POST/PATCH for ADMIN only; Zod validation; inactive resource filtering; `{ data: ... }` response format; comprehensive API tests.

Commit as: `feat: add facility area and asset APIs`

### What was generated

- `server/src/services/facility.service.ts`, `area.service.ts`, `asset.service.ts`
- `server/src/controllers/facility.controller.ts`, `area.controller.ts`, `asset.controller.ts`
- `server/src/routes/facility.routes.ts`, `area.routes.ts`, `asset.routes.ts`
- `server/src/validators/resource.validators.ts` — Zod schemas for create/update
- `server/src/types/resource.types.ts` — response mappers (no internal fields)
- `server/src/utils/query.util.ts` — active/inactive filter by role
- `server/tests/resources.test.ts` — 27 resource API tests

### Review notes

- No Prisma schema changes required.
- Deactivation via `isActive: false` on PATCH; no DELETE endpoints.
- Asset `areaId` optional; facility/area consistency validated in service layer.
- USER/MANAGER see active resources by default; ADMIN sees all unless filtered.

### Important design decisions

- **`{ data }` wrapper** for resource APIs (auth endpoints retain existing format).
- **ADMIN-only mutations** — MANAGER cannot create/update resources in this stage.
- **Area-facility integrity** — creating/updating assets validates `areaId` belongs to `facilityId`.
- **Inactive filtering at query level** — inactive resources hidden from normal users without deletion.

### Rejected suggestions

- DELETE endpoints — rejected; deactivation preserves access-request history.
- MANAGER write access — rejected; only ADMIN per stage requirements.

---

## Stage 5 — Access Request Workflow

### Prompt

Implement access request creation, listing, detail view, and current access endpoints. Support facility/area/asset targets, temporary/permanent access, automatic vs pending approval, inactive resource validation, and comprehensive tests. Manager approval deferred to next stage.

Commit as: `feat: implement access request workflow`

### What was generated

- `server/src/services/access-request.service.ts` — target validation, approval logic, current access
- `server/src/controllers/access-request.controller.ts`
- `server/src/routes/access-request.routes.ts`
- `server/src/validators/access-request.validators.ts` — XOR target + access type rules
- `server/src/types/access-request.types.ts`
- `docs/access-request-workflow.md`
- `server/tests/access-requests.test.ts` — 37 tests

### Review notes

- No Prisma schema changes; existing `AccessRequest` model reused.
- Requester always from authenticated user; no client-supplied requester ID.
- Inactive target resources reject new requests; approved history preserved.
- Deactivated resources exclude access from `/api/my-access` but remain in request history.

### Important design decisions

- **Auto-approval:** `requiresApproval = false` → `APPROVED` with `approvedAt` set, `approvedById = null`.
- **Permanent + endAt:** rejected at validation (not silently normalized).
- **Privacy:** other users' requests return 404, not 403.
- **Current access:** requires target resource still active in addition to time window checks.

### Rejected suggestions

- Normalizing permanent requests by stripping `endAt` — rejected; explicit rejection preferred.
- Manager viewing all requests in this stage — deferred to approval workflow stage.

---

## Stage 6 — Manager Approval & Rejection Workflow

### Prompt

Implement manager workflow: `GET /api/access-requests/pending`, `PATCH .../approve`, `PATCH .../reject` for MANAGER/ADMIN; state machine; approver tracking; inactive/expired validation; concurrent state protection; comprehensive tests.

Commit as: `feat: add manager approval workflow`

### What was generated

- Extended `access-request.service.ts` with pending list, approve, reject
- Manager handlers in `access-request.controller.ts`
- Routes with `requireRole(MANAGER, ADMIN)` on manager endpoints
- `rejectAccessRequestSchema` validator
- `server/tests/access-request-manager.test.ts` — 31 tests

### Important design decisions

- **State machine:** only `PENDING → APPROVED | REJECTED`; invalid transitions return 409
- **Conditional updateMany:** prevents double-processing concurrent manager actions
- **Approval re-validation:** inactive targets and expired temporary periods blocked at approval time
- **Reject still allowed** on inactive targets (manager can deny without granting access)
- **No schema changes:** existing `approvedById`, `approvedAt`, `rejectionReason` fields reused

### Rejected suggestions

- Distributed locking — rejected; conditional DB update is sufficient for this stage.

---

## Stage 7 — React Frontend Application

### Prompt

Build a functional React + TypeScript frontend for user registration, login, authentication state, facilities/areas/assets browsing, access request creation, my requests/access, manager pending approvals with approve/reject workflow, role-based navigation, loading/error/empty states, frontend tests, and documentation updates.

Key rules: consume existing REST APIs; do not duplicate backend business logic; backend remains authoritative for authorization; use React Router, Axios, centralized API client with `VITE_API_URL`; protected routes; auth context with token persistence and `/auth/me` restore.

Commit as: `feat: build react frontend for access management`

### What was generated

- `client/.env.example` — `VITE_API_URL`
- `client/src/services/` — `api.ts`, auth/facility/area/asset/accessRequest services
- `client/src/context/AuthContext.tsx` — auth provider with login/register/logout/loadCurrentUser
- `client/src/routes/` — `ProtectedRoute`, `ManagerRoute`
- `client/src/components/` — layout, common states, access request form, reject modal
- `client/src/pages/` — login, register, dashboard, facilities, facility/area/asset details, access requests, my access, manager requests, admin placeholder
- `client/src/types/index.ts` — shared frontend types
- `client/src/tests/` — auth, access request form, manager, routing tests (Vitest + Testing Library)
- Updated `README.md` with frontend setup, routes, auth flow, and API integration

### Review notes

- Vite dev proxy (`/api` → port 3001) used when `VITE_API_URL` is unset.
- JWT stored in `localStorage`; cleared on logout and global 401 handling.
- Admin page is a placeholder; full admin CRUD UI deferred to Stage 8.
- Removed Stage 1 health-check homepage in favor of authenticated app shell.

### Important design decisions

- **Service layer:** Axios calls isolated from page components.
- **Role-aware nav:** Manager/Admin see Pending Approvals; Admin sees Administration link.
- **Access request form:** Client validation for temporary/permanent date rules; backend validation still mandatory.
- **Manager reject modal:** Requires non-empty rejection reason before API call.

### Rejected suggestions

- Separate apps per role — rejected; single app with role-based navigation.
- Duplicating approval/auto-approve logic in frontend — rejected; display driven by API response status.

---

## Stage 8 — Admin Features, UX Polish & Application Quality

### Prompt

Polish UX across all forms and pages; add password visibility toggles; improve loading/error/empty states; responsive design; accessibility; admin CRUD UI for facilities/areas/assets; confirmation dialogs; toast feedback; frontend tests; documentation.

Commit as: `feat: polish ux and add admin management`

### What was generated

- `PasswordInput` component with accessible eye toggle
- `ToastProvider` for lightweight success/error notifications
- `ConfirmModal` for approve confirmation (replacing `window.confirm`)
- Improved login/register validation and password requirements display
- Restructured access request form with clear sections
- Admin panels: `FacilityAdminPanel`, `AreaAdminPanel`, `AssetAdminPanel` on `/admin`
- `AdminRoute` restricting admin pages to ADMIN role
- Extended facility/area/asset services with create/update API calls
- Responsive table/card layouts for manager and admin lists
- Updated frontend tests (36 total including password, admin, manager confirmation)

### Important design decisions

- **No new UI libraries** — toasts and modals implemented with existing CSS/React state
- **Deactivation over deletion** — admin UI toggles `isActive` consistent with backend
- **Area/facility validation** — asset form validates area belongs to selected facility client-side; backend remains authoritative
- **Dual layout** — desktop tables + mobile cards via CSS utility classes

### Rejected suggestions

- Adding a toast library (e.g. react-hot-toast) — rejected; lightweight custom solution sufficient.

---

## Stage 9 — Final QA, Security Review, Bug Fixing & Submission Preparation

### Prompt

Final QA: requirement audit, database/migration review, authentication/authorization/IDOR/validation review, business rule verification, frontend UX/accessibility/responsive review, test coverage review, documentation (README, requirement checklist, known issues), git review, submission preparation.

Commit as: `chore: complete final qa and submission review`

### What was reviewed

- Prisma schema relationships, FK behavior, indexes, XOR access-request targets
- JWT/bcrypt security, inactive user handling, role authorization on all privileged APIs
- Access request state machine, expiration, inactive resources, concurrency (409)
- Frontend password toggles, loading/error/empty states, admin/manager flows
- 123 backend + 36 frontend automated tests (all passing)
- `.gitignore` for env files; `.env.example` placeholders only

### What was generated

- `docs/requirement-checklist.md` — honest PASS/PARTIAL/NOT IMPLEMENTED audit
- `docs/known-issues.md` — documented non-critical limitations
- README finalization (architecture, roles, workflows, how to run, documentation index)
- `.gitignore` update for `.env.production`

### Review notes

- No critical defects found during QA; no application code changes required
- Manual browser E2E recommended before demo; not automated in repo
- Server `console.error` retained for unexpected errors only (not exposed to clients)
- Seed/dev `console.log` in `seed.ts` and startup message in `index.ts` are intentional

---

## Stage 10 — UI Enhancement, Demo Accounts & Final Presentation Polish

### Prompt

Polish UI/UX across all screens, create reusable design system components (PageHeader, ResourceStatusBadge, Spinner, improved Empty/Error/Loading states), mobile drawer navigation, enhanced dashboard with welcome message and role-specific stats, facility card layout, request details layout, admin deactivate confirmations, development demo accounts with upsert seeding, and `docs/demo-accounts.md`.

Commit as: `chore: finalize ui and demo experience`

### What was implemented

- Demo accounts: `demo.user@example.com`, `demo.manager@example.com`, `demo.admin@example.com` (passwords hashed in seed; documented in `docs/demo-accounts.md`)
- Seed data with realistic facility/area/asset names; upsert for users
- UI components: `PageHeader`, `Spinner`, `ResourceStatusBadge`, `ApprovalBadge`; enhanced `EmptyState`, `ErrorState`, `LoadingState`
- Mobile navigation drawer in `AppLayout`; role badge and user meta in header
- Login/register branding; dev-only demo email shortcuts (no passwords in UI)
- Facility cards grid; polished access request detail page
- Admin facility deactivate confirmation modal
- Frontend navigation tests for USER/MANAGER/ADMIN roles

### Important design decisions (confirmed at QA)

- **Inactive resource + approved access:** Historical requests preserved; current access excluded when target deactivated
- **Ownership privacy:** Other users' request IDs return 404, not 403
- **Auto-approve:** `approvedById = null` for system/auto approval
- **Timestamps:** Stored as UTC `DateTime`; API returns ISO strings; frontend displays local timezone

### Rejected at QA

- Large refactors or new features — rejected; focus on correctness and documentation
- `prisma migrate reset` on shared databases — not run; deploy flow documented instead

---

## Stage 13 — Multi-Company Support: Architecture & Database Schema

### Prompt

Add Company model and companyId to User, Facility, Area, Asset, AccessRequest. Safe migration with legacy Acme Corporation backfill. Database triggers for cross-entity consistency. Two-company seed data. Company context helper. Document RLS planned architecture.

Commit as: `feat: add multi-company data model`

### What was implemented

- `Company` model with unique `name`
- Per-company email uniqueness (`@@unique([companyId, email])`)
- Migration `20260903130000_add_multi_company` with backfill + PostgreSQL triggers
- `getCompanyContext()` in `server/src/utils/company-context.ts`
- JWT remains `{ userId, role }`; company derived server-side
- Seed: Acme Corporation + Globex Industries with isolated demo data
- `docs/multi-company-design.md` with API impact list and test plan

### Next stage

Update REST APIs and authorization for company isolation (tenant-scoped queries).

---

## Stage 14 — Company Isolation in REST APIs & Authorization

### Prompt

Enforce company isolation on all REST endpoints. Cross-company access returns 404. Add cross-company tests with Acme and Globex demo users.

### What was implemented

- All facility/area/asset list/get/update scoped by `companyId`
- Access request create validates target resource company; list/pending/approve/reject scoped
- Controllers pass `getCompanyContextFromRequest()` to all service calls
- `GLOBEX_COMPANY_ID` constant; Globex demo users in test setup
- `tests/company-isolation.test.ts` — 26 cross-company tests

### Next stage

Implement PostgreSQL Row-Level Security.

---

## Stage 15 — PostgreSQL Row-Level Security (RLS)

### Prompt

Add database-level company isolation via PostgreSQL RLS, transaction-local session context, `faam_app` runtime role, and direct SQL isolation tests.

### What was implemented

- Migration `20260903140000_enable_rls` with `app` schema helpers and RLS policies
- `server/src/lib/prisma-tenant.ts` — `runWithCompanyContext`, `SET LOCAL` via `set_config`
- `DATABASE_URL` → `faam_app`; `DATABASE_DIRECT_URL` → `postgres` for migrations
- `docs/rls-architecture.md`
- `tests/rls-isolation.test.ts` — unfiltered SQL tests, INSERT/UPDATE/DELETE matrix

### Next stage

Full regression testing, migration verification, and multi-company end-to-end testing.

---

## Stage 16 — Multi-Company Regression & Checkpoint

### Prompt

Verify multi-company requirement across full stack; run regression tests; document known issues; checkpoint report.

### What was implemented

- `tests/multi-company-regression.test.ts` — tenant visibility, manager/admin isolation, E2E access flow, migration integrity
- `docs/known-issues.md` — documented limitations
- 173 backend + 42 frontend tests passing
