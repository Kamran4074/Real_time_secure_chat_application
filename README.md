# ChatWave

Real-time one-on-one chat: live messages, online presence and typing indicators,
with email/password and Google/GitHub (OAuth 2.0) sign-in.

**Live:** https://chatwave-azure.vercel.app

## Project structure

```
backend/    Express + Socket.IO + MongoDB API   (own package.json, .env, Dockerfile, tests)
frontend/   React + Vite + Tailwind UI          (own package.json, .env, Dockerfile)
.github/    CI (tests + build) and peak-hours keep-alive workflows
docker-compose.yml   runs MongoDB + backend + frontend together
```

Backend and frontend are independent: install, run and deploy each from its own folder.

## Run locally

**Backend** (terminal 1)
```bash
cd backend
cp .env.example .env      # then fill in MONGODB_CONNECT and JWT_SECRET
npm install
npm run dev               # http://localhost:3000
```

**Frontend** (terminal 2)
```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

**Or everything with Docker** (needs `backend/.env` with `JWT_SECRET`)
```bash
docker compose up --build   # frontend http://localhost:8080, backend http://localhost:3000
```

## Tests

| Type | Tool | Where | What it covers |
|---|---|---|---|
| Unit | Jest / Vitest | `backend/tests/unit.*`, `frontend/src/test` | utils, Zod schemas, middleware, React components, store |
| Integration (API) | Jest + Supertest + in-memory MongoDB | `backend/tests` | every endpoint and Socket.IO event |
| Security | Jest + Supertest | `backend/tests/security.test.js` (+ per feature) | NoSQL injection, XSS, forged / `alg:none` JWTs, mass assignment, access control, headers, rate limiting |
| End-to-end (automation) | Playwright | `frontend/e2e` | real browser on the production build with the real CSP: register, login, logout, two users chatting live |
| Static code analysis | ESLint | `eslint.config.js` (both apps) | unused / undefined variables, unused imports, dead code, `==`, `var`, stray `console` |
| Unused code | knip | `npm run lint:unused` | unused files, exports and dependencies |
| Dependency scan | `npm audit` | CI | fails on high / critical vulnerabilities in production packages |
| Static analysis (SAST) | CodeQL | `.github/workflows/codeql.yml` | security and quality issues in our own code |

```bash
cd backend
npm run lint              # ESLint
npm run lint:unused       # knip
npm test                  # Jest + in-memory MongoDB, no setup needed
npm run test:coverage     # fails below 90% statements / 80% branches

cd frontend
npm run lint && npm run lint:unused
npm test                  # Vitest + React Testing Library
npm run test:coverage
npx playwright install chromium   # once
npm run test:e2e          # starts backend (in-memory DB) + built frontend itself
```

## Security

- **Rate limiting** ([backend/middleware/rateLimiters.js](backend/middleware/rateLimiters.js)), each changeable in `.env`:

  | What | Limit | Key |
  |---|---|---|
  | Login / register / OAuth | 20 per 15 min | IP |
  | Every API route (except `/api/health`) | 600 per 15 min | IP |
  | Sending messages | 30 per minute | user |
  | User search | 60 per minute | user |
  | Socket typing events | 20 per 5 s (extra are dropped) | socket |

- **Security headers**: `helmet` on the API; the same set (CSP, `X-Frame-Options: DENY`, nosniff, Referrer / Permissions policy)
  on the frontend via [frontend/vercel.json](frontend/vercel.json) on Vercel and [frontend/nginx.conf](frontend/nginx.conf) in Docker.
- JWT with revocation on logout, bcrypt passwords, Zod validation on every input, CORS allow-list, 10 kB body limit.

CI (`.github/workflows/test.yml`) runs all of this on every push and pull request.

## Deployment

| Part | Host | Settings |
|---|---|---|
| Backend | Render | Root Directory `backend`, Build `npm install`, Start `npm start`, env vars from `backend/.env.example` |
| Frontend | Vercel | `VITE_BACKEND_URL` = backend URL |

## Tech

React 18, Vite 7, Tailwind, Zustand, Socket.IO, Express 5, MongoDB/Mongoose,
JWT with revocation, OAuth 2.0, Zod validation, Winston logging, Jest, Vitest, Playwright, Docker, GitHub Actions.
