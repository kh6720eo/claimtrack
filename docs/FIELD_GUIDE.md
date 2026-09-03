# ClaimTrack Field Guide

Reference and interview prep for ClaimTrack, a claims-tracking app: employees file claims, adjusters review and resolve them. This explains how every layer works, why it was built that way, and includes two real bugs hit while building it.

**Stack**: React + Vite · Express 5 · MongoDB / Mongoose 9 · JWT + bcrypt · Jest + Supertest

---

## 1. Architecture

Three tiers, one JWT. The browser never talks to MongoDB directly — every read and write goes through the Express API, which is the only thing that holds a database connection.

```
Browser (React + React Router)
   |  fetch /api/* + Bearer JWT
   v
Vite dev server (:5173, proxies /api)
   |  http proxy
   v
Express API (:3000 — auth, RBAC)
   |  mongoose
   v
MongoDB (users, claims)
```

In production the Vite proxy disappears — the built frontend is static files served from anywhere, pointed at the API's real origin. In dev, the proxy exists purely so the browser only ever talks to one origin (`localhost:5173`) and CORS never becomes a distraction. The API also sets `cors()` itself, so it works even without the proxy.

Everything downstream of the API is stateless except the database: no server-side sessions, no sticky routing needed. The JWT *is* the session — it lives in the browser's `localStorage` and gets attached to every request.

---

## 2. Backend

`backend/src` follows a conventional layered shape: routes parse HTTP, controllers hold logic, models talk to Mongo, middleware guards the door.

| Layer | Files | Job |
|---|---|---|
| Routes | `routes/auth.js`, `routes/claims.js` | Map HTTP verb + path to a controller function; attach middleware |
| Middleware | `middleware/auth.js`, `middleware/errorHandler.js` | `protect` (require a valid JWT), `authorize(...roles)` (require a role), centralized 404/500 |
| Controllers | `controllers/authController.js`, `controllers/claimsController.js` | Validate input, enforce ownership rules, shape responses |
| Models | `models/User.js`, `models/Claim.js`, `models/claimModel.js` | Mongoose schemas + a thin CRUD wrapper the controller calls instead of touching Mongoose directly |

### Routes at a glance

| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/auth/register` | public | Creates a user, returns `{ user, token }` |
| `POST /api/auth/login` | public | Verifies password, returns `{ user, token }` |
| `GET /api/auth/me` | any user | Returns the caller's own profile |
| `GET /api/claims` | any user | Employees get their own claims; adjusters get all |
| `GET /api/claims/:id` | any user | 404 (not 403) if it's not yours and you're not an adjuster |
| `POST /api/claims` | any user | Creates a claim owned by the caller, status forced to `submitted` |
| `PUT /api/claims/:id/status` | adjuster only | The only way a claim's status changes |
| `DELETE /api/claims/:id` | adjuster only | Hard delete |

### Auth: registration & login

`User.js` hashes the password in a Mongoose `pre('save')` hook, so every code path that creates or edits a user — not just the register endpoint — gets a hashed password automatically:

```js
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});
```

The password field is declared `select: false`, so a normal `User.findOne()` never returns the hash — `login()` has to explicitly opt in with `.select('+password')` when it needs to compare. That makes leaking a hash by accident structurally harder, not just a matter of remembering to omit it.

On login, `signToken()` puts `{ id, role }` in the JWT payload and signs it with `JWT_SECRET`, expiring after `JWT_EXPIRES_IN` (7 days in dev). Putting `role` in the token lets `authorize()` skip a database round trip, at the cost of a stale token still carrying an old role until it expires or is reissued.

### Middleware: protect and authorize

```js
async function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authorized, no token' });
  }
  const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
  const user = await User.findById(decoded.id);
  if (!user) return res.status(401).json({ error: 'Not authorized, user no longer exists' });
  req.user = user;
  next();
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}
```

`claims.js` applies `router.use(protect)` once at the top, then layers `authorize('adjuster')` onto just the two routes that need it. That split — *are you anyone?* vs. *are you allowed to do this specific thing?* — keeps the role check a one-line addition per route instead of an `if` block inside every controller.

### Role-based filtering lives in the controller, not the route

Unlike the status/delete routes (blocked entirely for employees), *read* access to claims isn't blocked — it's filtered per request, because the correct data depends on *who's asking*, not just *what role they have*:

```js
async function getAllClaims(req, res) {
  const filter = req.user.role === 'adjuster' ? {} : { submittedBy: req.user._id };
  const claims = await claimModel.getAll(filter);
  res.status(200).json(claims);
}
```

The single-claim lookup applies the same rule but returns **404, not 403**, when an employee requests someone else's claim:

```js
if (!claim || (req.user.role !== 'adjuster' && String(claim.submittedBy) !== String(req.user._id))) {
  return res.status(404).json({ error: 'Claim not found' });
}
```

> **Why 404 instead of 403:** a 403 confirms the claim ID exists but isn't yours — that's an information leak. A 404 makes "not yours" indistinguishable from "doesn't exist" from outside, the safer default for anything keyed by a guessable-ish ID.

---

## 3. Frontend

A small React app: no Redux, no UI kit — just Context for auth state, a fetch wrapper for the API, and React Router for the protected/unprotected route groups.

### Auth state: Context + localStorage

`AuthContext.jsx` is the only place that knows about tokens. It lazily reads `localStorage` on first render (so a page refresh doesn't bounce a logged-in user to `/login`), and persists back to storage on every change:

```js
const [auth, setAuth] = useState(() => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
});

