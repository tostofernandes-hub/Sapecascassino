import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '../utils/audio';
import { ConfettiCelebration } from './ConfettiCelebration';

export type LiarsRevealCardType = 'A' | 'K' | 'Q' | 'DEVIL';

export interface LiarsRevealCard {
  id: string;
  type: LiarsRevealCardType;
}

interface LiarsBarVictoryModalProps {
  isOpen: boolean;
  winAmount: number;
  cards?: LiarsRevealCard[];
  tableTarget?: 'A' | 'K' | 'Q';
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

const CARD_META: Record<
  LiarsRevealCardType,
  { rank: string; suit: string; label: string; isDevil?: boolean }
> = {
  A: { rank: 'A', suit: '♠', label: 'ÁS' },
  K: { rank: 'K', suit: '👑', label: 'REI' },
  Q: { rank: 'Q', suit: '♥', label: 'DAMA' },
  DEVIL: { rank: '😈', suit: '🔥', label: 'DIABO', isDevil: true }
};

export const LiarsBarVictoryModal: React.FC<LiarsBarVictoryModalProps> = ({
  isOpen,
  winAmount,
  cards,
  tableTarget = 'K',
  subtitle = "LIAR'S BAR · ÚLTIMO SOBREVIVENTE",
  detail = 'Mesa de Blefe & Roleta Russa',
  onClose
}) => {
  const [displayAmount, setDisplayAmount] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [flippedCount, setFlippedCount] = useState<number>(0);
  const rafRef = useRef<number | null>(null);

  const showcaseCards: LiarsRevealCard[] =
    cards && cards.length > 0
      ? cards
      : [
          { id: 'win-1', type: tableTarget },
          { id: 'win-2', type: 'DEVIL' },
          { id: 'win-3', type: tableTarget }
        ];

  useEffect(() => {
    if (!isOpen) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setFlippedCount(0);
      return;
    }

    const target = Math.max(0, Math.round(winAmount));
    setDisplayAmount(0);
    setIsFinished(false);
    setFlippedCount(0);

    if (target >= 500) {
      soundManager.playJackpot();
    } else {
      soundManager.playWin();
    }

    // Sequential 3D left-to-right card reveal inside the victory modal
    const flipTimers: number[] = showcaseCards.map((_, idx) =>
      window.setTimeout(() => {
        setFlippedCount(idx + 1);
        soundManager.playCardDeal();
      }, 240 + idx * 300)
    );

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
      flipTimers.forEach((t) => window.clearTimeout(t));
    };
  }, [isOpen, winAmount, showcaseCards.length]);

  if (!isOpen) return null;

  const target = Math.max(0, Math.round(winAmount));

  const handleAccelerate = () => {
    if (!isFinished) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setDisplayAmount(target);
      setIsFinished(true);
      setFlippedCount(showcaseCards.length);
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
        aria-label="Vitória no Liar's Bar"
        className="card-win-fade-in fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-hidden select-none cursor-pointer"
        style={{
          background: 'radial-gradient(circle at 50% 45%, rgba(28, 10, 6, 0.88) 0%, rgba(5, 2, 2, 0.95) 75%)',
          backdropFilter: 'blur(8px)'
        }}
      >
        {/* Central Pulsing Golden Halo */}
        <div
          aria-hidden="true"
          className="card-win-ambient-halo absolute w-[540px] h-[540px] rounded-full pointer-events-none blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(251, 191, 36, 0.32) 0%, rgba(180, 83, 9, 0.16) 45%, transparent 72%)'
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

        {/* Central Pulsing Salon Card Frame with Golden Glow */}
        <div
          className="card-win-pulse-frame relative z-10 w-full max-w-[430px] min-h-[470px] max-h-[92vh] rounded-3xl border-2 border-amber-400/90 px-5 py-5 flex flex-col items-center justify-between text-center overflow-hidden"
          style={{
            background: 'radial-gradient(ellipse at 50% 35%, #2a0e08 0%, #140503 65%, #090201 100%)'
          }}
        >
          {/* Background SVG: Classic Gaming Salon Arch + Croupier Silhouette + Poker Table */}
          <svg
            viewBox="0 0 420 440"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none opacity-80"
          >
            <defs>
              <linearGradient id="liarsSalonStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fde047" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#b45309" stopOpacity="0.28" />
              </linearGradient>
              <linearGradient id="liarsCroupierBody" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1f0906" />
                <stop offset="100%" stopColor="#090201" />
              </linearGradient>
            </defs>

            <path
              d="M 35 420 L 35 120 Q 210 15 385 120 L 385 420"
              fill="none"
              stroke="url(#liarsSalonStroke)"
              strokeWidth="1.2"
              strokeDasharray="6 6"
            />
            <circle
              cx="210"
              cy="148"
              r="95"
              fill="rgba(251, 191, 36, 0.06)"
              stroke="url(#liarsSalonStroke)"
              strokeWidth="1"
            />

            <g transform="translate(210, 152)">
              <path
                d="M -26 -46 C -28 -68 -14 -82 0 -82 C 14 -82 28 -68 26 -46 C 24 -32 16 -24 0 -24 C -16 -24 -24 -32 -26 -46 Z"
                fill="url(#liarsCroupierBody)"
                stroke="#f59e0b"
                strokeOpacity="0.55"
                strokeWidth="1.4"
              />
              <path
                d="M -32 -60 L 32 -60 L 24 -76 L -24 -76 Z"
                fill="#120402"
                stroke="#fbbf24"
                strokeOpacity="0.5"
                strokeWidth="1"
              />
              <path
                d="M -14 -24 L -88 12 L -98 92 L 98 92 L 88 12 L 14 -24 Z"
                fill="url(#liarsCroupierBody)"
                stroke="#f59e0b"
                strokeOpacity="0.55"
                strokeWidth="1.4"
              />
              <polygon points="0,-14 -12,-20 -12,-8" fill="#d97706" fillOpacity="0.65" />
              <polygon points="0,-14 12,-20 12,-8" fill="#d97706" fillOpacity="0.65" />
              <circle cx="0" cy="-14" r="3" fill="#fde047" fillOpacity="0.7" />
            </g>

            <g transform="translate(210, 325)">
              <ellipse cx="0" cy="0" rx="195" ry="62" fill="#180604" stroke="#f59e0b" strokeOpacity="0.55" strokeWidth="2" />
              <ellipse
                cx="0"
                cy="0"
                rx="170"
                ry="48"
                fill="#220905"
                stroke="#fde047"
                strokeOpacity="0.3"
                strokeWidth="1"
                strokeDasharray="5 4"
              />
            </g>
          </svg>

          {/* Top Title Banner */}
          <div className="relative z-10 w-full">
            <div className="font-cinzel text-[11px] font-black tracking-[0.26em] text-amber-300 uppercase mb-1 drop-shadow-[0_2px_4px_#000]">
              TAVERNA DO BLEFE · MESA VIP
            </div>
            <div
              className="font-serif font-black text-4xl sm:text-5xl leading-none tracking-[3px] uppercase"
              style={{
                background: 'linear-gradient(180deg, #fffbeb 0%, #fde047 35%, #f59e0b 75%, #b45309 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                WebkitTextStroke: '1.5px #450a0a',
                filter:
                  'drop-shadow(0 4px 0 #450a0a) drop-shadow(0 8px 18px rgba(0,0,0,0.95)) drop-shadow(0 0 22px rgba(251,191,36,0.65))'
              }}
            >
              VITÓRIA!
            </div>
            <div className="font-cinzel text-[11px] font-extrabold text-orange-200 tracking-[0.16em] uppercase mt-1.5">
              {subtitle}
            </div>
          </div>

          {/* 3D Sequential Card Reveal Row with Golden Glow */}
          <div
            aria-label="Revelação 3D das cartas vencedoras"
            className="relative z-10 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 my-2"
            style={{ perspective: '1200px' }}
          >
            {showcaseCards.map((card, idx) => {
              const isFlipped = idx < flippedCount;
              const meta = CARD_META[card.type] || CARD_META.K;
              return (
                <div key={card.id || idx} style={{ perspective: '1200px' }}>
                  <div
                    className="relative w-14 h-20 sm:w-16 sm:h-24 rounded-xl"
                    style={{
                      transformStyle: 'preserve-3d',
                      transition: 'transform 0.56s cubic-bezier(0.22, 1, 0.36, 1)',
                      transform: isFlipped
                        ? 'rotateY(180deg) rotateX(3deg) translateZ(10px)'
                        : 'rotateY(0deg)'
                    }}
                  >
                    {/* Back face (0deg) */}
                    <div
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(0deg) translateZ(1px)',
                        boxShadow:
                          '-3px 4px 0 #450a0a, -6px 12px 22px rgba(0,0,0,0.85), inset 0 1px 0 rgba(251,191,36,0.55)'
                      }}
                      className="absolute inset-0 rounded-xl border-2 border-amber-500/80 bg-gradient-to-br from-[#3b0a06] via-[#220604] to-[#140202] flex items-center justify-center overflow-hidden"
                    >
                      <div className="absolute inset-1.5 border border-amber-400/50 rounded-lg flex items-center justify-center bg-[#1e0705]">
                        <div className="w-7 h-7 rounded-full border-2 border-amber-400 bg-gradient-to-br from-amber-600 via-red-700 to-amber-900 flex items-center justify-center text-amber-200 font-cinzel font-black text-xs">
                          ♠
                        </div>
                      </div>
                    </div>

                    {/* Front face (180deg) with Golden Glow */}
                    <div
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg) translateZ(1px)',
                        boxShadow:
                          '0 0 22px rgba(251, 191, 36, 0.85), -3px 5px 0 #b45309, -6px 14px 24px rgba(0,0,0,0.75), inset 0 1px 0 #ffffff'
                      }}
                      className={`absolute inset-0 rounded-xl border-2 flex flex-col justify-between p-1.5 ${
                        isFlipped ? 'liars-win-card-glow' : ''
                      } ${
                        meta.isDevil
                          ? 'bg-gradient-to-b from-[#3b0764] via-[#24043d] to-[#140224] border-amber-300 text-amber-200'
                          : 'bg-gradient-to-b from-[#fffbeb] via-[#fef9e7] to-[#fde68a] border-amber-400 text-slate-900'
                      }`}
                    >
                      <span className="text-[11px] font-black leading-none self-start">
                        {meta.rank}
                      </span>
                      <span className="text-xl sm:text-2xl leading-none self-center drop-shadow-[0_2px_4px_rgba(245,158,11,0.45)]">
                        {meta.suit}
                      </span>
                      <span className="text-[8px] sm:text-[9px] font-cinzel font-black tracking-wider uppercase self-end">
                        {meta.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Center Prize Value */}
          <div className="relative z-10 my-auto py-2">
            <div
              className="font-serif font-black text-3xl sm:text-4xl text-amber-50 tabular-nums"
              style={{
                textShadow:
                  '0 3px 0 #78350f, 0 6px 14px rgba(0,0,0,0.95), 0 0 26px rgba(251,191,36,0.85)',
                WebkitTextStroke: '1px #78350f'
              }}
            >
              {displayAmount.toLocaleString('pt-BR')} FICHAS
            </div>
            {detail && (
              <div className="text-xs font-bold text-amber-200 mt-1 drop-shadow-[0_2px_4px_#000]">
                {detail}
              </div>
            )}
          </div>

          {/* Bottom Rustic RECOLHER Button */}
          <div className="relative z-10 w-full flex flex-col items-center gap-2">
            <div
              className={`text-[10px] font-bold text-amber-300/80 ${
                isFinished ? 'invisible' : 'visible'
              }`}
            >
              Toque na tela para acelerar
            </div>
            <button
              type="button"
              onClick={handleRecolher}
              className="w-full max-w-[260px] py-3 px-6 rounded-xl font-serif font-black text-base tracking-[2.5px] uppercase text-yellow-200 border-2 border-amber-400 cursor-pointer flex items-center justify-between transition-all hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0.5"
              style={{
                background: 'linear-gradient(180deg, #7f1d1d 0%, #450a0a 60%, #2a0505 100%)',
                boxShadow:
                  '0 6px 20px rgba(0,0,0,0.85), 0 0 18px rgba(251,191,36,0.45), inset 0 1px 0 rgba(254,240,138,0.45)'
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
