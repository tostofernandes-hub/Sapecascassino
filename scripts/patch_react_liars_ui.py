#!/usr/bin/env python3
import re

with open('/app/applet/src/games/LiarsBarGame.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the ROOMS_LOBBY list to render salasFirestore
old_lobby_rooms = """          {/* Rooms List */}
          <div className="flex-1 overflow-y-auto my-2 space-y-2 pr-1">
            {rooms.length === 0 ? (
              <div className="text-center py-10 text-orange-300/60 font-cinzel text-sm">
                Nenhuma taverna aberta no momento. Crie a primeira mesa de blefe!
              </div>
            ) : (
              rooms.map((room) => {
                const isFull = room.playerNames.length >= room.maxPlayers;
                const isInside = room.playerNames.some(p => p.toLowerCase() === username.toLowerCase());
                return (
                  <div
                    key={room.id}
                    className="p-3 rounded-xl bg-[#250d09] border border-orange-500/30 flex items-center justify-between hover:border-amber-400 transition-all shadow-md"
                  >
                    <div>
                      <div className="font-cinzel font-black text-sm text-white flex items-center gap-2">
                        <span>{room.name}</span>
                        {room.status === 'em-andamento' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                            EM ANDAMENTO
                          </span>
                        )}
                        {room.status === 'aberta' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            ABERTA
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-orange-200/70 mt-1 flex items-center gap-3">
                        <span>Host: <strong className="text-amber-400">{room.host}</strong></span>
                        <span>·</span>
                        <span>Jogadores: <strong className="text-emerald-400">{room.playerNames.length}/{room.maxPlayers}</strong></span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleJoinRoom(room)}
                      disabled={isFull && !isInside}
                      className="btn-gold py-1.5 px-4 text-xs font-bold"
                    >
                      {isInside ? 'Retornar à Sala 😈' : isFull ? 'Sala Lotada' : 'Entrar na Sala 🃏'}
                    </button>
                  </div>
                );
              })
            )}
          </div>"""

new_lobby_rooms = """          {/* Rooms List (Real-Time Firestore Rooms + Offline Fallback) */}
          <div className="flex-1 overflow-y-auto my-2 space-y-2 pr-1">
            {salasFirestore.length > 0 ? (
              salasFirestore.map((sala) => {
                const isFull = sala.jogadores.length >= 5;
                const isInside = sala.jogadores.some(j => j.uid === auth.currentUser?.uid || j.nome.toLowerCase() === username.toLowerCase());

                return (
                  <div
                    key={sala.id}
                    className="p-3 rounded-xl bg-[#250d09] border border-orange-500/35 flex items-center justify-between hover:border-amber-400 transition-all shadow-md"
                  >
                    <div>
                      <div className="font-cinzel font-black text-sm text-white flex items-center gap-2">
                        <span>{sala.nomeSala}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 font-mono">
                          Código: {sala.codigoConvite}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase">
                          {sala.status === 'em_andamento' ? 'Em Andamento' : 'Aguardando'}
                        </span>
                      </div>
                      <div className="text-xs text-orange-200/70 mt-1 flex items-center gap-3">
                        <span>Host: <strong className="text-amber-400">{sala.criadorNome}</strong></span>
                        <span>·</span>
                        <span>Jogadores: <strong className="text-emerald-400">{sala.jogadores.length}/5</strong></span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleEntrarSalaLiarsFS(sala)}
                      disabled={isFull && !isInside}
                      className="btn-gold py-1.5 px-4 text-xs font-bold"
                    >
                      {isInside ? 'Retornar à Mesa 😈' : isFull ? 'Mesa Lotada' : 'Entrar na Mesa 🃏'}
                    </button>
                  </div>
                );
              })
            ) : rooms.length === 0 ? (
              <div className="text-center py-10 text-orange-300/60 font-cinzel text-sm">
                Nenhuma taverna aberta no momento. Crie a primeira mesa de blefe em tempo real!
              </div>
            ) : (
              rooms.map((room) => {
                const isFull = room.playerNames.length >= room.maxPlayers;
                const isInside = room.playerNames.some(p => p.toLowerCase() === username.toLowerCase());
                return (
                  <div
                    key={room.id}
                    className="p-3 rounded-xl bg-[#250d09] border border-orange-500/30 flex items-center justify-between hover:border-amber-400 transition-all shadow-md"
                  >
                    <div>
                      <div className="font-cinzel font-black text-sm text-white flex items-center gap-2">
                        <span>{room.name}</span>
                        {room.status === 'aberta' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            ABERTA
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-orange-200/70 mt-1 flex items-center gap-3">
                        <span>Host: <strong className="text-amber-400">{room.host}</strong></span>
                        <span>·</span>
                        <span>Jogadores: <strong className="text-emerald-400">{room.playerNames.length}/{room.maxPlayers}</strong></span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleJoinRoom(room)}
                      disabled={isFull && !isInside}
                      className="btn-gold py-1.5 px-4 text-xs font-bold"
                    >
                      {isInside ? 'Retornar à Sala 😈' : isFull ? 'Sala Lotada' : 'Entrar na Sala 🃏'}
                    </button>
                  </div>
                );
              })
            )}
          </div>"""

content = content.replace(old_lobby_rooms, new_lobby_rooms)

# 2. In create modal submit button, connect to handleCriarSalaLiarsFS
content = content.replace(
    'onClick={handleCreateRoom}\n              className="btn-gold flex-1 py-2 text-xs"',
    'onClick={() => { if (newRoomName.trim()) { handleCriarSalaLiarsFS(); } else { handleCreateRoom(); } }}\n              className="btn-gold flex-1 py-2 text-xs"'
)

# 3. In WAITING screen, add invite code badge and connect start game
old_waiting_header = """          {/* Waiting Room Header */}
          <div className="flex items-center justify-between border-b border-orange-500/30 pb-2">
            <div>
              <span className="text-xs text-orange-400 font-bold uppercase tracking-wider block">Sala de Espera</span>
              <h2 className="font-cinzel text-base sm:text-lg font-black text-amber-300">
                {activeRoom?.name || 'Mesa do Liar\\'s Bar'}
              </h2>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddPlayerOrBot}
                disabled={(activeRoom?.playerNames.length || 0) >= 5}
                className="btn-dark text-xs py-1.5 px-3 flex items-center gap-1 border-amber-500/40 text-amber-300"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Personagem</span>
              </button>

              <button
                onClick={() => {
                  setActiveRoom(null);
                  setGameState('ROOMS_LOBBY');
                }}
                className="btn-dark text-xs py-1.5 px-3 text-red-300 border-red-500/40"
              >
                Sair da Sala
              </button>
            </div>
          </div>"""

new_waiting_header = """          {/* Waiting Room Header with Real-Time Invite Code */}
          <div className="flex flex-wrap items-center justify-between border-b border-orange-500/30 pb-2 gap-2">
            <div>
              <span className="text-xs text-orange-400 font-bold uppercase tracking-wider block">Sala de Espera (Multiplayer Real)</span>
              <h2 className="font-cinzel text-base sm:text-lg font-black text-amber-300 flex items-center gap-2">
                <span>{salaAtivaFirestore ? salaAtivaFirestore.nomeSala : (activeRoom?.name || 'Mesa do Liar\\'s Bar')}</span>
                {salaAtivaFirestore && (
                  <button
                    onClick={handleCopiarConviteLiarsFS}
                    title="Copiar código de convite para compartilhar com amigos"
                    className="px-2.5 py-0.5 rounded-lg bg-[#280c08] border border-amber-500/50 hover:bg-[#38110b] text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow"
                  >
                    <Copy className="w-3 h-3 text-amber-400" />
                    <span>Convite: <strong>{salaAtivaFirestore.codigoConvite}</strong></span>
                    {conviteCopiado && <span className="text-emerald-400 font-bold ml-1">✓ Copiado!</span>}
                  </button>
                )}
              </h2>
            </div>

            <div className="flex gap-2">
              {!salaAtivaFirestore && (
                <button
                  onClick={handleAddPlayerOrBot}
                  disabled={(activeRoom?.playerNames.length || 0) >= 5}
                  className="btn-dark text-xs py-1.5 px-3 flex items-center gap-1 border-amber-500/40 text-amber-300"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Personagem</span>
                </button>
              )}

              <button
                onClick={() => {
                  if (salaAtivaFirestore) {
                    handleSairSalaLiarsFS();
                  } else {
                    setActiveRoom(null);
                    setGameState('ROOMS_LOBBY');
                  }
                }}
                className="btn-dark text-xs py-1.5 px-3 text-red-300 border-red-500/40 flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair da Sala</span>
              </button>
            </div>
          </div>"""

content = content.replace(old_waiting_header, new_waiting_header)

# 4. In WAITING start button:
old_start_waiting_btn = """              <button
                onClick={handleStartRound}
                disabled={players.length < 2}
                className="btn-gold py-2.5 px-8 text-sm font-black flex items-center gap-2 shadow-xl"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Iniciar Mesa de Blefe ({players.length} Jogadores) 🍺</span>
              </button>"""

new_start_waiting_btn = """              {salaAtivaFirestore ? (
                salaAtivaFirestore.criadorId === auth.currentUser?.uid ? (
                  <button
                    onClick={handleIniciarPartidaLiarsFS}
                    disabled={salaAtivaFirestore.jogadores.length < 2}
                    className="btn-gold py-2.5 px-8 text-sm font-black flex items-center gap-2 shadow-xl"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Iniciar Mesa de Blefe ({salaAtivaFirestore.jogadores.length}/5 Jogadores) 🍺</span>
                  </button>
                ) : (
                  <div className="px-5 py-2.5 rounded-xl bg-[#200805] border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-2 animate-pulse">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Aguardando o anfitrião ({salaAtivaFirestore.criadorNome}) iniciar a mesa...</span>
                  </div>
                )
              ) : (
                <button
                  onClick={handleStartRound}
                  disabled={players.length < 2}
                  className="btn-gold py-2.5 px-8 text-sm font-black flex items-center gap-2 shadow-xl"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Iniciar Mesa de Blefe ({players.length} Jogadores) 🍺</span>
                </button>
              )}"""

content = content.replace(old_start_waiting_btn, new_start_waiting_btn)

with open('/app/applet/src/games/LiarsBarGame.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated LiarsBarGame.tsx with Firestore real-time UI and turn flow")
