"""Tests for elexon.py WINDFOR chunking logic and fetch_forecast_publications.

All tests mock requests.get so no live API calls are made.
Tests cover:
  - _datetime_chunks: boundary correctness for <=7 days, 8 days, January 2026
  - fetch_forecast_publications:
      - Multiple requests for January 2026
      - Seven-calendar-day limit per request
      - Gapless coverage of intended window
      - Combining records across chunks
      - Preservation of historical publication versions
      - Correct parameters sent (publishDateTimeFrom, publishDateTimeTo, format=json)
      - Propagation of HTTP errors in early and later chunks
      - Empty response handling
"""
from datetime import date, datetime, timedelta, timezone
from unittest.mock import MagicMock, call, patch

import pytest
import requests

from app.services.elexon import (
    WINDFOR_CHUNK_DAYS,
    _datetime_chunks,
    fetch_forecast_publications,
)


# ---------------------------------------------------------------------------
# _datetime_chunks — pure logic
# ---------------------------------------------------------------------------

class TestDatetimeChunks:
    def _list(self, start_dt, end_dt, chunk_days=WINDFOR_CHUNK_DAYS):
        return list(_datetime_chunks(start_dt, end_dt, chunk_days))

    def test_single_day_produces_one_chunk(self):
        start = datetime(2025, 12, 31, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
        chunks = self._list(start, end)
        assert chunks == [(start, end)]

    def test_exactly_7_days_is_one_chunk(self):
        start = datetime(2025, 12, 31, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 1, 7, 0, 0, tzinfo=timezone.utc)
        chunks = self._list(start, end)
        assert chunks == [(start, end)]

    def test_8_days_splits_into_two_chunks(self):
        start = datetime(2025, 12, 31, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 1, 8, 0, 0, tzinfo=timezone.utc)
        chunks = self._list(start, end)
        assert chunks == [
            (datetime(2025, 12, 31, 0, 0, tzinfo=timezone.utc), datetime(2026, 1, 7, 0, 0, tzinfo=timezone.utc)),
            (datetime(2026, 1, 7, 0, 0, tzinfo=timezone.utc), datetime(2026, 1, 8, 0, 0, tzinfo=timezone.utc)),
        ]

    def test_january_2026_splits_into_5_chunks(self):
        # Jan 1 delivery date to Jan 31 delivery date queries
        # from_dt = 2025-12-31 00:00:00Z to to_dt = 2026-02-01 00:00:00Z (32 days)
        start = datetime(2025, 12, 31, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 2, 1, 0, 0, tzinfo=timezone.utc)
        chunks = self._list(start, end)
        assert len(chunks) == 5
        assert chunks[0] == (datetime(2025, 12, 31, 0, 0, tzinfo=timezone.utc), datetime(2026, 1, 7, 0, 0, tzinfo=timezone.utc))
        assert chunks[1] == (datetime(2026, 1, 7, 0, 0, tzinfo=timezone.utc), datetime(2026, 1, 14, 0, 0, tzinfo=timezone.utc))
        assert chunks[2] == (datetime(2026, 1, 14, 0, 0, tzinfo=timezone.utc), datetime(2026, 1, 21, 0, 0, tzinfo=timezone.utc))
        assert chunks[3] == (datetime(2026, 1, 21, 0, 0, tzinfo=timezone.utc), datetime(2026, 1, 28, 0, 0, tzinfo=timezone.utc))
        assert chunks[4] == (datetime(2026, 1, 28, 0, 0, tzinfo=timezone.utc), datetime(2026, 2, 1, 0, 0, tzinfo=timezone.utc))

    def test_chunks_cover_window_without_gaps(self):
        start = datetime(2025, 12, 31, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 2, 1, 0, 0, tzinfo=timezone.utc)
        chunks = self._list(start, end)
        assert chunks[0][0] == start
        assert chunks[-1][1] == end
        for i in range(len(chunks) - 1):
            assert chunks[i][1] == chunks[i + 1][0], f"Gap or overlap between chunk {i} and {i + 1}"

    def test_every_chunk_duration_does_not_exceed_7_days(self):
        start = datetime(2025, 12, 31, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 2, 1, 0, 0, tzinfo=timezone.utc)
        chunks = self._list(start, end)
        for chunk_from, chunk_to in chunks:
            assert chunk_to - chunk_from <= timedelta(days=7)

    def test_start_greater_than_or_equal_to_end(self):
        t = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
        assert self._list(t, t) == [(t, t)]


# ---------------------------------------------------------------------------
# Helpers for mocking requests.get
# ---------------------------------------------------------------------------

def _mock_response(rows, status_code=200):
    m = MagicMock()
    m.status_code = status_code
    m.json.return_value = {"data": rows}
    m.raise_for_status = MagicMock()
    return m


def _forecast_row(start_time: str, publish_time: str, generation: float):
    return {
        "dataset": "WINDFOR",
        "startTime": start_time,
        "publishTime": publish_time,
        "generation": generation,
    }


# ---------------------------------------------------------------------------
# fetch_forecast_publications — regression tests
# ---------------------------------------------------------------------------

class TestFetchForecastPublications:

    def test_january_2026_uses_multiple_requests(self):
        resp = _mock_response([])
        with patch("app.services.elexon.requests.get", return_value=resp) as mock_get:
            fetch_forecast_publications(date(2026, 1, 1), date(2026, 1, 31))
        # 32 days total: 7 + 7 + 7 + 7 + 4 = 5 chunks
        assert mock_get.call_count == 5

    def test_every_request_respects_seven_calendar_day_limit(self):
        resp = _mock_response([])
        with patch("app.services.elexon.requests.get", return_value=resp) as mock_get:
            fetch_forecast_publications(date(2026, 1, 1), date(2026, 1, 31))

        for c in mock_get.call_args_list:
            params = c[1]["params"]
            from_dt = datetime.fromisoformat(params["publishDateTimeFrom"].replace("Z", "+00:00"))
            to_dt = datetime.fromisoformat(params["publishDateTimeTo"].replace("Z", "+00:00"))
            duration = to_dt - from_dt
            assert duration <= timedelta(days=7), f"Request chunk {from_dt} to {to_dt} exceeded 7 days: {duration}"

    def test_chunks_cover_full_intended_window_without_gaps(self):
        resp = _mock_response([])
        with patch("app.services.elexon.requests.get", return_value=resp) as mock_get:
            fetch_forecast_publications(date(2026, 1, 1), date(2026, 1, 31))

        calls = mock_get.call_args_list
        expected_start = "2025-12-31T00:00:00Z"
        expected_end = "2026-02-01T00:00:00Z"

        assert calls[0][1]["params"]["publishDateTimeFrom"] == expected_start
        assert calls[-1][1]["params"]["publishDateTimeTo"] == expected_end

        for i in range(len(calls) - 1):
            chunk_to = calls[i][1]["params"]["publishDateTimeTo"]
            next_chunk_from = calls[i + 1][1]["params"]["publishDateTimeFrom"]
            assert chunk_to == next_chunk_from, f"Gap between chunk {i} ({chunk_to}) and chunk {i+1} ({next_chunk_from})"

    def test_correct_parameters_are_sent(self):
        resp = _mock_response([])
        with patch("app.services.elexon.requests.get", return_value=resp) as mock_get:
            fetch_forecast_publications(date(2026, 1, 1), date(2026, 1, 1))

        mock_get.assert_called_once()
        _, kwargs = mock_get.call_args
        params = kwargs["params"]
        assert params["publishDateTimeFrom"] == "2025-12-31T00:00:00Z"
        assert params["publishDateTimeTo"] == "2026-01-02T00:00:00Z"
        assert params["format"] == "json"

    def test_records_from_all_chunks_are_combined(self):
        resp1 = _mock_response([
            _forecast_row("2026-01-01T00:00:00Z", "2025-12-31T06:00:00Z", 5000.0),
        ])
        resp2 = _mock_response([
            _forecast_row("2026-01-08T00:00:00Z", "2026-01-07T06:00:00Z", 6000.0),
        ])
        with patch("app.services.elexon.requests.get", side_effect=[resp1, resp2, _mock_response([]), _mock_response([]), _mock_response([])]):
            result = fetch_forecast_publications(date(2026, 1, 1), date(2026, 1, 31))

        assert len(result) == 2
        assert result[0] == {"startTime": "2026-01-01T00:00:00Z", "publishTime": "2025-12-31T06:00:00Z", "forecast": 5000.0}
        assert result[1] == {"startTime": "2026-01-08T00:00:00Z", "publishTime": "2026-01-07T06:00:00Z", "forecast": 6000.0}

    def test_historical_publication_versions_are_preserved(self):
        """Multiple forecasts for the same startTime at different publishTimes must not be overwritten."""
        resp = _mock_response([
            _forecast_row("2026-01-02T12:00:00Z", "2026-01-01T06:00:00Z", 4000.0),
            _forecast_row("2026-01-02T12:00:00Z", "2026-01-01T09:00:00Z", 4200.0),
            _forecast_row("2026-01-02T12:00:00Z", "2026-01-01T12:00:00Z", 4500.0),
        ])
        with patch("app.services.elexon.requests.get", return_value=resp):
            result = fetch_forecast_publications(date(2026, 1, 1), date(2026, 1, 1))

        assert len(result) == 3
        forecast_values = [r["forecast"] for r in result]
        assert forecast_values == [4000.0, 4200.0, 4500.0]

    def test_boundary_duplicate_records_are_not_duplicated(self):
        """A record published at the exact boundary instant returned in two adjacent chunks appears once."""
        shared_row = _forecast_row("2026-01-07T12:00:00Z", "2026-01-07T00:00:00Z", 5500.0)
        resp1 = _mock_response([
            _forecast_row("2026-01-01T12:00:00Z", "2025-12-31T12:00:00Z", 5000.0),
            shared_row,
        ])
        resp2 = _mock_response([
            shared_row,
            _forecast_row("2026-01-08T12:00:00Z", "2026-01-07T12:00:00Z", 6000.0),
        ])
        with patch("app.services.elexon.requests.get", side_effect=[resp1, resp2, _mock_response([]), _mock_response([]), _mock_response([])]):
            result = fetch_forecast_publications(date(2026, 1, 1), date(2026, 1, 31))

        assert len(result) == 3
        starts = [r["startTime"] for r in result]
        assert starts == ["2026-01-01T12:00:00Z", "2026-01-07T12:00:00Z", "2026-01-08T12:00:00Z"]

    def test_generation_is_cast_to_float(self):
        resp = _mock_response([_forecast_row("2026-01-01T00:00:00Z", "2025-12-31T06:00:00Z", 3500)])
        with patch("app.services.elexon.requests.get", return_value=resp):
            result = fetch_forecast_publications(date(2026, 1, 1), date(2026, 1, 1))
        assert isinstance(result[0]["forecast"], float)
        assert result[0]["forecast"] == 3500.0

    def test_row_with_missing_fields_is_skipped(self):
        resp = _mock_response([
            {"dataset": "WINDFOR", "publishTime": "2025-12-31T06:00:00Z", "generation": 1000},  # no startTime
            {"dataset": "WINDFOR", "startTime": "2026-01-01T00:00:00Z", "generation": 1000},   # no publishTime
            {"dataset": "WINDFOR", "startTime": "2026-01-01T00:00:00Z", "publishTime": "2025-12-31T06:00:00Z"},  # no generation
            _forecast_row("2026-01-01T00:00:00Z", "2025-12-31T06:00:00Z", 2000.0),
        ])
        with patch("app.services.elexon.requests.get", return_value=resp):
            result = fetch_forecast_publications(date(2026, 1, 1), date(2026, 1, 1))
        assert len(result) == 1
        assert result[0]["forecast"] == 2000.0

    def test_http_error_on_first_chunk_raises_immediately(self):
        err_resp = MagicMock()
        err_resp.raise_for_status.side_effect = requests.HTTPError("400 Bad Request")
        with patch("app.services.elexon.requests.get", return_value=err_resp):
            with pytest.raises(requests.HTTPError):
                fetch_forecast_publications(date(2026, 1, 1), date(2026, 1, 31))

    def test_http_error_on_later_chunk_raises_immediately(self):
        ok_resp = _mock_response([_forecast_row("2026-01-01T00:00:00Z", "2025-12-31T06:00:00Z", 5000.0)])
        err_resp = MagicMock()
        err_resp.raise_for_status.side_effect = requests.HTTPError("500 Server Error")
        with patch("app.services.elexon.requests.get", side_effect=[ok_resp, err_resp]):
            with pytest.raises(requests.HTTPError):
                fetch_forecast_publications(date(2026, 1, 1), date(2026, 1, 31))

    def test_empty_response_returns_empty_list(self):
        resp = _mock_response([])
        with patch("app.services.elexon.requests.get", return_value=resp):
            result = fetch_forecast_publications(date(2026, 1, 1), date(2026, 1, 1))
        assert result == []
