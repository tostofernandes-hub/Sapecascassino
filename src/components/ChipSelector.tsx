import React, { useState, useRef, useEffect } from 'react';
import { soundManager } from '../utils/audio';

interface ChipSelectorProps {
  currentBet: number;
  balance: number;
  onBetChange: (newBet: number) => void;
  disabled?: boolean;
  minBet?: number;
  compact?: boolean;
  label?: string;
  chips?: number[];
  multiplierCount?: number;
  showInput?: boolean;
  showDouble?: boolean;
  showAllIn?: boolean;
  theme?: 'casino' | 'cyan';
}

const DEFAULT_CHIPS = [
  { value: 10, bg: 'from-amber-600 to-amber-800', border: 'border-amber-400', text: '10' },
  { value: 25, bg: 'from-orange-600 to-orange-800', border: 'border-orange-400', text: '25' },
  { value: 50, bg: 'from-red-600 to-red-800', border: 'border-red-400', text: '50' },
  { value: 100, bg: 'from-[#431407] to-[#1f0804]', border: 'border-orange-400 ring-1 ring-orange-300', text: '100' },
  { value: 500, bg: 'from-rose-700 to-red-950', border: 'border-amber-400', text: '500' }
];

const EXTRA_STYLE: Record<number, { bg: string; border: string }> = {
  10: { bg: 'from-amber-600 to-amber-800', border: 'border-amber-400' },
  25: { bg: 'from-orange-600 to-orange-800', border: 'border-orange-400' },
  50: { bg: 'from-red-600 to-red-800', border: 'border-red-400' },
  100: { bg: 'from-[#431407] to-[#1f0804]', border: 'border-orange-400 ring-1 ring-orange-300' },
  250: { bg: 'from-purple-700 to-indigo-950', border: 'border-amber-300' },
  500: { bg: 'from-rose-700 to-red-950', border: 'border-amber-400' },
  1000: { bg: 'from-yellow-600 to-amber-900', border: 'border-yellow-300' }
};

