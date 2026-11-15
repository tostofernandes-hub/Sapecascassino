import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { soundManager } from '../utils/audio';
import { reportRoundLoss } from '../utils/luckyStreak';
import { ChipSelector } from '../components/ChipSelector';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { DragonEggVictoryOverlay } from '../components/DragonEggVictoryOverlay';

interface DragonEggGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'dragon-egg', betAmount?: number) => void;
  onBackToLobby: () => void;
}

type EggContent = 'dragon' | 'snake';
type EggAnimPhase = 'idle' | 'shaking' | 'hatching' | 'revealed';

interface RoundConfig {
  round: number;
  totalEggs: number;
  dragons: number;
  snakes: number;
  mult: number;
  chancePct: number;
}

// Progressão oficial de rodadas e multiplicadores:
// R1 e R2: 5 ovos (3 Dragões, 2 Cobras) -> 1.5x (R1) e 2.5x (R2)
// R3: 5 ovos (2 Dragões, 3 Cobras) -> 4x
// R4+: 4 ovos (1 Dragão, 3 Cobras) -> 6x, 10x, 15x, 25x...
const DRAGON_MULT_TABLE = [1.5, 2.5, 4, 6, 10, 15, 25, 40, 60];

const getRoundConfig = (roundNum: number): RoundConfig => {
  const r = Math.max(1, roundNum);
  const mult =
    r <= DRAGON_MULT_TABLE.length
      ? DRAGON_MULT_TABLE[r - 1]
      : 60 + (r - DRAGON_MULT_TABLE.length) * 25;

  if (r === 1 || r === 2) {
    return { round: r, totalEggs: 5, dragons: 3, snakes: 2, mult, chancePct: 60 };
  }
  if (r === 3) {
    return { round: r, totalEggs: 5, dragons: 2, snakes: 3, mult, chancePct: 40 };
  }
  return { round: r, totalEggs: 4, dragons: 1, snakes: 3, mult, chancePct: 25 };
};

const buildRoundBoard = (roundNum: number): EggContent[] => {
  const cfg = getRoundConfig(roundNum);
  const board: EggContent[] = [
    ...Array<EggContent>(cfg.dragons).fill('dragon'),
    ...Array<EggContent>(cfg.snakes).fill('snake')
  ];
  for (let i = board.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [board[i], board[j]] = [board[j], board[i]];
  }
  return board;
};

