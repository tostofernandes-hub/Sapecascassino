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
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
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
  currentUser?: UserAccount | null;
  firebaseUid?: string | null;
  onRequestLogin?: () => void;
}

type HoldemMode = 'SOLO' | 'MULTIPLAYER';
type SoloStage = 'BETTING' | 'FLOP_ROUND' | 'TURN_ROUND' | 'SHOWDOWN';

interface PokerPlayerMeta {
  uid: string;
  nome: string;
  avatar?: string;
  saldo?: number;
  aposta?: number;
}

interface PokerRoom {
  id: string;
  name: string;
  host: string;
  criadorId?: string;
  createdAt: number;
  playerNames: string[];
  jogadores?: string[];
  jogadoresInfo?: Record<string, PokerPlayerMeta>;
  status?: 'aguardando' | 'jogando' | 'finalizado';
  isFirestore?: boolean;
}

interface TablePlayer {
  uid?: string;
  username: string;
  chips: number;
  startingChips?: number;
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
  onBackToLobby,
  currentUser,
  firebaseUid,
  onRequestLogin
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
  const [multiRoundId, setMultiRoundId] = useState<number>(0);
  const [hideMyHoleCards, setHideMyHoleCards] = useState<boolean>(false);
  const [showAddLocalPlayer, setShowAddLocalPlayer] = useState<boolean>(false);
  const [showChatDrawer, setShowChatDrawer] = useState<boolean>(false);
  const [selectedUserToJoin, setSelectedUserToJoin] = useState<string>('');
  const [rtdbPresence, setRtdbPresence] = useState<Record<string, PlayerPresence>>({});
  const [rtdbChat, setRtdbChat] = useState<RoomChatMessage[]>([]);
  const [rtdbTimer, setRtdbTimer] = useState<RoomTimerState | null>(null);
  const [rtdbEstadoLive, setRtdbEstadoLive] = useState<RtdbEstadoJogo | null>(null);
  const [myReady, setMyReady] = useState<boolean>(false);
  const presenceHandleRef = useRef<{ setReady: (pronto: boolean) => Promise<void>; disconnect: () => Promise<void> } | null>(null);
  const lastSettledRoundRef = useRef<number>(0);
  const onUpdateBalanceRef = useRef(onUpdateBalance);

  useEffect(() => {
    onUpdateBalanceRef.current = onUpdateBalance;
  }, [onUpdateBalance]);

  const pokerUser = currentUser || getCurrentUser();
  const effectiveUid = firebaseUid || auth.currentUser?.uid || null;
  const pokerUid = effectiveUid || pokerUser?.uid || pokerUser?.username || 'jogador';
  const pokerPlayerName = (pokerUser?.nickname || pokerUser?.username || auth.currentUser?.displayName || 'Jogador').slice(0, 32);
  const pokerAvatar = (pokerUser?.avatar || '🦁').slice(0, 16);
  const isFirestoreRoom = Boolean(activeRoom?.isFirestore);
  const isRoomHost = !isFirestoreRoom || (Boolean(effectiveUid) && activeRoom?.criadorId === effectiveUid);
  const currentTurnPlayer = tablePlayers[activePlayerIndex];
  const isMyTurn =
    !isFirestoreRoom ||
    (Boolean(effectiveUid) && currentTurnPlayer?.uid === effectiveUid);

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

  // Listen to ALL Poker rooms from Firestore in real time (collection(db, 'salas'))
  useEffect(() => {
    if (gameMode !== 'MULTIPLAYER') return;
    if (!effectiveUid) {
      loadRooms();
      return;
    }

    const unsub = onSnapshot(
      collection(db, 'salas'),
      (snapshot) => {
        const fsRooms: PokerRoom[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          if (data.jogo !== 'poker') return;
          const jogadores = Array.isArray(data.jogadores) ? (data.jogadores as string[]) : [];
          const infoMap = (data.jogadoresInfo && typeof data.jogadoresInfo === 'object'
            ? data.jogadoresInfo
            : {}) as Record<string, PokerPlayerMeta>;
          const playerNames = jogadores.map((uid) => infoMap[uid]?.nome || uid.slice(0, 8));
          const tsObj = data.atualizadoEm || data.criadoEm;
          const tsMs =
            tsObj && typeof tsObj === 'object' && 'toMillis' in tsObj
              ? (tsObj as { toMillis: () => number }).toMillis()
              : Date.now();
          fsRooms.push({
            id: docSnap.id,
            name: String(data.nome || 'Mesa de Poker'),
            host: String(data.criadorNome || 'Anfitrião'),
            criadorId: String(data.criadorId || ''),
            createdAt: tsMs,
            playerNames,
            jogadores,
            jogadoresInfo: infoMap,
            status: (data.status as PokerRoom['status']) || 'aguardando',
            isFirestore: true
          });
        });

        fsRooms.sort((a, b) => b.createdAt - a.createdAt);
        setRooms(fsRooms);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'salas');
      }
    );

