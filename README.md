# Real Life Overall

A 2K-style overall rating for your real life, with ratings moved by an LLM. See
[docs/DESIGN.md](docs/DESIGN.md) for the vision, decisions and roadmap.

## Layout

| Path              | What                                                                              |
| ----------------- | --------------------------------------------------------------------------------- |
| `apps/web`        | React + Vite + React Router + TanStack Query + Tailwind                           |
| `apps/api`        | Hono API on Cloudflare Workers, Drizzle + Neon Postgres, provider-agnostic LLM layer |
| `packages/shared` | Zod schemas, rating math, templates and constants shared by both apps            |

## Getting started

Requires Node 22+ (see `.nvmrc`).

```bash
npm install
```

### API

1. Create a free Neon project and copy its connection string.
2. Copy `apps/api/.dev.vars.example` to **both** `apps/api/.dev.vars` (read by `wrangler dev`) and
   `apps/api/.env` (read by drizzle-kit), then fill in `DATABASE_URL` and `ANTHROPIC_API_KEY`.
3. Apply migrations and start the API on http://localhost:8787:

```bash
npm run db:migrate -w @rlo/api
npm run dev:api
```

### Web

```bash
npm run dev:web
```

Opens on http://localhost:5173 and proxies `/api/*` to the local API.

Auth is deferred (DESIGN.md §8.5). In dev, the API trusts an `x-dev-user` header, which you can
switch from the header of the web app.

## Checks

```bash
npm run lint
npm run typecheck
npm test
```

API tests run against an in-memory Postgres (PGlite) with the real migrations, and a mock LLM, so
they need no database or API key.

## Database changes

Edit `apps/api/src/db/schema.ts`, then generate a migration and commit it:

```bash
npm run db:generate -w @rlo/api
```
