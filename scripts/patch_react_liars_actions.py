#!/usr/bin/env python3
import re

with open('/app/applet/src/games/LiarsBarGame.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the action controls footer to support Firestore multiplayer
old_actions_footer = """      {/* ==================================================== */}
      {/* ACTION CONTROLS FOOTER (DECLARAR, DUVIDAR, COMO JOGAR) */}
      {/* ==================================================== */}
      {(gameState === 'PLAYING' || gameState === 'REVEAL') && (
        <div className="shrink-0 flex items-center gap-2 pt-1">
          {lastPlay && lastPlay.playerIdx !== currentTurnIdx && (
            <button
              type="button"
              disabled={gameState !== 'PLAYING' || !isHumanTurn || isHumanEliminated}
              onClick={() => handleChallenge(0)}
              className="flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:brightness-110 text-white font-cinzel font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg border border-red-400 active:scale-98 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Skull className="w-4 h-4" />
              <span>DUVIDAR! (LIAR!) 🚨</span>
            </button>
          )}

          <button
            type="button"
            disabled={
              gameState !== 'PLAYING' ||
              !isHumanTurn ||
              selectedCardIds.length === 0 ||
              isHumanEliminated
            }
            onClick={handlePlayCards}
            className="flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-slate-950 font-cinzel font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg border border-yellow-300 active:scale-98 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>DECLARAR CARTAS ({selectedCardIds.length}) 🃏</span>
          </button>
        </div>
      )}"""

new_actions_footer = """      {/* ==================================================== */}
      {/* ACTION CONTROLS FOOTER (REAL-TIME FIRESTORE & OFFLINE) */}
      {/* ==================================================== */}
      {(gameState === 'PLAYING' || gameState === 'REVEAL') && (
        <div className="shrink-0 flex flex-col gap-1.5 pt-1">
          {salaAtivaFirestore && (
            (() => {
              const estado = salaAtivaFirestore.estadoJogo as EstadoLiarsBar;
              const isMinhaVez = estado?.turnoAtual === auth.currentUser?.uid;
              const jogadorDaVez = salaAtivaFirestore.jogadores.find(j => j.uid === estado?.turnoAtual);

              return (
                <div className="flex items-center justify-between text-xs px-1">
                  {isMinhaVez ? (
                    <span className="text-amber-300 font-black animate-pulse flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>👉 SUA VEZ! Selecione de 1 a 3 cartas para declarar ou duvide do blefe anterior:</span>
                    </span>
                  ) : (
                    <span className="text-orange-300/80 font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                      <span>Aguardando a jogada de <strong>{jogadorDaVez?.nome || 'outro jogador'}</strong>...</span>
                    </span>
                  )}
                  <span className="font-mono text-orange-400 font-bold">
                    Mesa Exige: <strong>{estado?.mesaAlvo === 'A' ? 'Ás (A)' : estado?.mesaAlvo === 'K' ? 'Rei (K)' : 'Dama (Q)'}</strong>
                  </span>
                </div>
              );
            })()
          )}

          <div className="flex items-center gap-2">
            {salaAtivaFirestore ? (
              (() => {
                const estado = salaAtivaFirestore.estadoJogo as EstadoLiarsBar;
                const isMinhaVez = estado?.turnoAtual === auth.currentUser?.uid;
                const podeDuvidar = isMinhaVez && (estado?.cartasNaMesaTotal || 0) > 0 && estado?.ultimoJogadorUid !== auth.currentUser?.uid;

                return (
                  <>
                    <button
                      type="button"
                      disabled={!podeDuvidar}
                      onClick={handleDuvidarLiarsFS}
                      className="flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:brightness-110 text-white font-cinzel font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg border border-red-400 active:scale-98 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <Skull className="w-4 h-4" />
                      <span>DUVIDAR! (LIAR!) 🚨</span>
                    </button>

                    <button
                      type="button"
                      disabled={!isMinhaVez || selectedCardIds.length === 0}
                      onClick={() => {
                        const humanCards = humanPlayer?.hand || [];
                        const selectedTypes = selectedCardIds
                          .map(id => humanCards.find(c => c.id === id)?.type)
                          .filter((t): t is CardType => !!t);
                        handleJogarCartasLiarsFS();
                        setSelectedCardIds([]);
                      }}
                      className="flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-slate-950 font-cinzel font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg border border-yellow-300 active:scale-98 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-4 h-4 fill-slate-950" />
                      <span>DECLARAR CARTAS ({selectedCardIds.length}) 🃏</span>
                    </button>
                  </>
                );
              })()
            ) : (
              <>
                {lastPlay && lastPlay.playerIdx !== currentTurnIdx && (
                  <button
                    type="button"
                    disabled={gameState !== 'PLAYING' || !isHumanTurn || isHumanEliminated}
                    onClick={() => handleChallenge(0)}
                    className="flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:brightness-110 text-white font-cinzel font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg border border-red-400 active:scale-98 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <Skull className="w-4 h-4" />
                    <span>DUVIDAR! (LIAR!) 🚨</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={
                    gameState !== 'PLAYING' ||
                    !isHumanTurn ||
                    selectedCardIds.length === 0 ||
                    isHumanEliminated
                  }
                  onClick={handlePlayCards}
                  className="flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-slate-950 font-cinzel font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg border border-yellow-300 active:scale-98 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>DECLARAR CARTAS ({selectedCardIds.length}) 🃏</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}"""

content = content.replace(old_actions_footer, new_actions_footer)

with open('/app/applet/src/games/LiarsBarGame.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated LiarsBarGame.tsx action buttons with real-time turn enforcement")
