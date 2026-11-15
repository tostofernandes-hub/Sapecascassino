import React, { useEffect, useState } from 'react';
import { soundManager } from '../utils/audio';
import { ConfettiCelebration, ConfettiIntensity } from './ConfettiCelebration';
import { Sparkles, X } from 'lucide-react';

interface BigWinCelebrationProps {
  isOpen: boolean;
  winAmount: number;
  betAmount?: number;
  confettiIntensity?: ConfettiIntensity;
  confettiColors?: string[];
  onClose: () => void;
}

export const BigWinCelebration: React.FC<BigWinCelebrationProps> = ({
  isOpen,
  winAmount,
  betAmount,
  confettiIntensity,
  confettiColors,
  onClose
}) => {
  const [isExiting, setIsExiting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setIsExiting(false);
      return;
    }

    // Play celebration audio
    soundManager.playJackpot();

    // After 1.65 seconds, begin exit animation
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 1650);

    // Exactly 2 seconds (2000ms), finish and close
    const closeTimer = setTimeout(() => {
      onClose();
    }, 2000);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const multiplier = betAmount && betAmount > 0 ? (winAmount / betAmount).toFixed(1) : null;

  return (
    <>
      <ConfettiCelebration
        isActive={isOpen}
        winAmount={winAmount}
        betAmount={betAmount}
        intensity={confettiIntensity}
        colors={confettiColors}
        zIndex={150}
      />
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md cursor-pointer transition-opacity duration-300 overflow-y-auto ${
          isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
      {/* Radiant Sunburst Background Glow */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <div className="w-[500px] h-[500px] sm:w-[700px] sm:h-[700px] rounded-full bg-gradient-to-r from-amber-500/30 via-red-500/20 to-yellow-500/30 blur-3xl animate-pulse" />
      </div>

      {/* Main Celebration Banner using the user's reference image */}
      <div
        className={`relative my-auto max-w-[340px] sm:max-w-[400px] w-full rounded-3xl overflow-hidden border-4 border-amber-400 shadow-[0_0_80px_rgba(245,158,11,0.8)] transition-all duration-300 transform select-none ${
          isExiting ? 'scale-75 -translate-y-8 opacity-0' : 'scale-100 translate-y-0 opacity-100 animate-fade-in'
        }`}
      >
        {/* Reference Image as Base */}
        <div className="relative aspect-[9/16] w-full overflow-hidden bg-[#2a0604]">
          <img
            src="/assets/aistudio/06250eee5c47ea23748ec85e6e0808d6_d7ecbe2f.jpg"
            alt="Grande Vitória - Total de Ganhos"
            className="block opacity-100 w-full h-full object-cover object-center"
            loading="eager"
          />

          {/* Dynamic Winner Overlay perfectly aligned over the center glowing sunburst */}
          <div className="absolute inset-0 flex flex-col items-center justify-between py-6 px-4 pointer-events-none">
            {/* Top Multiplier Pill */}
            <div className="mt-12 sm:mt-14 px-4 py-1 rounded-full bg-amber-500/90 border border-yellow-200 text-slate-950 font-cinzel font-black text-xs sm:text-sm tracking-wider shadow-lg animate-bounce flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-slate-950 fill-current" />
              <span>GRANDE VITÓRIA {multiplier ? `· ${multiplier}x` : ''}</span>
            </div>

            {/* Center Dynamic Chips Amount */}
            <div className="flex flex-col items-center -mt-6 sm:-mt-8">
              <span className="text-[11px] sm:text-xs font-cinzel font-black uppercase tracking-widest text-amber-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                Fichas Conquistadas
              </span>
              <div className="font-cinzel font-black text-4xl sm:text-5xl text-yellow-300 drop-shadow-[0_4px_12px_rgba(180,20,0,0.95)] stroke-amber-700 tracking-tight flex items-center gap-1 mt-1">
                <span>+</span>
                <span>{winAmount.toLocaleString('pt-BR')}</span>
              </div>
              <span className="text-[10px] text-amber-100 font-semibold mt-1 px-3 py-0.5 rounded-full bg-black/40 border border-amber-400/40 backdrop-blur-sm">
                Mais de 2x o valor apostado!
              </span>
            </div>

            {/* Bottom 2-second indicator bar */}
            <div className="w-48 bg-slate-950/80 rounded-full h-1.5 overflow-hidden border border-amber-400/40 mb-3">
              <div className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 animate-[shrink_2s_linear_forwards]" />
            </div>
          </div>
        </div>

        {/* Quick Close Button in Top Right */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 border border-amber-400 text-amber-300 hover:text-white hover:bg-black flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      </div>
    </>
  );
};
