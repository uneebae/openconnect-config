import React, { useState, useCallback } from 'react';
import {
  Terminal, Zap, AlertCircle, CheckCircle, Copy, ArrowRight,
  Shield, Globe, Code, ChevronDown, ChevronRight, RefreshCw, X, Info
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_COLORS = {
  POST:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  GET:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  PUT:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
  PATCH:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const AUTH_ICONS = {
  BEARER:   { label: 'Bearer Token', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  BASIC:    { label: 'Basic Auth',   color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20' },
  API_KEY:  { label: 'API Key',      color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  TOKEN:    { label: 'Token Auth',   color: 'text-cyan-400',  bg: 'bg-cyan-500/10 border-cyan-500/20' },
  CUSTOM:   { label: 'Custom Auth',  color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
  NONE:     { label: 'No Auth',      color: 'text-slate-500', bg: 'bg-slate-800/60 border-slate-700/40' },
};

const CURL_PLACEHOLDER = `curl -X POST https://bankapi.example.com/v1/balance \\
  -H "Authorization: Bearer eyJhbGciOiJSUzI1..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "accountNumber": "123456789",
    "bankCode": "01",
    "channelId": "MOBILE"
  }'`;

function ScoreRing({ score }) {
  const color = score >= 80 ? '#10b981' : score >= 55 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'High' : score >= 55 ? 'Medium' : 'Low';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
          <circle cx="28" cy="28" r="22" fill="none" stroke={color}
            strokeWidth="5"
            strokeDasharray={`${2 * Math.PI * 22}`}
            strokeDashoffset={`${2 * Math.PI * 22 * (1 - score / 100)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>{score}%</span>
        </div>
      </div>
      <span className="text-[10px] font-semibold" style={{ color }}>{label} Confidence</span>
    </div>
  );
}

function HeaderRow({ k, v }) {
  const isSensitive = /authorization|api[-_]?key|secret|token/i.test(k);
  return (
    <div className="flex items-start gap-2 text-xs py-1 border-b border-slate-700/20 last:border-0">
      <span className="text-slate-400 font-mono min-w-[160px] flex-shrink-0">{k}</span>
      <span className={`font-mono truncate ${isSensitive ? 'text-amber-400/80' : 'text-slate-300'}`}>{v}</span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PasteCurlImport({ onConfigGenerated, darkMode }) {
  const [curlInput, setCurlInput]       = useState('');
  const [parsing, setParsing]           = useState(false);
  const [result, setResult]             = useState(null);  // null | { success, parsed, config, confidence, ... }
  const [error, setError]               = useState(null);
  const [showHeaders, setShowHeaders]   = useState(false);
  const [showBody, setShowBody]         = useState(false);
  const [showFields, setShowFields]     = useState(true);
  const [editedName, setEditedName]     = useState('');
  const [copied, setCopied]             = useState(false);

  const handleParse = useCallback(async () => {
    if (!curlInput.trim()) {
      setError('Please paste a curl command first.');
      return;
    }
    setParsing(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/import/curl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curl: curlInput }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to parse curl command');
      } else {
        setResult(data);
        setEditedName(data.parsed.autoServiceName || '');
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setParsing(false);
    }
  }, [curlInput]);

  const handleApply = useCallback(() => {
    if (!result) return;
    const finalConfig = {
      ...result.config,
      wsConfig: {
        ...result.config.wsConfig,
        serviceName: editedName.trim() || result.config.wsConfig.serviceName,
      },
    };
    onConfigGenerated(finalConfig, result);
  }, [result, editedName, onConfigGenerated]);

  const handleCopy = () => {
    navigator.clipboard.writeText(curlInput).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleClear = () => {
    setCurlInput('');
    setResult(null);
    setError(null);
  };

  const auth = result?.parsed?.auth;
  const authInfo = auth ? (AUTH_ICONS[auth.type] || AUTH_ICONS.NONE) : null;
  const methodColor = result ? (METHOD_COLORS[result.parsed.method] || 'bg-slate-500/15 text-slate-400 border-slate-500/30') : '';

  return (
    <div className="space-y-5">

      {/* ── Input Panel ─────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/30 bg-gradient-to-r from-violet-600/8 to-indigo-600/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Paste cURL Command</h3>
              <p className="text-xs text-slate-500 mt-0.5">Paste any curl — we'll extract URL, method, headers, auth &amp; body</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {curlInput && (
              <button onClick={handleCopy} className="oc-nav-btn text-xs">
                <Copy className="w-3.5 h-3.5" />{copied ? 'Copied' : 'Copy'}
              </button>
            )}
            {(curlInput || result) && (
              <button onClick={handleClear} className="oc-nav-btn text-xs">
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        <div className="p-5">
          <textarea
            value={curlInput}
            onChange={e => { setCurlInput(e.target.value); setError(null); setResult(null); }}
            rows={10}
            spellCheck={false}
            placeholder={CURL_PLACEHOLDER}
            className="w-full bg-slate-950/60 border border-slate-700/50 rounded-xl px-4 py-3.5 text-sm text-violet-300 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 font-mono resize-y leading-relaxed placeholder-slate-600"
          />

          {error && (
            <div className="mt-3 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              Supports Bearer, Basic, API-Key, and custom auth headers
            </p>
            <button
              onClick={handleParse}
              disabled={parsing || !curlInput.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-semibold transition shadow-lg shadow-violet-500/20">
              {parsing
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Parsing…</>
                : <><Zap className="w-4 h-4" /> Parse cURL</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Parse Result ────────────────────────────────────────── */}
      {result && (
        <div className="animate-fade-up space-y-4">

          {/* Confidence header */}
          <div className="glass-card rounded-2xl p-5 flex items-center gap-5 flex-wrap">
            <ScoreRing score={result.confidence.score} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-2 mb-3">
                {/* Method badge */}
                <span className={`inline-flex items-center px-3 py-1 rounded-lg border text-xs font-bold ${methodColor}`}>
                  {result.parsed.method}
                </span>
                {/* Auth badge */}
                {authInfo && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium ${authInfo.bg} ${authInfo.color}`}>
                    <Shield className="w-3 h-3" />{authInfo.label}
                  </span>
                )}
                {/* Field count */}
                {result.fieldCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-xs font-medium">
                    <Code className="w-3 h-3" />{result.fieldCount} fields
                  </span>
                )}
                {/* Protocol warning */}
                {result.parsed.insecure && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border bg-amber-500/10 border-amber-500/20 text-amber-400 text-xs font-medium">
                    <AlertCircle className="w-3 h-3" /> --insecure flag
                  </span>
                )}
              </div>
              <p className="text-sm font-mono text-slate-300 truncate">{result.parsed.url}</p>
              <p className="text-xs text-slate-500 mt-1">{result.parsed.baseUrl} + <span className="text-slate-400">{result.parsed.endpointPath}</span></p>
            </div>

            {result.confidence.warnings.length > 0 && (
              <div className="w-full mt-2 space-y-1">
                {result.confidence.warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-amber-400/80">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />{w}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Service name editor */}
          <div className="glass-card rounded-2xl p-5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Service Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={editedName}
              onChange={e => setEditedName(e.target.value)}
              placeholder="e.g. balance-inquiry-service"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
            <p className="text-xs text-slate-500 mt-1.5">Auto-detected from URL path. Edit if needed.</p>
          </div>

          {/* Headers expandable */}
          {Object.keys(result.parsed.headers).length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowHeaders(h => !h)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/20 transition text-left">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-200">Request Headers</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-700/60 text-slate-400 border border-slate-700/50">
                    {Object.keys(result.parsed.headers).length}
                  </span>
                </div>
                {showHeaders ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>
              {showHeaders && (
                <div className="px-5 pb-4 border-t border-slate-700/30">
                  <div className="mt-3 space-y-0.5">
                    {Object.entries(result.parsed.headers).map(([k, v]) => (
                      <HeaderRow key={k} k={k} v={v} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fields expandable */}
          {result.parsed.fields.length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowFields(f => !f)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/20 transition text-left">
                <div className="flex items-center gap-2.5">
                  <Code className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-200">Detected Request Fields</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    {result.parsed.fields.length} fields
                  </span>
                </div>
                {showFields ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>
              {showFields && (
                <div className="px-5 pb-4 border-t border-slate-700/30">
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 uppercase tracking-wider">
                          <th className="text-left py-2 pr-4 font-semibold">Field</th>
                          <th className="text-left py-2 pr-4 font-semibold">Placeholder</th>
                          <th className="text-left py-2 font-semibold">Sample Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/20">
                        {result.parsed.fields.map((f, i) => (
                          <tr key={i} className="hover:bg-slate-800/20">
                            <td className="py-2 pr-4 font-mono text-slate-300">{f.name}</td>
                            <td className="py-2 pr-4 font-mono text-violet-400">{`{{${f.name}}}`}</td>
                            <td className="py-2 font-mono text-slate-500 truncate max-w-[180px]">{String(f.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Body preview */}
          {result.parsed.body && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowBody(b => !b)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/20 transition text-left">
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-200">Request Body / Template</span>
                  {result.parsed.bodyParsed
                    ? <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">Valid JSON</span>
                    : <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">Not JSON</span>
                  }
                </div>
                {showBody ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>
              {showBody && (
                <div className="px-5 pb-4 border-t border-slate-700/30">
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Original Body</p>
                      <pre className="bg-slate-950/60 rounded-lg p-3 text-xs text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap">
                        {typeof result.parsed.body === 'string'
                          ? result.parsed.body.substring(0, 600)
                          : JSON.stringify(result.parsed.body, null, 2).substring(0, 600)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Generated Template</p>
                      <pre className="bg-slate-950/60 rounded-lg p-3 text-xs text-violet-300 font-mono overflow-x-auto whitespace-pre-wrap">
                        {result.parsed.dataTemplate ? result.parsed.dataTemplate.substring(0, 600) : '—'}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Apply CTA */}
          <div className="flex items-center justify-between gap-4 p-5 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-600/8 to-cyan-600/6">
            <div>
              <p className="text-sm font-semibold text-emerald-300">Ready to generate configuration</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {result.fieldCount} field{result.fieldCount !== 1 ? 's' : ''} will be mapped · All 6 wizard steps pre-filled · Editable before deploy
              </p>
            </div>
            <button
              onClick={handleApply}
              disabled={!editedName.trim()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-semibold transition shadow-lg shadow-emerald-500/20 flex-shrink-0">
              <CheckCircle className="w-4 h-4" />
              Apply &amp; Continue to Review
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
