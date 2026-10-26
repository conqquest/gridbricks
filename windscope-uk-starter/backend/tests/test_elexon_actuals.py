"""Tests for elexon.py FUELHH chunking logic and fetch_actuals.

All tests mock requests.get so no live API calls are made.
Tests cover:
  - _date_chunks: boundary correctness for 1 day, 7 days, 8 days, 31 days
  - fetch_actuals: correct HTTP params per chunk, response merging,
    non-WIND filtering, HTTP error propagation
"""
from datetime import date, timedelta
from unittest.mock import MagicMock, call, patch

import pytest
import requests

from app.services.elexon import (
    FUELHH_CHUNK_DAYS,
    _date_chunks,
    fetch_actuals,
)


# ---------------------------------------------------------------------------
# _date_chunks — pure logic, no mocking required
# ---------------------------------------------------------------------------

class TestDateChunks:
    def _list(self, start, end, chunk_days=7):
        return list(_date_chunks(start, end, chunk_days))

    def test_single_day_produces_one_chunk(self):
        chunks = self._list(date(2026, 1, 1), date(2026, 1, 1))
        assert chunks == [(date(2026, 1, 1), date(2026, 1, 1))]

    def test_exactly_7_days_is_one_chunk(self):
        """Jan 1 – Jan 7 inclusive = 7 days, must fit in one chunk."""
        chunks = self._list(date(2026, 1, 1), date(2026, 1, 7))
        assert chunks == [(date(2026, 1, 1), date(2026, 1, 7))]

    def test_8_days_splits_into_two_chunks(self):
        """Jan 1 – Jan 8 = 8 days -> (Jan 1, Jan 7) + (Jan 8, Jan 8)."""
        chunks = self._list(date(2026, 1, 1), date(2026, 1, 8))
        assert chunks == [
            (date(2026, 1, 1), date(2026, 1, 7)),
            (date(2026, 1, 8), date(2026, 1, 8)),
        ]

    def test_january_2026_splits_into_5_chunks(self):
        """31-day January: ceil(31/7) = 5 chunks, last is 3 days."""
        chunks = self._list(date(2026, 1, 1), date(2026, 1, 31))
        assert len(chunks) == 5
        assert chunks[0] == (date(2026, 1, 1),  date(2026, 1, 7))
        assert chunks[1] == (date(2026, 1, 8),  date(2026, 1, 14))
        assert chunks[2] == (date(2026, 1, 15), date(2026, 1, 21))
        assert chunks[3] == (date(2026, 1, 22), date(2026, 1, 28))
        assert chunks[4] == (date(2026, 1, 29), date(2026, 1, 31))

    def test_chunks_are_contiguous_and_non_overlapping(self):
        """For any range, chunk boundaries tile perfectly with no gap or overlap."""
        chunks = self._list(date(2026, 1, 1), date(2026, 1, 31))
        all_days = set()
        for start, end in chunks:
            d = start
            while d <= end:
                assert d not in all_days, f"Duplicate day {d}"
                all_days.add(d)
                d += timedelta(days=1)
        expected = {date(2026, 1, 1) + timedelta(days=i) for i in range(31)}
        assert all_days == expected

    def test_chunks_respect_custom_chunk_days(self):
        """chunk_days=3: Jan 1-9 -> (1,3),(4,6),(7,9)."""
        chunks = self._list(date(2026, 1, 1), date(2026, 1, 9), chunk_days=3)
        assert chunks == [
            (date(2026, 1, 1), date(2026, 1, 3)),
            (date(2026, 1, 4), date(2026, 1, 6)),
            (date(2026, 1, 7), date(2026, 1, 9)),
        ]

    def test_last_chunk_clamps_to_end_date(self):
        """The final chunk must not extend past end_date."""
        chunks = self._list(date(2026, 1, 1), date(2026, 1, 10))
        assert chunks[-1][1] == date(2026, 1, 10)


# ---------------------------------------------------------------------------
# Helpers for mocking requests.get
# ---------------------------------------------------------------------------

def _mock_response(rows, status_code=200):
    """Return a MagicMock that behaves like a successful requests.Response."""
    m = MagicMock()
    m.status_code = status_code
    m.json.return_value = {"data": rows}
    m.raise_for_status = MagicMock()  # no-op for 200
    return m


def _wind_row(start_time: str, generation: float):
    return {"fuelType": "WIND", "startTime": start_time, "generation": generation}


def _other_row(start_time: str):
    """Non-WIND row that must be filtered out."""
    return {"fuelType": "SOLAR", "startTime": start_time, "generation": 999.0}


# ---------------------------------------------------------------------------
# fetch_actuals — behaviour tests
# ---------------------------------------------------------------------------

