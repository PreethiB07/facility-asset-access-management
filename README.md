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
```

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 14+

## Environment Configuration

Copy the example environment file and fill in values locally (never commit `.env`):

```bash
cp server/.env.example server/.env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default: `24h`) |
| `PORT` | Backend server port (default: `3001`) |
| `SEED_*_PASSWORD` | Development seed passwords (hashed at runtime) |

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

The app runs at `http://localhost:5173`. API requests to `/api/*` are proxied to the backend during development.

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
| `MANAGER` | Can approve access requests *(future stages)* |
| `ADMIN` | Full administrative access *(future stages)* |

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
4. Facilities, areas, and assets CRUD
5. Access requests and manager approval workflow
6. Automated API and business-logic tests

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
