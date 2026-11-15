import React, { useState, useRef } from 'react';
import { soundManager } from '../utils/audio';
import { fireConfetti } from '../utils/confetti';
import { reportRoundLoss } from '../utils/luckyStreak';
import { ArrowLeft, Play, RotateCcw, HelpCircle, Zap } from 'lucide-react';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { RouletteWinModal } from '../components/RouletteWinModal';
import { ThreeDRoulette } from '../components/ThreeDRoulette';

interface AmericanRouletteProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'roulette-american', betAmount?: number) => void;
  onBackToLobby: () => void;
}

// 38 pockets in American Roulette sequence: 0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 00 (-1), 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2
// Represent 00 as -1 internally
const AMERICAN_WHEEL = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1,
  -1, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2
];

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
]);

function getNumberColor(num: number): 'green' | 'red' | 'black' {
  if (num === 0 || num === -1) return 'green';
  return RED_NUMBERS.has(num) ? 'red' : 'black';
}

function formatPocket(num: number): string {
  if (num === -1) return '00';
  return String(num);
}

type BetType = 
  | { kind: 'single'; number: number }
  | { kind: 'color'; color: 'red' | 'black' }
  | { kind: 'parity'; parity: 'even' | 'odd' }
  | { kind: 'range'; range: 'low' | 'high' }
  | { kind: 'dozen'; dozen: 1 | 2 | 3 };

interface PlacedBet {
  id: string;
  type: BetType;
  label: string;
  amount: number;
  multiplier: number;
}

