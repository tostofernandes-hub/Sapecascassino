#!/usr/bin/env python3
import re

with open('sapecas-cassino.html', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace Liar's Bar from // 18. JOGO LIAR'S BAR up to window.addEventListener('DOMContentLoaded'
old_liars_start = code.find("// 18. JOGO LIAR'S BAR")
old_liars_end = code.find("// Init App on Window Load", old_liars_start)

if old_liars_start == -1 or old_liars_end == -1:
    print("Could not locate old Liar's Bar markers. Searching alternative...")
    old_liars_start = code.find("let currentLiarsRoomId = null;")
    old_liars_end = code.find("window.addEventListener('DOMContentLoaded'", old_liars_start)

print(f"Found markers: start={old_liars_start}, end={old_liars_end}")

new_liars_bar_code = '''// 18. JOGO LIAR'S BAR — MULTIPLAYER REAL ATÉ 5 JOGADORES COM ROLETA RUSSA E PERSONAGENS SVG
    let currentLiarsRoomId = null;
    let liarsSelectedCards = [];
    let liarsBetAmount = 100;

    // Character profiles for Liar's Bar (detailed SVG characters)
    const LIARS_CHARACTERS = {
      usr_capitao: { name: 'Capitão Scruffy', type: 'scruffy', title: 'Lobo Blefador', color: '#ea580c' },
      usr_barao:   { name: 'Barão Von Pork',   type: 'von_pork', title: 'Porco Monóculo', color: '#10b981' },
      usr_dama:    { name: 'Dama Raposa',      type: 'fox',      title: 'Raposa Astuta', color: '#f43f5e' },
      usr_rei:     { name: 'Touro Bravo',      type: 'bull',     title: 'Touro de Ouro', color: '#f59e0b' },
      usr_sapeca:  { name: 'Gato Mestre',      type: 'cat',      title: 'Gato Trapaceiro', color: '#a855f7' }
    };

    function getPlayerCharacter(userId, fallbackIndex = 0) {
      if (LIARS_CHARACTERS[userId]) return LIARS_CHARACTERS[userId];
      const keys = Object.keys(LIARS_CHARACTERS);
      const k = keys[fallbackIndex % keys.length];
      return LIARS_CHARACTERS[k];
    }

    /**
     * Gera ilustrações SVG detalhadas dos personagens com sistema dinâmico de ferimentos:
     * - 0 tiros: terno impecável, olhar confiante.
     * - 1 tiro: 1 buraco de bala no peito com fumaça, queimadura de pólvora e animação de impacto.
     * - 2 tiros: 2 buracos de bala com sangue escorrendo, olhos atordoados e crânio de eliminação.
     */
    function renderCharacterSvg(charType, wounds = 0, isLarge = false, isDead = false) {
      const size = isLarge ? 120 : 64;
      const strokeW = isLarge ? 2 : 1.5;

      let headColor = '#d97706';
      let suitColor = '#1f2937';
      let earPath = '';
      let features = '';

      if (charType === 'scruffy') { // Lobo/Doberman Noir
        headColor = '#475569';
        suitColor = '#1e1b4b';
        earPath = '<polygon points="28,24 16,6 36,16" fill="#334155" stroke="#1e293b" /><polygon points="52,24 64,6 44,16" fill="#334155" stroke="#1e293b" />';
        features = `
          <!-- Fedora Hat -->
          <ellipse cx="40" cy="18" rx="28" ry="6" fill="#0f172a" stroke="#f59e0b" stroke-width="${strokeW}"/>
          <path d="M22,18 C22,6 58,6 58,18 Z" fill="#1e293b"/>
          <rect x="22" y="15" width="36" height="3" fill="#ea580c"/>
          <!-- Muzzle & Cigar -->
          <polygon points="36,32 44,32 40,38" fill="#0f172a"/>
          <line x1="40" y1="38" x2="40" y2="44" stroke="#0f172a" stroke-width="1.5"/>
          <rect x="42" y="40" width="12" height="3" rx="1.5" fill="#78350f" transform="rotate(-10 42 40)"/>
          <circle cx="54" cy="38" r="1.5" fill="#f97316"/>
        `;
      } else if (charType === 'von_pork') { // Porco Monóculo
        headColor = '#f472b6';
        suitColor = '#064e3b';
        earPath = '<ellipse cx="20" cy="22" rx="7" ry="9" fill="#f472b6" stroke="#db2777"/><ellipse cx="60" cy="22" rx="7" ry="9" fill="#f472b6" stroke="#db2777"/>';
        features = `
          <!-- Bowler Hat -->
          <ellipse cx="40" cy="16" rx="26" ry="5" fill="#14532d"/>
          <path d="M26,16 C26,4 54,4 54,16 Z" fill="#166534" stroke="#f59e0b" stroke-width="1"/>
          <!-- Snout -->
          <ellipse cx="40" cy="36" rx="10" ry="7" fill="#fbcfe8" stroke="#db2777" stroke-width="1.5"/>
          <circle cx="37" cy="36" r="2" fill="#be185d"/><circle cx="43" cy="36" r="2" fill="#be185d"/>
          <!-- Golden Monocle -->
          <circle cx="48" cy="28" r="6" fill="none" stroke="#fbbf24" stroke-width="2"/>
          <line x1="53" y1="32" x2="58" y2="48" stroke="#fbbf24" stroke-width="1.2"/>
        `;
      } else if (charType === 'fox') { // Dama Raposa
        headColor = '#ea580c';
        suitColor = '#881337';
        earPath = '<polygon points="26,26 14,8 36,18" fill="#ea580c" stroke="#9a3412"/><polygon points="26,24 18,12 33,18" fill="#ffedd5"/><polygon points="54,26 66,8 44,18" fill="#ea580c" stroke="#9a3412"/><polygon points="54,24 62,12 47,18" fill="#ffedd5"/>';
        features = `
          <!-- White Cheeks -->
          <path d="M22,34 Q40,46 40,44 Q40,46 58,34 Q40,48 22,34 Z" fill="#ffedd5"/>
          <polygon points="37,38 43,38 40,42" fill="#0f172a"/>
          <!-- Red Rose Flower on Ear -->
          <circle cx="24" cy="18" r="5" fill="#e11d48"/>
          <circle cx="24" cy="18" r="2.5" fill="#ffe4e6"/>
          <!-- Pearl Necklace -->
          <circle cx="34" cy="54" r="2" fill="#fff"/><circle cx="40" cy="55" r="2.5" fill="#fff"/><circle cx="46" cy="54" r="2" fill="#fff"/>
        `;
      } else if (charType === 'bull') { // Touro Bravo
        headColor = '#78350f';
        suitColor = '#451a03';
        earPath = '<path d="M20,18 Q8,10 6,2 Q16,8 24,14 Z" fill="#fef08a" stroke="#b45309" stroke-width="1.5"/><path d="M60,18 Q72,10 74,2 Q64,8 56,14 Z" fill="#fef08a" stroke="#b45309" stroke-width="1.5"/>';
        features = `
          <!-- Horns & Septum Ring -->
          <ellipse cx="40" cy="38" rx="14" ry="9" fill="#92400e"/>
          <circle cx="35" cy="38" r="2.5" fill="#000"/><circle cx="45" cy="38" r="2.5" fill="#000"/>
          <!-- Golden Nose Ring -->
          <circle cx="40" cy="44" r="5" fill="none" stroke="#fbbf24" stroke-width="2.5"/>
        `;
      } else { // Gato Mestre
        headColor = '#cbd5e1';
        suitColor = '#3b0764';
        earPath = '<polygon points="24,24 16,8 34,16" fill="#cbd5e1" stroke="#64748b"/><polygon points="56,24 64,8 46,16" fill="#cbd5e1" stroke="#64748b"/>';
        features = `
          <!-- Cat Whiskers -->
          <line x1="18" y1="36" x2="30" y2="38" stroke="#fff" stroke-width="1.2"/>
          <line x1="18" y1="42" x2="30" y2="41" stroke="#fff" stroke-width="1.2"/>
          <line x1="62" y1="36" x2="50" y2="38" stroke="#fff" stroke-width="1.2"/>
          <line x1="62" y1="42" x2="50" y2="41" stroke="#fff" stroke-width="1.2"/>
          <polygon points="38,36 42,36 40,39" fill="#f43f5e"/>
        `;
      }

      // Eyes based on damage state
      let eyesHtml = '';
      if (wounds >= 2 || isDead) {
        // Knocked out X X eyes
        eyesHtml = `
          <g stroke="#ef4444" stroke-width="2">
            <line x1="30" y1="24" x2="36" y2="30"/><line x1="36" y1="24" x2="30" y2="30"/>
            <line x1="44" y1="24" x2="50" y2="30"/><line x1="50" y1="24" x2="44" y2="30"/>
          </g>
        `;
      } else if (wounds === 1) {
        // Tense, nervous, squinting eyes with sweat drop
        eyesHtml = `
          <ellipse cx="33" cy="27" rx="3" ry="2" fill="#000"/>
          <ellipse cx="47" cy="27" rx="3" ry="2" fill="#000"/>
          <!-- Sweat Drop -->
          <path d="M22,26 Q20,30 22,32 Q24,30 22,26 Z" fill="#38bdf8"/>
        `;
      } else {
        // Sharp, confident eyes
        eyesHtml = `
          <circle cx="33" cy="27" r="3" fill="#0f172a"/><circle cx="34" cy="26" r="1" fill="#fff"/>
          <circle cx="47" cy="27" r="3" fill="#0f172a"/><circle cx="48" cy="26" r="1" fill="#fff"/>
        `;
      }

      // Chest Wounds Layer
      let chestWoundsHtml = '';
      if (wounds >= 1) {
        // First bullet hole: charred rim, burn center, smoke ring
        chestWoundsHtml += `
          <circle cx="34" cy="62" r="5" fill="#0a0505" stroke="#dc2626" stroke-width="1.8"/>
          <circle cx="34" cy="62" r="2.5" fill="#000"/>
          <!-- Smoke / Powder Burn -->
          <circle cx="34" cy="62" r="7" fill="none" stroke="rgba(239,68,68,0.4)" stroke-dasharray="2,2"/>
        `;
      }
      if (wounds >= 2) {
        // Second bullet hole with dripping blood streams running down
        chestWoundsHtml += `
          <circle cx="46" cy="65" r="5.5" fill="#0a0505" stroke="#b91c1c" stroke-width="2"/>
          <circle cx="46" cy="65" r="3" fill="#000"/>
          <!-- Dripping Blood Stream (1st wound) -->
          <path class="blood-drip" d="M34,66 Q33,74 35,79" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" fill="none"/>
          <!-- Dripping Blood Stream (2nd wound) -->
          <path class="blood-drip" d="M46,70 Q47,76 45,82" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <circle cx="35" cy="80" r="1.5" fill="#dc2626"/>
          <circle cx="45" cy="83" r="1.8" fill="#dc2626"/>
        `;
      }

      return `
        <svg width="${size}" height="${size}" viewBox="0 0 80 80" class="${wounds === 1 ? 'hit-recoil-1' : wounds >= 2 ? 'hit-recoil-2' : ''}" style="overflow: visible; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.6));">
          <!-- Torso & Suit -->
          <path d="M16,52 L64,52 L68,80 L12,80 Z" fill="${suitColor}" stroke="#000" stroke-width="${strokeW}"/>
          <!-- Shirt Collar & Red Tie -->
          <polygon points="34,52 46,52 43,62 37,62" fill="#fff"/>
          <polygon points="38,54 42,54 41,70 39,70" fill="#dc2626"/>

          <!-- Dynamic Chest Wounds (First & Second Shot) -->
          ${chestWoundsHtml}

          <!-- Ears -->
          ${earPath}

          <!-- Head Base -->
          <circle cx="40" cy="32" r="18" fill="${headColor}" stroke="#000" stroke-width="${strokeW}"/>

          <!-- Unique Character Features (Hat, Monocle, Snout, etc.) -->
          ${features}

          <!-- Eyes & Expressions -->
          ${eyesHtml}

          <!-- Skull Elimination Overlay if 2 wounds -->
          ${wounds >= 2 || isDead ? `
            <rect x="18" y="32" width="44" height="15" rx="4" fill="rgba(15, 23, 42, 0.9)" stroke="#ef4444" stroke-width="1"/>
            <text x="40" y="43" font-size="8" font-weight="900" fill="#ef4444" text-anchor="middle" font-family="sans-serif">ELIMINADO</text>
          ` : ''}
        </svg>
      `;
    }

    /**
     * Russian Roulette State Engine
     * - 3 câmaras totais, 1 bala carregada.
     * - A cada tiro sem bala, uma câmara é eliminada (3 -> 2 -> 1).
     * - Se houve 2 tiros sem bala, o próximo tiro é 100% garantido com bala!
     * - Acertar a bala = perde 1 vida (o jogador possui 2 vidas no total).
     * - Perder as 2 vidas = eliminado do jogo, mas permanece em Modo Espectador.
     */
    let rouletteState = {
      isOpen: false,
      victimId: null,
      victimName: 'Jogador',
      victimCharType: 'scruffy',
      chambersRemaining: 3,
      currentLife: 2,
      onCompleteCallback: null
    };

    function startRussianRoulette(victimId, victimName, callback) {
      const room = DB.salas.getById(currentLiarsRoomId);
      const state = DB.estadoSalas.get(currentLiarsRoomId);
      if (!room || !state) return;

      const pSt = state.players.find(p => p.id === victimId);
      const charInfo = getPlayerCharacter(victimId);

      rouletteState.isOpen = true;
      rouletteState.victimId = victimId;
      rouletteState.victimName = victimName;
      rouletteState.victimCharType = charInfo.type;
      rouletteState.chambersRemaining = pSt ? (pSt.chambersRemaining || 3) : 3;
      rouletteState.currentLife = pSt ? pSt.lives : 2;
      rouletteState.onCompleteCallback = callback;

      const modal = document.getElementById('russian-roulette-modal');
      modal.style.display = 'flex';

      document.getElementById('roulette-victim-name').innerText = `${victimName} enfrenta o revólver!`;
      document.getElementById('roulette-victim-sub').innerText = `O tambor possui ${rouletteState.chambersRemaining} câmara(s) disponível(is) e 1 bala carregada.`;
      
      updateRouletteModalStage();

      const isMe = victimId === currentUser.id;
      const triggerBtn = document.getElementById('btn-pull-trigger');
      if (triggerBtn) {
        if (isMe) {
          triggerBtn.disabled = false;
          triggerBtn.style.opacity = '1';
          triggerBtn.innerText = 'PUXAR O GATILHO! 🎯 (SUA SORTE)';
        } else {
          triggerBtn.disabled = true;
          triggerBtn.style.opacity = '0.7';
          triggerBtn.innerText = `Aguardando ${victimName} puxar o gatilho... 🎯`;
          // Automatic trigger for opponents / bots after dramatic suspense
          setTimeout(() => {
            if (rouletteState.isOpen) executeRussianRouletteTrigger();
          }, 1800);
        }
      }
    }

    function updateRouletteModalStage(isFired = false, wasBullet = false) {
      const wounds = 2 - rouletteState.currentLife;
      const stageEl = document.getElementById('roulette-character-stage');
      if (stageEl) {
        stageEl.innerHTML = renderCharacterSvg(rouletteState.victimCharType, wounds, true, rouletteState.currentLife <= 0);
      }

      // Update Odds badge
      const countEl = document.getElementById('roulette-chambers-count');
      const badgeEl = document.getElementById('roulette-odds-badge');
      const rem = rouletteState.chambersRemaining;
      
      let oddsText = '';
      if (rem === 3) oddsText = '3 / 3 (Risco: 1 em 3 · 33.3%)';
      else if (rem === 2) oddsText = '2 / 3 (1 câmara vazia eliminada · Risco: 1 em 2 · 50.0%)';
      else oddsText = '1 / 3 (2 câmaras vazias eliminadas · BALA GARANTIDA! · 100%)';

      if (countEl) countEl.innerText = oddsText;
      if (badgeEl) {
        badgeEl.style.borderColor = rem === 1 ? '#ef4444' : rem === 2 ? '#f59e0b' : '#ea580c';
      }

      // Visual chamber marks on SVG cylinder
      const c1 = document.getElementById('chamber-slot-1');
      const c2 = document.getElementById('chamber-slot-2');
      const c3 = document.getElementById('chamber-slot-3');
      if (c1 && c2 && c3) {
        c1.setAttribute('fill', rem < 3 ? '#374151' : '#0d0302');
        c2.setAttribute('fill', rem < 2 ? '#374151' : '#0d0302');
        c3.setAttribute('fill', '#0d0302');
      }
    }

    function executeRussianRouletteTrigger() {
      const triggerBtn = document.getElementById('btn-pull-trigger');
      if (triggerBtn) triggerBtn.disabled = true;

      const cylinderSvg = document.getElementById('roulette-cylinder-svg');
      if (cylinderSvg) {
        cylinderSvg.classList.remove('cylinder-spinning');
        void cylinderSvg.offsetWidth;
        cylinderSvg.classList.add('cylinder-spinning');
      }

      audio.click();
      document.getElementById('roulette-result-text').innerText = 'Girando o tambor... Puxando o cão...';

      setTimeout(() => {
        // Evaluate shot
        const rem = rouletteState.chambersRemaining;
        let isBullet = false;

        if (rem <= 1) {
          // Guaranteed bullet! Exactly as specified: "Se já houve dois tiros sem bala, o próximo tiro terá a bala"
          isBullet = true;
        } else if (rem === 2) {
          // 1 bullet in 2 chambers (50%)
          isBullet = Math.random() < 0.5;
        } else {
          // 1 bullet in 3 chambers (33.3%)
          isBullet = Math.random() < 0.3333;
        }

        const room = DB.salas.getById(currentLiarsRoomId);
        const state = DB.estadoSalas.get(currentLiarsRoomId);
        const pSt = state ? state.players.find(p => p.id === rouletteState.victimId) : null;

        if (!isBullet) {
          // BLANK SHOT: Discard 1 empty chamber!
          rouletteState.chambersRemaining -= 1;
          if (pSt) pSt.chambersRemaining = rouletteState.chambersRemaining;

          audio.click();
          document.getElementById('roulette-result-text').innerHTML = `
            <span style="color: #34d399; font-size: 13px;">💨 *CLIQUE SECO!* CÂMARA VAZIA!</span><br>
            A câmara foi eliminada! Restam <strong>${rouletteState.chambersRemaining}</strong> câmara(s). ${rouletteState.victimName} sobreviveu!
          `;
          updateRouletteModalStage(true, false);

          setTimeout(() => {
            closeRussianRouletteModal();
            if (rouletteState.onCompleteCallback) rouletteState.onCompleteCallback(false);
          }, 2400);

        } else {
          // BULLET HIT: Gunshot explosion!
          audio.loss();
          document.body.classList.add('screen-flash-red');
          setTimeout(() => document.body.classList.remove('screen-flash-red'), 600);

          rouletteState.currentLife -= 1;
          rouletteState.chambersRemaining = 3; // Reset cylinder for future punishment
          if (pSt) {
            pSt.lives = rouletteState.currentLife;
            pSt.chambersRemaining = 3;
            if (pSt.lives <= 0) pSt.isEliminated = true;
          }

          if (rouletteState.currentLife === 1) {
            // 1st shot taken: 1 bullet hole on chest
            document.getElementById('roulette-result-text').innerHTML = `
              <span style="color: #ef4444; font-size: 14px;">💥 BANG! O TIRO DISPAROU!</span><br>
              ${rouletteState.victimName} levou um tiro no peito! <strong>1 vida restante (❤️)</strong>.
            `;
          } else {
            // 2nd shot taken: 2 bullet holes with blood! ELIMINATED!
            document.getElementById('roulette-result-text').innerHTML = `
              <span style="color: #ef4444; font-size: 14px;">💀 BANG! SEGUNDO TIRO FATAL!</span><br>
              ${rouletteState.victimName} foi <strong>ELIMINADO DO JOGO</strong> e entra em <strong>Modo Espectador</strong>!
            `;
          }

          updateRouletteModalStage(true, true);

          setTimeout(() => {
            closeRussianRouletteModal();
            if (rouletteState.onCompleteCallback) rouletteState.onCompleteCallback(true);
          }, 3200);
        }

        if (room && state) {
          DB.estadoSalas.set(room.id, state);
        }
      }, 1400);
    }

    function closeRussianRouletteModal() {
      rouletteState.isOpen = false;
      document.getElementById('russian-roulette-modal').style.display = 'none';
    }

    // -------------------------------------------------------------
    // RENDER LIAR'S BAR LOBBY & TABLE
    // -------------------------------------------------------------
    function renderLiarsBar(container) {
      if (!currentLiarsRoomId) {
        // Lobby view of Liar's Bar
        const rooms = DB.salas.getByGame('liars-bar');
        container.innerHTML = `
          <div class="game-viewport">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <button class="btn-dark" onclick="navigate('lobby')">← Lobby</button>
              <span style="font-size: 13px; font-weight: bold; color: #fbbf24;" class="font-cinzel">😈 Liar's Bar Multiplayer (Até 5 Jogadores)</span>
              <button class="btn-gold" style="padding: 6px 14px; font-size: 11px;" onclick="createNewLiarsRoom()">+ Criar Sala 😈</button>
            </div>

            <div class="felt-box" style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start; padding: 12px; gap: 8px;">
              <div style="font-size: 12px; color: #fed7aa; text-align: center; display: flex; justify-content: center; align-items: center; gap: 6px;">
                <span>Salas multiplayer sincronizadas via</span>
                <strong style="color: #34d399;">Supabase Realtime</strong>
                <span>(ou entre abas via Storage).</span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: calc(100vh - 200px);">
                ${rooms.length === 0 ? '<div style="color: #fdba74; text-align: center; padding: 20px;">Nenhuma taverna aberta no momento. Crie a primeira mesa de blefe!</div>' : 
                  rooms.map(r => {
                    const hostUser = DB.usuarios.getById(r.criadorId);
                    const isInside = r.jogadoresIds.includes(currentUser.id);
                    return `
                      <div style="background: #250d09; border: 1.5px solid rgba(249,115,22,0.3); border-radius: 10px; padding: 10px; display: flex; justify-content: space-between; align-items: center;">
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
              <span style="font-size: 11px; color: #fed7aa;">Regra: Até 5 jogadores · 2 vidas cada · Roleta russa de 3 câmaras para quem mentir ou duvidar errado!</span>
              <button class="btn-dark" onclick="showRules('Liar\\'s Bar com Roleta Russa', 'Regras do Liar\\'s Bar:\\n1. Cada jogador tem 2 vidas e recebe 5 cartas.\\n2. A mesa exige Ás (A), Rei (K) ou Dama (Q). Diabo (😈) é coringa.\\n3. Na sua vez, jogue de 1 a 3 cartas alegando serem da figura exigida.\\n4. O próximo jogador pode DUVIDAR ou continuar jogando.\\n5. Quem perder o desafio enfrenta o revólver na Roleta Russa: tambor com 3 câmaras e 1 bala carregada! Tiros vazios eliminam a câmara. Ao perder as 2 vidas, o jogador é eliminado mas continua assistindo como espectador!')">Como Jogar</button>
            </div>
          </div>
        `;
        return;
      }

      // Inside Active Liar's Bar Table
      const room = DB.salas.getById(currentLiarsRoomId);
      if (!room) {
        currentLiarsRoomId = null;
        renderLiarsBar(container);
        return;
      }

      const state = DB.estadoSalas.get(currentLiarsRoomId) || DB.estadoSalas.initRoomState(room.id, 'liars-bar', room.jogadoresIds);
      const isMyTurn = state.turnPlayerId === currentUser.id;
      const turnUser = DB.usuarios.getById(state.turnPlayerId);
      const myP = state.players.find(p => p.id === currentUser.id) || { lives: 2, hand: ['A', 'K', 'Q', 'DEVIL', 'K'], chambersRemaining: 3, isEliminated: false };
      const isMeEliminated = myP.isEliminated || myP.lives <= 0;

      // Render players around the table with detailed SVG portraits and wound indicators
      const seatedHtml = room.jogadoresIds.map((pId, idx) => {
        const u = DB.usuarios.getById(pId);
        const pSt = state.players.find(p => p.id === pId) || { lives: 2, hand: [], chambersRemaining: 3, isEliminated: false };
        const isTurn = state.turnPlayerId === pId;
        const isMe = pId === currentUser.id;
        const charInfo = getPlayerCharacter(pId, idx);
        const wounds = 2 - Math.max(0, pSt.lives);

        return `
          <div style="background: ${isTurn ? '#3f130a' : '#1a0604'}; border: 1.5px solid ${isTurn ? '#fbbf24' : 'rgba(249,115,22,0.3)'}; border-radius: 10px; padding: 6px; text-align: center; min-width: 95px; display: flex; flex-direction: column; align-items: center; gap: 2px;">
            ${renderCharacterSvg(charInfo.type, wounds, false, pSt.isEliminated)}
            <div style="font-size: 11px; font-weight: bold; color: ${isMe ? '#fbbf24' : '#fff'}; margin-top: 2px;">
              ${charInfo.name} ${isMe ? '(Você)' : ''}
            </div>
            <!-- Lives Display (2 Lives max: ❤️❤️ or 💀) -->
            <div style="font-size: 12px; margin: 1px 0;">
              ${pSt.isEliminated || pSt.lives <= 0 ? '<span style="font-size: 10px; color: #ef4444; font-weight: 900;">💀 ESPECTADOR</span>' : (pSt.lives === 2 ? '❤️❤️' : '❤️🖤')}
            </div>
            <div style="font-size: 9px; color: #fed7aa;">
              ${pSt.isEliminated ? 'Eliminado' : `${(pSt.hand || []).length} carta(s)`}
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = `
        <div class="game-viewport">
          <!-- Table Header -->
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <button class="btn-dark" onclick="leaveLiarsRoom()">← Sair do Bar</button>
            <span style="font-size: 13px; font-weight: bold; color: #fbbf24;" class="font-cinzel">😈 ${room.nomeSala} (${room.jogadoresIds.length}/5)</span>
            <div style="background: #250d09; border: 1.5px solid #f59e0b; border-radius: 6px; padding: 2px 10px; font-size: 11px; font-weight: bold; color: #fbbf24;">
              MESA EXIGE: ${state.target === 'A' ? 'ÁSES (A) ♠' : state.target === 'K' ? 'REIS (K) 👑' : 'DAMAS (Q) 👸'}
            </div>
          </div>

          <!-- Waiting / Turn Notification -->
          ${room.jogadoresIds.length < 2 ? `
            <div style="background: rgba(234, 88, 12, 0.2); border: 1px solid #ea580c; border-radius: 8px; padding: 4px 10px; text-align: center; font-size: 11px; color: #fed7aa; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span class="pulse-dot"></span> Aguardando mais jogadores... (${room.jogadoresIds.length}/5). Abra em outra aba ou compartilhe para jogar em multiplayer real!
            </div>
          ` : `
            <div style="background: rgba(52, 211, 153, 0.15); border: 1px solid rgba(52, 211, 153, 0.4); border-radius: 8px; padding: 4px 10px; text-align: center; font-size: 11px; color: #a7f3d0;">
              ${isMeEliminated ? '<span style="color: #ef4444; font-weight: 900;">💀 VOCÊ ESTÁ NO MODO ESPECTADOR (ASSISTINDO À PARTIDA)</span>' : 
                `Vez de jogar: <strong style="color: #fbbf24;">${turnUser ? turnUser.nomeUsuario : 'Jogador'}</strong> ${isMyTurn ? '<span style="color: #34d399; font-weight: 900;">(SUA VEZ DE JOGAR OU DUVIDAR!)</span>' : ''}`}
            </div>
          `}

          <!-- Table Arena Felt -->
          <div class="felt-box" style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 8px;">
            <!-- Opponents & Seated Players (Up to 5) -->
            <div style="display: flex; justify-content: center; gap: 6px; flex-wrap: wrap;">
              ${seatedHtml}
            </div>

            <!-- Table Center Cards / Pot Announcement -->
            <div id="liars-center" style="text-align: center; margin: 4px 0; min-height: 48px;">
              ${state.lastPlay ? `
                <div style="font-size: 11px; color: #fed7aa; margin-bottom: 4px;">
                  <strong style="color: #fbbf24;">${DB.usuarios.getById(state.lastPlay.playerId)?.nomeUsuario || 'Jogador'}</strong> jogou ${state.lastPlay.count} carta(s) alegando serem ${state.target}:
                </div>
                <div style="display: flex; justify-content: center; gap: 6px;">
                  ${Array.from({length: state.lastPlay.count}, () => '<div class="card-3d-wrap"><div class="card-3d hidden-card">♠</div></div>').join('')}
                </div>
              ` : '<div style="font-size: 11px; color: #fdba74;">Aguardando primeira declaração da rodada... O Diabo 😈 é coringa universal!</div>'}
            </div>

            <!-- Player Hand -->
            <div style="border-top: 1px solid rgba(249,115,22,0.25); padding-top: 4px;">
              <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px;">
                <span style="font-weight: bold; color: #fff;">
                  Sua Mão (${currentUser.username}): ${isMeEliminated ? '<span style="color: #ef4444;">Modo Espectador</span>' : (myP.lives === 2 ? '❤️❤️' : '❤️🖤')}
                </span>
                <span style="color: #fbbf24;">${liarsSelectedCards.length} selecionada(s) (Máx 3)</span>
              </div>
              <div style="display: flex; justify-content: center; gap: 6px; overflow-x: auto; padding: 2px 0;">
                ${isMeEliminated ? '<div style="font-size: 11px; color: #94a3b8; padding: 10px;">Você foi eliminado e está assistindo a partida até o vencedor final ser coroado.</div>' :
                  myP.hand.map((c, i) => `
                    <button class="btn-dark" style="padding: 6px 12px; font-size: 13px; font-weight: 900; border: 2px solid ${liarsSelectedCards.includes(i) ? '#fbbf24' : 'rgba(249,115,22,0.3)'}; background: ${liarsSelectedCards.includes(i) ? '#78350f' : '#240d09'}; min-width: 48px;" onclick="toggleLiarsCard(${i})">
                      ${c === 'DEVIL' ? '😈 Diabo' : c}
                    </button>
                  `).join('')
                }
              </div>
            </div>

            <div style="font-size: 10px; color: #fdba74; text-align: center;">
              ${state.announcement || 'Jogue cartas da figura exigida ou blefe com convicção! O Diabo 😈 conta como qualquer figura.'}
            </div>
          </div>

          <!-- Bottom Actions (Strict 100vh with Standard Betting & Card Game Controls) -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 4px 8px;">
              <div style="display: flex; gap: 4px; align-items: center;">
                <span style="font-size: 10px; color: #fed7aa; text-transform: uppercase;">Aposta:</span>
                <button class="chip-btn active" onclick="setLiarsBet(100)">100</button>
                <button class="chip-btn" onclick="setLiarsBet(250)">250</button>
                <button class="chip-btn" onclick="setLiarsBet(500)">500</button>
              </div>
              <button class="btn-game-secondary" style="font-size: 11px; padding: 4px 10px;" onclick="increaseLiarsPot()" ${isMeEliminated || !isMyTurn ? 'disabled' : ''}>
                + Aumentar Pote (🪙 ${liarsBetAmount})
              </button>
            </div>

            <div style="display: flex; gap: 8px;">
              ${state.lastPlay && isMyTurn && !isMeEliminated ? `
                <button class="btn-gold" style="flex: 1; background: linear-gradient(135deg, #dc2626, #991b1b);" onclick="doubtLiarsPlayMulti()">DUVIDAR! (LIAR!) 🚨</button>
              ` : ''}
              <button class="btn-gold" style="flex: 1;" onclick="playLiarsCardsMulti()" ${!isMyTurn || isMeEliminated ? 'disabled' : ''}>
                JOGAR CARTAS SELECIONADAS (${liarsSelectedCards.length}) 🃏
              </button>
              <button class="btn-dark" onclick="showRules('Liar\\'s Bar & Roleta Russa', '1. Jogue de 1 a 3 cartas dizendo serem da figura da mesa.\\n2. Diabo 😈 é coringa.\\n3. Se o próximo duvidar e você mentiu, você encara o revólver!\\n4. Se ele duvidar e você falou a verdade, ele encara o revólver!\\n5. O revólver tem 3 câmaras e 1 bala. Tiros vazios eliminam a câmara.\\n6. Ao perder 2 vidas você entra em modo espectador!')">Como Jogar</button>
            </div>
          </div>
        </div>
      `;
    }

    function setLiarsBet(amt) {
      liarsBetAmount = amt;
      audio.chip();
    }

    function increaseLiarsPot() {
      if (!currentLiarsRoomId) return;
      const room = DB.salas.getById(currentLiarsRoomId);
      const state = DB.estadoSalas.get(currentLiarsRoomId);
      if (!room || !state) return;

      if (currentUser.balance < liarsBetAmount) {
        alert('Saldo insuficiente para aumentar o pote!');
        return;
      }
      currentUser.saldoFichas -= liarsBetAmount;
      currentUser.balance = currentUser.saldoFichas;
      DB.usuarios.updateBalance(currentUser.id, -liarsBetAmount);
      logAction(-liarsBetAmount, false, "Liar's Bar", 'Aumento de aposta no pote');

      state.pot = (state.pot || 500) + liarsBetAmount;
      state.announcement = `${currentUser.username} aumentou o pote da mesa em ${liarsBetAmount} fichas! Pote total: ${state.pot} 🪙`;
      DB.estadoSalas.set(room.id, state);
      audio.chip();
      renderLiarsBar(document.getElementById('main-content'));
    }

    function createNewLiarsRoom() {
      const name = prompt('Digite o nome da mesa do Liar\\'s Bar (até 5 jogadores):', 'Taverna dos Blefadores VIP');
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
      if (!myP || myP.isEliminated || myP.lives <= 0) return;

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
        if (candP && !candP.isEliminated && candP.lives > 0) {
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

      // Reveal truth vs bluff
      const wasBluff = state.lastPlay.actualCards.some(c => c !== state.target && c !== 'DEVIL');
      const loser = wasBluff ? accused : challenger;
      const loserUser = wasBluff ? accusedUser : challengerUser;
      const loserId = wasBluff ? state.lastPlay.playerId : currentUser.id;
      const loserName = loserUser ? (loserUser.nomeUsuario || loserUser.username) : 'Jogador';

      incStandaloneCounter('liars_bluffs', 1);

      // Trigger the Russian Roulette Gun Challenge on the loser!
      startRussianRoulette(loserId, loserName, (bulletHit) => {
        // Callback after Russian Roulette finishes
        const updatedState = DB.estadoSalas.get(currentLiarsRoomId);
        if (!updatedState) return;

        // Check active / alive players
        const alivePlayers = updatedState.players.filter(p => !p.isEliminated && p.lives > 0);

        if (alivePlayers.length <= 1) {
          // Table Winner!
          const winner = alivePlayers[0] || updatedState.players[0];
          const winnerUser = DB.usuarios.getById(winner.id);
          const prize = (updatedState.pot || 500) + 5000;

          DB.usuarios.updateBalance(winner.id, prize);
          logAction(prize, true, "Liar's Bar", `Grande Campeão do Bar! +${prize} fichas`);
          alert(`🏆 PARABÉNS! ${winnerUser ? winnerUser.nomeUsuario : 'Jogador'} sobreviveu a todos os desafios da Roleta Russa e levou o pote de ${prize.toLocaleString('pt-BR')} fichas!`);
          
          // Reset room state
          DB.estadoSalas.initRoomState(room.id, 'liars-bar', room.jogadoresIds);
        } else {
          // Start next round with new target
          const targets = ['A', 'K', 'Q'];
          updatedState.target = targets[Math.floor(Math.random() * targets.length)];
          updatedState.lastPlay = null;
          
          // Determine next turn player
          updatedState.turnPlayerId = (!loser.isEliminated && loser.lives > 0) ? loser.id : alivePlayers[0].id;
          
          const cardPool = ['A', 'K', 'Q', 'A', 'K', 'Q', 'DEVIL'];
          alivePlayers.forEach(p => {
            p.hand = Array.from({length: 5}, () => cardPool[Math.floor(Math.random() * cardPool.length)]);
          });

          updatedState.announcement = `Nova rodada! A mesa agora exige ${updatedState.target === 'A' ? 'Áses (A)' : updatedState.target === 'K' ? 'Reis (K)' : 'Damas (Q)'}.`;
          DB.estadoSalas.set(room.id, updatedState);
        }

        renderLiarsBar(document.getElementById('main-content'));
      });
    }
'''

code = code[:old_liars_start] + new_liars_bar_code + '\n\n    ' + code[old_liars_end:]

# Also ensure DB.estadoSalas.initRoomState initializes 2 lives instead of 3 for liars-bar:
code = code.replace("lives: 3,", "lives: 2,")

with open('sapecas-cassino.html', 'w', encoding='utf-8') as f:
    f.write(code)

print("Liar's Bar completely patched with Russian Roulette & SVG Characters!")
