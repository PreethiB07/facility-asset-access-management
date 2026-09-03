# E2E Browser Testing

Stage 17 adds [Playwright](https://playwright.dev/) browser tests for critical user journeys across authentication, access requests, manager approval, admin management, and multi-company isolation.

## Prerequisites

- Node.js 18+
- PostgreSQL running with migrations applied and seed data loaded
- Server and client dependencies installed (`npm install` in `server/` and `client/`)
- Playwright browsers installed (see below)

## Environment setup

1. Copy the example env file at the repository root:

   ```bash
   cp .env.e2e.example .env.e2e
   ```

2. Fill in passwords from [demo-accounts.md](demo-accounts.md). **Do not commit `.env.e2e`.**

3. Ensure `server/.env` is configured (database URLs, JWT secret). See the main [README](../README.md).

4. Seed demo data if needed:

   ```bash
   cd server
   npm run db:seed
   ```

## Test accounts (no passwords in repo)

| Company | Role | Email |
|---------|------|-------|
| Acme (A) | USER | `demo.user@example.com` |
| Acme (A) | MANAGER | `demo.manager@example.com` |
| Acme (A) | ADMIN | `demo.admin@example.com` |
| Globex (B) | USER | `globex.user@example.com` |
| Globex (B) | MANAGER | `globex.manager@example.com` |
| Globex (B) | ADMIN | `globex.admin@example.com` |

Passwords are documented in [demo-accounts.md](demo-accounts.md) for local development only.

## Running E2E tests

From the repository root:

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

Playwright starts the backend (`server`, port 3001) and frontend (`client`, port 5173) automatically unless they are already running locally.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_BASE_URL` | `http://localhost:5173` | Frontend base URL |
| `E2E_API_URL` | `http://localhost:3001` | Backend API URL (API helpers) |
| `E2E_ACME_*` / `E2E_GLOBEX_*` | — | Demo account emails and passwords |

### Other commands

```bash
npm run test:e2e:ui      # Playwright UI mode
npm run test:e2e:report  # Open HTML report after a run
npx playwright test --reporter=list
```

## Test organization

```
tests/e2e/
  auth.spec.ts              Login, logout, protected routes
  registration.spec.ts      Public registration → USER role
  facilities.spec.ts        Browse facilities, areas, assets
  access-requests.spec.ts   Facility/area/asset requests, temp/permanent, auto-approve
  approvals.spec.ts         Manager approve/reject workflow
  admin.spec.ts             Admin CRUD for facilities, areas, assets
  tenant-isolation.spec.ts  Multi-company visibility and cross-company blocking
  role-authorization.spec.ts USER / MANAGER / ADMIN route guards
  inactive-resources.spec.ts Inactive facilities, expired temporary access
  errors.spec.ts            Validation and friendly error messages
  helpers/                  Auth, API, credentials, dates, seed constants
```

## Critical journeys covered

- Valid/invalid login and protected route redirect
- Registration with default USER role (default company: Acme)
- Company A user browsing facilities → areas → assets
- Access requests: facility, area, asset (in-area and independent)
- Temporary and permanent access periods
- Automatic approval (`requiresApproval = false`)
- Manager approval and rejection with reason
- Admin create facility (browser); area and asset created via API helpers then verified in admin UI and facility detail (admin modal `<select>` controls do not reliably sync React state under Playwright)
- Company A vs Company B data isolation in the browser
- Direct URL to another company's resource → not found
- Cross-company access request blocked (API, when UI cannot select foreign resources)
- Role-based navigation guards
- Inactive facility hidden/blocked; expired temporary access excluded from My Access
- Form validation and non-leaky error messages

## Not covered (by design)

- **Admin user/role management UI** — no REST API or UI exists yet (see [known-issues.md](known-issues.md))
- Tenant switcher UI
- Password reset / email verification

## Test data strategy

- Uses existing seed data from `server/prisma/seed.ts` (Acme + Globex)
- Creates uniquely named records during admin tests (`E2E Admin …` prefix)
- Registration test creates a disposable user with a unique email
- Access request tests use unique reasons per run to avoid collisions
- Does **not** reset the database or delete shared seed data

## Artifacts

- Screenshots and video: **on failure only**
- Trace: **on first retry**
- Reports: `playwright-report/` (gitignored)

## Known limitations

- Requires demo seed data; tests fail if companies or demo users are missing
- E2E credentials must be supplied via `.env.e2e` (not committed)
- Parallel workers disabled (`workers: 1`) to reduce shared-database contention
- Admin area/asset modal forms: React controlled `<select>` fields may not submit reliably via Playwright; admin test uses API setup for area/asset and browser verification only

## Running with existing unit/API tests

```bash
cd server && npm test
cd client && npm test
cd .. && npm run test:e2e
```
