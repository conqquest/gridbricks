# WindScope UK · Day-Ahead Wind Forecast Intelligence

> An auditable forecast-versus-outturn accuracy analysis platform for Great Britain's electricity balancing market, ingesting National Grid ESO datasets from the public Elexon BMRS API.

---

## Table of Contents
1. [Overview & Assignment Benchmark](#1-overview--assignment-benchmark)
2. [Quickstart — How to Run Everything (1-Command Docker)](#2-quickstart--how-to-run-everything-1-command-docker)
3. [Running Locally Without Docker](#3-running-locally-without-docker)
4. [System Architecture & Data Flow](#4-system-architecture--data-flow)
5. [Complete Codebase & Function-by-Function Reference](#5-complete-codebase--function-by-function-reference)
   - [Backend API Client (`elexon.py`)](#backend-api-client-backendappserviceselexonpy)
   - [Matching & Metrics Engine (`analysis.py`)](#matching--metrics-engine-backendappservicesanalysispy)
   - [FastAPI Server Routes (`main.py`)](#fastapi-server-routes-backendappmainpy)
   - [React Dashboard (`App.jsx`)](#react-dashboard-frontendsrcappjsx)
   - [UI Components (`WindScopeHeader.jsx` & `LandscapeFooter.jsx`)](#ui-components)
6. [Market Methodology & Mathematical Formulas](#6-market-methodology--mathematical-formulas)
7. [Automated Verification & Test Suite](#7-automated-verification--test-suite)
8. [Live Deployment Reference](#8-live-deployment-reference)
9. [AI Tools Disclosure](#9-ai-tools-disclosure)

---

## 1. Overview & Assignment Benchmark

**WindScope UK** benchmarks Day-Ahead national wind power forecasts (`WINDFOR`) against outturn generation actuals (`FUELHH`) published by Elexon BMRS. In the Great Britain electricity market, energy suppliers and commercial trading desks face significant cashout imbalance penalties when day-ahead forecasts deviate from real outturn generation. 

WindScope UK provides settlement-grade auditability across half-hour trading periods.

### Verified January 2026 Benchmark (Core Assignment Deliverable)

| Metric | January 2026 (GMT Winter - Core Deliverable) | July 2026 (BST Summer - Baseline Comparison) |
| :--- | :---: | :---: |
| **Data Feed** | Real-time Live Elexon API (`/datasets/FUELHH` & `WINDFOR`) | Real-time Live Elexon API (`/datasets/FUELHH` & `WINDFOR`) |
| **Fetch Start Window** | `2025-12-31T00:00:00Z` (00:00 GMT D-1) | `2026-06-29T23:00:00Z` (00:00 BST D-1) |
| **Mean Absolute Error (MAE)** | **2,126.12 MW** | **1,149.07 MW** |
| **Root Mean Square Error (RMSE)** | **2,620.80 MW** | **1,609.07 MW** |
| **Mean Forecast Bias** | **+1,840.30 MW** *(Persistent Over-forecast)* | **+816.37 MW** *(Over-forecast)* |
| **Weighted Error (WAPE)** | **18.36%** | **20.62%** |
| **Matched Settlement Periods** | **1,488 / 1,488 (100% complete)** | **1,488 / 1,488 (100% complete)** |
| **Daily Period Integrity** | Exactly 48 half-hours per day across all 31 days | Exactly 48 half-hours per day across all 31 days |

---

## 2. Quickstart — How to Run Everything (1-Command Docker)

The easiest way to run the entire fullstack application on any machine is using Docker Compose.

### Step 1: Clone and Run
```bash
git clone https://github.com/conqquest/gridbricks.git
cd gridbricks
docker compose up --build
```
*(You can also run `docker compose up --build` from inside the `windscope-uk-starter/` folder).*

### Step 2: Access the Application
- **Interactive Web Dashboard:** [http://localhost:5173](http://localhost:5173)
- **Backend API Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Interactive OpenAPI Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

### Step 3: Stop Containers
```bash
docker compose down
```

---

## 3. Running Locally Without Docker

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### Terminal 1: Python Backend
```bash
cd windscope-uk-starter/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 2: React Frontend
```bash
cd windscope-uk-starter/frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 4. System Architecture & Data Flow

```
[Browser Client (React 18 / Recharts)]
       │
       ▼  HTTP GET /api/analysis?start_date=2026-01-01&end_date=2026-01-31&cutoff_hour=10
[FastAPI Backend: app/main.py]
       │
       ▼  calls get_analysis() in app/services/analysis.py
[Analysis Engine]
       │
       ├──► fetch_actuals() in app/services/elexon.py
       │         │
       │         ▼  Sequential 7-day chunked requests with format=json
       │    https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH (fuelType=WIND)
       │
       └──► fetch_forecast_publications() in app/services/elexon.py
                 │
                 ▼  Sequential 7-day chunked requests across [D-1 00:00 local, D_end+1 00:00 UTC]
            https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR
```

1. **User Request:** The frontend requests settlement analysis for a date range and cutoff hour.
2. **Sequential Chunk Ingestion:** Elexon restricts requests to 7 calendar days. The backend partitions the query into contiguous 7-day chunks, combines records, and validates HTTP status.
3. **Cutoff Filtering:** Discards all forecast snapshots published after 10:00 `Europe/London` on the day before delivery ($D-1$).
4. **Resolution Pairing:** Maps the latest hourly forecast snapshot to both 30-minute actuals (`:00` and `:30`).
5. **Statistical Aggregation:** Computes overall and UK local daily MAE, RMSE, signed bias, and WAPE.

---

## 5. Complete Codebase & Function-by-Function Reference

### Backend API Client (`backend/app/services/elexon.py`)

This module manages all HTTP communication with Elexon's public BMRS REST API (`https://data.elexon.co.uk/bmrs/api/v1`).

#### `_date_chunks(start: date, end: date, chunk_days: int)`
- **Purpose:** Generator that yields inclusive `(chunk_start, chunk_end)` calendar date pairs covering `[start, end]`.
- **Why it exists:** Elexon's `FUELHH` endpoint rejects queries exceeding 7 days with an HTTP 400 error (`"The date range between SettlementDateFrom and SettlementDateTo inclusive must not exceed 7 days"`).
- **Logic:** Clamps the end of each chunk to `min(chunk_start + chunk_days - 1, end)` and steps by 1 day to guarantee zero gaps and zero overlap.

#### `_datetime_chunks(start_dt: datetime, end_dt: datetime, chunk_days: int = 7)`
- **Purpose:** Generator yielding timezone-aware UTC datetime pairs `(chunk_from, chunk_to)` covering `[start_dt, end_dt]`.
- **Why it exists:** Elexon's `WINDFOR` endpoint rejects publication date ranges exceeding 7 days (`"The date range between PublishDateTimeFrom and PublishDateTimeTo inclusive must not exceed 7 days"`).
- **Logic:** Produces adjacent contiguous intervals where `chunk_to` of chunk $N$ equals `chunk_from` of chunk $N+1$.

#### `_records(payload: Union[dict, list]) -> list`
- **Purpose:** Normalizes JSON responses from Elexon BMRS.
- **Logic:** Returns `payload["data"]` if the payload is a dictionary, or the list directly if already an array. Returns an empty list if data is missing.

#### `_parse_datetime(value: str) -> Optional[datetime]`
- **Purpose:** Converts ISO-8601 strings into timezone-aware UTC `datetime` objects.
- **Logic:** Replaces `"Z"` with `"+00:00"`, calls `datetime.fromisoformat()`, and attaches or converts to `timezone.utc`.

#### `fetch_actuals(start_date: date, end_date: date) -> List[dict]`
- **Purpose:** Retrieves outturn wind generation from `/datasets/FUELHH`.
- **Logic:**
  1. Generates 7-day chunks over `[start_date, end_date]`.
  2. Sends `GET /datasets/FUELHH?settlementDateFrom=...&settlementDateTo=...&format=json`.
  3. Raises `response.raise_for_status()` immediately on any HTTP failure (never returns partial data silently).
  4. Filters rows where `fuelType == "WIND"`.
  5. Casts `generation` to `float` and formats to `{"startTime": ..., "actual": float}`.

#### `fetch_forecast_publications(start_date: date, end_date: date) -> List[dict]`
- **Purpose:** Retrieves day-ahead wind forecast publications from `/datasets/WINDFOR`.
- **Logic:**
  1. Computes local midnight in `Europe/London` on $D-1$ (`start_date - 1 day`).
  2. Converts local midnight to UTC: During British Summer Time (BST, UTC+1), 00:00 BST corresponds to **23:00 UTC on the previous day**, ensuring morning forecast publications are never missed.
  3. Sets query end to midnight UTC on `end_date + 1 day`.
  4. Generates 7-day UTC datetime chunks and queries `publishDateTimeFrom` / `publishDateTimeTo`.
  5. Deduplicates records on `(startTime, publishTime)` to prevent boundary overlaps.
  6. Returns normalized list of `{"startTime": ..., "publishTime": ..., "forecast": float}`.

---

### Matching & Metrics Engine (`backend/app/services/analysis.py`)

This module implements gate-closure filtering, resolution pairing, and statistical metric calculations.

#### `_metric_rows(rows: List[dict]) -> dict`
- **Purpose:** Mathematical scoring engine for an arbitrary collection of matched observation rows.
- **Parameters:** A list of observation dictionaries containing `"forecast"` and `"actual"`.
- **Calculations:**
  - **`matchedPeriods`**: `len(rows)`
  - **`maeMw`**: $\frac{1}{n}\sum |\text{forecast} - \text{actual}|$ (rounded to 2 decimal places).
  - **`rmseMw`**: $\sqrt{\frac{1}{n}\sum (\text{forecast} - \text{actual})^2}$ (rounded to 2 decimal places).
  - **`biasMw`**: $\frac{1}{n}\sum (\text{forecast} - \text{actual})$ (signed mean error; positive indicates over-forecasting).
  - **`wapePercent`**: $\frac{\sum |\text{forecast} - \text{actual}|}{\sum |\text{actual}|} \times 100\%$ (returns `None` if total actual is 0).

#### `get_analysis(start_date: date, end_date: date, cutoff_hour: int) -> dict`
- **Purpose:** Orchestrates the end-to-end matching process.
- **Logic:**
  1. Calls `fetch_actuals()` and `fetch_forecast_publications()`.
  2. Indexes actuals in a dictionary by parsed UTC `startTime`.
  3. **Cutoff Filtering:** For each forecast snapshot, identifies delivery date in `Europe/London`. Computes gate closure cutoff at `cutoff_hour:00 Europe/London` on $D-1$. Translates cutoff to UTC. Snapshot is eligible if `publishTime <= cutoff_utc`.
  4. **Snapshot Selection:** For each delivery hour, selects the **latest** eligible published snapshot (`max(versions, key=lambda x: x["published_dt"])`).
  5. **Granularity Alignment:** WINDFOR forecasts are 1-hour values; FUELHH actuals are 30-minute values. Matches the hourly forecast to both `:00` and `:30` actuals without averaging.
  6. **Daily Aggregation:** Groups matched observations by `Europe/London` delivery date (not UTC) so settlement days align with the GB regulatory calendar.
  7. Returns summary metrics, daily breakdown, full observations ledger, and metadata.

---

### FastAPI Server Routes (`backend/app/main.py`)

#### `health()`
- **Route:** `GET /api/health`
- **Purpose:** Readiness and liveness probe for Docker, Render, and Vercel. Returns `{"status": "ok", "service": "windscope-uk-api"}`.

#### `analysis(start_date, end_date, cutoff_hour, source)`
- **Route:** `GET /api/analysis`
- **Parameters:**
  - `start_date` (date, default: `2026-01-01`)
  - `end_date` (date, default: `2026-01-31`)
  - `cutoff_hour` (int, default: `10`, range: 0–23)
  - `source` (str, default: `"live"`)
- **Logic:**
  - If `source == "january-2026"`: Loads pre-verified artifact `backend/january-analysis.json` (instant response).
  - If `source == "july-2026"`: Loads pre-verified artifact `backend/july-2026-analysis.json`.
  - If `source == "live"` (default): Executes `get_analysis(start_date, end_date, cutoff_hour)` against live Elexon BMRS API and tags payload with `dataSource = "Live Elexon BMRS API"` and `isSynthetic = False`.

---

### React Dashboard (`frontend/src/App.jsx`)

#### `MetricCard({ label, value, unit, note, icon, tag, tagType })`
- **Purpose:** Renders an individual KPI card with consistent typography, icons, and status badges.
- **Formatting:** Displays signed values with an explicit `+` for positive forecast bias.

#### `App()`
- **State Management:**
  - `data`: Current analysis response payload.
  - `loading`: Boolean state indicating active query ingestion.
  - `loadingMsg`: Progress indicator message explaining chunked ingestion.
  - `error`: Error banner string for network or API failures.
  - `start`, `end`: Delivery date range strings (`YYYY-MM-DD`). Defaults to `2026-01-01` to `2026-01-31`.
  - `cutoff`: Configured gate-closure hour (default: `"10"`).
  - `activeTab`: Switches between `'daily'` (breakdown) and `'observations'` (half-hour records).
  - `sourceMode`: Active feed mode (`'live'`, `'january-2026'`, `'july-2026'`).

#### `loadData(targetSource, customStart, customEnd, customCutoff)`
- **Purpose:** Dispatches HTTP GET to `${API}/api/analysis` using Axios.
- **Resilience:** Configured with a 180,000ms (3-minute) timeout to accommodate sequential live Elexon chunks during multi-week queries.

#### `handleSelectPreset(preset)`
- **Purpose:** Quick switcher handling one-click queries:
  - `'live-january-core'`: Live 31-day January 2026 benchmark.
  - `'live-july-month'`: Live 31-day July 2026 comparison.
  - `'cached-january'`: Instant offline January snapshot.
  - `'cached-july'`: Instant offline July snapshot.

#### `chartData` (Memoized `useMemo`)
- **Purpose:** Transforms raw observation records into Recharts-compatible data points with formatted `Europe/London` timestamps.

#### `downloadCsv()`
- **Purpose:** Exports all half-hourly settlement observations to an RFC-4180 compliant CSV file (`startTime_UTC`, `startTime_UK`, `publishTime_UTC`, `forecast_MW`, `actual_MW`, `error_MW`).

#### `scrollToSection(id)`
- **Purpose:** Provides smooth scrolling navigation between Overview, Analysis, Methodology, and Data Sources.

---

### UI Components

#### `WindScopeHeader.jsx` (`frontend/src/components/WindScopeHeader.jsx`)
- Renders the top navigation header on a sky-blue backdrop with blur filter.
- Displays the brand title, understated navigation links, live connection badge (`Live Elexon BMRS`), and refresh action button.

#### `LandscapeFooter.jsx` (`frontend/src/components/LandscapeFooter.jsx`)
- Implements an editorial, woodblock-inspired vector landscape illustration in SVG:
  - Cumulus clouds in warm cream (`#fcf9f2`, `#f4ece0`).
  - Sage-green rolling hills with agricultural contour furrows.
  - Linocut blue tree (`#2f6ecb`) and coral foliage ridge (`#eb5d38`).
  - Product, Resources, and Company navigation columns, legal links, and copyright text.

---

## 6. Market Methodology & Mathematical Formulas

### 1. Gate Closure Cutoff Rule
The decision boundary is modeled at **10:00 Europe/London on D-1** (the day prior to physical delivery).
- Only forecasts published at or before 10:00 local time are eligible.
- In GMT (Winter), 10:00 local = **10:00 UTC**.
- In BST (Summer), 10:00 local = **09:00 UTC**.
- Early morning publications during BST require the fetch window to start at **23:00 UTC** on the preceding calendar day ($D-2$).

### 2. Resolution Pairing (Hourly to Half-Hourly)
- National Grid `WINDFOR` forecasts are 1-hour average MW values over $[T, T+1\text{h})$.
- Elexon `FUELHH` actuals are 30-minute average MW values over $[T, T+30\text{min})$ and $[T+30\text{min}, T+1\text{h})$.
- The hourly forecast is paired with **both** the `:00` and `:30` actuals. Actuals are never averaged, preserving true imbalance cashout volatility.

### 3. Metric Definitions
- **Mean Absolute Error (MAE):** $\text{MAE} = \frac{1}{n}\sum_{i=1}^{n} |\text{Forecast}_i - \text{Actual}_i|$
- **Root Mean Square Error (RMSE):** $\text{RMSE} = \sqrt{\frac{1}{n}\sum_{i=1}^{n} (\text{Forecast}_i - \text{Actual}_i)^2}$
- **Mean Forecast Bias:** $\text{Bias} = \frac{1}{n}\sum_{i=1}^{n} (\text{Forecast}_i - \text{Actual}_i)$  
  *(A positive bias indicates persistent over-forecasting, meaning National Grid predicted more generation than was physically produced).*
- **Weighted Absolute Percentage Error (WAPE):** $\text{WAPE} = \frac{\sum_{i=1}^{n} |\text{Forecast}_i - \text{Actual}_i|}{\sum_{i=1}^{n} |\text{Actual}_i|} \times 100\%$

---

## 7. Automated Verification & Test Suite

The backend test suite contains **72 automated unit and regression tests**:

```bash
cd windscope-uk-starter/backend
.venv/bin/pytest -v
```

### Test Coverage Highlights:
- **`test_elexon_actuals.py` (21 tests):** 7-day date chunking bounds, contiguous intervals, non-wind filtering, float conversions, HTTP error propagation.
- **`test_elexon_forecasts.py` (21 tests):** Datetime chunking without gaps, BST 23:00 UTC start window calculation, GMT 00:00 UTC start window, boundary duplicate deduplication.
- **`test_matching.py` (28 tests):** Top-of-hour and half-hour pairing, BST cutoff boundaries (verifying 08:59 UTC is eligible, 09:00 UTC is eligible, and 09:01 UTC is excluded), latest pre-cutoff version selection, UK local-date daily grouping.
- **`test_metrics.py` (2 tests):** Exact calculation verification and null handling for empty datasets.

---

## 8. Live Deployment Reference

- **Live Backend API (Render):** [https://windscope-backend-pl3o.onrender.com](https://windscope-backend-pl3o.onrender.com)
- **Live Health Check:** [https://windscope-backend-pl3o.onrender.com/api/health](https://windscope-backend-pl3o.onrender.com/api/health)
- **Public GitHub Repository:** [https://github.com/conqquest/gridbricks](https://github.com/conqquest/gridbricks)

---

## 9. AI Tools Disclosure

In accordance with assignment submission and academic transparency guidelines:
- **AI Tools Used:** Google Antigravity (powered by Gemini models).
- **Assisted Areas:**
  - Automated analysis of Elexon BMRS API 7-day publication query constraints.
  - Authoring comprehensive unit tests in `backend/tests/` covering British Summer Time transitions.
  - Designing responsive CSS layouts and custom SVG landscape components.
- **Human Verification:** All mathematical formulas, matching algorithms, time zone boundary translations, and API integration pipelines have been independently audited and verified against live Elexon BMRS data feeds.
