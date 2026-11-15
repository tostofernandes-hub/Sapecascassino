import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Plane, 
  Sparkles, 
  Flame, 
  ShieldCheck, 
  RotateCcw, 
  TrendingUp, 
  CheckCircle2, 
  AlertOctagon,
  Gauge,
  Zap,
  HelpCircle
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { reportRoundLoss } from '../utils/luckyStreak';
import { ChipSelector } from '../components/ChipSelector';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { LimboVictoryOverlay } from '../components/LimboVictoryOverlay';
import aviaoImg from '../assets/images/game_aviao_crash_1794068832280.jpg';

interface RocketLimboGameProps {
  balance: number;
  onUpdateBalance: (
    delta: number,
    isWin: boolean,
    gameId: 'slots' | 'blackjack' | 'texas-holdem' | 'video-poker' | 'baccarat' | 'lottery' | 'limbo',
    bet?: number
  ) => void;
  onBackToLobby: () => void;
}

interface PastFlight {
  multiplier: number;
  cashedOutAt?: number;
  won: boolean;
  timestamp: string;
}

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  grow: number;
  age: number;
  maxAge: number;
  rot: number;
  vRot: number;
  shape: 'circle' | 'diamond' | 'square';
  color: string;
  alpha: number;
}

interface SkyStreak {
  x: number;
  y: number;
  len: number;
  speedMul: number;
  alpha: number;
}

