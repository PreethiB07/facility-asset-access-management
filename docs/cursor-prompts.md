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
