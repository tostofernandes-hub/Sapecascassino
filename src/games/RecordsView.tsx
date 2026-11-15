import React, { useState } from 'react';
import { PlayerStats } from '../types/casino';
import { soundManager } from '../utils/audio';
import {
  ArrowLeft,
  Trophy,
  Flame,
  Coins,
  RotateCcw,
  Award,
  CheckCircle,
  AlertTriangle,
  Lock,
  Sparkles,
  Crown,
  Medal,
  Star
} from 'lucide-react';
import { ACHIEVEMENTS, Achievement } from '../utils/achievements';

interface RecordsViewProps {
  stats: PlayerStats;
  onResetRecords: () => void;
  onBackToLobby: () => void;
}

const GAME_NAMES: Record<string, string> = {
  blackjack: 'Blackjack (21)',
  'roulette-american': 'Roleta Americana (0 & 00)',
  'texas-holdem': "Pôquer Texas Hold'em",
  'video-poker': 'Vídeo Pôquer',
  baccarat: 'Bacarate',
  slots: 'Caça-Níquel Fortune',
  lottery: 'Loteria Mega',
  limbo: 'Aviãozinho Sapeca (Crash)'
};

export const RecordsView: React.FC<RecordsViewProps> = ({
  stats,
  onResetRecords,
  onBackToLobby
}) => {
  const [showConfirmReset, setShowConfirmReset] = useState<boolean>(false);
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  // Sort games by wins descending
  const sortedGames = Object.entries(stats.gameWins).sort(([, a], [, b]) => b - a);
  const totalWins = Object.values(stats.gameWins).reduce((sum, w) => sum + w, 0);

  // Compute achievements status
  const achievementsWithStatus = ACHIEVEMENTS.map((ach) => {
    const isUnlocked = ach.checkUnlocked(stats);
    const progress = ach.getProgress(stats);
    return {
      ...ach,
      isUnlocked,
      progress
    };
  });

  const unlockedCount = achievementsWithStatus.filter((a) => a.isUnlocked).length;
  const totalAchievements = achievementsWithStatus.length;
  const completionPercentage = Math.round((unlockedCount / totalAchievements) * 100);

  const filteredAchievements = achievementsWithStatus.filter((a) => {
    if (badgeFilter === 'unlocked') return a.isUnlocked;
    if (badgeFilter === 'locked') return !a.isUnlocked;
    return true;
  });

  const handleConfirmReset = () => {
    soundManager.playClick();
    onResetRecords();
    setShowConfirmReset(false);
  };

  // Top 10 High Rollers Leaderboard based on chip balance
  interface LeaderboardPlayer {
    id: string;
    name: string;
    title: string;
    chips: number;
    avatar: string;
    isUser?: boolean;
  }

  const BASE_PLAYERS: LeaderboardPlayer[] = [
    { id: 'p1', name: 'Lucas_Vegas', title: 'Grande Imperador', chips: 125000, avatar: '👑' },
    { id: 'p2', name: 'Elena_Diamond', title: 'Rainha do Bacará', chips: 98400, avatar: '💎' },
    { id: 'p3', name: 'DragonMaster_SP', title: 'Lorde do 21', chips: 84200, avatar: '🐲' },
    { id: 'p4', name: 'Rodrigo_HighRoller', title: 'Mestre da Roleta', chips: 62000, avatar: '🔥' },
    { id: 'p5', name: 'Marina_Gold', title: 'Tigrinho VIP', chips: 48500, avatar: '🐯' },
    { id: 'p6', name: 'Katia_Roll', title: 'Ás de Ouro', chips: 35000, avatar: '✨' },
    { id: 'p7', name: 'Bruno_Ace', title: 'High Roller VIP', chips: 27800, avatar: '♠' },
    { id: 'p8', name: 'Dan_Poker', title: 'Lenda do Hold\'em', chips: 21000, avatar: '🎯' },
    { id: 'p9', name: 'Ana_777', title: 'Mestre da Fortuna', chips: 16500, avatar: '🍀' },
    { id: 'p10', name: 'Felipe_Lotto', title: 'Caçador de Jackpots', chips: 12000, avatar: '🎱' },
  ];

  const userRecordChips = Math.max(stats.chips, stats.highestBalance);
  const userPlayer: LeaderboardPlayer = {
    id: 'user',
    name: 'Você (Imperador)',
    title: userRecordChips >= 50000 ? 'Grande Imperador VIP' : userRecordChips >= 10000 ? 'High Roller Ouro' : 'Membro VIP Nível 5',
    chips: userRecordChips,
    avatar: '⭐',
    isUser: true,
  };

  const allLeaderboard: LeaderboardPlayer[] = [...BASE_PLAYERS, userPlayer]
    .sort((a, b) => b.chips - a.chips)
    .slice(0, 10);

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fade-in pb-12">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Lobby</span>
        </button>

        <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">
          Estatísticas & Conquistas
        </span>
      </div>

      {/* Main Title Section */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-2">
          <Trophy className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-white font-cinzel">
          Placar de Recordes Imperial
        </h1>
        <p className="text-sm text-slate-400">
          Seu histórico de desempenho, insígnias conquistadas e jogos mais lucrativos.
        </p>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Maior Saldo */}
        <div className="bg-[#180705] border border-orange-500/30 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-orange-200/80 font-medium">Maior Saldo Alcançado</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-amber-300 tabular-nums">
            🪙 {stats.highestBalance.toLocaleString('pt-BR')}
          </div>
          <span className="text-[11px] text-orange-300/60 mt-2">
            Recorde em: {stats.recordDate || 'Hoje'}
          </span>
        </div>

        {/* Maior Vitória */}
        <div className="bg-[#180705] border border-orange-500/30 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-orange-200/80 font-medium">Maior Vitória Única</span>
            <Award className="w-4 h-4 text-orange-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">
            +{stats.biggestWin.toLocaleString('pt-BR')}
          </div>
          <span className="text-[11px] text-orange-300/60 mt-2">
            Em uma única rodada
          </span>
        </div>

        {/* Sequência de Vitórias */}
        <div className="bg-[#180705] border border-orange-500/30 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-orange-200/80 font-medium">Maior Sequência</span>
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <div className="font-mono text-2xl font-bold text-orange-300 tabular-nums">
            {stats.longestStreak} vitórias
          </div>
          <span className="text-[11px] text-slate-500 mt-2">
            Atual: {stats.currentStreak} consecutivas
          </span>
        </div>

        {/* Total Rodadas & Vitórias */}
        <div className="bg-[#0d1612] border border-blue-500/30 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400 font-medium">Total de Rodadas</span>
            <CheckCircle className="w-4 h-4 text-blue-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-blue-300 tabular-nums">
            {stats.totalRounds}
          </div>
          <span className="text-[11px] text-slate-500 mt-2">
            {totalWins} vitórias registradas
          </span>
        </div>
      </div>

      {/* SECTION: LEADERBOARD DOS TOP 10 HIGH ROLLERS (COM EFEITOS DOURADOS) */}
      <div className="relative rounded-3xl border-2 border-amber-400/70 bg-gradient-to-b from-[#2a1308] via-[#1a0b06] to-[#120503] p-5 sm:p-7 shadow-[0_0_40px_rgba(251,191,36,0.25)] overflow-hidden space-y-6">
        {/* Golden ambient background lighting */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-36 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/30 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-[11px] font-black uppercase tracking-widest text-amber-300 mb-1.5 shadow-sm">
              <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Hall da Fama Imperial</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white font-cinzel flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
              <span className="text-gold-gradient">Top 10 High Rollers</span>
            </h2>
            <p className="text-xs text-orange-200/80 mt-0.5">
              Os maiores saldos em fichas virtuais registrados na história do Cassino Social.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#260e0a] border border-amber-400/40 px-3.5 py-1.5 rounded-xl shadow-inner">
            <span className="text-sm">🪙</span>
            <div className="text-right">
              <span className="text-[9px] uppercase tracking-wider text-amber-400/80 font-bold block leading-none">Seu Recorde</span>
              <span className="font-mono text-sm font-black text-amber-300 tabular-nums">
                {userRecordChips.toLocaleString('pt-BR')} Fichas
              </span>
            </div>
          </div>
        </div>

        {/* Top 3 Podium Cards */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
          {/* 2nd Place */}
          {allLeaderboard[1] && (
            <div className={`order-2 sm:order-1 rounded-2xl p-4 border transition-all text-center flex flex-col justify-between ${
              allLeaderboard[1].isUser
                ? 'border-2 border-amber-400 ring-2 ring-amber-400/40 bg-gradient-to-b from-[#3a1b0c] to-[#1c0a05] shadow-lg'
                : 'border-slate-400/40 bg-gradient-to-b from-[#201511] to-[#140a06]'
            }`}>
              <div>
                <div className="w-10 h-10 rounded-full mx-auto bg-slate-300/20 border border-slate-300 flex items-center justify-center text-lg font-black text-slate-200 shadow-sm mb-2">
                  🥈
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">2º Lugar · Prata</span>
                <h4 className="text-base font-black text-white font-cinzel mt-0.5 truncate">
                  {allLeaderboard[1].name}
                </h4>
                <span className="text-[10px] text-orange-300/70 block">{allLeaderboard[1].title}</span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-700/60 font-mono text-base font-black text-amber-300">
                🪙 {allLeaderboard[1].chips.toLocaleString('pt-BR')}
              </div>
            </div>
          )}

          {/* 1st Place - Golden Champion Centerpiece */}
          {allLeaderboard[0] && (
            <div className={`order-1 sm:order-2 rounded-2xl p-5 border-2 border-amber-400 bg-gradient-to-b from-[#422009] via-[#2d1506] to-[#180a04] shadow-[0_0_35px_rgba(251,191,36,0.35)] text-center flex flex-col justify-between sm:-translate-y-2 relative ${
              allLeaderboard[0].isUser ? 'ring-4 ring-amber-400/50' : ''
            }`}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-cinzel font-black text-[10px] px-3 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                ★ CAMPEÃO ★
              </div>
              <div>
                <div className="w-12 h-12 rounded-full mx-auto bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-yellow-200 flex items-center justify-center text-xl font-black text-slate-950 shadow-lg shadow-amber-500/40 mb-2 mt-1">
                  👑
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-300 block">1º Lugar · Ouro</span>
                <h4 className="text-lg font-black text-white font-cinzel mt-0.5 truncate">
                  {allLeaderboard[0].name}
                </h4>
                <span className="text-[11px] text-amber-200/90 font-bold block">{allLeaderboard[0].title}</span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-amber-400/30 font-mono text-xl font-black text-yellow-300 drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)]">
                🪙 {allLeaderboard[0].chips.toLocaleString('pt-BR')}
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {allLeaderboard[2] && (
            <div className={`order-3 rounded-2xl p-4 border transition-all text-center flex flex-col justify-between ${
              allLeaderboard[2].isUser
                ? 'border-2 border-amber-400 ring-2 ring-amber-400/40 bg-gradient-to-b from-[#3a1b0c] to-[#1c0a05] shadow-lg'
                : 'border-amber-700/50 bg-gradient-to-b from-[#24130a] to-[#140a06]'
            }`}>
              <div>
                <div className="w-10 h-10 rounded-full mx-auto bg-amber-800/30 border border-amber-700 flex items-center justify-center text-lg font-black text-amber-400 shadow-sm mb-2">
                  🥉
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">3º Lugar · Bronze</span>
                <h4 className="text-base font-black text-white font-cinzel mt-0.5 truncate">
                  {allLeaderboard[2].name}
                </h4>
                <span className="text-[10px] text-orange-300/70 block">{allLeaderboard[2].title}</span>
              </div>
              <div className="mt-3 pt-2 border-t border-amber-900/60 font-mono text-base font-black text-amber-300">
                🪙 {allLeaderboard[2].chips.toLocaleString('pt-BR')}
              </div>
            </div>
          )}
        </div>

        {/* Ranks 4 to 10 Golden List */}
        <div className="relative z-10 bg-[#160704] rounded-2xl border border-amber-500/25 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#240e08] text-amber-400 uppercase tracking-wider text-[10px] font-bold border-b border-amber-500/25">
              <tr>
                <th className="py-2.5 px-4 w-14 text-center">Posição</th>
                <th className="py-2.5 px-4">Jogador</th>
                <th className="py-2.5 px-4 hidden sm:table-cell">Título VIP</th>
                <th className="py-2.5 px-4 text-right">Saldo de Fichas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-950/30 font-mono">
              {allLeaderboard.slice(3).map((player, idx) => {
                const rankNum = idx + 4;
                return (
                  <tr
                    key={player.id}
                    className={`transition-colors ${
                      player.isUser
                        ? 'bg-gradient-to-r from-orange-600/30 via-amber-500/20 to-transparent font-bold text-white border-l-4 border-l-amber-400'
                        : 'hover:bg-amber-950/15 text-orange-200/90'
                    }`}
                  >
                    <td className="py-2.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#260e0a] border border-amber-500/30 font-bold text-[11px] text-amber-400">
                        #{rankNum}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-sans font-bold flex items-center gap-2">
                      <span className="text-base">{player.avatar}</span>
                      <span className={player.isUser ? 'text-amber-300 font-black' : 'text-white'}>
                        {player.name}
                      </span>
                      {player.isUser && (
                        <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase">
                          VOCÊ
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-orange-300/70 text-[11px] hidden sm:table-cell">
                      {player.title}
                    </td>
                    <td className="py-2.5 px-4 text-right font-black text-amber-300">
                      🪙 {player.chips.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION: SISTEMA DE CONQUISTAS (BADGES) */}
      <div className="bg-[#180705] border border-orange-500/30 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white font-cinzel">
                Insígnias & Conquistas (Badges)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Desbloqueie medalhas alcançando metas de rodadas, grandes vitórias e maestria nos jogos.
            </p>
          </div>

          {/* Completion Status Pill */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-900/90 border border-amber-500/30 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-mono font-bold text-amber-300">
                {unlockedCount} / {totalAchievements} ({completionPercentage}%)
              </span>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBadgeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              badgeFilter === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Todas ({totalAchievements})
          </button>
          <button
            type="button"
            onClick={() => setBadgeFilter('unlocked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              badgeFilter === 'unlocked'
                ? 'bg-emerald-600 text-white font-bold shadow'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Desbloqueadas ({unlockedCount})
          </button>
          <button
            type="button"
            onClick={() => setBadgeFilter('locked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              badgeFilter === 'locked'
                ? 'bg-slate-700 text-white font-bold shadow'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            A Conquistar ({totalAchievements - unlockedCount})
          </button>
        </div>

        {/* Grid of Badges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          {filteredAchievements.map((badge) => {
            const progressPercent = Math.min(
              100,
              Math.round((badge.progress.current / badge.progress.max) * 100)
            );
            return (
              <div
                key={badge.id}
                className={`relative rounded-xl border p-4 transition-all flex flex-col justify-between ${
                  badge.isUnlocked
                    ? 'bg-gradient-to-br from-[#122319] to-[#0c1811] border-amber-500/50 shadow-md ring-1 ring-amber-400/30'
                    : 'bg-slate-900/60 border-slate-800/80 opacity-75'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Badge Medal Icon */}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-lg border transition-transform ${
                      badge.isUnlocked
                        ? 'bg-gradient-to-br from-amber-400 to-amber-700 border-amber-300 text-slate-950 scale-105 shadow-amber-500/20'
                        : 'bg-slate-800 border-slate-700 text-slate-500 grayscale'
                    }`}
                  >
                    <span>{badge.icon}</span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        className={`text-sm font-bold truncate ${
                          badge.isUnlocked ? 'text-amber-300 font-cinzel' : 'text-slate-300'
                        }`}
                      >
                        {badge.title}
                      </h3>

                      {badge.isUnlocked ? (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 uppercase tracking-wider">
                          <CheckCircle className="w-3 h-3" />
                          Desbloqueada
                        </span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 uppercase tracking-wider">
                          <Lock className="w-3 h-3" />
                          Bloqueada
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 mt-1 leading-snug">
                      {badge.description}
                    </p>
                  </div>
                </div>

                {/* Progress bar and label */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-800/60">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-500 font-medium">Progresso:</span>
                    <span
                      className={`font-mono font-bold ${
                        badge.isUnlocked ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    >
                      {badge.progress.label}
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        badge.isUnlocked
                          ? 'bg-gradient-to-r from-amber-500 to-emerald-400'
                          : 'bg-slate-600'
                      }`}
                      style={{ width: `${Math.max(badge.isUnlocked ? 100 : 2, progressPercent)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ranking dos Jogos com mais Vitórias */}
      <div className="bg-[#09150f] border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-white font-cinzel flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          Ranking de Vitórias por Jogo
        </h2>

        <div className="space-y-3 pt-2">
          {sortedGames.map(([gameKey, wins], idx) => {
            const percentage = totalWins > 0 ? Math.round((wins / totalWins) * 100) : 0;
            return (
              <div
                key={gameKey}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      idx === 0
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : idx === 1
                        ? 'bg-slate-300 text-slate-950'
                        : idx === 2
                        ? 'bg-amber-800 text-amber-100'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div>
                    <span className="font-semibold text-sm text-white block">
                      {GAME_NAMES[gameKey] || gameKey}
                    </span>
                    <span className="text-xs text-slate-400">
                      {percentage}% de todas as vitórias
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Progress bar */}
                  <div className="w-28 sm:w-40 bg-slate-800 rounded-full h-2.5 overflow-hidden hidden sm:block">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, percentage)}%` }}
                    />
                  </div>

                  <span className="font-mono text-sm font-bold text-amber-300 tabular-nums">
                    {wins} {wins === 1 ? 'vitória' : 'vitórias'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reset Confirmation Button & Modal */}
      <div className="pt-4 flex justify-end">
        <button
          type="button"
          onClick={() => setShowConfirmReset(true)}
          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Resetar Todos os Recordes</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121c16] border border-red-500/40 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="font-cinzel text-lg font-bold text-white">
              Resetar Recordes?
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              Tem certeza que deseja zerar seu maior saldo, maiores vitórias e histórico de jogos? Esta ação não pode ser desfeita.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmReset(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors"
              >
                Sim, Resetar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
