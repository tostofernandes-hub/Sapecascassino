import React from 'react';
import { Gift, X, Sparkles, Check, Calendar, Flame } from 'lucide-react';
import { soundManager } from '../utils/audio';
import { fireConfetti } from '../utils/confetti';

interface DailyBonusModalProps {
  isOpen: boolean;
  onClose: () => void;
  streak: number;
  bonusAmount: number;
  onClaim: () => void;
  alreadyClaimed: boolean;
}

export const DailyBonusModal: React.FC<DailyBonusModalProps> = ({
  isOpen,
  onClose,
  streak,
  bonusAmount,
  onClaim,
  alreadyClaimed
}) => {
  if (!isOpen) return null;

  const handleClaim = () => {
    soundManager.playJackpot();
    fireConfetti(3000);
    onClaim();
    onClose();
  };

  const streakDays = [
    { day: 1, amount: 500 },
    { day: 2, amount: 750 },
    { day: 3, amount: 1000 },
    { day: 4, amount: 1250 },
    { day: 5, amount: 1500 },
    { day: 6, amount: 1750 },
    { day: 7, amount: 2500 }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="my-auto bg-[#180705] border-2 border-orange-500/50 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative text-center space-y-4">
        {/* Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-orange-600/25 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-orange-300 hover:text-white p-1.5 rounded-xl bg-[#260e0a] border border-orange-500/30 transition-colors cursor-pointer"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Gift Icon Header */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 via-red-600 to-amber-500 mx-auto flex items-center justify-center text-white shadow-xl shadow-orange-600/40 border border-orange-300">
          <Gift className="w-8 h-8" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-orange-600/30 border border-orange-500/40 text-[10px] font-black uppercase tracking-wider text-orange-300 mb-1">
            <Flame className="w-3.5 h-3.5 text-orange-400" /> Bônus Diário Imperial
          </div>
          <h3 className="font-cinzel text-2xl font-black text-white">
            Recompensa Diária de Fichas
          </h3>
          <p className="text-xs text-orange-200/80 mt-1">
            {alreadyClaimed
              ? 'Você já resgatou sua recompensa de hoje! Retorne amanhã para continuar sua sequência.'
              : 'Bem-vindo de volta! Resgate suas fichas diárias gratuitas para continuar jogando.'}
          </p>
        </div>

        {/* Big Chip Display */}
        <div className="py-4 px-3 bg-[#230b08] rounded-2xl border border-orange-500/40 flex flex-col items-center justify-center shadow-inner">
          <span className="text-xs font-bold text-orange-400 uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Recompensa de Hoje
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl">🪙</span>
            <span className="font-mono text-3xl sm:text-4xl font-black text-flame-gradient tabular-nums">
              +{bonusAmount.toLocaleString('pt-BR')}
            </span>
          </div>
          <span className="text-[11px] text-orange-300/70 mt-0.5">
            Fichas 100% gratuitas e fictícias
          </span>
        </div>

        {/* 7-Day Streak Timeline */}
        <div>
          <div className="flex items-center justify-between text-xs text-orange-300 mb-2">
            <span className="flex items-center gap-1 font-semibold">
              <Calendar className="w-3.5 h-3.5 text-orange-400" /> Sequência de Visitas:
            </span>
            <span className="font-bold text-amber-400 font-mono">
              Dia {Math.min(7, streak || 1)} de 7
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {streakDays.map((item) => {
              const currentActive = (streak || 1) === item.day;
              const completed = (streak || 1) > item.day || (alreadyClaimed && currentActive);
              return (
                <div
                  key={item.day}
                  className={`p-1.5 rounded-xl border text-center transition-all ${
                    currentActive
                      ? 'bg-orange-600/30 border-orange-400 ring-2 ring-orange-400 text-orange-100'
                      : completed
                      ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-400'
                      : 'bg-[#220a07] border-orange-950 text-orange-400/40'
                  }`}
                >
                  <span className="text-[10px] block font-bold">D{item.day}</span>
                  <span className="text-[9px] font-mono font-bold block mt-0.5">
                    {completed ? <Check className="w-3 h-3 mx-auto text-emerald-400" /> : `${item.amount}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Claim or Dismiss Button */}
        {alreadyClaimed ? (
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-[#260e0a] hover:bg-[#34130d] text-orange-200 border border-orange-500/30 font-bold text-sm tracking-wide transition-colors cursor-pointer"
          >
            Fechar e Voltar aos Jogos
          </button>
        ) : (
          <button
            onClick={handleClaim}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-base shadow-xl shadow-orange-600/40 transition-all cursor-pointer flex items-center justify-center gap-2 border border-orange-300/40 hover:scale-[1.02]"
          >
            <Gift className="w-5 h-5 fill-current" />
            <span>Coletar +{bonusAmount.toLocaleString('pt-BR')} Fichas</span>
          </button>
        )}
      </div>
    </div>
  );
};
