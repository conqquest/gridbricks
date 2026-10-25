"""Tests for analysis.py matching logic, cutoff handling, and metrics.

The fixtures below exercise get_analysis via direct injection so no HTTP calls
are made. We monkey-patch the two elexon fetch functions on the analysis module.
"""
from datetime import date, datetime, timedelta, timezone
from math import sqrt, isclose

import pytest

import app.services.analysis as analysis_module
from app.services.analysis import _metric_rows


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _utc(iso: str) -> datetime:
    """Parse a UTC ISO string with a Z suffix."""
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def _make_actual(start_iso: str, mw: float) -> dict:
    return {"startTime": start_iso, "actual": mw}


def _make_forecast(start_iso: str, publish_iso: str, mw: float) -> dict:
    return {"startTime": start_iso, "publishTime": publish_iso, "forecast": mw}


def _run(monkeypatch, actuals, forecasts, start=date(2026, 1, 1), end=date(2026, 1, 1), cutoff=10):
    """Call get_analysis with patched Elexon fetchers."""
    monkeypatch.setattr(analysis_module, "fetch_actuals", lambda *_: actuals)
    monkeypatch.setattr(analysis_module, "fetch_forecast_publications", lambda *_: forecasts)
    return analysis_module.get_analysis(start, end, cutoff)


# ---------------------------------------------------------------------------
# 1. HH interval matching: each hourly forecast pairs with :00 AND :30 actuals
# ---------------------------------------------------------------------------

class TestHalfHourMatching:
    def test_both_hh_actuals_are_matched_to_same_forecast_hour(self, monkeypatch):
        """A forecast for T must produce two observations: actual at T and T+30min."""
        actuals = [
            _make_actual("2026-01-01T06:00:00Z", 5000.0),
            _make_actual("2026-01-01T06:30:00Z", 4800.0),
        ]
        # Published 2026-01-01T04:00Z — well before cutoff (10:00 local = 10:00 UTC in Jan)
        forecasts = [
            _make_forecast("2026-01-01T06:00:00Z", "2026-01-01T04:00:00Z", 4900.0),
        ]
        result = _run(monkeypatch, actuals, forecasts)
        obs = result["observations"]
        # Both HH periods must be present
        assert len(obs) == 2
        starts = {o["startTime"] for o in obs}
        assert "2026-01-01T06:00:00+00:00" in starts
        assert "2026-01-01T06:30:00+00:00" in starts

    def test_both_observations_carry_same_forecast_mw(self, monkeypatch):
        """Both HH observations for the same hour share the hourly forecast value."""
        actuals = [
            _make_actual("2026-01-01T06:00:00Z", 5000.0),
            _make_actual("2026-01-01T06:30:00Z", 4800.0),
        ]
        forecasts = [
            _make_forecast("2026-01-01T06:00:00Z", "2026-01-01T04:00:00Z", 4900.0),
        ]
        result = _run(monkeypatch, actuals, forecasts)
        obs = result["observations"]
        for o in obs:
            assert o["forecast"] == 4900.0

    def test_error_computed_per_hh_period(self, monkeypatch):
        """Error = forecast - actual is computed individually for each HH period."""
        actuals = [
            _make_actual("2026-01-01T06:00:00Z", 5000.0),  # error = 4900 - 5000 = -100
            _make_actual("2026-01-01T06:30:00Z", 4800.0),  # error = 4900 - 4800 = +100
        ]
        forecasts = [
            _make_forecast("2026-01-01T06:00:00Z", "2026-01-01T04:00:00Z", 4900.0),
        ]
        result = _run(monkeypatch, actuals, forecasts)
        obs = sorted(result["observations"], key=lambda o: o["startTime"])
        assert obs[0]["error"] == -100.0   # :00 actual higher than forecast
        assert obs[1]["error"] == 100.0    # :30 actual lower than forecast

    def test_only_hh00_matched_when_hh30_missing(self, monkeypatch):
        """:30 actual absent -> only 1 observation produced for that hour."""
        actuals = [
            _make_actual("2026-01-01T06:00:00Z", 5000.0),
            # :30 deliberately absent
        ]
        forecasts = [
            _make_forecast("2026-01-01T06:00:00Z", "2026-01-01T04:00:00Z", 4900.0),
        ]
        result = _run(monkeypatch, actuals, forecasts)
        assert len(result["observations"]) == 1
        assert result["dataStatus"]["matchedPeriods"] == 1

    def test_no_match_when_all_actuals_missing(self, monkeypatch):
        """No actuals at all -> zero matched periods, not an exception."""
        forecasts = [
            _make_forecast("2026-01-01T06:00:00Z", "2026-01-01T04:00:00Z", 4900.0),
        ]
        result = _run(monkeypatch, [], forecasts)
        assert result["dataStatus"]["matchedPeriods"] == 0
        assert result["observations"] == []
        assert result["summary"]["matchedPeriods"] == 0
        assert result["summary"]["maeMw"] is None


