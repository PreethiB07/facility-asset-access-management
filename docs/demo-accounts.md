# Demo Accounts

These credentials are for **local/development challenge demonstration only**.

Do not use these accounts in production environments.

## Company A — Acme Corporation

### USER

**Email:** demo.user@example.com  
**Password:** DemoUser@123  
**Role:** USER

### MANAGER

**Email:** demo.manager@example.com  
**Password:** DemoManager@123  
**Role:** MANAGER

### ADMIN

**Email:** demo.admin@example.com  
**Password:** DemoAdmin@123  
**Role:** ADMIN

## Company B — Globex Industries

### USER

**Email:** globex.user@example.com  
**Password:** GlobexUser@123  
**Role:** USER

### MANAGER

**Email:** globex.manager@example.com  
**Password:** GlobexManager@123  
**Role:** MANAGER

### ADMIN

**Email:** globex.admin@example.com  
**Password:** GlobexAdmin@123  
**Role:** ADMIN

## Seeding

Run from the `server` directory:

```bash
npm run db:seed
```

This creates or updates both companies with properly hashed passwords and isolated demo data. Email uniqueness is per company — the same email can exist in different companies with different passwords.

## Multi-Company Testing

- Acme users see Acme facilities, areas, and assets.
- Globex users see Globex facilities, areas, and assets.
- Cross-company access is not permitted (API tenant filtering in Stage 14+; database RLS in a later stage).

See [multi-company-design.md](multi-company-design.md) for architecture details.
