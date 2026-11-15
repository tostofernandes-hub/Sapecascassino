import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '../utils/audio';

interface DragonEggVictoryOverlayProps {
  isOpen: boolean;
  winAmount: number;
  mult: number;
  round: number;
  onCollect: () => void;
}

export const DragonEggVictoryOverlay: React.FC<DragonEggVictoryOverlayProps> = ({
  isOpen,
  winAmount,
  mult,
  round,
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

        interface FireParticle {
          x: number;
          y: number;
          vx: number;
          vy: number;
          r: number;
          life: number;
          maxLife: number;
          kind: 'fire' | 'ember';
          color: string;
        }

        const particles: FireParticle[] = [];
        const firePalette = ['#fffbeb', '#fde047', '#f59e0b', '#ea580c', '#dc2626'];
        const openedAt = performance.now();

        const spawnBreath = (w: number, h: number) => {
          const mouthX = w * 0.5;
          const mouthY = h * 0.44;
          for (let i = 0; i < 4; i++) {
            const spreadAngle = (Math.random() - 0.5) * 0.72;
            const speed = (2.6 + Math.random() * 4.4) * dpr;
            particles.push({
              x: mouthX + (Math.random() - 0.5) * 14 * dpr,
              y: mouthY + (Math.random() - 0.5) * 8 * dpr,
              vx: Math.sin(spreadAngle) * speed,
              vy: (1.5 + Math.random() * 2.2) * dpr,
              r: (7 + Math.random() * 11) * dpr,
              life: 0,
              maxLife: 0.45 + Math.random() * 0.38,
              kind: 'fire',
              color: firePalette[Math.floor(Math.random() * firePalette.length)]
            });
          }
          if (Math.random() < 0.55) {
            particles.push({
              x: w * (0.15 + Math.random() * 0.7),
              y: h * (0.55 + Math.random() * 0.35),
              vx: (Math.random() - 0.5) * 0.9 * dpr,
              vy: -(0.8 + Math.random() * 1.8) * dpr,
              r: (1.5 + Math.random() * 2.4) * dpr,
              life: 0,
              maxLife: 1.0 + Math.random() * 0.9,
              kind: 'ember',
              color: Math.random() < 0.6 ? '#fde047' : '#fb923c'
            });
          }
        };

        let last = performance.now();
        const renderFx = (now: number) => {
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // Dragão surge gradualmente nos primeiros 700ms e passa a cuspir fogo continuamente
          if (now - openedAt > 620) {
            spawnBreath(w, h);
          }

          for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life += dt;
            if (p.life >= p.maxLife) {
              particles.splice(i, 1);
              continue;
            }
            const t = p.life / p.maxLife;
            p.x += p.vx * (dt * 60);
            p.y += p.vy * (dt * 60);

            if (p.kind === 'fire') {
              p.vx *= 0.985;
              p.vy *= 0.99;
              const radius = p.r * (0.65 + t * 1.15);
              const alpha = (1 - t) * 0.78;
              ctx.save();
              ctx.globalCompositeOperation = 'lighter';
              ctx.globalAlpha = Math.max(0, alpha);
              const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
              grad.addColorStop(0, '#fffbeb');
              grad.addColorStop(0.42, p.color);
              grad.addColorStop(1, 'rgba(220, 38, 38, 0)');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            } else {
              const alpha = Math.sin(t * Math.PI) * 0.85;
              ctx.save();
              ctx.globalAlpha = Math.max(0, alpha);
              ctx.fillStyle = p.color;
              ctx.shadowColor = '#f59e0b';
              ctx.shadowBlur = 8 * dpr;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
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
      className="de-victory-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={handleAccelerate}
    >
      <div className="de-victory-glow" />

      <div className="relative z-10 text-center flex flex-col items-center gap-1.5">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-950/85 border border-amber-400/75 text-amber-200 text-[11px] font-extrabold tracking-widest uppercase shadow-[0_0_20px_rgba(245,158,11,0.35)]">
          🐉 OVO DO DRAGÃO · RODADA {round} ({mult}x)
        </div>
        <h2 className="de-victory-title m-0">VITÓRIA!</h2>
      </div>

      {/* Palco 3D com Dragão Detalhado (Escamas, Asas, Olhos Brilhantes) */}
      <div className="de-victory-stage">
        <div className="de-dragon-3d-emerge">
          <div className="de-dragon-3d-shadow" />
          <svg viewBox="0 0 360 220" className="w-full h-full overflow-visible drop-shadow-[0_14px_24px_rgba(0,0,0,0.88)]">
            <defs>
              <linearGradient id="reactDeWingMembrane" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="55%" stopColor="#7f1d1d" />
                <stop offset="100%" stopColor="#3b0764" />
              </linearGradient>
              <linearGradient id="reactDeScaleBody" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="45%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#7c2d12" />
              </linearGradient>
              <linearGradient id="reactDeHornGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fffbeb" />
                <stop offset="50%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
              <radialGradient id="reactDeEyeGlow" cx="50%" cy="50%" r="55%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="45%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#ea580c" />
              </radialGradient>
            </defs>

            {/* Asa Esquerda Articulada */}
            <g className="de-wing-flap-left">
              <path
                d="M 152,110 Q 92,38 22,26 Q 48,74 36,118 Q 74,104 94,132 Q 124,116 146,128 Z"
                fill="url(#reactDeWingMembrane)"
                stroke="#fbbf24"
                strokeWidth="2"
              />
              <path d="M 150,110 L 22,26 M 148,116 L 38,116 M 146,122 L 94,130" stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="22" cy="26" r="3" fill="#fef08a" />
            </g>

            {/* Asa Direita Articulada */}
            <g className="de-wing-flap-right">
              <path
                d="M 208,110 Q 268,38 338,26 Q 312,74 324,118 Q 286,104 266,132 Q 236,116 214,128 Z"
                fill="url(#reactDeWingMembrane)"
                stroke="#fbbf24"
                strokeWidth="2"
              />
              <path d="M 210,110 L 338,26 M 212,116 L 322,116 M 214,122 L 266,130" stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="338" cy="26" r="3" fill="#fef08a" />
            </g>

            {/* Pescoço e Peito com Escamas Sobrepostas */}
            <path d="M 142,162 Q 180,180 218,162 L 204,108 Q 180,96 156,108 Z" fill="url(#reactDeScaleBody)" stroke="#fde047" strokeWidth="1.8" />
            <path d="M 158,128 Q 180,138 202,128 M 153,142 Q 180,154 207,142 M 148,156 Q 180,168 212,156" fill="none" stroke="#fef08a" strokeWidth="2" opacity="0.72" />
            {/* Crista Dorsal Dourada */}
            <polygon points="180,44 174,62 186,62" fill="#fde047" />
            <polygon points="180,62 173,78 187,78" fill="#fbbf24" />

            {/* Chifres Curvados 3D */}
            <path d="M 156,74 Q 124,38 110,16 Q 134,30 164,66 Z" fill="url(#reactDeHornGold)" stroke="#78350f" strokeWidth="1.4" />
            <path d="M 204,74 Q 236,38 250,16 Q 226,30 196,66 Z" fill="url(#reactDeHornGold)" stroke="#78350f" strokeWidth="1.4" />

            {/* Cabeça Esculpida do Dragão */}
            <path
              d="M 144,86 Q 148,58 180,56 Q 212,58 216,86 L 208,118 Q 180,136 152,118 Z"
              fill="url(#reactDeScaleBody)"
              stroke="#fef08a"
              strokeWidth="2.2"
            />
            {/* Escamas nas Bochechas */}
            <path d="M 148,96 Q 158,104 152,114 M 212,96 Q 202,104 208,114" fill="none" stroke="#fef08a" strokeWidth="1.6" opacity="0.8" />

            {/* Olhos Brilhantes */}
            <g className="de-dragon-eyes-glow">
              <ellipse cx="163" cy="88" rx="9" ry="5.5" transform="rotate(14 163 88)" fill="url(#reactDeEyeGlow)" stroke="#7c2d12" strokeWidth="1.2" />
              <ellipse cx="197" cy="88" rx="9" ry="5.5" transform="rotate(-14 197 88)" fill="url(#reactDeEyeGlow)" stroke="#7c2d12" strokeWidth="1.2" />
              <ellipse cx="164" cy="88" rx="2" ry="4.5" fill="#1c0402" />
              <ellipse cx="196" cy="88" rx="2" ry="4.5" fill="#1c0402" />
            </g>

            {/* Focinho, Presas & Núcleo de Fogo na Boca */}
            <path d="M 160,114 Q 180,126 200,114 Q 180,134 160,114 Z" fill="#450a0a" stroke="#fbbf24" strokeWidth="1.4" />
            <polygon points="166,115 170,124 174,117" fill="#fffbeb" />
            <polygon points="194,115 190,124 186,117" fill="#fffbeb" />
            <ellipse cx="180" cy="121" rx="10" ry="5" fill="#fde047" className="de-mouth-ember" />
          </svg>
        </div>
      </div>

      {/* Canvas de Fogo e Brasas por cima da boca do dragão */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-[12]"
      />

      <div className="de-victory-prize-card">
        <div className="text-[10px] font-extrabold text-amber-300 uppercase tracking-[2px] mb-1">
          TESOURO DO DRAGÃO
        </div>
        <div className="limbo-victory-amount">
          {displayAmount.toLocaleString('pt-BR')} FICHAS
        </div>
        <div className="mt-1 text-xs font-bold text-amber-200">
          Dragão chocado na Rodada {round} · {mult}x garantido!
        </div>
      </div>

      <div className="relative z-[15] w-full flex flex-col items-center gap-1.5">
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
