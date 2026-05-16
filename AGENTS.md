# Simulyn AI — agent guide

Construction risk co-pilot (multi-tenant SaaS). Monorepo: **.NET 8 API**, **FastAPI AI service**, **Next.js 14** frontend.

## Layout

| Path | Stack | Role |
|------|--------|------|
| `backend/Simulyn.Api` | .NET 8, EF Core, PostgreSQL, JWT | REST API, orchestration, persistence |
| `backend/Simulyn.Api.Tests` | xUnit | API tests (tenant isolation, billing, scenarios) |
| `ai-service` | Python 3.12, FastAPI | Deterministic risk math + LLM narratives |
| `frontend` | Next.js 14 App Router, Tailwind | Marketing, dashboard, simulation UI |
| `deploy/` | Docker Compose + Caddy | Production VPS |

## Local dev

```powershell
# Full stack (recommended)
docker compose up --build

# Or per README: manual terminals for ai-service, backend, frontend
copy .env.example .env   # optional LLM keys at repo root
```

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:5000 (Swagger: `/swagger`) |
| AI | http://localhost:8000 (`/health`) |

## Verify before PR

```powershell
cd backend/Simulyn.Api.Tests && dotnet test
cd ../../ai-service && python -m pytest -q
cd ../frontend && npx tsc --noEmit && npm run build
```

CI runs the same three jobs on push/PR to `main` (`.github/workflows/ci.yml`).

## Architecture essentials

- **Multi-tenancy**: every artifact belongs to an `Organization`. API calls send `X-Organization-Id`; resolve via `OrganizationContext`. Never leak data across orgs.
- **Roles**: Viewer < Member < Admin < Owner. Use `RequireRoleAsync` on mutating endpoints.
- **Predictions**: risk level and delay days are **deterministic** (rule engine / `ScenarioMath`). LLM only writes narrative (`summary`, `recommendation`, briefs, recaps).
- **API → AI**: `AiClientService` calls FastAPI when reachable; built-in fallback keeps demos working without the AI container.
- **Auth (current)**: JWT in `localStorage` via `frontend/lib/api.ts`. Phase 1.5 plans HttpOnly cookies.

## Product copy (keep consistent)

- Positioning: *construction risk co-pilot*, not "a dashboard"
- Tagline: **Predict. Explain. Act.**
- Feature names: *AI Project Health Brief*, *Weekly Look-Ahead*, *What-If Simulation Engine*, *Ask Simulyn*
- See `README.md` → Product positioning and `frontend/app/page.tsx` for landing copy rules

## Secrets

Never commit `.env`, `.env.local`, API keys, or real JWT signing keys. Use `.env.example` / `frontend/.env.local.example` / `ai-service/.env.example` as templates.

## Migrations

```powershell
cd backend/Simulyn.Api
dotnet ef migrations add YourMigrationName
```

API auto-applies migrations on startup in dev/Docker.
