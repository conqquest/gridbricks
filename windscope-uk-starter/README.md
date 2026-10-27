# WindScope UK · Day-Ahead Wind Forecast Intelligence

> An auditable forecast-versus-outturn accuracy analysis platform for the Great Britain energy market, ingesting National Grid ESO balancing mechanism datasets from Elexon BMRS.

---

## 1. Project Overview

**WindScope UK** benchmarks Day-Ahead national wind power forecasts (`WINDFOR`) against outturn generation actuals (`FUELHH`) published by Elexon BMRS. The platform identifies forecast bias, volatility penalties, and volume deviations across Great Britain's half-hour settlement periods to support commercial trading desks, imbalance risk managers, and energy analysts.

### Core Assignment Benchmark: January 2026 Outturn Analysis

| Metric | January 2026 (GMT Winter - Core Deliverable) | July 2026 (BST Summer - Baseline Comparison) |
| :--- | :---: | :---: |
| **Data Feed** | Real-time Live Elexon API (`/datasets/FUELHH` & `WINDFOR`) | Real-time Live Elexon API (`/datasets/FUELHH` & `WINDFOR`) |
| **Fetch Start Window** | `2025-12-31T00:00:00Z` (00:00 GMT D-1) | `2026-06-29T23:00:00Z` (00:00 BST D-1) |
| **Mean Absolute Error (MAE)** | **2,126.12 MW** | **1,149.07 MW** |
| **Root Mean Square Error (RMSE)** | **2,620.80 MW** | **1,609.07 MW** |
| **Mean Forecast Bias** | **+1,840.30 MW** *(Persistent Over-forecast)* | **+816.37 MW** *(Over-forecast)* |
| **Weighted Error (WAPE)** | **18.36%** | **20.62%** |
| **Matched Settlement Periods** | **1,488 / 1,488 (100% matched)** | **1,488 / 1,488 (100% matched)** |
| **Daily Period Integrity** | Exactly 48 half-hours per day across all 31 days | Exactly 48 half-hours per day across all 31 days |

---

## 2. Key Architectural Features

1. **Sequential 7-Day Chunking Ingestion:**
   - Elexon BMRS enforces a strict maximum window of 7 calendar days for both `FUELHH` settlement dates and `WINDFOR` publication dates.
   - WindScope UK partitions any query range into contiguous, non-overlapping 7-day chunks and combines records into unified time series. Any HTTP error raises immediately to prevent partial data leakage.

2. **Timezone-Aware Gate Closure (`Europe/London`):**
   - The Day-Ahead procurement cutoff is evaluated at **10:00 Europe/London** on the day before delivery ($D-1$).
   - Properly converts to UTC across British Summer Time (BST, UTC+1 $\to$ 09:00 UTC) and Greenwich Mean Time (GMT, UTC+0 $\to$ 10:00 UTC).
   - In BST, queries start at 23:00 UTC on $D-2$ ($D-1$ local midnight) to prevent omitting morning forecast snapshots.

3. **Settlement Granularity Pairing:**
   - National Grid issues `WINDFOR` forecasts on an hourly average basis. `FUELHH` actuals are reported every 30 minutes.
   - Each 1-hour forecast snapshot is paired with **both** the `:00` and `:30` settlement actuals in that hour. Actuals are never averaged, preserving authentic cashout volatility.

4. **Zero Synthetic Data Guarantee:**
   - All observations derive strictly from Elexon BMRS API feeds. Offline cached JSON snapshots are clearly disclosed and separated from live API streams.

---

## 3. Repository Structure

```
windscope-uk-starter/
├── api/
│   └── index.py               # Vercel serverless function entrypoint
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI endpoints, CORS, data provenance
│   │   └── services/
│   │       ├── elexon.py      # Elexon BMRS client with 7-day chunking
│   │       └── analysis.py    # Cutoff filtering, matching & accuracy metrics
│   ├── tests/                 # 72 comprehensive unit & regression tests
│   │   ├── test_elexon_actuals.py
│   │   ├── test_elexon_forecasts.py
│   │   ├── test_matching.py
│   │   └── test_metrics.py
│   ├── january-analysis.json   # Verified live January 2026 baseline run
│   ├── july-2026-analysis.json# Verified live July 2026 baseline run
│   ├── Dockerfile             # Production backend container definition
│   ├── requirements.txt       # Python dependencies (FastAPI, requests, pytest)
│   └── Procfile               # Heroku deployment process definition
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── WindScopeHeader.jsx   # Understated navigation & live status
│   │   │   └── LandscapeFooter.jsx   # Nexiron-inspired vector landscape
│   │   ├── App.jsx            # Main dashboard, KPI cards, charts, tabbed tables
│   │   ├── main.jsx           # React DOM root mounting
│   │   └── styles.css         # Custom editorial design system (responsive)
│   ├── Dockerfile             # Node 22 container definition
│   └── package.json           # React 18, Vite 6, Recharts, Lucide Icons
├── docker-compose.yml         # Containerized multi-service orchestration
├── vercel.json                # Vercel deployment rewrites
├── Procfile                   # Root Heroku deployment process definition
└── README.md                  # Release engineering documentation
```

