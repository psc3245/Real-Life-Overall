# Real Life Overall: Design & Development Guide

> **Working title.** The brand name is undecided; "Real Life Overall" / "OVR" are placeholders.
> **Status:** In development: Phases 0–4 built, web refinements done, iOS app started. This document is the source of truth for scope, architecture and decisions. Update it when a decision changes.
> **Last updated:** 2026-10-26

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
| Category edits | **Mostly at season start.** Mid-season the tree changes only through weekly-review proposals the user accepts (at most one every 4 weeks), decided 2026-10-26 (§4.5). |
| Weight evolution | **Automatic, small steps** with an undo history: weekly reviews shift weights toward what the Scouting Report says matters (decided 2026-10-26, §4.5). |
| Inputs (eventual) | Free-text daily journal, habit check-ins, LLM-guided prompts, photos and voice notes. |
| Update cadence | **Daily recap + weekly review.** |
| LLM authority | **LLM fully decides** deltas. Code enforces only hard invariants and wide anti-abuse rails (§5.6). |
| Explainability | **Both**: a narrative recap plus itemized per-change reasons. |
| Decay | **Hybrid**: the LLM authors per-attribute decay rules, code applies them, and the LLM revises them in weekly reviews. |
| Missed days | **All of:** decay applies by default, a backfill window exists, and a pause (vacation/injury) mode exists. |
| Editing a past day after its recap | **Re-run that day's recap.** |
| Onboarding | **Structured form, then a chat follow-up** with the LLM, then initial ratings. |
| Recalibration | **Season reset** each **calendar quarter**. |
| Season mode | **Rating or Growth, picked at the start of each season** (decided 2026-10-26, §4.6). Growth ("Most Improved") scores points gained this season: gains only, weekly corrections take back over-credit, decay never subtracts, rolled up by weight. The rating keeps running underneath, revealable only by its owner. Separate boards per mode; the mode locks after setup. |
| Potential | **Both**: user-set goal ratings plus an LLM-projected end-of-season rating. |
| Badges | **Hybrid**: a core catalog with a deterministic rule engine, plus LLM-generated personal badges. |
| Archetype | LLM-assigned build name (e.g. "Two-Way Scholar-Athlete"). |
| Coaching | **Weekly focus goals and habit proposals** (the user accepts proposals), plus an on-demand **coach chat** that suggests habits, goals and Scouting Report lines added with one tap (decided 2026-10-26, §5.9). |
| LLM persona | **Neutral**, informative tone. |
| Habit ↔ attribute links | **LLM suggests, user confirms.** |
| Habit input types | All 8 from Habit Tracker: checkbox, checknote, counter, duration, slider, rating, shorttext, journal. |
| LLM memory | **Full-history retrieval (RAG)**. |
| Day boundary | **User's timezone.** The recap runs on "End my day", otherwise automatically the next morning. |
| Social (eventual) | Public card sharing, friends and compare, leaderboards. |
| Privacy | **Private by default, opt-in sharing** (decided 2026-10-22, §7.3): per-player visibility (private / friends / public) for the card only; journals, recaps, attributes, rationales and personal badges are never shared. |
| Anti-gaming | **LLM skepticism plus caps.** Accept some cheating. |
| Visual direction | **Video-game menu (2K-like)**: dark, bold, sporty, neon accents, animated stat bars. |
| Visualizations | Rating history line charts, radar chart, daily change feed, calendar heatmap. |
| Platform | **Web first, then iOS** (Expo / React Native). No Android (decided 2026-10-23). |
| Language | **TypeScript everywhere.** |
| Hosting | **Must be free to host** (LLM API spend aside). |
| Repo layout | **Monorepo** (this repo). |
| ORM | **Drizzle.** |
| Auth | **Better Auth** (email + password, Google), decided 2026-10-22 (§8.5). |
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
| **Potential** | The user's goal rating plus the LLM's projected end-of-season rating (in a growth season: a growth target and projected season growth). |
| **Season mode** | How a season is scored: **rating** (the 0-100 OVR) or **growth** ("Most Improved": points gained this season, §4.6). |
| **Growth** | The points a leaf gained this season (recap gains plus weekly corrections, never below 0), rolled up by weight like ratings. |
| **Scouting Report** | The structured picture of what the player wants out of life (aspirations, priorities, focuses, constraints) that the tree is tuned against (§5.8). Not to be confused with the onboarding "scouting" questionnaire. |

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
- **The structure is mostly locked during a season.** Renames and free-form edits only happen during season setup (first onboarding or a new season). Mid-season, weekly reviews may propose adding or removing a category or attribute, which applies only if the user accepts it (§4.5). *Open question: are typo-only renames allowed mid-season? (§13)*

### 4.2 Values
- Scale is **0–100**, stored as `numeric(5,2)`. Display rules:
  - Detail views show one decimal (`74.3`).
  - The player card shows the rounded integer for the big OVR and one decimal elsewhere. *(Confirm in UI design.)*
- **A leaf's value is derived from its event ledger**: `value = clamp(0, 100, Σ deltas)`, where the onboarding event sets the initial value. A cached current value is kept for reads.
- **A parent's value** is the weighted mean of its non-archived children. It's computed on read or on cache refresh, never stored as a source of truth.

### 4.3 Weights
- During onboarding the LLM proposes weights per sibling group, based on the questionnaire and the user's stated priorities. The user adjusts them with sliders.
- Weights are normalized within each sibling group, so they don't need to sum to 1 in storage.
- Weights start the season where the user set them, then evolve in small automatic steps from weekly reviews (§4.5).

### 4.4 Why a ledger (event-sourced ratings)
- **Explainability**: every change has a reason row, which feeds the change feed directly.
- **Re-running a past day's recap** becomes simple: void that recap's events, run it again, and insert new events. Later events are untouched deltas, so current values just get re-summed.
  - *Known caveat:* later recaps were written when the value was different, so re-runs can drift slightly from what the LLM "would have" done. That's acceptable.
- **Charts**: history comes from cumulative sums. Nightly snapshots exist only as a read optimization.
- **Seasons**: each season starts with a recalibration event per leaf.

