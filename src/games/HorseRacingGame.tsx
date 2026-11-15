import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { soundManager } from '../utils/audio';
import { reportRoundLoss } from '../utils/luckyStreak';
import { ChipSelector } from '../components/ChipSelector';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { HorseRaceVictoryOverlay } from '../components/HorseRaceVictoryOverlay';

interface HorseRacingGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'horse-race', betAmount?: number) => void;
  onBackToLobby: () => void;
}

interface HorseRunner {
  id: number;
  name: string;
  color: string;
  silk: string;
  prob: number;
  mult: number;
}

const HORSE_NAME_POOL = ['Relâmpago', 'Cometa', 'Esmeralda', 'Soberano', 'Trovão', 'Estrela'];
const HORSE_PROB_POOL = [40, 24, 15, 10, 6, 5];

const computeFairHorseMult = (prob: number): number =>
  Math.max(2.0, Math.floor((94 / prob) * 10) / 10);

const INITIAL_HORSES: HorseRunner[] = [
  { id: 1, name: 'Relâmpago', color: '#dc2626', silk: '🔴', prob: 40, mult: computeFairHorseMult(40) },
  { id: 2, name: 'Cometa', color: '#2563eb', silk: '🔵', prob: 24, mult: computeFairHorseMult(24) },
  { id: 3, name: 'Esmeralda', color: '#059669', silk: '🟢', prob: 15, mult: computeFairHorseMult(15) },
  { id: 4, name: 'Soberano', color: '#9333ea', silk: '🟣', prob: 10, mult: computeFairHorseMult(10) },
  { id: 5, name: 'Trovão', color: '#ea580c', silk: '🟠', prob: 6, mult: computeFairHorseMult(6) },
  { id: 6, name: 'Estrela', color: '#eab308', silk: '🟡', prob: 5, mult: computeFairHorseMult(5) },
];

const shuffleArrayCopy = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const buildRotatedRoster = (current: HorseRunner[]): HorseRunner[] => {
  const prevNames = current.map((h) => h.name);
  const prevProbs = current.map((h) => h.prob);
  let newNames = shuffleArrayCopy(HORSE_NAME_POOL);
  let newProbs = shuffleArrayCopy(HORSE_PROB_POOL);

  if (newNames.every((n, i) => n === prevNames[i])) {
    newNames = [...newNames.slice(1), newNames[0]];
  }
  if (newProbs.every((p, i) => p === prevProbs[i])) {
    newProbs = [...newProbs.slice(1), newProbs[0]];
  }

  return current.map((h, i) => {
    const prob = newProbs[i];
    return {
      ...h,
      name: newNames[i],
      prob,
      mult: computeFairHorseMult(prob),
    };
  });
};

const pickWeightedWinnerIdx = (roster: HorseRunner[]): number => {
  const r = Math.random() * 100;
  let acc = 0;
  for (let i = 0; i < roster.length; i++) {
    acc += roster[i].prob;
    if (r < acc) return i;
  }
  return 0;
};

