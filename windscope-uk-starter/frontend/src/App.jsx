import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays,
  CheckCircle2, Cloud, Database, Download, FileText, Info, RefreshCw, Wind, Zap,
  ExternalLink, ChevronRight, Layers, Clock, TrendingUp, Sliders
} from 'lucide-react';

import WindScopeHeader from './components/WindScopeHeader';
import LandscapeFooter from './components/LandscapeFooter';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const fmt = (n, digits = 0) => (n == null ? '—' : Number(n).toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits }));

function MetricCard({ label, value, unit, note, icon: Icon, tag, tagType }) {
  return (
    <article className="editorial-kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className={`kpi-icon-wrap ${tagType || 'neutral'}`}>
          <Icon size={17} />
        </span>
      </div>
      <div className="kpi-value-row">
        <span className="kpi-number">{value}</span>
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      <div className="kpi-footer">
        {tag && <span className={`kpi-tag ${tagType || 'neutral'}`}>{tag}</span>}
        <span className="kpi-note">{note}</span>
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
          : 'Could not load saved analysis artifact. Ensure the backend server is running on port 8000.')
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

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  const summary = data?.summary || {};
  const status = data?.dataStatus || {};
  const dataSource = data?.dataSource || (sourceMode === 'live' ? 'Live Elexon BMRS API' : 'Saved Analysis Artifact');
  const isLive = dataSource.includes('Live');

  return (
    <div className="editorial-app-root">
      {/* Editorial Header */}
      <WindScopeHeader
        activeSection="hero"
        onNavigate={scrollToSection}
        onRefresh={() => loadData(sourceMode, start, end, cutoff)}
        loading={loading}
        dataSource={dataSource}
      />

      {/* Hero Section */}
      <section className="editorial-hero" id="hero">
        {/* Sky illustrations: drifting clouds & gentle breeze lines */}
        <div className="hero-sky-elements" aria-hidden="true">
          <svg className="hero-wind-streamlines" viewBox="0 0 1200 320" preserveAspectRatio="none">
            <path d="M-50 90 Q 200 65, 450 85 T 950 75 T 1300 95" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeDasharray="8 12" fill="none" />
            <path d="M-20 160 Q 300 135, 600 155 T 1150 145" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeDasharray="14 18" fill="none" />
            <path d="M100 230 Q 400 205, 800 225 T 1280 215" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="6 14" fill="none" />
          </svg>

          {/* Stylized cream clouds floating across the hero sky */}
          <div className="hero-cloud-shape hero-cloud-left" />
          <div className="hero-cloud-shape hero-cloud-right" />
        </div>

        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-bullet" />
            NATIONAL GRID ESO &bull; ELEXON BMRS BALANCING MECHANISM
          </div>

          <h1 className="hero-title">
            Understand Wind <br className="hero-br" />
            Forecast Accuracy.
          </h1>

          <p className="hero-subtitle">
            WindScope UK independently compares Day-Ahead National Grid wind forecasts with outturn generation, providing verifiable auditability across Great Britain&rsquo;s half-hour settlement periods.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="editorial-primary-btn"
              onClick={() => scrollToSection('analysis')}
            >
              Explore Analysis Dashboard
              <ChevronRight size={17} />
            </button>

            <button
              type="button"
              className="editorial-ghost-btn"
              onClick={() => scrollToSection('methodology')}
            >
              <FileText size={16} />
              Read Methodology
            </button>
          </div>

          {/* Quick Stats Pill Strip */}
          <div className="hero-stat-strip">
            <div className="hero-stat-pill">
              <span className="stat-pill-label">Settlement Cadence</span>
              <span className="stat-pill-value">48 Half-Hours / Day</span>
            </div>
            <div className="hero-stat-pill">
              <span className="stat-pill-label">Decision Boundary</span>
              <span className="stat-pill-value">10:00 Europe/London (D-1)</span>
            </div>
            <div className="hero-stat-pill">
              <span className="stat-pill-label">Primary Sources</span>
              <span className="stat-pill-value">Elexon FUELHH &amp; WINDFOR</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Analysis Section */}
      <main className="editorial-main" id="analysis">
        <div className="editorial-container">

          {/* Section Kicker */}
          <div className="section-intro">
            <div>
              <span className="editorial-kicker">BENCHMARK INTELLIGENCE</span>
              <h2 className="section-headline">Forecast-versus-Outturn Accuracy</h2>
              <p className="section-subtext">
                Audit forecast accuracy across GB settlement periods. Switch between verified monthly baselines or execute an on-demand live query directly against Elexon BMRS.
              </p>
            </div>

            <div className="intro-actions">
              <button
                type="button"
                className="editorial-subtle-btn"
                onClick={() => loadData(sourceMode, start, end, cutoff)}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
                {loading ? 'Executing…' : 'Refresh Data'}
              </button>
            </div>
          </div>

          {/* Configuration & Controls Card */}
          <section className="editorial-card control-card">
            <div className="control-header">
              <div>
                <span className="card-kicker">QUERY SETTINGS</span>
                <h3 className="card-title">Dataset &amp; Trading Cutoff Window</h3>
              </div>

              {/* Preset Datasets Switcher */}
              <div className="preset-pill-group" role="group" aria-label="Preset Datasets">
                <span className="preset-group-label">Verified Presets:</span>
                <button
                  type="button"
                  className={`preset-tab ${sourceMode === 'july-2026' ? 'active' : ''}`}
                  onClick={() => handleSelectPreset('july-2026')}
                  disabled={loading}
                >
                  July 2026 (BST Summer)
                </button>
                <button
                  type="button"
                  className={`preset-tab ${sourceMode === 'january-2026' ? 'active' : ''}`}
                  onClick={() => handleSelectPreset('january-2026')}
                  disabled={loading}
                >
                  January 2026 (GMT Winter)
                </button>
                <button
                  type="button"
                  className={`preset-tab ${sourceMode === 'live' ? 'active' : ''}`}
                  onClick={() => setSourceMode('live')}
                  disabled={loading}
                >
                  ⚡ Live Elexon API Query
                </button>
              </div>
            </div>

            {/* Custom Range & Cutoff Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadData('live', start, end, cutoff);
              }}
              className="control-form"
            >
              <div className="form-field">
                <label htmlFor="input-start-date">Delivery Date From</label>
                <input
                  id="input-start-date"
                  type="date"
                  value={start}
                  max={end}
                  onChange={(e) => setStart(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="form-field">
                <label htmlFor="input-end-date">Delivery Date To</label>
                <input
                  id="input-end-date"
                  type="date"
                  value={end}
                  min={start}
                  onChange={(e) => setEnd(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="form-field">
                <label htmlFor="input-cutoff-hour">Gate Cutoff (Europe/London on D-1)</label>
                <select
                  id="input-cutoff-hour"
                  value={cutoff}
                  onChange={(e) => setCutoff(e.target.value)}
                  disabled={loading}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, '0')}:00 local {cutoff === String(i) ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-action">
                <button
                  type="submit"
                  className="editorial-action-btn"
                  disabled={loading}
                >
                  <RefreshCw size={14} className={loading ? 'spin' : ''} />
                  {loading ? 'Querying Elexon…' : 'Run Live Analysis'}
                </button>
              </div>
            </form>

            {/* Subtle Cutoff Rule Banner */}
            <div className="editorial-callout-notice">
              <Sliders size={16} className="notice-icon" />
              <div className="notice-text">
                <strong>Cutoff Policy:</strong> Gate closure is evaluated at <strong>{cutoff}:00 Europe/London</strong> on the day prior to delivery (D-1). Only forecast snapshots published at or before this local time are eligible. During BST (summer), 10:00 local maps to 09:00 UTC.
              </div>
            </div>
          </section>

          {/* Loading Banner */}
          {loading && (
            <div className="editorial-loading-card" role="status" aria-live="polite">
              <RefreshCw size={22} className="spin text-cerulean" />
              <div>
                <h4 className="loading-title">Ingesting and Aggregating Settlement Data…</h4>
                <p className="loading-desc">{loadingMsg}</p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="editorial-error-card" role="alert">
              <AlertTriangle size={22} className="text-coral" />
              <div>
                <h4 className="error-title">Analysis Request Failed</h4>
                <p className="error-desc">{error}</p>
                <span className="error-hint">Verify that the backend is running (`uvicorn app.main:app`) on port 8000 and that Elexon parameters obey the 7-day query ceiling.</span>
              </div>
            </div>
          )}

          {/* Audit Status Strip */}
          {data && (
            <section className="audit-strip-card" aria-label="Ingestion Audit Metadata">
              <div className="audit-item">
                <span className="audit-label">ACTIVE DATA SOURCE</span>
                <span className="audit-value highlight">
                  <span className={`status-dot ${isLive ? 'live' : 'saved'}`} />
                  {dataSource}
                </span>
              </div>
              <div className="audit-item">
                <span className="audit-label">FUELHH ACTUALS</span>
                <span className="audit-value">{fmt(status.actualRows)} rows</span>
              </div>
              <div className="audit-item">
                <span className="audit-label">WINDFOR SNAPSHOTS</span>
                <span className="audit-value">{fmt(status.forecastVersions)} snapshots</span>
              </div>
              <div className="audit-item">
                <span className="audit-label">MATCHED PERIODS</span>
                <span className="audit-value">{fmt(status.matchedPeriods)} / {fmt(status.matchedPeriods)} (100%)</span>
              </div>
            </section>
          )}

          {/* Summary KPI Cards Grid */}
          <section className="kpi-section" aria-label="Summary Performance Metrics">
            <div className="kpi-grid">
              <MetricCard
                label="Mean Absolute Error (MAE)"
                value={fmt(summary.maeMw, 1)}
                unit="MW"
                note="Average magnitude of forecast deviation per half-hour"
                icon={Activity}
                tag="Primary Accuracy"
                tagType="neutral"
              />
              <MetricCard
                label="Root Mean Square Error (RMSE)"
                value={fmt(summary.rmseMw, 1)}
                unit="MW"
                note="Quadratic penalty heavily weighting severe volume misses"
                icon={Zap}
                tag="Variance Penalty"
                tagType="neutral"
              />
              <MetricCard
                label="Mean Forecast Bias"
                value={fmt(summary.biasMw, 1)}
                unit="MW"
                note={summary.biasMw > 0 ? 'Tends to over-forecast (Forecast > Actual)' : summary.biasMw < 0 ? 'Tends to under-forecast (Forecast < Actual)' : 'Balanced errors'}
                icon={summary.biasMw >= 0 ? ArrowUpRight : ArrowDownRight}
                tag={summary.biasMw > 0 ? '+Over-forecast' : summary.biasMw < 0 ? '-Under-forecast' : 'Neutral'}
                tagType={summary.biasMw > 0 ? 'coral' : 'cerulean'}
              />
              <MetricCard
                label="Weighted Error (WAPE)"
                value={fmt(summary.wapePercent, 2)}
                unit="%"
                note="Total absolute error scaled by total outturn generation"
                icon={Cloud}
                tag="Relative Miss"
                tagType="neutral"
              />
            </div>
          </section>

          {/* Charts Grid */}
          <section className="editorial-charts-grid" aria-label="Visualizations">
            {/* Time Series Chart */}
            <article className="editorial-card chart-card wide">
              <div className="chart-card-header">
                <div>
                  <span className="card-kicker">GENERATION TIME SERIES</span>
                  <h3 className="card-title">Day-Ahead Forecast vs Outturn Actual</h3>
                  <p className="card-caption">National wind generation across half-hourly settlement periods</p>
                </div>
                <div className="chart-legend-box">
                  <span className="legend-chip legend-forecast">Selected Day-Ahead Forecast</span>
                  <span className="legend-chip legend-actual">FUELHH Outturn Actual</span>
                </div>
              </div>

              {chartData.length ? (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={340}>
                    <LineChart data={chartData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee6da" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#677a8e' }} minTickGap={45} />
                      <YAxis tick={{ fontSize: 11, fill: '#677a8e' }} width={65} unit=" MW" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5ded2',
                          borderRadius: '8px',
                          boxShadow: '0 4px 14px rgba(35, 45, 60, 0.08)',
                          fontSize: '12px'
                        }}
                        formatter={(val, name) => [`${fmt(val, 1)} MW`, name]}
                        labelFormatter={(label) => `Delivery: ${label}`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        name="Day-Ahead Forecast (MW)"
                        stroke="#eb5d38"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        name="Outturn Actual (MW)"
                        stroke="#2c6ecb"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-chart-box">
                  <Wind size={36} className="text-muted-icon" />
                  <span className="empty-title">No observations loaded</span>
                  <span className="empty-sub">Select a preset or trigger a live analysis above.</span>
                </div>
              )}
            </article>

            {/* Daily MAE Chart */}
            <article className="editorial-card chart-card">
              <div className="chart-card-header">
                <div>
                  <span className="card-kicker">DAILY DISPERSION</span>
                  <h3 className="card-title">Daily Mean Absolute Error</h3>
                  <p className="card-caption">MAE grouped by UK local delivery date (MW)</p>
                </div>
              </div>

              {(data?.daily || []).length ? (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={340}>
                    <AreaChart data={data.daily} margin={{ top: 15, right: 15, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee6da" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#677a8e' }} minTickGap={25} />
                      <YAxis tick={{ fontSize: 11, fill: '#677a8e' }} width={55} unit=" MW" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5ded2',
                          borderRadius: '8px',
                          boxShadow: '0 4px 14px rgba(35, 45, 60, 0.08)',
                          fontSize: '12px'
                        }}
                        formatter={(val) => [`${fmt(val, 1)} MW`, 'Daily MAE']}
                      />
                      <Area
                        type="monotone"
                        dataKey="maeMw"
                        name="Daily MAE (MW)"
                        stroke="#769866"
                        fill="#769866"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-chart-box">
                  <Activity size={32} className="text-muted-icon" />
                  <span className="empty-title">Awaiting daily aggregation</span>
                </div>
              )}
            </article>
          </section>

          {/* Tables Section with Accessible Region and Tabs */}
          <section className="editorial-card table-card" aria-label="Detailed Results">
            <div className="table-nav-row">
              <div className="table-title-area">
                <span className="card-kicker">AUDIT RECORDS</span>
                <div className="tab-pill-container" role="tablist" aria-label="Table View Switcher">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'daily'}
                    className={`tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
                    onClick={() => setActiveTab('daily')}
                  >
                    <CalendarDays size={14} />
                    Daily Accuracy Breakdown ({data?.daily?.length || 0} days)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'observations'}
                    className={`tab-btn ${activeTab === 'observations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('observations')}
                  >
                    <Activity size={14} />
                    Settlement Periods ({chartData.length} records)
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="editorial-download-btn"
                onClick={downloadCsv}
                disabled={!chartData.length}
              >
                <Download size={14} />
                Export Observations CSV
              </button>
            </div>

            {/* Responsive Table Wrapper with Accessible Region & Sticky Headers */}
            {activeTab === 'daily' ? (
              <div
                className="table-scroll-wrapper"
                tabIndex={0}
                role="region"
                aria-label="Daily accuracy breakdown table"
              >
                <table className="editorial-table">
                  <thead>
                    <tr>
                      <th scope="col">UK Delivery Date</th>
                      <th scope="col">Matched Periods</th>
                      <th scope="col">MAE (MW)</th>
                      <th scope="col">RMSE (MW)</th>
                      <th scope="col">Bias (MW)</th>
                      <th scope="col">WAPE (%)</th>
                      <th scope="col">Forecast Bias Tendency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.daily || []).map((row) => (
                      <tr key={row.date}>
                        <td><strong>{row.date}</strong></td>
                        <td>{row.matchedPeriods} / 48</td>
                        <td><strong>{fmt(row.maeMw, 1)}</strong></td>
                        <td>{fmt(row.rmseMw, 1)}</td>
                        <td className={row.biasMw > 0 ? 'cell-coral' : row.biasMw < 0 ? 'cell-cerulean' : ''}>
                          {row.biasMw > 0 ? `+${fmt(row.biasMw, 1)}` : fmt(row.biasMw, 1)}
                        </td>
                        <td><strong>{fmt(row.wapePercent, 2)}%</strong></td>
                        <td>
                          <span className={`bias-pill ${row.biasMw > 0 ? 'over' : row.biasMw < 0 ? 'under' : 'neutral'}`}>
                            {row.biasMw > 0 ? '+Over-forecast' : row.biasMw < 0 ? '-Under-forecast' : 'Balanced'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!(data?.daily || []).length && (
                  <div className="table-empty-row">No daily metrics available. Load a dataset above.</div>
                )}
              </div>
            ) : (
              <div
                className="table-scroll-wrapper"
                tabIndex={0}
                role="region"
                aria-label="Auditable settlement observations table"
              >
                <table className="editorial-table">
                  <thead>
                    <tr>
                      <th scope="col">Delivery Time (UTC)</th>
                      <th scope="col">Delivery Time (UK Local)</th>
                      <th scope="col">Selected Snapshot Published</th>
                      <th scope="col">Forecast (MW)</th>
                      <th scope="col">Actual (MW)</th>
                      <th scope="col">Error (MW)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.slice(0, 50).map((r, i) => (
                      <tr key={`${r.startTime}-${i}`}>
                        <td>{new Date(r.startTime).toLocaleString('en-GB', { timeZone: 'UTC' })}</td>
                        <td>{new Date(r.startTime).toLocaleString('en-GB', { timeZone: 'Europe/London' })}</td>
                        <td>{new Date(r.publishTime).toLocaleString('en-GB', { timeZone: 'UTC' })}</td>
                        <td><strong>{fmt(r.forecast, 1)}</strong></td>
                        <td>{fmt(r.actual, 1)}</td>
                        <td className={r.error > 0 ? 'cell-coral' : r.error < 0 ? 'cell-cerulean' : ''}>
                          {r.error > 0 ? `+${fmt(r.error, 1)}` : fmt(r.error, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="table-caption-bar">
                  Showing top {Math.min(chartData.length, 50)} of {chartData.length} settlement observations.
                  Download CSV for the full audit ledger.
                </div>
              </div>
            )}
          </section>

          {/* Methodology & Market Assumptions Section */}
          <section className="editorial-card methodology-section" id="methodology">
            <div className="methodology-header">
              <div>
                <span className="card-kicker">GOVERNANCE &amp; METHODOLOGY</span>
                <h3 className="section-headline">Data Sourcing, Matching Logic &amp; Formulas</h3>
                <p className="section-subtext">
                  Complete audit transparency on settlement rules, timezone boundaries, and statistical scoring.
                </p>
              </div>
              <div className="methodology-badge">
                <CheckCircle2 size={15} />
                <span>Verified Balancing Mechanism Spec</span>
              </div>
            </div>

            <div className="methodology-grid" id="datasources">
              <article className="methodology-item">
                <div className="methodology-num">01</div>
                <h4 className="methodology-title">Elexon BMRS Datasets</h4>
                <p className="methodology-body">
                  <strong>Outturn Actuals:</strong> Ingested from Elexon BMRS <code>/datasets/FUELHH</code> filtered strictly to <code>fuelType=&quot;WIND&quot;</code>. Each row represents average generation (MW) over a 30-minute settlement period.<br />
                  <strong>Forecast Publications:</strong> Ingested from <code>/datasets/WINDFOR</code> (hourly average MW forecasts published sequentially ahead of real-time delivery).
                </p>
              </article>

              <article className="methodology-item">
                <div className="methodology-num">02</div>
                <h4 className="methodology-title">Procurement Cutoff Policy</h4>
                <p className="methodology-body">
                  Cutoff is evaluated in <strong>Europe/London</strong> local time on <strong>D-1</strong> (the day before delivery). Only forecast snapshots published at or before the cutoff are eligible. In BST (UTC+1), 10:00 local maps to 09:00 UTC. The latest pre-cutoff snapshot is selected.
                </p>
              </article>

              <article className="methodology-item">
                <div className="methodology-num">03</div>
                <h4 className="methodology-title">Granularity Alignment</h4>
                <p className="methodology-body">
                  WINDFOR forecasts are 1-hour average MW values. FUELHH actuals are 30-minute average MW values. Each 1-hour forecast is mapped to <strong>both</strong> the <code>:00</code> and <code>:30</code> actuals within that hour (up to 48 matched periods/day). Actuals are never averaged, preserving true settlement cashout volatility.
                </p>
              </article>

              <article className="methodology-item">
                <div className="methodology-num">04</div>
                <h4 className="methodology-title">Mathematical Metric Formulas</h4>
                <p className="methodology-body">
                  <strong>MAE:</strong> (1/n &Sigma; |forecast &minus; actual|)<br />
                  <strong>RMSE:</strong> (&radic;(1/n &Sigma; (forecast &minus; actual)&sup2;))<br />
                  <strong>Bias:</strong> (1/n &Sigma; (forecast &minus; actual)), positive = over-forecast<br />
                  <strong>WAPE:</strong> (&Sigma; |forecast &minus; actual| / &Sigma; |actual|) &times; 100%
                </p>
              </article>
            </div>

            {/* Prototype Operational Disclaimer */}
            <div className="methodology-disclaimer">
              <Info size={17} className="disclaimer-icon" />
              <div className="disclaimer-text">
                <strong>Prototype Notice &amp; Operational Disclaimer:</strong> The 10:00 local D-1 cutoff and hourly-to-half-hourly matching rules are explicit prototype conventions. Commercial trading desks operating under BSC settlement rules should confirm exact gate-closure cutoffs, intra-day updates, and contract-specific imbalance cashout pricing before relying on results for trading decisions.
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Visually Distinctive Illustrated Landscape Footer */}
      <LandscapeFooter onNavigate={scrollToSection} />
    </div>
  );
}