### 4.5 The tree evolves with the player (added 2026-10-26)
The tree should measure what the player actually cares about, weighted the way they care about it. The yardstick is the **Scouting Report** (§5.8); the evidence is weeks of behavior: what they write about, the habits and goals they keep, where daily recaps find gains ("days with gains in the last 4 weeks" per attribute goes into the prompt). A low rating in something they care about is a gap, not a reason to shrink it.
- **Weights shift automatically**, in small steps. Each weekly review may change up to 3 weights (`MAX_WEIGHT_SHIFTS`), each by at most ±15% of its current value (`WEIGHT_SHIFT_CAP`), and a weight stays within half to double its season-start value (`WEIGHT_DRIFT`). Every shift is a `weight_changes` row (from/to weight and share of parent, reason, review). The player can **undo** any shift this season: the weight is scaled back by the same factor, so later shifts still hold.
- **Tree changes are proposals**, rare by design: at most one every 28 days (`TREE_PROPOSAL_COOLDOWN_DAYS`), none while one is pending, none in a season's last 14 days (season setup covers those). A proposal has 1-3 changes: add a category (with 1-4 attributes), add an attribute to a category that already has attributes, or remove a category or attribute (a category keeps at least one attribute and Overall keeps a category; renames and reshuffles are never proposed). Accepting inserts the nodes (weight = siblings' average), archives removed nodes and their descendants, and rates the new attributes with `season.newLeaves`; if that call fails, accepting again retries it. Dismissing just records it. Pending proposals from an earlier season show as expired.
- New attributes start their decay clock on the day they're rated (`computeDecay`'s `startedOn`), not at the season's start.
- Changing weights mid-season changes how history rolls up: charts replay the ledger with current weights, so a category's past Overall contribution is re-weighted too. Accepted as a trade-off.
- The `adaptiveRating` configuration switch (on by default) turns both off; the review is then told not to shift weights or propose changes.
- Screens: `/scouting-report` (the report, "Rating shape": share now vs season start per node, weight shifts with undo, tree proposals), plus weight shifts and the proposal on the weekly review card. Routes: `/scouting-report` (GET, PUT), `/weights` (GET, `POST /weights/changes/:id/undo`), `/tree-proposals` (GET, `POST /tree-proposals/:id/accept|dismiss`).

### 4.6 Season modes: Rating and Growth (added 2026-10-26)
- Each season has a **mode** (`seasons.mode`): **rating** (default, everything above) or **growth**, named "Most Improved" (sports talk: Growth / Most Improved / MIP race). Picked before the reveal in onboarding (`PUT /onboarding/mode`, until onboarding completes) and in season setup (`PUT /seasons/setup/mode`, during the 14-day setup window). Rollover carries the mode into the next season. Switching clears goals, since they're in the other mode's units.
- **Growth is derived from the same ledger** (`packages/shared/src/rating/growth.ts`), so nothing extra is stored and either mode can be computed for any season. Per event: daily recap gains count, daily setbacks count 0, weekly-review corrections count both ways (so over-credited recaps are taken back), decay, onboarding and recalibration count 0. A leaf's growth is the sum, floored at 0; every rated leaf starts at 0, and parents roll up by the same weighted mean as ratings (bigger trees don't score higher).
- **What switches in a growth season:** `RatedNodeDto.value`, trends, goals and projections are growth; `rating` carries the rating underneath. History, charts (`rating:<id>` metrics, unit "gained"), the heatmap, recap and weekly before/after, season detail and archived season cards (`finalSnapshot` keeps both) all use growth. Change feeds show the counted part of each change ("±0" for decay and setbacks).
- **The rating is private to its owner.** The owner can show it with a "Show rating" toggle (remembered per browser) on the ratings and attribute pages, and peek at it on the reveal. Other players never receive it: `player_cards` stores both numbers (`overall`, `growth`, per-category `value` and `growth`) and the card DTO picks by mode, and growth players' rating-level catalog badges (Well-Rounded, Elite) are left off their public profile.
- **Leaderboards** (`?mode=rating|growth`, default your own mode) rank only the players in that mode this season; the page has a Rating / Growth switch and says which board you're on. Compare shows ratings when both players are in rating mode, otherwise growth for both (every card carries growth).
- **The model:** voiced calls for a growth player get a growth note (`GROWTH_MODE`, prompt version `+growth`): talk about gains, don't quote ratings, keep deltas honest. Weekly reviews also see the growth tree and project season growth; projections store their mode so old rating projections don't show as growth.
- Rating-only parts stay as they are: decay rules, archetypes, the rails (§5.6), badges' rule engine and the Scouting Report.
- iOS doesn't know about modes yet: in a growth season it shows growth numbers as if they were ratings.

---

## 5. The LLM Engine

All LLM work lives behind one internal module, `apps/api/src/llm/`, with a **provider-agnostic interface** (§8.4). Every call:
- uses **structured output validated by Zod** (shared schemas) and retries on validation failure (max 2), then fails visibly;
- is **logged to `llm_calls`** with purpose, provider, model, tokens, estimated cost, latency and error;
- uses a **cheap model by default**. Which model each purpose uses is config, not code.
- uses a **neutral tone** for every user-facing text.

### 5.1 Onboarding: discover, draft, scout, clarify, rate
0. **Discover** (added 2026-10-22). A short chat (one question at a time, up to 8) about the user's goals, what matters in their life, what they want to improve, and their routines. After at least 2 answers the user can ask the scout to **draft a template**: categories (3-7), attributes (2-5 each, sub-attributes only where warranted) and weights, preferring starter templates where they fit, plus a rationale and a priorities summary that feeds every later step. "Skip, I'll build it myself" goes straight to the manual builder.
1. **Build the tree.** The user edits the drafted tree (or builds one from templates and custom categories): rename, add sub-attributes (≤ depth 3), describe nodes, remove anything. Optionally the LLM suggests missing attributes for a category.
2. **Weights.** Prefilled from the template; the user adjusts them (or asks the LLM to re-propose from typed priorities).
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

