# ClaimTrack

A full-stack insurance claims portal. Employees submit and track claims; adjusters review, triage, and update their status.

**Live:** [claimtrack-wine.vercel.app](https://claimtrack-wine.vercel.app) · **API:** [claimtrack-api.vercel.app](https://claimtrack-api.vercel.app/api/health)

## Architecture

```
React (Vite) SPA  --fetch/JSON-->  Express REST API  --mongoose-->  MongoDB Atlas
   claimtrack.vercel.app              claimtrack-api.vercel.app
                                             |
                                    JWT auth (bcrypt-hashed passwords)
                                    role-based access (employee / adjuster)
```

Both frontend and backend deploy as separate Vercel projects, each connected to this repo's `main` branch — a push triggers an independent redeploy of whichever side changed. The backend also runs on Vercel Serverless Functions in production (see [`backend/api/index.js`](backend/api/index.js)) but is a normal long-running Express app in development (see [`backend/src/server.js`](backend/src/server.js)).

## How it works

**Roles.** Every user is either an `employee` or an `adjuster` (set at registration, defaults to `employee`). Employees can only see and create their own claims. Adjusters can see every claim and are the only ones who can change a claim's status or delete it.

**Auth.** Registration and login return a JWT (`jsonwebtoken`, signed with `JWT_SECRET`, default 7-day expiry) plus a sanitized user object (no password hash). The frontend stores both in `localStorage` under `claimtrack_auth` and attaches the token as `Authorization: Bearer <token>` on every API call (see [`frontend/src/services/api.js`](frontend/src/services/api.js)). Passwords are hashed with `bcryptjs` (10 rounds) in a Mongoose `pre('save')` hook — plaintext passwords never touch the database.

**Claims lifecycle.** A claim starts as `submitted`. An adjuster moves it through `in_review` → `approved` or `denied` via `PUT /api/claims/:id/status`. There's no state-machine enforcement — an adjuster can set any of the four statuses at any time.

**Data scoping.** `GET /api/claims` filters server-side by role: adjusters get everything, employees get only claims where `submittedBy` matches their own user id (`backend/src/controllers/claimsController.js`). `GET /api/claims/:id` additionally 404s (not 403) an employee's attempt to view someone else's claim, so employees can't even confirm another claim's existence.

## Data models

**User** (`backend/src/models/User.js`)
| Field | Type | Notes |
|---|---|---|
| `name` | String | required |
| `email` | String | required, unique, lowercased |
| `password` | String | required, min 8 chars, bcrypt-hashed, `select: false` (never returned by default) |
| `role` | String | `employee` \| `adjuster`, default `employee` |

**Claim** (`backend/src/models/Claim.js`)
| Field | Type | Notes |
|---|---|---|
| `description` | String | required |
| `amount` | Number | required |
| `dateOfLoss` | Date | optional |
| `status` | String | `submitted` \| `in_review` \| `approved` \| `denied`, default `submitted` |
| `submittedBy` | ObjectId → User | required |

Both models use Mongoose `timestamps` (`createdAt`/`updatedAt`).

## API reference

Base URL: `/api`. All routes except `/health`, `/auth/register`, `/auth/login` require `Authorization: Bearer <token>`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Liveness check, returns `{status:"ok"}` |
| POST | `/auth/register` | — | Create a user, returns `{user, token}` |
| POST | `/auth/login` | — | Returns `{user, token}` |
| GET | `/auth/me` | any | Returns the current user |
| GET | `/claims` | any | Employees: own claims. Adjusters: all claims |
| GET | `/claims/:id` | any | 404 if not found or not yours (employees) |
| POST | `/claims` | any | Create a claim owned by the caller |
| PUT | `/claims/:id/status` | adjuster | Update `status` |
| DELETE | `/claims/:id` | adjuster | Remove a claim |

Errors are always `{ "error": "message" }` with an appropriate status code (400 validation, 401 unauthenticated, 403 wrong role, 404 not found, 409 duplicate email).

## Frontend structure

```
frontend/src/
├── App.jsx                 # routes: /login, /register, /claims (protected)
├── context/AuthContext.jsx # auth state, persisted to localStorage
├── services/api.js         # fetch wrapper + authApi/claimsApi
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   └── ClaimsPage.jsx      # loads claims, renders form (employees) + list
└── components/
    ├── Header.jsx
    ├── ClaimForm.jsx       # create-claim form (employees only)
    └── ClaimCard.jsx       # one claim; status dropdown + delete (adjusters only)
```

`ClaimsPage` conditionally renders the create form and the status/delete controls based on `user.role` — the UI hides what a role can't do, but the backend is the actual enforcement point (see Data scoping above).

## Environment variables

**`backend/.env`** (see `backend/.env.example`)
| Var | Purpose |
|---|---|
| `PORT` | Local dev port (default 3000) |
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Signing secret for auth tokens |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |

**`frontend`**: `VITE_API_URL` — the backend base URL (`.env.production` points it at the deployed API; falls back to `/api` for the Vite dev proxy).

## Local development

```bash
# backend
cd backend
cp .env.example .env   # fill in MONGO_URI and JWT_SECRET
npm install
npm run dev             # nodemon, http://localhost:3000

# frontend (separate terminal)
cd frontend
npm install
npm run dev              # vite, http://localhost:5173, proxies /api to :3000
```

## Testing & linting

```bash
cd backend
npm test        # jest --runInBand — auth + claims permission tests, in-memory MongoDB (mongodb-memory-server), no real DB needed
npm run lint     # eslint (flat config, backend/eslint.config.js)
```

Tests live in `backend/tests/` and spin up `mongodb-memory-server` per run (`tests/helpers/db.js`) — no `MONGO_URI` or network access required.

## CI/CD

[`.github/workflows/backend-ci.yml`](.github/workflows/backend-ci.yml) runs on every push/PR to `main`: `npm install`, `npm run lint`, `npm test`, against the backend only (the frontend currently has no test/lint scripts). It uses `npm install` rather than `npm ci` because a transitive optional dependency of `eslint`'s WASM resolver (`@napi-rs/wasm-runtime` → `@emnapi/*`) resolves a slightly different patch version between installs, which trips `npm ci`'s strict lockfile check; `npm install` tolerates that drift without masking real dependency issues.

## Deployment

Both halves are separate Vercel projects (no monorepo build config) connected via GitHub integration to this repo:

- **Backend** (`backend/vercel.json`) rewrites every request to `backend/api/index.js`, a serverless handler that lazily opens (and reuses, across warm invocations) a Mongoose connection before delegating to the same Express `app` used locally.
- **Frontend** (`frontend/vercel.json`) rewrites everything to `index.html` so client-side routing (React Router) works on refresh/direct navigation.

Required Vercel environment variables — backend project: `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`. Frontend project: `VITE_API_URL` (set to the backend's deployed URL).
