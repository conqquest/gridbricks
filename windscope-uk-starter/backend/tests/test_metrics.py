from app.services.analysis import _metric_rows


def test_metrics_are_calculated_correctly():
    rows = [
        {"forecast": 3000, "actual": 2000},
        {"forecast": 2500, "actual": 2800},
        {"forecast": 2200, "actual": 2000},
    ]
    result = _metric_rows(rows)
    assert result["matchedPeriods"] == 3
    assert result["maeMw"] == 500.0
    assert result["biasMw"] == 300.0
    assert result["rmseMw"] > result["maeMw"]


def test_empty_metrics_are_null_not_zero():
    result = _metric_rows([])
    assert result["matchedPeriods"] == 0
    assert result["maeMw"] is None