### 5.5 Memory: full-history retrieval
- **Decision (Phase 2):** Postgres **full-text search** instead of embeddings, to avoid adding an embeddings provider (Anthropic has none). Journals and daily recap narratives have generated `tsvector` columns with GIN indexes.
- **Retrieval:** the day's (or week's) text becomes an OR query of its most distinctive words; older days are ranked by `ts_rank` and the top 5 go into the prompt as "Related older days". Recent days (the last week) are already included in full.
- **Rolling profile summary:** a compact LLM-maintained text about goals, context and recurring patterns (`users.profile_summary`), rewritten by each weekly review and **always included** in daily and weekly prompts.
- **Upgrade path:** embeddings (Voyage, Gemini or Workers AI) with pgvector can replace `searchMemories` behind the same interface if keyword matching proves too literal.

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

### 5.8 The Scouting Report (added 2026-10-26)
A structured picture of what the player wants out of life, stored as `users.scouting_report` (jsonb, read through `parseScoutingReport`, which drops anything malformed):
- **aspirations** (up to 6): what they want out of life, in their words;
- **priorities** (up to 10): life areas with importance 1-5, each mapped to the rating node that measures it (by **lineage**, so it survives seasons) or to nothing ("Not in your tree", the main signal for adding a category);
- **focuses** (up to 5) and **constraints** (up to 5: schedule, injuries, caregiving).
The weekly review rewrites it each week alongside the profile summary. When the player edited it last (`updatedBy: "user"`), the review keeps their entries and only adds. It feeds weight shifts and tree proposals (§4.5) and the coach chat (§5.9), which can add lines to it.


