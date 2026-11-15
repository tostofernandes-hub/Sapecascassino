import { Card, Suit, PokerHandResult } from '../types/casino';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let value = 1; value <= 13; value++) {
      deck.push({
        id: `${suit}-${value}-${Math.random().toString(36).substring(2, 7)}`,
        suit,
        value,
        label: LABELS[value - 1]
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getSuitSymbol(suit: Suit): string {
  switch (suit) {
    case 'spades': return '♠';
    case 'hearts': return '♥';
    case 'diamonds': return '♦';
    case 'clubs': return '♣';
  }
}

export function getSuitColor(suit: Suit): string {
  return suit === 'hearts' || suit === 'diamonds' ? 'text-red-500' : 'text-slate-900';
}

/**
 * Calculates Blackjack total, counting Aces as 11 or 1 to get the highest non-busting total.
 */
export function calculateBlackjackScore(cards: Card[]): { score: number; isSoft: boolean; isBust: boolean; isBlackjack: boolean } {
  let score = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.value === 1) {
      aces++;
      score += 11;
    } else if (card.value >= 10) {
      score += 10;
    } else {
      score += card.value;
    }
  }

  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }

  const isBlackjack = cards.length === 2 && score === 21;
  const isBust = score > 21;
  const isSoft = aces > 0 && score <= 21;

  return { score, isSoft, isBust, isBlackjack };
}

/**
 * Calculates Baccarat score: sum of cards modulo 10.
 * Face cards and 10s count as 0, Ace counts as 1.
 */
export function calculateBaccaratScore(cards: Card[]): number {
  let total = 0;
  for (const card of cards) {
    if (card.value >= 10) {
      total += 0;
    } else {
      total += card.value;
    }
  }
  return total % 10;
}

/**
 * Evaluates a 5-card Jacks or Better Video Poker hand.
 */
export function evaluateVideoPokerHand(cards: Card[]): PokerHandResult {
  if (cards.length !== 5) {
    return {
      rank: 'HIGH_CARD',
      name: 'Sem Combinação',
      payoutMultiplier: 0,
      description: 'Nenhum prêmio'
    };
  }

  // Count value frequencies
  const valueCounts: Record<number, number> = {};
  const suitCounts: Record<string, number> = {};
  const values = cards.map(c => c.value).sort((a, b) => a - b);

  for (const card of cards) {
    valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
  }

  const counts = Object.values(valueCounts).sort((a, b) => b - a);
  const isFlush = Object.values(suitCounts).some(c => c === 5);

  // Check straight
  // Check regular straight
  let isStraight = false;
  const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
  if (uniqueValues.length === 5) {
    if (uniqueValues[4] - uniqueValues[0] === 4) {
      isStraight = true;
    }
    // Ace-high straight: 10, J(11), Q(12), K(13), A(1)
    if (
      uniqueValues[0] === 1 &&
      uniqueValues[1] === 10 &&
      uniqueValues[2] === 11 &&
      uniqueValues[3] === 12 &&
      uniqueValues[4] === 13
    ) {
      isStraight = true;
    }
  }

  const isAceHighStraight =
    isStraight &&
    uniqueValues[0] === 1 &&
    uniqueValues[1] === 10 &&
    uniqueValues[2] === 11 &&
    uniqueValues[3] === 12 &&
    uniqueValues[4] === 13;

  // 1. Royal Flush (10, J, Q, K, A same suit) -> 250x
  if (isFlush && isAceHighStraight) {
    return {
      rank: 'ROYAL_FLUSH',
      name: 'Royal Flush',
      payoutMultiplier: 250,
      description: 'A maior mão do pôquer! Paga 250x'
    };
  }

  // 2. Straight Flush (5 consecutive same suit) -> 50x
  if (isFlush && isStraight) {
    return {
      rank: 'STRAIGHT_FLUSH',
      name: 'Straight Flush',
      payoutMultiplier: 50,
      description: 'Sequência do mesmo naipe. Paga 50x'
    };
  }

  // 3. Four of a Kind (Quadra) -> 25x
  if (counts[0] === 4) {
    return {
      rank: 'FOUR_OF_A_KIND',
      name: 'Quadra',
      payoutMultiplier: 25,
      description: 'Quatro cartas de mesmo valor. Paga 25x'
    };
  }

  // 4. Full House (Trinca + Par) -> 9x
  if (counts[0] === 3 && counts[1] === 2) {
    return {
      rank: 'FULL_HOUSE',
      name: 'Full House',
      payoutMultiplier: 9,
      description: 'Uma trinca e um par. Paga 9x'
    };
  }

  // 5. Flush (5 cartas do mesmo naipe) -> 6x
  if (isFlush) {
    return {
      rank: 'FLUSH',
      name: 'Flush (Cor)',
      payoutMultiplier: 6,
      description: 'Cinco cartas do mesmo naipe. Paga 6x'
    };
  }

  // 6. Straight (Sequência) -> 4x
  if (isStraight) {
    return {
      rank: 'STRAIGHT',
      name: 'Sequência (Straight)',
      payoutMultiplier: 4,
      description: 'Cinco cartas em ordem numérica. Paga 4x'
    };
  }

  // 7. Three of a Kind (Trinca) -> 3x
  if (counts[0] === 3) {
    return {
      rank: 'THREE_OF_A_KIND',
      name: 'Trinca',
      payoutMultiplier: 3,
      description: 'Três cartas de mesmo valor. Paga 3x'
    };
  }

  // 8. Two Pair (Dois Pares) -> 2x
  if (counts[0] === 2 && counts[1] === 2) {
    return {
      rank: 'TWO_PAIR',
      name: 'Dois Pares',
      payoutMultiplier: 2,
      description: 'Dois pares distintos. Paga 2x'
    };
  }

  // 9. Jacks or Better (Par de Valetes, Damas, Reis ou Áses) -> 1x
  if (counts[0] === 2) {
    // Find which value is paired
    const pairValue = Number(
      Object.keys(valueCounts).find(k => valueCounts[Number(k)] === 2)
    );
    // Value 1 (Ace), 11 (Jack), 12 (Queen), 13 (King)
    if (pairValue === 1 || pairValue >= 11) {
      return {
        rank: 'JACKS_OR_BETTER',
        name: 'Valetes ou Melhor',
        payoutMultiplier: 1,
        description: 'Par de J, Q, K ou Ás. Devolve aposta (1x)'
      };
    }
  }

  // High Card / No prize
  return {
    rank: 'HIGH_CARD',
    name: 'Sem Prêmio',
    payoutMultiplier: 0,
    description: 'Nenhuma combinação premiada nesta rodada'
  };
}