export const DragonEggGame: React.FC<DragonEggGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby
}) => {
  const [bet, setBet] = useState(50);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeBet, setActiveBet] = useState(0);
  const [round, setRound] = useState(1);
  const [mult, setMult] = useState(1);
  const [board, setBoard] = useState<EggContent[]>(() => buildRoundBoard(1));
  const [pickedIdx, setPickedIdx] = useState(-1);
  const [crackingIdx, setCrackingIdx] = useState(-1);
  const [animPhase, setAnimPhase] = useState<EggAnimPhase>('idle');
  const [outcome, setOutcome] = useState<EggContent | null>(null);
  const [statusMsg, setStatusMsg] = useState('Rodada 1 (3🐉 / 2🐍): escolha um dos 5 ovos brilhantes!');
  const [statusTone, setStatusTone] = useState<'neutral' | 'warn' | 'win' | 'loss'>('neutral');
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [victoryOverlay, setVictoryOverlay] = useState<{ open: boolean; amount: number; mult: number; round: number }>({
    open: false,
    amount: 0,
    mult: 1,
    round: 1
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fireRafRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => {
    return () => {
      if (fireRafRef.current) cancelAnimationFrame(fireRafRef.current);
      clearTimers();
    };
  }, []);

  const launchFireBreath = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = rect.width / 2;
    const cy = rect.height * 0.56;
    const particles = Array.from({ length: 48 }, () => {
      const angle = -Math.PI + Math.random() * Math.PI * 1.4 - Math.PI * 0.2;
      const speed = 1.8 + Math.random() * 4.8;
      return {
        x: cx + (Math.random() - 0.5) * 40,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        size: 4 + Math.random() * 8,
        life: 1,
        color: ['#fef08a', '#f59e0b', '#ea580c', '#ef4444'][Math.floor(Math.random() * 4)]
      };
    });

    if (fireRafRef.current) cancelAnimationFrame(fireRafRef.current);
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.04;
        p.life -= 0.025;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, p.size * p.life), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (alive) {
        fireRafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        fireRafRef.current = null;
      }
    };
    fireRafRef.current = requestAnimationFrame(tick);
  };

  const handleEggClick = (eggIdx: number) => {
    if (busy) return;
    if (active && outcome === 'dragon') return;
    clearTimers();

    let currentStake = activeBet;
    let currentRound = round;
    let currentBoard = board;

    if (!active) {
      if (bet <= 0 || balance < bet) return;
      currentStake = bet;
      currentRound = 1;
      currentBoard = buildRoundBoard(1);
      onUpdateBalance(-bet, false, 'dragon-egg', bet);
      setActiveBet(bet);
      setActive(true);
      setRound(1);
      setMult(1);
      setBoard(currentBoard);
      setStatusMsg('Rodada 1: o ovo está tremendo e rachando em 3D...');
    } else {
      setStatusMsg(`Rodada ${currentRound}: o ovo está tremendo e rachando em 3D...`);
    }

    setBusy(true);
    setCrackingIdx(eggIdx);
    setPickedIdx(-1);
    setOutcome(null);
    setAnimPhase('shaking');
    setStatusTone('warn');
    soundManager.playChip();

    const result: EggContent = currentBoard[eggIdx] ?? 'snake';
    const cfg = getRoundConfig(currentRound);

    // Fase 1 (0 -> 200ms): Tremor 3D por 0,2s -> Fase 2 (200ms -> 500ms): Rachadura e abertura em 0,3s (0,5s exatos)
    const tHatch = window.setTimeout(() => {
      setCrackingIdx(-1);
      setPickedIdx(eggIdx);
      setOutcome(result);
      setAnimPhase('hatching');
      soundManager.playClick();
      if (result === 'dragon') {
        launchFireBreath();
      }
    }, 200);

    // Fase 3 (500ms = 0,5s exatos): Conclusão clara
    const tResolve = window.setTimeout(() => {
      setBusy(false);
      setAnimPhase('revealed');

      if (result === 'dragon') {
        const pot = Math.round(currentStake * cfg.mult);
        const nextCfg = getRoundConfig(currentRound + 1);
        setMult(cfg.mult);
        setStatusTone('win');
        setStatusMsg(
          `🐉 DRAGÃO NA RODADA ${cfg.round}! (${cfg.mult}x · ${pot.toLocaleString('pt-BR')} fichas) Sacar ou ir p/ R${nextCfg.round} (${nextCfg.mult}x)?`
        );
        soundManager.playWin();
      } else {
        setActive(false);
        setStatusTone('loss');
        setStatusMsg(`🐍 Cobra na Rodada ${cfg.round}! A aposta foi perdida e o ninho reinicia.`);
        soundManager.playLoss();
        reportRoundLoss('dragon-egg');

        const tReset = window.setTimeout(() => {
          setPickedIdx(-1);
          setCrackingIdx(-1);
          setOutcome(null);
          setAnimPhase('idle');
          setRound(1);
          setMult(1);
          setActiveBet(0);
          setBoard(buildRoundBoard(1));
          setStatusTone('neutral');
          setStatusMsg('Rodada 1 (3🐉 / 2🐍): escolha um dos 5 ovos brilhantes!');
        }, 1250);
        timersRef.current.push(tReset);
      }
    }, 500);

    timersRef.current.push(tHatch, tResolve);
  };

  const handleContinue = () => {
    if (!active || busy || outcome !== 'dragon') return;
    const nextRound = round + 1;
    const nextCfg = getRoundConfig(nextRound);
    setRound(nextRound);
    setBoard(buildRoundBoard(nextRound));
    setPickedIdx(-1);
    setCrackingIdx(-1);
    setOutcome(null);
    setAnimPhase('idle');
    setStatusTone('warn');
    setStatusMsg(
      `🔥 Rodada ${nextCfg.round} (${nextCfg.totalEggs} ovos: ${nextCfg.dragons}🐉 / ${nextCfg.snakes}🐍): escolha 1 ovo por ${nextCfg.mult}x!`
    );
    soundManager.playClick();
  };

  const handleCashOut = () => {
    if (!active || busy || outcome !== 'dragon') return;
    const payout = Math.round(activeBet * mult);
    const roundReached = round;
    const winMult = mult;
    onUpdateBalance(payout, true, 'dragon-egg', activeBet);

    setActive(false);
    setBusy(false);
    setPickedIdx(-1);
    setCrackingIdx(-1);
    setOutcome(null);
    setAnimPhase('idle');
    setRound(1);
    setMult(1);
    setActiveBet(0);
    setBoard(buildRoundBoard(1));
    setStatusTone('win');
    setStatusMsg(
      `🏆 Prêmio recolhido (${winMult}x): +${payout.toLocaleString('pt-BR')} fichas! Clique em um ovo para jogar novamente.`
    );

    if (payout > 0) {
      if (winMult >= 2) soundManager.playMultiplierHit();
      else soundManager.playWin();
      setVictoryOverlay({
        open: true,
        amount: payout,
        mult: winMult,
        round: roundReached
      });
    }
  };

  const cfg = getRoundConfig(round);
  const nextCfg = getRoundConfig(round + 1);
  const currentPot = active ? Math.round(activeBet * mult) : 0;

  return (
    <div className="h-full min-h-0 flex flex-col justify-between gap-1.5 overflow-hidden py-0.5 select-none">
      {/* Top Bar */}
      <div className="shrink-0 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            clearTimers();
            onBackToLobby();
          }}
          className="px-2.5 py-1 rounded-lg bg-[#250d09] hover:bg-[#38140d] border border-orange-500/35 text-orange-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Lobby</span>
        </button>

        <h1 className="font-cinzel font-black text-xs sm:text-sm text-amber-400 tracking-wide">
          🥚 OVO DO DRAGÃO SAPECA
        </h1>

        <span className="text-[10px] font-bold text-purple-200 bg-purple-950/70 border border-purple-500/30 px-2 py-0.5 rounded-md tabular-nums">
          RODADA {cfg.round} · {cfg.totalEggs} OVOS ({cfg.dragons}🐉/{cfg.snakes}🐍)
        </span>
      </div>

      {/* Dark Cavern Nest Arena */}
      <div
        className={`relative flex-1 min-h-0 rounded-2xl border-2 p-2.5 sm:p-3 flex flex-col justify-between overflow-hidden shadow-2xl ${
          outcome === 'snake' && animPhase === 'revealed'
            ? 'border-rose-500/70 bg-[#1a0508]'
            : 'border-purple-500/40 bg-[radial-gradient(circle_at_50%_62%,rgba(180,83,9,0.25)_0%,rgba(88,28,135,0.28)_42%,#09030e_88%,#040107_100%)]'
        }`}
      >
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 w-full h-full z-20" />

        {/* HUD */}
        <div className="relative z-10 grid grid-cols-3 gap-2 shrink-0">
          <div className="bg-[#0f0603]/85 border border-purple-500/35 rounded-lg px-2.5 py-1">
            <span className="block text-[9px] font-extrabold uppercase text-purple-300/80">Ninho Atual</span>
            <strong className="font-mono text-xs sm:text-sm font-black text-amber-300 tabular-nums">
              R{cfg.round}: {cfg.dragons}🐉 / {cfg.snakes}🐍 ({cfg.chancePct}%)
            </strong>
          </div>
          <div className="bg-[#0f0603]/85 border border-purple-500/35 rounded-lg px-2.5 py-1">
            <span className="block text-[9px] font-extrabold uppercase text-purple-300/80">Multiplicador</span>
            <strong className="font-mono text-xs sm:text-sm font-black text-yellow-300 tabular-nums">
              {outcome === 'dragon' && animPhase === 'revealed' ? `${mult}x` : `${cfg.mult}x (R${cfg.round})`}
            </strong>
          </div>
          <div className="bg-[#0f0603]/85 border border-purple-500/35 rounded-lg px-2.5 py-1">
            <span className="block text-[9px] font-extrabold uppercase text-purple-300/80">Prêmio Atual</span>
            <strong className="font-mono text-xs sm:text-sm font-black text-emerald-400 tabular-nums">
              {currentPot.toLocaleString('pt-BR')} 🪙
            </strong>
          </div>
        </div>

        {/* Nest with Dynamic 3D Eggs (5 in R1-R3, 4 in R4+) */}
        <div className="relative z-10 flex-1 min-h-0 flex items-center justify-center">
          <div className="egg-nest-3d flex items-center justify-center gap-2 sm:gap-4 px-4 sm:px-7 py-4 rounded-full bg-[radial-gradient(ellipse_at_50%_65%,#451a03_0%,#290e04_60%,#140602_100%)] border-2 border-amber-500/45 shadow-[inset_0_-6px_16px_rgba(0,0,0,0.8),0_10px_28px_rgba(0,0,0,0.75)] max-w-full">
            {board.map((eggContent, idx) => {
              const isShaking = animPhase === 'shaking' && crackingIdx === idx;
              const isPicked = pickedIdx === idx;
              const isHatching = isPicked && animPhase === 'hatching';
              const isDragon = isPicked && outcome === 'dragon';
              const isSnake = isPicked && outcome === 'snake';
              const isDimmed = pickedIdx !== -1 && !isPicked && animPhase === 'revealed';
              const isIdle = !isShaking && !isPicked && !isDimmed && !busy;
              const waitingChoice = active && outcome === 'dragon';
              const disabled = busy || waitingChoice || (pickedIdx !== -1 && outcome === 'snake');
              const showPeekOnLoss = isDimmed && outcome === 'snake';

              return (
                <button
                  key={`${round}-${idx}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleEggClick(idx)}
                  aria-label={`Ovo ${idx + 1}`}
                  style={{
                    borderRadius: '50% 50% 48% 48% / 62% 62% 38% 38%',
                    animationDelay: isIdle ? `${idx * 0.28}s` : undefined
                  }}
                  className={`egg-slot-3d relative w-12 h-16 sm:w-16 sm:h-22 border-2 flex flex-col items-center justify-center cursor-pointer disabled:cursor-not-allowed ${
                    isDragon
                      ? 'bg-[radial-gradient(circle_at_50%_35%,#fef08a_0%,#ea580c_55%,#7c2d12_100%)] border-yellow-300 scale-110 shadow-[0_0_28px_rgba(251,191,36,0.95)]'
                      : isSnake
                      ? 'bg-[radial-gradient(circle_at_50%_35%,#4ade80_0%,#166534_55%,#052e16_100%)] border-rose-400 shadow-[0_0_22px_rgba(239,68,68,0.75)]'
                      : 'bg-[radial-gradient(circle_at_32%_28%,#fef08a_0%,#f59e0b_28%,#9333ea_74%,#3b0764_100%)] border-yellow-200/80 shadow-[0_6px_14px_rgba(0,0,0,0.7),0_0_16px_rgba(245,158,11,0.45)] hover:-translate-y-1 hover:scale-105'
                  } ${isIdle ? 'egg-slot-3d-idle' : ''} ${isShaking ? 'egg-slot-3d-shaking' : ''} ${isDimmed ? 'opacity-45 saturate-50' : ''}`}
                >
                  {isIdle && (
                    <span
                      className="egg-shimmer-overlay"
                      style={{ '--egg-shimmer-delay': `${idx * 0.45}s` } as React.CSSProperties}
                      aria-hidden="true"
                    />
                  )}
                  {isShaking && (
                    <svg viewBox="0 0 60 80" className="egg-crack-glow-overlay w-full h-full">
                      <path
                        d="M30 8 L24 26 L36 38 L22 54 L32 72"
                        fill="none"
                        stroke="#fde047"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14 34 L28 38 L46 30"
                        fill="none"
                        stroke="#fb923c"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}

                  {isHatching && (
                    <>
                      <span className="egg-shard egg-shard-tl" />
                      <span className="egg-shard egg-shard-tr" />
                      <span className="egg-shard egg-shard-bl" />
                      <span className="egg-shard egg-shard-br" />
                      <span className="egg-smoke-puff" />
                      <span className="egg-smoke-puff alt" />
                    </>
                  )}

                  {isDragon ? (
                    <div className={isHatching ? 'egg-dragon-reveal-3d' : 'flex flex-col items-center'}>
                      <span className="text-2xl sm:text-3xl">🐉</span>
                      <span className="text-[10px] font-mono font-black text-yellow-200">{cfg.mult}x</span>
                    </div>
                  ) : isSnake ? (
                    <div className={isHatching ? 'egg-snake-lunge-3d' : 'flex flex-col items-center'}>
                      <span className="text-2xl sm:text-3xl">🐍</span>
                      <span className="text-[10px] font-mono font-black text-rose-200">0x</span>
                    </div>
                  ) : showPeekOnLoss ? (
                    <span className="text-xl sm:text-2xl opacity-80">
                      {eggContent === 'dragon' ? '🐉' : '🐍'}
                    </span>
                  ) : (
                    <span className="text-2xl sm:text-3xl drop-shadow">🥚</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Message */}
        <div
          className={`relative z-10 shrink-0 text-center text-xs font-extrabold ${
            statusTone === 'win'
              ? 'text-emerald-400'
              : statusTone === 'loss'
              ? 'text-rose-300'
              : statusTone === 'warn'
              ? 'text-yellow-300'
              : 'text-amber-100'
          }`}
        >
          {statusMsg}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="shrink-0 space-y-1.5">
        <ChipSelector
          currentBet={bet}
          balance={balance}
          onBetChange={setBet}
          disabled={active || busy}
          showDouble={false}
          compact
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!active || busy || outcome !== 'dragon'}
            onClick={handleCashOut}
            className="py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-700 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-cinzel font-black text-xs sm:text-sm tracking-wide shadow-lg border border-emerald-300/70 cursor-pointer transition-all"
          >
            {currentPot > 0 ? `SACAR (+${currentPot.toLocaleString('pt-BR')} 🪙)` : 'SACAR (0)'}
          </button>

          <button
            type="button"
            disabled={!active || busy || outcome !== 'dragon'}
            onClick={handleContinue}
            className="py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-cinzel font-black text-xs sm:text-sm tracking-wide shadow-lg border border-yellow-200 cursor-pointer transition-all"
          >
            {active && outcome === 'dragon' && !busy
              ? `CONTINUAR R${nextCfg.round} (${nextCfg.mult}x · ${nextCfg.dragons}/${nextCfg.totalEggs} 🐉)`
              : active
              ? `RODADA ${round}: ESCOLHA 1 OVO 🥚`
              : 'CLIQUE EM UM OVO PARA CHOCAR 🥚'}
          </button>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="text-[11px] font-bold text-amber-300/90 hover:text-amber-200 flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Como jogar Ovo do Dragão Sapeca</span>
          </button>
        </div>
      </div>

      <DragonEggVictoryOverlay
        isOpen={victoryOverlay.open}
        winAmount={victoryOverlay.amount}
        mult={victoryOverlay.mult}
        round={victoryOverlay.round}
        onCollect={() => setVictoryOverlay((prev) => ({ ...prev, open: false }))}
      />

      <HowToPlayModal isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} gameId="dragon-egg" />
    </div>
  );
};
