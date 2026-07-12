# ClaimTrack

A claims-tracking application. Employees file claims; adjusters review and update their status.

## Architecture

```
Frontend (React/Vite) --fetch--> Backend (Express) --mongoose--> MongoDB Atlas
                                        |
                                   JWT auth (bcrypt-hashed passwords)
```

## User stories

- As an employee, I can register, log in, and submit a new claim (description, amount).
- As an employee, I can view the status of my own claims.
- As an adjuster, I can view all claims and update their status (pending / in review / approved / rejected).
- As any authenticated user, my session is protected by a JWT; unauthenticated requests are rejected.

## Project phases

1. **Backend skeleton** — Express server, MongoDB connection, folder structure.
2. **Core API** — User/Claim models, routes, controllers, auth & error middleware.
3. **Hardening** — validation, role-based access control.
4. **Tests** — Jest test suite for auth and claim permissions.
5. **Frontend** — React (Vite) client consuming the API.
6. **Deployment** — Docker Compose (app + database) and GitHub Actions CI.

## Getting started (backend)

```bash
cd backend
cp .env.example .env   # fill in your own values
npm install
npm run dev
```

Requires a MongoDB connection string (local MongoDB or MongoDB Atlas) in `backend/.env`.
