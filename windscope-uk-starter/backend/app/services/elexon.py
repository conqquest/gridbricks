"""Small client for Elexon's public BMRS Insights API.

The API is public; no API key is required for these endpoints. Check current
Elexon documentation before relying on this prototype for operational use.

Verified endpoints (live, 2026-10-25):
  GET /datasets/FUELHH    params: settlementDateFrom, settlementDateTo, format
  GET /datasets/WINDFOR   params: publishDateTimeFrom, publishDateTimeTo, format
Both return {"data": [{...}, ...]}.
FUELHH fields: fuelType, startTime, generation  (half-hourly, ":00" and ":30")
WINDFOR fields: publishTime, startTime, generation  (hourly, on the hour only)

Note: FUELHH actuals are half-hourly; WINDFOR forecasts are hourly. Downstream
matching by exact startTime will only pair the top-of-hour actuals with
forecasts.  This is not fixed here; see analysis.py for the matching logic.
"""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
import requests

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
UK = ZoneInfo("Europe/London")
TIMEOUT = 25


def _records(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        data = payload.get("data", [])
        return data if isinstance(data, list) else []
    return []


def fetch_actuals(start_date: date, end_date: date):
    """Fetch FUELHH actuals and filter WIND rows.

    Uses settlement-date filters; Elexon may wrap results in a `data` object.
    """
    url = f"{BASE_URL}/datasets/FUELHH"
    params = {
        "settlementDateFrom": start_date.isoformat(),
        "settlementDateTo": end_date.isoformat(),
        "format": "json",
    }
    response = requests.get(url, params=params, timeout=TIMEOUT)
    response.raise_for_status()
    rows = _records(response.json())
    result = []
    for row in rows:
        fuel = str(row.get("fuelType", "")).upper()
        if fuel != "WIND":
            continue
        start = row.get("startTime")
        generation = row.get("generation")
        if start is None or generation is None:
            continue
        result.append({"startTime": start, "actual": float(generation)})
    return result


def _parse_datetime(value):
    if not value:
        return None
    text = str(value).replace("Z", "+00:00")
    dt = datetime.fromisoformat(text)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def fetch_forecast_publications(start_date: date, end_date: date):
    """Fetch historical WINDFOR forecast snapshots via the datasets/WINDFOR endpoint.

    Queries all publications whose publishTime falls in the window
    [start_date - 1 day, end_date + 1 day) UTC, retrieving every forecast
    snapshot in a single HTTP request. This replaces the previous approach that
    polled forecast/generation/wind/history with 8 hardcoded publication times
    per day, which was slow (N*8 requests), fragile, and silently missed any
    publication outside those fixed minutes.

    Verified against the live API: datasets/WINDFOR accepts
    publishDateTimeFrom and publishDateTimeTo as ISO-8601 UTC strings and
    returns {"data": [{"publishTime": ..., "startTime": ..., "generation": ...}]}.
    """
    url = f"{BASE_URL}/datasets/WINDFOR"
    # Fetch publications from the day before the first delivery date (forecasts
    # published on D-1 cover the D start times) through midnight at the end of
    # the final delivery date.
    from_dt = datetime.combine(start_date - timedelta(days=1), time(0, 0), tzinfo=timezone.utc)
    to_dt = datetime.combine(end_date + timedelta(days=1), time(0, 0), tzinfo=timezone.utc)
    params = {
        "publishDateTimeFrom": from_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "publishDateTimeTo": to_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "format": "json",
    }
    response = requests.get(url, params=params, timeout=TIMEOUT)
    response.raise_for_status()
    snapshots = []
    for row in _records(response.json()):
        start = row.get("startTime")
        generation = row.get("generation")
        published = row.get("publishTime")
        if start is None or generation is None or published is None:
            continue
        snapshots.append({"startTime": start, "publishTime": published, "forecast": float(generation)})
    return snapshots
