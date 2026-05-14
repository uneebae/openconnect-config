import React from 'react';
import { CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';

const stageLabels = {
  configLoad:      'Config Loaded',
  templateBuild:   'Template Built',
  authApply:       'Auth Applied',
  externalCall:    'External API Called',
  responseReceive: 'Response Received',
  codeMapping:     'Code Mapped',
  fieldExtraction: 'Fields Extracted',
};

const ExecutionStatusTimeline = ({ stages }) => {
  if (!stages || stages.length === 0) return null;

  return (
    <div className="space-y-1">
      {stages.map((stage, idx) => {
        const isSuccess = stage.status === 'success';
        const isError = stage.status === 'error';
        const isRunning = stage.status === 'running';

        return (
          <div key={stage.name} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
            isError ? 'bg-red-500/10 border border-red-500/20' :
            isSuccess ? 'bg-emerald-500/5 border border-emerald-500/10' :
            'bg-slate-800/30 border border-slate-700/30'
          }`}>
            <div className="flex-shrink-0">
              {isSuccess && <CheckCircle className="w-4 h-4 text-emerald-400" />}
              {isError && <AlertCircle className="w-4 h-4 text-red-400" />}
              {isRunning && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-medium ${isError ? 'text-red-300' : isSuccess ? 'text-slate-300' : 'text-slate-400'}`}>
                  {stageLabels[stage.name] || stage.name}
                </span>
                {stage.ms != null && (
                  <span className={`text-[10px] font-mono flex-shrink-0 ${
                    stage.ms < 50 ? 'text-emerald-400' : stage.ms < 200 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {stage.ms}ms
                  </span>
                )}
              </div>
              {stage.note && (
                <p className={`text-[10px] mt-0.5 truncate ${isError ? 'text-red-400/70' : 'text-slate-500'}`}>
                  {stage.note}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ExecutionStatusTimeline;
