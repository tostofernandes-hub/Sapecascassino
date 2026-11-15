#!/usr/bin/env python3
import re

with open('/app/applet/src/games/TexasHoldemGame.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the Multiplayer View block inside table content
old_multi_view = """            /* ================= MULTIPLAYER VIEW (2 to 8 PLAYERS IN ROOM) ================= */
            <>
              {/* Header: Turn banner & Community Pot */}
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                  <span className="text-xs sm:text-sm font-bold text-amber-300">
                    Sala: <strong className="text-white">{activeRoom?.name}</strong> · Vez de:{' '}
                    <strong className="text-amber-400 uppercase font-black">{tablePlayers[activePlayerIndex]?.username}</strong>
                  </span>
                </div>

                <div className="bg-[#260905] border-2 border-amber-500/60 px-3.5 py-1 rounded-full flex items-center gap-1.5 shadow">
                  <span className="text-sm">🪙</span>
                  <span className="font-mono text-xs sm:text-sm font-black text-amber-300">
                    Pote da Sala: {multiPot.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* 5 Community Cards Center */}
              <div className="text-center my-1">
                <div className="flex items-center justify-center gap-2 min-h-[64px]">
                  {multiCommunityCards.map((c, i) => (
                    <PlayingCard
                      key={c.id || i}
                      card={c}
                      hidden={i >= multiRevealedCount}
                      size="xs"
                    />
                  ))}
                </div>
              </div>

              {/* Seated Players Grid (up to 8 players) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-1">
                {tablePlayers.map((p, idx) => {
                  const isTurn = idx === activePlayerIndex && multiStage !== 'SHOWDOWN' && multiStage !== 'WAITING';
                  return (
                    <div
                      key={p.username}
                      className={`p-2 rounded-xl border text-xs transition-all relative ${
                        isTurn
                          ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400 shadow-lg scale-102'
                          : p.folded
                          ? 'bg-black/50 border-slate-800 opacity-40'
                          : 'bg-[#180503] border-orange-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-orange-100 truncate max-w-[90px]">
                          {p.username}
                        </span>
                        {p.isDealer && <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1 rounded">D</span>}
                      </div>

                      <div className="font-mono text-[11px] text-amber-300 font-extrabold">
                        🪙 {p.chips.toLocaleString('pt-BR')}
                      </div>

                      {/* Hole Cards Status */}
                      <div className="flex items-center gap-1 mt-1 justify-center min-h-[40px]">
                        {p.folded ? (
                          <span className="text-[10px] text-red-400 font-bold">FOLD</span>
                        ) : isTurn && peekHoleCards ? (
                          p.holeCards.map((c, ci) => (
                            <PlayingCard key={ci} card={c} size="xs" floating={false} withDealerHand={ci === 1} />
                          ))
                        ) : multiStage === 'SHOWDOWN' && !p.folded ? (
                          p.holeCards.map((c, ci) => (
                            <PlayingCard key={ci} card={c} size="xs" floating={false} />
                          ))
                        ) : (
                          <div className="flex gap-1.5 opacity-80">
                            <div className="w-7 h-10 rounded bg-[#200503] border border-amber-500/50 flex items-center justify-center text-[9px] text-amber-300 font-bold">♠</div>
                            <div className="w-7 h-10 rounded bg-[#200503] border border-amber-500/50 flex items-center justify-center text-[9px] text-amber-300 font-bold">♥</div>
                          </div>
                        )}
                      </div>

                      {p.handResult && (
                        <div className="text-[10px] text-center text-amber-300 font-bold mt-0.5 truncate">
                          {p.handResult.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Showdown Winner Message */}
              {multiWinnerMsg && (
                <div className="text-center p-1.5 bg-amber-500/20 border-2 border-amber-400 rounded-xl text-xs sm:text-sm font-bold text-amber-200">
                  {multiWinnerMsg}
                </div>
              )}
            </>"""

new_multi_view = """            /* ================= REAL-TIME FIRESTORE MULTIPLAYER VIEW (UP TO 5 PLAYERS) ================= */
            <>
              {/* Header: Turn banner & Community Pot */}
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                  <span className="text-xs sm:text-sm font-bold text-amber-300">
                    Mesa: <strong className="text-white">{salaAtivaFirestore ? salaAtivaFirestore.nomeSala : activeRoom?.name}</strong> · Vez de:{' '}
                    <strong className="text-amber-400 uppercase font-black">
                      {salaAtivaFirestore
                        ? (salaAtivaFirestore.jogadores.find(j => j.uid === (salaAtivaFirestore.estadoJogo as EstadoPoker)?.turnoAtual)?.nome || 'Aguardando Início')
                        : tablePlayers[activePlayerIndex]?.username}
                    </strong>
                  </span>
                </div>

                <div className="bg-[#260905] border-2 border-amber-500/60 px-3.5 py-1 rounded-full flex items-center gap-1.5 shadow">
                  <span className="text-sm">🪙</span>
                  <span className="font-mono text-xs sm:text-sm font-black text-amber-300">
                    Pote da Sala: {(salaAtivaFirestore ? ((salaAtivaFirestore.estadoJogo as EstadoPoker)?.pote || 0) : multiPot).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* 5 Community Cards Center */}
              <div className="text-center my-1">
                <div className="flex items-center justify-center gap-2 min-h-[64px]">
                  {(salaAtivaFirestore ? ((salaAtivaFirestore.estadoJogo as EstadoPoker)?.cartasComunitarias || []) : multiCommunityCards).map((c: any, i: number) => {
                    const revealedCount = salaAtivaFirestore ? ((salaAtivaFirestore.estadoJogo as EstadoPoker)?.cartasReveladas || 0) : multiRevealedCount;
                    return (
                      <PlayingCard
                        key={c.id || i}
                        card={c}
                        hidden={i >= revealedCount}
                        size="xs"
                      />
                    );
                  })}
                </div>
              </div>

              {/* Seated Players Grid (Strictly up to 5 players per room) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-1">
                {salaAtivaFirestore ? (
                  salaAtivaFirestore.jogadores.map((p, idx) => {
                    const estado = salaAtivaFirestore.estadoJogo as EstadoPoker;
                    const isTurn = p.uid === estado?.turnoAtual && estado?.fase !== 'SHOWDOWN' && estado?.fase !== 'AGUARDANDO';
                    const isMe = p.uid === auth.currentUser?.uid;

                    return (
                      <div
                        key={p.uid}
                        className={`p-2 rounded-xl border text-xs transition-all relative ${
                          isTurn
                            ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-102'
                            : p.deuFold
                            ? 'bg-black/50 border-slate-800 opacity-40'
                            : 'bg-[#180503] border-orange-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-orange-100 truncate max-w-[85px] flex items-center gap-1">
                            <span>{p.nome}</span>
                            {isMe && <span className="text-[9px] text-amber-400 font-black">(Você)</span>}
                          </span>
                          {idx === 0 && <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1 rounded">D</span>}
                        </div>

                        <div className="font-mono text-[11px] text-amber-300 font-extrabold">
                          🪙 {p.fichas.toLocaleString('pt-BR')}
                        </div>

                        {/* Hole Cards */}
                        <div className="flex items-center gap-1 mt-1 justify-center min-h-[40px]">
                          {p.deuFold ? (
                            <span className="text-[10px] text-red-400 font-bold">FOLD</span>
                          ) : (isMe || estado?.fase === 'SHOWDOWN') && p.cartasPoker && p.cartasPoker.length > 0 ? (
                            p.cartasPoker.map((c: any, ci: number) => (
                              <PlayingCard key={ci} card={c} size="xs" floating={false} />
                            ))
                          ) : (
                            <div className="flex gap-1 opacity-80">
                              <div className="w-7 h-10 rounded bg-[#200503] border border-amber-500/50 flex items-center justify-center text-[9px] text-amber-300 font-bold">♠</div>
                              <div className="w-7 h-10 rounded bg-[#200503] border border-amber-500/50 flex items-center justify-center text-[9px] text-amber-300 font-bold">♥</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  tablePlayers.slice(0, 5).map((p, idx) => {
                    const isTurn = idx === activePlayerIndex && multiStage !== 'SHOWDOWN' && multiStage !== 'WAITING';
                    return (
                      <div
                        key={p.username}
                        className={`p-2 rounded-xl border text-xs transition-all relative ${
                          isTurn
                            ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400 shadow-lg scale-102'
                            : p.folded
                            ? 'bg-black/50 border-slate-800 opacity-40'
                            : 'bg-[#180503] border-orange-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-orange-100 truncate max-w-[85px]">
                            {p.username}
                          </span>
                          {p.isDealer && <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1 rounded">D</span>}
                        </div>
                        <div className="font-mono text-[11px] text-amber-300 font-extrabold">
                          🪙 {p.chips.toLocaleString('pt-BR')}
                        </div>
                        <div className="flex items-center gap-1 mt-1 justify-center min-h-[40px]">
                          {p.folded ? (
                            <span className="text-[10px] text-red-400 font-bold">FOLD</span>
                          ) : isTurn && peekHoleCards ? (
                            p.holeCards.map((c, ci) => (
                              <PlayingCard key={ci} card={c} size="xs" floating={false} withDealerHand={ci === 1} />
                            ))
                          ) : multiStage === 'SHOWDOWN' && !p.folded ? (
                            p.holeCards.map((c, ci) => (
                              <PlayingCard key={ci} card={c} size="xs" floating={false} />
                            ))
                          ) : (
                            <div className="flex gap-1.5 opacity-80">
                              <div className="w-7 h-10 rounded bg-[#200503] border border-amber-500/50 flex items-center justify-center text-[9px] text-amber-300 font-bold">♠</div>
                              <div className="w-7 h-10 rounded bg-[#200503] border border-amber-500/50 flex items-center justify-center text-[9px] text-amber-300 font-bold">♥</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Showdown Winner Message */}
              {(salaAtivaFirestore ? (salaAtivaFirestore.estadoJogo as EstadoPoker)?.mensagemVitoria : multiWinnerMsg) && (
                <div className="text-center p-1.5 bg-amber-500/20 border-2 border-amber-400 rounded-xl text-xs sm:text-sm font-bold text-amber-200 animate-pulse">
                  {salaAtivaFirestore ? (salaAtivaFirestore.estadoJogo as EstadoPoker)?.mensagemVitoria : multiWinnerMsg}
                </div>
              )}
            </>"""

content = content.replace(old_multi_view, new_multi_view)

# Replace the Multiplayer Action Controls block
old_multi_controls = """          /* ================= MULTIPLAYER ROOM CONTROLS ================= */
          multiStage === 'SHOWDOWN' || multiStage === 'WAITING' ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Seat additional registered player */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedUserToJoin}
                  onChange={(e) => setSelectedUserToJoin(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-[#220a07] border border-orange-500/40 text-xs text-orange-100"
                >
                  <option value="">Sentar Jogador Cadastrado...</option>
                  {allRegisteredUsers.map(u => (
                    <option key={u.username} value={u.username}>{u.username} (🪙 {u.balance})</option>
                  ))}
                </select>
                <button
                  onClick={handleAddPlayerToRoom}
                  className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs cursor-pointer shadow"
                >
                  Sentar na Mesa 🪑
                </button>
              </div>

              <button
                type="button"
                onClick={startNewMultiplayerHand}
                disabled={tablePlayers.length < 2}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Distribuir Mão da Sala ({tablePlayers.length} Jogadores) 🃏</span>
              </button>
            </div>
          ) : (
            /* Active Multiplayer Turn Options */
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                {/* Hole Cards Peek Toggle for Privacy */}
                <button
                  onClick={() => setPeekHoleCards(prev => !prev)}
                  className="px-4 py-2.5 rounded-xl bg-[#2a0e08] hover:bg-[#38130a] text-amber-300 border border-orange-500/40 text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer shadow"
                >
                  {peekHoleCards ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{peekHoleCards ? 'Ocultar Cartas Privadas' : 'Espiar Minhas Cartas'}</span>
                </button>

                {/* Turn Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMultiFold}
                    className="px-4 py-2.5 rounded-xl bg-red-950/90 hover:bg-red-900 border border-red-500/60 text-red-200 font-bold text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Fold</span>
                  </button>

                  <button
                    onClick={handleMultiCallOrCheck}
                    className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-400 text-white font-bold text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {currentHighestBet > tablePlayers[activePlayerIndex]?.currentStreetBet
                        ? `Call (${currentHighestBet - tablePlayers[activePlayerIndex]?.currentStreetBet})`
                        : 'Check'}
                    </span>
                  </button>

                  <button
                    onClick={handleMultiRaise}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Raise No-Limit ({multiRaiseAmount})</span>
                  </button>
                </div>
              </div>
            </div>
          )"""

new_multi_controls = """          /* ================= FIRESTORE REAL-TIME MULTIPLAYER CONTROLS ================= */
          salaAtivaFirestore ? (
            salaAtivaFirestore.status === 'aguardando' || (salaAtivaFirestore.estadoJogo as EstadoPoker)?.fase === 'SHOWDOWN' ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap text-xs text-orange-200">
                  <span className="font-bold text-amber-300">Jogadores Conectados ({salaAtivaFirestore.jogadores.length}/5):</span>
                  {salaAtivaFirestore.jogadores.map(j => (
                    <span key={j.uid} className="px-2.5 py-1 rounded-md bg-[#250d09] border border-orange-500/30 text-white font-mono font-bold">
                      {j.nome}
                    </span>
                  ))}
                </div>

                {salaAtivaFirestore.criadorId === auth.currentUser?.uid ? (
                  <button
                    type="button"
                    onClick={handleIniciarMaoPokerFS}
                    disabled={salaAtivaFirestore.jogadores.length < 2}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Iniciar Partida de Pôquer ({salaAtivaFirestore.jogadores.length} Jogadores) 🃏</span>
                  </button>
                ) : (
                  <div className="px-5 py-2.5 rounded-xl bg-[#200805] border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-2 animate-pulse">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Aguardando o anfitrião ({salaAtivaFirestore.criadorNome}) iniciar a rodada...</span>
                  </div>
                )}
              </div>
            ) : (
              /* Partida em Andamento: Turno e Ações protegidas por turnoAtual */
              (() => {
                const estado = salaAtivaFirestore.estadoJogo as EstadoPoker;
                const isMinhaVez = estado?.turnoAtual === auth.currentUser?.uid;
                const jogadorDaVez = salaAtivaFirestore.jogadores.find(j => j.uid === estado?.turnoAtual);
                const myPlayerData = salaAtivaFirestore.jogadores.find(j => j.uid === auth.currentUser?.uid);
                const valorCall = Math.max(0, (estado?.maiorAposta || 0) - (myPlayerData?.apostaRodada || 0));

                return (
                  <div className="space-y-2.5">
                    {/* Status do Turno com Destaque Real */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      {isMinhaVez ? (
                        <div className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg animate-pulse">
                          <Sparkles className="w-4 h-4 fill-current" />
                          <span>👉 SUA VEZ DE JOGAR! Escolha sua jogada abaixo:</span>
                        </div>
                      ) : (
                        <div className="px-4 py-1.5 rounded-xl bg-[#200805] border border-orange-500/30 text-orange-200/80 font-bold text-xs flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                          <span>Aguardando a jogada de <strong>{jogadorDaVez?.nome || 'outro jogador'}</strong>...</span>
                        </div>
                      )}

                      <div className="text-xs text-orange-300 font-mono">
                        Fase: <strong className="text-white uppercase font-bold">{estado?.fase}</strong>
                      </div>
                    </div>

                    {/* Botões de Ação do Jogador (Desabilitados quando não for a vez) */}
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <button
                        onClick={() => handleAcaoPokerMultiFS('fold')}
                        disabled={!isMinhaVez}
                        className="px-4 py-2.5 rounded-xl bg-red-950/90 hover:bg-red-900 border border-red-500/60 text-red-200 font-bold text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 shadow disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Fold</span>
                      </button>

                      <button
                        onClick={() => handleAcaoPokerMultiFS(valorCall > 0 ? 'call' : 'check')}
                        disabled={!isMinhaVez}
                        className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-400 text-white font-bold text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 shadow disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Check className="w-4 h-4" />
                        <span>{valorCall > 0 ? `Call (${valorCall} Fichas)` : 'Check'}</span>
                      </button>

                      <button
                        onClick={() => handleAcaoPokerMultiFS('raise', multiRaiseAmount)}
                        disabled={!isMinhaVez}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        <span>Raise (+{multiRaiseAmount} Fichas)</span>
                      </button>
                    </div>
                  </div>
                );
              })()
            )
          ) : (
            /* Fallback Local Offline Room Controls */
            <div className="text-center py-2 text-xs text-orange-300 font-bold">
              Selecione uma sala online acima ou clique em "Criar Sala" para jogar com outros jogadores reais em tempo real!
            </div>
          )"""

content = content.replace(old_multi_controls, new_multi_controls)

with open('/app/applet/src/games/TexasHoldemGame.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated table view and controls in TexasHoldemGame.tsx")
