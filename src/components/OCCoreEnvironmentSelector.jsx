import React, { useState, useEffect, useCallback } from 'react';
import {
  Server, Globe, Shield, Zap, RefreshCw, CheckCircle,
  XCircle, AlertTriangle, ChevronDown, ChevronRight, Copy,
  Terminal, Clock, Radio, Settings, Play, Plus, Trash2,
  Eye, EyeOff, Code, FileJson, Upload, ChevronUp
} from 'lucide-react';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ENV_COLORS = {
  MOCK:          { ring: 'border-slate-500/40',   bg: 'bg-slate-500/10',   text: 'text-slate-400',   dot: 'bg-slate-400'   },
  MPAY:          { ring: 'border-violet-500/40',  bg: 'bg-violet-500/10',  text: 'text-violet-400',  dot: 'bg-violet-400'  },
  OC_CORE_LOCAL: { ring: 'border-blue-500/40',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-400'    },
  OC_CORE_UAT:   { ring: 'border-amber-500/40',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400'   },
  OC_CORE_PROD:  { ring: 'border-red-500/40',     bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400'     },
};

// ─── MPAY Transaction Presets ─────────────────────────────────────
// Derived from MPAY COLLECTION FOR TESTING.postman_collection.json
// params = [trans_type, ...Object.values(body)]
const MPAY_PRESETS = [
  {
    label: '1link Title Fetch',
    tranType: 'title-fetch',
    method: 'GET',
    path: '/mpg/queueforwarding/',
    params: [
      'title-fetch',
      '000000002000', '0220104400', '218998', '104400', '0220',
      '639357', '182486216659', 'Test Store', 'Karachi', 'Sindh',
      '74200', 'Bank Islamic', 'Remit Channel', 'Any Channel',
      'Bank Islamic', 'PK', 'PK66MEZN00015401065442903', '627873', '0000000000000',
    ],
  },
  {
    label: '1link IBFT Payment',
    tranType: 'ibft-payment',
    method: 'GET',
    path: '/mpg/queueforwarding/',
    params: [
      'ibft-payment',
      '000000013500', '1224133520', '619162', '133520', '1224',
      '639357', '100319615162', '233964', 'Test Store', 'Karachi',
      'Sindh', '74200', 'Fahim', 'Karachi', 'Any Channel',
      '1link Model Bank', 'PK', '0401', '102700659510201',
      '12345678911112', '221166', '5311990001869341', '1link Model Bank',
      '46501-0710145-2', '', '', 'Leroy Green', '12345678911112', 'ZAHID HUSSAIN',
    ],
  },
  {
    label: '1link IBFT Inquiry',
    tranType: 'ibft-inquiry',
    method: 'GET',
    path: '/mpg/queueforwarding/',
    params: [
      'ibft-inquiry',
      '000000000200', '1121110000', '509139', '134400', '1121',
      '', '998876', '100313509139', '895578', 'Test Store', 'Karachi',
      'Sindh', '74200', 'Umair Sheikh', 'ADC Literal', 'Any Channel',
      '1link Model Bank', 'PK', 'PK74ABPA0002000001100111',
      'PK23MBPK0000020910000975', '221166', '4250108749566', '35202-5171747-4',
    ],
  },
  {
    label: 'Raast Outgoing Payment',
    tranType: 'ibft-payment',
    method: 'GET',
    path: '/mpg/queueforwarding/',
    params: [
      'ibft-payment',
      '0000000010000', '1103134400', '572159', '134400', '1103',
      '998876', '100313572059', '124917', 'Test Store', 'Karachi',
      'Sindh', '74200', 'Umair Sheikh', 'Karachi', 'Any Channel',
      '1link Model Bank', 'PK', '0251', 'PK74HUG00009995538151459',
      'PK23MBPK0000020910000975', '221166', '4250108749566',
      '1link Model Bank', '', '', '', 'Leroy Green',
      'PK74HUG00009995538151459', 'ZAHID HUSSAIN',
    ],
  },
];

// ─── Postman-format importer helper ───────────────────────────────
// Converts { meta_data: { trans_type }, body: {...} } → params array
function postmanToParams(raw) {
  let parsed;
  try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  const metaData = parsed?.meta_data;
  const body     = parsed?.body;
  if (!metaData?.trans_type || !body || typeof body !== 'object') return null;
  return [metaData.trans_type, ...Object.values(body).map(v => v == null ? '' : String(v))];
}

// ─── Response code colours ──────────────────────────────────────────────────
const RSP_COLORS = {
  '00':   'text-emerald-400',
  '501':  'text-amber-400',
  '503':  'text-red-400',
  '400':  'text-orange-400',
};

function HealthBadge({ health }) {
  if (!health) return null;
  if (health.checking) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-400 text-xs font-semibold">
        <RefreshCw className="w-3 h-3 animate-spin" /> Checkingâ€¦
      </span>
    );
  }
  if (health.reachable) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
        <CheckCircle className="w-3 h-3" /> {health.elapsed_ms}ms
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold">
      <XCircle className="w-3 h-3" /> Unreachable
    </span>
  );
}

