import React, { useState } from 'react';
import { X, Sparkles, Gift, Flame, Trophy } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface VipWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReward: (amount: number) => void;
}

const SEGMENTS = [
  { amount: 500, color: '#ea580c', label: '500 Fichas' },
  { amount: 1000, color: '#c2410c', label: '1.000 Fichas' },
  { amount: 250, color: '#b91c1c', label: '250 Fichas' },
  { amount: 2500, color: '#f59e0b', label: '2.500 Fichas' },
  { amount: 750, color: '#ea580c', label: '750 Fichas' },
  { amount: 5000, color: '#e11d48', label: '5.000 Fichas' },
  { amount: 1500, color: '#c2410c', label: '1.500 Fichas' },
  { amount: 10000, color: '#fbbf24', label: '💎 10.000 JACKPOT' },
];

export const VipWheelModal: React.FC<VipWheelModalProps> = ({
  isOpen,
  onClose,
  onReward
}) => {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonReward, setWonReward] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSpin = () => {
    if (spinning) return;
    setSpinning(true);
    setWonReward(null);
    soundManager.playClick();

    // Pick random segment
    const segmentIndex = Math.floor(Math.random() * SEGMENTS.length);
    const segmentAngle = 360 / SEGMENTS.length;
    // Calculate final angle (3-5 extra full rotations + landing on segment center)
    const extraRotations = (4 + Math.floor(Math.random() * 2)) * 360;
    // Pointer is at the top (270 degrees in canvas / standard circle)
    const targetAngle = extraRotations + (360 - (segmentIndex * segmentAngle + segmentAngle / 2));
    
    setRotation(targetAngle);

    // Audio ticks during spin
    const interval = setInterval(() => {
      soundManager.playReelTick();
    }, 120);

    setTimeout(() => {
      clearInterval(interval);
      setSpinning(false);
      const prize = SEGMENTS[segmentIndex].amount;
      setWonReward(prize);
      soundManager.playWin();
      onReward(prize);
    }, 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative my-auto w-full max-w-md bg-[#160604] border-2 border-orange-500/50 rounded-3xl p-6 shadow-2xl shadow-orange-950/80 overflow-hidden text-center space-y-5">
        {/* Glow ambient background */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={spinning}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white bg-[#260e0a] border border-orange-500/30 transition-colors disabled:opacity-40 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-orange-600/30 border border-orange-500/50 text-[10px] font-black uppercase tracking-wider text-orange-300 mb-2">
            <Flame className="w-3.5 h-3.5 text-orange-400" /> Roleta da Fortuna VIP
          </div>
          <h2 className="text-2xl font-black text-white font-cinzel">
            Giro Grátis <span className="text-flame-gradient">Imperial</span>
          </h2>
          <p className="text-xs text-orange-200/80 mt-1">
            Gire a roda e multiplique suas fichas fictícias gratuitamente!
          </p>
        </div>

        {/* Wheel Graphic */}
        <div className="relative w-64 h-64 mx-auto my-2">
          {/* Top Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-amber-400 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]" />

          {/* Rotating Canvas / SVG Wheel */}
          <div
            className="w-full h-full rounded-full border-4 border-amber-400/80 shadow-[0_0_30px_rgba(234,88,12,0.4)] overflow-hidden transition-transform duration-[4000ms] cubic-bezier(0.15, 0.9, 0.2, 1)"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {SEGMENTS.map((seg, i) => {
                const angle = 360 / SEGMENTS.length;
                const startAngle = (i * angle * Math.PI) / 180;
                const endAngle = ((i + 1) * angle * Math.PI) / 180;
                const x1 = 100 + 100 * Math.cos(startAngle);
                const y1 = 100 + 100 * Math.sin(startAngle);
                const x2 = 100 + 100 * Math.cos(endAngle);
                const y2 = 100 + 100 * Math.sin(endAngle);

                // Mid angle for text
                const midAngle = ((i + 0.5) * angle);

                return (
                  <g key={i}>
                    <path
                      d={`M 100 100 L ${x1} ${y1} A 100 100 0 0 1 ${x2} ${y2} Z`}
                      fill={seg.color}
                      stroke="#140604"
                      strokeWidth="2"
                    />
                    <text
                      x="100"
                      y="32"
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                      transform={`rotate(${midAngle + 90}, 100, 100)`}
                    >
                      {seg.amount}
                    </text>
                  </g>
                );
              })}
              {/* Center Hub */}
              <circle cx="100" cy="100" r="26" fill="#140604" stroke="#fbbf24" strokeWidth="4" />
              <circle cx="100" cy="100" r="14" fill="#ea580c" />
            </svg>
          </div>
        </div>

        {/* Won Prize Notification */}
        {wonReward !== null && (
          <div className="p-3 bg-gradient-to-r from-orange-600/40 via-red-600/30 to-amber-500/40 border border-orange-400 rounded-2xl animate-fade-in">
            <span className="text-xs text-orange-200 font-semibold block">Parabéns! Você ganhou:</span>
            <span className="text-xl font-mono font-black text-amber-300">
              +{wonReward.toLocaleString('pt-BR')} Fichas Fictícias!
            </span>
          </div>
        )}

        {/* Spin Action Button */}
        <button
          onClick={handleSpin}
          disabled={spinning}
          className={`w-full py-3.5 rounded-2xl text-sm font-black uppercase tracking-wider transition-all shadow-xl cursor-pointer flex items-center justify-center gap-2 ${
            spinning
              ? 'bg-orange-950 text-orange-400 border border-orange-600/40 cursor-not-allowed opacity-80'
              : 'bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 text-white hover:brightness-110 shadow-orange-600/50 border border-orange-300/40 hover:scale-[1.02]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-200" />
          <span>{spinning ? 'Girando a Roleta...' : 'GIRAR AGORA (GRÁTIS)'}</span>
        </button>
      </div>
    </div>
  );
};
