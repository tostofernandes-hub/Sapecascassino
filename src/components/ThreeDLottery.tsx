import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '../utils/audio';

interface MiniBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface ThreeDLotteryProps {
  isDrawing: boolean;
  winningNumbers: number[];
  drawnNumbers: number[];
  onBallDrawn?: (num: number, index: number) => void;
  onDrawComplete?: () => void;
  width?: number;
  height?: number;
}

export const ThreeDLottery: React.FC<ThreeDLotteryProps> = ({
  isDrawing,
  winningNumbers,
  drawnNumbers,
  onBallDrawn,
  onDrawComplete,
  width = 380,
  height = 220
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Tumbling mini-balls inside the cage
  const miniBallsRef = useRef<MiniBall[]>([]);
  const cageAngleRef = useRef<number>(0);

  // Active ball rolling down the 3D chute: { num, progress (0..1) }
  const rollingBallRef = useRef<{ num: number; progress: number } | null>(null);

  // Initialize mini-balls on first render
  if (miniBallsRef.current.length === 0) {
    const colors = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f97316', '#eab308'];
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const rad = 15 + Math.random() * 50;
      miniBallsRef.current.push({
        x: Math.cos(angle) * rad,
        y: Math.sin(angle) * rad,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        radius: 6 + Math.random() * 2.5,
        color: colors[i % colors.length]
      });
    }
  }

  // Draw complete 3D frame: stand, cage, tumbling balls, 3D chute, and rolling ball
  const drawFrame = (
    ctx: CanvasRenderingContext2D,
    angle: number,
    spinSpeed: number,
    rollingBall: { num: number; progress: number } | null
  ) => {
    const w = 560;
    const h = 340;
    const cx = 185; // Drum center X
    const cy = 170; // Drum center Y
    const drumRadius = 105;

    ctx.clearRect(0, 0, w, h);

    // 1. Heavy Brass Stands / Legs (Left and Right A-Frames)
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#78350f';
    // Left leg
    ctx.beginPath();
    ctx.moveTo(cx - drumRadius - 18, cy + drumRadius + 24);
    ctx.lineTo(cx - drumRadius - 18, cy);
    ctx.stroke();
    // Right leg
    ctx.beginPath();
    ctx.moveTo(cx + drumRadius + 18, cy + drumRadius + 24);
    ctx.lineTo(cx + drumRadius + 18, cy);
    ctx.stroke();

    // Metallic Golden Highlight on legs
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(cx - drumRadius - 18, cy + drumRadius + 24);
    ctx.lineTo(cx - drumRadius - 18, cy);
    ctx.moveTo(cx + drumRadius + 18, cy + drumRadius + 24);
    ctx.lineTo(cx + drumRadius + 18, cy);
    ctx.stroke();

    // Floor Base Mounts
    ctx.fillStyle = '#b45309';
    ctx.fillRect(cx - drumRadius - 32, cy + drumRadius + 20, 28, 9);
    ctx.fillRect(cx + drumRadius + 4, cy + drumRadius + 20, 28, 9);

    // 2. Central Axle Spindle
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#451a03';
    ctx.beginPath();
    ctx.moveTo(cx - drumRadius - 26, cy);
    ctx.lineTo(cx + drumRadius + 26, cy);
    ctx.stroke();

    // Hand Crank Mechanism on Left
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(cx - drumRadius - 26, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - drumRadius - 42, cy - 5, 18, 10);
    ctx.beginPath();
    ctx.arc(cx - drumRadius - 42, cy + 22, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();

    // 3. Back Hemisphere Wire Cage Ribs
    for (let rib = 0; rib < 10; rib++) {
      const ra = angle + (rib / 10) * Math.PI;
      const cosA = Math.cos(ra);
      if (cosA < 0) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, drumRadius * Math.abs(cosA), drumRadius, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(217, 119, 6, 0.4)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }

    // 4. Tumbling Balls Inside the Drum (Physics simulation)
    const miniBalls = miniBallsRef.current;
    for (const b of miniBalls) {
      if (spinSpeed > 0) {
        b.x += b.vx + (Math.random() - 0.5) * spinSpeed * 2.2;
        b.y += b.vy + 0.38; // Gravity
        b.y -= spinSpeed * 0.45; // Rotational lift

        const dist = Math.hypot(b.x, b.y);
        if (dist > drumRadius - 12) {
          const nx = b.x / dist;
          const ny = b.y / dist;
          const dot = b.vx * nx + b.vy * ny;
          b.vx = (b.vx - 1.8 * dot * nx) * 0.85;
          b.vy = (b.vy - 1.8 * dot * ny) * 0.85;
          b.x = nx * (drumRadius - 12);
          b.y = ny * (drumRadius - 12);
        }
      }

      // 3D glossy mini ball rendering
      const bx = cx + b.x;
      const by = cy + b.y;
      const grad = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, b.radius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, b.color);
      grad.addColorStop(1, '#000000');
      ctx.beginPath();
      ctx.arc(bx, by, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // 5. Front Hemisphere Wire Cage Ribs (3D Perspective)
    for (let rib = 0; rib < 10; rib++) {
      const ra = angle + (rib / 10) * Math.PI;
      const cosA = Math.cos(ra);
      if (cosA >= 0) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, drumRadius * Math.abs(cosA), drumRadius, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
    }

    // Outer Cage Rim Bands
    ctx.beginPath();
    ctx.arc(cx, cy, drumRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(cx, cy, drumRadius, drumRadius * 0.35, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Specular Glass Globe Flare Reflection
    const gradGlass = ctx.createLinearGradient(cx - drumRadius, cy - drumRadius, cx + drumRadius, cy + drumRadius);
    gradGlass.addColorStop(0, 'rgba(255,255,255,0.28)');
    gradGlass.addColorStop(0.35, 'rgba(255,255,255,0.06)');
    gradGlass.addColorStop(0.7, 'transparent');
    gradGlass.addColorStop(1, 'rgba(251,191,36,0.18)');
    ctx.beginPath();
    ctx.arc(cx, cy, drumRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradGlass;
    ctx.fill();

    // 6. 3D Extraction Chute / Ramp (Canaleta 3D Metálica)
    // Curves from top mouth of drum (x: 250, y: 80) down to exit port (x: 495, y: 285)
    ctx.beginPath();
    ctx.moveTo(250, 85);
    ctx.bezierCurveTo(360, 80, 430, 150, 495, 285);
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#451a03'; // Outer dark track shadow
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(250, 85);
    ctx.bezierCurveTo(360, 80, 430, 150, 495, 285);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#fbbf24'; // Brass body
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(250, 85);
    ctx.bezierCurveTo(360, 80, 430, 150, 495, 285);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#ffffff'; // Specular metallic line
    ctx.stroke();

    // Exit Port Mouth Ring
    ctx.beginPath();
    ctx.ellipse(495, 285, 14, 9, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = '#1c0a06';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fbbf24';
    ctx.stroke();

    // 7. Active Ball Rolling Down the 3D Chute
    if (rollingBall && rollingBall.progress >= 0 && rollingBall.progress <= 1) {
      const t = rollingBall.progress;
      // Cubic bezier points: P0(250, 85), P1(360, 80), P2(430, 150), P3(495, 285)
      const p0x = 250, p0y = 85;
      const p1x = 360, p1y = 80;
      const p2x = 430, p2y = 150;
      const p3x = 495, p3y = 285;

      const u = 1 - t;
      const bx = u*u*u*p0x + 3*u*u*t*p1x + 3*u*t*t*p2x + t*t*t*p3x;
      const by = u*u*u*p0y + 3*u*u*t*p1y + 3*u*t*t*p2y + t*t*t*p3y;
      const bRad = 13 + t * 4.5; // Scales as it comes forward in 3D

      // Contact shadow under rolling ball
      ctx.beginPath();
      ctx.arc(bx + 3, by + 5, bRad, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();

      // High-Gloss 3D Golden Sphere
      const gradBall = ctx.createRadialGradient(bx - bRad * 0.35, by - bRad * 0.35, 1, bx, by, bRad);
      gradBall.addColorStop(0, '#ffffff');
      gradBall.addColorStop(0.25, '#fef08a');
      gradBall.addColorStop(0.65, '#f59e0b');
      gradBall.addColorStop(1, '#78350f');
      ctx.beginPath();
      ctx.arc(bx, by, bRad, 0, Math.PI * 2);
      ctx.fillStyle = gradBall;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#fbbf24';
      ctx.stroke();

      // Number on rolling sphere
      ctx.fillStyle = '#000000';
      ctx.font = `bold ${Math.round(bRad * 0.95)}px Montserrat, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(rollingBall.num), bx, by);
    }
  };

  // Idle frame render
  useEffect(() => {
    if (!isDrawing) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawFrame(ctx, cageAngleRef.current, 0, null);
    }
  }, [isDrawing]);

  // Sequential 6-ball draw animation loop
  useEffect(() => {
    if (!isDrawing || winningNumbers.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isCancelled = false;

    const runSequentialDraw = async () => {
      // Draw each ball one by one
      for (let i = 0; i < winningNumbers.length; i++) {
        if (isCancelled) return;
        const num = winningNumbers[i];

        // Phase 1: High speed tumbling in cage (650ms)
        const tumbleStart = performance.now();
        await new Promise<void>((resolve) => {
          const tumble = (now: number) => {
            if (isCancelled) return;
            const elapsed = now - tumbleStart;
            cageAngleRef.current += 0.12;
            drawFrame(ctx, cageAngleRef.current, 4.5, null);
            if (elapsed < 650) {
              requestAnimationFrame(tumble);
            } else {
              resolve();
            }
          };
          requestAnimationFrame(tumble);
        });

        // Phase 2: Ball descends through the 3D chute (700ms)
        soundManager.playChuteDrop();
        const rollStart = performance.now();
        await new Promise<void>((resolve) => {
          const roll = (now: number) => {
            if (isCancelled) return;
            const elapsed = now - rollStart;
            const progress = Math.min(1, elapsed / 700);
            cageAngleRef.current += 0.05;
            rollingBallRef.current = { num, progress };
            drawFrame(ctx, cageAngleRef.current, 2.0, rollingBallRef.current);
            if (progress < 1) {
              requestAnimationFrame(roll);
            } else {
              resolve();
            }
          };
          requestAnimationFrame(roll);
        });

        // Sound when ball docks into display rack
        soundManager.playDiceTick(900 + i * 80);
        rollingBallRef.current = null;
        if (onBallDrawn) {
          onBallDrawn(num, i);
        }
        drawFrame(ctx, cageAngleRef.current, 0, null);

        // Pause before next ball (300ms)
        await new Promise((r) => setTimeout(r, 300));
      }

      if (!isCancelled && onDrawComplete) {
        onDrawComplete();
      }
    };

    runSequentialDraw();

    return () => {
      isCancelled = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isDrawing, winningNumbers]);

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{
        width,
        height
      }}
    >
      <canvas
        ref={canvasRef}
        width={560}
        height={340}
        className="w-full h-full rounded-xl"
        style={{
          boxShadow: '0 12px 28px rgba(0,0,0,0.85), inset 0 0 16px rgba(0,0,0,0.7)'
        }}
      />
    </div>
  );
};