useEffect(() => {
  if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  else localStorage.removeItem(STORAGE_KEY);
}, [auth]);
```

`login()`, `register()`, and `logout()` all just call the API and set this one piece of state — every component that needs `user`, `token`, or `isAuthenticated` pulls it via the `useAuth()` hook rather than prop-drilling.

### The API layer is one function

`services/api.js` is a single `request()` helper every call funnels through — sets JSON headers, attaches `Authorization: Bearer <token>` when given one, and turns a non-2xx response into a thrown `Error` carrying the backend's own message, so every page's `catch (err) { setError(err.message) }` just works.

### Route protection

```js
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
```

Only `/claims` is wrapped in it. This is client-side UX only, not a security boundary — the real enforcement is `protect`/`authorize` on the backend.

### Component responsibilities

| Component | Role |
|---|---|
| `Header` | Brand link; when authenticated, shows name + role badge + logout |
| `LoginPage` / `RegisterPage` | Controlled forms, error display, redirect to `/claims` on success |
| `ClaimsPage` | Owns claims list state; decides "My claims" vs "All claims" from `user.role`; only renders the create form for employees |
| `ClaimForm` | Create-claim form; resets itself after a successful submit |
| `ClaimCard` | Renders one claim; only renders the status `<select>` and Delete button when `isAdjuster` is true |

---

## 4. Two request flows, end to end

### An employee submits a claim

1. `ClaimForm` collects description/amount/date, calls `onCreate()` on submit.
2. `ClaimsPage.handleCreate` calls `claimsApi.create(payload, token)`.
3. Request hits `POST /api/claims`. `protect` verifies the JWT and loads `req.user`; no `authorize()` needed — any authenticated user can create a claim.
4. `createClaim` validates `description`/`amount` are present, then calls `claimModel.create({ ...body, submittedBy: req.user._id })` — the owner comes from the token, never the request body.
5. Mongoose validates against the `Claim` schema (status defaults to `submitted` regardless of what the client sent) and inserts the document.
6. The new claim comes back as JSON; `ClaimsPage` prepends it to local state — no full reload needed.

### An adjuster approves it

1. The adjuster's `ClaimsPage` loaded with no `submittedBy` filter (role is `adjuster`), so this claim is visible.
2. Changing the `ClaimCard` status `<select>` calls `onStatusChange(id, 'approved')`.
3. Hits `PUT /api/claims/:id/status`. `protect` runs, then `authorize('adjuster')` — an employee token gets 403 before the handler even runs.
4. `updateClaimStatus` checks the new status is a valid enum value, then calls `Claim.findByIdAndUpdate(id, { status }, { returnDocument: 'after', runValidators: true })`.
5. The updated document comes back; `ClaimsPage` swaps it into local state by `_id`, badge color updates instantly.

---

## 5. Security decisions, and their tradeoffs

- **bcrypt, cost factor 10** for password hashing — standard default, slow enough to matter, fast enough not to bottleneck registration.
- **JWT, not server sessions** — no session store to run or scale, but no server-side revocation either. Logging out just deletes the client's copy; a stolen token stays valid until it expires. A production version would want short-lived access tokens plus refresh-token rotation.
- **Ownership checked server-side, always** — every claims query is scoped by `req.user` from the verified token, never by an ID the client passes.
- **404 over 403 for cross-user access** — prevents existence-enumeration of other users' claims.
- **Self-selected role at registration** — anyone can register as `adjuster`. Known, deliberate simplification for a demo with no admin/invite flow yet.
- **CORS enabled broadly** (`app.use(cors())`) — would be tightened to an explicit origin allowlist before a real production deploy.

---

## 6. Testing

13 Jest + Supertest tests cover the two things most worth testing in an auth/RBAC system: *can the right people do things* and *can the wrong people not*. Each test file spins up its own [mongodb-memory-server](https://www.npmjs.com/package/mongodb-memory-server) instance — a real, ephemeral MongoDB, not a mock — so tests exercise actual Mongoose validation and queries with zero external dependencies.

| File | Covers |
|---|---|
| `auth.test.js` | Register (incl. duplicate email, short password), login (incl. wrong password), `/me` with and without a token |
| `claims.test.js` | Unauthenticated 401; employees see only their own claims; adjusters see all; employee gets 403 updating status; adjuster gets 200; cross-employee claim access returns 404 |

Why a real in-memory database instead of mocking Mongoose: mocks only prove the code calls the methods you told it to expect — they can't catch a wrong query filter, a missed `await`, or backwards schema validation. Since the point of this suite is "does the ownership filter actually filter," a real database is the only thing that can fail honestly.

---

## 7. Two real bugs from building this

Good interview material — both concrete, both have a clear diagnosis path, neither is "I looked it up."

### Backend · Mongoose — Every registration silently failed, and it looked like a hang

The password-hashing hook was written as `async function hashPassword(next) { ...; next(); }` — mixing `async`/`await` with an explicit callback. In this Mongoose version that's invalid: an async hook is expected to just resolve, not also call a passed-in `next`. Mongoose didn't pass a real function there, so calling it threw `TypeError: next is not a function` inside the save pipeline.

The confusing part: the test run appeared to hang for minutes with zero output. First suspicion was `mongodb-memory-server` downloading its MongoDB binary on first use — a standalone script confirmed that download *did* complete in seconds once cached, so the silence needed another explanation. Using macOS's `sample` profiler on the stuck Jest process showed it wasn't idle — it was deep in V8 microtask/promise-resolution machinery, over and over. Re-running one test file with `--verbose` surfaced the actual repeated stack trace: every `register()` call was throwing inside the save hook and getting caught by the error middleware, which logged it — 13 times, once per test, each printing a multi-line stack.

**Fix:** drop the callback parameter entirely:
```js
async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
}
```
With an async function, Mongoose calls the internal `next` for you once the returned promise settles.

**The lesson to say out loud:** "hang with no output" and "fast, repeated, swallowed error" can look identical from the outside — the profiler stack, not the wall-clock time, is what told them apart.

### Frontend · Browser automation — The Register button did nothing, and it wasn't the app

While smoke-testing the frontend in a real Chrome profile, clicking "Register" produced no network request, no navigation, no visible error.

The diagnosis worked by isolating layers one at a time: `curl` straight to the Express server — worked. `curl` through the Vite dev proxy — also worked. That eliminated the entire server-side stack; the bug had to be strictly inside the browser tab. The console showed `"A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received"` — a signature Chrome extension error — alongside an extension content script sitting permanently `pending` in the network log on any page with a form.

**Fix (for testing purposes):** bypass the simulated click and submit the form directly — `form.requestSubmit()` via injected JS — which fires React's `onSubmit` without going through whatever was intercepting the click.

**The lesson to say out loud:** when a UI action does *nothing* rather than something wrong, that's often a sign the event never reached your code at all — curl-ing each hop is a fast way to prove your own stack is innocent before debugging code that isn't the problem.

---

## 8. Interview Q&A

### Architecture & decisions

**Walk me through the architecture.**
React SPA talking to an Express REST API over JSON, backed by MongoDB via Mongoose. Auth is stateless JWT — no server-side sessions. In dev, Vite proxies `/api` to the Express server so the browser only ever sees one origin; in production those would be two separately deployed services, with the API's own CORS config allowing the frontend's real origin.

**Why Express + Mongoose instead of a framework like NestJS, or a different database?**
Scope fit: two resources (users, claims), a handful of routes, one relationship. Express keeps the request pipeline visible and explicit (I wrote `protect`/`authorize` myself rather than adopting a framework's opinionated guard system). Mongo/Mongoose fit the shape of the data — claims are self-contained documents with one reference back to a user, not a web of relations that would want joins.

**Why Context API instead of Redux?**
There's exactly one piece of global state worth sharing: who's logged in. Context plus a couple of hooks covers that with zero dependencies. Everything else is local to the page/component that owns it.

**What layer does RBAC actually live in?**
Split on purpose. Frontend hides UI a role shouldn't see — pure UX, easily bypassed. Backend is where it's actually enforced: `authorize('adjuster')` blocks routes outright, and read endpoints filter every query by `req.user` from the verified JWT. Never trust the client's role claim for anything that matters — only the token's.

### Auth & security

**Why JWT instead of cookie-based sessions?**
No server-side session store to provision or scale. The tradeoff is revocation: a session can be deleted server-side instantly, a JWT can't be un-issued, only allowed to expire. A production system handling anything sensitive would pair short-lived access tokens with refresh-token rotation and a server-side deny-list.

**Where's the password ever exposed, and how did you prevent that?**
It isn't, by construction: `password: { select: false }` means a normal query never returns the hash even if a route carelessly does `res.json(user)`. `login()` explicitly asks for it with `.select('+password')`.

**Why 404 instead of 403 for cross-user claim access?**
A 403 confirms the resource exists but you're not allowed to see it — itself information. A 404 makes "exists but not yours" and "doesn't exist" indistinguishable, closing off ID-enumeration.

**What's the biggest security shortcut you took, and what would you fix first?**
Letting anyone self-select the `adjuster` role at registration — exists purely so a demo doesn't need an admin panel. First production fix: registration always creates an `employee`; promoting to `adjuster` becomes an action only an existing adjuster/admin can take.

### Data & API design

**Why does `Claim` store `submittedBy` as a reference instead of embedding the user's name/email?**
Normalization for correctness over read-speed: a reference means if a user's name changes, every claim reflects it automatically, and there's one source of truth (which the RBAC filtering depends on). The alternative — denormalized copies on every claim — needs an explicit update-everywhere step on any user edit.

**Why is there both `Claim.js` and `claimModel.js`?**
`Claim.js` is the Mongoose schema/model. `claimModel.js` is a thin data-access wrapper the controller calls instead of importing Mongoose directly — the controller's business logic never has to know it's Mongoose underneath.

**Why can't an employee edit a claim after submitting it?**
Deliberate: once submitted, only an adjuster can change anything (its status). Keeps a claim's history trustworthy — what an adjuster reviewed is exactly what was originally filed.

**What happens if a client sends a `status` field when creating a claim?**
Silently ignored. `createClaim` only reads `description`, `amount`, `dateOfLoss`; the schema default (`submitted`) is what lands. Status only changes through the dedicated, adjuster-only route.

### Testing & debugging

**How is this tested, and why that approach?**
Jest + Supertest hitting the real Express app in-process, against a real (ephemeral, in-memory) MongoDB via `mongodb-memory-server` — one fresh instance per test file. Exercises actual Mongoose validation and query filters, not a mock's idea of them, while running fast with zero external services.

**What isn't tested yet?**
No frontend automated tests yet — verified manually end-to-end in a real browser. No test yet for concurrent status updates or the delete route specifically.

**Tell me about a bug that was harder to diagnose than it looked.**
The Mongoose async-hook bug (above) — presented as a multi-minute hang with zero output, which pointed at a slow one-time binary download. Confirming that download completed quickly once cached, then profiling the stuck process, showed it was repeatedly failing and logging a stack trace per test — output that *looked* like silence until `--verbose` on a single file made the real error visible.

### Behavioral

**Describe a time you had to figure out whether a bug was your code or something else.**
The swallowed-click bug (above). Isolated each hop independently — `curl` the backend directly, then through the exact proxy the browser uses. Both worked, ruling out the entire server side in two commands and pointing at the browser tab, where a specific extension's error confirmed it. The habit worth naming: prove your own code innocent with the cheapest possible test before debugging code that isn't the problem.

**What would you do differently if you started over?**
Write the `User` model's tests before the pre-save hook, not after — a single "does registering hash the password and let login succeed" test would have caught the async/callback bug in seconds. More generally: for anything async-lifecycle-hook-shaped, write the smallest possible test immediately, before building on top of it.

### Scaling it further

**How would you add file uploads (e.g. photos of damage) to a claim?**
Not into MongoDB directly — upload straight from the browser to object storage (S3 or equivalent) via a short-lived pre-signed URL the API issues, then store just the resulting key/URL on the `Claim` document.

**How would you notify an adjuster when a new claim comes in?**
Start cheap: an email on claim creation via a queue-backed job (not sent inline in the request cycle). Real-time in-app notification would layer WebSockets or SSE on top later.

**How would you enforce a real status workflow (e.g. can't go from denied back to submitted)?**
Move the allowed-transitions table out of "any enum value is valid" into an explicit map (`{ submitted: ['in_review'], in_review: ['approved','denied'], approved: [], denied: [] }`) checked before the write.

**How would this need to change to run in production?**
In rough priority order: gate the adjuster role behind an invite/admin flow; add refresh tokens; add rate limiting on `/auth/login`; add pagination to `GET /api/claims`; tighten CORS to an explicit origin; wire up CI (tests + lint on every push).

---

## 9. Roadmap

What's built: backend auth/RBAC with tests, and a working React frontend, both verified end-to-end. Still ahead:

- **GitHub Actions CI** — run the Jest suite and a linter on every push/PR.
- **Anthropic-powered claim triage** — call the Claude API on new claim submissions to generate a short summary and suggested priority for adjusters, surfaced on the claims list.
