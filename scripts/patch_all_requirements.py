#!/usr/bin/env python3
import re
import os

print("Starting complete patch for all 3 requirements...")

with open('sapecas-cassino.html', 'r', encoding='utf-8') as f:
    html = f.read()

# -------------------------------------------------------------
# 1. UPDATE SQL COMMENT TO INCLUDE AVATAR AND APELIDO COLUMNS
# -------------------------------------------------------------
if 'avatar TEXT DEFAULT' not in html:
    html = html.replace(
        'ultimo_giro_roleta TIMESTAMP\n);',
        'ultimo_giro_roleta TIMESTAMP,\n  avatar TEXT DEFAULT \'🦁\',\n  apelido TEXT\n);'
    )
    # Also add ALTER TABLE migration line
    html = html.replace(
        'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
        'CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n\n-- Colunas de Perfil (Avatar e Apelido)\nALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT \'🦁\';\nALTER TABLE usuarios ADD COLUMN IF NOT EXISTS apelido TEXT;'
    )

# -------------------------------------------------------------
# 2. ADD USER PROFILE CUSTOMIZATION MODAL & SIDEBAR/HEADER BADGE
# -------------------------------------------------------------
profile_modal_html = """
  <!-- User Profile Customization Modal -->
  <div id="profile-custom-modal" class="modal-backdrop" style="display: none; z-index: 150;">
    <div class="modal-card" style="max-width: 400px; text-align: center;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 class="font-cinzel" style="color: #fbbf24; font-size: 16px;">👤 Personalizar Perfil</h3>
        <button class="btn-dark" style="padding: 2px 8px; font-size: 11px;" onclick="closeProfileModal()">✕</button>
      </div>

      <div style="background: rgba(0,0,0,0.4); border: 1.5px solid rgba(249,115,22,0.3); border-radius: 12px; padding: 12px; margin-bottom: 12px;">
        <!-- Current Avatar Preview -->
        <div id="profile-preview-avatar" style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #ea580c); display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto 8px auto; border: 2px solid #fef08a; box-shadow: 0 0 15px rgba(245,158,11,0.5);">
          🦁
        </div>
        <div id="profile-preview-name" style="font-size: 13px; font-weight: bold; color: #fff;">Jogador</div>
        <div id="profile-preview-sub" style="font-size: 10px; color: #fdba74; font-family: monospace;">Salvo na tabela 'usuarios'</div>
      </div>

      <!-- Avatar Picker Grid -->
      <div style="margin-bottom: 12px; text-align: left;">
        <label style="font-size: 11px; font-weight: bold; color: #fed7aa; display: block; margin-bottom: 6px;">Escolha seu Ícone / Avatar:</label>
        <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px;" id="avatar-picker-grid">
          <!-- Filled dynamically -->
        </div>
      </div>

      <!-- Nickname Input -->
      <div style="margin-bottom: 14px; text-align: left;">
        <label style="font-size: 11px; font-weight: bold; color: #fed7aa; display: block; margin-bottom: 4px;">Apelido de Exibição (Nickname):</label>
        <input type="text" id="profile-nickname-input" maxlength="20" placeholder="Ex: Mestre do Blefe" style="width: 100%; background: #250d09; border: 1.5px solid #ea580c; border-radius: 8px; padding: 8px 12px; color: #fff; font-size: 12px; outline: none;">
      </div>

      <div style="display: flex; gap: 8px;">
        <button class="btn-gold" style="flex: 1;" onclick="saveUserProfilePreferences()">SALVAR PREFERÊNCIAS 💾</button>
        <button class="btn-dark" onclick="closeProfileModal()">Cancelar</button>
      </div>
    </div>
  </div>
"""

if 'profile-custom-modal' not in html:
    html = html.replace('<!-- Daily Wheel Modal Backdrop -->', profile_modal_html + '\n  <!-- Daily Wheel Modal Backdrop -->')

