from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import date
from pathlib import Path
import json
from app.services.analysis import get_analysis

app = FastAPI(title="WindScope UK API", description="Historical UK wind forecast accuracy analysis", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_DIR = Path(__file__).resolve().parent.parent

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "windscope-uk-api"}

@app.get("/api/analysis")
def analysis(
    start_date: date = Query(default=date(2026, 1, 1)),
    end_date: date = Query(default=date(2026, 1, 31)),
    cutoff_hour: int = Query(default=10, ge=0, le=23),
    source: str = Query(default="live"),
):
    if source == "july-2026":
        artifact_path = BACKEND_DIR / "july-2026-analysis.json"
        if not artifact_path.exists():
            raise HTTPException(status_code=404, detail="July 2026 analysis artifact not found")
        with open(artifact_path) as f:
            data = json.load(f)
        data["dataSource"] = "Saved Artifact (July 2026)"
        data["isSynthetic"] = False
        data["isCachedArtifact"] = True
        data["apiDetails"] = {
            "origin": "Live Elexon BMRS API run cached to backend/july-2026-analysis.json",
            "isLive": False,
        }
        return data

    if source == "january-2026":
        artifact_path = BACKEND_DIR / "january-analysis.json"
        if not artifact_path.exists():
            raise HTTPException(status_code=404, detail="January 2026 analysis artifact not found")
        with open(artifact_path) as f:
            data = json.load(f)
        data["dataSource"] = "Saved Artifact (January 2026)"
        data["isSynthetic"] = False
        data["isCachedArtifact"] = True
        data["apiDetails"] = {
            "origin": "Live Elexon BMRS API run cached to backend/january-analysis.json",
            "isLive": False,
        }
        return data

    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")
    try:
        data = get_analysis(start_date, end_date, cutoff_hour)
        data["dataSource"] = "Live Elexon BMRS API"
        data["isSynthetic"] = False
        data["apiDetails"] = {
            "baseUrl": "https://data.elexon.co.uk/bmrs/api/v1",
            "actualsEndpoint": "/datasets/FUELHH (filtered to fuelType=WIND)",
            "forecastEndpoint": "/datasets/WINDFOR",
            "chunkLimit": "7 calendar days per request (Elexon BMRS limit)",
            "isLive": True,
        }
        return data
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not retrieve Elexon data: {exc}") from exc
