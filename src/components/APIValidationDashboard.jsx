import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap, Play, RefreshCw, Save, Trash2, ChevronDown, ChevronUp,
  CheckCircle, AlertCircle, Loader2, Copy, Download, Globe,
  ArrowRight, Clock, Shield, Settings, Activity
} from 'lucide-react';
import ExecutionStatusTimeline from './ExecutionStatusTimeline';
import PerformanceMetricsCard from './PerformanceMetricsCard';
import RequestPreviewCard from './RequestPreviewCard';
import ResponseAnalysisCard from './ResponseAnalysisCard';
import ValidationHistoryTable from './ValidationHistoryTable';

const API_BASE = '/api';

const APIValidationDashboard = ({
  apiLayerConfigs,
  selectedApiConfigId,
  setSelectedApiConfigId,
  apiTestParams,
  setApiTestParams,
  fetchApiLayerConfigs,
  wsConfig,
  wsEndpointConfig,
  showToast,
  darkMode,
  targetEnvironment,
}) => {
  const [environment, setEnvironment] = useState('mock');
  const [validationResult, setValidationResult] = useState(null);

  // Sync environment from OC Core selector
  useEffect(() => {
    if (!targetEnvironment) return;
    const envMap = { MOCK: 'mock', OC_CORE_LOCAL: 'mock', OC_CORE_UAT: 'uat', OC_CORE_PROD: 'production' };
    const mapped = envMap[targetEnvironment] || 'mock';
    setEnvironment(mapped);
  }, [targetEnvironment]);
  const [validationStatus, setValidationStatus] = useState(null); // null | 'running' | 'success' | 'error'
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [expandedPanels, setExpandedPanels] = useState({
    request: true,
    execution: true,
    response: true,
    performance: true,
  });

  const togglePanel = (key) => setExpandedPanels(prev => ({ ...prev, [key]: !prev[key] }));

  const runValidation = async () => {
    if (!selectedApiConfigId) {
      showToast('No config selected — execute the form in DB first', 'warning');
      return;
    }
    let params;
    try {
      params = JSON.parse(apiTestParams);
    } catch {
      showToast('Test payload is not valid JSON', 'error');
      return;
    }

    setValidationStatus('running');
    setValidationResult(null);

    try {
      const resp = await fetch(`${API_BASE}/layer/validate/${selectedApiConfigId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, _environment: environment, _save: true }),
      });
      const data = await resp.json();
      setValidationResult(data);
      setValidationStatus(data.success ? 'success' : 'error');
      setHistoryRefresh(prev => prev + 1);

      if (data.success) {
        showToast(`Validation passed: ${data.mappedCode} — ${data.mappedDescription}`, 'success');
      } else {
        showToast(`Validation failed: ${data.errorCode || data.errorMessage || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      setValidationResult({ success: false, errorCode: 'NETWORK_ERROR', errorMessage: err.message, stages: [] });
      setValidationStatus('error');
      showToast('Could not reach OpenConnect server', 'error');
    }
  };

  const retryValidation = () => {
    if (validationResult) runValidation();
  };

  const clearResults = () => {
    setValidationResult(null);
    setValidationStatus(null);
  };

  const exportResult = () => {
    if (!validationResult) return;
    const blob = new Blob([JSON.stringify(validationResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation-${selectedApiConfigId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const envColors = {
    mock: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
    uat: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    production: 'bg-red-500/15 border-red-500/30 text-red-400',
  };

  return (
    <div className="space-y-5">
      {/* ═══ A. CONTROL PANEL ═══ */}
      <div className={`rounded-2xl border p-5 space-y-5 ${darkMode ? 'bg-slate-800/20 border-slate-700/40' : 'bg-slate-50/80 border-slate-200/50'}`}>
        {/* Architecture diagram */}
        <div className={`flex items-center gap-2 text-xs font-mono rounded-xl px-4 py-3 overflow-x-auto ${darkMode ? 'text-slate-500 bg-slate-800/50' : 'text-slate-400 bg-white/80 border border-slate-200/50'}`}>
          <span className="text-blue-400">You</span>
          <ArrowRight className="w-3 h-3 flex-shrink-0" />
          <span className="text-emerald-400">OpenConnect</span>
          <ArrowRight className="w-3 h-3 flex-shrink-0" />
          <span className="text-amber-400">validate config</span>
          <ArrowRight className="w-3 h-3 flex-shrink-0" />
          <span className={`${environment === 'production' ? 'text-red-400' : environment === 'uat' ? 'text-amber-400' : 'text-purple-400'}`}>
            {wsConfig.baseUrl}{wsEndpointConfig.endpointTemplate}
          </span>
          <ArrowRight className="w-3 h-3 flex-shrink-0" />
          <span className="text-emerald-400">full analysis</span>
        </div>

        {/* Row 1: Config + Env selector */}
        <div className="flex gap-3.5 items-end flex-wrap">
          <div className="flex-1 min-w-[180px] sm:min-w-[250px]">
            <label className={`text-xs font-semibold mb-2 block ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Endpoint Config (from DB)</label>
            {apiLayerConfigs.length > 0 ? (
              <select value={selectedApiConfigId} onChange={e => setSelectedApiConfigId(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition ${darkMode ? 'bg-slate-800/60 border-slate-700/40 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>
                {apiLayerConfigs.map(c => (
                  <option key={c.id} value={String(c.id)}>
                    [{c.id}] {c.service_name} — {c.method} {c.endpoint_template}
                  </option>
                ))}
              </select>
            ) : (
              <div className={`w-full px-3.5 py-2.5 rounded-xl text-sm border ${darkMode ? 'bg-slate-800/30 border-slate-700/40 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                No configs in DB — execute the form first ↑
              </div>
            )}
          </div>

          <div className="w-40">
            <label className={`text-xs font-semibold mb-2 block ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Environment</label>
            <div className="flex gap-1.5">
              {['mock', 'uat', 'production'].map(env => (
                <button
                  key={env}
                  onClick={() => setEnvironment(env)}
                  className={`flex-1 px-2 py-2.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${
                    environment === env ? envColors[env] : (darkMode ? 'bg-slate-800/30 border-slate-700/30 text-slate-500 hover:text-slate-300' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600')
                  }`}
                >
                  {env}
                </button>
              ))}
            </div>
          </div>

          <button onClick={fetchApiLayerConfigs}
            className={`px-3 py-2.5 rounded-xl border transition ${darkMode ? 'bg-slate-700/40 hover:bg-slate-600/40 border-slate-600/40 text-slate-300' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'}`}
            title="Refresh config list">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Test payload editor */}
        <div>
          <label className={`text-xs font-semibold mb-2 block ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Test Request Payload (JSON)</label>
          <textarea
            value={apiTestParams}
            onChange={e => setApiTestParams(e.target.value)}
            rows={8}
            className={`w-full px-4 py-3.5 rounded-xl font-mono text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none transition ${darkMode ? 'bg-slate-950/60 border-slate-700/40 text-emerald-400' : 'bg-slate-50 border-slate-200 text-emerald-700'}`}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={runValidation}
            disabled={validationStatus === 'running' || apiLayerConfigs.length === 0}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition shadow-lg disabled:opacity-50 ${
              environment === 'production'
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/20'
            }`}
          >
            {validationStatus === 'running'
              ? <><Loader2 className="w-4 h-4 animate-spin" />Validating...</>
              : <><Play className="w-4 h-4" />Validate API</>
            }
          </button>

          {validationResult && (
            <>
              <button onClick={retryValidation}
                className="flex items-center gap-2 px-4 py-3 bg-amber-600/80 hover:bg-amber-500 text-white rounded-xl font-medium text-sm transition">
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
              <button onClick={exportResult}
                className="flex items-center gap-2 px-4 py-3 bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 rounded-xl font-medium text-sm border border-slate-600/50 transition">
                <Download className="w-4 h-4" /> Export
              </button>
              <button onClick={clearResults}
                className="flex items-center gap-2 px-4 py-3 bg-slate-700/60 hover:bg-slate-600/60 text-slate-400 rounded-xl font-medium text-sm border border-slate-600/50 transition">
                <Trash2 className="w-4 h-4" /> Clear
              </button>
            </>
          )}
        </div>

        {/* Environment warning */}
        {environment === 'production' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-400">Production environment selected. This will hit real APIs.</span>
          </div>
        )}
      </div>

      {/* ═══ RESULT PANELS (show after validation) ═══ */}
      {validationResult && (
        <div className="space-y-4">
          {/* Overall status badge */}
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${
            validationResult.success
              ? 'bg-emerald-500/8 border-emerald-500/25'
              : 'bg-red-500/8 border-red-500/25'
          }`}>
            {validationResult.success
              ? <CheckCircle className="w-5 h-5 text-emerald-400" />
              : <AlertCircle className="w-5 h-5 text-red-400" />
            }
            <div className="flex-1">
              <span className={`text-sm font-bold ${validationResult.success ? 'text-emerald-300' : 'text-red-300'}`}>
                {validationResult.success ? 'Validation Passed' : 'Validation Failed'}
              </span>
              {validationResult.mappedCode && (
                <span className="text-xs text-slate-400 ml-3">
                  {validationResult.externalCode} → {validationResult.mappedCode} ({validationResult.mappedDescription})
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500 font-mono">{validationResult.timing?.total_ms}ms</span>
            {validationResult.historyId && (
              <span className="text-[10px] text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/30">
                #{validationResult.historyId}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ═══ B. REQUEST PREVIEW ═══ */}
            <div className={`border rounded-xl overflow-hidden ${darkMode ? 'border-slate-700/40' : 'border-slate-200/60'}`}>
              <button onClick={() => togglePanel('request')}
                className={`w-full flex items-center justify-between px-5 py-3 transition text-xs font-semibold ${darkMode ? 'bg-slate-800/40 hover:bg-slate-700/40 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 text-slate-600'}`}>
                <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-blue-400" /> Request Preview</span>
                {expandedPanels.request ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {expandedPanels.request && (
                <div className={`p-4 border-t ${darkMode ? 'bg-slate-900/30 border-slate-700/25' : 'bg-white border-slate-100'}`}>
                  <RequestPreviewCard data={validationResult} onCopy={(l) => showToast(`${l} copied`, 'success')} />
                </div>
              )}
            </div>

            {/* ═══ C. EXECUTION STATUS ═══ */}
            <div className={`border rounded-xl overflow-hidden ${darkMode ? 'border-slate-700/40' : 'border-slate-200/60'}`}>
              <button onClick={() => togglePanel('execution')}
                className={`w-full flex items-center justify-between px-5 py-3 transition text-xs font-semibold ${darkMode ? 'bg-slate-800/40 hover:bg-slate-700/40 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 text-slate-600'}`}>
                <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-emerald-400" /> Execution Pipeline</span>
                {expandedPanels.execution ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {expandedPanels.execution && (
                <div className={`p-4 border-t ${darkMode ? 'bg-slate-900/30 border-slate-700/25' : 'bg-white border-slate-100'}`}>
                  <ExecutionStatusTimeline stages={validationResult.stages || []} />
                </div>
              )}
            </div>

            {/* ═══ D. RESPONSE ANALYSIS ═══ */}
            <div className={`border rounded-xl overflow-hidden ${darkMode ? 'border-slate-700/40' : 'border-slate-200/60'}`}>
              <button onClick={() => togglePanel('response')}
                className={`w-full flex items-center justify-between px-5 py-3 transition text-xs font-semibold ${darkMode ? 'bg-slate-800/40 hover:bg-slate-700/40 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 text-slate-600'}`}>
                <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-400" /> Response Analysis</span>
                {expandedPanels.response ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {expandedPanels.response && (
                <div className={`p-4 border-t ${darkMode ? 'bg-slate-900/30 border-slate-700/25' : 'bg-white border-slate-100'}`}>
                  <ResponseAnalysisCard data={validationResult} onCopy={(l) => showToast(`${l} copied`, 'success')} />
                </div>
              )}
            </div>

            {/* ═══ E. PERFORMANCE METRICS ═══ */}
            <div className={`border rounded-xl overflow-hidden ${darkMode ? 'border-slate-700/40' : 'border-slate-200/60'}`}>
              <button onClick={() => togglePanel('performance')}
                className={`w-full flex items-center justify-between px-5 py-3 transition text-xs font-semibold ${darkMode ? 'bg-slate-800/40 hover:bg-slate-700/40 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 text-slate-600'}`}>
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-purple-400" /> Performance Metrics</span>
                {expandedPanels.performance ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {expandedPanels.performance && (
                <div className={`p-4 border-t ${darkMode ? 'bg-slate-900/30 border-slate-700/25' : 'bg-white border-slate-100'}`}>
                  <PerformanceMetricsCard timing={validationResult.timing} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ F. VALIDATION HISTORY ═══ */}
      <ValidationHistoryTable configId={selectedApiConfigId} refreshTrigger={historyRefresh} />
    </div>
  );
};

export default APIValidationDashboard;
