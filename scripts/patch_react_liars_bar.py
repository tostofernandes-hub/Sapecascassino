#!/usr/bin/env python3
import re

react_liars_code = '''import React, { useState, useEffect } from 'react';
import { soundManager } from '../utils/audio';
import { fireConfetti } from '../utils/confetti';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { getStoredAccounts } from '../utils/auth';
import { incrementMissionCounter } from '../utils/missions';
import { ArrowLeft, HelpCircle, Users, Skull, Crown, Flame, ShieldAlert, RotateCcw } from 'lucide-react';

interface LiarsBarGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'liars-bar', betAmount?: number) => void;
  onBackToLobby: () => void;
  username?: string;
}

type CardType = 'A' | 'K' | 'Q' | 'DEVIL';

interface LiarsCard {
  id: string;
  type: CardType;
}

type CharType = 'scruffy' | 'von_pork' | 'fox' | 'bull' | 'cat';

interface Player {
  id: string;
  name: string;
  charType: CharType;
  isBot: boolean;
  lives: number; // 2 vidas no total
  chambersRemaining: number; // 3 câmaras no revólver
  chips: number;
  hand: LiarsCard[];
  isEliminated: boolean;
}

const CHARACTERS: { name: string; type: CharType }[] = [
  { name: 'Capitão Scruffy', type: 'scruffy' },
  { name: 'Barão Von Pork',   type: 'von_pork' },
  { name: 'Dama Raposa',      type: 'fox' },
  { name: 'Touro Bravo',      type: 'bull' },
  { name: 'Gato Mestre',      type: 'cat' }
];

// Helper to render detailed SVG characters with progressive bullet wounds
const renderCharacterAvatar = (charType: CharType, wounds = 0, isLarge = false, isDead = false) => {
  const size = isLarge ? 110 : 58;
  const strokeW = isLarge ? 2 : 1.5;

  let headColor = '#d97706';
  let suitColor = '#1f2937';
  let earPath = '';
  let features = '';

  if (charType === 'scruffy') {
    headColor = '#475569';
    suitColor = '#1e1b4b';
    earPath = '<polygon points="28,24 16,6 36,16" fill="#334155" stroke="#1e293b" /><polygon points="52,24 64,6 44,16" fill="#334155" stroke="#1e293b" />';
    features = `
      <ellipse cx="40" cy="18" rx="28" ry="6" fill="#0f172a" stroke="#f59e0b" stroke-width="${strokeW}"/>
      <path d="M22,18 C22,6 58,6 58,18 Z" fill="#1e293b"/>
      <rect x="22" y="15" width="36" height="3" fill="#ea580c"/>
      <polygon points="36,32 44,32 40,38" fill="#0f172a"/>
      <line x1="40" y1="38" x2="40" y2="44" stroke="#0f172a" stroke-width="1.5"/>
      <rect x="42" y="40" width="12" height="3" rx="1.5" fill="#78350f" transform="rotate(-10 42 40)"/>
      <circle cx="54" cy="38" r="1.5" fill="#f97316"/>
    `;
  } else if (charType === 'von_pork') {
    headColor = '#f472b6';
    suitColor = '#064e3b';
    earPath = '<ellipse cx="20" cy="22" rx="7" ry="9" fill="#f472b6" stroke="#db2777"/><ellipse cx="60" cy="22" rx="7" ry="9" fill="#f472b6" stroke="#db2777"/>';
    features = `
      <ellipse cx="40" cy="16" rx="26" ry="5" fill="#14532d"/>
      <path d="M26,16 C26,4 54,4 54,16 Z" fill="#166534" stroke="#f59e0b" stroke-width="1"/>
      <ellipse cx="40" cy="36" rx="10" ry="7" fill="#fbcfe8" stroke="#db2777" stroke-width="1.5"/>
      <circle cx="37" cy="36" r="2" fill="#be185d"/><circle cx="43" cy="36" r="2" fill="#be185d"/>
      <circle cx="48" cy="28" r="6" fill="none" stroke="#fbbf24" stroke-width="2"/>
      <line x1="53" y1="32" x2="58" y2="48" stroke="#fbbf24" stroke-width="1.2"/>
    `;
  } else if (charType === 'fox') {
    headColor = '#ea580c';
    suitColor = '#881337';
    earPath = '<polygon points="26,26 14,8 36,18" fill="#ea580c" stroke="#9a3412"/><polygon points="26,24 18,12 33,18" fill="#ffedd5"/><polygon points="54,26 66,8 44,18" fill="#ea580c" stroke="#9a3412"/><polygon points="54,24 62,12 47,18" fill="#ffedd5"/>';
    features = `
      <path d="M22,34 Q40,46 40,44 Q40,46 58,34 Q40,48 22,34 Z" fill="#ffedd5"/>
      <polygon points="37,38 43,38 40,42" fill="#0f172a"/>
      <circle cx="24" cy="18" r="5" fill="#e11d48"/>
      <circle cx="24" cy="18" r="2.5" fill="#ffe4e6"/>
      <circle cx="34" cy="54" r="2" fill="#fff"/><circle cx="40" cy="55" r="2.5" fill="#fff"/><circle cx="46" cy="54" r="2" fill="#fff"/>
    `;
  } else if (charType === 'bull') {
    headColor = '#78350f';
    suitColor = '#451a03';
    earPath = '<path d="M20,18 Q8,10 6,2 Q16,8 24,14 Z" fill="#fef08a" stroke="#b45309" stroke-width="1.5"/><path d="M60,18 Q72,10 74,2 Q64,8 56,14 Z" fill="#fef08a" stroke="#b45309" stroke-width="1.5"/>';
    features = `
      <ellipse cx="40" cy="38" rx="14" ry="9" fill="#92400e"/>
      <circle cx="35" cy="38" r="2.5" fill="#000"/><circle cx="45" cy="38" r="2.5" fill="#000"/>
      <circle cx="40" cy="44" r="5" fill="none" stroke="#fbbf24" stroke-width="2.5"/>
    `;
  } else {
    headColor = '#cbd5e1';
    suitColor = '#3b0764';
    earPath = '<polygon points="24,24 16,8 34,16" fill="#cbd5e1" stroke="#64748b"/><polygon points="56,24 64,8 46,16" fill="#cbd5e1" stroke="#64748b"/>';
    features = `
      <line x1="18" y1="36" x2="30" y2="38" stroke="#fff" stroke-width="1.2"/>
      <line x1="18" y1="42" x2="30" y2="41" stroke="#fff" stroke-width="1.2"/>
      <line x1="62" y1="36" x2="50" y2="38" stroke="#fff" stroke-width="1.2"/>
      <line x1="62" y1="42" x2="50" y2="41" stroke="#fff" stroke-width="1.2"/>
      <polygon points="38,36 42,36 40,39" fill="#f43f5e"/>
    `;
  }

  // Eyes based on damage
  let eyesHtml = '';
  if (wounds >= 2 || isDead) {
    eyesHtml = `
      <g stroke="#ef4444" stroke-width="2">
        <line x1="30" y1="24" x2="36" y2="30"/><line x1="36" y1="24" x2="30" y2="30"/>
        <line x1="44" y1="24" x2="50" y2="30"/><line x1="50" y1="24" x2="44" y2="30"/>
      </g>
    `;
  } else if (wounds === 1) {
    eyesHtml = `
      <ellipse cx="33" cy="27" rx="3" ry="2" fill="#000"/>
      <ellipse cx="47" cy="27" rx="3" ry="2" fill="#000"/>
      <path d="M22,26 Q20,30 22,32 Q24,30 22,26 Z" fill="#38bdf8"/>
    `;
  } else {
    eyesHtml = `
      <circle cx="33" cy="27" r="3" fill="#0f172a"/><circle cx="34" cy="26" r="1" fill="#fff"/>
      <circle cx="47" cy="27" r="3" fill="#0f172a"/><circle cx="48" cy="26" r="1" fill="#fff"/>
    `;
  }

  // Wounds on chest (1st shot: 1 hole, 2nd shot: 2 holes with blood)
  let chestWoundsHtml = '';
  if (wounds >= 1) {
    chestWoundsHtml += `
      <circle cx="34" cy="62" r="5" fill="#0a0505" stroke="#dc2626" stroke-width="1.8"/>
      <circle cx="34" cy="62" r="2.5" fill="#000"/>
      <circle cx="34" cy="62" r="7" fill="none" stroke="rgba(239,68,68,0.4)" stroke-dasharray="2,2"/>
    `;
  }
  if (wounds >= 2) {
    chestWoundsHtml += `
      <circle cx="46" cy="65" r="5.5" fill="#0a0505" stroke="#b91c1c" stroke-width="2"/>
      <circle cx="46" cy="65" r="3" fill="#000"/>
      <path d="M34,66 Q33,74 35,79" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <path d="M46,70 Q47,76 45,82" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    `;
  }

  return (
    <div
      dangerouslySetInnerHTML={{
        __html: `
          <svg width="${size}" height="${size}" viewBox="0 0 80 80" class="${wounds === 1 ? 'animate-pulse' : ''}" style="overflow: visible; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.6));">
            <path d="M16,52 L64,52 L68,80 L12,80 Z" fill="${suitColor}" stroke="#000" stroke-width="${strokeW}"/>
            <polygon points="34,52 46,52 43,62 37,62" fill="#fff"/>
            <polygon points="38,54 42,54 41,70 39,70" fill="#dc2626"/>
            ${chestWoundsHtml}
            ${earPath}
            <circle cx="40" cy="32" r="18" fill="${headColor}" stroke="#000" stroke-width="${strokeW}"/>
            ${features}
            ${eyesHtml}
          </svg>
        `
      }}
    />
  );
};

export const LiarsBarGame: React.FC<LiarsBarGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby,
  username = 'Jogador'
}) => {
  const [gameState, setGameState] = useState<'SETUP' | 'PLAYING' | 'REVEAL' | 'ROULETTE' | 'GAME_OVER'>('SETUP');
  const [entryBet, setEntryBet] = useState<number>(100);
  const [tableTarget, setTableTarget] = useState<'A' | 'K' | 'Q'>('K');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentTurnIdx, setCurrentTurnIdx] = useState<number>(0);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [lastPlay, setLastPlay] = useState<{
    playerIdx: number;
    cards: LiarsCard[];
    claimedCount: number;
    target: 'A' | 'K' | 'Q';
  } | null>(null);

  // Russian Roulette state
  const [rouletteVictimIdx, setRouletteVictimIdx] = useState<number | null>(null);
  const [rouletteChambers, setRouletteChambers] = useState<number>(3);
  const [rouletteSpinning, setRouletteSpinning] = useState<boolean>(false);
  const [rouletteMessage, setRouletteMessage] = useState<string>('');
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  // Initialize room with registered accounts or bots
  const initializeRoom = (numOpponents = 2) => {
    if (entryBet <= 0 || entryBet > balance) return;

    soundManager.playShuffle();
    onUpdateBalance(-entryBet, false, 'liars-bar');

    const accounts = getStoredAccounts();
    const otherRegistered = accounts
      .filter((a) => a.username.toLowerCase() !== username.toLowerCase())
      .map((a) => a.username);

    const initialPlayers: Player[] = [
      {
        id: 'p-0',
        name: username,
        charType: 'scruffy',
        isBot: false,
        lives: 2, // 2 Vidas no Liar's Bar
        chambersRemaining: 3, // 3 câmaras no revólver
        chips: entryBet * (numOpponents + 1),
        hand: [],
        isEliminated: false
      }
    ];

    for (let i = 0; i < numOpponents; i++) {
      const name = otherRegistered[i] || CHARACTERS[(i + 1) % CHARACTERS.length].name;
      const charType = CHARACTERS[(i + 1) % CHARACTERS.length].type;
      initialPlayers.push({
        id: `p-${i + 1}`,
        name,
        charType,
        isBot: !otherRegistered[i],
        lives: 2,
        chambersRemaining: 3,
        chips: entryBet * (numOpponents + 1),
        hand: [],
        isEliminated: false
      });
    }

    setPlayers(initialPlayers);
    dealNewRound(initialPlayers, 0);
    setGameState('PLAYING');
  };

  const generateDeck = (): LiarsCard[] => {
    const deck: LiarsCard[] = [];
    ['A', 'K', 'Q'].forEach((t) => {
      for (let i = 0; i < 6; i++) {
        deck.push({ id: `${t}-${i}-${Math.random()}`, type: t as CardType });
      }
    });
    for (let i = 0; i < 3; i++) {
      deck.push({ id: `DEVIL-${i}-${Math.random()}`, type: 'DEVIL' });
    }
    return deck.sort(() => Math.random() - 0.5);
  };

  const dealNewRound = (currentPlayers: Player[], starterIdx: number) => {
    const deck = generateDeck();
    const targets: ('A' | 'K' | 'Q')[] = ['A', 'K', 'Q'];
    const chosenTarget = targets[Math.floor(Math.random() * targets.length)];
    setTableTarget(chosenTarget);

    const updated = currentPlayers.map((p) => {
      if (p.isEliminated || p.lives <= 0) return p;
      return {
        ...p,
        hand: deck.splice(0, 5)
      };
    });

    setPlayers(updated);
    setCurrentTurnIdx(starterIdx);
    setLastPlay(null);
    setSelectedCardIds([]);
  };

  const handlePlayCards = () => {
    if (selectedCardIds.length === 0 || selectedCardIds.length > 3) return;

    const currPlayer = players[currentTurnIdx];
    if (currPlayer.isEliminated || currPlayer.lives <= 0) return;

    const playedCards = currPlayer.hand.filter((c) => selectedCardIds.includes(c.id));
    const remainingHand = currPlayer.hand.filter((c) => !selectedCardIds.includes(c.id));

    soundManager.playCardDeal();

    const updatedPlayers = [...players];
    updatedPlayers[currentTurnIdx].hand = remainingHand;
    setPlayers(updatedPlayers);

    setLastPlay({
      playerIdx: currentTurnIdx,
      cards: playedCards,
      claimedCount: playedCards.length,
      target: tableTarget
    });

    setSelectedCardIds([]);
    advanceTurn(updatedPlayers);
  };

  const advanceTurn = (pList: Player[]) => {
    let nextIdx = (currentTurnIdx + 1) % pList.length;
    let attempts = 0;
    while ((pList[nextIdx].isEliminated || pList[nextIdx].lives <= 0) && attempts < pList.length) {
      nextIdx = (nextIdx + 1) % pList.length;
      attempts++;
    }
    setCurrentTurnIdx(nextIdx);
  };

  // Bot AI decision maker
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const activePlayer = players[currentTurnIdx];
    if (!activePlayer || !activePlayer.isBot || activePlayer.isEliminated) return;

    const timer = setTimeout(() => {
      if (lastPlay && lastPlay.playerIdx !== currentTurnIdx) {
        const doubtChance = lastPlay.claimedCount === 3 ? 0.65 : lastPlay.claimedCount === 2 ? 0.35 : 0.15;
        if (Math.random() < doubtChance) {
          executeDoubt();
          return;
        }
      }

      const hand = activePlayer.hand;
      if (hand.length === 0) {
        advanceTurn(players);
        return;
      }

      const matching = hand.filter((c) => c.type === tableTarget || c.type === 'DEVIL');
      let cardsToPlay: LiarsCard[] = [];

      if (matching.length > 0 && Math.random() < 0.8) {
        cardsToPlay = matching.slice(0, Math.min(2, matching.length));
      } else {
        cardsToPlay = [hand[Math.floor(Math.random() * hand.length)]];
      }

      const playedIds = cardsToPlay.map((c) => c.id);
      const remainingHand = hand.filter((c) => !playedIds.includes(c.id));

      soundManager.playCardDeal();

      const updated = [...players];
      updated[currentTurnIdx].hand = remainingHand;
      setPlayers(updated);

      setLastPlay({
        playerIdx: currentTurnIdx,
        cards: cardsToPlay,
        claimedCount: cardsToPlay.length,
        target: tableTarget
      });

      advanceTurn(updated);
    }, 1400);

    return () => clearTimeout(timer);
  }, [gameState, currentTurnIdx, lastPlay]);

  // Execute Challenge / Doubt ("Duvidar!")
  const executeDoubt = () => {
    if (!lastPlay) return;

    soundManager.playBluffCall();
    setGameState('REVEAL');

    const challenger = players[currentTurnIdx];
    const accused = players[lastPlay.playerIdx];

    const wasBluff = lastPlay.cards.some((c) => c.type !== lastPlay.target && c.type !== 'DEVIL');
    const loserIdx = wasBluff ? lastPlay.playerIdx : currentTurnIdx;

    if (username) {
      incrementMissionCounter(username, 'liars_bluffs', 1);
    }

    setTimeout(() => {
      // Transition to Russian Roulette Gun Challenge!
      setRouletteVictimIdx(loserIdx);
      setRouletteChambers(players[loserIdx].chambersRemaining || 3);
      setRouletteMessage(
        wasBluff
          ? `🚨 BLEFE DESMASCARADO! ${accused.name} mentiu sobre as cartas e encara o revólver!`
          : `🛡️ DECLARAÇÃO VERDADEIRA! ${accused.name} disse a verdade. ${challenger.name} encara o revólver!`
      );
      setGameState('ROULETTE');
    }, 1800);
  };

  // Pull trigger on Russian Roulette
  const handlePullTrigger = () => {
    if (rouletteVictimIdx === null || rouletteSpinning) return;

    setRouletteSpinning(true);
    soundManager.playClick();
    setRouletteMessage('Girando o tambor de 3 câmaras... Puxando o cão...');

    setTimeout(() => {
      setRouletteSpinning(false);
      const rem = rouletteChambers;
      let isBullet = false;

      // Progressive 3-chamber revolver logic:
      // If 1 chamber remaining: 100% GUARANTEED BULLET
      // If 2 chambers remaining: 50% chance (1 bullet, 1 blank)
      // If 3 chambers remaining: 33.3% chance (1 bullet, 2 blanks)
      if (rem <= 1) {
        isBullet = true;
      } else if (rem === 2) {
        isBullet = Math.random() < 0.5;
      } else {
        isBullet = Math.random() < 0.3333;
      }

      const updated = [...players];
      const victim = updated[rouletteVictimIdx];

      if (!isBullet) {
        // Blank shot: remove 1 chamber!
        const nextChambers = rem - 1;
        setRouletteChambers(nextChambers);
        victim.chambersRemaining = nextChambers;
        setPlayers(updated);

        soundManager.playClick();
        setRouletteMessage(`💨 *CLIQUE!* Câmara vazia descartada! Restam ${nextChambers} câmara(s). ${victim.name} sobreviveu!`);

        setTimeout(() => {
          advanceToNextRoundOrEnd(updated, rouletteVictimIdx);
        }, 2200);
      } else {
        // Bullet hit!
        soundManager.playLoss();
        victim.lives -= 1;
        victim.chambersRemaining = 3; // Reset cylinder
        setRouletteChambers(3);

        if (victim.lives <= 0) {
          victim.isEliminated = true;
          setRouletteMessage(`💀 BANG! Segundo tiro fatal! ${victim.name} perdeu as 2 vidas e foi ELIMINADO (Modo Espectador)!`);
        } else {
          setRouletteMessage(`💥 BANG! O tiro disparou! ${victim.name} levou um tiro no peito! (1 vida restante ❤️)`);
        }

        setPlayers(updated);

        setTimeout(() => {
          advanceToNextRoundOrEnd(updated, rouletteVictimIdx);
        }, 2800);
      }
    }, 1400);
  };

  const advanceToNextRoundOrEnd = (currentPlayers: Player[], lastVictimIdx: number) => {
    const survivors = currentPlayers.filter((p) => !p.isEliminated && p.lives > 0);
    if (survivors.length <= 1) {
      setGameState('GAME_OVER');
      if (survivors[0]?.id === 'p-0') {
        const pot = entryBet * currentPlayers.length * 1.5;
        onUpdateBalance(pot, true, 'liars-bar', entryBet);
        fireConfetti();
      }
    } else {
      setGameState('PLAYING');
      dealNewRound(currentPlayers, (lastVictimIdx + 1) % currentPlayers.length);
    }
  };

  const humanPlayer = players[0];
  const isHumanTurn = currentTurnIdx === 0 && !humanPlayer?.isEliminated && (humanPlayer?.lives || 0) > 0;
  const isHumanEliminated = humanPlayer?.isEliminated || (humanPlayer?.lives || 0) <= 0;

  return (
    <div className="h-full w-full max-w-4xl mx-auto flex flex-col justify-between overflow-hidden animate-fade-in text-orange-100 p-1 sm:p-2 select-none">
      {/* Top Header Bar */}
      <div className="shrink-0 flex items-center justify-between px-2 py-0.5">
        <button onClick={onBackToLobby} className="btn-dark flex items-center gap-1.5 text-xs py-1.5 px-3">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Lobby</span>
        </button>

        <div className="text-center">
          <div className="font-cinzel text-sm sm:text-base font-black text-amber-300 flex items-center justify-center gap-1.5">
            <Skull className="w-4 h-4 text-red-500" />
            <span>LIAR&apos;S BAR · ROLETA RUSSA &amp; BLEFE</span>
          </div>
          <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block">
            {gameState === 'PLAYING'
              ? `Mesa Exige: ${tableTarget === 'A' ? 'Áses (A)' : tableTarget === 'K' ? 'Reis (K)' : 'Damas (Q)'} 👑 (Diabo 😈 é Coringa)`
              : 'Blefe, deduza e enfrente o revólver de 3 câmaras!'}
          </span>
        </div>

        <button onClick={() => setShowHowToPlay(true)} className="btn-dark flex items-center gap-1 text-xs py-1.5 px-3">
          <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Regras</span>
        </button>
      </div>

      {/* SETUP SCREEN */}
      {gameState === 'SETUP' && (
        <div className="casino-felt casino-wood-border rounded-2xl flex-1 min-h-0 flex flex-col items-center justify-center p-3 sm:p-4 text-center my-1 overflow-hidden shadow-2xl">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center text-3xl shadow-xl border-2 border-yellow-300 mb-2">
            😈
          </div>
          <h2 className="font-cinzel text-lg sm:text-xl font-black text-white">SALA LIAR&apos;S BAR</h2>
          <p className="text-xs text-orange-200/80 max-w-md mt-1 mb-3 leading-relaxed">
            Blefe com figuras e encare a Roleta Russa ao ser desmascarado! O revólver possui 3 câmaras e 1 bala carregada. Tiros vazios descartam a câmara. 2 vidas cada!
          </p>

          <div className="flex items-center gap-2.5 mb-3">
            <span className="text-xs font-bold text-orange-400">Total de Jogadores:</span>
            {[3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => initializeRoom(n - 1)}
                className="btn-gold py-1.5 px-3 sm:px-4 text-xs font-bold"
              >
                {n} Jogadores 👥
              </button>
            ))}
          </div>

          <div className="text-xs text-amber-300/80 font-mono">
            Entrada: 🪙 {entryBet} Fichas · 2 Vidas · Revólver de 3 Câmaras
          </div>
        </div>
      )}

      {/* ACTIVE PLAYING & REVEAL ARENA */}
      {(gameState === 'PLAYING' || gameState === 'REVEAL') && (
        <div className="casino-felt casino-wood-border rounded-2xl flex-1 min-h-0 flex flex-col justify-between p-2 sm:p-2.5 relative overflow-hidden shadow-2xl my-1">
          {/* Table Banner */}
          <div className="shrink-0 flex items-center justify-between px-2.5 py-1 rounded-xl bg-[#140503]/85 border border-orange-500/30 shadow-md">
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl">
                {tableTarget === 'A' ? '♠️' : tableTarget === 'K' ? '👑' : '👸'}
              </span>
              <div>
                <span className="text-[9px] uppercase font-bold text-orange-400 block leading-tight">Exigência da Mesa</span>
                <span className="font-cinzel text-xs sm:text-sm font-black text-amber-300 leading-tight">
                  {tableTarget === 'A' ? 'Áses (A)' : tableTarget === 'K' ? 'Reis (K)' : 'Damas (Q)'}
                </span>
              </div>
            </div>

            <div className="text-center px-2.5 py-0.5 rounded-lg bg-[#250d09] border border-orange-500/40">
              <span className="text-[8px] text-orange-400 font-bold uppercase block leading-tight">Vez de Jogar</span>
              <span className="text-[11px] sm:text-xs font-black text-white font-cinzel leading-tight">
                {players[currentTurnIdx]?.name || ''}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[8px] uppercase font-bold text-orange-400 block leading-tight">Última Jogada</span>
              <span className="text-[11px] font-bold text-orange-200 leading-tight">
                {lastPlay
                  ? `${players[lastPlay.playerIdx]?.name}: ${lastPlay.claimedCount} carta(s)`
                  : 'Início da Rodada'}
              </span>
            </div>
          </div>

          {/* Opponents Seats with SVG Characters & Wounds */}
          <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-1.5 my-1">
            {players.slice(1).map((p, idx) => {
              const isCurrent = currentTurnIdx === idx + 1;
              const wounds = 2 - Math.max(0, p.lives);
              return (
                <div
                  key={p.id}
                  className={`p-1 sm:p-1.5 rounded-xl border text-center transition-all flex flex-col items-center ${
                    p.isEliminated
                      ? 'bg-black/60 border-red-950 opacity-40'
                      : isCurrent
                      ? 'bg-gradient-to-b from-[#3a1209] to-[#1c0805] border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                      : 'bg-[#180705]/80 border-orange-500/25'
                  }`}
                >
                  {renderCharacterAvatar(p.charType, wounds, false, p.isEliminated)}
                  <div className="text-[11px] font-bold text-white truncate font-cinzel mt-1">{p.name}</div>
                  <div className="flex items-center justify-center gap-0.5 my-0.5">
                    {p.isEliminated ? (
                      <span className="text-[9px] text-red-500 font-black">💀 ESPECTADOR</span>
                    ) : (
                      <>
                        <span className={`text-[10px] ${p.lives >= 1 ? 'text-red-500' : 'text-slate-600'}`}>❤️</span>
                        <span className={`text-[10px] ${p.lives >= 2 ? 'text-red-500' : 'text-slate-600'}`}>❤️</span>
                      </>
                    )}
                  </div>
                  <span className="text-[9px] text-orange-300 font-mono">
                    {p.isEliminated ? 'Eliminado' : `${p.hand.length} Cartas · (${p.chambersRemaining}/3 Câmaras)`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Table Center Cards */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-1 overflow-hidden">
            {lastPlay ? (
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-orange-400 block mb-1">
                  Cartas na Mesa ({lastPlay.claimedCount}x {lastPlay.target}):
                </span>
                <div className="flex items-center justify-center gap-2">
                  {lastPlay.cards.map((c, cIdx) => {
                    const isFlipped = gameState === 'REVEAL';
                    return (
                      <div
                        key={cIdx}
                        className={`w-11 h-16 sm:w-13 sm:h-18 rounded-xl border-2 flex flex-col items-center justify-center font-bold text-base shadow-xl transition-all ${
                          isFlipped
                            ? c.type === 'DEVIL'
                              ? 'bg-purple-950 border-purple-400 text-purple-200 animate-bounce'
                              : c.type === lastPlay.target
                              ? 'bg-emerald-950 border-emerald-400 text-emerald-200'
                              : 'bg-red-950 border-red-500 text-red-300'
                            : 'bg-gradient-to-br from-[#450a0a] to-[#1f0503] border-amber-500 text-amber-400'
                        }`}
                      >
                        {isFlipped ? (
                          <>
                            <span>{c.type === 'DEVIL' ? '😈' : c.type}</span>
                            <span className="text-[8px] uppercase">
                              {c.type === 'DEVIL' ? 'DIABO' : c.type}
                            </span>
                          </>
                        ) : (
                          <span>♠</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-1 text-xs text-orange-300/60 font-cinzel">
                A mesa aguarda a primeira jogada...
              </div>
            )}
          </div>

          {/* Human Hand */}
          <div className="shrink-0 border-t border-orange-500/25 pt-1">
            <div className="flex items-center justify-between mb-0.5 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white font-cinzel">Sua Mão ({username}):</span>
                {isHumanEliminated ? (
                  <span className="text-[10px] text-red-400 font-bold">💀 Modo Espectador (Assistindo)</span>
                ) : (
                  <div className="flex items-center gap-0.5">
                    <span className={`text-xs ${(humanPlayer?.lives || 0) >= 1 ? 'text-red-500' : 'text-slate-600'}`}>❤️</span>
                    <span className={`text-xs ${(humanPlayer?.lives || 0) >= 2 ? 'text-red-500' : 'text-slate-600'}`}>❤️</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-orange-400 font-bold">
                {selectedCardIds.length} selecionada(s) (Máx 3)
              </span>
            </div>

            <div className="flex items-center justify-center gap-1.5 sm:gap-2 overflow-x-auto py-1">
              {(humanPlayer?.hand || []).map((card) => {
                const isSelected = selectedCardIds.includes(card.id);
                const isMatching = card.type === tableTarget || card.type === 'DEVIL';

                return (
                  <button
                    key={card.id}
                    type="button"
                    disabled={gameState !== 'PLAYING' || currentTurnIdx !== 0 || isHumanEliminated}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedCardIds(selectedCardIds.filter((id) => id !== card.id));
                      } else if (selectedCardIds.length < 3) {
                        setSelectedCardIds([...selectedCardIds, card.id]);
                        soundManager.playClick();
                      }
                    }}
                    className={`w-12 h-18 sm:w-14 sm:h-20 rounded-xl border-2 flex flex-col justify-between p-1 font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-yellow-300 bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950 -translate-y-1.5 shadow-[0_0_15px_#f59e0b] scale-105'
                        : isMatching
                        ? 'bg-[#250d09] border-orange-500 text-orange-100 hover:border-amber-400 hover:scale-102'
                        : 'bg-[#180705] border-orange-500/30 text-orange-300/70 hover:border-orange-400'
                    }`}
                  >
                    <span className="text-xs font-black">{card.type === 'DEVIL' ? '😈' : card.type}</span>
                    <span className="text-center text-sm">{card.type === 'DEVIL' ? '🃏' : '♦'}</span>
                    <span className="text-[10px] font-black self-end">
                      {card.type === 'DEVIL' ? 'DIABO' : card.type}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* RUSSIAN ROULETTE OVERLAY MODAL */}
      {gameState === 'ROULETTE' && rouletteVictimIdx !== null && (
        <div className="casino-felt casino-wood-border rounded-2xl flex-1 min-h-0 flex flex-col items-center justify-around p-3 sm:p-4 text-center my-1 overflow-hidden shadow-2xl border-2 border-red-500">
          <div className="text-xs font-black tracking-widest text-red-500 uppercase">
            ⚠️ ROLETA RUSSA DO LIAR&apos;S BAR ⚠️
          </div>

          <h2 className="font-cinzel text-lg sm:text-xl font-black text-amber-300">
            {players[rouletteVictimIdx]?.name} enfrenta o revólver!
          </h2>

          <div className="my-2">
            {renderCharacterAvatar(
              players[rouletteVictimIdx]?.charType || 'scruffy',
              2 - Math.max(0, players[rouletteVictimIdx]?.lives || 0),
              true,
              players[rouletteVictimIdx]?.isEliminated
            )}
          </div>

          <div className="bg-black/60 border border-orange-500/40 rounded-xl p-2.5 max-w-sm w-full">
            <div className="text-xs font-bold text-amber-400 mb-1">
              Tambor: {rouletteChambers} câmara(s) disponível(is) · 1 Bala Carregada
            </div>
            <div className="text-[11px] text-orange-200 min-h-[32px] flex items-center justify-center font-bold">
              {rouletteMessage}
            </div>
          </div>

          <button
            onClick={handlePullTrigger}
            disabled={rouletteSpinning}
            className="w-full max-w-xs py-3 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-cinzel font-black text-sm uppercase tracking-wider shadow-2xl border-2 border-red-300 active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {rouletteSpinning ? 'DISPARANDO... 🎯' : 'PUXAR O GATILHO! 🎯'}
          </button>
        </div>
      )}

      {/* GAME OVER SCREEN */}
      {gameState === 'GAME_OVER' && (
        <div className="casino-felt casino-wood-border rounded-2xl flex-1 min-h-0 flex flex-col items-center justify-center p-4 text-center animate-scale-in shadow-2xl my-1">
          {players.filter((p) => !p.isEliminated)[0]?.id === 'p-0' ? (
            <>
              <Crown className="w-10 h-10 text-amber-400 mb-2 animate-bounce" />
              <h2 className="font-cinzel text-xl font-black text-amber-300">VOCÊ É O CAMPEÃO DO BLEFE!</h2>
              <p className="text-xs text-orange-200 mt-1 max-w-sm">
                Todos os seus oponentes foram eliminados na Roleta Russa. Você embolsou o prêmio imperial da mesa!
              </p>
            </>
          ) : (
            <>
              <Skull className="w-10 h-10 text-red-500 mb-2 animate-pulse" />
              <h2 className="font-cinzel text-xl font-black text-red-400">VOCÊ FOI ELIMINADO!</h2>
              <p className="text-xs text-orange-200 mt-1 max-w-sm">
                Suas 2 vidas acabaram. O campeão sobrevivente foi {players.filter((p) => !p.isEliminated)[0]?.name}!
              </p>
            </>
          )}
          <button onClick={() => setGameState('SETUP')} className="w-full max-w-xs py-2.5 px-6 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 text-white font-cinzel font-black text-xs uppercase shadow-xl mt-3 cursor-pointer">
            JOGAR OUTRA PARTIDA ✦
          </button>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div className="shrink-0 bg-[#180705] border-2 border-orange-500/30 p-2 rounded-2xl space-y-1.5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-xs text-orange-300 font-bold flex items-center gap-2">
            <span>
              {isHumanEliminated
                ? '💀 MODO ESPECTADOR (ASSISTINDO)'
                : isHumanTurn
                ? '🟢 SUA VEZ (JOGAR OU DUVIDAR)'
                : '⏳ AGUARDANDO OPONENTES'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {gameState === 'PLAYING' && isHumanTurn && lastPlay && (
              <button
                type="button"
                onClick={executeDoubt}
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-cinzel font-black text-xs uppercase tracking-wider shadow-2xl border-2 border-red-300 animate-pulse cursor-pointer"
              >
                DUVIDAR! (LIAR!) 🚨
              </button>
            )}

            {gameState === 'PLAYING' && isHumanTurn && (
              <button
                type="button"
                onClick={handlePlayCards}
                disabled={selectedCardIds.length === 0}
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 text-white font-cinzel font-black text-xs uppercase tracking-wider shadow-2xl border-2 border-orange-300/50 cursor-pointer disabled:opacity-40"
              >
                JOGAR {selectedCardIds.length || ''} CARTA(S) 🃏
              </button>
            )}
          </div>
        </div>

        <div className="pt-0.5 text-center">
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="inline-flex items-center gap-1 text-[11px] text-orange-300/70 hover:text-amber-300 transition-colors cursor-pointer py-0.5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
            <span>Regras do Liar&apos;s Bar com Roleta Russa</span>
          </button>
        </div>
      </div>

      {showHowToPlay && (
        <HowToPlayModal
          isOpen={showHowToPlay}
          onClose={() => setShowHowToPlay(false)}
          gameId="liars-bar"
        />
      )}
    </div>
  );
};
'''

with open('src/games/LiarsBarGame.tsx', 'w', encoding='utf-8') as f:
    f.write(react_liars_code)

print("Updated src/games/LiarsBarGame.tsx successfully!")