export const POKER_PAYTABLE = [
  { rank: 'ROYAL_FLUSH', name: 'Royal Flush', multiplier: 250 },
  { rank: 'STRAIGHT_FLUSH', name: 'Straight Flush', multiplier: 50 },
  { rank: 'FOUR_OF_A_KIND', name: 'Quadra', multiplier: 25 },
  { rank: 'FULL_HOUSE', name: 'Full House', multiplier: 9 },
  { rank: 'FLUSH', name: 'Flush', multiplier: 6 },
  { rank: 'STRAIGHT', name: 'Sequência', multiplier: 4 },
  { rank: 'THREE_OF_A_KIND', name: 'Trinca', multiplier: 3 },
  { rank: 'TWO_PAIR', name: 'Dois Pares', multiplier: 2 },
  { rank: 'JACKS_OR_BETTER', name: 'Valetes ou Melhor', multiplier: 1 }
];

export interface DetailedPokerHand {
  tier: number; // 9: Royal, 8: Straight Flush, 7: Four, 6: Full House, 5: Flush, 4: Straight, 3: Three, 2: Two Pair, 1: One Pair, 0: High Card
  name: string;
  kickers: number[];
  bestCards: Card[];
}

function getPokerRank(c: Card): number {
  return c.value === 1 ? 14 : c.value;
}

const RANK_NAMES: Record<number, string> = {
  14: 'Ás',
  13: 'Rei',
  12: 'Dama',
  11: 'Valete',
  10: 'Dez',
  9: 'Nove',
  8: 'Oito',
  7: 'Sete',
  6: 'Seis',
  5: 'Cinco',
  4: 'Quatro',
  3: 'Três',
  2: 'Dois'
};

