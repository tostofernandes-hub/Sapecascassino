import React, { useState, useEffect, useRef } from 'react';
import { Card, UserAccount } from '../types/casino';
import { createDeck, shuffleDeck, evaluate7CardHand, comparePokerHands, DetailedPokerHand } from '../utils/cards';
import { soundManager } from '../utils/audio';
import { reportRoundLoss } from '../utils/luckyStreak';
import { PlayingCard } from '../components/PlayingCard';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { CardVictoryModal } from '../components/CardVictoryModal';
import { ChipSelector } from '../components/ChipSelector';
import { getStoredAccounts, saveStoredAccounts } from '../utils/auth';
import { 
  ArrowLeft, 
  Play, 
  HelpCircle, 
  Check, 
  ArrowUpRight, 
  XCircle, 
  Users, 
  Eye, 
  EyeOff, 
  Plus, 
  DoorOpen
} from 'lucide-react';
import { auth } from '../firebase';
import { getCurrentUser } from '../utils/auth';
import {
  connectRoomPresence,
  subscribeRoomRealtime,
  subscribeEstadoJogoRtdb,
  enviarJogadaRtdb,
  updateRoomTurnTimer,
  sendRoomChatMessage,
  PlayerPresence,
  RoomChatMessage,
  RoomTimerState,
  RtdbEstadoJogo
} from '../utils/rtdbRoom';
import { RoomChatAndPresence } from '../components/RoomChatAndPresence';

interface TexasHoldemGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'texas-holdem', betAmount?: number) => void;
  onBackToLobby: () => void;
}

type HoldemMode = 'SOLO' | 'MULTIPLAYER';
type SoloStage = 'BETTING' | 'FLOP_ROUND' | 'TURN_ROUND' | 'SHOWDOWN';

interface PokerRoom {
  id: string;
  name: string;
  host: string;
  createdAt: number;
  playerNames: string[];
}

interface TablePlayer {
  username: string;
  chips: number;
  holeCards: Card[];
  currentStreetBet: number;
  totalRoundBet: number;
  folded: boolean;
  isAllIn: boolean;
  isDealer: boolean;
  handResult?: DetailedPokerHand;
}

const ROOMS_KEY = 'sapecas_poker_rooms_v1';

