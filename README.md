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
./scripts/dev.sh             # native: backend on :4000, frontend on :3000
./scripts/dev.sh --docker    # docker compose up --build (web + api + redis)
./scripts/dev.sh --backend   # only the backend
./scripts/dev.sh --frontend  # only the frontend
./scripts/dev.sh --install   # force-install deps first
```

The script seeds `.env`, `backend/.env`, and `frontend/.env.local` from
`.env.example` on first run. Fill in real Supabase / Steam / webhook values
before pointing at production data.

- Web:    http://localhost:3000
- API:    http://localhost:4000/api/v1/health
- Redis:  redis://localhost:6379  (only in `--docker` mode)

## Deploy

```bash
DEPLOY_HOST=deploy@your-host DEPLOY_PATH=/srv/dotadata ./scripts/deploy.sh
```

`scripts/deploy.sh` rsyncs the repo (excluding `.git`, `node_modules`,
build outputs, and `.env*`), then SSHes in to run
`docker compose build && up -d` and prune old images. Pre-existing `.env`
on the host is preserved.

## Architecture notes

See `/Users/jhonatansilva/.claude/plans/i-want-to-change-zippy-garden.md` for the
full refactor plan: REST contract, MVC layout, middleware wiring (helmet, CORS,
pino, rate-limit, auth, cache, error), and migration order.
