import React, { useState, useRef, useEffect } from 'react';
import { Card, UserAccount } from '../types/casino';
import { createDeck, shuffleDeck, calculateBlackjackScore } from '../utils/cards';
import { soundManager } from '../utils/audio';
import { reportRoundLoss } from '../utils/luckyStreak';
import { PlayingCard } from '../components/PlayingCard';
import { ChipSelector } from '../components/ChipSelector';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { CardVictoryModal } from '../components/CardVictoryModal';
import {
  ArrowLeft,
  Play,
  Hand,
  Plus,
  RotateCcw,
  HelpCircle,
  Users,
  DoorOpen,
  UserCheck,
  Crown,
  Loader2,
  LogIn
} from 'lucide-react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import {
  connectRoomPresence,
  subscribeRoomRealtime,
  subscribeEstadoJogoRtdb,
  enviarJogadaRtdb,
  sendRoomChatMessage,
  updateRoomTurnTimer,
  PlayerPresence,
  RoomChatMessage,
  RoomTimerState,
  RtdbEstadoJogo
} from '../utils/rtdbRoom';
import { RoomChatAndPresence } from '../components/RoomChatAndPresence';

interface BlackjackGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'blackjack', betAmount?: number) => void;
  onBackToLobby: () => void;
  currentUser?: UserAccount | null;
  firebaseUid?: string | null;
  onRequestLogin?: () => void;
}

type RoundStatus = 'BETTING' | 'PLAYER_TURN' | 'DEALER_TURN' | 'ENDED';
type BlackjackMode = 'SOLO' | 'MULTIPLAYER';
type MultiStatus = 'aguardando' | 'jogando' | 'finalizado';

interface PlayerResultInfo {
  outcome: 'WIN' | 'LOSS' | 'PUSH' | 'BLACKJACK';
  payout: number;
  score: number;
  message: string;
}

interface PlayerMetaInfo {
  uid: string;
  nome: string;
  avatar: string;
  aposta: number;
}

interface BlackjackEstadoJogo {
  baralho: Card[];
  maoDealer: Card[];
  maosJogadores: Record<string, Card[]>;
  apostasJogadores?: Record<string, number>;
  jogadoresFinalizados?: string[];
  resultadosJogadores?: Record<string, PlayerResultInfo>;
  turnoAtual: string | null;
  status: MultiStatus;
  roundId?: number;
  mensagem?: string;
}

interface BlackjackSala {
  id: string;
  nome: string;
  jogo: 'blackjack';
  criadorId: string;
  criadorNome: string;
  jogadores: string[];
  jogadoresInfo?: Record<string, PlayerMetaInfo>;
  maxJogadores: number;
  status: MultiStatus;
  apostaMinima?: number;
  estadoJogo: BlackjackEstadoJogo;
  criadoEm?: unknown;
  atualizadoEm?: unknown;
}

const MAX_BLACKJACK_PLAYERS = 4;

