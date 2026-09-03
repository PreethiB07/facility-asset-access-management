# Known Issues

Documented at final QA (Stage 9). Only genuine, non-critical items are listed.

---

## Issue: No automated browser E2E tests

**Impact:** Full user journeys (register → login → browse → request → approve) are verified via API/component tests and manual walkthrough, not Playwright/Cypress.

**Workaround:** Run backend + frontend locally and follow the manual test flows in the README.

**Future improvement:** Add Playwright or Cypress smoke tests for critical paths.

---

## Issue: Admin cannot reassign an area to a different facility when editing

**Impact:** Admins must create a new area under the correct facility if a area was assigned to the wrong facility initially.

**Workaround:** Deactivate the incorrect area and create a new one under the intended facility.

**Future improvement:** Allow facility change on area edit with backend validation.

---

## Issue: No admin UI for user/role management

**Impact:** MANAGER and ADMIN accounts must be created via database seed or direct DB update; public registration always creates USER.

**Workaround:** Use `npm run db:seed` with `SEED_*_PASSWORD` env vars for development/demo accounts.

**Future improvement:** Admin user management screen with role assignment audit trail.

---

## Issue: JWT stored in localStorage

**Impact:** Standard SPA tradeoff; tokens are vulnerable to XSS if malicious scripts run in the app origin.

**Workaround:** Backend enforces short-ish TTL via `JWT_EXPIRES_IN`; no sensitive data in JWT payload; CSP recommended for production deployment.

**Future improvement:** HttpOnly cookie-based session or refresh-token rotation for production hardening.

---

## Critical issues

**No known critical issues at final QA.** All 159 automated tests pass; authorization and business rules are enforced server-side.
