# dotadata

Refactored split-stack version of the original `web/` monolith.

## Layout

```
frontend/   Next.js 16 app (UI + SSR/ISR), calls the API
backend/    Express + TypeScript MVC API (data, auth, exports)
shared/     TS types shared across both
docker-compose.yml
```

## Local development

```bash
cp .env.example .env       # then fill in values
docker compose up --build
```

- Web:    http://localhost:3000
- API:    http://localhost:4000/api/v1/health
- Redis:  redis://localhost:6379

## Without Docker

```bash
# terminal 1
cd backend && npm install && npm run dev

# terminal 2
cd frontend && npm install && npm run dev
```

## Architecture notes

See `/Users/jhonatansilva/.claude/plans/i-want-to-change-zippy-garden.md` for the
full refactor plan: REST contract, MVC layout, middleware wiring (helmet, CORS,
pino, rate-limit, auth, cache, error), and migration order.
