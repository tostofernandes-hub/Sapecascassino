import React, { useState, useEffect, useRef } from 'react';
import { Music, Volume2, VolumeX, ChevronLeft, ChevronRight, GripVertical, Sparkles } from 'lucide-react';
import { soundManager } from '../utils/audio';

const WIDGET_POS_KEY = 'sapecas_sound_widget_pos';

interface WidgetPosition {
  edge: 'left' | 'right';
  yPercent: number;
}

const DEFAULT_POS: WidgetPosition = {
  edge: 'right',
  yPercent: 78
};

export const FloatingSoundWidget: React.FC = () => {
  const [musicEnabled, setMusicEnabled] = useState<boolean>(() => soundManager.isMusicEnabled());
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => soundManager.isSfxEnabled());
  const [expanded, setExpanded] = useState<boolean>(false);

  const [pos, setPos] = useState<WidgetPosition>(() => {
    try {
      const saved = localStorage.getItem(WIDGET_POS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if ((parsed.edge === 'left' || parsed.edge === 'right') && typeof parsed.yPercent === 'number') {
          return {
            edge: parsed.edge,
            yPercent: Math.min(88, Math.max(12, parsed.yPercent))
          };
        }
      }
    } catch {
      // Fallback to default
    }
    return DEFAULT_POS;
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragCoords, setDragCoords] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = soundManager.subscribe(() => {
      setMusicEnabled(soundManager.isMusicEnabled());
      setSfxEnabled(soundManager.isSfxEnabled());
    });
    return unsub;
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(WIDGET_POS_KEY, JSON.stringify(pos));
    } catch {
      // Ignore storage quota errors
    }
  }, [pos]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    // Allow normal button clicks without starting a drag unless dragging the grip or moving past threshold
    if (target.closest('button[data-action="toggle"]')) return;

    dragStartRef.current = { x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = Math.abs(e.clientX - dragStartRef.current.x);
    const dy = Math.abs(e.clientY - dragStartRef.current.y);
    if (dx > 6 || dy > 6) {
      dragStartRef.current.moved = true;
      setIsDragging(true);
      const clampedY = Math.min(window.innerHeight - 56, Math.max(64, e.clientY));
      const clampedX = Math.min(window.innerWidth - 40, Math.max(40, e.clientX));
      setDragCoords({ x: clampedX, y: clampedY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const wasMoved = dragStartRef.current.moved;
    dragStartRef.current = null;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore release error
    }

    if (wasMoved && dragCoords) {
      const nearestEdge: 'left' | 'right' = dragCoords.x < window.innerWidth / 2 ? 'left' : 'right';
      const yPct = Math.min(88, Math.max(12, Math.round((dragCoords.y / window.innerHeight) * 100)));
      setPos({ edge: nearestEdge, yPercent: yPct });
    }

    setIsDragging(false);
    setDragCoords(null);
  };

  const handleToggleMusic = () => {
    soundManager.toggleMusic();
  };

  const handleToggleSfx = () => {
    soundManager.toggleSfx();
  };

  const isRight = pos.edge === 'right';
  const bothMuted = !musicEnabled && !sfxEnabled;

  const styleObj: React.CSSProperties = isDragging && dragCoords
    ? {
        left: `${dragCoords.x}px`,
        top: `${dragCoords.y}px`,
        transform: 'translate(-50%, -50%)',
        transition: 'none'
      }
    : {
        top: `${pos.yPercent}%`,
        transform: 'translateY(-50%)',
        ...(isRight ? { right: '0px' } : { left: '0px' })
      };

  return (
    <div
      ref={widgetRef}
      style={styleObj}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`fixed z-50 select-none touch-none ${
        isDragging ? 'scale-105 cursor-grabbing' : 'transition-all duration-300 ease-out'
      }`}
      aria-label="Controle flutuante de áudio"
    >
      <div
        className={`flex items-center bg-[#180704]/95 backdrop-blur-md border border-amber-500/45 shadow-[0_8px_28px_rgba(0,0,0,0.8),0_0_16px_rgba(234,88,12,0.2)] ${
          isDragging
            ? 'rounded-2xl px-2.5 py-2'
            : isRight
              ? 'rounded-l-2xl border-r-0 pl-2 pr-1.5 py-1.5 flex-row'
              : 'rounded-r-2xl border-l-0 pr-2 pl-1.5 py-1.5 flex-row-reverse'
        } gap-1.5`}
      >
        {/* Drag Handle */}
        <div
          className="cursor-grab active:cursor-grabbing text-orange-400/50 hover:text-amber-300 px-0.5 flex items-center"
          title="Arraste para mover pelas bordas da tela"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Expanded Independent Controls */}
        {expanded && (
          <div className="flex items-center gap-1.5 animate-fade-in">
            {/* Independent Background Music Toggle */}
            <button
              type="button"
              data-action="toggle"
              onClick={handleToggleMusic}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                musicEnabled
                  ? 'bg-gradient-to-r from-amber-500/25 to-orange-500/25 border-amber-400/70 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                  : 'bg-black/40 border-orange-500/20 text-orange-300/45 hover:text-orange-200'
              }`}
              title={musicEnabled ? 'Desligar música ambiente' : 'Ligar música ambiente'}
            >
              <Music className={`w-3.5 h-3.5 ${musicEnabled ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
              <span>Música</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  musicEnabled ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-rose-500/70'
                }`}
              />
            </button>

            {/* Independent SFX Toggle */}
            <button
              type="button"
              data-action="toggle"
              onClick={handleToggleSfx}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                sfxEnabled
                  ? 'bg-gradient-to-r from-emerald-600/25 to-teal-600/20 border-emerald-400/70 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                  : 'bg-black/40 border-orange-500/20 text-orange-300/45 hover:text-orange-200'
              }`}
              title={sfxEnabled ? 'Desligar efeitos sonoros' : 'Ligar efeitos sonoros'}
            >
              {sfxEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span>Efeitos</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  sfxEnabled ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-rose-500/70'
                }`}
              />
            </button>
          </div>
        )}

        {/* Compact Collapsed Pill / Expand-Collapse Trigger */}
        <button
          type="button"
          data-action="toggle"
          onClick={() => {
            soundManager.playClick();
            setExpanded((prev) => !prev);
          }}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border transition-all cursor-pointer ${
            bothMuted
              ? 'bg-red-950/60 border-red-500/40 text-red-300'
              : 'bg-[#2a0d08] border-orange-500/35 hover:border-amber-400 text-amber-300'
          }`}
          title={expanded ? 'Recolher controles de som' : 'Abrir controles independentes de Música e Efeitos'}
        >
          {/* Status Dots when collapsed */}
          {!expanded && (
            <div className="flex items-center gap-1">
              <Music className={`w-3.5 h-3.5 ${musicEnabled ? 'text-amber-400' : 'text-slate-600'}`} />
              {sfxEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              )}
            </div>
          )}

          {expanded ? (
            isRight ? (
              <ChevronRight className="w-3.5 h-3.5 text-amber-300" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5 text-amber-300" />
            )
          ) : (
            <Sparkles className="w-2.5 h-2.5 text-amber-400/70 hidden sm:block" />
          )}
        </button>
      </div>
    </div>
  );
};
