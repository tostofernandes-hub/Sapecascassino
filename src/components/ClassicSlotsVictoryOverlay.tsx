import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '../utils/audio';

interface ClassicSlotsVictoryOverlayProps {
  isOpen: boolean;
  winAmount: number;
  label: string;
  multiplier: number;
  onCollect: () => void;
}

export const ClassicSlotsVictoryOverlay: React.FC<ClassicSlotsVictoryOverlayProps> = ({
  isOpen,
  winAmount,
  label,
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

        const fwColors = ['#fde047', '#fbbf24', '#f87171', '#38bdf8', '#4ade80', '#ffffff'];
        const chipThemes = [
          { body: '#dc2626', rim: '#fde047' },
          { body: '#f59e0b', rim: '#fffbeb' },
          { body: '#2563eb', rim: '#fde047' },
          { body: '#059669', rim: '#fffbeb' },
        ];

        const sparks: Array<{
          x: number;
          y: number;
          vx: number;
          vy: number;
          life: number;
          decay: number;
          r: number;
          color: string;
        }> = [];

        const spawnFirework = () => {
          const cx = canvas.width * (0.14 + Math.random() * 0.72);
          const cy = canvas.height * (0.12 + Math.random() * 0.36);
          const color = fwColors[Math.floor(Math.random() * fwColors.length)];
          const count = 24;
          for (let i = 0; i < count; i++) {
            const ang = (Math.PI * 2 * i) / count + Math.random() * 0.2;
            const spd = (2.2 + Math.random() * 4.4) * dpr;
            sparks.push({
              x: cx,
              y: cy,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              life: 1,
              decay: 0.015 + Math.random() * 0.015,
              r: (1.8 + Math.random() * 2.4) * dpr,
              color,
            });
          }
        };

        const chips = Array.from({ length: 24 }, (_, idx) => ({
          x: Math.random() * canvas.width,
          y: canvas.height + Math.random() * canvas.height * 0.5,
          vx: (Math.random() - 0.5) * 3.8 * dpr,
          vy: -(9.5 + Math.random() * 7.5) * dpr,
          r: (10 + Math.random() * 7) * dpr,
          spin: Math.random() * Math.PI * 2,
          vSpin: (Math.random() - 0.5) * 0.18,
          rot: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.09,
          theme: chipThemes[idx % chipThemes.length],
        }));

        spawnFirework();
        let burstTimer = 0;
        let last = performance.now();

        const renderFx = (now: number) => {
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          burstTimer += dt;
          if (burstTimer > 0.42) {
            burstTimer = 0;
            spawnFirework();
          }

          for (let i = sparks.length - 1; i >= 0; i--) {
            const sp = sparks[i];
            sp.x += sp.vx * (dt * 60);
            sp.y += sp.vy * (dt * 60);
            sp.vy += 0.075 * dpr * (dt * 60);
            sp.vx *= 0.985;
            sp.life -= sp.decay * (dt * 60);
            if (sp.life <= 0) {
              sparks.splice(i, 1);
              continue;
            }
            ctx.save();
            ctx.globalAlpha = Math.max(0, sp.life);
            ctx.fillStyle = sp.color;
            ctx.shadowColor = sp.color;
            ctx.shadowBlur = 10 * dpr;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          for (let i = 0; i < chips.length; i++) {
            const ch = chips[i];
            ch.x += ch.vx * (dt * 60);
            ch.y += ch.vy * (dt * 60);
            ch.vy += 0.24 * dpr * (dt * 60);
            ch.spin += ch.vSpin * (dt * 60);
            ch.rot += ch.vRot * (dt * 60);

            if (ch.y > h + 40 * dpr && ch.vy > 0) {
              ch.x = w * (0.12 + Math.random() * 0.76);
              ch.y = h + 24 * dpr;
              ch.vx = (Math.random() - 0.5) * 4.4 * dpr;
              ch.vy = -(11 + Math.random() * 8) * dpr;
            }

            const squash = Math.max(0.24, Math.abs(Math.cos(ch.spin)));
            ctx.save();
            ctx.translate(ch.x, ch.y);
            ctx.rotate(ch.rot);
            ctx.scale(squash, 1);

            ctx.fillStyle = ch.theme.body;
            ctx.strokeStyle = ch.theme.rim;
            ctx.lineWidth = 2.4 * dpr;
            ctx.beginPath();
            ctx.arc(0, 0, ch.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.setLineDash([4 * dpr, 4 * dpr]);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.6 * dpr;
            ctx.beginPath();
            ctx.arc(0, 0, ch.r * 0.68, 0, Math.PI * 2);
            ctx.stroke();
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
      className="cs-victory-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={handleAccelerate}
    >
      <div className="cs-victory-glow" />
      <div className="cs-vegas-neon-frame" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-[2]"
      />

      <div className="relative z-10 text-center flex flex-col items-center gap-1.5">
        <div className="cs-vegas-marquee-bar">
          <span className="cs-neon-bulb" />
          <span className="cs-neon-bulb alt" />
          <span className="font-serif text-[11px] font-black text-yellow-200 tracking-[1.8px] uppercase">
            ★ LAS VEGAS {multiplier}x JACKPOT ★
          </span>
          <span className="cs-neon-bulb alt" />
          <span className="cs-neon-bulb" />
        </div>
        <h2 className="cs-victory-title">VITÓRIA!</h2>
      </div>

      <div className="cs-victory-stage">
        <div className="cs-badge-3d-spinner">
          <svg viewBox="0 0 220 220" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="reactCsGoldRim" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fffbeb" />
                <stop offset="28%" stopColor="#fde047" />
                <stop offset="68%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
              <radialGradient id="reactCsBadgeCore" cx="42%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="58%" stopColor="#7f1d1d" />
                <stop offset="100%" stopColor="#2a0404" />
              </radialGradient>
              <linearGradient id="reactCsChipGold" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#92400e" />
                <stop offset="35%" stopColor="#fde047" />
                <stop offset="70%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
            </defs>

            <g transform="translate(0, 6)">
              <ellipse cx="110" cy="184" rx="68" ry="15" fill="url(#reactCsChipGold)" stroke="#fef08a" strokeWidth="1.5" />
              <ellipse cx="110" cy="174" rx="66" ry="14" fill="url(#reactCsChipGold)" stroke="#fef08a" strokeWidth="1.5" />
              <ellipse cx="110" cy="164" rx="64" ry="13" fill="url(#reactCsChipGold)" stroke="#fef08a" strokeWidth="1.5" />
            </g>

            <circle cx="110" cy="96" r="74" fill="url(#reactCsGoldRim)" stroke="#451a03" strokeWidth="3" />
            <circle cx="110" cy="96" r="65" fill="none" stroke="#fffbeb" strokeWidth="2" strokeDasharray="7 6" />
            <circle cx="110" cy="96" r="56" fill="url(#reactCsBadgeCore)" stroke="#fbbf24" strokeWidth="2.5" />

            <text x="110" y="62" textAnchor="middle" fill="#fde047" fontSize="13" fontWeight="900" fontFamily="Georgia, serif" letterSpacing="2">
              ★ VEGAS ★
            </text>
            <text x="110" y="108" textAnchor="middle" fill="#fffbeb" fontSize="40" fontWeight="900" fontFamily="Georgia, serif" stroke="#78350f" strokeWidth="1.4">
              777
            </text>
            <text x="110" y="132" textAnchor="middle" fill="#fde68a" fontSize="11" fontWeight="900" fontFamily="Georgia, serif" letterSpacing="2">
              JACKPOT
            </text>
          </svg>
        </div>
      </div>

      <div className="cs-victory-prize-card">
        <div className="text-[10px] font-extrabold text-amber-200 uppercase tracking-[2px] mb-1">
          PRÊMIO LAS VEGAS
        </div>
        <div className="limbo-victory-amount">
          {displayAmount.toLocaleString('pt-BR')} FICHAS
        </div>
        <div className="mt-1 text-xs font-bold text-rose-300">
          {label} · Multiplicador {multiplier}x!
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
