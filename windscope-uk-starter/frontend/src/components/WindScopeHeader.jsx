import React from 'react';
import { Wind, Activity, FileText, Database, RefreshCw } from 'lucide-react';

export default function WindScopeHeader({
  activeSection,
  onNavigate,
  onRefresh,
  loading,
  dataSource
}) {
  const isLive = dataSource?.includes('Live');

  return (
    <header className="editorial-header">
      <div className="header-inner">
        {/* Brand */}
        <div className="header-brand" onClick={() => onNavigate('hero')} role="button" tabIndex={0}>
          <div className="header-logo-mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
              <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
              <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
            </svg>
          </div>
          <div className="header-brand-text">
            <span className="brand-title">WindScope UK</span>
            <span className="brand-subtitle">Energy Intelligence</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="header-nav" aria-label="Main Navigation">
          <button
            type="button"
            className={`nav-link ${activeSection === 'hero' ? 'active' : ''}`}
            onClick={() => onNavigate('hero')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`nav-link ${activeSection === 'analysis' ? 'active' : ''}`}
            onClick={() => onNavigate('analysis')}
          >
            Analysis
          </button>
          <button
            type="button"
            className={`nav-link ${activeSection === 'methodology' ? 'active' : ''}`}
            onClick={() => onNavigate('methodology')}
          >
            Methodology
          </button>
          <button
            type="button"
            className={`nav-link ${activeSection === 'datasources' ? 'active' : ''}`}
            onClick={() => onNavigate('datasources')}
          >
            Data Sources
          </button>
        </nav>

        {/* Right Action & Status */}
        <div className="header-actions">
          <div className="header-source-pill" title={`Active: ${dataSource}`}>
            <span className={`status-indicator ${isLive ? 'live' : 'saved'}`} />
            <span className="source-name">{isLive ? 'Live Elexon BMRS' : 'Verified Dataset'}</span>
          </div>

          <button
            type="button"
            className="header-refresh-btn"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh current analysis"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span className="btn-text">{loading ? 'Querying…' : 'Refresh'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