export const TexasHoldemGame: React.FC<TexasHoldemGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby
}) => {
  const [gameMode, setGameMode] = useState<HoldemMode>('SOLO');
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  // ---------------- SOLO MODE (No-Limit) ----------------
  const [soloAnte, setSoloAnte] = useState<number>(50);
  const [soloRaiseInput, setSoloRaiseInput] = useState<number>(100);
  const [soloPot, setSoloPot] = useState<number>(0);
  const [soloStage, setSoloStage] = useState<SoloStage>('BETTING');
  const [soloPlayerCards, setSoloPlayerCards] = useState<Card[]>([]);
  const [soloDealerCards, setSoloDealerCards] = useState<Card[]>([]);
  const [soloCommunityCards, setSoloCommunityCards] = useState<Card[]>([]);
  const [soloRevealedCount, setSoloRevealedCount] = useState<number>(0);
  const [soloPlayerTotalBet, setSoloPlayerTotalBet] = useState<number>(0);
  const [soloOutcome, setSoloOutcome] = useState<'WIN' | 'LOSS' | 'TIE' | 'FOLD' | null>(null);
  const [soloOutcomeMsg, setSoloOutcomeMsg] = useState<string>('');
  const [soloPlayerResult, setSoloPlayerResult] = useState<DetailedPokerHand | null>(null);
  const [soloDealerResult, setSoloDealerResult] = useState<DetailedPokerHand | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [victoryModal, setVictoryModal] = useState<{ winAmount: number; subtitle: string; detail: string } | null>(null);
  const victoryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (victoryTimerRef.current) window.clearTimeout(victoryTimerRef.current);
    };
  }, []);

  const scheduleVictoryModal = (winAmount: number, subtitle: string, detail: string, delayMs: number) => {
    if (victoryTimerRef.current) window.clearTimeout(victoryTimerRef.current);
    victoryTimerRef.current = window.setTimeout(() => {
      setVictoryModal({ winAmount, subtitle, detail });
    }, delayMs);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((prev) => (prev === msg ? null : prev)), 3500);
  };

  // ---------------- MULTIPLAYER ROOMS STATE ----------------
  const [rooms, setRooms] = useState<PokerRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<PokerRoom | null>(null);
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [tablePlayers, setTablePlayers] = useState<TablePlayer[]>([]);
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);
  const [multiStage, setMultiStage] = useState<'WAITING' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN'>('WAITING');
  const [multiCommunityCards, setMultiCommunityCards] = useState<Card[]>([]);
  const [multiRevealedCount, setMultiRevealedCount] = useState<number>(0);
  const [multiPot, setMultiPot] = useState<number>(0);
  const [currentHighestBet, setCurrentHighestBet] = useState<number>(0);
  const [peekHoleCards, setPeekHoleCards] = useState<boolean>(false);
  const [multiRaiseAmount, setMultiRaiseAmount] = useState<number>(100);
  const [multiWinnerMsg, setMultiWinnerMsg] = useState<string>('');
  const [selectedUserToJoin, setSelectedUserToJoin] = useState<string>('');
  const [rtdbPresence, setRtdbPresence] = useState<Record<string, PlayerPresence>>({});
  const [rtdbChat, setRtdbChat] = useState<RoomChatMessage[]>([]);
  const [rtdbTimer, setRtdbTimer] = useState<RoomTimerState | null>(null);
  const [rtdbEstadoLive, setRtdbEstadoLive] = useState<RtdbEstadoJogo | null>(null);
  const [myReady, setMyReady] = useState<boolean>(false);
  const presenceHandleRef = useRef<{ setReady: (pronto: boolean) => Promise<void>; disconnect: () => Promise<void> } | null>(null);

  const pokerUser = getCurrentUser();
  const pokerUid = auth.currentUser?.uid || pokerUser?.uid || pokerUser?.username || 'jogador';
  const pokerPlayerName = pokerUser?.nickname || pokerUser?.username || auth.currentUser?.displayName || 'Jogador';

  useEffect(() => {
    if (gameMode !== 'MULTIPLAYER' || !activeRoom?.id || !auth.currentUser?.uid) {
      setRtdbPresence({});
      setRtdbChat([]);
      setRtdbTimer(null);
      setRtdbEstadoLive(null);
      setMyReady(false);
      return;
    }

    const presence = connectRoomPresence(activeRoom.id, auth.currentUser.uid, pokerPlayerName);
    presenceHandleRef.current = presence;

    const unsubRtdb = subscribeRoomRealtime(activeRoom.id, (snap) => {
      setRtdbPresence(snap.statusJogadores);
      setRtdbChat(snap.chat);
      setRtdbTimer(snap.timer);
    });

    const unsubEstado = subscribeEstadoJogoRtdb(activeRoom.id, (estadoAtual) => {
      setRtdbEstadoLive(estadoAtual);
    });

    return () => {
      unsubRtdb();
      unsubEstado();
      void presence.disconnect();
      presenceHandleRef.current = null;
    };
  }, [gameMode, activeRoom?.id, pokerPlayerName]);

  // Load rooms from localStorage
  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = () => {
    try {
      const raw = localStorage.getItem(ROOMS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRooms(parsed);
          return;
        }
      }
    } catch {}

    // Default room
    const defaultRoom: PokerRoom = {
      id: 'room-1',
      name: 'Mesa VIP dos Campeões',
      host: 'Admin',
      createdAt: Date.now(),
      playerNames: []
    };
    setRooms([defaultRoom]);
    localStorage.setItem(ROOMS_KEY, JSON.stringify([defaultRoom]));
  };

  const saveRooms = (newRooms: PokerRoom[]) => {
    setRooms(newRooms);
    localStorage.setItem(ROOMS_KEY, JSON.stringify(newRooms));
  };

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) return;
    const accounts = getStoredAccounts();
    const hostName = accounts[0]?.username || 'Jogador';

    const newRoom: PokerRoom = {
      id: `poker-room-${Date.now()}`,
      name: newRoomName.trim(),
      host: hostName,
      createdAt: Date.now(),
      playerNames: [hostName]
    };

    const updated = [newRoom, ...rooms];
    saveRooms(updated);
    setNewRoomName('');
    handleJoinRoom(newRoom);
  };

  const handleJoinRoom = (room: PokerRoom) => {
    setActiveRoom(room);
    setMultiStage('WAITING');
    setMultiWinnerMsg('');
    soundManager.playClick();

    // Populate seated players from registered accounts
    const allAccounts = getStoredAccounts();
    let seatedNames = room.playerNames;

    // If room is empty, seat up to 4 available registered accounts
    if (seatedNames.length < 2 && allAccounts.length >= 2) {
      seatedNames = allAccounts.slice(0, 4).map(a => a.username);
      room.playerNames = seatedNames;
      saveRooms(rooms.map(r => r.id === room.id ? room : r));
    }

    const seated: TablePlayer[] = seatedNames.map((name, idx) => {
      const acc = allAccounts.find(a => a.username.toLowerCase() === name.toLowerCase());
      return {
        username: name,
        chips: acc ? Math.max(100, acc.balance) : 10000,
        holeCards: [],
        currentStreetBet: 0,
        totalRoundBet: 0,
        folded: false,
        isAllIn: false,
        isDealer: idx === 0
      };
    });

    setTablePlayers(seated);
  };

  const handleAddPlayerToRoom = () => {
    if (!selectedUserToJoin || !activeRoom) return;
    if (tablePlayers.some(p => p.username.toLowerCase() === selectedUserToJoin.toLowerCase())) {
      showToast('Este jogador já está sentado na mesa!');
      return;
    }
    if (tablePlayers.length >= 8) {
      showToast('A mesa já atingiu a capacidade máxima de 8 jogadores!');
      return;
    }

    const allAccounts = getStoredAccounts();
    const acc = allAccounts.find(a => a.username.toLowerCase() === selectedUserToJoin.toLowerCase());

    const newPlayer: TablePlayer = {
      username: selectedUserToJoin,
      chips: acc ? Math.max(100, acc.balance) : 10000,
      holeCards: [],
      currentStreetBet: 0,
      totalRoundBet: 0,
      folded: false,
      isAllIn: false,
      isDealer: false
    };

    const nextPlayers = [...tablePlayers, newPlayer];
    setTablePlayers(nextPlayers);

    // Update room
    activeRoom.playerNames = nextPlayers.map(p => p.username);
    saveRooms(rooms.map(r => r.id === activeRoom.id ? activeRoom : r));
    setSelectedUserToJoin('');
    soundManager.playChip();
  };

  const startNewMultiplayerHand = () => {
    if (tablePlayers.length < 2) {
      showToast('São necessários pelo menos 2 jogadores para iniciar a mão!');
      return;
    }

    soundManager.playShuffle();
    const newDeck = shuffleDeck(createDeck());
    const bigBlind = 50;
    const smallBlind = 25;

    let pot = 0;
    const updated = tablePlayers.map((p, idx) => {
      const c1 = newDeck.pop()!;
      const c2 = newDeck.pop()!;
      let blind = 0;

      if (idx === 0) blind = Math.min(p.chips, smallBlind);
      else if (idx === 1) blind = Math.min(p.chips, bigBlind);

      pot += blind;

      return {
        ...p,
        chips: p.chips - blind,
        holeCards: [c1, c2],
        currentStreetBet: blind,
        totalRoundBet: blind,
        folded: false,
        isAllIn: p.chips <= blind,
        handResult: undefined
      };
    });

    const comm: Card[] = [
      newDeck.pop()!,
      newDeck.pop()!,
      newDeck.pop()!,
      newDeck.pop()!,
      newDeck.pop()!
    ];

    setMultiCommunityCards(comm);
    setMultiRevealedCount(0);
    setMultiPot(pot);
    setCurrentHighestBet(bigBlind);
    setTablePlayers(updated);
    const nextTurnIdx = updated.length > 2 ? 2 : 0;
    setActivePlayerIndex(nextTurnIdx);
    setMultiStage('PREFLOP');
    setMultiWinnerMsg('');
    setPeekHoleCards(false);
    setMultiRaiseAmount(bigBlind * 2);
    soundManager.playCardDeal();

    if (activeRoom?.id) {
      const nextTurnUser = updated[nextTurnIdx]?.username || '';
      void enviarJogadaRtdb(activeRoom.id, {
        apostaAtual: bigBlind,
        turnoAtual: nextTurnUser,
        status: 'PREFLOP',
        ultimaAcao: `Nova mão iniciada · Pote: ${pot}`
      });
      void updateRoomTurnTimer(activeRoom.id, nextTurnUser, 25);
    }
  };

  const handleMultiFold = () => {
    soundManager.playLoss();
    const updated = [...tablePlayers];
    const currName = updated[activePlayerIndex]?.username || 'Jogador';
    updated[activePlayerIndex].folded = true;
    setTablePlayers(updated);
    if (activeRoom?.id) {
      void enviarJogadaRtdb(activeRoom.id, {
        apostaAtual: currentHighestBet,
        ultimaAcao: `${currName} deu Fold`
      });
    }
    advanceMultiTurn(updated);
  };

  const handleMultiCallOrCheck = () => {
    soundManager.playClick();
    const updated = [...tablePlayers];
    const curr = updated[activePlayerIndex];
    const needed = currentHighestBet - curr.currentStreetBet;

    if (needed > 0) {
      const callAmt = Math.min(curr.chips, needed);
      curr.chips -= callAmt;
      curr.currentStreetBet += callAmt;
      curr.totalRoundBet += callAmt;
      if (curr.chips === 0) curr.isAllIn = true;
      setMultiPot(prev => prev + callAmt);
      soundManager.playChip();
    }

    if (activeRoom?.id) {
      void enviarJogadaRtdb(activeRoom.id, {
        apostaAtual: currentHighestBet,
        ultimaAcao: needed > 0 ? `${curr.username} pagou Call (${needed})` : `${curr.username} deu Check`
      });
    }

    advanceMultiTurn(updated);
  };

  const handleMultiRaise = () => {
    const updated = [...tablePlayers];
    const curr = updated[activePlayerIndex];
    if (!curr) return;
    if (multiRaiseAmount <= 0) {
      showToast('Adicione fichas ao Raise antes de apostar!');
      return;
    }
    if (multiRaiseAmount > curr.chips) {
      showToast(`Saldo insuficiente! ${curr.username} possui ${curr.chips.toLocaleString('pt-BR')} fichas.`);
      return;
    }
    const targetRaise = Math.min(curr.chips, multiRaiseAmount);

    soundManager.playChip();
    curr.chips -= targetRaise;
    curr.currentStreetBet += targetRaise;
    curr.totalRoundBet += targetRaise;
    if (curr.chips === 0) curr.isAllIn = true;

    const nextHighest = curr.currentStreetBet > currentHighestBet ? curr.currentStreetBet : currentHighestBet;
    if (curr.currentStreetBet > currentHighestBet) {
      setCurrentHighestBet(curr.currentStreetBet);
    }

    setMultiPot(prev => prev + targetRaise);
    if (activeRoom?.id) {
      void enviarJogadaRtdb(activeRoom.id, {
        apostaAtual: nextHighest,
        ultimaAcao: `${curr.username} deu Raise (+${targetRaise})`
      });
    }
    advanceMultiTurn(updated);
  };

  const advanceMultiTurn = (currentList: TablePlayer[]) => {
    const active = currentList.filter(p => !p.folded);

    if (active.length === 1) {
      const winner = active[0];
      winner.chips += multiPot;
      soundManager.playWin();
      setMultiWinnerMsg(`🏆 ${winner.username} venceu o pote de ${multiPot.toLocaleString('pt-BR')} fichas!`);
      setMultiStage('SHOWDOWN');
      persistMultiBalances(currentList);
      scheduleVictoryModal(multiPot, "TEXAS HOLD'EM MULTIPLAYER", `Vitória de ${winner.username} (Desistência)`, 350);
      return;
    }

    let nextIdx = (activePlayerIndex + 1) % currentList.length;
    let loops = 0;
    while ((currentList[nextIdx].folded || currentList[nextIdx].isAllIn) && loops < currentList.length) {
      nextIdx = (nextIdx + 1) % currentList.length;
      loops++;
    }

    const allMatched = active.every(p => p.isAllIn || p.currentStreetBet === currentHighestBet);

    if (allMatched && loops < currentList.length) {
      advanceMultiStreet(currentList);
    } else {
      setActivePlayerIndex(nextIdx);
      setPeekHoleCards(false);
      if (activeRoom?.id && currentList[nextIdx]) {
        const nextUser = currentList[nextIdx].username;
        void enviarJogadaRtdb(activeRoom.id, {
          turnoAtual: nextUser
        });
        void updateRoomTurnTimer(activeRoom.id, nextUser, 25);
      }
    }
  };

  const advanceMultiStreet = (currentList: TablePlayer[]) => {
    const resetList = currentList.map(p => ({ ...p, currentStreetBet: 0 }));
    setCurrentHighestBet(0);
    setActivePlayerIndex(0);
    setPeekHoleCards(false);

    if (multiStage === 'PREFLOP') {
      soundManager.playCardDeal();
      setMultiRevealedCount(3);
      setMultiStage('FLOP');
    } else if (multiStage === 'FLOP') {
      soundManager.playCardDeal();
      setMultiRevealedCount(4);
      setMultiStage('TURN');
    } else if (multiStage === 'TURN') {
      soundManager.playCardDeal();
      setMultiRevealedCount(5);
      setMultiStage('RIVER');
    } else if (multiStage === 'RIVER') {
      triggerMultiShowdown(resetList);
    }
  };

  const triggerMultiShowdown = (currentList: TablePlayer[]) => {
    setMultiStage('SHOWDOWN');
    setMultiRevealedCount(5);

    const evaluated = currentList.map(p => {
      if (p.folded) return p;
      const full7 = [...p.holeCards, ...multiCommunityCards];
      return { ...p, handResult: evaluate7CardHand(full7) };
    });

    const activeShowdown = evaluated.filter(p => !p.folded);
    activeShowdown.sort((a, b) => comparePokerHands(b.handResult!, a.handResult!));

    const winner = activeShowdown[0];
    winner.chips += multiPot;

    soundManager.playJackpot();
    setMultiWinnerMsg(`🎉 ${winner.username} venceu o pote com ${winner.handResult?.name}! (+${multiPot.toLocaleString('pt-BR')} fichas)`);
    setTablePlayers(evaluated);
    persistMultiBalances(evaluated);
    scheduleVictoryModal(multiPot, "TEXAS HOLD'EM MULTIPLAYER", `${winner.username} · ${winner.handResult?.name || ''}`, 950);
  };

  const persistMultiBalances = (finalList: TablePlayer[]) => {
    const accs = getStoredAccounts();
    finalList.forEach(p => {
      const match = accs.find(a => a.username.toLowerCase() === p.username.toLowerCase());
      if (match) match.balance = p.chips;
    });
    saveStoredAccounts(accs);
  };

  // ---------------- SOLO MODE HANDLERS (No-Limit) ----------------
  const handleSoloDeal = () => {
    if (soloAnte <= 0 || soloAnte > balance) return;

    if (victoryTimerRef.current) window.clearTimeout(victoryTimerRef.current);
    setVictoryModal(null);
    soundManager.playShuffle();
    onUpdateBalance(-soloAnte, false, 'texas-holdem');
    setSoloPlayerTotalBet(soloAnte);

    const newDeck = shuffleDeck(createDeck());
    const p1 = newDeck.pop()!;
    const p2 = newDeck.pop()!;
    const d1 = newDeck.pop()!;
    const d2 = newDeck.pop()!;

    const c1 = newDeck.pop()!;
    const c2 = newDeck.pop()!;
    const c3 = newDeck.pop()!;
    const c4 = newDeck.pop()!;
    const c5 = newDeck.pop()!;

    setSoloPlayerCards([p1, p2]);
    setSoloDealerCards([d1, d2]);
    setSoloCommunityCards([c1, c2, c3, c4, c5]);
    setSoloRevealedCount(3);
    setSoloPot(soloAnte * 2);
    setSoloOutcome(null);
    setSoloOutcomeMsg('');
    setSoloStage('FLOP_ROUND');
    setSoloRaiseInput(soloAnte * 2);

    soundManager.playCardDeal();
  };

  const handleSoloCall = () => {
    soundManager.playClick();
    if (soloStage === 'FLOP_ROUND') {
      soundManager.playCardDeal();
      setSoloRevealedCount(4);
      setSoloStage('TURN_ROUND');
    } else if (soloStage === 'TURN_ROUND') {
      soundManager.playCardDeal();
      setSoloRevealedCount(5);
      triggerSoloShowdown(soloPot);
    }
  };

  const handleSoloRaise = () => {
    if (soloRaiseInput <= 0) {
      showToast('Adicione fichas ao Raise antes de aumentar a aposta!');
      return;
    }
    if (soloRaiseInput > balance) {
      showToast(`Saldo insuficiente! Você possui ${balance.toLocaleString('pt-BR')} fichas.`);
      return;
    }
    const raiseAmount = soloRaiseInput;

    soundManager.playChip();
    onUpdateBalance(-raiseAmount, false, 'texas-holdem');
    const newTotalBet = soloPlayerTotalBet + raiseAmount;
    const newPot = soloPot + raiseAmount * 2;
    setSoloPlayerTotalBet(newTotalBet);
    setSoloPot(newPot);

    if (soloStage === 'FLOP_ROUND') {
      soundManager.playCardDeal();
      setSoloRevealedCount(4);
      setSoloStage('TURN_ROUND');
    } else if (soloStage === 'TURN_ROUND') {
      soundManager.playCardDeal();
      setSoloRevealedCount(5);
      triggerSoloShowdown(newPot);
    }
  };

  const handleSoloFold = () => {
    soundManager.playLoss();
    reportRoundLoss('texas-holdem');
    setSoloStage('SHOWDOWN');
    setSoloOutcome('FOLD');
    setSoloOutcomeMsg('Você deu Fold. A banca recolhe o pote.');
  };

  const triggerSoloShowdown = (finalPot: number) => {
    setSoloStage('SHOWDOWN');
    const pBest = evaluate7CardHand([...soloPlayerCards, ...soloCommunityCards]);
    const dBest = evaluate7CardHand([...soloDealerCards, ...soloCommunityCards]);
    setSoloPlayerResult(pBest);
    setSoloDealerResult(dBest);

    const cmp = comparePokerHands(pBest, dBest);
    if (cmp > 0) {
      soundManager.playWin();
      setSoloOutcome('WIN');
      setSoloOutcomeMsg(`Você venceu com ${pBest.name}! (+${finalPot.toLocaleString('pt-BR')} fichas)`);
      onUpdateBalance(finalPot, true, 'texas-holdem', soloPlayerTotalBet);
      scheduleVictoryModal(finalPot, "TEXAS HOLD'EM NO-LIMIT", `Mão Vencedora: ${pBest.name}`, 920);
    } else if (cmp < 0) {
      soundManager.playLoss();
      reportRoundLoss('texas-holdem');
      setSoloOutcome('LOSS');
      setSoloOutcomeMsg(`O Dealer venceu com ${dBest.name}.`);
    } else {
      soundManager.playClick();
      setSoloOutcome('TIE');
      setSoloOutcomeMsg(`Empate com ${pBest.name}! Pote dividido.`);
      onUpdateBalance(Math.floor(finalPot / 2), false, 'texas-holdem');
    }
  };

  const allRegisteredUsers = getStoredAccounts();

  return (
    <div className="space-y-2 max-w-5xl mx-auto animate-fade-in pb-1 relative">
      {toastMsg && (
        <div className="px-3 py-1.5 rounded-xl bg-amber-950/95 border border-amber-400/70 text-amber-200 text-xs font-bold text-center shadow-lg">
          {toastMsg}
        </div>
      )}
      {/* Top Header & Mode Toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Lobby</span>
        </button>

        {/* Mode Selector */}
        <div className="flex items-center p-1 rounded-xl bg-[#180705] border border-orange-500/30">
          <button
            onClick={() => setGameMode('SOLO')}
            className={`px-3 py-1 rounded-lg text-xs font-cinzel font-bold transition-all cursor-pointer ${
              gameMode === 'SOLO'
                ? 'bg-amber-500 text-slate-950 font-black shadow'
                : 'text-orange-200 hover:text-white'
            }`}
          >
            Solo (vs Dealer)
          </button>
          <button
            onClick={() => {
              setGameMode('MULTIPLAYER');
              if (!activeRoom && rooms.length > 0) handleJoinRoom(rooms[0]);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-cinzel font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              gameMode === 'MULTIPLAYER'
                ? 'bg-amber-500 text-slate-950 font-black shadow'
                : 'text-orange-200 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Multiplayer com Salas</span>
          </button>
        </div>
      </div>

      {/* MULTIPLAYER LOCAL ROOM BAR & LOBBY */}
      {gameMode === 'MULTIPLAYER' && (
        <div className="bg-[#180705] border border-orange-500/35 rounded-2xl p-3 shadow-xl space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-orange-400" />
                <span>Salas ({rooms.length}):</span>
              </span>
              {rooms.map(r => {
                const isSelected = activeRoom?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleJoinRoom(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shadow ${
                      isSelected
                        ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white border-amber-300'
                        : 'bg-[#250d09] text-orange-200 border-orange-500/30 hover:bg-[#34130d] hover:border-amber-400 hover:text-white'
                    }`}
                  >
                    <DoorOpen className="w-3 h-3 text-orange-300" />
                    <span>{r.name}</span>
                    <span className="text-[10px] opacity-80">({r.playerNames.length}/8)</span>
                  </button>
                );
              })}
            </div>

            {/* Create new local room */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Nome da Nova Sala (ex: Mesa Real)..."
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#200805] border border-orange-500/35 text-xs text-orange-100 placeholder:text-orange-400/40 w-48 sm:w-56 focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={handleCreateRoom}
                disabled={!newRoomName.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar Sala</span>
              </button>
            </div>
          </div>

          {activeRoom && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-orange-500/20 pt-2">
              <div className="flex items-center gap-2 text-xs text-orange-200">
                <span className="font-bold text-amber-300">Adicionar Jogador à Mesa:</span>
                <select
                  value={selectedUserToJoin}
                  onChange={(e) => setSelectedUserToJoin(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-[#200805] border border-orange-500/35 text-xs text-orange-100 focus:outline-none focus:border-amber-400"
                >
                  <option value="">Selecione um usuário cadastrado...</option>
                  {allRegisteredUsers.map((u: UserAccount) => (
                    <option key={u.username} value={u.username}>
                      {u.username} (🪙 {u.balance.toLocaleString('pt-BR')})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddPlayerToRoom}
                  disabled={!selectedUserToJoin}
                  className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer disabled:opacity-40"
                >
                  + Sentar na Mesa
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DUAL-LAYER POKER TABLE (Image 1: Mahogany Rim SVG, Image 2: Velvet Felt SVG) */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl min-h-[230px] sm:min-h-[265px] flex flex-col justify-between p-2.5 sm:p-3.5 select-none">
        {/* Layer 1: Mahogany Wood & Leather Rail Rim */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <svg viewBox="0 0 800 450" preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <linearGradient id="pokerWoodRim" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2b0a03" />
                <stop offset="30%" stopColor="#451206" />
                <stop offset="70%" stopColor="#240702" />
                <stop offset="100%" stopColor="#150301" />
              </linearGradient>
            </defs>
            <rect width="800" height="450" rx="36" fill="url(#pokerWoodRim)" />
            <rect x="12" y="12" width="776" height="426" rx="28" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.45" />
          </svg>
        </div>

        {/* Layer 2: Velvet Felt & Gold Betting Line */}
        <div className="absolute inset-3 sm:inset-4 pointer-events-none z-1 rounded-2xl overflow-hidden shadow-inner">
          <svg viewBox="0 0 760 410" preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <radialGradient id="pokerVelvetFelt" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#3d120a" />
                <stop offset="50%" stopColor="#250905" />
                <stop offset="100%" stopColor="#140402" />
              </radialGradient>
            </defs>
            <rect width="760" height="410" rx="24" fill="url(#pokerVelvetFelt)" />
            <ellipse cx="380" cy="205" rx="310" ry="145" fill="none" stroke="#fef08a" strokeWidth="2" strokeOpacity="0.4" strokeDasharray="8 5" />
            <ellipse cx="380" cy="205" rx="325" ry="160" fill="none" stroke="#f59e0b" strokeWidth="1.2" strokeOpacity="0.25" />
          </svg>
        </div>

        {/* TABLE CONTENT */}
        <div className="relative z-10 flex flex-col justify-between h-full space-y-1.5">
          {gameMode === 'SOLO' ? (
            /* ================= SOLO POKER VIEW ================= */
            <>
              {/* Dealer Area */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-cinzel font-bold text-amber-300 uppercase">
                    Dealer
                  </span>
                  {soloStage === 'SHOWDOWN' && soloDealerResult && (
                    <span className="bg-slate-900/90 border border-amber-500/40 px-2 py-0.5 rounded text-xs font-mono font-bold text-amber-300 shadow">
                      {soloDealerResult.name}
                    </span>
                  )}
                </div>

                {/* Pot Center Badge */}
                <div className="bg-[#240a06] border-2 border-amber-500/60 px-4 py-1 rounded-full shadow-lg flex items-center gap-1.5">
                  <span className="text-sm">🪙</span>
                  <span className="font-mono text-xs sm:text-sm font-black text-amber-300">
                    Pote: {soloPot.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Dealer Cards */}
              <div className="flex items-center justify-center gap-2 min-h-[60px]">
                {soloDealerCards.length === 0 ? (
                  <div className="flex gap-2 opacity-30">
                    <PlayingCard hidden size="xs" />
                    <PlayingCard hidden size="xs" />
                  </div>
                ) : (
                  soloDealerCards.map((c, idx) => (
                    <PlayingCard
                      key={c.id || idx}
                      card={c}
                      hidden={soloStage !== 'SHOWDOWN'}
                      flipDelayMs={idx * 300}
                      size="xs"
                    />
                  ))
                )}
              </div>

              {/* Community Cards (5 Cards) */}
              <div className="text-center my-0.5">
                <span className="text-[10px] text-amber-400/80 font-cinzel tracking-widest uppercase block mb-1 font-bold">
                  Cartas Comunitárias
                </span>
                <div className="flex items-center justify-center gap-2 min-h-[68px]">
                  {soloCommunityCards.length === 0
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="w-12 h-17 rounded-lg border border-dashed border-amber-400/30" />
                      ))
                    : soloCommunityCards.map((c, i) => (
                        <PlayingCard
                          key={c.id || i}
                          card={c}
                          hidden={i >= soloRevealedCount}
                          flipDelayMs={i < 3 ? (i + 2) * 300 : 0}
                          size="xs"
                        />
                      ))}
                </div>
              </div>

              {/* Player Cards Area with Visible White Dealer Glove */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-cinzel font-bold text-amber-300 uppercase">
                    Sua Mão
                  </span>
                  {soloStage === 'SHOWDOWN' && soloPlayerResult && (
                    <span className="bg-slate-900/90 border border-amber-500/40 px-2 py-0.5 rounded text-xs font-mono font-bold text-amber-300 shadow">
                      {soloPlayerResult.name}
                    </span>
                  )}
                </div>
                <span className="text-xs text-orange-300 font-mono font-bold">
                  Sua aposta total: 🪙 {soloPlayerTotalBet.toLocaleString('pt-BR')}
                </span>
              </div>

              <div className="flex items-center justify-center gap-3 min-h-[72px]">
                {soloPlayerCards.length === 0 ? (
                  <div className="flex gap-3 opacity-30">
                    <PlayingCard hidden size="xs" />
                    <PlayingCard hidden size="xs" />
                  </div>
                ) : (
                  soloPlayerCards.map((c, idx) => (
                    <PlayingCard
                      key={c.id || idx}
                      card={c}
                      size="xs"
                      floating={true}
                      withDealerHand={idx === 1}
                      flipDelayMs={idx * 300}
                    />
                  ))
                )}
              </div>

              {/* Outcome Banner */}
              <div className="text-center min-h-[26px]">
                {soloOutcomeMsg && (
                  <span
                    className={`inline-block px-4 py-1 rounded-xl text-xs sm:text-sm font-cinzel font-black border shadow-lg ${
                      soloOutcome === 'WIN'
                        ? 'bg-amber-500 text-slate-950 border-amber-300'
                        : soloOutcome === 'LOSS' || soloOutcome === 'FOLD'
                        ? 'bg-red-950 text-red-200 border-red-500/60'
                        : 'bg-slate-900 text-slate-200 border-slate-700'
                    }`}
                  >
                    {soloOutcomeMsg}
                  </span>
                )}
              </div>
            </>
          ) : (
            /* ================= LOCAL MULTIPLAYER VIEW ================= */
            <>
              {/* Header: Turn banner & Community Pot */}
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                  <span className="text-xs sm:text-sm font-bold text-amber-300">
                    Mesa: <strong className="text-white">{activeRoom?.name || 'Mesa Local'}</strong> · Vez de:{' '}
                    <strong className="text-amber-400 uppercase font-black">
                      {tablePlayers[activePlayerIndex]?.username || 'Aguardando Início'}
                    </strong>
                  </span>
                </div>

                <div className="bg-[#260905] border-2 border-amber-500/60 px-3.5 py-1 rounded-full flex items-center gap-1.5 shadow">
                  <span className="text-sm">🪙</span>
                  <span className="font-mono text-xs sm:text-sm font-black text-amber-300">
                    Pote da Sala: {multiPot.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* 5 Community Cards Center */}
              <div className="text-center my-1">
                <div className="flex items-center justify-center gap-2 min-h-[64px]">
                  {multiCommunityCards.map((c, i) => (
                    <PlayingCard
                      key={c.id || i}
                      card={c}
                      hidden={i >= multiRevealedCount}
                      flipDelayMs={i < 3 ? i * 300 : 0}
                      size="xs"
                    />
                  ))}
                </div>
              </div>

              {/* Seated Players Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-1">
                {tablePlayers.slice(0, 5).map((p, idx) => {
                  const isTurn = idx === activePlayerIndex && multiStage !== 'SHOWDOWN' && multiStage !== 'WAITING';
                  return (
                    <div
                      key={p.username}
                      className={`p-2 rounded-xl border text-xs transition-all relative ${
                        isTurn
                          ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400 shadow-lg scale-102'
                          : p.folded
                          ? 'bg-black/50 border-slate-800 opacity-40'
                          : 'bg-[#180503] border-orange-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-orange-100 truncate max-w-[85px]">
                          {p.username}
                        </span>
                        {p.isDealer && <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1 rounded">D</span>}
                      </div>
                      <div className="font-mono text-[11px] text-amber-300 font-extrabold">
                        🪙 {p.chips.toLocaleString('pt-BR')}
                      </div>
                      <div className="flex items-center gap-1 mt-1 justify-center min-h-[40px]">
                        {p.folded ? (
                          <span className="text-[10px] text-red-400 font-bold">FOLD</span>
                        ) : isTurn && peekHoleCards ? (
                          p.holeCards.map((c, ci) => (
                            <PlayingCard key={c.id || ci} card={c} size="xs" floating={false} withDealerHand={ci === 1} flipDelayMs={ci * 300} />
                          ))
                        ) : multiStage === 'SHOWDOWN' && !p.folded ? (
                          p.holeCards.map((c, ci) => (
                            <PlayingCard key={c.id || ci} card={c} size="xs" floating={false} flipDelayMs={ci * 300} />
                          ))
                        ) : (
                          <div className="flex gap-1.5 opacity-80">
                            <div className="w-7 h-10 rounded bg-[#200503] border border-amber-500/50 flex items-center justify-center text-[9px] text-amber-300 font-bold">♠</div>
                            <div className="w-7 h-10 rounded bg-[#200503] border border-amber-500/50 flex items-center justify-center text-[9px] text-amber-300 font-bold">♥</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Showdown Winner Message */}
              {multiWinnerMsg && (
                <div className="text-center p-1.5 bg-amber-500/20 border-2 border-amber-400 rounded-xl text-xs sm:text-sm font-bold text-amber-200">
                  {multiWinnerMsg}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* RESTORED COMFORTABLE ACTION CONTROLS */}
      <div className="bg-[#180705] border border-orange-500/30 rounded-2xl p-2.5 shadow-xl">
        {gameMode === 'SOLO' ? (
          soloStage === 'BETTING' || soloStage === 'SHOWDOWN' ? (
            <div className="flex flex-col gap-2">
              <ChipSelector
                currentBet={soloAnte}
                balance={balance}
                onBetChange={setSoloAnte}
                label="Ante Atual:"
                showInput={true}
              />

              <button
                type="button"
                onClick={handleSoloDeal}
                disabled={soloAnte <= 0 || soloAnte > balance}
                className="w-full px-8 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-sm sm:text-base shadow-xl shadow-orange-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap border border-orange-300/40"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {soloStage === 'SHOWDOWN'
                    ? `Nova Rodada (${soloAnte.toLocaleString('pt-BR')} Fichas) 🃏`
                    : `Dar Cartas (${soloAnte.toLocaleString('pt-BR')} Fichas) 🃏`}
                </span>
              </button>
            </div>
          ) : (
            /* Active Round Controls: Additive No-Limit Raise & Action Buttons */
            <div className="space-y-2">
              <ChipSelector
                currentBet={soloRaiseInput}
                balance={balance}
                onBetChange={setSoloRaiseInput}
                label="Aposta Raise:"
                showInput={true}
                showDouble={false}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (soloPot > balance) {
                      showToast(`Saldo insuficiente para igualar o pote (${soloPot.toLocaleString('pt-BR')} fichas)!`);
                      return;
                    }
                    soundManager.playChip();
                    setSoloRaiseInput(soloPot);
                  }}
                  className="px-3 py-2 rounded-xl bg-[#2a0e08] hover:bg-[#3d140b] text-amber-300 border border-orange-500/30 font-bold text-xs cursor-pointer"
                >
                  Pote ({soloPot.toLocaleString('pt-BR')})
                </button>

                {/* Main Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap justify-end flex-1">
                  <button
                    type="button"
                    onClick={handleSoloFold}
                    className="px-4 py-2 rounded-xl bg-red-950/90 hover:bg-red-900 border border-red-500/60 text-red-200 font-bold text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Fold</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSoloCall}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-400 text-white font-bold text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <Check className="w-4 h-4" />
                    <span>Check / Continuar</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSoloRaise}
                    disabled={soloRaiseInput <= 0 || balance < soloRaiseInput}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 shadow-lg disabled:opacity-40"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Raise ({soloRaiseInput.toLocaleString('pt-BR')} Fichas)</span>
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          /* ================= LOCAL MULTIPLAYER CONTROLS ================= */
          multiStage === 'WAITING' || multiStage === 'SHOWDOWN' ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap text-xs text-orange-200">
                <span className="font-bold text-amber-300">Jogadores na Mesa ({tablePlayers.length}/8):</span>
                {tablePlayers.map(p => (
                  <span key={p.username} className="px-2.5 py-1 rounded-md bg-[#250d09] border border-orange-500/30 text-white font-mono font-bold">
                    {p.username}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={startNewMultiplayerHand}
                disabled={tablePlayers.length < 2}
                className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{multiStage === 'SHOWDOWN' ? 'Nova Mão de Pôquer 🃏' : `Iniciar Partida (${tablePlayers.length} Jogadores) 🃏`}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <ChipSelector
                currentBet={multiRaiseAmount}
                balance={tablePlayers[activePlayerIndex]?.chips || 0}
                onBetChange={setMultiRaiseAmount}
                label={`Raise (${tablePlayers[activePlayerIndex]?.username || 'Vez'}):`}
                showInput={true}
                showDouble={false}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setPeekHoleCards(prev => !prev)}
                  className="px-3 py-2 rounded-xl bg-[#2a0e08] hover:bg-[#3d140b] border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {peekHoleCards ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{peekHoleCards ? 'Ocultar Cartas' : `Espiar Cartas (${tablePlayers[activePlayerIndex]?.username})`}</span>
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleMultiFold}
                    className="px-4 py-2 rounded-xl bg-red-950/90 hover:bg-red-900 border border-red-500/60 text-red-200 font-bold text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Fold</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleMultiCallOrCheck}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-400 text-white font-bold text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {Math.max(0, currentHighestBet - (tablePlayers[activePlayerIndex]?.currentStreetBet || 0)) > 0
                        ? `Call (${Math.max(0, currentHighestBet - (tablePlayers[activePlayerIndex]?.currentStreetBet || 0))})`
                        : 'Check'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleMultiRaise}
                    disabled={multiRaiseAmount <= 0 || multiRaiseAmount > (tablePlayers[activePlayerIndex]?.chips || 0)}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 shadow-lg disabled:opacity-40"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Raise (+{multiRaiseAmount.toLocaleString('pt-BR')} Fichas)</span>
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {gameMode === 'MULTIPLAYER' && activeRoom && (
        <RoomChatAndPresence
          presenceMap={rtdbPresence}
          chatMessages={rtdbChat}
          timer={rtdbTimer}
          myUid={pokerUid}
          myReady={myReady}
          showReadyToggle={multiStage === 'WAITING' || multiStage === 'SHOWDOWN'}
          turnPlayerName={rtdbEstadoLive?.turnoAtual || tablePlayers[activePlayerIndex]?.username}
          onToggleReady={() => {
            const next = !myReady;
            setMyReady(next);
            void presenceHandleRef.current?.setReady(next);
          }}
          onSendMessage={async (msg) => {
            await sendRoomChatMessage(activeRoom.id, pokerPlayerName, msg, pokerUid);
          }}
        />
      )}

      {/* Como Jogar Button */}
      <div className="pt-0.5 text-center">
        <button
          onClick={() => setShowHowToPlay(true)}
          className="inline-flex items-center gap-1 text-[11px] text-orange-300/70 hover:text-amber-300 transition-colors cursor-pointer py-0.5"
        >
          <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
          <span>Regras do Texas Hold'em No-Limit & Salas Multiplayer</span>
        </button>
      </div>

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        gameId="texas-holdem"
      />

      <CardVictoryModal
        isOpen={Boolean(victoryModal)}
        winAmount={victoryModal?.winAmount || 0}
        subtitle={victoryModal?.subtitle}
        detail={victoryModal?.detail}
        onClose={() => setVictoryModal(null)}
      />
    </div>
  );
};