export function evaluate5CardsDetailed(cards: Card[]): DetailedPokerHand {
  const sorted = [...cards].sort((a, b) => getPokerRank(b) - getPokerRank(a));
  const ranks = sorted.map(getPokerRank);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight
  let isStraight = false;
  let straightHigh = 0;

  if (
    ranks[0] - ranks[1] === 1 &&
    ranks[1] - ranks[2] === 1 &&
    ranks[2] - ranks[3] === 1 &&
    ranks[3] - ranks[4] === 1
  ) {
    isStraight = true;
    straightHigh = ranks[0];
  } else if (
    ranks[0] === 14 &&
    ranks[1] === 5 &&
    ranks[2] === 4 &&
    ranks[3] === 3 &&
    ranks[4] === 2
  ) {
    // 5-high straight (Wheel)
    isStraight = true;
    straightHigh = 5;
  }

  // Count frequencies
  const counts: Record<number, number> = {};
  for (const r of ranks) {
    counts[r] = (counts[r] || 0) + 1;
  }

  const freq = Object.entries(counts)
    .map(([rankStr, count]) => ({ rank: Number(rankStr), count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  // 1. Royal / Straight Flush
  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return { tier: 9, name: 'Royal Flush', kickers: [14], bestCards: sorted };
    }
    return {
      tier: 8,
      name: `Straight Flush (${RANK_NAMES[straightHigh]} Alto)`,
      kickers: [straightHigh],
      bestCards: sorted
    };
  }

  // 2. Four of a kind
  if (freq[0].count === 4) {
    return {
      tier: 7,
      name: `Quadra de ${RANK_NAMES[freq[0].rank]}`,
      kickers: [freq[0].rank, freq[1].rank],
      bestCards: sorted
    };
  }

  // 3. Full house
  if (freq[0].count === 3 && freq[1].count === 2) {
    return {
      tier: 6,
      name: `Full House (${RANK_NAMES[freq[0].rank]} com ${RANK_NAMES[freq[1].rank]})`,
      kickers: [freq[0].rank, freq[1].rank],
      bestCards: sorted
    };
  }

  // 4. Flush
  if (isFlush) {
    return {
      tier: 5,
      name: `Flush (${RANK_NAMES[ranks[0]]} Alto)`,
      kickers: ranks,
      bestCards: sorted
    };
  }

  // 5. Straight
  if (isStraight) {
    return {
      tier: 4,
      name: `Sequência (${RANK_NAMES[straightHigh]} Alto)`,
      kickers: [straightHigh],
      bestCards: sorted
    };
  }

  // 6. Three of a kind
  if (freq[0].count === 3) {
    return {
      tier: 3,
      name: `Trinca de ${RANK_NAMES[freq[0].rank]}`,
      kickers: [freq[0].rank, freq[1].rank, freq[2].rank],
      bestCards: sorted
    };
  }

  // 7. Two Pair
  if (freq[0].count === 2 && freq[1].count === 2) {
    return {
      tier: 2,
      name: `Dois Pares (${RANK_NAMES[freq[0].rank]} e ${RANK_NAMES[freq[1].rank]})`,
      kickers: [freq[0].rank, freq[1].rank, freq[2].rank],
      bestCards: sorted
    };
  }

  // 8. One Pair
  if (freq[0].count === 2) {
    return {
      tier: 1,
      name: `Par de ${RANK_NAMES[freq[0].rank]}`,
      kickers: [freq[0].rank, freq[1].rank, freq[2].rank, freq[3].rank],
      bestCards: sorted
    };
  }

  // 9. High Card
  return {
    tier: 0,
    name: `Carta Alta ${RANK_NAMES[ranks[0]]}`,
    kickers: ranks,
    bestCards: sorted
  };
}

/**
 * Compare two DetailedPokerHand hands: returns 1 if a > b, -1 if b > a, 0 if tie.
 */
export function comparePokerHands(a: DetailedPokerHand, b: DetailedPokerHand): number {
  if (a.tier !== b.tier) {
    return a.tier > b.tier ? 1 : -1;
  }
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const ka = a.kickers[i] || 0;
    const kb = b.kickers[i] || 0;
    if (ka !== kb) {
      return ka > kb ? 1 : -1;
    }
  }
  return 0;
}

/**
 * Evaluates best 5-card combination out of 7 cards (2 hole + 5 community)
 */
export function evaluate7CardHand(sevenCards: Card[]): DetailedPokerHand {
  if (sevenCards.length < 5) {
    return evaluate5CardsDetailed(sevenCards);
  }

  let bestHand: DetailedPokerHand | null = null;
  const n = sevenCards.length;

  // Combinations of 5 from n
  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            const five = [sevenCards[i], sevenCards[j], sevenCards[k], sevenCards[l], sevenCards[m]];
            const current = evaluate5CardsDetailed(five);
            if (!bestHand || comparePokerHands(current, bestHand) > 0) {
              bestHand = current;
            }
          }
        }
      }
    }
  }

  return bestHand!;
}