// ─── CAS Transport Invoke Panel ────────────────────────────────────────────

function CASTransportPanel({ currentEnv, environments, showToast }) {
  const activeEnv = environments.find(e => e.id === currentEnv);

  const [method,       setMethod]       = useState('GET');
  const [endpointPath, setEndpointPath] = useState('');
  const [useFullUrl,   setUseFullUrl]   = useState(false);
  const [customUrl,    setCustomUrl]    = useState('');
  const [params,       setParams]       = useState(['BALANCE_INQUIRY', '', '', '', '', '', '']);
  const [running,      setRunning]      = useState(false);
  const [result,       setResult]       = useState(null);
  const [preview,      setPreview]      = useState(null);
  const [showPreview,  setShowPreview]  = useState(false);
  const [showRaw,      setShowRaw]      = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [importText,   setImportText]   = useState('');
  const [importError,  setImportError]  = useState('');

  // Auto-configure endpoint when switching to MPAY
  useEffect(() => {
    if (currentEnv === 'MPAY') {
      setMethod('GET');
      setEndpointPath('/mpg/queueforwarding/');
    }
  }, [currentEnv]);

  const fullEndpoint = useFullUrl
    ? customUrl
    : (activeEnv ? `${activeEnv.baseUrl}${endpointPath}` : endpointPath);

  const updateParam = (idx, val) => {
    setParams(prev => { const next = [...prev]; next[idx] = val; return next; });
  };
  const addParam    = () => setParams(prev => [...prev, '']);
  const removeParam = (idx) => setParams(prev => prev.filter((_, i) => i !== idx));

  const loadPreset = (preset) => {
    setMethod(preset.method);
    setEndpointPath(preset.path);
    setParams([...preset.params]);
    setResult(null); setPreview(null);
    showToast?.(`Loaded: ${preset.label}`, 'info');
  };

  const importFromPostman = () => {
    setImportError('');
    const converted = postmanToParams(importText);
    if (!converted) {
      setImportError('Could not parse. Paste the full request body: { "meta_data": { "trans_type": "..." }, "body": { ... } }');
      return;
    }
    setParams(converted);
    setShowImporter(false);
    setImportText('');
    showToast?.(`Imported ${converted.length} params — trans_type: ${converted[0]}`, 'success');
  };

  const loadPreview = async () => {
    if (!fullEndpoint.trim()) { showToast?.('Enter an endpoint first', 'warning'); return; }
    try {
      const res  = await fetch('/api/oc-core/invoke/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: fullEndpoint, method, params }),
      });
      const data = await res.json();
      if (data.success) { setPreview(data); setShowPreview(true); }
    } catch { showToast?.('Preview failed', 'error'); }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => showToast?.('Copied to clipboard', 'success'),
      () => showToast?.('Copy failed', 'error'),
    );
  };

  const invoke = async () => {
    if (!fullEndpoint.trim()) { showToast?.('Enter an endpoint', 'warning'); return; }
    setRunning(true);
    setResult(null);
    try {
      const res  = await fetch('/api/oc-core/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: fullEndpoint,
          method,
          params,
          rrn: params[1] || '',
          tranType: params[0] || '',
        }),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        showToast?.(`OC Core responded: ${data.rspCode} — ${data.rspDesc}`, 'success');
      } else {
        showToast?.(`OC Core: ${data.rspCode} — ${data.rspDesc || data.error}`, 'error');
      }
    } catch (e) {
      setResult({ success: false, error: e.message });
      showToast?.('Network error invoking OC Core', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-slate-700/30">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">CAS Transport Invoke</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/12 border border-amber-500/25 text-amber-400 font-bold">SHA-256 Signed</span>
      </div>
      <p className="text-[11px] text-slate-500">
        Calls OC Core using the CAS positional-params protocol — URL-encoded params with SHA-256 signature, matching
        <code className="mx-1 px-1 rounded bg-slate-800/60 text-slate-400 text-[10px]">OpenConnectUtils.java</code>
        wire format.
      </p>

      {/* MPAY Presets */}
      {(currentEnv === 'MPAY' || currentEnv === 'OC_CORE_LOCAL') && (
        <div className="p-3 rounded-xl bg-violet-500/8 border border-violet-500/20 space-y-2">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-violet-400" />
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">Quick Presets — MPAY Transactions</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MPAY_PRESETS.map((preset) => (
              <button
                key={preset.tranType + preset.label}
                onClick={() => loadPreset(preset)}
                className="px-2.5 py-1 rounded-lg bg-violet-600/15 border border-violet-500/25 text-violet-300 text-[10px] font-semibold hover:bg-violet-600/25 hover:border-violet-500/40 transition">
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Postman-format importer toggle */}
      <div>
        <button
          onClick={() => setShowImporter(s => !s)}
          className="flex items-center gap-2 text-[10px] font-semibold text-slate-400 hover:text-violet-400 transition">
          <FileJson className="w-3.5 h-3.5" />
          Import from Postman JSON
          {showImporter ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showImporter && (
          <div className="mt-2 p-3 rounded-xl bg-slate-900/60 border border-slate-700/40 space-y-2 animate-fade-up">
            <p className="text-[10px] text-slate-500">
              Paste the Postman request body — it will be auto-converted to the positional params array
              (<code className="text-slate-400">params = [trans_type, ...Object.values(body)]</code>)
            </p>
            <textarea
              rows={7}
              value={importText}
              onChange={e => { setImportText(e.target.value); setImportError(''); }}
              placeholder={`{\n  "meta_data": { "trans_type": "title-fetch" },\n  "body": {\n    "AmountTransaction": "000000002000",\n    "DateTimeLocalTrans": "0220104400"\n  }\n}`}
              className="w-full bg-slate-950/60 border border-slate-700/40 rounded-lg px-3 py-2 text-[10px] font-mono text-slate-300 focus:border-violet-500/50 focus:outline-none resize-none"
            />
            {importError && (
              <p className="text-[10px] text-red-400 flex items-start gap-1">
                <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />{importError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={importFromPostman}
                disabled={!importText.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 text-[10px] font-bold hover:bg-violet-600/30 disabled:opacity-40 transition">
                <Upload className="w-3 h-3" /> Extract Params
              </button>
              <button
                onClick={() => { setShowImporter(false); setImportText(''); setImportError(''); }}
                className="text-[10px] text-slate-500 hover:text-slate-400 transition">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Endpoint URL */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Endpoint</label>
          <button
            onClick={() => setUseFullUrl(s => !s)}
            className={`text-[10px] font-semibold transition ${useFullUrl ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-400'}`}>
            {useFullUrl ? '⚡ Full URL mode' : 'Switch to full URL'}
          </button>
        </div>

        {useFullUrl ? (
          <input
            type="text"
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            placeholder="http://10.0.142.4:7033/mpg/queueforwarding/"
            className="w-full bg-slate-900/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:border-cyan-500/50 focus:outline-none"
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="col-span-1">
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-blue-500/50 focus:outline-none">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>
            <div className="col-span-1 sm:col-span-4">
              <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2">
                <span className="text-[10px] text-slate-600 font-mono whitespace-nowrap flex-shrink-0 select-none">
                  {activeEnv?.baseUrl || '...'}
                </span>
                <input
                  type="text"
                  value={endpointPath}
                  onChange={e => setEndpointPath(e.target.value)}
                  placeholder="/mpg/queueforwarding/"
                  className="flex-1 bg-transparent text-xs text-slate-300 font-mono focus:outline-none min-w-0"
                />
              </div>
            </div>
          </div>
        )}

        <p className="text-[10px] text-slate-600 font-mono">
          Full URL: <span className="text-slate-500">{fullEndpoint || '—'}</span>
        </p>
      </div>

      {/* Params Array */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Params Array — positional (params[0] = tran_type)
          </label>
          <button onClick={addParam} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {params.map((p, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-600 w-8 text-right flex-shrink-0">[{idx}]</span>
              <input
                type="text"
                value={p}
                onChange={e => updateParam(idx, e.target.value)}
                placeholder={idx === 0 ? 'tran_type  e.g. title-fetch' : idx === 1 ? 'AmountTransaction' : `param[${idx}]`}
                className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono focus:border-blue-500/50 focus:outline-none"
              />
              {params.length > 1 && (
                <button onClick={() => removeParam(idx)} className="oc-nav-icon-btn w-6 h-6 flex-shrink-0">
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={invoke}
          disabled={running}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-40 text-white text-sm font-semibold transition shadow-lg shadow-amber-500/15">
          {running
            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Invoking…</>
            : <><Play className="w-3.5 h-3.5" /> Invoke OC Core</>}
        </button>
        <button onClick={loadPreview} className="oc-nav-btn">
          <Eye className="w-3.5 h-3.5" /> Preview Signed URL
        </button>
      </div>

      {/* Signed URL Preview */}
      {showPreview && preview && (
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-700/30 space-y-3 animate-fade-up">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Signed Request Preview</span>
            <button onClick={() => setShowPreview(false)} className="text-slate-600 hover:text-slate-400 text-xs">✕</button>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Signed URL</p>
            <div className="flex items-center gap-2">
              <code className="text-[10px] font-mono text-emerald-400 break-all flex-1">{preview.signedUrl}</code>
              <button onClick={() => copyToClipboard(preview.signedUrl)} className="oc-nav-icon-btn w-6 h-6 flex-shrink-0">
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
          {preview.postBody && (
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Request Body</p>
              <code className="text-[10px] font-mono text-blue-400 break-all">{preview.postBody}</code>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-slate-500">cURL Command</p>
              <button onClick={() => copyToClipboard(preview.curl)} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300">
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <pre className="text-[10px] font-mono text-slate-300 bg-slate-900/80 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{preview.curl}</pre>
          </div>
          <p className="text-[10px] text-slate-600 italic">{preview.note}</p>
        </div>
      )}

      {/* Invoke Result */}
      {result && (
        <div className={`p-4 rounded-xl border space-y-3 animate-fade-up ${
          result.success
            ? 'bg-emerald-500/8 border-emerald-500/20'
            : 'bg-red-500/8 border-red-500/20'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {result.success
                ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                : <XCircle className="w-4 h-4 text-red-400" />}
              <span className={`text-sm font-bold ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.rspCode || (result.success ? '00' : 'ERR')}
              </span>
              <span className="text-sm text-slate-300">{result.rspDesc || result.error}</span>
              {result.elapsed_ms !== undefined && (
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />{result.elapsed_ms}ms
                </span>
              )}
            </div>
            <button onClick={() => setShowRaw(s => !s)} className="oc-nav-btn">
              <Code className="w-3.5 h-3.5" /> {showRaw ? 'Hide' : 'Raw'}
            </button>
          </div>

          {result.data && !showRaw && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(result.data).map(([k, v]) => (
                <div key={k} className="bg-slate-800/40 rounded-lg p-2">
                  <p className="text-[10px] text-slate-500 mb-0.5">{k}</p>
                  <p className="text-xs font-mono text-slate-300 truncate">{JSON.stringify(v)}</p>
                </div>
              ))}
            </div>
          )}

          {(result.sbpRejectCode || result.sbpRejectReason) && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-orange-300">
                SBP Reject: <span className="font-bold">{result.sbpRejectCode}</span> — {result.sbpRejectReason}
              </div>
            </div>
          )}

          {showRaw && (
            <pre className="bg-slate-950/60 rounded-lg p-3 text-[10px] font-mono text-slate-400 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
              {JSON.stringify(result.raw || result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function OCCoreEnvironmentSelector({ darkMode, currentEnv, onEnvChange, onCurlGenerated, showToast }) {
  const [environments, setEnvironments]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [healthMap, setHealthMap]         = useState({});
  const [expanded, setExpanded]           = useState(false);
  const [showOverride, setShowOverride]   = useState(false);
  const [overrideUrl, setOverrideUrl]     = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState('validate');
  const [activeTab, setActiveTab]         = useState('env'); // 'env' | 'invoke'

  // OC Core routing fields
  const [ocFields, setOcFields] = useState({
    tranType: 'BALANCE_INQUIRY',
    queueIn: 'WS_QUEUE',
    queueType: 'REST',
    hostId: '1',
    fromIp: '127.0.0.1',
  });

  const fetchEnvs = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/oc-core/environments');
      const data = await res.json();
      if (data.success) setEnvironments(data.environments);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEnvs(); }, [fetchEnvs]);

  const runHealthCheck = async (envId) => {
    setHealthMap(prev => ({ ...prev, [envId]: { checking: true } }));
    try {
      const res  = await fetch(`/api/oc-core/health/${envId}`);
      const data = await res.json();
      setHealthMap(prev => ({ ...prev, [envId]: data }));
    } catch (e) {
      setHealthMap(prev => ({ ...prev, [envId]: { reachable: false, error: e.message } }));
    }
  };

  const runAllHealthChecks = () => {
    environments.forEach(env => runHealthCheck(env.id));
  };

  const handleOverrideSave = async () => {
    if (!overrideUrl.trim()) return;
    try {
      const res = await fetch(`/api/oc-core/environment/${currentEnv}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: overrideUrl.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast?.(`Base URL updated for ${currentEnv}`, 'success');
        setShowOverride(false);
        fetchEnvs();
      }
    } catch { showToast?.('Failed to update URL', 'error'); }
  };

  const generateCurl = async () => {
    try {
      const res  = await fetch('/api/oc-core/generate-curl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          envId: currentEnv,
          endpointType: selectedEndpoint,
          ...ocFields,
        }),
      });
      const data = await res.json();
      if (data.success && data.curl) {
        onCurlGenerated?.(data.curl);
        navigator.clipboard.writeText(data.curl).then(
          () => showToast?.('cURL copied to clipboard', 'success'),
          () => showToast?.('cURL generated (clipboard unavailable)', 'info'),
        );
      }
    } catch { showToast?.('Failed to generate cURL', 'error'); }
  };

  const activeEnv = environments.find(e => e.id === currentEnv) || environments[0];
  const colors    = ENV_COLORS[currentEnv] || ENV_COLORS.MOCK;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* â”€â”€ Header â”€â”€ */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/20 transition">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl ${colors.bg} border ${colors.ring} flex items-center justify-center`}>
            <Server className={`w-4.5 h-4.5 ${colors.text}`} />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Target Environment</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${colors.bg} ${colors.ring} ${colors.text}`}>
                {activeEnv?.label || currentEnv}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{activeEnv?.description || 'Select an environment'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HealthBadge health={healthMap[currentEnv]} />
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* â”€â”€ Expanded Panel â”€â”€ */}
      {expanded && (
        <div className="border-t border-slate-700/30">

          {/* Tabs */}
          <div className="flex items-center gap-1 px-5 pt-4">
            {[
              { id: 'env',    label: 'Environments', icon: Globe },
              { id: 'invoke', label: 'CAS Invoke',   icon: Zap   },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-slate-700/60 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}>
                  <Icon className="w-3.5 h-3.5" /> {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-5 space-y-5">
            {/* â”€â”€ Environments Tab â”€â”€ */}
            {activeTab === 'env' && (
              <>
                {/* Environment Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {loading && <div className="col-span-4 text-center py-6 text-slate-500 text-sm"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Loading environmentsâ€¦</div>}
                  {environments.map(env => {
                    const ec       = ENV_COLORS[env.id] || ENV_COLORS.MOCK;
                    const isActive = currentEnv === env.id;
                    const health   = healthMap[env.id];
                    return (
                      <button
                        key={env.id}
                        onClick={() => onEnvChange(env.id)}
                        className={`relative text-left p-4 rounded-xl border transition-all ${
                          isActive
                            ? `${ec.bg} ${ec.ring} shadow-lg ring-1 ring-white/5`
                            : 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/50 hover:border-slate-600/40'
                        }`}>
                        {isActive && (
                          <div className="absolute top-2 right-2">
                            <span className={`w-2 h-2 rounded-full ${ec.dot} inline-block pulse-dot`} />
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-7 h-7 rounded-lg ${ec.bg} border ${ec.ring} flex items-center justify-center`}>
                            {env.ocCoreMode
                              ? <Shield className={`w-3.5 h-3.5 ${ec.text}`} />
                              : <Globe className={`w-3.5 h-3.5 ${ec.text}`} />}
                          </div>
                          <span className={`text-xs font-bold ${isActive ? ec.text : 'text-slate-300'}`}>{env.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed mb-2">{env.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-600 truncate max-w-[140px]">{env.baseUrl}</span>
                          <HealthBadge health={health} />
                        </div>
                        {env.readOnly && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-red-400/80">
                            <AlertTriangle className="w-3 h-3" /> Read-only
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Health checks */}
                <div className="flex items-center gap-3">
                  <button onClick={runAllHealthChecks} className="oc-nav-btn">
                    <Radio className="w-3.5 h-3.5" /> Check All
                  </button>
                  <button onClick={() => runHealthCheck(currentEnv)} className="oc-nav-btn">
                    <RefreshCw className="w-3.5 h-3.5" /> Check Active
                  </button>
                  <button onClick={() => setShowOverride(s => !s)} className="oc-nav-btn ml-auto">
                    <Settings className="w-3.5 h-3.5" /> Override URL
                  </button>
                </div>

                {/* URL Override */}
                {showOverride && (
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/30 space-y-3">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Override Base URL for {activeEnv?.label}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={overrideUrl}
                        onChange={e => setOverrideUrl(e.target.value)}
                        placeholder={activeEnv?.baseUrl || 'https://...'}
                        className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-lg px-4 py-2 text-sm text-slate-200 font-mono focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                      />
                      <button onClick={handleOverrideSave} className="oc-nav-btn">
                        <CheckCircle className="w-3.5 h-3.5" /> Apply
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-600">Runtime override only â€” does not persist across restarts.</p>
                  </div>
                )}

                {/* OC Core Fields */}
                {activeEnv?.ocCoreMode && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">OC Core Routing Parameters</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {[
                        { key: 'tranType',  label: 'tran_type',  placeholder: 'BALANCE_INQUIRY' },
                        { key: 'queueIn',   label: 'queue_in',   placeholder: 'WS_QUEUE' },
                        { key: 'queueType', label: 'queue_type', placeholder: 'REST' },
                        { key: 'hostId',    label: 'host_id',    placeholder: '1' },
                        { key: 'fromIp',    label: 'from_ip',    placeholder: '127.0.0.1' },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{f.label}</label>
                          <input
                            type="text"
                            value={ocFields[f.key]}
                            onChange={e => setOcFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                            className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:border-blue-500/50 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* cURL Generator */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Endpoint</label>
                    <select
                      value={selectedEndpoint}
                      onChange={e => setSelectedEndpoint(e.target.value)}
                      className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-blue-500/50 focus:outline-none">
                      <option value="validate">WS Validate</option>
                      <option value="buildReq">REST Build Request</option>
                      <option value="submit">Transaction Submit</option>
                      <option value="healthCheck">Health Check</option>
                      {activeEnv?.ocCoreMode && <option value="tokenRefresh">Token Refresh</option>}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <button onClick={generateCurl} className="oc-nav-btn">
                      <Terminal className="w-3.5 h-3.5" /> Generate cURL
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* â”€â”€ CAS Invoke Tab â”€â”€ */}
            {activeTab === 'invoke' && (
              <CASTransportPanel
                currentEnv={currentEnv}
                environments={environments}
                showToast={showToast}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
