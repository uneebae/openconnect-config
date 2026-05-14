import React from 'react';
import { Globe, Key, Clock, Copy, Shield, Link2, Code } from 'lucide-react';

const RequestPreviewCard = ({ data, onCopy }) => {
  if (!data) return null;

  const { targetUrl, method, requestHeaders, authType, authStatus, requestPayload, timing } = data;

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text);
    if (onCopy) onCopy(label);
  };

  const methodColors = {
    GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    PATCH: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <div className="space-y-3">
      {/* URL & Method */}
      <div className="flex items-start gap-2">
        <span className={`px-2 py-1 rounded text-[10px] font-bold border flex-shrink-0 ${methodColors[method] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
          {method || 'POST'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <code className="text-xs font-mono text-blue-300 break-all">{targetUrl || '—'}</code>
            {targetUrl && (
              <button onClick={() => copyText(targetUrl, 'URL')} className="p-0.5 text-slate-500 hover:text-slate-300 transition flex-shrink-0">
                <Copy className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-2">
        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/60 border border-slate-700/30 text-[10px] text-slate-400">
          <Shield className="w-3 h-3" /> {authType || 'none'}
        </span>
        <span className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] ${
          authStatus === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
          authStatus === 'configured' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
          'bg-slate-800/60 border-slate-700/30 text-slate-400'
        }`}>
          <Key className="w-3 h-3" /> {authStatus || 'skipped'}
        </span>
      </div>

      {/* Headers */}
      {requestHeaders && Object.keys(requestHeaders).length > 0 && (
        <details className="group">
          <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-300 transition select-none flex items-center gap-1">
            <Globe className="w-3 h-3" /> Headers ({Object.keys(requestHeaders).length})
          </summary>
          <div className="mt-1.5 bg-slate-950/50 rounded-lg p-2 text-[10px] font-mono text-slate-400 space-y-0.5">
            {Object.entries(requestHeaders).map(([k, v]) => (
              <div key={k}><span className="text-blue-400">{k}:</span> {String(v)}</div>
            ))}
          </div>
        </details>
      )}

      {/* Request Body */}
      {requestPayload && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500 flex items-center gap-1"><Code className="w-3 h-3" /> Request Body</span>
            <button onClick={() => copyText(JSON.stringify(requestPayload, null, 2), 'Request body')} className="p-0.5 text-slate-500 hover:text-slate-300 transition">
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <pre className="bg-slate-950/50 rounded-lg p-2.5 text-[10px] font-mono text-emerald-400/80 overflow-x-auto max-h-40 overflow-y-auto">
            {JSON.stringify(requestPayload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default RequestPreviewCard;