export const BlackjackGame: React.FC<BlackjackGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby,
  currentUser,
  firebaseUid,
  onRequestLogin
}) => {
  const [gameMode, setGameMode] = useState<BlackjackMode>('SOLO');

  // ---------------- SINGLE-PLAYER STATE (PRESERVED) ----------------
  const [bet, setBet] = useState<number>(50);
  const [status, setStatus] = useState<RoundStatus>('BETTING');
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [resultMessage, setResultMessage] = useState<string>('');
  const [resultOutcome, setResultOutcome] = useState<'WIN' | 'LOSS' | 'PUSH' | 'BLACKJACK' | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [victoryModal, setVictoryModal] = useState<{ winAmount: number; subtitle: string; detail: string } | null>(null);
  const victoryTimerRef = useRef<number | null>(null);

  // ---------------- MULTIPLAYER FIRESTORE STATE ----------------
  const [rooms, setRooms] = useState<BlackjackSala[]>([]);
  const [roomsLoading, setRoomsLoading] = useState<boolean>(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<BlackjackSala | null>(null);
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [multiBet, setMultiBet] = useState<number>(50);
  const [multiBusy, setMultiBusy] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const chargedRoundRef = useRef<number>(0);
  const settledRoundRef = useRef<number>(0);
  const [rtdbPresence, setRtdbPresence] = useState<Record<string, PlayerPresence>>({});
  const [rtdbChat, setRtdbChat] = useState<RoomChatMessage[]>([]);
  const [rtdbTimer, setRtdbTimer] = useState<RoomTimerState | null>(null);
  const [rtdbEstadoLive, setRtdbEstadoLive] = useState<RtdbEstadoJogo | null>(null);
  const [myReady, setMyReady] = useState<boolean>(false);
  const presenceHandleRef = useRef<{ setReady: (pronto: boolean) => Promise<void>; disconnect: () => Promise<void> } | null>(null);
  const lastTimerTurnRef = useRef<string>('');

  const effectiveUid = firebaseUid || auth.currentUser?.uid || null;
  const playerName = (currentUser?.nickname || currentUser?.username || auth.currentUser?.displayName || 'Jogador').slice(0, 32);
  const playerAvatar = (currentUser?.avatar || '🦁').slice(0, 16);

  useEffect(() => {
    return () => {
      if (victoryTimerRef.current) window.clearTimeout(victoryTimerRef.current);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const scheduleVictoryModal = (winAmount: number, subtitle: string, detail: string, delayMs: number) => {
    if (victoryTimerRef.current) window.clearTimeout(victoryTimerRef.current);
    victoryTimerRef.current = window.setTimeout(() => {
      setVictoryModal({ winAmount, subtitle, detail });
    }, delayMs);
  };

  // ---------------- SINGLE-PLAYER LOGIC (UNCHANGED) ----------------
  const startRound = () => {
    if (bet <= 0 || bet > balance) return;

    if (victoryTimerRef.current) window.clearTimeout(victoryTimerRef.current);
    setVictoryModal(null);
    soundManager.playShuffle();

    onUpdateBalance(-bet, false, 'blackjack');

    const newDeck = shuffleDeck(createDeck());
    const pCard1 = newDeck.pop()!;
    const dCard1 = newDeck.pop()!;
    const pCard2 = newDeck.pop()!;
    const dCard2 = newDeck.pop()!;

    const initialPlayer = [pCard1, pCard2];
    const initialDealer = [dCard1, dCard2];

    setPlayerHand(initialPlayer);
    setDealerHand(initialDealer);
    setDeck(newDeck);
    setResultOutcome(null);
    setResultMessage('');

    const playerScore = calculateBlackjackScore(initialPlayer);
    const dealerScore = calculateBlackjackScore(initialDealer);

    if (playerScore.isBlackjack) {
      if (dealerScore.isBlackjack) {
        setStatus('ENDED');
        setResultOutcome('PUSH');
        setResultMessage('Ambos têm Blackjack! Empate (Push).');
        soundManager.playLoss();
        onUpdateBalance(bet, false, 'blackjack');
      } else {
        setStatus('ENDED');
        setResultOutcome('BLACKJACK');
        const payout = Math.floor(bet * 2.5);
        setResultMessage(`BLACKJACK NATURAL! Você ganhou ${payout} fichas!`);
        soundManager.playJackpot();
        onUpdateBalance(payout, true, 'blackjack');
        scheduleVictoryModal(payout, 'BLACKJACK IMPERIAL · 21 NATURAL!', 'Mão Perfeita · Pagamento 3:2', 1450);
      }
    } else {
      setStatus('PLAYER_TURN');
    }
  };

  const handleHit = () => {
    if (status !== 'PLAYER_TURN' || deck.length === 0) return;

    soundManager.playCardDeal();
    const newDeck = [...deck];
    const newCard = newDeck.pop()!;
    const newHand = [...playerHand, newCard];

    setPlayerHand(newHand);
    setDeck(newDeck);

    const score = calculateBlackjackScore(newHand);
    if (score.isBust) {
      setStatus('ENDED');
      setResultOutcome('LOSS');
      setResultMessage(`Estourou com ${score.score}! O Dealer vence.`);
      soundManager.playLoss();
      reportRoundLoss('blackjack');
    } else if (score.score === 21) {
      handleStand(newHand, newDeck);
    }
  };

  const handleDoubleDown = () => {
    if (status !== 'PLAYER_TURN' || playerHand.length !== 2 || balance < bet) return;

    onUpdateBalance(-bet, false, 'blackjack');
    const doubledBet = bet * 2;
    setBet(doubledBet);

    soundManager.playCardDeal();
    const newDeck = [...deck];
    const newCard = newDeck.pop()!;
    const newHand = [...playerHand, newCard];
    setPlayerHand(newHand);
    setDeck(newDeck);

    const score = calculateBlackjackScore(newHand);
    if (score.isBust) {
      setStatus('ENDED');
      setResultOutcome('LOSS');
      setResultMessage(`Estourou com ${score.score} no Dobro!`);
      soundManager.playLoss();
      reportRoundLoss('blackjack');
    } else {
      handleStand(newHand, newDeck, doubledBet);
    }
  };

  const handleStand = (
    currentPlayerHand = playerHand,
    currentDeck = deck,
    currentBetValue = bet
  ) => {
    setStatus('DEALER_TURN');

    let dHand = [...dealerHand];
    let dDeck = [...currentDeck];
    let dScore = calculateBlackjackScore(dHand);
    const prevDealerLen = dHand.length;

    while (dScore.score < 17 && dDeck.length > 0) {
      const nextCard = dDeck.pop()!;
      dHand.push(nextCard);
      dScore = calculateBlackjackScore(dHand);
    }

    setDealerHand(dHand);
    setDeck(dDeck);
    setStatus('ENDED');

    const newlyFlippedDealerCount = Math.max(1, dHand.length - prevDealerLen + 1);
    const flipWaitMs = (newlyFlippedDealerCount - 1) * 300 + 620;

    const pScore = calculateBlackjackScore(currentPlayerHand);

    if (dScore.isBust) {
      const payout = currentBetValue * 2;
      setResultOutcome('WIN');
      setResultMessage(`Dealer estourou com ${dScore.score}! Você venceu!`);
      soundManager.playWin();
      onUpdateBalance(payout, true, 'blackjack');
      scheduleVictoryModal(payout, 'BLACKJACK IMPERIAL (21)', `Crupiê estourou com ${dScore.score}`, flipWaitMs);
    } else if (pScore.score > dScore.score) {
      const payout = currentBetValue * 2;
      setResultOutcome('WIN');
      setResultMessage(`Você venceu! (${pScore.score} vs ${dScore.score} do Dealer)`);
      soundManager.playWin();
      onUpdateBalance(payout, true, 'blackjack');
      scheduleVictoryModal(payout, 'BLACKJACK IMPERIAL (21)', `Placar: ${pScore.score} contra ${dScore.score}`, flipWaitMs);
    } else if (pScore.score < dScore.score) {
      setResultOutcome('LOSS');
      setResultMessage(`Dealer venceu (${dScore.score} vs ${pScore.score}).`);
      soundManager.playLoss();
      reportRoundLoss('blackjack');
    } else {
      setResultOutcome('PUSH');
      setResultMessage(`Empate em ${pScore.score} pontos! Fichas devolvidas.`);
      soundManager.playLoss();
      onUpdateBalance(currentBetValue, false, 'blackjack');
    }
  };

  // ---------------- MULTIPLAYER FIRESTORE LISTENERS ----------------
  // 1. Listen to open Blackjack rooms list when in Multiplayer Lobby
  useEffect(() => {
    if (gameMode !== 'MULTIPLAYER' || activeRoomId || !effectiveUid) {
      return;
    }

    setRoomsLoading(true);
    const unsub = onSnapshot(
      collection(db, 'salas'),
      (snapshot) => {
        const loaded: BlackjackSala[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Omit<BlackjackSala, 'id'>;
          if (data.jogo !== 'blackjack') return;
          loaded.push({
            ...data,
            id: docSnap.id
          });
        });

        loaded.sort((a, b) => {
          const getTs = (v: unknown) => {
            if (v && typeof v === 'object' && 'toMillis' in v) {
              return (v as { toMillis: () => number }).toMillis();
            }
            return typeof v === 'number' ? v : 0;
          };
          return getTs(b.atualizadoEm || b.criadoEm) - getTs(a.atualizadoEm || a.criadoEm);
        });

        setRooms(loaded);
        setRoomsLoading(false);
      },
      (error) => {
        setRoomsLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'salas');
      }
    );

    return () => unsub();
  }, [gameMode, activeRoomId, effectiveUid]);

  // 2. Listen to active room document in real time with onSnapshot
  useEffect(() => {
    if (gameMode !== 'MULTIPLAYER' || !activeRoomId || !effectiveUid) {
      setActiveRoom(null);
      return;
    }

    const roomPath = `salas/${activeRoomId}`;
    const roomRef = doc(db, 'salas', activeRoomId);
    const unsub = onSnapshot(
      roomRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          setActiveRoom(null);
          setActiveRoomId(null);
          showToast('A sala foi encerrada.');
          return;
        }
        const data = docSnap.data() as Omit<BlackjackSala, 'id'>;
        setActiveRoom({
          ...data,
          id: docSnap.id
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, roomPath);
      }
    );

    return () => unsub();
  }, [gameMode, activeRoomId, effectiveUid]);

  // 3. Automatic bet deduction & payout settlement for the local authenticated player
  useEffect(() => {
    if (!activeRoom || !effectiveUid) return;
    const estado = activeRoom.estadoJogo;
    const roundId = estado?.roundId || 0;
    if (roundId <= 0) return;

    const myHand = estado.maosJogadores?.[effectiveUid];
    const myBet = estado.apostasJogadores?.[effectiveUid] || 0;
    if (!myHand || myBet <= 0) return;

    let didChargeJustNow = false;
    if ((estado.status === 'jogando' || estado.status === 'finalizado') && chargedRoundRef.current !== roundId) {
      chargedRoundRef.current = roundId;
      didChargeJustNow = true;
      onUpdateBalance(-myBet, false, 'blackjack', myBet);
    }

    if (estado.status === 'finalizado' && settledRoundRef.current !== roundId) {
      settledRoundRef.current = roundId;
      const myRes = estado.resultadosJogadores?.[effectiveUid];
      if (!myRes) return;

      const applySettlement = () => {
        if (myRes.payout > 0) {
          const isWin = myRes.outcome === 'WIN' || myRes.outcome === 'BLACKJACK';
          onUpdateBalance(myRes.payout, isWin, 'blackjack', myBet);
          if (myRes.outcome === 'BLACKJACK') {
            soundManager.playJackpot();
            scheduleVictoryModal(
              myRes.payout,
              'BLACKJACK MULTIPLAYER · 21 NATURAL!',
              'Mão Perfeita · Pagamento 3:2',
              1100
            );
          } else if (myRes.outcome === 'WIN') {
            soundManager.playWin();
            scheduleVictoryModal(
              myRes.payout,
              'BLACKJACK MULTIPLAYER (21)',
              myRes.message,
              950
            );
          } else {
            soundManager.playLoss();
          }
        } else {
          soundManager.playLoss();
          reportRoundLoss('blackjack');
        }
      };

      if (didChargeJustNow) {
        window.setTimeout(applySettlement, 80);
      } else {
        applySettlement();
      }
    }
  }, [activeRoom, effectiveUid]);

  // 4. Realtime Database ultra-fast presence, chat & dynamic turn timer
  useEffect(() => {
    if (gameMode !== 'MULTIPLAYER' || !activeRoomId || !effectiveUid) {
      setRtdbPresence({});
      setRtdbChat([]);
      setRtdbTimer(null);
      setRtdbEstadoLive(null);
      setMyReady(false);
      lastTimerTurnRef.current = '';
      return;
    }

    const presence = connectRoomPresence(activeRoomId, effectiveUid, playerName);
    presenceHandleRef.current = presence;

    const unsubRtdb = subscribeRoomRealtime(activeRoomId, (snap) => {
      setRtdbPresence(snap.statusJogadores);
      setRtdbChat(snap.chat);
      setRtdbTimer(snap.timer);
    });

    const unsubEstadoRtdb = subscribeEstadoJogoRtdb(activeRoomId, (estadoAtual) => {
      setRtdbEstadoLive(estadoAtual);
    });

    return () => {
      unsubRtdb();
      unsubEstadoRtdb();
      void presence.disconnect();
      presenceHandleRef.current = null;
    };
  }, [gameMode, activeRoomId, effectiveUid, playerName]);

  // Keep RTDB turn timer synchronized with Firestore estadoJogo.turnoAtual
  useEffect(() => {
    if (!activeRoom || !activeRoomId || !effectiveUid) return;
    const estado = activeRoom.estadoJogo;
    const turnKey =
      estado.status === 'jogando' && estado.turnoAtual
        ? `${estado.roundId || 0}:${estado.turnoAtual}:${estado.maosJogadores?.[estado.turnoAtual]?.length || 0}`
        : 'none';

    if (turnKey === lastTimerTurnRef.current) return;
    lastTimerTurnRef.current = turnKey;

    if (estado.status === 'jogando' && estado.turnoAtual) {
      // Only the host or active turn player writes the turn timer to prevent duplicate writes
      if (activeRoom.criadorId === effectiveUid || estado.turnoAtual === effectiveUid) {
        void updateRoomTurnTimer(activeRoomId, estado.turnoAtual, 25);
      }
    } else if (activeRoom.criadorId === effectiveUid) {
      void updateRoomTurnTimer(activeRoomId, null);
    }
  }, [activeRoom, activeRoomId, effectiveUid]);

  // ---------------- MULTIPLAYER ACTIONS ----------------
  const handleCreateRoom = async () => {
    if (!effectiveUid) {
      onRequestLogin?.();
      return;
    }
    const cleanName = newRoomName.trim() || `Mesa Blackjack de ${playerName}`;
    if (multiBet <= 0 || multiBet > balance) {
      showToast('Escolha uma aposta válida dentro do seu saldo!');
      return;
    }

    setMultiBusy(true);
    try {
      const newDocRef = await addDoc(collection(db, 'salas'), {
        nome: cleanName.slice(0, 60),
        jogo: 'blackjack',
        criadorId: effectiveUid,
        criadorNome: playerName,
        jogadores: [effectiveUid],
        jogadoresInfo: {
          [effectiveUid]: {
            uid: effectiveUid,
            nome: playerName,
            avatar: playerAvatar,
            aposta: multiBet
          }
        },
        maxJogadores: MAX_BLACKJACK_PLAYERS,
        status: 'aguardando',
        apostaMinima: multiBet,
        estadoJogo: {
          baralho: [],
          maoDealer: [],
          maosJogadores: {},
          apostasJogadores: {},
          jogadoresFinalizados: [],
          resultadosJogadores: {},
          turnoAtual: null,
          status: 'aguardando',
          roundId: 0,
          mensagem: 'Aguardando o anfitrião distribuir as cartas...'
        },
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });

      soundManager.playClick();
      setNewRoomName('');
      chargedRoundRef.current = 0;
      settledRoundRef.current = 0;
      setActiveRoomId(newDocRef.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.CREATE, 'salas');
      }
      showToast('Não foi possível criar a sala no Firestore.');
    } finally {
      setMultiBusy(false);
    }
  };

  const handleJoinRoom = async (room: BlackjackSala) => {
    if (!effectiveUid) {
      onRequestLogin?.();
      return;
    }
    const alreadyIn = room.jogadores.includes(effectiveUid);
    if (!alreadyIn) {
      if (room.status === 'jogando') {
        showToast('Esta mesa já está com uma rodada em andamento. Aguarde ou entre em outra sala.');
        return;
      }
      if (room.jogadores.length >= (room.maxJogadores || MAX_BLACKJACK_PLAYERS)) {
        showToast('Mesa cheia (máximo 4 jogadores)!');
        return;
      }
    }

    setMultiBusy(true);
    const roomPath = `salas/${room.id}`;
    try {
      if (!alreadyIn) {
        await updateDoc(doc(db, 'salas', room.id), {
          jogadores: arrayUnion(effectiveUid),
          [`jogadoresInfo.${effectiveUid}`]: {
            uid: effectiveUid,
            nome: playerName,
            avatar: playerAvatar,
            aposta: Math.min(balance > 0 ? balance : 50, room.apostaMinima || 50)
          },
          atualizadoEm: serverTimestamp()
        });
      }

      soundManager.playChip();
      chargedRoundRef.current = 0;
      settledRoundRef.current = 0;
      setMultiBet(room.apostaMinima || 50);
      setActiveRoomId(room.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }
      showToast('Erro ao entrar na sala.');
    } finally {
      setMultiBusy(false);
    }
  };

  const handleUpdateMyRoomBet = async (nextBetValue: number) => {
    setMultiBet(nextBetValue);
    if (!activeRoom || !effectiveUid) return;
    if (activeRoom.estadoJogo.status === 'jogando') return;

    const roomPath = `salas/${activeRoom.id}`;
    const nextInfo = {
      ...(activeRoom.jogadoresInfo || {}),
      [effectiveUid]: {
        uid: effectiveUid,
        nome: playerName,
        avatar: playerAvatar,
        aposta: nextBetValue
      }
    };

    try {
      await updateDoc(doc(db, 'salas', activeRoom.id), {
        jogadoresInfo: nextInfo,
        atualizadoEm: serverTimestamp()
      });
      void enviarJogadaRtdb(activeRoom.id, {
        apostaAtual: nextBetValue,
        ultimaAcao: `${playerName} ajustou aposta para ${nextBetValue} fichas`
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }
    }
  };

  // Resolve Dealer play & evaluate all seated players
  const resolveDealerAndFinish = (
    currentBaralho: Card[],
    currentDealerHand: Card[],
    maosJogadores: Record<string, Card[]>,
    apostasJogadores: Record<string, number>,
    jogadores: string[],
    jogadoresInfo: Record<string, PlayerMetaInfo> | undefined,
    roundId: number
  ): BlackjackEstadoJogo => {
    const dDeck = [...currentBaralho];
    const dHand = [...currentDealerHand];
    let dScore = calculateBlackjackScore(dHand);

    while (dScore.score < 17 && dDeck.length > 0) {
      dHand.push(dDeck.pop()!);
      dScore = calculateBlackjackScore(dHand);
    }

    const resultadosJogadores: Record<string, PlayerResultInfo> = {};
    const winners: string[] = [];

    for (const pUid of jogadores) {
      const pHand = maosJogadores[pUid] || [];
      const pBet = apostasJogadores[pUid] || 50;
      const pEval = calculateBlackjackScore(pHand);
      const pName = jogadoresInfo?.[pUid]?.nome || 'Jogador';

      if (pEval.isBust) {
        resultadosJogadores[pUid] = {
          outcome: 'LOSS',
          payout: 0,
          score: pEval.score,
          message: `Estourou com ${pEval.score}`
        };
      } else if (pEval.isBlackjack && !dScore.isBlackjack) {
        const payout = Math.floor(pBet * 2.5);
        winners.push(`${pName} (Blackjack!)`);
        resultadosJogadores[pUid] = {
          outcome: 'BLACKJACK',
          payout,
          score: pEval.score,
          message: `Blackjack Natural 3:2 (+${payout})`
        };
      } else if (dScore.isBlackjack && !pEval.isBlackjack) {
        resultadosJogadores[pUid] = {
          outcome: 'LOSS',
          payout: 0,
          score: pEval.score,
          message: `Dealer fez Blackjack (${pEval.score} vs 21)`
        };
      } else if (dScore.isBust || pEval.score > dScore.score) {
        const payout = pBet * 2;
        winners.push(pName);
        resultadosJogadores[pUid] = {
          outcome: 'WIN',
          payout,
          score: pEval.score,
          message: dScore.isBust
            ? `Dealer estourou (${dScore.score}) · +${payout}`
            : `Venceu ${pEval.score} vs ${dScore.score} · +${payout}`
        };
      } else if (pEval.score === dScore.score) {
        resultadosJogadores[pUid] = {
          outcome: 'PUSH',
          payout: pBet,
          score: pEval.score,
          message: `Empate em ${pEval.score} (devolvido)`
        };
      } else {
        resultadosJogadores[pUid] = {
          outcome: 'LOSS',
          payout: 0,
          score: pEval.score,
          message: `Dealer venceu (${dScore.score} vs ${pEval.score})`
        };
      }
    }

    const summaryMsg =
      winners.length > 0
        ? `Rodada finalizada! Vencedor(es): ${winners.join(', ')} | Dealer: ${dScore.score}${dScore.isBust ? ' (Bust)' : ''}`
        : `Rodada finalizada! Dealer fez ${dScore.score}${dScore.isBust ? ' (Bust)' : ''}.`;

    return {
      baralho: dDeck,
      maoDealer: dHand,
      maosJogadores,
      apostasJogadores,
      jogadoresFinalizados: [...jogadores],
      resultadosJogadores,
      turnoAtual: null,
      status: 'finalizado',
      roundId,
      mensagem: summaryMsg
    };
  };

  const handleMultiStartRound = async () => {
    if (!activeRoom || !effectiveUid) return;
    if (activeRoom.criadorId !== effectiveUid) {
      showToast('Apenas o anfitrião da sala pode distribuir as cartas!');
      return;
    }
    if (balance < multiBet || multiBet <= 0) {
      showToast('Saldo insuficiente para iniciar a rodada!');
      return;
    }

    setMultiBusy(true);
    setVictoryModal(null);
    soundManager.playShuffle();

    const freshDeck = shuffleDeck(createDeck());
    const maoDealer = [freshDeck.pop()!, freshDeck.pop()!];
    const maosJogadores: Record<string, Card[]> = {};
    const apostasJogadores: Record<string, number> = {};
    const jogadoresFinalizados: string[] = [];

    for (const pUid of activeRoom.jogadores) {
      const hand = [freshDeck.pop()!, freshDeck.pop()!];
      maosJogadores[pUid] = hand;
      const configuredBet = pUid === effectiveUid
        ? multiBet
        : activeRoom.jogadoresInfo?.[pUid]?.aposta || activeRoom.apostaMinima || 50;
      apostasJogadores[pUid] = Math.max(10, configuredBet);

      const evalHand = calculateBlackjackScore(hand);
      if (evalHand.isBlackjack || evalHand.score === 21) {
        jogadoresFinalizados.push(pUid);
      }
    }

    const nextTurn = activeRoom.jogadores.find((uid) => !jogadoresFinalizados.includes(uid)) || null;
    const nextRoundId = (activeRoom.estadoJogo?.roundId || 0) + 1;

    let nextEstado: BlackjackEstadoJogo;
    let nextStatus: MultiStatus;

    if (!nextTurn) {
      nextEstado = resolveDealerAndFinish(
        freshDeck,
        maoDealer,
        maosJogadores,
        apostasJogadores,
        activeRoom.jogadores,
        activeRoom.jogadoresInfo,
        nextRoundId
      );
      nextStatus = 'finalizado';
    } else {
      const turnName = activeRoom.jogadoresInfo?.[nextTurn]?.nome || 'Jogador';
      nextEstado = {
        baralho: freshDeck,
        maoDealer,
        maosJogadores,
        apostasJogadores,
        jogadoresFinalizados,
        resultadosJogadores: {},
        turnoAtual: nextTurn,
        status: 'jogando',
        roundId: nextRoundId,
        mensagem: `Cartas distribuídas! Vez de ${turnName}.`
      };
      nextStatus = 'jogando';
    }

    const roomPath = `salas/${activeRoom.id}`;
    try {
      await updateDoc(doc(db, 'salas', activeRoom.id), {
        status: nextStatus,
        estadoJogo: nextEstado,
        atualizadoEm: serverTimestamp()
      });
      void enviarJogadaRtdb(activeRoom.id, {
        apostaAtual: multiBet,
        turnoAtual: nextEstado.turnoAtual,
        status: nextEstado.status,
        ultimaAcao: nextEstado.mensagem,
        roundId: nextEstado.roundId
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }
      showToast('Erro ao iniciar a rodada no Firestore.');
    } finally {
      setMultiBusy(false);
    }
  };

  const handleMultiHit = async () => {
    if (!activeRoom || !effectiveUid) return;
    const estado = activeRoom.estadoJogo;
    if (estado.status !== 'jogando' || estado.turnoAtual !== effectiveUid) return;
    if (!estado.baralho || estado.baralho.length === 0) return;

    setMultiBusy(true);
    soundManager.playCardDeal();

    const nextDeck = [...estado.baralho];
    const drawnCard = nextDeck.pop()!;
    const currentHand = estado.maosJogadores[effectiveUid] || [];
    const updatedHand = [...currentHand, drawnCard];
    const updatedMaos = {
      ...estado.maosJogadores,
      [effectiveUid]: updatedHand
    };

    const score = calculateBlackjackScore(updatedHand);
    const finished = [...(estado.jogadoresFinalizados || [])];

    if (score.isBust || score.score === 21) {
      if (!finished.includes(effectiveUid)) finished.push(effectiveUid);
    }

    const nextTurn =
      score.isBust || score.score === 21
        ? activeRoom.jogadores.find((uid) => !finished.includes(uid)) || null
        : effectiveUid;

    let nextEstado: BlackjackEstadoJogo;
    let nextStatus: MultiStatus;

    if (!nextTurn) {
      nextEstado = resolveDealerAndFinish(
        nextDeck,
        estado.maoDealer,
        updatedMaos,
        estado.apostasJogadores || {},
        activeRoom.jogadores,
        activeRoom.jogadoresInfo,
        estado.roundId || 1
      );
      nextStatus = 'finalizado';
    } else {
      const nextTurnName = activeRoom.jogadoresInfo?.[nextTurn]?.nome || 'Jogador';
      nextEstado = {
        ...estado,
        baralho: nextDeck,
        maosJogadores: updatedMaos,
        jogadoresFinalizados: finished,
        turnoAtual: nextTurn,
        status: 'jogando',
        mensagem: score.isBust
          ? `${playerName} estourou com ${score.score}! Vez de ${nextTurnName}.`
          : score.score === 21
          ? `${playerName} fez 21! Vez de ${nextTurnName}.`
          : `${playerName} pediu carta (${score.score} pts).`
      };
      nextStatus = 'jogando';
    }

    const roomPath = `salas/${activeRoom.id}`;
    try {
      await updateDoc(doc(db, 'salas', activeRoom.id), {
        status: nextStatus,
        estadoJogo: nextEstado,
        atualizadoEm: serverTimestamp()
      });
      void enviarJogadaRtdb(activeRoom.id, {
        apostaAtual: estado.apostasJogadores?.[effectiveUid] || multiBet,
        turnoAtual: nextEstado.turnoAtual,
        status: nextEstado.status,
        ultimaAcao: nextEstado.mensagem
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }
    } finally {
      setMultiBusy(false);
    }
  };

  const handleMultiStand = async () => {
    if (!activeRoom || !effectiveUid) return;
    const estado = activeRoom.estadoJogo;
    if (estado.status !== 'jogando' || estado.turnoAtual !== effectiveUid) return;

    setMultiBusy(true);
    soundManager.playClick();

    const finished = [...(estado.jogadoresFinalizados || [])];
    if (!finished.includes(effectiveUid)) finished.push(effectiveUid);

    const nextTurn = activeRoom.jogadores.find((uid) => !finished.includes(uid)) || null;

    let nextEstado: BlackjackEstadoJogo;
    let nextStatus: MultiStatus;

    if (!nextTurn) {
      nextEstado = resolveDealerAndFinish(
        estado.baralho,
        estado.maoDealer,
        estado.maosJogadores,
        estado.apostasJogadores || {},
        activeRoom.jogadores,
        activeRoom.jogadoresInfo,
        estado.roundId || 1
      );
      nextStatus = 'finalizado';
    } else {
      const nextTurnName = activeRoom.jogadoresInfo?.[nextTurn]?.nome || 'Jogador';
      nextEstado = {
        ...estado,
        jogadoresFinalizados: finished,
        turnoAtual: nextTurn,
        status: 'jogando',
        mensagem: `${playerName} parou! Vez de ${nextTurnName}.`
      };
      nextStatus = 'jogando';
    }

    const roomPath = `salas/${activeRoom.id}`;
    try {
      await updateDoc(doc(db, 'salas', activeRoom.id), {
        status: nextStatus,
        estadoJogo: nextEstado,
        atualizadoEm: serverTimestamp()
      });
      void enviarJogadaRtdb(activeRoom.id, {
        turnoAtual: nextEstado.turnoAtual,
        status: nextEstado.status,
        ultimaAcao: nextEstado.mensagem
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }
    } finally {
      setMultiBusy(false);
    }
  };

  const handleMultiDoubleDown = async () => {
    if (!activeRoom || !effectiveUid) return;
    const estado = activeRoom.estadoJogo;
    if (estado.status !== 'jogando' || estado.turnoAtual !== effectiveUid) return;

    const currentHand = estado.maosJogadores[effectiveUid] || [];
    const currentBet = estado.apostasJogadores?.[effectiveUid] || 50;
    if (currentHand.length !== 2 || balance < currentBet || !estado.baralho.length) return;

    setMultiBusy(true);
    soundManager.playCardDeal();
    onUpdateBalance(-currentBet, false, 'blackjack', currentBet);

    const nextDeck = [...estado.baralho];
    const drawnCard = nextDeck.pop()!;
    const updatedHand = [...currentHand, drawnCard];
    const updatedMaos = {
      ...estado.maosJogadores,
      [effectiveUid]: updatedHand
    };
    const updatedBets = {
      ...(estado.apostasJogadores || {}),
      [effectiveUid]: currentBet * 2
    };

    const finished = [...(estado.jogadoresFinalizados || [])];
    if (!finished.includes(effectiveUid)) finished.push(effectiveUid);

    const nextTurn = activeRoom.jogadores.find((uid) => !finished.includes(uid)) || null;

    let nextEstado: BlackjackEstadoJogo;
    let nextStatus: MultiStatus;

    if (!nextTurn) {
      nextEstado = resolveDealerAndFinish(
        nextDeck,
        estado.maoDealer,
        updatedMaos,
        updatedBets,
        activeRoom.jogadores,
        activeRoom.jogadoresInfo,
        estado.roundId || 1
      );
      nextStatus = 'finalizado';
    } else {
      const nextTurnName = activeRoom.jogadoresInfo?.[nextTurn]?.nome || 'Jogador';
      nextEstado = {
        ...estado,
        baralho: nextDeck,
        maosJogadores: updatedMaos,
        apostasJogadores: updatedBets,
        jogadoresFinalizados: finished,
        turnoAtual: nextTurn,
        status: 'jogando',
        mensagem: `${playerName} dobrou a aposta! Vez de ${nextTurnName}.`
      };
      nextStatus = 'jogando';
    }

    const roomPath = `salas/${activeRoom.id}`;
    try {
      await updateDoc(doc(db, 'salas', activeRoom.id), {
        status: nextStatus,
        estadoJogo: nextEstado,
        atualizadoEm: serverTimestamp()
      });
      void enviarJogadaRtdb(activeRoom.id, {
        apostaAtual: currentBet * 2,
        turnoAtual: nextEstado.turnoAtual,
        status: nextEstado.status,
        ultimaAcao: nextEstado.mensagem
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }
    } finally {
      setMultiBusy(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!activeRoom || !effectiveUid) {
      setActiveRoomId(null);
      setActiveRoom(null);
      return;
    }

    const roomPath = `salas/${activeRoom.id}`;
    const remaining = activeRoom.jogadores.filter((uid) => uid !== effectiveUid);

    try {
      if (remaining.length === 0) {
        await deleteDoc(doc(db, 'salas', activeRoom.id));
      } else {
        const nextInfo = { ...(activeRoom.jogadoresInfo || {}) };
        delete nextInfo[effectiveUid];

        const nextCreatorId = activeRoom.criadorId === effectiveUid ? remaining[0] : activeRoom.criadorId;
        const nextCreatorNome =
          activeRoom.criadorId === effectiveUid
            ? nextInfo[remaining[0]]?.nome || 'Jogador'
            : activeRoom.criadorNome;

        const estado = activeRoom.estadoJogo;
        let nextEstado = estado;
        let nextStatus = activeRoom.status;

        if (estado.status === 'jogando') {
          const finished = [...(estado.jogadoresFinalizados || [])];
          if (!finished.includes(effectiveUid)) finished.push(effectiveUid);

          const nextTurn =
            estado.turnoAtual === effectiveUid
              ? remaining.find((uid) => !finished.includes(uid)) || null
              : estado.turnoAtual;

          if (!nextTurn) {
            nextEstado = resolveDealerAndFinish(
              estado.baralho,
              estado.maoDealer,
              estado.maosJogadores,
              estado.apostasJogadores || {},
              remaining,
              nextInfo,
              estado.roundId || 1
            );
            nextStatus = 'finalizado';
          } else {
            nextEstado = {
              ...estado,
              jogadoresFinalizados: finished,
              turnoAtual: nextTurn
            };
          }
        }

        await updateDoc(doc(db, 'salas', activeRoom.id), {
          jogadores: remaining,
          jogadoresInfo: nextInfo,
          criadorId: nextCreatorId,
          criadorNome: nextCreatorNome,
          status: nextStatus,
          estadoJogo: nextEstado,
          atualizadoEm: serverTimestamp()
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }
    } finally {
      soundManager.playClick();
      setActiveRoomId(null);
      setActiveRoom(null);
      chargedRoundRef.current = 0;
      settledRoundRef.current = 0;
    }
  };

  // ---------------- RENDER HELPERS ----------------
  const playerScore = calculateBlackjackScore(playerHand);
  const dealerScore = calculateBlackjackScore(dealerHand);
  const hideDealerHole = status === 'PLAYER_TURN';

  const modeToggleBar = (
    <div className="flex items-center gap-1 bg-[#120302] border border-orange-500/30 rounded-xl p-0.5">
      <button
        type="button"
        onClick={() => {
          soundManager.playClick();
          setGameMode('SOLO');
        }}
        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
          gameMode === 'SOLO'
            ? 'bg-amber-500 text-slate-950 shadow'
            : 'text-orange-200/80 hover:text-white'
        }`}
      >
        Solo vs Dealer
      </button>
      <button
        type="button"
        onClick={() => {
          soundManager.playClick();
          setGameMode('MULTIPLAYER');
        }}
        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
          gameMode === 'MULTIPLAYER'
            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow'
            : 'text-amber-300 hover:text-white'
        }`}
      >
        <Users className="w-3 h-3" />
        <span>Jogar com Jogadores Reais</span>
      </button>
    </div>
  );

  // ---------------- MULTIPLAYER ROOMS LOBBY VIEW ----------------
  if (gameMode === 'MULTIPLAYER' && !activeRoomId) {
    return (
      <div className="space-y-2.5 max-w-4xl mx-auto animate-fade-in pb-2">
        {toastMsg && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-red-950/95 border border-amber-400 text-amber-200 px-4 py-2 rounded-xl text-xs font-bold shadow-2xl">
            {toastMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToLobby}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Lobby</span>
          </button>

          {modeToggleBar}
        </div>

        <div className="casino-felt casino-wood-border rounded-xl p-3 sm:p-4 space-y-3 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
            <div>
              <h2 className="font-cinzel text-sm sm:text-base font-black text-amber-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-400" />
                <span>Salas de Blackjack Multiplayer (até 4 Jogadores)</span>
              </h2>
              <p className="text-[11px] text-orange-200/75">
                Sincronização em tempo real via Firebase Firestore · Jogue na mesma mesa contra o Crupiê!
              </p>
            </div>
          </div>

          {!effectiveUid ? (
            <div className="bg-[#180604]/90 border border-amber-500/40 rounded-xl p-5 text-center space-y-3">
              <p className="text-xs sm:text-sm text-orange-100 font-semibold">
                Para criar ou entrar em salas multiplayer sincronizadas em tempo real, faça login com E-mail e Senha no Firebase.
              </p>
              <button
                type="button"
                onClick={() => onRequestLogin?.()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-slate-950 font-cinzel font-black text-xs sm:text-sm shadow-lg cursor-pointer hover:brightness-110"
              >
                <LogIn className="w-4 h-4" />
                <span>Entrar / Criar Conta Firebase</span>
              </button>
            </div>
          ) : (
            <>
              {/* Create Room Box */}
              <div className="bg-[#180705]/95 border border-orange-500/30 rounded-xl p-3 space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    maxLength={50}
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder={`Nome da mesa (ex: Mesa VIP de ${playerName})`}
                    className="flex-1 px-3 py-2 rounded-xl bg-[#100402] border border-orange-500/30 text-xs text-orange-100 placeholder-orange-300/35 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    disabled={multiBusy || multiBet <= 0 || multiBet > balance}
                    onClick={handleCreateRoom}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    {multiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Criar Sala (4 Lugares)</span>
                  </button>
                </div>

                <ChipSelector
                  currentBet={multiBet}
                  balance={balance}
                  onBetChange={setMultiBet}
                  label="Aposta Base da Mesa:"
                  compact={true}
                />
              </div>

              {/* Open Rooms List */}
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {roomsLoading ? (
                  <div className="py-8 text-center text-xs text-orange-200/70 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Carregando salas de Blackjack em tempo real...</span>
                  </div>
                ) : rooms.length === 0 ? (
                  <div className="py-8 text-center text-xs text-orange-200/70 border border-dashed border-orange-500/25 rounded-xl">
                    Nenhuma mesa de Blackjack aberta no momento. Crie a primeira sala acima!
                  </div>
                ) : (
                  rooms.map((room) => {
                    const count = room.jogadores?.length || 0;
                    const maxP = room.maxJogadores || MAX_BLACKJACK_PLAYERS;
                    const isInside = room.jogadores?.includes(effectiveUid);
                    const isFull = count >= maxP && !isInside;
                    const cannotEnterPlaying = room.status === 'jogando' && !isInside;

                    return (
                      <div
                        key={room.id}
                        className="bg-[#1b0805]/90 border border-orange-500/30 rounded-xl p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-cinzel font-bold text-xs sm:text-sm text-amber-200">
                              {room.nome}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                                room.status === 'aguardando'
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                  : room.status === 'jogando'
                                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                                  : 'bg-slate-900 text-slate-300 border-slate-600/40'
                              }`}
                            >
                              {room.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-orange-200/75 flex items-center gap-3 flex-wrap">
                            <span>Anfitrião: <strong className="text-amber-300">{room.criadorNome}</strong></span>
                            <span>Jogadores: <strong className="text-emerald-300">{count}/{maxP}</strong></span>
                            <span>Aposta mín: <strong className="text-amber-300">🪙 {(room.apostaMinima || 50).toLocaleString('pt-BR')}</strong></span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={multiBusy || isFull || cannotEnterPlaying}
                          onClick={() => handleJoinRoom(room)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-cinzel font-black text-xs shadow cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        >
                          {isInside
                            ? 'Retornar à Mesa ♠'
                            : isFull
                            ? 'Mesa Cheia (4/4)'
                            : cannotEnterPlaying
                            ? 'Em Andamento'
                            : 'Entrar na Sala ♠'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        <div className="pt-0.5 text-center">
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="inline-flex items-center gap-1 text-[11px] text-orange-300/70 hover:text-amber-300 transition-colors cursor-pointer py-0.5"
          >
            <HelpCircle className="w-3 h-3 text-orange-400" />
            <span>Regras & Como Jogar Blackjack Multiplayer</span>
          </button>
        </div>

        <HowToPlayModal isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} gameId="blackjack" />
      </div>
    );
  }

  // ---------------- MULTIPLAYER ACTIVE TABLE VIEW ----------------
  if (gameMode === 'MULTIPLAYER' && activeRoomId) {
    const estado = activeRoom?.estadoJogo;
    const multiStatus: MultiStatus = estado?.status || 'aguardando';
    const multiDealerHand = estado?.maoDealer || [];
    const hideMultiDealerHole = multiStatus === 'jogando';
    const multiDealerEval = calculateBlackjackScore(multiDealerHand);
    const isMyTurn = multiStatus === 'jogando' && estado?.turnoAtual === effectiveUid;
    const isCreator = activeRoom?.criadorId === effectiveUid;
    const myMultiHand = (effectiveUid && estado?.maosJogadores?.[effectiveUid]) || [];
    const myMultiBet = (effectiveUid && estado?.apostasJogadores?.[effectiveUid]) || multiBet;

    return (
      <div className="space-y-2 max-w-4xl mx-auto animate-fade-in pb-1">
        {toastMsg && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-red-950/95 border border-amber-400 text-amber-200 px-4 py-2 rounded-xl text-xs font-bold shadow-2xl">
            {toastMsg}
          </div>
        )}

        {/* Top Header Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleLeaveRoom}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <DoorOpen className="w-3.5 h-3.5 text-orange-400" />
            <span>Sair da Sala</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-cinzel font-bold text-amber-400 uppercase tracking-wider">
              {activeRoom?.nome || 'Mesa Blackjack'} ({activeRoom?.jogadores.length || 1}/4)
            </span>
          </div>

          {modeToggleBar}
        </div>

        {/* Multiplayer Table Felt */}
        <div className="casino-felt casino-wood-border rounded-xl p-2.5 sm:p-3 flex flex-col justify-between gap-2 relative shadow-xl overflow-hidden">
          {/* Dealer Zone */}
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-cinzel font-bold tracking-widest text-amber-300 uppercase">
                  Dealer (Crupiê)
                </span>
                {multiDealerHand.length > 0 && !hideMultiDealerHole && (
                  <span className="bg-slate-900/80 border border-amber-500/30 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold text-amber-300">
                    {multiDealerEval.score} {multiDealerEval.isBust ? '(Bust)' : ''}
                  </span>
                )}
              </div>
              {hideMultiDealerHole && multiDealerHand.length > 0 && (
                <span className="text-[10px] text-slate-300 italic">
                  Visível: {multiDealerHand[0]?.label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 min-h-[68px] flex-wrap">
              {multiDealerHand.length === 0 ? (
                <div className="w-12 h-16 rounded border border-dashed border-amber-400/20 flex items-center justify-center text-[9px] text-amber-400/40">
                  Dealer
                </div>
              ) : (
                multiDealerHand.map((card, idx) => (
                  <PlayingCard
                    key={card.id || idx}
                    card={card}
                    hidden={idx === 1 && hideMultiDealerHole}
                    flipDelayMs={idx === 0 ? 450 : (idx - 1) * 260}
                    size="xs"
                  />
                ))
              )}
            </div>
          </div>

          {/* Center Status / Turn Message */}
          {(estado?.mensagem || rtdbEstadoLive?.ultimaAcao) && (
            <div className="relative z-20 text-center">
              <div className="inline-block px-3 py-1 rounded-lg bg-[#140402]/90 border border-amber-500/40 text-amber-200 font-cinzel font-bold text-[11px] sm:text-xs shadow-lg">
                {estado?.mensagem || rtdbEstadoLive?.ultimaAcao}
                {rtdbEstadoLive?.apostaAtual ? ` · Aposta: 🪙 ${rtdbEstadoLive.apostaAtual}` : ''}
              </div>
            </div>
          )}

          {/* Seated Players (Up to 4) */}
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(activeRoom?.jogadores || []).map((pUid) => {
              const pInfo = activeRoom?.jogadoresInfo?.[pUid];
              const pHand = estado?.maosJogadores?.[pUid] || [];
              const pEval = calculateBlackjackScore(pHand);
              const pBet = estado?.apostasJogadores?.[pUid] ?? pInfo?.aposta ?? activeRoom?.apostaMinima ?? 50;
              const pResult = estado?.resultadosJogadores?.[pUid];
              const isTurn = multiStatus === 'jogando' && estado?.turnoAtual === pUid;
              const isMe = pUid === effectiveUid;

              return (
                <div
                  key={pUid}
                  className={`rounded-xl p-2 border transition-all ${
                    isTurn
                      ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/70 shadow-lg'
                      : isMe
                      ? 'bg-[#220a06]/90 border-orange-400/50'
                      : 'bg-[#170604]/85 border-orange-500/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm">{pInfo?.avatar || '🦁'}</span>
                      <span className="text-xs font-bold text-orange-100 truncate">
                        {pInfo?.nome || 'Jogador'}
                      </span>
                      {isMe && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/30 text-amber-200 font-bold">
                          Você
                        </span>
                      )}
                      {activeRoom?.criadorId === pUid && (
                        <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                      )}
                      {(() => {
                        const pres = rtdbPresence[pUid];
                        if (!pres) return null;
                        return (
                          <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-black/40 border border-white/10">
                            <span className={`w-1.5 h-1.5 rounded-full ${pres.online ? 'bg-emerald-400' : 'bg-red-500'}`} />
                            <span className={pres.online ? 'text-emerald-300' : 'text-red-300'}>
                              {pres.pronto && multiStatus === 'aguardando' ? 'Pronto' : pres.online ? 'Online' : 'Offline'}
                            </span>
                          </span>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-amber-300 font-bold">
                        🪙 {pBet}
                      </span>
                      {pHand.length > 0 && (
                        <span className="bg-slate-900/90 border border-amber-500/30 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold text-amber-300">
                          {pEval.score}
                          {pEval.isBust ? ' Bust' : pEval.isBlackjack ? ' BJ!' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 min-h-[60px] flex-wrap">
                    {pHand.length === 0 ? (
                      <div className="text-[10px] text-orange-300/45 italic flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        <span>Pronto na mesa</span>
                      </div>
                    ) : (
                      pHand.map((card, cIdx) => (
                        <PlayingCard
                          key={card.id || cIdx}
                          card={card}
                          size="xs"
                          floating={isMe}
                          flipDelayMs={cIdx < 2 ? cIdx * 250 : 0}
                        />
                      ))
                    )}
                  </div>

                  {isTurn && (
                    <div className="mt-1 text-[10px] font-bold text-amber-300 animate-pulse">
                      ● Vez de jogar agora
                    </div>
                  )}

                  {multiStatus === 'finalizado' && pResult && (
                    <div
                      className={`mt-1 text-[10px] font-bold px-2 py-0.5 rounded border inline-block ${
                        pResult.outcome === 'WIN' || pResult.outcome === 'BLACKJACK'
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                          : pResult.outcome === 'PUSH'
                          ? 'bg-slate-900 text-amber-300 border-amber-500/40'
                          : 'bg-red-950/80 text-red-300 border-red-500/50'
                      }`}
                    >
                      {pResult.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Multiplayer Controls */}
        <div className="space-y-1.5">
          {multiStatus === 'aguardando' || multiStatus === 'finalizado' ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1">
                <ChipSelector
                  currentBet={multiBet}
                  balance={balance}
                  onBetChange={handleUpdateMyRoomBet}
                  disabled={multiBusy}
                  compact={true}
                />
              </div>

              {isCreator ? (
                <button
                  type="button"
                  onClick={handleMultiStartRound}
                  disabled={multiBusy || multiBet <= 0 || multiBet > balance}
                  className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs sm:text-sm shadow-xl shadow-orange-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border border-orange-300/40"
                >
                  {multiBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : multiStatus === 'finalizado' ? (
                    <RotateCcw className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>
                    {multiStatus === 'finalizado' ? 'Nova Rodada ♠' : 'Distribuir Cartas ♠'}
                  </span>
                </button>
              ) : (
                <div className="py-2.5 px-4 rounded-xl bg-[#180705] border border-orange-500/30 text-xs text-amber-300 font-semibold text-center">
                  Aguardando {activeRoom?.criadorNome} iniciar a rodada...
                </div>
              )}
            </div>
          ) : isMyTurn ? (
            <div className="bg-[#180705] border border-amber-400/60 rounded-xl p-2 flex flex-wrap items-center justify-center gap-2 shadow-xl">
              <button
                type="button"
                disabled={multiBusy}
                onClick={handleMultiHit}
                className="flex-1 min-w-[100px] py-2 px-3 rounded-lg bg-gradient-to-r from-orange-600 to-red-600 hover:brightness-110 text-white font-black text-xs shadow-md transition-transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border border-orange-400/40 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Pedir (Hit)</span>
              </button>

              <button
                type="button"
                disabled={multiBusy}
                onClick={handleMultiStand}
                className="flex-1 min-w-[100px] py-2 px-3 rounded-lg bg-[#260e0a] hover:bg-[#34130d] text-orange-200 font-bold text-xs shadow border border-orange-500/30 transition-transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Hand className="w-3.5 h-3.5" />
                <span>Parar (Stand)</span>
              </button>

              {myMultiHand.length === 2 && balance >= myMultiBet && (
                <button
                  type="button"
                  disabled={multiBusy}
                  onClick={handleMultiDoubleDown}
                  className="flex-1 min-w-[100px] py-2 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-black text-xs shadow transition-transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border border-amber-300 disabled:opacity-40"
                >
                  <span>2x Dobrar</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-[#180705] border border-orange-500/30 rounded-xl p-2.5 text-center text-xs text-amber-300 font-semibold">
              Aguardando jogada de{' '}
              <strong>
                {(estado?.turnoAtual && activeRoom?.jogadoresInfo?.[estado.turnoAtual]?.nome) || 'outro jogador'}
              </strong>
              ...
            </div>
          )}
        </div>

        {/* Realtime Database: Presence, Dynamic Turn Timer & Live Room Chat */}
        <RoomChatAndPresence
          presenceMap={rtdbPresence}
          chatMessages={rtdbChat}
          timer={rtdbTimer}
          myUid={effectiveUid}
          myReady={myReady}
          showReadyToggle={multiStatus === 'aguardando' || multiStatus === 'finalizado'}
          onToggleReady={() => {
            const next = !myReady;
            setMyReady(next);
            void presenceHandleRef.current?.setReady(next);
          }}
          onSendMessage={async (msg) => {
            if (!activeRoomId) return;
            await sendRoomChatMessage(activeRoomId, playerName, msg, effectiveUid || undefined);
          }}
          turnPlayerName={
            (estado?.turnoAtual && activeRoom?.jogadoresInfo?.[estado.turnoAtual]?.nome) || undefined
          }
          isMyTurn={isMyTurn}
          onTimerExpire={() => {
            if (isMyTurn && !multiBusy) {
              void handleMultiStand();
            }
          }}
        />

        <div className="pt-0.5 text-center">
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="inline-flex items-center gap-1 text-[11px] text-orange-300/70 hover:text-amber-300 transition-colors cursor-pointer py-0.5"
          >
            <HelpCircle className="w-3 h-3 text-orange-400" />
            <span>Regras & Como Jogar Blackjack</span>
          </button>
        </div>

        <HowToPlayModal isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} gameId="blackjack" />

        <CardVictoryModal
          isOpen={Boolean(victoryModal)}
          winAmount={victoryModal?.winAmount || 0}
          subtitle={victoryModal?.subtitle}
          detail={victoryModal?.detail}
          onClose={() => setVictoryModal(null)}
        />
      </div>
    );
  }

  // ---------------- SINGLE-PLAYER VIEW (ORIGINAL LAYOUT & ANIMATIONS PRESERVED) ----------------
  return (
    <div className="space-y-2 max-w-4xl mx-auto animate-fade-in pb-1">
      {/* Top Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Lobby</span>
        </button>

        <span className="text-xs font-cinzel font-bold text-amber-400 uppercase tracking-wider">
          Blackjack Imperial (21)
        </span>

        {modeToggleBar}
      </div>

      {/* Blackjack Table Felt */}
      <div className="casino-felt casino-wood-border rounded-xl p-2.5 sm:p-3 min-h-[175px] sm:min-h-[195px] flex flex-col justify-between relative shadow-xl overflow-hidden">
        {/* Table Felt Decorative Markings */}
        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 border border-dashed border-amber-400/10 rounded-full h-32 pointer-events-none flex items-center justify-center">
          <span className="text-amber-400/10 font-cinzel text-lg sm:text-xl font-black uppercase tracking-widest select-none">
            Blackjack Imperial
          </span>
        </div>

        {/* Dealer Zone */}
        <div className="relative z-10 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-cinzel font-bold tracking-widest text-amber-300 uppercase">
                Dealer
              </span>
              {dealerHand.length > 0 && !hideDealerHole && (
                <span className="bg-slate-900/80 border border-amber-500/30 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold text-amber-300">
                  {dealerScore.score} {dealerScore.isBust ? '(Bust)' : ''}
                </span>
              )}
            </div>
            {hideDealerHole && dealerHand.length > 0 && (
              <span className="text-[10px] text-slate-300 italic">
                Visível: {dealerHand[0]?.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 min-h-[72px] sm:min-h-[82px] flex-wrap">
            {dealerHand.length === 0 ? (
              <div className="w-12 h-16 rounded border border-dashed border-amber-400/20 flex items-center justify-center text-[9px] text-amber-400/40">
                Dealer
              </div>
            ) : (
              dealerHand.map((card, idx) => (
                <PlayingCard
                  key={card.id || idx}
                  card={card}
                  hidden={idx === 1 && hideDealerHole}
                  flipDelayMs={idx === 0 ? 600 : (idx - 1) * 300}
                  size="xs"
                />
              ))
            )}
          </div>
        </div>

        {/* Center Result Message Alert */}
        {resultMessage && (
          <div className="relative z-20 my-0.5 text-center">
            <div
              className={`inline-block px-3 py-1 rounded-lg shadow-xl font-bold font-cinzel text-xs border ${
                resultOutcome === 'BLACKJACK' || resultOutcome === 'WIN'
                  ? 'bg-amber-500 text-slate-950 border-amber-300'
                  : resultOutcome === 'PUSH'
                  ? 'bg-slate-800 text-amber-300 border-amber-500/40'
                  : 'bg-red-950 text-red-200 border-red-500/60'
              }`}
            >
              {resultMessage}
            </div>
          </div>
        )}

        {/* Player Zone */}
        <div className="relative z-10 space-y-1 mt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-cinzel font-bold tracking-widest text-amber-300 uppercase">
                Sua Mão
              </span>
              {playerHand.length > 0 && (
                <span className="bg-slate-900/80 border border-amber-500/30 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold text-amber-300">
                  {playerScore.score} {playerScore.isSoft ? '(Suave)' : ''}{' '}
                  {playerScore.isBust ? '(Bust!)' : ''}
                </span>
              )}
            </div>
            {status === 'PLAYER_TURN' && (
              <span className="text-[10px] text-amber-300 font-semibold animate-pulse">
                Sua vez: Peça ou pare
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 min-h-[72px] sm:min-h-[82px] flex-wrap">
            {playerHand.length === 0 ? (
              <div className="w-12 h-16 rounded border border-dashed border-amber-400/20 flex items-center justify-center text-[9px] text-amber-400/40">
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
                  flipDelayMs={idx < 2 ? idx * 300 : 0}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Controls & Chip Selector Bar directly attached */}
      <div className="space-y-1.5">
        {status === 'BETTING' || status === 'ENDED' ? (
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
              onClick={startRound}
              disabled={bet <= 0 || bet > balance}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs sm:text-sm shadow-xl shadow-orange-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border border-orange-300/40"
            >
              {status === 'ENDED' ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{status === 'ENDED' ? 'Nova Rodada ♠' : 'Confirmar e Jogar ♠'}</span>
            </button>
          </div>
        ) : (
          <div className="bg-[#180705] border border-orange-500/30 rounded-xl p-2 flex flex-wrap items-center justify-center gap-2 shadow-xl">
            <button
              type="button"
              onClick={handleHit}
              className="flex-1 min-w-[100px] py-2 px-3 rounded-lg bg-gradient-to-r from-orange-600 to-red-600 hover:brightness-110 text-white font-black text-xs shadow-md transition-transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border border-orange-400/40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Pedir (Hit)</span>
            </button>

            <button
              type="button"
              onClick={() => handleStand()}
              className="flex-1 min-w-[100px] py-2 px-3 rounded-lg bg-[#260e0a] hover:bg-[#34130d] text-orange-200 font-bold text-xs shadow border border-orange-500/30 transition-transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Parar (Stand)</span>
            </button>

            {playerHand.length === 2 && balance >= bet && (
              <button
                type="button"
                onClick={handleDoubleDown}
                className="flex-1 min-w-[100px] py-2 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-black text-xs shadow transition-transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border border-amber-300"
              >
                <span>2x Dobrar</span>
              </button>
            )}
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
          <span>Regras & Como Jogar Blackjack</span>
        </button>
      </div>

      {/* Rules Modal */}
      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        gameId="blackjack"
      />

      {/* Thematic Victory Modal */}
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
