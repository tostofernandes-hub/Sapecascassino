import React, { useState } from 'react';
import { soundManager } from '../utils/audio';
import { fireConfetti } from '../utils/confetti';
import { reportRoundLoss } from '../utils/luckyStreak';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { ThreeDLottery } from '../components/ThreeDLottery';
import { ChipSelector } from '../components/ChipSelector';
import { ArrowLeft, Play, Sparkles, Trash2, Dices, RotateCcw, HelpCircle } from 'lucide-react';

interface LotteryGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'lottery', betAmount?: number) => void;
  onBackToLobby: () => void;
}

// Cost multiplier by number of picks (6 to 15 numbers)
const COST_FACTORS: Record<number, number> = {
  6: 1,
  7: 7,
  8: 28,
  9: 84,
  10: 210,
  11: 462,
  12: 924,
  13: 1716,
  14: 3003,
  15: 5005
};

export const LotteryGame: React.FC<LotteryGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby
}) => {
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set([7, 14, 21, 33, 42, 58]));
  const [baseBet, setBaseBet] = useState<number>(10);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [targetWinningNumbers, setTargetWinningNumbers] = useState<number[]>([]);
  const [hitsCount, setHitsCount] = useState<number | null>(null);
  const [resultMessage, setResultMessage] = useState<string>('');
  const [winAmount, setWinAmount] = useState<number>(0);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  const pickCount = selectedNumbers.size;
  const factor = COST_FACTORS[pickCount] || 1;
  const totalBet = baseBet * factor;

  const toggleNumber = (num: number) => {
    if (isDrawing) return;
    soundManager.playClick();
    setSelectedNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        if (next.size >= 15) return prev; // Maximum 15 numbers
        next.add(num);
      }
      return next;
    });
  };

  const handleClear = () => {
    if (isDrawing) return;
    soundManager.playClick();
    setSelectedNumbers(new Set());
    setHitsCount(null);
    setResultMessage('');
    setDrawnNumbers([]);
    setTargetWinningNumbers([]);
  };

  const handleSurpresinha = () => {
    if (isDrawing) return;
    soundManager.playClick();
    const randomSet = new Set<number>();
    while (randomSet.size < 6) {
      randomSet.add(Math.floor(Math.random() * 60) + 1);
    }
    setSelectedNumbers(randomSet);
    setHitsCount(null);
    setResultMessage('');
    setDrawnNumbers([]);
    setTargetWinningNumbers([]);
  };

  const handleBallDrawn = (num: number, _idx: number) => {
    setDrawnNumbers((prev) => [...prev, num]);
  };

  const handleDrawComplete = () => {
    setIsDrawing(false);

    // Count hits
    let hits = 0;
    for (const n of targetWinningNumbers) {
      if (selectedNumbers.has(n)) {
        hits++;
      }
    }

    setHitsCount(hits);

    if (hits === 6) {
      // SENA! Mega Jackpot!
      const prize = baseBet * 50000;
      setWinAmount(prize);
      setResultMessage(`SENA HISTÓRICA! 6 ACERTOS! Você ganhou ${prize.toLocaleString('pt-BR')} fichas!`);
      soundManager.playJackpot();
      fireConfetti(4000);
      onUpdateBalance(prize, true, 'lottery', totalBet);
    } else if (hits === 5) {
      // QUINA!
      const prize = baseBet * 1500;
      setWinAmount(prize);
      setResultMessage(`QUINA! 5 ACERTOS! Você ganhou ${prize.toLocaleString('pt-BR')} fichas!`);
      soundManager.playWin();
      fireConfetti(2500);
      onUpdateBalance(prize, true, 'lottery', totalBet);
    } else if (hits === 4) {
      // QUADRA!
      const prize = baseBet * 50;
      setWinAmount(prize);
      setResultMessage(`QUADRA! 4 ACERTOS! Você ganhou ${prize.toLocaleString('pt-BR')} fichas!`);
      soundManager.playWin();
      fireConfetti(1500);
      onUpdateBalance(prize, true, 'lottery', totalBet);
    } else {
      soundManager.playLoss();
      reportRoundLoss('lottery');
      setResultMessage(`Você acertou ${hits} ${hits === 1 ? 'número' : 'números'}. Faixa mínima de prêmio é 4 acertos (Quadra).`);
    }
  };

  const handleDraw = () => {
    if (isDrawing || pickCount < 6 || pickCount > 15 || totalBet > balance) return;

    // Deduct cost
    onUpdateBalance(-totalBet, false, 'lottery');

    // Pick 6 unique winning numbers from 1 to 60
    const winningSet = new Set<number>();
    while (winningSet.size < 6) {
      winningSet.add(Math.floor(Math.random() * 60) + 1);
    }
    const finalNumbers = Array.from(winningSet).sort((a, b) => a - b);
    setTargetWinningNumbers(finalNumbers);
    setDrawnNumbers([]);
    setHitsCount(null);
    setResultMessage('');
    setWinAmount(0);
    setIsDrawing(true);
  };

  return (
    <div className="space-y-1.5 max-w-4xl mx-auto animate-fade-in pb-1">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Lobby</span>
        </button>

        <span className="text-xs font-cinzel font-bold text-amber-400 uppercase tracking-wider">
          Loteria Mega Esferas
        </span>
      </div>

      {/* Live 3D Ball Drawing Cage & Chute Container */}
      <div className="casino-felt border border-amber-500/30 rounded-xl p-2 sm:p-2.5 shadow-xl text-center space-y-1.5 flex flex-col items-center">
        <div className="flex items-center justify-between px-2 w-full">
          <span className="text-[10px] font-cinzel font-bold text-amber-300 uppercase tracking-widest block">
            Globo Rotativo de Bingo 3D & Tubo de Extração
          </span>
          {/* Quick prize mini summary */}
          <div className="hidden sm:flex items-center gap-2.5 text-[10px] text-slate-300 font-mono">
            <span>Sena: <strong className="text-amber-400">50.000x</strong></span>
            <span>Quina: <strong className="text-emerald-400">1.500x</strong></span>
            <span>Quadra: <strong className="text-blue-400">50x</strong></span>
          </div>
        </div>

        {/* 3D Canvas Cage & Ramp */}
        <div className="flex justify-center w-full my-0.5">
          <ThreeDLottery
            isDrawing={isDrawing}
            winningNumbers={targetWinningNumbers}
            drawnNumbers={drawnNumbers}
            onBallDrawn={handleBallDrawn}
            onDrawComplete={handleDrawComplete}
            width={340}
            height={185}
          />
        </div>

        {/* 6 Drawn Balls - 3D Velvet Rack */}
        <div className="w-full bg-[#130403] border border-amber-600/50 rounded-lg py-1.5 px-3 shadow-inner">
          <div className="text-[9px] text-amber-200/70 font-semibold mb-1 uppercase tracking-wider">
            Esferas Extraídas pelo Tubo Mecânico
          </div>
          <div className="flex items-center justify-center gap-2 sm:gap-3 min-h-[36px]">
            {Array.from({ length: 6 }).map((_, idx) => {
              const ball = drawnNumbers[idx];
              const isMatch = ball !== undefined && selectedNumbers.has(ball);
              return (
                <div
                  key={idx}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-cinzel font-bold text-xs sm:text-sm transition-all duration-300 ${
                    ball !== undefined
                      ? isMatch
                        ? 'bg-gradient-to-br from-amber-200 via-amber-400 to-amber-700 text-slate-950 ring-2 ring-white scale-110 font-black shadow-[0_0_15px_rgba(251,191,36,0.9)] animate-pulse'
                        : 'bg-gradient-to-br from-orange-400 via-orange-600 to-amber-900 text-white border border-amber-400 shadow-[0_4px_8px_rgba(0,0,0,0.8)]'
                      : 'bg-slate-950/80 border border-dashed border-amber-500/30 text-amber-500/30 text-[10px]'
                  }`}
                  style={ball !== undefined ? {
                    boxShadow: isMatch 
                      ? '0 0 16px #fbbf24, inset -2px -2px 6px rgba(0,0,0,0.6), inset 2px 2px 6px rgba(255,255,255,0.8)' 
                      : '0 4px 10px rgba(0,0,0,0.8), inset -2px -2px 6px rgba(0,0,0,0.7), inset 2px 2px 5px rgba(255,255,255,0.6)'
                  } : undefined}
                >
                  {ball !== undefined ? ball : idx + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* Result Message */}
        {resultMessage && (
          <div className="pt-0.5 animate-bounce">
            <div
              className={`inline-block px-3 py-0.5 rounded-lg font-cinzel font-bold text-xs border shadow-lg ${
                winAmount > 0
                  ? 'bg-amber-500 text-slate-950 border-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              {resultMessage}
            </div>
          </div>
        )}
      </div>

      {/* Interactive 1 to 60 Numbers Card Grid */}
      <div className="bg-[#180705] border border-orange-500/30 rounded-xl p-2 sm:p-2.5 shadow-xl space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-cinzel font-bold text-amber-300 uppercase tracking-wider block">
              Volante da Loteria (6 a 15 dezenas)
            </span>
            <span className="text-[10px] text-orange-300/80">
              Selecionados: <strong className="text-amber-400 font-bold">{pickCount}</strong> de 15 máx.
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isDrawing}
              onClick={handleSurpresinha}
              className="px-2 py-0.5 rounded-lg bg-[#270e0a] hover:bg-[#34130d] text-[10px] font-semibold text-orange-200 border border-orange-500/20 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Dices className="w-3 h-3 text-orange-400" />
              <span>Surpresinha (6)</span>
            </button>

            <button
              type="button"
              disabled={isDrawing || pickCount === 0}
              onClick={handleClear}
              className="px-2 py-0.5 rounded-lg bg-[#270e0a] hover:bg-[#34130d] text-[10px] font-semibold text-orange-200 border border-orange-500/20 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
              <span>Limpar</span>
            </button>
          </div>
        </div>

        {/* 60 Numbers Grid (10 columns) */}
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-1">
          {Array.from({ length: 60 }, (_, i) => i + 1).map((num) => {
            const isSelected = selectedNumbers.has(num);
            const isHit = drawnNumbers.includes(num);
            return (
              <button
                key={num}
                type="button"
                disabled={isDrawing}
                onClick={() => toggleNumber(num)}
                className={`h-5.5 sm:h-6.5 rounded font-bold text-[10px] sm:text-[11px] transition-all select-none flex items-center justify-center cursor-pointer ${
                  isSelected
                    ? isHit
                      ? 'bg-amber-400 text-slate-950 ring-2 ring-white scale-105 font-black'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                    : 'bg-[#120403] hover:bg-[#200806] text-orange-200/90 border border-orange-500/20'
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>

        {/* Bet Calculation & Draw Action */}
        <div className="pt-1.5 border-t border-orange-500/20 flex flex-col gap-1.5">
          <ChipSelector
            currentBet={baseBet}
            balance={balance}
            multiplierCount={factor}
            onBetChange={setBaseBet}
            disabled={isDrawing}
            label="Ficha Base:"
            showDouble={false}
            showAllIn={false}
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-orange-300/90 font-mono">
              Aposta Atual Total: <strong className="text-amber-300 font-black">{totalBet.toLocaleString('pt-BR')}</strong> fichas
            </span>

            <button
              type="button"
              disabled={isDrawing || pickCount < 6 || pickCount > 15 || totalBet > balance || totalBet <= 0}
              onClick={handleDraw}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs shadow-xl shadow-orange-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap border border-orange-300/40"
            >
              {drawnNumbers.length > 0 && !isDrawing ? (
                <RotateCcw className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>
                {isDrawing
                  ? 'Sorteando...'
                  : drawnNumbers.length > 0
                  ? 'Novo Sorteio 🎱'
                  : `Apostar e Sortear (${totalBet.toLocaleString('pt-BR')} Fichas) 🎱`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Como Jogar Button at the bottom without pushing controls */}
      <div className="pt-0.5 text-center">
        <button
          onClick={() => setShowHowToPlay(true)}
          className="inline-flex items-center gap-1 text-[11px] text-orange-300/70 hover:text-amber-300 transition-colors cursor-pointer py-0.5"
        >
          <HelpCircle className="w-3 h-3 text-orange-400" />
          <span>Regras & Como Jogar Loteria Mega Esferas</span>
        </button>
      </div>

      {/* Rules Modal */}
      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        gameId="lottery"
      />
    </div>
  );
};
