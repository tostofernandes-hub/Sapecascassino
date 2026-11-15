import React, { useEffect, useState, useRef, useId } from 'react';
import { soundManager } from '../utils/audio';
import { ConfettiCelebration, ConfettiIntensity } from './ConfettiCelebration';

interface FortuneDragonWinModalProps {
  isOpen: boolean;
  multiplier: number;
  winAmount: number;
  betAmount?: number;
  freeSpins?: number;
  confettiIntensity?: ConfettiIntensity;
  confettiColors?: string[];
  onClose: () => void;
}

interface DustParticle {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  phase: number;
  color: string;
}

const AIR_COINS = [
  { id: 'c1', style: { top: '14%', left: '7%', width: 'clamp(36px, 6.5vw, 56px)', height: 'clamp(36px, 6.5vw, 56px)', '--coin-dur': '4.1s', '--coin-delay': '-0.4s' } as React.CSSProperties },
  { id: 'c2', style: { top: '24%', right: '8%', width: 'clamp(36px, 6.5vw, 56px)', height: 'clamp(36px, 6.5vw, 56px)', '--coin-dur': '4.7s', '--coin-delay': '-1.6s' } as React.CSSProperties },
  { id: 'c3', style: { top: '48%', left: '5%', width: 'clamp(32px, 5.6vw, 48px)', height: 'clamp(32px, 5.6vw, 48px)', '--coin-dur': '3.8s', '--coin-delay': '-2.1s' } as React.CSSProperties },
  { id: 'c4', style: { top: '53%', right: '6%', width: 'clamp(34px, 6vw, 50px)', height: 'clamp(34px, 6vw, 50px)', '--coin-dur': '4.5s', '--coin-delay': '-0.9s' } as React.CSSProperties },
  { id: 'c5', style: { top: '11%', right: '20%', width: 'clamp(28px, 4.8vw, 42px)', height: 'clamp(28px, 4.8vw, 42px)', '--coin-dur': '5.0s', '--coin-delay': '-2.8s' } as React.CSSProperties },
  { id: 'c6', style: { top: '68%', left: '12%', width: 'clamp(32px, 5.2vw, 46px)', height: 'clamp(32px, 5.2vw, 46px)', '--coin-dur': '4.3s', '--coin-delay': '-1.2s' } as React.CSSProperties },
  { id: 'c7', style: { top: '67%', right: '13%', width: 'clamp(32px, 5.2vw, 46px)', height: 'clamp(32px, 5.2vw, 46px)', '--coin-dur': '3.9s', '--coin-delay': '-2.4s' } as React.CSSProperties }
];

const GROUND_COINS: Array<[number, number, number, number]> = [
  [150, 740, 1.1, 0.52],
  [230, 760, 1.2, 0.54],
  [310, 735, 1.0, 0.48],
  [885, 738, 1.05, 0.5],
  [965, 762, 1.22, 0.54],
  [1055, 742, 1.1, 0.52],
  [95, 775, 1.3, 0.58],
  [190, 782, 1.25, 0.56],
  [275, 778, 1.15, 0.52],
  [415, 775, 1.1, 0.5],
  [785, 778, 1.12, 0.5],
  [915, 782, 1.22, 0.54],
  [1015, 780, 1.3, 0.58],
  [1110, 775, 1.2, 0.54]
];

