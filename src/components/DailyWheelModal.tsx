import React, { useState, useEffect } from 'react';
import { soundManager } from '../utils/audio';
import { fireConfetti } from '../utils/confetti';
import { X, Sparkles, Trophy, Clock, Play } from 'lucide-react';
import { UserAccount } from '../types/casino';
import { canSpinDailyWheel, getDailyWheelRemainingMs, formatRemainingTime, recordDailyWheelSpin } from '../utils/auth';

interface DailyWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: UserAccount | null;
  onAccountUpdate: () => void;
}

interface WheelSegment {
  label: string;
  amount: number;
  color: string;
  textColor: string;
}

const SEGMENTS: WheelSegment[] = [
  { label: '50.000 🪙', amount: 50000, color: '#f59e0b', textColor: '#0f172a' },
  { label: '2.500 🪙', amount: 2500, color: '#991b1b', textColor: '#ffffff' },
  { label: '10.000 🪙', amount: 10000, color: '#ea580c', textColor: '#ffffff' },
  { label: '1.000 🪙', amount: 1000, color: '#1e293b', textColor: '#ffffff' },
  { label: '25.000 🪙', amount: 25000, color: '#eab308', textColor: '#0f172a' },
  { label: '5.000 🪙', amount: 5000, color: '#b91c1c', textColor: '#ffffff' },
  { label: '15.000 🪙', amount: 15000, color: '#c2410c', textColor: '#ffffff' },
  { label: '8.000 🪙', amount: 8000, color: '#0f172a', textColor: '#ffffff' },
];

export const DailyWheelModal: React.FC<DailyWheelModalProps> = ({
  isOpen,
  onClose,
  account,
  onAccountUpdate
}) => {
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [rotation, setRotation] = useState<number>(0);
  const [wonPrize, setWonPrize] = useState<WheelSegment | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);

  const canSpin = account ? canSpinDailyWheel(account) : false;

  useEffect(() => {
    if (!account) return;
    const updateCountdown = () => {
      setRemainingMs(getDailyWheelRemainingMs(account));
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [account, isOpen]);

  if (!isOpen || !account) return null;

  const handleSpin = () => {
    if (isSpinning || !canSpin) return;

    soundManager.playChip();
    setIsSpinning(true);
    setWonPrize(null);

    // Pick target segment
    const segmentIndex = Math.floor(Math.random() * SEGMENTS.length);
    const targetSegment = SEGMENTS[segmentIndex];
    const sliceAngle = 360 / SEGMENTS.length; // 45 deg

    // Calculate rotation so pointer at top points to chosen segment
    const currentRot = rotation % 360;
    const fullSpins = (6 + Math.floor(Math.random() * 2)) * 360;
    const targetAngle = fullSpins + (360 - segmentIndex * sliceAngle - sliceAngle / 2);
    const finalRot = rotation + (targetAngle - currentRot);
    setRotation(finalRot);

    // Audio ticks during spin
    for (let i = 0; i < 24; i++) {
      setTimeout(() => {
        soundManager.playRouletteTick(1200 + i * 20);
      }, i * 160);
    }

    setTimeout(() => {
      setIsSpinning(false);
      setWonPrize(targetSegment);
      soundManager.playWin();
      fireConfetti(2800);

      recordDailyWheelSpin(account.username, targetSegment.amount, targetSegment.label);
      window.dispatchEvent(new CustomEvent('sapecas_avatar_goal', {
        detail: { reason: 'wheel_win', amount: targetSegment.amount }
      }));
      onAccountUpdate();
    }, 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative my-auto w-full max-w-sm sm:max-w-md bg-gradient-to-b from-[#250a06] via-[#160503] to-[#0a0201] border-2 border-amber-500/80 rounded-2xl p-4 sm:p-5 shadow-2xl text-center space-y-3">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2.5 right-2.5 p-1 rounded-full text-amber-300/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/30 to-amber-500/20 border border-amber-400/40 text-amber-300 font-cinzel font-black text-xs uppercase tracking-widest shadow-inner">
          <Trophy className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
          <span>Roleta Diária da Sorte</span>
        </div>

        <p className="text-xs text-orange-200/80">
          Gire uma vez a cada 24 horas para faturar até <strong>50.000 fichas</strong> gratuitas!
        </p>

        {/* Spinning Wheel */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 mx-auto flex items-center justify-center my-1">
          {/* Top Pointer */}
          <div className="absolute -top-3 z-30 flex flex-col items-center">
            <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[14px] border-t-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" />
          </div>

          {/* Wheel Frame */}
          <div
            className="w-full h-full rounded-full border-4 border-amber-500 shadow-2xl overflow-hidden relative"
            style={{
              transform: `rotate(${rotation}deg)`,
              transitionDuration: isSpinning ? '4s' : '0s',
              transitionTimingFunction: 'cubic-bezier(0.12, 0.88, 0.2, 1)'
            }}
          >
            <svg viewBox="0 0 200 200" className="w-full h-full select-none">
              <circle cx="100" cy="100" r="98" fill="#1e0804" />
              {SEGMENTS.map((seg, idx) => {
                const angle = (360 / SEGMENTS.length) * idx;
                return (
                  <g key={idx} transform={`rotate(${angle} 100 100)`}>
                    <path
                      d="M 100 100 L 71 8 A 96 96 0 0 1 129 8 Z"
                      fill={seg.color}
                      stroke="#78350f"
                      strokeWidth="0.8"
                    />
                    <text
                      x="100"
                      y="32"
                      fill={seg.textColor}
                      fontSize="8.5"
                      fontWeight="900"
                      textAnchor="middle"
                      transform="rotate(90 100 32)"
                      fontFamily="Cinzel, sans-serif"
                    >
                      {seg.label}
                    </text>
                  </g>
                );
              })}
              {/* Center Hub */}
              <circle cx="100" cy="100" r="24" fill="#290e08" stroke="#f59e0b" strokeWidth="2.5" />
              <circle cx="100" cy="100" r="10" fill="#d97706" />
              <circle cx="100" cy="100" r="4" fill="#fef08a" />
            </svg>
          </div>
        </div>

        {/* Won Prize Banner */}
        {wonPrize && (
          <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-300 font-cinzel font-black text-sm animate-bounce shadow">
            🎉 Você ganhou +{wonPrize.amount.toLocaleString('pt-BR')} fichas!
          </div>
        )}

        {/* Countdown or Spin Button */}
        {canSpin ? (
          <button
            type="button"
            disabled={isSpinning}
            onClick={handleSpin}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:brightness-110 text-slate-950 font-cinzel font-black text-sm shadow-xl shadow-orange-500/30 transition-all cursor-pointer border border-yellow-200 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>{isSpinning ? 'Girando a Roleta...' : 'Girar Roleta Diária Grátis 🎡'}</span>
          </button>
        ) : (
          <div className="p-2.5 rounded-xl bg-[#140402] border border-orange-500/20 text-orange-200 space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-xs text-orange-300/80 font-semibold">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Próximo giro disponível em:</span>
            </div>
            <div className="font-mono text-base font-extrabold text-amber-400">
              {formatRemainingTime(remainingMs)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
