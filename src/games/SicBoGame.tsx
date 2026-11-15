import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '../utils/audio';
import { reportRoundLoss } from '../utils/luckyStreak';
import { ArrowLeft, Play, Dices, HelpCircle } from 'lucide-react';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { ThreeDDice } from '../components/ThreeDDice';
import { ChipSelector } from '../components/ChipSelector';
import { DiceVictoryOverlay } from '../components/DiceVictoryOverlay';

interface SicBoGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'sicbo', betAmount?: number) => void;
  onBackToLobby: () => void;
}

type SicBoBetType = 'SMALL' | 'BIG' | 'EVEN' | 'ODD' | 'ANY_TRIPLE' | 'TRIPLE_6';

interface BetOption {
  type: SicBoBetType;
  label: string;
  payout: number;
  desc: string;
}

const SICBO_BETS: BetOption[] = [
  { type: 'SMALL', label: 'Pequeno (4 - 10)', payout: 1, desc: 'Soma de 4 a 10 (Trincas perdem) · 1:1' },
  { type: 'BIG', label: 'Grande (11 - 17)', payout: 1, desc: 'Soma de 11 a 17 (Trincas perdem) · 1:1' },
  { type: 'EVEN', label: 'Soma Par', payout: 1, desc: 'Soma final par · 1:1' },
  { type: 'ODD', label: 'Soma Ímpar', payout: 1, desc: 'Soma final ímpar · 1:1' },
  { type: 'ANY_TRIPLE', label: 'Qualquer Trinca', payout: 30, desc: '3 dados iguais (ex: 3-3-3) · 30:1' },
  { type: 'TRIPLE_6', label: 'Trinca Real (6-6-6)', payout: 150, desc: 'Trinca máxima 6-6-6 · 150:1' },
];

