import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../types/casino';
import { createDeck, shuffleDeck, calculateBaccaratScore } from '../utils/cards';
import { soundManager } from '../utils/audio';
import { reportRoundLoss } from '../utils/luckyStreak';
import { PlayingCard } from '../components/PlayingCard';
import { ChipSelector } from '../components/ChipSelector';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { CardVictoryModal } from '../components/CardVictoryModal';
import { ArrowLeft, Play, RotateCcw, HelpCircle } from 'lucide-react';

interface BaccaratGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'baccarat', betAmount?: number) => void;
  onBackToLobby: () => void;
}

type BetTarget = 'PLAYER' | 'BANKER' | 'TIE';
type GamePhase = 'BETTING' | 'DEALING' | 'ENDED';

export const BaccaratGame: React.FC<BaccaratGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby
}) => {
  const [bet, setBet] = useState<number>(50);
  const [betTarget, setBetTarget] = useState<BetTarget>('PLAYER');
  const [phase, setPhase] = useState<GamePhase>('BETTING');
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [bankerHand, setBankerHand] = useState<Card[]>([]);
  const [resultText, setResultText] = useState<string>('');
  const [resultWinner, setResultWinner] = useState<BetTarget | null>(null);
  const [roadMap, setRoadMap] = useState<('P' | 'B' | 'T')[]>(['B', 'P', 'B', 'B', 'T', 'P']);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [victoryModal, setVictoryModal] = useState<{ winAmount: number; detail: string } | null>(null);
  const roundTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (roundTimerRef.current) window.clearTimeout(roundTimerRef.current);
    };
  }, []);

  const handleStart = () => {
    if (bet <= 0 || bet > balance) return;

    if (roundTimerRef.current) window.clearTimeout(roundTimerRef.current);
    setVictoryModal(null);
    soundManager.playShuffle();
    onUpdateBalance(-bet, false, 'baccarat');
    setPhase('DEALING');
    setResultText('');
    setResultWinner(null);

    const deck = shuffleDeck(createDeck());

    // Initial 2 cards each
    const p1 = deck.pop()!;
    const b1 = deck.pop()!;
    const p2 = deck.pop()!;
    const b2 = deck.pop()!;

    let currentP = [p1, p2];
    let currentB = [b1, b2];

    let pScore = calculateBaccaratScore(currentP);
    let bScore = calculateBaccaratScore(currentB);

    // Check for Natural (8 or 9)
    const isNatural = pScore >= 8 || bScore >= 8;

    if (!isNatural) {
      let playerThirdCard: Card | null = null;

      // Player Rule: draws if score <= 5
      if (pScore <= 5) {
        playerThirdCard = deck.pop()!;
        currentP = [...currentP, playerThirdCard];
        pScore = calculateBaccaratScore(currentP);
      }

      // Banker Rule
      if (!playerThirdCard) {
        if (bScore <= 5) {
          const b3 = deck.pop()!;
          currentB = [...currentB, b3];
          bScore = calculateBaccaratScore(currentB);
        }
      } else {
        const p3Val = playerThirdCard.value >= 10 ? 0 : playerThirdCard.value;
        let bankerDraws = false;

        if (bScore <= 2) bankerDraws = true;
        else if (bScore === 3 && p3Val !== 8) bankerDraws = true;
        else if (bScore === 4 && [2, 3, 4, 5, 6, 7].includes(p3Val)) bankerDraws = true;
        else if (bScore === 5 && [4, 5, 6, 7].includes(p3Val)) bankerDraws = true;
        else if (bScore === 6 && [6, 7].includes(p3Val)) bankerDraws = true;

        if (bankerDraws) {
          const b3 = deck.pop()!;
          currentB = [...currentB, b3];
          bScore = calculateBaccaratScore(currentB);
        }
      }
    }

    setPlayerHand(currentP);
    setBankerHand(currentB);

    const totalCards = currentP.length + currentB.length;
    const flipWaitMs = (totalCards - 1) * 300 + 620;

    roundTimerRef.current = window.setTimeout(() => {
      // Determine Winner
      let winner: BetTarget;
      if (pScore > bScore) winner = 'PLAYER';
      else if (bScore > pScore) winner = 'BANKER';
      else winner = 'TIE';

      setResultWinner(winner);
      setRoadMap((prev) => [...prev.slice(-14), winner === 'PLAYER' ? 'P' : winner === 'BANKER' ? 'B' : 'T']);

      const winnerLabel =
        winner === 'PLAYER'
          ? `Jogador Vence (${pScore} vs ${bScore})`
          : winner === 'BANKER'
          ? `Banca Vence (${bScore} vs ${pScore})`
          : `Empate (${pScore} a ${bScore})`;

      // Calculate payout based on user bet
      if (betTarget === winner) {
        let payout = 0;
        if (winner === 'PLAYER') payout = bet * 2;
        else if (winner === 'BANKER') payout = Math.floor(bet + bet * 0.95);
        else payout = bet * 9;

        soundManager.playWin();
        onUpdateBalance(payout, true, 'baccarat', bet);
        setResultText(`Vitória! ${winnerLabel}. Você recebeu ${payout} fichas!`);
        setVictoryModal({ winAmount: payout, detail: winnerLabel });
      } else if (winner === 'TIE') {
        soundManager.playLoss();
        onUpdateBalance(bet, false, 'baccarat');
        setResultText(`Empate! Fichas devolvidas integralmente.`);
      } else {
        soundManager.playLoss();
        reportRoundLoss('baccarat');
        setResultText(`${winnerLabel}. Aposta perdida.`);
      }

      setPhase('ENDED');
    }, flipWaitMs);
  };

  const pScore = calculateBaccaratScore(playerHand);
  const bScore = calculateBaccaratScore(bankerHand);

  return (
    <div className="space-y-3 max-w-4xl mx-auto animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Lobby</span>
        </button>

        {/* Road Map / Bead Plate History */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 hidden sm:inline">Histórico:</span>
            <div className="flex items-center gap-1">
              {roadMap.map((res, i) => (
                <span
                  key={i}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white ${
                    res === 'P'
                      ? 'bg-blue-600'
                      : res === 'B'
                      ? 'bg-red-600'
                      : 'bg-emerald-600'
                  }`}
                  title={res === 'P' ? 'Jogador' : res === 'B' ? 'Banca' : 'Empate'}
                >
                  {res}
                </span>
              ))}
            </div>
          </div>

          <span className="text-xs font-cinzel font-bold text-amber-400 uppercase tracking-wider hidden sm:inline">
            Bacarate Dragão
          </span>
        </div>
      </div>

      {/* Baccarat Table Felt */}
      <div className="casino-felt casino-wood-border rounded-xl p-2.5 sm:p-3 min-h-[160px] sm:min-h-[175px] flex flex-col justify-between shadow-xl relative">
        {/* Table Watermark */}
        <div className="text-center">
          <span className="text-[10px] text-amber-400/80 font-cinzel tracking-widest uppercase">
            Bacarate Imperial · Punto Banco
          </span>
        </div>

        {/* Both Hands Side by Side */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 my-1">
          {/* Player Hand Zone */}
          <div
            className={`p-2 rounded-lg border transition-all ${
              resultWinner === 'PLAYER'
                ? 'bg-blue-950/40 border-blue-400 ring-2 ring-blue-400/60 shadow-md shadow-blue-500/20'
                : 'bg-slate-900/40 border-slate-700/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-cinzel font-bold text-blue-400 tracking-wider uppercase">
                Jogador (Player)
              </span>
              {playerHand.length > 0 && phase === 'ENDED' && (
                <span className="bg-blue-950 border border-blue-500/40 px-1 py-0.2 rounded text-[10px] font-mono font-bold text-blue-300">
                  Total: {pScore}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 justify-center min-h-[70px] sm:min-h-[78px]">
              {playerHand.length === 0 ? (
                <div className="w-12 h-16 rounded border border-dashed border-blue-400/20 flex items-center justify-center text-[9px] text-blue-400/40">
                  Jogador
                </div>
              ) : (
                playerHand.map((card, idx) => (
                  <PlayingCard
                    key={card.id || idx}
                    card={card}
                    size="xs"
                    floating={true}
                    withDealerHand={idx === playerHand.length - 1}
                    flipDelayMs={idx * 300}
                  />
                ))
              )}
            </div>
          </div>

          {/* Banker Hand Zone */}
          <div
            className={`p-2 rounded-lg border transition-all ${
              resultWinner === 'BANKER'
                ? 'bg-red-950/40 border-red-400 ring-2 ring-red-400/60 shadow-md shadow-red-500/20'
                : 'bg-slate-900/40 border-slate-700/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-cinzel font-bold text-red-400 tracking-wider uppercase">
                Banca (Banker)
              </span>
              {bankerHand.length > 0 && phase === 'ENDED' && (
                <span className="bg-red-950 border border-red-500/40 px-1 py-0.2 rounded text-[10px] font-mono font-bold text-red-300">
                  Total: {bScore}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 justify-center min-h-[70px] sm:min-h-[78px]">
              {bankerHand.length === 0 ? (
                <div className="w-12 h-16 rounded border border-dashed border-red-400/20 flex items-center justify-center text-[9px] text-red-400/40">
                  Banca
                </div>
              ) : (
                bankerHand.map((card, idx) => (
                  <PlayingCard
                    key={card.id || idx}
                    card={card}
                    size="xs"
                    flipDelayMs={(playerHand.length + idx) * 300}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center Result Message */}
        {resultText ? (
          <div className="text-center py-0.5">
            <div
              className={`inline-block px-3 py-1 rounded-lg font-cinzel font-bold text-xs border shadow-lg ${
                betTarget === resultWinner
                  ? 'bg-amber-500 text-slate-950 border-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-200'
              }`}
            >
              {resultText}
            </div>
          </div>
        ) : (
          <div className="text-center py-0.5 text-[10px] text-slate-400">
            Aposte no Jogador (1:1), Empate (8:1) ou Banca (0,95:1)
          </div>
        )}
      </div>

      {/* Betting Control Bar: Target selection + ChipSelector + Play Action */}
      <div className="bg-[#180705] border border-orange-500/30 rounded-xl p-2 sm:p-2.5 shadow-xl space-y-1.5">
        {/* Betting Targets */}
        <div className="grid grid-cols-3 gap-1.5">
          {/* Bet Player */}
          <button
            type="button"
            disabled={phase === 'DEALING'}
            onClick={() => {
              soundManager.playClick();
              setBetTarget('PLAYER');
            }}
            className={`py-1 px-1.5 rounded-lg border flex flex-col items-center justify-center transition-all cursor-pointer ${
              betTarget === 'PLAYER'
                ? 'bg-blue-600/30 border-blue-400 ring-2 ring-blue-400 text-white font-bold'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="text-[11px] font-bold">Jogador</span>
            <span className="text-[9px] text-blue-400 font-mono">1:1</span>
          </button>

          {/* Bet Tie */}
          <button
            type="button"
            disabled={phase === 'DEALING'}
            onClick={() => {
              soundManager.playClick();
              setBetTarget('TIE');
            }}
            className={`py-1 px-1.5 rounded-lg border flex flex-col items-center justify-center transition-all cursor-pointer ${
              betTarget === 'TIE'
                ? 'bg-emerald-600/30 border-emerald-400 ring-2 ring-emerald-400 text-white font-bold'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="text-[11px] font-bold">Empate (Tie)</span>
            <span className="text-[9px] text-emerald-400 font-mono">8:1</span>
          </button>

          {/* Bet Banker */}
          <button
            type="button"
            disabled={phase === 'DEALING'}
            onClick={() => {
              soundManager.playClick();
              setBetTarget('BANKER');
            }}
            className={`py-1 px-1.5 rounded-lg border flex flex-col items-center justify-center transition-all cursor-pointer ${
              betTarget === 'BANKER'
                ? 'bg-red-600/30 border-red-400 ring-2 ring-red-400 text-white font-bold'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="text-[11px] font-bold">Banca</span>
            <span className="text-[9px] text-red-400 font-mono">0,95:1</span>
          </button>
        </div>

        {/* Chips Selector and Action Button Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-0.5">
          <div className="flex-1">
            <ChipSelector
              currentBet={bet}
              balance={balance}
              onBetChange={setBet}
              disabled={phase === 'DEALING'}
              compact={true}
            />
          </div>

          <button
            type="button"
            disabled={phase === 'DEALING' || bet <= 0 || bet > balance}
            onClick={handleStart}
            className="sm:w-52 py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs sm:text-sm shadow-xl shadow-orange-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap border border-orange-300/40"
          >
            {phase === 'ENDED' ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{phase === 'DEALING' ? 'Distribuindo...' : phase === 'ENDED' ? 'Nova Rodada 👑' : 'Confirmar e Jogar 👑'}</span>
          </button>
        </div>
      </div>

      {/* Como Jogar Button at the bottom without pushing controls */}
      <div className="pt-0.5 text-center">
        <button
          onClick={() => setShowHowToPlay(true)}
          className="inline-flex items-center gap-1 text-[11px] text-orange-300/70 hover:text-amber-300 transition-colors cursor-pointer py-0.5"
        >
          <HelpCircle className="w-3 h-3 text-orange-400" />
          <span>Regras & Como Jogar Bacarate</span>
        </button>
      </div>

      {/* Rules Modal */}
      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        gameId="baccarat"
      />

      {/* Thematic Victory Modal */}
      <CardVictoryModal
        isOpen={Boolean(victoryModal)}
        winAmount={victoryModal?.winAmount || 0}
        subtitle="BACARATE DRAGÃO · PUNTO BANCO"
        detail={victoryModal?.detail}
        onClose={() => setVictoryModal(null)}
      />
    </div>
  );
};
