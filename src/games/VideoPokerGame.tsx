import React, { useState, useRef, useEffect } from 'react';
import { Card, PokerHandResult } from '../types/casino';
import { createDeck, shuffleDeck, evaluateVideoPokerHand, POKER_PAYTABLE } from '../utils/cards';
import { soundManager } from '../utils/audio';
import { reportRoundLoss } from '../utils/luckyStreak';
import { PlayingCard } from '../components/PlayingCard';
import { ChipSelector } from '../components/ChipSelector';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { CardVictoryModal } from '../components/CardVictoryModal';
import { ArrowLeft, Play, RefreshCw, Trophy, HelpCircle } from 'lucide-react';

interface VideoPokerGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'video-poker', betAmount?: number) => void;
  onBackToLobby: () => void;
}

type PokerPhase = 'BETTING' | 'DRAW_HOLD' | 'ROUND_OVER';

export const VideoPokerGame: React.FC<VideoPokerGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby
}) => {
  const [bet, setBet] = useState<number>(25);
  const [phase, setPhase] = useState<PokerPhase>('BETTING');
  const [deck, setDeck] = useState<Card[]>([]);
  const [hand, setHand] = useState<Card[]>([]);
  const [heldIndices, setHeldIndices] = useState<boolean[]>([false, false, false, false, false]);
  const [result, setResult] = useState<PokerHandResult | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [flipDelays, setFlipDelays] = useState<number[]>([0, 300, 600, 900, 1200]);
  const [victoryModal, setVictoryModal] = useState<{ winAmount: number; detail: string } | null>(null);
  const victoryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (victoryTimerRef.current) window.clearTimeout(victoryTimerRef.current);
    };
  }, []);

  // Step 1: Deal initial 5 cards
  const handleDeal = () => {
    if (bet <= 0 || bet > balance) return;

    if (victoryTimerRef.current) window.clearTimeout(victoryTimerRef.current);
    setVictoryModal(null);
    soundManager.playShuffle();
    onUpdateBalance(-bet, false, 'video-poker');

    const newDeck = shuffleDeck(createDeck());
    const initialHand = [
      newDeck.pop()!,
      newDeck.pop()!,
      newDeck.pop()!,
      newDeck.pop()!,
      newDeck.pop()!
    ];

    setDeck(newDeck);
    setHand(initialHand);
    setHeldIndices([false, false, false, false, false]);
    setFlipDelays([0, 300, 600, 900, 1200]);
    setResult(null);
    setPhase('DRAW_HOLD');
  };

  // Toggle hold on a card
  const toggleHold = (index: number) => {
    if (phase !== 'DRAW_HOLD') return;
    soundManager.playClick();
    setHeldIndices((prev) => {
      const copy = [...prev];
      copy[index] = !copy[index];
      return copy;
    });
  };

  // Step 2: Draw new cards for non-held slots and evaluate
  const handleDraw = () => {
    if (phase !== 'DRAW_HOLD' || deck.length < 5) return;

    const currentDeck = [...deck];
    let seq = 0;
    const nextDelays: number[] = [];
    const finalHand = hand.map((card, idx) => {
      if (heldIndices[idx]) {
        nextDelays.push(0);
        return card;
      }
      nextDelays.push(seq * 300);
      seq++;
      return currentDeck.pop()!;
    });

    setDeck(currentDeck);
    setFlipDelays(nextDelays);
    setHand(finalHand);

    // Evaluate final poker hand
    const handResult = evaluateVideoPokerHand(finalHand);
    setResult(handResult);
    setPhase('ROUND_OVER');

    const flipWaitMs = Math.max(300, Math.max(0, seq - 1) * 300 + 620);

    if (handResult.payoutMultiplier > 0) {
      const totalWin = bet * handResult.payoutMultiplier;
      if (handResult.rank === 'ROYAL_FLUSH' || handResult.rank === 'STRAIGHT_FLUSH') {
        soundManager.playJackpot();
      } else {
        soundManager.playWin();
      }
      onUpdateBalance(totalWin, true, 'video-poker', bet);
      if (victoryTimerRef.current) window.clearTimeout(victoryTimerRef.current);
      victoryTimerRef.current = window.setTimeout(() => {
        setVictoryModal({
          winAmount: totalWin,
          detail: `${handResult.name} (${handResult.payoutMultiplier}x)`
        });
      }, flipWaitMs);
    } else {
      soundManager.playLoss();
      reportRoundLoss('video-poker');
    }
  };

  return (
    <div className="space-y-1.5 max-w-4xl mx-auto animate-fade-in pb-1">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Lobby</span>
        </button>

        <span className="text-xs font-cinzel font-bold text-amber-400 uppercase tracking-wider">
          Vídeo Pôquer Deluxe
        </span>
      </div>

      {/* Paytable Matrix */}
      <div className="bg-[#180705] border border-orange-500/30 rounded-xl p-1.5 sm:p-2 shadow-lg overflow-x-auto">
        <div className="flex items-center justify-between mb-1 text-xs">
          <span className="font-cinzel font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1 text-[10px]">
            <Trophy className="w-3 h-3 text-amber-400" /> Tabela de Pagamentos
          </span>
          <span className="text-[10px] text-orange-300/80">
            Aposta: <strong className="text-amber-400 font-mono">{bet}</strong> fichas
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-9 gap-1 text-center text-[10px]">
          {POKER_PAYTABLE.map((row) => {
            const isHighlight = result?.rank === row.rank;
            return (
              <div
                key={row.rank}
                className={`py-0.5 px-1 rounded border transition-all ${
                  isHighlight
                    ? 'bg-amber-500 text-slate-950 font-bold border-amber-300 ring-2 ring-white scale-105 shadow'
                    : 'bg-[#260e0a] border-orange-500/20 text-orange-200'
                }`}
              >
                <div className="truncate font-semibold text-[9px] sm:text-[10px]">{row.name}</div>
                <div className="font-mono text-[9px] text-amber-300 font-bold">
                  {row.multiplier}x
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Poker Table Felt */}
      <div className="casino-felt casino-wood-border rounded-xl p-2.5 sm:p-3 min-h-[160px] sm:min-h-[175px] flex flex-col justify-between shadow-xl relative">
        {/* Subtle Watermark */}
        <div className="text-center">
          <span className="text-[10px] text-amber-400/60 font-cinzel tracking-widest uppercase block">
            Jacks or Better · 5 Card Draw
          </span>
          {phase === 'DRAW_HOLD' && (
            <p className="text-[10px] text-amber-300 font-semibold animate-pulse mt-0.5">
              Clique nas cartas para MANTER antes de trocar
            </p>
          )}
        </div>

        {/* 5 Cards Row */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 my-1 flex-wrap">
          {hand.length === 0
            ? Array.from({ length: 5 }).map((_, idx) => (
                <PlayingCard key={idx} hidden={true} size="xs" />
              ))
            : hand.map((card, idx) => (
                <PlayingCard
                  key={card.id || idx}
                  card={card}
                  held={heldIndices[idx]}
                  onToggleHold={phase === 'DRAW_HOLD' ? () => toggleHold(idx) : undefined}
                  size="xs"
                  floating={true}
                  withDealerHand={idx === 4}
                  flipDelayMs={flipDelays[idx] ?? idx * 300}
                />
              ))}
        </div>

        {/* Round Outcome Banner */}
        <div className="text-center min-h-[28px] flex items-center justify-center">
          {result && (
            <div
              className={`px-3 py-1 rounded-lg font-cinzel font-bold text-xs shadow-xl border ${
                result.payoutMultiplier > 0
                  ? 'bg-amber-500 text-slate-950 border-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              {result.name}! {result.payoutMultiplier > 0 ? `+${bet * result.payoutMultiplier} fichas!` : result.description}
            </div>
          )}
        </div>
      </div>

      {/* Controls & Chip Selector */}
      <div className="space-y-1.5">
        {phase === 'DRAW_HOLD' ? (
          <div className="bg-[#180705] border border-orange-500/30 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 shadow-xl">
            <span className="text-xs text-orange-200">
              Mantidas:{' '}
              <strong className="text-amber-400 font-bold">
                {heldIndices.filter(Boolean).length} de 5
              </strong>
            </span>

            <button
              type="button"
              onClick={handleDraw}
              className="py-2 px-5 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs shadow-xl shadow-orange-600/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-orange-300/40"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Trocar e Avaliar 🃏</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1">
              <ChipSelector
                currentBet={bet}
                balance={balance}
                onBetChange={setBet}
                disabled={false}
                compact={true}
              />
            </div>

            <button
              type="button"
              onClick={handleDeal}
              disabled={bet <= 0 || bet > balance}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs sm:text-sm shadow-xl shadow-orange-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border border-orange-300/40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{phase === 'ROUND_OVER' ? 'Nova Mão 🃏' : 'Distribuir 5 Cartas 🃏'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Como Jogar Button at the bottom without pushing controls */}
      <div className="pt-0.5 text-center">
        <button
          onClick={() => setShowHowToPlay(true)}
          className="inline-flex items-center gap-1 text-[11px] text-orange-300/70 hover:text-amber-300 transition-colors cursor-pointer py-0.5"
        >
          <HelpCircle className="w-3 h-3 text-orange-400" />
          <span>Regras & Como Jogar Vídeo Pôquer</span>
        </button>
      </div>

      {/* Rules Modal */}
      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        gameId="video-poker"
      />

      {/* Thematic Victory Modal */}
      <CardVictoryModal
        isOpen={Boolean(victoryModal)}
        winAmount={victoryModal?.winAmount || 0}
        subtitle="VÍDEO PÔQUER · JACKS OR BETTER"
        detail={victoryModal?.detail}
        onClose={() => setVictoryModal(null)}
      />
    </div>
  );
};
