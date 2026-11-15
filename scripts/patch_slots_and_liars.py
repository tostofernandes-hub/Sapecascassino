#!/usr/bin/env python3
import re

with open('sapecas-cassino.html', 'r', encoding='utf-8') as f:
    code = f.read()

# --------------------------------------------------------------------
# 1. FORTUNE DRAGON (SLOTS) REPLACEMENT
# --------------------------------------------------------------------
old_slots_section_pattern = r'/\*\*\s*\* FORTUNE DRAGON.*?function spinSlots\(\) \{.*?openFortuneDragonModal\(0, 0\);\s*\}\s*\}, 900\);\s*\}'

new_slots_section = '''/**
     * ============================================================================
     * FORTUNE DRAGON 3x3 — CALIBRAÇÃO MATEMÁTICA RIGOROSA DO RTP E HOUSE EDGE
     * ============================================================================
     * Conforme diretriz técnica:
     * 1. O MULTIPLICADOR ESPECIAL DA FORTUNA (RODA SUPERIOR) FOI COMPLETAMENTE REMOVIDO.
     * 2. O ganho é determinado exclusivamente pela linha central dos 3 rolos.
     * 3. A tabela de pagamentos e pesos foi matematicamente recalibrada para que a
     *    Vantagem da Casa (House Edge) situe-se precisamente entre 4.0% e 12.0%
     *    (RTP entre 88.0% e 96.0%).
     *
     * TABELA DE SÍMBOLOS, MULTIPLICADORES E PROBABILIDADES:
     * - 🐉 Dragão Wild:       Mult 100x | Probabilidade por rolo: 5.0%  (p = 0.05)
     * - 🪙 Moeda Imperial:    Mult  50x | Probabilidade por rolo: 9.0%  (p = 0.09)
     * - 💰 Saco de Ouro:      Mult  25x | Probabilidade por rolo: 16.0% (p = 0.16)
     * - 🧧 Envelope Vermelho: Mult  15x | Probabilidade por rolo: 20.0% (p = 0.20)
     * - 🏮 Lanterna Sagrada:  Mult   8x | Probabilidade por rolo: 25.0% (p = 0.25)
     * - 🧨 Fogos da Sorte:    Mult   4x | Probabilidade por rolo: 25.0% (p = 0.25)
     * Soma total das probabilidades por rolo = 1.0000 (100.0%)
     *
     * CÁLCULO EXATO DE RETORNO (RTP COM WILD SUBSTITUTION):
     * O Dragão Wild (🐉) substitui qualquer símbolo para formar a melhor combinação da linha central.
     * Probabilidade e contribuição de cada trinca premiada:
     * - 🐉 3x Dragão Wild (100x):       (0.05)^3 = 0.0125% prob -> Contribuição:  1.25% RTP
     * - 🪙 3x Moeda Imperial (50x):    [p^3 + 3*p^2*w + 3*p*w^2] -> Contribuição: 13.09% RTP
     * - 💰 3x Saco de Ouro (25x):      [p^3 + 3*p^2*w + 3*p*w^2] -> Contribuição: 22.84% RTP
     * - 🧧 3x Envelope Vermelho (15x): [p^3 + 3*p^2*w + 3*p*w^2] -> Contribuição: 23.25% RTP
     * - 🏮 3x Lanterna Sagrada (8x):   [p^3 + 3*p^2*w + 3*p*w^2] -> Contribuição: 21.50% RTP
     * - 🧨 3x Fogos da Sorte (4x):     [p^3 + 3*p^2*w + 3*p*w^2] -> Contribuição: 10.75% RTP
     *
     * RESUMO MATEMÁTICO:
     * - Taxa Global de Acerto (Hit Rate): 8.11% dos giros
     * - RETORNO TEÓRICO TOTAL AO JOGADOR (RTP): 92.69%
     * - VANTAGEM DA CASA (HOUSE EDGE): 100% - 92.69% = 7.31%
     * Vantagem perfeitamente enquadrada na faixa regulamentada de 4% a 12% (RTP de 88% a 96%).
     * ============================================================================
     */
    function renderSlots(container) {
      container.innerHTML = `
        <div class="game-viewport">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <button class="btn-dark" onclick="navigate('lobby')">← Lobby</button>
            <span style="font-size: 13px; font-weight: bold; color: #fbbf24;" class="font-cinzel">🐉 Fortune Dragon 3x3</span>
            <span style="font-size: 11px; color: #34d399; font-weight: bold;">RTP: 92.69%</span>
          </div>

          <div class="felt-box" style="text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: space-around; padding: 10px;">
            <!-- Paytable Preview Ribbon -->
            <div style="background: rgba(18, 4, 3, 0.85); border: 1px solid rgba(249,115,22,0.4); border-radius: 8px; padding: 4px 8px; display: flex; justify-content: space-around; font-size: 10px; color: #fed7aa; flex-wrap: wrap; gap: 4px;">
              <span>🐉 <strong>100x</strong> (Wild)</span>
              <span>🪙 <strong>50x</strong></span>
              <span>💰 <strong>25x</strong></span>
              <span>🧧 <strong>15x</strong></span>
              <span>🏮 <strong>8x</strong></span>
              <span>🧨 <strong>4x</strong></span>
            </div>

            <!-- 3x3 Grid Reels with Central Line Indicator -->
            <div style="position: relative; max-width: 270px; margin: 0 auto; width: 100%;">
              <!-- Central Payline Markers -->
              <div style="position: absolute; left: -14px; top: 50%; transform: translateY(-50%); font-size: 14px; color: #fbbf24;">▶</div>
              <div style="position: absolute; right: -14px; top: 50%; transform: translateY(-50%); font-size: 14px; color: #fbbf24;">◀</div>

              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 8px; background: rgba(18, 4, 3, 0.7); border-radius: 12px; border: 2px solid rgba(249,115,22,0.4); width: 100%;">
                <div id="slot-0" class="card-3d-wrap" style="height: 52px; font-size: 26px; display: flex; align-items: center; justify-content: center; background: #250d09; border-radius: 8px; border: 1px solid rgba(249,115,22,0.3);">🐉</div>
                <div id="slot-1" class="card-3d-wrap" style="height: 52px; font-size: 26px; display: flex; align-items: center; justify-content: center; background: #250d09; border-radius: 8px; border: 1px solid rgba(249,115,22,0.3);">🪙</div>
                <div id="slot-2" class="card-3d-wrap" style="height: 52px; font-size: 26px; display: flex; align-items: center; justify-content: center; background: #250d09; border-radius: 8px; border: 1px solid rgba(249,115,22,0.3);">💰</div>
                <!-- Central Payline Slots (3, 4, 5) -->
                <div id="slot-3" class="card-3d-wrap" style="height: 54px; font-size: 28px; display: flex; align-items: center; justify-content: center; background: #3b120a; border-radius: 8px; border: 2px solid #fbbf24; box-shadow: 0 0 10px rgba(251,191,36,0.3);">🧧</div>
                <div id="slot-4" class="card-3d-wrap" style="height: 54px; font-size: 28px; display: flex; align-items: center; justify-content: center; background: #3b120a; border-radius: 8px; border: 2px solid #fbbf24; box-shadow: 0 0 10px rgba(251,191,36,0.3);">🏮</div>
                <div id="slot-5" class="card-3d-wrap" style="height: 54px; font-size: 28px; display: flex; align-items: center; justify-content: center; background: #3b120a; border-radius: 8px; border: 2px solid #fbbf24; box-shadow: 0 0 10px rgba(251,191,36,0.3);">🧨</div>
                <div id="slot-6" class="card-3d-wrap" style="height: 52px; font-size: 26px; display: flex; align-items: center; justify-content: center; background: #250d09; border-radius: 8px; border: 1px solid rgba(249,115,22,0.3);">🪙</div>
                <div id="slot-7" class="card-3d-wrap" style="height: 52px; font-size: 26px; display: flex; align-items: center; justify-content: center; background: #250d09; border-radius: 8px; border: 1px solid rgba(249,115,22,0.3);">💰</div>
                <div id="slot-8" class="card-3d-wrap" style="height: 52px; font-size: 26px; display: flex; align-items: center; justify-content: center; background: #250d09; border-radius: 8px; border: 1px solid rgba(249,115,22,0.3);">🐉</div>
              </div>
            </div>

            <div id="slots-status" style="font-size: 11px; font-weight: bold; color: #fbbf24; min-height: 18px;">Aposte 50 fichas e alinhe 3 símbolos na linha central destacada!</div>
          </div>

          <!-- Bottom Action Buttons (Strict 100vh) -->
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn-gold" style="flex: 1;" onclick="spinSlots()">GIRAR OS ROLOS (50 FICHAS) 🐉</button>
            <button class="btn-dark" onclick="showRules('Fortune Dragon 3x3', 'Combine 3 símbolos iguais na linha central para ganhar prêmios de até 100x a sua aposta! O Dragão Dourado 🐉 é WILD e substitui qualquer símbolo. RTP calibrado em 92.69% com Vantagem da Casa de 7.31%.')">Como Jogar</button>
          </div>
        </div>
      `;
    }

    // Fortune Dragon Symbols Table (Without Fortune Multiplier, Calibrated to 92.69% RTP)
    const slotSymbolsTable = [
      { sym: '🐉', name: 'Dragão Wild', mult: 100, weight: 0.05 },
      { sym: '🪙', name: 'Moeda Imperial', mult: 50, weight: 0.09 },
      { sym: '💰', name: 'Saco de Ouro', mult: 25, weight: 0.16 },
      { sym: '🧧', name: 'Envelope Vermelho', mult: 15, weight: 0.20 },
      { sym: '🏮', name: 'Lanterna Sagrada', mult: 8, weight: 0.25 },
      { sym: '🧨', name: 'Fogos da Sorte', mult: 4, weight: 0.25 }
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

    let slotsSpinning = false;
    function spinSlots() {
      if (slotsSpinning) return;
      if (currentUser.balance < 50) { alert('Saldo insuficiente!'); return; }
      currentUser.saldoFichas -= 50;
      currentUser.balance = currentUser.saldoFichas;
      DB.usuarios.updateBalance(currentUser.id, -50);
      logAction(-50, false, 'Fortune Dragon', 'Giro de rolos');
      audio.chip();
      slotsSpinning = true;
      document.getElementById('slots-status').innerText = 'Girando os rolos dourados...';

      // Spinning animation
      for (let i = 0; i < 9; i++) {
        const el = document.getElementById(`slot-${i}`);
        if (el) el.classList.add('reel-spinning');
      }

      setTimeout(() => {
        slotsSpinning = false;
        const grid = [];
        for (let i = 0; i < 9; i++) {
          const sym = getRandomSlotSymbol();
          grid.push(sym);
          const el = document.getElementById(`slot-${i}`);
          if (el) {
            el.classList.remove('reel-spinning');
            el.innerText = sym;
          }
        }

        // Check central line (slots 3, 4, 5) with Wild substitution
        const s0 = grid[3], s1 = grid[4], s2 = grid[5];
        const wild = '🐉';
        let winningSym = null;
        let bestMult = 0;

        for (const cand of slotSymbolsTable) {
          const m0 = (s0 === cand.sym || s0 === wild);
          const m1 = (s1 === cand.sym || s1 === wild);
          const m2 = (s2 === cand.sym || s2 === wild);
          if (m0 && m1 && m2) {
            if (cand.mult > bestMult) {
              bestMult = cand.mult;
              winningSym = cand.sym;
            }
          }
        }

        if (bestMult > 0 && winningSym) {
          const win = 50 * bestMult;
          currentUser.saldoFichas += win;
          currentUser.balance = currentUser.saldoFichas;
          DB.usuarios.updateBalance(currentUser.id, win);
          audio.win();
          logAction(win, true, 'Fortune Dragon', `3x ${winningSym} (${bestMult}x)`);
          document.getElementById('slots-status').innerText = `✨ GANHOU ${win.toLocaleString('pt-BR')} FICHAS! (3x ${winningSym} · ${bestMult}x)`;
          openFortuneDragonModal(bestMult, win);
        } else {
          audio.loss();
          document.getElementById('slots-status').innerText = 'Sem combinação na linha central. Tente novamente!';
        }
      }, 700);
    }'''

match = re.search(old_slots_section_pattern, code, flags=re.DOTALL)
if match:
    code = code[:match.start()] + new_slots_section + code[match.end():]
    print("Replaced old slots section successfully.")
else:
    print("Could not match old slots regex, attempting fallback replace...")
    if 'function renderSlots(container)' in code:
        # Find start of renderSlots up to renderCoinFlip
        start_idx = code.find('function renderSlots(container)')
        # backtrack to /** FORTUNE DRAGON
        comment_start = code.rfind('/**', 0, start_idx)
        end_idx = code.find('// 4. CARA OU COROA 3D', start_idx)
        if comment_start != -1 and end_idx != -1:
            code = code[:comment_start] + new_slots_section + '\n\n    ' + code[end_idx:]
            print("Fallback replaced slots section successfully.")

with open('sapecas-cassino.html', 'w', encoding='utf-8') as f:
    f.write(code)
print("Saved checkpoint 3.")
