#!/usr/bin/env python3
"""
patch_miner_sapeca_full.py
1. Renames "Miner" to "Miner Sapeca" across lobby card, game header, and rule buttons.
2. Complete visual overhaul of Miner based on Stake Mines reference:
   - Deep navy / dark charcoal background (#0b0f19 / #0f172a) with subtle rocky cavern texture.
   - 5x5 square grid with rounded corners and dark textured stone cells.
   - Emerald Gem SVGs with multifaceted crown, pavilion and glowing green highlights.
   - Dark red 3D spherical bomb SVGs with central glow and wick.
   - Reddish-orange highlight theme with emerald green success accents.
   - Top info panel with 3 distinct columns: APOSTA, MULTIPLICADOR, PAGAMENTO, updating in real time.
   - "Jogar Mines" button that dynamically transforms into "Retirar / Cashout" when gems are found.
   - "Como Jogar Miner Sapeca" button at bottom.
   - Strict 100vh containment.
3. User avatar in Header gains conquest animation (subtle pulse, rotation & gold glow) on wins and goal claims.
"""

import re
import os

print("Starting Miner Sapeca & Header Avatar Conquest animation update...")

with open('sapecas-cassino.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ----------------------------------------------------------------------
# 1. ADD AVATAR CONQUEST KEYFRAMES AND HELPER FUNCTION
# ----------------------------------------------------------------------
avatar_conquest_css = """
    /* Avatar Conquest Achievement Animation */
    @keyframes avatarConquestPulse {
      0% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 0 rgba(245,158,11,0)); }
      20% { transform: scale(1.35) rotate(-14deg); filter: drop-shadow(0 0 16px rgba(245,158,11,0.9)); }
      40% { transform: scale(1.35) rotate(14deg); filter: drop-shadow(0 0 24px rgba(234,88,12,1)); }
      60% { transform: scale(1.2) rotate(-6deg); filter: drop-shadow(0 0 16px rgba(245,158,11,0.8)); }
      80% { transform: scale(1.1) rotate(4deg); filter: drop-shadow(0 0 10px rgba(245,158,11,0.6)); }
      100% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 0 rgba(245,158,11,0)); }
    }
    .avatar-conquest-anim {
      animation: avatarConquestPulse 2.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      border-color: #fbbf24 !important;
      box-shadow: 0 0 20px rgba(245,158,11,0.7) !important;
    }
"""

if 'avatarConquestPulse' not in html:
    html = html.replace('</style>', avatar_conquest_css + '\n  </style>')
    print("Added avatarConquestPulse CSS keyframes.")

# Add triggerAvatarCelebration function
celebration_fn = """
    function triggerAvatarCelebration() {
      const el = document.getElementById('current-user-avatar');
      const badge = el ? el.parentElement : null;
      if (badge) {
        badge.classList.remove('avatar-conquest-anim');
        void badge.offsetWidth; // trigger reflow
        badge.classList.add('avatar-conquest-anim');
        setTimeout(() => badge.classList.remove('avatar-conquest-anim'), 2300);
      }
      try {
        window.dispatchEvent(new CustomEvent('sapecas_avatar_conquest'));
      } catch(e) {}
    }
"""

if 'function triggerAvatarCelebration' not in html:
    # Insert right before logAction
    idx = html.find('function logAction')
    if idx != -1:
        html = html[:idx] + celebration_fn + '\n    ' + html[idx:]
        print("Inserted triggerAvatarCelebration function.")

# Ensure logAction calls triggerAvatarCelebration on wins
old_log = "if (isWin && val > 0) audio.win();"
new_log = "if (isWin && val > 0) { audio.win(); triggerAvatarCelebration(); }"
if old_log in html and 'triggerAvatarCelebration();' not in html[html.find('function logAction'):html.find('function logAction')+400]:
    html = html.replace(old_log, new_log)
    print("Hooked triggerAvatarCelebration into logAction.")

# Also trigger on bonus and daily wheel
if 'triggerAvatarCelebration()' not in html[html.find('function claimDailyBonus'):html.find('function claimDailyBonus')+300]:
    html = html.replace(
      "currentUser.balance += 10000;\n      currentUser.saldoFichas = currentUser.balance;",
      "currentUser.balance += 10000;\n      currentUser.saldoFichas = currentUser.balance;\n      triggerAvatarCelebration();"
    )
    print("Hooked triggerAvatarCelebration into claimDailyBonus.")

# ----------------------------------------------------------------------
# 2. RENAME MINER TO "MINER SAPECA" IN LOBBY CARD
# ----------------------------------------------------------------------
html = html.replace(
    '<div class="title">Miner · Campo Minado 5x5</div>',
    '<div class="title">Miner Sapeca</div>'
)
print("Updated Lobby card title to 'Miner Sapeca'.")

# ----------------------------------------------------------------------
# 3. OVERHAUL MINER SAPECA FUNCTIONS AND STAKE MINES AESTHETICS
# ----------------------------------------------------------------------

# SVG definitions for Emerald Diamond Gem and Dark Red Spherical Bomb
emerald_gem_svg = """<svg viewBox="0 0 48 48" style="width: 70%; height: 70%; filter: drop-shadow(0 0 10px rgba(16,185,129,0.9));">
  <defs>
    <linearGradient id="gemGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6ee7b7"/>
      <stop offset="35%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="topFacet" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#a7f3d0"/>
      <stop offset="100%" stop-color="#34d399"/>
    </linearGradient>
  </defs>
  <polygon points="14,13 34,13 42,21 6,21" fill="url(#topFacet)" stroke="#064e3b" stroke-width="1.2"/>
  <polygon points="18,13 30,13 34,21 14,21" fill="#a7f3d0" opacity="0.8"/>
  <polygon points="6,21 24,41 16,21" fill="#059669" stroke="#064e3b" stroke-width="1.2"/>
  <polygon points="16,21 24,41 32,21" fill="url(#gemGrad)" stroke="#064e3b" stroke-width="1.2"/>
  <polygon points="32,21 24,41 42,21" fill="#047857" stroke="#064e3b" stroke-width="1.2"/>
  <line x1="19" y1="15" x2="29" y2="15" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="24" cy="22" r="2.5" fill="#fff" opacity="0.6"/>
</svg>"""

dark_red_bomb_svg = """<svg viewBox="0 0 48 48" style="width: 70%; height: 70%; filter: drop-shadow(0 0 12px rgba(239,68,68,0.8));">
  <defs>
    <radialGradient id="bombRedSphere" cx="38%" cy="36%" r="62%">
      <stop offset="0%" stop-color="#f87171"/>
      <stop offset="25%" stop-color="#dc2626"/>
      <stop offset="65%" stop-color="#7f1d1d"/>
      <stop offset="100%" stop-color="#2a0606"/>
    </radialGradient>
    <radialGradient id="bombCenterLight" cx="40%" cy="38%" r="28%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="45%" stop-color="#fca5a5" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#dc2626" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="22" y="7" width="4" height="4" rx="1" fill="#78350f" stroke="#451a03" stroke-width="0.8"/>
  <path d="M24,7 Q27,2 31,4" stroke="#f59e0b" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <circle cx="31" cy="4" r="1.6" fill="#fef08a"/>
  <circle cx="24" cy="26" r="15.5" fill="url(#bombRedSphere)" stroke="#1a0404" stroke-width="1.4"/>
  <circle cx="21" cy="22" r="6.5" fill="url(#bombCenterLight)"/>
  <ellipse cx="19" cy="18" rx="2.8" ry="1.6" fill="#fff" opacity="0.6" transform="rotate(-30, 19, 18)"/>
</svg>"""

new_miner_code = f"""    // ==========================================
    // 15. JOGO MINER SAPECA (STAKE MINES AESTHETIC)
    // ==========================================
    let minerState = {{
      bet: 100,
      bombsCount: 3,
      status: 'IDLE', // 'IDLE' | 'PLAYING' | 'ENDED'
      bombs: new Set(),
      revealed: new Set(),
      multiplier: 1.0,
      explodedIndex: null
    }};

    function renderMiner(container) {{
      const payout = Math.floor(minerState.bet * minerState.multiplier);
      const isPlaying = minerState.status === 'PLAYING';
      const gemsCollected = minerState.revealed.size;
      const canCashout = isPlaying && gemsCollected > 0;

      container.innerHTML = `
        <div class="game-viewport" style="background: radial-gradient(circle at 50% 20%, #111a2e 0%, #080c16 100%);">
          <!-- Top Header Bar -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 4px;">
            <button class="btn-dark" onclick="navigate('lobby')">← Lobby</button>
            <div style="text-align: center;">
              <span style="font-size: 14px; font-weight: 900; color: #f97316; letter-spacing: 0.5px;" class="font-cinzel">⛏️ MINER SAPECA</span>
              <span style="font-size: 10px; color: #94a3b8; display: block;">Campo Minado 5x5 · Stake Mines Edition</span>
            </div>
            <button class="btn-dark" onclick="showRules('Miner Sapeca', 'Regras do Miner Sapeca:\\n1. Escolha a aposta e o número de bombas (1 a 24 bombas).\\n2. Quanto maior o número de bombas, maiores os multiplicadores por diamante!\\n3. Clique em JOGAR MINES para iniciar a exploração na caverna.\\n4. Clique nas células: diamantes verdes esmeralda aumentam o multiplicador e o pagamento!\\n5. Clique em RETIRAR a qualquer momento para embolsar os ganhos antes de detonar uma bomba vermelha!')">
              Como Jogar Miner Sapeca
            </button>
          </div>

          <!-- Arena Box: 100vh Layout with Mining Cave Theme -->
          <div class="felt-box" style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(11, 18, 32, 0.85); border: 1.5px solid rgba(249, 115, 22, 0.35); box-shadow: inset 0 0 30px rgba(0,0,0,0.8);">
            
            <!-- Painel Superior de Informações (3 Colunas estilo Stake Mines) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; width: 100%; max-width: 360px; background: #0c1424; border: 1.5px solid rgba(249,115,22,0.3); border-radius: 12px; padding: 6px 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
              <!-- Coluna 1: Aposta -->
              <div style="text-align: left;">
                <span style="font-size: 9px; font-weight: 800; color: #f97316; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Aposta</span>
                <span id="miner-col-bet" style="font-size: 13px; font-weight: 900; color: #fff; font-family: monospace;">${{minerState.bet.toLocaleString('pt-BR')}} 🪙</span>
              </div>
              <!-- Coluna 2: Multiplicador -->
              <div style="text-align: center; border-left: 1px solid rgba(249,115,22,0.2); border-right: 1px solid rgba(249,115,22,0.2);">
                <span style="font-size: 9px; font-weight: 800; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Multiplicador</span>
                <span id="miner-col-mult" style="font-size: 15px; font-weight: 900; color: #fbbf24; font-family: monospace;">${{minerState.multiplier.toFixed(2)}}x</span>
              </div>
              <!-- Coluna 3: Pagamento -->
              <div style="text-align: right;">
                <span style="font-size: 9px; font-weight: 800; color: #34d399; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Pagamento</span>
                <span id="miner-col-payout" style="font-size: 13px; font-weight: 900; color: #34d399; font-family: monospace;">${{payout.toLocaleString('pt-BR')}} 🪙</span>
              </div>
            </div>

            <!-- 5x5 Minefield Grid: Stone / Mining Cave Texture -->
            <div style="flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; min-height: 0; padding: 4px 0;">
              <div id="miner-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; width: 100%; max-width: 320px; aspect-ratio: 1; padding: 6px; background: #070c17; border-radius: 14px; border: 1.5px solid rgba(249,115,22,0.3); box-shadow: inset 0 0 16px rgba(0,0,0,0.9);">
                ${{renderMinerGridHtml()}}
              </div>
            </div>

            <!-- Notification / Status Banner -->
            <div id="miner-msg" style="font-size: 11px; font-weight: bold; color: #fed7aa; text-align: center; min-height: 18px; display: flex; align-items: center; justify-content: center;">
              ${{isPlaying ? (gemsCollected > 0 ? `💎 ${{gemsCollected}} diamante(s) coletado(s)! Retire agora ou continue arriscando.` : 'Clique em uma pedra da caverna para revelar diamantes!') : 'Defina o número de bombas e clique em Jogar Mines!'}}
            </div>
          </div>

          <!-- Bottom Controls (Strict 100vh) -->
          <div style="display: flex; flex-direction: column; gap: 6px; padding-top: 4px;">
            <!-- Bomb Selector & Chip Presets -->
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4); border-radius: 10px; padding: 4px 8px; border: 1px solid rgba(249,115,22,0.25);">
              <div style="display: flex; gap: 4px; align-items: center;">
                <span style="font-size: 10px; color: #f97316; font-weight: 800; text-transform: uppercase;">Bombas:</span>
                <button class="btn-game-secondary ${{minerState.bombsCount === 1 ? 'active' : ''}}" style="padding: 3px 7px; font-size: 10px;" onclick="setMinerBombs(1)">1</button>
                <button class="btn-game-secondary ${{minerState.bombsCount === 3 ? 'active' : ''}}" style="padding: 3px 7px; font-size: 10px;" onclick="setMinerBombs(3)">3</button>
                <button class="btn-game-secondary ${{minerState.bombsCount === 5 ? 'active' : ''}}" style="padding: 3px 7px; font-size: 10px;" onclick="setMinerBombs(5)">5</button>
                <button class="btn-game-secondary ${{minerState.bombsCount === 10 ? 'active' : ''}}" style="padding: 3px 7px; font-size: 10px;" onclick="setMinerBombs(10)">10</button>
                <button class="btn-game-secondary ${{minerState.bombsCount === 24 ? 'active' : ''}}" style="padding: 3px 7px; font-size: 10px;" onclick="setMinerBombs(24)">24</button>
              </div>

              <div style="display: flex; gap: 4px; align-items: center;">
                <span style="font-size: 10px; color: #fed7aa; text-transform: uppercase;">Fichas:</span>
                <button class="chip-btn ${{minerState.bet === 50 ? 'active' : ''}}" onclick="setMinerBet(50)">50</button>
                <button class="chip-btn ${{minerState.bet === 100 ? 'active' : ''}}" onclick="setMinerBet(100)">100</button>
                <button class="chip-btn ${{minerState.bet === 250 ? 'active' : ''}}" onclick="setMinerBet(250)">250</button>
                <button class="chip-btn ${{minerState.bet === 500 ? 'active' : ''}}" onclick="setMinerBet(500)">500</button>
              </div>
            </div>

            <!-- Main Primary Action: Jogar Mines / Retirar (Cashout) -->
            <button 
              id="btn-miner-action" 
              class="btn-gold" 
              style="width: 100%; padding: 11px; font-size: 13px; font-weight: 900; letter-spacing: 0.5px; border-radius: 12px; ${{canCashout ? 'background: linear-gradient(135deg, #059669, #047857); border-color: #34d399; box-shadow: 0 0 16px rgba(16,185,129,0.5);' : 'background: linear-gradient(135deg, #ea580c, #c2410c); border-color: #f97316;'}}" 
              onclick="handleMinerAction()"
            >
              ${{isPlaying ? (canCashout ? `RETIRAR 🪙 ${{payout.toLocaleString('pt-BR')}} (${{minerState.multiplier.toFixed(2)}}x) 🎉` : 'ESCOLHA UMA CÉLULA NA MINA 💎') : `JOGAR MINES (${{minerState.bet.toLocaleString('pt-BR')}} Fichas) 💣`}}
            </button>

            <!-- Rules Link Button at the Very Bottom -->
            <div style="text-align: center; padding-top: 1px;">
              <button class="btn-dark" style="font-size: 11px; padding: 2px 10px; border: none; background: transparent; color: #fdba74; cursor: pointer;" onclick="showRules('Miner Sapeca', 'Regras do Miner Sapeca:\\n1. Escolha a aposta e o número de bombas (1 a 24 bombas).\\n2. Quanto maior o número de bombas, maiores os multiplicadores por diamante!\\n3. Clique em JOGAR MINES para iniciar.\\n4. Clique nas células: diamantes verdes esmeralda aumentam o multiplicador e o pagamento!\\n5. Clique em RETIRAR a qualquer momento para embolsar os ganhos!')">
                ✦ Como Jogar Miner Sapeca
              </button>
            </div>
          </div>
        </div>
      `;
    }}

    function renderMinerGridHtml() {{
      let html = '';
      const emeraldSvg = `{emerald_gem_svg}`;
      const bombSvg = `{dark_red_bomb_svg}`;

      for (let i = 0; i < 25; i++) {{
        const isRev = minerState.revealed.has(i);
        const isBomb = minerState.bombs.has(i);
        const isExplodedHere = minerState.explodedIndex === i;
        const ended = minerState.status === 'ENDED';

        let innerContent = '<span style="font-size: 12px; opacity: 0.2; color: #f97316;">✦</span>';
        let cellStyle = 'background: #172136; border: 1.5px solid #23314d; box-shadow: inset 0 2px 4px rgba(255,255,255,0.05), 0 3px 6px rgba(0,0,0,0.4);';

        if (isRev) {{
          innerContent = emeraldSvg;
          cellStyle = 'background: radial-gradient(circle, #064e3b 0%, #022c22 100%); border: 2px solid #10b981; box-shadow: 0 0 16px rgba(16,185,129,0.7), inset 0 0 8px rgba(52,211,153,0.3);';
        }} else if (isExplodedHere) {{
          innerContent = bombSvg;
          cellStyle = 'background: radial-gradient(circle, #991b1b 0%, #450a0a 100%); border: 2px solid #f87171; box-shadow: 0 0 20px #ef4444; animation: pulse 0.5s infinite;';
        }} else if (ended && isBomb) {{
          innerContent = bombSvg;
          cellStyle = 'background: #2a0b0b; border: 1.5px solid rgba(239,68,68,0.5); opacity: 0.65;';
        }} else if (ended && !isBomb) {{
          innerContent = emeraldSvg;
          cellStyle = 'background: #04241d; border: 1px solid rgba(16,185,129,0.4); opacity: 0.45;';
        }}

        html += `
          <button 
            style="${{cellStyle}} border-radius: 10px; aspect-ratio: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; padding: 2px;" 
            onclick="clickMinerTile(${{i}})"
            ${{minerState.status !== 'PLAYING' || isRev ? 'disabled' : ''}}
          >
            ${{innerContent}}
          </button>
        `;
      }}
      return html;
    }}

    function setMinerBombs(num) {{
      if (minerState.status === 'PLAYING') return;
      minerState.bombsCount = num;
      renderMiner(document.getElementById('main-content'));
      audio.click();
    }}

    function setMinerBet(amt) {{
      if (minerState.status === 'PLAYING') return;
      minerState.bet = amt;
      renderMiner(document.getElementById('main-content'));
      audio.chip();
    }}

    function handleMinerAction() {{
      if (minerState.status === 'PLAYING') {{
        // Cashout
        if (minerState.revealed.size === 0) return;
        const win = Math.floor(minerState.bet * minerState.multiplier);
        minerState.status = 'ENDED';
        currentUser.balance += win;
        currentUser.saldoFichas = currentUser.balance;
        DB.usuarios.updateBalance(currentUser.id, win);
        logAction(win, true, 'Miner Sapeca', `Saque em ${{minerState.multiplier.toFixed(2)}}x (+${{win}} fichas)`);
        triggerAvatarCelebration();
        audio.win();

        // Update UI
        renderMiner(document.getElementById('main-content'));
        const msgEl = document.getElementById('miner-msg');
        if (msgEl) msgEl.innerHTML = `<span style="color: #34d399; font-weight: 900;">🎉 SAQUE COM SUCESSO! +${{win.toLocaleString('pt-BR')}} Fichas (${{minerState.multiplier.toFixed(2)}}x)</span>`;
        updateHeaderUI();
      }} else {{
        // Start Game ("Jogar Mines")
        if (currentUser.balance < minerState.bet) {{ 
          alert('Saldo insuficiente para iniciar o Miner Sapeca!'); 
          return; 
        }}
        currentUser.balance -= minerState.bet;
        currentUser.saldoFichas = currentUser.balance;
        DB.usuarios.updateBalance(currentUser.id, -minerState.bet);
        logAction(-minerState.bet, false, 'Miner Sapeca', 'Aposta na mina');
        incStandaloneCounter('rounds', 1);
        audio.chip();

        minerState.bombs = new Set();
        while (minerState.bombs.size < minerState.bombsCount) {{
          minerState.bombs.add(Math.floor(Math.random() * 25));
        }}
        minerState.revealed = new Set();
        minerState.multiplier = 1.0;
        minerState.status = 'PLAYING';
        minerState.explodedIndex = null;

        renderMiner(document.getElementById('main-content'));
        updateHeaderUI();
      }}
    }}

    function clickMinerTile(idx) {{
      if (minerState.status !== 'PLAYING' || minerState.revealed.has(idx)) return;

      if (minerState.bombs.has(idx)) {{
        // Hit Bomb!
        minerState.status = 'ENDED';
        minerState.explodedIndex = idx;
        audio.loss();
        renderMiner(document.getElementById('main-content'));
        const msgEl = document.getElementById('miner-msg');
        if (msgEl) msgEl.innerHTML = '<span style="color: #ef4444; font-weight: 900;">💥 BOOM! Você detonou uma bomba e perdeu a aposta.</span>';
        return;
      }}

      // Found Emerald Diamond Gem!
      minerState.revealed.add(idx);
      incStandaloneCounter('miner_gems', 1);
      audio.coin();

      // Recalculate multiplier using Stake Mines curve
      let remTiles = 25;
      let remGems = 25 - minerState.bombsCount;
      let m = 1.0;
      for (let i = 0; i < minerState.revealed.size; i++) {{
        m *= (remTiles / remGems) * 0.985;
        remTiles--;
        remGems--;
      }}
      minerState.multiplier = Math.max(1.05, m);

      // Check if all gems collected (Max Win)
      if (minerState.revealed.size === (25 - minerState.bombsCount)) {{
        const win = Math.floor(minerState.bet * minerState.multiplier);
        minerState.status = 'ENDED';
        currentUser.balance += win;
        currentUser.saldoFichas = currentUser.balance;
        DB.usuarios.updateBalance(currentUser.id, win);
        logAction(win, true, 'Miner Sapeca', `Mina Concluída com Sucesso! (+${{win}} fichas)`);
        triggerAvatarCelebration();
        audio.win();
      }}

      renderMiner(document.getElementById('main-content'));
    }}
"""

# Replace old miner functions
pattern = r'let minerState = \{[\s\S]*?function clickMinerTile\(idx\) \{[\s\S]*?\n    \}'
match = re.search(pattern, html)
if match:
    html = html[:match.start()] + new_miner_code.strip() + html[match.end():]
    print("Replaced Miner code with Miner Sapeca and Stake Mines aesthetic.")
else:
    print("WARNING: miner block regex did not match, attempting fallback.")

with open('sapecas-cassino.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("sapecas-cassino.html successfully updated!")