# ---------------------------------------------------------------------------
# 2. Cutoff: forecast published AFTER cutoff must be excluded
# ---------------------------------------------------------------------------

class TestCutoffExclusion:
    def test_forecast_published_before_cutoff_is_included(self, monkeypatch):
        """Published at 04:00 UTC on D-1 is before 10:00 UK time on D-1 -> included."""
        actuals = [_make_actual("2026-01-01T06:00:00Z", 5000.0)]
        # 2025-12-31 04:00 UTC = 2025-12-31 04:00 UK (GMT in December) -> before cutoff 10:00
        forecasts = [
            _make_forecast("2026-01-01T06:00:00Z", "2025-12-31T04:00:00Z", 4900.0),
        ]
        result = _run(monkeypatch, actuals, forecasts, cutoff=10)
        assert result["dataStatus"]["matchedPeriods"] >= 1

    def test_forecast_published_after_cutoff_is_excluded(self, monkeypatch):
        """Published at 11:00 UTC (= 11:00 UK) on D-1 is after cutoff 10:00 -> excluded."""
        actuals = [_make_actual("2026-01-01T06:00:00Z", 5000.0)]
        forecasts = [
            _make_forecast("2026-01-01T06:00:00Z", "2025-12-31T11:00:00Z", 4900.0),
        ]
        result = _run(monkeypatch, actuals, forecasts, cutoff=10)
        assert result["dataStatus"]["matchedPeriods"] == 0

    def test_forecast_published_exactly_at_cutoff_is_included(self, monkeypatch):
        """Cutoff rule is published <= cutoff_utc (inclusive boundary)."""
        actuals = [_make_actual("2026-01-01T06:00:00Z", 5000.0)]
        # 2025-12-31 10:00:00 UTC exactly = cutoff for cutoff_hour=10 in January (UTC==GMT)
        forecasts = [
            _make_forecast("2026-01-01T06:00:00Z", "2025-12-31T10:00:00Z", 4900.0),
        ]
        result = _run(monkeypatch, actuals, forecasts, cutoff=10)
        assert result["dataStatus"]["matchedPeriods"] >= 1

    def test_latest_pre_cutoff_snapshot_is_selected(self, monkeypatch):
        """When multiple snapshots exist before cutoff, the most recent is chosen."""
        actuals = [_make_actual("2026-01-01T06:00:00Z", 5000.0)]
        forecasts = [
            _make_forecast("2026-01-01T06:00:00Z", "2025-12-31T02:00:00Z", 4000.0),  # early
            _make_forecast("2026-01-01T06:00:00Z", "2025-12-31T09:00:00Z", 5200.0),  # latest before cutoff
        ]
        result = _run(monkeypatch, actuals, forecasts, cutoff=10)
        obs = result["observations"]
        assert len(obs) == 1
        assert obs[0]["forecast"] == 5200.0  # latest snapshot chosen

    def test_target_date_outside_requested_range_is_excluded(self, monkeypatch):
        """Forecast whose startTime is outside [start_date, end_date] is filtered out."""
        actuals = [_make_actual("2026-01-02T06:00:00Z", 5000.0)]  # Jan 2
        forecasts = [
            # startTime is Jan 2, but our range is only Jan 1
            _make_forecast("2026-01-02T06:00:00Z", "2026-01-01T04:00:00Z", 4900.0),
        ]
        result = _run(monkeypatch, actuals, forecasts, start=date(2026, 1, 1), end=date(2026, 1, 1))
        assert result["dataStatus"]["matchedPeriods"] == 0


# ---------------------------------------------------------------------------
# 3. Metric calculations: MAE, RMSE, bias, WAPE
# ---------------------------------------------------------------------------

