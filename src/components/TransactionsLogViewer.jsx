import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Search, Filter, RefreshCw, Eye, X, CheckCircle,
  AlertCircle, Clock, ArrowRightLeft, ChevronDown, ChevronRight,
  Download, Shield, AlertTriangle, Hash, BarChart2
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  SUCCESS:  { color: 'text-emerald-400', bg: 'bg-emerald-500/12 border-emerald-500/25', dot: 'bg-emerald-400', icon: CheckCircle },
  FAILED:   { color: 'text-red-400',     bg: 'bg-red-500/12 border-red-500/25',         dot: 'bg-red-400',     icon: AlertCircle },
  TIMEOUT:  { color: 'text-amber-400',   bg: 'bg-amber-500/12 border-amber-500/25',     dot: 'bg-amber-400',   icon: Clock },
  REVERSED: { color: 'text-violet-400',  bg: 'bg-violet-500/12 border-violet-500/25',   dot: 'bg-violet-400',  icon: ArrowRightLeft },
  PENDING:  { color: 'text-slate-400',   bg: 'bg-slate-500/12 border-slate-500/25',     dot: 'bg-slate-400',   icon: Clock },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  );
}

function DurationBadge({ ms }) {
  if (!ms && ms !== 0) return <span className="text-slate-500 text-xs">—</span>;
  const color = ms > 10000 ? 'text-red-400' : ms > 2000 ? 'text-amber-400' : 'text-emerald-400';
  const label = ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  return <span className={`text-xs font-mono font-medium ${color}`}>{label}</span>;
}

