import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Trophy, Target, Gift, CheckCircle2, ChevronRight, Award, Sparkles, Flame } from 'lucide-react';
import { MISSIONS, getUserMissionData, claimMissionReward } from '../utils/missions';
import { GameId, UserAccount } from '../types/casino';

interface MissionsViewProps {
  currentUser: UserAccount | null;
  onBackToLobby: () => void;
  onSelectGame: (gameId: GameId) => void;
  onRefreshAccount: () => void;
}

const SEEN_MILESTONES_STORAGE_PREFIX = 'sapecas_seen_mission_badges_v1_';

export const MissionsView: React.FC<MissionsViewProps> = ({
  currentUser,
  onBackToLobby,
  onSelectGame,
  onRefreshAccount
}) => {
  const [filter, setFilter] = useState<'ALL' | 'UNCLAIMED' | 'COMPLETED'>('ALL');
  const [tick, setTick] = useState(0);
  const [poppedKeys, setPoppedKeys] = useState<Set<string>>(() => new Set());
  const popTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const username = currentUser ? currentUser.username : 'Jogador';
  const data = getUserMissionData(username);

  const triggerPopForKeys = (keys: string[]) => {
    if (keys.length === 0) return;
    setPoppedKeys((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
    if (popTimerRef.current) clearTimeout(popTimerRef.current);
    popTimerRef.current = setTimeout(() => {
      setPoppedKeys(new Set());
    }, 1600);
  };

  useEffect(() => {
    const storageKey = `${SEEN_MILESTONES_STORAGE_PREFIX}${username.toLowerCase()}`;
    let seenSet = new Set<string>();
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) seenSet = new Set(parsed);
      }
    } catch {
      seenSet = new Set<string>();
    }

    const currentAchieved: string[] = [];
    MISSIONS.forEach((m) => {
      const counter = data.counters[m.metric] || 0;
      const claimedTier = data.claimedTiers[m.id] ?? -1;
      m.tiers.forEach((t, idx) => {
        if (counter >= t.target || claimedTier >= idx) {
          currentAchieved.push(`${m.id}:tier:${idx}`);
        }
      });
      if (claimedTier >= m.tiers.length - 1) {
        currentAchieved.push(`${m.id}:master`);
      }
    });

    const newlyAchieved = currentAchieved.filter((k) => !seenSet.has(k));
    if (newlyAchieved.length > 0) {
      newlyAchieved.forEach((k) => seenSet.add(k));
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(seenSet)));
      } catch {
        // Ignore storage quota errors
      }
      triggerPopForKeys(newlyAchieved);
    }
  }, [username, tick]);

  useEffect(() => {
    return () => {
      if (popTimerRef.current) clearTimeout(popTimerRef.current);
    };
  }, []);

  const handleClaim = (missionId: string, tierIndex: number) => {
    const res = claimMissionReward(username, missionId, tierIndex);
    if (res.success) {
      const mission = MISSIONS.find((m) => m.id === missionId);
      const keysToPop = [`${missionId}:tier:${tierIndex}`];
      if (mission && tierIndex >= mission.tiers.length - 1) {
        keysToPop.push(`${missionId}:master`);
      }

      const storageKey = `${SEEN_MILESTONES_STORAGE_PREFIX}${username.toLowerCase()}`;
      try {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        const seenSet = new Set<string>(Array.isArray(parsed) ? parsed : []);
        keysToPop.forEach((k) => seenSet.add(k));
        localStorage.setItem(storageKey, JSON.stringify(Array.from(seenSet)));
      } catch {
        // Ignore storage errors
      }

      triggerPopForKeys(keysToPop);
      window.dispatchEvent(new CustomEvent('sapecas_avatar_goal', {
        detail: { reason: 'mission_tier_claimed', missionId, tierIndex }
      }));
      onRefreshAccount();
      setTick((t) => t + 1);
    }
  };

  const tierColors = [
    { name: 'Bronze', bg: 'bg-[#78350f]/30', border: 'border-[#b45309]', text: 'text-amber-500' },
    { name: 'Prata', bg: 'bg-slate-700/30', border: 'border-slate-400', text: 'text-slate-200' },
    { name: 'Ouro', bg: 'bg-amber-500/20', border: 'border-amber-400', text: 'text-amber-300' }
  ];

  // Calculate statistics
  let totalClaimedRewards = 0;
  let readyToClaimCount = 0;
  let completedCount = 0;

  MISSIONS.forEach((m) => {
    const counter = data.counters[m.metric] || 0;
    const claimedTier = data.claimedTiers[m.id] ?? -1;

    m.tiers.forEach((t, idx) => {
      if (claimedTier >= idx) {
        totalClaimedRewards += t.reward;
      }
    });

    if (claimedTier >= m.tiers.length - 1) {
      completedCount++;
    } else {
      const nextTierIdx = Math.max(0, claimedTier + 1);
      if (counter >= m.tiers[nextTierIdx].target) {
        readyToClaimCount++;
      }
    }
  });

  const filteredMissions = MISSIONS.filter((m) => {
    const counter = data.counters[m.metric] || 0;
    const claimedTier = data.claimedTiers[m.id] ?? -1;
    const isCompleted = claimedTier >= m.tiers.length - 1;
    const nextTierIdx = Math.max(0, claimedTier + 1);
    const canClaim = !isCompleted && counter >= m.tiers[nextTierIdx].target;

    if (filter === 'UNCLAIMED') return canClaim;
    if (filter === 'COMPLETED') return isCompleted;
    return true;
  });

  return (
    <div className="space-y-4 max-w-6xl mx-auto animate-fade-in pb-8">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#180705] p-3 rounded-2xl border border-orange-500/30">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-amber-300 transition-colors cursor-pointer w-fit"
        >
          <ArrowLeft className="w-4 h-4 text-orange-400" />
          <span>Voltar ao Salão Principal</span>
        </button>

        <div className="text-center sm:text-left">
          <h1 className="font-cinzel text-lg sm:text-xl font-black text-amber-300 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>CENTRAL DE MISSÕES & DESAFIOS PROGRESSIVOS</span>
          </h1>
          <p className="text-xs text-orange-200/70">
            Cumpra desafios em todos os jogos do cassino social e resgate recompensas em fichas.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 self-center sm:self-auto bg-[#100403] p-1 rounded-xl border border-orange-500/25">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-black shadow'
                : 'text-orange-200 hover:text-white'
            }`}
          >
            Todas ({MISSIONS.length})
          </button>
          <button
            onClick={() => setFilter('UNCLAIMED')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'UNCLAIMED'
                ? 'bg-amber-500 text-slate-950 font-black shadow'
                : 'text-orange-200 hover:text-white'
            }`}
          >
            Prontas ({readyToClaimCount})
          </button>
          <button
            onClick={() => setFilter('COMPLETED')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'COMPLETED'
                ? 'bg-amber-500 text-slate-950 font-black shadow'
                : 'text-orange-200 hover:text-white'
            }`}
          >
            Mestres ({completedCount})
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#1c0805] p-3.5 rounded-2xl border border-orange-500/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-orange-400 block">Fichas Resgatadas</span>
            <span className="font-mono text-xl font-black text-amber-300">
              🪙 +{totalClaimedRewards.toLocaleString('pt-BR')}
            </span>
          </div>
          <Gift className="w-8 h-8 text-amber-400/80" />
        </div>

        <div className="bg-[#1c0805] p-3.5 rounded-2xl border border-orange-500/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-orange-400 block">Prontas para Resgatar</span>
            <span className="font-mono text-xl font-black text-emerald-400">
              {readyToClaimCount} {readyToClaimCount === 1 ? 'Missão' : 'Missões'}
            </span>
          </div>
          <Sparkles className="w-8 h-8 text-emerald-400/80" />
        </div>

        <div className="bg-[#1c0805] p-3.5 rounded-2xl border border-orange-500/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-orange-400 block">Marcos Concluídos (Mestre)</span>
            <span className="font-mono text-xl font-black text-orange-300">
              {completedCount} de {MISSIONS.length}
            </span>
          </div>
          <Award className="w-8 h-8 text-orange-400/80" />
        </div>
      </div>

      {/* Missions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMissions.map((mission) => {
          const counter = data.counters[mission.metric] || 0;
          const claimedTier = data.claimedTiers[mission.id] ?? -1;

          const nextTierIndex = Math.min(mission.tiers.length - 1, Math.max(0, claimedTier + 1));
          const currentTarget = mission.tiers[nextTierIndex].target;
          const isAllClaimed = claimedTier >= mission.tiers.length - 1;
          const canClaimNext = !isAllClaimed && counter >= mission.tiers[nextTierIndex].target;
          const progressPercent = Math.min(100, Math.floor((counter / currentTarget) * 100));

          return (
            <div
              key={mission.id}
              className="bg-[#1c0805] border-2 border-orange-500/35 rounded-2xl p-4 flex flex-col justify-between hover:border-orange-500/70 transition-all shadow-xl group relative overflow-hidden"
            >
              <div>
                {/* Mission Header */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2f100a] to-[#120403] border border-orange-500/40 flex items-center justify-center text-2xl shadow-inner">
                      {mission.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white font-cinzel leading-tight group-hover:text-orange-300 transition-colors">
                        {mission.title}
                      </h3>
                      <span className="text-xs text-orange-400 font-medium">
                        Progresso: <strong className="text-amber-300 font-mono">{counter}</strong> / {currentTarget}
                      </span>
                    </div>
                  </div>

                  {isAllClaimed && (
                    <span
                      key={`${mission.id}-master-${poppedKeys.has(`${mission.id}:master`) ? 'pop' : 'idle'}`}
                      className={`inline-flex items-center gap-1 text-[11px] font-bold text-amber-200 bg-gradient-to-r from-amber-950/90 via-emerald-950/80 to-amber-950/90 border border-amber-400/85 px-2.5 py-0.5 rounded-full shrink-0 ${
                        poppedKeys.has(`${mission.id}:master`) ? 'mission-badge-pop-glow' : 'mission-badge-gold-glow'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" /> Mestre
                    </span>
                  )}
                </div>

                <p className="text-xs text-orange-200/80 mb-3.5 leading-relaxed">
                  {mission.description}
                </p>

                {/* Progress Bar */}
                <div className="w-full bg-[#120403] border border-orange-500/20 rounded-full h-2.5 mb-3.5 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-600 via-amber-500 to-emerald-500 transition-all duration-500 shadow-sm"
                    style={{ width: `${isAllClaimed ? 100 : progressPercent}%` }}
                  />
                </div>

                {/* 3 Tier Markers */}
                <div className="grid grid-cols-3 gap-2 mb-3.5">
                  {mission.tiers.map((tier, idx) => {
                    const isClaimed = claimedTier >= idx;
                    const isUnlocked = counter >= tier.target;
                    const tierStyle = tierColors[idx] || tierColors[0];
                    const tierPopKey = `${mission.id}:tier:${idx}`;
                    const isPopping = poppedKeys.has(tierPopKey);
                    const achievedGlowClass = isPopping ? 'mission-badge-pop-glow' : 'mission-badge-gold-glow';

                    return (
                      <div
                        key={`${idx}-${isPopping ? 'pop' : 'idle'}`}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          isClaimed
                            ? `bg-gradient-to-b from-emerald-950/70 to-[#142009]/80 border-amber-400/80 text-amber-200 ${achievedGlowClass}`
                            : isUnlocked
                            ? `${tierStyle.bg} border-amber-400 ${tierStyle.text} ${achievedGlowClass}`
                            : 'bg-[#150503] border-orange-500/15 text-orange-400/50'
                        }`}
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-0.5">
                          {isClaimed ? '✓ ' : ''}{tierStyle.name}
                        </div>
                        <div className="text-xs font-black font-mono mt-0.5">
                          +{tier.reward.toLocaleString('pt-BR')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2.5 border-t border-orange-500/20 flex items-center justify-between gap-2">
                {canClaimNext ? (
                  <button
                    onClick={() => handleClaim(mission.id, nextTierIndex)}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 hover:brightness-115 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md shadow-amber-600/40 transition-all flex items-center justify-center gap-2 cursor-pointer animate-pulse border border-yellow-200"
                  >
                    <Gift className="w-4 h-4" />
                    <span>Resgatar +{mission.tiers[nextTierIndex].reward.toLocaleString('pt-BR')} Fichas!</span>
                  </button>
                ) : isAllClaimed ? (
                  <div
                    key={`${mission.id}-banner-${poppedKeys.has(`${mission.id}:master`) ? 'pop' : 'idle'}`}
                    className={`w-full text-center py-2 text-xs font-bold text-amber-200 bg-gradient-to-r from-emerald-950/60 via-amber-950/45 to-emerald-950/60 rounded-xl border border-amber-400/80 ${
                      poppedKeys.has(`${mission.id}:master`) ? 'mission-badge-pop-glow' : 'mission-badge-gold-glow'
                    }`}
                  >
                    Todas as Recompensas Coletadas ✦
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (mission.gameId !== 'lobby') {
                        onSelectGame(mission.gameId);
                      }
                    }}
                    className="w-full py-2 px-4 rounded-xl bg-[#250d09] hover:bg-[#32120c] text-orange-300 hover:text-white border border-orange-500/35 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Jogar Esta Modalidade</span>
                    <ChevronRight className="w-4 h-4 text-orange-400" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
