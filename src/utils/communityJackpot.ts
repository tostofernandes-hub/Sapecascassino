// Shared Community Jackpot engine for Sapecas Cassino
// Fills up slightly with every bet placed across all games.
// When reaching 100% (target pot), awards the trigger player with the entire accumulated bonus!

export interface CommunityJackpotState {
  currentPot: number;
  targetPot: number;
  percentage: number;
  lastWinner: {
    username: string;
    amount: number;
    date: string;
  } | null;
}

const STORAGE_KEY = 'sapecas_community_jackpot_v1';
const DEFAULT_BASE_POT = 28500;
const DEFAULT_TARGET_POT = 75000;

export function getCommunityJackpot(): CommunityJackpotState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const current = Number(parsed.currentPot) || DEFAULT_BASE_POT;
      const target = Number(parsed.targetPot) || DEFAULT_TARGET_POT;
      const pct = Math.min(100, Math.round((current / target) * 1000) / 10);
      return {
        currentPot: current,
        targetPot: target,
        percentage: pct,
        lastWinner: parsed.lastWinner || {
          username: 'Tigrinho Imperial',
          amount: 75000,
          date: 'Hoje'
        }
      };
    }
  } catch (e) {
    console.error('Error reading community jackpot:', e);
  }

  // Initial seed
  const initialState: CommunityJackpotState = {
    currentPot: 42680,
    targetPot: DEFAULT_TARGET_POT,
    percentage: Math.round((42680 / DEFAULT_TARGET_POT) * 1000) / 10,
    lastWinner: {
      username: 'Barão Von Pork',
      amount: 72400,
      date: 'Ontem'
    }
  };

  saveCommunityJackpot(initialState);
  return initialState;
}

export function saveCommunityJackpot(state: CommunityJackpotState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('sapecas_jackpot_update', { detail: state }));
  } catch (e) {
    console.error('Error saving community jackpot:', e);
  }
}

export interface ContributionResult {
  triggered: boolean;
  winBonus: number;
  state: CommunityJackpotState;
}

export function contributeToJackpot(betAmount: number, username: string = 'Jogador'): ContributionResult {
  const state = getCommunityJackpot();
  const validBet = Math.max(1, betAmount);

  // Growth formula: 6% of the placed bet + dynamic micro-variance to feel active
  const growth = Math.max(2, Math.round(validBet * 0.06 + Math.random() * 4));
  let newPot = state.currentPot + growth;

  let triggered = false;
  let winBonus = 0;

  if (newPot >= state.targetPot) {
    triggered = true;
    winBonus = newPot;

    // Reset pot for next round with slight target variance
    const nextTarget = Math.round(65000 + Math.random() * 25000);
    const nextBase = Math.round(18000 + Math.random() * 7000);

    const updatedState: CommunityJackpotState = {
      currentPot: nextBase,
      targetPot: nextTarget,
      percentage: Math.round((nextBase / nextTarget) * 1000) / 10,
      lastWinner: {
        username,
        amount: winBonus,
        date: 'Agora!'
      }
    };

    saveCommunityJackpot(updatedState);
    return { triggered, winBonus, state: updatedState };
  }

  const updatedState: CommunityJackpotState = {
    ...state,
    currentPot: newPot,
    percentage: Math.min(99.9, Math.round((newPot / state.targetPot) * 1000) / 10)
  };

  saveCommunityJackpot(updatedState);
  return { triggered, winBonus: 0, state: updatedState };
}