export const ChipSelector: React.FC<ChipSelectorProps> = ({
  currentBet,
  balance,
  onBetChange,
  disabled = false,
  compact = true,
  label = 'Aposta Atual:',
  chips,
  multiplierCount = 1,
  showInput = false,
  showDouble = true,
  showAllIn = true,
  theme = 'casino'
}) => {
  const [pressedChip, setPressedChip] = useState<number | null>(null);
  const [pressKey, setPressKey] = useState<number>(0);
  const [warning, setWarning] = useState<string | null>(null);
  const warnTimerRef = useRef<number | null>(null);

  const safeMult = Math.max(1, multiplierCount);
  const maxAllowedBet = Math.max(0, Math.floor(balance / safeMult));

  useEffect(() => {
    return () => {
      if (warnTimerRef.current) window.clearTimeout(warnTimerRef.current);
    };
  }, []);

  const triggerWarning = (msg: string) => {
    setWarning(msg);
    soundManager.playLoss();
    if (warnTimerRef.current) window.clearTimeout(warnTimerRef.current);
    warnTimerRef.current = window.setTimeout(() => setWarning(null), 2600);
  };

  const triggerChipAnim = (val: number) => {
    setPressedChip(val);
    setPressKey((k) => k + 1);
  };

  const handleAddChip = (val: number) => {
    if (disabled) return;
    triggerChipAnim(val);
    const next = currentBet + val;
    if (next * safeMult > balance) {
      triggerWarning(`Saldo insuficiente! Máximo disponível: ${maxAllowedBet.toLocaleString('pt-BR')} fichas.`);
      return;
    }
    setWarning(null);
    soundManager.playChip();
    onBetChange(next);
  };

  const handleClear = () => {
    if (disabled || currentBet === 0) return;
    setWarning(null);
    soundManager.playClick();
    onBetChange(0);
  };

  const handleAllIn = () => {
    if (disabled) return;
    if (maxAllowedBet <= 0) {
      triggerWarning('Saldo insuficiente para apostar!');
      return;
    }
    setWarning(null);
    soundManager.playChip();
    onBetChange(maxAllowedBet);
  };

  const handleDouble = () => {
    if (disabled || currentBet <= 0) return;
    const next = currentBet * 2;
    if (next * safeMult > balance) {
      triggerWarning(`Saldo insuficiente para dobrar! Máximo: ${maxAllowedBet.toLocaleString('pt-BR')} fichas.`);
      return;
    }
    setWarning(null);
    soundManager.playChip();
    onBetChange(next);
  };

  const handleManualInput = (raw: string) => {
    if (disabled) return;
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
      setWarning(null);
      onBetChange(0);
      return;
    }
    const parsed = parseInt(cleaned, 10);
    if (isNaN(parsed)) return;
    if (parsed * safeMult > balance) {
      triggerWarning(`Valor acima do saldo (${balance.toLocaleString('pt-BR')} fichas)!`);
      onBetChange(maxAllowedBet);
      return;
    }
    setWarning(null);
    onBetChange(parsed);
  };

  const chipList = chips
    ? chips.map((v) => ({
        value: v,
        bg: EXTRA_STYLE[v]?.bg || 'from-amber-600 to-amber-900',
        border: EXTRA_STYLE[v]?.border || 'border-amber-400',
        text: String(v)
      }))
    : DEFAULT_CHIPS;

  const containerBorder =
    theme === 'cyan'
      ? 'bg-[#0b1322] border border-cyan-500/35'
      : 'bg-[#1b0805] border border-orange-500/30';

  return (
    <div className="space-y-1">
      <div
        className={`flex flex-wrap items-center justify-between gap-1.5 ${containerBorder} rounded-xl shadow-md ${
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2 rounded-2xl'
        }`}
      >
        {/* Current Bet Display */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-orange-300/90">
            {label}
          </span>
          {showInput ? (
            <div className="flex items-center gap-1 bg-[#120403] rounded-lg border border-orange-500/50 px-1.5 py-0.5">
              <span className="text-amber-400 text-xs">🪙</span>
              <input
                type="text"
                inputMode="numeric"
                disabled={disabled}
                value={currentBet}
                onChange={(e) => handleManualInput(e.target.value)}
                className="w-20 bg-transparent font-mono text-xs sm:text-sm font-extrabold text-amber-300 tabular-nums focus:outline-none"
                aria-label="Valor da aposta"
              />
            </div>
          ) : (
            <div
              className={`flex items-center gap-1 bg-[#120403] rounded-lg border border-orange-500/50 ${
                compact ? 'px-2 py-0.5' : 'px-2.5 py-1'
              }`}
            >
              <span className="text-amber-400 text-xs">🪙</span>
              <span className="font-mono text-xs sm:text-sm font-extrabold text-amber-300 tabular-nums">
                {currentBet.toLocaleString('pt-BR')}
              </span>
              <span className="text-[9px] text-orange-400/80">fichas</span>
            </div>
          )}
        </div>

        {/* Additive Chips buttons */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {chipList.map((chip) => {
            const isPressed = pressedChip === chip.value;
            const exceedsBalance = (currentBet + chip.value) * safeMult > balance;
            return (
              <button
                key={isPressed ? `${chip.value}-${pressKey}` : chip.value}
                type="button"
                disabled={disabled}
                onClick={() => handleAddChip(chip.value)}
                className={`w-8 h-8 sm:w-9 sm:h-9 text-[10px] sm:text-[11px] rounded-full bg-gradient-to-b ${chip.bg} border-2 border-dashed ${chip.border} shadow-md flex items-center justify-center font-black text-white select-none transition-transform active:scale-90 ${
                  isPressed ? 'chip-press-anim' : ''
                } ${
                  disabled
                    ? 'opacity-35 cursor-not-allowed'
                    : exceedsBalance
                    ? 'opacity-60 hover:opacity-80 cursor-pointer'
                    : 'hover:-translate-y-0.5 cursor-pointer opacity-100 hover:shadow-orange-600/40'
                }`}
                title={`Adicionar +${chip.value} fichas`}
              >
                +{chip.text}
              </button>
            );
          })}
        </div>

        {/* Action shortcuts */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={disabled || currentBet === 0}
            onClick={handleClear}
            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#270e0a] text-orange-200 hover:bg-[#34130d] border border-orange-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Limpar
          </button>
          {showDouble && (
            <button
              type="button"
              disabled={disabled || currentBet === 0}
              onClick={handleDouble}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#270e0a] text-amber-300 hover:bg-[#34130d] border border-orange-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              2x
            </button>
          )}
          {showAllIn && (
            <button
              type="button"
              disabled={disabled || maxAllowedBet <= 0 || currentBet === maxAllowedBet}
              onClick={handleAllIn}
              className="px-2.5 py-1 text-xs font-black rounded-lg bg-gradient-to-r from-orange-600 to-red-600 text-white hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer shadow"
            >
              All-In
            </button>
          )}
        </div>
      </div>

      {warning && (
        <div className="px-2.5 py-1 rounded-lg bg-red-950/90 border border-red-500/60 text-red-200 text-[11px] font-bold text-center animate-fade-in">
          ⚠️ {warning}
        </div>
      )}
    </div>
  );
};
