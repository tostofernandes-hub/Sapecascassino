import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '../utils/audio';
import { ConfettiCelebration } from './ConfettiCelebration';

interface CardVictoryModalProps {
  isOpen: boolean;
  winAmount: number;
  subtitle?: string;
  detail?: string;
  onClose: () => void;
}

const CHIP_PARTICLES = Array.from({ length: 16 }, (_, i) => {
  const colors = ['#dc2626', '#f59e0b', '#059669', '#2563eb', '#9333ea'];
  return {
    id: i,
    left: `${(5 + ((i * 6.1) % 90)).toFixed(1)}%`,
    size: 14 + (i % 4) * 5,
    duration: `${(5.2 + (i % 5) * 1.1).toFixed(1)}s`,
    delay: `${-(((i * 0.7) % 5)).toFixed(1)}s`,
    color: colors[i % colors.length]
  };
});

const SPARKLE_PARTICLES = Array.from({ length: 14 }, (_, s) => ({
  id: s,
  left: `${(8 + ((s * 7.3) % 86)).toFixed(1)}%`,
  top: `${(8 + ((s * 11.7) % 82)).toFixed(1)}%`,
  fontSize: 10 + (s % 3) * 5,
  duration: `${(1.6 + (s % 4) * 0.5).toFixed(1)}s`,
  delay: `${(s * 0.25).toFixed(2)}s`
}));

