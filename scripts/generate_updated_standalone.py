#!/usr/bin/env python3
import os
import re

# Read the base file
with open('sapecas-cassino.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. ADD SUPABASE SQL AND SETUP INSTRUCTIONS COMMENT AT THE VERY TOP
supabase_header_comment = '''<!--
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
'''

# Ensure doctype and header comment
if not content.startswith('<!--\n===') and not 'CONFIGURAÇÃO MULTIPLAYER REAL COM SUPABASE' in content:
    content = supabase_header_comment + content

# 2. ADD SUPABASE CDN SCRIPT TAG IN <head>
if 'cdn.jsdelivr.net/npm/@supabase/supabase-js' not in content:
    content = content.replace(
        '<meta name="description"',
        '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n  <meta name="description"'
    )

print("Base comment and script added. Now patching CSS, UI, and Game Logic...")

with open('sapecas-cassino.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated head and comments.")
