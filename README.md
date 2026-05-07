# Simulyn AI

> **Predict. Explain. Act.**
> The construction risk co-pilot. Score every task, read the weekly look-ahead
> the AI wrote for you, and stress-test the plan against five what-if scenarios
> — side by side — before site meeting.

Multi-tenant SaaS for construction teams: organizations and roles, project and
task tracking, deterministic risk scoring, **LLM-powered AI explanations and
trade-aware mitigations**, **AI project health briefs and weekly recaps**,
**five scenario types of what-if simulation with side-by-side comparison**,
Excel schedule import, and a dashboard with alerts.

> **Quick start:** see the [Run locally and verify](#run-locally-and-verify) section.

## What's new — AI narrative + multi-scenario simulator (May 2026)

The latest release moves Simulyn from *"show me a number"* to *"show me a story
and let me stress-test it"*. Full details and code pointers in the
[Phase 7 change log](#phase-7--ai-narrative--multi-scenario-simulator-may-2026-).

- **AI project health brief** pinned to the top of every project page — one-line
  headline, 2-3 sentence trade-aware body, 0-100 health score chip. Cached 12h;
  **Refresh** regenerates.
- **AI weekly recap** pinned to the top of the dashboard — headline plus 3-5
  collapsible bullets across the whole org, with a 7-day high-risk delta baked
  into the prompt so the LLM can say *"up vs last week"* truthfully.
- **Upgraded alerts widget** — AI reason, expandable **Show plan**
  (recommendation), and a **Why?** tooltip exposing the deterministic
  expected-vs-actual math behind the risk call.
- **Prediction delta pills** on the task table — `Medium→High`, `Risk
  improved`, `+3d vs last` whenever a re-run shifts the numbers.
- **Five scenario types** of what-if — `UniformSlip`, `SingleTaskSlip`,
  `AddResource`, `WeatherPause`, `ScopeReduction`. Each has its own
  deterministic math and narrative flavour.
- **Side-by-side comparison** — queue up to 8 scenarios, run in parallel, and
  read the impact (days) column coloured by direction (positive red, negative
  green).
- **Auto-suggest scenarios** — one click asks the AI which 3-4 scenarios are
  worth running *right now* given the project's current risk and progress
  state. Deep-linked from the project brief as **"Show me what could go
  wrong"**.

Walk through all of this in [End-to-end demo flow](#end-to-end-demo-flow) below.

## What's new — Pilot-readiness rollup (May 2026)

On top of Phase 7, this release closes the remaining blockers between demo and paid pilot:

- **Email infrastructure** — `IEmailSender` with a Resend driver and a Console fallback. Zero config needed locally (emails print to stdout); drop in a Resend key in prod and nothing else changes.
- **Password reset** — `/forgot-password` + `/reset-password` pages wired to `POST /api/auth/request-password-reset` (enumeration-proof — always returns 200) and `POST /api/auth/reset-password`. BCrypt-hashed tokens with a 1-hour TTL.
- **Tokenised invite flow** — Admins can invite any email, whether they have an account yet or not. A signed invite token is emailed out; `/register?token=...&email=...` previews the invite (org name + role) and merges registration + org-join into one step. 7-day TTL.
- **High-risk email alerts** — When `PredictionService` sees a task cross Low/Medium → High, it fires a per-org-member email (respecting `NotificationPreference.HighRiskAlerts`), dedup'd per `(task, UTC date)` so re-running predictions doesn't spam.
- **Weekly PDF recap** — `WeeklyRecapScheduler` (hosted `BackgroundService`) wakes every 10 min, sees *Monday 06:00–08:00 UTC*, and emails every org a one-page PDF (rendered by QuestPDF) with headline + top-5 bullets + portfolio-at-a-glance table. Org timezone support is Phase 2.
- **Stripe self-serve** — `POST /api/billing/checkout` creates a Stripe Checkout session scoped to the active org; `POST /api/billing/webhook` flips `SubscriptionStatus` on `checkout.session.completed` and `customer.subscription.*`. Manual-invoice admin path is untouched. Plan → Price ID via `Stripe:Prices:*`.
- **Rate limits on expensive endpoints** — `predictions` (60/min/user), `simulation` (10/min/user), in addition to the existing `auth` (10/min/IP) and `chat` (20/min/user).
- **Per-org daily LLM budget guardrail** — `UsageService` records every LLM-backed call (cost in mills), `BudgetGuard` returns 429 on predictions/simulation past the hard cap. Defaults: warn at $5/day, block at $20/day. `GET /api/billing/budget` powers UI banners.
- **Structured logging + Sentry wiring** — Serilog compact-JSON to stdout replaces the default logger so container log ingestion "just works". Sentry is opt-in via `Sentry:Dsn`.
- **Privacy / Terms / Cookie banner** — `/privacy` and `/terms` routes ship with template copy (clearly flagged as placeholders); `CookieBanner` component is wired into the root layout with accept-all / essential-only consent.
- **Automated tests + CI** — `Simulyn.Api.Tests` (xUnit, 17 tests) covers billing entitlement, email token lifecycle, scenario math, and tenant isolation. `ai-service/tests/` (pytest, 8 tests) covers the rule engine + deterministic fallback paths + the HTTP surface via `TestClient`. `.github/workflows/ci.yml` runs all three services on every push/PR (.NET build + test, pip install + pytest, frontend typecheck + build).

Local smoke test after `git pull`:

```powershell
cd backend/Simulyn.Api.Tests && dotnet test         # 17 tests
cd ../../ai-service && python -m pytest -q          # 8 tests
cd ../frontend && npx tsc --noEmit && npm run build # clean build
```

### What's still pending

Demo + pilot-sign-up are ready *today*. The full open-items list is tracked in [Pending work at a glance](#pending-work-at-a-glance) below — scan it before any demo so you can answer *"when does X ship?"* truthfully. Highlights of what's **not** yet built:

- **Phase 1.5** (7 items, ~1–2 weeks after pilot #1 signs) — HttpOnly cookie refresh flow, email verification, legal copy swap, live Stripe wiring on the landing page, uptime monitor, Sentry for ai-service + frontend, real contact mailto.
- **Phase 2** (7 items, 6–10 weeks) — **⭐ cost overrun prediction** (highest-ROI unshipped feature — dollar impact, not just day impact), P6 / MS Project import, task dependencies + real CPM, Gantt chart, audit log, mobile PWA.
- **Phase 3** (4 items) — real ML model, photo+vision progress detection, Procore / ACC / MSP Online integration, two-way schedule sync.
- **Phase 4** (6 items, before enterprise deals) — GDPR data export / delete endpoints, nightly backups + restore drill, HSTS+CSP headers, SSO/SAML, SOC 2 prep, PgBouncer.
- **Phase 5** (7 items, all non-code) — design-partner pilots, case study, niche landing pages, pricing wired through Stripe, sales-grade demo environment, onboarding email sequence, public changelog.

## Product positioning & landing page

The public marketing page at `/` (source: `frontend/app/page.tsx`) is the
single source of truth for how Simulyn is described externally. Keep in-app
copy, README, and sales conversations in sync with the language below.

### Core positioning

| | |
|---|---|
| **Product category** | Construction Decision Intelligence |
| **Positioning line (eyebrow)** | The construction risk co-pilot |
| **Tagline** | **Predict. Explain. Act.** |
| **Hero promise** | Spot delays before they happen, understand *why*, and fix them in minutes—not after they cost you weeks. |
| **Hero follow-up** | Simulyn reads your schedule, flags every at-risk task, and gives you clear, trade-aware actions—so you walk into every site meeting prepared. |
| **Trust line** | No credit card required · Results in under 60 seconds · Works with Excel schedules |
| **Closing CTA** | Stop reacting to delays. **Start preventing them.** |

### Three pillars (always in this order)

1. **Predict** — deterministic risk scoring, delay-day estimates, health score.
2. **Explain** — AI project health brief, weekly look-ahead, per-task reasons,
   plain-English alerts with a *Why?* tooltip.
3. **Act** — five what-if scenarios, side-by-side comparison, auto-suggest,
   trade-aware recommendations.

### Landing page structure (14 sections, top to bottom)

When editing `frontend/app/page.tsx`, keep this order — each section answers a
specific question a visitor is asking at that moment.

| # | Section | Anchor | Role |
|---|---------|--------|------|
| 1 | Header (sticky) | — | Nav: Features / See it in action / Pricing + Log in / Get started |
| 2 | Hero | — | Positioning + tagline + hero promise + two CTAs + mini dashboard preview |
| 3 | Social proof | — | One-line positioning strip for modern construction teams |
| 4 | Problem | — | *Construction delays don't happen overnight* + 4 pain bullets |
| 5 | Solution | — | *Meet Simulyn AI — Construction Decision Intelligence* + 4 value bullets |
| 6 | Core features | `#features` | Three large cards: AI Health Brief · Weekly Look-Ahead · What-If Simulation Engine |
| 7 | Supporting features | — | 5 tiles: Top Risk Alerts · Auto-Suggest Scenarios · Prediction Delta · Excel Import · AI Copilot |
| 8 | How it works | — | 3-step flow: Upload → Analyze → Take action |
| 9 | See it in action | `#demo` | Rich UI mockups of Health Brief + Scenario comparison (target of "View demo" CTA) |
| 10 | Who it's for | — | 4 audience tiles (PMs · Contractors · Planning teams · Mid-size+ companies) |
| 11 | Pricing | `#pricing` | Starter (Free 30d) · Pro ($199/project/month) · Enterprise (Custom · Book a demo) |
| 12 | Trust & security | — | Multi-tenant architecture · Org-level isolation · RBAC |
| 13 | Final CTA | — | *Stop reacting to delays. Start preventing them.* |
| 14 | Footer | — | Product · Pricing · Contact · Privacy · Terms |

### Copy rules

- **Never** call the product "a dashboard" — it's a *decision intelligence
  platform* / *risk co-pilot*. The subtext of the whole page is *"answers, not
  dashboards."*
- **Never** say "AI predicts delays." Say **"spot delays before they happen"**
  — the product is proactive, not clairvoyant.
- **Always** lead with outcomes (weeks saved, Sunday reports gone), not
  features (LLM, deterministic fallback, 5 scenario types).
- **Feature names that must stay consistent** across landing / app / docs:
  *AI Project Health Brief*, *Weekly Look-Ahead*, *What-If Simulation Engine*,
  *Top Risk Alerts*, *Auto-Suggest Scenarios*, *Prediction Delta*, *AI Copilot
  (Ask Simulyn)*. When renaming, update all three surfaces in the same PR.
- **Example quote** on the AI Health Brief card should always be a concrete,
  trade-specific sentence (not generic marketing): *"Foundation work is at
  risk due to slower progress. Add a second crew this week to avoid a 5-day
  delay."*
- **Audience wording** stays literal and B2B: *Construction Project Managers*,
  *Contractors & Site Engineers*, *Planning & Scheduling Teams*, *Mid-size to
  large construction companies*.

### Known landing-page placeholders to replace before paid GTM

- [x] Real Privacy and Terms **routes** now ship at `/privacy` and `/terms` — the
      *content* is a template and must be replaced with legal-reviewed copy
      before taking payment. Use Termly / iubenda / GetTerms.
- [x] Cookie banner — shipped as `CookieBanner.tsx`, wired into the root layout.
      Asks for accept-all / essential-only consent and remembers the choice in
      `localStorage`.
- [ ] Real `mailto:` Contact address (currently `hello@simulyn.ai`).
- [ ] A recorded demo video or `/demo` page (today the *View demo* / *Book a
      demo* buttons anchor-scroll to the in-page `#demo` mockup section).
- [x] Pricing numbers wired to Stripe — `POST /api/billing/checkout` is live and
      reads plan → `price_...` from `Stripe:Prices:*`. Still hard-coded on the
      landing page though; wire the **Start Free Trial** / **Book a demo**
      buttons to the API once you have real price IDs.
- [ ] Real pilot customer testimonials. The current page ships *no*
      testimonials by design; do not re-add fictional ones.

## Multi-tenancy at a glance

- Every project / task / prediction / simulation belongs to an **Organization** (the tenant).
- Users join orgs via `OrganizationMember` rows with one of four roles: **Owner**, **Admin**, **Member**, **Viewer**.
- Billing (`Plan`, `SubscriptionStatus`, expiry, notes) lives on the Organization, not the User. Each new org gets a 30-day Trial.
- A user can belong to multiple orgs and switch between them without re-logging in. The active org is sent on every API call as the **`X-Organization-Id`** header.
- On register, a personal workspace is auto-created and the new user becomes its Owner.
- `User.IsPlatformAdmin` is a person-level capability for the platform owner — independent of any tenant — that unlocks `/api/admin/*`.

### Role permissions

| Action | Viewer | Member | Admin | Owner |
|--------|:--:|:--:|:--:|:--:|
| List projects, tasks, dashboard, alerts | ✓ | ✓ | ✓ | ✓ |
| Create/update tasks, run prediction, run simulation, import Excel | — | ✓ | ✓ | ✓ |
| Create/rename projects, sample project | — | ✓ | ✓ | ✓ |
| Delete projects | — | — | ✓ | ✓ |
| Add / remove members | — | — | ✓ | ✓ |
| Change member roles, grant Owner | — | — | — | ✓ |
| Delete the organization | — | — | — | ✓ |

## Run locally and verify

Four components: PostgreSQL, the .NET API, the FastAPI AI service, and the
Next.js frontend. The fastest path is **Docker Compose** (one command).
Manual / no-Docker steps are further down.

### Option A — Docker Compose (recommended)

Prereqs: Docker Desktop running.

```powershell
# 1. (Optional) enable real LLM predictions — pick one:
#    Create a .env file at the repo root:
"OPENAI_API_KEY=sk-..." | Out-File -Encoding utf8 .env
# or
"ANTHROPIC_API_KEY=sk-ant-..." | Out-File -Encoding utf8 .env
# (skip this step entirely if you just want to demo with the deterministic
#  rule-engine fallback — everything still works without an API key)

# 2. Bring up the whole stack
docker compose up --build
```

When you see "Now listening on: http://[::]:8080" from the `api` service and
"Ready in" from the `web` service, the stack is live. Verify in this order:

| # | Check | URL or command | Expected |
|---|-------|-----------------|----------|
| 1 | AI service health | http://localhost:8000/health | `{"status":"ok","llm_provider":"openai"\|"anthropic"\|"off",...}` |
| 2 | API health | http://localhost:5000/healthz | `{"status":"ok","service":"simulyn.api"}` |
| 3 | Swagger | http://localhost:5000/swagger | API explorer loads |
| 4 | Landing page | http://localhost:3000 | Marketing page with "Start 30-day free trial" CTA |
| 5 | Register | http://localhost:3000/register | Create an account → personal workspace auto-created, you're its **Owner**, redirected to dashboard |
| 6 | Org switcher | Top-right of the Nav | Shows your current org name + role badge. Click to see all orgs you belong to. |
| 7 | Sample project | Click **Load sample project** on the empty dashboard | A 12-task construction project is created in your active org, predictions run automatically, you land on the project page |
| 8 | AI insight | Click any task name in the table | "AI summary" + "Recommended actions" expand below the row |
| 8a | Project health brief | Top of `/projects/<id>` | One-line AI headline + 2-3 sentence body + 0-100 health chip. Click **Refresh** to regenerate; re-runs are cached for 12h |
| 8b | Task delta pills | Re-run prediction then edit a task's progress and re-run again | Risk column shows `Medium→High` / `High→Low` pill; Delay column shows `+3d vs last` |
| 8c | Weekly recap | Top of `/dashboard` | AI headline + 3-5 collapsible bullets. Cached 12h per-org; **Refresh** forces regen |
| 8d | Alerts | `Top risk alerts` widget | Reason + **Show plan** (AI recommendation) + **Why?** tooltip with deterministic math |
| 9 | What-if (single) | http://localhost:3000/simulation | Pick demo project, click `Uniform slip` chip, set days, **Run simulation** → narrative result |
| 9a | What-if (compare) | `/simulation` → add 3-4 scenario chips | Side-by-side table with Impact (days) column, positive in red / negative in green |
| 9b | Auto-suggest | `/simulation` → **Suggest scenarios** | 3-4 AI-picked scenarios pre-loaded into the queue with rationales |
| 9c | Deep-link to simulator | Project brief card → **Show me what could go wrong** | Jumps to `/simulation` for that project, auto-suggest already run |
| 10 | Multi-tenancy | http://localhost:3000/organizations | Create a second org "Acme Construction"; switch via the Nav; the dashboard for Acme is empty and the demo project is **not visible** (tenant isolation works) |
| 11 | Member invite | Open `/organizations/<id>` for one of your orgs | Register a second account in another browser, then invite that user's email here as **Member**; switch roles to test |
| 12 | Admin billing | http://localhost:3000/admin/billing | (Logged in as a `PlatformAdminEmails` user) Manage **organizations'** plan / status. Toggle the Active status and verify entitlement changes for that org. |

> **Tip:** to make yourself a platform admin, set `PlatformAdminEmails` in
> `docker-compose.yml` to the email you'll register with **before** signing up.
> Default in the compose file is `devadmin@example.com`.

To stop and clean up:

```powershell
docker compose down            # stop containers, keep DB volume
docker compose down -v         # also wipe Postgres data
```

### Option B — Manual run (no Docker)

Prereqs: .NET 8 SDK, Node.js 20+, Python 3.11+, a running PostgreSQL.

Open three terminals.

**Terminal 1 — AI service** (optional but recommended):

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
# optional: enable LLM
# $env:OPENAI_API_KEY="sk-..."         # or ANTHROPIC_API_KEY
uvicorn main:app --reload --port 8000
# verify:  curl http://localhost:8000/health
```

**Terminal 2 — API**:

```powershell
cd backend\Simulyn.Api
# point the connection string at your local Postgres if not the default
# (see appsettings.json -> ConnectionStrings:Default)
dotnet restore
dotnet run
# verify:  curl http://localhost:5000/healthz
# Swagger: http://localhost:5000/swagger
```

The API auto-applies EF Core migrations on startup, so the schema is created
the first time you run it.

**Terminal 3 — Frontend**:

```powershell
cd frontend
copy .env.local.example .env.local
npm install
npm run dev
# open http://localhost:3000
```

Then walk through steps 4–9 from the table above.

### What you should see

- Visiting `http://localhost:3000` lands on a real marketing page (not a
  login form), with hero, features, pricing, and CTAs.
- After registering, the dashboard is empty with a friendly **Load sample
  project** button.
- Clicking it creates a realistic 12-task construction project and runs AI
  predictions on every task in parallel — typically done in 3–5 seconds.
- On the project page, every task shows a Risk pill (Low / Medium / High) and
  an estimated delay-day count. Clicking the task name expands an "AI summary"
  + "Recommended actions" panel.
- With an LLM key set, the recommendations are concrete and trade-aware
  ("Bring a second pump and a night pour crew this week …"). Without a key,
  you'll see the deterministic canned text — still functional, just less
  impressive.
- Editing a task's progress slider auto-re-runs its prediction. Importing a
  `.xlsx` schedule auto-runs predictions for every imported task.
- Hitting `/api/auth/login` more than 10 times per minute from one IP returns
  `429 Too Many Requests` (basic brute-force protection).

## End-to-end demo flow

This is the scripted "golden path" for a live demo — every step exercises one
of the features the current release is built around. Assumes the stack is
running (see [Run locally and verify](#run-locally-and-verify)). Total runtime:
~6-8 minutes, or ~3 minutes if you skip the demo-bundle seed.

### 1. Onboard in one click

- Open `http://localhost:3000` (or `:3001` on machines where port 3000 is
  taken — see `docker-compose.yml`).
- **Register** with any email. A personal organization is auto-created, you
  become its **Owner**, and you land on an empty dashboard.
- *Talking point:* multi-tenant from row zero — every project, task,
  prediction, simulation, and AI brief is scoped to this org via the
  `X-Organization-Id` header.

### 2. Seed realistic data

- Click **Load sample project** (any user) or **Demo bundle** (platform admin
  only — 4 varied projects, ~54 tasks, ~2-3 minutes on local Ollama).
- Predictions run automatically on every task as soon as the data lands.

### 3. Read the dashboard story, not just numbers

- **AI weekly recap** at the very top: one headline, 3-5 bullets. Hit
  **Refresh** to regenerate (cached 12h per-org). With the LLM on, the bullets
  call out specific projects by name grounded in the numbers — *not* generic
  platitudes.
- **KPI strip** — projects / tasks / high-risk / open-alerts.
- **Risk trend chart** + **AI insights** (highest-priority first).
- **Project progress** / **Risk distribution** / **Top risk alerts** row.
  - Click **Show plan** on any alert to expand the AI recommendation.
  - Hover **Why?** to see the deterministic math (`Expected ~60% by today,
    actual 30% (gap +30 pts)`).
  - *Talking point:* LLM does the words, the rule engine does the numbers. You
    can always prove where a risk call came from.

### 4. Open a project — the AI health brief is the headline

- Click any project. The very first card is the **AI project health brief**:
  one-line headline, 2-3 sentence body, colored **health score** chip
  (0-100), and tone tags (`Watch`, `Behind schedule`, `Finish week`).
- Hit **Refresh** — note that the score is deterministic (same risk mix +
  progress gap → same score) but the narrative regenerates.
- Click the amber **Show me what could go wrong** pill → jumps straight to the
  simulator with AI-suggested scenarios already loaded (we'll land there in
  step 6).

### 5. See prediction history at a glance (delta pills)

- On the task table, click **Re-run** on a task. Edit its progress slider.
  Click **Re-run** again.
- The Risk column now shows `Medium→High` (red, ↑) or `High→Low` (green, ↓);
  the Delay column shows `+3d vs last`.
- *Talking point:* trends matter more than snapshots. The delta pill tells a
  PM "this is the second week in a row we've slipped" at a glance.

### 6. Stress-test the plan — five scenarios, side by side

- Navigate to `/simulation` (or use the deep-link from step 4).
- The queue starts empty. Two ways to fill it:
  - Click the scenario chips (**Uniform slip**, **Single task slip**, **Add
    resource**, **Weather pause**, **Scope reduction**) to add cards. Each
    card has inline config controls (days, tasks, capacity %).
  - Or click **Suggest scenarios** — the AI picks a 3-4 scenario mix tailored
    to *this* project's current state (lagging projects get an **Add
    resource** suggestion; portfolios with 10+ tasks get a **Scope reduction**,
    etc.) Each suggestion comes with a rationale rendered beneath the card.
- Click **Compare N scenarios**. All N run in parallel against the AI service;
  typical wall-clock on Ollama is ~5-10s for 4 scenarios.
- The results table shows one row per scenario with:
  - **Scenario** — type + AI-written headline.
  - **Inputs** — expanded JSON config (task UUIDs swapped for task names).
  - **Impact (days)** — coloured red if positive (finish later), green if
    negative (finish earlier).
  - **Summary** — 2-4 sentence AI narrative that mentions the trade /
    task / crew involved, not just the integer.

### 7. Verify tenant isolation (optional, ~1 min)

- Create a second organization via `/organizations`.
- Switch to it via the org switcher in the sidebar. Dashboard is empty — the
  demo project is not visible. Brief, recap, alerts all cleanly isolated.

### What the demo demonstrates

| Claim | Evidence shown |
|---|---|
| "Predictable risk scores" | Every Risk / health score / predicted delay is deterministic and reproducible; the **Why?** tooltip shows the math |
| "Actionable AI narrative" | Health brief, weekly recap, per-task summary and recommendations, scenario narrative — all trade-aware, grounded in your data |
| "Stress-test any plan" | 5 scenario types × compare up to 8 in parallel, with auto-suggest for the busy PM |
| "See change, not just state" | Delta pills on re-runs, 7-day high-risk delta in the weekly recap |
| "Works offline" | Unplug the LLM (`LLM_PROVIDER=off`) and every feature degrades to deterministic text tagged `· offline fallback` in the UI — no 500s |
| "Multi-tenant" | Switch orgs, verify the dashboard and all briefs/recaps change |

### Troubleshooting

- **`docker compose up` hangs on the `api` service** → wait — the first run
  has to download the .NET SDK image (~700MB) and apply migrations.
- **Login returns 401** → the user might not exist yet; register first.
- **Predictions disabled banner** → your trial expired. Open
  `/admin/billing` (as admin) and set the user to **Active** with an
  expiry date in the future.
- **"Run prediction" is slow** → only the first call per provider is slow
  (cold connection); subsequent calls are ~1–2s each, in parallel.
- **`/health` shows `"llm_provider": "off"`** → no API key picked up. Check
  the `.env` file is at the repo root (not inside `ai-service/`) and recreate
  the `ai` container: `docker compose up --build -d ai`.

## Repository layout

| Path | Stack | Role |
|------|--------|------|
| `backend/Simulyn.Api` | .NET 8, EF Core, PostgreSQL, JWT | REST API, persistence, orchestration |
| `ai-service` | Python, FastAPI | Predict + simulate (same rules as the API fallback) |
| `frontend` | Next.js 14 (App Router), Tailwind | Login, dashboard, projects, simulation |

The API calls the Python service when it is reachable; otherwise it uses the built-in rule engine so local development still works.

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download) (local dev and migrations)
- [Node.js 20+](https://nodejs.org/) (for the web UI)
- [Python 3.11+](https://www.python.org) (optional; for the AI microservice)
- [PostgreSQL 15+](https://www.postgresql.org/) (or use Docker Compose)
- [Docker Desktop](https://www.docker.com/) (optional; for Compose)

## Database migrations

The API applies migrations automatically on startup (`Database.MigrateAsync()`). Migration files live under `backend/Simulyn.Api/Migrations/`.

To add a new migration after model changes (requires .NET SDK):

```powershell
cd backend\Simulyn.Api
dotnet tool install --global dotnet-ef
dotnet ef migrations add YourMigrationName
```

Design-time connection string: set `ConnectionStrings__Default` or rely on `AppDbContextFactory` (defaults to local Postgres).

## Docker Compose (full stack)

From the repository root:

```powershell
docker compose up --build
```

Services:

| Service | Port (host) | Notes |
|---------|-------------|--------|
| `db` | 5432 | PostgreSQL 16, user/db/password `simulyn` |
| `ai` | 8000 | FastAPI |
| `api` | 5000 | .NET API (container listens on 8080) |
| `web` | 3000 | Next.js (`NEXT_PUBLIC_API_URL=http://localhost:5000`) |

Open `http://localhost:3000`. The browser calls the API on `http://localhost:5000` (mapped from the `api` container).

**Production:** replace `Jwt__Key` in `docker-compose.yml`, use secrets for the DB password, and do not expose Postgres publicly.

## Configuration cheat-sheet

All secrets are read from environment variables. None are hardcoded for production.

### .NET API (`backend/Simulyn.Api`)

| Variable | Required | Default | Purpose |
|----------|:---:|---------|---------|
| `ConnectionStrings__Default` | ✓ | local Postgres | Postgres connection string |
| `Jwt__Key` | ✓ | dev-only placeholder | Min 32-char secret for signing JWTs. **Generate a fresh one per environment.** |
| `Jwt__Issuer` | — | `Simulyn.Api` | JWT issuer claim |
| `Jwt__Audience` | — | `Simulyn.Clients` | JWT audience claim |
| `Jwt__ExpiryMinutes` | — | `10080` (7 days) | Token lifetime |
| `AiService__BaseUrl` | — | `http://localhost:8000` | Reachable URL of the FastAPI service |
| `Frontend__Origin` | — | `http://localhost:3000` | CORS origin for the web UI |
| `PlatformAdminEmails` | — | unset | Comma-separated emails that get `IsPlatformAdmin=true` on register |
| `ASPNETCORE_ENVIRONMENT` | — | `Production` in Docker | `Development` enables more verbose errors |
| `Email__Provider` | — | `auto` | `resend` \| `console` \| `auto`. `auto` picks resend when `Email__Resend__ApiKey` is set, else console. |
| `Email__Resend__ApiKey` | — | unset | [Resend](https://resend.com) API key. Without it, emails print to stdout instead of being sent (great for local dev / demos). |
| `Email__FromAddress` | — | `Simulyn AI <noreply@simulyn.ai>` | From address on all system emails. Must be a verified sender on your Resend account. |
| `Email__AppUrl` | — | `http://localhost:3000` | Public URL used in email links (reset, invite, recap). |
| `Sentry__Dsn` | — | unset | [Sentry](https://sentry.io) DSN. When set, errors + 10% trace sample are forwarded. Leave unset for local dev. |
| `Budget__SoftCapMills` | — | `5000` ($5/day) | Per-org daily LLM spend warning threshold (1000 mills = $1). UI starts showing an amber banner above this. |
| `Budget__HardCapMills` | — | `20000` ($20/day) | Hard block — predictions/simulation return 429 above this until UTC midnight. |
| `Stripe__ApiKey` | — | unset | Stripe secret key (`sk_test_...` or `sk_live_...`). Without it, self-serve checkout endpoints return 503. |
| `Stripe__WebhookSecret` | — | unset | Signing secret for the Stripe webhook endpoint (`whsec_...`). Required to accept webhook events in production. |
| `Stripe__Prices__Starter` | — | unset | Stripe Price ID for the Starter plan (`price_...`). |
| `Stripe__Prices__Pro` | — | unset | Stripe Price ID for the Pro plan. |
| `Stripe__Prices__Enterprise` | — | unset | Stripe Price ID for the Enterprise plan (if self-serve; most enterprise stays on manual invoice). |
| `Stripe__SuccessUrl` | — | `/admin/billing?checkout=success` on localhost | Where Stripe sends the browser after a successful checkout. |
| `Stripe__CancelUrl` | — | `/admin/billing?checkout=cancel` on localhost | Where Stripe sends the browser if the user aborts checkout. |

### AI service (`ai-service`)

| Variable | Required | Default | Purpose |
|----------|:---:|---------|---------|
| `LLM_PROVIDER` | — | `auto` | `openai` \| `anthropic` \| `ollama` \| `auto` \| `off`. Use `openai` for OpenAI itself **and** any OpenAI-compatible provider (Groq, DeepSeek, Together, OpenRouter, Azure OpenAI). |
| `OPENAI_API_KEY` | — | unset | Enables the `openai` provider (also used by Groq / DeepSeek / Together / OpenRouter — paste their key here). |
| `OPENAI_BASE_URL` | — | unset (→ `https://api.openai.com/v1`) | Override to use a non-OpenAI provider that speaks the same protocol. See [Hosted-provider recipes](#hosted-provider-recipes) below. |
| `OPENAI_MODEL` | — | `gpt-4o-mini` | Model for `/predict`, `/simulate`, `/project-brief`, `/weekly-recap`. |
| `OPENAI_CHAT_MODEL` | — | *inherits `OPENAI_MODEL`* | Override model for `/chat-step` only — useful when narrative uses a high-quality low-volume model and chat needs a high-volume cheaper one. |
| `ANTHROPIC_API_KEY` | — | unset | Enables Anthropic provider |
| `ANTHROPIC_MODEL` | — | `claude-3-5-haiku-latest` | Anthropic model |
| `OLLAMA_BASE_URL` | — | `http://localhost:11434/v1` | Local Ollama OpenAI-compatible endpoint |
| `OLLAMA_MODEL` | — | `llama3.2` | Model used by `/predict`, `/simulate`, and `/chat-step` (unless `OLLAMA_CHAT_MODEL` is set). Pull first with `ollama pull llama3.2`. |
| `OLLAMA_CHAT_MODEL` | — | *inherits `OLLAMA_MODEL`* | Override model for `/chat-step` only. Chat uses tool-calling, so larger models produce noticeably better results — recommended: `ollama pull llama3.1:8b` or `ollama pull qwen2.5:7b`. |
| `OLLAMA_TIMEOUT_SECS` | — | `60` | Per-call timeout for Ollama |
| `LLM_TIMEOUT_SECS` | — | `15` | Per-call timeout for OpenAI-compatible providers |
| `LLM_MAX_TOKENS` | — | `350` | Output cap for `/predict` and `/simulate` |
| `CHAT_MAX_TOKENS` | — | `1500` | Output cap for `/chat-step` |

### Hosted-provider recipes

Any OpenAI-compatible provider works — just set `LLM_PROVIDER=openai` plus the right `OPENAI_BASE_URL`:

| Provider | `OPENAI_BASE_URL` | Example `OPENAI_MODEL` | Notes |
|---|---|---|---|
| **OpenAI** (default) | *leave unset* | `gpt-4o-mini` | Best tool-calling; pay-as-you-go. Rock-solid baseline. |
| **Groq** (recommended for pilots) | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` (narrative) + `OPENAI_CHAT_MODEL=llama-3.1-8b-instant` (chat) | Free tier: 14.4k req/day on 8B-instant, 1k req/day on 70B. Signup at [console.groq.com](https://console.groq.com). Ideal for 3-5 pilot orgs at $0/mo. |
| **DeepSeek** | `https://api.deepseek.com/v1` | `deepseek-chat` | Cheapest paid (~$0.27 / $1.10 per 1M). Solid tool-calling. |
| **Together AI** | `https://api.together.xyz/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | Open-weight models, pay-as-you-go. |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `meta-llama/llama-3.3-70b-instruct:free` | Proxy to 100+ models, some free tiers. |
| **Anthropic** | N/A — use `LLM_PROVIDER=anthropic` | `claude-3-5-haiku-latest` | Premium narrative quality; independent key path. |
| **Local Ollama** | N/A — use `LLM_PROVIDER=ollama` | `llama3.2` | Free, private, no infra cost; needs 4GB+ RAM. Tool-calling quality drops on small models. |

See `ai-service/.env.example` for copy-paste env blocks for each recipe.

### Frontend (`frontend`)

| Variable | Required | Default | Purpose |
|----------|:---:|---------|---------|
| `NEXT_PUBLIC_API_URL` | ✓ | `http://localhost:5000` | Public URL the browser uses to call the .NET API |

> Tokens are stored in `localStorage` today (planned: HttpOnly cookies — deferred until after pilot feedback so we don't destabilise auth right before demos). `NEXT_PUBLIC_*` vars are inlined into the build, so they must be set at build time.

### Configuring Resend for real email delivery

1. Create a Resend account at [resend.com](https://resend.com) (3,000 emails/month free).
2. Add and verify the domain you'll send from (adds 3 DNS records — TXT/SPF/DKIM). This is required; without it Resend will only deliver to the account-owner email.
3. Create an API key scoped to *Send emails*.
4. Set `Email__Resend__ApiKey=re_...` and `Email__FromAddress="Your Name <noreply@yourdomain.com>"`.
5. Redeploy. Email now goes through Resend; leave the key unset and everything still works — it just prints to stdout.

### Configuring Stripe for self-serve checkout

1. Create three Products in the Stripe dashboard (Starter, Pro, Enterprise) with the prices you want to charge. Copy the resulting `price_...` IDs.
2. Set `Stripe__ApiKey=sk_test_...` and `Stripe__Prices__Starter=price_...`, `Stripe__Prices__Pro=price_...`, `Stripe__Prices__Enterprise=price_...`.
3. Add a webhook endpoint in the Stripe dashboard pointing at `https://yourapi/api/billing/webhook`, subscribed to at least `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.paused`. Copy the signing secret and set `Stripe__WebhookSecret=whsec_...`.
4. Set `Stripe__SuccessUrl` and `Stripe__CancelUrl` to URLs on your public frontend (not localhost).
5. Start with test mode (`sk_test_` / `pk_test_`) and use the Stripe CLI (`stripe listen --forward-to localhost:5000/api/billing/webhook`) to replay webhooks into your local API. Flip to live mode only once end-to-end is green.

### Configuring Sentry

1. Create a project in Sentry (`.NET` platform for the API, `Python`/`FastAPI` for ai-service, `Next.js` for the frontend).
2. Set `Sentry__Dsn=https://...` on the .NET API. The app starts sending errors automatically on next restart — no code change needed.
3. (TODO) AI service + frontend Sentry wiring is planned but not yet in the codebase.

## Deploy to the cloud

Three paths, pick the one that matches where you are right now:

| Path | Monthly cost | Cold start | Best for | Section |
|---|---|---|---|---|
| **A. Vercel + Render + Neon** | **$0** (free tiers) | ~30s after 15min idle | First demo to stakeholders, design-partner pilots | [Option A below](#option-a--vercel--render--neon-free-tier-recommended-for-first-demo) |
| **B. Single VPS + Caddy** | $5-10 | None | Full control, your domain, 3+ paying pilots | [Option B below](#option-b--single-vps-with-docker-compose--caddy-self-hosted) |
| **C. Railway** (all-in-one) | $5-20 | None | One dashboard, no SSH, first real pilot | [Option C below](#option-c--railway-simplest-managed-no-ssh) |

For a VPS deploy, the repo ships a ready-made production setup in `deploy/`:

```
deploy/
  docker-compose.prod.yml   — all four services + Postgres, internal network
  Caddyfile                 — reverse proxy, auto-HTTPS via Let's Encrypt
  .env.prod.example         — every required env var, annotated
```

### Option A — Vercel + Render + Neon (free-tier, recommended for first demo)

This is the fastest path from `git push` to a public URL you can send a stakeholder — no credit card, no SSH, ~20 minutes total. The architecture:

```
[ Vercel frontend ] ──► [ Render: Backend API ] ──► [ Neon Postgres ]
                                   │
                                   └──► [ Render: AI service ] ──► Groq
```

**Known limits of the free tier** — fine for demos and design-partner pilots, not for real users:

- Render free web services sleep after 15 min idle → **~30s cold start** on the next request.
- Neon free tier auto-suspends the DB after 5 min idle → first query adds ~2-5s.
- Groq free tier: ~14.4k requests/day on 8B-instant, 1k/day on 70B — plenty for a demo.

Total time: ~20 minutes. You'll need a GitHub account (with this repo pushed) and a Groq API key.

#### Step 1 — Create the Neon Postgres database (~3 min)

1. Sign up at [neon.tech](https://neon.tech) (GitHub login, no card).
2. Create a new project; pick the region closest to where you'll deploy the API (e.g. `ap-southeast-1` for Singapore).
3. On the project's **Connection Details** page, copy the connection string. It looks like:

   ```
   postgresql://neondb_owner:npg_xxxxx@ep-abc-123-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

4. Convert it to Npgsql key=value format (you'll paste this into Render):

   ```
   Host=ep-abc-123-pooler.ap-southeast-1.aws.neon.tech;Database=neondb;Username=neondb_owner;Password=npg_xxxxx;SSL Mode=Require;Trust Server Certificate=true
   ```

   Save that somewhere — you'll need it in Step 2.

#### Step 2 — Deploy the Backend API to Render (~8 min)

1. Sign up at [render.com](https://render.com) (GitHub login, no card for free tier).
2. **New +** → **Web Service** → connect GitHub → select your `simulyn-ai` repo.
3. Fill the form:

   | Field | Value |
   |---|---|
   | Name | `simulyn-api` |
   | Region | Singapore (same as Neon) |
   | Branch | `main` |
   | **Runtime** | **Docker** |
   | **Dockerfile Path** | `./backend/Dockerfile` |
   | **Docker Context** | `./backend` |
   | Instance Type | **Free** |
   | Health Check Path | `/healthz` |

4. Under **Advanced → Environment Variables**, add these (replace the ⚠️ placeholders with real values — see generation commands at the end of this section):

   ```
   ConnectionStrings__Default = <the Npgsql-format string from Step 1>
   Jwt__Key                   = ⚠️ openssl rand -base64 48
   Jwt__Issuer                = Simulyn.Api
   Jwt__Audience              = Simulyn.Clients
   Frontend__Origin           = https://<your-vercel-app>.vercel.app
   AiService__BaseUrl         = https://simulyn-ai-ai.onrender.com    ⚠️ set in Step 3
   PlatformAdminEmails        = you@youremail.com
   ASPNETCORE_ENVIRONMENT     = Production
   ASPNETCORE_URLS            = http://0.0.0.0:10000
   ```

5. **Create Web Service** → wait ~5 min for the first build.
6. Once green, verify: open `https://simulyn-api.onrender.com/healthz` → should return `{"status":"ok","service":"simulyn.api"}`. EF migrations run automatically on first boot, so the DB is now seeded.

> **Multiple Vercel preview URLs?** `Frontend__Origin` accepts a comma-separated list — e.g. `https://simulyn-ai.vercel.app,https://simulyn-ai-git-main-*.vercel.app`. Each value must be an exact origin (no wildcards).

#### Step 3 — Deploy the AI service to Render (~5 min)

Same flow, new Web Service:

| Field | Value |
|---|---|
| Name | `simulyn-ai-ai` *(must exactly match `AiService__BaseUrl` in Step 2)* |
| Runtime | **Docker** |
| Dockerfile Path | `./ai-service/Dockerfile` |
| Docker Context | `./ai-service` |
| Instance Type | **Free** |
| Health Check Path | `/health` |

Environment variables (Groq config — free, fastest inference):

```
LLM_PROVIDER       = openai
OPENAI_API_KEY     = gsk_...your Groq key from console.groq.com
OPENAI_BASE_URL    = https://api.groq.com/openai/v1
OPENAI_MODEL       = llama-3.3-70b-versatile
OPENAI_CHAT_MODEL  = llama-3.1-8b-instant
LLM_TIMEOUT_SECS   = 15
LLM_MAX_TOKENS     = 350
CHAT_MAX_TOKENS    = 1500
PORT               = 10000
```

Deploy → verify: `https://simulyn-ai-ai.onrender.com/health` → `{"status":"ok","llm_provider":"openai",...}`.

If you'd rather use OpenAI / Anthropic / DeepSeek, swap the values per the [Hosted-provider recipes](#hosted-provider-recipes) table above.

#### Step 4 — Deploy the frontend to Vercel (~3 min)

1. Sign up at [vercel.com](https://vercel.com) (GitHub login, no card).
2. **Add New** → **Project** → import `simulyn-ai`.
3. In the import screen:
   - **Root Directory** → `frontend`
   - **Framework Preset** → Next.js (auto-detected)
   - **Environment Variables**:

     | Name | Value | Environments |
     |---|---|---|
     | `NEXT_PUBLIC_API_URL` | `https://simulyn-api.onrender.com` | Production, Preview, Development |

4. **Deploy** → first build takes ~2-3 min.
5. Vercel hands you `https://<your-app>.vercel.app`. Copy that URL.

#### Step 5 — Close the CORS loop

Go back to Render → `simulyn-api` → **Environment** → edit `Frontend__Origin` to the exact Vercel URL you got in Step 4 (e.g. `https://simulyn-ai.vercel.app`). Save — Render redeploys automatically in ~1 min.

#### Step 6 — End-to-end smoke test (~2 min)

Open your Vercel URL and walk through:

1. **Register** — create an account with the email you put in `PlatformAdminEmails` → you're Owner of a fresh personal org, and a platform admin.
2. **Dashboard** loads → click **Load sample project** → predictions run in ~5-10s (first call wakes the AI service from sleep).
3. Open the project → **AI health brief** generates a trade-aware 2-3 sentence summary.
4. Click **Ask Simulyn** (bottom-right) → ask *"What's at risk this week?"* → should get a natural-language reply grounded in your org's data.
5. **Simulation** → click **Suggest scenarios** → run compare → side-by-side table with coloured Impact column.

If any step fails, check logs in this order:

| Symptom | Where to look |
|---|---|
| Login fails / 500 on register | Render → `simulyn-api` → **Logs** |
| White page / JS error on Vercel | Browser DevTools Console |
| CORS error in browser console | Render → `simulyn-api` → `Frontend__Origin` must match Vercel origin exactly |
| "Error talking to language model" | Render → `simulyn-ai-ai` → **Logs** |
| Slow first request after idle | Expected (cold start) — make a second request to warm up |
| Failed Vercel build | Vercel → **Deployments** → click the red one → full build log |

#### Handy commands

```bash
# Generate a JWT signing key (Linux/macOS, or Git Bash on Windows)
openssl rand -base64 48

# On Windows PowerShell if openssl isn't on PATH:
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))

# Test the whole stack from curl once live
curl -sf https://<your-app>.vercel.app                # → HTML landing page
curl -sf https://simulyn-api.onrender.com/healthz     # → {"status":"ok","service":"simulyn.api"}
curl -sf https://simulyn-ai-ai.onrender.com/health    # → {"status":"ok","llm_provider":"openai",...}
```

#### What you lose on free tiers (and when to upgrade)

| Pain point | Upgrade path |
|---|---|
| ~30s cold start after 15 min idle | Render **Starter** ($7/mo each service) — always-on, no sleep |
| Neon auto-suspend on idle | Neon **Launch** ($19/mo) — no auto-suspend, 10 GB storage |
| One worker, one region | Render **Standard** ($25/mo) — multi-region fail-over |
| `.vercel.app` subdomain | Bring your own domain (free on Vercel — add a DNS `CNAME`) |

Upgrade each piece independently. You can run paying customers on a $40/month all-in trio once you outgrow the free tier.

### Option B — Single VPS with Docker Compose + Caddy (self-hosted)

One Linux box running everything, one domain (plus an `api.` subdomain), auto-HTTPS via Caddy. Flat ~$5-10/month. Matches the stack you already run locally, so there are no surprises between dev and prod.

**What you need before starting**

- A **domain** (e.g. `simulyn.ai`). Cloudflare / Namecheap / Porkbun all fine.
- A **VPS** with ≥ 4 GB RAM and Docker installed. Recommended: [Hetzner Cloud CX22](https://www.hetzner.com/cloud) (€4.51/mo, 2 vCPU, 4 GB, 40 GB SSD) or DigitalOcean droplet ($12/mo, 2 GB — bump to 4 GB if you see OOM).
- A **Groq API key** (free tier, no credit card) from [console.groq.com](https://console.groq.com). OpenAI / Anthropic keys also work — see [Hosted-provider recipes](#hosted-provider-recipes).

**Step 1 — Provision the VPS**

Create an Ubuntu 24.04 LTS box, SSH in as root, then:

```bash
# Create a non-root user (run everything below as simulyn, not root)
adduser simulyn && usermod -aG sudo simulyn
install -d -m 700 /home/simulyn/.ssh
cp ~/.ssh/authorized_keys /home/simulyn/.ssh/ && chown -R simulyn: /home/simulyn/.ssh

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker simulyn

# Basic firewall — allow SSH, HTTP, HTTPS only
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

# Unattended security updates
apt-get install -y unattended-upgrades && dpkg-reconfigure -f noninteractive unattended-upgrades
```

SSH out and back in as `simulyn` for the rest.

**Step 2 — Point DNS at the VPS**

Create two `A` records at your DNS provider, both pointing at the VPS IPv4 address:

| Host | Type | Value |
|---|---|---|
| `app` (or `@` for apex) | `A` | `<vps-ip>` |
| `api` | `A` | `<vps-ip>` |

Wait 1-5 min, confirm with `dig +short app.yourdomain.com`.

**Step 3 — Clone the repo and fill in secrets**

```bash
sudo mkdir -p /opt/simulyn && sudo chown simulyn: /opt/simulyn
cd /opt/simulyn
git clone https://github.com/<your-fork>/simulyn-ai.git .
cp deploy/.env.prod.example deploy/.env.prod
nano deploy/.env.prod    # fill in every CHANGE_ME
```

Minimum you must set:
- `SIMULYN_DOMAIN=app.yourdomain.com`
- `SIMULYN_API_DOMAIN=api.yourdomain.com`
- `PUBLIC_API_URL=https://api.yourdomain.com`
- `ACME_EMAIL=you@yourdomain.com`
- `POSTGRES_PASSWORD=$(openssl rand -base64 32)`
- `JWT_SIGNING_KEY=$(openssl rand -base64 48)`
- `PLATFORM_ADMIN_EMAILS=you@yourdomain.com`
- `OPENAI_API_KEY=gsk_...` (your Groq key) — the rest of the Groq block is pre-filled

**Step 4 — Build and start**

```bash
cd /opt/simulyn
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
```

First build takes ~5 min. Follow logs with `docker compose -f deploy/docker-compose.prod.yml logs -f`.

**Step 5 — Verify**

```bash
curl -sf https://api.yourdomain.com/healthz   # → {"status":"ok"}
curl -sf https://app.yourdomain.com           # → HTML
```

Open `https://app.yourdomain.com` in a browser:
1. Register your first user with the email you put in `PLATFORM_ADMIN_EMAILS` → automatic admin access.
2. Load sample project → open it → health brief generates in ~5s.
3. Ask Simulyn → "What's at risk this week?" → should answer through Groq.

**Step 6 — Set up nightly Postgres backups**

```bash
sudo tee /etc/cron.daily/simulyn-backup > /dev/null <<'EOF'
#!/bin/bash
set -e
BACKUP_DIR=/opt/simulyn/backups
mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%d-%H%M)
docker exec $(docker ps -qf name=db) pg_dump -U simulyn simulyn \
  | gzip > "$BACKUP_DIR/simulyn-$STAMP.sql.gz"
# Keep 14 days
find "$BACKUP_DIR" -name 'simulyn-*.sql.gz' -mtime +14 -delete
EOF
sudo chmod +x /etc/cron.daily/simulyn-backup
```

Test it: `sudo /etc/cron.daily/simulyn-backup && ls -lh /opt/simulyn/backups/`.

**Deploying updates**

```bash
cd /opt/simulyn
git pull
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
```

Zero-downtime-ish: Caddy and db stay up; web/api/ai restart in ~10s.

**Rolling back**

```bash
git log --oneline -10                # find the good commit
git checkout <sha>
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
```

### Option C — Railway (simplest managed, no SSH)

[Railway](https://railway.app) builds all services from your repo + provisions Postgres in one project. ~$5-20/month, no cold starts.

1. **New Project** → **Deploy from GitHub repo** → select `simulyn-ai`.
2. Add three services pointing at the Dockerfiles (`backend/`, `ai-service/`, `frontend/`) plus a **Postgres** plugin.
3. Set env vars (mirror `deploy/.env.prod.example`, or the Option A lists above). Railway exposes `${{Postgres.DATABASE_URL}}` in the `postgresql://` URL form — parse it into `Host=...;Port=...;Database=...;Username=...;Password=...;SSL Mode=Require` for the .NET `ConnectionStrings__Default`.
4. On the `frontend` service, set the build-time variable `NEXT_PUBLIC_API_URL` to the public URL of the `backend` service (find it under the service's **Settings → Networking**).
5. On the `backend` service, set `Frontend__Origin` to the public URL of the `frontend` service and `AiService__BaseUrl` to the internal URL of the `ai-service` (use Railway's internal DNS, e.g. `http://ai-service.railway.internal:8000`, for lower latency and no public exposure).
6. Done — Railway provisions HTTPS automatically on its generated `*.up.railway.app` domains, or attach your own custom domain with a one-click DNS setup.

### Production hardening checklist (do this before paying customers)

Regardless of which deploy option you pick:

- [ ] Generate a unique `JWT_SIGNING_KEY` (`openssl rand -base64 48`); never reuse the dev value.
- [ ] Generate a unique `POSTGRES_PASSWORD` (`openssl rand -base64 32`); never commit it.
- [ ] `.env.prod` is gitignored — double-check with `git status` before pushing.
- [ ] Nightly Postgres backups + a monthly restore drill (actually restore to a scratch DB).
- [ ] `SIMULYN_DOMAIN` / `Frontend__Origin` is your *exact* production origin (no wildcards, https only).
- [ ] API is HTTPS-only (Caddy handles this in Option B; Render / Vercel / Railway handle it automatically in Options A and C).
- [ ] `PLATFORM_ADMIN_EMAILS` is a small, controlled list.
- [ ] LLM provider has billing in place (Groq free tier fine for pilot; add billing before 10+ orgs or heavy usage).
- [ ] Per-org daily budget caps (`BUDGET_DAILY_LLM_USD_HARD`) are set — protects against runaway costs.
- [ ] Uptime monitor pinging `/healthz` every minute ([Better Stack](https://betterstack.com), UptimeRobot, etc.).
- [ ] Sentry DSN set on the .NET API (frontend + AI-service integration is on the Phase 1.5 list).
- [ ] Test the full register → load sample → predict → chat flow on the production URL **before** sending it to a customer.
- [ ] Rotate the Groq/OpenAI API key if it was ever shared in chat, screenshots, or commits.

## How predictions work (deterministic numbers + AI narrative)

Risk levels and delay-day numbers are always computed by a deterministic rule
engine — predictable, explainable, and auditable. The `summary` and
`recommendation` strings are written by an LLM when `OPENAI_API_KEY` or
`ANTHROPIC_API_KEY` is present; otherwise the service falls back to short
canned text so local dev and demos still work end-to-end.

`LLM_PROVIDER=auto` picks OpenAI if its key is set, then Anthropic, then off.
Confirm the active provider with `GET /health`:

```json
{ "status": "ok", "llm_provider": "openai", "openai_model": "gpt-4o-mini" }
```

> **Performance note:** per-task LLM calls run in parallel (capped at 5 in
> flight) inside the .NET `PredictionService`, so a 10-task project finishes
> in ~3–5s instead of 20s+. The .NET HTTP client timeout to the AI service
> is 30s.

## Talk to your projects (chat copilot)

Click **"Ask Simulyn"** (bottom-right of any authed page) to open the chat
drawer. Type a question in any language and the bot replies in the same
language using real data from your active organization.

Behind the scenes the .NET API runs an LLM tool-calling loop: the model picks
which of 10 read-only tools to call (`list_projects`, `get_project`,
`list_at_risk_tasks`, `list_recent_alerts`, `get_dashboard_summary`,
`get_risk_trend`, `list_organizations`, `list_org_members`, `get_task`,
`get_recent_predictions`), each tool runs in-process against EF Core, results
are fed back to the LLM, and a final natural-language reply is returned.

**Provider strategy** (matches the rest of the AI service):

- Hosted preferred — set `OPENAI_API_KEY` (recommended: `gpt-4o-mini`) or
  `ANTHROPIC_API_KEY` (recommended: `claude-3-5-haiku-latest`). Tool-calling
  is rock-solid on these.
- Local fallback — set `LLM_PROVIDER=ollama` and pull a model that supports
  tool-calling. `OLLAMA_CHAT_MODEL` now inherits `OLLAMA_MODEL` by default, so
  a single `OLLAMA_MODEL=llama3.2` wires up all three endpoints. For better
  chat quality, override with a larger tool-capable model: `ollama pull
  llama3.1:8b` (or `qwen2.5:7b`) and set `OLLAMA_CHAT_MODEL=llama3.1:8b`.
  Llama 3.2 (3B) works but will occasionally misuse tool arguments.
- If neither is configured the chat returns a friendly "AI not configured"
  message.

**Example prompts to try:**

- *"What's at risk this week?"*
- *"Status of Tower B"* (substring name match)
- *"Show me high-risk tasks across the org"*
- *"Give me a portfolio summary"*
- *"¿Qué tareas están en riesgo en Phase 2?"* — bot replies in Spanish
- *"मेरे सबसे बड़े प्रोजेक्ट में देरी क्यों हो रही है?"* — bot replies in Hindi

**Limits and safety:**

- **Read-only in v1.** No tool can create, edit, or delete data. If the user
  asks "delete project X", the bot explains that it can't and points them to
  the project page.
- **Multi-tenant.** Every tool starts by resolving the active org from the
  JWT — the LLM cannot leak data across orgs even if prompted to.
- **Rate-limited.** 20 chat requests per minute per user.
- **Loop-capped.** Max 6 tool-calls per turn — if the LLM gets greedy, the
  orchestrator forces a best-effort answer.
- **Local-only history.** Conversations live in `localStorage` per active
  organization; nothing is persisted server-side yet (planned).

## Excel schedule import

Upload a **`.xlsx`** workbook (first sheet is read). The first row must contain headers; required concepts:

| Concept | Example header names |
|---------|----------------------|
| Task name | `Task Name`, `Name`, `Activity`, `Task` |
| Start date | `Start Date`, `Start`, `Begin` |
| End date | `End Date`, `Finish`, `End` |
| Progress (optional) | `Progress`, `% Complete`, `Percent` |

Data rows below the header create tasks on the selected project. Dates may be Excel date cells or text (`yyyy-MM-dd` or locale formats).

**API:** `POST /api/projects/{id}/import-schedule` — `multipart/form-data` with field `file` (`.xlsx`).

## API summary

All endpoints except `/api/auth/*` and `/healthz` require JWT (`Authorization:
Bearer ...`). All tenant-scoped endpoints additionally honour the
**`X-Organization-Id`** request header (falls back to the user's first
membership if the header is missing or invalid).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register; auto-creates a personal org (Owner role) |
| POST | `/api/auth/login` | Login |
| GET | `/healthz` | API health (anonymous) |
| GET | `/api/me` | Current user + active org context (id, name, role, plan, entitlement) |
| GET | `/api/organizations` | List orgs the caller belongs to |
| POST | `/api/organizations` | Create org (caller becomes Owner) |
| GET | `/api/organizations/{id}` | Org detail (any member) |
| PUT | `/api/organizations/{id}` | Rename org (Admin/Owner) |
| DELETE | `/api/organizations/{id}` | Delete org (Owner; cannot delete your last org) |
| GET | `/api/organizations/{id}/members` | List members |
| POST | `/api/organizations/{id}/members` | Add member by email (Admin/Owner; Owner role grant requires Owner) |
| PUT | `/api/organizations/{id}/members/{userId}` | Change member role (Owner only) |
| DELETE | `/api/organizations/{id}/members/{userId}` | Remove member (Admin/Owner; self-removal allowed) |
| GET | `/api/projects` | List projects in active org |
| POST | `/api/projects` | Create project (Member+) |
| GET | `/api/projects/{id}` | Project detail |
| PUT | `/api/projects/{id}` | Rename / re-date project (Member+) |
| DELETE | `/api/projects/{id}` | Delete project (Admin+) |
| POST | `/api/projects/sample` | Seed a 12-task demo project + run predictions |
| POST | `/api/projects/{id}/import-schedule` | Upload `.xlsx` (auto-runs predictions on success) |
| GET | `/api/tasks/project/{projectId}` | List tasks |
| POST | `/api/tasks` | Create task (auto-runs prediction) |
| PUT | `/api/tasks/{id}` | Update task (re-runs prediction if progress changed) |
| DELETE | `/api/tasks/{id}` | Delete task |
| POST | `/api/predictions/run` | Body: `{ "taskId" }` or `{ "projectId" }`. Requires entitled org. |
| GET | `/api/projects/{id}/brief` | AI project health brief (headline + body + 0-100 score). Query `refresh=true` bypasses the 12h cache. Requires entitled org. |
| POST | `/api/simulation` | Body: `{ "projectId", "scenarioType", "config" }` (scenario-aware) or legacy `{ "projectId", "inputDelayDays" }` (treated as `UniformSlip`). Requires entitled org. |
| POST | `/api/simulation/compare` | Body: `{ "projectId", "scenarios": [...] }`. Runs up to 8 scenarios in parallel and persists each. Requires entitled org. |
| POST | `/api/simulation/auto-suggest?projectId={id}` | AI picks 3-4 scenarios worth running given the project's current state. Requires entitled org. |
| GET | `/api/dashboard/summary` | Totals + alert counts for active org |
| GET | `/api/dashboard/alerts` | Risk alerts (with AI reason + recommendation + deterministic "why" signal) for active org |
| GET | `/api/dashboard/weekly-recap` | AI weekly recap for active org (headline + 3-5 bullets). Query `refresh=true` bypasses the 12h in-memory cache. |
| GET | `/api/admin/organizations` | Platform admin: list orgs + billing |
| POST | `/api/admin/organizations/{orgId}/subscription` | Platform admin: set plan/status/expiry/notes |

## Manual invoice plans (no Stripe yet)

This repo supports "sale mode" without payment processing — useful for early pilots and enterprise contracts that pay by invoice.

- Every new **organization** starts with `SubscriptionStatus=Trial` for 30 days.
- Prediction and simulation endpoints require the active org to be *entitled* (`Trial` not expired, or `Active`).
- A platform admin can flip an org to `Active` / `Suspended` / `Inactive` and adjust expiry / notes via `POST /api/admin/organizations/{orgId}/subscription` (or the `/admin/billing` UI).
- Plan names (`Starter` / `Pro` / `Enterprise`) are free-form today; quota enforcement per plan is on the roadmap (see Phase 1 → Stripe).

### Bootstrap a platform admin

Set environment variable `PlatformAdminEmails` (comma-separated) to at least one admin email **before** that user registers. They will be created with `IsPlatformAdmin=true` and gain access to `/api/admin/*` endpoints. This flag is independent of any organization role — a platform admin can administer billing for orgs they aren't a member of.

## Roadmap to a sellable SaaS

The product is **demo-ready and tenant-isolated** today. The list below is the honest gap between *"impressive demo"* and *"a customer will pay you and not churn"*. Items are grouped into phases you can ship sequentially. Each item is sized for one to two engineer-weeks unless noted.

### Phase 1 — Make the first paying customer possible (8–12 weeks)

Every item here is a hard blocker for a B2B sale, in priority order.

- [x] **Email notifications + weekly look-ahead PDF report.** *The killer feature this whole stack was built to enable.* Shipped — High-risk crossover alerts fire from `PredictionService` (dedup'd per task per day); `WeeklyRecapScheduler` dispatches a PDF-ready recap every Monday 06:00 UTC (per-org timezone upgrade is Phase 2). PDF rendering via QuestPDF; email dispatch via `IEmailSender` with Resend driver + Console fallback, so it works in local dev with zero setup. Per-user `NotificationPreference` lets Members opt out.
- [x] **Stripe self-serve checkout + plan-limit enforcement per org.** Shipped — `POST /api/billing/checkout` creates a Stripe Checkout session, `POST /api/billing/webhook` activates/suspends the org on `checkout.session.completed` / `customer.subscription.*`. Plan→Price IDs configured via `Stripe:Prices:*`. Manual-invoice admin path remains for enterprise.
- [x] **Tokenised email invite for non-existing users.** Shipped — `POST /api/organizations/{id}/members` for an unknown email issues an `EmailToken` and sends a `/register?token=...&email=...` link. `POST /api/auth/register` accepts an `inviteToken` and places the new user in the inviting org in one step.
- [x] **Password reset + email verification.** Password reset shipped — `POST /api/auth/request-password-reset` + `POST /api/auth/reset-password`, BCrypt-hashed tokens, 1-hour TTL, enumeration-proof. Email verification is still Phase 2 (trial account creation is currently trust-on-first-use).
- [x] **Automated test suite + CI.** Shipped — `backend/Simulyn.Api.Tests` (xUnit, 17 tests) covers billing entitlement, email token lifecycle, scenario math per scenario type, and tenant isolation. `ai-service/tests/` (pytest, 8 tests) covers the rule engine, deterministic fallback, and the HTTP surface via `TestClient`. `.github/workflows/ci.yml` runs all three services on every push / PR.
- [ ] **Refresh-token flow + HttpOnly cookies.** *Deferred to Phase 1.5 — deliberately held back so we don't destabilise auth right before the first pilot.* Current login still returns a bearer token the browser stores in `localStorage`. Land this the week after pilot #1 signs, before you ever take a credit card from a stranger.
- [x] **Privacy Policy + Terms of Service + Cookie banner.** Shipped — `/privacy` + `/terms` page templates (flagged clearly as placeholders — swap for legal-reviewed copy before paid customers) and `CookieBanner` component wired into the root layout with accept-all / essential-only consent tiers.
- [x] **Rate limits + daily LLM budget cap.** Shipped — `predictions` (60/min/user) and `simulation` (10/min/user) policies in addition to the existing `auth` + `chat`. `BudgetGuard` blocks expensive endpoints once the org crosses `Budget:HardCapMills` (default $20/day); `UsageService` records every LLM call. `GET /api/billing/budget` exposes the current usage + caps so the UI can warn early.
- [x] **Serilog JSON + Sentry.** Shipped — structured JSON logs to stdout (compact-JSON format, picked up by Render/Railway/Azure/Loki). Sentry is wired behind `Sentry:Dsn` — set the env var to turn it on, leave it unset for dev.

### Phase 1.5 — Post-pilot housekeeping (1–2 weeks after first pilot signs)

Deliberately held back from Phase 1 so we didn't destabilise auth right before the first demo. Land these in the week after pilot #1 signs, before you ever take a credit card from a stranger on the internet.

- [ ] **HttpOnly cookie refresh-token flow.** Stop storing JWTs in `localStorage`. Short-lived (15 min) access token + rotating refresh token in `HttpOnly + Secure + SameSite=Lax` cookies. Closes the most common XSS-to-account-takeover path.
- [ ] **Email verification before predictions unlock.** Password reset already ships; email verification on register is still Phase 1.5. Token + email link, 24-hour expiry. Gate prediction/simulation endpoints until verified.
- [ ] **Wire landing-page pricing to the live Stripe checkout.** `POST /api/billing/checkout` is live with plan → Price ID mapping; the landing page still hard-codes `$199 / project / month`. Swap the **Start Free Trial** / **Book a demo** CTAs to call the endpoint with real Price IDs.
- [ ] **Swap `/privacy` + `/terms` template copy for legal-reviewed wording.** Routes ship, content is placeholder — use Termly / iubenda / a real lawyer before paid customers.
- [ ] **Replace `hello@simulyn.ai` placeholder mailto with a real, monitored inbox.** It's on the landing page and in both legal templates.
- [ ] **Uptime monitor.** Better Stack or Pingdom free tier, pinging `/healthz` on the API and `/health` on the AI service every 60s with paging on failure.
- [ ] **Sentry for ai-service and frontend.** .NET API already ships with Sentry behind `Sentry__Dsn`. Add `sentry-sdk[fastapi]` in `ai-service/requirements.txt` + `@sentry/nextjs` in `frontend/package.json` so errors in all three services land in one project.

### Phase 2 — Win mid-size GC deals (6–10 weeks)

These unlock the customers who'll actually pay $500–$2000/month per org.

- [ ] **⭐ Cost overrun prediction (highest ROI feature on this list).** Today we predict time (delay days); we do **not** predict money. In construction, cost is everything. Minimum version (1–2 weeks of work, not a research project):
    - **Data:** add `Project.DailyCostRate` (decimal, USD/day, defaults to 0 — feature hides in the UI when unset) and an optional per-trade override on `ProjectTask.DailyCostRate` so complex sites can price concrete and finishes differently. Plus a `CrewCost` field on the `AddResource` scenario config.
    - **Model:** `projectedCostOverrunUsd = maxPredictedDelayDays × Project.DailyCostRate`. Per-scenario: `scenarioCostDeltaUsd = scenario.PredictedDelayDays × DailyCostRate − scenario.AddedCrewCost`. No LLM in the math path — this is pure arithmetic, auditable by any finance team.
    - **UI — project brief:** new chip next to the 0–100 health score: **"Potential cost overrun: $25,000"** coloured by magnitude (< $10k green, $10k–$100k amber, > $100k red).
    - **UI — scenario comparison table:** new **Cost impact** column between **Predicted delay** and **Narrative**. Renders `+$30,000` red for overruns, `−$22,000` green for savings. For `AddResource` scenarios it shows the net: *"Adding 2 crew costs $8k but saves $30k → net **−$22,000**."*
    - **UI — weekly recap email:** one new line at the top: *"Portfolio exposure this week: $147k potential overrun across 3 projects."* — **this is the single bullet that gets the CFO to actually open the email.**
    - **Why this is Phase 2 and not Phase 3:** GCs quote and lose jobs on dollar impact, not day impact. A PM who has to mentally multiply "14 days delay × ~$15k/day ≈ $210k" is one click away from asking a competitor to do the math for them. Ship this **before** any of the flashier AI items below — it's the single highest-leverage feature you haven't built yet.
- [ ] **P6 (`.xer`) import.** Parse Primavera P6 exports — the format every serious PM uses. Map activities → tasks, calendars → working days, WBS → project structure. There's no good open-source library; expect to read the [.xer spec](https://docs.oracle.com/cd/F25600_01/English/Mapping_and_Schema/p6_eppm_db_schema/) and write a hand-rolled tokenizer.
- [ ] **MS Project import (`.mpp` and `.xml`).** Use [MPXJ](http://mpxj.org/) (Java) via a tiny sidecar service, or the simpler `.xml` (MSPDI) format if you can ask customers to "Save As XML". Most contractors have this file before they have anything else.
- [ ] **Task dependencies (predecessor / successor) + real critical-path analysis.** Without dependencies, what-if simulation is not a real CPM analysis and any scheduler will dismiss the product after 30 seconds. Add `TaskDependency { PredecessorId, SuccessorId, Type: FS|SS|FF|SF, LagDays }`. Re-implement simulation to propagate delays through the graph.
- [ ] **Gantt chart visualization** (frtl-gantt, dhtmlx-gantt, or [bryntum](https://bryntum.com)). The single most expected feature in any project-management tool — lack of it makes the product look like a toy.
- [ ] **Audit log.** Persistent record of who did what (plan change, member added/removed, project deleted, billing edit). Required by enterprise IT review checklists.
- [ ] **Mobile-friendly site supervisor view (or PWA).** The data is captured on a desktop in the office but consumed on a phone in the field. Read-only mobile view of today's tasks + risks is enough for v1.

### Phase 3 — Differentiation (10–16 weeks)

These are how you stop being "one of many PM tools" and start being *the* construction-AI tool.

- [ ] **Real ML model trained on historical schedules.** Today's "AI" is a rule engine + LLM narrative. Train an actual delay-prediction model on the customer's own past projects (XGBoost on activity features is a fine v1). Surface model confidence on the prediction.
- [ ] **Photo upload + LLM vision for site progress detection.** Site supervisor snaps a phone photo → GPT-4o or Claude vision returns "Foundation 60% complete, formwork visible, no rebar in frame yet". Auto-update `Task.Progress`. *This is the moonshot demo.*
- [x] **Natural language Q&A over the project.** ✓ Shipped as the "Ask Simulyn" chat copilot — multilingual, LLM tool-calling against 10 read-only org-scoped APIs. See "Talk to your projects" above. *Next step: write actions (create task, run prediction) gated behind explicit confirm UI.*
- [ ] **Procore / Autodesk Construction Cloud / Microsoft Project Online integration.** Every customer asks "does it integrate with Procore?". OAuth + read tasks + write status updates. Procore has a partner program — apply for it.
- [ ] **Two-way schedule sync** (not just one-shot import). Webhook from P6/MSP → re-run predictions automatically.

### Phase 4 — Scale, security, compliance (8–12 weeks)

Required before enterprise (>$50k/year) deals.

- [x] **Sentry + structured Serilog → JSON** on the .NET API. Uptime monitor (Better Stack / Pingdom) still TODO.
- [x] **Rate limiting beyond `/api/auth/*`** — predictions and simulation shipped in Phase 1 rollup. Excel import next.
- [x] **Per-org per-day prediction budget cap** — `BudgetGuard` + `UsageService`; configurable via `Budget:SoftCapMills` / `Budget:HardCapMills`.
- [ ] **GDPR data export + delete-my-account / delete-my-organization** endpoints.
- [ ] **Backups + restore drill.** Nightly Postgres dump + monthly restore-into-staging test.
- [ ] **HSTS + CSP headers + secure cookie flags** on the frontend.
- [ ] **SSO / SAML** via [WorkOS](https://workos.com) or [Auth0](https://auth0.com) for enterprise IT.
- [ ] **SOC 2 Type 1 prep** — at minimum, [Vanta](https://vanta.com) or [Drata](https://drata.com) tracking the controls. Type 2 needs 6 months of evidence.
- [ ] **Postgres connection pooling** (PgBouncer) once you cross ~50 active orgs.

### Phase 5 — Go-to-market (run in parallel with phase 1)

Software readiness ≠ business readiness. None of this is code, but skipping it is why most B2B SaaS products with great tech die.

- [ ] **3–5 design partner pilots.** Real construction PMs using the product on real projects, in exchange for half-price-or-free for 6 months and case-study rights.
- [ ] **One published case study** with named customer, real numbers ("cut Monday-morning report from 3hr to 5min").
- [ ] **One niche-specific landing page** per construction sub-vertical (commercial GCs, civil/infra, MEP subs). Same product, different headline + screenshots.
- [ ] **Pricing page that matches what's in Stripe.** Today the pricing on `/` is hard-coded; wire it to your actual Stripe products.
- [ ] **Sales-grade demo environment.** A long-lived org pre-loaded with a 6-month construction program, populated history, and a fake "previous Monday" report for "look what you would have got" demos.
- [ ] **Onboarding email sequence** (day 0, 1, 3, 7, 14) with a video at each step.
- [ ] **Public changelog** (`/changelog`) so existing customers see momentum.

### Phase 6 — Already done ✓

For completeness, here's what's no longer in the gap list:

- ✓ **Multi-tenancy** with Organizations + Members + 4 roles (Owner / Admin / Member / Viewer), tenant-isolated projects/tasks/predictions/billing, X-Organization-Id header, org switcher in the UI, organization & member management pages.
- ✓ **Real LLM integration** (OpenAI + Anthropic + local Ollama, auto-detected, with deterministic fallback) for narrative and recommendations.
- ✓ **Multilingual chat copilot ("Ask Simulyn")** — LLM tool-calling against 10 read-only org-scoped APIs. Floating launcher in the shell, slide-out drawer, localStorage history per org, hosted-or-Ollama hybrid provider strategy.
- ✓ Per-task AI summary + recommendations rendered in the UI.
- ✓ Public marketing landing page at `/`.
- ✓ "Load sample project" → 12-task realistic construction project + auto-run predictions.
- ✓ Auto-run predictions after task creation, progress edits, and Excel imports.
- ✓ Project rename, per-task re-run, task delete.
- ✓ Basic rate limiting (10/min/IP) on `/api/auth/*`.
- ✓ `/healthz` (.NET) + `/health` (FastAPI) endpoints.
- ✓ Parallelised LLM calls (capped at 5 concurrent) keep multi-task predictions fast.
- ✓ Auto-provisioned personal workspace + 30-day trial on register.
- ✓ Manual-invoice billing path via platform admin.
- ✓ Excel `.xlsx` schedule import with auto-prediction.

### Phase 7 — AI narrative + multi-scenario simulator (May 2026) ✓

A focused upgrade that moves the product from "show me a number" to "show me a story and let me stress-test it":

- ✓ **AI project health brief** (Phase 1A) — every project page opens with a one-line headline, 2-3 sentence narrative, and a 0–100 health score. The score is computed deterministically from risk mix + progress-vs-window gap + schedule cushion; the LLM only narrates. Cached per-project for 12h (`GET /api/projects/{id}/brief?refresh=true`). See `backend/Simulyn.Api/Controllers/ProjectsController.cs#GetBrief` and `frontend/components/widgets/ProjectHealthBrief.tsx`.
- ✓ **AI weekly recap** (Phase 1B) on the dashboard — short headline + 3-5 collapsible bullets across the whole org, cached in-memory per-org for 12h (`GET /api/dashboard/weekly-recap?refresh=true`). Includes 7-day high-risk delta in the payload so the LLM can say *"up vs last week"* grounded in numbers.
- ✓ **Upgraded alerts** (Phase 1C) — `AlertsWidget` on the dashboard shows task name + AI reason + **Show plan** (expandable recommendation) + **Why?** tooltip with the deterministic "expected vs actual %" math behind the risk call.
- ✓ **Prediction delta pills** (Phase 2A) — `TaskDto` now carries the second-most-recent prediction's risk/delay/timestamp, so the project task table renders `Medium→High` / `Risk improved` / `+3d vs last` pills whenever a re-run shifts the numbers.
- ✓ **Five scenario types of what-if** (Phase 3A) — `UniformSlip`, `SingleTaskSlip`, `AddResource`, `WeatherPause`, `ScopeReduction`. Per-type deterministic math lives in `backend/Simulyn.Api/Models/Scenarios/ScenarioMath.cs`; the AI service `/simulate` takes the pre-computed delta + signals and writes trade-aware narrative. Legacy single-delay payloads are still accepted and treated as `UniformSlip` for back-compat.
- ✓ **Side-by-side comparison** (Phase 3B) — `POST /api/simulation/compare` runs up to 8 scenarios in parallel; the redesigned `/simulation` page has a project picker, scenario chips to build a queue, inline config per type, and a comparison table coloured by direction (positive days red, negative green).
- ✓ **Auto-suggest scenarios** (Phase 3C) — `POST /api/simulation/auto-suggest?projectId=...` asks the AI which 3-4 scenarios are worth running right now given the project's risk/progress state. Surfaced both as a **Suggest scenarios** button on `/simulation` and as a **Show me what could go wrong** CTA on every project's health brief card (deep-links to `/simulation?projectId=...&suggest=1`).
- ✓ **DB schema** — migration `20260503110826_AddProjectBriefAndScenarioColumns` adds `ProjectBriefs` (one row per project, upserted on refresh) and `Simulations.ScenarioType` / `ScenarioConfig` (jsonb) / `Headline` columns. Legacy `UniformSlip` rows from before the migration are left untouched — the `DEFAULT 'UniformSlip'` on `ScenarioType` means they still render correctly.

---

## Pending work at a glance

The authoritative view of what's *not* yet shipped, in rough priority order. Every item links back to its detailed spec in the phase sections above. A checked box here means the line item is fully shipped and verified; anything unchecked is explicitly open work.

### Phase 1 — First paying customer (8 of 9 shipped)

- [ ] HttpOnly cookie refresh-token flow *(moved to Phase 1.5 — deliberate hold)*

### Phase 1.5 — Post-pilot housekeeping (0 of 7 shipped)

- [ ] HttpOnly cookie refresh-token flow
- [ ] Email verification before predictions unlock
- [ ] Wire landing-page pricing CTAs to live Stripe checkout
- [ ] Swap `/privacy` + `/terms` template copy for legal-reviewed wording
- [ ] Replace `hello@simulyn.ai` placeholder mailto
- [ ] Uptime monitor (Better Stack / Pingdom)
- [ ] Sentry for ai-service (`sentry-sdk[fastapi]`) and frontend (`@sentry/nextjs`)

### Phase 2 — Win mid-size GC deals (0 of 7 shipped)

- [ ] ⭐ **Cost overrun prediction** — `Project.DailyCostRate`, `Task.DailyCostRate` override, `AddResource.CrewCost`. Surfaces dollar impact on project brief, scenario comparison, and weekly recap email. *Highest-ROI unshipped feature — see Phase 2 spec.*
- [ ] Primavera P6 (`.xer`) import
- [ ] MS Project (`.mpp` / `.xml`) import
- [ ] Task dependencies (FS/SS/FF/SF) + real critical-path analysis
- [ ] Gantt chart visualisation
- [ ] Audit log
- [ ] Mobile-friendly site supervisor view / PWA

### Phase 3 — Differentiation (1 of 5 shipped)

- [x] Natural-language Q&A ("Ask Simulyn" chat copilot)
- [ ] Real ML delay-prediction model trained on historical schedules
- [ ] Photo upload + LLM vision for site-progress detection
- [ ] Procore / Autodesk Construction Cloud / MS Project Online integration
- [ ] Two-way schedule sync (webhooks → re-run predictions)

### Phase 4 — Scale, security, compliance (3 of 9 shipped)

- [x] Sentry + structured Serilog JSON logs on .NET API
- [x] Rate limiting on predictions + simulation
- [x] Per-org daily LLM budget cap
- [ ] GDPR data export + delete-my-account / delete-my-organization endpoints
- [ ] Nightly Postgres backups + monthly restore drill
- [ ] HSTS + CSP + secure cookie flags on the frontend
- [ ] SSO / SAML (WorkOS / Auth0) for enterprise IT
- [ ] SOC 2 Type 1 prep (Vanta / Drata tracking controls)
- [ ] PgBouncer connection pooling at ~50+ active orgs

### Phase 5 — Go-to-market (0 of 7 shipped, non-code)

- [ ] 3–5 design-partner pilots
- [ ] 1 published case study with named customer + real numbers
- [ ] Niche-specific landing pages (commercial GC / civil / MEP)
- [ ] Pricing page wired end-to-end through Stripe
- [ ] Sales-grade demo environment (long-lived org, 6-month history, fake "last Monday" report)
- [ ] Onboarding email sequence (day 0, 1, 3, 7, 14)
- [ ] Public `/changelog` page

### Summary by phase

| Phase | Shipped | Pending | Unlocks |
|---|---|---|---|
| 1 | 8 of 9 | 1 | First pilot can go live |
| 1.5 | 0 of 7 | 7 | First paying customer (non-friend) |
| 2 | 0 of 7 | 7 | $500–$2k/mo mid-size GC deals |
| 3 | 1 of 5 | 4 | Premium pricing, press coverage |
| 4 | 3 of 9 | 6 | Enterprise (> $50k/yr) deals |
| 5 | 0 of 7 | 7 | Actual revenue, not just signups |
| 6 | ✓ complete | — | *Historical baseline* |
| 7 | ✓ complete | — | *May 2026 — AI narrative + multi-scenario* |

**Demo + pilot-sign-up: ready now.** **Paid customer-proof: ship Phase 1.5 + start on Phase 2.** **Enterprise-proof: all of Phase 4.**

---

## Migration notes (multi-tenancy upgrade)

The migration `20260502090000_AddOrganizationsAndMultiTenancy` is **data-preserving**:

- Each existing user is given a personal organization called
  `"<User Name>'s workspace"` and added as **Owner**.
- Each user's old billing fields (`Plan`, `SubscriptionStatus`, etc.) are
  copied onto their new personal org, with `Trial` defaults filled in.
- Each existing project is moved from `Project.UserId` onto
  `Project.OrganizationId` (its old owner's new org), and `Project.UserId`
  is renamed to `Project.CreatedByUserId` for audit.
- The migration uses `pgcrypto.gen_random_uuid()` (auto-enabled) to mint org
  IDs, so it works on a fresh Postgres 13+ install with no manual setup.

If you're on a fresh database, the migration is a no-op for the backfill
section and just creates the new tables.
