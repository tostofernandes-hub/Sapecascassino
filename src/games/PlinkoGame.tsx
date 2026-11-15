import React, { useState, useEffect, useRef } from 'react';
import { soundManager } from '../utils/audio';
import { fireConfetti } from '../utils/confetti';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { ChipSelector } from '../components/ChipSelector';
import { incrementMissionCounter } from '../utils/missions';
import { ArrowLeft, HelpCircle, Disc, Users, Sparkles } from 'lucide-react';

interface PlinkoGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'plinko', betAmount?: number) => void;
  onBackToLobby: () => void;
  username?: string;
}

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  bet: number;
  releaseAt: number;
  spawned: boolean;
  active: boolean;
  finished: boolean;
  landedBucket?: number;
}

// 16 Multipliers (removed 0.2x, 0.4x->0.6x, 0.6x->0.8x):
const MULTIPLIERS = [29, 12, 3, 1.5, 1, 0.8, 0.8, 0.6, 0.6, 0.8, 0.8, 1, 1.5, 3, 12, 29];

const MULT_COLORS = [
  '#7f1d1d', // 29x Vermelho escuro
  '#dc2626', // 12x Vermelho
  '#ec4899', // 3x Rosa
  '#ea580c', // 1.5x Laranja
  '#f97316', // 1x Laranja claro
  '#fb923c', // 0.8x Laranja claro
  '#fb923c', // 0.8x Laranja claro
  '#eab308', // 0.6x Amarelo centro
  '#eab308', // 0.6x Amarelo centro
  '#fb923c', // 0.8x Laranja claro
  '#fb923c', // 0.8x Laranja claro
  '#f97316', // 1x Laranja claro
  '#ea580c', // 1.5x Laranja
  '#ec4899', // 3x Rosa
  '#dc2626', // 12x Vermelho
  '#7f1d1d', // 29x Vermelho escuro
];

const BALL_COUNTS = [1, 3, 5, 10];
const CANVAS_W = 860;
const CANVAS_H = 520;

