# Simulyn AI

SaaS-style platform for construction teams: project and task tracking, rule-based delay prediction (Phase 1), AI recommendations, what-if simulations, Excel schedule import, and a dashboard with alerts.

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

## Render + Neon deployment (quick)

Recommended for a free-tier friendly setup (containers + managed Postgres).

1. Create a Neon PostgreSQL database and copy its connection string.
2. Deploy `api`:
   - Build from `backend/Dockerfile`
   - Set env vars:
     - `ConnectionStrings__Default=<neon connection string>`
     - `Jwt__Key=<strong secret>`
     - `Jwt__Issuer=Simulyn.Api`, `Jwt__Audience=Simulyn.Clients`
     - `AiService__BaseUrl=<public URL of the ai-service>`
     - `Frontend__Origin=<your Render web URL>`
     - `PlatformAdminEmails=<your admin email(s)>`
3. Deploy `ai-service`:
   - Build from `ai-service/Dockerfile`
   - Port: 8000
4. Deploy `web`:
   - Build from `frontend/Dockerfile`
   - Build arg/env: `NEXT_PUBLIC_API_URL=<public URL of api service>`

If the AI service is temporarily unavailable (free tiers may sleep), the API automatically falls back to the built-in rule engine for predictions/simulation.

## Local development (without Docker)

### 1. Database

Create a database and user (or use defaults), then set `ConnectionStrings:Default` in `backend/Simulyn.Api/appsettings.json`.

### 2. Backend

```powershell
cd backend\Simulyn.Api
dotnet restore
dotnet run
```

- API: `http://localhost:5000` (see `Properties/launchSettings.json`)
- Swagger: `http://localhost:5000/swagger`

Set a strong `Jwt:Key` in configuration before production. For CORS, the default allowed origin is `http://localhost:3000` (`Frontend:Origin`).

### 3. AI service (optional)

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Point `AiService:BaseUrl` at `http://localhost:8000` (default in `appsettings.json`).

### 4. Frontend

```powershell
cd frontend
copy .env.local.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. Register a user, create a project and tasks, then run **Run prediction** or use **Simulation**.

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

## API summary (JWT required except auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/{id}` | Project detail |
| DELETE | `/api/projects/{id}` | Delete project |
| POST | `/api/projects/{id}/import-schedule` | Upload `.xlsx` schedule (multipart `file`) |
| GET | `/api/tasks/project/{projectId}` | List tasks |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/{id}` | Update task |
| POST | `/api/predictions/run` | Body: `{ "taskId" }` or `{ "projectId" }` |
| POST | `/api/simulation` | Body: `{ "projectId", "inputDelayDays" }` |
| GET | `/api/dashboard/summary` | Totals and alert counts |
| GET | `/api/dashboard/alerts` | Risk alerts |
| GET | `/api/me` | Current plan + entitlement |
| GET | `/api/admin/users` | Platform admin: list users (manual invoice plans) |
| POST | `/api/admin/users/{userId}/subscription` | Platform admin: set plan/status |

## Manual invoice plans (no Stripe yet)

This repo supports “sale mode” without payment processing:
- Users get `SubscriptionStatus=Trial` automatically on registration (30 days).
- Prediction and simulation endpoints require the user to be *entitled* (`Trial` not expired or `Active`).
- You can mark users as `Active` (or `Suspended` / `Inactive`) via the admin endpoints.

### Bootstrap a platform admin

Set environment variable `PlatformAdminEmails` (comma-separated) to at least one admin email.
That user gets `role=platform_admin` at registration, so they can access `/api/admin/*` endpoints.

## Deployment notes

- Frontend: Vercel (or any host for `next build` + `next start`; Docker image uses `output: "standalone"`).
- Backend: Azure App Service, AWS Elastic Beanstalk, or containers (`backend/Dockerfile`).
- DB: managed PostgreSQL; run migrations at deploy or on startup.
- AI: container (`ai-service/Dockerfile`); set `AiService:BaseUrl`.

## Roadmap (from product doc)

- Phase 2: ML model in Python (scikit-learn), richer features.
- Notifications: extend dashboard alerts with email/push.
- HTTPS: terminate TLS at the reverse proxy or load balancer.

## Pending for true “sale-ready” production SaaS

The repo now supports manual/invoice gating for predictions/simulation (no Stripe yet). To turn this into a robust SaaS suitable for real customers, the next additions are:

- Rate limiting and brute-force protection for auth and high-cost endpoints.
- Audit logs (who did what, when) for billing/admin actions and sensitive data changes.
- Password policy tightening (length/complexity), optional MFA later.
- Backups + restore strategy (Postgres/Neon), and migration rollout safety.
- Monitoring and alerting: error tracking (Sentry), structured logs, metrics, and uptime checks.
- Load/performance testing (baseline for API response < 500ms under expected concurrency).
- Real email notifications for risk alerts and delay warnings (at least high-risk).
- Multi-tenant “organization” model (org/project/tasks scoped by tenant) and RBAC (admin vs member vs viewer).

## What to add next (recommended order)

1. **Security & reliability baseline**
   - Add rate limiting middleware.
   - Add centralized error handling + consistent API error responses.
   - Add audit log persistence for key actions.
2. **Notifications**
   - Add email sender integration (e.g., Resend/SendGrid/SMTP).
   - Trigger emails when predictions detect `High` risk or when schedules cross a threshold.
3. **Multi-tenancy + RBAC**
   - Introduce `Organizations` and `OrganizationMembers`.
   - Replace `UserId` scoping with `OrganizationId` scoping for projects/tasks.
4. **Performance + ops**
   - Add load testing scripts and document tuning.
   - Add observability (metrics/traces) and deploy runbooks.
