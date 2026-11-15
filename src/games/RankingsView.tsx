import React, { useState } from 'react';
import { ArrowLeft, Trophy, History, Users, Activity, Sparkles, ShieldCheck } from 'lucide-react';
import { UserAccount } from '../types/casino';
import { getStoredAccounts, getRealCommunityFeed } from '../utils/auth';

interface RankingsViewProps {
  currentUser: UserAccount | null;
  onBackToLobby: () => void;
}

export const RankingsView: React.FC<RankingsViewProps> = ({
  currentUser,
  onBackToLobby
}) => {
  const [activeTab, setActiveTab] = useState<'LEADERBOARD' | 'COMMUNITY' | 'HISTORY'>('LEADERBOARD');
  const [sortBy, setSortBy] = useState<'BALANCE' | 'WINS'>('BALANCE');

  const accounts = getStoredAccounts();
  const communityFeed = getRealCommunityFeed();

  // Sort players
  const sortedPlayers = [...accounts].sort((a, b) => {
    if (sortBy === 'BALANCE') {
      return b.balance - a.balance;
    }
    return b.totalWins - a.totalWins;
  });

  return (
    <div className="space-y-2 max-w-5xl mx-auto animate-fade-in pb-2">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Lobby</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex items-center p-0.5 rounded-lg bg-[#180705] border border-orange-500/30">
            <button
              onClick={() => setActiveTab('LEADERBOARD')}
              className={`px-3 py-1 rounded text-xs font-cinzel font-bold transition-all cursor-pointer ${
                activeTab === 'LEADERBOARD'
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-orange-200 hover:text-white'
              }`}
            >
              Ranking Real
            </button>
            <button
              onClick={() => setActiveTab('COMMUNITY')}
              className={`px-3 py-1 rounded text-xs font-cinzel font-bold transition-all cursor-pointer ${
                activeTab === 'COMMUNITY'
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-orange-200 hover:text-white'
              }`}
            >
              Apostas da Comunidade
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3 py-1 rounded text-xs font-cinzel font-bold transition-all cursor-pointer ${
                activeTab === 'HISTORY'
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-orange-200 hover:text-white'
              }`}
            >
              Meu Histórico
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'LEADERBOARD' ? (
        <div className="space-y-2">
          {/* Notice about real users */}
          <div className="flex items-center justify-between bg-[#1f0906] border border-orange-500/20 px-3 py-1.5 rounded-xl text-[11px] text-orange-200">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Rankings oficiais 100% de <strong>usuários reais cadastrados</strong> (zero bots ou nomes fictícios).</span>
            </div>
            <span className="text-orange-400 font-mono text-[10px]">
              {accounts.length} {accounts.length === 1 ? 'jogador cadastrado' : 'jogadores cadastrados'}
            </span>
          </div>

          {/* Sort Controls */}
          <div className="bg-[#180705] border border-orange-500/30 rounded-xl p-2.5 flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="font-cinzel text-xs sm:text-sm font-bold text-amber-300 uppercase tracking-wider">
                Quadro de Honra · Top Jogadores
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-orange-300/70 hidden sm:inline">Ordenar por:</span>
              <button
                onClick={() => setSortBy('BALANCE')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  sortBy === 'BALANCE'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-[#270e0a] text-orange-200 border border-orange-500/20 hover:bg-[#34130d]'
                }`}
              >
                Maior Saldo 🪙
              </button>
              <button
                onClick={() => setSortBy('WINS')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  sortBy === 'WINS'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-[#270e0a] text-orange-200 border border-orange-500/20 hover:bg-[#34130d]'
                }`}
              >
                Mais Vitórias 🏆
              </button>
            </div>
          </div>

          {/* Players Table */}
          <div className="bg-[#140503] border border-orange-500/30 rounded-xl overflow-hidden shadow-2xl">
            {sortedPlayers.length === 0 ? (
              <div className="py-12 text-center text-xs text-orange-300/70">
                Nenhum jogador cadastrado encontrado. Crie uma conta para ser o #1!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#240a06] text-amber-400 font-cinzel font-bold text-[11px] uppercase tracking-wider border-b border-orange-500/30">
                    <tr>
                      <th className="py-2.5 px-3 text-center">Pos</th>
                      <th className="py-2.5 px-3">Jogador Real</th>
                      <th className="py-2.5 px-3 text-right">Saldo de Fichas</th>
                      <th className="py-2.5 px-3 text-center">Vitórias / Derrotas</th>
                      <th className="py-2.5 px-3 text-right">Maior Vitória</th>
                      <th className="py-2.5 px-3 text-right hidden sm:table-cell">Último Acesso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-500/15">
                    {sortedPlayers.map((player, idx) => {
                      const isMe = currentUser?.username.toLowerCase() === player.username.toLowerCase();
                      const rank = idx + 1;

                      return (
                        <tr
                          key={player.username}
                          className={`transition-colors ${
                            isMe
                              ? 'bg-amber-500/15 font-semibold text-amber-200'
                              : rank === 1
                              ? 'bg-amber-500/5 hover:bg-amber-500/10'
                              : 'hover:bg-white/5'
                          }`}
                        >
                          {/* Position */}
                          <td className="py-2.5 px-3 text-center">
                            {rank === 1 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-yellow-300 to-amber-500 text-slate-950 font-black shadow">
                                🥇
                              </span>
                            ) : rank === 2 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-950 font-black shadow">
                                🥈
                              </span>
                            ) : rank === 3 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white font-black shadow">
                                🥉
                              </span>
                            ) : (
                              <span className="font-mono text-orange-300/70 font-bold">#{rank}</span>
                            )}
                          </td>

                          {/* Username */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-[10px] font-black text-white shadow">
                                {player.username.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-bold text-orange-100">
                                {player.username} {isMe && <span className="text-[10px] text-amber-400 font-normal">(Você)</span>}
                              </span>
                            </div>
                          </td>

                          {/* Chips Balance */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1 font-mono font-black text-amber-300 text-sm sm:text-base tabular-nums">
                              <span>🪙</span>
                              <span>{player.balance.toLocaleString('pt-BR')}</span>
                            </div>
                          </td>

                          {/* Wins / Losses */}
                          <td className="py-2.5 px-3 text-center font-mono">
                            <span className="text-emerald-400 font-bold">{player.totalWins}V</span>
                            <span className="text-orange-400/60 mx-1">/</span>
                            <span className="text-red-400">{player.totalLosses}D</span>
                          </td>

                          {/* Biggest Win */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                            +{player.biggestWin.toLocaleString('pt-BR')}
                          </td>

                          {/* Last Login */}
                          <td className="py-2.5 px-3 text-right text-orange-300/60 text-[10px] font-mono hidden sm:table-cell">
                            {new Date(player.lastLogin).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'COMMUNITY' ? (
        /* Community Feed Tab */
        <div className="bg-[#140503] border border-orange-500/30 rounded-xl p-3 shadow-2xl space-y-2">
          <div className="flex items-center justify-between border-b border-orange-500/20 pb-2">
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-amber-400" />
              <span className="font-cinzel text-xs sm:text-sm font-bold text-amber-300 uppercase tracking-wider">
                Atividade Recente da Comunidade (Pessoas Reais)
              </span>
            </div>
            <span className="text-xs text-orange-300/70">
              {communityFeed.length} ações recentes
            </span>
          </div>

          {communityFeed.length === 0 ? (
            <div className="py-8 text-center text-xs text-orange-300/60">
              Nenhuma aposta recente encontrada. Jogue para ver sua atividade aqui!
            </div>
          ) : (
            <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1">
              {communityFeed.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-[#200805] border border-orange-500/15 text-xs hover:bg-[#280c08] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-xs ${
                        item.isWin
                          ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40'
                          : 'bg-red-600/30 text-red-400 border border-red-500/40'
                      }`}
                    >
                      {item.isWin ? '↑' : '↓'}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-amber-300 font-bold">{item.username}</strong>
                        <span className="text-orange-400/60">em</span>
                        <span className="text-orange-200">{item.gameName}</span>
                      </div>
                      {item.details && <div className="text-[10px] text-orange-300/60">{item.details}</div>}
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div
                      className={`font-black text-xs sm:text-sm ${
                        item.isWin ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {item.isWin ? `+${item.amount.toLocaleString('pt-BR')}` : `-${item.amount.toLocaleString('pt-BR')}`}
                    </div>
                    <div className="text-[9px] text-orange-300/50">
                      {new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Action History Tab */
        <div className="bg-[#140503] border border-orange-500/30 rounded-xl p-3 shadow-2xl space-y-2">
          <div className="flex items-center justify-between border-b border-orange-500/20 pb-2">
            <div className="flex items-center gap-1.5">
              <History className="w-4 h-4 text-amber-400" />
              <span className="font-cinzel text-xs sm:text-sm font-bold text-amber-300 uppercase tracking-wider">
                Histórico de Ações de {currentUser?.username}
              </span>
            </div>
            <span className="text-xs text-orange-300/70">
              Total de registros: {currentUser?.history.length || 0}
            </span>
          </div>

          {!currentUser?.history || currentUser.history.length === 0 ? (
            <div className="py-8 text-center text-xs text-orange-300/60">
              Nenhuma ação registrada ainda. Jogue nos jogos do cassino para gerar histórico!
            </div>
          ) : (
            <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1">
              {currentUser.history.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-[#200805] border border-orange-500/15 text-xs hover:bg-[#280c08] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-xs ${
                        act.type === 'WIN' || act.type === 'DAILY_BONUS' || act.type === 'DAILY_WHEEL' || act.type === 'REGISTRATION'
                          ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40'
                          : 'bg-red-600/30 text-red-400 border border-red-500/40'
                      }`}
                    >
                      {act.type === 'WIN' ? '↑' : act.type === 'LOSS' ? '↓' : '★'}
                    </span>
                    <div>
                      <div className="font-bold text-orange-100">{act.gameName}</div>
                      {act.details && <div className="text-[10px] text-orange-300/60">{act.details}</div>}
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div
                      className={`font-black text-xs sm:text-sm ${
                        act.amount >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {act.amount >= 0 ? `+${act.amount.toLocaleString('pt-BR')}` : act.amount.toLocaleString('pt-BR')}
                    </div>
                    <div className="text-[9px] text-orange-300/50">
                      Saldo: {act.balanceAfter.toLocaleString('pt-BR')} fichas
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
