# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Layout

```
frontend/   Next.js 16 app (App Router, SSR/ISR/i18n) — UI only
backend/    Express + TypeScript MVC API — data, auth, exports, RSS
shared/     TS types referenced by both sides (League, Team, Match, etc.)
scripts/    deploy.sh
docker-compose.yml
.env.example
```

The frontend never reaches Supabase, Redis, or other infra directly — it only
calls the backend over HTTP. Server Components fetch from the API at request
time using Next's `fetch` cache (`{ next: { revalidate } }`).

## Commands

```bash
# Run everything via docker (recommended)
cp .env.example .env  # fill in values
docker compose up --build

# Without docker
cd backend && npm install && npm run dev    # api on :4000
cd frontend && npm install && npm run dev   # web on :3000
```

The frontend needs `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1` in
`frontend/.env.local` for browser-side fetches; server-side fetches use
`API_INTERNAL_BASE_URL` (set to `http://api:4000/api/v1` in compose, falls back
to the public URL otherwise).

## Backend (`backend/`)

MVC layout:
- `src/app.ts` — express factory: helmet, CORS (locked to FRONTEND_ORIGIN),
  pino-http, cookie-parser (signed with AUTH_SECRET), body parser (64kb),
  session parsing, route mount, central error handler.
- `src/server.ts` — initializes the rate-limit Redis store, then `app.listen()`.
- `src/config/env.ts` — zod-validated env loading. Fails fast on bad config.
- `src/middleware/` — helmet (re-export from app.ts), cors, logger (pino-http),
  rate-limit (express-rate-limit + rate-limit-redis), auth (parseSession +
  requireAuth), cache (route-level GET cache), error (HttpError + central
  normalizer producing `{ error: { code, message } }`).
- `src/services/` — redis (withRedisCache wrapper), supabase (anon + admin
  clients), steam (OpenID URL build + verify, profile fetch), session (HMAC
  cookie sign/verify), logger (pino).
- `src/models/` — data access. `queries.ts` holds the bulk of the
  league/team/patch/match/pickban queries; `blog.ts`, `comments.ts`,
  `users.ts`, `mock.ts` are domain-specific.
- `src/controllers/` — thin handlers per domain. Each method validates with
  zod, calls a model function, and shapes the response.
- `src/routes/` — one router per domain, mounted under `/api/v1` in
  `routes/index.ts`.
- `src/utils/csv.ts` — CSV builder (used by the league/season export
  controllers).
- `src/validators/common.ts` — shared zod schemas.

### Caching

Two-layer per request: the model layer wraps Supabase calls with
`withRedisCache(key, ttl, loader)` (in-memory + Redis) using the same TTLs as
the original (`1h` / `6h` / `24h`). Public GET routes don't add a route-level
cache wrapper because the model layer already covers them. The `cacheRoute`
middleware in `middleware/cache.ts` exists for cases where a controller's
output isn't keyed cleanly to a model query.

### Auth

Steam OpenID flow:
1. `GET /auth/steam/login` → 302 to `steamcommunity.com/openid/login` with
   `return_to=$AUTH_BASE_URL/api/v1/auth/steam/callback`.
2. Callback verifies the OpenID signature, fetches the Steam profile, upserts
   into `users` table, sets a signed HMAC cookie (`dd_session`), and redirects
   to `FRONTEND_ORIGIN`.
3. `parseSession` middleware decodes the cookie on every request and attaches
   `req.user = { steamid }` if valid.
4. `requireAuth` middleware throws 401 if `req.user` is unset (used on
   comment write/delete).

### Rate limiting

`createRateLimiter({ windowMs, max })` in `middleware/rate-limit.ts`. Backed by
`rate-limit-redis` (initialized in `server.ts` before `listen`). Falls back to
in-memory if Redis isn't configured. Applied to `/contact` (IP + email),
`/comments` write/delete, `/auth/steam/*`.

## Frontend (`frontend/`)

- `src/app/[locale]/` — App Router pages. All Server Components; data fetched
  via `@/lib/supabase/queries` (a shim) or `@/lib/blog-posts` (also a shim) —
  both delegate to `apiFetch` which calls the backend.
- `src/lib/api/client.ts` — `apiFetch<T>` helper. Picks
  `API_INTERNAL_BASE_URL` for server-side calls, `NEXT_PUBLIC_API_BASE_URL` for
  browser. Throws `ApiError(status, code, message)` on non-2xx.
- `src/lib/api/index.ts` — typed `apiClient` covering every backend route
  (preferred for new code).
- `src/lib/supabase/queries.ts` — back-compat shim with the original 33
  function signatures, all routed through `apiFetch`. Exists so the existing
  pages didn't need a rewrite during the split.
- `src/lib/blog-posts.ts` — same idea for `getBlogPosts` /
  `getBlogPostBySlug` / `parseInlines`.
- `src/lib/types.ts` — re-exports `@shared/types/index`.
- `src/components/site-auth.tsx` — server component. Calls `/auth/me` with
  the request cookie header to detect the session; login link points to
  `/auth/steam/login` on the backend.
- `src/proxy.ts` — Next middleware. Just delegates to next-intl (rate
  limiting is now on the backend).

### Why a shim instead of a full rewrite?

The original 17 page.tsx files use `@/lib/supabase/queries` heavily with
ID-based function signatures. Rather than rewriting every page in lock-step,
the shim preserves those signatures while moving all data access behind the
HTTP boundary. The shim is a stepping stone — when redesigning a page, prefer
`apiClient` over the shim.

### Static generation / ISR

`generateStaticParams()` in dynamic routes pulls slugs/ids from the API.
Pages set `export const revalidate = 86400` for 24h ISR. The fetch helper
threads `next: { revalidate }` so Next handles the cache, on top of the
backend's own Redis cache.

### Charts

`ClientChartFrame` (`src/components/charts/client-chart-frame.tsx`) wraps
Recharts to avoid SSR hydration mismatches. Existing pattern preserved.

## Database

Supabase Postgres (managed). Schema lives in the original `/web/supabase/`
folder; this v2 repo doesn't duplicate it. When the backend can't reach
Supabase (no env vars), models fall back to mock data from
`backend/src/models/mock.ts`.

## Deploy

```bash
DEPLOY_HOST=deploy@your-host DEPLOY_PATH=/srv/dotadata ./scripts/deploy.sh
```

The script rsyncs the repo to the host, runs `docker compose build && up -d`,
and prunes old images. Pre-existing `.env` on the host is preserved.

## What's still pending

- **Design system + page redesigns (#8)** — unscoped. Tokens and component
  variants need a design pass before code; pick one feature area at a time
  (home → leagues → teams → patches → blog).
- **Page rewrites away from the shim** — opportunistic; do it as part of
  redesign work, not as its own pass.
