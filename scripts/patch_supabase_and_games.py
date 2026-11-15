#!/usr/bin/env python3
import re

with open('sapecas-cassino.html', 'r', encoding='utf-8') as f:
    code = f.read()

# -------------------------------------------------------------
# 1. SUPABASE CLIENT & REALTIME SYNC LOGIC
# -------------------------------------------------------------
supabase_engine_js = '''
  <!-- Supabase Realtime Backend Integration -->
  <script>
    /**
     * CONFIGURAÇÕES DO SUPABASE REALTIME
     * As constantes abaixo podem ser pré-configuradas aqui ou inseridas diretamente na interface
     * através do botão "⚡ Supabase" no cabeçalho.
     */
    let SUPABASE_URL = localStorage.getItem('sapecas_supabase_url') || 'https://xyzcompany.supabase.co';
    let SUPABASE_ANON_KEY = localStorage.getItem('sapecas_supabase_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';

    let supabaseClient = null;
    let supabaseChannel = null;
    let isSupabaseConnected = false;

    function initSupabase() {
      try {
        const storedUrl = localStorage.getItem('sapecas_supabase_url');
        const storedKey = localStorage.getItem('sapecas_supabase_key');
        if (storedUrl) SUPABASE_URL = storedUrl;
        if (storedKey) SUPABASE_ANON_KEY = storedKey;

        const isRealConfig = SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('xyzcompany') && SUPABASE_ANON_KEY.length > 20 && !SUPABASE_ANON_KEY.includes('dummy');

        if (window.supabase && typeof window.supabase.createClient === 'function' && isRealConfig) {
          supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false }
          });

          // Subscribe to Realtime Postgres Changes
          supabaseChannel = supabaseClient.channel('sapecas_multiplayer')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'estado_salas' }, (payload) => {
              handleRemoteEstadoSalasChange(payload);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'salas' }, (payload) => {
              handleRemoteSalasChange(payload);
            })
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                isSupabaseConnected = true;
                updateSupabaseUIStatus(true);
                syncRoomsFromSupabase();
              } else {
                updateSupabaseUIStatus(false);
              }
            });
        } else {
          updateSupabaseUIStatus(false);
        }
      } catch (err) {
        console.warn('Supabase fallback local ativado:', err);
        updateSupabaseUIStatus(false);
      }
    }

    function updateSupabaseUIStatus(connected) {
      isSupabaseConnected = connected;
      const indicator = document.getElementById('supabase-status-indicator');
      const text = document.getElementById('supabase-status-text');
      const badge = document.getElementById('supabase-modal-badge');
      const details = document.getElementById('supabase-modal-details');

      if (connected) {
        if (indicator) indicator.className = 'supabase-pulse-online';
        if (text) text.innerHTML = '⚡ Supabase (Online)';
        if (badge) {
          badge.style.background = '#065f46';
          badge.style.color = '#a7f3d0';
          badge.innerText = 'Online · Sincronizado via Realtime';
        }
        if (details) details.innerHTML = 'Conectado com sucesso ao Supabase! Salas e turnos sincronizados em tempo real entre celulares e PCs.';
      } else {
        if (indicator) indicator.className = 'supabase-pulse-local';
        if (text) text.innerHTML = '⚡ Supabase';
        if (badge) {
          badge.style.background = '#78350f';
          badge.style.color = '#fde68a';
          badge.innerText = 'Modo Local / Fallback Ativo';
        }
        if (details) details.innerHTML = 'Sincronização entre abas do navegador via Storage & Broadcast ativa. Para sincronizar entre celulares/PCs diferentes, insira as credenciais do seu projeto Supabase.';
      }
    }

    function openSupabaseModal() {
      const urlInput = document.getElementById('supabase-input-url');
      const keyInput = document.getElementById('supabase-input-key');
      if (urlInput) urlInput.value = localStorage.getItem('sapecas_supabase_url') || (SUPABASE_URL.includes('xyzcompany') ? '' : SUPABASE_URL);
      if (keyInput) keyInput.value = localStorage.getItem('sapecas_supabase_key') || (SUPABASE_ANON_KEY.includes('dummy') ? '' : SUPABASE_ANON_KEY);
      document.getElementById('supabase-modal').style.display = 'flex';
    }

    function closeSupabaseModal() {
      document.getElementById('supabase-modal').style.display = 'none';
    }

    function toggleSqlGuide() {
      const guide = document.getElementById('supabase-sql-guide');
      if (guide) guide.style.display = guide.style.display === 'none' ? 'block' : 'none';
    }

    function saveSupabaseCredentials() {
      const url = (document.getElementById('supabase-input-url').value || '').trim();
      const key = (document.getElementById('supabase-input-key').value || '').trim();

      if (!url || !key) {
        alert('Por favor preencha a URL e a Anon Key do Supabase!');
        return;
      }
      localStorage.setItem('sapecas_supabase_url', url);
      localStorage.setItem('sapecas_supabase_key', key);
      SUPABASE_URL = url;
      SUPABASE_ANON_KEY = key;

      initSupabase();
      alert('Credenciais salvas com sucesso! Tentando conexão com Supabase Realtime...');
      closeSupabaseModal();
    }

    function resetSupabaseCredentials() {
      if (confirm('Deseja resetar as credenciais do Supabase para o modo local?')) {
        localStorage.removeItem('sapecas_supabase_url');
        localStorage.removeItem('sapecas_supabase_key');
        SUPABASE_URL = 'https://xyzcompany.supabase.co';
        SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';
        if (supabaseChannel) {
          try { supabaseClient.removeChannel(supabaseChannel); } catch(e) {}
        }
        supabaseClient = null;
        updateSupabaseUIStatus(false);
        closeSupabaseModal();
      }
    }

    async function syncRoomsFromSupabase() {
      if (!supabaseClient || !isSupabaseConnected) return;
      try {
        const { data: remoteRooms, error } = await supabaseClient.from('salas').select('*');
        if (!error && remoteRooms && remoteRooms.length > 0) {
          const localRooms = DB.salas.getAll();
          remoteRooms.forEach(rr => {
            const idx = localRooms.findIndex(l => l.id === rr.id);
            const formatted = {
              id: rr.id,
              nomeSala: rr.nome_sala,
              jogo: rr.jogo,
              criadorId: rr.criador_id,
              jogadoresIds: rr.jogadores_ids || [],
              status: rr.status,
              dataCriacao: rr.data_criacao
            };
            if (idx >= 0) localRooms[idx] = formatted;
            else localRooms.push(formatted);
          });
          localStorage.setItem(DB_KEYS.SALAS, JSON.stringify(localRooms));
          if (activeGame === 'poker' || activeGame === 'liars-bar') {
            refreshActiveMultiplayerView();
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar salas do Supabase:', err);
      }
    }

    function handleRemoteSalasChange(payload) {
      syncRoomsFromSupabase();
    }

    function handleRemoteEstadoSalasChange(payload) {
      if (!payload || !payload.new) return;
      const salaId = payload.new.sala_id;
      const remoteState = payload.new.estado_jogo;
      if (!salaId || !remoteState) return;

      const all = DB.estadoSalas.getAll();
      all[salaId] = {
        salaId,
        estadoJogo: remoteState,
        ultimaAtualizacao: Date.now()
      };
      localStorage.setItem(DB_KEYS.ESTADO_SALAS, JSON.stringify(all));

      if ((activeGame === 'poker' && currentPokerRoomId === salaId) ||
          (activeGame === 'liars-bar' && currentLiarsRoomId === salaId)) {
        refreshActiveMultiplayerView();
      }
    }

    async function pushSalaToSupabase(sala) {
      if (!supabaseClient || !isSupabaseConnected) return;
      try {
        await supabaseClient.from('salas').upsert({
          id: sala.id,
          nome_sala: sala.nomeSala,
          jogo: sala.jogo,
          criador_id: sala.criadorId,
          jogadores_ids: sala.jogadoresIds,
          status: sala.status,
          data_criacao: sala.dataCriacao || new Date().toISOString()
        });
      } catch (e) {
        console.warn('Erro ao enviar sala para Supabase:', e);
      }
    }

    async function pushEstadoToSupabase(salaId, estadoJogo) {
      if (!supabaseClient || !isSupabaseConnected) return;
      try {
        await supabaseClient.from('estado_salas').upsert({
          sala_id: salaId,
          estado_jogo: estadoJogo,
          ultima_atualizacao: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Erro ao enviar estado_salas para Supabase:', e);
      }
    }

    function refreshActiveMultiplayerView() {
      const container = document.getElementById('main-content');
      if (!container) return;
      if (activeGame === 'poker') renderPoker(container);
      else if (activeGame === 'liars-bar') renderLiarsBar(container);
    }
  </script>
'''

