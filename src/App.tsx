import React, { useState, useEffect, useRef } from 'react';
import { GameId, UserAccount, PlayerStats } from './types/casino';
import { soundManager } from './utils/audio';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Footer } from './components/Footer';
import { SocialNoticeModal } from './components/SocialNoticeModal';
import { DailyWheelModal } from './components/DailyWheelModal';
import { LoginModal } from './components/LoginModal';
import { BigWinCelebration } from './components/BigWinCelebration';
import { FloatingSoundWidget } from './components/FloatingSoundWidget';
import { LuckyStreakMilestoneToast, LuckyStreakMilestoneData } from './components/LuckyStreakMilestoneToast';

// Utilities for Auth and Persistence
import { 
  getCurrentUser, 
  claimDailyBonus, 
  logGameAction, 
  logoutUser, 
  canClaimDailyBonus,
  loadFirestoreUser
} from './utils/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

import { contributeToJackpot } from './utils/communityJackpot';
import {
  LUCKY_STREAK_THRESHOLD,
  LUCKY_STREAK_BONUS_RATE,
  getLuckyStreakState,
  saveLuckyStreakState,
  calculateLuckyStreakBonus
} from './utils/luckyStreak';

// 14 Casino Games
import { Lobby } from './games/Lobby';
import { BlackjackGame } from './games/BlackjackGame';
import { VideoPokerGame } from './games/VideoPokerGame';
import { BaccaratGame } from './games/BaccaratGame';
import { TexasHoldemGame } from './games/TexasHoldemGame';
import { SlotsGame } from './games/SlotsGame';
import { LotteryGame } from './games/LotteryGame';
import { RocketLimboGame } from './games/RocketLimboGame';
import { RankingsView } from './games/RankingsView';

import { CrapsGame } from './games/CrapsGame';
import { ScratchGame } from './games/ScratchGame';
import { AmericanRouletteGame } from './games/AmericanRouletteGame';
import { CoinFlipGame } from './games/CoinFlipGame';
import { SicBoGame } from './games/SicBoGame';

