import React, { useEffect, useState, useRef } from 'react';
import { Card } from '../types/casino';
import { getSuitSymbol } from '../utils/cards';
import { soundManager } from '../utils/audio';

interface PlayingCardProps {
  card?: Card;
  hidden?: boolean;
  held?: boolean;
  onToggleHold?: () => void;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  tilt3d?: boolean;
  floating?: boolean;
  withDealerHand?: boolean;
  flipDelayMs?: number;
  skipInitialFlip?: boolean;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  hidden = false,
  held = false,
  onToggleHold,
  className = '',
  size = 'md',
  tilt3d = true,
  floating = true,
  withDealerHand = false,
  flipDelayMs = 0,
  skipInitialFlip = false
}) => {
  const sizeClasses = {
    xs: 'w-12 h-17 sm:w-13 sm:h-18 text-[11px]',
    sm: 'w-14 h-20 sm:w-15 sm:h-22 text-xs',
    md: 'w-20 h-28 sm:w-24 sm:h-34 text-sm sm:text-base',
    lg: 'w-26 h-38 sm:w-30 sm:h-46 text-base sm:text-lg'
  }[size];

  const cardKey = card?.id || (card ? `${card.suit}-${card.value}` : 'empty');
  const [isFlipped, setIsFlipped] = useState<boolean>(() => !hidden && Boolean(card) && skipInitialFlip);
  const flippedKeyRef = useRef<string | null>(!hidden && card && skipInitialFlip ? cardKey : null);

  useEffect(() => {
    if (hidden || !card) {
      setIsFlipped(false);
      flippedKeyRef.current = null;
      return;
    }

    if (flippedKeyRef.current === cardKey) {
      setIsFlipped(true);
      return;
    }

    if (skipInitialFlip) {
      flippedKeyRef.current = cardKey;
      setIsFlipped(true);
      return;
    }

    // Start face-down (rotateY 0deg) and flip smoothly to 180deg after flipDelayMs
    setIsFlipped(false);
    const delay = Math.max(40, flipDelayMs + 40);
    const timer = window.setTimeout(() => {
      flippedKeyRef.current = cardKey;
      setIsFlipped(true);
      soundManager.playCardDeal();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [hidden, card, cardKey, flipDelayMs, skipInitialFlip]);

  const perspectiveContainerStyle: React.CSSProperties = {
    perspective: '1200px',
    display: 'inline-block',
    position: 'relative'
  };

  const innerTransform = isFlipped
    ? held
      ? 'rotateY(180deg) translateY(-10px) scale(1.06) translateZ(18px)'
      : tilt3d
      ? 'rotateY(180deg) rotateX(2deg) translateZ(6px)'
      : 'rotateY(180deg)'
    : 'rotateY(0deg)';

  const innerFlipStyle: React.CSSProperties = {
    transformStyle: 'preserve-3d',
    transition: 'transform 0.52s cubic-bezier(0.22, 1, 0.36, 1)',
    transform: innerTransform
  };

  const floatClass = floating && !held && isFlipped ? 'card-float-3d' : '';
  const isRed = card ? card.suit === 'hearts' || card.suit === 'diamonds' : false;
  const suitSymbol = card ? getSuitSymbol(card.suit) : '♠';

  return (
    <div style={perspectiveContainerStyle} className={`select-none ${floatClass}`}>
      <div
        onClick={!hidden && card && onToggleHold ? onToggleHold : undefined}
        style={innerFlipStyle}
        className={`relative ${sizeClasses} rounded-xl ${
          !hidden && card && onToggleHold ? 'cursor-pointer' : 'cursor-default'
        } ${className}`}
      >
        {/* Held label overlay for Video Poker */}
        {held && isFlipped && (
          <div
            style={{ transform: 'translateX(-50%) rotateY(180deg) translateZ(16px)' }}
            className="absolute -top-3.5 left-1/2 bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded shadow-xl tracking-wider uppercase border-2 border-amber-200 z-30 pointer-events-none"
          >
            Manter
          </div>
        )}

        {/* BACK FACE (rotateY 0deg — visible when card is dealt face-down) */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(0deg)',
            boxShadow:
              '-3px 4px 0 #450a0a, -5px 7px 0 #2b0606, -8px 16px 26px rgba(0,0,0,0.8), inset 0 1px 0 rgba(251,191,36,0.5)'
          }}
          className="absolute inset-0 rounded-xl border-2 border-amber-500/70 bg-gradient-to-br from-[#3b0a06] via-[#220604] to-[#140202] flex items-center justify-center overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-amber-300/20 pointer-events-none" />
          <div className="absolute inset-1.5 border border-amber-400/50 rounded-lg flex items-center justify-center bg-[#1e0705]">
            <div className="w-full h-full opacity-40 bg-[radial-gradient(#f59e0b_1.5px,transparent_1.5px)] [background-size:6px_6px]" />
            <div className="absolute w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-amber-400 bg-gradient-to-br from-amber-600 via-red-700 to-amber-900 shadow-lg flex items-center justify-center text-amber-200 font-cinzel font-black text-xs">
              ♠
            </div>
          </div>
        </div>

        {/* FRONT FACE (rotateY 180deg — revealed when card flips) */}
        {card && (
          <div
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              boxShadow: held
                ? '0 0 0 3px #f59e0b, -4px 8px 0 #94a3b8, -10px 20px 28px rgba(0,0,0,0.75), inset 0 1px 0 #ffffff'
                : '-3px 4px 0 #cbd5e1, -5px 7px 0 #94a3b8, -8px 16px 28px rgba(0,0,0,0.6), inset 0 1px 0 #ffffff, inset 0 -2px 4px rgba(0,0,0,0.1)'
            }}
            className="absolute inset-0 rounded-xl bg-gradient-to-b from-white via-[#fcfbf9] to-[#f3f0e8] text-slate-900 border border-slate-300 flex flex-col justify-between p-1.5 sm:p-2 overflow-visible"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/60 to-transparent pointer-events-none rounded-xl" />

            {/* Top-left corner */}
            <div className={`flex flex-col items-center leading-none z-10 self-start ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
              <span className="font-black font-sans tracking-tight drop-shadow-sm">{card.label}</span>
              <span className="text-[10px] sm:text-xs leading-none mt-0.5">{suitSymbol}</span>
            </div>

            {/* Center artwork */}
            <div className={`self-center flex flex-col items-center z-10 ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
              <span className="text-xl sm:text-2xl filter drop-shadow-[0_2px_3px_rgba(0,0,0,0.28)] select-none">
                {suitSymbol}
              </span>
              {card.value >= 11 && size !== 'xs' && (
                <span className="text-[9px] sm:text-[10px] font-cinzel font-black tracking-wider opacity-90 mt-0.5 uppercase">
                  {card.label === 'J' ? 'Valete' : card.label === 'Q' ? 'Dama' : 'Rei'}
                </span>
              )}
            </div>

            {/* Bottom-right corner */}
            <div className={`flex flex-col items-center leading-none rotate-180 z-10 self-end ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
              <span className="font-black font-sans tracking-tight drop-shadow-sm">{card.label}</span>
              <span className="text-[10px] sm:text-xs leading-none mt-0.5">{suitSymbol}</span>
            </div>

            {/* White Dealer Glove Holding the Card Corner */}
            {withDealerHand && (
              <div className="absolute -bottom-5 -right-5 sm:-bottom-6 sm:-right-6 w-12 sm:w-16 h-12 sm:h-16 pointer-events-none z-30 filter drop-shadow-[0_8px_12px_rgba(0,0,0,0.65)]">
                <svg viewBox="0 0 80 80" className="w-full h-full">
                  <path d="M 46,55 L 78,68 L 68,78 L 38,64 Z" fill="#0c0302" stroke="#451208" strokeWidth="1.5" />
                  <circle cx="56" cy="65" r="2.2" fill="#fbbf24" stroke="#fef08a" strokeWidth="0.8" />
                  <circle cx="62" cy="67.5" r="2.2" fill="#fbbf24" stroke="#fef08a" strokeWidth="0.8" />
                  <path d="M 34,52 Q 44,58 54,48 L 50,42 Q 40,48 32,44 Z" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
                  <path d="M 26,34 C 29,26 38,22 44,28 C 49,32 50,42 47,48 C 42,52 33,54 26,48 C 22,44 22,38 26,34 Z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.2" />
                  <path d="M 14,28 C 17,21 26,22 28,28 C 30,34 26,39 20,38 C 16,37 13,32 14,28 Z" fill="#ffffff" stroke="#64748b" strokeWidth="1.4" />
                  <path d="M 18,25 Q 22,28 24,27" stroke="#94a3b8" strokeWidth="0.9" fill="none" />
                  <path d="M 32,32 Q 38,36 41,34" stroke="#cbd5e1" strokeWidth="0.9" fill="none" />
                </svg>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
