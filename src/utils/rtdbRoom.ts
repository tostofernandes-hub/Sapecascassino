import {
  ref,
  set,
  update,
  onValue,
  push,
  onDisconnect,
  off
} from 'firebase/database';
import { rtdb } from '../firebase';

export interface PlayerPresence {
  uid: string;
  nome: string;
  online: boolean;
  pronto: boolean;
  lastSeen: number;
}

export interface RoomChatMessage {
  id: string;
  autor: string;
  autorUid?: string;
  mensagem: string;
  timestamp: number;
}

export interface RoomTimerState {
  turnoAtual: string | null;
  endsAt: number;
  durationSec: number;
}

export interface RtdbEstadoJogo {
  apostaAtual?: number;
  turnoAtual?: string | null;
  status?: string;
  ultimaAcao?: string;
  ultimaJogadaEm?: number;
  roundId?: number;
}

export interface RoomRtdbSnapshot {
  statusJogadores: Record<string, PlayerPresence>;
  chat: RoomChatMessage[];
  timer: RoomTimerState | null;
  estadoJogo: RtdbEstadoJogo | null;
  connected: boolean;
}

function sanitizeKey(raw: string): string {
  return raw.replace(/[.#$\[\]/]/g, '_').slice(0, 128);
}

/**
 * Escuta apenas salas/{salaId}/estadoJogo em tempo real com onValue()
 * para refletir jogadas e mudanças de turno instantaneamente.
 */
export function subscribeEstadoJogoRtdb(
  salaId: string,
  onEstadoChange: (estadoAtual: RtdbEstadoJogo) => void
): () => void {
  if (!rtdb || !salaId) {
    return () => {};
  }

  const safeSala = sanitizeKey(salaId);
  const estadoJogoRef = ref(rtdb, `salas/${safeSala}/estadoJogo`);

  const unsubscribe = onValue(
    estadoJogoRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const estadoAtual = snapshot.val() as RtdbEstadoJogo;
        onEstadoChange(estadoAtual);
      }
    },
    (err) => {
      console.warn('RTDB estadoJogo listener warning:', err);
    }
  );

  return () => {
    unsubscribe();
    off(estadoJogoRef);
  };
}

/**
 * Atualiza caminhos específicos dentro de salas/{salaId}/estadoJogo usando update()
 * sem sobrescrever status_jogadores, chat ou timer da sala.
 */
export async function enviarJogadaRtdb(
  salaId: string,
  jogada: {
    apostaAtual?: number;
    turnoAtual?: string | null;
    status?: string;
    ultimaAcao?: string;
    roundId?: number;
  }
): Promise<void> {
  if (!rtdb || !salaId) return;

  const safeSala = sanitizeKey(salaId);
  const salaRef = ref(rtdb, `salas/${safeSala}`);
  const payload: Record<string, unknown> = {
    'estadoJogo/ultimaJogadaEm': Date.now()
  };

  if (jogada.apostaAtual !== undefined) {
    payload['estadoJogo/apostaAtual'] = jogada.apostaAtual;
  }
  if (jogada.turnoAtual !== undefined) {
    payload['estadoJogo/turnoAtual'] = jogada.turnoAtual;
  }
  if (jogada.status !== undefined) {
    payload['estadoJogo/status'] = jogada.status;
  }
  if (jogada.ultimaAcao !== undefined) {
    payload['estadoJogo/ultimaAcao'] = jogada.ultimaAcao.slice(0, 200);
  }
  if (jogada.roundId !== undefined) {
    payload['estadoJogo/roundId'] = jogada.roundId;
  }

  try {
    await update(salaRef, payload);
  } catch (err) {
    console.warn('RTDB enviarJogada warning:', err);
  }
}

/**
 * Marks the player online in Realtime Database and registers an automatic
 * onDisconnect handler so closing the tab immediately flags offline presence.
 */