const CrossedRevolvers: React.FC<{ side: 'left' | 'right'; steelId: string }> = ({ side, steelId }) => (
  <svg
    viewBox="0 0 120 96"
    aria-hidden="true"
    className={`w-[50px] sm:w-[70px] h-[42px] sm:h-[58px] shrink-0 drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)] ${
      side === 'right' ? '-scale-x-100' : ''
    }`}
  >
    <g transform="translate(60,48) rotate(-28) translate(-46,-12)">
      <path d="M12 18 L24 18 L18 42 L4 36 Z" fill="#451a03" stroke="#f59e0b" strokeWidth="1.8" />
      <rect x="20" y="6" width="26" height="14" rx="3" fill={`url(#${steelId})`} stroke="#1e293b" strokeWidth="1.4" />
      <rect x="25" y="8" width="12" height="9" rx="2" fill="#94a3b8" />
      <circle cx="26" cy="23" r="4.5" fill="none" stroke="#e2e8f0" strokeWidth="2" />
      <rect x="44" y="6" width="44" height="7" rx="1.5" fill={`url(#${steelId})`} stroke="#1e293b" strokeWidth="1.2" />
      <polygon points="83,6 88,2 88,6" fill="#fde047" />
    </g>
    <g transform="translate(60,48) scale(-1,1) rotate(-28) translate(-46,-12)">
      <path d="M12 18 L24 18 L18 42 L4 36 Z" fill="#451a03" stroke="#f59e0b" strokeWidth="1.8" />
      <rect x="20" y="6" width="26" height="14" rx="3" fill={`url(#${steelId})`} stroke="#1e293b" strokeWidth="1.4" />
      <rect x="25" y="8" width="12" height="9" rx="2" fill="#94a3b8" />
      <circle cx="26" cy="23" r="4.5" fill="none" stroke="#e2e8f0" strokeWidth="2" />
      <rect x="44" y="6" width="44" height="7" rx="1.5" fill={`url(#${steelId})`} stroke="#1e293b" strokeWidth="1.2" />
      <polygon points="83,6 88,2 88,6" fill="#fde047" />
    </g>
  </svg>
);

