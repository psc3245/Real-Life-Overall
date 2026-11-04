# Real Life Overall

A 2K-style overall rating for your real life, with ratings moved by an LLM. See
[docs/DESIGN.md](docs/DESIGN.md) for the vision, decisions and roadmap.

## Layout

| Path              | What                                                                              |
| ----------------- | --------------------------------------------------------------------------------- |
| `apps/web`        | React + Vite + React Router + TanStack Query + Tailwind                           |
| `apps/mobile`     | iOS app: Expo + Expo Router + TanStack Query                                      |
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
   `apps/api/.env` (read by drizzle-kit), then fill in `DATABASE_URL`, `ANTHROPIC_API_KEY` and
   `BETTER_AUTH_SECRET` (`openssl rand -base64 32`). For Google sign-in, also set
   `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` from a Google Cloud OAuth client whose redirect URI
   is `http://localhost:5173/api/auth/callback/google`.
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

Sign in at http://localhost:5173/signup (DESIGN.md §8.5). For quick experiments without accounts,
set `AUTH_MODE` to `dev` in `apps/api/wrangler.jsonc`: the API then trusts an `x-dev-user` header,
switchable from the web app's header.

### iOS app

Needs Xcode with an iOS Simulator runtime. With the API running (`npm run dev:api`), build and
launch the app in the Simulator once:

```bash
npm run ios
```

After that, `npm run dev:mobile` starts just the bundler for the installed app. The app calls the API
on port 8787 of the machine serving the bundle (`localhost` in the Simulator); set
`EXPO_PUBLIC_API_URL` to point it elsewhere. It's iOS only; there is no Android build.

It also needs CocoaPods (`brew install cocoapods`). Let Expo install pods (`npm run ios`, or
`npx expo prebuild -p ios` in `apps/mobile`); a bare `pod install` fails the Reanimated and Worklets
version checks in this monorepo. Rerun one of those after adding a package with native code.

### Demo data

To see the app with a few weeks of history (habits and a habit group, journals, recaps, decay, a
paused flu week, weekly reviews, goals, badges and a full previous season), seed a demo player:

```bash
npm run seed:demo -w @rlo/api
```

It writes straight to the database with no AI calls, is deterministic, and replaces any previous
demo account. Sign in with the credentials at the top of `apps/api/scripts/seed-demo.ts`, or in
`AUTH_MODE=dev` switch the dev user to `demo`.

It also adds four rival players for the social features (two friends, one incoming request, one
public stranger). They're cached cards only and can't sign in.

### Scheduled jobs

The API runs an hourly Cron Trigger: it brings rating decay up to date for every user and, at 4am
in each user's timezone, recaps any recent day that has content but no current recap. To try it
locally:

- In the web app (dev builds only), **Rating → Decay & pauses → Run 4am job now** runs it for
  the current user immediately.
- Or run the real Worker handler: start the API with
  `npx wrangler dev --test-scheduled` (in `apps/api`) and open `http://localhost:8787/__scheduled`.

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

Deploys apply migrations before the new code goes live, so a migration must keep the running
version working: add columns and tables, and drop old ones in a later deploy.

## Deploying

Branch off `development` and open PRs into it. Merging into `development` deploys **staging**;
merging `development` into `main` deploys **production** (DESIGN.md §8.8). Both run through
`.github/workflows/deploy.yml`: CI, web build, migrations, then `wrangler deploy`. Each environment
is one Worker serving the web app and the API on the same origin.

### One-time setup

1. **Cloudflare:** run `npx wrangler login` in `apps/api`. Create an API token from the "Edit
   Cloudflare Workers" template, and note your account ID.
2. **Neon:** production has its own project, linked with `neon.ts` (`neon init`, Postgres only:
   sign-in stays on Better Auth). `neon env pull` writes its URLs to `.env.local` (gitignored):
   `DATABASE_URL` is pooled, for the Worker; `DATABASE_URL_UNPOOLED` is direct, for migrations.
   Staging can use the dev database. Never run `seed:demo` against production, because the demo
   login is in this repo.
3. **Worker secrets:** set these once per environment (`--env staging`, then `--env production`):

   ```bash
   npx wrangler secret put DATABASE_URL --env production
   ```

   `DATABASE_URL` is the pooled URL. Repeat for `ANTHROPIC_API_KEY`, `BETTER_AUTH_SECRET` (new per environment:
   `openssl rand -base64 32`), `RESEND_API_KEY` and `EMAIL_FROM`. Add `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET` too if you use Google sign-in. The first `secret put` creates the Worker
   if it doesn't exist yet.
4. **GitHub environments:** in **Settings → Environments**, create `staging` and `production`, and
   give each:
   - secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `DATABASE_URL_UNPOOLED` (the
     direct URL, used for migrations);
   - the variable `PUBLIC_URL`: the `https://` origin people load the app from. Production refuses to
     boot without it.

   Limit `production`'s deployment branches to `main`.
5. **Branch protection:** in **Settings → Rules**, add a ruleset for `main` that requires a pull
   request (0 approvals), requires the `check` status, and blocks force pushes and deletion.
6. **Domain and email:** add the domain to the production Worker (**Workers → Settings → Domains &
   Routes**) and verify it in Resend. For Google sign-in, add the redirect URI
   `<PUBLIC_URL>/api/auth/callback/google`.
7. **Spend limit:** set a monthly limit in the Anthropic Console. The API also caps each user's daily
   LLM spend (`LLM_USER_DAILY_BUDGET_USD`, default $1).

To deploy by hand instead, build the web app first (`npm run build -w @rlo/web`), then in
`apps/api`:

```bash
npx wrangler deploy --env staging --var PUBLIC_URL:https://your-staging-url --var CORS_ORIGINS:https://your-staging-url
```

On the free Workers plan, each request and cron run gets 10 ms of CPU. After the first deploy, check
sign-in and the hourly job in **Workers → Observability**. If they exceed that limit, move to
Workers Paid.
