import React from 'react';
import { ShieldCheck, X, Coins, Sparkles, AlertCircle, Flame } from 'lucide-react';

interface SocialNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SocialNoticeModal: React.FC<SocialNoticeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#180705] border-2 border-orange-500/40 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-orange-300 hover:text-white p-1.5 rounded-xl bg-[#260e0a] border border-orange-500/30 transition-colors cursor-pointer"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-orange-600/30 border border-orange-300">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-cinzel text-xl font-black text-white">
              Cassino Social Sem Dinheiro Real
            </h3>
            <p className="text-xs text-orange-400 font-semibold flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" /> Entretenimento 100% gratuito e seguro
            </p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-orange-200/90 leading-relaxed mb-6">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-[#220a07] border border-orange-500/20">
            <Coins className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs">
              <strong className="text-white block mb-0.5">Moeda 100% Fictícia:</strong> Você começa com <strong>1.000 Fichas</strong> virtuais. Todas as apostas, ganhos e saldos são simulados para pura diversão.
            </p>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-[#220a07] border border-orange-500/20">
            <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
            <p className="text-xs">
              <strong className="text-white block mb-0.5">Sem Depósitos ou Saques:</strong> Não há meios de pagamento, compras no aplicativo nem qualquer possibilidade de conversão de fichas para dinheiro real.
            </p>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-[#220a07] border border-orange-500/20">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs">
              <strong className="text-white block mb-0.5">Fichas Infinitas Grátis:</strong> Se o seu saldo zerar, utilize o botão de recarga no topo ou no lobby para ganhar instantaneamente mais +1.000 fichas.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-sm tracking-wide shadow-xl shadow-orange-600/40 transition-all cursor-pointer border border-orange-300/40"
        >
          Entendido, Vamos Jogar!
        </button>
      </div>
    </div>
  );
};