export const FortuneDragonWinModal: React.FC<FortuneDragonWinModalProps> = ({
  isOpen,
  multiplier,
  winAmount,
  betAmount,
  confettiIntensity,
  confettiColors,
  onClose
}) => {
  const uid = useId().replace(/:/g, '');
  const [currentWinAmount, setCurrentWinAmount] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const animFrameRef = useRef<number | null>(null);
  const particleAnimRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isZeroWin = winAmount <= 0;

  // Falling golden dust / magic sparks canvas particles
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    const syncSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    syncSize();

    const colors = ['#fffbeb', '#fef08a', '#fde047', '#f59e0b'];
    const dust: DustParticle[] = Array.from({ length: 68 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 1.2 + Math.random() * 2.8,
      vy: 0.35 + Math.random() * 0.9,
      vx: (Math.random() - 0.5) * 0.35,
      phase: Math.random() * Math.PI * 2,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));

    const renderParticles = () => {
      if (!running) return;
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        syncSize();
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of dust) {
        p.phase += 0.03;
        p.y += p.vy;
        p.x += p.vx + Math.sin(p.phase) * 0.25;

        if (p.y > canvas.height + 10) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        const alpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(p.phase * 1.4));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      particleAnimRef.current = requestAnimationFrame(renderParticles);
    };

    particleAnimRef.current = requestAnimationFrame(renderParticles);

    return () => {
      running = false;
      if (particleAnimRef.current) cancelAnimationFrame(particleAnimRef.current);
    };
  }, [isOpen]);

  // 10-second smooth count-up (or click anywhere to finish immediately)
  useEffect(() => {
    if (!isOpen) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    if (isZeroWin) {
      setCurrentWinAmount(0);
      setIsFinished(true);
      return;
    }

    soundManager.playMultiplierHit();
    if (multiplier >= 20 || winAmount >= 500) {
      soundManager.playJackpot();
    } else {
      soundManager.playWin();
    }

    setCurrentWinAmount(0);
    setIsFinished(false);
    startTimeRef.current = null;

    const DURATION = 2400;
    let lastSoundTick = 0;

    const animateCount = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      const computedAmount = Math.round(eased * winAmount);

      setCurrentWinAmount(computedAmount);

      if (timestamp - lastSoundTick > 110) {
        soundManager.playCoinTally();
        lastSoundTick = timestamp;
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animateCount);
      } else {
        setCurrentWinAmount(winAmount);
        setIsFinished(true);
      }
    };

    animFrameRef.current = requestAnimationFrame(animateCount);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, multiplier, winAmount, isZeroWin]);

  const handleScreenClick = () => {
    if (!isFinished && !isZeroWin) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setCurrentWinAmount(winAmount);
      setIsFinished(true);
      soundManager.playCoinTally();
    }
  };

  const handleRecolher = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundManager.playChip();
    onClose();
  };

  if (!isOpen) return null;

  const formattedAmount = currentWinAmount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const amountFontSize = formattedAmount.length > 9 ? 82 : formattedAmount.length > 7 ? 96 : 112;

  const steelGradId = `revolverSteel-${uid}`;

  return (
    <>
      <ConfettiCelebration
        isActive={isOpen && !isZeroWin}
        winAmount={winAmount}
        betAmount={betAmount}
        multiplier={multiplier}
        intensity={confettiIntensity}
        colors={confettiColors}
        zIndex={160}
      />
      <div
        onClick={handleScreenClick}
        role="dialog"
        aria-modal="true"
        aria-label="Tela de Vitória"
        className="fixed inset-0 z-[120] w-full h-[100dvh] max-h-[100dvh] overflow-hidden select-none cursor-pointer"
        style={{
          background:
            'radial-gradient(circle at 50% 44%, #fef08a 0%, #f59e0b 24%, #92400e 52%, #2b0f04 82%, #120501 100%)'
        }}
      >
      {/* Shared SVG gradient defs for crossed revolvers */}
      <svg className="sr-only" aria-hidden="true">
        <defs>
          <linearGradient id={steelGradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="45%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
        </defs>
      </svg>

      {/* Wild West Scene + Blonde Cowgirl Silhouette + Breathing Motion */}
      <div className="western-scene-layer absolute -inset-[2%] w-[104%] h-[104%] pointer-events-none z-[1]">
        <svg className="w-full h-full block" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id={`wSky-${uid}`} cx="50%" cy="42%" r="65%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="22%" stopColor="#fde047" />
              <stop offset="48%" stopColor="#d97706" />
              <stop offset="78%" stopColor="#5c2107" />
              <stop offset="100%" stopColor="#1b0702" />
            </radialGradient>
            <linearGradient id={`wGround-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3a11" />
              <stop offset="45%" stopColor="#451a05" />
              <stop offset="100%" stopColor="#1c0802" />
            </linearGradient>
            <linearGradient id={`wHat-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="55%" stopColor="#f3ead8" />
              <stop offset="100%" stopColor="#cbb89d" />
            </linearGradient>
            <linearGradient id={`wJacket-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fffdf8" />
              <stop offset="55%" stopColor="#efe6d5" />
              <stop offset="100%" stopColor="#b9a489" />
            </linearGradient>
            <linearGradient id={`wHair-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#a16207" />
            </linearGradient>
            <linearGradient id={`wLeather-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#78350f" />
              <stop offset="100%" stopColor="#3b1604" />
            </linearGradient>
            <radialGradient id={`wCoin-${uid}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="35%" stopColor="#fde047" />
              <stop offset="75%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#92400e" />
            </radialGradient>
          </defs>

          <rect width="1200" height="800" fill={`url(#wSky-${uid})`} />

          {/* Canyon silhouettes */}
          <path d="M0 540 L0 390 L95 390 L130 330 L250 330 L295 415 L410 435 L465 490 L740 490 L815 410 L935 345 L1075 345 L1120 405 L1200 405 L1200 540 Z" fill="#3a1605" opacity="0.72" />
          <path d="M0 560 L0 450 L185 450 L235 495 L380 515 L840 515 L985 465 L1065 435 L1200 435 L1200 560 Z" fill="#260d02" opacity="0.88" />

          {/* Wooden frontier porches & cactus */}
          <g fill="#1c0802" opacity="0.9">
            <rect x="0" y="210" width="90" height="390" />
            <polygon points="0,210 120,210 95,255 0,255" />
            <rect x="115" y="245" width="16" height="340" />
            <rect x="1110" y="220" width="90" height="380" />
            <polygon points="1080,220 1200,220 1200,260 1105,260" />
            <rect x="1068" y="250" width="16" height="335" />
            <path d="M238 510 L238 430 Q238 422 246 422 Q254 422 254 430 L254 510 Z M238 468 Q218 468 218 446 Q218 438 225 438 Q232 438 232 446 L232 458 L238 458 Z M254 456 L262 456 L262 440 Q262 433 268 433 Q274 433 274 440 Q274 466 254 466 Z" />
          </g>

          {/* Dusty golden ground */}
          <rect x="0" y="540" width="1200" height="260" fill={`url(#wGround-${uid})`} />
          <ellipse cx="600" cy="560" rx="460" ry="48" fill="#fbbf24" opacity="0.22" />

          {/* Blonde Cowgirl in white hat & white outfit from behind, looking over shoulder with holster & silver revolver */}
          <g transform="translate(600, 500)">
            <ellipse cx="0" cy="-120" rx="150" ry="220" fill="#fef08a" opacity="0.24" />

            <path d="M-46 58 L-56 260 L-10 260 L-2 88 L8 88 L16 260 L64 260 L48 58 Z" fill={`url(#wJacket-${uid})`} stroke="#fef08a" strokeWidth="1.5" />
            <path d="M-2 88 L-6 260 M6 88 L12 260" stroke="#9a8268" strokeWidth="2" opacity="0.45" />

            <path d="M-54 -84 Q-82 -26 -64 38 L-42 36 Q-54 -18 -38 -70 Z" fill={`url(#wJacket-${uid})`} stroke="#fef08a" strokeWidth="1.2" />

            <path d="M-56 -88 Q0 -106 56 -88 L64 -26 Q52 12 48 64 L-48 64 Q-52 12 -64 -26 Z" fill={`url(#wJacket-${uid})`} stroke="#fef08a" strokeWidth="1.6" />
            <path d="M-52 -64 L0 -38 L52 -64" fill="none" stroke="#b9a489" strokeWidth="2.2" />
            <path d="M0 -38 L0 54" fill="none" stroke="#c8b39a" strokeWidth="1.8" opacity="0.65" />

            <path d="M52 -82 Q92 -42 114 26 L90 36 Q72 -18 40 -58 Z" fill={`url(#wJacket-${uid})`} stroke="#fef08a" strokeWidth="1.4" />
            <ellipse cx="104" cy="36" rx="12" ry="11" fill="#f6c7a4" stroke="#b45309" strokeWidth="1" />

            {/* Silver Revolver in Right Hand */}
            <g transform="translate(104, 34) rotate(28)">
              <path d="M-8 -4 L4 -2 L-2 22 L-16 18 Z" fill="#451a03" stroke="#d97706" strokeWidth="1.2" />
              <rect x="0" y="-12" width="32" height="14" rx="3" fill={`url(#${steelGradId})`} stroke="#ffffff" strokeWidth="1" />
              <rect x="8" y="-10" width="15" height="10" rx="2" fill="#94a3b8" stroke="#f8fafc" strokeWidth="0.9" />
              <circle cx="8" cy="5" r="5" fill="none" stroke="#cbd5e1" strokeWidth="2" />
              <rect x="30" y="-12" width="48" height="7" rx="1.5" fill={`url(#${steelGradId})`} stroke="#ffffff" strokeWidth="1" />
              <polygon points="73,-12 78,-16 78,-12" fill="#f8fafc" />
            </g>

            {/* Belt & Holster */}
            <path d="M-50 42 Q0 54 50 42 L52 58 Q0 70 -52 58 Z" fill={`url(#wLeather-${uid})`} stroke="#d97706" strokeWidth="1.4" />
            <rect x="-10" y="45" width="20" height="14" rx="3" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.2" />
            <path d="M36 50 L60 48 L54 114 L34 106 Z" fill={`url(#wLeather-${uid})`} stroke="#fbbf24" strokeWidth="1.4" />
            <path d="M40 60 L54 59" stroke="#f59e0b" strokeWidth="2" />

            {/* Face looking over right shoulder */}
            <path d="M-8 -124 C-8 -150 28 -152 34 -128 C38 -114 34 -96 22 -90 L-4 -92 Z" fill="#f6c7a4" stroke="#f59e0b" strokeWidth="1.2" />
            <path d="M22 -121 Q27 -123 30 -120" fill="none" stroke="#78350f" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="27" cy="-116" r="1.8" fill="#1e293b" />

            {/* Blonde hair flowing down back */}
            <path d="M-36 -142 Q-46 -92 -28 -52 Q-12 -32 8 -54 Q22 -74 16 -108 Q8 -138 -16 -144 Z" fill={`url(#wHair-${uid})`} stroke="#fef08a" strokeWidth="1.2" />
            <path d="M-24 -128 Q-34 -90 -18 -58 M-8 -126 Q-14 -88 -2 -56" fill="none" stroke="#fef9c3" strokeWidth="2" opacity="0.65" />

            {/* White Cowboy Hat */}
            <g transform="translate(2, -150) rotate(-6)">
              <ellipse cx="0" cy="8" rx="64" ry="15" fill="#9a8268" />
              <path d="M-68 6 Q0 22 68 6 Q48 -8 0 -6 Q-48 -8 -68 6 Z" fill={`url(#wHat-${uid})`} stroke="#fef08a" strokeWidth="1.8" />
              <path d="M-32 0 L-24 -36 Q0 -44 24 -36 L32 0 Z" fill={`url(#wHat-${uid})`} stroke="#fef08a" strokeWidth="1.6" />
              <path d="M-31 -4 Q0 3 31 -4 L30 -11 Q0 -4 -30 -11 Z" fill="#92400e" stroke="#fde047" strokeWidth="1" />
            </g>
          </g>

          {/* Scattered Ground Gold Coins */}
          <g>
            {GROUND_COINS.map(([x, y, sx, sy], idx) => (
              <g key={idx} transform={`translate(${x},${y}) scale(${sx},${sy})`}>
                <ellipse cx="0" cy="7" rx="28" ry="28" fill="#78350f" />
                <circle cx="0" cy="0" r="28" fill={`url(#wCoin-${uid})`} stroke="#fef08a" strokeWidth="3" />
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Central Pulsing Sun / Golden Portal Halo */}
      <div
        aria-hidden="true"
        className="western-sun-portal absolute top-[42%] left-1/2 rounded-full pointer-events-none z-[2]"
        style={{
          width: 'min(76vw, 480px)',
          height: 'min(76vw, 480px)',
          background:
            'radial-gradient(circle, rgba(255,251,235,0.92) 0%, rgba(254,240,138,0.72) 26%, rgba(245,158,11,0.42) 54%, rgba(217,119,6,0.12) 74%, transparent 100%)',
          boxShadow: '0 0 70px rgba(251,191,36,0.8), inset 0 0 42px rgba(255,255,255,0.75)'
        }}
      >
        <div
          className="absolute inset-[6%] rounded-full border-[3px] border-amber-200/75"
          style={{
            boxShadow: '0 0 26px rgba(253,224,71,0.95), inset 0 0 24px rgba(254,240,138,0.65)'
          }}
        />
        <div
          className="western-sun-rays absolute -inset-[14%] rounded-full opacity-35"
          style={{
            backgroundImage: 'repeating-conic-gradient(from 0deg, rgba(255,251,235,0.95) 0deg 10deg, transparent 10deg 26deg)',
            WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,1) 25%, transparent 72%)',
            maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 25%, transparent 72%)'
          }}
        />
      </div>

      {/* Falling Golden Dust Particles */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-[3]" />

      {/* Floating 3D Spinning Coins in the Air */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none z-[4] overflow-hidden" style={{ perspective: '900px' }}>
        {AIR_COINS.map((coin) => (
          <div
            key={coin.id}
            style={{
              ...coin.style,
              background: 'radial-gradient(circle at 32% 28%, #fffbeb 0%, #fde047 30%, #f59e0b 70%, #92400e 100%)',
              boxShadow: '0 6px 0 #78350f, 0 12px 22px rgba(0,0,0,0.55), inset 0 2px 5px rgba(255,255,255,0.75)'
            }}
            className="western-air-coin absolute rounded-full border-[2.5px] border-amber-200 flex items-center justify-center font-cinzel font-black text-amber-900 text-lg sm:text-2xl"
          >
            <span>$</span>
            <span className="absolute inset-1 rounded-full border border-dashed border-amber-900/55 pointer-events-none" />
          </div>
        ))}
      </div>

      {/* Foreground Content (100dvh, Zero Scroll) */}
      <div className="relative z-[6] w-full max-w-[720px] h-[100dvh] max-h-[100dvh] mx-auto px-4 py-4 sm:py-7 flex flex-col items-center justify-between text-center">
        {/* Top Western Title */}
        <div className="flex flex-col items-center gap-1 mt-1 sm:mt-3">
          <div
            className="font-cinzel font-black text-sm sm:text-lg tracking-[0.16em] uppercase text-amber-200"
            style={{
              textShadow:
                '-1.5px -1.5px 0 #3b1704, 1.5px -1.5px 0 #3b1704, -1.5px 1.5px 0 #3b1704, 1.5px 1.5px 0 #3b1704, 0 3px 10px rgba(0,0,0,0.85)'
            }}
          >
            {multiplier}X MULTIPLICADOR
          </div>

          <svg
            viewBox="0 0 680 92"
            role="img"
            aria-label="TOTAL DE GANHOS"
            className="w-[min(94vw,540px)] h-auto overflow-visible drop-shadow-[0_6px_12px_rgba(45,16,2,0.85)]"
          >
            <defs>
              <linearGradient id={`wAgedGold-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fffbeb" />
                <stop offset="32%" stopColor="#fde047" />
                <stop offset="70%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
            </defs>
            <text
              x="340"
              y="68"
              textAnchor="middle"
              fontFamily="Georgia, 'Times New Roman', serif"
              fontWeight="900"
              fontSize="50"
              letterSpacing="4"
              fill="#290f02"
              transform="translate(0, 5)"
            >
              ★ TOTAL DE GANHOS ★
            </text>
            <text
              x="340"
              y="68"
              textAnchor="middle"
              fontFamily="Georgia, 'Times New Roman', serif"
              fontWeight="900"
              fontSize="50"
              letterSpacing="4"
              fill={`url(#wAgedGold-${uid})`}
              stroke="#3b1604"
              strokeWidth="11"
              strokeLinejoin="round"
              paintOrder="stroke fill"
            >
              ★ TOTAL DE GANHOS ★
            </text>
          </svg>
        </div>

        {/* Center 3D Metallic Gold Rounded Amount */}
        <div className="my-auto flex flex-col items-center justify-center gap-1">
          <svg
            viewBox="0 0 680 156"
            aria-live="polite"
            className="w-[min(92vw,560px)] h-auto overflow-visible"
            style={{
              filter: 'drop-shadow(0 8px 18px rgba(40,14,2,0.9)) drop-shadow(0 0 26px rgba(254,240,138,0.65))'
            }}
          >
            <defs>
              <linearGradient id={`wMetallicGold-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="22%" stopColor="#fef08a" />
                <stop offset="56%" stopColor="#f59e0b" />
                <stop offset="85%" stopColor="#b45309" />
                <stop offset="100%" stopColor="#fef08a" />
              </linearGradient>
            </defs>
            <text
              x="340"
              y="114"
              textAnchor="middle"
              fontFamily="ui-rounded, 'Trebuchet MS', 'Arial Rounded MT Bold', system-ui, sans-serif"
              fontWeight="900"
              fontSize={amountFontSize}
              fill="#290f02"
              stroke="#290f02"
              strokeWidth="20"
              strokeLinejoin="round"
              paintOrder="stroke fill"
              transform="translate(0, 9)"
            >
              {formattedAmount}
            </text>
            <text
              x="340"
              y="114"
              textAnchor="middle"
              fontFamily="ui-rounded, 'Trebuchet MS', 'Arial Rounded MT Bold', system-ui, sans-serif"
              fontWeight="900"
              fontSize={amountFontSize}
              fill={`url(#wMetallicGold-${uid})`}
              stroke="#3b1604"
              strokeWidth="18"
              strokeLinejoin="round"
              paintOrder="stroke fill"
            >
              {formattedAmount}
            </text>
          </svg>

          <div
            className="font-cinzel font-extrabold text-xs sm:text-sm tracking-[0.18em] uppercase text-amber-100"
            style={{
              textShadow: '-1px -1px 0 #3b1704, 1px -1px 0 #3b1704, -1px 1px 0 #3b1704, 1px 1px 0 #3b1704, 0 2px 6px rgba(0,0,0,0.85)'
            }}
          >
            Fichas Fictícias
          </div>
        </div>

        {/* Bottom Hint + Rustic Wooden Plank RECOLHER Button Flanked by Crossed Revolvers */}
        <div className="w-full flex flex-col items-center gap-2 mb-1 sm:mb-3">
          <span
            className={`text-xs font-bold text-amber-100 tracking-wide ${
              !isFinished && !isZeroWin ? 'visible' : 'invisible'
            }`}
            style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}
          >
            Toque na tela para acelerar a contagem
          </span>

          <div className="flex items-center justify-center gap-1.5 sm:gap-3.5 w-full max-w-[440px]">
            <CrossedRevolvers side="left" steelId={steelGradId} />

            <button
              type="button"
              onClick={handleRecolher}
              className="relative w-[190px] sm:w-[250px] h-[56px] sm:h-[68px] border-none bg-transparent p-0 cursor-pointer flex items-center justify-center transition-all duration-150 hover:brightness-110 hover:-translate-y-0.5 active:scale-95 drop-shadow-[0_8px_18px_rgba(0,0,0,0.85)]"
            >
              <svg viewBox="0 0 260 72" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <linearGradient id={`woodDark-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6b3413" />
                    <stop offset="28%" stopColor="#451f09" />
                    <stop offset="72%" stopColor="#2c1204" />
                    <stop offset="100%" stopColor="#1b0902" />
                  </linearGradient>
                  <linearGradient id={`woodGold-${uid}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#92400e" />
                  </linearGradient>
                </defs>
                <path
                  d="M12 8 L64 5 L80 10 L146 6 L195 9 L246 6 L254 19 L249 36 L255 54 L244 65 L184 62 L134 67 L72 63 L15 66 L5 52 L10 34 L4 18 Z"
                  fill={`url(#woodDark-${uid})`}
                  stroke={`url(#woodGold-${uid})`}
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M22 22 Q90 17 175 23 M30 38 Q125 43 230 36 M26 52 Q115 49 224 54"
                  fill="none"
                  stroke="#180802"
                  strokeWidth="2"
                  opacity="0.65"
                />
                <circle cx="20" cy="18" r="3.5" fill={`url(#woodGold-${uid})`} stroke="#2c1204" strokeWidth="1" />
                <circle cx="240" cy="18" r="3.5" fill={`url(#woodGold-${uid})`} stroke="#2c1204" strokeWidth="1" />
                <circle cx="20" cy="54" r="3.5" fill={`url(#woodGold-${uid})`} stroke="#2c1204" strokeWidth="1" />
                <circle cx="240" cy="54" r="3.5" fill={`url(#woodGold-${uid})`} stroke="#2c1204" strokeWidth="1" />
              </svg>
              <span
                className="relative z-[2] font-cinzel font-black text-lg sm:text-2xl tracking-[0.14em] uppercase"
                style={{
                  background: 'linear-gradient(180deg, #fffbeb 0%, #fde047 45%, #d97706 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 0 #2a1003) drop-shadow(0 4px 6px rgba(0,0,0,0.9))'
                }}
              >
                RECOLHER
              </span>
            </button>

            <CrossedRevolvers side="right" steelId={steelGradId} />
          </div>
        </div>
      </div>
      </div>
    </>
  );
};