# Update Header user badge to show avatar and be clickable to open Profile modal
old_user_badge = '<span id="current-username" style="font-size: 12px; font-weight: bold; color: #fed7aa;"></span>'
new_user_badge = """<div onclick="openProfileModal()" style="display: flex; align-items: center; gap: 6px; background: #250d09; border: 1.5px solid rgba(249,115,22,0.4); border-radius: 10px; padding: 3px 8px; cursor: pointer;" title="Personalizar Perfil (Avatar e Apelido)">
        <span id="current-user-avatar" style="font-size: 15px;">🦁</span>
        <span id="current-username" style="font-size: 11px; font-weight: bold; color: #fde68a; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
        <span style="font-size: 10px; color: #fbbf24;">✏️</span>
      </div>"""

if old_user_badge in html and 'current-user-avatar' not in html:
    html = html.replace(old_user_badge, new_user_badge)

print("Checkpoint: Profile modal and header badge added.")

# -------------------------------------------------------------
# 3. REWRITE PLINKO WITH EXACT 17 MULTIPLIER BOXES & NAVY AESTHETIC
# -------------------------------------------------------------
new_plinko_js = """    // 17. JOGO BOLINHAS NA PENEIRA (PLINKO COM ESTÉTICA NAVY E 17 MULTIPLICADORES)
    let plinkoState = {
      betPerBall: 50,
      ballCount: 3,
      animating: false,
      activeBucketHits: {}
    };

    // 17 caixas de multiplicadores exatamente como requisitado:
    // Vermelho escuro (16x), Vermelho (9x), Rosa (2x), Laranja (1.4x), Laranja claro (1.4x),
    // Laranja claro (1.2x), Amarelo (1.1x), Amarelo claro (1x), Amarelo muito claro (0.5x),
    // Amarelo claro (1x), Amarelo (1.1x), Laranja claro (1.2x), Laranja claro (1.4x),
    // Laranja (1.4x), Rosa (2x), Vermelho (9x), Vermelho escuro (16x).
    const PLINKO_17_MULTS = [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16];
    const PLINKO_17_COLORS = [
      '#7f1d1d', // 16x Vermelho escuro
      '#dc2626', // 9x Vermelho
      '#ec4899', // 2x Rosa
      '#ea580c', // 1.4x Laranja
      '#f97316', // 1.4x Laranja claro
      '#fb923c', // 1.2x Laranja claro
      '#eab308', // 1.1x Amarelo
      '#fde047', // 1x Amarelo claro
      '#fef08a', // 0.5x Amarelo muito claro
      '#fde047', // 1x Amarelo claro
      '#eab308', // 1.1x Amarelo
      '#fb923c', // 1.2x Laranja claro
      '#f97316', // 1.4x Laranja claro
      '#ea580c', // 1.4x Laranja
      '#ec4899', // 2x Rosa
      '#dc2626', // 9x Vermelho
      '#7f1d1d'  // 16x Vermelho escuro
    ];

    function renderPlinko(container) {
      container.innerHTML = `
        <div class="game-viewport">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <button class="btn-dark" onclick="navigate('lobby')">← Lobby</button>
            <span style="font-size: 13px; font-weight: bold; color: #38bdf8;" class="font-cinzel">⚪ PLINKO (BOLINHAS) · MULTIPLAYER AO VIVO</span>
            <button class="btn-dark" onclick="showRules('Plinko (Bolinhas)', 'Solte bolinhas pela pirâmide de pinos brancos. As bolinhas quicam nos pinos de forma realista e se acomodam em uma das 17 caixas de multiplicadores (de 0.5x nas caixas centrais até 16x nas extremidades vermelhas)! Tudo visível em 100vh.')">Como Jogar</button>
          </div>

          <!-- Live Multiplayer Feed Ribbon -->
          <div style="background: #08101d; border: 1px solid rgba(56,189,248,0.25); border-radius: 8px; padding: 3px 10px; display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
            <span style="color: #38bdf8; font-weight: bold;">👥 Lançamentos da Sala ao Vivo:</span>
            <div id="plinko-live-feed" style="display: flex; gap: 8px; color: #cbd5e1; font-family: monospace;">
              <span>Capitão Scruffy <strong style="color: #f87171;">9x</strong> (+450🪙)</span>
              <span>Dama Raposa <strong style="color: #ef4444;">16x</strong> (+1.600🪙)</span>
              <span>Barão Von Pork <strong style="color: #fb923c;">1.4x</strong> (+140🪙)</span>
            </div>
          </div>

          <!-- Main Plinko Box (Dark Navy / Charcoal Background) -->
          <div style="background: #080c14; border: 2px solid rgba(56,189,248,0.35); border-radius: 14px; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; position: relative; box-shadow: inset 0 0 30px rgba(0,0,0,0.9), 0 0 25px rgba(6,182,212,0.15);">
            <canvas id="plinko-canvas" width="460" height="300" style="background: #080c14; border-radius: 10px; width: 100%; max-width: 460px; height: auto; max-height: 100%;"></canvas>
            <div id="plinko-results" style="font-size: 11px; font-weight: bold; color: #38bdf8; margin-top: 4px; min-height: 16px; text-align: center;">
              Escolha a quantidade de bolinhas e solte na pirâmide de pinos!
            </div>
          </div>

          <!-- Bottom Controls (Strict 100vh) -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(8,16,29,0.8); border: 1px solid rgba(56,189,248,0.2); border-radius: 10px; padding: 4px 8px;">
              <div style="display: flex; gap: 4px; align-items: center;">
                <span style="font-size: 10px; color: #38bdf8; text-transform: uppercase; font-weight: bold;">Bolinhas:</span>
                <button class="btn-game-secondary" onclick="setPlinkoBalls(1)">1 ⚪</button>
                <button class="btn-game-secondary active" id="btn-pball-3" onclick="setPlinkoBalls(3)">3 ⚪</button>
                <button class="btn-game-secondary" onclick="setPlinkoBalls(5)">5 ⚪</button>
                <button class="btn-game-secondary" onclick="setPlinkoBalls(10)">10 ⚪</button>
              </div>
              <div style="display: flex; gap: 4px; align-items: center;">
                <span style="font-size: 10px; color: #f59e0b; text-transform: uppercase; font-weight: bold;">Aposta:</span>
                <button class="chip-btn active" onclick="setPlinkoBet(50)">50</button>
                <button class="chip-btn" onclick="setPlinkoBet(100)">100</button>
                <button class="chip-btn" onclick="setPlinkoBet(250)">250</button>
                <button class="chip-btn" onclick="setPlinkoBet(500)">500</button>
              </div>
            </div>

            <button id="btn-plinko-drop" class="btn-gold" style="width: 100%; background: linear-gradient(135deg, #0284c7, #2563eb, #f59e0b); font-size: 13px;" onclick="dropPlinkoBalls()">
              SOLTAR BOLINHAS (150 FICHAS) ⚪
            </button>
            <div style="text-align: center; padding-top: 1px;">
              <button class="btn-dark" style="font-size: 10px; padding: 2px 8px; border: none; background: transparent; color: #38bdf8; cursor: pointer;" onclick="showRules('Plinko (Bolinhas na Pirâmide)', '1. As bolinhas caem do topo da pirâmide quicando nos pinos brancos.\\n2. Ao atingir a base, cada bolinha entra em uma das 17 caixas de multiplicadores.\\n3. O prêmio é calculado multiplicando o valor da aposta por bolinha pelo multiplicador da caixa!\\n4. Extremidades pagam 16x e 9x, centro paga 0.5x e 1x.')">
                ✦ Regras & Como Jogar Plinko (17 Caixas Multiplicadoras)
              </button>
            </div>
          </div>
        </div>
      `;

      initPlinkoCanvas();
    }

    function setPlinkoBalls(count) {
      if (plinkoState.animating) return;
      plinkoState.ballCount = count;
      const total = count * plinkoState.betPerBall;
      document.getElementById('btn-plinko-drop').innerText = `SOLTAR ${count} BOLINHA(S) (${total} Fichas) ⚪`;
      audio.click();
    }

    function setPlinkoBet(amt) {
      if (plinkoState.animating) return;
      plinkoState.betPerBall = amt;
      const total = plinkoState.ballCount * amt;
      document.getElementById('btn-plinko-drop').innerText = `SOLTAR ${plinkoState.ballCount} BOLINHA(S) (${total} Fichas) ⚪`;
      audio.chip();
    }

    let plinkoAnimId = null;
    let plinkoBallsList = [];

    function initPlinkoCanvas() {
      const cvs = document.getElementById('plinko-canvas');
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      drawPlinkoFrame(ctx, cvs.width, cvs.height, []);
    }

    function drawPlinkoFrame(ctx, w, h, balls) {
      // 1. Fundo: Azul-marinho / Cinza-escuro (quase preto)
      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, w, h);

      // Linhas de grade sutis
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // 2. Caixas de multiplicadores na base (17 caixas)
      const count = PLINKO_17_MULTS.length; // 17
      const bw = (w - 16) / count;
      const bh = 22;
      const by = h - bh - 4;
      const now = Date.now();

      PLINKO_17_MULTS.forEach((m, idx) => {
        const bx = 8 + idx * bw;
        const lastHit = plinkoState.activeBucketHits[idx] || 0;
        const isHit = now - lastHit < 400;

        ctx.save();
        if (isHit) {
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 12;
        } else {
          ctx.fillStyle = PLINKO_17_COLORS[idx];
        }

        const boxY = isHit ? by - 3 : by;
        const boxH = isHit ? bh + 3 : bh;

        ctx.fillRect(bx + 1, boxY, bw - 2, boxH);
        ctx.strokeStyle = isHit ? '#ffffff' : 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 1, boxY, bw - 2, boxH);

        // Texto dos multiplicadores: números brancos, em negrito e legíveis
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(m + 'x', bx + bw / 2, boxY + boxH / 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(m + 'x', bx + bw / 2, boxY + boxH / 2);
        ctx.restore();
      });

      // 3. Pinos: Pequenos pontos brancos e circulares em formato de pirâmide
      const rows = 14;
      const pegStartY = 28;
      const pegEndY = by - 12;
      const rowSpacing = (pegEndY - pegStartY) / (rows - 1);

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
      ctx.shadowBlur = 3;

      for (let r = 0; r < rows; r++) {
        const countInRow = r + 3;
        const startX = w / 2 - ((countInRow - 1) * bw) / 2;
        const y = pegStartY + r * rowSpacing;

        for (let c = 0; c < countInRow; c++) {
          const x = startX + c * bw;
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 4. Bolinhas: Esferas brancas (com leve brilho)
      balls.forEach(b => {
        if (!b.active) return;
        ctx.save();
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 8;

        const grad = ctx.createRadialGradient(b.x - 1.2, b.y - 1.2, 0.8, b.x, b.y, b.radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.7, '#f8fafc');
        grad.addColorStop(1, '#cbd5e1');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      });
    }

    function dropPlinkoBalls() {
      const total = plinkoState.betPerBall * plinkoState.ballCount;
      if (currentUser.balance < total) { alert('Saldo insuficiente!'); return; }
      if (plinkoState.animating) return;

      plinkoState.animating = true;
      currentUser.saldoFichas -= total;
      currentUser.balance = currentUser.saldoFichas;
      DB.usuarios.updateBalance(currentUser.id, -total);
      logAction(-total, false, 'Plinko', 'Lançamento de bolinhas');
      incStandaloneCounter('plinko_drops', plinkoState.ballCount);
      audio.chip();

      const cvs = document.getElementById('plinko-canvas');
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      const w = cvs.width;
      const h = cvs.height;

      const bw = (w - 16) / PLINKO_17_MULTS.length;
      const rows = 14;
      const pegStartY = 28;
      const bucketHeight = 22;
      const by = h - bucketHeight - 4;
      const rowSpacing = (by - 12 - pegStartY) / (rows - 1);

      // Build peg collision coordinates
      const pegPositions = [];
      for (let r = 0; r < rows; r++) {
        const countInRow = r + 3;
        const startX = w / 2 - ((countInRow - 1) * bw) / 2;
        const py = pegStartY + r * rowSpacing;
        for (let c = 0; c < countInRow; c++) {
          pegPositions.push({ x: startX + c * bw, y: py });
        }
      }

      plinkoBallsList = [];
      for (let i = 0; i < plinkoState.ballCount; i++) {
        plinkoBallsList.push({
          x: w / 2 + (Math.random() - 0.5) * 16,
          y: 8 - i * 20,
          vx: (Math.random() - 0.5) * 1.1,
          vy: 1.8,
          radius: 4.5,
          active: true
        });
      }

      let finishedCount = 0;
      let totalWon = 0;

      const loop = () => {
        plinkoBallsList.forEach(b => {
          if (!b.active) return;
          b.vy += 0.22;
          b.vx *= 0.994;
          b.x += b.vx;
          b.y += b.vy;

          if (b.x < 12) { b.x = 12; b.vx = Math.abs(b.vx) * 0.7; }
          if (b.x > w - 12) { b.x = w - 12; b.vx = -Math.abs(b.vx) * 0.7; }

          // Collide with pins
          pegPositions.forEach(peg => {
            const dx = b.x - peg.x;
            const dy = b.y - peg.y;
            const dist = Math.hypot(dx, dy);
            if (dist < b.radius + 2.2) {
              const nx = dx / (dist || 1);
              const ny = dy / (dist || 1);
              b.x += nx * (b.radius + 2.2 - dist);
              b.y += ny * (b.radius + 2.2 - dist);
              const dot = b.vx * nx + b.vy * ny;
              b.vx = (b.vx - 1.7 * dot * nx) + (Math.random() - 0.5) * 0.6;
              b.vy = (b.vy - 1.7 * dot * ny) * 0.65;
              if (b.vy < 0.6) b.vy = 0.6;
            }
          });

          // Reached base bucket
          if (b.y >= by) {
            b.active = false;
            finishedCount++;
            const clampedX = Math.max(8, Math.min(w - 9, b.x));
            const bucketIdx = Math.max(0, Math.min(PLINKO_17_MULTS.length - 1, Math.floor((clampedX - 8) / bw)));
            const mult = PLINKO_17_MULTS[bucketIdx];
            const win = Math.floor(plinkoState.betPerBall * mult);
            totalWon += win;

            plinkoState.activeBucketHits[bucketIdx] = Date.now();
            audio.coin();
          }
        });

        drawPlinkoFrame(ctx, w, h, plinkoBallsList);

        if (finishedCount < plinkoBallsList.length) {
          plinkoAnimId = requestAnimationFrame(loop);
        } else {
          plinkoState.animating = false;
          if (totalWon > 0) {
            currentUser.saldoFichas += totalWon;
            currentUser.balance = currentUser.saldoFichas;
            DB.usuarios.updateBalance(currentUser.id, totalWon);
            logAction(totalWon, true, 'Plinko', `Lançamento premiado (+${totalWon} fichas)`);
            audio.win();
            document.getElementById('plinko-results').innerHTML = `<span style="color: #34d399; font-size: 13px;">✨ GANHOU ${totalWon.toLocaleString('pt-BR')} FICHAS!</span>`;
          } else {
            audio.loss();
            document.getElementById('plinko-results').innerText = 'Fim dos lançamentos. Tente novamente!';
          }
          updateHeaderUI();
        }
      };

      loop();
    }
"""

# Replace old Plinko implementation in HTML
old_plinko_start = html.find("// 17. JOGO BOLINHAS NA PENEIRA")
old_plinko_end = html.find("// 18. JOGO LIAR'S BAR", old_plinko_start)

if old_plinko_start != -1 and old_plinko_end != -1:
    html = html[:old_plinko_start] + new_plinko_js + '\n\n    ' + html[old_plinko_end:]
    print("Plinko successfully replaced with 17 multiplier boxes and navy aesthetic.")
else:
    print("Could not find exact Plinko markers. Check locations.")

with open('sapecas-cassino.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Saved checkpoint for Plinko and Profile.")
