import React, { useEffect, useState } from 'react';
import { getCommunityJackpot, CommunityJackpotState } from '../utils/communityJackpot';
import { Trophy, Sparkles, Flame, Coins } from 'lucide-react';

export const CommunityJackpotBanner: React.FC = () => {
  const [jackpot, setJackpot] = useState<CommunityJackpotState>(getCommunityJackpot);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<CommunityJackpotState>;
      if (custom.detail) {
        setJackpot(custom.detail);
      } else {
        setJackpot(getCommunityJackpot());
      }
    };

    window.addEventListener('sapecas_jackpot_update', handleUpdate);
    return () => {
      window.removeEventListener('sapecas_jackpot_update', handleUpdate);
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2a0e06] via-[#1a0704] to-[#0d0302] border-2 border-amber-500/40 p-3 sm:p-4 shadow-[0_10px_30px_rgba(0,0,0,0.85)] group">
      {/* Background Ambient Glow */}
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-600 to-amber-900 flex items-center justify-center shadow-lg border border-amber-300/60 ring-2 ring-amber-400/20 shrink-0 animate-pulse">
            <Trophy className="w-5 h-5 text-slate-950 fill-current" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-cinzel font-black text-sm sm:text-base text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 uppercase tracking-wider">
                Jackpot Comunitário Coletivo
              </span>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-950/80 border border-red-500/40 text-[9px] font-bold text-red-300 uppercase tracking-widest">
                <Flame className="w-2.5 h-2.5 text-red-400 animate-bounce" /> AO VIVO
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-amber-200/70 font-medium leading-tight">
              Cada aposta em qualquer jogo do cassino enche o pote. Quem atingir 100% leva o prêmio total!
            </p>
          </div>
        </div>

        {/* Current Jackpot Amount Value */}
        <div className="text-left sm:text-right shrink-0 bg-black/40 border border-amber-500/30 rounded-xl px-3 py-1.5 shadow-inner">
          <span className="text-[9px] text-amber-300/80 uppercase font-semibold tracking-wider block">
            Pote Acumulado
          </span>
          <div className="flex items-center gap-1 sm:justify-end">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-mono font-black text-base sm:text-lg text-amber-300 tracking-tight">
              {jackpot.currentPot.toLocaleString('pt-BR')}
            </span>
            <span className="text-[10px] font-bold text-amber-400/80">/ {jackpot.targetPot.toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="relative z-10 space-y-1.5">
        <div className="relative w-full h-5 sm:h-6 bg-black/70 rounded-full p-0.5 border border-amber-500/40 shadow-inner overflow-hidden">
          {/* Animated striped bar */}
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-600 via-amber-400 to-yellow-300 transition-all duration-500 shadow-[0_0_15px_rgba(251,191,36,0.8)] relative"
            style={{ width: `${Math.max(4, Math.min(100, jackpot.percentage))}%` }}
          >
            {/* Shimmer light sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
          </div>

          {/* Floating centered percentage text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-cinzel font-black text-[10px] sm:text-xs text-slate-950 tracking-wider drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-slate-900 inline" />
              {jackpot.percentage.toFixed(1)}% PREENCHIDO
            </span>
          </div>
        </div>

        {/* Footer info: Last Winner */}
        {jackpot.lastWinner && (
          <div className="flex items-center justify-between text-[10px] text-amber-200/60 px-1">
            <span className="truncate">
              Último vencedor: <strong className="text-amber-300 font-bold">{jackpot.lastWinner.username}</strong> ({jackpot.lastWinner.amount.toLocaleString('pt-BR')} fichas)
            </span>
            <span className="font-mono text-[9px] text-amber-400/80 uppercase">
              Prêmio Imediato em Fichas
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
