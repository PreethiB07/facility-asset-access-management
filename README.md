# Facility & Asset Access Management

A SaaS platform for managing facility and asset access requests, approvals, and permissions.

## Purpose

This application enables organizations to manage facilities, areas, and assets, and to control who can request and receive access through a structured approval workflow.

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React, TypeScript, Vite, React Router, Axios |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, Prisma |
| Auth | JWT, bcrypt |
| API | REST |

## Project Structure

```
facility-asset-access-management/
├── client/                 # React frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       ├── hooks/
│       ├── context/
│       └── types/
├── server/                 # Express backend
│   └── src/
│       ├── controllers/
│       ├── routes/
│       ├── services/
│       ├── middleware/
│       ├── validators/
│       └── types/
│   ├── prisma/
│   └── tests/
└── docs/
    ├── cursor-prompts.md
    └── database-design.md
    └── access-request-workflow.md
```

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 14+

## Environment Configuration

Copy the example environment files and fill in values locally (never commit `.env`):

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### Backend (`server/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default: `24h`) |
| `PORT` | Backend server port (default: `3001`) |
| `SEED_*_PASSWORD` | Development seed passwords (hashed at runtime) |

### Frontend (`client/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL (default in dev: use Vite proxy with `/api`) |

Example:

```text
VITE_API_URL=http://localhost:3001/api
```

During local development, you can omit `client/.env` and rely on the Vite dev-server proxy (`/api` → `http://localhost:3001`).

## Install Dependencies

```bash
# Backend
cd server && npm install

# Frontend
cd client && npm install
```

## Database Setup

```bash
cd server
npm run db:migrate
npm run db:seed
```

## Start the Backend

```bash
cd server
npm run dev
```

The API runs at `http://localhost:3001`.

## Start the Frontend

```bash
cd client
npm run dev
```

The app runs at `http://localhost:5173`. API requests to `/api/*` are proxied to the backend during development when using the default Vite configuration.

## Frontend Application

The React frontend consumes the existing REST APIs. Business rules and authorization remain enforced on the backend.

### Frontend Routes

| Path | Auth | Description |
|------|------|-------------|
| `/login` | No | User login |
| `/register` | No | User registration (creates `USER` role only) |
| `/dashboard` | Yes | Summary cards for requests and access |
| `/facilities` | Yes | List active facilities |
| `/facilities/:id` | Yes | Facility detail, areas, assets, request access |
| `/areas/:id` | Yes | Area detail and request access |
| `/assets/:id` | Yes | Asset detail and request access |
| `/access-requests` | Yes | Own access requests (filter by status) |
| `/access-requests/:id` | Yes | Own request details |
| `/my-access` | Yes | Currently valid approved access |
| `/manager/requests` | Manager/Admin | Pending approvals with approve/reject |
| `/admin` | Admin only | Manage facilities, areas, and assets |

Unauthenticated users attempting protected routes are redirected to `/login`.

### Authentication Flow (Frontend)

1. On startup, the app checks for a stored JWT in `localStorage`.
2. If present, it calls `GET /api/auth/me` to restore the user profile.
3. Invalid/expired tokens clear auth state and redirect to login on protected routes.
4. Axios attaches `Authorization: Bearer <token>` to authenticated requests.
5. A `401` response (except login/register) clears auth state.

Registration redirects to login after success. Login routes users to `/dashboard` regardless of role; navigation adapts by role.

### Role-Based UI

| Role | Navigation extras |
|------|-------------------|
| `USER` | Dashboard, Facilities, My Requests, My Access |
| `MANAGER` | + Pending Approvals |
| `ADMIN` | + Pending Approvals, Administration |

Frontend role checks are for UX only. All privileged API operations remain protected server-side.

### Frontend Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check and production build |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run frontend tests (Vitest + Testing Library) |

### API Integration

Centralized Axios client: `client/src/services/api.ts`

Service modules:

- `auth.service.ts` — register, login, me
- `facility.service.ts` — facilities
- `area.service.ts` — areas and area assets
- `asset.service.ts` — assets
- `accessRequest.service.ts` — access requests, my access, manager actions

Base URL: `import.meta.env.VITE_API_URL || '/api'`

### Admin Management UI

Admins can access `/admin` to:

- Create and edit facilities, areas, and assets
- Activate/deactivate resources (`isActive = false`, no deletion)
- Configure `requiresApproval` per resource with inline help text

The admin route is protected by `AdminRoute` (frontend) and `requireRole(Role.ADMIN)` on backend mutation endpoints.

### UX Features

- Reusable `PasswordInput` with accessible show/hide toggle on all password fields
- Lightweight toast notifications for success and error feedback
- Confirmation modal before approving access requests
- Rejection modal with required reason
- Structured access request form with target, period, and reason sections
- Loading, error, and empty states on all API-driven pages
- Responsive table/card layouts for mobile
- Consistent date formatting in the user's local timezone

## Running Tests

```bash
# Backend (123 tests)
cd server && npm test

# Frontend (36 tests)
cd client && npm test

# Production builds
cd server && npm run build
cd client && npm run build
```

## Authentication

Authentication uses **JWT bearer tokens** and **bcrypt** password hashing.

### Flow

1. **Register** — `POST /api/auth/register` creates a new user with role `USER` and returns a JWT.
2. **Login** — `POST /api/auth/login` validates credentials and returns a JWT.
3. **Authenticated requests** — send `Authorization: Bearer <token>`.
4. **Current user** — `GET /api/auth/me` returns the authenticated user's safe profile.

