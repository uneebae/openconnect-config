import React, { useState, useCallback } from 'react';
import {
  ShieldCheck, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Info, Download, ChevronDown, ChevronRight, Zap, Clock
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: { color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/25',     label: 'Critical' },
  high:     { color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/25', label: 'High' },
  warning:  { color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/25', label: 'Warning' },
  low:      { color: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-700/30', label: 'Low' },
};

const READINESS_CONFIG = {
  'production-ready': { label: 'Production Ready',  color: 'text-emerald-400', bg: 'bg-emerald-500/12 border-emerald-500/30', glow: 'shadow-emerald-500/20' },
  'nearly-ready':     { label: 'Nearly Ready',       color: 'text-amber-400',   bg: 'bg-amber-500/12 border-amber-500/30',   glow: 'shadow-amber-500/20' },
  'needs-work':       { label: 'Needs Work',          color: 'text-orange-400',  bg: 'bg-orange-500/12 border-orange-500/30', glow: 'shadow-orange-500/20' },
  'not-ready':        { label: 'Not Ready',           color: 'text-red-400',     bg: 'bg-red-500/12 border-red-500/25',       glow: 'shadow-red-500/20' },
};

function ScoreGauge({ score, readiness }) {
  const cfg   = READINESS_CONFIG[readiness] || READINESS_CONFIG['not-ready'];
  const color = score >= 90 ? '#10b981' : score >= 70 ? '#f59e0b' : score >= 50 ? '#f97316' : '#ef4444';
  const circumference = 2 * Math.PI * 54;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - score / 100)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color }}>{score}%</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Readiness</span>
        </div>
      </div>
      <span className={`px-4 py-1.5 rounded-xl border text-sm font-bold shadow-lg ${cfg.bg} ${cfg.color} ${cfg.glow}`}>
        {cfg.label}
      </span>
    </div>
  );
}