function JsonPreview({ data, label }) {
  const [expanded, setExpanded] = useState(false);
  if (!data) return <span className="text-slate-600 text-xs italic">—</span>;
  const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const preview = str.substring(0, 120).replace(/\n/g, ' ');
  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition mb-1">
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span className="font-semibold">{label}</span>
      </button>
      {!expanded && <p className="text-xs font-mono text-slate-500 truncate">{preview}…</p>}
      {expanded && (
        <pre className="bg-slate-950/60 rounded-lg p-3 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto mt-1">
          {str}
        </pre>
      )}
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }) {
  if (!stats) return null;
  const { total, success, failed, timeout, reversed, successRate, avgDurationMs } = stats;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
      {[
        { label: 'Total',       value: total,        color: 'text-slate-200' },
        { label: 'Success',     value: success,      color: 'text-emerald-400' },
        { label: 'Failed',      value: failed,       color: 'text-red-400' },
        { label: 'Timeout',     value: timeout,      color: 'text-amber-400' },
        { label: 'Reversed',    value: reversed,     color: 'text-violet-400' },
        { label: 'Success Rate',value: `${successRate}%`, color: successRate >= 95 ? 'text-emerald-400' : successRate >= 80 ? 'text-amber-400' : 'text-red-400' },
      ].map(s => (
        <div key={s.label} className="glass-card rounded-xl p-3 text-center">
          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ correlationId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/transactions/${encodeURIComponent(correlationId)}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [correlationId]);

  const handleExport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `txn-${correlationId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/40">
          <div>
            <h3 className="text-base font-bold text-white">Transaction Detail</h3>
            <p className="text-xs font-mono text-slate-400 mt-0.5">{correlationId}</p>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <button onClick={handleExport} className="oc-nav-btn text-xs">
                <Download className="w-3.5 h-3.5" /> Export JSON
              </button>
            )}
            <button onClick={onClose} className="oc-nav-icon-btn">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          {data && (
            <div className="space-y-5">
              {/* Summary Row */}
              <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-slate-800/40 border border-slate-700/30">
                <StatusBadge status={data.log.status} />
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/12 border border-blue-500/25 text-blue-400 text-xs font-semibold">{data.log.tran_type}</span>
                {data.log.amount && data.log.amount !== '0.00' && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">{data.log.amount}</span>
                )}
                <DurationBadge ms={data.log.duration_ms} />
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Identifier',            value: data.log.identifier },
                  { label: 'Client Response Code',  value: data.log.client_response_code },
                  { label: 'External Response Code',value: data.log.external_response_code },
                  { label: 'Queue In',              value: data.log.queue_in },
                  { label: 'From IP',               value: data.log.from_ip },
                  { label: 'Created At',            value: data.log.created_at },
                ].map(row => (
                  <div key={row.label} className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/25">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{row.label}</p>
                    <p className="text-sm font-mono text-slate-300 truncate">{row.value || '—'}</p>
                  </div>
                ))}
              </div>

              {/* Error reason */}
              {data.log.error_reason && (
                <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-500/8 border border-red-500/20">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-400 mb-1">Error Reason</p>
                    <p className="text-sm text-red-300">{data.log.error_reason}</p>
                  </div>
                </div>
              )}

              {/* Req/Resp payloads */}
              {data.reqResp && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <JsonPreview data={data.reqResp.client_request}   label="Client Request" />
                    <JsonPreview data={data.reqResp.external_request}  label="External Request" />
                    {data.reqResp.reversal_request && (
                      <JsonPreview data={data.reqResp.reversal_request} label="Reversal Request" />
                    )}
                  </div>
                  <div className="space-y-4">
                    <JsonPreview data={data.reqResp.client_response}   label="Client Response" />
                    <JsonPreview data={data.reqResp.external_response}  label="External Response" />
                    {data.reqResp.reversal_response && (
                      <JsonPreview data={data.reqResp.reversal_response} label="Reversal Response" />
                    )}
                  </div>
                </div>
              )}

              {/* Security notice */}
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-slate-800/40 border border-slate-700/25">
                <Shield className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500">Sensitive values (tokens, secrets, auth headers) are masked in storage and display.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function TransactionsLogViewer({ darkMode }) {
  const [rows, setRows]               = useState([]);
  const [total, setTotal]             = useState(0);
  const [stats, setStats]             = useState(null);
  const [tranTypes, setTranTypes]     = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [selectedCorr, setSelectedCorr] = useState(null);

  // Filters
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage]             = useState(0);
  const PAGE_SIZE = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        ...(statusFilter && { status: statusFilter }),
        ...(typeFilter   && { tranType: typeFilter }),
        ...(search       && { correlationId: search }),
      });

      const [logsRes, statsRes, typesRes] = await Promise.all([
        fetch(`/api/transactions?${params}`).then(r => r.json()),
        fetch('/api/transactions/stats').then(r => r.json()),
        fetch('/api/transactions/tran-types').then(r => r.json()),
      ]);

      if (logsRes.success) { setRows(logsRes.rows || []); setTotal(logsRes.total || 0); }
      if (statsRes.success) setStats(statsRes.stats);
      if (typesRes.success) setTranTypes(typesRes.types || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = (e) => { setSearch(e.target.value); setPage(0); };

  const exportCsv = () => {
    const header = ['Correlation ID', 'Tran Type', 'Status', 'Amount', 'Client Code', 'Ext Code', 'Duration', 'Created At'];
    const csvRows = rows.map(r => [
      r.correlation_id, r.tran_type, r.status, r.amount,
      r.client_response_code, r.external_response_code,
      r.duration_ms, r.created_at
    ].map(v => `"${v ?? ''}"`).join(','));
    const csv  = [header.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8 flex flex-col">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="mb-7">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/25 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/10">
            <Activity className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>Transactions Log</h1>
            <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Live operational view of OpenConnect transaction history with full request/response inspection.</p>
          </div>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────── */}
      <StatsBar stats={stats} />

      {/* ── Filters ───────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={handleSearch}
              placeholder="Search correlation ID…"
              className={`w-full pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-all ${
                darkMode
                  ? 'bg-slate-800/60 border border-slate-700/50 text-slate-200 focus:border-blue-500/50 hover:border-slate-600'
                  : 'bg-white border border-slate-200 text-slate-700 focus:border-blue-500 hover:border-slate-300 shadow-sm'
              }`}
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => { setStatus(e.target.value); setPage(0); }}
            className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-all ${
              darkMode
                ? 'bg-slate-800/60 border border-slate-700/50 text-slate-300 focus:border-blue-500/50 hover:border-slate-600'
                : 'bg-white border border-slate-200 text-slate-600 focus:border-blue-500 hover:border-slate-300 shadow-sm'
            }`}>
            <option value="">All Statuses</option>
            {['SUCCESS', 'FAILED', 'TIMEOUT', 'REVERSED', 'PENDING'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Tran Type filter */}
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
            className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-all ${
              darkMode
                ? 'bg-slate-800/60 border border-slate-700/50 text-slate-300 focus:border-blue-500/50 hover:border-slate-600'
                : 'bg-white border border-slate-200 text-slate-600 focus:border-blue-500 hover:border-slate-300 shadow-sm'
            }`}>
            <option value="">All Types</option>
            {tranTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={exportCsv} className="oc-nav-btn">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button onClick={fetchData} disabled={loading} className="oc-nav-btn">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div className="mb-5 flex items-center gap-2.5 p-4 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className={`px-6 py-4 border-b flex items-center justify-between ${darkMode ? 'border-slate-700/25' : 'border-slate-200/60'}`}>
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-slate-500" />
            <span className={`text-sm font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              {total} transaction{total !== 1 ? 's' : ''}
            </span>
            {(statusFilter || typeFilter || search) && (
              <span className="text-xs text-slate-500">(filtered)</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            Page {page + 1} of {Math.max(1, totalPages)}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={`border-b ${darkMode ? 'border-slate-700/25' : 'border-slate-200/60'}`}>
              <tr className={`text-[11px] font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <th className="px-4 py-3 text-left">Correlation ID</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Client Code</th>
                <th className="px-4 py-3 text-center">Ext Code</th>
                <th className="px-4 py-3 text-right">Duration</th>
                <th className="px-4 py-3 text-left">Timestamp</th>
                <th className="px-4 py-3 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-slate-700/15' : 'divide-slate-100'}`}>
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500 text-sm">
                    No transactions found{(statusFilter || typeFilter || search) ? ' for the selected filters' : ''}
                  </td>
                </tr>
              )}
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-800/25 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-300">{row.correlation_id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                      {row.tran_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-mono text-slate-300">{row.amount !== '0.00' ? row.amount : '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-mono font-bold ${row.client_response_code === '00' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {row.client_response_code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-mono ${row.external_response_code === '000' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {row.external_response_code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DurationBadge ms={row.duration_ms} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSelectedCorr(row.correlation_id)}
                      className="oc-nav-icon-btn w-7 h-7">
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={`px-6 py-4 border-t flex items-center justify-between ${darkMode ? 'border-slate-700/25' : 'border-slate-200/60'}`}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="oc-nav-btn disabled:opacity-40 disabled:cursor-not-allowed">
              ← Previous
            </button>
            <span className="text-xs text-slate-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="oc-nav-btn disabled:opacity-40 disabled:cursor-not-allowed">
              Next →
            </button>
          </div>
        )}
      </div>

      {/* ── Detail Modal ──────────────────────────────────────── */}
      {selectedCorr && (
        <DetailModal correlationId={selectedCorr} onClose={() => setSelectedCorr(null)} />
      )}
    </div>
  );
}
