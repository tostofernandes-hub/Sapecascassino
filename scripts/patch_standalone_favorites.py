import re
import os

def main():
    with open('sapecas-cassino.html', 'r', encoding='utf-8') as f:
        html = f.read()

    print("Read sapecas-cassino.html:", len(html))

    # 1. Add CSS for fav-heart-btn if not already present
    fav_css = """    /* Favorite Heart Button & Filter */
    .fav-heart-btn {
      position: absolute;
      top: 6px;
      right: 6px;
      z-index: 25;
      background: rgba(0, 0, 0, 0.65);
      border: 1px solid rgba(249, 115, 22, 0.4);
      border-radius: 50%;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
      filter: grayscale(1) opacity(0.65);
    }
    .fav-heart-btn:hover {
      transform: scale(1.15);
      filter: grayscale(0) opacity(1);
    }
    .fav-heart-btn.is-fav {
      filter: grayscale(0) opacity(1);
      background: rgba(225, 29, 72, 0.25);
      border-color: #f43f5e;
      box-shadow: 0 0 10px rgba(244, 63, 94, 0.4);
    }
"""
    if '.fav-heart-btn' not in html:
        html = html.replace('/* Scrollbars */', fav_css + '    /* Scrollbars */')

    # 2. Add Search Input & Favorites button to <header>
    old_header_part = '<button class="btn-dark" onclick="navigate(\'records\')">🏆 Rankings</button>'
    new_header_part = """<button class="btn-dark" onclick="navigate('records')">🏆 Rankings</button>
      <!-- Search Input & Favorites Filter -->
      <div style="background: #250d09; border: 1.5px solid rgba(249,115,22,0.4); border-radius: 10px; padding: 2px 8px; display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 11px; color: #fbbf24;">🔍</span>
        <input id="header-search-input" type="text" placeholder="Buscar..." oninput="onHeaderSearchInput(this.value)" style="background: transparent; border: none; outline: none; color: #fff; font-size: 11px; width: 75px;" />
        <button id="btn-fav-filter" class="btn-dark" onclick="toggleFavoritesFilter()" style="padding: 2px 7px; font-size: 11px; min-height: 24px; display: flex; align-items: center; gap: 4px;" title="Filtrar apenas jogos favoritos">
          ❤️ <span id="fav-btn-label">Favoritos</span> <span id="fav-count-badge" style="font-size: 10px; background: rgba(244,63,94,0.3); border-radius: 10px; padding: 0 4px; font-family: monospace;">0</span>
        </button>
      </div>"""

    if 'id="header-search-input"' not in html:
        html = html.replace(old_header_part, new_header_part)

    # 3. Add Favorites Logic in JavaScript
    fav_js = """    // Favorites and Search State
    let favoriteGameIds = [];
    try {
      const rawFav = localStorage.getItem('sapecas_favorite_games');
      favoriteGameIds = rawFav ? JSON.parse(rawFav) : ['slots', 'blackjack', 'miner'];
    } catch(e) {
      favoriteGameIds = ['slots', 'blackjack', 'miner'];
    }
    let showFavoritesOnly = false;
    let headerSearchQuery = '';

    function toggleFavoriteGame(gameId, event) {
      if (event) event.stopPropagation();
      const idx = favoriteGameIds.indexOf(gameId);
      if (idx !== -1) {
        favoriteGameIds.splice(idx, 1);
      } else {
        favoriteGameIds.push(gameId);
      }
      localStorage.setItem('sapecas_favorite_games', JSON.stringify(favoriteGameIds));
      if (typeof audio !== 'undefined' && audio.coin) audio.coin();
      updateFavoritesUI();
      if (activeGame === 'lobby') {
        renderLobby(document.getElementById('main-content'));
      }
    }

    function toggleFavoritesFilter() {
      showFavoritesOnly = !showFavoritesOnly;
      updateFavoritesUI();
      if (activeGame === 'lobby') {
        renderLobby(document.getElementById('main-content'));
      }
    }

    function onHeaderSearchInput(val) {
      headerSearchQuery = val || '';
      if (activeGame === 'lobby') {
        renderLobby(document.getElementById('main-content'));
      }
    }

    function updateFavoritesUI() {
      const badge = document.getElementById('fav-count-badge');
      if (badge) badge.innerText = favoriteGameIds.length;
      const btn = document.getElementById('btn-fav-filter');
      if (btn) {
        if (showFavoritesOnly) {
          btn.style.background = 'rgba(244, 63, 94, 0.3)';
          btn.style.borderColor = '#f43f5e';
          btn.style.color = '#fda4af';
        } else {
          btn.style.background = '#250d09';
          btn.style.borderColor = 'rgba(249,115,22,0.4)';
          btn.style.color = '#fed7aa';
        }
      }
    }
"""
    if 'function toggleFavoriteGame' not in html:
        html = html.replace('// MULTI-TAB SYNCHRONIZATION LISTENER', fav_js + '\n    // MULTI-TAB SYNCHRONIZATION LISTENER')

    # Also update updateHeaderUI to call updateFavoritesUI
    if 'updateFavoritesUI();' not in html:
        html = html.replace('document.getElementById(\'current-username\').innerText = currentUser.nomeUsuario || currentUser.username;',
                            'document.getElementById(\'current-username\').innerText = currentUser.nomeUsuario || currentUser.username;\n      updateFavoritesUI();')

    # 4. Update renderLobby with data-game-id and heart buttons
    # Replace each card in renderLobby with the heart button
    game_card_defs = [
        ('slots', "<!-- 1. Slots Fortune Dragon -->", "<!-- 1. Slots Fortune Dragon -->\\n          <div class=\"game-card\" data-game-id=\"slots\" onclick=\"navigate('slots')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('slots')?'is-fav':''}\" onclick=\"toggleFavoriteGame('slots', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('blackjack', "<!-- 2. Blackjack -->", "<!-- 2. Blackjack -->\\n          <div class=\"game-card\" data-game-id=\"blackjack\" onclick=\"navigate('blackjack')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('blackjack')?'is-fav':''}\" onclick=\"toggleFavoriteGame('blackjack', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('roulette', "<!-- 3. Roleta Europeia -->", "<!-- 3. Roleta Europeia -->\\n          <div class=\"game-card\" data-game-id=\"roulette\" onclick=\"navigate('roulette')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('roulette')?'is-fav':''}\" onclick=\"toggleFavoriteGame('roulette', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('coinflip', "<!-- 4. Cara ou Coroa -->", "<!-- 4. Cara ou Coroa -->\\n          <div class=\"game-card\" data-game-id=\"coinflip\" onclick=\"navigate('coinflip')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('coinflip')?'is-fav':''}\" onclick=\"toggleFavoriteGame('coinflip', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('poker', "<!-- 5. Texas Hold'em -->", "<!-- 5. Texas Hold'em -->\\n          <div class=\"game-card\" data-game-id=\"poker\" onclick=\"navigate('poker')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('poker')?'is-fav':''}\" onclick=\"toggleFavoriteGame('poker', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('limbo', "<!-- 6. Aviãozinho Limbo -->", "<!-- 6. Aviãozinho Limbo -->\\n          <div class=\"game-card\" data-game-id=\"limbo\" onclick=\"navigate('limbo')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('limbo')?'is-fav':''}\" onclick=\"toggleFavoriteGame('limbo', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('videopoker', "<!-- 7. Video Poker -->", "<!-- 7. Video Poker -->\\n          <div class=\"game-card\" data-game-id=\"videopoker\" onclick=\"navigate('videopoker')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('videopoker')?'is-fav':''}\" onclick=\"toggleFavoriteGame('videopoker', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('baccarat', "<!-- 8. Bacarate -->", "<!-- 8. Bacarate -->\\n          <div class=\"game-card\" data-game-id=\"baccarat\" onclick=\"navigate('baccarat')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('baccarat')?'is-fav':''}\" onclick=\"toggleFavoriteGame('baccarat', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('lottery', "<!-- 9. Loteria Mega -->", "<!-- 9. Loteria Mega -->\\n          <div class=\"game-card\" data-game-id=\"lottery\" onclick=\"navigate('lottery')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('lottery')?'is-fav':''}\" onclick=\"toggleFavoriteGame('lottery', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('craps', "<!-- 10. Craps -->", "<!-- 10. Craps -->\\n          <div class=\"game-card\" data-game-id=\"craps\" onclick=\"navigate('craps')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('craps')?'is-fav':''}\" onclick=\"toggleFavoriteGame('craps', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('keno', "<!-- 11. Keno -->", "<!-- 11. Keno -->\\n          <div class=\"game-card\" data-game-id=\"keno\" onclick=\"navigate('keno')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('keno')?'is-fav':''}\" onclick=\"toggleFavoriteGame('keno', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('scratch', "<!-- 12. Raspadinha -->", "<!-- 12. Raspadinha -->\\n          <div class=\"game-card\" data-game-id=\"scratch\" onclick=\"navigate('scratch')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('scratch')?'is-fav':''}\" onclick=\"toggleFavoriteGame('scratch', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('americanroulette', "<!-- 13. Roleta Americana -->", "<!-- 13. Roleta Americana -->\\n          <div class=\"game-card\" data-game-id=\"americanroulette\" onclick=\"navigate('americanroulette')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('americanroulette')?'is-fav':''}\" onclick=\"toggleFavoriteGame('americanroulette', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('sicbo', "<!-- 14. Sic Bo -->", "<!-- 14. Sic Bo -->\\n          <div class=\"game-card\" data-game-id=\"sicbo\" onclick=\"navigate('sicbo')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('sicbo')?'is-fav':''}\" onclick=\"toggleFavoriteGame('sicbo', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('miner', "<!-- 15. Miner (Campo Minado) -->", "<!-- 15. Miner (Campo Minado) -->\\n          <div class=\"game-card\" data-game-id=\"miner\" onclick=\"navigate('miner')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('miner')?'is-fav':''}\" onclick=\"toggleFavoriteGame('miner', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('plinko', "<!-- 16. Plinko / Bolinhas na Peneira -->", "<!-- 16. Plinko / Bolinhas na Peneira -->\\n          <div class=\"game-card\" data-game-id=\"plinko\" onclick=\"navigate('plinko')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('plinko')?'is-fav':''}\" onclick=\"toggleFavoriteGame('plinko', event)\" title=\"Favoritar jogo\">❤️</button>"),
        ('liars-bar', "<!-- 17. Liar's Bar -->", "<!-- 17. Liar's Bar -->\\n          <div class=\"game-card\" data-game-id=\"liars-bar\" onclick=\"navigate('liars-bar')\">\\n            <button class=\"fav-heart-btn ${favoriteGameIds.includes('liars-bar')?'is-fav':''}\" onclick=\"toggleFavoriteGame('liars-bar', event)\" title=\"Favoritar jogo\">❤️</button>")
    ]

    for g_id, comment_marker, replacement in game_card_defs:
        # Check if already has data-game-id
        if f'data-game-id="{g_id}"' not in html:
            target = comment_marker + "\n          <div class=\"game-card\" onclick=\"navigate('" + g_id + "')\">"
            # In case it has &apos; or variants
            repl_clean = replacement.replace('\\n', '\n')
            if target in html:
                html = html.replace(target, repl_clean)
            else:
                # Try regex
                pattern = re.escape(comment_marker) + r'\s*<div class="game-card"[^>]*>'
                html = re.sub(pattern, repl_clean, html)

    # Add filtering logic inside renderLobby after setting innerHTML
    render_lobby_end = "renderLobby(container) {"
    new_render_lobby_code = """renderLobby(container) {
      setTimeout(() => {
        const cards = document.querySelectorAll('.game-card[data-game-id]');
        let visibleCount = 0;
        cards.forEach(card => {
          const gId = card.getAttribute('data-game-id');
          const title = (card.querySelector('.title')?.innerText || '').toLowerCase();
          const matchesFav = !showFavoritesOnly || favoriteGameIds.includes(gId);
          const matchesSearch = !headerSearchQuery || title.includes(headerSearchQuery.toLowerCase());
          if (matchesFav && matchesSearch) {
            card.style.display = 'flex';
            visibleCount++;
          } else {
            card.style.display = 'none';
          }
        });
        const grid = document.querySelector('.games-grid');
        const existingEmpty = document.getElementById('lobby-empty-notice');
        if (visibleCount === 0) {
          if (!existingEmpty && grid) {
            const emptyNotice = document.createElement('div');
            emptyNotice.id = 'lobby-empty-notice';
            emptyNotice.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 30px; background: #180705; border: 1.5px solid rgba(249,115,22,0.3); border-radius: 12px;';
            emptyNotice.innerHTML = `
              <div style="font-size: 32px; margin-bottom: 8px;">❤️</div>
              <strong style="color: #fff; font-size: 14px;">Nenhum jogo encontrado</strong>
              <p style="color: #fed7aa; font-size: 11px; margin-top: 4px;">${showFavoritesOnly ? 'Você ainda não marcou nenhum jogo como favorito. Clique no coração ❤️ em qualquer jogo!' : 'Nenhum jogo corresponde à sua busca.'}</p>
              <button class="btn-gold" style="margin-top: 10px; padding: 6px 16px; font-size: 11px;" onclick="showFavoritesOnly=false; headerSearchQuery=''; updateFavoritesUI(); renderLobby(document.getElementById('main-content'));">Ver Todos os Jogos</button>
            `;
            grid.appendChild(emptyNotice);
          }
        } else if (existingEmpty) {
          existingEmpty.remove();
        }
      }, 0);
"""
    if 'renderLobby(container) {\n      setTimeout(() => {' not in html:
        html = html.replace('renderLobby(container) {', new_render_lobby_code)

    with open('sapecas-cassino.html', 'w', encoding='utf-8') as f:
        f.write(html)
    with open('public/sapecas-cassino.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Successfully updated sapecas-cassino.html and public/sapecas-cassino.html. Total length:", len(html))

if __name__ == '__main__':
    main()