function CheckRow({ check }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_CONFIG[check.severity] || SEVERITY_CONFIG.low;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${check.passed ? 'border-slate-700/25' : sev.bg}`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/20 transition">
        {check.passed
          ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          : <XCircle className={`w-4 h-4 flex-shrink-0 ${sev.color}`} />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${check.passed ? 'text-slate-200' : sev.color}`}>
              {check.title}
            </span>
            {!check.passed && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border ${sev.bg} ${sev.color}`}>
                {sev.label}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{check.detail}</p>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/20 pt-3 space-y-2">
          <p className="text-xs text-slate-400">{check.description}</p>
          {!check.passed && check.recommendation && (
            <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/15">
              <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400/90">{check.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategorySection({ category, checks }) {
  const [collapsed, setCollapsed] = useState(false);
  const passed  = checks.filter(c => c.passed).length;
  const failed  = checks.filter(c => !c.passed).length;
  const allPass = failed === 0;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/20 transition">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-200">{category}</span>
          <span className={`text-xs px-2 py-0.5 rounded-lg border font-semibold ${
            allPass
              ? 'bg-emerald-500/12 border-emerald-500/25 text-emerald-400'
              : 'bg-red-500/12 border-red-500/25 text-red-400'
          }`}>
            {passed}/{checks.length} passed
          </span>
        </div>
        {collapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {!collapsed && (
        <div className="px-5 pb-5 space-y-2 border-t border-slate-700/20 pt-4">
          {checks.map(c => <CheckRow key={c.id} check={c} />)}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ProductionReadinessChecker({ darkMode }) {
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [configName, setConfigName] = useState('');
  const [history, setHistory]   = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/config/readiness-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configName: configName.trim() || 'Current Config' }),
      });
      const data = await res.json();
      if (!data.success && !data.score) setError(data.error || 'Check failed');
      else setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [configName]);

  const loadHistory = async () => {
    try {
      const res  = await fetch('/api/config/readiness-history');
      const data = await res.json();
      if (data.success) setHistory(data.history);
      setShowHistory(true);
    } catch {}
  };

  const exportReport = () => {
    if (!result) return;
    const lines = [
      `OpenConnect Production Readiness Report`,
      `Generated: ${new Date().toISOString()}`,
      `Score: ${result.score}% — ${(READINESS_CONFIG[result.readiness] || {}).label}`,
      `Passed: ${result.passedChecks} / ${result.totalChecks}`,
      ``,
      `CRITICAL FAILURES:`,
      ...(result.criticalFailures.length === 0 ? ['  None'] : result.criticalFailures.map(c => `  ✗ [${c.category}] ${c.title}: ${c.detail}`)),
      ``,
      `HIGH PRIORITY:`,
      ...(result.highFailures.length === 0 ? ['  None'] : result.highFailures.map(c => `  ✗ [${c.category}] ${c.title}: ${c.detail}`)),
      ``,
      `WARNINGS:`,
      ...(result.warnings.length === 0 ? ['  None'] : result.warnings.map(c => `  ⚠ [${c.category}] ${c.title}: ${c.detail}`)),
      ``,
      `ALL CHECKS:`,
      ...result.results.map(c => `  ${c.passed ? '✓' : '✗'} [${c.severity.toUpperCase()}] ${c.title}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `readiness-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-8 flex flex-col">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/25 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/10">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>Production Readiness Checker</h1>
            <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Automated go-live checklist for OpenConnect integrations. Validates config completeness, security, routing, and field mappings.
            </p>
          </div>
        </div>
      </div>

      {/* ── Launch Panel ──────────────────────────────────────── */}
      {!result && (
        <div className="glass-card rounded-2xl p-8 mb-6 flex-1 flex flex-col">
          <div className="max-w-lg mx-auto space-y-6 flex-1 flex flex-col justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <Zap className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className={`text-lg font-bold mt-4 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Run Readiness Check</h2>
              <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Scans all 21 production checks across your current deployed configuration in &lt;1 second.
              </p>
            </div>
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 text-left ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Config Name (optional)
              </label>
              <input
                type="text"
                value={configName}
                onChange={e => setConfigName(e.target.value)}
                placeholder="e.g. Balance-Inquiry v2.1"
                className={`w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all ${
                  darkMode
                    ? 'bg-slate-800/60 border border-slate-700/50 text-slate-200 focus:border-emerald-500/50 focus:ring-emerald-500/15 hover:border-slate-600'
                    : 'bg-white border border-slate-200 text-slate-700 focus:border-emerald-500 focus:ring-emerald-500/15 hover:border-slate-300 shadow-sm'
                }`}
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-sm text-left">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={runCheck}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 text-white font-semibold transition shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30">
                {loading
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Running checks…</>
                  : <><ShieldCheck className="w-4 h-4" /> Run Readiness Check</>}
              </button>
              <button onClick={loadHistory} className="oc-nav-btn">
                <Clock className="w-3.5 h-3.5" /> History
              </button>
            </div>
          </div>

          {/* Check list preview */}
          <div className={`mt-8 pt-6 border-t ${darkMode ? 'border-slate-700/30' : 'border-slate-200/60'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Checks included</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-left">
              {[
                'ws_config exists', 'HTTPS enforcement', 'Endpoint template',
                'Auth / token config', 'Response definitions', 'Wildcard mapping',
                'TIMEOUT mapping', 'tran_req_map complete', 'Routing row exists',
                'Mandatory fields', 'Regex coverage', 'Timeout sanity',
              ].map(c => (
                <div key={c} className={`flex items-center gap-2 text-xs py-1.5 px-2.5 rounded-lg ${darkMode ? 'text-slate-400 bg-slate-800/30' : 'text-slate-500 bg-slate-50/80'}`}>
                  <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`} />
                  {c}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── History Modal ─────────────────────────────────────── */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/40">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" /> Check History
              </h3>
              <button onClick={() => setShowHistory(false)} className="oc-nav-icon-btn">
                <XCircle className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              {history.length === 0
                ? <p className="text-sm text-slate-500 text-center py-8">No history yet</p>
                : (
                  <div className="space-y-2">
                    {history.map(h => (
                      <div key={h.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/30 text-sm">
                        <div>
                          <p className="font-medium text-slate-200">{h.config_name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{new Date(h.checked_at).toLocaleString()}</p>
                        </div>
                        <span className={`font-bold text-sm ${h.score >= 90 ? 'text-emerald-400' : h.score >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                          {h.score}%
                        </span>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────── */}
      {result && (
        <div className="space-y-6 animate-fade-up">

          {/* Score + summary */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <ScoreGauge score={result.score} readiness={result.readiness} />

              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  {[
                    { label: 'Total Checks',  value: result.totalChecks,   color: 'text-slate-200' },
                    { label: 'Passed',        value: result.passedChecks,  color: 'text-emerald-400' },
                    { label: 'Failed',        value: result.failedChecks,  color: result.failedChecks > 0 ? 'text-red-400' : 'text-slate-500' },
                    { label: 'Critical',      value: result.criticalFailures.length, color: result.criticalFailures.length > 0 ? 'text-red-400' : 'text-slate-500' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/25">
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {result.criticalFailures.length > 0 && (
                  <div className="p-3 rounded-xl bg-red-500/8 border border-red-500/20">
                    <p className="text-xs font-semibold text-red-400 mb-2">Critical issues to fix before go-live:</p>
                    <ul className="space-y-1">
                      {result.criticalFailures.map(f => (
                        <li key={f.id} className="flex items-start gap-2 text-xs text-red-300">
                          <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          {f.title} — {f.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 mt-5 pt-4 border-t border-slate-700/30">
              <button onClick={runCheck} disabled={loading} className="oc-nav-btn">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Re-run
              </button>
              <button onClick={exportReport} className="oc-nav-btn">
                <Download className="w-3.5 h-3.5" /> Export Report
              </button>
              <button onClick={() => setResult(null)} className="oc-nav-btn ml-auto">
                ← New Check
              </button>
            </div>
          </div>

          {/* Checks by category */}
          <div className="space-y-4">
            {Object.entries(result.byCategory).map(([cat, checks]) => (
              <CategorySection key={cat} category={cat} checks={checks} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