### 5.9 The coach chat (added 2026-10-26)
- One continuing conversation per player (`coach_messages`: role, content, `suggestions` jsonb), on `/coach` and through an "Ask the coach" card on Today (which opens the chat with `?ask=`). "Clear chat" deletes it all.
- **Context** (rebuilt every turn, in the system prompt): today's date, the profile summary, the Scouting Report, the rating tree with values, habits with the last two weeks' adherence, running goals with pace, the weekly focus, and the last week's recap narratives. The last 20 messages go along as the conversation. Purpose `coach.chat`, fast tier.
- **Suggestions** (0-3 per reply), shown as cards under the reply: a **habit** (type, days, target, linked attributes; never a duplicate name), a **goal** (target, unit, days to the deadline; starts the day it's added) or a **Scouting Report line** (aspiration, priority with importance and node, focus, constraint). Accepting creates the habit or goal or edits the report (as the player's edit); each card records accepted or dismissed. Kinds for switched-off features are not suggested.
- **Limits:** 1,000 characters per message, 30 player messages per rolling 24 hours (429 after). Nothing is stored when the model call fails; the web puts the text back in the box.
- **Boundaries** in the prompt: not a doctor, therapist, dietitian or financial advisor; never judges body weight; for crisis or risk of harm it responds with care, points to people they trust, emergency services or a crisis line, and makes no suggestions.
- The `coach` configuration switch hides the page, nav link and Today card. iOS doesn't have the coach yet.

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
- Friends: **mutual requests** (send by exact username or from a profile; befriending someone who already asked accepts). Limits: 20 pending sent requests, 200 friends. Side-by-side **compare** lines up template categories by template key (even when renamed) and custom ones by name. Usernames are discoverable by exact match through requests; cards are not.
- **Leaderboards** (`/leaderboards`), per season and per mode (rating and growth boards are separate, §4.6), by Overall or by **template category** (custom categories don't compare; a renamed template category still counts under its template):
  - **Friends**: you plus friends whose visibility is `friends` or `public`. Provisional players are included and marked.
  - **Global**: players who are `public` **and** opted in (`users.leaderboard_opt_in`), and whose card passes the evidence rules below. Top 50 shown, plus your own row.
- **Anti-gaming hardening** (ratings are self-reported, so boards lean on evidence, not trust):
  - **Evidence floor:** global boards need at least **7 recapped days** this season (`LEADERBOARD_MIN_RECAPPED_DAYS`). Until then cards and friends-board rows show **Provisional**. Onboarding ratings alone never reach a global board.
  - **Skepticism carries through:** the daily recap's `flags` (implausible or ambiguous claims) are counted per season (`player_cards.flagged_days`, owner-only). Players with **≥ 5 flagged days and over half of their recapped days flagged** sit out global boards until that changes; the leaderboard page tells them why.
  - Existing rails still apply: ±3 per attribute per day, ±5 weekly corrections, 3 recap runs per day, a 3-day backfill window.
  - Social limits: 20 pending sent requests, 200 friends; reserved usernames; hidden profiles answer 404.
  - *Later:* report a player, username change cooldown, and moving ranking into SQL once boards grow (ranking is in memory today).
- **Privacy model** (decided 2026-10-22):
  - Each player picks a **visibility**: `private` (default: nobody else), `friends` (accepted friends) or `public` (anyone with the link, signed in or not).
  - Visibility covers the **card only**: Overall, archetype, season label, **category** values, recapped-day count and the highest tier of each **catalog** badge.
  - **Never shared:** journals, guided answers, recaps and narratives, the model's rationales, **attribute names and values** (they can be personal, e.g. "Sobriety"), personal badges (written by the LLM from journals), goals and projections. Photos and voice (Phase 5) follow the same rule.
  - Hidden profiles answer 404, the same as missing ones, so settings don't reveal who has an account.
  - Usernames appear in links (`/u/:username`). They start as the email's local part, so the settings page lets players change them (3-24 lowercase characters; reserved words blocked).
  - Shared cards read a per-player cache (`player_cards`) refreshed when the owner's ratings are read and by the hourly job, so other players never replay someone's ledger.

### 7.4 Goals with a deadline (added 2026-10-25)
- A **goal** is a target total to reach by a deadline: "Run 100 miles before New Year's", "Gym 3 times this week". Called **objectives** in code and tables so they don't clash with goal *ratings* (Potential, the `goals` table).
- **Short vs long term** is derived from the window: up to 31 days is short term (`SHORT_TERM_MAX_DAYS`), longer is long term. Windows can span up to 3 years.
- **Progress sources:** `manual` (the day log has a field per running goal; each day stores what it added) or `habit` (the goal counts a habit's entries inside its window: amounts for counts and time, otherwise done days; groups can't be counted, their sub-habits can).
- **Status** is computed, never stored: upcoming, active, completed (the day the running total reached the target is kept) or missed. **Pace** compares the total with an even pace through the days already behind (today is still in play), shown as a tick on the progress bar.
- Goals link to attributes like habits (by lineage). Daily recaps see every goal running that day, its total, what the day added, and whether the target was reached that day; a manual goal entry alone counts as logging the day.
- **Progress sources:** also `workouts` (each finished workout inside the window counts as one).
- Screens: `/goals` (short term, long term, finished), a Goals section in the day log, and a Goals card on Today.

### 7.5 Workouts and body tracking (added 2026-10-25)
- **Model:** set-by-set logging after the Strong app. A workout holds exercises; an exercise holds sets; sets are checked off as they're done. Workouts are stored as one jsonb document (`workouts.exercises`) that the live page autosaves; personal records, "previous" sets and exercise history are computed by replaying the user's finished workouts in memory (fine at personal scale; move to SQL if it ever isn't).
- **Generic for lifting and sport.** Each exercise has a **tracking kind**: weight × reps, reps (bodyweight), time, distance + time, or makes / attempts (free throws, penalty kicks, serves). Sets are tagged normal, warm-up, drop or failure. The built-in library (~85 exercises across strength, cardio, sport & skill and mobility) lives in `packages/shared` with slug ids; custom exercises are rows in `exercises` with uuid ids, and archived ones keep resolving for old workouts.
- **Units:** stored metric (kg, m, s, cm); `users.unit_system` (`imperial` default, or `metric`) picks what's shown.
- **Live workout** (`/workouts/active`): one in progress at a time (partial unique index). Elapsed timer, set table (Set · Previous · values · ✓), tapping a "Previous" cell copies it, checking a set with empty fields fills them from last time and starts a rest timer (length remembered per browser). Finishing drops unchecked sets and empty exercises; the workout counts for the local date it started.
- **Templates:** unlimited (Strong's free tier caps at 3; we don't). Start from one (sets prefilled, unchecked), update it from a finished workout, or save any finished workout as a new one.
- **Records** per exercise: heaviest weight, best estimated 1RM (Epley), best set volume, most reps, longest time and distance, best make percentage (5+ attempts). A workout lists the records it broke; a first-ever session sets none.
- **Body tracking:** opt-in per measure (`users.track_weight`, `users.track_height`). One value per kind per day in `body_measurements`; the day log shows the fields when tracked, `/body` shows latest values, 30-day change, BMI (with both) and a weight chart. Never shared on cards.
- **Ratings:** daily recaps see the day's workouts (exercises, sets, best set, records) as concrete fitness and sport evidence, and logged weight and height as context only (the prompt forbids judging body weight). A finished workout alone counts as logging the day; editing or deleting one marks its day stale.
- Screens: `/workouts` (start, templates), `/workouts/active`, `/workouts/history`, `/workouts/:id`, `/workouts/templates/:id`, `/workouts/exercises(/:id)`, `/body`; Workouts and Body sections in the day log; units and tracking in settings.

### 7.6 Avoid habits (added 2026-10-25)
- Every habit type except groups can be **build** (do it) or **avoid** (don't). The direction lives in `habits.config.direction` (missing = build), is chosen at creation and fixed afterwards like the type, since it changes what past entries mean.
- **Kept vs slipped:** an avoid habit is kept on a day unless its entry crosses the line: checkbox/checknote marked "Slipped" (an explicit "Avoided" is stored as 0), counter or duration over the daily limit (which may be 0), slider or stars above the chosen line, or any text written on a short-answer/journal avoid habit (those log slips). **A day with no entry counts as kept**, so streaks run until a slip.
- Stats count kept days as done and add a slip count. Goals that count an avoid habit count kept days, logged or not ("30 days smoke-free"). Decay, badges and weekly summaries only see logged entries, so unreported days aren't evidence.
- Recaps read avoid habits as avoided / kept / slipped with the limit; "no slip logged" is weak evidence the model is told to credit lightly.

### 7.7 Charts for everything (added 2026-10-25)
- **Metrics:** every number the app tracks has a stable id: `rating:<nodeId>`, `habit:<habitId>`, `habits:done`, `goal:<objectiveId>`, `workouts:count|volume|duration|sets`, `exercise:<exerciseId>`, `body:weight|height`, `journal:words`. `GET /metrics` lists what this user can chart; `GET /metrics/series?ids=…&from=&to=` returns daily points in the user's units. Rating history stays within the current season (it replays the ledger per day).
- **Kinds** decide aggregation: *level* (keeps its value: ratings, weight, a goal's running total; weekly/monthly keep the last), *amount* (per-day quantity, dense with 0 on quiet days; buckets sum), *session* (sporadic bests like an exercise's estimated 1RM; buckets keep the best).
- **Explorer** (`/charts`): up to 6 metrics at once, one scale per unit, range (30 days to all time), daily/weekly/monthly buckets, line/area/bar, target lines, and modeling: a 7-point moving average, a least-squares trend projected forward (with r²), per-series stats, and the correlation between the first two series. The config lives in the URL, so every habit, goal, attribute, exercise, workout history and body page links straight to its chart.
- **Saved charts** (`chart_views`, `/chart-views`): name, config, and `pinned`; pinned charts show on Today.

### 7.8 Reports (added 2026-10-25)
- A **report** is a named set of charts (each: metrics, bucket, style, average/trend, optional title) plus a default period (last 7/30/90 days, this season, last year). Charts can be picked fresh or copied from saved charts.
- **Running** a report picks a period (a preset or custom dates) and stores a **run**: a snapshot of every chart's data and stats, so earlier runs keep showing what they showed and can be compared. Runs are listed per report; any can be reopened, printed (browser print / PDF) or deleted.
- **Checkboxes** (per report, overridable per run): *Summaries* (one plain sentence per series from its stats, no AI), *Write-up* (an AI narrative of the period) and *Suggestions* (up to 5 AI next steps). Write-up and suggestions share one `reports.analysis` call (smart tier) that sees each chart's stats and summaries plus the profile summary; it never judges body measurements. Runs that use AI are capped at 10 per user per rolling day. If the AI call fails, the run is still saved with its charts and summaries and an `aiError`.
- Tables: `reports` (definition) and `report_runs` (`from`, `to`, `used_ai`, `result` jsonb). Routes under `/reports` (`/reports/:id/run`, `/reports/:id/runs`, `/reports/runs/:runId`).

### 7.9 Personalization and configuration (added 2026-10-25)
- **One document per player:** `users.preferences` (jsonb, default `{}`), read through `parsePreferences` in `packages/shared`, which fills every missing or invalid field with its default, so removed options never break old documents and new ones arrive with defaults. `PATCH /me` takes `preferences` with any top-level keys; each replaces the stored key whole (a shallow `||` merge), so `features` and `today` are always sent complete. Stored server-side so the look follows the player to every device; the web caches the last copy in localStorage to style the page before `/me` loads.
- **Personalization (look):** theme (Court, Midnight, Carbon, OLED black, Turf, and light Daylight and Paper), accent (9 presets with a bright dark-mode and a deeper light-mode value, or any custom color), headline font (7) and body font (6), text size, density, corner roundness, background (glow, grid, plain), animations (full, match system, off), all-caps type, color-blind-safe rating colors, page width, a pinned menu bar, the API status dot, and the page the app opens on. The web applies these as CSS variables on `<html>` (`lib/appearance.ts`): every Tailwind color, font, radius and spacing token resolves through a variable, so components don't change.
- **Configuration (parts of the app):** habits, goals, workouts, journal, guided questions, week, friends, leaderboards, charts, reports, history and the focus card can each be switched off. Off hides the menu link, Today widget and day-log section, and the page shows a "switched off" note with a button to turn it back on. Nothing is deleted and recaps are unchanged. Ratings, Today and the day log are always on.
- **Today page:** widgets (missed recaps, habits, rating, goals, journal, training, pinned charts, focus, recap) can be shown or hidden, reordered, and set half or full width; one- or two-column layout, a greeting by name, the Log button, hiding finished habits, and how many goals and rating movers show.
- Screens: a **Personalize** modal (tabs: Look, Today page, Configuration) opened from your own profile page and from `/settings`. Any page can open it with `?prefs=look|today|configuration` (Today's Customize link, the switched-off pages). The iOS app doesn't read preferences yet.


### 7.10 Sports talk (added 2026-10-26)
- One setting, `preferences.sportsTalk`: **none**, **normal** (default, the app as designed) or **extra**. It sits on the Personalize modal's Look tab.
- **The app's words:** `TALK` in `packages/shared/src/talk.ts` holds the terms that change (the scout, Scouting Report, Coach, OVR, player card, archetype, nav labels, weekly review, End my day, onboarding's scouting step and reveal); the web reads them with `useTalk()`. None turns them plain (the AI, Life priorities, Assistant, Overall, Workouts, Rankings, Questions); extra turns them up (Game day, Film room, Practice, Standings, Film session, Final whistle, Combine, Draft night, Undrafted). Routes, ids and data never change.
- **The model's words:** the LLM client appends a voice section (`llm/prompts/voice.ts`) to every call that writes text the player reads (onboarding chat, questions and rationales, daily recaps, weekly reviews, new-attribute ratings, report write-ups, the coach), read from the player's preference per call; the logged prompt version gets `+talk-<level>`. Calls that only produce names, weights or links (attribute suggestions, weights, habit links) aren't voiced, so attribute names never pick up slang. Every level keeps numbers exact, never renames the player's nodes, and drops the playful framing for health, grief, mental health, money or distress. None also makes archetypes plain profile labels; extra makes them bold 2K builds.
- Past text (recaps, archetype names) keeps the voice it was written in. iOS doesn't read the setting yet.

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
| Styling | **Tailwind CSS** with theme tokens; small in-house components (no component library yet) | Fast, consistent, themeable for the 2K-menu look |
| Charts | **Recharts** (or visx if more control is needed) | Line, radar, heatmap |
| Animation | **CSS** transitions and keyframes (Motion if it's ever needed) | Stat-bar fills, OVR reveal |
| API framework | **Hono** | TS-native, tiny, runs on Cloudflare Workers **and** Node (portable if hosting changes) |
| Validation | **Zod** (shared package) | Request bodies **and** LLM structured outputs |
| DB | **Neon Postgres** (free tier) | Same provider as before; full-text search for memory |
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
│   │       ├── router.tsx   # React Router routes
│   │       ├── routes/      # layout, home and 404
│   │       ├── features/    # pages by area: today/, habits/, goals/, workouts/, body/, week/, ratings/, social/ ...
│   │       ├── components/  # shared UI (cards, stat bars, charts, modal, section nav, form styles)
│   │       ├── lib/         # formatting helpers
│   │       ├── api/         # typed API client + TanStack Query hooks
│   │       └── styles/
│   ├── mobile/              # iOS app: Expo + Expo Router (src/app routes, src/api, src/components)
│   └── api/                 # Hono API
│       └── src/
│           ├── routes/      # HTTP layer (validate with shared Zod, call services)
│           ├── services/    # business logic (rating math, recaps, decay, seasons)
│           ├── repos/       # Drizzle queries
│           ├── db/          # Drizzle schema + migrations
│           ├── llm/         # provider-agnostic client, models.ts, prompts/, cost tracking
│           ├── middleware/  # auth (requireUser, optionalUser)
│           └── index.ts     # Worker entry: fetch + the hourly scheduled job (services/scheduler.ts)
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
// apps/api/src/llm/client.ts
type LlmPurpose =
  | 'onboarding.questionnaire' | 'onboarding.followup' | 'onboarding.initialRatings'
  | 'onboarding.suggestAttributes' | 'onboarding.weights'
  | 'recap.daily' | 'recap.weekly' | 'prompts.guided'
  | 'habits.suggestLinks' | 'season.newLeaves' | 'reports.analysis' | 'coach.chat' | 'embed';

generateStructured<T>(opts: {
  purpose: LlmPurpose;
  userId: string;
  schema: ZodType<T>;
  system: string; prompt: string | Message[];
  promptVersion: string;
}): Promise<T>   // picks provider/model from config by purpose, retries, logs to llm_calls

embed(texts: string[], ctx): Promise<number[][]>
```
`llm/models.ts` maps each purpose to `{ provider, model }`. Defaults are cheap models, and the weekly review and initial ratings can be upgraded.

### 8.5 Auth
- **Better Auth** (decided 2026-10-22), running in the API Worker with users and sessions in Neon via the Drizzle adapter. Sign-in: **email + password** and **Google** (enabled when `GOOGLE_CLIENT_ID/SECRET` are set). Session cookies are first-party: the API lives under `/api` on the same origin as the web app (Vite proxy in dev; one Worker serving both in production).
- Better Auth's tables (`auth_users`, `auth_sessions`, `auth_accounts`, `auth_verifications`) are separate from the app's `users`; an app user is created on first authenticated request and linked by `users.auth_subject`.
- Passwords use WebCrypto PBKDF2-SHA256 (`PASSWORD_HASH_ITERATIONS`, default 100k) instead of Better Auth's JS scrypt, to stay within Workers CPU limits. *Verify sign-in CPU time on the free plan at first deploy.*
- **iOS app:** the `@better-auth/expo` plugin on both sides. The app sends its scheme (`rlo://`, a trusted origin) in an `expo-origin` header, keeps the session cookie in the Keychain (SecureStore) and attaches it as a `Cookie` header on API calls; it talks to the API directly rather than through the web origin.
- `AUTH_MODE=dev` (the `x-dev-user` header) remains for tests and local experiments and is refused in production.
- *Later:* email verification and password reset need an email provider (e.g. Resend).

### 8.6 Scheduled jobs (Cloudflare Cron Triggers)
One hourly Cron Trigger (`runHourly` in `services/scheduler.ts`) visits every user with an active season and, in order:

| Step | When | Does |
|---|---|---|
| Season rollover | any request, lazily | `ensureCurrentSeason` archives an ended season and starts the new quarter on the user's next request or job run |
| Auto-recap | the user's local 04:00 | Recaps days in the backfill window that have content but no current recap |
| Decay | every run | Brings decay up to date |
| Weekly review | the user's local 04:00, once a week has finished | Runs the review when the week's days are recapped |
| Badges | every run | Awards catalog badges |
| Card refresh | every run | Rewrites the user's `player_cards` row so profiles and leaderboards stay current |

There is no snapshot job: charts replay the ledger (`node_snapshots` stays a possible optimization).

Jobs must be **idempotent**: unique constraints on `(user_id, local_date, kind)` for recaps, plus status columns.

### 8.7 Roles, admin and debug tools (added 2026-10-25)
- `users.role` is `user` (default) or `admin`. There's no self-serve path: grant it with `npm run set-role -w @rlo/api -- <email or username> admin` (uses `apps/api/.env`), or from `/admin` once you're an admin. Admins can't remove their own role, and `PATCH /me` ignores `role`.
- `requireUser` puts the role on the request; `requireAdmin` guards `/api/admin/*` and answers 404 to everyone else.
- **Admin API:** `/admin/overview` (users, active users, LLM calls/errors/cost for 24h/7d/30d, by purpose, by model and by day, recent errors), `/admin/llm-calls` (filter by user, purpose, errors), `/admin/users` (role, last logged day, LLM spend) with `PATCH /admin/users/:id`, and `/admin/recaps/:id` (stored model output, prompt version, re-runs, and the LLM calls within five minutes before it: `llm_calls` has no recap id).
- **Web:** `/admin` ("Control room") plus debug info for admins all over the app: a floating DBG panel (recent API calls with status, timing and size; the TanStack Query cache; route and viewport; session and env; run the 4am job in dev), orange dashed raw-JSON blocks at the bottom of the main pages, id chips next to habits, goals, workouts, exercises and attributes, and model details under each recap. Ctrl+Shift+D (or the panel's checkbox) hides the inline blocks; the choice is remembered per browser.

---

## 9. Data Model

Drizzle schema in `apps/api/src/db/schema.ts`. All tables have `id uuid pk`, `created_at` and `updated_at` unless noted.

| Table | Key columns | Notes |
|---|---|---|
| `users` | `email`, `username`, `display_name`, `timezone` (IANA), `week_start`, `auth_subject` (links the Better Auth identity), `profile_summary` | **Never return the full row from the API** (see §11) |
| `seasons` | `user_id`, `label` (e.g. `2026-Q4`), `starts_on`, `ends_on`, `status` (`setup`/`active`/`archived`), `mode` (`rating`/`growth`, §4.6), `archetype`, `final_snapshot` jsonb, `setup_ends_on` | Archived seasons keep their tree and ledger (the History page replays them) |
| `rating_nodes` | `season_id`, `user_id`, `parent_id` (null for Overall), `name`, `description`, `depth` (0–3), `weight`, `sort_order`, `template_key` (nullable), `lineage_id` | `lineage_id` links "the same" node across seasons for long-term charts |
| `rating_events` | `node_id` (leaf), `season_id`, `delta` numeric(6,2), `source` (`onboarding`/`daily_recap`/`weekly_review`/`decay`/`recalibration`), `recap_id` (nullable), `reason`, `evidence` (jsonb), `voided_at` (nullable) | Append-only ledger; re-runs set `voided_at` |
| `decay_rules` | `node_id`, `grace_days`, `per_day`, `floor`, `notes`, `version`, `active`, `authored_by` (`llm`/`user`) | |
| `pauses` | `user_id`, `starts_on`, `ends_on`, `reason` | Vacation / illness |
| `onboarding_sessions` | `user_id`, `season_id`, `stage`, `questionnaire` jsonb, `answers` jsonb, `chat` jsonb, `result` jsonb | Resumable |
| `day_logs` | `user_id`, `local_date`, `journal` text, `prompts` jsonb (guided questions and answers), `status` (`open`/`recapped`/`stale`) | Unique `(user_id, local_date)` |
| `habits` | `user_id`, `name`, `type` (8 types + `group`), `config` jsonb (target, slider min/max, group rule…), `days` (weekdays), `starts_on`, `sort_order`, `parent_id`, `archived_at` | Ported from Habit Tracker, with the type-specific columns folded into `config`. **Groups** (`type = group`) hold sub-habits (`parent_id`): done by a rule (all / any / at least N), no entries of their own, sub-habits share the group's schedule and carry the links. One level for now; the parent link leaves room for richer habits later. |
| `habit_links` | `habit_id`, `node_lineage_id` | Confirmed links only (suggestions live in the editor); by lineage so links survive seasons |
| `habit_entries` | `habit_id`, `local_date`, `value_num`, `value_text` | |
| `recaps` | `user_id`, `season_id`, `kind` (`daily`/`weekly`), `period_start`, `period_end`, `narrative`, `output` jsonb, `prompt_version`, `status` (`active`/`superseded`) | One active recap per period. Weekly `output` also holds focus goals, habit proposals, decay revisions, projections and archetype changes |
| `goals` | `node_id`, `target_value` | User half of Potential |
| `weight_changes` | `season_id`, `node_id`, `recap_id`, `from_weight`, `to_weight`, `from_share`, `to_share`, `reason`, `reverted_at` | Weekly weight shifts (§4.5) |
| `coach_messages` | `user_id`, `role` (`user`/`assistant`), `content`, `suggestions` jsonb | Coach chat (§5.9) |
| `tree_proposals` | `season_id`, `recap_id`, `reason`, `changes` jsonb, `status` (`pending`/`accepted`/`dismissed`/`expired`), `resolved_at` | Proposed tree changes (§4.5) |
| `objectives` | `user_id`, `name`, `unit`, `target`, `starts_on`, `ends_on`, `source` (`manual`/`habit`/`workouts`), `habit_id`, `archived_at` | Goals with a deadline (§7.4) |
| `workouts` | `user_id`, `name`, `notes`, `local_date`, `started_at`, `ended_at` (null while in progress), `template_id`, `exercises` jsonb | §7.5; one in progress per user |
| `workout_templates` | `user_id`, `name`, `notes`, `exercises` jsonb, `last_used_at` | No cap |
| `exercises` | `user_id`, `name`, `category`, `tracking`, `archived_at` | Custom exercises; the library is in `packages/shared` |
| `body_measurements` | `user_id`, `local_date`, `kind` (`weight`/`height`), `value` (kg/cm) | Unique per user, day and kind |
| `users.unit_system`, `users.track_weight`, `users.track_height` | | Units and opt-in body tracking |
| `users.role` | `user` / `admin` | §8.7 |
| `chart_views` | `user_id`, `name`, `config` jsonb (ChartConfig), `pinned` | §7.7 |
| `reports` / `report_runs` | `name`, `description`, `charts` jsonb, `options` jsonb, `default_range`; `report_id`, `from`, `to`, `used_ai`, `result` jsonb | §7.8 |
| `objective_links` / `objective_entries` | `objective_id` + `node_lineage_id`; `objective_id`, `local_date`, `value` | Links by lineage; one manual entry per goal per day |
| `decay_runs` | `user_id`, `season_id`, `local_date`, `paused`, `voided_at` | One active run per day; backfills void later runs |
| (memory) | `day_logs.journal_search`, `recaps.narrative_search` (generated `tsvector`, GIN) | Full-text search; no embeddings table (§5.5) |
| `llm_calls` | `user_id`, `purpose`, `provider`, `model`, `prompt_version`, `input_tokens`, `output_tokens`, `cost_usd`, `latency_ms`, `error` | **From day one** |
| `badges` / `user_badges` | catalog and awards (personal badges have `user_id` set on the catalog row) | Phase 3 |
| `users.profile_visibility` | `private` / `friends` / `public` | Phase 4 (§7.3) |
| `friendships` | `requester_id`, `addressee_id`, `status` (`pending`/`accepted`), `responded_at` | One row per pair (unique on least/greatest), Phase 4 |
| `player_cards` | `user_id` pk, `season_id`, `season_label`, `mode`, `overall`, `growth`, `archetype`, `categories` jsonb (rating `value` and `growth` each), `recapped_days`, `flagged_days` | Shareable card cache, Phase 4 |
| `users.leaderboard_opt_in` | boolean | Global boards (needs a public profile) |

---

## 10. UI / UX Direction
- **2K-style menu UI**: dark background, bold condensed sporty type, neon accent colors per category, animated stat bars that count up, card-reveal moments.
- **Color by value** (2K convention): for example, red under 60, orange 60–69, yellow-green 70–79, green 80–89, and a special color at 90+. Define thresholds as tokens.
- **Key screens:**
  - **MVP:** Landing → Build your tree (templates + custom) → Weights → Questionnaire → Follow-up chat → **OVR Reveal** → Ratings view (tree with bars and rationale).
  - **Phase 2:** Today (journal, habits, guided prompts, "End my day") → Recap view (narrative + itemized changes) → Weekly review → Change feed → Pause and backfill controls.
  - **Phase 3:** Player card, charts, badges, goals and potential, season setup and archive.
  - **Phase 4:** Profile, friends, compare, leaderboards.
  - **Refinements (before mobile):** Today is an at-a-glance overview and logging lives at `/log`; `/habits` is the habit stats glance (week / month / season; management at `/habits/manage`); the Week page adds day-by-day detail and opens earlier reviews; `/ratings/activity` holds the full change feed; every attribute and category has a page (`/ratings/node/:id`: history, changes, children, linked habits) and is linked wherever it appears; long pages get sticky section nav; heatmap days show a hover card and open their log.
  - **iOS app:** five tabs (Today, Habits, Week, Ratings, You). Today, Habits, Week and Ratings match their web pages; You gathers the web header's links (profile, friends, leaderboards, history) with Settings. Detail screens (a day's log, attribute pages, activity, seasons, profiles, onboarding) push over the tabs. Same dark 2K look, with SF Symbols and native sheets, prompts and share sheets.
- Responsive from the start (web first, mobile later). Consider making it an installable **PWA** before going native.
- The 2K look is dark-first and the default; light themes and other styles are opt-in personalization (§7.9).

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
- [x] Drizzle schema + migrations (Neon in dev/prod, in-memory PGlite in tests). Memory uses full-text search (§5.5), so no pgvector.
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
- [x] **Auth: Better Auth with email + password and Google (§8.5)**

### Phase 2: The Core Loop
- [x] Day log: journal, habits (8 types, weekday schedules), backfill window (3 days)
- [x] Guided prompts, "End my day"
- [x] Habit → attribute link suggestions (LLM) with confirmation (links stored by node lineage)
- [x] Daily recap (manual), itemized changes plus narrative
- [x] Auto daily recap at 04:00 local (hourly Cron Trigger; dev button to run on demand)
- [x] Ledger re-run on past-day edits (edits mark the day stale; "Update recap" re-runs, max 3 per day)
- [x] Decay engine (LLM-authored rules applied nightly, recomputed after backfills), pause mode
- [x] Decay rule revisions in weekly reviews (versioned; old rules kept)
- [x] Weekly review: narrative, corrections (±5), decay revisions, focus goals, one-click habit proposals, profile summary. Season projection and archetype updates move to Phase 3 with Potential.
- [x] Long-term memory: full-text retrieval of related older days + rolling profile (§5.5)
- [x] Change feed
- [x] Guardrail caps (±3 per attribute per day) and skepticism prompting

### Phase 3: Game Layer
- [x] Player card and image export (PNG via html-to-image)
- [x] Charts: history lines (Overall / Categories, table view), radar, consistency heatmap
- [x] Archetype updates (weekly review), hot/cold indicators (7-day trend)
- [x] Goals and potential (user goals plus weekly LLM season-end projection)
- [x] Badges: 8-badge catalog with Bronze→Hall of Fame tiers and a rule engine, plus weekly LLM personal badges (max 6 per season)
- [x] Seasons: lazy quarterly rollover (ratings, weights, decay rules and goals carry over), archived season cards, 14-day season setup with structure edits; new attributes rated by the model

### Phase 4: Social
- [x] Privacy model decision (private by default; card-only visibility: private / friends / public)
- [x] Public profile and card links (`/u/:username`, editable usernames, cached `player_cards`)
- [x] Friends and compare (mutual requests, `/friends`, `/compare/:username`)
- [x] Leaderboards (friends, plus global on template categories; opt-in)
- [x] Anti-gaming hardening (7-recap evidence floor and provisional marks, flagged-recap exclusion, social limits)

### Phase 5: Rich Inputs, Mobile & Monetization
- [ ] Photos (R2 + vision model), voice notes (transcription)
- [x] iOS app at web parity (Expo SDK 58 + Expo Router, sharing `packages/shared`; iOS only, no Android, decided 2026-10-23). Skipped the PWA step.
  - [x] Chunk 1, foundations: `apps/mobile`, Better Auth via `@better-auth/expo` (session cookie in the Keychain), native tabs, rating tree
  - [x] Chunk 2, day log and Today: journal, guided prompts, every habit type, End my day and the recap, calendar picker; Today at web parity
  - [x] Chunk 3, habits and week: habit stats glance, manage habits and the editor (AI link suggestions), weekly review, week breakdown
  - [x] Chunk 4, ratings: player card (shared as an image), charts (react-native-svg), badges, attribute pages, activity feed, decay and pauses, History and seasons
  - [x] Chunk 5, social and settings: profiles, friends, compare, leaderboards, profile and sharing settings (the You tab)
  - [x] Chunk 6, onboarding and season setup: discovery chat, tree builder, weights, scouting questionnaire and follow-up, the OVR reveal
  - [ ] Google sign-in, push notifications (recap ready, streaks)
  - [ ] EAS builds and TestFlight
- [ ] Monetization model; per-user quotas and plan-based model tiers
- [ ] Integrations (Strava, Health, etc.), if pursued

### Web features (after the iOS app)
- [x] Goals with a deadline, short and long term (§7.4)
- [x] Workout logging with unlimited templates, records and a generic set model for lifting and sport (§7.5)
- [x] Optional height and weight tracking, units setting (§7.5)
- [x] Avoid habits: a build/avoid direction for every habit type (§7.6)
- [x] User roles, an admin page and admin-only debug info across the web app (§8.7)
- [x] Charts for everything: metric catalog, chart explorer with trend modeling, saved and pinned charts (§7.7)
- [x] Reports: chart collections run over any period, with summaries and AI write-ups and suggestions (§7.8)
- [x] Personalization and configuration: themes, accents, fonts and layout options; switch parts of the app off; a customizable Today page (§7.9)
- [x] Scouting Report and an evolving tree: automatic capped weight shifts with undo, rare tree change proposals the player accepts (§4.5, §5.8)
- [x] Coach chat: advice grounded in your data, with one-tap habit, goal and Scouting Report suggestions; a Today card (§5.9)
- [x] Sports talk: none / normal / extra for the app's wording and every AI-written text (§7.10)
- [x] Season modes: Rating or Growth ("Most Improved") picked each season, growth boards, the rating hidden but revealable by its owner (§4.6)
- [ ] iOS: season modes (picker, growth display, growth boards)
- [ ] iOS: Scouting Report, evolving tree, coach and sports talk
- [ ] iOS app parity for goals, workouts, body tracking and avoid habits (and personalization)

---

## 13. Open Questions
1. ~~**Auth provider**~~ Decided: Better Auth (§8.5). Still open: email provider for verification and password reset.
2. **Name and brand.**
3. **Sanity caps vs "LLM fully decides":** are wide caps (e.g. ±3/day, ±5/week per leaf) acceptable as anti-abuse rails?
4. **Rating disputes:** can a user contest an initial rating or a recap change? If so, how (ask the LLM to reconsider with more info, rate-limited)?
5. **Mid-season renames:** allow typo fixes and description edits without unlocking structure?
6. **Backfill window length** (suggested 3 days).
7. **Questionnaire length cap** (suggested ≤ 40 questions / ~10 min).
8. ~~**Mid-quarter onboarding**~~ Decided: the first season is shortened (it ends with the calendar quarter).
9. **Display precision:** OVR shown as an integer or with one decimal?
10. **Decay rule visibility and editability** for users.
11. ~~**Privacy model**~~ Decided: private by default, card-only opt-in visibility (§7.3).
12. **Monetization model** (freemium, subscription, BYO key…) and quota design.
13. ~~**Global leaderboard comparability**~~ Decided: boards are Overall plus template categories only (§7.3). Overall still mixes different trees; revisit if it feels unfair.
14. **Data export and account deletion** (should be in place before launch).
15. **Content safety:** journals may contain sensitive topics (mental health, etc.). Define how the LLM responds to distressing content, what data goes to providers, and the provider data-retention settings.
