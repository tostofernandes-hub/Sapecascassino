import React, { useEffect } from 'react';
import { Award, Crown, Flame, Sparkles, X } from 'lucide-react';

export interface LuckyStreakMilestoneData {
  id: number;
  streak: 5 | 10;
}

interface LuckyStreakMilestoneToastProps {
  milestone: LuckyStreakMilestoneData | null;
  onClose: () => void;
}

export const LuckyStreakMilestoneToast: React.FC<LuckyStreakMilestoneToastProps> = ({
  milestone,
  onClose
}) => {
  useEffect(() => {
    if (!milestone) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [milestone, onClose]);

  if (!milestone) return null;

  const isTen = milestone.streak === 10;

  return (
    <div
      key={milestone.id}
      role="status"
      aria-live="polite"
      className="fixed top-16 sm:top-[70px] right-3 sm:right-6 z-50 pointer-events-none max-w-[320px] sm:max-w-sm"
    >
      <div className="pointer-events-auto lucky-milestone-toast relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2b1207]/95 via-[#1c0805]/95 to-[#120403]/95 backdrop-blur-md border-2 border-amber-400/80 shadow-[0_12px_36px_rgba(0,0,0,0.75),0_0_24px_rgba(245,158,11,0.4)] p-3 pr-8 flex items-center gap-3">
        {/* Subtle Gold Top Highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-200/80 to-transparent pointer-events-none" />

        {/* Golden Badge Emblem */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-600 p-[2px] shadow-[0_0_16px_rgba(251,191,36,0.65)]">
            <div className="w-full h-full rounded-[10px] bg-gradient-to-b from-amber-300 via-amber-500 to-yellow-700 flex flex-col items-center justify-center text-slate-950 relative overflow-hidden">
              {isTen ? (
                <Crown className="w-4 h-4 fill-slate-950/20 stroke-[2.5]" />
              ) : (
                <Award className="w-4 h-4 fill-slate-950/20 stroke-[2.5]" />
              )}
              <span className="font-cinzel font-black text-xs leading-none tracking-tight">
                {milestone.streak}x
              </span>
            </div>
          </div>
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#1c0805] border border-amber-300 flex items-center justify-center shadow-md">
            <Flame className="w-3 h-3 text-amber-400 fill-orange-500 lucky-streak-flame" />
          </span>
        </div>

        {/* Celebratory Copy */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-300/50 text-[9px] font-black uppercase tracking-wider text-amber-200">
              <Sparkles className="w-2.5 h-2.5 text-yellow-300" />
              {isTen ? 'Insígnia de Ouro' : 'Marco Dourado'}
            </span>
          </div>
          <h4 className="font-cinzel font-black text-xs sm:text-sm text-amber-200 leading-tight truncate">
            {isTen ? 'Lendário! Lucky Streak 10x!' : 'Em Chamas! Lucky Streak 5x!'}
          </h4>
          <p className="text-[11px] text-orange-100/85 leading-snug">
            {isTen
              ? '10 vitórias seguidas! Você domina a mesa (+10% ativo).'
              : '5 vitórias seguidas! Continue vencendo com +10% bônus.'}
          </p>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar notificação"
          className="absolute top-2 right-2 p-1 rounded-lg text-amber-300/60 hover:text-amber-100 hover:bg-amber-500/15 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Auto-dismiss Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-950/80">
          <div className="h-full bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-500 animate-[shrink_4.5s_linear_forwards]" />
        </div>
      </div>
    </div>
  );
};
