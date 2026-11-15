import React, { useState, useEffect, useRef } from 'react';
import { soundManager } from '../utils/audio';
import { fireConfetti } from '../utils/confetti';
import { reportRoundLoss } from '../utils/luckyStreak';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { ChipSelector } from '../components/ChipSelector';
import { incrementMissionCounter } from '../utils/missions';
import {
  ArrowLeft,
  HelpCircle,
  Trophy,
  Flame,
  RotateCcw,
  Repeat,
  Square
} from 'lucide-react';

interface MinerGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'miner', betAmount?: number) => void;
  onBackToLobby: () => void;
  username?: string;
}

const BOMB_OPTIONS = [
  { count: 1, label: '1 Bomba (Fácil)' },
  { count: 3, label: '3 Bombas (Normal)' },
  { count: 5, label: '5 Bombas (Difícil)' },
  { count: 10, label: '10 Bombas (Extremo)' },
  { count: 24, label: '24 Bombas (Lendário 24x)' }
];

const AUTO_ROUNDS_OPTIONS = [5, 10, 25, 50];
const AUTO_PICKS_OPTIONS = [1, 2, 3, 5];

// Vector SVG Emerald Diamond Gem
const EmeraldGemIcon: React.FC<{ isDimmed?: boolean; sizeClass?: string }> = ({ isDimmed, sizeClass }) => (
  <svg
    viewBox="0 0 48 48"
    className={`${sizeClass || 'w-[68%] h-[68%]'} transition-all ${
      isDimmed ? 'opacity-40' : 'drop-shadow-[0_0_12px_rgba(16,185,129,0.9)] animate-scale-in'
    }`}
  >
    <defs>
      <linearGradient id="emeraldGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#6ee7b7" />
        <stop offset="35%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <linearGradient id="topFacetGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a7f3d0" />
        <stop offset="100%" stopColor="#34d399" />
      </linearGradient>
    </defs>
    <polygon points="14,13 34,13 42,21 6,21" fill="url(#topFacetGrad)" stroke="#064e3b" strokeWidth="1.2" />
    <polygon points="18,13 30,13 34,21 14,21" fill="#a7f3d0" opacity="0.8" />
    <polygon points="6,21 24,41 16,21" fill="#059669" stroke="#064e3b" strokeWidth="1.2" />
    <polygon points="16,21 24,41 32,21" fill="url(#emeraldGrad)" stroke="#064e3b" strokeWidth="1.2" />
    <polygon points="32,21 24,41 42,21" fill="#047857" stroke="#064e3b" strokeWidth="1.2" />
    <line x1="19" y1="15" x2="29" y2="15" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="24" cy="22" r="2.5" fill="#fff" opacity="0.6" />
  </svg>
);

// Vector SVG Dark Red Spherical Bomb
const DarkRedBombIcon: React.FC<{ isExploded?: boolean; isDimmed?: boolean; sizeClass?: string }> = ({
  isExploded,
  isDimmed,
  sizeClass
}) => (
  <svg
    viewBox="0 0 48 48"
    className={`${sizeClass || 'w-[68%] h-[68%]'} transition-all ${
      isExploded
        ? 'drop-shadow-[0_0_20px_#ef4444] animate-bounce scale-110'
        : isDimmed
        ? 'opacity-50'
        : 'drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]'
    }`}
  >
    <defs>
      <radialGradient id="bombRedSphereGrad" cx="38%" cy="36%" r="62%">
        <stop offset="0%" stopColor="#f87171" />
        <stop offset="25%" stopColor="#dc2626" />
        <stop offset="65%" stopColor="#7f1d1d" />
        <stop offset="100%" stopColor="#2a0606" />
      </radialGradient>
      <radialGradient id="bombCenterLightGrad" cx="40%" cy="38%" r="28%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
        <stop offset="45%" stopColor="#fca5a5" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x="22" y="7" width="4" height="4" rx="1" fill="#78350f" stroke="#451a03" strokeWidth="0.8" />
    <path d="M24,7 Q27,2 31,4" stroke="#f59e0b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    <circle cx="31" cy="4" r="1.6" fill="#fef08a" />
    <circle cx="24" cy="26" r="15.5" fill="url(#bombRedSphereGrad)" stroke="#1a0404" strokeWidth="1.4" />
    <circle cx="21" cy="22" r="6.5" fill="url(#bombCenterLightGrad)" />
    <ellipse cx="19" cy="18" rx="2.8" ry="1.6" fill="#fff" opacity="0.6" transform="rotate(-30, 19, 18)" />
  </svg>
);

