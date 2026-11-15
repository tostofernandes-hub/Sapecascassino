import { PlayerStats } from '../types/casino';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'geral' | 'vitorias' | 'jogos';
  icon: string; // Emoji / Symbol representation
  checkUnlocked: (stats: PlayerStats) => boolean;
  getProgress: (stats: PlayerStats) => { current: number; max: number; label: string };
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_win',
    title: 'Primeira Vitória',
    description: 'Vença sua primeira rodada no cassino social em qualquer modalidade.',
    category: 'geral',
    icon: '🏆',
    checkUnlocked: (stats) => {
      const totalWins = Object.values(stats.gameWins).reduce((sum, w) => sum + w, 0);
      return totalWins >= 1;
    },
    getProgress: (stats) => {
      const totalWins = Object.values(stats.gameWins).reduce((sum, w) => sum + w, 0);
      return { current: Math.min(1, totalWins), max: 1, label: `${Math.min(1, totalWins)}/1 vitória` };
    }
  },
  {
    id: 'big_win',
    title: 'Primeira Grande Vitória',
    description: 'Conquiste um prêmio único de 500 fichas ou mais em uma rodada.',
    category: 'vitorias',
    icon: '✨',
    checkUnlocked: (stats) => stats.biggestWin >= 500,
    getProgress: (stats) => ({
      current: Math.min(500, stats.biggestWin),
      max: 500,
      label: `${Math.min(500, stats.biggestWin).toLocaleString('pt-BR')}/500 fichas`
    })
  },
  {
    id: 'century_player',
    title: '100 Rodadas Jogadas',
    description: 'Jogue um total de 100 rodadas completas no cassino.',
    category: 'geral',
    icon: '🎖️',
    checkUnlocked: (stats) => stats.totalRounds >= 100,
    getProgress: (stats) => ({
      current: Math.min(100, stats.totalRounds),
      max: 100,
      label: `${Math.min(100, stats.totalRounds)}/100 rodadas`
    })
  },
  {
    id: 'super_jackpot',
    title: 'Jackpot Lendário',
    description: 'Obtenha uma vitória espetacular de 2.000 fichas ou mais em uma única mão ou giro.',
    category: 'vitorias',
    icon: '👑',
    checkUnlocked: (stats) => stats.biggestWin >= 2000,
    getProgress: (stats) => ({
      current: Math.min(2000, stats.biggestWin),
      max: 2000,
      label: `${Math.min(2000, stats.biggestWin).toLocaleString('pt-BR')}/2.000 fichas`
    })
  },
  {
    id: 'streak_fire',
    title: 'Sequência de Fogo',
    description: 'Alcance uma sequência de 5 vitórias consecutivas sem derrotas.',
    category: 'vitorias',
    icon: '🔥',
    checkUnlocked: (stats) => stats.longestStreak >= 5,
    getProgress: (stats) => ({
      current: Math.min(5, stats.longestStreak),
      max: 5,
      label: `${Math.min(5, stats.longestStreak)}/5 seguidas`
    })
  },
  {
    id: 'high_roller',
    title: 'Milionário Social',
    description: 'Acumule um saldo recorde de 5.000 fichas no cassino.',
    category: 'geral',
    icon: '🪙',
    checkUnlocked: (stats) => stats.highestBalance >= 5000,
    getProgress: (stats) => ({
      current: Math.min(5000, stats.highestBalance),
      max: 5000,
      label: `${Math.min(5000, stats.highestBalance).toLocaleString('pt-BR')}/5.000 fichas`
    })
  },
  {
    id: 'blackjack_master',
    title: 'Mestre do 21',
    description: 'Vença 5 rodadas na mesa de Blackjack.',
    category: 'jogos',
    icon: '🃏',
    checkUnlocked: (stats) => (stats.gameWins.blackjack || 0) >= 5,
    getProgress: (stats) => ({
      current: Math.min(5, stats.gameWins.blackjack || 0),
      max: 5,
      label: `${Math.min(5, stats.gameWins.blackjack || 0)}/5 vitórias`
    })
  },
  {
    id: 'roulette_lucky',
    title: 'Sorte na Roleta',
    description: 'Acerte e vença 5 apostas na Roleta Americana.',
    category: 'jogos',
    icon: '🎯',
    checkUnlocked: (stats) => (stats.gameWins['roulette-american'] || 0) >= 5,
    getProgress: (stats) => ({
      current: Math.min(5, stats.gameWins['roulette-american'] || 0),
      max: 5,
      label: `${Math.min(5, stats.gameWins['roulette-american'] || 0)}/5 vitórias`
    })
  },
  {
    id: 'poker_shark',
    title: 'Ás do Pôquer',
    description: 'Vença 5 mãos somadas no Texas Hold\'em ou Vídeo Pôquer.',
    category: 'jogos',
    icon: '♠️',
    checkUnlocked: (stats) =>
      ((stats.gameWins['texas-holdem'] || 0) + (stats.gameWins['video-poker'] || 0)) >= 5,
    getProgress: (stats) => {
      const sum = (stats.gameWins['texas-holdem'] || 0) + (stats.gameWins['video-poker'] || 0);
      return { current: Math.min(5, sum), max: 5, label: `${Math.min(5, sum)}/5 vitórias` };
    }
  },
  {
    id: 'slots_tiger',
    title: 'Tigrinho da Fortuna',
    description: 'Consiga 5 rodadas premiadas no Caça-Níquel 3x3.',
    category: 'jogos',
    icon: '🐯',
    checkUnlocked: (stats) => (stats.gameWins.slots || 0) >= 5,
    getProgress: (stats) => ({
      current: Math.min(5, stats.gameWins.slots || 0),
      max: 5,
      label: `${Math.min(5, stats.gameWins.slots || 0)}/5 vitórias`
    })
  },
  {
    id: 'lottery_winner',
    title: 'Bilhete Premiado',
    description: 'Acerte pelo menos uma premiação de quadra, quina ou sena na Loteria Mega.',
    category: 'jogos',
    icon: '🎱',
    checkUnlocked: (stats) => (stats.gameWins.lottery || 0) >= 1,
    getProgress: (stats) => ({
      current: Math.min(1, stats.gameWins.lottery || 0),
      max: 1,
      label: `${Math.min(1, stats.gameWins.lottery || 0)}/1 acerto`
    })
  },
  {
    id: 'daily_streak',
    title: 'Fidelidade Imperial',
    description: 'Resgate o bônus diário mantendo uma sequência de pelo menos 3 dias.',
    category: 'geral',
    icon: '📅',
    checkUnlocked: (stats) => (stats.dailyLoginStreak || 0) >= 3,
    getProgress: (stats) => ({
      current: Math.min(3, stats.dailyLoginStreak || 0),
      max: 3,
      label: `${Math.min(3, stats.dailyLoginStreak || 0)}/3 dias`
    })
  }
];
