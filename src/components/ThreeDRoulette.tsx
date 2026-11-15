import React, { useEffect, useRef } from 'react';
import { soundManager } from '../utils/audio';

export const EURO_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

export const AMERICAN_NUMBERS = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1,
  '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2
];

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
]);

export function getSlotColor(val: number | string): string {
  if (val === 0 || val === '00' || val === -1) return '#059669'; // Emerald Green
  const num = typeof val === 'string' ? parseInt(val, 10) : val;
  return RED_NUMBERS.has(num) ? '#dc2626' : '#18181b'; // Crimson Red or Jet Black
}

interface ThreeDRouletteProps {
  isAmerican?: boolean;
  isSpinning: boolean;
  winningNumber: number | string | null;
  onSpinEnd?: () => void;
  size?: number;
}

export const ThreeDRoulette: React.FC<ThreeDRouletteProps> = ({
  isAmerican = false,
  isSpinning,
  winningNumber,
  onSpinEnd,
  size = 280
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Persistent angle states across spins
  const wheelAngleRef = useRef<number>(0);
  const ballAngleRef = useRef<number>(0);
  const ballRadiusRef = useRef<number>(182);

  const numbersList = isAmerican ? AMERICAN_NUMBERS : EURO_NUMBERS;
  const totalSlots = numbersList.length;

  // Draw a single frame of the 3D roulette wheel on canvas
  const drawFrame = (
    ctx: CanvasRenderingContext2D,
    wheelAngle: number,
    ballAngle: number,
    ballRadius: number,
    winningSlot: number | string | null
  ) => {
    const width = 500;
    const height = 500;
    const cx = width / 2;
    const cy = height / 2;
    const arc = (Math.PI * 2) / totalSlots;

    ctx.clearRect(0, 0, width, height);

    // 1. Mahogany Outer Rim with Wood Shading
    const gradRim = ctx.createRadialGradient(cx, cy, 190, cx, cy, 246);
    gradRim.addColorStop(0, '#1c0a06');
    gradRim.addColorStop(0.35, '#3d160e');
    gradRim.addColorStop(0.7, '#1b0805');
    gradRim.addColorStop(1, '#0c0302');
    ctx.beginPath();
    ctx.arc(cx, cy, 244, 0, Math.PI * 2);
    ctx.fillStyle = gradRim;
    ctx.fill();

    // Golden metallic outer bevel
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#d97706';
    ctx.stroke();

    // Brass perimeter studs
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rx = cx + Math.cos(a) * 232;
      const ry = cy + Math.sin(a) * 232;
      ctx.beginPath();
      ctx.arc(rx, ry, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
    }

    // 2. Ball Track Ring (Recessed Dark Steel)
    const gradTrack = ctx.createRadialGradient(cx, cy, 160, cx, cy, 222);
    gradTrack.addColorStop(0, '#101015');
    gradTrack.addColorStop(0.5, '#1e1e28');
    gradTrack.addColorStop(1, '#09090d');
    ctx.beginPath();
    ctx.arc(cx, cy, 222, 0, Math.PI * 2);
    ctx.fillStyle = gradTrack;
    ctx.fill();

    // 8 Diamond Deflector Frets in track
    for (let i = 0; i < 8; i++) {
      const da = (i / 8) * Math.PI * 2;
      const dx = cx + Math.cos(da) * 190;
      const dy = cy + Math.sin(da) * 190;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(da);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 3. Rotating Rotor
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wheelAngle);

    const rOuter = 175;
    const rInner = 118;

    // Number pockets
    for (let i = 0; i < totalSlots; i++) {
      const startA = i * arc;
      const endA = startA + arc;
      const val = numbersList[i];
      const color = getSlotColor(val);

      ctx.beginPath();
      ctx.arc(0, 0, rOuter, startA, endA);
      ctx.arc(0, 0, rInner, endA, startA, true);
      ctx.closePath();

      ctx.fillStyle = color;
      ctx.fill();

      // Highlight winning pocket when stopped
      if (winningSlot !== null && String(val) === String(winningSlot)) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.55)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }

      // Pocket fret separator (Gold)
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#d97706';
      ctx.beginPath();
      ctx.moveTo(Math.cos(startA) * rInner, Math.sin(startA) * rInner);
      ctx.lineTo(Math.cos(startA) * rOuter, Math.sin(startA) * rOuter);
      ctx.stroke();

      // Number text oriented outward
      ctx.save();
      const midA = startA + arc / 2;
      ctx.rotate(midA);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(val === -1 ? '00' : val), 146, 0);
      ctx.restore();
    }

    // 4. Sloping Brass Inner Cone
    const gradCone = ctx.createRadialGradient(0, 0, 10, 0, 0, rInner);
    gradCone.addColorStop(0, '#fef08a');
    gradCone.addColorStop(0.3, '#f59e0b');
    gradCone.addColorStop(0.7, '#b45309');
    gradCone.addColorStop(1, '#451a03');
    ctx.beginPath();
    ctx.arc(0, 0, rInner, 0, Math.PI * 2);
    ctx.fillStyle = gradCone;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#fbbf24';
    ctx.stroke();

    // 5. Center Golden Turret Spindle & 4-Arm Cross
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI * 2);
    ctx.fillStyle = '#78350f';
    ctx.fill();

    // 4 Cross arms
    for (let a = 0; a < 4; a++) {
      ctx.save();
      ctx.rotate((a * Math.PI) / 2);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.roundRect(-4.5, -62, 9, 62, 3);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, -60, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Center Acorn Cap with Specular Flare
    const gradCap = ctx.createRadialGradient(-4, -4, 2, 0, 0, 22);
    gradCap.addColorStop(0, '#ffffff');
    gradCap.addColorStop(0.25, '#fef08a');
    gradCap.addColorStop(0.65, '#d97706');
    gradCap.addColorStop(1, '#78350f');
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fillStyle = gradCap;
    ctx.fill();

    ctx.restore(); // Restore from rotor rotation

    // 6. Realistic 3D Ivory Ball in world coords
    if (ballRadius > 0) {
      const bx = cx + Math.cos(ballAngle) * ballRadius;
      const by = cy + Math.sin(ballAngle) * ballRadius;

      // Ball contact shadow
      ctx.beginPath();
      ctx.arc(bx + 3, by + 4, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fill();

      // Ball 3D ivory sphere
      const gradBall = ctx.createRadialGradient(bx - 2.5, by - 3, 1, bx, by, 7.5);
      gradBall.addColorStop(0, '#ffffff');
      gradBall.addColorStop(0.3, '#f8fafc');
      gradBall.addColorStop(0.8, '#cbd5e1');
      gradBall.addColorStop(1, '#475569');
      ctx.beginPath();
      ctx.arc(bx, by, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = gradBall;
      ctx.fill();
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.stroke();
    }
  };

  // Static redraw on mount or state change when idle
  useEffect(() => {
    if (!isSpinning) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawFrame(ctx, wheelAngleRef.current, ballAngleRef.current, ballRadiusRef.current, winningNumber);
    }
  }, [isSpinning, winningNumber, isAmerican]);

  // Spin animation trigger
  useEffect(() => {
    if (!isSpinning || winningNumber === null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Find target winning slot index
    const normWinning = winningNumber === -1 ? '00' : winningNumber;
    const slotIndex = numbersList.findIndex((n) => String(n) === String(normWinning));
    const safeSlotIndex = slotIndex >= 0 ? slotIndex : 0;

    const totalDuration = 4200; // 4.2 seconds duration (within requested 3 to 5 seconds)
    const startTime = performance.now();

    const initialWheelAngle = wheelAngleRef.current;
    const totalWheelRotations = Math.PI * 2 * (5 + Math.random() * 0.8); // Clockwise (+)

    const finalWheelAngle = initialWheelAngle + totalWheelRotations;
    const slotArc = (Math.PI * 2) / totalSlots;
    const targetSlotAngleOnWheel = safeSlotIndex * slotArc + slotArc / 2;
    const thetaTarget = finalWheelAngle + targetSlotAngleOnWheel;

    const initialBallAngle = ballAngleRef.current;
    let diff = (thetaTarget - initialBallAngle) % (Math.PI * 2);
    if (diff > 0) diff -= Math.PI * 2;
    const turns = 8;
    // Exactly lands at thetaTarget counter-clockwise
    const totalBallRotations = diff - turns * Math.PI * 2;

    let lastTickAngle = 0;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / totalDuration);

      // Deceleration easing (quartic ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 4.0);

      // 1. Wheel rotates Clockwise
      wheelAngleRef.current = initialWheelAngle + totalWheelRotations * easeOut;

      // 2. Ball rotates Counter-Clockwise in opposite direction
      if (progress < 0.65) {
        // High-speed outer race track
        const ballEase = 1 - Math.pow(1 - progress, 2.6);
        ballRadiusRef.current = 202 - Math.sin(progress * Math.PI * 8) * 1.5;
        ballAngleRef.current = initialBallAngle + totalBallRotations * ballEase;

        if (Math.abs(ballAngleRef.current - lastTickAngle) > 0.65) {
          soundManager.playRouletteTick(1150 + (1 - progress) * 280);
          lastTickAngle = ballAngleRef.current;
        }
      } else if (progress < 0.88) {
        // Spiraling down into deflectors
        const dropProgress = (progress - 0.65) / 0.23;
        const dropEase = 1 - Math.cos((dropProgress * Math.PI) / 2);
        ballRadiusRef.current = 202 - (202 - 146) * dropEase;

        const ballEase = 1 - Math.pow(1 - progress, 3.8);
        ballAngleRef.current = initialBallAngle + totalBallRotations * ballEase;

        if (Math.abs(ballAngleRef.current - lastTickAngle) > 0.35) {
          soundManager.playRouletteTick(920 + (1 - progress) * 200);
          lastTickAngle = ballAngleRef.current;
        }
      } else {
        // Ball settles into target winning slot pocket
        const settleProgress = (progress - 0.88) / 0.12;
        const rattle = Math.sin(settleProgress * Math.PI * 3) * (1 - settleProgress) * 2.2;
        ballRadiusRef.current = 146 + rattle;
        ballAngleRef.current = wheelAngleRef.current + targetSlotAngleOnWheel;
      }

      drawFrame(
        ctx,
        wheelAngleRef.current,
        ballAngleRef.current,
        ballRadiusRef.current,
        progress >= 0.98 ? normWinning : null
      );

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        soundManager.playBallDrop();
        if (onSpinEnd) {
          onSpinEnd();
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isSpinning, winningNumber]);

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{
        perspective: '800px',
        width: size,
        height: size
      }}
    >
      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        className="rounded-full shadow-[0_16px_36px_rgba(0,0,0,0.95)]"
        style={{
          width: size,
          height: size,
          transform: 'rotateX(22deg)',
          transition: 'transform 0.3s ease'
        }}
      />

      {/* Winning Number Zoom Highlight Badge */}
      {winningNumber !== null && !isSpinning && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 flex flex-col items-center animate-zoom-in">
          <div
            className="px-3.5 py-1.5 rounded-xl font-cinzel font-black text-sm text-white shadow-2xl border-2 flex items-center gap-1.5 backdrop-blur-md animate-bounce"
            style={{
              backgroundColor: getSlotColor(winningNumber),
              borderColor: '#fbbf24',
              boxShadow: '0 0 25px rgba(251, 191, 36, 0.9), 0 8px 24px rgba(0,0,0,0.95)'
            }}
          >
            <span className="text-amber-300">★</span>
            <span className="text-base">{winningNumber === -1 ? '00' : winningNumber}</span>
            <span className="text-[10px] text-amber-200 uppercase font-sans font-bold">
              {winningNumber === 0 || winningNumber === -1 || winningNumber === '00'
                ? 'Verde'
                : getSlotColor(winningNumber) === '#dc2626'
                ? 'Vermelho'
                : 'Preto'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
