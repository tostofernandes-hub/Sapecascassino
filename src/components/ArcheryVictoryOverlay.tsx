import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '../utils/audio';

interface ArcheryVictoryOverlayProps {
  isOpen: boolean;
  winAmount: number;
  subtitle: string;
  onCollect: () => void;
}

export const ArcheryVictoryOverlay: React.FC<ArcheryVictoryOverlayProps> = ({
  isOpen,
  winAmount,
  subtitle,
  onCollect
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
    const duration = Math.min(2000, Math.max(950, 850 + Math.log10(Math.max(10, target)) * 280));
    let lastTick = 0;

    const countStep = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayAmount(Math.round(eased * target));
      if (now - lastTick > 170) {
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

        const sparks = Array.from({ length: 44 }, (_, i) => {
          const angle = Math.random() * Math.PI * 2;
          const speed = (0.6 + Math.random() * 2.2) * dpr;
          return {
            x: canvas.width * 0.5 + (Math.random() - 0.5) * 140 * dpr,
            y: canvas.height * 0.44 + (Math.random() - 0.5) * 90 * dpr,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.35 * dpr,
            r: (1.2 + Math.random() * 2.5) * dpr,
            life: Math.random(),
            color: i % 3 === 0 ? '#fde047' : i % 3 === 1 ? '#34d399' : '#fb923c'
          };
        });

        let last = performance.now();
        const renderFx = (now: number) => {
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          for (let i = 0; i < sparks.length; i++) {
            const p = sparks[i];
            p.x += p.vx * (dt * 60);
            p.y += p.vy * (dt * 60);
            p.life += dt * 0.85;
            if (p.life >= 1) {
              const ang = Math.random() * Math.PI * 2;
              const spd = (0.7 + Math.random() * 2.4) * dpr;
              p.x = w * 0.5 + (Math.random() - 0.5) * 110 * dpr;
              p.y = h * 0.44 + (Math.random() - 0.5) * 70 * dpr;
              p.vx = Math.cos(ang) * spd;
              p.vy = Math.sin(ang) * spd - 0.4 * dpr;
              p.life = 0;
            }
            const alpha = Math.sin(p.life * Math.PI) * 0.9;
            ctx.save();
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10 * dpr;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
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
      className="archery-victory-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={handleAccelerate}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
      />
      <div className="archery-victory-glow" />

      <div className="relative z-10 text-center flex flex-col items-center gap-1.5">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-950/85 border border-amber-400/70 text-amber-200 text-[11px] font-extrabold tracking-widest uppercase shadow-[0_0_18px_rgba(52,211,153,0.3)]">
          🎯 TIRO DO SAPECA · NA MOSCA!
        </div>
        <h2 className="archery-victory-title m-0">VITÓRIA!</h2>
      </div>

      <div className="archery-victory-stage">
        <div className="archery-stage-3d-scene">
          {/* Alvo Dourado 3D Brilhante à Direita */}
          <div className="archery-target-win-3d">
            <svg viewBox="0 0 180 180" className="w-full h-full overflow-visible">
              <defs>
                <radialGradient id="reactArchTargetGold" cx="42%" cy="38%" r="68%">
                  <stop offset="0%" stopColor="#fffbeb" />
                  <stop offset="38%" stopColor="#fde047" />
                  <stop offset="78%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#92400e" />
                </radialGradient>
              </defs>
              <line x1="70" y1="148" x2="54" y2="176" stroke="#78350f" strokeWidth="7" strokeLinecap="round" />
              <line x1="110" y1="148" x2="126" y2="176" stroke="#78350f" strokeWidth="7" strokeLinecap="round" />
              <circle cx="90" cy="90" r="68" fill="url(#reactArchTargetGold)" stroke="#fef08a" strokeWidth="3.5" />
              <circle cx="90" cy="90" r="53" fill="#dc2626" stroke="#fffbeb" strokeWidth="2.2" />
              <circle cx="90" cy="90" r="38" fill="#fef3c7" />
              <circle cx="90" cy="90" r="24" fill="#ef4444" />
              <circle cx="90" cy="90" r="11" fill="#fde047" stroke="#78350f" strokeWidth="1.5" />
              <g className="archery-embedded-arrow-3d">
                <line x1="36" y1="74" x2="88" y2="90" stroke="#78350f" strokeWidth="6" strokeLinecap="round" />
                <line x1="36" y1="74" x2="88" y2="90" stroke="#fde68a" strokeWidth="3.4" strokeLinecap="round" />
                <polygon points="92,91 79,84 82,94" fill="#f8fafc" />
                <polygon points="36,74 22,63 29,74 24,83" fill="#34d399" stroke="#ecfdf5" strokeWidth="0.9" />
              </g>
            </svg>
          </div>

          {/* Arco 3D Tensionado & Flecha Disparada à Esquerda */}
          <div className="archery-bow-win-3d">
            <svg viewBox="0 0 140 160" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="reactArchWinWood" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#78350f" />
                  <stop offset="45%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#92400e" />
                </linearGradient>
                <linearGradient id="reactArchWinWind" x1="-38" y1="80" x2="34" y2="80" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="65%" stopColor="#e2e8f0" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#fef08a" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              <path d="M 48,16 Q 108,80 48,144" fill="none" stroke="#451a03" strokeWidth="10" strokeLinecap="round" />
              <path d="M 48,16 Q 108,80 48,144" fill="none" stroke="url(#reactArchWinWood)" strokeWidth="6.5" strokeLinecap="round" />
              <rect x="74" y="70" width="12" height="20" rx="3" fill="#451a03" stroke="#fde047" strokeWidth="1.4" />
              <polyline
                points="48,16 32,80 48,144"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <g className="archery-win-shot-arrow">
                <g className="archery-win-arrow-wind" style={{ transformOrigin: '30px 80px' }}>
                  <polygon points="-38,80 32,75 32,85" fill="url(#reactArchWinWind)" />
                  <path d="M 38,76 Q 6,72 -32,74" fill="none" stroke="url(#reactArchWinWind)" strokeWidth="1.4" strokeLinecap="round" />
                  <path d="M 38,84 Q 6,88 -32,86" fill="none" stroke="url(#reactArchWinWind)" strokeWidth="1.4" strokeLinecap="round" />
                </g>
                <line x1="32" y1="80" x2="122" y2="80" stroke="#fde047" strokeWidth="3.6" strokeLinecap="round" />
                <polygon points="132,80 115,73 115,87" fill="#f8fafc" />
                <polygon points="32,80 20,73 25,80 20,87" fill="#34d399" />
              </g>
            </svg>
          </div>
        </div>
      </div>

      <div className="archery-victory-prize-card">
        <div className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-[2px] mb-1">
          PRÊMIO DO ARQUEIRO
        </div>
        <div className="limbo-victory-amount">
          {displayAmount.toLocaleString('pt-BR')} FICHAS
        </div>
        <div className="mt-1 text-xs font-bold text-amber-200">
          {subtitle}
        </div>
      </div>

      <div className="relative z-10 w-full flex flex-col items-center gap-1.5">
        {!countDone && (
          <div className="text-[10px] text-emerald-200/85">
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