export const AmericanRouletteGame: React.FC<AmericanRouletteProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby
}) => {
  const [selectedChip, setSelectedChip] = useState<number>(25);
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [ballRotation, setBallRotation] = useState<number>(0);
  const [history, setHistory] = useState<number[]>([17, -1, 0, 34, 22]);
  const [lastWinSummary, setLastWinSummary] = useState<{ won: boolean; totalWon: number; text: string } | null>(null);
  const [winningBetsList, setWinningBetsList] = useState<any[]>([]);
  const [isWinModalOpen, setIsWinModalOpen] = useState<boolean>(false);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [pressedChip, setPressedChip] = useState<number | null>(null);
  const [pressKey, setPressKey] = useState<number>(0);
  const [betWarning, setBetWarning] = useState<string | null>(null);

  const totalBetAmount = bets.reduce((sum, b) => sum + b.amount, 0);

  const showWarningMsg = (msg: string) => {
    setBetWarning(msg);
    soundManager.playLoss();
    window.setTimeout(() => setBetWarning((p) => (p === msg ? null : p)), 2600);
  };

  const handleAddChipValue = (val: number) => {
    if (isSpinning) return;
    setPressedChip(val);
    setPressKey((k) => k + 1);
    const remainingBalance = Math.max(0, balance - totalBetAmount);
    if (selectedChip + val > remainingBalance) {
      showWarningMsg(`Saldo insuficiente! Disponível para apostar: ${remainingBalance.toLocaleString('pt-BR')} fichas.`);
      return;
    }
    setBetWarning(null);
    soundManager.playChip();
    setSelectedChip((prev) => prev + val);
  };

  const handlePlaceBet = (type: BetType, label: string, multiplier: number) => {
    if (isSpinning) return;
    if (selectedChip <= 0) {
      showWarningMsg('Some suas fichas abaixo (+10, +25, +500...) antes de clicar na mesa!');
      return;
    }
    if (totalBetAmount + selectedChip > balance) {
      showWarningMsg(`Saldo insuficiente! Você possui ${balance.toLocaleString('pt-BR')} fichas.`);
      return;
    }
    setBetWarning(null);
    soundManager.playChip();

    setBets((prev) => {
      const existingIdx = prev.findIndex((b) => JSON.stringify(b.type) === JSON.stringify(type));
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].amount += selectedChip;
        return copy;
      }
      return [...prev, { id: `${Date.now()}-${Math.random()}`, type, label, amount: selectedChip, multiplier }];
    });
  };

  const clearBets = () => {
    if (isSpinning) return;
    soundManager.playClick();
    setBetWarning(null);
    setBets([]);
    setSelectedChip(0);
  };

  const drawnNumberRef = useRef<number>(0);

  const handleSpinComplete = () => {
    setIsSpinning(false);
    const drawnNumber = drawnNumberRef.current;
    setHistory((prev) => [drawnNumber, ...prev.slice(0, 9)]);

    let totalWon = 0;
    const detailedWins: any[] = [];

    for (const b of bets) {
      let isHit = false;
      switch (b.type.kind) {
        case 'single':
          if (b.type.number === drawnNumber) isHit = true;
          break;
        case 'color':
          if (drawnNumber > 0 && getNumberColor(drawnNumber) === b.type.color) isHit = true;
          break;
        case 'parity':
          if (drawnNumber > 0) {
            const isEven = drawnNumber % 2 === 0;
            if (b.type.parity === 'even' && isEven) isHit = true;
            if (b.type.parity === 'odd' && !isEven) isHit = true;
          }
          break;
        case 'range':
          if (drawnNumber > 0) {
            if (b.type.range === 'low' && drawnNumber >= 1 && drawnNumber <= 18) isHit = true;
            if (b.type.range === 'high' && drawnNumber >= 19 && drawnNumber <= 36) isHit = true;
          }
          break;
        case 'dozen':
          if (drawnNumber > 0) {
            if (b.type.dozen === 1 && drawnNumber >= 1 && drawnNumber <= 12) isHit = true;
            if (b.type.dozen === 2 && drawnNumber >= 13 && drawnNumber <= 24) isHit = true;
            if (b.type.dozen === 3 && drawnNumber >= 25 && drawnNumber <= 36) isHit = true;
          }
          break;
      }

      if (isHit) {
        const winAmount = b.amount + b.amount * b.multiplier;
        totalWon += winAmount;
        detailedWins.push({
          label: b.label,
          multiplier: b.multiplier,
          payoutMultiplierDisplay: b.multiplier + 1,
          amountBet: b.amount,
          winAmount
        });
      }
    }

    if (totalWon > 0) {
      fireConfetti(2600);
      onUpdateBalance(totalWon, true, 'roulette-american', totalBetAmount);
      setWinningBetsList(detailedWins);
      setIsWinModalOpen(true);
      setLastWinSummary({
        won: true,
        totalWon,
        text: `Número ${formatPocket(drawnNumber)} (${getNumberColor(drawnNumber) === 'red' ? 'Vermelho' : getNumberColor(drawnNumber) === 'green' ? 'Verde' : 'Preto'})! Vitória de ${totalWon} fichas!`
      });
    } else {
      soundManager.playLoss();
      reportRoundLoss('roulette-american');
      setWinningBetsList([]);
      setLastWinSummary({
        won: false,
        totalWon: 0,
        text: `Sorteado: ${formatPocket(drawnNumber)} (${getNumberColor(drawnNumber) === 'red' ? 'Vermelho' : getNumberColor(drawnNumber) === 'green' ? 'Verde' : 'Preto'}). Vantagem da Casa.`
      });
    }
  };

  const handleSpin = () => {
    if (isSpinning || bets.length === 0 || totalBetAmount > balance) return;

    // Pick winning pocket out of 38
    const randomIndex = Math.floor(Math.random() * AMERICAN_WHEEL.length);
    const drawnNumber = AMERICAN_WHEEL[randomIndex];
    drawnNumberRef.current = drawnNumber;

    onUpdateBalance(-totalBetAmount, false, 'roulette-american');
    setWinningNumber(drawnNumber);
    setIsSpinning(true);
    setLastWinSummary(null);
    setIsWinModalOpen(false);
  };

  return (
    <div className="space-y-1.5 max-w-6xl mx-auto animate-fade-in pb-1">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Lobby</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 hidden sm:inline">Últimos:</span>
            {history.slice(0, 5).map((num, idx) => (
              <span
                key={idx}
                className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow ${
                  getNumberColor(num) === 'red' ? 'bg-red-600' : getNumberColor(num) === 'green' ? 'bg-emerald-600' : 'bg-slate-900 border border-slate-700'
                }`}
              >
                {formatPocket(num)}
              </span>
            ))}
          </div>
          <span className="text-xs font-cinzel font-bold text-amber-400 uppercase tracking-wider hidden sm:inline">
            Roleta Americana (0 & 00)
          </span>
        </div>
      </div>

      {/* Main Wheel & Betting Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 items-start">
        {/* Left: Wheel */}
        <div className="lg:col-span-4 bg-[#180705] border border-orange-500/30 rounded-xl p-2 sm:p-2.5 flex flex-col items-center justify-center shadow-xl">
          <div className="relative flex items-center justify-center my-1">
            <ThreeDRoulette
              isAmerican={true}
              isSpinning={isSpinning}
              winningNumber={winningNumber}
              onSpinEnd={handleSpinComplete}
              size={185}
            />
          </div>

          {/* Outcome Indicator */}
          <div className="mt-2 text-center w-full">
            {winningNumber !== null ? (
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold block">
                  Número Sorteado
                </span>
                <div className="flex items-center justify-center gap-2">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-cinzel text-lg font-black text-white shadow border-2 ${
                      getNumberColor(winningNumber) === 'red'
                        ? 'bg-red-600 border-red-400'
                        : getNumberColor(winningNumber) === 'green'
                        ? 'bg-emerald-600 border-emerald-400'
                        : 'bg-slate-900 border-slate-600'
                    }`}
                  >
                    {formatPocket(winningNumber)}
                  </div>
                  <div className="text-left text-[11px] leading-tight">
                    <div className="font-bold text-white capitalize">
                      {getNumberColor(winningNumber) === 'red'
                        ? 'Vermelho'
                        : getNumberColor(winningNumber) === 'green'
                        ? 'Duplo Verde (0/00)'
                        : 'Preto'}
                    </div>
                    <span className="text-amber-400 font-mono text-[10px]">Vantagem da Casa: 5.26%</span>
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400">Escolha as apostas e gire</span>
            )}
          </div>
        </div>

        {/* Right: American Betting Grid */}
        <div className="lg:col-span-8 space-y-2">
          <div className="casino-felt border border-amber-500/30 rounded-xl p-2 sm:p-2.5 shadow-xl space-y-1.5">
            {/* Top row with 0 and 00 */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => handlePlaceBet({ kind: 'single', number: 0 }, 'Zero (0)', 35)}
                className="py-1 bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/40 rounded text-white font-bold text-xs shadow flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Zero (0) · 35:1</span>
              </button>
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => handlePlaceBet({ kind: 'single', number: -1 }, 'Duplo Zero (00)', 35)}
                className="py-1 bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/40 rounded text-white font-bold text-xs shadow flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Duplo Zero (00) · 35:1</span>
              </button>
            </div>

            {/* Quick 1-36 Numbers Sample Grid */}
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
              {Array.from({ length: 36 }, (_, i) => i + 1).map((num) => {
                const color = getNumberColor(num);
                return (
                  <button
                    key={num}
                    type="button"
                    disabled={isSpinning}
                    onClick={() => handlePlaceBet({ kind: 'single', number: num }, `Número ${num}`, 35)}
                    className={`h-6 sm:h-6.5 rounded text-[10px] font-bold text-white transition-all cursor-pointer flex items-center justify-center border ${
                      color === 'red'
                        ? 'bg-red-700 hover:bg-red-600 border-red-500/40'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-700'
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>

            {/* Outside Bets (Dozens, Red/Black, Even/Odd) */}
            <div className="grid grid-cols-3 gap-1 pt-1 border-t border-amber-500/20">
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => handlePlaceBet({ kind: 'dozen', dozen: 1 }, '1ª Dúzia (1-12)', 2)}
                className="py-1 bg-[#1a0805] hover:bg-[#280c08] border border-orange-500/30 rounded text-[10px] font-bold text-amber-300 cursor-pointer"
              >
                1ª Dúzia (2:1)
              </button>
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => handlePlaceBet({ kind: 'dozen', dozen: 2 }, '2ª Dúzia (13-24)', 2)}
                className="py-1 bg-[#1a0805] hover:bg-[#280c08] border border-orange-500/30 rounded text-[10px] font-bold text-amber-300 cursor-pointer"
              >
                2ª Dúzia (2:1)
              </button>
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => handlePlaceBet({ kind: 'dozen', dozen: 3 }, '3ª Dúzia (25-36)', 2)}
                className="py-1 bg-[#1a0805] hover:bg-[#280c08] border border-orange-500/30 rounded text-[10px] font-bold text-amber-300 cursor-pointer"
              >
                3ª Dúzia (2:1)
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => handlePlaceBet({ kind: 'color', color: 'red' }, 'Vermelho', 1)}
                className="py-1 bg-red-700 hover:bg-red-600 rounded text-[10px] font-bold text-white cursor-pointer shadow"
              >
                Vermelho (1:1)
              </button>
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => handlePlaceBet({ kind: 'color', color: 'black' }, 'Preto', 1)}
                className="py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-white cursor-pointer shadow"
              >
                Preto (1:1)
              </button>
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => handlePlaceBet({ kind: 'parity', parity: 'even' }, 'Par', 1)}
                className="py-1 bg-[#1a0805] hover:bg-[#280c08] border border-orange-500/30 rounded text-[10px] font-bold text-orange-200 cursor-pointer"
              >
                Par (1:1)
              </button>
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => handlePlaceBet({ kind: 'parity', parity: 'odd' }, 'Ímpar', 1)}
                className="py-1 bg-[#1a0805] hover:bg-[#280c08] border border-orange-500/30 rounded text-[10px] font-bold text-orange-200 cursor-pointer"
              >
                Ímpar (1:1)
              </button>
            </div>
          </div>

          {/* Chips & Action Row */}
          <div className="bg-[#180705] border border-orange-500/30 rounded-xl p-1.5 sm:p-2 space-y-1 shadow-xl">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-orange-300/80 font-bold mr-0.5">Somar Ficha:</span>
                {[10, 25, 50, 100, 500].map((val) => {
                  const isPressed = pressedChip === val;
                  return (
                    <button
                      key={isPressed ? `${val}-${pressKey}` : val}
                      type="button"
                      disabled={isSpinning}
                      onClick={() => handleAddChipValue(val)}
                      className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full text-[10px] font-black transition-transform active:scale-90 cursor-pointer bg-gradient-to-b from-amber-600 to-red-900 text-white border border-dashed border-amber-300 shadow ${
                        isPressed ? 'chip-press-anim' : ''
                      }`}
                      title={`Adicionar +${val} fichas`}
                    >
                      +{val}
                    </button>
                  );
                })}
                <span className="ml-1 px-2 py-0.5 rounded bg-[#120403] border border-amber-500/40 font-mono text-[11px] font-black text-amber-300">
                  Ficha: {selectedChip.toLocaleString('pt-BR')}
                </span>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  disabled={isSpinning || (bets.length === 0 && selectedChip === 0)}
                  onClick={clearBets}
                  className="px-2.5 py-1 rounded bg-[#260e0a] hover:bg-[#34130d] text-[10px] font-bold text-orange-200 border border-orange-500/20 disabled:opacity-40 cursor-pointer"
                >
                  Limpar
                </button>

                <div className="text-right">
                  <span className="text-[8px] text-orange-300/80 block uppercase leading-none font-bold">Aposta Atual</span>
                  <span className="font-mono text-xs font-extrabold text-amber-300 tabular-nums leading-tight">
                    {totalBetAmount.toLocaleString('pt-BR')} fichas
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isSpinning || bets.length === 0 || totalBetAmount > balance}
                  onClick={handleSpin}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs shadow-xl shadow-orange-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ml-1 border border-orange-300/40"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isSpinning ? 'Girando...' : 'Girar Roleta 🎡'}</span>
                </button>
              </div>
            </div>

            {betWarning && (
              <div className="px-2 py-0.5 rounded bg-red-950/90 border border-red-500/60 text-red-200 text-[10px] font-bold text-center">
                ⚠️ {betWarning}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Como Jogar Button */}
      <div className="pt-0.5 text-center">
        <button
          onClick={() => setShowHowToPlay(true)}
          className="inline-flex items-center gap-1 text-[11px] text-orange-300/70 hover:text-amber-300 transition-colors cursor-pointer py-0.5"
        >
          <HelpCircle className="w-3 h-3 text-orange-400" />
          <span>Regras & Como Jogar Roleta Americana</span>
        </button>
      </div>

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        gameId="roulette-american"
      />

      {winningNumber !== null && (
        <RouletteWinModal
          isOpen={isWinModalOpen}
          onClose={() => setIsWinModalOpen(false)}
          winningNumber={winningNumber === -1 ? 0 : winningNumber}
          numberColor={getNumberColor(winningNumber)}
          totalWon={lastWinSummary?.totalWon || 0}
          totalBet={totalBetAmount}
          winningBets={winningBetsList}
        />
      )}
    </div>
  );
};
