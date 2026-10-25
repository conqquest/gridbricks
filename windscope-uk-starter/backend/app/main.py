from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import date
from app.services.analysis import get_analysis

app = FastAPI(title="WindScope UK API", description="Historical UK wind forecast accuracy analysis", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "windscope-uk-api"}

@app.get("/api/analysis")
def analysis(
    start_date: date = Query(default=date(2026, 1, 1)),
    end_date: date = Query(default=date(2026, 1, 31)),
    cutoff_hour: int = Query(default=10, ge=0, le=23),
):
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")
    try:
        return get_analysis(start_date, end_date, cutoff_hour)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not retrieve Elexon data: {exc}") from exc
