import React, { useState, useEffect, useRef } from 'react';
import {
  PlayerPresence,
  RoomChatMessage,
  RoomTimerState
} from '../utils/rtdbRoom';
import {
  MessageSquare,
  Send,
  Timer,
  Wifi,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface RoomChatAndPresenceProps {
  presenceMap: Record<string, PlayerPresence>;
  chatMessages: RoomChatMessage[];
  timer: RoomTimerState | null;
  myUid?: string | null;
  myReady: boolean;
  onToggleReady?: () => void;
  showReadyToggle?: boolean;
  onSendMessage: (msg: string) => Promise<void> | void;
  turnPlayerName?: string;
  onTimerExpire?: () => void;
  isMyTurn?: boolean;
}

export const RoomChatAndPresence: React.FC<RoomChatAndPresenceProps> = ({
  presenceMap,
  chatMessages,
  timer,
  myUid,
  myReady,
  onToggleReady,
  showReadyToggle = false,
  onSendMessage,
  turnPlayerName,
  onTimerExpire,
  isMyTurn = false
}) => {
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const expiredForEndsAtRef = useRef<number>(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!timer || !timer.turnoAtual || !timer.endsAt) {
      setSecondsLeft(0);
      return;
    }

    const updateCountdown = () => {
      const remainingMs = Math.max(0, timer.endsAt - Date.now());
      const secs = Math.ceil(remainingMs / 1000);
      setSecondsLeft(secs);

      if (
        remainingMs === 0 &&
        isMyTurn &&
        onTimerExpire &&
        expiredForEndsAtRef.current !== timer.endsAt
      ) {
        expiredForEndsAtRef.current = timer.endsAt;
        onTimerExpire();
      }
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(interval);
  }, [timer?.turnoAtual, timer?.endsAt, isMyTurn, onTimerExpire]);

  useEffect(() => {
    if (chatOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages.length, chatOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSendMessage(trimmed);
      setChatInput('');
    } finally {
      setSending(false);
    }
  };

  const presenceList = Object.values(presenceMap);
  const timerPct =
    timer && timer.durationSec > 0
      ? Math.min(100, Math.max(0, (secondsLeft / timer.durationSec) * 100))
      : 0;

  return (
    <div className="bg-[#160604]/95 border border-orange-500/30 rounded-xl p-2 space-y-1.5 shadow-lg">
      {/* Top Strip: Turn Timer + Online Presence + Ready & Chat Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            <Wifi className="w-3 h-3" />
            <span>Tempo Real</span>
          </span>

          {presenceList.map((p) => (
            <span
              key={p.uid}
              className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                p.online
                  ? 'bg-[#240b06] border-orange-500/30 text-orange-100'
                  : 'bg-slate-950/80 border-slate-700/60 text-slate-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  p.online ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
                }`}
              />
              <span className="font-semibold max-w-[90px] truncate">
                {p.nome}
                {p.uid === myUid ? ' (Você)' : ''}
              </span>
              {p.pronto && (
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
              )}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {showReadyToggle && onToggleReady && (
            <button
              type="button"
              onClick={onToggleReady}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all border ${
                myReady
                  ? 'bg-emerald-600/90 border-emerald-400 text-white'
                  : 'bg-[#260d08] border-amber-500/40 text-amber-300 hover:bg-[#36130c]'
              }`}
            >
              {myReady ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <Circle className="w-3 h-3" />
              )}
              <span>{myReady ? 'Pronto ✓' : 'Marcar Pronto'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setChatOpen((prev) => !prev)}
            className="px-2.5 py-1 rounded-lg bg-[#240b06] hover:bg-[#321009] border border-orange-500/35 text-amber-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <MessageSquare className="w-3 h-3" />
            <span>Chat ({chatMessages.length})</span>
            {chatOpen ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* Dynamic Turn Countdown Bar */}
      {timer && timer.turnoAtual && secondsLeft > 0 && (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1 text-amber-300 font-bold">
              <Timer className="w-3 h-3" />
              <span>
                Cronômetro do Turno{turnPlayerName ? ` (${turnPlayerName})` : ''}:
              </span>
            </span>
            <span
              className={`font-mono font-black ${
                secondsLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-amber-300'
              }`}
            >
              {secondsLeft}s
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-black/60 overflow-hidden border border-orange-500/20">
            <div
              className={`h-full transition-all duration-200 ${
                secondsLeft <= 5
                  ? 'bg-red-500'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
              }`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Collapsible Live Chat Box */}
      {chatOpen && (
        <div className="border-t border-orange-500/20 pt-1.5 space-y-1.5">
          <div className="max-h-28 overflow-y-auto space-y-1 pr-1 text-[11px]">
            {chatMessages.length === 0 ? (
              <div className="text-orange-300/45 italic text-center py-2">
                Nenhuma mensagem ainda. Diga olá para a mesa!
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="bg-[#1f0905] border border-orange-500/15 rounded-lg px-2 py-1 flex items-baseline gap-1.5"
                >
                  <span className="font-bold text-amber-300 shrink-0">
                    {msg.autor}:
                  </span>
                  <span className="text-orange-100 break-words">{msg.mensagem}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-1.5">
            <input
              type="text"
              maxLength={240}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Enviar mensagem para a mesa..."
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#0f0402] border border-orange-500/30 text-xs text-orange-100 placeholder-orange-300/35 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || sending}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <Send className="w-3 h-3" />
              <span>Enviar</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
