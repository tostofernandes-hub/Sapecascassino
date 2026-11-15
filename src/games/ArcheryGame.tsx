import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { soundManager } from '../utils/audio';
import { reportRoundLoss } from '../utils/luckyStreak';
import { ChipSelector } from '../components/ChipSelector';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { ArcheryVictoryOverlay } from '../components/ArcheryVictoryOverlay';

interface ArcheryGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'archery', betAmount?: number) => void;
  onBackToLobby: () => void;
}

// Distribuição oficial dos 20 alvos:
// 8× 0x | 3× 0.5x | 5× 1.5x | 1× 2x | 2× 5x | 1× 50x (Total = 20 alvos)
const ARCHERY_POOL: number[] = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0.5, 0.5, 0.5,
  1.5, 1.5, 1.5, 1.5, 1.5,
  2,
  5, 5,
  50
];

const ARROW_FLIGHT_MS = 1200; // Exatamente 1,2 segundos por flecha
const ARROW_STAGGER_MS = 500; // Atraso sequencial de 0,5s entre flechas
const ARROW_DRAW_MS = 180;    // Tensão do arco antes da soltura

const shuffleTargets = (): number[] => {
  const arr = [...ARCHERY_POOL];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Regra de custo de combo das flechas:
// 1 flecha = 1x base (100) | 2 flechas = 2.5x base (250) | 3 flechas = 4.5x base (450)
const ARROW_COST_MULTIPLIERS: Record<1 | 2 | 3, number> = { 1: 1, 2: 2.5, 3: 4.5 };

const calcTotalCost = (baseBet: number, count: 1 | 2 | 3): number => {
  const safeBase = Math.max(0, baseBet);
  return Math.round(safeBase * ARROW_COST_MULTIPLIERS[count]);
};

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface FlyingArrowVisual {
  id: number;
  x: number;
  y: number;
  z: number;
  groundY: number;
  deg: number;
  pitch: number;
  scale: number;
  shadowScale: number;
  shadowOpacity: number;
  windStrength: number;
  falling: boolean;
}

interface SmokePuffVisual {
  id: number;
  x: number;
  y: number;
  deg: number;
  progress: number;
}

interface ImpactSparkVisual {
  id: number;
  kind: 'spark' | 'splinter' | 'dust';
  x: number;
  y: number;
  sx: number;
  sy: number;
  rot0: number;
  rot1: number;
  w: number;
  h: number;
  color: string;
  glow: string;
}

type BowPose = 'rest' | 'draw' | 'release';

export const ArcheryGame: React.FC<ArcheryGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby
}) => {
  const [bet, setBet] = useState(100);
  const [arrowCount, setArrowCount] = useState<1 | 2 | 3>(1);
  const [targets, setTargets] = useState<number[]>(() => shuffleTargets());
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [hitIndices, setHitIndices] = useState<number[]>([]);
  const [hitPayouts, setHitPayouts] = useState<Record<number, number>>({});
  const [shooting, setShooting] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [shakingIdx, setShakingIdx] = useState<number>(-1);
  const [bowPose, setBowPose] = useState<BowPose>('rest');
  const [flyingArrows, setFlyingArrows] = useState<FlyingArrowVisual[]>([]);
  const [smokePuffs, setSmokePuffs] = useState<SmokePuffVisual[]>([]);
  const [impactSparks, setImpactSparks] = useState<ImpactSparkVisual[]>([]);
  const [statusMsg, setStatusMsg] = useState('Escolha a quantidade de flechas, clique no(s) alvo(s) e dispare!');
  const [statusTone, setStatusTone] = useState<'neutral' | 'warn' | 'win' | 'loss'>('neutral');
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [victoryOverlay, setVictoryOverlay] = useState<{ open: boolean; amount: number; subtitle: string }>({
    open: false,
    amount: 0,
    subtitle: ''
  });

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const targetRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);

  const clearAnimResources = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => {
    return () => clearAnimResources();
  }, []);

  const totalCost = calcTotalCost(bet, arrowCount);

  const handleSelectArrowCount = (nextCount: 1 | 2 | 3) => {
    if (shooting) return;
    setArrowCount(nextCount);
    soundManager.playClick();

    let nextSelected = selectedIndices;
    if (revealed) {
      setTargets(shuffleTargets());
      setRevealed(false);
      setHitIndices([]);
      setHitPayouts({});
      nextSelected = [];
    } else if (selectedIndices.length > nextCount) {
      nextSelected = selectedIndices.slice(0, nextCount);
    }
    setSelectedIndices(nextSelected);

    const missing = nextCount - nextSelected.length;
    if (missing > 0) {
      setStatusTone('neutral');
      setStatusMsg(`Modo ${nextCount} ${nextCount === 1 ? 'flecha' : 'flechas'}: clique em ${missing} ${missing === 1 ? 'alvo' : 'alvos'} na parede!`);
    } else {
      setStatusTone('win');
      setStatusMsg(`${nextCount} ${nextCount === 1 ? 'alvo selecionado' : 'alvos selecionados'}! Pronto para atirar.`);
    }
  };

  const handleSelectTarget = (idx: number) => {
    if (shooting) return;
    soundManager.playClick();

    let nextSelected: number[];
    if (revealed) {
      setTargets(shuffleTargets());
      setRevealed(false);
      setHitIndices([]);
      setHitPayouts({});
      nextSelected = [idx];
    } else {
      const pos = selectedIndices.indexOf(idx);
      if (pos >= 0) {
        nextSelected = selectedIndices.filter((item) => item !== idx);
      } else if (selectedIndices.length < arrowCount) {
        nextSelected = [...selectedIndices, idx];
      } else {
        nextSelected = [...selectedIndices.slice(1), idx];
      }
    }
    setSelectedIndices(nextSelected);

    const missing = arrowCount - nextSelected.length;
    if (missing > 0) {
      setStatusTone('neutral');
      setStatusMsg(`Alvos marcados (${nextSelected.length}/${arrowCount}). Escolha mais ${missing}!`);
    } else {
      setStatusTone('warn');
      setStatusMsg(`Mira travada em ${arrowCount} ${arrowCount === 1 ? 'alvo' : 'alvos'}! Pronto para atirar.`);
    }
  };

  const handleShoot = () => {
    if (shooting || bet <= 0 || balance < totalCost || selectedIndices.length !== arrowCount) return;
    clearAnimResources();

    const arenaEl = arenaRef.current;
    if (!arenaEl) return;

    const activeBoard = revealed ? shuffleTargets() : targets;
    if (revealed) setTargets(activeBoard);

    const chosenTargets = [...selectedIndices];
    const arenaRect = arenaEl.getBoundingClientRect();
    const startX = arenaRect.width / 2;
    const startY = arenaRect.height - 32;

    const shotSpecs = chosenTargets.map((targetIdx, i) => {
      const targetEl = targetRefs.current[targetIdx];
      const rect = targetEl ? targetEl.getBoundingClientRect() : arenaRect;
      return {
        id: i,
        targetIdx,
        drawAtMs: i * ARROW_STAGGER_MS,
        launchAtMs: i * ARROW_STAGGER_MS + ARROW_DRAW_MS,
        startX,
        startY,
        endX: targetEl ? rect.left - arenaRect.left + rect.width / 2 : startX,
        endY: targetEl ? rect.top - arenaRect.top + rect.height / 2 : startY * 0.4,
        resolved: false,
        fallingAt: 0,
        lastSmokeAt: 0
      };
    });

    onUpdateBalance(-totalCost, false, 'archery', totalCost);
    soundManager.playChip();

    setShooting(true);
    setRevealed(false);
    setHitIndices([]);
    setHitPayouts({});
    setShakingIdx(-1);
    setBowPose('draw');
    setFlyingArrows([]);
    setSmokePuffs([]);
    setImpactSparks([]);
    setStatusTone('warn');
    setStatusMsg(
      arrowCount === 1
        ? 'Puxando o arco 3D... flecha disparada!'
        : `Tensionando arco 3D para ${arrowCount} disparos sequenciais!`
    );

    const roundStart = performance.now();
    let seqId = 1;
    const livePuffs: Array<{ id: number; x: number; y: number; deg: number; bornAt: number }> = [];
    const liveSparks: Array<ImpactSparkVisual & { bornAt: number }> = [];
    let resolvedCount = 0;
    let totalWin = 0;
    const hitSummary: string[] = [];
    let allResolvedAt = 0;

    const spawnImpactSparks = (x: number, y: number, mult: number, now: number) => {
      const isWin = mult > 0;
      const isBullseye50 = mult >= 50;
      const sparkCount = isBullseye50 ? 18 : isWin ? 12 : 6;
      const splinterCount = isBullseye50 ? 16 : isWin ? 11 : 4;
      const dustCount = isBullseye50 ? 12 : isWin ? 8 : 5;

      for (let i = 0; i < sparkCount; i++) {
        const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.4;
        const dist = (isBullseye50 ? 34 : isWin ? 24 : 14) + Math.random() * (isWin ? 24 : 12);
        liveSparks.push({
          id: seqId++,
          kind: 'spark',
          x,
          y,
          sx: Math.cos(angle) * dist,
          sy: Math.sin(angle) * dist,
          rot0: 0,
          rot1: 0,
          w: 6,
          h: 6,
          color: isWin
            ? i % 3 === 0 ? '#fef08a' : i % 3 === 1 ? '#f97316' : '#34d399'
            : i % 2 === 0 ? '#cbd5e1' : '#64748b',
          glow: isWin ? '0 0 8px rgba(251,191,36,0.95)' : '0 0 4px rgba(148,163,184,0.6)',
          bornAt: now
        });
      }

      // Lascas de madeira (Bullseye Wood Splinters) explodindo do centro do alvo
      const woodColors = ['#fde68a', '#d97706', '#b45309', '#92400e', '#78350f'];
      for (let i = 0; i < splinterCount; i++) {
        const angle = (Math.PI * 2 * i) / splinterCount + (Math.random() - 0.5) * 0.5;
        const dist = (isBullseye50 ? 32 : isWin ? 22 : 12) + Math.random() * (isWin ? 26 : 12);
        const rotStart = (angle * 180) / Math.PI;
        liveSparks.push({
          id: seqId++,
          kind: 'splinter',
          x,
          y,
          sx: Math.cos(angle) * dist,
          sy: Math.sin(angle) * dist + 10 + Math.random() * 8,
          rot0: rotStart,
          rot1: rotStart + (Math.random() > 0.5 ? 160 : -160) + Math.random() * 90,
          w: 7 + Math.round(Math.random() * 5),
          h: 2 + (Math.random() > 0.5 ? 1 : 0),
          color: isWin ? woodColors[i % woodColors.length] : '#64748b',
          glow: isBullseye50 ? '0 0 6px rgba(251,191,36,0.6)' : '0 1px 2px rgba(0,0,0,0.65)',
          bornAt: now
        });
      }

      // Poeira fina (Dust Cloud Particles) dispersando do centro (Bullseye)
      for (let i = 0; i < dustCount; i++) {
        const angle = (Math.PI * 2 * i) / dustCount + (Math.random() - 0.5) * 0.55;
        const dist = (isBullseye50 ? 22 : isWin ? 15 : 10) + Math.random() * 14;
        const size = (isBullseye50 ? 11 : 8) + Math.round(Math.random() * 5);
        liveSparks.push({
          id: seqId++,
          kind: 'dust',
          x,
          y,
          sx: Math.cos(angle) * dist,
          sy: Math.sin(angle) * dist - 4,
          rot0: 0,
          rot1: 0,
          w: size,
          h: size,
          color: isWin
            ? i % 2 === 0
              ? 'radial-gradient(circle, rgba(254,243,199,0.82) 0%, rgba(217,119,6,0.32) 55%, rgba(255,255,255,0) 100%)'
              : 'radial-gradient(circle, rgba(231,229,228,0.78) 0%, rgba(168,162,158,0.35) 55%, rgba(255,255,255,0) 100%)'
            : 'radial-gradient(circle, rgba(203,213,225,0.72) 0%, rgba(100,116,139,0.28) 60%, rgba(255,255,255,0) 100%)',
          glow: 'none',
          bornAt: now
        });
      }
    };

    const step = (now: number) => {
      const elapsed = now - roundStart;
      const nextArrows: FlyingArrowVisual[] = [];
      let activeBowPose: BowPose = 'rest';

      shotSpecs.forEach((shot) => {
        if (elapsed >= shot.drawAtMs && elapsed < shot.launchAtMs) {
          activeBowPose = 'draw';
        } else if (elapsed >= shot.launchAtMs && elapsed < shot.launchAtMs + 160 && activeBowPose !== 'draw') {
          activeBowPose = 'release';
        }

        if (elapsed < shot.launchAtMs) return;
        const shotElapsed = elapsed - shot.launchAtMs;

        if (!shot.resolved) {
          const t = Math.min(1, shotElapsed / ARROW_FLIGHT_MS);
          const eased = easeInOutCubic(t);
          const arcPeak = 74;
          const arcLift = Math.sin(t * Math.PI) * arcPeak;
          const x = shot.startX + (shot.endX - shot.startX) * eased;
          const y = shot.startY + (shot.endY - shot.startY) * eased - arcLift;
          const groundY = shot.startY + (shot.endY - shot.startY) * eased;

          const t2 = Math.min(1, t + 0.018);
          const e2 = easeInOutCubic(t2);
          const x2 = shot.startX + (shot.endX - shot.startX) * e2;
          const y2 = shot.startY + (shot.endY - shot.startY) * e2 - Math.sin(t2 * Math.PI) * arcPeak;
          const deg = Math.atan2(y2 - y, x2 - x) * (180 / Math.PI);

          const z = 140 - 182 * eased;
          const pitch = Math.cos(t * Math.PI) * 26;
          const scale = 1.24 - 0.36 * eased;
          const shadowScale = 1.1 - 0.5 * Math.sin(t * Math.PI);
          const shadowOpacity = 0.55 * (1 - 0.45 * Math.sin(t * Math.PI));

          const windStrength = Math.min(1, 0.28 + 0.72 * Math.sin(t * Math.PI));

          if (t > 0.03 && t < 0.96 && now - shot.lastSmokeAt >= 36) {
            shot.lastSmokeAt = now;
            livePuffs.push({ id: seqId++, x, y, deg, bornAt: now });
          }

          if (t < 1) {
            nextArrows.push({
              id: shot.id,
              x,
              y,
              z,
              groundY,
              deg,
              pitch,
              scale,
              shadowScale,
              shadowOpacity,
              windStrength,
              falling: false
            });
          } else {
            shot.resolved = true;
            const mult = activeBoard[shot.targetIdx];
            const arrowWin = Math.round(bet * mult);
            totalWin += arrowWin;
            hitSummary.push(`${mult}x`);
            resolvedCount += 1;

            setHitIndices((prev) => [...prev, shot.targetIdx]);
            setHitPayouts((prev) => ({ ...prev, [shot.targetIdx]: arrowWin }));
            setShakingIdx(shot.targetIdx);
            spawnImpactSparks(shot.endX, shot.endY, mult, now);

            if (mult > 0) {
              if (mult >= 5) soundManager.playMultiplierHit();
              else soundManager.playWin();
            } else {
              soundManager.playLoss();
              shot.fallingAt = now;
              nextArrows.push({
                id: shot.id,
                x: shot.endX,
                y: shot.endY + 75,
                z: -42,
                groundY: shot.endY + 75,
                deg: 84,
                pitch: 0,
                scale: 0.72,
                shadowScale: 0.5,
                shadowOpacity: 0,
                windStrength: 0,
                falling: true
              });
            }

            if (resolvedCount === shotSpecs.length) {
              allResolvedAt = now;
              setRevealed(true);
              setShooting(false);
              setSelectedIndices([]);

              if (totalWin > 0) {
                onUpdateBalance(totalWin, true, 'archery', totalCost);
                setStatusTone('win');
                setStatusMsg(
                  arrowCount === 1
                    ? `🏹 Acertou ${hitSummary[0]}! Ganhou +${totalWin.toLocaleString('pt-BR')} fichas!`
                    : `🎯 Flechas [${hitSummary.join(' + ')}] · Total: +${totalWin.toLocaleString('pt-BR')} fichas!`
                );

                const netMult = (totalWin / Math.max(1, totalCost)).toFixed(2).replace(/\.00$/, '');
                const winAmountFinal = totalWin;
                const subtitleFinal = `Acertos [${hitSummary.join(' + ')}] · Retorno ${netMult}x`;
                const modalTimer = window.setTimeout(() => {
                  soundManager.playMultiplierHit();
                  setVictoryOverlay({
                    open: true,
                    amount: winAmountFinal,
                    subtitle: subtitleFinal
                  });
                }, 350);
                timersRef.current.push(modalTimer);
              } else {
                reportRoundLoss('archery');
                setStatusTone('loss');
                setStatusMsg(
                  arrowCount === 1
                    ? '💨 Errou! O alvo escolhido era 0x.'
                    : `💨 Todos os ${arrowCount} alvos escolhidos eram 0x!`
                );
              }
            } else {
              setStatusTone(mult > 0 ? 'win' : 'warn');
              setStatusMsg(
                mult > 0
                  ? `Flecha ${shot.id + 1} cravou ${mult}x (+${arrowWin.toLocaleString('pt-BR')})!`
                  : `Flecha ${shot.id + 1} caiu em 0x...`
              );
            }
          }
        } else if (shot.fallingAt > 0 && now - shot.fallingAt < 420) {
          nextArrows.push({
            id: shot.id,
            x: shot.endX,
            y: shot.endY + 75,
            z: -42,
            groundY: shot.endY + 75,
            deg: 84,
            pitch: 0,
            scale: 0.72,
                shadowScale: 0.5,
                shadowOpacity: 0,
                windStrength: 0,
                falling: true
              });
        }
      });

      const activePuffs: SmokePuffVisual[] = [];
      for (let i = livePuffs.length - 1; i >= 0; i--) {
        const age = now - livePuffs[i].bornAt;
        if (age >= 420) {
          livePuffs.splice(i, 1);
        } else {
          activePuffs.push({
            id: livePuffs[i].id,
            x: livePuffs[i].x,
            y: livePuffs[i].y,
            deg: livePuffs[i].deg,
            progress: age / 420
          });
        }
      }

      const activeSparks: ImpactSparkVisual[] = [];
      for (let i = liveSparks.length - 1; i >= 0; i--) {
        const age = now - liveSparks[i].bornAt;
        if (age >= 600) {
          liveSparks.splice(i, 1);
        } else {
          activeSparks.push(liveSparks[i]);
        }
      }

      setBowPose(activeBowPose);
      setFlyingArrows(nextArrows);
      setSmokePuffs(activePuffs);
      setImpactSparks(activeSparks);

      const keepRunning =
        resolvedCount < shotSpecs.length ||
        activePuffs.length > 0 ||
        activeSparks.length > 0 ||
        nextArrows.length > 0 ||
        (allResolvedAt > 0 && now - allResolvedAt < 500);

      if (keepRunning) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        setBowPose('rest');
        setShakingIdx(-1);
        setFlyingArrows([]);
        setSmokePuffs([]);
        setImpactSparks([]);
      }
    };

    rafRef.current = requestAnimationFrame(step);
  };

  const readyToShoot = selectedIndices.length === arrowCount && bet > 0 && balance >= totalCost && !shooting;
  const costFactorLabels: Record<1 | 2 | 3, string> = { 1: '1x', 2: '2.5x', 3: '4.5x' };

  return (
    <div className="h-full min-h-0 flex flex-col justify-between gap-1.5 overflow-hidden py-0.5 select-none">
      {/* Top Bar */}
      <div className="shrink-0 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            clearAnimResources();
            onBackToLobby();
          }}
          className="px-2.5 py-1 rounded-lg bg-[#250d09] hover:bg-[#38140d] border border-orange-500/35 text-orange-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Lobby</span>
        </button>

        <h1 className="font-cinzel font-black text-xs sm:text-sm text-emerald-300 tracking-wide">
          🏹 TIRO DO SAPECA (ARQUEIRO)
        </h1>

        <span className="text-[10px] font-bold text-amber-200 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-md">
          20 ALVOS · ATÉ 50X 🎯
        </span>
      </div>

      {/* 3D Forest Archery Arena */}
      <div
        ref={arenaRef}
        style={{ perspective: '920px', transformStyle: 'preserve-3d' }}
        className="relative flex-1 min-h-0 rounded-2xl border-2 border-emerald-500/35 bg-[radial-gradient(circle_at_50%_15%,rgba(22,101,52,0.45)_0%,rgba(10,32,18,0.92)_55%,#06110a_100%)] p-2 sm:p-2.5 flex flex-col justify-between overflow-hidden shadow-2xl"
      >
        {/* Legend */}
        <div className="relative z-10 flex flex-wrap justify-center gap-1 shrink-0">
          <span className="px-1.5 py-0.5 rounded-md bg-black/55 border border-emerald-500/30 text-[9.5px] font-bold text-slate-300 tabular-nums">
            8× 0x
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-black/55 border border-sky-500/35 text-[9.5px] font-bold text-sky-300 tabular-nums">
            3× 0.5x
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-black/55 border border-emerald-500/35 text-[9.5px] font-bold text-emerald-300 tabular-nums">
            5× 1.5x
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-black/55 border border-lime-400/40 text-[9.5px] font-bold text-lime-300 tabular-nums">
            1× 2x
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-black/55 border border-amber-500/40 text-[9.5px] font-bold text-amber-300 tabular-nums">
            2× 5x
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-black/55 border border-yellow-400/50 text-[9.5px] font-black text-yellow-300 tabular-nums">
            1× 50x NA MOSCA 🎯
          </span>
        </div>

        {/* 5x4 Targets Wall in 3D Depth */}
        <div
          style={{ transform: 'translateZ(-24px)', transformStyle: 'preserve-3d' }}
          className="relative z-10 flex-1 min-h-0 grid grid-cols-5 grid-rows-4 gap-1.5 sm:gap-2 place-items-center max-w-xl w-full mx-auto py-1"
        >
          {targets.map((mult, idx) => {
            const selOrder = selectedIndices.indexOf(idx);
            const isSelected = !revealed && selOrder >= 0;
            const isHit = hitIndices.includes(idx);
            const isWin = isHit && mult > 0;
            const isMiss = isHit && mult === 0;
            const showMult = revealed || isHit;
            const payoutVal = hitPayouts[idx];

            return (
              <button
                key={idx}
                ref={(el) => {
                  targetRefs.current[idx] = el;
                }}
                type="button"
                disabled={shooting}
                onClick={() => handleSelectTarget(idx)}
                aria-label={`Alvo ${idx + 1}`}
                className={`relative w-11 sm:w-13 max-h-full aspect-square rounded-full border-2 flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-default ${
                  isWin
                    ? 'border-yellow-300 scale-110 shadow-[0_0_20px_rgba(250,204,21,0.9)] z-20'
                    : isMiss
                    ? 'border-slate-500 grayscale opacity-75'
                    : isSelected
                    ? 'border-yellow-300 scale-108 shadow-[0_0_18px_rgba(250,204,21,0.9)] z-10'
                    : revealed
                    ? 'border-amber-900/70 opacity-55 saturate-75'
                    : 'border-amber-900 shadow-lg hover:scale-105 hover:border-yellow-300'
                } ${shakingIdx === idx ? 'archery-react-target-shake' : ''}`}
                style={{
                  background: isMiss
                    ? 'radial-gradient(circle, #475569 0 30%, #94a3b8 31% 62%, #334155 63% 100%)'
                    : 'radial-gradient(circle, #ef4444 0 22%, #ffffff 23% 44%, #dc2626 45% 68%, #f8fafc 69% 86%, #b91c1c 87% 100%)'
                }}
              >
                {/* Mira visual + número do disparo */}
                {isSelected && (
                  <>
                    <span className="pointer-events-none absolute -inset-1 flex items-center justify-center animate-pulse">
                      <svg viewBox="0 0 60 60" className="w-full h-full">
                        <circle cx="30" cy="30" r="26" fill="none" stroke="#fde047" strokeWidth="2" strokeDasharray="6 4" />
                        <line x1="30" y1="2" x2="30" y2="14" stroke="#fde047" strokeWidth="2.2" strokeLinecap="round" />
                        <line x1="30" y1="46" x2="30" y2="58" stroke="#fde047" strokeWidth="2.2" strokeLinecap="round" />
                        <line x1="2" y1="30" x2="14" y2="30" stroke="#fde047" strokeWidth="2.2" strokeLinecap="round" />
                        <line x1="46" y1="30" x2="58" y2="30" stroke="#fde047" strokeWidth="2.2" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span className="pointer-events-none absolute -top-1.5 -right-1.5 z-20 min-w-4 h-4 px-1 rounded-full bg-gradient-to-b from-yellow-300 to-amber-600 text-slate-950 border border-amber-50 text-[9px] font-black flex items-center justify-center shadow">
                      {selOrder + 1}
                    </span>
                  </>
                )}

                {showMult && (
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] sm:text-xs font-black tabular-nums border ${
                      isWin
                        ? 'bg-emerald-950 text-yellow-300 border-yellow-300 scale-110'
                        : isMiss
                        ? 'bg-slate-900 text-slate-300 border-slate-500'
                        : 'bg-slate-950/90 text-amber-200 border-amber-500/40'
                    }`}
                  >
                    {mult === 50 ? '🎯50x' : `${mult}x`}
                  </span>
                )}

                {isHit && typeof payoutVal === 'number' && (
                  <span
                    className={`pointer-events-none absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 px-1.5 py-0.5 rounded-full font-mono text-[9.5px] font-black whitespace-nowrap shadow ${
                      payoutVal > 0
                        ? 'bg-emerald-950 text-yellow-300 border border-yellow-300'
                        : 'bg-slate-800 text-slate-200 border border-slate-500'
                    }`}
                  >
                    {payoutVal > 0 ? `+${payoutVal.toLocaleString('pt-BR')}` : '0x'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Status Message */}
        <div
          className={`relative z-10 shrink-0 text-center text-[11px] sm:text-xs font-extrabold ${
            statusTone === 'win'
              ? 'text-emerald-400'
              : statusTone === 'loss'
              ? 'text-rose-300'
              : statusTone === 'warn'
              ? 'text-yellow-300'
              : 'text-emerald-100'
          }`}
        >
          {statusMsg}
        </div>

        {/* 3D Bow & Archer Station */}
        <div
          style={{ perspective: '600px', transformStyle: 'preserve-3d' }}
          className="relative z-10 h-13 flex items-end justify-center shrink-0 pointer-events-none"
        >
          <div
            style={{
              transformStyle: 'preserve-3d',
              transform:
                bowPose === 'draw'
                  ? 'rotateX(28deg) scaleX(0.92) scaleY(0.84) translateY(4px) translateZ(34px)'
                  : bowPose === 'release'
                  ? 'rotateX(8deg) scaleX(1.04) scaleY(1.06) translateY(-3px) translateZ(10px)'
                  : 'rotateX(18deg) translateZ(18px)'
            }}
            className="w-36 h-13 transition-transform duration-180 ease-out drop-shadow-[0_8px_14px_rgba(0,0,0,0.85)]"
          >
            <svg viewBox="0 0 148 56" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="reactBowWood3d" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#78350f" />
                  <stop offset="35%" stopColor="#d97706" />
                  <stop offset="50%" stopColor="#fde68a" />
                  <stop offset="65%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#78350f" />
                </linearGradient>
              </defs>
              <ellipse cx="74" cy="22" rx="11" ry="6" fill="#064e3b" stroke="#34d399" strokeWidth="1.2" opacity="0.9" />
              <path d="M16 44 Q42 8 74 14 Q106 8 132 44" fill="none" stroke="#451a03" strokeWidth="8" strokeLinecap="round" />
              <path d="M16 44 Q42 8 74 14 Q106 8 132 44" fill="none" stroke="url(#reactBowWood3d)" strokeWidth="5" strokeLinecap="round" />
              <path d="M22 41 Q46 12 74 16 Q102 12 126 41" fill="none" stroke="#fef3c7" strokeWidth="1.3" opacity="0.7" />
              <circle cx="16" cy="44" r="3.2" fill="#fbbf24" stroke="#78350f" strokeWidth="1" />
              <circle cx="132" cy="44" r="3.2" fill="#fbbf24" stroke="#78350f" strokeWidth="1" />
              <polyline
                points={bowPose === 'draw' ? '16,44 74,60 132,44' : bowPose === 'release' ? '16,44 74,40 132,44' : '16,44 74,44 132,44'}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <rect x="68" y="10" width="12" height="11" rx="3" fill="#451a03" stroke="#fbbf24" strokeWidth="1.3" />
              <g transform={bowPose === 'draw' ? 'translate(0, 14)' : bowPose === 'release' ? 'translate(0, -4)' : 'translate(0, 0)'}>
                <line x1="74" y1="44" x2="74" y2="4" stroke="#fde047" strokeWidth="2.8" strokeLinecap="round" />
                <polygon points="74,0 69,9 79,9" fill="#f8fafc" />
                <polygon points="74,42 69,48 74,45 79,48" fill="#34d399" />
              </g>
            </svg>
          </div>
        </div>

        {/* Wind Shear & Luminous Air Trail Particles */}
        {smokePuffs.map((puff) => (
          <React.Fragment key={puff.id}>
            <div
              style={{
                left: `${puff.x}px`,
                top: `${puff.y}px`,
                opacity: Math.max(0, 0.52 * (1 - puff.progress)),
                transform: `translate(-50%, -50%) rotate(${puff.deg}deg) scaleX(${1 + puff.progress * 0.9})`,
                background:
                  'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(226,232,240,0.55) 55%, rgba(254,240,138,0.45) 100%)'
              }}
              className="pointer-events-none absolute w-7 h-[2px] rounded-full z-20"
            />
            <div
              style={{
                left: `${puff.x}px`,
                top: `${puff.y}px`,
                opacity: Math.max(0, 0.65 * (1 - puff.progress)),
                transform: `translate(-50%, -50%) scale(${0.5 + puff.progress * 1.25})`,
                background:
                  'radial-gradient(circle, rgba(254,240,138,0.75) 0%, rgba(226,232,240,0.35) 55%, rgba(255,255,255,0) 100%)'
              }}
              className="pointer-events-none absolute w-2.5 h-2.5 rounded-full z-20"
            />
          </React.Fragment>
        ))}

        {/* Bullseye Impact Particles: Wood Splinters, Dust Puffs & Sparks */}
        {impactSparks.map((sp) => (
          <div
            key={sp.id}
            style={{
              left: `${sp.x}px`,
              top: `${sp.y}px`,
              width: `${sp.w}px`,
              height: `${sp.h}px`,
              marginLeft: `${-sp.w / 2}px`,
              marginTop: `${-sp.h / 2}px`,
              background: sp.color,
              boxShadow: sp.glow,
              ['--sx' as string]: `${sp.sx.toFixed(1)}px`,
              ['--sy' as string]: `${sp.sy.toFixed(1)}px`,
              ['--rot0' as string]: `${sp.rot0.toFixed(1)}deg`,
              ['--rot1' as string]: `${sp.rot1.toFixed(1)}deg`
            }}
            className={`pointer-events-none absolute z-40 ${
              sp.kind === 'splinter'
                ? 'rounded-[1px] archery-react-splinter'
                : sp.kind === 'dust'
                ? 'rounded-full archery-react-dust'
                : 'rounded-full archery-react-spark'
            }`}
          />
        ))}

        {/* 3D Arrow Ground Shadows */}
        {flyingArrows.map((arrow) =>
          !arrow.falling ? (
            <div
              key={`shadow-${arrow.id}`}
              style={{
                transform: `translate3d(${arrow.x}px, ${arrow.groundY + 12}px, -20px) scale(${arrow.shadowScale})`,
                opacity: arrow.shadowOpacity,
                background: 'radial-gradient(circle, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 72%)'
              }}
              className="pointer-events-none absolute left-0 top-0 w-6 h-2 -ml-3 -mt-1 rounded-full z-10"
            />
          ) : null
        )}

        {/* 3D Flying Arrows Overlay + Subtle Aerodynamic Wind Trail */}
        {flyingArrows.map((arrow) => (
          <div
            key={arrow.id}
            style={{
              transformStyle: 'preserve-3d',
              transform: `translate3d(${arrow.x}px, ${arrow.y}px, ${arrow.z}px) rotateZ(${arrow.deg}deg) rotateX(${arrow.pitch}deg) scale(${arrow.scale})`,
              opacity: arrow.falling ? 0 : 1
            }}
            className={`pointer-events-none absolute left-0 top-0 w-11 h-4 -ml-[22px] -mt-2 z-30 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)] ${
              arrow.falling ? 'transition-all duration-400' : ''
            }`}
          >
            <svg viewBox="0 0 44 16" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id={`reactWindCore-${arrow.id}`} x1="-68" y1="8" x2="10" y2="8" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="55%" stopColor="#e2e8f0" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#fef08a" stopOpacity="0.52" />
                </linearGradient>
                <linearGradient id={`reactWindEdge-${arrow.id}`} x1="-58" y1="8" x2="18" y2="8" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0" />
                  <stop offset="60%" stopColor="#f8fafc" stopOpacity="0.36" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.55" />
                </linearGradient>
              </defs>
              {!arrow.falling && (
                <g
                  style={{
                    opacity: 0.25 + arrow.windStrength * 0.65,
                    transform: `scaleX(${0.65 + arrow.windStrength * 0.65})`,
                    transformOrigin: '8px 8px'
                  }}
                >
                  <polygon points="-66,8 8,4.2 8,11.8" fill={`url(#reactWindCore-${arrow.id})`} />
                  <path
                    d="M 16,5 Q -12,1.2 -58,2.8"
                    fill="none"
                    stroke={`url(#reactWindEdge-${arrow.id})`}
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 16,11 Q -12,14.8 -58,13.2"
                    fill="none"
                    stroke={`url(#reactWindEdge-${arrow.id})`}
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="-64"
                    y1="8"
                    x2="4"
                    y2="8"
                    stroke="#f8fafc"
                    strokeOpacity="0.48"
                    strokeWidth="1.15"
                    strokeDasharray="14 8"
                    strokeLinecap="round"
                    className="archery-wind-streak"
                  />
                </g>
              )}
              <line x1="2" y1="8" x2="34" y2="8" stroke="#fde68a" strokeWidth="3" strokeLinecap="round" />
              <polygon points="44,8 31,2.5 31,13.5" fill="#f8fafc" />
              <polygon points="2,8 10,2 7,8 10,14" fill="#34d399" />
            </svg>
          </div>
        ))}
      </div>

      {/* Bottom Controls */}
      <div className="shrink-0 space-y-1">
        {/* Arrow Quantity + Total Cost (2.5x exponential factor) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1 rounded-xl bg-emerald-950/60 border border-emerald-500/30">
          <div className="flex items-center gap-1">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                disabled={shooting}
                onClick={() => handleSelectArrowCount(n)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border transition-all cursor-pointer disabled:opacity-50 ${
                  arrowCount === n
                    ? 'bg-gradient-to-b from-amber-400 to-amber-700 text-slate-950 border-yellow-200 shadow-[0_0_10px_rgba(245,158,11,0.45)]'
                    : 'bg-slate-900/80 text-slate-200 border-amber-500/30 hover:border-yellow-300 hover:text-yellow-300'
                }`}
              >
                {n} {n === 1 ? 'Flecha' : 'Flechas'} ({costFactorLabels[n]})
              </button>
            ))}
          </div>
          <div className="text-[11px] font-bold text-emerald-100 tabular-nums">
            Custo Total:{' '}
            <strong className="font-mono text-xs font-black text-yellow-300">
              {totalCost.toLocaleString('pt-BR')} fichas
            </strong>
          </div>
        </div>

        <ChipSelector
          currentBet={bet}
          balance={balance}
          onBetChange={setBet}
          disabled={shooting}
          showDouble={false}
          compact
        />

        <button
          type="button"
          disabled={!readyToShoot}
          onClick={handleShoot}
          className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-cinzel font-black text-xs sm:text-sm tracking-wider shadow-lg border border-yellow-200 cursor-pointer transition-all"
        >
          {shooting
            ? 'FLECHAS NO AR... 🏹'
            : selectedIndices.length !== arrowCount
            ? `SELECIONE ${arrowCount} ALVO${arrowCount > 1 ? 'S' : ''} NA PAREDE (${selectedIndices.length}/${arrowCount})`
            : `ATIRAR ${arrowCount} ${arrowCount === 1 ? 'FLECHA' : 'FLECHAS'} (${totalCost.toLocaleString('pt-BR')} FICHAS) 🏹`}
        </button>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="text-[11px] font-bold text-amber-300/90 hover:text-amber-200 flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Como jogar Tiro do Sapeca</span>
          </button>
        </div>
      </div>

      <ArcheryVictoryOverlay
        isOpen={victoryOverlay.open}
        winAmount={victoryOverlay.amount}
        subtitle={victoryOverlay.subtitle}
        onCollect={() => setVictoryOverlay((prev) => ({ ...prev, open: false }))}
      />

      <HowToPlayModal isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} gameId="archery" />
    </div>
  );
};
