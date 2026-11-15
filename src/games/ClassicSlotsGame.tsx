import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { soundManager } from '../utils/audio';
import { reportRoundLoss } from '../utils/luckyStreak';
import { ChipSelector } from '../components/ChipSelector';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { ClassicSlotsVictoryOverlay } from '../components/ClassicSlotsVictoryOverlay';

interface ClassicSlotsGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'classic-slots', betAmount?: number) => void;
  onBackToLobby: () => void;
}

interface ClassicSymbol {
  id: 'SEVEN' | 'DIAMOND' | 'BAR' | 'BELL' | 'CHERRY' | 'SHOE';
  icon: string;
  label: string;
  mult3: number;
}

const SYMBOLS: ClassicSymbol[] = [
  { id: 'SEVEN', icon: '7️⃣', label: 'Sete', mult3: 200 },
  { id: 'DIAMOND', icon: '💎', label: 'Diamante', mult3: 100 },
  { id: 'BAR', icon: 'BAR', label: 'Bar', mult3: 50 },
  { id: 'BELL', icon: '🔔', label: 'Sino', mult3: 20 },
  { id: 'CHERRY', icon: '🍒', label: 'Cereja', mult3: 10 },
  { id: 'SHOE', icon: '🍀', label: 'Ferradura', mult3: 4 },
];

// Multiplicadores dobrados (200x a 2x) mantendo taxa de acerto 36,64% e RTP calibrado em 95,50%
const OUTCOMES = [
  { id: 'SEVEN', mult: 200, prob: 0.02, label: '3× Sete 7️⃣' },
  { id: 'DIAMOND', mult: 100, prob: 0.03, label: '3× Diamante 💎' },
  { id: 'BAR', mult: 50, prob: 0.06, label: '3× BAR' },
  { id: 'BELL', mult: 20, prob: 0.20, label: '3× Sino 🔔' },
  { id: 'CHERRY', mult: 10, prob: 0.50, label: '3× Cereja 🍒' },
  { id: 'SHOE', mult: 4, prob: 2.42, label: '3× Ferradura 🍀' },
  { id: 'CHERRY_2X', mult: 2, prob: 33.41, label: '2× Cereja 🍒' },
] as const;

const pickRandomIcon = (exclude: string[] = []): string => {
  const pool = SYMBOLS.map((s) => s.icon).filter((ic) => !exclude.includes(ic));
  return pool[Math.floor(Math.random() * pool.length)];
};

const rollOutcome = () => {
  const r = Math.random() * 100;
  let acc = 0;
  for (const o of OUTCOMES) {
    acc += o.prob;
    if (r < acc) return o;
  }
  return { id: 'LOSS' as const, mult: 0, prob: 63.36, label: 'Sem combinação' };
};

const buildCenterLine = (outcome: ReturnType<typeof rollOutcome>): [string, string, string] => {
  if (outcome.id === 'CHERRY_2X') {
    const nonCherry = pickRandomIcon(['🍒']);
    const line = ['🍒', '🍒', nonCherry];
    for (let i = line.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [line[i], line[j]] = [line[j], line[i]];
    }
    return [line[0], line[1], line[2]];
  }
  if (outcome.mult >= 2) {
    const found = SYMBOLS.find((s) => s.id === outcome.id);
    const ic = found ? found.icon : '🍀';
    return [ic, ic, ic];
  }
  const a = pickRandomIcon();
  const b = pickRandomIcon(a === '🍒' ? ['🍒'] : []);
  const excl: string[] = [];
  if (a === b) excl.push(a);
  if (a === '🍒' || b === '🍒') excl.push('🍒');
  const c = pickRandomIcon(excl);
  return [a, b, c];
};

