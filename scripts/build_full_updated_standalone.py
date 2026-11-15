#!/usr/bin/env python3
import os
import re

print("Starting standalone generator...")

with open('sapecas-cassino.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Ensure SQL comment at the very top
sql_comment = """<!--
================================================================================
  SAPECAS CASSINO — CONFIGURAÇÃO MULTIPLAYER REAL COM SUPABASE (BACKEND)
================================================================================

INSTRUÇÕES DE CONFIGURAÇÃO (OBRIGATÓRIO PARA MULTIPLAYER ENTRE DISPOSITIVOS):
1. Criar projeto gratuito em https://supabase.com.
2. Executar o script SQL abaixo no SQL Editor do seu projeto Supabase.
3. No painel do Supabase, ir em Database > Publications e confirmar que as tabelas
   'salas' e 'estado_salas' estão com Insert, Update e Delete habilitados para Realtime.
4. Copiar a URL do projeto e a chave anon (public) em Project Settings > API.
5. Colar esses valores nas constantes SUPABASE_URL e SUPABASE_ANON_KEY no código abaixo,
   ou configurá-los diretamente através do botão "⚡ Supabase" no cabeçalho do jogo.

--------------------------------------------------------------------------------
SCRIPT SQL COMPLETO (Executar no SQL Editor do Supabase):
--------------------------------------------------------------------------------

-- Habilitar extensão para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_usuario TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  saldo_fichas INT DEFAULT 10000,
  data_criacao TIMESTAMP DEFAULT NOW(),
  ultimo_acesso TIMESTAMP DEFAULT NOW(),
  ultimo_bonus_diario TIMESTAMP,
  ultimo_giro_roleta TIMESTAMP
);

-- Tabela de histórico
CREATE TABLE IF NOT EXISTS historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  jogo TEXT NOT NULL,
  tipo_acao TEXT NOT NULL,
  valor INT DEFAULT 0,
  saldo_apos INT DEFAULT 0,
  data_hora TIMESTAMP DEFAULT NOW()
);

-- Tabela de recordes
CREATE TABLE IF NOT EXISTS recordes (
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE PRIMARY KEY,
  maior_saldo INT DEFAULT 0,
  maior_vitoria INT DEFAULT 0,
  maior_sequencia_vitorias INT DEFAULT 0,
  data_recorde TIMESTAMP DEFAULT NOW()
);

-- Tabela de salas
CREATE TABLE IF NOT EXISTS salas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_sala TEXT NOT NULL,
  jogo TEXT NOT NULL CHECK (jogo IN ('poker', 'liars-bar')),
  criador_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  jogadores_ids UUID[] DEFAULT '{}',
  status TEXT DEFAULT 'aberta' CHECK (status IN ('aberta', 'em-andamento', 'fechada')),
  data_criacao TIMESTAMP DEFAULT NOW()
);

-- Tabela de estado das salas
CREATE TABLE IF NOT EXISTS estado_salas (
  sala_id UUID REFERENCES salas(id) ON DELETE CASCADE PRIMARY KEY,
  estado_jogo JSONB DEFAULT '{}',
  ultima_atualizacao TIMESTAMP DEFAULT NOW()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordes ENABLE ROW LEVEL SECURITY;
ALTER TABLE salas ENABLE ROW LEVEL SECURITY;
ALTER TABLE estado_salas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (acesso básico para o jogo funcionar com a chave anon)
DO $$ BEGIN
  CREATE POLICY "Usuarios visiveis para todos" ON usuarios FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Usuarios podem se cadastrar" ON usuarios FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Usuarios podem atualizar proprio perfil" ON usuarios FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Historico visivel para todos" ON historico FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Historico pode ser inserido" ON historico FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Recordes visiveis para todos" ON recordes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Recordes podem ser inseridos" ON recordes FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Recordes podem ser atualizados" ON recordes FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Salas visiveis para todos" ON salas FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Salas podem ser criadas" ON salas FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Salas podem ser atualizadas" ON salas FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Estado das salas visivel para todos" ON estado_salas FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Estado das salas pode ser inserido" ON estado_salas FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Estado das salas pode ser atualizado" ON estado_salas FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Grants explícitos para a chave anon (obrigatório no Supabase)
GRANT SELECT, INSERT, UPDATE ON usuarios TO anon, authenticated;
GRANT SELECT, INSERT ON historico TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON recordes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON salas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON estado_salas TO anon, authenticated;

-- Habilitar Realtime nas tabelas de salas e estado_salas
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE salas;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE estado_salas;
EXCEPTION WHEN others THEN NULL; END $$;
================================================================================
-->
"""

if not html.startswith('<!--\n================================================================================\n  SAPECAS CASSINO — CONFIGURAÇÃO MULTIPLAYER REAL'):
    # Remove any existing top comment if any
    html = re.sub(r'^<!--.*?-->\s*', '', html, flags=re.DOTALL)
    html = sql_comment + html

# 2. Add Supabase CDN script in head
if 'cdn.jsdelivr.net/npm/@supabase/supabase-js' not in html:
    html = html.replace('<meta name="description"', '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n  <meta name="description"')

# 3. Add CSS for Russian Roulette, Wounds, Gun Cylinder, and Supabase UI
extra_css = """
    /* --- RUSSIAN ROULETTE & LIAR'S BAR ANIMATIONS --- */
    @keyframes recoilImpact {
      0% { transform: scale(1) translateY(0); filter: drop-shadow(0 0 0 rgba(220,38,38,0)); }
      20% { transform: scale(0.92) translateY(-14px) rotate(-4deg); filter: drop-shadow(0 0 25px rgba(239,68,68,0.9)); }
      40% { transform: scale(1.05) translateY(6px) rotate(2deg); }
      60% { transform: scale(0.98) translateY(-3px) rotate(-1deg); }
      100% { transform: scale(1) translateY(0) rotate(0deg); }
    }
    .hit-recoil-1 {
      animation: recoilImpact 0.65s ease-out;
    }
    @keyframes severeRecoilImpact {
      0% { transform: scale(1) translateY(0); }
      15% { transform: scale(0.85) translateY(-25px) rotate(-8deg); filter: brightness(2) drop-shadow(0 0 35px #dc2626); }
      30% { transform: scale(1.1) translateY(12px) rotate(5deg); }
      50% { transform: scale(0.95) translateY(-8px) rotate(-3deg); }
      70% { transform: scale(1.02) translateY(4px) rotate(1deg); }
      100% { transform: scale(1) translateY(0); filter: brightness(0.85); }
    }
    .hit-recoil-2 {
      animation: severeRecoilImpact 0.85s ease-out;
    }

    @keyframes cylinderSpin {
      0% { transform: rotate(0deg); }
      70% { transform: rotate(1080deg); }
      85% { transform: rotate(1070deg); }
      100% { transform: rotate(1080deg); }
    }
    .cylinder-spinning {
      animation: cylinderSpin 1.4s cubic-bezier(0.12, 0.8, 0.32, 1) forwards;
    }

    @keyframes screenFlashBang {
      0% { background-color: rgba(239, 68, 68, 0.7); }
      100% { background-color: transparent; }
    }
    .screen-flash-red {
      animation: screenFlashBang 0.6s ease-out;
    }

    @keyframes bloodDripAnim {
      0% { transform: scaleY(0); opacity: 0; }
      50% { opacity: 1; }
      100% { transform: scaleY(1); opacity: 0.95; }
    }
    .blood-drip {
      transform-origin: top center;
      animation: bloodDripAnim 1.2s ease-out forwards;
    }

    /* Supabase Pulse Badge */
    .supabase-pulse-online {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
      animation: pulseAnim 1.4s infinite ease-in-out;
    }
    .supabase-pulse-local {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #f59e0b;
      box-shadow: 0 0 6px #f59e0b;
    }
"""

if 'recoilImpact' not in html:
    html = html.replace('</style>', extra_css + '\n  </style>')

# 4. Add Supabase button in Header
supabase_btn_html = """      <!-- Supabase Realtime Status Button -->
      <button id="btn-supabase-status" class="btn-dark" onclick="openSupabaseModal()" style="display: flex; align-items: center; gap: 5px; font-size: 11px; padding: 4px 8px; border-color: rgba(245,158,11,0.5);" title="Status e Configurações do Supabase Realtime">
        <span id="supabase-status-indicator" class="supabase-pulse-local"></span>
        <span id="supabase-status-text">⚡ Supabase</span>
      </button>
"""

if 'btn-supabase-status' not in html:
    html = html.replace('<!-- Daily 10k Bonus -->', supabase_btn_html + '\n      <!-- Daily 10k Bonus -->')

# 5. Add Modals: Supabase Settings Modal and Russian Roulette Modal
new_modals_html = """
  <!-- Supabase Configuration & Status Modal -->
  <div id="supabase-modal" class="modal-backdrop" style="display: none;">
    <div class="modal-card" style="max-width: 480px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 class="font-cinzel" style="color: #fbbf24; font-size: 16px;">⚡ Supabase Realtime Backend</h3>
        <button class="btn-dark" style="padding: 2px 8px; font-size: 11px;" onclick="closeSupabaseModal()">✕</button>
      </div>

      <p style="font-size: 11px; color: #fed7aa; margin-bottom: 12px; line-height: 1.4;">
        Para jogar <strong>Texas Hold'em</strong> e <strong>Liar's Bar</strong> com amigos em dispositivos diferentes, insira as credenciais do seu projeto Supabase criado com o script SQL fornecido.
      </p>

      <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(249,115,22,0.3); border-radius: 8px; padding: 10px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 11px; font-weight: bold; color: #fff;">Status da Conexão:</span>
          <span id="supabase-modal-badge" style="font-size: 11px; padding: 2px 8px; border-radius: 6px; font-weight: bold; background: #78350f; color: #fde68a;">
            Modo Local / Fallback Ativo
          </span>
        </div>
        <div id="supabase-modal-details" style="font-size: 10px; color: #fdba74;">
          Sincronizando entre abas via Storage & Broadcast. Para sincronização entre celulares/PCs diferentes, insira URL e Anon Key.
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
        <div>
          <label style="font-size: 10px; font-weight: bold; color: #fde68a; display: block; margin-bottom: 3px;">SUPABASE_URL:</label>
          <input type="text" id="supabase-input-url" placeholder="https://seu-projeto.supabase.co" style="width: 100%; background: #250d09; border: 1.5px solid #ea580c; border-radius: 6px; padding: 7px 10px; color: #fff; font-size: 11px; outline: none;">
        </div>
        <div>
          <label style="font-size: 10px; font-weight: bold; color: #fde68a; display: block; margin-bottom: 3px;">SUPABASE_ANON_KEY (Public):</label>
          <input type="password" id="supabase-input-key" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." style="width: 100%; background: #250d09; border: 1.5px solid #ea580c; border-radius: 6px; padding: 7px 10px; color: #fff; font-size: 11px; outline: none;">
        </div>
      </div>

      <div style="display: flex; gap: 8px;">
        <button class="btn-gold" style="flex: 1;" onclick="saveSupabaseCredentials()">SALVAR & CONECTAR ⚡</button>
        <button class="btn-game-secondary" onclick="resetSupabaseCredentials()">Redefinir</button>
      </div>

      <div style="margin-top: 10px; text-align: center;">
        <button class="btn-dark" style="font-size: 10px; border: none; background: transparent; color: #fbbf24; text-decoration: underline;" onclick="toggleSqlGuide()">
          Ver instruções de configuração e SQL do Supabase
        </button>
      </div>
      <div id="supabase-sql-guide" style="display: none; margin-top: 8px; font-size: 10px; color: #cbd5e1; background: #120403; border: 1px solid rgba(249,115,22,0.3); border-radius: 6px; padding: 8px; max-height: 120px; overflow-y: auto; text-align: left; font-family: monospace;">
        1. Crie projeto em supabase.com<br>
        2. No SQL Editor, rode o script do topo deste arquivo HTML.<br>
        3. Em Database &gt; Publications, ative Realtime para 'salas' e 'estado_salas'.<br>
        4. Copie a Project URL e Anon Key em Settings &gt; API e cole acima!
      </div>
    </div>
  </div>

  <!-- Russian Roulette Gun Modal for Liar's Bar -->
  <div id="russian-roulette-modal" class="modal-backdrop" style="display: none; z-index: 200;">
    <div class="modal-card" style="max-width: 440px; text-align: center; border: 2px solid #ef4444; background: radial-gradient(circle at 50% 30%, #3a0a07 0%, #1a0403 70%, #0a0201 100%);">
      <div style="font-size: 11px; font-weight: 900; letter-spacing: 1px; color: #ef4444; text-transform: uppercase;">
        ⚠️ ROLETA RUSSA DO LIAR'S BAR ⚠️
      </div>
      <h2 id="roulette-victim-name" class="font-cinzel" style="color: #fbbf24; font-size: 18px; margin: 4px 0;">
        Capitão Blefe perdeu a rodada!
      </h2>
      <p id="roulette-victim-sub" style="font-size: 11px; color: #fed7aa; margin-bottom: 10px;">
        O tambor tem 3 câmaras e 1 bala carregada. A cada tiro vazio, uma câmara é eliminada!
      </p>

      <!-- Victim Character Graphic Container -->
      <div id="roulette-character-stage" style="width: 140px; height: 140px; margin: 0 auto 10px auto; position: relative;">
        <!-- Injected SVG Character with dynamic wounds -->
      </div>

      <!-- Revolver Cylinder Graphic (SVG 3 Chambers) -->
      <div style="position: relative; width: 130px; height: 130px; margin: 0 auto 12px auto; display: flex; align-items: center; justify-content: center;">
        <svg id="roulette-cylinder-svg" width="120" height="120" viewBox="0 0 120 120">
          <!-- Cylinder Outer Body -->
          <circle cx="60" cy="60" r="54" fill="#2d1511" stroke="#78350f" stroke-width="4" />
          <circle cx="60" cy="60" r="46" fill="#1b0805" stroke="#f59e0b" stroke-width="2" />
          <circle cx="60" cy="60" r="14" fill="#45140b" stroke="#f59e0b" stroke-width="2" />
          <!-- 3 Chambers (120 deg apart) -->
          <!-- Chamber 1: Top (0 deg) -->
          <circle id="chamber-slot-1" cx="60" cy="28" r="12" fill="#0d0302" stroke="#ea580c" stroke-width="2.5" />
          <circle id="bullet-dot-1" cx="60" cy="28" r="5" fill="#ef4444" opacity="0" />
          <!-- Chamber 2: Bottom Right (120 deg) -->
          <circle id="chamber-slot-2" cx="87" cy="76" r="12" fill="#0d0302" stroke="#ea580c" stroke-width="2.5" />
          <circle id="bullet-dot-2" cx="87" cy="76" r="5" fill="#ef4444" opacity="0" />
          <!-- Chamber 3: Bottom Left (240 deg) -->
          <circle id="chamber-slot-3" cx="33" cy="76" r="12" fill="#0d0302" stroke="#ea580c" stroke-width="2.5" />
          <circle id="bullet-dot-3" cx="33" cy="76" r="5" fill="#ef4444" opacity="0" />
        </svg>
        <div id="roulette-gun-barrel-pointer" style="position: absolute; top: -10px; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 16px solid #ef4444;"></div>
      </div>

      <!-- Chambers & Odds Information Badge -->
      <div id="roulette-odds-badge" style="background: rgba(0,0,0,0.5); border: 1.5px solid #ea580c; border-radius: 8px; padding: 6px 12px; margin-bottom: 12px; font-size: 12px; font-weight: bold; color: #fbbf24;">
        Câmaras Restantes: <span id="roulette-chambers-count" style="color: #fff; font-size: 14px;">3 / 3</span> (Risco: 1 em 3 · 33.3%)
      </div>

      <!-- Action Message / Result -->
      <div id="roulette-result-text" style="font-size: 12px; font-weight: bold; color: #fff; min-height: 24px; margin-bottom: 12px;">
        Puxe o gatilho para testar a sorte!
      </div>

      <!-- Trigger Action Button -->
      <div style="display: flex; gap: 8px; justify-content: center;">
        <button id="btn-pull-trigger" class="btn-gold" style="flex: 1; background: linear-gradient(135deg, #dc2626, #991b1b); font-size: 13px;" onclick="executeRussianRouletteTrigger()">
          PUXAR O GATILHO! 🎯
        </button>
      </div>
    </div>
  </div>
"""

if 'russian-roulette-modal' not in html:
    html = html.replace('<!-- Fortune Dragon Win Celebration Modal', new_modals_html + '\n  <!-- Fortune Dragon Win Celebration Modal')

print("Modals and Header patched.")

with open('sapecas-cassino.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Saved checkpoint 1.")
