"""Small client for Elexon's public BMRS Insights API.

The API is public; no API key is required for these endpoints. Check current
Elexon documentation before relying on this prototype for operational use.
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
    """Fetch historical WINDFOR forecast snapshots by publication timestamp.

    The history endpoint is queried at the known daily forecast publication
    windows. Returned records are retained with their publishTime so analysis
    can choose the latest version before the configured cutoff.
    """
    url = f"{BASE_URL}/forecast/generation/wind/history"
    publication_times = [time(3, 30), time(5, 30), time(8, 30), time(10, 30),
                         time(12, 30), time(16, 30), time(19, 30), time(23, 30)]
    # Query the day before the first target through the final target day.
    day = start_date - timedelta(days=1)
    last_day = end_date
    snapshots = []
    while day <= last_day:
        for publication_time in publication_times:
            local_dt = datetime.combine(day, publication_time, tzinfo=UK)
            publish_time = local_dt.astimezone(timezone.utc)
            try:
                response = requests.get(url, params={"publishTime": publish_time.isoformat().replace("+00:00", "Z"), "format": "json"}, timeout=TIMEOUT)
                if response.status_code == 404:
                    continue
                response.raise_for_status()
                for row in _records(response.json()):
                    start = row.get("startTime")
                    generation = row.get("generation")
                    published = row.get("publishTime") or row.get("publishDateTime")
                    if start is None or generation is None or published is None:
                        continue
                    snapshots.append({"startTime": start, "publishTime": published, "forecast": float(generation)})
            except requests.RequestException:
                # Continue to other snapshots; API may not have a publication at
                # every expected minute. Total failure is handled by analysis.
                continue
        day += timedelta(days=1)
    # Deduplicate exact target/publication pairs.
    unique = {}
    for row in snapshots:
        unique[(row["startTime"], row["publishTime"])] = row
    return list(unique.values())
