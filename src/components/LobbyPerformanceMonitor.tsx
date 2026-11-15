import React from 'react';
import { Activity, Cpu, Clock, Maximize2, RefreshCw } from 'lucide-react';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';

export const LobbyPerformanceMonitor: React.FC = () => {
  const { metrics, refresh } = usePerformanceMonitor(1000);

  return (
    <section
      aria-label="Monitor de Performance do Lobby"
      className="rounded-2xl bg-[#160604]/95 border border-orange-500/25 px-4 py-3 shadow-lg"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/35 flex items-center justify-center text-amber-400 shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-cinzel font-bold text-amber-300 tracking-wide">
              Monitor de Performance · Lobby
            </span>
            <span className="block text-[10px] text-orange-200/60">
              Acompanhamento leve de memória e FPS/renderização (contenção 100vh ativa nos jogos)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 bg-[#240b08] border border-orange-500/25 rounded-lg px-2.5 py-1 text-orange-100">
            <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-orange-300/80">Memória:</span>
            <strong className="text-amber-300 tabular-nums">
              {metrics.usedMemoryMb !== null
                ? `${metrics.usedMemoryMb} MB${metrics.totalMemoryMb ? ` / ${metrics.totalMemoryMb} MB` : ''}`
                : `${metrics.domNodes} nós DOM`}
            </strong>
          </div>

          <div className="flex items-center gap-1.5 bg-[#240b08] border border-orange-500/25 rounded-lg px-2.5 py-1 text-orange-100">
            <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-orange-300/80">Render:</span>
            <strong
              className={`tabular-nums ${
                metrics.renderTimeMs <= 16.7
                  ? 'text-emerald-400'
                  : metrics.renderTimeMs <= 33.3
                    ? 'text-amber-300'
                    : 'text-rose-400'
              }`}
            >
              {metrics.renderTimeMs.toFixed(2)} ms · {metrics.fps} FPS
            </strong>
          </div>

          <div className="flex items-center gap-1.5 bg-[#240b08] border border-orange-500/25 rounded-lg px-2.5 py-1 text-orange-100">
            <Maximize2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="text-orange-300/80">100vh:</span>
            <strong className={metrics.isHealthy ? 'text-emerald-400 tabular-nums' : 'text-amber-300 tabular-nums'}>
              {metrics.viewportWidth}×{metrics.viewportHeight}
            </strong>
          </div>

          <button
            type="button"
            onClick={refresh}
            title="Atualizar leitura de performance"
            className="p-1.5 rounded-lg bg-[#240b08] hover:bg-[#32100b] border border-orange-500/30 text-orange-300 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
