# Real Life Overall

A 2K-style overall rating for your real life, with ratings moved by an LLM. Live at
[getovr.dev](https://getovr.dev), on the web and in an iOS app. See [docs/DESIGN.md](docs/DESIGN.md)
for the full design, decisions and roadmap; this section is the short version.

## How it works

### Your rating

You get an **Overall (OVR)** built from categories you choose (Fitness, Career, Social, Mind…), each
split into attributes, the way NBA 2K splits Shooting into Mid-Range and Three-Point. Attributes can
nest up to 3 levels below Overall. Every value is 0-100: only the leaves hold real ratings, and
parents are weighted averages of their children.

Ratings are a ledger: every change is a row with a source and a reason, so the app can always say
why a number moved, chart any node over time, and re-run a past day.

### Getting rated (onboarding)

1. **Discover:** a short chat with the scout about your goals and routines; it drafts a tree of
   categories, attributes and weights. Or skip it and build your own from templates.
2. **Build and weigh** the tree, then answer a questionnaire of concrete, behavior-anchored
   questions ("how many days last week did you do 20+ minutes of cardio?").
3. **Follow-up and reveal:** the scout asks a few clarifying questions, then rates every attribute
   with a rationale, writes its decay rules, and names your archetype. The card reveal animates it.

**The Combine** is the no-AI path: fixed-score questions per template attribute, rule-based decay
and archetype. Free accounts always use it; Premium players can choose it.

### The daily loop

- **Log your day** at `/log`: a journal, habit check-ins, answers to the scout's questions and your
  own scheduled questions, goal progress, workouts and (if you track them) weight and height.
- **End my day** runs the **daily recap**: the model reads the day (plus your profile summary, your
  Scouting Report and related older days found by full-text search) and returns per-attribute
  changes with reasons and evidence, a short narrative, and flags for implausible claims. If you
  don't end the day, it runs at 4am your time. Days with nothing logged cost no AI call.
- **Decay:** each attribute has a rule the model wrote (grace days, points per day, a floor). Code
  applies it when you neglect that attribute. Pauses (vacation, injury) stop decay.
- **Backfill:** you can log or edit the last 3 days; editing a recapped day re-runs its recap.
- **Rails:** code only checks the model's output is valid and caps it (±3 per attribute per day,
  ±5 per weekly correction, 3 recap runs a day). The model decides everything else and is told to
  be skeptical.

### The weekly review

After your week's last recap, the **weekly review** writes a narrative, makes corrections the
daily recaps missed, revises decay rules, sets focus goals, proposes habits (you accept or reject),
projects end-of-season ratings, updates your archetype, and rewrites your profile summary and
Scouting Report. It runs as two parallel calls on the same prompt: the review itself, and the
**evolution** of your tree:

- The **Scouting Report** (`/scouting-report`) is what you want out of life: aspirations,
  prioritized areas mapped to your tree, focuses and constraints. You can edit it.
- **Weights shift automatically** toward what the report says matters: up to 3 per week, ±15% each,
  within half to double their season-start value. Every shift can be undone.
- **Tree proposals** (add or remove a category or attribute) are rare, at most one every 4 weeks,
  and apply only if you accept them.

### Seasons and modes

A season is a calendar quarter. At its end the tree and values are archived as a season card;
season setup lets you edit the tree and weights, and new ratings start from a recalibration. Each
season is played in one mode, picked at setup and locked after:

- **Rating:** the 0-100 OVR as described above. Premium only.
- **Growth ("Most Improved"):** you're scored on points gained this season: recap gains count,
  weekly corrections take back over-credit, decay never subtracts. The rating keeps running
  underneath, visible only to you.
- **Souls** (in testing, Dev and Admin only): recaps earn souls instead of moving your stats.
  You spend them at the **Bonfire** to level your own attributes (1-99, with soft caps, never
  decaying). A missed day, a slip on an avoid habit, or a bad day drops your unspent souls as a
  bloodstain you can recover the next good day. The whole app reskins as a dark-fantasy game, and
  New Game+ carries levels into the next Souls season.

### Around the loop

- **Habits:** 8 input types (checkbox, check + note, counter, duration, slider, star rating, short
  text, journal), each **build** or **avoid**, linked to attributes (the model suggests, you confirm), with
  groups and stats at `/habits`.
