import React from 'react';
import { ShieldAlert, HeartHandshake, ShieldCheck, Crown } from 'lucide-react';

interface FooterProps {
  onOpenSocialModal: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenSocialModal }) => {
  return (
    <footer className="mt-auto border-t border-orange-500/25 bg-[#120504] text-orange-200/70 py-8 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Prominent Social Casino Legal Notice */}
        <div className="bg-[#1f0b08] border border-orange-500/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center gap-4 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/40 flex items-center justify-center shrink-0 text-orange-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="text-xs sm:text-sm text-orange-200/90 leading-relaxed flex-1">
            <strong className="text-orange-400 font-bold block sm:inline">
              AVISO LEGAL DE CASSINO SOCIAL:
            </strong>{' '}
            Este site é uma plataforma de entretenimento com simulações de jogos de azar 100% gratuita. Todas as apostas e prêmios utilizam exclusivamente moedas virtuais fictícias (&quot;Fichas&quot;). Não há depósitos em dinheiro real, apostas reais, transações financeiras, prêmios monetários, pagamentos ou saques de qualquer espécie. O sucesso neste cassino social não implica sucesso futuro em apostas reais. Destinado exclusivamente para maiores de 18 anos.
          </div>
          <button
            onClick={onOpenSocialModal}
            className="text-xs text-orange-400 hover:text-orange-300 underline font-semibold whitespace-nowrap cursor-pointer shrink-0"
          >
            Saber mais
          </button>
        </div>

        {/* Brand & Links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-orange-400/60 pt-2 border-t border-orange-500/15">
          <div className="flex items-center gap-3">
            <span className="font-cinzel text-orange-300 font-bold flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-orange-500" /> SAPECAS CASSINO
            </span>
            <span aria-hidden="true">·</span>
            <span>Sem Dinheiro Real</span>
            <span aria-hidden="true">·</span>
            <span>Bônus Diário 10.000 Fichas</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-orange-300/80">
              <HeartHandshake className="w-3.5 h-3.5 text-orange-400" /> Jogo Responsável e Divertido
            </span>
            <span className="bg-orange-600/30 border border-orange-500/50 text-orange-300 px-2 py-0.5 rounded font-bold text-[10px]">+18</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
