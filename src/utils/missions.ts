import { MissionItem, MissionMetric, UserAccount } from '../types/casino';
import { getStoredAccounts, saveStoredAccounts } from './auth';
import { soundManager } from './audio';

export const MISSIONS: MissionItem[] = [
  {
    id: 'mission_blackjack',
    title: 'Mestre do 21',
    description: 'Vença rodadas estratégicas na mesa clássica de Blackjack.',
    icon: '🃏',
    gameId: 'blackjack',
    metric: 'wins_blackjack',
    tiers: [
      { target: 3, reward: 1000, label: '3 Vitórias' },
      { target: 10, reward: 3500, label: '10 Vitórias' },
      { target: 25, reward: 10000, label: '25 Vitórias' },
    ]
  },
  {
    id: 'mission_miner',
    title: 'Garimpeiro de Diamantes',
    description: 'Encontre diamantes brilhantes no Campo Minado Imperial sem tocar nas bombas.',
    icon: '💎',
    gameId: 'miner',
    metric: 'mines_revealed',
    tiers: [
      { target: 10, reward: 1000, label: '10 Diamantes' },
      { target: 40, reward: 4000, label: '40 Diamantes' },
      { target: 120, reward: 12000, label: '120 Diamantes' },
    ]
  },
  {
    id: 'mission_plinko',
    title: 'Chuva de Bolinhas Sapecas',
    description: 'Solte bolinhas em Bolinhas Sapecas e acerte caixas multiplicadoras.',
    icon: '⚪',
    gameId: 'plinko',
    metric: 'plinko_drops',
    tiers: [
      { target: 15, reward: 1000, label: '15 Bolinhas' },
      { target: 50, reward: 3500, label: '50 Bolinhas' },
      { target: 150, reward: 10000, label: '150 Bolinhas' },
    ]
  },
  {
    id: 'mission_liars',
    title: 'Rei do Blefe',
    description: 'Engane seus oponentes ou desmascare mentiras na mesa do Liar\'s Bar.',
    icon: '😈',
    gameId: 'liars-bar',
    metric: 'liars_bluffs',
    tiers: [
      { target: 3, reward: 1500, label: '3 Blefes / Desafios' },
      { target: 10, reward: 5000, label: '10 Blefes / Desafios' },
      { target: 25, reward: 15000, label: '25 Blefes / Desafios' },
    ]
  },
  {
    id: 'mission_slots',
    title: 'Fúria do Tigre & Dragão',
    description: 'Consiga giros vencedores com linhas alinhadas nos caça-níqueis 3x3.',
    icon: '🐉',
    gameId: 'slots',
    metric: 'wins_slots',
    tiers: [
      { target: 5, reward: 1000, label: '5 Giros Vencedores' },
      { target: 20, reward: 4000, label: '20 Giros Vencedores' },
      { target: 50, reward: 12000, label: '50 Giros Vencedores' },
    ]
  },
  {
    id: 'mission_rounds',
    title: 'Veterano Imperial',
    description: 'Participe de rodadas completas em qualquer jogo do cassino social.',
    icon: '🎖️',
    gameId: 'lobby',
    metric: 'total_rounds',
    tiers: [
      { target: 20, reward: 1500, label: '20 Rodadas' },
      { target: 80, reward: 6000, label: '80 Rodadas' },
      { target: 250, reward: 20000, label: '250 Rodadas' },
    ]
  }
];

const MISSIONS_KEY = 'sapecas_user_missions_v1';

interface UserMissionData {
  counters: Record<string, number>;
  claimedTiers: Record<string, number>; // missionId -> highest claimed tier index (e.g. 0, 1, 2)
}

function getMissionsStore(): Record<string, UserMissionData> {
  try {
    const raw = localStorage.getItem(MISSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMissionsStore(data: Record<string, UserMissionData>): void {
  try {
    localStorage.setItem(MISSIONS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save missions store', e);
  }
}

export function getUserMissionData(username: string): UserMissionData {
  const store = getMissionsStore();
  const lower = username.toLowerCase();
  if (!store[lower]) {
    store[lower] = {
      counters: {},
      claimedTiers: {}
    };
    saveMissionsStore(store);
  }
  return store[lower];
}

export function incrementMissionCounter(username: string, metric: MissionMetric, amount = 1): void {
  const store = getMissionsStore();
  const lower = username.toLowerCase();
  if (!store[lower]) {
    store[lower] = { counters: {}, claimedTiers: {} };
  }
  store[lower].counters[metric] = (store[lower].counters[metric] || 0) + amount;
  saveMissionsStore(store);
}

export function claimMissionReward(
  username: string,
  missionId: string,
  tierIndex: number
): { success: boolean; rewardAmount: number; error?: string } {
  const mission = MISSIONS.find((m) => m.id === missionId);
  if (!mission || !mission.tiers[tierIndex]) {
    return { success: false, rewardAmount: 0, error: 'Missão não encontrada' };
  }

  const tier = mission.tiers[tierIndex];
  const data = getUserMissionData(username);
  const currentCounter = data.counters[mission.metric] || 0;

  if (currentCounter < tier.target) {
    return { success: false, rewardAmount: 0, error: 'Meta ainda não alcançada' };
  }

  const highestClaimed = data.claimedTiers[missionId] ?? -1;
  if (tierIndex <= highestClaimed) {
    return { success: false, rewardAmount: 0, error: 'Recompensa deste nível já resgatada' };
  }

  // Credit reward to player account in localStorage
  const accounts = getStoredAccounts();
  const account = accounts.find((a: UserAccount) => a.username.toLowerCase() === username.toLowerCase());
  if (!account) {
    return { success: false, rewardAmount: 0, error: 'Usuário não encontrado' };
  }

  account.balance += tier.reward;
  account.history.unshift({
    id: `mission-${Date.now()}-${tierIndex}`,
    timestamp: Date.now(),
    type: 'WIN',
    gameId: mission.gameId,
    gameName: `Missão: ${mission.title}`,
    amount: tier.reward,
    balanceAfter: account.balance,
    details: `Resgate do Nível ${tierIndex + 1} (${tier.label}) - +${tier.reward.toLocaleString('pt-BR')} fichas`
  });

  saveStoredAccounts(accounts);

  // Update claimed tier
  const store = getMissionsStore();
  const lower = username.toLowerCase();
  store[lower].claimedTiers[missionId] = tierIndex;
  saveMissionsStore(store);

  soundManager.playWin();

  return { success: true, rewardAmount: tier.reward };
}
