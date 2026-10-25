# WindScope UK

A prototype full-stack dashboard for historical UK national wind generation forecast analysis using Elexon BMRS data.

## Features

- Reads FUELHH wind actuals and historical WINDFOR forecast publications from Elexon's public API.
- Selects the latest forecast published before a configurable cutoff on the day before delivery.
- Matches forecast and actual records by delivery start time.
- Calculates MAE, RMSE, signed bias, WAPE and daily MAE.
- Displays time series, selected publication timestamps and a CSV export.
- Includes Docker Compose and initial unit tests.

## Important assumptions and limitations

- The prototype defaults to January 2026 delivery dates and a 10:00 Europe/London decision cutoff. The assignment does not specify an exact cutoff; confirm and document the client's intended rule before interpreting results.
- The historical WINDFOR endpoint and publication-time query behaviour must be verified against current Elexon documentation. The client should not rely on results until the returned publication snapshots and coverage have been validated.
- This application analyses wind generation only. It does not contain demand data and therefore does not calculate the utility's actual procurement requirement.
- This is an assignment prototype, not a production trading tool. It does not provide trading advice.

## Run locally with Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend health: http://localhost:8000/api/health
- API docs: http://localhost:8000/docs

## Run without Docker

Backend (Python 3.11+ recommended):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

## Tests

```bash
cd backend
pytest
```

## Repository layout

- `frontend/src/App.jsx`: dashboard, date/cutoff controls, charts and CSV export.
- `frontend/src/styles.css`: responsive dashboard styles.
- `backend/app/main.py`: FastAPI application and API route.
- `backend/app/services/elexon.py`: Elexon API client and data normalization.
- `backend/app/services/analysis.py`: forecast selection, matching and metric calculations.
- `backend/tests/`: unit tests for metrics.
- `docker-compose.yml`: local frontend/backend orchestration.

## AI disclosure

AI assistance (ChatGPT) was used to help scaffold and review parts of this prototype. The implementation and API behaviour should be verified by the developer before submission.

## Deployment

Deploy the frontend to Vercel and the Python backend to a Python/Docker-compatible host. Set `VITE_API_URL` in the frontend deployment to the public backend URL and configure backend CORS to allow the deployed frontend origin. Add verified public URLs here after deployment.
