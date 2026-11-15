import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '../utils/audio';

interface LimboVictoryOverlayProps {
  isOpen: boolean;
  winAmount: number;
  multiplier: number;
  detail?: string;
  onCollect: () => void;
}

export const LimboVictoryOverlay: React.FC<LimboVictoryOverlayProps> = ({
  isOpen,
  winAmount,
  multiplier,
  detail,
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

        const stars = Array.from({ length: 46 }, () => ({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: (1 + Math.random() * 2.4) * dpr,
          vy: -(0.18 + Math.random() * 0.55) * dpr,
          vx: (Math.random() - 0.5) * 0.25 * dpr,
          phase: Math.random() * Math.PI * 2,
          isGold: Math.random() < 0.68
        }));

        const streaks = Array.from({ length: 18 }, () => ({
          x: Math.random() * canvas.width,
          y: canvas.height * (0.28 + Math.random() * 0.44),
          len: (45 + Math.random() * 110) * dpr,
          vx: (3.2 + Math.random() * 5.2) * dpr,
          vy: (-0.6 + Math.random() * 1.2) * dpr,
          w: (1 + Math.random() * 1.8) * dpr,
          alpha: 0.22 + Math.random() * 0.55,
          isWhite: Math.random() < 0.5
        }));

        let last = performance.now();
        const renderFx = (now: number) => {
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          for (let i = 0; i < streaks.length; i++) {
            const s = streaks[i];
            s.x += s.vx * (dt * 60);
            s.y += s.vy * (dt * 60);
            if (s.x - s.len > w) {
              s.x = -s.len - Math.random() * 90 * dpr;
              s.y = h * (0.26 + Math.random() * 0.48);
            }
            const grad = ctx.createLinearGradient(s.x - s.len, s.y, s.x, s.y);
            grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
            grad.addColorStop(0.6, s.isWhite ? `rgba(255, 255, 255, ${s.alpha * 0.6})` : `rgba(56, 189, 248, ${s.alpha})`);
            grad.addColorStop(1, s.isWhite ? `rgba(255, 255, 255, ${s.alpha})` : `rgba(186, 230, 253, ${s.alpha})`);
            ctx.strokeStyle = grad;
            ctx.lineWidth = s.w;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(s.x - s.len, s.y - s.vy * 4);
            ctx.lineTo(s.x, s.y);
            ctx.stroke();
          }

          for (let i = 0; i < stars.length; i++) {
            const st = stars[i];
            st.x += st.vx * (dt * 60);
            st.y += st.vy * (dt * 60);
            st.phase += dt * 3.1;
            if (st.y < -12 * dpr) {
              st.y = h + 12 * dpr;
              st.x = Math.random() * w;
            }
            if (st.x < 0) st.x = w;
            if (st.x > w) st.x = 0;

            const twinkle = 0.42 + 0.58 * Math.abs(Math.sin(st.phase));
            ctx.save();
            ctx.globalAlpha = twinkle;
            ctx.fillStyle = st.isGold ? '#fde047' : '#bae6fd';
            ctx.shadowColor = st.isGold ? '#fbbf24' : '#38bdf8';
            ctx.shadowBlur = 10 * dpr;
            ctx.beginPath();
            ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
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
      className="limbo-victory-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={handleAccelerate}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
      />
      <div className="limbo-victory-glow" />

      <div className="relative z-10 text-center flex flex-col items-center gap-1.5">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-900/80 border border-amber-400/65 text-amber-200 text-[11px] font-extrabold tracking-widest uppercase shadow-[0_0_18px_rgba(56,189,248,0.28)]">
          ✈ POUSO PERFEITO EM {multiplier.toFixed(2)}x
        </div>
        <h2 className="limbo-victory-title m-0">VITÓRIA!</h2>
      </div>

      <div className="limbo-victory-stage">
        <div className="limbo-plane-3d-flight">
          <div className="limbo-plane-3d-shadow" />
          <svg viewBox="0 0 320 190" className="limbo-plane-3d-svg">
            <defs>
              <linearGradient id="reactLvFuseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fffbeb" />
                <stop offset="28%" stopColor="#fef08a" />
                <stop offset="68%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#9a3412" />
              </linearGradient>
              <linearGradient id="reactLvWingMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef9c3" />
                <stop offset="38%" stopColor="#fbbf24" />
                <stop offset="78%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#7f1d1d" />
              </linearGradient>
              <linearGradient id="reactLvCanopyBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0f2fe" />
                <stop offset="45%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
              <linearGradient id="reactLvContrail" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
                <stop offset="55%" stopColor="#7dd3fc" stopOpacity="0.72" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.98" />
              </linearGradient>
            </defs>

            <g className="limbo-turbine-streak">
              <path d="M 10,126 Q 58,118 106,104 L 106,112 Q 60,128 10,132 Z" fill="url(#reactLvContrail)" />
              <path d="M 224,132 Q 268,124 310,114 L 310,120 Q 266,131 224,138 Z" fill="url(#reactLvContrail)" opacity="0.88" />
              <line x1="18" y1="92" x2="88" y2="82" stroke="#bae6fd" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
              <line x1="234" y1="86" x2="306" y2="78" stroke="#bae6fd" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
            </g>

            <polygon points="152,66 164,18 176,18 170,66" fill="url(#reactLvWingMetal)" stroke="#fef08a" strokeWidth="1.4" />
            <polygon points="104,74 160,64 216,74 196,82 124,82" fill="#b91c1c" stroke="#fbbf24" strokeWidth="1.3" />

            <polygon points="14,116 146,78 156,102 44,130" fill="url(#reactLvWingMetal)" stroke="#fef08a" strokeWidth="1.5" />
            <polygon points="306,116 174,78 164,102 276,130" fill="url(#reactLvWingMetal)" stroke="#fef08a" strokeWidth="1.5" />

            <g className="limbo-wing-sheen">
              <polygon points="36,112 138,84 142,90 48,118" fill="#ffffff" opacity="0.48" />
              <polygon points="284,112 182,84 178,90 272,118" fill="#ffffff" opacity="0.48" />
            </g>

            <g>
              <ellipse cx="106" cy="106" rx="14" ry="12" fill="#0f172a" stroke="#fbbf24" strokeWidth="2.2" />
              <ellipse cx="106" cy="106" rx="8" ry="7" fill="#38bdf8" />
              <ellipse cx="106" cy="106" rx="4" ry="3.5" fill="#ffffff" />

              <ellipse cx="214" cy="106" rx="14" ry="12" fill="#0f172a" stroke="#fbbf24" strokeWidth="2.2" />
              <ellipse cx="214" cy="106" rx="8" ry="7" fill="#38bdf8" />
              <ellipse cx="214" cy="106" rx="4" ry="3.5" fill="#ffffff" />
            </g>

            <ellipse cx="160" cy="96" rx="28" ry="32" fill="url(#reactLvFuseGrad)" stroke="#fef08a" strokeWidth="2" />
            <ellipse cx="160" cy="108" rx="19" ry="18" fill="#9a3412" opacity="0.28" />

            <path d="M 140,86 Q 160,64 180,86 Q 160,94 140,86 Z" fill="url(#reactLvCanopyBlue)" stroke="#e0f2fe" strokeWidth="1.6" />
            <path d="M 148,81 Q 158,72 168,78" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.85" />

            <circle cx="160" cy="105" r="7.5" fill="#fef08a" stroke="#b45309" strokeWidth="1.6" />
            <circle cx="158" cy="103" r="2.6" fill="#ffffff" opacity="0.9" />
          </svg>
        </div>
      </div>

      <div className="relative z-10 w-[min(92vw,370px)] py-3.5 px-4 rounded-2xl text-center bg-gradient-to-b from-slate-900/90 to-[#070d1c]/95 border border-amber-400/80 shadow-[0_0_38px_rgba(56,189,248,0.22),0_0_28px_rgba(245,158,11,0.25)]">
        <div className="text-[10px] font-extrabold text-sky-300 uppercase tracking-[2px] mb-1">
          PRÊMIO CONQUISTADO
        </div>
        <div className="limbo-victory-amount">
          {displayAmount.toLocaleString('pt-BR')} FICHAS
        </div>
        <div className="mt-1 text-xs font-bold text-amber-200">
          {detail || `Multiplicador ${multiplier.toFixed(2)}x garantido!`}
        </div>
      </div>

      <div className="relative z-10 w-full flex flex-col items-center gap-1.5">
        {!countDone && (
          <div className="text-[10px] text-sky-200/85">
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
