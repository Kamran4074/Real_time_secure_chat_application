# ChatWave Architecture

ChatWave is a **modular monolith**: one backend and one frontend, each split into
**feature modules** that all have the **same internal layers**.

- **Modular (vertical):** everything about one feature lives in one folder.
- **Layered (horizontal):** inside a module, every file has one job and dependencies point one way.

The goals:

1. **Find a bug fast:** every log line and error says which module and layer it came from.
2. **Add a feature** by adding a folder and registering it in one place.
3. **Remove a feature** by deleting its folder and its registration line.

---

## 1. Repository layout

```
backend/            Express + Socket.IO + MongoDB API
  src/              application code (layout below)
  tests/            Jest tests (integration + unit), one file per feature/concern
  scripts/          dev / CI helpers (e2e server)
frontend/           React + Vite single-page app
  src/              application code (layout below)
  e2e/              Playwright end-to-end tests
docs/               this document
```

---

## 2. Backend

### 2.1 Folder structure

```
backend/src/
  index.js                 entry point: validate env → connect DB → listen → graceful shutdown
  server.js                composition root: HTTP server + Express app + Socket.IO, wired together
  app.js                   Express app: global middleware, module registration, health, error handling

  config/
    env.js                 zod schema for process.env (fails fast at startup)
    db.js                  MongoDB connection
    urls.js                allowed frontend origins, CLIENT_URL, SERVER_URL

  shared/                  feature-agnostic building blocks (never imports from modules/)
    errors.js              AppError: an HTTP error with a status, a stable code and a safe message
    logger.js              Winston logger (+ logger.child({ module }) per module)
    crypto.js              sha256, randomToken, safeEqual
    escapeRegex.js
    middleware/            validate, rateLimiters, requestLogger, errorHandler, tagModule
    validation.js          reusable zod pieces (objectId, required string, email, password rules)
    services/              clients for third-party services: email (Brevo), cloudinary

  realtime/                Socket.IO transport. Knows nothing about MongoDB or business rules.
    io.js                  the Socket.IO server instance
    presence.js            who is online, offline grace timers, per-user "hidden" sets (blocks)
    notifier.js            the ONLY realtime API that modules use (emitToUser, disconnectUser, ...)
    index.js               setupRealtime(server, hooks): handshake auth + connection handlers

  modules/
    auth/                  register, login, logout, sessions/JWT, password reset, OAuth
    users/                 search, recent chats, profile, avatar upload, blocking
    messages/              send, history (cursor pagination), delivered/seen receipts
```

### 2.2 Anatomy of a module

Every module uses the same file names, so you always know where to look
(a bigger module such as `auth` may have several services, e.g. `auth.service.js`, `password.service.js`,
`oauth.service.js`, and keeps its models in `models/`):

```
modules/messages/
  index.js                 PUBLIC API of the module: what other modules / the composition root may use
  messages.routes.js       URL → middleware → controller          (exports `basePath` + `router`)
  messages.controller.js   HTTP in/out only
  messages.service.js      business rules + database access
  messages.schemas.js      zod contracts for body / params / query
  message.model.js         Mongoose schema + indexes
  conversation.model.js
```

| Layer | Its only job | It must NOT |
|---|---|---|
| `*.routes.js` | map URL → auth, rate limit, `validate(schema)` → controller | contain logic |
| `*.controller.js` | read `req.valid` / `req.user`, call one service function, send the response (status + body + cookies) | query the database or decide business rules |
| `*.service.js` | business rules, database access, notifying realtime, throwing `AppError` | touch `req` / `res` / cookies |
| `*.schemas.js` | describe and clean every input (trim, types, limits) | — |
| `*.model.js` | schema, indexes, defaults | contain business logic |

A request flows strictly one way:

```
HTTP request
  → app.js (requestLogger, helmet, cors, rate limit, tagModule)
  → <module>.routes.js   (requireAuth, validate)
  → <module>.controller.js
  → <module>.service.js  ──→ realtime/notifier.js   (live events)
  → <module>.model.js         shared/services/*      (email, cloudinary)
```

### 2.3 Dependency rules

These rules are what keep the structure clean. ESLint enforces them (`no-restricted-imports` in
`backend/eslint.config.js`), so a violation fails CI.

1. **Layers point down only:** routes → controller → service → model. Never upward.
2. **Modules talk to each other only through `index.js`.**
   `messages` may import from `modules/users/index.js`, never from `modules/users/users.service.js`
   or `modules/users/user.model.js`.
3. **`index.js` never imports routes or controllers.** It exports services and models only. This
   keeps the import graph free of cycles.
