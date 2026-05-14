import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, Clock, Copy, Download, Shield, Globe, Code, ArrowRight, ChevronDown } from 'lucide-react';
import ExecutionStatusTimeline from './ExecutionStatusTimeline';
import PerformanceMetricsCard from './PerformanceMetricsCard';

const ValidationDetailModal = ({ detail, onClose }) => {
  if (!detail) return null;

  const copyText = (text) => navigator.clipboard.writeText(text);

  const isSuccess = !!detail.success;

  const exportReport = () => {
    const report = {
      id: detail.id,
      timestamp: detail.created_at,
      config_id: detail.config_id,
      environment: detail.environment,
      target_url: detail.target_url,
      method: detail.method,
      success: detail.success,
      http_status: detail.http_status,
      external_code: detail.external_code,
      mapped_code: detail.mapped_code,
      mapped_description: detail.mapped_description,
      error_code: detail.error_code,
      error_message: detail.error_message,
      extracted_fields: detail.extracted_fields,
      stages: detail.stages,
      timing: {
        db_load_ms: detail.db_load_ms,
        auth_ms: detail.auth_ms,
        external_api_ms: detail.external_api_ms,
        mapping_ms: detail.mapping_ms,
        total_ms: detail.total_ms,
      },
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation-${detail.id}-${new Date(detail.created_at).toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-gradient-to-r from-blue-600/10 to-indigo-600/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSuccess ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
              {isSuccess ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Validation #{detail.id}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  isSuccess ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
                }`}>
                  {isSuccess ? 'PASSED' : 'FAILED'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">{detail.method} {detail.target_url} &middot; {new Date(detail.created_at).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportReport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs hover:bg-blue-600/30 transition">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg transition">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Overview badges */}
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/30 text-[10px] text-slate-400">
              Config #{detail.config_id}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-400 uppercase font-bold">
              {detail.environment}
            </span>
            {detail.http_status && (
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                detail.http_status < 300 ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-red-500/15 border-red-500/30 text-red-400'
              }`}>HTTP {detail.http_status}</span>
            )}
            {detail.mapped_code && (
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-mono">
                {detail.external_code} → {detail.mapped_code}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/30 text-[10px] text-slate-400 font-mono">
              {detail.total_ms}ms
            </span>
          </div>

          {/* Error */}
          {detail.error_code && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-300">{detail.error_code}</p>
                <p className="text-xs text-red-400/70 mt-0.5">{detail.error_message}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-5">
            {/* Execution Pipeline */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Execution Pipeline</h4>
              <ExecutionStatusTimeline stages={detail.stages || []} />
            </div>

            {/* Performance */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Performance</h4>
              <PerformanceMetricsCard timing={{
                db_load_ms: detail.db_load_ms,
                auth_ms: detail.auth_ms,
                external_api_ms: detail.external_api_ms,
                mapping_ms: detail.mapping_ms,
                total_ms: detail.total_ms,
              }} />
            </div>
          </div>

          {/* Mapping Chain */}
          {detail.mapped_code && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Response Mapping Chain</h4>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/40 rounded-xl border border-slate-700/30 text-xs font-mono overflow-x-auto">
                <span className="text-amber-400">API Response</span>
                <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                <span className="text-blue-400">code: "{detail.external_code}"</span>
                <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                <span className="text-emerald-400">mapped: "{detail.mapped_code}"</span>
                <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                <span className="text-purple-400">{detail.mapped_description}</span>
              </div>
            </div>
          )}

          {/* Extracted Fields */}
          {detail.extracted_fields && typeof detail.extracted_fields === 'object' && Object.keys(detail.extracted_fields).length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Extracted Fields</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(detail.extracted_fields).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/20">
                    <span className="text-slate-500 text-[10px] font-mono flex-shrink-0">{k}:</span>
                    <span className="text-[10px] font-mono font-semibold text-emerald-400 break-all">{v === null || v === undefined ? '—' : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request / Response */}
          <div className="grid grid-cols-2 gap-5">
            {detail.request_payload && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Request Payload</h4>
                  <button onClick={() => copyText(JSON.stringify(detail.request_payload, null, 2))} className="text-slate-500 hover:text-slate-300 transition"><Copy className="w-3 h-3" /></button>
                </div>
                <pre className="bg-slate-950/60 rounded-lg p-2.5 text-[10px] font-mono text-emerald-400/80 max-h-48 overflow-auto">
                  {typeof detail.request_payload === 'string' ? detail.request_payload : JSON.stringify(detail.request_payload, null, 2)}
                </pre>
              </div>
            )}
            {detail.raw_response && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Raw Response</h4>
                  <button onClick={() => copyText(JSON.stringify(detail.raw_response, null, 2))} className="text-slate-500 hover:text-slate-300 transition"><Copy className="w-3 h-3" /></button>
                </div>
                <pre className="bg-slate-950/60 rounded-lg p-2.5 text-[10px] font-mono text-slate-400 max-h-48 overflow-auto">
                  {typeof detail.raw_response === 'string' ? detail.raw_response : JSON.stringify(detail.raw_response, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Security notice */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <Shield className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-[10px] text-amber-400/70">Sensitive values (tokens, secrets, passwords) are automatically masked in stored history.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ValidationDetailModal;
