import React, { Suspense, useEffect, useRef, useState } from 'react';
import { GameId } from '../types/casino';
import { GameCardSkeleton, LobbyGameCardData } from './LobbyGameCard';

const LazyLobbyGameCardComponent = React.lazy(() =>
  import('./LobbyGameCard').then((module) => ({ default: module.LobbyGameCard }))
);

interface LazyGameCardProps {
  game: LobbyGameCardData;
  isFav: boolean;
  priority?: boolean;
  onSelect: (id: GameId) => void;
  onToggleFavorite?: (id: GameId) => void;
}

export const LazyGameCard: React.FC<LazyGameCardProps> = ({
  game,
  isFav,
  priority = false,
  onSelect,
  onToggleFavorite
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState<boolean>(priority);

  useEffect(() => {
    if (priority || shouldRender) return;

    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldRender(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '280px 0px', threshold: 0.01 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [priority, shouldRender]);

  return (
    <div ref={containerRef} className="h-full">
      {shouldRender ? (
        <Suspense fallback={<GameCardSkeleton />}>
          <LazyLobbyGameCardComponent
            game={game}
            isFav={isFav}
            priority={priority}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
          />
        </Suspense>
      ) : (
        <GameCardSkeleton />
      )}
    </div>
  );
};