export const SicBoGame: React.FC<SicBoGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby
}) => {
  const [selectedBet, setSelectedBet] = useState<SicBoBetType>('SMALL');
  const [betAmount, setBetAmount] = useState<number>(25);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [dice, setDice] = useState<[number, number, number]>([2, 3, 4]);
  const [outcome, setOutcome] = useState<{ won: boolean; amount: number; message: string } | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [victoryOverlay, setVictoryOverlay] = useState<{
    open: boolean;
    amount: number;
    diceValues: number[];
    subtitle: string;
    reason: string;
  }>({ open: false, amount: 0, diceValues: [2, 3, 4], subtitle: '', reason: '' });

  const rollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rattleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingWinRef = useRef<{ amount: number; betAmount: number } | null>(null);
  const onUpdateBalanceRef = useRef(onUpdateBalance);
  onUpdateBalanceRef.current = onUpdateBalance;

  useEffect(() => {
    return () => {
      if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
      if (rattleIntervalRef.current) clearInterval(rattleIntervalRef.current);
      if (pendingWinRef.current && pendingWinRef.current.amount > 0) {
        const pending = pendingWinRef.current;
        pendingWinRef.current = null;
        onUpdateBalanceRef.current(pending.amount, true, 'sicbo', pending.betAmount);
      }
    };
  }, []);

  const sum = dice[0] + dice[1] + dice[2];

  const handleRoll = () => {
    if (isShaking || betAmount > balance || betAmount <= 0) return;

    const currentBet = betAmount;
    soundManager.playChip();
    setIsShaking(true);
    setOutcome(null);
    onUpdateBalance(-currentBet, false, 'sicbo', currentBet);

    // Pick 3 final dice
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const d3 = Math.floor(Math.random() * 6) + 1;
    const finalDice: [number, number, number] = [d1, d2, d3];
    setDice(finalDice);

    // Audio rattle ticks
    let tickCount = 0;
    if (rattleIntervalRef.current) clearInterval(rattleIntervalRef.current);
    rattleIntervalRef.current = setInterval(() => {
      soundManager.playDiceTick(1150 + tickCount * 30);
      tickCount++;
      if (tickCount >= 14 && rattleIntervalRef.current) {
        clearInterval(rattleIntervalRef.current);
        rattleIntervalRef.current = null;
      }
    }, 110);

    // After 1700ms, dice settle firmly
    if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    rollTimeoutRef.current = setTimeout(() => {
      rollTimeoutRef.current = null;
      finalizeSicBo(finalDice, currentBet);
    }, 1700);
  };

  const getSicBoClassification = (d1: number, d2: number, d3: number): string => {
    if (d1 === d2 && d2 === d3) return 'TRINCA';
    const total = d1 + d2 + d3;
    if (total >= 4 && total <= 10) return 'PEQUENO';
    if (total >= 11 && total <= 17) return 'GRANDE';
    return '';
  };

  const finalizeSicBo = (finalDice: [number, number, number], currentBet: number) => {
    const [d1, d2, d3] = finalDice;
    const total = d1 + d2 + d3;
    const isTriple = d1 === d2 && d2 === d3;
    const classification = getSicBoClassification(d1, d2, d3);
    const sumText = `${d1} + ${d2} + ${d3} ➔ Soma: ${total}`;

    setIsShaking(false);
    soundManager.playDiceThud();

    let isWin = false;
    let multiplier = 0;
    let text = '';

    switch (selectedBet) {
      case 'SMALL':
        if (!isTriple && total >= 4 && total <= 10) {
          isWin = true;
          multiplier = 1;
          text = `Vitória no PEQUENO! ${sumText} (PEQUENO)!`;
        } else if (isTriple) {
          text = `TRINCA (${d1}-${d2}-${d3})! ${sumText}. Casa vence Pequeno/Grande.`;
        } else {
          text = `${sumText} (GRANDE). Aposta Pequeno não premiada.`;
        }
        break;

      case 'BIG':
        if (!isTriple && total >= 11 && total <= 17) {
          isWin = true;
          multiplier = 1;
          text = `Vitória no GRANDE! ${sumText} (GRANDE)!`;
        } else if (isTriple) {
          text = `TRINCA (${d1}-${d2}-${d3})! ${sumText}. Casa vence Pequeno/Grande.`;
        } else {
          text = `${sumText} (PEQUENO). Aposta Grande não premiada.`;
        }
        break;

      case 'EVEN':
        if (!isTriple && total % 2 === 0) {
          isWin = true;
          multiplier = 1;
          text = `Vitória na Soma Par! ${sumText} (Par)!`;
        } else if (isTriple) {
          text = `TRINCA (${d1}-${d2}-${d3})! ${sumText}. Trincas perdem apostas externas.`;
        } else {
          text = `${sumText} (Ímpar). Aposta Par não premiada.`;
        }
        break;

      case 'ODD':
        if (!isTriple && total % 2 !== 0) {
          isWin = true;
          multiplier = 1;
          text = `Vitória na Soma Ímpar! ${sumText} (Ímpar)!`;
        } else if (isTriple) {
          text = `TRINCA (${d1}-${d2}-${d3})! ${sumText}. Trincas perdem apostas externas.`;
        } else {
          text = `${sumText} (Par). Aposta Ímpar não premiada.`;
        }
        break;

      case 'ANY_TRIPLE':
        if (isTriple) {
          isWin = true;
          multiplier = 30;
          text = `TRINCA IMPERIAL (${d1}-${d2}-${d3})! ${sumText}! Pagamento 30:1!`;
        } else {
          text = `${sumText} (${classification}). Sem trinca (${d1}-${d2}-${d3}).`;
        }
        break;

      case 'TRIPLE_6':
        if (isTriple && d1 === 6) {
          isWin = true;
          multiplier = 150;
          text = `JACKPOT TRINCA DE 6 (6-6-6)! ${sumText}! Pagamento 150:1!`;
        } else {
          text = `${sumText} (${classification}). Requer 6-6-6.`;
        }
        break;
    }

    if (isWin) {
      const winAmount = currentBet + currentBet * multiplier;
      setOutcome({ won: true, amount: winAmount, message: text });
      if (winAmount >= 2 * currentBet) {
        soundManager.playJackpot();
        pendingWinRef.current = { amount: winAmount, betAmount: currentBet };
        setVictoryOverlay({
          open: true,
          amount: winAmount,
          diceValues: [d1, d2, d3],
          subtitle: `SIC BO IMPERIAL · DADOS ${d1} · ${d2} · ${d3} (SOMA ${total})`,
          reason: text,
        });
      } else {
        soundManager.playWin();
        onUpdateBalance(winAmount, true, 'sicbo', currentBet);
      }
    } else {
      soundManager.playLoss();
      reportRoundLoss('sicbo');
      setOutcome({ won: false, amount: 0, message: text });
    }
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
          Sic Bo · Dados Imperial
        </span>
      </div>

      {/* Main Shaker Cup & 3 Dice Arena */}
      <div className="casino-felt border border-amber-500/30 rounded-xl p-2.5 sm:p-3 min-h-[175px] sm:min-h-[195px] flex flex-col justify-between shadow-xl relative overflow-hidden">
        {/* Info header */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-1 text-[11px] text-amber-300 font-cinzel font-bold">
            <Dices className="w-4 h-4 text-amber-400" />
            <span>Cúpula de 3 Dados</span>
          </div>
          <div className="px-2.5 py-0.5 rounded-lg bg-black/60 border border-amber-500/30 text-xs font-mono font-bold text-amber-300">
            {isShaking ? (
              <span>🎲 Agitando cúpula...</span>
            ) : (
              <>
                🎲 {dice[0]} + {dice[1]} + {dice[2]} ➔ Soma: <strong className="text-emerald-400 text-sm">{sum}</strong> {getSicBoClassification(dice[0], dice[1], dice[2]) ? `(${getSicBoClassification(dice[0], dice[1], dice[2])})` : ''}
              </>
            )}
          </div>
        </div>

        {/* 3 Dice Shaking Dome with 3D Realistic Dice & Individual Face Badges */}
        <div className="my-1 flex flex-col items-center justify-center z-10 gap-1.5">
          <ThreeDDice values={dice} isRolling={isShaking} variant="sicbo" />
          <div className="flex items-center justify-center gap-3 mt-0.5">
            {dice.map((d, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded bg-black/60 border border-amber-500/25 text-[10px] font-mono font-bold text-amber-200/90 shadow-sm"
              >
                Dado {i + 1}: <strong className="text-amber-400 text-xs">{isShaking ? '?' : d}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Outcome Display */}
        <div className="text-center min-h-[26px] z-10">
          {outcome && (
            <div
              className={`inline-block px-3 py-1 rounded-lg font-cinzel font-bold text-xs border shadow ${
                outcome.won
                  ? 'bg-emerald-900/90 text-amber-200 border-amber-400/70'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              {outcome.message} {outcome.won ? `(+${outcome.amount.toLocaleString('pt-BR')} fichas)` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Bets Selection Grid */}
      <div className="bg-[#180705] border border-orange-500/30 rounded-xl p-2 shadow-xl space-y-1.5">
        <span className="text-[10px] uppercase tracking-wider text-orange-300/80 font-bold block">
          Selecione a Aposta em Sic Bo:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {SICBO_BETS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              disabled={isShaking}
              onClick={() => {
                soundManager.playClick();
                setSelectedBet(opt.type);
              }}
              className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                selectedBet === opt.type
                  ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 text-amber-300'
                  : 'bg-[#240d09] border-orange-500/20 text-orange-200 hover:bg-[#30110c]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-cinzel">{opt.label}</span>
                <span className="text-[10px] font-mono text-amber-400 font-bold">{opt.payout}:1</span>
              </div>
              <span className="text-[9px] text-orange-300/60 block truncate">{opt.desc}</span>
            </button>
          ))}
        </div>

        {/* Chips and Action Row - Additive Chips */}
        <div className="pt-1 border-t border-orange-500/20 flex flex-col gap-1.5">
          <ChipSelector
            currentBet={betAmount}
            balance={balance}
            onBetChange={setBetAmount}
            disabled={isShaking}
            label="Aposta Atual:"
          />

          <button
            type="button"
            disabled={isShaking || betAmount > balance || betAmount <= 0}
            onClick={handleRoll}
            className="w-full px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs shadow-xl shadow-orange-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap border border-orange-300/40"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isShaking ? 'Agitando Cúpula...' : `Sacudir Dados (${betAmount.toLocaleString('pt-BR')} Fichas) 🎲`}</span>
          </button>
        </div>
      </div>

      {/* Como Jogar Button */}
      <div className="pt-0.5 text-center">
        <button
          onClick={() => setShowHowToPlay(true)}
          className="inline-flex items-center gap-1 text-[11px] text-orange-300/70 hover:text-amber-300 transition-colors cursor-pointer py-0.5"
        >
          <HelpCircle className="w-3 h-3 text-orange-400" />
          <span>Regras & Tabela de Pagamentos Sic Bo</span>
        </button>
      </div>

      {/* Exclusive 3D Dice Victory Overlay (Only >= 2x) */}
      <DiceVictoryOverlay
        isOpen={victoryOverlay.open}
        winAmount={victoryOverlay.amount}
        diceValues={victoryOverlay.diceValues}
        variant="sicbo"
        subtitle={victoryOverlay.subtitle}
        reason={victoryOverlay.reason}
        onCollect={() => {
          if (pendingWinRef.current && pendingWinRef.current.amount > 0) {
            const pending = pendingWinRef.current;
            pendingWinRef.current = null;
            onUpdateBalance(pending.amount, true, 'sicbo', pending.betAmount);
          }
          setVictoryOverlay((prev) => ({ ...prev, open: false }));
        }}
      />

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        gameId="sicbo"
      />
    </div>
  );
};