class TestMetrics:
    def test_mae_is_mean_absolute_error(self):
        rows = [
            {"forecast": 3000, "actual": 2000},  # error +1000
            {"forecast": 2500, "actual": 2800},  # error  -300
            {"forecast": 2200, "actual": 2000},  # error  +200
        ]
        result = _metric_rows(rows)
        expected_mae = (1000 + 300 + 200) / 3   # 500.0
        assert result["maeMw"] == round(expected_mae, 2)

    def test_rmse_exceeds_mae_when_errors_unequal(self):
        """RMSE >= MAE always; strict inequality when errors are not all equal."""
        rows = [
            {"forecast": 3000, "actual": 2000},
            {"forecast": 2500, "actual": 2800},
            {"forecast": 2200, "actual": 2000},
        ]
        result = _metric_rows(rows)
        assert result["rmseMw"] > result["maeMw"]

    def test_rmse_equals_mae_when_all_errors_identical(self):
        """When all |errors| are the same, RMSE == MAE."""
        rows = [
            {"forecast": 3000, "actual": 2500},  # |error| = 500
            {"forecast": 2000, "actual": 1500},  # |error| = 500
        ]
        result = _metric_rows(rows)
        assert result["rmseMw"] == result["maeMw"]

    def test_rmse_computed_correctly(self):
        rows = [
            {"forecast": 3000, "actual": 2000},  # error +1000
            {"forecast": 2500, "actual": 2800},  # error -300
            {"forecast": 2200, "actual": 2000},  # error +200
        ]
        expected_rmse = sqrt((1000**2 + 300**2 + 200**2) / 3)
        result = _metric_rows(rows)
        assert isclose(result["rmseMw"], round(expected_rmse, 2), rel_tol=1e-6)

    def test_bias_is_mean_signed_error(self):
        """Bias = mean(forecast - actual); positive means systematic over-forecast."""
        rows = [
            {"forecast": 3000, "actual": 2000},  # +1000
            {"forecast": 2500, "actual": 2800},  # -300
            {"forecast": 2200, "actual": 2000},  # +200
        ]
        result = _metric_rows(rows)
        expected_bias = (1000 - 300 + 200) / 3  # 300.0
        assert result["biasMw"] == round(expected_bias, 2)

    def test_negative_bias_for_under_forecast(self):
        """Consistent under-forecasting produces a negative bias."""
        rows = [
            {"forecast": 1000, "actual": 2000},  # -1000
            {"forecast": 1500, "actual": 2500},  # -1000
        ]
        result = _metric_rows(rows)
        assert result["biasMw"] == -1000.0

    def test_wape_is_sum_abs_error_over_sum_abs_actual(self):
        rows = [
            {"forecast": 3000, "actual": 2000},  # |error| = 1000
            {"forecast": 2500, "actual": 2800},  # |error| =  300
            {"forecast": 2200, "actual": 2000},  # |error| =  200
        ]
        total_abs_error = 1000 + 300 + 200
        total_abs_actual = 2000 + 2800 + 2000
        expected_wape = (total_abs_error / total_abs_actual) * 100
        result = _metric_rows(rows)
        assert result["wapePercent"] == round(expected_wape, 2)

    def test_wape_is_none_when_all_actuals_zero(self):
        """Avoid division by zero -- WAPE should be None when actual sum is zero."""
        rows = [
            {"forecast": 1000, "actual": 0},
            {"forecast": 500, "actual": 0},
        ]
        result = _metric_rows(rows)
        assert result["wapePercent"] is None

    def test_empty_rows_all_metrics_none(self):
        result = _metric_rows([])
        assert result["matchedPeriods"] == 0
        assert result["maeMw"] is None
        assert result["rmseMw"] is None
        assert result["biasMw"] is None
        assert result["wapePercent"] is None

    def test_matched_periods_count_is_len_rows(self):
        rows = [{"forecast": 100, "actual": 90}] * 7
        assert _metric_rows(rows)["matchedPeriods"] == 7


# ---------------------------------------------------------------------------
# 4. Daily aggregation structure
# ---------------------------------------------------------------------------

class TestDailyAggregation:
    def test_daily_metrics_keyed_by_date(self, monkeypatch):
        actuals = [
            _make_actual("2026-01-01T06:00:00Z", 5000.0),
            _make_actual("2026-01-01T06:30:00Z", 4800.0),
        ]
        forecasts = [
            _make_forecast("2026-01-01T06:00:00Z", "2025-12-31T04:00:00Z", 4900.0),
        ]
        result = _run(monkeypatch, actuals, forecasts)
        assert len(result["daily"]) == 1
        assert result["daily"][0]["date"] == "2026-01-01"
        assert result["daily"][0]["matchedPeriods"] == 2

    def test_summary_matches_all_observations(self, monkeypatch):
        """Summary metrics must cover all observations across all days."""
        actuals = [
            _make_actual("2026-01-01T06:00:00Z", 5000.0),
            _make_actual("2026-01-01T06:30:00Z", 4800.0),
        ]
        forecasts = [
            _make_forecast("2026-01-01T06:00:00Z", "2025-12-31T04:00:00Z", 4900.0),
        ]
        result = _run(monkeypatch, actuals, forecasts)
        assert result["summary"]["matchedPeriods"] == len(result["observations"])
