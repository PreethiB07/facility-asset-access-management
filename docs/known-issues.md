# Known Issues

Documented limitations as of Stage 17 E2E checkpoint.

---

## Database & Environment

| Issue | Impact | Workaround |
|-------|--------|------------|
| `faam_app` role required for runtime | RLS not enforced if `DATABASE_URL` uses `postgres` superuser | Use `DATABASE_URL=postgresql://faam_app:faam_app_dev@...` (see `server/.env.example`) |
| Migrations need elevated role | `prisma migrate deploy` uses `DATABASE_DIRECT_URL` (postgres) | Set both URLs in `.env` |
| `prisma generate` EPERM on Windows | DLL locked when dev server is running | Stop server before `db:seed` / `prisma generate` |
| `db:seed` runs `prisma generate &&` | May fail on Windows with server running | Run `tsx prisma/seed.ts` directly |

---

## Multi-Company

| Issue | Impact | Notes |
|-------|--------|-------|
| No admin user-management API | Admins cannot list/edit users via REST | User CRUD is seed/demo only; admin isolation tested for facilities/areas/assets |
| No platform-level super-admin | Each admin is tenant-scoped | By design for Stage 13–16 |
| Company name globally unique | Cannot have two companies with same name | Schema constraint |
| Login by email only | Same email in two companies requires password match loop | First matching password wins |

---

## PostgreSQL RLS

| Issue | Impact | Notes |
|-------|--------|-------|
| `postgres` superuser bypasses RLS | Dev misconfiguration could skip RLS | Production must use `faam_app` (no `BYPASSRLS`) |
| Bootstrap context for seed/tests | `runWithSystemBootstrap` bypasses RLS intentionally | Not available to normal API paths |
| Nested Prisma transactions | Each API call uses its own transaction scope | Acceptable; context is transaction-local |

---

## Testing

| Issue | Impact | Notes |
|-------|--------|-------|
| Playwright E2E uses shared dev DB | Admin tests create `E2E Admin …` facilities; registration creates users | No DB reset; `workers: 1` reduces contention |
| Admin area/asset modal + Playwright | Browser cannot reliably submit admin area/asset modals | Admin E2E creates facility in UI; area/asset via API helpers with UI verification |
| Test parallel file execution | Rare cross-file pollution if cleanup fails | Prefix-based cleanup; 173 server + 42 client + 30 E2E tests passing |

---

## Frontend

| Issue | Impact | Notes |
|-------|--------|-------|
| No tenant switcher UI | Users cannot select company in UI | Company derived from login account |
| `companyId` not shown in most UI | Informational only | Available on `/api/auth/me` |
