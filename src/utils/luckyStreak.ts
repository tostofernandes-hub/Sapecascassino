import { GameId } from '../types/casino';

export const LUCKY_STREAK_THRESHOLD = 3;
export const LUCKY_STREAK_BONUS_RATE = 0.10; // +10% multiplier bonus on base win

const STREAK_STORAGE_PREFIX = 'sapecas_lucky_streak_v1_';

export interface LuckyStreakState {
  current: number;
  best: number;
}

export function getLuckyStreakState(username?: string | null): LuckyStreakState {
  if (!username) return { current: 0, best: 0 };
  try {
    const raw = localStorage.getItem(`${STREAK_STORAGE_PREFIX}${username.toLowerCase()}`);
    if (!raw) return { current: 0, best: 0 };
    const parsed = JSON.parse(raw);
    return {
      current: typeof parsed.current === 'number' && parsed.current >= 0 ? parsed.current : 0,
      best: typeof parsed.best === 'number' && parsed.best >= 0 ? parsed.best : 0,
    };
  } catch {
    return { current: 0, best: 0 };
  }
}

export function saveLuckyStreakState(
  username: string | null | undefined,
  current: number,
  best: number
): void {
  if (!username) return;
  try {
    localStorage.setItem(
      `${STREAK_STORAGE_PREFIX}${username.toLowerCase()}`,
      JSON.stringify({ current, best })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function isLuckyStreakActive(streak: number): boolean {
  return streak >= LUCKY_STREAK_THRESHOLD;
}

export function calculateLuckyStreakBonus(baseWin: number, streak: number): number {
  if (!isLuckyStreakActive(streak) || baseWin <= 0) return 0;
  return Math.max(1, Math.round(baseWin * LUCKY_STREAK_BONUS_RATE));
}

export function reportRoundLoss(gameId: GameId): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('sapecas_round_loss', { detail: { gameId } }));
}