// 3 New Games: Miner, Plinko, Liar's Bar
import { MinerGame } from './games/MinerGame';
import { PlinkoGame } from './games/PlinkoGame';
import { LiarsBarGame } from './games/LiarsBarGame';
import { ClassicSlotsGame } from './games/ClassicSlotsGame';
import { HorseRacingGame } from './games/HorseRacingGame';
import { ArcheryGame } from './games/ArcheryGame';
import { DragonEggGame } from './games/DragonEggGame';
import { MissionsView } from './games/MissionsView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getCurrentUser());
  const [firebaseUid, setFirebaseUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(!getCurrentUser());
  const [activeGame, setActiveGame] = useState<GameId>('lobby');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [favoriteGameIds, setFavoriteGameIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sapecas_favorite_games');
      return saved ? JSON.parse(saved) : ['slots', 'blackjack', 'miner'];
    } catch (e) {
      return ['slots', 'blackjack', 'miner'];
    }
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);

  const handleToggleFavorite = (gameId: GameId) => {
    setFavoriteGameIds((prev) => {
      const next = prev.includes(gameId)
        ? prev.filter((id) => id !== gameId)
        : [...prev, gameId];
      localStorage.setItem('sapecas_favorite_games', JSON.stringify(next));
      soundManager.playChip();
      return next;
    });
  };

  const [isMuted, setIsMuted] = useState<boolean>(soundManager.getMuted());
  const [socialModalOpen, setSocialModalOpen] = useState<boolean>(false);
  const [dailyWheelOpen, setDailyWheelOpen] = useState<boolean>(false);
  const [bigWinState, setBigWinState] = useState<{
    isOpen: boolean;
    winAmount: number;
    betAmount?: number;
    confettiIntensity?: 'low' | 'medium' | 'high' | 'mega' | number;
  }>({
    isOpen: false,
    winAmount: 0,
    betAmount: 0
  });

  const lastBetsRef = useRef<Record<string, number>>({});
  const initialStreak = getLuckyStreakState(currentUser?.username);
  const [winStreak, setWinStreak] = useState<number>(initialStreak.current);
  const [bestWinStreak, setBestWinStreak] = useState<number>(initialStreak.best);
  const streakRef = useRef<number>(initialStreak.current);
  const bestStreakRef = useRef<number>(initialStreak.best);
  const [luckyBonusNotif, setLuckyBonusNotif] = useState<{
    id: number;
    bonusAmount: number;
    streakCount: number;
  } | null>(null);
  const [milestoneToast, setMilestoneToast] = useState<LuckyStreakMilestoneData | null>(null);
  const luckyNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshAccount = () => {
    setCurrentUser(getCurrentUser());
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUid(fbUser.uid);
        try {
          const synced = await loadFirestoreUser(fbUser.uid, fbUser.email, fbUser.displayName);
          setCurrentUser(synced);
          setLoginModalOpen(false);
        } catch (err) {
          console.warn('Falha ao carregar perfil do Firestore:', err);
        }
      } else {
        setFirebaseUid(null);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const saved = getLuckyStreakState(currentUser?.username);
    streakRef.current = saved.current;
    bestStreakRef.current = saved.best;
    setWinStreak(saved.current);
    setBestWinStreak(saved.best);
  }, [currentUser?.username]);

  useEffect(() => {
    const handleRoundLoss = () => {
      if (streakRef.current > 0) {
        streakRef.current = 0;
        setWinStreak(0);
        saveLuckyStreakState(currentUser?.username, 0, bestStreakRef.current);
      }
    };
    window.addEventListener('sapecas_round_loss', handleRoundLoss);
    return () => {
      window.removeEventListener('sapecas_round_loss', handleRoundLoss);
      if (luckyNotifTimerRef.current) clearTimeout(luckyNotifTimerRef.current);
    };
  }, [currentUser?.username]);

  const handleLoginSuccess = (account: UserAccount) => {
    setCurrentUser(account);
    setLoginModalOpen(false);
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setLoginModalOpen(true);
    setActiveGame('lobby');
  };

  useEffect(() => {
    const unsub = soundManager.subscribe(() => {
      setIsMuted(soundManager.getMuted());
    });
    return unsub;
  }, []);

  const handleToggleMute = () => {
    const nextMuted = soundManager.toggleMute();
    setIsMuted(nextMuted);
  };

  // Claim Daily 10,000 chips bonus
  const handleClaimDailyBonus = () => {
    if (!currentUser) return;
    const res = claimDailyBonus(currentUser.username);
    if (res.success) {
      soundManager.playWin();
      window.dispatchEvent(new CustomEvent('sapecas_avatar_goal'));
      refreshAccount();
    }
  };

  /**
   * Central balance & history updater
   */
  const handleUpdateBalance = (
    delta: number,
    isWin: boolean,
    gameId: GameId,
    explicitBet?: number
  ) => {
    if (!currentUser) return;

    if (delta < 0 && !isWin) {
      const betAmount = Math.abs(delta);
      lastBetsRef.current[gameId] = betAmount;

      // Contribute to shared Community Jackpot
      const jackpotResult = contributeToJackpot(betAmount, currentUser.username);
      if (jackpotResult.triggered) {
        const bonusWon = jackpotResult.winBonus;
        soundManager.playJackpot();
        logGameAction(currentUser.username, bonusWon, true, 'slots', `💥 JACKPOT COMUNITÁRIO 100%! Bônus de ${bonusWon.toLocaleString('pt-BR')} fichas!`);
        setBigWinState({
          isOpen: true,
          winAmount: bonusWon,
          betAmount,
          confettiIntensity: 'mega'
        });
      }
    }

    let effectiveDelta = delta;
    let luckyBonusApplied = 0;

    // Track consecutive win streak & apply Lucky Streak bonus when active (3+ prior consecutive wins)
    if (isWin && delta > 0) {
      const activeStreakBeforeWin = streakRef.current;
      luckyBonusApplied = calculateLuckyStreakBonus(delta, activeStreakBeforeWin);
      effectiveDelta = delta + luckyBonusApplied;

      const nextStreak = activeStreakBeforeWin + 1;
      const nextBest = Math.max(bestStreakRef.current, nextStreak);
      streakRef.current = nextStreak;
      bestStreakRef.current = nextBest;
      setWinStreak(nextStreak);
      setBestWinStreak(nextBest);
      saveLuckyStreakState(currentUser.username, nextStreak, nextBest);

      if (nextStreak === LUCKY_STREAK_THRESHOLD) {
        soundManager.playMultiplierHit();
      }

      if (nextStreak === 5 || nextStreak === 10) {
        soundManager.playMultiplierHit();
        setMilestoneToast({ id: Date.now(), streak: nextStreak });
      }

      if (luckyBonusApplied > 0) {
        setLuckyBonusNotif({
          id: Date.now(),
          bonusAmount: luckyBonusApplied,
          streakCount: activeStreakBeforeWin
        });
        if (luckyNotifTimerRef.current) clearTimeout(luckyNotifTimerRef.current);
        luckyNotifTimerRef.current = setTimeout(() => {
          setLuckyBonusNotif(null);
        }, 2300);
      }
    } else if (!isWin && delta >= 0 && explicitBet !== undefined && delta < explicitBet) {
      // Explicit partial-return loss (e.g., Plinko landing on < 1x multiplier)
      streakRef.current = 0;
      setWinStreak(0);
      saveLuckyStreakState(currentUser.username, 0, bestStreakRef.current);
    }

    // Trigger celebratory overlay and avatar goal animation on win or milestone
    if (isWin && effectiveDelta > 0) {
      window.dispatchEvent(new CustomEvent('sapecas_avatar_goal', {
        detail: { reason: 'win', delta: effectiveDelta, gameId }
      }));
      window.dispatchEvent(new CustomEvent('sapecas_avatar_win', { detail: { delta: effectiveDelta, gameId } }));

      // Check milestones: balance milestones or new personal high score
      if (currentUser) {
        const prevBal = currentUser.balance;
        const newBal = prevBal + effectiveDelta;
        const milestones = [25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000];
        const crossedMilestone = milestones.find((m) => prevBal < m && newBal >= m);
        const isNewRecord = effectiveDelta > (currentUser.biggestWin || 0);
        if (crossedMilestone || isNewRecord) {
          window.dispatchEvent(new CustomEvent('sapecas_avatar_goal', {
            detail: { reason: 'milestone', crossedMilestone, isNewRecord, newBal }
          }));
        }
      }

      const gamesWithDedicatedVictoryScreen: GameId[] = [
        'slots',
        'blackjack',
        'texas-holdem',
        'video-poker',
        'baccarat',
        'liars-bar',
        'plinko',
        'scratch',
        'classic-slots',
        'horse-race',
        'archery',
        'dragon-egg',
        'limbo',
        'craps',
        'sicbo'
      ];
      const bet = explicitBet ?? lastBetsRef.current[gameId] ?? 0;
      if (!gamesWithDedicatedVictoryScreen.includes(gameId) && bet > 0 && effectiveDelta > 2 * bet) {
        setBigWinState({
          isOpen: true,
          winAmount: effectiveDelta,
          betAmount: bet
        });
      }
    }

    const gameNames: Record<string, string> = {
      slots: 'Slots Tigrinho & Dragão',
      blackjack: 'Blackjack (21) 3D',
      'roulette-american': 'Roleta Americana (0/00)',
      limbo: 'Aviãozinho Sapeca (Crash)',
      'texas-holdem': 'Texas Hold\'em Poker 3D',
      'video-poker': 'Vídeo Pôquer 3D',
      baccarat: 'Bacarate 3D',
      lottery: 'Loteria Mega Esferas',
      craps: 'Craps (Dados de Cassino)',
      scratch: 'Raspadinha Sapeca',
      coinflip: 'Cara ou Coroa 3D (Justo)',
      sicbo: 'Sic Bo · Dados Imperial',
      miner: 'Miner Sapeca',
      plinko: 'Bolinhas Sapecas',
      'liars-bar': "Liar's Bar · Mesa de Blefe",
      'classic-slots': 'Caça-Níquel Clássico',
      'horse-race': 'Corrida de Cavalos Sapecas',
      archery: 'Tiro do Sapeca',
      'dragon-egg': 'Ovo do Dragão Sapeca'
    };

    const gName = gameNames[gameId] || gameId;
    const bonusPct = Math.round(LUCKY_STREAK_BONUS_RATE * 100);
    const details = luckyBonusApplied > 0
      ? `🔥 Lucky Streak (${streakRef.current - 1}x): +${luckyBonusApplied.toLocaleString('pt-BR')} fichas bônus (+${bonusPct}%)`
      : undefined;
    logGameAction(currentUser.username, effectiveDelta, isWin, gameId, gName, details);
    refreshAccount();
  };

  // Convert account to PlayerStats interface for backwards compatibility
  const userBalance = currentUser ? currentUser.balance : 0;
  const legacyStats: PlayerStats = {
    chips: userBalance,
    highestBalance: currentUser ? currentUser.biggestWin + userBalance : 10000,
    biggestWin: currentUser ? currentUser.biggestWin : 0,
    currentStreak: winStreak,
    longestStreak: bestWinStreak,
    recordDate: new Date().toLocaleDateString('pt-BR'),
    lastDailyBonusDate: currentUser?.lastDailyBonus ? new Date(currentUser.lastDailyBonus).toISOString().split('T')[0] : '',
    dailyLoginStreak: 1,
    gameWins: {},
    totalRounds: currentUser?.totalWins || 0
  };

  const isFullViewportGame = activeGame !== 'lobby' && activeGame !== 'records' && activeGame !== 'missions';

  return (
    <div className={`${isFullViewportGame ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'} flex flex-col bg-[#0e0403] text-orange-100 font-sans selection:bg-orange-600/30 selection:text-orange-200`}>
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeGame={activeGame}
        onNavigate={setActiveGame}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        balance={userBalance}
        onOpenSocialModal={() => setSocialModalOpen(true)}
        onOpenDailyBonus={handleClaimDailyBonus}
        hasDailyBonusAvailable={currentUser ? canClaimDailyBonus(currentUser) : false}
        onOpenDailyWheel={() => setDailyWheelOpen(true)}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col lg:pl-64 transition-all duration-300 ${isFullViewportGame ? 'min-h-0' : ''}`}>
        {/* Top Header */}
        <Header
          activeGame={activeGame}
          onNavigate={setActiveGame}
          balance={userBalance}
          currentUser={currentUser}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenSocialModal={() => setSocialModalOpen(true)}
          onClaimDailyBonus={handleClaimDailyBonus}
          onOpenDailyWheel={() => setDailyWheelOpen(true)}
          onLogout={handleLogout}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          favoriteGameIds={favoriteGameIds}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavoritesOnly={() => setShowFavoritesOnly((prev) => !prev)}
          winStreak={winStreak}
          luckyStreakBonusNotification={luckyBonusNotif}
        />

        {/* Dynamic Game View / Lobby */}
        <main className={`flex-1 w-full mx-auto transition-all ${
          !isFullViewportGame
            ? 'max-w-7xl px-3 sm:px-6 py-3 sm:py-5'
            : (activeGame === 'plinko' || activeGame === 'miner' || activeGame === 'scratch' || activeGame === 'classic-slots' || activeGame === 'horse-race' || activeGame === 'archery' || activeGame === 'dragon-egg' || activeGame === 'liars-bar' || activeGame === 'texas-holdem' || activeGame === 'blackjack')
              ? 'max-w-7xl px-1.5 sm:px-3 py-1 flex flex-col min-h-0 overflow-hidden'
              : 'max-w-7xl px-1.5 sm:px-3 py-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden'
        }`}>
          {activeGame === 'lobby' && (
            <Lobby
              onSelectGame={setActiveGame}
              stats={legacyStats}
              onOpenSocialModal={() => setSocialModalOpen(true)}
              onOpenVipWheel={() => setDailyWheelOpen(true)}
              searchQuery={searchQuery}
              username={currentUser ? currentUser.username : 'Jogador'}
              onRefreshAccount={refreshAccount}
              favoriteGameIds={favoriteGameIds}
              onToggleFavorite={handleToggleFavorite}
              showFavoritesOnly={showFavoritesOnly}
              onToggleFavoritesOnly={() => setShowFavoritesOnly((prev) => !prev)}
            />
          )}

          {activeGame === 'slots' && (
            <SlotsGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'slots', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
            />
          )}

          {activeGame === 'blackjack' && (
            <BlackjackGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'blackjack', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
              currentUser={currentUser}
              firebaseUid={firebaseUid}
              onRequestLogin={() => setLoginModalOpen(true)}
            />
          )}

          {activeGame === 'roulette-american' && (
            <AmericanRouletteGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'roulette-american', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
            />
          )}

          {activeGame === 'limbo' && (
            <RocketLimboGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'limbo', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
            />
          )}

          {activeGame === 'texas-holdem' && (
            <TexasHoldemGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'texas-holdem', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
              currentUser={currentUser}
              firebaseUid={firebaseUid}
              onRequestLogin={() => setLoginModalOpen(true)}
            />
          )}

          {activeGame === 'video-poker' && (
            <VideoPokerGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'video-poker', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
            />
          )}

          {activeGame === 'baccarat' && (
            <BaccaratGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'baccarat', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
            />
          )}

          {activeGame === 'lottery' && (
            <LotteryGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'lottery', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
            />
          )}

          {activeGame === 'craps' && (
            <CrapsGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'craps', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
            />
          )}

          {activeGame === 'scratch' && (
            <ScratchGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'scratch', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
            />
          )}

          {activeGame === 'coinflip' && (
            <CoinFlipGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'coinflip', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
            />
          )}

          {activeGame === 'sicbo' && (
            <SicBoGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'sicbo', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
            />
          )}

          {activeGame === 'miner' && (
            <MinerGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'miner', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
              username={currentUser?.username}
            />
          )}

          {activeGame === 'plinko' && (
            <PlinkoGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'plinko', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
              username={currentUser?.username}
            />
          )}

          {activeGame === 'liars-bar' && (
            <LiarsBarGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'liars-bar', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
              username={currentUser?.username}
              currentUser={currentUser}
              firebaseUid={firebaseUid}
              onRequestLogin={() => setLoginModalOpen(true)}
            />
          )}

          {activeGame === 'classic-slots' && (
            <ClassicSlotsGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'classic-slots', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
            />
          )}

          {activeGame === 'horse-race' && (
            <HorseRacingGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'horse-race', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
            />
          )}

          {activeGame === 'archery' && (
            <ArcheryGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'archery', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
            />
          )}

          {activeGame === 'dragon-egg' && (
            <DragonEggGame
              balance={userBalance}
              onUpdateBalance={(delta, isWin, gId, bet) => handleUpdateBalance(delta, isWin, 'dragon-egg', bet)}
              onBackToLobby={() => setActiveGame('lobby')}
            />
          )}

          {activeGame === 'records' && (
            <RankingsView
              currentUser={currentUser}
              firebaseUid={firebaseUid}
              onBackToLobby={() => setActiveGame('lobby')}
            />
          )}

          {activeGame === 'missions' && (
            <MissionsView
              currentUser={currentUser}
              onBackToLobby={() => setActiveGame('lobby')}
              onSelectGame={setActiveGame}
              onRefreshAccount={refreshAccount}
            />
          )}
        </main>

        {/* Footer - Only rendered on Lobby, Records & Missions to guarantee 100vh strict screen fit for all games */}
        {(activeGame === 'lobby' || activeGame === 'records' || activeGame === 'missions') && (
          <Footer onOpenSocialModal={() => setSocialModalOpen(true)} />
        )}
      </div>

      {/* Mandatory Login Modal */}
      <LoginModal
        isOpen={loginModalOpen || !currentUser}
        onSuccess={handleLoginSuccess}
        canClose={Boolean(currentUser)}
        onClose={() => setLoginModalOpen(false)}
      />

      {/* Social Notice Legal Modal */}
      <SocialNoticeModal
        isOpen={socialModalOpen}
        onClose={() => setSocialModalOpen(false)}
      />

      {/* Daily Wheel 24h Modal */}
      <DailyWheelModal
        isOpen={dailyWheelOpen}
        onClose={() => setDailyWheelOpen(false)}
        account={currentUser}
        onAccountUpdate={refreshAccount}
      />

      {/* Big Win Celebration Animation */}
      <BigWinCelebration
        isOpen={bigWinState.isOpen}
        winAmount={bigWinState.winAmount}
        betAmount={bigWinState.betAmount}
        confettiIntensity={bigWinState.confettiIntensity}
        onClose={() => setBigWinState((prev) => ({ ...prev, isOpen: false, confettiIntensity: undefined }))}
      />

      {/* Non-intrusive 5x / 10x Lucky Streak Milestone Toast */}
      <LuckyStreakMilestoneToast
        milestone={milestoneToast}
        onClose={() => setMilestoneToast(null)}
      />

      {/* Persistent Mini Floating Sound Widget (Edge-Hugging) */}
      <FloatingSoundWidget />
    </div>
  );
}
