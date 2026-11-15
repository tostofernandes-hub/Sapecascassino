import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '../utils/audio';

interface HorseRaceVictoryOverlayProps {
  isOpen: boolean;
  winAmount: number;
  horseId: number;
  horseName: string;
  horseColor: string;
  horseSilk: string;
  multiplier: number;
  onCollect: () => void;
}

export const HorseRaceVictoryOverlay: React.FC<HorseRaceVictoryOverlayProps> = ({
  isOpen,
  winAmount,
  horseId,
  horseName,
  horseColor,
  horseSilk,
  multiplier,
  onCollect,
}) => {
  const [displayAmount, setDisplayAmount] = useState<number>(0);
  const [countDone, setCountDone] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const countRafRef = useRef<number | null>(null);
  const fxRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (countRafRef.current) cancelAnimationFrame(countRafRef.current);
      if (fxRafRef.current) cancelAnimationFrame(fxRafRef.current);
      return;
    }

    const target = Math.max(0, Math.round(winAmount));
    setDisplayAmount(0);
    setCountDone(false);

    const startTime = performance.now();
    const duration = 3000;
    let lastTick = 0;

    const countStep = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayAmount(Math.round(eased * target));
      if (now - lastTick > 165) {
        soundManager.playClick();
        lastTick = now;
      }
      if (progress < 1) {
        countRafRef.current = requestAnimationFrame(countStep);
      } else {
        setDisplayAmount(target);
        setCountDone(true);
        countRafRef.current = null;
      }
    };
    countRafRef.current = requestAnimationFrame(countStep);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const resize = () => {
          canvas.width = Math.floor(window.innerWidth * dpr);
          canvas.height = Math.floor(window.innerHeight * dpr);
        };
        resize();
        window.addEventListener('resize', resize);

        const speedLines = Array.from({ length: 28 }, () => ({
          x: Math.random() * canvas.width,
          y: canvas.height * (0.2 + Math.random() * 0.65),
          len: (60 + Math.random() * 140) * dpr,
          vx: -(12 + Math.random() * 14) * dpr,
          w: (1.2 + Math.random() * 2.2) * dpr,
          alpha: 0.22 + Math.random() * 0.55,
          isGold: Math.random() < 0.45,
        }));

        const dustPuffs: Array<{
          x: number;
          y: number;
          vx: number;
          vy: number;
          r: number;
          life: number;
          decay: number;
          isGoldSpeck: boolean;
        }> = [];

        const spawnDust = () => {
          const originX = canvas.width * 0.45 + (Math.random() - 0.5) * 32 * dpr;
          const originY = canvas.height * 0.54 + Math.random() * 18 * dpr;
          dustPuffs.push({
            x: originX,
            y: originY,
            vx: -(2.6 + Math.random() * 3.8) * dpr,
            vy: -(0.8 + Math.random() * 1.9) * dpr,
            r: (7 + Math.random() * 12) * dpr,
            life: 1,
            decay: 0.02 + Math.random() * 0.015,
            isGoldSpeck: Math.random() < 0.25,
          });
        };

        let dustClock = 0;
        let last = performance.now();

        const renderFx = (now: number) => {
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          for (let i = 0; i < speedLines.length; i++) {
            const ln = speedLines[i];
            ln.x += ln.vx * (dt * 60);
            if (ln.x + ln.len < 0) {
              ln.x = w + Math.random() * 80 * dpr;
              ln.y = h * (0.18 + Math.random() * 0.68);
            }
            const grad = ctx.createLinearGradient(ln.x, ln.y, ln.x + ln.len, ln.y);
            grad.addColorStop(
              0,
              ln.isGold ? `rgba(253, 224, 71, ${ln.alpha})` : `rgba(255, 255, 255, ${ln.alpha})`
            );
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = ln.w;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(ln.x, ln.y);
            ctx.lineTo(ln.x + ln.len, ln.y + 1.5 * dpr);
            ctx.stroke();
          }

          dustClock += dt;
          if (dustClock > 0.045) {
            dustClock = 0;
            spawnDust();
          }
          for (let i = dustPuffs.length - 1; i >= 0; i--) {
            const d = dustPuffs[i];
            d.x += d.vx * (dt * 60);
            d.y += d.vy * (dt * 60);
            d.r += 0.38 * dpr * (dt * 60);
            d.life -= d.decay * (dt * 60);
            if (d.life <= 0) {
              dustPuffs.splice(i, 1);
              continue;
            }
            ctx.save();
            ctx.globalAlpha = d.life * (d.isGoldSpeck ? 0.75 : 0.45);
            ctx.fillStyle = d.isGoldSpeck ? '#fde047' : '#d6c3a5';
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          fxRafRef.current = requestAnimationFrame(renderFx);
        };
        fxRafRef.current = requestAnimationFrame(renderFx);

        return () => {
          window.removeEventListener('resize', resize);
          if (countRafRef.current) cancelAnimationFrame(countRafRef.current);
          if (fxRafRef.current) cancelAnimationFrame(fxRafRef.current);
        };
      }
    }

    return () => {
      if (countRafRef.current) cancelAnimationFrame(countRafRef.current);
      if (fxRafRef.current) cancelAnimationFrame(fxRafRef.current);
    };
  }, [isOpen, winAmount]);

  if (!isOpen) return null;

  const handleAccelerate = () => {
    if (countDone) return;
    if (countRafRef.current) {
      cancelAnimationFrame(countRafRef.current);
      countRafRef.current = null;
    }
    setDisplayAmount(Math.max(0, Math.round(winAmount)));
    setCountDone(true);
  };

  return (
    <div
      className="hr-victory-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={handleAccelerate}
    >
      <div className="hr-victory-glow" />
      <div className="hr-victory-track-3d">
        <div className="hr-victory-track-stripes" />
      </div>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-[2]"
      />

      <div className="relative z-10 text-center flex flex-col items-center gap-1.5">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-950/85 border border-amber-400/70 text-amber-200 text-[11px] font-extrabold tracking-widest uppercase shadow-[0_0_18px_rgba(251,191,36,0.28)]">
          🏆 #{horseId} {horseName.toUpperCase()} · 1º LUGAR!
        </div>
        <h2 className="hr-victory-title">VITÓRIA!</h2>
      </div>

      <div className="hr-victory-stage">
        <div className="hr-horse-3d-wrap">
          <div className="hr-horse-3d-shadow" />
          <span className="hr-horse-3d-dust">💨</span>
          <span className="hr-horse-3d-emoji">🐎</span>
          <span
            className="hr-horse-3d-crest"
            style={{ backgroundColor: horseColor || '#dc2626' }}
          >
            #{horseId} · {multiplier}x
          </span>
        </div>
      </div>

      <div className="hr-victory-prize-card">
        <div className="text-[10px] font-extrabold text-amber-200 uppercase tracking-[2px] mb-1">
          PRÊMIO DO CAMPEÃO
        </div>
        <div className="limbo-victory-amount">
          {displayAmount.toLocaleString('pt-BR')} FICHAS
        </div>
        <div className="mt-1 text-xs font-bold text-emerald-300">
          {horseSilk} #{horseId} {horseName} cruzou a linha em 1º! ({multiplier}x)
        </div>
      </div>

      <div className="relative z-10 w-full flex flex-col items-center gap-1.5">
        {!countDone && (
          <div className="text-[10px] text-amber-200/85">
            Toque na tela para acelerar a contagem
          </div>
        )}
        <button
          type="button"
          className="btn-limbo-recolher"
          onClick={(e) => {
            e.stopPropagation();
            soundManager.playClick();
            onCollect();
          }}
        >
          <span className="text-amber-400">✦</span>
          <span>RECOLHER</span>
          <span className="text-amber-400">✦</span>
        </button>
      </div>
    </div>
  );
};
