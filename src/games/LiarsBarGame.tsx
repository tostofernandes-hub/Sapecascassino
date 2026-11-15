import React, { useState, useEffect, useRef } from 'react';
import { soundManager } from '../utils/audio';
import { reportRoundLoss } from '../utils/luckyStreak';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { LiarsBarVictoryModal } from '../components/LiarsBarVictoryModal';
import { ChipSelector } from '../components/ChipSelector';
import { getStoredAccounts } from '../utils/auth';
import { incrementMissionCounter } from '../utils/missions';
import { UserAccount } from '../types/casino';
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
import {
  ArrowLeft,
  HelpCircle,
  Skull,
  Plus,
  Play
} from 'lucide-react';

interface LiarsBarGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'liars-bar', betAmount?: number) => void;
  onBackToLobby: () => void;
  username?: string;
  currentUser?: UserAccount | null;
  firebaseUid?: string | null;
  onRequestLogin?: () => void;
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

interface LiarsPlayerMeta {
  uid: string;
  nome: string;
  avatar?: string;
  aposta?: number;
}

interface LiarsRoom {
  id: string;
  name: string;
  host: string;
  criadorId?: string;
  createdAt: number;
  maxPlayers: number;
  playerNames: string[];
  jogadores?: string[];
  jogadoresInfo?: Record<string, LiarsPlayerMeta>;
  bots?: string[];
  status: 'aberta' | 'em-andamento' | 'fechada';
  isFirestore?: boolean;
}

type LiarsPhase = 'WAITING' | 'PLAYING' | 'REVEAL' | 'ROULETTE' | 'GAME_OVER';
type RoulettePhase = 'IDLE' | 'SPINNING' | 'STOPPED_BULLET' | 'STOPPED_EMPTY';

interface LastPlayState {
  playerIdx: number;
  cards: LiarsCard[];
  claimedCount: number;
  target: 'A' | 'K' | 'Q';
}

interface LiarsFirestoreEstado {
  status: 'aguardando' | 'jogando' | 'finalizado';
  phase: LiarsPhase;
  roundId: number;
  bots: string[];
  tableTarget: 'A' | 'K' | 'Q';
  players: Player[];
  currentTurnIdx: number;
  potAmount: number;
  entryBet: number;
  lastPlay: LastPlayState | null;
  revealedTableCount: number;
  rouletteVictimIdx: number | null;
  rouletteChambers: number;
  roulettePhase: RoulettePhase;
  rouletteMessage: string;
  rouletteJustHit: boolean;
  winnerName: string;
  winnerId: string;
  turnStartedAt: number;
}

const CHARACTERS: { name: string; type: CharType }[] = [
  { name: 'Capitão Scruffy', type: 'scruffy' },
  { name: 'Barão Von Pork',   type: 'von_pork' },
  { name: 'Dama Raposa',      type: 'fox' },
  { name: 'Touro Bravo',      type: 'bull' },
  { name: 'Gato Mestre',      type: 'cat' }
];

const LIARS_ROOMS_KEY = 'sapecas_liars_rooms_v1';
const HUMAN_TURN_MS = 10000; // 10 segundos para o Jogador Humano
const BOT_TURN_MS = 5000;    // 5 segundos para os Bots

const SMOKE_PUFFS = [
  { left: '8%', size: 84, dur: '10.5s', delay: '-1.2s', drift: '18px', op: 0.36 },
  { left: '21%', size: 108, dur: '12.5s', delay: '-5.8s', drift: '-22px', op: 0.42 },
  { left: '36%', size: 92, dur: '11.2s', delay: '-3.4s', drift: '16px', op: 0.34 },
  { left: '50%', size: 118, dur: '13.4s', delay: '-7.6s', drift: '-15px', op: 0.45 },
  { left: '64%', size: 96, dur: '10.8s', delay: '-2.1s', drift: '20px', op: 0.38 },
  { left: '78%', size: 112, dur: '12.9s', delay: '-8.4s', drift: '-19px', op: 0.4 },
  { left: '90%', size: 86, dur: '11.6s', delay: '-4.7s', drift: '14px', op: 0.35 }
];

const LiarsSmokeLayer: React.FC = () => (
  <div className="liars-smoke-layer" aria-hidden="true">
    {SMOKE_PUFFS.map((p, idx) => (
      <span
        key={idx}
        className="liars-smoke-puff"
        style={
          {
            left: p.left,
            width: `${p.size}px`,
            height: `${p.size}px`,
            '--smoke-dur': p.dur,
            '--smoke-delay': p.delay,
            '--smoke-drift': p.drift,
            '--smoke-max-op': String(p.op)
          } as React.CSSProperties
        }
      />
    ))}
  </div>
);

