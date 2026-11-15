import React, { useState, useEffect } from 'react';
import { Flame, ShieldCheck } from 'lucide-react';
import { getRealCommunityFeed, CommunityBetItem } from '../utils/auth';

export const LiveBetsTicker: React.FC = () => {
  const [tab, setTab] = useState<'all' | 'high'>('all');
  const [bets, setBets] = useState<CommunityBetItem[]>([]);

  useEffect(() => {
    const refreshBets = () => {
      const feed = getRealCommunityFeed();
      setBets(feed);
    };

    refreshBets();
    const interval = setInterval(refreshBets, 3000);
    return () => clearInterval(interval);
  }, []);

  const filteredBets = bets.filter((b) => {
    if (tab === 'high') {
      return b.amount >= 500;
    }
    return true;
  });

  return (
    <div className="rounded-2xl border border-orange-500/30 bg-[#160604] overflow-hidden shadow-2xl">
      {/* Header Bar */}
      <div className="p-3 sm:p-4 bg-gradient-to-r from-[#240a07] via-[#1a0705] to-[#140503] border-b border-orange-500/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs sm:text-sm font-bold text-orange-200 font-cinzel uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-500" /> Apostas da Comunidade (Pessoas Reais)
          </h3>
        </div>

        {/* Tabs */}
        <div className="flex items-center p-1 bg-[#120504] rounded-xl border border-orange-500/30 text-xs font-bold">
          <button
            onClick={() => setTab('all')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              tab === 'all'
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow'
                : 'text-slate-400 hover:text-orange-300'
            }`}
          >
            Todas as Apostas
          </button>
          <button
            onClick={() => setTab('high')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              tab === 'high'
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow'
                : 'text-slate-400 hover:text-orange-300'
            }`}
          >
            🔥 Apostas Altas
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {filteredBets.length === 0 ? (
          <div className="py-8 text-center text-xs text-orange-300/60 font-sans">
            Nenhuma aposta registrada pelos usuários cadastrados ainda. Jogue em qualquer mesa para sua aposta aparecer aqui!
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1f0b08] text-orange-300/80 uppercase tracking-wider text-[10px] font-bold border-b border-orange-500/20">
              <tr>
                <th className="py-2.5 px-4">Jogo</th>
                <th className="py-2.5 px-4">Jogador Real</th>
                <th className="py-2.5 px-4 text-right">Valor</th>
                <th className="py-2.5 px-4 text-right">Resultado</th>
                <th className="py-2.5 px-4 text-right">Horário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-950/40 font-mono">
              {filteredBets.slice(0, 10).map((b) => (
                <tr key={b.id} className="hover:bg-orange-950/20 transition-colors">
                  <td className="py-2.5 px-4 font-sans font-semibold text-orange-100 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    {b.gameName}
                  </td>
                  <td className="py-2.5 px-4 text-amber-300 font-bold font-sans">
                    {b.username}
                  </td>
                  <td className="py-2.5 px-4 text-right text-orange-200">
                    🪙 {b.amount.toLocaleString('pt-BR')}
                  </td>
                  <td className={`py-2.5 px-4 text-right font-black ${
                    b.isWin ? 'text-emerald-400' : 'text-red-400/80'
                  }`}>
                    {b.isWin ? `+${b.amount.toLocaleString('pt-BR')}` : `-${b.amount.toLocaleString('pt-BR')}`}
                  </td>
                  <td className="py-2.5 px-4 text-right text-orange-300/50 text-[10px]">
                    {new Date(b.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
