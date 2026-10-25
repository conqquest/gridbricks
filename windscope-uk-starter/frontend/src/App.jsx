import React from "react";
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, CheckCircle2, Cloud, Download, RefreshCw, Wind, Zap } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const fmt = (n, digits = 0) => n == null ? '—' : Number(n).toLocaleString('en-GB', { maximumFractionDigits: digits });

function MetricCard({ label, value, unit, note, icon: Icon, positive }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17}/></span></div><div className="metric-value">{value}<small>{unit}</small></div><div className="metric-note">{note}</div></article>;
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [start, setStart] = useState('2026-01-01');
  const [end, setEnd] = useState('2026-01-31');
  const [cutoff, setCutoff] = useState('10');

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await axios.get(`${API}/api/analysis`, { params: { start_date: start, end_date: end, cutoff_hour: Number(cutoff) }, timeout: 120000 });
      setData(response.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load data. Check that the Python API is running and Elexon is reachable.');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const chartData = useMemo(() => (data?.observations || []).map(r => ({ ...r, label: new Date(r.startTime).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) })), [data]);
  function downloadCsv() {
    const rows = data?.observations || [];
    const header = ['startTime','publishTime','forecast_MW','actual_MW','error_MW'];
    const csv = [header.join(','), ...rows.map(r => [r.startTime,r.publishTime,r.forecast,r.actual,r.error].map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'windscope-analysis.csv'; a.click(); URL.revokeObjectURL(url);
  }

  const summary = data?.summary || {};
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><Wind size={23}/></div><div><b>windscope</b><span>UK ENERGY INTELLIGENCE</span></div></div><div className="nav-label">WORKSPACE</div><div className="nav-item active"><Activity size={17}/> Forecast overview</div><div className="nav-item"><CalendarDays size={17}/> Historical analysis</div><div className="sidebar-bottom"><div className="status-dot"/> Elexon BMRS data source<br/><span>Prototype · Historical analysis</span></div></aside>
    <main className="main-content">
      <header className="topbar"><div><div className="eyebrow">ENERGY MARKET ANALYTICS / GB</div><h1>Wind forecast intelligence</h1><p>Understand forecast performance before day-ahead procurement decisions.</p></div><button className="refresh-btn" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''}/>{loading ? 'Loading data' : 'Refresh data'}</button></header>
      <section className="filters panel"><div className="filter-heading"><div><span className="section-kicker">ANALYSIS WINDOW</span><h2>Historical performance</h2></div><span className="source-pill"><span className="green-dot"/> Elexon BMRS</span></div><div className="filter-controls"><label>Delivery date from<input type="date" value={start} max={end} onChange={e => setStart(e.target.value)}/></label><label>Delivery date to<input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)}/></label><label>Decision cutoff (UK time)<select value={cutoff} onChange={e => setCutoff(e.target.value)}>{Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}</select></label><button className="primary-btn" onClick={load} disabled={loading}>Run analysis <ArrowUpRight size={16}/></button></div><div className="assumption"><AlertTriangle size={15}/> Decision cutoff is a configurable prototype assumption. Confirm the client's actual trading cutoff before interpreting results.</div></section>
      {error && <div className="error-banner"><AlertTriangle size={18}/><div><b>Data request failed</b><p>{error}</p><span>Historical forecast API coverage and query parameters may need verification against current Elexon documentation.</span></div></div>}
      <section className="section-block"><div className="section-title"><div><span className="section-kicker">PERFORMANCE SNAPSHOT</span><h2>Forecast accuracy</h2></div><span className="muted">{data ? `${fmt(summary.matchedPeriods)} matched half-hour periods` : 'Waiting for data'}</span></div><div className="metric-grid"><MetricCard label="Mean absolute error" value={fmt(summary.maeMw,1)} unit="MW" note="Average absolute forecast error" icon={Activity}/><MetricCard label="Root mean square error" value={fmt(summary.rmseMw,1)} unit="MW" note="Penalises larger misses" icon={Zap}/><MetricCard label="Mean forecast bias" value={fmt(summary.biasMw,1)} unit="MW" note={summary.biasMw > 0 ? 'Forecast tends to overestimate' : summary.biasMw < 0 ? 'Forecast tends to underestimate' : 'Positive = overforecast'} icon={summary.biasMw > 0 ? ArrowUpRight : ArrowDownRight}/><MetricCard label="WAPE" value={fmt(summary.wapePercent,1)} unit="%" note="Absolute error / total actual" icon={Cloud}/></div></section>
      <section className="charts-grid"><article className="panel chart-panel wide"><div className="panel-heading"><div><span className="section-kicker">TIME SERIES</span><h2>Forecast vs actual generation</h2><p>Half-hourly national wind generation · MW</p></div><div className="legend-inline"><span className="legend-forecast"/> Forecast <span className="legend-actual"/> Actual</div></div>{chartData.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="300"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e5ebf0"/><XAxis dataKey="label" tick={{fontSize:10,fill:'#718096'}} minTickGap={35}/><YAxis tick={{fontSize:11,fill:'#718096'}} width={60}/><Tooltip/><Legend/><Line type="monotone" dataKey="forecast" name="Forecast MW" stroke="#0c8f82" strokeWidth={2} dot={false} connectNulls/><Line type="monotone" dataKey="actual" name="Actual MW" stroke="#5265c8" strokeWidth={2} dot={false} connectNulls/></LineChart></ResponsiveContainer></div> : <div className="empty-chart"><Wind size={28}/><b>{loading ? 'Loading historical records…' : 'Forecast and actual series will appear here'}</b><span>Run the analysis to load and match historical data.</span></div>}</article>
      <article className="panel chart-panel"><div className="panel-heading"><div><span className="section-kicker">DAILY BREAKDOWN</span><h2>Daily MAE</h2><p>Mean absolute error by delivery date</p></div></div>{(data?.daily || []).length ? <ResponsiveContainer width="100%" height={300}><AreaChart data={data.daily}><CartesianGrid strokeDasharray="3 3" stroke="#e5ebf0"/><XAxis dataKey="date" tick={{fontSize:10}} minTickGap={24}/><YAxis tick={{fontSize:11}}/><Tooltip/><Area type="monotone" dataKey="maeMw" name="MAE MW" stroke="#0c8f82" fill="#0c8f82" fillOpacity={0.14}/></AreaChart></ResponsiveContainer> : <div className="empty-chart small"><Activity size={25}/><span>Daily accuracy appears when matching records are available.</span></div>}</article></section>
      <section className="panel table-panel"><div className="panel-heading"><div><span className="section-kicker">AUDITABLE OBSERVATIONS</span><h2>Matched forecast records</h2><p>Each selected forecast is tied to a publication timestamp.</p></div><button className="secondary-btn" onClick={downloadCsv} disabled={!chartData.length}><Download size={15}/> Export CSV</button></div><div className="table-scroll"><table><thead><tr><th>Delivery time (UTC)</th><th>Forecast published</th><th>Forecast MW</th><th>Actual MW</th><th>Error MW</th></tr></thead><tbody>{chartData.slice(0,20).map((r,i)=><tr key={`${r.startTime}-${i}`}><td>{new Date(r.startTime).toLocaleString('en-GB',{timeZone:'UTC'})}</td><td>{new Date(r.publishTime).toLocaleString('en-GB',{timeZone:'UTC'})}</td><td>{fmt(r.forecast,1)}</td><td>{fmt(r.actual,1)}</td><td className={r.error > 0 ? 'error-positive' : r.error < 0 ? 'error-negative' : ''}>{fmt(r.error,1)}</td></tr>)}</tbody></table>{!chartData.length && <div className="table-empty">No matched records yet. If the API returned no data, inspect the backend logs and endpoint query requirements.</div>}</div><div className="table-footer">Showing {Math.min(chartData.length,20)} of {chartData.length} matched periods</div></section>
      <footer className="footer"><span>Windscope UK · Prototype</span><span>Forecast error = forecast MW − actual MW</span><span><CheckCircle2 size={13}/> Historical analysis only</span></footer>
    </main>
  </div>;
}
