"""
Simulyn AI — Phase 1 rule-based engine. Phase 2 can swap internals for sklearn models.
"""
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Simulyn AI Engine", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _parse(d: str) -> date:
    return datetime.strptime(d[:10], "%Y-%m-%d").date()


def predict_delay(
    task_start: date,
    task_end: date,
    progress: int,
    today: Optional[date] = None,
) -> tuple[str, int, str, str]:
    """Expected progress = elapsed / total duration; compare to actual."""
    t = today or date.today()
    total_days = max(1, (task_end - task_start).days)
    elapsed = max(0, min((t - task_start).days, total_days))
    expected = round(100.0 * elapsed / total_days) if total_days else 100
    gap = expected - progress

    if gap <= 5:
        risk = "Low"
        delay_days = max(0, gap // 5)
    elif gap <= 15:
        risk = "Medium"
        delay_days = max(1, gap // 3)
    else:
        risk = "High"
        delay_days = max(2, gap // 2)

    summary = f"Expected progress ~{expected}% vs actual {progress}%."
    if risk == "High":
        rec = (
            "• Add 2 workers\n"
            "• Increase working hours\n"
            "• Re-sequence dependent trades"
        )
    elif risk == "Medium":
        rec = "• Add 1 worker or extend shift\n• Review blockers daily"
    else:
        rec = "• Monitor weekly; no immediate action"

    return risk, delay_days, summary, rec


class PredictIn(BaseModel):
    task_id: str
    task_name: str
    start_date: str
    end_date: str
    progress: int = Field(ge=0, le=100)
    project_start: str
    project_end: str


class PredictOut(BaseModel):
    risk_level: str
    delay_days: int
    summary: str
    recommendation: str


@app.post("/predict", response_model=PredictOut)
def predict(body: PredictIn) -> PredictOut:
    ts, te = _parse(body.start_date), _parse(body.end_date)
    risk, delay_days, summary, rec = predict_delay(ts, te, body.progress)
    return PredictOut(
        risk_level=risk,
        delay_days=delay_days,
        summary=summary,
        recommendation=rec,
    )


class SimulateIn(BaseModel):
    project_id: str
    input_delay_days: int = Field(ge=0)
    project_start: str
    project_end: str
    task_count: int = Field(ge=0)


class SimulateOut(BaseModel):
    predicted_delay: int
    impact_summary: str


@app.post("/simulate", response_model=SimulateOut)
def simulate(body: SimulateIn) -> SimulateOut:
    ps, pe = _parse(body.project_start), _parse(body.project_end)
    predicted = round(body.input_delay_days * (1 + body.task_count * 0.05))
    new_end = pe + timedelta(days=predicted)
    impact = (
        f"With an input slip of {body.input_delay_days} day(s), the model estimates "
        f"~{predicted} day(s) impact on the project finish "
        f"(new end ≈ {new_end.isoformat()}, {body.task_count} tasks in scope)."
    )
    return SimulateOut(predicted_delay=predicted, impact_summary=impact)


@app.get("/health")
def health():
    return {"status": "ok"}
