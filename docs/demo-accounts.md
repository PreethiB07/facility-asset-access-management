# Demo Accounts

These credentials are for **local/development challenge demonstration only**.

Do not use these accounts in production environments.

## USER

**Email:** demo.user@example.com

**Password:** DemoUser@123

**Role:** USER

Use this account to:

- Browse facilities
- Request access
- View requests
- View current access

## MANAGER

**Email:** demo.manager@example.com

**Password:** DemoManager@123

**Role:** MANAGER

Use this account to:

- View pending requests
- Approve requests
- Reject requests

## ADMIN

**Email:** demo.admin@example.com

**Password:** DemoAdmin@123

**Role:** ADMIN

Use this account to:

- Manage facilities
- Manage areas
- Manage assets
- Review approvals

## Seeding

Run from the `server` directory:

```bash
npm run db:seed
```

This creates or updates the demo accounts with properly hashed passwords. Repeated seeding uses upsert on email addresses so duplicate users are not created.
