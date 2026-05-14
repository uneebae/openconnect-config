import React from 'react';
import { Clock, Zap, Database, Shield, Globe, ArrowRight } from 'lucide-react';

function tier(ms, fast = 50, moderate = 200) {
  if (ms == null) return 'text-slate-500';
  if (ms <= fast) return 'text-emerald-400';
  if (ms <= moderate) return 'text-amber-400';
  return 'text-red-400';
}

function tierBg(ms, fast = 50, moderate = 200) {
  if (ms == null) return 'bg-slate-700/30';
  if (ms <= fast) return 'bg-emerald-500/10';
  if (ms <= moderate) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

function bar(ms, total) {
  if (!total || !ms) return 0;
  return Math.min(Math.round((ms / total) * 100), 100);
}

const PerformanceMetricsCard = ({ timing }) => {
  if (!timing) return null;

  const metrics = [
    { key: 'db_load_ms',       label: 'DB Load',          icon: Database, fast: 30,  moderate: 100  },
    { key: 'auth_ms',          label: 'Auth',             icon: Shield,   fast: 20,  moderate: 80   },
    { key: 'external_api_ms',  label: 'External API',     icon: Globe,    fast: 100, moderate: 500  },
    { key: 'response_parse_ms',label: 'Response Parse',   icon: Zap,      fast: 10,  moderate: 50   },
    { key: 'mapping_ms',       label: 'Code Mapping',     icon: ArrowRight,fast: 5,  moderate: 20   },
    { key: 'extraction_ms',    label: 'Field Extraction', icon: Zap,      fast: 5,   moderate: 20   },
  ];

  const total = timing.total_ms || 0;

  return (
    <div className="space-y-2">
      {/* Total bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/30">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-slate-300">Total Duration</span>
        </div>
        <span className={`text-sm font-bold font-mono ${tier(total, 200, 1000)}`}>
          {total}ms
        </span>
      </div>

      {/* Individual metrics */}
      <div className="grid grid-cols-2 gap-1.5">
        {metrics.map(({ key, label, icon: Icon, fast, moderate }) => {
          const ms = timing[key];
          if (ms == null || ms === undefined) return null;
          return (
            <div key={key} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg ${tierBg(ms, fast, moderate)} border border-slate-700/20`}>
              <Icon className={`w-3 h-3 flex-shrink-0 ${tier(ms, fast, moderate)}`} />
              <span className="text-[10px] text-slate-400 flex-1 truncate">{label}</span>
              <span className={`text-[11px] font-mono font-semibold flex-shrink-0 ${tier(ms, fast, moderate)}`}>
                {ms}ms
              </span>
            </div>
          );
        })}
      </div>

      {/* Visual timeline bar */}
      {total > 0 && (
        <div className="h-2 rounded-full overflow-hidden flex bg-slate-800/60 mt-1">
          {metrics.filter(m => timing[m.key] > 0).map(({ key, fast, moderate }) => {
            const ms = timing[key];
            const pct = bar(ms, total);
            if (pct === 0) return null;
            const color = ms <= fast ? 'bg-emerald-500' : ms <= moderate ? 'bg-amber-500' : 'bg-red-500';
            return <div key={key} className={`${color} h-full`} style={{ width: `${pct}%` }} title={`${key}: ${ms}ms`} />;
          })}
        </div>
      )}
    </div>
  );
};

export default PerformanceMetricsCard;
