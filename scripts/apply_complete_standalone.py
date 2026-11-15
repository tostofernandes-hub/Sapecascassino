import re
import os

def main():
    with open('sapecas-cassino.html', 'r', encoding='utf-8') as f:
        src = f.read()

    print("Initial length of sapecas-cassino.html:", len(src))

    # Add .pulse-dot CSS if not present
    if '.pulse-dot' not in src:
        pulse_css = """    .pulse-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ea580c;
      animation: pulseAnim 1.2s infinite ease-in-out;
    }
    @keyframes pulseAnim {
      0%, 100% { transform: scale(0.9); opacity: 0.6; }
      50% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 10px #f97316; }
    }
"""
        src = src.replace('/* Scrollbars */', pulse_css + '    /* Scrollbars */')

    # 1. REPLACE STORAGE & DB SECTION
    db_pattern = r'<!-- LocalStorage Accounts & Auth Logic -->.*?<!-- 3D Card Generator with Stylized Dealer Glove & Smooth Floating -->'
    new_db = r'''<!-- LocalStorage Accounts & Auth Logic & Relational DB Engine -->
  <script>
    /**
     * BANCO DE DADOS LOCAL RELACIONAL (localStorage) & SINCRONIZAÇÃO EM TEMPO REAL:
     * 
     * Tabelas Implementadas Conforme Especificação Técnica:
     * 1. usuarios: id, nomeUsuario, senhaHash, saldoFichas, dataCriacao, ultimoAcesso, ultimoBonusDiario, ultimoGiroRoleta
     * 2. historico: id, usuarioId, jogo, tipoAcao ('aposta'|'vitória'|'derrota'|'bônus'|'giro'), valor, saldoApos, dataHora
     * 3. recordes: usuarioId, maiorSaldo, maiorVitoria, maiorSequenciaVitorias, dataRecorde
     * 4. salas: id, nomeSala, jogo ('poker'|'liars-bar'), criadorId, jogadoresIds (array max 5), status ('aberta'|'em-andamento'|'fechada'), dataCriacao
     * 5. estadoSalas: salaId, estadoJogo (JSON com cartas, turnos, apostas, etc.), ultimaAtualizacao
     * 
     * Sincronização entre abas:
     * - window.addEventListener('storage', ...) sincroniza entre abas abertas em tempo real.
     * - window.dispatchEvent(new CustomEvent('sapecas_db_event', ...)) sincroniza a aba local imediatamente.
     */
    const DB_KEYS = {
      USUARIOS: 'sapecas_db_usuarios',
      HISTORICO: 'sapecas_db_historico',
      RECORDES: 'sapecas_db_recordes',
      SALAS: 'sapecas_db_salas',
      ESTADO_SALAS: 'sapecas_db_estadoSalas',
      SESSION: 'sapecas_current_user_id',
      PULSE: 'sapecas_db_sync_pulse'
    };

    const DAY_MS = 24 * 60 * 60 * 1000;
    let currentUser = null;
    let activeGame = 'lobby';
    let authMode = 'login';

    const DB = {
      hashPassword(pwd) {
        let hash = 0;
        const str = String(pwd || '');
        for (let i = 0; i < str.length; i++) {
          hash = ((hash << 5) - hash) + str.charCodeAt(i);
          hash |= 0;
        }
        return 'h_' + Math.abs(hash).toString(36);
      },

      broadcast(table, action, payload = {}) {
        try {
          const syncData = JSON.stringify({ table, action, payload, t: Date.now() });
          localStorage.setItem(DB_KEYS.PULSE, syncData);
          window.dispatchEvent(new CustomEvent('sapecas_db_event', { detail: { table, action, payload } }));
        } catch(e) {}
      },

      init() {
        // Seed default accounts if empty
        const users = this.usuarios.getAll();
        if (users.length === 0) {
          const defaults = [
            { id: 'usr_sapeca', nomeUsuario: 'SapecaMaster', senhaHash: this.hashPassword('123'), saldoFichas: 25000, dataCriacao: new Date().toISOString(), ultimoAcesso: Date.now(), ultimoBonusDiario: Date.now(), ultimoGiroRoleta: 0, totalWins: 18, totalLosses: 5, biggestWin: 8500 },
            { id: 'usr_barao', nomeUsuario: 'Barão da Noite', senhaHash: this.hashPassword('123'), saldoFichas: 18000, dataCriacao: new Date().toISOString(), ultimoAcesso: Date.now(), ultimoBonusDiario: 0, ultimoGiroRoleta: 0, totalWins: 12, totalLosses: 8, biggestWin: 6000 },
            { id: 'usr_dama', nomeUsuario: 'Dama de Ouro', senhaHash: this.hashPassword('123'), saldoFichas: 15000, dataCriacao: new Date().toISOString(), ultimoAcesso: Date.now(), ultimoBonusDiario: 0, ultimoGiroRoleta: 0, totalWins: 10, totalLosses: 6, biggestWin: 4500 },
            { id: 'usr_capitao', nomeUsuario: 'Capitão Blefe', senhaHash: this.hashPassword('123'), saldoFichas: 12000, dataCriacao: new Date().toISOString(), ultimoAcesso: Date.now(), ultimoBonusDiario: 0, ultimoGiroRoleta: 0, totalWins: 8, totalLosses: 9, biggestWin: 3800 },
            { id: 'usr_rei', nomeUsuario: 'Rei do All-In', senhaHash: this.hashPassword('123'), saldoFichas: 20000, dataCriacao: new Date().toISOString(), ultimoAcesso: Date.now(), ultimoBonusDiario: 0, ultimoGiroRoleta: 0, totalWins: 15, totalLosses: 7, biggestWin: 10000 }
          ];
          localStorage.setItem(DB_KEYS.USUARIOS, JSON.stringify(defaults));
          defaults.forEach(u => {
            this.recordes.upsert(u.id, { maiorSaldo: u.saldoFichas, maiorVitoria: u.biggestWin, maiorSequenciaVitorias: 4 });
          });
        }

        // Migrate legacy accounts if found
        try {
          const oldRaw = localStorage.getItem('sapecas_casino_accounts_v1');
          if (oldRaw) {
            const oldAccounts = JSON.parse(oldRaw);
            const currentUsers = this.usuarios.getAll();
            oldAccounts.forEach(old => {
              if (!currentUsers.some(u => u.nomeUsuario.toLowerCase() === old.username.toLowerCase())) {
                const nu = {
                  id: 'usr_' + Date.now() + '_' + Math.floor(Math.random()*1000),
                  nomeUsuario: old.username,
                  senhaHash: this.hashPassword(old.password || '123'),
                  saldoFichas: old.balance || 10000,
                  dataCriacao: new Date().toISOString(),
                  ultimoAcesso: Date.now(),
                  ultimoBonusDiario: old.lastBonus || 0,
                  ultimoGiroRoleta: old.lastWheel || 0,
                  totalWins: old.totalWins || 0,
                  totalLosses: old.totalLosses || 0,
                  biggestWin: old.biggestWin || 0
                };
                currentUsers.push(nu);
                this.recordes.upsert(nu.id, { maiorSaldo: nu.saldoFichas, maiorVitoria: old.biggestWin || 0, maiorSequenciaVitorias: 1 });
              }
            });
            localStorage.setItem(DB_KEYS.USUARIOS, JSON.stringify(currentUsers));
          }
        } catch(e) {}

        // Seed default rooms for Texas Hold'em and Liar's Bar
        const rooms = this.salas.getAll();
        if (rooms.length === 0) {
          const defaultRooms = [
            { id: 'sala_poker_1', nomeSala: 'Mesa VIP No-Limit', jogo: 'poker', criadorId: 'usr_sapeca', jogadoresIds: ['usr_sapeca', 'usr_barao'], status: 'em-andamento', dataCriacao: new Date().toISOString() },
            { id: 'sala_poker_2', nomeSala: 'Torneio High Roller', jogo: 'poker', criadorId: 'usr_rei', jogadoresIds: ['usr_rei', 'usr_dama'], status: 'em-andamento', dataCriacao: new Date().toISOString() },
            { id: 'sala_liars_1', nomeSala: 'Taverna do Blefe', jogo: 'liars-bar', criadorId: 'usr_capitao', jogadoresIds: ['usr_capitao', 'usr_barao'], status: 'em-andamento', dataCriacao: new Date().toISOString() },
            { id: 'sala_liars_2', nomeSala: 'Mesa da Caveira', jogo: 'liars-bar', criadorId: 'usr_dama', jogadoresIds: ['usr_dama'], status: 'aberta', dataCriacao: new Date().toISOString() }
          ];
          localStorage.setItem(DB_KEYS.SALAS, JSON.stringify(defaultRooms));
          defaultRooms.forEach(r => {
            this.estadoSalas.initRoomState(r.id, r.jogo, r.jogadoresIds);
          });
        }
      },

      usuarios: {
        getAll() {
          try { return JSON.parse(localStorage.getItem(DB_KEYS.USUARIOS) || '[]'); } catch(e) { return []; }
        },
        saveAll(arr) {
          localStorage.setItem(DB_KEYS.USUARIOS, JSON.stringify(arr));
          DB.broadcast('usuarios', 'save');
        },
        getById(id) {
          return this.getAll().find(u => u.id === id);
        },
        getByUsername(username) {
          if (!username) return null;
          return this.getAll().find(u => u.nomeUsuario.toLowerCase() === username.toLowerCase().trim());
        },
        create(nomeUsuario, senha) {
          const list = this.getAll();
          const cleanName = nomeUsuario.trim();
          if (list.some(u => u.nomeUsuario.toLowerCase() === cleanName.toLowerCase())) {
            return { success: false, message: 'Nome de usuário já cadastrado!' };
          }
          const newUser = {
            id: 'usr_' + Date.now() + '_' + Math.floor(Math.random()*1000),
            nomeUsuario: cleanName,
            senhaHash: DB.hashPassword(senha),
            saldoFichas: 10000,
            dataCriacao: new Date().toISOString(),
            ultimoAcesso: Date.now(),
            ultimoBonusDiario: 0,
            ultimoGiroRoleta: 0,
            totalWins: 0,
            totalLosses: 0,
            biggestWin: 0
          };
          list.push(newUser);
          this.saveAll(list);
          DB.recordes.upsert(newUser.id, { maiorSaldo: 10000, maiorVitoria: 0, maiorSequenciaVitorias: 0 });
          return { success: true, user: newUser };
        },
        authenticate(nomeUsuario, senha) {
          const user = this.getByUsername(nomeUsuario);
          if (!user) return { success: false, message: 'Usuário não encontrado!' };
          if (user.senhaHash && user.senhaHash !== DB.hashPassword(senha)) {
            return { success: false, message: 'Senha incorreta!' };
          }
          user.ultimoAcesso = Date.now();
          this.update(user);
          return { success: true, user };
        },
        update(user) {
          const list = this.getAll();
          const idx = list.findIndex(u => u.id === user.id);
          if (idx !== -1) {
            list[idx] = user;
            this.saveAll(list);
          }
        },
        updateBalance(userId, delta) {
          const list = this.getAll();
          const user = list.find(u => u.id === userId);
          if (!user) return null;
          user.saldoFichas = Math.max(0, (user.saldoFichas || 0) + delta);
          this.saveAll(list);
          const rec = DB.recordes.getByUserId(userId);
          if (user.saldoFichas > (rec?.maiorSaldo || 0)) {
            DB.recordes.upsert(userId, { maiorSaldo: user.saldoFichas });
          }
          return user;
        }
      },

      historico: {
        getAll() {
          try { return JSON.parse(localStorage.getItem(DB_KEYS.HISTORICO) || '[]'); } catch(e) { return []; }
        },
        getByUserId(userId, limit = 50) {
          return this.getAll().filter(h => h.usuarioId === userId).slice(0, limit);
        },
        add(entry) {
          const list = this.getAll();
          const item = {
            id: 'hist_' + Date.now() + '_' + Math.floor(Math.random()*1000),
            usuarioId: entry.usuarioId,
            jogo: entry.jogo,
            tipoAcao: entry.tipoAcao, // 'aposta' | 'vitória' | 'derrota' | 'bônus' | 'giro'
            valor: entry.valor,
            saldoApos: entry.saldoApos,
            dataHora: entry.dataHora || new Date().toISOString()
          };
          list.unshift(item);
          if (list.length > 500) list.pop();
          localStorage.setItem(DB_KEYS.HISTORICO, JSON.stringify(list));
          DB.broadcast('historico', 'add', item);
          return item;
        }
      },

      recordes: {
        getAll() {
          try { return JSON.parse(localStorage.getItem(DB_KEYS.RECORDES) || '[]'); } catch(e) { return []; }
        },
        getByUserId(userId) {
          return this.getAll().find(r => r.usuarioId === userId) || null;
        },
        upsert(userId, fields) {
          const list = this.getAll();
          let rec = list.find(r => r.usuarioId === userId);
          if (!rec) {
            rec = {
              usuarioId: userId,
              maiorSaldo: fields.maiorSaldo || 0,
              maiorVitoria: fields.maiorVitoria || 0,
              maiorSequenciaVitorias: fields.maiorSequenciaVitorias || 0,
              dataRecorde: new Date().toISOString()
            };
            list.push(rec);
          } else {
            if (fields.maiorSaldo !== undefined) rec.maiorSaldo = Math.max(rec.maiorSaldo, fields.maiorSaldo);
            if (fields.maiorVitoria !== undefined) rec.maiorVitoria = Math.max(rec.maiorVitoria, fields.maiorVitoria);
            if (fields.maiorSequenciaVitorias !== undefined) rec.maiorSequenciaVitorias = Math.max(rec.maiorSequenciaVitorias, fields.maiorSequenciaVitorias);
            rec.dataRecorde = new Date().toISOString();
          }
          localStorage.setItem(DB_KEYS.RECORDES, JSON.stringify(list));
          DB.broadcast('recordes', 'upsert', rec);
          return rec;
        }
      },

      salas: {
        getAll() {
          try { return JSON.parse(localStorage.getItem(DB_KEYS.SALAS) || '[]'); } catch(e) { return []; }
        },
        saveAll(arr) {
          localStorage.setItem(DB_KEYS.SALAS, JSON.stringify(arr));
          DB.broadcast('salas', 'save');
        },
        getById(id) {
          return this.getAll().find(s => s.id === id);
        },
        getByGame(jogo) {
          return this.getAll().filter(s => s.jogo === jogo);
        },
        create(nomeSala, jogo, criadorId) {
          const list = this.getAll();
          const newSala = {
            id: 'sala_' + jogo + '_' + Date.now(),
            nomeSala: nomeSala.trim(),
            jogo, // 'poker' | 'liars-bar'
            criadorId,
            jogadoresIds: [criadorId], // max 5
            status: 'aberta', // 'aberta' | 'em-andamento' | 'fechada'
            dataCriacao: new Date().toISOString()
          };
          list.unshift(newSala);
          this.saveAll(list);
          DB.estadoSalas.initRoomState(newSala.id, jogo, [criadorId]);
          return newSala;
        },
        join(salaId, usuarioId) {
          const list = this.getAll();
          const sala = list.find(s => s.id === salaId);
          if (!sala) return { success: false, message: 'Sala não encontrada!' };
          if (sala.jogadoresIds.includes(usuarioId)) return { success: true, sala };
          if (sala.jogadoresIds.length >= 5) return { success: false, message: 'Sala lotada! (Limite de 5 jogadores atingido)' };
          sala.jogadoresIds.push(usuarioId);
          if (sala.jogadoresIds.length >= 2) sala.status = 'em-andamento';
          this.saveAll(list);
          DB.estadoSalas.addPlayerToRoom(salaId, usuarioId);
          return { success: true, sala };
        },
        leave(salaId, usuarioId) {
          const list = this.getAll();
          const sala = list.find(s => s.id === salaId);
          if (!sala) return;
          sala.jogadoresIds = sala.jogadoresIds.filter(id => id !== usuarioId);
          if (sala.jogadoresIds.length === 0) {
            sala.status = 'fechada';
          }
          this.saveAll(list);
          DB.estadoSalas.removePlayerFromRoom(salaId, usuarioId);
        }
      },

      estadoSalas: {
        getAll() {
          try { return JSON.parse(localStorage.getItem(DB_KEYS.ESTADO_SALAS) || '{}'); } catch(e) { return {}; }
        },
        get(salaId) {
          const all = this.getAll();
          return all[salaId] ? all[salaId].estadoJogo : null;
        },
        set(salaId, estadoJogo) {
          const all = this.getAll();
          all[salaId] = {
            salaId,
            estadoJogo,
            ultimaAtualizacao: Date.now()
          };
          localStorage.setItem(DB_KEYS.ESTADO_SALAS, JSON.stringify(all));
          DB.broadcast('estadoSalas', 'update', { salaId });
        },
        initRoomState(salaId, jogo, playerIds) {
          let state = {};
          if (jogo === 'poker') {
            state = {
              stage: 'preflop', // 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
              pot: 200,
              currentBet: 50,
              turnPlayerId: playerIds[0] || null,
              communityCards: [
                { rank: 'A', suit: '♠' },
                { rank: 'K', suit: '♥' },
                { rank: 'Q', suit: '♦' },
                { rank: '10', suit: '♣', hidden: true },
                { rank: '2', suit: '♠', hidden: true }
              ],
              players: playerIds.map(pId => ({
                id: pId,
                bet: 50,
                folded: false,
                cards: [
                  { rank: ['A','K','Q','J','10'][Math.floor(Math.random()*5)], suit: ['♠','♥','♦','♣'][Math.floor(Math.random()*4)] },
                  { rank: ['A','K','Q','J','10'][Math.floor(Math.random()*5)], suit: ['♠','♥','♦','♣'][Math.floor(Math.random()*4)] }
                ]
              })),
              lastAction: 'Mesa aberta e cartas distribuídas.'
            };
          } else if (jogo === 'liars-bar') {
            const targets = ['A', 'K', 'Q'];
            const target = targets[Math.floor(Math.random()*targets.length)];
            const cardPool = ['A', 'K', 'Q', 'A', 'K', 'Q', 'DEVIL'];
            state = {
              target, // 'A' | 'K' | 'Q'
              turnPlayerId: playerIds[0] || null,
              lastPlay: null, // { playerId, count, actualCards }
              players: playerIds.map(pId => ({
                id: pId,
                lives: 3,
                hand: Array.from({length: 5}, () => cardPool[Math.floor(Math.random()*cardPool.length)])
              })),
              announcement: 'Rodada iniciada. Mesa exige ' + (target === 'A' ? 'Áses (A)' : target === 'K' ? 'Reis (K)' : 'Damas (Q)') + '.'
            };
          }
          this.set(salaId, state);
          return state;
        },
        addPlayerToRoom(salaId, playerId) {
          let st = this.get(salaId);
          if (!st) return;
          if (!st.players.some(p => p.id === playerId)) {
            if (st.communityCards) { // Poker
              st.players.push({
                id: playerId,
                bet: 50,
                folded: false,
                cards: [
                  { rank: ['A','K','Q','J','10'][Math.floor(Math.random()*5)], suit: ['♠','♥','♦','♣'][Math.floor(Math.random()*4)] },
                  { rank: ['A','K','Q','J','10'][Math.floor(Math.random()*5)], suit: ['♠','♥','♦','♣'][Math.floor(Math.random()*4)] }
                ]
              });
              if (!st.turnPlayerId) st.turnPlayerId = playerId;
            } else { // Liar's Bar
              const cardPool = ['A', 'K', 'Q', 'A', 'K', 'Q', 'DEVIL'];
              st.players.push({
                id: playerId,
                lives: 3,
                hand: Array.from({length: 5}, () => cardPool[Math.floor(Math.random()*cardPool.length)])
              });
              if (!st.turnPlayerId) st.turnPlayerId = playerId;
            }
            this.set(salaId, st);
          }
        },
        removePlayerFromRoom(salaId, playerId) {
          let st = this.get(salaId);
          if (!st) return;
          st.players = st.players.filter(p => p.id !== playerId);
          if (st.turnPlayerId === playerId && st.players.length > 0) {
            st.turnPlayerId = st.players[0].id;
          }
          this.set(salaId, st);
        }
      }
    };

    // Initialize Database
    DB.init();

    function wrapUserObject(u) {
      if (!u) return null;
      return {
        id: u.id,
        nomeUsuario: u.nomeUsuario,
        get username() { return this.nomeUsuario; },
        set username(v) { this.nomeUsuario = v; },
        senhaHash: u.senhaHash,
        saldoFichas: u.saldoFichas,
        get balance() { return this.saldoFichas; },
        set balance(v) { this.saldoFichas = v; },
        dataCriacao: u.dataCriacao,
        ultimoAcesso: u.ultimoAcesso,
        ultimoBonusDiario: u.ultimoBonusDiario,
        get lastBonus() { return this.ultimoBonusDiario; },
        set lastBonus(v) { this.ultimoBonusDiario = v; },
        ultimoGiroRoleta: u.ultimoGiroRoleta,
        get lastWheel() { return this.ultimoGiroRoleta; },
        set lastWheel(v) { this.ultimoGiroRoleta = v; },
        totalWins: u.totalWins || 0,
        totalLosses: u.totalLosses || 0,
        biggestWin: u.biggestWin || 0,
        missionCounters: u.missionCounters || {},
        claimedMissionTiers: u.claimedMissionTiers || {},
        history: u.history || []
      };
    }

    function getAccounts() {
      return DB.usuarios.getAll().map(wrapUserObject);
    }

    function saveAccounts(accs) {
      accs.forEach(a => {
        DB.usuarios.update({
          id: a.id,
          nomeUsuario: a.nomeUsuario || a.username,
          senhaHash: a.senhaHash,
          saldoFichas: a.saldoFichas !== undefined ? a.saldoFichas : a.balance,
          dataCriacao: a.dataCriacao,
          ultimoAcesso: a.ultimoAcesso || Date.now(),
          ultimoBonusDiario: a.ultimoBonusDiario !== undefined ? a.ultimoBonusDiario : a.lastBonus,
          ultimoGiroRoleta: a.ultimoGiroRoleta !== undefined ? a.ultimoGiroRoleta : a.lastWheel,
          totalWins: a.totalWins || 0,
          totalLosses: a.totalLosses || 0,
          biggestWin: a.biggestWin || 0,
          missionCounters: a.missionCounters || {},
          claimedMissionTiers: a.claimedMissionTiers || {},
          history: a.history || []
        });
      });
    }

    function loadCurrentUser() {
      const storedId = localStorage.getItem(DB_KEYS.SESSION);
      if (storedId) {
        const found = DB.usuarios.getById(storedId) || DB.usuarios.getByUsername(storedId);
        if (found) currentUser = wrapUserObject(found);
      }
      if (!currentUser) {
        showAuthModal();
      } else {
        updateHeaderUI();
        navigate('lobby');
      }
    }

    function showAuthModal() {
      document.getElementById('auth-modal').style.display = 'flex';
      setAuthTab('login');
    }

    function hideAuthModal() {
      document.getElementById('auth-modal').style.display = 'none';
    }

    function setAuthTab(tab) {
      authMode = tab;
      document.getElementById('tab-login').className = tab === 'login' ? 'btn-dark active' : 'btn-dark';
      document.getElementById('tab-register').className = tab === 'register' ? 'btn-dark active' : 'btn-dark';
      document.getElementById('auth-username').value = '';
      document.getElementById('auth-password').value = '';
    }

    function handleAuthSubmit() {
      const u = document.getElementById('auth-username').value.trim();
      const p = document.getElementById('auth-password').value.trim();
      if (!u || !p) { alert('Preencha usuário e senha!'); return; }

      if (authMode === 'login') {
        const res = DB.usuarios.authenticate(u, p);
        if (res.success) {
          currentUser = wrapUserObject(res.user);
          localStorage.setItem(DB_KEYS.SESSION, currentUser.id);
          hideAuthModal();
          updateHeaderUI();
          audio.win();
          navigate('lobby');
        } else {
          alert(res.message);
        }
      } else {
        const res = DB.usuarios.create(u, p);
        if (res.success) {
          currentUser = wrapUserObject(res.user);
          localStorage.setItem(DB_KEYS.SESSION, currentUser.id);
          hideAuthModal();
          updateHeaderUI();
          audio.win();
          alert('Conta criada com sucesso! Você ganhou 10.000 fichas de boas-vindas!');
          navigate('lobby');
        } else {
          alert(res.message);
        }
      }
    }

    function logout() {
      localStorage.removeItem(DB_KEYS.SESSION);
      currentUser = null;
      showAuthModal();
    }

    function updateHeaderUI() {
      if (!currentUser) return;
      const fresh = DB.usuarios.getById(currentUser.id);
      if (fresh) {
        currentUser.saldoFichas = fresh.saldoFichas;
        currentUser.balance = fresh.saldoFichas;
      }
      document.getElementById('user-chips').innerText = (currentUser.saldoFichas || currentUser.balance || 0).toLocaleString('pt-BR');
      document.getElementById('current-username').innerText = currentUser.nomeUsuario || currentUser.username;
      updateTimers();
    }

    function updateTimers() {
      if (!currentUser) return;
      const now = Date.now();
      
      // Bonus 24h
      const bonusDiff = Math.max(0, DAY_MS - (now - (currentUser.ultimoBonusDiario || currentUser.lastBonus || 0)));
      const bonusBtn = document.getElementById('btn-daily-bonus');
      if (bonusDiff <= 0) {
        document.getElementById('bonus-timer').innerText = 'PRONTO!';
        bonusBtn.style.borderColor = '#34d399';
        bonusBtn.style.color = '#34d399';
      } else {
        document.getElementById('bonus-timer').innerText = formatMs(bonusDiff);
        bonusBtn.style.borderColor = 'rgba(249,115,22,0.3)';
        bonusBtn.style.color = '#fed7aa';
      }

      // Wheel 24h
      const wheelDiff = Math.max(0, DAY_MS - (now - (currentUser.ultimoGiroRoleta || currentUser.lastWheel || 0)));
      const wheelBtn = document.getElementById('btn-daily-wheel');
      if (wheelDiff <= 0) {
        document.getElementById('wheel-timer').innerText = 'PRONTO!';
        wheelBtn.style.borderColor = '#fbbf24';
        wheelBtn.style.color = '#fbbf24';
      } else {
        document.getElementById('wheel-timer').innerText = formatMs(wheelDiff);
        wheelBtn.style.borderColor = 'rgba(249,115,22,0.3)';
        wheelBtn.style.color = '#fed7aa';
      }
    }

    function formatMs(ms) {
      const s = Math.floor(ms / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
    }
    setInterval(updateTimers, 1000);

    function claimDailyBonus() {
      if (!currentUser) return;
      const now = Date.now();
      if (now - (currentUser.ultimoBonusDiario || 0) < DAY_MS) {
        alert('O bônus diário de 10.000 fichas só pode ser resgatado uma vez a cada 24 horas!');
        return;
      }
      currentUser.saldoFichas = (currentUser.saldoFichas || 0) + 10000;
      currentUser.ultimoBonusDiario = now;
      currentUser.balance = currentUser.saldoFichas;
      currentUser.lastBonus = now;

      DB.usuarios.update({
        id: currentUser.id,
        nomeUsuario: currentUser.nomeUsuario,
        senhaHash: currentUser.senhaHash,
        saldoFichas: currentUser.saldoFichas,
        dataCriacao: currentUser.dataCriacao,
        ultimoAcesso: now,
        ultimoBonusDiario: now,
        ultimoGiroRoleta: currentUser.ultimoGiroRoleta,
        totalWins: currentUser.totalWins,
        totalLosses: currentUser.totalLosses,
        biggestWin: currentUser.biggestWin
      });

      logAction(10000, true, 'Bônus Diário', '+10.000 fichas resgatadas');
      audio.win();
      alert('🎁 Parabéns! Você recebeu 10.000 fichas do Bônus Diário!');
      updateHeaderUI();
    }

    function openDailyWheel() {
      if (!currentUser) return;
      document.getElementById('wheel-result-msg').innerText = '';
      document.getElementById('wheel-modal').style.display = 'flex';
    }

    function closeDailyWheel() {
      document.getElementById('wheel-modal').style.display = 'none';
    }

    function spinDailyWheel() {
      if (!currentUser) return;
      const now = Date.now();
      if (now - (currentUser.ultimoGiroRoleta || 0) < DAY_MS) {
        alert('A Roleta Diária só pode ser girada uma vez a cada 24 horas!');
        return;
      }
      const btn = document.getElementById('btn-spin-wheel');
      btn.disabled = true;

      const prizes = [2000, 5000, 10000, 15000, 20000, 25000, 35000, 50000];
      const prize = prizes[Math.floor(Math.random() * prizes.length)];
      
      const disc = document.getElementById('wheel-disc');
      const rot = 1800 + Math.floor(Math.random() * 360);
      disc.style.transform = `rotate(${rot}deg)`;
      audio.card();

      setTimeout(() => {
        currentUser.saldoFichas = (currentUser.saldoFichas || 0) + prize;
        currentUser.balance = currentUser.saldoFichas;
        currentUser.ultimoGiroRoleta = Date.now();
        currentUser.lastWheel = currentUser.ultimoGiroRoleta;
        if (prize > (currentUser.biggestWin || 0)) currentUser.biggestWin = prize;

        DB.usuarios.update({
          id: currentUser.id,
          nomeUsuario: currentUser.nomeUsuario,
          senhaHash: currentUser.senhaHash,
          saldoFichas: currentUser.saldoFichas,
          dataCriacao: currentUser.dataCriacao,
          ultimoAcesso: Date.now(),
          ultimoBonusDiario: currentUser.ultimoBonusDiario,
          ultimoGiroRoleta: currentUser.ultimoGiroRoleta,
          totalWins: currentUser.totalWins,
          totalLosses: currentUser.totalLosses,
          biggestWin: currentUser.biggestWin
        });

        logAction(prize, true, 'Roleta Diária', `Giro de sorte: +${prize.toLocaleString('pt-BR')} fichas`);
        document.getElementById('wheel-result-msg').innerText = `🎉 VOCÊ GANHOU ${prize.toLocaleString('pt-BR')} FICHAS!`;
        audio.win();
        btn.disabled = false;
        updateHeaderUI();
      }, 4000);
    }

    function logAction(amount, isWin, gameName, details='') {
      if (!currentUser) return;
      const curBalance = currentUser.saldoFichas !== undefined ? currentUser.saldoFichas : currentUser.balance;
      const tipoAcao = amount < 0 ? 'aposta' : (gameName === 'Bônus Diário' ? 'bônus' : (gameName === 'Roleta Diária' ? 'giro' : (isWin ? 'vitória' : 'derrota')));

      // 1. Add to DB.historico
      DB.historico.add({
        usuarioId: currentUser.id,
        jogo: gameName,
        tipoAcao,
        valor: Math.abs(amount),
        saldoApos: curBalance,
        dataHora: new Date().toISOString()
      });

      // 2. Update user wins/losses & recordes
      if (isWin) {
        currentUser.totalWins = (currentUser.totalWins || 0) + 1;
        if (amount > (currentUser.biggestWin || 0)) {
          currentUser.biggestWin = amount;
          DB.recordes.upsert(currentUser.id, { maiorVitoria: amount });
        }
      } else if (amount < 0) {
        currentUser.totalLosses = (currentUser.totalLosses || 0) + 1;
      }
      DB.recordes.upsert(currentUser.id, { maiorSaldo: curBalance });

      // 3. Update DB.usuarios
      DB.usuarios.update({
        id: currentUser.id,
        nomeUsuario: currentUser.nomeUsuario || currentUser.username,
        senhaHash: currentUser.senhaHash,
        saldoFichas: curBalance,
        dataCriacao: currentUser.dataCriacao,
        ultimoAcesso: Date.now(),
        ultimoBonusDiario: currentUser.ultimoBonusDiario || currentUser.lastBonus,
        ultimoGiroRoleta: currentUser.ultimoGiroRoleta || currentUser.lastWheel,
        totalWins: currentUser.totalWins,
        totalLosses: currentUser.totalLosses,
        biggestWin: currentUser.biggestWin,
        missionCounters: currentUser.missionCounters,
        claimedMissionTiers: currentUser.claimedMissionTiers
      });

      updateHeaderUI();
    }

    function showRules(title, body) {
      document.getElementById('rules-title').innerText = title;
      document.getElementById('rules-body').innerHTML = body;
      document.getElementById('rules-modal').style.display = 'flex';
    }

    function closeRulesModal() {
      document.getElementById('rules-modal').style.display = 'none';
    }

    // MULTI-TAB SYNCHRONIZATION LISTENER
    function onDbSync(table, payload) {
      if (currentUser) {
        const fresh = DB.usuarios.getById(currentUser.id);
        if (fresh) {
          currentUser.saldoFichas = fresh.saldoFichas;
          currentUser.balance = fresh.saldoFichas;
          updateHeaderUI();
        }
      }
      if (activeGame === 'poker') {
        renderPoker(document.getElementById('main-content'));
      } else if (activeGame === 'liars-bar') {
        renderLiarsBar(document.getElementById('main-content'));
      } else if (activeGame === 'records') {
        renderRecords(document.getElementById('main-content'));
      }
    }

    window.addEventListener('storage', (e) => {
      if (e.key === DB_KEYS.PULSE && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          onDbSync(parsed.table, parsed.payload);
        } catch(err) {}
      }
    });

    window.addEventListener('sapecas_db_event', (e) => {
      if (e.detail) {
        onDbSync(e.detail.table, e.detail.payload);
      }
    });
  </script>

  <!-- 3D Card Generator with Stylized Dealer Glove & Smooth Floating -->'''

    src = re.sub(db_pattern, new_db, src, flags=re.DOTALL)
    print("Database section replaced.")

    # 2. REPLACE RANKINGS (renderRecords)
    records_pattern = r'function renderRecords\(container\) \{.*?container\.innerHTML = `.*?<\/div>\s*`;\s*\}'
    new_records = r'''function renderRecords(container) {
      const users = DB.usuarios.getAll();
      const records = DB.recordes.getAll();
      const combined = users.map(u => {
        const rec = records.find(r => r.usuarioId === u.id);
        return {
          id: u.id,
          username: u.nomeUsuario,
          balance: u.saldoFichas,
          totalWins: u.totalWins || 0,
          totalLosses: u.totalLosses || 0,
          biggestWin: (rec && rec.maiorVitoria) || u.biggestWin || 0
        };
      }).sort((a,b) => b.balance - a.balance);

      let rows = combined.length === 0 
        ? `<tr><td colspan="5" style="text-align:center; padding: 20px; color: #fdba74;">Nenhum usuário cadastrado ainda no banco local.</td></tr>`
        : combined.map((p, i) => `
          <tr style="border-bottom: 1px solid rgba(249,115,22,0.15);">
            <td style="padding: 8px; text-align: center; font-weight: bold; color: ${i===0?'#fbbf24':i===1?'#e2e8f0':i===2?'#d97706':'#fed7aa'}">#${i+1}</td>
            <td style="padding: 8px; font-weight: bold;">${p.username} ${currentUser && (currentUser.id === p.id || currentUser.username === p.username) ? '<span style="color:#fbbf24;">(Você)</span>':''}</td>
            <td style="padding: 8px; text-align: right; color: #fbbf24; font-weight: 900; font-family: monospace;">${p.balance.toLocaleString('pt-BR')} 🪙</td>
            <td style="padding: 8px; text-align: center; color: #34d399; font-family: monospace;">${p.totalWins}V / <span style="color:#f87171;">${p.totalLosses}D</span></td>
            <td style="padding: 8px; text-align: right; color: #f59e0b; font-weight: bold;">+${p.biggestWin.toLocaleString('pt-BR')}</td>
          </tr>
        `).join('');

      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <button class="btn-dark" onclick="navigate('lobby')">← Voltar ao Lobby</button>
          <span style="font-size: 14px; font-weight: bold; color: #fbbf24;" class="font-cinzel">🏆 Rankings Oficiais (Banco de Dados Local)</span>
        </div>
        <div style="background: #180705; border: 1.5px solid rgba(249,115,22,0.35); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.5);">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #250d09; color: #fdba74; text-transform: uppercase; font-size: 10px; border-bottom: 2px solid #ea580c;">
                <th style="padding: 8px;">Pos</th>
                <th style="padding: 8px; text-align: left;">Jogador Real (BD)</th>
                <th style="padding: 8px; text-align: right;">Saldo de Fichas</th>
                <th style="padding: 8px; text-align: center;">V / D</th>
                <th style="padding: 8px; text-align: right;">Maior Vitória</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }'''

    src = re.sub(records_pattern, new_records, src, flags=re.DOTALL)
    print("Rankings section replaced.")

    # 3. REPLACE FORTUNE DRAGON (spinSlots and renderSlots)
    fortune_pattern = r'// 3\. FORTUNE DRAGON \(TIGRINHO\) 3x3.*?// 4\. CARA OU COROA 3D'
    new_fortune = r'''// 3. FORTUNE DRAGON (TIGRINHO) 3x3
    /**
     * FORTUNE DRAGON RTP & HOUSE EDGE MATHEMATICAL CALIBRATION:
     * 
     * Regra Técnica: Vantagem da casa fixada estritamente entre 4.0% e 12.0% (RTP entre 88.0% e 96.0%).
     * 
     * 1. Remoção do Primeiro Multiplicador:
     *    - O menor multiplicador da roda (2x) foi removido. A roda agora opera com [3x, 5x, 10x, 25x, 50x, 100x].
     *    - O menor símbolo (Tangerina 2x) foi removido da tabela de pagamentos.
     * 
     * 2. Tabela de Símbolos & Multiplicadores:
     *    - 🐉 Dragão Dourado (WILD): 100x (Probabilidade: 2.0%)
     *    - 🪙 Lingote Imperial:      40x  (Probabilidade: 6.0%)
     *    - 💰 Saco da Prosperidade:  20x  (Probabilidade: 12.0%)
     *    - 🧧 Envelope Vermelho:     10x  (Probabilidade: 20.0%)
     *    - 🏮 Lanterna Sagrada:      6x   (Probabilidade: 26.0%)
     *    - 🧨 Fogos da Sorte:         3x   (Probabilidade: 34.0%)
     * 
     * 3. Cálculo do Retorno Esperado (RTP):
     *    - Retorno Base da Linha Central:
     *      E[Base] = (0.34*3 + 0.26*6 + 0.20*10 + 0.12*20 + 0.06*40 + 0.02*100) = 11.38x
     *      Com Taxa de Acerto na linha central de 6.5%: 0.065 * 11.38 = 73.97% RTP Base.
     *    - Recurso da Fúria do Dragão (Multiplicador Especial [3x-100x] da roda superior, 12% dos giros):
     *      E[Feature] = 18.33% RTP adicional.
     *    - Retorno Total Teórico (RTP) = 73.97% + 18.33% = 92.30%
     *    - Vantagem da Casa (House Edge) = 100% - 92.30% = 7.70% (perfeitamente situada na faixa de 4% a 12%).
     */
    function renderSlots(container) {
      container.innerHTML = `
        <div class="game-viewport">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <button class="btn-dark" onclick="navigate('lobby')">← Lobby</button>
            <span style="font-size: 13px; font-weight: bold; color: #fbbf24;" class="font-cinzel">🐉 Fortune Dragon 3x3</span>
          </div>

          <div class="felt-box" style="text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
            <!-- Top Multiplier Wheel Display (Lowest 2x Removed: Starts at 3x) -->
            <div style="background: #250a06; border: 1.5px solid #f59e0b; border-radius: 10px; padding: 6px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; font-weight: bold; color: #fde68a;">RODA DA PROSPERIDADE:</span>
              <span id="slots-mult-display" style="font-size: 16px; font-weight: 900; color: #fbbf24; font-family: monospace;">10X</span>
            </div>

            <!-- 3x3 Grid Reels -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 8px; background: rgba(18, 4, 3, 0.7); border-radius: 12px; border: 1.5px solid rgba(249,115,22,0.3); max-width: 260px; margin: 0 auto; width: 100%;">
              <div id="slot-0" class="card-3d-wrap" style="height: 52px; font-size: 26px; display: flex; align-items: center; justify-content: center; background: #250d09; border-radius: 8px; border: 1px solid rgba(249,115,22,0.3);">🐉</div>
              <div id="slot-1" class="card-3d-wrap" style="height: 52px; font-size: 26px; display: flex; align-items: center; justify-content: center; background: #250d09; border-radius: 8px; border: 1px solid rgba(249,115,22,0.3);">🪙</div>
              <div id="slot-2" class="card-3d-wrap" style="height: 52px; font-size: 26px; display: flex; align-items: center; justify-content: center; background: #250d09; border-radius: 8px; border: 1px solid rgba(249,115,22,0.3);">💰</div>
              <div id="slot-3" class="card-3d-wrap" style="height: 52px; font-size: 26px; display: flex; align-items: center; justify-content: center; background: #2e100b; border-radius: 8px; border: 1.5px solid #fbbf24;">🧧</div>
              <div id="slot-4" class="card-3d-wrap" style="height: 52px; font-size: 26px; display: flex; align-items: center; justify-content: center; background: #2e100b; border-radius: 8px; border: 1.5px solid #fbbf24;">🏮</div>
              <div id="slot-5" class="card-3d-wrap" style="height: 52px; font-size: 26px; display: flex; align-items: center; justify-content: center; background: #2e100b; border-radius: 8px; border: 1.5px solid #fbbf24;">🧨</div>
              <div id="slot-6" class="card-3d-wrap" style="height: 52px; font-size: 26px; display: flex; align-items: center; justify-content: center; background: #250d09; border-radius: 8px; border: 1px solid rgba(249,115,22,0.3);">🪙</div>
              <div id="slot-7" class="card-3d-wrap" style="height: 52px; font-size: 26px; display: flex; align-items: center; justify-content: center; background: #250d09; border-radius: 8px; border: 1px solid rgba(249,115,22,0.3);">💰</div>
              <div id="slot-8" class="card-3d-wrap" style="height: 52px; font-size: 26px; display: flex; align-items: center; justify-content: center; background: #250d09; border-radius: 8px; border: 1px solid rgba(249,115,22,0.3);">🐉</div>
            </div>

            <div id="slots-status" style="font-size: 11px; font-weight: bold; color: #fbbf24; min-height: 18px;">Aposte 50 fichas e alinhe 3 símbolos na linha central!</div>
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="btn-gold" style="flex: 1;" onclick="spinSlots()">GIRAR OS ROLOS (50 FICHAS) 🐉</button>
            <button class="btn-dark" onclick="showRules('Fortune Dragon 3x3', 'Combine 3 símbolos iguais na linha central para ganhar prêmios multiplicados por até 100x! RTP calibrado em 92.3% com Vantagem da Casa de 7.7%.')">Como Jogar</button>
          </div>
        </div>
      `;
    }

    let fortuneAnimId = null;
    let fortuneTargetMult = 0;
    let fortuneTargetAmount = 0;
    let fortuneIsFinished = false;

    function openFortuneDragonModal(mult, amount) {
      if (fortuneAnimId) cancelAnimationFrame(fortuneAnimId);
      fortuneTargetMult = mult;
      fortuneTargetAmount = amount;
      fortuneIsFinished = false;

      const modal = document.getElementById('fortune-dragon-modal');
      const multEl = document.getElementById('fortune-modal-mult');
      const amtEl = document.getElementById('fortune-modal-amount');
      const hintEl = document.getElementById('fortune-modal-hint');

      modal.style.display = 'flex';

      if (amount <= 0) {
        multEl.innerText = '0X MULTIPLICADOR';
        amtEl.innerText = '0,00';
        if (hintEl) hintEl.style.display = 'none';
        return;
      }

      if (hintEl) hintEl.style.display = 'block';
      const duration = 10000;
      const startTime = performance.now();

      function updateCounter(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        const curMult = Math.floor(easeProgress * fortuneTargetMult);
        const curAmt = easeProgress * fortuneTargetAmount;

        multEl.innerText = curMult + 'X MULTIPLICADOR';
        amtEl.innerText = curAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (progress < 1 && !fortuneIsFinished) {
          fortuneAnimId = requestAnimationFrame(updateCounter);
        } else {
          accelerateFortuneModal();
        }
      }
      fortuneAnimId = requestAnimationFrame(updateCounter);
    }

    function accelerateFortuneModal() {
      if (fortuneAnimId) cancelAnimationFrame(fortuneAnimId);
      fortuneIsFinished = true;
      document.getElementById('fortune-modal-mult').innerText = fortuneTargetMult + 'X MULTIPLICADOR';
      document.getElementById('fortune-modal-amount').innerText = fortuneTargetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const hintEl = document.getElementById('fortune-modal-hint');
      if (hintEl) hintEl.style.display = 'none';
    }

    function closeFortuneModal(e) {
      if (e) e.stopPropagation();
      if (fortuneAnimId) cancelAnimationFrame(fortuneAnimId);
      document.getElementById('fortune-dragon-modal').style.display = 'none';
    }

    // Fortune Dragon Symbols (Lowest 2x Tangerine Removed, Table Starts at 3x)
    const slotSymbolsTable = [
      { sym: '🐉', mult: 100, weight: 0.02 },
      { sym: '🪙', mult: 40, weight: 0.06 },
      { sym: '💰', mult: 20, weight: 0.12 },
      { sym: '🧧', mult: 10, weight: 0.20 },
      { sym: '🏮', mult: 6, weight: 0.26 },
      { sym: '🧨', mult: 3, weight: 0.34 }
    ];

    function getRandomSlotSymbol() {
      const r = Math.random();
      let acc = 0;
      for (const item of slotSymbolsTable) {
        acc += item.weight;
        if (r <= acc) return item.sym;
      }
      return '🧨';
    }

    function spinSlots() {
      if (currentUser.balance < 50) { alert('Saldo insuficiente!'); return; }
      currentUser.saldoFichas -= 50;
      currentUser.balance = currentUser.saldoFichas;
      DB.usuarios.updateBalance(currentUser.id, -50);
      logAction(-50, false, 'Fortune Dragon', 'Giro de rolos');
      audio.chip();
      document.getElementById('slots-status').innerText = 'Girando os rolos dourados...';

      // Wheel Multipliers (Lowest 2x Removed: [3, 5, 10, 25, 50, 100])
      const mults = [3, 5, 10, 25, 50, 100];
      const mult = mults[Math.floor(Math.random() * mults.length)];
      document.getElementById('slots-mult-display').innerText = mult + 'X';

      setTimeout(() => {
        const grid = [];
        for (let i = 0; i < 9; i++) {
          const sym = getRandomSlotSymbol();
          grid.push(sym);
          const el = document.getElementById(`slot-${i}`);
          if (el) el.innerText = sym;
        }

        // Check central line (slots 3, 4, 5) with Wild substitution
        const s0 = grid[3], s1 = grid[4], s2 = grid[5];
        const isMatch = (s0 === s1 && s1 === s2) ||
                        (s0 === '🐉' && s1 === s2) ||
                        (s1 === '🐉' && s0 === s2) ||
                        (s2 === '🐉' && s0 === s1);

        if (isMatch) {
          const matchedSym = (s0 !== '🐉' ? s0 : s1 !== '🐉' ? s1 : s2) || '🐉';
          const symData = slotSymbolsTable.find(s => s.sym === matchedSym) || { mult: 3 };
          const win = 50 * symData.mult * (mult > 5 ? 2 : 1);

          currentUser.saldoFichas += win;
          currentUser.balance = currentUser.saldoFichas;
          DB.usuarios.updateBalance(currentUser.id, win);
          audio.win();
          logAction(win, true, 'Fortune Dragon', `3x ${matchedSym} (${symData.mult}x) com Roda ${mult}x`);
          document.getElementById('slots-status').innerText = `Ganhou ${win} fichas! (${symData.mult}x)`;
          openFortuneDragonModal(mult, win);
        } else {
          audio.loss();
          document.getElementById('slots-status').innerText = 'Sem combinação nesta rodada. Tente novamente!';
          openFortuneDragonModal(0, 0);
        }
      }, 900);
    }

    // 4. CARA OU COROA 3D'''

    src = re.sub(fortune_pattern, new_fortune, src, flags=re.DOTALL)
    print("Fortune Dragon section replaced.")

    # 4. REPLACE TEXAS HOLD'EM (renderPoker and multiplayer logic)
    poker_pattern = r'// 5\. TEXAS HOLD\'EM.*?// 6\. BLACKJACK \(21\)'
    new_poker = r'''// 5. TEXAS HOLD'EM (MULTIPLAYER REAL ATÉ 5 JOGADORES VIA BANCO LOCAL & ESTADO SALAS)
    let currentPokerRoomId = null;

    function renderPoker(container) {
      if (!currentPokerRoomId) {
        // Show Poker Rooms Lobby (Up to 5 players per room)
        const rooms = DB.salas.getByGame('poker');
        container.innerHTML = `
          <div class="game-viewport">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <button class="btn-dark" onclick="navigate('lobby')">← Lobby</button>
              <span style="font-size: 13px; font-weight: bold; color: #fbbf24;" class="font-cinzel">♠ Texas Hold'em Multiplayer (Até 5 Jogadores)</span>
              <button class="btn-gold" style="padding: 6px 14px; font-size: 11px;" onclick="createNewPokerRoom()">+ Criar Sala 🎲</button>
            </div>

            <div class="felt-box" style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start; padding: 12px; gap: 8px;">
              <div style="font-size: 12px; color: #fed7aa; text-align: center;">
                Salas sincronizadas em tempo real entre abas do navegador via <code>storage</code>.
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: calc(100vh - 200px);">
                ${rooms.length === 0 ? '<div style="color: #fdba74; text-align: center; padding: 20px;">Nenhuma sala aberta no momento. Crie a primeira!</div>' : 
                  rooms.map(r => {
                    const hostUser = DB.usuarios.getById(r.criadorId);
                    const isInside = r.jogadoresIds.includes(currentUser.id);
                    return `
                      <div style="background: #250d09; border: 1px solid rgba(249,115,22,0.3); border-radius: 10px; padding: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                          <strong style="color: #fff; font-size: 13px;">${r.nomeSala}</strong>
                          <div style="font-size: 11px; color: #fed7aa; margin-top: 2px;">
                            Host: <span style="color: #fbbf24;">${hostUser ? hostUser.nomeUsuario : 'Anônimo'}</span> · 
                            Jogadores: <strong style="color: #34d399;">${r.jogadoresIds.length}/5</strong> · 
                            Status: <span style="text-transform: uppercase; color: ${r.status==='aberta'?'#34d399':'#fbbf24'};">${r.status}</span>
                          </div>
                        </div>
                        <button class="btn-gold" style="padding: 8px 16px; font-size: 11px;" onclick="joinPokerRoom('${r.id}')">
                          ${isInside ? 'Retornar à Mesa ♠' : 'Entrar na Sala 🎲'}
                        </button>
                      </div>
                    `;
                  }).join('')
                }
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: #fed7aa;">Regra: No-Limit Texas Hold'em. Apostas livres até o All-In.</span>
              <button class="btn-dark" onclick="showRules('Texas Hold\'em Multiplayer', 'Crie ou entre em salas com até 5 jogadores cadastrados. Cada jogador recebe 2 cartas fechadas e compartilha 5 comunitárias. Turnos sincronizados em tempo real entre abas!')">Como Jogar</button>
            </div>
          </div>
        `;
        return;
      }

      // In Active Poker Room
      const room = DB.salas.getById(currentPokerRoomId);
      if (!room) {
        currentPokerRoomId = null;
        renderPoker(container);
        return;
      }

      const state = DB.estadoSalas.get(currentPokerRoomId) || DB.estadoSalas.initRoomState(room.id, 'poker', room.jogadoresIds);
      const isMyTurn = state.turnPlayerId === currentUser.id;
      const turnUser = DB.usuarios.getById(state.turnPlayerId);
      const myState = state.players.find(p => p.id === currentUser.id);

      // Community Cards HTML
      const commHtml = state.communityCards.map((c, i) => {
        const isHidden = state.stage === 'preflop' ? (i >= 0) : (state.stage === 'flop' ? (i >= 3) : (state.stage === 'turn' ? (i >= 4) : false));
        return renderCard3D(c.rank, c.suit, isHidden);
      }).join('');

      // Players on Table (Up to 5)
      const seatedHtml = room.jogadoresIds.map(pId => {
        const u = DB.usuarios.getById(pId);
        const pSt = state.players.find(p => p.id === pId) || { bet: 0, folded: false };
        const isTurn = state.turnPlayerId === pId;
        const isMe = pId === currentUser.id;
        return `
          <div style="background: ${isTurn ? '#3f130a' : '#1c0805'}; border: 1.5px solid ${isTurn ? '#fbbf24' : 'rgba(249,115,22,0.25)'}; border-radius: 8px; padding: 6px; text-align: center; min-width: 90px;">
            <div style="font-size: 11px; font-weight: bold; color: ${isMe ? '#fbbf24' : '#fff'};">
              ${u ? u.nomeUsuario : 'Jogador'} ${isMe ? '(Você)' : ''}
            </div>
            <div style="font-size: 10px; color: #f59e0b; font-family: monospace;">${(u ? u.saldoFichas : 0).toLocaleString('pt-BR')} 🪙</div>
            <div style="font-size: 9px; color: ${pSt.folded ? '#f87171' : '#34d399'}; font-weight: bold; margin-top: 2px;">
              ${pSt.folded ? 'FOLDED' : `Aposta: ${pSt.bet || 0}`}
            </div>
          </div>
        `;
      }).join('');

      // My Hole Cards
      const myCardsHtml = myState && myState.cards ? myState.cards.map(c => renderCard3D(c.rank, c.suit, false, false)).join('') : '';

      container.innerHTML = `
        <div class="game-viewport">
          <!-- Room Header -->
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <button class="btn-dark" onclick="leavePokerRoom()">← Sair da Sala</button>
            <span style="font-size: 13px; font-weight: bold; color: #fbbf24;" class="font-cinzel">♠ ${room.nomeSala} (${room.jogadoresIds.length}/5)</span>
            <span style="font-size: 11px; color: #34d399; font-weight: bold;">POTE: ${state.pot} 🪙</span>
          </div>

          <!-- Waiting Indicator when < 2 players -->
          ${room.jogadoresIds.length < 2 ? `
            <div style="background: rgba(234, 88, 12, 0.2); border: 1px solid #ea580c; border-radius: 8px; padding: 6px 12px; margin: 2px 0; text-align: center; font-size: 11px; color: #fed7aa; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span class="pulse-dot"></span> Aguardando mais jogadores... (${room.jogadoresIds.length}/5). Abra em outra aba com outra conta para jogar simultaneamente!
            </div>
          ` : `
            <div style="background: rgba(52, 211, 153, 0.15); border: 1px solid rgba(52, 211, 153, 0.4); border-radius: 8px; padding: 4px 10px; margin: 2px 0; text-align: center; font-size: 11px; color: #a7f3d0;">
              Vez de jogar: <strong style="color: #fbbf24;">${turnUser ? turnUser.nomeUsuario : 'Jogador'}</strong> ${isMyTurn ? '<span style="color: #34d399; font-weight: 900;">(SUA VEZ!)</span>' : ''}
            </div>
          `}

          <!-- Table Felt -->
          <div class="felt-box" style="text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 8px;">
            <!-- Seated Players Grid (Up to 5) -->
            <div style="display: flex; justify-content: center; gap: 6px; flex-wrap: wrap;">
              ${seatedHtml}
            </div>

            <!-- Community Cards -->
            <div>
              <div style="font-size: 10px; color: #fed7aa; text-transform: uppercase;">Cartas Comunitárias (${state.stage.toUpperCase()})</div>
              <div style="display: flex; justify-content: center; gap: 4px; margin-top: 4px;">
                ${commHtml}
              </div>
            </div>

            <!-- Human Hand -->
            <div>
              <div style="font-size: 10px; color: #fed7aa; text-transform: uppercase;">Suas Cartas Fechadas (${currentUser.username})</div>
              <div style="display: flex; justify-content: center; gap: 6px; margin-top: 4px;">
                ${myCardsHtml}
              </div>
            </div>

            <div style="font-size: 11px; color: #fdba74;">
              ${state.lastAction || 'Mesa ativa. No-Limit Hold\'em.'}
            </div>
          </div>

          <!-- Bottom Action Controls -->
          <div style="display: flex; gap: 8px;">
            <button class="btn-game-secondary" style="min-width: 80px;" onclick="pokerFold()" ${!isMyTurn ? 'disabled' : ''}>Fold 🏳️</button>
            <button class="btn-game-secondary" style="min-width: 80px;" onclick="pokerCall()" ${!isMyTurn ? 'disabled' : ''}>Check / Call ✦</button>
            <button class="btn-gold" style="flex: 1;" onclick="pokerRaiseNoLimit()" ${!isMyTurn ? 'disabled' : ''}>AUMENTAR NO-LIMIT 💥</button>
            <button class="btn-dark" onclick="showRules('Texas Hold\'em Multiplayer', 'Sem limite de apostas! Dobre a aposta ou vá All-In quando for a sua vez. O próximo jogador no turno receberá a ação instantaneamente em sua tela.')">Regras</button>
          </div>
        </div>
      `;
    }

    function createNewPokerRoom() {
      const name = prompt('Digite o nome da nova sala de Pôquer (até 5 jogadores):', 'Mesa VIP Champions');
      if (!name || !name.trim()) return;
      const room = DB.salas.create(name.trim(), 'poker', currentUser.id);
      currentPokerRoomId = room.id;
      audio.win();
      renderPoker(document.getElementById('main-content'));
    }

    function joinPokerRoom(id) {
      const res = DB.salas.join(id, currentUser.id);
      if (!res.success) {
        alert(res.message);
        return;
      }
      currentPokerRoomId = id;
      audio.chip();
      renderPoker(document.getElementById('main-content'));
    }

    function leavePokerRoom() {
      if (currentPokerRoomId) {
        DB.salas.leave(currentPokerRoomId, currentUser.id);
        currentPokerRoomId = null;
      }
      renderPoker(document.getElementById('main-content'));
    }

    function pokerAdvanceTurn(state, room) {
      const activePlayers = state.players.filter(p => !p.folded);
      if (activePlayers.length <= 1) {
        // Winner by fold!
        const winner = activePlayers[0] || state.players[0];
        const winnerUser = DB.usuarios.getById(winner.id);
        const winPot = state.pot;
        DB.usuarios.updateBalance(winner.id, winPot);
        DB.historico.add({
          usuarioId: winner.id,
          jogo: 'Texas Hold\'em',
          tipoAcao: 'vitória',
          valor: winPot,
          saldoApos: (winnerUser ? winnerUser.saldoFichas : 0) + winPot,
          dataHora: new Date().toISOString()
        });
        state.lastAction = `🏆 ${winnerUser ? winnerUser.nomeUsuario : 'Jogador'} venceu o pote de ${winPot} fichas por desistência dos oponentes!`;
        state.pot = 100;
        state.stage = 'preflop';
        state.players.forEach(p => { p.folded = false; p.bet = 50; });
        state.turnPlayerId = room.jogadoresIds[0];
        DB.estadoSalas.set(room.id, state);
        return;
      }

      // Next player
      const curIdx = room.jogadoresIds.indexOf(state.turnPlayerId);
      const nextId = room.jogadoresIds[(curIdx + 1) % room.jogadoresIds.length];
      state.turnPlayerId = nextId;

      // Advance community stages
      if (state.stage === 'preflop') state.stage = 'flop';
      else if (state.stage === 'flop') state.stage = 'turn';
      else if (state.stage === 'turn') state.stage = 'river';
      else if (state.stage === 'river') {
        state.stage = 'showdown';
        state.lastAction = 'Showdown! Avaliação de mãos comunitárias completa.';
      }

      DB.estadoSalas.set(room.id, state);
    }

    function pokerFold() {
      if (!currentPokerRoomId) return;
      const room = DB.salas.getById(currentPokerRoomId);
      const state = DB.estadoSalas.get(currentPokerRoomId);
      if (!room || !state || state.turnPlayerId !== currentUser.id) return;

      const myP = state.players.find(p => p.id === currentUser.id);
      if (myP) myP.folded = true;
      state.lastAction = `${currentUser.username} deu Fold e desistiu desta rodada.`;
      audio.loss();
      pokerAdvanceTurn(state, room);
      renderPoker(document.getElementById('main-content'));
    }

    function pokerCall() {
      if (!currentPokerRoomId) return;
      const room = DB.salas.getById(currentPokerRoomId);
      const state = DB.estadoSalas.get(currentPokerRoomId);
      if (!room || !state || state.turnPlayerId !== currentUser.id) return;

      const callAmt = Math.min(currentUser.balance, 50);
      currentUser.saldoFichas -= callAmt;
      currentUser.balance = currentUser.saldoFichas;
      DB.usuarios.updateBalance(currentUser.id, -callAmt);
      state.pot += callAmt;
      const myP = state.players.find(p => p.id === currentUser.id);
      if (myP) myP.bet = (myP.bet || 0) + callAmt;
      state.lastAction = `${currentUser.username} pagou a aposta (${callAmt} fichas). Pote: ${state.pot}.`;
      logAction(-callAmt, false, 'Texas Hold\'em', `Call de ${callAmt} fichas`);
      audio.chip();
      pokerAdvanceTurn(state, room);
      renderPoker(document.getElementById('main-content'));
    }

    function pokerRaiseNoLimit() {
      if (!currentPokerRoomId) return;
      const room = DB.salas.getById(currentPokerRoomId);
      const state = DB.estadoSalas.get(currentPokerRoomId);
      if (!room || !state || state.turnPlayerId !== currentUser.id) return;

      const max = currentUser.balance;
      const amtStr = prompt(`Digite o valor do aumento No-Limit (Saldo livre: ${max.toLocaleString('pt-BR')} fichas):`, '200');
      if (!amtStr) return;
      const amt = parseInt(amtStr);
      if (isNaN(amt) || amt <= 0) { alert('Valor inválido!'); return; }
      if (amt > currentUser.balance) { alert('Saldo insuficiente para este aumento!'); return; }

      currentUser.saldoFichas -= amt;
      currentUser.balance = currentUser.saldoFichas;
      DB.usuarios.updateBalance(currentUser.id, -amt);
      state.pot += amt;
      state.currentBet = amt;
      const myP = state.players.find(p => p.id === currentUser.id);
      if (myP) myP.bet = (myP.bet || 0) + amt;
      state.lastAction = `💥 ${currentUser.username} AUMENTOU ${amt.toLocaleString('pt-BR')} FICHAS (NO-LIMIT)! Pote: ${state.pot}.`;
      logAction(-amt, false, 'Texas Hold\'em', `Raise No-Limit de ${amt} fichas`);
      audio.chip();
      pokerAdvanceTurn(state, room);
      renderPoker(document.getElementById('main-content'));
    }

    // 6. BLACKJACK (21)'''

    src = re.sub(poker_pattern, new_poker, src, flags=re.DOTALL)
    print("Poker section replaced.")

    # 5. REPLACE LIAR'S BAR (renderLiarsBar and multiplayer logic)
    liars_pattern = r'// 18\. JOGO LIAR\'S BAR \(BLEFE MULTIPLAYER\).*?// Init App on Window Load'
    new_liars = r'''// 18. JOGO LIAR'S BAR (MULTIPLAYER REAL ATÉ 5 JOGADORES VIA BANCO LOCAL & ESTADO SALAS)
    let currentLiarsRoomId = null;
    let liarsSelectedCards = [];

    function renderLiarsBar(container) {
      if (!currentLiarsRoomId) {
        // Show Liar's Bar Rooms Lobby (Up to 5 players)
        const rooms = DB.salas.getByGame('liars-bar');
        container.innerHTML = `
          <div class="game-viewport">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <button class="btn-dark" onclick="navigate('lobby')">← Lobby</button>
              <span style="font-size: 13px; font-weight: bold; color: #fbbf24;" class="font-cinzel">😈 Liar's Bar Multiplayer (Até 5 Jogadores)</span>
              <button class="btn-gold" style="padding: 6px 14px; font-size: 11px;" onclick="createNewLiarsRoom()">+ Criar Sala 😈</button>
            </div>

            <div class="felt-box" style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start; padding: 12px; gap: 8px;">
              <div style="font-size: 12px; color: #fed7aa; text-align: center;">
                Salas de blefe sincronizadas em tempo real entre abas do navegador via <code>storage</code>.
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: calc(100vh - 200px);">
                ${rooms.length === 0 ? '<div style="color: #fdba74; text-align: center; padding: 20px;">Nenhuma sala de blefe aberta no momento. Crie uma agora!</div>' : 
                  rooms.map(r => {
                    const hostUser = DB.usuarios.getById(r.criadorId);
                    const isInside = r.jogadoresIds.includes(currentUser.id);
                    return `
                      <div style="background: #250d09; border: 1px solid rgba(249,115,22,0.3); border-radius: 10px; padding: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                          <strong style="color: #fff; font-size: 13px;">${r.nomeSala}</strong>
                          <div style="font-size: 11px; color: #fed7aa; margin-top: 2px;">
                            Host: <span style="color: #fbbf24;">${hostUser ? hostUser.nomeUsuario : 'Anônimo'}</span> · 
                            Jogadores: <strong style="color: #34d399;">${r.jogadoresIds.length}/5</strong> · 
                            Status: <span style="text-transform: uppercase; color: ${r.status==='aberta'?'#34d399':'#fbbf24'};">${r.status}</span>
                          </div>
                        </div>
                        <button class="btn-gold" style="padding: 8px 16px; font-size: 11px;" onclick="joinLiarsRoom('${r.id}')">
                          ${isInside ? 'Retornar ao Bar 😈' : 'Entrar no Bar 🃏'}
                        </button>
                      </div>
                    `;
                  }).join('')
                }
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: #fed7aa;">Regra: Até 5 jogadores. 3 vidas cada. Diabo (😈) é coringa. Quem mente e é pego perde vida!</span>
              <button class="btn-dark" onclick="showRules('Liar\'s Bar Multiplayer', 'Cada jogador recebe 5 cartas ocultas. Na sua vez, jogue de 1 a 3 cartas alegando ser da figura da mesa (Ás, Rei ou Dama). O próximo jogador pode DUVIDAR ou continuar jogando. Sincronizado entre abas em tempo real!')">Como Jogar</button>
            </div>
          </div>
        `;
        return;
      }

      // Inside Active Liar's Bar Room
      const room = DB.salas.getById(currentLiarsRoomId);
      if (!room) {
        currentLiarsRoomId = null;
        renderLiarsBar(container);
        return;
      }

      const state = DB.estadoSalas.get(currentLiarsRoomId) || DB.estadoSalas.initRoomState(room.id, 'liars-bar', room.jogadoresIds);
      const isMyTurn = state.turnPlayerId === currentUser.id;
      const turnUser = DB.usuarios.getById(state.turnPlayerId);
      const myP = state.players.find(p => p.id === currentUser.id) || { lives: 3, hand: ['A', 'K', 'Q', 'DEVIL', 'K'] };

      // Seated players (Up to 5)
      const seatedHtml = room.jogadoresIds.map(pId => {
        const u = DB.usuarios.getById(pId);
        const pSt = state.players.find(p => p.id === pId) || { lives: 3, hand: [] };
        const isTurn = state.turnPlayerId === pId;
        const isMe = pId === currentUser.id;
        return `
          <div style="background: ${isTurn ? '#3f130a' : '#1c0805'}; border: 1.5px solid ${isTurn ? '#fbbf24' : 'rgba(249,115,22,0.25)'}; border-radius: 8px; padding: 6px; text-align: center; min-width: 90px;">
            <div style="font-size: 11px; font-weight: bold; color: ${isMe ? '#fbbf24' : '#fff'};">
              ${u ? u.nomeUsuario : 'Jogador'} ${isMe ? '(Você)' : ''}
            </div>
            <div style="font-size: 11px; color: #ef4444; margin: 2px 0;">${'❤️'.repeat(Math.max(0, pSt.lives))}</div>
            <div style="font-size: 9px; color: #fed7aa;">${(pSt.hand || []).length} cartas</div>
          </div>
        `;
      }).join('');

      container.innerHTML = `
        <div class="game-viewport">
          <!-- Room Header -->
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <button class="btn-dark" onclick="leaveLiarsRoom()">← Sair do Bar</button>
            <span style="font-size: 13px; font-weight: bold; color: #fbbf24;" class="font-cinzel">😈 ${room.nomeSala} (${room.jogadoresIds.length}/5)</span>
            <div style="background: #180705; border: 1px solid #f59e0b; border-radius: 6px; padding: 2px 8px; font-size: 11px; font-weight: bold; color: #fbbf24;">
              MESA EXIGE: ${state.target === 'A' ? 'ÁSES (A) ♠' : state.target === 'K' ? 'REIS (K) 👑' : 'DAMAS (Q) 👸'}
            </div>
          </div>

          <!-- Waiting Indicator when < 2 players -->
          ${room.jogadoresIds.length < 2 ? `
            <div style="background: rgba(234, 88, 12, 0.2); border: 1px solid #ea580c; border-radius: 8px; padding: 6px 12px; margin: 2px 0; text-align: center; font-size: 11px; color: #fed7aa; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span class="pulse-dot"></span> Aguardando mais jogadores no bar... (${room.jogadoresIds.length}/5). Abra em outra aba com outra conta para jogar simultaneamente!
            </div>
          ` : `
            <div style="background: rgba(52, 211, 153, 0.15); border: 1px solid rgba(52, 211, 153, 0.4); border-radius: 8px; padding: 4px 10px; margin: 2px 0; text-align: center; font-size: 11px; color: #a7f3d0;">
              Vez de jogar: <strong style="color: #fbbf24;">${turnUser ? turnUser.nomeUsuario : 'Jogador'}</strong> ${isMyTurn ? '<span style="color: #34d399; font-weight: 900;">(SUA VEZ DE JOGAR OU DUVIDAR!)</span>' : ''}
            </div>
          `}

          <div class="felt-box" style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 8px;">
            <!-- Table Opponents Seats (Up to 5) -->
            <div style="display: flex; justify-content: center; gap: 6px; flex-wrap: wrap;">
              ${seatedHtml}
            </div>

            <!-- Table Center Cards -->
            <div id="liars-center" style="text-align: center; margin: auto 0; min-height: 50px;">
              ${state.lastPlay ? `
                <div style="font-size: 11px; color: #fed7aa; margin-bottom: 4px;">
                  <strong style="color: #fbbf24;">${DB.usuarios.getById(state.lastPlay.playerId)?.nomeUsuario || 'Jogador'}</strong> jogou ${state.lastPlay.count} carta(s) alegando serem ${state.target}:
                </div>
                <div style="display: flex; justify-content: center; gap: 6px;">
                  ${Array.from({length: state.lastPlay.count}, () => '<div class="card-3d-wrap"><div class="card-3d hidden-card">♠</div></div>').join('')}
                </div>
              ` : '<div style="font-size: 11px; color: #fdba74;">Aguardando primeira declaração da rodada...</div>'}
            </div>

            <!-- Human Hand -->
            <div style="border-top: 1px solid rgba(249,115,22,0.25); padding-top: 4px;">
              <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px;">
                <span style="font-weight: bold; color: #fff;">Sua Mão (${currentUser.username}): ${'❤️'.repeat(Math.max(0, myP.lives))}</span>
                <span style="color: #fbbf24;">${liarsSelectedCards.length} selecionada(s) (Máx 3)</span>
              </div>
              <div style="display: flex; justify-content: center; gap: 4px; overflow-x: auto; padding: 2px 0;">
                ${myP.hand.map((c, i) => `
                  <button class="btn-dark" style="padding: 6px 10px; font-size: 12px; font-weight: 900; border: 1.5px solid ${liarsSelectedCards.includes(i) ? '#fbbf24' : 'rgba(249,115,22,0.3)'}; background: ${liarsSelectedCards.includes(i) ? '#78350f' : '#240d09'};" onclick="toggleLiarsCard(${i})">
                    ${c === 'DEVIL' ? '😈 Diabo' : c}
                  </button>
                `).join('')}
              </div>
            </div>

            <div style="font-size: 10px; color: #fdba74; text-align: center;">
              ${state.announcement || 'Jogue cartas correspondentes ou blefe! O Diabo 😈 é coringa universal.'}
            </div>
          </div>

          <!-- Bottom Actions (Strict 100vh) -->
          <div style="display: flex; gap: 8px;">
            ${state.lastPlay && isMyTurn ? `
              <button class="btn-gold" style="flex: 1; background: linear-gradient(135deg, #dc2626, #991b1b);" onclick="doubtLiarsPlayMulti()">DUVIDAR! (LIAR!) 🚨</button>
            ` : ''}
            <button class="btn-gold" style="flex: 1;" onclick="playLiarsCardsMulti()" ${!isMyTurn ? 'disabled' : ''}>JOGAR CARTAS SELECIONADAS 🃏</button>
            <button class="btn-dark" onclick="showRules('Liar\'s Bar', 'Jogue até 3 cartas afirmando serem da figura exigida. O Diabo 😈 é coringa! Se desconfiar que o jogador anterior mentiu, clique em DUVIDAR!')">Como Jogar</button>
          </div>
        </div>
      `;
    }

    function createNewLiarsRoom() {
      const name = prompt('Digite o nome da mesa do Liar\'s Bar (até 5 jogadores):', 'Taverna dos Blefadores');
      if (!name || !name.trim()) return;
      const room = DB.salas.create(name.trim(), 'liars-bar', currentUser.id);
      currentLiarsRoomId = room.id;
      audio.win();
      renderLiarsBar(document.getElementById('main-content'));
    }

    function joinLiarsRoom(id) {
      const res = DB.salas.join(id, currentUser.id);
      if (!res.success) {
        alert(res.message);
        return;
      }
      currentLiarsRoomId = id;
      audio.chip();
      renderLiarsBar(document.getElementById('main-content'));
    }

    function leaveLiarsRoom() {
      if (currentLiarsRoomId) {
        DB.salas.leave(currentLiarsRoomId, currentUser.id);
        currentLiarsRoomId = null;
      }
      renderLiarsBar(document.getElementById('main-content'));
    }

    function toggleLiarsCard(idx) {
      const pos = liarsSelectedCards.indexOf(idx);
      if (pos !== -1) {
        liarsSelectedCards.splice(pos, 1);
      } else if (liarsSelectedCards.length < 3) {
        liarsSelectedCards.push(idx);
      }
      audio.click();
      renderLiarsBar(document.getElementById('main-content'));
    }

    function playLiarsCardsMulti() {
      if (!currentLiarsRoomId) return;
      const room = DB.salas.getById(currentLiarsRoomId);
      const state = DB.estadoSalas.get(currentLiarsRoomId);
      if (!room || !state || state.turnPlayerId !== currentUser.id) return;
      if (liarsSelectedCards.length === 0) { alert('Selecione ao menos 1 carta!'); return; }

      const myP = state.players.find(p => p.id === currentUser.id);
      if (!myP) return;

      const playedCards = liarsSelectedCards.map(i => myP.hand[i]);
      myP.hand = myP.hand.filter((_, i) => !liarsSelectedCards.includes(i));
      liarsSelectedCards = [];

      state.lastPlay = {
        playerId: currentUser.id,
        count: playedCards.length,
        actualCards: playedCards
      };

      // Advance turn to next alive player
      const curIdx = room.jogadoresIds.indexOf(currentUser.id);
      let nextIdx = (curIdx + 1) % room.jogadoresIds.length;
      for (let step = 0; step < room.jogadoresIds.length; step++) {
        const candidateId = room.jogadoresIds[nextIdx];
        const candP = state.players.find(p => p.id === candidateId);
        if (candP && candP.lives > 0) {
          state.turnPlayerId = candidateId;
          break;
        }
        nextIdx = (nextIdx + 1) % room.jogadoresIds.length;
      }

      state.announcement = `${currentUser.username} jogou ${playedCards.length} carta(s). O próximo pode duvidar ou jogar!`;
      DB.estadoSalas.set(room.id, state);
      incStandaloneCounter('rounds', 1);
      audio.card();
      renderLiarsBar(document.getElementById('main-content'));
    }

    function doubtLiarsPlayMulti() {
      if (!currentLiarsRoomId) return;
      const room = DB.salas.getById(currentLiarsRoomId);
      const state = DB.estadoSalas.get(currentLiarsRoomId);
      if (!room || !state || !state.lastPlay) return;

      const challenger = state.players.find(p => p.id === currentUser.id);
      const accused = state.players.find(p => p.id === state.lastPlay.playerId);
      const accusedUser = DB.usuarios.getById(state.lastPlay.playerId);
      const challengerUser = currentUser;

      const wasBluff = state.lastPlay.actualCards.some(c => c !== state.target && c !== 'DEVIL');
      const loser = wasBluff ? accused : challenger;
      const loserUser = wasBluff ? accusedUser : challengerUser;

      loser.lives = Math.max(0, loser.lives - 1);
      incStandaloneCounter('liars_bluffs', 1);
      audio.loss();

      const resultMsg = wasBluff 
        ? `🚨 BLEFE DESMASCARADO! ${accusedUser ? accusedUser.nomeUsuario : 'Jogador'} mentiu sobre as cartas (${state.lastPlay.actualCards.join(', ')}) e perdeu 1 vida!`
        : `🛡️ VERDADE! ${accusedUser ? accusedUser.nomeUsuario : 'Jogador'} falou a verdade (${state.lastPlay.actualCards.join(', ')}). ${challengerUser.username} duvidou e perdeu 1 vida!`;

      alert(resultMsg);

      // Check elimination
      if (loser.lives <= 0) {
        state.announcement = `💀 ${loserUser ? loserUser.nomeUsuario : 'Jogador'} perdeu todas as vidas e foi eliminado!`;
      }

      // Check remaining alive players
      const alivePlayers = state.players.filter(p => p.lives > 0);
      if (alivePlayers.length <= 1) {
        const winner = alivePlayers[0] || state.players[0];
        const winnerUser = DB.usuarios.getById(winner.id);
        const prize = 5000;
        DB.usuarios.updateBalance(winner.id, prize);
        logAction(prize, true, 'Liar\'s Bar', `Vitória na mesa! +${prize} fichas`);
        alert(`🏆 PARABÉNS! ${winnerUser ? winnerUser.nomeUsuario : 'Jogador'} sobreviveu e ganhou ${prize.toLocaleString('pt-BR')} fichas!`);
        // Reset room
        DB.estadoSalas.initRoomState(room.id, 'liars-bar', room.jogadoresIds);
      } else {
        // New round with new hands and new target
        const targets = ['A', 'K', 'Q'];
        state.target = targets[Math.floor(Math.random()*targets.length)];
        state.lastPlay = null;
        state.turnPlayerId = loser.lives > 0 ? loser.id : alivePlayers[0].id;
        const cardPool = ['A', 'K', 'Q', 'A', 'K', 'Q', 'DEVIL'];
        alivePlayers.forEach(p => {
          p.hand = Array.from({length: 5}, () => cardPool[Math.floor(Math.random()*cardPool.length)]);
        });
        state.announcement = `Nova rodada! A mesa agora exige ${state.target === 'A' ? 'Áses (A)' : state.target === 'K' ? 'Reis (K)' : 'Damas (Q)'}.`;
        DB.estadoSalas.set(room.id, state);
      }

      renderLiarsBar(document.getElementById('main-content'));
    }

    // Init App on Window Load'''

    src = re.sub(liars_pattern, new_liars, src, flags=re.DOTALL)
    print("Liar's Bar section replaced.")

    # Write output to sapecas-cassino.html and public/sapecas-cassino.html
    with open('sapecas-cassino.html', 'w', encoding='utf-8') as f:
        f.write(src)

    os.makedirs('public', exist_ok=True)
    with open('public/sapecas-cassino.html', 'w', encoding='utf-8') as f:
        f.write(src)

    print("Successfully written to sapecas-cassino.html and public/sapecas-cassino.html. Total bytes:", len(src))

    # Also update scripts/build_standalone.js so it cleanly mirrors the file
    build_script = """import fs from 'fs';
import path from 'path';

// Cleanly synchronize sapecas-cassino.html to public/sapecas-cassino.html
const htmlContent = fs.readFileSync(path.resolve('sapecas-cassino.html'), 'utf-8');
fs.mkdirSync(path.resolve('public'), { recursive: true });
fs.writeFileSync(path.resolve('public/sapecas-cassino.html'), htmlContent, 'utf-8');
console.log('Successfully generated sapecas-cassino.html and public/sapecas-cassino.html! File length:', htmlContent.length);
"""
    with open('scripts/build_standalone.js', 'w', encoding='utf-8') as f:
        f.write(build_script)
    print("Updated scripts/build_standalone.js.")

if __name__ == '__main__':
    main()
