# PostgreSQL Row-Level Security Architecture

Stage 15 adds **database-level company isolation** using PostgreSQL Row-Level Security (RLS). Application-level `WHERE companyId = …` filters remain as defense-in-depth, but RLS is the authoritative boundary when queries omit tenant filters.

---

## Why RLS Is Required

Stage 14 enforced tenant isolation in REST APIs. A bug, raw query, or future code path that omits `companyId` could still leak cross-company data without RLS. PostgreSQL policies enforce:

```text
row.companyId = current_company_id
```

at the database layer.

---

## Company Context Mechanism

Trusted flow:

```text
JWT (userId, role)
    ↓
getUserById()  [auth lookup context]
    ↓
req.user.companyId
    ↓
runWithCompanyContext(companyId, fn)
    ↓
SET LOCAL app.current_company_id = '<uuid>'   (transaction-scoped)
    ↓
Prisma queries on transaction client
    ↓
PostgreSQL RLS policies
```

**Never** trust `companyId` from request body, query string, or URL for setting database context.

Implementation: `server/src/lib/prisma-tenant.ts`

| Helper | Purpose |
|--------|---------|
| `runWithCompanyContext` | Normal tenant API operations |
| `runWithAuthUserLookup` | JWT `getUserById` before tenant context |
| `runWithAuthEmailLookup` | Login email lookup (limited policy) |
| `runWithSystemBootstrap` | Seed, test cleanup, registration bootstrap |
| `getDb()` | Returns active transaction client inside scopes |

---

## PostgreSQL Session Variable

| Variable | Scope | Purpose |
|----------|-------|---------|
| `app.current_company_id` | Transaction (`SET LOCAL`) | Active tenant for RLS |
| `app.current_user_id` | Transaction | Auth user lookup by id |
| `app.auth_email_lookup` | Transaction | Login email lookup |
| `app.system_bootstrap` | Transaction | Seed/migration-safe bypass |

Helper functions live in PostgreSQL schema `app` (see migration `20260903140000_enable_rls`).

---

## RLS Policies

RLS is enabled (with `FORCE ROW LEVEL SECURITY`) on:

| Table | Policies |
|-------|----------|
| `User` | SELECT/INSERT/UPDATE/DELETE — tenant match + auth lookup exceptions |
| `Facility` | Full CRUD — tenant match or bootstrap |
| `Area` | Full CRUD — tenant match or bootstrap |
| `Asset` | Full CRUD — tenant match or bootstrap |
| `AccessRequest` | Full CRUD — tenant match or bootstrap |
| `Company` | SELECT own tenant; mutations bootstrap-only |

**Company table decision:** Users read only their own company row (`id = current_company_id`). Cross-company company metadata is not exposed. Registration uses `system_bootstrap` to resolve the default company by name.

---

## Connection Pooling Considerations

Prisma uses a connection pool. Tenant context **must not** persist on a pooled connection between requests.

All context is set with:

```sql
SELECT set_config('app.current_company_id', '<uuid>', true);
```

The third argument `true` makes the setting **transaction-local** (`SET LOCAL` semantics). When the Prisma interactive transaction ends, context is discarded — preventing Company A → Company B leakage on reused connections.

---

## Prisma Integration

- Runtime `DATABASE_URL` connects as **`faam_app`** (subject to RLS).
- Migrations use **`DATABASE_DIRECT_URL`** as **`postgres`** (elevated, for schema changes only).
- Services wrap tenant work in `runWithCompanyContext` and use `getDb()` instead of the global client inside scopes.
- Auth/seed paths use dedicated context helpers (not client-supplied company ids).

`schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_DIRECT_URL")
}
```

---

## Runtime vs Migration Database Roles

| Role | Purpose | RLS |
|------|---------|-----|
| `postgres` (direct URL) | Migrations, manual admin | Bypasses RLS (superuser) |
| `faam_app` (app URL) | Application runtime & tests | **Subject to RLS** — no `BYPASSRLS` |

Development default password for `faam_app`: `faam_app_dev` (see migration).

**Do not** grant `BYPASSRLS` to `faam_app` in production.

---

## Failure Behavior (Missing Context)

If no session variable is set and `system_bootstrap` is not active:

- SELECT returns **zero rows** (fail closed).
- INSERT/UPDATE/DELETE are **denied** by policy `WITH CHECK` / `USING` clauses.

This is verified in `server/tests/rls-isolation.test.ts`.

---

## Test Strategy

| File | Coverage |
|------|----------|
| `rls-isolation.test.ts` | Direct SQL without app filters, INSERT/UPDATE/DELETE matrix, BYPASSRLS review, API+RLS chain |
| `company-isolation.test.ts` | Application API cross-company 404s (Stage 14 regression) |
| All other tests | Run under `faam_app` with tenant context via services |

---

## Security Review Checklist

| Risk | Mitigation |
|------|------------|
| Client `companyId` tampering | Ignored by Zod; DB context from authenticated user only |
| JWT company manipulation | JWT has no `companyId`; loaded server-side |
| Connection context leakage | Transaction-local `set_config` |
| RLS bypass via app role | `faam_app` has `rolbypassrls = false` |
| Missing tenant context | Fail closed — no rows returned |
| Cross-company writes | RLS `WITH CHECK` blocks mismatched `companyId` |

---

## Next Stage

Full regression testing, migration verification on fresh and existing databases, and multi-company end-to-end testing.
