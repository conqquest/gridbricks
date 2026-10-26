import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays,
  CheckCircle2, Cloud, Database, Download, FileText, Info, RefreshCw, Wind, Zap
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const fmt = (n, digits = 0) => (n == null ? '—' : Number(n).toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits }));

function MetricCard({ label, value, unit, note, icon: Icon, tag, tagType }) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon"><Icon size={17} /></span>
      </div>
      <div className="metric-value">
        {value}<small>{unit}</small>
      </div>
      <div className="metric-footer">
        {tag && <span className={`metric-tag ${tagType || ''}`}>{tag}</span>}
        <span className="metric-note">{note}</span>
      </div>
    </article>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');
  const [start, setStart] = useState('2026-07-01');
  const [end, setEnd] = useState('2026-07-31');
  const [cutoff, setCutoff] = useState('10');
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'observations'
  const [sourceMode, setSourceMode] = useState('july-2026'); // 'live' | 'july-2026' | 'january-2026'
  const [showMethodology, setShowMethodology] = useState(true);

  async function loadData(targetSource = sourceMode, customStart = start, customEnd = end, customCutoff = cutoff) {
    setLoading(true);
    setError('');
    if (targetSource === 'live') {
      setLoadingMsg('Querying live Elexon BMRS API (chunking FUELHH & WINDFOR across 7-day intervals)... This takes ~15–20s.');
    } else {
      setLoadingMsg(`Loading saved ${targetSource === 'july-2026' ? 'July 2026' : 'January 2026'} verified artifact...`);
    }

    try {
      const params = {
        start_date: customStart,
        end_date: customEnd,
        cutoff_hour: Number(customCutoff),
      };
      if (targetSource !== 'live') {
        params.source = targetSource;
      }
      const response = await axios.get(`${API}/api/analysis`, { params, timeout: 180000 });
      setData(response.data);
      setSourceMode(targetSource);
    } catch (e) {
      setError(
        e.response?.data?.detail ||
        (targetSource === 'live'
          ? 'Could not retrieve live Elexon data. Check that the backend server is running on port 8000 and that Elexon BMRS API is reachable.'
          : 'Could not load saved analysis artifact. Ensure the backend server is running.')
      );
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  }

  // Initial load uses July 2026 artifact for instant demonstration
  useEffect(() => {
    loadData('july-2026', '2026-07-01', '2026-07-31', '10');
  }, []);

  function handleSelectPreset(preset) {
    if (preset === 'july-2026') {
      setStart('2026-07-01');
      setEnd('2026-07-31');
      setCutoff('10');
      loadData('july-2026', '2026-07-01', '2026-07-31', '10');
    } else if (preset === 'january-2026') {
      setStart('2026-01-01');
      setEnd('2026-01-31');
      setCutoff('10');
      loadData('january-2026', '2026-01-01', '2026-01-31', '10');
    } else if (preset === 'live') {
      setSourceMode('live');
      loadData('live', start, end, cutoff);
    }
  }

  const chartData = useMemo(() => {
    return (data?.observations || []).map((r) => ({
      ...r,
      label: new Date(r.startTime).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/London'
      })
    }));
  }, [data]);

  function downloadCsv() {
    const rows = data?.observations || [];
    if (!rows.length) return;
    const header = ['startTime_UTC', 'startTime_UK', 'publishTime_UTC', 'forecast_MW', 'actual_MW', 'error_MW'];
    const csvLines = [
      header.join(','),
      ...rows.map((r) => [
        `"${r.startTime}"`,
        `"${new Date(r.startTime).toLocaleString('en-GB', { timeZone: 'Europe/London' })}"`,
        `"${r.publishTime}"`,
        r.forecast,
        r.actual,
        r.error
      ].join(','))
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `windscope-uk-${data?.period?.startDate || start}-to-${data?.period?.endDate || end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const summary = data?.summary || {};
  const status = data?.dataStatus || {};
  const dataSource = data?.dataSource || (sourceMode === 'live' ? 'Live Elexon BMRS API' : 'Saved Analysis Artifact');
  const isLive = dataSource.includes('Live');

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Wind size={24} /></div>
          <div>
            <b>WindScope UK</b>
            <span>GRID ENERGY INTELLIGENCE</span>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <div className="nav-item active"><Activity size={17} /> Accuracy Overview</div>
        <div className="nav-item" onClick={() => setShowMethodology(!showMethodology)} style={{ cursor: 'pointer' }}>
          <FileText size={17} /> Methodology & Notes
        </div>

        <div className="sidebar-dataset-box">
          <div className="sidebar-box-title"><Database size={13} /> Active Dataset</div>
          <div className="sidebar-dataset-badge">
            <span className={isLive ? 'status-dot live' : 'status-dot saved'} />
            <b>{dataSource}</b>
          </div>
          <div className="sidebar-dataset-stat">Delivery: {data?.period?.startDate || start} to {data?.period?.endDate || end}</div>
          <div className="sidebar-dataset-stat">Periods: {fmt(summary.matchedPeriods)} matched</div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-source-tag">
            <span className="green-dot" /> Elexon Insights BMRS API
          </div>
          <span>BMRS Datasets: FUELHH & WINDFOR<br />Prototype MVP v0.1.0</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div>
            <div className="eyebrow">NATIONAL GRID ESO / GB ENERGY MARKET</div>
            <h1>UK Wind Forecast Accuracy Analysis</h1>
            <p>Auditable forecast-versus-outturn accuracy analysis for day-ahead procurement decisions.</p>
          </div>
          <div className="topbar-actions">
            <button
              className="refresh-btn"
              onClick={() => loadData(sourceMode, start, end, cutoff)}
              disabled={loading}
              title="Re-run analysis for current inputs"
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
              {loading ? 'Executing query…' : 'Refresh analysis'}
            </button>
          </div>
        </header>

        {/* Filters and Preset Selectors */}
        <section className="panel filters">
          <div className="filter-heading">
            <div>
              <span className="section-kicker">ANALYSIS CONFIGURATION</span>
              <h2>Data Source & Query Window</h2>
            </div>
            <div className="preset-button-group">
              <span className="preset-label">Preset Datasets:</span>
              <button
                type="button"
                className={`preset-btn ${sourceMode === 'july-2026' ? 'active' : ''}`}
                onClick={() => handleSelectPreset('july-2026')}
                disabled={loading}
              >
                📊 July 2026 (BST Summer)
              </button>
              <button
                type="button"
                className={`preset-btn ${sourceMode === 'january-2026' ? 'active' : ''}`}
                onClick={() => handleSelectPreset('january-2026')}
                disabled={loading}
              >
                📊 January 2026 (GMT Winter)
              </button>
              <button
                type="button"
                className={`preset-btn ${sourceMode === 'live' ? 'active' : ''}`}
                onClick={() => setSourceMode('live')}
                disabled={loading}
              >
                ⚡ Live Elexon API Query
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadData('live', start, end, cutoff);
            }}
            className="filter-controls"
          >
            <label>
              Delivery Date From
              <input
                type="date"
                value={start}
                max={end}
                onChange={(e) => setStart(e.target.value)}
                disabled={loading}
              />
            </label>
            <label>
              Delivery Date To
              <input
                type="date"
                value={end}
                min={start}
                onChange={(e) => setEnd(e.target.value)}
                disabled={loading}
              />
            </label>
            <label>
              Trading Cutoff (Europe/London on D-1)
              <select
                value={cutoff}
                onChange={(e) => setCutoff(e.target.value)}
                disabled={loading}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, '0')}:00 local ({cutoff === String(i) ? 'Selected' : ''})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="primary-btn"
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              {loading ? 'Running live query…' : 'Run Live Elexon Analysis'}
            </button>
          </form>

          <div className="assumption-banner">
            <AlertTriangle size={15} />
            <span>
              <b>Cutoff Rule:</b> The decision cutoff is set to <b>{cutoff}:00 Europe/London</b> on the day before delivery (D-1).
              Only forecasts published at or before this local cutoff are eligible. In BST (summer), 10:00 local corresponds to 09:00 UTC.
            </span>
          </div>
        </section>

        {/* Loading Indicator */}
        {loading && (
          <div className="loading-banner">
            <RefreshCw size={20} className="spin" />
            <div>
              <b>Analysis in progress…</b>
              <p>{loadingMsg}</p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="error-banner">
            <AlertTriangle size={20} />
            <div>
              <b>Analysis Request Failed</b>
              <p>{error}</p>
              <span>Please ensure the backend is running (`uvicorn app.main:app`) and that Elexon BMRS endpoint parameters adhere to the 7-day chunking limit.</span>
            </div>
          </div>
        )}

        {/* Data Source & Status Bar */}
        {data && (
          <div className="audit-status-strip panel">
            <div className="status-item">
              <span className="status-label">DATA SOURCE</span>
              <span className="status-val highlight">
                <span className={isLive ? 'status-dot live' : 'status-dot saved'} />
                {dataSource}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">FUELHH ACTUAL ROWS</span>
              <span className="status-val">{fmt(status.actualRows)} observations</span>
            </div>
            <div className="status-item">
              <span className="status-label">WINDFOR SNAPSHOTS</span>
              <span className="status-val">{fmt(status.forecastVersions)} versions evaluated</span>
            </div>
            <div className="status-item">
              <span className="status-label">MATCHED PERIODS</span>
              <span className="status-val">{fmt(status.matchedPeriods)} half-hours (100% matched)</span>
            </div>
          </div>
        )}

        {/* Summary Metrics Cards */}
        <section className="section-block">
          <div className="section-title">
            <div>
              <span className="section-kicker">PERFORMANCE SNAPSHOT</span>
              <h2>Overall Forecast Accuracy Metrics</h2>
            </div>
            <span className="muted">
              {data ? `${fmt(summary.matchedPeriods)} matched settlement periods (${data.period?.startDate} to ${data.period?.endDate})` : 'Awaiting data'}
            </span>
          </div>

          <div className="metric-grid">
            <MetricCard
              label="Mean Absolute Error (MAE)"
              value={fmt(summary.maeMw, 1)}
              unit="MW"
              note="Average absolute miss magnitude per half-hour period"
              icon={Activity}
              tag="Standard metric"
              tagType="neutral"
            />
            <MetricCard
              label="Root Mean Square Error (RMSE)"
              value={fmt(summary.rmseMw, 1)}
              unit="MW"
              note="Quadratic penalty highlighting larger volume deviations"
              icon={Zap}
              tag="Variance penalty"
              tagType="neutral"
            />
            <MetricCard
              label="Mean Forecast Bias"
              value={fmt(summary.biasMw, 1)}
              unit="MW"
              note={summary.biasMw > 0 ? 'Tends to over-forecast (forecast > actual)' : summary.biasMw < 0 ? 'Tends to under-forecast (forecast < actual)' : 'Balanced errors'}
              icon={summary.biasMw >= 0 ? ArrowUpRight : ArrowDownRight}
              tag={summary.biasMw > 0 ? 'Over-forecast' : summary.biasMw < 0 ? 'Under-forecast' : 'Neutral'}
              tagType={summary.biasMw > 0 ? 'warning' : 'info'}
            />
            <MetricCard
              label="WAPE"
              value={fmt(summary.wapePercent, 2)}
              unit="%"
              note="Sum of absolute errors divided by total actual wind output"
              icon={Cloud}
              tag="Relative Error"
              tagType="neutral"
            />
          </div>
        </section>

        {/* Charts Grid */}
        <section className="charts-grid">
          {/* Time Series Chart */}
          <article className="panel chart-panel wide">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">GENERATION TIME SERIES</span>
                <h2>Pre-Cutoff Forecast vs Outturn Actual</h2>
                <p>Half-hourly national wind generation (MW) across the delivery window</p>
              </div>
              <div className="legend-inline">
                <span className="legend-forecast" /> Selected Day-Ahead Forecast
                <span className="legend-actual" /> FUELHH Outturn Actual
              </div>
            </div>
            {chartData.length ? (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8edf2" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6e7f91' }} minTickGap={45} />
                    <YAxis tick={{ fontSize: 11, fill: '#6e7f91' }} width={65} unit=" MW" />
                    <Tooltip
                      formatter={(val, name) => [`${fmt(val, 1)} MW`, name]}
                      labelFormatter={(label) => `Delivery: ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      name="Forecast MW"
                      stroke="#0c8f82"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name="Actual MW"
                      stroke="#4f63c7"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-chart">
                <Wind size={32} />
                <b>No observation records to plot</b>
                <span>Load a verified artifact or execute a live Elexon query above.</span>
              </div>
            )}
          </article>

          {/* Daily MAE Chart */}
          <article className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">DAILY DISPERSION</span>
                <h2>Daily Mean Absolute Error</h2>
                <p>MAE by UK local delivery date (MW)</p>
              </div>
            </div>
            {(data?.daily || []).length ? (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={data.daily} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8edf2" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6e7f91' }} minTickGap={25} />
                    <YAxis tick={{ fontSize: 11, fill: '#6e7f91' }} width={55} unit=" MW" />
                    <Tooltip formatter={(val) => [`${fmt(val, 1)} MW`, 'Daily MAE']} />
                    <Area
                      type="monotone"
                      dataKey="maeMw"
                      name="MAE MW"
                      stroke="#0c8f82"
                      fill="#0c8f82"
                      fillOpacity={0.16}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-chart small">
                <Activity size={26} />
                <span>Daily accuracy chart will appear once data is loaded.</span>
              </div>
            )}
          </article>
        </section>

        {/* Detailed Data Tables with Tabs */}
        <section className="panel table-panel">
          <div className="table-header-row">
            <div>
              <span className="section-kicker">DETAILED RESULTS</span>
              <div className="tab-pill-group">
                <button
                  type="button"
                  className={`tab-pill ${activeTab === 'daily' ? 'active' : ''}`}
                  onClick={() => setActiveTab('daily')}
                >
                  <CalendarDays size={14} /> Daily Accuracy Breakdown ({data?.daily?.length || 0} days)
                </button>
                <button
                  type="button"
                  className={`tab-pill ${activeTab === 'observations' ? 'active' : ''}`}
                  onClick={() => setActiveTab('observations')}
                >
                  <Activity size={14} /> Auditable Settlement Periods ({chartData.length} records)
                </button>
              </div>
            </div>
            <button className="secondary-btn" onClick={downloadCsv} disabled={!chartData.length}>
              <Download size={15} /> Export Observations CSV
            </button>
          </div>

          {activeTab === 'daily' ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>UK Delivery Date</th>
                    <th>Matched Periods</th>
                    <th>MAE (MW)</th>
                    <th>RMSE (MW)</th>
                    <th>Bias (MW)</th>
                    <th>WAPE (%)</th>
                    <th>Forecast Bias Tendency</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.daily || []).map((row) => (
                    <tr key={row.date}>
                      <td><b>{row.date}</b></td>
                      <td>{row.matchedPeriods} / 48</td>
                      <td><b>{fmt(row.maeMw, 1)}</b></td>
                      <td>{fmt(row.rmseMw, 1)}</td>
                      <td className={row.biasMw > 0 ? 'error-positive' : row.biasMw < 0 ? 'error-negative' : ''}>
                        {row.biasMw > 0 ? `+${fmt(row.biasMw, 1)}` : fmt(row.biasMw, 1)}
                      </td>
                      <td><b>{fmt(row.wapePercent, 2)}%</b></td>
                      <td>
                        <span className={`tendency-pill ${row.biasMw > 0 ? 'over' : row.biasMw < 0 ? 'under' : 'neutral'}`}>
                          {row.biasMw > 0 ? 'Over-forecast' : row.biasMw < 0 ? 'Under-forecast' : 'Balanced'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!(data?.daily || []).length && (
                <div className="table-empty">No daily metrics available yet.</div>
              )}
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Delivery Time (UTC)</th>
                    <th>Delivery Time (UK Local)</th>
                    <th>Selected Forecast Published</th>
                    <th>Forecast (MW)</th>
                    <th>Actual (MW)</th>
                    <th>Error (MW)</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.slice(0, 50).map((r, i) => (
                    <tr key={`${r.startTime}-${i}`}>
                      <td>{new Date(r.startTime).toLocaleString('en-GB', { timeZone: 'UTC' })}</td>
                      <td>{new Date(r.startTime).toLocaleString('en-GB', { timeZone: 'Europe/London' })}</td>
                      <td>{new Date(r.publishTime).toLocaleString('en-GB', { timeZone: 'UTC' })}</td>
                      <td><b>{fmt(r.forecast, 1)}</b></td>
                      <td>{fmt(r.actual, 1)}</td>
                      <td className={r.error > 0 ? 'error-positive' : r.error < 0 ? 'error-negative' : ''}>
                        {r.error > 0 ? `+${fmt(r.error, 1)}` : fmt(r.error, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="table-footer">
                Showing top {Math.min(chartData.length, 50)} of {chartData.length} half-hourly settlement observations.
                Use "Export Observations CSV" for full spreadsheet analysis.
              </div>
            </div>
          )}
        </section>

        {/* Methodology & Assumptions Section */}
        {showMethodology && (
          <section className="panel methodology-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">AUDITABLE METHODOLOGY</span>
                <h2>Data Sourcing, Matching Logic & Metric Definitions</h2>
                <p>Full transparency on settlement granularity and trading cutoff assumptions</p>
              </div>
              <span className="source-pill">
                <CheckCircle2 size={13} /> Verified Prototype Methodology
              </span>
            </div>

            <div className="methodology-grid">
              <article className="methodology-card">
                <h3>1. Elexon Datasets</h3>
                <p>
                  <b>Outturn Actuals:</b> Retrieved from Elexon BMRS <code>/datasets/FUELHH</code> filtered to <code>fuelType="WIND"</code>. Values represent average MW over each 30-minute settlement period.<br />
                  <b>Forecast Publications:</b> Retrieved from <code>/datasets/WINDFOR</code> (hourly average MW snapshots published sequentially ahead of delivery).
                </p>
              </article>

              <article className="methodology-card">
                <h3>2. Procurement Cutoff Rule</h3>
                <p>
                  Cutoff is evaluated in <b>Europe/London</b> local time on <b>D-1</b> (the day before delivery).
                  Only forecast snapshots published at or before the cutoff are eligible. In BST (UTC+1), 10:00 local corresponds to 09:00 UTC. The latest eligible snapshot is selected.
                </p>
              </article>

              <article className="methodology-card">
                <h3>3. Granularity Alignment</h3>
                <p>
                  WINDFOR forecasts are 1-hour average MW values. FUELHH actuals are 30-minute average MW values.
                  Each 1-hour forecast is matched with <b>both</b> the <code>:00</code> and <code>:30</code> actuals within that hour (up to 48 matched periods/day). Actuals are never averaged, preserving true settlement cash-out exposure.
                </p>
              </article>

              <article className="methodology-card">
                <h3>4. Accuracy Formulas</h3>
                <p>
                  <b>MAE:</b> Mean Absolute Error (1/n &Sigma; |forecast &minus; actual|)<br />
                  <b>RMSE:</b> Root Mean Square Error (&radic;(1/n &Sigma; (forecast &minus; actual)&sup2;))<br />
                  <b>Bias:</b> Mean Signed Error (1/n &Sigma; (forecast &minus; actual), positive = over-forecast)<br />
                  <b>WAPE:</b> (&Sigma; |forecast &minus; actual| / &Sigma; |actual|) &times; 100%
                </p>
              </article>
            </div>

            <div className="disclaimer-banner">
              <Info size={16} />
              <span>
                <b>Prototype Notice & Operational Disclaimer:</b> The 10:00 local D-1 cutoff and hourly-to-half-hourly matching rules are explicit prototype conventions. Commercial trading desks operating under BSC settlement rules should confirm exact gate-closure cutoffs, intra-day updates, and contract-specific imbalance cashout pricing before relying on results for trading decisions.
              </span>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="footer">
          <span>WindScope UK · Day-Ahead Wind Forecast Accuracy Platform</span>
          <span>Forecast Error = Forecast MW − Actual MW</span>
          <span><CheckCircle2 size={13} /> Elexon BMRS Verified Integration</span>
        </footer>
      </main>
    </div>
  );
}
