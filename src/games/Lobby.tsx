import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { GameId, PlayerStats } from '../types/casino';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Flame,
  Heart
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { LazyGameCard } from '../components/LazyGameCard';
import { LobbyGameCardData } from '../components/LobbyGameCard';
import { CommunityJackpotBanner } from '../components/CommunityJackpotBanner';
import { LobbyPerformanceMonitor } from '../components/LobbyPerformanceMonitor';
import heroBannerImg from '../assets/images/casino_hero_dragon_1794067542296.jpg';

const LazyLiveBetsTicker = React.lazy(() =>
  import('../components/LiveBetsTicker').then((module) => ({ default: module.LiveBetsTicker }))
);

const INITIAL_EAGER_CARDS = 4;

interface LobbyProps {
  onSelectGame: (game: GameId) => void;
  stats: PlayerStats;
  onRefillChips?: () => void;
  onOpenSocialModal: () => void;
  onOpenDailyBonus?: () => void;
  onOpenVipWheel?: () => void;
  searchQuery?: string;
  username?: string;
  onRefreshAccount?: () => void;
  favoriteGameIds?: string[];
  onToggleFavorite?: (id: GameId) => void;
  showFavoritesOnly?: boolean;
  onToggleFavoritesOnly?: () => void;
}

const GAMES: LobbyGameCardData[] = [
  {
    id: 'slots',
    title: 'Fortune Dragon & Tigre',
    badge: 'HOT 🔥',
    category: 'slots',
    categoryLabel: 'Caça-Níquel',
    description: 'Bobinas douradas 3x3 com dragões cuspidor de fogo, multiplicadores até 1000x e rodadas bônus frenéticas.',
    payoutMax: '1000x',
    rtp: '98.8%',
    provider: 'Imperial Studios',
    loadImage: () => import('../assets/images/game_slots_dragon_1794067557791.jpg')
  },
  {
    id: 'blackjack',
    title: 'Royal Blackjack 21',
    badge: 'VIP CLUB',
    category: 'cards',
    categoryLabel: 'Cartas',
    description: 'Mesa clássica de luxo contra o dealer. Dobre a aposta, divida pares e receba 3:2 no Blackjack natural.',
    payoutMax: '3:2',
    rtp: '99.5%',
    provider: 'Imperial Live',
    loadImage: () => import('../assets/images/game_blackjack_royale_1794067574709.jpg')
  },
  {
    id: 'limbo',
    title: 'Aviãozinho Sapeca (Crash)',
    badge: 'ALTA DECOLAGEM ✈️',
    category: 'provably-fair',
    categoryLabel: 'Originais',
    description: 'Decole com o Aviãozinho Sapeca! Acompanhe o multiplicador subir enquanto voa pelas nuvens e encerre antes que o avião caia.',
    payoutMax: '1000x',
    rtp: '99.0%',
    provider: 'Blockasino Original',
    loadImage: () => import('../assets/images/game_aviao_crash_1794068832280.jpg')
  },
  {
    id: 'texas-holdem',
    title: "High Roller Texas Hold'em",
    badge: 'TORNEIO',
    category: 'cards',
    categoryLabel: 'Cartas',
    description: 'Duelo mano a mano com cartas comunitárias (Flop, Turn e River). Estratégia pura com Call, Raise e Fold.',
    payoutMax: '100:1',
    rtp: '98.2%',
    provider: 'Championship Series',
    loadImage: () => import('../assets/images/game_poker_holdem_1794067605149.jpg')
  },
  {
    id: 'baccarat',
    title: 'Golden Dragon Baccarat',
    badge: '9 PONTO DE OURO',
    category: 'table',
    categoryLabel: 'Mesa',
    description: 'Aposte no Jogador, na Banca ou no Empate com regras tradicionais de terceira carta e elegância oriental.',
    payoutMax: '8:1',
    rtp: '98.9%',
    provider: 'Macau Club',
    loadImage: () => import('../assets/images/game_baccarat_dragon_1794067619580.jpg')
  },
  {
    id: 'video-poker',
    title: 'Jacks or Better Deluxe',
    badge: '250X ROYAL',
    category: 'cards',
    categoryLabel: 'Cartas',
    description: 'Máquina de vídeo pôquer retrô com retenção estratégica e pagamento máximo em Royal Flush.',
    payoutMax: '250x',
    rtp: '99.2%',
    provider: 'Retro Casino',
    loadImage: () => import('../assets/images/game_videopoker_vip_1794067649198.jpg')
  },
  {
    id: 'lottery',
    title: 'Mega Fortune Esferas',
    badge: '50.000X JACKPOT',
    category: 'lottery',
    categoryLabel: 'Loteria',
    description: 'Escolha de 6 a 15 números e acompanhe o sorteio ao vivo das esferas douradas flamejantes.',
    payoutMax: '50.000x',
    rtp: '97.0%',
    provider: 'Lotto Imperial',
    loadImage: () => import('../assets/images/game_lottery_mega_1794067676859.jpg')
  },
  {
    id: 'craps',
    title: 'Craps · Dados de Cassino',
    badge: 'VEGAS CLASSIC 🎲',
    category: 'table',
    categoryLabel: 'Mesa',
    description: 'A clássica mesa de dados de Las Vegas com Pass Line, Field, Craps e Hardway com dados 3D rolando na mesa.',
    payoutMax: '9:1',
    rtp: '91.4%',
    provider: 'Vegas Originals',
    loadImage: () => import('../assets/images/game_craps_vegas_1794185381299.jpg')
  },
  {
    id: 'scratch',
    title: 'Raspadinha Sapeca',
    badge: '3X3 · ATÉ 100X 🎫',
    category: 'slots',
    categoryLabel: 'Raspadinha',
    description: 'Compre bilhetes e raspe individualmente os 9 quadrantes dourados para encontrar 3 símbolos idênticos e faturar até 100x.',
    payoutMax: '100x',
    rtp: '94.0%',
    provider: 'Sapecas Scratch',
    loadImage: () => import('../assets/images/game_scratch_gold_1794185394120.jpg')
  },
  {
    id: 'roulette-american',
    title: 'Roleta Americana (0 & 00)',
    badge: 'DUPLO ZERO 🎡',
    category: 'table',
    categoryLabel: 'Mesa',
    description: 'Roleta clássica com duplo zero (0 e 00), maior vantagem da casa (5.26%) e física de rolagem 3D.',
    payoutMax: '35:1',
    rtp: '94.74%',
    provider: 'Atlantic Club',
    loadImage: () => import('../assets/images/game_roulette_american_1794185381776.jpg')
  },
  {
    id: 'coinflip',
    title: 'Cara ou Coroa 3D (Jogo Justo)',
    badge: '100% JUSTO 50/50 🪙',
    category: 'provably-fair',
    categoryLabel: 'Originais',
    description: 'Lançamento de moeda 3D em perspectiva com chance 100% justa de 50/50 e multiplicadores de sequência.',
    payoutMax: '2x',
    rtp: '100.0%',
    provider: 'Sapecas Fair',
    loadImage: () => import('../assets/images/game_coinflip_lion_1794185394498.jpg')
  },
  {
    id: 'sicbo',
    title: 'Sic Bo · Dados Imperial',
    badge: 'TRINCA 150X 🏮',
    category: 'table',
    categoryLabel: 'Mesa',
    description: 'Cúpula vibrante com 3 dados dourados: apostas em Pequeno, Grande, Par, Ímpar e Trincas até 150:1.',
    payoutMax: '150:1',
    rtp: '89.2%',
    provider: 'Macau Dynasty',
    loadImage: () => import('../assets/images/game_sicbo_dynasty_1794185395582.jpg')
  },
  {
    id: 'miner',
    title: 'Miner Sapeca',
    badge: 'CASHOUT 💣',
    category: 'provably-fair',
    categoryLabel: 'Originais',
    description: 'Escolha o número de bombas, garimpe diamantes preciosos e decida quando sacar antes da explosão.',
    payoutMax: '24.5x',
    rtp: '98.5%',
    provider: 'Sapecas Originals',
    loadImage: () => import('../assets/images/game_miner_diamond_1794185368545.jpg')
  },
  {
    id: 'plinko',
    title: 'Bolinhas Sapecas',
    badge: 'ATÉ 29X ⚪',
    category: 'provably-fair',
    categoryLabel: 'Originais',
    description: 'Solte múltiplas bolinhas em sequência pela pirâmide de pinos com colisão real e acerte caixas até 29x.',
    payoutMax: '29x',
    rtp: '98.0%',
    provider: 'Sapecas Originals',
    loadImage: () => import('../assets/images/game_plinko_peneira_1794185368705.jpg')
  },
  {
    id: 'liars-bar',
    title: "Liar's Bar · Mesa de Blefe",
    badge: 'MULTIPLAYER 😈',
    category: 'cards',
    categoryLabel: 'Cartas',
    description: 'Jogo clandestino com cartas de figuras (Áses, Reis, Damas e Diabo). Blefe e desmascare mentiras em até 5 jogadores.',
    payoutMax: '5:1',
    rtp: '98.0%',
    provider: 'Speakeasy Club',
    loadImage: () => import('../assets/images/game_liarsbar_blefe_1794185368575.jpg')
  },
  {
    id: 'classic-slots',
    title: 'Caça-Níquel Clássico',
    badge: 'VEGAS 200X 🎰',
    category: 'slots',
    categoryLabel: 'Caça-Níquel',
    description: 'Máquina retrô de 3 roletas estilo Las Vegas antigo com parada em cascata, chance ampliada e prêmios até 200x na linha central.',
    payoutMax: '200x',
    rtp: '95.5%',
    provider: 'Vegas Vintage',
    loadImage: () => import('../assets/images/classic_slots_card_1794627048548.jpg')
  },
  {
    id: 'horse-race',
    title: 'Corrida de Cavalos Sapecas',
    badge: 'PISTA 3D · 18.8X 🐎',
    category: 'table',
    categoryLabel: 'Corrida',
    description: 'Pista 3D em perspectiva com 6 cavalos galopando e rotação automática de nomes, chances e multiplicadores a cada 5 corridas.',
    payoutMax: '18.8x',
    rtp: '94.0%',
    provider: 'Sapecas Turf',
    loadImage: () => import('../assets/images/horse_race_card_1794627048493.jpg')
  },
  {
    id: 'archery',
    title: 'Tiro do Sapeca (Arqueiro)',
    badge: '20 ALVOS · 50X',
    category: 'provably-fair',
    categoryLabel: 'Originais',
    description: 'Escolha até 3 flechas, clique nos 20 alvos ocultos na floresta para mirar e busque o acerto lendário de 50x na mosca!',
    payoutMax: '50x',
    rtp: '95.0%',
    provider: 'Sapecas Originals',
    loadImage: () => import('../assets/images/archery_sapeca_card_1794685484126.jpg')
  },
  {
    id: 'dragon-egg',
    title: 'Ovo do Dragão Sapeca',
    badge: 'NINHO PROGRESSIVO',
    category: 'provably-fair',
    categoryLabel: 'Originais',
    description: 'Choque ovos no ninho progressivo (5 para 4 ovos): enfrente Cobras ocultas, multiplique 1.5x → 2.5x → 4x → 6x → 10x → 15x+ e saque quando quiser!',
    payoutMax: '60x+',
    rtp: '95.0%',
    provider: 'Sapecas Originals',
    loadImage: () => import('../assets/images/dragon_egg_card_1794685484749.jpg')
  }
];

