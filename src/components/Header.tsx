import React, { useState, useEffect, useRef } from 'react';
import { GameId, UserAccount } from '../types/casino';
import { 
  Volume2, 
  VolumeX, 
  Gift, 
  Menu, 
  Search, 
  Crown,
  Sparkles,
  Trophy,
  LogOut,
  Clock,
  Dices,
  Download,
  Heart,
  Flame
} from 'lucide-react';
import { canClaimDailyBonus, getDailyBonusRemainingMs, canSpinDailyWheel, getDailyWheelRemainingMs, formatRemainingTime } from '../utils/auth';
import { LUCKY_STREAK_THRESHOLD, LUCKY_STREAK_BONUS_RATE, isLuckyStreakActive } from '../utils/luckyStreak';

interface HeaderProps {
  activeGame: GameId;
  onNavigate: (game: GameId) => void;
  balance: number;
  currentUser: UserAccount | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenSocialModal: () => void;
  onClaimDailyBonus: () => void;
  onOpenDailyWheel: () => void;
  onLogout: () => void;
  onToggleSidebar?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  favoriteGameIds?: string[];
  showFavoritesOnly?: boolean;
  onToggleFavoritesOnly?: () => void;
  winStreak?: number;
  luckyStreakBonusNotification?: { id: number; bonusAmount: number; streakCount: number } | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeGame,
  onNavigate,
  balance,
  currentUser,
  isMuted,
  onToggleMute,
  onOpenSocialModal,
  onClaimDailyBonus,
  onOpenDailyWheel,
  onLogout,
  onToggleSidebar,
  searchQuery = '',
  onSearchChange,
  favoriteGameIds = [],
  showFavoritesOnly = false,
  onToggleFavoritesOnly,
  winStreak = 0,
  luckyStreakBonusNotification = null
}) => {
  const [bonusCountdown, setBonusCountdown] = useState<string>('');
  const [wheelCountdown, setWheelCountdown] = useState<string>('');
  const [hasBonusAvailable, setHasBonusAvailable] = useState<boolean>(false);
  const [hasWheelAvailable, setHasWheelAvailable] = useState<boolean>(false);
  const [isAvatarGoal, setIsAvatarGoal] = useState<boolean>(false);

  // Smooth numerical balance counting animation state
  const currentUsername = currentUser?.username ?? null;
  const [displayBalance, setDisplayBalance] = useState<number>(balance);
  const [balanceTrend, setBalanceTrend] = useState<'win' | 'loss' | 'idle'>('idle');
  const [balanceDelta, setBalanceDelta] = useState<number>(0);
  const [deltaAnimKey, setDeltaAnimKey] = useState<number>(0);
  const prevUsernameRef = useRef<string | null>(currentUsername);
  const prevBalanceRef = useRef<number>(balance);
  const displayBalanceRef = useRef<number>(balance);
  const rafRef = useRef<number | null>(null);
  const trendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Snap immediately when switching users, logging in, or logging out
    if (prevUsernameRef.current !== currentUsername) {
      prevUsernameRef.current = currentUsername;
      prevBalanceRef.current = balance;
      displayBalanceRef.current = balance;
      setDisplayBalance(balance);
      setBalanceTrend('idle');
      setBalanceDelta(0);
      if (trendTimerRef.current) {
        clearTimeout(trendTimerRef.current);
        trendTimerRef.current = null;
      }
      return;
    }

    const startVal = displayBalanceRef.current;
    const endVal = balance;
    const diff = endVal - prevBalanceRef.current;
    prevBalanceRef.current = endVal;

    if (diff !== 0) {
      setBalanceTrend(diff > 0 ? 'win' : 'loss');
      setBalanceDelta(diff);
      setDeltaAnimKey((k) => k + 1);
      if (trendTimerRef.current) clearTimeout(trendTimerRef.current);
      trendTimerRef.current = setTimeout(() => {
        setBalanceTrend('idle');
        setBalanceDelta(0);
      }, 1400);
    }

    if (startVal === endVal) {
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      displayBalanceRef.current = endVal;
      setDisplayBalance(endVal);
      return;
    }

    const absDiff = Math.abs(endVal - startVal);
    const duration = Math.min(950, Math.max(400, Math.round(320 + Math.log10(Math.max(10, absDiff)) * 125)));
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic for smooth, snappy casino tally
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * eased);
      displayBalanceRef.current = current;
      setDisplayBalance(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        displayBalanceRef.current = endVal;
        setDisplayBalance(endVal);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [balance, currentUsername]);

  useEffect(() => {
    return () => {
      if (trendTimerRef.current) clearTimeout(trendTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleGoal = () => {
      setIsAvatarGoal(false);
      requestAnimationFrame(() => {
        setIsAvatarGoal(true);
      });
      clearTimeout(timer);
      timer = setTimeout(() => {
        setIsAvatarGoal(false);
      }, 1900);
    };
    window.addEventListener('sapecas_avatar_goal', handleGoal);
    window.addEventListener('sapecas_avatar_win', handleGoal);
    return () => {
      window.removeEventListener('sapecas_avatar_goal', handleGoal);
      window.removeEventListener('sapecas_avatar_win', handleGoal);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const tick = () => {
      const bonusReady = canClaimDailyBonus(currentUser);
      setHasBonusAvailable(bonusReady);
      if (!bonusReady) {
        setBonusCountdown(formatRemainingTime(getDailyBonusRemainingMs(currentUser)));
      }

      const wheelReady = canSpinDailyWheel(currentUser);
      setHasWheelAvailable(wheelReady);
      if (!wheelReady) {
        setWheelCountdown(formatRemainingTime(getDailyWheelRemainingMs(currentUser)));
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  return (
    <header className="sticky top-0 z-40 shrink-0 bg-[#160705]/95 backdrop-blur-md border-b border-orange-500/25 px-2.5 sm:px-6 py-1.5 sm:py-2 transition-colors shadow-lg shadow-black/40">
      <div className="max-w-7xl mx-auto flex flex-col gap-1.5">
        {/* FILEIRA 1: Marca, Saldo (Dinheiro) em destaque, Perfil e Controles */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          {/* Left: Mobile Sidebar Trigger & Brand */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="lg:hidden p-1.5 rounded-xl bg-[#250d09] border border-orange-500/30 text-orange-300 hover:text-white hover:bg-orange-600/30 transition-colors cursor-pointer shrink-0"
                aria-label="Abrir menu"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => onNavigate('lobby')}
              className="flex items-center gap-1.5 sm:gap-2 text-left group cursor-pointer focus:outline-none min-w-0"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-orange-500 via-red-600 to-amber-500 flex items-center justify-center shadow-md shadow-orange-600/40 border border-amber-300 shrink-0">
                <span className="text-slate-950 font-cinzel font-black text-sm sm:text-base">♠</span>
              </div>
              <div className="min-w-0">
                <span className="font-cinzel text-sm sm:text-lg font-black tracking-wider text-orange-400 group-hover:text-amber-300 transition-colors block leading-tight truncate">
                  SAPECAS
                </span>
                <span className="text-[8px] sm:text-[9px] uppercase tracking-widest text-amber-400 font-bold block leading-none truncate">
                  Cassino Social
                </span>
              </div>
            </button>
          </div>

          {/* Right: Money (Fichas) Always Visible + Profile + Audio + Logout */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Fictional Chip Balance with Smooth Counting Animation & Win/Loss Feedback */}
            <div
              className={`relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl border transition-all duration-300 shrink-0 ${
                balanceTrend === 'win'
                  ? 'bg-emerald-950/75 border-emerald-400/90 shadow-[0_0_20px_rgba(16,185,129,0.45)] scale-[1.03]'
                  : balanceTrend === 'loss'
                    ? 'bg-rose-950/65 border-rose-500/80 shadow-[0_0_16px_rgba(244,63,94,0.35)]'
                    : 'bg-[#2a1009] border-amber-400/60 shadow-[0_0_14px_rgba(245,158,11,0.22)]'
              }`}
            >
              <span className={`text-sm sm:text-base leading-none transition-transform duration-300 ${balanceTrend === 'win' ? 'scale-125' : ''}`}>
                🪙
              </span>
              <div className="flex flex-col text-right">
                <span className="text-[8px] uppercase tracking-wider text-amber-300/80 font-bold leading-none">
                  Fichas
                </span>
                <span
                  aria-live="polite"
                  className={`font-mono text-xs sm:text-sm font-black tabular-nums leading-tight whitespace-nowrap transition-colors duration-200 ${
                    balanceTrend === 'win'
                      ? 'text-emerald-300'
                      : balanceTrend === 'loss'
                        ? 'text-rose-300'
                        : 'text-amber-300'
                  }`}
                >
                  {displayBalance.toLocaleString('pt-BR')}
                </span>
              </div>

              {balanceTrend !== 'idle' && balanceDelta !== 0 && (
                <span
                  key={deltaAnimKey}
                  className={`pointer-events-none absolute -bottom-4 right-1 z-50 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-black tracking-tight shadow-lg border animate-bounce whitespace-nowrap ${
                    balanceTrend === 'win'
                      ? 'bg-emerald-950/95 border-emerald-400/70 text-emerald-300'
                      : 'bg-rose-950/95 border-rose-500/70 text-rose-300'
                  }`}
                >
                  {balanceDelta > 0 ? `+${balanceDelta.toLocaleString('pt-BR')}` : balanceDelta.toLocaleString('pt-BR')}
                </span>
              )}
            </div>

            {/* User Profile Badge with Avatar Pulse & 360-Degree Rotation */}
            {currentUser && (
              <div
                className={`flex items-center gap-1 sm:gap-1.5 p-0.5 sm:pl-1.5 sm:pr-2 sm:py-0.5 rounded-xl bg-[#200a07] border text-xs transition-all duration-300 shrink-0 ${
                  isAvatarGoal
                    ? 'border-amber-400 bg-[#351009] avatar-badge-glow shadow-[0_0_18px_rgba(245,158,11,0.6)]'
                    : 'border-orange-500/25'
                }`}
                title={`Perfil: ${currentUser.nickname || currentUser.username}`}
              >
                <div
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 flex items-center justify-center text-xs sm:text-sm font-black shadow-sm border border-amber-300/40 transition-all ${
                    isAvatarGoal
                      ? 'avatar-goal-pulse ring-2 ring-yellow-300 shadow-[0_0_16px_#f59e0b]'
                      : ''
                  }`}
                >
                  {currentUser.avatar || '🦁'}
                </div>
                <span className="hidden sm:inline font-bold text-amber-200 max-w-[95px] truncate">
                  {currentUser.nickname || currentUser.username}
                </span>
              </div>
            )}

            {/* Sound Mute Toggle */}
            <button
              onClick={onToggleMute}
              aria-label={isMuted ? 'Ativar som' : 'Desativar som'}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#220a07] border border-orange-500/30 hover:border-orange-400 text-orange-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title={isMuted ? 'Som Desativado' : 'Som Ativado'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-orange-400" />}
            </button>

            {/* Logout Button */}
            {currentUser && (
              <button
                onClick={onLogout}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#250d09] border border-orange-500/30 hover:border-red-500/60 text-orange-300 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Sair da Conta (Logout)"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* FILEIRA 2: Bônus, Navegação, Lucky Streak e Busca */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-orange-500/15">
          {/* Left: Daily Wheel, Daily Bonus, Missions, Rankings & Lucky Streak */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            {/* Daily Wheel Trigger */}
            <button
              onClick={onOpenDailyWheel}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                hasWheelAvailable
                  ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 text-slate-950 border-amber-300 shadow-md shadow-amber-500/20 animate-pulse font-black'
                  : 'bg-[#220a07] text-orange-200 border-orange-500/30 hover:bg-[#2d0e09]'
              }`}
              title="Gire a Roleta Diária grátis a cada 24 horas"
            >
              <span className="text-xs sm:text-sm leading-none">🎡</span>
              <span>{hasWheelAvailable ? 'Roleta!' : `Roleta (${wheelCountdown})`}</span>
            </button>

            {/* Daily 10k Bonus Trigger */}
            <button
              onClick={onClaimDailyBonus}
              disabled={!hasBonusAvailable}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                hasBonusAvailable
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-300 shadow-md shadow-emerald-500/20 animate-bounce'
                  : 'bg-[#220a07] text-orange-300/60 border-orange-500/20 opacity-80 cursor-not-allowed'
              }`}
              title="Resgate 10.000 fichas a cada 24 horas"
            >
              <Gift className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 shrink-0" />
              <span className="sm:hidden">{hasBonusAvailable ? '+10k 🪙' : bonusCountdown}</span>
              <span className="hidden sm:inline">
                {hasBonusAvailable ? 'Resgatar +10.000 Fichas 🪙' : `Bônus (${bonusCountdown})`}
              </span>
            </button>

            {/* Missões Diárias Button */}
            <button
              onClick={() => onNavigate('missions')}
              className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                activeGame === 'missions'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-[#220a07] text-orange-200 border-orange-500/30 hover:bg-[#2d0e09]'
              }`}
            >
              <span className="text-sm leading-none">🎯</span>
              <span>Missões</span>
            </button>

            {/* Rankings Button */}
            <button
              onClick={() => onNavigate('records')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                activeGame === 'records'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-[#220a07] text-orange-200 border-orange-500/30 hover:bg-[#2d0e09]'
              }`}
              title="Rankings"
            >
              <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Rankings</span>
            </button>

            {/* Lucky Streak Counter (activates at 3+ consecutive wins) */}
            {(() => {
              const streakActive = isLuckyStreakActive(winStreak);
              const bonusPct = Math.round(LUCKY_STREAK_BONUS_RATE * 100);
              return (
                <div
                  className={`relative flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl border transition-all duration-300 select-none ${
                    streakActive
                      ? 'bg-gradient-to-r from-red-950/95 via-orange-900/90 to-amber-900/90 border-amber-400 text-amber-200 lucky-streak-active'
                      : winStreak > 0
                        ? 'bg-[#2a1008] border-orange-500/50 text-orange-200 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                        : 'bg-[#1c0805] border-orange-500/20 text-orange-300/60'
                  }`}
                  title={
                    streakActive
                      ? `Lucky Streak Ativo! (${winStreak} vitórias seguidas) — Bônus de +${bonusPct}% no ganho base da próxima rodada!`
                      : `Lucky Streak: ${winStreak}/${LUCKY_STREAK_THRESHOLD} vitórias seguidas para ativar bônus de +${bonusPct}% na próxima vitória`
                  }
                >
                  <Flame
                    className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-all shrink-0 ${
                      streakActive
                        ? 'text-amber-300 fill-orange-500 lucky-streak-flame'
                        : winStreak > 0
                          ? 'text-orange-400 fill-orange-500/40'
                          : 'text-orange-500/40'
                    }`}
                  />

                  <span className="hidden xl:inline text-[10px] uppercase tracking-wider font-bold text-orange-300/80">
                    Streak
                  </span>

                  <span
                    className={`font-mono text-[10px] sm:text-xs font-black tabular-nums leading-none ${
                      streakActive
                        ? 'text-amber-200'
                        : winStreak > 0
                          ? 'text-orange-300'
                          : 'text-orange-300/60'
                    }`}
                  >
                    {streakActive ? `${winStreak}x` : `${winStreak}/${LUCKY_STREAK_THRESHOLD}`}
                  </span>

                  {streakActive ? (
                    <span className="px-1 py-0.5 rounded bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-mono text-[9px] font-black leading-none shadow-sm">
                      +{bonusPct}%
                    </span>
                  ) : (
                    <span className="hidden md:flex items-center gap-0.5 ml-0.5">
                      {Array.from({ length: LUCKY_STREAK_THRESHOLD }).map((_, idx) => (
                        <span
                          key={idx}
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            idx < winStreak
                              ? 'bg-orange-400 shadow-[0_0_5px_rgba(251,146,60,0.9)]'
                              : 'bg-orange-950 border border-orange-500/30'
                          }`}
                        />
                      ))}
                    </span>
                  )}

                  {luckyStreakBonusNotification && (
                    <span
                      key={luckyStreakBonusNotification.id}
                      className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded-md text-[10px] font-mono font-black tracking-tight shadow-lg border bg-gradient-to-r from-red-950/95 to-amber-950/95 border-amber-400 text-amber-300 lucky-streak-bonus-pop z-50"
                    >
                      🔥 +{luckyStreakBonusNotification.bonusAmount.toLocaleString('pt-BR')} (+{bonusPct}%)
                    </span>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Right: Search, Favorites & .ZIP Download */}
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="flex items-center gap-1 sm:gap-1.5 bg-[#1f0906] border border-orange-500/35 rounded-lg sm:rounded-xl px-2 py-0.5 sm:py-1 focus-within:border-orange-400 transition-colors shadow-inner">
              <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Buscar..."
                className="bg-transparent border-none text-[11px] sm:text-xs text-white placeholder-orange-300/40 focus:outline-none w-16 sm:w-28 md:w-36"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange?.('')}
                  className="text-orange-400/70 hover:text-white text-xs px-0.5 cursor-pointer"
                  title="Limpar busca"
                >
                  ✕
                </button>
              )}
              {onToggleFavoritesOnly && (
                <button
                  onClick={onToggleFavoritesOnly}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-bold transition-all border cursor-pointer ${
                    showFavoritesOnly
                      ? 'bg-rose-600/40 text-rose-300 border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.35)]'
                      : 'bg-[#270e0a] text-orange-200/70 hover:text-rose-300 border-orange-500/25 hover:border-rose-500/40'
                  }`}
                  title={showFavoritesOnly ? 'Exibindo apenas favoritos (clique para ver todos)' : 'Filtrar apenas jogos favoritos'}
                >
                  <Heart className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${showFavoritesOnly ? 'fill-rose-500 text-rose-500' : 'text-rose-400'}`} />
                  <span className="hidden md:inline">Favoritos</span>
                  {(favoriteGameIds?.length ?? 0) > 0 && (
                    <span className={`text-[9px] sm:text-[10px] px-1 rounded-full font-mono ${showFavoritesOnly ? 'bg-rose-500 text-white' : 'bg-black/40 text-orange-300'}`}>
                      {favoriteGameIds?.length}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* ZIP Package Download */}
            <a
              href="/sapecas-cassino.zip"
              download="sapecas-cassino.zip"
              className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-orange-600/30 hover:bg-orange-600/50 border border-orange-400/50 text-orange-200 hover:text-white text-xs font-bold transition-all shadow-sm shrink-0"
              title="Baixar pacote completo em .ZIP (pronto para publicar ou abrir offline)"
            >
              <Download className="w-3.5 h-3.5 text-orange-300" />
              <span>.ZIP</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};
