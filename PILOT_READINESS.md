# Pilot-readiness changes & deployment migration guide

This document is the single source of truth for the pilot-readiness sprint
completed on **May 7-9, 2026**. It captures:

1. **What changed** in the codebase, grouped by surface area.
2. **What you must update on Render / Vercel / Neon / Stripe** to bring an
   already-deployed environment up to parity. Skip any section whose feature
   you don't use yet.
3. A **post-deploy verification checklist**.

> **Why this exists:** the local code now contains breaking config-key renames
> and new required env vars. A naive `git pull && deploy` against the existing
> Render/Vercel stack will boot but silently lose Email and Budget enforcement
> until the dashboard env vars are updated.

---

## Table of contents

- [Codebase changes](#codebase-changes)
  - [Backend (.NET API) — critical](#backend-net-api--critical)
  - [Backend — security & correctness](#backend--security--correctness)
  - [AI service](#ai-service)
  - [Frontend (Next.js)](#frontend-nextjs)
  - [Tests](#tests)
  - [Deploy / docker-compose / CI](#deploy--docker-compose--ci)
  - [Documentation](#documentation)
- [Deployment migration guide](#deployment-migration-guide)
  - [Render — `simulyn-api` service](#render--simulyn-api-service)
  - [Render — `simulyn-ai` service](#render--simulyn-ai-service)
  - [Vercel — `simulyn-web`](#vercel--simulyn-web)
  - [Neon — Postgres](#neon--postgres)
  - [Stripe — webhook events](#stripe--webhook-events)
  - [Resend — email (when you're ready)](#resend--email-when-youre-ready)
- [Post-deploy verification](#post-deploy-verification)
- [Rollout strategy (zero-downtime)](#rollout-strategy-zero-downtime)

---

## Codebase changes

### Backend (.NET API) — critical

| Area | What changed | Why |
|---|---|---|
| **Secrets out of `appsettings.json`** | `ConnectionStrings:Default` and `Jwt:Key` removed. Startup throws `InvalidOperationException` if they aren't supplied via env vars (or `appsettings.Development.json` for local dev). | Stops accidental commit of dev secrets and forces explicit prod config. |
| **Middleware order** | `UseAuthentication()` and `UseAuthorization()` now run **before** `UseRateLimiter()` in `Program.cs`. | Previously, anonymous floods could exhaust the per-user rate-limit bucket of authenticated users. |
| **Global exception handler** | `UseExceptionHandler` returns RFC 7807 `ProblemDetails` (`type`, `title`, `status`, `traceId`, `detail`). Stack traces never leak in `Production`. | Single error contract for the frontend; correlatable via `traceId`. |
| **Swagger gated** | Swagger UI mounts only when `Environment.IsDevelopment()`. | Don't expose schema in prod. |
| **Auto-migrations gated** | `db.Database.MigrateAsync()` runs only when `Environment.IsDevelopment()` **or** `RunMigrationsOnStartup=true`. | Prevents accidental destructive migrations on prod when you scale beyond one replica. Keep `true` on Render single-replica. |
| **`/healthz/ready` endpoint** | New endpoint that pings DB (`SELECT 1`) and AI service (`/health`). Returns `503` if either is down. | Lets Render / Caddy do real readiness checks, not just "process is up". |
| **`PredictionService` background DbContext leak** | Fire-and-forget `Task.Run(NotifyHighRiskAsync)` now creates its own `IServiceScope`. | Was using a disposed scoped `AppDbContext` after the request ended → intermittent `ObjectDisposedException`. |
| **`AiEntitlement` service (new)** | Centralized guard. Every LLM-touching endpoint calls `GuardAsync` (returns `402` if not entitled, `429` if over hard cap, warning header on soft cap) and `RecordAsync` after success. Wired into `Chat`, `Projects.Brief/Sample/SampleBundle`, `Simulations.Run/Compare/AutoSuggest`, `Dashboard.WeeklyRecap`. | Previously the LLM budget was checked in 0-1 places. Now a single org can't blow past its daily cap. |

### Backend — security & correctness

| Area | What changed | Why |
|---|---|---|
| **Email enumeration in invite** | `POST /api/organizations/{id}/members` now returns `202 Accepted` for both existing and unknown emails. | Was leaking which emails had accounts. |
| **N+1 in `Mine` and `AdminBilling`** | New static `BillingService.IsEntitled(status, expiresAt)` evaluated in-process from a single query. | Was making 1 DB roundtrip per org × per request. |
| **Stripe webhook idempotency** | New `ProcessedStripeEvents` table + unique index on `EventId`. Each webhook checks first; duplicates are no-ops. New migration: `*_AddProcessedStripeEvents.cs`. | Stripe retries webhooks aggressively. Without this, `checkout.session.completed` could double-activate. |
| **Stripe `customer.subscription.updated`** | Added handler. Updates `Organization.SubscriptionStatus` + `SubscriptionExpiresAt` on plan changes. | Was previously only reacting to `deleted` / `paused` — plan upgrades silently went un-reflected. |
| **Explicit `SaveChangesAsync(ct)` in billing handlers** | `ActivateOrgAsync`, `SuspendOrgAsync`, `UpdateOrgSubscriptionAsync` now call save explicitly. | Was relying on incidental save calls. |

### AI service

- **Empty-project health-score guard** — `_compute_health_score` returns `50` (neutral) when `task_count <= 0`. Mirrors the equivalent guard added to `ProjectsController.DeterministicHealthScore`. Fixes a misleading "100% healthy" badge on a project with no tasks loaded yet.

### Frontend (Next.js)

| File | What changed |
|---|---|
| `app/error.tsx` (new) | Per-route error boundary with "Try again" + back-to-dashboard, surfaces `error.digest` for support tickets. |
| `app/global-error.tsx` (new) | Root error boundary that renders even if the layout itself blew up. Minimal HTML, no Tailwind. |
| `app/not-found.tsx` (new) | Friendly 404 with links back to dashboard + home. |
| `lib/api.ts` | New `ApiError` class (status, body, traceId, retryAfterSeconds). Parses ProblemDetails. Emits `onAuthExpired` event on 401 → cleared local token + redirect to `/login?next=…`. Centralized retry guidance for 429/503. |
| `components/Shell.tsx` | Subscribes to `onAuthExpired` → clears token, resets user state, redirects to `/login?next=` preserving the original path. |
| `app/login/page.tsx` | Reads `?next=` and redirects there post-login (validated against same origin). Wrapped in `<Suspense>` for `useSearchParams`. |
| `app/page.tsx` | Footer Privacy/Terms links now point at `/privacy` and `/terms` (were `href="#"`). Pricing CTAs route to `/register?plan=pro` etc., which then forwards to billing. |
| `app/register/page.tsx` | Reads `?plan=…` from marketing CTAs and forwards to `/admin/billing?plan=…` after sign-up so the user lands on Stripe checkout. |
| `app/projects/[id]/page.tsx` | Listens for `simulyn:org-changed` event → redirects to `/projects` so the user doesn't see stale data from the previous org. |
| `components/widgets/BudgetStatusWidget.tsx` (new) | Dashboard widget showing AI spend vs soft/hard caps. Hides itself when usage is low; shows warning at soft cap; shows blocking message + billing link at hard cap. |
| `app/dashboard/page.tsx` | Mounts `<BudgetStatusWidget />`. |

### Tests

- **Target framework** — `Simulyn.Api.Tests.csproj` was wrongly `net10.0`; now `net8.0` to match the API.
- **`StripeWebhookSignatureTests` (new)** — covers missing signature header, forged signature, and unconfigured webhook secret cases.
- **`BillingServiceTests` extended** — `[Theory]` coverage for the new static `IsEntitled(status, expiresAt)` helper across all subscription-status × expiry combinations.

### Deploy / docker-compose / CI

- **Env-var key renames in `deploy/docker-compose.prod.yml`** (the .NET code never read the old keys — these were silent no-ops):

  | Old (broken) | New (correct) |
  |---|---|
  | `Resend__ApiKey` | `Email__Resend__ApiKey` |
  | `Resend__FromAddress` | `Email__FromAddress` |
  | `Resend__AppUrl` | `Email__AppUrl` |
  | `Budget__DailyLlmUsdSoft` (dollars) | `Budget__SoftCapMills` (mills, ×1000) |
  | `Budget__DailyLlmUsdHard` (dollars) | `Budget__HardCapMills` (mills, ×1000) |
  | `Stripe__PriceProMonthly` (and similar) | `Stripe__Prices__Pro` / `__Team` / `__Business` |

- **`RunMigrationsOnStartup: "true"`** added to the `api` service so the gated-migration change above doesn't break the single-replica VPS deploy.
- **Healthchecks** added to `api`, `web`, and `ai` services.
- **`deploy/.env.prod.example`** updated to mirror all of the above (now the canonical template).

### Documentation

- **`README.md`** refactored from 1263 → 1148 lines: deduplicated, added Table of Contents, restructured for logical flow (overview → quickstart → config → deploy → API reference → roadmap).
- **`README.md` → Email delivery section** rewritten as a 3-mode table (Console / Resend test sender / Verified domain) with a step-by-step pilot upgrade path.

---

## Deployment migration guide

You said the existing **Vercel + Render + Neon** stack is already live. Below is everything you need to update there. Nothing else changes — same regions, same services, same DNS.

### Render — `simulyn-api` service

This service has the most changes. Open **Dashboard → simulyn-api → Environment** and apply the following.

#### 1. Add new required env vars (or the API will refuse to start)

These were previously optional / read from `appsettings.json`. They are now mandatory:

| Key | Value |
|---|---|
| `ConnectionStrings__Default` | Your Neon pooled connection string, e.g. `Host=ep-xxxx.neon.tech;Database=simulyn;Username=…;Password=…;Ssl Mode=Require;Trust Server Certificate=true;Pooling=true` |
| `Jwt__Key` | A ≥32-char random string. **Use the same value you already have** — rotating it logs everyone out. If unset, generate with `openssl rand -base64 48` and save it for future deploys. |
| `RunMigrationsOnStartup` | `true` (single-replica Render — the API will run pending migrations on boot) |
| `ASPNETCORE_ENVIRONMENT` | `Production` (set if not already) |

If you *don't* have these set, the new build will fail fast on startup with a clear error message — that's intentional, not a regression.

#### 2. Rename email env vars

| Delete (old) | Create (new) | Notes |
|---|---|---|
| `Resend__ApiKey` | `Email__Resend__ApiKey` | Same value. Leave **empty** for now per your decision; emails will log to Render's stdout until you add a verified domain. |
| `Resend__FromAddress` | `Email__FromAddress` | e.g. `Simulyn AI <onboarding@resend.dev>` for Resend test mode, or `Simulyn AI <noreply@yourdomain.com>` once your domain is verified. |
| `Resend__AppUrl` | `Email__AppUrl` | Your Vercel URL, e.g. `https://app.simulyn.ai` (or your `*.vercel.app` until DNS is set up). **Critical** — this is what the password-reset link in emails uses. |
| — | `Email__Provider` (optional) | `auto` (default — uses Resend if API key is set, else Console). Set explicitly to `console` to force stdout logging even with a key present. |

#### 3. Rename budget env vars (units changed)

| Delete (old, dollars) | Create (new, mills) | Conversion |
|---|---|---|
| `Budget__DailyLlmUsdSoft` (e.g. `5`) | `Budget__SoftCapMills` (e.g. `5000`) | Multiply old value by 1000 |
| `Budget__DailyLlmUsdHard` (e.g. `20`) | `Budget__HardCapMills` (e.g. `20000`) | Multiply old value by 1000 |

If you never set these, the defaults are `5000` / `20000` (= $5 soft / $20 hard per org per day) — fine for pilot.

#### 4. Rename Stripe price env vars

The old `Stripe__PriceXxx` keys are not read. The new code uses `Stripe__Prices__<PlanName>`:

| Delete (old) | Create (new) |
|---|---|
| `Stripe__PriceProMonthly` (or whatever you used) | `Stripe__Prices__Pro` = `price_…` |
| (any team plan key) | `Stripe__Prices__Team` = `price_…` *(only if you sell this tier)* |
| (any business plan key) | `Stripe__Prices__Business` = `price_…` *(only if you sell this tier)* |

`Stripe__ApiKey`, `Stripe__WebhookSecret`, `Stripe__SuccessUrl`, `Stripe__CancelUrl` are unchanged — leave them alone.

#### 5. Confirm CORS allow-list

`Frontend__Origin` should be your production Vercel domain, e.g. `https://app.simulyn.ai` (no trailing slash). Comma-separated for multiple. Already set if you went through the original deploy.

#### 6. Confirm AI service URL

`AiService__BaseUrl` should still be your `simulyn-ai` Render internal URL (e.g. `https://simulyn-ai.onrender.com`). No change.

#### 7. Health-check path

In **Render → Settings → Health Check Path**, change from `/healthz` to **`/healthz/ready`**. The new endpoint actually verifies DB + AI connectivity, so Render will mark the instance unhealthy if either is down — much better than the old "process is alive" check.

### Render — `simulyn-ai` service

**No changes required.** Same env vars (`LLM_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, etc.). The only code change was a tiny health-score guard which doesn't need config.

### Vercel — `simulyn-web`

**No env-var changes required.** `NEXT_PUBLIC_API_URL` stays the same.

You will, however, redeploy after merge so the new `error.tsx` / `not-found.tsx` / `BudgetStatusWidget` / pricing CTA changes ship. Vercel auto-redeploys on push to `main`; no manual step.

> **Tip:** if you've configured a Vercel project setting like *Production Branch* or have preview deployments, the merge-to-main flow handles everything. Otherwise `vercel --prod` from the `frontend/` directory.

### Neon — Postgres

**No changes required.** The new migration (`AddProcessedStripeEvents`) will be applied automatically on the next API boot because of `RunMigrationsOnStartup=true`.

If you prefer to run it manually first (recommended for paid Neon tiers where you want zero migration-on-boot risk), from a local checkout:

```powershell
$env:ConnectionStrings__Default="<your_neon_connection_string>"
dotnet ef database update --project backend\Simulyn.Api\Simulyn.Api.csproj
```

Then in Render set `RunMigrationsOnStartup=false` for the prod API.

### Stripe — webhook events

The webhook URL doesn't change. But you must **add `customer.subscription.updated` to the subscribed events** so plan upgrades land:

1. Stripe Dashboard → **Developers → Webhooks** → click your existing endpoint (`https://api.yourdomain.com/api/billing/webhook`).
2. Click **… → Update details → Select events**.
3. Ensure ALL of these are checked:
   - `checkout.session.completed`
   - `customer.subscription.updated`  ← **new**
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
4. Save. The signing secret is unchanged.

### Resend — email (when you're ready)

You decided to **defer** email setup. Until then, `Email__Resend__ApiKey` stays empty in Render and reset/invite/recap emails log to Render's stdout (visible in **Logs**). Fully functional, just not delivered.

When you're pilot-ready, follow the [README → Email delivery → Upgrading to Mode C](README.md#email-delivery-resend) steps:

1. Buy domain.
2. Add to Resend.
3. Add 3-4 DNS records.
4. Verify in Resend.
5. Set `Email__Resend__ApiKey` + `Email__FromAddress="Simulyn AI <noreply@yourdomain.com>"` in Render → Environment.
6. Redeploy (Render auto-restarts on env-var change).

---

## Post-deploy verification

After applying the env-var changes and redeploying, run through this checklist (~5 min):

- [ ] **API boots cleanly.** Render logs show `Now listening on http://[::]:8080` and no `InvalidOperationException` about `ConnectionStrings:Default` or `Jwt:Key`.
- [ ] **`/healthz` returns 200.** `curl https://api.yourdomain.com/healthz`
- [ ] **`/healthz/ready` returns 200.** Confirms DB + AI service reachable. `curl https://api.yourdomain.com/healthz/ready`
- [ ] **Migration applied.** Connect to Neon (or run `dotnet ef migrations list` against it) — should see `AddProcessedStripeEvents` in `__EFMigrationsHistory`.
- [ ] **Login still works** with your existing platform-admin account. (If `Jwt__Key` was changed, everyone is logged out — re-login with same password.)
- [ ] **Predictions still run.** Create a tiny project or load a sample → `/projects/{id}` → AI brief generates within ~10s.
- [ ] **Billing page loads** without 500. `/admin/billing`. Confirms the new static `BillingService.IsEntitled` and AI entitlement wiring didn't regress.
- [ ] **Stripe webhook handshake.** Stripe Dashboard → your webhook → **Send test webhook** → `checkout.session.completed`. Should return `200`. Send the same test event twice — second one should also `200` (idempotency working).
- [ ] **Forgot-password flow.** Submit a reset request → check Render API logs → see the reset link printed (because Resend isn't configured) → paste link into a browser → reset works. *(You're explicitly running without email for now; this is the expected behavior until you set up the verified domain.)*
- [ ] **Frontend redeploy succeeded.** Vercel deployment shows green; the homepage footer Privacy/Terms links resolve; pricing CTAs go to `/register?plan=pro`.
- [ ] **Budget widget visible** on `/dashboard` after a few AI calls (it self-hides when usage is low — that's intentional).

If any item fails, the API logs (Render → simulyn-api → Logs) will have a `traceId` you can grep for. ProblemDetails responses also surface that traceId to the frontend.

---

## Rollout strategy (zero-downtime)

Recommended order to avoid any user-facing interruption:

1. **Update Render env vars first** (don't redeploy yet — Render queues changes).
2. **Update Stripe webhook events** (additive — old events still fire, new one starts firing too).
3. **Merge code to `main`.** Vercel auto-deploys frontend (~2 min). Render auto-deploys API (~3-5 min).
4. **Watch Render logs** during the API restart for the migration to apply. You'll see `Applied migration … AddProcessedStripeEvents`.
5. **Run the verification checklist** above.

If anything goes sideways, **rollback in Render** is one click (Deployments → previous build → Redeploy). The new migration is additive (only creates a new table), so it's safe to leave applied even on a code rollback.

---

*Generated as part of the May 2026 pilot-readiness sprint. For the underlying review that produced this list, see the chat transcript referenced in the project history.*