type FlightState = 'READY' | 'TAXIING' | 'FLYING' | 'CRASHED';

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export const RocketLimboGame: React.FC<RocketLimboGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby
}) => {
  const [bet, setBet] = useState<number>(50);
  const [autoCashout, setAutoCashout] = useState<number>(2.0);
  const [isAutoEnabled, setIsAutoEnabled] = useState<boolean>(true);

  // Flight simulation state
  const [flightState, setFlightState] = useState<FlightState>('READY');
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.0);
  const [crashMultiplier, setCrashMultiplier] = useState<number | null>(null);
  const [userCashedOut, setUserCashedOut] = useState<boolean>(false);
  const [cashedOutAmount, setCashedOutAmount] = useState<number>(0);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [victoryState, setVictoryState] = useState<{
    isOpen: boolean;
    winAmount: number;
    multiplier: number;
    detail: string;
  }>({
    isOpen: false,
    winAmount: 0,
    multiplier: 2,
    detail: ''
  });

  const [history, setHistory] = useState<PastFlight[]>([
    { multiplier: 3.42, won: true, cashedOutAt: 2.0, timestamp: '14:20' },
    { multiplier: 1.18, won: false, timestamp: '14:21' },
    { multiplier: 7.85, won: true, cashedOutAt: 4.5, timestamp: '14:22' },
    { multiplier: 1.05, won: false, timestamp: '14:23' },
    { multiplier: 12.40, won: true, cashedOutAt: 2.0, timestamp: '14:24' },
    { multiplier: 2.15, won: true, cashedOutAt: 1.8, timestamp: '14:25' },
    { multiplier: 1.45, won: false, timestamp: '14:26' },
  ]);

  const animationRef = useRef<number | null>(null);
  const particleLoopRef = useRef<number | null>(null);
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const planeElRef = useRef<HTMLDivElement | null>(null);

  const flightStateRef = useRef<FlightState>('READY');
  const startTimeRef = useRef<number>(0);
  const lastParticleFrameRef = useRef<number>(0);
  const spawnAccRef = useRef<number>(0);
  const crashPointRef = useRef<number>(1.0);
  const cashedOutRef = useRef<boolean>(false);
  const currentMultRef = useRef<number>(1.0);
  const planePosRef = useRef<{ x: number; y: number; angle: number }>({ x: 8, y: 82, angle: 0 });
  const trailPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const particlesRef = useRef<SmokeParticle[]>([]);
  const streaksRef = useRef<SkyStreak[]>(
    Array.from({ length: 18 }, () => ({
      x: Math.random(),
      y: 0.08 + Math.random() * 0.72,
      len: 18 + Math.random() * 36,
      speedMul: 0.65 + Math.random() * 0.9,
      alpha: 0.08 + Math.random() * 0.16,
    }))
  );
  const betRef = useRef<number>(bet);
  betRef.current = bet;

  // Potential win if cashed out now
  const liveWinProfit = Math.floor(bet * currentMultiplier);

  const applyPlaneTransform = (pos: { x: number; y: number; angle: number }) => {
    planePosRef.current = pos;
    const el = planeElRef.current;
    if (el) {
      el.style.left = `${pos.x}%`;
      el.style.top = `${pos.y}%`;
      el.style.transform = `translate(-50%, -50%) rotate(${pos.angle}deg)`;
    }
  };

  const spawnSmokeBurst = (
    px: number,
    py: number,
    angleDeg: number,
    state: FlightState,
    mult: number,
    count = 1
  ) => {
    const rad = (angleDeg * Math.PI) / 180;
    const tailDist = 42;
    const tailX = px - Math.cos(rad) * tailDist;
    const tailY = py - Math.sin(rad) * tailDist;
    const speedBoost = 1 + Math.min(2.2, Math.log1p(Math.max(0, mult - 1)) * 0.55);

    const flyColors = [
      'rgba(255, 255, 255,',
      'rgba(254, 243, 199,',
      'rgba(253, 186, 116,',
      'rgba(226, 232, 240,'
    ];
    const crashColors = [
      'rgba(51, 65, 85,',
      'rgba(30, 41, 59,',
      'rgba(239, 68, 68,',
      'rgba(249, 115, 22,'
    ];
    const shapes: Array<'circle' | 'diamond' | 'square'> = ['circle', 'circle', 'diamond', 'square'];

    for (let i = 0; i < count; i++) {
      const isCrash = state === 'CRASHED';
      const palette = isCrash ? crashColors : flyColors;
      const color = palette[Math.floor(Math.random() * palette.length)];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const spread = (Math.random() - 0.5) * 26;
      const baseSpeed = (isCrash ? 38 : 54) * speedBoost;

      particlesRef.current.push({
        x: tailX + (Math.random() - 0.5) * 5,
        y: tailY + (Math.random() - 0.5) * 5,
        vx: -Math.cos(rad) * baseSpeed - 18 * speedBoost + spread * 0.45,
        vy: -Math.sin(rad) * baseSpeed + (isCrash ? -22 : 8) + spread * 0.45,
        size: shape === 'circle' ? 3.5 + Math.random() * 4.5 : 2.5 + Math.random() * 3.5,
        grow: isCrash ? 14 + Math.random() * 12 : 9 + Math.random() * 10,
        age: 0,
        maxAge: isCrash ? 0.55 + Math.random() * 0.45 : 0.7 + Math.random() * 0.5,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 3.2,
        shape,
        color,
        alpha: isCrash ? 0.85 : 0.55 + Math.random() * 0.25,
      });
    }

    if (particlesRef.current.length > 160) {
      particlesRef.current.splice(0, particlesRef.current.length - 160);
    }
  };

  // Continuous Canvas Particle & Flight Curve Loop
  useEffect(() => {
    const arena = arenaRef.current;
    const canvas = canvasRef.current;
    if (!arena || !canvas) return;

    const syncSize = () => {
      const rect = arena.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(arena);

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    lastParticleFrameRef.current = performance.now();

    const renderCanvasFrame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastParticleFrameRef.current) / 1000));
      lastParticleFrameRef.current = now;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const W = canvas.width / dpr;
        const H = canvas.height / dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        const state = flightStateRef.current;
        const mult = currentMultRef.current;
        const pos = planePosRef.current;
        const px = (pos.x / 100) * W;
        const py = (pos.y / 100) * H;

        // 1. Subtle sky speed streaks scaled smoothly by log(multiplier)
        if (!reducedMotion && (state === 'FLYING' || state === 'TAXIING')) {
          const streakSpeed = 0.16 + Math.min(1.4, Math.log1p(Math.max(0, mult - 1)) * 0.34);
          ctx.lineCap = 'round';
          for (const st of streaksRef.current) {
            st.x -= streakSpeed * st.speedMul * dt;
            if (st.x < -0.15) {
              st.x = 1.08;
              st.y = 0.08 + Math.random() * 0.72;
            }
            const sx = st.x * W;
            const sy = st.y * H;
            ctx.strokeStyle = `rgba(253, 186, 116, ${st.alpha})`;
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + st.len, sy);
            ctx.stroke();
          }
        }

        // 2. Smooth flight curve path up to plane's tail
        const pts = trailPointsRef.current;
        if ((state === 'FLYING' || state === 'CRASHED') && pts.length > 1) {
          const rad = (pos.angle * Math.PI) / 180;
          const tailX = px - Math.cos(rad) * 38;
          const tailY = py - Math.sin(rad) * 38;

          const grad = ctx.createLinearGradient((pts[0].x / 100) * W, (pts[0].y / 100) * H, tailX, tailY);
          grad.addColorStop(0, 'rgba(234, 88, 12, 0.08)');
          grad.addColorStop(0.55, 'rgba(245, 158, 11, 0.55)');
          grad.addColorStop(1, state === 'CRASHED' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(251, 191, 36, 0.95)');

          ctx.save();
          ctx.strokeStyle = grad;
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo((pts[0].x / 100) * W, (pts[0].y / 100) * H);
          for (let i = 1; i < pts.length; i++) {
            const prevX = (pts[i - 1].x / 100) * W;
            const prevY = (pts[i - 1].y / 100) * H;
            const curX = (pts[i].x / 100) * W;
            const curY = (pts[i].y / 100) * H;
            const midX = (prevX + curX) * 0.5;
            const midY = (prevY + curY) * 0.5;
            ctx.quadraticCurveTo(prevX, prevY, midX, midY);
          }
          ctx.lineTo(tailX, tailY);
          ctx.stroke();
          ctx.restore();
        }

        // 3. Spawn geometric smoke particles behind the plane while moving
        if (!reducedMotion && (state === 'TAXIING' || state === 'FLYING' || state === 'CRASHED')) {
          const spawnRate = state === 'FLYING' ? 52 : state === 'CRASHED' ? 60 : 28;
          spawnAccRef.current += dt * spawnRate;
          while (spawnAccRef.current >= 1) {
            spawnAccRef.current -= 1;
            spawnSmokeBurst(px, py, pos.angle, state, mult, 1);
          }
        }

        // 4. Update and draw smoke particles (circles, diamonds, squares)
        const alive: SmokeParticle[] = [];
        for (const p of particlesRef.current) {
          p.age += dt;
          if (p.age >= p.maxAge) continue;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 1 - Math.min(0.9, dt * 1.4);
          p.vy *= 1 - Math.min(0.9, dt * 1.1);
          p.size += p.grow * dt;
          p.rot += p.vRot * dt;

          const lifeRatio = 1 - p.age / p.maxAge;
          const a = p.alpha * Math.pow(lifeRatio, 1.3);

          ctx.save();
          ctx.fillStyle = `${p.color}${a.toFixed(3)})`;
          if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          } else if (p.shape === 'diamond') {
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            const r = p.size * 0.95;
            ctx.beginPath();
            ctx.moveTo(0, -r);
            ctx.lineTo(r * 0.8, 0);
            ctx.lineTo(0, r);
            ctx.lineTo(-r * 0.8, 0);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            const s = p.size * 0.72;
            ctx.fillRect(-s, -s, s * 2, s * 2);
          }
          ctx.restore();
          alive.push(p);
        }
        particlesRef.current = alive;
      }

      particleLoopRef.current = requestAnimationFrame(renderCanvasFrame);
    };

    particleLoopRef.current = requestAnimationFrame(renderCanvasFrame);

    return () => {
      ro.disconnect();
      if (particleLoopRef.current) cancelAnimationFrame(particleLoopRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  /**
   * Generates a provably fair style crash multiplier with classic house edge (98.5% RTP)
   */
  const generateCrashPoint = (): number => {
    const random = Math.random();
    if (random < 0.035) {
      return 1.0 + Math.floor(Math.random() * 8) / 100;
    }
    let outcome = 0.985 / (1 - random);
    if (outcome > 250) outcome = 250;
    if (outcome < 1.0) outcome = 1.0;
    return Math.floor(outcome * 100) / 100;
  };

  /**
   * Cash out action triggered manually by user
   */
  const handleCashOut = () => {
    if (flightStateRef.current !== 'FLYING' || userCashedOut || cashedOutRef.current) return;

    cashedOutRef.current = true;
    setUserCashedOut(true);
    const mult = currentMultRef.current;
    const winAmount = Math.floor(betRef.current * mult);
    setCashedOutAmount(winAmount);

    soundManager.playWin();
    onUpdateBalance(winAmount, true, 'limbo', betRef.current);

    if (mult >= 2) {
      setVictoryState({
        isOpen: true,
        winAmount,
        multiplier: mult,
        detail: `Pouso perfeito em ${mult.toFixed(2)}x!`
      });
    }
  };

  /**
   * Launch flight: Airplane taxies, takes off, climbs smoothly for all multipliers, and crashes
   */
  const handleStartFlight = () => {
    if (flightStateRef.current === 'FLYING' || flightStateRef.current === 'TAXIING') return;
    if (bet <= 0 || bet > balance) return;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    soundManager.playClick();
    onUpdateBalance(-bet, false, 'limbo', bet);

    const targetCrash = generateCrashPoint();
    crashPointRef.current = targetCrash;
    cashedOutRef.current = false;
    currentMultRef.current = 1.0;
    trailPointsRef.current = [{ x: 8, y: 82 }];
    particlesRef.current = [];
    spawnAccRef.current = 0;

    setUserCashedOut(false);
    setCashedOutAmount(0);
    setCrashMultiplier(null);
    setCurrentMultiplier(1.0);

    flightStateRef.current = 'TAXIING';
    setFlightState('TAXIING');
    applyPlaneTransform({ x: 8, y: 82, angle: 0 });

    const taxiDuration = 600;
    const launchStart = performance.now();

    const taxiStep = (now: number) => {
      const elapsed = now - launchStart;
      const taxiProgress = Math.min(1, elapsed / taxiDuration);
      const eased = smoothstep(0, 1, taxiProgress);

      const x = 8 + eased * 12;
      const angle = -eased * 8;
      applyPlaneTransform({ x, y: 82, angle });

      if (taxiProgress < 1) {
        animationRef.current = requestAnimationFrame(taxiStep);
      } else {
        trailPointsRef.current.push({ x: 20, y: 82 });
        flightStateRef.current = 'FLYING';
        setFlightState('FLYING');
        startTimeRef.current = performance.now();
        animationRef.current = requestAnimationFrame(flightStep);
      }
    };

    animationRef.current = requestAnimationFrame(taxiStep);
  };

  /**
   * Main Flight Loop — Smooth continuous trajectory across ALL multipliers (1x to 250x+)
   */
  const flightStep = (now: number) => {
    const elapsed = (now - startTimeRef.current) / 1000;
    const rawMult = 1.0 + elapsed * 0.28 + 0.10 * Math.pow(elapsed, 1.72);
    const mult = Math.floor(rawMult * 100) / 100;

    currentMultRef.current = mult;
    setCurrentMultiplier(mult);

    if (isAutoEnabled && !cashedOutRef.current && mult >= autoCashout && autoCashout <= crashPointRef.current) {
      cashedOutRef.current = true;
      setUserCashedOut(true);
      const winAmount = Math.floor(betRef.current * autoCashout);
      setCashedOutAmount(winAmount);
      soundManager.playWin();
      onUpdateBalance(winAmount, true, 'limbo', betRef.current);

      if (autoCashout >= 2) {
        setVictoryState({
          isOpen: true,
          winAmount,
          multiplier: autoCashout,
          detail: `Auto Cashout em ${autoCashout.toFixed(2)}x!`
        });
      }
    }

    if (mult >= crashPointRef.current) {
      triggerCrash(crashPointRef.current);
      return;
    }

    // Asymptotic smooth curve across ALL multipliers (no clamp cliff at 20x)
    const u = Math.log(Math.max(1, rawMult));
    const climbRatio = 1 - Math.exp(-0.48 * u);
    const takeoffBlend = smoothstep(0, 0.85, elapsed);

    const waveX = Math.sin(elapsed * 2.1) * 1.4 + Math.cos(elapsed * 3.4) * 0.5;
    const waveY = Math.cos(elapsed * 2.7) * 1.6 + Math.sin(elapsed * 4.1) * 0.6;

    const x = 20 + climbRatio * 56 + takeoffBlend * waveX;
    const y = 82 - Math.pow(climbRatio, 0.82) * 60 + takeoffBlend * waveY;

    // Pitch transitions smoothly from -8° at liftoff -> -25° climb -> -14° high-altitude cruise
    const targetClimbAngle = -25 + climbRatio * 11;
    const angle =
      -8 * (1 - takeoffBlend) +
      targetClimbAngle * takeoffBlend +
      takeoffBlend * Math.sin(elapsed * 3.2) * 2.2;

    applyPlaneTransform({ x, y, angle });

    const pts = trailPointsRef.current;
    const lastPt = pts[pts.length - 1];
    if (!lastPt || Math.hypot(x - lastPt.x, y - lastPt.y) >= 1.2) {
      pts.push({ x, y });
      if (pts.length > 140) pts.shift();
    }

    if (Math.random() < 0.25) {
      soundManager.playReelTick();
    }

    animationRef.current = requestAnimationFrame(flightStep);
  };

  /**
   * Airplane Crash Sequence
   */
  const triggerCrash = (finalMult: number) => {
    flightStateRef.current = 'CRASHED';
    setFlightState('CRASHED');
    setCrashMultiplier(finalMult);
    currentMultRef.current = finalMult;
    setCurrentMultiplier(finalMult);

    if (!cashedOutRef.current) {
      soundManager.playLoss();
      reportRoundLoss('limbo');
    }

    setHistory((prev) => [
      {
        multiplier: finalMult,
        cashedOutAt: cashedOutRef.current ? (isAutoEnabled ? Math.min(autoCashout, finalMult) : finalMult) : undefined,
        won: cashedOutRef.current,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...prev.slice(0, 8)
    ]);

    const crashStart = performance.now();
    const startX = planePosRef.current.x;
    const startY = planePosRef.current.y;
    const startAngle = planePosRef.current.angle;

    const crashFallStep = (now: number) => {
      const elapsed = (now - crashStart) / 1000;
      const progress = Math.min(1, elapsed / 0.85);
      const eased = smoothstep(0, 1, progress);

      const crashAngle = startAngle + (75 - startAngle) * eased;
      const x = Math.min(95, startX + progress * 16);
      const y = Math.min(94, startY + Math.pow(progress, 2) * (92 - startY));

      applyPlaneTransform({ x, y, angle: crashAngle });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(crashFallStep);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(crashFallStep);
  };

  const handleResetToRunway = () => {
    if (flightStateRef.current === 'FLYING' || flightStateRef.current === 'TAXIING') return;
    flightStateRef.current = 'READY';
    setFlightState('READY');
    currentMultRef.current = 1.0;
    trailPointsRef.current = [];
    particlesRef.current = [];
    applyPlaneTransform({ x: 8, y: 82, angle: 0 });
    setCurrentMultiplier(1.0);
    setCrashMultiplier(null);
    setUserCashedOut(false);
  };

  return (
    <div className="space-y-1.5 animate-fade-in max-w-6xl mx-auto pb-1">
      {/* Top Bar Navigation & Info */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#230b08] hover:bg-[#320f0a] border border-orange-500/30 text-orange-300 text-xs font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Lobby</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs bg-orange-600/20 border border-orange-500/40 text-orange-300 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
            <Plane className="w-3 h-3 text-orange-400 rotate-45" />
            <span>Aviãozinho Sapeca (Crash)</span>
          </span>
          <span className="text-[11px] bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-mono font-bold">
            99.0% RTP
          </span>
        </div>
      </div>

      {/* Main Flight Arena & Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 items-start">
        {/* Visual Arena: Real-time Airplane Flight Stage */}
        <div
          ref={arenaRef}
          className="lg:col-span-8 relative rounded-2xl overflow-hidden border-2 border-orange-500/40 bg-gradient-to-b from-[#1c0805] via-[#140504] to-[#0a0201] shadow-[0_0_40px_rgba(234,88,12,0.18)] flex flex-col justify-between min-h-[260px] sm:min-h-[290px]"
        >
          {/* Sky Altitude Grid & Horizon Background */}
          <div className="absolute inset-0 pointer-events-none opacity-25">
            <div className="absolute inset-0 flex flex-col justify-between p-6">
              <div className="border-b border-orange-400/30 flex justify-between text-[10px] text-orange-400/60 font-mono">
                <span>ESTRATOSFERA · 20.00x+</span>
                <span>ALT: 12.000m</span>
              </div>
              <div className="border-b border-orange-400/20 flex justify-between text-[10px] text-orange-400/50 font-mono">
                <span>ALTA ALTITUDE · 5.00x</span>
                <span>ALT: 6.000m</span>
              </div>
              <div className="border-b border-orange-400/20 flex justify-between text-[10px] text-orange-400/40 font-mono">
                <span>ZONA DE CRUZEIRO · 2.00x</span>
                <span>ALT: 2.500m</span>
              </div>
              <div className="border-b border-orange-500/30 flex justify-between text-[10px] text-orange-400/40 font-mono">
                <span>DECOLAGEM · 1.00x</span>
                <span>PISTA IMPERIAL</span>
              </div>
            </div>
          </div>

          {/* Runway Tarmac Ground at Bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0302] to-[#1a0705] border-t-2 border-orange-600/40 flex items-center px-4 overflow-hidden">
            <div className="w-full flex items-center justify-start gap-4 opacity-50">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-1.5 w-10 bg-amber-400/80 rounded shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
              ))}
            </div>
            <div className="absolute bottom-1 left-2 flex gap-3 text-[10px] font-mono font-bold text-emerald-400">
              <span className="animate-pulse">● RUNWAY 07</span>
            </div>
          </div>

          {/* Drifting Clouds & Sky Ambient Glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className={`absolute top-12 left-0 right-0 h-28 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent transition-opacity duration-1000 ${
                flightState === 'FLYING' ? 'opacity-100' : 'opacity-40'
              }`}
            />
          </div>

          {/* TOP BAR: Past Multiplier Chips Ticker */}
          <div className="relative z-20 p-4 sm:p-5 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-orange-500/20 bg-black/30 backdrop-blur-xs">
            <span className="text-[11px] font-extrabold text-orange-400/90 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-orange-500" /> Voos Recentes:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {history.map((h, i) => (
                <span
                  key={i}
                  className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold shrink-0 shadow-sm border transition-all ${
                    h.multiplier >= 2.0
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-emerald-950'
                      : h.multiplier >= 1.5
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/40 shadow-amber-950'
                      : 'bg-red-950/80 text-red-400 border-red-500/40 shadow-red-950'
                  }`}
                >
                  {h.multiplier.toFixed(2)}x
                </span>
              ))}
            </div>
          </div>

          {/* CENTER STAGE: Huge Live Multiplier & Flight Status Display */}
          <div className="relative z-20 my-auto text-center px-4 py-6 pointer-events-none select-none">
            {flightState === 'CRASHED' ? (
              <div className="space-y-2 animate-bounce">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/30 border border-red-500 text-red-300 text-xs font-black uppercase tracking-wider shadow-lg shadow-red-900/60">
                  <AlertOctagon className="w-4 h-4 text-red-400" /> O AVIÃO CAIU!
                </div>
                <div className="font-mono text-6xl sm:text-7xl font-black text-red-500 drop-shadow-[0_0_35px_rgba(239,68,68,0.9)] tracking-tight tabular-nums">
                  {crashMultiplier?.toFixed(2)}x
                </div>
                <p className="text-xs sm:text-sm text-red-300/80 font-semibold">
                  Aeronave perdeu sustentação em {crashMultiplier?.toFixed(2)}x
                </p>
              </div>
            ) : flightState === 'FLYING' || flightState === 'TAXIING' ? (
              <div className="space-y-2">
                <div className="font-mono text-6xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-300 to-orange-500 drop-shadow-[0_0_35px_rgba(245,158,11,0.6)] tracking-tight tabular-nums">
                  {currentMultiplier.toFixed(2)}x
                </div>

                {userCashedOut ? (
                  <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-xs sm:text-sm font-extrabold uppercase tracking-wide shadow-lg shadow-emerald-950/80 animate-pulse">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>LUCRO GARANTIDO: +{cashedOutAmount.toLocaleString('pt-BR')} FICHAS!</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-orange-200">
                    <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
                    <span>Ganho Atual: <strong className="text-emerald-400 font-mono font-black tabular-nums">+{liveWinProfit.toLocaleString('pt-BR')}</strong></span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="font-mono text-5xl sm:text-6xl font-black text-amber-400/80 tracking-tight drop-shadow-[0_0_20px_rgba(245,158,11,0.3)] tabular-nums">
                  1.00x
                </div>
                <div className="inline-block px-4 py-1.5 rounded-xl bg-[#2a0e08] border border-orange-500/40 text-orange-300 text-xs font-bold uppercase tracking-wider">
                  Aeronave Pronta na Pista · Ajuste sua aposta e decole
                </div>
              </div>
            )}
          </div>

          {/* DYNAMIC CANVAS SMOKE TRAIL & SMOOTH AIRPLANE LAYER */}
          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* THE AIRPLANE AVATAR (Smooth RAF transform, no CSS transition jitter) */}
            <div
              ref={planeElRef}
              className="absolute select-none will-change-transform"
              style={{
                left: '8%',
                top: '82%',
                transform: 'translate(-50%, -50%) rotate(0deg)',
                width: '92px',
                height: '56px'
              }}
            >
              <div className="relative w-full h-full filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)]">
                <svg viewBox="0 0 100 60" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="fuselageGrad" x1="0%" y1="0%" x2="100%" y2="50%">
                      <stop offset="0%" stopColor="#7f1d1d" />
                      <stop offset="40%" stopColor="#dc2626" />
                      <stop offset="85%" stopColor="#ea580c" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                    <linearGradient id="wingGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#b45309" />
                      <stop offset="50%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#fef08a" />
                    </linearGradient>
                  </defs>

                  {/* Engine Exhaust Jet Flame (Only while flying) */}
                  {(flightState === 'FLYING' || flightState === 'TAXIING') && (
                    <g className="animate-pulse">
                      <polygon
                        points="5,30 -16,26 -28,30 -16,34"
                        fill="#fbbf24"
                        opacity="0.9"
                      />
                      <polygon
                        points="5,30 -12,28 -20,30 -12,32"
                        fill="#ffffff"
                        opacity="0.9"
                      />
                    </g>
                  )}

                  {/* Tail Fin */}
                  <polygon
                    points="8,26 18,10 26,10 22,26"
                    fill="url(#wingGoldGrad)"
                    stroke="#9a3412"
                    strokeWidth="1"
                  />
                  <circle cx="19" cy="16" r="3" fill="#ffffff" />

                  {/* Main Fuselage Body */}
                  <path
                    d="M 6,30 Q 14,23 35,22 L 72,23 Q 86,25 92,30 Q 86,35 72,37 L 35,37 Q 14,37 6,30 Z"
                    fill="url(#fuselageGrad)"
                    stroke="#fbbf24"
                    strokeWidth="1.2"
                  />

                  {/* Cockpit Glass Canopy */}
                  <path
                    d="M 60,23 L 73,24 Q 78,28 73,31 L 62,31 Q 57,27 60,23 Z"
                    fill="#38bdf8"
                    opacity="0.9"
                    stroke="#ffffff"
                    strokeWidth="0.8"
                  />
                  <line x1="64" y1="25" x2="71" y2="28" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />

                  {/* Golden Wing */}
                  <polygon
                    points="38,30 52,48 64,48 54,30"
                    fill="url(#wingGoldGrad)"
                    stroke="#78350f"
                    strokeWidth="1"
                  />

                  {/* Upper Wing Tip */}
                  <polygon
                    points="42,26 54,12 62,12 52,26"
                    fill="url(#wingGoldGrad)"
                    stroke="#78350f"
                    strokeWidth="0.8"
                    opacity="0.85"
                  />

                  {/* Nose Spinner & Propeller */}
                  <ellipse cx="92" cy="30" rx="3" ry="5" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
                  <line
                    x1="93"
                    y1="12"
                    x2="93"
                    y2="48"
                    stroke="#fef08a"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    opacity={flightState === 'FLYING' || flightState === 'TAXIING' ? '0.75' : '0.3'}
                    className={flightState === 'FLYING' ? 'animate-pulse' : ''}
                  />
                </svg>

                {/* Crash Flame Burst when crashed */}
                {flightState === 'CRASHED' && (
                  <div className="absolute -top-6 -left-6 w-24 h-24 pointer-events-none flex items-center justify-center">
                    <div className="absolute w-20 h-20 rounded-full bg-red-600/70 blur-md animate-ping" />
                    <div className="absolute w-14 h-14 rounded-full bg-orange-500/80 blur-sm animate-pulse" />
                    <div className="absolute w-8 h-8 rounded-full bg-yellow-300 blur-xs" />
                    <span className="text-2xl animate-bounce">💥</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* BOTTOM BAR: Real-time Flight Metrics & Auto-Cashout Status */}
          <div className="relative z-20 p-3 sm:p-4 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-wrap items-center justify-between text-xs text-orange-200/90 border-t border-orange-500/20 gap-2">
            <div className="flex items-center gap-3">
              <span>Auto Encerrar: <strong className="text-amber-300 font-mono">{isAutoEnabled ? `${autoCashout.toFixed(2)}x` : 'Manual'}</strong></span>
              <span>Lucro Alvo: <strong className="text-emerald-400 font-mono">+{Math.floor(bet * autoCashout).toLocaleString('pt-BR')}</strong></span>
            </div>

            {flightState === 'CRASHED' && (
              <button
                onClick={handleResetToRunway}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-600/30 hover:bg-orange-600/50 border border-orange-400/40 text-orange-200 text-[11px] font-bold cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
                <span>Posicionar na Pista</span>
              </button>
            )}
          </div>
        </div>

        {/* RIGHT CONTROL PANEL: Betting, Cashout & Flight Controls */}
        <div className="lg:col-span-4 rounded-2xl border border-orange-500/35 bg-[#1b0805] p-3 sm:p-3.5 space-y-2.5 flex flex-col justify-between shadow-xl">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-orange-500/20 pb-1.5">
              <h3 className="text-xs font-bold text-orange-300 font-cinzel flex items-center gap-1.5">
                <Plane className="w-3.5 h-3.5 text-orange-500" /> Controle de Voo
              </h3>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.2 rounded-full font-bold uppercase tracking-wider border border-amber-400/30">
                Ao Vivo
              </span>
            </div>

            {/* Bet Amount Selector */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px] font-semibold text-orange-200">
                <span>Valor da Aposta</span>
                <span className="text-amber-400 font-mono font-bold">Saldo: {balance.toLocaleString('pt-BR')}</span>
              </div>
              <ChipSelector
                currentBet={bet}
                balance={balance}
                onBetChange={setBet}
                disabled={flightState === 'FLYING' || flightState === 'TAXIING'}
                compact={true}
              />
            </div>

            {/* Auto Cashout Multiplier Settings */}
            <div className="space-y-1.5 pt-1.5 border-t border-orange-500/20">
              <div className="flex items-center justify-between text-[11px] font-semibold text-orange-200">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAutoEnabled}
                    onChange={(e) => setIsAutoEnabled(e.target.checked)}
                    disabled={flightState === 'FLYING' || flightState === 'TAXIING'}
                    className="accent-orange-500 w-3.5 h-3.5 rounded cursor-pointer"
                  />
                  <span>Auto Encerrar</span>
                </label>
                <span className="font-mono text-amber-300 font-bold text-xs">
                  {autoCashout.toFixed(2)}x
                </span>
              </div>

              {/* Quick Multiplier Pill Buttons */}
              <div className="grid grid-cols-4 gap-1">
                {[1.5, 2.0, 3.0, 5.0].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setAutoCashout(val);
                      setIsAutoEnabled(true);
                    }}
                    disabled={flightState === 'FLYING' || flightState === 'TAXIING'}
                    className={`py-1 rounded-lg text-[10px] font-bold font-mono transition-all cursor-pointer ${
                      isAutoEnabled && autoCashout === val
                        ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-sm border border-orange-300/40'
                        : 'bg-[#250d09] text-orange-300 border border-orange-500/20 hover:bg-[#32110c]'
                    }`}
                  >
                    {val.toFixed(1)}x
                  </button>
                ))}
              </div>

              {/* Range Slider for custom precision */}
              <input
                type="range"
                min="1.10"
                max="25.0"
                step="0.05"
                value={autoCashout}
                disabled={!isAutoEnabled || flightState === 'FLYING' || flightState === 'TAXIING'}
                onChange={(e) => setAutoCashout(parseFloat(e.target.value))}
                className="w-full accent-orange-500 cursor-pointer h-1.5 mt-1"
              />
            </div>
          </div>

          {/* MAIN ACTION BUTTON: DYNAMIC LAUNCH OR REAL-TIME CASH OUT */}
          <div className="space-y-1.5 pt-2 border-t border-orange-500/20">
            {flightState === 'FLYING' && !userCashedOut ? (
              /* REAL-TIME CASH OUT BUTTON WHILE FLYING */
              <button
                onClick={handleCashOut}
                className="w-full py-3 rounded-xl text-xs sm:text-sm font-black tracking-wider uppercase transition-all shadow-lg shadow-emerald-950/80 cursor-pointer bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 text-white hover:brightness-110 active:scale-95 border border-emerald-300/60 flex flex-col items-center justify-center gap-0.5 animate-pulse"
              >
                <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <TrendingUp className="w-4 h-4 text-emerald-200" />
                  <span>ENCERRAR (CASH OUT)</span>
                </div>
                <span className="font-mono text-[10px] text-emerald-100 font-extrabold">
                  +{liveWinProfit.toLocaleString('pt-BR')} Fichas ({currentMultiplier.toFixed(2)}x)
                </span>
              </button>
            ) : flightState === 'FLYING' && userCashedOut ? (
              /* ALREADY CASHED OUT THIS FLIGHT */
              <div className="w-full py-2.5 rounded-xl bg-[#1e2a1e] border border-emerald-500/50 text-emerald-300 text-center flex flex-col items-center justify-center gap-0.5 shadow-md">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-extrabold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Lucro Garantido!</span>
                </div>
                <span className="font-mono text-xs font-black text-emerald-200">
                  +{cashedOutAmount.toLocaleString('pt-BR')} Fichas Coletadas
                </span>
              </div>
            ) : flightState === 'TAXIING' ? (
              /* TAXIING ENGINE REV-UP */
              <button
                disabled
                className="w-full py-3 rounded-xl text-xs font-extrabold uppercase bg-orange-950/70 border border-orange-500/30 text-orange-300 cursor-not-allowed flex items-center justify-center gap-1.5 animate-pulse"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Acelerando na Pista...</span>
              </button>
            ) : (
              /* READY TO LAUNCH AIRPLANE */
              <button
                onClick={handleStartFlight}
                disabled={bet <= 0 || bet > balance}
                className={`w-full py-3 rounded-xl text-xs sm:text-sm font-black tracking-wider uppercase transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 ${
                  bet > balance
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 text-white hover:brightness-110 shadow-orange-600/40 border border-orange-300/40 hover:scale-[1.01] active:scale-98'
                }`}
              >
                <Plane className="w-4 h-4 text-amber-200 rotate-45 animate-bounce" />
                <span>Decolar Avião ✈️</span>
              </button>
            )}

            {/* Provably Fair & Social Guarantee Info */}
            <div className="flex items-center justify-between text-[10px] text-orange-300/60 px-0.5">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Provably Fair
              </span>
              <span>100% Social Fictício</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Como Jogar Button */}
      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => setShowHowToPlay(true)}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#230b08] hover:bg-[#320f0a] border border-amber-500/35 text-amber-300 text-xs font-bold transition-colors cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Como jogar Aviãozinho Sapeca (Crash)</span>
        </button>
      </div>

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        gameId="limbo"
      />

      <LimboVictoryOverlay
        isOpen={victoryState.isOpen}
        winAmount={victoryState.winAmount}
        multiplier={victoryState.multiplier}
        detail={victoryState.detail}
        onCollect={() => setVictoryState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
