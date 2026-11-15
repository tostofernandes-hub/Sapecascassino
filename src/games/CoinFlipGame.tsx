import React, { useState } from 'react';
import { soundManager } from '../utils/audio';
import { fireConfetti } from '../utils/confetti';
import { reportRoundLoss } from '../utils/luckyStreak';
import { ArrowLeft, Play, RotateCcw, HelpCircle, Trophy, Sparkles, Flame, CheckCircle, XCircle } from 'lucide-react';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { ChipSelector } from '../components/ChipSelector';

interface CoinFlipGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'coinflip', betAmount?: number) => void;
  onBackToLobby: () => void;
}

type CoinSide = 'CARA' | 'COROA';

export const CoinFlipGame: React.FC<CoinFlipGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby
}) => {
  const [selectedSide, setSelectedSide] = useState<CoinSide>('CARA');
  const [betAmount, setBetAmount] = useState<number>(50);
  const [isFlipping, setIsFlipping] = useState<boolean>(false);
  const [coinResult, setCoinResult] = useState<CoinSide>('CARA');
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [outcome, setOutcome] = useState<{ won: boolean; amount: number; message: string; side: CoinSide } | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  const handleFlip = () => {
    if (isFlipping || betAmount > balance || betAmount <= 0) return;

    soundManager.playChip();
    setIsFlipping(true);
    setOutcome(null);
    onUpdateBalance(-betAmount, false, 'coinflip');

    // Deterministic Fair 50/50 probability
    const resultSide: CoinSide = Math.random() < 0.5 ? 'CARA' : 'COROA';

    // Calculate rotation so it ALWAYS halts precisely facing the exact result:
    // 0 deg (or multiple of 360) = CARA (Front)
    // 180 deg (or 360 * k + 180) = COROA (Back)
    const currentBase = Math.floor(rotationDeg / 360) * 360;
    const fullSpins = 6 * 360; // 6 complete 360 spins
    const targetOffset = resultSide === 'CARA' ? 0 : 180;
    const finalDeg = currentBase + fullSpins + targetOffset;

    setRotationDeg(finalDeg);

    // Audio clicks during flip
    let ticks = 0;
    const interval = setInterval(() => {
      soundManager.playRouletteTick(1400 + ticks * 35);
      ticks++;
      if (ticks >= 12) clearInterval(interval);
    }, 110);

    setTimeout(() => {
      setIsFlipping(false);
      setCoinResult(resultSide);
      soundManager.playBallDrop();

      if (resultSide === selectedSide) {
        // Real house edge ~2.5%: payout is 0.95:1 (returns bet + 0.95 * bet = 1.95x bet)
        const winAmount = Math.floor(betAmount * 1.95);
        const newStreak = streak + 1;
        setStreak(newStreak);
        soundManager.playWin();
        fireConfetti(2400);
        onUpdateBalance(winAmount, true, 'coinflip', betAmount);
        setOutcome({
          won: true,
          amount: winAmount,
          side: resultSide,
          message: `Deu ${resultSide}! Você apostou em ${selectedSide} e GANHOU ${winAmount.toLocaleString('pt-BR')} fichas (pagamento 0,95:1)! 🪙`
        });
      } else {
        setStreak(0);
        soundManager.playLoss();
        reportRoundLoss('coinflip');
        setOutcome({
          won: false,
          amount: 0,
          side: resultSide,
          message: `Deu ${resultSide}! Você apostou em ${selectedSide}. Mais sorte na próxima rodada!`
        });
      }
    }, 1600);
  };

  return (
    <div className="space-y-2 max-w-3xl mx-auto animate-fade-in pb-1">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Lobby</span>
        </button>
        <span className="text-xs font-cinzel font-bold text-amber-400 uppercase tracking-wider">
          Cara ou Coroa 3D (Jogo 100% Justo)
        </span>
      </div>

      {/* Main 3D Coin Arena */}
      <div className="casino-felt border-2 border-orange-500/40 rounded-2xl p-3 sm:p-4 min-h-[190px] sm:min-h-[220px] flex flex-col justify-between shadow-2xl relative overflow-hidden text-center">
        {/* Top Tag & Streaks */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5 text-xs font-cinzel font-bold text-amber-300">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Chances Exatas de 50% / 50%</span>
          </div>
          {streak > 1 && (
            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-orange-600/40 border border-orange-400 text-amber-200 text-xs font-bold font-mono shadow">
              <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
              <span>Sequência de Vitórias: {streak}x</span>
            </div>
          )}
        </div>

        {/* 3D Animated Gold Coin */}
        <div className="my-2 flex flex-col items-center justify-center z-10 relative" style={{ perspective: '1000px' }}>
          <div
            className="transition-transform duration-500 ease-out"
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipping ? 'translateY(-24px) scale(1.08)' : 'translateY(0px) scale(1)'
            }}
          >
            <div
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-full select-none cursor-pointer transition-transform ease-out relative"
              style={{
                transform: `rotateY(${rotationDeg}deg)`,
                transformStyle: 'preserve-3d',
                transitionDuration: isFlipping ? '1.6s' : '0s'
              }}
            >
              {/* Front Face: CARA (Imperial Lion) */}
              <div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-200 via-amber-500 to-amber-700 border-4 border-yellow-100 shadow-2xl flex flex-col items-center justify-center p-2 text-slate-950 font-cinzel font-black select-none"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(0deg) translateZ(1px)'
                }}
              >
                <span className="text-4xl filter drop-shadow">🦁</span>
                <span className="text-xs uppercase tracking-widest mt-1 font-black">CARA</span>
              </div>

              {/* Back Face: COROA (Large Centered Crown Emoji) */}
              <div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-200 via-amber-500 to-amber-700 border-4 border-yellow-100 shadow-2xl flex items-center justify-center p-2 text-slate-950 font-cinzel font-black select-none"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg) translateZ(1px)'
                }}
              >
                <span
                  className="text-6xl leading-none filter drop-shadow-[0_3px_4px_rgba(69,26,3,0.55)]"
                  style={{ transform: 'rotate(0deg)' }}
                  aria-label="Coroa"
                >
                  👑
                </span>
              </div>
            </div>
          </div>

          {/* Ground Contact Shadow (kept outside preserve-3d so 3D faces never flatten) */}
          <div
            className={`mt-2 h-3 rounded-full bg-black/60 blur-sm transition-all duration-500 ${
              isFlipping ? 'w-16 opacity-35' : 'w-24 opacity-70'
            }`}
          />
        </div>

        {/* Real-time Result Outcome Callout */}
        <div className="min-h-[30px] z-10 flex items-center justify-center">
          {outcome ? (
            <div
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-cinzel font-bold text-xs sm:text-sm border shadow-lg ${
                outcome.won
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-300 animate-bounce'
                  : 'bg-red-950/90 border-red-500/70 text-red-200'
              }`}
            >
              {outcome.won ? <CheckCircle className="w-4 h-4 text-emerald-300" /> : <XCircle className="w-4 h-4 text-red-400" />}
              <span>{outcome.message}</span>
            </div>
          ) : (
            <span className="text-xs text-orange-200/80 font-medium">
              Escolha seu lado e clique em Lançar Moeda!
            </span>
          )}
        </div>
      </div>

      {/* Choice Buttons & Restored Comfortable Controls */}
      <div className="bg-[#180705] border border-orange-500/30 rounded-2xl p-3 shadow-xl space-y-2.5">
        {/* Choice buttons (CARA / COROA) - Restored size */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isFlipping}
            onClick={() => {
              soundManager.playClick();
              setSelectedSide('CARA');
            }}
            className={`py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 font-cinzel font-black text-sm sm:text-base transition-all cursor-pointer ${
              selectedSide === 'CARA'
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 border-yellow-200 shadow-xl ring-2 ring-amber-400 scale-102'
                : 'bg-[#240d09] text-orange-200 border-orange-500/30 hover:bg-[#30110c]'
            }`}
          >
            <span className="text-2xl">🦁</span>
            <span>Apostar em CARA</span>
          </button>

          <button
            type="button"
            disabled={isFlipping}
            onClick={() => {
              soundManager.playClick();
              setSelectedSide('COROA');
            }}
            className={`py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 font-cinzel font-black text-sm sm:text-base transition-all cursor-pointer ${
              selectedSide === 'COROA'
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 border-yellow-200 shadow-xl ring-2 ring-amber-400 scale-102'
                : 'bg-[#240d09] text-orange-200 border-orange-500/30 hover:bg-[#30110c]'
            }`}
          >
            <span className="text-2xl">👑</span>
            <span>Apostar em COROA</span>
          </button>
        </div>

        {/* Chips and Action Row - Additive Chips */}
        <div className="pt-2 border-t border-orange-500/20 flex flex-col gap-2.5">
          <ChipSelector
            currentBet={betAmount}
            balance={balance}
            onBetChange={setBetAmount}
            disabled={isFlipping}
            label="Aposta Atual:"
          />

          <button
            type="button"
            disabled={isFlipping || betAmount > balance || betAmount <= 0}
            onClick={handleFlip}
            className="w-full py-2.5 px-6 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-sm sm:text-base shadow-xl shadow-orange-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap border border-orange-300/40"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isFlipping ? 'Girando Moeda...' : `Lançar Moeda (${betAmount.toLocaleString('pt-BR')} Fichas) 🪙`}</span>
          </button>
        </div>
      </div>

      {/* Como Jogar Button */}
      <div className="pt-0.5 text-center">
        <button
          onClick={() => setShowHowToPlay(true)}
          className="inline-flex items-center gap-1 text-[11px] text-orange-300/70 hover:text-amber-300 transition-colors cursor-pointer py-0.5"
        >
          <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
          <span>Regras & Como Jogar Cara ou Coroa</span>
        </button>
      </div>

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        gameId="coinflip"
      />
    </div>
  );
};
