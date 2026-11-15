import React, { useState, useEffect } from 'react';
import { GameId, UserAccount } from '../types/casino';
import { getCurrentUser, updateUserProfile } from '../utils/auth';
import { soundManager } from '../utils/audio';
import { 
  Flame, 
  Crown, 
  Trophy, 
  Sparkles, 
  Gift, 
  ShieldCheck, 
  Plane,
  Dices, 
  Coins, 
  Disc, 
  Layers, 
  X,
  CreditCard,
  Target,
  Edit2,
  Check,
  User
} from 'lucide-react';

const AVATAR_OPTIONS = ['🦁', '🐯', '👑', '🦊', '🐺', '🐲', '💎', '🎲', '🃏', '🎩', '🦅', '🐻', '🔥', '⚡', '🏆', '🎯'];

interface SidebarProps {
  activeGame: GameId;
  onNavigate: (game: GameId) => void;
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  onOpenSocialModal: () => void;
  onOpenDailyBonus: () => void;
  hasDailyBonusAvailable: boolean;
  onOpenDailyWheel?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeGame,
  onNavigate,
  isOpen,
  onClose,
  balance,
  onOpenSocialModal,
  onOpenDailyBonus,
  hasDailyBonusAvailable,
  onOpenDailyWheel
}) => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getCurrentUser());
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(currentUser?.avatar || '🦁');
  const [nicknameInput, setNicknameInput] = useState<string>(currentUser?.nickname || currentUser?.username || '');
  const [savedFeedback, setSavedFeedback] = useState<boolean>(false);

  useEffect(() => {
    const handleUpdate = () => {
      const u = getCurrentUser();
      setCurrentUser(u);
      if (u) {
        setSelectedAvatar(u.avatar || '🦁');
        setNicknameInput(u.nickname || u.username);
      }
    };
    window.addEventListener('sapecas_profile_updated', handleUpdate);
    return () => window.removeEventListener('sapecas_profile_updated', handleUpdate);
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const res = updateUserProfile(currentUser.username, {
      avatar: selectedAvatar,
      nickname: nicknameInput
    });
    if (res.success) {
      soundManager.playChip();
      setSavedFeedback(true);
      setTimeout(() => {
        setSavedFeedback(false);
        setIsEditingProfile(false);
      }, 1200);
    }
  };
  const handleNav = (id: GameId) => {
    onNavigate(id);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#140604] border-r border-orange-500/25 flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Branding */}
        <div>
          <div className="h-16 px-4 flex items-center justify-between border-b border-orange-500/20 bg-gradient-to-r from-[#200a07] to-[#140604]">
            <button
              onClick={() => handleNav('lobby')}
              className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 via-red-600 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-600/30 border border-amber-300">
                <Crown className="w-5 h-5 text-slate-950 font-black" />
              </div>
              <div>
                <span className="font-cinzel text-lg font-black tracking-wider text-orange-400 group-hover:text-amber-300 transition-colors block leading-tight">
                  SAPECAS
                </span>
                <span className="text-[9px] uppercase tracking-widest text-amber-400 font-bold block leading-none">
                  Cassino Social
                </span>
              </div>
            </button>

            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-orange-950/40 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Customization Card */}
          {currentUser && (
            <div className="mx-3 my-2 p-2.5 rounded-xl bg-gradient-to-b from-[#250d09] to-[#180705] border border-orange-500/30 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-lg shadow-md border border-amber-300/60">
                    {currentUser.avatar || '🦁'}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-amber-300 truncate">
                      {currentUser.nickname || currentUser.username}
                    </div>
                    <div className="text-[10px] text-orange-400/80 truncate font-mono">
                      @{currentUser.username}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="p-1.5 rounded-lg text-orange-300 hover:text-white hover:bg-orange-600/30 transition-colors"
                  title="Personalizar perfil e avatar"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Collapsible Edit Profile Form */}
              {isEditingProfile && (
                <form onSubmit={handleSaveProfile} className="mt-2.5 pt-2 border-t border-orange-500/20 space-y-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-orange-300 block mb-1">
                      Escolha seu Ícone / Avatar:
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      {AVATAR_OPTIONS.map((av) => (
                        <button
                          key={av}
                          type="button"
                          onClick={() => setSelectedAvatar(av)}
                          className={`p-1 text-base rounded-lg transition-all ${
                            selectedAvatar === av
                              ? 'bg-amber-500/30 border border-amber-400 scale-110 shadow-sm'
                              : 'bg-black/30 hover:bg-black/50 border border-transparent'
                          }`}
                        >
                          {av}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-orange-300 block mb-1">
                      Apelido de Exibição:
                    </label>
                    <input
                      type="text"
                      maxLength={18}
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      placeholder="Seu apelido..."
                      className="w-full bg-[#120403] border border-orange-500/40 rounded-lg px-2 py-1 text-xs text-white placeholder-orange-400/40 outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="submit"
                      className="flex-1 py-1.5 px-2 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold text-[11px] rounded-lg shadow flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {savedFeedback ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Salvo!</span>
                        </>
                      ) : (
                        <span>Salvar Perfil</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="py-1 px-2 text-[10px] text-orange-300/70 hover:text-white"
                    >
                      Fechar
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Nav Links */}
          <div className="px-3 py-2 space-y-1 max-h-[calc(100vh-250px)] overflow-y-auto">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-400/80">
              Salão Principal
            </div>

            <button
              onClick={() => handleNav('lobby')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'lobby'
                  ? 'bg-gradient-to-r from-orange-600/30 to-red-600/20 text-orange-300 border border-orange-500/40 shadow'
                  : 'text-slate-300 hover:bg-orange-950/30 hover:text-orange-300'
              }`}
            >
              <Flame className="w-4 h-4 text-orange-500" />
              <span>Início & Destaques</span>
            </button>

            <button
              onClick={() => handleNav('missions')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'missions'
                  ? 'bg-gradient-to-r from-orange-600/30 to-red-600/20 text-orange-300 border border-orange-500/40 shadow'
                  : 'text-slate-300 hover:bg-orange-950/30 hover:text-orange-300'
              }`}
            >
              <Target className="w-4 h-4 text-emerald-400" />
              <div className="flex-1 text-left flex items-center justify-between">
                <span>Missões Diárias</span>
                <span className="text-[9px] bg-emerald-600 text-white px-1.5 rounded font-bold">BÔNUS</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('records')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'records'
                  ? 'bg-gradient-to-r from-orange-600/30 to-red-600/20 text-orange-300 border border-orange-500/40 shadow'
                  : 'text-slate-300 hover:bg-orange-950/30 hover:text-orange-300'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Rankings dos Jogadores</span>
            </button>

            <div className="pt-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-400/80">
              19 Jogos de Cassino
            </div>

            <button
              onClick={() => handleNav('miner')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'miner' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <span className="text-sm">💣</span>
              <div className="flex-1 text-left flex items-center justify-between">
                <span>Miner Sapeca</span>
                <span className="text-[9px] bg-red-600 text-white px-1.5 rounded font-bold">NOVO</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('plinko')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'plinko' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <span className="text-sm">⚪</span>
              <div className="flex-1 text-left flex items-center justify-between">
                <span>Bolinhas Sapecas</span>
                <span className="text-[9px] bg-red-600 text-white px-1.5 rounded font-bold">NOVO</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('liars-bar')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'liars-bar' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <span className="text-sm">😈</span>
              <div className="flex-1 text-left flex items-center justify-between">
                <span>Liar&apos;s Bar (Blefe)</span>
                <span className="text-[9px] bg-purple-600 text-white px-1.5 rounded font-bold">MULTI</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('classic-slots')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'classic-slots' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <span className="text-sm">🎰</span>
              <div className="flex-1 text-left flex items-center justify-between">
                <span>Caça-Níquel Clássico</span>
                <span className="text-[9px] bg-red-600 text-white px-1.5 rounded font-bold">NOVO</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('horse-race')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'horse-race' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <span className="text-sm">🐎</span>
              <div className="flex-1 text-left flex items-center justify-between">
                <span>Corrida de Cavalos</span>
                <span className="text-[9px] bg-emerald-600 text-white px-1.5 rounded font-bold">3D</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('archery')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'archery' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <span className="text-sm">🏹</span>
              <div className="flex-1 text-left flex items-center justify-between">
                <span>Tiro do Sapeca</span>
                <span className="text-[9px] bg-red-600 text-white px-1.5 rounded font-bold">NOVO</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('dragon-egg')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'dragon-egg' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <span className="text-sm">🥚</span>
              <div className="flex-1 text-left flex items-center justify-between">
                <span>Ovo do Dragão</span>
                <span className="text-[9px] bg-red-600 text-white px-1.5 rounded font-bold">NOVO</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('coinflip')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'coinflip' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <span className="text-sm">🪙</span>
              <div className="flex-1 text-left flex items-center justify-between">
                <span>Cara ou Coroa 3D</span>
                <span className="text-[9px] bg-emerald-600 text-white px-1.5 rounded font-bold">JUSTO</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('craps')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'craps' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <Dices className="w-4 h-4 text-red-400" />
              <span>Craps (Dados Vegas)</span>
            </button>

            <button
              onClick={() => handleNav('sicbo')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'sicbo' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <span className="text-sm">🏮</span>
              <span>Sic Bo · Dados Imperial</span>
            </button>

            <button
              onClick={() => handleNav('scratch')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'scratch' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <CreditCard className="w-4 h-4 text-amber-400" />
              <span>Raspadinha Sapeca</span>
            </button>

            <button
              onClick={() => handleNav('slots')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'slots' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Slots Tigrinho & Dragão</span>
            </button>

            <button
              onClick={() => handleNav('blackjack')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'blackjack' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <Crown className="w-4 h-4 text-orange-400" />
              <span>Blackjack (21) 3D</span>
            </button>

            <button
              onClick={() => handleNav('roulette-american')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'roulette-american' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <Disc className="w-4 h-4 text-emerald-500" />
              <span>Roleta Americana (0 & 00)</span>
            </button>

            <button
              onClick={() => handleNav('texas-holdem')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'texas-holdem' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <Layers className="w-4 h-4 text-amber-500" />
              <span>Texas Hold&apos;em Poker 3D</span>
            </button>

            <button
              onClick={() => handleNav('video-poker')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'video-poker' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <Dices className="w-4 h-4 text-orange-300" />
              <span>Vídeo Pôquer 3D</span>
            </button>

            <button
              onClick={() => handleNav('baccarat')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'baccarat' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <Coins className="w-4 h-4 text-amber-300" />
              <span>Bacarate Dragão 3D</span>
            </button>

            <button
              onClick={() => handleNav('limbo')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'limbo' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <Plane className="w-4 h-4 text-orange-500" />
              <span>Aviãozinho Sapeca (Crash)</span>
            </button>

            <button
              onClick={() => handleNav('lottery')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeGame === 'lottery' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-slate-300 hover:text-orange-300'
              }`}
            >
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span>Loteria Mega Esferas</span>
            </button>

            <button
              onClick={onOpenSocialModal}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-orange-300 transition-colors cursor-pointer pt-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Aviso Cassino Social</span>
            </button>
          </div>
        </div>

        {/* Bottom Promos */}
        <div className="p-3 border-t border-orange-500/20 bg-gradient-to-b from-[#1a0805] to-[#110403] space-y-2">
          {onOpenDailyWheel && (
            <button
              onClick={onOpenDailyWheel}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <span>🎡</span>
              <span>Roleta Diária Grátis</span>
            </button>
          )}

          <button
            onClick={onOpenDailyBonus}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
              hasDailyBonusAvailable
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border border-emerald-300 animate-pulse'
                : 'bg-[#250d09] text-orange-300 border border-orange-500/30'
            }`}
          >
            <Gift className="w-4 h-4 text-amber-300" />
            <span>{hasDailyBonusAvailable ? '+10.000 Fichas Diárias!' : 'Bônus Diário Resgatado'}</span>
          </button>
        </div>
      </aside>
    </>
  );
};