    return () => unsub();
  }, [gameMode, effectiveUid]);

  // Listen to active Firestore Poker room in real time so players & game state sync instantly
  useEffect(() => {
    if (gameMode !== 'MULTIPLAYER' || !activeRoom?.id || !activeRoom.isFirestore || !effectiveUid) {
      return;
    }

    const roomPath = `salas/${activeRoom.id}`;
    const unsub = onSnapshot(
      doc(db, 'salas', activeRoom.id),
      (docSnap) => {
        if (!docSnap.exists()) {
          setActiveRoom(null);
          setTablePlayers([]);
          showToast('A mesa de Poker foi encerrada.');
          return;
        }

        const data = docSnap.data() as Record<string, unknown>;
        const jogadores = Array.isArray(data.jogadores) ? (data.jogadores as string[]) : [];
        const infoMap = (data.jogadoresInfo && typeof data.jogadoresInfo === 'object'
          ? data.jogadoresInfo
          : {}) as Record<string, PokerPlayerMeta>;
        const estado = (data.estadoJogo && typeof data.estadoJogo === 'object'
          ? data.estadoJogo
          : {}) as Record<string, unknown>;

        const playerNames = jogadores.map((uid) => infoMap[uid]?.nome || uid.slice(0, 8));
        setActiveRoom((prev) =>
          prev && prev.id === docSnap.id
            ? {
                ...prev,
                name: String(data.nome || prev.name),
                host: String(data.criadorNome || prev.host),
                criadorId: String(data.criadorId || prev.criadorId || ''),
                playerNames,
                jogadores,
                jogadoresInfo: infoMap,
                status: (data.status as PokerRoom['status']) || 'aguardando',
                isFirestore: true
              }
            : prev
        );

        const stage = (estado.stage as typeof multiStage) || 'WAITING';
        const incomingRoundId = typeof estado.roundId === 'number' ? estado.roundId : 0;
        const incomingPot = typeof estado.pot === 'number' ? estado.pot : 0;
        const incomingPlayers = Array.isArray(estado.players) ? (estado.players as TablePlayer[]) : [];
        const incomingWinnerMsg = typeof estado.winnerMsg === 'string' ? estado.winnerMsg : '';

        setMultiStage(stage);
        setMultiRoundId(incomingRoundId);
        setMultiPot(incomingPot);
        setCurrentHighestBet(typeof estado.highestBet === 'number' ? estado.highestBet : 0);
        setActivePlayerIndex(typeof estado.activePlayerIndex === 'number' ? estado.activePlayerIndex : 0);
        setMultiRevealedCount(typeof estado.revealedCount === 'number' ? estado.revealedCount : 0);
        setMultiCommunityCards(Array.isArray(estado.communityCards) ? (estado.communityCards as Card[]) : []);
        setMultiWinnerMsg(incomingWinnerMsg);

        if (stage === 'WAITING' || incomingPlayers.length === 0) {
          const syncedSeated: TablePlayer[] = jogadores.map((uid, idx) => {
            const meta = infoMap[uid];
            return {
              uid,
              username: meta?.nome || uid.slice(0, 8),
              chips: typeof meta?.saldo === 'number' ? Math.max(100, meta.saldo) : 10000,
              holeCards: [],
              currentStreetBet: 0,
              totalRoundBet: 0,
              folded: false,
              isAllIn: false,
              isDealer: idx === 0
            };
          });
          setTablePlayers(syncedSeated);
        } else {
          setTablePlayers(incomingPlayers);

          if (stage === 'SHOWDOWN' && incomingRoundId > 0 && lastSettledRoundRef.current !== incomingRoundId) {
            lastSettledRoundRef.current = incomingRoundId;
            const mySeat = incomingPlayers.find((p) => p.uid === effectiveUid);
            if (mySeat && typeof mySeat.startingChips === 'number') {
              const netDelta = mySeat.chips - mySeat.startingChips;
              if (netDelta !== 0) {
                onUpdateBalanceRef.current(netDelta, netDelta > 0, 'texas-holdem', mySeat.totalRoundBet || 0);
              }
            }
            const winnerSubtitle = typeof estado.winnerSubtitle === 'string'
              ? estado.winnerSubtitle
              : incomingWinnerMsg || 'Fim da Rodada';
            if (incomingPot > 0) {
              scheduleVictoryModal(incomingPot, "TEXAS HOLD'EM MULTIPLAYER", winnerSubtitle, 550);
            }
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, roomPath);
      }
    );

    return () => unsub();
  }, [gameMode, activeRoom?.id, activeRoom?.isFirestore, effectiveUid]);

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

    // Default local room fallback when not signed in to Firebase
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

  const sanitizePlayersForFirestore = (players: TablePlayer[]): Record<string, unknown>[] =>
    players.map((p) => {
      const clean: Record<string, unknown> = {
        uid: p.uid || '',
        username: p.username,
        chips: p.chips,
        holeCards: p.holeCards || [],
        currentStreetBet: p.currentStreetBet || 0,
        totalRoundBet: p.totalRoundBet || 0,
        folded: Boolean(p.folded),
        isAllIn: Boolean(p.isAllIn),
        isDealer: Boolean(p.isDealer),
        ...(typeof p.startingChips === 'number' ? { startingChips: p.startingChips } : {})
      };
      if (p.handResult) {
        clean.handResult = {
          tier: p.handResult.tier,
          name: p.handResult.name,
          kickers: p.handResult.kickers,
          bestCards: p.handResult.bestCards
        };
      }
      return clean;
    });

  const syncPokerEstadoToFirestore = async (
    roomId: string,
    roomStatus: 'aguardando' | 'jogando' | 'finalizado',
    estadoPayload: Record<string, unknown>
  ) => {
    try {
      const payloadCopy = { ...estadoPayload };
      if (Array.isArray(payloadCopy.players)) {
        payloadCopy.players = sanitizePlayersForFirestore(payloadCopy.players as TablePlayer[]);
      }
      await updateDoc(doc(db, 'salas', roomId), {
        status: roomStatus,
        estadoJogo: {
          status: roomStatus,
          ...payloadCopy
        },
        atualizadoEm: serverTimestamp()
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.UPDATE, `salas/${roomId}`);
      } else {
        console.error('Erro ao sincronizar estado do Poker:', error);
      }
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;

    if (effectiveUid) {
      const roomName = newRoomName.trim().slice(0, 60);
      const initialPlayer: TablePlayer = {
        uid: effectiveUid,
        username: pokerPlayerName,
        chips: Math.max(100, balance),
        holeCards: [],
        currentStreetBet: 0,
        totalRoundBet: 0,
        folded: false,
        isAllIn: false,
        isDealer: true
      };
      try {
        const docRef = await addDoc(collection(db, 'salas'), {
          nome: roomName,
          jogo: 'poker',
          criadorId: effectiveUid,
          criadorNome: pokerPlayerName,
          jogadores: [effectiveUid],
          jogadoresInfo: {
            [effectiveUid]: {
              uid: effectiveUid,
              nome: pokerPlayerName,
              avatar: pokerAvatar,
              saldo: Math.max(100, balance)
            }
          },
          maxJogadores: 8,
          status: 'aguardando',
          apostaMinima: 50,
          estadoJogo: {
            status: 'aguardando',
            stage: 'WAITING',
            roundId: 0,
            pot: 0,
            highestBet: 0,
            activePlayerIndex: 0,
            communityCards: [],
            revealedCount: 0,
            players: sanitizePlayersForFirestore([initialPlayer]),
            winnerMsg: ''
          },
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp()
        });
        const createdRoom: PokerRoom = {
          id: docRef.id,
          name: roomName,
          host: pokerPlayerName,
          criadorId: effectiveUid,
          createdAt: Date.now(),
          playerNames: [pokerPlayerName],
          jogadores: [effectiveUid],
          isFirestore: true
        };
        setNewRoomName('');
        setActiveRoom(createdRoom);
        setTablePlayers([initialPlayer]);
        setMultiStage('WAITING');
        setMultiWinnerMsg('');
        soundManager.playClick();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
          handleFirestoreError(error, OperationType.CREATE, 'salas');
        }
        showToast('Não foi possível criar a sala de Poker no Firestore.');
      }
      return;
    }

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
    void handleJoinRoom(newRoom);
  };

  const handleJoinRoom = async (room: PokerRoom) => {
    if (room.isFirestore && effectiveUid) {
      const alreadyIn = room.jogadores?.includes(effectiveUid);
      if (!alreadyIn) {
        if (room.status === 'jogando') {
          showToast('Esta mesa está com uma mão em andamento. Aguarde finalizar ou entre em outra sala.');
          return;
        }
        if ((room.jogadores?.length || 0) >= 8) {
          showToast('Mesa cheia (máximo 8 jogadores)!');
          return;
        }
        try {
          await updateDoc(doc(db, 'salas', room.id), {
            jogadores: arrayUnion(effectiveUid),
            [`jogadoresInfo.${effectiveUid}`]: {
              uid: effectiveUid,
              nome: pokerPlayerName,
              avatar: pokerAvatar,
              saldo: Math.max(100, balance)
            },
            atualizadoEm: serverTimestamp()
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
            handleFirestoreError(error, OperationType.UPDATE, `salas/${room.id}`);
          }
          showToast('Erro ao entrar na sala de Poker.');
          return;
        }
      }
      setActiveRoom(room);
      setMultiStage('WAITING');
      setMultiWinnerMsg('');
      soundManager.playClick();
      return;
    }

    setActiveRoom(room);
    setMultiStage('WAITING');
    setMultiWinnerMsg('');
    soundManager.playClick();

    // Populate seated players from local registered accounts
    const allAccounts = getStoredAccounts();
    let seatedNames = room.playerNames;

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

  const handleLeavePokerRoom = async () => {
    if (!activeRoom) return;
    if (activeRoom.isFirestore && effectiveUid) {
      const remaining = (activeRoom.jogadores || []).filter((id) => id !== effectiveUid);
      try {
        if (remaining.length === 0) {
          await deleteDoc(doc(db, 'salas', activeRoom.id));
        } else {
          const nextCreatorId =
            activeRoom.criadorId === effectiveUid ? remaining[0] : activeRoom.criadorId;
          const nextCreatorName =
            activeRoom.criadorId === effectiveUid
              ? activeRoom.jogadoresInfo?.[remaining[0]]?.nome || 'Jogador'
              : activeRoom.host;
          await updateDoc(doc(db, 'salas', activeRoom.id), {
            jogadores: arrayRemove(effectiveUid),
            criadorId: nextCreatorId,
            criadorNome: nextCreatorName,
            atualizadoEm: serverTimestamp()
          });
        }
      } catch (error) {
        console.warn('Erro ao sair da sala de Poker:', error);
      }
    }
    setActiveRoom(null);
    setTablePlayers([]);
    setMultiStage('WAITING');
    setMultiRoundId(0);
    setShowChatDrawer(false);
    setShowAddLocalPlayer(false);
    lastSettledRoundRef.current = 0;
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

    if (activeRoom.isFirestore) {
      void syncPokerEstadoToFirestore(activeRoom.id, 'aguardando', {
        stage: 'WAITING',
        pot: 0,
        highestBet: 0,
        activePlayerIndex: 0,
        communityCards: [],
        revealedCount: 0,
        players: nextPlayers,
        winnerMsg: ''
      });
    } else {
      activeRoom.playerNames = nextPlayers.map(p => p.username);
      saveRooms(rooms.map(r => r.id === activeRoom.id ? activeRoom : r));
    }
    setSelectedUserToJoin('');
    soundManager.playChip();
  };

  const startNewMultiplayerHand = () => {
    if (isFirestoreRoom && !isRoomHost) {
      showToast('Apenas o criador (anfitrião) da sala pode iniciar e embaralhar a mão!');
      return;
    }
    if (tablePlayers.length < 2) {
      showToast('São necessários pelo menos 2 jogadores para iniciar a mão!');
      return;
    }

    if (victoryTimerRef.current) window.clearTimeout(victoryTimerRef.current);
    setVictoryModal(null);
    soundManager.playShuffle();
    const newDeck = shuffleDeck(createDeck());
    const bigBlind = 50;
    const smallBlind = 25;
    const nextRoundId = multiRoundId + 1;

    let pot = 0;
    const updated: TablePlayer[] = tablePlayers.map((p, idx) => {
      const c1 = newDeck.pop()!;
      const c2 = newDeck.pop()!;
      const baseChips = p.uid === effectiveUid && isFirestoreRoom
        ? Math.max(100, balance)
        : Math.max(100, p.chips);
      let blind = 0;

      if (idx === 0) blind = Math.min(baseChips, smallBlind);
      else if (idx === 1) blind = Math.min(baseChips, bigBlind);

      pot += blind;

      return {
        uid: p.uid,
        username: p.username,
        chips: baseChips - blind,
        startingChips: baseChips,
        holeCards: [c1, c2],
        currentStreetBet: blind,
        totalRoundBet: blind,
        folded: false,
        isAllIn: baseChips <= blind,
        isDealer: idx === 0
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
    setMultiRoundId(nextRoundId);
    setMultiWinnerMsg('');
    setPeekHoleCards(false);
    setHideMyHoleCards(false);
    setMultiRaiseAmount(bigBlind * 2);
    soundManager.playCardDeal();

    if (activeRoom?.isFirestore) {
      void syncPokerEstadoToFirestore(activeRoom.id, 'jogando', {
        stage: 'PREFLOP',
        roundId: nextRoundId,
        pot,
        highestBet: bigBlind,
        activePlayerIndex: nextTurnIdx,
        communityCards: comm,
        revealedCount: 0,
        players: updated,
        winnerMsg: ''
      });
    }

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
    if (multiStage === 'WAITING' || multiStage === 'SHOWDOWN') return;
    if (!isMyTurn) {
      showToast(`Aguarde! Agora é a vez de ${currentTurnPlayer?.username || 'outro jogador'}.`);
      return;
    }
    soundManager.playLoss();
    const updated = [...tablePlayers];
    const currName = updated[activePlayerIndex]?.username || 'Jogador';
    updated[activePlayerIndex] = { ...updated[activePlayerIndex], folded: true };
    setTablePlayers(updated);
    if (activeRoom?.id) {
      void enviarJogadaRtdb(activeRoom.id, {
        apostaAtual: currentHighestBet,
        ultimaAcao: `${currName} deu Fold`
      });
    }
    advanceMultiTurn(updated, multiPot, currentHighestBet);
  };

  const handleMultiCallOrCheck = () => {
    if (multiStage === 'WAITING' || multiStage === 'SHOWDOWN') return;
    if (!isMyTurn) {
      showToast(`Aguarde! Agora é a vez de ${currentTurnPlayer?.username || 'outro jogador'}.`);
      return;
    }
    soundManager.playClick();
    const updated = [...tablePlayers];
    const curr = { ...updated[activePlayerIndex] };
    const needed = Math.max(0, currentHighestBet - curr.currentStreetBet);
    let nextPot = multiPot;

    if (needed > 0) {
      const callAmt = Math.min(curr.chips, needed);
      curr.chips -= callAmt;
      curr.currentStreetBet += callAmt;
      curr.totalRoundBet += callAmt;
      if (curr.chips === 0) curr.isAllIn = true;
      nextPot += callAmt;
      setMultiPot(nextPot);
      soundManager.playChip();
    }
    updated[activePlayerIndex] = curr;
    setTablePlayers(updated);

    if (activeRoom?.id) {
      void enviarJogadaRtdb(activeRoom.id, {
        apostaAtual: currentHighestBet,
        ultimaAcao: needed > 0 ? `${curr.username} pagou Call (${needed})` : `${curr.username} deu Check`
      });
    }

    advanceMultiTurn(updated, nextPot, currentHighestBet);
  };

  const handleMultiRaise = () => {
    if (multiStage === 'WAITING' || multiStage === 'SHOWDOWN') return;
    if (!isMyTurn) {
      showToast(`Aguarde! Agora é a vez de ${currentTurnPlayer?.username || 'outro jogador'}.`);
      return;
    }
    const updated = [...tablePlayers];
    const curr = { ...updated[activePlayerIndex] };
    if (!curr.username) return;
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
    updated[activePlayerIndex] = curr;

    const nextHighest = curr.currentStreetBet > currentHighestBet ? curr.currentStreetBet : currentHighestBet;
    if (curr.currentStreetBet > currentHighestBet) {
      setCurrentHighestBet(curr.currentStreetBet);
    }
    const nextPot = multiPot + targetRaise;
    setMultiPot(nextPot);
    setTablePlayers(updated);
    if (activeRoom?.id) {
      void enviarJogadaRtdb(activeRoom.id, {
        apostaAtual: nextHighest,
        ultimaAcao: `${curr.username} deu Raise (+${targetRaise})`
      });
    }
    advanceMultiTurn(updated, nextPot, nextHighest);
  };

  const advanceMultiTurn = (currentList: TablePlayer[], potVal = multiPot, highestVal = currentHighestBet) => {
    const active = currentList.filter(p => !p.folded);

    if (active.length === 1) {
      const winner = { ...active[0], chips: active[0].chips + potVal };
      const finalList = currentList.map((p) =>
        (p.uid && winner.uid ? p.uid === winner.uid : p.username === winner.username) ? winner : p
      );
      const msg = `🏆 ${winner.username} venceu o pote de ${potVal.toLocaleString('pt-BR')} fichas!`;
      const subtitle = `Vitória de ${winner.username} (Desistência)`;
      soundManager.playWin();
      setTablePlayers(finalList);
      setMultiWinnerMsg(msg);
      setMultiStage('SHOWDOWN');
      persistMultiBalances(finalList);
      if (activeRoom?.isFirestore) {
        void syncPokerEstadoToFirestore(activeRoom.id, 'finalizado', {
          stage: 'SHOWDOWN',
          roundId: multiRoundId,
          pot: potVal,
          highestBet: highestVal,
          activePlayerIndex,
          communityCards: multiCommunityCards,
          revealedCount: multiRevealedCount,
          players: finalList,
          winnerMsg: msg,
          winnerSubtitle: subtitle
        });
      } else {
        scheduleVictoryModal(potVal, "TEXAS HOLD'EM MULTIPLAYER", subtitle, 350);
      }
      return;
    }

    let nextIdx = (activePlayerIndex + 1) % currentList.length;
    let loops = 0;
    while ((currentList[nextIdx].folded || currentList[nextIdx].isAllIn) && loops < currentList.length) {
      nextIdx = (nextIdx + 1) % currentList.length;
      loops++;
    }

    const allMatched = active.every(p => p.isAllIn || p.currentStreetBet === highestVal);

    if (allMatched && loops < currentList.length) {
      advanceMultiStreet(currentList, potVal);
    } else {
      setActivePlayerIndex(nextIdx);
      setPeekHoleCards(false);
      if (activeRoom?.isFirestore) {
        void syncPokerEstadoToFirestore(activeRoom.id, 'jogando', {
          stage: multiStage,
          roundId: multiRoundId,
          pot: potVal,
          highestBet: highestVal,
          activePlayerIndex: nextIdx,
          communityCards: multiCommunityCards,
          revealedCount: multiRevealedCount,
          players: currentList,
          winnerMsg: ''
        });
      }
      if (activeRoom?.id && currentList[nextIdx]) {
        const nextUser = currentList[nextIdx].username;
        void enviarJogadaRtdb(activeRoom.id, {
          turnoAtual: nextUser
        });
        void updateRoomTurnTimer(activeRoom.id, nextUser, 25);
      }
    }
  };

  const advanceMultiStreet = (currentList: TablePlayer[], potVal = multiPot) => {
    const resetList = currentList.map(p => ({ ...p, currentStreetBet: 0 }));
    let firstActiveIdx = resetList.findIndex(p => !p.folded && !p.isAllIn);
    if (firstActiveIdx === -1) firstActiveIdx = 0;

    setCurrentHighestBet(0);
    setActivePlayerIndex(firstActiveIdx);
    setPeekHoleCards(false);
    setTablePlayers(resetList);

    let nextStage = multiStage;
    let nextRevealed = multiRevealedCount;

    if (multiStage === 'PREFLOP') {
      soundManager.playCardDeal();
      nextRevealed = 3;
      nextStage = 'FLOP';
    } else if (multiStage === 'FLOP') {
      soundManager.playCardDeal();
      nextRevealed = 4;
      nextStage = 'TURN';
    } else if (multiStage === 'TURN') {
      soundManager.playCardDeal();
      nextRevealed = 5;
      nextStage = 'RIVER';
    } else if (multiStage === 'RIVER') {
      triggerMultiShowdown(resetList, potVal);
      return;
    }

    setMultiRevealedCount(nextRevealed);
    setMultiStage(nextStage);
    if (activeRoom?.isFirestore) {
      void syncPokerEstadoToFirestore(activeRoom.id, 'jogando', {
        stage: nextStage,
        roundId: multiRoundId,
        pot: potVal,
        highestBet: 0,
        activePlayerIndex: firstActiveIdx,
        communityCards: multiCommunityCards,
        revealedCount: nextRevealed,
        players: resetList,
        winnerMsg: ''
      });
    }
    if (activeRoom?.id && resetList[firstActiveIdx]) {
      const nextUser = resetList[firstActiveIdx].username;
      void enviarJogadaRtdb(activeRoom.id, {
        apostaAtual: 0,
        turnoAtual: nextUser
      });
      void updateRoomTurnTimer(activeRoom.id, nextUser, 25);
    }
  };

  const triggerMultiShowdown = (currentList: TablePlayer[], potVal = multiPot) => {
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
    winner.chips += potVal;
    const msg = `🎉 ${winner.username} venceu o pote com ${winner.handResult?.name}! (+${potVal.toLocaleString('pt-BR')} fichas)`;
    const subtitle = `${winner.username} · ${winner.handResult?.name || ''}`;

    soundManager.playJackpot();
    setMultiWinnerMsg(msg);
    setTablePlayers(evaluated);
    persistMultiBalances(evaluated);

    if (activeRoom?.isFirestore) {
      void syncPokerEstadoToFirestore(activeRoom.id, 'finalizado', {
        stage: 'SHOWDOWN',
        roundId: multiRoundId,
        pot: potVal,
        highestBet: 0,
        activePlayerIndex: 0,
        communityCards: multiCommunityCards,
        revealedCount: 5,
        players: evaluated,
        winnerMsg: msg,
        winnerSubtitle: subtitle
      });
    } else {
      scheduleVictoryModal(potVal, "TEXAS HOLD'EM MULTIPLAYER", subtitle, 950);
    }
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
    <div className="h-full max-h-full min-h-0 flex flex-col justify-between gap-1.5 overflow-hidden max-w-5xl mx-auto animate-fade-in relative">
      {toastMsg && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-xl bg-amber-950/95 border border-amber-400/70 text-amber-200 text-xs font-bold text-center shadow-xl">
          {toastMsg}
        </div>
      )}
      {/* Top Header & Mode Toggle (Compact 100vh) */}
      <div className="shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToLobby}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Lobby</span>
          </button>

          <button
            onClick={() => setShowHowToPlay(true)}
            className="inline-flex items-center gap-1 text-[11px] text-orange-300/80 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden sm:inline">Regras</span>
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center p-0.5 rounded-xl bg-[#180705] border border-orange-500/30">
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

      {/* MULTIPLAYER ROOM BAR & LOBBY (Compact so Table + Controls stay in 100vh) */}
      {gameMode === 'MULTIPLAYER' && (
        <div className="shrink-0 bg-[#180705] border border-orange-500/35 rounded-xl p-2 shadow-xl space-y-1.5">
          {!effectiveUid && (
            <div className="bg-[#240a06] border border-amber-500/40 rounded-lg px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-200">
              <span>Faça login no Firebase para ver e entrar nas salas online de outros jogadores.</span>
              <button
                type="button"
                onClick={() => onRequestLogin?.()}
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black cursor-pointer"
              >
                Entrar / Criar Conta
              </button>
            </div>
          )}

          {!activeRoom ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap max-h-16 overflow-y-auto">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-orange-400" />
                  <span>Salas ({rooms.length}):</span>
                </span>
                {rooms.length === 0 ? (
                  <span className="text-xs text-orange-200/60">Nenhuma sala aberta. Crie a primeira!</span>
                ) : (
                  rooms.map(r => (
                    <button
                      key={r.id}
                      onClick={() => void handleJoinRoom(r)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shadow bg-[#250d09] text-orange-200 border-orange-500/30 hover:bg-[#34130d] hover:border-amber-400 hover:text-white"
                    >
                      <DoorOpen className="w-3 h-3 text-orange-300" />
                      <span>{r.name}</span>
                      <span className="text-[10px] opacity-80">({r.playerNames.length}/8)</span>
                    </button>
                  ))
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="text"
                  placeholder="Nome da Nova Sala..."
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-[#200805] border border-orange-500/35 text-xs text-orange-100 placeholder:text-orange-400/40 w-40 sm:w-48 focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={() => void handleCreateRoom()}
                  disabled={!newRoomName.trim()}
                  className="px-3 py-1 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Criar</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-200 font-bold">
                  ♠ {activeRoom.name} ({tablePlayers.length}/8)
                </span>
                <span className="text-[11px] text-orange-200/80">
                  {isRoomHost ? 'Você é o Anfitrião' : `Anfitrião: ${activeRoom.host}`}
                </span>
                {rtdbEstadoLive?.ultimaAcao && (
                  <span className="hidden md:inline text-[11px] text-emerald-300/90 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    {rtdbEstadoLive.ultimaAcao}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {!isFirestoreRoom && (
                  <button
                    type="button"
                    onClick={() => setShowAddLocalPlayer(prev => !prev)}
                    className="px-2.5 py-1 rounded-lg bg-[#250d09] hover:bg-[#34130d] border border-orange-500/35 text-amber-300 text-[11px] font-bold cursor-pointer"
                  >
                    + Jogador Local
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowChatDrawer(prev => !prev)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                    showChatDrawer
                      ? 'bg-amber-500 text-slate-950 border-amber-300'
                      : 'bg-[#250d09] hover:bg-[#34130d] border-orange-500/35 text-amber-300'
                  }`}
                >
                  💬 Tempo Real & Chat ({rtdbChat.length})
                </button>

                <button
                  type="button"
                  onClick={() => void handleLeavePokerRoom()}
                  className="px-2.5 py-1 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 text-[11px] font-bold cursor-pointer"
                >
                  Sair da Mesa
                </button>
              </div>
            </div>
          )}

          {activeRoom && !isFirestoreRoom && showAddLocalPlayer && (
            <div className="flex items-center gap-2 text-xs text-orange-200 flex-wrap border-t border-orange-500/20 pt-1.5">
              <span className="font-bold text-amber-300">Adicionar Jogador Local:</span>
              <select
                value={selectedUserToJoin}
                onChange={(e) => setSelectedUserToJoin(e.target.value)}
                className="px-2 py-1 rounded-lg bg-[#200805] border border-orange-500/35 text-xs text-orange-100 focus:outline-none focus:border-amber-400"
              >
                <option value="">Selecione...</option>
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
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer disabled:opacity-40"
              >
                + Sentar
              </button>
            </div>
          )}

          {activeRoom && showChatDrawer && (
            <div className="border-t border-orange-500/20 pt-1.5">
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
            </div>
          )}
        </div>
      )}

      {/* DUAL-LAYER POKER TABLE (Image 1: Mahogany Rim SVG, Image 2: Velvet Felt SVG) */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl flex-1 min-h-0 flex flex-col justify-between p-2 sm:p-3 select-none">
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
        <div className="relative z-10 flex flex-col justify-between h-full min-h-0 gap-1">
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
            /* ================= MULTIPLAYER VIEW (SYNCED VIA FIRESTORE estadoJogo) ================= */
            <>
              {/* Header: Turn banner & Community Pot */}
              <div className="shrink-0 flex items-center justify-between border-b border-amber-500/20 pb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-[0_0_8px_#34d399]" />
                  <span className="text-xs font-bold text-amber-300 truncate">
                    Mesa: <strong className="text-white">{activeRoom?.name || 'Selecione uma Sala'}</strong> ·{' '}
                    {multiStage === 'WAITING' ? (
                      <strong className="text-orange-200">Aguardando Início</strong>
                    ) : multiStage === 'SHOWDOWN' ? (
                      <strong className="text-amber-300">Showdown</strong>
                    ) : (
                      <>
                        Vez de:{' '}
                        <strong className="text-amber-400 uppercase font-black">
                          {currentTurnPlayer?.username || 'Jogador'}
                          {isFirestoreRoom && currentTurnPlayer?.uid === effectiveUid ? ' (Sua Vez!)' : ''}
                        </strong>
                      </>
                    )}
                  </span>
                </div>

                <div className="shrink-0 bg-[#260905] border border-amber-500/60 px-3 py-0.5 rounded-full flex items-center gap-1.5 shadow">
                  <span className="text-xs">🪙</span>
                  <span className="font-mono text-xs font-black text-amber-300">
                    Pote: {multiPot.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* 5 Community Cards Center */}
              <div className="shrink-0 text-center my-0.5">
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[60px]">
                  {multiCommunityCards.length === 0
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="w-12 h-17 rounded-lg border border-dashed border-amber-400/25" />
                      ))
                    : multiCommunityCards.map((c, i) => (
                        <PlayingCard
                          key={c.id || i}
                          card={c}
                          hidden={i >= multiRevealedCount}
                          flipDelayMs={i < 3 ? i * 220 : 0}
                          size="xs"
                          floating={false}
                        />
                      ))}
                </div>
              </div>

              {/* Seated Players Grid (Up to 8 Players from Firestore estadoJogo) */}
              <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 gap-1.5 my-0.5 content-start">
                {tablePlayers.slice(0, 8).map((p, idx) => {
                  const isTurn = idx === activePlayerIndex && multiStage !== 'SHOWDOWN' && multiStage !== 'WAITING';
                  const isMe = isFirestoreRoom && Boolean(effectiveUid) && p.uid === effectiveUid;
                  const showFace =
                    (multiStage === 'SHOWDOWN' && !p.folded) ||
                    (isFirestoreRoom ? (isMe && !hideMyHoleCards) : (isTurn && peekHoleCards));

                  return (
                    <div
                      key={p.uid || p.username}
                      className={`p-1.5 rounded-xl border text-xs transition-all relative flex flex-col justify-between ${
                        isTurn
                          ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400 shadow-lg'
                          : isMe
                          ? 'bg-[#260b07] border-amber-500/50'
                          : p.folded
                          ? 'bg-black/50 border-slate-800 opacity-45'
                          : 'bg-[#180503]/90 border-orange-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-orange-100 truncate text-[11px]">
                          {p.username}{isMe ? ' (Você)' : ''}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {p.currentStreetBet > 0 && (
                            <span className="text-[9px] font-mono bg-amber-950/90 text-amber-300 border border-amber-500/40 px-1 rounded">
                              {p.currentStreetBet}
                            </span>
                          )}
                          {p.isDealer && <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1 rounded">D</span>}
                        </div>
                      </div>

                      <div className="font-mono text-[10px] text-amber-300 font-extrabold leading-tight">
                        🪙 {p.chips.toLocaleString('pt-BR')}
                      </div>

                      <div className="flex items-center gap-1 mt-1 justify-center min-h-[54px]">
                        {p.folded ? (
                          <span className="text-[10px] text-red-400 font-black tracking-wider">FOLD</span>
                        ) : Array.isArray(p.holeCards) && p.holeCards.length > 0 ? (
                          p.holeCards.map((c, ci) => (
                            <PlayingCard
                              key={c.id || `${p.uid || p.username}-${ci}`}
                              card={c}
                              hidden={!showFace}
                              size="xs"
                              floating={false}
                              tilt3d={false}
                              skipInitialFlip={isFirestoreRoom && isMe && !hideMyHoleCards}
                            />
                          ))
                        ) : (
                          <span className="text-[10px] text-orange-300/45 italic">Na mesa</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Showdown Winner Message */}
              {multiWinnerMsg && (
                <div className="shrink-0 text-center py-1 px-2 bg-amber-500/20 border border-amber-400 rounded-xl text-xs font-bold text-amber-200 truncate">
                  {multiWinnerMsg}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* COMPACT ACTION CONTROLS (ALWAYS VISIBLE IN 100VH) */}
      <div className="shrink-0 bg-[#180705] border border-orange-500/30 rounded-2xl p-2 shadow-xl">
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
          /* ================= MULTIPLAYER CONTROLS ================= */
          !activeRoom ? (
            <div className="text-center text-xs text-orange-200/80 py-1.5">
              Crie uma sala ou clique em uma mesa aberta acima para jogar com outros jogadores em tempo real.
            </div>
          ) : multiStage === 'WAITING' || multiStage === 'SHOWDOWN' ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-orange-200">
                <span className="font-bold text-amber-300">Na Mesa ({tablePlayers.length}/8):</span>
                {tablePlayers.map(p => (
                  <span key={p.uid || p.username} className="px-2 py-0.5 rounded-md bg-[#250d09] border border-orange-500/30 text-white font-mono text-[11px] font-bold">
                    {p.username}
                  </span>
                ))}
              </div>

              {isRoomHost ? (
                <button
                  type="button"
                  onClick={startNewMultiplayerHand}
                  disabled={tablePlayers.length < 2}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 shrink-0"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{multiStage === 'SHOWDOWN' ? 'Nova Mão de Pôquer 🃏' : `Iniciar Partida (${tablePlayers.length} Jogadores) 🃏`}</span>
                </button>
              ) : (
                <div className="px-4 py-2 rounded-xl bg-[#250d09] border border-amber-500/35 text-amber-200 text-xs font-bold text-center shrink-0">
                  {tablePlayers.length < 2
                    ? 'Aguardando mais jogadores...'
                    : `Aguardando anfitrião (${activeRoom.host}) iniciar...`}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <ChipSelector
                currentBet={multiRaiseAmount}
                balance={tablePlayers[activePlayerIndex]?.chips || 0}
                onBetChange={setMultiRaiseAmount}
                label={`Raise (${tablePlayers[activePlayerIndex]?.username || 'Vez'}):`}
                showInput={true}
                showDouble={false}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                {isFirestoreRoom ? (
                  <button
                    type="button"
                    onClick={() => setHideMyHoleCards(prev => !prev)}
                    className="px-3 py-1.5 rounded-xl bg-[#2a0e08] hover:bg-[#3d140b] border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {hideMyHoleCards ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <span>{hideMyHoleCards ? 'Mostrar Minhas Cartas' : 'Ocultar Minhas Cartas'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPeekHoleCards(prev => !prev)}
                    className="px-3 py-1.5 rounded-xl bg-[#2a0e08] hover:bg-[#3d140b] border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {peekHoleCards ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    <span>{peekHoleCards ? 'Ocultar Cartas' : `Espiar Cartas (${tablePlayers[activePlayerIndex]?.username})`}</span>
                  </button>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {isFirestoreRoom && !isMyTurn && (
                    <span className="text-[11px] font-bold text-amber-300/90 px-2">
                      Aguardando vez de {currentTurnPlayer?.username}...
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleMultiFold}
                    disabled={!isMyTurn}
                    className="px-3.5 py-1.5 rounded-xl bg-red-950/90 hover:bg-red-900 border border-red-500/60 text-red-200 font-bold text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 shadow disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Fold</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleMultiCallOrCheck}
                    disabled={!isMyTurn}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-400 text-white font-bold text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 shadow disabled:opacity-40 disabled:cursor-not-allowed"
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
                    disabled={!isMyTurn || multiRaiseAmount <= 0 || multiRaiseAmount > (tablePlayers[activePlayerIndex]?.chips || 0)}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
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