const renderSymbol = (sym: string) => {
  if (sym === 'BAR') {
    return (
      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-800 border border-amber-100 text-[#1f0503] font-serif font-black text-sm sm:text-base tracking-widest shadow-[0_3px_0_#451a03,0_5px_10px_rgba(0,0,0,0.45)]">
        BAR
      </span>
    );
  }
  return (
    <span className="text-3xl sm:text-4xl leading-none select-none drop-shadow-[0_3px_2px_rgba(0,0,0,0.45)]">
      {sym}
    </span>
  );
};

export const ClassicSlotsGame: React.FC<ClassicSlotsGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby,
}) => {
  const [bet, setBet] = useState<number>(50);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [reels, setReels] = useState<string[][]>([
    ['🍒', '7️⃣', '🔔'],
    ['💎', '7️⃣', 'BAR'],
    ['🍀', '7️⃣', '🍒'],
  ]);
  const [winHighlight, setWinHighlight] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>(
    'Defina sua aposta nas fichas e gire as 3 roletas!'
  );
  const [statusTone, setStatusTone] = useState<'neutral' | 'win' | 'refund' | 'loss'>('neutral');
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [victoryOverlay, setVictoryOverlay] = useState<{
    open: boolean;
    amount: number;
    label: string;
    mult: number;
    betAmount: number;
  }>({ open: false, amount: 0, label: '', mult: 0, betAmount: 0 });

  const stripRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pendingWinRef = useRef<{ amount: number; betAmount: number } | null>(null);
  const onUpdateBalanceRef = useRef(onUpdateBalance);
  onUpdateBalanceRef.current = onUpdateBalance;

  const clearAllTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    return () => {
      clearAllTimers();
      if (pendingWinRef.current && pendingWinRef.current.amount > 0) {
        const pending = pendingWinRef.current;
        pendingWinRef.current = null;
        onUpdateBalanceRef.current(pending.amount, true, 'classic-slots', pending.betAmount);
      }
    };
  }, []);

  const handleSpin = () => {
    if (isSpinning || bet <= 0 || balance < bet) return;

    clearAllTimers();
    setIsSpinning(true);
    setWinHighlight(false);
    setStatusTone('neutral');
    setStatusMsg('Roletas girando... Boa sorte!');
    soundManager.playChip();
    onUpdateBalance(-bet, false, 'classic-slots', bet);

    const outcome = rollOutcome();
    const targetCenter = buildCenterLine(outcome);
    const nextReels = [0, 1, 2].map((col) => [
      pickRandomIcon([targetCenter[col]]),
      targetCenter[col],
      pickRandomIcon([targetCenter[col]]),
    ]);

    const stripLengths = [18, 24, 30];
    const stopDurations = [950, 1500, 2100];

    const newStrips: string[][] = [0, 1, 2].map((col) => {
      const total = stripLengths[col];
      const prevTail = reels[col].slice(-3);
      const nextHead = nextReels[col];
      const arr: string[] = [];
      for (let i = 0; i < total; i++) {
        if (i < 3) arr.push(nextHead[i]);
        else if (i >= total - 3) arr.push(prevTail[i - (total - 3)]);
        else arr.push(pickRandomIcon());
      }
      return arr;
    });

    setReels(newStrips);

    requestAnimationFrame(() => {
      [0, 1, 2].forEach((col) => {
        const el = stripRefs.current[col];
        if (!el) return;
        const firstCell = el.firstElementChild as HTMLElement | null;
        const cellH = firstCell ? firstCell.getBoundingClientRect().height : 56;
        const total = stripLengths[col];
        const startY = -(total - 3) * cellH;
        el.style.transition = 'none';
        el.style.transform = `translate3d(0, ${startY}px, 0)`;
        void el.offsetHeight;
        el.style.transition = `transform ${stopDurations[col]}ms cubic-bezier(0.12, 0.86, 0.22, 1)`;
        el.style.transform = 'translate3d(0, 0px, 0)';

        const tStop = setTimeout(() => {
          soundManager.playReelStop();
        }, stopDurations[col]);
        timersRef.current.push(tStop);
      });
    });

    const tDone = setTimeout(() => {
      setReels(nextReels);
      [0, 1, 2].forEach((col) => {
        const el = stripRefs.current[col];
        if (el) {
          el.style.transition = 'none';
          el.style.transform = 'translate3d(0, 0px, 0)';
        }
      });

      setIsSpinning(false);
      const winAmount = Math.round(bet * outcome.mult);

      if (winAmount > 0) {
        setWinHighlight(true);
        if (outcome.mult >= 2) {
          setStatusTone('win');
          setStatusMsg(`🎉 ${outcome.label}! +${winAmount.toLocaleString('pt-BR')} fichas (${outcome.mult}x)!`);
          soundManager.playJackpot();
          pendingWinRef.current = { amount: winAmount, betAmount: bet };
          setVictoryOverlay({
            open: true,
            amount: winAmount,
            label: outcome.label,
            mult: outcome.mult,
            betAmount: bet,
          });
        } else {
          onUpdateBalance(winAmount, true, 'classic-slots', bet);
          setStatusTone('refund');
          setStatusMsg(`🍒 ${outcome.label}: +${winAmount.toLocaleString('pt-BR')} fichas devolvidas!`);
          soundManager.playWin();
        }
      } else {
        soundManager.playLoss();
        reportRoundLoss('classic-slots');
        setStatusTone('loss');
        setStatusMsg('Sem combinação premiada na linha central. Tente novamente!');
      }
    }, 2200);

    timersRef.current.push(tDone);
  };

  return (
    <div className="h-full min-h-0 flex flex-col justify-between gap-1.5 overflow-hidden py-0.5 select-none">
      {/* Top Bar */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={onBackToLobby}
          className="px-2.5 py-1 rounded-lg bg-[#240b08] hover:bg-[#36110c] border border-orange-500/35 text-xs font-bold text-orange-200 flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Lobby</span>
        </button>

        <h1 className="font-cinzel font-black text-sm sm:text-base text-amber-300 tracking-wide flex items-center gap-1.5">
          <span>🎰</span>
          <span>CAÇA-NÍQUEL CLÁSSICO</span>
        </h1>

        <span className="text-[10px] sm:text-xs font-mono font-bold text-amber-200/90 tabular-nums">
          RTP 95,5% · 3 Roletas
        </span>
      </div>

      {/* Retro Las Vegas Machine Cabinet */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-between gap-2 p-2.5 sm:p-3 rounded-2xl bg-gradient-to-b from-[#5c0a0a] via-[#7f1313] to-[#260404] border-2 border-amber-400 shadow-[0_0_28px_rgba(245,158,11,0.28),inset_0_0_32px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Marquee */}
        <div className="shrink-0 w-full max-w-xl bg-gradient-to-r from-[#2b0606] via-[#63110d] to-[#2b0606] border border-amber-400/80 rounded-xl px-3 py-1 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-300 shadow-[0_0_6px_#fbbf24] animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse" />
          </div>
          <span className="font-cinzel font-black text-[11px] sm:text-xs tracking-[0.2em] text-yellow-300">
            LAS VEGAS CLASSIC 777
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-yellow-300 shadow-[0_0_6px_#fbbf24] animate-pulse" />
          </div>
        </div>

        {/* Paytable Strip */}
        <div className="shrink-0 w-full max-w-xl grid grid-cols-7 gap-1 bg-[#140303]/90 border border-amber-500/40 rounded-xl p-1">
          {[
            { sym: '3× 7️⃣', val: '200x', cls: 'text-yellow-300' },
            { sym: '3× 💎', val: '100x', cls: 'text-sky-300' },
            { sym: '3× BAR', val: '50x', cls: 'text-amber-300' },
            { sym: '3× 🔔', val: '20x', cls: 'text-orange-300' },
            { sym: '3× 🍒', val: '10x', cls: 'text-rose-300' },
            { sym: '3× 🍀', val: '4x', cls: 'text-emerald-300' },
            { sym: '2× 🍒', val: '2x', cls: 'text-slate-200' },
          ].map((item) => (
            <div
              key={item.sym}
              className="flex flex-col items-center justify-center py-1 px-0.5 rounded-lg bg-[#2a0806] border border-amber-500/20 text-[10px] font-bold tabular-nums"
            >
              <span className="text-amber-100 whitespace-nowrap">{item.sym}</span>
              <span className={`font-mono font-black ${item.cls}`}>{item.val}</span>
            </div>
          ))}
        </div>

        {/* 3 Reel Columns Window */}
        <div className="flex-1 min-h-0 w-full max-w-md flex items-center justify-center px-3">
          <div className="relative w-full bg-gradient-to-b from-[#1a0404] to-[#0a0101] border-[3px] border-amber-400 rounded-2xl p-2 grid grid-cols-3 gap-2 shadow-[0_12px_28px_rgba(0,0,0,0.85)]">
            <span className="absolute -left-3.5 top-1/2 -translate-y-1/2 text-yellow-300 text-base drop-shadow-[0_0_8px_rgba(251,191,36,0.9)] pointer-events-none z-10">
              ▶
            </span>
            <span className="absolute -right-3.5 top-1/2 -translate-y-1/2 text-yellow-300 text-base drop-shadow-[0_0_8px_rgba(251,191,36,0.9)] pointer-events-none z-10">
              ◀
            </span>

            {/* Center Payline Highlight */}
            <div
              className={`absolute left-1.5 right-1.5 top-1/2 -translate-y-1/2 h-14 rounded-lg pointer-events-none z-10 border-y-2 transition-all ${
                winHighlight
                  ? 'border-yellow-200 bg-amber-300/20 shadow-[0_0_24px_rgba(251,191,36,0.9)]'
                  : 'border-amber-400/80 bg-amber-400/10'
              }`}
            />

            {[0, 1, 2].map((col) => (
              <div
                key={col}
                className="relative h-[168px] overflow-hidden rounded-xl border border-amber-500 bg-gradient-to-b from-[#b8a389] via-[#ffffff] to-[#b8a389] shadow-[inset_0_14px_16px_rgba(0,0,0,0.45),inset_0_-14px_16px_rgba(0,0,0,0.45)]"
              >
                <div
                  ref={(el) => {
                    stripRefs.current[col] = el;
                  }}
                  className="flex flex-col will-change-transform"
                >
                  {reels[col].map((sym, idx) => (
                    <div
                      key={`${col}-${idx}`}
                      className="h-[56px] shrink-0 flex items-center justify-center"
                    >
                      {renderSymbol(sym)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status Text */}
        <div
          className={`shrink-0 text-xs font-extrabold text-center ${
            statusTone === 'win'
              ? 'text-emerald-400'
              : statusTone === 'refund'
              ? 'text-amber-300'
              : statusTone === 'loss'
              ? 'text-rose-300'
              : 'text-amber-100'
          }`}
        >
          {statusMsg}
        </div>
      </div>

      {/* Bottom Controls (Additive Chips + Spin CTA + Como Jogar) */}
      <div className="shrink-0 space-y-1.5">
        <ChipSelector
          currentBet={bet}
          balance={balance}
          onBetChange={setBet}
          disabled={isSpinning}
          showDouble={false}
          compact
        />

        <button
          type="button"
          disabled={isSpinning || bet <= 0 || balance < bet}
          onClick={handleSpin}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-cinzel font-black text-sm tracking-wider shadow-lg border border-yellow-200 cursor-pointer transition-all"
        >
          {isSpinning
            ? 'ROLETAS GIRANDO...'
            : `GIRAR ROLETAS (${bet.toLocaleString('pt-BR')} FICHAS) 🎰`}
        </button>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="text-[11px] font-bold text-amber-300/90 hover:text-amber-200 flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Como jogar Caça-Níquel Clássico</span>
          </button>
        </div>
      </div>

      {/* Exclusive Retro Las Vegas Victory Overlay (Only >= 2x) */}
      <ClassicSlotsVictoryOverlay
        isOpen={victoryOverlay.open}
        winAmount={victoryOverlay.amount}
        label={victoryOverlay.label}
        multiplier={victoryOverlay.mult}
        onCollect={() => {
          if (pendingWinRef.current && pendingWinRef.current.amount > 0) {
            const pending = pendingWinRef.current;
            pendingWinRef.current = null;
            onUpdateBalance(pending.amount, true, 'classic-slots', pending.betAmount);
          }
          setVictoryOverlay((prev) => ({ ...prev, open: false }));
        }}
      />

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        gameId="classic-slots"
      />
    </div>
  );
};
