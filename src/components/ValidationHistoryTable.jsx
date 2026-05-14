import React, { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle, AlertCircle, Clock, Eye, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import ValidationDetailModal from './ValidationDetailModal';

const API_BASE = '/api';

const ValidationHistoryTable = ({ configId, refreshTrigger }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterSuccess, setFilterSuccess] = useState('all'); // 'all' | 'true' | 'false'
  const [filterEnv, setFilterEnv] = useState('all');
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSuccess !== 'all') params.set('success', filterSuccess);
      if (filterEnv !== 'all') params.set('environment', filterEnv);
      params.set('limit', '50');

      const url = configId
        ? `${API_BASE}/layer/validation-history/${configId}?${params}`
        : `${API_BASE}/layer/validation-history?${params}`;

      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) setHistory(data.history || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { fetchHistory(); }, [configId, filterSuccess, filterEnv, refreshTrigger]);

  const viewDetail = async (historyId) => {
    setDetailLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/layer/validation-history/detail/${historyId}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) setSelectedDetail(data.detail);
      }
    } catch { /* silent */ }
    setDetailLoading(false);
  };

  const filtered = history.filter(h => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (h.target_url || '').toLowerCase().includes(q) ||
      (h.mapped_code || '').toLowerCase().includes(q) ||
      (h.error_code || '').toLowerCase().includes(q) ||
      (h.environment || '').toLowerCase().includes(q) ||
      String(h.config_id).includes(q)
    );
  });

  if (history.length === 0 && !loading) return null;

  return (
    <>
      <div className="border border-slate-700/50 rounded-xl overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-800/50 hover:bg-slate-700/50 transition text-sm font-medium text-slate-300"
        >
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            Validation History
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              {history.length}
            </span>
          </span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expanded && (
          <div className="border-t border-slate-700/50 bg-slate-900/40">
            {/* Filters */}
            <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-700/30 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search URL, code, error..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-800/60 border border-slate-700/40 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>
              <select value={filterSuccess} onChange={e => setFilterSuccess(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-800/60 border border-slate-700/40 rounded-lg text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50">
                <option value="all">All Results</option>
                <option value="true">Success Only</option>
                <option value="false">Failures Only</option>
              </select>
              <select value={filterEnv} onChange={e => setFilterEnv(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-800/60 border border-slate-700/40 rounded-lg text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50">
                <option value="all">All Envs</option>
                <option value="mock">Mock</option>
                <option value="uat">UAT</option>
                <option value="production">Production</option>
              </select>
              <button onClick={fetchHistory} className="p-1.5 text-slate-400 hover:text-slate-200 transition" title="Refresh">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="bg-slate-800/80">
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Config</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Env</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Endpoint</th>
                    <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Mapped</th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Duration</th>
                    <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/20">
                  {filtered.map(row => (
                    <tr key={row.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2 text-slate-300 font-mono">#{row.config_id}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          row.environment === 'production' ? 'bg-red-500/15 text-red-400' :
                          row.environment === 'uat' ? 'bg-amber-500/15 text-amber-400' :
                          'bg-blue-500/15 text-blue-400'
                        }`}>{row.environment}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-400 font-mono truncate max-w-[200px]" title={row.target_url}>
                        {row.method} {row.target_url?.split('/').slice(-2).join('/')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.success ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400 inline-block" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400 inline-block" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.mapped_code ? (
                          <span className="text-blue-400 font-mono">{row.mapped_code}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={`font-mono ${
                          row.total_ms < 200 ? 'text-emerald-400' : row.total_ms < 1000 ? 'text-amber-400' : 'text-red-400'
                        }`}>{row.total_ms}ms</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => viewDetail(row.id)} className="p-1 text-slate-500 hover:text-blue-400 transition" title="View details">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-500 text-xs">
                        {search ? 'No results match your search' : 'No validation history yet'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedDetail && (
        <ValidationDetailModal detail={selectedDetail} onClose={() => setSelectedDetail(null)} />
      )}
    </>
  );
};

export default ValidationHistoryTable;
