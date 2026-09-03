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
