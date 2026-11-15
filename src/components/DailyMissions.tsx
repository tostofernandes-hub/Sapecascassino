import React, { useState } from 'react';
import { MISSIONS, getUserMissionData, claimMissionReward } from '../utils/missions';
import { GameId } from '../types/casino';
import { Flame, Trophy, Award, CheckCircle2, ChevronRight, Gift } from 'lucide-react';

interface DailyMissionsProps {
  username: string;
  onRefreshAccount: () => void;
  onSelectGame: (gameId: GameId) => void;
}

export const DailyMissions: React.FC<DailyMissionsProps> = ({
  username,
  onRefreshAccount,
  onSelectGame
}) => {
  const [, setTick] = useState(0);
  const data = getUserMissionData(username);

  const handleClaim = (missionId: string, tierIndex: number) => {
    const res = claimMissionReward(username, missionId, tierIndex);
    if (res.success) {
      onRefreshAccount();
      setTick((t) => t + 1);
    }
  };

  const tierColors = [
    { name: 'Bronze', bg: 'bg-[#78350f]/30', border: 'border-[#b45309]', text: 'text-amber-500' },
    { name: 'Prata', bg: 'bg-slate-700/30', border: 'border-slate-400', text: 'text-slate-200' },
    { name: 'Ouro', bg: 'bg-amber-500/20', border: 'border-amber-400', text: 'text-amber-300' }
  ];

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-600/20 border border-orange-500/40 text-[10px] text-orange-300 font-bold uppercase tracking-wider mb-1">
            <Gift className="w-3.5 h-3.5 text-amber-400" />
            <span>Desafios Progressivos & Recompensas</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white font-cinzel flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" /> Missões Diárias & Marcos do Cassino
          </h2>
          <p className="text-xs text-orange-200/70">
            Jogue nos 17 jogos, suba de nível em cada desafio e resgate milhares de fichas grátis na sua conta.
          </p>
        </div>
      </div>

      {/* Grid of Missions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {MISSIONS.map((mission) => {
          const counter = data.counters[mission.metric] || 0;
          const claimedTier = data.claimedTiers[mission.id] ?? -1;

          // Next target to achieve or claim
          const nextTierIndex = Math.min(mission.tiers.length - 1, Math.max(0, claimedTier + 1));
          const currentTarget = mission.tiers[nextTierIndex].target;
          const isAllClaimed = claimedTier >= mission.tiers.length - 1;
          const canClaimNext = !isAllClaimed && counter >= mission.tiers[nextTierIndex].target;
          const progressPercent = Math.min(100, Math.floor((counter / currentTarget) * 100));

          return (
            <div
              key={mission.id}
              className="bg-[#1c0805] border border-orange-500/30 rounded-2xl p-3.5 flex flex-col justify-between hover:border-orange-500/60 transition-all shadow-md group relative overflow-hidden"
            >
              <div>
                {/* Mission Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2a0e08] to-[#120403] border border-orange-500/40 flex items-center justify-center text-lg shadow-inner">
                      {mission.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white font-cinzel leading-tight group-hover:text-orange-300 transition-colors">
                        {mission.title}
                      </h3>
                      <span className="text-[10px] text-orange-400 font-medium">
                        Progresso: <strong className="text-amber-300 font-mono">{counter}</strong> / {currentTarget}
                      </span>
                    </div>
                  </div>

                  {isAllClaimed && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Mestre
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-orange-200/70 mb-3 leading-relaxed">
                  {mission.description}
                </p>

                {/* Progress Bar */}
                <div className="w-full bg-[#120403] border border-orange-500/20 rounded-full h-2 mb-3 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-600 via-amber-500 to-emerald-500 transition-all duration-500 shadow-sm"
                    style={{ width: `${isAllClaimed ? 100 : progressPercent}%` }}
                  />
                </div>

                {/* 3 Tier Markers */}
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {mission.tiers.map((tier, idx) => {
                    const isClaimed = claimedTier >= idx;
                    const isUnlocked = counter >= tier.target;
                    const tierStyle = tierColors[idx] || tierColors[0];

                    return (
                      <div
                        key={idx}
                        className={`p-1.5 rounded-lg border text-center transition-all ${
                          isClaimed
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                            : isUnlocked
                            ? `${tierStyle.bg} ${tierStyle.border} ${tierStyle.text} ring-1 ring-amber-400/50`
                            : 'bg-[#150503] border-orange-500/15 text-orange-400/50'
                        }`}
                      >
                        <div className="text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-0.5">
                          {isClaimed ? '✓ ' : ''}{tierStyle.name}
                        </div>
                        <div className="text-[11px] font-black font-mono mt-0.5">
                          +{tier.reward.toLocaleString('pt-BR')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-orange-500/15 flex items-center justify-between gap-2">
                {canClaimNext ? (
                  <button
                    onClick={() => handleClaim(mission.id, nextTierIndex)}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 hover:brightness-115 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md shadow-amber-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer animate-pulse border border-yellow-200"
                  >
                    <Gift className="w-3.5 h-3.5" />
                    <span>Resgatar +{mission.tiers[nextTierIndex].reward.toLocaleString('pt-BR')} Fichas!</span>
                  </button>
                ) : isAllClaimed ? (
                  <div className="w-full text-center py-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/30 rounded-lg border border-emerald-500/20">
                    Todas as Recompensas Coletadas ✦
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (mission.gameId !== 'lobby') {
                        onSelectGame(mission.gameId);
                      }
                    }}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#250d09] hover:bg-[#32120c] text-orange-300 hover:text-white border border-orange-500/30 text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Jogar Agora</span>
                    <ChevronRight className="w-3.5 h-3.5 text-orange-400" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