---

## 4. Run Locally

### Option A: With Docker (Recommended)

Make sure Docker and Docker Compose are installed and running:

```bash
docker compose up --build
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Backend Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

### Option B: Without Docker

**1. Start the Backend:**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**2. Start the Frontend (in a separate terminal):**

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 5. Verification & Test Suite

Run the full pytest suite (72 tests covering chunking boundaries, timezone conversions, BST gate closure, error handling, and metric accuracy):

```bash
cd backend
.venv/bin/pytest -v
```

Expected output:
```
============================== 72 passed in 0.10s ==============================
```

Build the frontend for production:

```bash
cd frontend
npm run build
```

Expected output:
```
✓ built in ~1.9s (zero errors)
```

---

## 6. Public Deployment Guide

### Deployment URLs

- **Live Backend API (Render):** [https://windscope-backend-pl3o.onrender.com](https://windscope-backend-pl3o.onrender.com)
- **Live Backend Health Check:** [https://windscope-backend-pl3o.onrender.com/api/health](https://windscope-backend-pl3o.onrender.com/api/health)
- **Live Frontend / Fullstack App (Vercel):** `[PENDING VERCEL DEPLOYMENT - e.g. https://windscope-uk.vercel.app]`
- **Public GitHub Repository:** [https://github.com/conqquest/gridbricks](https://github.com/conqquest/gridbricks)

---

### Deploying to Vercel (Recommended)

#### Method 1: Vercel Web Dashboard (Quickest)
1. Push this repository to your GitHub account as a **public** repository.
2. Log in to [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. If deploying the frontend separately:
   - Set **Root Directory** to `frontend`.
   - Set **Environment Variable**: `VITE_API_URL` = your deployed backend URL.
5. Click **Deploy**.

#### Method 2: Deploy Backend to Render / Heroku and Frontend to Vercel
1. **Backend (Render):**
   - Create a free Web Service on [Render](https://render.com).
   - Point to your repo, set Root Directory to `backend`, Build Command: `pip install -r requirements.txt`, Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
2. **Frontend (Vercel):**
   - Deploy `frontend/` on Vercel with `VITE_API_URL=https://<your-render-app>.onrender.com`.

---

## 7. Explicit AI Disclosure

In accordance with academic and submission integrity guidelines, the development of this prototype was assisted by artificial intelligence:
- **Tools Used:** Google Antigravity (featuring Gemini models).
- **Assisted Areas:**
  - Automated analysis of Elexon BMRS API 7-day chunking constraints.
  - Test-driven generation of edge-case tests in `backend/tests/` (72 tests covering UTC/BST transitions).
  - Editorial UI styling inspired by modern minimal web aesthetic (SVG landscape components, responsive CSS).
- **Human Verification:** All mathematical formulas, matching logic, British Summer Time cutoff translations, and API integration responses have been independently audited and validated against live Elexon BMRS data feeds.

---

## 8. Limitations & Assumptions

1. **Day-Ahead Cutoff Convention:** Gate closure is modeled at 10:00 Europe/London on D-1. Actual commercial trading agreements may specify alternative closure times (e.g. 11:00 or 12:00 UK time).
2. **Hourly-to-Half-Hourly Resolution:** National Grid WINDFOR forecasts are 1-hour average MW values, while FUELHH outturn generation is reported half-hourly. Each hour's forecast is paired with both 30-minute actuals without smoothing.
3. **Elexon API Latency:** 31-day live fetches require 10 sequential 7-day chunks (~15–18 seconds). Instant cached snapshots are provided for zero-latency presentation demos.
4. **Prototype Disclaimer:** This software is an assignment evaluation prototype and does not constitute commercial trading or financial advice.
