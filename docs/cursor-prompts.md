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
