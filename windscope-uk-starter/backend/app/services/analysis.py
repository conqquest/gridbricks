from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
from collections import defaultdict
from math import sqrt
from app.services.elexon import fetch_actuals, fetch_forecast_publications, _parse_datetime

UK = ZoneInfo("Europe/London")


def _metric_rows(rows):
    if not rows:
        return {"matchedPeriods": 0, "maeMw": None, "rmseMw": None, "biasMw": None, "wapePercent": None}
    errors = [r["forecast"] - r["actual"] for r in rows]
    abs_errors = [abs(x) for x in errors]
    total_actual = sum(abs(r["actual"]) for r in rows)
    return {
        "matchedPeriods": len(rows),
        "maeMw": round(sum(abs_errors) / len(rows), 2),
        "rmseMw": round(sqrt(sum(x*x for x in errors) / len(rows)), 2),
        "biasMw": round(sum(errors) / len(rows), 2),
        "wapePercent": round(sum(abs_errors) / total_actual * 100, 2) if total_actual else None,
    }


def get_analysis(start_date: date, end_date: date, cutoff_hour: int):
    actual_rows = fetch_actuals(start_date, end_date)
    forecast_rows = fetch_forecast_publications(start_date, end_date)
    actual_by_start = {}
    for row in actual_rows:
        dt = _parse_datetime(row["startTime"])
        if dt:
            actual_by_start[dt] = row["actual"]

    # Assumption: procurement cutoff is cutoff_hour in Europe/London on the
    # day before delivery. It is configurable and disclosed in the response.
    forecasts_by_start = defaultdict(list)
    for row in forecast_rows:
        target = _parse_datetime(row["startTime"])
        published = _parse_datetime(row["publishTime"])
        if target is None or published is None:
            continue
        local_target_date = target.astimezone(UK).date()
        if not (start_date <= local_target_date <= end_date):
            continue
        cutoff_local = datetime.combine(local_target_date - timedelta(days=1), time(cutoff_hour, 0), tzinfo=UK)
        cutoff_utc = cutoff_local.astimezone(timezone.utc)
        if published <= cutoff_utc:
            forecasts_by_start[target].append({"publishTime": row["publishTime"], "published_dt": published, "forecast": row["forecast"]})

    matched = []
    for target_dt, versions in forecasts_by_start.items():
        if target_dt not in actual_by_start:
            continue
        selected = max(versions, key=lambda x: x["published_dt"])
        matched.append({
            "startTime": target_dt.isoformat(),
            "publishTime": selected["publishTime"],
            "forecast": selected["forecast"],
            "actual": actual_by_start[target_dt],
            "error": round(selected["forecast"] - actual_by_start[target_dt], 2),
        })
    matched.sort(key=lambda x: x["startTime"])

    by_day = defaultdict(list)
    for row in matched:
        by_day[row["startTime"][:10]].append(row)
    daily = [{"date": day, **_metric_rows(rows)} for day, rows in sorted(by_day.items())]
    return {
        "period": {"startDate": start_date.isoformat(), "endDate": end_date.isoformat()},
        "methodology": {
            "cutoffHourLocal": cutoff_hour,
            "timezone": "Europe/London",
            "cutoffRule": "Latest forecast published by the configured cutoff on the day before delivery",
            "warning": "The cutoff hour is an explicit prototype assumption; confirm the client's intended trading decision cutoff. Historical forecast endpoint coverage must be validated before relying on results.",
        },
        "summary": _metric_rows(matched),
        "daily": daily,
        "observations": matched,
        "dataStatus": {"actualRows": len(actual_rows), "forecastVersions": len(forecast_rows), "matchedPeriods": len(matched)},
    }
