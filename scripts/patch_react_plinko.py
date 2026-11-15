#!/usr/bin/env python3

react_plinko_code = '''import React, { useState, useEffect, useRef } from 'react';
import { soundManager } from '../utils/audio';
import { fireConfetti } from '../utils/confetti';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { incrementMissionCounter } from '../utils/missions';
import { ArrowLeft, HelpCircle, Sparkles, Disc, Flame, Users, Trophy } from 'lucide-react';

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
  active: boolean;
  landedBucket?: number;
}

// Exactly 17 Multipliers as specified:
// Vermelho escuro (16x), Vermelho (9x), Rosa (2x), Laranja (1.4x), Laranja claro (1.4x),
// Laranja claro (1.2x), Amarelo (1.1x), Amarelo claro (1x), Amarelo muito claro (0.5x),
// Amarelo claro (1x), Amarelo (1.1x), Laranja claro (1.2x), Laranja claro (1.4x),
// Laranja (1.4x), Rosa (2x), Vermelho (9x), Vermelho escuro (16x).
const MULTIPLIERS = [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16];

const MULT_COLORS = [
  '#7f1d1d', // 16x Vermelho escuro
  '#dc2626', // 9x Vermelho
  '#ec4899', // 2x Rosa
  '#ea580c', // 1.4x Laranja
  '#f97316', // 1.4x Laranja claro
  '#fb923c', // 1.2x Laranja claro
  '#eab308', // 1.1x Amarelo
  '#fde047', // 1x Amarelo claro
  '#fef08a', // 0.5x Amarelo muito claro
  '#fde047', // 1x Amarelo claro
  '#eab308', // 1.1x Amarelo
  '#fb923c', // 1.2x Laranja claro
  '#f97316', // 1.4x Laranja claro
  '#ea580c', // 1.4x Laranja
  '#ec4899', // 2x Rosa
  '#dc2626', // 9x Vermelho
  '#7f1d1d', // 16x Vermelho escuro
];

const BALL_COUNTS = [1, 3, 5, 10];
const CHIP_VALUES = [50, 100, 250, 500];

export const PlinkoGame: React.FC<PlinkoGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby,
  username
}) => {
  const [betPerBall, setBetPerBall] = useState<number>(50);
  const [ballCount, setBallCount] = useState<number>(3);
  const [isDropping, setIsDropping] = useState<boolean>(false);
  const [activeBucketHits, setActiveBucketHits] = useState<Record<number, number>>({});
  const [recentWins, setRecentWins] = useState<{ mult: number; win: number }[]>([]);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  // Live Multiplayer Drop Feed
  const [communityDrops, setCommunityDrops] = useState<{ user: string; mult: number; win: number }[]>([
    { user: 'Capitão Scruffy', mult: 9, win: 450 },
    { user: 'Barão Von Pork', mult: 1.4, win: 140 },
    { user: 'Dama Raposa', mult: 16, win: 1600 }
  ]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const ballsRef = useRef<Ball[]>([]);

  const totalBet = betPerBall * ballCount;
  const rows = 14;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;

      const width = canvas.width;
      const height = canvas.height;

      // 1. Background: Deep Navy / Dark Charcoal (Almost Black)
      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, width, height);

      // Subtle atmospheric grid background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Border with sleek neon cyan/blue accent
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, width - 4, height - 4);

      // 2. Draw Multiplier Boxes at base
      const bucketCount = MULTIPLIERS.length; // 17
      const bucketWidth = (width - 16) / bucketCount;
      const bucketHeight = 24;
      const bucketY = height - bucketHeight - 6;

      const now = Date.now();

      MULTIPLIERS.forEach((mult, idx) => {
        const bx = 8 + idx * bucketWidth;
        const lastHit = activeBucketHits[idx] || 0;
        const isHit = now - lastHit < 400;

        ctx.save();

        if (isHit) {
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 14;
          ctx.fillStyle = '#ffffff';
        } else {
          ctx.fillStyle = MULT_COLORS[idx];
        }

        const by = isHit ? bucketY - 3 : bucketY;
        const bh = isHit ? bucketHeight + 3 : bucketHeight;

        ctx.fillRect(bx + 1, by, bucketWidth - 2, bh);
        ctx.strokeStyle = isHit ? '#ffffff' : 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 1, by, bucketWidth - 2, bh);

        // Text: Bold, legible white numbers with dark drop outline for 100% contrast
        ctx.font = 'bold 8.5px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const label = mult >= 10 ? `${mult}x` : `${mult}x`;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(label, bx + bucketWidth / 2, by + bh / 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, bx + bucketWidth / 2, by + bh / 2);

        ctx.restore();
      });

      // 3. Draw Pegs: Small white circular points in inverted pyramid
      const pegStartY = 32;
      const pegEndY = bucketY - 14;
      const rowSpacing = (pegEndY - pegStartY) / (rows - 1);

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowBlur = 4;

      const pegPositions: { x: number; y: number }[] = [];

      for (let r = 0; r < rows; r++) {
        // Row 0 has 3 pegs, expanding to row 13 with 16 pegs
        const countInRow = r + 3;
        const startX = width / 2 - ((countInRow - 1) * bucketWidth) / 2;
        const y = pegStartY + r * rowSpacing;

        for (let c = 0; c < countInRow; c++) {
          const x = startX + c * bucketWidth;
          pegPositions.push({ x, y });

          ctx.beginPath();
          ctx.arc(x, y, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 4. Update and Draw Balls (White spheres with glow)
      const currentBalls = ballsRef.current;
      let anyActive = false;

      currentBalls.forEach((ball) => {
        if (!ball.active) return;
        anyActive = true;

        // Gravity & Air Resistance
        ball.vy += 0.22;
        ball.vx *= 0.994;

        ball.x += ball.vx;
        ball.y += ball.vy;

        // Side Walls
        if (ball.x < 12) {
          ball.x = 12;
          ball.vx = Math.abs(ball.vx) * 0.7;
        } else if (ball.x > width - 12) {
          ball.x = width - 12;
          ball.vx = -Math.abs(ball.vx) * 0.7;
        }

        // Collision with pegs
        pegPositions.forEach((peg) => {
          const dx = ball.x - peg.x;
          const dy = ball.y - peg.y;
          const dist = Math.hypot(dx, dy);
          const minDist = ball.radius + 2.4;

          if (dist < minDist) {
            // Push out of collision
            const overlap = minDist - dist;
            const nx = dx / (dist || 1);
            const ny = dy / (dist || 1);

            ball.x += nx * overlap;
            ball.y += ny * overlap;

            // Reflect velocity with bounce restitution
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 1.7 * dot * nx) + (Math.random() - 0.5) * 0.7;
            ball.vy = (ball.vy - 1.7 * dot * ny) * 0.65;

            // Ensure downward motion
            if (ball.vy < 0.6) ball.vy = 0.6;
          }
        });

        // Check landing in bucket
        if (ball.y >= bucketY) {
          ball.active = false;
          const clampedX = Math.max(8, Math.min(width - 9, ball.x));
          const bucketIdx = Math.max(0, Math.min(bucketCount - 1, Math.floor((clampedX - 8) / bucketWidth)));
          ball.landedBucket = bucketIdx;

          const mult = MULTIPLIERS[bucketIdx];
          const winAmount = Math.floor(ball.bet * mult);

          // Highlight box
          setActiveBucketHits((prev) => ({ ...prev, [bucketIdx]: Date.now() }));

          // Sound & Confetti
          if (mult >= 9) {
            soundManager.playJackpot();
            fireConfetti(2000);
          } else if (mult >= 1.4) {
            soundManager.playWin();
          } else {
            soundManager.playChip();
          }

          onUpdateBalance(winAmount, winAmount >= ball.bet, 'plinko', ball.bet);
          setRecentWins((prev) => [{ mult, win: winAmount }, ...prev.slice(0, 5)]);

          // Add to community drop ticker
          if (username) {
            setCommunityDrops((prev) => [{ user: username, mult, win: winAmount }, ...prev.slice(0, 4)]);
          }
        }

        // Draw Ball: White glowing sphere
        ctx.save();
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;

        const grad = ctx.createRadialGradient(ball.x - 1.5, ball.y - 1.5, 1, ball.x, ball.y, ball.radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.7, '#f1f5f9');
        grad.addColorStop(1, '#cbd5e1');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      });

      if (!anyActive && isDropping) {
        setIsDropping(false);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [activeBucketHits, isDropping]);

  const handleDropBalls = () => {
    if (isDropping || totalBet > balance || totalBet <= 0) return;

    soundManager.playChip();
    onUpdateBalance(-totalBet, false, 'plinko');
    setIsDropping(true);

    if (username) {
      incrementMissionCounter(username, 'plinko_drops', ballCount);
    }

    const canvas = canvasRef.current;
    const width = canvas ? canvas.width : 440;

    const newBalls: Ball[] = [];
    for (let i = 0; i < ballCount; i++) {
      newBalls.push({
        id: Date.now() + i,
        x: width / 2 + (Math.random() - 0.5) * 18,
        y: 10 - i * 22,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 1.5 + Math.random() * 0.5,
        radius: 4.8,
        bet: betPerBall,
        active: true
      });
    }

    ballsRef.current = newBalls;
  };

  return (
    <div className="h-full w-full max-w-4xl mx-auto flex flex-col justify-between overflow-hidden text-orange-100 p-1 sm:p-2 select-none">
      {/* Top Header */}
      <div className="shrink-0 flex items-center justify-between px-2 py-0.5">
        <button onClick={onBackToLobby} className="btn-dark flex items-center gap-1.5 text-xs py-1.5 px-3">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Lobby</span>
        </button>

        <div className="text-center">
          <div className="font-cinzel text-sm sm:text-base font-black text-amber-300 flex items-center justify-center gap-1.5">
            <Disc className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>PLINKO (BOLINHAS) · MULTIPLAYER AO VIVO</span>
          </div>
          <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">
            Pirâmide de Pinos Brancos · 17 Caixas Multiplicadoras de 0.5x a 16x!
          </span>
        </div>

        <button onClick={() => setShowHowToPlay(true)} className="btn-dark flex items-center gap-1 text-xs py-1.5 px-3">
          <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Regras</span>
        </button>
      </div>

      {/* Main Plinko Arena Box (Strict 100vh) */}
      <div className="relative rounded-2xl border-2 border-cyan-500/40 bg-[#060a12] flex-1 min-h-0 flex flex-col items-center justify-between p-1.5 my-1 shadow-[0_0_35px_rgba(6,182,212,0.15)] overflow-hidden">
        {/* Live Multiplayer Drops Ticker */}
        <div className="w-full flex items-center justify-between px-3 py-1 bg-[#0b1220] border-b border-cyan-500/20 text-[10px]">
          <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mesa Coletiva:</span>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto">
            {communityDrops.map((d, i) => (
              <span key={i} className="flex items-center gap-1 text-slate-300 font-mono">
                <span className="text-cyan-200 font-bold">{d.user}</span>
                <span className={`px-1 rounded text-[9px] font-bold ${d.mult >= 9 ? 'bg-red-600 text-white' : 'bg-amber-500 text-slate-950'}`}>
                  {d.mult}x
                </span>
                <span className="text-amber-300">+{d.win}🪙</span>
              </span>
            ))}
          </div>
        </div>

        {/* Canvas Area: Triangle Inverted Pyramid */}
        <div className="flex-1 min-h-0 w-full flex items-center justify-center p-1">
          <canvas
            ref={canvasRef}
            width={460}
            height={330}
            className="w-full max-w-[460px] h-auto max-h-full rounded-xl shadow-2xl border border-cyan-500/20"
          />
        </div>

        {/* Live Recent Drops Ribbon */}
        {recentWins.length > 0 && (
          <div className="w-full flex items-center justify-center gap-2 py-0.5 bg-[#09101c]/80 text-[11px]">
            <span className="text-slate-400 font-bold">Seus últimos acertos:</span>
            {recentWins.map((w, i) => (
              <span
                key={i}
                className={`px-1.5 py-0.2 rounded font-mono font-black ${
                  w.mult >= 9 ? 'bg-red-600 text-white' : w.mult >= 1.4 ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-200'
                }`}
              >
                {w.mult}x ({w.win}🪙)
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Controls Bar (Strict 100vh compliance) */}
      <div className="shrink-0 bg-[#0e1626] border-2 border-cyan-500/30 p-2 sm:p-2.5 rounded-2xl space-y-1.5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Ball count selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Bolinhas:</span>
            <div className="flex gap-1">
              {BALL_COUNTS.map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  disabled={isDropping}
                  onClick={() => {
                    setBallCount(cnt);
                    soundManager.playClick();
                  }}
                  className={`py-1 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
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

          {/* Chip Value Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Aposta/Bola:</span>
            <div className="flex gap-1">
              {CHIP_VALUES.map((val) => (
                <button
                  key={val}
                  type="button"
                  disabled={isDropping}
                  onClick={() => {
                    setBetPerBall(val);
                    soundManager.playChip();
                  }}
                  className={`py-1 px-2 sm:px-2.5 rounded-xl text-xs font-mono font-extrabold transition-all cursor-pointer ${
                    betPerBall === val
                      ? 'bg-amber-500 text-slate-950 scale-105 shadow-md shadow-amber-500/50'
                      : 'bg-[#152238] text-amber-300 hover:text-white border border-amber-500/30'
                  }`}
                >
                  🪙 {val}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            disabled={isDropping || totalBet > balance}
            onClick={handleDropBalls}
            className="w-full sm:w-auto py-3 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:brightness-110 text-white font-cinzel font-black text-sm uppercase tracking-wider shadow-2xl shadow-cyan-600/40 active:scale-98 cursor-pointer border-2 border-cyan-300/50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>SOLTAR {ballCount} BOLINHA(S) ({totalBet} FICHAS) ⚪</span>
          </button>
        </div>

        {/* Como Jogar */}
        <div className="pt-0.5 text-center">
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="inline-flex items-center gap-1 text-[11px] text-cyan-300/70 hover:text-cyan-200 transition-colors cursor-pointer py-0.5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>Regras & Como Jogar Plinko (Bolinhas na Pirâmide)</span>
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
'''

with open('src/games/PlinkoGame.tsx', 'w', encoding='utf-8') as f:
    f.write(react_plinko_code)

print("Updated src/games/PlinkoGame.tsx successfully!")
