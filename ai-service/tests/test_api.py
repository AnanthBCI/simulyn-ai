"""Black-box tests using FastAPI's TestClient. LLM is forced off in conftest.py so
these exercise the deterministic fallback paths end-to-end."""
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"


def test_predict_returns_shape_with_llm_off():
    r = client.post(
        "/predict",
        json={
            "task_id": "t-1",
            "task_name": "Foundation",
            "start_date": "2026-01-01",
            "end_date": "2026-01-10",
            "progress": 20,
            "project_start": "2026-01-01",
            "project_end": "2026-06-01",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert {"risk_level", "delay_days", "summary", "recommendation"}.issubset(body)
    assert body["risk_level"] in {"Low", "Medium", "High"}


def test_simulate_legacy_uniform_slip_shape():
    r = client.post(
        "/simulate",
        json={
            "project_id": "p-1",
            "project_name": "Tower B",
            "project_start": "2026-01-01",
            "project_end": "2026-06-01",
            "task_count": 1,
            "input_delay_days": 3,
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "predicted_delay" in body
    assert "impact_summary" in body
    assert "headline" in body
    assert body["scenario_type"] == "UniformSlip"


def test_project_brief_deterministic_fallback_shape():
    r = client.post(
        "/project-brief",
        json={
            "project_id": "p-1",
            "project_name": "Tower B",
            "project_start": "2026-01-01",
            "project_end": "2026-06-01",
            "task_count": 20,
            "high_risk_count": 2,
            "medium_risk_count": 5,
            "low_risk_count": 10,
            "unpredicted_count": 3,
            "avg_progress": 45,
            "expected_progress": 60,
            "days_to_finish": 80,
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "headline" in body
    assert "body" in body
    assert 0 <= body["health_score"] <= 100