// Helper to render detailed SVG characters with progressive bullet wounds
// State 0: 100% ileso | State 1: 1 tiro no peito com sangue | State 2: 2 tiros com mais sangue + eliminado
const renderCharacterAvatar = (
  charType: CharType,
  wounds = 0,
  isLarge = false,
  isDead = false,
  justHit = false
) => {
  const size = isLarge ? 104 : 50;
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

  // Eyes (normal, wounded, or dead) — zero damage at start
  let eyesHtml = '';
  if (wounds >= 2 || isDead) {
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

  // Chest wounds (strictly 0 at start; 1st hole + blood only on 1st real bullet; 2nd hole + heavier blood on 2nd bullet)
  let chestWoundsHtml = '';
  if (wounds >= 1) {
    chestWoundsHtml += `
      <circle cx="33" cy="61" r="6.2" fill="rgba(185,28,28,0.45)"/>
      <circle cx="33" cy="61" r="4.3" fill="#090303" stroke="#dc2626" stroke-width="1.6"/>
      <circle cx="33" cy="61" r="2.2" fill="#000"/>
      <path d="M33,65 Q31.5,71 33.5,75" stroke="#dc2626" stroke-width="2" stroke-linecap="round" fill="none"/>
      <circle cx="33.5" cy="75.5" r="1.3" fill="#dc2626"/>
    `;
  }
  if (wounds >= 2) {
    chestWoundsHtml += `
      <ellipse cx="46" cy="66" rx="7.5" ry="6.5" fill="rgba(153,27,27,0.65)"/>
      <circle cx="46" cy="65" r="4.8" fill="#090303" stroke="#b91c1c" stroke-width="1.8"/>
      <circle cx="46" cy="65" r="2.6" fill="#000"/>
      <path d="M33,65 Q32,74 34,80" stroke="#b91c1c" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M46,69 Q48,76 45,82" stroke="#dc2626" stroke-width="2.8" stroke-linecap="round" fill="none"/>
      <path d="M42,68 Q41,75 42,80" stroke="#991b1b" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <circle cx="34" cy="80.5" r="1.6" fill="#dc2626"/>
      <circle cx="45" cy="82.5" r="2" fill="#dc2626"/>
    `;
  }

  const impactBurstHtml = justHit
    ? `<circle cx="40" cy="63" r="18" fill="none" stroke="#f87171" stroke-width="2.5" stroke-dasharray="4 3"/>`
    : '';

  return (
    <div
      className={justHit ? 'animate-bounce' : ''}
      dangerouslySetInnerHTML={{
        __html: `
          <svg width="${size}" height="${size}" viewBox="0 0 80 80" style="overflow: visible; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.6));">
            <path d="M16,52 L64,52 L68,80 L12,80 Z" fill="${suitColor}" stroke="#000" stroke-width="${strokeW}"/>
            <polygon points="34,52 46,52 43,62 37,62" fill="#fff"/>
            <polygon points="38,54 42,54 41,70 39,70" fill="#dc2626"/>
            ${chestWoundsHtml}
            ${impactBurstHtml}
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
  username = 'Jogador',
  currentUser,
  firebaseUid,
  onRequestLogin
}) => {
  const effectiveUid = firebaseUid || auth.currentUser?.uid || null;
  const displayName = (currentUser?.nickname || currentUser?.username || auth.currentUser?.displayName || username || 'Jogador').slice(0, 32);
  const playerAvatar = (currentUser?.avatar || '🦁').slice(0, 16);
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
  const [roulettePhase, setRoulettePhase] = useState<'IDLE' | 'SPINNING' | 'STOPPED_BULLET' | 'STOPPED_EMPTY'>('IDLE');
  const [rouletteRotation, setRouletteRotation] = useState<number>(0);
  const [rouletteJustHit, setRouletteJustHit] = useState<boolean>(false);
  const [rouletteMessage, setRouletteMessage] = useState<string>('');
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [revealedTableCount, setRevealedTableCount] = useState<number>(0);
  const [winnerName, setWinnerName] = useState<string>('');
  const [potAmount, setPotAmount] = useState<number>(300);
  const [stagedPotBet, setStagedPotBet] = useState<number>(100);
  const [pressedPotChip, setPressedPotChip] = useState<number | null>(null);
  const [potPressKey, setPotPressKey] = useState<number>(0);
  const [turnMsLeft, setTurnMsLeft] = useState<number>(HUMAN_TURN_MS);
  const [turnNonce, setTurnNonce] = useState<number>(0);
  const [multiRoundId, setMultiRoundId] = useState<number>(0);
  const [victoryModal, setVictoryModal] = useState<{
    winAmount: number;
    detail: string;
    cards: LiarsCard[];
  } | null>(null);
  const revealTimersRef = useRef<number[]>([]);
  const botActionTimerRef = useRef<number | null>(null);
  const lifecycleTimersRef = useRef<number[]>([]);
  const autoTimeoutHandlerRef = useRef<() => void>(() => {});
  const playersRef = useRef<Player[]>(players);
  const lastPlayRef = useRef(lastPlay);
  const tableTargetRef = useRef<'A' | 'K' | 'Q'>(tableTarget);
  const rouletteSpinningRef = useRef<boolean>(rouletteSpinning);
  const potAmountRef = useRef<number>(potAmount);
  const gameStateRef = useRef(gameState);
  const entryBetRef = useRef(entryBet);
  const multiRoundIdRef = useRef<number>(multiRoundId);
  const syncedTurnStartedAtRef = useRef<number>(Date.now());
  const prevRoulettePhaseRef = useRef<RoulettePhase>('IDLE');
  const chargedMatchRoundRef = useRef<number>(0);
  const settledMatchRoundRef = useRef<number>(0);
  const onUpdateBalanceRef = useRef(onUpdateBalance);

  playersRef.current = players;
  lastPlayRef.current = lastPlay;
  tableTargetRef.current = tableTarget;
  rouletteSpinningRef.current = rouletteSpinning;
  potAmountRef.current = potAmount;
  gameStateRef.current = gameState;
  entryBetRef.current = entryBet;
  multiRoundIdRef.current = multiRoundId;
  onUpdateBalanceRef.current = onUpdateBalance;

  const isFirestoreRoom = Boolean(activeRoom?.isFirestore);
  const isLiarsRoomHost =
    !isFirestoreRoom ||
    Boolean(activeRoom?.criadorId && effectiveUid && activeRoom.criadorId === effectiveUid);

  const sanitizeLiarsPlayers = (list: Player[]): Player[] =>
    list.map((p) => ({
      id: String(p.id || ''),
      name: String(p.name || 'Jogador'),
      charType: p.charType || 'scruffy',
      isBot: Boolean(p.isBot),
      lives: typeof p.lives === 'number' ? p.lives : 2,
      chambersRemaining: typeof p.chambersRemaining === 'number' ? p.chambersRemaining : 3,
      chips: typeof p.chips === 'number' ? p.chips : 500,
      hand: Array.isArray(p.hand) ? p.hand.map((c) => ({ id: String(c.id), type: c.type })) : [],
      isEliminated: Boolean(p.isEliminated)
    }));

  const sanitizeLastPlay = (play: LastPlayState | null): LastPlayState | null => {
    if (!play) return null;
    return {
      playerIdx: play.playerIdx,
      cards: Array.isArray(play.cards) ? play.cards.map((c) => ({ id: String(c.id), type: c.type })) : [],
      claimedCount: play.claimedCount,
      target: play.target
    };
  };

  const writeFullEstadoToFirestore = async (
    roomId: string,
    estado: LiarsFirestoreEstado
  ) => {
    try {
      const cleanEstado: LiarsFirestoreEstado = {
        status: estado.status,
        phase: estado.phase,
        roundId: estado.roundId,
        bots: Array.isArray(estado.bots) ? estado.bots : [],
        tableTarget: estado.tableTarget,
        players: sanitizeLiarsPlayers(estado.players),
        currentTurnIdx: estado.currentTurnIdx,
        potAmount: estado.potAmount,
        entryBet: estado.entryBet,
        lastPlay: sanitizeLastPlay(estado.lastPlay),
        revealedTableCount: estado.revealedTableCount,
        rouletteVictimIdx: estado.rouletteVictimIdx ?? null,
        rouletteChambers: estado.rouletteChambers,
        roulettePhase: estado.roulettePhase,
        rouletteMessage: estado.rouletteMessage || '',
        rouletteJustHit: Boolean(estado.rouletteJustHit),
        winnerName: estado.winnerName || '',
        winnerId: estado.winnerId || '',
        turnStartedAt: estado.turnStartedAt || Date.now()
      };
      await updateDoc(doc(db, 'salas', roomId), {
        status: cleanEstado.status,
        estadoJogo: cleanEstado,
        atualizadoEm: serverTimestamp()
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.UPDATE, `salas/${roomId}`);
      }
    }
  };

  const patchFirestoreEstado = async (
    roomId: string,
    fields: Record<string, unknown>,
    topLevelStatus?: 'aguardando' | 'jogando' | 'finalizado'
  ) => {
    try {
      const updatePayload: Record<string, unknown> = {
        atualizadoEm: serverTimestamp()
      };
      if (topLevelStatus) {
        updatePayload.status = topLevelStatus;
        updatePayload['estadoJogo.status'] = topLevelStatus;
      }
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) {
          updatePayload[`estadoJogo.${k}`] =
            k === 'players' && Array.isArray(v)
              ? sanitizeLiarsPlayers(v as Player[])
              : k === 'lastPlay'
              ? sanitizeLastPlay((v as LastPlayState | null) ?? null)
              : v;
        }
      }
      await updateDoc(doc(db, 'salas', roomId), updatePayload);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.UPDATE, `salas/${roomId}`);
      }
    }
  };

  const clearAllTimers = () => {
    revealTimersRef.current.forEach((t) => window.clearTimeout(t));
    revealTimersRef.current = [];
    lifecycleTimersRef.current.forEach((t) => window.clearTimeout(t));
    lifecycleTimersRef.current = [];
    if (botActionTimerRef.current) {
      window.clearTimeout(botActionTimerRef.current);
      botActionTimerRef.current = null;
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((prev) => (prev === msg ? null : prev)), 3500);
  };

  // Listen to ALL Liar's Bar rooms in real time via Firestore (or localStorage fallback if unauthenticated)
  useEffect(() => {
    if (!effectiveUid) {
      loadRooms();
      return () => {
        clearAllTimers();
      };
    }

    const unsub = onSnapshot(
      collection(db, 'salas'),
      (snapshot) => {
        const fsRooms: LiarsRoom[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          if (data.jogo !== 'liars-bar') return;
          const jogadores = Array.isArray(data.jogadores) ? (data.jogadores as string[]) : [];
          const infoMap = (data.jogadoresInfo && typeof data.jogadoresInfo === 'object'
            ? data.jogadoresInfo
            : {}) as Record<string, LiarsPlayerMeta>;
          const estado = (data.estadoJogo && typeof data.estadoJogo === 'object'
            ? data.estadoJogo
            : {}) as Record<string, unknown>;
          const bots = Array.isArray(estado.bots) ? (estado.bots as string[]) : [];
          const humanNames = jogadores.map((uid) => infoMap[uid]?.nome || uid.slice(0, 8));
          const tsObj = data.atualizadoEm || data.criadoEm;
          const tsMs =
            tsObj && typeof tsObj === 'object' && 'toMillis' in tsObj
              ? (tsObj as { toMillis: () => number }).toMillis()
              : Date.now();
          const rawStatus = String(data.status || 'aguardando');
          const mappedStatus: LiarsRoom['status'] =
            rawStatus === 'jogando'
              ? 'em-andamento'
              : rawStatus === 'finalizado'
              ? 'fechada'
              : 'aberta';
          fsRooms.push({
            id: docSnap.id,
            name: String(data.nome || "Mesa de Liar's Bar"),
            host: String(data.criadorNome || 'Anfitrião'),
            criadorId: String(data.criadorId || ''),
            createdAt: tsMs,
            maxPlayers: typeof data.maxJogadores === 'number' ? data.maxJogadores : 5,
            playerNames: [...humanNames, ...bots],
            jogadores,
            jogadoresInfo: infoMap,
            bots,
            status: mappedStatus,
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

    return () => {
      unsub();
      clearAllTimers();
    };
  }, [effectiveUid]);

  // Listen to active Firestore Liar's Bar room so ALL players sync Waiting Room, Match Start, Turns, Reveals, Roulette & Winner simultaneously
  useEffect(() => {
    if (!activeRoom?.id || !activeRoom.isFirestore || !effectiveUid) return;

    const roomPath = `salas/${activeRoom.id}`;
    const unsub = onSnapshot(
      doc(db, 'salas', activeRoom.id),
      (docSnap) => {
        if (!docSnap.exists()) {
          clearAllTimers();
          setActiveRoom(null);
          setGameState('ROOMS_LOBBY');
          showToast('A taverna foi encerrada.');
          return;
        }
        const data = docSnap.data() as Record<string, unknown>;
        const jogadores = Array.isArray(data.jogadores) ? (data.jogadores as string[]) : [];
        const infoMap = (data.jogadoresInfo && typeof data.jogadoresInfo === 'object'
          ? data.jogadoresInfo
          : {}) as Record<string, LiarsPlayerMeta>;
        const estado = (data.estadoJogo && typeof data.estadoJogo === 'object'
          ? data.estadoJogo
          : {}) as Partial<LiarsFirestoreEstado>;
        const bots = Array.isArray(estado.bots) ? (estado.bots as string[]) : [];
        const humanNames = jogadores.map((uid) => infoMap[uid]?.nome || uid.slice(0, 8));
        const allNames = [...humanNames, ...bots];

        setActiveRoom((prev) =>
          prev && prev.id === docSnap.id
            ? {
                ...prev,
                name: String(data.nome || prev.name),
                host: String(data.criadorNome || prev.host),
                criadorId: String(data.criadorId || prev.criadorId || ''),
                playerNames: allNames,
                jogadores,
                jogadoresInfo: infoMap,
                bots
              }
            : prev
        );

        const fsPhase: LiarsPhase =
          estado.phase && ['WAITING', 'PLAYING', 'REVEAL', 'ROULETTE', 'GAME_OVER'].includes(estado.phase)
            ? estado.phase
            : data.status === 'jogando'
            ? 'PLAYING'
            : data.status === 'finalizado'
            ? 'GAME_OVER'
            : 'WAITING';

        if (fsPhase === 'WAITING' || !Array.isArray(estado.players) || estado.players.length === 0) {
          const seated: Player[] = [
            ...jogadores.map((uid, idx) => {
              const pName = infoMap[uid]?.nome || uid.slice(0, 8);
              const char = CHARACTERS[idx % CHARACTERS.length];
              return {
                id: uid,
                name: pName,
                charType: char.type,
                isBot: false,
                lives: 2,
                chambersRemaining: 3,
                chips: entryBetRef.current * 5,
                hand: [],
                isEliminated: false
              };
            }),
            ...bots.map((botName, bIdx) => {
              const idx = jogadores.length + bIdx;
              const char = CHARACTERS[idx % CHARACTERS.length];
              return {
                id: `bot-${bIdx}`,
                name: botName,
                charType: char.type,
                isBot: true,
                lives: 2,
                chambersRemaining: 3,
                chips: entryBetRef.current * 5,
                hand: [],
                isEliminated: false
              };
            })
          ];
          playersRef.current = seated;
          setPlayers(seated);
          setGameState('WAITING');
          prevRoulettePhaseRef.current = 'IDLE';
          setRouletteSpinning(false);
          rouletteSpinningRef.current = false;
          if (typeof estado.roundId === 'number') {
            setMultiRoundId(estado.roundId);
          }
          return;
        }

        // Full synchronized active match state from Firestore
        const syncedPlayers = estado.players;
        const syncedTarget = estado.tableTarget || 'K';
        const syncedTurnIdx = typeof estado.currentTurnIdx === 'number' ? estado.currentTurnIdx : 0;
        const syncedPot = typeof estado.potAmount === 'number' ? estado.potAmount : entryBetRef.current * syncedPlayers.length;
        const syncedEntry = typeof estado.entryBet === 'number' ? estado.entryBet : entryBetRef.current;
        const syncedLastPlay = estado.lastPlay ?? null;
        const syncedRoundId = typeof estado.roundId === 'number' ? estado.roundId : 1;
        const syncedRoulettePhase: RoulettePhase = estado.roulettePhase || 'IDLE';
        const syncedTurnStarted = typeof estado.turnStartedAt === 'number' ? estado.turnStartedAt : Date.now();

        playersRef.current = syncedPlayers;
        lastPlayRef.current = syncedLastPlay;
        tableTargetRef.current = syncedTarget;
        potAmountRef.current = syncedPot;
        syncedTurnStartedAtRef.current = syncedTurnStarted;

        setPlayers(syncedPlayers);
        setTableTarget(syncedTarget);
        setCurrentTurnIdx(syncedTurnIdx);
        setPotAmount(syncedPot);
        setEntryBet(syncedEntry);
        setLastPlay(syncedLastPlay);
        setMultiRoundId(syncedRoundId);

        if (fsPhase !== 'REVEAL' && typeof estado.revealedTableCount === 'number') {
          setRevealedTableCount(estado.revealedTableCount);
        }

        setRouletteVictimIdx(estado.rouletteVictimIdx ?? null);
        setRouletteChambers(typeof estado.rouletteChambers === 'number' ? estado.rouletteChambers : 3);
        setRoulettePhase(syncedRoulettePhase);
        setRouletteMessage(estado.rouletteMessage || '');
        setRouletteJustHit(Boolean(estado.rouletteJustHit));
        setWinnerName(estado.winnerName || '');

        if (syncedRoulettePhase === 'SPINNING' && prevRoulettePhaseRef.current !== 'SPINNING') {
          setRouletteRotation((prev) => prev + 1080);
          soundManager.playClick();
        }
        if (syncedRoulettePhase === 'STOPPED_BULLET' && prevRoulettePhaseRef.current !== 'STOPPED_BULLET') {
          soundManager.playGunshot();
        }
        if (syncedRoulettePhase === 'STOPPED_EMPTY' && prevRoulettePhaseRef.current !== 'STOPPED_EMPTY') {
          soundManager.playDryFireClick();
        }
        prevRoulettePhaseRef.current = syncedRoulettePhase;
        const spinningNow = syncedRoulettePhase !== 'IDLE';
        rouletteSpinningRef.current = spinningNow;
        setRouletteSpinning(spinningNow);

        setGameState(fsPhase);
        setSelectedCardIds([]);
        setTurnNonce((n) => n + 1);

        // Deduct entry bet once per roundId for every seated Firebase player
        if (
          syncedRoundId > 0 &&
          chargedMatchRoundRef.current !== syncedRoundId &&
          syncedPlayers.some((p) => p.id === effectiveUid)
        ) {
          chargedMatchRoundRef.current = syncedRoundId;
          setVictoryModal(null);
          soundManager.playShuffle();
          onUpdateBalanceRef.current(-syncedEntry, false, 'liars-bar', syncedEntry);
        }

        // Settle match win/loss once per roundId on GAME_OVER
        if (
          fsPhase === 'GAME_OVER' &&
          syncedRoundId > 0 &&
          settledMatchRoundRef.current !== syncedRoundId
        ) {
          settledMatchRoundRef.current = syncedRoundId;
          if (estado.winnerId === effectiveUid) {
            const potWon = Math.max(syncedPot, syncedEntry * syncedPlayers.length) * 2;
            onUpdateBalanceRef.current(potWon, true, 'liars-bar', syncedEntry);
            const revealCards: LiarsCard[] =
              syncedLastPlay && syncedLastPlay.cards.length > 0
                ? syncedLastPlay.cards
                : [
                    { id: 'v-1', type: syncedTarget },
                    { id: 'v-2', type: 'DEVIL' },
                    { id: 'v-3', type: syncedTarget }
                  ];
            setVictoryModal({
              winAmount: potWon,
              detail: `${estado.winnerName || 'Você'} venceu ${syncedPlayers.length} jogadores na Taverna`,
              cards: revealCards
            });
          } else {
            reportRoundLoss('liars-bar');
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, roomPath);
      }
    );

    return () => unsub();
  }, [activeRoom?.id, activeRoom?.isFirestore, effectiveUid]);

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

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;

    if (effectiveUid) {
      const cleanRoomName = newRoomName.trim().slice(0, 60);
      try {
        const docRef = await addDoc(collection(db, 'salas'), {
          nome: cleanRoomName,
          jogo: 'liars-bar',
          criadorId: effectiveUid,
          criadorNome: displayName,
          jogadores: [effectiveUid],
          jogadoresInfo: {
            [effectiveUid]: {
              uid: effectiveUid,
              nome: displayName,
              avatar: playerAvatar,
              aposta: entryBet
            }
          },
          maxJogadores: 5,
          status: 'aguardando',
          apostaMinima: Math.max(1, entryBet),
          estadoJogo: {
            status: 'aguardando',
            bots: []
          },
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp()
        });
        const created: LiarsRoom = {
          id: docRef.id,
          name: cleanRoomName,
          host: displayName,
          criadorId: effectiveUid,
          createdAt: Date.now(),
          maxPlayers: 5,
          playerNames: [displayName],
          jogadores: [effectiveUid],
          bots: [],
          status: 'aberta',
          isFirestore: true
        };
        setNewRoomName('');
        setShowCreateModal(false);
        void handleJoinRoom(created);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
          handleFirestoreError(error, OperationType.CREATE, 'salas');
        }
        showToast("Erro ao criar sala de Liar's Bar no Firestore.");
      }
      return;
    }

    const newRoom: LiarsRoom = {
      id: `liars-room-${Date.now()}`,
      name: newRoomName.trim(),
      host: displayName,
      createdAt: Date.now(),
      maxPlayers: 5,
      playerNames: [displayName],
      status: 'aberta'
    };
    const updated = [newRoom, ...rooms];
    saveRooms(updated);
    setNewRoomName('');
    setShowCreateModal(false);
    void handleJoinRoom(newRoom);
  };

  const handleJoinRoom = async (room: LiarsRoom) => {
    soundManager.playClick();

    if (room.isFirestore && effectiveUid) {
      const alreadyIn = room.jogadores?.includes(effectiveUid);
      if (!alreadyIn) {
        if (room.status === 'em-andamento') {
          showToast('Esta partida já está em andamento!');
          return;
        }
        if (room.playerNames.length >= room.maxPlayers) {
          showToast('Sala lotada!');
          return;
        }
        try {
          await updateDoc(doc(db, 'salas', room.id), {
            jogadores: arrayUnion(effectiveUid),
            [`jogadoresInfo.${effectiveUid}`]: {
              uid: effectiveUid,
              nome: displayName,
              avatar: playerAvatar,
              aposta: entryBet
            },
            atualizadoEm: serverTimestamp()
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
            handleFirestoreError(error, OperationType.UPDATE, `salas/${room.id}`);
          }
          showToast('Erro ao entrar na sala.');
          return;
        }
      }
      setActiveRoom(room);
      setGameState('WAITING');
      return;
    }

    let currentNames = [...room.playerNames];
    const hasMe = currentNames.some((n) => n.toLowerCase() === displayName.toLowerCase());
    if (!hasMe) {
      if (currentNames.length < room.maxPlayers) {
        currentNames.push(displayName);
      } else {
        currentNames[currentNames.length - 1] = displayName;
      }
      room.playerNames = currentNames;
      saveRooms(rooms.map(r => r.id === room.id ? room : r));
    }
    setActiveRoom(room);

    // Build player models
    const seatedPlayers: Player[] = currentNames.map((pName, idx) => {
      const isMe = pName.toLowerCase() === displayName.toLowerCase();
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
    playersRef.current = seatedPlayers;
    setPlayers(seatedPlayers);
    setGameState('WAITING');
  };

  const handleLeaveRoom = async () => {
    if (activeRoom?.isFirestore && effectiveUid) {
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
        console.warn("Erro ao sair da sala de Liar's Bar:", error);
      }
    }
    clearAllTimers();
    chargedMatchRoundRef.current = 0;
    settledMatchRoundRef.current = 0;
    setPlayers([]);
    setLastPlay(null);
    setMultiRoundId(0);
    setGameState('ROOMS_LOBBY');
    setActiveRoom(null);
  };

  const handleAddPlayerOrBot = async () => {
    if (!activeRoom || players.length >= 5) return;
    const botIdx = players.length;
    const botName = CHARACTERS[botIdx % CHARACTERS.length].name;

    if (activeRoom.isFirestore) {
      const nextBots = [...(activeRoom.bots || []), botName];
      try {
        await updateDoc(doc(db, 'salas', activeRoom.id), {
          estadoJogo: {
            status: 'aguardando',
            phase: 'WAITING',
            bots: nextBots
          },
          atualizadoEm: serverTimestamp()
        });
        soundManager.playChip();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
          handleFirestoreError(error, OperationType.UPDATE, `salas/${activeRoom.id}`);
        }
      }
      return;
    }

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
    const isDefaultRoom = activeRoom.id === 'liars-1' || activeRoom.id === 'liars-2';
    const isHost =
      (activeRoom.criadorId && effectiveUid && activeRoom.criadorId === effectiveUid) ||
      (!activeRoom.isFirestore && activeRoom.host.toLowerCase() === displayName.toLowerCase()) ||
      isDefaultRoom;
    if (!isHost) {
      showToast('Apenas o anfitrião da sala pode iniciar o jogo!');
      return;
    }
    if (balance < entryBet) {
      showToast('Saldo insuficiente para entrar na partida!');
      return;
    }

    const freshPlayers = players.map((p) => ({
      ...p,
      lives: 2,
      chambersRemaining: 3,
      isEliminated: false
    }));

    if (activeRoom.isFirestore) {
      const nextRoundId = multiRoundIdRef.current + 1;
      const dealt = buildNewRoundData(freshPlayers, 0);
      const initialEstado: LiarsFirestoreEstado = {
        status: 'jogando',
        phase: 'PLAYING',
        roundId: nextRoundId,
        bots: activeRoom.bots || [],
        tableTarget: dealt.tableTarget,
        players: dealt.updatedPlayers,
        currentTurnIdx: dealt.safeIdx,
        potAmount: entryBet * freshPlayers.length,
        entryBet,
        lastPlay: null,
        revealedTableCount: 0,
        rouletteVictimIdx: null,
        rouletteChambers: 3,
        roulettePhase: 'IDLE',
        rouletteMessage: '',
        rouletteJustHit: false,
        winnerName: '',
        winnerId: '',
        turnStartedAt: Date.now()
      };
      void writeFullEstadoToFirestore(activeRoom.id, initialEstado);
      return;
    }

    soundManager.playShuffle();
    onUpdateBalance(-entryBet, false, 'liars-bar', entryBet);
    activeRoom.status = 'em-andamento';
    saveRooms(rooms.map(r => r.id === activeRoom.id ? activeRoom : r));

    setVictoryModal(null);
    setWinnerName('');
    setRevealedTableCount(0);
    setPotAmount(entryBet * players.length);
    setPlayers(freshPlayers);
    dealNewRound(freshPlayers, 0);
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
      showToast('Saldo insuficiente!');
      return;
    }
    setVictoryModal(null);
    setWinnerName('');
    setRevealedTableCount(0);
    setPotAmount(entryBet * soloPlayers.length);
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

  const buildNewRoundData = (currentPlayers: Player[], starterIdx: number) => {
    const deck = generateDeck();
    const targets: ('A' | 'K' | 'Q')[] = ['A', 'K', 'Q'];
    const chosenTarget = targets[Math.floor(Math.random() * targets.length)];

    let safeIdx = starterIdx % currentPlayers.length;
    for (let i = 0; i < currentPlayers.length; i++) {
      const candidate = currentPlayers[(starterIdx + i) % currentPlayers.length];
      if (!candidate.isEliminated && candidate.lives > 0) {
        safeIdx = (starterIdx + i) % currentPlayers.length;
        break;
      }
    }

    const updatedPlayers = currentPlayers.map((p) => {
      if (p.isEliminated || p.lives <= 0) return { ...p, hand: [] };
      return {
        ...p,
        hand: deck.splice(0, 5)
      };
    });

    return { tableTarget: chosenTarget, safeIdx, updatedPlayers };
  };

  const dealNewRound = (currentPlayers: Player[], starterIdx: number) => {
    if (botActionTimerRef.current) {
      window.clearTimeout(botActionTimerRef.current);
      botActionTimerRef.current = null;
    }
    const { tableTarget: chosenTarget, safeIdx, updatedPlayers } = buildNewRoundData(currentPlayers, starterIdx);

    if (activeRoom?.isFirestore) {
      void patchFirestoreEstado(
        activeRoom.id,
        {
          phase: 'PLAYING',
          tableTarget: chosenTarget,
          players: updatedPlayers,
          currentTurnIdx: safeIdx,
          lastPlay: null,
          revealedTableCount: 0,
          roulettePhase: 'IDLE',
          rouletteJustHit: false,
          rouletteVictimIdx: null,
          turnStartedAt: Date.now()
        },
        'jogando'
      );
      return;
    }

    setTableTarget(chosenTarget);
    playersRef.current = updatedPlayers;
    lastPlayRef.current = null;
    tableTargetRef.current = chosenTarget;
    syncedTurnStartedAtRef.current = Date.now();
    setPlayers(updatedPlayers);
    setCurrentTurnIdx(safeIdx);
    setLastPlay(null);
    setSelectedCardIds([]);
    setRevealedTableCount(0);
    setTurnMsLeft(updatedPlayers[safeIdx]?.isBot ? BOT_TURN_MS : HUMAN_TURN_MS);
    setTurnNonce((n) => n + 1);

    if (updatedPlayers[safeIdx]?.isBot && !updatedPlayers[safeIdx]?.isEliminated) {
      botActionTimerRef.current = window.setTimeout(() => botTurn(safeIdx), 2000);
    }
  };

  // Aumentar aposta no pote (também reinicia o timer de 10s do jogador)
  const handleRaisePot = (amt = 100) => {
    if (gameState !== 'PLAYING' || !isHumanTurn || isHumanEliminated) return;
    if (balance < amt) {
      showToast('Saldo insuficiente para aumentar o pote!');
      return;
    }
    soundManager.playChip();
    onUpdateBalance(-amt, false, 'liars-bar', amt);
    const nextPot = potAmountRef.current + amt;
    setPotAmount(nextPot);
    if (activeRoom?.isFirestore) {
      void patchFirestoreEstado(activeRoom.id, {
        potAmount: nextPot,
        turnStartedAt: Date.now()
      });
    } else {
      syncedTurnStartedAtRef.current = Date.now();
      setTurnMsLeft(HUMAN_TURN_MS);
      setTurnNonce((n) => n + 1);
    }
    showToast(`🪙 Aposta de ${amt} fichas adicionada ao pote! Timer reiniciado (10s).`);
  };

  // Human player plays cards (Declarar)
  const handlePlayCards = () => {
    const latestPlayers = playersRef.current;
    if (selectedCardIds.length === 0 || selectedCardIds.length > 3) return;
    const currPlayer = latestPlayers[currentTurnIdx];
    if (!currPlayer || currPlayer.isEliminated || currPlayer.lives <= 0) return;

    const playedCards = currPlayer.hand.filter((c) => selectedCardIds.includes(c.id));
    const remainingHand = currPlayer.hand.filter((c) => !selectedCardIds.includes(c.id));

    soundManager.playCardDeal();

    const updatedPlayers = latestPlayers.map((p, idx) =>
      idx === currentTurnIdx ? { ...p, hand: remainingHand } : p
    );
    const nextPlay: LastPlayState = {
      playerIdx: currentTurnIdx,
      cards: playedCards,
      claimedCount: playedCards.length,
      target: tableTargetRef.current
    };

    playersRef.current = updatedPlayers;
    lastPlayRef.current = nextPlay;
    setPlayers(updatedPlayers);
    setLastPlay(nextPlay);
    setSelectedCardIds([]);
    advanceTurn(currentTurnIdx, updatedPlayers, nextPlay);
  };

  // Advance turn to next alive player & restart timer (10s Human / 5s Bot)
  const advanceTurn = (fromIdx: number, currentPlayers: Player[], overrideLastPlay?: LastPlayState | null) => {
    if (botActionTimerRef.current) {
      window.clearTimeout(botActionTimerRef.current);
      botActionTimerRef.current = null;
    }
    let nextIdx = (fromIdx + 1) % currentPlayers.length;
    let attempts = 0;
    while ((currentPlayers[nextIdx].isEliminated || currentPlayers[nextIdx].lives <= 0) && attempts < currentPlayers.length) {
      nextIdx = (nextIdx + 1) % currentPlayers.length;
      attempts++;
    }

    if (activeRoom?.isFirestore) {
      void patchFirestoreEstado(activeRoom.id, {
        players: currentPlayers,
        lastPlay: overrideLastPlay !== undefined ? overrideLastPlay : lastPlayRef.current,
        currentTurnIdx: nextIdx,
        turnStartedAt: Date.now()
      });
      return;
    }

    syncedTurnStartedAtRef.current = Date.now();
    setCurrentTurnIdx(nextIdx);
    setTurnMsLeft(currentPlayers[nextIdx]?.isBot ? BOT_TURN_MS : HUMAN_TURN_MS);
    setTurnNonce((n) => n + 1);

    // If next player is bot, trigger bot logic within the 5s window
    if (currentPlayers[nextIdx].isBot && !currentPlayers[nextIdx].isEliminated && currentPlayers[nextIdx].lives > 0) {
      botActionTimerRef.current = window.setTimeout(() => botTurn(nextIdx), 2000);
    }
  };

  // Bot Turn Logic (always reads fresh refs so timers never act on stale state)
  const botTurn = (botIdx: number) => {
    const currentPlayers = playersRef.current;
    const latestPlay = lastPlayRef.current;
    const activeTarget = tableTargetRef.current;
    const bot = currentPlayers[botIdx];
    if (!bot || bot.isEliminated || bot.lives <= 0) return;

    // Decide whether to challenge (Duvidar)
    if (latestPlay && latestPlay.playerIdx !== botIdx) {
      const bluffProbability = latestPlay.claimedCount === 3 ? 0.65 : latestPlay.claimedCount === 2 ? 0.4 : 0.2;
      if (Math.random() < bluffProbability) {
        handleChallenge(botIdx);
        return;
      }
    }

    // Play cards (Declarar)
    const matching = bot.hand.filter((c) => c.type === activeTarget || c.type === 'DEVIL');
    let cardsToPlay: LiarsCard[] = [];

    if (matching.length > 0 && Math.random() > 0.3) {
      cardsToPlay = matching.slice(0, Math.min(matching.length, Math.floor(Math.random() * 2) + 1));
    } else {
      const nonMatching = bot.hand.filter((c) => c.type !== activeTarget && c.type !== 'DEVIL');
      const pool = nonMatching.length > 0 ? nonMatching : bot.hand;
      cardsToPlay = pool.slice(0, Math.min(pool.length, Math.floor(Math.random() * 2) + 1));
    }

    if (cardsToPlay.length === 0) {
      cardsToPlay = bot.hand.slice(0, 1);
    }

    if (cardsToPlay.length === 0 && latestPlay && latestPlay.playerIdx !== botIdx) {
      handleChallenge(botIdx);
      return;
    }

    const cardIds = cardsToPlay.map((c) => c.id);
    const newHand = bot.hand.filter((c) => !cardIds.includes(c.id));

    soundManager.playCardDeal();
    const updated = currentPlayers.map((p, idx) =>
      idx === botIdx ? { ...p, hand: newHand } : p
    );
    const nextPlay: LastPlayState = {
      playerIdx: botIdx,
      cards: cardsToPlay,
      claimedCount: cardsToPlay.length,
      target: activeTarget
    };
    playersRef.current = updated;
    lastPlayRef.current = nextPlay;
    setPlayers(updated);
    setLastPlay(nextPlay);

    advanceTurn(botIdx, updated, nextPlay);
  };

  // Challenge (Duvidar)
  const handleChallenge = (challengerIdx: number) => {
    const activePlay = lastPlayRef.current;
    const currentPlayers = playersRef.current;
    if (!activePlay) return;
    if (botActionTimerRef.current) {
      window.clearTimeout(botActionTimerRef.current);
      botActionTimerRef.current = null;
    }

    soundManager.playBluffCall();
    incrementMissionCounter(username, 'liars_bluffs', 1);

    const accusedIdx = activePlay.playerIdx;
    const cards = activePlay.cards;
    const wasBluff = cards.some((c) => c.type !== activePlay.target && c.type !== 'DEVIL');
    const loserIdx = wasBluff ? accusedIdx : challengerIdx;
    const victim = currentPlayers[loserIdx];
    const msg = wasBluff
      ? `Mentiroso desmascarado! ${currentPlayers[accusedIdx]?.name || 'Jogador'} blefou nas cartas!`
      : `Verdade comprovada! ${currentPlayers[challengerIdx]?.name || 'Jogador'} duvidou errado!`;

    if (activeRoom?.isFirestore) {
      void patchFirestoreEstado(activeRoom.id, {
        phase: 'REVEAL',
        revealedTableCount: 0,
        rouletteVictimIdx: loserIdx,
        rouletteChambers: victim?.chambersRemaining || 3,
        roulettePhase: 'IDLE',
        rouletteJustHit: false,
        rouletteMessage: msg,
        turnStartedAt: Date.now()
      });
      return;
    }

    setGameState('REVEAL');
    setRevealedTableCount(0);
    revealTimersRef.current.forEach((t) => window.clearTimeout(t));
    revealTimersRef.current = [];

    cards.forEach((_, idx) => {
      const t = window.setTimeout(() => {
        setRevealedTableCount(idx + 1);
        soundManager.playCardDeal();
      }, 180 + idx * 320);
      revealTimersRef.current.push(t);
    });

    const revealWaitMs = Math.max(2400, cards.length * 320 + 1300);

    const tReveal = window.setTimeout(() => {
      if (!victim) return;
      syncedTurnStartedAtRef.current = Date.now();
      setRouletteVictimIdx(loserIdx);
      setRouletteChambers(victim.chambersRemaining || 3);
      setRoulettePhase('IDLE');
      setRouletteJustHit(false);
      setRouletteMessage(msg);
      setTurnMsLeft(victim.isBot ? BOT_TURN_MS : HUMAN_TURN_MS);
      setTurnNonce((n) => n + 1);
      setGameState('ROULETTE');

      if (victim.isBot) {
        botActionTimerRef.current = window.setTimeout(() => triggerRussianRoulette(loserIdx), 2000);
      }
    }, revealWaitMs);
    lifecycleTimersRef.current.push(tReveal);
  };

  // Pull Russian Roulette Trigger (Atirar)
  const handlePullTrigger = () => {
    if (rouletteVictimIdx === null || rouletteSpinningRef.current) return;
    triggerRussianRoulette(rouletteVictimIdx);
  };

  const triggerRussianRoulette = (victimIdx: number) => {
    if (rouletteSpinningRef.current) return;
    if (botActionTimerRef.current) {
      window.clearTimeout(botActionTimerRef.current);
      botActionTimerRef.current = null;
    }
    rouletteSpinningRef.current = true;
    setRouletteSpinning(true);
    setRoulettePhase('SPINNING');
    setRouletteRotation((prev) => prev + 1080);
    setRouletteJustHit(false);
    soundManager.playClick();
    setRouletteMessage('Girando o tambor de 3 câmaras...');

    if (activeRoom?.isFirestore) {
      void patchFirestoreEstado(activeRoom.id, {
        roulettePhase: 'SPINNING',
        rouletteJustHit: false,
        rouletteMessage: 'Girando o tambor de 3 câmaras...'
      });
    }

    const tSpin = window.setTimeout(() => {
      const latestPlayers = playersRef.current;
      const victim = latestPlayers[victimIdx];
      if (!victim) {
        rouletteSpinningRef.current = false;
        setRouletteSpinning(false);
        return;
      }
      const remaining = victim.chambersRemaining || 3;
      const isBullet = Math.random() < 1 / remaining;

      if (isBullet) {
        setRoulettePhase('STOPPED_BULLET');
        soundManager.playGunshot();
        setRouletteJustHit(true);
        const newLives = Math.max(0, victim.lives - 1);
        const isDead = newLives <= 0;
        if (!activeRoom?.isFirestore && !victim.isBot && isDead) {
          reportRoundLoss('liars-bar');
        }

        const hitMsg = isDead
          ? `💀 BANG! 2º TIRO FATAL! ${victim.name} perdeu as 2 vidas e foi eliminado!`
          : `💥 BANG! ${victim.name} levou um tiro da bala e perdeu 1 vida! (1/2 vidas restantes)`;
        setRouletteMessage(hitMsg);
        setRouletteChambers(3);

        const updated = latestPlayers.map((p, idx) =>
          idx === victimIdx
            ? {
                ...p,
                lives: newLives,
                chambersRemaining: 3,
                isEliminated: isDead,
                hand: isDead ? [] : p.hand
              }
            : p
        );
        playersRef.current = updated;
        setPlayers(updated);

        if (activeRoom?.isFirestore) {
          void patchFirestoreEstado(activeRoom.id, {
            players: updated,
            roulettePhase: 'STOPPED_BULLET',
            rouletteChambers: 3,
            rouletteJustHit: true,
            rouletteMessage: hitMsg
          });
        }

        const tBulletEnd = window.setTimeout(() => {
          setRouletteJustHit(false);
          setRoulettePhase('IDLE');
          rouletteSpinningRef.current = false;
          setRouletteSpinning(false);
          checkGameOverOrNextRound(updated, victimIdx);
        }, 2300);
        lifecycleTimersRef.current.push(tBulletEnd);
      } else {
        setRoulettePhase('STOPPED_EMPTY');
        soundManager.playDryFireClick();
        const nextChambers = Math.max(1, remaining - 1);
        const emptyMsg = `*CLIQUE SECO!* Sem bala na câmara (${nextChambers}/3 restantes). ${victim.name} não perdeu vida!`;
        setRouletteMessage(emptyMsg);
        setRouletteChambers(nextChambers);

        const updated = latestPlayers.map((p, idx) =>
          idx === victimIdx
            ? {
                ...p,
                chambersRemaining: nextChambers
              }
            : p
        );
        playersRef.current = updated;
        setPlayers(updated);

        if (activeRoom?.isFirestore) {
          void patchFirestoreEstado(activeRoom.id, {
            players: updated,
            roulettePhase: 'STOPPED_EMPTY',
            rouletteChambers: nextChambers,
            rouletteJustHit: false,
            rouletteMessage: emptyMsg
          });
        }

        const tEmptyEnd = window.setTimeout(() => {
          setRoulettePhase('IDLE');
          rouletteSpinningRef.current = false;
          setRouletteSpinning(false);
          if (!activeRoom?.isFirestore) setGameState('PLAYING');
          dealNewRound(updated, (victimIdx + 1) % updated.length);
        }, 1900);
        lifecycleTimersRef.current.push(tEmptyEnd);
      }
    }, 1250);
    lifecycleTimersRef.current.push(tSpin);
  };

  const checkGameOverOrNextRound = (currentPlayers: Player[], lastVictimIdx: number) => {
    const alive = currentPlayers.filter((p) => !p.isEliminated && p.lives > 0);

    if (alive.length <= 1) {
      const winner = alive[0] || currentPlayers[0];

      if (activeRoom?.isFirestore) {
        void patchFirestoreEstado(
          activeRoom.id,
          {
            phase: 'GAME_OVER',
            players: currentPlayers,
            roulettePhase: 'IDLE',
            rouletteJustHit: false,
            winnerName: winner.name,
            winnerId: winner.id
          },
          'finalizado'
        );
        return;
      }

      setGameState('GAME_OVER');
      setWinnerName(winner.name);
      if (!winner.isBot) {
        const potWon = Math.max(potAmountRef.current, entryBet * currentPlayers.length) * 2;
        onUpdateBalance(potWon, true, 'liars-bar', entryBet);
        const latestPlay = lastPlayRef.current;
        const revealCards: LiarsCard[] =
          latestPlay && latestPlay.cards.length > 0
            ? latestPlay.cards
            : winner.hand && winner.hand.length > 0
            ? winner.hand.slice(0, 3)
            : [
                { id: 'v-1', type: tableTargetRef.current },
                { id: 'v-2', type: 'DEVIL' },
                { id: 'v-3', type: tableTargetRef.current }
              ];
        setVictoryModal({
          winAmount: potWon,
          detail: `${winner.name} venceu ${currentPlayers.length} jogadores na Taverna`,
          cards: revealCards
        });
      } else {
        reportRoundLoss('liars-bar');
      }
      if (activeRoom) {
        activeRoom.status = 'fechada';
        saveRooms(rooms.map(r => r.id === activeRoom.id ? activeRoom : r));
      }
    } else {
      if (!activeRoom?.isFirestore) setGameState('PLAYING');
      dealNewRound(currentPlayers, (lastVictimIdx + 1) % currentPlayers.length);
    }
  };

  const humanPlayer =
    players.find((p) => (effectiveUid && activeRoom?.isFirestore ? p.id === effectiveUid : !p.isBot)) ||
    players.find((p) => !p.isBot) ||
    players.find((p) => p.name.toLowerCase() === displayName.toLowerCase()) ||
    players[0];
  const humanPlayerIdx = Math.max(0, players.findIndex(p => p.id === humanPlayer?.id));
  const isHumanTurn = players[currentTurnIdx]?.id === humanPlayer?.id && !humanPlayer?.isEliminated && (humanPlayer?.lives || 0) > 0;
  const isHumanEliminated = Boolean(humanPlayer && (humanPlayer.isEliminated || humanPlayer.lives <= 0));
  const currentTurnPlayerName = players[currentTurnIdx]?.name || '';
  const canStartLocalRoom = Boolean(
    activeRoom && (
      (activeRoom.criadorId && effectiveUid && activeRoom.criadorId === effectiveUid) ||
      (!activeRoom.isFirestore && activeRoom.host.toLowerCase() === displayName.toLowerCase()) ||
      activeRoom.id === 'liars-1' ||
      activeRoom.id === 'liars-2'
    )
  );

  // Active turn duration: 10s when human acts, 5s when bot acts
  const activeTurnIsBot =
    gameState === 'ROULETTE'
      ? rouletteVictimIdx !== null && Boolean(players[rouletteVictimIdx]?.isBot)
      : Boolean(players[currentTurnIdx]?.isBot);
  const activeTurnDurationMs = activeTurnIsBot ? BOT_TURN_MS : HUMAN_TURN_MS;

  // Host-only Firestore automation for bot turns, REVEAL progression, and bot roulette
  useEffect(() => {
    if (!isFirestoreRoom || !isLiarsRoomHost || !activeRoom?.id) return;
    if (gameState !== 'PLAYING') return;
    const curr = players[currentTurnIdx];
    if (!curr || !curr.isBot || curr.isEliminated || curr.lives <= 0) return;

    const t = window.setTimeout(() => {
      botTurn(currentTurnIdx);
    }, 1800);
    return () => window.clearTimeout(t);
  }, [isFirestoreRoom, isLiarsRoomHost, activeRoom?.id, gameState, currentTurnIdx, turnNonce]);

  useEffect(() => {
    if (!isFirestoreRoom || gameState !== 'REVEAL' || !lastPlay || !activeRoom?.id) return;
    setRevealedTableCount(0);
    const timers: number[] = [];

    lastPlay.cards.forEach((_, idx) => {
      const t = window.setTimeout(() => {
        setRevealedTableCount(idx + 1);
        soundManager.playCardDeal();
      }, 180 + idx * 320);
      timers.push(t);
    });

    if (isLiarsRoomHost) {
      const revealWaitMs = Math.max(2400, lastPlay.cards.length * 320 + 1300);
      const tEnd = window.setTimeout(() => {
        void patchFirestoreEstado(activeRoom.id, {
          phase: 'ROULETTE',
          roulettePhase: 'IDLE',
          rouletteJustHit: false,
          turnStartedAt: Date.now()
        });
      }, revealWaitMs);
      timers.push(tEnd);
    }

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [isFirestoreRoom, isLiarsRoomHost, activeRoom?.id, gameState]);

  useEffect(() => {
    if (!isFirestoreRoom || !isLiarsRoomHost || !activeRoom?.id) return;
    if (gameState !== 'ROULETTE' || rouletteVictimIdx === null || roulettePhase !== 'IDLE') return;
    const victim = players[rouletteVictimIdx];
    if (!victim || !victim.isBot) return;

    const t = window.setTimeout(() => {
      triggerRussianRoulette(rouletteVictimIdx);
    }, 1800);
    return () => window.clearTimeout(t);
  }, [isFirestoreRoom, isLiarsRoomHost, activeRoom?.id, gameState, rouletteVictimIdx, roulettePhase]);

  // Auto-action callback invoked when turn/roulette timer reaches 0
  autoTimeoutHandlerRef.current = () => {
    if (gameState === 'ROULETTE' && rouletteVictimIdx !== null && !rouletteSpinning) {
      const victim = players[rouletteVictimIdx];
      if (isFirestoreRoom && victim && !victim.isBot && victim.id !== effectiveUid) return;
      if (isFirestoreRoom && victim?.isBot && !isLiarsRoomHost) return;
      showToast('⏱️ Tempo esgotado! Gatilho acionado automaticamente!');
      triggerRussianRoulette(rouletteVictimIdx);
      return;
    }

    if (gameState === 'PLAYING') {
      const curr = players[currentTurnIdx];
      if (!curr || curr.isEliminated || curr.lives <= 0) return;

      if (isFirestoreRoom && curr.isBot && !isLiarsRoomHost) return;
      if (isFirestoreRoom && !curr.isBot && curr.id !== effectiveUid) return;

      if (curr.isBot) {
        botTurn(currentTurnIdx);
        return;
      }

      // Human timed out: minimum automatic bet (100 if affordable) + declare 1 card
      const minBet = Math.min(100, Math.max(0, balance));
      let nextPot = potAmountRef.current;
      if (minBet > 0) {
        onUpdateBalance(-minBet, false, 'liars-bar', minBet);
        nextPot += minBet;
        setPotAmount(nextPot);
      }

      if (curr.hand.length > 0) {
        const autoCard =
          curr.hand.find((c) => c.type === tableTargetRef.current || c.type === 'DEVIL') || curr.hand[0];
        const remainingHand = curr.hand.filter((c) => c.id !== autoCard.id);
        soundManager.playCardDeal();

        const updatedPlayers = playersRef.current.map((p, idx) =>
          idx === currentTurnIdx ? { ...p, hand: remainingHand } : p
        );
        const nextPlay: LastPlayState = {
          playerIdx: currentTurnIdx,
          cards: [autoCard],
          claimedCount: 1,
          target: tableTargetRef.current
        };
        playersRef.current = updatedPlayers;
        lastPlayRef.current = nextPlay;
        setPlayers(updatedPlayers);
        setLastPlay(nextPlay);
        setSelectedCardIds([]);
        if (activeRoom?.isFirestore && minBet > 0) {
          void patchFirestoreEstado(activeRoom.id, { potAmount: nextPot });
        }
        showToast(
          minBet > 0
            ? `⏱️ Tempo esgotado! Aposta mínima automática (+${minBet}) e 1 carta declarada.`
            : '⏱️ Tempo esgotado! 1 carta declarada automaticamente.'
        );
        advanceTurn(currentTurnIdx, updatedPlayers, nextPlay);
      } else if (lastPlayRef.current && lastPlayRef.current.playerIdx !== currentTurnIdx) {
        showToast('⏱️ Tempo esgotado! Desafio automático!');
        handleChallenge(currentTurnIdx);
      }
    }
  };

  // Countdown engine (10s Human / 5s Bots; active only during PLAYING or unspun ROULETTE)
  useEffect(() => {
    const isTimerActive =
      gameState === 'PLAYING' || (gameState === 'ROULETTE' && roulettePhase === 'IDLE' && !rouletteSpinning);
    if (!isTimerActive) return;

    const totalMs =
      gameState === 'ROULETTE'
        ? rouletteVictimIdx !== null && players[rouletteVictimIdx]?.isBot
          ? BOT_TURN_MS
          : HUMAN_TURN_MS
        : players[currentTurnIdx]?.isBot
        ? BOT_TURN_MS
        : HUMAN_TURN_MS;

    const startAt = isFirestoreRoom ? syncedTurnStartedAtRef.current : Date.now();
    setTurnMsLeft(Math.max(0, totalMs - (Date.now() - startAt)));
    let firedTimeout = false;

    const iv = window.setInterval(() => {
      const elapsed = Date.now() - startAt;
      const remaining = Math.max(0, totalMs - elapsed);
      setTurnMsLeft(remaining);
      if (remaining <= 0 && !firedTimeout) {
        firedTimeout = true;
        window.clearInterval(iv);
        autoTimeoutHandlerRef.current();
      }
    }, 100);

    return () => window.clearInterval(iv);
  }, [gameState, currentTurnIdx, rouletteVictimIdx, roulettePhase, rouletteSpinning, turnNonce, isFirestoreRoom]);

  const turnSecondsCeil = Math.ceil(turnMsLeft / 1000);
  const turnPct = Math.max(0, Math.min(100, (turnMsLeft / activeTurnDurationMs) * 100));
  const timerUrgent = turnSecondsCeil <= 2;

  // Keep all opponents (both active and eliminated spectators) seated at the table until match end
  const tableOpponents = players.filter((p) => p.id !== humanPlayer?.id);

  return (
    <div className="h-full max-h-full min-h-0 w-full max-w-4xl mx-auto flex flex-col justify-between overflow-hidden animate-fade-in text-orange-100 p-1 sm:p-1.5 select-none relative">
      {toastMsg && (
        <div className="shrink-0 mb-1 px-3 py-1 rounded-xl bg-amber-950/95 border border-amber-400/70 text-amber-200 text-xs font-bold text-center shadow-lg">
          {toastMsg}
        </div>
      )}
      {/* Top Header Bar */}
      <div className="shrink-0 flex items-center justify-between px-2 py-0.5">
        <button
          onClick={() => {
            if (gameState === 'ROOMS_LOBBY') {
              onBackToLobby();
            } else {
              void handleLeaveRoom();
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
            <span>LIAR&apos;S BAR · {activeRoom ? activeRoom.name : 'BLEFE & ROLETA RUSSA'}</span>
          </div>
          <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block">
            {gameState === 'PLAYING'
              ? `Mesa Exige: ${tableTarget === 'A' ? 'Áses (A)' : tableTarget === 'K' ? 'Reis (K)' : 'Damas (Q)'} 👑 (Diabo 😈 é Coringa)`
              : gameState === 'WAITING'
              ? 'Sala de Espera · Aguardando Iniciar'
              : 'Salas de Taverna (Até 5 Jogadores) · 2 Vidas · 3 Câmaras'}
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
        <div className="casino-felt casino-wood-border rounded-2xl flex-1 min-h-[280px] flex flex-col justify-between p-3 sm:p-4 my-1 overflow-y-auto shadow-2xl relative">
          <div className="flex items-center justify-between border-b border-orange-500/30 pb-2 gap-2 flex-wrap">
            <div>
              <h2 className="font-cinzel text-base sm:text-lg font-black text-amber-300">
                Salas de Liar&apos;s Bar (Até 5 Jogadores)
              </h2>
              <span className="text-xs text-orange-200/80">
                Crie sua taverna, convide bots ou jogue uma mesa rápida de blefe!
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleStartSoloGame}
                disabled={entryBet <= 0 || entryBet > balance}
                className="btn-dark text-xs py-1.5 px-3 border-amber-500/50 text-amber-300 disabled:opacity-40"
              >
                Mesa Rápida ({entryBet.toLocaleString('pt-BR')}🪙) ⚡
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

          {!effectiveUid && (
            <div className="mt-2 bg-[#240a06] border border-amber-500/40 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200">
              <span>Faça login no Firebase para ver e entrar nas tavernas online de outros jogadores.</span>
              <button
                type="button"
                onClick={() => onRequestLogin?.()}
                className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-black cursor-pointer"
              >
                Entrar / Criar Conta
              </button>
            </div>
          )}

          <div className="mt-2">
            <ChipSelector
              currentBet={entryBet}
              balance={balance}
              onBetChange={setEntryBet}
              label="Entrada da Mesa:"
              compact={true}
            />
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
                const isInside = effectiveUid
                  ? Boolean(room.jogadores?.includes(effectiveUid))
                  : room.playerNames.some(p => p.toLowerCase() === displayName.toLowerCase());
                return (
                  <div
                    key={room.id}
                    className="p-3 rounded-xl bg-[#250d09] border border-orange-500/30 flex items-center justify-between hover:border-amber-400 transition-all shadow-md"
                  >
                    <div>
                      <div className="font-cinzel font-black text-sm text-white flex items-center gap-2">
                        <span>{room.name}</span>
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
                      onClick={() => void handleJoinRoom(room)}
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
                    onClick={() => void handleCreateRoom()}
                    disabled={!newRoomName.trim()}
                    className="btn-gold text-xs py-1.5 px-4 font-bold cursor-pointer disabled:opacity-50"
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
      {/* 2. WAITING ROOM SCREEN (SALA DE ESPERA · 100vh FIT) */}
      {/* ==================================================== */}
      {gameState === 'WAITING' && activeRoom && (
        <div className="casino-felt casino-wood-border rounded-2xl flex-1 min-h-0 flex flex-col justify-between p-2.5 sm:p-4 my-0.5 overflow-hidden shadow-2xl relative gap-1.5">
          <LiarsSmokeLayer />
          <div className="relative z-10 shrink-0 flex items-center justify-between border-b border-orange-500/30 pb-1.5 gap-2">
            <div className="min-w-0">
              <h2 className="font-cinzel text-sm sm:text-lg font-black text-amber-300 truncate">
                {activeRoom.name}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-400 font-bold">
                  Sala Aberta ({players.length}/5 Conectados)
                </span>
              </div>
            </div>

            {players.length < activeRoom.maxPlayers && canStartLocalRoom && (
              <button
                onClick={handleAddPlayerOrBot}
                className="btn-dark text-[11px] py-1 px-2.5 border-amber-500/50 text-amber-300 flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Bot 🤖</span>
              </button>
            )}
          </div>

          {/* Seated Players in Waiting Room */}
          <div className="relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col justify-center items-center py-1">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-w-xl w-full">
              {players.map((p) => {
                const isHost =
                  (activeRoom.criadorId && p.id === activeRoom.criadorId) ||
                  (!activeRoom.isFirestore && p.name.toLowerCase() === activeRoom.host.toLowerCase());
                const isMe = effectiveUid ? p.id === effectiveUid : p.name.toLowerCase() === displayName.toLowerCase();
                return (
                  <div
                    key={p.id}
                    className={`p-2 sm:p-3 rounded-xl border flex flex-col items-center text-center shadow-lg [&_svg]:w-9 [&_svg]:h-9 sm:[&_svg]:w-12 sm:[&_svg]:h-12 ${
                      isHost
                        ? 'bg-[#3a1209]/95 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        : 'bg-[#180705]/90 border-orange-500/30'
                    }`}
                  >
                    {renderCharacterAvatar(p.charType, 0, false, false)}
                    <span className="font-cinzel font-bold text-[11px] sm:text-xs text-white mt-1 truncate w-full">
                      {p.name} {isMe ? '(Você)' : ''}
                    </span>
                    <span className={`text-[9.5px] font-black uppercase mt-0.5 ${isHost ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {isHost ? '👑 Anfitrião' : '✅ Pronto'}
                    </span>
                  </div>
                );
              })}

              {Array.from({
                length: Math.max(0, 5 - players.length)
              }, (_, i) => (
                <div
                  key={i}
                  className="p-2 sm:p-3 rounded-xl border border-dashed border-orange-500/25 bg-black/25 flex flex-col items-center justify-center text-center text-orange-300/40"
                >
                  <span className="text-lg sm:text-2xl mb-0.5 opacity-40">🪑</span>
                  <span className="text-[11px] font-bold">Cadeira Vazia</span>
                  <span className="text-[9.5px]">Aguardando...</span>
                </div>
              ))}
            </div>
          </div>

          {/* Host Controls: INICIAR PARTIDA Button + Additive Entry Bet */}
          <div className="relative z-10 shrink-0 border-t border-orange-500/30 pt-1.5 text-center space-y-1.5">
            {canStartLocalRoom && (
              <ChipSelector
                currentBet={entryBet}
                balance={balance}
                onBetChange={setEntryBet}
                label="Entrada:"
                compact={true}
              />
            )}
            {canStartLocalRoom ? (
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={handleHostStartGame}
                  disabled={players.length < 2 || entryBet <= 0 || entryBet > balance}
                  className="w-full max-w-md py-2 px-5 rounded-2xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 text-white font-cinzel font-black text-xs sm:text-sm uppercase tracking-wider shadow-2xl border-2 border-yellow-300 active:scale-98 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
                >
                  {players.length >= 2
                    ? `INICIAR PARTIDA (${entryBet.toLocaleString('pt-BR')}🪙) 🚀`
                    : `AGUARDANDO MÍNIMO DE 2 JOGADORES (${players.length}/2)... ⏳`}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#180705]/90 border border-amber-500/35 text-xs text-amber-300 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span>
                  Aguardando anfitrião ({activeRoom.host}) clicar em &quot;INICIAR PARTIDA&quot;... ({players.length}/5)
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
        <div className="casino-felt casino-wood-border rounded-2xl flex-1 min-h-0 flex flex-col justify-between p-1.5 sm:p-2 relative overflow-hidden shadow-2xl my-0.5 gap-1">
          <LiarsSmokeLayer />
          {/* Table Banner (Compact) */}
          <div className="relative z-10 shrink-0 flex items-center justify-between gap-2 px-2 py-0.5 rounded-xl bg-[#140503]/85 border border-orange-500/30 shadow-md">
            <div className="flex items-center gap-1.5">
              <span className="text-lg sm:text-xl">
                {tableTarget === 'A' ? '♠️' : tableTarget === 'K' ? '👑' : '👸'}
              </span>
              <div>
                <span className="text-[8.5px] uppercase font-bold text-orange-400 block leading-tight">
                  Exigência da Mesa · Pote 🪙 {potAmount.toLocaleString('pt-BR')}
                </span>
                <span className="font-cinzel text-xs font-black text-amber-300 leading-tight">
                  {tableTarget === 'A' ? 'Áses (A)' : tableTarget === 'K' ? 'Reis (K)' : 'Damas (Q)'}
                </span>
              </div>
            </div>

            <div className="text-center px-2 py-0.5 rounded-lg bg-[#250d09] border border-orange-500/40">
              <span className="text-[8px] text-orange-400 font-bold uppercase block leading-tight">Vez de Jogar</span>
              <span className="text-[11px] font-black text-white font-cinzel leading-tight">
                {currentTurnPlayerName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-right">
                <span className="text-[8px] uppercase font-bold text-orange-400 block leading-tight">Última Declaração</span>
                <span className="text-[10.5px] font-bold text-orange-200 leading-tight">
                  {lastPlay
                    ? `${players[lastPlay.playerIdx]?.name}: ${lastPlay.claimedCount} carta(s)`
                    : 'Início da Rodada'}
                </span>
              </div>
              <div
                className={`px-2 py-0.5 rounded-lg border text-center min-w-[50px] ${
                  gameState === 'REVEAL'
                    ? 'bg-amber-950/70 border-amber-400/50 text-amber-300'
                    : timerUrgent
                    ? 'bg-red-950/90 border-red-400 text-red-300 animate-pulse'
                    : 'bg-[#250d09] border-emerald-500/50 text-emerald-300'
                }`}
              >
                <span className="text-[8px] uppercase font-bold block leading-tight">
                  {gameState === 'REVEAL' ? 'Pausado' : 'Tempo'}
                </span>
                <span className="text-[11px] font-black tabular-nums leading-tight">
                  {gameState === 'REVEAL' ? '⏸️' : `⏱️ ${turnSecondsCeil}s`}
                </span>
              </div>
            </div>
          </div>

          {/* Table Seats (Compacted so Sua Mão always fits cleanly) */}
          <div className="relative z-10 shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {tableOpponents.map((p) => {
              const isElim = p.isEliminated || p.lives <= 0;
              const isCurrent = !isElim && players[currentTurnIdx]?.id === p.id;
              const wounds = isElim ? 2 : 2 - Math.max(0, p.lives);
              return (
                <div
                  key={p.id}
                  className={`p-1 rounded-xl border text-center transition-all flex flex-col items-center ${
                    isElim
                      ? 'bg-[#210909]/75 border-dashed border-red-500/50 opacity-75 grayscale-[30%]'
                      : isCurrent
                      ? 'bg-gradient-to-b from-[#3a1209]/95 to-[#1c0805]/95 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                      : 'bg-[#180705]/80 border-orange-500/25'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 [&_svg]:w-10 [&_svg]:h-10">
                    {renderCharacterAvatar(p.charType, wounds, false, isElim, false)}
                    {isCurrent && gameState === 'PLAYING' && (
                      <div className="w-11 text-left">
                        <div className="flex justify-between text-[8px] font-black leading-none mb-0.5">
                          <span className={timerUrgent ? 'text-red-400' : 'text-amber-300'}>VEZ</span>
                          <span className={timerUrgent ? 'text-red-300' : 'text-emerald-300'}>{turnSecondsCeil}s</span>
                        </div>
                        <div className="w-full h-1 rounded-full bg-black/70 overflow-hidden border border-white/10">
                          <div
                            className={`h-full transition-[width] duration-100 ease-linear ${
                              timerUrgent ? 'bg-red-500' : turnPct < 50 ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${turnPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={`text-[10.5px] font-bold truncate font-cinzel mt-0.5 max-w-[115px] leading-tight ${isElim ? 'text-red-300' : 'text-white'}`}>
                    {p.name}
                  </div>
                  {isElim ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded bg-red-950/90 border border-red-500/70 text-[8.5px] font-black text-red-200 uppercase leading-none">
                        💀 ESPECTADOR
                      </span>
                      <span className="text-[9px] text-slate-600">🖤🖤</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1 text-[9px] text-orange-300 font-mono leading-tight">
                      <span>{p.lives >= 2 ? '❤️❤️' : p.lives === 1 ? '❤️🖤' : '🖤🖤'}</span>
                      <span>· {p.hand.length}c ({p.chambersRemaining}/3)</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Table Center Cards (Reduced flexible height so hand is never cut off) */}
          <div className="relative z-10 flex-1 min-h-[44px] flex flex-col items-center justify-center py-0.5 overflow-hidden">
            {lastPlay ? (
              <div className="text-center">
                <span className="text-[9.5px] uppercase font-bold text-orange-400 block mb-0.5 leading-tight">
                  Cartas Declaradas na Mesa ({lastPlay.claimedCount}x {lastPlay.target}):
                </span>
                <div className="flex items-center justify-center gap-2" style={{ perspective: '1000px' }}>
                  {lastPlay.cards.map((c, cIdx) => {
                    const isFlipped = gameState === 'REVEAL' && cIdx < revealedTableCount;
                    const isDevil = c.type === 'DEVIL';
                    const isMatch = c.type === lastPlay.target || isDevil;
                    return (
                      <div key={c.id || cIdx} style={{ perspective: '1000px' }}>
                        <div
                          className="relative w-10 h-14 sm:w-11 sm:h-15 rounded-lg"
                          style={{
                            transformStyle: 'preserve-3d',
                            transition: 'transform 0.52s cubic-bezier(0.22, 1, 0.36, 1)',
                            transform: isFlipped
                              ? 'rotateY(180deg) rotateX(2deg) translateZ(8px)'
                              : 'rotateY(0deg)'
                          }}
                        >
                          {/* Back face */}
                          <div
                            style={{
                              backfaceVisibility: 'hidden',
                              WebkitBackfaceVisibility: 'hidden',
                              transform: 'rotateY(0deg) translateZ(1px)'
                            }}
                            className="absolute inset-0 rounded-xl border-2 border-amber-500/80 bg-gradient-to-br from-[#450a0a] via-[#220604] to-[#140202] text-amber-400 flex items-center justify-center font-cinzel font-black text-lg shadow-xl"
                          >
                            ♠
                          </div>
                          {/* Front face */}
                          <div
                            style={{
                              backfaceVisibility: 'hidden',
                              WebkitBackfaceVisibility: 'hidden',
                              transform: 'rotateY(180deg) translateZ(1px)',
                              boxShadow: isMatch
                                ? '0 0 18px rgba(251, 191, 36, 0.7)'
                                : '0 0 14px rgba(239, 68, 68, 0.55)'
                            }}
                            className={`absolute inset-0 rounded-xl border-2 flex flex-col items-center justify-center font-bold text-base shadow-xl ${
                              isFlipped && isMatch ? 'liars-win-card-glow' : ''
                            } ${
                              isDevil
                                ? 'bg-purple-950 border-amber-300 text-amber-200'
                                : isMatch
                                ? 'bg-emerald-950 border-amber-400 text-amber-100'
                                : 'bg-red-950 border-red-500 text-red-200'
                            }`}
                          >
                            <span>{isDevil ? '😈' : c.type}</span>
                            <span className="text-[8px] uppercase mt-0.5">
                              {isDevil ? 'DIABO' : c.type}
                            </span>
                          </div>
                        </div>
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

          {/* Human Hand (Guaranteed visible space above betting controls) */}
          <div className="relative z-10 shrink-0 mt-auto rounded-xl bg-black/45 border border-orange-500/30 px-2 py-1">
            <div className="flex items-center justify-between mb-0.5 gap-2">
              <div className="flex items-center gap-1.5">
                <div className="[&_svg]:w-8 [&_svg]:h-8 shrink-0">
                  {renderCharacterAvatar(
                    humanPlayer?.charType || 'scruffy',
                    2 - Math.max(0, humanPlayer?.lives ?? 2),
                    false,
                    Boolean(isHumanEliminated),
                    false
                  )}
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-white font-cinzel">Sua Mão ({humanPlayer?.name || displayName}):</span>
                {isHumanEliminated ? (
                  <span className="px-2 py-0.5 rounded bg-red-950/90 border border-red-500/70 text-[9.5px] text-red-200 font-black uppercase">
                    💀 Espectador
                  </span>
                ) : (
                  <div className="flex items-center gap-0.5">
                    <span className="text-xs">{(humanPlayer?.lives ?? 2) >= 1 ? '❤️' : '🖤'}</span>
                    <span className="text-xs">{(humanPlayer?.lives ?? 2) >= 2 ? '❤️' : '🖤'}</span>
                  </div>
                )}
                {isHumanTurn && gameState === 'PLAYING' && !isHumanEliminated && (
                  <div className="w-24 sm:w-28 ml-1">
                    <div className="flex justify-between text-[8px] font-black leading-none mb-0.5">
                      <span className={timerUrgent ? 'text-red-400' : 'text-emerald-300'}>SUA VEZ</span>
                      <span className={timerUrgent ? 'text-red-300' : 'text-amber-300'}>{turnSecondsCeil}s</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-black/70 overflow-hidden border border-white/15">
                      <div
                        className={`h-full transition-[width] duration-100 ease-linear ${
                          timerUrgent ? 'bg-red-500' : turnPct < 50 ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${turnPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-orange-400 font-bold shrink-0">
                {isHumanEliminated ? 'Assistindo à mesa' : `${selectedCardIds.length} selecionada(s) (Máx 3)`}
              </span>
            </div>

            {isHumanEliminated ? (
              <div className="flex items-center justify-center gap-3 py-1.5 px-3 rounded-xl bg-red-950/45 border border-red-500/45">
                <span className="text-xs font-bold text-red-200">
                  Você foi eliminado. Assistindo à partida...
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearAllTimers();
                    onBackToLobby();
                  }}
                  className="px-3 py-1 rounded-lg bg-gradient-to-r from-red-600 to-rose-700 text-white text-xs font-black border border-red-300/70 shadow cursor-pointer hover:brightness-110"
                >
                  Sair do Jogo
                </button>
              </div>
            ) : (
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
                      className={`w-12 h-16 sm:w-[52px] sm:h-[68px] shrink-0 rounded-xl border-2 flex flex-col justify-between p-1 font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'border-yellow-300 bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950 -translate-y-1 shadow-[0_0_15px_#f59e0b] scale-105'
                          : isMatching
                          ? 'bg-[#250d09] border-orange-500 text-orange-100 hover:border-amber-400 hover:scale-102'
                          : 'bg-[#180705] border-orange-500/30 text-orange-300/70 hover:border-orange-400'
                      }`}
                    >
                      <span className="text-xs font-black leading-none">{card.type === 'DEVIL' ? '😈' : card.type}</span>
                      <span className="text-center text-sm leading-none">{card.type === 'DEVIL' ? '🃏' : '♦'}</span>
                      <span className="text-[9px] font-black self-end leading-none">
                        {card.type === 'DEVIL' ? 'DIABO' : card.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. RUSSIAN ROULETTE OVERLAY MODAL */}
      {/* ==================================================== */}
      {gameState === 'ROULETTE' && rouletteVictimIdx !== null && (
        <div
          className={`casino-felt casino-wood-border rounded-2xl flex-1 min-h-0 flex flex-col items-center justify-around p-3 text-center my-1 overflow-hidden shadow-2xl border-2 relative ${
            rouletteJustHit ? 'border-red-400 bg-red-950/40' : 'border-red-500'
          }`}
        >
          <LiarsSmokeLayer />
          <div className="relative z-10 text-xs font-black tracking-widest text-red-500 uppercase">
            ⚠️ ROLETA RUSSA DO LIAR&apos;S BAR ⚠️
          </div>

          <h2 className="relative z-10 font-cinzel text-base sm:text-lg font-black text-amber-300">
            {players[rouletteVictimIdx!]?.name} enfrenta o revólver!
          </h2>

          {/* Victim Character (exact current wounds: 0 initially, 1 only after 1st bullet, 2 on 2nd) + 3-Chamber Revolver Cylinder + 5s Timer */}
          <div className="relative z-10 flex items-center justify-center gap-4 sm:gap-6 my-1">
            <div className="flex flex-col items-center">
              {renderCharacterAvatar(
                players[rouletteVictimIdx!]?.charType || 'scruffy',
                2 - Math.max(0, players[rouletteVictimIdx!]?.lives ?? 2),
                true,
                (players[rouletteVictimIdx!]?.lives ?? 2) <= 0,
                rouletteJustHit
              )}
              <div className="mt-1 flex items-center gap-1 text-xs">
                <span>{(players[rouletteVictimIdx!]?.lives ?? 2) >= 1 ? '❤️' : '🖤'}</span>
                <span>{(players[rouletteVictimIdx!]?.lives ?? 2) >= 2 ? '❤️' : '🖤'}</span>
              </div>
            </div>

            {/* 3-Chamber Revolver Cylinder SVG (Stops smoothly & fills landed chamber when bullet hits) */}
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg
                  width="92"
                  height="92"
                  viewBox="0 0 120 120"
                  style={{
                    transform: `rotate(${rouletteRotation}deg)`,
                    transition: roulettePhase === 'SPINNING'
                      ? 'transform 1.2s cubic-bezier(0.12, 0.85, 0.25, 1)'
                      : 'none'
                  }}
                >
                  <circle cx="60" cy="60" r="54" fill="#2d1511" stroke="#78350f" strokeWidth="4" />
                  <circle cx="60" cy="60" r="46" fill="#1b0805" stroke="#f59e0b" strokeWidth="2" />
                  <circle cx="60" cy="60" r="14" fill="#45140b" stroke="#f59e0b" strokeWidth="2" />
                  {/* Top chamber (aligns directly under top red pointer when cylinder stops) */}
                  <circle
                    cx="60"
                    cy="28"
                    r="12"
                    fill={
                      roulettePhase === 'STOPPED_BULLET'
                        ? '#991b1b'
                        : roulettePhase === 'STOPPED_EMPTY'
                        ? '#374151'
                        : '#0d0302'
                    }
                    stroke={roulettePhase === 'STOPPED_BULLET' ? '#fbbf24' : '#ea580c'}
                    strokeWidth={roulettePhase === 'STOPPED_BULLET' ? '3.5' : '2.5'}
                  />
                  {roulettePhase === 'STOPPED_BULLET' && (
                    <>
                      <circle cx="60" cy="28" r="9" fill="#f59e0b" stroke="#fde68a" strokeWidth="1.5" />
                      <circle cx="60" cy="28" r="4.2" fill="#dc2626" />
                    </>
                  )}
                  {/* Second chamber (bottom right) */}
                  <circle
                    cx="87"
                    cy="76"
                    r="12"
                    fill={rouletteChambers < 2 ? '#374151' : '#0d0302'}
                    stroke="#ea580c"
                    strokeWidth="2.5"
                  />
                  {/* Third chamber (bottom left) */}
                  <circle
                    cx="33"
                    cy="76"
                    r="12"
                    fill={rouletteChambers < 3 ? '#374151' : '#0d0302'}
                    stroke="#ea580c"
                    strokeWidth="2.5"
                  />
                </svg>
                <div className="absolute -top-1 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[13px] border-t-red-500" />
              </div>
              {/* 5s Roulette Timer right next to avatar & gun */}
              <div className="w-28 mt-1">
                <div className="flex justify-between text-[10px] font-black mb-0.5">
                  <span className="text-amber-300">GATILHO</span>
                  <span className={timerUrgent ? 'text-red-400 animate-pulse' : 'text-emerald-300'}>
                    {roulettePhase === 'SPINNING'
                      ? '🎯'
                      : roulettePhase === 'STOPPED_BULLET'
                      ? '💥 BALA!'
                      : roulettePhase === 'STOPPED_EMPTY'
                      ? '💨 VAZIA'
                      : `⏱️ ${turnSecondsCeil}s`}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/70 overflow-hidden border border-white/15">
                  <div
                    className={`h-full transition-[width] duration-100 ease-linear ${
                      roulettePhase === 'STOPPED_BULLET'
                        ? 'bg-red-500'
                        : timerUrgent
                        ? 'bg-red-500'
                        : 'bg-amber-400'
                    }`}
                    style={{ width: `${rouletteSpinning ? 100 : turnPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 bg-black/60 border border-orange-500/40 rounded-xl p-2 max-w-sm w-full">
            <div className="text-xs font-bold text-amber-400 mb-0.5">
              Tambor: {rouletteChambers} / 3 câmara(s) restante(s) · 1 Bala Carregada
            </div>
            <div className="text-[11px] text-orange-200 min-h-[28px] flex items-center justify-center font-bold">
              {rouletteMessage}
            </div>
          </div>

          <button
            onClick={handlePullTrigger}
            disabled={rouletteSpinning || players[rouletteVictimIdx!]?.id !== humanPlayer?.id}
            className="relative z-10 w-full max-w-xs py-2.5 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-cinzel font-black text-sm uppercase tracking-wider shadow-2xl border-2 border-red-300 active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {roulettePhase === 'SPINNING'
              ? 'GIRANDO TAMBOR... 🎯'
              : roulettePhase === 'STOPPED_BULLET'
              ? '💥 BALA ENCONTRADA!'
              : roulettePhase === 'STOPPED_EMPTY'
              ? '💨 CÂMARA VAZIA!'
              : players[rouletteVictimIdx!]?.id === humanPlayer?.id
              ? `PUXAR O GATILHO! 🎯 (${turnSecondsCeil}s)`
              : `Aguardando ${players[rouletteVictimIdx!]?.name} atirar (${turnSecondsCeil}s)... 🎯`}
          </button>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. GAME OVER SCREEN */}
      {/* ==================================================== */}
      {gameState === 'GAME_OVER' && (
        <div className="casino-felt casino-wood-border rounded-2xl flex-1 min-h-0 flex flex-col items-center justify-center p-3 sm:p-4 text-center my-1 overflow-hidden shadow-2xl">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-xl border-2 mb-2 ${
            isHumanEliminated
              ? 'bg-gradient-to-br from-red-700 to-rose-950 border-red-400'
              : 'bg-gradient-to-br from-amber-400 to-yellow-600 border-yellow-200'
          }`}>
            {isHumanEliminated ? '💀' : '👑'}
          </div>
          <h2 className={`font-cinzel text-xl sm:text-2xl font-black ${isHumanEliminated ? 'text-red-400' : 'text-amber-300'}`}>
            {isHumanEliminated ? 'VOCÊ PERDEU A PARTIDA!' : 'FIM DA PARTIDA!'}
          </h2>
          <p className="text-xs text-orange-200/90 max-w-md mt-1 mb-4">
            {isHumanEliminated
              ? `Você levou 2 tiros na roleta e perdeu suas 2 vidas! ${winnerName ? `${winnerName} foi o último sobrevivente da mesa.` : ''}`
              : winnerName
              ? `${winnerName} sobreviveu ao confronto de blefes e conquistou o pote da taverna!`
              : "A taverna testemunhou o confronto de blefes e o sobrevivente supremo do Liar's Bar foi coroado!"}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                clearAllTimers();
                onBackToLobby();
              }}
              className="btn-dark py-2 px-5 text-xs font-bold border-red-500/60 text-red-200 cursor-pointer"
            >
              Sair do Jogo
            </button>
            {activeRoom?.isFirestore ? (
              <button
                onClick={() => {
                  if (isLiarsRoomHost) {
                    void patchFirestoreEstado(
                      activeRoom.id,
                      {
                        phase: 'WAITING',
                        lastPlay: null,
                        revealedTableCount: 0,
                        rouletteVictimIdx: null,
                        roulettePhase: 'IDLE',
                        rouletteJustHit: false,
                        winnerName: '',
                        winnerId: ''
                      },
                      'aguardando'
                    );
                  } else {
                    void handleLeaveRoom();
                  }
                }}
                className="btn-gold py-2 px-5 text-xs font-bold cursor-pointer"
              >
                {isLiarsRoomHost ? 'Nova Partida na Sala 🔄' : 'Voltar às Salas 🔄'}
              </button>
            ) : (
              <button
                onClick={handleStartSoloGame}
                className="btn-gold py-2 px-5 text-xs font-bold cursor-pointer"
              >
                Jogar Novamente 🔄
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ACTION CONTROLS FOOTER (OR SPECTATOR EXIT PANEL) */}
      {/* ==================================================== */}
      {(gameState === 'PLAYING' || gameState === 'REVEAL') && !isHumanEliminated && (
        <div className="shrink-0 space-y-1 pt-0.5">
          <div className="flex flex-wrap items-center justify-between gap-1 bg-[#1b0805]/95 border border-orange-500/30 rounded-xl px-2 py-0.5">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9.5px] font-bold text-orange-300">Aposta:</span>
              <span className="font-mono text-[11px] font-black text-amber-300 px-1.5 py-0.5 rounded bg-[#120403] border border-amber-500/40">
                {stagedPotBet.toLocaleString('pt-BR')} fichas
              </span>
              {[10, 25, 50, 100, 500].map((v) => {
                const isPressed = pressedPotChip === v;
                return (
                  <button
                    key={isPressed ? `${v}-${potPressKey}` : v}
                    type="button"
                    disabled={gameState !== 'PLAYING' || !isHumanTurn || isHumanEliminated}
                    onClick={() => {
                      setPressedPotChip(v);
                      setPotPressKey((k) => k + 1);
                      if (stagedPotBet + v > balance) {
                        soundManager.playLoss();
                        showToast(`Saldo insuficiente! Máximo disponível: ${balance.toLocaleString('pt-BR')} fichas.`);
                        return;
                      }
                      soundManager.playChip();
                      setStagedPotBet((p) => p + v);
                    }}
                    className={`w-6 h-6 rounded-full text-[8.5px] font-black bg-gradient-to-b from-amber-600 to-red-900 text-white border border-dashed border-amber-300 shadow active:scale-90 cursor-pointer disabled:opacity-35 ${
                      isPressed ? 'chip-press-anim' : ''
                    }`}
                    title={`Somar +${v} fichas`}
                  >
                    +{v}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={gameState !== 'PLAYING' || !isHumanTurn || isHumanEliminated || stagedPotBet === 0}
                onClick={() => {
                  soundManager.playClick();
                  setStagedPotBet(0);
                }}
                className="px-2 py-0.5 rounded-lg bg-[#270e0a] text-orange-200 border border-orange-500/20 text-[9.5px] font-bold disabled:opacity-35 cursor-pointer"
              >
                Limpar
              </button>
              <button
                type="button"
                disabled={gameState !== 'PLAYING' || !isHumanTurn || isHumanEliminated || stagedPotBet <= 0 || stagedPotBet > balance}
                onClick={() => {
                  if (stagedPotBet > balance) {
                    showToast(`Saldo insuficiente! Você possui ${balance.toLocaleString('pt-BR')} fichas.`);
                    return;
                  }
                  handleRaisePot(stagedPotBet);
                }}
                className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-black text-[9.5px] uppercase shadow cursor-pointer disabled:opacity-35"
              >
                Apostar +{stagedPotBet.toLocaleString('pt-BR')} 🪙
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {lastPlay && lastPlay.playerIdx !== currentTurnIdx && (
              <button
                type="button"
                disabled={gameState !== 'PLAYING' || !isHumanTurn || isHumanEliminated}
                onClick={() => handleChallenge(humanPlayerIdx)}
                className="flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:brightness-110 text-white font-cinzel font-black text-[11px] sm:text-xs uppercase tracking-wider shadow-lg border border-red-400 active:scale-98 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <Skull className="w-3.5 h-3.5" />
                <span>DUVIDAR! 🚨</span>
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
              className="flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-slate-950 font-cinzel font-black text-[11px] sm:text-xs uppercase tracking-wider shadow-lg border border-yellow-300 active:scale-98 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              <span>DECLARAR ({selectedCardIds.length}) 🃏</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom "Como jogar" footer button */}
      <div className="shrink-0 flex justify-center pt-0.5">
        <button
          type="button"
          onClick={() => setShowHowToPlay(true)}
          className="px-3.5 py-0.5 rounded-full bg-[#1a0704]/90 border border-amber-500/40 text-[10.5px] font-bold text-amber-300 hover:border-amber-400 hover:text-amber-200 transition-all cursor-pointer flex items-center gap-1.5 shadow"
        >
          <HelpCircle className="w-3 h-3 text-amber-400" />
          <span>Como Jogar Liar&apos;s Bar</span>
        </button>
      </div>

      {/* How to play modal */}
      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        gameId="liars-bar"
      />

      {/* 3D Liar's Bar Victory Modal with Card Reveal & Golden Glow */}
      <LiarsBarVictoryModal
        isOpen={Boolean(victoryModal)}
        winAmount={victoryModal?.winAmount || 0}
        cards={victoryModal?.cards}
        tableTarget={tableTarget}
        detail={victoryModal?.detail}
        onClose={() => setVictoryModal(null)}
      />
    </div>
  );
};