export const MinerGame: React.FC<MinerGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby,
  username
}) => {
  const [bet, setBet] = useState<number>(100);
  const [bombCount, setBombCount] = useState<number>(3);
  const [status, setStatus] = useState<'IDLE' | 'PLAYING' | 'CASHED_OUT' | 'EXPLODED'>('IDLE');
  const [bombs, setBombs] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.0);
  const [explodedIndex, setExplodedIndex] = useState<number | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  // Auto-Play Feature State
  const [isAutoPlayActive, setIsAutoPlayActive] = useState<boolean>(false);
  const [autoRoundsRemaining, setAutoRoundsRemaining] = useState<number>(0);
  const [autoPicksPerRound, setAutoPicksPerRound] = useState<number>(3);
  const [showAutoModal, setShowAutoModal] = useState<boolean>(false);

  const isAutoPlayRef = useRef<boolean>(false);
  const autoRoundsRef = useRef<number>(0);
  const autoPicksRef = useRef<number>(3);
  const betRef = useRef<number>(bet);
  const balanceRef = useRef<number>(balance);
  const bombCountRef = useRef<number>(bombCount);
  const autoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    betRef.current = bet;
  }, [bet]);

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  useEffect(() => {
    bombCountRef.current = bombCount;
  }, [bombCount]);

  useEffect(() => {
    autoPicksRef.current = autoPicksPerRound;
  }, [autoPicksPerRound]);

  const totalTiles = 25;
  const diamondCount = totalTiles - bombCount;

  // Calculate Stake Mines fair multiplier curve
  const getMultiplierForReveals = (k: number, numBombs: number): number => {
    if (k === 0) return 1.0;
    let mult = 1.0;
    let remTiles = 25;
    let remGems = 25 - numBombs;
    for (let i = 0; i < k; i++) {
      const prob = remGems / remTiles;
      mult *= (1 / prob) * 0.985;
      remTiles--;
      remGems--;
    }
    return Math.max(1.05, Number(mult.toFixed(2)));
  };

  const payoutAmount = Math.floor(bet * currentMultiplier);

  const stopAutoPlay = () => {
    isAutoPlayRef.current = false;
    autoRoundsRef.current = 0;
    setIsAutoPlayActive(false);
    setAutoRoundsRemaining(0);
    if (autoTimeoutRef.current) {
      clearTimeout(autoTimeoutRef.current);
      autoTimeoutRef.current = null;
    }
  };

  const startAutoPlay = (rounds: number) => {
    if (bet > balance || bet <= 0) return;
    setShowAutoModal(false);
    isAutoPlayRef.current = true;
    autoRoundsRef.current = rounds;
    setIsAutoPlayActive(true);
    setAutoRoundsRemaining(rounds);
    executeAutoRound();
  };

  // Execute a single automated round in Miner
  const executeAutoRound = () => {
    const curBet = betRef.current;
    if (curBet <= 0 || curBet > balanceRef.current) {
      stopAutoPlay();
      return;
    }

    soundManager.playChip();
    onUpdateBalance(-curBet, false, 'miner', curBet);
    if (username) {
      incrementMissionCounter(username, 'total_rounds', 1);
    }

    // Generate bombs
    const numBombs = bombCountRef.current;
    const newBombs = new Set<number>();
    while (newBombs.size < numBombs) {
      newBombs.add(Math.floor(Math.random() * totalTiles));
    }

    setBombs(newBombs);
    setExplodedIndex(null);
    setCurrentMultiplier(1.0);
    setStatus('PLAYING');

    // Pick target indices randomly
    const targetPicksCount = Math.min(autoPicksRef.current, totalTiles - numBombs);
    const chosenIndices: number[] = [];
    const pool = Array.from({ length: totalTiles }, (_, i) => i);
    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let i = 0; i < targetPicksCount; i++) {
      chosenIndices.push(pool[i]);
    }

    // Step-by-step reveal
    let step = 0;
    const currentRevealed = new Set<number>();

    const revealStep = () => {
      if (!isAutoPlayRef.current) return;

      if (step < chosenIndices.length) {
        const idx = chosenIndices[step];
        if (newBombs.has(idx)) {
          // Exploded in auto round
          setExplodedIndex(idx);
          setStatus('EXPLODED');
          soundManager.playExplosion();
          soundManager.playLoss();
          reportRoundLoss('miner');

          // Decrement remaining
          autoRoundsRef.current = Math.max(0, autoRoundsRef.current - 1);
          setAutoRoundsRemaining(autoRoundsRef.current);

          if (autoRoundsRef.current > 0 && isAutoPlayRef.current) {
            autoTimeoutRef.current = setTimeout(executeAutoRound, 900);
          } else {
            stopAutoPlay();
          }
          return;
        }

        // Gem found!
        currentRevealed.add(idx);
        setRevealed(new Set(currentRevealed));
        soundManager.playCoinTally(1200 + currentRevealed.size * 80);

        if (username) {
          incrementMissionCounter(username, 'mines_revealed', 1);
        }

        const newMult = getMultiplierForReveals(currentRevealed.size, numBombs);
        setCurrentMultiplier(newMult);

        step++;
        autoTimeoutRef.current = setTimeout(revealStep, 180);
      } else {
        // All target picks safe: cash out!
        const finalMult = getMultiplierForReveals(currentRevealed.size, numBombs);
        const winAmount = Math.floor(curBet * finalMult);
        setStatus('CASHED_OUT');
        soundManager.playWin();
        fireConfetti(1200);
        onUpdateBalance(winAmount, true, 'miner', curBet);

        autoRoundsRef.current = Math.max(0, autoRoundsRef.current - 1);
        setAutoRoundsRemaining(autoRoundsRef.current);

        if (autoRoundsRef.current > 0 && isAutoPlayRef.current) {
          autoTimeoutRef.current = setTimeout(executeAutoRound, 950);
        } else {
          stopAutoPlay();
        }
      }
    };

    autoTimeoutRef.current = setTimeout(revealStep, 200);
  };

  // Start new manual round ("Jogar Mines")
  const startGame = () => {
    if (bet <= 0 || bet > balance) return;
    soundManager.playChip();
    onUpdateBalance(-bet, false, 'miner', bet);
    if (username) {
      incrementMissionCounter(username, 'total_rounds', 1);
    }

    const newBombs = new Set<number>();
    while (newBombs.size < bombCount) {
      newBombs.add(Math.floor(Math.random() * totalTiles));
    }

    setBombs(newBombs);
    setRevealed(new Set());
    setExplodedIndex(null);
    setCurrentMultiplier(1.0);
    setStatus('PLAYING');
  };

  // Click a tile manually
  const handleTileClick = (index: number) => {
    if (status !== 'PLAYING' || revealed.has(index) || isAutoPlayActive) return;

    if (bombs.has(index)) {
      setExplodedIndex(index);
      setStatus('EXPLODED');
      soundManager.playExplosion();
      soundManager.playLoss();
      reportRoundLoss('miner');
      return;
    }

    soundManager.playCoinTally(1200 + revealed.size * 80);
    const nextRevealed = new Set(revealed);
    nextRevealed.add(index);
    setRevealed(nextRevealed);

    if (username) {
      incrementMissionCounter(username, 'mines_revealed', 1);
    }

    const newMult = getMultiplierForReveals(nextRevealed.size, bombCount);
    setCurrentMultiplier(newMult);

    if (nextRevealed.size === diamondCount) {
      cashOut(newMult);
    }
  };

  // Cash out
  const cashOut = (overrideMult?: number) => {
    if (status !== 'PLAYING') return;
    const finalMult = overrideMult || currentMultiplier;
    const winAmount = Math.floor(bet * finalMult);

    setStatus('CASHED_OUT');
    soundManager.playWin();
    fireConfetti();
    onUpdateBalance(winAmount, true, 'miner', bet);
  };

  return (
    <div className="h-full max-h-full w-full max-w-4xl mx-auto flex flex-col justify-between gap-1 overflow-hidden animate-fade-in text-orange-100 p-1 sm:p-1.5 select-none">
      {/* Top Header Bar */}
      <div className="shrink-0 flex items-center justify-between px-2 py-0.5">
        <button
          onClick={() => {
            stopAutoPlay();
            onBackToLobby();
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Lobby</span>
        </button>

        <div className="text-center">
          <span className="font-cinzel text-xs sm:text-sm font-black text-amber-300">
            MINER SAPECA
          </span>
          <span className="text-[10px] text-orange-400/80 font-bold uppercase tracking-wider block">
            {bombCount} Bombas · {diamondCount} Diamantes Seguros
          </span>
        </div>

        <button
          onClick={() => setShowHowToPlay(true)}
          className="flex items-center gap-1 text-xs text-orange-300/80 hover:text-white transition-colors cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
          <span>Regras</span>
        </button>
      </div>

      {/* Main 5x5 Minefield Arena Box */}
      <div className="relative rounded-2xl border-2 border-orange-500/40 bg-gradient-to-b from-[#1b0805] via-[#100302] to-[#0a0201] flex-1 min-h-0 flex flex-col items-center justify-between gap-1.5 p-1.5 sm:p-2 shadow-[0_0_35px_rgba(234,88,12,0.25)] overflow-hidden">
        {/* Top Multiplier Progress & Status Bar (Fixed Height, Never Overlapped) */}
        <div className="shrink-0 w-full flex items-center justify-between px-2.5 py-1 bg-[#240a06]/90 rounded-xl border border-orange-500/30">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-orange-400 font-bold uppercase">Multiplicador:</span>
            <span className="font-mono text-sm sm:text-base font-black text-amber-300">
              {currentMultiplier.toFixed(2)}x
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-orange-400 font-bold uppercase">Gemas:</span>
            <span className="font-mono text-xs font-bold text-emerald-400">
              {revealed.size} / {diamondCount}
            </span>
          </div>

          {status === 'PLAYING' && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/40">
              <span>Prêmio Atual:</span>
              <span className="font-mono font-black">{payoutAmount.toLocaleString('pt-BR')} 🪙</span>
            </div>
          )}
        </div>

        {/* 5x5 Grid Wrapper (flex-grow: 1, constrained by available height & width via container query) */}
        <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden [container-type:size]">
          <div className="grid grid-cols-5 grid-rows-5 gap-1 sm:gap-1.5 aspect-square max-h-full max-w-full w-[min(100cqw,100cqh,22rem)] h-[min(100cqw,100cqh,22rem)] p-1.5 rounded-2xl bg-[#0e0403] border border-orange-500/30">
            {Array.from({ length: totalTiles }).map((_, i) => {
              const isRevealed = revealed.has(i);
              const isBomb = bombs.has(i);
              const isExplodedHere = explodedIndex === i;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleTileClick(i)}
                  disabled={status !== 'PLAYING' || isRevealed || isAutoPlayActive}
                  className={`relative w-full h-full min-w-0 min-h-0 aspect-square rounded-lg sm:rounded-xl border-2 flex items-center justify-center transition-all duration-200 select-none ${
                    isRevealed
                      ? 'bg-gradient-to-br from-emerald-950 via-teal-900 to-[#042f2e] border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                      : status === 'EXPLODED' && isBomb
                      ? isExplodedHere
                        ? 'bg-red-950 border-red-500 ring-4 ring-red-500 animate-pulse'
                        : 'bg-[#290806] border-red-800'
                      : status === 'PLAYING'
                      ? 'bg-gradient-to-br from-[#2f100a] via-[#1d0704] to-[#120302] border-orange-500/50 hover:border-amber-400 hover:scale-102 hover:shadow-[0_0_12px_rgba(245,158,11,0.4)] active:scale-98 cursor-pointer'
                      : 'bg-[#180705] border-orange-500/20 opacity-70 cursor-not-allowed'
                  }`}
                >
                  {isRevealed && <EmeraldGemIcon />}
                  {status === 'EXPLODED' && isBomb && !isRevealed && (
                    <DarkRedBombIcon isExploded={isExplodedHere} isDimmed={!isExplodedHere} />
                  )}
                  {status === 'CASHED_OUT' && isBomb && (
                    <DarkRedBombIcon isDimmed />
                  )}
                  {!isRevealed && status === 'PLAYING' && (
                    <div className="w-2 h-2 rounded-full bg-orange-500/30 group-hover:bg-amber-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Big Victory Overlay (Cashed Out) */}
        {status === 'CASHED_OUT' && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 max-w-xs mx-auto p-3.5 rounded-2xl bg-[#0a2318]/95 border-2 border-emerald-400 text-center shadow-2xl z-20 animate-scale-in">
            <Trophy className="w-8 h-8 text-amber-300 mx-auto mb-1 animate-bounce" />
            <h3 className="font-cinzel text-base font-black text-emerald-300">LUCRO RESGATADO!</h3>
            <p className="text-xs text-amber-200 mt-0.5">
              Multiplicador: <span className="font-bold">{currentMultiplier.toFixed(2)}x</span>
            </p>
            <p className="font-mono text-lg font-black text-yellow-300 mt-1">
              +{payoutAmount.toLocaleString('pt-BR')} 🪙
            </p>
            {!isAutoPlayActive && (
              <button
                onClick={startGame}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 text-white font-cinzel font-black text-xs uppercase shadow-xl hover:brightness-110 active:scale-98 cursor-pointer border border-emerald-300 mt-2"
              >
                JOGAR NOVAMENTE 💎
              </button>
            )}
          </div>
        )}

        {/* Defeat Banner (Exploded) */}
        {status === 'EXPLODED' && !isAutoPlayActive && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 max-w-xs mx-auto p-3.5 rounded-2xl bg-[#1f0907]/95 border-2 border-red-500 text-center shadow-2xl z-20 animate-scale-in">
            <div className="w-8 h-8 mx-auto mb-1 flex items-center justify-center">
              <DarkRedBombIcon isExploded />
            </div>
            <h3 className="font-cinzel text-base font-black text-white">BOMBA DETONADA!</h3>
            <p className="text-[11px] text-red-200 mt-0.5">
              Você atingiu uma mina e perdeu {bet} fichas.
            </p>
            <button
              onClick={startGame}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 text-white font-cinzel font-black text-xs uppercase shadow-xl hover:brightness-110 active:scale-98 cursor-pointer border border-orange-300/40 mt-2"
            >
              TENTAR DE NOVO 💣
            </button>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="shrink-0 bg-[#0b1220] border-2 border-orange-500/30 p-1.5 sm:p-2 rounded-2xl space-y-1 shadow-xl">
        {/* Bomb Count Selector */}
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] uppercase font-bold text-orange-400 shrink-0">Bombas:</span>
          <div className="flex items-center gap-1 sm:gap-1.5 flex-1 overflow-x-auto">
            {BOMB_OPTIONS.map((opt) => (
              <button
                key={opt.count}
                type="button"
                disabled={status === 'PLAYING' || isAutoPlayActive}
                onClick={() => setBombCount(opt.count)}
                className={`flex-1 py-1 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  bombCount === opt.count
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white border border-yellow-300 shadow-md font-black'
                    : 'bg-[#162136] text-orange-200 hover:bg-[#202f4d] border border-orange-500/25'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chips and Main Action Button */}
        <div className="flex flex-col gap-1.5 pt-0.5 border-t border-orange-500/20">
          <ChipSelector
            currentBet={bet}
            balance={balance}
            onBetChange={setBet}
            disabled={status === 'PLAYING' || isAutoPlayActive}
            label="Aposta Atual:"
          />

          {/* Action Buttons: Auto-Play & Play / Cash Out */}
          <div className="w-full flex items-center gap-2">
            {isAutoPlayActive ? (
              <button
                type="button"
                onClick={stopAutoPlay}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-700 to-rose-600 hover:brightness-110 text-white font-cinzel font-black text-xs uppercase shadow-lg shadow-red-700/50 flex items-center justify-center gap-1.5 cursor-pointer border border-red-400 active:scale-95 animate-pulse"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>PARAR AUTO ({autoRoundsRemaining} RESTANTES)</span>
              </button>
            ) : status === 'PLAYING' ? (
              <button
                type="button"
                onClick={() => cashOut()}
                disabled={revealed.size === 0}
                className={`w-full py-2.5 sm:py-3 px-6 rounded-2xl font-cinzel font-black text-xs sm:text-sm uppercase tracking-wider shadow-2xl active:scale-98 cursor-pointer border-2 flex items-center justify-center gap-2 ${
                  revealed.size > 0
                    ? 'bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 hover:brightness-110 text-white border-emerald-300 shadow-emerald-950/80 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed opacity-60'
                }`}
              >
                <EmeraldGemIcon sizeClass="w-5 h-5" />
                <span>
                  {revealed.size > 0
                    ? `RETIRAR 🪙 ${payoutAmount.toLocaleString('pt-BR')} (${currentMultiplier.toFixed(2)}x)`
                    : 'REVELE UM DIAMANTE NA MINA'}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 w-full">
                {/* Auto-Play settings button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAutoModal((prev) => !prev)}
                    className="py-2.5 px-3.5 rounded-xl bg-[#1c2942] hover:bg-[#253757] text-cyan-300 font-cinzel font-black text-xs uppercase border border-cyan-500/40 flex items-center gap-1 cursor-pointer transition-all"
                    title="Configurar Modo Automático de Minas"
                  >
                    <Repeat className="w-3.5 h-3.5 text-cyan-400" />
                    <span>AUTO</span>
                  </button>

                  {/* Auto-Play Popover */}
                  {showAutoModal && (
                    <div className="absolute bottom-full left-0 mb-1.5 p-2.5 bg-[#0b1322] border-2 border-cyan-500/60 rounded-xl shadow-2xl flex flex-col gap-2 z-40 min-w-[210px]">
                      <span className="text-[10px] uppercase font-bold text-cyan-300 text-center">
                        Auto-Play Miner Sapeca
                      </span>
                      {/* Gem count to uncover per round */}
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block mb-1">
                          Gemas p/ Rodada:
                        </span>
                        <div className="grid grid-cols-4 gap-1">
                          {AUTO_PICKS_OPTIONS.map((picks) => (
                            <button
                              key={picks}
                              onClick={() => setAutoPicksPerRound(picks)}
                              className={`py-1 rounded text-xs font-mono font-bold border transition-colors ${
                                autoPicksPerRound === picks
                                  ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black'
                                  : 'bg-[#152238] text-slate-300 border-cyan-500/20'
                              }`}
                            >
                              {picks}💎
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Number of auto rounds */}
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block mb-1">
                          Rodadas Automáticas:
                        </span>
                        <div className="grid grid-cols-2 gap-1">
                          {AUTO_ROUNDS_OPTIONS.map((rounds) => (
                            <button
                              key={rounds}
                              onClick={() => startAutoPlay(rounds)}
                              className="py-1 px-2 rounded-lg bg-[#1a2b47] hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 text-xs font-mono font-bold border border-cyan-500/30 transition-colors"
                            >
                              {rounds} Rodadas
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Normal Play Button */}
                <button
                  type="button"
                  onClick={startGame}
                  disabled={bet <= 0 || bet > balance}
                  className="flex-1 py-2.5 sm:py-3 px-6 rounded-2xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs sm:text-sm uppercase tracking-wider shadow-2xl shadow-orange-600/50 active:scale-98 cursor-pointer border-2 border-orange-300/50 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Flame className="w-4 h-4 text-amber-200" />
                  <span>JOGAR MINER SAPECA ({bet.toLocaleString('pt-BR')} FICHAS) 💣</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Como Jogar Miner Sapeca */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="inline-flex items-center gap-1 text-[11px] text-orange-300/70 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
            <span>Como Jogar Miner Sapeca</span>
          </button>
        </div>
      </div>

      {/* Rules Modal */}
      {showHowToPlay && (
        <HowToPlayModal
          isOpen={showHowToPlay}
          onClose={() => setShowHowToPlay(false)}
          gameId="miner"
        />
      )}
    </div>
  );
};
