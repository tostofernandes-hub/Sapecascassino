export type GameId = 
  | 'lobby'
  | 'records'
  | 'missions'
  | 'blackjack'
  | 'texas-holdem'
  | 'video-poker'
  | 'baccarat'
  | 'slots'
  | 'lottery'
  | 'limbo'
  | 'records'
  // 6 New Classic Casino Games
  | 'craps'
  | 'scratch'
  | 'roulette-american'
  | 'coinflip'
  | 'sicbo'
  // 3 New Games: Miner, Bolinhas na Peneira, Liar's Bar
  | 'miner'
  | 'plinko'
  | 'liars-bar'
  // 2 New Games: Caça-Níquel Clássico & Corrida de Cavalos
  | 'classic-slots'
  | 'horse-race'
  // 2 New Games: Tiro do Sapeca & Ovo do Dragão Sapeca
  | 'archery'
  | 'dragon-egg';

export interface MissionTier {
  target: number;
  reward: number;
  label: string;
}

export type MissionMetric = 
  | 'wins_blackjack'
  | 'wins_slots'
  | 'mines_revealed'
  | 'plinko_drops'
  | 'liars_bluffs'
  | 'total_wins'
  | 'total_rounds';

export interface MissionItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  gameId: GameId;
  metric: MissionMetric;
  tiers: MissionTier[];
}

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export interface Card {
  id: string;
  suit: Suit;
  value: number; // 1 (Ace) to 13 (King)
  label: string; // 'A', '2'-'10', 'J', 'Q', 'K'
}

export interface AccountHistoryItem {
  id: string;
  timestamp: number;
  type: 'BET' | 'WIN' | 'LOSS' | 'DAILY_BONUS' | 'DAILY_WHEEL' | 'REGISTRATION';
  gameId?: GameId | 'daily-wheel' | 'daily-bonus';
  gameName: string;
  amount: number; // positive or negative change
  balanceAfter: number;
  details?: string;
}

export interface UserAccount {
  uid?: string;
  email?: string;
  username: string;
  nickname?: string;
  avatar?: string;
  password?: string;
  balance: number;
  createdAt: number;
  lastLogin: number;
  lastDailyBonus: number; // timestamp of last 10,000 bonus redemption
  lastDailyWheel: number; // timestamp of last daily wheel spin
  totalWins: number;
  totalLosses: number;
  biggestWin: number;
  history: AccountHistoryItem[];
}

export interface PlayerStats {
  chips: number;
  highestBalance: number;
  biggestWin: number;
  currentStreak: number;
  longestStreak: number;
  recordDate: string;
  lastDailyBonusDate: string;
  dailyLoginStreak: number;
  gameWins: Record<string, number>;
  totalRounds: number;
}

export type PokerHandRank =
  | 'ROYAL_FLUSH'
  | 'STRAIGHT_FLUSH'
  | 'FOUR_OF_A_KIND'
  | 'FULL_HOUSE'
  | 'FLUSH'
  | 'STRAIGHT'
  | 'THREE_OF_A_KIND'
  | 'TWO_PAIR'
  | 'JACKS_OR_BETTER'
  | 'HIGH_CARD';

export interface PokerHandResult {
  rank: PokerHandRank;
  name: string;
  payoutMultiplier: number;
  description: string;
}

export interface SlotTheme {
  id: string;
  name: string;
  subtitle: string;
  symbols: {
    icon: string;
    name: string;
    multiplier: number;
    isWild?: boolean;
    isJackpot?: boolean;
  }[];
}