4. **`shared/` never imports from `modules/` or `realtime/`.**
5. **`realtime/` never imports from `modules/`.** What realtime needs from the business side
   (checking a socket's token, loading block lists, marking messages delivered, saving "last seen")
   is passed in as **hooks** by `server.js`, the composition root.
6. **Modules never import `socket.io`.** They call `realtime/notifier.js`.

```
                ┌──────────── server.js (wires everything) ─────────────┐
                │                                                       │
            app.js ───────────► modules/auth ─────► modules/users ◄── modules/messages
                                     │                   │                 │
                                     └──────────┬────────┴─────────────────┘
                                                ▼
                         realtime/notifier.js   shared/*   config/*
```

### 2.4 Errors: always know where it broke

Services throw `AppError` instead of writing responses:

```js
throw new AppError(404, 'MESSAGES_RECEIVER_NOT_FOUND', 'Receiver not found');
```

- The **code** is `<MODULE>_<REASON>`, unique and greppable. The client receives it next to the
  message: `{ success:false, code, message, errors? }`.
- `tagModule('<name>')` marks every request with its module when the router is mounted.
  `requestLogger` and `errorHandler` include `module` in every log line.
- Unexpected errors (500) are logged with `requestId`, `module`, route and stack; the client gets
  only `{ success:false, message:"Internal server error", requestId }`.

A failure in the logs:

```
error Unhandled error on POST /api/message/send/:id {"requestId":"619…","module":"messages","error":"…","stack":"…messages.service.js:42…"}
```

`module` tells you the folder, the stack tells you the layer and line, `requestId` matches what the
user saw in the response header `X-Request-Id`.

### 2.5 Adding a feature (example: `groups`)

1. Create `src/modules/groups/` with the files from 2.2 (copy a small module such as `messages`).
2. Put rules in `groups.service.js`, contracts in `groups.schemas.js`, HTTP in the controller.
3. Export what other modules may use from `groups/index.js`.
4. Add `groups` to the `modules` list in `src/app.js`.
5. Add `tests/groups.test.js`.

### 2.6 Removing a feature

1. Delete `src/modules/<name>/` and its line in `src/app.js`.
2. Search for `modules/<name>/index.js`: rule 2 guarantees these are the only places that used it.
3. Delete its tests and its frontend feature folder.

---

## 3. Frontend

### 3.1 Folder structure

```
frontend/src/
  main.jsx                 bootstraps: API client, router, providers
  App.jsx                  routes
  Home.jsx                 the logged-in screen: composes Sidebar, ChatWindow and ProfilePanel
  RealtimeProvider.jsx     connects the socket with the session token (wires auth → shared/realtime)

  shared/
    api/client.js          the ONE axios setup: base URL, token header, 401 → logout, error helpers
    lib/session.js         the ONLY code that reads/writes the saved session (localStorage)
    lib/                   logger, lastSeen, formErrors, validation (reusable zod pieces)
    realtime/              SocketContext, useSocketEvent(event, handler)
    store/                 useConversation (zustand): open chat, its messages, blocked ids
    components/            app-wide widgets (ServerStatus)
    ui/                    presentational components: Button, Avatar, TextField, Logo, …

  features/
    auth/                  login, register, forgot/reset password, OAuth, AuthContext, change password
    chat/                  the open conversation: messages, composer, typing, read receipts
    contacts/              sidebar: recent chats, user search, blocking, contact info
    settings/              profile panel, account settings
```

Features depend on each other in one direction only (no cycles):

| Feature | May use |
|---|---|
| `auth` | — (only `shared/`) |
| `contacts` | `auth` |
| `settings` | `auth`, `contacts` |
| `chat` | `auth`, `contacts` |

### 3.2 Anatomy of a feature

```
features/chat/
  api.js                   every HTTP call of this feature (uses shared/api/client.js)
  hooks/                   state + side effects (data loading, socket listeners)
  components/              UI; gets data from hooks, never calls axios
  pages/                   route-level screens (auth only)
  index.js                 what other features / App.jsx may import
```

| Layer | Its only job | It must NOT |
|---|---|---|
| `components/` | render UI, call hooks / callbacks | import axios or touch localStorage |
| `hooks/` | load data, subscribe to socket events, hold state | render UI |
| `api.js` | one function per backend endpoint | contain UI state |
| `shared/api/client.js` | base URL, auth header, global 401 handling | know about features |

### 3.3 Frontend rules

ESLint enforces all four (`frontend/eslint.config.js`), so a violation fails CI.

1. Only `shared/api/client.js` imports `axios`; features call the backend from their `api.js`.
2. Only `shared/lib/session.js` touches `localStorage`.
3. Features import each other only through `index.js`.
4. `shared/` never imports from `features/`.

### 3.4 Frontend ↔ backend map

| Frontend feature | Backend module | API prefix |
|---|---|---|
| `features/auth` | `modules/auth` | `/api/auth` |
| `features/contacts`, `features/settings` | `modules/users` | `/api/user` |
| `features/chat`, recent chats in `features/contacts` | `modules/messages` | `/api/message` |
| `shared/realtime` | `realtime/` | Socket.IO |

When a screen breaks, its feature's `api.js` names the endpoint, and the endpoint's prefix names the
backend module.

---

## 4. Testing

| Level | Where | What |
|---|---|---|
| Backend integration | `backend/tests/<feature>.test.js` | every endpoint and socket event, against an in-memory MongoDB |
| Backend unit | `backend/tests/unit.*.test.js` | schemas, middleware, shared helpers |
| Frontend unit | `frontend/src/test` | components, hooks, schemas, store |
| End-to-end | `frontend/e2e` | real browser against the real backend |

Tests check behaviour (HTTP responses, socket events), not file layout, so moving code inside a
module does not break them.
