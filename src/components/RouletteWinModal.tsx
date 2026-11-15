import React, { useEffect, useState, useRef } from 'react';
import { soundManager } from '../utils/audio';
import { Sparkles, Trophy, X, Zap } from 'lucide-react';

interface WinningBetDetail {
  label: string;
  multiplier: number; // e.g. 35 (which pays 36x) or 1 (which pays 2x)
  payoutMultiplierDisplay: number; // 36x, 2x, 3x
  amountBet: number;
  winAmount: number;
}

interface RouletteWinModalProps {
  isOpen: boolean;
  onClose: () => void;
  winningNumber: number;
  numberColor: 'red' | 'black' | 'green';
  totalWon: number;
  totalBet: number;
  winningBets: WinningBetDetail[];
}

export const RouletteWinModal: React.FC<RouletteWinModalProps> = ({
  isOpen,
  onClose,
  winningNumber,
  numberColor,
  totalWon,
  totalBet,
  winningBets
}) => {
  const [displayedWon, setDisplayedWon] = useState<number>(0);
  const [displayedMultiplier, setDisplayedMultiplier] = useState<number>(1);
  const [animationCompleted, setAnimationCompleted] = useState<boolean>(false);
  const [multiplierRevealed, setMultiplierRevealed] = useState<boolean>(false);

  // Highest multiplier among winning bets (e.g. 36x for straight up, 3x for dozen, 2x for even-money)
  const maxMultiplier = winningBets.length > 0 
    ? Math.max(...winningBets.map(b => b.payoutMultiplierDisplay)) 
    : Math.max(1, Math.round(totalWon / Math.max(1, totalBet)));

  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setDisplayedWon(0);
      setDisplayedMultiplier(1);
      setAnimationCompleted(false);
      setMultiplierRevealed(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    // Step 1: Reveal multiplier sound & visual pop
    soundManager.playMultiplierHit();
    setMultiplierRevealed(true);

    // Step 2: Animated count-up for won amount and multiplier
    const startTime = performance.now();
    const duration = 1800; // 1.8 seconds duration for dynamic count-up
    let lastAudioTick = 0;

    const animateCount = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Ease out cubic function for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentWonValue = Math.round(easeOut * totalWon);
      const currentMultiValue = Math.max(1, Math.round(easeOut * maxMultiplier));
      
      setDisplayedWon(currentWonValue);
      setDisplayedMultiplier(currentMultiValue);

      // Play audio coin tally tick on increments
      if (elapsed - lastAudioTick > 80 && progress < 0.98) {
        lastAudioTick = elapsed;
        const pitch = 900 + Math.round(progress * 600); // Pitch raises as counter climbs
        soundManager.playCoinTally(pitch);
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animateCount);
      } else {
        setDisplayedWon(totalWon);
        setDisplayedMultiplier(maxMultiplier);
        setAnimationCompleted(true);
        soundManager.playWin();
      }
    };

    const timer = setTimeout(() => {
      animationFrameRef.current = requestAnimationFrame(animateCount);
    }, 250);

    return () => {
      clearTimeout(timer);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen, totalWon, maxMultiplier]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      {/* Glow rays backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="w-[450px] h-[450px] rounded-full bg-gradient-to-r from-amber-500/20 via-orange-600/30 to-yellow-400/20 blur-3xl animate-pulse" />
      </div>

      <div className="relative my-auto w-full max-w-sm sm:max-w-md bg-gradient-to-b from-[#2a0b06] via-[#1a0604] to-[#0e0302] border-2 border-amber-400/80 rounded-2xl p-4 sm:p-5 shadow-2xl text-center space-y-3 z-10 overflow-hidden">
        {/* Subtle decorative border corners */}
        <div className="absolute -top-10 -left-10 w-24 h-24 bg-amber-500/20 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-orange-600/20 rounded-full blur-xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2.5 right-2.5 p-1 rounded-full text-amber-300/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/30 to-amber-500/20 border border-amber-400/40 text-amber-300 font-cinzel font-bold text-xs uppercase tracking-widest shadow-inner">
          <Trophy className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
          <span>Vitória na Roleta Imperial</span>
        </div>

        {/* Winning Number Badge */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-orange-200/80 uppercase font-semibold">Número Premiado:</span>
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center font-cinzel text-base font-black text-white shadow-lg border-2 border-amber-300 ${
              numberColor === 'red'
                ? 'bg-red-600'
                : winningNumber === 0
                ? 'bg-emerald-600'
                : 'bg-slate-900'
            }`}
          >
            {winningNumber}
          </div>
          <span className="text-xs font-bold text-amber-300 capitalize">
            ({numberColor === 'red' ? 'Vermelho' : winningNumber === 0 ? 'Zero Verde' : 'Preto'})
          </span>
        </div>

        {/* Multiplier Display ("O Vezes Que Foi Ganho") */}
        <div className="py-1">
          <div className="text-[11px] font-cinzel font-bold text-amber-300/80 uppercase tracking-wider mb-1">
            Vezes Ganho na Aposta
          </div>
          <div className={`inline-flex items-center justify-center px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 via-yellow-500 to-orange-500 text-slate-950 font-cinzel font-black text-2xl sm:text-3xl shadow-lg shadow-amber-500/30 border-2 border-yellow-200 tracking-wider transition-transform duration-300 ${
            multiplierRevealed ? 'scale-105' : 'scale-90'
          }`}>
            <Zap className="w-5 h-5 mr-1 fill-current text-slate-950 animate-pulse" />
            <span>{displayedMultiplier}x</span>
          </div>
        </div>

        {/* Dynamic Count-Up of Amount Won ("A Contagem do Valor Ganho") */}
        <div className="bg-[#120403] border border-amber-500/40 rounded-xl p-3 shadow-inner space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-orange-300/80 font-bold block">
            Contagem Total do Prêmio
          </span>
          <div className="font-cinzel font-black text-3xl sm:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 drop-shadow-md tabular-nums">
            +{displayedWon.toLocaleString('pt-BR')}
          </div>
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest block">
            Fichas Conquistadas
          </span>
        </div>

        {/* Breakdown of Winning Bets */}
        <div className="max-h-24 overflow-y-auto space-y-1 px-1 text-left text-[11px]">
          {winningBets.map((wb, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between bg-black/40 px-2 py-1 rounded border border-orange-500/20"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span className="text-orange-100 font-medium truncate max-w-[170px] sm:max-w-[210px]">
                  {wb.label}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-amber-400 font-bold bg-amber-500/20 px-1 rounded text-[10px]">
                  {wb.payoutMultiplierDisplay}x
                </span>
                <span className="text-emerald-400 font-bold">
                  +{wb.winAmount.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:brightness-110 text-slate-950 font-cinzel font-black text-sm shadow-xl shadow-orange-500/30 transition-all cursor-pointer border border-yellow-200 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 fill-current" />
          <span>{animationCompleted ? 'Coletar e Continuar 🎡' : 'Pular Contagem ⏭️'}</span>
        </button>
      </div>
    </div>
  );
};
