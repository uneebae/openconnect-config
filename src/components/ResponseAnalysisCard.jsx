import React from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Copy, ChevronDown } from 'lucide-react';

const ResponseAnalysisCard = ({ data, onCopy }) => {
  if (!data) return null;

  const {
    httpStatus, externalCode, mappedCode, mappedDescription,
    extractedFields, missingFields, rawResponse, errorCode, errorMessage,
  } = data;

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text);
    if (onCopy) onCopy(label);
  };

  const isSuccess = !errorCode && httpStatus >= 200 && httpStatus < 300;

  return (
    <div className="space-y-3">
      {/* Status row */}
      <div className="flex items-center gap-2 flex-wrap">
        {httpStatus && (
          <span className={`px-2 py-1 rounded text-[10px] font-bold border ${
            httpStatus < 300 ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
            httpStatus < 400 ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
            'bg-red-500/15 border-red-500/30 text-red-400'
          }`}>
            HTTP {httpStatus}
          </span>
        )}
        {externalCode && (
          <span className="px-2 py-1 rounded text-[10px] font-mono bg-slate-800/60 border border-slate-700/30 text-slate-300">
            ext: {externalCode}
          </span>
        )}
        {mappedCode && (
          <span className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border ${
            isSuccess ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
          }`}>
            {isSuccess ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {mappedCode} — {mappedDescription}
          </span>
        )}
      </div>

      {/* Error message */}
      {errorCode && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-bold text-red-300">{errorCode}</span>
            {errorMessage && <p className="text-[10px] text-red-400/70 mt-0.5">{errorMessage}</p>}
          </div>
        </div>
      )}

      {/* Extracted fields */}
      {extractedFields && Object.keys(extractedFields).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 mb-1.5">Extracted Fields</p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(extractedFields).map(([k, v]) => {
              const isMissing = missingFields?.includes(k) || v === undefined || v === null;
              return (
                <div key={k} className={`flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg ${
                  isMissing ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-slate-800/50 border border-slate-700/20'
                }`}>
                  <span className="text-slate-500 text-[10px] font-mono flex-shrink-0">{k}:</span>
                  <span className={`text-[10px] font-mono font-semibold break-all ${
                    isMissing ? 'text-amber-400 italic' : 'text-emerald-400'
                  }`}>
                    {v === undefined || v === null ? '(missing)' : String(v)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Missing fields warning */}
      {missingFields && missingFields.length > 0 && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="text-[10px] text-amber-400">Missing fields: {missingFields.join(', ')}</span>
        </div>
      )}

      {/* Raw response */}
      {rawResponse && (
        <details className="group">
          <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-300 transition select-none list-none flex items-center gap-1.5">
            <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
            Raw Response Body
            <button onClick={(e) => { e.preventDefault(); copyText(JSON.stringify(rawResponse, null, 2), 'Response'); }} className="p-0.5 text-slate-600 hover:text-slate-300 transition ml-auto">
              <Copy className="w-3 h-3" />
            </button>
          </summary>
          <pre className="mt-1.5 text-[10px] font-mono text-slate-400 bg-slate-950/50 rounded-lg p-2.5 overflow-x-auto max-h-48 overflow-y-auto">
            {JSON.stringify(rawResponse, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};

export default ResponseAnalysisCard;
