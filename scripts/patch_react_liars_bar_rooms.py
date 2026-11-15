#!/usr/bin/env python3
"""
patch_react_liars_bar_rooms.py
Upgrades src/games/LiarsBarGame.tsx to provide:
1. Room Lobby ("Salas") showing open/active rooms (max 5 players).
2. Waiting Room ("Sala de Espera") where only the host can click "Iniciar Jogo" (min 2 players).
3. Active Game with turns, Declarar, Duvidar, Russian Roulette (Atirar) with 3-chamber revolver,
   progressive bullet wounds on character SVG, elimination into spectator mode,
   and clean 100vh layout with "Como jogar" button.
"""

new_code = '''import React, { useState, useEffect } from 'react';
import { soundManager } from '../utils/audio';
import { fireConfetti } from '../utils/confetti';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { getStoredAccounts } from '../utils/auth';
import { incrementMissionCounter } from '../utils/missions';
import {
  ArrowLeft,
  HelpCircle,
  Users,
  Skull,
  Crown,
  Flame,
  ShieldAlert,
  RotateCcw,
  Plus,
  Play,
  Eye,
  Crosshair
} from 'lucide-react';

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

interface LiarsRoom {
  id: string;
  name: string;
  host: string;
  createdAt: number;
  maxPlayers: number;
  playerNames: string[];
  status: 'aberta' | 'em-andamento' | 'fechada';
}

const CHARACTERS: { name: string; type: CharType }[] = [
  { name: 'Capitão Scruffy', type: 'scruffy' },
  { name: 'Barão Von Pork',   type: 'von_pork' },
  { name: 'Dama Raposa',      type: 'fox' },
  { name: 'Touro Bravo',      type: 'bull' },
  { name: 'Gato Mestre',      type: 'cat' }
];

const LIARS_ROOMS_KEY = 'sapecas_liars_rooms_v1';

// Helper to render detailed SVG characters with progressive bullet wounds
const renderCharacterAvatar = (charType: CharType, wounds = 0, isLarge = false, isDead = false) => {
  const size = isLarge ? 110 : 54;
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
      <polygon points="40,2 26,18 54,18" fill="#1e1b4b" stroke="#f59e0b" stroke-width="${strokeW}"/>
      <ellipse cx="40" cy="38" rx="7" ry="5" fill="#0f172a"/>
      <line x1="33" y1="36" x2="20" y2="34" stroke="#fff" stroke-width="1.2"/>
      <line x1="33" y1="39" x2="19" y2="40" stroke="#fff" stroke-width="1.2"/>
      <line x1="47" y1="36" x2="60" y2="34" stroke="#fff" stroke-width="1.2"/>
      <line x1="47" y1="39" x2="61" y2="40" stroke="#fff" stroke-width="1.2"/>
    `;
  } else if (charType === 'von_pork') {
    headColor = '#fb7185';
    suitColor = '#312e81';
    earPath = '<polygon points="26,22 18,10 32,16" fill="#f43f5e" /><polygon points="54,22 62,10 48,16" fill="#f43f5e" />';
    features = `
      <ellipse cx="40" cy="38" rx="8" ry="6" fill="#f43f5e" stroke="#e11d48" stroke-width="${strokeW}"/>
      <circle cx="37" cy="38" r="2" fill="#881337"/>
      <circle cx="43" cy="38" r="2" fill="#881337"/>
      <circle cx="47" cy="27" r="6" fill="none" stroke="#fbbf24" stroke-width="1.5"/>
      <line x1="53" y1="27" x2="60" y2="45" stroke="#fbbf24" stroke-width="1"/>
    `;
  } else if (charType === 'fox') {
    headColor = '#ea580c';
    suitColor = '#14532d';
    earPath = '<polygon points="24,20 12,2 34,14" fill="#c2410c" /><polygon points="56,20 68,2 46,14" fill="#c2410c" />';
    features = `
      <polygon points="40,32 30,42 50,42" fill="#fed7aa"/>
      <polygon points="40,39 37,42 43,42" fill="#000"/>
    `;
  } else if (charType === 'bull') {
    headColor = '#78350f';
    suitColor = '#450a0a';
    earPath = `
      <path d="M22,22 Q8,12 16,2 Q24,14 26,22" fill="#fef08a" stroke="#ca8a04" stroke-width="${strokeW}"/>
      <path d="M58,22 Q72,12 64,2 Q56,14 54,22" fill="#fef08a" stroke="#ca8a04" stroke-width="${strokeW}"/>
    `;
    features = `
      <ellipse cx="40" cy="40" rx="10" ry="6" fill="#451a03"/>
      <circle cx="40" cy="45" r="4" fill="none" stroke="#fbbf24" stroke-width="1.8"/>
    `;
  } else {
    // Cat
    headColor = '#e2e8f0';
    suitColor = '#1e293b';
    earPath = '<polygon points="26,20 18,6 34,14" fill="#cbd5e1" /><polygon points="54,20 62,6 46,14" fill="#cbd5e1" />';
    features = `
      <polygon points="40,36 37,39 43,39" fill="#f43f5e"/>
      <line x1="33" y1="36" x2="18" y2="34" stroke="#94a3b8" stroke-width="1.2"/>
      <line x1="33" y1="39" x2="17" y2="40" stroke="#94a3b8" stroke-width="1.2"/>
      <line x1="47" y1="36" x2="62" y2="34" stroke="#94a3b8" stroke-width="1.2"/>
      <line x1="47" y1="39" x2="63" y2="40" stroke="#94a3b8" stroke-width="1.2"/>
    `;
  }

  // Eyes (normal, wounded, or dead)
  let eyesHtml = '';
  if (isDead) {
    eyesHtml = `
      <line x1="30" y1="24" x2="36" y2="30" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="36" y1="24" x2="30" y2="30" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="44" y1="24" x2="50" y2="30" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="50" y1="24" x2="44" y2="30" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>
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
  const [gameState, setGameState] = useState<'ROOMS_LOBBY' | 'WAITING' | 'PLAYING' | 'REVEAL' | 'ROULETTE' | 'GAME_OVER'>('ROOMS_LOBBY');
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

  // Multiplayer Rooms state
  const [rooms, setRooms] = useState<LiarsRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<LiarsRoom | null>(null);
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // Russian Roulette state
  const [rouletteVictimIdx, setRouletteVictimIdx] = useState<number | null>(null);
  const [rouletteChambers, setRouletteChambers] = useState<number>(3);
  const [rouletteSpinning, setRouletteSpinning] = useState<boolean>(false);
  const [rouletteMessage, setRouletteMessage] = useState<string>('');
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  // Load rooms from localStorage on mount
  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = () => {
    try {
      const raw = localStorage.getItem(LIARS_ROOMS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRooms(parsed);
          return;
        }
      }
    } catch {}

    const defaultRooms: LiarsRoom[] = [
      {
        id: 'liars-1',
        name: 'Taverna dos Blefadores VIP',
        host: 'Barão da Noite',
        createdAt: Date.now() - 3600000,
        maxPlayers: 5,
        playerNames: ['Barão da Noite', 'Dama de Ouro'],
        status: 'aberta'
      },
      {
        id: 'liars-2',
        name: 'Mesa da Roleta Imperial',
        host: 'Capitão Blefe',
        createdAt: Date.now() - 1800000,
        maxPlayers: 5,
        playerNames: ['Capitão Blefe'],
        status: 'aberta'
      }
    ];
    setRooms(defaultRooms);
    localStorage.setItem(LIARS_ROOMS_KEY, JSON.stringify(defaultRooms));
  };

  const saveRooms = (newRooms: LiarsRoom[]) => {
    setRooms(newRooms);
    localStorage.setItem(LIARS_ROOMS_KEY, JSON.stringify(newRooms));
  };

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) return;
    const newRoom: LiarsRoom = {
      id: `liars-room-${Date.now()}`,
      name: newRoomName.trim(),
      host: username,
      createdAt: Date.now(),
      maxPlayers: 5,
      playerNames: [username],
      status: 'aberta'
    };
    const updated = [newRoom, ...rooms];
    saveRooms(updated);
    setNewRoomName('');
    setShowCreateModal(false);
    handleJoinRoom(newRoom);
  };

  const handleJoinRoom = (room: LiarsRoom) => {
    soundManager.playClick();
    let currentNames = [...room.playerNames];
    if (!currentNames.includes(username) && currentNames.length < room.maxPlayers) {
      currentNames.push(username);
      room.playerNames = currentNames;
      saveRooms(rooms.map(r => r.id === room.id ? room : r));
    }
    setActiveRoom(room);

    // Build player models
    const seatedPlayers: Player[] = currentNames.map((pName, idx) => {
      const isMe = pName.toLowerCase() === username.toLowerCase();
      const char = CHARACTERS[idx % CHARACTERS.length];
      return {
        id: `p-${idx}`,
        name: pName,
        charType: char.type,
        isBot: !isMe,
        lives: 2,
        chambersRemaining: 3,
        chips: entryBet * 5,
        hand: [],
        isEliminated: false
      };
    });
    setPlayers(seatedPlayers);
    setGameState('WAITING');
  };

  const handleAddPlayerOrBot = () => {
    if (!activeRoom || activeRoom.playerNames.length >= 5) return;
    const botIdx = activeRoom.playerNames.length;
    const botName = CHARACTERS[botIdx % CHARACTERS.length].name;
    const updatedNames = [...activeRoom.playerNames, botName];
    activeRoom.playerNames = updatedNames;
    saveRooms(rooms.map(r => r.id === activeRoom.id ? activeRoom : r));

    const newPlayer: Player = {
      id: `p-${botIdx}`,
      name: botName,
      charType: CHARACTERS[botIdx % CHARACTERS.length].type,
      isBot: true,
      lives: 2,
      chambersRemaining: 3,
      chips: entryBet * 5,
      hand: [],
      isEliminated: false
    };
    setPlayers([...players, newPlayer]);
    soundManager.playChip();
  };

  // Host starts the game (Enabled ONLY when >= 2 players)
  const handleHostStartGame = () => {
    if (!activeRoom || players.length < 2) return;
    if (activeRoom.host.toLowerCase() !== username.toLowerCase()) {
      alert('Apenas o anfitrião da sala pode iniciar o jogo!');
      return;
    }
    if (balance < entryBet) {
      alert('Saldo insuficiente para entrar na partida!');
      return;
    }

    soundManager.playShuffle();
    onUpdateBalance(-entryBet, false, 'liars-bar', entryBet);

    // Update room status to em-andamento
    activeRoom.status = 'em-andamento';
    saveRooms(rooms.map(r => r.id === activeRoom.id ? activeRoom : r));

    dealNewRound(players, 0);
    setGameState('PLAYING');
  };

  // Quick solo game
  const handleStartSoloGame = () => {
    const soloRoom: LiarsRoom = {
      id: `solo-${Date.now()}`,
      name: 'Mesa Solo Contra Bots',
      host: username,
      createdAt: Date.now(),
      maxPlayers: 5,
      playerNames: [username, 'Capitão Scruffy', 'Barão Von Pork'],
      status: 'em-andamento'
    };
    setActiveRoom(soloRoom);

    const soloPlayers: Player[] = [
      {
        id: 'p-0',
        name: username,
        charType: 'scruffy',
        isBot: false,
        lives: 2,
        chambersRemaining: 3,
        chips: entryBet * 3,
        hand: [],
        isEliminated: false
      },
      {
        id: 'p-1',
        name: 'Capitão Scruffy',
        charType: 'cat',
        isBot: true,
        lives: 2,
        chambersRemaining: 3,
        chips: entryBet * 3,
        hand: [],
        isEliminated: false
      },
      {
        id: 'p-2',
        name: 'Barão Von Pork',
        charType: 'von_pork',
        isBot: true,
        lives: 2,
        chambersRemaining: 3,
        chips: entryBet * 3,
        hand: [],
        isEliminated: false
      }
    ];

    if (balance < entryBet) {
      alert('Saldo insuficiente!');
      return;
    }
    onUpdateBalance(-entryBet, false, 'liars-bar', entryBet);
    setPlayers(soloPlayers);
    dealNewRound(soloPlayers, 0);
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

  // Human player plays cards (Declarar)
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
    advanceTurn(currentTurnIdx, updatedPlayers);
  };

  // Advance turn to next alive player
  const advanceTurn = (fromIdx: number, currentPlayers: Player[]) => {
    let nextIdx = (fromIdx + 1) % currentPlayers.length;
    let attempts = 0;
    while ((currentPlayers[nextIdx].isEliminated || currentPlayers[nextIdx].lives <= 0) && attempts < currentPlayers.length) {
      nextIdx = (nextIdx + 1) % currentPlayers.length;
      attempts++;
    }
    setCurrentTurnIdx(nextIdx);

    // If next player is bot, trigger bot logic
    if (currentPlayers[nextIdx].isBot && !currentPlayers[nextIdx].isEliminated) {
      setTimeout(() => botTurn(nextIdx, currentPlayers), 1500);
    }
  };

  // Bot Turn Logic
  const botTurn = (botIdx: number, currentPlayers: Player[]) => {
    const bot = currentPlayers[botIdx];
    if (bot.isEliminated || bot.lives <= 0) return;

    // Decide whether to challenge (Duvidar)
    if (lastPlay && lastPlay.playerIdx !== botIdx) {
      const bluffProbability = lastPlay.claimedCount === 3 ? 0.65 : lastPlay.claimedCount === 2 ? 0.4 : 0.2;
      if (Math.random() < bluffProbability) {
        handleChallenge(botIdx);
        return;
      }
    }

    // Play cards (Declarar)
    const matching = bot.hand.filter((c) => c.type === tableTarget || c.type === 'DEVIL');
    let cardsToPlay: LiarsCard[] = [];

    if (matching.length > 0 && Math.random() > 0.3) {
      cardsToPlay = matching.slice(0, Math.min(matching.length, Math.floor(Math.random() * 2) + 1));
    } else {
      const nonMatching = bot.hand.filter((c) => c.type !== tableTarget && c.type !== 'DEVIL');
      const pool = nonMatching.length > 0 ? nonMatching : bot.hand;
      cardsToPlay = pool.slice(0, Math.min(pool.length, Math.floor(Math.random() * 2) + 1));
    }

    if (cardsToPlay.length === 0) {
      cardsToPlay = bot.hand.slice(0, 1);
    }

    const cardIds = cardsToPlay.map((c) => c.id);
    const newHand = bot.hand.filter((c) => !cardIds.includes(c.id));

    soundManager.playCardDeal();
    const updated = [...currentPlayers];
    updated[botIdx].hand = newHand;
    setPlayers(updated);

    setLastPlay({
      playerIdx: botIdx,
      cards: cardsToPlay,
      claimedCount: cardsToPlay.length,
      target: tableTarget
    });

    advanceTurn(botIdx, updated);
  };

  // Challenge (Duvidar)
  const handleChallenge = (challengerIdx: number) => {
    if (!lastPlay) return;
    setGameState('REVEAL');
    soundManager.playClick();
    incrementMissionCounter('liars_bluffs', 1);

    const accusedIdx = lastPlay.playerIdx;
    const cards = lastPlay.cards;
    const wasBluff = cards.some((c) => c.type !== lastPlay.target && c.type !== 'DEVIL');

    setTimeout(() => {
      const loserIdx = wasBluff ? accusedIdx : challengerIdx;
      setRouletteVictimIdx(loserIdx);
      const victim = players[loserIdx];
      setRouletteChambers(victim.chambersRemaining || 3);
      setRouletteMessage(
        wasBluff
          ? `Mentiros desmascarado! ${players[accusedIdx].name} mentiu sobre as cartas!`
          : `Verdade comprovada! ${players[challengerIdx].name} duvidou errado!`
      );
      setGameState('ROULETTE');

      // If victim is bot, automatically pull trigger
      if (victim.isBot) {
        setTimeout(() => triggerRussianRoulette(loserIdx), 1800);
      }
    }, 2200);
  };

  // Pull Russian Roulette Trigger (Atirar)
  const handlePullTrigger = () => {
    if (rouletteVictimIdx === null || rouletteSpinning) return;
    triggerRussianRoulette(rouletteVictimIdx);
  };

  const triggerRussianRoulette = (victimIdx: number) => {
    setRouletteSpinning(true);
    soundManager.playClick();

    setTimeout(() => {
      const victim = players[victimIdx];
      const remaining = victim.chambersRemaining || 3;
      // 1 bullet in remaining chambers
      const isBullet = Math.random() < 1 / remaining;

      if (isBullet) {
        // BANG! Bullet hits
        soundManager.playWin(); // loud dramatic sound
        const newLives = Math.max(0, victim.lives - 1);
        const isDead = newLives <= 0;

        setRouletteMessage(`💥 BANG! ${victim.name} tomou um tiro no peito! (-1 Vida)`);
        setRouletteChambers(3);

        const updated = [...players];
        updated[victimIdx] = {
          ...victim,
          lives: newLives,
          chambersRemaining: 3,
          isEliminated: isDead
        };
        setPlayers(updated);

        setTimeout(() => {
          setRouletteSpinning(false);
          checkGameOverOrNextRound(updated, victimIdx);
        }, 2200);
      } else {
        // CLICK! Empty chamber
        soundManager.playClick();
        const nextChambers = remaining - 1;
        setRouletteMessage(`*CLICK!* A câmara estava vazia! ${victim.name} sobreviveu! (${nextChambers} câmaras restando)`);
        setRouletteChambers(nextChambers);

        const updated = [...players];
        updated[victimIdx] = {
          ...victim,
          chambersRemaining: Math.max(1, nextChambers)
        };
        setPlayers(updated);

        setTimeout(() => {
          setRouletteSpinning(false);
          setGameState('PLAYING');
          dealNewRound(updated, (victimIdx + 1) % updated.length);
        }, 1800);
      }
    }, 1200);
  };

  const checkGameOverOrNextRound = (currentPlayers: Player[], lastVictimIdx: number) => {
    const alive = currentPlayers.filter((p) => !p.isEliminated && p.lives > 0);

    if (alive.length <= 1) {
      setGameState('GAME_OVER');
      const winner = alive[0] || currentPlayers[0];
      if (!winner.isBot) {
        fireConfetti();
        const potWon = entryBet * currentPlayers.length * 2;
        onUpdateBalance(potWon, true, 'liars-bar');
      }
      if (activeRoom) {
        activeRoom.status = 'fechada';
        saveRooms(rooms.map(r => r.id === activeRoom.id ? activeRoom : r));
      }
    } else {
      setGameState('PLAYING');
      dealNewRound(currentPlayers, (lastVictimIdx + 1) % currentPlayers.length);
    }
  };

  const humanPlayer = players.find(p => p.name.toLowerCase() === username.toLowerCase()) || players[0];
  const isHumanTurn = players[currentTurnIdx]?.id === humanPlayer?.id && !humanPlayer?.isEliminated && (humanPlayer?.lives || 0) > 0;
  const isHumanEliminated = humanPlayer?.isEliminated || (humanPlayer?.lives || 0) <= 0;

  return (
    <div className="h-full w-full max-w-4xl mx-auto flex flex-col justify-between overflow-hidden animate-fade-in text-orange-100 p-1 sm:p-2 select-none">
      {/* Top Header Bar */}
      <div className="shrink-0 flex items-center justify-between px-2 py-0.5">
        <button
          onClick={() => {
            if (gameState === 'ROOMS_LOBBY') {
              onBackToLobby();
            } else {
              setGameState('ROOMS_LOBBY');
              setActiveRoom(null);
            }
          }}
          className="btn-dark flex items-center gap-1.5 text-xs py-1.5 px-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{gameState === 'ROOMS_LOBBY' ? 'Voltar ao Cassino' : 'Salas do Bar'}</span>
        </button>

        <div className="text-center">
          <div className="font-cinzel text-sm sm:text-base font-black text-amber-300 flex items-center justify-center gap-1.5">
            <Skull className="w-4 h-4 text-red-500" />
            <span>LIAR&apos;S BAR · MULTIPLAYER &amp; ROLETA RUSSA</span>
          </div>
          <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block">
            {gameState === 'PLAYING'
              ? `Mesa Exige: ${tableTarget === 'A' ? 'Áses (A)' : tableTarget === 'K' ? 'Reis (K)' : 'Damas (Q)'} 👑 (Diabo 😈 é Coringa)`
              : gameState === 'WAITING'
              ? 'Sala de Espera · Aguardando Iniciar'
              : 'Salas Multiplayer (Até 5 Jogadores) · 2 Vidas · 3 Câmaras'}
          </span>
        </div>

        <button onClick={() => setShowHowToPlay(true)} className="btn-dark flex items-center gap-1 text-xs py-1.5 px-3">
          <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Como Jogar</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* 1. ROOMS LOBBY SCREEN (TELA DE SALAS) */}
      {/* ==================================================== */}
      {gameState === 'ROOMS_LOBBY' && (
        <div className="casino-felt casino-wood-border rounded-2xl flex-1 min-h-0 flex flex-col justify-between p-3 sm:p-4 my-1 overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between border-b border-orange-500/30 pb-2">
            <div>
              <h2 className="font-cinzel text-base sm:text-lg font-black text-amber-300">
                Salas de Liar&apos;s Bar (Até 5 Jogadores)
              </h2>
              <span className="text-xs text-orange-200/80">
                Crie sua taverna ou entre em uma mesa existente sincronizada via Supabase Realtime!
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleStartSoloGame}
                className="btn-dark text-xs py-1.5 px-3 border-amber-500/50 text-amber-300"
              >
                Mesa Rápida (Solo) ⚡
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-gold text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar Sala 😈</span>
              </button>
            </div>
          </div>

          {/* Rooms List */}
          <div className="flex-1 overflow-y-auto my-2 space-y-2 pr-1">
            {rooms.length === 0 ? (
              <div className="text-center py-10 text-orange-300/60 font-cinzel text-sm">
                Nenhuma taverna aberta no momento. Crie a primeira mesa de blefe!
              </div>
            ) : (
              rooms.map((room) => {
                const isFull = room.playerNames.length >= room.maxPlayers;
                const isInside = room.playerNames.some(p => p.toLowerCase() === username.toLowerCase());
                return (
                  <div
                    key={room.id}
                    className="p-3 rounded-xl bg-[#250d09] border border-orange-500/30 flex items-center justify-between hover:border-amber-400 transition-all shadow-md"
                  >
                    <div>
                      <div className="font-cinzel font-black text-sm text-white flex items-center gap-2">
                        <span>{room.name}</span>
                        {room.status === 'em-andamento' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                            EM ANDAMENTO
                          </span>
                        )}
                        {room.status === 'aberta' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            ABERTA
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-orange-200/70 mt-1 flex items-center gap-3">
                        <span>Host: <strong className="text-amber-400">{room.host}</strong></span>
                        <span>·</span>
                        <span>Jogadores: <strong className="text-emerald-400">{room.playerNames.length}/{room.maxPlayers}</strong></span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleJoinRoom(room)}
                      disabled={isFull && !isInside}
                      className="btn-gold py-1.5 px-4 text-xs font-bold"
                    >
                      {isInside ? 'Retornar à Sala 😈' : isFull ? 'Sala Lotada' : 'Entrar na Sala 🃏'}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Create Room Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-sm rounded-2xl bg-[#1c0805] border-2 border-amber-500 p-4 text-orange-100 shadow-2xl">
                <h3 className="font-cinzel text-base font-black text-amber-300 mb-2">Criar Sala do Liar&apos;s Bar</h3>
                <p className="text-xs text-orange-200/80 mb-3">
                  Defina o nome da taverna (limite de 5 jogadores). Como anfitrião, você iniciará o jogo quando os jogadores estiverem prontos!
                </p>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Ex: Taverna dos Blefadores VIP"
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-orange-500/40 text-xs text-white mb-4 focus:outline-none focus:border-amber-400"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="btn-dark text-xs py-1.5 px-3"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateRoom}
                    disabled={!newRoomName.trim()}
                    className="btn-gold text-xs py-1.5 px-4 font-bold"
                  >
                    Criar Sala 🚀
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="text-[11px] text-orange-300/70 text-center border-t border-orange-500/20 pt-2">
            Regra: 2 vidas por jogador · Revólver de 3 câmaras · O último sobrevivente leva o pote inteiro!
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. WAITING ROOM SCREEN (SALA DE ESPERA) */}
      {/* ==================================================== */}
      {gameState === 'WAITING' && activeRoom && (
        <div className="casino-felt casino-wood-border rounded-2xl flex-1 min-h-0 flex flex-col justify-between p-3 sm:p-4 my-1 overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between border-b border-orange-500/30 pb-2">
            <div>
              <h2 className="font-cinzel text-base sm:text-lg font-black text-amber-300">
                {activeRoom.name}
              </h2>
              <span className="text-xs text-emerald-400 font-bold">
                Sala Aberta ({players.length}/{activeRoom.maxPlayers} Jogadores Conectados)
              </span>
            </div>

            {players.length < activeRoom.maxPlayers && (
              <button
                onClick={handleAddPlayerOrBot}
                className="btn-dark text-xs py-1 px-3 border-amber-500/50 text-amber-300 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Convidar Bot 🤖</span>
              </button>
            )}
          </div>

          {/* Seated Players in Waiting Room */}
          <div className="flex-1 flex flex-col justify-center items-center py-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 max-w-xl w-full">
              {players.map((p, idx) => {
                const isHost = p.name.toLowerCase() === activeRoom.host.toLowerCase();
                const isMe = p.name.toLowerCase() === username.toLowerCase();
                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-xl border flex flex-col items-center text-center shadow-lg ${
                      isHost
                        ? 'bg-[#3a1209] border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        : 'bg-[#180705] border-orange-500/30'
                    }`}
                  >
                    {renderCharacterAvatar(p.charType, 0, false, false)}
                    <span className="font-cinzel font-bold text-xs text-white mt-2 truncate w-full">
                      {p.name} {isMe ? '(Você)' : ''}
                    </span>
                    <span className={`text-[10px] font-black uppercase mt-0.5 ${isHost ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {isHost ? '👑 Anfitrião' : '✅ Pronto'}
                    </span>
                  </div>
                );
              })}

              {Array.from({ length: Math.max(0, activeRoom.maxPlayers - players.length) }, (_, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl border border-dashed border-orange-500/25 bg-black/20 flex flex-col items-center justify-center text-center text-orange-300/40"
                >
                  <span className="text-2xl mb-1 opacity-40">🪑</span>
                  <span className="text-xs font-bold">Cadeira Vazia</span>
                  <span className="text-[10px]">Aguardando...</span>
                </div>
              ))}
            </div>
          </div>

          {/* Host Controls: Iniciar Jogo Button (Enabled ONLY when >= 2 players) */}
          <div className="border-t border-orange-500/30 pt-3 text-center">
            {activeRoom.host.toLowerCase() === username.toLowerCase() ? (
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={handleHostStartGame}
                  disabled={players.length < 2}
                  className="w-full max-w-md py-3 px-6 rounded-2xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 text-white font-cinzel font-black text-sm uppercase tracking-wider shadow-2xl border-2 border-yellow-300 active:scale-98 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
                >
                  {players.length >= 2
                    ? `INICIAR JOGO 🚀 (${players.length} Jogadores Prontos)`
                    : 'AGUARDANDO MÍNIMO DE 2 JOGADORES... ⏳'}
                </button>
                <span className="text-[11px] text-orange-200/70">
                  {players.length >= 2
                    ? 'Clique para distribuir as 5 cartas e dar início à partida!'
                    : 'Convide mais um jogador ou clique em "+ Convidar Bot 🤖" para começar.'}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-xs text-amber-300 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>
                  Aguardando o anfitrião ({activeRoom.host}) clicar em &quot;Iniciar Jogo&quot;... ({players.length}/5 prontos)
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. ACTIVE PLAYING & REVEAL ARENA */}
      {/* ==================================================== */}
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
              <span className="text-[8px] uppercase font-bold text-orange-400 block leading-tight">Última Declaração</span>
              <span className="text-[11px] font-bold text-orange-200 leading-tight">
                {lastPlay
                  ? `${players[lastPlay.playerIdx]?.name}: ${lastPlay.claimedCount} carta(s)`
                  : 'Início da Rodada'}
              </span>
            </div>
          </div>

          {/* Opponents Seats with SVG Characters & Wounds */}
          <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-1.5 my-1">
            {players.filter(p => p.id !== humanPlayer?.id).map((p) => {
              const isCurrent = players[currentTurnIdx]?.id === p.id;
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
                  <div className="text-[11px] font-bold text-white truncate font-cinzel mt-1 max-w-[100px]">{p.name}</div>
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
                    {p.isEliminated ? 'Eliminado' : `${p.hand.length} Cartas · (${p.chambersRemaining}/3 Câm.)`}
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
                  Cartas Declaradas na Mesa ({lastPlay.claimedCount}x {lastPlay.target}):
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
                A mesa aguarda a primeira declaração da rodada...
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
                    disabled={gameState !== 'PLAYING' || !isHumanTurn || isHumanEliminated}
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

      {/* ==================================================== */}
      {/* 4. RUSSIAN ROULETTE OVERLAY MODAL */}
      {/* ==================================================== */}
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
            disabled={rouletteSpinning || players[rouletteVictimIdx]?.id !== humanPlayer?.id}
            className="w-full max-w-xs py-3 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-cinzel font-black text-sm uppercase tracking-wider shadow-2xl border-2 border-red-300 active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {rouletteSpinning
              ? 'DISPARANDO... 🎯'
              : players[rouletteVictimIdx]?.id === humanPlayer?.id
              ? 'PUXAR O GATILHO! 🎯 (ATIRAR)'
              : `Aguardando ${players[rouletteVictimIdx]?.name} atirar... 🎯`}
          </button>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. GAME OVER SCREEN */}
      {/* ==================================================== */}
      {gameState === 'GAME_OVER' && (
        <div className="casino-felt casino-wood-border rounded-2xl flex-1 min-h-0 flex flex-col items-center justify-center p-3 sm:p-4 text-center my-1 overflow-hidden shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-3xl shadow-xl border-2 border-yellow-200 mb-2">
            👑
          </div>
          <h2 className="font-cinzel text-xl sm:text-2xl font-black text-amber-300">
            FIM DA PARTIDA!
          </h2>
          <p className="text-xs text-orange-200/90 max-w-md mt-1 mb-4">
            A taverna testemunhou o confronto de blefes e o sobrevivente supremo do Liar&apos;s Bar foi coroado!
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setGameState('ROOMS_LOBBY');
                setActiveRoom(null);
              }}
              className="btn-dark py-2 px-5 text-xs font-bold"
            >
              Voltar às Salas 📋
            </button>
            <button
              onClick={handleStartSoloGame}
              className="btn-gold py-2 px-5 text-xs font-bold"
            >
              Jogar Novamente 🔄
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ACTION CONTROLS FOOTER (DECLARAR, DUVIDAR, COMO JOGAR) */}
      {/* ==================================================== */}
      {(gameState === 'PLAYING' || gameState === 'REVEAL') && (
        <div className="shrink-0 flex items-center gap-2 pt-1">
          {lastPlay && lastPlay.playerIdx !== currentTurnIdx && (
            <button
              type="button"
              disabled={gameState !== 'PLAYING' || !isHumanTurn || isHumanEliminated}
              onClick={() => handleChallenge(0)}
              className="flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:brightness-110 text-white font-cinzel font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg border border-red-400 active:scale-98 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Skull className="w-4 h-4" />
              <span>DUVIDAR! (LIAR!) 🚨</span>
            </button>
          )}

          <button
            type="button"
            disabled={
              gameState !== 'PLAYING' ||
              !isHumanTurn ||
              selectedCardIds.length === 0 ||
              isHumanEliminated
            }
            onClick={handlePlayCards}
            className="flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-slate-950 font-cinzel font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg border border-yellow-300 active:scale-98 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>DECLARAR CARTAS ({selectedCardIds.length}) 🃏</span>
          </button>
        </div>
      )}

      {/* How to play modal */}
      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        title="Como Jogar: Liar's Bar com Roleta Russa"
        rules={[
          "Salas & Multiplayer: O anfitrião cria a sala e aguarda os participantes. A partida só inicia quando o criador clicar em 'Iniciar Jogo' (mínimo de 2 jogadores).",
          "Objetivo: Blefe e sobreviva à Roleta Russa! Cada jogador começa com 2 vidas.",
          "Mesa Exige uma Figura: Áses (A), Reis (K) ou Damas (Q). O Diabo (😈) é a carta coringa universal.",
          "Na sua vez: Jogue de 1 a 3 cartas fechadas na mesa alegando serem da figura exigida (mesmo que esteja mentindo!).",
          "Duvidar (Liar!): O próximo jogador pode aceitar a jogada ou DUVIDAR. Se duvidar, as cartas são reveladas.",
          "Roleta Russa (3 Câmaras): Se o acusado mentiu, ele encara o revólver. Se falou a verdade, o acusador encara o revólver!",
          "Disparo do Revólver: O tambor possui 3 câmaras e 1 bala carregada. Tiros vazios eliminam a câmara (3 -> 2 -> 1, sendo a 3ª câmara bala garantida!).",
          "Ao tomar um tiro: O jogador perde 1 vida e marcas de ferimento de bala aparecem no peito.",
          "Modo Espectador: Ao perder as 2 vidas, o jogador é eliminado mas continua assistindo à partida até o último vencedor ser coroado!"
        ]}
      />
    </div>
  );
};
'''

with open('src/games/LiarsBarGame.tsx', 'w', encoding='utf-8') as f:
    f.write(new_code)

print("Successfully updated src/games/LiarsBarGame.tsx with full room lobby and waiting room flow!")