if 'SUPABASE_URL = localStorage.getItem' not in code:
    code = code.replace('<!-- LocalStorage Accounts & Auth Logic & Relational DB Engine -->', supabase_engine_js + '\n  <!-- LocalStorage Accounts & Auth Logic & Relational DB Engine -->')

print("Supabase Engine inserted.")

# -------------------------------------------------------------
# 2. UPDATE DB.salas AND DB.estadoSalas TO PUSH TO SUPABASE
# -------------------------------------------------------------
# Update DB.salas.create
old_salas_create = """          list.unshift(newSala);
          this.saveAll(list);
          DB.estadoSalas.initRoomState(newSala.id, jogo, [criadorId]);
          return newSala;"""

new_salas_create = """          list.unshift(newSala);
          this.saveAll(list);
          DB.estadoSalas.initRoomState(newSala.id, jogo, [criadorId]);
          try { pushSalaToSupabase(newSala); } catch(e) {}
          return newSala;"""

if old_salas_create in code:
    code = code.replace(old_salas_create, new_salas_create)

# Update DB.salas.join
old_salas_join = """          this.saveAll(list);
          DB.estadoSalas.addPlayerToRoom(salaId, usuarioId);
          return { success: true, sala };"""

new_salas_join = """          this.saveAll(list);
          DB.estadoSalas.addPlayerToRoom(salaId, usuarioId);
          try { pushSalaToSupabase(sala); } catch(e) {}
          return { success: true, sala };"""

if old_salas_join in code:
    code = code.replace(old_salas_join, new_salas_join)

# Update DB.estadoSalas.set
old_estado_set = """          localStorage.setItem(DB_KEYS.ESTADO_SALAS, JSON.stringify(all));
          DB.broadcast('estadoSalas', 'update', { salaId });"""

new_estado_set = """          localStorage.setItem(DB_KEYS.ESTADO_SALAS, JSON.stringify(all));
          DB.broadcast('estadoSalas', 'update', { salaId });
          try { pushEstadoToSupabase(salaId, estadoJogo); } catch(e) {}"""

if old_estado_set in code:
    code = code.replace(old_estado_set, new_estado_set)

print("DB Supabase sync hooks patched.")

with open('sapecas-cassino.html', 'w', encoding='utf-8') as f:
    f.write(code)
print("Saved checkpoint 2.")
