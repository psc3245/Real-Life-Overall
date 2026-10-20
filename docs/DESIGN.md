# Real Life Overall: Design & Development Guide

> **Working title.** The brand name is undecided; "Real Life Overall" / "OVR" are placeholders.
> **Status:** Pre-development. This document is the source of truth for scope, architecture and decisions. Update it when a decision changes.
> **Last updated:** 2026-10-20

---

## 1. Vision

A platform where you build a **2K-style player rating for your own life**. You get an **Overall (OVR)** made up of categories you choose (Fitness, Career, Social, Mind…), each broken into attributes, the way NBA 2K breaks "Shooting" into Mid-Range, Three-Point and so on.

**The core idea:** your ratings are governed by an **LLM**. You don't just tick boxes and get a formula's output. You tell the app about your life (journal write-ups, habit check-ins, answers to guided prompts, and later photos and voice notes). The LLM:

1. **Seeds** your starting ratings from an onboarding questionnaire built for your chosen categories.
2. **Moves** your ratings up and down from what you log each day, and explains why.
3. **Writes the decay rules** for each attribute and revises them over time.
4. **Coaches** you with weekly focus goals and suggested habits.

The spiritual predecessor is the Habit Tracker ([frontend](https://github.com/psc3245/Habit-Tracker), [backend](https://github.com/psc3245/Habit-Tracker-Backend)). Habit check-ins come back here as one of several inputs, but this is a **fresh codebase** that borrows patterns from it.

**Goal:** a real product that can **eventually be monetized**. The model is undecided, so the architecture must track LLM cost per user from day one.

---

## 2. Decision Log (from the kickoff Q&A)

| Topic | Decision |
|---|---|
| Who is rated | **The user themself** (self-rating). Not peers, not arbitrary objects. |
| What drives ratings | **The LLM decides** stat changes from daily/weekly inputs. Tracked activity (habits) is one input. |
| Relation to Habit Tracker | **Fresh codebase**, borrow patterns and code where useful. |
| Hierarchy | **2K-style by default** (Overall → Category → Attribute), with nesting allowed up to **3 levels below Overall**. |
| Scale | **0–100 with decimals** (e.g. 74.3). |
| Overall calculation | Weighted roll-up. **User and LLM collaborate** on weights: the LLM proposes and the user adjusts. |
| Categories | **Templates + custom.** |
| Category edits | **Only at season start.** The structure is locked for the season. |
| Inputs (eventual) | Free-text daily journal, habit check-ins, LLM-guided prompts, photos and voice notes. |
| Update cadence | **Daily recap + weekly review.** |
| LLM authority | **LLM fully decides** deltas. Code enforces only hard invariants and wide anti-abuse rails (§5.6). |
| Explainability | **Both**: a narrative recap plus itemized per-change reasons. |
| Decay | **Hybrid**: the LLM authors per-attribute decay rules, code applies them, and the LLM revises them in weekly reviews. |
| Missed days | **All of:** decay applies by default, a backfill window exists, and a pause (vacation/injury) mode exists. |
| Editing a past day after its recap | **Re-run that day's recap.** |
| Onboarding | **Structured form, then a chat follow-up** with the LLM, then initial ratings. |
| Recalibration | **Season reset** each **calendar quarter**. |
| Potential | **Both**: user-set goal ratings plus an LLM-projected end-of-season rating. |
| Badges | **Hybrid**: a core catalog with a deterministic rule engine, plus LLM-generated personal badges. |
| Archetype | LLM-assigned build name (e.g. "Two-Way Scholar-Athlete"). |
| Coaching | **Weekly focus goals and habit proposals** (the user accepts proposals). |
| LLM persona | **Neutral**, informative tone. |
| Habit ↔ attribute links | **LLM suggests, user confirms.** |
| Habit input types | All 8 from Habit Tracker: checkbox, checknote, counter, duration, slider, rating, shorttext, journal. |
| LLM memory | **Full-history retrieval (RAG)**. |
| Day boundary | **User's timezone.** The recap runs on "End my day", otherwise automatically the next morning. |
| Social (eventual) | Public card sharing, friends and compare, leaderboards. |
| Privacy | **Undecided.** Build private by default. |
| Anti-gaming | **LLM skepticism plus caps.** Accept some cheating. |
| Visual direction | **Video-game menu (2K-like)**: dark, bold, sporty, neon accents, animated stat bars. |
| Visualizations | Rating history line charts, radar chart, daily change feed, calendar heatmap. |
| Platform | **Web first, mobile later.** |
| Language | **TypeScript everywhere.** |
| Hosting | **Must be free to host** (LLM API spend aside). |
| Repo layout | **Monorepo** (this repo). |
| ORM | **Drizzle.** |
| Auth | **Deferred.** Decide before public launch (§13). |
| LLM provider | **Provider-agnostic layer.** |
| LLM cost control | **Cheap model by default.** Monetization model decided later. |
| Testing | **Unit and integration tests, with CI.** |
| MVP | **Categories + onboarding → initial ratings.** |
| Doc scope | Full vision with a phased roadmap. |

---

## 3. Glossary

| Term | Meaning |
|---|---|
| **OVR / Overall** | The root rating node. Always computed, never set directly. |
| **Rating node** | Any node in the tree: Overall, a category, an attribute or a sub-attribute. |
| **Leaf** | A node with no children. **Only leaves hold "raw" ratings that the LLM changes.** Parents are computed. |
| **Category** | A depth-1 node (e.g. Fitness). |
| **Attribute** | A depth-2 node (e.g. Cardio). Depth 3 is a sub-attribute. |
| **Weight** | A node's share of its parent's value, relative to its siblings. |
| **Delta** | A signed change to a leaf from one event (recap, decay, onboarding). |
| **Rating event** | An append-only ledger row recording one delta, its source and its reason. |
| **Day log** | Everything a user logged for one local date: journal, habit entries, prompt answers, attachments. |
| **Daily recap** | An LLM pass over one day log that produces deltas, reasons and a short narrative. |
| **Weekly review** | An LLM pass over the week that produces a narrative, corrective deltas, decay-rule revisions, focus goals, habit proposals and a potential projection. |
| **Decay rule** | An LLM-authored, code-executed rule for how a leaf drops when neglected. |
| **Season** | A calendar quarter. It sets the structure lock, the recalibration point and the archive boundary. |
| **Pause** | A user-declared period (vacation or injury) during which decay doesn't apply. |
| **Archetype** | The LLM-assigned build label for the user's attribute profile. |
| **Potential** | The user's goal rating plus the LLM's projected end-of-season rating. |

---

## 4. The Rating Model

### 4.1 Tree structure
```
Overall (depth 0, computed)
├── Fitness (depth 1, computed if it has children)
│   ├── Cardio (depth 2, leaf)
│   ├── Strength (depth 2)
│   │   ├── Upper Body (depth 3, leaf)
│   │   └── Lower Body (depth 3, leaf)
│   └── Flexibility (depth 2, leaf)
└── Career (depth 1)
    └── ...
```
- The default template shape is Overall → Category → Attribute (2K-style).
- Max depth is **3 below Overall**. Keep it as a named constant (`MAX_RATING_DEPTH = 3`) in `packages/shared`.
- A category with no children is itself a leaf. That's allowed, though templates always give attributes.
- **The structure is locked during a season.** Add, remove, rename and reweight only happen during season setup (first onboarding or a new season). *Open question: are typo-only renames allowed mid-season? (§13)*

### 4.2 Values
- Scale is **0–100**, stored as `numeric(5,2)`. Display rules:
  - Detail views show one decimal (`74.3`).
  - The player card shows the rounded integer for the big OVR and one decimal elsewhere. *(Confirm in UI design.)*
- **A leaf's value is derived from its event ledger**: `value = clamp(0, 100, Σ deltas)`, where the onboarding event sets the initial value. A cached current value is kept for reads.
- **A parent's value** is the weighted mean of its non-archived children. It's computed on read or on cache refresh, never stored as a source of truth.

### 4.3 Weights
- During onboarding the LLM proposes weights per sibling group, based on the questionnaire and the user's stated priorities. The user adjusts them with sliders.
- Weights are normalized within each sibling group, so they don't need to sum to 1 in storage.
- Weights are locked for the season like the rest of the structure.

### 4.4 Why a ledger (event-sourced ratings)
- **Explainability**: every change has a reason row, which feeds the change feed directly.
- **Re-running a past day's recap** becomes simple: void that recap's events, run it again, and insert new events. Later events are untouched deltas, so current values just get re-summed.
  - *Known caveat:* later recaps were written when the value was different, so re-runs can drift slightly from what the LLM "would have" done. That's acceptable.
- **Charts**: history comes from cumulative sums. Nightly snapshots exist only as a read optimization.
- **Seasons**: each season starts with a recalibration event per leaf.

---

## 5. The LLM Engine

All LLM work lives behind one internal module, `apps/api/src/llm/`, with a **provider-agnostic interface** (§8.4). Every call:
- uses **structured output validated by Zod** (shared schemas) and retries on validation failure (max 2), then fails visibly;
- is **logged to `llm_calls`** with purpose, provider, model, tokens, estimated cost, latency and error;
- uses a **cheap model by default**. Which model each purpose uses is config, not code.
- uses a **neutral tone** for every user-facing text.

### 5.1 Onboarding: form, then chat, then initial ratings (**MVP**)
1. **Build the tree.** The user picks templates (Fitness, Career, Social, Mind, Finance, Creativity…) and/or custom categories. They can edit attributes, add sub-attributes (≤ depth 3), and describe each node in one line. Optionally the LLM suggests missing attributes for a category.
2. **Weights.** The user ranks or describes what matters to them. The LLM proposes weights and the user adjusts them.
3. **Generate the questionnaire.** The LLM returns a structured form, a set of question objects tied to leaf nodes:
   - types: `single_choice`, `multi_choice`, `slider` (with labeled min/max), `number` (with unit), `short_text`;
   - roughly 2–4 questions per leaf, capped overall so onboarding stays under ~10 minutes. *Open: exact cap (§13).*
   - Questions should ask for **concrete, behavior-anchored** facts ("How many days last week did you do 20+ min of cardio?") rather than self-ratings ("How fit are you?").
4. **Answer the form.** Progress is saved so the user can resume.
5. **Chat follow-up.** The LLM reviews the answers and asks clarifying questions in a short chat, bounded at about 5 turns, then signals it's done.
6. **Initial ratings.** The LLM returns, per leaf: value (0–100), confidence, and a one-to-two-sentence rationale. It also returns:
   - initial **decay rules** per leaf (§5.4);
   - an initial **archetype**;
   - optional suggested **goal ratings**.
7. **Reveal.** The OVR reveal screen animates the card, Overall, categories and attributes, with an expandable rationale.
   *Open: can the user dispute a rating at reveal? (§13)*

**Calibration guidance for the prompt.** The prompt must define what the numbers mean, or ratings will cluster at 70–85. For example: 50 = typical adult, 70 = clearly above average, 85 = top ~5% among peers, 95+ = elite or professional. Store this rubric as a versioned prompt asset and test it with evals.

### 5.2 Daily recap (Phase 2)
- **Trigger:** the user hits **"End my day"**, or, if they don't, it runs **automatically at 04:00 the next morning, user-local** (cron, §8.6).
- **Input context:**
  - the day log: journal, habit entries plus their confirmed attribute links, guided-prompt answers, and attachments (later);
  - the current tree with values, weights and active decay rules;
  - the **rolling profile summary** plus **RAG-retrieved** relevant past entries and recaps (§5.5);
  - the calibration rubric and anti-gaming instructions (§5.6).
- **Output (structured):**
  - `changes[]`: `{ nodeId (leaf), delta, reason, evidence (quote/ref) }`
  - `narrative` (short, neutral)
  - `flags[]` (e.g. "implausible claim", "ambiguous entry")
- **No-data days:** if nothing was logged, no LLM call happens. Only decay runs, which saves cost.
- **Backfill window:** users can log or edit past days within **N days**. *Open: N, suggested 3 (§13).*
- **Editing a recapped day:** this triggers a **re-run** of that day's recap (void the old events, run again).

### 5.3 Weekly review (Phase 2)
- **Trigger:** after the last daily recap of the user's week (week start is a user setting, default Monday).
- Uses a **smarter or bigger model** if budget allows (config).
- **Output:**
  - a narrative of the week;
  - optional corrective `changes[]` (the big-picture view can adjust for things daily recaps missed or double-counted);
  - **decay rule revisions** (§5.4);
  - **focus goals** for next week (e.g. "Get Cardio to 72: add two runs");
  - **habit proposals**, each with suggested attribute links, which the user accepts or rejects;
  - an updated **potential projection** (end-of-season estimate per category and Overall);
  - an archetype update (Phase 3);
  - an updated **rolling profile summary** (memory, §5.5).

### 5.4 Decay (hybrid)
- **Rules are data the LLM writes and code runs.** Example shape (Zod in `packages/shared`):
  ```ts
  { nodeId, graceDays: 3, perDay: 0.2, floor: 40, notes: "Cardio fades after ~3 idle days" }
  ```
  - `graceDays`: days without relevant activity before decay starts
  - `perDay`: points lost per day after grace
  - `floor`: decay never pushes below this
- "Relevant activity" means any rating event with a positive delta on that leaf, or a completed habit linked to it.
- **Decay runs nightly per user** (as part of the daily recap job, or on its own if no recap). It writes `decay` events with auto-generated reasons.
- **The weekly review can revise rules.** Rules are versioned and old versions are kept.
- **Pause mode:** during an active pause, decay is skipped. Recaps still run if the user logs anything.
- *Open: should users be able to view and edit decay rules? (Default: view only.)*

### 5.5 Memory: full-history RAG
- **Embeddings** of journal entries, prompt answers, recap narratives and onboarding answers, stored in **Postgres with `pgvector`** (supported on Neon).
- **Retrieval:** top-k by similarity to today's log, plus filters (same leaf nodes, recency boost).
- **Rolling profile summary:** a compact LLM-maintained text about goals, context and recurring patterns, updated in the weekly review and **always included** in prompts.
- The embedding model is also behind the provider-agnostic layer and logged for cost.

### 5.6 Guardrails & anti-gaming
The LLM decides deltas. **Code only enforces:**
1. **Schema validity**: output parses; `nodeId`s are existing, active **leaves** in the current season.
2. **Range**: values are clamped to 0–100.
3. **Wide sanity caps**, as anti-abuse rails rather than scoring logic. For example, |delta| ≤ 3.0 per leaf per daily recap and ≤ 5.0 per leaf per weekly review. All caps are config. *Open: confirm this doesn't conflict with "LLM fully decides" (§13).*
4. **Skepticism prompting**: the prompt tells the LLM to weigh implausible or unverifiable claims lightly, prefer consistency over single big claims, and emit `flags`.
5. **Rate limits**: one daily recap per day (re-runs aside), plus limits on re-runs.

Later (Phase 4, when leaderboards exist): evidence-backed inputs (photos, integrations) may count more.

### 5.7 Prompt management
- Prompts live in `apps/api/src/llm/prompts/` as versioned TypeScript modules. Each prompt has a `version` string that is stored on every `llm_calls` and `recaps` row.
- Calibration rubrics, persona and tone rules, and anti-gaming instructions are shared prompt fragments.

---

## 6. Inputs

| Input | Phase | Notes |
|---|---|---|
| Onboarding form + chat | **1 (MVP)** | §5.1 |
| Free-text daily journal | 2 | One per day log; editable within the backfill window. |
| Habit check-ins | 2 | 8 types carried over from Habit Tracker; linked to leaves (LLM suggests, user confirms). Habits keep recurrence (`interval` + `days`) like before. |
| Guided prompts | 2 | Each day the LLM generates 1–3 targeted questions, for example about weak or stale attributes, or follow-ups to yesterday. These are generated cheaply, or as a by-product of the previous recap. |
| Photos | 5 | Stored in object storage; sent to a vision-capable model. |
| Voice notes | 5 | Transcribed (speech-to-text, provider-agnostic), then handled as text. |
| Third-party integrations | Later / unscoped | Strava, Apple Health, GitHub, etc. Not decided. |

---

## 7. Game Layer & Social

### 7.1 Game features (Phase 3)
- **Player card**: avatar, OVR, archetype, top categories and attributes, season label. Rendered in-app and **exportable as an image** for sharing.
- **Archetype**: an LLM-assigned build name based on the attribute profile, updated weekly.
- **Badges (hybrid)**:
  - a **core catalog** with deterministic criteria run by a rule engine (e.g. 30-day logging streak, 10 recaps with Fitness gains). Tiers: Bronze, Silver, Gold, Hall of Fame;
  - **personal badges** that the LLM invents in weekly reviews for user-specific achievements, with a cap per season.
- **Hot/cold streaks**: per-leaf trend indicators from recent deltas, plus a heatmap.
- **Potential**: user-set goal ratings plus the LLM's projected end-of-season rating, shown as a ghost bar on the stat bars.
- **Seasons**: each **calendar quarter**:
  - the old season's tree and values are archived as a **season card**;
  - in season setup, the user can edit structure and weights and retake questionnaires for changed or new nodes;
  - the LLM recalibrates the starting values, writing `recalibration` events;
  - *Open: if a user onboards mid-quarter, is the first season shortened or extended? Suggested: shortened (§13).*

### 7.2 Visualizations (Phase 3, plus basics earlier)
- Rating history line charts (Overall, categories, any node)
- Radar / spider chart of categories
- Daily change feed (ledger events with reasons)
- Calendar heatmap (logging consistency and net daily delta)

### 7.3 Social (Phase 4)
- Public profile and card link (requires real URLs, hence React Router)
- Friends: follow or request, side-by-side card comparison
- Leaderboards: friends and global, by Overall or by category template (custom categories aren't comparable, so global boards are probably limited to template categories)
- **Privacy:** undecided. **Private by default.** Journals, photos and voice are never public unless an explicit future decision says otherwise. Ratings and cards are shareable only by opt-in.

---

## 8. Architecture

### 8.1 Constraints
- TypeScript end to end.
- **Free hosting** for web, API, DB, storage and cron. LLM API cost is the only accepted spend.
- The LLM provider must be swappable.

### 8.2 Stack

| Layer | Choice | Why |
|---|---|---|
| Monorepo | **npm workspaces** | Shared types and schemas between web and API; nothing extra to install |
| Frontend | **React + Vite + TypeScript** | Same as Habit Tracker, now typed |
| Routing | **React Router** | Real URLs for profiles and shareable cards |
| Server state | **TanStack Query** | Replaces the Helpers + `useEffect` fetch pattern |
| Styling | **Tailwind CSS + shadcn/ui** (Radix-based) | Fast, consistent, themeable for the 2K-menu look |
| Charts | **Recharts** (or visx if more control is needed) | Line, radar, heatmap |
| Animation | **Motion** (Framer Motion) | Stat-bar fills, OVR reveal |
| API framework | **Hono** | TS-native, tiny, runs on Cloudflare Workers **and** Node (portable if hosting changes) |
| Validation | **Zod** (shared package) | Request bodies **and** LLM structured outputs |
| DB | **Neon Postgres** (free tier) + **pgvector** | Same provider as before; vectors for RAG |
| ORM / migrations | **Drizzle** + drizzle-kit migrations | Decided |
| LLM layer | **Vercel AI SDK** (`ai` package) behind our own `llm/` module | Provider-agnostic, Zod structured output, runs on Workers |
| Object storage (Phase 5) | **Cloudflare R2** (free tier) | Photos and voice |
| Hosting: web | **Cloudflare Pages** (or Vercel) | Free |
| Hosting: API | **Cloudflare Workers** (free tier) | Free, with built-in **Cron Triggers** |
| Tests | **Vitest** (+ Testing Library for web) | Unit and integration |
| CI | **GitHub Actions** | Lint, typecheck, test on PR |

**Risk:** the Workers free tier limits CPU time per request. LLM and DB calls are I/O wait and don't count, but heavy JSON or embedding work might. **Fallback:** Hono runs unchanged on Node, so the API can move to a free Node host (Render or Fly.io free tiers, accepting cold starts) and keep GitHub Actions or an external cron for scheduling.

### 8.3 Repo layout
```
/
├── apps/
│   ├── web/                 # React + Vite SPA
│   │   └── src/
│   │       ├── routes/      # React Router route modules
│   │       ├── features/    # onboarding/, ratings/, daylog/, habits/, card/ ...
│   │       ├── components/  # shared UI (shadcn components live in components/ui)
│   │       ├── api/         # typed API client + TanStack Query hooks
│   │       └── styles/
│   └── api/                 # Hono API
│       └── src/
│           ├── routes/      # HTTP layer (validate with shared Zod, call services)
│           ├── services/    # business logic (rating math, recaps, decay, seasons)
│           ├── repos/       # Drizzle queries
│           ├── db/          # Drizzle schema + migrations
│           ├── llm/         # provider-agnostic client, prompts/, schemas, cost tracking
│           ├── jobs/        # cron handlers (auto-recap, decay, weekly review, season rollover)
│           └── index.ts
├── packages/
│   └── shared/              # Zod schemas, TS types, constants (MAX_RATING_DEPTH, caps), rating math
├── docs/
│   └── DESIGN.md            # this file
└── .github/workflows/
```
The layering carries over from Habit Tracker (Routes → Controllers → Services → Repositories), condensed to **routes → services → repos**, since Hono handlers are thin enough to act as controllers.

**Pure logic goes in `packages/shared`** (weighted roll-up, clamp, decay application, ledger summation), so it can be tested without a DB and reused by the web app for previews.

### 8.4 LLM module interface (sketch)
```ts
// apps/api/src/llm/index.ts
type LlmPurpose =
  | 'onboarding.questionnaire' | 'onboarding.followup' | 'onboarding.initialRatings'
  | 'onboarding.suggestAttributes' | 'onboarding.weights'
  | 'recap.daily' | 'recap.weekly' | 'prompts.guided'
  | 'habits.suggestLinks' | 'embed';

generateStructured<T>(opts: {
  purpose: LlmPurpose;
  userId: string;
  schema: ZodType<T>;
  system: string; prompt: string | Message[];
  promptVersion: string;
}): Promise<T>   // picks provider/model from config by purpose, retries, logs to llm_calls

embed(texts: string[], ctx): Promise<number[][]>
```
`config/models.ts` maps each purpose to `{ provider, model }`. Defaults are cheap models, and the weekly review and initial ratings can be upgraded.

### 8.5 Auth (deferred)
- **Decide before any public deploy.** Until then, local and dev use a **dev-user header** or seed user, behind an `env.AUTH_MODE = 'dev'` guard that refuses to start in production.
- Design for it now: all routes read `c.get('userId')` set by an auth middleware, so swapping in real auth means changing one middleware.
- Candidates to evaluate later: Better Auth (self-hosted, users in our DB, works with Drizzle and Hono), Clerk (managed, generous free tier), Supabase Auth.

### 8.6 Scheduled jobs (Cloudflare Cron Triggers)
| Job | Schedule | Does |
|---|---|---|
| `autoRecap` | hourly | For users whose local time just passed 04:00: if yesterday isn't recapped, run the daily recap (or decay only if empty) |
| `weeklyReview` | hourly | For users whose local week just ended and whose last daily recap is done |
| `seasonRollover` | daily | At the quarter boundary, archive the season and prompt season setup |
| `snapshots` | daily | Write per-node daily value snapshots (chart optimization) |

Jobs must be **idempotent**: unique constraints on `(user_id, local_date, kind)` for recaps, plus status columns.

---

## 9. Data Model (initial draft)

Drizzle schema in `apps/api/src/db/schema.ts`. All tables have `id uuid pk`, `created_at` and `updated_at` unless noted.

| Table | Key columns | Notes |
|---|---|---|
| `users` | `email`, `username`, `display_name`, `timezone` (IANA), `week_start`, `auth_subject` (nullable, for the future auth provider) | **Never return the full row from the API** (see §11) |
| `seasons` | `user_id`, `label` (e.g. `2026-Q4`), `starts_on`, `ends_on`, `status` (`setup`/`active`/`archived`) | |
| `rating_nodes` | `season_id`, `user_id`, `parent_id` (null for Overall), `name`, `description`, `depth` (0–3), `weight`, `sort_order`, `template_key` (nullable), `lineage_id` | `lineage_id` links "the same" node across seasons for long-term charts |
| `rating_events` | `node_id` (leaf), `season_id`, `delta` numeric(6,2), `source` (`onboarding`/`daily_recap`/`weekly_review`/`decay`/`recalibration`), `recap_id` (nullable), `reason`, `evidence` (jsonb), `voided_at` (nullable) | Append-only ledger; re-runs set `voided_at` |
| `node_values` | `node_id` pk, `value` numeric(5,2) | Cache of current leaf and parent values |
| `node_snapshots` | `node_id`, `date`, `value` | Daily, for charts |
| `decay_rules` | `node_id`, `grace_days`, `per_day`, `floor`, `notes`, `version`, `active`, `authored_by` (`llm`/`user`) | |
| `pauses` | `user_id`, `starts_on`, `ends_on`, `reason` | |
| `onboarding_sessions` | `user_id`, `season_id`, `stage`, `questionnaire` jsonb, `answers` jsonb, `chat` jsonb, `result` jsonb | Resumable |
| `day_logs` | `user_id`, `local_date`, `journal` text, `status` (`open`/`submitted`/`recapped`) | Unique `(user_id, local_date)` |
| `guided_prompts` | `day_log_id`, `question`, `answer` | |
| `habits` | `user_id`, `name`, `type` (8 types), `config` jsonb (target, slider min/max, colors…), `recurrence_interval`, `recurrence_days`, `archived` | Ported from Habit Tracker, with the type-specific columns folded into `config` |
| `habit_links` | `habit_id`, `node_lineage_id`, `status` (`suggested`/`confirmed`/`rejected`) | Linked by lineage so links survive seasons |
| `habit_entries` | `habit_id`, `local_date`, `value_num`, `value_text` | |
| `recaps` | `user_id`, `kind` (`daily`/`weekly`/`onboarding`/`recalibration`), `period_start`, `period_end`, `narrative`, `output` jsonb, `prompt_version`, `model`, `status`, `superseded_by` | |
| `goals` | `node_id`, `target_value` | User half of Potential |
| `projections` | `node_id`, `recap_id`, `projected_value` | LLM half of Potential |
| `focus_goals` / `habit_proposals` | from weekly reviews | Phase 2–3 |
| `embeddings` | `user_id`, `source_type`, `source_id`, `content`, `embedding vector(n)` | pgvector |
| `llm_calls` | `user_id`, `purpose`, `provider`, `model`, `prompt_version`, `input_tokens`, `output_tokens`, `cost_usd`, `latency_ms`, `error` | **From day one** |
| `badges` / `user_badges` | catalog and awards (personal badges have `user_id` set on the catalog row) | Phase 3 |
| `settings` | per-user UI prefs | Carried over pattern |

---

## 10. UI / UX Direction
- **2K-style menu UI**: dark background, bold condensed sporty type, neon accent colors per category, animated stat bars that count up, card-reveal moments.
- **Color by value** (2K convention): for example, red under 60, orange 60–69, yellow-green 70–79, green 80–89, and a special color at 90+. Define thresholds as tokens.
- **Key screens:**
  - **MVP:** Landing → Build your tree (templates + custom) → Weights → Questionnaire → Follow-up chat → **OVR Reveal** → Ratings view (tree with bars and rationale).
  - **Phase 2:** Today (journal, habits, guided prompts, "End my day") → Recap view (narrative + itemized changes) → Weekly review → Change feed → Pause and backfill controls.
  - **Phase 3:** Player card, charts, badges, goals and potential, season setup and archive.
  - **Phase 4:** Profile, friends, compare, leaderboards.
- Responsive from the start (web first, mobile later). Consider making it an installable **PWA** before going native.
- Light mode is optional. The 2K look is dark-first.

---

## 11. Lessons from Habit Tracker (do / don't carry over)

**Carry over:**
- Layered backend (routes → services → repos) with Zod validation in services.
- The 8 habit types and their UI components (port to TS + Tailwind).
- The recurrence model (`interval` + `days`) and the streak logic (`StreakHelper.findStreaks`).
- Per-user settings, with defaults created on first login.
- Additive, backward-compatible migrations (now managed by drizzle-kit).

**Fix this time:**
- **No auth tokens or sessions.** Login just returned the user object. Real auth is required before launch (§8.5).
- **`GET /users` returned every user's full row, password hash included** (`SELECT * FROM users`). Never select or return secrets. Use explicit column selection and response DTOs.
- **Login crashes on an unknown user**: `bcrypt.compare` ran on `user.password` before the `!user` check.
- **No authorization checks**: any client could read or edit any user's habits by id. Every query must scope by the authenticated `userId`.
- CORS origins and port are hard-coded. Move them to env config.
- No tests, no CI, no types.
- Global state in `App.jsx` plus manual fetch helpers. Replace with routes and TanStack Query.

---

## 12. Roadmap

### Phase 0: Foundations
- [x] npm-workspaces monorepo: `apps/web`, `apps/api`, `packages/shared`; TS strict; ESLint + Prettier
- [x] Vitest in all packages; GitHub Actions running lint, format check, typecheck, test and web build
- [x] Drizzle schema + migrations (Neon in dev/prod, in-memory PGlite in tests). pgvector moves to Phase 2 with RAG.
- [x] Hono API skeleton with env config, error handling, the `userId` middleware (dev auth mode) and health route
- [x] LLM module: provider-agnostic client, per-purpose model config, Zod structured output, retries, `llm_calls` logging
- [x] Web skeleton: Vite + React Router + TanStack Query + Tailwind; dark 2K theme tokens (shadcn added when the first complex component needs it)
- [ ] Deploy pipeline: Pages + Workers (free), preview deploys (needs a Neon project + Cloudflare account)

### Phase 1: MVP: Categories + Onboarding → Initial Ratings
- [x] Category templates (data in `packages/shared`) and the custom tree builder (depth ≤ 3)
- [x] LLM attribute suggestions (optional helper)
- [x] Weights: LLM proposal plus user adjustment (1–10 importance per sibling, shown as % share)
- [x] LLM questionnaire generation, form rendering by question type, resumable answers
- [x] Follow-up chat (bounded to 5 questions, skippable)
- [x] Initial ratings, decay rules and archetype from the LLM, written as `onboarding` rating events
- [x] Rating roll-up math (shared, unit-tested)
- [x] OVR reveal and basic ratings tree view with rationales
- [x] First season created (current quarter, in the user's timezone)
- [x] Calibration rubric and fixture-based sanity tests for prompt output parsing
- [ ] **Auth decision made before any public deploy**

### Phase 2: The Core Loop
- [x] Day log: journal, habits (8 types, weekday schedules), backfill window (3 days)
- [ ] Guided prompts, "End my day"
- [x] Habit → attribute link suggestions (LLM) with confirmation (links stored by node lineage)
- [ ] Daily recap (manual and auto at 04:00 local), itemized changes plus narrative
- [ ] Ledger re-run on past-day edits
- [ ] Decay engine (hybrid), pause mode
- [ ] Weekly review: narrative, corrections, decay revisions, focus goals, habit proposals, projection, profile summary
- [ ] RAG: embeddings pipeline and retrieval
- [ ] Change feed
- [ ] Guardrail caps and skepticism prompting

### Phase 3: Game Layer
- [ ] Player card and image export
- [ ] Charts: history lines, radar, heatmap
- [ ] Archetype updates, hot/cold indicators
- [ ] Goals and potential (user goals plus LLM projection)
- [ ] Badges: catalog and rule engine, plus LLM personal badges
- [ ] Seasons: quarterly rollover, archive card, season setup with structure edits and recalibration

### Phase 4: Social
- [ ] Privacy model decision
- [ ] Public profile and card links
- [ ] Friends and compare
- [ ] Leaderboards (friends, plus global on template categories)
- [ ] Anti-gaming hardening

### Phase 5: Rich Inputs, Mobile & Monetization
- [ ] Photos (R2 + vision model), voice notes (transcription)
- [ ] PWA, then native mobile (likely React Native / Expo, sharing `packages/shared`)
- [ ] Monetization model; per-user quotas and plan-based model tiers
- [ ] Integrations (Strava, Health, etc.), if pursued

---

## 13. Open Questions
1. **Auth provider** (Better Auth vs Clerk vs other). Needed before public deploy.
2. **Name and brand.**
3. **Sanity caps vs "LLM fully decides":** are wide caps (e.g. ±3/day, ±5/week per leaf) acceptable as anti-abuse rails?
4. **Rating disputes:** can a user contest an initial rating or a recap change? If so, how (ask the LLM to reconsider with more info, rate-limited)?
5. **Mid-season renames:** allow typo fixes and description edits without unlocking structure?
6. **Backfill window length** (suggested 3 days).
7. **Questionnaire length cap** (suggested ≤ 40 questions / ~10 min).
8. **Mid-quarter onboarding:** short first season or extended?
9. **Display precision:** OVR shown as an integer or with one decimal?
10. **Decay rule visibility and editability** for users.
11. **Privacy model** for social features.
12. **Monetization model** (freemium, subscription, BYO key…) and quota design.
13. **Global leaderboard comparability** across custom trees.
14. **Data export and account deletion** (should be in place before launch).
15. **Content safety:** journals may contain sensitive topics (mental health, etc.). Define how the LLM responds to distressing content, what data goes to providers, and the provider data-retention settings.