- **Goals with a deadline:** a total by a date ("run 100 miles by New Year's") or a reach from one
  number to another ("200 lb down to 185 by June"), fed manually, by a habit, by workouts or by
  logged weight. Pace and status are computed.
- **Workouts:** set-by-set logging after Strong, for lifting and sport (weight × reps, time,
  distance, makes/attempts), unlimited templates, personal records and an exercise library.
- **Coach** (`/coach`, Premium): a chat grounded in your data that suggests habits, goals and
  Scouting Report lines you add with one tap.
- **Game layer:** a shareable player card, archetype, badges (a rule-based catalog plus personal
  ones the model writes), hot/cold streaks, goal ratings and projected potential, a heatmap.
- **Charts and reports:** every number has a metric id; `/charts` plots up to 6 with averages,
  trends and correlation, and pinned charts show on Today. Reports are chart sets run over a period,
  saved as snapshots, with optional AI write-ups.
- **Social:** profiles at `/u/:username`, mutual friends, side-by-side compare, and leaderboards per
  season and mode (friends and global). Everything is private by default; sharing covers only the
  card (Overall, archetype, category values, catalog badges). Journals, recaps and attribute names
  are never shared. Global boards need 7 recapped days and leave out heavily flagged players.
- **Make it yours:** themes, accents, fonts and layout; switch whole features off; arrange the Today
  page; and **sports talk** (none, normal or extra) changes both the app's words and the model's
  voice.

### Accounts and AI cost

| Type        | Gets                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------- |
| **Free**    | Growth seasons, daily recaps and weekly reviews, the Combine. A $0.25 daily AI budget.          |
| **Premium** | Everything: Rating seasons, the coach, the AI scout, AI report write-ups. A $1 daily AI budget. |
| **Dev**     | Play testers: lifetime Premium, features in testing (Souls) and bug reports.                    |
| **Admin**   | Premium plus `/admin`: the Front office for accounts, bug reports and debug tools.              |

There's no checkout yet; admins change account types by hand. Every LLM call is logged with its
tokens and estimated cost, and a user over budget gets "today's AI limit" until it frees up. The
hourly job is exempt, so recaps and reviews always run.

### The iOS app

Five tabs (Today, Playbook, Week, Rating, You) with the web's features: logging, habits, goals, the
workout tracker, ratings, the coach, charts, reports, social, seasons, Souls and onboarding. The
web's look options and admin debug panel stay web-only. Google sign-in, push notifications and
TestFlight builds aren't done yet.

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
on port 8787 of the machine serving the bundle (`localhost` in the Simulator); a release build
calls production (`https://getovr.dev`). Set `EXPO_PUBLIC_API_URL` (and `EXPO_PUBLIC_WEB_URL` for
email and profile links) to point either one elsewhere, such as staging. It's iOS only; there is no Android build.

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
`AUTH_MODE=dev` switch the dev user to `demo` (or `souls` for a Souls season).

It also adds rival players for the social features (friends, an incoming request, public
strangers, and growth-mode rivals for the Most Improved boards). They're cached cards only and
can't sign in.

For one sign-in account per account type (Free, Premium, Dev, Admin), run
`npm run seed:accounts -w @rlo/api`; the password is `TEST_PASSWORD` in that script.

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

### The first admin

Admins manage accounts in the web app's `/admin` → Front office (create, delete, change type,
resend emails). To make the first one in an environment, list your email in `ADMIN_EMAILS`:

```bash
npx wrangler secret put ADMIN_EMAILS --env production
```

Enter your email (comma-separate several). Sign up at the site with that address and confirm it;
your next request makes the account Admin. Keep it a secret rather than a `wrangler.jsonc` var so
the address stays out of the repo. It only promotes: to demote a listed account, remove it from the
list first. Once you're in, grant other admins from the Front office. Alternatively, with the
production `DATABASE_URL` in `apps/api/.env`, run `npm run set-role -w @rlo/api -- you@example.com
admin`.

To deploy by hand instead, build the web app first (`npm run build -w @rlo/web`), then in
`apps/api`:

```bash
npx wrangler deploy --env staging --var PUBLIC_URL:https://your-staging-url --var CORS_ORIGINS:https://your-staging-url
```

On the free Workers plan, each request and cron run gets 10 ms of CPU. After the first deploy, check
sign-in and the hourly job in **Workers → Observability**. If they exceed that limit, move to
Workers Paid.
