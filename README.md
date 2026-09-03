# Facility & Asset Access Management

A SaaS platform for managing facility and asset access requests, approvals, and permissions.

## Purpose

This application enables organizations to manage facilities, areas, and assets, and to control who can request and receive access through a structured approval workflow.

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React, TypeScript, Vite, React Router, Axios |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, Prisma *(planned)* |
| Auth | JWT, bcrypt *(planned)* |
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
    └── cursor-prompts.md
```

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 14+ *(required in a later stage)*

## Environment Configuration

Copy the example environment file and fill in values locally (never commit `.env`):

```bash
cp server/.env.example server/.env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string *(used in a later stage)* |
| `JWT_SECRET` | Secret for signing JWT tokens *(used in a later stage)* |
| `PORT` | Backend server port (default: `3001`) |

## Install Dependencies

```bash
# Backend
cd server && npm install

# Frontend
cd client && npm install
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

1. **Repository & project scaffold** *(current)*
2. PostgreSQL + Prisma database setup
3. Authentication (JWT + bcrypt)
4. Facilities, areas, and assets CRUD
5. Access requests and manager approval workflow
6. Automated API and business-logic tests

## Scripts

| Location | Command | Description |
|----------|---------|-------------|
| `server/` | `npm run dev` | Start backend in watch mode |
| `server/` | `npm run build` | Compile TypeScript |
| `server/` | `npm run typecheck` | Type-check without emitting |
| `client/` | `npm run dev` | Start Vite dev server |
| `client/` | `npm run build` | Type-check and production build |
| `client/` | `npm run typecheck` | Type-check without emitting |