export const Lobby: React.FC<LobbyProps> = ({
  onSelectGame,
  stats,
  onOpenSocialModal,
  onOpenVipWheel,
  searchQuery = '',
  favoriteGameIds = [],
  onToggleFavorite,
  showFavoritesOnly = false,
  onToggleFavoritesOnly
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const handleGameClick = useCallback((id: GameId) => {
    soundManager.playClick();
    onSelectGame(id);
  }, [onSelectGame]);

  const isFavFilterActive = showFavoritesOnly || selectedCategory === 'favorites';

  const filteredGames = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return GAMES.filter((game) => {
      if (isFavFilterActive && !favoriteGameIds.includes(game.id)) {
        return false;
      }
      const matchesCategory =
        selectedCategory === 'all' ||
        selectedCategory === 'favorites' ||
        game.category === selectedCategory;

      if (!matchesCategory) return false;
      if (normalizedSearch === '') return true;

      return (
        game.title.toLowerCase().includes(normalizedSearch) ||
        game.description.toLowerCase().includes(normalizedSearch) ||
        game.categoryLabel.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [isFavFilterActive, favoriteGameIds, selectedCategory, searchQuery]);

  return (
    <div className="space-y-10 animate-fade-in pb-12">
      {/* Hero Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-orange-500/40 bg-gradient-to-r from-[#2a0e08] via-[#1f0906] to-[#120403] shadow-[0_0_40px_rgba(234,88,12,0.25)]">
        {/* Hero Background Image */}
        <div className="absolute right-0 top-0 bottom-0 w-full md:w-3/5 z-0 opacity-75 md:opacity-95 pointer-events-none overflow-hidden">
          <img
            src={heroBannerImg}
            alt="Dragão da Fortuna Cassino Imperial"
            className="block opacity-100 w-full h-full object-cover object-right md:scale-105"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#2a0e08] via-[#2a0e08]/70 to-transparent" />
        </div>

        {/* Hero Left Content */}
        <div className="relative z-10 max-w-2xl p-5 sm:p-8 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-600/30 border border-orange-500/50 text-[10px] text-orange-300 font-bold uppercase tracking-wider shadow-sm">
            <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
            <span>Cassino Social 100% Fictício & Gratuito</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white font-cinzel tracking-tight leading-tight">
            BEM-VINDO AO <br />
            <span className="text-flame-gradient">SAPECAS CASSINO</span>
          </h1>

          <p className="text-orange-200/90 text-xs sm:text-sm leading-relaxed max-w-xl font-medium">
            O mais completo cassino social com 20 jogos clássicos, cartas com profundidade 3D e Roleta Diária da Sorte. 100% gratuito e sem dinheiro real.
          </p>

          {/* Call to Actions */}
          <div className="pt-1 flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button
              onClick={() => handleGameClick('slots')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-bold text-xs shadow-md shadow-orange-600/30 transition-all flex items-center gap-1.5 cursor-pointer border border-orange-300/40 hover:scale-[1.02]"
            >
              <span>Jogar Fortune Dragon</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {onOpenVipWheel && (
              <button
                onClick={onOpenVipWheel}
                className="px-3.5 py-2 rounded-xl bg-[#260e0a] hover:bg-[#34130d] text-orange-300 hover:text-white border border-orange-500/40 font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Roleta VIP Grátis</span>
              </button>
            )}

            <button
              onClick={onOpenSocialModal}
              className="px-3 py-2 rounded-xl bg-transparent hover:bg-orange-950/40 text-orange-300/80 hover:text-orange-200 text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Aviso Legal</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="relative z-10 px-5 sm:px-8 py-3 bg-[#140503]/90 border-t border-orange-500/20 grid grid-cols-2 sm:grid-cols-4 gap-3 text-orange-200">
          <div>
            <span className="text-[10px] text-orange-400/80 font-bold uppercase tracking-wider block">Saldo em Fichas</span>
            <span className="font-mono text-lg sm:text-xl font-black text-amber-300 tabular-nums">
              🪙 {stats.chips.toLocaleString('pt-BR')}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-orange-400/80 font-bold uppercase tracking-wider block">Maior Saldo Fictício</span>
            <span className="font-mono text-lg sm:text-xl font-black text-emerald-400 tabular-nums">
              {stats.highestBalance.toLocaleString('pt-BR')}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-orange-400/80 font-bold uppercase tracking-wider block">Maior Prêmio Único</span>
            <span className="font-mono text-lg sm:text-xl font-black text-orange-400 tabular-nums">
              +{stats.biggestWin.toLocaleString('pt-BR')}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-orange-400/80 font-bold uppercase tracking-wider block">Sequência de Vitórias</span>
            <span className="font-mono text-lg sm:text-xl font-black text-amber-400 tabular-nums flex items-center gap-1">
              <Flame className="w-4 h-4 text-orange-500" />
              {stats.currentStreak} {stats.currentStreak === 1 ? 'vitória' : 'vitórias'}
            </span>
          </div>
        </div>
      </section>

      {/* Shared Community Jackpot Progress Bar */}
      <section>
        <CommunityJackpotBanner />
      </section>

      {/* Quick In-House Games & Promos Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Promo 1: VIP Wheel */}
        <div
          onClick={onOpenVipWheel}
          className="p-3 rounded-xl bg-gradient-to-br from-[#2f100a] to-[#1c0805] border border-orange-500/30 hover:border-orange-400 shadow-md cursor-pointer group transition-all hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-300 mb-1">
            <span className="uppercase tracking-wider">Roleta VIP</span>
            <span className="bg-orange-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">GIRO GRÁTIS</span>
          </div>
          <h4 className="text-sm font-bold text-white font-cinzel group-hover:text-orange-300 transition-colors">
            Giro da Fortuna
          </h4>
          <p className="text-[11px] text-orange-200/70 mt-0.5">
            Ganhe até 10.000 fichas bônus diárias na roda premiada.
          </p>
        </div>

        {/* Promo 2: Limbo Rocket Quick Card */}
        <div
          onClick={() => handleGameClick('limbo')}
          className="p-3 rounded-xl bg-gradient-to-br from-[#2f100a] to-[#1c0805] border border-orange-500/30 hover:border-orange-400 shadow-md cursor-pointer group transition-all hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-orange-300 mb-1">
            <span className="uppercase tracking-wider">Aviãozinho Sapeca</span>
            <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">1000X</span>
          </div>
          <h4 className="text-sm font-bold text-white font-cinzel group-hover:text-orange-300 transition-colors">
            Decolagem Imperial
          </h4>
          <p className="text-[11px] text-orange-200/70 mt-0.5">
            Multiplicadores dinâmicos provably fair em tempo real.
          </p>
        </div>
      </section>

      {/* Category Filter Tabs */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white font-cinzel flex items-center gap-2">
              <Flame className="w-6 h-6 text-orange-500" /> Salão Imperial de Jogos
            </h2>
            <p className="text-xs sm:text-sm text-orange-200/70 mt-0.5">
              Escolha seu jogo favorito com gráficos em alta definição e apostas virtuais gratuitas.
            </p>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: 'all', label: 'Todos os Jogos' },
              { id: 'favorites', label: `❤️ Favoritos${favoriteGameIds.length > 0 ? ` (${favoriteGameIds.length})` : ''}` },
              { id: 'slots', label: '🎰 Caça-Níqueis' },
              { id: 'table', label: '🎡 Roleta & Mesas' },
              { id: 'cards', label: '♠️ Cartas & Pôquer' },
              { id: 'provably-fair', label: '🚀 Originais Provably Fair' },
              { id: 'lottery', label: '🎱 Loterias' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-md shadow-orange-600/40 border border-orange-300/40'
                    : 'bg-[#220a07] text-orange-200/80 hover:text-white border border-orange-500/25 hover:bg-[#30110c]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lazy-Loaded Games Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredGames.length === 0 ? (
            <div className="col-span-full text-center py-14 px-6 bg-[#180705] border border-orange-500/30 rounded-3xl shadow-xl space-y-4">
              <div className="w-14 h-14 rounded-full bg-rose-950/60 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                <Heart className="w-7 h-7 text-rose-500 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold font-cinzel text-white">
                  {isFavFilterActive ? 'Nenhum Jogo Favorito Encontrado' : 'Nenhum Jogo Encontrado'}
                </h3>
                <p className="text-xs sm:text-sm text-orange-200/70 max-w-md mx-auto leading-relaxed">
                  {isFavFilterActive
                    ? 'Você ainda não favoritou nenhum jogo. Clique no botão de coração ❤️ em qualquer jogo para adicioná-lo aos seus favoritos e vê-lo aqui!'
                    : `Não encontramos nenhum jogo para o termo "${searchQuery}".`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  if (showFavoritesOnly) onToggleFavoritesOnly?.();
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold text-xs shadow-md border border-orange-300/40 transition-all cursor-pointer"
              >
                Ver Todos os 20 Jogos
              </button>
            </div>
          ) : (
            filteredGames.map((game, index) => (
              <LazyGameCard
                key={game.id}
                game={game}
                isFav={favoriteGameIds.includes(game.id)}
                priority={index < INITIAL_EAGER_CARDS}
                onSelect={handleGameClick}
                onToggleFavorite={onToggleFavorite}
              />
            ))
          )}
        </div>
      </section>

      {/* Community Live Bets Ticker (Lazy Loaded) */}
      <section className="space-y-3">
        <Suspense fallback={<div className="h-24 rounded-2xl bg-[#1c0805]/60 border border-orange-500/20 animate-pulse" />}>
          <LazyLiveBetsTicker />
        </Suspense>
      </section>

      {/* Lobby Performance Monitor Utility */}
      <LobbyPerformanceMonitor />
    </div>
  );
};