export const PlinkoGame: React.FC<PlinkoGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby,
  username
}) => {
  const [betPerBall, setBetPerBall] = useState<number>(50);
  const [ballCount, setBallCount] = useState<number>(3);
  const [isDropping, setIsDropping] = useState<boolean>(false);
  const [recentWins, setRecentWins] = useState<{ mult: number; win: number }[]>([]);
  const [roundSummary, setRoundSummary] = useState<{ won: number; bet: number } | null>(null);
  const [victoryModal, setVictoryModal] = useState<{ won: number; bet: number; count: number } | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  // Live Multiplayer Drop Feed
  const [communityDrops, setCommunityDrops] = useState<{ user: string; mult: number; win: number }[]>([
    { user: 'Capitão Scruffy', mult: 12, win: 600 },
    { user: 'Barão Von Pork', mult: 1.5, win: 150 },
    { user: 'Dama Raposa', mult: 29, win: 2900 }
  ]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const ballsRef = useRef<Ball[]>([]);
  const bucketHitsRef = useRef<Record<number, number>>({});
  const roundRef = useRef<{ totalBet: number; totalWon: number; count: number; settled: boolean }>({
    totalBet: 0,
    totalWon: 0,
    count: 0,
    settled: true
  });
  const isDroppingRef = useRef<boolean>(false);
  const onUpdateBalanceRef = useRef(onUpdateBalance);
  onUpdateBalanceRef.current = onUpdateBalance;
  const usernameRef = useRef(username);
  usernameRef.current = username;

  const totalBet = betPerBall * ballCount;
  const rows = 13;

  // Main Canvas Render & Physics Loop (fixed internal 860x520 for crisp 16px labels, CSS scales cleanly to 100vh)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    let lastTime = performance.now();

    const width = CANVAS_W;
    const height = CANVAS_H;
    const bucketCount = MULTIPLIERS.length; // 16
    const bucketWidth = (width - 16) / bucketCount;
    const bucketHeight = 34;
    const bucketY = height - bucketHeight - 6;
    const pegStartY = 34;
    const pegEndY = bucketY - 14;
    const rowSpacing = (pegEndY - pegStartY) / (rows - 1);
    const pegRadius = 3.2;

    const pegPositions: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++) {
      const countInRow = r + 3;
      const startX = width / 2 - ((countInRow - 1) * bucketWidth) / 2;
      const y = pegStartY + r * rowSpacing;
      for (let c = 0; c < countInRow; c++) {
        pegPositions.push({ x: startX + c * bucketWidth, y });
      }
    }

    const render = (now: number) => {
      if (!running) return;
      const dt = Math.min(1.8, Math.max(0.4, (now - lastTime) / 16.6667));
      lastTime = now;

      // 1. Background: Deep Navy / Charcoal Dark Felt
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(2, 2, width - 4, height - 4);

      // 2. Multiplier Boxes at base (17 boxes, bold legible 16px outlined text)
      const nowWall = Date.now();
      MULTIPLIERS.forEach((mult, idx) => {
        const bx = 8 + idx * bucketWidth;
        const lastHit = bucketHitsRef.current[idx] || 0;
        const isHit = nowWall - lastHit < 400;

        ctx.save();
        if (isHit) {
          ctx.shadowColor = '#facc15';
          ctx.shadowBlur = 16;
          ctx.fillStyle = '#ffffff';
        } else {
          ctx.fillStyle = MULT_COLORS[idx];
        }

        const by = isHit ? bucketY - 4 : bucketY;
        const bh = isHit ? bucketHeight + 4 : bucketHeight;

        ctx.fillRect(bx + 1.5, by, bucketWidth - 3, bh);
        ctx.strokeStyle = isHit ? '#fef08a' : 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = isHit ? 1.5 : 1.2;
        ctx.strokeRect(bx + 1.5, by, bucketWidth - 3, bh);

        const label = `${mult}x`;
        ctx.font = 'bold 16px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 1;
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.strokeText(label, bx + bucketWidth / 2, by + bh / 2 + 0.5, bucketWidth - 5);
        ctx.fillStyle = isHit ? '#0f172a' : '#ffffff';
        ctx.fillText(label, bx + bucketWidth / 2, by + bh / 2 + 0.5, bucketWidth - 5);
        ctx.restore();
      });

      // 3. Top Funnel & Pyramid Pegs
      ctx.save();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(width / 2 - 22, 4);
      ctx.lineTo(width / 2 + 22, 4);
      ctx.lineTo(width / 2 + 10, pegStartY - 10);
      ctx.lineTo(width / 2 - 10, pegStartY - 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(width / 2, pegStartY - 10, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowBlur = 4;
      pegPositions.forEach((peg) => {
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, pegRadius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // 4. Staggered 0.4s (400ms) ball activation
      const currentBalls = ballsRef.current;
      for (let i = 0; i < currentBalls.length; i++) {
        const b = currentBalls[i];
        if (!b.spawned && !b.finished && now >= b.releaseAt) {
          let blockedAtTop = false;
          for (let j = 0; j < currentBalls.length; j++) {
            const other = currentBalls[j];
            if (other.active && Math.hypot(other.x - b.x, other.y - b.y) < b.radius + other.radius + 3) {
              blockedAtTop = true;
              break;
            }
          }
          if (!blockedAtTop) {
            b.spawned = true;
            b.active = true;
            soundManager.playClick();
          }
        }
      }

      // 5. Gravity & Side Wall Physics
      currentBalls.forEach((ball) => {
        if (!ball.active) return;
        ball.vy += 0.24 * dt;
        ball.vx *= Math.pow(0.992, dt);
        // Calibrated center pull (~96% RTP) for 16 buckets (0.6x to 29x)
        ball.vx += (width / 2 - ball.x) * 0.00052 * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        if (ball.x < 14) {
          ball.x = 14;
          ball.vx = Math.abs(ball.vx) * 0.72;
        } else if (ball.x > width - 14) {
          ball.x = width - 14;
          ball.vx = -Math.abs(ball.vx) * 0.72;
        }
      });

      // 6. Ball-to-ball collision resolution (balls never overlap)
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < currentBalls.length; i++) {
          const a = currentBalls[i];
          if (!a.active) continue;
          for (let j = i + 1; j < currentBalls.length; j++) {
            const b = currentBalls[j];
            if (!b.active) continue;

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const minDist = a.radius + b.radius + 2.0;
            const dist = Math.hypot(dx, dy);

            if (dist < minDist) {
              const overlap = minDist - dist;
              const nx = dist > 0.001 ? dx / dist : (Math.random() < 0.5 ? -0.85 : 0.85);
              const ny = dist > 0.001 ? dy / dist : 0.52;

              a.x -= nx * overlap * 0.52;
              a.y -= ny * overlap * 0.52;
              b.x += nx * overlap * 0.52;
              b.y += ny * overlap * 0.52;

              if (pass === 0) {
                if (Math.abs(nx) < 0.28) {
                  const side = dx !== 0 ? Math.sign(dx) : (Math.random() < 0.5 ? -1 : 1);
                  a.vx -= side * 0.55;
                  b.vx += side * 0.55;
                }
                const rvx = b.vx - a.vx;
                const rvy = b.vy - a.vy;
                const velAlongNormal = rvx * nx + rvy * ny;
                if (velAlongNormal < 0) {
                  const restitution = 0.65;
                  const impulse = -(1 + restitution) * velAlongNormal * 0.5;
                  a.vx -= impulse * nx;
                  a.vy -= impulse * ny;
                  b.vx += impulse * nx;
                  b.vy += impulse * ny;
                }
              }
            }
          }
        }
      }

      // 7. Peg collisions, landing detection, and drawing active balls
      currentBalls.forEach((ball) => {
        if (!ball.active) return;

        pegPositions.forEach((peg) => {
          const dx = ball.x - peg.x;
          const dy = ball.y - peg.y;
          const dist = Math.hypot(dx, dy);
          const minDist = ball.radius + pegRadius;

          if (dist < minDist) {
            const overlap = minDist - dist;
            const nx = dx / (dist || 1);
            const ny = dy / (dist || 1);

            ball.x += nx * overlap;
            ball.y += ny * overlap;

            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 1.68 * dot * nx) + (Math.random() - 0.5) * 0.45;
            ball.vy = (ball.vy - 1.68 * dot * ny) * 0.64;

            if (ball.vy < 0.65) ball.vy = 0.65;
          }
        });

        if (ball.x < 14) {
          ball.x = 14;
          ball.vx = Math.abs(ball.vx) * 0.72;
        } else if (ball.x > width - 14) {
          ball.x = width - 14;
          ball.vx = -Math.abs(ball.vx) * 0.72;
        }

        if (ball.y >= bucketY) {
          ball.active = false;
          ball.finished = true;

          const clampedX = Math.max(8, Math.min(width - 9, ball.x));
          const bucketIdx = Math.max(0, Math.min(bucketCount - 1, Math.floor((clampedX - 8) / bucketWidth)));
          ball.landedBucket = bucketIdx;

          const mult = MULTIPLIERS[bucketIdx];
          const winAmount = Math.floor(ball.bet * mult);
          roundRef.current.totalWon += winAmount;

          bucketHitsRef.current[bucketIdx] = Date.now();
          soundManager.playChip();
          setRecentWins((prev) => [{ mult, win: winAmount }, ...prev.slice(0, 5)]);

          if (usernameRef.current) {
            setCommunityDrops((prev) => [{ user: usernameRef.current!, mult, win: winAmount }, ...prev.slice(0, 4)]);
          }
        }

        if (ball.active) {
          ctx.save();
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 10;

          const grad = ctx.createRadialGradient(ball.x - 1.8, ball.y - 1.8, 1, ball.x, ball.y, ball.radius);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.7, '#f1f5f9');
          grad.addColorStop(1, '#cbd5e1');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.restore();
        }
      });

      const anyUnfinished = currentBalls.some((b) => !b.finished);

      // 8. End of round: ONLY settle & check >= 2x victory modal once screen is completely clear
      if (!anyUnfinished && isDroppingRef.current && !roundRef.current.settled) {
        roundRef.current.settled = true;
        isDroppingRef.current = false;
        setIsDropping(false);

        const roundWon = roundRef.current.totalWon;
        const roundBet = roundRef.current.totalBet;
        const roundBalls = roundRef.current.count;

        ballsRef.current = [];
        roundRef.current = { totalBet: 0, totalWon: 0, count: 0, settled: true };

        onUpdateBalanceRef.current(roundWon, roundWon >= roundBet, 'plinko', roundBet);
        setRoundSummary({ won: roundWon, bet: roundBet });

        if (roundBet > 0 && roundWon >= 2 * roundBet) {
          soundManager.playJackpot();
          fireConfetti(2800);
          setVictoryModal({ won: roundWon, bet: roundBet, count: roundBalls });
        } else if (roundWon > 0) {
          soundManager.playWin();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const handleDropBalls = () => {
    if (totalBet > balance || totalBet <= 0) return;

    // Fecha automaticamente a tela de vitória se estiver aberta para dar lugar à nova jogada
    setVictoryModal(null);
    setRoundSummary(null);

    soundManager.playChip();
    onUpdateBalance(-totalBet, false, 'plinko');

    if (username) {
      incrementMissionCounter(username, 'plinko_drops', ballCount);
    }

    const nowTime = performance.now();
    let lastPendingRelease = -Infinity;
    for (let i = 0; i < ballsRef.current.length; i++) {
      const b = ballsRef.current[i];
      if (!b.spawned && !b.finished) {
        lastPendingRelease = Math.max(lastPendingRelease, b.releaseAt);
      }
    }
    const batchStart = Math.max(nowTime, lastPendingRelease + 400);

    const newBalls: Ball[] = [];
    for (let i = 0; i < ballCount; i++) {
      newBalls.push({
        id: Date.now() + Math.random() + i,
        x: CANVAS_W / 2 + (Math.random() - 0.5) * 14,
        y: 14,
        vx: (Math.random() - 0.5) * 1.1,
        vy: 1.6,
        radius: 6.5,
        bet: betPerBall,
        releaseAt: batchStart + i * 400, // 0.4s delay between balls
        spawned: false,
        active: false,
        finished: false
      });
    }

    ballsRef.current = [...ballsRef.current, ...newBalls];

    if (!isDroppingRef.current || roundRef.current.settled) {
      roundRef.current = {
        totalBet,
        totalWon: 0,
        count: ballCount,
        settled: false
      };
    } else {
      roundRef.current.totalBet += totalBet;
      roundRef.current.count += ballCount;
    }

    isDroppingRef.current = true;
    setIsDropping(true);
  };

  return (
    <div className="h-full max-h-full w-full flex flex-col justify-between overflow-hidden text-orange-100 select-none pb-0.5">
      {/* Top Header Bar */}
      <div className="shrink-0 flex items-center justify-between px-2 sm:px-3 py-1">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-xl bg-[#200a07] border border-orange-500/30 text-orange-300 hover:text-white hover:bg-orange-600/30 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Lobby</span>
        </button>

        <div className="text-center">
          <div className="font-cinzel text-xs sm:text-sm md:text-base font-black text-amber-300 flex items-center justify-center gap-1.5 flex-wrap">
            <Disc className={`w-4 h-4 text-cyan-400 ${isDropping ? 'animate-spin' : ''}`} />
            <span>BOLINHAS SAPECAS</span>
            <span className="px-1.5 py-0.5 rounded-full bg-red-950/80 border border-red-500/50 text-[9px] font-black text-red-300 uppercase tracking-widest shadow">
              ⚡ DIFICULDADE 2X
            </span>
          </div>
        </div>

        <div className="w-16 text-right text-[10px] font-bold text-cyan-300 hidden sm:block">
          16 Caixas
        </div>
      </div>

      {/* Main Plinko Arena Box (Strictly contained within 100vh without scrolling) */}
      <div className="relative rounded-2xl border border-cyan-500/30 bg-[#05080f] flex-1 min-h-0 flex flex-col items-center justify-between p-1 my-0.5 shadow-[0_0_30px_rgba(6,182,212,0.12)] overflow-hidden">
        {/* Live Multiplayer Drops Ticker */}
        <div className="w-full shrink-0 flex items-center justify-between px-2.5 py-0.5 bg-[#0b1220]/90 border-b border-cyan-500/20 text-[10px]">
          <div className="flex items-center gap-1 text-cyan-300 font-bold shrink-0">
            <Users className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">Sala ao Vivo:</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
            {communityDrops.map((d, i) => (
              <span key={i} className="flex items-center gap-1 text-slate-300 font-mono text-[9px] sm:text-[10px] shrink-0">
                <span className="text-cyan-200 font-bold">{d.user}</span>
                <span className={`px-1 rounded text-[8px] sm:text-[9px] font-bold ${d.mult >= 9 ? 'bg-red-600 text-white' : 'bg-amber-500 text-slate-950'}`}>
                  {d.mult}x
                </span>
                <span className="text-amber-300">+{d.win}🪙</span>
              </span>
            ))}
          </div>
        </div>

        {/* Aspect-ratio safe canvas wrapper */}
        <div className="flex-1 min-h-0 w-full flex items-center justify-center p-1 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="max-w-full max-h-full w-auto h-full aspect-[860/520] object-contain rounded-xl shadow-2xl border border-cyan-500/30 select-none block"
          />
        </div>

        {/* Status / Recent Wins Bar (sem aviso de bloqueio) */}
        <div className="w-full shrink-0 flex items-center justify-center gap-2 py-0.5 px-2 bg-[#09101c]/90 text-[11px] border-t border-cyan-500/15 min-h-[22px]">
          {roundSummary && !isDropping ? (
            <span className={`font-bold ${roundSummary.won > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
              {roundSummary.won > 0
                ? `✨ Rodada encerrada: +${roundSummary.won.toLocaleString('pt-BR')} fichas ganhas!`
                : 'Fim dos lançamentos. Tente novamente!'}
            </span>
          ) : recentWins.length > 0 ? (
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="text-slate-400 font-bold hidden sm:inline text-[10px]">Últimos:</span>
              {recentWins.map((w, i) => (
                <span
                  key={i}
                  className={`px-1.5 py-0.5 rounded font-mono font-black text-[9px] ${
                    w.mult >= 9 ? 'bg-red-600 text-white' : w.mult >= 1.4 ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-200'
                  }`}
                >
                  {w.mult}x ({w.win}🪙)
                </span>
              ))}
            </div>
          ) : (
            <span className="text-cyan-300 font-semibold text-[10px]">
              Escolha a quantidade de bolinhas e clique em Soltar!
            </span>
          )}
        </div>

        {/* End-of-Round Victory Overlay (positioned over arena so bottom play controls stay clickable) */}
        {victoryModal && (
          <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center bg-black/45 p-3">
            <div className="pointer-events-auto relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#2b0d06] via-[#170503] to-[#0a0201] border-2 border-amber-400 p-5 text-center shadow-[0_0_60px_rgba(245,158,11,0.55)]">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[11px] font-black uppercase tracking-widest mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>BOLINHAS SAPECAS</span>
              </div>
              <h2 className="font-cinzel text-3xl font-black text-yellow-300 drop-shadow mb-3">
                VITÓRIA!
              </h2>
              <div className="rounded-2xl bg-black/45 border border-amber-500/40 py-3.5 px-3 mb-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200/80 mb-1">
                  Prêmio Total Acumulado
                </div>
                <div className="font-cinzel text-3xl font-black text-emerald-400">
                  +{victoryModal.won.toLocaleString('pt-BR')} FICHAS
                </div>
                <div className="text-xs text-orange-200/90 mt-1">
                  {victoryModal.count} bolinha{victoryModal.count > 1 ? 's' : ''} · Retorno {(victoryModal.won / victoryModal.bet).toFixed(2)}x
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundManager.playChip();
                  setVictoryModal(null);
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg hover:brightness-110 active:scale-98 cursor-pointer"
              >
                Recolher
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar (Compact, fits 100vh cleanly, sempre liberado) */}
      <div className="shrink-0 bg-[#0a111e]/95 border border-cyan-500/35 px-2.5 sm:px-3 py-1.5 rounded-2xl shadow-xl backdrop-blur-sm space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Ball count selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">Bolinhas:</span>
            <div className="flex gap-1">
              {BALL_COUNTS.map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => {
                    setBallCount(cnt);
                    soundManager.playClick();
                  }}
                  className={`py-1 px-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    ballCount === cnt
                      ? 'bg-cyan-500 text-slate-950 scale-105 shadow-md shadow-cyan-500/50'
                      : 'bg-[#152238] text-slate-300 hover:text-white border border-cyan-500/20'
                  }`}
                >
                  {cnt} ⚪
                </button>
              ))}
            </div>
          </div>

          {/* Big Action Button (sempre clicável quando há saldo) */}
          <button
            type="button"
            disabled={totalBet > balance || totalBet <= 0}
            onClick={handleDropBalls}
            className="flex-1 sm:flex-initial py-1.5 px-4 sm:px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-cyan-600/30 active:scale-98 cursor-pointer border border-cyan-300/60 disabled:opacity-45 disabled:pointer-events-none disabled:cursor-not-allowed flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Disc className={`w-4 h-4 ${isDropping ? 'animate-spin' : ''}`} />
            <span>
              SOLTAR {ballCount} BOLINHA{ballCount > 1 ? 'S' : ''} ({totalBet.toLocaleString('pt-BR')} FICHAS)
            </span>
          </button>
        </div>

        {/* Additive Chip Value Selector */}
        <ChipSelector
          currentBet={betPerBall}
          balance={balance}
          multiplierCount={ballCount}
          onBetChange={setBetPerBall}
          disabled={false}
          label="Por Bolinha:"
          theme="cyan"
        />

        {/* Bottom Regras / Como Jogar footer */}
        <div className="flex justify-center pt-0.5">
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="flex items-center gap-1 text-[11px] font-semibold text-orange-300 hover:text-amber-200 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Como jogar Bolinhas Sapecas</span>
          </button>
        </div>
      </div>

      {showHowToPlay && (
        <HowToPlayModal
          isOpen={showHowToPlay}
          onClose={() => setShowHowToPlay(false)}
          gameId="plinko"
        />
      )}
    </div>
  );
};
