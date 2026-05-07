# Simulyn AI

> **Predict. Explain. Act.**
> The construction risk co-pilot. Score every task, read the weekly look-ahead
> the AI wrote for you, and stress-test the plan against five what-if scenarios
> — side by side — before the site meeting.

Multi-tenant SaaS for construction teams: organizations and roles, project and
task tracking, deterministic risk scoring, **LLM-powered AI explanations and
trade-aware mitigations**, **AI project health briefs and weekly recaps**,
**five scenario types of what-if simulation with side-by-side comparison**,
Excel schedule import, and a dashboard with alerts.

> **Quick start:** see [Run locally](#run-locally).

## Table of contents

1. [What's new (May 2026)](#whats-new-may-2026)
2. [Product positioning](#product-positioning)
3. [Multi-tenancy & roles](#multi-tenancy--roles)
4. [Run locally](#run-locally)
5. [End-to-end demo flow](#end-to-end-demo-flow)
6. [Repository layout](#repository-layout)
7. [Configuration reference](#configuration-reference)
8. [Deploy to the cloud](#deploy-to-the-cloud)
9. [How predictions work](#how-predictions-work)
10. [Chat copilot ("Ask Simulyn")](#chat-copilot-ask-simulyn)
11. [Excel schedule import](#excel-schedule-import)
12. [API summary](#api-summary)
13. [Billing model](#billing-model)
14. [Roadmap](#roadmap)
15. [Migration notes](#migration-notes)

---

## What's new (May 2026)

The latest release moves Simulyn from *"show me a number"* to *"show me a story
and let me stress-test it"* — and closes the remaining blockers between demo
and a paid pilot. Walk through it in [End-to-end demo flow](#end-to-end-demo-flow).

### AI narrative + multi-scenario simulator

- **AI project health brief** at the top of every project — one-line headline,
  2-3 sentence trade-aware body, 0-100 health score chip. Cached 12h; **Refresh**
  regenerates.
- **AI weekly recap** at the top of the dashboard — headline + 3-5 collapsible
  bullets across the whole org, with a 7-day high-risk delta in the prompt so
  the LLM can say *"up vs last week"* truthfully.
- **Upgraded alerts widget** — AI reason, expandable **Show plan**, and a
  **Why?** tooltip exposing the deterministic expected-vs-actual math.
- **Prediction delta pills** — `Medium→High`, `Risk improved`, `+3d vs last`
  whenever a re-run shifts the numbers.
- **Five scenario types** of what-if — `UniformSlip`, `SingleTaskSlip`,
  `AddResource`, `WeatherPause`, `ScopeReduction`. Each has its own
  deterministic math and narrative flavour.
- **Side-by-side comparison** — queue up to 8 scenarios, run in parallel, read
  the impact column coloured by direction (positive red, negative green).
- **Auto-suggest scenarios** — one click asks the AI which 3-4 scenarios are
  worth running *right now*. Deep-linked from the project brief as **"Show me
  what could go wrong"**.

### Pilot-readiness

- **Email infrastructure** — `IEmailSender` with a Resend driver and a Console
  fallback. Zero config locally (emails print to stdout); drop in a Resend key
  in prod.
- **Password reset** + **tokenised invite flow** — `/forgot-password` /
  `/reset-password` and `/register?token=...` for inviting users who don't yet
  have an account. BCrypt-hashed tokens; 1h / 7-day TTLs.
- **High-risk email alerts** — fired when a task crosses Low/Medium → High,
  dedup'd per `(task, UTC date)`, respects `NotificationPreference`.
- **Weekly PDF recap** — a hosted `BackgroundService` wakes Mondays 06:00–08:00
  UTC and emails every org a one-page PDF (rendered by QuestPDF).
- **Stripe self-serve** — `POST /api/billing/checkout` + `POST /api/billing/webhook`
  flip `SubscriptionStatus` on the relevant Stripe events. Manual-invoice admin
  path is untouched.
- **Rate limits** — `predictions` (60/min/user), `simulation` (10/min/user) on
  top of existing `auth` (10/min/IP) and `chat` (20/min/user).
- **Per-org daily LLM budget guardrail** — `BudgetGuard` returns 429 past the
  hard cap. Defaults: warn at $5/day, block at $20/day.
- **Structured logging + Sentry wiring** — Serilog compact-JSON to stdout;
  Sentry opt-in via `Sentry:Dsn`.
- **Privacy / Terms / Cookie banner** — `/privacy`, `/terms`, and a
  `CookieBanner` wired into the root layout (template copy — replace before paid GTM).
- **Automated tests + CI** — 17 xUnit tests on the API, 8 pytest tests on the
  AI service, and `.github/workflows/ci.yml` runs all three services on every
  push/PR.

### Local smoke test after `git pull`

```powershell
cd backend/Simulyn.Api.Tests && dotnet test         # 17 tests
cd ../../ai-service && python -m pytest -q          # 8 tests
cd ../frontend && npx tsc --noEmit && npm run build # clean build
```

### What's still pending

The full open-items list lives in [Roadmap](#roadmap). Highlights:

- **Phase 1.5** (post-pilot) — HttpOnly cookie refresh flow, email verification,
  legal copy swap, live Stripe wiring on the landing page, uptime monitor,
  Sentry for ai-service + frontend, real contact mailto.
- **Phase 2** — ⭐ cost overrun prediction, P6 / MS Project import, task
  dependencies + real CPM, Gantt chart, audit log, mobile PWA.
- **Phase 3** — real ML model, photo+vision progress detection, Procore / ACC /
  MSP Online integration, two-way schedule sync.
- **Phase 4** — GDPR endpoints, nightly backups + restore drill, HSTS+CSP,
  SSO/SAML, SOC 2 prep, PgBouncer.
- **Phase 5** (non-code) — design-partner pilots, case study, niche landing
  pages, live pricing, sales-grade demo environment, onboarding emails, public
  changelog.

---

## Product positioning

The public marketing page at `/` (source: `frontend/app/page.tsx`) is the
single source of truth for how Simulyn is described externally. Keep in-app
copy, README, and sales conversations in sync with the language below.

### Core positioning

| | |
|---|---|
| **Product category** | Construction Decision Intelligence |
| **Positioning line** | The construction risk co-pilot |
| **Tagline** | **Predict. Explain. Act.** |
| **Hero promise** | Spot delays before they happen, understand *why*, and fix them in minutes—not after they cost you weeks. |
| **Trust line** | No credit card required · Results in under 60 seconds · Works with Excel schedules |
| **Closing CTA** | Stop reacting to delays. **Start preventing them.** |

### Three pillars (always in this order)

1. **Predict** — deterministic risk scoring, delay-day estimates, health score.
2. **Explain** — AI project health brief, weekly look-ahead, per-task reasons,
   plain-English alerts with a *Why?* tooltip.
3. **Act** — five what-if scenarios, side-by-side comparison, auto-suggest,
   trade-aware recommendations.

### Landing page sections (top to bottom)

When editing `frontend/app/page.tsx`, keep this order:

| # | Section | Anchor | Role |
|---|---------|--------|------|
| 1 | Header (sticky) | — | Nav: Features / See it in action / Pricing + Log in / Get started |
| 2 | Hero | — | Positioning + tagline + hero promise + two CTAs + mini dashboard preview |
| 3 | Social proof | — | One-line strip for modern construction teams |
| 4 | Problem | — | *Construction delays don't happen overnight* + 4 pain bullets |
| 5 | Solution | — | *Meet Simulyn AI* + 4 value bullets |
| 6 | Core features | `#features` | Health Brief · Weekly Look-Ahead · What-If Simulation Engine |
| 7 | Supporting features | — | Top Risk Alerts · Auto-Suggest · Prediction Delta · Excel Import · AI Copilot |
| 8 | How it works | — | Upload → Analyze → Take action |
| 9 | See it in action | `#demo` | Mockups (target of "View demo" CTA) |
| 10 | Who it's for | — | PMs · Contractors · Planning teams · Mid-size+ companies |
| 11 | Pricing | `#pricing` | Starter (Free 30d) · Pro ($199/proj/mo) · Enterprise (Custom) |
| 12 | Trust & security | — | Multi-tenant · Org isolation · RBAC |
| 13 | Final CTA | — | *Stop reacting to delays. Start preventing them.* |
| 14 | Footer | — | Product · Pricing · Contact · Privacy · Terms |

### Copy rules

- **Never** call the product *"a dashboard"* — it's a *decision intelligence platform* / *risk co-pilot*. The subtext of the whole page is *"answers, not dashboards."*
- **Never** say *"AI predicts delays."* Say **"spot delays before they happen"**.
- **Always** lead with outcomes (weeks saved, Sunday reports gone), not features (LLM, deterministic fallback).
- **Feature names that must stay consistent** across landing / app / docs: *AI Project Health Brief*, *Weekly Look-Ahead*, *What-If Simulation Engine*, *Top Risk Alerts*, *Auto-Suggest Scenarios*, *Prediction Delta*, *AI Copilot (Ask Simulyn)*. When renaming, update all three surfaces in the same PR.
- **Audience wording** stays literal and B2B: *Construction Project Managers*, *Contractors & Site Engineers*, *Planning & Scheduling Teams*, *Mid-size to large construction companies*.

### Landing-page placeholders to replace before paid GTM

- [x] `/privacy` and `/terms` **routes** ship — content is template copy; replace via Termly / iubenda / GetTerms before taking payment.
- [x] `CookieBanner.tsx` wired into root layout (accept-all / essential-only).
- [x] Pricing wired to Stripe — `POST /api/billing/checkout` is live; landing-page CTAs still hard-coded — wire **Start Free Trial** / **Book a demo** to the API once you have real Price IDs.
- [ ] Real `mailto:` Contact address (currently `hello@simulyn.ai`).
- [ ] Recorded demo video or `/demo` page (today buttons anchor-scroll to `#demo` mockups).
- [ ] Real pilot customer testimonials. The page ships *no* testimonials by design; do not re-add fictional ones.

---

## Multi-tenancy & roles

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

---

## Run locally

Four components: PostgreSQL, the .NET API, the FastAPI AI service, and the
Next.js frontend. The fastest path is **Docker Compose** (one command).

### Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download) (manual run + migrations)
- [Node.js 20+](https://nodejs.org/) (frontend)
- [Python 3.11+](https://www.python.org) (AI microservice)
- [PostgreSQL 15+](https://www.postgresql.org/) (or use Docker Compose)
- [Docker Desktop](https://www.docker.com/) (recommended)

### Option A — Docker Compose (recommended)

```powershell
# 1. (Optional) enable real LLM — pick one provider:
"OPENAI_API_KEY=sk-..." | Out-File -Encoding utf8 .env
# or
"ANTHROPIC_API_KEY=sk-ant-..." | Out-File -Encoding utf8 .env
# (skip entirely to demo with the deterministic rule-engine fallback)

# 2. Bring up the whole stack
docker compose up --build
```

Services brought up by Compose:

| Service | Port (host) | Notes |
|---------|-------------|--------|
| `db` | 5432 | PostgreSQL 16, user/db/password `simulyn` |
| `ai` | 8000 | FastAPI |
| `api` | 5000 | .NET API (container listens on 8080) |
| `web` | 3000 | Next.js (`NEXT_PUBLIC_API_URL=http://localhost:5000`) |

When you see *"Now listening on: http://[::]:8080"* from `api` and *"Ready in"*
from `web`, the stack is live. Verify in this order:

| # | Check | URL or command | Expected |
|---|-------|-----------------|----------|
| 1 | AI service health | http://localhost:8000/health | `{"status":"ok","llm_provider":"openai"\|"anthropic"\|"off",...}` |
| 2 | API health | http://localhost:5000/healthz | `{"status":"ok","service":"simulyn.api"}` |
| 3 | Swagger | http://localhost:5000/swagger | API explorer loads |
| 4 | Landing page | http://localhost:3000 | Marketing page with "Start 30-day free trial" CTA |
| 5 | Register | http://localhost:3000/register | Account → personal workspace auto-created → you're its **Owner** → redirected to dashboard |
| 6 | Org switcher | Top-right of the Nav | Shows current org + role badge |
| 7 | Sample project | **Load sample project** on the empty dashboard | 12-task project + auto-run predictions |
| 8 | AI insight | Click any task name | "AI summary" + "Recommended actions" expand |
| 9 | What-if | http://localhost:3000/simulation | Pick demo project, click `Uniform slip` chip, set days, **Run simulation** |
| 10 | Multi-tenancy | http://localhost:3000/organizations | Create "Acme Construction"; switch via Nav; demo project not visible (isolation) |
| 11 | Member invite | `/organizations/<id>` | Register a second account in another browser, invite as **Member** |
| 12 | Admin billing | http://localhost:3000/admin/billing | (As `PlatformAdminEmails` user) Manage org plan/status |

> **Tip:** to make yourself a platform admin, set `PlatformAdminEmails` in
> `docker-compose.yml` to the email you'll register with **before** signing up.
> Default in the compose file is `devadmin@example.com`.

To stop:

```powershell
docker compose down            # stop containers, keep DB volume
docker compose down -v         # also wipe Postgres data
```

> **Production:** replace `Jwt__Key` in `docker-compose.yml`, use secrets for
> the DB password, and do not expose Postgres publicly.

### Option B — Manual run (no Docker)

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
# ConnectionStrings:Default in appsettings.json points at local Postgres
dotnet restore
dotnet run
# verify:  curl http://localhost:5000/healthz
# Swagger: http://localhost:5000/swagger
```

The API auto-applies EF Core migrations on startup (`Database.MigrateAsync()`),
so the schema is created the first time you run it.

**Terminal 3 — Frontend**:

```powershell
cd frontend
copy .env.local.example .env.local
npm install
npm run dev
# open http://localhost:3000
```

Then walk through steps 4–12 from the verify table above.

### What you should see

- `http://localhost:3000` lands on a real marketing page (not a login form).
- After registering, the dashboard is empty with a **Load sample project** button.
- Clicking it creates a realistic 12-task construction project and runs AI
  predictions in parallel — typically 3–5 seconds.
- Every task shows a Risk pill (Low / Medium / High) and an estimated delay-day
  count. Clicking the task name expands "AI summary" + "Recommended actions".
- With an LLM key set, recommendations are concrete and trade-aware. Without a
  key, you'll see deterministic canned text — still functional.
- Editing a task's progress slider auto-re-runs its prediction. Importing a
  `.xlsx` schedule auto-runs predictions for every imported task.
- Hitting `/api/auth/login` more than 10×/min from one IP returns `429`.

### Adding a migration

```powershell
cd backend\Simulyn.Api
dotnet tool install --global dotnet-ef
dotnet ef migrations add YourMigrationName
```

Design-time connection string: set `ConnectionStrings__Default` or rely on
`AppDbContextFactory` (defaults to local Postgres).

---

## End-to-end demo flow

The scripted "golden path" for a live demo — every step exercises one of the
features the current release is built around. Total runtime: ~6-8 minutes (or
~3 if you skip the demo bundle).

### 1. Onboard in one click

- Open `http://localhost:3000`.
- **Register** with any email. A personal organization is auto-created, you
  become its **Owner**, and you land on an empty dashboard.
- *Talking point:* multi-tenant from row zero — every artifact is scoped to
  this org via the `X-Organization-Id` header.

### 2. Seed realistic data

- Click **Load sample project** (any user) or **Demo bundle** (platform admin
  only — 4 varied projects, ~54 tasks, ~2-3 minutes on local Ollama).
- Predictions run automatically.

### 3. Read the dashboard story, not just numbers

- **AI weekly recap** — one headline, 3-5 bullets. **Refresh** regenerates
  (cached 12h per-org). With the LLM on, bullets call out specific projects by
  name grounded in numbers — *not* generic platitudes.
- **KPI strip** — projects / tasks / high-risk / open-alerts.
- **Risk trend chart** + **AI insights** (highest-priority first).
- **Project progress** / **Risk distribution** / **Top risk alerts**.
  - Click **Show plan** on any alert to expand the AI recommendation.
  - Hover **Why?** to see the deterministic math (`Expected ~60% by today, actual 30% (gap +30 pts)`).
  - *Talking point:* LLM does the words, the rule engine does the numbers. You can always prove where a risk call came from.

### 4. Open a project — the AI health brief is the headline

- The first card is the **AI project health brief**: one-line headline, 2-3
  sentence body, colored **health score** chip (0-100), tone tags (`Watch`,
  `Behind schedule`, `Finish week`).
- **Refresh** — the score is deterministic (same inputs → same score) but the
  narrative regenerates.
- Click the amber **Show me what could go wrong** pill → jumps to the simulator
  with AI-suggested scenarios pre-loaded.

### 5. See prediction history at a glance (delta pills)

- On the task table, click **Re-run**. Edit progress slider. Click **Re-run** again.
- Risk column shows `Medium→High` (red, ↑) or `High→Low` (green, ↓); Delay
  column shows `+3d vs last`.
- *Talking point:* trends matter more than snapshots.

### 6. Stress-test the plan — five scenarios, side by side

- Navigate to `/simulation` (or use the deep-link from step 4).
- Fill the queue:
  - Click scenario chips (**Uniform slip**, **Single task slip**, **Add resource**, **Weather pause**, **Scope reduction**) — each card has inline config (days, tasks, capacity %).
  - Or click **Suggest scenarios** — the AI picks a 3-4 scenario mix tailored to *this* project's current state.
- Click **Compare N scenarios**. All run in parallel; ~5-10s for 4 scenarios on Ollama.
- Results table per scenario:
  - **Scenario** — type + AI-written headline.
  - **Inputs** — expanded JSON config (UUIDs swapped for task names).
  - **Impact (days)** — red if positive (later), green if negative (earlier).
  - **Summary** — 2-4 sentence AI narrative referencing the trade / task / crew.

### 7. Verify tenant isolation (optional, ~1 min)

- Create a second organization via `/organizations`.
- Switch to it via the org switcher. Dashboard is empty — the demo project is
  not visible. Brief, recap, alerts all isolated.

### What the demo demonstrates

| Claim | Evidence |
|---|---|
| "Predictable risk scores" | Every Risk / health score / delay is deterministic; **Why?** tooltip shows the math |
| "Actionable AI narrative" | Health brief, weekly recap, per-task summary, scenario narrative — all trade-aware |
| "Stress-test any plan" | 5 scenario types × compare up to 8 in parallel, with auto-suggest |
| "See change, not just state" | Delta pills on re-runs, 7-day high-risk delta in the weekly recap |
| "Works offline" | Unplug the LLM (`LLM_PROVIDER=off`) — every feature degrades to deterministic text tagged `· offline fallback` |
| "Multi-tenant" | Switch orgs — the dashboard and all briefs/recaps change |

### Troubleshooting

- **`docker compose up` hangs on the `api` service** → wait. The first run
  downloads the .NET SDK image (~700MB) and applies migrations.
- **Login returns 401** → the user might not exist yet; register first.
- **Predictions disabled banner** → trial expired. Open `/admin/billing` (as
  admin) and set the org to **Active** with a future expiry.
- **First prediction is slow** → only the first call per provider is slow (cold
  connection); subsequent calls are ~1–2s in parallel.
- **`/health` shows `"llm_provider": "off"`** → no API key picked up. Check
  `.env` is at the repo root (not inside `ai-service/`) and recreate the `ai`
  container: `docker compose up --build -d ai`.

---

## Repository layout

| Path | Stack | Role |
|------|--------|------|
| `backend/Simulyn.Api` | .NET 8, EF Core, PostgreSQL, JWT | REST API, persistence, orchestration |
| `ai-service` | Python, FastAPI | Predict + simulate (same rules as the API fallback) |
| `frontend` | Next.js 14 (App Router), Tailwind | Login, dashboard, projects, simulation |
| `deploy/` | Docker Compose + Caddyfile | Production VPS setup (see [Deploy](#deploy-to-the-cloud)) |

The API calls the Python service when reachable; otherwise it uses the built-in
rule engine so local development still works.

---

## Configuration reference

All secrets are read from environment variables. None are hardcoded for production.

### .NET API (`backend/Simulyn.Api`)

| Variable | Required | Default | Purpose |
|----------|:---:|---------|---------|
| `ConnectionStrings__Default` | ✓ | local Postgres | Postgres connection string |
| `Jwt__Key` | ✓ | dev-only placeholder | Min 32-char secret for signing JWTs. **Generate fresh per environment.** |
| `Jwt__Issuer` | — | `Simulyn.Api` | JWT issuer claim |
| `Jwt__Audience` | — | `Simulyn.Clients` | JWT audience claim |
| `Jwt__ExpiryMinutes` | — | `10080` (7 days) | Token lifetime |
| `AiService__BaseUrl` | — | `http://localhost:8000` | Reachable URL of the FastAPI service |
| `Frontend__Origin` | — | `http://localhost:3000` | CORS origin (comma-separated for multiple) |
| `PlatformAdminEmails` | — | unset | Comma-separated emails that get `IsPlatformAdmin=true` on register |
| `ASPNETCORE_ENVIRONMENT` | — | `Production` in Docker | `Development` enables verbose errors |
| `Email__Provider` | — | `auto` | `resend` \| `console` \| `auto` |
| `Email__Resend__ApiKey` | — | unset | Resend API key. Without it, emails print to stdout. |
| `Email__FromAddress` | — | `Simulyn AI <noreply@simulyn.ai>` | From address. Must be verified on Resend. |
| `Email__AppUrl` | — | `http://localhost:3000` | Public URL used in email links (reset, invite, recap). |
| `Sentry__Dsn` | — | unset | Sentry DSN. When set, errors + 10% trace sample forwarded. |
| `Budget__SoftCapMills` | — | `5000` ($5/day) | Per-org daily LLM warn threshold (1000 mills = $1) |
| `Budget__HardCapMills` | — | `20000` ($20/day) | Hard block — predictions/simulation return 429 above this |
| `Stripe__ApiKey` | — | unset | Stripe secret key. Without it, self-serve checkout returns 503. |
| `Stripe__WebhookSecret` | — | unset | Webhook signing secret (`whsec_...`) |
| `Stripe__Prices__Starter\|Pro\|Enterprise` | — | unset | Stripe Price IDs per plan |
| `Stripe__SuccessUrl\|CancelUrl` | — | `/admin/billing?checkout=...` | Where Stripe sends the browser after checkout |

### AI service (`ai-service`)

| Variable | Required | Default | Purpose |
|----------|:---:|---------|---------|
| `LLM_PROVIDER` | — | `auto` | `openai` \| `anthropic` \| `ollama` \| `auto` \| `off`. Use `openai` for OpenAI itself **and** any OpenAI-compatible provider (Groq, DeepSeek, Together, OpenRouter, Azure OpenAI). |
| `OPENAI_API_KEY` | — | unset | Enables the `openai` provider (also paste Groq / DeepSeek / Together / OpenRouter keys here) |
| `OPENAI_BASE_URL` | — | unset (→ `https://api.openai.com/v1`) | Override for non-OpenAI providers — see [recipes below](#hosted-provider-recipes) |
| `OPENAI_MODEL` | — | `gpt-4o-mini` | Model for `/predict`, `/simulate`, `/project-brief`, `/weekly-recap` |
| `OPENAI_CHAT_MODEL` | — | inherits `OPENAI_MODEL` | Override for `/chat-step` only |
| `ANTHROPIC_API_KEY` | — | unset | Enables Anthropic provider |
| `ANTHROPIC_MODEL` | — | `claude-3-5-haiku-latest` | Anthropic model |
| `OLLAMA_BASE_URL` | — | `http://localhost:11434/v1` | Local Ollama endpoint |
| `OLLAMA_MODEL` | — | `llama3.2` | Default Ollama model. Pull first: `ollama pull llama3.2` |
| `OLLAMA_CHAT_MODEL` | — | inherits `OLLAMA_MODEL` | Override for `/chat-step` only — recommended: `llama3.1:8b` or `qwen2.5:7b` |
| `OLLAMA_TIMEOUT_SECS` | — | `60` | Per-call timeout for Ollama |
| `LLM_TIMEOUT_SECS` | — | `15` | Per-call timeout for OpenAI-compatible providers |
| `LLM_MAX_TOKENS` | — | `350` | Output cap for `/predict` and `/simulate` |
| `CHAT_MAX_TOKENS` | — | `1500` | Output cap for `/chat-step` |

### Frontend (`frontend`)

| Variable | Required | Default | Purpose |
|----------|:---:|---------|---------|
| `NEXT_PUBLIC_API_URL` | ✓ | `http://localhost:5000` | Public URL the browser uses to call the .NET API |

> Tokens live in `localStorage` today (planned: HttpOnly cookies — Phase 1.5).
> `NEXT_PUBLIC_*` vars are inlined at build time, so they must be set at build time.

### Hosted-provider recipes

Any OpenAI-compatible provider works — set `LLM_PROVIDER=openai` plus the right
`OPENAI_BASE_URL`:

| Provider | `OPENAI_BASE_URL` | Example `OPENAI_MODEL` | Notes |
|---|---|---|---|
| **OpenAI** (default) | *leave unset* | `gpt-4o-mini` | Best tool-calling; pay-as-you-go. |
| **Groq** (recommended for pilots) | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` + `OPENAI_CHAT_MODEL=llama-3.1-8b-instant` | Free tier: 14.4k req/day on 8B-instant, 1k/day on 70B. Ideal for 3-5 pilot orgs at $0/mo. |
| **DeepSeek** | `https://api.deepseek.com/v1` | `deepseek-chat` | Cheapest paid (~$0.27 / $1.10 per 1M). |
| **Together AI** | `https://api.together.xyz/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | Open-weight models, pay-as-you-go. |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `meta-llama/llama-3.3-70b-instruct:free` | Proxy to 100+ models, some free tiers. |
| **Anthropic** | N/A — use `LLM_PROVIDER=anthropic` | `claude-3-5-haiku-latest` | Premium narrative quality. |
| **Local Ollama** | N/A — use `LLM_PROVIDER=ollama` | `llama3.2` | Free, private, no infra cost; needs 4GB+ RAM. |

See `ai-service/.env.example` for copy-paste env blocks.

### Configuring Resend (real email delivery)

1. Create an account at [resend.com](https://resend.com) (3,000 emails/month free).
2. Add and verify your sending domain (3 DNS records — TXT/SPF/DKIM). Without verification, Resend only delivers to the account owner.
3. Create an API key scoped to *Send emails*.
4. Set `Email__Resend__ApiKey=re_...` and `Email__FromAddress="Your Name <noreply@yourdomain.com>"`.
5. Redeploy. Leave the key unset and emails just print to stdout.

### Configuring Stripe (self-serve checkout)

1. Create three Products in the Stripe dashboard (Starter, Pro, Enterprise) and copy their `price_...` IDs.
2. Set `Stripe__ApiKey=sk_test_...` and `Stripe__Prices__Starter|Pro|Enterprise=price_...`.
3. Add a webhook endpoint pointing at `https://yourapi/api/billing/webhook`, subscribed to at least `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.paused`. Copy the signing secret to `Stripe__WebhookSecret=whsec_...`.
4. Set `Stripe__SuccessUrl` / `Stripe__CancelUrl` to public URLs (not localhost).
5. Use `stripe listen --forward-to localhost:5000/api/billing/webhook` for local testing. Flip to live mode only once end-to-end is green.

### Configuring Sentry

1. Create a project in Sentry (`.NET` for the API, `Python`/`FastAPI` for ai-service, `Next.js` for the frontend).
2. Set `Sentry__Dsn=https://...` on the .NET API. Errors start flowing on next restart.
3. (TODO) AI service + frontend Sentry wiring is on the Phase 1.5 list.

---

## Deploy to the cloud

Three paths, pick the one that matches where you are right now:

| Path | Monthly cost | Cold start | Best for |
|---|---|---|---|
| **A. Vercel + Render + Neon** | $0 (free tiers) | ~30s after 15min idle | First demo, design-partner pilots |
| **B. Single VPS + Caddy** | $5-10 | None | Full control, 3+ paying pilots |
| **C. Railway** (all-in-one) | $5-20 | None | One dashboard, no SSH, first real pilot |

For a VPS deploy, the repo ships a ready-made production setup in `deploy/`:

```
deploy/
  docker-compose.prod.yml   — all four services + Postgres, internal network
  Caddyfile                 — reverse proxy, auto-HTTPS via Let's Encrypt
  .env.prod.example         — every required env var, annotated
```

### Option A — Vercel + Render + Neon (free tier)

Fastest path from `git push` to a public URL — no credit card, no SSH, ~20 minutes.

```
[ Vercel frontend ] ──► [ Render: API ] ──► [ Neon Postgres ]
                              │
                              └──► [ Render: AI ] ──► Groq
```

**Free-tier limits** (fine for demos, not real users):

- Render free services sleep after 15 min idle → ~30s cold start.
- Neon free auto-suspends DB after 5 min idle → first query adds ~2-5s.
- Groq free: ~14.4k req/day on 8B-instant, 1k/day on 70B.

**Step 1 — Neon Postgres** (~3 min) — Sign up at [neon.tech](https://neon.tech), create a project in the region closest to your API. Copy the connection string and convert to Npgsql key=value format:

```
Host=ep-abc-123-pooler.ap-southeast-1.aws.neon.tech;Database=neondb;Username=neondb_owner;Password=npg_xxxxx;SSL Mode=Require;Trust Server Certificate=true
```

**Step 2 — Backend API on Render** (~8 min) — Sign up at [render.com](https://render.com). New Web Service → connect repo:

| Field | Value |
|---|---|
| Name | `simulyn-api` |
| Runtime | **Docker** |
| Dockerfile Path | `./backend/Dockerfile` |
| Docker Context | `./backend` |
| Instance Type | **Free** |
| Health Check Path | `/healthz` |

Environment variables:

```
ConnectionStrings__Default = <Npgsql string from Step 1>
Jwt__Key                   = <openssl rand -base64 48>
Jwt__Issuer                = Simulyn.Api
Jwt__Audience              = Simulyn.Clients
Frontend__Origin           = https://<your-vercel-app>.vercel.app
AiService__BaseUrl         = https://simulyn-ai-ai.onrender.com
PlatformAdminEmails        = you@youremail.com
ASPNETCORE_ENVIRONMENT     = Production
ASPNETCORE_URLS            = http://0.0.0.0:10000
```

Verify: `https://simulyn-api.onrender.com/healthz` → `{"status":"ok",...}`. EF migrations run automatically on first boot.

> **Multiple Vercel preview URLs?** `Frontend__Origin` accepts a comma-separated list. Each value must be an exact origin (no wildcards).

**Step 3 — AI service on Render** (~5 min) — Same flow, new Web Service:

| Field | Value |
|---|---|
| Name | `simulyn-ai-ai` *(must match `AiService__BaseUrl` in Step 2)* |
| Dockerfile Path | `./ai-service/Dockerfile` |
| Docker Context | `./ai-service` |
| Health Check Path | `/health` |

Environment variables (Groq config):

```
LLM_PROVIDER       = openai
OPENAI_API_KEY     = gsk_...   # from console.groq.com
OPENAI_BASE_URL    = https://api.groq.com/openai/v1
OPENAI_MODEL       = llama-3.3-70b-versatile
OPENAI_CHAT_MODEL  = llama-3.1-8b-instant
LLM_TIMEOUT_SECS   = 15
LLM_MAX_TOKENS     = 350
CHAT_MAX_TOKENS    = 1500
PORT               = 10000
```

Verify: `https://simulyn-ai-ai.onrender.com/health`.

**Step 4 — Frontend on Vercel** (~3 min) — Sign up at [vercel.com](https://vercel.com), import the repo:

- **Root Directory** → `frontend`
- **Framework Preset** → Next.js (auto-detected)
- Env: `NEXT_PUBLIC_API_URL = https://simulyn-api.onrender.com`

**Step 5 — Close the CORS loop** — Edit `Frontend__Origin` on Render to the exact Vercel URL. Save → Render redeploys.

**Step 6 — Smoke test** — Open Vercel URL → Register (use the email in `PlatformAdminEmails`) → Load sample project → predictions run in ~5-10s (first call wakes AI service from sleep) → open project → AI health brief generates → **Ask Simulyn** → ask *"What's at risk this week?"* → **Simulation** → **Suggest scenarios** → run compare.

If anything fails:

| Symptom | Where to look |
|---|---|
| Login fails / 500 on register | Render → `simulyn-api` → Logs |
| White page / JS error | Browser DevTools Console |
| CORS error | Render → `simulyn-api` → `Frontend__Origin` must match Vercel origin exactly |
| "Error talking to language model" | Render → `simulyn-ai-ai` → Logs |
| Slow first request after idle | Expected (cold start) — make a second request to warm up |
| Failed Vercel build | Vercel → Deployments → click red one → full build log |

Generate a JWT key:

```bash
# Linux/macOS or Git Bash
openssl rand -base64 48

# Windows PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

**When to upgrade:**

| Pain point | Upgrade |
|---|---|
| ~30s cold start | Render **Starter** ($7/mo per service) — always-on |
| Neon auto-suspend | Neon **Launch** ($19/mo) — no auto-suspend, 10 GB |
| One worker, one region | Render **Standard** ($25/mo) — multi-region fail-over |
| `.vercel.app` subdomain | Bring your own domain (free, add a CNAME) |

You can run paying customers on a $40/month all-in trio once you outgrow free tier.

### Option B — Single VPS + Caddy

One Linux box runs everything. Flat ~$5-10/month, matches your local stack.

**Prereqs** — A domain, a VPS with ≥4 GB RAM ([Hetzner CX22 €4.51/mo](https://www.hetzner.com/cloud) or DigitalOcean), a Groq API key.

**Step 1 — Provision the VPS** (Ubuntu 24.04 LTS):

```bash
# Create a non-root user
adduser simulyn && usermod -aG sudo simulyn
install -d -m 700 /home/simulyn/.ssh
cp ~/.ssh/authorized_keys /home/simulyn/.ssh/ && chown -R simulyn: /home/simulyn/.ssh

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker simulyn

# Firewall — SSH, HTTP, HTTPS only
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

# Unattended security updates
apt-get install -y unattended-upgrades && dpkg-reconfigure -f noninteractive unattended-upgrades
```

SSH out and back in as `simulyn`.

**Step 2 — DNS** — Two `A` records to the VPS IPv4:

| Host | Type | Value |
|---|---|---|
| `app` (or `@` for apex) | `A` | `<vps-ip>` |
| `api` | `A` | `<vps-ip>` |

Confirm with `dig +short app.yourdomain.com`.

**Step 3 — Clone & configure**:

```bash
sudo mkdir -p /opt/simulyn && sudo chown simulyn: /opt/simulyn
cd /opt/simulyn
git clone https://github.com/<your-fork>/simulyn-ai.git .
cp deploy/.env.prod.example deploy/.env.prod
nano deploy/.env.prod    # fill in every CHANGE_ME
```

Minimum:

- `SIMULYN_DOMAIN=app.yourdomain.com`
- `SIMULYN_API_DOMAIN=api.yourdomain.com`
- `PUBLIC_API_URL=https://api.yourdomain.com`
- `ACME_EMAIL=you@yourdomain.com`
- `POSTGRES_PASSWORD=$(openssl rand -base64 32)`
- `JWT_SIGNING_KEY=$(openssl rand -base64 48)`
- `PLATFORM_ADMIN_EMAILS=you@yourdomain.com`
- `OPENAI_API_KEY=gsk_...` (Groq key)

**Step 4 — Build & start**:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
```

**Step 5 — Verify**:

```bash
curl -sf https://api.yourdomain.com/healthz   # → {"status":"ok"}
curl -sf https://app.yourdomain.com           # → HTML
```

Open `https://app.yourdomain.com` → Register the email in `PLATFORM_ADMIN_EMAILS` → Load sample project → Ask Simulyn.

**Step 6 — Nightly Postgres backups**:

```bash
sudo tee /etc/cron.daily/simulyn-backup > /dev/null <<'EOF'
#!/bin/bash
set -e
BACKUP_DIR=/opt/simulyn/backups
mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%d-%H%M)
docker exec $(docker ps -qf name=db) pg_dump -U simulyn simulyn \
  | gzip > "$BACKUP_DIR/simulyn-$STAMP.sql.gz"
find "$BACKUP_DIR" -name 'simulyn-*.sql.gz' -mtime +14 -delete
EOF
sudo chmod +x /etc/cron.daily/simulyn-backup
```

Test: `sudo /etc/cron.daily/simulyn-backup && ls -lh /opt/simulyn/backups/`.

**Updates** — `git pull && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build`. Caddy/db stay up; web/api/ai restart in ~10s.

**Rollback** — `git checkout <sha>` then redeploy.

### Option C — Railway

[Railway](https://railway.app) builds all services from your repo + provisions Postgres in one project. ~$5-20/month, no cold starts.

1. **New Project** → **Deploy from GitHub repo** → select `simulyn-ai`.
2. Add three services pointing at the Dockerfiles (`backend/`, `ai-service/`, `frontend/`) plus a **Postgres** plugin.
3. Set env vars (mirror `deploy/.env.prod.example`). Railway exposes `${{Postgres.DATABASE_URL}}` in `postgresql://` form — convert to `Host=...;Port=...;Database=...;Username=...;Password=...;SSL Mode=Require` for `ConnectionStrings__Default`.
4. On `frontend`, set `NEXT_PUBLIC_API_URL` to the public URL of `backend` (Settings → Networking).
5. On `backend`, set `Frontend__Origin` to the `frontend` public URL and `AiService__BaseUrl` to the **internal** URL of `ai-service` (e.g. `http://ai-service.railway.internal:8000`).
6. Done — Railway provisions HTTPS automatically on `*.up.railway.app` or attach your own custom domain.

### Production hardening checklist

Regardless of which option you pick:

- [ ] Unique `JWT_SIGNING_KEY` (`openssl rand -base64 48`); never reuse the dev value.
- [ ] Unique `POSTGRES_PASSWORD` (`openssl rand -base64 32`); never commit it.
- [ ] `.env.prod` is gitignored — verify with `git status` before pushing.
- [ ] Nightly Postgres backups + monthly restore drill (actually restore to a scratch DB).
- [ ] `Frontend__Origin` is your *exact* production origin (no wildcards, https only).
- [ ] API is HTTPS-only (Caddy / Render / Vercel / Railway handle it).
- [ ] `PLATFORM_ADMIN_EMAILS` is a small, controlled list.
- [ ] LLM provider has billing in place (Groq free tier fine for pilot; add billing before 10+ orgs).
- [ ] Per-org daily budget caps (`Budget__HardCapMills`) are set.
- [ ] Uptime monitor pinging `/healthz` every minute ([Better Stack](https://betterstack.com), UptimeRobot).
- [ ] Sentry DSN set on the .NET API.
- [ ] Test full register → load sample → predict → chat flow on production URL **before** sending it to a customer.
- [ ] Rotate the Groq/OpenAI API key if it was ever shared in chat, screenshots, or commits.

---

## How predictions work

Risk levels and delay-day numbers are always computed by a **deterministic
rule engine** — predictable, explainable, auditable. The `summary` and
`recommendation` strings are written by an **LLM** when `OPENAI_API_KEY` or
`ANTHROPIC_API_KEY` is present; otherwise the service falls back to short
canned text so local dev and demos still work.

`LLM_PROVIDER=auto` picks OpenAI if its key is set, then Anthropic, then off.
Confirm via `GET /health`:

```json
{ "status": "ok", "llm_provider": "openai", "openai_model": "gpt-4o-mini" }
```

> **Performance:** per-task LLM calls run in parallel (capped at 5 in flight)
> inside the .NET `PredictionService`, so a 10-task project finishes in ~3-5s
> instead of 20s+. The .NET HTTP client timeout to the AI service is 30s.

---

## Chat copilot ("Ask Simulyn")

Click **"Ask Simulyn"** (bottom-right of any authed page) to open the chat
drawer. Type a question in any language and the bot replies in the same
language using real data from your active organization.

The .NET API runs an LLM tool-calling loop: the model picks which of 10
read-only tools to call (`list_projects`, `get_project`, `list_at_risk_tasks`,
`list_recent_alerts`, `get_dashboard_summary`, `get_risk_trend`,
`list_organizations`, `list_org_members`, `get_task`,
`get_recent_predictions`), each tool runs in-process against EF Core, results
are fed back to the LLM, and a final natural-language reply is returned.

**Provider strategy:**

- **Hosted preferred** — set `OPENAI_API_KEY` (recommended: `gpt-4o-mini`) or
  `ANTHROPIC_API_KEY` (recommended: `claude-3-5-haiku-latest`). Tool-calling is
  rock-solid here.
- **Local fallback** — `LLM_PROVIDER=ollama` with a tool-capable model.
  `OLLAMA_CHAT_MODEL` inherits `OLLAMA_MODEL` by default. For better quality,
  override with `ollama pull llama3.1:8b` (or `qwen2.5:7b`) and set
  `OLLAMA_CHAT_MODEL=llama3.1:8b`. Llama 3.2 (3B) works but occasionally
  misuses tool arguments.
- If neither is configured, chat returns a friendly "AI not configured" message.

**Example prompts:**

- *"What's at risk this week?"*
- *"Status of Tower B"* (substring name match)
- *"Show me high-risk tasks across the org"*
- *"Give me a portfolio summary"*
- *"¿Qué tareas están en riesgo en Phase 2?"* — replies in Spanish
- *"मेरे सबसे बड़े प्रोजेक्ट में देरी क्यों हो रही है?"* — replies in Hindi

**Limits and safety:**

- **Read-only in v1.** No tool can create / edit / delete data.
- **Multi-tenant.** Every tool resolves the active org from the JWT — the LLM
  can't leak data across orgs even if prompted.
- **Rate-limited.** 20 chat requests / min / user.
- **Loop-capped.** Max 6 tool calls / turn — orchestrator forces a best-effort
  answer if the LLM gets greedy.
- **Local-only history.** Conversations live in `localStorage` per active
  organization; nothing persisted server-side yet (planned).

---

## Excel schedule import

Upload an **`.xlsx`** workbook (first sheet is read). The first row must
contain headers; required concepts:

| Concept | Example header names |
|---------|----------------------|
| Task name | `Task Name`, `Name`, `Activity`, `Task` |
| Start date | `Start Date`, `Start`, `Begin` |
| End date | `End Date`, `Finish`, `End` |
| Progress (optional) | `Progress`, `% Complete`, `Percent` |

Data rows below the header create tasks on the selected project. Dates may be
Excel date cells or text (`yyyy-MM-dd` or locale formats).

**API:** `POST /api/projects/{id}/import-schedule` — `multipart/form-data` with
field `file` (`.xlsx`).

---

## API summary

All endpoints except `/api/auth/*` and `/healthz` require JWT (`Authorization:
Bearer ...`). Tenant-scoped endpoints additionally honour the
**`X-Organization-Id`** request header (falls back to the user's first
membership if missing or invalid).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register; auto-creates a personal org (Owner) |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/request-password-reset` | Email a reset token (always returns 200) |
| POST | `/api/auth/reset-password` | Submit token + new password |
| GET | `/healthz` | API health (anonymous) |
| GET | `/api/me` | Current user + active org context (id, name, role, plan, entitlement) |
| GET | `/api/organizations` | List orgs the caller belongs to |
| POST | `/api/organizations` | Create org (caller becomes Owner) |
| GET | `/api/organizations/{id}` | Org detail (any member) |
| PUT | `/api/organizations/{id}` | Rename org (Admin/Owner) |
| DELETE | `/api/organizations/{id}` | Delete org (Owner; cannot delete your last) |
| GET | `/api/organizations/{id}/members` | List members |
| POST | `/api/organizations/{id}/members` | Add member by email (Admin/Owner; Owner-grant requires Owner) |
| PUT | `/api/organizations/{id}/members/{userId}` | Change member role (Owner only) |
| DELETE | `/api/organizations/{id}/members/{userId}` | Remove member (Admin/Owner; self-removal allowed) |
| GET | `/api/projects` | List projects in active org |
| POST | `/api/projects` | Create project (Member+) |
| GET | `/api/projects/{id}` | Project detail |
| PUT | `/api/projects/{id}` | Rename / re-date (Member+) |
| DELETE | `/api/projects/{id}` | Delete (Admin+) |
| POST | `/api/projects/sample` | Seed a 12-task demo project + run predictions |
| POST | `/api/projects/{id}/import-schedule` | Upload `.xlsx` (auto-runs predictions) |
| GET | `/api/tasks/project/{projectId}` | List tasks |
| POST | `/api/tasks` | Create task (auto-runs prediction) |
| PUT | `/api/tasks/{id}` | Update task (re-runs prediction if progress changed) |
| DELETE | `/api/tasks/{id}` | Delete task |
| POST | `/api/predictions/run` | Body: `{ "taskId" }` or `{ "projectId" }`. Requires entitled org. |
| GET | `/api/projects/{id}/brief` | AI project health brief. `?refresh=true` bypasses 12h cache. |
| POST | `/api/simulation` | Scenario-aware: `{ "projectId", "scenarioType", "config" }` (legacy `inputDelayDays` treated as `UniformSlip`) |
| POST | `/api/simulation/compare` | `{ "projectId", "scenarios": [...] }`. Up to 8 in parallel, each persisted. |
| POST | `/api/simulation/auto-suggest?projectId={id}` | AI picks 3-4 scenarios worth running |
| GET | `/api/dashboard/summary` | Totals + alert counts for active org |
| GET | `/api/dashboard/alerts` | Risk alerts (AI reason + recommendation + deterministic "why") |
| GET | `/api/dashboard/weekly-recap` | AI weekly recap. `?refresh=true` bypasses 12h cache. |
| POST | `/api/billing/checkout` | Stripe Checkout session for the active org |
| POST | `/api/billing/webhook` | Stripe webhook (`checkout.session.completed`, `customer.subscription.*`) |
| GET | `/api/billing/budget` | Today's per-org LLM spend + soft/hard caps |
| GET | `/api/admin/organizations` | Platform admin: list orgs + billing |
| POST | `/api/admin/organizations/{orgId}/subscription` | Platform admin: set plan/status/expiry/notes |

---

## Billing model

The repo supports two parallel paths:

1. **Stripe self-serve** (the default once you set `Stripe__*` env vars).
   `POST /api/billing/checkout` creates a session; the webhook flips
   `SubscriptionStatus` automatically.
2. **Manual invoice** (always available, useful for early pilots and
   enterprise contracts).
   - Every new **organization** starts with `SubscriptionStatus=Trial` for 30 days.
   - Prediction and simulation endpoints require the active org to be *entitled*
     (`Trial` not expired, or `Active`).
   - A platform admin can flip an org to `Active` / `Suspended` / `Inactive` and
     adjust expiry / notes via `POST /api/admin/organizations/{orgId}/subscription`
     (or the `/admin/billing` UI).

### Bootstrap a platform admin

Set `PlatformAdminEmails` (comma-separated) to at least one email **before**
that user registers. They will be created with `IsPlatformAdmin=true` and gain
access to `/api/admin/*`. This flag is independent of any organization role —
a platform admin can administer billing for orgs they aren't a member of.

---

## Roadmap

The product is **demo-ready and tenant-isolated** today. The list below is the
honest gap between *"impressive demo"* and *"a customer will pay you and not
churn"*. Items are sized for one to two engineer-weeks unless noted.

A checked box means **fully shipped and verified**.

### Phase 1 — First paying customer possible (8 of 9 shipped)

- [x] **Email notifications + weekly look-ahead PDF.** *The killer feature this stack was built for.* High-risk crossover alerts from `PredictionService` (dedup'd per task per day); `WeeklyRecapScheduler` dispatches a PDF every Monday 06:00 UTC. PDF via QuestPDF; email via `IEmailSender` (Resend driver + Console fallback). Per-user `NotificationPreference` opt-out.
- [x] **Stripe self-serve checkout + plan enforcement per org.** `POST /api/billing/checkout` + webhook activate/suspend on `checkout.session.completed` / `customer.subscription.*`.
- [x] **Tokenised email invite for non-existing users.** `POST /api/organizations/{id}/members` for an unknown email issues an `EmailToken` and sends a `/register?token=...` link. Register accepts `inviteToken` and joins the inviting org.
- [x] **Password reset.** `POST /api/auth/request-password-reset` + `POST /api/auth/reset-password`. BCrypt-hashed tokens, 1-hour TTL, enumeration-proof. *(Email verification on register moved to Phase 1.5.)*
- [x] **Automated test suite + CI.** 17 xUnit tests on the API (billing entitlement, email token lifecycle, scenario math, tenant isolation), 8 pytest tests on the AI service, GitHub Actions runs all three on every push/PR.
- [x] **Privacy / Terms / Cookie banner.** `/privacy` + `/terms` page templates (placeholders — swap for legal-reviewed copy before paid customers) and `CookieBanner` with accept-all / essential-only.
- [x] **Rate limits + daily LLM budget cap.** `predictions` (60/min/user) + `simulation` (10/min/user). `BudgetGuard` blocks expensive endpoints once the org crosses `Budget:HardCapMills` (default $20/day).
- [x] **Serilog JSON + Sentry.** Structured JSON logs to stdout (Render/Railway/Loki-compatible). Sentry behind `Sentry:Dsn`.
- [ ] **Refresh-token flow + HttpOnly cookies.** *Deferred to Phase 1.5* — held back so we don't destabilise auth right before the first pilot.

### Phase 1.5 — Post-pilot housekeeping (0 of 7 shipped)

Land these in the week after pilot #1 signs, before you take a credit card from a stranger.

- [ ] **HttpOnly cookie refresh-token flow.** Stop storing JWTs in `localStorage`. Short-lived (15 min) access token + rotating refresh token in `HttpOnly + Secure + SameSite=Lax` cookies.
- [ ] **Email verification before predictions unlock.** Token + email link, 24-hour expiry. Gate prediction/simulation endpoints until verified.
- [ ] **Wire landing-page pricing CTAs to live Stripe checkout.** Endpoint is live; landing still hard-codes `$199 / project / month`. Swap **Start Free Trial** / **Book a demo** to call the API with real Price IDs.
- [ ] **Swap `/privacy` + `/terms` template copy** for legal-reviewed wording (Termly / iubenda / a real lawyer).
- [ ] **Replace `hello@simulyn.ai`** with a real, monitored inbox.
- [ ] **Uptime monitor.** Better Stack or Pingdom free tier, pinging `/healthz` and `/health` every 60s.
- [ ] **Sentry for ai-service and frontend.** Add `sentry-sdk[fastapi]` + `@sentry/nextjs` so all three services land in one project.

### Phase 2 — Win mid-size GC deals (0 of 7 shipped, 6–10 weeks)

These unlock customers who'll actually pay $500–$2000/month per org.

- [ ] **⭐ Cost overrun prediction (highest ROI feature on this list).** Today we predict time; we don't predict money. In construction, cost is everything.
    - **Data:** add `Project.DailyCostRate` (USD/day) and optional `ProjectTask.DailyCostRate` override; `CrewCost` field on `AddResource` config.
    - **Model:** `projectedCostOverrunUsd = maxPredictedDelayDays × DailyCostRate`. Per-scenario: `scenario.PredictedDelayDays × DailyCostRate − scenario.AddedCrewCost`. Pure arithmetic, auditable.
    - **UI — project brief:** new chip next to the health score: *"Potential cost overrun: $25,000"* coloured by magnitude.
    - **UI — scenario comparison:** new **Cost impact** column. *"Adding 2 crew costs $8k but saves $30k → net **−$22,000**."*
    - **UI — weekly recap email:** *"Portfolio exposure this week: $147k potential overrun across 3 projects."* — the bullet that gets the CFO to open the email.
    - **Why Phase 2:** GCs quote and lose jobs on dollar impact, not day impact. Highest-leverage feature you haven't built.
- [ ] **P6 (`.xer`) import.** Parse Primavera P6 — the format every serious PM uses. Hand-rolled tokenizer; no good open-source library.
- [ ] **MS Project import (`.mpp` and `.xml`).** [MPXJ](http://mpxj.org/) via a Java sidecar, or just `.xml` (MSPDI).
- [ ] **Task dependencies (FS/SS/FF/SF) + real critical-path analysis.** Without dependencies, what-if simulation isn't real CPM and any scheduler dismisses the product in 30 seconds.
- [ ] **Gantt chart visualization** ([frtl-gantt](https://github.com/frappe/gantt), [dhtmlx-gantt](https://dhtmlx.com/docs/products/dhtmlxGantt/), or [bryntum](https://bryntum.com)). The single most expected feature in any PM tool.
- [ ] **Audit log.** Persistent record of who did what — required by enterprise IT review.
- [ ] **Mobile-friendly site supervisor view (PWA).** Read-only mobile view of today's tasks + risks.

### Phase 3 — Differentiation (1 of 5 shipped, 10–16 weeks)

How you stop being "one of many PM tools" and become *the* construction-AI tool.

- [x] **Natural-language Q&A** ("Ask Simulyn" chat copilot). Multilingual, LLM tool-calling against 10 read-only org-scoped APIs.
- [ ] **Real ML model trained on historical schedules.** Today's "AI" is a rule engine + LLM narrative. Train an actual delay-prediction model on the customer's past projects (XGBoost on activity features is fine for v1).
- [ ] **Photo upload + LLM vision for site progress detection.** Site supervisor snaps a phone photo → vision LLM returns *"Foundation 60% complete, formwork visible, no rebar in frame yet"*. Auto-update `Task.Progress`. *The moonshot demo.*
- [ ] **Procore / ACC / MS Project Online integration.** Every customer asks. OAuth + read tasks + write status updates.
- [ ] **Two-way schedule sync** (not just one-shot import). Webhook from P6/MSP → re-run predictions automatically.

### Phase 4 — Scale, security, compliance (3 of 9 shipped, 8–12 weeks)

Required before enterprise (>$50k/year) deals.

- [x] **Sentry + structured Serilog → JSON** on the .NET API.
- [x] **Rate limiting on predictions + simulation.** Excel import next.
- [x] **Per-org per-day prediction budget cap** — `BudgetGuard` + `UsageService`; `Budget:SoftCapMills` / `Budget:HardCapMills`.
- [ ] **Uptime monitor** (Better Stack / Pingdom).
- [ ] **GDPR data export + delete-my-account / delete-my-organization** endpoints.
- [ ] **Backups + restore drill.** Nightly Postgres dump + monthly restore-into-staging test.
- [ ] **HSTS + CSP + secure cookie flags** on the frontend.
- [ ] **SSO / SAML** via [WorkOS](https://workos.com) or [Auth0](https://auth0.com).
- [ ] **SOC 2 Type 1 prep** — [Vanta](https://vanta.com) or [Drata](https://drata.com) tracking the controls. Type 2 needs 6 months of evidence.
- [ ] **Postgres connection pooling** (PgBouncer) once you cross ~50 active orgs.

### Phase 5 — Go-to-market (0 of 7 shipped, run in parallel)

Software readiness ≠ business readiness. None of this is code; skipping it is why most B2B SaaS products with great tech die.

- [ ] **3–5 design partner pilots.** Real PMs on real projects, half-price/free for 6 months in exchange for case-study rights.
- [ ] **One published case study** with named customer + real numbers (*"cut Monday-morning report from 3hr to 5min"*).
- [ ] **One niche-specific landing page** per construction sub-vertical (commercial GCs, civil/infra, MEP subs).
- [ ] **Pricing page wired end-to-end through Stripe.**
- [ ] **Sales-grade demo environment.** Long-lived org, 6-month construction program, populated history, fake "previous Monday" report for *"look what you would have got"* demos.
- [ ] **Onboarding email sequence** (day 0, 1, 3, 7, 14) with a video at each step.
- [ ] **Public `/changelog`** so existing customers see momentum.

### Phase 6 — Already done (historical baseline)

- ✓ Multi-tenancy with Organizations + Members + 4 roles, tenant-isolated artifacts, X-Organization-Id header, org switcher, organization & member management UI.
- ✓ Real LLM integration (OpenAI + Anthropic + local Ollama, auto-detected, with deterministic fallback).
- ✓ Multilingual chat copilot ("Ask Simulyn") — LLM tool-calling against 10 read-only org-scoped APIs.
- ✓ Per-task AI summary + recommendations rendered in the UI.
- ✓ Public marketing landing page at `/`.
- ✓ "Load sample project" → 12-task realistic project + auto-run predictions.
- ✓ Auto-run predictions after task creation, progress edits, and Excel imports.
- ✓ Project rename, per-task re-run, task delete.
- ✓ Basic rate limiting (10/min/IP) on `/api/auth/*`.
- ✓ `/healthz` (.NET) + `/health` (FastAPI) endpoints.
- ✓ Parallelised LLM calls (capped at 5 concurrent).
- ✓ Auto-provisioned personal workspace + 30-day trial on register.
- ✓ Manual-invoice billing path via platform admin.
- ✓ Excel `.xlsx` schedule import with auto-prediction.

### Phase 7 — AI narrative + multi-scenario simulator (May 2026) ✓

A focused upgrade that moved the product from *"show me a number"* to *"show me a story and let me stress-test it"*:

- ✓ **AI project health brief** — every project page opens with a one-line headline, 2-3 sentence narrative, and a 0–100 health score. Score is deterministic from risk mix + progress-vs-window gap + schedule cushion; the LLM only narrates. Cached per-project for 12h. See `Controllers/ProjectsController.cs#GetBrief` and `frontend/components/widgets/ProjectHealthBrief.tsx`.
- ✓ **AI weekly recap** on the dashboard — short headline + 3-5 collapsible bullets, cached in-memory per-org for 12h. Includes 7-day high-risk delta in the payload.
- ✓ **Upgraded alerts** — `AlertsWidget` shows task name + AI reason + **Show plan** + **Why?** tooltip with deterministic math.
- ✓ **Prediction delta pills** — `TaskDto` carries the second-most-recent prediction so the table renders `Medium→High` / `Risk improved` / `+3d vs last`.
- ✓ **Five scenario types** of what-if — `UniformSlip`, `SingleTaskSlip`, `AddResource`, `WeatherPause`, `ScopeReduction`. Per-type math in `Models/Scenarios/ScenarioMath.cs`; AI service `/simulate` writes trade-aware narrative around the pre-computed delta. Legacy single-delay payloads still accepted.
- ✓ **Side-by-side comparison** — `POST /api/simulation/compare` runs up to 8 scenarios in parallel; redesigned `/simulation` page with project picker, scenario chips, inline config per type, comparison table coloured by direction.
- ✓ **Auto-suggest scenarios** — `POST /api/simulation/auto-suggest?projectId=...` asks the AI which 3-4 scenarios are worth running. Surfaced as a **Suggest scenarios** button and a **Show me what could go wrong** CTA on every project's health brief.
- ✓ **DB schema** — migration `20260503110826_AddProjectBriefAndScenarioColumns` adds `ProjectBriefs` and `Simulations.ScenarioType` / `ScenarioConfig` (jsonb) / `Headline` columns. Legacy `UniformSlip` rows from before the migration are left untouched.

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

## Migration notes

The migration `20260502090000_AddOrganizationsAndMultiTenancy` is **data-preserving**:

- Each existing user is given a personal organization called `"<User Name>'s workspace"` and added as **Owner**.
- Each user's old billing fields (`Plan`, `SubscriptionStatus`, etc.) are copied onto their new personal org, with `Trial` defaults filled in.
- Each existing project is moved from `Project.UserId` onto `Project.OrganizationId` (its old owner's new org), and `Project.UserId` is renamed to `Project.CreatedByUserId` for audit.
- The migration uses `pgcrypto.gen_random_uuid()` (auto-enabled), so it works on a fresh Postgres 13+ install with no manual setup.

If you're on a fresh database, the migration is a no-op for the backfill section and just creates the new tables.
