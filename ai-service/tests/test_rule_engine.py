"""Tests for the deterministic rule engine and fallback text generators."""
from datetime import date, timedelta

from main import _fallback_predict_text, predict_delay


def test_predict_delay_on_track_zero_delay():
    today = date(2026, 1, 1)
    start = today
    end = today + timedelta(days=10)
    risk, delay, expected, gap = predict_delay(start, end, 0, today=today)
    assert delay == 0
    assert risk in {"Low", "Medium", "High"}
    assert 0 <= expected <= 100


def test_predict_delay_overdue_and_incomplete_is_high_risk():
    today = date(2026, 1, 20)
    start = date(2026, 1, 1)
    end = date(2026, 1, 10)
    risk, delay, _expected, _gap = predict_delay(start, end, 30, today=today)
    assert delay > 0
    assert risk == "High"


def test_predict_delay_completed_task_is_low_risk_zero_delay():
    today = date(2026, 1, 20)
    start = date(2026, 1, 1)
    end = date(2026, 1, 15)
    risk, delay, _expected, _gap = predict_delay(start, end, 100, today=today)
    assert delay == 0
    assert risk == "Low"


def test_fallback_predict_text_shapes():
    summary, rec = _fallback_predict_text("High", expected=60, progress=20)
    assert isinstance(summary, str) and summary
    assert isinstance(rec, str) and rec
