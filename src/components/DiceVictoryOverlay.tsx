import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '../utils/audio';

interface DiceVictoryOverlayProps {
  isOpen: boolean;
  winAmount: number;
  diceValues: number[];
  variant: 'craps' | 'sicbo';
  subtitle: string;
  reason: string;
  onCollect: () => void;
}

const PIP_CONFIGS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const TOP_ANGLES: Record<number, { x: number; y: number; z: number }> = {
  1: { x: 90, y: 0, z: 0 },
  2: { x: 180, y: 0, z: 0 },
  3: { x: 90, y: -90, z: 0 },
  4: { x: 90, y: 90, z: 0 },
  5: { x: 0, y: 0, z: 0 },
  6: { x: -90, y: 0, z: 0 },
};

const buildDiceTransform = (
  val: number,
  idx: number,
  spin: { x: number; y: number; z: number }
): string => {
  const top = TOP_ANGLES[val] || TOP_ANGLES[1];
  const wobble = idx === 0 ? -4 : idx === 1 ? 4 : -1;
  return `rotateX(-54deg) rotateY(${14 + wobble}deg) rotateX(${spin.x + top.x}deg) rotateY(${spin.y + top.y}deg) rotateZ(${spin.z + top.z}deg)`;
};

export const DiceVictoryOverlay: React.FC<DiceVictoryOverlayProps> = ({
  isOpen,
  winAmount,
  diceValues,
  variant,
  subtitle,
  reason,
  onCollect,
}) => {
  const [displayAmount, setDisplayAmount] = useState<number>(0);
  const [countDone, setCountDone] = useState<boolean>(false);
  const [settledDice, setSettledDice] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const countRafRef = useRef<number | null>(null);
  const fxRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSettledDice(false);
      if (countRafRef.current) cancelAnimationFrame(countRafRef.current);
      if (fxRafRef.current) cancelAnimationFrame(fxRafRef.current);
      return;
    }

    setSettledDice(false);
    const settleRaf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSettledDice(true));
    });

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
    let resizeFn: (() => void) | null = null;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        resizeFn = () => {
          canvas.width = Math.floor(window.innerWidth * dpr);
          canvas.height = Math.floor(window.innerHeight * dpr);
        };
        resizeFn();
        window.addEventListener('resize', resizeFn);

        const chipThemes = [
          { body: '#dc2626', rim: '#fde047' },
          { body: '#f59e0b', rim: '#fffbeb' },
          { body: '#059669', rim: '#fef08a' },
          { body: '#2563eb', rim: '#ffffff' },
        ];

        const chips = Array.from({ length: 24 }, (_, idx) => {
          const fromCenter = idx % 3 === 0;
          return {
            x: fromCenter ? canvas.width * 0.5 : Math.random() * canvas.width,
            y: fromCenter ? canvas.height * 0.45 : -Math.random() * canvas.height * 0.6,
            vx: fromCenter ? (Math.random() - 0.5) * 7.5 * dpr : (Math.random() - 0.5) * 2.2 * dpr,
            vy: fromCenter ? -(4.5 + Math.random() * 5.5) * dpr : (3.2 + Math.random() * 3.8) * dpr,
            r: (10 + Math.random() * 7) * dpr,
            spin: Math.random() * Math.PI * 2,
            vSpin: (Math.random() - 0.5) * 0.16,
            rot: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 0.08,
            theme: chipThemes[idx % chipThemes.length],
            mode: fromCenter ? 'burst' : 'rain',
          };
        });

        const sparks = Array.from({ length: 42 }, () => ({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: (1.2 + Math.random() * 2.5) * dpr,
          vx: (Math.random() - 0.5) * 0.55 * dpr,
          vy: -(0.35 + Math.random() * 0.9) * dpr,
          phase: Math.random() * Math.PI * 2,
          isAmber: Math.random() < 0.7,
        }));

        let last = performance.now();
        const renderFx = (now: number) => {
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          for (let i = 0; i < sparks.length; i++) {
            const s = sparks[i];
            s.x += s.vx * (dt * 60);
            s.y += s.vy * (dt * 60);
            s.phase += dt * 3.4;
            if (s.y < -12 * dpr) {
              s.y = h + 12 * dpr;
              s.x = Math.random() * w;
            }
            if (s.x < 0) s.x = w;
            if (s.x > w) s.x = 0;

            const alpha = 0.35 + 0.65 * Math.abs(Math.sin(s.phase));
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = s.isAmber ? '#fde047' : '#fffbeb';
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 10 * dpr;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          for (let i = 0; i < chips.length; i++) {
            const ch = chips[i];
            ch.x += ch.vx * (dt * 60);
            ch.y += ch.vy * (dt * 60);
            if (ch.mode === 'burst') ch.vy += 0.19 * dpr * (dt * 60);
            ch.spin += ch.vSpin * (dt * 60);
            ch.rot += ch.vRot * (dt * 60);

            if (ch.y > h + 38 * dpr) {
              ch.x = Math.random() * w;
              ch.y = -24 * dpr;
              ch.vx = (Math.random() - 0.5) * 2.4 * dpr;
              ch.vy = (3.4 + Math.random() * 3.8) * dpr;
              ch.mode = 'rain';
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
      }
    }

    return () => {
      cancelAnimationFrame(settleRaf);
      if (resizeFn) window.removeEventListener('resize', resizeFn);
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
      className="dice-victory-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={handleAccelerate}
    >
      <div className="dice-victory-glow" />
      <div className="dice-win-light-rays" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-[2]"
      />

      <div className="dice-victory-header">
        <div className="text-[11px] font-extrabold tracking-[2px] uppercase text-amber-200 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
          {subtitle}
        </div>
        <h2 className="dice-victory-title">VITÓRIA!</h2>
      </div>

      <div className="dice-victory-stage">
        {diceValues.map((val, idx) => (
          <div key={idx} className="dice-win-drop-slot">
            <div className="dice-win-ground-shadow" />
            <div className="dice-win-float-3d">
              <div className={`dice-win-cube-aura ${variant === 'sicbo' ? 'sicbo-die' : 'craps-die'}`}>
                <div
                  className="dice-cube-3d"
                  style={{
                    transform: buildDiceTransform(
                      val,
                      idx,
                      settledDice ? { x: 0, y: 0, z: 0 } : { x: -720, y: 720, z: 360 }
                    ),
                  }}
                >
                  {[1, 2, 3, 4, 5, 6].map((faceNum) => (
                    <div key={faceNum} className={`dice-face-3d f-${faceNum}`}>
                      {Array.from({ length: 9 }).map((__, cellIdx) => {
                        const hasPip = PIP_CONFIGS[faceNum].includes(cellIdx);
                        return (
                          <div key={cellIdx} className="pip-cell">
                            {hasPip && <div className="pip-dot" />}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="dice-victory-prize-card">
        <div className="text-[10px] font-extrabold text-amber-200 uppercase tracking-[2px] mb-1">
          PRÊMIO DA MESA
        </div>
        <div className="limbo-victory-amount">
          {displayAmount.toLocaleString('pt-BR')} FICHAS
        </div>
        <div className="mt-1 text-xs font-bold text-rose-300">{reason}</div>
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