class TestFetchActuals:

    def test_single_day_makes_one_http_call(self):
        resp = _mock_response([_wind_row("2026-01-01T00:00:00Z", 1000.0)])
        with patch("app.services.elexon.requests.get", return_value=resp) as mock_get:
            result = fetch_actuals(date(2026, 1, 1), date(2026, 1, 1))
        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        assert kwargs["params"]["settlementDateFrom"] == "2026-01-01"
        assert kwargs["params"]["settlementDateTo"] == "2026-01-01"
        assert len(result) == 1

    def test_exactly_7_days_makes_one_http_call(self):
        resp = _mock_response([_wind_row("2026-01-01T00:00:00Z", 1000.0)])
        with patch("app.services.elexon.requests.get", return_value=resp) as mock_get:
            fetch_actuals(date(2026, 1, 1), date(2026, 1, 7))
        mock_get.assert_called_once()
        _, kwargs = mock_get.call_args
        assert kwargs["params"]["settlementDateFrom"] == "2026-01-01"
        assert kwargs["params"]["settlementDateTo"] == "2026-01-07"

    def test_8_days_makes_two_http_calls_with_correct_date_params(self):
        resp = _mock_response([])
        with patch("app.services.elexon.requests.get", return_value=resp) as mock_get:
            fetch_actuals(date(2026, 1, 1), date(2026, 1, 8))
        assert mock_get.call_count == 2
        call1_params = mock_get.call_args_list[0][1]["params"]
        call2_params = mock_get.call_args_list[1][1]["params"]
        assert call1_params["settlementDateFrom"] == "2026-01-01"
        assert call1_params["settlementDateTo"]   == "2026-01-07"
        assert call2_params["settlementDateFrom"] == "2026-01-08"
        assert call2_params["settlementDateTo"]   == "2026-01-08"

    def test_january_2026_makes_5_http_calls(self):
        resp = _mock_response([])
        with patch("app.services.elexon.requests.get", return_value=resp) as mock_get:
            fetch_actuals(date(2026, 1, 1), date(2026, 1, 31))
        assert mock_get.call_count == 5

    def test_january_2026_last_chunk_is_jan_29_to_jan_31(self):
        resp = _mock_response([])
        with patch("app.services.elexon.requests.get", return_value=resp) as mock_get:
            fetch_actuals(date(2026, 1, 1), date(2026, 1, 31))
        last_params = mock_get.call_args_list[-1][1]["params"]
        assert last_params["settlementDateFrom"] == "2026-01-29"
        assert last_params["settlementDateTo"]   == "2026-01-31"

    def test_responses_from_all_chunks_are_combined(self):
        """Records from chunk 1 and chunk 2 must both appear in the output."""
        resp1 = _mock_response([
            _wind_row("2026-01-01T00:00:00Z", 1000.0),
            _wind_row("2026-01-07T23:30:00Z", 1100.0),
        ])
        resp2 = _mock_response([
            _wind_row("2026-01-08T00:00:00Z", 1200.0),
        ])
        with patch("app.services.elexon.requests.get", side_effect=[resp1, resp2]):
            result = fetch_actuals(date(2026, 1, 1), date(2026, 1, 8))
        assert len(result) == 3
        starts = [r["startTime"] for r in result]
        assert "2026-01-01T00:00:00Z" in starts
        assert "2026-01-07T23:30:00Z" in starts
        assert "2026-01-08T00:00:00Z" in starts

    def test_non_wind_rows_are_filtered_out(self):
        resp = _mock_response([
            _wind_row("2026-01-01T00:00:00Z", 1000.0),
            _other_row("2026-01-01T00:00:00Z"),   # SOLAR — must be dropped
        ])
        with patch("app.services.elexon.requests.get", return_value=resp):
            result = fetch_actuals(date(2026, 1, 1), date(2026, 1, 1))
        assert len(result) == 1
        assert result[0]["actual"] == 1000.0

    def test_generation_is_cast_to_float(self):
        resp = _mock_response([_wind_row("2026-01-01T00:00:00Z", 1500)])
        with patch("app.services.elexon.requests.get", return_value=resp):
            result = fetch_actuals(date(2026, 1, 1), date(2026, 1, 1))
        assert isinstance(result[0]["actual"], float)

    def test_row_with_missing_startTime_is_skipped(self):
        resp = _mock_response([
            {"fuelType": "WIND", "generation": 500.0},        # no startTime
            _wind_row("2026-01-01T01:00:00Z", 1000.0),
        ])
        with patch("app.services.elexon.requests.get", return_value=resp):
            result = fetch_actuals(date(2026, 1, 1), date(2026, 1, 1))
        assert len(result) == 1

    def test_row_with_missing_generation_is_skipped(self):
        resp = _mock_response([
            {"fuelType": "WIND", "startTime": "2026-01-01T00:00:00Z"},  # no generation
            _wind_row("2026-01-01T01:00:00Z", 1000.0),
        ])
        with patch("app.services.elexon.requests.get", return_value=resp):
            result = fetch_actuals(date(2026, 1, 1), date(2026, 1, 1))
        assert len(result) == 1

    def test_http_error_on_first_chunk_raises_immediately(self):
        """A 400 from the first chunk must propagate; no partial data returned."""
        err_resp = MagicMock()
        err_resp.raise_for_status.side_effect = requests.HTTPError("400 Bad Request")
        with patch("app.services.elexon.requests.get", return_value=err_resp):
            with pytest.raises(requests.HTTPError):
                fetch_actuals(date(2026, 1, 1), date(2026, 1, 8))

    def test_http_error_on_second_chunk_raises_immediately(self):
        """Failure mid-range raises; first chunk's data is not silently returned."""
        ok_resp = _mock_response([_wind_row("2026-01-01T00:00:00Z", 1000.0)])
        err_resp = MagicMock()
        err_resp.raise_for_status.side_effect = requests.HTTPError("500 Server Error")
        with patch("app.services.elexon.requests.get", side_effect=[ok_resp, err_resp]):
            with pytest.raises(requests.HTTPError):
                fetch_actuals(date(2026, 1, 1), date(2026, 1, 8))

    def test_format_param_is_always_json(self):
        resp = _mock_response([])
        with patch("app.services.elexon.requests.get", return_value=resp) as mock_get:
            fetch_actuals(date(2026, 1, 1), date(2026, 1, 8))
        for c in mock_get.call_args_list:
            assert c[1]["params"]["format"] == "json"

    def test_empty_response_returns_empty_list(self):
        resp = _mock_response([])
        with patch("app.services.elexon.requests.get", return_value=resp):
            result = fetch_actuals(date(2026, 1, 1), date(2026, 1, 1))
        assert result == []
