import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '../utils/audio';
import { reportRoundLoss } from '../utils/luckyStreak';
import { ArrowLeft, Play, Dices, HelpCircle } from 'lucide-react';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { ThreeDDice } from '../components/ThreeDDice';
import { ChipSelector } from '../components/ChipSelector';
import { DiceVictoryOverlay } from '../components/DiceVictoryOverlay';

interface CrapsGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'craps', betAmount?: number) => void;
  onBackToLobby: () => void;
}

type CrapsBetType = 'PASS_LINE' | 'DONT_PASS' | 'FIELD' | 'ANY_7' | 'ANY_CRAPS' | 'HARD_8';

interface BetOption {
  type: CrapsBetType;
  label: string;
  payout: number; // multiplier on bet
  desc: string;
}

const BET_OPTIONS: BetOption[] = [
  { type: 'PASS_LINE', label: 'Pass Line', payout: 1, desc: 'Ganha no 7 ou 11 (Paga 1:1)' },
  { type: 'DONT_PASS', label: "Don't Pass", payout: 1, desc: 'Ganha no 2 ou 3 (Paga 1:1)' },
  { type: 'FIELD', label: 'Field (2,3,4,9,10,11,12)', payout: 1, desc: 'Paga 1:1 (ou 2:1 no 2 e 12)' },
  { type: 'ANY_7', label: 'Qualquer 7', payout: 4, desc: 'Soma 7 exata (Paga 4:1)' },
  { type: 'ANY_CRAPS', label: 'Craps (2, 3, 12)', payout: 7, desc: 'Soma 2, 3 ou 12 (Paga 7:1)' },
  { type: 'HARD_8', label: 'Hard 8 (4 + 4)', payout: 9, desc: 'Dois 4 idênticos (Paga 9:1)' },
];