### Roles

| Role | Description |
|------|-------------|
| `USER` | Standard user; default for registration |
| `MANAGER` | Can approve/reject pending access requests |
| `ADMIN` | Full administrative access (API); admin UI in Stage 8 |

Registration always creates `USER` accounts. Privileged roles are assigned via seed data or future admin tooling — not through public registration.

### Auth Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Register a new user |
| POST | `/api/auth/login` | No | Login and receive JWT |
| GET | `/api/auth/me` | Yes | Current user profile |
| GET | `/api/auth/protected-test` | Yes | Auth middleware test route |

### Security Decisions

- Passwords are hashed with bcrypt (12 rounds); never stored or returned in plaintext.
- JWT payload contains only `userId` and `role` — no sensitive data.
- `JWT_SECRET` is loaded from environment variables only.
- Role authorization is enforced server-side via `requireRole` middleware.
- Inactive users cannot log in or use valid tokens.

### Error Format

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

## Resource APIs

All resource endpoints require JWT authentication. Responses use `{ "data": ... }` for single resources and `{ "data": [...] }` for collections.

### Authorization Rules

| Operation | USER | MANAGER | ADMIN |
|-----------|------|---------|-------|
| View facilities, areas, assets | Yes | Yes | Yes |
| Create/update resources | No | No | Yes |

Administrative mutations are enforced server-side via `requireRole(Role.ADMIN)`.

### Inactive Resources

- Resources are deactivated with `isActive: false` (no DELETE endpoints).
- **USER / MANAGER:** default to active resources only (`?active=true` implicit).
- **ADMIN:** sees all resources by default; use `?active=true` or `?active=false` to filter.
- Historical access requests are preserved when resources are deactivated.

### Facility Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/facilities` | Yes | List facilities |
| GET | `/api/facilities/:id` | Yes | Facility detail with areas |
| POST | `/api/facilities` | Admin | Create facility |
| PATCH | `/api/facilities/:id` | Admin | Update/deactivate facility |
| GET | `/api/facilities/:facilityId/areas` | Yes | List areas in facility |
| POST | `/api/facilities/:facilityId/areas` | Admin | Create area |

### Area Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/areas/:id` | Yes | Area detail |
| PATCH | `/api/areas/:id` | Admin | Update/deactivate area |
| GET | `/api/areas/:areaId/assets` | Yes | List assets in area |

### Asset Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/assets` | Yes | List all assets |
| GET | `/api/assets/:id` | Yes | Asset detail |
| POST | `/api/assets` | Admin | Create asset |
| PATCH | `/api/assets/:id` | Admin | Update/deactivate asset |

Assets may belong to an area (`areaId` set) or directly to a facility (`areaId = null`). When `areaId` is provided, it must belong to the specified `facilityId`.

### Query Parameters

| Param | Values | Description |
|-------|--------|-------------|
| `active` | `true`, `false` | Filter by active status (admin can omit for all) |

## Access Request APIs

All access request endpoints require JWT authentication. See [docs/access-request-workflow.md](docs/access-request-workflow.md) for full details.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/access-requests` | Create access request (requester from JWT) |
| GET | `/api/access-requests` | List own requests (`?status=PENDING\|APPROVED\|REJECTED`) |
| GET | `/api/access-requests/:id` | View own request details |
| GET | `/api/my-access` | Currently valid approved access |
| GET | `/api/access-requests/pending` | List pending requests (Manager/Admin) |
| PATCH | `/api/access-requests/:id/approve` | Approve request (Manager/Admin) |
| PATCH | `/api/access-requests/:id/reject` | Reject request (Manager/Admin) |

### Key Rules

- Exactly one target: `facilityId`, `areaId`, or `assetId`
- Inactive resources reject new requests; history is preserved
- Auto-approve when `requiresApproval = false`; otherwise `PENDING`
- Temporary access requires `endAt > startAt`; permanent access has no `endAt`
- Users can only view their own requests
- Managers/Admins approve or reject pending requests; state machine enforced
- Approval blocked for inactive targets or expired temporary periods

## Health Endpoint

```
GET /api/health
```

Response:

```json
{
  "status": "ok"
}
```

## Planned Development Stages

1. ~~Repository & project scaffold~~
2. ~~PostgreSQL + Prisma database setup~~
3. ~~Authentication (JWT + bcrypt)~~
4. ~~Facilities, areas, and assets REST APIs~~
5. ~~Access request creation workflow~~
6. ~~Manager approval and rejection workflow~~
7. ~~React frontend — authentication, facilities, access requests, manager dashboard~~
8. ~~Admin management UI + application polish + final testing/review~~
9. Final QA, security review, bug fixing and challenge submission preparation

## Scripts

| Location | Command | Description |
|----------|---------|-------------|
| `server/` | `npm run dev` | Start backend in watch mode |
| `server/` | `npm run build` | Compile TypeScript |
| `server/` | `npm run typecheck` | Type-check without emitting |
| `server/` | `npm test` | Run backend API tests |
| `server/` | `npm run db:migrate` | Run Prisma migrations |
| `server/` | `npm run db:seed` | Seed development data |
| `client/` | `npm run dev` | Start Vite dev server |
| `client/` | `npm run build` | Type-check and production build |
| `client/` | `npm run typecheck` | Type-check without emitting |
| `client/` | `npm test` | Run frontend tests |