export const HorseRacingGame: React.FC<HorseRacingGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby,
}) => {
  const [horses, setHorses] = useState<HorseRunner[]>(INITIAL_HORSES);
  const [completedRaces, setCompletedRaces] = useState<number>(0);
  const [selectedHorseId, setSelectedHorseId] = useState<number>(1);
  const [bet, setBet] = useState<number>(50);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [positions, setPositions] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [statusMsg, setStatusMsg] = useState<string>(
    'Escolha seu cavalo, ajuste sua aposta e inicie a corrida!'
  );
  const [statusTone, setStatusTone] = useState<'neutral' | 'win' | 'loss'>('neutral');
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [victoryOverlay, setVictoryOverlay] = useState<{
    open: boolean;
    amount: number;
    horseId: number;
    horseName: string;
    horseColor: string;
    horseSilk: string;
    mult: number;
  }>({ open: false, amount: 0, horseId: 1, horseName: '', horseColor: '#dc2626', horseSilk: '🔴', mult: 0 });

  const rafRef = useRef<number>(0);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRacesRef = useRef<number>(0);
  const pendingWinRef = useRef<{ amount: number; betAmount: number } | null>(null);
  const onUpdateBalanceRef = useRef(onUpdateBalance);
  onUpdateBalanceRef.current = onUpdateBalance;

  const stopAnim = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopAnim();
      if (pendingWinRef.current && pendingWinRef.current.amount > 0) {
        const pending = pendingWinRef.current;
        pendingWinRef.current = null;
        onUpdateBalanceRef.current(pending.amount, true, 'horse-race', pending.betAmount);
      }
    };
  }, []);

  const selectedHorse = horses.find((h) => h.id === selectedHorseId) || horses[0];
  const racesUntilRotation = 5 - (completedRaces % 5);

  const handleStartRace = () => {
    if (isRunning || bet <= 0 || balance < bet) return;

    const raceRoster = [...horses];
    const picked = raceRoster.find((h) => h.id === selectedHorseId) || raceRoster[0];

    stopAnim();
    setIsRunning(true);
    setPositions([0, 0, 0, 0, 0, 0]);
    setStatusTone('neutral');
    setStatusMsg('🏁 Largada dada! Cavalos galopando na pista 3D!');
    soundManager.playChip();

    onUpdateBalance(-bet, false, 'horse-race', bet);

    const winnerIdx = pickWeightedWinnerIdx(raceRoster);
    const targets = raceRoster.map((_, i) =>
      i === winnerIdx ? 100 : 86 + Math.random() * 9.5
    );
    const curves = raceRoster.map((_, i) => ({
      w1: 0.7 + Math.random() * 0.75,
      w2: 0.7 + Math.random() * 0.75,
      ph1: Math.random() * Math.PI * 2,
      target: targets[i],
    }));

    const durationMs = 4500;
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const nextPos: number[] = [];
      let leaderIdx = 0;
      let leaderVal = -1;

      for (let i = 0; i < raceRoster.length; i++) {
        const c = curves[i];
        const wave = Math.sin(t * Math.PI * 3.5 + c.ph1) * 4.5 * (1 - t);
        const midFactor = t < 0.55 ? c.w1 : c.w1 * 0.35 + c.w2 * 0.65;
        const base = Math.pow(t, 1.05) * c.target;
        const surge =
          i === winnerIdx && t > 0.65
            ? Math.pow((t - 0.65) / 0.35, 1.4) * 6
            : 0;
        let pos = Math.max(0, base + wave * midFactor + surge);
        if (i !== winnerIdx) {
          pos = Math.min(pos, c.target);
        } else {
          pos = Math.min(100, Math.max(pos, t * 100));
        }
        if (t >= 1) pos = c.target;
        nextPos.push(pos);
        if (pos > leaderVal) {
          leaderVal = pos;
          leaderIdx = i;
        }
      }

      setPositions(nextPos);
      if (t > 0.15 && t < 0.96) {
        const leader = raceRoster[leaderIdx];
        setStatusMsg(`🔥 Na liderança: #${leader.id} ${leader.name} ${leader.silk}`);
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = 0;
        finishTimerRef.current = setTimeout(() => {
          finishTimerRef.current = null;
          setIsRunning(false);

          const nextRaceTotal = completedRacesRef.current + 1;
          completedRacesRef.current = nextRaceTotal;
          setCompletedRaces(nextRaceTotal);
          const rotatedNow = nextRaceTotal % 5 === 0;

          const winHorse = raceRoster[winnerIdx];
          const ranking = raceRoster
            .map((h, idx) => ({ id: h.id, pos: nextPos[idx] }))
            .sort((a, b) => b.pos - a.pos);
          const myPlace = ranking.findIndex((r) => r.id === picked.id) + 1;

          if (winHorse.id === picked.id) {
            const winAmount = Math.round(bet * winHorse.mult);
            setStatusTone('win');
            setStatusMsg(
              `🏆 #${winHorse.id} ${winHorse.name} venceu em 1º lugar! +${winAmount.toLocaleString('pt-BR')} fichas (${winHorse.mult}x)!${
                rotatedNow ? ' 🔄 Cavalos e chances rotacionados!' : ''
              }`
            );
            soundManager.playJackpot();
            if (winAmount >= 2 * bet) {
              pendingWinRef.current = { amount: winAmount, betAmount: bet };
              setVictoryOverlay({
                open: true,
                amount: winAmount,
                horseId: winHorse.id,
                horseName: winHorse.name,
                horseColor: winHorse.color,
                horseSilk: winHorse.silk,
                mult: winHorse.mult,
              });
            } else {
              onUpdateBalance(winAmount, true, 'horse-race', bet);
            }
          } else {
            soundManager.playLoss();
            reportRoundLoss('horse-race');
            setStatusTone('loss');
            setStatusMsg(
              `🏁 Vencedor: #${winHorse.id} ${winHorse.name} (${winHorse.mult}x). Seu #${picked.id} ${picked.name} ficou em ${myPlace}º lugar.${
                rotatedNow ? ' 🔄 Cavalos e chances rotacionados!' : ''
              }`
            );
          }

          if (rotatedNow) {
            setHorses((prev) => buildRotatedRoster(prev));
          }
        }, 320);
      }
    };

    rafRef.current = requestAnimationFrame(step);
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
          <span>🐎</span>
          <span>CORRIDA DE CAVALOS SAPECAS</span>
        </h1>

        <span className="text-[10px] sm:text-xs font-mono font-bold text-emerald-400 tabular-nums">
          3D · Rotação em {racesUntilRotation} {racesUntilRotation === 1 ? 'corrida' : 'corridas'}
        </span>
      </div>

      {/* Turf 3D Perspective Race Track */}
      <div
        className="hr-track-box-3d flex-1 min-h-0 flex flex-col justify-between rounded-2xl border-2 border-amber-500 p-2 relative overflow-hidden shadow-[inset_0_0_28px_rgba(0,0,0,0.75)]"
        style={{
          background:
            'repeating-linear-gradient(90deg, #064e3b 0px, #064e3b 44px, #065f46 44px, #065f46 88px)',
        }}
      >
        {/* Top White Fence Rail */}
        <div
          className="shrink-0 h-1.5 rounded-full shadow z-10"
          style={{
            background:
              'repeating-linear-gradient(90deg, #f8fafc 0px, #f8fafc 14px, #cbd5e1 14px, #cbd5e1 28px)',
          }}
        />

        {/* 6 Lanes in CSS 3D */}
        <div className="hr-lanes-wrap-3d flex-1 min-h-0 relative flex flex-col justify-between my-1">
          {/* Start Line */}
          <div className="absolute top-0 bottom-0 left-[7%] w-0.5 bg-white/75 pointer-events-none z-0" />
          {/* Checkered Finish Line */}
          <div
            className="absolute top-0 bottom-0 right-[7%] w-2.5 pointer-events-none z-0 border-x border-white/80"
            style={{
              backgroundColor: '#ffffff',
              backgroundImage:
                'linear-gradient(45deg, #111827 25%, transparent 25%), linear-gradient(-45deg, #111827 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #111827 75%), linear-gradient(-45deg, transparent 75%, #111827 75%)',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
            }}
          />

          {horses.map((h, idx) => {
            const isSel = h.id === selectedHorseId;
            return (
              <div
                key={h.id}
                className={`hr-lane-3d flex-1 min-h-0 relative flex items-center px-1.5 border-b border-dashed border-white/25 last:border-b-0 transition-colors ${
                  isSel ? 'bg-amber-400/15 shadow-[inset_0_0_12px_rgba(251,191,36,0.25)]' : ''
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full font-mono font-black text-[10px] text-white border border-white/60 flex items-center justify-center shrink-0 z-10"
                  style={{ backgroundColor: h.color }}
                >
                  {h.id}
                </span>

                <div
                  className={`hr-runner-3d ${
                    isRunning ? 'is-running' : ''
                  } absolute top-1/2 flex items-center gap-0.5 z-10 pointer-events-none will-change-[left]`}
                  style={{ left: `${7 + positions[idx] * 0.85}%` }}
                >
                  <span className="hr-ground-shadow" />
                  <span className="hr-horse-stage-3d">
                    <span className="hr-dust">💨</span>
                    <span className="hr-horse-flip text-xl sm:text-2xl">🐎</span>
                    <span
                      className="text-[9px] font-black text-white px-1 rounded border border-white/60"
                      style={{ backgroundColor: h.color }}
                    >
                      {h.id}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom White Fence Rail */}
        <div
          className="shrink-0 h-1.5 rounded-full shadow z-10"
          style={{
            background:
              'repeating-linear-gradient(90deg, #f8fafc 0px, #f8fafc 14px, #cbd5e1 14px, #cbd5e1 28px)',
          }}
        />
      </div>

      {/* Race Status */}
      <div
        className={`shrink-0 text-xs font-extrabold text-center ${
          statusTone === 'win'
            ? 'text-emerald-400'
            : statusTone === 'loss'
            ? 'text-rose-300'
            : 'text-amber-200'
        }`}
      >
        {statusMsg}
      </div>

      {/* 6 Horse Selector Cards */}
      <div className="shrink-0 grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {horses.map((h) => {
          const isSel = h.id === selectedHorseId;
          return (
            <button
              key={h.id}
              type="button"
              disabled={isRunning}
              onClick={() => {
                soundManager.playClick();
                setSelectedHorseId(h.id);
              }}
              className={`rounded-xl px-1.5 py-1.5 border text-center transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                isSel
                  ? 'bg-gradient-to-b from-amber-500/30 to-amber-950/60 border-yellow-300 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                  : 'bg-[#1b0805] hover:bg-[#2a0e09] border-orange-500/30'
              }`}
            >
              <div className="flex items-center gap-1 text-[11px] font-black text-white truncate max-w-full">
                <span>{h.silk}</span>
                <span>
                  #{h.id} {h.name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono tabular-nums">
                <span className="text-orange-300">{h.prob}%</span>
                <span className="font-black text-yellow-300">{h.mult}x</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Betting & Start CTA */}
      <div className="shrink-0 space-y-1.5">
        <ChipSelector
          currentBet={bet}
          balance={balance}
          onBetChange={setBet}
          disabled={isRunning}
          showDouble={false}
          compact
        />

        <button
          type="button"
          disabled={isRunning || bet <= 0 || balance < bet}
          onClick={handleStartRace}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-cinzel font-black text-sm tracking-wider shadow-lg border border-yellow-200 cursor-pointer transition-all"
        >
          {isRunning
            ? 'CORRIDA EM ANDAMENTO...'
            : `INICIAR CORRIDA · #${selectedHorse.id} ${selectedHorse.name.toUpperCase()} (${bet.toLocaleString('pt-BR')} FICHAS) 🐎`}
        </button>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="text-[11px] font-bold text-amber-300/90 hover:text-amber-200 flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Como jogar Corrida de Cavalos Sapecas</span>
          </button>
        </div>
      </div>

      {/* Exclusive 3D Horse Race Victory Overlay (Only >= 2x) */}
      <HorseRaceVictoryOverlay
        isOpen={victoryOverlay.open}
        winAmount={victoryOverlay.amount}
        horseId={victoryOverlay.horseId}
        horseName={victoryOverlay.horseName}
        horseColor={victoryOverlay.horseColor}
        horseSilk={victoryOverlay.horseSilk}
        multiplier={victoryOverlay.mult}
        onCollect={() => {
          if (pendingWinRef.current && pendingWinRef.current.amount > 0) {
            const pending = pendingWinRef.current;
            pendingWinRef.current = null;
            onUpdateBalance(pending.amount, true, 'horse-race', pending.betAmount);
          }
          setVictoryOverlay((prev) => ({ ...prev, open: false }));
        }}
      />

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        gameId="horse-race"
        customPayouts={horses.map((h) => ({
          label: `#${h.id} ${h.name} (${h.prob}% de chance)`,
          value: `${h.mult}x`,
        }))}
      />
    </div>
  );
};