export function connectRoomPresence(
  salaId: string,
  uid: string,
  nome: string
): {
  setReady: (pronto: boolean) => Promise<void>;
  disconnect: () => Promise<void>;
} {
  if (!rtdb || !salaId || !uid) {
    return {
      setReady: async () => {},
      disconnect: async () => {}
    };
  }

  const safeSala = sanitizeKey(salaId);
  const safeUid = sanitizeKey(uid);
  const statusRef = ref(rtdb, `salas/${safeSala}/status_jogadores/${safeUid}`);
  const connectedRef = ref(rtdb, '.info/connected');

  let currentReady = false;
  let disposed = false;

  const markOnline = async () => {
    if (disposed || !rtdb) return;
    try {
      await onDisconnect(statusRef).update({
        online: false,
        pronto: false,
        lastSeen: Date.now()
      });
      await set(statusRef, {
        uid,
        nome: nome.slice(0, 32),
        online: true,
        pronto: currentReady,
        lastSeen: Date.now()
      });
    } catch (err) {
      console.warn('RTDB presence warning:', err);
    }
  };

  const unsubConnected = onValue(
    connectedRef,
    (snap) => {
      if (snap.val() === true) {
        void markOnline();
      }
    },
    (err) => {
      console.warn('RTDB .info/connected listener warning:', err);
    }
  );

  void markOnline();

  return {
    setReady: async (pronto: boolean) => {
      currentReady = pronto;
      if (!rtdb || disposed) return;
      try {
        await update(statusRef, {
          uid,
          nome: nome.slice(0, 32),
          online: true,
          pronto,
          lastSeen: Date.now()
        });
      } catch (err) {
        console.warn('RTDB setReady warning:', err);
      }
    },
    disconnect: async () => {
      disposed = true;
      unsubConnected();
      off(connectedRef);
      if (!rtdb) return;
      try {
        await update(statusRef, {
          online: false,
          pronto: false,
          lastSeen: Date.now()
        });
      } catch {
        // ignore cleanup errors on unmount
      }
    }
  };
}

/**
 * Subscribes to ultra-fast Realtime Database updates for a room:
 * player presence/ready status, live chat messages, dynamic turn timer, and estadoJogo.
 */
export function subscribeRoomRealtime(
  salaId: string,
  onData: (snapshot: RoomRtdbSnapshot) => void
): () => void {
  if (!rtdb || !salaId) {
    return () => {};
  }

  const safeSala = sanitizeKey(salaId);
  const salaRef = ref(rtdb, `salas/${safeSala}`);

  const unsub = onValue(
    salaRef,
    (snapshot) => {
      const val = snapshot.val() || {};
      const rawStatus = (val.status_jogadores || {}) as Record<string, PlayerPresence>;
      const rawChat = (val.chat || {}) as Record<string, Omit<RoomChatMessage, 'id'>>;
      const rawTimer = (val.timer || null) as RoomTimerState | null;
      const rawEstado = (val.estadoJogo || null) as RtdbEstadoJogo | null;

      const chatList: RoomChatMessage[] = Object.entries(rawChat)
        .map(([id, msg]) => ({
          id,
          autor: msg?.autor || 'Jogador',
          autorUid: msg?.autorUid,
          mensagem: msg?.mensagem || '',
          timestamp: typeof msg?.timestamp === 'number' ? msg.timestamp : 0
        }))
        .filter((m) => m.mensagem.length > 0)
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-40);

      onData({
        statusJogadores: rawStatus,
        chat: chatList,
        timer: rawTimer,
        estadoJogo: rawEstado,
        connected: true
      });
    },
    (err) => {
      console.warn('RTDB room subscription warning:', err);
      onData({
        statusJogadores: {},
        chat: [],
        timer: null,
        estadoJogo: null,
        connected: false
      });
    }
  );

  return () => {
    unsub();
    off(salaRef);
  };
}

/**
 * Pushes a live chat message into salas/{salaId}/chat in Realtime Database.
 */
export async function sendRoomChatMessage(
  salaId: string,
  autor: string,
  mensagem: string,
  autorUid?: string
): Promise<boolean> {
  if (!rtdb || !salaId) return false;
  const cleanMsg = mensagem.trim().slice(0, 240);
  if (!cleanMsg) return false;

  const safeSala = sanitizeKey(salaId);
  try {
    const novoChatRef = push(ref(rtdb, `salas/${safeSala}/chat`));
    await set(novoChatRef, {
      autor: autor.slice(0, 32),
      ...(autorUid ? { autorUid } : {}),
      mensagem: cleanMsg,
      timestamp: Date.now()
    });
    return true;
  } catch (err) {
    console.warn('RTDB chat send warning:', err);
    return false;
  }
}

/**
 * Updates the dynamic millisecond-precision turn timer in Realtime Database.
 */
export async function updateRoomTurnTimer(
  salaId: string,
  turnoAtual: string | null,
  durationSec = 25
): Promise<void> {
  if (!rtdb || !salaId) return;
  const safeSala = sanitizeKey(salaId);
  const timerRef = ref(rtdb, `salas/${safeSala}/timer`);
  try {
    if (!turnoAtual) {
      await set(timerRef, null);
    } else {
      await set(timerRef, {
        turnoAtual,
        endsAt: Date.now() + durationSec * 1000,
        durationSec
      });
    }
  } catch (err) {
    console.warn('RTDB timer update warning:', err);
  }
}