export const CardVictoryModal: React.FC<CardVictoryModalProps> = ({
  isOpen,
  winAmount,
  subtitle = 'MESA DE PÔQUER IMPERIAL',
  detail = '',
  onClose
}) => {
  const [displayAmount, setDisplayAmount] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const target = Math.max(0, Math.round(winAmount));
    setDisplayAmount(0);
    setIsFinished(false);

    if (target >= 500) {
      soundManager.playJackpot();
    } else {
      soundManager.playWin();
    }

    const duration = Math.min(2200, Math.max(1000, 900 + Math.log10(Math.max(10, target)) * 280));
    const startTime = performance.now();
    let lastTick = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayAmount(Math.round(eased * target));

      if (now - lastTick > 160) {
        soundManager.playCoinTally();
        lastTick = now;
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayAmount(target);
        setIsFinished(true);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen, winAmount]);

  if (!isOpen) return null;

  const target = Math.max(0, Math.round(winAmount));

  const handleAccelerate = () => {
    if (!isFinished) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setDisplayAmount(target);
      setIsFinished(true);
      soundManager.playCoinTally();
    }
  };

  const handleRecolher = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundManager.playChip();
    onClose();
  };

  return (
    <>
      <ConfettiCelebration
        isActive={isOpen && target > 0}
        winAmount={target}
        intensity={target >= 500 ? 'high' : 'medium'}
        zIndex={150}
      />
      <div
        onClick={handleAccelerate}
        role="dialog"
        aria-modal="true"
        aria-label="Vitória nas Cartas"
        className="card-win-fade-in fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-hidden select-none cursor-pointer"
        style={{
          background: 'radial-gradient(circle at 50% 45%, rgba(28, 10, 6, 0.88) 0%, rgba(5, 2, 2, 0.95) 75%)',
          backdropFilter: 'blur(8px)'
        }}
      >
        {/* Central Pulsing Golden Halo */}
        <div
          aria-hidden="true"
          className="card-win-ambient-halo absolute w-[520px] h-[520px] rounded-full pointer-events-none blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(251, 191, 36, 0.28) 0%, rgba(180, 83, 9, 0.15) 45%, transparent 72%)'
          }}
        />

        {/* Floating Casino Chips & Twinkling Sparkles */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
          {CHIP_PARTICLES.map((p) => (
            <div
              key={p.id}
              className="card-win-chip-fall absolute -top-8 rounded-full border-2 border-dashed border-white/75 shadow-lg"
              style={{
                left: p.left,
                width: `${p.size}px`,
                height: `${p.size}px`,
                background: `radial-gradient(circle, ${p.color} 45%, #111 100%)`,
                animationDuration: p.duration,
                animationDelay: p.delay
              }}
            />
          ))}
          {SPARKLE_PARTICLES.map((s) => (
            <div
              key={s.id}
              className="card-win-sparkle absolute text-yellow-300"
              style={{
                left: s.left,
                top: s.top,
                fontSize: `${s.fontSize}px`,
                textShadow: '0 0 8px rgba(251, 191, 36, 0.95)',
                animationDuration: s.duration,
                animationDelay: s.delay
              }}
            >
              ✦
            </div>
          ))}
        </div>

        {/* Central Pulsing Salon Card Frame */}
        <div
          className="card-win-pulse-frame relative z-10 w-full max-w-[420px] min-h-[440px] max-h-[90vh] rounded-3xl border-2 border-amber-400/85 px-5 py-6 flex flex-col items-center justify-between text-center overflow-hidden"
          style={{
            background: 'radial-gradient(ellipse at 50% 35%, #2a0e08 0%, #140503 65%, #090201 100%)'
          }}
        >
          {/* Creative Background SVG: Classic Gaming Salon Croupier Silhouette + High-Roller Poker Table + Chip Stacks */}
          <svg
            viewBox="0 0 420 440"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none opacity-85"
          >
            <defs>
              <linearGradient id="salonGoldStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fde047" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#b45309" stopOpacity="0.28" />
              </linearGradient>
              <linearGradient id="croupierBody" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1f0906" />
                <stop offset="100%" stopColor="#090201" />
              </linearGradient>
            </defs>

            {/* Decorative Classic Salon Arch */}
            <path d="M 35 420 L 35 120 Q 210 15 385 120 L 385 420" fill="none" stroke="url(#salonGoldStroke)" strokeWidth="1.2" strokeDasharray="6 6" />
            <circle cx="210" cy="148" r="95" fill="rgba(251, 191, 36, 0.06)" stroke="url(#salonGoldStroke)" strokeWidth="1" />

            {/* Stylized Dark Silhouette of Tuxedoed Croupier / Dealer */}
            <g transform="translate(210, 152)">
              <path d="M -26 -46 C -28 -68 -14 -82 0 -82 C 14 -82 28 -68 26 -46 C 24 -32 16 -24 0 -24 C -16 -24 -24 -32 -26 -46 Z" fill="url(#croupierBody)" stroke="#f59e0b" strokeOpacity="0.55" strokeWidth="1.4" />
              <path d="M -32 -60 L 32 -60 L 24 -76 L -24 -76 Z" fill="#120402" stroke="#fbbf24" strokeOpacity="0.5" strokeWidth="1" />
              <path d="M -14 -24 L -88 12 L -98 92 L 98 92 L 88 12 L 14 -24 Z" fill="url(#croupierBody)" stroke="#f59e0b" strokeOpacity="0.55" strokeWidth="1.4" />
              <polygon points="0,-14 -12,-20 -12,-8" fill="#d97706" fillOpacity="0.65" />
              <polygon points="0,-14 12,-20 12,-8" fill="#d97706" fillOpacity="0.65" />
              <circle cx="0" cy="-14" r="3" fill="#fde047" fillOpacity="0.7" />
            </g>

            {/* High-Roller Curved Poker Table & Chip Stacks */}
            <g transform="translate(210, 315)">
              <ellipse cx="0" cy="0" rx="195" ry="62" fill="#180604" stroke="#f59e0b" strokeOpacity="0.55" strokeWidth="2" />
              <ellipse cx="0" cy="0" rx="170" ry="48" fill="#220905" stroke="#fde047" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="5 4" />
              <g fill="#1c0805" stroke="#fbbf24" strokeOpacity="0.65" strokeWidth="1.1">
                <ellipse cx="-135" cy="8" rx="14" ry="5" />
                <ellipse cx="-135" cy="3" rx="14" ry="5" />
                <ellipse cx="-135" cy="-2" rx="14" ry="5" />
                <ellipse cx="-135" cy="-7" rx="14" ry="5" />
                <ellipse cx="-108" cy="14" rx="14" ry="5" />
                <ellipse cx="-108" cy="9" rx="14" ry="5" />
                <ellipse cx="-108" cy="4" rx="14" ry="5" />
                <ellipse cx="135" cy="8" rx="14" ry="5" />
                <ellipse cx="135" cy="3" rx="14" ry="5" />
                <ellipse cx="135" cy="-2" rx="14" ry="5" />
                <ellipse cx="135" cy="-7" rx="14" ry="5" />
                <ellipse cx="108" cy="14" rx="14" ry="5" />
                <ellipse cx="108" cy="9" rx="14" ry="5" />
                <ellipse cx="108" cy="4" rx="14" ry="5" />
              </g>
              <g transform="translate(-18, -18) rotate(-14)">
                <rect x="0" y="0" width="24" height="34" rx="3" fill="#140503" stroke="#fbbf24" strokeOpacity="0.6" strokeWidth="1.1" />
                <text x="12" y="21" textAnchor="middle" fill="#fbbf24" fillOpacity="0.55" fontSize="13">♠</text>
              </g>
              <g transform="translate(2, -16) rotate(12)">
                <rect x="0" y="0" width="24" height="34" rx="3" fill="#140503" stroke="#fbbf24" strokeOpacity="0.6" strokeWidth="1.1" />
                <text x="12" y="21" textAnchor="middle" fill="#fbbf24" fillOpacity="0.55" fontSize="13">♥</text>
              </g>
            </g>
          </svg>

          {/* Top Banner */}
          <div className="relative z-10 w-full">
            <div className="font-cinzel text-[11px] font-black tracking-[0.28em] text-amber-300 uppercase mb-1.5 drop-shadow-[0_2px_4px_#000]">
              SALÃO DE JOGOS CLÁSSICO
            </div>
            <div
              className="font-serif font-black text-4xl sm:text-5xl leading-none tracking-[3px] uppercase"
              style={{
                background: 'linear-gradient(180deg, #fffbeb 0%, #fde047 35%, #f59e0b 75%, #b45309 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                WebkitTextStroke: '1.5px #450a0a',
                filter: 'drop-shadow(0 4px 0 #450a0a) drop-shadow(0 8px 18px rgba(0,0,0,0.95)) drop-shadow(0 0 22px rgba(251,191,36,0.65))'
              }}
            >
              VITÓRIA!
            </div>
            <div className="font-cinzel text-[11px] font-extrabold text-orange-200 tracking-[0.18em] uppercase mt-2">
              {subtitle}
            </div>
          </div>

          {/* Center Prize Value */}
          <div className="relative z-10 my-auto py-4">
            <div
              className="font-serif font-black text-3xl sm:text-4xl text-amber-50 tabular-nums"
              style={{
                textShadow: '0 3px 0 #78350f, 0 6px 14px rgba(0,0,0,0.95), 0 0 26px rgba(251,191,36,0.85)',
                WebkitTextStroke: '1px #78350f'
              }}
            >
              {displayAmount.toLocaleString('pt-BR')} FICHAS
            </div>
            {detail && (
              <div className="text-xs font-bold text-amber-200 mt-1.5 drop-shadow-[0_2px_4px_#000]">
                {detail}
              </div>
            )}
          </div>

          {/* Bottom Rustic RECOLHER Button */}
          <div className="relative z-10 w-full flex flex-col items-center gap-2">
            <div className={`text-[10px] font-bold text-amber-300/80 ${isFinished ? 'invisible' : 'visible'}`}>
              Toque na tela para acelerar
            </div>
            <button
              type="button"
              onClick={handleRecolher}
              className="w-full max-w-[260px] py-3 px-6 rounded-xl font-serif font-black text-base tracking-[2.5px] uppercase text-yellow-200 border-2 border-amber-400 cursor-pointer flex items-center justify-between transition-all hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0.5"
              style={{
                background: 'linear-gradient(180deg, #7f1d1d 0%, #450a0a 60%, #2a0505 100%)',
                boxShadow: '0 6px 20px rgba(0,0,0,0.85), 0 0 18px rgba(251,191,36,0.35), inset 0 1px 0 rgba(254,240,138,0.45)'
              }}
            >
              <span>✦</span>
              <span>RECOLHER</span>
              <span>✦</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
