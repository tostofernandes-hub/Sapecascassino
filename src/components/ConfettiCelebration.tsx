import React, { useEffect, useRef } from 'react';

export type ConfettiIntensity = 'low' | 'medium' | 'high' | 'mega' | number;

export type WinMagnitudeTier = 'big' | 'super' | 'mega' | 'jackpot';

export interface WinMagnitudeConfig {
  tier: WinMagnitudeTier;
  baseParticleCount: number;
  durationMs: number;
  waves: number;
  colors: string[];
}

export interface ConfettiCelebrationProps {
  /** Whether the confetti celebration is active */
  isActive: boolean;
  /** Optional trigger key to re-launch a burst while isActive stays true */
  triggerKey?: string | number;
  /** Total win amount used to determine magnitude & palette */
  winAmount?: number;
  /** Bet amount used with winAmount to calculate multiplier magnitude */
  betAmount?: number;
  /** Explicit multiplier override */
  multiplier?: number;
  /** Adjustable burst intensity preset or numeric scale factor (0.25 - 3.5) */
  intensity?: ConfettiIntensity;
  /** Optional custom particle colors overriding magnitude defaults */
  colors?: string[];
  /** Optional duration override in milliseconds */
  durationMs?: number;
  /** Optional z-index class or inline numeric value (defaults to 150) */
  zIndex?: number;
}

interface ConfettiParticle {
  x: number;
  y: number;
  w: number;
  h: number;
  shape: 'rect' | 'ribbon' | 'diamond';
  color: string;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  rotation: number;
  vRot: number;
  wobble: number;
  vWobble: number;
  delayMs: number;
}

export function getWinMagnitudeConfig(
  winAmount: number = 0,
  betAmount?: number,
  multiplier?: number
): WinMagnitudeConfig {
  const ratio =
    typeof multiplier === 'number' && multiplier > 0
      ? multiplier
      : betAmount && betAmount > 0 && winAmount > 0
        ? winAmount / betAmount
        : 0;

  if (ratio >= 40 || winAmount >= 10000) {
    return {
      tier: 'jackpot',
      baseParticleCount: 240,
      durationMs: 4200,
      waves: 3,
      colors: ['#fffbeb', '#fde047', '#f59e0b', '#ec4899', '#38bdf8', '#10b981', '#f43f5e']
    };
  }

  if (ratio >= 15 || winAmount >= 2500) {
    return {
      tier: 'mega',
      baseParticleCount: 180,
      durationMs: 3500,
      waves: 2,
      colors: ['#fde047', '#ef4444', '#38bdf8', '#a855f7', '#f59e0b', '#ffffff']
    };
  }

  if (ratio >= 5 || winAmount >= 500) {
    return {
      tier: 'super',
      baseParticleCount: 135,
      durationMs: 2900,
      waves: 2,
      colors: ['#fbbf24', '#10b981', '#34d399', '#ef4444', '#fde047', '#ffffff']
    };
  }

  return {
    tier: 'big',
    baseParticleCount: 95,
    durationMs: 2400,
    waves: 1,
    colors: ['#fde047', '#f59e0b', '#fbbf24', '#fb923c', '#ffffff']
  };
}

function resolveIntensityScale(intensity?: ConfettiIntensity): number {
  if (typeof intensity === 'number' && Number.isFinite(intensity)) {
    return Math.max(0.25, Math.min(3.5, intensity));
  }
  switch (intensity) {
    case 'low':
      return 0.6;
    case 'medium':
      return 1;
    case 'high':
      return 1.45;
    case 'mega':
      return 2.1;
    default:
      return 1;
  }
}

export const ConfettiCelebration: React.FC<ConfettiCelebrationProps> = ({
  isActive,
  triggerKey,
  winAmount = 0,
  betAmount,
  multiplier,
  intensity,
  colors,
  durationMs,
  zIndex = 150
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isActive) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const magnitude = getWinMagnitudeConfig(winAmount, betAmount, multiplier);
    const scale = resolveIntensityScale(intensity);
    const palette = colors && colors.length > 0 ? colors : magnitude.colors;
    const totalDuration = durationMs ?? magnitude.durationMs;
    const totalParticles = Math.round(magnitude.baseParticleCount * scale);

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const shapes: ConfettiParticle['shape'][] = ['rect', 'ribbon', 'diamond'];
    const particles: ConfettiParticle[] = [];

    for (let i = 0; i < totalParticles; i++) {
      const waveIndex = i % magnitude.waves;
      const delayMs = waveIndex * 420;
      const fromSideCannon = magnitude.waves > 1 && i % 3 !== 0;
      const isLeft = i % 2 === 0;

      const originX = fromSideCannon
        ? isLeft
          ? width * (0.06 + Math.random() * 0.14)
          : width * (0.8 + Math.random() * 0.14)
        : width * (0.25 + Math.random() * 0.5);

      const originY = fromSideCannon
        ? height * (0.55 + Math.random() * 0.2)
        : height * (0.32 + Math.random() * 0.14);

      const vx = fromSideCannon
        ? (isLeft ? 1 : -1) * (5 + Math.random() * 11)
        : (Math.random() - 0.5) * 16;

      const vy = fromSideCannon
        ? -(10 + Math.random() * 11)
        : -(8 + Math.random() * 14);

      const shape = shapes[i % shapes.length];
      particles.push({
        x: originX,
        y: originY,
        w: shape === 'ribbon' ? 5 + Math.random() * 4 : 6 + Math.random() * 7,
        h: shape === 'ribbon' ? 12 + Math.random() * 9 : 5 + Math.random() * 5,
        shape,
        color: palette[Math.floor(Math.random() * palette.length)],
        vx,
        vy,
        gravity: 0.34 + Math.random() * 0.14,
        drag: 0.985,
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 14,
        wobble: Math.random() * Math.PI * 2,
        vWobble: 0.08 + Math.random() * 0.08,
        delayMs
      });
    }

    const startTime = performance.now();
    let rafId = 0;

    const render = (now: number) => {
      const elapsed = now - startTime;
      const overallProgress = elapsed / totalDuration;

      ctx.clearRect(0, 0, width, height);

      if (overallProgress >= 1) {
        return;
      }

      for (const p of particles) {
        if (elapsed < p.delayMs) continue;

        const localElapsed = elapsed - p.delayMs;
        const localDuration = Math.max(800, totalDuration - p.delayMs);
        const localProgress = Math.min(1, localElapsed / localDuration);

        p.x += p.vx + Math.sin(p.wobble) * 0.65;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= p.drag;
        p.rotation += p.vRot;
        p.wobble += p.vWobble;

        const alpha = localProgress < 0.7 ? 1 : Math.max(0, 1 - (localProgress - 0.7) / 0.3);
        const tiltScale = 0.45 + 0.55 * Math.abs(Math.cos(p.wobble));

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.scale(1, tiltScale);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;

        if (p.shape === 'diamond') {
          ctx.beginPath();
          ctx.moveTo(0, -p.w * 0.7);
          ctx.lineTo(p.w * 0.6, 0);
          ctx.lineTo(0, p.w * 0.7);
          ctx.lineTo(-p.w * 0.6, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }

        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId) cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, width, height);
    };
  }, [isActive, triggerKey, winAmount, betAmount, multiplier, intensity, colors, durationMs]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-screen h-screen pointer-events-none"
      style={{ zIndex }}
    />
  );
};