export const CrapsGame: React.FC<CrapsGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby
}) => {
  const [selectedBet, setSelectedBet] = useState<CrapsBetType>('PASS_LINE');
  const [betAmount, setBetAmount] = useState<number>(25);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [die1, setDie1] = useState<number>(3);
  const [die2, setDie2] = useState<number>(4);
  const [lastSum, setLastSum] = useState<number | null>(7);
  const [outcome, setOutcome] = useState<{ won: boolean; amount: number; message: string } | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [victoryOverlay, setVictoryOverlay] = useState<{
    open: boolean;
    amount: number;
    diceValues: number[];
    subtitle: string;
    reason: string;
  }>({ open: false, amount: 0, diceValues: [3, 4], subtitle: '', reason: '' });

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
        onUpdateBalanceRef.current(pending.amount, true, 'craps', pending.betAmount);
      }
    };
  }, []);

  const handleRoll = () => {
    if (isRolling || betAmount > balance || betAmount <= 0) return;

    const currentBet = betAmount;
    soundManager.playChip();
    setIsRolling(true);
    setOutcome(null);
    onUpdateBalance(-currentBet, false, 'craps', currentBet);

    // Pick final random dice outcome
    const final1 = Math.floor(Math.random() * 6) + 1;
    const final2 = Math.floor(Math.random() * 6) + 1;
    setDie1(final1);
    setDie2(final2);

    // Dynamic rattling audio during the 1.7s tumble
    let tickCount = 0;
    if (rattleIntervalRef.current) clearInterval(rattleIntervalRef.current);
    rattleIntervalRef.current = setInterval(() => {
      soundManager.playDiceTick(1100 + tickCount * 30);
      tickCount++;
      if (tickCount >= 14 && rattleIntervalRef.current) {
        clearInterval(rattleIntervalRef.current);
        rattleIntervalRef.current = null;
      }
    }, 110);

    // After 1700ms, dice settle firmly on the table
    if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    rollTimeoutRef.current = setTimeout(() => {
      rollTimeoutRef.current = null;
      finalizeRoll(final1, final2, currentBet);
    }, 1700);
  };

  const finalizeRoll = (final1: number, final2: number, currentBet: number) => {
    const sum = final1 + final2;

    setLastSum(sum);
    setIsRolling(false);
    soundManager.playDiceThud();

    let isWin = false;
    let multiplier = 0;
    let reason = '';

    switch (selectedBet) {
      case 'PASS_LINE':
        if (sum === 7 || sum === 11) {
          isWin = true;
          multiplier = 1;
          reason = `Natural ${sum}! Vitória no Pass Line!`;
        } else if (sum === 2 || sum === 3 || sum === 12) {
          reason = `Craps ${sum}! Casa vence no Pass Line.`;
        } else {
          // Point roll simulation: house holds 60% edge on second stage
          isWin = Math.random() < 0.42;
          multiplier = 1;
          reason = isWin ? `Ponto ${sum} completado!` : `Saiu 7 antes do ponto ${sum}.`;
        }
        break;

      case 'DONT_PASS':
        if (sum === 2 || sum === 3) {
          isWin = true;
          multiplier = 1;
          reason = `Craps ${sum}! Vitória no Don't Pass!`;
        } else if (sum === 7 || sum === 11) {
          reason = `Natural ${sum}! Casa vence.`;
        } else if (sum === 12) {
          // Push on 12
          isWin = true;
          multiplier = 0; // return original
          reason = `12! Empate (Push). Fichas devolvidas.`;
        } else {
          isWin = Math.random() < 0.48;
          multiplier = 1;
          reason = isWin ? `Casa perdeu o ponto!` : `Ponto foi feito pela mesa.`;
        }
        break;

      case 'FIELD':
        if ([3, 4, 9, 10, 11].includes(sum)) {
          isWin = true;
          multiplier = 1;
          reason = `Field ${sum}! Pagamento 1:1.`;
        } else if (sum === 2 || sum === 12) {
          isWin = true;
          multiplier = 2; // double pay
          reason = `Double Field ${sum}! Pagamento 2:1!`;
        } else {
          reason = `Soma ${sum} fora do Field (5, 6, 7, 8 perdem).`;
        }
        break;

      case 'ANY_7':
        if (sum === 7) {
          isWin = true;
          multiplier = 4;
          reason = `Sete de Ouro! Paga 4:1!`;
        } else {
          reason = `Soma deu ${sum} (Apenas 7 vence).`;
        }
        break;

      case 'ANY_CRAPS':
        if (sum === 2 || sum === 3 || sum === 12) {
          isWin = true;
          multiplier = 7;
          reason = `Craps Especial (${sum})! Paga 7:1!`;
        } else {
          reason = `Soma deu ${sum} (Apenas 2, 3 ou 12 vencem).`;
        }
        break;

      case 'HARD_8':
        if (final1 === 4 && final2 === 4) {
          isWin = true;
          multiplier = 9;
          reason = `Hard 8 (4 + 4)! Prêmio Máximo 9:1!`;
        } else {
          reason = `Deu ${final1}+${final2}=${sum}. Hard 8 requer 4+4.`;
        }
        break;
    }

    if (isWin) {
      const returnAmount = currentBet + currentBet * multiplier;
      setOutcome({ won: true, amount: returnAmount, message: reason });
      if (returnAmount >= 2 * currentBet) {
        soundManager.playJackpot();
        pendingWinRef.current = { amount: returnAmount, betAmount: currentBet };
        setVictoryOverlay({
          open: true,
          amount: returnAmount,
          diceValues: [final1, final2],
          subtitle: `CRAPS VEGAS · DADOS ${final1} + ${final2} = ${sum}`,
          reason,
        });
      } else {
        soundManager.playWin();
        onUpdateBalance(returnAmount, true, 'craps', currentBet);
      }
    } else {
      soundManager.playLoss();
      reportRoundLoss('craps');
      setOutcome({ won: false, amount: 0, message: reason });
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
          Craps · Dados de Cassino
        </span>
      </div>

      {/* Main Craps Table Felt & 3D Dice Stage */}
      <div className="casino-felt border border-amber-500/30 rounded-xl p-2.5 sm:p-3 min-h-[175px] sm:min-h-[195px] flex flex-col justify-between shadow-xl relative overflow-hidden">
        {/* Top Info Bar */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-1 text-[11px] text-amber-300 font-cinzel font-bold">
            <Dices className="w-4 h-4 text-amber-400" />
            <span>Mesa de Craps Clássica</span>
          </div>
          {lastSum !== null && (
            <div className="px-2.5 py-0.5 rounded-lg bg-black/60 border border-amber-500/30 text-xs font-mono font-bold text-amber-300">
              {isRolling ? (
                <span>🎲 Rolando dados...</span>
              ) : (
                <>
                  🎲 D1: <span className="text-amber-400">{die1}</span>, D2: <span className="text-amber-400">{die2}</span> ➔ Soma Exata: <strong className="text-emerald-400 text-sm ml-1">{die1 + die2}</strong>
                </>
              )}
            </div>
          )}
        </div>

        {/* 3D Dice Rolling Arena */}
        <div className="my-1 flex items-center justify-center z-10">
          <ThreeDDice values={[die1, die2]} isRolling={isRolling} variant="craps" />
        </div>

        {/* Outcome Feedback */}
        <div className="text-center min-h-[26px] z-10">
          {outcome && (
            <div
              className={`inline-block px-3 py-1 rounded-lg font-cinzel font-bold text-xs border shadow-lg ${
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

      {/* Betting Options Grid */}
      <div className="bg-[#180705] border border-orange-500/30 rounded-xl p-2 shadow-xl space-y-1.5">
        <span className="text-[10px] uppercase tracking-wider text-orange-300/80 font-bold block">
          Escolha sua Aposta:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {BET_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              disabled={isRolling}
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
            disabled={isRolling}
            label="Aposta Atual:"
          />

          <button
            type="button"
            disabled={isRolling || betAmount > balance || betAmount <= 0}
            onClick={handleRoll}
            className="w-full px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs shadow-xl shadow-orange-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap border border-orange-300/40"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isRolling ? 'Rolando Dados...' : `Rolar Dados (${betAmount.toLocaleString('pt-BR')} Fichas) 🎲`}</span>
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
          <span>Regras & Como Jogar Craps</span>
        </button>
      </div>

      {/* Exclusive 3D Dice Victory Overlay (Only >= 2x) */}
      <DiceVictoryOverlay
        isOpen={victoryOverlay.open}
        winAmount={victoryOverlay.amount}
        diceValues={victoryOverlay.diceValues}
        variant="craps"
        subtitle={victoryOverlay.subtitle}
        reason={victoryOverlay.reason}
        onCollect={() => {
          if (pendingWinRef.current && pendingWinRef.current.amount > 0) {
            const pending = pendingWinRef.current;
            pendingWinRef.current = null;
            onUpdateBalance(pending.amount, true, 'craps', pending.betAmount);
          }
          setVictoryOverlay((prev) => ({ ...prev, open: false }));
        }}
      />

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        gameId="craps"
      />
    </div>
  );
};
