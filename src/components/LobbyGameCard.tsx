import React from 'react';
import { ArrowRight, ChevronRight, Heart } from 'lucide-react';
import { GameId } from '../types/casino';
import { GameCardIllustration } from './GameCardIllustration';

export interface LobbyGameCardData {
  id: GameId;
  title: string;
  badge: string;
  category: 'all' | 'slots' | 'table' | 'cards' | 'provably-fair' | 'lottery';
  categoryLabel: string;
  description: string;
  payoutMax: string;
  rtp: string;
  provider: string;
  loadImage?: () => Promise<{ default: string }>;
}

interface LobbyGameCardProps {
  game: LobbyGameCardData;
  isFav: boolean;
  priority?: boolean;
  onSelect: (id: GameId) => void;
  onToggleFavorite?: (id: GameId) => void;
}

export const GameCardSkeleton: React.FC = () => (
  <div className="h-full min-h-[360px] rounded-3xl border-2 border-orange-500/20 bg-[#1c0805]/85 p-3.5 sm:p-5 flex flex-col justify-between animate-pulse">
    <div>
      <div className="w-full aspect-[16/9] rounded-2xl bg-[#2a0e08] border border-orange-500/15 mb-4" />
      <div className="space-y-2.5">
        <div className="flex justify-between">
          <div className="h-3 w-24 rounded bg-orange-950/80" />
          <div className="h-4 w-16 rounded bg-emerald-950/60" />
        </div>
        <div className="h-6 w-2/3 rounded bg-orange-950/90" />
        <div className="h-3.5 w-full rounded bg-orange-950/60" />
        <div className="h-3.5 w-4/5 rounded bg-orange-950/50" />
      </div>
    </div>
    <div className="mt-5 pt-3.5 border-t border-orange-500/15 flex items-center justify-between">
      <div className="space-y-1">
        <div className="h-2.5 w-16 rounded bg-orange-950/60" />
        <div className="h-4 w-20 rounded bg-amber-950/60" />
      </div>
      <div className="h-9 w-24 rounded-xl bg-orange-900/50" />
    </div>
  </div>
);

export const LobbyGameCard: React.FC<LobbyGameCardProps> = React.memo(({
  game,
  isFav,
  priority = false,
  onSelect,
  onToggleFavorite
}) => {
  return (
    <div className="lobby-card-float h-full">
      <div
        onClick={() => onSelect(game.id)}
        className="lobby-card-glow h-full group relative bg-gradient-to-b from-[#230a06] via-[#180604] to-[#0f0302] hover:bg-[#250d09] border-2 border-amber-500/45 hover:border-amber-400/90 rounded-3xl overflow-hidden p-3.5 sm:p-5 shadow-[inset_0_0_24px_rgba(0,0,0,0.88),0_0_14px_rgba(249,115,22,0.26),0_12px_28px_rgba(0,0,0,0.65)] hover:shadow-[inset_0_0_20px_rgba(0,0,0,0.75),0_0_35px_rgba(245,158,11,0.45),0_15px_30px_rgba(0,0,0,0.7)] transition-all duration-300 transform-gpu hover:-translate-y-1.5 hover:scale-[1.018] active:scale-[0.99] cursor-pointer flex flex-col justify-between"
      >
        {/* Subtle Golden Ambient Glow on Hover */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/0 via-amber-500/15 to-orange-500/0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none blur-sm" />

        <div>
          {/* AAA Game Artwork Container */}
          <div className="relative mb-4 overflow-hidden rounded-2xl shadow-[inset_0_0_26px_rgba(0,0,0,0.85),0_8px_18px_rgba(0,0,0,0.65)] border border-amber-500/40">
            <GameCardIllustration
              gameId={game.id}
              loadImage={game.loadImage}
              priority={priority}
              badge={game.badge}
            />
            <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_26px_rgba(0,0,0,0.72)] rounded-2xl" />

            {/* Favorite Heart Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite?.(game.id);
              }}
              aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              className={`absolute top-2.5 right-2.5 z-30 p-2 rounded-full transition-all duration-200 cursor-pointer shadow-lg backdrop-blur-md border ${
                isFav
                  ? 'bg-rose-950/90 border-rose-500 text-rose-400 hover:scale-110 shadow-[0_0_14px_rgba(244,63,94,0.5)]'
                  : 'bg-black/60 border-orange-500/40 text-orange-200/60 hover:text-rose-400 hover:border-rose-400 hover:scale-110'
              }`}
              title={isFav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
            >
              <Heart
                className={`w-4 h-4 transition-transform ${
                  isFav
                    ? 'fill-rose-500 text-rose-500 scale-110'
                    : 'text-orange-200/80 hover:text-rose-400'
                }`}
              />
            </button>

            {/* Play Button Overlay on Hover */}
            <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <div className="px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 text-white text-sm font-black uppercase tracking-wider shadow-2xl flex items-center gap-2 border border-orange-200 group-hover:scale-105 transition-transform">
                <span>JOGAR AGORA</span>
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-orange-400/90 font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                {game.provider}
              </span>
              <span className="font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-md text-[11px]">
                RTP {game.rtp}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white font-cinzel group-hover:text-orange-300 transition-colors">
              {game.title}
            </h3>

            <p className="text-xs sm:text-sm text-orange-200/80 leading-relaxed font-normal">
              {game.description}
            </p>
          </div>
        </div>

        {/* Bottom Card Footer with Big Play Button */}
        <div className="mt-5 pt-3.5 border-t border-orange-500/25 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-orange-400/70 uppercase tracking-wider font-semibold">Prêmio Máximo</span>
            <span className="font-mono font-black text-amber-300 text-sm sm:text-base">
              Até {game.payoutMax}
            </span>
          </div>

          <div className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-cinzel font-black text-xs sm:text-sm shadow-md flex items-center gap-2 border border-orange-400/50 group-hover:brightness-110 transition-all">
            <span>JOGAR</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
});

LobbyGameCard.displayName = 'LobbyGameCard';
